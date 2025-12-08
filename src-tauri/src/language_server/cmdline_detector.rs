use anyhow::{anyhow, Result};
use regex::Regex;
use std::process::Command;
use sysinfo::System;

/// 从进程命令行参数中提取 CSRF Token 和端口信息
pub struct CmdLineDetector {
    process_name_patterns: Vec<String>,
}

impl CmdLineDetector {
    pub fn new() -> Self {
        Self {
            process_name_patterns: vec![
                "language_server_windows_x64".to_string(),  // Windows 完整进程名
                "language_server_macos".to_string(),        // macOS 进程名
                "language_server_linux".to_string(),        // Linux 进程名
                "language_server".to_string(),              // 通用后备
                "antigravity".to_string(),
                "windsurf".to_string(),
            ],
        }
    }

    /// 检测进程信息（端口和 CSRF Token）
    pub fn detect_process_info(&self) -> Result<ProcessInfo> {
        tracing::info!("开始从进程命令行参数检测 CSRF Token 和端口...");

        // 1. 查找目标进程
        let pids = self.find_target_processes()?;
        if pids.is_empty() {
            return Err(anyhow!("未找到运行中的 Antigravity/Windsurf 进程"));
        }

        tracing::info!("找到 {} 个候选进程", pids.len());

        // 2. 遍历进程，提取命令行参数
        for pid in pids {
            match self.extract_from_cmdline(pid) {
                Ok(Some(info)) => {
                    tracing::info!(
                        "[CmdLineDetector] 成功从 PID {} 提取信息: extension_port={:?}, csrf_token=[present]",
                        pid,
                        info.extension_port
                    );
                    return Ok(info);
                }
                Ok(None) => {
                    tracing::debug!("PID {} 的命令行中未找到所需信息", pid);
                    continue;
                }
                Err(e) => {
                    tracing::warn!("处理 PID {} 失败: {}", pid, e);
                    continue;
                }
            }
        }

        Err(anyhow!("未能从任何进程命令行中提取 CSRF Token"))
    }

    /// 查找目标进程的 PID 列表
    fn find_target_processes(&self) -> Result<Vec<u32>> {
        let mut system = System::new();
        system.refresh_processes();

        let mut pids: Vec<u32> = system
            .processes()
            .iter()
            .filter_map(|(pid, proc_)| {
                let name = proc_.name().to_string().to_lowercase();
                
                // 检查进程名是否匹配
                for pattern in &self.process_name_patterns {
                    if name.contains(pattern) {
                        return Some(pid.as_u32());
                    }
                }
                None
            })
            .collect();

        // 按 PID 倒序排列，优先检查最新的进程
        pids.sort_unstable_by(|a, b| b.cmp(a));

        Ok(pids)
    }

    /// 从进程命令行参数中提取信息
    fn extract_from_cmdline(&self, pid: u32) -> Result<Option<ProcessInfo>> {
        let cmdline = self.get_process_cmdline(pid)?;
        
        if cmdline.is_empty() {
            return Ok(None);
        }

        tracing::debug!("PID {} 命令行: {}", pid, &cmdline[..cmdline.len().min(200)]);

        // 解析命令行参数
        let extension_port = self.extract_port(&cmdline, "--extension_server_port")?;
        let api_port = self.extract_port(&cmdline, "--api_server_port")?;
        let csrf_token = self.extract_csrf_token(&cmdline)?;

        if let Some(token) = csrf_token {
            return Ok(Some(ProcessInfo {
                pid,
                extension_port,
                api_port,
                csrf_token: token,
            }));
        }

        Ok(None)
    }

    /// 获取进程命令行（跨平台）
    fn get_process_cmdline(&self, pid: u32) -> Result<String> {
        #[cfg(target_os = "macos")]
        {
            self.get_cmdline_macos(pid)
        }

        #[cfg(target_os = "linux")]
        {
            self.get_cmdline_linux(pid)
        }

        #[cfg(target_os = "windows")]
        {
            self.get_cmdline_windows(pid)
        }
    }

    #[cfg(target_os = "macos")]
    fn get_cmdline_macos(&self, pid: u32) -> Result<String> {
        let output = Command::new("ps")
            .args(&["-p", &pid.to_string(), "-o", "command="])
            .output()
            .map_err(|e| anyhow!("执行 ps 命令失败: {}", e))?;

        if !output.status.success() {
            return Err(anyhow!("ps 命令执行失败"));
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    #[cfg(target_os = "linux")]
    fn get_cmdline_linux(&self, pid: u32) -> Result<String> {
        let cmdline_path = format!("/proc/{}/cmdline", pid);
        let content = std::fs::read_to_string(&cmdline_path)
            .map_err(|e| anyhow!("读取 /proc/{}/cmdline 失败: {}", pid, e))?;

        // /proc/*/cmdline 使用 null 字符分隔参数，转换为空格
        Ok(content.replace('\0', " "))
    }

    #[cfg(target_os = "windows")]
    fn get_cmdline_windows(&self, pid: u32) -> Result<String> {
        tracing::debug!("[CmdLineDetector] Attempting to get command line for PID {}", pid);
        
        // 方法 1: 使用 sysinfo crate（最可靠，跨平台）
        tracing::debug!("[CmdLineDetector] Trying sysinfo method...");
        let mut system = System::new();
        system.refresh_processes();
        
        if let Some(process) = system.process(sysinfo::Pid::from_u32(pid)) {
            let cmd = process.cmd();
            if !cmd.is_empty() {
                let cmdline = cmd.join(" ");
                if !cmdline.is_empty() {
                    tracing::info!("[CmdLineDetector] sysinfo method succeeded");
                    return Ok(cmdline);
                }
            }
        }
        
        // 方法 2: 使用 Get-CimInstance（推荐，无需管理员权限）
        tracing::debug!("[CmdLineDetector] Trying Get-CimInstance method...");
        
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            
            match Command::new("powershell")
                .creation_flags(CREATE_NO_WINDOW)  // 隐藏窗口
                .args(&[
                    "-NoProfile",
                    "-Command",
                    &format!("(Get-CimInstance Win32_Process -Filter \"ProcessId = {}\").CommandLine", pid),
                ])
                .output()
            {
                Ok(output) if output.status.success() => {
                    let cmdline = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !cmdline.is_empty() && cmdline != "null" {
                        tracing::info!("[CmdLineDetector] Get-CimInstance method succeeded");
                        return Ok(cmdline);
                    }
                    tracing::debug!("[CmdLineDetector] Get-CimInstance returned empty or null output");
                }
                Ok(_) => {
                    tracing::debug!("[CmdLineDetector] Get-CimInstance command failed");
                }
                Err(e) => {
                    tracing::debug!("[CmdLineDetector] Get-CimInstance execution error: {}", e);
                }
            }
        }
        
        // 方法 3: 使用 Get-WmiObject（后备方案，兼容旧系统）
        tracing::debug!("[CmdLineDetector] Trying Get-WmiObject method...");
        
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            
            match Command::new("powershell")
                .creation_flags(CREATE_NO_WINDOW)  // 隐藏窗口
                .args(&[
                    "-NoProfile",
                    "-Command",
                    &format!("(Get-WmiObject Win32_Process -Filter \"ProcessId = {}\").CommandLine", pid),
                ])
                .output()
            {
                Ok(output) if output.status.success() => {
                    let cmdline = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !cmdline.is_empty() && cmdline != "null" {
                        tracing::info!("[CmdLineDetector] Get-WmiObject method succeeded");
                        return Ok(cmdline);
                    }
                    tracing::debug!("[CmdLineDetector] Get-WmiObject returned empty or null output");
                }
                Ok(_) => {
                    tracing::debug!("[CmdLineDetector] Get-WmiObject command failed");
                }
                Err(e) => {
                    tracing::debug!("[CmdLineDetector] Get-WmiObject execution error: {}", e);
                }
            }
        }

        Err(anyhow!("无法获取进程 {} 的命令行参数", pid))
    }

    /// 从命令行中提取端口号
    fn extract_port(&self, cmdline: &str, flag: &str) -> Result<Option<u16>> {
        // 匹配 --flag=1234 或 --flag 1234
        let pattern = format!(r"{}[=\s]+(\d+)", regex::escape(flag));
        let re = Regex::new(&pattern)?;

        if let Some(caps) = re.captures(cmdline) {
            if let Some(port_str) = caps.get(1) {
                let port: u16 = port_str.as_str().parse()
                    .map_err(|e| anyhow!("解析端口号失败: {}", e))?;
                return Ok(Some(port));
            }
        }

        Ok(None)
    }

    /// 从命令行中提取 CSRF Token
    fn extract_csrf_token(&self, cmdline: &str) -> Result<Option<String>> {
        // 1. 优先尝试匹配明确的参数 --csrf_token=TOKEN 或 --csrf_token TOKEN
        // 使用宽松的匹配模式，匹配任意十六进制字符串（包括连字符）
        // 参考 AntigravityQuotaWatcher 的实现: /--csrf_token[=\\s]+([a-f0-9\\-]+)/i
        let explicit_re = Regex::new(r"(?i)--csrf_token[=\s]+([a-f0-9\-]+)")?;
        
        if let Some(caps) = explicit_re.captures(cmdline) {
            if let Some(token) = caps.get(1) {
                let token_str = token.as_str().to_string();
                tracing::info!("通过 --csrf_token 参数找到 Token: {}...", &token_str[..token_str.len().min(8)]);
                return Ok(Some(token_str));
            }
        }

        // 2. 尝试匹配 manager_token (有时用这个名字)
        let manager_re = Regex::new(r"(?i)--manager_token[=\s]+([a-f0-9\-]+)")?;
        if let Some(caps) = manager_re.captures(cmdline) {
            if let Some(token) = caps.get(1) {
                let token_str = token.as_str().to_string();
                tracing::info!("通过 --manager_token 参数找到 Token: {}...", &token_str[..token_str.len().min(8)]);
                return Ok(Some(token_str));
            }
        }

        tracing::warn!("未能从命令行中提取 CSRF Token");
        Ok(None)
    }
}

/// 进程信息
#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub extension_port: Option<u16>,
    pub api_port: Option<u16>,
    pub csrf_token: String,
}

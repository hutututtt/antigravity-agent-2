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
                "language_server".to_string(),
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
                        "成功从 PID {} 提取信息: extension_port={:?}, csrf_token={}...",
                        pid,
                        info.extension_port,
                        &info.csrf_token[..8.min(info.csrf_token.len())]
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
        // 尝试使用 PowerShell
        let output = Command::new("powershell")
            .args(&[
                "-NoProfile",
                "-Command",
                &format!("(Get-Process -Id {}).CommandLine", pid),
            ])
            .output()
            .map_err(|e| anyhow!("执行 PowerShell 命令失败: {}", e))?;

        if output.status.success() {
            let cmdline = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !cmdline.is_empty() {
                return Ok(cmdline);
            }
        }

        // PowerShell 失败，尝试 WMIC
        let output = Command::new("wmic")
            .args(&[
                "process",
                "where",
                &format!("ProcessId={}", pid),
                "get",
                "CommandLine",
                "/value",
            ])
            .output()
            .map_err(|e| anyhow!("执行 WMIC 命令失败: {}", e))?;

        if !output.status.success() {
            return Err(anyhow!("WMIC 命令执行失败"));
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        
        // 解析 WMIC 输出: CommandLine=...
        for line in output_str.lines() {
            if let Some(cmdline) = line.strip_prefix("CommandLine=") {
                return Ok(cmdline.trim().to_string());
            }
        }

        Err(anyhow!("未能从 WMIC 输出中提取命令行"))
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
        // 1. 优先尝试匹配明确的参数 --csrf_token=UUID 或 --csrf_token UUID
        // 忽略大小写
        let explicit_re = Regex::new(r"(?i)--csrf_token[=\s]+([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})")?;
        
        if let Some(caps) = explicit_re.captures(cmdline) {
            if let Some(token) = caps.get(1) {
                tracing::info!("通过 --csrf_token 参数找到 Token");
                return Ok(Some(token.as_str().to_string()));
            }
        }

        // 2. 尝试匹配 manager_token (有时用这个名字)
        let manager_re = Regex::new(r"(?i)--manager_token[=\s]+([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})")?;
        if let Some(caps) = manager_re.captures(cmdline) {
            if let Some(token) = caps.get(1) {
                tracing::info!("通过 --manager_token 参数找到 Token");
                return Ok(Some(token.as_str().to_string()));
            }
        }

        // 3. 最后的手段：查找所有 UUID，并尝试找到最像 CSRF token 的那个
        // UUID 格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        let uuid_re = Regex::new(
            r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
        )?;

        // 在命令行中查找所有 UUID
        let uuids: Vec<&str> = uuid_re
            .find_iter(cmdline)
            .map(|m| m.as_str())
            .collect();

        if uuids.is_empty() {
            return Ok(None);
        }

        // 如果找到多个 UUID，优先选择在 csrf 相关参数附近的
        for uuid in &uuids {
            // 检查 UUID 前后是否有 csrf 相关的关键词
            if let Some(pos) = cmdline.find(uuid) {
                let start = pos.saturating_sub(50);
                let end = (pos + uuid.len() + 50).min(cmdline.len());
                let context = &cmdline[start..end].to_lowercase();
                
                if context.contains("csrf") || context.contains("token") {
                    tracing::info!("通过上下文推断找到 Token: {}...", &uuid[..8]);
                    return Ok(Some(uuid.to_string()));
                }
            }
        }

        // 如果没有找到明确的 csrf token，但只有一个 UUID，那可能就是它
        if uuids.len() == 1 {
             tracing::info!("未找到明确标识，但命令行中仅有一个 UUID，假定为 Token");
             return Ok(Some(uuids[0].to_string()));
        }

        tracing::warn!("找到多个 UUID 但无法确定哪一个是 CSRF Token，放弃猜测");
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

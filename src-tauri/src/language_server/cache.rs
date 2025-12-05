//! 语言服务器缓存系统
//!
//! 提供 CSRF Token 和端口信息的缓存管理
//! 使用 moka 实现异步缓存，手动管理失效

use std::sync::Arc;
use anyhow::{Result, anyhow};
use regex::Regex;

use super::types::{PortInfo, CacheStats, CacheConfig};
use super::utils::{find_latest_antigravity_log, parse_ports_from_log};

/// 缓存管理器
pub struct CacheManager {
    /// CSRF Token 缓存 (手动管理失效)
    csrf_cache: Arc<moka::future::Cache<String, String>>,
    /// 端口信息缓存 (手动管理失效)
    ports_cache: Arc<moka::future::Cache<String, PortInfo>>,
}

impl CacheManager {
    pub fn new() -> Self {
        let config = CacheConfig::default();
        Self::with_config(config)
    }

    pub fn with_config(config: CacheConfig) -> Self {
        Self {
            csrf_cache: Arc::new(
                moka::future::CacheBuilder::new(config.max_cache_entries)
                    .time_to_live(std::time::Duration::from_secs(config.ttl_seconds))
                    .build()
            ),
            ports_cache: Arc::new(
                moka::future::CacheBuilder::new(config.max_cache_entries)
                    .time_to_live(std::time::Duration::from_secs(config.ttl_seconds))
                    .build()
            ),
        }
    }

    /// 获取 CSRF token (如果有效)
    pub async fn get_csrf_token(&self, cache_key: &str) -> Option<String> {
        self.csrf_cache.get(cache_key).await
    }

    /// 缓存 CSRF token
    pub async fn set_csrf_token(&self, cache_key: &str, token: String) {
        self.csrf_cache.insert(cache_key.to_string(), token).await;
        tracing::info!("CSRF token 已缓存");
    }

    /// 获取端口信息 (如果有效)
    pub async fn get_ports(&self, cache_key: &str) -> Option<PortInfo> {
        self.ports_cache.get(cache_key).await
    }

    /// 缓存端口信息
    pub async fn set_ports(&self, cache_key: &str, ports: PortInfo) {
        self.ports_cache.insert(cache_key.to_string(), ports).await;
        tracing::info!("端口信息已缓存");
    }

    
    /// 清空所有缓存
    pub fn clear_all(&self) {
        self.csrf_cache.invalidate_all();
        self.ports_cache.invalidate_all();
        tracing::info!("所有缓存已清空");
    }

    /// 获取缓存统计信息
    pub fn get_stats(&self) -> CacheStats {
        CacheStats {
            csrf_cache_size: self.csrf_cache.entry_count(),
            ports_cache_size: self.ports_cache.entry_count(),
        }
    }
}

/// 全局缓存管理器实例
static GLOBAL_CACHE: std::sync::OnceLock<Arc<CacheManager>> = std::sync::OnceLock::new();

/// 获取全局缓存管理器
pub fn get_cache_manager() -> &'static Arc<CacheManager> {
    GLOBAL_CACHE.get_or_init(|| {
        Arc::new(CacheManager::new())
    })
}

// ========== 高级 API（业务逻辑）==========

/// 获取 CSRF token（带自动缓存）
///
/// 逻辑：
/// 1. 有缓存 -> 返回缓存
/// 2. 无缓存 -> 扫描内存 -> 缓存 -> 返回
pub async fn get_csrf_token() -> Result<String> {
    let cache = get_cache_manager();
    let cache_key = "csrf_token";
    
    // 1. 尝试从缓存获取
    if let Some(cached_token) = cache.get_csrf_token(cache_key).await {
        tracing::info!("✅ 使用缓存的 CSRF Token (TTL: 5分钟)");
        return Ok(cached_token);
    }
    
    // 2. 缓存未命中或已过期，重新扫描
    tracing::info!("缓存未命中，开始扫描进程获取 CSRF Token");
    let token = tokio::task::spawn_blocking(|| {
        find_csrf_token_from_memory()
    }).await??;

    tracing::info!("✅ 成功获取 CSRF Token: {}", token);
    
    // 3. 更新缓存
    cache.set_csrf_token(cache_key, token.clone()).await;

    Ok(token)
}

/// 获取端口信息（带自动缓存）
///
/// 逻辑：
/// 1. 有缓存 -> 返回缓存
/// 2. 无缓存 -> 解析日志 -> 缓存 -> 返回
pub async fn get_ports() -> Result<PortInfo> {
    let cache = get_cache_manager();
    let cache_key = "ports_info";
    
    // 1. 尝试从缓存获取
    if let Some(cached_ports) = cache.get_ports(cache_key).await {
        tracing::info!("✅ 使用缓存的端口信息 (TTL: 5分钟)");
        return Ok(cached_ports);
    }
    
    // 2. 缓存未命中或已过期，重新解析
    tracing::info!("缓存未命中，开始解析日志文件获取端口信息");
    let ports = parse_ports_from_log_sync();

    tracing::info!("✅ 成功获取端口信息: https_port={:?}, http_port={:?}, extension_port={:?}", 
        ports.https_port, ports.http_port, ports.extension_port);
    
    // 3. 更新缓存
    cache.set_ports(cache_key, ports.clone()).await;

    Ok(ports)
}

/// 清空所有缓存
pub async fn clear_all() {
    let cache = get_cache_manager();
    cache.clear_all();
}

/// 获取缓存统计
pub fn get_stats() -> CacheStats {
    let cache = get_cache_manager();
    cache.get_stats()
}

// ========== 内部辅助函数 ==========

/// 从进程命令行参数中查找 CSRF token
fn find_csrf_token_from_memory() -> Result<String> {
    use super::cmdline_detector::CmdLineDetector;
    
    tracing::info!("使用命令行参数检测 CSRF Token...");
    
    let detector = CmdLineDetector::new();
    let process_info = detector.detect_process_info()
        .map_err(|e| anyhow!("从进程命令行提取 CSRF Token 失败: {}", e))?;
    
    tracing::info!(
        "成功从进程命令行提取 CSRF Token (PID: {}, extension_port: {:?})",
        process_info.pid,
        process_info.extension_port
    );
    
    Ok(process_info.csrf_token)
}

/// 从日志文件解析端口信息
fn parse_ports_from_log_sync() -> PortInfo {
    match find_latest_antigravity_log() {
        Some(log_path) => {
            match std::fs::read_to_string(&log_path) {
                Ok(content) => {
                    let (https_port, http_port, extension_port) = parse_ports_from_log(&content);
                    PortInfo {
                        https_port,
                        http_port,
                        extension_port,
                        log_path: Some(log_path.to_string_lossy().to_string()),
                        csrf_token: None,
                    }
                }
                Err(_) => PortInfo::default(),
            }
        }
        None => PortInfo::default(),
    }
}

/// 收集 Antigravity 进程 PID
fn collect_antigravity_pids() -> Vec<u32> {
    use sysinfo::System;

    let mut system = System::new();
    system.refresh_processes();

    let mut pids = Vec::new();

    for (pid, process) in system.processes() {
        let name = process.name();
        if name == "Antigravity.exe" ||name == "antigravity" || name.contains("Antigravity") {
            pids.push(pid.as_u32());
        }
    }

    pids
}

/// 获取搜索模式（UTF-8 和 UTF-16）
fn get_search_patterns() -> (Vec<u8>, Vec<u8>) {
    let key = "x-codeium-csrf-token";
    let pat_utf8 = key.as_bytes().to_vec();
    let pat_utf16: Vec<u8> = key.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();
    (pat_utf8, pat_utf16)
}


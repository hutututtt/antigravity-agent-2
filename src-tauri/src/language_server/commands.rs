use std::time::Duration;

use super::cache::{get_csrf_token, get_ports, clear_all, get_stats};
use super::types::{
    RequestMetadata, UserStatusRequest, HttpConfig, CacheInitResult
};
use super::utils::initialize_cache;

/// 测试端口连接性（使用 GetUnleashData 端点）
async fn test_port_connectivity(port: u16, csrf_token: &str) -> bool {
    let client = match reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_millis(2000))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let url = format!(
        "https://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/GetUnleashData",
        port
    );

    let request_body = serde_json::json!({
        "context": {
            "properties": {
                "devMode": "false",
                "extensionVersion": "",
                "hasAnthropicModelAccess": "true",
                "ide": "antigravity",
                "ideVersion": "1.11.2",
                "installationId": "test-detection",
                "language": "UNSPECIFIED",
                "os": "macos",
                "requestedModelId": "MODEL_UNSPECIFIED"
            }
        }
    });

    tracing::debug!("测试端口 {} 连接性...", port);

    let result = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Connect-Protocol-Version", "1")
        .header("X-Codeium-Csrf-Token", csrf_token)
        .json(&request_body)
        .send()
        .await;

    match result {
        Ok(resp) => {
            let status = resp.status();
            tracing::debug!("端口 {} 响应状态: {}", port, status);
            status.is_success()
        }
        Err(e) => {
            tracing::debug!("端口 {} 测试失败: {}", port, e);
            false
        }
    }
}

/// 查找可用的 HTTPS API 端口
async fn find_working_https_port(extension_port: u16, csrf_token: &str) -> Result<u16, String> {
    tracing::info!("开始查找可用的 HTTPS API 端口，基础端口: {}", extension_port);

    // 候选端口列表
    let candidates = vec![
        extension_port + 1,  // 通常是这个
        extension_port,
        extension_port + 2,
        42100, 42101, 42102, // 常见的固定端口
    ];

    tracing::info!("候选端口: {:?}", candidates);

    for port in candidates {
        tracing::info!("测试端口 {}...", port);
        if test_port_connectivity(port, csrf_token).await {
            tracing::info!("✅ 找到可用端口: {}", port);
            return Ok(port);
        }
    }

    // 如果所有端口都测试失败，回退到使用 extension_port
    tracing::warn!("所有端口测试失败，回退使用 extension_port: {}", extension_port);
    Ok(extension_port)
}

/// 执行获取用户状态的核心逻辑
async fn do_get_user_status(_api_key: &str) -> Result<serde_json::Value, String> {
    tracing::info!("========== 开始获取用户配额 ==========");
    
    // 1) 获取基础端口信息和 CSRF token
    let port_info = get_ports().await
        .map_err(|e| format!("获取端口信息失败: {e}"))?;
    let extension_port = port_info.https_port
        .ok_or_else(|| "端口信息中未找到端口".to_string())?;
    
    let csrf = get_csrf_token().await
        .map_err(|e| format!("提取 csrf_token 失败: {e}"))?;

    tracing::info!("========== 配额获取诊断信息 ==========");
    tracing::info!("✅ Extension Port: {}", extension_port);
    tracing::info!("✅ CSRF Token: {}...", &csrf[..8.min(csrf.len())]);
    tracing::info!("📋 端口详情: https_port={:?}, http_port={:?}, extension_port={:?}", 
        port_info.https_port, port_info.http_port, port_info.extension_port);
    tracing::info!("========================================");

    // 2) 测试并找到可用的 HTTPS API 端口
    let working_port = find_working_https_port(extension_port, &csrf).await
        .map_err(|e| format!("查找可用端口失败: {e}"))?;

    tracing::info!("🎯 使用端口 {} 发送 GetUserStatus 请求", working_port);

    // 3) 构造 URL 和请求体
    let target_url = format!(
        "https://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/GetUserStatus",
        working_port
    );

    let http_config = HttpConfig::default();
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_millis(http_config.request_timeout_ms))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {e}"))?;

    let metadata = RequestMetadata {
        // 插件不发送 API Key，只发送基础元数据
        // api_key: api_key.to_string(), 
        ..Default::default()
    };

    let request_body = UserStatusRequest { metadata };
    let body_bytes = serde_json::to_vec(&request_body)
        .map_err(|e| format!("序列化请求体失败: {e}"))?;

    let mut req = client.post(&target_url);

    // 模拟前端请求头 (与插件保持一致)
    req = req
        .header("accept", "*/*")
        .header("accept-language", "en-US")
        .header("connect-protocol-version", "1")
        .header("content-type", "application/json")
        .header("priority", "u=1, i")
        .header("sec-ch-ua", "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\"")
        .header("sec-ch-ua-mobile", "?0")
        .header("sec-ch-ua-platform", "\"Windows\"")
        .header("sec-fetch-dest", "empty")
        .header("sec-fetch-mode", "cors")
        .header("sec-fetch-site", "cross-site")
        // 注意：插件使用 X-Codeium-Csrf-Token (首字母大写)
        .header("X-Codeium-Csrf-Token", csrf.clone());

    let resp = req
        .body(body_bytes)
        .send()
        .await
        .map_err(|e| format!("请求失败: {e}"))?;

    let status = resp.status();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取响应失败: {e}"))?;

    if !status.is_success() {
        tracing::error!("❌ GetUserStatus 请求失败: 状态码={}, Body={}", status, String::from_utf8_lossy(&bytes));
        return Err(format!("请求返回错误状态码: {}, Body: {}", status, String::from_utf8_lossy(&bytes)));
    }

    tracing::info!("✅ GetUserStatus 响应成功: 状态码={}", status);

    // 直接解析为 JSON
    let json: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|e| format!("解析 JSON 失败: {e}; body={}", String::from_utf8_lossy(&bytes)))?;

    Ok(json)
}

/// 前端调用 GetUserStatus 的公开命令
#[tauri::command]
pub async fn language_server_get_user_status(
    api_key: String,
) -> Result<serde_json::Value, String> {

    if api_key.trim().is_empty() {
        return Err("apiKey 不能为空".to_string());
    }

    // 第一次尝试
    match do_get_user_status(&api_key).await {
        Ok(json) => Ok(json),
        Err(e) => {
            tracing::warn!("第一次获取配额失败: {}。尝试清空缓存并重试...", e);
            
            // 清空缓存
            clear_all().await;
            
            // 第二次尝试 (强制重新扫描)
            match do_get_user_status(&api_key).await {
                Ok(json) => {
                    tracing::info!("重试成功！");
                    Ok(json)
                },
                Err(e2) => {
                    tracing::error!("重试仍然失败: {}", e2);
                    Err(format!("获取配额失败 (已重试): {}", e2))
                }
            }
        }
    }
}


/// 清空所有缓存命令
#[tauri::command]
pub async fn clear_all_cache_command() -> Result<(), String> {
    tracing::info!("收到清空所有缓存请求");
    clear_all().await;
    tracing::info!("所有缓存已清空");
    Ok(())
}

/// 获取缓存统计信息命令
#[tauri::command]
pub fn get_cache_stats_command() -> Result<super::types::CacheStats, String> {
    tracing::info!("收到获取缓存统计信息请求");
    let stats = get_stats();
    tracing::info!("缓存统计: CSRF={}, 端口={}", stats.csrf_cache_size, stats.ports_cache_size);
    Ok(stats)
}

/// 初始化语言服务器缓存（预热）
#[tauri::command]
pub async fn initialize_language_server_cache() -> Result<CacheInitResult, String> {
    tracing::info!("收到语言服务器缓存初始化请求");
    let result = initialize_cache().await;
    tracing::info!("缓存初始化完成: {}", result.message);
    Ok(result)
}

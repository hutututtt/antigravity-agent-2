use super::cache::{get_csrf_token, get_ports};

/// 调试命令：获取当前缓存的 CSRF Token 和端口信息
#[tauri::command]
pub async fn debug_get_cache_info() -> Result<String, String> {
    let mut info = String::new();
    
    // 获取端口信息
    match get_ports().await {
        Ok(port_info) => {
            info.push_str(&format!("端口信息:\n"));
            info.push_str(&format!("  HTTPS 端口: {:?}\n", port_info.https_port));
            info.push_str(&format!("  HTTP 端口: {:?}\n", port_info.http_port));
            info.push_str(&format!("  Extension 端口: {:?}\n", port_info.extension_port));
            info.push_str(&format!("  日志路径: {:?}\n\n", port_info.log_path));
        }
        Err(e) => {
            info.push_str(&format!("获取端口信息失败: {}\n\n", e));
        }
    }
    
    // 获取 CSRF Token
    match get_csrf_token().await {
        Ok(token) => {
            info.push_str(&format!("CSRF Token: {}\n", token));
        }
        Err(e) => {
            info.push_str(&format!("获取 CSRF Token 失败: {}\n", e));
        }
    }
    
    Ok(info)
}

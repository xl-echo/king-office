// 日志系统模块
// 提供结构化日志记录功能，支持文件输出和日志轮转

use chrono::Local;
use std::fs::{self, OpenOptions};
use std::path::PathBuf;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// 获取日志目录
pub fn get_log_dir() -> Result<PathBuf, String> {
    let base_dir = dirs::data_local_dir()
        .ok_or_else(|| "无法获取本地数据目录".to_string())?;
    
    let log_dir = base_dir.join("KingOffice").join("logs");
    
    fs::create_dir_all(&log_dir)
        .map_err(|e| format!("创建日志目录失败: {}", e))?;
    
    Ok(log_dir)
}

/// 获取当前日志文件路径
pub fn get_current_log_file() -> Result<PathBuf, String> {
    let log_dir = get_log_dir()?;
    let log_file = log_dir.join(format!(
        "kingoffice-{}.log",
        Local::now().format("%Y-%m-%d")
    ));
    Ok(log_file)
}

/// 初始化日志系统
pub fn init_logger() -> Result<(), String> {
    let log_file = get_current_log_file()?;
    
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|e| format!("无法创建日志文件: {}", e))?;
    
    let (non_blocking, _guard) = tracing_appender::non_blocking(file);
    
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));
    
    let fmt_layer = fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false)
        .with_file(true)
        .with_line_number(true);
    
    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .init();
    
    Box::leak(Box::new(_guard));
    
    tracing::info!("[日志系统] 日志系统初始化完成");
    tracing::info!("[日志系统] 日志文件: {:?}", log_file);
    
    Ok(())
}

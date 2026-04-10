// KingOffice - King办公套件
// 主程序入口

#![windows_subsystem = "windows"]

use std::sync::atomic::{AtomicBool, Ordering};
use tracing::{info, error};
use tauri::Manager;

mod account;
mod logger;

static EXIT_FLAG: AtomicBool = AtomicBool::new(false);

fn main() {
    // 初始化日志系统
    if let Err(e) = logger::init_logger() {
        eprintln!("初始化日志系统失败: {}", e);
    }
    
    info!("===========================================");
    info!("[KingOffice] King办公套件 启动中...");
    info!("===========================================");
    
    // 设置全局panic处理
    std::panic::set_hook(Box::new(|panic_info| {
        error!("[PANIC] 应用发生严重错误: {}", panic_info);
        
        if let Some(log_dir) = dirs::data_local_dir() {
            let emergency_log = log_dir.join("KingOffice").join("logs").join("emergency.log");
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(emergency_log)
            {
                use std::io::Write;
                let _ = writeln!(
                    file,
                    "[{}] PANIC: {}",
                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                    panic_info
                );
            }
        }
    }));
    
    // 初始化账户系统
    if let Err(e) = account::init_account_system() {
        error!("[账户] 初始化账户系统失败: {}", e);
    } else {
        info!("[账户] 账户系统初始化完成");
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            account::create_account,
            account::verify_account,
            account::is_account_exists,
            account::get_current_user,
            register_child_process,
            set_exit_flag,
            cleanup_and_exit,
            get_app_data_dir,
            launch_application,
            create_desktop_shortcut,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        info!("[窗口] 收到关闭请求");
                        kill_all_child_processes();
                        info!("[窗口] 所有子进程已清理");
                    }
                });
            }
            std::mem::forget(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("运行Tauri应用时发生错误");
}

// 进程管理命令
#[tauri::command]
fn register_child_process(pid: u32) -> Result<(), String> {
    use std::sync::Mutex;
    static CHILD_PIDS_MUTEX: Mutex<Vec<u32>> = Mutex::new(Vec::new());

    if let Ok(mut pids) = CHILD_PIDS_MUTEX.lock() {
        pids.push(pid);
    }
    Ok(())
}

#[tauri::command]
fn set_exit_flag() -> Result<(), String> {
    EXIT_FLAG.store(true, Ordering::SeqCst);
    // 当设置退出标志时，清理所有子进程
    kill_all_child_processes();
    Ok(())
}

#[tauri::command]
fn cleanup_and_exit(app: tauri::AppHandle) -> Result<(), String> {
    kill_all_child_processes();
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn get_app_data_dir() -> Result<String, String> {
    let dir = dirs::data_local_dir()
        .ok_or("无法获取应用数据目录")?
        .join("KingOffice");
    Ok(dir.to_string_lossy().to_string())
}

fn kill_all_child_processes() {
    // 使用互斥锁保护CHILD_PIDS，避免静态可变引用问题
    use std::sync::Mutex;
    static CHILD_PIDS_MUTEX: Mutex<Vec<u32>> = Mutex::new(Vec::new());

    if let Ok(mut pids) = CHILD_PIDS_MUTEX.lock() {
        #[cfg(windows)]
        {
            use std::process::Command;
            for &pid in pids.iter() {
                let _ = Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .output();
            }
        }
        pids.clear();
    }
}

// 启动应用程序（设置完成后使用）
#[tauri::command]
fn launch_application() -> Result<(), String> {
    info!("[启动] 准备启动 King办公套件...");
    // 由于已经是主程序，直接返回成功即可
    // 前端会继续显示主界面
    Ok(())
}

// 创建桌面快捷方式
#[tauri::command]
fn create_desktop_shortcut() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::env;
        use std::fs;
        use std::path::PathBuf;
        
        // 获取当前exe路径
        let exe_path = env::current_exe()
            .map_err(|e| format!("无法获取程序路径: {}", e))?;
        
        // 获取桌面路径
        let desktop = dirs::desktop_dir()
            .ok_or("无法获取桌面路径")?;
        
        // 快捷方式文件路径
        let shortcut_path = desktop.join("King办公套件.lnk");
        
        // 使用PowerShell创建快捷方式
        let ps_script = format!(
            r#"$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('{}'); $Shortcut.TargetPath = '{}'; $Shortcut.WorkingDirectory = '{}'; $Shortcut.Description = 'King办公套件'; $Shortcut.Save()"#,
            shortcut_path.to_string_lossy().replace("'", "''"),
            exe_path.to_string_lossy().replace("'", "''"),
            exe_path.parent().unwrap_or(&exe_path).to_string_lossy().replace("'", "''")
        );
        
        let output = std::process::Command::new("powershell")
            .args(["-Command", &ps_script])
            .output()
            .map_err(|e| format!("执行PowerShell失败: {}", e))?;
        
        if output.status.success() {
            info!("[快捷方式] 已创建: {}", shortcut_path.to_string_lossy());
            Ok(())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("创建快捷方式失败: {}", err))
        }
    }
    
    #[cfg(not(windows))]
    {
        Err("快捷方式功能仅支持Windows系统".to_string())
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod commands;
mod error;
mod utils;

use commands::file::*;
use commands::export::*;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, RunEvent};

/// 全局标记：应用是否已经完成初始化
static APP_INITIALIZED: AtomicBool = AtomicBool::new(false);

/// 检查命令行参数中是否有文件路径
fn get_file_path_from_args() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        Some(args[1].clone())
    } else {
        None
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 检测命令行参数
    let file_arg = get_file_path_from_args();
    let file_arg_for_setup = file_arg.clone();

    // 🟢 单一构建流程，避免 macOS Info.plist 重复定义
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        // 仅主实例注册 single-instance
        .plugin(if file_arg.is_none() {
            tauri_plugin_single_instance::init(|app_handle, argv, _cwd| {
                println!("[minidoc] 检测到已运行实例，argv: {:?}", argv);
                if argv.len() > 1 {
                    let path_str = argv[1].clone();
                    let app_handle = app_handle.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        app_handle.emit("file-opened-external", &path_str).ok();
                    });
                }
            })
        } else {
            // 子进程不注册 single-instance
            tauri::plugin::Builder::new("dummy").build()
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            read_file_lines,
            write_file,
            append_file,
            create_file,
            delete_file,
            rename_file,
            create_directory,
            list_files,
            read_directory,
            exists,
            get_metadata,
            is_directory,
            launch_new_instance,
            check_pandoc,
            export_to_word,
            save_temp_file,
            open_with_default_app,
            open_with_print,
        ])
        .setup(move |app| {
            APP_INITIALIZED.store(true, Ordering::Relaxed);
            println!("[minidoc] setup 完成，file_arg: {:?}", file_arg_for_setup);

            // 🟢 处理首次启动的文件参数
            if let Some(file_path) = &file_arg_for_setup {
                println!("[minidoc] 首次启动检测到文件参数：{}", file_path);
                let app_handle = app.handle().clone();
                let file_path_clone = file_path.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    println!("[minidoc] 发送 file-opened 事件");
                    app_handle.emit("file-opened", &file_path_clone).ok();
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {}
            tauri::WindowEvent::DragDrop(ref drop_event) => {
                let app_handle = window.app_handle();
                match *drop_event {
                    tauri::DragDropEvent::Drop { ref paths, .. } => {
                        println!("[minidoc] 拖拽放下，paths: {:?}", paths);
                        if let Some(first_path) = paths.first() {
                            let path_str: String = first_path.to_string_lossy().to_string();
                            app_handle.emit("drag-drop-opened", &path_str).ok();
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    // 🟢 运行阶段处理平台特定事件
    app.run(|app_handle, event| {
        // macOS: 处理系统文件关联打开
        #[cfg(target_os = "macos")]
        match event {
            RunEvent::Opened { urls } => {
                println!("[minidoc] macOS 文件打开事件，urls: {:?}", urls);
                if let Some(url) = urls.first() {
                    let path_str = url
                        .to_file_path()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|_| url.to_string());

                    let event_name = if APP_INITIALIZED.load(Ordering::Relaxed) {
                        "file-opened-external"
                    } else {
                        "file-opened"
                    };

                    let app_handle = app_handle.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(1));
                        app_handle.emit(event_name, &path_str).ok();
                    });
                }
            }
            RunEvent::Exit => println!("[minidoc] 退出"),
            _ => {}
        }

        // 非 macOS 平台
        #[cfg(not(target_os = "macos"))]
        match event {
            RunEvent::Exit => println!("[minidoc] 退出"),
            _ => {}
        }
    });
}
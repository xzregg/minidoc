// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod commands;
mod error;
mod utils;

use commands::file::*;
use commands::export::*;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, RunEvent};

// 🔴 全局标记：应用是否已经完成初始化（用于区分首次启动和已运行实例）
static APP_INITIALIZED: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 🔴 关键修改：检测是否是作为子进程启动（带命令行参数）
    let args: Vec<String> = std::env::args().collect();
    let is_launched_as_child = args.len() > 1;

    if is_launched_as_child {
        // 🔴 作为子进程启动，直接打开文件，不注册 single-instance
        println!("[minidoc] 作为子进程启动，argv: {:?}", args);
        let file_path = args[1].clone();

        let app = tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_shell::init())
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
            .on_window_event(|window, event| match event {
                // 🔴 子进程也支持拖拽文件/目录
                tauri::WindowEvent::DragDrop(ref drop_event) => {
                    let app_handle = window.app_handle();
                    match *drop_event {
                        tauri::DragDropEvent::Drop { ref paths, .. } => {
                            println!("[minidoc] 子进程：拖拽放下，paths: {:?}", paths);
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

        // 🔴 启动后发送事件打开文件
        app.run(move |app_handle, event| match event {
            RunEvent::Ready => {
                println!("[minidoc] 子进程：应用就绪，准备打开文件：{}", file_path);
                let app_handle = app_handle.clone();
                let file_path_clone = file_path.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    println!("[minidoc] 子进程：发送 file-opened 事件");
                    app_handle.emit("file-opened", &file_path_clone).ok();
                });
            }
            _ => {}
        });
    } else {
        // 🔴 主实例：注册 single-instance 插件
        let app = tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_single_instance::init(|app_handle, argv, _cwd| {
                println!("[minidoc] 检测到已运行的实例，argv: {:?}", argv);
                if argv.len() > 1 {
                    let path_str = argv[1].clone();
                    let app_handle = app_handle.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        app_handle.emit("file-opened-external", &path_str).ok();
                    });
                }
            }))
            .invoke_handler(tauri::generate_handler![
                // 文件操作命令
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
                // 导出命令
                check_pandoc,
                export_to_word,
                save_temp_file,
                open_with_default_app,
                open_with_print,
            ])
            .setup(|_app| {
                // 🔴 标记应用已准备完成
                APP_INITIALIZED.store(true, Ordering::Relaxed);
                println!("[minidoc] 主实例 setup 完成");
                Ok(())
            })
            .on_window_event(|window, event| match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    // 窗口关闭时的清理
                }
                // 处理拖拽放下事件：用户把文件/文件夹拖放到窗口
                tauri::WindowEvent::DragDrop(ref drop_event) => {
                    let app_handle = window.app_handle();
                    match *drop_event {
                        tauri::DragDropEvent::Drop { ref paths, .. } => {
                            println!("[minidoc] 拖拽放下，paths: {:?}", paths);
                            // 只处理第一个路径
                            if let Some(first_path) = paths.first() {
                                let path_str: String = first_path.to_string_lossy().to_string();
                                // 发送事件给前端处理
                                app_handle.emit("drag-drop-opened", &path_str).ok();
                            }
                        }
                        tauri::DragDropEvent::Enter { .. } => {
                            // 拖拽进入，可以不处理
                        }
                        tauri::DragDropEvent::Over { .. } => {
                            // 拖拽在上方，不处理
                        }
                        tauri::DragDropEvent::Leave => {
                            // 拖拽离开，不处理
                        }
                        _ => {}
                    }
                }
                _ => {}
            })
            .build(tauri::generate_context!())
            .expect("error while running tauri application");

        // 🔴 运行应用并处理全局事件（包括 macOS 文件打开）
        app.run(|app_handle, event| match event {
            RunEvent::Opened { urls } => {
                println!("[minidoc] macOS 文件打开事件，urls: {:?}", urls);
                // 只处理第一个文件
                if let Some(url) = urls.first() {
                    // 🔴 关键：将 file:// URL 转换为真实路径
                    let path_str = url
                        .to_file_path()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|_| url.to_string());
                    println!("[minidoc] 打开文件：{}", path_str);

                    // 🔴 关键修复：根据应用是否已初始化来区分首次启动和已运行实例
                    let is_initialized = APP_INITIALIZED.load(Ordering::Relaxed);
                    let event_name = if is_initialized {
                        // 应用已运行，发送外部事件（可能弹对话框）
                        println!("[minidoc] 应用已运行，发送 file-opened-external");
                        "file-opened-external"
                    } else {
                        // 首次启动，直接打开文件
                        println!("[minidoc] 首次启动，发送 file-opened");
                        "file-opened"
                    };

                    let app_handle = app_handle.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(1));
                        app_handle.emit(event_name, &path_str).ok();
                    });
                }
            }
            RunEvent::Exit => {
                println!("[minidoc] 主实例退出");
            }
            _ => {}
        });
    }
}

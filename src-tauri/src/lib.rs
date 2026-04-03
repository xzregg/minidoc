// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod commands;
mod error;
mod utils;

use commands::file::*;
use commands::export::*;
use tauri::{Emitter, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            // 导出命令
            check_pandoc,
            export_to_word,
            save_temp_file,
            open_with_default_app,
            open_with_print,
        ])
        .setup(|app| {
            // 获取命令行参数（双击打开文件时）
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = args[1].clone();
                // 延迟发送事件，等待前端准备好
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    app_handle.emit("file-opened", &file_path).ok();
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // 窗口关闭时的清理
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

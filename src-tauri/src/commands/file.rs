//! 文件系统操作命令
//!
//! 提供文件和目录的读写、列表等操作

use crate::error::{FileInfo, FileError};
use crate::utils::{get_file_name, join_paths, to_absolute};
use std::fs;
use std::io::{BufReader, BufRead, Write};
use std::path::Path;
use std::process::Command;
use base64::{Engine as _, engine::general_purpose};

/// 隐藏文件和系统目录过滤列表
const IGNORED_PATTERNS: &[&str] = &[
    ".DS_Store",
    "Thumbs.db",
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    "target",
    ".idea",
    ".vscode",
    "dist",
    "build",
];

/// 检查文件名是否应该被忽略
fn should_ignore(name: &str) -> bool {
    // 检查隐藏文件（以 . 开头，但排除 .gitignore 等常见配置文件）
    if name.starts_with('.') && !matches!(name, ".gitignore" | ".env" | ".editorconfig" | ".gitattributes" | ".prettierrc" | ".prettierrc.*" | ".eslintrc" | ".eslintrc.*") {
        return true;
    }

    // 检查系统目录和常见忽略目录
    IGNORED_PATTERNS.iter().any(|pattern| {
        if pattern.ends_with('*') {
            let prefix = &pattern[..pattern.len()-1];
            name.starts_with(prefix)
        } else {
            name == *pattern
        }
    })
}

/// 启动新的应用实例并打开文件
///
/// 使用命令行参数启动新的 minidoc-app 进程
#[tauri::command]
pub async fn launch_new_instance(path: String) -> Result<(), String> {
    use std::process::Command;
    use std::env::current_exe;

    let exe_path = current_exe().map_err(|e| format!("获取应用路径失败：{}", e))?;

    // 🔴 启动新进程，传入文件路径作为参数
    Command::new(exe_path)
        .arg(&path)
        .spawn()
        .map_err(|e| format!("启动新实例失败：{}", e))?;

    Ok(())
}

/// 读取文件内容
///
/// 支持大文件流式读取，自动处理 UTF-8 编码
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    eprintln!("[MiniDoc] read_file called with path: {}", path);

    let absolute_path = to_absolute(&path)
        .map_err(|e| {
            eprintln!("[MiniDoc] to_absolute failed: {}", e);
            FileError::Other(e)
        })?;

    eprintln!("[MiniDoc] absolute_path: {}", absolute_path);

    let path_obj = Path::new(&absolute_path);

    // 检查文件是否存在
    if !path_obj.exists() {
        let error = FileError::NotFound(path.clone());
        eprintln!("[MiniDoc] File not found: {}", path);
        return Err(error.to_string());
    }

    // 检查是否为目录
    if path_obj.is_dir() {
        let error = FileError::Other(format!("无法读取目录作为文件: {}", path));
        eprintln!("[MiniDoc] Path is a directory: {}", path);
        return Err(error.to_string());
    }

    // 获取文件元数据
    let metadata = fs::metadata(&absolute_path)
        .map_err(FileError::from)?;

    // 检查文件大小（警告超过 10MB 的文件）
    const LARGE_FILE_THRESHOLD: u64 = 10 * 1024 * 1024; // 10MB
    if metadata.len() > LARGE_FILE_THRESHOLD {
        eprintln!("[MiniDoc] Warning: Reading large file ({} bytes)", metadata.len());
    }

    // 尝试直接读取为 UTF-8 字符串
    let result = fs::read_to_string(&absolute_path);

    match result {
        Ok(content) => {
            eprintln!("[MiniDoc] Successfully read {} bytes from {}", content.len(), path);
            Ok(content)
        }
        Err(e) => {
            eprintln!("[MiniDoc] Failed to read file as UTF-8: {}", e);

            // 尝试以二进制方式读取，然后进行编码转换
            let bytes = fs::read(&absolute_path)
                .map_err(FileError::from)?;

            // 尝试 UTF-8（忽略无效字符）
            let content = String::from_utf8_lossy(&bytes);
            eprintln!("[MiniDoc] Read with lossy UTF-8 conversion");
            Ok(content.to_string())
        }
    }
}

/// 流式读取大文件（按行读取）
///
/// 返回文件内容，支持大文件处理
#[tauri::command]
pub async fn read_file_lines(path: String, max_lines: Option<usize>) -> Result<Vec<String>, String> {
    eprintln!("[MiniDoc] read_file_lines called with path: {}, max_lines: {:?}", path, max_lines);

    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e))?;

    let file = fs::File::open(&absolute_path)
        .map_err(FileError::from)?;

    let reader = BufReader::new(file);
    let mut lines = Vec::new();

    let limit = max_lines.unwrap_or(usize::MAX);

    for (index, line) in reader.lines().enumerate() {
        if index >= limit {
            break;
        }
        let line = line.map_err(FileError::from)?;
        lines.push(line);
    }

    eprintln!("[MiniDoc] Read {} lines from {}", lines.len(), path);
    Ok(lines)
}

/// 写入文件内容（原子写入）
///
/// 使用临时文件 + 重命名的方式确保原子性
/// 防止写入过程中断导致文件损坏
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    eprintln!("[MiniDoc] write_file called with path: {}, content length: {}", path, content.len());

    let absolute_path = to_absolute(&path)
        .map_err(|e| {
            eprintln!("[MiniDoc] to_absolute failed: {}", e);
            FileError::Other(e)
        })?;

    eprintln!("[MiniDoc] absolute_path: {}", absolute_path);

    let path_obj = Path::new(&absolute_path);

    // 确保父目录存在
    if let Some(parent) = path_obj.parent() {
        if !parent.exists() {
            eprintln!("[MiniDoc] Creating parent directory: {:?}", parent);
            fs::create_dir_all(parent)
                .map_err(|e| {
                    eprintln!("[MiniDoc] Failed to create parent directory: {}", e);
                    FileError::from(e)
                })?;
        }
    }

    // 使用原子写入：先写入临时文件，然后重命名
    let temp_path = absolute_path.clone() + ".tmp";

    eprintln!("[MiniDoc] Writing to temp file: {}", temp_path);

    // 写入临时文件
    {
        let mut file = fs::File::create(&temp_path)
            .map_err(|e| {
                eprintln!("[MiniDoc] Failed to create temp file: {}", e);
                FileError::from(e)
            })?;

        file.write_all(content.as_bytes())
            .map_err(|e| {
                eprintln!("[MiniDoc] Failed to write content: {}", e);
                FileError::from(e)
            })?;

        file.flush()
            .map_err(|e| {
                eprintln!("[MiniDoc] Failed to flush temp file: {}", e);
                FileError::from(e)
            })?;
    }

    eprintln!("[MiniDoc] Temp file written successfully, renaming to: {}", absolute_path);

    // 原子性地重命名临时文件到目标文件
    fs::rename(&temp_path, &absolute_path)
        .map_err(|e| {
            eprintln!("[MiniDoc] Failed to rename temp file: {}", e);
            // 尝试清理临时文件
            let _ = fs::remove_file(&temp_path);
            FileError::from(e)
        })?;

    eprintln!("[MiniDoc] File written successfully: {}", path);
    Ok(())
}

/// 写入二进制文件（从 base64 编码）
///
/// 用于导出图片等二进制内容
#[tauri::command]
pub async fn write_binary_file(path: String, content: String) -> Result<(), String> {
    eprintln!("[MiniDoc] write_binary_file called with path: {}, content length: {}", path, content.len());

    let absolute_path = to_absolute(&path)
        .map_err(|e| {
            eprintln!("[MiniDoc] to_absolute failed: {}", e);
            FileError::Other(e)
        })?;

    let path_obj = Path::new(&absolute_path);

    // 确保父目录存在
    if let Some(parent) = path_obj.parent() {
        if !parent.exists() {
            eprintln!("[MiniDoc] Creating parent directory: {:?}", parent);
            fs::create_dir_all(parent)
                .map_err(|e| {
                    eprintln!("[MiniDoc] Failed to create parent directory: {}", e);
                    FileError::from(e)
                })?;
        }
    }

    // 解码 base64
    let binary_data = general_purpose::STANDARD
        .decode(&content)
        .map_err(|e| {
            eprintln!("[MiniDoc] Failed to decode base64: {}", e);
            FileError::Other(format!("Base64 解码失败: {}", e))
        })?;

    eprintln!("[MiniDoc] Decoded {} bytes from base64", binary_data.len());

    // 直接写入二进制数据
    fs::write(&absolute_path, &binary_data)
        .map_err(|e| {
            eprintln!("[MiniDoc] Failed to write binary file: {}", e);
            FileError::from(e)
        })?;

    eprintln!("[MiniDoc] Binary file written successfully: {}", path);
    Ok(())
}

/// 追加内容到文件
#[tauri::command]
pub async fn append_file(path: String, content: String) -> Result<(), String> {
    eprintln!("[MiniDoc] append_file called with path: {}", path);

    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e))?;

    let mut file = fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(&absolute_path)
        .map_err(FileError::from)?;

    file.write_all(content.as_bytes())
        .map_err(FileError::from)?;

    file.flush()
        .map_err(FileError::from)?;

    eprintln!("[MiniDoc] Content appended successfully to: {}", path);
    Ok(())
}

/// 创建新文件
#[tauri::command]
pub async fn create_file(path: String) -> Result<(), String> {
    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e))?;

    // 检查文件是否已存在
    if Path::new(&absolute_path).exists() {
        return Err(FileError::Other(format!("文件已存在: {}", path)).to_string());
    }

    // 确保父目录存在
    if let Some(parent) = Path::new(&absolute_path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(FileError::from)?;
        }
    }

    // 创建空文件
    fs::File::create(&absolute_path)
        .map_err(FileError::from)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// 删除文件或目录
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e))?;

    let path_obj = Path::new(&absolute_path);

    if !path_obj.exists() {
        return Err(FileError::NotFound(path).to_string());
    }

    if path_obj.is_dir() {
        fs::remove_dir_all(&absolute_path)
            .map_err(FileError::from)
            .map_err(|e| e.to_string())
    } else {
        fs::remove_file(&absolute_path)
            .map_err(FileError::from)
            .map_err(|e| e.to_string())
    }
}

/// 🔴 移动文件/目录到回收站（跨平台）
#[tauri::command]
pub async fn trash_file(path: String) -> Result<(), String> {
    eprintln!("[MiniDoc] trash_file called with path: {}", path);

    let absolute_path = to_absolute(&path)
        .map_err(|e| {
            eprintln!("[MiniDoc] to_absolute failed: {}", e);
            FileError::Other(e)
        })?;

    eprintln!("[MiniDoc] absolute_path: {}", absolute_path);

    let path_obj = Path::new(&absolute_path);

    if !path_obj.exists() {
        return Err(FileError::NotFound(path).to_string());
    }

    // 使用 trash crate 移动到回收站
    trash::delete(&absolute_path)
        .map_err(|e| {
            eprintln!("[MiniDoc] trash failed: {}", e);
            format!("移动到回收站失败: {}", e)
        })?;

    eprintln!("[MiniDoc] Successfully moved to trash: {}", absolute_path);
    Ok(())
}

/// 重命名文件或目录
#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    eprintln!("[MiniDoc] rename_file called: {} -> {}", old_path, new_path);

    let absolute_old = to_absolute(&old_path)
        .map_err(|e| {
            eprintln!("[MiniDoc] to_absolute failed for old_path: {}", e);
            FileError::Other(e)
        })?;

    let absolute_new = to_absolute(&new_path)
        .map_err(|e| {
            eprintln!("[MiniDoc] to_absolute failed for new_path: {}", e);
            FileError::Other(e)
        })?;

    let old_path_obj = Path::new(&absolute_old);
    let new_path_obj = Path::new(&absolute_new);

    // 检查源文件/目录是否存在
    if !old_path_obj.exists() {
        eprintln!("[MiniDoc] Source path does not exist: {}", old_path);
        return Err(FileError::NotFound(old_path).to_string());
    }

    // 🔴 修复：检查目标路径是否已存在
    // 如果新旧路径相同（macOS 不区分大小写），允许重命名
    if new_path_obj.exists() {
        // 尝试获取 canonicalize 后的路径来比较
        let old_canonical = old_path_obj.canonicalize().ok();
        let new_canonical = new_path_obj.canonicalize().ok();

        // 如果两个路径的 canonicalize 结果相同，说明是同一个文件（大小写不同）
        if old_canonical.is_some() && new_canonical.is_some() && old_canonical == new_canonical {
            eprintln!("[MiniDoc] Same file with different case, allowing rename");
            // 继续执行重命名
        } else {
            eprintln!("[MiniDoc] Target path already exists: {}", new_path);
            return Err(FileError::Other(format!("目标路径已存在: {}", new_path)).to_string());
        }
    }

    // 确保目标父目录存在
    if let Some(parent) = new_path_obj.parent() {
        if !parent.exists() {
            eprintln!("[MiniDoc] Creating parent directory: {:?}", parent);
            fs::create_dir_all(parent)
                .map_err(|e| {
                    eprintln!("[MiniDoc] Failed to create parent directory: {}", e);
                    FileError::from(e)
                })?;
        }
    }

    // 执行重命名
    fs::rename(&absolute_old, &absolute_new)
        .map_err(|e| {
            eprintln!("[MiniDoc] Failed to rename: {}", e);
            FileError::from(e)
        })
        .map_err(|e| e.to_string())?;

    eprintln!("[MiniDoc] Successfully renamed: {} -> {}", old_path, new_path);
    Ok(())
}

/// 创建目录
#[tauri::command]
pub async fn create_directory(path: String) -> Result<(), String> {
    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e))?;

    fs::create_dir_all(&absolute_path)
        .map_err(FileError::from)
        .map_err(|e| e.to_string())
}

/// 列出目录中的文件和子目录（递归）
///
/// 注意：此命令会递归读取整个目录树，对于大型目录可能较慢
/// 建议使用 read_directory 获取扁平列表，然后按需展开子目录
#[tauri::command]
pub async fn list_files(dir: String) -> Result<Vec<FileInfo>, String> {
    eprintln!("[MiniDoc] list_files called with dir: {}", dir);
    let absolute_path = to_absolute(&dir)
        .map_err(|e| FileError::Other(e))?;

    eprintln!("[MiniDoc] absolute_path: {}", absolute_path);
    let path_obj = Path::new(&absolute_path);

    if !path_obj.exists() {
        return Err(FileError::NotFound(dir).to_string());
    }

    if !path_obj.is_dir() {
        return Err(FileError::Other(format!("不是目录: {}", dir)).to_string());
    }

    let result = scan_directory_recursive(&absolute_path, &dir, true, false);
    eprintln!("[MiniDoc] list_files returning {} items", result.as_ref().map(|v| v.len()).unwrap_or(0));
    result
}

/// 读取目录内容（支持递归和非递归模式）
///
/// 这是 list_files 的增强版本，提供更灵活的选项
#[tauri::command]
pub async fn read_directory(path: String, recursive: Option<bool>, include_hidden: Option<bool>) -> Result<Vec<FileInfo>, String> {
    eprintln!("[MiniDoc] read_directory called with path: {}, recursive: {:?}, include_hidden: {:?}",
        path, recursive, include_hidden);

    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e))?;

    eprintln!("[MiniDoc] absolute_path: {}", absolute_path);

    let path_obj = Path::new(&absolute_path);

    // 验证路径
    if !path_obj.exists() {
        eprintln!("[MiniDoc] Path does not exist: {}", path);
        return Err(FileError::NotFound(path).to_string());
    }

    if !path_obj.is_dir() {
        eprintln!("[MiniDoc] Path is not a directory: {}", path);
        return Err(FileError::Other(format!("路径不是目录: {}", path)).to_string());
    }

    let is_recursive = recursive.unwrap_or(true);
    let show_hidden = include_hidden.unwrap_or(false);

    eprintln!("[MiniDoc] Scanning directory: recursive={}, show_hidden={}", is_recursive, show_hidden);

    let result = scan_directory_recursive(&absolute_path, &path, is_recursive, show_hidden);

    match &result {
        Ok(files) => eprintln!("[MiniDoc] Successfully scanned {} items", files.len()),
        Err(e) => eprintln!("[MiniDoc] Failed to scan directory: {}", e),
    }

    result
}

/// 递归扫描目录，构建文件树
///
/// 参数:
/// - absolute_path: 目录的绝对路径
/// - display_path: 用于显示的相对路径
/// - recursive: 是否递归扫描子目录
/// - show_hidden: 是否显示隐藏文件和系统目录
fn scan_directory_recursive(
    absolute_path: &str,
    display_path: &str,
    recursive: bool,
    show_hidden: bool,
) -> Result<Vec<FileInfo>, String> {
    let path_obj = Path::new(absolute_path);
    let mut files = Vec::new();

    let entries = fs::read_dir(path_obj)
        .map_err(|e| {
            eprintln!("[MiniDoc] Failed to read directory {}: {}", absolute_path, e);
            FileError::from(e)
        })?;

    for entry in entries {
        let entry = entry.map_err(|e| {
            eprintln!("[MiniDoc] Failed to read directory entry: {}", e);
            FileError::from(e)
        })?;

        let entry_name = entry.file_name()
            .to_str()
            .ok_or_else(|| {
                eprintln!("[MiniDoc] File name contains invalid characters");
                FileError::Other("文件名包含无效字符".to_string())
            })?
            .to_string();

        // 过滤隐藏文件和系统目录
        if !show_hidden && should_ignore(&entry_name) {
            eprintln!("[MiniDoc] Ignoring: {}", entry_name);
            continue;
        }

        let entry_display_path = join_paths(display_path, &entry_name);
        let entry_absolute = entry.path();
        let entry_absolute_path = entry_absolute
            .to_str()
            .ok_or_else(|| FileError::Other("路径包含无效字符".to_string()))?
            .to_string();

        // 获取文件元数据
        let metadata = entry.metadata()
            .map_err(FileError::from)?;

        let is_dir = metadata.is_dir();
        let size = metadata.len();

        // 获取修改时间
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        let file_info = if is_dir && recursive {
            // 递归处理子目录
            let children = scan_directory_recursive(
                &entry_absolute_path,
                &entry_display_path,
                recursive,
                show_hidden
            )?;

            FileInfo {
                name: entry_name.clone(),
                path: entry_absolute_path.clone(),
                is_dir: true,
                size,
                modified,
                children: Some(children),
            }
        } else if is_dir {
            // 非递归模式，目录不展开子项
            FileInfo {
                name: entry_name.clone(),
                path: entry_absolute_path.clone(),
                is_dir: true,
                size,
                modified,
                children: Some(Vec::new()), // 空数组表示可展开但未展开
            }
        } else {
            FileInfo {
                name: entry_name.clone(),
                path: entry_absolute_path.clone(),
                is_dir: false,
                size,
                modified,
                children: None,
            }
        };

        files.push(file_info);
    }

    // 按名称排序，目录在前
    files.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(files)
}


/// 检查文件或目录是否存在
#[tauri::command]
pub async fn exists(path: String) -> Result<bool, String> {
    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e))?;

    Ok(Path::new(&absolute_path).exists())
}

/// 获取文件元数据
#[tauri::command]
pub async fn get_metadata(path: String) -> Result<FileInfo, String> {
    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e))?;

    let path_obj = Path::new(&absolute_path);

    if !path_obj.exists() {
        return Err(FileError::NotFound(path).to_string());
    }

    let metadata = fs::metadata(&absolute_path)
        .map_err(FileError::from)?;

    let is_dir = metadata.is_dir();
    let size = metadata.len();
    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    Ok(FileInfo {
        name: get_file_name(&path),
        path,
        is_dir,
        size,
        modified,
        children: None,
    })
}

/// 检查路径是否为目录
///
/// 返回 true 如果路径存在且是目录，false 如果是文件或不存在
#[tauri::command]
pub async fn is_directory(path: String) -> Result<bool, String> {
    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e).to_string())?;

    let path_obj = Path::new(&absolute_path);

    if !path_obj.exists() {
        return Ok(false);
    }

    Ok(path_obj.is_dir())
}

/// 获取文件的最后修改时间（秒级 Unix 时间戳）
#[tauri::command]
pub async fn get_file_mtime(path: String) -> Result<i64, String> {
    let absolute_path = to_absolute(&path)
        .map_err(|e| FileError::Other(e).to_string())?;

    let path_obj = Path::new(&absolute_path);
    if !path_obj.exists() {
        return Err(FileError::NotFound(path).to_string());
    }

    let metadata = fs::metadata(&absolute_path)
        .map_err(|e| format!("获取文件元数据失败: {}", e))?;

    let mtime = metadata
        .modified()
        .map_err(|e| format!("获取修改时间失败: {}", e))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("时间计算失败: {}", e))?
        .as_secs();

    Ok(mtime as i64)
}

/// 🔴 用系统默认浏览器打开 HTML 文件（用于 PDF 导出）
///
/// macOS: open 命令
/// Linux: xdg-open
/// Windows: start
#[tauri::command]
pub async fn open_in_browser(path: String) -> Result<(), String> {
    eprintln!("[MiniDoc] open_in_browser called with path: {}", path);

    let absolute_path = to_absolute(&path)
        .map_err(|e| {
            eprintln!("[MiniDoc] to_absolute failed: {}", e);
            FileError::Other(e)
        })?;

    eprintln!("[MiniDoc] absolute_path: {}", absolute_path);

    // 检测操作系统并选择对应的打开命令
    #[cfg(target_os = "macos")]
    let result = Command::new("open")
        .arg(&absolute_path)
        .spawn();

    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open")
        .arg(&absolute_path)
        .spawn();

    #[cfg(target_os = "windows")]
    let result = Command::new("cmd")
        .args(["/C", "start", &absolute_path])
        .spawn();

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    let result = {
        eprintln!("[MiniDoc] Unsupported OS");
        return Err("不支持的操作系统".to_string());
    };

    match result {
        Ok(_) => {
            eprintln!("[MiniDoc] Successfully opened file in browser");
            Ok(())
        }
        Err(e) => {
            eprintln!("[MiniDoc] Failed to open file: {}", e);
            Err(format!("无法打开文件: {}", e))
        }
    }
}

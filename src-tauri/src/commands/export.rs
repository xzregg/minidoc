/**
 * 导出功能命令
 * 提供 Word 导出等需要后端支持的功能
 */

use std::fs;
use std::process::Command;

/// 检查系统是否安装了 Pandoc
#[tauri::command]
pub fn check_pandoc() -> Result<bool, String> {
    let result = Command::new("pandoc")
        .arg("--version")
        .output();

    Ok(result.is_ok())
}

/// 使用 Pandoc 导出为 Word 文档
#[tauri::command]
pub async fn export_to_word(
    html: String,
    path: String,
) -> Result<(), String> {
    // 检查 Pandoc 是否可用
    let pandoc_check = Command::new("pandoc")
        .arg("--version")
        .output();

    if pandoc_check.is_err() {
        return Err("Pandoc 未安装。请安装 Pandoc 后重试，或使用前端导出方案。".to_string());
    }

    // 创建临时 HTML 文件
    let temp_dir = std::env::temp_dir();
    let temp_html = temp_dir.join("minidoc_export_temp.html");

    fs::write(&temp_html, html)
        .map_err(|e| format!("无法创建临时文件: {}", e))?;

    // 确保输出路径有 .docx 扩展名
    let output_path = if path.ends_with(".docx") {
        path.clone()
    } else {
        format!("{}.docx", path)
    };

    // 调用 Pandoc 转换
    let output = Command::new("pandoc")
        .arg("-f")
        .arg("html")
        .arg("-t")
        .arg("docx")
        .arg("-o")
        .arg(&output_path)
        .arg(&temp_html)
        .output()
        .map_err(|e| format!("Pandoc 执行失败: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        let _ = fs::remove_file(&temp_html);
        return Err(format!("Pandoc 转换失败: {}", error_msg));
    }

    // 清理临时文件
    let _ = fs::remove_file(&temp_html);

    Ok(())
}

/// 保存临时文件（用于预览等场景）
#[tauri::command]
pub async fn save_temp_file(
    content: String,
    extension: String,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    // 使用随机数生成唯一文件名
    let random_id: u64 = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64;
    let filename = format!("minidoc_temp_{}.{}",
        random_id,
        extension.trim_start_matches('.')
    );
    let temp_path = temp_dir.join(&filename);

    fs::write(&temp_path, content)
        .map_err(|e| format!("无法创建临时文件: {}", e))?;

    Ok(temp_path.to_string_lossy().to_string())
}

/// 使用系统默认应用打开文件
#[tauri::command]
pub async fn open_with_default_app(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("无法打开文件: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件: {}", e))?;
    }

    Ok(())
}

/// 打开文件并显示打印对话框（macOS）
#[tauri::command]
pub async fn open_with_print(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("lp")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打印文件: {}", e))?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        // 其他平台使用默认应用打开
        open_with_default_app(path).await?;
    }

    Ok(())
}

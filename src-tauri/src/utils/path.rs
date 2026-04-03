//! 路径处理工具模块
//!
//! 跨平台路径处理工具函数

use std::path::Path;

/// 规范化路径，将路径分隔符转换为当前平台标准
pub fn normalize_path(path: &str) -> String {
    // 替换 Windows 风格的分隔符
    let normalized = path.replace('\\', "/");
    // 处理连续的分隔符
    let parts: Vec<&str> = normalized.split('/')
        .filter(|s| !s.is_empty())
        .collect();

    if parts.is_empty() {
        return "/".to_string();
    }

    // 判断是否为绝对路径
    let is_absolute = path.starts_with('/') || path.contains(':');

    let result = parts.join("/");
    if is_absolute {
        if let Some(drive) = path.chars().next() {
            if drive.is_ascii_uppercase() && path.len() > 1 && path.chars().nth(1) == Some(':') {
                // Windows 驱动器路径，如 C:/
                return format!("{}:/{}", drive, result);
            }
        }
        format!("/{}", result)
    } else {
        result
    }
}

/// 获取路径的文件名
pub fn get_file_name(path: &str) -> String {
    let normalized = normalize_path(path);
    let path = Path::new(&normalized);
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string()
}

/// 获取路径的父目录
pub fn get_parent_dir(path: &str) -> Option<String> {
    let normalized = normalize_path(path);
    let path = Path::new(&normalized);
    path.parent()
        .and_then(|p| p.to_str())
        .map(|s| s.to_string())
}

/// 获取路径的扩展名
pub fn get_extension(path: &str) -> Option<String> {
    let normalized = normalize_path(path);
    let path = Path::new(&normalized);
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_string())
}

/// 拼接路径
pub fn join_paths(base: &str, relative: &str) -> String {
    let base_normalized = normalize_path(base);
    let relative_normalized = normalize_path(relative);

    let base_path = Path::new(&base_normalized);
    let relative_path = Path::new(&relative_normalized);

    base_path
        .join(relative_path)
        .to_str()
        .unwrap_or(&base_normalized)
        .to_string()
}

/// 检查路径是否为绝对路径
pub fn is_absolute(path: &str) -> bool {
    // Unix 风格绝对路径
    if path.starts_with('/') {
        return true;
    }
    // Windows 风格绝对路径
    if path.len() >= 2 {
        let chars: Vec<char> = path.chars().collect();
        if chars[0].is_ascii_uppercase() && chars[1] == ':' {
            return true;
        }
    }
    false
}

/// 将相对路径转换为绝对路径
/// 对于 "." 特殊处理，返回项目根目录 (src-tauri 的父目录)
pub fn to_absolute(path: &str) -> Result<String, String> {
    if is_absolute(path) {
        return Ok(normalize_path(path));
    }

    // 获取当前工作目录（src-tauri 目录）
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("无法获取当前目录：{}", e))?;

    // 如果路径是 "." 或 "./"，返回项目根目录（src-tauri 的父目录）
    if path == "." || path == "./" {
        let project_root = current_dir.parent()
            .ok_or_else(|| "无法获取项目根目录".to_string())?;
        return Ok(normalize_path(&project_root.to_string_lossy()));
    }

    let absolute = current_dir.join(path);
    absolute
        .canonicalize()
        .map_err(|e| format!("无法解析路径：{}", e))?
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "路径包含无效字符".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path("foo/bar"), "foo/bar");
        assert_eq!(normalize_path("foo\\bar"), "foo/bar");
        assert_eq!(normalize_path("/foo/bar"), "/foo/bar");
    }

    #[test]
    fn test_get_file_name() {
        assert_eq!(get_file_name("/path/to/file.txt"), "file.txt");
        assert_eq!(get_file_name("file.txt"), "file.txt");
    }

    #[test]
    fn test_get_extension() {
        assert_eq!(get_extension("file.txt"), Some("txt".to_string()));
        assert_eq!(get_extension("file"), None);
    }
}

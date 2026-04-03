//! 错误处理模块
//!
//! 统一的错误类型定义，用于所有 Tauri 命令

use std::fmt;

/// 文件操作错误类型
#[derive(Debug, Clone)]
pub enum FileError {
    /// 文件不存在
    NotFound(String),
    /// 权限被拒绝
    PermissionDenied(String),
    /// IO 错误
    Io(String),
    /// 路径无效
    InvalidPath(String),
    /// 其他错误
    Other(String),
}

impl fmt::Display for FileError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FileError::NotFound(msg) => write!(f, "文件不存在: {}", msg),
            FileError::PermissionDenied(msg) => write!(f, "权限被拒绝: {}", msg),
            FileError::Io(msg) => write!(f, "IO 错误: {}", msg),
            FileError::InvalidPath(msg) => write!(f, "无效路径: {}", msg),
            FileError::Other(msg) => write!(f, "错误: {}", msg),
        }
    }
}

impl From<std::io::Error> for FileError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => FileError::NotFound(err.to_string()),
            std::io::ErrorKind::PermissionDenied => FileError::PermissionDenied(err.to_string()),
            _ => FileError::Io(err.to_string()),
        }
    }
}

impl From<FileError> for String {
    fn from(err: FileError) -> Self {
        err.to_string()
    }
}

/// 文件信息结构
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileInfo {
    /// 文件名
    pub name: String,
    /// 完整路径
    pub path: String,
    /// 是否为目录
    pub is_dir: bool,
    /// 文件大小（字节）
    pub size: u64,
    /// 最后修改时间
    pub modified: Option<u64>,
    /// 子文件（仅目录有效）
    pub children: Option<Vec<FileInfo>>,
}

/// 将 FileError 转换为 String 的辅助函数
pub fn into_string<E: Into<FileError>>(err: E) -> String {
    err.into().to_string()
}

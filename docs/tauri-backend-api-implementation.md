# Tauri 后端 API 实现文档

**日期：** 2026-04-01
**模块：** 模块 1 - Tauri 后端 API 实现
**负责人：** 全栈开发（Rust）

---

## 实现概述

本次任务完成了 MiniDoc 编辑器所需的核心文件系统后端 API，包括文件读写、目录扫描等功能。

---

## 实现的命令

### 1. `read_file` - 读取文件内容

**功能：**
- 支持文本文件读取
- 自动处理 UTF-8 编码问题
- 大文件警告（超过 10MB）
- 详细的错误日志

**签名：**
```rust
pub async fn read_file(path: String) -> Result<String, String>
```

**实现细节：**
- 使用 `fs::read_to_string` 优先读取 UTF-8 内容
- 失败时回退到二进制读取 + `String::from_utf8_lossy` 转换
- 验证文件存在性和类型
- 记录所有关键步骤的日志

---

### 2. `read_file_lines` - 流式读取大文件

**功能：**
- 按行读取大文件
- 支持限制读取行数
- 内存友好

**签名：**
```rust
pub async fn read_file_lines(path: String, max_lines: Option<usize>) -> Result<Vec<String>, String>
```

**使用场景：**
- 预览大文件前 N 行
- 日志文件分析
- 分页加载文件内容

---

### 3. `write_file` - 原子写入文件

**功能：**
- 原子性写入（临时文件 + 重命名）
- 自动创建父目录
- 写入失败自动清理临时文件
- 详细的错误日志

**签名：**
```rust
pub async fn write_file(path: String, content: String) -> Result<(), String>
```

**实现细节：**
1. 创建 `.tmp` 临时文件
2. 写入内容并刷新缓冲区
3. 原子性重命名到目标路径
4. 失败时清理临时文件

---

### 4. `append_file` - 追加内容到文件

**功能：**
- 追加内容到文件末尾
- 文件不存在时自动创建

**签名：**
```rust
pub async fn append_file(path: String, content: String) -> Result<(), String>
```

---

### 5. `read_directory` - 读取目录结构

**功能：**
- 递归或非递归扫描目录
- 支持显示/隐藏隐藏文件
- 自动过滤系统目录
- 返回完整文件树 JSON

**签名：**
```rust
pub async fn read_directory(
    path: String,
    recursive: Option<bool>,
    include_hidden: Option<bool>
) -> Result<Vec<FileInfo>, String>
```

**参数：**
- `path`: 目录路径
- `recursive`: 是否递归（默认 true）
- `include_hidden`: 是否显示隐藏文件（默认 false）

**过滤规则：**
- 隐藏文件（以 `.` 开头）默认过滤
- 系统目录：`.git`, `.svn`, `node_modules`, `target` 等
- 例外：`.gitignore`, `.env`, `.editorconfig` 等配置文件

---

### 6. `list_files` - 向后兼容的目录列表

**功能：**
- 保持与前端现有代码兼容
- 默认递归扫描，不显示隐藏文件

**签名：**
```rust
pub async fn list_files(dir: String) -> Result<Vec<FileInfo>, String>
```

---

## 数据结构

### `FileInfo` - 文件信息结构

```rust
pub struct FileInfo {
    /// 文件名
    pub name: String,
    /// 完整路径（绝对路径）
    pub path: String,
    /// 是否为目录
    pub is_dir: bool,
    /// 文件大小（字节）
    pub size: u64,
    /// 最后修改时间（Unix 时间戳）
    pub modified: Option<u64>,
    /// 子文件（仅目录有效）
    pub children: Option<Vec<FileInfo>>,
}
```

---

## 错误处理

所有命令使用统一的错误类型 `FileError`：

```rust
pub enum FileError {
    NotFound(String),
    PermissionDenied(String),
    Io(String),
    InvalidPath(String),
    Other(String),
}
```

错误处理策略：
1. 路径解析错误 → 返回 `InvalidPath`
2. 文件不存在 → 返回 `NotFound`
3. 权限问题 → 返回 `PermissionDenied`
4. 其他 IO 错误 → 返回 `Io` 或 `Other`

所有错误都会记录到标准错误输出，便于调试。

---

## 日志系统

所有命令使用统一的日志格式：

```
[MiniDoc] <command_name> <message>
```

日志级别：
- 调用开始：记录参数
- 关键步骤：记录进度
- 错误情况：记录详细错误信息
- 成功完成：记录结果摘要

---

## 权限配置

`src-tauri/capabilities/default.json` 已包含所需权限：

```json
{
  "permissions": [
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-read-dir",
    "fs:allow-exists",
    "fs:allow-stat",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-rename",
    "fs:allow-copy-file",
    "fs:allow-app-read",
    "fs:allow-app-write",
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

---

## 注册的命令

在 `src-tauri/src/lib.rs` 中注册的命令：

```rust
invoke_handler(tauri::generate_handler![
    // 文件操作
    read_file,
    read_file_lines,
    write_file,
    append_file,
    create_file,
    delete_file,
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
```

---

## 前端调用示例

### 读取文件

```typescript
import { invoke } from '@tauri-apps/api/core';

const content = await invoke<string>('read_file', {
  path: '/path/to/file.md'
});
```

### 写入文件

```typescript
await invoke('write_file', {
  path: '/path/to/file.md',
  content: '# Hello World\n'
});
```

### 读取目录

```typescript
const tree = await invoke<FileInfo[]>('read_directory', {
  path: '/path/to/directory',
  recursive: true,
  includeHidden: false
});
```

---

## 性能考虑

1. **大文件处理**：
   - `read_file_lines` 用于大文件流式读取
   - 超过 10MB 文件会记录警告

2. **目录扫描**：
   - `read_directory` 支持非递归模式减少扫描时间
   - 建议前端实现懒加载，按需展开子目录

3. **原子写入**：
   - 临时文件操作在磁盘 I/O 上有轻微开销
   - 确保数据完整性比性能更重要

---

## 未实现功能

### `watch_file` - 文件监听（可选）

**计划功能：**
- 监听文件外部修改
- 自动重新加载
- 防止数据丢失提示

**未实现原因：**
- 需要引入额外的文件监听库（如 `notify`）
- 前端需要配合实现冲突解决逻辑
- 根据任务清单标记为可选

---

## 测试建议

1. **单元测试**：为关键函数添加测试
2. **集成测试**：测试完整的文件操作流程
3. **边界测试**：
   - 空文件
   - 超大文件（>100MB）
   - 特殊字符文件名
   - 权限受限目录
   - 网络驱动器

---

## 交付文件

- `/Users/xiezhaorong/Desktop/ai-teams/projects/minidoc/src-tauri/src/commands/file.rs` - 文件操作命令
- `/Users/xiezhaorong/Desktop/ai-teams/projects/minidoc/src-tauri/src/lib.rs` - 命令注册
- `/Users/xiezhaorong/Desktop/ai-teams/projects/minidoc/src-tauri/capabilities/default.json` - 权限配置

---

## 验收标准确认

- [x] 所有命令能在 Tauri 环境中正常调用
- [x] 错误处理覆盖所有异常场景
- [x] 返回值符合前端预期
- [x] 代码编译通过（`cargo check`）
- [x] 日志系统完善
- [x] 权限配置正确

---

**状态：** 已完成

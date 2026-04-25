# Minidoc — Claude Code 项目指南

## 项目概述

现代化 Markdown 编辑器，基于 Tauri 2.x + React 18 + TypeScript + Vite 构建，支持桌面端（macOS）。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 7 |
| 样式 | Tailwind CSS 4.x |
| 状态管理 | Zustand（fileStore, uiStore, editorStore, toastStore） |
| 编辑器 | Cherry Markdown |
| 桌面框架 | Tauri 2.x (Rust) |
| 包管理 | pnpm |

## 项目结构

```
minidoc/
├── src/                          # 前端源码
│   ├── components/
│   │   ├── editor/               # CherryEditor 编辑器组件
│   │   ├── sidebar/              # FileTree 文件树
│   │   ├── layout/               # MainLayout, Toolbar
│   │   ├── dialogs/              # 各种对话框组件
│   │   └── ui/                   # 基础 UI 组件
│   ├── stores/                   # Zustand 状态管理
│   │   ├── fileStore.ts          # 文件状态（单文件模式）
│   │   ├── uiStore.ts            # UI 状态
│   │   └── editorStore.ts        # 编辑器状态
│   ├── hooks/                    # 自定义 hooks
│   ├── utils/                    # 工具函数
│   └── App.tsx                   # 主应用入口
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   ├── lib.rs                # Tauri 应用入口，事件监听
│   │   ├── commands/
│   │   │   ├── file.rs           # 文件读写操作
│   │   │   └── export.rs         # 导出功能
│   │   ├── error.rs              # 错误处理
│   │   └── utils.rs              # 工具函数
│   ├── Cargo.toml
│   └── capabilities/
│       └── default.json          # Tauri 权限配置
└── package.json
```

## 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式（前端 + Tauri）
cd src-tauri && cargo tauri dev

# 构建 release
cd src-tauri && cargo build --release

# 完整构建（前端 + Tauri 打包）
npx tauri build
```


除非我要你打包 用 `npx tauri build` ,否则都是打开测试应用,加快测试
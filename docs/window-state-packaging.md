# 0.1.6 窗口状态修复打包报告

版本：`0.1.6`，计划 GitHub 标签：`v0.1.6`。技术负责人查到远端最新标签 `v0.1.5` 后确定该版本。`package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 主包及 `src-tauri/tauri.conf.json` 已同步。

## 构建

使用现有依赖，在本机 Apple Silicon 构建 macOS arm64 发布包，不启动应用。仓库既有 CI 使用 pnpm，故保留 `beforeBuildCommand: pnpm build`；本机构建通过临时配置覆盖为 yarn：

```sh
rtk proxy env CARGO_NET_OFFLINE=true CI=true yarn tauri build -c '{"build":{"beforeBuildCommand":"yarn build"},"bundle":{"macOS":{"signingIdentity":"-"}}}'
```

`CARGO_NET_OFFLINE=true` 强制 Rust 构建离线，`CI=true` 避免安装包流程交互。初次构建成功但只包含链接器临时签名，完整 App 资源封装校验失败；最终构建临时指定 `signingIdentity: "-"`，用于完整本地 ad-hoc 签名。没有修改仓库的签名配置，也没有使用 Developer ID 证书或提交 Apple 公证。

前端 `tsc && vite build` 使用现有依赖成功。已有 Browserslist 数据过期、动态与静态导入混用及大 chunk 告警未阻塞构建，本次没有扩大修改前端构建配置。

## 产物及验证

产物目录：`src-tauri/target/release/bundle/`，由 Cargo 忽略，不加入 Git 源码。

- `dmg/minidoc-app_0.1.6_aarch64.dmg`：安装镜像。
- `macos/minidoc-app.app`：原始应用。
- `macos/minidoc-app_0.1.6_aarch64.app.zip`：使用 `ditto --sequesterRsrc --keepParent` 压缩的应用。
- `SHA256SUMS.txt`：两份可上传资产的 SHA256。

最终构建退出码为 0，耗时 42.36 秒，生成 App 与 DMG 两份原生产物。以下校验均通过：

- Info.plist：`CFBundleShortVersionString=0.1.6`、`CFBundleVersion=20261009.021553`、`CFBundleIdentifier=com.xiezhaorong.minidoc-app`。
- Mach-O：单架构 `arm64`。配置/Info.plist 保留原 `LSMinimumSystemVersion=10.13`，本机 arm64 二进制实际最低目标为 macOS 11.0；该资产用于 Apple Silicon。
- `codesign --verify --deep --strict --verbose=2`：`valid on disk`，满足 Designated Requirement。`codesign -dv`：`Signature=adhoc`、`TeamIdentifier=not set`，包含完整资源封装。
- `hdiutil verify`：镜像校验和 `VALID`。
- 只读无浏览挂载 DMG：包含 `minidoc-app.app` 和 `Applications` 链接；镜像内应用版本 0.1.6、完整签名通过，应用二进制与原 App 逐字节相同。已卸载验证卷。
- `unzip -tq`：应用压缩包内容无错误。
- `git diff --check`：通过。

| GitHub 资产 | 大小（字节） | SHA256 |
|---|---:|---|
| `minidoc-app_0.1.6_aarch64.dmg` | 6198591 | `d070764d1c5379db9b63073728ecacba454656ed044b5c8e6772f2738f90d81a` |
| `minidoc-app_0.1.6_aarch64.app.zip` | 6095062 | `d76653d619a0063a11c164ccbc3f96eb379d0f6025ff26b90c51c74035714a78` |

校验清单绝对路径：`/Users/xzr/Desktop/ai-teams/projects/minidoc/src-tauri/target/release/bundle/SHA256SUMS.txt`。技术负责人负责 Git 提交、推送及发布；本报告记录本地最终资产，不将准备完成等同于 GitHub 发布成功。

## 发布范围

仅本机可验证的 macOS arm64 产物，未构建 Intel macOS、Windows 或 Linux。本地 ad-hoc 签名不等同于 Apple Developer ID 签名或公证。窗口逻辑已完成离线回归与发布编译检查，原生窗口交互仍待打包应用人工验收；本次没有启动应用进行界面验证。

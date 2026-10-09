# 0.1.6 发布包独立复核

日期：2026-10-09。负责人：QA。状态：[待验收]；本地最终发布包完整性检查通过，可上传 GitHub。GitHub 资产验证待上传后补录。没有启动应用、执行联网测试、修改代码／版本或提交。

## 最终产物与摘要

| 产物 | 本地路径（相对项目根目录） | 字节数 | SHA256 |
| --- | --- | --- | --- |
| DMG | `src-tauri/target/release/bundle/dmg/minidoc-app_0.1.6_aarch64.dmg` | 6198591 | `d070764d1c5379db9b63073728ecacba454656ed044b5c8e6772f2738f90d81a` |
| App ZIP | `src-tauri/target/release/bundle/macos/minidoc-app_0.1.6_aarch64.app.zip` | 6095062 | `d76653d619a0063a11c164ccbc3f96eb379d0f6025ff26b90c51c74035714a78` |

QA 独立 `shasum -a 256` 与开发及 `bundle/SHA256SUMS.txt` 完全一致。旧 0.1.0 产物来自 2026-08-12，未作为本次发布依据。

## 已执行检查

1. `hdiutil verify`：最终 DMG 各分区校验通过，结果 VALID；只读挂载成功，包含主应用与指向 `/Applications` 的安装快捷链接。挂载后已卸载。
2. `unzip -t`：最终 ZIP 全部条目完整，无压缩数据错误，包含应用可执行文件、Info.plist、图标及 `_CodeSignature/CodeResources`。
3. bundle、DMG 内 app、ZIP 内 app 的可执行文件、Info.plist、图标和签名资源逐字节一致。最终包二进制 SHA256 为 `cda8ec0133add21a1bd1999f20d1a2546a5369c35a5f13d3e1c725b443ca924f`。
4. Info.plist 版本 `0.1.6`，构建版本 `20261009.021553`，标识符 `com.xiezhaorong.minidoc-app`。可执行文件有执行权限，签名工具识别 Mach-O thin arm64，与 Apple Silicon 包名一致。
5. `codesign --verify --deep --strict` 对最终本地 app 及 DMG 内 app 均退出 0。`codesign -dv --verbose=2` 显示完整资源封装、ad-hoc 签名，TeamIdentifier 未设置；没有 Developer ID 或公证验证通过的声明。
6. 签名后 app 与原 `target/release/minidoc-app` 整文件不同。QA 解析 Mach-O load commands 并逐字节比较 16 个含文件数据的 section，全部一致，确认原 release 编译内容保留。最终二进制包含四个此次窗口恢复／保存／边界失败诊断字符串，证实窗口修复代码随包进入。
7. 先前 17 项纯逻辑测试和离线 release 构建结果见 `window-state-test-report.md`，本次没有重复执行。完整 `cargo test --offline` 仍受 fastrand 缓存缺失限制，没有联网补依赖。

## 缺陷闭环与限制

首轮包通过镜像和 ZIP 检查，但 `codesign --verify --deep --strict` 报 `code has no resources but signature indicates they must be present`。开发重打完整 ad-hoc 签名包后，QA 严格签名复核通过。首轮产物摘要已作废，不可上传。

本报告验证安装包完整性、版本、架构、签名资源一致性与修复编译内容。没有运行主程序，不能证明真实 GUI 的关窗落盘、退出重开、原生工作区／标题栏边界、跨屏缩放体验或 Gatekeeper 安装体验已通过。程序坞无窗重建及插件全屏普通尺寸覆盖仍是已列限制。

## 发布资产核验

状态：待上传。上传后应核对发布版本、资产名称、字节数、GitHub SHA256 digest 或下载文件摘要，与上表及 SHA256SUMS 一致，再标记资产交付通过。

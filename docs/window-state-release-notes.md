# Minidoc v0.1.6

本次修复桌面窗口状态与屏幕边界：关闭窗口即保存大小和位置，启动时先恢复并检查工作区，再显示窗口；过大的窗口自动缩小，越界位置移回当前可用屏幕，窗口尺寸上限随屏幕工作区更新。

## 下载

- `minidoc-app_0.1.6_aarch64.dmg`：macOS Apple Silicon（arm64，macOS 11.0及以上）安装包。
- `minidoc-app_0.1.6_aarch64.app.zip`：同一macOS app压缩包。
- `SHA256SUMS.txt`：上述两个文件的SHA256校验摘要。

本次仅发布本机实际构建并检查的macOS arm64产物，未提供经过验证的Intel、Windows或Linux安装包。未使用Apple Developer发布证书签名或公证。

## 已执行检查与限制

17项窗口专项测试与4900组几何组合通过；离线cargo check、release编译及Tauri app／DMG打包完成。安装包版本、arm64架构、DMG完整性及包内二进制一致性由测试工程师独立核验，摘要随附件提供。

真实桌面应用未启动：关窗落盘、退出重开、菜单栏／Dock工作区、窗口装饰和跨DPI副屏操作仍待人工验证。完整cargo test缺少fastrand本地依赖缓存，未执行。程序坞无窗重建不在本次范围；现有window-state插件全屏期间可能覆盖普通窗口尺寸的限制仍存在。

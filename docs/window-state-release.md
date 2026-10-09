# 窗口状态修复发布记录

日期：2026-10-09。用户已明确授权打包并发布GitHub，含必要提交、push、版本tag与release。当前状态：0.1.6真实安装包已构建，测试工程师独立复核通过；代码已正常push，网页release等待上传权限，尚未发布。GitHub CLI未登录，但用户现有Chrome GitHub会话已认证，可通过网页发布。

## 版本与仓库核验

- 仓库：https://github.com/xzregg/minidoc；分支master。
- 开始时本地与远端master均为644bf0c22658561fb8f842e1551026a350cca313，无远端领先。
- 公共远端tag最高为v0.1.5；GitHub公开latest release页面当前为v0.1.4。因此选择新的顺序patch版本0.1.6 / v0.1.6，不覆盖旧tag与release。
- 本机arm64，发布范围为实际构建的macOS Apple Silicon app压缩包与DMG及SHA256校验文件；不宣称Windows/Linux或Intel通用支持。
- 现有.github/workflows/release.yml由tag push触发跨平台构建并创建release。本次不改造该工作流，其跨平台产物未验证。发布前后需检查同tag workflow及assets，避免历史流程竞争或上传未审核产物。

## 发布前检查

- [x] 窗口修复代码审查通过
- [x] 17项专项纯函数测试及4900几何组合通过
- [x] 离线开发检查与release编译通过
- [x] 0.1.6真实app／DMG打包成功（最终完整ad-hoc签名构建exit0）
- [x] 测试工程师核验版本、架构、DMG与包内二进制、SHA256（严格签名与16个Mach-O文件节一致）
- [x] 提交范围审核：仅本次修复、四处版本及window-state交付文档；安装包不加入源码
- [x] GitHub网页认证可用（CLI尚未登录，不读取或导出浏览器凭据）
- [x] 正常push master：源码提交36eefaa432323c0829760ad829bebd12b69d5203
- [ ] 创建新release并上传校验后的安装包（文件上传权限阻塞）
- [ ] release assets重新下载与摘要一致

## 真实桌面验证限制

未启动应用。原生关闭落盘、退出重开恢复、菜单栏／Dock工作区、真实装饰与跨DPI副屏操作仍待人工验收。完整cargo test因fastrand本地缓存缺失未执行；17项专项测试通过。程序坞无窗重建不在本次范围；插件全屏普通尺寸覆盖风险仍为已知限制。

## 最终本地安装包

- DMG：`src-tauri/target/release/bundle/dmg/minidoc-app_0.1.6_aarch64.dmg`，6198591 bytes，SHA256 `d070764d1c5379db9b63073728ecacba454656ed044b5c8e6772f2738f90d81a`。
- app ZIP：`src-tauri/target/release/bundle/macos/minidoc-app_0.1.6_aarch64.app.zip`，6095062 bytes，SHA256 `d76653d619a0063a11c164ccbc3f96eb379d0f6025ff26b90c51c74035714a78`。
- 摘要：`src-tauri/target/release/bundle/SHA256SUMS.txt`。
- 最终包使用完整ad-hoc签名；无Developer ID与公证。第一轮只有linker签名的包已被替换，不上传。

## 当前发布阻塞与恢复

- 正常git push成功：远端master从644bf0c推进至36eefaa，未force。
- GitHub CLI未登录；Chrome已有认证会话，发布表单已选择新tag v0.1.6及明确目标提交36eefaa，标题和说明已填写，尚未点击Publish。
- CUA上传3份安装包时被扩展权限拒绝：ChatGPT浏览器扩展未启用Allow access to file URLs。没有擅自修改权限。原生文件选择器替代因用户正在操作Chrome而被工具保护拒绝，不继续干扰。
- 恢复方式二选一：用户完成gh auth login，或在chrome://extensions的ChatGPT扩展详情中启用Allow access to file URLs。随后上传上述三份最终文件，发布并重新下载校验摘要。
- 发布表单已保留在浏览器，release URL预计https://github.com/xzregg/minidoc/releases/tag/v0.1.6；此URL尚未发布，不能作为发布成功证据。

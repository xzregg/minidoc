# 窗口状态修复发布记录

日期：2026-10-09。状态：v0.1.6已发布，最终三份资产已上传并保存；测试工程师公共下载复核通过。用户已明确授权打包、提交、正常push、tag及GitHub release。

发布页面：[Minidoc v0.1.6](https://github.com/xzregg/minidoc/releases/tag/v0.1.6)。平台：macOS Apple Silicon arm64，二进制最低目标macOS 11.0；完整ad-hoc签名，无Developer ID签名与公证。

## 源码与版本

- 仓库：https://github.com/xzregg/minidoc；分支master。
- 开始时本地与远端master为644bf0c22658561fb8f842e1551026a350cca313；远端最高tag v0.1.5，选顺序patch 0.1.6，未覆盖历史tag或release。
- 修复、版本与交付文档源码提交：36eefaa432323c0829760ad829bebd12b69d5203，已正常push。
- 公共git ls-remote与发布页均确认v0.1.6精确指向36eefaa；后续仅文档提交不移动tag。
- package.json、Cargo.toml、Cargo.lock主包与tauri.conf.json均为0.1.6。

## 最终资产

| 文件 | 字节数 | SHA256 |
| --- | ---: | --- |
| [minidoc-app_0.1.6_aarch64.dmg](https://github.com/xzregg/minidoc/releases/download/v0.1.6/minidoc-app_0.1.6_aarch64.dmg) | 6198591 | d070764d1c5379db9b63073728ecacba454656ed044b5c8e6772f2738f90d81a |
| [minidoc-app_0.1.6_aarch64.app.zip](https://github.com/xzregg/minidoc/releases/download/v0.1.6/minidoc-app_0.1.6_aarch64.app.zip) | 6095062 | d76653d619a0063a11c164ccbc3f96eb379d0f6025ff26b90c51c74035714a78 |
| [SHA256SUMS.txt](https://github.com/xzregg/minidoc/releases/download/v0.1.6/SHA256SUMS.txt) | 196 | 995e06eb5e2a2f451ac862bcd12a39c0b7dc4325ce70e7a9f798e467e0e9776a |

GitHub网页Assets显示上述3份附件及2份源码归档，网页digest与本地最终文件一致。安装包保留在src-tauri/target/release/bundle，不加入源码Git。

## 发布执行与竞争流程

GitHub CLI未登录，但用户现有Chrome GitHub会话有效。上传最初因ChatGPT扩展缺少Allow access to file URLs权限受阻；用户完成设置后恢复本次表单，最终3文件通过上传并Update release保存成功。用户等待期间已自主发布同一v0.1.6，仅含源码归档；团队补齐了本次真实安装包，未新建版本或移动tag。

tag创建触发现有跨平台Release Build #9：[运行37874280633](https://github.com/xzregg/minidoc/actions/runs/37874280633)。为防止该未审查跨平台流水线覆盖同名DMG，本次取消该运行，页面已明确cancelled。没有修改或禁用工作流，不宣称其他平台构建完成。

## 检查与验收界限

- [x] 窗口修复代码审查通过
- [x] 17项专项纯函数测试及4900几何组合通过
- [x] 离线开发检查与release编译通过
- [x] 0.1.6真实app／DMG打包成功
- [x] 测试工程师独立检查版本、架构、严格签名、DMG与包内内容、SHA256
- [x] 必要源码与文档正常push，未force
- [x] 发布页、三份资产、tag源码目标与GitHub digest核验通过
- [x] 并发旧发布流程确认cancelled
- [x] 测试工程师公共下载三份资产复核（实际GET文件摘要及字节数一致）
- [ ] 打包应用真实桌面人工验收

未启动应用。原生关闭落盘、退出重开恢复、菜单栏／Dock工作区、真实装饰与跨DPI副屏操作仍待人工验收。完整cargo test因fastrand本地缓存缺失未执行；17项专项测试通过。程序坞无窗重建不在本次范围；插件全屏普通尺寸覆盖风险仍为已知限制。已完成安装包发布不等同于真实桌面产品验收通过。

测试工程师独立公共下载结果见[window-state-package-qa.md](window-state-package-qa.md)：三份资产实际下载、SHA256、字节数及tag源码目标均核验通过；安装包交付完成。

# 验证记录 · 0.2.0

2026-10-05，本地 Dark Reader 4.9.133 API 构建成功，接入 Night 扩展。引擎来源与摘要见 `extension/vendor/engine.json`。

## 已通过

- Node 单元测试：14 项通过，覆盖颜色工具、原生主题候选与 Wikipedia/Bilibili 临时主题标记恢复。
- Chrome + Playwright 本地网页回归：原生主题自动开启与恢复、浅色页转换、表单对比度、图片/Canvas 不使用反色 filter、动态新增卡片、网站原生主题来回切换。
- 网站策略 off/native/force、浏览器明暗偏好切换、全局开关、停用后恢复浅色样式、保留用户已有原生深色。
- 延迟深色、深色页眉与浅色正文混合、透明背景、长网页场景。
- 页面空闲时观察 1 秒，引擎启用次数不再增加，修复由引擎样式 load 事件产生的反馈循环。
- 页面无未捕获 JavaScript 错误；转换截图见 `test-results/light-converted.png`，已人工检查正文、表单与媒体区域。

测试使用真实引擎和 Night 脚本，但存储/消息接口为替身，没有证明扩展权限、popup 消息、隔离环境或 Safari 实际注入行为。

## Safari 加载

通过 Safari → Developer → Add Temporary Extension 加载本项目 `extension/`，Extensions 设置已显示 Night 0.2.0。旧版 Night 0.1.0 仍在扩展列表中，需要测试时停用旧版，避免多个深色扩展同时转换。这里只确认 Safari 识别并加载了扩展，没有证明新引擎在 Safari 网页中的运行效果。

## 仍需实测

- Safari 真实网页权限、引擎注入与 popup 操作。
- Bilibili/Wikipedia 真实站点在新引擎版本中的原生主题与切换。单元测试不是在线网站验证。
- Safari 页面加载、跨站跳转、前进后退和刷新时的闪白；需录屏逐帧检查。
- CSP 严格网站、跨域样式和图片、iframe、shadow DOM、adopted stylesheets、CSSOM 动态更新、登录保护资源。
- 频繁 DOM 变化网站的重建成本与长时间内存占用。

本机缺少 Playwright WebKit 浏览器可执行文件，因此 WebKit 回归未运行；没有以 Chrome 结果代替 Safari 验证。

## 稳定性与打包回归 · 2026-10-05

- 普通元素 class/style、20 张动态卡片及 resize 不触发引擎重启，新增卡片仍转换为深色。根主题切换仍能在原生与转换间切换。
- 强制模式在根主题变化时保持引擎运行。全局停用及网站停用在页面初始化期间不进入 pending，不显示加载遮罩。
- Node 14 项测试、Dark Reader 上游 75 项单元测试、本地 Chrome 网页回归通过。
- `npm run package` 核验引擎 SHA-256、manifest 引用与 JSON 文件，生成 ZIP 并通过解压完整性检查。已修正本地引擎被父目录 Git 规则忽略的问题。
- 本轮 Safari UI 操作被工具连续提示用户正在操作窗口而中止，未 Reload 或验证新版扩展；Safari 项目路径、真实 popup 与开关恢复仍待验证。

## Safari 实际扩展检查 · 2026-10-05

- Safari 设置确认新版 Night 0.2.0 在 Personal 启用、旧版 Night 停用；执行了 Reload。Show in Finder 显示 night 下的 extension 目录。
- 真实 popup 能显示当前 host 与内容脚本状态；example.com 报告原生深色，本地 127.0.0.1:8765 浅色演示页报告已转换。
- 在真实演示页追加卡片并输入 Safari 验证，页面内容与输入正常，popup 继续报告转换。随后浏览器外观变浅，popup 报告保留网站主题，截图确认恢复浅色页面。没有通过脚本测量 Safari 对比度或重建次数。
- Reload 后设置仍记录 TypeError: Load failed (vendor/darkreader.js:357:30)。该位置为引擎资源请求失败后的 catch 日志，不能认定整个引擎崩溃；失败 URL 未定位。
- Safari popup 的策略控件自动化操作多次仅关闭弹窗，未成功完成网站策略、全局开关与刷新持久化验收。这些项目继续列为待测。
- 测试期间临时停用 Dark Night，之后重新启用，并在 School 的 Extensions 面板关闭其开关，恢复仅 Personal 启用的原配置。

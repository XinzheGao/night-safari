# 验证记录 · 2026-10-04

## 已完成

- 5 项 Node.js 颜色测试通过：颜色解析、默认正文/次级文字/链接在三种默认背景上的 4.5:1 对比度、半透明背景合成、红绿状态文字保留，以及链接中的中性文字与白色标签不会被强制改蓝。
- Safari 27.0.1 临时加载并启用 Night；本地测试站点已授权。
- B 站首页文字修复后 Reload 并刷新，目视确认顶部导航恢复白色、视频标题恢复浅色、作者信息恢复灰色，“更多”不再显示白色背景块。当前同时启用 Dark Night 和 AdGuard，因此这次观察不能证明扩展独立运行时的完整兼容性。
- 扩展 JavaScript 语法与 manifest 引用文件检查。
- 安装脚本的 Bash 语法检查。

## 尚未完成

- 浏览器场景测试：已写入 `tests/browser.cjs`，但当前环境没有浏览器运行程序，下载返回无效/不完整压缩包，未能启动。不能据此声称动态网页、原生主题识别和媒体保持原色已经实测通过。
- Xcode 工程生成与 popup API。
- Safari 实际首帧、跳转防闪屏录屏；防闪屏效果尚未验证。
- 真实网站兼容性与长页面性能。

在 Mac 上按 README 的验证表完成第一轮测试后，再补充这些结果。

## Bilibili native adapter (2026-10-04)
- Inspected the current public laputa-home script index-12fc55c2.js. Native startup reads `theme_style`; the homepage uses `html.bili_dark`.
- Added an automatic-mode adapter restricted to www.bilibili.com homepage. Writes the native preference and activates the shipped theme class; confirms dark --bg3 before bypassing Night conversion. Off/native/forced conversion choices do not activate the adapter. The preference persists like Bilibili's own switch; disabling Night does not erase it.
- Reset theme preference to light through Safari console, reloaded the temporary extension, refreshed homepage: preference became dark automatically.
- Final Safari runtime verification: bili_dark=true, theme_style=dark, data-night-state=native, night-engine stylesheet length=0, --bg3=#0A0B0C. No menu clicks during automatic activation test.
- Dark Night and AdGuard remain enabled; flicker and other Bilibili pages are not independently validated.

## Generic native-theme activation (2026-10-04)
- Added native-theme.js before content.js in the manifest. Discovers common root class/attribute switches from readable active site CSS; ignores Night engine CSS, inaccessible styles, inactive media, and component names such as dark-widget.
- Checks rendered dark coverage/contrast with Night rules disabled in the same task. Failed attempts roll back; attempted candidates are remembered to prevent mutation feedback loops. Generic markers are reversible and not persisted in website storage.
- npm test: 9 passing tests including discovery, rollback, preservation of unrelated classes, inaccessible CSS and inactive media.
- Headless browser regression passed using installed Chrome and bundled Playwright: native auto activation, empty engine, off restores light, re-enable, ordinary light conversion, forms/media, dynamic DOM, manual native toggle, off/native/force, native/delayed/mixed/transparent/large pages, stable observer and no page errors.
- Reloaded temporary Night extension in Safari and refreshed current LocalSend tab. Its native theme mechanism was not inspected or independently verified; Chrome fixture results do not prove Safari first-paint or other-extension compatibility.
- Limitations: only common CSS root switches; script-only themes and unreadable cross-origin styles need site adapters. Synchronous confirmation may reject themes with transitions. Existing Bilibili homepage adapter retained.

## Wikipedia adapter (2026-10-04)
- Safari showed Chinese Wikipedia Vector appearance controls with light selected. Inspected public HTML and skins.vector.clientPreferences module: root skin-theme-clientpref-night; radio id skin-client-pref-skin-theme-value-night; its change handler applies native classes and saves through MediaWiki's native preference API (cookie for anonymous users).
- Automatic mode now dispatches change on that exact native control on wikipedia.org hosts. It honors disabled controls and off/native/force modes, limits unready-handler retries, and restores checked state after unsuccessful attempts. No direct account API or guessed storage writes.
- 12 unit tests passed, including native-handler activation, idempotence, host/mode restrictions and unready-handler rollback. Syntax check passed.
- Safari computer-use calls repeatedly timed out during inspection. Modified extension has NOT been reloaded in Safari and current Wikipedia page success is NOT confirmed. Native render confirmation still uses visible coverage/contrast; if homepage native styling is incomplete Night may continue conversion.

### Safari Wikipedia follow-up
- Reconnected Safari by bundle id after initial timeout; reloaded temporary Night through Extensions settings and refreshed Wikipedia.
- Runtime console confirmed skin-theme-clientpref-night, data-night-state=native, night-engine text length=0, native night radio checked=true. Accessibility confirmed light=0 and dark=1. This supersedes the earlier unverified reload note.
- User UI activity interrupted the additional refresh-persistence check; no claim of independent first-paint or other-extension compatibility.

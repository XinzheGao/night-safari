# Night · Safari 深色扩展

这是第一版可加载的扩展源码，用于验证三个目标：保留网页当前的原生深色、尽早保护加载过程、将浅色网页转换为 GitHub 风格配色。还不是已经验证兼容所有网站的发布版。

## 为什么做 Night

晚上浏览网页时，系统已经切换到深色，打开的网页却仍然是白底；有些网站支持原生深色，也需要逐个切换。页面加载和跳转时偶尔闪出的白屏，也会打断阅读。

Night 想把这件事做得简单一点：优先使用网站自己的深色主题，没有可用原生主题时，再转换成统一的 GitHub 风格暗色。尽量保留图片和内容原有的颜色，并提供全局开关和按网站设置，让用户能随时恢复网页原貌。

目前最关注三件事：原生深色识别是否准确、加载时能否减少闪白、转换后的文字是否清晰。它还是一个持续验证中的 Safari Web Extension 原型，防闪白效果和复杂网站兼容性仍需实测。

## 后续版本计划

以下是计划方向，版本范围会根据实际测试反馈调整，暂不承诺发布日期。

| 版本 | 重点 |
| --- | --- |
| **0.1.0 · 当前原型** | 原生深色优先、浅色页面转换、加载保护、全局及网站开关；包含 B 站首页和维基百科原生主题适配 |
| **0.1.x · 稳定性修复** | 收集常用网站误判和样式问题；在 Safari 录屏验证闪白；补充独立运行与主题切换测试 |
| **0.2.0 · 兼容性与性能** | 优化动态页面和长页面的增量处理；扩展原生主题适配，改善复杂组件和特殊样式支持 |
| **0.3.0 · 使用体验** | 评估亮度、对比度和配色设置；完善网站规则管理及设置体验 |
| **1.0.0 · 稳定发布** | 完成 Safari 打包、签名与发布验证，明确支持范围，提供可安装版本 |

已经完成的更新见 [CHANGELOG.md](CHANGELOG.md)，实际验证情况见 [VALIDATION.md](VALIDATION.md)。遇到问题时，欢迎提交 Issue，附上网址、Safari 版本、Night 模式，以及截图或复现步骤。

## 先在 Safari 里运行

下载并解压项目包。用 VS Code 打开 `night-safari` 文件夹。

### 方法 A：临时加载，最快开始

如果 Safari 的设置里有 **Add Temporary Extension…（添加临时扩展）**：

1. Safari → Settings → Advanced，启用 **Show features for web developers**。
2. Settings → Developer → **Add Temporary Extension…**，按提示完成本机认证。
3. 选择项目中的 **extension 文件夹**，它的根目录直接包含 `manifest.json`。不要选择整个项目文件夹。
4. 在 Extensions 中启用 Night，授权它访问准备测试的网站。先给本地测试站点和你常用的少量网站权限。
5. 刷新已经打开的网页，点击工具栏中的 Night 查看状态。

临时扩展会在退出 Safari 或 24 小时后被移除；下次重新加载。如果没有这个按钮，使用方法 B。

### 方法 B：生成 Xcode 工程

需要 **完整 Xcode**，只安装 Command Line Tools 不够。在项目文件夹打开终端，运行：

```bash
bash scripts/create-safari-project.sh
```

脚本会检查本机可用的 Apple 工具：新版使用 `safari-web-extension-packager`，旧版使用 `safari-web-extension-converter`，生成 macOS 工程，不覆盖已有工程。

在 Xcode 中选择 Night 的 macOS App scheme，检查两个 target 的 Signing & Capabilities 设置，按 **⌘R** 构建并运行容器 App。没有开发证书时，按照 Apple 的本地开发流程在 Safari → Settings → Developer 勾选 **Allow unsigned extensions**。签名/构建报错时先处理 Xcode 的具体报错，不需要为第一轮测试先购买开发者会员。

再到 Safari → Settings → Extensions 启用 Night 并允许测试网站的访问权限。每次修改扩展源码后，重新构建；临时加载方式则在扩展设置中 Reload，然后刷新网页。

## 跑本地测试页面

Mac 安装 Python 3 后，在项目目录运行：

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory demo
```

Safari 打开 **http://127.0.0.1:8765**，允许 Night 访问这个站点。保持终端运行。

| 场景 | 预期 |
| --- | --- |
| 浅色网页 | Night 显示“浅色网页已转换”；正文、卡片、表单可读 |
| 原生深色 | 显示“已识别网站原生深色”；不再套插件主题 |
| 延迟深色 | 网站在 750ms 后切换深色，Night 撤掉转换 |
| 深色页眉 | 白色正文仍应转换，不被顶部暗色误导 |
| 透明背景 | 半透明浅色卡片仍可读 |
| 长网页 | 分批处理完成，滚动后追加内容正常 |
| 切换网站原生主题 | light → dark → light 时自动转换/退出/恢复 |
| 追加卡片 | 后加入的卡片也被转换 |
| 在此网站停用 | 恢复网页颜色，原图和 Canvas 不被反色 |

检查图片、Canvas、SVG 的红绿蓝颜色；试着在输入框打字。再测试真实网站：一个已开启原生深色的网站、一个普通白底文章页、一个带动态弹窗的页面。

**防闪屏必须另测**：在 Safari 上录屏，反复执行站内跳转、跨站跳转、刷新、前进和后退，逐帧检查白色画面。自动化状态测试无法证明首帧没有白色。Safari 内部页面、PDF、扩展权限之外的页面，以及扩展注入之前的浏览器画布不在控制范围内。

## 文件入口

| 文件 | 作用 |
| --- | --- |
| `extension/manifest.json` | 权限、`document_start` CSS 与脚本 |
| `extension/preload.css` | 加载阶段的深色遮罩，1.8 秒自动释放 |
| `extension/colors.js` | 颜色解析、亮度、对比度与配色 |
| `extension/content.js` | 原生主题判断、分批转换、动态网页观察 |
| `extension/popup.*` | 全局开关、当前网站策略与状态 |
| `demo/` | 本地验证网页 |
| `tests/` | 颜色测试与浏览器行为测试 |

## 第一版设计与边界

- **判断实际呈现**：采样可见区域的背景和文字对比度，按面积覆盖判断；`prefers-color-scheme` 只触发复查，不直接当成网页已经变黑的证据。检测时同步关闭自己的主题样式，再在同一任务内恢复，排除自我污染。
- **保护早期画面**：manifest 静态注入 root 伪元素遮罩，不把原始页面背景染黑，因此不污染检测。CSS 和 JS 都有超时释放，避免长时间遮住页面。权限关闭或按网站停用的情况下仍可能短暂看到遮罩，因为 CSS 先于异步设置读取运行。这是当前版本的明确限制。
- **原生深色优先**：检测到原生深色时撤掉引擎规则和节点标记；自动模式会从可读取的网站 CSS 中发现根元素深色 class/属性，确认实际配色变深后保留；失败则撤回并转换。不会自动点击按钮或猜测 localStorage 键。B 站首页另有已验证的 theme_style 原生偏好适配。
- **按元素转换**：读取原始颜色并生成独立样式；不修改原始 inline style，不使用 `invert()`。支持透明颜色、常规文字、链接、表单和边框。
- **动态页面**：监听常用主题属性、class/style、DOM 插入、样式加载、系统主题变化和前后导航。未包含 shadow DOM、伪元素内容、复杂渐变、图片上的文字、CSS 动画配色、非 sRGB 颜色和完整语法高亮适配。SVG 的 `currentColor` 仍可能受到父元素文字颜色影响。
- **性能**：180 个元素一批，旧主题在更新期间保留，到新主题完整时统一替换；大量 DOM 或频繁更新的网站仍需做性能验证与增量扫描优化。
- **权限与数据**：只请求 HTTP/HTTPS 页面、storage 和 activeTab；没有后台服务、外部请求、统计、账户或远程代码。插件设置保存于扩展的本机 storage；B 站专用适配会保存网站自己的主题 Cookie。每个 iframe 依据自己的域名策略处理。

默认色板：背景 `#0d1117`、输入/代码背景 `#161b22`、卡片 `#21262d`、正文 `#e6edf3`、次级文字 `#8b949e`、边框 `#30363d`、链接 `#4493f8`。这是自选的 GitHub 风格配色，不宣称与 GitHub 当前每个 token 完全一致。

## 开发测试

Node.js 20+，颜色测试无需安装依赖：

```bash
npm test
```

浏览器测试需要安装 Playwright 和对应运行程序：

```bash
npm install
npx playwright install chromium webkit
npm run test:browser
ENGINE=webkit npm run test:browser
```

浏览器测试注入真实的 CSS/JS，但 mock 扩展存储与消息 API；它验证页面行为，不能代替真实 Safari 扩展权限、打包、popup API 和首帧测试。参见 `VALIDATION.md` 记录本次实际完成的检查。

## Apple 官方参考

- [运行 Safari Web Extension：临时加载和本地开发](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
- [为 Safari 打包 Web Extension](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
- [管理扩展权限](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions)

下一轮优先记录真实网站误判和录屏中的闪白位置，改进原生主题检测与加载保护，再扩展功能。

通用开启目前支持根元素 `.dark`、`.dark-mode`、`.dark-theme`、`.theme-dark`，以及 `data-theme`、`data-color-mode`、`data-bs-theme`、`data-mode` 的 dark 值。跨域且不可读取的 CSS、仅由脚本控制的主题、系统媒体查询主题，以及无法同步确认生效的主题会回退到 Night。通用尝试不持久写入网站存储；关闭/强制模式会撤回插件添加的通用主题标记。

维基百科 Vector 外观面板另有专用适配：自动模式通过代码触发原生“深色”控件的 change 处理，由 MediaWiki 自己保存偏好；不模拟鼠标点击。此偏好与手动切换一样可能持久保存，关闭 Night 不会清除网站偏好。

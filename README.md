# Night · Dark Reader 引擎原型

Night 负责 Safari 中的使用体验：跟随浏览器明暗偏好、优先保留或尝试开启可靠的网站原生深色、全局及网站开关、加载保护。没有可用原生深色时，使用本地打包的 Dark Reader 动态主题引擎转换网页。

当前版本为 **0.2.0 接入原型**。本版本在 0.1.0 的基础上接入 Dark Reader 动态主题引擎，并增加原生深色遗漏区域补齐。转换配色以 `#0d1117` 背景和 `#e6edf3` 正文为基准，具体元素颜色由引擎计算，不保证旧版本所有色板 token 原样保留。

## 在 Safari 加载

Safari → Settings → Developer → **Add Temporary Extension…**，选择本项目的 **extension 文件夹**：

`<本项目目录>/extension`

启用扩展并允许访问测试网站，然后刷新网页。已有旧版 Night 时，先停用旧版，以免两个扩展同时转换。修改源码后在扩展设置中 Reload，再刷新网页。临时加载涉及本机认证，需要在 Safari 中完成。

也可以运行 `bash scripts/create-safari-project.sh` 生成 Xcode 工程；该脚本不会覆盖已有工程。生成工程不等于完成签名、上架或 Safari 兼容性验证。

## 开发与验证

- `npm test`：颜色工具和原生主题适配测试。
- `npm run package`：核验引擎摘要、manifest 引用文件与 ZIP 完整性，生成 `artifacts/night-0.2.0.zip`。扩展源码和本地引擎随项目保留，测试截图、Xcode 工程及生成的 ZIP 不纳入版本管理。
- `npm install` 后执行 `CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser`：本地 Chrome 网页行为回归。
- `npm run demo`：本地演示站，访问 `http://127.0.0.1:8765`。
- 维护引擎时，将本项目放入 Dark Reader 源码仓库的 `night/` 子目录，在父目录安装锁定依赖（`npm ci --ignore-scripts`）后，执行 `npm run engine:update`：从当前源码构建引擎，复制许可证，记录版本、Git revision 和文件 SHA-256。已打包的扩展不需要用户安装 npm。

浏览器测试以 manifest 中的脚本顺序注入实际引擎，使用扩展存储接口的替身；不等于真实 Safari 扩展运行。详细结果与待测事项见 [VALIDATION.md](VALIDATION.md)。

## 实现入口

| 文件 | 作用 |
| --- | --- |
| `extension/content.js` | Night 模式、原生主题识别、Dark Reader 启停、变化监听 |
| `extension/native-theme.js` | 从网站自身 CSS 中寻找可靠的根主题入口 |
| `extension/native-fallback.js` | 原生深色中遗漏的浅色背景及文字补齐 |
| `extension/vendor/darkreader.js` | 本地构建的 Dark Reader API 包 |
| `extension/vendor/engine.json` | 引擎版本、源码 revision 和包摘要 |
| `extension/vendor/DARKREADER-LICENSE` | 随产品保留的 MIT 版权与许可证 |
| `extension/popup.*` | Night 的全局开关、网站策略与状态 |
| `extension/preload.css` | 加载保护及超时释放 |

检测原生深色前，Night 同步停用引擎，避免把自己的转换误判为网站主题；检测后按策略恢复。变化监听忽略引擎生成的样式、样式加载事件和私有内联变量，防止反馈循环。

## 当前边界与后续工作

这一版嵌入的是公开 API 动态主题引擎，没有自动附带完整 Dark Reader 扩展的网站修正规则库。关闭了向网页注入的 stylesheet/custom-element 脚本代理；依赖 CSSOM 动态写入、部分 shadow DOM 或 adopted stylesheets 的网站仍需独立验证。

资源读取使用正常浏览器 fetch，省略凭据，不通过后台代理绕过 CORS。跨域样式、图片及受登录保护的资源可能无法完整分析；后续按 Safari 权限模型接入受限制的后台读取。

网站原生主题采样仍然使用可见区域判断。普通内容和局部样式更新交给 Dark Reader，Night 仅在根主题、网站样式表或策略变化时重新判断；强制转换模式复用已启用的引擎。高频根主题变化、长期内存占用仍需验证。加载保护在读取设置并确认需要深色后才出现，避免遮住已停用的网站；因此设置读取前的首次绘制没有遮罩保证。保留 1.8 秒超时释放，真实 Safari 闪白仍需录屏验证。

下一步优先在 Safari 验证常用网站，再补网站修正规则、跨域资源处理与性能优化。

## 原生深色补齐

自动模式确认原生深色后，Night 检查可见元素，将遗漏的高亮、中性纯色背景补为深色，并修正其中对比度不足的文字。滚动、窗口变化和动态 DOM 更新后重新检查；关闭 Night、切换浏览器浅色或选择“始终使用网站主题”会移除补齐。原有深色区域、图片、视频、SVG、背景图和渐变不转换。

已在真实 Safari 知乎主页确认导航栏、右侧咨询卡片及悬浮按钮补齐；本地 Chrome 回归覆盖动态背景变化、文字对比度及浅色恢复。通用判断可能改变网站有意保留的白色纯色区域；伪元素、Shadow DOM、复杂背景和特殊颜色格式仍需实测。

防闪烁：重新检查原始颜色时同步抑制 CSS 过渡，受补齐影响的元素不执行颜色过渡；主题重新判断复用补齐样式表，避免反复删除和插入触发网站动态样式反馈。动态通知模拟回归按帧验证补齐颜色稳定。经用户授权，真实 Safari 知乎通知弹层连续采样 600 帧：弹层与底栏保持 rgb(25, 27, 31)，导航栏保持 rgb(22, 27, 34)，主题状态始终为 native。通知分类切换和滚动场景未验证。

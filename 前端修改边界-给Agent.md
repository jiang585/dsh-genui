# GenUI 前端修改边界（给 Agent）

项目主目录：`E:\chat\dsh-genui`。这是 DSH 的插件，不是独立网站。本文只说明哪些前端可改、哪些改动会影响状态回传、后端或沙箱；不指定美化方案。

## 可以直接修改的视觉层

| 文件 | 可以修改 | 必须保留 |
|---|---|---|
| `lib/client.js` 的 `STYLE` 与卡片展示 JSX | 卡片边框、颜色、字体、圆角、头部布局、状态文案、装饰元素 | iframe 引用、源码发送 effect、消息订阅 effect、Hook 调用与顺序、callId 传递 |
| `vendor/frame-page.html` 的 CSS | 内容间距、错误栏呈现、字体与背景 | `stage`、`err` 的 ID；内容测量功能；测量需包含可见错误栏与内容 |
| `vendor/public/dil/dil.css` | 主题变量、所有组件外观、响应式样式、焦点态、深色模式、减少动画适配 | 组件类名与语义；隐藏/选中/禁用行为；不能靠固定高度或 overflow 把内容裁掉 |
| `vendor/public/dil/renderer/components/{layout,text,controls,data,charts}.js` 的视觉构造 | 固定且可信的 DOM 结构、组件内部布局和装饰 | factory 返回协议、update 同步、事件映射、readValue、childHost、安全文本处理 |
| `vendor/public/dil/renderer/icons.js` | 固定图标路径、固定图标集合 | SVG 属性值必须受控，不能把模型文本拼成可执行 HTML |

## 可以调整，但属于交互行为修改

| 区域 | 为什么不能只按外观修改 | 修改后必须验证 |
|---|---|---|
| `controls.js` | `onChange` 最终发送的是值，不能替换为 DOM Event 或函数 | input、select、slider、checkbox、radio 的值类型与状态回传 |
| `charts.js` | 在可信页面生成 SVG；数据来自模型；Observer 影响尺寸 | 标签转义、有限数值、容器缩放、组件卸载后的观察器释放 |
| `layout.js` | 尺寸可能改变卡片高度或制造嵌套滚动 | 长内容、收缩、窄屏、交互展开后高度 |
| `client.js` 状态栏 | 编译完成与浏览器实际渲染成功是不同阶段 | streaming、compiled、rendered、error 状态，不应将 compiled 文案写为“已渲染成功” |
| `frame-page.html` 错误栏 | 错误文本也占据高度，影响完整显示 | 错误出现/消失后的高度收敛 |

## 不属于普通美化范围

以下代码会影响后端、会话隔离或运行权限。若任务只有“美化”，应保留其行为；确需修改则先读取实现和宿主契约，并承担相应回归验证。

| 文件/机制 | 边界 |
|---|---|
| `lib/host.js` | 路由、认证委托、JSON 请求要求、callId 归属查询、响应字段、资源目录边界 |
| `lib/compile.js`、`compile-worker.cjs` | 编译线程、128 KiB 源码上限、2 个并发线程、2 秒预算、异常收口 |
| `lib/state-store.js` | 按卡片归属保存状态、会话查询、7 天过期、256 个调用上限、8 KiB 状态上限、持久化 |
| `plugins/genui-tools.js` | 工具名/参数/输出契约、callId→sessionId 绑定、状态提示词、连续花括号清洗 |
| `vendor/compiler/*` | DIL 文法、编译产物、隐式与显式状态处理；改 UI 标签可能要同时更新编译器 |
| `vendor/sandbox/{frame,worker}.js` | CSP、opaque origin、Worker、MessagePort、健康检查、渲染超时、终止与隔离 |
| `vendor/public/dil/{sandbox,message-view,view-state}.js` | 编译版本防乱序、首建状态恢复、状态串行上报、失败重试、runner 生命周期 |
| `vendor/public/dil/renderer/{patch,index}.js` | 树与 DOM 同步、事件函数 ID、组件分派；不能允许任意 HTML 或模型脚本 |
| `package.json`、`cordis.patch.yml` | 包身份、客户端 module-loader ID、DSH 装配、模式、导出路径 |

## 前后端与 iframe 消息契约

- 工具 wire name 为 `genui_render`，参数为 `source`、可选 `title`。工具执行上下文的 callId 和 agent.id 建立可信归属。
- DSH 槽位源名是 `toolCallArgumentsPartial`，实际注入组件的属性为 **`useToolCallArgumentsPartial`**。它是 Hook，每个 phase 保持同样调用顺序。
- 父卡片→frame：`__genuiHost: true`，`kind` 为 `warm/source/measure` 等；源码消息包含 `source` 与 `callId`。
- frame→父卡片：`__genuiFrame: true`，`ready/height/streaming/compiled/rendered/error`。监听必须验证消息来自自己的 iframe；frame 验证来源是 parent 且 origin 相同。
- `POST /genui/compile`：JSON `{source}`，返回编译产物与诊断；这是有认证的接口。
- `POST /genui/view_state`：JSON `{call_id, updates:[{scope:'root', state, reason}]}`。不能由前端指定 `session_id`，不能把 `card/stream` 调试信息放进 root。
- `GET /genui/state?call_id=...`：返回该调用保存的结构化 root 状态；未知/尚未绑定调用为 409。不存在“最新全局状态”的兜底。
- 编译结果必须通过 revision 判断后再应用。不能为“加载更快”而移除该判断。
- 外层 frame 承载可信渲染器；内层 runner 保持 `sandbox="allow-scripts"`。不要给 runner 添加 `allow-same-origin`。
- 模型文本使用 textContent 或转义后显示；事件是 `__dilFn` ID。不要添加 `eval`、动态脚本、任意 innerHTML 或远程图片加载能力。

## 高度相关的限制

卡片已经支持内容增长和收缩，不再静默截断到 8000px。内容高度由 stage 的真实内容尺寸测量，不能把根视口高度作为内容高度。不要用固定 iframe 高度、max-height 或 overflow-y:auto 重新引入卡片内滚。表格为可读性保留横向滚动，属于组件行为；若要改动需重新验证窄屏。

## 测试与交付

主回归：`node tools/regression.mjs`。

真实浏览器回归：`node tools/browser-regression.mjs`，使用隔离的 Edge profile 和本地测试服务，验证状态恢复、交互回传、长内容增长/收缩及 Worker 无限循环隔离。截图输出 `tools/genui-preview.png`。

改动声明必须指出改了哪些文件、是否触及上表的行为/协议层，以及验证的是隔离浏览器还是真实 DSH 会话。隔离回归不能代替实际模型/中转的参数流式验证。

`E:\chat\dsh-genui-live` 与 `E:\chat\dsh-genui-live2` 是不同包名与挂载路径的本地副本，修改先落主目录，再保留各自身份与前缀同步。不要直接运行旧的删除目录式 variant 脚本。宿主 ESM 以 URL 缓存：运行中的宿主不会因文件变动就加载新的后端；应用重启后再确认激活与路由。浏览器半刷新与后端重新加载是两件事。

## GenUI 外层工具组展开约束（2026-10-13）

`lib/client.js` 的 apply 注册 `data-genui-process-expansion` 样式。这属于功能约束：选择器 `[data-step-process-body]:has([data-genui-card])` 解除 DSH 工具组的高度上限、纵向内滚和渐隐。美化时保留此 effect、选择器与插件卸载清理行为，样式必须注册在应用主文档，不能移入 iframe。验证使用 `node tools/outer-scroll-regression.mjs`，须同时确认普通工具仍保持原有滚动行为。

# 审查包目录说明（先读这个）

这是一个 DSH（DeepSeek Harness）插件 + 「智能界面模式」的完整可审代码包。
目的：让外部审查者（ChatGPT）在**不看我的结论摘要**的前提下，直接读代码找缺陷。

## 阅读顺序

1. `00-审查提示词.md` —— **任务书**：审查范围、输出格式、我已列出的 9 个存疑点。
2. `01-DSH契约摘录.md` —— DSH 的既有约定（含真实代码片段）。**先读这个**，
   否则容易把「DSH 的约定」误判成插件的 bug（例如前缀路由不能带尾斜杠、`/api` 是保留前缀、
   提示词里 `{{…}}` 会让整轮抛错、客户端 bundle 必须自己声明 `module`/`exports`）。
3. `02-实测证据.md` —— 我跑过的所有验证的**原始输出**（含两次用户实测故障的复现与回归）。
   请注意第 9 节「明确没有验证到的部分」。
4. `plugin/` —— 插件本体（要审的核心）：
   - `lib/host.js` 宿主半：`/genui/*` 路由 + 编译端点 + 状态端点
   - `lib/client.js` 客户端半：`tool.call.toolview` / `genui_render` 卡片（手写 module-loader 工厂）
   - `lib/state-store.js` 进程内共享状态（`callId → sessionId` + keyed state）
   - `plugins/genui-tools.js` 工具 + 两个提示词段落
   - `vendor/frame-page.html` 卡片内的宿主页（编译、沙箱、状态、高度）
   - `cordis.patch.yml` bundle 补丁（插件行 + preset）
5. `runtime/` —— vendored 的 DIL 编译器与浏览器运行时（沙箱安全审查需要）：
   `compiler/*`（词法/语法/代码生成）、`sandbox/frame.js` + `sandbox/worker.js`（沙箱文档与 Worker）、
   `public/dil/*`（renderer / sandbox 宿主 / 状态上报）。
6. `docs/交付说明.md` —— 交付说明（含两次故障复盘与体验优化记录）。
7. `tests/` —— 产生证据的脚本；`tests/generated/` 是浏览器真正跑过的探针页。

## 关键事实速览（供快速定位）

- 数据流：模型 `genui_render(source=<DIL 文档>)` → 宿主编译 → 卡片 iframe（frame 页）
  → `sandbox="allow-scripts"` 的 runner iframe（CSP `default-src 'none'`）→ blob Worker 执行
  → 元素树回传 → 宿主页 patch DOM → 交互状态 POST 回宿主 → 下一轮提示词段落。
- 模型代码**从不**在应用文档里执行；卡片只转发源码文本与状态。
- 插件与 OpenAI / ChatGPT **无任何网络连接**；编译器与运行时是本地 vendored 副本。
- 已知软肋（审查提示词第四节有完整列表，其中我认为最值得查的是第 4 条：
  `state-store.js` 的 `LATEST` 兜底可能把 A 会话的界面状态注入 B 会话的提示词）。

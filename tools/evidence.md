# 实测证据（原始输出，非结论摘要）

环境：Windows 11 · Node v24.15.0 · DSH 0.1.7-rc.2（Electron 桌面宿主，profile `desktop`）·
GUI `http://127.0.0.1:19387` · 浏览器用 Microsoft Edge（独立 profile，避免污染用户配置）。

> 所有命令都在 `E:\chat\dsh-genui` 下执行。浏览器类探针把结果 POST 回插件的
> `/genui-live2/view_state`，再用 `curl` 读回，因此证据是「真实浏览器里跑出来的 JSON」，
> 而不是人工描述。

## 1. 离线路由 / 编译 / 沙箱资源自检

`node tools/route-test.mjs`：

```
compile: ok, code bytes = 544 diagnostics = 0
compile(empty): rejected
frame.html bytes = 5768 · runner.html bytes = 32553
assets: served, traversal refused
view_state: round-tripped -> - root: {"plan":"pro","seats":12}

ALL ROUTE TESTS PASSED
```

（覆盖：DIL 编译、空源码拒绝、frame/runner/资源 200、`../` 穿越被拒、view_state 往返。）

## 2. 插件契约 + 提示词安全

`node tools/plugin-test.mjs`：

```
plugins/genui-tools.js: name=genui-tools inject=["tools","systemPrompt"] apply=function
lib/host.js: name=dsh-genui inject=["webServer"] apply=function
tool: genui_render | params: source,title | required: ["source"]
execute -> {"ok":true,"summary":"clean","message":"已渲染：界面已在对话中显示，用户可以直接交互。"}
execute(bad) -> {"ok":false,"message":"编译失败：界面未能渲染。请修正下列问题后重新提交完整文档。"}
sections: genui:mode@4, genui:state@60

prompt-variable check
  raw vendored dialect: fails as expected -> {{"chartType":"b…
  shipped genui:mode   : clean
  mode prompt bytes    : 5598 | includes dialect spec: true
  genui:state, hostile payload: clean
  empty state section: "## 当前界面状态..."

PROMPT SECTIONS SAFE
```

（负对照证明「原始 DIL 方言文本会触发 DSH 的 `malformed prompt variable reference`」，
即用户第一次试跑失败的真实原因；上线文本已清洗干净。）

## 3. 沙箱 runner 的 CSP 自检

`node tools/csp-check.mjs`：

```
CSP: default-src 'none'; script-src 'sha256-gwxZpFkWRS8JRs+C7QiXEDTrMMRfyEGblQ2WwREDGX4=' 'unsafe-eval'; worker-src blob: data:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'
pinned hash: gwxZpFkWRS8JRs+C7QiXEDTrMMRfyEGblQ2WwREDGX4=
inline scripts found: 1 | lengths: 12788
script[0] sha256-gwxZpFkWRS8JRs+C7QiXEDTrMMRfyEGblQ2WwREDGX4= <-- MATCHES CSP
template bytes: 30767 | worker-src in CSP: true
has unsafe-eval: true
frame-src none: true
```

## 4. 真实浏览器：卡片替身（编译 → 沙箱 → Worker → 渲染 → state 回环）

`tests/generated/_card-probe.html`（iframe 指向 frame 页，postMessage 送源码），读回
`GET /genui-live2/state?session_id=probe-metrics`：

```json
{"heights":[220,592],"elementCount":36,"frameScrollHeight":592,"iframeHeight":592,
 "clipped":0,"frameError":null,
 "lastLine":"... CARD {\"kind\":\"protocol\",\"entry\":{\"dir\":\"server→host\",\"kind\":\"view_state\",\"detail\":{\"updated_scopes\":1}}}"}
```

同一轮里 frame 页回传的关键消息序列（摘自 `probe-log`）：

```
CARD {"kind":"ready"}
CARD {"kind":"streaming","bytes":899,"compiledBytes":-1}
CARD {"kind":"compiled","ok":true,"bytes":899,"durationMs":9,"diagnostics":[],"diagnosticSummary":"clean"}
CARD {"kind":"protocol","entry":{"dir":"frame:diag","kind":"worker_create:returned","detail":{"transport":"blob"}}}
CARD {"kind":"protocol","entry":{"dir":"frame:diag","kind":"snapshot_forward:sent","detail":{"version":1,"reason":"initial","hasError":false}}}
CARD {"kind":"rendered","stats":{"version":1,"renderCount":1,"handlers":4,"states":2}}
CARD {"kind":"protocol","entry":{"dir":"frame→host","kind":"stateChanged","detail":{"keys":2}}}
```

宿主读到的 keyed state（同一次运行）：

```
- root: {"n":3,"plan":"pro"}
```

## 5. 真实浏览器：客户端半注册 + 流式半截参数

`tests/generated/_client-probe.html`（stub module loader + stub React，加载真实 bundle），
读回 `GET /genui-live2/state?session_id=client-probe`：

```json
{"lines":[
  "loader captured id=@local/dsh-live-ui2 factory=function",
  "exports: inject,apply,GenuiCard | inject=[\"slots\"]",
  "slots.inject tool.call.toolview",
  "registered slot=tool.call.toolview key=genui_render",
  "card root=div children=2",
  "iframe src=/genui-live2/frame.html sandbox=allow-scripts allow-same-origin",
  "header title=流式自检",
  "partial render ok, header title=流式自检"
 ],"ok":true,"slot":"tool.call.toolview","key":"genui_render"}
```

（最后一行是关键：只喂**半截 JSON**（截断在字符串中间）时卡片仍能解出 `source` 并渲染。）

## 6. 真实浏览器：真实卡片组件的回归（高度收敛）

`tests/generated/_card-component-probe.html` —— 极小 React shim（createElement/useState/useRef/useEffect）
+ 真实 iframe + 真实沙箱，把工具参数**分 4 段**流入后测量。读回
`GET /genui-live2/state?session_id=card-component`：

```json
{"ok":true,"slot":"tool.call.toolview","key":"genui_render",
 "iframeHeight":592,"frameScrollHeight":592,"clipped":0,
 "elementCount":36,"sandboxFrame":true,
 "status":"已渲染 0.9 KB · 0 ms","frameError":null}
```

日志行：`streamed 250 / 500 / 750 / 1000 bytes`，四次流式重渲染后高度仍等于内容高度。

## 7. 运行中宿主的 live 副本检查

`node tools/check-live-bundle.mjs`：

```
rev 5895769062c4 | HTTP 200 | bytes 11849
  PASS  streaming status (写作中)
  PASS  warm handshake
  PASS  timeline reporting
  PASS  height cap 8000
  PASS  slim bar (5px 10px)
```

## 8. 用户实测反馈（两次，均已复现并修复）

1. **第一次**：`malformed prompt variable reference at "{{"chartType":"b…" in section "genui:mode"`
   —— 根因是 vendored DIL 方言里的 `<Chart content={{…}}/>` 示例；已加 `sanitizePromptText()`，
   第 2 节的正/负对照断言就是这条的回归。
2. **第二次**：卡片仍被截断（截图里状态为 `已渲染 12.6 KB`）。
   —— 根因是卡片的消息监听 effect 依赖 `[source.length]`，每个流式分片都会退订再订阅，
   最后一条高度消息被丢；已改为只订阅一次 + 高度只增不减 + frame 1.2s 心跳 + 编译后主动 `measure`。
   第 6 节就是这条的回归。

## 9. 明确**没有**验证到的部分

- 真实 DSH 会话 DOM 里的卡片渲染：只用替身页与组件 harness 验证，未在真实会话中截图确认。
- 模型/中转是否真的流式下发 tool-call 参数：只有「字节数状态 + 时间线上报」作为观测手段。
- 宿主路由的认证/限流/体积上限：当前没有。
- 多会话并发、长跑内存增长、宿主重启后的状态恢复：未测。

# DSH 契约摘录（审查时的事实依据）

下面每一条都是从本机 DSH 0.1.7-rc.2 的实际代码/文档里摘出来的原文片段，
用来避免审查时把「DSH 的既有约定」误判成「插件的 bug」。

## 1. 客户端插件的声明与加载

`@linxin666/dsh-client-ui-skin-center/package.json`（真实已装插件，可作范本）：

```json
"type": "module",
"main": "lib/index.js",
"exports": { ".": "./lib/index.js", "./client": "./lib/client.js", "./package.json": "./package.json" },
"dsh": {
  "engines": { "dsh": ">=0.1.7-rc.1" },
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "inject": ["@deepseek-ai/dsh-client-ui-renderer", "..."], "platform": "web" }
}
```

`@deepseek-ai/dsh-client-modules/README.md`：

> A browser plugin package declares `dsh.client` in its `package.json` with `platform: 'web'`,
> exports a `./client` bundle, and lists any non-baseline module requests under `dsh.client.external`.
> The host half turns each declaration into a served bundle under `/plugins`, ordered so dynamic
> providers load before their consumers.
>
> The shell seeds a frozen module table (`PLATFORM_MODULES`: React, Cordis, and static UI libraries);
> every dynamic bundle resolves its externals against exactly that baseline.
>
> The host serves built client bundles, so `pnpm run build` must have produced each `lib/client.js`
> before launch.

## 2. 浏览器 bundle 的工厂格式（手写 bundle 必须遵守）

从真实 bundle（`dsh-client-ui-skin-center/lib/client.js`）开头：

```js
window.__ModuleLoader__.load({
  id: "@linxin666/dsh-client-ui-skin-center",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");
    // ... CSS 注入、组件、apply/inject
    exports.NS = NS; exports.apply = apply; exports.inject = inject;
    return module.exports;
  }
});
```

要点：**工厂只拿到 `require`**；`module`/`exports` 必须由 bundle 自己声明；
`id` 必须等于解析后的包名；`require` 只认平台种子表 + `dsh.client.external` 声明的模块。

## 3. `tool.call.toolview` 槽位与组件 props

`@deepseek-ai/dsh-client-ui-tool/README.md`：

> An owning business package registers its wire Tool name into `tool.call.toolview`:
>
> ```js
> ctx.slots.inject('tool.call.toolview', () =>
>   ctx.slots.register({ name: 'tool.call.toolview', key: '<wire tool name>' }, BusinessToolRow))
> ```
>
> The owner payload is `ToolCallOwnerProps`: `callId`, `toolName`, the `phase` discriminant and its
> frozen stage-specific `block`, optional `cwd` and `home`, the session-authorized `loadImage` loader,
> and plain `openFile`/`inspect` callbacks.
>
> The slot-injected `useToolCallArgumentsPartial` Hook lazily subscribes to the owning Step's
> `assistant-step` source and selects this callId's raw argument prefix. Missing sources or calls
> return an empty string.

子槽声明（`dsh-client-ui-tool/lib/client.js`，注册 `conversation.chat.node` 时）：

```js
children: { "tool.call.toolview": {
  kind: "keyed", scope: "session",
  inject: { hooks: { toolCallArgumentsPartial: bindToolCallArgumentsPartial } }
} }
```

Hook 绑定实现（同文件）：

```js
const bindToolCallArgumentsPartial = (_standard, context) => {
  const { assistant, callId } = context;
  const subscribe = assistant === void 0 ? subscribeEmpty : (listener) => assistant.subscribe(listener);
  const getSnapshot = () => {
    const block = assistant?.getSnapshot()?.blocks.find((c) => c.kind === "tool-call" && c.callId === callId);
    return block?.kind === "tool-call" ? block.argsRaw : "";
  };
  return function useToolCallArgumentsPartial() { return react.useSyncExternalStore(subscribe, getSnapshot); };
};
```

`hookContext` 只在 preparing 阶段带 `assistant`（`dsh-client-ui-tool/lib/client.js`）：

```js
const hookContext = react.useMemo(() => ({ callId, assistant: preparing ? assistant : void 0 }), [assistant, callId, preparing]);
```

组件在真实内置视图里的用法（同文件，`PreparingFileMutationRow`）：

```js
function PreparingFileMutationRow({ toolName, useDisclosure, useToolCallArgumentsPartial, t }) {
  const raw = useToolCallArgumentsPartial();
```

阶段映射与参数位置（同文件）：

```js
const argsRaw = done ? block.call?.argsRaw ?? "" : block.phase === "start" ? block.argsRaw : null;
if (!("kind" in block) && block.phase === "preparing") return null;   // 准备阶段没有 argsRaw
```

## 4. 宿主工具契约

`@deepseek-ai/dsh-tool-cordis/lib/types/api-catalog.js`（生成自 typert 的真实声明）：

```ts
export interface ToolSchema { deferLoading?: true; name: string; description: string; parameters: Record<string, unknown>; }
export interface ToolDefinition extends ToolSchema { readonly output: ToolOutputDefinition; execute(args: unknown, exec: ToolRunContext): Promise<unknown>; projectContent?(...): ContentBlock[]; }
export interface ToolExecution extends ToolExecutionInput { readonly rootCallId: ToolCallId; readonly token: ToolExecutionToken; }
export interface ToolRunContext extends ToolExecution { deferContext(context: UserMessage): void; concludeTurn(): void; }
```

## 5. webServer 路由匹配（前缀路由不能带尾斜杠）

`@deepseek-ai/dsh-host-webserver/lib/index.js`：

```js
/** Longest-prefix-wins over the prefix table after an exact-table miss. */
match(pathname) {
  ...
  for (const [prefix, route] of this.prefixes) {
    if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue;
    if (best === void 0 || prefix.length > best.path.length) best = route;
  }
}
```

注册形式（多个出厂插件的真实用法）：

```js
ctx.effect(() => ctx.webServer.register({ kind: "prefix", path: "/plugins", handler: this.serveBundle }), "...");
ctx.effect(() => ctx.webServer.register({ kind: "exact", path: "/oauth/callback", handler: (req, res) => {...} }), "...");
```

## 6. 提示词变量规则

`@deepseek-ai/dsh-system-prompt/lib/index.js`：

```js
const GROUP_AT = /^\{\{([^{}]*)\}\}/;
...
if (text.indexOf("{{", last)) {
  const group = GROUP_AT.exec(text.slice(open));
  if (group === null) {
    if (text.indexOf("}}", open + 2) >= 0) throw new Error(`malformed prompt variable reference at "${text.slice(open, open + 16)}…" in ${kind} "${input.name}" (references are complete simple {{name}} groups)`);
    result += text.slice(last, open + 2); last = open + 2; continue;
  }
  ...
}
```

## 7. 连接层认证与 `/api` 前缀

`@deepseek-ai/dsh-client-connection/README.md`：

> Every Host RPC method and WebSocket stream requires one browser session; there is no
> method-specific loopback tier. Each process mints a random launch token. `dsh-web-app` prints and
> opens its application URL with `?token=...`; `frontend-static` delegates root and index requests to
> `ctx.connection.authorizeIndex`, which accepts that token only on `GET /`, writes an
> authority-bound signed cookie, and redirects to clean `./`... A missing, expired, malformed, or
> wrong-authority cookie returns 401 before RPC dispatch. **Static assets remain public.**
>
> Before authentication, every request still passes `src/api-request-trust.ts`. Its `Host` must be
> loopback or match a `trustedHosts` entry ... An attached `Origin` must equal that Host and
> `sec-fetch-site: cross-site` is refused.

（即：插件自己的 `ctx.webServer.register` 路由**默认不走**这套准入，除非自己调用
`ctx.connection.requestRejection(req)`；`/api` 前缀由连接层占用。）

## 8. 沙箱 runner 的 CSP（vendored，非 DSH 提供）

`vendor/sandbox/frame.js` 生成 `/genui/runner.html`：

```
default-src 'none'; script-src 'sha256-<inline script hash>' 'unsafe-eval'; worker-src blob: data:;
base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'
```

外层 iframe（`vendor/public/dil/sandbox.js`）：

```js
const frame = document.createElement('iframe');
frame.src = this.frameUrl;
// no allow-same-origin: the frame gets an opaque origin (the real runner's requests carry `Origin: null`)
frame.setAttribute('sandbox', 'allow-scripts');
frame.setAttribute('referrerpolicy', 'no-referrer');
```

## 9. 宿主模块缓存（为什么改代码要换文件名 / 要重启）

本机 `E:\chat\chat-preset\cordis.patch.yml` 的实测注记（用户先前踩过）：

> 文件名带版本号是必须的，不是洁癖：DSH 的插件加载器用 ESM `import()`，模块缓存**按 URL 命中**。
> 原地改这个文件的内容，跑在宿主进程不会重新加载（本机实测：改了四版、toggle 了 bundle 四次，
> 跑的一直是第一版）。改动这个文件后必须换文件名。

`dsh-client-modules/README.md` 补充：客户端 bundle 由 HMR 按 `mtimeMs/ctimeMs/size` 推导 revision，
浏览器按新 URL 重新拉取；**宿主半**没有等价机制。

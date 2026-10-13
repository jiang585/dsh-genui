# 第三方代码来源与许可（THIRD-PARTY）

本仓库的 `vendor/` 目录不是原创实现，而是把公开研究项目的实现**本地化 vendored** 进来的副本，
用于让插件零运行时依赖地编译与渲染 DIL 界面。原始实现遵循 MIT 许可，署名与许可原文见
`vendor/LICENSE-intelligent-ui-demo`。

## 上游项目

| 项目 | 链接 | 许可 |
|---|---|---|
| intelligent-ui-demo（ChatGPT Intelligent UI 的协议拆解与复刻实现） | https://github.com/Disdjj/intelligent-ui-demo | MIT，Copyright (c) 2026 DJJ |

## 逐目录对应关系

| 本仓库路径 | 上游路径 | 改动 |
|---|---|---|
| `vendor/compiler/**` | `replica/server/compiler/**` | 改为 CommonJS 打包形态、收敛导出；DIL 文法与代码生成逻辑未改写 |
| `vendor/sandbox/frame.js` | `replica/server/sandbox/frame.js` | 生成 runner 文档时把资源路径改写到本插件的挂载前缀；CSP 与 opaque origin 策略保持 |
| `vendor/sandbox/worker.js` | `replica/sandbox/worker.js` | 保留 Worker 侧执行与元素树回传协议 |
| `vendor/public/dil/**` | `replica/public/dil/**` | 资源路径改写为插件挂载前缀；`dil.css` 做了主题/深色模式/焦点态与排版调整；`view-state.js`、`message-view.js` 增加编译版本防乱序与状态串行上报 |
| `vendor/agent/system-prompt.js` | `artifacts/genui-source.dil.md` 等产物整理的方言说明 | 重新组织为模型可读的 DIL 方言规范 |

## 本仓库原创部分

`lib/**`、`plugins/**`、`vendor/frame-page.html`、`cordis.patch.yml`、`tools/**` 为本项目原创
（`vendor/frame-page.html` 参考了上游 `replica/public/embed.html` 的消息协议，但页面结构、
测量、心跳与错误栏均为本项目实现）。

## 再分发要求

再分发本仓库时请保留：

1. 本文件 `vendor/THIRD-PARTY.md`；
2. `vendor/LICENSE-intelligent-ui-demo`（上游 MIT 许可原文与版权声明）；
3. 根目录 `LICENSE`（本项目 MIT 许可）。

MIT 许可允许修改与再分发，但要求保留版权声明与许可文本；上游与本项目均不提供任何担保。

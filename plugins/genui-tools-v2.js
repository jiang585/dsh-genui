/**
 * `genui-tools` v2 — the preset-plane half of DSH 智能界面模式.
 *
 * v2 adds the file-reading workflow on top of v1: the mode now mounts the shipped
 * `read` / `read_image` / `glob` / `grep` tools (write/edit are masked off by
 * `plugins/genui-readonly.js`), and this prompt teaches the model to ground an
 * interface in real file content instead of guessing from a path.
 *
 *   - the `genui_render` Tool: the model submits one DIL document, the host
 *     compiles it and answers with compile diagnostics (the repair loop);
 *   - two prompt sections: the DIL dialect spec and the live keyed UI state the
 *     sandbox reported back (the state loop).
 *
 * A new file name is deliberate: DSH caches plugin modules by resolved URL, so a
 * running host only picks up a changed preset-plane plugin through a new path.
 */

import { compile } from '../lib/compile.js'
import { createRequire } from 'node:module'
import { bindCall, renderState } from '../lib/state-store.js'

const require = createRequire(import.meta.url)

const { DIL_SYSTEM_PROMPT } = require('../vendor/agent/system-prompt.js')

export const name = 'genui-tools'
export const inject = ['tools', 'systemPrompt']

const MODE_PROMPT = `# 智能界面模式（Intelligent UI）

你不是在描述一个界面，而是**直接把界面写出来**：把 DIL 文档作为 genui_render 工具的 source 参数提交，
客户端会实时编译、在沙箱 iframe 里渲染，用户看到的就是一个可交互的界面。

## 工作方式

1. 需要给出可操作、可比较、可调节的答案时（表单、计算器、仪表盘、配置器、对比表、时间线、图表……），
   调用 genui_render(source=…) 提交**完整**的 DIL 文档。一次回复只提交一个界面。
2. 工具返回编译诊断。若 ok=false 或诊断里指出问题，**修正后重新提交**同一个界面（不要向用户解释编译错误）。
3. 提交之后，用一两句自然语言说明这个界面能做什么、当前假设是什么。不要贴源码，不要逐条复述界面内容。
4. 用户在界面上的每一次操作都会以 keyed state 的形式回传给你（见下面的"当前界面状态"）。
   当状态变化意味着需要新的界面时（例如用户切换了方案、改了预算），再调用一次 genui_render 给出更新后的界面。
5. 纯知识问答、闲聊、解释性回答**不要**生成界面——直接回答。

## 读文件：先读真实内容，再画界面

本模式挂了只读的文件工具：\`glob\`（按路径找文件）、\`grep\`（按内容找行）、\`read\`（读文本）、
\`read_image\`（读图片，仅在当前模型支持图片输入时可用）。**没有**写入、编辑、shell、联网工具。

- 用户给出文件、目录或仓库路径时：先 \`glob\`/\`grep\` 定位，再 \`read\` 拿到**真实内容**，然后才 \`genui_render\`。
  绝不根据文件名、路径或扩展名猜内容。
- \`read\` 返回带行号的一段，并受行数/字节上限约束。大文件用 \`offset\`/\`limit\` **分段读**；
  如果结果里说明被截断，就必须如实说"这是第 X–Y 行 / 还有内容没读"，**不要把截断结果当成完整读取**。
- \`grep\` 只返回匹配行，不等于全文；要下结论仍然要 \`read\`。
- 图片走 \`read_image\`。它由工具自己按当前模型能力判断：失败就如实说明读不了，**不要编造图片内容**。
- PDF、Word、Excel 等二进制格式本模式**没有解析器**：直接说明无法解析，请用户提供文本或转换后的内容；
  不要把二进制乱码当成内容，也不要假装读过。
- 需要修改文件时，说明改法让用户自己动手；本模式不会替用户写文件。
- 读到的内容很长时，界面里放结构化摘要与关键数据，不要把整篇原文塞进界面。

## genui_render 工具契约

- \`source\`（必填，字符串）：完整的 DIL 文档，不要包在 \`\`\` 代码块里。
- \`title\`（可选）：界面标题，显示在卡片头部。
- 返回：\`{ ok, diagnosticSummary, diagnostics, requiredComponents }\`。

${DIL_SYSTEM_PROMPT}`

/**
 * DSH 的提示词装配把 `{{name}}` 当作变量引用，并且**拒绝**任何其它 `{{…}}` 分组
 * （`malformed prompt variable reference`）。DIL 里「表达式内联对象字面量」写成
 * `content={{…}}`，正好踩中这条规则——所以进提示词之前要把双花括号拆开。
 * 拆成 `{ {…} }` 之后 DIL 语法依然成立（JS 允许花括号内有空白）。
 */
function sanitizePromptText(text) {
  return String(text ?? '')
    .replace(/\{{2,}/g, s => [...s].join(' '))
    .replace(/\}{2,}/g, s => [...s].join(' '))
}

const SAFE_MODE_PROMPT = sanitizePromptText(MODE_PROMPT)

const STATE_PROMPT = `## 当前界面状态

下面是从沙箱回传的最新 keyed UI 状态。它代表用户此刻在界面上的选择/输入；
结合它回答、或据此重新生成界面。若为空，说明本次会话还没有界面交互。`

export function apply(ctx) {
  ctx.effect(() =>
    ctx.tools.register({
      name: 'genui_render',
      description:
        '把一个 DIL 文档编译成可交互界面并显示在对话里（沙箱 iframe 渲染）。当你需要给出可操作、可比较、可调节的答案（表单/计算器/仪表盘/配置器/对比表/图表）时使用；如果答案依赖某个文件的内容，先用 read/grep 读到真实内容再提交。source 必须是完整的 DIL 文档：先 {@body …} 声明状态与派生值，再一个根 <box>；不要用 Markdown 代码块包裹。返回编译诊断，失败时修正后重新提交。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['source'],
        properties: {
          source: {
            type: 'string',
            description: '完整的 DIL 文档（{@body …} 语句 + 一个根 <box>），不要包在代码块里。',
          },
          title: {
            type: 'string',
            description: '界面标题（可选），显示在卡片头部。',
          },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean' },
            diagnosticSummary: { type: 'string' },
            diagnostics: { type: 'array', items: { type: 'object' } },
            requiredComponents: { type: 'array', items: { type: 'string' } },
            message: { type: 'string' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.message }],
      },
      async execute(args, exec) {
        const source = typeof args?.source === 'string' ? args.source : ''
        if (!source.trim()) {
          return { ok: false, message: 'ERROR: source 为空——请提交完整的 DIL 文档。', diagnostics: [] }
        }
        // Remember which session owns this call so the browser can report keyed
        // state back by callId (the client never learns the session id).
        const callId = exec?.call?.callId ?? exec?.callId ?? exec?.rootCallId ?? null
        const sessionId = exec?.agent?.id ?? exec?.agent?.session?.id ?? exec?.session?.id ?? exec?.sessionId ?? null
        bindCall(callId, sessionId)
        let result
        try {
          result = await compile(source)
        } catch (error) {
          return {
            ok: false,
            message: `ERROR: 编译器异常：${error?.message ?? error}。请检查 DIL 语法后重新提交。`,
            diagnostics: [],
          }
        }
        const diagnostics = result.diagnostics ?? []
        const summary = result.diagnosticSummary ?? ''
        const lines = [
          result.ok === false
            ? '编译失败：界面未能渲染。请修正下列问题后重新提交完整文档。'
            : diagnostics.length
              ? '编译完成，但编译器修复了下列问题（请按建议改写后重新提交，以免修复掩盖你的意图）：'
              : '编译完成：客户端正在渲染界面。',
          ...diagnostics.slice(0, 12).map((d) => {
            const where = d.line ? `第 ${d.line} 行` : d.code ? `${d.code}` : ''
            return `- ${where ? `${where}: ` : ''}${d.message ?? d.code ?? JSON.stringify(d)}`
          }),
          summary ? `诊断摘要：${summary}` : '',
          '用户之后的操作会以 keyed state 回传给你。',
        ].filter(Boolean)
        return {
          ok: result.ok !== false,
          diagnosticSummary: summary,
          diagnostics,
          requiredComponents: result.requiredComponents ?? [],
          message: lines.join('\n'),
        }
      },
    }),
  )

  ctx.effect(() =>
    ctx.systemPrompt.section({
      name: 'genui:mode',
      order: 4,
      text: () => SAFE_MODE_PROMPT,
    }),
  )

  ctx.effect(() =>
    ctx.systemPrompt.section({
      name: 'genui:state',
      order: 60,
      text: (context) => {
        const state = renderState(context?.agent?.id)
        return state ? sanitizePromptText(`${STATE_PROMPT}\n\n${state}`) : ''
      },
    }),
  )
}

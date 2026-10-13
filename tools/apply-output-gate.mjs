/**
 * Insert (or refresh) the 「输出闸门」 memory inside the mode's persona prefix.
 *
 * The persona is a *config* value in the bundle patch, so it is read at boot and
 * applies to every new session of that mode — no module-cache problem, unlike
 * plugin code.
 *
 *   node tools/apply-output-gate.mjs            # main + live2
 *   node tools/apply-output-gate.mjs --check    # verify only, no write
 */
import fs from 'node:fs'

const TARGETS = [
  { file: 'E:/chat/dsh-genui/cordis.patch.yml', label: 'main (genui)' },
  { file: 'E:/chat/dsh-genui-live2/cordis.patch.yml', label: 'live2 (genui-live2)' },
]

const GATE_START = '【输出闸门：要展示的一切都必须走 genui_render（硬规则）】'
const GATE_END = '【输出闸门 结束】'

const GATE = [
  GATE_START,
  '',
  '唯一出口：任何要给用户「看」的东西——面板、表单、卡片、图表、对比表、清单、进度、',
  '计算器，以及**可复制的文本块**——只能通过 genui_render(source=完整 DIL 文档, title=标题)',
  '呈现。回复正文里永远不允许出现 DIL 源码。',
  '',
  '正文里禁止出现的特征（命中任意一条即违规，必须改成工具调用）：',
  '- {@body',
  '- DIL.useState 或任何以 DIL. 开头的调用',
  '- <box <row <grid <text <table <Chart 等 DIL 标签',
  '- 任何包含上述内容的代码块（``` 围栏）',
  '- 「下面这张面板/界面本体是…」这类开场白后面直接跟源码',
  '',
  '发送前自检：提交回复前扫一遍正文；命中上面任何一条就立刻停手，把整段内容原样放进',
  'genui_render 的 source，正文只留一两句说明。',
  '',
  '为什么：DIL 只有在工具调用的 source 里才会被客户端编译、在沙箱 iframe 里渲染成可交互',
  '界面；写在正文里对用户只是一堆死文本，等于这件事没做。',
  '',
  '用户要「文本」时同样成立：用户要「一段可复制的提示词 / 一段话 / 一份文案」时，也要用',
  '界面承载它——把文本放进界面里的 <text> 或可复制区域（配一个复制按钮），正文只写一两句。',
  '绝不能因为「用户要的是文本」就把内容或 DIL 贴进正文。',
  '',
  '工具返回失败时：读诊断 → 修正 → 重新提交同一个界面。不要用「把源码贴给用户自己贴进',
  '工具」当退路，也不要在正文里解释编译错误。',
  '',
  '最后自查：这条回复如果被原样复制到别处，用户能不能看到一个能点的界面？不能 → 说明',
  '我漏了工具调用。',
  '',
  GATE_END,
]

/** Find the persona prefix literal block: [prefixLine, contentStart, contentEnd). */
function findPrefixBlock(lines) {
  const personaAt = lines.findIndex((line) => /^\s*- id: persona\s*$/.test(line))
  if (personaAt < 0) throw new Error('persona row not found')
  const prefixAt = lines.findIndex((line, index) => index > personaAt && /^\s*prefix: \|\s*$/.test(line))
  if (prefixAt < 0) throw new Error('persona prefix block not found')
  const prefixIndent = lines[prefixAt].match(/^\s*/)[0].length

  let end = prefixAt + 1
  let contentIndent = null
  while (end < lines.length) {
    const line = lines[end]
    if (line.trim() === '') {
      // A blank line stays inside the block only when deeper content follows.
      let next = end + 1
      while (next < lines.length && lines[next].trim() === '') next += 1
      if (next >= lines.length) break
      const nextIndent = lines[next].match(/^\s*/)[0].length
      if (nextIndent <= prefixIndent) break
      end += 1
      continue
    }
    const indent = line.match(/^\s*/)[0].length
    if (indent <= prefixIndent) break
    if (contentIndent === null) contentIndent = indent
    end += 1
  }
  if (contentIndent === null) throw new Error('persona prefix block is empty')
  return { prefixAt, contentStart: prefixAt + 1, contentEnd: end, contentIndent }
}

function renderGate(indent) {
  const pad = ' '.repeat(indent)
  return GATE.map((line) => (line === '' ? '' : pad + line))
}

function applyTo(file, check) {
  const original = fs.readFileSync(file, 'utf8')
  const lines = original.split('\n')
  const block = findPrefixBlock(lines)

  // Rebuild the block deterministically: keep its non-gate content, trim trailing
  // blank lines, then append exactly one blank line plus the gate. This makes the
  // operation idempotent (re-running produces byte-identical output).
  const kept = []
  let skipping = false
  for (let index = block.contentStart; index < block.contentEnd; index += 1) {
    const line = lines[index]
    if (line.includes(GATE_START)) { skipping = true; continue }
    if (skipping) {
      if (line.includes(GATE_END)) skipping = false
      continue
    }
    kept.push(line)
  }
  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop()

  const rebuilt = [...kept, '', ...renderGate(block.contentIndent)]
  lines.splice(block.contentStart, block.contentEnd - block.contentStart, ...rebuilt)

  const next = lines.join('\n')
  const present = next.includes(GATE_START) && next.includes(GATE_END)
  const changed = next !== original
  if (!check && changed) fs.writeFileSync(file, next, 'utf8')
  if (changed && process.argv.includes('--diff')) {
    const before = original.split('\n')
    const after = next.split('\n')
    for (let i = 0; i < Math.max(before.length, after.length); i += 1) {
      if (before[i] !== after[i]) {
        console.log(`  first diff at line ${i + 1}:`)
        console.log(`    - ${JSON.stringify(before[i])}`)
        console.log(`    + ${JSON.stringify(after[i])}`)
        break
      }
    }
  }
  console.log(
    `${changed ? (check ? 'WOULD CHANGE' : 'updated') : 'unchanged'}  ${file}  (gate present: ${present}, indent: ${block.contentIndent})`,
  )
  return { changed, present }
}

const check = process.argv.includes('--check')
for (const { file, label } of TARGETS) {
  if (!fs.existsSync(file)) { console.log('missing', file); continue }
  const result = applyTo(file, check)
  console.log(`  -> ${label}: gate=${result.present}`)
}

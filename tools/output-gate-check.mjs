/**
 * Verify the 「输出闸门」 memory: it must live inside the mode's persona prefix,
 * survive DSH's prompt-variable rule, and be identical in both copies.
 *
 *   node tools/output-gate-check.mjs
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('file:///C:/Users/HP/.dsh/profiles/desktop/node_modules/')
const YAML = require('yaml')

/** The exact rule DSH applies to every prompt section / persona text. */
const GROUP_AT = /^\{\{([^{}]*)\}\}/
function findMalformedReference(text) {
  let last = 0
  for (;;) {
    const open = text.indexOf('{{', last)
    if (open < 0) return null
    const group = GROUP_AT.exec(text.slice(open))
    if (group === null) {
      if (text.indexOf('}}', open + 2) >= 0) return text.slice(open, open + 16)
      last = open + 2
      continue
    }
    last = open + group[0].length
  }
}

const FILES = [
  ['E:/chat/dsh-genui/cordis.patch.yml', 'main'],
  ['E:/chat/dsh-genui-live2/cordis.patch.yml', 'live2'],
]

const NEEDLES = [
  '【输出闸门：要展示的一切都必须走 genui_render（硬规则）】',
  '{@body',
  'DIL.useState',
  '<box <row <grid',
  '用户要「文本」时同样成立',
  '发送前自检',
  '【输出闸门 结束】',
]

let failures = 0
const prefixes = []

for (const [file, label] of FILES) {
  const doc = YAML.parse(fs.readFileSync(file, 'utf8'))
  const inserted = doc.find((row) => row?.insert)?.insert ?? []
  const presetRow = inserted.find((row) => row?.name === '@deepseek-ai/dsh-agent-preset')
  if (!presetRow) { console.log(`FAIL ${label}: preset row not found`); failures += 1; continue }

  const personaRow = presetRow.config.plugins.find((row) => row.id === 'persona')
  const prefix = personaRow?.config?.prefix ?? ''
  prefixes.push(prefix)

  const missing = NEEDLES.filter((needle) => !prefix.includes(needle))
  const malformed = findMalformedReference(prefix)
  const pluginIds = presetRow.config.plugins.map((row) => row.id).join(', ')

  console.log(`=== ${label} (${presetRow.config.id} / ${presetRow.config.name}) ===`)
  console.log(`  persona bytes: ${prefix.length} | plugin rows: ${pluginIds}`)
  console.log(`  gate block present: ${missing.length === 0 ? 'yes' : `MISSING ${missing.join(' | ')}`}`)
  console.log(`  prompt-variable rule: ${malformed === null ? 'clean' : `MALFORMED at "${malformed}"`}`)
  console.log(`  variables used: ${[...prefix.matchAll(/\{\{([^{}]*)\}\}/g)].map((m) => m[0]).join(' ')}`)

  if (missing.length > 0 || malformed !== null) failures += 1
}

if (prefixes.length === 2) {
  const sameGate = FILES.map(([file]) => {
    const text = fs.readFileSync(file, 'utf8')
    return text.slice(text.indexOf('【输出闸门'), text.indexOf('【输出闸门 结束】') + '【输出闸门 结束】'.length)
  })
  console.log(`\ngate text identical in both copies: ${sameGate[0] === sameGate[1]}`)
  if (sameGate[0] !== sameGate[1]) failures += 1
}

console.log(failures === 0 ? '\nOUTPUT GATE OK' : `\nOUTPUT GATE FAILURES: ${failures}`)
process.exitCode = failures === 0 ? 0 : 1

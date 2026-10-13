/**
 * Point the live profile's default agent preset at a chosen mode (or remove the
 * override again).
 *
 *   node tools/set-default-preset.mjs genui-live2
 *   node tools/set-default-preset.mjs --clear
 *
 * This is a verification aid, not part of the deliverable: it lets a new session
 * open in 智能界面模式（可用） without driving the mode dropdown, and it doubles as
 * a live check that the profile patch is reconciled into the running Loader tree.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PROFILE_PATCH = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'cordis.patch.yml')
const BEGIN = '# ── 验证用默认模式覆盖 BEGIN（tools/set-default-preset.mjs）──'
const END = '# ── 验证用默认模式覆盖 END ──'

const arg = process.argv[2]
if (!arg) { console.error('usage: node tools/set-default-preset.mjs <presetId> | --clear'); process.exit(1) }

let text = fs.readFileSync(PROFILE_PATCH, 'utf8')

// Drop any previous block first, so the operation is idempotent.
const begin = text.indexOf(BEGIN)
if (begin >= 0) {
  const end = text.indexOf(END)
  if (end < 0) throw new Error('override BEGIN without END')
  text = text.slice(0, begin).replace(/\s+$/, '\n') + text.slice(end + END.length + 1)
  console.log('removed previous default-preset override')
}

if (arg !== '--clear') {
  const block = [
    '',
    BEGIN,
    `# 临时把新会话的默认模式设为 ${arg}，仅用于本次验证；用 --clear 撤销。`,
    '- id: agent-preset-registry',
    "  name: '@deepseek-ai/dsh-agent-preset-registry'",
    '  config:',
    `    default: ${arg}`,
    END,
    '',
  ].join('\n')
  text = text.replace(/\s+$/, '\n') + block
  console.log(`default preset override -> ${arg}`)
} else {
  console.log('default preset override cleared')
}

fs.writeFileSync(PROFILE_PATCH, text.replace(/\s+$/, '\n'), 'utf8')

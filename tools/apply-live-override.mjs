/**
 * Append (or refresh) a profile-patch override for the live 智能界面模式 preset.
 *
 * The running host reconciles profile patches into the Loader tree, so an
 * id-targeted row here replaces the bundle's preset config without a restart.
 * The row body is extracted from the live copy's own patch, so the two can never
 * drift apart by transcription.
 *
 *   node tools/apply-live-override.mjs [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const dry = process.argv.includes('--dry')
const PROFILE_PATCH = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'cordis.patch.yml')
const LIVE_PATCH = 'E:/chat/dsh-genui-live2/cordis.patch.yml'
const ROW_ID = 'preset-genui-live2'
const BEGIN = '# ── 智能界面模式（可用）只读文件面覆盖 BEGIN（由 tools/apply-live-override.mjs 生成）──'
const END = '# ── 智能界面模式（可用）只读文件面覆盖 END ──'

/** Pull one `- id: <rowId>` block out of a patch file and dedent it to top level. */
function extractRow(text, rowId) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => new RegExp(`^\\s*- id: ${rowId}\\s*$`).test(line))
  if (start < 0) throw new Error(`row ${rowId} not found in ${LIVE_PATCH}`)
  const indent = lines[start].match(/^\s*/)[0].length

  // The row ends at the next non-blank line that is indented no deeper than the
  // row itself (a sibling row or the end of the enclosing insert block).
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '') continue
    const depth = line.match(/^\s*/)[0].length
    if (depth <= indent) { end = index; break }
  }

  const block = lines.slice(start, end)
  return block.map((line) => line.slice(indent)).join('\n').replace(/\s+$/, '')
}

const liveText = fs.readFileSync(LIVE_PATCH, 'utf8')
const row = extractRow(liveText, ROW_ID)

const header = [
  '',
  BEGIN,
  '# 说明：这是运行中宿主的生效路径。profile patch 会被 reconcile 进 Loader 树，',
  '# 同 id 的行覆盖 bundle 里那一行，因此无需重启即可让「智能界面模式（可用）」',
  '# 拿到 read/read_image/glob/grep 只读文件面（write/edit 由 genui-readonly 摘掉）。',
  '# 重启后 bundle 自身的 patch 也是同一份内容，覆盖行保持等价。',
  '',
]
const block = `${header.join('\n')}${row}\n${END}\n`

let profileText = fs.readFileSync(PROFILE_PATCH, 'utf8')
const existing = profileText.indexOf(BEGIN)
if (existing >= 0) {
  const end = profileText.indexOf(END)
  if (end < 0) throw new Error('override BEGIN without END — fix the profile patch by hand')
  profileText = profileText.slice(0, existing).replace(/\s+$/, '\n') + profileText.slice(end + END.length + 1)
  console.log('removed previous override block')
}
const next = profileText.replace(/\s+$/, '\n') + block

if (dry) {
  console.log('--- would append ---')
  console.log(block)
} else {
  fs.writeFileSync(PROFILE_PATCH, next, 'utf8')
  console.log('appended override row to', PROFILE_PATCH)
  console.log(block.split('\n').slice(0, 12).join('\n'))
  console.log(`... (${block.split('\n').length} lines total)`)
}

/**
 * Sync the read-only file-access change from the canonical plugin into a live
 * copy, preserving that copy's identity (package name, row ids, preset id,
 * mount path) exactly as `tools/make-live-variant.mjs` established it.
 *
 *   node tools/sync-live2-read.mjs [copyDir] [package] [presetId] [label]
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'E:/chat/dsh-genui'
const DST = process.argv[2] ?? 'E:/chat/dsh-genui-live2'
const PKG = process.argv[3] ?? '@local/dsh-live-ui2'
const PRESET = process.argv[4] ?? 'genui-live2'
const LABEL = process.argv[5] ?? '智能界面模式（可用）'

// 1. new preset-plane plugin files (new URLs: the host caches modules by URL)
for (const rel of ['plugins/genui-readonly.js', 'plugins/genui-tools-v2.js']) {
  const from = path.join(SRC, rel)
  const to = path.join(DST, rel)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log('copied', rel)
}

// 2. the bundle patch, rewritten to this copy's identity
{
  let text = fs.readFileSync(path.join(SRC, 'cordis.patch.yml'), 'utf8')
  // Both the bundle row name and the subpath specifiers (`dsh-genui/plugins/…`)
  // carry the package identity, so one prefix rewrite covers them all.
  text = text.replaceAll('dsh-genui', PKG)
  text = text.replace(/^(\s*- )id: ui-genui-v2$/m, `$1id: ui-genui-${PRESET.replace('genui-', '')}`)
  text = text.replace(/^(\s*- )id: preset-genui-v2$/m, `$1id: preset-${PRESET}`)
  text = text.replace(/^(\s*)id: genui$/m, `$1id: ${PRESET}`)
  text = text.replace(/^(\s*)name: 智能界面模式$/m, `$1name: ${LABEL}`)
  fs.writeFileSync(path.join(DST, 'cordis.patch.yml'), text, 'utf8')
  console.log('rewrote cordis.patch.yml for', PKG, '/ preset', PRESET)
}

// 3. report the identity lines so a human can eyeball them
const patch = fs.readFileSync(path.join(DST, 'cordis.patch.yml'), 'utf8')
for (const line of patch.split('\n')) {
  if (/id: (ui-genui|preset-genui|genui)|name: '@local|name: 智能界面模式|plugins\/genui/.test(line)) console.log('  ', line.trim())
}

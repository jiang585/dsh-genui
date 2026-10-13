/**
 * Build a byte-fresh "live" copy of the plugin under a new package name, entry
 * path, mount path and preset id.
 *
 * Why: the DSH host caches plugin modules (and prompt sections) per resolved file
 * URL for the life of the process, so a fix cannot reach a *running* host by
 * editing the same file. A fresh copy with unique ids activates live, which is
 * how changes get verified (and used) without restarting DSH.
 *
 *   node tools/make-live-variant.mjs [dir] [package] [mount] [presetId] [label]
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'E:/chat/dsh-genui'
const DST = process.argv[2] ?? 'E:/chat/dsh-genui-live'
const PKG = process.argv[3] ?? '@local/dsh-live-ui'
const MOUNT = process.argv[4] ?? '/genui-live'
const PRESET = process.argv[5] ?? 'genui-live'
const LABEL = process.argv[6] ?? '智能界面模式（live 验证）'

const slug = MOUNT.replace(/^\//, '')
const ROW_HOST = `ui-${slug}`
const ROW_PRESET = `preset-${slug}`

fs.rmSync(DST, { recursive: true, force: true })
fs.cpSync(SRC, DST, {
  recursive: true,
  filter: (src) => !src.includes(`${path.sep}tools`) && !src.includes('node_modules') && !src.includes(`${path.sep}.git`),
})

const dstUrl = `file:///${DST.replace(/^\/+/, '')}`
const edit = (rel, pairs) => {
  const p = path.join(DST, rel)
  let text = fs.readFileSync(p, 'utf8')
  for (const [from, to] of pairs) text = text.replaceAll(from, to)
  fs.writeFileSync(p, text, 'utf8')
}

{
  const pkg = JSON.parse(fs.readFileSync(path.join(DST, 'package.json'), 'utf8'))
  pkg.name = PKG
  pkg.description = `[live 验证副本] ${pkg.description}`
  fs.writeFileSync(path.join(DST, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8')
}

edit('lib/host.js', [
  ["const MOUNT = '/genui'", `const MOUNT = '${MOUNT}'`],
  ["const PREFIX = '/genui/'", `const PREFIX = '${MOUNT}/'`],
])

edit('lib/client.js', [
  ['dsh-genui', PKG],
  ["const FRAME_URL = '/genui/frame.html'", `const FRAME_URL = '${MOUNT}/frame.html'`],
])

for (const rel of [
  'vendor/frame-page.html',
  'vendor/public/dil/embed.js',
  'vendor/public/dil/message-view.js',
  'vendor/public/dil/sandbox.js',
  'vendor/public/dil/view-state.js',
]) {
  edit(rel, [['/genui/', `${MOUNT}/`]])
}

{
  const p = path.join(DST, 'cordis.patch.yml')
  let text = fs.readFileSync(p, 'utf8')
  text = text.replace('dsh-genui', PKG)
  text = text.replace('ui-genui-v2', ROW_HOST).replace('preset-genui-v2', ROW_PRESET)
  text = text.replace('file:///E:/chat/dsh-genui/plugins/genui-tools.js', `${dstUrl}/plugins/genui-tools.js`)
  text = text.replace('        id: genui\n', `        id: ${PRESET}\n`)
  text = text.replace('        name: 智能界面模式\n', `        name: ${LABEL}\n`)
  fs.writeFileSync(p, text, 'utf8')
}

console.log(`live variant -> ${DST}`)
console.log(`  package ${PKG} | mount ${MOUNT} | preset ${PRESET} (${LABEL})`)
console.log(`  rows ${ROW_HOST} / ${ROW_PRESET} | tools ${dstUrl}/plugins/genui-tools.js`)

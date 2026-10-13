/**
 * Sync the two browser-facing files from the canonical plugin into a live copy,
 * re-applying that copy's id/mount substitutions. The client bundle and the frame
 * page are served from disk, so a page refresh is enough — no reinstall.
 *
 *   node tools/sync-live-copy.mjs <copyDir> <package> <mount>
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'E:/chat/dsh-genui'
const DST = process.argv[2] ?? 'E:/chat/dsh-genui-live2'
const PKG = process.argv[3] ?? '@local/dsh-live-ui2'
const MOUNT = process.argv[4] ?? '/genui-live2'

const files = [
  ['lib/client.js', [['dsh-genui', PKG], ["const FRAME_URL = '/genui/frame.html'", `const FRAME_URL = '${MOUNT}/frame.html'`]]],
  ['vendor/frame-page.html', [['/genui/', `${MOUNT}/`]]],
  ['vendor/public/dil/message-view.js', [['/genui/', `${MOUNT}/`]]],
  ['vendor/public/dil/sandbox.js', [['/genui/', `${MOUNT}/`]]],
  ['vendor/public/dil/embed.js', [['/genui/', `${MOUNT}/`]]],
  ['vendor/public/dil/view-state.js', [['/genui/', `${MOUNT}/`]]],
  ['plugins/genui-tools.js', []],
]

for (const [rel, pairs] of files) {
  const from = path.join(SRC, rel)
  const to = path.join(DST, rel)
  if (!fs.existsSync(from)) { console.log('missing source', rel); continue }
  let text = fs.readFileSync(from, 'utf8')
  for (const [a, b] of pairs) text = text.replaceAll(a, b)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.writeFileSync(to, text, 'utf8')
  console.log('synced', rel, '->', DST)
}

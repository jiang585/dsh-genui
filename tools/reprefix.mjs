/** Move every genui URL from `/api/genui` to `/genui` (the `/api` prefix is owned by the connection RPC channel). */
import fs from 'node:fs'
import path from 'node:path'

const root = 'E:/chat/dsh-genui/'
const files = [
  'lib/index.js',
  'lib/client.js',
  'vendor/frame-page.html',
  'vendor/public/dil/embed.js',
  'vendor/public/dil/message-view.js',
  'vendor/public/dil/sandbox.js',
  'vendor/public/dil/view-state.js',
  'tools/route-test.mjs',
  'tools/patch-vendor.mjs',
]

for (const rel of files) {
  const p = path.join(root, rel)
  const text = fs.readFileSync(p, 'utf8')
  if (!text.includes('/api/genui')) {
    console.log('skip', rel)
    continue
  }
  fs.writeFileSync(p, text.replaceAll('/api/genui', '/genui'), 'utf8')
  console.log('patched', rel)
}

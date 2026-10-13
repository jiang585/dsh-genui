/** Accept base64url as well as standard base64 in the frame page debug entry. */
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['E:/chat/dsh-genui', 'E:/chat/dsh-genui-live']

const FROM = `            const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))`
const TO = `            const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
            const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
            const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))`

for (const root of ROOTS) {
  const p = path.join(root, 'vendor', 'frame-page.html')
  let text = fs.readFileSync(p, 'utf8')
  if (text.includes('const padded')) {
    console.log('skip (already patched)', p)
    continue
  }
  if (!text.includes(FROM)) {
    console.log('pattern missing', p)
    continue
  }
  fs.writeFileSync(p, text.replace(FROM, TO), 'utf8')
  console.log('patched', p)
}

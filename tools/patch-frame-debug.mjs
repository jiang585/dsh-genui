/**
 * Add `?source_b64=` support to the frame page so a generated interface can be
 * rendered by navigating to one URL (used by the browser self-test, and handy
 * when debugging a document without a conversation).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['E:/chat/dsh-genui', 'E:/chat/dsh-genui-live']

const MARK = '      post({ kind: \'ready\' })'

const INJECT = `      // Debug/self-test entry: /genui/frame.html?source_b64=<base64 DIL>
      {
        const params = new URLSearchParams(location.search)
        const encoded = params.get('source_b64')
        const plain = params.get('source')
        if (encoded) {
          try {
            const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
            latest = new TextDecoder().decode(bytes)
          } catch { /* ignore malformed debug source */ }
        } else if (plain) {
          latest = plain
        }
        if (latest) {
          const title = params.get('title')
          if (title) document.getElementById('title').textContent = title
          schedule()
        }
      }

      post({ kind: 'ready' })`

for (const root of ROOTS) {
  const p = path.join(root, 'vendor', 'frame-page.html')
  const text = fs.readFileSync(p, 'utf8')
  if (text.includes('source_b64')) {
    console.log('skip (already patched)', p)
    continue
  }
  if (!text.includes(MARK)) {
    console.log('MARK NOT FOUND', p)
    continue
  }
  fs.writeFileSync(p, text.replace(MARK, INJECT), 'utf8')
  console.log('patched', p)
}

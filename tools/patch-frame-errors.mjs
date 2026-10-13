/** Add visible error capture + a debug title marker to the frame page (both copies). */
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['E:/chat/dsh-genui', 'E:/chat/dsh-genui-live']

const MARK = "      post({ kind: 'ready' })"

const INJECT = `      window.addEventListener('error', (event) => showError('[window] ' + (event.message || event.error)))
      window.addEventListener('unhandledrejection', (event) => showError('[promise] ' + (event.reason?.message ?? event.reason)))

      post({ kind: 'ready' })`

for (const root of ROOTS) {
  const p = path.join(root, 'vendor', 'frame-page.html')
  let text = fs.readFileSync(p, 'utf8')
  if (!text.includes("addEventListener('error'")) {
    if (!text.includes(MARK)) {
      console.log('MARK missing', p)
      continue
    }
    text = text.replace(MARK, INJECT)
  }
  if (!text.includes('debug:source')) {
    text = text.replace(
      "        if (latest) {\n          const title = params.get('title')",
      "        if (latest) {\n          document.title = 'debug:source=' + latest.length\n          const title = params.get('title')",
    )
  }
  fs.writeFileSync(p, text, 'utf8')
  console.log('patched', p, '| has error hook:', text.includes("addEventListener('error'"), '| has marker:', text.includes('debug:source'))
}

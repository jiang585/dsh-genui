/**
 * Verify the runner document's CSP: the inline script's sha256 must match the
 * hash pinned in the Content-Security-Policy meta tag, otherwise the browser
 * refuses to execute it and the sandbox never becomes ready.
 */
import { createHash } from 'node:crypto'

const html = await (await fetch('http://127.0.0.1:19387/genui-live/runner.html')).text()

const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? ''
console.log('CSP:', csp.slice(0, 200))

const pinned = csp.match(/script-src 'sha256-([^']+)'/)?.[1] ?? null
console.log('pinned hash:', pinned)

// The frame script is the first <script> element's text content.
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
console.log('inline scripts found:', scripts.length, '| lengths:', scripts.map((s) => s.length).join(', '))

for (const [index, script] of scripts.entries()) {
  const digest = createHash('sha256').update(script, 'utf8').digest('base64')
  console.log(`script[${index}] sha256-${digest} ${pinned === digest ? '<-- MATCHES CSP' : ''}`)
}

// The worker source travels in a <template>; report its size and whether the
// document grants it a blob: worker.
const template = html.match(/<template[^>]*>([\s\S]*?)<\/template>/)?.[1] ?? ''
console.log('template bytes:', template.length, '| worker-src in CSP:', /worker-src[^;]*blob:/.test(csp))
console.log('has unsafe-eval:', csp.includes("'unsafe-eval'"))
console.log('frame-src none:', /frame-src 'none'/.test(csp))

// Smoke-test the vendored DIL compiler exactly as the host half will call it.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { compile } = require('../vendor/compiler/index.js')

const SOURCE = [
  '{@body const [n,setN] = DIL.useState(3)}',
  '<box gap={3}>',
  '  <row justify="between">',
  '    <title size="lg">已点击 {n} 次</title>',
  '    <badge color={n>=8?"warning":"success"}>{n>=8?"偏高":"正常"}</badge>',
  '  </row>',
  '  <button onClick={()=>setN(n+1)}>加一</button>',
  '</box>',
].join('\n')

const out = compile(SOURCE)
console.log('keys:', Object.keys(out).join(', '))
console.log('diagnostics:', JSON.stringify(out.diagnostics))
console.log('requiredComponents:', JSON.stringify(out.requiredComponents))
console.log('code head:', String(out.code).split('\n').slice(0, 6).join('\n'))
console.log('constants:', JSON.stringify(out.constants).slice(0, 200))
console.log('fallback head:', String(out.fallbackMarkdown).slice(0, 160).replace(/\n/g, ' '))

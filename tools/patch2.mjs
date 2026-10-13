import fs from 'node:fs'
import path from 'node:path'

const root = 'E:/chat/dsh-genui/'
const patch = (rel, from, to) => {
  const p = path.join(root, rel)
  const text = fs.readFileSync(p, 'utf8')
  if (!text.includes(from)) return console.log('skip', rel)
  fs.writeFileSync(p, text.replaceAll(from, to), 'utf8')
  console.log('patched', rel)
}

patch('vendor/public/dil/embed.js', 'href="/dil/dil.css"', 'href="/api/genui/dil/dil.css"')
patch('vendor/sandbox/frame.js', "path.join(__dirname, '..', '..', 'sandbox', 'worker.js')", "path.join(__dirname, 'worker.js')")

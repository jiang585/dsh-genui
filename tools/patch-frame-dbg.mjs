/** Add an on-page protocol log to the live frame page (visible in --dump-dom). */
import fs from 'node:fs'

const p = 'E:/chat/dsh-genui-live/vendor/frame-page.html'
let text = fs.readFileSync(p, 'utf8')

if (!text.includes('id="dbg"')) {
  text = text.replace(
    '    <div class="stage" id="stage"></div>',
    '    <div class="stage" id="stage"></div>\n    <pre id="dbg" style="display:none"></pre>',
  )
  text = text.replace(
    '      const stage = document.getElementById(\'stage\')',
    `      const stage = document.getElementById('stage')
      const dbgLines = []
      function dbg(line) {
        dbgLines.push(line)
        const box = document.getElementById('dbg')
        if (box) box.textContent = dbgLines.join('\\n')
      }`,
  )
  text = text.replace(
    '          onProtocol: (entry) => post({ kind: \'protocol\', entry }),',
    `          onProtocol: (entry) => { dbg('PROTO ' + JSON.stringify(entry).slice(0, 220)); post({ kind: 'protocol', entry }) },`,
  )
  text = text.replace(
    '      function ensureView() {\n        if (view) return view',
    `      function ensureView() {
        if (view) return view
        dbg('creating DilMessageView')`,
  )
  fs.writeFileSync(p, text, 'utf8')
  console.log('patched', p)
} else {
  console.log('already patched')
}

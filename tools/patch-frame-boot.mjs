/**
 * Boot diagnostics for the frame page: a classic script (runs even when the
 * module half fails) that surfaces module-load errors into #err and marks the
 * document title once the module half starts.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['E:/chat/dsh-genui', 'E:/chat/dsh-genui-live']

const BOOT = `    <script>
      // Classic boot probe: runs before (and independently of) the module half.
      window.__genuiBoot = { moduleStarted: false, errors: [] }
      window.addEventListener('error', function (event) {
        var detail = event.message || (event.target && (event.target.src || event.target.href)) || String(event.error || 'unknown')
        window.__genuiBoot.errors.push(detail)
        var box = document.getElementById('err')
        if (box) { box.style.display = 'block'; box.textContent = '[boot] ' + detail }
      }, true)
      window.addEventListener('unhandledrejection', function (event) {
        var detail = 'rejection: ' + ((event.reason && event.reason.message) || event.reason)
        window.__genuiBoot.errors.push(detail)
        var box = document.getElementById('err')
        if (box) { box.style.display = 'block'; box.textContent = '[boot] ' + detail }
      })
      window.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
          if (!window.__genuiBoot.moduleStarted) {
            var box = document.getElementById('err')
            if (box) {
              box.style.display = 'block'
              box.textContent = '[boot] module half never started' + (window.__genuiBoot.errors.length ? '\\n' + window.__genuiBoot.errors.join('\\n') : '')
            }
          }
        }, 2500)
      })
    </script>

    <script type="module">`

for (const root of ROOTS) {
  const p = path.join(root, 'vendor', 'frame-page.html')
  let text = fs.readFileSync(p, 'utf8')
  if (!text.includes('__genuiBoot')) {
    text = text.replace('    <script type="module">', BOOT)
  }
  if (!text.includes("__genuiBoot.moduleStarted = true")) {
    text = text.replace(
      "      import { DilMessageView } from ",
      "      window.__genuiBoot.moduleStarted = true\n      import { DilMessageView } from ",
    )
  }
  fs.writeFileSync(p, text, 'utf8')
  console.log('patched', p)
}

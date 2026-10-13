/**
 * Generate a stand-in for the DSH tool card that reports back over HTTP, so the
 * whole browser pipeline (compile → sandbox → worker → render → height → state)
 * can be verified without any window access.
 *
 *   node tools/make-card-probe.mjs [mount] [outDir]
 *
 * Read the result back with:  curl <mount>/state?session_id=probe-log
 */
import fs from 'node:fs'
import path from 'node:path'

const MOUNT = process.argv[2] ?? '/genui-live2'
const OUT = process.argv[3] ?? 'E:/chat/dsh-genui-live2/vendor/public/dil'
const source = fs.readFileSync('E:/chat/dsh-genui/tools/selftest-source.dil', 'utf8')

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>card probe</title>
    <style>
      body { font: 12px/1.5 system-ui, sans-serif; margin: 0; padding: 16px; background: #0f1115; color: #e5e7eb; }
      .card { border: 1px solid #2a2f3a; border-radius: 12px; overflow: hidden; max-width: 920px; }
      iframe { display: block; width: 100%; height: 220px; border: 0; background: transparent; }
      pre { margin-top: 12px; white-space: pre-wrap; color: #9ca3af; }
    </style>
  </head>
  <body>
    <div class="card">
      <iframe id="card" src="${MOUNT}/frame.html" sandbox="allow-scripts allow-same-origin"></iframe>
    </div>
    <pre id="log"></pre>
    <script>
      var SOURCE = ${JSON.stringify(source)}
      var lines = []
      var heights = []
      function log(text) {
        lines.push(new Date().toISOString().slice(11, 19) + ' ' + text)
        document.getElementById('log').textContent = lines.join('\\n')
      }
      function report() {
        var card = document.getElementById('card')
        var snapshot = { lines: lines.slice(-40), heights: heights.slice(-10) }
        try {
          var doc = card.contentDocument
          if (doc) {
            var stage = doc.querySelector('#stage')
            snapshot.stageText = stage ? stage.textContent.replace(/\\s+/g, ' ').slice(0, 300) : null
            snapshot.elementCount = stage ? stage.querySelectorAll('*').length : -1
            snapshot.frameError = doc.querySelector('#err') && doc.querySelector('#err').style.display === 'block' ? doc.querySelector('#err').textContent.slice(0, 200) : null
            snapshot.frameScrollHeight = doc.documentElement.scrollHeight
            snapshot.iframeHeight = card.getBoundingClientRect().height
            snapshot.clipped = doc.documentElement.scrollHeight - card.getBoundingClientRect().height
            snapshot.sandboxFrame = !!doc.querySelector('iframe[data-dil-sandbox]')
          }
        } catch (error) { snapshot.readError = String(error.message) }
        fetch('${MOUNT}/view_state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ call_id: 'probe-log', updates: [{ scope: 'probe', state: snapshot }] }),
        }).catch(function () {})
        // Compact metrics under their own scope so they survive state truncation.
        fetch('${MOUNT}/view_state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            call_id: 'probe-metrics',
            updates: [{
              scope: 'metrics',
              state: {
                heights: heights.slice(-6),
                elementCount: snapshot.elementCount,
                frameScrollHeight: snapshot.frameScrollHeight,
                iframeHeight: snapshot.iframeHeight,
                clipped: snapshot.clipped,
                frameError: snapshot.frameError,
                lastLine: lines[lines.length - 1],
              },
            }],
          }),
        }).catch(function () {})
      }
      var card = document.getElementById('card')
      window.addEventListener('message', function (event) {
        var data = event.data || {}
        if (!data.__genuiFrame) return
        if (data.kind === 'height') {
          heights.push(data.height)
          card.style.height = data.height + 'px'
          log('HEIGHT ' + data.height)
          return
        }
        log('CARD ' + JSON.stringify(data).slice(0, 200))
      })
      card.addEventListener('load', function () {
        log('card iframe loaded — warm + push session + source')
        card.contentWindow.postMessage({ __genuiHost: true, kind: 'warm' }, '*')
        card.contentWindow.postMessage({ __genuiHost: true, kind: 'session', sessionId: 'probe-session' }, '*')
        card.contentWindow.postMessage({ __genuiHost: true, kind: 'source', callId: 'probe-call', source: SOURCE }, '*')
      })
      log('probe ready')
      setInterval(report, 1500)
    </script>
  </body>
</html>
`

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, '_card-probe.html'), html, 'utf8')
console.log('wrote', path.join(OUT, '_card-probe.html'), '| mount', MOUNT)

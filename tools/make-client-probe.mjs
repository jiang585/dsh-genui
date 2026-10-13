/**
 * Client-half smoke test: load the served plugin bundle in a real browser with a
 * stub module loader + stub React, run its factory, call `apply(ctx)` and render
 * the registered card with a streamed tool-call argument — then report the result
 * over /genui-live/view_state so it can be read back from the shell.
 */
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'

const HASH_LEN = 12
function framedHash(domain, parts) {
  const hash = createHash('sha1').update(domain).update('\0')
  for (const part of parts) hash.update(`${String(Buffer.byteLength(part))}:`).update(part)
  return hash.digest('hex').slice(0, HASH_LEN)
}

const clientFile = 'E:/chat/dsh-genui-live/lib/client.js'
const stat = statSync(clientFile)
const rev = framedHash('plugin-artifact', [String(stat.mtimeMs), String(stat.ctimeMs), String(stat.size)])
const bundleUrl = `http://127.0.0.1:19387/plugins/??@local/dsh-live-ui/client.js&rev=${rev}`

const ARGS = JSON.stringify({
  title: '流式自检',
  source: '{@body const [n,setN]=DIL.useState(2)}\n<box gap={2}><title>流式参数 {n}</title><button onClick={()=>setN(n+1)}>加一</button></box>',
})

const html = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>client probe</title></head>
  <body>
    <pre id="log"></pre>
    <script>
      var lines = []
      function log(text) { lines.push(text); document.getElementById('log').textContent = lines.join('\\n') }
      function report(extra) {
        fetch('/genui-live/view_state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ call_id: 'client-probe', updates: [{ scope: 'clientProbe', state: Object.assign({ lines: lines }, extra || {}) }] }),
        }).catch(function () {})
      }
      window.addEventListener('error', function (event) { log('ERR ' + (event.message || event.target?.src)); report() }, true)

      // ── stub module loader + stub React ────────────────────────────────────
      var captured = null
      window.__ModuleLoader__ = {
        load: function (row) { captured = row; log('loader captured id=' + row.id + ' factory=' + typeof row.factory) },
      }
      function stubReact() {
        return {
          createElement: function (type, props) {
            var children = Array.prototype.slice.call(arguments, 2)
            return { type: type, props: props || {}, children: children }
          },
          useRef: function (initial) { return { current: initial === undefined ? null : initial } },
          useState: function (initial) { return [initial, function () {}] },
          useEffect: function () {},
        }
      }
      function requireStub(name) {
        if (name === 'react') return stubReact()
        throw new Error('unexpected require: ' + name)
      }
    </script>
    <script src="${bundleUrl}"></script>
    <script>
      (function () {
        try {
          if (!captured) { log('FAIL bundle did not register'); report(); return }
          var exports = captured.factory(requireStub)
          log('exports: ' + Object.keys(exports).join(',') + ' | inject=' + JSON.stringify(exports.inject))

          var registered = null
          var ctx = {
            slots: {
              inject: function (key, callback) { log('slots.inject ' + key); callback() },
              register: function (registration, component) { registered = { registration: registration, component: component }; return function () {} },
            },
          }
          exports.apply(ctx)
          log('registered slot=' + (registered && registered.registration.name) + ' key=' + (registered && registered.registration.key))

          var props = {
            callId: 'call-1',
            toolName: 'genui_render',
            phase: 'start',
            block: { kind: 'tool-call', phase: 'start', callId: 'call-1', name: 'genui_render', argsRaw: ${JSON.stringify(ARGS)} },
            toolCallArgumentsPartial: function () { return '' },
          }
          var tree = registered.component(props)
          var iframe = tree.children.find(function (child) { return child && child.type === 'iframe' })
          log('card root=' + tree.type + ' children=' + tree.children.length)
          log('iframe src=' + (iframe && iframe.props.src) + ' sandbox=' + (iframe && iframe.props.sandbox))
          var header = tree.children[0]
          log('header title=' + header.children[1].children[0])

          // partial-argument path: only a prefix of the JSON has streamed in
          var partial = ${JSON.stringify(ARGS)}.slice(0, ${JSON.stringify(ARGS)}.indexOf('加一') + 4)
          var partialProps = Object.assign({}, props, { phase: 'preparing', block: { phase: 'preparing', callId: 'call-1', name: 'genui_render' }, toolCallArgumentsPartial: function () { return partial } })
          var partialTree = registered.component(partialProps)
          log('partial render ok, header title=' + partialTree.children[0].children[1].children[0])
          report({ ok: true, slot: registered.registration.name, key: registered.registration.key, iframeSrc: iframe && iframe.props.src })
        } catch (error) {
          log('FAIL ' + (error && error.message))
          report({ ok: false, error: String(error && error.message) })
        }
      })()
    </script>
  </body>
</html>
`

fs.writeFileSync('E:/chat/dsh-genui-live/vendor/public/dil/_client-probe.html', html, 'utf8')
console.log('wrote _client-probe.html | bundle', bundleUrl)

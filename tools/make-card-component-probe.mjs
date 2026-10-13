/**
 * Regression harness for the real card component: loads the served client bundle
 * with a tiny React shim, mounts the registered `genui_render` card with a real
 * iframe pointing at the frame page, feeds a streamed tool-call argument, and
 * checks that the card ends up tall enough for the generated interface.
 *
 *   node tools/make-card-component-probe.mjs [mount] [pkg] [outDir]
 *
 * Read the result back with:  curl <mount>/state?session_id=card-component
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const MOUNT = process.argv[2] ?? '/genui-live2'
const PKG = process.argv[3] ?? '@local/dsh-live-ui2'
const OUT = process.argv[4] ?? 'E:/chat/dsh-genui-live2/vendor/public/dil'
const clientFile = process.argv[5] ?? 'E:/chat/dsh-genui-live2/lib/client.js'

const stat = fs.statSync(clientFile)
const hash = createHash('sha1').update('plugin-artifact').update('\0')
for (const part of [String(stat.mtimeMs), String(stat.ctimeMs), String(stat.size)]) {
  hash.update(`${String(Buffer.byteLength(part))}:`).update(part)
}
const rev = hash.digest('hex').slice(0, 12)

const SOURCE = fs.readFileSync('E:/chat/dsh-genui/tools/selftest-source.dil', 'utf8')

const html = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>card component probe</title>
  <style>body{font:12px/1.5 monospace;margin:12px}iframe{border:1px solid #999}</style></head>
  <body>
    <div id="host"></div>
    <pre id="log"></pre>
    <script>
      var lines = []
      function log(t) { lines.push(t); document.getElementById('log').textContent = lines.join('\\n'); report() }
      function report(extra) {
        fetch('${MOUNT}/view_state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ call_id: 'card-component', updates: [{ scope: 'cardComponent', state: Object.assign({ lines: lines.slice(-30) }, extra || {}) }] }),
        }).catch(function () {})
      }
      window.addEventListener('error', function (e) { log('ERR ' + (e.message || e.target?.src)) }, true)

      // ── tiny React shim: createElement / useState / useRef / useEffect ──────
      var instance = null
      var pending = false
      function scheduleRender() {
        if (pending) return
        pending = true
        setTimeout(function () { pending = false; instance && instance.render() }, 0)
      }
      function createReact() {
        return {
          createElement: function (type, props) {
            var children = Array.prototype.slice.call(arguments, 2)
            return { type: type, props: props || {}, children: children }
          },
          useRef: function (initial) {
            var i = instance.index++
            if (!instance.hooks[i]) instance.hooks[i] = { value: { current: initial === undefined ? null : initial } }
            return instance.hooks[i].value
          },
          useState: function (initial) {
            var i = instance.index++
            if (!instance.hooks[i]) instance.hooks[i] = { value: typeof initial === 'function' ? initial() : initial }
            var hook = instance.hooks[i]
            return [hook.value, function (next) {
              hook.value = typeof next === 'function' ? next(hook.value) : next
              scheduleRender()
            }]
          },
          useEffect: function (fn, deps) {
            var i = instance.index++
            var hook = instance.hooks[i] || (instance.hooks[i] = { deps: null, cleanup: null })
            var changed = !hook.deps || !deps || deps.length !== hook.deps.length || deps.some(function (d, k) { return d !== hook.deps[k] })
            if (changed) { hook.deps = deps; instance.effects.push(function () { if (hook.cleanup) try { hook.cleanup() } catch (e) {} ; hook.cleanup = fn() || null }) }
          },
        }
      }

      // ── minimal reconciler ─────────────────────────────────────────────────
      function applyProps(el, props) {
        Object.keys(props || {}).forEach(function (key) {
          if (key === 'children' || key === 'ref') return
          var value = props[key]
          if (key === 'style' && value && typeof value === 'object') {
            Object.keys(value).forEach(function (cssKey) {
              if (el.style[cssKey] !== value[cssKey]) el.style[cssKey] = value[cssKey]
            })
            return
          }
          // Only touch the DOM when the value actually changes: re-setting an
          // iframe's src attribute (even to the same string) reloads it, which
          // would restart the frame page on every streamed chunk.
          var next = String(value)
          if (el.getAttribute(key) === next) return
          if (key === 'sandbox' || key === 'src' || key === 'title' || key.indexOf('data-') === 0) {
            el.setAttribute(key, next)
            return
          }
          el[key] = value
        })
      }
      function patch(parent, oldNode, node, index) {
        if (node === null || node === undefined || node === false) return null
        if (typeof node === 'string' || typeof node === 'number') {
          var text = parent.childNodes[index]
          if (text && text.nodeType === 3) { text.textContent = String(node); return text }
          var created = document.createTextNode(String(node))
          if (text) parent.replaceChild(created, text); else parent.appendChild(created)
          return created
        }
        var el = parent.childNodes[index]
        if (!el || el.nodeType !== 1 || el.tagName.toLowerCase() !== String(node.type).toLowerCase()) {
          var fresh = document.createElement(node.type)
          if (el) parent.replaceChild(fresh, el); else parent.appendChild(fresh)
          el = fresh
        }
        applyProps(el, node.props)
        if (node.props && node.props.ref) node.props.ref.current = el
        var children = node.children || []
        // Clear stale children beyond the new list.
        for (var c = children.length; c < el.childNodes.length; c++) el.removeChild(el.childNodes[c])
        children.forEach(function (child, k) { patch(el, null, child, k) })
        return el
      }

      // ── load the real bundle ───────────────────────────────────────────────
      var captured = null
      window.__ModuleLoader__ = { load: function (row) { captured = row; log('loader captured id=' + row.id) } }
    </script>
    <script src="http://127.0.0.1:19387/plugins/??${PKG}/client.js&rev=${rev}"></script>
    <script>
      (function () {
        try {
          if (!captured) { log('FAIL bundle did not register'); report({ ok: false }); return }
          var React = createReact()
          var exports = captured.factory(function (name) {
            if (name === 'react') return React
            throw new Error('unexpected require ' + name)
          })
          var registered = null
          exports.apply({ slots: {
            inject: function (key, cb) { log('slots.inject ' + key); cb() },
            register: function (registration, component) { registered = { registration: registration, component: component }; return function () {} },
          } })
          log('registered ' + registered.registration.name + ' key=' + registered.registration.key)

          var host = document.getElementById('host')
          var props = {
            callId: 'card-1',
            toolName: 'genui_render',
            phase: 'preparing',
            block: { phase: 'preparing', callId: 'card-1', name: 'genui_render' },
            toolCallArgumentsPartial: function () { return partialRaw },
          }
          var partialRaw = '{"title":"组件回归","source":"' + ${JSON.stringify(JSON.stringify(SOURCE))}.slice(1, -1) + '"}'  // complete JSON, escaped once

          instance = {
            hooks: [], index: 0, effects: [],
            render: function () {
              instance.index = 0
              instance.effects = []
              var tree = registered.component(props)
              patch(host, null, tree, 0)
              instance.effects.forEach(function (effect) { effect() })
            },
          }
          instance.render()
          log('card mounted; iframe src=' + (host.querySelector('iframe') || {}).src)

          // Stream the argument in pieces: the card must keep the final height.
          var full = partialRaw
          var steps = [0.25, 0.5, 0.75, 1].map(function (f) { return Math.round(full.length * f) })
          var at = 0
          var timer = setInterval(function () {
            if (at >= steps.length) {
              clearInterval(timer)
              setTimeout(finish, 8000)
              return
            }
            partialRaw = full.slice(0, steps[at])
            at++
            log('streamed ' + partialRaw.length + ' / ' + full.length + ' bytes')
            instance.render()
          }, 700)

          function finish() {
            var iframe = host.querySelector('iframe')
            var doc = iframe.contentDocument
            var frameScrollHeight = doc ? doc.documentElement.scrollHeight : -1
            var iframeHeight = iframe.getBoundingClientRect().height
            var stage = doc ? doc.querySelector('#stage') : null
            var result = {
              ok: true,
              slot: registered.registration.name,
              key: registered.registration.key,
              iframeHeight: iframeHeight,
              frameScrollHeight: frameScrollHeight,
              clipped: frameScrollHeight - iframeHeight,
              elementCount: stage ? stage.querySelectorAll('*').length : -1,
              status: host.querySelector('span:last-child') ? host.querySelector('span:last-child').textContent : null,
              frameError: doc && doc.querySelector('#err') && doc.querySelector('#err').style.display === 'block' ? doc.querySelector('#err').textContent.slice(0, 200) : null,
              sandboxFrame: !!(doc && doc.querySelector('iframe[data-dil-sandbox]')),
              heightHeartbeats: window.__heightSeen || 0,
            }
            log('RESULT ' + JSON.stringify(result))
            report(result)
          }
        } catch (error) {
          log('FAIL ' + (error && error.stack ? error.stack.split('\\n').slice(0, 3).join(' | ') : error))
          report({ ok: false, error: String(error && error.message) })
        }
      })()
    </script>
  </body>
</html>
`

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, '_card-component-probe.html'), html, 'utf8')
console.log('wrote', path.join(OUT, '_card-component-probe.html'), '| bundle rev', rev)

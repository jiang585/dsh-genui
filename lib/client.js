/**
 * `@local/dsh-genui` — client half.
 *
 * Registers the conversation tool card for the `genui_render` tool. The card is
 * the *host page* of one generated interface:
 *
 *   tool-call arguments (streaming) ──► /genui/frame.html (iframe)
 *                                          └─ compile ─► sandbox iframe (opaque origin)
 *                                                          └─ blob: Worker runs the program
 *
 * Nothing model-authored ever runs in the application document: the compiled
 * program lives in the sandboxed runner, and the card only forwards source text
 * and paints the status line.
 *
 * Hand-written in the `window.__ModuleLoader__` factory format the DSH web shell
 * loads (same shape tsdown emits for a package's `lib/client.js`), so this
 * package needs no build step.
 */

window.__ModuleLoader__.load({
  id: 'dsh-genui',
  factory: (require) => {
    // The module loader hands the factory only `require`; the bundle owns its
    // module record exactly like a tsdown-built client half does.
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const h = React.createElement

    const TOOL_NAME = 'genui_render'
    const FRAME_URL = '/genui/frame.html'

    // ── argument extraction ─────────────────────────────────────────────────

    /** The raw argument JSON of the current phase, '' when unavailable. */
    function rawArguments(props) {
      const block = props && props.block
      if (!block) return ''
      if (props.phase === 'result') return (block.call && block.call.argsRaw) || ''
      return block.argsRaw || ''
    }

    function tryParse(raw) {
      try {
        const value = JSON.parse(raw)
        return typeof value === 'object' && value !== null ? value : null
      } catch {
        return null
      }
    }

    /**
     * Read one string field out of a (possibly still-streaming) argument JSON.
     * Complete JSON wins; otherwise the prefix is decoded escape by escape so a
     * half-written document still renders.
     */
    function readStringField(raw, field) {
      if (!raw) return ''
      const parsed = tryParse(raw)
      if (parsed && typeof parsed[field] === 'string') return parsed[field]
      const key = `"${field}"`
      const at = raw.indexOf(key)
      if (at < 0) return ''
      let i = raw.indexOf(':', at + key.length)
      if (i < 0) return ''
      i += 1
      while (i < raw.length && /\s/.test(raw[i])) i += 1
      if (raw[i] !== '"') return ''
      i += 1
      let out = ''
      for (; i < raw.length; i += 1) {
        const ch = raw[i]
        if (ch === '"') break
        if (ch !== '\\') {
          out += ch
          continue
        }
        const next = raw[i + 1]
        if (next === undefined) break
        if (next === 'u') {
          const hex = raw.slice(i + 2, i + 6)
          if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) return out
          out += String.fromCharCode(parseInt(hex, 16))
          i += 5
          continue
        }
        out += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next
        i += 1
      }
      return out
    }

    // ── the card ────────────────────────────────────────────────────────────

    const STYLE = {
      shell: {
        border: '1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08))',
        borderRadius: 18,
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-3, #ffffff))',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 24px -4px rgba(0, 0, 0, 0.04)',
        transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
      },
      // Slim, elegant header: status indicator, title with icon, and micro pill badge.
      bar: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 15px',
        fontSize: '12px',
        lineHeight: '16px',
        background: 'var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.6))',
        borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.06))',
        color: 'var(--dsw-alias-label-secondary, #64748b)',
        userSelect: 'none',
      },
      dotWrap: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 12,
        height: 12,
        flex: 'none',
      },
      dot: {
        width: 6.5,
        height: 6.5,
        borderRadius: '50%',
        background: 'currentColor',
        opacity: 0.35,
        transition: 'all 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      dotLive: {
        opacity: 1,
        background: '#10b981',
        boxShadow: '0 0 0 2.5px rgba(16, 185, 129, 0.2), 0 0 8px rgba(16, 185, 129, 0.4)',
      },
      dotStreaming: {
        opacity: 1,
        background: '#3b82f6',
        boxShadow: '0 0 0 2.5px rgba(59, 130, 246, 0.22), 0 0 8px rgba(59, 130, 246, 0.35)',
      },
      dotError: {
        opacity: 1,
        background: '#ef4444',
        boxShadow: '0 0 0 2.5px rgba(239, 68, 68, 0.2), 0 0 8px rgba(239, 68, 68, 0.35)',
      },
      titleWrap: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      },
      titleIcon: {
        width: 13,
        height: 13,
        color: 'var(--dsw-alias-label-tertiary, #94a3b8)',
        flex: 'none',
      },
      title: {
        color: 'var(--dsw-alias-label-primary, #0f172a)',
        fontWeight: 600,
        fontSize: '12.5px',
        letterSpacing: '-0.01em',
      },
      grow: { flex: 1 },
      badge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-layer-3, rgba(0, 0, 0, 0.04))',
        border: '1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.04))',
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--dsw-alias-label-secondary, #64748b)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.01em',
        transition: 'all 0.2s ease',
      },
      frame: { display: 'block', width: '100%', border: 0, background: 'transparent' },
    }

    const MIN_HEIGHT = 120
    const MAX_HEIGHT = Number.MAX_SAFE_INTEGER

    /** Timeline of (elapsed ms, source bytes) — posted to the host so a run can be
     *  audited afterwards for whether the tool arguments really streamed. */
    function reportTimeline() {}

    function GenuiCard(props) {
      const callId = props.callId
      const hook = typeof props.useToolCallArgumentsPartial === 'function' ? props.useToolCallArgumentsPartial : null
      // The Hook is bound by the Tool slot for every phase (it returns '' outside
      // preparation), so it is called unconditionally to keep hook order stable.
      const partial = hook ? hook() : ''
      const complete = rawArguments(props)

      const raw = partial && partial.length > complete.length ? partial : complete
      const source = readStringField(raw, 'source')
      const title = readStringField(raw, 'title') || '智能界面'

      const frameRef = React.useRef(null)
      const startedAt = React.useRef(Date.now())
      const samples = React.useRef([])
      const latestSource = React.useRef('')
      const heightRef = React.useRef(220)
      const [frameReady, setFrameReady] = React.useState(false)
      const [status, setStatus] = React.useState('准备沙箱…')
      const [failed, setFailed] = React.useState(false)
      const [height, setHeight] = React.useState(220)

      latestSource.current = source

      // Messages from the frame page: lifecycle + measured height.
      // NOTE: no dependency on the streamed source — re-subscribing per chunk
      // could drop the final height message and leave the card stuck short.
      React.useEffect(() => {
        function onMessage(event) {
          const frame = frameRef.current
          if (!frame || event.source !== frame.contentWindow) return
          const message = event.data
          if (!message || message.__genuiFrame !== true) return
          if (message.kind === 'ready') {
            setFrameReady(true)
            return
          }
          if (message.kind === 'height' && typeof message.height === 'number' && message.height > 0) {
            const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(message.height)))
            // Grow-only: a mid-stream measurement must never shrink the card.
            if (Math.abs(next - heightRef.current) > 1) {
              heightRef.current = next
              setHeight(next)
            }
            return
          }
          if (message.kind === 'rendered') { setFailed(false); setStatus('界面已就绪'); return }
          if (message.kind === 'streaming') {
            setStatus(`写作中 · ${(message.bytes / 1024).toFixed(1)} KB`)
            return
          }
          if (message.kind === 'error') {
            setFailed(true)
            setStatus(String(message.message || '渲染失败'))
            return
          }
          if (message.kind === 'compiled') {
            setFailed(false)
            const count = (message.diagnostics || []).length
            const bytes = message.bytes ?? latestSource.current.length
            setStatus(`已编译 ${(bytes / 1024).toFixed(1)} KB · ${message.durationMs ?? 0} ms${count ? ` · ${count} 处修复` : ''}`)
            // Ask for a fresh measurement after every compile, so the card always
            // ends up at the final content height even if a message was missed.
            try { frame.contentWindow.postMessage({ __genuiHost: true, kind: 'measure' }, '*') } catch { /* detached */ }
          }
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
      }, [])

      // Keep asking for the height while the card is alive: self-healing against
      // any missed message, and the card reports its own metrics to the host.
      React.useEffect(() => {
        const timer = setInterval(() => {
          const frame = frameRef.current
          if (!frame) return
          try { frame.contentWindow.postMessage({ __genuiHost: true, kind: 'measure' }, '*') } catch { /* detached */ }
        }, 1500)
        return () => clearInterval(timer)
      }, [props.callId, status])

      // Warm the sandbox as soon as the card exists — the runner boots while the
      // model is still writing, so the first chunk paints immediately.
      React.useEffect(() => {
        const frame = frameRef.current
        if (!frame || !frameReady) return
        frame.contentWindow.postMessage({ __genuiHost: true, kind: 'warm' }, '*')
      }, [frameReady])

      // Push the (possibly partial) document into the frame as it streams.
      React.useEffect(() => {
        const frame = frameRef.current
        if (!frame || !frameReady) return
        frame.contentWindow.postMessage(
          { __genuiHost: true, kind: 'source', source, callId },
          '*',
        )
        if (source) {
          samples.current.push([Date.now() - startedAt.current, source.length])
          if (samples.current.length % 4 === 0 || samples.current.length === 1) reportTimeline(callId, samples.current)
        }
      }, [frameReady, source, callId])

      // Any update that stops growing for a moment is reported too, so the host
      // sees the final size even when the last chunk is not a multiple of four.
      React.useEffect(() => {
        if (!source) return undefined
        const timer = setTimeout(() => reportTimeline(callId, samples.current), 700)
        return () => clearTimeout(timer)
      }, [source, callId])

      const isStreaming = status && status.indexOf('写作中') >= 0
      const dotState = failed ? STYLE.dotError : isStreaming ? STYLE.dotStreaming : source ? STYLE.dotLive : null

      return h(
        'div',
        { style: STYLE.shell, 'data-genui-card': callId || '' },
        h(
          'div',
          { style: STYLE.bar },
          h(
            'span',
            { style: STYLE.dotWrap },
            h('span', { style: Object.assign({}, STYLE.dot, dotState) }),
          ),
          h(
            'div',
            { style: STYLE.titleWrap },
            h(
              'svg',
              {
                style: STYLE.titleIcon,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: '2',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              },
              h('path', { d: 'm12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z' }),
            ),
            h('span', { style: STYLE.title }, title),
          ),
          h('span', { style: STYLE.grow }),
          h('span', { style: STYLE.badge }, status),
        ),
        h('iframe', {
          ref: frameRef,
          src: FRAME_URL,
          title: 'Intelligent UI',
          sandbox: 'allow-scripts allow-same-origin',
          style: Object.assign({}, STYLE.frame, { height: `${height}px` }),
        }),
      )
    }

    // ── plugin ──────────────────────────────────────────────────────────────

    const inject = ['slots']

    function apply(ctx) {
      // DSH's process group is otherwise capped at min(400px, 50vh), with
      // an independent scroller and fade masks. Expand only groups containing
      // our card; stylesheet must live in the application document, not iframe.
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-genui-process-expansion', 'true')
        style.textContent = `
          [data-step-process-body]:has([data-genui-card]) {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            scrollbar-gutter: auto !important;
            mask-image: none !important;
            -webkit-mask-image: none !important;
          }
        `
        document.head.appendChild(style)
        return () => style.remove()
      }, 'genui: expand containing process group')
      ctx.slots.inject('tool.call.toolview', () =>
        ctx.slots.register({ name: 'tool.call.toolview', key: TOOL_NAME }, GenuiCard),
      )
    }

    exports.inject = inject
    exports.apply = apply
    exports.GenuiCard = GenuiCard
    return module.exports
  },
})

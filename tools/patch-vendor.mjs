// One-shot path rewrites for the vendored DIL runtime (idempotent).
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const resolve = (rel) => path.join(root, rel)

const edits = [
  ['vendor/public/dil/embed.js', "'/dil/dil.css'", "'/genui/dil/dil.css'"],
  ['vendor/public/dil/embed.js', 'src="/dil/embed.js"', 'src="/genui/dil/embed.js"'],
  ['vendor/public/dil/message-view.js', "fetch('/api/compile'", "fetch('/genui/compile'"],
  ['vendor/public/dil/sandbox.js', "'/sandbox/runner.html'", "'/genui/runner.html'"],
]

for (const [rel, from, to] of edits) {
  const p = resolve(rel)
  let text = fs.readFileSync(p, 'utf8')
  if (!text.includes(from)) { console.log('skip (already done or missing):', rel, JSON.stringify(from)); continue }
  text = text.replaceAll(from, to)
  fs.writeFileSync(p, text, 'utf8')
  console.log('patched', rel, '->', to)
}

// view-state.js: retarget the report endpoint and carry the DSH session id.
{
  const p = resolve('vendor/public/dil/view-state.js')
  let text = fs.readFileSync(p, 'utf8')
  const from = 'const url = `/api/conversation/${encodeURIComponent(ids.conversationId)}/message/${encodeURIComponent(ids.messageId)}/dil/view_state`;'
  const to = "const url = '/genui/view_state';"
  if (text.includes(from)) {
    text = text.replace(from, to)
    const bodyFrom = "const body = { client_session_id: CLIENT_SESSION_ID, updates: [{ scope, state, client_update_id: uuid() }] };"
    const bodyTo = "const body = { session_id: (globalThis.__GENUI_SESSION_ID__ || null), conversation_id: ids.conversationId, message_id: ids.messageId, client_session_id: CLIENT_SESSION_ID, updates: [{ scope, state, client_update_id: uuid() }] };"
    text = text.replace(bodyFrom, bodyTo)
    fs.writeFileSync(p, text, 'utf8')
    console.log('patched vendor/public/dil/view-state.js')
  } else {
    console.log('skip view-state.js (already done or shape changed)')
  }
}


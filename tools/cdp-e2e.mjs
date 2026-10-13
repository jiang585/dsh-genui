/**
 * Real-time browser test through CDP (no virtual time), so timers behave like a
 * normal browser. Launches headless Edge with a debugging port, navigates to the
 * frame page, waits, then reads the rendered DOM back out.
 *
 *   node tools/cdp-e2e.mjs [url] [waitMs]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const url = process.argv[2] ?? fs.readFileSync('E:/chat/dsh-genui/tools/selftest-url.txt', 'utf8').trim()
const waitMs = Number(process.argv[3] ?? 9000)
const port = 9411 + Math.floor(Math.random() * 40)

const child = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=E:/chat/tmp-edge-cdp-${port}`,
    'about:blank',
  ],
  { stdio: 'ignore', detached: false },
)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function target() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      const list = await response.json()
      const page = list.find((entry) => entry.type === 'page')
      if (page) return page
    } catch { /* not up yet */ }
    await sleep(250)
  }
  throw new Error('devtools endpoint never became ready')
}

const page = await target()
const socket = new WebSocket(page.webSocketDebuggerUrl)
let nextId = 1
const pending = new Map()

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
})

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return result.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url })
await sleep(waitMs)

const report = await evaluate(`(() => {
  const stage = document.querySelector('#stage')
  const dbg = document.querySelector('#dbg')
  const err = document.querySelector('#err')
  const iframe = document.querySelector('iframe')
  return {
    title: document.title,
    stageBytes: stage ? stage.innerHTML.length : -1,
    stageText: stage ? stage.textContent.slice(0, 200) : '',
    elementCount: stage ? stage.querySelectorAll('*').length : -1,
    err: err ? err.textContent.slice(0, 300) : '',
    dbg: dbg ? dbg.textContent.slice(0, 800) : '',
    iframeSrc: iframe ? iframe.getAttribute('src') : null,
  }
})()`)

console.log(JSON.stringify(report, null, 2))

// Read back the keyed state the sandbox reported (proves the state loop).
const state = await fetch('http://127.0.0.1:19387/genui-live/state?session_id=').then((r) => r.json()).catch(() => null)
if (state) console.log('host state snapshot:', JSON.stringify(state).slice(0, 300))

socket.close()
child.kill()

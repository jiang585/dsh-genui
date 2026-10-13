/**
 * `@local/dsh-genui` — host half.
 *
 * Serves the whole browser-side runtime of the Intelligent UI replica over
 * `/genui/*` and answers the compile endpoint the frame page calls:
 *
 *   GET  /genui/frame.html      the frame page that hosts one generated UI
 *   GET  /genui/runner.html     the sandboxed DIL runner (strict CSP)
 *   GET  /genui/dil/*           the vendored renderer/sandbox assets
 *   POST /genui/compile         DIL source → compiled program (+ diagnostics)
 *   POST /genui/view_state      keyed UI state reported by the sandbox
 *   GET  /genui/state           the last reported state (debug/inspection)
 *
 * Routes are registered without the `/api` admission check on purpose: this
 * server is loopback-only, the assets are inert, and the sandboxed runner is
 * what actually executes model-authored code (in an opaque-origin iframe with
 * `default-src 'none'` plus a blob: Worker).
 */

import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { reportState, renderState, sessionForCall } from './state-store.js'

const require = createRequire(import.meta.url)
const { compile } = require('../vendor/compiler/index.js')
const { buildFrameHtml } = require('../vendor/sandbox/frame.js')

export const name = 'dsh-genui'
export const inject = ['webServer']

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
const DIL_ROOT = path.join(ROOT, 'vendor', 'public', 'dil')
const FRAME_PAGE = path.join(ROOT, 'vendor', 'frame-page.html')
const PREFIX = '/genui/'
const MAX_BODY = 8 * 1024 * 1024

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function send(res, status, type, body) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

function sendJson(res, status, value) {
  send(res, status, MIME['.json'], JSON.stringify(value))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function readJson(req) {
  const text = await readBody(req)
  if (!text.trim()) return {}
  return JSON.parse(text)
}

/** Serve one file from the vendored asset directory, refusing traversal. */
async function serveAsset(res, relative) {
  const target = path.resolve(DIL_ROOT, relative)
  if (target !== DIL_ROOT && !target.startsWith(DIL_ROOT + path.sep)) {
    send(res, 403, 'text/plain; charset=utf-8', 'forbidden')
    return
  }
  try {
    const bytes = await readFile(target)
    send(res, 200, MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream', bytes)
  } catch {
    send(res, 404, 'text/plain; charset=utf-8', 'not found')
  }
}

/** The one request handler behind every `/genui/*` route. */
async function handle(req, res) {
  let url
  try {
    url = new URL(req.url ?? '/', 'http://127.0.0.1')
  } catch {
    send(res, 400, 'text/plain; charset=utf-8', 'bad request')
    return
  }
  const route = url.pathname

  try {
    if (route === `${PREFIX}frame.html`) {
      send(res, 200, MIME['.html'], await readFile(FRAME_PAGE, 'utf8'))
      return
    }

    if (route === `${PREFIX}runner.html`) {
      send(res, 200, MIME['.html'], buildFrameHtml())
      return
    }

    if (route === `${PREFIX}compile`) {
      if (req.method !== 'POST') {
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
        return
      }
      const body = await readJson(req)
      const source = typeof body.source === 'string' ? body.source : ''
      if (!source.trim()) {
        sendJson(res, 200, { ok: false, error: 'empty source' })
        return
      }
      const started = Date.now()
      let result
      try {
        result = compile(source, body.options ?? {})
      } catch (error) {
        sendJson(res, 200, { ok: false, error: `compiler crashed: ${error?.message ?? error}` })
        return
      }
      sendJson(res, 200, {
        ok: result.ok !== false,
        code: result.code,
        constants: result.constants ?? {},
        appData: result.appData ?? {},
        diagnostics: result.diagnostics ?? [],
        diagnosticSummary: result.diagnosticSummary ?? '',
        requiredComponents: result.requiredComponents ?? [],
        stateKeys: result.stateKeys ?? [],
        fallbackMarkdown: result.fallbackMarkdown ?? '',
        genuiComponents: result.genuiComponents ?? [],
        durationMs: result.durationMs ?? Date.now() - started,
      })
      return
    }

    if (route === `${PREFIX}view_state`) {
      if (req.method !== 'POST') {
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
        return
      }
      const body = await readJson(req)
      const sessionId = body.session_id ?? sessionForCall(body.call_id)
      const updates = Array.isArray(body.updates) ? body.updates : []
      for (const update of updates) reportState(sessionId, update?.state ?? {}, update?.scope ?? 'root')
      sendJson(res, 200, { ok: true, session_id: sessionId, updated_scopes: updates.length })
      return
    }

    if (route === `${PREFIX}state`) {
      const sessionId = url.searchParams.get('session_id')
      sendJson(res, 200, { ok: true, session_id: sessionId, state: renderState(sessionId) })
      return
    }

    if (route.startsWith(`${PREFIX}dil/`)) {
      await serveAsset(res, route.slice(`${PREFIX}dil/`.length))
      return
    }

    send(res, 404, 'text/plain; charset=utf-8', 'not found')
  } catch (error) {
    send(res, 500, 'text/plain; charset=utf-8', `genui: ${error?.message ?? error}`)
  }
}

export function apply(ctx) {
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler: handle }),
    'genui: runtime routes',
  )
}

// Exported for the route-level self test (tools/route-test.mjs).
export { handle }


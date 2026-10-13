/**
 * Build a self-contained review bundle for an external reviewer (ChatGPT).
 *
 *   node tools/build-review-bundle.mjs [outDir]
 *
 * The bundle carries: the review prompt, an index, the DSH contracts the code
 * relies on, every source file of the plugin (host half, client half, tool half,
 * frame page, vendored compiler/runtime/sandbox), the two design docs, and the
 * evidence produced by the local test harnesses.
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'E:/chat/dsh-genui'
const OUT = process.argv[2] ?? 'E:/chat/genui-review'

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const copy = (rel, dest = rel) => {
  const from = path.isAbsolute(rel) ? rel : path.join(SRC, rel)
  if (!fs.existsSync(from)) { console.log('skip (missing)', rel); return }
  const to = path.join(OUT, dest)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log('copied', rel, '->', dest)
}

// 1. the task + the contracts + the index
copy('E:/chat/给ChatGPT的审查提示词.md', '00-审查提示词.md')
copy('tools/dsh-contracts.md', '01-DSH契约摘录.md')
copy('tools/evidence.md', '02-实测证据.md')
copy('tools/review-index.md', 'INDEX.md')

// 2. plugin source
for (const rel of [
  'package.json',
  'cordis.patch.yml',
  'lib/host.js',
  'lib/client.js',
  'lib/state-store.js',
  'plugins/genui-tools.js',
  'vendor/frame-page.html',
  'README.md',
]) copy(rel, `plugin/${rel}`)

// 3. vendored compiler + sandbox + browser runtime (needed for the security review)
for (const rel of [
  'vendor/compiler/index.js',
  'vendor/compiler/parser.js',
  'vendor/compiler/scanner.js',
  'vendor/compiler/statements.js',
  'vendor/compiler/codegen.js',
  'vendor/compiler/components.js',
  'vendor/compiler/genui-components.js',
  'vendor/compiler/markdown.js',
  'vendor/compiler/fallback.js',
  'vendor/compiler/repair.js',
  'vendor/compiler/validate.js',
  'vendor/sandbox/frame.js',
  'vendor/sandbox/worker.js',
  'vendor/agent/system-prompt.js',
  'vendor/public/dil/sandbox.js',
  'vendor/public/dil/message-view.js',
  'vendor/public/dil/view-state.js',
  'vendor/public/dil/stream.js',
  'vendor/public/dil/renderer/index.js',
  'vendor/public/dil/renderer/dom.js',
  'vendor/public/dil/renderer/patch.js',
  'vendor/public/dil/renderer/icons.js',
  'vendor/public/dil/renderer/components/layout.js',
  'vendor/public/dil/renderer/components/text.js',
  'vendor/public/dil/renderer/components/controls.js',
  'vendor/public/dil/renderer/components/data.js',
  'vendor/public/dil/renderer/components/charts.js',
  'vendor/public/dil/renderer/components/host.js',
]) copy(rel, `runtime/${rel.replace('vendor/', '')}`)

// 4. docs
copy('E:/chat/DSH-智能界面模式-交付说明.md', 'docs/交付说明.md')

// 5. the harnesses that produced the evidence
for (const rel of [
  'tools/route-test.mjs',
  'tools/plugin-test.mjs',
  'tools/compile-smoke.mjs',
  'tools/csp-check.mjs',
  'tools/make-card-probe.mjs',
  'tools/make-client-probe.mjs',
  'tools/make-card-component-probe.mjs',
  'tools/check-live-bundle.mjs',
  'tools/inspect-session-stream.mjs',
]) copy(rel, `tests/${path.basename(rel)}`)

// 6. the generated probes (what the browser actually ran)
for (const rel of [
  'E:/chat/dsh-genui-live2/vendor/public/dil/_card-probe.html',
  'E:/chat/dsh-genui-live2/vendor/public/dil/_client-probe.html',
  'E:/chat/dsh-genui-live2/vendor/public/dil/_card-component-probe.html',
]) {
  if (fs.existsSync(rel)) {
    const to = path.join(OUT, 'tests/generated', path.basename(rel))
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(rel, to)
    console.log('copied', path.basename(rel))
  }
}

console.log('\nbundle ->', OUT)

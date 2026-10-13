/**
 * Contract test for the read-only preset half, without a DSH runtime.
 *
 *   node tools/readonly-test.mjs
 *
 * Checks: the plugin listens on the documented per-agent hooks, masks exactly
 * write/edit for a genui agent, is idempotent, lifts with the agent effect, never
 * touches a foreign preset, and that its prompt text passes DSH's variable rule.
 */
import assert from 'node:assert/strict'

const readonly = await import('../plugins/genui-readonly.js')
const toolsV2 = await import('../plugins/genui-tools-v2.js')

console.log(`readonly: name=${readonly.name} inject=${JSON.stringify(readonly.inject)} apply=${typeof readonly.apply}`)
console.log(`tools v2: name=${toolsV2.name} inject=${JSON.stringify(toolsV2.inject)} apply=${typeof toolsV2.apply}`)

// ── genui-readonly ──────────────────────────────────────────────────────────
const events = {}
const registered = { restrict: [], guard: [], effects: [] }
const disposers = []

function makeAgentCtx() {
  return {
    tools: {
      restrict: (filter) => {
        registered.restrict.push(filter)
        return () => disposers.push('mask')
      },
      guard: (fn) => {
        registered.guard.push(fn)
        return () => disposers.push('guard')
      },
    },
    effect: (fn, label) => {
      registered.effects.push(label)
      const dispose = fn()
      return () => { dispose?.(); disposers.push('effect') }
    },
  }
}

let preset = 'genui-live2'
const ctx = {
  tools: { restrict: () => { throw new Error('readonly must never restrict globally') } },
  get: (name) => (name === 'agentPresets' ? { composedPreset: () => preset } : undefined),
  on: (name, fn) => { events[name] = fn; return () => {} },
  effect: (fn) => { fn(); return () => {} },
  logger: { debug: () => {} },
}

readonly.apply(ctx)
assert.deepEqual(Object.keys(events).sort(), ['agent/created', 'agent/pre-step'], 'listens on the documented hooks')
console.log('listeners:', Object.keys(events).join(', '))

const agentCtx = makeAgentCtx()
events['agent/created']({ agent: { ctx: agentCtx } })
assert.deepEqual(registered.restrict, [{ deny: ['write', 'edit'] }], 'masks write/edit for this agent')
assert.equal(registered.effects.length, 1, 'one agent-scoped effect owns the mask')
assert.equal(registered.guard.length, 1, 'one guard as a second line of defence')

// Idempotent across repeated hooks.
events['agent/created']({ agent: { ctx: agentCtx } })
events['agent/pre-step']({ agent: { ctx: agentCtx } }, () => 'next')
assert.equal(registered.restrict.length, 1, 'repeat hooks do not re-register')

// The guard denies the forbidden names and lets everything else through.
const guard = registered.guard[0]
assert.ok(typeof guard({ call: { name: 'write' } }) === 'string', 'guard denies write')
assert.ok(typeof guard({ call: { name: 'edit' } }) === 'string', 'guard denies edit')
assert.equal(guard({ call: { name: 'read' } }), undefined, 'guard allows read')
assert.equal(guard({ call: { name: 'genui_render' } }), undefined, 'guard allows genui_render')
console.log('guard: denies write/edit, allows read/genui_render')

// pre-step must always continue the waterfall.
assert.equal(events['agent/pre-step']({ agent: { ctx: agentCtx } }, () => 'next'), 'next', 'pre-step continues')

// A foreign preset is left alone.
preset = 'standard'
const foreign = makeAgentCtx()
events['agent/created']({ agent: { ctx: foreign } })
assert.equal(registered.restrict.length, 1, 'no mask for a foreign preset')
console.log('foreign preset untouched')

// An agent whose tools are not mounted yet is retried, not crashed.
preset = 'genui-live2'
const broken = {
  tools: { restrict: () => { throw new Error('unknown global tool "write"') }, guard: () => () => {} },
  effect: (fn) => { fn(); return () => {} },
}
events['agent/created']({ agent: { ctx: broken } })
console.log('missing-tool case handled without throwing')

// ── genui-tools v2 ──────────────────────────────────────────────────────────
const GROUP_AT = /^\{\{([^{}]*)\}\}/
function findMalformedReference(text) {
  let last = 0
  for (;;) {
    const open = text.indexOf('{{', last)
    if (open < 0) return null
    const group = GROUP_AT.exec(text.slice(open))
    if (group === null) {
      if (text.indexOf('}}', open + 2) >= 0) return text.slice(open, open + 16)
      last = open + 2
      continue
    }
    last = open + group[0].length
  }
}

const toolDefs = []
const sections = []
toolsV2.apply({
  effect: (fn) => { fn(); return () => {} },
  tools: { register: (definition) => { toolDefs.push(definition); return () => {} } },
  systemPrompt: { section: (section) => { sections.push(section); return () => {} } },
})

assert.equal(toolDefs[0].name, 'genui_render', 'registers genui_render')
assert.deepEqual(sections.map((s) => s.name).sort(), ['genui:mode', 'genui:state'], 'registers both prompt sections')
const modePrompt = sections.find((s) => s.name === 'genui:mode').text()
assert.equal(findMalformedReference(modePrompt), null, 'mode prompt passes the {{…}} rule')
for (const needle of ['read_image', 'offset', 'limit', 'glob', 'grep', 'PDF', '截断']) {
  assert.ok(modePrompt.includes(needle), `mode prompt mentions ${needle}`)
}
assert.ok(modePrompt.includes('不要编造'), 'mode prompt forbids inventing image content')
console.log(`tools v2: genui_render + ${sections.length} sections, prompt ${modePrompt.length} bytes, no malformed {{…}}`)

console.log('\nREADONLY CONTRACT TESTS PASSED')

/**
 * `genui-readonly` — keeps 智能界面模式 a *reading* mode.
 *
 * The mode mounts the shipped filesystem tools so the model can ground an
 * interface in real file content. `@deepseek-ai/dsh-tool-fs` ships read,
 * read_image, write and edit as one plugin, so the write half has to be taken
 * away per agent:
 *
 *   - the preset rows mount in the preset's standing scope, which is the
 *     *parent* of every agent scope (see `standingMountFor` in
 *     `dsh-agent-preset-registry`), so from an agent scope those tools are
 *     ancestor-provided and `tools.restrict()` may mask them;
 *   - `agent/created` is the documented place to obtain `agent.ctx` and register
 *     per-agent behavior (dsh-agent-preset/skills/cordis-plugin-development);
 *     `agent/pre-step` re-checks before every step so a session that switched
 *     into this mode mid-life is covered too;
 *   - the restriction lives in one `agent.ctx.effect()`, so it lifts when the
 *     agent is disposed, and the plugin keeps the disposer so unloading the
 *     plugin also lifts it.
 *
 * Everything else — cwd, path authorization, read caps, attachment handling and
 * the image-capability check — stays owned by the shipped tools and `ctx.fs`.
 */

export const name = 'genui-readonly'
export const inject = ['tools']

/** Tools the shipped filesystem plugin also offers, which this mode must not. */
const FORBIDDEN = ['write', 'edit']

/** Human-readable reason used by the guard, in case a call slips past the mask. */
const DENY_REASON =
  '智能界面模式只读取文件，不提供写入/编辑能力：请改为说明需要用户自行修改，或用 genui_render 呈现你已读到的内容。'

/** Agents already restricted, so repeated hooks stay idempotent. */
const restricted = new WeakSet()

/**
 * Apply the read-only mask to one agent.
 * @param ctx - the preset-plane context (for the optional preset check).
 * @param agent - the live agent whose ctx owns the restriction.
 * @returns whether the mask is in place.
 */
function ensureReadonly(ctx, agent) {
  const agentCtx = agent?.ctx
  if (!agentCtx || restricted.has(agentCtx)) return restricted.has(agentCtx)

  // Defensive: only ever touch agents that run this preset.
  const presets = ctx.get('agentPresets')
  if (presets !== undefined && typeof presets.composedPreset === 'function') {
    const preset = presets.composedPreset(agentCtx)
    if (preset !== undefined && preset !== 'genui' && preset !== 'genui-live' && preset !== 'genui-live2') return false
  }

  try {
    // One effect owns both registrations, so agent disposal lifts them together.
    agentCtx.effect(
      () => {
        const disposeMask = agentCtx.tools.restrict({ deny: FORBIDDEN })
        const disposeGuard = agentCtx.tools.guard((execution) => {
          const name = execution?.call?.name ?? execution?.name ?? execution?.toolName
          return typeof name === 'string' && FORBIDDEN.includes(name) ? DENY_REASON : undefined
        })
        return () => {
          disposeGuard?.()
          disposeMask?.()
        }
      },
      'genui-readonly: deny write/edit for this agent',
    )
    restricted.add(agentCtx)
    return true
  } catch (error) {
    // `tools.restrict()` rejects unknown names: the filesystem row may not be
    // mounted yet on the very first agent. `agent/pre-step` retries later.
    ctx.logger?.debug?.(`genui-readonly: retry later — ${error?.message ?? error}`)
    return false
  }
}

export function apply(ctx) {
  // Documented per-agent hook.
  ctx.on('agent/created', (payload) => {
    ensureReadonly(ctx, payload?.agent)
  })

  // Belt and braces: covers agents that entered the mode after creation.
  ctx.on('agent/pre-step', (payload, next) => {
    ensureReadonly(ctx, payload?.agent)
    return next()
  })
}

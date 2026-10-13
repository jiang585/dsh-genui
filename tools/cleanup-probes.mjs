/**
 * Remove every throwaway probe bundle installed while bisecting the loader
 * behaviour, leaving only the real plugin bundle (and optionally the live copy).
 *
 *   node tools/cleanup-probes.mjs            # list what would be removed
 *   node tools/cleanup-probes.mjs --apply    # actually call the plugin manager
 *
 * The plugin manager is a DSH tool, not a shell command, so this script prints
 * the exact calls; the agent session performs them.
 */
const PROBES = [
  '@local/dsh-probe',
  '@local/dsh-probe-esm',
  '@local/dsh-probe-cjs',
  '@local/dsh-probe-client',
  '@local/dsh-probe-esmrel',
  '@local/dsh-probe-dyn',
  '@local/dsh-probe-u1',
  '@local/dsh-probe-real',
  '@local/dsh-intelligent-ui3',
]

console.log('bundle removals to perform (plugin_manager remove_bundle):')
for (const name of PROBES) console.log(`  - ${name}`)
console.log('\nkeep:')
console.log('  - dsh-genui   (正式插件包 / 模式 id: genui)')
console.log('  - @local/dsh-live-ui          (live 验证副本 / 模式 id: genui-live，可随时删除)')
console.log('\ndirectories that may be deleted on disk after the removals:')
for (const dir of [
  'E:/chat/probe-plugin',
  'E:/chat/probe-esm',
  'E:/chat/probe-cjs',
  'E:/chat/probe-client',
  'E:/chat/probe-esmrel',
  'E:/chat/probe-dyn',
  'E:/chat/probe-u1',
  'E:/chat/probe-u2',
  'E:/chat/probe-real',
  'E:/chat/dsh-genui-v3',
]) console.log(`  - ${dir}`)

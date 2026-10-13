/**
 * Publish-readiness check: everything another user's `dsh plugin add <spec>`
 * depends on, verified from the repository itself.
 *
 *   node tools/check-publish-metadata.mjs
 *
 * Checks the three-part identity (package name == patch row name == client
 * bundle id), portable plugin specifiers, package metadata required by the
 * official plugin contract, licence/attribution files, README install markers
 * and credits, and the absence of install-time build hooks.
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)

let failures = 0
let checks = 0
function check(ok, label, detail = '') {
  checks += 1
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  return ok
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const manifest = JSON.parse(read('package.json'))
const patchText = read('cordis.patch.yml')
const clientText = read('lib/client.js')
const readme = read('README.md')

console.log('── package identity ──')
check(/^[a-z0-9][a-z0-9._-]*$/.test(manifest.name), 'package name is registry-shaped', manifest.name)
check(manifest.private !== true, 'package is installable (no "private": true)')
check(manifest.license === 'MIT', 'license field is MIT')
check(
  typeof manifest.repository?.url === 'string' && manifest.repository.url.includes('github.com/jiang585/dsh-genui'),
  'repository points at the GitHub repo',
  manifest.repository?.url,
)
check(manifest.type === 'module', 'type is module')
check(manifest.main === 'lib/host.js', 'main is the host half')
check(fs.existsSync(path.join(ROOT, 'lib/host.js')), 'host half exists')
check(fs.existsSync(path.join(ROOT, 'lib/client.js')), 'client half exists')

console.log('\n── dsh plugin contract ──')
check(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch declared')
check(manifest.dsh?.client?.platform === 'web', 'dsh.client.platform is web')
check(Array.isArray(manifest.dsh?.client?.inject), 'dsh.client.inject declared')
check(typeof manifest.dsh?.engines?.dsh === 'string', 'dsh.engines.dsh declared', manifest.dsh?.engines?.dsh)
check(typeof manifest.peerDependencies?.['@deepseek-ai/dsh'] === 'string', 'peerDependencies["@deepseek-ai/dsh"] declared', manifest.peerDependencies?.['@deepseek-ai/dsh'])
check(manifest.peerDependenciesMeta?.['@deepseek-ai/dsh']?.optional === true, 'DSH peer is optional to avoid installing another host and its build dependencies')
check(!manifest.scripts || (!manifest.scripts.prepare && !manifest.scripts.postinstall), 'no install-time build hooks (pnpm would need an allowBuilds entry)')

for (const subpath of ['.', './client', './plugins/*']) {
  check(Object.hasOwn(manifest.exports ?? {}, subpath), `exports["${subpath}"] declared`)
}

console.log('\n── files that must ship ──')
for (const rel of ['lib', 'plugins', 'vendor', 'cordis.patch.yml']) {
  check((manifest.files ?? []).includes(rel), `files[] includes ${rel}`)
}

console.log('\n── three-part identity ──')
const clientId = clientText.match(/__ModuleLoader__\s*\.\s*load\(\s*\{\s*id:\s*'([^']+)'/)?.[1]
check(clientId === manifest.name, 'client bundle id == package name', `bundle=${clientId} package=${manifest.name}`)

const YAML = require(path.join('C:', 'Users', 'HP', '.dsh', 'profiles', 'desktop', 'node_modules', 'yaml'))
const rows = YAML.parse(patchText)
const inserted = rows.find((row) => row?.insert)?.insert ?? []
const bundleRow = inserted.find((row) => row.name === manifest.name)
check(bundleRow !== undefined, `bundle patch row name == package name`, `row id ${bundleRow?.id}`)

const presetRow = inserted.find((row) => row.config?.id === 'genui')
check(presetRow !== undefined, 'preset row (id genui) present')
const pluginRows = presetRow?.config?.plugins ?? []
check(pluginRows.length >= 6, 'preset mounts the expected plugin rows', pluginRows.map((r) => r.id).join(', '))

console.log('\n── portable plugin specifiers ──')
const localRows = pluginRows.filter((row) => String(row.name).includes('/'))
for (const row of localRows) {
  check(
    String(row.name).startsWith(`${manifest.name}/`) || !String(row.name).includes('dsh-genui'),
    `row ${row.id} uses a package-subpath specifier`,
    row.name,
  )
  if (String(row.name).startsWith(`${manifest.name}/`)) {
    let resolved = null
    try { resolved = require.resolve(row.name) } catch { /* reported below */ }
    check(resolved !== null, `row ${row.id} resolves from the profile root`, resolved ?? row.name)
  }
}
check(!/file:\/\/\/[A-Za-z]:/.test(patchText), 'no absolute file:// path in the patch')
check(!/[A-Za-z]:\\\\?\\?chat/i.test(patchText), 'no absolute Windows path in the patch')
check(!patchText.includes('\uFEFF'), 'patch has no BOM')

console.log('\n── shipped files stay path-free ──')
const shipped = []
const walk = (rel) => {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) return
  const stat = fs.statSync(abs)
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(abs)) walk(path.join(rel, entry))
    return
  }
  shipped.push(rel)
}
for (const rel of ['lib', 'plugins', 'vendor']) walk(rel)
const offenders = shipped.filter((rel) => /\.(mjs|cjs|js|json|html|yml)$/.test(rel) && /[A-Za-z]:[\\/](chat|Users)[\\/]/.test(fs.readFileSync(path.join(ROOT, rel), 'utf8')))
check(offenders.length === 0, 'no developer-machine absolute paths in shipped sources', offenders.join(', '))

console.log('\n── licence and attribution ──')
check(fs.existsSync(path.join(ROOT, 'LICENSE')), 'root LICENSE exists')
check(read('LICENSE').includes('MIT'), 'root LICENSE is MIT')
check(fs.existsSync(path.join(ROOT, 'vendor/THIRD-PARTY.md')), 'vendor/THIRD-PARTY.md exists')
check(fs.existsSync(path.join(ROOT, 'vendor/LICENSE-intelligent-ui-demo')), 'upstream MIT licence vendored')
check(!/copyright \(c\) 2026 DJJ/i.test(read('LICENSE')), 'root LICENSE credits only this project')

console.log('\n── README ──')
check(!readme.includes('（安装命令待补）'), 'install section no longer a placeholder')
check(/dsh plugin --profile/.test(readme), 'README shows the official install command')
for (const [label, needle] of [
  ['X 灵感来源', 'x.com/rabi_guha/status/2108238432355123572'],
  ['实现拆解博客', 'blog.pdjjq.org/post/detailed-explanation-of-intelligent-ui-implementation-4rp54'],
  ['复刻参考仓库', 'github.com/Disdjj/intelligent-ui-demo'],
  ['linuxdo 致谢', 'linux.do'],
]) {
  check(readme.includes(needle), `README credits: ${label}`)
}

console.log(`\n${failures === 0 ? 'PUBLISH METADATA OK' : `PUBLISH METADATA FAILURES: ${failures}`} (${checks - failures}/${checks} checks)`)
process.exitCode = failures === 0 ? 0 : 1

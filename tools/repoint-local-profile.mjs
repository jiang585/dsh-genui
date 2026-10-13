/**
 * Repoint the local desktop profile at the renamed package (`dsh-genui`) and
 * leave a backup behind. Idempotent.
 *
 *   node tools/repoint-local-profile.mjs [--dry]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dry = process.argv.includes('--dry')
const PROFILE = path.join(os.homedir(), '.dsh', 'profiles', 'desktop')
const MANIFEST = path.join(PROFILE, 'package.json')
const OLD = '@local/dsh-intelligent-ui'
const NEW = 'dsh-genui'
const LINK = 'link:E:/chat/dsh-genui'

const text = fs.readFileSync(MANIFEST, 'utf8')
const manifest = JSON.parse(text)

const deps = manifest.dependencies ?? {}
if (deps[OLD] !== undefined) {
  delete deps[OLD]
  console.log(`dependencies: removed ${OLD}`)
}
if (deps[NEW] !== LINK) {
  deps[NEW] = LINK
  console.log(`dependencies: ${NEW} = ${LINK}`)
}
manifest.dependencies = Object.fromEntries(
  Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
)

const bundles = manifest.dsh?.profile?.bundles ?? []
const nextBundles = bundles.map((name) => (name === OLD ? NEW : name))
if (nextBundles.length !== new Set(nextBundles).size) throw new Error('duplicate bundle entry after rename')
manifest.dsh.profile.bundles = nextBundles
console.log('bundles:', nextBundles.join(', '))

const out = `${JSON.stringify(manifest, null, 2)}\n`
if (dry) {
  console.log('--- would write ---')
  console.log(out)
} else {
  if (out === text) {
    console.log('manifest already up to date')
  } else {
    const backup = `${MANIFEST}.bak-before-dsh-genui-rename`
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, text, 'utf8')
    fs.writeFileSync(MANIFEST, out, 'utf8')
    console.log('wrote', MANIFEST, '(backup:', path.basename(backup) + ')')
  }
}

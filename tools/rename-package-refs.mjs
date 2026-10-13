/**
 * One-off: repoint tooling from the old local package name to the published
 * package name `dsh-genui` (exact match only, so `@local/dsh-intelligent-ui3`
 * variant defaults stay intact).
 *
 *   node tools/rename-package-refs.mjs [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'E:/chat/dsh-genui/tools'
const PATTERN = /@local\/dsh-intelligent-ui(?![\w-])/g
const dry = process.argv.includes('--dry')

let touched = 0
for (const entry of fs.readdirSync(DIR, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  if (!/\.(mjs|cjs|js|json|md)$/.test(entry.name)) continue
  const file = path.join(DIR, entry.name)
  const before = fs.readFileSync(file, 'utf8')
  const after = before.replace(PATTERN, 'dsh-genui')
  if (after === before) continue
  const hits = (before.match(PATTERN) ?? []).length
  console.log(`${dry ? 'would update' : 'updated'} ${entry.name} (${hits} refs)`)
  if (!dry) fs.writeFileSync(file, after, 'utf8')
  touched += 1
}
console.log(`${dry ? 'would touch' : 'touched'} ${touched} files`)

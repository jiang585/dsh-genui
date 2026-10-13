/**
 * Pre-flight: the profile patch must still parse as YAML after the generated
 * override block is appended (`!!js` scalars get a permissive custom tag).
 *
 *   node tools/validate-profile-patch.mjs
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const require = createRequire('file:///C:/Users/HP/.dsh/profiles/desktop/node_modules/')
const YAML = require('yaml')

const file = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'cordis.patch.yml')
const text = fs.readFileSync(file, 'utf8')

const jsTag = { tag: '!!js', resolve: (value) => ({ __jsExpr: value }) }
const doc = YAML.parse(text, { customTags: [jsTag] })

if (!Array.isArray(doc)) throw new Error('profile patch is not a top-level array')
const ids = doc.map((row) => row?.id).filter(Boolean)
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)

console.log(`parsed ${doc.length} rows, ${ids.length} with ids`)
console.log('override present:', ids.includes('preset-genui-live2'))
if (duplicates.length) {
  console.log('DUPLICATE row ids:', [...new Set(duplicates)].join(', '))
  process.exitCode = 1
} else {
  console.log('no duplicate row ids')
}

const row = doc.find((entry) => entry?.id === 'preset-genui-live2')
if (row) {
  const plugins = row.config?.plugins ?? []
  console.log('preset id:', row.config?.id, '| name:', row.config?.name)
  console.log('plugin rows:', plugins.map((p) => `${p.id}:${p.name}`).join('\n              '))
}

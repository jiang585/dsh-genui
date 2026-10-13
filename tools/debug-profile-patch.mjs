/** Debug: dump the parsed override row so structural problems are visible. */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const require = createRequire('file:///C:/Users/HP/.dsh/profiles/desktop/node_modules/')
const YAML = require('yaml')

const file = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'cordis.patch.yml')
const text = fs.readFileSync(file, 'utf8')
const doc = YAML.parse(text)

console.log('rows:', doc.length)
for (const row of doc) {
  const plugins = row?.config?.plugins
  console.log(
    `- id=${row?.id} name=${row?.name} presetId=${row?.config?.id ?? '-'} plugins=${Array.isArray(plugins) ? plugins.length : typeof plugins}`,
  )
}

const override = doc.find((row) => row?.id === 'preset-genui-live2')
console.log('\noverride config keys:', Object.keys(override?.config ?? {}).join(', '))
console.log('override plugins:', JSON.stringify(override?.config?.plugins?.map((p) => ({ id: p.id, name: p.name })), null, 2))

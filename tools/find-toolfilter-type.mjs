/** Find which typert type declares `toolFilter`, and print it fully. */
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const asar = 'E:/deepseekHarnessDesktop/resources/app.asar'
const target = 'dsh/node_modules/@deepseek-ai/dsh-agent-preset-registry/lib/typert.host.js'
const out = spawnSync(process.execPath, ['E:/chat/_asar.mjs', 'read', target], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const text = out.stdout

// The catalog is a JSON array of { name, declaration } entries.
const matches = [...text.matchAll(/\{\s*"name":\s*"([A-Za-z0-9_]+)",\s*"declaration":\s*"((?:[^"\\]|\\.)*)"/g)]
for (const [, name, raw] of matches) {
  const declaration = JSON.parse(`"${raw}"`)
  if (declaration.includes('toolFilter')) {
    console.log(`=== ${name} ===`)
    console.log(declaration)
    console.log()
  }
}
console.log('entries scanned:', matches.length)

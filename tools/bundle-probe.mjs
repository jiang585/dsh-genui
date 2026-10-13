/** Compute the client-module bundle revision and probe the served bundle. */
import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'

const HASH_REVISION_LENGTH = 12

function framedHash(domain, parts) {
  const hash = createHash('sha1').update(domain).update('\0')
  for (const part of parts) hash.update(`${String(Buffer.byteLength(part))}:`).update(part)
  return hash.digest('hex').slice(0, HASH_REVISION_LENGTH)
}

function artifactRevision(baseline) {
  return framedHash('plugin-artifact', [
    String(baseline.mtimeMs),
    String(baseline.ctimeMs),
    String(baseline.size),
  ])
}

const targets = [
  ['dsh-genui', 'E:/chat/dsh-genui/lib/client.js'],
  ['@local/dsh-intelligent-ui3', 'E:/chat/dsh-genui-v3/lib/client.js'],
  ['@linxin666/dsh-client-ui-skin-center', 'C:/Users/HP/.dsh/profiles/desktop/node_modules/@linxin666/dsh-client-ui-skin-center/lib/client.js'],
]

for (const [id, file] of targets) {
  const stat = statSync(file)
  const rev = artifactRevision(stat)
  const single = `http://127.0.0.1:19387/plugins/${id}/client.js?rev=${rev}`
  const combo = `http://127.0.0.1:19387/plugins/??${id}/client.js&rev=${rev}`
  for (const url of [single, combo]) {
    const response = await fetch(url)
    const body = await response.text()
    console.log(`${response.status} ${body.length.toString().padStart(6)}  ${id}  ${url.includes('??') ? 'combo' : 'single'}`)
  }
}

/** Check the live copy's served client bundle carries the new streaming/height code. */
import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'

const file = process.argv[2] ?? 'E:/chat/dsh-genui-live2/lib/client.js'
const pkg = process.argv[3] ?? '@local/dsh-live-ui2'

const stat = statSync(file)
const hash = createHash('sha1').update('plugin-artifact').update('\0')
for (const part of [String(stat.mtimeMs), String(stat.ctimeMs), String(stat.size)]) {
  hash.update(`${String(Buffer.byteLength(part))}:`).update(part)
}
const rev = hash.digest('hex').slice(0, 12)
const url = `http://127.0.0.1:19387/plugins/??${pkg}/client.js&rev=${rev}`
const response = await fetch(url)
const text = await response.text()

console.log(`rev ${rev} | HTTP ${response.status} | bytes ${text.length}`)
for (const [label, needle] of [
  ['streaming status (写作中)', '写作中'],
  ['warm handshake', "'warm'"],
  ['timeline reporting', 'reportTimeline'],
  ['height cap 8000', 'MAX_HEIGHT = 8000'],
  ['slim bar (5px 10px)', "'5px 10px'"],
]) {
  console.log(`  ${text.includes(needle) ? 'PASS' : 'FAIL'}  ${label}`)
}

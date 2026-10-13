/** Dump a session's event timeline compactly (type + short preview). */
import fs from 'node:fs'
import zlib from 'node:zlib'

const file = process.argv[2]
const buffer = fs.readFileSync(file)
const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const starts = []
for (let at = buffer.indexOf(magic); at >= 0; at = buffer.indexOf(magic, at + 1)) starts.push(at)
const parts = []
for (let index = 0; index < starts.length; index += 1) {
  try {
    parts.push(zlib.zstdDecompressSync(buffer.subarray(starts[index], starts[index + 1] ?? buffer.length)))
  } catch { /* torn tail */ }
}
const lines = Buffer.concat(parts).toString('utf8').split('\n').filter(Boolean)
console.log(`${lines.length} events\n`)

for (const [index, line] of lines.entries()) {
  let event
  try {
    event = JSON.parse(line)
  } catch {
    console.log(`${String(index).padStart(3)}  <unparsed> ${line.slice(0, 120)}`)
    continue
  }
  const type = event.type ?? event.kind ?? Object.keys(event).slice(0, 3).join('+')
  const payload = JSON.stringify(event)
  const markers = []
  if (payload.includes('genui_render')) markers.push('genui_render')
  if (payload.includes('argsRaw')) markers.push('argsRaw')
  if (payload.includes('tool/call')) markers.push('tool/call')
  if (payload.includes('tool/result')) markers.push('tool/result')
  console.log(`${String(index).padStart(3)}  ${String(type).padEnd(22)} ${payload.length.toString().padStart(6)}B  ${markers.join(',')}`)
  if (markers.includes('genui_render') || markers.includes('argsRaw')) {
    const args = payload.match(/"argsRaw":"((?:[^"\\]|\\.){0,80})/)?.[1] ?? ''
    const source = payload.match(/"source":"((?:[^"\\]|\\.){0,60})/)?.[1] ?? ''
    if (args) console.log(`        argsRaw[80]: ${args}`)
    if (source) console.log(`        source[60]: ${source}`)
  }
}

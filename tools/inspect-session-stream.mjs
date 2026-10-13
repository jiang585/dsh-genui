/**
 * Inspect the newest session logs for the genui_render tool call: did the
 * provider stream the tool-call arguments incrementally (argsRaw prefixes), or
 * did they arrive in one piece? That decides how "render as it is written" can
 * be made faster.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

/** Session logs are append-only JSONL: concatenated zstd frames, and the last
 *  one may be half-written while the host still holds the file open. Walk the
 *  magic numbers and decode frame by frame, ignoring a torn tail. */
async function decompress(file) {
  const buffer = fs.readFileSync(file)
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  for (let at = buffer.indexOf(magic); at >= 0; at = buffer.indexOf(magic, at + 1)) starts.push(at)
  const parts = []
  for (let index = 0; index < starts.length; index += 1) {
    const slice = buffer.subarray(starts[index], starts[index + 1] ?? buffer.length)
    try {
      parts.push(zlib.zstdDecompressSync(slice))
    } catch { /* torn or unknown frame */ }
  }
  return Buffer.concat(parts).toString('utf8')
}

const dir = 'C:/Users/HP/.dsh/sessions'
const files = fs
  .readdirSync(dir, { recursive: true })
  .filter((name) => String(name).endsWith('.zstd'))
  .map((name) => path.join(dir, String(name)))
  .map((file) => ({ file, mtime: fs.statSync(file).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, 4)

for (const { file, mtime } of files) {
  const raw = fs.readFileSync(file)
  let text
  try {
    text = await decompress(file)
  } catch (error) {
    console.log(`${path.basename(file)} (${new Date(mtime).toLocaleTimeString()}) 鈥?decompress failed: ${error.message}`)
    continue
  }
  const lines = text.split('\n').filter(Boolean)
  const genui = lines.filter((line) => line.includes('genui_render'))
  console.log(`\n=== ${path.basename(file)} 路 ${new Date(mtime).toLocaleString()} 路 ${(raw.length / 1024) | 0} KB 路 ${lines.length} events 路 genui_render mentions: ${genui.length}`)
  if (!genui.length) continue

  // Look at the argument growth across assistant-step / tool-call events.
  const sizes = []
  for (const line of lines) {
    if (!line.includes('argsRaw') && !line.includes('genui_render')) continue
    const match = line.match(/"argsRaw":"((?:[^"\\]|\\.)*)"/)
    if (match) sizes.push(match[1].length)
  }
  console.log('  argsRaw lengths in event order:', sizes.slice(0, 40).join(', '))
  console.log('  distinct sizes:', [...new Set(sizes)].length, '| max:', Math.max(0, ...sizes))
  const kinds = {}
  for (const line of genui) {
    const kind = line.match(/"type":"([a-z-]+)"/)?.[1] ?? line.match(/"kind":"([a-z-]+)"/)?.[1] ?? 'unknown'
    kinds[kind] = (kinds[kind] ?? 0) + 1
  }
  console.log('  event kinds touching genui:', JSON.stringify(kinds))
}


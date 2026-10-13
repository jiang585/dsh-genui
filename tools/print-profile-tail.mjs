/** Print the tail of the profile patch with exact indentation (encoding-safe). */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const file = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'cordis.patch.yml')
const text = fs.readFileSync(file, 'utf8')
const lines = text.split('\n')
console.log('total lines:', lines.length)

const begin = lines.findIndex((line) => line.includes('只读文件面覆盖 BEGIN'))
console.log('BEGIN at line:', begin + 1)
for (const line of lines.slice(begin, begin + 46)) {
  console.log(`${String(lines.indexOf(line) + 1).padStart(4)} |${line}`)
}

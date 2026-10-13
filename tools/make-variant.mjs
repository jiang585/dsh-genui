/**
 * Make a byte-fresh copy of the plugin under a new package name + entry path.
 * The DSH loader caches ESM modules (and their failures) per resolved file URL,
 * so iterating on a plugin in a live host requires a new URL every time.
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'E:/chat/dsh-genui'
const DST = process.argv[2] ?? 'E:/chat/dsh-genui-v3'
const PKG = process.argv[3] ?? '@local/dsh-intelligent-ui3'
const ROW_HOST = process.argv[4] ?? 'ui-genui-v3'
const ROW_PRESET = process.argv[5] ?? 'preset-genui-v3'

fs.rmSync(DST, { recursive: true, force: true })
fs.cpSync(SRC, DST, {
  recursive: true,
  filter: (src) => !src.includes(`${path.sep}tools`) && !src.includes('node_modules'),
})

const dstUrl = `file:///${DST.replace(/^\/+/, '')}`

// package.json: new name, entry stays lib/host.js (fresh path inside the copy)
{
  const p = path.join(DST, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'))
  pkg.name = PKG
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
}

// client half: the module id must equal the resolved package name
{
  const p = path.join(DST, 'lib', 'client.js')
  const text = fs.readFileSync(p, 'utf8').replace("dsh-genui", PKG)
  fs.writeFileSync(p, text, 'utf8')
}

// bundle patch: unique row ids + the copy's own tools plugin
{
  const p = path.join(DST, 'cordis.patch.yml')
  let text = fs.readFileSync(p, 'utf8')
  text = text.replace('dsh-genui', PKG)
  text = text.replace('ui-genui-v2', ROW_HOST).replace('preset-genui-v2', ROW_PRESET)
  text = text.replace(`file:///E:/chat/dsh-genui/plugins/genui-tools.js`, `${dstUrl}/plugins/genui-tools.js`)
  fs.writeFileSync(p, text, 'utf8')
}

console.log('copied', SRC, '->', DST)
console.log('package:', PKG, '| rows:', ROW_HOST, ROW_PRESET, '| tools:', `${dstUrl}/plugins/genui-tools.js`)

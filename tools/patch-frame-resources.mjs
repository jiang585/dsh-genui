/** Report fetched resources + the sandbox iframe state into #dbg. */
import fs from 'node:fs'

const p = 'E:/chat/dsh-genui-live/vendor/frame-page.html'
let text = fs.readFileSync(p, 'utf8')

if (!text.includes('RESOURCES ')) {
  const anchor = "      new ResizeObserver(measure).observe(document.body)"
  const inject = `      setTimeout(() => {
        const entries = performance.getEntriesByType('resource').map((e) => e.name.split('/').slice(-1)[0] + ' ' + Math.round(e.duration) + 'ms')
        dbg('RESOURCES ' + entries.join(' | '))
        const iframe = document.querySelector('iframe')
        dbg('IFRAME ' + (iframe ? iframe.getAttribute('src') + ' sandbox=' + iframe.getAttribute('sandbox') + ' inDom=' + document.contains(iframe) : 'none'))
      }, 6500)

${anchor}`
  if (!text.includes(anchor)) {
    console.log('anchor missing')
  } else {
    fs.writeFileSync(p, text.replace(anchor, inject), 'utf8')
    console.log('patched', p)
  }
} else {
  console.log('already patched')
}

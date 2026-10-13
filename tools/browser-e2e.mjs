/**
 * End-to-end browser check of the frame page, without touching the user's GUI:
 * headless Edge loads the frame URL, compiles through /genui-live/compile, runs
 * the program in the sandbox iframe + blob worker, and renders the DOM.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const url = fs.readFileSync('E:/chat/dsh-genui/tools/selftest-url.txt', 'utf8').trim()

const result = spawnSync(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=E:/chat/tmp-edge-profile',
    '--virtual-time-budget=12000',
    '--dump-dom',
    url,
  ],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 90_000 },
)

const dom = result.stdout ?? ''
const err = result.stderr ?? ''
fs.writeFileSync('E:/chat/dsh-genui/tools/selftest-dom.html', dom, 'utf8')

const checks = {
  'page loaded': dom.includes('智能界面') || dom.includes('Intelligent UI'),
  'title from query': dom.includes('自检'),
  'dil runtime mounted': dom.includes('dil-root') || dom.includes('dil-'),
  'generated title rendered': dom.includes('智能界面自检'),
  'generated button rendered': dom.includes('加一席'),
  'generated slider rendered': dom.includes('席位数'),
  'chart rendered': dom.includes('chart') || dom.includes('svg'),
  'compile status line': /ms\s*·/.test(dom),
}
console.log('dom bytes =', dom.length, '| exit =', result.status, '| stderr lines =', err.split('\n').filter(Boolean).length)
for (const [label, ok] of Object.entries(checks)) console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
const errorLine = dom.match(/id="err"[^>]*>([^<]*)</)
if (errorLine && errorLine[1].trim()) console.log('frame error text:', errorLine[1].trim().slice(0, 300))

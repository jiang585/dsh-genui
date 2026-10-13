/** Capture actual rendered DIL for README. No user GUI or model request. */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const scratch = path.join(os.tmpdir(), `genui-readme-${randomUUID()}`);
fs.mkdirSync(scratch, { recursive: true });
process.env.GENUI_STATE_FILE = path.join(scratch, 'state.json');
const { handle } = await import('../lib/host.js');
const store = await import('../lib/state-store.js');
store.bindCall('readme-preview', 'readme-preview');
const source = fs.readFileSync(new URL('./real-sales-interface.dil', import.meta.url), 'utf8');
const images = new URL('../docs/images/', import.meta.url);
fs.mkdirSync(images, { recursive: true });
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>GenUI README capture</title>
<style>html,body{margin:0;background:#f4f7fb}iframe{display:block;width:100%;height:220px;border:0}body{padding:16px}</style>
<iframe src="/genui/frame.html"></iframe><script>
const frame=document.querySelector('iframe');window.renderCount=0;
addEventListener('message',event=>{
 if(event.source!==frame.contentWindow)return;const m=event.data;
 if(m.kind==='height')frame.style.height=m.height+'px';
 if(m.kind==='rendered')renderCount++;
 if(m.kind==='ready')frame.contentWindow.postMessage({__genuiHost:true,kind:'source',callId:'readme-preview',source:${JSON.stringify(source)}},location.origin);
});</script></html>`;
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'readme=1; SameSite=Strict; Path=/' });
    res.end(html); return;
  }
  // Cookie admission is only for this isolated capture fixture. Production uses DSH connection.
  handle(req, res, r => r.headers.cookie?.includes('readme=1') ? undefined : 401);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = process.env.EDGE_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${path.join(scratch, 'browser')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 60; i++) {
    try { port = Number(fs.readFileSync(path.join(scratch, 'browser', 'DevToolsActivePort'), 'utf8').split('\n')[0]); break; } catch {}
    await sleep(150);
  }
  assert(port, 'Edge did not start');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let seq = 0; const pending = new Map();
  socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id) { pending.get(data.id)?.(data); pending.delete(data.id); } });
  const send = (method, params = {}) => new Promise(resolve => { const id = ++seq; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.result.exceptionDetails) throw new Error(JSON.stringify(result.result.exceptionDetails));
    return result.result.result.value;
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 1160, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  for (let i = 0; i < 60 && !(await evaluate('renderCount>0')); i++) await sleep(150);
  await sleep(500);
  const text = await evaluate("document.querySelector('iframe').contentDocument.querySelector('#stage').textContent");
  for (const value of ['1,016,550', '622,300', '38.8%']) assert(text.includes(value), `missing ${value}`);
  const capture = async (filename, full = false) => {
    const box = await evaluate(`(()=>{const f=document.querySelector('iframe'),r=f.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:${full ? 'r.height' : 'Math.min(r.height,650)'},scale:1}})()`);
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: box });
    fs.writeFileSync(new URL(filename, images), Buffer.from(result.result.data, 'base64'));
  };
  await capture('dashboard-light.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(400); await capture('dashboard-dark.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await evaluate("[...document.querySelector('iframe').contentDocument.querySelectorAll('button')].find(x=>x.textContent==='成本').click()");
  await evaluate("[...document.querySelector('iframe').contentDocument.querySelectorAll('button')].find(x=>x.textContent==='按季度汇总').click()");
  await sleep(800);
  assert.equal(store.stateForCall('readme-preview').view, 'quarter');
  await capture('quarterly-detail.png', true);
  console.log('Captured 3 real renderer screenshots; CSV totals and interaction verified.');
} finally {
  socket?.close(); child.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}

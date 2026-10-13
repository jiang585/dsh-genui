import http from 'node:http';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
process.env.GENUI_STATE_FILE = new URL('./browser-test-state.json',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');
const {handle}=await import('../lib/host.js');const store=await import('../lib/state-store.js');
store.bindCall('browser','browser-test');store.reportState('browser-test',{n:7},'root','browser');
const html=`<!doctype html><meta charset=utf-8><title>GenUI regression</title><style>body{margin:30px;background:#f1f5f9;font-family:system-ui}iframe{border:1px solid #dde3ed;border-radius:18px;width:700px;height:220px}h1{font-size:20px}</style><h1>GenUI browser acceptance</h1><iframe src="/genui/frame.html"></iframe><script>
const f=document.querySelector('iframe');window.metrics={heights:[],errors:[],renders:0};
addEventListener('message',e=>{if(e.source!==f.contentWindow)return;let m=e.data;if(m.kind==='height'){f.style.height=m.height+'px';metrics.heights.push(m.height)}if(m.kind==='error')metrics.errors.push(m.message);if(m.kind==='rendered')metrics.renders++;if(m.kind==='ready')send('<box gap={4}><title>Interactive workspace</title><text>Choose a value; refresh preserves your selection.</text><card><title size="sm">Seats</title><button onClick={()=>setN(n+1)}>Add a seat</button><text>{n}</text></card></box>')});
window.send=s=>f.contentWindow.postMessage({__genuiHost:true,kind:'source',callId:'browser',source:'{@body const [n,setN]=DIL.useState(1)}'+s},location.origin);
</script>`;
const server=http.createServer((req,res)=>{
 if(req.url==='/test'){res.writeHead(200,{'content-type':'text/html','set-cookie':'genui-test=1; SameSite=Strict; Path=/'});res.end(html);return}
 handle(req,res,r=>r.headers.cookie?.includes('genui-test=1') ? undefined : 401); // Isolated test server only; production delegates to DSH connection.
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const debug=9650+Math.floor(Math.random()*100);
const profile=new URL('./edge-regression-profile',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');
const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${debug}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;
try {
 let page;for(let i=0;i<40;i++){try{page=(await(await fetch(`http://127.0.0.1:${debug}/json/list`)).json()).find(x=>x.type==='page');if(page)break}catch{}await sleep(250)}
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}});
 const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}))});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value};
 await send('Page.enable');await send('Page.navigate',{url:base+'/test'});await sleep(2500);
 const restored=await evaluate("document.querySelector('iframe').contentDocument.querySelector('#stage').textContent");assert(restored.includes('7'),restored);
 await evaluate("document.querySelector('iframe').contentDocument.querySelector('button').click()");await sleep(800);assert.equal(store.stateForCall('browser').n,8);
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(new URL('./genui-preview.png',import.meta.url),Buffer.from(shot.result.data,'base64'));
 await evaluate("send('<box height={9000}><text>Long content</text></box>')");await sleep(1500);
 const high=await evaluate("parseFloat(document.querySelector('iframe').style.height)");assert(high>9000,high);
 await evaluate("send('<box><text>Short content</text></box>')");await sleep(1500);
 const short=await evaluate("parseFloat(document.querySelector('iframe').style.height)");assert(short<300,short);
 await evaluate("send('<box><text>Newest source</text></box>')");await sleep(1200);
 const report=await evaluate("({ ...metrics, text:document.querySelector('iframe').contentDocument.querySelector('#stage').textContent })");assert(report.text.includes('Newest source'));
 await evaluate("send('<box>{(()=>{while(true){}})()}</box>')");await sleep(6200);
 const quarantined=await evaluate("metrics.errors.some(x=>x.includes('unresponsive')||x.includes('timeout'))");assert(quarantined,'infinite loop not quarantined');
 console.log(JSON.stringify({restored:true,interaction:true,high,short,latest:true,quarantined,report},null,2));
} finally {ws?.close();edge.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}

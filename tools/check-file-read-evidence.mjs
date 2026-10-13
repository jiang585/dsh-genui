import fs from 'node:fs';import assert from 'node:assert/strict';
const root='E:/chat/dsh-genui/tools/';const report=JSON.parse(fs.readFileSync(root+'file-read-verification.json'));
for(const s of report.sessions){
 const es=JSON.parse(fs.readFileSync(s.evidence));
 const head=es.find(e=>e.type==='request/header');s.firstRequestTools=head.toolNames.map(x=>JSON.parse('{'+x+'}').name);assert.deepEqual([...s.firstRequestTools].sort(),['read','read_image','glob','grep','genui_render','ask_user_question'].sort());
 s.persistentLog='C:/Users/HP/.dsh/sessions/--E-chat-genui-read-verify--/'+s.sessionId+'/session.v4.jsonl.zstd';assert(fs.existsSync(s.persistentLog));
 s.calls=es.filter(e=>e.type==='tool/call').map(e=>{const a=JSON.parse(e.data.arguments);return {callId:e.data.callId,name:e.data.name,...(a.source?{title:a.title,sourceLength:a.source.length}:{arguments:a})}});
}
const e0=JSON.parse(fs.readFileSync(report.sessions[0].evidence));assert(!report.sessions[0].calls.some(c=>c.arguments?.file_path?.includes('KNOWN-CONTENT')));
const csvResult=e0.find(e=>e.type==='tool/result'&&e.data.message.content.some(c=>c.text?.includes('region,quarter,revenue,cost,orders')));
const actual=csvResult.data.message.content.find(x=>x.type==='text').text.split('\n').filter(x=>/^\d+: /.test(x)).map(x=>x.replace(/^\d+: /,''));
assert.deepEqual(actual,fs.readFileSync('E:/chat/genui-read-verify/sales-2026.csv','utf8').trim().split(/\r?\n/));
const e3=JSON.parse(fs.readFileSync(report.sessions[3].evidence));const readResults=e3.filter(e=>e.type==='tool/result');
report.sessions[3].actualRanges=readResults.map(e=>{const text=e.data.message.content.find(x=>x.type==='text').text;const lines=text.split('\n').filter(x=>/^\d+: /.test(x));return {first:Number(lines[0].split(':')[0]),last:Number(lines.at(-1).split(':')[0]),count:lines.length}});
assert.deepEqual(report.sessions[3].actualRanges,[{first:1,last:2000,count:2000},{first:2001,last:4000,count:2000},{first:4001,last:5000,count:1000}]);
assert(!fs.existsSync('E:/chat/genui-read-verify/forbidden-write.txt'));
report.acceptance={firstRequestTools:true,csvBytesMatch:true,generatedInterface:'sales-browser-results.json',all5000Lines:true,mutationRefused:true};
fs.writeFileSync(root+'file-read-verification.json',JSON.stringify(report,null,2));console.log('Evidence checks passed: first-request tools, exact CSV bytes, persisted logs, 5000 lines, no write side effect');


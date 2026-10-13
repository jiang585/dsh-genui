import fs from 'node:fs';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const Y=createRequire('C:/Users/HP/.dsh/profiles/desktop/package.json')('yaml');
const file='C:/Users/HP/.dsh/profiles/desktop/cordis.patch.yml';
const options={customTags:[{tag:'tag:yaml.org,2002:js',resolve:v=>v}]};
const before=fs.readFileSync(file);const original=Y.parseDocument(before.toString('utf8'),options);
const restored=Y.parseDocument(fs.readFileSync(file+'.bak-before-genui-read-20261013-122205','utf8'),options);
assert.equal(original.errors.length,0);assert.equal(restored.errors.length,0);
const corrections=[],preserved=[];
function merge(a,b,p=[]){
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  for(const k of Object.keys(a)){const key=Array.isArray(a)?Number(k):k;merge(a[k],b[k],[...p,key]);}return;
 }
 if(a===b)return;
 if(typeof a==='string'&&typeof b==='string'&&/[^\x00-\x7f]/.test(a+b)){corrections.push(p.join('.'));return;}
 if(a!==undefined){restored.setIn(p,original.getIn(p,true));preserved.push(p.join('.'));}
}
const current=original.toJS();merge(current,restored.toJS());
const output=restored.toString();const parsed=Y.parseDocument(output,options);assert.equal(parsed.errors.length,0);
const after=parsed.toJS();
function checkSettings(a,b,p='') {
 if(typeof a==='string'&&typeof b==='string'&&/[^\x00-\x7f]/.test(a+b)) return;
 if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of Object.keys(a))checkSettings(a[k],b[k],p+'.'+k);return}
 assert.deepEqual(b,a,`non-text setting changed at ${p}`);
}
checkSettings(current,after);
assert(output.includes("name: 'Debug 模式'"));assert(output.includes("name: 'Computer Use 模式'"));assert(!/妯″紡|锛|銆|鈹/.test(output));
fs.writeFileSync(file+'.bak-before-encoding-repair-20261013-1539',before,{flag:'wx'});
fs.writeFileSync(file,output,'utf8');
fs.writeFileSync('E:/chat/dsh-genui/tools/encoding-repair-results.json',JSON.stringify({sourceBackup:file+'.bak-before-genui-read-20261013-122205',repairedFields:corrections,preservedChangedFields:preserved,settingsUnchanged:true,utf8:true,labels:after.flatMap(r=>r.insert||[]).filter(r=>r.name==='@deepseek-ai/dsh-agent-preset').map(r=>({id:r.config.id,name:r.config.name,description:r.config.description}))},null,2));
console.log(JSON.stringify({repairedFields:corrections.length,settingsUnchanged:true,labels:after.flatMap(r=>r.insert||[]).filter(r=>r.name==='@deepseek-ai/dsh-agent-preset').map(r=>({id:r.config.id,name:r.config.name}))}));

import {createRequire} from 'node:module';import fs from 'node:fs';
const require=createRequire('C:/Users/HP/.dsh/profiles/desktop/package.json');const Y=require('yaml');
const root='C:/Users/HP/.dsh/profiles/desktop/cordis.patch.yml';
const opt={customTags:[{tag:'tag:yaml.org,2002:js',resolve:v=>v}]};
const current=Y.parseDocument(fs.readFileSync(root,'utf8'),opt);const clean=Y.parseDocument(fs.readFileSync(root+'.bak-before-default-genui-150455','utf8'),opt);
console.log(JSON.stringify({currentErrors:current.errors.map(x=>x.message),backupErrors:clean.errors.map(x=>x.message)}));
let diffs=[];
function walk(a,b,p=[]){if(typeof a==='string'&&typeof b==='string'){if(a!==b)diffs.push({path:p.join('.'),nonASCII:/[^\x00-\x7f]/.test(a+b),currentLength:a.length,backupLength:b.length});return}if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(!(k in a)||!(k in b))diffs.push({path:[...p,k].join('.'),missing:k in a?'backup':'current'});else walk(a[k],b[k],[...p,k])}}else if(a!==b)diffs.push({path:p.join('.'),type:'value'});}
walk(current.toJS(),clean.toJS());fs.writeFileSync('E:/chat/dsh-genui/tools/encoding-diff-paths.json',JSON.stringify(diffs,null,2));console.log(JSON.stringify(diffs.filter(x=>!x.nonASCII),null,2));console.log('text differences:',diffs.filter(x=>x.nonASCII).length);

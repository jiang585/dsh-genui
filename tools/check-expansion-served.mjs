import fs from 'node:fs';
import {createHash} from 'node:crypto';
for(const [dir,pkg] of [['dsh-genui-live','@local/dsh-live-ui'],['dsh-genui-live2','@local/dsh-live-ui2']]) {
 const file=`E:/chat/${dir}/lib/client.js`;const stat=fs.statSync(file);const hash=createHash('sha1').update('plugin-artifact').update('\0');
 for(const part of [String(stat.mtimeMs),String(stat.ctimeMs),String(stat.size)])hash.update(`${Buffer.byteLength(part)}:`).update(part);
 try{const response=await fetch(`http://127.0.0.1:19387/plugins/??${pkg}/client.js&rev=${hash.digest('hex').slice(0,12)}`,{signal:AbortSignal.timeout(4000)});const content=await response.text();console.log(JSON.stringify({package:pkg,status:response.status,servedExpansion:content.includes('data-genui-process-expansion')&&content.includes('[data-step-process-body]:has([data-genui-card])')}))}catch(e){console.log(JSON.stringify({package:pkg,reachable:false,error:e.message}))}
}

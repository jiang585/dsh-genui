import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
const BASE='E:/deepseekHarnessDesktop/resources/app.asar/dsh/node_modules/@deepseek-ai/';
const load=n=>import(pathToFileURL(BASE+n+'/lib/index.js').href);
const out=process.argv.includes('--capabilities')?'E:/chat/dsh-genui/tools/file-read-capabilities.json':'E:/chat/dsh-genui/tools/file-read-verification.json';
const progress=x=>{fs.writeFileSync('E:/chat/dsh-genui/tools/verification-progress.json',JSON.stringify(x,null,2));console.log(JSON.stringify(x))};
let ctx;const report={started:new Date().toISOString(),sessions:[]};
try {
 const {loadProfileDirectory,loadLayeredEnv}=await load('dsh-app-boot');const {runProfile}=await import(pathToFileURL(BASE+'dsh/lib/profile-boot.js').href);
 const dir='E:/chat/dsh-genui/tools/verify-profile';fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(dir+'/cordis.yml','[]\n');fs.writeFileSync(dir+'/package.json',JSON.stringify({name:'genui-verification',private:true,dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','@local/dsh-live-ui2']}}}));
 const link=dir+'/node_modules/@local/dsh-live-ui2';fs.mkdirSync(path.dirname(link),{recursive:true});if(!fs.existsSync(link))fs.symlinkSync('E:/chat/dsh-genui-live2',link,'junction');
 const user=fs.readFileSync('C:/Users/HP/.dsh/profiles/desktop/cordis.patch.yml','utf8');
 const normalized=user.replace(/\r\n/g,'\n').replace(/(^[ \t]*#.*\n)( {14}- text\n)/gm,'$1            input:\n$2');
 const blocks=normalized.split(/(?=^- id: )/m).filter(x=>/^\- id: (agent-default-model|llm-pi-ai|permission)\s*\n/.test(x));
 fs.writeFileSync(dir+'/cordis.patch.yml',blocks.join('\n')+'\n- id: agent-preset-registry\n  config:\n    default: genui-live2\n- id: web-runtime\n  config:\n    openBrowser: false\n    printUrl: false\n    surfaceContext: true\n- id: hmr\n  disabled: true\n- id: schedule\n  disabled: true\n- id: session-title-llm\n  disabled: true\n');
 const installAnchor=BASE+'dsh/package.json';const profile=loadProfileDirectory('dsh',dir,installAnchor);progress({stage:'booting',skipped:profile.skippedBundles});
 ({ctx}=await runProfile({environment:loadLayeredEnv('dsh'),profile:'genui-verify',resolvedProfile:{profile,installAnchor},patchFiles:[],args:['--no-open','--port','0']}));
 const {scopeOf}=await load('dsh-scope');const {createUserMessage}=await load('dsh-llm');const {installModelSelection}=await load('dsh-agent');
 const selection=ctx.agentDefaultModel.currentSelection();report.route={provider:selection.provider,model:selection.model};progress({stage:'booted',route:report.route});
 const tasks=[
 '读取 E:\\chat\\genui-read-verify\\sales-2026.csv 的真实内容，不要读取 KNOWN-CONTENT.md。然后用 genui_render 生成界面展示各区域两季度收入、成本、毛利率，并计算总收入、总成本与总毛利率。',
 '用 glob 和 grep 在 E:\\chat\\genui-read-verify 里找出含“毛利率”的文件，再用 read 读取匹配文件并简述。',
 '读取 E:\\chat\\genui-read-verify\\missing.txt，告诉我实际结果。',
 '请使用 read 分段读取 E:\\chat\\genui-read-verify\\large-5000.txt 的全部5000行，每次最多2000行，并说明实际读取的行号范围。无需生成界面。'
 ];fs.writeFileSync('E:/chat/genui-read-verify/large-5000.txt',Array.from({length:5000},(_,i)=>`row-${i+1}: value-${i+1}`).join('\n')+'\n');
 for(let index=0;index<((process.argv.includes('--roster')||process.argv.includes('--capabilities'))?1:tasks.length);index++) {
  const sessionId='session-genui-verify-'+randomUUID();
  const {agent}=await ctx.agents.create({sessionId,meta:{cwd:'E:/chat/genui-read-verify',agentPreset:'genui-live2'},agentOptions:{provider:selection.provider,model:selection.model},setup:async agentCtx=>{await ctx.agentPresets.mount(agentCtx,'genui-live2'); installModelSelection(agentCtx,{current:selection,assembled:undefined})}});await agent.whenIdle();
  const tools=ctx.tools.schemas(scopeOf(agent.ctx)).map(t=>t.name);
  const entry={index,sessionId,preset:ctx.agentPresets.composedPreset(agent.ctx),tools};report.sessions.push(entry);fs.writeFileSync(out,JSON.stringify(report,null,2));progress({stage:'roster',...entry});
  if(['write','edit','pwsh','bash','web_search','web_fetch'].some(x=>tools.includes(x)))throw new Error('forbidden tools remain');
  if(!['read','read_image','glob','grep','genui_render'].every(x=>tools.includes(x)))throw new Error('required tools missing');
  if(process.argv.includes('--capabilities')) {
   entry.capabilities=[];
   for(const [name,args] of [['read_image',{file_path:'E:/chat/dsh-genui/tools/real-sales-preview.png'}],['write',{file_path:'E:/chat/genui-read-verify/forbidden-write.txt',content:'must not write'}],['edit',{file_path:'E:/chat/genui-read-verify/sales-2026.csv',old_string:'region',new_string:'must not edit'}]]) {
    const result=await ctx.tools.execute({callId:'verify-'+randomUUID(),name,arguments:args,agent,signal:new AbortController().signal});
    entry.capabilities.push({name,isError:result.isError,error:result.error,contentTypes:result.content?.map(x=>x.type),text:result.content?.filter(x=>x.type==='text').map(x=>x.text)});
   }
   fs.writeFileSync(out,JSON.stringify(report,null,2));break;
  }
  if(process.argv.includes('--roster'))break;
  agent.followup(createUserMessage({content:[{type:'text',text:tasks[index]}],source:{kind:'user'}}));progress({stage:'running',index,sessionId});
  await agent.whenIdle();await ctx.sessions.flush(agent.session);
  const events=agent.session.snapshotEvents();
  // Persist actual request tool schemas, calls, results and final answer. Omit route/settings metadata.
  const evidence=events.filter(e=>/^(tool\/|assistant\/message|turn\/end)/.test(e.type)||JSON.stringify(e).includes('"tools"')).map(e=>e.type.includes('request')?{seq:e.seq,type:e.type,toolNames:JSON.stringify(e).match(/"name":"[^"]+"/g)}:e);
  const file=`E:/chat/dsh-genui/tools/session-${index}-evidence.json`;fs.writeFileSync(file,JSON.stringify(evidence,null,2));
  entry.evidence=file;entry.eventTypes=[...new Set(events.map(e=>e.type))];entry.final=events.filter(e=>e.type==='assistant/message').map(e=>e.data.message.content.filter(x=>x.type==='text').map(x=>x.text).join('')).slice(-1)[0];
  fs.writeFileSync(out,JSON.stringify(report,null,2));progress({stage:'finished-session',index,sessionId,eventTypes:entry.eventTypes});
 }
 report.completed=true;fs.writeFileSync(out,JSON.stringify(report,null,2));progress({stage:'complete'});
} catch(e){report.error=e.message;fs.writeFileSync(out,JSON.stringify(report,null,2));progress({stage:'error',message:e.message,stack:e.stack});process.exitCode=1;}
finally{await ctx?.fiber.dispose();process.exit(process.exitCode||0);}



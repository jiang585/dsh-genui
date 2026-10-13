import fs from 'node:fs';
const out='E:/chat/dsh-genui/tools/verification-progress.json';
try {
 const m=await import('file:///E:/deepseekHarnessDesktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/profile-boot.js');
 fs.writeFileSync(out,JSON.stringify({stage:'launcher-import',exports:Object.keys(m),node:process.version}));
} catch(e){fs.writeFileSync(out,JSON.stringify({stage:'launcher-import',error:e.message,stack:e.stack}));process.exitCode=1;}

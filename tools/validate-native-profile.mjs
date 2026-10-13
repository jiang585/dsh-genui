import fs from 'node:fs';
const {loadProfileDirectory}=await import('file:///E:/deepseekHarnessDesktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js');
const p=loadProfileDirectory('dsh','C:/Users/HP/.dsh/profiles/desktop','E:/deepseekHarnessDesktop/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json');
fs.writeFileSync('E:/chat/dsh-genui/tools/profile-native-validation.json',JSON.stringify({patches:p.patches.length,bundles:p.layers.map(x=>x.packageName),skipped:p.skippedBundles},null,2));console.log('Native profile parser passed; patch entries:',p.patches.length);

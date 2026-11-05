'use strict';
// In-memory wait labels and CDP phase tracing only. Keep all original waits,
// production source, timeouts and browser inputs unchanged.
const fs=require('node:fs'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const target=path.resolve(process.argv[2]||'tools/run_browser_smokes.js'),inventory=path.join(path.dirname(target),'browser-smoke-inventory.js'),read=Module._extensions['.js'];
console.log(JSON.stringify({scope:'browser full parity wait diagnosis; original timeouts and actions',target,runnerSha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),inventorySha256:crypto.createHash('sha256').update(fs.readFileSync(inventory)).digest('hex')}));
Module._extensions['.js']=(m,file)=>{
 if(file===inventory){read(m,file);m.exports=m.exports.map(s=>s.id!=='production-browser-full-parity'?s:{...s,actionExpression:s.actionExpression.replace('const deadline = Date.now() + timeout;',`console.log('SETI_WAIT '+label+' '+Date.now()+' '+JSON.stringify({input:window.SetiRandomizer.inspect().input.submissionSequence,owner:window.SetiRandomizer.inspect().projection.decision?.ownerId}));const deadline = Date.now() + timeout;`)});return;}
 if(file===target){let s=fs.readFileSync(file,'utf8');s=s.replace('const id = this.nextId++;',`const id = this.nextId++;if(method==='Runtime.evaluate'&&params.awaitPromise)process.stdout.write('CDP_ACTION_START '+Date.now()+'\\n');`);s=s.replace('if (message.method === "Runtime.exceptionThrown") {',`if(message.method==='Runtime.consoleAPICalled'){const text=message.params?.args?.map(a=>a.value||'').join(' ');if(text?.startsWith('SETI_WAIT '))process.stdout.write(text+'\\n');}\n      if (message.method === "Runtime.exceptionThrown") {`);m._compile(s,file);return;}
 read(m,file);
};
process.argv=[process.execPath,target,'--match','production-browser-full-parity'];require(target);

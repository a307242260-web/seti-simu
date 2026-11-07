'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),manifest='reports/ai-foundation-20261107/v371-spent-swap-offer-v1/source-manifest-20261107-v1.json',m=JSON.parse(fs.readFileSync(manifest)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {execFileSync}=require('node:child_process');
const originalSourceHashes={},validationSourceHashes={},dest=process.argv[2];assert(dest);
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b);};
function check(name){assert(!Object.hasOwn(originalSourceHashes,name));const hash=sha(name);const original=m.sourceHashes[name]||m.baseRuntimeHashes[name]||crypto.createHash('sha256').update(execFileSync('git',['show','485e8fcfe57f99980c2bc8dd3ec8b78542c6940b:'+name],{cwd:'/Users/bilibili/code/seti-simu'})).digest('hex');assert.equal(hash,original,name);originalSourceHashes[name]=hash;}
function direct(name,f){check(name);const code=f(fs.readFileSync(name,'utf8'));fs.writeFileSync(name,code);validationSourceHashes[name]=sha(name);}
function transform(driver,name,variable='code',endMarker=null,after=s=>s){
 const file=path.join(root,'adhoc',driver+'-20261107-v1.js'),p='randomizer/game/ai/'+name+'.test.js';check(p);
 let src=after(fs.readFileSync(file,'utf8'));
 const marker=endMarker||'const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile('+variable+',file);';
 assert(src.includes(marker),driver);
 src=src.slice(0,src.indexOf(marker))+'fs.writeFileSync('+JSON.stringify(p)+','+variable+');\n';
 const mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;
 const old=process.argv[2];process.argv[2]=name;try{mod._compile(src,file);}finally{process.argv[2]=old;}
 validationSourceHashes[p]=sha(p);
}
for(const name of ['known-postdraw-tail','final-round-proof-guard','analysis-lazy-explanations','amiba-analysis-capital','analysis-publicity-capital','research-mark-capital']){
 transform('diagnose-v367-functional-boundaries',name,'code',null,name!=='amiba-analysis-capital'?undefined:s=>once(s,
   'console.log(JSON.stringify({branch:name,value:endValue.total,components:endValue.components}));',
   "assert.equal(endValue.total,name==='credit'?115.5:name==='energy-B48'?119:118.5);"));
}
for(const name of ['analysis-lazy-regions','analysis-lazy-trace-contexts','analysis-region-prefix','analysis-target-trace-copy'])transform('verify-v367-analysis-source-controls',name);
for(const name of ['analysis-invariant','probe-replacement-witness','read-only-rewards'])transform('verify-v367-valuation-source-controls',name,'test');
transform('verify-v367-r4-tail-current-value','r4-company-tail','test',null,s=>{
 s=once(s,'console.log(JSON.stringify({proofs:proofs.size}));','assert.equal(proofs.size,21);');
 s=once(s,'assert(materialized>=67);','assert.equal(materialized,155);');
 return s;
});
transform('verify-v367-canonical-default-native-tail','amiba-currency-tail','src','const m=new Module(name,module);',s=>once(s,
 "globalThis.__canonicalResult={value:r.value,actionId:r.actionId,inputs:r.diagnostics.nativeExecutions};",
 "assert.equal(r.value,129.08333333333334);globalThis.__canonicalResult={value:r.value,actionId:r.actionId,inputs:r.diagnostics.nativeExecutions};"));
direct('tools/audit_v_state_inputs.js',s=>{
 s=once(s,'assert.equal(independentValue.evaluateStateValue(masked,seat).total,116.5);','assert.equal(independentValue.evaluateStateValue(masked,seat).total,119);');
 return once(s,'computer3 income116.5 and earned-B','computer3 income119 and earned-B');
});
for(const [name,hash] of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(name),validationSourceHashes[name]||hash,name);
const result={scope:'Validation-only overlay for current AI rules; retains archival outputs and Native controls. No application, rules, search, evaluation or experiment code changes.',sourceManifest:manifest,sourceManifestSha256:sha(manifest),runtimeChanged:false,originalSourceHashes,validationSourceHashes};
fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({changed:Object.keys(validationSourceHashes).length,out:dest,runtimeChanged:false}));

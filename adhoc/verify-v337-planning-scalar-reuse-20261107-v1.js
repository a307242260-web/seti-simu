'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),z=require('node:zlib'),crypto=require('node:crypto');
const dir='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function take(v){
 const path=dir+'v'+v+'-cold-income-before-amiba-20261107-v1.json',e=read(path);assert.equal(sha(e.rawPath),e.rawSha256);assert(e.rootAndRngUnchanged&&e.complete);
 const g=JSON.parse(z.gunzipSync(fs.readFileSync(e.rawPath)).toString().replace(/seti-complete-decision-search-v(?:335|337)/g,'version'));delete g.diagnostics.milliseconds;
 return {e,g};
}
const a=take(335),b=take(337);assert.equal(a.e.fixtureSha256,b.e.fixtureSha256);assert.deepEqual(a.g,b.g);
const m=read(b.e.candidateSourceManifest),relative='randomizer/game/ai/resource-demand.js';assert.equal(sha(b.e.candidateSourceManifest),b.e.candidateSourceManifestSha256);
const s=fs.readFileSync(m.changedSourceSnapshot+'/'+relative,'utf8'),before=s.replace(':stateValue.purposeCapitalValue(valueFacts(state,p));',':stateValue.purposeCapital(valueFacts(state,p)).total;');
assert.notEqual(s,before);const parent=read(m.parentManifest);assert.equal(crypto.createHash('sha256').update(before).digest('hex'),parent.sourceHashes[relative]||parent.baseRuntimeHashes[relative]);
console.log(JSON.stringify({graphV335V337Exact:true,onlyPlanningScalarPathChanged:true,inputs:b.e.nativeInputs,selection:b.e.actionId,value:b.e.value,coldMs:b.e.milliseconds,baselineColdMs:a.e.milliseconds,sourceAndRngRestored:true,newAutonomousRuns:0}));

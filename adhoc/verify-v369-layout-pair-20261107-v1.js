'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),z=require('node:zlib'),v8=require('node:v8'),Module=require('node:module'),crypto=require('node:crypto');
const F='reports/ai-foundation-20261105/third-round-teacher-v1/',D='reports/ai-foundation-20261107/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),raw=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p)));
function norm(v){if(Array.isArray(v))return v.map(norm);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>k!=='milliseconds').map(([k,x])=>[k,norm(x)]));return typeof v==='string'?v.replace(/seti-complete-decision-search-v36[89]/g,'version'):v;}
for(const label of ['income-before-amiba','r3-blue1-before-dlc19']){
 const rows=[368,369].map(n=>read(F+'v'+n+'-cold-'+label+'-20261107-v1.json'));for(const r of rows){assert.equal(sha(r.rawPath),r.rawSha256);assert(r.rootAndRngUnchanged&&r.complete);}assert.deepEqual(norm(raw(rows[0].rawPath)),norm(raw(rows[1].rawPath)));
}
const filename=require.resolve('../randomizer/game/ai/state-value'),priorManifest=read(D+'v367-canonical-default-weights-v1/source-manifest-20261107-v1.json'),previous=D+'v367-canonical-default-weights-v1/source-snapshot/randomizer/game/ai/state-value.js';
assert.equal(sha(previous),priorManifest.sourceHashes['randomizer/game/ai/state-value.js']);
function moduleFrom(source){const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;const marker='return Object.freeze({ diagnosticOrderedResearchQuotes:';assert.equal(source.split(marker).length,2);m._compile(source.replace(marker,'return Object.freeze({ privateResearchSignature:orderedResearchSignature, diagnosticOrderedResearchQuotes:'),filename);return m.exports;}
const reference=moduleFrom(fs.readFileSync(previous,'utf8')),candidate=moduleFrom(fs.readFileSync(filename,'utf8'));let cases=0;
for(const n of ['company-fixed-intent-v1/complete-capital-inputs-20261107-v1.v8.gz','portfolio-repetition-v1/hard132-full-portfolio-inputs-20261107-v1.v8.gz']){
 for(const item of v8.deserialize(z.gunzipSync(fs.readFileSync(D+n))).inputs){
  const before=JSON.stringify(item);assert.deepEqual(candidate.purposeCapital(item.facts,item.weights),reference.purposeCapital(item.facts,item.weights));assert.equal(JSON.stringify(item),before);cases++;
 }
}
const slots=n=>Object.freeze({x:n}),entries=n=>Object.freeze({y:Object.freeze({gain:n})}),wrapper=(s,e)=>({revealInitialized:true,revealedSlotId:1,symbolSlots:s,symbolsById:e}),trigger=symbols=>({available:true,rules:[],completionGroups:[],maximumScoreGain:0,maximumSingleScoreGain:0,wallet:{publicity:5,availableData:2},reason:'known-once-only-research-symbols',symbols});
const key=(s,e,paid=6)=>candidate.privateResearchSignature(3,[],null,trigger(wrapper(s,e)),paid,false);
const A=slots(1),B=entries(1),C=entries(2),first=key(A,B);
assert.equal(first,key(A,B));assert.equal(first,key(slots(1),entries(1)));assert.notEqual(first,key(A,C));assert.notEqual(first,key(A,B,5));
const layoutKeys=new Set();for(let n=10;n<42;n++)layoutKeys.add(key(slots(n),entries(n)));assert.equal(layoutKeys.size,32);
assert(!layoutKeys.has(key(A,B)));assert(!layoutKeys.has(key(A,C)));
const mutable=wrapper(slots(1),{y:{gain:1}}),t=trigger(mutable),mutableKey=()=>candidate.privateResearchSignature(3,[],null,t,6,false);
assert.equal(mutableKey(),JSON.stringify([3,[],null,t,6,false]));const before=mutableKey();mutable.symbolsById.y.gain=5;assert.notEqual(mutableKey(),before);
const child={gain:1},shallow=Object.freeze({y:child}),t2=trigger(wrapper(slots(1),shallow)),shallowKey=()=>candidate.privateResearchSignature(3,[],null,t2,6,false);assert.equal(shallowKey(),JSON.stringify([3,[],null,t2,6,false]));const old=shallowKey();child.gain++;assert.notEqual(shallowKey(),old);
assert.equal(cases,1536);
console.log(JSON.stringify({fullPortfolios:cases,changedLayoutKeys:layoutKeys.size,mutableNestedMapsNeverCached:true,exactGraphRoots:2,newAiQueries:0,newAutonomousRuns:0}));

'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),Module=require('node:module');
const stage='/private/tmp/seti-v317-case152-static-occupancy-20261107-v1/',R='reports/ai-foundation-20261107/',D=R+'teacher125-research-quotes-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const a=read(R+'teacher125-v317-hotspots-v1/v317-teacher125-swap-quotes-20261107-v1.json');assert.equal(sha(a.checkpoint),a.checkpointSha256);assert.equal(sha(a.manifest),a.manifestSha256);
const m=read(a.manifest);for(const[n,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(stage+n),h,n);
const raw=JSON.parse(z.gunzipSync(fs.readFileSync(a.checkpoint))),states=new Map(Object.entries(raw.states).map(([k,s])=>[k,JSON.parse(s)]));
function load(target,path,modify=s=>s){const f=require.resolve(stage+target),m=new Module(f,module);m.filename=f;m.paths=module.paths;m._compile(modify(fs.readFileSync(path,'utf8')),f);return m.exports;}
const valuePath='randomizer/game/ai/state-value.js',prototype=D+'state-value-research-quote-memo-prototype-20261107-v2.js';
const reference=require(stage+valuePath),candidate=load(valuePath,prototype);
const demand=load('randomizer/game/ai/resource-demand',stage+'randomizer/game/ai/resource-demand.js',s=>{const i=s.lastIndexOf('return Object.freeze({');return s.slice(0,i)+s.slice(i).replace('return Object.freeze({','return Object.freeze({diagnosticValueFacts:valueFacts,');});
const facts=raw.prices.map(row=>{const state=states.get(row.stateKey),p=state.players.players.find(p=>p.id===row.playerId);return demand.diagnosticValueFacts(state,p);});
const saved=facts.map(f=>JSON.stringify(f));let refMs=0,newMs=0;
for(const [i,f] of facts.entries()){
 const stamp=performance.now(),x=reference.purposeCapital(f);refMs+=performance.now()-stamp;
 const now=performance.now(),y=candidate.purposeCapital(f);newMs+=performance.now()-now;
 assert.equal(x.total,raw.prices[i].value);assert.deepEqual(x,y,`full portfolio incl plans ${i}`);assert.equal(JSON.stringify(f),saved[i]);
}
const corpusWork=candidate.diagnosticOrderedResearchQuotes();assert(corpusWork.hits>100000);assert(corpusWork.factories<1000);
const variants=[
 f=>f.player.publicity=6,
 f=>f.player.publicity=11,
 f=>f.player.availableData=3,
 f=>f.player.score+=1,
 f=>f.player.techState.ownedTiles.orange1=true,
 f=>f.pendingCardTriggers=[{cardInstanceId:'pending'}],
 f=>f.pendingNativeEffects=true,
 f=>f.researchCost=5,
 f=>f.researchSymbols=null,
 f=>f.passing=true,
];
let controls=0;
for(const i of [0,19,41,87,124,178,235,301])for(const mutate of variants){
 const f=structuredClone(facts[i]);mutate(f);
 for(const weights of [reference.DEFAULT_WEIGHTS,{...reference.DEFAULT_WEIGHTS,handSize:2.25,availableData:.75}]){
  assert.deepEqual(reference.purposeCapital(f,weights),candidate.purposeCapital(f,weights));controls++;
 }
}
const report={scope:'Full portfolio, all component plans and exact numeric results on 341 captured swap quotes; 160 controlled wallet, trigger, threshold and custom weight variants. Timings are paired CPU diagnostics only.',source:a.checkpoint,sourceSha256:a.checkpointSha256,prototype,prototypeSha256:sha(prototype),quotes:facts.length,controls,refMs,newMs,corpusWork,newAiQueries:0,newAutonomousRuns:0};
fs.writeFileSync(D+'research-quote-memo-validation-20261107-v2.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));

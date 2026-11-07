'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),load=p=>require(path.resolve('randomizer',p));
const manifestPath='reports/ai-foundation-20261107/v365-r3-swap-purpose-scope-v1/source-manifest-20261107-v1.json',m=read(manifestPath);for(const [p,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(p),h,p);
const {createSimulationRuleComposition}=load('training/simulation-rule-composition'),{createSeededRandom}=load('game/random'),{buildRuleObservation}=load('app/rule-observation'),{createAnalysisPort}=load('game/ai/analysis-port'),search=load('game/ai/decision-search'),values=load('game/ai/state-value'),agent=load('game/ai/search-agent');
assert.equal(search.VERSION,m.searchVersion);
const folder='reports/ai-foundation-20261105/third-round-teacher-v1/',rows=[];
for(const label of ['corpus-teacher-072','corpus-actual-v187-073','corpus-actual-v187-074']){
 const prior=folder+`v323-cold-${label}-20261107-v1.json`,bad=folder+`v364-cold-${label}-20261107-v1.json`,e=read(prior),b=read(bad),f=read(e.fixture),seed=f.source.seed;
 assert.equal(e.fixtureSha256,b.fixtureSha256);assert.equal(sha(e.fixture),e.fixtureSha256);
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
 try{const ev=values.createStateValueEvaluator(f.seatId),d=search.searchDecision({port:p,root:p.openRoot(),evaluate:ev,...agent.OPTIONS,modelKey:ev.modelKey,budget:agent.BUDGET});
  assert(d.complete&&!d.unresolved.length);assert.deepEqual(c.lifecycle.save().envelope,before);assert.equal(d.actionId,e.actionId);assert.equal(d.value,e.value);assert.equal(d.diagnostics.nativeExecutions,e.nativeInputs);
  rows.push({label,prior,priorSha256:sha(prior),bad,badSha256:sha(bad),action:d.actionId,value:d.value,inputs:d.diagnostics.nativeExecutions,rootAndRngUnchanged:true});
 }finally{p.close();c.dispose();}
}
const out={scope:'Functional parity on three earlier Native roots; no cold timings or source admission.',manifestPath,manifestSha256:sha(manifestPath),rows,newAutonomousRuns:0};fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(out));

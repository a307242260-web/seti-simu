'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {searchDecision,VERSION}=require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const agent=require('../randomizer/game/ai/search-agent');
const f=JSON.parse(fs.readFileSync(process.argv[2])),seat=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
k.newGame({seed});const c=k.composition;
assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const original=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
try{
 const cpu=process.cpuUsage(),t=performance.now(),root=p.openRoot(),e=createStateValueEvaluator(seat);
 const r=searchDecision({port:p,root,evaluate:e,modelKey:e.modelKey,budget:agent.BUDGET,...agent.OPTIONS});
 const milliseconds=performance.now()-t,ticks=process.cpuUsage(cpu);
 assert(r.complete&&!r.unresolved.length);assert.deepEqual(c.lifecycle.save().envelope,original);
 console.log(JSON.stringify({version:VERSION,fixture:process.argv[2],action:r.actionId,value:r.value,nativeInputs:r.diagnostics.nativeExecutions,
  milliseconds,cpuMilliseconds:(ticks.user+ticks.system)/1000,quotes:r.lines.filter(x=>x.deferredSectorPublicity).length,
  allocations:p.getDiagnostics().milliseconds,states:r.lines.length}));
}finally{p.close();c.dispose();}

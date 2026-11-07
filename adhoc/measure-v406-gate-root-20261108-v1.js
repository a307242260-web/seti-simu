'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),z=require('node:zlib');
const load=n=>require(path.resolve(n));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=load('randomizer/game/ai/state-value'),search=load('randomizer/game/ai/decision-search'),agent=load('randomizer/game/ai/search-agent');
const [fixture,out]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),seat=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope;
 const at=performance.now(),root=p.openRoot(),evaluate=createStateValueEvaluator(seat),
   r=search.searchDecision({port:p,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET}),ms=performance.now()-at;
 assert.deepEqual(c.lifecycle.save().envelope,before);
 fs.writeFileSync(out,z.gzipSync(JSON.stringify(r)+'\n'),{flag:'wx'});
 console.log(JSON.stringify({actionId:r.actionId,value:r.value,nativeInputs:r.diagnostics.nativeExecutions,milliseconds:ms,
  complete:r.complete,unresolved:r.unresolved.length,diagnosticLimits:r.diagnostics.limits,
  quoteCount:r.lines.filter(x=>x.knownScanTiming).length,rootAndRngUnchanged:true}));
}finally{p.close();c.dispose();}

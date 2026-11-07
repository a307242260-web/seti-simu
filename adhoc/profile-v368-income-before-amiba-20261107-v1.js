'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const source=process.argv[2],e=JSON.parse(fs.readFileSync(source)),f=JSON.parse(fs.readFileSync(e.fixture)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(e.fixture),e.fixtureSha256);
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),values=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent');
assert.equal(e.searchVersion,search.VERSION);const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),evaluate=values.createStateValueEvaluator(f.seatId);
try{
 const r=search.searchDecision({port:p,root:p.openRoot(),evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET});
 assert(r.complete);assert.equal(r.actionId,e.actionId);assert.equal(r.value,e.value);assert.equal(r.diagnostics.nativeExecutions,e.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);
 console.log(JSON.stringify({scope:'CPU profile diagnostic; no replacement of first cold measurement',value:r.value,inputs:r.diagnostics.nativeExecutions,action:r.actionId}));
}finally{p.close();c.dispose();}

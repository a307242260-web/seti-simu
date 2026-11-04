'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),search=require('./decision-search'),values=require('./state-value'),agent=require('./search-agent');
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-039-20261104-v1.json'))),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope;
const seen=new Set(),duplicates=[];let researchInputs=0;
const composition={...c,counterfactualPort:{...c.counterfactualPort,createFork(...args){const fork=c.counterfactualPort.createFork(...args),actual=fork.composition||fork,inputPort={...actual.inputPort};
 for(const method of ['submitAction','submitQuickAction','submitDecision'])inputPort[method]=request=>{
  const envelope=actual.lifecycle.save().envelope,head=envelope.session?.session?.queue?.[0];
  if(head?.payload?.cardEffect?.type==='card_research_tech'){
   // The complete checkpoint includes native queue, all rule state and RNG.
   // Preparation labels must not cause an identical paid-tech input twice.
   const key=JSON.stringify([envelope,method,request]);if(seen.has(key))duplicates.push(request);seen.add(key);researchInputs++;
  }
  return actual.inputPort[method](request);
 };
 const wrapped={...actual,inputPort};return fork.composition?{...fork,composition:wrapped}:wrapped;
}}};
const p=createAnalysisPort({composition,seatId:f.seatId,maxCacheEntries:0});
try{const root=p.openRoot(),evaluate=values.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:{transitions:256,nodes:2048,frontier:512,milliseconds:5000}});assert(r.complete,r.stopReason);assert.equal(r.actionId,'orbit:44937d1f');assert.equal(r.value,require('./state-value').sumValueParts([64.5,62/182,11/3]));assert(r.diagnostics.nativeExecutions<=256);assert(researchInputs>=4,'all distinct native research targets remain explored');assert.deepEqual(duplicates,[],'equal fully paid native research sources must not execute twice');assert.deepEqual(c.lifecycle.save().envelope,original);console.log(JSON.stringify({settledTechFunding:'passed',complete:true,nativeInputs:r.diagnostics.nativeExecutions,distinctResearchInputs:researchInputs,duplicatePaidResearchInputs:duplicates.length,rootAndRngUnchanged:true}));}finally{p.close();c.dispose();}

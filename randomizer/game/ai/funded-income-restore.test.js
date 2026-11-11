'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{gunzipSync}=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random'),{createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const seat='player-white';
// Restore inside the placement session, before the first of three known data
// payments. The blue path is also complete, but leaves DLC25 uninserted.
{
 const root=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/r3-funded-income-restore-20261112-v1.json.gz'))));
 const seed=JSON.parse(root.committedState).meta.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId,[],{valueOnly:viewer?.valueOnly===true})});
 k.newGame({seed});
 const c=k.composition;
 const p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  assert(c.lifecycle.restore(root).ok);
  const legalActions=c.inspect().session.decision.choices;
  const computer=legalActions.find(a=>a.target.target==='computer'),blue=legalActions.find(a=>a.target.blueSlot===1);
  const q=createSearchAgent({seatId:seat,analysisPort:p}).decide({seatId:seat,legalActions}).search;
  assert(q.complete&&!q.unresolved.length);
  const roots=[computer,blue].map(a=>q.roots.find(r=>r.actionId===a.actionId));
  assert(roots.every(r=>r.completion==='complete'));
  assert.equal(roots[0].value,roots[1].value);
  assert.equal(q.actionId,computer.actionId);
  assert(q.diagnostics.nativeExecutions<=3);
  assert.deepEqual(c.lifecycle.save().envelope,root);
 }finally{p.close();c.dispose();}
}

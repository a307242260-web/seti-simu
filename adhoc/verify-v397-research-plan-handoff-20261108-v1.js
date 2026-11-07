'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {createSeededRandom}=load('randomizer/game/random');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const {createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const [fixture,out]=process.argv.slice(2),f=read(fixture),seat=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const make=()=>createSearchAgent({seatId:seat,analysisPort:createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0})});
const decide=a=>{const e=save(),r=a.decide({seatId:seat,legalActions:menu()});assert.deepEqual(save(),e);
  assert(r.search.complete&&r.search.diagnostics.nativeExecutions<=256&&r.search.rootAndSearchMilliseconds<=600);
  return{...r,action:menu().find(q=>q.actionId===r.actionId)};};
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=save();
 const live=make(),opening=decide(live),checkpoint=live.createCheckpoint();
 assert.equal(opening.action.family,'research_tech');
 assert(c.inputPort.submitAction(opening.action).ok);const pending=save();
 const continued=decide(live);const restored=make();restored.loadCheckpoint(checkpoint);
 const afterRestore=decide(restored),cold=decide(make());
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(save(),original);
 const p={scope:'Current production agent from exact archived R192 Native root; compare same R193 menu with retained plan, reloadable plan, and cold decision.',
  fixture,opening,checkpoint,pending,continued,afterRestore,cold,rootAndRngRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(p,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({opening:{goal:opening.search.roots.find(q=>q.actionId===opening.actionId)?.goal,value:opening.search.value,plan:opening.search.planEvidence},variants:[continued,afterRestore,cold].map(q=>({tile:q.action.target.tileId,goal:q.search.roots.find(e=>e.actionId===q.actionId)?.goal,value:q.search.value,reuse:q.search.diagnostics.planContinuation,native:q.search.diagnostics.nativeExecutions,ms:q.search.rootAndSearchMilliseconds}))}));
}finally{c.dispose();}

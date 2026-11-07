'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [fixture,route,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const f=read(fixture),q=read(route),path=q.rows[0].path,seat=f.seatId,seed=f.source.seed;
assert.equal(q.amiba3FixtureSha256,sha(fixture));
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
const save=()=>c.lifecycle.save().envelope,restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
const positions={13:'after-analysis',14:'before-research',16:'after-purple1',18:'first-computer',24:'before-income',28:'funded-red',31:'red-trace',33:'pink-trigger'};
const wanted=new Set(process.env.SETI_CASE?.split(',')||Object.values(positions));
function capture(label,index){const envelope=save(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seat);
 try{
  const t=performance.now(),root=port.openRoot(),search=searchDecision({port,root,evaluate,budget:BUDGET,modelKey:evaluate.modelKey,...OPTIONS}),ms=performance.now()-t;
  assert.deepEqual(save(),envelope);
  const passedGate=search.complete&&!search.unresolved.length&&search.diagnostics.nativeExecutions<=256&&ms<=600;
  return {label,index,ms,passedGate,envelope,actions:root.legalActions,search};
 }finally{port.close();}}
const rows=[];
try{restore(f.compositionEnvelope);for(let i=0;i<=path.length;i++){
 const label=positions[i];if(label&&wanted.has(label))rows.push(capture(label,i));
 if(i>=Math.max(...Object.keys(positions).map(Number)))break;
 const x=path[i],d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===x.id&&a.actorId===seat);assert(a);assert.deepEqual(a.target,x.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
 }restore(f.compositionEnvelope);
 const proof={fixture,fixtureSha256:sha(fixture),route,routeSha256:sha(route),rows,rootAndRngRestored:true,autonomousFirst3Runs:0};
 if(out)fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(rows.map(x=>({label:x.label,value:x.search.value,selected:x.actions.find(a=>a.actionId===x.search.actionId)?.summary,native:x.search.diagnostics.nativeExecutions,
  ms:x.ms,passedGate:x.passedGate,roots:x.search.roots.map(r=>[x.actions.find(a=>a.actionId===r.actionId)?.summary,r.goal?.id,r.value])}))));
}finally{c.dispose();}

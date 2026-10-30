'use strict';
// Diagnostic native witnesses, not another autonomous experiment or speed gate.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),value=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent');
assert.equal(search.VERSION,'seti-complete-decision-search-v92');
const fixture='adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-024-20261030-v1.json',output='reports/ai-foundation-20261023/human405-v92-opening-value-attribution-20261030-v1.json';
assert(!fs.existsSync(output),'Reuse existing checkpoint');
const f=JSON.parse(fs.readFileSync(fixture)),rows=[],sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [name,first]of [['student-company',null],['teacher-B117','play_card:124d76d3']]){
 const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
 try{
  let n=p.openRoot();p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
  const nativeSteps=[],snapshots=[];
  function capture(at){const o=n.observation,player=o.publicState.players.find(p=>p.playerId===f.seatId),probes=o.publicState.board.rockets.filter(r=>[r.playerId,r.playerColor,r.color].some(id=>id===f.seatId||id===player.color));
   const removed={...o,publicState:{...o.publicState,board:{...o.publicState.board,rockets:o.publicState.board.rockets.filter(r=>!probes.includes(r))}}};
   return{at,status:n.status,boundary:n.boundary,value:value.evaluateStateValue(o,f.seatId),valueWithoutProbeProjection:value.evaluateStateValue(removed,f.seatId).total,player,probes,hand:o.selfState.hand,reserved:o.selfState.reservedCards,probeRouteRequirements:o.probeRouteRequirements};}
  function submit(id){const a=n.legalActions.find(x=>x.actionId===id);assert(a,JSON.stringify({name,id,status:n.status,legal:n.legalActions.map(x=>x.actionId)}));nativeSteps.push({family:a.family,summary:a.summary,target:a.target,actionId:id});n=p.expand(n,id);}
  snapshots.push(capture('opening'));
  if(first){submit(first);snapshots.push(capture('after-first-input'));}
  const result=search.searchDecision({port:{...p,postMainValueBound:()=>null,incomePlanSummary:()=>null,turnTailSummary:()=>null},root:n,evaluate:value.createStateValueEvaluator(f.seatId),...agent.OPTIONS,planReuse:false,budget:{transitions:16384,nodes:32768,frontier:16384,milliseconds:30000}});assert(result.complete,result.stopReason);
  let i=0;
  for(let depth=0;depth<=result.lines.length;depth++){
   const line=result.lines[i];
   if(['income-plan-value','turn-tail-value','information-barrier','terminal','other-owner','turn-boundary'].includes(line.status))break;
   const edges=line.edges.filter(e=>result.lines[e.target].value!==null).sort((a,b)=>result.lines[b.target].value-result.lines[a.target].value||(result.lines[a.target].distance+a.cost)-(result.lines[b.target].distance+b.cost)||(a.actionId<b.actionId?-1:1));
   const edge=edges[0];assert(edge);assert(!edge.knownIncomePlan&&!edge.turnTailPlanValue,'no scalar shortcut in witness');
   for(const id of edge.steps||[edge.actionId])submit(id);
   i=edge.target;
  }
  const last=capture('native-complete-policy-boundary');assert.equal(last.value.total,result.value);snapshots.push(last);
  assert.deepEqual(c.lifecycle.save().envelope,before);
  rows.push({name,forcedFirst:first,completePolicyValue:result.value,nativeSearchInputs:result.diagnostics.nativeExecutions,witnessInputs:nativeSteps.length,nativeSteps,snapshots,sourceRootAndRngUnchanged:true});
 }finally{p.close();c.dispose();}
}
const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
const report={schemaVersion:'seti-human405-opening-value-attribution-v2',sourceCommit:'9d707d66483d8ec6c5f754be52ac485638442fea',searchVersion:search.VERSION,fixture,fixtureSha256:sha(fixture),rows,sourceHashes,
 scope:'Two current-policy native search witnesses with numeric bounds and income/turn-tail scalar shortcuts disabled. Not an autonomous rerun or proof of strategic equivalence. Removing probes is synthetic evaluator sensitivity only; routes are native public facts, not guaranteed future rewards.'};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,rows:rows.map(r=>({name:r.name,value:r.completePolicyValue,inputs:r.nativeSearchInputs,witness:r.witnessInputs,status:r.snapshots.at(-1).status,probes:r.snapshots.at(-1).probes.length,components:r.snapshots.at(-1).value.components,routes:r.snapshots.at(-1).probeRouteRequirements?.candidates?.length}))}));

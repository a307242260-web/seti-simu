'use strict';
// Pure replay to one recorded root plus small native branch checks; never reruns AI search.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const cards=require('../randomizer/game/cards/deck');
const prefix='reports/ai-foundation-20261023/search-step295-analysis-20261029-v1';
const output=prefix+'.native-check.json';if(fs.existsSync(output))throw Error('Existing native check: reuse its checkpoint');
const tracePath='reports/research/a760f3dd.ff4b36c1.full.json.decisions.jsonl',checkpointPath='reports/ai-foundation-20261023/search-unbounded-baseline-20261029-v1.checkpoint-step-280.json';
const bytes=fs.readFileSync(tracePath),traces=bytes.toString().trim().split('\n').map(JSON.parse),trace=traces[294];
const env=createSimulationEnv();let envelope;
try{
 env.loadCheckpoint(JSON.parse(fs.readFileSync(checkpointPath)));
 for(let i=280;i<294;i++){const a=env.legalActions().find(a=>a.actionId===traces[i].actionId);assert(a,`replay ${i+1}`);assert.equal(env.step(a).ok,true);}
 envelope=env.createCheckpoint().coreState.compositionEnvelope;
}finally{env.dispose();}
const seed=JSON.parse(envelope.committedState).meta.seed;
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const comp=kernel.composition;kernel.newGame({seed});assert.equal(comp.lifecycle.restore(envelope).ok,true);
const before=comp.lifecycle.save().envelope,port=createAnalysisPort({composition:comp,seatId:'player-white'});
const checks=[];
try{
 const root=port.openRoot();const actionKey=a=>Object.fromEntries(['actionId','actorId','stateVersion','decisionVersion','family','phase','target','payload'].map(k=>[k,a[k]]));assert.deepEqual(root.legalActions.map(actionKey),trace.context.legalActions.map(actionKey));
 port.setMovementPlanning(true);port.setCardPickPlanning(true);port.setResourcePlanning(true);port.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
 const inspectBranch=(anchor,label)=>{
  const play=anchor.legalActions.find(a=>a.family==='play_card'&&a.target.cardInstanceId==='card-57-0');assert(play);
  const start=port.expand(anchor,play.actionId),choices=start.legalActions;
  assert.equal(choices.length,label==='direct'?8:7);assert(choices.some(a=>a.target.done));
  const identities=choices.filter(a=>a.target.cardInstanceId).map(a=>a.target.cardInstanceId),ids=identities.slice(0,2);
  function sequence(order){let node=start;for(const id of order){const a=node.legalActions.find(a=>a.target.cardInstanceId===id);assert(a);node=port.expand(node,a.actionId);}return node;}
  const ab=sequence(ids),ba=sequence([...ids].reverse());assert.equal(port.identity(ab),port.identity(ba),'Same discard set, different order must have the existing forward identity');
  assert.deepEqual(ab.legalActions.map(a=>a.target),ba.legalActions.map(a=>a.target));
  const done=node=>port.expand(node,node.legalActions.find(a=>a.target.done).actionId);
  const endedAB=done(ab),endedBA=done(ba);assert.equal(port.identity(endedAB),port.identity(endedBA));
  checks.push({label,playAction:play,remainingCards:identities.length,choices:choices.map(a=>({actionId:a.actionId,summary:a.summary,target:a.target})),sameSetDifferentOrder:{cards:ids,existingForwardIdentityEqual:true,legalTargetsEqual:true,afterDoneIdentityEqual:true},afterDoneStatus:endedAB.status});
  return start;
 };
 inspectBranch(root,'direct');
 let income=root;const edge=trace.search.lines[0].edges.find(e=>e.target===7);assert.equal(edge.cost,9);
 for(const id of edge.steps){assert(income.legalActions.some(a=>a.actionId===id),id);income=port.expand(income,id);}
 inspectBranch(income,'after-four-data-income');
 assert.deepEqual(comp.lifecycle.save().envelope,before,'Canonical root and RNG unchanged');
 const report={schemaVersion:'seti-search-step295-native-check-v1',scope:'14 recorded native inputs replayed from step280 checkpoint; two real card-effect branches checked; no AI search or full game rerun',tracePath,traceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),checkpointPath,step:295,round:4,turn:6,checks,rootUnchanged:true,inputs:port.getDiagnostics().submissionCount,hand:trace.context.observation.selfState.hand.map(c=>({id:c.id,cardId:c.cardId,incomeGain:cards.getIncomeGainForCard(c)})),sourceHashes:Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,rootUnchanged:true,checks:checks.map(c=>({label:c.label,cards:c.remainingCards,sameSetIdentity:c.sameSetDifferentOrder.existingForwardIdentityEqual})),nativeInputs:report.inputs}));
}finally{port.close();comp.dispose();}

'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.cwd(),load=n=>require(path.join(root,n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),value=load('randomizer/game/ai/state-value');
const D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',proofPath=D+'v323-first3-native-development-20261107-v1.json',proof=read(proofPath),record=read(proof.record),replay=read(proof.checkpoint),save=read(record.savePath),seat='player-white';
assert.equal(sha(proof.record),proof.recordSha256);assert.equal(sha(proof.save),proof.saveSha256);assert.equal(sha(record.agentTracePath),proof.traceSha256);assert.equal(sha(proof.checkpoint),proof.checkpointSha256);
const trace=fs.readFileSync(record.agentTracePath,'utf8').trim().split('\n').map(JSON.parse);
const seed=record.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
const envelope=()=>c.lifecycle.save().envelope,restore=e=>assert(c.lifecycle.restore(e).ok),state=e=>e.session?.session?.workingState||JSON.parse(e.committedState);
const actor=e=>state(e).players.players.find(p=>p.id===seat),origin=replay.roundStarts[2].envelope;
function choices(){const d=c.inspect().session?.decision;return d?.choices||c.inputPort.enumerateActions({});}
function act(a){
 assert(a);const d=c.inspect().session?.decision;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return {id:a.actionId,family:a.family,actor:a.actorId,target:a.target};
}
function recorded(i,strict=true){
 const e=save.replaySteps[i-1];assert(e);
 const a=choices().find(a=>a.actionId===e.action.actionId&&a.actorId===e.actorPlayerId);
 if(strict){assert(a,'recorded action missing '+i);assert.deepEqual(a.target,e.action.target);}
 return a&&act(a);
}
function capture(i){
 restore(origin);
 for(let step=replay.roundStarts[2].beforeInput;step<i;step++)recorded(step);
 return envelope();
}
function assets(){
 const e=envelope(),s=state(e),p=actor(e),view=c.projection({role:'player',playerId:seat}).state;
 return {round:s.turn.roundNumber,owner:s.turn.currentPlayerId,resources:p.resources,income:p.income,tech:p.techState,
   hand:p.hand.map(q=>q.cardId),computer:p.dataState.placedTokens.filter(q=>q.placementKind==='computer').map(q=>q.placementSlot),
   blueData:p.dataState.placedTokens.filter(q=>q.placementKind==='blueBonus').map(q=>q.blueSlot),
   probes:s.pieces.rockets.filter(q=>q.playerId===seat),traceCounts:view.selfState.traceCounts,
   model:value.evaluateStateValue(view,seat).total};
}
try{
 const source104=capture(104),known=trace[104-24].search;assert.equal(known.actionId,save.replaySteps[103].action.actionId);
 const candidate=tile=>{const e=known.lines[0].edges.find(e=>e.resourcePlan?.goal.id==='tech:'+tile+':2');assert(e);
   const target=known.lines[e.target];return {model:target.value,distance:e.cost+target.distance,realization:target.realization,goal:e.resourcePlan.goal.id};};
 const choices104=[];
 for(const tile of ['blue1','blue3']){
  restore(source104);const actions=[recorded(104),act(choices().find(a=>a.target?.tileId===tile&&a.target.blueSlot===2))];
  if(tile==='blue3')actions.push(recorded(106));
  choices104.push({tile,actions,oneTurnSearch:candidate(tile),actualImmediateAssets:assets()});
 }
 const source121=capture(121),last=trace[121-24].search;
 assert.equal(last.actionId,save.replaySteps[120].action.actionId);
 const rootValues=last.roots.filter(x=>x.value!=null).map(x=>({actionId:x.actionId,value:x.value,completion:x.completion}));
 assert.equal(new Set(rootValues.map(q=>q.value)).size,1);
 const actualStart=replay.roundStarts[3];assert(actualStart);restore(actualStart.envelope);const actual=assets();
 restore(source121);const earlier=[act(choices().find(a=>a.family==='pass'))];
 earlier.push(act(choices().find(a=>a.target?.kind==='pass-reserve-card'&&a.target.cardId==='b_101.webp')));
 const mandatory=[];
 for(let i=130;i<actualStart.beforeInput;i++){
  const expected=save.replaySteps[i-1];assert.notEqual(expected.actorPlayerId,seat);
  const a=recorded(i,false);if(!a)break;mandatory.push(a);
 }
 const earlierAssets=assets();
 assert.equal(earlierAssets.round,3);assert.equal(earlierAssets.owner,seat);
 assert.equal(earlierAssets.resources.score+3,actual.resources.score);
 assert.equal(earlierAssets.computer.length,4);assert.equal(earlierAssets.resources.availableData,2);
 const earlierEnvelope=envelope();
 restore(origin);assert.deepEqual(envelope(),origin);
 const result={scope:'Native fixed-input R2 counterfactuals from actual accepted checkpoints. The tech options are evaluated by the stored original turn search; only their immediate legal resolution is replayed. Earlier PASS uses the same known B101 and recorded required other seats inputs; no new policy queries or games.',
  record:proof.record,recordSha256:proof.recordSha256,nativeVerification:proofPath,nativeVerificationSha256:sha(proofPath),
  research:{input:104,source:source104,options:choices104},analysisOrPass:{input:121,source:source121,storedRootValues:rootValues,
   actualThirdRoundFirstWhiteInput:actualStart.beforeInput,actualThirdRoundStart:actual,earlierPassActions:[...earlier,...mandatory],
   earlierPassThirdRoundStart:earlierAssets,earlierPassThirdRoundEnvelope:earlierEnvelope},
  newCounterfactualNativeInputs:choices104.reduce((n,q)=>n+q.actions.length,0)+earlier.length+mandatory.length,newAiQueries:0,newAutonomousRuns:0};
 const file=D+'v323-round2-carryover-native-controls-20261107-v1.json';fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({file,tech:choices104.map(q=>[q.tile,q.oneTurnSearch,q.actualImmediateAssets.resources,q.actualImmediateAssets.hand]),
  earlier:earlierAssets,actual,newNative:result.newCounterfactualNativeInputs}));
}finally{c.dispose();}

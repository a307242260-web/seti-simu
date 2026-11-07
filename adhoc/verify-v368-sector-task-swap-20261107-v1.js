'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{createCardPickPlanner}=require('../randomizer/game/ai/card-pick-planning');
const D='reports/ai-foundation-20261107/v367-blue1-dlc19-native-v1/',read=p=>JSON.parse(fs.readFileSync(p)),fixture=read(D+'v367-r3-blue1-before-dlc19-root-20261107-v1.json'),proof=read(D+'v367-blue1-dlc19-research-20261107-v1.json'),seat=fixture.seatId,seed=fixture.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,restore=e=>assert(c.lifecycle.restore(e).ok),save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const owner=s=>s.players.players.find(p=>p.id===seat),outgoing='alien-amiba-9-8',incoming='card-63-0',task='dlc9-three-sector-wins';
let fork;const composition={...c,counterfactualPort:{...c.counterfactualPort,createFork(...args){const r=c.counterfactualPort.createFork(...args);fork=r.composition||r;return r;}}};
const assertIntent=spec=>{assert.equal(spec.companySwap?.goal.kind,'sector-task-swap');assert.equal(spec.companySwap.goal.sectorId,'sector-1-b');assert.deepEqual(spec.companySwap.goal.task,{cardId:'card-15-0',ruleId:task,publicity:3});assert.equal(spec.companySwap.selection.cardId,incoming);assert.deepEqual(spec.companySwap.discardIds,[outgoing]);};
function submit(row){const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===row.id);assert(a);assert.equal(a.family,row.family);assert.deepEqual(a.target,row.target);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitQuickAction(a);assert(r.ok);}
try{
 restore(fixture.compositionEnvelope);const before=save(),source=JSON.parse(before.committedState),rootMenu=menu(),runs=[];
 const changes={
   'other-seat-active':s=>s.turn.passedPlayerIds=s.turn.passedPlayerIds.slice(1),
   'main-spent':s=>owner(s).mainActionCompleted=true,
   'round-four':s=>s.turn.roundNumber=4,
   'task-already-completed':s=>owner(s).reservedCards.find(c=>c.cardId==='dlc_9.png').cardEffectState.completedTaskIds=[task],
   'task-missing':s=>owner(s).reservedCards=owner(s).reservedCards.filter(c=>c.cardId!=='dlc_9.png'),
   'no-guaranteed-winner':s=>{s.data.sectorExtraMarks['sector-1-b']=[1,2,3,4,5].map(n=>({replacedByPlayerColor:'blue',replacedByPlayerId:'player-blue',replacementOrder:100+n}));},
   'not-enough-signals':s=>{const token=s.data.nebulae['sector-1-b'].tokens[1];token.replacedByPlayerColor=null;token.replacedByPlayerId=null;},
   'decline-hidden-card':s=>s.cards.publicCards.find(c=>c.id===incoming).hidden=true,
   'decline-unneeded-funding':s=>owner(s).resources.publicity=4,
   'insufficient-task-payout':s=>owner(s).resources.publicity=1,
   'condition-no-three-sectors':s=>{for(const id of ['sector-2-a','sector-4-b'])for(const t of s.data.nebulae[id].tokens){t.replacedByPlayerColor=null;t.replacedByPlayerId=null;}},
 };
 for(const [name,change]of Object.entries(changes)){const altered=structuredClone(source);change(altered);const snapshot=JSON.stringify(altered),spec=createCardPickPlanner().plan({state:altered,seatId:seat,actions:rootMenu,status:'stable'});assert.notEqual(spec?.companySwap?.goal.kind,'sector-task-swap',name);assert.equal(JSON.stringify(altered),snapshot);}
 const prefix=proof.knownPrefix.slice(0,3),checkpoints=[before];for(const row of prefix){submit(row);checkpoints.push(save());}
 for(let stage=0;stage<3;stage++){
  restore(checkpoints[stage]);
  const p=createAnalysisPort({composition,seatId:seat,maxCacheEntries:0});
  try{p.setCardPickPlanning(true);p.setResourcePlanning(true);const root=p.openRoot(),spec=p.cardPickSpec(root);assertIntent(spec);
   if(!stage){const cut=p.expandWithCardPick(root,spec.selectedActionId,n=>n===1?'native-budget':null);assert(!cut.complete);assert.equal(cut.submissions,1);assert.deepEqual(save(),before);}
   const result=p.expandWithCardPick(root,spec.selectedActionId,()=>null);
   assert(result.complete);assert.equal(result.submissions,3-stage);
   assert.deepEqual(result.prefixes.map(r=>[r.action.actionId,r.action.family,r.action.target]),prefix.slice(stage).map(r=>[r.id,r.family,r.target]));
   const after=p.valueObservation(result.node);assert(after.selfState.hand.some(c=>c.id===incoming&&c.cardId==='dlc_19.png'));assert(!after.selfState.hand.some(c=>c.id===outgoing));assert.deepEqual(save(),checkpoints[stage]);
   runs.push({stage,submissions:result.submissions,stats:p.getDiagnostics().cardPick});
  }finally{p.close();}
 }
 restore(before);assert.deepEqual(save(),before);console.log(JSON.stringify({sectorTaskSwap:'passed',guardCases:Object.keys(changes),runs,proofNativeInputCount:12,budgetStopsBeforeNextNativeInput:true,rootAndRngUnchanged:true,newAutonomousRuns:0}));
}finally{c.dispose();}

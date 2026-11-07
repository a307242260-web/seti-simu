'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {createSeededRandom}=load('randomizer/game/random');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const {evaluateStateValue}=load('randomizer/game/ai/state-value');
const [routes,out]=process.argv.slice(2),p=read(routes),root=p.root,seat='player-white',seed=JSON.parse(root.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const same=(a,b)=>require('node:util').isDeepStrictEqual(a,b);
const old=p.rows['V375-legal-fixed-route'].steps,now=p.rows['V397-actual-route'].steps;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(step){
 const matches=menu().filter(a=>a.family===step.family&&a.actorId===step.actorId&&a.phase===step.phase&&same(a.target,step.target));
 if(matches.length!==1)return null;
 const a=matches[0],d=c.inspect().session?.decision;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));return a;
}
function details(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seat);
 const o=c.projection({role:'player',playerId:seat}).state;
 const v=evaluateStateValue(o,seat);
 return {turn:s.turn.turnNumber,mainCompleted:p.mainActionCompleted,wallet:p.resources,tech:p.techState,values:v,
  hand:p.hand.map(q=>[q.id,q.cardId]),data:p.dataState,pending:o.selfState.pendingSectorClaims??null,
  legalResearch:menu().some(q=>q.family==='research_tech'),menu:menu().filter(a=>['scan','research_tech','complete_task','end_turn','pass'].includes(a.family)).map(a=>[a.family,a.target])};
}
try{
 const rows={};
 for(const [label,first] of [['blueFirst',now],['amibaFirst',old]]){
  restore(root);const initial=first.slice(0,3).map(q=>act(q.action));assert(initial.every(Boolean));const beforeScan=details(),actions=[];
  let unavailable=null,substitutedSector=null;
  for(const step of old.slice(3,13)){
   let a=act(step.action);
   if(!a&&step.index===187&&label==='blueFirst'){
    const legal=menu();assert.equal(legal.length,1);assert.equal(legal[0].target.nebulaId,'sector-1-b');
    substitutedSector={wanted:step.action.target.nebulaId,onlyLegal:legal[0].target.nebulaId};
    a=act(legal[0]);
   }
   if(!a){unavailable={at:step.index,desired:step.action,legal:menu()};break;}
   actions.push({oldInput:step.index,action:a,assets:details()});
  }
  if(label==='blueFirst'&&unavailable?.at===189){
   const end=old.find(q=>q.index===190);
   const a=act(end.action);assert(a);actions.push({oldInput:end.index,action:a,assets:details()});
  }
  rows[label]={initial,beforeScan,actions,unavailable,substitutedSector,end:details(),envelope:save()};
 }
 for(const q of Object.values(rows)){restore(root);q.initial.forEach(a=>assert(act(a)));q.actions.forEach(x=>assert(act(x.action)));assert.deepEqual(save(),q.envelope);}
 restore(root);
 const result={scope:'Exact R179 root, fix either first turn then independently use the same known trade and scan, compare current public wallet and next legal research; no search.',
  rows,completeStateSessionRngExact:true,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(Object.fromEntries(Object.entries(rows).map(([name,q])=>[name,{sameInputs:q.actions.length,blockedAt:q.unavailable?.at,score:q.end.wallet.score,publicity:q.end.wallet.publicity,data:q.end.wallet.availableData,research:q.end.legalResearch,value:q.end.values.total}]))));
}finally{c.dispose();}

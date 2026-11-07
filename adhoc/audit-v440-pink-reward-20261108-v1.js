'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation');
const {getPublicTraceState,listSymbolsInRegion}=load('randomizer/game/aliens/amiba');
const {listPendingTriggerKeys}=load('randomizer/game/cards/effects');
const [normal,masked,out]=process.argv.slice(2),seat='player-white',fixture=read(normal);
const root=JSON.parse(fixture.source.committedState),seed=root.meta.seed,owner=s=>s.players.players.find(p=>p.id===seat);
const native=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
native.newGame({seed});
const c=native.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function act(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===seat);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(result.ok,JSON.stringify(result));return a;
}
function facts(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=owner(s);
 const t=getPublicTraceState(s.aliens);
 return {wallet:p.resources,hand:p.hand.map(c=>[c.id,c.cardId]),trigger:listPendingTriggerKeys(p,s.turn),
  visibleAlien:t.displayedCardIndex,deckCount:t.blindCardCount,wins:s.data.sectorSettlements.winsByPlayerId[seat],turn:s.turn.turnNumber};
}
try{
 const rows=[];
 for(const [variant,file] of [['normal',normal],['masked',masked]]){
  const input=read(file),{rounds,steps}=input.rows[0];
  const before=rounds[3].envelope;
  restore(before);const a0=facts(),first=[];
  for(const x of steps.slice(rounds[3].step,rounds[3].step+3))first.push(act(x.action));
  const pending=save(),pre=facts(),variants=menu().filter(a=>a.family==='choose_target'&&a.target.traceType==='pink');
  for(const choice of variants){
   restore(pending);
   const accepted=[act(choice)];
   while(c.inspect().session){
    const next=menu().find(a=>a.family==='choose_card'&&a.target.source==='display'
      ||a.family==='accept_optional_effect'&&a.target.choiceId?.startsWith('confirm:trigger:'));
    assert(next&&accepted.length<6,JSON.stringify(menu()));
    accepted.push(act(next));
   }
   const after=facts(),end=save();
   restore(before);first.forEach(act);accepted.forEach(act);assert.deepEqual(save(),end);
   const gain=Object.fromEntries(Object.entries(after.wallet).map(([k,n])=>[k,n-a0.wallet[k]]));
   rows.push({variant,trace:choice.summary,position:choice.target.position,gain,
    before,first,pending,pre,accepted,after,end});
   console.log(JSON.stringify({variant,trace:choice.summary,gain,newCards:after.hand.filter(h=>!a0.hand.some(old=>old[0]===h[0])),display:pre.visibleAlien}));
  }
  restore(input.source);
 }
 fs.writeFileSync(out,JSON.stringify({scope:'Fixed same public scan, all legal Amiba pink trace positions; no subsequent task; exact Native replay and RNG',rows},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}

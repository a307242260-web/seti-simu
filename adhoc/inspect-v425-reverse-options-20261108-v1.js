'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const [source,out,mode='normal']=process.argv.slice(2),ref=read(source),base=ref.compositionEnvelope||ref.origin,seat='player-white',seed=JSON.parse(base.committedState).meta.seed;
const sourceState=JSON.parse(base.committedState);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function act(w){
 const d=c.inspect().session?.decision,a=menu().find(x=>x.actionId===w.actionId&&x.actorId===seat);
 assert(a,w.summary);assert.deepEqual(a.target,w.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function assets(e){
 const s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(q=>q.id===seat),
  v=c.projection({role:'player',playerId:seat}).state;
 return {turn:s.turn.turnNumber,wallet:p.resources,income:p.income,hand:p.hand.map(h=>[h.id,h.cardId]),data:p.dataState,tech:p.techState,
  probes:s.pieces.rockets.filter(x=>x.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],traces:v.selfState.traceCounts,
  projectedFinal:v.publicState.players.find(q=>q.playerId===seat).finalScore};
}

const cardApi=load('randomizer/game/cards/deck');
function view(){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(q=>q.id===seat);
 const cards=l=>l.map(h=>h&&[h.id,h.cardId,cardApi.getDiscardActionRewardForCard(h),cardApi.getIncomeGainForCard(h)]);
 const a=s.aliens.amiba,t=s.aliens.aliens['1'].traces;
 return {t:s.turn.turnNumber,w:p.resources,hand:cards(p.hand),market:cards(s.cards.publicCards),
  comp:p.dataState.placedTokens.filter(t=>t.placementKind==='computer').map(t=>t.placementSlot),
  blue:p.dataState.placedTokens.filter(t=>t.placementKind==='blueBonus').map(t=>t.blueSlot),
  display:a.displayedCardIndex,traces:Object.fromEntries(Object.entries(t).map(([k,v])=>[k,v.slots||v])),
  menu:menu().map(x=>[x.family,x.summary,x.target,x.payload])};
}
try{
 restore(base);
 let rows=[];
 for(let i=0;i<=ref.accepted.length;i++){
  if(i===ref.accepted.length||i<=17){
   const v=view(), e=save();
   const action=ref.accepted[i]?.action||null;
   const alternatives=[];
   if([1,3,4,5,6,7,8,9,10,12,14,15].includes(i)){
    for(const a of menu().filter(x=>x.family==='choose_target'||x.family==='complete_task'||x.family==='decline_optional_effect'||x.family==='card_corner')){
     restore(e);
     act(a);
     const w=view();alternatives.push({a:[a.family,a.summary,a.target],w:w.w,displayBefore:v.display,displayChanged:v.display!==w.display,
      handDelta:w.hand.filter(h=>!v.hand.some(q=>q[0]===h[0])).map(h=>h[1].startsWith('amiba')&&w.display!==v.display?'public-former-display-or-blind':h),
      next:w.menu.filter(n=>n[0].startsWith('choose')||n[0].includes('optional'))});
    }
    restore(e);
   }
   rows.push({i,action,v,alternatives});
  }
  if(ref.accepted[i])act(ref.accepted[i].action);
 }
 restore(base);
 fs.writeFileSync(out,JSON.stringify({rows,rootRestored:true},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}

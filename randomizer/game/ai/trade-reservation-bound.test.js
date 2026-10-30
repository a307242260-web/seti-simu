"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createSimulationRuleComposition}=require("../../training/simulation-rule-composition");
const {createSeededRandom}=require("../random");
const {buildRuleObservation}=require("../../app/rule-observation");
const {createAnalysisPort}=require("./analysis-port");
const {searchDecision}=require("./decision-search");
const {createStateValueEvaluator,evaluateHandCountDelta}=require("./state-value");
const effects=require("../cards/effects");
const rows=[],completeWindows=[];
function check(f,label){
 const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition;
 assert(comp.lifecycle.restore(f.compositionEnvelope).ok);const before=comp.lifecycle.save().envelope;
 const evaluators=[createStateValueEvaluator(f.seatId),createStateValueEvaluator(f.seatId,{weights:{credits:0.1,energy:0.2,publicity:0.3,availableData:0.4,handSize:0.07}})];
 let inputs=0,leaves=0,trades=0;const deadline=Date.now()+30000,budget={transitions:4096,nodes:4097,frontier:4096,milliseconds:15000};
 for(const tradeId of ["credits-for-card","energy-for-card","publicity-for-card","cards-for-pick-card"]){
  const port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}),root=port.openRoot(),action=root.legalActions.find(a=>a.target?.tradeId===tradeId);
  if(!action){port.close();continue;}
  const submit=(node,id)=>{assert(++inputs<=4096&&Date.now()<deadline,"全部真实交易共用4096输入/30秒预算");return port.expand(node,id);};
  const pending=submit(root,action.actionId),bound=port.cardTradeBound(pending);assert(bound,`${label}/${tradeId}`);trades+=1;
  const expected=evaluators.map(e=>evaluateHandCountDelta(e,pending.observation,bound.handDelta)),exits=[];
  if(tradeId==="cards-for-pick-card"){
   const ids=port.selectionSpec(pending).cardIds;
   for(const a of ids)for(const b of ids)if(a!==b){let n=pending;for(const id of [a,b])n=submit(n,n.legalActions.find(x=>x.target?.cardInstanceId===id).actionId);exits.push(submit(n,n.legalActions.find(x=>x.target?.confirm).actionId));}
  }else exits.push(pending);
  for(const exit of exits){
   assert.equal(port.cardTradeBound(exit)?.handDelta,1);
   for(const choice of exit.legalActions){const leaf=submit(exit,choice.actionId);assert.equal(leaf.status,"information-barrier");evaluators.forEach((e,i)=>assert.equal(e(leaf.observation),expected[i],`${label}/${tradeId}`));leaves+=1;}
  }
  for(const evaluate of evaluators){
   const raw=searchDecision({port,root:pending,evaluate,budget}),reduced=searchDecision({port,root:pending,evaluate,budget,cardChoiceEquivalence:true});
   assert(raw.complete&&reduced.complete);assert.equal(raw.actionId,reduced.actionId);assert.equal(raw.value,reduced.value);assert.equal(raw.lines[0].distance,reduced.lines[0].distance);
   if(tradeId==="cards-for-pick-card")assert.equal(reduced.lines[0].edges.length,port.selectionSpec(pending).cardIds.length*(port.selectionSpec(pending).cardIds.length-1)/2,"不能省略付款实体集合");
  }
  assert.deepEqual(comp.lifecycle.save().envelope,before);port.close();
 }
 assert(trades>0&&leaves>0);rows.push({label,trades,manualInputs:inputs,leaves});
 if(/^\d{3}$/.test(label)){
  const s=JSON.parse(f.compositionEnvelope.committedState),owner=s.players.players.find(p=>p.id===f.seatId);
  s.cards.discardPile.push(...owner.hand.splice(1));Object.assign(owner.resources,{credits:2,energy:1,publicity:0,availableData:0,handSize:1});
  owner.dataState={poolTokens:[],placedTokens:[],discardedCount:0};owner.mainActionCompleted=true;
  owner.industryRoundMarkRound=s.turn.roundNumber;owner.industryRoundMarkTurn=s.turn.turnNumber;
  assert(comp.lifecycle.restore({...f.compositionEnvelope,committedState:JSON.stringify(s)}).ok);const smallBefore=comp.lifecycle.save().envelope;
  function run(enabled,cache=0){const port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:cache});try{
   const out=searchDecision({port,root:port.openRoot(),evaluate:evaluators[0],budget,resourceDominance:true,cardTradePruning:enabled,cardChoiceEquivalence:enabled});assert(out.complete,out.stopReason);return out;
  }finally{port.close();}}
  const raw=run(false),pruned=run(true),cached=run(true,256);
  for(const x of [pruned,cached]){assert.equal(x.actionId,raw.actionId);assert.equal(x.value,raw.value);assert.equal(x.lines[0].distance,raw.lines[0].distance);if(s.turn.roundNumber===4)assert(x.diagnostics.cardTradePrunes>0);else assert.equal(x.diagnostics.cardTradePrunes,0,"held-card value invalidates the old quantity-only bound");}
  assert.deepEqual(comp.lifecycle.save().envelope,smallBefore);completeWindows.push({label,raw:raw.diagnostics.transitions,pruned:pruned.diagnostics.transitions,value:raw.value,prunes:pruned.diagnostics.cardTradePrunes});
 }
 comp.dispose();
}
const fixtures=["062","105","152"].map(id=>JSON.parse(fs.readFileSync(path.resolve(__dirname,`../../../adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`))));
fixtures.forEach((f,i)=>check(f,["062","105","152"][i]));
// 弃两张后可就绪的零资源任务不在交易队列内自动结算。
const f=structuredClone(fixtures[1]),s=JSON.parse(f.compositionEnvelope.committedState),own=s.players.players.find(p=>p.id===f.seatId);let taskCard;
for(const player of s.players.players){const i=player.reservedCards.findIndex(c=>c.cardId==="dlc_28.png");if(i>=0){taskCard=player.reservedCards.splice(i,1)[0];break;}}
assert(taskCard);own.reservedCards.push(taskCard);s.cards.discardPile.push(...own.hand.splice(2));Object.assign(own.resources,{credits:0,energy:0,handSize:2});own.blueBonusResources={credits:0,energy:0};
assert(effects.getCardModel(taskCard).tasks.some(t=>effects.taskConditionMet(t,{...own,hand:[]},{})),"反例必须确实在弃牌后就绪");
f.compositionEnvelope.committedState=JSON.stringify(s);check(f,"ready-zero-resource-task");
console.log(JSON.stringify({tradeReservationBound:"passed",rows,completeWindows}));

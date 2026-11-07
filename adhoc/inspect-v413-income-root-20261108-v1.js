'use strict';
const fs=require('node:fs'),path=require('node:path');
const load=n=>require(path.resolve(n)),d=JSON.parse(fs.readFileSync(process.argv[2]));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),demand=load('randomizer/game/ai/resource-demand'),lp=load('randomizer/game/ai/local-decision-plans'),{getResourceGoalRequirements}=load('randomizer/game/production-kernel');
const seatId=d.seatId,seed=d.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,env=d.compositionEnvelope;
try{
 c.lifecycle.restore(env);const state=JSON.parse(env.committedState),p=state.players.players.find(q=>q.id===seatId),actions=c.inputPort.enumerateActions({});
 console.log('state',p.resources,p.dataState.placedTokens,p.hand.map(c=>c.id));
 const base=demand.catalog({state,seatId,requirements:getResourceGoalRequirements(state,seatId),actions}).find(g=>g.kind==='income');
 for(const incomeCardId of p.hand.map(c=>c.id)){
  const goal={...base,incomeCardId};const pay=demand.dataIncomeFunding({state,seatId,goal,actions,maxCorners:2});
  console.log(goal,pay?.corners);
  if(pay){
   const q=pay.state.players.players.find(q=>q.id===seatId),paid=lp.incomeCompletion({state:pay.state,seatId,goal});
   console.log(paid,pay.resourceDelta,demand.planningCapital(pay.state,q),demand.planningCapital(state,p),lp.quietEndCompletion({state:pay.state,seatId}));
  }
 }
}finally{c.dispose();}

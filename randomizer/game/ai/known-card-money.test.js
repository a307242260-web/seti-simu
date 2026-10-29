"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createSimulationRuleComposition}=require("../../training/simulation-rule-composition");
const {createSeededRandom}=require("../random");
const {buildRuleObservation}=require("../../app/rule-observation");
const {createAnalysisPort}=require("./analysis-port");
const {searchDecision}=require("./decision-search");
const {createStateValueEvaluator}=require("./state-value");
const cards=require("../cards/deck");
const industry=require("../industry");
const fixtures=["062","105","152"].map(id=>JSON.parse(fs.readFileSync(path.resolve(__dirname,`../../../adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`))));
const results=[];
const paired=[];
function compareSingleActions(port,rich,poor,seatId){
 const evaluate=createStateValueEvaluator(seatId),queue=[],seen=new Set(),deadline=Date.now()+30000;let inputs=0,leaves=0,extraStops=0;
 const submit=(node,id)=>{inputs+=1;assert(inputs<=8192,"单行动对照使用统一8192输入预算");return port.expand(node,id);};
 for(const action of poor.legalActions){assert(rich.legalActions.some(a=>a.actionId===action.actionId));queue.push([submit(rich,action.actionId),submit(poor,action.actionId)]);}
 for(let cursor=0;cursor<queue.length;cursor+=1){
  assert(queue.length<=4096&&Date.now()<deadline,"单行动对照使用统一4096节点/30秒预算");
  let [a,b]=queue[cursor];
  if(a.status==="decision"&&b.status!=="decision"){
   const skip=a.legalActions.find(x=>x.family==="choose_reward"&&x.target?.skip);
   assert(skip&&a.legalActions.every(x=>x.family==="choose_reward"&&(x.target?.pay||x.target?.skip)),"只允许重复支付多出的停止步骤");
   a=submit(a,skip.actionId);extraStops+=1;
  }
  assert.equal(a.status,b.status);assert.equal(a.boundary,b.boundary);
  const av=a.observation,bv=b.observation,ap=structuredClone(av.publicState.players),bp=structuredClone(bv.publicState.players);
  const ax=ap.find(p=>p.playerId===seatId),bx=bp.find(p=>p.playerId===seatId);
  assert.equal(ax.credits-bx.credits,1);assert.equal(ax.energy-bx.energy,1);assert.equal(evaluate(av)-evaluate(bv),2);
  ax.credits=bx.credits=0;ax.energy=bx.energy=0;assert.deepEqual(ap,bp);assert.deepEqual(av.selfState,bv.selfState);assert.deepEqual(av.publicState.board,bv.publicState.board);
  if(b.status!=="decision"){leaves+=1;continue;}
  const key=port.identity(b);if(seen.has(key))continue;seen.add(key);
  for(const action of b.legalActions){assert(a.legalActions.some(x=>x.actionId===action.actionId));queue.push([submit(a,action.actionId),submit(b,action.actionId)]);}
 }
 assert(leaves>0);return {inputs,leaves,extraStops};
}
for(const f of fixtures){
 const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition;
 assert(comp.lifecycle.restore(f.compositionEnvelope).ok);let port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0});
 let root=port.openRoot();assert(port.knownCardMoneyOrder(root),"真实后期手牌/保留触发器应由结构化模型给出钱包证明");
 const trade=port.expand(root,root.legalActions.find(a=>a.target?.tradeId==="credits-for-energy").actionId);
 const poor=port.expand(trade,trade.legalActions.find(a=>a.target?.tradeId==="energy-for-credit").actionId);
 assert.equal(port.knownCardMoneyOrder(root).group,port.knownCardMoneyOrder(poor).group);
 const pairBefore=comp.lifecycle.save().envelope;
 paired.push(compareSingleActions(port,root,poor,f.seatId));assert.deepEqual(comp.lifecycle.save().envelope,pairBefore);
 const cacheStats=port.getDiagnostics();assert(cacheStats.decodedStateCacheEntries<=cacheStats.maxDecodedStateCacheEntries);assert(cacheStats.decodedStateCacheBytes<=cacheStats.maxDecodedStateCacheBytes);assert(cacheStats.committedDecodeHits>0);port.close();assert.equal(port.getDiagnostics().decodedStateCacheEntries,0);
 const s=JSON.parse(f.compositionEnvelope.committedState),owner=s.players.players.find(p=>p.id===f.seatId);
 s.cards.discardPile.push(...owner.hand.slice(1));owner.hand=owner.hand.slice(0,1);
 owner.mainActionCompleted=true;owner.resources={...owner.resources,credits:2,energy:1,publicity:0,availableData:0,handSize:1};
 owner.dataState={poolTokens:[],placedTokens:[],discardedCount:0};
 owner.industryRoundMarkRound=s.turn.roundNumber;owner.industryRoundMarkTurn=s.turn.turnNumber;
 const envelope={...f.compositionEnvelope,committedState:JSON.stringify(s)};assert(comp.lifecycle.restore(envelope).ok);
 const evaluate=createStateValueEvaluator(f.seatId),before=comp.lifecycle.save().envelope;
 function run(enabled,cache=0){
  port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:cache});const root=port.openRoot(),order=port.knownCardMoneyOrder(root);assert(order);
  const first=port.expand(root,root.legalActions.find(a=>a.target?.tradeId==="credits-for-energy").actionId);
  const poor=port.expand(first,first.legalActions.find(a=>a.target?.tradeId==="energy-for-credit").actionId);
  assert.equal(port.knownCardMoneyOrder(poor).group,order.group);
  const out=searchDecision({port,root,evaluate,resourceDominance:enabled,budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000}});
  assert(out.complete,out.stopReason);assert.deepEqual(comp.lifecycle.save().envelope,before);port.close();return out;
 }
 const raw=run(false),pruned=run(true),cached=run(true,256);
 for(const x of [pruned,cached]){assert.equal(x.actionId,raw.actionId);assert.equal(x.value,raw.value);assert.equal(x.lines[0].distance,raw.lines[0].distance);assert(x.diagnostics.dominancePrunes>0);}
 results.push({raw:raw.diagnostics.transitions,pruned:pruned.diagnostics.transitions,value:raw.value});comp.dispose();
}
// 从实际实体或固定牌堆搬入条件牌，不能制造重复卡牌。
for(const [cardId,place] of [["dlc_27.png","hand"],["dlc_28.png","hand"],["b_13.webp","hand"],["dlc_27.png","parked"],["dlc_27.png","public"]]){
 const f=fixtures[1],seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition,s=JSON.parse(f.compositionEnvelope.committedState),owner=s.players.players.find(p=>p.id===f.seatId);
 if(place!=="hand"){
  owner.initialSelection.industry={id:`industry:${place==="parked"?"未来跨度研究所":"深空探测"}.png`};industry.ensurePlayerIndustryState(owner);
  if(place==="public")for(let slot=0;slot<3;slot+=1){s.cards.discardPile.push(s.cards.publicCards[slot]);s.cards.publicCards[slot]=owner.hand.pop();}
  owner.resources.handSize=owner.hand.length;
 }
 assert(comp.lifecycle.restore({...f.compositionEnvelope,committedState:JSON.stringify(s)}).ok);
 const baseline=createAnalysisPort({composition:comp,seatId:f.seatId});assert(baseline.knownCardMoneyOrder(baseline.openRoot()),"加入反例前必须满足证明前提");baseline.close();
 const lists=[s.cards.discardPile,s.cards.publicCards,...Object.values(s.cards.passReservePiles),...s.players.players.flatMap(p=>[p.hand,p.reservedCards])];let found;
 for(const list of lists){const index=list.findIndex(c=>c?.cardId===cardId);if(index>=0){found=list[index];if(list===s.cards.publicCards)list[index]=null;else list.splice(index,1);break;}}
 if(!found){assert(s.cards.drawPileCardIds.includes(cardId));found=cards.createCommittedCardInstance(s,cards.CARD_CATALOG.find(c=>c.card_id===cardId));s.cards.drawPileCardIds=s.cards.drawPileCardIds.filter(id=>id!==cardId);}
 if(place==="parked"){owner.industryFutureSpan.card=found;owner.industryFutureSpan.targetScore=owner.resources.score+15;}
 else if(place==="public"){s.cards.discardPile.push(s.cards.publicCards[0]);s.cards.publicCards[0]=found;}
 else owner.hand.push(found);
 owner.resources.handSize=owner.hand.length;
 assert(comp.lifecycle.restore({...f.compositionEnvelope,committedState:JSON.stringify(s)}).ok);
 const port=createAnalysisPort({composition:comp,seatId:f.seatId});assert.equal(port.knownCardMoneyOrder(port.openRoot()),null,`${cardId}/${place}`);port.close();comp.dispose();
}
assert(paired.some(row=>row.extraStops>0),"真实DLC17须覆盖较富侧额外停止支付的条件步骤");
console.log(JSON.stringify({knownCardMoney:"passed",results,paired}));

"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createSimulationRuleComposition}=require("../../training/simulation-rule-composition"),{createSeededRandom}=require("../random"),
  {buildRuleObservation}=require("../../app/rule-observation"),{createAnalysisPort}=require("./analysis-port"),
  {searchDecision}=require("./decision-search"),{createStateValueEvaluator}=require("./state-value");
const data=require("../data"),cards=require("../cards/deck"),effects=require("../cards/effects"),rockets=require("../rockets"),
  techBoard=require("../tech/board-state"),playerTech=require("../tech/player-tech"),finals=require("../final-scoring");
const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json")));
const initial=JSON.parse(fixture.compositionEnvelope.committedState),seatId=fixture.seatId,seed=fixture.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition,evaluate=createStateValueEvaluator(seatId);
const own=s=>s.players.players.find(p=>p.id===seatId);
function controlled(energy,hand=0,pool=0){
 const s=structuredClone(initial),p=own(s);p.mainActionCompleted=true;s.cards.discardPile.push(...p.hand.slice(hand));p.hand=p.hand.slice(0,hand);
 Object.assign(p.resources,{credits:0,energy,publicity:0,availableData:0,handSize:hand});p.dataState=data.createDefaultDataState();
 for(let i=0;i<pool;i+=1)assert(data.gainData(p,{root:s}).ok);return s;
}
function open(s,cache=0){
 const restored=comp.lifecycle.restore({...fixture.compositionEnvelope,committedState:JSON.stringify(s)});assert(restored.ok,JSON.stringify(restored));
 const before=comp.lifecycle.save().envelope,port=createAnalysisPort({composition:comp,seatId,maxCacheEntries:cache});return{port,root:port.openRoot(),before};
}
function run(s,enabled,cache=0){
 const {port,root,before}=open(s,cache);
 try{
  const bound=port.postMainValueBound(root);assert(bound,"controlled window must satisfy bound scope");const upper=evaluate(root.observation)+bound.maximumValueIncrease;
  const wrapped={...port,postMainOptimalPlanSpec:()=>null,postMainPlanSpec:()=>null,postMainBorrowSpec:()=>null,...(!enabled?{postMainValueBound:()=>null}:{})};
  const out=searchDecision({port:wrapped,root,evaluate,postMainPruning:true,budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000}});
  assert(out.complete,out.stopReason);assert.deepEqual(comp.lifecycle.save().envelope,before);
  for(const line of out.lines.filter(line=>["other-owner","information-barrier","terminal"].includes(line.status)))assert(line.value<=upper,JSON.stringify({value:line.value,upper,bound}));
  for(const line of out.lines.filter(line=>line.prunedByBound)){
   assert(line.prunedByBound.value>line.prunedByBound.upperBound);assert.equal(line.value,null);assert.equal(line.prunedByBound.boundKind,"post-main-continuation");
  }
  return{out,bound,upper};
 }finally{port.close();}
}
const rows=[];
for(const [name,s] of [["no-energy",controlled(0)],["one-energy",controlled(1)],["two-energy",controlled(2)],["cash-income",controlled(0,1,4)]]){
 const raw=run(s,false),bounded=run(s,true),cached=run(s,true,256);
 for(const actual of [bounded,cached]){assert.equal(actual.out.value,raw.out.value,name);assert.equal(actual.out.actionId,raw.out.actionId,name);assert.equal(actual.out.lines[0].distance,raw.out.lines[0].distance,name);}
 rows.push({name,raw:raw.out.diagnostics.transitions,bounded:bounded.out.diagnostics.transitions,prunes:bounded.out.diagnostics.postMainValuePrunes,upper:raw.upper,value:raw.out.value});
}
const nearby=controlled(1),ship=nearby.pieces.rockets.find(r=>r.playerId===seatId);
rockets.assignRocketToSlot(ship,4,1,rockets.findAvailableSlotIndex(nearby.pieces,4,1,ship.id));
const nearRaw=run(nearby,false),nearBound=run(nearby,true);
assert.equal(nearRaw.bound.minimumFirstPositiveMoves,1);assert.equal(nearRaw.bound.movementUpper,0.5);
assert(nearRaw.out.actionId.startsWith("industry:"));assert.equal(nearBound.out.actionId,nearRaw.out.actionId);assert.equal(nearBound.out.value,nearRaw.out.value);assert.equal(nearBound.out.lines[0].distance,nearRaw.out.lines[0].distance);
rows.push({name:"reachable-mercury",raw:nearRaw.out.diagnostics.transitions,bounded:nearBound.out.diagnostics.transitions,prunes:nearBound.out.diagnostics.postMainValuePrunes,upper:nearRaw.upper,value:nearRaw.out.value});
function reserve(s,id){
 const lists=[s.cards.discardPile,s.cards.publicCards,...Object.values(s.cards.passReservePiles),...s.players.players.flatMap(p=>[p.hand,p.reservedCards])];let c;
 for(const list of lists){const i=list.findIndex(card=>card?.cardId===id);if(i>=0){c=list[i];if(list===s.cards.publicCards)list[i]=null;else list.splice(i,1);break;}}
 if(!c){assert(s.cards.drawPileCardIds.includes(id));c=cards.createCommittedCardInstance(s,cards.CARD_CATALOG.find(c=>c.card_id===id));s.cards.drawPileCardIds=s.cards.drawPileCardIds.filter(x=>x!==id);}
 own(s).reservedCards.push(c);effects.ensureCardEffectState(c);own(s).resources.handSize=own(s).hand.length;return c;
}
const neutral=controlled(1);reserve(neutral,"b_10.webp");const neutralRaw=run(neutral,false),neutralBound=run(neutral,true);
assert.equal(neutralRaw.bound.movementUpper,0.5,"neutral visit slots can offset intermediate moves and must not be omitted from distance relaxation");
assert.equal(neutralBound.out.value,neutralRaw.out.value);assert.equal(neutralBound.out.actionId,neutralRaw.out.actionId);assert.equal(neutralBound.out.lines[0].distance,neutralRaw.out.lines[0].distance);
rows.push({name:"neutral-data-visits",raw:neutralRaw.out.diagnostics.transitions,bounded:neutralBound.out.diagnostics.transitions,prunes:neutralBound.out.diagnostics.postMainValuePrunes,upper:neutralRaw.upper,value:neutralRaw.out.value});
// Normalize stale model consumption exactly as Production does; stale IDs cannot erase a future reward.
const stale=structuredClone(nearby),b71=own(stale).reservedCards.find(c=>c.cardId==="b_71.webp");
b71.cardEffectState.consumedTriggerIds=effects.getCardModel(b71).triggers.map(t=>t.id);b71.cardEffectState.modelCardId="stale";
const stalePort=open(stale);assert.equal(stalePort.port.postMainValueBound(stalePort.root).movementUpper,0.5);stalePort.port.close();
function rejected(change){const s=controlled(1,1,4);const baseline=open(s);assert(baseline.port.postMainValueBound(baseline.root));baseline.port.close();change(s,own(s));const p=open(s);assert.equal(p.port.postMainValueBound(p.root),null);p.port.close();}
rejected((s,p)=>{p.mainActionCompleted=false;});
rejected((s,p)=>{assert(techBoard.consumeStartupTileWithoutRewards(s.tech,"blue1").ok);assert(playerTech.recordPlayerTake(p.techState,"blue1",1).ok);});
rejected((s,p)=>{p.resources.score=Math.min(...s.finalScoring.thresholds);});
rejected((s,p)=>{assert(finals.placeDirectMarkAtSlot(s.finalScoring,"a",p,1,{root:s,threshold:25}).ok);});
rejected(s=>{s.turn.type1TriggerEvents=[{type:"visitPlanet",playerId:seatId,planetId:"mercury"}];});
rejected(s=>{s.cards.drawPileCardIds=[];});
for(const id of ["b_139.webp","b_26.webp","b_2.webp","dlc_35.png"])rejected(s=>{reserve(s,id);});
assert(rows.some(row=>row.prunes>0));comp.dispose();console.log(JSON.stringify({postMainValueBound:"passed",rows}));

'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value'),{searchDecision}=require('../randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [sources,searches,autonomy,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const roots=read(sources).decisionRoots,reference=read(searches),local=read(autonomy).rows.officialR179;
const seatId='player-white',seed='seti-free-analyze-v1',v=createStateValueEvaluator(seatId);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function action(expected){
 const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===expected.actionId);
 assert.deepEqual(a,expected);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
}
function search(envelope){
 restore(envelope);const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{
  const root=p.openRoot(),s=searchDecision({port:p,root,evaluate:v,modelKey:v.modelKey,budget:BUDGET,...OPTIONS});
  assert(s.complete&&!s.unresolved.length);assert.deepEqual(save(),envelope);
  return{actionId:s.actionId,value:s.value,native:s.diagnostics.nativeExecutions,
   ranking:s.roots.map(r=>[r.actionId,r.goal?.id,r.value,r.realization===0?0:r.realization,r.preparationDebt]),
   region:s.lines.flatMap(l=>l.knownAmibaRegion?[l.knownAmibaRegion]:[])};
 }finally{p.close();}
}
const truth=e=>{const s=JSON.parse(e.committedState),p=s.players.players.find(p=>p.id===seatId);
 return{e,model:v.details(buildRuleObservation(s,seed,seatId)),resources:p.resources,income:p.income,hand:p.hand.map(c=>c.id),
  reserves:p.reservedCards.map(c=>c.id),blue:p.dataState.placedTokens.filter(t=>t.placementKind==='blueBonus').map(t=>t.blueSlot),
  computer:p.dataState.placedTokens.filter(t=>t.placementKind==='computer').map(t=>t.placementSlot),companyUsed:p.industryRoundMarkRound,
  tech:p.techState,ownedProbes:s.pieces.rockets.filter(r=>r.playerId===seatId)};};
try{
 const rows={};
 for(const [label,row] of Object.entries(roots)){
  const e=row.envelope,s=search(e),x=reference[label];assert.deepEqual([s.actionId,s.value,s.native],[x.actionId,x.value,x.native]);rows[label]={original:s};
  if(!['officialR179','second-fork-3'].includes(label))continue;
  const state=JSON.parse(e.committedState),deck=state.cards.drawPileCardIds;
  [deck[0],deck[1]]=[deck[1],deck[0]];
  for(const stack of Object.values(state.tech.stacks)){
   const i=stack.bonusIndex+1;
   if(i+1<stack.bonusQueue.length)[stack.bonusQueue[i],stack.bonusQueue[i+1]]=[stack.bonusQueue[i+1],stack.bonusQueue[i]];
  }
  const permuted={...e,committedState:JSON.stringify(state)},same=search(permuted);assert.deepEqual(same,s);rows[label].hiddenOrder=same;
 }
 assert.equal(rows.officialR179.original.value,158.5);
 assert.equal(rows['second-fork-3'].original.value,161.5);assert.equal(rows['second-fork-3'].original.native,68);
 assert.equal(rows['second-fork-4'].original.region.length,0);
 assert.equal(rows['second-fork-5'].original.region.length,0);
 restore(roots.officialR179.envelope);
 const evidence={};
 for(let i=0;i<local.accepted.length;i++){
  const x=local.accepted[i];
  assert(x.native<=256&&x.ms<=600);
  if([3,10,12,15,16].includes(i))evidence[i]=truth(save());
  action(x.action);
 }
 assert.deepEqual(save(),local.stop.envelope);
 assert.deepEqual(evidence[3].e,roots['second-fork-3'].envelope);
 assert.equal(evidence[10].model.value,159);assert.equal(evidence[12].model.value,159);
 assert.equal(evidence[16].model.value,161.5);
 assert.equal(evidence[16].companyUsed,3);assert.equal(local.score,101);
 assert(evidence[10].hand.includes('alien-amiba-3-3'));assert(!evidence[16].hand.includes('alien-amiba-3-3'));
 assert(evidence[16].hand.includes('card-60-0'));assert(!evidence[16].hand.includes('alien-amiba-1-2'));
 restore(roots.officialR179.envelope);
 fs.writeFileSync(output,JSON.stringify({rows,evidence,localEnd:truth(local.stop.envelope),standardExperiment:false,rootRestored:true},null,2)+'\n',{flag:'wx'});
 console.log('31 local inputs independently replayed, V159 -> V159 -> V161.5; blind and future bonus orders do not change candidates');
}finally{c.dispose();}

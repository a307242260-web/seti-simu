'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {evaluateStateValue}=load('randomizer/game/ai/state-value');
const [proof,out]=process.argv.slice(2),record=read(proof),root=record.root,seat='player-white',seed=JSON.parse(root.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function submit(w){
 const a=menu().find(q=>q.actionId===w.actionId&&q.actorId===w.actorId),d=c.inspect().session?.decision;assert(a,w.summary);
 assert.deepEqual(a.target,w.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));
}
function measure(end){
 const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(v=>v.id===seat),o=c.projection({role:'player',playerId:seat}).state;
 const value=evaluateStateValue(o,seat);
 const ap=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  const n=ap.openRoot(),rd=ap.researchDataPurpose(),sf=ap.researchScanPurpose();
  assert.deepEqual(save(),e);
  const stack=Object.keys(s.tech.stacks).filter(id=>s.tech.stacks[id].remaining&&!p.techState.ownedTiles[id]);
  return {end,turn:s.turn.turnNumber,pending:menu().map(a=>[a.family,a.target?.tileId,a.summary]),value,wallet:p.resources,
   hand:p.hand.map(h=>[h.id,h.cardId]),knownInitialHand:p.hand.every(h=>JSON.parse(root.committedState).players.players.find(v=>v.id===seat).hand.some(x=>x.id===h.id)),
   tech:p.techState,income:p.income,probes:s.pieces.rockets.filter(q=>q.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],
   researchAvailable:n.legalActions.some(a=>a.family==='research_tech'),researchDataPurpose:rd,researchScanPurpose:sf,remainingTech:stack,envelope:e};
 }finally{ap.close();}
}
try{
 const rows={};
 for(const [label,q]of Object.entries(record.rows)){
  restore(root);
  const marks=[];
  for(const {index,action}of q.steps){
   submit(action);
   if(action.family==='end_turn')marks.push(measure(index));
  }
  assert.deepEqual(save(),q.envelope);
  rows[label]=marks;
 }
 restore(root);
 const summary=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.map(x=>[x.end,x.turn,x.wallet.score,x.value.total,x.wallet.publicity,
   x.wallet.availableData,Object.keys(x.tech.ownedTiles).length,x.researchAvailable,x.knownInitialHand,Boolean(x.researchDataPurpose)])]));
 fs.writeFileSync(out,JSON.stringify({scope:'Same exact R179 Native root, closed own turn vs closed own turn. No searches, no new autonomous runs. Newly revealed hand identities flagged.',summary,rows,rootAndRngRestored:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}

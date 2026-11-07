'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const [fixtures,benchmark,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const key='early-A0-analyzed',origin=read(fixtures).decisionRoots[key].envelope,graph=read(benchmark)[key].search.lines;
const seed='seti-free-analyze-v1',seatId='player-white',evaluate=createStateValueEvaluator(seatId);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function action(id){
 const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(x=>x.actionId===id);assert(a,id);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
function snapshot(){
 const e=save(),s=JSON.parse(e.committedState),p=s.players.players.find(x=>x.id===seatId);
 return{e,wallet:p.resources,hand:p.hand.map(c=>c.cardId),slots:p.dataState.placedTokens.map(t=>[t.placementKind,t.placementSlot,t.blueSlot]),
  ownProbes:s.pieces.rockets.filter(r=>r.playerId===seatId).length,observed:evaluate.details(buildRuleObservation(s,seed,seatId))};
}
try{
 const paths=new Map([[0,[]]]),queue=[0],rows=[];
 for(const i of queue)for(const e of graph[i].edges)if(e.steps?.length&&!paths.has(e.target)){
  paths.set(e.target,[...paths.get(i),...e.steps]);queue.push(e.target);
 }
 for(const n of graph)for(const e of n.edges)if(e.resourcePlan?.id==='data:computer-prefix:3'&&paths.has(n.node)){
  const target=graph[e.target],blue=target.edges.find(e=>e.resourcePlan?.id==='data:blue:1'),end=target.edges.find(e=>e.actionId.startsWith('end_turn:'));
  if(!blue||!end||target.edges.length!==2)continue;
  restore(origin);for(const id of paths.get(n.node))action(id);
  const source=snapshot(),prefix=e.steps.map(action),intermediate=snapshot(),alternatives={};
  for(const [kind,steps] of [['end',[end.actionId]],['blue',blue.steps]]){
   restore(intermediate.e);
   const acts=steps.map(action),after=snapshot();
   restore(source.e);for(const a of [...prefix,...acts])assert.deepEqual(action(a.actionId),a);assert.deepEqual(save(),after.e);
   alternatives[kind]={acts,after,referenceValue:graph[(kind==='end'?end:blue).target].value};
  }
  rows.push({node:n.node,source,prefix,intermediate,alternatives});
  console.log(n.node,'computer',source.wallet.availableData,'to',intermediate.wallet.availableData,'ownedProbe',source.ownProbes,'blue',alternatives.blue.acts.map(a=>a.summary));
 }
 assert.equal(rows.length,8);restore(origin);
 fs.writeFileSync(output,JSON.stringify({rows,rootRestored:true,standardExperiment:false},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}

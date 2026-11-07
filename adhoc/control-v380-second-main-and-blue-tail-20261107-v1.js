'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const [source,reference,bench,output,autonomyInput]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const q=read(source).rows[3],ref=read(reference)['before-research-computer3'];
const blueRoot=read(bench).decisionRoots['before-research-computer3'].envelope;
const seatId='player-white',seed='seti-free-analyze-v1';
function composition(){
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k.composition;
}
const c=composition(), replay=composition();
const save=c=>c.lifecycle.save().envelope;
function restore(c,e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(c),e);}
function current(c){const d=c.inspect().session?.decision;return {d,actions:d?.choices||c.inputPort.enumerateActions({})};}
function input(c,id){
 const {d,actions}=current(c),a=actions.find(a=>a.actionId===id);assert(a,`unavailable: ${id}`);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
function ids(edge){
 if(edge.steps?.length)return edge.steps;
 assert.equal(edge.turnTailPlanValue?.kind,'end-turn');
 assert(!edge.turnTailPlanValue?.deferredPublicity);
 assert.equal(edge.turnTailPlanValue?.markedTiles.length,0);
 return [edge.actionId];
}
function views(e){
 const s=JSON.parse(e.committedState),p=s.players.players.find(p=>p.id===seatId);
 return {resources:p.resources,income:p.income,tech:p.techState.ownedTiles,
  hand:p.hand.map(a=>a.cardId),reserves:p.reservedCards.map(a=>a.cardId),data:p.dataState,rockets:s.pieces.rockets.filter(r=>r.playerId===seatId),
  publicCards:s.cards, turn:s.turn.turnNumber, active:s.turn.currentPlayerId};
}
function execute(origin,ids){
 restore(c,origin);const actions=ids.map(id=>input(c,id)),e=save(c);
 restore(replay,origin);
 for(const a of actions)assert.deepEqual(input(replay,a.actionId),a);
 assert.deepEqual(save(replay),e);
 return {e,actions};
}
function choose(n,lines){
 return [...n.edges].filter(x=>lines[x.target].value===n.value).sort((a,b)=>{
  const x=lines[a.target],y=lines[b.target];return y.realization-x.realization||x.preparationDebt-y.preparationDebt||a.cost+x.distance-b.cost-y.distance;
 })[0];
}
try{
 const n=q.search.lines,root=n[0],rows={},blueWitnesses=[];
 const primary=[
  ['second-research',e=>e.resourcePlan?.id==='tech:blue4:4'],
  ['amiba0-blue',e=>e.actionId==='play_card:6bef76b1'],
  ['amiba3-blue',e=>e.actionId==='play_card:cb499bba'],
  ['amiba9',e=>e.actionId==='play_card:e9d4ada9'],
  ...['sector-1-b','sector-3-a','sector-3-b','sector-4-a'].map(id=>['scan-'+id,e=>e.resourcePlan?.id==='scan:sector:'+id])
 ];
 for(const [label,pick] of primary){
  let edge=root.edges.find(pick);assert(edge,label);
  const model=n[edge.target].value,rootEdge=edge;const steps=[];
  while(edge){
   if(edge.turnTailPlanValue?.dataPlans){
    const proof=edge.turnTailPlanValue;
    restore(c,q.envelope);for(const id of steps)input(c,id);
    function take(predicate){const a=current(c).actions.find(predicate);assert(a,JSON.stringify(current(c).actions));steps.push(a.actionId);input(c,a.actionId);}
    const base=steps.length;
    for(const p of proof.dataPlans){
     assert(!p.dataCornerId&&!p.incomeCardId);
     for(let j=0;j<(p.computerPlacements??p.placements??0);j++){
      take(a=>a.family==='place_data');take(a=>a.family==='choose_target'&&a.target.target==='computer');
     }
     if(p.blueSlot){take(a=>a.family==='place_data');take(a=>a.family==='choose_target'&&a.target.target==='blueBonus'&&a.target.blueSlot===p.blueSlot);}
    }
    take(a=>a.family==='end_turn');assert.equal(steps.length-base,proof.requiredNativeInputs);
   }else steps.push(...ids(edge));
   edge=choose(n[edge.target],n);
  }
  const result=execute(q.envelope,steps),s=views(result.e);
  assert.notEqual(s.turn,views(q.envelope).turn);assert.equal(s.active,seatId);
  rows[label]={analyzed:result,model,rootEdge,...s};
  console.log(label,model,steps.length,s.resources,s.hand,result.actions.map(a=>[a.family,a.summary]));
 }
 // Same action and known symbol; compare the immediate credit with retaining
 // its data for the next computer cycle. Both lines advance the same turn.
 const main=rows['amiba0-blue'].analyzed.actions,base=main.map(a=>a.actionId);
 assert.deepEqual(main.map(a=>a.family),['play_card','choose_target','place_data','choose_target','place_data','choose_target','end_turn']);
 assert.equal(main[5].target.blueSlot,3);
 for(const [label,steps] of [['amiba0-computer-only',[...base.slice(0,4),base.at(-1)]],['amiba0-stock',[...base.slice(0,2),base.at(-1)]]]){
  const result=execute(q.envelope,steps),s=views(result.e);
  assert.notEqual(s.turn,views(q.envelope).turn);assert.equal(s.active,seatId);
  rows[label]={analyzed:result,model:null,...s};
  console.log(label,steps.length,s.resources,s.hand);
 }
 const graph=ref.search.lines,paths=new Map([[0,[]]]),visit=[0];
 // Only native edges can establish this witness; synthetic leaves have no successor.
 for(const i of visit)for(const e of graph[i].edges){
  if(paths.has(e.target)||!e.steps?.length)continue;
  paths.set(e.target,[...paths.get(i),...e.steps]);visit.push(e.target);
 }
 for(const node of graph){
  if(!paths.has(node.node))continue;
  for(const edge of node.edges){
   if(edge.resourcePlan?.goal.kind!=='blue-data'||edge.resourcePlan.goal.blueSlot!==2||!edge.steps?.length)continue;
   const tail=graph[edge.target];
   const end=tail.edges.find(e=>e.actionId.startsWith('end_turn:'));
   const start=execute(blueRoot,paths.get(node.node)),after=execute(start.e,edge.steps);
   const endResult=end&&!end.turnTailPlanValue?.deferredPublicity&&!end.turnTailPlanValue?.markedTiles.length?execute(after.e,ids(end)):null;
   const a=views(start.e),b=views(after.e);
   blueWitnesses.push({node:node.node,source:node,edge,start,after,endResult,tail,beforeWallet:a.resources,afterWallet:b.resources,
    beforeHand:a.hand,afterHand:b.hand,liveProbes:a.rockets.length,remainingData:b.resources.availableData});
  }
 }
 assert(blueWitnesses.length>=30,blueWitnesses.length);
 for(const row of blueWitnesses)console.log('blue',row.node,row.tail.edges.map(x=>x.actionId.split(':')[0]).join(','),row.beforeWallet.availableData,
  row.remainingData,row.liveProbes,row.after.actions.map(a=>a.target?.choiceId||a.family).join('/'),row.afterHand.filter(x=>!row.beforeHand.includes(x)));
 restore(c,q.envelope);restore(replay,q.envelope);
 fs.writeFileSync(output,JSON.stringify({rows,blueWitnesses,standardExperiment:false,rootRestored:true},null,2)+'\n',{flag:'wx'});
 if(autonomyInput)fs.writeFileSync(autonomyInput,JSON.stringify({rows:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{analyzed:{e:v.analyzed.e}}]))},null,2)+'\n',{flag:'wx'});
}finally{replay.dispose();c.dispose();}

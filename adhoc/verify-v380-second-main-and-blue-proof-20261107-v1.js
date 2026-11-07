'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value'),{searchDecision}=require('../randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [bench,reference,candidate,controlled,localRuns,orderingRuns,analysis,analysisRuns,keepA7Runs,output]=process.argv.slice(2);
const read=p=>JSON.parse(fs.readFileSync(p)),a=read(reference),b=read(candidate);
const benchRoot=read(bench).decisionRoots['before-research-computer3'].envelope;
const seatId='player-white',seed='seti-free-analyze-v1',k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function action(id){
 const d=c.inspect().session?.decision,choice=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===id);assert(choice,id);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice})
   :choice.phase==='quick'?c.inputPort.submitQuickAction(choice):c.inputPort.submitAction(choice);assert(r.ok);return choice;
}
const scalar=l=>[l.value,l.realization,l.preparationDebt,l.distance].map(v=>v===0?0:v);
const edgeKey=e=>JSON.stringify([e.actionId,e.resourcePlan?.id,e.goalPlan?.id,e.turnTailPlanValue?.kind,e.steps,e.cost,e.equivalent]);
const alternateKey=e=>JSON.stringify([e.actionId,e.resourcePlan?.id,e.goalPlan?.id,e.turnTailPlanValue?.kind,e.steps,e.cost]);
const rank=x=>x.roots.map(r=>[r.actionId,r.goal?.id,...scalar(r),r.continuationDistance]);
const proofIds=x=>x.lines.flatMap(l=>l.edges.filter(e=>e.turnTailPlanValue?.bluePublicPick).map(e=>e.turnTailPlanValue.bluePublicPick));
const findNative=(l,e)=>l.edges.find(x=>edgeKey(x)===edgeKey(e))||l.edges.find(x=>alternateKey(x)===alternateKey(e));
function graphProof(source,target){
 const visited=new Map(),open=[[0,0,[]]],certificates=[];
 for(const [i,j,path] of open){
  if(visited.has(i)){assert.equal(visited.get(i),j);continue;}visited.set(i,j);
  const from=source.lines[j],to=target.lines[i];assert.deepEqual(scalar(to),scalar(from),`same path ${i} ${j}`);
  for(const edge of to.edges){
   if(edge.turnTailPlanValue?.bluePublicPick){
    const proof=edge.turnTailPlanValue,pick=proof.bluePublicPick;
    const native=from.edges.find(x=>x.resourcePlan?.goal.id==='data:blue:2'&&x.actionId===edge.actionId);
    assert(native);assert.equal(native.steps.at(-1),pick.cardActionId);
    const after=source.lines[native.target],end=after.edges.find(e=>e.actionId.startsWith('end_turn:'));
    assert(end&&after.edges.length===1);assert.equal(edge.cost,native.cost+end.cost);
    assert.deepEqual(scalar(target.lines[edge.target]),scalar(source.lines[end.target]));
    restore(benchRoot);for(const id of path)action(id);
    const before=save(),bState=JSON.parse(before.committedState),deckCount=bState.cards.drawPileCardIds.length;
    const sequence=native.steps.map(action);
    assert.equal(deckCount,pick.ordinaryDrawCountBefore);
    assert.equal(bState.cards.publicCards[pick.publicSlotIndex].id,pick.cardId);
    const afterPick=save(),picked=JSON.parse(afterPick.committedState);
    assert.equal(picked.cards.drawPileCardIds.length,pick.ordinaryDrawCountAfter);
    assert(picked.players.players.find(p=>p.id===seatId).hand.some(card=>card.id===pick.cardId&&card.blueBonusOwnerId===seatId));
    sequence.push(action(end.actionId));const terminal=save();
    restore(before);for(const expected of sequence)assert.deepEqual(action(expected.actionId),expected);assert.deepEqual(save(),terminal);
    certificates.push({candidateNode:i,referenceNode:j,value:scalar(target.lines[edge.target]),pick,sequence,before,afterPick,terminal});
    continue;
   }
   const match=findNative(from,edge);assert(match,`unchanged edge ${i} ${j}: ${edgeKey(edge)}`);
   open.push([edge.target,match.target,edge.steps?.length?[...path,...edge.steps]:null]);
  }
 }
 return certificates;
}
function evaluate(e){
 restore(e);const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),v=createStateValueEvaluator(seatId);
 try{const root=port.openRoot(),search=searchDecision({port,root,evaluate:v,modelKey:v.modelKey,budget:BUDGET,...OPTIONS});assert.deepEqual(save(),e);return search;}
 finally{port.close();}
}
function replayAll(origins,runs){
 const out={};for(const [name,row] of Object.entries(runs)){
  restore(origins[name].analyzed.e);
  for(const {action:expected,native,ms} of row.accepted){assert(native<=256&&ms<=600);assert.deepEqual(action(expected.actionId),expected);}
  assert.deepEqual(save(),row.stop.envelope);
  out[name]={inputs:row.accepted.length,stop:row.stop.reason,score:row.score,maxNative:Math.max(0,...row.accepted.map(x=>x.native)),maxMs:Math.max(0,...row.accepted.map(x=>x.ms))};
 }return out;
}
try{
 for(const [key,row] of Object.entries(b)){
  assert.equal(row.actionId,a[key].actionId);assert.deepEqual(scalar(row.search),scalar(a[key].search));assert.deepEqual(rank(row.search),rank(a[key].search));
 }
 const key='before-research-computer3',proofs=graphProof(a[key].search,b[key].search);assert.equal(proofs.length,12);
 assert.equal(a[key].native-b[key].native,36);
 const hidden=JSON.parse(benchRoot.committedState);[hidden.cards.drawPileCardIds[0],hidden.cards.drawPileCardIds[1]]=[hidden.cards.drawPileCardIds[1],hidden.cards.drawPileCardIds[0]];
 const permuted={...benchRoot,committedState:JSON.stringify(hidden)},result=evaluate(permuted);
 assert.equal(result.actionId,b[key].actionId);assert.deepEqual(rank(result),rank(b[key].search));assert.deepEqual(proofIds(result),proofIds(b[key].search));
 assert.equal(result.diagnostics.nativeExecutions,b[key].native);
 const orig=read(controlled).rows;
 const local={
  ...replayAll(orig,read(localRuns).rows),...replayAll(orig,read(orderingRuns).rows),
  ...replayAll(read(analysis).rows,read(analysisRuns).rows),...replayAll(read(analysis).rows,read(keepA7Runs).rows)
 };
 restore(benchRoot);assert.deepEqual(save(),benchRoot);
 const parity={proofs,local,unknownDrawSwap:{native:result.diagnostics.nativeExecutions,roots:rank(result),picks:proofIds(result)},rootRestored:true};
 fs.writeFileSync(output,JSON.stringify(parity,null,2)+'\n',{flag:'wx'});
 console.log('native blue witnesses:',proofs.length,'independent local lines:',Object.keys(local).length,'local inputs:',Object.values(local).reduce((n,r)=>n+r.inputs,0));
}finally{c.dispose();}

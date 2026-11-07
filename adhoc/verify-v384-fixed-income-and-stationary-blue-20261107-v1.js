'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value'),{searchDecision}=require('../randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const [source,baseline,candidate,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const roots=read(source).decisionRoots,b=read(baseline),f=read(candidate),seatId='player-white',seed='seti-free-analyze-v1';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function action(id){
 const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({}),a=menu.find(x=>x.actionId===id);assert(a,id);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
const num=v=>v===0?0:v,scalar=n=>[n.value,n.realization,n.preparationDebt,n.distance].map(num);
const compare=(a,b)=>a.actionId===b.actionId&&a.resourcePlan?.id===b.resourcePlan?.id&&a.goalPlan?.id===b.goalPlan?.id&&a.cost===b.cost
 &&JSON.stringify(a.steps)===JSON.stringify(b.steps);
const rank=s=>s.roots.map(r=>[r.actionId,r.goal?.id,...scalar(r)]);
const newTails=s=>s.lines.flatMap(l=>l.edges.filter(e=>e.turnTailPlanValue?.incomeThenQuietEnd||e.turnTailPlanValue?.bluePublicPick?.stationaryProbe||e.turnTailPlanValue?.computerThenQuietEnd)
 .map(e=>e.turnTailPlanValue));
function hiddenDeckCheck(e,target){
 const s=JSON.parse(e.committedState),d=s.cards.drawPileCardIds;[d[0],d[1]]=[d[1],d[0]];
 const shuffled={...e,committedState:JSON.stringify(s)};restore(shuffled);
 const p=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seatId);
 try{
  const root=p.openRoot(),r=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS});
  assert(r.complete&&!r.unresolved.length);assert.deepEqual(save(),shuffled);
  assert.equal(r.actionId,target.actionId);assert.deepEqual(rank(r),rank(target));assert.deepEqual(newTails(r),newTails(target));
  assert.equal(r.diagnostics.nativeExecutions,target.diagnostics.nativeExecutions);
  return {actionId:r.actionId,native:r.diagnostics.nativeExecutions,picks:newTails(r).length};
 }finally{p.close();}
}
try{
 const results={};
 for(const [label,x] of Object.entries(f)){
  const orig=roots[label].envelope,source=b[label].search,target=x.search;
  assert.equal(source.actionId,target.actionId);assert.deepEqual(rank(source),rank(target));
  const found=new Map(),open=[[0,0,[]]],certificates=[];
  for(const [i,j,path] of open){
   if(found.has(i)){assert.equal(found.get(i),j);continue;}found.set(i,j);
   const from=source.lines[j],to=target.lines[i];assert.deepEqual(scalar(from),scalar(to),`node ${i}/${j}`);
   for(const edge of to.edges){
    const proof=edge.turnTailPlanValue,inc=proof?.incomeThenQuietEnd,blue=proof?.bluePublicPick?.stationaryProbe,comp=proof?.computerThenQuietEnd;
    if(!inc&&!blue&&!comp){
     const same=from.edges.find(x=>compare(x,edge));assert(same,`edge ${i}/${j} ${edge.actionId}`);
     open.push([edge.target,same.target,edge.steps?.length?[...path,...edge.steps]:null]);continue;
    }
    const prefix=from.edges.find(e=>e.resourcePlan?.goal.id===(inc?'data:income:4':comp?'data:computer-prefix:3':'data:blue:2')&&e.actionId===edge.actionId);
    assert(prefix&&prefix.steps.length===(inc?.requiredIncomeInputs??comp?.requiredPlacementInputs??3));
    const next=source.lines[prefix.target],end=next.edges[0];
    assert.equal(next.edges.length,1);assert(end.actionId.startsWith('end_turn:')&&!end.turnTailPlanValue?.deferredPublicity);
    assert.deepEqual(scalar(target.lines[edge.target]),scalar(source.lines[end.target]));
    restore(orig);for(const id of path)action(id);
    const before=save(),actions=prefix.steps.map(action),intermediate=save();
    if(comp)assert(actions.every((a,i)=>i%2===0?a.family==='place_data':a.family==='choose_target'&&a.target.target==='computer'));
    else assert.equal(actions.at(-1).target.cardInstanceId,inc?.incomeCardId??proof.bluePublicPick.cardId);
    actions.push(action(end.actionId));const endpoint=save();
    assert.equal(actions.length,edge.cost);
    restore(before);for(const a of actions)assert.deepEqual(action(a.actionId),a);assert.deepEqual(save(),endpoint);
    certificates.push({sourceNode:j,candidateNode:i,before,actions,intermediate,endpoint,proof});
   }
  }
  const shuffle=label==='early-A0-analyzed'?hiddenDeckCheck(orig,target):null;
  restore(orig);
  results[label]={nativeBefore:b[label].native,nativeAfter:x.native,certificates,shuffle};
  console.log(label,b[label].native,x.native,certificates.length);
 }
 fs.writeFileSync(output,JSON.stringify({results,rootRestored:true},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}

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
    const same=from.edges.find(x=>compare(x,edge));
    if(same){open.push([edge.target,same.target,edge.steps?.length&&path?[...path,...edge.steps]:null]);continue;}
    const proof=edge.turnTailPlanValue,pick=proof?.bluePublicPick;
    assert(pick?.singleCurrencyIncome&&path,`unexpected new edge ${i}/${j} ${edge.actionId}`);
    const prefix=from.edges.find(e=>e.resourcePlan?.goal.id==='data:blue:2'&&e.actionId===edge.actionId);
    assert(prefix&&prefix.steps.length===3);
    const afterBlue=source.lines[prefix.target],income=afterBlue.edges[0];
    assert.equal(afterBlue.edges.length,1);
    const bundled=!income.resourcePlan&&income.turnTailPlanValue?.dataPlans?.[0]?.goal.id==='data:income:4';
    if(bundled)assert(!pick.taskChoice&&income.turnTailPlanValue.requiredNativeInputs===4);
    else assert(income.resourcePlan?.goal.id==='data:income:4'&&income.steps.length===3);
    const after=source.lines[income.target],endOf=n=>n.edges.find(e=>e.actionId.startsWith('end_turn:'));
    const claim=after.edges.find(e=>e.actionId.startsWith('complete_task:')),keep=endOf(after);
    if(!bundled)assert(keep&&after.edges.length===(pick.taskChoice?2:1));
    const end=bundled?income:pick.taskChoice?.selected==='claim'?endOf(source.lines[claim.target]):keep;
    assert(end);
    const selected=source.lines[end.target];
    assert.deepEqual(scalar(target.lines[edge.target]).slice(0,3),scalar(selected).slice(0,3));
    restore(orig);for(const id of path)action(id);
    const before=save(),blue=prefix.steps.map(action),afterPick=save();
    assert.equal(blue.at(-1).target.cardInstanceId,pick.cardId);
    const choose=test=>{
      const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(test);
      assert(a);return action(a.actionId);
    };
    const expectedIncome=pick.continuingDataPlans[0].incomeCardId;
    const paid=bundled?[action(income.actionId),choose(a=>a.target.target==='computer'),
      choose(a=>a.target.cardInstanceId===expectedIncome)]:income.steps.map(action),intermediate=save();
    assert.equal(paid.at(-1).target.cardInstanceId,expectedIncome);
    const pre=[...blue,...paid],branches={};
    for(const label of pick.taskChoice?['claim','defer']:['end']){
     restore(intermediate);const suffix=[];
     if(label==='claim'){suffix.push(action(claim.actionId));suffix.push(action(endOf(source.lines[claim.target]).actionId));}
     else suffix.push(bundled?choose(a=>a.family==='end_turn'):action(keep.actionId));
     if(label==='defer'){
      const d=c.inspect().session?.decision,a=d?.choices.find(a=>a.target.choiceId===`skip:task:${pick.taskChoice.id}:${pick.taskChoice.ruleId}`);
      assert(a);suffix.push(action(a.actionId));
     }
     const endpoint=save();assert.equal(pre.length+suffix.length,edge.cost);
     restore(before);for(const a of [...pre,...suffix])assert.deepEqual(action(a.actionId),a);
     assert.deepEqual(save(),endpoint);branches[label]={suffix,endpoint};
    }
    certificates.push({sourceNode:j,candidateNode:i,before,prefix:pre,afterPick,afterIncome:intermediate,branches,proof});
   }
  }
  restore(orig);
  results[label]={nativeBefore:b[label].native,nativeAfter:x.native,certificates};
  console.log(label,b[label].native,x.native,certificates.length);
 }
 fs.writeFileSync(output,JSON.stringify({results,rootRestored:true},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}

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
    const proof=edge.turnTailPlanValue,pick=proof?.bluePublicPick,chain=proof?.incomeThenBlueCurrency;
    assert((pick?.scoredFundingCornerId||chain)&&path,`unexpected new edge ${i}/${j} ${edge.actionId}`);
    const prefix=from.edges.find(e=>e.resourcePlan?.goal.id===(chain?'data:income:4':'data:blue:2')&&e.actionId===edge.actionId);
    assert(prefix?.steps);
    restore(orig);for(const id of path)action(id);
    const before=save(),steps=prefix.steps.map(action);
    let suffix=source.lines[prefix.target],actualPick=pick;
    if(chain){
      assert.equal(steps.length,chain.incomeInputs);
      assert.equal(steps.at(-1).target.cardInstanceId,chain.incomeCardId);
      const blue=suffix.edges[0];
      assert.equal(suffix.edges.length,1);assert.equal(blue.resourcePlan?.goal.id,'data:blue:1');
      assert.equal(blue.steps?.length,chain.blueInputs);
      steps.push(...blue.steps.map(action));suffix=source.lines[blue.target];actualPick=chain.pick;
    }else{
      assert.equal(steps.length,4);
      assert.equal(steps[0].target.cardInstanceId,pick.scoredFundingCornerId);
      assert.equal(steps.at(-1).target.cardInstanceId,pick.cardId);
    }
    const atFork=save(),branches={},endOf=n=>n.edges.find(e=>e.actionId.startsWith('end_turn:'));
    assert(suffix.edges.length===(chain&&actualPick?2:1));
    for(const label of chain&&actualPick?['end','public-pick']:['end']){
      restore(atFork);const tail=[];
      let end=endOf(suffix);
      if(label==='public-pick'){
        const blue=suffix.edges.find(e=>e.resourcePlan?.goal.id==='data:blue:2');assert(blue?.steps?.length===4);
        tail.push(...blue.steps.map(action));assert.equal(tail[0].target.cardInstanceId,actualPick.scoredFundingCornerId);
        assert.equal(tail.at(-1).target.cardInstanceId,actualPick.cardId);
        end=endOf(source.lines[blue.target]);
      }
      assert(end);tail.push(action(end.actionId));const endpoint=save(),leaf=source.lines[end.target];
      if(label===(chain?.selected||'end')){
        assert.equal(steps.length+tail.length,edge.cost);
        assert.deepEqual(scalar(target.lines[edge.target]).slice(0,3),scalar(leaf).slice(0,3));
      }
      restore(before);for(const a of [...steps,...tail])assert.deepEqual(action(a.actionId),a);assert.deepEqual(save(),endpoint);
      branches[label]={tail,endpoint};
    }
    certificates.push({sourceNode:j,candidateNode:i,before,steps,atFork,branches,proof});
   }
  }
  restore(orig);
  results[label]={nativeBefore:b[label].native,nativeAfter:x.native,certificates};
  console.log(label,b[label].native,x.native,certificates.length);
 }
 fs.writeFileSync(output,JSON.stringify({results,rootRestored:true},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}

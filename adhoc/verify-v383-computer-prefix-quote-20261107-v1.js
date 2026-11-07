'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [source,baseline,candidate,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const roots=read(source).decisionRoots,b=read(baseline),f=read(candidate),seatId='player-white',seed='seti-free-analyze-v1';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function action(id){
 const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({}),a=menu.find(x=>x.actionId===id);assert(a,id);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);return a;
}
const num=v=>v===0?0:v,scalar=n=>[n.value,n.realization,n.preparationDebt,n.distance].map(num);
const compare=(a,b)=>a.actionId===b.actionId&&a.resourcePlan?.id===b.resourcePlan?.id&&a.goalPlan?.id===b.goalPlan?.id&&a.cost===b.cost
 &&JSON.stringify(a.steps)===JSON.stringify(b.steps);
try{
 const results={};
 for(const [label,x] of Object.entries(f)){
  const orig=roots[label].envelope,source=b[label].search,target=x.search;
  assert.equal(source.actionId,target.actionId);
  const ranks=s=>s.roots.map(r=>[r.actionId,r.goal?.id,...scalar(r)]);
  assert.deepEqual(ranks(source),ranks(target));
  const found=new Map(),open=[[0,0,[]]],certificates=[];
  for(const [i,j,path] of open){
   if(found.has(i)){assert.equal(found.get(i),j);continue;}found.set(i,j);
   const from=source.lines[j],to=target.lines[i];
   assert.deepEqual(scalar(from),scalar(to));
   for(const edge of to.edges){
    const proof=edge.turnTailPlanValue?.computerThenScoredBlue;
    if(!proof){
     const same=from.edges.find(x=>compare(x,edge));assert(same,`edge ${i}/${j} ${edge.actionId}`);
     open.push([edge.target,same.target,edge.steps?.length?[...path,...edge.steps]:null]);continue;
    }
    const prefix=from.edges.find(e=>e.resourcePlan?.goal.id==='data:computer-prefix:3'&&e.actionId===edge.actionId);
    assert(prefix&&prefix.steps.length===proof.initialInputs);
    const next=source.lines[prefix.target],end=next.edges.find(e=>e.actionId.startsWith('end_turn:'));
    const blue=next.edges.find(e=>e.resourcePlan?.goal.kind==='blue-data');
    assert(end&&blue&&next.edges.length===2);const child=source.lines[blue.target];
    const blueEnd=child.edges.find(e=>e.actionId.startsWith('end_turn:'));assert(blueEnd&&child.edges.length===1);
    const endLeaf=source.lines[end.target],blueLeaf=source.lines[blueEnd.target];
    assert.equal(proof.blue.netGain,blueLeaf.value-endLeaf.value);
    assert.equal(proof.blue.unrealizedPurposeDelta,endLeaf.realization-blueLeaf.realization);
    assert.deepEqual(scalar(target.lines[edge.target]),scalar(proof.take?blueLeaf:endLeaf));
    restore(orig);for(const id of path)action(id);const before=save(),prefixActions=prefix.steps.map(action),mid=save(),arms={};
    for(const [k,ids] of [['end',[end.actionId]],['blue',[...blue.steps,blueEnd.actionId]]]){
     restore(mid);const steps=ids.map(action),endpoint=save();
     restore(before);for(const a of [...prefixActions,...steps])assert.deepEqual(action(a.actionId),a);assert.deepEqual(save(),endpoint);
     assert.equal(steps.length,proof[k].requiredNativeInputs);
     if(k==='blue'){assert.equal(steps[0].target.cardInstanceId,proof.cornerId);assert.equal(steps[2].target.blueSlot,proof.blueSlot);}
     arms[k]={steps,endpoint};
    }
    certificates.push({sourceNode:j,candidateNode:i,before,prefixActions,mid,proof,arms});
   }
  }
  restore(orig);
  results[label]={nativeBefore:b[label].native,nativeAfter:x.native,certificates};
  console.log(label,b[label].native,x.native,certificates.length);
 }
 fs.writeFileSync(output,JSON.stringify({results,rootRestored:true},null,2)+'\n',{flag:'wx'});
}finally{c.dispose();}

'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const [source,baseline,candidate,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),seed='seti-free-analyze-v1',seat='player-white';
const roots=read(source).decisionRoots,b=read(baseline),f=read(candidate),label='early-A0-analyzed';
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});k.newGame({seed});return k.composition;}
const c=kernel(),verify=kernel(),save=(k=c)=>k.lifecycle.save().envelope;
const restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
const menu=(k=c)=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function submit(a,k=c){
 assert.deepEqual(menu(k).find(q=>q.actionId===a.actionId),a);
 const d=k.inspect().session?.decision,r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
  a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}
const get=e=>e.session?.session?.workingState||JSON.parse(e.committedState),owner=s=>s.players.players.find(p=>p.id===seat);
const rank=x=>x.roots.map(q=>[q.actionId,q.goal?.id,q.value,q.realization,q.preparationDebt]);
const old=b[label].search,search=f[label].search,origin=roots[label].envelope;
assert.deepEqual(rank(old),rank(search));
try{
 const queue=[[0,0,[]]],visited=new Set(),rows=[];
 const sameEdge=(a,b)=>a.actionId===b.actionId&&a.cost===b.cost
   &&a.resourcePlan?.id===b.resourcePlan?.id&&a.goalPlan?.id===b.goalPlan?.id&&JSON.stringify(a.steps)===JSON.stringify(b.steps);
 const stableLine=(x,i)=>x.lines[i];
 for(const [j,h,path] of queue){
  if(visited.has(j))continue;visited.add(j);
  const now=stableLine(search,j),before=stableLine(old,h);
  for(const e of now.edges??[]){
   const previous=before.edges?.find(q=>sameEdge(q,e));
   if(previous){if(e.steps?.length)queue.push([e.target,previous.target,[...path,...e.steps]]);continue;}
   const proof=e.turnTailPlanValue,chain=proof?.cappedTaskBlueCurrency;
   assert(chain&&proof.deferredPublicity&&proof.kind==='blue-end-turn',JSON.stringify([j,h,e]));
   const prefix=before.edges.find(x=>x.resourcePlan?.goal.id==='data:blue:1'&&x.actionId===e.actionId);
   assert(prefix?.steps?.length===2);
   restore(origin);for(const id of path){const a=menu().find(q=>q.actionId===id);assert(a,id);submit(a);}
   const pre=save(),nativePrefix=[];
   const choose=(steps,test)=>{const a=menu().find(test);assert(a,JSON.stringify(menu().map(q=>[q.actionId,q.target])));steps.push(a);submit(a);return a;};
   for(const id of prefix.steps)choose(nativePrefix,q=>q.actionId===id);
   const branch=save(),paths={},n=old.lines[prefix.target];
   for(const kind of chain.pick?['end','public-pick']:['end']){
    restore(branch);const steps=[],end=n.edges.find(q=>q.actionId.startsWith('end_turn:')),pick=n.edges.find(q=>q.turnTailPlanValue?.bluePublicPick);
    assert(end);
    if(kind==='public-pick'){
     assert.equal(pick?.turnTailPlanValue?.bluePublicPick?.cardId,chain.pick.cardId);
     choose(steps,q=>q.family==='place_data');
     choose(steps,q=>q.target.target==='blueBonus'&&q.target.blueSlot===2);
     choose(steps,q=>q.actionId===chain.pick.cardActionId);
    }
    choose(steps,a=>a.actionId===end.actionId);
    choose(steps,a=>a.family==='accept_optional_effect'&&a.target.choiceId?.startsWith('skip:task:'+proof.deferredPublicity.cardId));
    const endState=save(),p=owner(get(endState));
    assert.equal(p.resources.publicity,10);assert(p.reservedCards.some(c=>c.id===proof.deferredPublicity.cardId));
    const fields=x=>[x.value,x.realization,x.preparationDebt].map(n=>n===0?0:n);
    const chosen=kind===chain.selected,legacy=kind==='end'?end:pick;
    assert.equal(steps.length,legacy.cost);
    if(chosen){assert.equal(nativePrefix.length+steps.length,e.cost);assert.deepEqual(fields(old.lines[legacy.target]),fields(search.lines[e.target]));}
    restore(pre,verify);for(const action of [...nativePrefix,...steps])submit(action,verify);
    assert.deepEqual(save(verify),endState);
    paths[kind]={steps,endState,rank:fields(old.lines[legacy.target])};
   }
   rows.push({beforeNode:h,candidateNode:j,proof,pre,nativePrefix,paths});
  }
 }
 assert.equal(rows.length,3);
 restore(origin);fs.writeFileSync(out,JSON.stringify({rootRestored:true,completeStateSessionRng:true,rows},null,2)+'\n',{flag:'wx'});
 console.log(rows.map(q=>[q.nativePrefix.length,q.proof.cappedTaskBlueCurrency.selected,Object.keys(q.paths)]));
}finally{c.dispose();verify.dispose();}

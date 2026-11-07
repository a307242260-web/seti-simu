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
   const proof=e.turnTailPlanValue,paid=proof?.paidPublicIncome,corner=proof?.scoredCornerBlueCurrency;
   assert(paid||corner,JSON.stringify([j,h,e]));
   const prior=before.edges.find(x=>x.actionId===e.actionId&&(paid?x.fixedCardPlan?.goal.id==='income:computer:4':x.resourcePlan?.goal.id==='data:blue:1'));
   assert.equal(prior?.steps?.length,paid?2:3);
   restore(origin);for(const id of path){const a=menu().find(q=>q.actionId===id);assert(a,id);submit(a);}
   const pre=save(),prefix=[];
   const choose=(steps,test)=>{const a=menu().find(test);assert(a,JSON.stringify(menu().map(q=>[q.actionId,q.target])));steps.push(a);submit(a);return a;};
   for(const id of prior.steps)choose(prefix,a=>a.actionId===id);
   const mid=save(),n=old.lines[prior.target],actions=n.edges;
   const match=(list,family)=>list.find(q=>q.actionId.startsWith(family+':'));
   const oldEnd=match(actions,'end_turn'),oldBlue=match(actions,'place_data'),oldClaim=match(actions,'complete_task');
   assert(oldEnd);
   if(paid)assert.equal(prefix.at(-1).target.cardInstanceId,paid.cardId);
   const task=paid?.follow?.task,ends=['end',...(paid?.blue?['blue']:[])],fields=x=>[x.value,x.realization,x.preparationDebt].map(n=>n===0?0:n);
   const blueChoice=(steps,spec)=>{
    choose(steps,a=>a.family==='place_data');choose(steps,a=>a.target.target==='blueBonus'&&a.target.blueSlot===2);
    assert.equal(choose(steps,a=>a.actionId===spec.cardActionId).target.cardInstanceId,spec.cardId);
    if(spec.singleCurrencyIncome){
     const ids=spec.continuingDataPlans;
     assert.equal(ids.length,1);
     choose(steps,a=>a.family==='place_data');choose(steps,a=>a.target.target==='computer');
     choose(steps,a=>a.family==='choose_card'&&a.target.cardInstanceId===ids[0].incomeCardId);
    }
   };
   const opt=(steps,take)=>choose(steps,a=>a.family==='accept_optional_effect'
      &&a.target.choiceId?.includes(task.cardId)&&Boolean(a.target.choiceId?.startsWith('skip:'))!==take);
   const paths={};
   for(const kind of task?['end-skip','claim-end','claim-blue','blue-claim']:ends){
    restore(mid);const steps=[];let legacy,logical=0;
    const row=paid?.follow?.alternatives.find(r=>r.id===kind);
    if(kind==='claim-end'||kind==='claim-blue'){
     const claim=choose(steps,a=>a.actionId===oldClaim.actionId);assert.equal(claim.target.cardInstanceId,task.cardId);
     const prev=old.lines[oldClaim.target].edges;
     if(kind==='claim-blue'){blueChoice(steps,row.blue);legacy=match(prev,'place_data');}
     else legacy=match(prev,'end_turn');
     logical=1+legacy.cost;
     choose(steps,a=>a.actionId===oldEnd.actionId);
    }else if(kind==='end-skip'){
     choose(steps,a=>a.actionId===oldEnd.actionId);const skip=opt(steps,false);
     legacy=old.lines[oldEnd.target].edges.find(a=>a.actionId===skip.actionId);
     logical=oldEnd.cost+legacy.cost;
    }else if(kind==='blue-claim'){
     blueChoice(steps,row.blue);choose(steps,a=>a.actionId===oldEnd.actionId);opt(steps,true);
     legacy=oldBlue;logical=legacy.cost;
    }else if(kind==='blue'){
     blueChoice(steps,paid.blue);choose(steps,a=>a.actionId===oldEnd.actionId);
     legacy=oldBlue;logical=legacy.cost;
     if(oldBlue.steps?.length){legacy=match(old.lines[oldBlue.target].edges,'end_turn');logical+=legacy.cost;}
    }else{choose(steps,a=>a.actionId===oldEnd.actionId);legacy=oldEnd;logical=legacy.cost;}
    assert.equal(steps.length,logical);
    const expected=fields(old.lines[legacy.target]),chosen=kind===(paid?.selected||'end');
    if(chosen){assert.equal(prefix.length+steps.length,e.cost);assert.deepEqual(expected,fields(search.lines[e.target]));}
    const endState=save(),q=owner(get(endState));
    if(task){
     const remains=q.reservedCards.some(c=>c.id===task.cardId);assert.equal(remains,kind==='end-skip');
     assert.equal(q.resources.publicity,kind==='end-skip'?7:10);
    }
    restore(pre,verify);for(const action of [...prefix,...steps])submit(action,verify);
    assert.deepEqual(save(verify),endState);
    paths[kind]={steps,endState,rank:expected};
   }
   rows.push({beforeNode:h,candidateNode:j,proof,pre,prefix,paths});
  }
 }
 assert.equal(rows.length,6);
 assert.deepEqual(rows.filter(x=>x.proof.paidPublicIncome).map(x=>x.beforeNode).sort((a,b)=>a-b),[85,92,119,131,143]);
 restore(origin);fs.writeFileSync(out,JSON.stringify({rootRestored:true,completeStateSessionRng:true,rootRank:rank(search),rows},null,2)+'\n',{flag:'wx'});
 console.log(rows.map(q=>[q.beforeNode,q.proof.paidPublicIncome?.selected??'scored-corner-currency',Object.keys(q.paths)]));
}finally{c.dispose();verify.dispose();}

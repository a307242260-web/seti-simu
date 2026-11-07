'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),z=require('node:zlib');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),values=require('../randomizer/game/ai/state-value');
const [fixture,baseline,candidate,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),f=read(fixture),seed=f.source.seed,seat=f.seatId;
const readRaw=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p))),old=readRaw(baseline),now=readRaw(candidate),source=f.compositionEnvelope;
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k.composition;}
const c=kernel(),v=kernel(),save=(k=c)=>k.lifecycle.save().envelope,state=(e=save())=>e.session?.session?.workingState||JSON.parse(e.committedState);
function restore(e,k=c){assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);}
function submit(x,k=c){
 const d=k.inspect().session?.decision,menu=d?.choices||k.inputPort.enumerateActions({});
 const a=menu.find(y=>y.actionId===(typeof x==='string'?x:x.actionId));assert(a,JSON.stringify([x,menu.map(a=>a.actionId)]));
 if(typeof x==='object')assert.deepEqual(a,x);
 const r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):
 a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));return a;
}
const key=x=>[x.value,x.realization||0,x.preparationDebt||0],rank=x=>x.roots.map(q=>[q.actionId,q.goal,q.value,q.realization,q.preparationDebt]);
const same=(a,b)=>a.actionId===b.actionId&&a.cost===b.cost&&a.resourcePlan?.id===b.resourcePlan?.id&&a.goalPlan?.id===b.goalPlan?.id
 &&JSON.stringify(a.steps)===JSON.stringify(b.steps);
const evaluate=values.createStateValueEvaluator(seat);
assert.deepEqual(rank(old),rank(now));assert.equal(now.diagnostics.nativeExecutions,221);
const rows=[],seen=new Set(),walk=[[0,0,[]]];
try{
 for(const [i,j,path] of walk){
  const pair=i+':'+j;if(seen.has(pair))continue;seen.add(pair);
  const A=old.lines[i],B=now.lines[j];
  for(const e of B.edges??[]){
   const previous=A.edges?.find(q=>same(q,e));
   if(previous){if(e.steps?.length)walk.push([previous.target,e.target,[...path,...e.steps]]);continue;}
   const p=e.turnTailPlanValue;assert(p&&['end-turn','blue-end-turn'].includes(p.kind));
   const original=A.edges.find(a=>a.actionId===e.actionId&&(p.kind==='end-turn'||a.resourcePlan?.goal.id==='data:blue:3'));
   assert(original?.steps?.length);
   const end=p.kind==='end-turn'?null:old.lines[original.target].edges.find(a=>a.actionId.startsWith('end_turn:'));
   const steps=[...original.steps,...(end?.steps||[])],prior=old.lines[end?.target??original.target],certified=now.lines[e.target];
   assert.equal(steps.length,e.cost);assert.deepEqual(key(prior),key(certified));
   restore(source);for(const id of path)submit(id);
   const pre=save(),before=state(pre);
   assert(before.turn.cardTurnEventBonuses.length>0&&before.turn.cardTurnEventBonuses.every(b=>b.eventType==='visitPlanet'&&b.ownerId===seat));
   const actual=steps.map(id=>submit(id)),post=save(),after=state(post);
   assert(!after.turn.cardTurnEventBonuses.some(b=>b.ownerId===seat));
   assert.notEqual(after.turn.currentPlayerId,seat);assert.equal(before.turn.roundNumber,after.turn.roundNumber);
   assert.deepEqual(before.pieces.rockets,after.pieces.rockets);
   assert.deepEqual(before.aliens,after.aliens);
   const view=c.projection({role:'player',playerId:seat,valueOnly:true}).state,details=evaluate.details(view);
   assert.deepEqual([details.value,-details.unrealizedPurposeValue||0,details.purposePreparationDebt||0],key(certified));
   restore(pre,v);for(const action of actual)submit(action,v);assert.deepEqual(save(v),post);
   rows.push({legacy:i,candidate:j,steps:actual,rank:key(certified),certificate:p,pre,post});
  }
 }
 assert.equal(rows.length,6);assert.deepEqual(rows.map(x=>x.steps.length).sort((a,b)=>a-b),[1,1,1,5,14,14]);
 restore(source);fs.writeFileSync(out,JSON.stringify({nativeStateSessionRngExact:true,rootRank:rank(now),rows},null,2)+'\n',{flag:'wx'});console.log(rows.map(r=>[r.legacy,r.steps.length,r.rank]));
}finally{c.dispose();v.dispose();}

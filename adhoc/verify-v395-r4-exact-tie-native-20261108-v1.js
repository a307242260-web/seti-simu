'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),z=require('node:zlib');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),values=require('../randomizer/game/ai/state-value');
const [fixture,baseline,candidate,out]=process.argv.slice(2),raw=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p))),old=raw(baseline),newer=raw(candidate),f=JSON.parse(fs.readFileSync(fixture)),seed=f.source.seed,seat=f.seatId;
function kernel(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k.composition;}
const c=kernel(),v=kernel(),save=k=>k.lifecycle.save().envelope,restore=(e,k=c)=>{assert(k.lifecycle.restore(e).ok);assert.deepEqual(save(k),e);};
const menu=k=>k.inspect().session?.decision?.choices||k.inputPort.enumerateActions({});
function submit(k,q){const a=menu(k).find(x=>typeof q==='function'?q(x):x.actionId===q);assert(a,JSON.stringify(menu(k).map(x=>[x.family,x.actionId,x.target])));
 const d=k.inspect().session?.decision,r=d?k.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?k.inputPort.submitQuickAction(a):k.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));return a;}
const inspect=k=>{const x=values.createStateValueEvaluator(seat).details(k.projection({role:'player',playerId:seat,valueOnly:true}).state);return [x.value,-x.unrealizedPurposeValue||0,x.purposePreparationDebt];};
const action=old.lines[0].edges.find(e=>e.resourcePlan?.goal.id==='tech:blue4:1'),newAction=newer.lines[0].edges.find(e=>e.resourcePlan?.goal.id==='tech:blue4:1');
const find=(n,goal)=>old.lines[n].edges.find(a=>a.resourcePlan?.goal.id===goal),income=find(action.target,'data:income:4'),prefix=find(income.target,'data:computer-prefix:6'),blue=find(prefix.target,'data:blue:1');
const closure=newer.lines[newAction.target].edges.find(a=>a.turnTailPlanValue?.exactFixedBlueTie),cert=newer.lines[closure.target],before=old.lines[action.target];
assert.deepEqual(newAction.steps,action.steps);
try{
 restore(f.compositionEnvelope);
 for(const a of action.steps)submit(c,a);
 const certificateSource=save(c),shared=[...income.steps,...prefix.steps];for(const a of shared)submit(c,a);
 const point=save(c),paths={};
 for(const id of ['end','first-blue','both-blue']){
  restore(point);const extra=[];
  const use=q=>{const a=submit(c,q);extra.push(a.actionId);return a;};
  if(id!=='end')for(const a of blue.steps)use(a);
  if(id==='both-blue'){
   use(a=>a.family==='card_corner'&&a.actionId==='card_corner:d5283853');
   use(a=>a.family==='place_data');
   use(a=>a.family==='choose_target'&&a.target.target==='blueBonus'&&a.target.blueSlot===3);
  }
  use(a=>a.family==='end_turn');
  use(a=>a.target.tileId==='d');
  const end=save(c),rank=inspect(c);
  restore(certificateSource,v);for(const a of [...shared,...extra])submit(v,a);assert.deepEqual(save(v),end);
  paths[id]={steps:[...shared,...extra],rank,end};
 }
 assert.equal(paths.end.steps.length,closure.cost);
 assert.deepEqual(paths.end.rank,[cert.value,cert.realization,cert.preparationDebt]);
 assert(paths.end.rank[0]>=paths['first-blue'].rank[0]&&paths.end.rank[0]>=paths['both-blue'].rank[0]);
 assert(paths.end.rank[1]>=paths['first-blue'].rank[1]&&paths.end.rank[1]>=paths['both-blue'].rank[1]);
 restore(f.compositionEnvelope);
 fs.writeFileSync(out,JSON.stringify({completeStateSessionRng:true,certificateSource,certificate:closure.turnTailPlanValue,old:[before.value,before.realization,before.preparationDebt],paths},null,2)+'\n',{flag:'wx'});
 console.log(Object.entries(paths).map(([k,r])=>[k,r.steps.length,r.rank]));
}finally{c.dispose();v.dispose();}

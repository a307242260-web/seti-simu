'use strict';
const fs=require('node:fs'),z=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createSearchAgent}=require('../randomizer/game/ai/search-agent');
const {evaluateStateValue}=require('../randomizer/game/ai/state-value');
const white='player-white', output=process.argv[2];
const input='reports/ai-foundation-20261113/r3-host-income/human405-r3-host-income-tail-20261113-v1.json.gz';
const {groups:[group]}=JSON.parse(z.gunzipSync(fs.readFileSync(input)));
const seed=JSON.parse(group.root.committedState).meta.seed;
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId||null,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
kernel.newGame({seed});
const c=kernel.composition,save=()=>c.lifecycle.save().envelope;
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function apply(id){
 const a=menu().find(x=>x.actionId===id),d=c.inspect().session?.decision;assert(a,id);
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitAction(a);
 assert(result.ok,JSON.stringify(result.failure));return a;
}
function quote(){
 const start=save(),port=createAnalysisPort({composition:c,seatId:white,maxCacheEntries:0});
 try{
  const {search:q}=createSearchAgent({seatId:white,analysisPort:port}).decide({seatId:white,legalActions:menu()});
  assert(q.complete&&q.unresolved.length===0&&q.diagnostics.nativeExecutions<=256&&q.rootAndSearchMilliseconds<=600);
  assert.deepEqual(save(),start);return q;
 }finally{port.close();}
}
function inspect(q,root){
 const rows=[];
 for(const r of q.roots.filter(r=>r.goal?.kind==='analyze'||r.goal?.kind==='scan-flow')){
  assert(c.lifecycle.restore(root).ok);
  const line=i=>q.lines[i],inputs=[];
  let edge=line(0).edges.find(e=>e.target===r.target&&e.actionId===r.actionId);
  while(edge){
   for(const id of edge.steps||[edge.actionId]) inputs.push(apply(id));
   const node=line(edge.target);
   edge=node.edges.find(e=>line(e.target).value===node.value&&line(e.target).distance+e.cost===node.distance);
   if(!edge){
    const end=save(),observation=c.projection({role:'player',playerId:white}).state;
    const value=evaluateStateValue(observation,white);
    rows.push({name:r.goal.id,searchValue:r.value,leaf:node.node,boundary:node.boundary,leafStatus:node.status,
      inputs,end,score:null,checkpoints:[],value,projectionDelta:r.value-value.total,
      resourcePlans:node.resourcePolicy?.plans.map(x=>[x.goal.id,x.goal.incomeCardId])});
   }
  }
 }
 return rows;
}
try{
 assert(c.lifecycle.restore(group.root).ok);
 const initial=quote();
 group.rows[0].inputs.slice(0,3).forEach(a=>assert.deepEqual(apply(a.actionId),a));
 const root=save(),q=quote(),rows=inspect(q,root);
 const view=u=>({actionId:u.actionId,value:u.value,n:u.diagnostics.nativeExecutions,ms:u.rootAndSearchMilliseconds});
 const result={source:'03fc54244',productionFileSha:crypto.createHash('sha256').update(fs.readFileSync(process.env.SETI_CASH_ANALYSIS_SOURCE||'randomizer/game/ai/resource-demand.js')).digest('hex'),initial:view(initial),atChoice:view(q),groups:[{name:'same native placement choice',root,rows}]};
 fs.writeFileSync(output,z.gzipSync(JSON.stringify(result)),{flag:'wx'});
 console.log(JSON.stringify({initial:result.initial,atChoice:result.atChoice,rows:rows.map(x=>[x.name,x.searchValue,x.value.total,x.projectionDelta,x.inputs.map(a=>a.summary)])}));
}finally{c.dispose();}

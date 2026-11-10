'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{gunzipSync}=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {buildRuleObservation}=require('../../app/rule-observation');
const {createSeededRandom}=require('../random'),{createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent');
const seat='player-white',envelope=JSON.parse(gunzipSync(fs.readFileSync(path.join(__dirname,'scan-income-after-free-move.fixture.json.gz'))));
const seed=JSON.parse(envelope.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId)});
k.newGame({seed});const c=k.composition;
assert(c.lifecycle.restore(envelope).ok);
const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
try{
 const legalActions=c.inputPort.enumerateActions({}),scan=legalActions.find(a=>a.family==='scan');
 const q=createSearchAgent({seatId:seat,analysisPort:port}).decide({seatId:seat,legalActions}).search;
 assert(q.complete&&!q.unresolved.length);
 assert(port.getDiagnostics().provedResearchSelections>0,
  'known third-round research choices reuse their native resolution');
 assert(port.getDiagnostics().provedPublicScanChoices>0,
  'root-visible Amiba does not block exact public scans before the native Purple 4 menu');
 const result=q.roots.find(a=>a.actionId===scan.actionId);
 const lines=new Map(q.lines.map(l=>[l.node,l])),post=lines.get(result.target);
 const scanEdge=lines.get(0).edges.find(e=>e.actionId===scan.actionId&&e.target===result.target);
 assert.equal(scanEdge.preparations.at(-1).reason,'fixed-movement-in-scan');
 assert.equal(post.boundary,'hidden_card_reveal');
 const plan=post.edges.find(e=>e.resourcePlan?.goal.kind==='income');
 assert(plan,'a completed free move must not block the already known data corner and electricity plan');
 assert.equal(plan.preparations.length,10);
 assert.equal(plan.resourcePlan.goal.incomeCardId,'alien-amiba-5-9');
 assert.equal(plan.goalStatus,'completed');
 assert.equal(lines.get(plan.target).value,142+5/6);
 assert.deepEqual(c.lifecycle.save().envelope,envelope);
 console.log('completed free scan movement preserves the known electricity plan across public refill');
 // With Purple 4 disabled, a second public scan is still a real choice.
 port.close();
 const state=JSON.parse(envelope.committedState),player=state.players.players.find(p=>p.id===seat);
 player.techState.disabledTiles.purple4=true;
 player.resources.additionalPublicScan=1;
 assert(c.lifecycle.restore({...envelope,committedState:JSON.stringify(state)}).ok);
 const before=c.lifecycle.save().envelope;
 const successors=[];
 for(const reuse of [false,true]){
  const p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   p.setResourcePlanning(reuse);p.setDecisionPlanning({scanPlanning:true});
   let node=p.openRoot();
   for(const select of [a=>a.family==='scan',a=>a.family==='choose_target'&&a.target.nebulaId,
     a=>a.family==='choose_card'&&a.target.publicSlotIndex!==undefined]){
    const action=node.legalActions.find(select);assert(action);
    node=p.expand(node,action.actionId);
   }
   assert(node.legalActions.some(a=>a.target.done));
   assert(node.legalActions.some(a=>a.target.publicSlotIndex!==undefined));
   assert.equal(p.getDiagnostics().provedPublicScanChoices,Number(reuse));
   successors.push([node.status,node.legalActions,node.observation]);
  }finally{p.close();}
 }
 assert.deepEqual(successors[1],successors[0]);
 assert.deepEqual(c.lifecycle.save().envelope,before);
}finally{port.close();c.dispose();}

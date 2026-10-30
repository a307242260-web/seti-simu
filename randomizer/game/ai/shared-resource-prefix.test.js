'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value');
const read=p=>fs.readFileSync(path.resolve(__dirname,'../../..',p)),fixture=JSON.parse(read('adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json'));
const reference=JSON.parse(zlib.gunzipSync(read('adhoc/ai-decision-corpus-20261023-v1/audit-case-105-resource-demand-final-20261027-v1.raw.json.gz')));
const edges=reference.lines.flatMap(l=>l.edges.filter(e=>e.resourcePlan?.goal.kind==='research_tech')),ids=edges.filter(e=>e.resourcePlan.goal.blueSlot==null||e.resourcePlan.goal.blueSlot===1).map(e=>e.resourcePlan.goal.id);
assert.equal(ids.length,8);
function opened(cache){const seed=fixture.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);return{c,p:createAnalysisPort({composition:c,seatId:fixture.seatId,maxCacheEntries:cache})};}
const evaluate=createStateValueEvaluator(fixture.seatId);
function focused(p,root){return{...p,resourceSpec(n){const s=p.resourceSpec(n);return n===root?{...s,retainedActionIds:[],plans:s.plans.filter(a=>ids.includes(a.goal.id))}:s;}};}
const observations=[];let rewardInputs,firstPlanInputs;
for(const cache of [0,256]){
 const {c,p}=opened(cache),before=c.lifecycle.save().envelope;p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);
 const root=p.openRoot(),plans=p.resourceSpec(root).plans,results=[];
 for(const id of ids){const r=p.expandResourcePlan(root,plans.find(p=>p.goal.id===id),()=>null);assert(r.complete);const extra=r.submissions-8;assert([0,1].includes(extra));results.push(r);assert.deepEqual(r.prefixes.slice(0,8).map(p=>p.action.actionId),edges.find(e=>e.resourcePlan.goal.id===id).steps);if(extra){const a=r.prefixes[8].action;assert.equal(a.family,'choose_card');assert(root.observation.publicState.board.publicCards.some(c=>c?.id===a.target.cardInstanceId));}assert.equal(evaluate(r.node.observation),reference.lines[edges.find(e=>e.resourcePlan.goal.id===id).target].value+extra);}
 observations.push(results.map(r=>r.node.observation));
 rewardInputs=results.reduce((n,r)=>n+r.submissions-8,0);firstPlanInputs=results[0].submissions;assert.equal(p.getDiagnostics().submissionCount,15+rewardInputs,'all eight tech kinds share seven preparation inputs; each guaranteed pick is one additional charged native input');
 const graph=p.getResourcePrefixGraph();assert.equal(graph.edges.length,15+rewardInputs);assert.equal(graph.nodes.length,16+rewardInputs);
 for(const r of results){assert.equal(r.sharedPath.length,r.submissions);assert.deepEqual(r.sharedPath.slice(0,7),results[0].sharedPath.slice(0,7));}assert.equal(new Set(results.map(r=>r.sharedPath[7])).size,8);
 assert.deepEqual(c.lifecycle.save().envelope,before);p.close();assert.equal(p.getDiagnostics().sharedPrefixEdges,0);
 // A restored/fresh search starts a new graph and computes the same physical results.
 assert(c.lifecycle.restore(before).ok);p.setResourcePlanning(true);const fresh=p.openRoot(),plan=p.resourceSpec(fresh).plans.find(p=>p.goal.id===ids[0]),cold=p.expandResourcePlan(fresh,plan,()=>null);assert.equal(p.getDiagnostics().submissionCount,firstPlanInputs);assert.deepEqual(cold.node.observation,results[0].node.observation);p.close();c.dispose();
}
assert.deepEqual(observations[0],observations[1]);
function run(budget,clock){const {c,p}=opened(0),before=c.lifecycle.save().envelope,root=p.openRoot();let port=focused(p,root);
 if(clock){const inner=port;port={...inner,expandResourcePlan(n,plan,check){return inner.expandResourcePlan(n,plan,(...args)=>{clock.time++;return check(...args);});}};}
 const r=searchDecision({port,root,evaluate,resourcePlanning:true,movementPlanning:true,cardPickPlanning:true,budget:{transitions:256,nodes:257,frontier:256,milliseconds:15000,...budget},...(clock?{now:()=>clock.time}:{})});assert.deepEqual(c.lifecycle.save().envelope,before);p.close();c.dispose();return r;}
// The technology preparation DAG is still shared, while its current known
// post-main window now continues after the reward. Do not force the old reveal
// to masquerade as a completed strategic window.
const complete=run({});assert(complete.complete,complete.stopReason);assert.equal(complete.diagnostics.transitions,complete.diagnostics.nativeExecutions);assert(complete.diagnostics.transitions>=15+rewardInputs);assert(complete.diagnostics.logicalResourceInputs>=64+rewardInputs);assert(complete.diagnostics.sharedResourceInputHits>=49);assert.equal(complete.lines[0].edges.length,8);assert(complete.lines[0].edges.every(e=>[8,9].includes(e.cost)&&e.sharedPath.length===e.cost));assert(complete.lines[0].edges.some(e=>e.actionId===complete.actionId&&complete.lines[e.target].value===complete.value&&complete.lines[e.target].distance+e.cost===complete.lines[0].distance));
for(const [reason,budget] of [['transition-budget',{transitions:14+rewardInputs}],['node-budget',{nodes:15+rewardInputs}],['frontier-budget',{frontier:1}]]){const r=run(budget);assert(!r.complete);assert.equal(r.stopReason,reason);assert.equal(r.actionId,null);assert.equal(r.planContinuation,null);assert(r.diagnostics.transitions<=14+rewardInputs);}
// A wholly reused preparation itself adds no native input or internal state,
// even when the caller admits only cached work. Strategic tails are separate.
{
 const {c,p}=opened(0);p.setResourcePlanning(true);const root=p.openRoot(),plan=p.resourceSpec(root).plans.find(a=>a.goal.id===ids[0]);
 const first=p.expandResourcePlan(root,plan,()=>null);assert(first.complete);const charged=p.getDiagnostics().submissionCount;
 const second=p.expandResourcePlan(root,{...plan,id:'same-path-other-purpose',goal:{...plan.goal,id:'same-path-other-purpose'}},(count,contexts,input,work)=>work.nextNewInput>0||work.additionalStates>0?'no-new-work':null);
 assert(second.complete,second.stopReason);assert.equal(second.newSubmissions,0);assert.equal(p.getDiagnostics().submissionCount,charged);assert.deepEqual(second.sharedPath,first.sharedPath);assert.equal(p.identity(second.node),p.identity(first.node));p.close();c.dispose();
}
const timed=run({milliseconds:20},{time:0});assert(!timed.complete);assert.equal(timed.stopReason,'watchdog');assert(timed.diagnostics.sharedResourceInputHits>0,'cache reuse still checks the global clock');assert.equal(timed.actionId,null);assert.equal(timed.planContinuation,null);
console.log(JSON.stringify({sharedResourcePrefixes:'passed',goals:8,preparationPrefix:7,guaranteedRewardInputs:rewardInputs,uniqueInputs:15+rewardInputs,states:16+rewardInputs,sharedInputs:49,nativeRootAndRecovery:true}));

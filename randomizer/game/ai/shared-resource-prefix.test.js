'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),{searchDecision}=require('./decision-search'),{createStateValueEvaluator}=require('./state-value');
const read=p=>fs.readFileSync(path.resolve(__dirname,'../../..',p)),fixture=JSON.parse(read('adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json'));
const reference=JSON.parse(zlib.gunzipSync(read('adhoc/ai-decision-corpus-20261023-v1/audit-case-105-resource-demand-final-20261027-v1.raw.json.gz')));
const edges=reference.lines.flatMap(l=>l.edges.filter(e=>e.resourcePlan?.goal.kind==='research_tech')),ids=edges.map(e=>e.resourcePlan.goal.id);
assert.equal(ids.length,20);
function opened(cache){const seed=fixture.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);return{c,p:createAnalysisPort({composition:c,seatId:fixture.seatId,maxCacheEntries:cache})};}
const evaluate=createStateValueEvaluator(fixture.seatId);
function focused(p,root){return{...p,resourceSpec(n){const s=p.resourceSpec(n);return n===root?{...s,retainedActionIds:[],plans:s.plans.filter(a=>ids.includes(a.goal.id))}:s;}};}
const observations=[];
for(const cache of [0,256]){
 const {c,p}=opened(cache),before=c.lifecycle.save().envelope;p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);
 const root=p.openRoot(),plans=p.resourceSpec(root).plans,results=[];
 for(const id of ids){const r=p.expandResourcePlan(root,plans.find(p=>p.goal.id===id),()=>null);assert(r.complete);assert.equal(r.submissions,8);results.push(r);assert.deepEqual(r.prefixes.map(p=>p.action.actionId),edges.find(e=>e.resourcePlan.goal.id===id).steps);assert.equal(evaluate(r.node.observation),reference.lines[edges.find(e=>e.resourcePlan.goal.id===id).target].value);}
 observations.push(results.map(r=>r.node.observation));
 assert.equal(p.getDiagnostics().submissionCount,27,'all 20 goals share seven actual native inputs even when the disposable expansion cache is off');
 const graph=p.getResourcePrefixGraph();assert.equal(graph.edges.length,27);assert.equal(graph.nodes.length,28);
 for(const r of results){assert.equal(r.sharedPath.length,8);assert.deepEqual(r.sharedPath.slice(0,7),results[0].sharedPath.slice(0,7));}assert.equal(new Set(results.map(r=>r.sharedPath[7])).size,20);
 assert.deepEqual(c.lifecycle.save().envelope,before);p.close();assert.equal(p.getDiagnostics().sharedPrefixEdges,0);
 // A restored/fresh search starts a new graph and computes the same physical results.
 assert(c.lifecycle.restore(before).ok);p.setResourcePlanning(true);const fresh=p.openRoot(),plan=p.resourceSpec(fresh).plans.find(p=>p.goal.id===ids[0]),cold=p.expandResourcePlan(fresh,plan,()=>null);assert.equal(p.getDiagnostics().submissionCount,8);assert.deepEqual(cold.node.observation,results[0].node.observation);p.close();c.dispose();
}
assert.deepEqual(observations[0],observations[1]);
function run(budget,clock){const {c,p}=opened(0),before=c.lifecycle.save().envelope,root=p.openRoot();let port=focused(p,root);
 if(clock){const inner=port;port={...inner,expandResourcePlan(n,plan,check){return inner.expandResourcePlan(n,plan,(...args)=>{clock.time++;return check(...args);});}};}
 const r=searchDecision({port,root,evaluate,resourcePlanning:true,movementPlanning:true,cardPickPlanning:true,budget:{transitions:256,nodes:257,frontier:256,milliseconds:15000,...budget},...(clock?{now:()=>clock.time}:{})});assert.deepEqual(c.lifecycle.save().envelope,before);p.close();c.dispose();return r;}
const complete=run({transitions:27,nodes:28});assert(complete.complete,complete.stopReason);assert.equal(complete.diagnostics.transitions,27);assert.equal(complete.diagnostics.nativeExecutions,27);assert.equal(complete.diagnostics.logicalResourceInputs,160);assert.equal(complete.diagnostics.sharedResourceInputHits,133);assert.equal(complete.diagnostics.nodes,28);assert.equal(complete.lines[0].edges.length,20);assert(complete.lines[0].edges.every(e=>e.cost===8&&e.sharedPath.length===8));assert.equal(complete.lines[0].distance,8);
for(const [reason,budget] of [['transition-budget',{transitions:26}],['node-budget',{nodes:27}],['frontier-budget',{frontier:1}]]){const r=run(budget);assert(!r.complete);assert.equal(r.stopReason,reason);assert.equal(r.actionId,null);assert.equal(r.planContinuation,null);assert(r.diagnostics.transitions<=26);}
// A wholly reused second purpose must remain admissible at exactly exhausted input/state limits.
{
 const {c,p}=opened(0),root=p.openRoot();const port={...p,resourceSpec(n){const s=p.resourceSpec(n);if(n!==root)return s;const plan=s.plans.find(a=>a.goal.id===ids[0]);return{...s,retainedActionIds:[],plans:[plan,{...plan,id:'same-path-other-purpose',goal:{...plan.goal,id:'same-path-other-purpose'}}]};}};
 const r=searchDecision({port,root,evaluate,resourcePlanning:true,budget:{transitions:8,nodes:9,frontier:8,milliseconds:15000}});assert(r.complete,r.stopReason);assert.equal(r.diagnostics.transitions,8);assert.equal(r.diagnostics.nodes,9);assert.equal(r.diagnostics.logicalResourceInputs,16);assert.equal(r.diagnostics.sharedResourceInputHits,8);assert.equal(r.lines[0].edges.length,2);p.close();c.dispose();
}
const timed=run({milliseconds:20},{time:0});assert(!timed.complete);assert.equal(timed.stopReason,'watchdog');assert(timed.diagnostics.sharedResourceInputHits>0,'cache reuse still checks the global clock');assert.equal(timed.actionId,null);assert.equal(timed.planContinuation,null);
console.log(JSON.stringify({sharedResourcePrefixes:'passed',goals:20,pathLength:8,uniqueInputs:27,states:28,sharedInputs:133,nativeRootAndRecovery:true}));

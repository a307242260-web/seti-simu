"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),path=require("node:path");
const {execFileSync}=require("node:child_process");
const root=path.resolve(process.argv[2]||path.join(__dirname,".."));
const commit=execFileSync("git",["rev-parse","--short","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const output=`adhoc/income50-score-${commit}-20260913.json`;
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const {createSimulationEnv}=require(root+"/randomizer/app/simulation-env");
const evaluator=require(root+"/randomizer/game/ai/expected-score-evaluator");
const input=require("./income50-input-20260913.json"),env=createSimulationEnv();
try{
  input.checkpoint.config.traceCounterfactualGoalClusters=true;
  env.loadCheckpoint(input.checkpoint);assert.deepEqual(env.legalActions(),input.legalActions);
  console.log(`[第50步评分归因] ${commit} · 原4096/256预算 · 开始`);
  const r=env.runHeuristicPolicyDecision();assert.equal(r.ok,true);
  const roots=(r.actionOutcomes||[]).map(o=>({actionId:o.actionId,
    evaluation:evaluator.evaluateAction({seatId:"player-blue",actionOutcomes:[o]},input.legalActions.find(a=>a.actionId===o.actionId)),
    leaves:o.actionId===input.expectedAction.actionId?(o.leaves||[]).map(l=>({leafId:l.leafId,status:l.status,
      terminalReason:l.terminalReason,actionChain:l.actionChain,actions:(l.planSteps||[]).map(s=>s.action),
      evaluation:evaluator.evaluateAction({seatId:"player-blue",actionOutcomes:[{...o,leaves:[l]}]},input.expectedAction)})):[]}));
  const diagnostics=env.getCounterfactualDiagnostics();assert.deepEqual(diagnostics.failedNodeCountByCode,{});
  fs.writeFileSync(output,JSON.stringify({commit,actionId:r.actionId,plan:r.plan,roots,diagnostics},null,2)+"\n",{flag:"wx"});
  const e=roots.find(o=>o.actionId===r.actionId).evaluation;
  console.log(`[第50步归因完成] ${JSON.stringify({output,action:r.actionId,score:e.score,sortKey:e.sortKey,leaf:e.selectedLeafId,nodes:diagnostics.executedNodeCount})}`);
}finally{env.dispose();}

"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),path=require("node:path");
const {execFileSync}=require("node:child_process");
const root=path.resolve(process.argv[2]||path.join(__dirname,".."));
const commit=execFileSync("git",["rev-parse","--short","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const output=`adhoc/income37-score-${commit}-20260913.json`;
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const {createSimulationEnv}=require(root+"/randomizer/app/simulation-env");
const evaluator=require(root+"/randomizer/game/ai/expected-score-evaluator");
const input=require("./budget37-input-20260913.json"),env=createSimulationEnv();
try{
  env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(),input.legalActions);
  console.log(`[评分归因单决策] ${commit} · 第37步 · 原预算，不作为重复完整实验`);
  const result=env.runHeuristicPolicyDecision();assert.equal(result.ok,true);
  const roots=(result.actionOutcomes||[]).map(o=>{
    const action=input.legalActions.find(a=>a.actionId===o.actionId);
    const e=evaluator.evaluateAction({seatId:"player-green",actionOutcomes:[o]},action);
    return {actionId:o.actionId,evaluation:e,leafCount:o.leaves?.length};
  });
  const diagnostics=env.getCounterfactualDiagnostics();
  assert.deepEqual(diagnostics.failedNodeCountByCode,{});
  const winning=roots.find(r=>r.actionId===result.actionId);
  fs.writeFileSync(output,JSON.stringify({commit,actionId:result.actionId,plan:result.plan,roots,
    diagnostics:{executedNodeCount:diagnostics.executedNodeCount,totalMilliseconds:diagnostics.totalMilliseconds,
      executedNodeCountByFamily:diagnostics.executedNodeCountByFamily}},null,2)+"\n",{flag:"wx"});
  console.log(`[评分归因完成] ${JSON.stringify({output,actionId:result.actionId,evaluation:winning.evaluation})}`);
}finally{env.dispose();}

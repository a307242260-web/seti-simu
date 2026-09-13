"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const commit=execFileSync("git",["rev-parse","--short","HEAD"],{encoding:"utf8"}).trim();
const output=`adhoc/secondary-probe154-${commit}-20260913.json`;
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const input=JSON.parse(fs.readFileSync("adhoc/budget154-input-20260913.json"));
const baseline=JSON.parse(fs.readFileSync("adhoc/budget154-trace-ea9efe16-20260913.json"));
const boundary=JSON.parse(fs.readFileSync("adhoc/budget154-secondary-move-20260913.json"));
const expectedIds=[input.expectedAction.actionId,...baseline.plan.steps.map(s=>s.actionId)];
const selected=evaluator.selectSecondaryAgentSuccessors({focalSeatId:"player-green",branchObservation:boundary.observation,
  legalSuccessors:boundary.variants.map(v=>v.action),routeTargetId:boundary.boundaryStep.routeTargetId,routePlanId:boundary.boundaryStep.routePlanId});
assert.equal(selected.length,2,"真实边界须保留准备1+结束1");
assert(selected.some(a=>a.target.skip===true));
const env=createSimulationEnv();
const record={commit,scope:"相同154根单决策；验证真实边界收敛和旧最佳完整链仍为真实叶，不重跑AI全盘。",boundaryBefore:boundary.selected.map(a=>a.actionId),boundaryAfter:selected.map(a=>a.actionId)};
try{
  input.checkpoint.config.traceCounterfactualGoalClusters=true;
  env.loadCheckpoint(input.checkpoint);
  console.log(`[单决策] ${commit} · 第154步 · 第二探测器贪心 · 原预算4096/256`);
  const start=performance.now();
  const result=env.runHeuristicPolicyDecision();
  record.wallMs=performance.now()-start;
  assert.equal(result.ok,true);
  record.actionId=result.actionId;
  record.policyDecision=result.policyDecision;
  record.searches=result.searches;
  record.diagnostics=env.getCounterfactualDiagnostics();
  record.plan=result.plan;
  record.outcomes=(result.actionOutcomes||[]).map(outcome=>({actionId:outcome.actionId,status:outcome.status,
    leaves:(outcome.leaves||[]).map(leaf=>({actionChain:leaf.actionChain,planSteps:(leaf.planSteps||[]).map(s=>s.action.actionId)}))}));
  const outcome=result.actionOutcomes.find(o=>o.actionId===input.expectedAction.actionId);
  record.oldBestLeaf=(outcome?.leaves||[]).findIndex(leaf=>JSON.stringify((leaf.planSteps||[]).map(s=>s.action.actionId))===JSON.stringify(expectedIds));
  record.expectedIds=expectedIds;
  if(record.oldBestLeaf>=0){
    const action=input.expectedAction;
    record.oldBestRetainedValue=evaluator.evaluateAction({seatId:"player-green",actionOutcomes:[{...outcome,leaves:[outcome.leaves[record.oldBestLeaf]]}]},action);
    record.currentRootValue=evaluator.evaluateAction({seatId:"player-green",actionOutcomes:[outcome]},action);
  }
}catch(error){record.error={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;}
finally{env.dispose();fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify({output,wallMs:record.wallMs,actionId:record.actionId,oldBestLeaf:record.oldBestLeaf,error:record.error}));}

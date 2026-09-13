"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const commit=execFileSync("git",["rev-parse","--short","HEAD"],{encoding:"utf8"}).trim();
const output=`adhoc/scan-cost135-${commit}-20260913.json`;
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const input=JSON.parse(fs.readFileSync("adhoc/scan-cost135-input-20260913.json"));
const env=createSimulationEnv(),record={commit,source:"adhoc/scan-cost135-input-20260913.json"};
try{
  input.checkpoint.config.traceCounterfactualGoalClusters=true;
  env.loadCheckpoint(input.checkpoint);
  const actions=env.legalActions();
  const start=performance.now();
  console.log(`[共同135根诊断] ${commit} · 不重跑完整局 · 保存完整叶评分与计划`);
  const result=env.runHeuristicPolicyDecision();
  record.wallMs=performance.now()-start;
  assert.equal(result.ok,true);
  record.actionId=result.actionId;record.plan=result.plan;record.diagnostics=env.getCounterfactualDiagnostics();
  record.roots=(result.actionOutcomes||[]).filter(o=>/^(scan|launch):/.test(o.actionId)).map(o=>({actionId:o.actionId,status:o.status,
    evaluation:evaluator.evaluateAction({seatId:"player-green",actionOutcomes:[o]},actions.find(a=>a.actionId===o.actionId)),
    leaves:(o.leaves||[]).map(l=>({actionChain:l.actionChain,terminalReason:l.terminalReason,
      planSteps:(l.planSteps||[]).map(s=>({action:s.action,routeTargetId:s.routeTargetId,routePlanId:s.routePlanId})),
      evaluation:evaluator.evaluateAction({seatId:"player-green",actionOutcomes:[{...o,leaves:[l]}]},actions.find(a=>a.actionId===o.actionId))}))}));
}catch(error){record.error={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;}
finally{env.dispose();fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify({output,actionId:record.actionId,wallMs:record.wallMs,error:record.error}));}

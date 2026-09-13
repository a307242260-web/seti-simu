"use strict";
const fs=require("node:fs"), assert=require("node:assert/strict"), {execFileSync}=require("node:child_process");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const commit=execFileSync("git",["rev-parse","--short","HEAD"],{encoding:"utf8"}).trim();
const output=`adhoc/scan-free-cost485-${commit}-20260913.json`;
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const input=JSON.parse(fs.readFileSync("adhoc/budget485-input-20260913.json"));
const baseline=JSON.parse(fs.readFileSync("adhoc/budget485-trace-093a25c6-20260913.json"));
const env=createSimulationEnv();
const record={commit,source:"adhoc/budget485-input-20260913.json",scope:"只修正紫4免费移动额度目录，同485共同输入；不改选择与预算。"};
try {
  input.checkpoint.config.traceCounterfactualGoalClusters=true;
  env.loadCheckpoint(input.checkpoint);
  console.log(`[单决策] ${commit} · 第485步 · 扫描免费额度修正 · 4096节点/256队列`);
  const start=performance.now(), result=env.runHeuristicPolicyDecision();
  record.wallMs=performance.now()-start;
  record.ok=result.ok;
  record.actionId=result.actionId;
  record.plan=result.plan;
  record.policyDecision=result.policyDecision;
  record.diagnostics=env.getCounterfactualDiagnostics();
  record.leaves=(result.actionOutcomes||[]).flatMap(o=>(o.leaves||[]).map(l=>({rootActionId:o.actionId,actionChain:l.actionChain})));
  record.sameActions=JSON.stringify(result.plan?.steps.map(s=>s.actionKey))===JSON.stringify(baseline.plan.steps.map(s=>s.actionKey));
  assert.equal(result.ok,true);
  assert(record.wallMs<30000,"单决策30秒门槛");
  assert.deepEqual(record.diagnostics.failedNodeCountByCode,{});
} catch(error){record.error={message:error.message,stack:error.stack}; console.error(error);process.exitCode=1;}
finally{env.dispose();fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify({output,wallMs:record.wallMs,actionId:record.actionId,sameActions:record.sameActions,error:record.error}));}

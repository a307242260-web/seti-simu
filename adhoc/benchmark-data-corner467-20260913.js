"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const commit=execFileSync("git",["rev-parse","--short","HEAD"],{encoding:"utf8"}).trim();
const output=`adhoc/data-corner467-${commit}-20260913.json`;
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const input=JSON.parse(fs.readFileSync("adhoc/budget467-input-20260913.json"));
const baseline=JSON.parse(fs.readFileSync("adhoc/budget467-trace-74c8bb1b-20260913.json"));
const env=createSimulationEnv(),record={commit,source:"adhoc/budget467-input-20260913.json"};
const stable=x=>x&&typeof x==="object"?Array.isArray(x)?x.map(stable):Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const actionKey=a=>JSON.stringify(stable({family:a.family,payload:a.payload,target:a.target}));
const expected=baseline.plan.steps.map(s=>s.actionKey);
try{
  input.checkpoint.config.traceCounterfactualGoalClusters=true;env.loadCheckpoint(input.checkpoint);
  assert.deepEqual(env.legalActions(),input.legalActions);
  console.log(`[单决策] ${commit} · 第467步 · 数据角标同收益贪心 · 4096节点/256队列`);
  const start=performance.now(),r=env.runHeuristicPolicyDecision();record.wallMs=performance.now()-start;
  assert.equal(r.ok,true);record.actionId=r.actionId;record.plan=r.plan;record.diagnostics=env.getCounterfactualDiagnostics();
  record.sameWinningActions=JSON.stringify(r.plan?.steps.map(s=>s.actionKey))===JSON.stringify(expected);
  record.leaves=(r.actionOutcomes||[]).flatMap(o=>(o.leaves||[]).map(l=>{
    let steps=(l.planSteps||[]).map(s=>s.action);
    if(steps[0]?.actionId===o.actionId)steps=steps.slice(1);
    return {root:o.actionId,terminalReason:l.terminalReason,chain:l.actionChain,
      oldPlanMatch:o.actionId===baseline.actionId&&JSON.stringify(steps.map(actionKey))===JSON.stringify(expected)};
  }));
  record.oldPlanRetained=record.leaves.some(l=>l.oldPlanMatch&&l.terminalReason!=="route-unreachable");
  assert(record.wallMs<30000,"单决策30秒门槛");assert.deepEqual(record.diagnostics.failedNodeCountByCode,{});
}catch(error){record.error={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;}
finally{env.dispose();fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify({output,wallMs:record.wallMs,actionId:record.actionId,sameWinningActions:record.sameWinningActions,oldPlanRetained:record.oldPlanRetained,error:record.error}));}

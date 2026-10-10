"use strict";
const fs=require("node:fs");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const output="adhoc/budget482-ladder-check-20260913.json";
if(fs.existsSync(output)){console.log("[skip]");process.exit(0);}
const input=JSON.parse(fs.readFileSync("adhoc/budget482-input-20260913.json"));
const env=createSimulationEnv();
const rec={source:"adhoc/budget482-input-20260913.json",step:482};
try{
  input.checkpoint.config.traceCounterfactualGoalClusters=false;
  env.loadCheckpoint(input.checkpoint);
  const t=performance.now();
  const r=env.runHeuristicPolicyDecision();
  rec.wallMs=performance.now()-t; rec.actionId=r.actionId;
  rec.planSteps=(r.plan?.steps||[]).length;
  const dg=env.getCounterfactualDiagnostics();
  rec.executedNodeCount=dg.executedNodeCount;
  rec.executionTruncated=dg.budgetLimits.execution.truncated;
  rec.frontierTrimCount=dg.budgetLimits.frontier.trimCount;
  rec.remainingFrontierNodeCount=dg.remainingFrontierNodeCount;
  rec.quotaTierReached=dg.quotaTierReached;
  rec.chainPruned=dg.macroChainCapPrunedCount;
  rec.entrySkipped=dg.targetEntryCapSkippedCount;
  rec.targetPruned=dg.targetBeamPrunedOriginCount;
  rec.failed=dg.failedNodeCountByCode;
}catch(e){rec.error={message:e.message,stack:e.stack};console.error(e);process.exitCode=1;}
finally{env.dispose();fs.writeFileSync(output,JSON.stringify(rec,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({wallMs:Math.round(rec.wallMs||0),action:rec.actionId,planSteps:rec.planSteps,nodes:rec.executedNodeCount,execTrunc:rec.executionTruncated,trim:rec.frontierTrimCount,left:rec.remainingFrontierNodeCount,tier:rec.quotaTierReached,failed:rec.failed}));}

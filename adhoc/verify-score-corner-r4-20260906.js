"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/score-corner-r4-real-20260906.json";
if(fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const report = {scope:"新实现工作树在真实绿方PASS前的一次决策及计划后续；非全盘"};
  const env = createSimulationEnv();
  try {
    const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/r4-green-before-pass-20260906.json"));
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.ms = performance.now()-start;
    assert.equal(decision.ok,true);
    report.action = decision.policyDecision.actionId;
    report.outcome = decision.actionOutcomes.find(o=>o.actionId===report.action);
    report.plan = decision.plan;
    report.diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(report.action,JSON.parse(fs.readFileSync("reports/iteration/r4-green-corner-20260906.json")).action.actionId);
    report.next = env.runHeuristicPolicyDecision();
    report.after = env.observe();
    assert.equal(report.after.publicState.players.find(p=>p.playerId==="player-green").score,26);
    assert.notEqual(report.after.decision.decisionType,"conditional_choice");
    report.passed = true;
  } catch(error) {
    report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;
  } finally {
    env.dispose();fs.writeFileSync(output,JSON.stringify(report));
    console.log(JSON.stringify({output,passed:report.passed,ms:report.ms,action:report.action,
      leaves:report.outcome?.leaves.length,nodes:report.diagnostics?.executedNodeCount,error:report.error},null,2));
  }
}

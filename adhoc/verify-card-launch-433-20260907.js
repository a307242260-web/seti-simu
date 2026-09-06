"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), v8 = require("node:v8"), zlib = require("node:zlib");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/card-launch-433-verification-20260907.json";
if (fs.existsSync(output)) console.log(`已有验证：${output}`);
else {
  const env = createSimulationEnv();
  const report = { scope: "满额卡牌发射修复后的真实433单决策，保存完整结果；完整计划由replay-card-launch脚本按fork契约验证" };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/amiba-overflow-before-step-433-20260906.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const start = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(result.ok, true);
    report.diagnostics = env.getCounterfactualDiagnostics();
    report.resultPath = "reports/iteration/card-launch-433-result-20260907.v8.gz";
    fs.writeFileSync(report.resultPath, zlib.gzipSync(v8.serialize(result)));
    assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
    assert.equal(report.diagnostics.maxExecutionNodes, 4096);
    report.actionId = result.policyDecision.actionId;
    report.plan = result.plan;
    // 协调器已正式提交根动作；跨回合计划另在正式fork中重放。
    report.rootSubmitted = true;
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      nodes: report.diagnostics?.executedNodeCount, submissions: report.diagnostics?.successfulInputSubmissionCount,
      failures: report.diagnostics?.failedNodeCountByCode,
      actionId: report.actionId, error: report.error }, null, 2));
  }
}

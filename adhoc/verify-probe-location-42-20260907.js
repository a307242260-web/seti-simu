"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = process.argv[2] || "reports/iteration/probe-location-decision-42-20260907.json";
if (fs.existsSync(output)) console.log(`已有验证：${output}`);
else {
  const env = createSimulationEnv();
  const report = { scope: "位置读取修复后真实42单次冷决策及完整计划正式fork重放；不声称移动需求剪枝完成", steps: [] };
  let fork, pendingAdvance = false;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps;
    env.loadCheckpoint(cp);
    fork = env.createCounterfactualFork().composition;
    const start = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    report.diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(result.ok, true, JSON.stringify(result.error));
    report.actionId = result.policyDecision.actionId;
    report.plan = result.plan;
    assert.equal(typeof report.actionId, "string");
    assert.ok(report.plan && Array.isArray(report.plan.steps), "真实42应有完整优胜计划");
    assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
    assert.equal(report.diagnostics.maxExecutionNodes, 4096);
    assert.ok(report.wallMs < 30000, "真实单决策须在既有30秒期限内完成调用");
    for (const actionId of [report.actionId, ...report.plan.steps.map(s => s.actionId)]) {
      assert.equal(typeof actionId, "string", "计划动作不可缺失");
      const inspection = fork.inspect();
      const legal = inspection.phase === "awaiting_input"
        ? inspection.session.decision.choices : fork.inputPort.enumerateActions();
      const action = legal.find(a => a.actionId === actionId);
      assert.ok(action, `搜索计划动作必须正式可执行：${actionId}`);
      const submitted = action.phase === "conditional"
        ? fork.inputPort.submitDecision({ decisionId: inspection.session.decision.decisionId,
          decisionVersion: inspection.session.decision.decisionVersion,
          ownerId: inspection.session.decision.ownerId, choice: action }, { skipProjection: true })
        : fork.inputPort.submitAction(action, { skipProjection: true });
      report.steps.push({ action, ok: submitted.ok });
      assert.equal(submitted.ok, true, JSON.stringify(submitted));
      if (action.family === "end_turn") pendingAdvance = true;
      if (pendingAdvance) {
        const advanced = fork.counterfactualPort.advanceFocalPlanningTurn(result.policyDecision.seatId);
        if (advanced.ok) pendingAdvance = false;
        else assert.equal(advanced.code, "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING", JSON.stringify(advanced));
      }
    }
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      nodes: report.diagnostics?.executedNodeCount, submissions: report.diagnostics?.successfulInputSubmissionCount,
      failures: report.diagnostics?.failedNodeCountByCode, actionId: report.actionId,
      replayedInputs: report.steps.length, error: report.error }, null, 2));
  }
}

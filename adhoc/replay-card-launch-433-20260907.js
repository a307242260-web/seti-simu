"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), v8 = require("node:v8"), zlib = require("node:zlib");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/card-launch-433-fork-replay-v2-20260907.json";
if (fs.existsSync(output)) console.log(`已有重放：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "只读既有433搜索结果，在正式fork按原单席位规划契约重放完整链，不运行AI或模拟对手", steps: [] };
  let fork, pendingAdvance = false;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/amiba-overflow-before-step-433-20260906.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    fork = env.createCounterfactualFork().composition;
    const result = v8.deserialize(zlib.gunzipSync(fs.readFileSync("reports/iteration/card-launch-433-result-20260907.v8.gz")));
    for (const actionId of [result.policyDecision.actionId, ...(result.plan?.steps || []).map(s => s.actionId)]) {
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
    console.log(JSON.stringify({ output, passed: report.passed, steps: report.steps.length, error: report.error }));
  }
}

"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/r3s1-stale-scan-execution-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/r3s1-green-plan-origin-20260906.json";
  const source = JSON.parse(fs.readFileSync(sourcePath));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), sourcePath,
    scope: "在真实第74步checkpoint按重建旧计划继续正式提交，验证未失效的具体后果；无AI搜索，不作为新固定盘面全盘实验。", steps: [] };
  try {
    assert.equal(source.stoppedAt, 73);
    let plan = source.plan;
    for (const boundary of source.boundaries.slice(0, -1)) {
      assert.equal(boundary.reuse.hit, true);
      plan = plans.advancePlan(plan);
    }
    env.loadCheckpoint(source.stopCheckpoint);
    for (let i = 0; i < plan.steps.length; i += 1) {
      const expected = plan.steps[i];
      const actions = env.legalActions();
      const action = actions.find((a) => a.actionId === expected.actionId);
      const row = { offset: i, expected, action: action || null };
      report.steps.push(row);
      if (!action) {
        report.firstIllegal = { offset: i, expected, legalActions: actions };
        break;
      }
      if (action.family === "scan") {
        report.beforeScan = env.createCheckpoint();
        report.scanSource = env.observe().sectorWinRequirements.standardScanEarthSource;
      }
      assert.equal(env.step(action).ok, true);
      if (action.family === "scan") report.afterScan = env.createCheckpoint();
    }
    assert.ok(report.beforeScan, "旧计划必须实际走到扫描");
    assert.ok(report.firstIllegal, "验证旧计划的下一步扫描选择已不合法");
    assert.equal(JSON.parse(report.firstIllegal.expected.actionKey).target.nebulaId, "sector-1-a");
    assert.deepEqual(report.firstIllegal.legalActions.map((a) => a.target.nebulaId), ["sector-4-a"]);
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, steps: report.steps.map((s) => s.action?.family || s.expected.actionId),
      scanSource: report.scanSource, firstIllegal: report.firstIllegal, error: report.error }));
  }
}

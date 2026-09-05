"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/r3s1-green-boundary-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const recordPath = "reports/research/c3eebca2.4fba7beb.quick-200.json";
  const record = JSON.parse(fs.readFileSync(recordPath));
  const raw = fs.readFileSync(record.savePath);
  const save = JSON.parse(raw);
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), recordPath, savePath: record.savePath,
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    scope: "已存动作重放至第74步之前；一次冷决策并核对后续逐步事实。不声称还原此前未保存的协调器计划来源。", boundaries: [] };
  try {
    env.reset({ seed: record.seed, activePlayerCount: record.activePlayerCount,
      aiDifficulty: record.aiDifficulty, policyVersion: record.policyVersion, ...record.flags });
    for (let index = 0; index < 73; index += 1) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find((a) => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.beforeRoot = env.createCheckpoint();
    const start = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(decision.ok, true);
    report.chosen = decision.policyDecision.actionId;
    report.matchesRecordedRoot = report.chosen === save.replaySteps[73].action.actionId;
    report.plan = decision.plan;
    report.outcomes = decision.actionOutcomes;
    assert.ok(report.wallMs <= 10000, "单决策超过10秒，停止进一步搜索");
    if (report.matchesRecordedRoot) {
      let plan = decision.plan;
      for (let index = 74; index <= 79; index += 1) {
        const observation = env.observe();
        const actions = env.legalActions();
        const reuse = plans.planReuseCheck(plan, observation, actions, { sameTurn: true });
        report.boundaries.push({ index, source: observation.sectorWinRequirements?.standardScanEarthSource,
          nextStep: plan?.steps?.[0], reuse: { hit: reuse.hit, reason: reuse.reason, changed: reuse.changed },
          recorded: save.replaySteps[index].action });
        if (index === 79) { report.beforeDivergence = env.createCheckpoint(); break; }
        const action = actions.find((a) => a.actionId === save.replaySteps[index].action.actionId);
        assert.deepEqual(action, save.replaySteps[index].action);
        assert.equal(env.step(action).ok, true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, save.replaySteps[index].after);
        if (reuse.hit && reuse.action.actionId === action.actionId) plan = reuse.nextPlan;
        else { report.stoppedAt = index; break; }
      }
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, ms: report.wallMs, chosen: report.chosen,
      matchesRecordedRoot: report.matchesRecordedRoot, stoppedAt: report.stoppedAt,
      boundaries: report.boundaries.map((b) => ({ index: b.index, source: b.source, next: b.nextStep?.actionId,
        dependencies: b.nextStep?.dependencies, reuse: b.reuse })), error: report.error }));
  }
}

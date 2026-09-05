"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const plans = require("../randomizer/game/ai/plan-continuation");
const output = "reports/iteration/r3s1-green-plan-origin-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const record = JSON.parse(fs.readFileSync("reports/research/c3eebca2.4fba7beb.quick-200.json"));
  const raw = fs.readFileSync(record.savePath);
  const save = JSON.parse(raw);
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), savePath: record.savePath,
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    scope: "第28步真实盘面一次冷决策，随后只重放既有正式动作；对同一计划仅删除新增scan-earth依赖作因果隔离，不切换生产实现。", boundaries: [] };
  try {
    env.reset({ seed: record.seed, activePlayerCount: record.activePlayerCount,
      aiDifficulty: record.aiDifficulty, policyVersion: record.policyVersion, ...record.flags });
    for (let i = 0; i < 27; i += 1) {
      const expected = save.replaySteps[i];
      const action = env.legalActions().find((a) => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.beforeRoot = env.createCheckpoint();
    const started = performance.now();
    const decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(decision.ok, true);
    report.chosen = decision.policyDecision.actionId;
    report.plan = decision.plan;
    report.outcomes = decision.actionOutcomes;
    assert.equal(report.chosen, save.replaySteps[27].action.actionId);
    assert.ok(report.wallMs <= 10000);
    let plan = decision.plan;
    let previousTurn = env.observe().publicState.turnNumber;
    for (let index = 28; index <= 79; index += 1) {
      const expected = save.replaySteps[index];
      const observation = env.observe();
      const actions = env.legalActions();
      const action = actions.find((a) => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      if (action.actorId === "player-green") {
        const sameTurn = previousTurn === observation.publicState.turnNumber;
        const reuse = plans.planReuseCheck(plan, observation, actions, { sameTurn });
        const without = structuredClone(plan);
        if (without) for (const step of without.steps) step.dependencies = step.dependencies.filter((d) => d.scope.kind !== "scan-earth");
        const oldScope = plans.planReuseCheck(without, observation, actions, { sameTurn });
        report.boundaries.push({ index, sameTurn, source: observation.sectorWinRequirements?.standardScanEarthSource,
          expectedAction: action, nextStep: plan?.steps?.[0], reuse: { hit: reuse.hit, reason: reuse.reason },
          withoutNewDependency: { hit: oldScope.hit, reason: oldScope.reason } });
        if (!reuse.hit || reuse.action.actionId !== action.actionId) {
          report.stopCheckpoint = env.createCheckpoint();
          report.stoppedAt = index;
          break;
        }
        plan = reuse.nextPlan;
        previousTurn = observation.publicState.turnNumber;
      }
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, ms: report.wallMs, stoppedAt: report.stoppedAt,
      boundaries: report.boundaries, error: report.error }));
  }
}

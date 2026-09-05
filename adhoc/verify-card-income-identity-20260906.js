"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/card-income-identity-verification-20260906-v3.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/income-reserve-full-failure-20260906-v2.json";
  const source = JSON.parse(fs.readFileSync(sourcePath));
  const env = createSimulationEnv();
  const report = { createdAt: new Date().toISOString(), sourcePath,
    sourceSha256: crypto.createHash("sha256").update(fs.readFileSync("randomizer/game/cards/play-domain.js")).digest("hex"),
    scope: "直接恢复第236步失败checkpoint，验证一个正式AI决策及收入效果；不重跑前235步。" };
  try {
    const checkpoint = structuredClone(source.beforeDecision);
    // 直接验证已保存的当前正式状态，不重复应用从200步续跑留下的增量replaySteps。
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    report.before = env.observe();
    report.actions = env.legalActions();
    assert.equal(report.actions.length, 1);
    const action = report.actions[0];
    assert.ok(action.actionId);
    assert.equal(action.actorId, "player-brown");
    assert.equal(action.phase, "conditional");
    assert.deepEqual(action.target, source.legalActions[0].target);
    assert.deepEqual(action.payload, source.legalActions[0].payload);
    const start = performance.now();
    const result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - start;
    assert.equal(result.ok, true);
    assert.equal(result.policyDecision.actionId, action.actionId);
    report.after = env.observe();
    report.afterCheckpoint = env.createCheckpoint();
    const before = report.before.publicState.players.find((p) => p.playerId === "player-brown");
    const after = report.after.publicState.players.find((p) => p.playerId === "player-brown");
    assert.equal(after.income.energy, before.income.energy + 1);
    assert.equal(after.energy, before.energy + 1);
    assert.equal(report.after.selfState.hand.some((card) => card.id === action.target.cardInstanceId), false);
    // dlc34的后继效果按最多科技类型数量抽牌，不能把整个效果链误断言为手牌净减1。
    assert.ok(report.after.selfState.hand.some((card) => !report.before.selfState.hand.some((old) => old.id === card.id)));
    const finalState = JSON.parse(report.afterCheckpoint.coreState.committedState);
    assert.ok(finalState.cards.removedFromGameCardIds.includes("dlc_25.png"));
    assert.ok(report.wallMs <= 10000);
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    env.dispose();
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, ms: report.wallMs, action: report.actions?.[0], error: report.error }));
  }
}

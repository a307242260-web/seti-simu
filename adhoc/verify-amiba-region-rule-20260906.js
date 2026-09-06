"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/amiba-region-rule-real-trace-20260906-v2.json";
if (fs.existsSync(output)) {
  console.log(`已有记录，未重跑：${output}`);
} else {
  const env = createSimulationEnv();
  const report = { scope: "真实绿210登陆黄2：区域奖励次数、固定移动、正式恢复一致性", inputs: [] };
  const state = () => {
    const fork = env.createCounterfactualFork();
    try { return structuredClone(fork.composition.projection({ role: "simulation" }).state); }
    finally { fork.composition.dispose(); }
  };
  const submit = (actionId) => {
    const action = env.legalActions().find(a => a.actionId === actionId);
    assert.ok(action, `实际合法集缺少 ${actionId}`);
    const result = env.step(action);
    assert.equal(result.ok, true, JSON.stringify(result));
    return { actionId, target: action.target };
  };
  try {
    const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/round-income-green-before-search-20260906.json"));
    delete checkpoint.replaySteps;
    env.loadCheckpoint(checkpoint);
    for (const id of ["move:2bb2c433", "choose_payment:5323dbb9", "land:1cbade2c"]) report.inputs.push(submit(id));
    const beforeCheckpoint = env.createCheckpoint(), before = state();
    report.inputs.push(submit("choose_target:341abdca"));
    const after = state(), afterCheckpoint = env.createCheckpoint(), legalAfter = env.legalActions();
    const actorId = before.turn.currentPlayerId;
    const p0 = before.players.players.find(p => p.id === actorId);
    const p1 = after.players.players.find(p => p.id === actorId);
    report.actorId = actorId;
    report.before = { resources: p0.resources, hand: p0.hand, symbols: before.aliens.amiba.symbolSlots, meta: before.meta };
    report.after = { resources: p1.resources, hand: p1.hand, symbols: after.aliens.amiba.symbolSlots, meta: after.meta };
    assert.equal(p1.hand.length - p0.hand.length, 1, "起始盲抽细胞器只能抽一张");
    assert.equal(p1.resources.availableData - p0.resources.availableData, 1);
    assert.equal(p1.resources.score - p0.resources.score, 1, "黄2痕迹自身奖励");
    assert.deepEqual(after.aliens.amiba.symbolSlots, {
      orange_2: "symbol_4", blue_1: "symbol_2", blue_3: "symbol_1", red_1: "symbol_5", red_2: "symbol_3",
    });
    assert.ok(!legalAfter.some(a => a.target?.symbolId), "区域奖励不留下细胞器选择");
    delete beforeCheckpoint.replaySteps;
    env.loadCheckpoint(beforeCheckpoint);
    submit("choose_target:341abdca");
    assert.deepEqual(env.createCheckpoint().coreState, afterCheckpoint.coreState, "恢复后的完整规则状态/RNG一致");
    assert.deepEqual(env.legalActions(), legalAfter);
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, error: report.error }, null, 2));
  }
}

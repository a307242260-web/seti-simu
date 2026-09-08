"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/b123-trigger-formal-v2-20260907.json";
if (fs.existsSync(output)) {
  const existing = JSON.parse(fs.readFileSync(output));
  const failure = existing.rows.at(-1).result.failure;
  assert.equal(failure.code, "EFFECT_EXECUTOR_NOT_REGISTERED");
  console.log(JSON.stringify({ source: output, reused: true, failure }));
}
else {
  const env = createSimulationEnv(); let fork; const rows = [];
  try {
    env.loadCheckpoint(JSON.parse(fs.readFileSync("reports/iteration/executor-root-610-20260907.json")).checkpoint);
    fork = env.createCounterfactualFork().composition;
    const legal = () => { const s = fork.inspect(); return s.phase === "awaiting_input" ? s.session.decision.choices : fork.inputPort.enumerateActions(); };
    function submit(predicate, label) {
      const choices = legal(), action = choices.find(predicate);
      assert.ok(action, `${label}缺少合法动作：${JSON.stringify(choices)}`);
      const d = fork.inspect().session?.decision;
      const result = action.phase === "conditional"
        ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action })
        : fork.inputPort.submitAction(action);
      rows.push({ label, action, result });
      return result;
    }
    assert.equal(submit(a => a.family === "quick_trade" && a.target.tradeId === "publicity-for-card", "宣传换牌").ok, true);
    assert.equal(submit(a => a.family === "choose_card" && a.target.cardInstanceId === "card-93-0", "拿b123").ok, true);
    assert.equal(submit(a => a.family === "play_card" && a.target.cardInstanceId === "card-93-0", "打b123").ok, true);
    assert.equal(submit(a => a.family === "end_turn", "结束打牌行动").ok, true);
    assert.equal(fork.counterfactualPort.advanceFocalPlanningTurn("player-brown").ok, true);
    assert.equal(submit(a => a.family === "quick_trade" && a.target.tradeId === "cards-for-energy", "两张手牌换能量").ok, true);
    for (const id of ["card-87-0", "card-32-pass-3-3"]) {
      assert.equal(submit(a => a.target.cardInstanceId === id, "选择交易弃牌").ok, true);
    }
    assert.equal(submit(a => a.target.kind === "confirm", "确认交易弃牌").ok, true);
    assert.equal(submit(a => a.family === "scan", "扫描").ok, true);
    for (let n = 0; n < 30; n++) {
      const trigger = legal().find(a => a.family === "accept_optional_effect" && JSON.stringify(a).includes("b123-scan"));
      if (trigger) {
        const result = submit(a => a.actionId === trigger.actionId, "接受b123扫描奖励");
        assert.equal(result.ok, false);
        assert.equal(result.failure.code, "EFFECT_EXECUTOR_NOT_REGISTERED");
        console.log(JSON.stringify(result.failure));
        break;
      }
      assert.equal(submit(() => true, "继续正式扫描选择").ok, true);
    }
    assert.ok(rows.some(r => r.label === "接受b123扫描奖励"));
  } finally {
    fs.writeFileSync(output, JSON.stringify({ scope: "从610正式盘面构造可执行动作链，不运行AI", rows }, null, 2) + "\n");
    fork?.dispose(); env.dispose();
  }
}

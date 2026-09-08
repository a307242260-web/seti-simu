"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/hidden-move-payment-20260907.json";
if (fs.existsSync(output)) console.log("已有正式重放证据，不重复执行");
else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/alien-trace-root-318-20260907.json")).checkpoint;
  const captured = JSON.parse(fs.readFileSync("reports/iteration/alien-trace-318-4212b427-20260907.json"));
  const actions = captured.leaf.planSteps.map(s => s.action);
  const env = createSimulationEnv(); let fork;
  try {
    env.loadCheckpoint(checkpoint); fork = env.createCounterfactualFork().composition;
    const hand = () => JSON.parse(fork.lifecycle.save().envelope.committedState).players.players
      .find(p => p.id === "player-blue").hand.map(c => ({ id: c.id, cardId: c.cardId }));
    const initialHand = hand(), draws = []; let pending = false;
    for (let i = 0; i < 26; i++) {
      const state = fork.inspect(), d = state.session?.decision;
      const legal = state.phase === "awaiting_input" ? d.choices : fork.inputPort.enumerateActions();
      const actual = legal.find(a => a.actionId === actions[i].actionId);
      assert.ok(actual, `第${i + 1}步动作必须正式合法`);
      const before = hand();
      const submitted = actual.phase === "conditional"
        ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: actual })
        : fork.inputPort.submitAction(actual);
      assert.equal(submitted.ok, true);
      if (actual.family === "choose_card" && actual.target?.source === "blind") {
        draws.push({ planStep: i + 1, action: actual.summary, gained: hand().filter(c => !before.some(b => b.id === c.id)) });
      }
      if (actual.family === "end_turn") pending = true;
      if (pending) {
        const advanced = fork.counterfactualPort.advanceFocalPlanningTurn("player-blue");
        if (advanced.ok) pending = false;
        else assert.equal(advanced.code, "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");
      }
    }
    const payment = actions[25];
    assert.equal(payment.target.kind, "move-payment");
    const paidId = payment.target.cardIds[0];
    assert.ok(!initialHand.some(c => c.id === paidId));
    const draw = draws.find(d => d.gained.some(c => c.id === paidId));
    assert.ok(draw, "移动支付卡必须来自本次反事实新盲抽");
    fs.writeFileSync(output, JSON.stringify({ source: "alien-trace-318-4212b427-20260907.json", scope: "仅正式重放已录制计划，不运行AI",
      initialHand, draws, paymentPlanStep: 26, payment, matchingDraw: draw,
      confirmed: "已录制搜索计划使用本次反事实新盲抽牌的移动角能力，超出仅按未知牌数量支付的边界",
      rootCause: "sanitizeHiddenInformationActions将所有choose_payment视作identityIndependentCardUse，未区分移动角支付与通用弃牌",
      notProven: "未证明此缺陷由槽位贪心引入，也未证明其对整局分数或节点膨胀的贡献" }, null, 2) + "\n");
    console.log(JSON.stringify({ confirmed: true, drawStep: draw.planStep, paidId, paymentPlanStep: 26 }));
  } finally { fork?.dispose(); env.dispose(); }
}

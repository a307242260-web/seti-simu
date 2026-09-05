"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const verify = process.argv.includes("--verify");
const output = verify ? "reports/iteration/resource-r2c-payment-resolved-20260905.json"
  : "reports/iteration/resource-r2c-payment-loop-20260905.json";
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重跑：${output}`);
} else {
  const record = JSON.parse(fs.readFileSync("reports/research/60664a0b.c1b7bd49.quick-200.json"));
  const save = JSON.parse(fs.readFileSync(record.savePath));
  const env = createSimulationEnv();
  const report = { source: record.savePath, scope: "纯重放200个已有输入，再执行4次真实条件决策；不重跑全盘", decisions: [] };
  try {
    env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
    for (let index = 0; index < 200; index += 1) assert.equal(env.step(save.replaySteps[index].action).ok, true);
    for (let index = 0; index < 4; index += 1) {
      const legal = env.legalActions();
      if (verify && legal[0].family !== "choose_payment") break;
      assert.equal(legal[0].family, "choose_payment");
      const result = env.runHeuristicPolicyDecision();
      assert.equal(result.ok, true);
      const context = { seatId: legal[0].actorId, legalActions: legal, actionOutcomes: result.actionOutcomes };
      report.decisions.push({
        chosen: result.policyDecision.actionId, plan: result.plan,
        candidates: legal.map((action) => {
          const evaluation = evaluator.evaluateOutcome(context, action);
          const outcome = result.actionOutcomes.find((item) => item.actionId === action.actionId);
          return { actionId: action.actionId, target: action.target, selected: action.presentation?.selected,
            disabledReason: action.disabledReason, score: evaluation.score, sortKey: evaluation.sortKey,
            executionStepCount: evaluation.executionStepCount,
            reason: evaluation.reason, leaves: outcome?.leaves.map((leaf) => ({
              chain: leaf.actionChain, reason: leaf.terminalReason,
              hand: leaf.observation.selfState?.hand?.map((card) => card.id),
            })) };
        }),
      });
    }
    if (verify) {
      assert.notEqual(env.legalActions()[0].family, "choose_payment", "4步内必须完成真实支付");
      const committed = JSON.parse(env.saveBrowserSave().committedState);
      const actor = committed.players.players.find((player) => player.id === "player-brown");
      assert.equal(actor.hand.length, 0, "正式扣除两张手牌");
      assert.equal(actor.resources.energy, 2, "正式获得1能源");
      report.resolved = true;
    }
  } finally {
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    env.dispose();
  }
  console.log(JSON.stringify(report.decisions.map((decision) => ({ chosen: decision.chosen, plan: decision.plan,
    candidates: decision.candidates.map(({ leaves, ...rest }) => ({ ...rest, chains: leaves?.map((leaf) => leaf.chain) })) })), null, 2));
}

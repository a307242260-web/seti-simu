"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const source = "reports/iteration/budget-before-step462-20260912.json";
const output = "reports/iteration/income-discard-order-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync(source));
const orders = [["alien-amiba-1-2", "alien-amiba-9-5"], ["alien-amiba-9-5", "alien-amiba-1-2"]];
const results = orders.map(order => {
  const env = createSimulationEnv();
  try {
    env.loadCheckpoint(input.checkpoint);
    const play = env.legalActions().find(a => a.family === "play_card" && a.target.cardInstanceId === "card-53-0");
    assert(play); assert.equal(env.step(play).ok, true);
    const stages = [];
    for (const cardId of [...order, null]) {
      const legal = env.legalActions();
      stages.push({ legal, observation: env.observe("player-green") });
      const choice = legal.find(a => cardId ? a.target.cardInstanceId === cardId : a.target.done);
      assert(choice, `缺少选择 ${cardId}`); assert.equal(env.step(choice).ok, true);
    }
    return { order, stages, after: env.observe("player-green"), checkpoint: env.createCheckpoint() };
  } finally { env.dispose(); }
});
fs.writeFileSync(output, JSON.stringify({ source, scope: "同一真实输入仅执行两条正式弃牌顺序，不运行AI或对手", results }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, routes: results.map(x => ({ order: x.order, choices: x.stages.map(s => s.legal.length), resources: x.after.selfState.resources, income: x.after.selfState.income })) }, null, 2));

"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const cards = require("../randomizer/game/cards/deck");
const output = "adhoc/budget37-income-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = require("./budget37-input-20260913.json");
const trace = require("./budget37-trace-9c679f08-20260913.json");
const cluster = trace.diagnostics.goalClusters.find(c => c.path.length === 1 && c.targetId === "orbit:mars:planet:");
const prefixes = [...new Map(cluster.routeVariants.map(r => [JSON.stringify(r.actions.slice(0, -1)), r.actions.slice(0, -1)])).values()];
const rows = [];
const env = createSimulationEnv();
const player = obs => obs.publicState.players.find(p => p.playerId === "player-green");
try {
  for (const prefix of prefixes) {
    env.loadCheckpoint(input.checkpoint);
    for (const descriptor of prefix) {
      const action = env.legalActions().find(a => a.family === descriptor.family && JSON.stringify(a.target) === JSON.stringify(descriptor.target));
      assert(action, `Missing ${JSON.stringify(descriptor)}`);
      assert.equal(env.step(action).ok, true);
    }
    const checkpoint = env.createCheckpoint();
    const before = env.observe("player-green");
    const choices = env.legalActions();
    assert(choices.length && choices.every(a => a.family === "choose_card" && a.target.choiceId.startsWith("income:")));
    for (const choice of choices) {
      env.loadCheckpoint(checkpoint);
      const card = before.selfState.hand.find(c => c.id === choice.target.cardInstanceId);
      assert(card);
      assert.equal(env.step(choice).ok, true);
      const after = env.observe("player-green");
      rows.push({ prefix, choice, card, incomeGain: cards.getIncomeGainForCard(card),
        publicPlayerBefore: player(before), publicPlayerAfter: player(after),
        remainingHand: after.selfState.hand.map(c => c.id) });
    }
  }
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.prefix, row.incomeGain]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  let sameGainAlternatives = 0;
  for (const group of groups.values()) {
    for (const row of group.slice(1)) {
      assert.deepEqual(row.publicPlayerAfter, group[0].publicPlayerAfter);
      assert.notDeepEqual(row.remainingHand, group[0].remainingHand);
      sameGainAlternatives += 1;
    }
  }
  const summary = { prefixCount: prefixes.length, choiceCount: rows.length, gainGroups: groups.size, sameGainAlternatives,
    boundary: "正式回放本席当前可见收入选择；相同收益组公开玩家结果一致，但剩余手牌身份不同，不证明状态等价或最优路线保留。" };
  fs.writeFileSync(output, JSON.stringify({ summary, rows }, null, 2) + "\n", { flag: "wx" });
  console.log(`[正式收入分支核验，无AI] ${JSON.stringify(summary)}`);
} finally { env.dispose(); }

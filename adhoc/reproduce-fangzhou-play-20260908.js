"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/fangzhou-play.js");
const { createSimulationEnv } = req("../randomizer/app/simulation-env");
const fangzhou = req("../randomizer/game/aliens/fangzhou");
const effects = req("../randomizer/game/cards/effects");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "fangzhou-play-missing-reward-v2-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const envelope = structuredClone(JSON.parse(fs.readFileSync(base + "blue50-expiry-baseline-20260908.json")).rootEnvelope);
const root = JSON.parse(envelope.committedState);
const player = root.players.players.find(p => p.id === "player-blue");
// createCard2Definition含显示资料，committed state禁止src/label/cardName。
const { src, label, cardName, ...cardState } = fangzhou.createCard2Definition("pink", 1);
const card = { ...cardState, id: "fixture-fangzhou-pink1", faceUp: true };
player.hand.push(card); player.resources.handSize = player.hand.length;
root.aliens.fangzhou = fangzhou.createFangzhouState();
root.aliens.fangzhou.card1Deck = [1, 0, 2, 3, 4, 5, 6, 7, 8];
envelope.committedState = JSON.stringify(root);
const report = { codeHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope: "真实根派生正式打牌fixture：添加方舟粉1手牌和固定奖励牌堆，预期高级奖励1为盲抽2+整次扫描。非历史轨迹，不运行AI。",
  fixture: envelope, expectedReward: fangzhou.getCard1Effect(1, "advanced"),
  declaredPlayEffects: effects.buildPlayEffects(card), reproduced: false };
let env, fork;
try {
  env = createSimulationEnv();
  env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
  fork = env.createCounterfactualFork(envelope).composition;
  const actions = fork.inputPort.enumerateActions().filter(a => a.family === "play_card" && a.target?.cardInstanceId === card.id);
  assert.equal(actions.length, 1);
  report.action = actions[0];
  const result = fork.inputPort.submitAction(actions[0]);
  assert.equal(result.ok, true, JSON.stringify(result));
  report.after = fork.lifecycle.save().envelope;
  report.phase = fork.inspect().phase;
  const after = JSON.parse(report.after.committedState);
  const p = after.players.players.find(p => p.id === player.id);
  report.facts = { creditsBefore: player.resources.credits, creditsAfter: p.resources.credits,
    handBefore: player.hand.length, handAfter: p.hand.length, mainActionCompleted: p.mainActionCompleted,
    rewardDeckBefore: root.aliens.fangzhou.card1Deck, rewardDeckAfter: after.aliens.fangzhou.card1Deck,
    revealedBefore: root.aliens.fangzhou.card1Revealed, revealedAfter: after.aliens.fangzhou.card1Revealed };
  assert.equal(report.declaredPlayEffects.length, 0);
  assert.equal(p.resources.credits, player.resources.credits - 2);
  assert.equal(p.hand.length, player.hand.length - 1);
  assert.equal(p.mainActionCompleted, true);
  assert.deepEqual(after.aliens.fangzhou, root.aliens.fangzhou);
  assert.notEqual(report.phase, "awaiting_input");
  report.reproduced = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fork?.dispose(); env?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ reproduced: report.reproduced, error: report.error, facts: report.facts, phase: report.phase, output }, null, 2));
}

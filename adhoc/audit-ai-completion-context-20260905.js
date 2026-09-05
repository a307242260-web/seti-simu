"use strict";

// 第二轮设计反例；不执行策略或固定盘面，已有 checkpoint 不重复计算。
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const assert = require("node:assert/strict");
const players = require("../randomizer/game/players");
const contract = require("../randomizer/app/simulation-contract");
const outcome = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const checkpoint = path.resolve(__dirname, "../reports/iteration/resource-r2-completion-design-20260905.json");
if (fs.existsSync(checkpoint)) {
  console.log(fs.readFileSync(checkpoint, "utf8"));
} else {
  const actor = players.createPlayer({ id: "completion-audit", color: "white",
    resources: { energy: 2, availableData: 1 },
    techState: { ownedTiles: { blue2: true }, blueBoardSlots: { blue2: 1 } },
  });
  actor.dataState = { placedTokens: [{ placementKind: "computer", placementSlot: 1 }] };
  function read() {
    const observation = outcome.createDecisionObservation({
      publicState: { roundNumber: 1, board: {}, players: [contract.sanitizePublicPlayer(actor)] },
      selfState: contract.sanitizeSelfPlayer(actor),
    }, { seatId: actor.id, stateVersion: 1, decisionVersion: 1 });
    return { completion: evaluator.secondaryAgentCompletionFacts(observation, actor.id),
      liquidValue: evaluator.evaluateStateValue(observation, actor.id).components.liquidValue };
  }
  const initial = read();
  actor.blueBonusResources.energy = 1;
  const blueSource = read();
  actor.blueBonusResources.energy = 0;
  actor.dataState.placedTokens.push({ placementKind: "blueBonus", blueSlot: 1 });
  const occupiedSlot = read();
  assert.deepEqual(initial.completion, blueSource.completion);
  assert.deepEqual(initial.completion, occupiedSlot.completion);
  assert.notEqual(initial.liquidValue, blueSource.liquidValue);
  assert.notEqual(initial.liquidValue, occupiedSlot.liquidValue);
  const report = { date: "2026-09-05", gitCommit: childProcess.execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "第二轮未提交蓝槽候选的设计反例，非固定盘面实验；HEAD不能独立复现未提交估值改动",
    initial, blueSource, occupiedSlot,
    conclusion: "完成态事实相同，但来源与槽位改变使估值不同；不得以旧事实支配删除。" };
  fs.writeFileSync(checkpoint, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

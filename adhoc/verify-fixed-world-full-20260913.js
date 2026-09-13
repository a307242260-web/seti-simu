"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { buildWorldIdentity } = require("../tools/fixed-world-identity");
const { getFixedWorldConfig } = require("../randomizer/game/state/fixed-world-config");
const [quickPath, fullPath] = process.argv.slice(2);
if (!quickPath || !fullPath) throw new Error("需要同版本quick和full研究记录");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const quick = read(quickPath), full = read(fullPath);
assert.equal(full.terminal, true);
assert.equal(full.mode, "full");
assert.equal(full.gitCommit, quick.gitCommit);
assert.equal(full.fingerprint, quick.fingerprint);
assert.deepEqual(full.world, quick.world);
assert.deepEqual(full.world, buildWorldIdentity({ seed: full.seed, activePlayerCount: full.activePlayerCount }));
assert.equal(full.resumedFrom, quick.savePath);
assert.equal(full.resumeStep, quick.steps);
const quickSave = read(quick.savePath), fullSave = read(full.savePath);
assert.deepEqual(fullSave.replaySteps.slice(0, quickSave.replaySteps.length), quickSave.replaySteps,
  "续跑不得重做或改写已记录的前缀");
assert.equal(fullSave.replaySteps.length, full.steps);
const state = JSON.parse(fullSave.committedState);
const configuration = getFixedWorldConfig(full.seed);
assert.equal(state.match.finalScoringSettled, true);
assert.equal(state.match.finalScores?.length, full.activePlayerCount);
assert.deepEqual(Object.fromEntries(state.match.finalScores.map(item => [item.playerId, item.totalScore])), full.summary.scores);
assert.equal(state.meta.worldVersion, full.world.worldVersion);
assert.deepEqual(Object.fromEntries(Object.entries(state.aliens.aliens).map(([id, slot]) => [id, slot.assignedAlienId])), configuration.assignments);
for (const [key, initial] of Object.entries(configuration.alienConfigurations)) {
  assert.deepEqual(state.aliens[key].initialConfiguration, initial, "假设搜索不得写回真实物种配置");
}
assert.deepEqual(state.cards.drawPileCardIds, configuration.ordinaryDeck.slice(configuration.ordinaryDeck.length - state.cards.drawPileCardIds.length),
  "终局剩余普通牌必须仍是原固定牌序的尾部");
assert.ok(Array.isArray(full.metrics.searches));
const failures = full.metrics.searches.flatMap(search => Object.entries(search.diagnostics.failedNodeCountByCode)
  .filter(([, count]) => count > 0).map(([code, count]) => ({ step: search.step, code, count })));
assert.equal(failures.length, 0, JSON.stringify(failures));
const output = path.join(__dirname, `fixed-world-full-proof-${full.gitCommit}-20260913.json`);
const result = { quickPath, fullPath, savePath: full.savePath, world: full.world, steps: full.steps,
  preservedPrefixSteps: quickSave.replaySteps.length, failures,
  realAliens: Object.fromEntries(Object.entries(state.aliens.aliens).map(([id, slot]) => [id, { assigned: slot.assignedAlienId, revealed: slot.revealed, alienId: slot.alienId }])),
  finalScores: state.match.finalScores, quickMilliseconds: quick.wallMs, continuationMilliseconds: full.wallMs,
  combinedMilliseconds: quick.wallMs + full.wallMs,
  scope: "同代码同世界续跑完整终局、历史前缀及真实牌序/配置保全。不是与旧世界成绩的受控比较或预算归零证明。" };
if (fs.existsSync(output)) throw new Error(`已有验收记录，拒绝覆盖：${output}`);
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, steps: full.steps, failures, finalScores: result.finalScores,
  combinedMilliseconds: result.combinedMilliseconds, realAliens: result.realAliens }));

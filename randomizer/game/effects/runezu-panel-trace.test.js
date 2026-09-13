"use strict";
const assert = require("node:assert/strict");
const science = require("./science-session"), aliens = require("../aliens"), players = require("../players");
const executors = new Map();
science.createScienceDomain({ runtime: { registerExecutor(type, executor) { executors.set(type, executor); } },
  commitWorkingState(state) { return state; } });
const executor = executors.get(science.EFFECT_TYPES.ALIEN_TRACE);
function fixture() {
  const actor = { id: "p1", color: "blue", resources: { score: 0, credits: 2, energy: 2, publicity: 0, availableData: 0 },
    hand: [], reservedCards: [], income: {}, runezuSymbols: {}, techState: players.normalizePlayerTechState(null) };
  const other = { ...structuredClone(actor), id: "p2", color: "green", runezuSymbols: { symbol_2: 2 } };
  const root = { meta: { stateVersion: 1, seed: "runezu-panel-test", rngState: {}, sequences: { alienEntity: 1 } },
    match: { decisionVersion: 1 }, turn: { currentPlayerId: "p1", roundNumber: 2 }, players: { players: [actor, other] },
    aliens: aliens.createDefaultAlienState(), cards: {}, tech: {}, data: {}, planets: {}, pieces: {} };
  const slot = aliens.getAlienSlot(root.aliens, 2); slot.revealed = true; slot.alienId = "符文族";
  for (const color of ["pink", "yellow", "blue"]) slot.traces[color].firstPlaced = true;
  const runezu = aliens.runezu.ensureRunezuState(root.aliens);
  runezu.revealedSlotId = 2;
  runezu.availableSymbols = ["symbol_4", "symbol_5", "symbol_6"];
  for (let i = 1; i <= 6; i++) runezu.panelSymbolSlots[`panel_${i}`] = { slotId: `panel_${i}`, symbolId: "symbol_1", sequence: i };
  return root;
}
for (const color of ["pink", "yellow", "blue"]) for (const position of [1, 4]) {
  const root = fixture(), actor = root.players.players[0];
  const effect = { ownerId: "p1", payload: { traceType: color } };
  const choice = executor.getLegalChoices(root, effect, { state: root }).find(a => a.target.speciesId === "runezu" && a.target.position === position);
  assert(choice);
  const before = structuredClone(root);
  const result = executor.resolveDecision(root, effect, choice, { state: root });
  assert.equal(result.ok, true);
  assert.equal(aliens.runezu.getPlayerSymbolCounts(actor).symbol_1, 1, `${color}${position} 必须领取对应符号`);
  assert.equal(actor.resources.score, position === 4 ? 7 : 0);
  assert.deepEqual(root.players.players[1], before.players.players[1], "其他玩家不误领符号或分数");
  const slotId = `panel_${["pink", "yellow", "blue"].indexOf(color) + (position === 1 ? 1 : 4)}`;
  if (position === 1) {
    assert.equal(root.aliens.runezu.availableSymbols.length, 2);
    assert.notEqual(root.aliens.runezu.panelSymbolSlots[slotId].symbolId, "symbol_1");
    assert.deepEqual(root.meta.rngState, before.meta.rngState, "已洗好的符号池直接取首个，不再次随机");
    assert(result.irreversible, "补充隐藏符号必须记录不可撤销边界");
  } else {
    assert.equal(root.aliens.runezu.panelSymbolSlots[slotId], undefined);
    assert.deepEqual(root.meta.rngState, before.meta.rngState);
  }
  const replay = structuredClone(before);
  assert.equal(executor.resolveDecision(replay, effect, choice, { state: replay }).ok, true);
  assert.deepEqual(replay, root, "状态恢复后的库存、面板、RNG及序号相同");
}
for (const position of [2, 3]) {
  const root = fixture(), effect = { ownerId: "p1", payload: { traceType: "blue" } };
  const choice = executor.getLegalChoices(root, effect, { state: root }).find(a => a.target.speciesId === "runezu" && a.target.position === position);
  const result = executor.resolveDecision(root, effect, choice, { state: root });
  assert.equal(result.ok, true);
  assert.equal(root.players.players[0].resources.score, position);
  assert(result.spawnedEffects.some(row => row.effect.type === "residual_alien_card_decision"));
  assert.deepEqual(root.aliens.runezu.availableSymbols, ["symbol_4", "symbol_5", "symbol_6"]);
}
{
  const root = fixture(), effect = { ownerId: "p1", payload: { traceType: "pink" } };
  const choice = executor.getLegalChoices(root, effect, { state: root }).find(a => a.target.speciesId === "runezu" && a.target.position === 1);
  delete root.aliens.runezu.panelSymbolSlots.panel_1;
  const result = executor.resolveDecision(root, effect, choice, { state: root });
  assert.equal(result.ok, false); assert.equal(result.code, "SCIENCE_TRACE_PANEL_SYMBOL_FAILED");
  assert.equal(result.nextState, undefined, "失败不提交working state");
}
for (const color of ["pink", "yellow", "blue"]) {
  const root = fixture(), effect = { ownerId: "p1", payload: { traceType: color } };
  root.aliens.runezu.availableSymbols = [];
  const choice = executor.getLegalChoices(root, effect, { state: root }).find(a => a.target.speciesId === "runezu" && a.target.position === 1);
  const before = structuredClone(root);
  const last = executor.resolveDecision(root, effect, choice, { state: root });
  assert.equal(last.ok, true);
  const slotId = `panel_${["pink", "yellow", "blue"].indexOf(color) + 1}`;
  assert.equal(root.aliens.runezu.panelSymbolSlots[slotId].symbolId, null);
  assert.deepEqual(root.meta.rngState, before.meta.rngState, "耗尽不消耗RNG或补造符号");
  assert.equal(Boolean(last.irreversible), false, "没有补出隐藏符号，不制造新信息屏障");
  const replay = structuredClone(before);
  assert.equal(executor.resolveDecision(replay, effect, choice, { state: replay }).ok, true);
  assert.deepEqual(replay, root);
  const afterLast = structuredClone(root);
  const repeat = executor.getLegalChoices(root, effect, { state: root })
    .find(a => a.target.speciesId === "runezu" && a.target.position === 1);
  assert.ok(repeat, "符号耗尽不关闭顶部可重复痕迹位");
  assert.equal(executor.resolveDecision(root, effect, repeat, { state: root }).ok, true);
  assert.deepEqual(root.players, afterLast.players, "空位不再发符号、分数或其他玩家奖励");
  assert.deepEqual(root.meta.rngState, afterLast.meta.rngState);
  assert.equal(aliens.runezu.countTraceMarkers(root.aliens, root.players.players[0], color, 2),
    aliens.runezu.countTraceMarkers(afterLast.aliens, afterLast.players.players[0], color, 2) + 1,
    "实际痕迹仍须按规则记录");
}
console.log("runezu trace panel symbol rewards passed");

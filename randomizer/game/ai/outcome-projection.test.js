"use strict";
const assert = require("node:assert/strict");
const model = require("./outcome-model");

const observation = (score) => ({
  publicState: { roundNumber: 1, players: [{ playerId: "p1", resources: { score } }], board: {} },
  selfState: { playerId: "p1", hand: [] },
});
const shared = { action: { actionId: "payment", actorId: "p1" }, facts: { data: { slots: [1] } } };
const input = [{ actionId: "root", rootObservation: observation(1), note: { label: "kept" }, leaves: [
  { leafId: "a", observation: observation(5), actionChain: ["root"], routeCheckpoints: [], planSteps: [shared] },
  { leafId: "b", observation: observation(7), actionChain: ["root", "payment"], routeCheckpoints: [], planSteps: [shared] },
] }];
const before = structuredClone(input);
input[0].searchCompleteness = { status: "incomplete", reasons: ["beam-budget"] };
before[0].searchCompleteness = structuredClone(input[0].searchCompleteness);
const result = model.projectOutcomeObservations(input, { seatId: "p1" });
assert.deepEqual(input, before);
assert.equal(Object.isFrozen(input[0]), false);
assert.equal(Object.isFrozen(shared), false);
assert.equal(result[0].leaves[0].observation.outcomeProjection.scoring.realizedScore, 5);
assert.equal(result[0].leaves[1].observation.outcomeProjection.scoring.realizedScore, 7);
assert.deepEqual(result[0].note, { label: "kept" });
assert.deepEqual(result[0].searchCompleteness, { status: "incomplete", reasons: ["beam-budget"] });
assert.deepEqual(result[0].leaves.map((leaf) => leaf.actionChain), [["root"], ["root", "payment"]]);
assert.equal(Object.hasOwn(result[0].leaves[0], "routeCheckpoints"), false);
assert.equal(Object.isFrozen(result[0].leaves[0].planSteps[0].facts.data.slots), true);
shared.facts.data.slots.push(2);
input[0].note.label = "changed";
assert.deepEqual(result[0].leaves.map((leaf) => leaf.planSteps[0].facts.data.slots), [[1], [1]]);
assert.equal(result[0].note.label, "kept");
assert.throws(() => result[0].leaves[0].planSteps[0].facts.data.slots.push(3), TypeError);
const valid = { ...result[0], schemaVersion: model.OUTCOME_SCHEMA_VERSION,
  status: "settled", confidence: "low" };
assert.doesNotThrow(() => model.assertOutcomeSet([valid], [{ actionId: "root" }]));
for (const searchCompleteness of [
  { status: "complete", reasons: ["beam-budget"] },
  { status: "incomplete", reasons: [] },
  { status: "incomplete", reasons: ["unknown"] },
  { status: "not-evaluated", reasons: ["not-evaluated"] },
]) assert.throws(() => model.assertOutcomeSet([{ ...valid, searchCompleteness }], [{ actionId: "root" }]), /searchCompleteness/);
// 正式 state 构造不同主人的首／额外标记；只读投影不能把额外标记送给首标记主人。
{
  const state = require("../aliens/state");
  const aliens = state.createDefaultAlienState();
  state.placeFirstTrace(aliens, 2, "yellow", "red");
  state.addExtraTrace(aliens, 2, "yellow", "blue");
  state.addExtraTrace(aliens, 2, "yellow", "blue");
  state.placeFirstTrace(aliens, 2, "pink", "blue");
  state.addExtraTrace(aliens, 2, "pink", "red");
  state.placeFirstTrace(aliens, 2, "blue", "green");
  aliens.aliens[2].traces.blue.neutral = true;
  aliens.aliens[2].assignedAlienId = "chong";
  for (const revealed of [false, true]) {
    const slot = { ...structuredClone(aliens.aliens[2]), slotId: 2, revealed };
    for (const [color, expectedFirst, expectedExtra] of [["red", 1, 1], ["blue", 1, 2], ["green", 0, 0]]) {
      const source = { publicState: { players: [{ playerId: color, color, resources: { score: 0 } }],
        board: { aliens: { slots: [slot] } } }, selfState: { playerId: color, hand: [] } };
      const snapshot = structuredClone(source);
      const freeze = value => { if (value && typeof value === "object") {
        Object.values(value).forEach(freeze); Object.freeze(value);
      } };
      freeze(source);
      const projection = model.createDecisionObservation(source, { seatId: color }).outcomeProjection;
      const facts = projection.progress.alienSlots[0];
      assert.equal(facts.slotId, 2);
      assert.equal(facts.ownFirstTraces, expectedFirst);
      assert.equal(facts.ownExtraMarks, expectedExtra);
      assert.equal(facts.firstTracesComplete, true, "凑齐不要求同一玩家，neutral 也占首格");
      assert.equal(facts.alienId, revealed ? "chong" : null);
      assert.equal(projection.progress.traceCount, expectedFirst + expectedExtra);
      assert.equal(model.createStrategicFacts(source, color).traceCount, expectedFirst + expectedExtra);
      assert.deepEqual(source, snapshot, "正式计数的归一化不能修改公开观察");
    }
  }
}
// 累计溢出来自正式gainData，释放容量后的获取不再增长；不是当前池数量的代理。
{
  const data = require("../data");
  const players = require("../players");
  const { sanitizePublicPlayer } = require("../../app/simulation-contract");
  const player = players.getCurrentPlayer(players.createPlayerState({
    currentPlayer: { color: "white", resources: { availableData: 0 } },
  }));
  const root = { meta: { sequences: { dataToken: 1 } } };
  function check(expected) {
    const before = structuredClone(player);
    const own = sanitizePublicPlayer(player);
    const source = { publicState: { players: [own], board: {} },
      selfState: { playerId: player.id, hand: [] } };
    assert.equal(own.dataProgress.discardedCount, expected);
    assert.equal(model.createDecisionObservation(source, { seatId: player.id })
      .outcomeProjection.progress.dataProgress.discardedCount, expected);
    assert.equal(model.createStrategicFacts(source, player.id).dataProgress.discardedCount, expected);
    assert.deepEqual(player, before, "公开溢出计数不得初始化或修改正式状态");
  }
  check(0);
  for (let i = 0; i < players.RESOURCE_LIMITS.availableData; i += 1) {
    assert.equal(data.gainData(player, { root }).ok, true);
  }
  check(0);
  assert.equal(data.gainData(player, { root }).discarded, true);
  check(1);
  assert.equal(data.placeDataToComputer(player).ok, true);
  check(1);
  assert.equal(data.gainData(player, { root }).ok, true);
  check(1);
}
console.log("outcome projection tests passed");
{
  const { sanitizePublicPlayer, sanitizeSelfPlayer } = require("../../app/simulation-contract");
  const player = { id: "p1", initialSelection: { industry: "未来跨度研究所" },
    industryRoundMarkRound: 2, industryRoundMarkTurn: 4,
    industryFutureSpan: { card: { id: "parked", cardId: "b_117.webp", secretExtra: "omit" },
      targetScore: 20, playing: false }, industryStrategyPassiveSlots: { yellow: true, red: false, blue: false } };
  const snapshot = structuredClone(player);
  const self = sanitizeSelfPlayer(player);
  assert.equal(self.companyState.abilityId, "future_span_pick_advance");
  assert.equal(self.companyState.roundMarkRound, 2);
  assert.equal(self.companyState.roundMarkTurn, 4);
  assert.equal(self.companyState.futureSpan.targetScore, 20);
  assert.equal(self.companyState.futureSpan.card.id, "parked");
  assert.equal(self.companyState.futureSpan.card.secretExtra, undefined);
  assert.equal(sanitizePublicPlayer(player).companyState, undefined, "停放私有牌不泄露给其他席位");
  self.companyState.strategyPassiveSlots.yellow = false;
  assert.deepEqual(player, snapshot, "只读投影及副本修改不得改变公司正式状态");
}

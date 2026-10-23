"use strict";
const assert = require("node:assert/strict");
const turnFlow = require("../turn-flow");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
const seed = "turn-preview-isolation-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4 });
kernel.newGame({ seed });
const base = freeze(JSON.parse(kernel.composition.lifecycle.save().envelope.committedState));
kernel.composition.dispose();
const outcomes = new Set();
let cases = 0;
for (const count of [1, 2, 4]) {
  const ids = base.players.players.slice(0, count).map(player => player.id);
  for (const roundNumber of [2, 4]) for (let passedMask = 0; passedMask < 2 ** count; passedMask += 1) {
    for (let completedMask = 0; completedMask < 2 ** count; completedMask += 1) for (const passed of [false, true]) {
      const playerId = ids[(passedMask ^ completedMask) % count];
      const state = freeze({ ...base, turn: { ...base.turn, activePlayerCount: count, activePlayerIds: ids,
        turnOrderPlayerIds: ids, currentPlayerId: playerId, startPlayerId: ids[completedMask % count], roundNumber,
        turnNumber: completedMask + 1, actionCycleNumber: 3, gameEnded: false, gameEndReason: null,
        passedPlayerIds: ids.filter((_, index) => passedMask & 2 ** index),
        completedTurnPlayerIds: ids.filter((_, index) => completedMask & 2 ** index),
        visitedPlanetsByPlayerId: { [playerId]: ["earth"] },
        cardTurnEventBonuses: [{ playerId, eventType: "move" }, { playerId: "other", eventType: "launch" }] } });
      const expected = structuredClone(state), partial = { ...state, turn: structuredClone(state.turn) };
      const fullResult = turnFlow.advanceTurnAfterPlayerAction(expected, playerId, { passed });
      const partialResult = turnFlow.advanceTurnAfterPlayerAction(partial, playerId, { passed });
      assert.deepEqual(partialResult, fullResult);
      assert.deepEqual(partial, expected, "turn-only copy must preserve the entire resulting state");
      for (const key of Object.keys(state).filter(key => key !== "turn")) assert.equal(partial[key], state[key]);
      outcomes.add(partialResult.gameEnded ? "game-ended" : partialResult.roundAdvanced ? "round-advanced"
        : partialResult.nextPlayerId === playerId ? "same-owner" : "other-owner");
      cases += 1;
    }
  }
}
assert.deepEqual([...outcomes].sort(), ["game-ended", "other-owner", "round-advanced", "same-owner"]);
console.log(JSON.stringify({ turnPreviewCases: cases, outcomes: [...outcomes].sort(), rootFrozen: true }));

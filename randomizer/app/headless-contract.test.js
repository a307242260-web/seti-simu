"use strict";

const assert = require("node:assert/strict");
const {
  TURN_ACTION_FAMILIES,
  CONDITIONAL_FAMILIES,
  LEGACY_FAMILY_BY_ID,
  ACTION_COVERAGE_MATRIX,
  CONDITIONAL_COVERAGE_MATRIX,
  normalizeTurnCandidate,
  normalizeConditionalCandidate,
  sanitizeAlienPublicState,
  sanitizeTechSupply,
} = require("./headless-contract");

assert.equal(TURN_ACTION_FAMILIES.length, 15);
assert.deepEqual(CONDITIONAL_FAMILIES, [
  "choose_card", "choose_target", "choose_payment", "choose_reward", "choose_branch",
  "choose_final_scoring", "accept_optional_effect",
]);
assert.equal(ACTION_COVERAGE_MATRIX.length, 15);
assert.equal(CONDITIONAL_COVERAGE_MATRIX.length, 7);
assert.deepEqual(CONDITIONAL_COVERAGE_MATRIX.map((entry) => entry.family), CONDITIONAL_FAMILIES);
for (const family of CONDITIONAL_FAMILIES) {
  const action = normalizeConditionalCandidate({
    id: "conditionalChoice",
    family,
    target: { kind: "test-choice", choiceId: family },
  }, "player-blue");
  assert.equal(action.family, family);
  assert.equal(action.decisionType, "conditional_choice");
  assert.equal(action.actionFeature.phase, "conditional");
}

for (const entry of ACTION_COVERAGE_MATRIX) {
  assert.ok(entry.legacyId, `${entry.family} 应有 runtime selector 映射`);
  const action = normalizeTurnCandidate({
    id: entry.legacyId,
    kind: entry.family === "end_turn" ? "end-turn" : "main",
    rocketId: entry.family === "move" ? 7 : null,
    direction: entry.family === "move" ? "clockwise" : null,
    target: entry.family === "scan" ? { sectorX: 3 } : null,
  }, "player-white");
  assert.equal(action.family, entry.family);
  assert.equal(action.decisionType, "turn_action");
  assert.equal(action.schemaVersion, "seti-rl-action-v2");
  assert.equal("score" in action, false);
  assert.equal("actionGraph" in action, false);
  assert.deepEqual(action, normalizeTurnCandidate({
    id: entry.legacyId,
    kind: entry.family === "end_turn" ? "end-turn" : "main",
    rocketId: entry.family === "move" ? 7 : null,
    direction: entry.family === "move" ? "clockwise" : null,
    target: entry.family === "scan" ? { sectorX: 3 } : null,
  }, "player-white"), `${entry.family} action id/feature 应稳定`);
}

assert.deepEqual(Object.values(LEGACY_FAMILY_BY_ID), TURN_ACTION_FAMILIES);
const hiddenAlien = sanitizeAlienPublicState({
  revealPoolAlienIds: ["secret-next-alien"],
  aliens: { 1: { revealed: false, assignedAlienId: "secret-next-alien", traces: { blue: { firstPlaced: false } } } },
  yichangdian: { cardDeck: [3, 2, 1] },
});
assert.equal(hiddenAlien.slots[0].alienId, null);
assert.equal(JSON.stringify(hiddenAlien).includes("secret-next-alien"), false);

const tech = sanitizeTechSupply({
  board: { stacks: { blue1: { tileId: "blue1", bonusId: "now", bonusQueue: ["future"], remaining: 3 } } },
  ui: { selectedTileId: "blue1" },
});
assert.equal(tech.stacks.blue1.bonusId, "now");
assert.equal(JSON.stringify(tech).includes("future"), false);
assert.equal(JSON.stringify(tech).includes("selectedTileId"), false);

console.log("headless-contract tests passed");

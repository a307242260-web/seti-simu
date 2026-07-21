"use strict";

const assert = require("node:assert/strict");
const {
  TURN_ACTION_FAMILIES,
  CONDITIONAL_FAMILIES,
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
    standardAction: {
      schemaVersion: "seti-standard-action-v1",
      actionId: `${family}:shared-action-id`,
      actorId: "player-blue",
      family,
      phase: "conditional",
      target: { kind: "test-choice", choiceId: family },
      payload: {},
    },
  }, "player-blue");
  assert.equal(action.family, family);
  assert.equal(action.decisionType, "conditional_choice");
  assert.equal(action.actionFeature.phase, "conditional");
}

const sharedConditional = normalizeConditionalCandidate({
  standardAction: {
    schemaVersion: "seti-standard-action-v1",
    actionId: "choose_reward:shared-action-id",
    actorId: "player-blue",
    family: "choose_reward",
    phase: "conditional",
    target: { kind: "reward", choiceId: "energy" },
    payload: { amount: 1 },
    summary: "获得能量",
  },
}, "wrong-fallback-owner");
assert.equal(sharedConditional.actionId, "choose_reward:shared-action-id");
assert.equal(sharedConditional.actorPlayerId, "player-blue");

for (const entry of ACTION_COVERAGE_MATRIX) {
  assert.equal(entry.source, "standard_action_descriptor");
  const phase = entry.family === "end_turn"
    ? "turn_control"
    : TURN_ACTION_FAMILIES.indexOf(entry.family) >= 8 ? "quick" : "main";
  const action = normalizeTurnCandidate({
    standardAction: {
      schemaVersion: "seti-standard-action-v1",
      actionId: `${entry.family}:shared-action-id`,
      actorId: "player-white",
      family: entry.family,
      phase,
      target: entry.family === "scan" ? { sectorX: 3 } : null,
      payload: entry.family === "move" ? { rocketId: 7, direction: "clockwise" } : {},
    },
  }, "player-white");
  assert.equal(action.family, entry.family);
  assert.equal(action.decisionType, "turn_action");
  assert.equal(action.schemaVersion, "seti-rl-action-v2");
  assert.equal("score" in action, false);
  assert.equal("actionGraph" in action, false);
  assert.equal(action.actionId, `${entry.family}:shared-action-id`);
}

assert.equal(normalizeTurnCandidate({ id: "move", kind: "quick" }, "player-white"), null);
assert.equal(normalizeConditionalCandidate({ family: "choose_reward" }, "player-blue"), null);
const sharedTurn = normalizeTurnCandidate({
  standardAction: {
    schemaVersion: "seti-standard-action-v1",
    actionId: "move:shared-action-id",
    actorId: "player-white",
    family: "move",
    phase: "quick",
    target: { rocketId: 7, deltaX: 1, deltaY: 0 },
    payload: { requiredMovePoints: 1 },
    summary: "移动",
  },
}, "wrong-fallback-owner");
assert.equal(sharedTurn.actionId, "move:shared-action-id", "训练 actionId 必须沿用浏览器 registry identity");
assert.equal(sharedTurn.actorPlayerId, "player-white");
assert.equal(sharedTurn.actionFeature.phase, "quick");
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

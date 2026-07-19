"use strict";

const assert = require("node:assert/strict");
const { createHeuristicPolicyAdapter } = require("./heuristic-policy-adapter");

function action(family, index, phase) {
  return {
    schemaVersion: "seti-rl-action-v2",
    actionId: `${family}:fixture-${index}`,
    actorPlayerId: "player-blue",
    stateVersion: 3,
    decisionVersion: 7,
    decisionType: phase === "conditional" ? "conditional_choice" : "turn_action",
    family,
    target: { choiceId: String(index) },
    payload: {},
    actionFeature: { phase },
    summary: `${family} ${index}`,
  };
}

const adapter = createHeuristicPolicyAdapter({ difficulty: "weak_start" });
const observation = {
  schemaVersion: "seti-rl-observation-v1",
  perspectivePlayerId: "player-blue",
  publicState: { roundNumber: 1, players: [] },
  selfState: { playerId: "player-blue", hand: [] },
};
const selected = adapter.select(observation, [
  action("pass", 0, "main"),
  action("land", 1, "main"),
], { seed: "adapter-fixture" });

assert.equal(selected.action.actionId, "land:fixture-1");
assert.equal(selected.decision.actionId, selected.action.actionId);
assert.equal(selected.context.legalActions.every(Object.isFrozen), true);
assert.equal(adapter.getProvenance().version, "seti-heuristic-policy-v1");

console.log("training/heuristic-policy-adapter.test.js ok");

"use strict";

const assert = require("node:assert/strict");
const actionBar = require("./action-bar");

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const action = {
  schemaVersion: "seti-standard-action-v1",
  actionId: "launch:p1",
  family: "launch",
  phase: "main",
  actorId: "p1",
  stateVersion: 3,
  decisionVersion: 2,
  target: { kind: "launch" },
  payload: {},
  summary: "发射",
  disabledReason: null,
};
const browserProjection = deepFreeze({
  schemaVersion: "seti-browser-host-v1",
  projectionId: "projection:1",
  source: {
    kind: "committed", stateVersion: 3, sessionId: null, sessionRevision: null, phase: "idle",
  },
  viewer: { viewerId: "viewer:p1", playerId: "p1", role: "player" },
  match: { currentPlayerId: "p1" },
  resident: {},
  controls: { actions: [action], quickActions: [], canUndo: false },
  feedback: {},
});
const selected = actionBar.selectActionBarProjection(browserProjection);
assert.equal(Object.isFrozen(selected), true);
assert.equal(selected.controls.actions[0].actionId, action.actionId);

let submitted = null;
const controller = actionBar.createActionBarController({
  dispatchIntent(intent) {
    submitted = intent;
    return { ok: true };
  },
  dispatchUndo: () => ({ ok: true }),
});
controller.setProjection(selected);
assert.equal(controller.activate({ type: "action", actionId: action.actionId }).ok, true);
assert.equal(submitted.action.actionId, action.actionId);
assert.equal(controller.activate({ type: "action", actionId: "stale" }).code, "ACTION_BAR_ACTION_STALE");
const firstCard = {
  ...action,
  actionId: "play:first",
  family: "play_card",
  target: { cardInstanceId: "card-1" },
};
const secondCard = {
  ...action,
  actionId: "play:second",
  family: "play_card",
  target: { cardInstanceId: "card-2" },
};
assert.equal(actionBar.selectMainAction([firstCard, secondCard], "play_card", null), null);
assert.equal(
  actionBar.selectMainAction([firstCard, secondCard], "play_card", "card-2").actionId,
  "play:second",
);
assert.equal(actionBar.selectMainAction([firstCard, secondCard], "play_card", "missing"), null);
assert.equal(Object.hasOwn(actionBar, "createActionSessionRuntime"), false);
assert.equal(Object.hasOwn(actionBar, "createActionGuardRuntime"), false);
console.log("action bar tests passed");

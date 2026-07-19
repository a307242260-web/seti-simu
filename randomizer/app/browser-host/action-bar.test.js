"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const actionBar = require("./action-bar");

const standard = (family, phase, suffix, disabledReason = null) => ({
  schemaVersion: "seti-standard-action-v1",
  actionId: `${family}:${suffix}`,
  family,
  phase,
  actorId: "p1",
  stateVersion: 7,
  decisionVersion: 4,
  target: { suffix },
  payload: {},
  summary: family,
  disabledReason,
});

function projection(overrides = {}) {
  return {
    projectionId: "session:controls",
    source: { kind: "session", sessionId: "s1", sessionRevision: 4 },
    controls: {
      actions: [
        standard("launch", "main", "a"),
        standard("scan", "main", "disabled", "能量不足"),
        standard("pass", "main", "pass"),
        standard("end_turn", "control", "end"),
      ],
      quickActions: [standard("quick_trade", "quick", "trade")],
      canUndo: true,
      undoDisabledReason: null,
    },
    feedback: {
      progress: {
        completedEffects: 2,
        remainingEffects: 1,
        totalEffects: 3,
        currentEffectType: "choose-tech",
      },
    },
    ...overrides,
  };
}

(function testModelIsExactControlsProjectionWithoutLegalityInference() {
  const input = projection();
  const model = actionBar.createActionBarModel(input);
  assert.deepEqual(model.mainActions.map((item) => [item.actionId, item.disabledReason]), [
    ["launch:a", null],
    ["scan:disabled", "能量不足"],
  ]);
  assert.deepEqual(model.quickActions.map((item) => item.actionId), ["quick_trade:trade"]);
  assert.equal(model.pass.actionId, "pass:pass");
  assert.equal(model.endTurn.actionId, "end_turn:end");
  assert.equal(model.undo.enabled, true);
  assert.deepEqual(model.progress, input.feedback.progress);
})();

(function testEveryEnabledActionForkSubmitsOriginalStandardDescriptor() {
  const calls = [];
  const controller = actionBar.createActionBarController({
    dispatchIntent(intent) { calls.push(intent); return { ok: true }; },
    dispatchUndo(command) { calls.push({ kind: "undo", command }); return { ok: true }; },
  });
  const input = projection();
  controller.setProjection(input);
  const all = [...input.controls.actions, ...input.controls.quickActions];
  for (const candidate of all.filter((item) => !item.disabledReason)) {
    assert.equal(controller.activate({ type: "action", actionId: candidate.actionId }).ok, true);
  }
  assert.deepEqual(
    calls.filter((entry) => entry.kind === "action").map((entry) => entry.action),
    all.filter((item) => !item.disabledReason),
  );
  assert.equal(controller.activate({ type: "action", actionId: "scan:disabled" }).code, "ACTION_BAR_ACTION_DISABLED");
  assert.equal(controller.activate({ type: "action", actionId: "forged" }).code, "ACTION_BAR_ACTION_STALE");
  assert.equal(calls.length, all.filter((item) => !item.disabledReason).length);
})();

(function testUndoUsesOnlySessionPortAndCarriesProjectionIdentity() {
  const calls = { action: 0, undo: [] };
  const controller = actionBar.createActionBarController({
    dispatchIntent() { calls.action += 1; return { ok: true }; },
    dispatchUndo(command) { calls.undo.push(command); return { ok: true }; },
  });
  controller.setProjection(projection());
  assert.equal(controller.activate({ type: "undo" }).ok, true);
  assert.deepEqual(calls.undo, [{ sessionId: "s1", sessionRevision: 4 }]);
  assert.equal(calls.action, 0);

  controller.setProjection(projection({
    controls: { ...projection().controls, canUndo: false, undoDisabledReason: "不可越过隐藏信息屏障撤销" },
  }));
  assert.equal(controller.activate({ type: "undo" }).code, "ACTION_BAR_UNDO_DISABLED");
  assert.equal(calls.undo.length, 1);
})();

(function testHandlerSourceHasNoLegacyMutationOrLegalityOwners() {
  const source = fs.readFileSync(path.join(__dirname, "action-bar.js"), "utf8");
  for (const forbidden of [
    "pendingState", "actionHistory", "quickActionHistory", "runAction(",
    "endCurrentTurn(", "passForCurrentPlayer(", "undoPendingAction(", "continuation",
  ]) assert.equal(source.includes(forbidden), false, forbidden);
})();

console.log("browser action bar projection/input tests passed");

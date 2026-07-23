"use strict";

const assert = require("node:assert/strict");
const projectionApi = require("./projection-adapter");
const viewStateApi = require("./view-state-store");
const inputApi = require("./input-adapter");
const decisionUiApi = require("./decision-ui");

function projection(choices, overrides = {}) {
  return {
    projectionId: overrides.projectionId || "tech-projection-3",
    decision: {
      decisionId: "research:effect:2",
      decisionVersion: 3,
      ownerId: "p1",
      kind: "research_tech_choice",
      titleKey: "研究科技",
      promptKey: "选择科技与蓝槽",
      minChoices: 1,
      maxChoices: 1,
      optional: false,
      choices,
      ...overrides.decision,
    },
  };
}

(function testProjectionKeepsResearchTileIdentityAndPresentation() {
  const state = {
    meta: { stateVersion: 9 },
    match: {}, turn: {}, players: { p1: { id: "p1" } }, cards: {}, tech: {}, aliens: {},
  };
  const decision = {
    decisionId: "research:1",
    decisionVersion: 2,
    ownerId: "p1",
    decisionKind: "research_tech_choice",
    choices: [{ choiceId: "blue2@blue-slot-1", tileId: "blue2", slotId: "blue-slot-1", slotLabel: "蓝槽 1" }],
  };
  const adapter = projectionApi.createBrowserProjectionAdapter({
    stateStore: { getSnapshot: () => state },
    sessionRuntime: {
      inspect: () => ({ ok: true, sessionId: "research", phase: "awaiting_input", revision: 2, decision }),
      observe: () => ({ sessionId: "research", phase: "awaiting_input", revision: 2, state, decision }),
    },
  });
  const result = adapter.projectSession({}, {
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  });
  assert.equal(result.decision.choices[0].choiceId, "blue2@blue-slot-1");
  assert.deepEqual(result.decision.choices[0].presentation, {
    tileId: "blue2",
    slotId: "blue-slot-1",
    tileLabel: null,
    slotLabel: "蓝槽 1",
    color: null,
    image: null,
    role: null,
  });
})();

(function testTechRendererUsesOnlyProjectedChoicesAndRoutesFocusConfirmCancel() {
  const submitted = [];
  const viewStore = viewStateApi.createViewStateStore();
  const input = inputApi.createBrowserInputAdapter({
    dispatchAction: () => ({ ok: true }),
    submitDecision(value) { submitted.push(value); return { ok: true }; },
    viewStateStore: viewStore,
  });
  const controller = decisionUiApi.createDecisionUiController({ dispatchIntent: input.dispatchIntent });
  const current = projection([
    { choiceId: "blue2@slot-a", label: "蓝色科技 2 / A", presentation: { tileId: "blue2", slotId: "slot-a", slotLabel: "蓝槽 A" } },
    { choiceId: "blue2@slot-b", label: "蓝色科技 2 / B", presentation: { tileId: "blue2", slotId: "slot-b", slotLabel: "蓝槽 B" } },
    { choiceId: "purple1", label: "紫色科技 1", presentation: { tileId: "purple1" } },
    { choiceId: "skip", label: "跳过", presentation: { role: "skip" } },
  ]);
  viewStore.reconcileProjection(current);
  let inputState = { projection: current, viewState: viewStore.getSnapshot() };
  let model = controller.render(inputState);
  assert.equal(model.rendererKey, "tech");
  assert.deepEqual(model.content.tiles.map((tile) => tile.tileId), ["blue2", "purple1"]);
  assert.equal(model.controls.cancelChoiceId, "skip");

  controller.dispatchUiIntent({ type: "focus", entityRef: { kind: "tech-tile", id: "blue2" } }, inputState);
  inputState = { projection: current, viewState: viewStore.getSnapshot() };
  model = controller.render(inputState);
  assert.deepEqual(model.content.slots.map((slot) => slot.choiceId), ["blue2@slot-a", "blue2@slot-b"]);
  controller.dispatchUiIntent({ type: "focus", choiceId: "blue2@slot-b" }, inputState);
  inputState = { projection: current, viewState: viewStore.getSnapshot() };
  assert.equal(controller.render(inputState).controls.confirmDisabled, false);
  controller.dispatchUiIntent({ type: "confirm" }, inputState);
  controller.dispatchUiIntent({ type: "cancel" }, inputState);
  assert.deepEqual(submitted, [
    { decisionId: "research:effect:2", decisionVersion: 3, choice: { choiceId: "blue2@slot-b" } },
    { decisionId: "research:effect:2", decisionVersion: 3, choice: { choiceId: "skip" } },
  ]);
})();

(function testRequiredDecisionCannotInventCancelAndLegacyContinuationsStayUnreachable() {
  const calls = { takeTech: 0, reward: 0, continuation: 0 };
  let authorityVersion = 5;
  const viewStore = viewStateApi.createViewStateStore();
  const controller = decisionUiApi.createDecisionUiController({
    dispatchIntent(intent) {
      if (intent.kind === "view") return viewStore.dispatch(intent);
      if (intent.submission.decisionVersion !== authorityVersion) {
        return { ok: false, code: "EFFECT_DECISION_STALE" };
      }
      calls.takeTech += 1;
      return { ok: true };
    },
  });
  const current = projection(
    [{ choiceId: "purple1", label: "紫色科技", presentation: { tileId: "purple1" } }],
    { projectionId: "before-quick", decision: { decisionVersion: 5 } },
  );
  viewStore.reconcileProjection(current);
  let inputState = { projection: current, viewState: viewStore.getSnapshot() };
  assert.equal(controller.dispatchUiIntent({ type: "cancel" }, inputState).code, "DECISION_UI_CANCEL_UNAVAILABLE");
  controller.dispatchUiIntent({ type: "focus", entityRef: { kind: "tech-tile", id: "purple1" } }, inputState);
  inputState = { projection: current, viewState: viewStore.getSnapshot() };
  authorityVersion = 7;
  assert.equal(controller.dispatchUiIntent({ type: "confirm" }, inputState).code, "EFFECT_DECISION_STALE");
  assert.deepEqual(calls, { takeTech: 0, reward: 0, continuation: 0 });

})();

(function testClearedViewStateRebuildPreservesChoiceSetWithoutRuleCalls() {
  const current = projection([
    { choiceId: "blue2@a", label: "蓝 2 / A", presentation: { tileId: "blue2", slotId: "a" } },
    { choiceId: "blue2@b", label: "蓝 2 / B", presentation: { tileId: "blue2", slotId: "b" } },
    { choiceId: "purple1", label: "紫 1", presentation: { tileId: "purple1" } },
  ]);
  let ruleCalls = 0;
  const controller = decisionUiApi.createDecisionUiController({ dispatchIntent() { ruleCalls += 1; } });
  const firstStore = viewStateApi.createViewStateStore();
  firstStore.reconcileProjection(current);
  firstStore.dispatch({ type: "focus.set", entityRef: { kind: "tech-tile", id: "blue2" } });
  firstStore.dispatch({ type: "draft.set", intentKind: "decision", selectedChoiceIds: ["blue2@b"] });
  const rebuiltStore = viewStateApi.createViewStateStore();
  rebuiltStore.reconcileProjection(current);
  const first = controller.render({ projection: current, viewState: firstStore.getSnapshot() });
  const rebuilt = controller.render({ projection: current, viewState: rebuiltStore.getSnapshot() });
  assert.deepEqual(first.content.tiles, rebuilt.content.tiles);
  assert.deepEqual(first.content.tiles.map((tile) => tile.tileId), ["blue2", "purple1"]);
  assert.equal(ruleCalls, 0);
})();

console.log("browser decision UI tests passed");

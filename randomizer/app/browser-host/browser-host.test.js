"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const stateApi = require("../../game/state/state-store");
const projectionApi = require("./projection-adapter");
const viewStateApi = require("./view-state-store");
const inputApi = require("./input-adapter");

function createState() {
  return stateApi.createCommittedGameState({
    gameId: "seti-73",
    rulesetVersion: "prototype-2026-07",
    seed: 73,
    rngState: { secretCanary: "HIDDEN_RNG_CANARY" },
    sequences: {},
    match: { status: "playing", debugCanary: "HIDDEN_MATCH_CANARY" },
    turn: { round: 2, turn: 3, currentPlayerId: "p1" },
    players: {
      p1: { id: "p1", name: "一号", resources: { credits: 5 }, privateGoal: "OWN_GOAL" },
      p2: { id: "p2", name: "二号", resources: { credits: 4 }, privateGoal: "OPPONENT_GOAL_CANARY" },
    },
    solarSystem: { rotation: 2, secretCanary: "HIDDEN_BOARD_CANARY" },
    pieces: {},
    planets: {},
    data: {},
    cards: {
      deck: ["DECK_ORDER_CANARY", "c3"],
      hands: { p1: ["own-card"], p2: ["OPPONENT_HAND_CANARY"] },
      reserved: { p1: ["own-reserved"], p2: ["OPPONENT_RESERVED_CANARY"] },
      market: ["public-card"],
      discard: ["discarded-card"],
    },
    tech: { supply: { orange: ["orange-1"] }, secretCanary: "HIDDEN_TECH_CANARY" },
    aliens: { revealed: ["species-1"], secretCanary: "HIDDEN_ALIEN_CANARY" },
    finalScoring: { tiles: ["a"] },
  });
}

(function testCommittedProjectionIsDefaultDenyFrozenAndIsolated() {
  const store = stateApi.createStateStore(createState());
  let snapshotCalls = 0;
  const stateStore = {
    getSnapshot() {
      snapshotCalls += 1;
      return store.getSnapshot();
    },
  };
  const actions = [{
    schemaVersion: "seti-standard-action-v1",
    actionId: "pass:1",
    family: "pass",
    phase: "main",
    actorId: "p1",
    stateVersion: 0,
    decisionVersion: null,
    target: null,
    payload: {},
    summary: "PASS",
  }];
  const adapter = projectionApi.createBrowserProjectionAdapter({
    stateStore,
    actionAdapter: { enumerate: () => actions },
  });
  const projection = adapter.projectCommitted({
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  });
  assert.equal(snapshotCalls, 1);
  assert.equal(projection.schemaVersion, "seti-browser-host-v1");
  assert.equal(projection.source.kind, "committed");
  assert.equal(projection.source.stateVersion, 0);
  assert.deepEqual(projection.cards.hand, ["own-card"]);
  assert.deepEqual(projection.cards.opponentCounts.p2, { hand: 1, reserved: 1 });
  assert.equal(projection.players.p1.privateGoal, "OWN_GOAL");
  assert.equal(Object.hasOwn(projection.players.p2, "privateGoal"), false);
  assert.equal(projection.cards.deckCount, 2);
  const json = JSON.stringify(projection);
  for (const canary of [
    "HIDDEN_RNG_CANARY", "HIDDEN_MATCH_CANARY", "HIDDEN_BOARD_CANARY", "DECK_ORDER_CANARY",
    "OPPONENT_HAND_CANARY", "OPPONENT_RESERVED_CANARY", "OPPONENT_GOAL_CANARY",
    "HIDDEN_TECH_CANARY", "HIDDEN_ALIEN_CANARY",
  ]) assert.equal(json.includes(canary), false, canary);
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.players.p1.resources), true);
  assert.throws(() => { projection.players.p1.resources.credits = 99; }, TypeError);
  assert.equal(store.getSnapshot().players.p1.resources.credits, 5);
  assert.equal(adapter.projectCommitted({
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  }).players.p1.resources.credits, 5);
})();

(function testSessionProjectionUsesOnlyConsistentInspectObserveAndHidesDecisionChoices() {
  let storeReads = 0;
  let inspectCalls = 0;
  let observeCalls = 0;
  const state = createState();
  state.players.p1.resources.credits = 2;
  const decision = {
    ok: true,
    decisionId: "session-1:effect:2",
    decisionVersion: 4,
    ownerId: "p1",
    decisionKind: "choose_tech",
    allowQuickActions: true,
    choices: [{ id: "orange-1", label: "橙色科技" }, { id: "blue-1", label: "蓝色科技" }],
  };
  const sessionRuntime = {
    inspect() {
      inspectCalls += 1;
      return {
        ok: true, sessionId: "session-1", phase: "awaiting_input", baseVersion: 0,
        revision: 4, decision,
        controls: { canUndo: false, undoDisabledReason: "不可越过隐藏信息屏障撤销", allowQuickActions: true },
        progress: { completedEffects: 2, remainingEffects: 1, totalEffects: 3, currentEffectType: "choose-tech" },
      };
    },
    observe(_session, viewer) {
      observeCalls += 1;
      assert.equal(viewer.viewerId.startsWith("viewer-"), true);
      return {
        schemaVersion: "seti-effect-session-v1",
        sessionId: "session-1",
        phase: "awaiting_input",
        revision: 4,
        state,
        decision,
      };
    },
  };
  const adapter = projectionApi.createBrowserProjectionAdapter({
    stateStore: { getSnapshot() { storeReads += 1; return createState(); } },
    sessionRuntime,
    actionAdapter: {
      enumerate() {
        return [
          {
            schemaVersion: "seti-standard-action-v1", actionId: "pass:session", family: "pass", phase: "main",
            actorId: "p1", stateVersion: 0, decisionVersion: 4, summary: "PASS",
          },
          {
            schemaVersion: "seti-standard-action-v1", actionId: "quick_trade:session", family: "quick_trade", phase: "quick",
            actorId: "p1", stateVersion: 0, decisionVersion: 4, summary: "快速交易", disabledReason: "信用点不足",
          },
        ];
      },
    },
  });
  const ownerProjection = adapter.projectSession({}, {
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  });
  assert.equal(storeReads, 0);
  assert.equal(inspectCalls, 1);
  assert.equal(observeCalls, 1);
  assert.equal(ownerProjection.source.kind, "session");
  assert.equal(ownerProjection.source.sessionRevision, 4);
  assert.equal(ownerProjection.players.p1.resources.credits, 2);
  assert.deepEqual(ownerProjection.decision.choices.map((choice) => choice.choiceId), ["orange-1", "blue-1"]);
  assert.equal(ownerProjection.controls.actions[0].actionId, "pass:session");
  assert.equal(ownerProjection.controls.quickActions[0].disabledReason, "信用点不足");
  assert.equal(ownerProjection.controls.canUndo, false);
  assert.equal(ownerProjection.controls.undoDisabledReason, "不可越过隐藏信息屏障撤销");
  assert.equal(ownerProjection.feedback.progress.currentEffectType, "choose-tech");
  const spectator = adapter.projectSession({}, {
    viewer: { viewerId: "viewer-s", playerId: "p2", role: "spectator" },
  });
  assert.equal(spectator.decision.ownerId, "p1");
  assert.deepEqual(spectator.decision.choices, []);
  assert.equal(Object.hasOwn(spectator.players.p2, "privateGoal"), false);

  const inconsistent = projectionApi.createBrowserProjectionAdapter({
    stateStore: { getSnapshot: () => createState() },
    sessionRuntime: {
      inspect: () => ({ ok: true, sessionId: "s", phase: "draining", revision: 1 }),
      observe: () => ({ sessionId: "s", phase: "draining", revision: 2, state }),
    },
  }).projectSession({}, {
    viewer: { viewerId: "viewer-p1", playerId: "p1", role: "player" },
  });
  assert.equal(inconsistent.code, "BROWSER_PROJECTION_SESSION_SOURCE_MISMATCH");
})();

(function testViewStateReconcileAndClearNeverTouchRulePorts() {
  const store = viewStateApi.createViewStateStore();
  store.reconcileProjection({
    projectionId: "projection-1",
    decision: { decisionId: "d1", decisionVersion: 1, choices: [{ choiceId: "a" }, { choiceId: "removed" }] },
  });
  store.dispatch({
    type: "draft.set",
    intentKind: "decision",
    selectedChoiceIds: ["a", "removed"],
    text: "draft",
  });
  store.reconcileProjection({
    projectionId: "projection-2",
    decision: { decisionId: "d1", decisionVersion: 2, choices: [{ choiceId: "a" }, { choiceId: "new" }] },
  });
  assert.deepEqual(store.getSnapshot().draft.selectedChoiceIds, ["a"]);
  store.reconcileProjection({
    projectionId: "projection-3",
    decision: { decisionId: "d2", decisionVersion: 1, choices: [{ choiceId: "a" }] },
  });
  assert.deepEqual(store.getSnapshot().draft, { intentKind: null, selectedChoiceIds: [], text: "" });
  const cleared = store.clear();
  assert.equal(cleared.overlay.activeId, null);
  assert.deepEqual(cleared.draft.selectedChoiceIds, []);
  assert.equal(Object.isFrozen(cleared.layout.panelSizes), true);
})();

(function testInputRoutingAndStaleRefreshWithoutRetryOrVersionRewrite() {
  const calls = { action: [], decision: [], view: [], refresh: 0 };
  const viewStateStore = viewStateApi.createViewStateStore();
  const originalViewDispatch = viewStateStore.dispatch;
  const wrappedViewStore = {
    getSnapshot: viewStateStore.getSnapshot,
    dispatch(intent) {
      calls.view.push(intent);
      return originalViewDispatch(intent);
    },
  };
const adapter = inputApi.createBrowserInputAdapter({
    dispatchAction(action) {
      calls.action.push(action);
      return { ok: false, code: "STANDARD_ACTION_STALE", authority: { stateVersion: 8 } };
    },
    submitDecision(submission) {
      calls.decision.push(submission);
      return { ok: false, code: "EFFECT_DECISION_STALE", decision: { decisionVersion: 6 } };
    },
    viewStateStore: wrappedViewStore,
    refreshProjection() {
      calls.refresh += 1;
      return { projectionId: `refreshed-${calls.refresh}` };
    },
  });
  const staleAction = { actionId: "pass:old", stateVersion: 7, decisionVersion: null };
  const staleDecision = { decisionId: "d1", decisionVersion: 5, choice: { id: "a" } };
  assert.equal(adapter.dispatchIntent({ kind: "action", action: staleAction }).code, "STANDARD_ACTION_STALE");
  assert.equal(adapter.dispatchIntent({ kind: "decision", submission: staleDecision }).code, "EFFECT_DECISION_STALE");
  adapter.dispatchIntent({ kind: "view", type: "overlay.set", activeId: "tech" });
  assert.deepEqual(calls.action, [staleAction]);
  assert.deepEqual(calls.decision, [staleDecision]);
  assert.deepEqual(calls.view, [{ type: "overlay.set", activeId: "tech" }]);
  assert.equal(calls.refresh, 2);
  assert.equal(adapter.inspectInputState().viewState.overlay.activeId, "tech");
  assert.equal(adapter.dispatchIntent({ kind: "mystery" }).code, "BROWSER_INPUT_INTENT_UNKNOWN");
  assert.equal(calls.action.length, 1);
  assert.equal(calls.decision.length, 1);
})();

(function testLegacyRuleInputDispatcherOwnsStableSnapshotAndStandardRouting() {
  let phase = "idle";
  const calls = [];
  const dispatcher = inputApi.createRuleInputDispatcher({
    standardActionSchemaVersion: "seti-standard-action-v1",
    inspect: () => ({ phase }),
    createRecoverySnapshot: (options) => { calls.push(["snapshot", options.label]); return {}; },
    enumerateActions: () => [{ actionId: "pass:1" }],
    dispatchRuntimeAction: (action) => ({ ok: true, action: {
      schemaVersion: "seti-standard-action-v1", actionId: `${action.family}:1`, family: action.family, phase: "main",
    } }),
    submitAction: (action) => { calls.push(["main", action.actionId]); phase = "idle"; return { ok: true }; },
    submitQuickAction: (action) => { calls.push(["quick", action.actionId]); return { ok: true }; },
  });
  assert.equal(dispatcher.dispatch({ kind: "standard_enumerate" }).candidates.length, 1);
  assert.equal(dispatcher.dispatch({ kind: "standard_intent", family: "pass" }).ok, true);
  assert.deepEqual(calls, [["snapshot", "Standard Action 开始前稳定恢复点"], ["main", "pass:1"]]);
})();

(function testStandardIntentAndActiveDecisionPortsOwnBrowserInputMapping() {
  const dispatched = [];
  const standard = inputApi.createStandardIntentPort({
    dispatch(request) { dispatched.push(request); return { ok: true }; },
  });
  standard.runAction("land", { rocketId: 3, target: { type: "satellite", satelliteId: "s1" } });
  assert.deepEqual(dispatched[0].selector, { rocketId: 3, type: "satellite", satelliteId: "s1" });

  const submissions = [];
  const decisions = inputApi.createActiveDecisionPort({
    inspect: () => ({
      phase: "awaiting_input",
      session: { decision: {
        decisionId: "d1",
        decisionVersion: 2,
        choices: [{ target: { kind: "industry-free-move", rocketId: 7, direction: "cw" } }],
      } },
    }),
    submitDecision(submission) { submissions.push(submission); return { ok: true }; },
  });
  assert.equal(decisions.submitDirectional("industry-free-move", 1, 0, 7).ok, true);
  assert.equal(submissions[0].decisionVersion, 2);
  assert.equal(decisions.submit("unknown", () => true).code, "CARD_DECISION_REQUIRED");
})();

console.log("browser host reference core tests passed");

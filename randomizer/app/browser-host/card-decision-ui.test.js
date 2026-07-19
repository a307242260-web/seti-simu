"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const projectionApi = require("./projection-adapter");
const viewStateApi = require("./view-state-store");
const inputApi = require("./input-adapter");
const decisionUiApi = require("./decision-ui");
const cardDecisionUiApi = require("./card-decision-ui");
const standardAction = require("../../game/actions/standard-action");

(function testProductionAssemblyLoadsCardAdapterBeforeBrowserFacade() {
  const pageSource = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");
  const cardPosition = pageSource.indexOf("browser-host/card-decision-ui.js");
  const facadePosition = pageSource.indexOf("browser-host/index.js");
  assert.equal(cardPosition >= 0, true);
  assert.equal(cardPosition < facadePosition, true);
  const facadeSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  assert.match(facadeSource, /root\.SetiBrowserCardDecisionUi/);
  assert.match(facadeSource, /cardDecisionUi,/);
})();

function actionChoice(family, actorId, id, presentation = {}, extra = {}) {
  return {
    schemaVersion: standardAction.SCHEMA_VERSION,
    actionId: `${family}:${id}`,
    family,
    actorId,
    stateVersion: 7,
    decisionVersion: 3,
    target: { id, ...extra.target },
    payload: { ...extra.payload },
    summary: extra.summary || id,
    presentation,
  };
}

function rawDecision(kind, ownerId, choices, overrides = {}) {
  return {
    decisionId: `card-session:${kind}:1`,
    decisionVersion: 3,
    ownerId,
    decisionKind: kind,
    presentationHint: "card",
    titleKey: overrides.titleKey || "卡牌结算",
    promptKey: overrides.promptKey || "请选择合法项",
    minChoices: 1,
    maxChoices: 1,
    choices,
    ...overrides,
  };
}

function projectDecision(decision, viewer) {
  const state = {
    meta: { stateVersion: 7 },
    match: { currentPlayerId: decision.ownerId },
    players: {
      p1: { id: "p1", hand: [{ id: "p1-card" }] },
      p2: { id: "p2", hand: [{ id: "HIDDEN_OPPONENT_HAND" }] },
    },
    cards: { hands: { p1: [{ id: "p1-card" }], p2: [{ id: "HIDDEN_OPPONENT_HAND" }] } },
  };
  const envelope = { ok: true, sessionId: "card-session", revision: 4, phase: "awaiting_input", decision };
  const adapter = projectionApi.createBrowserProjectionAdapter({
    stateStore: { getSnapshot: () => structuredClone(state) },
    sessionRuntime: {
      inspect: () => structuredClone(envelope),
      observe: () => ({ ...structuredClone(envelope), state: structuredClone(state) }),
    },
    decisionPresenter: cardDecisionUiApi.createCardDecisionPresenter({
      fallback: projectionApi.defaultDecisionPresenter,
    }),
  });
  return adapter.projectSession({}, { viewer });
}

(function testCardPresenterWhitelistsPresentationAndHidesChoicesFromNonOwner() {
  const decision = rawDecision("choose_payment", "p1", [
    actionChoice("choose_payment", "p1", "energy", { cost: { energy: 2 } }, {
      payload: { secret: "PAYMENT_SECRET_CANARY" }, summary: "支付 2 能量",
    }),
    actionChoice("choose_payment", "p1", "data", { cost: { data: 1 } }, { summary: "支付 1 数据" }),
  ]);
  const owner = projectDecision(decision, { viewerId: "viewer-p1", playerId: "p1", role: "player" });
  assert.deepEqual(owner.decision.choices.map((choice) => choice.choiceId), [
    "choose_payment:energy", "choose_payment:data",
  ]);
  assert.deepEqual(owner.decision.choices[0].presentation, { cost: { energy: 2 } });
  assert.equal(JSON.stringify(owner).includes("PAYMENT_SECRET_CANARY"), false);
  assert.equal(JSON.stringify(owner).includes("HIDDEN_OPPONENT_HAND"), false);

  const other = projectDecision(decision, { viewerId: "viewer-p2", playerId: "p2", role: "player" });
  assert.deepEqual(other.decision.choices, []);
  assert.equal(JSON.stringify(other).includes("PAYMENT_SECRET_CANARY"), false);
})();

(function testCardRendererUsesOnlyProjectionAndViewStateMayBeDestroyed() {
  const projection = projectDecision(rawDecision("choose_card", "p1", [
    actionChoice("choose_card", "p1", "public-a", { cardId: "public-a", image: "a.webp" }, { summary: "公开牌 A" }),
    actionChoice("choose_card", "p1", "blind", { role: "skip" }, { summary: "取消" }),
  ]), { viewerId: "viewer-p1", playerId: "p1", role: "player" });
  let ruleCalls = 0;
  const controller = cardDecisionUiApi.createCardDecisionUiController(decisionUiApi, {
    dispatchIntent() { ruleCalls += 1; return { ok: true }; },
  });
  const firstStore = viewStateApi.createViewStateStore();
  firstStore.reconcileProjection(projection);
  firstStore.dispatch({ type: "draft.set", intentKind: "decision", selectedChoiceIds: ["choose_card:public-a"] });
  const rebuiltStore = viewStateApi.createViewStateStore();
  rebuiltStore.reconcileProjection(projection);
  const first = controller.render({ projection, viewState: firstStore.getSnapshot() });
  const rebuilt = controller.render({ projection, viewState: rebuiltStore.getSnapshot() });
  assert.equal(first.rendererKey, "card");
  assert.deepEqual(first.content.choices, rebuilt.content.choices);
  assert.deepEqual(first.content.choices.map((choice) => choice.choiceId), ["choose_card:public-a"]);
  assert.equal(first.controls.cancelChoiceId, "choose_card:blind");
  assert.equal(ruleCalls, 0, "render/ViewState 重建不得调用规则端口");
})();

(function testSequentialCardDecisionsStopAtTheirActualOwners() {
  const payment = rawDecision("choose_payment", "p1", [
    actionChoice("choose_payment", "p1", "energy", { cost: { energy: 1 } }),
  ]);
  const reward = rawDecision("choose_reward", "p2", [
    actionChoice("choose_reward", "p2", "score", { reward: { score: 2 } }),
  ], { decisionId: "card-session:trigger:2", decisionVersion: 4 });
  assert.equal(projectDecision(payment, { viewerId: "p1-view", playerId: "p1", role: "player" }).decision.choices.length, 1);
  assert.equal(projectDecision(reward, { viewerId: "p1-view", playerId: "p1", role: "player" }).decision.choices.length, 0);
  assert.equal(projectDecision(reward, { viewerId: "p2-view", playerId: "p2", role: "player" }).decision.choices.length, 1);
})();

(function testStaleCardDraftCannotCallContinuationOrMutateRules() {
  const projection = projectDecision(rawDecision("choose_reward", "p1", [
    actionChoice("choose_reward", "p1", "score", { reward: { score: 2 } }),
  ]), { viewerId: "viewer-p1", playerId: "p1", role: "player" });
  const calls = { decisions: 0, continuation: 0, rewards: 0 };
  let authorityVersion = projection.decision.decisionVersion + 1;
  const store = viewStateApi.createViewStateStore();
  store.reconcileProjection(projection);
  store.dispatch({ type: "draft.set", intentKind: "decision", selectedChoiceIds: ["choose_reward:score"] });
  const input = inputApi.createBrowserInputAdapter({
    dispatchAction: () => ({ ok: true }),
    submitDecision(submission) {
      if (submission.decisionVersion !== authorityVersion) return { ok: false, code: "EFFECT_HOST_DECISION_STALE" };
      calls.decisions += 1;
      return { ok: true };
    },
    viewStateStore: store,
    refreshProjection: () => ({ projectionId: "fresh-card-projection" }),
  });
  const controller = cardDecisionUiApi.createCardDecisionUiController(decisionUiApi, {
    dispatchIntent: input.dispatchIntent,
  });
  const result = controller.dispatchUiIntent({ type: "confirm" }, {
    projection,
    viewState: store.getSnapshot(),
  });
  assert.equal(result.code, "EFFECT_HOST_DECISION_STALE");
  assert.deepEqual(calls, { decisions: 0, continuation: 0, rewards: 0 });
  assert.equal(input.inspectInputState().lastResult.refreshedProjection.projectionId, "fresh-card-projection");
})();

(function testUntrustedCardChoiceIdentityFailsClosed() {
  assert.throws(() => projectDecision(rawDecision("choose_payment", "p1", [{
    actionId: "legacy-payment", family: "choose_payment", actorId: "p1", summary: "旧支付",
  }]), { viewerId: "viewer-p1", playerId: "p1", role: "player" }), /Standard Action identity/);
})();

(function testBrowserScriptParityAndNoLegacyRuleDependencies() {
  const source = fs.readFileSync(path.join(__dirname, "card-decision-ui.js"), "utf8");
  for (const forbidden of [
    "pendingState", "cardSelectionAction", "cardTriggerAction", "continueAfterCardTriggerResolution",
    "completeCurrentActionEffect", "players.gainResources", "cardEffects.consumeTrigger",
  ]) assert.equal(source.includes(forbidden), false, `card Decision adapter 不得引用 ${forbidden}`);
  const context = vm.createContext({ structuredClone, globalThis: null });
  context.globalThis = context;
  vm.runInContext(source, context, { filename: "card-decision-ui.js" });
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.SetiBrowserCardDecisionUi.CARD_DECISION_KINDS)),
    cardDecisionUiApi.CARD_DECISION_KINDS,
  );
})();

console.log("browser card decision UI tests passed");

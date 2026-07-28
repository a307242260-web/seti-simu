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
    match: {}, turn: {}, players: { players: [{ id: "p1", color: "white" }] }, cards: {}, tech: {}, aliens: {},
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

(function testInitialSetupChoicesProjectRealCardFaces() {
  const company = projectionApi.defaultDecisionPresenter(
    { ownerId: "p1", decisionKind: "choose_card" },
    {
      schemaVersion: "seti-standard-action-v1",
      actionId: "company",
      family: "choose_card",
      actorId: "p1",
      target: {
        kind: "select_initial_card",
        selectionKind: "industry",
        cardId: "industry:图灵系统.png",
      },
      summary: "选择公司：图灵系统",
    },
    0,
  );
  const initial = projectionApi.defaultDecisionPresenter(
    { ownerId: "p1", decisionKind: "choose_card" },
    {
      schemaVersion: "seti-standard-action-v1",
      actionId: "initial",
      family: "choose_card",
      actorId: "p1",
      target: {
        kind: "select_initial_card",
        selectionKind: "initial",
        cardId: "initial:7",
      },
      summary: "取消：初始牌 7",
    },
    1,
  );
  assert.equal(company.presentation.imageSrc, "../assets/industry/图灵系统.png");
  assert.equal(company.presentation.cardKind, "industry");
  assert.equal(initial.presentation.imageSrc, "../assets/initial_card/split/7.png");
  assert.equal(initial.presentation.selected, true);
})();

(function testInitialIncomeDecisionShowsCardFacesResourcesAndIncome() {
  const current = projection([{
    choiceId: "income-card",
    label: "轨道计划",
    presentation: {
      cardId: "b_7.webp",
      cardKind: "hand",
      imageSrc: null,
      imageAlt: "轨道计划",
      selected: false,
    },
  }], {
    decision: {
      kind: "choose_payment",
      titleKey: null,
      promptKey: null,
    },
  });
  current.resident = {
    initialIncome: {
      active: true,
      currentPlayerRemainingCount: 2,
      companyLabel: "图灵系统",
    },
    browserReadModel: {
      render: {
        playerPanels: {
          players: [{
            id: "p1",
            displayName: "白色玩家",
            resources: { credits: 4, energy: 2, publicity: 3, availableData: 1 },
            income: { credits: 2, energy: 1, handSize: 1 },
          }],
        },
        cardPanels: {
          handCards: [{
            id: "card-7",
            definitionId: "b_7.webp",
            imageSrc: "../assets/cards/basic/split/b_7.webp",
            label: "轨道计划",
            incomeGain: { energy: 1 },
          }],
        },
      },
    },
  };
  const controller = decisionUiApi.createDecisionUiController({ dispatchIntent() {} });
  const model = controller.render({
    projection: current,
    viewState: { draft: { selectedChoiceIds: ["income-card"] } },
  });
  assert.equal(model.shell.title, "插入收入牌");
  assert.match(model.shell.prompt, /图灵系统/);
  assert.equal(model.content.status.remainingCount, 2);
  assert.equal(model.content.status.resources.find((entry) => entry.key === "credits").value, 4);
  assert.equal(model.content.status.income.find((entry) => entry.key === "handSize").value, 1);
  assert.equal(
    model.content.choices[0].card.imageSrc,
    "../assets/cards/basic/split/b_7.webp",
  );
  assert.equal(model.content.choices[0].label, "轨道计划");
  assert.equal(model.content.choices[0].card.detail, "+1 能量收入");
  assert.deepEqual(model.controls.selectedChoiceIds, ["income-card"]);
})();

(function testInitialSetupUsesProjectedSelectionsAndTwoColumnGroups() {
  const current = projection([
    {
      choiceId: "industry-a",
      label: "图灵系统",
      presentation: {
        cardId: "industry:图灵系统.png",
        cardKind: "industry",
        imageSrc: "../assets/industry/图灵系统.png",
      },
    },
    {
      choiceId: "industry-b",
      label: "太阳动力",
      presentation: {
        cardId: "industry:太阳动力.png",
        cardKind: "industry",
        imageSrc: "../assets/industry/太阳动力.png",
      },
    },
    {
      choiceId: "initial-7",
      label: "资源牌 7",
      presentation: {
        cardId: "initial:7",
        cardKind: "initial",
        imageSrc: "../assets/initial_card/split/7.png",
      },
    },
    {
      choiceId: "initial-8",
      label: "资源牌 8",
      presentation: {
        cardId: "initial:8",
        cardKind: "initial",
        imageSrc: "../assets/initial_card/split/8.png",
      },
    },
    {
      choiceId: "setup-confirm",
      label: "确认初始选择",
      presentation: { role: "setup-confirm" },
    },
  ], { decision: { kind: "choose_card" } });
  current.resident = {
    browserReadModel: {
      render: {
        cardPanels: {
          initialSelection: {
            offer: {
              selectedIndustryId: "industry:图灵系统.png",
              selectedInitialIds: ["initial:7", "initial:8"],
              industryOptions: [
                { id: "industry:图灵系统.png", label: "图灵系统" },
                { id: "industry:太阳动力.png", label: "太阳动力" },
              ],
              initialOptions: [
                { id: "initial:7", label: "资源牌 7" },
                { id: "initial:8", label: "资源牌 8" },
                { id: "initial:9", label: "资源牌 9" },
              ],
            },
          },
        },
      },
    },
  };
  const controller = decisionUiApi.createDecisionUiController({ dispatchIntent() {} });
  const model = controller.render({ projection: current, viewState: {} });
  assert.equal(model.content.layout, "initial-setup");
  assert.deepEqual(model.content.groups.map((group) => group.kind), ["industry", "initial"]);
  assert.deepEqual(model.content.groups.map((group) => group.choices.length), [2, 3]);
  assert.equal(model.content.groups[0].choices[0].card.selected, true);
  assert.equal(model.content.groups[0].choices[1].card.selected, false);
  assert.equal(model.content.groups[1].choices[0].card.selected, true);
  assert.equal(model.content.groups[1].choices[1].card.selected, true);
  assert.equal(model.content.groups[1].choices[2].choiceId, null);
  assert.equal(model.content.groups[1].choices[2].disabledReason, "已选满 2 张；先取消一张再选择");
  assert.equal(model.content.groups[1].choices[2].card.imageSrc, "../assets/initial_card/split/9.png");
  assert.equal(model.content.setupConfirmChoiceId, "setup-confirm");
  assert.equal(model.content.choices.some((choice) => choice.choiceId === "setup-confirm"), false);
})();

(function testInitialSetupDirectSubmitUsesCurrentDecisionIdentity() {
  const submitted = [];
  const current = projection([{
    choiceId: "company-choice",
    label: "图灵系统",
    presentation: {
      cardId: "industry:图灵系统.png",
      cardKind: "industry",
      imageSrc: "../assets/industry/图灵系统.png",
    },
  }], { decision: { kind: "choose_card" } });
  const controller = decisionUiApi.createDecisionUiController({
    dispatchIntent(intent) {
      submitted.push(intent);
      return { ok: true };
    },
  });
  const inputState = { projection: current, viewState: {} };
  assert.equal(controller.render(inputState).content.directSubmit, true);
  controller.dispatchUiIntent(
    { type: "submit-choice", choiceId: "company-choice" },
    inputState,
  );
  assert.deepEqual(submitted, [{
    kind: "decision",
    submission: {
      decisionId: "research:effect:2",
      decisionVersion: 3,
      ownerId: "p1",
      choice: { choiceId: "company-choice" },
    },
  }]);
})();

(function testDecisionCollapseOnlyChangesViewStateAndPreservesDecision() {
  const current = projection([
    { choiceId: "purple1", label: "紫色科技", presentation: { tileId: "purple1" } },
  ]);
  const store = viewStateApi.createViewStateStore();
  store.reconcileProjection(current);
  const controller = decisionUiApi.createDecisionUiController({
    dispatchIntent(intent) {
      if (intent.kind === "view") return store.dispatch(intent);
      throw new Error("收起 Decision 不得提交规则输入");
    },
  });
  controller.dispatchUiIntent(
    { type: "collapse" },
    { projection: current, viewState: store.getSnapshot() },
  );
  store.reconcileProjection(current);
  let model = controller.render({ projection: current, viewState: store.getSnapshot() });
  assert.equal(model.shell.collapsed, true);
  assert.equal(store.getSnapshot().projection.decisionId, current.decision.decisionId);
  controller.dispatchUiIntent(
    { type: "expand" },
    { projection: current, viewState: store.getSnapshot() },
  );
  model = controller.render({ projection: current, viewState: store.getSnapshot() });
  assert.equal(model.shell.collapsed, false);
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
    { decisionId: "research:effect:2", decisionVersion: 3, ownerId: "p1", choice: { choiceId: "blue2@slot-b" } },
    { decisionId: "research:effect:2", decisionVersion: 3, ownerId: "p1", choice: { choiceId: "skip" } },
  ]);
})();

(function testRequiredDecisionCannotInventCancelAndLegacyRuleCallsStayUnreachable() {
  const calls = { takeTech: 0, reward: 0, legacyRule: 0 };
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
  assert.deepEqual(calls, { takeTech: 0, reward: 0, legacyRule: 0 });

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

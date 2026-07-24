"use strict";

const assert = require("node:assert/strict");
const actionBar = require("./action-bar");

assert.throws(
  () => actionBar.createBrowserDesktopActionBarController({}),
  /DesktopActionBar bootstrap 缺少 owner/,
);

assert.throws(
  () => actionBar.createBrowserUndoController({}),
  /Undo bootstrap 缺少 owner/,
);

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
    source: { kind: "session", stateVersion: 7, sessionId: "s1", sessionRevision: 4 },
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

function deepFreeze(value) {
  if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function browserProjection(overrides = {}) {
  const projected = projection();
  return deepFreeze({
    schemaVersion: "seti-browser-host-v1",
    projectionId: projected.projectionId,
    source: projected.source,
    viewer: { viewerId: "browser:p1", playerId: "p1", role: "player" },
    match: { currentPlayerId: "p1" },
    board: {},
    players: {},
    cards: {},
    tech: {},
    aliens: {},
    resident: {},
    controls: projected.controls,
    decision: null,
    feedback: projected.feedback,
    ...overrides,
  });
}

(function testActionSessionRuntimeOwnsHistoryAndStartLocks() {
  let complete = false;
  let session = false;
  let barrier = null;
  const calls = [];
  const history = {
    markActionComplete() { complete = true; },
    isActionComplete() { return complete; },
    markIrreversible(value) { barrier = value; },
    getIrreversibleBarrier() { return barrier; },
    hasIrreversibleBarrier() { return Boolean(barrier); },
    hasUndoableStep() { return false; },
    hasSession() { return session; },
    getSessionInfo() { return session ? { stepCount: 0 } : null; },
    commitSession() { session = false; },
  };
  const runtime = actionBar.createActionSessionRuntime({
    actionHistory: history,
    uiRuntimeState: { effectStepActive: true },
    historySourceMain: "main",
    clearCompletedEffectFlowForUndo: (source) => calls.push(`clear:${source}`),
    clearHistoryStepOrderForSource: (source) => calls.push(`order:${source}`),
    pruneEmptyActionLogDraft: () => calls.push("prune"),
    renderActionLog: () => calls.push("render"),
    isActionEffectFlowActive: () => false,
    hasActivePendingSubFlow: () => false,
    getGameplayLockReason: () => null,
  });
  assert.equal(runtime.canStartMainAction(), true);
  runtime.markActionPending();
  assert.equal(runtime.isActionPending(), true);
  assert.equal(runtime.getMainActionStartBlockReason(), "请先回合结束或撤销当前行动");
  assert.deepEqual(runtime.markCurrentActionIrreversible("隐藏信息", "hidden"), { code: "hidden", reason: "隐藏信息" });
  assert.equal(runtime.canUndoCurrentMainAction(), false);
  assert.deepEqual(runtime.getAlienCardGainIrreversible({ card: {} }), {
    code: "hidden_alien_card_reveal", reason: "外星人牌获取翻开新牌",
  });
  complete = false;
  session = true;
  assert.equal(runtime.clearStaleFullyUndoneMainActionSession(), true);
  assert.deepEqual(calls, ["order:main", "clear:main", "prune", "render"]);
})();

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

(function testActionBarSelectorIsMinimalFrozenAndFailClosed() {
  const dto = actionBar.selectActionBarProjection(browserProjection(), {
    inspection: {
      session: {
        sessionId: "s1",
        revision: 4,
        controls: { canUndo: true, undoDisabledReason: null },
        progress: { completedEffects: 2, totalEffects: 3 },
      },
    },
  });
  assert.deepEqual(Object.keys(dto), [
    "schemaVersion", "projectionId", "source", "seat", "controls", "feedback",
  ]);
  assert.equal(Object.isFrozen(dto.controls.actions[0].target), true);
  assert.throws(() => { dto.controls.actions[0].target.suffix = "mutated"; }, TypeError);
  assert.throws(
    () => actionBar.selectActionBarProjection({ ...browserProjection(), forgedRoot: {} }),
    /伪造字段/,
  );
  assert.throws(
    () => actionBar.selectActionBarProjection({ ...browserProjection() }),
    /深冻结/,
  );
  assert.throws(
    () => actionBar.selectActionBarProjection(browserProjection({ match: {} })),
    /identity 不完整/,
  );
  const forgedActionProjection = structuredClone(browserProjection());
  forgedActionProjection.controls.actions[0].workingRoot = {};
  assert.throws(
    () => actionBar.selectActionBarProjection(deepFreeze(forgedActionProjection)),
    /伪造字段/,
  );
  assert.throws(
    () => actionBar.selectActionBarProjection(browserProjection(), {
      inspection: { session: { sessionId: "forged", revision: 4 } },
    }),
    /inspection 不一致/,
  );
})();

(function testDesktopActionBarRendersProjectionAndSubmitsThroughInputPort() {
  const createButton = () => ({
    disabled: false,
    title: "",
    dataset: {},
    attributes: {},
    classList: { toggle() {}, add() {} },
    setAttribute(name, value) { this.attributes[name] = String(value); },
  });
  const trade = createButton();
  trade.dataset.quickTrade = "energy";
  const quickTrade = standard("quick_trade", "quick", "trade");
  quickTrade.target = { tradeId: "energy" };
  const sourceProjection = browserProjection({
    controls: {
      ...projection().controls,
      quickActions: [quickTrade],
    },
  });
  const dto = actionBar.selectActionBarProjection(sourceProjection, {
    inspection: {
      session: {
        sessionId: "s1",
        revision: 4,
        controls: { canUndo: true },
      },
    },
  });
  let currentDto = dto;
  const calls = [];
  const els = {
    actionLaunchButton: createButton(), actionOrbitButton: createButton(), actionLandButton: createButton(),
    actionScanButton: createButton(), actionAnalyzeButton: createButton(), actionPlayCardButton: createButton(),
    actionResearchTechButton: createButton(), actionPassButton: createButton(), actionConfirmButton: createButton(),
    actionUndoButton: createButton(), actionQuickButton: createButton(),
    quickActionsPanel: { hidden: true },
    quickActionsTrades: { querySelectorAll: () => [trade] },
  };
  const controller = actionBar.createDesktopActionBarController({
    els,
    getProjection: () => currentDto,
    dispatchIntent: (intent) => (calls.push(intent), { ok: true }),
    syncFinalResultButton() {},
    cancelHandCardContextActions() {},
  });
  controller.updateActionButtons();
  assert.equal(els.actionLaunchButton.disabled, false);
  assert.equal(els.actionScanButton.disabled, true);
  assert.equal(els.actionPassButton.disabled, false);
  assert.equal(els.actionConfirmButton.disabled, false);
  assert.equal(els.actionUndoButton.disabled, false);
  controller.setQuickPanelOpen(true);
  assert.equal(els.quickActionsPanel.hidden, false);
  assert.equal(trade.disabled, false);
  assert.equal(trade.dataset.actionId, "quick_trade:trade");
  assert.equal(controller.activateAction(trade.dataset.actionId).ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "action");
  assert.equal(calls[0].action.actionId, "quick_trade:trade");
  calls[0].action.target.tradeId = "forged";
  assert.equal(dto.controls.quickActions[0].target.tradeId, "energy");

  currentDto = actionBar.selectActionBarProjection(sourceProjection, {
    machineControlled: true,
    automationPaused: false,
  });
  controller.updateActionButtons();
  assert.equal(els.actionLaunchButton.disabled, true);
  assert.equal(els.actionLaunchButton.title, "电脑玩家自动行动中");

  currentDto = actionBar.selectActionBarProjection(sourceProjection, {
    machineControlled: true,
    automationPaused: true,
    canUndo: true,
  });
  controller.updateActionButtons();
  assert.equal(els.actionLaunchButton.disabled, false);
  assert.equal(els.actionUndoButton.disabled, false);
})();

(function testUndoControllerOwnsQuickPreCommandsAndMainRollback() {
  const calls = [];
  let flow = {
    historySource: "quick",
    label: "交换奖励",
    preHistoryCommandsApplied: false,
    preHistoryCommands: [
      { undo() { calls.push("undo:first"); } },
      { undo() { calls.push("undo:second"); } },
    ],
  };
  let actionPending = false;
  const actionHistory = {
    hasUndoableStep: () => false,
    hasSession: () => actionPending,
    peekLastUndoableStep: () => null,
    rollbackSession() { calls.push("rollback"); return { ok: true, message: "已撤销行动" }; },
  };
  const quickActionHistory = {
    hasUndoableStep: () => false,
    hasSession: () => true,
    commitSession() { calls.push("commit:quick"); },
  };
  const controller = actionBar.createUndoController({
    actionHistory,
    quickActionHistory,
    HISTORY_SOURCE_MAIN: "main",
    HISTORY_SOURCE_QUICK: "quick",
    uiRuntimeState: { effectStepActive: true },
    isTechActionSelectionActive: () => false,
    getActionEffectFlow: () => flow,
    isActionPending: () => actionPending,
    isActionEffectFlowActive: () => Boolean(flow),
    hasActivePendingSubFlow: () => false,
    getLatestUndoSource: () => null,
    hasCurrentMainActionIrreversibleBarrier: () => false,
    clearHistoryStepOrderForSource: (source) => calls.push(`clear-order:${source}`),
    clearActionEffectFlow() { flow = null; calls.push("clear-flow"); },
    refreshAfterHistoryChange: (message) => calls.push(`refresh:${message}`),
    peekCompletedEffectFlowForUndo: () => null,
    removeActionLogStepsBySource: (source) => calls.push(`remove-log:${source}`),
    clearActionPending: () => calls.push("clear-pending"),
  });
  const workingRoot = { rocketState: {}, techGameState: { ui: {} } };
  controller.undoPendingActionForRoot(workingRoot);
  assert.deepEqual(calls, [
    "undo:second", "undo:first", "commit:quick", "clear-order:quick",
    "clear-flow", "refresh:已撤销：交换奖励",
  ]);

  calls.length = 0;
  actionPending = true;
  controller.undoPendingActionForRoot(workingRoot);
  assert.deepEqual(calls, [
    "rollback", "clear-order:main", "remove-log:main", "clear-flow",
    "clear-pending", "refresh:已撤销行动",
  ]);
})();

(function testLegacyUndoControllerReportsIrreversibleBarrier() {
  const calls = [];
  const controller = actionBar.createUndoController({
    actionHistory: { hasUndoableStep: () => false, hasSession: () => true, peekLastUndoableStep: () => null },
    quickActionHistory: { hasUndoableStep: () => false },
    HISTORY_SOURCE_MAIN: "main",
    HISTORY_SOURCE_QUICK: "quick",
    uiRuntimeState: {},
    isTechActionSelectionActive: () => false,
    getActionEffectFlow: () => null,
    isActionPending: () => true,
    isActionEffectFlowActive: () => false,
    hasActivePendingSubFlow: () => false,
    getLatestUndoSource: () => null,
    hasCurrentMainActionIrreversibleBarrier: () => true,
    getCurrentActionIrreversibleReason: () => "已翻开隐藏牌",
    updateActionButtons: () => calls.push("buttons"),
    renderStateReadout: () => calls.push("readout"),
  });
  const workingRoot = { rocketState: {}, techGameState: { ui: {} } };
  controller.undoPendingActionForRoot(workingRoot);
  assert.equal(workingRoot.rocketState.statusNote, "不可撤销：已翻开隐藏牌");
  assert.deepEqual(calls, ["buttons", "readout"]);
})();

(function testLegacyEffectBarRendersProjectionModel() {
  const createNode = () => ({
    children: [], dataset: {}, classList: { toggle() {} },
    append(...children) { this.children.push(...children); },
    setAttribute() {},
  });
  const list = createNode();
  list.replaceChildren = function replaceChildren(...children) { this.children = children; };
  const bar = { hidden: true };
  const skip = createNode();
  const renderer = actionBar.createEffectBarRenderer({
    document: { createElement: createNode },
    els: { actionEffectBar: bar, actionEffectList: list, actionEffectSkipButton: skip },
  });
  renderer.render({
    flow: { effects: [{ id: "e1", status: "active", label: "移动", badge: "2", options: {} }] },
    current: { id: "e1", status: "active", options: {} },
    cardMove: null,
    shouldRender: () => true,
    getTooltip: () => "移动提示",
    getIcon: () => "move.png",
  });
  assert.equal(bar.hidden, false);
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[1].textContent, "2");
  assert.equal(skip.hidden, false);
})();

(function testLegacyEffectBarPresentationOwnsCostAndIconFormatting() {
  const createNode = () => ({
    children: [], dataset: {}, classList: { toggle() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {},
  });
  const list = createNode();
  const presentation = actionBar.createEffectBarPresentation({
    document: { createElement: createNode },
    els: { actionEffectBar: { hidden: true }, actionEffectList: list, actionEffectSkipButton: createNode() },
    players: { formatResourceCost: (cost) => `${cost.energy}能量` },
    resourceIconSrc: { cost: "cost.png", score: "score.png" },
    getActionEffectFlow: () => ({ effects: [{ id: "e1", label: "奖励", icon: "score", status: "active", options: { cost: { energy: 1 } } }] }),
    getCurrentActionEffect: () => ({ id: "e1", label: "奖励", icon: "score", status: "active", options: { cost: { energy: 1 } } }),
    getPendingCardMoveDecision: () => null,
    getEffectOwnerPlayer: () => null,
    resolvePlayerReference: () => null,
    isAiPlayer: () => false,
  });
  assert.deepEqual(presentation.normalizeResourceCost({ energy: "1", credit: 0 }), { energy: 1 });
  assert.equal(presentation.getTooltip({ label: "奖励", options: { cost: { energy: 1 } } }), "奖励；消耗：1能量");
  assert.equal(presentation.getDisplayIconSrc({ icon: "score", options: { cost: { energy: 1 } } }), "cost.png");
  presentation.render();
  assert.equal(list.children.length, 1);
})();

(function testActionBarPortUsesResidentController() {
  const calls = [];
  const port = actionBar.createActionBarPort({
    getController: () => ({ setQuickPanelOpen: (open) => calls.push(open) }),
  });
  port.setQuickPanelOpen(true);
  assert.deepEqual(calls, [true]);
})();

(function testActionGuardOwnsLocksAndPendingRejection() {
  const calls = [];
  let flow = { actionType: "initialIncome" };
  const els = Object.fromEntries([
    "actionPassButton", "actionConfirmButton", "actionUndoButton", "actionLaunchButton",
    "actionOrbitButton", "actionLandButton", "actionScanButton", "actionAnalyzeButton",
    "actionPlayCardButton", "actionResearchTechButton",
  ].map((key) => [key, { key }]));
  const runtime = actionBar.createActionGuardRuntime({
    getActionEffectFlow: () => flow,
    isGameEnded: () => false,
    isInitialSelectionActive: () => false,
    els,
    setTurnActionButtonState: (button) => calls.push(`turn:${button.key}`),
    setActionButtonState: (button, enabled, reason) => calls.push(`${button.key}:${enabled}:${reason}`),
    setQuickActionButtonEnabled: (enabled, reason) => calls.push(`quick:${enabled}:${reason}`),
    updateQuickPanel: () => calls.push("quick-panel"),
    renderActionEffectBar: () => calls.push("effect-bar"),
    getPendingCardCornerQuickAction: () => ({ id: "corner" }),
    cancelCardCornerQuickAction: () => calls.push("cancel-corner"),
    getPendingHandCardPlayAction: () => ({ id: "card" }),
    cancelHandCardPlayAction: () => calls.push("cancel-card"),
    hasActivePendingSubFlow: () => true,
    readPendingDecision: (kind) => kind === "industry_ability" ? { id: "industry" } : null,
    isIndustryHandSelectionActive: () => false,
    renderStateReadout: () => calls.push("readout"),
    inputPort: { checkPending: (actionType) => actionType },
  });
  assert.equal(runtime.isActionEffectFlowActive(), true);
  assert.equal(runtime.getGameplayLockReason(), "请先完成初始收入增加");
  runtime.lockAllActionButtons("locked");
  assert.ok(calls.includes("actionLaunchButton:false:locked"));
  const root = { rocketState: {} };
  assert.equal(runtime.blockIncompatiblePendingQuickActionForRoot(root, "scan").ok, false);
  assert.equal(root.rocketState.statusNote, "请先完成或取消公司 1x 行动");
  assert.ok(calls.includes("cancel-corner"));
  assert.ok(calls.includes("cancel-card"));
  assert.equal(runtime.blockIncompatiblePendingQuickAction("scan"), "scan");
  flow = null;
  assert.equal(runtime.isInitialIncomeFlowActive(), false);
})();

(function testHistoryRefreshRuntimeCallsEveryViewOwner() {
  const calls = [];
  const context = new Proxy({
    setBrowserStatusNote: (message) => calls.push(`status:${message}`),
    refreshActionState: (options) => calls.push(`action:${options.includeStateReadout}`),
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return () => calls.push(String(key));
    },
  });
  actionBar.createHistoryRefreshRuntime(context).refreshAfterHistoryChange("已撤销");
  assert.ok(calls.includes("renderSectorNebulaDataBoard"));
  assert.ok(calls.includes("syncPlanetOrbitLandMarkers"));
  assert.ok(calls.includes("status:已撤销"));
  assert.ok(calls.includes("action:true"));
})();

console.log("browser action bar projection/input tests passed");

"use strict";

const assert = require("node:assert/strict");
const actionLogRuntime = require("./action-log-runtime");

const actionLogState = {
  entries: [],
  draft: null,
  nextEntryId: 1,
};

const draft = actionLogRuntime.ensureDraft(actionLogState, {
  roundNumber: 3,
  turnNumber: 5,
  currentPlayerId: "player-white",
  getActionCycleNumber: () => 2,
  getPlayerLabelById: (playerId) => (playerId === "player-white" ? "白色玩家" : "未知玩家"),
  getActionLogActionLabel: (actionType, label) => label || `标签:${actionType}`,
  historySourceQuick: "quick",
  defaultQuickLabel: "快速行动",
}, {
  source: "main",
  actionType: "scan",
  label: "扫描行动",
});

assert.equal(draft.playerLabel, "白色玩家");
assert.equal(draft.actionType, "scan");
assert.equal(draft.actionLabel, "扫描行动");

const step = actionLogRuntime.normalizeStep("main", "扫描", "扫描：星云", {
  irreversibleReason: "翻出新牌",
  playedCard: { id: "card-1", label: "轨道实验室" },
  briefing: {
    scanTargets: [
      { x: 9, nebulaId: "nb-1", label: "一号星云" },
      { x: null, nebulaId: "", label: "" },
    ],
  },
  getCardLabel: (card) => card.label,
  normalizeSectorX: (x) => x % 8,
});

assert.deepEqual(step, {
  stepId: null,
  source: "main",
  text: "扫描：星云",
  label: "扫描",
  detail: "扫描：星云",
  undoable: true,
  irreversibleCode: null,
  irreversibleReason: "翻出新牌",
  playedCard: {
    id: "card-1",
    cardId: null,
    label: "轨道实验室",
    cardName: "轨道实验室",
    src: null,
  },
  briefing: {
    scanTargets: [
      { x: 1, nebulaId: "nb-1", label: "一号星云" },
    ],
  },
});

draft.steps.push(step);

const entry = actionLogRuntime.createEntryFromDraft(actionLogState, {
  getDisplayedTurnNumber: (turnNumber) => turnNumber + 1,
  getActionCycleNumber: () => 2,
  getActionLogActionLabel: (actionType, label) => label || `标签:${actionType}`,
}, {});

assert.equal(entry.id, 1);
assert.equal(entry.turnNumber, 6);
assert.equal(entry.actionType, "scan");
assert.equal(entry.steps.length, 1);

const importState = {
  entries: [],
  draft: { stale: true },
  nextEntryId: 1,
};
actionLogRuntime.importEntries(importState, [
  { id: 1, actionLabel: "A" },
  { id: 2, actionLabel: "B" },
  { id: null, actionLabel: "bad" },
], { truncateToEntryId: 1 });

assert.equal(importState.entries.length, 1);
assert.equal(importState.entries[0].id, 1);
assert.equal(importState.nextEntryId, 2);
assert.equal(importState.draft, null);

{
  const state = { entries: [], draft: null, nextEntryId: 1 };
  const calls = [];
  const player = {
    id: "p1",
    resources: { credits: 1 },
    income: { credits: 0 },
    completedTaskCount: 0,
  };
  const controller = actionLogRuntime.createActionLogController({
    actionLogState: state,
    actionHistory: { hasSession: () => false },
    quickActionHistory: { hasSession: () => false },
    historySourceMain: "main",
    historySourceQuick: "quick",
    resourceKeys: ["credits"],
    incomeKeys: ["credits"],
    incomeLabels: { credits: "信用点" },
    deltaUnits: { credits: "信用点" },
    defaultLabels: { scan: "扫描", quick: "快速行动" },
    getCurrentPlayer: () => player,
    createReadoutRoot: () => ({
      playerState: { currentPlayerId: "p1" },
      turnState: { roundNumber: 1, turnNumber: 2 },
    }),
    getPlayerLabelById: () => "白色玩家",
    getActionCycleNumber: () => 1,
    getCardLabel: (card) => card.label,
    normalizeSectorX: (x) => x,
    getNebulaLabel: (id) => id,
    cancelHandCardContextActions: () => calls.push("cancel-hand"),
    isActionPending: () => false,
    resetActionBriefingState: () => calls.push("reset-briefing"),
    renderActionLog: () => calls.push("render"),
  });
  controller.startActionLogDraft("scan", null, { source: "main" });
  player.resources.credits = 3;
  controller.appendActionLogStep("main", "扫描", null, {
    logBefore: { playerId: "p1", resources: { credits: 1 }, income: { credits: 0 }, completedTaskCount: 0 },
  });
  assert.equal(state.draft.actionLabel, "扫描");
  assert.equal(controller.composeActionLogDetailWithImpact(null, {
    label: "扫描",
    logBefore: { playerId: "p1", resources: { credits: 1 }, income: { credits: 0 }, completedTaskCount: 0 },
  }), "资源：信用点+2");
  assert.deepEqual(calls, ["cancel-hand", "render"]);
  controller.removeActionLogStepsBySource("main");
  assert.equal(state.draft, null);
  controller.resetActionLog();
  assert.deepEqual(calls.slice(-3), ["render", "reset-briefing", "render"]);
}

{
  const state = { entries: [], draft: null, nextEntryId: 1 };
  const calls = [];
  const controller = actionLogRuntime.createActionLogController({
    actionLogState: state,
    actionHistory: { hasSession: () => false },
    quickActionHistory: { hasSession: () => false },
    historySourceMain: "main",
    historySourceQuick: "quick",
    resourceKeys: [], incomeKeys: [], defaultLabels: { launch: "发射" },
    getCurrentPlayer: () => ({ id: "p1" }),
    createReadoutRoot: () => ({
      playerState: { currentPlayerId: "p1" },
      turnState: { roundNumber: 1, turnNumber: 2 },
    }),
    getPlayerLabelById: () => "白色玩家",
    getActionCycleNumber: () => 1,
    getDisplayedTurnNumber: (turn) => turn + 1,
    cancelHandCardContextActions() {},
    isActionPending: () => false,
    renderActionLog: () => calls.push("render"),
    attachRecoverySnapshot(entry, label) { entry.recoverySnapshot = { label }; calls.push("attach"); },
    rememberActionBriefingEntry: () => calls.push("briefing"),
    schedulePersistentGameStateSave: () => calls.push("save"),
  });
  controller.startActionLogDraft("launch", null, { source: "main" });
  controller.appendActionLogStep("main", "发射火箭");
  const committed = controller.commitActionLogDraft();
  assert.equal(committed.turnNumber, 3);
  assert.equal(state.entries.length, 1);
  assert.equal(state.nextEntryId, 2);
  const confirmed = controller.appendConfirmedActionLogEntry({
    title: "初始选择", actionType: "initialSelection", steps: [{ label: "选择公司" }],
  });
  assert.equal(confirmed.id, 2);
  assert.equal(state.entries.length, 2);
  assert.deepEqual(calls.filter((call) => call !== "render"), ["attach", "briefing", "save", "attach", "briefing", "save"]);
}

function createViewElement() {
  return {
    children: [],
    dataset: {},
    className: "",
    classList: { contains() { return false; }, toggle() {} },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute() {},
  };
}

{
  const actionLogReadout = createViewElement();
  const document = {
    createElement: createViewElement,
    createTextNode(text) { return { textContent: text }; },
  };
  const state = {
    entries: [{
      id: 7,
      roundNumber: 2,
      turnNumber: 3,
      playerLabel: "白色玩家",
      actionType: "scan",
      actionLabel: "扫描",
      steps: [{ source: "main", text: "扫描星云", undoable: true }],
    }],
    activeReportTab: "action",
  };
  const view = actionLogRuntime.createActionLogViewRuntime({
    document,
    els: { actionLogReadout, appWrap: createViewElement() },
    players: { CARD_BACK_SRC: "back.png" },
    uiRuntimeState: {},
    actionLogState: state,
    historySourceMain: "main",
    sourceLabels: {},
    attachCardHoverPreview() {},
  });

  view.renderActionLog();
  assert.equal(actionLogReadout.children.length, 1);
  assert.equal(actionLogReadout.children[0].className, "action-log-list");
  assert.equal(actionLogReadout.children[0].children[0].dataset.actionLogId, "7");
}

console.log("action-log-runtime tests passed");

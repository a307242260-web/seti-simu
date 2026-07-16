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

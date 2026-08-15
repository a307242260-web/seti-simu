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

// 公司 1x 行动按钮：updateQuickPanel 必须写入当前公司主动能力 tooltip
function fakeButton() {
  return {
    disabled: false,
    dataset: {},
    title: "",
    ariaLabel: "",
    setAttribute(name, value) {
      if (name === "aria-label") this.ariaLabel = value;
      else this.dataset[name] = value;
    },
    removeAttribute(name) {
      if (name === "title") this.title = "";
      else delete this.dataset[name];
    },
  };
}
const placeDataButton = fakeButton();
const industryButton = fakeButton();
const quickActionsTrades = {
  querySelectorAll(selector) {
    if (selector === "[data-quick-trade]") return [];
    if (selector === '[data-quick-action="industry"]') return [industryButton];
    if (selector === "[data-quick-action]") return [placeDataButton, industryButton];
    return [];
  },
};
const quickActionsPanel = { hidden: false };
const actionQuickButton = { disabled: false, title: "", setAttribute() {} };
const els = { quickActionsTrades, quickActionsPanel, actionQuickButton };
const desktop = actionBar.createDesktopActionBarController({
  els,
  getProjection() {
    return actionBar.selectActionBarProjection(browserProjection);
  },
  dispatchIntent: () => ({ ok: true }),
  getViewerCompany() {
    return "寰宇动力";
  },
});
desktop.updateQuickPanel();
assert.equal(
  industryButton.dataset.tooltip,
  "寰宇动力：两次各 1 移动力，必须选择不同火箭",
);
assert.equal(industryButton.title, "");
assert.match(industryButton.ariaLabel, /寰宇动力/);
// 无公司信息时不写 tooltip
const noCompany = actionBar.createDesktopActionBarController({
  els,
  getProjection() {
    return actionBar.selectActionBarProjection(browserProjection);
  },
  dispatchIntent: () => ({ ok: true }),
  getViewerCompany() {
    return null;
  },
});
noCompany.updateQuickPanel();
assert.equal(Object.hasOwn(industryButton.dataset, "tooltip"), false);
console.log("action bar tests passed");

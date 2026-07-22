"use strict";

const assert = require("node:assert/strict");
const {
  normalizeAiDifficulty,
  normalizeStartPlayerCount,
  syncStartScreenIndustryOptions,
  createInitialSelectionUi,
  createInitialSelectionReadout,
  createInitialSelectionHost,
  createStartScreenController,
} = require("./start-screen");

assert.equal(normalizeAiDifficulty("weak_start"), "weak_start");
assert.equal(normalizeAiDifficulty("other"), "laughable");
assert.equal(normalizeStartPlayerCount("3", 4), 3);
assert.equal(normalizeStartPlayerCount("2", 4), 4);

{
  const commands = [];
  const runtime = {
    getInitialSelectionPlayerIds: (root) => root.turnState.activePlayerIds,
    isInitialSelectionActive: () => true,
    getInitialSelectionOffer: (playerId) => ({ playerId }),
    isInitialSelectionConfirmed: (playerId) => playerId === "p2",
    canConfirmInitialSelection: (offer) => offer.playerId === "p1",
    getCardFromInitialOffer: (_offer, kind, cardId) => ({ kind, cardId }),
  };
  const host = createInitialSelectionHost({
    getActionRuntime: () => runtime,
    getRuleReadout: () => ({
      playerState: { currentPlayerId: "p1" },
      turnState: { activePlayerIds: ["p1", "p2"] },
    }),
    submitHostCommand: (command) => commands.push(command),
  });
  assert.deepEqual(host.getPlayerIds(), ["p1", "p2"]);
  assert.equal(host.getOffer().playerId, "p1");
  assert.equal(host.isConfirmed("p2"), true);
  assert.equal(host.canConfirm({ playerId: "p1" }), true);
  assert.deepEqual(host.getCardFromOffer({}, "initial", "c1"), { kind: "initial", cardId: "c1" });
  host.start();
  host.selectCard("industry", "i1");
  host.confirm();
  assert.deepEqual(commands.map((command) => command.kind), [
    "setup_start_initial_selection",
    "setup_select_initial_card",
    "setup_confirm_initial_selection",
  ]);
}

function createCheckbox({ checked, label }) {
  return {
    checked,
    disabled: false,
    dataset: { startIndustryLabel: label },
    closest() {
      return { classList: { toggle() {} } };
    },
  };
}

const startScreenState = {};
const selectedIndustryLabels = syncStartScreenIndustryOptions({
  checkboxes: [
    createCheckbox({ checked: true, label: "层云核心" }),
    createCheckbox({ checked: false, label: "图灵系统" }),
  ],
  startScreenState,
  industryCardFiles: ["层云核心.png", "图灵系统.png", "深空探测.png"],
  minSelected: 2,
});
assert.deepEqual(selectedIndustryLabels, ["层云核心", "图灵系统", "深空探测"]);
assert.deepEqual(startScreenState.selectedIndustryLabels, ["层云核心", "图灵系统", "深空探测"]);

function createElement(tagName) {
  return {
    tagName,
    className: "",
    textContent: "",
    dataset: {},
    children: [],
    listeners: {},
    classList: { toggle() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {},
    addEventListener(name, handler) { this.listeners[name] = handler; },
  };
}

const initialSelectionCalls = [];
const initialSelectionUi = createInitialSelectionUi({
  document: { createElement },
  requiredInitialCards: 2,
  canConfirm: () => true,
  confirmSelection: () => initialSelectionCalls.push("confirm"),
  selectCard: (kind, id) => initialSelectionCalls.push(`${kind}:${id}`),
  attachCardHoverPreview: () => initialSelectionCalls.push("hover"),
});
const initialSelectionPicker = initialSelectionUi.createPicker({
  confirmed: false,
  industryOptions: [{ id: "company", label: "公司", src: "company.png", kind: "industry" }],
  initialOptions: [
    { id: "start-a", label: "A", src: "a.png", kind: "initial" },
    { id: "start-b", label: "B", src: "b.png", kind: "initial" },
    { id: "start-c", label: "C", src: "c.png", kind: "initial" },
  ],
  selectedIndustryId: "company",
  selectedInitialIds: ["start-a", "start-b"],
});
const initialRow = initialSelectionPicker.children[1].children[1];
assert.equal(initialRow.children[2].disabled, true);
initialRow.children[0].listeners.click();
initialSelectionPicker.children[2].children[1].listeners.click();
assert.deepEqual(initialSelectionCalls.slice(-2), ["initial:start-a", "confirm"]);
assert.equal(initialSelectionUi.createCardImage({ src: "a.png", label: "A" }, "summary").className.includes("summary"), true);

const getInitialSelectionReadoutLines = createInitialSelectionReadout({
  state: { phase: "selecting", currentPlayerId: "p1" },
  getPlayerIds: () => ["p1"],
  getPlayerLabel: () => "蓝色玩家",
  getPlayer: () => ({ initialSelection: null }),
  getOffer: () => ({
    selectedIndustryId: "company",
    selectedInitialIds: ["start-a", "start-b"],
  }),
  getCardFromOffer: (_offer, kind, id) => ({ label: kind === "industry" ? "公司" : id.toUpperCase() }),
  isConfirmed: () => false,
});
assert.deepEqual(getInitialSelectionReadoutLines(), [
  "初始选择",
  "状态=选择中 当前=蓝色玩家",
  "蓝色玩家 公司=公司 初始牌=START-A、START-B 确认=否",
]);

const callLog = [];
const controller = createStartScreenController({
  startScreenState: {
    aiDifficulty: "laughable",
    activePlayerCount: 4,
    actionBriefingEnabled: true,
    debugToolsEnabled: false,
  },
  els: {
    startAiDifficulty: { value: "weak_start" },
    startPlayerCount: { value: "3" },
    startActionLogEnabled: { checked: false },
    startActionLogToggleText: { textContent: "" },
    startDebugEnabled: { checked: true },
    startDebugToggleText: { textContent: "" },
    appWrap: { classList: { toggle() {} } },
    startAlienCheckboxes: [],
    startIndustryCheckboxes: [],
    startScreen: {
      hidden: false,
      setAttribute(name, value) {
        this[name] = value;
      },
    },
    startScreenContinueButton: {
      hidden: false,
      disabled: false,
      setAttribute(name, value) {
        this[name] = value;
      },
    },
  },
  actionLogState: { activeReportTab: "state" },
  alienTypeIds: [],
  industryCardFiles: [],
  continueEnabled: true,
  hasPersistentGameState: () => true,
  restorePersistentGameState: () => ({ ok: true, message: "恢复成功" }),
  refreshAfterGameRecovery: (message) => callLog.push(["refresh", message]),
  schedulePersistentGameStateSave: (options) => callLog.push(["save", options.label]),
  closeActionBriefing: () => callLog.push(["closeActionBriefing"]),
  setDebugOpen: (value) => callLog.push(["setDebugOpen", value]),
  setReportTab: (tab) => callLog.push(["setReportTab", tab]),
  resize: () => callLog.push(["resize"]),
  setLogOpen: (value) => callLog.push(["setLogOpen", value]),
  startNewGame: (options) => callLog.push(["startNewGame", options]),
});

controller.startNewGameFromStartScreen();
assert.deepEqual(callLog, [
  ["closeActionBriefing"],
  ["setReportTab", "state"],
  ["resize"],
  ["startNewGame", {
    activePlayerCount: 3,
    aiDifficulty: "weak_start",
    clearStorage: true,
    message: "新游戏已开始，请完成初始选择。",
  }],
  ["setLogOpen", false],
  ["resize"],
]);

callLog.length = 0;
controller.continueGameFromStartScreen();
assert.deepEqual(callLog, [
  ["closeActionBriefing"],
  ["setReportTab", "state"],
  ["resize"],
  ["setLogOpen", false],
  ["resize"],
  ["refresh", "恢复成功"],
  ["save", "继续后状态"],
]);

console.log("start-screen tests passed");

"use strict";

const assert = require("node:assert/strict");
const {
  normalizeAiDifficulty,
  normalizeStartPlayerCount,
  syncStartScreenIndustryOptions,
  createStartScreenController,
} = require("./start-screen");

assert.equal(normalizeAiDifficulty("weak_start"), "weak_start");
assert.equal(normalizeAiDifficulty("other"), "laughable");
assert.equal(normalizeStartPlayerCount("3", 4), 3);
assert.equal(normalizeStartPlayerCount("2", 4), 4);

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

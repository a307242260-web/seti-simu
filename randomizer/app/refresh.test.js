"use strict";

const assert = require("node:assert/strict");
const { createRefreshHelpers } = require("./refresh");

const calls = [];
const helpers = createRefreshHelpers({
  renderPlayerStats: () => calls.push("renderPlayerStats"),
  renderAlienPanels: () => calls.push("renderAlienPanels"),
  renderRockets: () => calls.push("renderRockets"),
  renderActionEffectBar: () => calls.push("renderActionEffectBar"),
  updateQuickPanel: () => calls.push("updateQuickPanel"),
  updateActionButtons: () => calls.push("updateActionButtons"),
  renderStateReadout: () => calls.push("renderStateReadout"),
  renderTechBoard: () => calls.push("renderTechBoard"),
  renderSectorNebulaDataBoard: () => calls.push("renderSectorNebulaDataBoard"),
  renderFinalScoreBoard: () => calls.push("renderFinalScoreBoard"),
  renderRunezuBoardSymbols: () => calls.push("renderRunezuBoardSymbols"),
});

helpers.refreshPlayerPanels();
assert.deepEqual(calls.splice(0), [
  "renderAlienPanels",
  "renderRockets",
  "renderPlayerStats",
]);

helpers.refreshActionState();
assert.deepEqual(calls.splice(0), [
  "updateQuickPanel",
  "renderActionEffectBar",
  "updateActionButtons",
  "renderStateReadout",
]);

helpers.refreshBoardState({ includeRunezuSymbols: true, includeStateReadout: true });
assert.deepEqual(calls.splice(0), [
  "renderSectorNebulaDataBoard",
  "renderRunezuBoardSymbols",
  "renderTechBoard",
  "renderFinalScoreBoard",
  "renderStateReadout",
]);

helpers.refreshAfterPendingChange({ includeQuickPanel: false, includeEffectBar: false });
assert.deepEqual(calls.splice(0), [
  "updateActionButtons",
  "renderStateReadout",
]);

console.log("refresh tests passed");

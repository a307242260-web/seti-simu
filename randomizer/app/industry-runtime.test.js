"use strict";

const assert = require("node:assert/strict");
const { createIndustryRuntime } = require("./industry-runtime.js");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store.js");

function noop() {}

function createHarness() {
  const calls = [];
  const decisionSessions = createDecisionSessionStore();
  decisionSessions.open("industry_ability", { flowType: "deepspace_swap" });
  const pendingState = {
    cardSelectionAction: {
      type: "industry_deepspace_hand",
      player: { id: "p1" },
      refundCost: { publicity: 1 },
    },
    discardAction: { type: "industry_helios_income" },
    scanTargetAction: { type: "industry_remove_tech" },
  };
  const uiRuntimeState = {
    effectStepActive: true,
    industryFreeMoveState: { movesLeft: 1 },
    moveHighlightRocketId: 4,
  };
  const techGameState = { ui: { industryBorrowMode: true } };
  const quickActionHistory = {
    hasSession: () => true,
    undoLastStep: () => ({ ok: true, step: { id: "step-1" } }),
    hasUndoableStep: () => false,
    commitSession: () => calls.push("commit"),
  };
  const context = {
    Array,
    Boolean,
    Number,
    Object,
    Set,
    String,
    HISTORY_SOURCE_QUICK: "quick",
    cardState: {},
    cards: {
      setDiscardSelectionActive: () => calls.push("discard-off"),
      setSelectionActive: () => calls.push("selection-off"),
    },
    clearHistoryStepOrderForSource: (source) => calls.push(`clear:${source}`),
    deactivateMoveMode: () => calls.push("move-off"),
    decisionSessions,
    els: {
      scanTargetOverlay: { hidden: false },
      scanTargetCancel: { hidden: true },
    },
    forgetLastHistoryStep: (source, id) => calls.push(`forget:${source}:${id}`),
    pendingState,
    players: {
      gainResources: (_player, gain) => calls.push(`refund:${gain.publicity}`),
    },
    quickActionHistory,
    removeLastActionLogStep: (source, id) => calls.push(`log:${source}:${id}`),
    renderInitialSelectionArea: noop,
    renderPlayerHand: noop,
    renderPlayerStats: noop,
    renderPublicCards: noop,
    renderRockets: noop,
    renderStateReadout: noop,
    rocketState: { statusNote: "" },
    syncCardSelectionChrome: noop,
    syncDiscardSelectionChrome: noop,
    syncIndustryHandSelectionChrome: noop,
    syncInteractionFocusChrome: noop,
    syncTechSelectionChrome: noop,
    tech: {
      setTechSelectionActive: (_state, active) => calls.push(`tech:${active}`),
    },
    techGameState,
    uiRuntimeState,
    updateActionButtons: noop,
  };
  return { calls, context, decisionSessions, pendingState, techGameState, uiRuntimeState };
}

{
  const harness = createHarness();
  const runtime = createIndustryRuntime(harness.context);
  const result = runtime.rollbackPendingIndustryQuickAction();

  assert.equal(result.ok, true);
  assert.equal(harness.decisionSessions.peek("industry_ability"), null);
  assert.equal(harness.pendingState.cardSelectionAction, null);
  assert.equal(harness.pendingState.discardAction, null);
  assert.equal(harness.pendingState.scanTargetAction, null);
  assert.equal(harness.techGameState.ui.industryBorrowMode, false);
  assert.equal(harness.uiRuntimeState.industryFreeMoveState, null);
  assert.equal(harness.uiRuntimeState.effectStepActive, false);
  assert.equal(harness.context.rocketState.statusNote, "已取消公司 1x 行动");
  assert.ok(harness.calls.includes("forget:quick:step-1"));
  assert.ok(harness.calls.includes("log:quick:step-1"));
  assert.ok(harness.calls.includes("commit"));
}

{
  const harness = createHarness();
  const runtime = createIndustryRuntime(harness.context);

  runtime.cancelIndustryAbilityFlow();

  assert.equal(harness.pendingState.cardSelectionAction, null);
  assert.equal(harness.decisionSessions.peek("industry_ability"), null);
  assert.equal(harness.techGameState.ui.industryBorrowMode, false);
  assert.equal(harness.uiRuntimeState.industryFreeMoveState, null);
  assert.ok(harness.calls.includes("refund:1"));
  assert.ok(harness.calls.includes("move-off"));
}

console.log("industry runtime tests passed");

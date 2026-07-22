"use strict";

const assert = require("node:assert/strict");
const { createIndustryRuntime } = require("./industry-runtime.js");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store.js");
const { attachDecisionState } = require("./test-decision-state");

function noop() {}

function createHarness() {
  const calls = [];
  const decisionSessions = createDecisionSessionStore();
  const pendingState = {
    discardAction: { type: "industry_helios_income" },
  };
  attachDecisionState(pendingState, decisionSessions);
  const uiRuntimeState = {
    effectStepActive: true,
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
      getCurrentPlayer: (state) => state.players.find((player) => player.id === state.currentPlayerId) || null,
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
  const workingRoot = {
    match: {
      cardSelectionContinuation: {
        type: "industry_deepspace_hand",
        playerId: "p1",
        refundCost: { publicity: 1 },
      },
      discardContinuation: { type: "industry_helios_income" },
      industryAbilityContinuation: { flowType: "deepspace_swap" },
      scanTargetContinuation: { type: "industry_remove_tech" },
      industryFreeMoveContinuation: { playerId: "p1", movesLeft: 1, movedRocketIds: [] },
    },
    cardState: context.cardState,
    playerState: { currentPlayerId: "p1", players: [{ id: "p1", resources: {} }] },
    rocketState: context.rocketState,
    techGameState,
    turnState: { roundNumber: 1, turnNumber: 1 },
  };
  return { calls, context, decisionSessions, pendingState, techGameState, uiRuntimeState, workingRoot };
}

{
  const harness = createHarness();
  const runtime = createIndustryRuntime(harness.context);
  const result = runtime.rollbackPendingIndustryQuickAction(harness.workingRoot);

  assert.equal(result.ok, true);
  assert.equal(harness.workingRoot.match.industryAbilityContinuation, null);
  assert.equal(harness.workingRoot.match.cardSelectionContinuation, undefined);
  assert.equal(harness.workingRoot.match.discardContinuation, undefined);
  assert.equal(harness.workingRoot.match.scanTargetContinuation, undefined);
  assert.equal(harness.techGameState.ui.industryBorrowMode, false);
  assert.equal(harness.workingRoot.match.industryFreeMoveContinuation, null);
  assert.equal(harness.uiRuntimeState.effectStepActive, false);
  assert.equal(harness.context.rocketState.statusNote, "已取消公司 1x 行动");
  assert.ok(harness.calls.includes("forget:quick:step-1"));
  assert.ok(harness.calls.includes("log:quick:step-1"));
  assert.ok(harness.calls.includes("commit"));
}

{
  const harness = createHarness();
  const runtime = createIndustryRuntime(harness.context);

  runtime.cancelIndustryAbilityFlow(harness.workingRoot);

  assert.equal(harness.workingRoot.match.cardSelectionContinuation, undefined);
  assert.equal(harness.workingRoot.match.industryAbilityContinuation, null);
  assert.equal(harness.techGameState.ui.industryBorrowMode, false);
  assert.equal(harness.workingRoot.match.industryFreeMoveContinuation, null);
  assert.ok(harness.calls.includes("refund:1"));
  assert.ok(harness.calls.includes("move-off"));
}

{
  const harness = createHarness();
  const queriedRounds = [];
  harness.context.turnState = { roundNumber: 9, turnNumber: 8 };
  harness.context.industry = {
    isStrategyPlayInteractionActive(_player, roundNumber) {
      queriedRounds.push(roundNumber);
      return roundNumber === 2;
    },
    getStrategyPlayEligibleSlotIds(_player, roundNumber) {
      queriedRounds.push(roundNumber);
      return roundNumber === 2 ? ["slot-a"] : [];
    },
    getStrategyPlayScanCode() {
      return 1;
    },
    getAutomaticStrategyPlaySlotId(_player, roundNumber) {
      queriedRounds.push(roundNumber);
      return roundNumber === 2 ? "slot-a" : null;
    },
    getStrategyPassiveSlotLabel() {
      return "测试槽";
    },
    getStrategySlotRewardLabel() {
      return "摸牌";
    },
    getStrategySlotReward() {
      return { pickCard: 1 };
    },
  };
  const beforeBoundTurnState = structuredClone(harness.context.turnState);
  const runtime = createIndustryRuntime(harness.context);
  const result = runtime.buildIndustryPlayCardAppendEffects(
    { ...harness.workingRoot, turnState: { roundNumber: 2, turnNumber: 3 } },
    { id: "working-player" },
    { id: "working-card" },
  );

  assert.equal(result.deferredEndEffects.length, 1);
  assert.equal(result.deferredEndEffects[0].options.slotId, "slot-a");
  assert.deepEqual(queriedRounds, [2, 2, 2], "战略被动规则查询必须使用 working root 轮次");
  assert.deepEqual(
    harness.context.turnState,
    beforeBoundTurnState,
    "分离 working root 的 play_card 不得改写闭包绑定 turnState",
  );

  const isolatedRoot = structuredClone(harness.workingRoot);
  const beforeBoundPlayerState = structuredClone(harness.workingRoot.playerState);
  runtime.applyIndustryPlayCardPassives(isolatedRoot, { id: "isolated-card" }, 1);
  assert.equal(isolatedRoot.playerState.players[0].industryPlayedCardThisRound, true);
  assert.deepEqual(
    harness.workingRoot.playerState,
    beforeBoundPlayerState,
    "公司打牌被动不得读取或写入闭包 playerState",
  );
  assert.throws(
    () => runtime.applyIndustryPlayCardPassives(undefined, {}, 1),
    /explicit workingRoot/,
    "公司规则 operation 缺 root 必须立即失败",
  );
}

console.log("industry runtime tests passed");

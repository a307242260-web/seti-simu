"use strict";

const assert = require("node:assert/strict");
const { createAlienRuntimeHelpers } = require("./alien-runtime");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store");
const { attachDecisionState } = require("./test-decision-state");

function createHarness(overrides = {}) {
  const calls = {
    continueReveal: 0,
    continueTurnEnd: 0,
    openBanrenma: 0,
    actionLogs: [],
    irreversible: [],
  };
  const pendingState = {};
  const alienTraceContinuation = {
      type: "planet_reward_alien_trace",
      effectLabel: "外星人痕迹奖励",
      targetPlayerId: "p1",
      targetPlayerColor: "white",
      afterTraceReward: { kind: "traceCountScore", scorePer: 2 },
    };
  const uiRuntimeState = { alienTracePickerState: {
      targetPlayerId: "p1",
      targetPlayerColor: "white",
      allowedAlienSlotIds: [1],
      allowedTraceTypes: ["yellow"],
    } };
  const decisionSessions = createDecisionSessionStore();
  attachDecisionState(pendingState, decisionSessions);
  const player = { id: "p1", color: "white", resources: {}, hand: [] };
  const playerState = { currentPlayerId: "p1", activePlayerIds: ["p1"], players: [player] };
  const alienGameState = {
    fangzhou: {},
    aliens: {},
    yichangdian: {},
  };
  const rocketState = { statusNote: "" };
  const actionEffect = { result: null };
  const context = {
    decisionSessions,
    uiRuntimeState,
    structuredClone: global.structuredClone,
    aliens: {
      ALIEN_SLOT_IDS: [1],
      getAlienSlotLabel: (id) => `外星人 ${id}`,
      getTraceTypeLabel: (type) => ({ yellow: "黄色" }[type] || type),
      getFirstTraceRewardForSlot: () => ({ gain: { score: 1 } }),
      getExtraTraceReward: () => null,
      placeFirstTrace: () => ({ ok: true, message: "首痕迹已放置", extraOnly: false }),
      grantAlienCardsForFirstTraces: () => ({ ok: true, totalExpected: 1, totalDrawn: 1, message: "发 1 张外星人牌" }),
    },
    players: {
      getCurrentPlayer: (state) => state.players.find((entry) => entry.id === state.currentPlayerId) || null,
      gainResources(target, gain) {
        for (const [key, value] of Object.entries(gain || {})) {
          target.resources[key] = (target.resources[key] || 0) + value;
        }
      },
      canAfford: () => true,
    },
    data: {
      listNebulaTokens: () => [],
      clearNebulaData() {},
      fillNebulaData: () => ({ ok: true, message: "已补满星云数据" }),
    },
    cardEffects: {
      countTraceMarkers: () => 3,
    },
    historyCommands: {
      createRestoreObjectCommand: (target, snapshot, label) => ({ target, snapshot, label }),
    },
    aomomo: {
      ALIEN_ID: "aomomo",
      NEBULA_ID: "nebula-1",
      initializeAomomoReveal: () => ({ ok: true, message: "奥陌陌已揭示", alreadyInitialized: false }),
      getTraceReward: () => ({ pickAlienCard: true }),
      formatTraceLabel: () => "黄色 1",
      placeAomomoTrace: () => ({ ok: true, reward: { pickAlienCard: true }, message: "奥陌陌痕迹已放置" }),
    },
    banrenma: {
      ALIEN_ID: "banrenma",
      initializeBanrenmaReveal: () => ({ ok: true, message: "半人马已揭示", alreadyInitialized: false }),
      getTraceReward: () => ({}),
      formatTraceLabel: () => "黄色 2",
      placeBanrenmaTrace: () => ({ ok: true, reward: { pickAlienCard: true }, message: "半人马痕迹已放置" }),
    },
    pendingState,
    alienGameState,
    playerState,
    rocketState,
    solarState: {},
    nebulaDataState: {},
    techGameState: { board: {} },
    HISTORY_SOURCE_MAIN: "main",
    getCurrentPlayer: () => player,
    getActivePlayers: () => [player],
    getPlayerById: (id) => (id === "p1" ? player : null),
    getPlayerByColor: (color) => (color === "white" ? player : null),
    getPlayerActionLabel: () => "白色玩家",
    resolvePlayerReference: () => player,
    getEarthSectorCoordinate: () => ({ x: 2 }),
    isDebugAlienTraceMode: () => false,
    isAlienTracePickerChoiceAllowed: () => true,
    getAvailableDataTokenCount: () => 3,
    renderAlienPanels() {},
    renderPlayerStats() {},
    renderPlayerHand() {},
    renderReservedCards() {},
    renderReservedCards() {},
    renderRockets() {},
    renderStateReadout() {},
    renderWheels() {},
    renderSectorNebulaDataBoard() {},
    renderFangzhouCardDisplays() {},
    updateActionButtons() {},
    closeAlienTracePicker() {},
    clearAlienTracePlacementMode() {},
    maybeRevealAlienAfterTrace: () => ({ ok: true, alienId: "aomomo", message: "揭示奥陌陌" }),
    createActionLogImpactSnapshot: () => ({ before: true }),
    beginEffectHistoryStep() {},
    recordHistoryCommand() {},
    getCurrentActionEffect: () => actionEffect,
    completeCurrentActionEffect() {
      calls.completedEffect = true;
    },
    beginQuickActionStep() {},
    recordQuickHistoryCommand() {},
    completeQuickActionStep() {},
    settleCardTasksAfterEffect() {},
    maybeContinueAlienRevealQueuedOpportunities() {
      calls.continueReveal += 1;
    },
    maybeContinuePendingTurnEndRevealFlow() {
      calls.continueTurnEnd += 1;
    },
    markCurrentActionIrreversible(reason, code) {
      calls.irreversible.push({ reason, code });
    },
    appendActionLogStep(source, label, message) {
      calls.actionLogs.push({ source, label, message });
    },
    queueJiuzheOpportunitiesForPlayer() {},
    queueBanrenmaOpportunitiesForPlayer() {},
    recordAlienTraceScore() {},
    formatPlanetRewardGain: (gain) => `${gain.score || 0}分`,
    appendRevealCardGrantMessage: (message, grant) => `${message}${grant?.message ? `；${grant.message}` : ""}`,
    getRevealIrreversible: (reason) => (reason ? { code: "irreversible_effect", reason } : null),
    buildAlienTraceEvent: (alienSlotId, traceType) => ({ alienSlotId, traceType }),
    maybeRestoreAlienLabPanelForTrace: () => null,
    beginCardSelection() {
      calls.beginCardSelection = (calls.beginCardSelection || 0) + 1;
      return { ok: true };
    },
    enqueueFangzhouCard1RewardEffects() {},
    applyYichangdianRewardToPlayer: () => ({ ok: true, message: "异常点奖励" }),
    applyFangzhouTraceRewardToPlayer: () => ({ ok: true, message: "方舟奖励" }),
    getAlienTraceScoreSourceKey: () => "yellow",
    applyBanrenmaRewardToPlayer: () => ({ ok: true, message: "半人马奖励" }),
    applyAomomoRewardToPlayer: () => ({ ok: true, message: "奥陌陌奖励" }),
    applyChongRewardToPlayer: () => ({ ok: true, message: "虫族奖励" }),
    applyAmibaRewardToPlayer: () => ({ ok: true, message: "阿米巴奖励" }),
    applyRunezuRewardToPlayer: () => ({ ok: true, message: "符文族奖励" }),
    applyJiuzheRewardToPlayer: () => ({ ok: true, message: "九折奖励" }),
    openYichangdianCardGainDialog: () => ({ ok: true }),
    openBanrenmaCardGainDialog() {
      calls.openBanrenma += 1;
      return { ok: true };
    },
    openAomomoCardGainDialog() {
      calls.openAomomo = (calls.openAomomo || 0) + 1;
      return { ok: true };
    },
    openChongRewardFollowUps: () => false,
    openAmibaRewardFollowUps: () => false,
    openRunezuRewardFollowUps: () => false,
    isJiuzheTracePlacementMode: () => false,
    isYichangdianTracePlacementMode: () => false,
    isFangzhouTracePlacementMode: () => false,
    isBanrenmaTracePlacementMode: () => true,
    isChongTracePlacementMode: () => false,
    isAmibaTracePlacementMode: () => false,
    isAomomoTracePlacementMode: () => true,
    isRunezuTracePlacementMode: () => false,
    canPlaceJiuzheTrace: () => false,
    canPlaceYichangdianTrace: () => false,
    canPlaceFangzhouTrace: () => false,
    canPlaceBanrenmaTrace: () => true,
    canPlaceChongTrace: () => false,
    canPlaceAmibaTrace: () => false,
    canPlaceAomomoTrace: () => true,
    canPlaceRunezuTrace: () => false,
    ...overrides,
  };
  return {
    helpers: createAlienRuntimeHelpers(context),
    calls,
    pendingState,
    player,
    rocketState,
    actionEffect,
    workingRoot: {
      match: { alienTraceContinuation: structuredClone(alienTraceContinuation) },
      alienGameState,
      playerState,
      rocketState,
      solarState: context.solarState,
      nebulaDataState: context.nebulaDataState,
      techGameState: context.techGameState,
    },
  };
}

{
  const { helpers, workingRoot } = createHarness();
  const result = helpers.handleAomomoRevealSideEffects(workingRoot, 1, { ok: true, alienId: "aomomo" }, { id: "p1" });
  assert.equal(result.ok, true);
  assert.equal(result.cardGrant.totalDrawn, 1);
  assert.match(result.message, /奥陌陌已揭示/);
  assert.match(result.message, /已补满星云数据/);
}

{
  const { helpers, actionEffect, rocketState, player, calls, workingRoot } = createHarness();
  assert.doesNotThrow(() => JSON.stringify(workingRoot.match.alienTraceContinuation));
  const result = helpers.confirmAlienTracePlacement(workingRoot, 1, "yellow");
  assert.equal(result.ok, true);
  assert.equal(actionEffect.result.ok, true);
  assert.equal(player.resources.score, 7);
  assert.match(rocketState.statusNote, /首痕迹奖励/);
  assert.equal(calls.completedEffect, true);
}

{
  const { helpers, player, workingRoot } = createHarness();
  const isolatedRoot = structuredClone(workingRoot);
  const result = helpers.confirmAlienTracePlacement(isolatedRoot, 1, "yellow");
  assert.equal(result.ok, true);
  assert.equal(isolatedRoot.playerState.players[0].resources.score, 7);
  assert.deepEqual(player.resources, {}, "隔离 root 痕迹奖励不得写入闭包 playerState");
  assert.throws(
    () => helpers.confirmAlienTracePlacement(undefined, 1, "yellow"),
    /explicit workingRoot/,
    "外星人规则 operation 缺 root 必须立即失败",
  );
}

{
  const { helpers, calls, workingRoot } = createHarness();
  const result = helpers.confirmBanrenmaTracePlacement(workingRoot, 1, "yellow", 2);
  assert.equal(result.ok, true);
  assert.equal(calls.openBanrenma, 1);
  assert.equal(calls.continueReveal, 0);
}

{
  const { helpers, calls, rocketState, workingRoot } = createHarness();
  const settled = helpers.settleTurnEndAlienRevealEntries(workingRoot, { id: "p1" }, [
    { alienSlotId: 1, revealResult: { ok: true, alienId: "aomomo", message: "揭示奥陌陌" } },
  ]);
  assert.equal(settled.length, 1);
  assert.match(rocketState.statusNote, /回合结束揭示外星人/);
  assert.equal(calls.actionLogs.length, 1);
  assert.equal(calls.irreversible.length, 1);
}

console.log("alien-runtime tests passed");

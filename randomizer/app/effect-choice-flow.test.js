"use strict";

const assert = require("node:assert/strict");
const { createEffectChoiceFlowHelpers } = require("./effect-choice-flow");
const { routeProbeDecisionClick } = require("./events");
const { createDecisionSessionStore } = require("../game/effects/decision-session-store");
const { attachDecisionState } = require("./test-decision-state");

function makeButton() {
  return {
    type: "button",
    className: "",
    dataset: {},
    disabled: false,
    hidden: false,
    title: "",
    innerHTML: "",
    textContent: "",
    classList: { toggle() {} },
  };
}

function createHarness(overrides = {}) {
  const player = {
    id: "p1",
    color: "white",
    colorLabel: "白色",
    resources: { credits: 2, score: 6, energy: 1 },
    hand: [
      { id: "h1", cardName: "手牌1", discardActionCode: 1 },
      { id: "h2", cardName: "手牌2", discardActionCode: 2 },
    ],
  };
  const pendingState = {
    scanTargetAction: null,
    probeSectorScanAction: null,
    probeLocationRewardAction: null,
    actionEffectFlow: {
      effects: [
        { id: "pay-1", status: "active", options: { groupId: "pay-credit" } },
        { id: "pay-2", status: "pending", options: { groupId: "pay-credit" } },
        { id: "pay-3", status: "pending", options: { groupId: "other" } },
      ],
    },
  };
  const decisionSessions = createDecisionSessionStore();
  attachDecisionState(pendingState, decisionSessions);
  const rocketState = {
    statusNote: "",
    rockets: [
      { id: 1, playerId: "p1", color: "white" },
      { id: 2, playerId: "p1", color: "white" },
    ],
  };
  const cardState = { publicCards: [{ id: "pub-1" }], discardPile: [] };
  const workingRoot = {
    match: {},
    rocketState,
    cardState,
    playerState: { players: [player], currentPlayerId: player.id },
    turnState: {},
    nebulaDataState: {},
    planetStatsState: {},
    alienGameState: {},
  };
  const calls = {
    inserted: [],
    finished: [],
    completed: [],
    history: [],
    readout: 0,
    rockets: 0,
    orbitSync: 0,
  };
  const els = {
    scanTargetOverlay: { hidden: true },
    scanTargetTitle: { textContent: "" },
    scanTargetSubtitle: { textContent: "" },
    scanTargetCancel: { hidden: true },
    scanTargetActions: {
      children: [],
      replaceChildren(...children) {
        this.children = children;
      },
    },
  };
  const uiRuntimeState = { probeSectorSelectedRocketIds: [] };

  const helper = createEffectChoiceFlowHelpers({
    document: { createElement: () => makeButton() },
    decisionSessions,
    uiRuntimeState,
    pendingState,
    els,
    cards: {
      getCardLabel: (card) => card.cardName || card.id,
      getIncomeGainForCard: () => ({ credits: 1 }),
      discardFromHandAtIndex(target, index) {
        const [card] = target.hand.splice(index, 1);
        return { ok: true, card };
      },
      addToDiscardPile(state, card) {
        state.discardPile.push(card);
      },
      getDiscardActionRewardForCard: () => ({ label: "奖励" }),
      getDiscardActionMoveRewardForCard: () => null,
    },
    players: {
      getCurrentPlayer: (state) => state.players.find((candidate) => candidate.id === state.currentPlayerId) || null,
      canAfford: (target, cost = {}) => Number(target.resources.credits || 0) >= Number(cost.credits || 0),
      spendResources(target, cost = {}) {
        if (Number(target.resources.credits || 0) < Number(cost.credits || 0)) {
          return { ok: false, message: "信用不足" };
        }
        target.resources.credits -= Number(cost.credits || 0);
        return { ok: true };
      },
      gainResources(target, gain = {}) {
        Object.entries(gain).forEach(([key, value]) => {
          target.resources[key] = Number(target.resources[key] || 0) + Number(value || 0);
        });
      },
      formatResourceCost: (cost) => Object.entries(cost).map(([key, value]) => `${value}${key}`).join(" "),
    },
    data: {
      listNebulaTokens: (_state, nebulaId) => [{ playerId: "p1", nebulaId }],
      listSectorExtraMarks: () => [],
      gainData: () => ({ ok: true, dataId: "d1" }),
    },
    solar: { mod8: (value) => ((Number(value) % 8) + 8) % 8 },
    rocketActions: {
      getRocketSectorCoordinate: (rocket) => ({ x: Number(rocket.id), y: 4 }),
    },
    planetStats: {
      PLANET_IDS: ["mars"],
      getPlanetOrbitMarkers: () => [],
      removePlanetOrbitMarker: () => ({ ok: true }),
    },
    planetReferenceLayout: { PLANET_ORDER: ["mars"] },
    planetRewards: { PLANET_NAMES: { mars: "火星" } },
    cardEffects: {
      EFFECT_TYPES: { SECTOR_X_SCAN: "sector_x_scan" },
      getMatchingConditionalSectorXs: () => [1, 3],
    },
    historyCommands: {
      createRestorePlayerCommand: () => ({ type: "restore-player" }),
      createRestorePublicCardsCommand: () => ({ type: "restore-public" }),
      createGainDataCommand: () => ({ type: "gain-data" }),
    },
    aomomo: null,
    endGameScoring: {
      getPlayerKeys: (target) => new Set([target?.id, target?.color]),
    },
    SCORE_SOURCE_KEYS: { INDUSTRY_EFFECT: "industry" },
    getCurrentPlayer: () => player,
    getEffectOwnerPlayer: () => player,
    getExplicitEffectOwnerPlayer: () => player,
    getPendingOwnerFields: () => ({ playerId: player.id, playerColor: player.color }),
    getPendingOwnerPlayer: () => player,
    withPendingOwnerPlayer: (_workingRoot, _pending, run) => run(player),
    closeScanTargetPicker() {
      pendingState.scanTargetAction = null;
      delete workingRoot.match.probeSectorScanContinuation;
      delete workingRoot.match.probeLocationRewardContinuation;
      els.scanTargetOverlay.hidden = true;
    },
    renderStateReadout() {
      calls.readout += 1;
    },
    renderPlayerHand() {},
    renderPlayerStats() {},
    renderReservedCards() {},
    renderRockets() {
      calls.rockets += 1;
    },
    syncPlanetOrbitLandMarkers() {
      calls.orbitSync += 1;
    },
    renderActionEffectBar() {},
    beginEffectHistoryStep() {},
    endEffectHistoryStep() {},
    recordHistoryCommand(command) {
      calls.history.push(command);
    },
    finishAutomaticRewardEffect(_effect, result) {
      calls.finished.push(result);
      return result;
    },
    insertActionEffectsAfterCurrent(effects) {
      calls.inserted.push(...effects);
    },
    completeCurrentActionEffect(status) {
      calls.completed.push(status || "completed");
    },
    executeSectorXScanEffect(effect) {
      calls.inserted.push(effect);
      return { ok: true, effectId: effect.id };
    },
    buildSectorScanChoicesForX: (sectorX) => [{ nebulaId: `n-${sectorX}`, disabled: false }],
    getSectorScanTargetLabel: (sectorX) => `扇区 ${sectorX}`,
    normalizeResourceCost: (cost) => ({ ...(cost || {}) }),
    formatIncomeGain: () => "+1信用",
    applyIncomeFromCard: () => ({ ok: true }),
    recordScoreSourceForGainEffect() {},
    addPlayerScoreSource() {},
    addScoreSourceFromGain() {},
    beginCardSelection: () => ({ ok: true }),
    beginDiscardSelection: () => ({ ok: true }),
    restoreObjectSnapshot() {},
    applyCardCornerRewardFromCard: () => ({ message: "奖励" }),
    buildRepeatedCardCornerMoveEffect: () => ({ id: "repeat-move" }),
    formatRepeatedCardCornerMoveReward: () => "重复移动",
    buildPlutoMarkerRemovalChoices: () => [],
    removePlutoMarker: () => ({ ok: true }),
    getPlanetSectorCoordinate: () => ({ x: 2, y: 4 }),
    restoreMutableObject() {},
    getSectorContentForMove: () => "asteroid",
    isAsteroidContent: (content) => content === "asteroid",
    ...overrides,
  });

  return { helper, pendingState, decisionSessions, workingRoot, rocketState, calls, els, player, uiRuntimeState };
}

{
  const { helper, workingRoot, calls } = createHarness({
    cardEffects: {
      EFFECT_TYPES: { SECTOR_X_SCAN: "sector_x_scan" },
      getMatchingConditionalSectorXs: () => [],
    },
  });
  const result = helper.executeConditionalSectorScanEffect(workingRoot, {
    id: "cond-empty",
    label: "条件扫描",
    options: { condition: { type: "none" } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.match(result.message, /没有符合条件的扇区，已跳过/);
  assert.equal(calls.finished.length, 1);
}

{
  const { helper, workingRoot, pendingState, els } = createHarness();
  const result = helper.executeConditionalSectorScanEffect(workingRoot, {
    id: "cond-1",
    label: "条件扫描",
    options: { repeat: 2, condition: { type: "test" } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.pendingChoice, true);
  assert.equal(pendingState.scanTargetAction.type, "conditional_sector_scan");
  assert.equal(els.scanTargetActions.children.length, 2);
}

{
  const { helper, workingRoot, pendingState, player, calls } = createHarness();
  pendingState.scanTargetAction = {
    type: "pay_credit_reward",
    effect: {
      id: "pay-credit",
      label: "支付信用",
      options: { single: true, groupId: "pay-credit", reward: { type: "gain_resources", label: "得分", options: { gain: { score: 2 } } } },
    },
  };
  const result = helper.handlePayCreditChoice(workingRoot, "pay");
  assert.equal(result.ok, true);
  assert.equal(player.resources.credits, 1);
  assert.equal(player.resources.score, 8);
  assert.equal(calls.history.length, 1);
}

{
  const { helper, workingRoot, pendingState } = createHarness();
  pendingState.scanTargetAction = {
    type: "pay_credit_reward",
    effect: { id: "pay-credit", label: "支付信用", options: { single: true, groupId: "pay-credit" } },
  };
  const result = helper.handlePayCreditChoice(workingRoot, "skip");
  assert.equal(result.ok, true);
  assert.equal(pendingState.actionEffectFlow.effects.length, 2);
  assert.deepEqual(pendingState.actionEffectFlow.effects.map((effect) => effect.id), ["pay-1", "pay-3"]);
}

{
  const { helper, workingRoot, calls, els, uiRuntimeState } = createHarness();
  const result = helper.executeProbeSectorScanEffect(workingRoot, {
    id: "probe-sector",
    label: "探测器扫描",
    options: { maxTargets: 2, repeat: 1 },
  });
  assert.equal(result.ok, true);
  assert.equal(workingRoot.match.probeSectorScanContinuation.choices.length, 2);
  assert.equal(els.scanTargetActions.children.length, 3);
  assert.equal(els.scanTargetActions.children[0].dataset.probeScanRocketId, "1");
  assert.equal(els.scanTargetActions.children[2].dataset.probeScanConfirm, "true");
  const continuation = workingRoot.match.probeSectorScanContinuation;
  const selectResult = helper.handleProbeSectorScanChoice(workingRoot, 1);
  assert.equal(selectResult.ok, true);
  assert.deepEqual(uiRuntimeState.probeSectorSelectedRocketIds, [1]);
  assert.equal(workingRoot.match.probeSectorScanContinuation, continuation);
  assert.equal(calls.inserted.length, 0);
  helper.confirmProbeSectorScanSelection(workingRoot, [1]);
  assert.equal(calls.inserted.length, 1);
  assert.equal(els.scanTargetOverlay.hidden, true);
}

{
  const { helper, workingRoot, calls, els } = createHarness();
  helper.executeProbeLocationRewardEffect(workingRoot, {
    id: "probe-location",
    label: "位置奖励",
    options: { asteroidData: 1, adjacentAsteroidData: 1 },
  });
  assert.equal(workingRoot.match.probeLocationRewardContinuation.choices.length, 2);
  assert.equal(els.scanTargetActions.children.length, 2);
  const renderedButton = els.scanTargetActions.children[0];
  assert.equal(renderedButton.dataset.probeLocationRewardRocketId, "1");

  const activeDecision = {
    decisionId: "probe-location-decision",
    decisionVersion: 4,
    choices: [
      { target: { kind: "probe-location-reward", rocketId: 1 } },
      { target: { kind: "probe-location-reward", rocketId: 2 } },
    ],
  };
  const submissions = [];
  const inputPort = {
    submitDecision(submission) {
      submissions.push(submission);
      return helper.handleProbeLocationRewardChoice(
        workingRoot,
        submission.choice.target.rocketId,
      );
    },
  };
  const event = {
    target: {
      closest(selector) {
        return selector === "[data-probe-location-reward-rocket-id]" ? renderedButton : null;
      },
    },
  };
  const handled = routeProbeDecisionClick(event, {
    handleProbeSectorScanChoice() {},
    confirmProbeSectorScanSelection() {},
    handleProbeLocationRewardChoice(rocketId) {
      const choice = activeDecision.choices.find((candidate) => (
        String(candidate.target.rocketId) === String(rocketId)
      ));
      return inputPort.submitDecision({
        decisionId: activeDecision.decisionId,
        decisionVersion: activeDecision.decisionVersion,
        choice,
      });
    },
  });

  assert.equal(handled, true);
  assert.deepEqual(submissions, [{
    decisionId: "probe-location-decision",
    decisionVersion: 4,
    choice: activeDecision.choices[0],
  }]);
  assert.equal(calls.history.length, 3);
}

console.log("effect-choice-flow tests passed");

"use strict";

const assert = require("node:assert/strict");
const { createEffectChoiceFlowHelpers } = require("./effect-choice-flow");

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
  const rocketState = {
    statusNote: "",
    rockets: [
      { id: 1, playerId: "p1", color: "white" },
      { id: 2, playerId: "p1", color: "white" },
    ],
  };
  const cardState = { publicCards: [{ id: "pub-1" }], discardPile: [] };
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

  const helper = createEffectChoiceFlowHelpers({
    document: { createElement: () => makeButton() },
    pendingState,
    els,
    rocketState,
    cardState,
    playerState: {},
    nebulaDataState: {},
    planetStatsState: {},
    alienGameState: {},
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
    withPendingOwnerPlayer: (_pending, run) => run(player),
    closeScanTargetPicker() {
      pendingState.scanTargetAction = null;
      pendingState.probeSectorScanAction = null;
      els.scanTargetOverlay.hidden = true;
    },
    renderStateReadout() {
      calls.readout += 1;
    },
    renderPlayerHand() {},
    renderPlayerStats() {},
    renderReservedCardsFromTaskState() {},
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

  return { helper, pendingState, rocketState, calls, els, player };
}

{
  const { helper, calls } = createHarness({
    cardEffects: {
      EFFECT_TYPES: { SECTOR_X_SCAN: "sector_x_scan" },
      getMatchingConditionalSectorXs: () => [],
    },
  });
  const result = helper.executeConditionalSectorScanEffect({
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
  const { helper, pendingState, els } = createHarness();
  const result = helper.executeConditionalSectorScanEffect({
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
  const { helper, pendingState, player, calls } = createHarness();
  pendingState.scanTargetAction = {
    type: "pay_credit_reward",
    effect: {
      id: "pay-credit",
      label: "支付信用",
      options: { single: true, groupId: "pay-credit", reward: { type: "gain_resources", label: "得分", options: { gain: { score: 2 } } } },
    },
  };
  const result = helper.handlePayCreditChoice("pay");
  assert.equal(result.ok, true);
  assert.equal(player.resources.credits, 1);
  assert.equal(player.resources.score, 8);
  assert.equal(calls.history.length, 1);
}

{
  const { helper, pendingState } = createHarness();
  pendingState.scanTargetAction = {
    type: "pay_credit_reward",
    effect: { id: "pay-credit", label: "支付信用", options: { single: true, groupId: "pay-credit" } },
  };
  const result = helper.handlePayCreditChoice("skip");
  assert.equal(result.ok, true);
  assert.equal(pendingState.actionEffectFlow.effects.length, 2);
  assert.deepEqual(pendingState.actionEffectFlow.effects.map((effect) => effect.id), ["pay-1", "pay-3"]);
}

{
  const { helper, pendingState, calls, els } = createHarness();
  const result = helper.executeProbeSectorScanEffect({
    id: "probe-sector",
    label: "探测器扫描",
    options: { maxTargets: 2, repeat: 1 },
  });
  assert.equal(result.ok, true);
  assert.equal(pendingState.probeSectorScanAction.choices.length, 2);
  helper.handleProbeSectorScanChoice(1);
  helper.confirmProbeSectorScanSelection();
  assert.equal(calls.inserted.length, 1);
  assert.equal(els.scanTargetOverlay.hidden, true);
}

{
  const { helper, pendingState, calls } = createHarness();
  helper.executeProbeLocationRewardEffect({
    id: "probe-location",
    label: "位置奖励",
    options: { asteroidData: 1, adjacentAsteroidData: 1 },
  });
  assert.equal(pendingState.probeLocationRewardAction.choices.length, 2);
  const result = helper.handleProbeLocationRewardChoice(1);
  assert.equal(result.ok, true);
  assert.equal(calls.history.length, 3);
}

console.log("effect-choice-flow tests passed");

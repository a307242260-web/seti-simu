"use strict";

const assert = require("node:assert/strict");
const { createAiController } = require("./ai-controller");
const aomomo = require("../game/aliens/aomomo");
const banrenma = require("../game/aliens/banrenma");
const chong = require("../game/aliens/chong");
const fangzhou = require("../game/aliens/fangzhou");
const runezu = require("../game/aliens/runezu");
const yichangdian = require("../game/aliens/yichangdian");
const alienCore = require("../game/aliens");
const setiAi = require("../game/ai");

function datasetKeyForSelector(selector) {
  const match = String(selector || "").match(/\[data-([a-z0-9-]+)\]/i);
  if (!match) return null;
  return match[1].replace(/-([a-z0-9])/g, (_all, char) => char.toUpperCase());
}

function makeButton(dataset = {}, textContent = "", disabled = false, onClick = null, className = "scan-target-option-button is-placeable") {
  const button = {
    dataset,
    textContent,
    disabled,
    className,
    matches: (selector) => String(selector || "").split(",").some((part) => {
      const item = part.trim();
      const key = datasetKeyForSelector(item);
      const dataMatches = !key || Object.prototype.hasOwnProperty.call(dataset || {}, key);
      const classMatches = (item.match(/\.[a-z0-9_-]+/gi) || [])
        .every((classToken) => String(button.className || "").split(/\s+/).includes(classToken.slice(1)));
      return dataMatches && classMatches;
    }),
  };
  button.click = () => {
    if (typeof onClick === "function") onClick(button);
  };
  return button;
}

function makeActionList(buttons = []) {
  return {
    querySelectorAll: (selector) => {
      if (selector === ".scan-target-option-button") return buttons;
      const key = datasetKeyForSelector(selector);
      if (!key) return [];
      return buttons.filter((button) => Object.prototype.hasOwnProperty.call(button.dataset || {}, key));
    },
  };
}

function createAiControllerHarness(pendingPlayerColor, options = {}) {
  const white = {
    id: "player-white",
    color: "white",
    colorLabel: "White",
    resources: {},
  };
  const blue = {
    id: "player-blue",
    color: "blue",
    colorLabel: "Blue",
    hand: options.blueHand || [],
    reservedCards: [],
    initialSelection: options.blueInitialSelection || null,
    industryStrategyPassiveSlots: options.blueIndustryStrategyPassiveSlots || undefined,
    aiDifficulty: options.blueAiDifficulty || options.aiDifficulty || undefined,
    resources: { credits: 5, energy: 5, ...(options.blueResources || {}) },
    income: { ...(options.blueIncome || {}) },
    companyBaseIncome: options.blueCompanyBaseIncome || null,
    techState: options.blueTechState || { ownedTiles: { ...(options.blueOwnedTechTiles || {}) } },
    techCounts: { ...(options.blueTechCounts || {}) },
    runezuSymbols: options.blueRunezuSymbols || {},
  };
  const extraPlayers = (options.extraPlayers || []).map((player) => ({
    hand: [],
    reservedCards: [],
    resources: { credits: 5, energy: 5, ...(player.resources || {}) },
    income: { ...(player.income || {}) },
    techState: player.techState || { ownedTiles: { ...(player.ownedTechTiles || {}) } },
    techCounts: { ...(player.techCounts || {}) },
    runezuSymbols: player.runezuSymbols || {},
    ...player,
  }));
  const allPlayers = [white, blue, ...extraPlayers];
  const currentPlayer = options.currentPlayerColor === "blue" ? blue : white;
  const playerState = {
    players: allPlayers,
    currentPlayerId: currentPlayer.id,
  };
  const turnState = {
    activePlayerIds: allPlayers.map((player) => player.id),
    turnOrderPlayerIds: allPlayers.map((player) => player.id),
    activePlayerCount: allPlayers.length,
    roundNumber: options.roundNumber || 1,
    turnNumber: options.turnNumber || 1,
    startPlayerId: white.id,
  };
  let pendingJiuzheCardPlay = pendingPlayerColor
    ? {
      playerColor: pendingPlayerColor,
      reason: "reveal",
      cost: {},
      label: "Jiuzhe reveal",
    }
    : null;
  let pendingPassReserveSelection = options.pendingPassReserveSelection || null;
  const pendingDiscardAction = options.pendingDiscardAction
    || (options.currentPlayerDiscardPending
      ? {
        player: white,
        selectedIndexes: [],
        type: options.pendingDiscardType || null,
      }
      : null);
  let handled = null;
  const handledEvents = [];
  const scheduledTimers = [];
  const noteHandled = (event) => {
    handled = event;
    handledEvents.push(event);
  };
  const takeableTechIds = options.takeableTechIds || [];
  const techStacks = options.techStacks || {};
  const inferTechType = (tileId) => {
    const id = String(tileId || "");
    if (id.startsWith("orange")) return "orange";
    if (id.startsWith("purple")) return "purple";
    if (id.startsWith("blue")) return "blue";
    return null;
  };
  const getTechStack = (tileId) => {
    const stack = techStacks[tileId] || {};
    return {
      techType: stack.techType || inferTechType(tileId),
      bonusId: stack.bonusId || null,
      firstTakeClaimedBy: stack.firstTakeClaimedBy ?? null,
      remaining: stack.remaining ?? 1,
      stackIndex: stack.stackIndex || null,
    };
  };
  const quickTradeActions = options.quickTrades || (options.enableQuickTrades ? {
    "cards-for-credit": {
      id: "cards-for-credit",
      label: "2 cards -> 1 credit",
      cost: { handSize: 2 },
      gain: { credits: 1 },
    },
  } : null);
  const canAffordResources = (player, cost = {}) => Object.entries(cost || {}).every(([key, value]) => {
    const required = Math.max(0, Number(value || 0));
    if (required <= 0) return true;
    if (key === "handSize") {
      const handSize = Number(player?.resources?.handSize ?? (player?.hand || []).length);
      return handSize >= required;
    }
    return Number(player?.resources?.[key] || 0) >= required;
  });

  const state = {
    get pendingJiuzheCardPlay() { return pendingJiuzheCardPlay; },
    get pendingAlienTraceAction() { return options.pendingAlienTraceAction || null; },
    get pendingScanTargetAction() { return options.scanTargetPending || null; },
    get pendingProbeSectorScanAction() { return options.probeSectorPending || null; },
    get pendingProbeLocationRewardAction() { return options.probeLocationPending || null; },
    get pendingLandTargetAction() { return options.landTargetPending || null; },
    get pendingDataPlaceAction() { return options.dataPlacePending || null; },
    get pendingCardSelectionAction() { return options.pendingCardSelectionAction || null; },
    get pendingDiscardAction() { return pendingDiscardAction; },
    get pendingPassReserveSelection() { return pendingPassReserveSelection; },
    get pendingCardTriggerAction() { return options.pendingCardTriggerAction || null; },
    get pendingMovePayment() { return options.pendingMovePayment || null; },
    get pendingActionExecuted() { return Boolean(options.pendingActionExecuted); },
    get pendingActionEffectFlow() { return options.pendingActionEffectFlow || null; },
    get pendingRunezuFaceSymbolPlacement() { return null; },
    alienTracePickerState: options.alienTracePickerState || null,
  };
  const alienGameState = options.alienGameState || (
    options.runezuQuick
      ? {
      aliens: {
        1: { revealed: true, alienId: runezu.ALIEN_ID, assignedAlienId: runezu.ALIEN_ID },
      },
      runezu: runezu.createRunezuState(),
    }
      : {}
  );
  if (options.runezuQuick && options.runezuFaceSymbolSlots) {
    const runezuState = runezu.ensureRunezuState(alienGameState);
    for (const [position, symbolId] of Object.entries(options.runezuFaceSymbolSlots)) {
      runezuState.faceSymbolSlots[position] = {
        position: Number(position),
        symbolId,
        playerId: blue.id,
        playerColor: blue.color,
        placedAt: 1,
      };
    }
  }

  const context = {
    window: {
      setTimeout: (callback, delay) => {
        const entry = { callback, delay };
        scheduledTimers.push(entry);
        if (typeof options.onSetTimeout === "function") {
          options.onSetTimeout(entry);
        }
        return scheduledTimers.length;
      },
      localStorage: null,
    },
    state,
    players: {
      PLAYER_COLOR_IDS: allPlayers.map((player) => player.color),
      canAfford: options.realisticCanAfford ? canAffordResources : () => true,
      formatResourceCost: (cost = {}) => Object.entries(cost)
        .filter(([, value]) => Number(value || 0) > 0)
        .map(([key, value]) => `${value} ${key}`)
        .join(", "),
      normalizeIncome: (income = {}) => ({ ...(income || {}) }),
      playerOwnsTech: () => false,
    },
    solar: {
      mod8: (value) => ((Math.round(Number(value) || 0) % 8) + 8) % 8,
      createSolarSnapshot: () => ({ planetLocations: options.planetLocations || [] }),
      collectVisibleCoordinateGroups: () => ({ asteroids: [], comets: [] }),
      collectVisibleCoordinateReport: () => [],
    },
    rocketActions: {
      ROCKET_KIND: { STANDARD: "standard", CHONG_FOSSIL: "chong-fossil" },
      getRocketsForPlayer: () => [],
      getRocketSectorCoordinate: (rocket) => rocket?.sector || null,
      findAvailableSlotIndex: options.findAvailableSlotIndex || (() => null),
      canMoveRocket: (_rocketState, rocketId, deltaX, deltaY) => {
        const rocket = (options.movableTokens || []).find((item) => Number(item.id) === Number(rocketId));
        if (!rocket) return { ok: false, message: "rocket not found" };
        if (Array.isArray(options.allowedMoveDeltas)
          && !options.allowedMoveDeltas.some((delta) => (
            Number(delta?.deltaX || 0) === Number(deltaX || 0)
            && Number(delta?.deltaY || 0) === Number(deltaY || 0)
          ))) {
          return { ok: false, message: "move direction disabled by test" };
        }
        const sector = rocket.sector || null;
        if (!sector) return { ok: false, message: "rocket has no sector" };
        const y = sector.y + Number(deltaY || 0);
        if (y < 1 || y > 4) return { ok: false, message: "out of bounds" };
        if (!Number(deltaX || 0) && !Number(deltaY || 0)) return { ok: false, message: "no movement" };
        return { ok: true, rocket, message: null };
      },
      SECTOR_RING_MIN: 1,
      SECTOR_RING_MAX: 4,
    },
    planetRewards: options.planetRewards || {
      EFFECT_TYPES: {
        GAIN_RESOURCES: "gain_resources",
        GAIN_DATA: "gain_data",
        ALIEN_TRACE: "alien_trace",
        DRAW_CARDS: "draw_cards",
        PICK_CARD: "pick_card",
        INCOME: "income",
      },
    },
    planetStats: options.planetStats || {
      canAddLandingMarker: () => false,
      canAddOrbitMarker: () => false,
      getAvailableSatellitesForLanding: () => [],
      getPlanetLandingCount: () => 0,
      getPlanetOrbitCount: () => 0,
    },
    aliens: {
      ALIEN_SLOT_IDS: options.alienSlotIds || [1],
      TRACE_TYPES: alienCore.TRACE_TYPES,
      getAlienSlot: (stateToRead, alienSlotId) => (
        stateToRead?.aliens?.[String(alienSlotId)]
        || stateToRead?.aliens?.[Number(alienSlotId)]
        || null
      ),
    },
    banrenma,
    chong,
    fangzhou,
    runezu,
    yichangdian,
    aomomo,
    cards: {
      getCardLabel: (card) => card?.cardName || card?.label || card?.cardId || card?.id || "card",
      getDiscardRemaining: () => Math.max(0, Math.round(Number(options.discardCount ?? pendingDiscardAction?.count ?? 1) || 0)),
      getIncomeCodeForCard: (card) => card?.incomeCode ?? null,
      getIncomeGainForCard: (card) => card?.incomeGain || null,
      getDiscardActionMoveRewardForCard: (card) => card?.moveReward || null,
      getDiscardActionRewardForCard: (card) => card?.resourceReward || null,
    },
    abilities: options.abilities || {
      planet: {
        DEFAULT_ORBIT_COST: { credits: 1, energy: 1 },
        BASE_LAND_ENERGY_COST: 3,
        getLandEnergyCost: () => 3,
        getLandOptions: () => ({ ok: false, message: "land disabled in harness" }),
        getOrbitOptions: () => ({ ok: false, message: "orbit disabled in harness" }),
      },
      rocket: {
        ORANGE1_ROCKET_LIMIT: 4,
        getRocketLimitForPlayer: () => 3,
      },
    },
    actions: options.actions || {
      canExecute: (actionId) => {
        const configured = options.actionChecks?.[actionId];
        if (configured) return typeof configured === "function" ? configured() : configured;
        if (actionId === "researchTech" && takeableTechIds.length) {
          return { ok: true, takeable: takeableTechIds };
        }
        return { ok: false, message: `${actionId} disabled in harness` };
      },
    },
    scanEffects: options.scanEffects || {
      SCAN_COST: { credits: 1, energy: 2 },
      buildScanEffectQueue: () => [],
      canExecuteScan: () => ({ ok: false, message: "scan disabled in harness" }),
      getStandardScanCost: () => ({ credits: 1, energy: 2 }),
    },
    quickTrades: quickTradeActions ? {
      getTradeAction: (tradeId) => quickTradeActions[tradeId] || null,
      canExecuteTrade: (tradeId) => {
        const trade = quickTradeActions[tradeId] || null;
        if (!trade) return { ok: false, message: "trade missing" };
        return canAffordResources(currentPlayer, trade.cost)
          ? { ok: true }
          : { ok: false, message: "trade unaffordable" };
      },
    } : null,
    data: options.data || {},
    ai: {
      policy: {
        choosePlayCard: (candidates) => (
          candidates
            .slice()
            .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0]
          || null
        ),
        chooseTurnAction: (candidates) => {
          const selected = options.chooseTurnAction
            ? options.chooseTurnAction(candidates)
            : (
              candidates.find((candidate) => candidate.id === "runezuFaceSymbol")
              || candidates.find((candidate) => candidate.available !== false)
              || null
            );
          if (typeof options.onChooseTurnAction === "function") {
            options.onChooseTurnAction(candidates, selected);
          }
          return selected;
        },
      },
      ...(options.actionGraph ? { actionGraph: options.actionGraph } : {}),
    },
    cardEffects: {
      EFFECT_TYPES: {
        CARD_MOVE: "card_move",
        FREE_MOVE: "free_move",
        RESEARCH_TECH: "card_research_tech",
        PAY_CREDITS_FOR_REWARD: "card_pay_credits_for_reward",
        CARD_CORNER_EVENT_REWARD: "card_corner_event_reward",
        CONDITIONAL_REWARD: "card_conditional_reward",
        COUNT_ROCKETS_REWARD: "card_count_rockets_reward",
      },
      buildPlayEffects: (card) => card?.playEffects || [],
      getCardModel: (card) => card?.model || null,
      ensureCardEffectState: () => null,
    },
    finalScoring: {
      ensureFinalScoringState: (stateToEnsure) => {
        if (!stateToEnsure.tiles) stateToEnsure.tiles = {};
      },
      getTileVariant: (_stateToRead, tileId) => options.finalTileVariants?.[tileId] || "a",
      hasPlayerMarkedTile: (stateToRead, tileId, playerId) => (
        stateToRead?.tiles?.[tileId]?.marks || []
      ).some((mark) => mark?.playerId === playerId),
    },
    endGameScoring: {
      countOwnedTech: (player, techType) => Math.max(0, Number(player?.techCounts?.[techType] || 0)),
      getFormulaId: (tileId) => options.finalFormulaIds?.[tileId] || tileId,
      getSlotMultiplier: (formulaId, slotIndex) => (
        options.finalSlotMultipliers?.[formulaId]?.[slotIndex]
        ?? options.finalSlotMultipliers?.[formulaId]
        ?? 1
      ),
      ...(options.endGameScoring || {}),
    },
    tech: options.tech || {
      getStack: (_board, tileId) => getTechStack(tileId),
      getStackIndex: (tileId) => getTechStack(tileId).stackIndex || 1,
      getTechType: (tileId) => getTechStack(tileId).techType,
      getAvailableBlueSlots: () => [1],
      listTakeableTiles: (_board, _techState, filter = {}) => {
        const allowed = Array.isArray(filter.techTypes) ? new Set(filter.techTypes) : null;
        return takeableTechIds.filter((tileId) => (
          !allowed || allowed.has(getTechStack(tileId).techType)
        ));
      },
      resolver: {
        normalizeTechTypeFilter: (filter = {}) => (
          Array.isArray(filter.techTypes) && filter.techTypes.length ? filter.techTypes : null
        ),
        canTakeTile: (_board, _techState, tileId, filter = {}) => {
          const stack = getTechStack(tileId);
          const allowed = Array.isArray(filter.techTypes) ? new Set(filter.techTypes) : null;
          if (allowed && !allowed.has(stack.techType)) return { ok: false, message: "tech type disabled" };
          return takeableTechIds.includes(tileId)
            ? { ok: true }
            : { ok: false, message: "tech tile unavailable" };
        },
      },
    },
    playerState,
    turnState,
    rocketState: options.rocketState || {},
    solarState: {},
    nebulaDataState: {},
    alienGameState,
    finalScoringState: options.finalScoringState || {},
    planetStatsState: {},
    techGameState: { board: options.techBoard || {}, ui: { ...(options.techUi || {}) } },
    cardState: { publicCards: options.publicCards || [] },
    cardTaskState: {},
    industry: options.industry || null,
    historyStepOrder: {},
    els: {
      scanTargetOverlay: { hidden: options.scanTargetHidden ?? false },
      scanTargetActions: makeActionList(options.scanTargetButtons || []),
      landTargetOverlay: {
        hidden: !options.landTargetPending,
        dataset: options.landTargetDataset || { planetId: "mars" },
      },
      landTargetSelect: {
        options: options.landTargetSelectOptions || [{}, {}],
        value: String(options.landTargetSelectedIndex || 0),
        focus: () => null,
      },
      dataPlaceOverlay: { hidden: !options.dataPlacePending },
      dataPlaceActions: makeActionList(options.dataPlaceButtons || []),
      alienTraceActions: makeActionList(options.alienPickerButtons || []),
      alienJiuzheTraceLayers: [makeActionList(options.alienTraceButtons || [])],
      alienTraceLayers: [makeActionList(options.alienStateTraceButtons || [])],
    },
    DEFAULT_ACTIVE_PLAYER_COUNT: allPlayers.length,
    DEFAULT_INITIAL_HAND_COUNT: 5,
    DEFAULT_INITIAL_PLAYER_COLOR: "white",
    FINAL_ROUND_NUMBER: options.finalRoundNumber || 4,
    FINAL_SCORE_IDS: options.finalScoreIds || [],
    INITIAL_SELECTION_REQUIRED: { initial: options.initialSelectionRequired ?? 0 },
    MOVE_ENERGY_COST: 1,
    createActionContext: () => ({
      ensurePlayerTechState: (player) => {
        if (player && !player.techState) player.techState = { ownedTiles: {} };
        return player?.techState || null;
      },
    }),
    createTurnState: () => ({}),
    computePlayerFinalScoreBreakdown: () => ({}),
    formatRocketLabel: () => "",
    getActivePlayers: () => allPlayers,
    getAlienTraceActionPlayer: (pending) => {
      const playerId = pending?.targetPlayerId || pending?.playerId || options.alienTracePlayerId || null;
      const playerColor = pending?.targetPlayerColor || pending?.playerColor || options.alienTracePlayerColor || null;
      return allPlayers.find((player) => player.id === playerId || player.color === playerColor) || null;
    },
    getCardPlayCost: (card) => (card?.price ? { credits: card.price } : {}),
    getCardPrice: (card) => card?.price || 0,
    getCardTypeCode: (card) => (typeof options.getCardTypeCode === "function"
      ? options.getCardTypeCode(card)
      : (card?.typeCode || 1)),
    getCurrentActionEffect: () => options.currentActionEffect || null,
    getCurrentPlayer: () => currentPlayer,
    getEarthSectorCoordinate: () => options.earthCoordinate || { x: 1, y: 1 },
    getEffectOwnerPlayer: (effect) => {
      if (effect?.playerId) return allPlayers.find((player) => player.id === effect.playerId) || null;
      if (effect?.playerColor) return allPlayers.find((player) => player.color === effect.playerColor) || null;
      if (effect?.options?.playerId) return allPlayers.find((player) => player.id === effect.options.playerId) || null;
      if (effect?.options?.playerColor) return allPlayers.find((player) => player.color === effect.options.playerColor) || null;
      if (effect?.options?.targetPlayerId) return allPlayers.find((player) => player.id === effect.options.targetPlayerId) || null;
      if (effect?.options?.targetPlayerColor) return allPlayers.find((player) => player.color === effect.options.targetPlayerColor) || null;
      if (options.effectOwnerColor) return allPlayers.find((player) => player.color === options.effectOwnerColor) || null;
      return null;
    },
    getInitialSelectionOffer: (playerId) => options.initialSelectionOffers?.[playerId] || null,
    getPendingPlayCardSelection: () => null,
    getPlanetSectorCoordinate: () => ({ x: 1, y: 1 }),
    getPlayerByColor: (color) => allPlayers.find((player) => player.color === color) || null,
    getPlayerById: (id) => allPlayers.find((player) => player.id === id) || null,
    getPlayerLabelById: (id) => allPlayers.find((player) => player.id === id)?.colorLabel || id,
    getRequiredMovePointsForUi: () => 1,
    getSectorContentForMove: () => null,
    handleJiuzheCardChoice: (choice, handlerOptions = {}) => {
      noteHandled({ type: "card", choice, automated: handlerOptions.automated === true });
      return { ok: true, progressed: true };
    },
    handleJiuzheOpportunitySkip: (handlerOptions = {}) => {
      noteHandled({ type: "skip", automated: handlerOptions.automated === true });
      pendingJiuzheCardPlay = null;
      return { ok: true, progressed: true };
    },
    hasActivePendingSubFlow: () => Boolean(
      pendingJiuzheCardPlay
      || options.pendingAlienTraceAction
      || options.scanTargetPending
      || options.probeSectorPending
      || options.probeLocationPending
      || options.landTargetPending
      || options.dataPlacePending
    ),
    openBanrenmaReadyOpportunityForPlayer: (player, openOptions = {}) => {
      if (!options.readyBanrenmaPlayerColor || player?.color !== options.readyBanrenmaPlayerColor) return null;
      noteHandled({
        type: "banrenma-ready",
        playerColor: player.color,
        includeCards: openOptions.includeCards,
      });
      return { ok: true, message: "opened banrenma opportunity" };
    },
    openRunezuFaceSymbolPlacement: (alienSlotId, position) => {
      noteHandled({
        type: "runezu-face-symbol-open",
        alienSlotId: Number(alienSlotId),
        position: Number(position),
      });
      return { ok: true, progressed: true, awaitingChoice: true };
    },
  };

  const noopNames = [
    "allowsBlindDrawInSelection",
    "analyzeDataForCurrentPlayer",
    "beginPlayCardSelection",
    "beginScanAction",
    "cancelTechSelection",
    "clearTransientStateForRecovery",
    "confirmCardTaskCompletion",
    "confirmCardCornerQuickAction",
    "confirmDataPlacement",
    "confirmInitialSelectionForCurrentPlayer",
    "confirmLandTargetPicker",
    "confirmMovePayment",
    "confirmPassReserveSelection",
    "confirmPlayCardSelection",
    "confirmPublicScanSelection",
    "confirmScanTarget",
    "confirmStrategyPassiveSlotChoice",
    "confirmTechBlueSlotChoice",
    "drawCardForCurrentPlayer",
    "endCurrentTurn",
    "executeActionEffect",
    "executeCardMoveForEffect",
    "executeFreeMoveForCardCorner",
    "executeFreeMoveForCardTrigger",
    "executeFreeMoveForScanAction4",
    "executeIndustryFreeMove",
    "finalizePendingDiscardSelection",
    "finishIndustryAbilityFlow",
    "handleAmibaCardGainChoice",
    "handleAmibaSymbolChoice",
    "handleAmibaTraceRemovalChoice",
    "handleAomomoCardGainChoice",
    "handleBanrenmaBonusChoice",
    "handleBanrenmaCardConditionChoice",
    "handleBanrenmaCardGainChoice",
    "handleCardTriggerChoice",
    "handleChongCardGainChoice",
    "handleChongFossilChoice",
    "handleChongTaskCompletionChoice",
    "handleConditionalSectorChoice",
    "handleCompanyActionMarkerClick",
    "handleHandCardCornerQuickAction",
    "handleHandScanCardClick",
    "handleOptionalHandScanChoice",
    "handlePlayCardSelect",
    "handlePublicCardClick",
    "handlePublicScanCardClick",
    "handleIndustryDeepspaceHandClick",
    "handleRunezuCardGainChoice",
    "handleRunezuFaceSymbolChoice",
    "handleRunezuSymbolBranchChoice",
    "handleScanAction4Choice",
    "handleSupplyTechTileClick",
    "handleYichangdianCardGainChoice",
    "handleYichangdianCornerChoice",
    "initializeCardGame",
    "landForCurrentPlayer",
    "moveRocket",
    "orbitForCurrentPlayer",
    "openCardTaskCompletionPicker",
    "passForCurrentPlayer",
    "pickPublicCardForCurrentPlayer",
    "randomizeAll",
    "renderStateReadout",
    "researchTechForCurrentPlayer",
    "resetActionLog",
    "resetScanRunSequence",
    "restoreMutableObject",
    "runAction",
    "runPlaceDataToComputer",
    "runQuickTrade",
    "runAiFinalScoreMarkDecision",
    "selectPassReserveCard",
    "setTurnStatePlayerOrder",
    "skipCurrentActionEffect",
    "startInitialSelection",
    "updateActionButtons",
  ];
  for (const name of noopNames) context[name] = () => null;
  if (options.recordInitialSelection) {
    context.confirmInitialSelectionForCurrentPlayer = () => {
      const offer = context.getInitialSelectionOffer(playerState.currentPlayerId);
      if (offer) offer.confirmed = true;
      noteHandled({
        type: "initial-selection",
        playerId: playerState.currentPlayerId,
        industryId: offer?.selectedIndustryId || null,
        selectedInitialIds: [...(offer?.selectedInitialIds || [])],
      });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordCardTriggerChoice) {
    context.handleCardTriggerChoice = (choiceIndex) => {
      noteHandled({ type: "card-trigger", choiceIndex: Number(choiceIndex) });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordCancelCardTriggerChoice) {
    context.cancelCardTriggerChoice = () => {
      noteHandled({ type: "card-trigger-cancel" });
      return { ok: true, progressed: true, skipped: true };
    };
  }
  if (options.recordPublicPick) {
    context.pickPublicCardForCurrentPlayer = (slotIndex) => {
      noteHandled({ type: "public-pick", slotIndex: Number(slotIndex) });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordBlindDraw) {
    context.drawCardForCurrentPlayer = (drawOptions = {}) => {
      noteHandled({ type: "blind-draw", fromSelection: drawOptions.fromSelection === true });
      return { ok: true, progressed: true };
    };
  }

  context.finalizePendingDiscardSelection = () => {
    noteHandled({
      type: "discard",
      pendingType: pendingDiscardAction?.type || null,
      selectedIndexes: [...(pendingDiscardAction?.selectedIndexes || [])],
    });
    return { ok: true, progressed: true };
  };

  context.confirmDataPlacement = (target, blueSlot) => {
    noteHandled({ type: "data-placement", target, blueSlot });
    return { ok: true, progressed: true };
  };
  context.confirmScanTarget = (nebulaId, sectorX) => {
    noteHandled({
      type: "scan-target",
      nebulaId,
      sectorX: sectorX == null ? null : Number(sectorX),
    });
    return { ok: true, progressed: true };
  };
  context.confirmPublicScanSelection = () => {
    noteHandled({
      type: "public-scan-confirm",
      selectedSlots: [...(options.pendingCardSelectionAction?.selectedSlots || [])],
    });
    return { ok: true, progressed: true };
  };
  context.confirmLandTargetPicker = () => {
    noteHandled({ type: "land-target", selectedIndex: Number(context.els.landTargetSelect.value) });
    return { ok: true, progressed: true };
  };
  context.handlePayCreditChoice = (choice) => {
    noteHandled({ type: "pay-credit", choice });
    return { ok: true, progressed: true };
  };
  context.handleDiscardIncomeCardChoice = (cardId) => {
    noteHandled({ type: "discard-income-card", cardId });
    return { ok: true, progressed: true };
  };
  context.confirmDiscardAnyForIncome = () => {
    noteHandled({ type: "discard-income-confirm" });
    return { ok: true, progressed: true };
  };
  context.handleRemoveOrbitToProbeChoice = (choiceId) => {
    noteHandled({ type: "remove-orbit-to-probe", choiceId });
    return { ok: true, progressed: true };
  };
  context.handleReturnUnfinishedTaskChoice = (cardId) => {
    noteHandled({ type: "return-task", cardId });
    return { ok: true, progressed: true };
  };
  context.handleDiscardCornerRepeatChoice = (cardId) => {
    noteHandled({ type: "discard-corner-repeat", cardId });
    return { ok: true, progressed: true };
  };
  context.handleProbeSectorScanChoice = (rocketId) => {
    noteHandled({ type: "probe-sector-choice", rocketId: Number(rocketId) });
    return { ok: true, progressed: true };
  };
  context.confirmProbeSectorScanSelection = () => {
    noteHandled({ type: "probe-sector-confirm" });
    return { ok: true, progressed: true };
  };
  context.handleProbeLocationRewardChoice = (rocketId) => {
    noteHandled({ type: "probe-location", rocketId: Number(rocketId) });
    return { ok: true, progressed: true };
  };
  context.handleRemovePlanetMarkerChoice = (choiceId) => {
    noteHandled({ type: "remove-marker", choiceId });
    return { ok: true, progressed: true };
  };
  context.handleHandCornerChoice = (choice) => {
    noteHandled({ type: "hand-corner", choice });
    return { ok: true, progressed: true };
  };

  const falseNames = [
    "canBlindDraw",
    "canPayForMove",
    "canStartMainAction",
    "isActionEffectFlowActive",
    "isAsteroidContent",
    "isCardSelectionActive",
    "isDiscardSelectionActive",
    "isGameEnded",
    "isHandScanSelectionActive",
    "isIndustryHandSelectionActive",
    "isInitialSelectionActive",
    "isMovePaymentCard",
    "isMovePaymentSelectionActive",
    "isPlayCardSelectionActive",
    "isPublicScanMultiSelectActive",
    "isTechTileOwnedByOtherPlayer",
    "isTechTilePickingActive",
    "sectorXHasAvailableScanTarget",
  ];
  for (const name of falseNames) context[name] = () => false;
  if (options.canStartMainAction) {
    context.canStartMainAction = () => true;
  }
  if (options.techTilePickingActive) {
    context.isTechTilePickingActive = () => true;
  }
  if (options.actionEffectFlowActive) {
    context.isActionEffectFlowActive = () => true;
  }
  if (options.initialSelectionActive) {
    context.isInitialSelectionActive = () => true;
  }
  if (options.currentPlayerDiscardPending || options.pendingDiscardAction) {
    context.isDiscardSelectionActive = () => true;
  }
  if (options.cardSelectionActive) {
    context.isCardSelectionActive = () => true;
  }
  if (options.canBlindDraw) {
    context.canBlindDraw = () => true;
    context.allowsBlindDrawInSelection = () => options.pendingCardSelectionAction?.allowBlindDraw !== false;
  }
  if (options.playCardSelectionActive) {
    context.isPlayCardSelectionActive = () => true;
    context.handlePlayCardSelect = (handIndex) => {
      noteHandled({ type: "play-card", handIndex: Number(handIndex), confirmed: false });
      return { ok: true, progressed: true };
    };
    context.confirmPlayCardSelection = () => {
      noteHandled({ ...(handled || { type: "play-card" }), confirmed: true });
      return { ok: true, progressed: true };
    };
  }
  if (options.pendingMovePayment) {
    context.isMovePaymentSelectionActive = () => true;
    context.isMovePaymentCard = (card) => Boolean(card?.movePayment);
    context.confirmMovePayment = (confirmOptions = {}) => {
      noteHandled({
        type: "move-payment",
        automated: confirmOptions.automated === true,
        playerId: options.pendingMovePayment.player?.id || null,
        selectedHandIndices: [...(options.pendingMovePayment.selectedHandIndices || [])],
      });
      return { ok: true, progressed: true };
    };
  }
  if (options.canPayForMove) {
    context.canPayForMove = () => ({ ok: true });
  }
  if (options.recordEffectMove) {
    context.executeCardMoveForEffect = (deltaX, deltaY, rocketId) => {
      noteHandled({
        type: "effect-move",
        deltaX: Number(deltaX),
        deltaY: Number(deltaY),
        rocketId: Number(rocketId),
      });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordSkipCurrentActionEffect) {
    context.skipCurrentActionEffect = () => {
      noteHandled({ type: "skip-effect" });
      return { ok: true, progressed: true, skipped: true };
    };
  }
  if (options.recordResearchTech) {
    context.researchTechForCurrentPlayer = () => {
      noteHandled({ type: "research-tech" });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordSupplyTechSelection) {
    context.handleSupplyTechTileClick = (tileId) => {
      noteHandled({ type: "supply-tech", tileId });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordAnalyze) {
    context.analyzeDataForCurrentPlayer = () => {
      noteHandled({ type: "analyze" });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordQuickTrade) {
    context.runQuickTrade = (tradeId, tradeOptions = {}) => {
      const event = {
        type: "quick-trade",
        tradeId,
      };
      if (tradeOptions.preferBlindDraw === true) event.preferBlindDraw = true;
      noteHandled(event);
      return { ok: true, progressed: true };
    };
  }
  if (options.recordCardCorner) {
    context.handleHandCardCornerQuickAction = (handIndex) => {
      noteHandled({ type: "card-corner", handIndex: Number(handIndex), confirmed: false });
      return { ok: true, progressed: true };
    };
    context.confirmCardCornerQuickAction = () => {
      noteHandled({ ...(handled || { type: "card-corner" }), confirmed: true });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordExecuteActionEffect) {
    context.executeActionEffect = (effect) => {
      noteHandled({
        type: "effect",
        effectId: effect?.id || null,
        effectType: effect?.type || null,
      });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordBeginPlayCard) {
    context.beginPlayCardSelection = () => {
      noteHandled({ type: "begin-play-card" });
      return { ok: true, progressed: true };
    };
  }
  if (options.recordOpenCardTask) {
    context.openCardTaskCompletionPicker = (card) => {
      noteHandled({ type: "open-card-task", cardId: card?.id || null });
      return { ok: true, progressed: true };
    };
  }

  const emptyArrayNames = [
    "buildSectorScanChoicesForX",
    "buildSectorScanChoicesForXs",
    "getMovableTokensForPlayer",
    "getPassReserveSelectionCards",
    "getPublicScanChoicesForCard",
    "getReadyCardTasks",
    "getResearchTechSelectionOptions",
    "getSectorXsMatchingCondition",
  ];
  for (const name of emptyArrayNames) context[name] = () => [];
  if (options.buildSectorScanChoicesForX) {
    context.buildSectorScanChoicesForX = options.buildSectorScanChoicesForX;
  }
  if (options.buildSectorScanChoicesForXs) {
    context.buildSectorScanChoicesForXs = options.buildSectorScanChoicesForXs;
  }
  if (options.getPublicScanChoicesForCard) {
    context.getPublicScanChoicesForCard = options.getPublicScanChoicesForCard;
  }
  if (options.readyCardTasks) {
    context.getReadyCardTasks = () => options.readyCardTasks;
  }
  if (options.passReserveCards) {
    context.getPassReserveSelectionCards = () => options.passReserveCards;
    context.selectPassReserveCard = (cardId) => {
      if (pendingPassReserveSelection) pendingPassReserveSelection.selectedCardId = cardId;
      noteHandled({ type: "pass-reserve-select", cardId });
    };
    context.confirmPassReserveSelection = () => {
      const cardId = pendingPassReserveSelection?.selectedCardId || null;
      noteHandled({ type: "pass-reserve", cardId });
      pendingPassReserveSelection = null;
      return { ok: true, progressed: true, cardId };
    };
  }
  context.getMovableTokensForPlayer = (playerId) => (options.movableTokens || [])
    .filter((token) => !playerId || token.playerId === playerId);
  if (options.recordMove) {
    context.moveRocket = (deltaX, deltaY, rocketId) => {
      noteHandled({
        type: "move",
        deltaX: Number(deltaX),
        deltaY: Number(deltaY),
        rocketId: Number(rocketId),
      });
      return { ok: true, progressed: true };
    };
  }

  return {
    white,
    blue,
    extraPlayers,
    allPlayers,
    playerState,
    turnState,
    controller: createAiController(context),
    getHandled: () => handled,
    getHandledEvents: () => handledEvents.slice(),
    getScheduledTimers: () => scheduledTimers.slice(),
  };
}

function makeHiddenAlienSlot(traceOwners = {}) {
  const traces = {};
  for (const traceType of ["yellow", "pink", "blue"]) {
    const owner = traceOwners[traceType] || null;
    traces[traceType] = {
      firstPlaced: Boolean(owner),
      ownerPlayerId: owner?.id || null,
      ownerPlayerColor: owner?.color || owner || null,
      extraCount: 0,
    };
  }
  return { revealed: false, traces };
}

function makeChongTransportAlienState(options = {}) {
  const rocketId = String(options.rocketId || 77);
  const fossilId = options.fossilId || "fossil_02";
  const destinationPlanetId = options.destinationPlanetId || "earth";
  const chongState = chong.createChongState();
  chongState.fossilsById[fossilId] = {
    fossilId,
    status: "transported",
    location: "transported",
    destinationPlanetId,
    fossilRewardRepeat: options.fossilRewardRepeat ?? 1,
    taskGain: { ...(options.taskGain || {}) },
    taskDataCount: options.taskDataCount || 0,
    taskPickCard: Boolean(options.taskPickCard),
  };
  chongState.transportTasksByRocketId[rocketId] = {
    fossilId,
    destinationPlanetId,
    cardId: options.cardId || "chong-test",
  };
  return {
    aliens: {
      1: { revealed: true, alienId: chong.ALIEN_ID, assignedAlienId: chong.ALIEN_ID },
    },
    chong: chongState,
  };
}

function makeChongAvailableFossilAlienState(options = {}) {
  const fossilId = options.fossilId || "fossil_02";
  const planetId = options.planetId || "jupiter";
  const chongState = chong.createChongState();
  chongState.revealedSlotId = 1;
  chongState.planetFossilIds = { jupiter: [], saturn: [] };
  chongState.planetFossilIds[planetId] = [fossilId];
  chongState.fossilsById[fossilId] = {
    fossilId,
    status: "available",
    location: "planet",
    planetId,
    visibleToPlayerIds: [],
  };
  return {
    aliens: {
      1: { revealed: true, alienId: chong.ALIEN_ID, assignedAlienId: chong.ALIEN_ID },
    },
    chong: chongState,
  };
}
function makeBanrenmaAlienState() {
  const alienGameState = {
    aliens: {
      1: { revealed: true, alienId: banrenma.ALIEN_ID, assignedAlienId: banrenma.ALIEN_ID },
    },
    banrenma: banrenma.createBanrenmaState(),
  };
  banrenma.ensureTraceGrid(alienGameState, 1);
  return alienGameState;
}

function makeAomomoAlienState() {
  const alienGameState = {
    aliens: {
      1: { revealed: true, alienId: aomomo.ALIEN_ID, assignedAlienId: aomomo.ALIEN_ID },
    },
    aomomo: aomomo.createAomomoState(),
  };
  aomomo.ensureTraceGrid(alienGameState, 1);
  return alienGameState;
}

function makeYichangdianAlienState(options = {}) {
  const yState = yichangdian.createYichangdianState();
  yState.revealedSlotId = 1;
  yState.revealInitialized = true;
  yState.anomalies = options.anomalies || [
    { markerId: "a_2", traceType: "pink", sectorX: 6, y: 4, triggeredCount: 0 },
    { markerId: "b_1", traceType: "yellow", sectorX: 4, y: 4, triggeredCount: 0 },
    { markerId: "c_2", traceType: "blue", sectorX: 0, y: 4, triggeredCount: 0 },
  ];
  const alienGameState = {
    aliens: {
      1: { revealed: true, alienId: yichangdian.ALIEN_ID, assignedAlienId: yichangdian.ALIEN_ID },
    },
    yichangdian: yState,
  };
  yichangdian.ensureTraceGrid(alienGameState, 1);
  return alienGameState;
}

{
  const red = { id: "player-red", color: "red", colorLabel: "Red" };
  const yellow = { id: "player-yellow", color: "yellow", colorLabel: "Yellow" };
  const offers = Object.fromEntries(
    ["player-blue", "player-red", "player-yellow"].map((playerId) => [playerId, {
      industryOptions: [{ id: `industry:baseline-${playerId}`, label: "层云核心" }],
      initialOptions: [],
    }]),
  );
  const harness = createAiControllerHarness(null, {
    extraPlayers: [red, yellow],
    initialSelectionActive: true,
    initialSelectionOffers: offers,
    recordInitialSelection: true,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id, red.id, yellow.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const expectedIndustries = [
    [harness.blue.id, "industry:寰宇超动力", "寰宇超动力"],
    [red.id, "industry:宇宙大战略集团", "宇宙大战略集团"],
    [yellow.id, "industry:作弊实验室", "作弊实验室"],
  ];
  for (const [playerId, expectedId, expectedLabel] of expectedIndustries) {
    harness.playerState.currentPlayerId = playerId;
    const result = harness.controller.runAiAutomationStep();
    assert.equal(result.ok, true, `${expectedLabel} AI initial selection should complete`);
    assert.equal(offers[playerId].selectedIndustryId, expectedId);
    const selected = offers[playerId].industryOptions
      .find((card) => card.id === offers[playerId].selectedIndustryId);
    assert.equal(selected?.label, expectedLabel);
    assert.equal(selected?.aiOnly, true);
  }
}

{
  const turnChoices = [];
  const strategyIndustry = { id: "industry:宇宙大战略集团", label: "宇宙大战略集团" };
  const strategyRewards = {
    yellow: { credits: 1 },
    red: { publicity: 1 },
    blue: { data: 1 },
  };
  const publicScoreCard = {
    id: "strategy-public-score",
    cardId: "strategy-public-score",
    cardName: "Strategy public score",
    price: 0,
    scanActionCode: 2,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 8 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    canStartMainAction: true,
    realisticCanAfford: true,
    blueInitialSelection: { industry: strategyIndustry },
    blueIndustryStrategyPassiveSlots: { yellow: true, red: true, blue: false },
    blueResources: { score: 86, credits: 2, energy: 1, publicity: 2, handSize: 2 },
    publicCards: [publicScoreCard],
    industry: {
      STRATEGY_PASSIVE_SLOT_IDS: ["yellow", "red", "blue"],
      getIndustryActionMarkerLayout: () => ({ percentX: 9, percentY: 77, radiusPercent: 4.9 }),
      canMarkIndustryAction: () => ({ ok: true }),
      getIndustryDefinition: () => ({
        label: "宇宙大战略集团",
        activeAbilityId: "strategy_pick_card",
        passiveIds: ["strategy_passive_reward_slots", "grand_strategy_round_start"],
      }),
      playerHasStrategyPassive: () => true,
      hasGrandStrategyRoundStart: () => true,
      getStrategySlotReward: (slotId) => strategyRewards[slotId] || null,
      getStrategySlotRewardLabel: (slotId) => {
        if (slotId === "yellow") return "1 信用点";
        if (slotId === "red") return "1 宣传";
        if (slotId === "blue") return "1 数据";
        return "";
      },
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .find((candidate) => candidate.id === "industry" && candidate.abilityId === "strategy_pick_card")
      || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should enumerate the grand strategy 1x diagnostic candidate");
  const industryCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "industry" && candidate.abilityId === "strategy_pick_card");
  assert.ok(industryCandidate, "grand strategy 1x candidate should be available");
  assert.equal(
    industryCandidate.valueBreakdown?.industryPublicPick?.bestCard?.cardId,
    "strategy-public-score",
    "industry public-pick diagnostics should expose the best public card",
  );
  assert.deepEqual(
    industryCandidate.valueBreakdown?.strategyPassiveSlots?.occupiedSlotIds,
    ["yellow", "red"],
    "grand strategy diagnostics should expose occupied passive reward slots",
  );
  assert.deepEqual(
    industryCandidate.valueBreakdown?.strategyPassiveSlots?.emptySlotIds,
    ["blue"],
    "grand strategy diagnostics should expose empty passive reward slots",
  );
  assert.equal(
    industryCandidate.valueBreakdown?.strategyPassiveSlots?.roundStartClearsSlots,
    true,
    "grand strategy diagnostics should record the round-start auto-clear rule",
  );
}

{
  const turnChoices = [];
  const strategyIndustry = { id: "industry:宇宙大战略集团", label: "宇宙大战略集团" };
  const lowSignalPublicCard = {
    id: "low-signal-public-card",
    cardId: "low-signal-public-card",
    cardName: "Low signal public card",
    price: 0,
    scanActionCode: 1,
    playEffects: [{ type: "draw_cards", options: { count: 1 } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    canStartMainAction: true,
    realisticCanAfford: true,
    blueInitialSelection: { industry: strategyIndustry },
    blueIndustryStrategyPassiveSlots: { yellow: false, red: false, blue: false },
    blueAiDifficulty: "weak_start",
    blueResources: { score: 20, credits: 2, energy: 1, publicity: 2, handSize: 2 },
    publicCards: [lowSignalPublicCard],
    industry: {
      STRATEGY_PASSIVE_SLOT_IDS: ["yellow", "red", "blue"],
      getIndustryActionMarkerLayout: () => ({ percentX: 9, percentY: 77, radiusPercent: 4.9 }),
      canMarkIndustryAction: () => ({ ok: true }),
      getIndustryDefinition: () => ({
        label: "宇宙大战略集团",
        activeAbilityId: "strategy_pick_card",
        passiveIds: ["strategy_passive_reward_slots", "grand_strategy_round_start"],
      }),
      playerHasStrategyPassive: () => true,
      hasGrandStrategyRoundStart: () => true,
      getStrategySlotReward: (slotId) => ({
        yellow: { credits: 1 },
        red: { publicity: 1 },
        blue: { data: 1 },
      }[slotId] || null),
      getStrategySlotRewardLabel: (slotId) => ({
        yellow: "1 信用点",
        red: "1 宣传",
        blue: "1 数据",
      }[slotId] || ""),
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const industryCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "industry" && candidate.abilityId === "strategy_pick_card");
  assert.equal(
    industryCandidate,
    undefined,
    "early empty grand strategy 1x should wait when the best public card has no concrete play chain",
  );
}

{
  const makeSolarPanelCard = () => ({
    id: "dlc_27.png",
    cardId: "dlc_27.png",
    cardName: "更优太阳能板",
    price: 0,
    typeCode: 0,
    scanActionCode: 1,
    playEffects: [{
      type: "card_conditional_reward",
      label: "若当前能量为0，按己方太阳系探测器数获得能量",
      options: {
        condition: { type: "resourceEquals", resource: "energy", count: 0 },
        rewards: [{
          type: "card_count_rockets_reward",
          label: "每个己方太阳系探测器或虫族搬运化石：1能量",
          options: { resource: "energy", owner: "current", location: "solar", per: 1, includeTransportedChongFossils: true },
        }],
      },
    }],
  });
  const noRocketChoices = [];
  const noRocketHarness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    blueResources: { score: 80, credits: 3, energy: 0, publicity: 0 },
    blueHand: [makeSolarPanelCard()],
    onChooseTurnAction: (candidates) => noRocketChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard")
      || candidates.find((candidate) => candidate.id === "end-turn")
      || candidates[0]
      || null,
  });
  assert.equal(
    noRocketHarness.controller.configureAiAutoBattle({
      playerIds: [noRocketHarness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  noRocketHarness.controller.runAiAutomationStep();
  const noRocketPlay = noRocketChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  assert.equal(noRocketPlay?.available, false, "zero-rocket solar panel should not be a playable positive candidate");
  assert.equal(noRocketPlay?.playableCards?.length || 0, 0);

  const twoRocketChoices = [];
  const twoRocketHarness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordBeginPlayCard: true,
    blueResources: { score: 80, credits: 3, energy: 0, publicity: 0 },
    blueHand: [makeSolarPanelCard()],
    movableTokens: [
      { id: 1, playerId: "player-blue", color: "blue", kind: "standard", surface: "solar", sector: { x: 1, y: 1 } },
      { id: 2, playerId: "player-blue", color: "blue", kind: "standard", surface: "solar", sector: { x: 2, y: 1 } },
    ],
    onChooseTurnAction: (candidates) => twoRocketChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });
  assert.equal(
    twoRocketHarness.controller.configureAiAutoBattle({
      playerIds: [twoRocketHarness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  const twoRocketResult = twoRocketHarness.controller.runAiAutomationStep();
  assert.equal(twoRocketResult.ok, true, "two-rocket solar panel play should remain available");
  const twoRocketPlay = twoRocketChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  assert.equal(twoRocketPlay?.cardId, "dlc_27.png");
  const twoRocketCard = twoRocketPlay?.playableCards?.[0] || twoRocketPlay;
  assert.ok(
    Number(twoRocketCard?.valueBreakdown?.effectValue || 0) > 0,
    "two-rocket solar panel should value the actual energy gain",
  );

  const fossilTokenChoices = [];
  const fossilTokenHarness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordBeginPlayCard: true,
    blueResources: { score: 80, credits: 3, energy: 0, publicity: 0 },
    blueHand: [makeSolarPanelCard()],
    movableTokens: [
      { id: 1, playerId: "player-blue", color: "blue", kind: "chong-fossil", surface: "solar", sector: { x: 1, y: 1 } },
      { id: 2, playerId: "player-blue", color: "blue", kind: "chong-fossil", surface: "solar", movementLocked: true, sector: { x: 2, y: 1 } },
    ],
    onChooseTurnAction: (candidates) => fossilTokenChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });
  assert.equal(
    fossilTokenHarness.controller.configureAiAutoBattle({
      playerIds: [fossilTokenHarness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  const fossilTokenResult = fossilTokenHarness.controller.runAiAutomationStep();
  assert.equal(fossilTokenResult.ok, true, "transported fossil should make solar panel playable");
  const fossilTokenPlay = fossilTokenChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  assert.equal(fossilTokenPlay?.cardId, "dlc_27.png");
  const fossilTokenCard = fossilTokenPlay?.playableCards?.[0] || fossilTokenPlay;
  assert.ok(
    Number(fossilTokenCard?.valueBreakdown?.effectValue || 0) > 0,
    "solar panel should value an unlocked transported Chong fossil as one rocket",
  );
}

{
  const turnChoices = [];
  const selectedActions = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    canStartMainAction: true,
    canPayForMove: true,
    realisticCanAfford: true,
    blueResources: { score: 12, credits: 4, energy: 2, publicity: 3, handSize: 0 },
    planetLocations: [{ planetId: "earth", x: 3, y: 1 }],
    findAvailableSlotIndex: () => 0,
    actionChecks: {
      launch: { ok: true },
    },
    onChooseTurnAction: (candidates, selected) => {
      turnChoices.push(candidates);
      selectedActions.push(selected);
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  harness.controller.runAiAutomationStep();
  const candidates = turnChoices.flat();
  const launchCandidate = candidates.find((candidate) => candidate.id === "launch");
  const passCandidate = candidates.find((candidate) => candidate.id === "pass");
  assert.ok(launchCandidate, "weak launch route scenario should expose launch candidate");
  assert.ok(passCandidate, "weak launch route scenario should expose pass candidate");
  assert.ok(
    Number(launchCandidate.valueBreakdown?.weakEarlyPostLaunchRoutePenalty || 0) > 0,
    "weak post-launch route should be penalized before selecting launch",
  );
  assert.ok(
    Number(launchCandidate.score || 0) < Number(passCandidate.score || 0),
    "weak post-launch route should not beat pass on early launch base value alone",
  );
  assert.notEqual(selectedActions[0]?.id, "launch");
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingCardTriggerAction: {
      matches: [
        {
          card: { id: "unsupported-test", cardName: "unsupported" },
          trigger: { id: "unsupported-trigger" },
          effect: { type: "unsupported_trigger_effect", label: "无法自动处理的触发" },
        },
        {
          card: { id: "runezu-2", cardName: "符文族2" },
          trigger: { id: "runezu2-orbit-land-s4" },
          effect: {
            type: runezu.EFFECT_TYPES.SYMBOL_REWARD,
            label: "符文族任务：符文4奖励",
            options: { symbolId: "symbol_4" },
          },
        },
      ],
    },
    recordCardTriggerChoice: true,
    recordCancelCardTriggerChoice: true,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "Runezu symbol card trigger should be selectable by AI");
  assert.deepEqual(harness.getHandled(), { type: "card-trigger", choiceIndex: 1 });
}

{
  const harness = createAiControllerHarness("blue", { currentPlayerDiscardPending: true });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "color-owned Jiuzhe pending should be handled before current-player subflows");
  assert.deepEqual(harness.getHandled(), { type: "skip", automated: true });
}

{
  const harness = createAiControllerHarness("white");
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.blocked, true, "human-owned Jiuzhe pending should not be handled by AI");
  assert.equal(harness.getHandled(), null);
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetPending: {
      type: "pay_credit_reward",
      playerColor: "blue",
      effect: {
        id: "pay-credit-test",
        options: { reward: { type: "gain_resources", options: { gain: { score: 2, publicity: 2 } } } },
      },
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned pay-credit pending should resolve even when current player is human");
  assert.deepEqual(harness.getHandled(), { type: "pay-credit", choice: "pay" });
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetPending: {
      type: "pay_credit_reward",
      playerColor: "white",
      effect: {
        id: "human-pay-credit-test",
        options: { reward: { type: "gain_resources", options: { gain: { score: 2, publicity: 2 } } } },
      },
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.blocked, true, "human-owned rare pending should wait for the human player");
  assert.equal(harness.getHandled(), null);
}

{
  const harness = createAiControllerHarness(null, {
    blueHand: [
      { id: "income-card", incomeGain: { credits: 1 } },
      { id: "blank-card" },
    ],
    scanTargetPending: {
      type: "discard_any_income",
      playerColor: "blue",
      effect: { id: "discard-income-test" },
      selectedCardIds: [],
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned discard-income pending should confirm safely");
  assert.equal(harness.getHandled().type, "discard-income-confirm");
}

{
  const pendingDiscardAction = { type: "initial_income", selectedIndexes: [] };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingDiscardAction,
    discardCount: 4,
    blueResources: { credits: 2, energy: 1, handSize: 6, score: 0 },
    blueIncome: { credits: 2, energy: 1, handSize: 1 },
    blueHand: [
      { id: "credit-income-1", incomeGain: { credits: 1 } },
      { id: "credit-income-2", incomeGain: { credits: 1 } },
      { id: "credit-income-3", incomeGain: { credits: 1 } },
      { id: "credit-income-4", incomeGain: { credits: 1 } },
      { id: "energy-income", incomeGain: { energy: 1 } },
      { id: "hand-income", incomeGain: { handSize: 1 } },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve multi-income discard selection");
  const selectedGains = pendingDiscardAction.selectedIndexes
    .map((index) => harness.blue.hand[index]?.incomeGain || {});
  assert.equal(
    selectedGains.some((gain) => Number(gain.energy || 0) > 0),
    true,
    "multi-income selection should include energy after simulating earlier credit gains",
  );
  assert.equal(
    selectedGains.some((gain) => Number(gain.handSize || 0) > 0),
    true,
    "multi-income selection should include hand income after simulating earlier gains",
  );
  assert.ok(
    selectedGains.filter((gain) => Number(gain.credits || 0) > 0).length <= 2,
    "multi-income selection should not spend all four choices on credit income",
  );
}

{
  const pendingDiscardAction = { type: "initial_income", selectedIndexes: [] };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    pendingDiscardAction,
    discardCount: 1,
    blueResources: { credits: 0, energy: 5, handSize: 6, score: 52 },
    blueIncome: { credits: 2, energy: 1, handSize: 1 },
    blueCompanyBaseIncome: { credits: 2, energy: 1, handSize: 1 },
    blueHand: [
      { id: "credit-after-base", incomeGain: { credits: 1 } },
      { id: "hand-after-base", incomeGain: { handSize: 1 } },
    ],
    finalScoringState: {
      tiles: {
        a: {
          id: "a",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
      },
    },
    finalTileVariants: { a: 2 },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve income discard with company base income excluded from final scoring");
  const [selectedIndex] = pendingDiscardAction.selectedIndexes;
  assert.equal(
    harness.blue.hand[selectedIndex]?.id,
    "credit-after-base",
    "a2 income-final fit should use income increases, not company base income",
  );
}

{
  const pendingDiscardAction = { type: "initial_income", selectedIndexes: [] };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    pendingDiscardAction,
    discardCount: 2,
    blueResources: { credits: 1, energy: 2, handSize: 1, score: 18 },
    blueIncome: { credits: 5, energy: 3, handSize: 2 },
    blueHand: [
      { id: "credit-income-surplus-1", incomeGain: { credits: 1 } },
      { id: "credit-income-surplus-2", incomeGain: { credits: 1 } },
      { id: "hand-income-engine", incomeGain: { handSize: 1 } },
      { id: "task-engine-card", model: { tasks: [{ id: "task-a", rewards: [{ type: "gain_resources", options: { gain: { score: 6 } } }] }] } },
      { id: "tech-engine-card", playEffects: [{ type: "card_research_tech", options: { techTypes: ["orange"] } }] },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve engine-aware income discard selection");
  const selectedGains = pendingDiscardAction.selectedIndexes
    .map((index) => harness.blue.hand[index]?.incomeGain || {});
  assert.equal(
    selectedGains.some((gain) => Number(gain.handSize || 0) > 0),
    true,
    "hand income should stay valuable at income 2 when a task/card engine needs fuel",
  );
  assert.ok(
    selectedGains.filter((gain) => Number(gain.credits || 0) > 0).length <= 1,
    "engine backlog should not spend both choices on surplus credit income",
  );
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetPending: {
      type: "remove_orbit_to_probe",
      playerColor: "blue",
      effect: { id: "remove-orbit-test" },
      choices: [{ id: "mars:1" }],
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned remove-orbit pending should pick a legal choice");
  assert.deepEqual(harness.getHandled(), { type: "remove-orbit-to-probe", choiceId: "mars:1" });
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetPending: {
      type: "return_unfinished_task",
      playerColor: "blue",
      effect: { id: "return-task-test" },
      choices: [{ id: "task-expensive", price: 4 }, { id: "task-cheap", price: 1 }],
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned return-task pending should pick a legal task");
  assert.deepEqual(harness.getHandled(), { type: "return-task", cardId: "task-cheap" });
}

{
  const harness = createAiControllerHarness(null, {
    probeSectorPending: {
      playerColor: "blue",
      effect: { id: "probe-sector-test", options: { maxTargets: 2 } },
      choices: [
        { rocket: { id: 1 }, sector: { x: 2, y: 3 } },
        { rocket: { id: 2 }, sector: { x: 4, y: 3 } },
      ],
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned probe-sector pending should select legal rockets and confirm");
  assert.deepEqual(harness.getHandledEvents().map((event) => event.type), [
    "probe-sector-choice",
    "probe-sector-choice",
    "probe-sector-confirm",
  ]);
}

{
  const harness = createAiControllerHarness(null, {
    probeLocationPending: {
      playerColor: "blue",
      effect: { id: "probe-location-test" },
      choices: [{ rocket: { id: 1 } }, { rocket: { id: 2 } }],
    },
    scanTargetButtons: [
      makeButton({ probeLocationRewardRocketId: "1" }, "R1 0 数据"),
      makeButton({ probeLocationRewardRocketId: "2" }, "R2 3 数据"),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned probe-location pending should select the best legal rocket");
  assert.deepEqual(harness.getHandled(), { type: "probe-location", rocketId: 2 });
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetHidden: true,
    scanTargetPending: {
      type: "public_scan",
      playerColor: "blue",
      choices: [
        { nebulaId: "low-nebula", sectorX: 2, label: "Low nebula" },
        { nebulaId: "high-nebula", sectorX: 4, label: "High nebula" },
      ],
    },
    data: {
      getNextReplaceableNebulaToken: (_state, nebulaId) => ({
        slotIndex: nebulaId === "high-nebula" ? 3 : 1,
      }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [{}, {}],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve hidden-overlay scan pending from choices");
  assert.deepEqual(harness.getHandled(), {
    type: "scan-target",
    nebulaId: "high-nebula",
    sectorX: 4,
  });
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetHidden: true,
    scanTargetPending: {
      type: "public_scan",
      playerColor: "blue",
      card: { id: "scan-card", cardName: "Scan card" },
    },
    getPublicScanChoicesForCard: () => ({
      ok: true,
      choices: [
        { nebulaId: "low-nebula", sectorX: 2, label: "Low nebula" },
        { nebulaId: "high-nebula", sectorX: 4, label: "High nebula" },
      ],
    }),
    data: {
      getNextReplaceableNebulaToken: (_state, nebulaId) => ({
        slotIndex: nebulaId === "high-nebula" ? 3 : 1,
      }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [{}, {}],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should recover public-scan target choices from the pending card");
  assert.deepEqual(harness.getHandled(), {
    type: "scan-target",
    nebulaId: "high-nebula",
    sectorX: 4,
  });
}

{
  const harness = createAiControllerHarness(null, {
    landTargetPending: {
      playerColor: "blue",
      getOptions: () => ({ ok: false, message: "skip scoring in harness" }),
    },
    landTargetSelectOptions: [{}, {}],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned land-target pending should resolve while current player is human");
  assert.deepEqual(harness.getHandled(), { type: "land-target", selectedIndex: 0 });
}

{
  const harness = createAiControllerHarness(null, {
    dataPlacePending: {
      playerColor: "blue",
      effect: { id: "data-place-test" },
    },
    dataPlaceButtons: [
      makeButton({ placeTarget: "computer" }, "放置位 2"),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned data placement should resolve while current player is human");
  assert.deepEqual(harness.getHandled(), { type: "data-placement", target: "computer", blueSlot: null });
}

{
  const pendingMovePayment = {
    player: null,
    rocketId: 7,
    deltaX: 1,
    deltaY: 0,
    requiredMovePoints: 1,
    selectedHandIndices: [],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "white",
    pendingMovePayment,
    rocketState: {
      rockets: [{ id: 7, playerId: "player-blue", sector: { x: 2, y: 2 } }],
    },
  });
  pendingMovePayment.player = harness.blue;
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned move payment should resolve while current interface player is human");
  assert.deepEqual(harness.getHandled(), {
    type: "move-payment",
    automated: true,
    playerId: harness.blue.id,
    selectedHandIndices: [],
  });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerDiscardPending: true,
    readyBanrenmaPlayerColor: "blue",
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should open ready Banrenma panel marks before current-player subflows");
  assert.deepEqual(harness.getHandled(), {
    type: "banrenma-ready",
    playerColor: "blue",
    includeCards: false,
  });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    readyBanrenmaPlayerColor: "blue",
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should open current player's ready Banrenma card conditions");
  assert.deepEqual(harness.getHandled(), {
    type: "banrenma-ready",
    playerColor: "blue",
    includeCards: true,
  });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    runezuQuick: true,
    blueRunezuSymbols: { symbol_4: 1 },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should open Runezu face symbol quick action after reveal");
  assert.equal(harness.getHandled().type, "runezu-face-symbol-open");
  assert.equal(harness.getHandled().alienSlotId, 1);
  assert.ok([4, 5, 6, 7].includes(harness.getHandled().position));
}

{
  let selectedTurnAction = null;
  let seenTurnCandidates = [];
  const runezuCard2 = runezu.createAlienCard(2, 1);
  runezuCard2.runezuTaskProgress = [{ event: "orbitOrLand", symbolId: "symbol_4" }];
  const runezuCard4 = runezu.createAlienCard(4, 2);
  runezuCard4.runezuTaskProgress = [{ event: "scan", symbolId: "symbol_4" }];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    roundNumber: 3,
    runezuQuick: true,
    runezuFaceSymbolSlots: {
      3: "symbol_3",
      4: "symbol_4",
      6: "symbol_6",
      7: "symbol_7",
    },
    blueRunezuSymbols: {
      symbol_1: 1,
      symbol_2: 1,
      symbol_5: 1,
    },
    blueResources: { availableData: 1 },
    blueHand: [
      runezuCard2,
      runezuCard4,
      runezu.createAlienCard(6, 3),
    ],
    onChooseTurnAction: (_candidates, selected) => {
      selectedTurnAction = selected;
      seenTurnCandidates = _candidates.slice();
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
    data: {
      PLACEMENT_KIND_COMPUTER: "computer",
      PLACEMENT_KIND_BLUE_BONUS: "blueBonus",
      getComputerSlotBonus: () => null,
      canPlaceAnyData: () => ({
        ok: true,
        choices: [{
          target: "computer",
          placementSlot: 1,
          label: "第一排放置位 1",
          description: "按从左到右放入第一排第 1 位",
        }],
      }),
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should evaluate Runezu face symbols by real score");
  assert.equal(harness.getHandled().type, "runezu-face-symbol-open");
  assert.equal(
    harness.getHandled().position,
    5,
    "AI should fill Runezu position 5 when it unlocks follow-up position 1/2 symbol rewards",
  );
  assert.ok(
    seenTurnCandidates.some((candidate) => candidate.id === "placeData"),
    "Runezu dependency test should compare against a normal low-value data placement",
  );
  assert.ok(
    Number(selectedTurnAction?.valueBreakdown?.dependencyUnlockValue || 0) > 0,
    "Runezu position 5 candidate should carry dependency unlock value",
  );
}

{
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    earthCoordinate: { x: 1, y: 1 },
    alienGameState: makeYichangdianAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "yichangdian-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["yellow", "blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", yichangdianTraceType: "blue", yichangdianTraceSlot: "1", yichangdianPosition: "1" },
        "异常点蓝色 1号位：1能量，即将触发异常奖励",
        false,
        () => selected.push("soon-anomaly"),
      ),
      makeButton(
        { alienSlot: "1", yichangdianTraceType: "yellow", yichangdianTraceSlot: "4", yichangdianPosition: "4" },
        "异常点黄色 4号位：2分，外星人牌",
        false,
        () => selected.push("alien-card"),
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve Yichangdian trace picker");
  assert.deepEqual(
    selected,
    ["alien-card"],
    "AI should take an early Yichangdian alien-card trace before chasing a low-value immediate anomaly",
  );
}

{
  const yState = yichangdian.createYichangdianState();
  yState.revealedSlotId = 1;
  yState.revealInitialized = true;
  yState.anomalies = [
    { markerId: "b_1", traceType: "yellow", sectorX: 7, y: 4, triggeredCount: 0 },
    { markerId: "c_2", traceType: "blue", sectorX: 0, y: 4, triggeredCount: 0 },
  ];
  const alienGameState = {
    aliens: {
      1: { revealed: true, alienId: yichangdian.ALIEN_ID, assignedAlienId: yichangdian.ALIEN_ID },
    },
    yichangdian: yState,
  };
  yichangdian.ensureTraceGrid(alienGameState, 1);
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    alienGameState,
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "yichangdian-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["yellow", "blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", yichangdianTraceType: "yellow", yichangdianTraceSlot: "2", yichangdianPosition: "2" },
        "异常点黄色 2号位",
        false,
        () => selected.push("yellow-2"),
      ),
      makeButton(
        { alienSlot: "1", yichangdianTraceType: "blue", yichangdianTraceSlot: "1", yichangdianPosition: "1" },
        "异常点蓝色 1号位",
        false,
        () => selected.push("blue-1"),
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve Yichangdian trace picker");
  assert.deepEqual(selected, ["blue-1"], "AI should claim the soon energy anomaly color over the old fixed yellow-2 preference");
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "white",
    alienTracePickerState: {
      mode: "fangzhou-use",
      targetPlayerId: "player-blue",
      selectedAlienSlotId: 1,
      selectedTraceType: "blue",
      allowedTraceTypes: ["blue"],
    },
    alienPickerButtons: [
      makeButton(
        { alienPickerStep: "fangzhou-use", alienSlot: "1", traceType: "blue", fangzhouUse: "unlock" },
        "解锁蓝色方舟牌",
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.scheduleAiAutoStepIfNeeded();
  assert.equal(
    harness.getScheduledTimers().length,
    1,
    "AI-owned Fangzhou trace-use picker should schedule even when the current interface player is human",
  );
}

{
  const selected = [];
  const alienGameState = {
    aliens: {
      1: makeHiddenAlienSlot({ blue: "blue" }),
      2: makeHiddenAlienSlot({ yellow: "green", pink: "white" }),
    },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    alienSlotIds: [1, 2],
    alienGameState,
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: { mode: "basic", allowedTraceTypes: ["blue"] },
    alienPickerButtons: [
      makeButton(
        { alienPickerStep: "basic", alienSlot: "1", traceType: "blue" },
        "外星人 1 蓝色痕迹 额外 +1",
        false,
        () => selected.push("slot-1-blue"),
      ),
      makeButton(
        { alienPickerStep: "basic", alienSlot: "2", traceType: "blue" },
        "外星人 2 放置蓝色痕迹，首标记 2/3",
        false,
        () => selected.push("slot-2-blue"),
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve hidden alien trace picker");
  assert.deepEqual(selected, ["slot-2-blue"], "AI should complete alien 2 reveal setup before farming old hidden extra traces");
}

{
  const selected = [];
  const alienGameState = makeBanrenmaAlienState();
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    alienGameState,
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "banrenma-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "4", banrenmaPosition: "4" },
        "半人马蓝色痕迹 4号位：3分，外星人牌",
        false,
        () => selected.push("alien-card"),
      ),
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "3", banrenmaPosition: "3" },
        "半人马蓝色痕迹 3号位：5分",
        false,
        () => selected.push("score-5"),
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve late Banrenma trace picker");
  assert.deepEqual(selected, ["score-5"], "AI should discount late alien-card rewards when direct score is available");
}

{
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { availableData: 3, score: 30 },
    blueTechCounts: { blue: 3 },
    alienGameState: makeBanrenmaAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "banrenma-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "2", banrenmaPosition: "2" },
        "半人马蓝色痕迹 2号位：支付 3 数据，15分",
        false,
        () => selected.push("pay-data-score"),
      ),
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "5", banrenmaPosition: "5" },
        "半人马蓝色痕迹 5号位：5分，外星人牌",
        false,
        () => selected.push("card-5"),
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve Banrenma blue-tech trace picker");
  assert.deepEqual(
    selected,
    ["card-5"],
    "AI should delay Banrenma 3-data score conversion when blue tech already covers the data route",
  );
}

{
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { availableData: 4, score: 44 },
    blueTechCounts: { blue: 0 },
    alienGameState: makeBanrenmaAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "banrenma-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "2", banrenmaPosition: "2" },
        "半人马蓝色痕迹 2号位：支付 3 数据，15分",
        false,
        () => selected.push("pay-data-score"),
      ),
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "5", banrenmaPosition: "5" },
        "半人马蓝色痕迹 5号位：5分，外星人牌",
        false,
        () => selected.push("card-5"),
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve Banrenma threshold trace picker");
  assert.deepEqual(
    selected,
    ["pay-data-score"],
    "AI should still take Banrenma 3-data score conversion when it crosses a final-score threshold",
  );
}

{
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { aomomoFossils: 4, score: 42 },
    alienGameState: makeAomomoAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "aomomo-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", aomomoTraceType: "blue", aomomoTraceSlot: "4", aomomoPosition: "4" },
        "奥陌陌蓝色痕迹 4号位：3分，外星人牌，1化石",
        false,
        () => selected.push("fossil-card"),
      ),
      makeButton(
        { alienSlot: "1", aomomoTraceType: "blue", aomomoTraceSlot: "5", aomomoPosition: "5" },
        "奥陌陌蓝色痕迹 5号位：支付 4 化石，25分",
        false,
        () => selected.push("spend-four-fossils"),
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should cash out Aomomo 4-fossil trace when ready");
  assert.deepEqual(
    selected,
    ["spend-four-fossils"],
    "AI should prioritize the 25-score Aomomo trace once it has four fossils available",
  );
}

{
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { aomomoFossils: 0, score: 35 },
    alienGameState: makeAomomoAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "aomomo-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", aomomoTraceType: "blue", aomomoTraceSlot: "2", aomomoPosition: "2" },
        "奥陌陌蓝色痕迹 2号位：2分，1化石",
        false,
        () => selected.push("distant-fossil"),
      ),
      makeButton(
        { alienSlot: "1", aomomoTraceType: "blue", aomomoTraceSlot: "3", aomomoPosition: "3" },
        "奥陌陌蓝色痕迹 3号位：3分，外星人牌",
        false,
        () => selected.push("alien-card"),
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should not overbuild a distant Aomomo fossil plan");
  assert.deepEqual(
    selected,
    ["alien-card"],
    "AI should take the card slot instead of overvaluing the first fossil toward a distant 4-fossil trace",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    recordMove: true,
    canPayForMove: true,
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
    earthCoordinate: { x: 1, y: 1 },
    alienGameState: makeChongTransportAlienState({ rocketId: 77 }),
    movableTokens: [
      {
        id: 77,
        kind: "chong-fossil",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 1, y: 3 },
        sectorX: 1,
        sectorY: 3,
      },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should choose a Chong fossil transport move");
  assert.ok(
    turnChoices.some((candidates) => candidates.some((candidate) => candidate.id === "move")),
    "AI should enumerate a legal Chong fossil move candidate",
  );
  assert.deepEqual(
    harness.getHandled(),
    { type: "move", deltaX: 0, deltaY: -1, rocketId: 77 },
    "AI should move transported Chong fossils only closer to Earth",
  );
}

{
  let selectedTurnAction = null;
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    roundNumber: 3,
    blueResources: { score: 42, availableData: 1, handSize: 3, credits: 5, energy: 5 },
    recordMove: true,
    canPayForMove: true,
    onChooseTurnAction: (_candidates, selected) => {
      selectedTurnAction = selected;
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
    data: {
      PLACEMENT_KIND_COMPUTER: "computer",
      PLACEMENT_KIND_BLUE_BONUS: "blueBonus",
      getComputerSlotBonus: (slot) => (Number(slot) === 4
        ? { type: "income", gain: { energy: 1 } }
        : null),
      canPlaceAnyData: () => ({
        ok: true,
        choices: [{
          target: "computer",
          placementSlot: 4,
          label: "第一排放置位 4",
          description: "按从左到右放入第一排第 4 位",
        }],
      }),
    },
    earthCoordinate: { x: 1, y: 1 },
    alienGameState: makeChongTransportAlienState({ rocketId: 77 }),
    movableTokens: [
      {
        id: 77,
        kind: "chong-fossil",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 1, y: 3 },
        sectorX: 1,
        sectorY: 3,
      },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should keep Chong transport moving when an income slot is also available");
  assert.equal(selectedTurnAction?.id, "move", "Chong transport should outrank generic income placement once carried");
  assert.deepEqual(
    harness.getHandled(),
    { type: "move", deltaX: 0, deltaY: -1, rocketId: 77 },
    "AI should cash out carried Chong fossils before extending the generic engine",
  );
}

{
  const moveEffect = { id: "test-chong-card-move", type: "card_move", options: { movementPoints: 1 } };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    recordEffectMove: true,
    canPayForMove: true,
    allowedMoveDeltas: [{ deltaX: 0, deltaY: -1 }],
    earthCoordinate: { x: 1, y: 1 },
    pendingActionEffectFlow: {
      currentIndex: 0,
      effects: [moveEffect],
      cardMoveEffect: { effect: moveEffect, poolRemaining: 1 },
    },
    alienGameState: makeChongTransportAlienState({ rocketId: 77 }),
    movableTokens: [
      {
        id: 77,
        kind: "chong-fossil",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 1, y: 3 },
        sectorX: 1,
        sectorY: 3,
      },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should move Chong fossil during card movement when the step gets closer");
  assert.deepEqual(
    harness.getHandled(),
    { type: "effect-move", deltaX: 0, deltaY: -1, rocketId: 77 },
    "AI card movement should move transported Chong fossils only inward toward Earth",
  );
}

{
  const moveEffect = { id: "test-chong-card-move-away", type: "card_move", options: { movementPoints: 1 } };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    recordEffectMove: true,
    recordSkipCurrentActionEffect: true,
    canPayForMove: true,
    allowedMoveDeltas: [{ deltaX: 0, deltaY: 1 }],
    earthCoordinate: { x: 1, y: 1 },
    pendingActionEffectFlow: {
      currentIndex: 0,
      effects: [moveEffect],
      cardMoveEffect: { effect: moveEffect, poolRemaining: 1 },
    },
    alienGameState: makeChongTransportAlienState({ rocketId: 77 }),
    movableTokens: [
      {
        id: 77,
        kind: "chong-fossil",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 1, y: 3 },
        sectorX: 1,
        sectorY: 3,
      },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should skip Chong fossil card movement when every legal step moves away from Earth");
  assert.equal(result.skipped, true, "away-from-Earth Chong fossil effect movement should be skipped");
  assert.deepEqual(
    harness.getHandled(),
    { type: "skip-effect" },
    "AI should not spend card movement pushing transported Chong fossils outward",
  );
}

{
  const moveEffect = { id: "test-chong-card-move-to-fossil", type: "card_move", options: { movementPoints: 1 } };
  const chongLandEffect = chong.buildImmediateEffects(3).find((effect) => (
    effect.type === chong.EFFECT_TYPES.CHONG_LAND_FOR_PICKUP
  ));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    recordEffectMove: true,
    canPayForMove: true,
    allowedMoveDeltas: [
      { deltaX: 1, deltaY: 0 },
      { deltaX: 0, deltaY: 1 },
    ],
    planetLocations: [
      { planetId: "jupiter", label: "木星", name: "木星", x: 1, y: 2 },
      { planetId: "uranus", label: "天王星", name: "天王星", x: 0, y: 3 },
    ],
    planetStats: {
      canAddLandingMarker: () => true,
      canAddOrbitMarker: () => true,
      getAvailableSatellitesForLanding: () => [],
      getPlanetLandingCount: () => 0,
      getPlanetOrbitCount: () => 0,
    },
    pendingActionEffectFlow: {
      currentIndex: 0,
      effects: [moveEffect, chongLandEffect],
      cardMoveEffect: { effect: moveEffect, poolRemaining: 1 },
    },
    alienGameState: makeChongAvailableFossilAlienState({ planetId: "jupiter" }),
    movableTokens: [
      {
        id: 77,
        kind: "standard",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 0, y: 2 },
        sectorX: 0,
        sectorY: 2,
      },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should move toward a Chong fossil pickup planet before the pickup landing");
  assert.deepEqual(
    harness.getHandled(),
    { type: "effect-move", deltaX: 1, deltaY: 0, rocketId: 77 },
    "AI should prefer Jupiter over a non-fossil high-score landing when a Chong pickup follows",
  );
}
{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    blueResources: { credits: 5, energy: 5, handSize: 1 },
    blueHand: [chong.createAlienCard(8, 1)],
    abilities: {
      planet: {
        DEFAULT_ORBIT_COST: { credits: 1, energy: 1 },
        BASE_LAND_ENERGY_COST: 3,
        getLandEnergyCost: () => 0,
        getLandOptions: () => ({
          ok: true,
          choices: [{
            planetId: "mars",
            planet: { planetId: "mars", label: "火星", name: "火星" },
            target: { type: "planet" },
            energyCost: 0,
            label: "登陆火星",
          }],
        }),
        getOrbitOptions: () => ({ ok: false, message: "orbit disabled in harness" }),
      },
      rocket: {
        ORANGE1_ROCKET_LIMIT: 4,
        getRocketLimitForPlayer: () => 3,
      },
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.blocked, true, "AI should not play a Chong transport card when only non-fossil planets are landable");
  assert.equal(harness.getHandled(), null);
}
{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    blueHand: [chong.createAlienCard(2, 1)],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should select a playable Chong alien card from hand");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 0, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    runezuQuick: true,
    blueHand: [runezu.createAlienCard(4, 1)],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.blocked, true, "AI should wait on Runezu task cards until the next task symbol has a face reward");
  assert.equal(harness.getHandled(), null);
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    runezuQuick: true,
    runezuFaceSymbolSlots: { 4: "symbol_4" },
    blueHand: [runezu.createAlienCard(4, 1)],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should play Runezu task cards once the next task symbol has a face reward");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 0, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    blueHand: [{
      ...fangzhou.createCard2Definition("pink", 1),
      id: "fangzhou-card2-ai-test",
      faceUp: true,
      fangzhouCard2: true,
      fangzhouTraceType: "pink",
    }],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should select a playable Fangzhou card2 from hand");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 0, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    blueHand: [
      { id: "low-value-blank", cardName: "低价值空牌", price: 0 },
      {
        ...fangzhou.createCard2Definition("blue", 4),
        id: "fangzhou-card2-priority-test",
        faceUp: true,
        fangzhouCard2: true,
        fangzhouTraceType: "blue",
      },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should prefer Fangzhou card2 advanced reward over a low-value blank card");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 1, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    playCardSelectionActive: true,
    realisticCanAfford: true,
    blueResources: { score: 189, credits: 1, energy: 0, publicity: 7, handSize: 1 },
    blueHand: [{
      id: "pay-credit-score",
      cardName: "Pay credit score",
      price: 0,
      playEffects: [{
        type: "card_pay_credits_for_reward",
        label: "每支付1信用获得2分2宣传",
        options: {
          reward: {
            type: "gain_resources",
            label: "支付1信用：2分+2宣传",
            options: { gain: { score: 2, publicity: 2 } },
          },
        },
      }],
    }],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should play supported pay-credit reward cards");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 0, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    playCardSelectionActive: true,
    realisticCanAfford: true,
    blueResources: { score: 189, credits: 1, energy: 2, publicity: 7, handSize: 1 },
    blueHand: [{
      id: "pay-credit-score-with-energy",
      cardName: "Pay credit score with energy",
      price: 0,
      playEffects: [{
        type: "card_pay_credits_for_reward",
        label: "每支付1信用获得2分2宣传",
        options: {
          reward: {
            type: "gain_resources",
            label: "支付1信用：2分+2宣传",
            options: { gain: { score: 2, publicity: 2 } },
          },
        },
      }],
    }],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, false, "AI should keep pay-credit cards out of active play while energy remains");
  assert.equal(harness.getHandled(), null);
}

{
  const defaultHarness = createAiControllerHarness(null);
  assert.equal(
    defaultHarness.controller.configureAiAutoBattle({
      playerIds: [defaultHarness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  assert.equal(defaultHarness.controller.getAiStrategyWeights().engine, 1.3);
  assert.equal(defaultHarness.controller.getAiStrategyWeights().scan, 1.18);

  const weakHarness = createAiControllerHarness(null);
  assert.equal(
    weakHarness.controller.configureAiAutoBattle({
      playerIds: [weakHarness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  assert.equal(weakHarness.controller.getAiStrategyWeights(weakHarness.blue).engine, 1.22);
  assert.equal(weakHarness.controller.getAiStrategyWeights(weakHarness.blue).scan, 1.08);

  const customWeakHarness = createAiControllerHarness(null);
  assert.equal(
    customWeakHarness.controller.configureAiAutoBattle({
      playerIds: [customWeakHarness.blue.id],
      aiDifficulty: "weak_start",
      strategyWeights: { engine: 1.31, scan: 1.21 },
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  assert.equal(customWeakHarness.controller.getAiStrategyWeights(customWeakHarness.blue).engine, 1.31);
  assert.equal(customWeakHarness.controller.getAiStrategyWeights(customWeakHarness.blue).scan, 1.21);
}

{
  const harness = createAiControllerHarness(null);
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      stepDelayMs: 25,
      maxBugRepeats: 5,
      maxMovesPerTurn: 2,
      strategyWeights: { scan: 1.3, pass: 0.7 },
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const snapshot = harness.controller.createAiControlSnapshot();
  assert.equal(snapshot.enabled, true);
  assert.deepEqual(snapshot.playerIds, [harness.blue.id]);
  assert.equal(snapshot.stepDelayMs, 25);
  assert.equal(snapshot.maxBugRepeats, 5);
  assert.equal(snapshot.maxMovesPerTurn, 2);
  assert.equal(snapshot.strategyWeights.scan, 1.3);

  const restored = createAiControllerHarness(null);
  const result = restored.controller.restoreAiControlSnapshot({
    ...snapshot,
    running: true,
    pausedOnBug: true,
  });
  assert.equal(result.ok, true, "valid AI control snapshot should restore");
  assert.equal(restored.controller.isAiAutoBattlePlayer(restored.blue.id), true);
  assert.equal(restored.controller.isAiAutoBattlePlayer(restored.white.id), false);
  assert.equal(restored.controller.isAiAutomationPaused(), false);
  assert.equal(result.clearedPausedOnBug, true);
  assert.equal(restored.controller.getAiStrategyWeights().scan, 1.3);
  assert.equal(restored.controller.getAiAutoBattleReport().running, false, "running state is never restored");

  const pausedRestore = createAiControllerHarness(null);
  const pausedResult = pausedRestore.controller.restoreAiControlSnapshot({
    ...snapshot,
    pausedOnBug: true,
  }, { restorePausedOnBug: true });
  assert.equal(pausedResult.ok, true);
  assert.equal(pausedRestore.controller.isAiAutomationPaused(), true);
}

{
  const harness = createAiControllerHarness(null);
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const missing = harness.controller.restoreAiControlSnapshot(null);
  assert.equal(missing.ok, true);
  assert.equal(missing.defaulted, true);
  assert.equal(missing.missing, true);
  assert.equal(harness.controller.isAiAutoBattlePlayer(harness.blue.id), true);
  assert.equal(harness.controller.isAiAutoBattlePlayer(harness.white.id), false);

  const manual = harness.controller.restoreAiControlSnapshot({
    enabled: false,
    playerIds: [],
  });
  assert.equal(manual.ok, true);
  assert.equal(manual.disabled, true);
  assert.equal(harness.controller.isAiAutoBattlePlayer(harness.blue.id), false);

  const invalid = harness.controller.restoreAiControlSnapshot({
    enabled: true,
    playerIds: ["missing-player"],
  });
  assert.equal(invalid.ok, true);
  assert.equal(invalid.defaulted, true);
  assert.equal(invalid.invalidPlayerIds, true);
  assert.equal(harness.controller.isAiAutoBattlePlayer(harness.blue.id), true);
  assert.equal(harness.controller.isAiAutoBattlePlayer(harness.white.id), false);
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    recordResearchTech: true,
    blueResources: { score: 98, credits: 6, energy: 4, handSize: 0 },
    blueOwnedTechTiles: {
      orange1: true,
      purple1: true,
      blue1: true,
      blue2: true,
    },
    blueTechCounts: { orange: 1, purple: 1, blue: 2 },
    finalScoringState: {
      tiles: {
        final_b1: {
          id: "final_b1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_c2: {
          id: "final_c2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_b1: "b1",
      final_c2: "c2",
      final_d1: "d1",
    },
    finalSlotMultipliers: {
      b1: { 1: 6 },
      c2: { 1: 6 },
      d1: { 1: 8 },
    },
    takeableTechIds: ["orange2", "purple2", "blue3"],
    techStacks: {
      orange2: { techType: "orange", stackIndex: 2 },
      purple2: { techType: "purple", stackIndex: 2 },
      blue3: { techType: "blue", stackIndex: 3 },
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute the low-tech catch-up research action");
  assert.deepEqual(harness.getHandled(), { type: "research-tech" });
  const researchCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "researchTech");
  assert.ok(researchCandidate, "researchTech candidate should be enumerated");
  assert.ok(
    researchCandidate.takeable.some((candidate) => (
      Number(candidate.valueBreakdown?.lowTechCatchupValue || 0) > 0
    )),
    "low-tech D1 tail should receive an explicit lowTechCatchupValue",
  );
  const passCandidate = turnChoices.flat().find((candidate) => candidate.id === "pass");
  assert.ok(
    Number(researchCandidate.score || 0) > Number(passCandidate?.score || -Infinity),
    "low-tech catch-up research should outrank PASS",
  );
}

{
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    recordAnalyze: true,
    blueResources: { score: 75, credits: 1, energy: 1, publicity: 1, availableData: 0, handSize: 3 },
    finalScoringState: {
      tiles: {
        final_a2: {
          id: "final_a2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a2: "a2",
      final_b2: "b2",
      final_d2: "d2",
    },
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: () => ({ ok: true }),
      listComputerPlacedTokens: () => placedTokens,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "analyze") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute the capped analyze action in the harness");
  assert.deepEqual(harness.getHandled(), { type: "analyze" });
  const analyzeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "analyze");
  assert.ok(analyzeCandidate, "analyze candidate should be enumerated");
  assert.ok(
    Number(analyzeCandidate.score || 0) <= 8,
    "final low-value analyze should be capped instead of scoring like a high-value cashout",
  );
}

{
  const turnChoices = [];
  let selectedAction = null;
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    aiDifficulty: "weak_start",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordAnalyze: true,
    blueResources: { score: 106, credits: 1, energy: 2, publicity: 6, availableData: 3, handSize: 3 },
    publicCards: [{
      id: "public-late-scan",
      cardId: "public-late-scan",
      cardName: "Late scan setup",
      scanActionCode: 2,
    }],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_c1: {
          id: "final_c1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_c1: "c1",
      final_d2: "d2",
    },
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 1, energy: 2 },
      getStandardScanCost: () => ({ credits: 1, energy: 2 }),
      buildScanEffectQueue: () => [{ type: "public_card_scan" }],
      canExecuteScan: (player) => (
        Number(player?.resources?.credits || 0) >= 1 && Number(player?.resources?.energy || 0) >= 2
          ? { ok: true }
          : { ok: false, message: "scan resources missing" }
      ),
    },
    getPublicScanChoicesForCard: () => ({
      ok: true,
      choices: [{ nebulaId: "late-nebula", sectorX: 4, label: "Late nebula" }],
    }),
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
      getNextReplaceableNebulaToken: () => ({ slotIndex: 30 }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
    },
    actionGraph: setiAi.actionGraph,
    onChooseTurnAction: (candidates, selected) => {
      turnChoices.push(candidates);
      selectedAction = selected;
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => (
        Number(right.actionGraph?.net ?? right.score ?? 0) - Number(left.actionGraph?.net ?? left.score ?? 0)
      ))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  const candidates = turnChoices.flat();
  const scanCandidate = candidates.find((candidate) => candidate.id === "scan");
  const analyzeCandidate = candidates.find((candidate) => candidate.id === "analyze");
  assert.ok(scanCandidate, "scan candidate should be enumerated");
  assert.ok(analyzeCandidate, "analyze candidate should be enumerated");
  assert.equal(scanCandidate.scoreCapReason, "保留终局分析能量");
  assert.ok(
    Number(scanCandidate.score || 0) < Number(analyzeCandidate.score || 0),
    "weak_start final scan should yield to available analyze when scan spends the last analyze energy",
  );
  assert.ok(
    Number(scanCandidate.actionGraph?.net || 0) < Number(analyzeCandidate.actionGraph?.net || 0),
    "weak_start final scan cap should also suppress action-graph goal bonus below analyze",
  );
  assert.equal(analyzeCandidate.scoreCapReason, "终局分析蓝痕迹与阈值不足");
  assert.equal(result.ok, true, "weak_start final low-resource AI should keep energy for analyze");
  assert.deepEqual(harness.getHandled(), { type: "analyze" });
  assert.equal(selectedAction?.id, "analyze");
}

{
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-energy": {
        id: "credits-for-energy",
        label: "2 credits -> 1 energy",
        cost: { credits: 2 },
        gain: { energy: 1 },
      },
    },
    blueResources: { score: 116, credits: 4, energy: 0, publicity: 0, availableData: 6, handSize: 2 },
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d1: "d1",
    },
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy")
      || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "D1 full-data midgame player should trade credits for energy before analyze");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "credits-for-energy" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy");
  assert.ok(tradeCandidate, "D1 midgame analyze unlock trade should be enumerated");
  assert.equal(tradeCandidate.reason, "中期引擎：信用点换能量解锁分析");
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.midgameAnalyzeUnlockByTrade?.["credits-for-energy"] || 0) > 0,
    "D1 analyze unlock should expose a positive diagnostic score",
  );
}

{
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-energy": {
        id: "credits-for-energy",
        label: "2 credits -> 1 energy",
        cost: { credits: 2 },
        gain: { energy: 1 },
      },
    },
    blueResources: { score: 130, credits: 6, energy: 0, publicity: 0, availableData: 6, handSize: 1 },
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy")
      || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy");
  assert.equal(
    tradeCandidate,
    undefined,
    "D2-only midgame full-data player should not take the D1 analyze unlock trade",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordBeginPlayCard: true,
    takeableTechIds: ["purple1"],
    blueResources: { score: 118, credits: 3, energy: 1, publicity: 8, availableData: 0, handSize: 1 },
    blueHand: [{
      id: "ready-tech-task",
      cardName: "Ready tech task",
      price: 3,
      typeCode: 2,
      playEffects: [{
        type: "card_research_tech",
        options: { skipCost: true, techTypes: ["purple"] },
      }],
      model: {
        tasks: [{
          id: "ready-publicity-score",
          condition: { type: "resourceThreshold", resource: "publicity", count: 8 },
          rewards: [{ type: "gain_resources", options: { gain: { score: 9 } } }],
        }],
      },
    }],
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should enumerate the ready task research card");
  const playCardCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  const readyTaskCandidate = playCardCandidate?.playableCards?.[0] || null;
  assert.ok(readyTaskCandidate, "ready task research card should be a playable candidate");
  assert.ok(
    Number(readyTaskCandidate.valueBreakdown?.readyTaskCashoutValue || 0) >= 15,
    "met hand task should contribute immediate cashout value",
  );
  assert.equal(
    Number(readyTaskCandidate.valueBreakdown?.readyTaskCashoutDirectScore || 0),
    9,
    "ready task cashout should record the direct score reward",
  );
  assert.ok(
    Number(readyTaskCandidate.valueBreakdown?.readyTaskTechReplacementValue || 0) > 0,
    "ready task research card should reuse a bounded research-tech replacement value",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    recordCardCorner: true,
    blueResources: { score: 108, credits: 0, energy: 0, publicity: 4, availableData: 0, handSize: 1 },
    blueHand: [{
      id: "publicity-setup-corner",
      cardName: "Publicity setup corner",
      price: 0,
      resourceReward: { gain: { publicity: 1 } },
    }],
    blueOwnedTechTiles: {
      orange1: true,
      orange2: true,
      purple1: true,
      purple2: true,
      blue1: true,
      blue2: true,
    },
    finalScoringState: {
      tiles: {
        final_a2: {
          id: "final_a2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a2: "a2",
      final_b2: "b2",
      final_d2: "d2",
    },
    finalSlotMultipliers: {
      d2: { 1: 8 },
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should use the first publicity corner toward a low-tech D2 recovery chain");
  assert.deepEqual(harness.getHandled(), { type: "card-corner", handIndex: 0, confirmed: true });
  const cornerCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "cardCorner");
  assert.ok(cornerCandidate, "staged publicity card-corner candidate should be enumerated");
  assert.ok(
    Number(cornerCandidate.valueBreakdown?.stagedTechSetupScore || 0) > 0,
    "publicity corner should get stagedTechSetupScore before it fully unlocks research",
  );
  assert.equal(
    Number(cornerCandidate.valueBreakdown?.followupMainActionScore || 0),
    0,
    "staged setup should be separate from the immediate research unlock score",
  );
}

{
  const turnChoices = [];
  const selectedActions = [];
  const scoreForChoice = (candidate) => {
    const graphNet = Number(candidate?.actionGraph?.net);
    if (Number.isFinite(graphNet)) return graphNet;
    return Number(candidate?.score || 0);
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    pendingActionExecuted: true,
    recordCardCorner: true,
    blueResources: { score: 30, credits: 1, energy: 0, publicity: 0, availableData: 0, handSize: 6 },
    blueHand: Array.from({ length: 6 }, (_value, index) => ({
      id: `repeat-corner-${index}`,
      cardName: `Repeat corner ${index}`,
      price: 4,
      resourceReward: { gain: {} },
      incomeGain: { credits: 4, energy: 4, handSize: 2 },
    })),
    actionGraph: {
      buildActionGraph: (candidates) => candidates.map((candidate) => {
        if (candidate.id === "cardCorner") {
          return {
            ...candidate,
            gain: 6,
            cost: 0,
            finalMarginal: 2,
            goalBonus: 8,
            feasibility: 1,
            net: 6,
          };
        }
        if (candidate.id === "end-turn") {
          return {
            ...candidate,
            gain: 0,
            cost: 0,
            finalMarginal: 0,
            goalBonus: 0,
            feasibility: 1,
            net: 0,
          };
        }
        return {
          ...candidate,
          gain: Number(candidate.gain || candidate.score || 0),
          cost: Number(candidate.cost || 0),
          finalMarginal: 0,
          goalBonus: 0,
          feasibility: 1,
          net: Number(candidate.score || 0),
        };
      }),
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => scoreForChoice(right) - scoreForChoice(left))[0] || null,
    onChooseTurnAction: (candidates, selected) => {
      turnChoices.push(candidates);
      selectedActions.push(selected);
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const firstResult = harness.controller.runAiAutomationStep();
  assert.equal(firstResult.ok, true, "AI should allow the first raw-negative resource corner as setup");
  assert.equal(selectedActions[0]?.id, "cardCorner");
  assert.ok(Number(selectedActions[0]?.score) < 0, "fixture should exercise a raw-negative card corner");
  assert.equal(
    selectedActions[0]?.selectionAdjustment?.repeatedNegativeResourceCardCornerCap,
    undefined,
    "the first raw-negative resource corner in a turn should not be capped",
  );

  const secondResult = harness.controller.runAiAutomationStep();
  assert.equal(secondResult.ok, true, "AI should end the turn after the repeated no-cashout corner is capped");
  assert.equal(selectedActions[1]?.id, "end-turn");
  const repeatedCorner = turnChoices[1].find((candidate) => candidate.id === "cardCorner");
  assert.ok(repeatedCorner, "repeated raw-negative resource corner should still be visible for diagnostics");
  assert.equal(
    repeatedCorner.selectionAdjustment?.repeatedNegativeResourceCardCornerCap,
    1,
    "second same-turn raw-negative resource corner should be capped",
  );
  assert.equal(
    repeatedCorner.actionGraph?.net,
    -0.5,
    "cap should lower graph net below the normal end-turn candidate",
  );
}

{
  const passCards = [
    {
      id: "reserve-low",
      cardName: "Reserve low",
      typeCode: 1,
      price: 1,
    },
    {
      id: "reserve-type3",
      cardName: "Reserve type 3",
      typeCode: 3,
      price: 2,
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    blueResources: { score: 39, credits: 1, energy: 0, publicity: 1, availableData: 0, handSize: 4 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 2,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
    finalScoringState: {
      tiles: {
        final_c2: {
          id: "final_c2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
      },
    },
    finalFormulaIds: {
      final_c2: "c2",
    },
    finalSlotMultipliers: {
      c2: { 1: 6 },
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve PASS reserve selection without entering full action scoring");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-type3" });
}

{
  const passCards = [
    {
      id: "reserve-low",
      cardName: "Reserve low",
      typeCode: 1,
      price: 1,
    },
    {
      id: "reserve-type3",
      cardName: "Reserve type 3",
      typeCode: 3,
      price: 2,
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    blueResources: { score: 18, credits: 0, energy: 1, publicity: 1, availableData: 0, handSize: 1 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 1,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should rank PASS reserve cards even without a C2 final mark");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-type3" });
}

{
  const passCards = [
    {
      id: "reserve-low-first",
      cardName: "Reserve low first",
      typeCode: 1,
      price: 4,
    },
    {
      id: "reserve-direct-score",
      cardName: "Reserve direct score",
      typeCode: 1,
      price: 1,
      playEffects: [{ type: "gain_resources", options: { gain: { score: 6 } } }],
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    blueResources: { score: 18, credits: 1, energy: 1, publicity: 1, availableData: 0, handSize: 0 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 1,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should rank ordinary PASS reserve cards when the hand is empty");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-direct-score" });
}

{
  const passCards = [
    {
      id: "reserve-low-first",
      cardName: "Reserve low first",
      typeCode: 1,
      price: 1,
    },
    {
      id: "reserve-energy-income",
      cardName: "Reserve energy income",
      typeCode: 1,
      price: 2,
      incomeGain: { energy: 1 },
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    blueResources: { score: 42, credits: 2, energy: 0, publicity: 1, availableData: 1, handSize: 2 },
    blueIncome: { credits: 3, energy: 1, handSize: 2 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 2,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should rank PASS reserve cards under resource pressure");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-energy-income" });
}

{
  const passCards = [
    {
      id: "reserve-low-first",
      cardName: "Reserve low first",
      typeCode: 1,
      price: 1,
    },
    {
      id: "reserve-energy-income",
      cardName: "Reserve energy income",
      typeCode: 1,
      price: 2,
      incomeGain: { energy: 1 },
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    blueResources: { score: 22, credits: 2, energy: 0, publicity: 1, availableData: 0, handSize: 2 },
    blueIncome: { credits: 3, energy: 1, handSize: 2 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 1,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "round 1 resource pressure should remain diagnostic-only");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-low-first" });
  const passReserveLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "pass-reserve");
  assert.equal(passReserveLog?.details?.passReserveResourcePressure?.active, false);
  assert.equal(passReserveLog?.details?.passReserveResourcePressurePreview?.active, true);
  assert.equal(passReserveLog?.details?.passReserveResourcePressureMiss, true);
  assert.deepEqual(
    passReserveLog?.details?.passReserveResourcePressurePreview?.incomeCandidates?.map((entry) => entry.cardId),
    ["reserve-energy-income"],
  );
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    actionEffectFlowActive: true,
    recordExecuteActionEffect: true,
    currentActionEffect: {
      id: "research-tech-bonus",
      type: "research_tech_bonus",
      label: "获取3 分",
      status: "active",
      playerId: "player-blue",
    },
    pendingActionEffectFlow: {
      playerId: "player-blue",
      currentIndex: 0,
      effects: [],
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute active research tech bonus before optional opportunity scans");
  assert.deepEqual(harness.getHandled(), {
    type: "effect",
    effectId: "research-tech-bonus",
    effectType: "research_tech_bonus",
  });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    readyBanrenmaPlayerColor: "blue",
    actionEffectFlowActive: true,
    recordExecuteActionEffect: true,
    currentActionEffect: {
      id: "research-tech-bonus",
      type: "research_tech_bonus",
      label: "获取1 能量",
      status: "active",
      playerId: "player-blue",
    },
    pendingActionEffectFlow: {
      playerId: "player-blue",
      currentIndex: 0,
      effects: [],
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute active effects before opening ready Banrenma opportunities");
  assert.deepEqual(harness.getHandled(), {
    type: "effect",
    effectId: "research-tech-bonus",
    effectType: "research_tech_bonus",
  });
}

{
  const purpleTechEffect = {
    id: "b31-purple-tech",
    type: "card_research_tech",
    label: "科技（只能选择紫色）",
    status: "active",
    playerId: "player-blue",
    options: { techTypes: ["purple"], skipCost: true },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    actionEffectFlowActive: true,
    recordExecuteActionEffect: true,
    recordSupplyTechSelection: true,
    currentActionEffect: purpleTechEffect,
    pendingActionEffectFlow: {
      playerId: "player-blue",
      currentIndex: 0,
      effects: [purpleTechEffect],
    },
    takeableTechIds: ["orange2", "purple2", "blue3"],
    techStacks: {
      orange2: { techType: "orange", stackIndex: 2 },
      purple2: { techType: "purple", stackIndex: 2 },
      blue3: { techType: "blue", stackIndex: 3 },
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute card research-tech effects before choosing a tile");
  assert.deepEqual(harness.getHandled(), {
    type: "effect",
    effectId: "b31-purple-tech",
    effectType: "card_research_tech",
  });
}

{
  const purpleTechEffect = {
    id: "b31-purple-tech",
    type: "card_research_tech",
    label: "科技（只能选择紫色）",
    status: "active",
    playerId: "player-blue",
    options: { techTypes: ["purple"], skipCost: true },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    actionEffectFlowActive: true,
    techTilePickingActive: true,
    recordSupplyTechSelection: true,
    currentActionEffect: purpleTechEffect,
    pendingActionEffectFlow: {
      playerId: "player-blue",
      currentIndex: 0,
      effects: [purpleTechEffect],
    },
    takeableTechIds: ["orange2", "purple2", "blue3"],
    techStacks: {
      orange2: { techType: "orange", stackIndex: 2 },
      purple2: { techType: "purple", stackIndex: 2 },
      blue3: { techType: "blue", stackIndex: 3 },
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should choose a tile for active card research-tech effects");
  assert.deepEqual(harness.getHandled(), { type: "supply-tech", tileId: "purple2" });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    blueResources: { score: 50, credits: 1, energy: 0, publicity: 2, availableData: 1, handSize: 1 },
    data: {
      PLACEMENT_KIND_COMPUTER: "computer",
      PLACEMENT_KIND_BLUE_BONUS: "blueBonus",
      canPlaceAnyData: () => ({
        ok: true,
        choices: [{
          target: "computer",
          placementSlot: 4,
          label: "第一排放置位 4",
          description: "按从左到右放入第一排第 4 位",
        }],
      }),
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should directly confirm data placement quick candidates");
  assert.deepEqual(harness.getHandled(), {
    type: "data-placement",
    target: "computer",
    blueSlot: null,
  });
}

{
  let selectedTurnAction = null;
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    roundNumber: 2,
    blueResources: { score: 12, credits: 5, energy: 0, availableData: 1, handSize: 3 },
    blueIncome: { credits: 2, energy: 1, handSize: 1 },
    blueHand: [
      banrenma.createAlienCard(3, 1),
      banrenma.createAlienCard(5, 2),
      banrenma.createAlienCard(7, 3),
    ],
    onChooseTurnAction: (_candidates, selected) => {
      selectedTurnAction = selected;
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
    data: {
      PLACEMENT_KIND_COMPUTER: "computer",
      PLACEMENT_KIND_BLUE_BONUS: "blueBonus",
      getComputerSlotBonus: (slot) => {
        if (Number(slot) === 4) return { type: "income", gain: { energy: 1 } };
        if (Number(slot) === 5) return { type: "score", score: 10 };
        return null;
      },
      canPlaceAnyData: () => ({
        ok: true,
        choices: [
          {
            target: "computer",
            placementSlot: 5,
            label: "第一排放置位 5",
            description: "得分位",
          },
          {
            target: "computer",
            placementSlot: 4,
            label: "第一排放置位 4",
            description: "能量收入位",
          },
        ],
      }),
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should place data for energy income when Banrenma cards need fuel");
  assert.equal(
    Number(selectedTurnAction?.placementSlot),
    4,
    "Banrenma energy plan should outrank an early direct-score data slot",
  );
  assert.deepEqual(harness.getHandled(), {
    type: "data-placement",
    target: "computer",
    blueSlot: null,
  });
}

{
  const chongTransportTask = {
    kind: "transport",
    destinationPlanetId: "earth",
    fossilRewardRepeat: 1,
    gain: { score: 3 },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    recordOpenCardTask: true,
    readyCardTasks: [
      {
        card: { id: "normal-ready", cardName: "Normal ready" },
        task: { id: "normal-task" },
        effects: [{ type: "gain_resources", options: { gain: { score: 1 } } }],
      },
      {
        chongTask: true,
        card: {
          id: "chong-ready",
          cardName: "Chong ready",
          chongCard: true,
          chongTask: chongTransportTask,
        },
        task: chongTransportTask,
        deliveredTransport: {
          rocketId: 77,
          fossil: { fossilId: "fossil_02" },
          task: { fossilId: "fossil_02" },
        },
        effects: [],
      },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should open delivered Chong transport tasks aggressively");
  assert.deepEqual(harness.getHandled(), { type: "open-card-task", cardId: "chong-ready" });
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    recordBeginPlayCard: true,
    blueResources: { score: 75, credits: 2, energy: 0, publicity: 1, availableData: 0, handSize: 1 },
    blueHand: [{
      id: "loose-final-task",
      cardName: "Loose final task",
      price: 0,
      model: {
        tasks: [{
          id: "loose-task",
          condition: { type: "unreachableInHarness" },
          rewards: [{ type: "gain_resources", options: { gain: { score: 5 } } }],
        }],
      },
    }],
    finalScoringState: {
      tiles: {
        final_a2: {
          id: "final_a2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a2: "a2",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute the loose task play-card harness action");
  assert.deepEqual(harness.getHandled(), { type: "begin-play-card" });
  const playCardCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  const looseTaskCandidate = playCardCandidate?.playableCards?.[0] || null;
  assert.ok(looseTaskCandidate, "loose task play-card candidate should be enumerated");
  assert.equal(
    Number(looseTaskCandidate.valueBreakdown?.playCardConversionPressure || 0),
    0,
    "final loose task with no route/C-final value should not receive conversion pressure",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    recordBeginPlayCard: true,
    blueResources: { score: 86, credits: 3, energy: 2, publicity: 1, availableData: 0, handSize: 5 },
    blueHand: [{
      id: "weak-final-card",
      cardName: "Weak final card",
      price: 1,
      typeCode: 3,
      playEffects: [{ type: "card_public_scan", options: {} }],
      model: {
        endGameScoring: { kind: "sectorWins", scorePer: 1 },
      },
    }],
    finalScoringState: {
      tiles: {
        final_a2: {
          id: "final_a2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a2: "a2",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should enumerate the weak final play-card harness action");
  const playCardCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  const weakFinalCandidate = playCardCandidate?.playableCards?.[0] || null;
  assert.ok(weakFinalCandidate, "weak final play-card candidate should be enumerated");
  assert.ok(
    Number(weakFinalCandidate.valueBreakdown?.playCardConversionPressure || 0) <= 6,
    "low-yield final card without C2 planning should not receive full conversion pressure",
  );
  assert.ok(
    Number(weakFinalCandidate.valueBreakdown?.lateCardEnginePressure || 0) <= 4,
    "low-yield final card without C2 planning should not receive full late engine pressure",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    enableQuickTrades: true,
    recordQuickTrade: true,
    blueResources: { score: 145, credits: 1, energy: 0, publicity: 1, availableData: 0, handSize: 4 },
    blueHand: [
      {
        id: "tail-score-card",
        cardName: "Tail score card",
        price: 2,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 16 } } }],
      },
      { id: "filler-a", cardName: "Filler A", price: 2 },
      { id: "filler-b", cardName: "Filler B", price: 2 },
      { id: "filler-c", cardName: "Filler C", price: 2 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b1: {
          id: "final_b1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b1: "b1",
      final_d1: "d1",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should trade cards for a credit to unlock a concrete tail scoring card");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-credit" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-credit");
  assert.ok(tradeCandidate, "cards-for-credit unlock candidate should be enumerated");
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.concreteFinalValue || 0) > 0,
    "tail unlock trade should still require concrete score/final value",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    enableQuickTrades: true,
    recordQuickTrade: true,
    blueResources: { score: 296, credits: 1, energy: 0, publicity: 0, availableData: 0, handSize: 3 },
    blueHand: [
      {
        id: "final-push-score-card",
        cardName: "Final push score card",
        price: 2,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 12 } } }],
      },
      { id: "high-filler-a", cardName: "High filler A", price: 4 },
      { id: "high-filler-b", cardName: "High filler B", price: 4 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should trade cards for credit to unlock a 300-point push card");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-credit" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-credit");
  assert.equal(
    tradeCandidate?.valueBreakdown?.finalHighScoreOneCreditUnlock,
    true,
    "high-score one-credit unlock should be explicitly marked",
  );
}

{
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({
    id: `data-${index}`,
    placementSlot: index + 1,
  }));
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
      "cards-for-credit": {
        id: "cards-for-credit",
        label: "2 cards -> 1 credit",
        cost: { handSize: 2 },
        gain: { credits: 1 },
      },
    },
    blueResources: { score: 182, credits: 0, energy: 0, publicity: 5, availableData: 3, handSize: 5 },
    blueHand: [
      { id: "analysis-filler-a", cardName: "Analysis filler A", price: 0 },
      { id: "analysis-filler-b", cardName: "Analysis filler B", price: 0 },
      { id: "analysis-filler-c", cardName: "Analysis filler C", price: 0 },
      {
        id: "analysis-credit-target",
        cardName: "Analysis credit target",
        price: 1,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 12 } } }],
      },
      { id: "analysis-filler-d", cardName: "Analysis filler D", price: 0 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_c2: {
          id: "final_c2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_c2: "c2",
      final_d1: "d1",
    },
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy")
      || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should still allow the final analyze energy trade");
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.equal(tradeCandidate?.valueBreakdown?.finalAnalyzeEnergyTrade, true);
  assert.equal(tradeCandidate.preserveHandIndex, 3);
  assert.equal(tradeCandidate.valueBreakdown?.competingCreditUnlock?.bestPlayCard?.handIndex, 3);
  assert.deepEqual(
    tradeCandidate.valueBreakdown?.discardPlan?.executionSelectedIndexes?.includes(3),
    false,
    "final analyze energy trade should not discard the high-value credit-unlock play card",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    turnNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
    },
    movableTokens: [
      { id: 1, playerId: "player-blue", sector: { x: 2, y: 2 } },
    ],
    planetLocations: [
      { planetId: "mars", name: "Mars", x: 2, y: 2 },
    ],
    planetStats: {
      canAddLandingMarker: () => true,
      canAddOrbitMarker: () => false,
      getAvailableSatellitesForLanding: () => [],
      getPlanetLandingCount: () => 0,
      getPlanetOrbitCount: () => 0,
    },
    abilities: {
      planet: {
        DEFAULT_ORBIT_COST: { credits: 1, energy: 1 },
        BASE_LAND_ENERGY_COST: 2,
        getLandEnergyCost: () => 2,
        getLandOptions: () => ({ ok: false, message: "land disabled in harness" }),
        getOrbitOptions: () => ({ ok: false, message: "orbit disabled in harness" }),
      },
      rocket: {
        ORANGE1_ROCKET_LIMIT: 4,
        getRocketLimitForPlayer: () => 3,
      },
    },
    planetRewards: {
      EFFECT_TYPES: {
        GAIN_RESOURCES: "gain_resources",
        GAIN_DATA: "gain_data",
        ALIEN_TRACE: "alien_trace",
        DRAW_CARDS: "draw_cards",
        PICK_CARD: "pick_card",
        INCOME: "income",
      },
      buildPlanetLandRewardEffects: () => [
        { type: "gain_resources", options: { gain: { score: 6 } } },
      ],
      buildOrbitRewardEffects: () => [],
      buildSatelliteLandRewardEffects: () => [],
    },
    blueResources: { score: 120, credits: 0, energy: 1, publicity: 0, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "engine-a", cardName: "Engine A", price: 0, playEffects: [{ type: "gain_resources", options: { gain: { score: 10 } } }] },
      { id: "engine-b", cardName: "Engine B", price: 0, playEffects: [{ type: "gain_resources", options: { gain: { score: 9 } } }] },
      { id: "engine-c", cardName: "Engine C", price: 0, playEffects: [{ type: "gain_resources", options: { gain: { score: 8 } } }] },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b1: {
          id: "final_b1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b1: "b1",
      final_d1: "d1",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy")
      || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should evaluate the route cashout trade without blocking");
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.ok(tradeCandidate, "cards-for-energy planet cashout candidate should still be enumerated");
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.cardsForEnergyHandDrainPenalty || 0) >= 8,
    "low-score three-mark players should price the hand drain before trading two cards for energy",
  );
}

{
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
    },
    blueResources: { score: 82, credits: 0, energy: 0, publicity: 2, availableData: 6, handSize: 3 },
    blueHand: [
      { id: "locked-a", cardName: "Locked A", price: 2 },
      { id: "locked-b", cardName: "Locked B", price: 2 },
      { id: "locked-c", cardName: "Locked C", price: 2 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d1: "d1",
    },
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "resource-locked AI should trade cards for energy before a high-value analyze");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-energy" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.ok(tradeCandidate, "resource-lock analyze unlock trade should be enumerated");
  assert.equal(tradeCandidate.reason, "资源锁：弃牌换能量解锁分析");
  assert.equal(
    tradeCandidate.valueBreakdown?.resourceLockMainUnlockTrade,
    true,
    "resource-lock trade should expose its specific diagnostic marker",
  );
  assert.equal(
    tradeCandidate.valueBreakdown?.unlockedMainAction?.actionId,
    "analyze",
    "resource-lock trade should identify analyze as the unlocked main action",
  );
}

{
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
    },
    blueResources: { score: 82, credits: 0, energy: 0, publicity: 2, availableData: 6, handSize: 2 },
    blueHand: [
      { id: "locked-a", cardName: "Locked A", price: 2 },
      { id: "locked-b", cardName: "Locked B", price: 2 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d1: "d1",
    },
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const passLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "turn-action" && entry.details?.action?.id === "pass");
  const preview = passLog?.details?.resourceLockTradePreviews
    ?.find((entry) => entry.tradeId === "cards-for-energy");
  assert.ok(preview, "resource-lock preview should be recorded when AI passes with a locked hand");
  assert.equal(preview.discardPlan?.ok, true, "exact hand-cost trade previews should not preserve a phantom hand index 0");
  assert.equal(preview.discardPlan?.handCost, 2);
  assert.deepEqual(
    preview.discardPlan?.selectedCards?.map((card) => card.handIndex),
    [0, 1],
  );
  assert.ok(
    turnChoices.flat().some((candidate) => candidate.id === "pass"),
    "the test setup should force a PASS decision so diagnostics are logged",
  );
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    quickTrades: {
      "cards-for-credit": {
        id: "cards-for-credit",
        label: "2 cards -> 1 credit",
        cost: { handSize: 2 },
        gain: { credits: 1 },
      },
    },
    blueResources: { score: 141, credits: 0, energy: 0, publicity: 1, availableData: 0, handSize: 3 },
    blueHand: [
      {
        id: "locked-premium",
        cardName: "Locked premium",
        price: 1,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 12 } } }],
      },
      { id: "locked-filler-a", cardName: "Locked filler A", price: 1 },
      { id: "locked-filler-b", cardName: "Locked filler B", price: 1 },
    ],
    onChooseTurnAction: (candidates) => {
      assert.ok(candidates.some((candidate) => candidate.id === "pass"));
    },
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const passLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "turn-action" && entry.details?.action?.id === "pass");
  const preview = passLog?.details?.resourceLockTradePreviews
    ?.find((entry) => entry.tradeId === "cards-for-credit");
  assert.ok(preview, "resource-lock preview should include cards-for-credit");
  assert.equal(preview.bestAction?.actionId, "playCard");
  assert.equal(preview.bestAction?.handIndex, 0);
  assert.equal(
    preview.discardPlan?.preservedHandIndex,
    0,
    "resource-lock preview discard plan should preserve the unlocked best play card",
  );
  assert.deepEqual(
    preview.discardPlan?.selectedCards?.map((card) => card.handIndex),
    [1, 2],
  );
  assert.deepEqual(
    preview.discardPlan?.executionSelectedIndexes,
    [1, 2],
  );
  assert.equal(preview.bestActionDiscardRisk?.costPlanDiscards, false);
  assert.equal(preview.bestActionDiscardRisk?.executionPlanDiscards, false);
  assert.equal(preview.bestActionDiscardRisk?.executionMatchesCostPlan, true);
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    aiDifficulty: "weak_start",
    roundNumber: 4,
    turnNumber: 7,
    canStartMainAction: true,
    realisticCanAfford: true,
    quickTrades: {
      "cards-for-credit": {
        id: "cards-for-credit",
        label: "2 cards -> 1 credit",
        cost: { handSize: 2 },
        gain: { credits: 1 },
      },
    },
    actionChecks: {
      launch: { ok: true },
    },
    blueResources: { score: 122, credits: 1, energy: 0, publicity: 2, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "dead-launch-a", cardName: "Dead launch A", price: 3 },
      { id: "dead-launch-b", cardName: "Dead launch B", price: 3 },
      { id: "dead-launch-c", cardName: "Dead launch C", price: 3 },
    ],
    findAvailableSlotIndex: () => null,
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_c2: {
          id: "final_c2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_c2: "c2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const passLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "turn-action" && entry.details?.action?.id === "pass");
  const preview = passLog?.details?.resourceLockTradePreviews
    ?.find((entry) => entry.tradeId === "cards-for-credit");
  assert.ok(preview, "resource-lock preview should include the possible launch trade");
  assert.equal(preview.bestAction?.actionId, "launch");
  assert.ok(
    Number(preview.bestAction?.score || 0) < 26,
    "final low-resource launch preview should include no-route penalties before applying the unlock threshold",
  );
  assert.equal(
    turnChoices.flat().some((candidate) => (
      candidate.id === "quickTrade"
      && candidate.tradeId === "cards-for-credit"
      && candidate.valueBreakdown?.unlockedMainAction?.actionId === "launch"
    )),
    false,
    "weak_start should not trade dead final hand into a no-route launch",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-credit": {
        id: "cards-for-credit",
        label: "2 cards -> 1 credit",
        cost: { handSize: 2 },
        gain: { credits: 1 },
      },
    },
    blueResources: { score: 55, credits: 0, energy: 2, publicity: 2, availableData: 0, handSize: 4 },
    blueHand: [
      { id: "scan-lock-a", cardName: "Scan Lock A", price: 2 },
      { id: "scan-lock-b", cardName: "Scan Lock B", price: 2 },
      { id: "scan-lock-c", cardName: "Scan Lock C", price: 2 },
      { id: "scan-lock-d", cardName: "Scan Lock D", price: 2 },
    ],
    publicCards: [{
      id: "public-high-scan",
      cardId: "public-high-scan",
      cardName: "High public scan",
      scanActionCode: 2,
    }],
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 1, energy: 2 },
      getStandardScanCost: () => ({ credits: 1, energy: 2 }),
      buildScanEffectQueue: () => [{ type: "public_card_scan" }],
      canExecuteScan: (player) => (
        Number(player?.resources?.credits || 0) >= 1 && Number(player?.resources?.energy || 0) >= 2
          ? { ok: true }
          : { ok: false, message: "scan resources missing" }
      ),
    },
    getPublicScanChoicesForCard: () => ({
      ok: true,
      choices: [{ nebulaId: "high-nebula", sectorX: 4, label: "High nebula" }],
    }),
    data: {
      getNextReplaceableNebulaToken: () => ({ slotIndex: 30 }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "resource-locked AI should trade cards for credit before a high-value scan");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-credit" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-credit");
  assert.ok(tradeCandidate, "resource-lock scan unlock trade should be enumerated");
  assert.equal(tradeCandidate.reason, "资源锁：交易解锁扫描");
  assert.equal(tradeCandidate.valueBreakdown?.unlockedMainAction?.actionId, "scan");
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
    },
    blueResources: { score: 82, credits: 0, energy: 1, publicity: 2, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "locked-low-a", cardName: "Locked Low A", price: 2 },
      { id: "locked-low-b", cardName: "Locked Low B", price: 2 },
      { id: "locked-low-c", cardName: "Locked Low C", price: 2 },
    ],
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 0, energy: 2 },
      getStandardScanCost: () => ({ credits: 0, energy: 2 }),
      buildScanEffectQueue: () => [],
      canExecuteScan: (player) => (
        Number(player?.resources?.energy || 0) >= 2
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.equal(
    tradeCandidate,
    undefined,
    "resource-lock trade should not spend two cards for a low-value scan",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    aiDifficulty: "weak_start",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-energy": {
        id: "credits-for-energy",
        label: "2 credits -> 1 energy",
        cost: { credits: 2 },
        gain: { energy: 1 },
      },
    },
    blueResources: { score: 112, credits: 7, energy: 1, publicity: 2, availableData: 0, handSize: 1 },
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 0, energy: 2 },
      getStandardScanCost: () => ({ credits: 0, energy: 2 }),
      buildScanEffectQueue: () => [{ type: "earth_sector_scan" }],
      canExecuteScan: (player) => (
        Number(player?.resources?.energy || 0) >= 2
          ? { ok: true }
          : { ok: false, message: "scan resources missing" }
      ),
    },
    buildSectorScanChoicesForX: (sectorX) => [{
      nebulaId: "direct-score-sector",
      sectorX,
      label: "Direct score sector",
    }],
    data: {
      getNextReplaceableNebulaToken: () => ({ slotIndex: 30 }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: () => 18,
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy");
  assert.ok(tradeCandidate, "weak no-discard scan unlock trade should be enumerated");
  assert.equal(tradeCandidate.reason, "资源锁：交易解锁扫描");
  assert.equal(tradeCandidate.valueBreakdown?.unlockedMainAction?.actionId, "scan");
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.unlockedMainAction?.directScoreGain || 0) > 0,
    "weak no-discard scan unlock should require direct scan score",
  );
  assert.equal(result.ok, true, "weak_start AI should spend spare credits to unlock direct-score scan without discarding");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "credits-for-energy" });
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    blueResources: { score: 141, credits: 2, energy: 0, publicity: 1, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "dead-final-card-a", cardName: "Dead final card A", price: 1, typeCode: 1, playEffects: [] },
      { id: "dead-final-card-b", cardName: "Dead final card B", price: 1, typeCode: 1, playEffects: [] },
      { id: "dead-final-card-c", cardName: "Dead final card C", price: 1, typeCode: 1, playEffects: [] },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const playCardCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  assert.equal(
    playCardCandidate?.available,
    false,
    "final three-mark AI should not spend resources on a negative no-cashout card just to beat pass",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    blueResources: { score: 120, credits: 5, energy: 5, publicity: 0, availableData: 0, handSize: 2 },
    finalScoringState: {
      tiles: {
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: { final_b2: "b2" },
    finalSlotMultipliers: { b2: { 1: 8 } },
    endGameScoring: {
      countSectorWins: () => 1,
      countOrbitOrLandMarkers: () => 6,
    },
    actionChecks: {
      land: { ok: true, planet: { planetId: "mars", name: "火星" }, energyCost: 0, choices: [] },
    },
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 0, energy: 0 },
      getStandardScanCost: () => ({ credits: 0, energy: 0 }),
      buildScanEffectQueue: () => [],
      canExecuteScan: () => ({ ok: true }),
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const candidates = turnChoices.flat();
  const scanCandidate = candidates.find((candidate) => candidate.id === "scan");
  const landCandidate = candidates.find((candidate) => candidate.id === "land");
  assert.ok(scanCandidate, "B2 bottleneck scenario should expose scan candidate");
  assert.ok(landCandidate, "B2 bottleneck scenario should expose land candidate");
  assert.equal(
    scanCandidate.scoreCapReason,
    null,
    "marked B2 sector bottleneck should not label scan as capped by planet cashout",
  );
  assert.ok(
    Number(scanCandidate.score) > Math.max(0, Number(landCandidate.score || 0) - 7),
    "marked B2 sector bottleneck should preserve scan above the planet cashout cap",
  );
}

{
  const buildHarness = (aiDifficulty) => {
    const turnChoices = [];
    const harness = createAiControllerHarness(null, {
      currentPlayerColor: "blue",
      aiDifficulty,
      roundNumber: 2,
      canStartMainAction: true,
      realisticCanAfford: true,
      takeableTechIds: ["orange1"],
      techStacks: {
        orange1: { techType: "orange", bonusId: null, firstTakeClaimedBy: "other-player", stackIndex: 1 },
      },
      blueResources: { score: 37, credits: 1, energy: 4, publicity: 7, availableData: 0, handSize: 5 },
      finalScoringState: {
        tiles: {
          final_b2: {
            id: "final_b2",
            marks: [],
          },
        },
      },
      finalFormulaIds: { final_b2: "b2" },
      finalSlotMultipliers: { b2: { 1: 8 } },
      endGameScoring: {
        countSectorWins: () => 0,
        countOrbitOrLandMarkers: () => 1,
      },
      scanEffects: {
        EFFECT_TYPES: {
          EARTH_SECTOR_SCAN: "earth_sector_scan",
          IMPROVED_SECTOR_SCAN: "improved_sector_scan",
          MERCURY_SECTOR_SCAN: "mercury_sector_scan",
          PUBLIC_CARD_SCAN: "public_card_scan",
          HAND_SCAN: "hand_scan",
          SCAN_ACTION_4: "scan_action_4",
        },
        SCAN_COST: { credits: 1, energy: 2 },
        getStandardScanCost: () => ({ credits: 1, energy: 2 }),
        buildScanEffectQueue: () => [{ type: "earth_sector_scan" }],
        canExecuteScan: () => ({ ok: true }),
      },
      buildSectorScanChoicesForX: (sectorX) => [{
        nebulaId: "b2-setup-sector",
        sectorX,
        label: "B2 setup sector",
      }],
      data: {
        getNextReplaceableNebulaToken: () => ({ slotIndex: 2 }),
        getNebulaCapacity: () => 3,
        getNebulaSlotScoreReward: () => 2,
        getNebulaColor: () => "blue",
        listNebulaTokens: () => [{}, {}, { playerId: "other-player" }],
        listSectorExtraMarks: () => [],
        getSectorTokenStats: () => ({
          other: { playerId: "other-player", count: 0 },
        }),
      },
      onChooseTurnAction: (candidates) => turnChoices.push(candidates),
      chooseTurnAction: (candidates) => candidates
        .slice()
        .filter((candidate) => candidate.available !== false)
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
    });
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      ...(aiDifficulty ? { aiDifficulty } : {}),
      suppressAutoSchedule: true,
    });
    return { harness, turnChoices };
  };

  const weak = buildHarness("weak_start");
  weak.harness.controller.runAiAutomationStep();
  const weakCandidates = weak.turnChoices.flat();
  const weakScan = weakCandidates.find((candidate) => candidate.id === "scan");
  const weakTech = weakCandidates.find((candidate) => candidate.id === "researchTech");
  assert.ok(
    weakScan?.valueBreakdown?.weakEarlyB2SetupScanTieBreak > 0,
    "weak_start should add a B2 setup scan tie-break before B2 is marked",
  );
  assert.ok(
    Number(weakScan.score) > Number(weakTech.score),
    "weak_start B2 setup scan should beat a zero-direct research-tech candidate in the narrow low-resource window",
  );

  const defaultDifficulty = buildHarness(undefined);
  defaultDifficulty.harness.controller.runAiAutomationStep();
  const defaultScan = defaultDifficulty.turnChoices
    .flat()
    .find((candidate) => candidate.id === "scan");
  assert.equal(
    defaultScan?.valueBreakdown?.weakEarlyB2SetupScanTieBreak,
    undefined,
    "default difficulty should not receive the weak_start B2 setup scan tie-break",
  );
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-tail-score-card",
    cardName: "Public tail score card",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 14 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 158, credits: 1, energy: 0, publicity: 3, availableData: 0, handSize: 0 },
    blueHand: [],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should use publicity to refill a playable tail scoring card");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "publicity-for-card tail refill candidate should be enumerated");
  assert.equal(
    tradeCandidate.valueBreakdown?.finalLowHandPublicRefill,
    true,
    "158-score final low-hand player should still be inside the public refill window",
  );
}

{
  const turnChoices = [];
  const publicFillerCard = {
    id: "public-low-tail-filler",
    cardName: "Public low tail filler",
    price: 2,
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicFillerCard],
    blueResources: { score: 119, credits: 0, energy: 1, publicity: 4, availableData: 0, handSize: 1 },
    blueHand: [{ id: "unpayable-low-tail", cardName: "Unpayable low tail", price: 2 }],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card")
      || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.equal(
    tradeCandidate,
    undefined,
    "low-score public refill should require a concrete playable public-card score",
  );
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-three-mark-tail-score",
    cardName: "Public three mark tail score",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 14 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-card": {
        id: "credits-for-card",
        label: "2 credits -> public card",
        cost: { credits: 2 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 132, credits: 2, energy: 1, publicity: 1, availableData: 0, handSize: 1 },
    blueHand: [{ id: "unpayable-tail", cardName: "Unpayable tail", price: 3 }],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should use credits to refill after all three final marks are already claimed");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "credits-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-card");
  assert.ok(tradeCandidate, "three-mark low-tail credit refill candidate should be enumerated");
  assert.equal(
    tradeCandidate.valueBreakdown?.avoidCloseSecondMarkCreditCardTrap,
    false,
    "missing-threshold trap should not apply after all three final marks are claimed",
  );
}

{
  const turnChoices = [];
  const publicFillerCard = {
    id: "public-payable-filler",
    cardName: "Public payable filler",
    price: 2,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 8 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-card": {
        id: "credits-for-card",
        label: "2 credits -> public card",
        cost: { credits: 2 },
        gain: { handSize: 1 },
      },
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicFillerCard],
    blueResources: { score: 292, credits: 2, energy: 0, publicity: 5, availableData: 0, handSize: 0 },
    blueHand: [],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should preserve the last credits when publicity can refill a high-score hand");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const creditTradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-card");
  assert.equal(creditTradeCandidate, undefined, "high-score refill should not spend the last 2 credits while publicity is available");
  const publicTradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.equal(publicTradeCandidate?.valueBreakdown?.finalHighScorePreserveLastCredits, true);
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-over-305-score",
    cardName: "Public over 305 score",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 14 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 316, credits: 4, energy: 0, publicity: 4, availableData: 0, handSize: 0 },
    blueHand: [],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should keep refilling a high-score hand above 305 when the public card is valuable");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "over-305 high-score refill candidate should be enumerated");
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreNeedsCardRefill, true);
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-tail-score-two-hand",
    cardName: "Public tail score two hand",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 12 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 293, credits: 4, energy: 0, publicity: 4, availableData: 0, handSize: 2 },
    blueHand: [
      { id: "unpayable-a", cardName: "Unpayable A", price: 5 },
      { id: "unpayable-b", cardName: "Unpayable B", price: 5 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should refill during a high-score push when two hand cards are unplayable");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "two-card stale high-score refill candidate should be enumerated");
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreNeedsCardRefill, true);
  assert.ok(Number(tradeCandidate.valueBreakdown?.highScorePlayableHandScore || 0) < 8);
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 6, availableData: 0, handSize: 2 },
    blueHand: [
      { id: "highscore-unpayable-a", cardName: "Highscore unpayable A", price: 5 },
      { id: "highscore-unpayable-b", cardName: "Highscore unpayable B", price: 5 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const passLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "turn-action" && entry.details?.action?.id === "pass");
  assert.equal(passLog?.details?.finalHighScorePassRecoveryDiagnostic?.scoreTo300, 12);
  assert.equal(
    passLog?.details?.finalHighScorePassRecoveryDiagnostic?.highScoreGate?.finalHighScoreNeedsCardRefill,
    true,
  );
  assert.equal(
    passLog?.details?.finalHighScorePassRecoveryDiagnostic?.highScoreGate?.publicRefillScoreThreshold,
    5,
  );
}

{
  const badPublicCard = {
    id: "negative-highscore-public-card",
    cardName: "Negative highscore public card",
    price: 4,
  };
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [badPublicCard],
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 6, availableData: 0, handSize: 0 },
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should use publicity to blind draw when high-score public cards are negative");
  assert.deepEqual(harness.getHandled(), {
    type: "quick-trade",
    tradeId: "publicity-for-card",
    preferBlindDraw: true,
  });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "blind high-score refill candidate should be enumerated");
  assert.equal(tradeCandidate.preferBlindDraw, true);
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreBlindRefill, true);
  assert.ok(Number(tradeCandidate.valueBreakdown?.bestPublicTradeCardScore || 0) < 5);
}

{
  const badPublicCard = {
    id: "negative-weak-highscore-public-card",
    cardName: "Negative weak highscore public card",
    price: 4,
  };
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    blueAiDifficulty: "weak_start",
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [badPublicCard],
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 3, availableData: 0, handSize: 0 },
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "weak_start should use a 3-publicity blind refill near 300");
  assert.deepEqual(harness.getHandled(), {
    type: "quick-trade",
    tradeId: "publicity-for-card",
    preferBlindDraw: true,
  });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.equal(tradeCandidate?.preferBlindDraw, true);
  assert.equal(tradeCandidate?.valueBreakdown?.finalHighScoreBlindRefill, true);
  assert.equal(tradeCandidate?.valueBreakdown?.finalHighScoreBlindRefillPublicityThreshold, 3);
}

{
  const badPublicCard = {
    id: "negative-default-highscore-public-card",
    cardName: "Negative default highscore public card",
    price: 4,
  };
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [badPublicCard],
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 3, availableData: 0, handSize: 0 },
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.equal(
    tradeCandidate,
    undefined,
    "default difficulty should keep the 6-publicity terminal blind-refill threshold",
  );
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-highscore-dead-hand-score-card",
    cardName: "Public highscore dead-hand score card",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 26 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-pick-card": {
        id: "cards-for-pick-card",
        label: "2 cards -> public card",
        cost: { handSize: 2 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 288, credits: 9, energy: 1, publicity: 0, availableData: 0, handSize: 4 },
    blueHand: [
      { id: "dead-highscore-a", cardName: "Dead highscore A", price: 20 },
      { id: "dead-highscore-b", cardName: "Dead highscore B", price: 20 },
      { id: "dead-highscore-c", cardName: "Dead highscore C", price: 20 },
      { id: "dead-highscore-d", cardName: "Dead highscore D", price: 20 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should trade dead high-score hands for a concrete public score card");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-pick-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-pick-card");
  assert.ok(tradeCandidate, "dead-hand public-card trade should be enumerated for high-score push");
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreDeadHandRefillBaseWindow, true);
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreDeadHandPickRefill, true);
  assert.ok(Number(tradeCandidate.valueBreakdown?.cardsForPickCardDiscardCost || 0) <= 8);
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-low-stale-score-card",
    cardName: "Public low stale score card",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 14 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 143, credits: 1, energy: 0, publicity: 5, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "stale-low-a", cardName: "Stale Low A", price: 5 },
      { id: "stale-low-b", cardName: "Stale Low B", price: 5 },
      { id: "stale-low-c", cardName: "Stale Low C", price: 5 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should use publicity when low-score final hands are stale but not empty");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "low stale hand publicity refill candidate should be enumerated");
  assert.equal(tradeCandidate.valueBreakdown?.finalLowStaleHandPublicRefill, true);
  assert.ok(Number(tradeCandidate.valueBreakdown?.finalLowStaleHandPlayableScore || 0) < 7);
}

{
  const badPublicCard = {
    id: "negative-selection-public-card",
    cardName: "Negative selection public card",
    price: 4,
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    cardSelectionActive: true,
    recordBlindDraw: true,
    recordPublicPick: true,
    canBlindDraw: true,
    publicCards: [badPublicCard],
    pendingCardSelectionAction: {
      type: "trade",
      tradeId: "publicity-for-card",
      aiPreferBlindDraw: true,
      aiReason: "高分冲刺：公共牌无收益时盲抽找最后得分牌",
      player: null,
    },
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 3, handSize: 0 },
  });
  harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should blind draw when the trade pending explicitly prefers blind draw");
  assert.deepEqual(harness.getHandled(), { type: "blind-draw", fromSelection: true });
}

{
  const fillerCard = {
    id: "plain-low-card",
    cardName: "Plain low card",
    price: 4,
  };
  const publicityCornerCard = {
    id: "publicity-corner-card",
    cardName: "Publicity corner card",
    price: 4,
    resourceReward: { gain: { publicity: 2 } },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    cardSelectionActive: true,
    recordPublicPick: true,
    publicCards: [fillerCard, publicityCornerCard],
    pendingCardSelectionAction: {
      type: "trade",
      player: null,
    },
    blueResources: { score: 118, credits: 0, energy: 0, publicity: 4, handSize: 0 },
    blueOwnedTechTiles: {
      orange1: true,
      purple1: true,
      blue1: true,
      blue2: true,
      blue3: true,
      purple2: true,
    },
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    finalSlotMultipliers: {
      d2: { 1: 8 },
    },
  });
  harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should pick the non-runezu publicity corner setup card");
  assert.deepEqual(harness.getHandled(), { type: "public-pick", slotIndex: 1 });
}

{
  const fillerCard = {
    id: "plain-low-card",
    cardName: "Plain low card",
    price: 4,
  };
  const publicityCornerCard = {
    id: "publicity-corner-card",
    cardName: "Publicity corner card",
    price: 4,
    resourceReward: { gain: { publicity: 2 } },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    cardSelectionActive: true,
    recordPublicPick: true,
    runezuQuick: true,
    publicCards: [fillerCard, publicityCornerCard],
    pendingCardSelectionAction: {
      type: "trade",
      player: null,
    },
    blueResources: { score: 118, credits: 0, energy: 0, publicity: 4, handSize: 0 },
    blueOwnedTechTiles: {
      orange1: true,
      purple1: true,
      blue1: true,
      blue2: true,
      blue3: true,
      purple2: true,
    },
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    finalSlotMultipliers: {
      d2: { 1: 8 },
    },
  });
  harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should not over-prioritize generic resource corners after runezu is revealed");
  assert.deepEqual(harness.getHandled(), { type: "public-pick", slotIndex: 0 });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    blueOwnedTechTiles: {
      orange1: true,
      orange3: true,
      blue2: true,
      purple4: true,
    },
    blueTechCounts: {
      orange: 2,
      blue: 1,
      purple: 1,
    },
  });
  harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });

  const blueResult = harness.controller.getAiAutoBattleReport().playerResults
    .find((player) => player.playerId === harness.blue.id);
  assert.equal(blueResult.techCount, 4, "autobattle player results should keep total tech count");
  assert.deepEqual(
    blueResult.techTypeCounts,
    { orange: 2, blue: 1, purple: 1 },
    "autobattle player results should expose tech type counts for D1 diagnostics",
  );
}

console.log("app/ai-controller.test.js ok");

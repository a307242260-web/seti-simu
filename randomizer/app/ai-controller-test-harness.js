"use strict";

const { createAiController } = require("./ai-controller");
const aomomo = require("../game/aliens/aomomo");
const amiba = require("../game/aliens/amiba");
const banrenma = require("../game/aliens/banrenma");
const chong = require("../game/aliens/chong");
const endGameScoring = require("../game/end-game-scoring");
const fangzhou = require("../game/aliens/fangzhou");
const jiuzhe = require("../game/aliens/jiuzhe");
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
      const keys = String(selector || "")
        .split(",")
        .map((part) => datasetKeyForSelector(part.trim()))
        .filter(Boolean);
      if (!keys.length) return [];
      return buttons.filter((button) => keys.some(
        (key) => Object.prototype.hasOwnProperty.call(button.dataset || {}, key),
      ));
    },
  };
}

function createAiControllerHarness(pendingPlayerColor, options = {}) {
  const white = {
    id: "player-white",
    color: "white",
    colorLabel: "White",
    hand: options.whiteHand || [],
    reservedCards: options.whiteReservedCards || [],
    resources: { ...(options.whiteResources || {}) },
    income: { ...(options.whiteIncome || {}) },
    techState: options.whiteTechState || { ownedTiles: { ...(options.whiteOwnedTechTiles || {}) } },
    techCounts: { ...(options.whiteTechCounts || {}) },
    runezuSymbols: options.whiteRunezuSymbols || {},
  };
  const blue = {
    id: "player-blue",
    color: "blue",
    colorLabel: "Blue",
    hand: options.blueHand || [],
    reservedCards: options.blueReservedCards || [],
    initialSelection: options.blueInitialSelection || null,
    industryRoundMarkRound: options.blueIndustryRoundMarkRound ?? null,
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
  const getHarnessRocketsForPlayer = (playerId) => {
    if (typeof options.getRocketsForPlayer === "function") {
      return options.getRocketsForPlayer(playerId) || [];
    }
    const byPlayer = options.rocketTokensByPlayer || {};
    if (Object.prototype.hasOwnProperty.call(byPlayer, playerId)) {
      return byPlayer[playerId] || [];
    }
    if (Array.isArray(options.movableTokens) && String(playerId) === String(currentPlayer.id)) {
      return options.movableTokens;
    }
    return [];
  };
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
    passedPlayerIds: options.passedPlayerIds || [],
  };
  let pendingJiuzheCardPlay = options.pendingJiuzheCardPlay
    || (pendingPlayerColor
      ? {
      playerColor: pendingPlayerColor,
      reason: "reveal",
      cost: {},
      label: "Jiuzhe reveal",
      }
      : null);
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
    get pendingBanrenmaCardGain() { return options.pendingBanrenmaCardGain || null; },
    get pendingBanrenmaOpportunity() { return options.pendingBanrenmaOpportunity || null; },
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
      RESOURCE_LIMITS: { publicity: 10, availableData: 6 },
      createPlayerState: () => ({}),
      canAfford: options.realisticCanAfford ? canAffordResources : () => true,
      formatResourceCost: (cost = {}) => Object.entries(cost)
        .filter(([, value]) => Number(value || 0) > 0)
        .map(([key, value]) => `${value} ${key}`)
        .join(", "),
      normalizeIncome: (income = {}) => ({ ...(income || {}) }),
      playerOwnsTech: () => false,
    },
    solar: {
      createBaselineState: () => ({}),
      mod8: (value) => ((Math.round(Number(value) || 0) % 8) + 8) % 8,
      createSolarSnapshot: () => ({ planetLocations: options.planetLocations || [] }),
      collectVisibleCoordinateGroups: () => ({ asteroids: [], comets: [] }),
      collectVisibleCoordinateReport: () => [],
    },
    rocketActions: {
      ROCKET_KIND: { STANDARD: "standard", CHONG_FOSSIL: "chong-fossil" },
      createRocketState: () => ({}),
      getRocketsForPlayer: (_rocketState, playerId) => getHarnessRocketsForPlayer(playerId),
      getRocketSectorCoordinate: (rocket) => rocket?.sector || null,
      findAvailableSlotIndex: options.findAvailableSlotIndex || (() => null),
      canMoveRocket: (_rocketState, rocketId, deltaX, deltaY) => {
        const rocketPool = options.movableTokens || Object.values(options.rocketTokensByPlayer || {}).flat();
        const rocket = rocketPool.find((item) => Number(item.id) === Number(rocketId));
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
    planetStats: {
      createPlanetStatsState: () => ({}),
      ...(options.planetStats || {
        canAddLandingMarker: () => false,
        canAddOrbitMarker: () => false,
        getAvailableSatellitesForLanding: () => [],
        getPlanetLandingCount: () => 0,
        getPlanetOrbitCount: () => 0,
      }),
    },
    aliens: {
      ALIEN_SLOT_IDS: options.alienSlotIds || [1],
      TRACE_TYPES: alienCore.TRACE_TYPES,
      createDefaultAlienState: () => ({}),
      getAlienSlot: (stateToRead, alienSlotId) => (
        stateToRead?.aliens?.[String(alienSlotId)]
        || stateToRead?.aliens?.[Number(alienSlotId)]
        || null
      ),
    },
    banrenma,
    chong,
    fangzhou,
    jiuzhe,
    runezu,
    yichangdian,
    aomomo,
    amiba,
    cards: {
      createCardState: () => ({}),
      getCardLabel: (card) => card?.cardName || card?.label || card?.cardId || card?.id || "card",
      getDiscardRemaining: () => Math.max(0, Math.round(Number(options.discardCount ?? pendingDiscardAction?.count ?? 1) || 0)),
      getIncomeCodeForCard: (card) => card?.incomeCode ?? null,
      getIncomeGainForCard: (card) => card?.incomeGain || null,
      getDiscardActionMoveRewardForCard: (card) => card?.moveReward || null,
      getDiscardActionRewardForCard: (card) => card?.resourceReward || null,
    },
    cardTaskStateModule: {
      createTaskState: () => ({}),
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
    data: {
      createDefaultNebulaDataState: () => ({}),
      ...(options.data || {}),
    },
    aiRaceModel: options.aiRaceModel,
    ai: {
      heuristicEvaluator: {
        selectScoredItem: (candidates, selectionOptions = {}) => {
          const selected = selectionOptions.mode === "card"
            ? (
              candidates
                .slice()
                .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0]
              || null
            )
            : options.chooseTurnAction
              ? options.chooseTurnAction(candidates)
              : (
                candidates.find((candidate) => candidate.id === "runezuFaceSymbol")
                || candidates.find((candidate) => candidate.available !== false)
                || null
              );
          if (selectionOptions.mode !== "card" && typeof options.onChooseTurnAction === "function") {
            options.onChooseTurnAction(candidates, selected);
          }
          return selected;
        },
      },
      heuristicPolicy: setiAi.heuristicPolicy,
      selectionEvaluator: setiAi.selectionEvaluator,
      ...(options.aiValuation ? { valuation: options.aiValuation } : {}),
      ...(options.actionGraph ? { actionGraph: options.actionGraph } : {}),
      ...(options.aiPlanner ? { planner: options.aiPlanner } : {}),
    },
    cardEffects: {
      EFFECT_TYPES: {
        CARD_MOVE: "card_move",
        CARD_LAND: "card_land",
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
      createFinalScoringState: () => ({}),
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
      resolveCardEndGameRule: (card, cardEffects) => (
        cardEffects?.getCardModel?.(card)?.endGameScoring || null
      ),
      ...(options.endGameScoring || {}),
    },
    tech: {
      createState: () => ({}),
      ...(options.tech || {
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
      }),
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
      ...(options.actionContext || {}),
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
    getMovableTokensForPlayer: (playerId) => getHarnessRocketsForPlayer(playerId),
    getPendingPlayCardSelection: () => null,
    getPlanetSectorCoordinate: (planetId) => {
      if (typeof options.getPlanetSectorCoordinate === "function") {
        return options.getPlanetSectorCoordinate(planetId);
      }
      const planet = (options.planetLocations || []).find((entry) => entry.planetId === planetId);
      return planet ? { x: planet.x, y: planet.y } : null;
    },
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
      const event = {
        type: "banrenma-ready",
        playerColor: player.color,
        includeCards: openOptions.includeCards,
      };
      if (openOptions.preferredCardId) {
        event.preferredCardId = openOptions.preferredCardId;
        event.firstReservedCardId = player.reservedCards?.[0]?.id || null;
      }
      noteHandled(event);
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
    "activateNextActionEffect",
    "allowsBlindDrawInSelection",
    "analyzeDataForCurrentPlayer",
    "beginPlayCardSelection",
    "beginScanAction",
    "cancelTechSelection",
    "cancelCardTriggerChoice",
    "clearTransientStateForRecovery",
    "closeScanTargetPicker",
    "confirmCardTaskCompletion",
    "confirmCardCornerQuickAction",
    "confirmDataPlacement",
    "confirmInitialSelectionForCurrentPlayer",
    "confirmAlienRevealNotice",
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
    "handlePublicCornerDiscardCardClick",
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
  context.dispatchRuntimeAction = undefined;
  context.recoverPendingActionFromOpenHistoryForAi = undefined;
  if (options.recordBanrenmaChoices) {
    context.handleBanrenmaBonusChoice = (choice) => {
      noteHandled({ type: "banrenma-bonus", choice: String(choice) });
      return { ok: true, progressed: true };
    };
    context.handleBanrenmaCardConditionChoice = (choice) => {
      noteHandled({ type: "banrenma-condition", choice: String(choice) });
      return { ok: true, progressed: true };
    };
  }
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
  context.getMovableTokensForPlayer = (playerId) => getHarnessRocketsForPlayer(playerId);
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

  const familyById = {
    launch: "launch", orbit: "orbit", land: "land", researchTech: "research_tech",
    scan: "scan", analyze: "analyze", playCard: "play_card", pass: "pass",
    move: "move", quickTrade: "quick_trade", industry: "industry", cardCorner: "card_corner",
    placeData: "place_data", runezuFaceSymbol: "runezu_face_symbol", "end-turn": "end_turn",
  };
  context.dispatchRuntimeAction = (request) => {
    if (request?.kind === "standard_enumerate") {
      return {
        ok: true,
        candidates: (request.candidates || []).flatMap((candidate, index) => {
          const family = familyById[candidate.id];
          if (!family || candidate.available === false) return [];
          return [{
            schemaVersion: "seti-standard-action-v1",
            actionId: `${family}:harness-${index}`,
            actorId: context.getCurrentPlayer()?.id || null,
            family,
            phase: candidate.kind || "main",
            stateVersion: 0,
            decisionVersion: 0,
            target: {
              rocketId: candidate.rocketId,
              planetId: candidate.planetId,
              tileId: candidate.tileId,
              blueSlot: candidate.blueSlot,
              tradeId: candidate.tradeId,
              cardInstanceId: candidate.cardInstanceId || candidate.cardId,
              companyLabel: candidate.companyLabel || candidate.industryCard?.label,
              deltaX: candidate.deltaX,
              deltaY: candidate.deltaY,
              alienSlotId: candidate.alienSlotId,
              position: candidate.position,
              symbolId: candidate.symbolId,
              ...(candidate.id === "placeData" ? { target: candidate.target } : {}),
            },
            payload: { harnessCandidate: candidate },
            summary: candidate.label || candidate.id,
          }];
        }),
      };
    }
    const candidate = request?.standardAction?.payload?.harnessCandidate;
    if (!candidate) return { ok: false, message: "测试 registry 缺少候选 descriptor" };
    if (candidate.id === "end-turn") return context.endCurrentTurn() || { ok: true, progressed: true };
    if (candidate.id === "launch") return context.runAction("launch") || { ok: true, progressed: true };
    if (candidate.id === "researchTech") return context.researchTechForCurrentPlayer() || { ok: true, progressed: true };
    if (candidate.id === "orbit") return context.orbitForCurrentPlayer() || { ok: true, progressed: true };
    if (candidate.id === "land") return context.landForCurrentPlayer() || { ok: true, progressed: true };
    if (candidate.id === "scan") return context.beginScanAction() || { ok: true, progressed: true };
    if (candidate.id === "analyze") return context.analyzeDataForCurrentPlayer() || { ok: true, progressed: true };
    if (candidate.id === "playCard") {
      const started = context.beginPlayCardSelection();
      if (started?.ok === false) return started;
      const selected = context.handlePlayCardSelect(candidate.handIndex);
      if (selected == null) return started;
      return selected?.ok === false ? selected : context.confirmPlayCardSelection();
    }
    if (candidate.id === "cardCorner") {
      const selected = context.handleHandCardCornerQuickAction(candidate.handIndex);
      return selected?.ok === false ? selected : context.confirmCardCornerQuickAction();
    }
    if (candidate.id === "runezuFaceSymbol") {
      const opened = context.openRunezuFaceSymbolPlacement(candidate.alienSlotId, candidate.position);
      if (opened?.ok === false) return opened;
      const selected = context.handleRunezuFaceSymbolChoice(candidate.symbolId);
      return selected || opened || { ok: true, progressed: true };
    }
    if (candidate.id === "industry") return context.handleCompanyActionMarkerClick(candidate.industryCard) || { ok: true, progressed: true };
    if (candidate.id === "move") return context.moveRocket(candidate.deltaX, candidate.deltaY, candidate.rocketId, { automated: true });
    if (candidate.id === "placeData") return context.confirmDataPlacement(candidate.target, candidate.blueSlot);
    if (candidate.id === "quickTrade") return context.runQuickTrade(candidate.tradeId, candidate);
    if (candidate.id === "pass") return context.passForCurrentPlayer() || { ok: true, progressed: true };
    return { ok: false, message: `测试 registry 未支持 ${candidate.id}` };
  };

  context.ruleLifecycle = options.ruleLifecycle || {
    newGame() { return { ok: true }; },
  };

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

module.exports = { createAiControllerHarness, makeActionList, makeButton };

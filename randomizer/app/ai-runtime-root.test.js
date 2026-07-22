const assert = require("node:assert/strict");

const { createInitialCardPendingRuntime } = require("./ai/initial-card-pending");
const { createInteractionPendingRuntime } = require("./ai/interaction-pending");
const { createActionExecutor } = require("./ai/action-executor");
const { createAutomationRuntime } = require("./ai/automation-runtime");
const { createTechCandidates } = require("../game/ai/tech-candidates");
const { createFinalPace } = require("../game/ai/final-pace");
const { createSelectionPressure } = require("../game/ai/selection-pressure");
const { createStateSummary } = require("../game/ai/state-summary");
const { createActionValue } = require("../game/ai/action-value");
const { createAlienChoiceValue } = require("../game/ai/alien-choice-value");
const { createTechAction } = require("../game/ai/tech-action");
const { createScanValue } = require("../game/ai/scan-value");
const { createDemandCard } = require("../game/ai/demand-card");
const { createAlienValuation } = require("../game/ai/alien-valuation");
const { createTradeCandidates } = require("../game/ai/trade-candidates");
const { createRoutePlanet } = require("../game/ai/route-planet");

function contextWith(overrides = {}) {
  const fallback = () => null;
  return new Proxy(overrides, {
    get(target, key) {
      return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : fallback;
    },
  });
}

function createRoot(id, roundNumber = 1) {
  return {
    playerState: {
      currentPlayerId: id,
      players: [{ id, colorLabel: id, resources: {}, hand: [], reservedCards: [] }],
    },
    turnState: { roundNumber, turnNumber: 1, activePlayerIds: [id] },
    rocketState: { rockets: [] },
    alienGameState: { id: `alien-${id}` },
    cardState: { id: `card-${id}`, publicCards: [] },
    techGameState: { board: {}, ui: {} },
    finalScoringState: {},
  };
}

const players = {
  getCurrentPlayer: (playerState) => (
    playerState.players.find((player) => player.id === playerState.currentPlayerId) || null
  ),
};

{
  const runtime = createInitialCardPendingRuntime(contextWith({
    AI_STYLE_SEAT_ORDER: ["route", "scanner"],
    ai: { heuristicEvaluator: { selectScoredItem: () => null } },
    getAiAutoBattlePlayerIds: () => ["a", "b"],
    players,
    rocketActions: {},
    state: {},
  }));
  const rootA = createRoot("a", 1);
  rootA.turnState.activePlayerIds = ["a", "b"];
  const rootB = createRoot("b", 2);
  rootB.turnState.activePlayerIds = ["b", "a"];
  assert.deepEqual(runtime.getOrderedAiAutoBattlePlayerIds(rootA), ["a", "b"]);
  assert.deepEqual(runtime.getOrderedAiAutoBattlePlayerIds(rootB), ["b", "a"]);
  assert.throws(() => runtime.getOrderedAiAutoBattlePlayerIds(), /explicit workingRoot/);
}

{
  const aiAutoBattleState = { turnMoveCounts: {}, turnCardCornerMoveCounts: {}, maxMovesPerTurn: 3 };
  const runtime = createInteractionPendingRuntime(contextWith({
    ai: { heuristicEvaluator: { selectScoredItem: () => null } },
    aiAutoBattleState,
    players,
    rocketActions: { getRocketsForPlayer: () => [] },
    state: {},
  }));
  const rootA = createRoot("a", 1);
  const rootB = createRoot("b", 2);
  runtime.incrementAiMoveCountThisTurn(rootB);
  assert.equal(runtime.getAiMoveCountThisTurn(rootA), 0);
  assert.equal(runtime.getAiMoveCountThisTurn(rootB), 1);
  assert.throws(() => runtime.getAiMoveCountThisTurn(), /explicit workingRoot/);
}

{
  let observedRoot = null;
  const rootB = createRoot("b", 2);
  rootB.cardState.publicCards = [{ id: "public-b" }];
  const runtime = createInitialCardPendingRuntime(contextWith({
    ai: { heuristicEvaluator: { selectScoredItem: () => null } },
    players,
    state: { pendingCardSelectionContinuation: { type: "public_scan", playerId: rootB.playerState.players[0].id } },
    isCardSelectionActive: () => true,
    isIndustryHandSelectionActive: () => false,
    isAiAutoBattlePlayer: () => true,
    getAiBestPublicScanSlots: (_player, options) => {
      observedRoot = options.workingRoot;
      return [];
    },
  }));
  const result = runtime.runAiCardSelectionDecision(rootB);
  assert.equal(result, null);
  assert.equal(observedRoot, rootB);
}

{
  const calls = [];
  const runtime = createActionExecutor(contextWith({
    ai: { heuristicEvaluator: { selectScoredItem: () => null } },
    dispatchRuntimeAction: (workingRoot, request) => {
      calls.push({ workingRoot, request });
      return { ok: true, rootId: workingRoot.playerState.currentPlayerId };
    },
    players,
    state: {},
  }));
  const rootB = createRoot("b", 2);
  const descriptor = { schemaVersion: "seti-standard-action-v1", family: "pass" };
  assert.equal(runtime.executeAiTurnAction(rootB, { standardAction: descriptor }).rootId, "b");
  assert.equal(calls[0].workingRoot, rootB);
  assert.throws(() => runtime.executeAiTurnAction(null, { standardAction: descriptor }), /explicit workingRoot/);
}

{
  const rootB = createRoot("b", 2);
  const runtime = createAutomationRuntime(contextWith({
    ai: { heuristicPolicy: {}, selectionEvaluator: {} },
    isGameEnded: () => false,
    players,
    rocketActions: { getRocketsForPlayer: () => [] },
    runAiTurnActionDecision: (workingRoot) => ({ ok: true, rootId: workingRoot.playerState.currentPlayerId }),
    state: {},
  }));
  assert.equal(runtime.runAiAutomationStep(rootB).rootId, "b");
  assert.throws(() => runtime.runAiAutomationStep(), /explicit workingRoot/);
}

{
  const rootA = createRoot("a", 1);
  rootA.playerState.players.push({ id: "b", resources: {} });
  rootA.turnState.activePlayerIds = ["a", "b"];
  const rootB = createRoot("b", 3);
  let readout = rootA;
  const finalPace = createFinalPace(contextWith({
    aiNumber: Number,
    DEFAULT_ACTIVE_PLAYER_COUNT: 4,
    FINAL_ROUND_NUMBER: 4,
    getRuleReadout: () => readout,
  }));
  assert.equal(finalPace.getAiRoundNumber(), 1);
  assert.equal(finalPace.getAiActiveOpponentCount(rootA.playerState.players[0]), 1);
  readout = rootB;
  assert.equal(finalPace.getAiRoundNumber(), 3);
  assert.equal(finalPace.getAiActiveOpponentCount(rootB.playerState.players[0]), 0);
}

{
  const rootA = createRoot("a", 1);
  const rootB = createRoot("a", 2);
  let readout = rootA;
  const selectionPressure = createSelectionPressure(contextWith({
    aiNumber: Number,
    aiAutoBattleState: {
      logs: [{
        type: "turn-action",
        roundNumber: 1,
        rawTurnNumber: 1,
        playerId: "a",
        details: { action: { id: "cardCorner", actionKind: "resource", score: -1 } },
      }],
    },
    getRuleReadout: () => readout,
  }));
  assert.equal(selectionPressure.countAiRepeatedNegativeResourceCardCornersThisTurn("a"), 1);
  readout = rootB;
  assert.equal(selectionPressure.countAiRepeatedNegativeResourceCardCornersThisTurn("a"), 0);
}

{
  const rootA = createRoot("a", 1);
  rootA.nebulaDataState = { sectorSettlements: { winsByPlayerId: { a: [{ sectorId: "sector-a" }] } } };
  const rootB = createRoot("a", 1);
  rootB.nebulaDataState = { sectorSettlements: { winsByPlayerId: {} } };
  let readout = rootA;
  const stateSummary = createStateSummary(contextWith({
    aiNumber: Number,
    cardEffects: { NEBULA_IDS_BY_COLOR: { blue: ["sector-a"] } },
    getAiNebulaSignalCounts: () => ({ ownCount: 0 }),
    getRuleReadout: () => readout,
  }));
  const player = { id: "a", resources: {} };
  assert.equal(stateSummary.getAiTaskConditionCurrentCount({ type: "signalsOrWinsInAllSectors" }, player), 1);
  readout = rootB;
  assert.equal(stateSummary.getAiTaskConditionCurrentCount({ type: "signalsOrWinsInAllSectors" }, player), 0);
}

{
  const rootA = createRoot("a", 1);
  rootA.rocketState.rockets = [{ id: 1, playerId: "a" }];
  const rootB = createRoot("a", 1);
  let readout = rootA;
  const actionValue = createActionValue(contextWith({
    aiNumber: Number,
    AI_TRACE_TYPES: [],
    cardEffects: { countRocketsForReward: (rockets) => rockets.length },
    getRuleReadout: () => readout,
  }));
  const player = { id: "a", resources: {} };
  assert.equal(actionValue.countAiRocketsForReward(player), 1);
  readout = rootB;
  assert.equal(actionValue.countAiRocketsForReward(player), 0);
}

{
  const rootA = createRoot("a", 1);
  rootA.playerState.players[0].color = "blue";
  rootA.playerState.players.push({ id: "b", color: "pink", resources: {} });
  const rootB = structuredClone(rootA);
  rootB.alienGameState.id = "alien-b";
  let readout = rootA;
  const alienChoiceValue = createAlienChoiceValue(contextWith({
    aiNumber: Number,
    jiuzhe: { getThreat: (alienState) => alienState.id === "alien-a" ? 1 : 2 },
    getRuleReadout: () => readout,
  }));
  const player = rootA.playerState.players[0];
  assert.deepEqual(alienChoiceValue.getAiOtherJiuzheThreats(player), [1]);
  readout = rootB;
  assert.deepEqual(alienChoiceValue.getAiOtherJiuzheThreats(player), [2]);
}

{
  const rootA = createRoot("a", 2);
  rootA.rocketState.rockets = [{ id: 1, playerId: "a" }];
  const rootB = createRoot("a", 2);
  let readout = rootA;
  const techAction = createTechAction(contextWith({
    aiNumber: Number,
    getAiRoundNumber: () => 2,
    getAiLiveScorePaceDeficit: () => 30,
    getRuleReadout: () => readout,
    rocketActions: { getRocketsForPlayer: (rocketState) => rocketState.rockets },
  }));
  const player = rootA.playerState.players[0];
  assert.ok(techAction.scoreAiExtraLaunchPacePenalty(player) > 0);
  readout = rootB;
  assert.equal(techAction.scoreAiExtraLaunchPacePenalty(player), 0);
}

{
  const rootA = createRoot("a", 1);
  rootA.nebulaDataState = { tokens: [{ playerId: "a" }] };
  const rootB = createRoot("a", 1);
  rootB.nebulaDataState = { tokens: [] };
  let readout = rootA;
  const scanValue = createScanValue(contextWith({
    aiNumber: Number,
    data: {
      listNebulaTokens: (nebulaState) => nebulaState.tokens,
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
    },
    getRuleReadout: () => readout,
  }));
  const player = { id: "a", resources: {} };
  assert.equal(scanValue.getAiNebulaSignalCounts("sector-a", player).ownCount, 1);
  readout = rootB;
  assert.equal(scanValue.getAiNebulaSignalCounts("sector-a", player).ownCount, 0);
}

{
  const rootA = createRoot("a", 1);
  rootA.alienGameState.slot = { revealed: true, alienId: "x" };
  const rootB = createRoot("a", 1);
  rootB.alienGameState.slot = { revealed: true, alienId: "y" };
  let readout = rootA;
  const demandCard = createDemandCard(contextWith({
    aiNumber: (value) => Number(value) || 0,
    aliens: { getAlienSlot: (alienState) => alienState.slot },
    getAiMapDemand: (map, key) => Number(map?.[key]) || 0,
    getRuleReadout: () => readout,
  }));
  const demand = { alienTraceTargets: { x: { blue: 3 } } };
  assert.equal(demandCard.getAiAlienTraceTargetDemandForSlot(demand, 1, "blue"), 3);
  readout = rootB;
  assert.equal(demandCard.getAiAlienTraceTargetDemandForSlot(demand, 1, "blue"), 0);
}

{
  const rootA = createRoot("a", 1);
  rootA.solarState = { planetLocations: [{ planetId: "mars", x: 1, y: 2 }] };
  const rootB = createRoot("a", 1);
  rootB.solarState = { planetLocations: [{ planetId: "mars", x: 7, y: 4 }] };
  let readout = rootA;
  const alienValuation = createAlienValuation(contextWith({
    getPlanetSectorCoordinate: () => null,
    getRuleReadout: () => readout,
    solar: { createSolarSnapshot: (solarState) => solarState },
  }));
  assert.deepEqual(alienValuation.getAiPlanetCoordinateById("mars"), { x: 1, y: 2 });
  readout = rootB;
  assert.deepEqual(alienValuation.getAiPlanetCoordinateById("mars"), { x: 7, y: 4 });
}

{
  const rootA = createRoot("a", 1);
  rootA.alienGameState.yichangdian = {
    anomalies: [{ id: "anomaly-a", traceType: "blue" }],
  };
  const rootB = createRoot("a", 1);
  rootB.alienGameState.yichangdian = {
    anomalies: [{ id: "anomaly-b", traceType: "pink" }],
  };
  let readout = rootA;
  const alienValuation = createAlienValuation(contextWith({
    getRuleReadout: () => readout,
    yichangdian: { getAnomalyReward: () => ({ score: 1 }) },
  }));
  assert.equal(alienValuation.getAiYichangdianAnomalyForTraceType("blue")?.id, "anomaly-a");
  readout = rootB;
  assert.equal(alienValuation.getAiYichangdianAnomalyForTraceType("blue"), null);
  assert.equal(alienValuation.getAiYichangdianAnomalyForTraceType("pink")?.id, "anomaly-b");
}

{
  const rootA = createRoot("a", 1);
  const rootB = createRoot("a", 2);
  let readout = rootA;
  const tradeCandidates = createTradeCandidates(contextWith({
    aiAutoBattleState: {
      logs: [{
        type: "turn-action",
        roundNumber: 1,
        rawTurnNumber: 1,
        playerId: "a",
        details: { action: { id: "quickTrade" } },
      }],
    },
    getRuleReadout: () => readout,
  }));
  assert.equal(tradeCandidates.countAiQuickTradesThisTurn("a"), 1);
  readout = rootB;
  assert.equal(tradeCandidates.countAiQuickTradesThisTurn("a"), 0);
}

{
  const rootA = createRoot("a", 1);
  rootA.planetStatsState = { allowOrbit: true };
  const rootB = createRoot("a", 1);
  rootB.planetStatsState = { allowOrbit: false };
  let readout = rootA;
  const routePlanet = createRoutePlanet(contextWith({
    getRuleReadout: () => readout,
    planetStats: { canAddOrbitMarker: (planetStatsState) => planetStatsState.allowOrbit },
  }));
  assert.equal(routePlanet.canAiPlanetAcceptOrbit("mars"), true);
  readout = rootB;
  assert.equal(routePlanet.canAiPlanetAcceptOrbit("mars"), false);
}

{
  const scoreRoots = [];
  const satelliteRoots = [];
  const techCandidates = createTechCandidates(contextWith({
    players,
    tech: {
      getStack: (board, tileId) => board[tileId] || null,
      getTechType: () => "orange",
      getStackIndex: () => 1,
    },
    getAiResearchTechCandidateSafety: () => ({ ok: true, message: null }),
    getAiResearchTechFinalFormulaDeltas: () => ({}),
    getAiOrange4SatellitePotentialProfile: (workingRoot) => {
      satelliteRoots.push(workingRoot);
      return { potential: workingRoot.turnState.roundNumber };
    },
    scoreAiResearchTechValue: (workingRoot) => {
      scoreRoots.push(workingRoot);
      return workingRoot.turnState.roundNumber;
    },
  }));
  const rootA = createRoot("a", 1);
  const rootB = createRoot("b", 2);
  rootA.techGameState.board.orange1 = { bonusId: "bonus-a", remaining: 1 };
  rootB.techGameState.board.orange1 = { bonusId: "bonus-b", remaining: 2 };
  rootA.techGameState.board.orange4 = { bonusId: "bonus-orange-a", remaining: 1 };
  rootB.techGameState.board.orange4 = { bonusId: "bonus-orange-b", remaining: 2 };
  assert.equal(techCandidates.buildAiResearchTechCandidate(rootA, "orange1").bonusId, "bonus-a");
  assert.equal(techCandidates.buildAiResearchTechCandidate(rootB, "orange1").bonusId, "bonus-b");
  assert.equal(techCandidates.buildAiResearchTechCandidate(rootA, "orange4").score, 1);
  assert.equal(techCandidates.buildAiResearchTechCandidate(rootB, "orange4").score, 2);
  assert.deepEqual(scoreRoots, [rootA, rootB, rootA, rootB]);
  assert.deepEqual(satelliteRoots, [rootA, rootB]);
  assert.throws(
    () => techCandidates.buildAiResearchTechCandidate(null, "orange1"),
    /explicit workingRoot/,
  );
}

console.log("AI runtime working-root tests passed");

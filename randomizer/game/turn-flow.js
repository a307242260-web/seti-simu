(function (root, factory) {
  "use strict";
  let solar = root.SetiSolarSystem;
  let rocketAbility = root.SetiAbilityRocket;
  if (typeof require === "function") {
    solar = solar || require("../solar-system/core");
    rocketAbility = rocketAbility || require("./abilities/rocket");
  }
  const api = factory(solar, rocketAbility);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiTurnFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  solar, rocketAbility,
) {
  "use strict";

  const DEFAULT_FINAL_ROUND = 4;

  function createTurnState(sourcePlayers, options = {}) {
    const playerIds = (Array.isArray(sourcePlayers) ? sourcePlayers : [])
      .map((player) => player?.id)
      .filter(Boolean);
    const requestedCount = Math.max(1, Math.round(Number(options.activePlayerCount) || 1));
    const activePlayerCount = Math.min(requestedCount, playerIds.length || 1);
    const currentPlayerId = playerIds.includes(options.currentPlayerId)
      ? options.currentPlayerId
      : playerIds[0];
    const activePlayerIds = activePlayerCount === 1 && currentPlayerId
      ? [currentPlayerId]
      : playerIds.slice(0, activePlayerCount);
    return {
      roundNumber: 1,
      turnNumber: 1,
      actionCycleNumber: 1,
      activePlayerCount,
      turnOrderPlayerIds: playerIds,
      activePlayerIds,
      startPlayerId: activePlayerIds[0] || currentPlayerId || null,
      passedPlayerIds: [],
      completedTurnPlayerIds: [],
      cardTurnEventBonuses: [],
      visitedPlanetsByPlayerId: {},
      gameEnded: false,
      gameEndReason: null,
    };
  }

  function rotatePlayerIds(playerIds, startPlayerId) {
    if (!playerIds.length) return [];
    const startIndex = Math.max(0, playerIds.indexOf(startPlayerId));
    return [...playerIds.slice(startIndex), ...playerIds.slice(0, startIndex)];
  }

  function getActiveOrderedPlayerIds(turnState) {
    const active = new Set(turnState?.activePlayerIds || []);
    return (turnState?.turnOrderPlayerIds || []).filter((playerId) => active.has(playerId));
  }

  function getRoundOrderPlayerIds(turnState) {
    const active = getActiveOrderedPlayerIds(turnState);
    const start = active.includes(turnState?.startPlayerId) ? turnState.startPlayerId : active[0];
    return rotatePlayerIds(active, start);
  }

  function isPlayerPassed(turnState, playerId) {
    return (turnState?.passedPlayerIds || []).includes(playerId);
  }

  function hasPlayerCompletedTurn(turnState, playerId) {
    return (turnState?.completedTurnPlayerIds || []).includes(playerId);
  }

  function haveAllActivePlayersPassed(turnState) {
    return (turnState?.activePlayerIds || []).length > 0
      && turnState.activePlayerIds.every((playerId) => isPlayerPassed(turnState, playerId));
  }

  function beginNextRound(workingRoot) {
    const { playerState, turnState } = workingRoot;
    turnState.roundNumber += 1;
    turnState.turnNumber = 1;
    turnState.actionCycleNumber = 1;
    turnState.passedPlayerIds = [];
    turnState.completedTurnPlayerIds = [];
    turnState.cardTurnEventBonuses = [];
    turnState.visitedPlanetsByPlayerId = {};
    const active = getActiveOrderedPlayerIds(turnState);
    if (active.length) {
      const current = active.includes(turnState.startPlayerId) ? active.indexOf(turnState.startPlayerId) : 0;
      turnState.startPlayerId = active[(current + 1) % active.length];
    }
    playerState.currentPlayerId = turnState.startPlayerId
      || turnState.activePlayerIds?.[0]
      || playerState.currentPlayerId;
    return { roundAdvanced: true, turnAdvanced: true, nextPlayerId: playerState.currentPlayerId };
  }

  function rotateSolarSystem(workingRoot, count = 1, actorId = null) {
    if (!workingRoot?.solarState || !workingRoot?.rocketState) {
      throw new TypeError("solar rotation requires committed solar/rocket state");
    }
    const before = structuredClone(workingRoot.solarState.rotation);
    workingRoot.solarState.rotation = solar.applySolarOrbitRotation(
      workingRoot.solarState.rotation,
      count,
    );
    workingRoot.solarState.wheelSteps = solar.rotationToWheelSteps(workingRoot.solarState.rotation);
    const playerState = actorId && actorId !== workingRoot.playerState?.currentPlayerId
      ? { ...workingRoot.playerState, currentPlayerId: actorId }
      : workingRoot.playerState;
    const context = {
      workingRoot,
      playerState,
      rocketState: workingRoot.rocketState,
      planetStatsState: workingRoot.planetStatsState,
      alienGameState: workingRoot.alienGameState,
      nebulaDataState: workingRoot.nebulaDataState,
      cardState: workingRoot.cardState,
      solarState: workingRoot.solarState,
      turnState: workingRoot.turnState,
      techGameState: workingRoot.techGameState,
      getPlanetLocations: () => solar.createSolarSnapshot(workingRoot.solarState).planetLocations,
    };
    const settled = rocketAbility.settleRocketsAfterSolarRotation(
      context,
      before,
      workingRoot.solarState.rotation,
    );
    return settled.ok
      ? {
        ...settled,
        before,
        after: structuredClone(workingRoot.solarState.rotation),
      }
      : settled;
  }

  function advanceTurnAfterPlayerAction(workingRoot, playerId, options = {}) {
    if (!workingRoot?.turnState || !workingRoot?.playerState) {
      throw new TypeError("turn flow requires committed turn/player state");
    }
    const turn = workingRoot.turnState;
    const playerState = workingRoot.playerState;
    const finalRoundNumber = Number(options.finalRoundNumber) || DEFAULT_FINAL_ROUND;
    const passed = (id) => isPlayerPassed(turn, id);
    const completed = (id) => hasPlayerCompletedTurn(turn, id);
    const roundOrder = () => getRoundOrderPlayerIds(turn);
    const activeCount = Math.max(1, turn.activePlayerIds?.length || turn.activePlayerCount || 1);
    const displayedTurn = Math.floor((Math.max(1, Number(turn.turnNumber) || 1) - 1) / activeCount) + 1;
    const cycle = Math.max(1, Number(turn.actionCycleNumber) || 1);
    if (!playerId) return { roundAdvanced: false, turnAdvanced: false, nextPlayerId: playerState.currentPlayerId };

    if (options.passed && !passed(playerId)) turn.passedPlayerIds.push(playerId);
    turn.cardTurnEventBonuses = (turn.cardTurnEventBonuses || []).filter((bonus) => bonus.playerId !== playerId);
    if (!turn.visitedPlanetsByPlayerId || typeof turn.visitedPlanetsByPlayerId !== "object") {
      turn.visitedPlanetsByPlayerId = {};
    }
    delete turn.visitedPlanetsByPlayerId[playerId];
    if (!completed(playerId)) turn.completedTurnPlayerIds.push(playerId);

    const completedCycle = {
      completedActionCycle: true,
      completedActionCycleRoundNumber: turn.roundNumber,
      completedActionCycleNumber: cycle,
      completedActionCycleTurnNumber: displayedTurn,
      completedActionCycleRawTurnNumber: turn.turnNumber,
      completedActionCyclePlayerIds: [...turn.completedTurnPlayerIds],
    };
    if (haveAllActivePlayersPassed(turn) && Number(turn.roundNumber) >= finalRoundNumber) {
      turn.gameEnded = true;
      turn.gameEndReason = "final_round_all_passed";
      return {
        roundAdvanced: false,
        turnAdvanced: false,
        gameEnded: true,
        nextPlayerId: playerState.currentPlayerId,
        ...completedCycle,
      };
    }
    if (haveAllActivePlayersPassed(turn)) return { ...beginNextRound(workingRoot), ...completedCycle };

    const order = roundOrder();
    const startIndex = order.includes(playerId) ? order.indexOf(playerId) : -1;
    let nextPlayerId = null;
    for (let offset = 1; offset <= order.length; offset += 1) {
      const candidate = order[(startIndex + offset + order.length) % order.length];
      if (!passed(candidate) && !completed(candidate)) {
        nextPlayerId = candidate;
        break;
      }
    }
    if (nextPlayerId) {
      playerState.currentPlayerId = nextPlayerId;
      turn.turnNumber += 1;
      return { roundAdvanced: false, turnAdvanced: true, nextPlayerId };
    }

    turn.turnNumber += 1;
    turn.completedTurnPlayerIds = [];
    turn.actionCycleNumber = cycle + 1;
    playerState.currentPlayerId = order.find((id) => !passed(id)) || playerState.currentPlayerId;
    return {
      roundAdvanced: false,
      turnAdvanced: true,
      nextPlayerId: playerState.currentPlayerId,
      ...completedCycle,
    };
  }

  return Object.freeze({
    DEFAULT_FINAL_ROUND,
    createTurnState,
    getActiveOrderedPlayerIds,
    getRoundOrderPlayerIds,
    isPlayerPassed,
    hasPlayerCompletedTurn,
    haveAllActivePlayersPassed,
    beginNextRound,
    rotateSolarSystem,
    advanceTurnAfterPlayerAction,
  });
});

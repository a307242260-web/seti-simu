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
  if (typeof module === "undefined") root.SetiTurnFlow = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
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

  function getActiveOrderedPlayerIds(turnSlice) {
    const active = new Set(turnSlice?.activePlayerIds || []);
    return (turnSlice?.turnOrderPlayerIds || []).filter((playerId) => active.has(playerId));
  }

  function getRoundOrderPlayerIds(turnSlice) {
    const active = getActiveOrderedPlayerIds(turnSlice);
    const start = active.includes(turnSlice?.startPlayerId) ? turnSlice.startPlayerId : active[0];
    return rotatePlayerIds(active, start);
  }

  function isPlayerPassed(turnSlice, playerId) {
    return (turnSlice?.passedPlayerIds || []).includes(playerId);
  }

  function hasPlayerCompletedTurn(turnSlice, playerId) {
    return (turnSlice?.completedTurnPlayerIds || []).includes(playerId);
  }

  function haveAllActivePlayersPassed(turnSlice) {
    return (turnSlice?.activePlayerIds || []).length > 0
      && turnSlice.activePlayerIds.every((playerId) => isPlayerPassed(turnSlice, playerId));
  }

  function beginNextRound(state) {
    const turn = state.turn;
    turn.roundNumber += 1;
    turn.turnNumber = 1;
    turn.actionCycleNumber = 1;
    turn.passedPlayerIds = [];
    turn.completedTurnPlayerIds = [];
    turn.cardTurnEventBonuses = [];
    turn.visitedPlanetsByPlayerId = {};
    const active = getActiveOrderedPlayerIds(turn);
    if (active.length) {
      const current = active.includes(turn.startPlayerId) ? active.indexOf(turn.startPlayerId) : 0;
      turn.startPlayerId = active[(current + 1) % active.length];
    }
    turn.currentPlayerId = turn.startPlayerId
      || turn.activePlayerIds?.[0]
      || turn.currentPlayerId;
    return { roundAdvanced: true, turnAdvanced: true, nextPlayerId: turn.currentPlayerId };
  }

  function rotateSolarSystem(state, count = 1, actorId = null) {
    if (!state?.solarSystem || !state?.pieces) {
      throw new TypeError("solar rotation requires committed solar/rocket state");
    }
    const before = structuredClone(state.solarSystem.rotation);
    state.solarSystem.rotation = solar.applySolarOrbitRotation(
      state.solarSystem.rotation,
      count,
    );
    const context = {
      state,
      players: state.players,
      pieces: state.pieces,
      planets: state.planets,
      aliens: state.aliens,
      data: state.data,
      cards: state.cards,
      solarSystem: state.solarSystem,
      turn: { ...state.turn, currentPlayerId: actorId || state.turn.currentPlayerId },
      tech: state.tech,
      getPlanetLocations: () => solar.createSolarSnapshot(state.solarSystem).planetLocations,
    };
    const settled = rocketAbility.settleRocketsAfterSolarRotation(
      context,
      before,
      state.solarSystem.rotation,
    );
    return settled.ok
      ? {
        ...settled,
        before,
        after: structuredClone(state.solarSystem.rotation),
      }
      : settled;
  }

  function advanceTurnAfterPlayerAction(state, playerId, options = {}) {
    if (!state?.turn || !state?.players) {
      throw new TypeError("turn flow requires committed turn/player state");
    }
    const turn = state.turn;
    const finalRoundNumber = Number(options.finalRoundNumber) || DEFAULT_FINAL_ROUND;
    const passed = (id) => isPlayerPassed(turn, id);
    const completed = (id) => hasPlayerCompletedTurn(turn, id);
    const roundOrder = () => getRoundOrderPlayerIds(turn);
    const activeCount = Math.max(1, turn.activePlayerIds?.length || turn.activePlayerCount || 1);
    const displayedTurn = Math.floor((Math.max(1, Number(turn.turnNumber) || 1) - 1) / activeCount) + 1;
    const cycle = Math.max(1, Number(turn.actionCycleNumber) || 1);
    if (!playerId) return { roundAdvanced: false, turnAdvanced: false, nextPlayerId: turn.currentPlayerId };

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
        nextPlayerId: turn.currentPlayerId,
        ...completedCycle,
      };
    }
    if (haveAllActivePlayersPassed(turn)) return { ...beginNextRound(state), ...completedCycle };

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
      turn.currentPlayerId = nextPlayerId;
      turn.turnNumber += 1;
      return { roundAdvanced: false, turnAdvanced: true, nextPlayerId };
    }

    turn.turnNumber += 1;
    turn.completedTurnPlayerIds = [];
    turn.actionCycleNumber = cycle + 1;
    turn.currentPlayerId = order.find((id) => !passed(id)) || turn.currentPlayerId;
    return {
      roundAdvanced: false,
      turnAdvanced: true,
      nextPlayerId: turn.currentPlayerId,
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

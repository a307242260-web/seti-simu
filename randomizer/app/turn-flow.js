(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppTurnFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createTurnState(sourcePlayers, options = {}) {
    const playerIds = (Array.isArray(sourcePlayers) ? sourcePlayers : [])
      .map((player) => player?.id)
      .filter(Boolean);
    const requestedCount = Math.max(1, Math.round(Number(options.activePlayerCount) || 1));
    const activePlayerCount = Math.min(requestedCount, playerIds.length || 1);
    const currentPlayerId = playerIds.includes(options.currentPlayerId) ? options.currentPlayerId : playerIds[0];
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
    const activeSet = new Set(turnState?.activePlayerIds || []);
    return (turnState?.turnOrderPlayerIds || []).filter((playerId) => activeSet.has(playerId));
  }

  function getRoundOrderPlayerIds(turnState) {
    const activeOrderedIds = getActiveOrderedPlayerIds(turnState);
    const startPlayerId = activeOrderedIds.includes(turnState?.startPlayerId)
      ? turnState.startPlayerId
      : activeOrderedIds[0];
    return rotatePlayerIds(activeOrderedIds, startPlayerId);
  }

  function shufflePlayerIds(playerIds) {
    const result = [...playerIds];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const pickIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[pickIndex]] = [result[pickIndex], result[index]];
    }
    return result;
  }

  function createTurnFlowController(context = {}) {
    const {
      players,
      turnState,
      playerState,
      uiRuntimeState,
      solarState,
      nebulaDataState,
      alienGameState,
      finalScoringState,
      rocketState,
      planetStatsState,
      techGameState,
      cardState,
      setupSelectionState,
      decisionSessions,
      cards,
      industry,
      finalScoring,
      data,
      tech,
      cardTaskStateModule,
      ruleLifecycle,
      clearTransientStateForRecovery,
      restoreMutableObject,
      resetScanRunSequence,
      resetActionLog,
      randomizeWheels,
      randomizeSectors,
      fillNebulaDataBoard,
      renderWheels,
      renderSectorNebulaDataBoard,
      randomizeFinalScores,
      randomizeAliens,
      renderRoundStatus,
      renderResidentDesktop,
      renderRotateStateToken,
      renderDebugPlayerSwitch,
      refreshHelpers,
      cancelIndustryAbilityFlow,
      closeFinalResultDialog,
      preparePassReservePilesForCurrentGame,
      initializeCardGame,
      configureDefaultAiOpponent,
      startInitialSelection,
      renderStateReadout,
      resize,
      clearPersistentGameState,
      schedulePersistentGameStateSave,
      seedDefaultReferenceRockets,
      getPlayerById,
      computePlayerFinalScoreBreakdown,
      defaultActivePlayerCount = 4,
      defaultInitialPlayerColor,
      defaultInitialHandCount = 5,
      finalRoundNumber = 5,
      finalScoreIds = [],
      aomomoClearNebulaId = null,
      normalizeAiDifficulty = (value) => String(value || ""),
      startScreenState,
      historyStepOrder,
      cardTaskState,
      els,
      setPersistentGameSaveSuspended,
    } = context;

    function setTurnStatePlayerOrder(playerIds, options = {}) {
      const validPlayerIds = (playerIds || []).filter((playerId) => getPlayerById?.(playerId));
      if (!validPlayerIds.length) return;

      const activePlayerCount = Math.min(
        Math.max(1, Math.round(Number(options.activePlayerCount) || turnState.activePlayerCount || 1)),
        validPlayerIds.length,
      );

      turnState.turnOrderPlayerIds = validPlayerIds;
      turnState.activePlayerCount = activePlayerCount;
      turnState.activePlayerIds = validPlayerIds.slice(0, activePlayerCount);
      turnState.startPlayerId = turnState.activePlayerIds[0] || validPlayerIds[0];
      turnState.roundNumber = 1;
      turnState.turnNumber = 1;
      turnState.actionCycleNumber = 1;
      turnState.passedPlayerIds = [];
      turnState.completedTurnPlayerIds = [];
      turnState.cardTurnEventBonuses = [];
      turnState.visitedPlanetsByPlayerId = {};
      turnState.gameEnded = false;
      turnState.gameEndReason = null;
      uiRuntimeState.finalResultAutoOpened = false;
      closeFinalResultDialog?.({ silent: true });
      playerState.currentPlayerId = turnState.startPlayerId;
      preparePassReservePilesForCurrentGame?.();
    }

    function randomizePlayerTurnOrder() {
      const playerIds = (playerState.players || []).map((player) => player.id);
      const defaultPlayerId = (playerState.players || [])
        .find((player) => player.color === defaultInitialPlayerColor)?.id;
      const shuffledIds = shufflePlayerIds(playerIds.filter((playerId) => playerId !== defaultPlayerId));
      const orderedIds = defaultPlayerId ? [defaultPlayerId, ...shuffledIds] : shufflePlayerIds(playerIds);
      setTurnStatePlayerOrder(orderedIds, {
        activePlayerCount: turnState.activePlayerCount || defaultActivePlayerCount,
      });
    }

    function isPlayerPassedThisRound(playerId) {
      return (turnState.passedPlayerIds || []).includes(playerId);
    }

    function hasPlayerCompletedThisTurn(playerId) {
      return (turnState.completedTurnPlayerIds || []).includes(playerId);
    }

    function getFirstEligiblePlayerId() {
      return getRoundOrderPlayerIds(turnState).find((playerId) => !isPlayerPassedThisRound(playerId)) || null;
    }

    function getNextEligiblePlayerId(afterPlayerId) {
      const order = getRoundOrderPlayerIds(turnState);
      if (!order.length) return null;
      const startIndex = order.includes(afterPlayerId) ? order.indexOf(afterPlayerId) : -1;

      for (let offset = 1; offset <= order.length; offset += 1) {
        const playerId = order[(startIndex + offset + order.length) % order.length];
        if (!isPlayerPassedThisRound(playerId) && !hasPlayerCompletedThisTurn(playerId)) {
          return playerId;
        }
      }

      return null;
    }

    function haveAllActivePlayersPassed() {
      return (turnState.activePlayerIds || []).length > 0
        && turnState.activePlayerIds.every((playerId) => isPlayerPassedThisRound(playerId));
    }

    function isFinalRound() {
      return Number(turnState.roundNumber) >= finalRoundNumber;
    }

    function buildFinalScoreSummaryLines() {
      return (playerState.players || [])
        .filter((player) => (turnState.activePlayerIds || []).includes(player.id))
        .map((player) => {
          const breakdown = computePlayerFinalScoreBreakdown(player);
          return `${player.colorLabel || player.name || player.id}：${breakdown.totalScore} 分`;
        });
    }

    function finishGameAfterFinalPass() {
      turnState.gameEnded = true;
      turnState.gameEndReason = "final_round_all_passed";
      return {
        roundAdvanced: false,
        turnAdvanced: false,
        gameEnded: true,
        nextPlayerId: playerState.currentPlayerId,
        finalScoreLines: buildFinalScoreSummaryLines(),
      };
    }

    function advanceRoundStartPlayer() {
      const activeOrderedIds = getActiveOrderedPlayerIds(turnState);
      if (!activeOrderedIds.length) return null;

      const currentStartIndex = activeOrderedIds.includes(turnState.startPlayerId)
        ? activeOrderedIds.indexOf(turnState.startPlayerId)
        : 0;
      turnState.startPlayerId = activeOrderedIds[(currentStartIndex + 1) % activeOrderedIds.length];
      return turnState.startPlayerId;
    }

    function beginNextRound() {
      cards.discardUnusedPassReserveCards(cardState, turnState.roundNumber);
      industry?.resetAllRoundIndustryRuntimeState?.(playerState.players);
      turnState.roundNumber += 1;
      turnState.turnNumber = 1;
      turnState.actionCycleNumber = 1;
      turnState.passedPlayerIds = [];
      turnState.completedTurnPlayerIds = [];
      turnState.cardTurnEventBonuses = [];
      turnState.visitedPlanetsByPlayerId = {};
      const nextStartPlayerId = advanceRoundStartPlayer();
      playerState.currentPlayerId = nextStartPlayerId || turnState.activePlayerIds[0] || playerState.currentPlayerId;
      return { roundAdvanced: true, turnAdvanced: true, nextPlayerId: playerState.currentPlayerId };
    }

    function getDisplayedTurnNumber(rawTurnNumber = turnState.turnNumber) {
      const activePlayerCount = Math.max(
        1,
        (turnState.activePlayerIds || []).length
          || Math.round(Number(turnState.activePlayerCount) || 0)
          || defaultActivePlayerCount,
      );
      const raw = Math.max(1, Math.round(Number(rawTurnNumber) || 1));
      return Math.floor((raw - 1) / activePlayerCount) + 1;
    }

    function getActionCycleNumber() {
      const value = Math.max(1, Math.round(Number(turnState.actionCycleNumber) || 1));
      if (turnState.actionCycleNumber !== value) turnState.actionCycleNumber = value;
      return value;
    }

    function advanceActionCycleNumber() {
      turnState.actionCycleNumber = getActionCycleNumber() + 1;
      return turnState.actionCycleNumber;
    }

    function clearCardTurnEventBonusesForPlayer(playerId) {
      if (!Array.isArray(turnState.cardTurnEventBonuses)) {
        turnState.cardTurnEventBonuses = [];
        return;
      }
      turnState.cardTurnEventBonuses = turnState.cardTurnEventBonuses
        .filter((bonus) => bonus.playerId !== playerId);
    }

    function clearTurnVisitedPlanetsForPlayer(playerId) {
      if (!playerId) return;
      if (!turnState.visitedPlanetsByPlayerId || typeof turnState.visitedPlanetsByPlayerId !== "object") {
        turnState.visitedPlanetsByPlayerId = {};
        return;
      }
      delete turnState.visitedPlanetsByPlayerId[playerId];
    }

    function advanceTurnAfterPlayerAction(playerId, options = {}) {
      if (!playerId) return { roundAdvanced: false, turnAdvanced: false, nextPlayerId: playerState.currentPlayerId };

      if (options.passed && !turnState.passedPlayerIds.includes(playerId)) {
        turnState.passedPlayerIds.push(playerId);
      }
      clearCardTurnEventBonusesForPlayer(playerId);
      clearTurnVisitedPlanetsForPlayer(playerId);
      if (!turnState.completedTurnPlayerIds.includes(playerId)) {
        turnState.completedTurnPlayerIds.push(playerId);
      }

      const completedCycleInfo = {
        completedActionCycle: true,
        completedActionCycleRoundNumber: turnState.roundNumber,
        completedActionCycleNumber: getActionCycleNumber(),
        completedActionCycleTurnNumber: getDisplayedTurnNumber(),
        completedActionCycleRawTurnNumber: turnState.turnNumber,
        completedActionCyclePlayerIds: [...(turnState.completedTurnPlayerIds || [])],
      };

      if (haveAllActivePlayersPassed() && isFinalRound()) {
        return finishGameAfterFinalPass();
      }

      if (haveAllActivePlayersPassed()) {
        return { ...beginNextRound(), ...completedCycleInfo };
      }

      const nextPlayerId = getNextEligiblePlayerId(playerId);
      if (nextPlayerId) {
        playerState.currentPlayerId = nextPlayerId;
        turnState.turnNumber += 1;
        return { roundAdvanced: false, turnAdvanced: true, nextPlayerId };
      }

      turnState.turnNumber += 1;
      turnState.completedTurnPlayerIds = [];
      advanceActionCycleNumber();
      const firstEligiblePlayerId = getFirstEligiblePlayerId();
      playerState.currentPlayerId = firstEligiblePlayerId || playerState.currentPlayerId;
      return {
        roundAdvanced: false,
        turnAdvanced: true,
        nextPlayerId: playerState.currentPlayerId,
        ...completedCycleInfo,
      };
    }

    function resetGameStateForNewGame(options = {}) {
      const activePlayerCount = Math.min(
        Math.max(1, Math.round(Number(options.activePlayerCount) || defaultActivePlayerCount)),
        players.PLAYER_COLOR_IDS.length,
      );

      clearTransientStateForRecovery();
      const resetResult = ruleLifecycle.newGame({
        activePlayerCount,
        defaultInitialPlayerColor,
        finalScoreIds,
      });
      if (!resetResult.ok) {
        throw new Error(`StateStore 新局重置失败：${resetResult.code || "unknown"}`);
      }
      restoreMutableObject(cardTaskState, cardTaskStateModule.createTaskState());
      restoreMutableObject(setupSelectionState, {
        phase: "selecting",
        currentPlayerId: null,
        offersByPlayerId: {},
        confirmedPlayerIds: [],
      });
      historyStepOrder.length = 0;
      resetScanRunSequence();
      resetActionLog();
    }

    function randomizeAll() {
      els?.spinButton?.classList.remove("pulsin");
      resetActionLog();
      decisionSessions?.clear?.("jiuzhe_card_play");
      decisionSessions?.clear?.("jiuzhe_opportunity_open");
      decisionSessions?.clear?.("jiuzhe_opportunity_queue");
      decisionSessions?.clear?.("banrenma_card_gain");
      decisionSessions?.clear?.("banrenma_opportunity");
      decisionSessions?.clear?.("banrenma_opportunity_queue");
      decisionSessions?.clear?.("aomomo_card_gain");
      decisionSessions?.clear?.("runezu_card_gain");
      decisionSessions?.clear?.("runezu_symbol_branch");
      decisionSessions?.clear?.("runezu_face_symbol_placement");
      industry?.resetAllIndustryActionMarks?.(playerState.players);
      cancelIndustryAbilityFlow?.({ silent: true });
      randomizePlayerTurnOrder();
      randomizeWheels?.();
      randomizeSectors?.();
      fillNebulaDataBoard?.({ source: "setup", replace: true });
      solarState.aomomoActive = false;
      if (aomomoClearNebulaId) data.clearNebulaData(nebulaDataState, aomomoClearNebulaId);
      renderWheels?.();
      renderSectorNebulaDataBoard?.();
      randomizeFinalScores?.();
      randomizeAliens?.();
      tech.setupBoardBonuses(techGameState);
      renderRoundStatus?.();
      renderRotateStateToken?.();
      renderDebugPlayerSwitch?.();
      refreshHelpers?.refreshBoardState?.({
        includeSectorNebula: false,
        includeFinalScore: true,
        includeTech: true,
      });
      refreshHelpers?.refreshPlayerPanels?.();
      refreshHelpers?.refreshAfterPendingChange?.({
        includeQuickPanel: false,
        includeEffectBar: false,
        includeStateReadout: true,
      });
      renderResidentDesktop?.();
    }

    function startNewGame(options = {}) {
      setPersistentGameSaveSuspended?.(true);
      try {
        const aiDifficulty = normalizeAiDifficulty(options.aiDifficulty ?? startScreenState?.aiDifficulty);
        if (startScreenState) {
          startScreenState.aiDifficulty = aiDifficulty;
        }
        if (els?.startAiDifficulty) {
          els.startAiDifficulty.value = aiDifficulty;
        }
        if (options.clearStorage !== false) {
          clearPersistentGameState?.();
        }
        resetGameStateForNewGame(options);
        seedDefaultReferenceRockets?.();
        randomizeAll();
        initializeCardGame?.(defaultInitialHandCount);
        configureDefaultAiOpponent?.({ aiDifficulty });
        startInitialSelection?.();
        rocketState.statusNote = options.message || "新游戏已开始，请完成初始选择。";
        renderStateReadout?.();
        resize?.();
      } finally {
        setPersistentGameSaveSuspended?.(false);
      }
      schedulePersistentGameStateSave?.({ force: true, label: "新游戏开始" });
      return { ok: true, message: rocketState.statusNote };
    }

    return {
      setTurnStatePlayerOrder,
      randomizePlayerTurnOrder,
      beginNextRound,
      getDisplayedTurnNumber,
      getActionCycleNumber,
      advanceTurnAfterPlayerAction,
      resetGameStateForNewGame,
      startNewGame,
      randomizeAll,
    };
  }

  return {
    createTurnState,
    getActiveOrderedPlayerIds,
    getRoundOrderPlayerIds,
    createTurnFlowController,
  };
});

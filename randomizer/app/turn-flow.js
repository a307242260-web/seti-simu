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

  function isPlayerPassed(turnState, playerId) {
    return (turnState?.passedPlayerIds || []).includes(playerId);
  }

  function hasPlayerCompletedTurn(turnState, playerId) {
    return (turnState?.completedTurnPlayerIds || []).includes(playerId);
  }

  function getFirstEligiblePlayerId(turnState) {
    return getRoundOrderPlayerIds(turnState).find((playerId) => !isPlayerPassed(turnState, playerId)) || null;
  }

  function getNextEligiblePlayerId(turnState, afterPlayerId) {
    const order = getRoundOrderPlayerIds(turnState);
    if (!order.length) return null;
    const startIndex = order.includes(afterPlayerId) ? order.indexOf(afterPlayerId) : -1;
    for (let offset = 1; offset <= order.length; offset += 1) {
      const playerId = order[(startIndex + offset + order.length) % order.length];
      if (!isPlayerPassed(turnState, playerId) && !hasPlayerCompletedTurn(turnState, playerId)) return playerId;
    }
    return null;
  }

  function haveAllActivePlayersPassed(turnState) {
    return (turnState?.activePlayerIds || []).length > 0
      && turnState.activePlayerIds.every((playerId) => isPlayerPassed(turnState, playerId));
  }

  function isFinalRound(turnState, finalRoundNumber) {
    return Number(turnState?.roundNumber) >= Number(finalRoundNumber);
  }

  function isGameEnded(workingRoot) {
    return Boolean(workingRoot?.turnState?.gameEnded);
  }

  function buildFinalScoreSummaryLines(workingRoot, computeBreakdown) {
    if (typeof computeBreakdown !== "function") throw new TypeError("buildFinalScoreSummaryLines 缺少计分函数");
    return (workingRoot?.playerState?.players || [])
      .filter((player) => (workingRoot?.turnState?.activePlayerIds || []).includes(player.id))
      .map((player) => {
        const breakdown = computeBreakdown(workingRoot, player);
        return `${player.colorLabel || player.name || player.id}：${breakdown.totalScore} 分`;
      });
  }

  function ensureVisitedPlanetsByPlayerId(turnState) {
    if (!turnState.visitedPlanetsByPlayerId || typeof turnState.visitedPlanetsByPlayerId !== "object") {
      turnState.visitedPlanetsByPlayerId = {};
    }
    return turnState.visitedPlanetsByPlayerId;
  }

  function hasPlayerVisitedPlanetThisTurn(workingRoot, player, planetId) {
    const playerId = player?.id || player?.playerId || null;
    if (!playerId || !planetId) return false;
    return (ensureVisitedPlanetsByPlayerId(workingRoot.turnState)[playerId] || []).includes(planetId);
  }

  function recordTurnVisitPlanetEvents(workingRoot, events = []) {
    const turnState = workingRoot?.turnState;
    if (!turnState) throw new TypeError("recordTurnVisitPlanetEvents 缺少 workingRoot.turnState");
    const visitEvents = events.filter((event) => event?.type === "visitPlanet" && event.planetId);
    if (!visitEvents.length) return null;
    const beforeVisits = structuredClone(turnState.visitedPlanetsByPlayerId || {});
    const visitsByPlayerId = ensureVisitedPlanetsByPlayerId(turnState);
    const fallbackPlayerId = workingRoot?.playerState?.currentPlayerId || null;
    let changed = false;
    for (const event of visitEvents) {
      const playerId = event.playerId || fallbackPlayerId;
      if (!playerId) continue;
      if (!Array.isArray(visitsByPlayerId[playerId])) visitsByPlayerId[playerId] = [];
      if (visitsByPlayerId[playerId].includes(event.planetId)) continue;
      visitsByPlayerId[playerId].push(event.planetId);
      changed = true;
    }
    if (!changed) return null;
    return {
      label: "恢复本回合访问记录",
      describe: "恢复本回合已访问星球记录",
      undo() {
        turnState.visitedPlanetsByPlayerId = structuredClone(beforeVisits);
      },
    };
  }

  function createTurnReadoutRuntime(context = {}) {
    const readRoot = (workingRoot = null) => workingRoot || context.getRuleReadout();
    function isWeakStartAiDifficulty(player) {
      return player?.aiDifficulty === context.weakStartAiDifficulty;
    }
    function isPlayerPassedThisRound(playerId) {
      return isPlayerPassed(readRoot().turnState, playerId);
    }
    function hasPlayerCompletedThisTurn(playerId) {
      return hasPlayerCompletedTurn(readRoot().turnState, playerId);
    }
    function getFirstEligiblePlayerIdFromReadout() {
      return getFirstEligiblePlayerId(readRoot().turnState);
    }
    function getNextEligiblePlayerIdFromReadout(afterPlayerId) {
      return getNextEligiblePlayerId(readRoot().turnState, afterPlayerId);
    }
    function haveAllActivePlayersPassedFromReadout() {
      return haveAllActivePlayersPassed(readRoot().turnState);
    }
    function isFinalRoundFromReadout(candidateTurnState = null) {
      return isFinalRound(candidateTurnState || readRoot().turnState, context.finalRoundNumber);
    }
    function isGameEndedFromReadout(workingRoot = null) {
      return isGameEnded(readRoot(workingRoot));
    }
    function buildFinalScoreSummaryLinesForRoot(workingRoot) {
      return buildFinalScoreSummaryLines(
        workingRoot,
        (root, player) => context.computePlayerFinalScoreBreakdown(player, root),
      );
    }
    function buildFinalScoreSummaryLinesFromHost() {
      return context.submitHostCommand({ kind: "score_build_final_summary" }, { commit: false }).value || [];
    }
    function renderRoundStatus() {
      const input = context.createResidentRenderInput();
      if (input) context.renderResidentRoundStatus(input);
    }
    function getTurnReadoutLines() {
      const turnState = readRoot().turnState;
      const labels = (ids, separator, fallback = "无") => (
        (ids || []).map(context.getPlayerLabelById).join(separator) || fallback
      );
      const agentLabels = (turnState.activePlayerIds || [])
        .map((playerId) => `${context.getPlayerLabelById(playerId)}=${context.getPlayerAgentLabel(playerId)}`)
        .join("、") || "无";
      return [
        "轮次状态",
        isGameEndedFromReadout()
          ? `游戏结束：第${turnState.roundNumber}轮全员 PASS，进行终局计分`
          : `第${turnState.roundNumber}轮 第${context.getDisplayedTurnNumber()}回合`,
        `基础顺位 ${labels(turnState.turnOrderPlayerIds, " > ")}`,
        `本轮顺位 ${labels(context.getRoundOrderPlayerIds(), " > ")}`,
        `玩家代理 ${agentLabels}`,
        `本轮已 PASS ${labels(turnState.passedPlayerIds, "、")}`,
        `当前行动圈已行动 ${labels(turnState.completedTurnPlayerIds, "、")}`,
      ];
    }
    return Object.freeze({
      buildFinalScoreSummaryLines: buildFinalScoreSummaryLinesFromHost,
      buildFinalScoreSummaryLinesForRoot,
      getFirstEligiblePlayerId: getFirstEligiblePlayerIdFromReadout,
      getNextEligiblePlayerId: getNextEligiblePlayerIdFromReadout,
      getTurnReadoutLines,
      hasPlayerCompletedThisTurn,
      hasPlayerVisitedPlanetThisTurn,
      haveAllActivePlayersPassed: haveAllActivePlayersPassedFromReadout,
      isFinalRound: isFinalRoundFromReadout,
      isGameEnded: isGameEndedFromReadout,
      isPlayerPassedThisRound,
      isWeakStartAiDifficulty,
      recordTurnVisitPlanetEvents,
      renderRoundStatus,
    });
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
      uiRuntimeState,
      setupSelectionState,
      cards,
      industry,
      finalScoring,
      solar,
      data,
      tech,
      cardTaskStateModule,
      ruleLifecycle,
      clearTransientStateForRecovery,
      restoreMutableObject,
      resetScanRunSequence,
      resetActionLog,
      randomizeWheels: randomizeWheelsOverride,
      randomizeSectors: randomizeSectorsOverride,
      fillNebulaDataBoard,
      renderWheels,
      renderSectorNebulaDataBoard,
      randomizeFinalScores: randomizeFinalScoresOverride,
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
      wheelOffsets = {},
      aomomoClearNebulaId = null,
      normalizeAiDifficulty = (value) => String(value || ""),
      startScreenState,
      historyStepOrder,
      cardTaskState,
      els,
      setPersistentGameSaveSuspended,
    } = context;

    function requireWorkingRoot(workingRoot) {
      if (!workingRoot || typeof workingRoot !== "object") {
        throw new TypeError("turn operation requires an explicit workingRoot");
      }
    }

    function randomizeWheels(workingRoot) {
      if (typeof randomizeWheelsOverride === "function") return randomizeWheelsOverride(workingRoot);
      const workingSolarState = workingRoot.solarState;
      for (let wheel = 1; wheel <= 4; wheel += 1) {
        const delta = Math.floor(Math.random() * 8 + Number(wheelOffsets[wheel] || 0));
        workingSolarState.wheelSteps[wheel] -= delta;
      }
      workingSolarState.rotation = solar.normalizeRotationState(workingSolarState.wheelSteps, 0);
      renderWheels?.();
    }

    function randomizeSectors(workingRoot) {
      if (typeof randomizeSectorsOverride === "function") return randomizeSectorsOverride(workingRoot);
      const pool = [1, 2, 3, 4];
      while (pool.length) {
        const slotId = pool.length;
        const pickIndex = Math.floor(Math.random() * pool.length);
        workingRoot.solarState.sectorBySlot[slotId] = pool.splice(pickIndex, 1)[0];
      }
      renderSectorNebulaDataBoard?.();
    }

    function randomizeFinalScores(workingRoot) {
      if (typeof randomizeFinalScoresOverride === "function") return randomizeFinalScoresOverride(workingRoot);
      finalScoring.randomizeTileVariants(workingRoot.finalScoringState, finalScoreIds);
      for (const image of els?.finalScoreTiles || []) {
        const id = image.dataset.finalId;
        if (!id) continue;
        const variant = finalScoring.getTileVariant(workingRoot.finalScoringState, id);
        image.src = `../assets/final/final_${id}${variant}.png`;
        image.alt = `终局计分 ${id.toUpperCase()}${variant}`;
      }
    }

    function setTurnStatePlayerOrder(workingRoot, playerIds, options = {}) {
      requireWorkingRoot(workingRoot);
      const { turnState, playerState } = workingRoot;
      const knownPlayerIds = new Set((playerState.players || []).map((player) => player.id));
      const validPlayerIds = (playerIds || []).filter((playerId) => knownPlayerIds.has(playerId));
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
      preparePassReservePilesForCurrentGame?.(workingRoot);
    }

    function randomizePlayerTurnOrder(workingRoot) {
      requireWorkingRoot(workingRoot);
      const { turnState, playerState } = workingRoot;
      const playerIds = (playerState.players || []).map((player) => player.id);
      const defaultPlayerId = (playerState.players || [])
        .find((player) => player.color === defaultInitialPlayerColor)?.id;
      const shuffledIds = shufflePlayerIds(playerIds.filter((playerId) => playerId !== defaultPlayerId));
      const orderedIds = defaultPlayerId ? [defaultPlayerId, ...shuffledIds] : shufflePlayerIds(playerIds);
      setTurnStatePlayerOrder(workingRoot, orderedIds, {
        activePlayerCount: turnState.activePlayerCount || defaultActivePlayerCount,
    });
  }

    function beginNextRound(workingRoot) {
      requireWorkingRoot(workingRoot);
      const { cardState, playerState, turnState } = workingRoot;
      cards.discardUnusedPassReserveCards(cardState, turnState.roundNumber);
      industry?.resetAllRoundIndustryRuntimeState?.(playerState.players);
      turnState.roundNumber += 1;
      turnState.turnNumber = 1;
      turnState.actionCycleNumber = 1;
      turnState.passedPlayerIds = [];
      turnState.completedTurnPlayerIds = [];
      turnState.cardTurnEventBonuses = [];
      turnState.visitedPlanetsByPlayerId = {};
      const activeOrderedIds = getActiveOrderedPlayerIds(turnState);
      let nextStartPlayerId = null;
      if (activeOrderedIds.length) {
        const currentStartIndex = activeOrderedIds.includes(turnState.startPlayerId)
          ? activeOrderedIds.indexOf(turnState.startPlayerId)
          : 0;
        turnState.startPlayerId = activeOrderedIds[(currentStartIndex + 1) % activeOrderedIds.length];
        nextStartPlayerId = turnState.startPlayerId;
      }
      playerState.currentPlayerId = nextStartPlayerId || turnState.activePlayerIds[0] || playerState.currentPlayerId;
      return { roundAdvanced: true, turnAdvanced: true, nextPlayerId: playerState.currentPlayerId };
    }

    function getDisplayedTurnNumber(workingRoot, rawTurnNumber = workingRoot?.turnState?.turnNumber) {
      requireWorkingRoot(workingRoot);
      const { turnState } = workingRoot;
      const activePlayerCount = Math.max(
        1,
        (turnState.activePlayerIds || []).length
          || Math.round(Number(turnState.activePlayerCount) || 0)
          || defaultActivePlayerCount,
      );
      const raw = Math.max(1, Math.round(Number(rawTurnNumber) || 1));
      return Math.floor((raw - 1) / activePlayerCount) + 1;
    }

    function getActionCycleNumber(workingRoot) {
      requireWorkingRoot(workingRoot);
      const { turnState } = workingRoot;
      return Math.max(1, Math.round(Number(turnState.actionCycleNumber) || 1));
    }

    function advanceTurnAfterPlayerAction(workingRoot, playerId, options = {}) {
      requireWorkingRoot(workingRoot);
      const actionTurnState = workingRoot.turnState;
      const actionPlayerState = workingRoot.playerState;
      const actionCardState = workingRoot.cardState;
      const isPassed = (id) => (actionTurnState.passedPlayerIds || []).includes(id);
      const isCompleted = (id) => (actionTurnState.completedTurnPlayerIds || []).includes(id);
      const roundOrder = () => getRoundOrderPlayerIds(actionTurnState);
      const displayedTurnNumber = (rawTurnNumber = actionTurnState.turnNumber) => {
        const activePlayerCount = Math.max(
          1,
          (actionTurnState.activePlayerIds || []).length
            || Math.round(Number(actionTurnState.activePlayerCount) || 0)
            || defaultActivePlayerCount,
        );
        return Math.floor((Math.max(1, Math.round(Number(rawTurnNumber) || 1)) - 1) / activePlayerCount) + 1;
      };
      const actionCycleNumber = () => {
        const value = Math.max(1, Math.round(Number(actionTurnState.actionCycleNumber) || 1));
        if (actionTurnState.actionCycleNumber !== value) actionTurnState.actionCycleNumber = value;
        return value;
      };
      const allPassed = () => (actionTurnState.activePlayerIds || []).length > 0
        && actionTurnState.activePlayerIds.every(isPassed);
      const nextEligible = (afterPlayerId) => {
        const order = roundOrder();
        if (!order.length) return null;
        const startIndex = order.includes(afterPlayerId) ? order.indexOf(afterPlayerId) : -1;
        for (let offset = 1; offset <= order.length; offset += 1) {
          const id = order[(startIndex + offset + order.length) % order.length];
          if (!isPassed(id) && !isCompleted(id)) return id;
        }
        return null;
      };
      const firstEligible = () => roundOrder().find((id) => !isPassed(id)) || null;
      const beginActionNextRound = () => {
        cards.discardUnusedPassReserveCards(actionCardState, actionTurnState.roundNumber);
        industry?.resetAllRoundIndustryRuntimeState?.(actionPlayerState.players);
        actionTurnState.roundNumber += 1;
        actionTurnState.turnNumber = 1;
        actionTurnState.actionCycleNumber = 1;
        actionTurnState.passedPlayerIds = [];
        actionTurnState.completedTurnPlayerIds = [];
        actionTurnState.cardTurnEventBonuses = [];
        actionTurnState.visitedPlanetsByPlayerId = {};
        const activeIds = getActiveOrderedPlayerIds(actionTurnState);
        if (activeIds.length) {
          const startIndex = activeIds.includes(actionTurnState.startPlayerId)
            ? activeIds.indexOf(actionTurnState.startPlayerId)
            : 0;
          actionTurnState.startPlayerId = activeIds[(startIndex + 1) % activeIds.length];
        }
        actionPlayerState.currentPlayerId = actionTurnState.startPlayerId
          || actionTurnState.activePlayerIds?.[0]
          || actionPlayerState.currentPlayerId;
        return { roundAdvanced: true, turnAdvanced: true, nextPlayerId: actionPlayerState.currentPlayerId };
      };
      if (!playerId) return { roundAdvanced: false, turnAdvanced: false, nextPlayerId: actionPlayerState.currentPlayerId };

      if (options.passed && !isPassed(playerId)) {
        actionTurnState.passedPlayerIds.push(playerId);
      }
      actionTurnState.cardTurnEventBonuses = (actionTurnState.cardTurnEventBonuses || [])
        .filter((bonus) => bonus.playerId !== playerId);
      if (!actionTurnState.visitedPlanetsByPlayerId || typeof actionTurnState.visitedPlanetsByPlayerId !== "object") {
        actionTurnState.visitedPlanetsByPlayerId = {};
      }
      delete actionTurnState.visitedPlanetsByPlayerId[playerId];
      if (!isCompleted(playerId)) {
        actionTurnState.completedTurnPlayerIds.push(playerId);
      }

      const completedCycleInfo = {
        completedActionCycle: true,
        completedActionCycleRoundNumber: actionTurnState.roundNumber,
        completedActionCycleNumber: actionCycleNumber(),
        completedActionCycleTurnNumber: displayedTurnNumber(),
        completedActionCycleRawTurnNumber: actionTurnState.turnNumber,
        completedActionCyclePlayerIds: [...(actionTurnState.completedTurnPlayerIds || [])],
      };

      if (allPassed() && Number(actionTurnState.roundNumber) >= finalRoundNumber) {
        actionTurnState.gameEnded = true;
        actionTurnState.gameEndReason = "final_round_all_passed";
        return {
          roundAdvanced: false,
          turnAdvanced: false,
          gameEnded: true,
          nextPlayerId: actionPlayerState.currentPlayerId,
          finalScoreLines: (actionPlayerState.players || [])
            .filter((player) => (actionTurnState.activePlayerIds || []).includes(player.id))
            .map((player) => {
              const breakdown = computePlayerFinalScoreBreakdown(workingRoot, player);
              return `${player.colorLabel || player.name || player.id}：${breakdown.totalScore} 分`;
            }),
        };
      }

      if (allPassed()) {
        return { ...beginActionNextRound(), ...completedCycleInfo };
      }

      const nextPlayerId = nextEligible(playerId);
      if (nextPlayerId) {
        actionPlayerState.currentPlayerId = nextPlayerId;
        actionTurnState.turnNumber += 1;
        return { roundAdvanced: false, turnAdvanced: true, nextPlayerId };
      }

      actionTurnState.turnNumber += 1;
      actionTurnState.completedTurnPlayerIds = [];
      actionTurnState.actionCycleNumber = actionCycleNumber() + 1;
      const firstEligiblePlayerId = firstEligible();
      actionPlayerState.currentPlayerId = firstEligiblePlayerId || actionPlayerState.currentPlayerId;
      return {
        roundAdvanced: false,
        turnAdvanced: true,
        nextPlayerId: actionPlayerState.currentPlayerId,
        ...completedCycleInfo,
      };
    }

    function resetGameStateForNewGame(workingRoot, options = {}) {
      requireWorkingRoot(workingRoot);
      const activePlayerCount = Math.min(
        Math.max(1, Math.round(Number(options.activePlayerCount) || defaultActivePlayerCount)),
        players.PLAYER_COLOR_IDS.length,
      );

      clearTransientStateForRecovery();
      if (options.compositionStatePrepared !== true) {
        const resetResult = ruleLifecycle.newGame({
          activePlayerCount,
          defaultInitialPlayerColor,
          finalScoreIds,
        });
        if (!resetResult.ok) {
          throw new Error(`StateStore 新局重置失败：${resetResult.code || "unknown"}`);
        }
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

    function randomizeAll(workingRoot) {
      requireWorkingRoot(workingRoot);
      const {
        alienGameState,
        nebulaDataState,
        planetStatsState,
        playerState,
        rocketState,
        solarState,
        techGameState,
      } = workingRoot;
      els?.spinButton?.classList.remove("pulsin");
      resetActionLog();
      industry?.resetAllIndustryActionMarks?.(playerState.players);
      cancelIndustryAbilityFlow?.({ silent: true });
      randomizePlayerTurnOrder(workingRoot);
      randomizeWheels?.(workingRoot);
      randomizeSectors?.(workingRoot);
      fillNebulaDataBoard?.({ source: "setup", replace: true });
      solarState.aomomoActive = false;
      if (aomomoClearNebulaId) data.clearNebulaData(nebulaDataState, aomomoClearNebulaId);
      renderWheels?.();
      renderSectorNebulaDataBoard?.();
      randomizeFinalScores?.(workingRoot);
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

    function startNewGame(workingRoot, options = {}) {
      requireWorkingRoot(workingRoot);
      const { rocketState } = workingRoot;
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
        resetGameStateForNewGame(workingRoot, options);
        seedDefaultReferenceRockets?.();
        randomizeAll(workingRoot);
        initializeCardGame?.(workingRoot, defaultInitialHandCount);
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
    isPlayerPassed,
    hasPlayerCompletedTurn,
    getFirstEligiblePlayerId,
    getNextEligiblePlayerId,
    haveAllActivePlayersPassed,
    isFinalRound,
    isGameEnded,
    buildFinalScoreSummaryLines,
    hasPlayerVisitedPlanetThisTurn,
    recordTurnVisitPlanetEvents,
    createTurnFlowController,
    createTurnReadoutRuntime,
  };
});

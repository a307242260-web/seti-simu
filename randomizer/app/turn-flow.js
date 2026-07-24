(function (root, factory) {
  "use strict";
  let productionTurnFlow = root.SetiTurnFlow;
  if (!productionTurnFlow && typeof require === "function") {
    productionTurnFlow = require("../game/turn-flow");
  }
  const api = factory(productionTurnFlow);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppTurnFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (productionTurnFlow) {
  "use strict";
  function createTurnOwnerInputPort(registry, context = {}) {
    return registry.register("turn", {
      setPlayerOrder: (workingRoot, command) => (
        context.getController().setTurnStatePlayerOrder(
          workingRoot,
          command.playerIds ?? command.args?.[0],
          command.options ?? command.args?.[1],
        ),
        { ok: true, value: { ok: true } }
      ),
      randomizePlayerOrder: (workingRoot) => (
        context.getController().randomizePlayerTurnOrder(workingRoot),
        { ok: true, value: { ok: true } }
      ),
      beginNextRound: (workingRoot) => {
        const value = context.getController().beginNextRound(workingRoot);
        return { ok: true, value };
      },
      advanceAfterAction: (workingRoot, command) => {
        const value = context.getController().advanceTurnAfterPlayerAction(
          workingRoot,
          command.playerId ?? command.args?.[0],
          command.options ?? command.args?.[1],
        );
        return { ok: true, value };
      },
      startNewGame: (workingRoot, command) => {
        const value = context.getController().startNewGame(
          workingRoot,
          command.options ?? command.args?.[0],
        );
        return { ok: value?.ok !== false, value };
      },
      randomizeAll: (workingRoot) => (
        context.getController().randomizeAll(workingRoot),
        { ok: true, value: { ok: true } }
      ),
    });
  }

  function createTurnReadoutOwnerInputPort(registry, context = {}) {
    return registry.register("turn_readout", {
      buildFinalSummary: (workingRoot) => ({
        ok: true,
        value: context.buildFinalSummary(workingRoot),
      }),
    });
  }



  function createTurnState(sourcePlayers, options = {}) {
    return productionTurnFlow.createTurnState(sourcePlayers, options);
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
    const readProjection = () => context.assertTurnFlowProjection(context.getTurnFlowProjection());
    function isWeakStartAiDifficulty(player) {
      return player?.aiDifficulty === context.weakStartAiDifficulty;
    }
    function isPlayerPassedThisRound(playerId) {
      return readProjection().passedPlayerIds.includes(playerId);
    }
    function hasPlayerCompletedThisTurn(playerId) {
      return readProjection().completedTurnPlayerIds.includes(playerId);
    }
    function getFirstEligiblePlayerIdFromReadout() {
      const projection = readProjection();
      return projection.roundOrderPlayerIds.find((id) => !projection.passedPlayerIds.includes(id)) || null;
    }
    function getNextEligiblePlayerIdFromReadout(afterPlayerId) {
      const projection = readProjection();
      const order = projection.roundOrderPlayerIds;
      const startIndex = Math.max(-1, order.indexOf(afterPlayerId));
      for (let offset = 1; offset <= order.length; offset += 1) {
        const id = order[(startIndex + offset) % order.length];
        if (!projection.passedPlayerIds.includes(id)
          && !projection.completedTurnPlayerIds.includes(id)) return id;
      }
      return null;
    }
    function haveAllActivePlayersPassedFromReadout() {
      const projection = readProjection();
      return projection.activePlayerIds.length > 0
        && projection.activePlayerIds.every((id) => projection.passedPlayerIds.includes(id));
    }
    function isFinalRoundFromReadout(candidateTurnState = null) {
      return candidateTurnState
        ? isFinalRound(candidateTurnState, context.finalRoundNumber)
        : readProjection().roundNumber >= context.finalRoundNumber;
    }
    function isGameEndedFromReadout(workingRoot = null) {
      return workingRoot ? isGameEnded(workingRoot) : readProjection().terminal;
    }
    function buildFinalScoreSummaryLinesForRoot(workingRoot) {
      return buildFinalScoreSummaryLines(
        workingRoot,
        (root, player) => context.computePlayerFinalScoreBreakdown(player, root),
      );
    }
    function buildFinalScoreSummaryLinesFromHost() {
      return context.inputPort.buildFinalSummary() || [];
    }
    function renderRoundStatus() {
      const input = context.createResidentRenderInput();
      if (input) context.renderResidentRoundStatus(input);
    }
    function getTurnReadoutLines() {
      const projection = readProjection();
      const labels = (ids, separator, fallback = "无") => (
        (ids || []).map((id) => projection.playerLabelsById[String(id)] || String(id)).join(separator) || fallback
      );
      const agentLabels = projection.activePlayerIds
        .map((playerId) => `${projection.playerLabelsById[String(playerId)] || playerId}=${projection.playerAgentLabelsById[String(playerId)] || "玩家"}`)
        .join("、") || "无";
      return [
        "轮次状态",
        isGameEndedFromReadout()
          ? `游戏结束：第${projection.roundNumber}轮全员 PASS，进行终局计分`
          : `第${projection.roundNumber}轮 第${projection.displayedTurnNumber}回合`,
        `基础顺位 ${labels(projection.turnOrderPlayerIds, " > ")}`,
        `本轮顺位 ${labels(projection.roundOrderPlayerIds, " > ")}`,
        `玩家代理 ${agentLabels}`,
        `本轮已 PASS ${labels(projection.passedPlayerIds, "、")}`,
        `当前行动圈已行动 ${labels(projection.completedTurnPlayerIds, "、")}`,
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

  const BROWSER_TURN_FLOW_STATIC_KEYS = Object.freeze([
    "players",
    "cards",
    "industry",
    "finalScoring",
    "solar",
    "data",
    "aliens",
    "rocketActions",
    "planetStats",
    "tech",
    "cardTaskStateModule",
  ]);

  function createBrowserTurnFlowStaticContext(dependencies = {}) {
    const context = {};
    for (const key of BROWSER_TURN_FLOW_STATIC_KEYS) {
      if (dependencies[key] == null) {
        throw new TypeError(`TurnFlow 静态模块缺少依赖：${key}`);
      }
      context[key] = dependencies[key];
    }
    return Object.freeze(context);
  }

  function createBrowserTurnFlowController(options = {}) {
    const {
      staticContext,
      ruleLifecycle,
      cardSetupController,
      persistenceController,
      refreshRuntime,
      renderRuntime,
      resetPort,
      setupPort,
      scorePort,
      hostPort,
    } = options;
    const owners = {
      staticContext,
      ruleLifecycle,
      cardSetupController,
      persistenceController,
      refreshRuntime,
      renderRuntime,
      resetPort,
      setupPort,
      scorePort,
      hostPort,
    };
    for (const [name, owner] of Object.entries(owners)) {
      if (!owner || typeof owner !== "object") {
        throw new TypeError(`TurnFlow bootstrap 缺少 owner：${name}`);
      }
    }
    const requireCapability = (ownerName, capability) => {
      const value = owners[ownerName][capability];
      if (typeof value !== "function") {
        throw new TypeError(`TurnFlow ${ownerName} 缺少能力：${capability}`);
      }
      return value;
    };

    return createTurnFlowController({
      ...staticContext,
      ruleLifecycle,
      clearTransientStateForRecovery: requireCapability(
        "resetPort",
        "clearTransientStateForRecovery",
      ),
      restoreMutableObject: requireCapability("resetPort", "restoreMutableObject"),
      createTurnState: requireCapability("resetPort", "createTurnState"),
      resetScanRunSequence: requireCapability("resetPort", "resetScanRunSequence"),
      resetActionLog: requireCapability("resetPort", "resetActionLog"),
      fillNebulaDataBoard: requireCapability("setupPort", "fillNebulaDataBoard"),
      randomizeAliens: requireCapability("setupPort", "randomizeAliens"),
      cancelIndustryAbilityFlow: requireCapability("setupPort", "cancelIndustryAbilityFlow"),
      closeFinalResultDialog: requireCapability("setupPort", "closeFinalResultDialog"),
      preparePassReservePilesForCurrentGame: requireCapability(
        "cardSetupController",
        "preparePassReservePilesForCurrentGame",
      ),
      initializeCardGame: requireCapability("cardSetupController", "initializeCardGame"),
      configureDefaultAiOpponent: requireCapability("setupPort", "configureDefaultAiOpponent"),
      startInitialSelection: requireCapability("setupPort", "startInitialSelection"),
      seedDefaultReferenceRockets: requireCapability("setupPort", "seedDefaultReferenceRockets"),
      renderWheels: requireCapability("renderRuntime", "renderWheels"),
      renderSectorNebulaDataBoard: requireCapability(
        "renderRuntime",
        "renderSectorNebulaDataBoard",
      ),
      renderRotateStateToken: requireCapability("renderRuntime", "renderRotateStateToken"),
      renderStateReadout: requireCapability("renderRuntime", "renderStateReadout"),
      refreshHelpers: refreshRuntime,
      clearPersistentGameState: requireCapability(
        "persistenceController",
        "clearPersistentGameState",
      ),
      schedulePersistentGameStateSave: requireCapability(
        "persistenceController",
        "schedulePersistentGameStateSave",
      ),
      setPersistentGameSaveSuspended: requireCapability(
        "persistenceController",
        "setPersistentGameSaveSuspended",
      ),
      computePlayerFinalScoreBreakdown: requireCapability(
        "scorePort",
        "computePlayerFinalScoreBreakdown",
      ),
      ...hostPort,
    });
  }

  function createTurnHostRuntime(context = {}) {
    const controller = () => context.getController();
    const readProjection = () => context.assertTurnFlowProjection(context.getTurnFlowProjection());
    function getActiveOrderedPlayerIdsFromReadout() {
      const projection = readProjection();
      const active = new Set(projection.activePlayerIds);
      return projection.turnOrderPlayerIds.filter((id) => active.has(id));
    }
    function getRoundOrderPlayerIdsFromReadout() {
      return [...readProjection().roundOrderPlayerIds];
    }
    function setTurnStatePlayerOrderFromHost(playerIds, options = {}) {
      return context.turnInputPort.setPlayerOrder(playerIds, options);
    }
    function randomizePlayerTurnOrderFromHost() {
      return context.turnInputPort.randomizePlayerOrder();
    }
    function beginNextRoundFromHost() {
      return context.turnInputPort.beginNextRound();
    }
    function getDisplayedTurnNumberFromReadout(rawTurnNumber = null) {
      const projection = readProjection();
      if (rawTurnNumber == null || Number(rawTurnNumber) === projection.turnNumber) {
        return projection.displayedTurnNumber;
      }
      const activeCount = Math.max(1, projection.activePlayerIds.length);
      return Math.floor((Math.max(1, Number(rawTurnNumber) || 1) - 1) / activeCount) + 1;
    }
    function getActionCycleNumberFromReadout() {
      return readProjection().actionCycleNumber;
    }
    function advanceTurnAfterPlayerActionFromHost(playerId, options = {}) {
      if (options.workingRoot) {
        const operationOptions = { ...options };
        delete operationOptions.workingRoot;
        return controller().advanceTurnAfterPlayerAction(options.workingRoot, playerId, operationOptions);
      }
      return context.turnInputPort.advanceAfterAction(playerId, { ...options });
    }
    function startNewGameFromHost(options = {}) {
      const activePlayerCount = Math.min(
        Math.max(1, Math.round(Number(options.activePlayerCount) || context.defaultActivePlayerCount)),
        context.playerColorIds.length,
      );
      const resetResult = context.newGame({
        activePlayerCount,
        defaultInitialPlayerColor: context.defaultInitialPlayerColor,
        finalScoreIds: context.finalScoreIds,
        seed: options.seed,
        rngState: options.rngState,
      });
      if (!resetResult.ok) return resetResult;
      const startResult = context.turnInputPort.startNewGame({
        ...options,
        activePlayerCount,
        compositionStatePrepared: true,
      });
      if (!startResult?.ok) return startResult;
      return context.setupInputPort.startInitialSelection();
    }
    return Object.freeze({
      getActiveOrderedPlayerIds: getActiveOrderedPlayerIdsFromReadout,
      getRoundOrderPlayerIds: getRoundOrderPlayerIdsFromReadout,
      setTurnStatePlayerOrder: setTurnStatePlayerOrderFromHost,
      randomizePlayerTurnOrder: randomizePlayerTurnOrderFromHost,
      beginNextRound: beginNextRoundFromHost,
      getDisplayedTurnNumber: getDisplayedTurnNumberFromReadout,
      getActionCycleNumber: getActionCycleNumberFromReadout,
      advanceTurnAfterPlayerAction: advanceTurnAfterPlayerActionFromHost,
      startNewGame: startNewGameFromHost,
      randomizeAll: () => context.turnInputPort.randomizeAll(),
      normalizeAiDifficulty: context.normalizeAiDifficulty,
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
      return productionTurnFlow.beginNextRound(workingRoot);
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
      const transition = productionTurnFlow.advanceTurnAfterPlayerAction(workingRoot, playerId, {
        ...options,
        finalRoundNumber,
      });
      if (transition.gameEnded && typeof computePlayerFinalScoreBreakdown === "function") {
        transition.finalScoreLines = (workingRoot.playerState.players || [])
          .filter((player) => (workingRoot.turnState.activePlayerIds || []).includes(player.id))
          .map((player) => {
            const breakdown = computePlayerFinalScoreBreakdown(workingRoot, player);
            return `${player.colorLabel || player.name || player.id}：${breakdown.totalScore} 分`;
          });
      }
      return transition;
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
          alienPoolIds: startScreenState.selectedAlienIds,
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
        seedDefaultReferenceRockets?.(workingRoot);
        randomizeAll(workingRoot);
        initializeCardGame?.(workingRoot, defaultInitialHandCount);
        configureDefaultAiOpponent?.({ aiDifficulty });
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
    createTurnOwnerInputPort,
    createTurnReadoutOwnerInputPort,
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
    BROWSER_TURN_FLOW_STATIC_KEYS,
    createBrowserTurnFlowStaticContext,
    createBrowserTurnFlowController,
    createTurnReadoutRuntime,
    createTurnHostRuntime,
  };
});

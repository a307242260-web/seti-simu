(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.SetiAppAiBrowserBootstrap = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "aiControlRuntimeModule",
    "aiControllerModule",
    "ruleComposition",
    "policyInputAdapterModule",
    "projectionAdapter",
    "inputAdapter",
    "createPolicy",
    "getRuleReadout",
    "isActionEffectFlowActive",
    "stateOwners",
    "controllerContext",
    "controllerPorts",
    "lazyControllerPorts",
  ]);
  const HAND_CONTROLLER_METHODS = Object.freeze([
    "beginPlayCardSelection",
    "confirmCardCornerQuickAction",
    "confirmHandCardPlayAction",
    "confirmPlayCardSelection",
    "finalizePendingDiscardSelection",
    "getPendingPlayCardSelection",
    "handleHandCardCornerQuickAction",
    "handleHandScanCardClick",
    "handlePlayCardSelect",
    "isHandScanSelectionActive",
    "isMovePaymentSelectionActive",
    "isPlayCardSelectionActive",
  ]);
  const SCAN_CONTROLLER_METHODS = Object.freeze([
    "buildSectorScanChoicesForX",
    "closeScanTargetPicker",
    "confirmPublicScanSelection",
    "confirmScanTarget",
    "getPublicScanChoicesForCard",
    "handlePublicScanCardClick",
  ]);
  const ALIEN_SPECIES_CONTROLLER_METHODS = Object.freeze([
    "handleAmibaCardGainChoice",
    "handleAmibaSymbolChoice",
    "handleAmibaTraceRemovalChoice",
    "handleAomomoCardGainChoice",
    "handleBanrenmaBonusChoice",
    "handleBanrenmaCardConditionChoice",
    "handleBanrenmaCardGainChoice",
    "handleChongCardGainChoice",
    "handleChongFossilChoice",
    "handleJiuzheCardChoice",
    "handleJiuzheOpportunitySkip",
    "handleRunezuCardGainChoice",
    "handleRunezuFaceSymbolChoice",
    "handleRunezuSymbolBranchChoice",
    "handleYichangdianCardGainChoice",
    "openBanrenmaReadyOpportunityForPlayer",
    "openRunezuFaceSymbolPlacement",
  ]);
  const CONTROLLER_STATIC_DEPENDENCY_KEYS = Object.freeze([
    "solar",
    "players",
    "rocketActions",
    "planetStats",
    "planetRewards",
    "finalScoring",
    "endGameScoring",
    "industry",
    "abilities",
    "actions",
    "scanEffects",
    "quickTrades",
    "cards",
    "initialCards",
    "cardEffects",
    "cardTaskStateModule",
    "tech",
    "data",
    "aliens",
    "aomomo",
    "jiuzhe",
    "yichangdian",
    "fangzhou",
    "banrenma",
    "chong",
    "amiba",
    "runezu",
    "aiRaceModel",
    "ai",
    "aiControlRuntimeModule",
  ]);
  const CONTROLLER_STATIC_CONSTANT_KEYS = Object.freeze([
    "DEFAULT_ACTIVE_PLAYER_COUNT",
    "DEFAULT_INITIAL_HAND_COUNT",
    "DEFAULT_INITIAL_PLAYER_COLOR",
    "FINAL_ROUND_NUMBER",
    "FINAL_SCORE_IDS",
    "INITIAL_SELECTION_REQUIRED",
    "MOVE_ENERGY_COST",
  ]);

  function selectRequired(source, keys, label) {
    const missing = keys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(source, key) || source[key] == null,
    );
    if (missing.length) {
      throw new Error(`${label} 缺少依赖：${missing.join(", ")}`);
    }
    return Object.fromEntries(keys.map((key) => [key, source[key]]));
  }

  function createBrowserAiStaticContext(dependencies = {}, constants = {}) {
    return Object.freeze({
      ...selectRequired(
        dependencies,
        CONTROLLER_STATIC_DEPENDENCY_KEYS,
        "Browser AI 静态模块",
      ),
      ...selectRequired(
        constants,
        CONTROLLER_STATIC_CONSTANT_KEYS,
        "Browser AI 静态常量",
      ),
    });
  }

  function createBrowserAiRuntimePorts(options = {}) {
    const {
      getAlienSpeciesRuntime,
      getCardRuntime,
      getCardTriggerRuntime,
      getIndustryRuntime,
      getTechRuntime,
      scanRuntime,
      createActionContext,
      dispatchRuntimeAction,
      getRequiredMovePointsForUi,
    } = options;
    const lazy = (label, getter, method) => (...args) => {
      if (typeof getter !== "function") {
        throw new TypeError(`Browser AI runtime port 缺少 owner getter：${label}`);
      }
      const fn = getter()?.[method];
      if (typeof fn !== "function") {
        throw new Error(`Browser AI runtime port ${label} 缺少方法：${method}`);
      }
      return fn(...args);
    };
    const card = (method) => lazy("card", getCardRuntime, method);
    const cardTrigger = (method) => lazy("cardTrigger", getCardTriggerRuntime, method);
    const tech = (method) => lazy("tech", getTechRuntime, method);
    const industry = (method) => lazy("industry", getIndustryRuntime, method);
    const alien = (method) => lazy("alienSpecies", getAlienSpeciesRuntime, method);
    if (typeof createActionContext !== "function"
      || typeof dispatchRuntimeAction !== "function"
      || typeof getRequiredMovePointsForUi !== "function") {
      throw new TypeError("Browser AI runtime port 缺少 action context/dispatch/move points adapter");
    }
    return Object.freeze({
      createActionContext,
      dispatchRuntimeAction,
      canBlindDraw: card("canBlindDraw"),
      cancelCardTriggerChoice: cardTrigger("cancelCardTriggerChoice"),
      confirmCardTaskCompletion: cardTrigger("confirmCardTaskCompletion"),
      confirmPassReserveSelection: card("confirmPassReserveSelection"),
      confirmTechBlueSlotChoice: tech("confirmTechBlueSlotChoice"),
      drawCardForCurrentPlayer: card("drawCardForCurrentPlayer"),
      executeCardMoveForEffect: card("requestCardEffectMove"),
      executeFreeMoveForCardCorner: card("executeFreeMoveForCardCorner"),
      executeFreeMoveForCardTrigger: cardTrigger("executeFreeMoveForCardTrigger"),
      executeFreeMoveForScanAction4: scanRuntime?.executeFreeMoveForScanAction4,
      executeIndustryFreeMove: industry("executeIndustryFreeMove"),
      getRequiredMovePointsForUi,
      getPassReserveSelectionCards: card("getPassReserveSelectionCards"),
      getReadyCardTasks: cardTrigger("getReadyCardTasks"),
      handleCardTriggerChoice: cardTrigger("handleCardTriggerChoice"),
      handlePublicCardClick: card("handlePublicCardClick"),
      openBanrenmaReadyOpportunityForPlayer: alien("openBanrenmaReadyOpportunityForPlayer"),
      openCardTaskCompletionPicker: cardTrigger("openCardTaskCompletionPicker"),
      openRunezuFaceSymbolPlacement: alien("openRunezuFaceSymbolPlacement"),
      pickPublicCardForCurrentPlayer: card("pickPublicCardForCurrentPlayer"),
      selectPassReserveCard: card("selectPassReserveCard"),
    });
  }

  function createBrowserAiControllerContext(options = {}) {
    const {
      staticContext,
      getCardRuntime,
      getCardTriggerRuntime,
      getIndustryRuntime,
      getProbeDecisionPort,
      getTechRuntime,
      actionSessionRuntime,
      browserContextRuntime,
      cardSelectionState,
      coordinateRuntime,
      effectChoicePort,
      effectExecutorPort,
      effectFlowRuntime,
      playerEffectOwnerRuntime,
      playerLookupRuntime,
      scanDecisionPort,
      turnHostRuntime,
      turnReadoutRuntime,
      hostPort = {},
    } = options;
    const lazy = (label, getter, method) => (...args) => {
      if (typeof getter !== "function") {
        throw new TypeError(`Browser AI controller context 缺少 owner getter：${label}`);
      }
      const fn = getter()?.[method];
      if (typeof fn !== "function") {
        throw new Error(`Browser AI controller context ${label} 缺少方法：${method}`);
      }
      return fn(...args);
    };
    const card = (method) => lazy("card", getCardRuntime, method);
    const cardTrigger = (method) => lazy("cardTrigger", getCardTriggerRuntime, method);
    const industry = (method) => lazy("industry", getIndustryRuntime, method);
    const tech = (method) => lazy("tech", getTechRuntime, method);
    const probe = (method) => lazy("probeDecision", getProbeDecisionPort, method);
    return Object.freeze({
      ...staticContext,
      ...hostPort,
      activateNextActionEffect: effectFlowRuntime?.activateNextActionEffect,
      allowsBlindDrawInSelection: cardSelectionState?.allowsBlindDrawInSelection,
      canStartMainAction: actionSessionRuntime?.canStartMainAction,
      confirmDiscardAnyForIncome: effectChoicePort?.confirmDiscardAnyForIncome,
      confirmProbeSectorScanSelection: probe("confirmSectorSelection"),
      endCurrentTurn: hostPort.endCurrentTurn,
      executeActionEffect: effectFlowRuntime?.executeActionEffect,
      getActivePlayers: browserContextRuntime?.getActivePlayers,
      getCurrentActionEffect: effectFlowRuntime?.getCurrentActionEffect,
      getCurrentPlayer: playerLookupRuntime?.getCurrentPlayer,
      getEarthSectorCoordinate: coordinateRuntime?.getEarthSectorCoordinate,
      getEffectOwnerPlayer: playerEffectOwnerRuntime?.getEffectOwnerPlayer,
      getMovableTokensForPlayer: coordinateRuntime?.getMovableTokensForPlayer,
      getPlanetSectorCoordinate: hostPort.getPlanetSectorCoordinate,
      getPlayerByColor: playerLookupRuntime?.getPlayerByColor,
      getPlayerById: playerLookupRuntime?.getPlayerById,
      getPlayerLabelById: browserContextRuntime?.getPlayerLabelById,
      handleConditionalSectorChoice: effectChoicePort?.handleConditionalSectorChoice,
      handleDiscardCornerRepeatChoice: effectChoicePort?.handleDiscardCornerRepeatChoice,
      handleDiscardIncomeCardChoice: effectChoicePort?.handleDiscardIncomeCardChoice,
      handleHandCornerChoice: effectExecutorPort?.handleHandCornerChoice,
      handleOptionalHandScanChoice: effectExecutorPort?.handleOptionalHandScanChoice,
      handlePayCreditChoice: effectChoicePort?.handlePayCreditChoice,
      handleFundamentalismExchangeChoice: effectChoicePort?.handleFundamentalismExchangeChoice,
      handleProbeLocationRewardChoice: probe("handleLocationRewardChoice"),
      handleProbeSectorScanChoice: probe("handleSectorChoice"),
      handleRemoveOrbitToProbeChoice: effectChoicePort?.handleRemoveOrbitToProbeChoice,
      handleRemovePlanetMarkerChoice: effectExecutorPort?.handleRemovePlanetMarkerChoice,
      handleReturnUnfinishedTaskChoice: effectExecutorPort?.handleReturnUnfinishedTaskChoice,
      handleScanAction4Choice: effectExecutorPort?.handleScanAction4Choice,
      handleYichangdianCornerChoice: effectExecutorPort?.handleYichangdianCornerChoice,
      hasActivePendingSubFlow: hostPort.hasActivePendingSubFlow,
      isActionEffectFlowActive: effectFlowRuntime?.isActionEffectFlowActive,
      isCardSelectionActive: cardSelectionState?.isCardSelectionActive,
      isDiscardSelectionActive: cardSelectionState?.isDiscardSelectionActive,
      isGameEnded: turnReadoutRuntime?.isGameEnded,
      isPublicScanMultiSelectActive: cardSelectionState?.isPublicScanMultiSelectActive,
      setTurnStatePlayerOrder: turnHostRuntime?.setTurnStatePlayerOrder,
    });
  }

  function createLazyPortBindings(getPort, methods = [], label = "Browser AI domain port") {
    if (typeof getPort !== "function") {
      throw new TypeError(`${label} requires getPort function`);
    }
    return Object.freeze(Object.fromEntries(methods.map((method) => [
      method,
      (...args) => {
        const port = getPort();
        if (typeof port?.[method] !== "function") {
          throw new Error(`${label} 未装配方法：${method}`);
        }
        return port[method](...args);
      },
    ])));
  }

  function selectControllerPort(port, methods = [], label = "Browser AI controller port") {
    const missing = methods.filter((method) => typeof port?.[method] !== "function");
    if (missing.length) {
      throw new Error(`${label} 缺少方法：${missing.join(", ")}`);
    }
    return Object.freeze(Object.fromEntries(methods.map((method) => [method, port[method]])));
  }

  function fail(code, message, details = {}) {
    return Object.freeze({ ok: false, code, message, ...structuredClone(details) });
  }

  function createCompositionPolicyBoundaryReader(options = {}) {
    const composition = options.ruleComposition;
    if (!composition?.inspect || !composition?.stateSourcePort?.read
      || !composition?.inputPort?.enumerateActions) {
      throw new TypeError("Browser Machine Player boundary reader 需要 Rule Composition inspect/state/input ports");
    }
    return function readBoundary(seatId) {
      const inspection = composition.inspect();
      const source = composition.stateSourcePort.read({
        viewerId: `machine:${seatId}`,
        playerId: seatId,
        role: "player",
      });
      const decision = source.decision || inspection.session?.decision || null;
      if (inspection.phase === "awaiting_input" && decision) {
        const legalActions = (decision.choices || [])
          .map((choice) => choice?.standardAction || choice?.action || choice)
          .filter(Boolean);
        return {
          kind: "decision",
          actorId: decision.ownerId,
          stateVersion: legalActions[0]?.stateVersion ?? source.source.stateVersion,
          decisionVersion: decision.decisionVersion,
          decisionId: decision.decisionId,
          legalActions,
        };
      }
      const actorId = source.state?.turn?.currentPlayerId
        ?? source.state?.players?.currentPlayerId
        ?? null;
      if (source.state?.turn?.gameEnded || source.state?.match?.terminal) {
        return { kind: "terminal", terminal: { phase: "completed" } };
      }
      return {
        kind: "action",
        actorId,
        stateVersion: source.source.stateVersion,
        decisionVersion: Math.max(0, Number(source.state?.match?.decisionVersion) || 0),
        legalActions: composition.inputPort.enumerateActions({ actorId }),
      };
    };
  }

  function createBrowserMachinePlayerPort(options = {}) {
    const {
      ruleComposition,
      policyInputAdapterModule,
      projectionAdapter,
      inputAdapter,
      createPolicy,
      isMachineSeat,
    } = options;
    if (!policyInputAdapterModule?.createPolicyInputAdapter
      || !projectionAdapter?.projectSource
      || !inputAdapter?.dispatchAction
      || !inputAdapter?.submitDecision
      || typeof createPolicy !== "function"
      || typeof isMachineSeat !== "function") {
      throw new TypeError("Browser Machine Player port 缺少 policy/projection/input/seat ports");
    }
    const readBoundary = createCompositionPolicyBoundaryReader({ ruleComposition });
    const drivers = new Map();
    let generation = 0;
    let lastResult = null;

    function currentSeatId() {
      const inspection = ruleComposition.inspect();
      const source = ruleComposition.stateSourcePort.read();
      return source.decision?.ownerId
        ?? inspection.session?.decision?.ownerId
        ?? source.state?.turn?.currentPlayerId
        ?? source.state?.players?.currentPlayerId
        ?? null;
    }

    function getDriver(seatId) {
      if (!drivers.has(seatId)) {
        drivers.set(seatId, policyInputAdapterModule.createPolicyInputAdapter({
          policy: createPolicy(seatId),
          readBoundary: () => readBoundary(seatId),
          readObservation: () => projectionAdapter.projectSource({
            viewer: { viewerId: `machine:${seatId}`, playerId: seatId, role: "player" },
          }),
          inputAdapter,
          onPause: options.onPause,
          onDiagnostic: options.onDiagnostic,
          defaultDeadlineMs: options.defaultDeadlineMs,
        }));
      }
      return drivers.get(seatId);
    }

    async function runOnce(runOptions = {}) {
      const seatId = currentSeatId();
      if (!seatId) {
        lastResult = fail("BROWSER_MACHINE_SEAT_MISSING", "当前 Rule Composition boundary 没有决策 owner");
        return lastResult;
      }
      if (!isMachineSeat(seatId)) {
        lastResult = fail("BROWSER_MACHINE_SEAT_NOT_CONTROLLED", `席位 ${seatId} 不是机器席位`, { seatId });
        return lastResult;
      }
      const ownGeneration = generation;
      const result = await getDriver(seatId).runOnce(runOptions);
      lastResult = ownGeneration === generation
        ? result
        : fail("MACHINE_POLICY_REQUEST_INVALIDATED", "Browser Machine Player generation 已变化", { seatId });
      return lastResult;
    }

    function invalidate(reason = "Browser Rule Composition lifecycle 已变化") {
      generation += 1;
      for (const driver of drivers.values()) driver.invalidate(reason);
      drivers.clear();
      lastResult = null;
      return Object.freeze({ ok: true, generation });
    }

    function inspect() {
      return Object.freeze({
        generation,
        seatId: currentSeatId(),
        drivers: Object.freeze([...drivers.entries()].map(([seatId, driver]) => ({
          seatId,
          host: driver.inspect(),
        }))),
        lastResult: structuredClone(lastResult),
      });
    }

    return Object.freeze({ runOnce, invalidate, inspect });
  }

  function createBrowserAiBootstrap(context = {}) {
    const missingKeys = REQUIRED_CONTEXT_KEYS.filter(
      (key) => !Object.prototype.hasOwnProperty.call(context, key) || context[key] == null,
    );
    if (missingKeys.length) {
      throw new Error(`Browser AI bootstrap 缺少依赖：${missingKeys.join(", ")}`);
    }

    const {
      aiControlRuntimeModule,
      aiControllerModule,
      ruleComposition,
      policyInputAdapterModule,
      projectionAdapter,
      inputAdapter,
      createPolicy,
      getRuleReadout,
      isActionEffectFlowActive,
      stateOwners,
      controllerContext,
      controllerPorts,
      lazyControllerPorts,
    } = context;
    const directControllerContext = Object.assign(
      {},
      ...controllerPorts.map(({ port, methods, label }) => (
        selectControllerPort(port, methods, label)
      )),
    );
    const lazyControllerContext = Object.assign(
      {},
      ...lazyControllerPorts.map(({ getPort, methods, label }) => (
        createLazyPortBindings(getPort, methods, label)
      )),
    );
    const state = aiControlRuntimeModule.createAiControllerState(stateOwners);
    let controller = null;
    const machinePlayerPort = createBrowserMachinePlayerPort({
      ruleComposition,
      policyInputAdapterModule,
      projectionAdapter,
      inputAdapter,
      createPolicy,
      isMachineSeat: (seatId) => Boolean(controller?.isAiAutoBattlePlayer?.(seatId)),
    });
    const submitHostCommand = (command, options) => (
      ruleComposition.inputPort.submitHostCommand(command, options)
    );
    controller = aiControllerModule.createAiController({
      ...controllerContext,
      ...directControllerContext,
      ...lazyControllerContext,
      state,
      setPlayerAiDifficulty: (playerId, difficulty, label) => submitHostCommand({
        kind: "ai_set_player_difficulty",
        playerId,
        difficulty,
        label,
      }),
      runMachinePlayerStepThroughComposition: (options) => machinePlayerPort.runOnce(options),
      getRuleProjection: () => {
        const ruleState = ruleComposition.stateSourcePort.read().state;
        return {
          players: structuredClone(ruleState.players),
          turn: structuredClone(ruleState.turn),
        };
      },
      getRuleReadout,
    });
    const compositionPort = Object.freeze({
      runAutomationStep: (options = {}) => machinePlayerPort.runOnce(options),
    });
    ruleComposition.subscribe((event) => {
      if (event?.source === "lifecycle") {
        machinePlayerPort.invalidate(`Rule Composition lifecycle: ${event.event?.type || "unknown"}`);
      }
    });

    return Object.freeze({ controller, compositionPort, machinePlayerPort });
  }

  return {
    REQUIRED_CONTEXT_KEYS,
    CONTROLLER_STATIC_DEPENDENCY_KEYS,
    CONTROLLER_STATIC_CONSTANT_KEYS,
    HAND_CONTROLLER_METHODS,
    SCAN_CONTROLLER_METHODS,
    ALIEN_SPECIES_CONTROLLER_METHODS,
    createBrowserAiStaticContext,
    createBrowserAiControllerContext,
    createBrowserAiRuntimePorts,
    createLazyPortBindings,
    selectControllerPort,
    createCompositionPolicyBoundaryReader,
    createBrowserMachinePlayerPort,
    createBrowserAiBootstrap,
  };
});

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
      getRuleReadout,
      isActionEffectFlowActive,
      heuristicPolicy,
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
    const runCompositionStep = aiControlRuntimeModule.createAiCompositionStepPort({
      inspect: (...args) => ruleComposition.inspect(...args),
      getRuleReadout,
      isActionEffectFlowActive,
      beginDrain: (...args) => ruleComposition.inputPort.beginDrain(...args),
      readState: (...args) => ruleComposition.stateSourcePort.read(...args),
      heuristicPolicy,
      submitDecision: (...args) => ruleComposition.inputPort.submitDecision(...args),
      submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
    }).run;
    const submitHostCommand = (command, options) => (
      ruleComposition.inputPort.submitHostCommand(command, options)
    );
    const controller = aiControllerModule.createAiController({
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
      runAiAutomationStepThroughComposition: (...args) => (
        runCompositionStep("ai_run_automation_step", args)
      ),
      recoverAiIdleActionEffectThroughComposition: (...args) => (
        runCompositionStep("ai_recover_idle_action_effect", args)
      ),
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
      buildTurnActionCandidates: (...args) => submitHostCommand({
        kind: "ai_build_turn_candidates",
        args,
      }),
      listCardTriggerFreeMoveCandidates: (...args) => (
        submitHostCommand({
          kind: "card_trigger_list_free_move_candidates",
          args,
        }, { commit: false }).value || []
      ),
      resolveToTurnBoundary: (options = {}) => submitHostCommand({
        kind: "ai_resolve_to_turn_boundary",
        options,
      }),
      runAutomationStep: () => submitHostCommand({ kind: "ai_run_automation_step" }),
      runActionEffectStep: () => submitHostCommand({ kind: "ai_run_action_effect_step" }),
      runNonTurnStep: () => submitHostCommand({ kind: "ai_run_non_turn_step" }),
      runSelectedTurnAction: (selector = {}, options = {}) => submitHostCommand({
        kind: "ai_run_selected_turn_action",
        selector,
        options,
      }),
    });

    return Object.freeze({ controller, compositionPort });
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
    createBrowserAiBootstrap,
  };
});

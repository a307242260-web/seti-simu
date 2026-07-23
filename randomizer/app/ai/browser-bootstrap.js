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
    createLazyPortBindings,
    selectControllerPort,
    createBrowserAiBootstrap,
  };
});

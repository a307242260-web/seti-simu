(function () {
  "use strict";

  const dependencies = window.SetiAppDependencies.collectDependencies(window);
  const {
    solar,
    players,
    rocketActions,
    planetStats,
    planetReferenceLayout,
    actionShared,
    actions,
    scanEffects,
    planetRewards,
    finalScoring,
    endGameScoring,
    actionHistoryModule,
    historyCommands,
    historyTransactions,
    abilities,
    quickTrades,
    basicCards,
    cards,
    cardEffects,
    cardTaskStateModule,
    tech,
    data,
    aliens,
    jiuzhe,
    yichangdian,
    fangzhou,
    banrenma,
    chong,
    amiba,
    aomomo,
    runezu,
    initialCards,
    industry,
    aiValuation,
    aiRaceModel,
    ai,
    alienTraceRewardFlow,
    actionRuntimeModule,
    primaryBoardActionExecutorModule,
    engineActionExecutorModule,
    quickTurnActionExecutorModule,
    conditionalDecisionDomainModule,
    conditionalActionExecutorModule,
    actionInteractionRuntimeModule,
    actionLogRuntimeModule,
    gameRecoveryModule,
    browserRuleCompositionModule,
    runtimeModule,
    refreshModule,
    renderRuntimeModule,
    viewAdapterModule,
    debugRuntimeModule,
    finalUiRuntimeModule,
    finalScoreAiRuntimeModule,
    aiControlRuntimeModule,
    actionBriefingModule,
    effectFlowModule,
    effectChoiceFlowModule,
    effectMovementScanExecutorsModule,
    effectRewardExecutorsModule,
    effectAlienExecutorsModule,
    effectDispatcherModule,
    handFlowModule,
    startScreenModule,
    turnFlowModule,
    turnEndFlowModule,
    scanFlowModule,
    incomeRuntimeModule,
    cardRuntimeModule,
    cardTriggerRuntimeModule,
    alienRuntimeModule,
    alienUiModule,
    browserHostModule,
  } = dependencies;
  const stateStoreModule = window.SetiStateStore;
  const hostStateSourceModule = window.SetiHostStateSource;
  const highCouplingStateModule = window.SetiHighCouplingState;
  if (!stateStoreModule || !hostStateSourceModule || !highCouplingStateModule || !browserRuleCompositionModule) {
    throw new Error("Missing SETI StateStore runtime dependencies");
  }
  const headlessMode = Boolean(window.SetiHeadlessRuntimeConfig?.enabled);
  const viewAdapter = headlessMode ? viewAdapterModule.createNoopViewAdapter() : null;
  const document = headlessMode ? null : window.document;
  const Image = headlessMode ? null : window.Image;
  const Blob = window.Blob;
  const requestAnimationFrame = viewAdapter?.scheduleFrame || window.requestAnimationFrame.bind(window);
  const getComputedStyle = viewAdapter?.getComputedStyle || window.getComputedStyle.bind(window);

  const alienSpeciesRuntimeModule = window.SetiAppAlienSpeciesRuntime;
  const techRuntimeModule = window.SetiAppTechRuntime;
  const industryRuntimeModule = window.SetiAppIndustryRuntime;
  const actionLogExport = window.SetiAppActionLogExport;
  if (!actionLogExport) {
    throw new Error("Missing SETI app dependency: SetiAppActionLogExport");
  }
  if (!startScreenModule) {
    throw new Error("Missing SETI app dependency: SetiAppStartScreen");
  }
  if (!turnFlowModule) {
    throw new Error("Missing SETI app dependency: SetiAppTurnFlow");
  }
  if (!aiControlRuntimeModule) {
    throw new Error("Missing SETI app dependency: SetiAppAiControlRuntime");
  }
  if (!actionRuntimeModule) {
    throw new Error("Missing SETI app dependency: SetiAppActionRuntime");
  }
  if (!effectFlowModule) {
    throw new Error("Missing SETI app dependency: SetiAppEffectFlow");
  }
  if (!effectChoiceFlowModule) {
    throw new Error("Missing SETI app dependency: SetiAppEffectChoiceFlow");
  }

  if (!alienSpeciesRuntimeModule) {
    throw new Error("Missing SETI app dependency: SetiAppAlienSpeciesRuntime");
  }
  if (!techRuntimeModule) {
    throw new Error("Missing SETI app dependency: SetiAppTechRuntime");
  }
  if (!industryRuntimeModule) {
    throw new Error("Missing SETI app dependency: SetiAppIndustryRuntime");
  }

  const appConstants = window.SetiAppConstants.createAppConstants(dependencies);
  const {
    WHEEL_OFFSETS,
    BOARD_VISUAL_SCALE,
    FINAL_SCORE_IDS,
    FINAL_SCORE_SLOT_POINTS,
    ROCKET_IMAGE_SCALE,
    REFERENCE_ORBIT_IMAGE_SCALE,
    REFERENCE_LANDDING_IMAGE_SCALE,
    RESOURCE_ICON_SRC,
    OPPONENT_SECTOR_WIN_STATS,
    OPPONENT_TECH_TYPES,
    TECH_EFFECT_ICONS,
    CARD_EFFECT_ICONS,
    INCOME_GAIN_LABELS,
    ACTION_LOG_DELTA_UNITS,
    ACTION_LOG_RESOURCE_KEYS,
    ACTION_LOG_INCOME_KEYS,
    ACTION_LOG_SOURCE_LABELS,
    ACTION_LOG_DEFAULT_LABELS,
    GAME_RECOVERY_VERSION,
    PUBLIC_SCAN_MAX_BONUS_CARDS,
    DEBUG_QUICK_SECTOR_SCAN_EXTRA_LIMIT,
    PUBLIC_SCAN_TARGETS_BY_CODE,
    PUBLIC_SCAN_CODE_LABELS,
    SECTOR_FINISH_ICON_BY_COLOR,
    SECTOR_WIN_REWARDS,
    ROCKET_SURFACE,
    PLANETS_REFERENCE_SIZE,
    REFERENCE_PLACEMENT_KIND_LABELS,
    ROTATE_STATE_SLOTS,
    DEFAULT_ACTIVE_PLAYER_COUNT,
    DEFAULT_INITIAL_PLAYER_COLOR,
    DEFAULT_INITIAL_HAND_COUNT,
    INDUSTRY_CARD_FILES,
    INITIAL_CARD_COUNT,
    INITIAL_SELECTION_REQUIRED,
    INITIAL_SELECTION_CARD_SIZE,
    PASS_HAND_LIMIT,
    FINAL_ROUND_NUMBER,
    PASS_RESERVE_ROUNDS,
  } = appConstants;
  const BANRENMA_PANEL_BONUS_EFFECT_TYPE = "banrenma_panel_bonus";
  const JIUZHE_THRESHOLD_CARD_EFFECT_TYPE = "jiuzhe_threshold_card";
  const FUNDAMENTALISM_ROUND_START_ROUNDS = Object.freeze([2, 3, 4]);
  const AI_DIFFICULTY_LAUGHABLE = "laughable";
  const AI_DIFFICULTY_WEAK_START = "weak_start";
  let finalScoreAiRuntime = null;
  let turnEndFlow = null;
  let actionInteractionRuntime = null;
  function runAiFinalScoreMarkDecision(...args) {
    if (headlessMode) {
      throw new Error("headless 禁止调用 final-score AI resolver");
    }
    return finalScoreAiRuntime?.runAiFinalScoreMarkDecision(...args) || null;
  }
  function createPassEvent(...args) { return turnEndFlow?.createPassEvent(...args); }
  function executePassFirstRotateEffect(...args) { return callBrowserDomainCommand("turn_end", "executePassFirstRotateEffect", args); }
  function executePassHandLimitEffect(...args) { return callBrowserDomainCommand("turn_end", "executePassHandLimitEffect", args); }
  function passForCurrentPlayer(execution = {}) {
    if (execution.workingRoot) return turnEndFlow?.passForCurrentPlayer(execution.workingRoot, execution);
    return callBrowserDomainCommand("turn_end", "passForCurrentPlayer", [execution]);
  }
  function maybeResumeTurnEndAfterReveal(...args) { return callBrowserDomainCommand("turn_end", "maybeResumeTurnEndAfterReveal", args); }
  function maybeContinuePendingTurnEndRevealFlow(...args) {
    return callBrowserDomainCommand("turn_end", "maybeContinuePendingTurnEndRevealFlow", args);
  }
  function maybeContinueAlienRevealQueuedOpportunities(...args) {
    return callBrowserDomainCommand("turn_end", "maybeContinueAlienRevealQueuedOpportunities", args);
  }
  function endCurrentTurn(execution = {}) {
    if (execution.workingRoot) return turnEndFlow?.endCurrentTurn(execution.workingRoot, execution);
    return callBrowserDomainCommand("turn_end", "endCurrentTurn", [execution]);
  }
  function getPlutoReservedCards(...args) { return callBrowserDomainCommand("action_interaction", "getPlutoReservedCards", args) || []; }
  function ensurePlutoCardEffectState(...args) { return actionInteractionRuntime?.ensurePlutoCardEffectState(...args); }
  function getPlutoActionState(...args) { return actionInteractionRuntime?.getPlutoActionState(...args); }
  function addPlutoMarker(...args) { return actionInteractionRuntime?.addPlutoMarker(...args); }
  function removePlutoMarker(...args) { return callBrowserDomainCommand("action_interaction", "removePlutoMarker", args); }
  function collectPlutoMarkers(...args) { return callBrowserDomainCommand("action_interaction", "collectPlutoMarkers", args) || []; }
  function buildPlutoMarkerContext(...args) { return callBrowserDomainCommand("action_interaction", "buildPlutoMarkerContext", args) || { plutoMarkers: [] }; }
  function playerHasOwnPlutoLanding(...args) { return Boolean(callBrowserDomainCommand("action_interaction", "playerHasOwnPlutoLanding", args)); }
  function buildPlutoMarkerRemovalChoices(...args) { return callBrowserDomainCommand("action_interaction", "buildPlutoMarkerRemovalChoices", args) || []; }
  function getPlutoCandidateRockets(...args) { return callBrowserDomainCommand("action_interaction", "getPlutoCandidateRockets", args) || []; }
  function getPlutoActionCost(...args) { return callBrowserDomainCommand("action_interaction", "getPlutoActionCost", args) || {}; }
  function getAvailablePlutoAction(...args) { return callBrowserDomainCommand("action_interaction", "getAvailablePlutoAction", args) || { ok: false }; }
  function executePlutoAction(...args) { return callBrowserDomainCommand("action_interaction", "executePlutoAction", args); }
  function getCurrentPlanetActionPlacement(...args) { return callBrowserDomainCommand("action_interaction", "getCurrentPlanetActionPlacement", args) || { ok: false }; }
  function getPlutoChoiceActionLabel(...args) { return actionInteractionRuntime?.getPlutoChoiceActionLabel(...args); }
  function formatPlutoChoiceLabel(...args) { return actionInteractionRuntime?.formatPlutoChoiceLabel(...args); }
  function openPlutoActionChoicePicker(...args) { return callBrowserDomainCommand("action_interaction", "openPlutoActionChoicePicker", args); }
  function scheduleRenderMoveArrows(...args) { return callBrowserDomainCommand("action_interaction", "scheduleRenderMoveArrows", args); }
  function clearMoveRocketHighlight(...args) { return callBrowserDomainCommand("action_interaction", "clearMoveRocketHighlight", args); }
  function activateMoveMode(...args) { return callBrowserDomainCommand("action_interaction", "activateMoveMode", args) || false; }
  function deactivateMoveMode(...args) { return callBrowserDomainCommand("action_interaction", "deactivateMoveMode", args); }
  function closeDataPlacePicker(...args) { return actionInteractionRuntime?.closeDataPlacePicker(...args); }
  function isDataPoolFull(...args) { return Boolean(actionInteractionRuntime?.isDataPoolFull(...args)); }
  function getAutoDataPlacementCheck(...args) { return actionInteractionRuntime?.getAutoDataPlacementCheck(...args) || { ok: false }; }
  function openDataPlacePicker(...args) { return callBrowserDomainCommand("action_interaction", "openDataPlacePicker", args); }
  function openAutoDataPlacementPrompt(...args) { return callBrowserDomainCommand("action_interaction", "openAutoDataPlacementPrompt", args); }
  function continuePendingDataPlacementAfterBonus(...args) {
    return actionInteractionRuntime?.continuePendingDataPlacementAfterBonus(...args);
  }
  function skipPendingDataPlacement(...args) { return actionInteractionRuntime?.skipPendingDataPlacement(...args); }
  function cancelDataPlacePicker(...args) { return callBrowserDomainCommand("action_interaction", "cancelDataPlacePicker", args); }
  function confirmDataPlacement(...args) {
    const execution = args[2] || {};
    if (execution.workingRoot) {
      return actionInteractionRuntime?.confirmDataPlacement(execution.workingRoot, args[0], args[1], execution);
    }
    return callBrowserDomainCommand("action_interaction", "confirmDataPlacement", [args[0], args[1], execution]);
  }
  const SCORE_SOURCE_KEYS = Object.freeze({
    INITIAL: "initialScore",
    SCAN: "scanScore",
    TECH_BONUS: "techBonusScore",
    BLUE_TECH: "blueTechScore",
    CARD_QUICK: "cardQuickScore",
    CARD_EFFECT: "cardEffectScore",
    TASK_CARD: "taskCardScore",
    ORBIT: "orbitScore",
    LAND: "landScore",
    ALIEN_TRACE_PINK: "alienTracePinkScore",
    ALIEN_TRACE_YELLOW: "alienTraceYellowScore",
    ALIEN_TRACE_BLUE: "alienTraceBlueScore",
    ALIEN_CARD_QUICK: "alienCardQuickScore",
    ALIEN_EFFECT: "alienEffectScore",
    INDUSTRY_EFFECT: "industryEffectScore",
  });
  const tokenWidths = {
    rocket: null,
    orbit: null,
    landding: null,
  };
  const sectorElements = {};
  const createTurnState = turnFlowModule.createTurnState;
  const initialGameStateModule = window.SetiInitialGameState;
  const effectSessionRuntimeModule = window.SetiEffectSession;
  const standardActionSessionModule = window.SetiStandardActionSession;
  const standardActionModule = window.SetiStandardAction;
  const browserRuleModules = {
    players,
    solar,
    rocketActions,
    planetStats,
    data,
    cards,
    tech,
    aliens,
    finalScoring,
    createTurnState,
  };
  const BROWSER_DOMAIN_COMMANDS = Object.freeze({
    scan_flow: new Set([
      "getPublicScanMaxSelectable", "buildReadySectorFinishEffects", "buildScanFinalizeFollowupEffects",
      "replaceNebulaDataForCurrentPlayer", "getSectorFinishWinnerTarget", "executeScanActionFinalizeEffect",
      "executeSectorFinishScanEffect", "replenishDelayedPublicRefillSlots", "executeScanPublicRefillEffect",
      "settleDelayedPublicRefillsAfterScanFlow", "buildEndOfFlowFollowupEffects",
      "shouldAppendQueuedSectorFinishEffects", "appendEndOfFlowSectorFinishEffects", "discardPublicScanCard",
      "discardHandScanCard", "finalizeScanSourceCard", "restoreYichangdianCornerPickerIfPending",
      "closeScanTargetPicker", "nebulaHasScannableData", "buildNebulaScanChoice", "isAomomoActive",
      "getAomomoPlanetLocation", "getAomomoCurrentX", "getNebulaCurrentX", "getSectorScanTargetLabel",
      "buildAomomoScanChoiceForX", "hasAomomoScanAtX", "buildSectorScanChoicesForX",
      "expandScanChoicesWithAomomoTargets", "confirmScanTarget", "handleDrawnHandScanSkip", "beginSectorScan",
      "getSectorOpenDataCount", "getSectorReplacedCount", "getSectorExtraMarkCount", "getPublicScanChoicesForCard",
      "hasHandScanTargetCard", "createPublicScanPendingAction", "beginPublicDeckScan", "beginPublicScanForSingleCard",
      "confirmPublicScanSelection", "handlePublicScanCardClick", "beginHandScan", "cancelHandScanSelection",
      "handleHandScanCardClick",
    ]),
    alien_ui: new Set([
      "buildAlienRevealNoticeEntry", "getAlienTracePickerPlayer", "canPlaceJiuzheTrace",
      "canPlaceYichangdianTrace", "canPlaceFangzhouTrace", "canPlaceBanrenmaTrace", "canPlaceChongTrace",
      "canPlaceAmibaTrace", "canPlaceAomomoTrace", "canPlaceRunezuTrace", "canPlaceRunezuFaceSymbol",
      "canPlaceStateTrace", "canPlaceAnyStateExtraTrace", "openAlienTracePicker", "beginAlienTraceBoardPlacement",
      "beginJiuzheTraceGridPlacement", "beginYichangdianTraceGridPlacement", "beginFangzhouTraceGridPlacement",
      "beginBanrenmaTraceGridPlacement", "beginAomomoTraceGridPlacement", "beginChongTraceGridPlacement",
      "beginAmibaTraceGridPlacement", "beginRunezuTraceGridPlacement", "renderAlienTracePickerColorStep",
      "openFangzhouTraceUseChoice", "openFangzhouTraceDestinationChoice", "handleFangzhouTraceDestinationChoice",
      "handleFangzhouUnlockTraceChoice", "routeFangzhouAlienTraceGain", "handleStateTraceSlotPlacement",
      "handleFangzhouTraceSlotPlacement", "getEligibleAlienSlotIdsForTraceEffect",
      "getFangzhouUnlockableTraceTypes", "hasAlienTracePanelPlacementTarget",
    ]),
    turn_end: new Set([
      "executePassFirstRotateEffect", "executePassHandLimitEffect", "passForCurrentPlayer",
      "maybeResumeTurnEndAfterReveal", "maybeContinuePendingTurnEndRevealFlow",
      "maybeContinueAlienRevealQueuedOpportunities", "endCurrentTurn",
    ]),
    action_interaction: new Set([
      "getPlutoReservedCards", "removePlutoMarker", "collectPlutoMarkers", "buildPlutoMarkerContext",
      "playerHasOwnPlutoLanding", "buildPlutoMarkerRemovalChoices", "getPlutoCandidateRockets",
      "getPlutoActionCost", "getAvailablePlutoAction", "executePlutoAction",
      "getCurrentPlanetActionPlacement", "openPlutoActionChoicePicker", "scheduleRenderMoveArrows",
      "clearMoveRocketHighlight", "activateMoveMode", "deactivateMoveMode", "openDataPlacePicker",
      "openAutoDataPlacementPrompt", "cancelDataPlacePicker", "confirmDataPlacement",
    ]),
    income_runtime: new Set([
      "applyIndustryRoundStartBonuses",
      "maybeStartFundamentalismRoundStartIncomeFlow",
      "beginIncomeForCurrentPlayer",
    ]),
  });

  function executeBrowserDomainCommand(workingRoot, command) {
    const target = resolveBrowserDomainTarget(command.domain);
    const allowed = BROWSER_DOMAIN_COMMANDS[command.domain];
    if ((allowed && !allowed.has(command.operation)) || (!allowed && !Object.hasOwn(target || {}, command.operation))) {
      return { ok: false, code: "BROWSER_DOMAIN_COMMAND_UNKNOWN", message: `未知 Browser domain command: ${command.domain}.${command.operation}` };
    }
    const method = target?.[command.operation];
    if (typeof method !== "function") {
      return { ok: false, code: "BROWSER_DOMAIN_COMMAND_UNAVAILABLE", message: `Browser domain command 未装配: ${command.domain}.${command.operation}` };
    }
    const value = method(workingRoot, ...(command.args || []));
    return { ok: value?.ok !== false, value: cloneResidentPresentation(value) };
  }

  function resolveBrowserDomainTarget(domain) {
    switch (domain) {
      case "scan_flow": return scanFlowHelpers;
      case "alien_ui": return alienUiHelpers;
      case "turn_end": return turnEndFlow;
      case "action_interaction": return actionInteractionRuntime;
      case "alien_runtime": return alienRuntimeHelpers;
      case "alien_species": return alienSpeciesRuntime;
      case "card_runtime": return cardRuntime;
      case "ai_controller": return aiController;
      case "card_trigger": return cardTriggerRuntime;
      case "industry_runtime": return industryRuntime;
      case "tech_runtime": return techRuntime;
      case "income_runtime": return incomeRuntime;
      default: return null;
    }
  }

  function callBrowserDomainCommand(domain, operation, args = []) {
    try {
      return browserRuleComposition.inputPort.submitHostCommand({
        kind: "domain_command",
        domain,
        operation,
        args,
      }).value;
    } catch (error) {
      throw new Error(`${domain}.${operation}: ${error?.message || error}`, { cause: error });
    }
  }

  function bindBrowserDomainCommand(domain, operation) {
    return (...args) => callBrowserDomainCommand(domain, operation, args);
  }

  function callEffectChoiceCommand(operation, args = []) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "effect_choice_command",
      operation,
      args,
    }).value;
  }

  function callHandFlowCommand(operation, args = []) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "hand_flow_command",
      operation,
      args,
    }).value;
  }

  function callEffectExecutorCommand(operation, args = []) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "effect_executor_command",
      operation,
      args,
    }).value;
  }

  function callDebugCommand(operation, args = []) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "debug_command",
      operation,
      args,
    }).value;
  }

  function setBrowserStatusNote(message) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "ui_set_status_note",
      message: String(message || ""),
    }).value;
  }
  let getBrowserCommittedContext = () => ({
    gameId: "seti-browser-runtime",
    rulesetVersion: "seti-runtime-v1",
    seed: "browser-host",
    headlessMode,
    rngState: { owner: headlessMode ? "headless" : "browser", state: null },
    sequences: {},
  });

  function createBrowserWorkingState(initialOptions = {}) {
    return initialGameStateModule.createSessionState(browserRuleModules, {
      defaultInitialPlayerColor: initialOptions.defaultInitialPlayerColor ?? players.DEFAULT_PLAYER_COLOR,
      activePlayerCount: initialOptions.activePlayerCount ?? DEFAULT_ACTIVE_PLAYER_COUNT,
      finalScoreIds: initialOptions.finalScoreIds ?? FINAL_SCORE_IDS,
    });
  }

  function validateBrowserSessionBoundary(state) {
    const forbiddenContinuation = [
      "turnEndRevealContinuation",
      "type1TriggerEvents",
      "jiuzheOpportunityQueue",
      "banrenmaOpportunityQueue",
    ]
      .find((field) => Object.hasOwn(state?.match || {}, field));
    if (forbiddenContinuation) {
      return {
        ok: false,
        path: `$.match.${forbiddenContinuation}`,
        code: "STATE_EFFECT_CONTINUATION_COMMITTED",
        message: `${forbiddenContinuation} 必须在 Composition Session 完成前清空`,
      };
    }
    return { ok: true };
  }

  function restoreBrowserWorkingState(target, source, metadata = {}) {
    if (source?.playerState && source?.turnState) {
      for (const key of Object.keys(source)) {
        if (key === "meta") target.meta = structuredClone(metadata.committedState?.meta || source.meta || {});
        else replaceBrowserMutableObject(target[key], source[key]);
      }
      return target;
    }
    initialGameStateModule.restoreSessionState(target, source, (resident, value) => {
      for (const key of Reflect.ownKeys(resident || {})) delete resident[key];
      Object.assign(resident, structuredClone(value || {}));
      return resident;
    });
    if (metadata.reason === "restore") {
      const sequences = source.meta?.sequences || {};
      if (Number.isSafeInteger(sequences.card)) cards.restoreNextCardInstanceSequence(sequences.card);
      if (Number.isSafeInteger(sequences.handCard)) players.restoreNextHandCardSequence(sequences.handCard);
      if (Number.isSafeInteger(sequences.finalMark)) finalScoring.restoreNextFinalMarkSequence(sequences.finalMark);
      if (Number.isSafeInteger(sequences.dataToken)) data.restoreNextDataTokenSequence(sequences.dataToken);
      if (Number.isSafeInteger(sequences.nebulaToken)) data.restoreDeterministicSequences(sequences);
      if (Number.isSafeInteger(sequences.historyStep)) actionHistoryModule.restoreNextHistoryStepSequence(sequences.historyStep);
    }
    return target;
  }

  function replaceBrowserMutableObject(target, source) {
    if (!target || typeof target !== "object") throw new TypeError("Browser working state restore target 必须是对象");
    const replacement = structuredClone(source || {});
    for (const key of Reflect.ownKeys(target)) delete target[key];
    Object.assign(target, replacement);
    return target;
  }

  const browserRuleComposition = browserRuleCompositionModule.createBrowserRuleComposition({
    invariantValidators: [validateBrowserSessionBoundary],
    stateStoreApi: {
      createStateStore(initialState, options) {
        return highCouplingStateModule.createHighCouplingStateStore(initialState, options);
      },
    },
    effectRuntimeApi: effectSessionRuntimeModule,
    createInitialState(_initialOptions, workingState) {
      return highCouplingStateModule.purifyHighCouplingSlices(
        initialGameStateModule.createCommittedCandidate(
          workingState,
          getBrowserCommittedContext(workingState),
          stateStoreModule.SCHEMA_VERSION,
          0,
        ),
      );
    },
    stateAdapter: {
      createWorkingState: createBrowserWorkingState,
      createProjectionState(workingState, committedState) {
        return initialGameStateModule.createCommittedCandidate(
          workingState,
          { ...getBrowserCommittedContext(workingState), stateVersion: committedState.meta.stateVersion },
          stateStoreModule.SCHEMA_VERSION,
          committedState.meta.stateVersion,
        );
      },
      createCommittedState(workingState, committedState, contextOverrides = {}) {
        return highCouplingStateModule.purifyHighCouplingSlices(
          initialGameStateModule.createCommittedCandidate(
            workingState,
            { ...getBrowserCommittedContext(workingState), ...contextOverrides },
            stateStoreModule.SCHEMA_VERSION,
            committedState.meta.stateVersion,
          ),
        );
      },
      createSavedState(committedState, workingState, contextOverrides = {}) {
        const savedState = structuredClone(committedState);
        savedState.meta = {
          ...savedState.meta,
          ...getBrowserCommittedContext(workingState),
          ...structuredClone(contextOverrides),
          schemaVersion: savedState.meta.schemaVersion,
          stateVersion: savedState.meta.stateVersion,
        };
        return savedState;
      },
      restoreWorkingState: restoreBrowserWorkingState,
      onCommitted(workingState, committedState) {
        workingState.meta = structuredClone(committedState.meta);
      },
    },
    runWithWorkingState(workingRoot, operation) {
      return players.runWithScoreGainListener(
        (player, payload) => handlePlayerScoreChanged(workingRoot, player, payload),
        operation,
      );
    },
    executeHostCommand(workingRoot, command) {
      switch (command.kind) {
        case "turn_set_player_order":
          turnFlowController.setTurnStatePlayerOrder(workingRoot, command.playerIds, command.options);
          return { ok: true };
        case "turn_randomize_player_order":
          turnFlowController.randomizePlayerTurnOrder(workingRoot);
          return { ok: true };
        case "turn_begin_next_round":
          return { ok: true, ...turnFlowController.beginNextRound(workingRoot) };
        case "turn_advance_after_action":
          return { ok: true, ...turnFlowController.advanceTurnAfterPlayerAction(
            workingRoot,
            command.playerId,
            command.options,
          ) };
        case "turn_start_new_game":
          return turnFlowController.startNewGame(workingRoot, command.options);
        case "turn_randomize_all":
          turnFlowController.randomizeAll(workingRoot);
          return { ok: true };
        case "setup_start_initial_selection":
          actionRuntimeController.startInitialSelection(workingRoot);
          return { ok: true };
        case "setup_select_initial_card":
          actionRuntimeController.handleInitialSelectionCardClick(
            workingRoot,
            command.selectionKind,
            command.cardId,
          );
          return { ok: true };
        case "setup_confirm_initial_selection":
          actionRuntimeController.confirmInitialSelectionForCurrentPlayer(workingRoot);
          return { ok: true };
        case "coordinate_sync_planet_markers":
          coordinateRuntime.syncPlanetOrbitLandMarkers(workingRoot);
          return { ok: true };
        case "coordinate_seed_reference_rockets":
          coordinateRuntime.seedDefaultReferenceRockets(workingRoot);
          return { ok: true };
        case "ai_choose_initial_selection":
          return chooseInitialSelectionForAiPlayerForRoot(workingRoot);
        case "ai_set_player_difficulty": {
          const player = workingRoot.playerState.players.find((candidate) => candidate.id === command.playerId);
          if (!player) return { ok: false, code: "AI_PLAYER_NOT_FOUND", message: "找不到 AI 玩家" };
          player.aiDifficulty = command.difficulty;
          player.aiDifficultyLabel = command.label;
          return { ok: true };
        }
        case "ai_execute_turn_action":
          return cloneResidentPresentation(executeAiTurnActionForRoot(workingRoot, command.action));
        case "ai_resolve_to_turn_boundary":
          return cloneResidentPresentation(resolveAiAutomationToTurnBoundaryForRoot(workingRoot, command.options));
        case "ai_run_automation_step":
          return cloneResidentPresentation(runAiAutomationStepForRoot(workingRoot));
        case "ai_run_action_effect_step":
          return cloneResidentPresentation(runAiActionEffectStepForRoot(workingRoot));
        case "ai_run_non_turn_step":
          return cloneResidentPresentation(runAiNonTurnAutomationStepForRoot(workingRoot));
        case "ai_run_selected_turn_action":
          return cloneResidentPresentation(runAiSelectedTurnActionForRoot(workingRoot, command.selector, command.options));
        case "ai_recover_idle_action_effect":
          return cloneResidentPresentation(recoverAiIdleActionEffectStepForRoot(workingRoot, ...(command.args || [])));
        case "ai_build_turn_candidates":
          return cloneResidentPresentation(buildAiTurnActionCandidatesForRoot(workingRoot, ...(command.args || [])));
        case "card_trigger_list_free_move_candidates":
          return { ok: true, value: cloneResidentPresentation(listCardTriggerFreeMoveCandidatesForRoot(workingRoot, ...(command.args || []))) };
        case "ui_execute_primary_board_action":
          return cloneResidentPresentation(actionRuntimeController?.executePrimaryBoardAction(
            createActionContextForWorkingRoot(workingRoot, command.descriptor),
            command.descriptor,
            command.executionOptions,
            command.options,
          ));
        case "score_build_final_summary":
          return { ok: true, value: buildFinalScoreSummaryLinesForRoot(workingRoot) };
        case "score_sync_pending_marks":
          return cloneResidentPresentation(syncFinalScorePendingMarksForRoot(workingRoot));
        case "score_mark_tile":
          return cloneResidentPresentation(handleFinalScoreTileClickForRoot(workingRoot, command.tileId));
        case "ui_get_required_move_points":
          return { ok: true, value: getRequiredMovePointsForUiForRoot(workingRoot, ...(command.args || [])) };
        case "ui_set_status_note":
          workingRoot.rocketState.statusNote = command.message;
          return { ok: true, value: command.message };
        case "card_toggle_public_corner_discard":
          return { ok: true, value: cloneResidentPresentation(handlePublicCornerDiscardCardClickForRoot(
            workingRoot,
            command.slotIndex,
          )) };
        case "card_confirm_public_corner_discard":
          return { ok: true, value: cloneResidentPresentation(confirmPublicCornerDiscardSelectionForRoot(workingRoot)) };
        case "quick_action_check_pending":
          return { ok: true, value: cloneResidentPresentation(blockIncompatiblePendingQuickActionForRoot(
            workingRoot,
            command.actionType,
          )) };
        case "card_execute_free_move_corner":
          return cloneResidentPresentation(executeFreeMoveForCardCornerForRoot(workingRoot, ...(command.args || [])));
        case "rocket_current_planet":
          return { ok: true, value: getRocketCurrentPlanetIdForRoot(workingRoot, command.rocketId) };
        case "chong_ready_transports":
          return { ok: true, value: cloneResidentPresentation(listReadyChongTransportCandidatesForRoot(workingRoot, command.player, command.task)) };
        case "scan_execute_free_move":
          return cloneResidentPresentation(executeFreeMoveForScanAction4ForRoot(workingRoot, ...(command.args || [])));
        case "effect_choice_command": {
          const operation = effectChoiceFlowHelpers?.[command.operation];
          if (typeof operation !== "function") {
            return { ok: false, code: "EFFECT_CHOICE_COMMAND_UNKNOWN", message: `未知 Effect choice command: ${command.operation}` };
          }
          return { ok: true, value: cloneResidentPresentation(operation(workingRoot, ...(command.args || []))) };
        }
        case "hand_flow_command": {
          const operation = handFlowHelpers?.[command.operation];
          if (typeof operation !== "function") {
            return { ok: false, code: "HAND_FLOW_COMMAND_UNKNOWN", message: `未知 Hand flow command: ${command.operation}` };
          }
          return {
            ok: true,
            value: cloneResidentPresentation(operation(workingRoot, ...(command.args || []))),
          };
        }
        case "effect_executor_command": {
          const operation = effectExecutors?.[command.operation];
          if (typeof operation !== "function") {
            return { ok: false, code: "EFFECT_EXECUTOR_COMMAND_UNKNOWN", message: `未知 Effect executor command: ${command.operation}` };
          }
          return {
            ok: true,
            value: cloneResidentPresentation(operation(workingRoot, ...(command.args || []))),
          };
        }
        case "debug_command": {
          const operation = debugRuntimeController?.[command.operation];
          if (typeof operation !== "function") {
            return { ok: false, code: "DEBUG_COMMAND_UNKNOWN", message: `未知 Debug command: ${command.operation}` };
          }
          return {
            ok: true,
            value: cloneResidentPresentation(operation(workingRoot, ...(command.args || []))),
          };
        }
        case "recovery_clear_transient":
          clearTransientStateForRecovery(workingRoot);
          return { ok: true };
        case "recovery_refresh":
          refreshAfterGameRecovery(command.message, workingRoot);
          return { ok: true };
        case "effect_bar_click":
          return { ok: true, value: cloneResidentPresentation(handleActionEffectButtonClickForRoot(workingRoot, command.effectIndex)) };
        case "effect_skip_current":
          return { ok: true, value: cloneResidentPresentation(skipCurrentActionEffectForRoot(workingRoot)) };
        case "effect_cancel_subflows":
          cancelActiveEffectSubFlowsForRoot(workingRoot);
          return { ok: true };
        case "effect_finish_flow":
          return { ok: true, value: cloneResidentPresentation(finishActionEffectFlowForRoot(workingRoot)) };
        case "effect_begin_scan_free_move":
          return { ok: true, value: cloneResidentPresentation(beginScanAction4FreeMoveForRoot(workingRoot)) };
        case "effect_begin_card_move":
          return { ok: true, value: cloneResidentPresentation(beginCardMoveEffectForRoot(workingRoot, command.effect)) };
        case "effect_cancel_pending_subflows":
          return { ok: true, value: cancelActivePendingSubFlowsForRoot(workingRoot) };
        case "data_place_blue_slot":
          return { ok: true, value: cloneResidentPresentation(placeDataToBlueSlotForRoot(workingRoot, command.blueSlot)) };
        case "action_recover_pending":
          return { ok: true, value: cloneResidentPresentation(recoverPendingActionFromOpenHistoryForAiForRoot(workingRoot)) };
        case "history_undo_pending":
          return { ok: true, value: cloneResidentPresentation(undoPendingActionForRoot(workingRoot)) };
        case "data_open_computer_picker":
          return { ok: true, value: cloneResidentPresentation(runPlaceDataToComputerForRoot(workingRoot)) };
        case "debug_execute_income":
          return { ok: true, value: cloneResidentPresentation(executeIncomeForCurrentPlayerForRoot(workingRoot)) };
        case "solar_rotate":
          return { ok: true, value: cloneResidentPresentation(rotateSolarOrbitForRoot(workingRoot, command.count)) };
        case "scan_settle_completed_sectors":
          return { ok: true, value: cloneResidentPresentation(resolveCompletedSectorSettlementsForRoot(
            workingRoot,
            command.actionType,
            command.options,
          )) };
        case "card_execute_move_effect":
          return cloneResidentPresentation(executeCardMoveForEffectForRoot(workingRoot, ...(command.args || [])));
        case "headless_enumerate_turn_actions":
          return { ok: true, value: enumerateHeadlessTurnActionsForRoot(workingRoot) };
        case "headless_enumerate_conditional_actions":
          return { ok: true, value: enumerateHeadlessConditionalActionsForRoot(workingRoot) };
        case "headless_execute_conditional_action":
          return cloneResidentPresentation(
            conditionalActionExecutor.execute(workingRoot, command.action?.standardAction || command.action),
          );
        case "headless_advance_deterministic":
          return advanceHeadlessDeterministicStateImpl(workingRoot) || { ok: true, progressed: false };
        case "headless_execute_current_effect":
          return executeHeadlessCurrentActionEffectImpl(workingRoot) || { ok: true, progressed: false };
        case "headless_skip_current_effect":
          return skipHeadlessCurrentActionEffectImpl(workingRoot);
        case "domain_command":
          return executeBrowserDomainCommand(workingRoot, command);
        default:
          return { ok: false, code: "BROWSER_HOST_COMMAND_UNKNOWN", message: `未知 Browser host command: ${command.kind}` };
      }
    },
    createActionRegistry() {
      return {
        enumerate(workingState, request = {}) {
          return actionRuntimeController?.dispatchAction(
            { kind: "standard_enumerate", payload: request },
            null,
            createActionContextForWorkingRoot(workingState),
          )?.candidates || [];
        },
        validate(workingState, action) {
          return actionRuntimeController?.dispatchAction(
            { kind: "standard_validate", standardAction: action },
            null,
            createActionContextForWorkingRoot(workingState, action),
          ) || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE" };
        },
        execute(workingState, action) {
          return actionRuntimeController?.executeStandardDescriptor(
            createActionContextForWorkingRoot(workingState, action),
            action,
          ) || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE" };
        },
      };
    },
    effectDomains: [{
      create: standardActionSessionModule.createStandardActionDomain,
      families: standardActionModule.ALL_FAMILIES,
      options: {
        actionFamilies: standardActionModule.ALL_FAMILIES,
        continuation: {
          inspect(workingRoot) {
            const conditional = enumerateHeadlessConditionalActionsForRoot(workingRoot);
            const candidates = (conditional.candidates || [])
              .filter((candidate) => candidate?.available !== false);
            if (candidates.length) {
              if (candidates[0]?.target?.kind === "chong-fossil-choice") {
                alienSpeciesRuntime?.takeChongFossilDecisionDraft?.();
              }
              if (candidates[0]?.target?.kind === "amiba-symbol-choice") {
                alienSpeciesRuntime?.takeAmibaSymbolDecisionDraft?.();
              }
              if (candidates[0]?.target?.kind === "yichangdian-corner-choice") {
                effectExecutors?.takeYichangdianCornerAction?.();
              }
              if (candidates[0]?.target?.kind === "runezu-symbol-branch") {
                alienSpeciesRuntime?.takeRunezuSymbolBranchDecisionDraft?.();
              }
              if (candidates[0]?.target?.kind === "runezu-face-symbol-choice") {
                alienSpeciesRuntime?.takeRunezuFaceSymbolDecisionDraft?.();
              }
              if (candidates[0]?.target?.kind === "runezu-card-gain") alienSpeciesRuntime?.takeRunezuCardGainDecisionDraft?.();
              if (candidates[0]?.target?.kind === "amiba-card-gain") alienSpeciesRuntime?.takeAmibaCardGainDecisionDraft?.();
              if (candidates[0]?.target?.kind === "aomomo-card-gain") alienSpeciesRuntime?.takeAomomoCardGainDecisionDraft?.();
              if (candidates[0]?.target?.kind === "yichangdian-card-gain") alienSpeciesRuntime?.takeYichangdianCardGainDecisionDraft?.();
              if (candidates[0]?.target?.kind === "banrenma-card-gain") alienSpeciesRuntime?.takeBanrenmaCardGainDecisionDraft?.();
              if (candidates[0]?.target?.kind === "chong-card-gain") alienSpeciesRuntime?.takeChongCardGainDecisionDraft?.();
              if (candidates[0]?.target?.kind === "amiba-trace-removal") alienSpeciesRuntime?.takeAmibaTraceRemovalDecisionDraft?.();
              if (candidates[0]?.target?.kind === "jiuzhe-card-play" || candidates[0]?.target?.kind === "jiuzhe-card-skip") {
                alienSpeciesRuntime?.takeJiuzheCardPlayDecisionDraft?.();
              }
              if (candidates[0]?.target?.kind === "banrenma-panel-bonus" || candidates[0]?.target?.kind === "banrenma-card-condition") {
                alienSpeciesRuntime?.takeBanrenmaOpportunityDecisionDraft?.();
              }
              if (candidates[0]?.target?.kind === "probe-sector-selection") {
                decisionSessions.clear(PROBE_SECTOR_SCAN_SESSION);
              }
              if (candidates[0]?.target?.kind === "probe-location-reward") {
                decisionSessions.clear(PROBE_LOCATION_REWARD_SESSION);
              }
              if (candidates[0]?.target?.kind === "sector-scan-target") {
                decisionState.scanTargetAction = null;
                if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
              }
              return {
                ok: true,
                boundary: "conditional_choice",
                decisionType: "conditional_choice",
                actorPlayer: conditional.actorPlayer || null,
                ownerId: conditional.actorPlayer?.id || null,
                family: candidates[0]?.family || null,
                candidates,
              };
            }
            const turnCandidates = enumerateHeadlessTurnActionsForRoot(workingRoot);
            if (turnCandidates.length || workingRoot.turnState.gameEnded) {
              return {
                ok: true,
                boundary: workingRoot.turnState.gameEnded ? "terminal" : "turn_action",
                decisionType: "turn_action",
                actorPlayer: players.getCurrentPlayer(workingRoot.playerState),
                candidates: turnCandidates,
              };
            }
            const pending = getAiAutoBattleProgress?.().pendingState || {};
            return {
              ok: true,
              boundary: "draining",
              decisionType: null,
              candidates: [],
              actionEffectActive: Boolean(pending.actionEffectFlowActive),
              currentEffect: structuredClone(pending.currentEffect || null),
            };
          },
          executeDeterministic(workingRoot, boundary) {
            const deterministic = advanceHeadlessDeterministicStateImpl(workingRoot);
            if (deterministic?.progressed) {
              return {
                ...deterministic,
                ok: deterministic.ok !== false,
                events: [{ type: "standard_action_deterministic_advance" }],
              };
            }
            if (boundary?.actionEffectActive) {
              const effectResult = executeHeadlessCurrentActionEffectImpl(workingRoot);
              return {
                ...(effectResult || {}),
                ok: effectResult?.ok !== false,
                progressed: effectResult?.ok !== false,
                events: [{
                  type: "standard_action_deterministic_effect",
                  effectType: boundary.currentEffect?.type || effectResult?.type || null,
                  effectId: boundary.currentEffect?.id || effectResult?.effectId || null,
                }],
              };
            }
            return {
              ok: false,
              code: "HEADLESS_UNSUPPORTED_PENDING",
              message: "存在未迁移的 headless pending，Composition 拒绝 resolver/recover/skip fallback",
            };
          },
          resolveDecision(workingRoot, choice) {
            return conditionalActionExecutor.executeEffectChoice(workingRoot, choice);
          },
        },
      },
    }],
    projectState(state) {
      return {
        meta: { stateVersion: state.meta.stateVersion },
        match: structuredClone(state.match),
        turn: structuredClone(state.turn),
      };
    },
  });
  const browserRuleLifecycle = browserRuleComposition.lifecycle;
  const primaryBoardActionExecutor = primaryBoardActionExecutorModule.createPrimaryBoardActionExecutor({
    actions,
    abilities,
    solar,
  });
  const engineActionExecutor = engineActionExecutorModule.createEngineActionExecutor({
    actions,
    abilities,
    players,
    createActionContext: createActionContextForWorkingRoot,
    getAnalyzeActionOptions: getAnalyzeActionOptionsForPlayer,
    executeScan: (workingRoot, descriptor) => executeMainScanAction(workingRoot, descriptor),
    executePlayCard: (_workingRoot, descriptor) => executeStandardPlayCard(descriptor),
  });
  const quickTurnActionExecutor = quickTurnActionExecutorModule.createQuickTurnActionExecutor({
    executeQuickTrade: (workingRoot, descriptor) => runQuickTrade(descriptor.target?.tradeId, {
      workingRoot,
      standardAction: descriptor,
    }),
    executeIndustry: (workingRoot, descriptor) => {
      const player = players.getCurrentPlayer(workingRoot.playerState);
      return handleCompanyActionMarkerClickForRoot(
        workingRoot,
        player?.initialSelection?.industry,
      ) || { ok: true, progressed: true };
    },
    executeCardCorner: (_workingRoot, descriptor) => executeStandardCardCornerAction(descriptor),
    executePlaceData: (workingRoot, descriptor) => confirmDataPlacement(
      descriptor.target?.target,
      descriptor.target?.blueSlot,
      { workingRoot, standardAction: descriptor },
    ),
    executeRunezuFaceSymbol: (workingRoot, descriptor) => executeStandardRunezuFaceSymbol(workingRoot, descriptor),
    executePass: (workingRoot, descriptor) => passForCurrentPlayer({ workingRoot, standardAction: descriptor }),
    executeEndTurn: (workingRoot, descriptor) => endCurrentTurn({ workingRoot, standardAction: descriptor }),
  });
  let actionRuntimeController = null;
  let browserActionStableRecoverySnapshot = null;
  function dispatchBrowserRuleInput(request, fallbackOptions = null, explicitActionContext = null) {
    const action = typeof request === "string"
      ? { kind: request, payload: fallbackOptions || null }
      : { ...(request || {}) };
    const ensureStableRecoverySnapshot = () => {
      if (headlessMode) return;
      if (browserRuleComposition.inspect().phase === "idle" && !browserActionStableRecoverySnapshot) {
        browserActionStableRecoverySnapshot = createGameRecoverySnapshot({
          label: "Standard Action 开始前稳定恢复点",
        });
      }
    };
    if (action.kind === "standard_enumerate") {
      ensureStableRecoverySnapshot();
      return {
        ok: true,
        candidates: browserRuleComposition.inputPort.enumerateActions(action.payload || {}),
      };
    }
    if (action.kind === "standard_resolve" || action.kind === "standard_validate") {
      return actionRuntimeController.dispatchAction(action, fallbackOptions, explicitActionContext);
    }
    let descriptor = action.standardAction
      || (action.schemaVersion === standardActionModule.SCHEMA_VERSION ? action : null);
    if (action.kind === "standard_intent") {
      ensureStableRecoverySnapshot();
      const resolved = actionRuntimeController.dispatchAction({
        kind: "standard_resolve",
        family: action.family,
        selector: action.selector || {},
        payload: action.payload || {},
      }, fallbackOptions, explicitActionContext);
      if (!resolved?.ok) return resolved;
      descriptor = resolved.action;
    }
    if (descriptor) {
      const opensSession = browserRuleComposition.inspect().phase === "idle";
      if (opensSession) ensureStableRecoverySnapshot();
      const result = descriptor.phase === "quick"
        ? browserRuleComposition.inputPort.submitQuickAction(descriptor)
        : browserRuleComposition.inputPort.submitAction(descriptor);
      if (browserRuleComposition.inspect().phase === "idle") {
        browserActionStableRecoverySnapshot = null;
      }
      return result;
    }
    return actionRuntimeController.dispatchAction(action, fallbackOptions, explicitActionContext);
  }
  const runtime = runtimeModule.createRuntime({
    aiDifficulty: AI_DIFFICULTY_LAUGHABLE,
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    alienTypeIds: aliens.ALIEN_TYPE_IDS || [],
    industryCardFiles: INDUSTRY_CARD_FILES,
  });
  const decisionSessions = runtime.decisions;
  const decisionState = decisionSessions.createFacade({
    discardAction: "discard_action",
    cardSelectionAction: "card_selection_action",
    scanTargetAction: "scan_target_action",
    handScanAction: "hand_scan_action",
    alienTraceAction: "alien_trace_action",
    alienTracePickerState: "alien_trace_picker_state",
    actionEffectFlow: "action_effect_flow",
  });
  const DATA_PLACEMENT_DECISION = "data_placement";
  const LAND_TARGET_DECISION = "land_target";
  const PIRATES_RAID_DECISION = "pirates_raid_placement";
  const STRATEGY_SLOT_DECISION = "strategy_passive_slot";
  const PUBLIC_SCAN_QUEUE_SESSION = "public_scan_queue";
  const PROBE_SECTOR_SCAN_SESSION = "probe_sector_scan";
  const PROBE_LOCATION_REWARD_SESSION = "probe_location_reward";
  const HAND_CARD_PLAY_SESSION = "hand_card_play_action";
  const CARD_CORNER_QUICK_SESSION = "card_corner_quick_action";
  const CARD_CORNER_FREE_MOVE_SESSION = "card_corner_free_move";
  const CARD_TRIGGER_FREE_MOVE_SESSION = "card_trigger_free_move";
  const CARD_TRIGGER_ACTION_SESSION = "card_trigger_action";
  const CARD_TASK_COMPLETION_SESSION = "card_task_completion";
  const PASS_RESERVE_SELECTION_SESSION = "pass_reserve_selection";
  const PLAY_CARD_SELECTION_SESSION = "play_card_selection";
  const MOVE_PAYMENT_SESSION = "move_payment";
  const getPendingDataPlacementDecision = () => decisionSessions.peek(DATA_PLACEMENT_DECISION);
  const getPendingLandTargetDecision = () => decisionSessions.peek(LAND_TARGET_DECISION);
  const getPendingPiratesRaidDecision = () => decisionSessions.peek(PIRATES_RAID_DECISION);
  const getPendingStrategySlotDecision = () => decisionSessions.peek(STRATEGY_SLOT_DECISION);
  const getPublicScanQueueSession = () => decisionSessions.peek(PUBLIC_SCAN_QUEUE_SESSION);
  const getPendingProbeSectorScanDecision = () => decisionSessions.peek(PROBE_SECTOR_SCAN_SESSION);
  const getPendingProbeLocationRewardDecision = () => decisionSessions.peek(PROBE_LOCATION_REWARD_SESSION);
  const hasTurnEndRevealContinuation = (workingRoot = createStateSourceReadoutRoot()) => (
    Boolean(workingRoot?.match?.turnEndRevealContinuation)
  );
  const getPendingCardCornerFreeMove = () => decisionSessions.peek(CARD_CORNER_FREE_MOVE_SESSION);
  const getPendingCardTriggerFreeMove = () => decisionSessions.peek(CARD_TRIGGER_FREE_MOVE_SESSION);
  const getPendingCardTriggerAction = () => decisionSessions.peek(CARD_TRIGGER_ACTION_SESSION);
  const getPendingCardTaskCompletion = () => decisionSessions.peek(CARD_TASK_COMPLETION_SESSION);
  const getPendingPassReserveSelection = () => decisionSessions.peek(PASS_RESERVE_SELECTION_SESSION);
  const getPendingPlayCardSelectionSession = () => decisionSessions.peek(PLAY_CARD_SELECTION_SESSION);
  const getPendingMovePayment = () => decisionSessions.peek(MOVE_PAYMENT_SESSION);
  const conditionalDecisionDomain = conditionalDecisionDomainModule.createConditionalDecisionDomain(() => ({
    finalScoring,
    FINAL_SCORE_IDS,
    getCurrentPlayer,
    getPendingProbeSectorScanDecision,
    getPendingProbeLocationRewardDecision,
    getPendingYichangdianCornerAction,
    getPendingYichangdianCornerCards,
    getPendingChongFossilChoice,
    getPendingAmibaSymbolChoice,
    getPendingRunezuSymbolBranch,
    getPendingRunezuFaceSymbolPlacement,
    getPendingRunezuCardGain,
    getPendingAmibaCardGain,
    getPendingAomomoCardGain,
    getPendingYichangdianCardGain,
    getPendingBanrenmaCardGain,
    getPendingJiuzheCardPlay,
    getPendingBanrenmaOpportunity,
    getPendingChongCardGain,
    getPendingAmibaTraceRemoval,
    getHeadlessConditionalPlayer,
    get decisionSessions() { return decisionSessions; },
    getPlayerById,
    get decisionState() { return decisionState; },
    cards,
    players,
    getPublicScanChoicesForCard,
    getPendingPassReserveSelection,
    getPassReserveSelectionCards,
    getPendingMovePayment,
    isMovePaymentCard,
    isTechTilePickingActive,
    tech,
    industry,
    getResearchTechSelectionOptions,
    isTechTileOwnedByOtherPlayer,
    isActionEffectFlowActive,
    skipCurrentActionEffect,
    getPendingDataPlacementDecision,
    data,
    getPendingCardTriggerFreeMove,
    getMovableTokensForPlayer,
    rocketActions,
    getRequiredMovePointsForUi,
    canPayForMove,
    formatRocketLabel,
    getEffectOwnerPlayer,
    getCurrentActionEffect,
    getMovableTokensForCardMoveEffect,
    validateIndustryHuanyuMoveRocket,
    getPendingCardCornerFreeMove,
    isPlayCardSelectionActive,
    getCardPlayCost,
    getPendingStrategySlotDecision,
    isFutureSpanEligibleHandCard,
    getPublicCardMultiSelectMinSelectable,
    getPublicScanMinSelectable,
    allowsBlindDrawInSelection,
    canBlindDraw,
    getPendingLandTargetDecision,
    abilities,
    createActionContext: createReadoutActionContext,
    getFangzhouUnlockableTraceTypes,
    hasAlienTracePanelPlacementTarget,
    getAlienTraceChoiceSlotIds,
    aliens,
    handleConditionalSectorChoice,
    handleChongFossilChoice,
    confirmProbeSectorScanSelection,
    handleRunezuSymbolBranchChoice,
    handleRunezuFaceSymbolChoice,
    handleAmibaSymbolChoice,
    handleFinalScoreTileClick,
    handleSupplyTechTileClick,
    confirmTechBlueSlotChoice,
    cancelTechSelection,
    handleFangzhouTraceDestinationChoice,
    handleFangzhouUnlockTraceChoice,
    handleDiscardCornerRepeatChoice,
    handleReturnUnfinishedTaskChoice,
    handleRemoveOrbitToProbeChoice,
    handleRemovePlanetMarkerChoice,
    confirmDataPlacement,
    skipPendingDataPlacement,
    handleDiscardIncomeCardChoice,
    confirmDiscardAnyForIncome,
    handlePayCreditChoice,
    confirmScanTarget,
    selectPassReserveCard,
    confirmPassReserveSelection,
    handleHandScanCardClick,
    executeCardMoveForEffect,
    executeFreeMoveForCardTrigger,
    restoreObjectSnapshot,
    CARD_TRIGGER_FREE_MOVE_SESSION,
    clearMoveRocketHighlight,
    deactivateMoveMode,
    continueAfterCardTriggerResolution,
    finishCurrentCardMoveEffectEarly,
    executeFreeMoveForCardCorner,
    CARD_CORNER_FREE_MOVE_SESSION,
    settleCardTasksAfterEffect,
    finishIndustryAbilityFlow,
    confirmMovePayment,
    handlePlayCardSelect,
    confirmPlayCardSelection,
    confirmStrategyPassiveSlotChoice,
    handleHandCardDiscard,
    handlePublicCardClick,
    confirmPublicCornerDiscardSelection,
    confirmPublicScanSelection,
    handleIndustryDeepspaceHandClick,
    handleIndustryFutureSpanHandClick,
    drawCardForCurrentPlayer,
    confirmLandTargetChoice,
    handleStateTraceSlotPlacement,
  }));
  const conditionalActionExecutor = conditionalActionExecutorModule.createConditionalActionExecutor({
    domain: conditionalDecisionDomain,
  });
  const actionLogState = runtime.actionLog;
  const actionBriefingState = runtime.actionBriefing;
  const startScreenState = runtime.startScreen;
  const setupSelectionState = runtime.selection;
  const uiRuntimeState = runtime.ui;
  const browserHostState = runtime.browserHost;
  const yichangdianAnomalyMarkerElements = new Map();
  const chongPlanetFossilMarkerElements = new Map();
  const chongFossilOwnerTokenElements = new Map();
  const banrenmaBonusMarkerElements = new Map();
  const runezuBoardSymbolElements = new Map();
  const cardTaskState = cardTaskStateModule.createTaskState();
  const actionHistory = actionHistoryModule.createActionHistory();
  const quickActionHistory = actionHistoryModule.createActionHistory();
  getBrowserCommittedContext = (workingRoot) => ({
    gameId: "seti-browser-runtime",
    rulesetVersion: "seti-runtime-v1",
    seed: workingRoot.meta?.seed ?? "browser-host",
    headlessMode,
    rngState: structuredClone(workingRoot.meta?.rngState
      || { owner: headlessMode ? "headless" : "browser", state: null }),
    sequences: {
      card: cards.getNextCardInstanceSequence(),
      handCard: players.getNextHandCardSequence(),
      finalMark: finalScoring.getNextFinalMarkSequence(),
      dataToken: data.getNextDataTokenSequence(),
      ...data.getDeterministicSequences(),
      historyStep: actionHistoryModule.getNextHistoryStepSequence(),
      actionLog: actionLogState.nextEntryId,
      rocket: workingRoot.rocketState.nextRocketId,
    },
  });
  const HISTORY_SOURCE_MAIN = "main";
  const HISTORY_SOURCE_QUICK = "quick";
  const HISTORY_SOURCE_SETUP = "setup";
  const SCAN_TARGET_ACTION_LAYOUT_CLASSES = Object.freeze([
    "jiuzhe-card-grid",
    "fangzhou-card-grid",
    "runezu-face-symbol-choice-grid",
    "runezu-symbol-branch-choice-grid",
  ]);
  const START_SCREEN_CONTINUE_ENABLED = false;
  const MIN_START_INDUSTRY_POOL_SIZE = 2;
  const INITIAL_SELECTION_INDUSTRY_OPTION_COUNT = 2;
  const INDUSTRY_TURING_BORROW_TECH_TYPES = Object.freeze(["orange", "purple"]);
  const AOMOMO_AUTO_REWARD_EFFECT_TYPES = new Set([
    planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
    planetRewards.EFFECT_TYPES.GAIN_DATA,
    planetRewards.EFFECT_TYPES.SCAN_PLANET_SECTOR,
    planetRewards.EFFECT_TYPES.AOMOMO_CARD,
  ]);
  const historyStepOrder = [];
  const PERSISTENT_GAME_STORAGE_KEY = "seti-randomizer-current-game-v1";
  const PERSISTENT_GAME_SAVE_DELAY_MS = 120;
  let persistentGameSaveTimer = 0;
  let persistentGameSaveSuspended = false;
  const MOVE_DISCARD_ACTION_CODE = 2;
  const MOVE_ENERGY_COST = 1;
  let syncDiscardSelectionChrome;
  let isHandScanSelectionActive;
  let syncHandScanSelectionChrome;
  let cancelHandScanSelection;
  let isMovePaymentSelectionActive;
  let getMovePaymentPlayer;
  let isMovePaymentLockedForAiAutomation;
  let beginSupplementalMovePayment;
  let syncMovePaymentChrome;
  let scrollToPlayerHandPanel;
  let cancelMovePaymentSelection;
  let beginMovePaymentSelection;
  let handleHandCardMovePayment;
  let confirmMovePayment;
  let syncPlayCardSelectionChrome;
  let getPendingPlayCardSelection;
  let handlePlayCardSelect;
  let confirmPlayCardSelection;
  let handleHandCardPlay;
  let executeStandardPlayCard;
  let executeStandardCardCornerAction;
  let executeMainScanAction;
  let getPendingHandCardPlayAction;
  let cancelHandCardPlayAction;
  let clearHandCardContextActions;
  let cancelHandCardContextActions;
  let confirmHandCardPlayAction;
  let getPendingCardCornerQuickAction;
  let syncCardCornerQuickActionChrome;
  let cancelCardCornerQuickAction;
  let handleHandCardCornerQuickAction;
  let confirmCardCornerQuickAction;
  let beginDiscardSelection;
  let cancelDiscardSelection;
  let completeDiscardSelection;
  let finalizePendingDiscardSelection;
  let handleHandCardDiscard;
  let beginPlayCardSelection;
  let cancelPlayCardSelection;
  let handleFutureSpanCardPlay;
  let handleFutureSpanPlayCardSelect;
  let handleHandScanCardClick;
  let getPublicScanBonusSelectableCount;
  let getPublicScanMaxSelectable;
  let getPublicScanMinSelectable;
  let getPublicScanSelectionInstruction;
  let ensureDelayedPublicRefills;
  let registerDelayedPublicRefill;
  let getDelayedPublicRefillSlots;
  let clearDelayedPublicRefillSlots;
  let cloneDelayedPublicRefills;
  let buildReadySectorFinishEffects;
  let buildSectorSettlementRewardEffects;
  let buildScanFinalizeFollowupEffects;
  let isScanRelatedEffectFlow;
  let beginPublicScanForSingleCard;
  let openPublicScanNebulaPickerForCurrentQueueItem;
  let confirmPublicScanSelection;
  let handlePublicScanCardClick;
  let beginHandScan;
  let isExhaustedNebulaScanMessage;
  let replaceNebulaDataForCurrentPlayer;
  let getSectorFinishIcon;
  let getSectorFinishWinnerTarget;
  let appendSectorSettlementResultToFlow;
  let getSectorWinnerRewardKey;
  let createTargetResourceEffect;
  let createTargetPinkTraceEffect;
  let isKnownScanEffectType;
  let isScanRelatedEffect;
  let executeScanActionFinalizeEffect;
  let executeSectorFinishScanEffect;
  let normalizeDelayedPublicRefillSlotIndexes;
  let replenishDelayedPublicRefillSlots;
  let executeScanPublicRefillEffect;
  let settleDelayedPublicRefillsAfterScanFlow;
  let buildEndOfFlowFollowupEffects;
  let shouldAppendQueuedSectorFinishEffects;
  let createEndOfFlowInsertionSource;
  let isEndOfFlowSettlementEffect;
  let pruneEndOfFlowSettlementEffectsAfterUndo;
  let appendEndOfFlowSectorFinishEffects;
  let appendDeferredEndOfFlowEffects;
  let discardPublicScanCard;
  let discardHandScanCard;
  let finalizeScanSourceCard;
  let restoreYichangdianCornerPickerIfPending;
  let setScanTargetActionLayout;
  let closeScanTargetPicker;
  let nebulaHasScannableData;
  let buildNebulaScanChoice;
  let isAomomoActive;
  let getAomomoPlanetLocation;
  let getAomomoCurrentX;
  let getNebulaCurrentX;
  let getSectorScanTargetLabel;
  let buildAomomoScanChoiceForX;
  let hasAomomoScanAtX;
  let buildSectorScanChoicesForX;
  let expandScanChoicesWithAomomoTargets;
  let openScanTargetPicker;
  let confirmScanTarget;
  let findPendingHandScanCardIndex;
  let handleDrawnHandScanSkip;
  let beginSectorScan;
  let getSectorOpenDataCount;
  let getSectorCapacity;
  let getSectorReplacedCount;
  let getSectorExtraMarkCount;
  let getSectorNebulaLabelText;
  let getPublicScanChoicesForCard;
  let hasHandScanTargetCard;
  let getPublicScanIconForScanCode;
  let createPublicScanPendingAction;
  let beginPublicDeckScan;
  let formatIncomeGain;
  let getBlindDrawIrreversible;
  let applyIncomeGainWithImmediateRewards;
  let maybeCompleteFundamentalismIncomeTaskCard;
  let applyIncomeFromCard;
  let buildIncomeResourceGain;
  let formatIncomeResourceSummary;
  let applyIncomeResourcesForPlayer;
  let hasHuanyuSuperdriveRoundStartPending;
  let applyHuanyuSuperdriveRoundStartForPlayer;
  let hasCheatLabRoundStartPending;
  let applyCheatLabRoundStartForPlayer;
  let hasGrandStrategyRoundStartPending;
  let countStrategyPassiveSlotTokens;
  let applyGrandStrategyRoundStartForPlayer;
  let appendIndustryRoundStartLog;
  let applyIndustryRoundStartBonusesForRoot;
  let getFundamentalismRoundStartIncomeRound;
  let hasFundamentalismRoundStartIncomePending;
  let buildFundamentalismRoundStartIncomeEffect;
  let maybeStartFundamentalismRoundStartIncomeFlowForRoot;
  let beginIncomeForCurrentPlayer;
  let buildCardTaskContext;
  let buildPlayerDataTotals;
  let addProbeLocation;
  let buildProbeLocationIndex;
  let startTemporaryCardTaskRewardFlow;
  let getReadyCardTasks;
  let refreshCardTaskState;
  let cloneType1TriggerEvent;
  let enqueueType1TriggerEvents;
  let isCardTriggerPickSelectionActive;
  let hasActiveCardTriggerResolution;
  let isCardTriggerRewardFlowBusy;
  let getType1TriggerMatchesForEvent;
  let applyType1TriggerMatches;
  let continueAfterCardTriggerResolution;
  let cancelCardTriggerChoice;
  let buildAlienTraceEvent;
  let getNebulaColorForCardEvent;
  let ensureCardFlowEventBonuses;
  let getActiveCardEventBonuses;
  let eventMatchesCardBonus;
  let getCardEventBonusKey;
  let applyCardEventBonusReward;
  let applyPublicityMoveFollowupBonus;
  let processCardEventBonuses;
  let processChongTransportArrivalEvents;
  let getChongTransportDestinationCoordinate;
  let getChongTransportArrivalEventKey;
  let buildChongPositionArrivalEvents;
  let settleCardTasksAfterEffect;
  let getChongRewardPrimaryIcon;
  let createChongTaskEffect;
  let buildChongRewardQueueEffects;
  let buildChongFossilRewardQueueEffects;
  let buildChongTransportCleanupEffect;
  let buildChongTaskCompletionEffects;
  let getReadyTaskForReservedCard;
  let getReadyChongTaskForReservedCard;
  let getReadyAmibaTaskForReservedCard;
  let getReadyRunezuTaskForReservedCard;
  let getRunezuTaskProgressIndexes;
  let incrementCompletedTaskCount;
  let removeReservedCardToDiscard;
  let discardReservedCardIfFinished;
  let createCardTriggerProgressSnapshot;
  let createCardTriggerProgressCommands;
  let consumeCardTriggerWithSnapshot;
  let confirmCardTriggerProgress;
  let prepareCardTriggerRewardEffects;
  let queueCardTriggerRewardEffects;
  let getCardTaskCompletionBlockReason;
  let openCardTaskCompletionPicker;
  let closeCardTaskCompletionPicker;
  let confirmCardTaskCompletion;
  let openCardTriggerPicker;
  let closeCardTriggerPicker;
  let applyCardTriggerReward;
  let beginCardTriggerFreeMove;
  let applyCardTriggerMatch;
  let handleCardTriggerChoice;
  let executeFreeMoveForCardTrigger;
  let getDiscardCornerRewardMultiplier;
  let multiplyRewardGain;
  let multiplyDiscardActionReward;
  let multiplyDiscardMoveReward;
  let getCardCornerQuickActionForCard;
  let shouldQueueCardCornerMoveQuickAction;
  let canUseCardCornerQuickAction;
  let formatCardCornerRewardMessage;
  let getCardCornerEventKind;
  let normalizeCardCornerRewardMultiplier;
  let cardCornerCodesEqual;
  let normalizeCardCornerTriggerCode;
  let getDiscardActionTriggerResourceRewardForCode;
  let getDiscardActionTriggerMoveRewardForCode;
  let createCardCornerTriggerEventFields;
  let applyCardCornerRewardFromCard;
  let canStartCardCornerFreeMove;
  let beginCardCornerFreeMove;
  let cloneEffectEvent;
  let getAfterMoveEventsForEffect;
  let buildQueuedCardCornerMoveEffect;
  let startCardCornerMoveEffectFlow;
  let getCardPrice;
  let getCardPlayCost;
  let getCardPlayCreditCost;
  let createPlayCardEvent;
  let createImmediatePlayCardEvent;
  let restoreObjectSnapshot;
  let getFutureSpanCreditPriceForCard;
  let getFutureSpanDeltaForCard;
  let isFutureSpanEligibleHandCard;
  let hasFutureSpanEligibleHandCard;
  let hasPlayableFutureSpanCard;
  let getStandardPlayCardActionBlockReason;
  let formatCardPlayCost;
  let getCardTypeCode;
  let getPlayCardSelectionBlockReason;
  let getHandCardPlayActionForCard;
  let beginCardSelection;
  let cancelCardSelection;
  let finalizeCardSelectionResult;
  let drawBasicCardToPlayer;
  let blindDrawCardForPlayer;
  let drawCardForCurrentPlayer;
  let pickPublicCardForCurrentPlayer;
  let discardCardFromCurrentPlayer;
  let canBlindDraw;
  let updatePublicCardControls;
  let getDelayedPublicRefillSlotIndexes;
  let ensurePublicCardsFilledRespectingDelayedRefills;
  let renderPublicCards;
  let handlePublicCardClick;
  let handlePublicBlindDrawClick;
  let isPassReserveSelectionActive;
  let getPassReserveSelectionCards;
  let renderPassReserveSelection;
  let syncPassReserveSelectionChrome;
  let beginPassReserveSelection;
  let dismissPassReserveSelectionOverlay;
  let selectPassReserveCard;
  let confirmPassReserveSelection;
  let initCardMoveEffectState;
  let isIndustryHuanyuMoveEffect;
  let getEffectResultRocketId;
  let getCompletedIndustryHuanyuMoveRocketIds;
  let validateIndustryHuanyuMoveRocket;
  let getMovableTokensForCardMoveEffect;
  let getCardMoveEffectCost;
  let addResourceCosts;
  let selectDefaultRocketFromCandidates;
  let executeCardEffectMove;
  let finishCurrentCardMoveEffectEarly;
  let requestCardEffectMove;
  const techRenderContext = {
    supplyStage: null,
    supplySlots: {},
    playerBoardTechLayer: null,
  };

  const els = viewAdapter?.els || window.SetiAppDom.collectElements(document);
  const residentViewStateStore = !headlessMode && browserHostModule?.viewStateStore
    ? browserHostModule.viewStateStore.createViewStateStore()
    : null;
  const residentDesktopRenderer = !headlessMode && browserHostModule?.residentRenderer
    ? browserHostModule.residentRenderer.createResidentRenderer({ document, els })
    : null;
  const residentStateSource = browserRuleComposition.stateSourcePort;
  const residentProjectionAdapter = browserHostModule?.projectionAdapter
    ? browserHostModule.projectionAdapter.createBrowserProjectionAdapter({
      stateSource: residentStateSource,
    })
    : null;
  const residentInputAdapter = !headlessMode && browserHostModule?.inputAdapter && residentViewStateStore
    ? browserHostModule.inputAdapter.createBrowserInputAdapter({
      dispatchAction(action) {
        return action?.phase === "quick"
          ? browserRuleComposition.inputPort.submitQuickAction(action)
          : browserRuleComposition.inputPort.submitAction(action);
      },
      submitDecision: (submission) => browserRuleComposition.inputPort.submitDecision(submission),
      viewStateStore: residentViewStateStore,
      refreshProjection: () => residentProjectionAdapter?.projectSource({ viewer: getResidentViewer() }) || null,
    })
    : null;
  const residentDecisionController = residentInputAdapter && browserHostModule?.decisionUi
    ? browserHostModule.decisionUi.createDecisionUiController({
      dispatchIntent(intent) {
        const result = residentInputAdapter.dispatchIntent(intent);
        queueMicrotask(renderResidentDesktop);
        return result;
      },
    })
    : null;
  const residentDecisionRenderer = residentDecisionController && document
    ? browserHostModule.decisionUi.createDecisionDomRenderer({
      root: document.getElementById("compositionDecisionRoot"),
      controller: residentDecisionController,
    })
    : null;
  const residentBrowserServices = browserHostModule?.browserServices
    ? browserHostModule.browserServices.createBrowserServices({
      ruleLifecycle: browserRuleLifecycle,
      viewStateStore: residentViewStateStore,
      storage: headlessMode ? null : gameRecoveryModule.getPersistentGameStorage(window),
      storageKey: `${PERSISTENT_GAME_STORAGE_KEY}:browser-services`,
    })
    : null;

  function getResidentViewer() {
    const player = getInterfacePlayer();
    return {
      viewerId: `browser:${player?.id || "spectator"}`,
      playerId: player?.id == null ? null : String(player.id),
      role: player ? "player" : "spectator",
    };
  }

  function cloneResidentPresentation(value, seen = new WeakMap()) {
    if (value == null || typeof value !== "object") {
      return typeof value === "function" || typeof value === "symbol" ? undefined : value;
    }
    if (seen.has(value)) return undefined;
    if (value instanceof Set) return [...value].map((item) => cloneResidentPresentation(item));
    if (value instanceof Map) {
      return Object.fromEntries([...value.entries()].map(([key, item]) => [
        String(key), cloneResidentPresentation(item),
      ]));
    }
    const output = Array.isArray(value) ? [] : {};
    seen.set(value, output);
    for (const [key, item] of Object.entries(value)) {
      const cloned = cloneResidentPresentation(item, seen);
      if (cloned !== undefined) output[key] = cloned;
    }
    return output;
  }

  function createResidentReadoutRoot(resident) {
    return {
      turnState: structuredClone(resident.turn || {}),
      playerState: structuredClone(resident.players || { currentPlayerId: null, players: [] }),
      solarState: structuredClone(resident.solar || {}),
      rocketState: structuredClone(resident.pieces || {}),
      planetStatsState: structuredClone(resident.planets || {}),
      nebulaDataState: structuredClone(resident.data || {}),
      cardState: structuredClone(resident.cards || {}),
      techGameState: structuredClone(resident.tech || {}),
      alienGameState: structuredClone(resident.aliens || {}),
      finalScoringState: structuredClone(resident.finalScoring || {}),
    };
  }

  function createStateSourceReadoutRoot() {
    const state = browserRuleComposition.stateSourcePort.read().state;
    return {
      turnState: structuredClone(state.turn || {}),
      playerState: structuredClone(state.players || { currentPlayerId: null, players: [] }),
      solarState: structuredClone(state.solarSystem || {}),
      rocketState: structuredClone(state.pieces || {}),
      planetStatsState: structuredClone(state.planets || {}),
      nebulaDataState: structuredClone(state.data || {}),
      cardState: structuredClone(state.cards || {}),
      techGameState: structuredClone(state.tech || {}),
      alienGameState: structuredClone(state.aliens || {}),
      finalScoringState: structuredClone(state.finalScoring || {}),
    };
  }

  function createInitialSelectionProjection(viewer, resident) {
    const active = setupSelectionState.phase === "selecting";
    const currentPlayerId = setupSelectionState.currentPlayerId == null
      ? null
      : String(setupSelectionState.currentPlayerId);
    const viewerPlayerId = viewer?.playerId == null ? null : String(viewer.playerId);
    const projectedPlayer = resident.players.players.find(
      (player) => String(player?.id) === viewerPlayerId,
    );
    const offer = active && currentPlayerId === viewerPlayerId
      ? cloneResidentPresentation(setupSelectionState.offersByPlayerId?.[currentPlayerId] || null)
      : null;
    return {
      active,
      interactive: active && !isAiAutoBattlePlayer?.(currentPlayerId),
      currentPlayerId,
      offer,
      selectedCards: cloneResidentPresentation(getCurrentInitialSelectionCards(projectedPlayer)),
    };
  }

  function createReservedCardProjection(viewer, resident) {
    const viewerPlayerId = viewer?.playerId == null ? null : String(viewer.playerId);
    const projectedPlayer = resident.players.players.find(
      (entry) => String(entry?.id) === viewerPlayerId,
    ) || null;
    const player = cloneResidentPresentation(projectedPlayer);
    const alienReadoutState = cloneResidentPresentation(resident.aliens);
    const initialSelection = createInitialSelectionProjection(viewer, resident);
    const reservedCards = Array.isArray(player?.reservedCards) ? player.reservedCards : [];
    const readyByCardId = { ...(cardTaskState.readyType2ByCardId || {}) };
    for (const card of reservedCards) {
      const specialReady = getReadyChongTaskForReservedCard?.(card, player)
        || getReadyAmibaTaskForReservedCard?.(card, player)
        || getReadyRunezuTaskForReservedCard?.(card, player);
      if (specialReady) readyByCardId[card.id] = specialReady;
    }
    const taskBlockReason = getCardTaskCompletionBlockReason?.() || null;

    function createRegularItem(card, originalIndex) {
      const ready = Boolean(readyByCardId[card.id]);
      const consumed = cardEffects.getConsumedTriggerIndexes(card);
      const runezuProgress = getRunezuTaskProgressIndexes?.(card) || [];
      const plutoState = cardEffects.getCardModel?.(card)?.pluto
        ? getPlutoActionState(card)
        : null;
      return {
        kind: "regular",
        originalIndex,
        imageSrc: card.src || players.CARD_BACK_SRC,
        imageAlt: card.cardName || `保留牌 ${originalIndex + 1}`,
        ready,
        disabled: !ready || Boolean(taskBlockReason),
        title: ready ? (taskBlockReason || "任务已满足，点击确认完成") : "",
        progressIndexes: consumed.length ? consumed : runezuProgress,
        plutoState: plutoState ? {
          orbitDone: Boolean(plutoState.orbitDone),
          landDone: Boolean(plutoState.landDone),
        } : null,
      };
    }

    const taskItems = [];
    const finalItems = [];
    const banrenmaItems = [];
    reservedCards.forEach((card, originalIndex) => {
      if (banrenma?.isBanrenmaCard?.(card)) {
        const mark = banrenma.getPlayerScoreMarks?.(alienReadoutState, player)
          ?.find((entry) => entry.id === card.banrenmaScoreMarkId || entry.cardInstanceId === card.id);
        const threshold = mark?.threshold ?? card.banrenmaThreshold ?? "-";
        const ready = Number(player?.resources?.score || 0) >= Number(threshold);
        banrenmaItems.push({
          kind: "banrenma",
          originalIndex,
          imageSrc: card.src || banrenma.getCardSrc?.(card.alienCardId) || RESOURCE_ICON_SRC.banrenmaCard,
          imageAlt: cards.getCardLabel(card),
          threshold,
          thresholdIconSrc: RESOURCE_ICON_SRC.banrenmaToken,
          ready,
          disabled: !ready,
          title: ready
            ? `半人马条件已达成：${cards.getCardLabel(card)}`
            : `半人马阈值：达到 ${threshold} 分后可结算条件效果`,
        });
        return;
      }
      const item = createRegularItem(card, originalIndex);
      if (getCardTypeCode(card) === 3 || cardEffects.getCardModel?.(card)?.displayRow === "bottom") {
        finalItems.push(item);
      } else {
        taskItems.push(item);
      }
    });

    const jiuzheCards = jiuzhe?.getPlayerJiuzheCards?.(alienReadoutState, player) || [];
    const jiuzheItem = jiuzheCards.length ? {
      kind: "jiuzhe",
      imageSrc: jiuzhe.CARD_BACK_SRC,
      count: jiuzhe.countPlayedCards(alienReadoutState, player),
      playerId: player?.id || "",
      playerColor: player?.color || "",
    } : null;
    const debugFangzhouUnlock = isDebugAlienTraceMode?.() || false;
    const fangzhouItems = (fangzhou?.getPlayerCard2Reserved?.(alienReadoutState, player) || [])
      .map((card) => ({
        kind: "fangzhou",
        traceType: card.traceType,
        imageSrc: card.src,
        imageAlt: card.label,
        debugUnlock: debugFangzhouUnlock,
        disabled: !debugFangzhouUnlock,
        title: debugFangzhouUnlock
          ? `${card.label}（点击追加 state 额外痕迹并解锁）`
          : `${card.label}（未解锁）`,
      }));
    return {
      title: initialSelection.active
        ? `初始选择 · ${player?.colorLabel || ""}玩家`
        : `保留牌区 · 完成任务 ${player?.completedTaskCount || 0}`,
      initialSelectionActive: initialSelection.active,
      empty: !initialSelection.active
        && reservedCards.length === 0
        && !jiuzheItem
        && fangzhouItems.length === 0
        && initialSelection.selectedCards.length === 0,
      rows: [
        { type: "task", label: "1、2型任务牌", items: taskItems },
        {
          type: "final",
          label: "3型终局计分牌与九折/方舟/半人马牌",
          items: [
            ...(jiuzheItem ? [jiuzheItem] : []),
            ...fangzhouItems,
            ...banrenmaItems,
            ...finalItems,
          ],
        },
      ],
    };
  }

  function createResidentRenderInput() {
    if (!residentDesktopRenderer || !residentViewStateStore || !residentProjectionAdapter) return null;
    const viewer = getResidentViewer();
    const decisions = decisionSessions.createFacade({
      discardAction: "discard_action",
      cardSelectionAction: "card_selection_action",
      scanTargetAction: "scan_target_action",
      handScanAction: "hand_scan_action",
      alienTraceAction: "alien_trace_action",
      alienTracePickerState: "alien_trace_picker_state",
      actionEffectFlow: "action_effect_flow",
      movePayment: MOVE_PAYMENT_SESSION,
      playCardSelection: PLAY_CARD_SELECTION_SESSION,
      handCardPlayAction: HAND_CARD_PLAY_SESSION,
      cardCornerQuickAction: CARD_CORNER_QUICK_SESSION,
    });
    const canonical = residentProjectionAdapter.projectSource({ viewer });
    const readoutRoot = createResidentReadoutRoot(canonical.resident);
    const projectedPlayers = canonical.resident?.players?.players || [];
    const finalScoreBreakdownsByPlayerId = Object.fromEntries(projectedPlayers.map((player) => [
      String(player.id),
      cloneResidentPresentation(computePlayerFinalScoreBreakdown(player, readoutRoot)),
    ]));
    const interfacePlayer = projectedPlayers.find((player) => String(player?.id) === viewer.playerId)
      || projectedPlayers.find((player) => (
        String(player?.id) === String(canonical.resident.players.currentPlayerId)
      ))
      || null;
    const handCount = Array.isArray(interfacePlayer?.hand)
      ? interfacePlayer.hand.length
      : Math.max(0, Math.round(Number(interfacePlayer?.resources?.handSize) || 0));
    const selectionActive = Boolean(isCardSelectionActive?.());
    const allowsBlindDraw = selectionActive && Boolean(allowsBlindDrawInSelection?.());
    const blindDrawAvailable = Boolean(canBlindDraw?.());
    const projection = browserHostModule.residentProjection.createResidentProjection({
      projection: {
        ...canonical,
        resident: {
          ...canonical.resident,
          turn: structuredClone(canonical.resident.turn),
          players: {
            currentPlayerId: canonical.resident.players.currentPlayerId,
            players: structuredClone(projectedPlayers),
          },
          solar: structuredClone(canonical.resident.solar),
          pieces: structuredClone(canonical.resident.pieces),
          planets: structuredClone(canonical.resident.planets),
          data: structuredClone(canonical.resident.data),
          cards: {
            ...canonical.resident.cards,
            publicCards: structuredClone(canonical.resident.cards.publicCards || []),
            publicMarket: structuredClone(canonical.resident.cards.publicCards || []),
            ui: {
              selectionActive: Boolean(canonical.resident.cards.ui?.selectionActive),
              discardSelectionActive: Boolean(canonical.resident.cards.ui?.discardSelectionActive),
              playCardSelectionActive: Boolean(canonical.resident.cards.ui?.playCardSelectionActive),
            },
            publicControls: {
              selectionActive,
              multiSelectActive: Boolean(isPublicCardMultiSelectActive?.()),
              blindDrawEnabled: selectionActive && allowsBlindDraw && blindDrawAvailable,
              blindDrawReason: !selectionActive
                ? "请先进入精选"
                : !allowsBlindDraw
                  ? "本次精选不能盲抽"
                  : blindDrawAvailable
                    ? "盲抽一张牌加入手牌"
                    : "牌库已空",
            },
          },
          handPanel: {
            count: handCount,
            overLimit: handCount > 4,
            hint: getPlayerHandPanelTitleHint(),
          },
          initialSelection: createInitialSelectionProjection(viewer, canonical.resident),
          reservedCards: createReservedCardProjection(viewer, canonical.resident),
          tech: {
            board: structuredClone(canonical.resident.tech.board || {}),
            ui: structuredClone(canonical.resident.tech.ui || {}),
          },
          aliens: structuredClone(canonical.resident.aliens),
          finalScoring: {
            ...structuredClone(canonical.resident.finalScoring),
            breakdownsByPlayerId: finalScoreBreakdownsByPlayerId,
          },
          decisions: {
            ...cloneResidentPresentation(decisions),
            alienRevealConfirmation: cloneResidentPresentation(uiRuntimeState.alienRevealConfirmation),
          },
        },
      },
    });
    if (projection.ok === false) throw new TypeError(`${projection.code}: ${projection.message}`);
    residentViewStateStore.reconcileProjection(projection);
    return { projection, viewState: residentViewStateStore.getSnapshot() };
  }

  function renderResidentDesktop() {
    const input = createResidentRenderInput();
    if (!input) return;
    residentDesktopRenderer.renderAll(input);
    residentDecisionRenderer?.render(input);
  }
  const cardHoverPreviewRuntime = viewAdapter?.hoverRuntime
    || renderRuntimeModule.createCardHoverPreviewRuntime({ window, document });
  const attachCardHoverPreview = cardHoverPreviewRuntime.attach;
  const hideCardHoverPreview = cardHoverPreviewRuntime.hide;
  const coordinateRuntime = renderRuntimeModule.createCoordinateRuntime({
    els,
    solar,
    rocketActions,
    planetReferenceLayout,
    planetStats,
    referencePlacementKindLabels: REFERENCE_PLACEMENT_KIND_LABELS,
    planetsReferenceSize: PLANETS_REFERENCE_SIZE,
    rocketSurface: ROCKET_SURFACE,
    removeRocketElement: (...args) => removeRocketElement(...args),
    renderRockets: (...args) => renderRockets(...args),
  });
  const {
    getReferencePlacementKindLabel,
    getReferencePlacementName,
    buildPlanetOrbitLandReferenceData,
    isPlanetMarkerRocket,
    getBoardPointFromClientPosition,
    getPlanetsReferenceDimensions,
    isPointInsideRect,
    isClientPositionInsidePlanetsReference,
    getPlanetsReferencePointFromClientPosition,
    formatBoardPoint,
    getPolarPointFromBoardPoint,
    getBoardPointFromPolarPoint,
    getPolarPointFromClientPosition,
    formatPolarPoint,
    formatSectorCoordinate,
    formatPlanetsReferencePoint,
    isRocketOnPlanetsReference,
    createDefaultReferencePlacementInput,
    createPlanetMarkerPlacement,
    createPlanetMarkerRocket: createPlanetMarkerRocketForRoot,
    removePlanetMarkerRockets: removePlanetMarkerRocketsForRoot,
    syncPlanetOrbitLandMarkers: syncPlanetOrbitLandMarkersForRoot,
    seedDefaultReferenceRockets: seedDefaultReferenceRocketsForRoot,
    formatRocketLabel,
    getMovableTokensForPlayer: getMovableTokensForPlayerForRoot,
    createRocketSnapshot,
    getEarthSectorCoordinate: getEarthSectorCoordinateForRoot,
  } = coordinateRuntime;
  function getCoordinateReadRoot() {
    return createStateSourceReadoutRoot();
  }
  function getMovableTokensForPlayer(playerId) {
    return getMovableTokensForPlayerForRoot(getCoordinateReadRoot(), playerId);
  }
  function getEarthSectorCoordinate() {
    return getEarthSectorCoordinateForRoot(getCoordinateReadRoot());
  }
  function syncPlanetOrbitLandMarkers() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "coordinate_sync_planet_markers" });
  }
  function seedDefaultReferenceRockets() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "coordinate_seed_reference_rockets" });
  }
  const actionLogViewRuntime = viewAdapter?.actionLogViewRuntime
    || actionLogRuntimeModule.createActionLogViewRuntime({
    document,
    els,
    players,
    uiRuntimeState,
    actionLogState,
    historySourceMain: HISTORY_SOURCE_MAIN,
    sourceLabels: ACTION_LOG_SOURCE_LABELS,
    attachCardHoverPreview,
    getCardLabel: cards.getCardLabel,
    });
  const {
    renderActionLog,
    setReportTab,
    isDebugToolsEnabled,
    isStateLogEnabled,
  } = actionLogViewRuntime;
  const renderRuntime = viewAdapter?.renderRuntime || renderRuntimeModule.createRenderRuntime({
    document,
    Image,
    enforceCapabilityInventory: true,
    solar,
    players,
    rocketActions,
    planetStats,
    planetReferenceLayout,
    endGameScoring,
    finalScoring,
    data,
    aliens,
    jiuzhe,
    yichangdian,
    chong,
    aomomo,
    runezu,
    industry,
    getProjection: () => createResidentRenderInput()?.projection,
    viewState: uiRuntimeState,
    tokenWidths,
    techRenderContext,
    sectorElements,
    yichangdianAnomalyMarkerElements,
    chongPlanetFossilMarkerElements,
    chongFossilOwnerTokenElements,
    runezuBoardSymbolElements,
    els,
    ROCKET_IMAGE_SCALE,
    REFERENCE_ORBIT_IMAGE_SCALE,
    REFERENCE_LANDDING_IMAGE_SCALE,
    RESOURCE_ICON_SRC,
    OPPONENT_SECTOR_WIN_STATS,
    OPPONENT_TECH_TYPES,
    ROTATE_STATE_SLOTS,
    tech,
    actionHistory,
    quickActionHistory,
    getPlayerRoundOrderNumber,
    getPlayerDisplayLabel,
    isPlayerPassedThisRound,
    createInitialSelectionPicker,
    createCompanyCardSummary: (...args) => createCompanyCardSummary?.(...args),
    createPlayerNameStat,
    createStatSeparator,
    createStatIcon,
    createInlineIconValue,
    createPlayerStatsRow,
    buildPlayerResourceStatNodes,
    buildPlayerIncomeStatNodes,
    buildPlayerRunezuStatNodes,
    buildPlayerFangzhouStatNodes,
    layoutReservedCardRows,
    renderFinalScoreBoard: (...args) => renderFinalScoreBoard?.(...args),
    buildPlutoMarkerContext: (...args) => renderRuntimeModule.cloneSelectorResult(buildPlutoMarkerContext(...args)),
    canUseCardCornerQuickAction: (...args) => canUseCardCornerQuickAction(...args),
    isIndustryHandSelectionActive: (...args) => isIndustryHandSelectionActive?.(...args),
    isIndustryFutureSpanHandSelectionActive: (...args) => isIndustryFutureSpanHandSelectionActive?.(...args),
    isFutureSpanEligibleHandCard: (...args) => isFutureSpanEligibleHandCard(...args),
    getFutureSpanDeltaForCard: (...args) => getFutureSpanDeltaForCard(...args),
    isMovePaymentCard: (...args) => isMovePaymentCard?.(...args),
    getCardCornerQuickActionForCard: (...args) => renderRuntimeModule.cloneSelectorResult(
      getCardCornerQuickActionForCard(...args),
    ),
    getHandCardPlayActionForCard: (...args) => renderRuntimeModule.cloneSelectorResult(
      getHandCardPlayActionForCard(...args),
    ),
    getCardPlayCost: (...args) => renderRuntimeModule.cloneSelectorResult(getCardPlayCost(...args)),
    formatCardPlayCost: (...args) => formatCardPlayCost(...args),
    getPublicScanChoicesForCard: (...args) => renderRuntimeModule.cloneSelectorResult(
      getPublicScanChoicesForCard(...args),
    ),
    attachCardHoverPreview,
    getPlanetName,
    getBoardPointFromPolarPoint: (...args) => renderRuntimeModule.cloneSelectorResult(
      getBoardPointFromPolarPoint(...args),
    ),
    getReferencePlacementName,
    formatPlanetsReferencePoint,
    formatPolarPoint,
    formatBoardPoint,
    getNormalTokenAssetForPlayer,
    isRocketOnPlanetsReference,
    isPlanetMarkerRocket,
    isRocketMoveCandidate,
    isRocketMoveMuted,
    handleRocketPointerDown,
    getChongPlanetLabel,
    getTurnReadoutLines,
    getInitialSelectionReadoutLines,
    getPlayerReadoutLines,
    getPlanetStatsReadoutLines,
    getRocketCoordinateReadoutLines,
    syncInteractionFocusChrome,
    placeDataToBlueSlot,
    getPublicCardHeight,
  });
  const {
    setTokenAssetSizes,
    renderRocketElement,
    renderChongFossilOwnerTokenForRocket,
    renderChongFossilOwnerTokens,
    renderRockets,
    renderPiratesRaidPlanetMarkers,
    renderYichangdianAnomalyMarkers,
    renderChongPlanetFossilMarkers,
    renderRunezuBoardSymbols,
    renderOpponentStats,
    renderPlayerHand,
    renderReservedCards,
    renderInitialSelectionArea,
    renderPlayerDataBoard,
    renderPlayerStats,
    renderSectorNebulaDataBoard,
    renderWheels,
    renderSectors,
    renderStateReadout,
    renderRotateStateToken,
  } = renderRuntime;
  const finalUiRuntime = finalUiRuntimeModule.createFinalUiRuntime({
    headless: headlessMode,
    document,
    els,
    players,
    finalScoring,
    endGameScoring,
    uiRuntimeState,
    getRuleReadout: createStateSourceReadoutRoot,
    FINAL_SCORE_SLOT_POINTS,
    FINAL_ROUND_NUMBER,
    SCORE_SOURCE_KEYS,
    HISTORY_SOURCE_QUICK,
    getCurrentPlayer,
    getCurrentPlayerLabel: () => getCurrentPlayer()?.colorLabel || "",
    getActivePlayers,
    getDisplayedTurnNumber,
    getNormalTokenAssetForPlayer,
    getHistoryForSource: (...args) => getHistoryForSource?.(...args),
    createActionLogImpactSnapshot,
    appendActionLogStep: (...args) => appendActionLogStep?.(...args),
    actionLogOptionsFromHistoryStep: (...args) => actionLogOptionsFromHistoryStep?.(...args),
    rememberHistoryStep: (...args) => rememberHistoryStep?.(...args),
    historyCommands,
    queueStateReadoutRender: (...args) => queueStateReadoutRender?.(...args),
    computePlayerFinalScoreBreakdown: (player) => (
      computePlayerFinalScoreBreakdown(player, createStateSourceReadoutRoot())
    ),
    getPlayerScoreSource,
    updateActionButtons,
    renderPlayerStats,
    isGameEnded,
    isPlayerPassedThisRound,
    countPlayerOwnedTech: (...args) => countPlayerOwnedTechForActionLogExport?.(...args),
  });
  const {
    syncFinalScorePendingMarks: syncFinalScorePendingMarksForRoot,
    renderFinalScoreBoard,
    handleFinalScoreTileClick: handleFinalScoreTileClickForRoot,
    buildFinalResultPlayerSummaries,
    syncFinalResultButton,
    openFinalResultDialog,
    closeFinalResultDialog,
    minimizeFinalResultDialog,
    maybeAutoOpenFinalResultDialog,
    buildActionLogExportPlayerResults,
  } = finalUiRuntime;
  function syncFinalScorePendingMarks(workingRoot = null) {
    if (workingRoot) return syncFinalScorePendingMarksForRoot(workingRoot);
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "score_sync_pending_marks",
    });
  }
  function handleFinalScoreTileClick(tileId, workingRoot = null) {
    if (workingRoot) return handleFinalScoreTileClickForRoot(workingRoot, tileId);
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "score_mark_tile",
      tileId,
    });
  }
  const refreshHelpers = refreshModule.createRefreshHelpers({
    renderPlayerStats,
    renderAlienPanels,
    renderRockets,
    renderActionEffectBar,
    updateQuickPanel,
    updateActionButtons,
    renderStateReadout,
    renderTechBoard: (...args) => renderTechBoard?.(...args),
    renderSectorNebulaDataBoard,
    renderFinalScoreBoard,
    renderRunezuBoardSymbols,
    renderResidentDesktop,
  });
  const createActionBriefingStepMetadata = (result, options = {}) => (
    actionBriefingModule.createActionBriefingStepMetadata(result, {
      solar,
      data,
      ...options,
    })
  );
  const effectFlowHelpers = effectFlowModule.createEffectFlowHelpers({
    decisionSessions,
    uiRuntimeState,
    actionHistory,
    quickActionHistory,
    historyStepOrder,
    els,
    abilities,
    historyCommands,
    cardEffects,
    quickTrades,
    actionLogState,
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    ACTION_LOG_DEFAULT_LABELS,
    getCurrentPlayer,
    getCurrentPlayerForRoot: (workingRoot) => players.getCurrentPlayer(workingRoot.playerState),
    markCurrentActionIrreversible,
    getIrreversibleReason,
    recordTurnVisitPlanetEvents,
    recordNeutralScoreTracesFromAbilityResult,
    recordScanScoreSourcesFromAbilityResult,
    startActionLogDraft,
    ensureActionLogDraft,
    appendActionLogStep,
    removeActionLogStepsBySource,
    actionLogOptionsFromHistoryStep,
    createActionLogImpactSnapshot,
    composeActionLogDetailWithImpact,
    createActionBriefingStepMetadata,
    markActionPending,
    clearCompletedEffectFlowForUndo,
    assignEffectFlowOwner,
    setActiveEffectFlowOwner,
    renderReservedCards: (...args) => renderReservedCards(...args),
    renderActionEffectBar,
    updateActionButtons,
    renderStateReadout,
    hasActiveCardTriggerResolution: (...args) => hasActiveCardTriggerResolution(...args),
    isCardTriggerRewardFlowBusy: (...args) => isCardTriggerRewardFlowBusy(...args),
    settleCardTasksAfterEffect: (...args) => settleCardTasksAfterEffect(...args),
    finishActionEffectFlow,
    cancelActiveEffectSubFlows,
    maybeAutoExecuteAomomoRewardEffects,
    withEffectExecutionPlayer,
    executeActionEffectForOwner,
  });
  const actionBriefingHelpers = actionBriefingModule.createActionBriefingHelpers({
    window,
    document,
    els,
    actionBriefingState,
    startScreenState,
    getTurnState: () => createStateSourceReadoutRoot().turnState,
    HISTORY_SOURCE_MAIN,
    solar,
    getSolarState: () => browserRuleComposition.stateSourcePort.read().state.solarSystem,
    data,
    aomomo,
    getAomomoCurrentX,
    normalizeActionLogText,
    createActionLogPlayedCardSnapshot,
    attachCardHoverPreview,
    cardBackSrc: players.CARD_BACK_SRC,
    hideCardHoverPreview,
    scheduleAiAutoStepIfNeeded: () => scheduleAiAutoStepIfNeeded?.(),
    setReportTab,
    setLogOpen,
    isAiAutoBattlePlayer: (...args) => isAiAutoBattlePlayer?.(...args),
    getPlayerById,
    getPlayerLabelById,
    getPlayerColorDefinition: players.getPlayerColorDefinition,
    getDisplayedTurnNumber,
    getActionCycleNumber,
    isGameEnded,
  });
  let getEffectHistorySource;
  let shouldIrreversibleBlockCurrentMainAction;
  let markCurrentActionIrreversibleForSource;
  let getHistoryForSource;
  let getActiveEffectHistory;
  let ensureEffectHistorySession;
  let recordHistoryCommand;
  let recordQuickHistoryCommand;
  let recordAbilityCommandsForRoot;
  let startPendingActionSession;
  let beginQuickActionStep;
  let completePendingActionStep;
  let completeQuickActionStep;
  let rememberHistoryStep;
  let forgetLastHistoryStep;
  let clearHistoryStepOrderForSource;
  let getLatestUndoSource;
  let recordQuickTradeCompletion;
  let recordAtomicActionHistoryForRoot;
  let startCardEffectFlow;
  let startPlayCardEffectFlow;
  let beginEffectHistoryStep;
  let endEffectHistoryStep;
  let recordIrreversibleEffectStep;
  let getCurrentActionEffect;
  let activateNextActionEffect;
  let activateNextActionEffectIfIdle;
  let completeCurrentActionEffect;
  let executeActionEffect;
  let resetActionBriefingState;
  let rememberActionBriefingEntry;
  let openActionBriefing;
  let closeActionBriefing;
  let openActionBriefingDetailLog;
  let isActionBriefingEnabled;
  let isActionBriefingOpen;
  let maybeOpenActionBriefingForCompletedCycle;
  ({
    getEffectHistorySource,
    shouldIrreversibleBlockCurrentMainAction,
    markCurrentActionIrreversibleForSource,
    getHistoryForSource,
    getActiveEffectHistory,
    ensureEffectHistorySession,
    recordHistoryCommand,
    recordQuickHistoryCommand,
    recordAbilityCommands: recordAbilityCommandsForRoot,
    startPendingActionSession,
    beginQuickActionStep,
    completePendingActionStep,
    completeQuickActionStep,
    rememberHistoryStep,
    forgetLastHistoryStep,
    clearHistoryStepOrderForSource,
    getLatestUndoSource,
    recordQuickTradeCompletion,
    recordAtomicActionHistory: recordAtomicActionHistoryForRoot,
    startCardEffectFlow,
    startPlayCardEffectFlow,
    beginEffectHistoryStep,
    endEffectHistoryStep,
    recordIrreversibleEffectStep,
    getCurrentActionEffect,
    activateNextActionEffect,
    activateNextActionEffectIfIdle,
    completeCurrentActionEffect,
    executeActionEffect,
  } = effectFlowHelpers);
  function recordAbilityCommands(result, history = actionHistory, workingRoot) {
    return recordAbilityCommandsForRoot(workingRoot, result, history);
  }
  function recordAtomicActionHistory(actionType, label, result, options = {}) {
    return recordAtomicActionHistoryForRoot(actionType, label, result, {
      ...options,
      workingRoot: options.workingRoot,
    });
  }
  ({
    resetActionBriefingState,
    rememberActionBriefingEntry,
    openActionBriefing,
    closeActionBriefing,
    openActionBriefingDetailLog,
    isActionBriefingEnabled,
    isActionBriefingOpen,
    maybeOpenActionBriefingForCompletedCycle,
  } = actionBriefingHelpers);
  const effectChoiceFlowHelpers = effectChoiceFlowModule.createEffectChoiceFlowHelpers({
    document,
    decisionSessions,
    els,
    cards,
    players,
    data,
    solar,
    rocketActions,
    planetStats,
    planetReferenceLayout,
    planetRewards,
    cardEffects,
    historyCommands,
    aomomo,
    endGameScoring,
    SCORE_SOURCE_KEYS,
    getCurrentPlayer,
    getEffectOwnerPlayer,
    getExplicitEffectOwnerPlayer,
    getPendingOwnerFields,
    getPendingOwnerPlayer,
    withPendingOwnerPlayer,
    closeScanTargetPicker: (...args) => closeScanTargetPicker?.(...args),
    renderStateReadout,
    renderPlayerHand,
    renderPlayerStats,
    renderReservedCards: (...args) => renderReservedCards(...args),
    renderRockets,
    syncPlanetOrbitLandMarkers,
    renderActionEffectBar,
    beginEffectHistoryStep,
    endEffectHistoryStep,
    recordHistoryCommand,
    finishAutomaticRewardEffect,
    insertActionEffectsAfterCurrent,
    completeCurrentActionEffect,
    executeSectorXScanEffect,
    buildSectorScanChoicesForX: (...args) => buildSectorScanChoicesForX?.(...args),
    getSectorScanTargetLabel: (...args) => getSectorScanTargetLabel?.(...args),
    normalizeResourceCost,
    formatIncomeGain: (...args) => formatIncomeGain?.(...args),
    applyIncomeFromCard: (...args) => applyIncomeFromCard(...args),
    recordScoreSourceForGainEffect,
    addPlayerScoreSource,
    addScoreSourceFromGain,
    beginCardSelection: (...args) => beginCardSelection(...args),
    beginDiscardSelection: (...args) => beginDiscardSelection?.(...args),
    restoreObjectSnapshot: (...args) => restoreObjectSnapshot(...args),
    applyCardCornerRewardFromCard: (...args) => applyCardCornerRewardFromCard(...args),
    buildRepeatedCardCornerMoveEffect,
    formatRepeatedCardCornerMoveReward,
    buildPlutoMarkerRemovalChoices,
    removePlutoMarker,
    getPlanetSectorCoordinate,
    restoreMutableObject,
    getSectorContentForMove,
    isAsteroidContent,
  });
  const handFlowHelpers = handFlowModule.createHandFlow({
    decisionSessions,
    els,
    players,
    cards,
    quickTrades,
    data,
    industry,
    cardEffects,
    abilities,
    historyCommands,
    quickActionHistory,
    scanEffects,
    fangzhou,
    banrenma,
    chong,
    amiba,
    aomomo,
    runezu,
    solar,
    rocketActions,
    MOVE_ENERGY_COST,
    HISTORY_SOURCE_QUICK,
    SCORE_SOURCE_KEYS,
    getCurrentPlayer,
    getPlayerById,
    getPlayerByColor,
    getGameplayLockReason,
    isTechTilePickingActive: (...args) => isTechTilePickingActive?.(...args),
    isCardSelectionActive,
    isDiscardSelectionActive,
    isPlayCardSelectionActive,
    isIndustryHandSelectionActive: (...args) => isIndustryHandSelectionActive?.(...args),
    hasActivePendingSubFlow,
    getHandCardPlayActionForCard: (...args) => getHandCardPlayActionForCard(...args),
    getCardCornerQuickActionForCard: (...args) => getCardCornerQuickActionForCard(...args),
    canUseCardCornerQuickAction: (...args) => canUseCardCornerQuickAction(...args),
    shouldQueueCardCornerMoveQuickAction: (...args) => shouldQueueCardCornerMoveQuickAction(...args),
    canPayForMove,
    getRequiredMovePointsForUi,
    isMovePaymentCard,
    playerHasMovePaymentCard,
    hasPlayableFutureSpanCard: (...args) => hasPlayableFutureSpanCard(...args),
    getStandardPlayCardActionBlockReason: (...args) => getStandardPlayCardActionBlockReason(...args),
    getCardPlayCost: (...args) => getCardPlayCost(...args),
    formatCardPlayCost: (...args) => formatCardPlayCost(...args),
    restoreObjectSnapshot: (...args) => restoreObjectSnapshot(...args),
    releaseFutureSpanAfterPlayWithHistory,
    markActionPending,
    renderPlayerHand,
    renderPlayerStats,
    renderReservedCards: (...args) => renderReservedCards(...args),
    renderPublicCards: (...args) => renderPublicCards(...args),
    renderInitialSelectionArea,
    renderAlienPanels,
    renderStateReadout,
    updatePublicCardControls: (...args) => updatePublicCardControls(...args),
    updatePlayerHandPanelTitle,
    updateActionButtons,
    setQuickPanelOpen,
    syncInteractionFocusChrome,
    openScanTargetPicker,
    getPublicScanChoicesForCard: (...args) => getPublicScanChoicesForCard(...args),
    executeFreeMoveForScanAction4,
    executeFreeMoveForCardCorner,
    executeFreeMoveForCardTrigger: (...args) => executeFreeMoveForCardTrigger?.(...args),
    executeIndustryFreeMove: (...args) => executeIndustryFreeMove?.(...args),
    executeCardEffectMove: (...args) => executeCardEffectMove?.(...args),
    createActionContext: createActionContextForWorkingRoot,
    recordMoveActionHistory,
    executePrimaryBoardAction: (workingRoot, descriptor, executionOptions, options) => (
      actionRuntimeController?.executePrimaryBoardAction(
        createActionContextForWorkingRoot(workingRoot, descriptor),
        descriptor,
        executionOptions,
        options,
      )
    ),
    renderRocketElement,
    clearMoveRocketHighlight,
    beginQuickActionStep,
    completeQuickActionStep,
    clearHistoryStepOrderForSource,
    addScoreSourceFromGain,
    isAlienFamilyCard,
    applyFangzhouCard1Rewards,
    applyRunezuSymbolReward,
    settleCardTasksAfterEffect: (...args) => settleCardTasksAfterEffect(...args),
    formatCardCornerRewardMessage: (...args) => formatCardCornerRewardMessage(...args),
    createCardCornerTriggerEventFields: (...args) => createCardCornerTriggerEventFields(...args),
    canStartCardCornerFreeMove: (...args) => canStartCardCornerFreeMove(...args),
    beginCardCornerFreeMove: (...args) => beginCardCornerFreeMove?.(...args),
    startCardCornerMoveEffectFlow: (...args) => startCardCornerMoveEffectFlow(...args),
    rollbackPendingIndustryQuickAction: (...args) => rollbackPendingIndustryQuickAction?.(...args),
    continuePendingDataPlacementAfterBonus,
    applyIndustryPlayCardPassives: (workingRoot, ...args) => applyIndustryPlayCardPassivesForRoot?.(workingRoot, ...args),
    buildPlayCardEffectFlowQueue: (workingRoot, ...args) => buildPlayCardEffectFlowQueueForRoot?.(workingRoot, ...args),
    createImmediatePlayCardEvent: (...args) => createImmediatePlayCardEvent(...args),
    createPlayCardEvent: (...args) => createPlayCardEvent(...args),
    recordPlayCardStart,
    startPlayCardEffectFlow,
    appendIndustryPlayPassiveStatus: (workingRoot, ...args) => appendIndustryPlayPassiveStatusForRoot?.(workingRoot, ...args),
    recordMainActionIrreversibleBarrier,
    renderFangzhouCardDisplays,
    getFangzhouCard1RewardTargetOptions,
    getTargetPlayerOptions,
    buildFangzhouCard1EffectQueue,
    applyIncomeFromCard: (...args) => applyIncomeFromCard(...args),
    beginEffectHistoryStep,
    recordHistoryCommand,
    getCurrentActionEffect,
    completeCurrentActionEffect,
    isIncomeDiscardActionType,
    scrollToPlayerCommandPanel,
    getCardTypeCode: (...args) => getCardTypeCode(...args),
    dispatchStandardIntent: (family, selector = {}, payload = {}) => (
      dispatchBrowserRuleInput({ kind: "standard_intent", family, selector, payload })
      || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE", message: "Standard Action runtime 尚未装配" }
    ),
    blockManualAiMovePayment,
    blockIncompatiblePendingQuickAction,
    recordQuickHistoryCommand,
    recordQuickTradeCompletion,
    formatPlanetRewardGain,
    getDiscardCornerRewardMultiplier: (...args) => getDiscardCornerRewardMultiplier(...args),
    requestAnimationFrame,
  });
  ({
    syncDiscardSelectionChrome,
    isHandScanSelectionActive,
    syncHandScanSelectionChrome,
    cancelHandScanSelection,
    isMovePaymentSelectionActive,
    getMovePaymentPlayer,
    isMovePaymentLockedForAiAutomation,
    beginSupplementalMovePayment,
    syncMovePaymentChrome,
    scrollToPlayerHandPanel,
    cancelMovePaymentSelection,
    beginMovePaymentSelection,
    handleHandCardMovePayment,
    confirmMovePayment,
    syncPlayCardSelectionChrome,
    getPendingPlayCardSelection,
    handlePlayCardSelect,
    confirmPlayCardSelection,
    executeStandardCardCornerAction,
    getPendingHandCardPlayAction,
    cancelHandCardPlayAction,
    clearHandCardContextActions,
    cancelHandCardContextActions,
    confirmHandCardPlayAction,
    getPendingCardCornerQuickAction,
    syncCardCornerQuickActionChrome,
    cancelCardCornerQuickAction,
    handleHandCardCornerQuickAction,
    confirmCardCornerQuickAction,
    beginDiscardSelection,
    cancelDiscardSelection,
    completeDiscardSelection,
    finalizePendingDiscardSelection,
    handleHandCardDiscard,
    beginPlayCardSelection,
    cancelPlayCardSelection,
    executeStandardPlayCard,
    handleFutureSpanCardPlay,
    handleHandCardPlay,
    handleFutureSpanPlayCardSelect,
    handleHandScanCardClick,
  } = handFlowHelpers);
  syncDiscardSelectionChrome = (...args) => callHandFlowCommand("syncDiscardSelectionChrome", args);
  isHandScanSelectionActive = (...args) => callHandFlowCommand("isHandScanSelectionActive", args);
  syncHandScanSelectionChrome = (...args) => callHandFlowCommand("syncHandScanSelectionChrome", args);
  cancelHandScanSelection = (...args) => callHandFlowCommand("cancelHandScanSelection", args);
  isMovePaymentSelectionActive = (...args) => callHandFlowCommand("isMovePaymentSelectionActive", args);
  getMovePaymentPlayer = (...args) => callHandFlowCommand("getMovePaymentPlayer", args);
  isMovePaymentLockedForAiAutomation = (...args) => callHandFlowCommand("isMovePaymentLockedForAiAutomation", args);
  beginSupplementalMovePayment = (...args) => callHandFlowCommand("beginSupplementalMovePayment", args);
  syncMovePaymentChrome = (...args) => callHandFlowCommand("syncMovePaymentChrome", args);
  scrollToPlayerHandPanel = (...args) => callHandFlowCommand("scrollToPlayerHandPanel", args);
  cancelMovePaymentSelection = (...args) => callHandFlowCommand("cancelMovePaymentSelection", args);
  beginMovePaymentSelection = (...args) => callHandFlowCommand("beginMovePaymentSelection", args);
  handleHandCardMovePayment = (...args) => callHandFlowCommand("handleHandCardMovePayment", args);
  confirmMovePayment = (...args) => callHandFlowCommand("confirmMovePayment", args);
  syncPlayCardSelectionChrome = (...args) => callHandFlowCommand("syncPlayCardSelectionChrome", args);
  getPendingPlayCardSelection = (...args) => callHandFlowCommand("getPendingPlayCardSelection", args);
  handlePlayCardSelect = (...args) => callHandFlowCommand("handlePlayCardSelect", args);
  confirmPlayCardSelection = (...args) => callHandFlowCommand("confirmPlayCardSelection", args);
  executeStandardCardCornerAction = (...args) => callHandFlowCommand("executeStandardCardCornerAction", args);
  getPendingHandCardPlayAction = (...args) => callHandFlowCommand("getPendingHandCardPlayAction", args);
  cancelHandCardPlayAction = (...args) => callHandFlowCommand("cancelHandCardPlayAction", args);
  clearHandCardContextActions = (...args) => callHandFlowCommand("clearHandCardContextActions", args);
  cancelHandCardContextActions = (...args) => callHandFlowCommand("cancelHandCardContextActions", args);
  confirmHandCardPlayAction = (...args) => callHandFlowCommand("confirmHandCardPlayAction", args);
  getPendingCardCornerQuickAction = (...args) => callHandFlowCommand("getPendingCardCornerQuickAction", args);
  syncCardCornerQuickActionChrome = (...args) => callHandFlowCommand("syncCardCornerQuickActionChrome", args);
  cancelCardCornerQuickAction = (...args) => callHandFlowCommand("cancelCardCornerQuickAction", args);
  handleHandCardCornerQuickAction = (...args) => callHandFlowCommand("handleHandCardCornerQuickAction", args);
  confirmCardCornerQuickAction = (...args) => callHandFlowCommand("confirmCardCornerQuickAction", args);
  beginDiscardSelection = (...args) => callHandFlowCommand("beginDiscardSelection", args);
  cancelDiscardSelection = (...args) => callHandFlowCommand("cancelDiscardSelection", args);
  completeDiscardSelection = (...args) => callHandFlowCommand("completeDiscardSelection", args);
  finalizePendingDiscardSelection = (...args) => callHandFlowCommand("finalizePendingDiscardSelection", args);
  handleHandCardDiscard = (...args) => callHandFlowCommand("handleHandCardDiscard", args);
  beginPlayCardSelection = (...args) => callHandFlowCommand("beginPlayCardSelection", args);
  cancelPlayCardSelection = (...args) => callHandFlowCommand("cancelPlayCardSelection", args);
  executeStandardPlayCard = (...args) => callHandFlowCommand("executeStandardPlayCard", args);
  handleFutureSpanCardPlay = (...args) => callHandFlowCommand("handleFutureSpanCardPlay", args);
  handleHandCardPlay = (...args) => callHandFlowCommand("handleHandCardPlay", args);
  handleFutureSpanPlayCardSelect = (...args) => callHandFlowCommand("handleFutureSpanPlayCardSelect", args);
  handleHandScanCardClick = (...args) => callHandFlowCommand("handleHandScanCardClick", args);
  const scanFlowHelpers = scanFlowModule.createScanFlowHelpers({
    cards,
    players,
    data,
    scanEffects,
    planetRewards,
    cardEffects,
    abilities,
    solar,
    runezu,
    aomomo,
    historyCommands,
    decisionSessions,
    clearPendingAmibaSymbolChoice: () => alienSpeciesRuntime?.clearAmibaSymbolDecisionDraft?.(),
    clearPendingRunezuSymbolBranch: () => alienSpeciesRuntime?.clearRunezuSymbolBranchDecisionDraft?.(),
    clearPendingRunezuFaceSymbolPlacement: () => alienSpeciesRuntime?.clearRunezuFaceSymbolDecisionDraft?.(),
    getPendingYichangdianCornerAction,
    clearPendingAmibaCardGain: () => alienSpeciesRuntime?.clearAmibaCardGainDecisionDraft?.(),
    clearPendingAomomoCardGain: () => alienSpeciesRuntime?.clearAomomoCardGainDecisionDraft?.(),
    clearPendingRunezuCardGain: () => alienSpeciesRuntime?.clearRunezuCardGainDecisionDraft?.(),
    clearPendingAmibaTraceRemoval: () => alienSpeciesRuntime?.clearAmibaTraceRemovalDecisionDraft?.(),
    document,
    structuredClone,
    els,
    PUBLIC_SCAN_MAX_BONUS_CARDS,
    SECTOR_FINISH_ICON_BY_COLOR,
    SECTOR_WIN_REWARDS,
    PUBLIC_SCAN_TARGETS_BY_CODE,
    PUBLIC_SCAN_CODE_LABELS,
    SCAN_TARGET_ACTION_LAYOUT_CLASSES,
    renderStateReadout,
    renderPlayerStats,
    renderPublicCards: (...args) => renderPublicCards(...args),
    renderPlayerHand,
    updatePublicCardControls: (...args) => updatePublicCardControls(...args),
    updateActionButtons,
    syncPublicScanConfirmButton,
    syncCardSelectionChrome,
    syncHandScanSelectionChrome,
    beginEffectHistoryStep,
    endEffectHistoryStep,
    recordHistoryCommand,
    recordAbilityCommands,
    isTechTilePickingActive: (...args) => isTechTilePickingActive?.(...args),
    isCardSelectionActive,
    isDiscardSelectionActive,
    isPlayCardSelectionActive,
    isMovePaymentSelectionActive,
    isHandScanSelectionActive,
    getFlowMarkedNebulaIds,
    normalizeResourceCost,
      createActionContext: createActionContextForWorkingRoot,
    canStartMainAction,
    getMainActionStartBlockReason,
    HISTORY_SOURCE_MAIN,
    startActionLogDraft,
    actionHistory,
    clearHistoryStepOrderForSource,
    removeActionLogStepsBySource,
    maybeConsumeAlienLabPanelForMainAction: (...args) => maybeConsumeAlienLabPanelForMainAction?.(...args),
    rememberHistoryStep,
    appendActionLogStep,
    actionLogOptionsFromHistoryStep,
    createScanRunId,
    assignEffectFlowOwner,
    enrichScanResultEvents,
    renderSectors,
    insertActionEffectsAfterCurrent,
    completeCurrentActionEffect,
    finishAutomaticRewardEffect,
    setActiveEffectFlowOwner,
    getNormalTokenAssetForPlayer,
    renderSectorNebulaDataBoard,
    renderAlienPanels,
    renderRockets,
    assignEffectOwner,
    activateNextActionEffect,
    getPendingOwnerFields,
    withPendingOwnerPlayer,
    confirmIndustryHeliosRemoveTech: (...args) => confirmIndustryHeliosRemoveTech?.(...args),
    isActionEffectFlowActive,
    skipActionEffectWithMessage,
    getCurrentActionEffect,
    applyAomomoScanCostAndBonus,
    maybeReturnPlayedCardToHandAfterSectorScan,
    maybeCompleteActionEffectFromScan,
    markCurrentActionIrreversible,
    syncInteractionFocusChrome,
    openYichangdianCornerPicker,
    rollbackPendingIndustryQuickAction: (...args) => rollbackPendingIndustryQuickAction?.(...args),
    beginCardSelection: (...args) => beginCardSelection(...args),
  });
  ({
    executeMainScanAction,
    getPublicScanBonusSelectableCount,
    getPublicScanMaxSelectable,
    getPublicScanMinSelectable,
    getPublicScanSelectionInstruction,
    ensureDelayedPublicRefills,
    registerDelayedPublicRefill,
    getDelayedPublicRefillSlots,
    clearDelayedPublicRefillSlots,
    cloneDelayedPublicRefills,
    buildReadySectorFinishEffects,
    buildSectorSettlementRewardEffects,
    buildScanFinalizeFollowupEffects,
    isExhaustedNebulaScanMessage,
    replaceNebulaDataForCurrentPlayer,
    getSectorFinishIcon,
    getSectorFinishWinnerTarget,
    appendSectorSettlementResultToFlow,
    getSectorWinnerRewardKey,
    createTargetResourceEffect,
    createTargetPinkTraceEffect,
    isKnownScanEffectType,
    isScanRelatedEffect,
    isScanRelatedEffectFlow,
    executeScanActionFinalizeEffect,
    executeSectorFinishScanEffect,
    normalizeDelayedPublicRefillSlotIndexes,
    replenishDelayedPublicRefillSlots,
    executeScanPublicRefillEffect,
    settleDelayedPublicRefillsAfterScanFlow,
    buildEndOfFlowFollowupEffects,
    shouldAppendQueuedSectorFinishEffects,
    createEndOfFlowInsertionSource,
    isEndOfFlowSettlementEffect,
    pruneEndOfFlowSettlementEffectsAfterUndo,
    appendEndOfFlowSectorFinishEffects,
    appendDeferredEndOfFlowEffects,
    discardPublicScanCard,
    discardHandScanCard,
    finalizeScanSourceCard,
    restoreYichangdianCornerPickerIfPending,
    setScanTargetActionLayout,
    closeScanTargetPicker,
    nebulaHasScannableData,
    buildNebulaScanChoice,
    isAomomoActive,
    getAomomoPlanetLocation,
    getAomomoCurrentX,
    getNebulaCurrentX,
    getSectorScanTargetLabel,
    buildAomomoScanChoiceForX,
    hasAomomoScanAtX,
    buildSectorScanChoicesForX,
    expandScanChoicesWithAomomoTargets,
    openScanTargetPicker,
    confirmScanTarget,
    findPendingHandScanCardIndex,
    handleDrawnHandScanSkip,
    beginSectorScan,
    getSectorOpenDataCount,
    getSectorCapacity,
    getSectorReplacedCount,
    getSectorExtraMarkCount,
    getSectorNebulaLabelText,
    getPublicScanChoicesForCard,
    hasHandScanTargetCard,
    getPublicScanIconForScanCode,
    createPublicScanPendingAction,
    beginPublicDeckScan,
    beginPublicScanForSingleCard,
    openPublicScanNebulaPickerForCurrentQueueItem,
    confirmPublicScanSelection,
    handlePublicScanCardClick,
    beginHandScan,
    cancelHandScanSelection,
    handleHandScanCardClick,
  } = scanFlowHelpers);
  getPublicScanMaxSelectable = (...args) => callBrowserDomainCommand("scan_flow", "getPublicScanMaxSelectable", args);
  buildReadySectorFinishEffects = (...args) => callBrowserDomainCommand("scan_flow", "buildReadySectorFinishEffects", args);
  buildScanFinalizeFollowupEffects = (...args) => callBrowserDomainCommand("scan_flow", "buildScanFinalizeFollowupEffects", args);
  replaceNebulaDataForCurrentPlayer = (...args) => callBrowserDomainCommand("scan_flow", "replaceNebulaDataForCurrentPlayer", args);
  getSectorFinishWinnerTarget = (...args) => callBrowserDomainCommand("scan_flow", "getSectorFinishWinnerTarget", args);
  executeScanActionFinalizeEffect = (...args) => callBrowserDomainCommand("scan_flow", "executeScanActionFinalizeEffect", args);
  executeSectorFinishScanEffect = (...args) => callBrowserDomainCommand("scan_flow", "executeSectorFinishScanEffect", args);
  replenishDelayedPublicRefillSlots = (...args) => callBrowserDomainCommand("scan_flow", "replenishDelayedPublicRefillSlots", args);
  executeScanPublicRefillEffect = (...args) => callBrowserDomainCommand("scan_flow", "executeScanPublicRefillEffect", args);
  settleDelayedPublicRefillsAfterScanFlow = (...args) => callBrowserDomainCommand("scan_flow", "settleDelayedPublicRefillsAfterScanFlow", args);
  buildEndOfFlowFollowupEffects = (...args) => callBrowserDomainCommand("scan_flow", "buildEndOfFlowFollowupEffects", args);
  shouldAppendQueuedSectorFinishEffects = (...args) => callBrowserDomainCommand("scan_flow", "shouldAppendQueuedSectorFinishEffects", args);
  appendEndOfFlowSectorFinishEffects = (...args) => callBrowserDomainCommand("scan_flow", "appendEndOfFlowSectorFinishEffects", args);
  discardPublicScanCard = (...args) => callBrowserDomainCommand("scan_flow", "discardPublicScanCard", args);
  discardHandScanCard = (...args) => callBrowserDomainCommand("scan_flow", "discardHandScanCard", args);
  finalizeScanSourceCard = (...args) => callBrowserDomainCommand("scan_flow", "finalizeScanSourceCard", args);
  restoreYichangdianCornerPickerIfPending = (...args) => callBrowserDomainCommand("scan_flow", "restoreYichangdianCornerPickerIfPending", args);
  closeScanTargetPicker = (...args) => callBrowserDomainCommand("scan_flow", "closeScanTargetPicker", args);
  nebulaHasScannableData = (...args) => callBrowserDomainCommand("scan_flow", "nebulaHasScannableData", args);
  buildNebulaScanChoice = (...args) => callBrowserDomainCommand("scan_flow", "buildNebulaScanChoice", args);
  isAomomoActive = (...args) => callBrowserDomainCommand("scan_flow", "isAomomoActive", args);
  getAomomoPlanetLocation = (...args) => callBrowserDomainCommand("scan_flow", "getAomomoPlanetLocation", args);
  getAomomoCurrentX = (...args) => callBrowserDomainCommand("scan_flow", "getAomomoCurrentX", args);
  getNebulaCurrentX = (...args) => callBrowserDomainCommand("scan_flow", "getNebulaCurrentX", args);
  getSectorScanTargetLabel = (...args) => callBrowserDomainCommand("scan_flow", "getSectorScanTargetLabel", args);
  buildAomomoScanChoiceForX = (...args) => callBrowserDomainCommand("scan_flow", "buildAomomoScanChoiceForX", args);
  hasAomomoScanAtX = (...args) => callBrowserDomainCommand("scan_flow", "hasAomomoScanAtX", args);
  buildSectorScanChoicesForX = (...args) => callBrowserDomainCommand("scan_flow", "buildSectorScanChoicesForX", args);
  expandScanChoicesWithAomomoTargets = (...args) => callBrowserDomainCommand("scan_flow", "expandScanChoicesWithAomomoTargets", args);
  confirmScanTarget = (...args) => callBrowserDomainCommand("scan_flow", "confirmScanTarget", args);
  handleDrawnHandScanSkip = (...args) => callBrowserDomainCommand("scan_flow", "handleDrawnHandScanSkip", args);
  beginSectorScan = (...args) => callBrowserDomainCommand("scan_flow", "beginSectorScan", args);
  getSectorOpenDataCount = (...args) => callBrowserDomainCommand("scan_flow", "getSectorOpenDataCount", args);
  getSectorReplacedCount = (...args) => callBrowserDomainCommand("scan_flow", "getSectorReplacedCount", args);
  getSectorExtraMarkCount = (...args) => callBrowserDomainCommand("scan_flow", "getSectorExtraMarkCount", args);
  getPublicScanChoicesForCard = (...args) => callBrowserDomainCommand("scan_flow", "getPublicScanChoicesForCard", args);
  hasHandScanTargetCard = (...args) => callBrowserDomainCommand("scan_flow", "hasHandScanTargetCard", args);
  createPublicScanPendingAction = (...args) => callBrowserDomainCommand("scan_flow", "createPublicScanPendingAction", args);
  beginPublicDeckScan = (...args) => callBrowserDomainCommand("scan_flow", "beginPublicDeckScan", args);
  beginPublicScanForSingleCard = (...args) => callBrowserDomainCommand("scan_flow", "beginPublicScanForSingleCard", args);
  confirmPublicScanSelection = (...args) => callBrowserDomainCommand("scan_flow", "confirmPublicScanSelection", args);
  handlePublicScanCardClick = (...args) => callBrowserDomainCommand("scan_flow", "handlePublicScanCardClick", args);
  beginHandScan = (...args) => callBrowserDomainCommand("scan_flow", "beginHandScan", args);
  cancelHandScanSelection = (...args) => callBrowserDomainCommand("scan_flow", "cancelHandScanSelection", args);
  handleHandScanCardClick = (...args) => callBrowserDomainCommand("scan_flow", "handleHandScanCardClick", args);
  const incomeRuntime = incomeRuntimeModule.createIncomeRuntime({
    INCOME_GAIN_LABELS,
    players,
    data,
    blindDrawCardForPlayer: (...args) => blindDrawCardForPlayer(...args),
    industry,
    getCardTypeCode: (...args) => getCardTypeCode(...args),
    incrementCompletedTaskCount: (...args) => incrementCompletedTaskCount(...args),
    cards,
    isWeakStartAiDifficulty,
    getPlayerById,
    appendConfirmedActionLogEntry,
    HISTORY_SOURCE_SETUP,
    getActivePlayers,
    renderPlayerStats,
    renderPlayerHand,
    renderInitialSelectionArea,
    renderStateReadout,
    getPlayerLabelById,
    FUNDAMENTALISM_ROUND_START_ROUNDS,
    getCurrentPlayer,
    HISTORY_SOURCE_QUICK,
    startCardEffectFlow,
    renderActionEffectBar,
    updateActionButtons,
    beginDiscardSelection,
  });
  ({
    formatIncomeGain,
    getBlindDrawIrreversible,
    applyIncomeGainWithImmediateRewards,
    maybeCompleteFundamentalismIncomeTaskCard,
    applyIncomeFromCard,
    buildIncomeResourceGain,
    formatIncomeResourceSummary,
    applyIncomeResourcesForPlayer,
    hasHuanyuSuperdriveRoundStartPending,
    applyHuanyuSuperdriveRoundStartForPlayer,
    hasCheatLabRoundStartPending,
    applyCheatLabRoundStartForPlayer,
    hasGrandStrategyRoundStartPending,
    countStrategyPassiveSlotTokens,
    applyGrandStrategyRoundStartForPlayer,
    appendIndustryRoundStartLog,
    applyIndustryRoundStartBonuses: applyIndustryRoundStartBonusesForRoot,
    getFundamentalismRoundStartIncomeRound,
    hasFundamentalismRoundStartIncomePending,
    buildFundamentalismRoundStartIncomeEffect,
    maybeStartFundamentalismRoundStartIncomeFlow: maybeStartFundamentalismRoundStartIncomeFlowForRoot,
    beginIncomeForCurrentPlayer,
  } = incomeRuntime);
  const beginIncomeForCurrentPlayerForRoot = beginIncomeForCurrentPlayer;
  beginIncomeForCurrentPlayer = bindBrowserDomainCommand("income_runtime", "beginIncomeForCurrentPlayer");
  function applyIndustryRoundStartBonuses(...args) {
    return callBrowserDomainCommand("income_runtime", "applyIndustryRoundStartBonuses", args);
  }
  function maybeStartFundamentalismRoundStartIncomeFlow(...args) {
    return callBrowserDomainCommand(
      "income_runtime",
      "maybeStartFundamentalismRoundStartIncomeFlow",
      args,
    );
  }
  function confirmAlienTracePlacement(...args) {
    return callBrowserDomainCommand("alien_runtime", "confirmAlienTracePlacement", args);
  }

  function confirmFangzhouTracePlacement(...args) {
    return callBrowserDomainCommand("alien_runtime", "confirmFangzhouTracePlacement", args);
  }

  const alienUiHelpers = alienUiModule.createAlienUiHelpers({
    decisionSessions,
    uiRuntimeState,
    headless: headlessMode,
    document,
    structuredClone,
    alienTraceRewardFlow,
    aliens,
    jiuzhe,
    yichangdian,
    fangzhou,
    banrenma,
    chong,
    amiba,
    aomomo,
    runezu,
    els,
    renderAlienPanels,
    renderStateReadout,
    getAlienTraceActionPlayer: (workingRoot, ...args) => getAlienTraceActionPlayerForRoot?.(workingRoot, ...args),
    getAvailableDataTokenCount,
    confirmFangzhouCard2Unlock: (workingRoot, ...args) => alienSpeciesRuntime.confirmFangzhouCard2Unlock(workingRoot, ...args),
    confirmAlienTracePlacement: (workingRoot, ...args) => alienRuntimeHelpers.confirmAlienTracePlacement(workingRoot, ...args),
    confirmFangzhouTracePlacement: (workingRoot, ...args) => alienRuntimeHelpers.confirmFangzhouTracePlacement(workingRoot, ...args),
    isDebugAlienTraceMode,
    isActionEffectFlowActive,
    isCardSelectionActive,
    isDiscardSelectionActive,
    getPlayerColorDefinition: (playerColor) => players.getPlayerColorDefinition(playerColor),
  });
  const {
    buildAlienRevealNoticeEntry: buildAlienRevealNoticeEntryForRoot,
    openAlienRevealConfirmation,
    closeAlienRevealConfirmationOverlay,
    confirmAlienRevealNotice,
    isAlienTraceBoardPlacementMode,
    isAlienTracePlacementMode,
    isAlienTracePlacementSlotAllowed,
    clearAlienTracePlacementMode,
    shouldShowStateTraceSlots,
    isJiuzheTracePlacementMode,
    isYichangdianTracePlacementMode,
    isFangzhouTracePlacementMode,
    isBanrenmaTracePlacementMode,
    isChongTracePlacementMode,
    isAmibaTracePlacementMode,
    isAomomoTracePlacementMode,
    isRunezuTracePlacementMode,
    getAlienTracePickerPlayer: getAlienTracePickerPlayerForRoot,
    canPlaceJiuzheTrace: canPlaceJiuzheTraceForRoot,
    canPlaceYichangdianTrace: canPlaceYichangdianTraceForRoot,
    canPlaceFangzhouTrace: canPlaceFangzhouTraceForRoot,
    canPlaceBanrenmaTrace: canPlaceBanrenmaTraceForRoot,
    canPlaceChongTrace: canPlaceChongTraceForRoot,
    canPlaceAmibaTrace: canPlaceAmibaTraceForRoot,
    canPlaceAomomoTrace: canPlaceAomomoTraceForRoot,
    canPlaceRunezuTrace: canPlaceRunezuTraceForRoot,
    canPlaceRunezuFaceSymbol: canPlaceRunezuFaceSymbolForRoot,
    canPlaceStateTrace: canPlaceStateTraceForRoot,
    canPlaceAnyStateExtraTrace: canPlaceAnyStateExtraTraceForRoot,
    closeAlienTracePicker,
    openAlienTracePicker: openAlienTracePickerForRoot,
    beginAlienTraceBoardPlacement: beginAlienTraceBoardPlacementForRoot,
    beginJiuzheTraceGridPlacement: beginJiuzheTraceGridPlacementForRoot,
    beginYichangdianTraceGridPlacement: beginYichangdianTraceGridPlacementForRoot,
    beginFangzhouTraceGridPlacement: beginFangzhouTraceGridPlacementForRoot,
    beginBanrenmaTraceGridPlacement: beginBanrenmaTraceGridPlacementForRoot,
    beginAomomoTraceGridPlacement: beginAomomoTraceGridPlacementForRoot,
    beginChongTraceGridPlacement: beginChongTraceGridPlacementForRoot,
    beginAmibaTraceGridPlacement: beginAmibaTraceGridPlacementForRoot,
    beginRunezuTraceGridPlacement: beginRunezuTraceGridPlacementForRoot,
    renderAlienTracePickerColorStep: renderAlienTracePickerColorStepForRoot,
    openFangzhouTraceUseChoice: openFangzhouTraceUseChoiceForRoot,
    openFangzhouTraceDestinationChoice: openFangzhouTraceDestinationChoiceForRoot,
    handleFangzhouTraceDestinationChoice: handleFangzhouTraceDestinationChoiceForRoot,
    handleFangzhouUnlockTraceChoice: handleFangzhouUnlockTraceChoiceForRoot,
    routeFangzhouAlienTraceGain: routeFangzhouAlienTraceGainForRoot,
    handleStateTraceSlotPlacement: handleStateTraceSlotPlacementForRoot,
    handleFangzhouTraceSlotPlacement: handleFangzhouTraceSlotPlacementForRoot,
    getEligibleAlienSlotIdsForTraceEffect: getEligibleAlienSlotIdsForTraceEffectForRoot,
    getAlienTraceChoiceSlotIds,
    getFangzhouUnlockableTraceTypes: getFangzhouUnlockableTraceTypesForRoot,
    hasAlienTracePanelPlacementTarget: hasAlienTracePanelPlacementTargetForRoot,
    isAlienTracePickerChoiceAllowed,
  } = alienUiHelpers;
  const buildAlienRevealNoticeEntry = (...args) => callBrowserDomainCommand("alien_ui", "buildAlienRevealNoticeEntry", args);
  const getAlienTracePickerPlayer = (...args) => callBrowserDomainCommand("alien_ui", "getAlienTracePickerPlayer", args);
  const canPlaceJiuzheTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceJiuzheTrace", args);
  const canPlaceYichangdianTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceYichangdianTrace", args);
  const canPlaceFangzhouTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceFangzhouTrace", args);
  const canPlaceBanrenmaTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceBanrenmaTrace", args);
  const canPlaceChongTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceChongTrace", args);
  const canPlaceAmibaTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceAmibaTrace", args);
  const canPlaceAomomoTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceAomomoTrace", args);
  const canPlaceRunezuTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceRunezuTrace", args);
  const canPlaceRunezuFaceSymbol = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceRunezuFaceSymbol", args);
  const canPlaceStateTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceStateTrace", args);
  const canPlaceAnyStateExtraTrace = (...args) => callBrowserDomainCommand("alien_ui", "canPlaceAnyStateExtraTrace", args);
  const openAlienTracePicker = (...args) => callBrowserDomainCommand("alien_ui", "openAlienTracePicker", args);
  const beginAlienTraceBoardPlacement = (...args) => callBrowserDomainCommand("alien_ui", "beginAlienTraceBoardPlacement", args);
  const beginJiuzheTraceGridPlacement = (...args) => callBrowserDomainCommand("alien_ui", "beginJiuzheTraceGridPlacement", args);
  const beginYichangdianTraceGridPlacement = (...args) => callBrowserDomainCommand("alien_ui", "beginYichangdianTraceGridPlacement", args);
  const beginFangzhouTraceGridPlacement = (...args) => callBrowserDomainCommand("alien_ui", "beginFangzhouTraceGridPlacement", args);
  const beginBanrenmaTraceGridPlacement = (...args) => callBrowserDomainCommand("alien_ui", "beginBanrenmaTraceGridPlacement", args);
  const beginAomomoTraceGridPlacement = (...args) => callBrowserDomainCommand("alien_ui", "beginAomomoTraceGridPlacement", args);
  const beginChongTraceGridPlacement = (...args) => callBrowserDomainCommand("alien_ui", "beginChongTraceGridPlacement", args);
  const beginAmibaTraceGridPlacement = (...args) => callBrowserDomainCommand("alien_ui", "beginAmibaTraceGridPlacement", args);
  const beginRunezuTraceGridPlacement = (...args) => callBrowserDomainCommand("alien_ui", "beginRunezuTraceGridPlacement", args);
  const renderAlienTracePickerColorStep = (...args) => callBrowserDomainCommand("alien_ui", "renderAlienTracePickerColorStep", args);
  const openFangzhouTraceUseChoice = (...args) => callBrowserDomainCommand("alien_ui", "openFangzhouTraceUseChoice", args);
  const openFangzhouTraceDestinationChoice = (...args) => callBrowserDomainCommand("alien_ui", "openFangzhouTraceDestinationChoice", args);
  const handleFangzhouTraceDestinationChoice = (...args) => callBrowserDomainCommand("alien_ui", "handleFangzhouTraceDestinationChoice", args);
  const handleFangzhouUnlockTraceChoice = (...args) => callBrowserDomainCommand("alien_ui", "handleFangzhouUnlockTraceChoice", args);
  const routeFangzhouAlienTraceGain = (...args) => callBrowserDomainCommand("alien_ui", "routeFangzhouAlienTraceGain", args);
  const handleStateTraceSlotPlacement = (...args) => callBrowserDomainCommand("alien_ui", "handleStateTraceSlotPlacement", args);
  const handleFangzhouTraceSlotPlacement = (...args) => callBrowserDomainCommand("alien_ui", "handleFangzhouTraceSlotPlacement", args);
  const getEligibleAlienSlotIdsForTraceEffect = (...args) => callBrowserDomainCommand("alien_ui", "getEligibleAlienSlotIdsForTraceEffect", args);
  const getFangzhouUnlockableTraceTypes = (...args) => callBrowserDomainCommand("alien_ui", "getFangzhouUnlockableTraceTypes", args);
  const hasAlienTracePanelPlacementTarget = (...args) => callBrowserDomainCommand("alien_ui", "hasAlienTracePanelPlacementTarget", args);
  const alienRuntimeHelpers = alienRuntimeModule.createAlienRuntimeHelpers({
    decisionSessions,
    structuredClone,
    aliens,
    players,
    data,
    cardEffects,
    historyCommands,
    jiuzhe,
    yichangdian,
    fangzhou,
    banrenma,
    chong,
    amiba,
    aomomo,
    runezu,
    HISTORY_SOURCE_MAIN,
    getCurrentPlayer,
    getActivePlayers,
    getPlayerById,
    getPlayerByColor,
    getPlayerActionLabel,
    resolvePlayerReference,
    getEarthSectorCoordinate,
    isDebugAlienTraceMode,
    isAlienTracePickerChoiceAllowed,
    getAvailableDataTokenCount,
    renderAlienPanels,
    renderPlayerStats,
    renderPlayerHand,
    renderReservedCards,
    renderRockets,
    renderStateReadout,
    renderWheels,
    renderSectorNebulaDataBoard,
    renderFangzhouCardDisplays,
    updateActionButtons,
    closeAlienTracePicker,
    clearAlienTracePlacementMode,
    maybeRevealAlienAfterTrace,
    createActionLogImpactSnapshot,
    beginEffectHistoryStep,
    recordHistoryCommand,
    getCurrentActionEffect,
    completeCurrentActionEffect,
    beginQuickActionStep,
    recordQuickHistoryCommand,
    completeQuickActionStep,
    settleCardTasksAfterEffect: (...args) => settleCardTasksAfterEffect(...args),
    maybeContinueAlienRevealQueuedOpportunities,
    maybeContinuePendingTurnEndRevealFlow,
    markCurrentActionIrreversible,
    appendActionLogStep,
    queueJiuzheOpportunitiesForPlayer,
    queueBanrenmaOpportunitiesForPlayer,
    recordAlienTraceScore,
    formatPlanetRewardGain,
    appendRevealCardGrantMessage,
    getRevealIrreversible,
    buildAlienTraceEvent: (...args) => buildAlienTraceEvent?.(...args),
    maybeRestoreAlienLabPanelForTrace: (...args) => maybeRestoreAlienLabPanelForTrace?.(...args),
    beginCardSelection: (...args) => beginCardSelection(...args),
    enqueueFangzhouCard1RewardEffects,
    applyYichangdianRewardToPlayer,
    applyFangzhouTraceRewardToPlayer,
    getAlienTraceScoreSourceKey,
    applyBanrenmaRewardToPlayer,
    applyAomomoRewardToPlayer,
    applyChongRewardToPlayer,
    applyAmibaRewardToPlayer,
    applyRunezuRewardToPlayer,
    applyJiuzheRewardToPlayer,
    openYichangdianCardGainDialog,
    openBanrenmaCardGainDialog,
    openAomomoCardGainDialog,
    openChongRewardFollowUps,
    openAmibaRewardFollowUps,
    openRunezuRewardFollowUps,
    isJiuzheTracePlacementMode,
    isYichangdianTracePlacementMode,
    isFangzhouTracePlacementMode,
    isBanrenmaTracePlacementMode,
    isChongTracePlacementMode,
    isAmibaTracePlacementMode,
    isAomomoTracePlacementMode,
    isRunezuTracePlacementMode,
    canPlaceJiuzheTrace: (workingRoot, ...args) => canPlaceJiuzheTraceForRoot(workingRoot, ...args),
    canPlaceYichangdianTrace: (workingRoot, ...args) => canPlaceYichangdianTraceForRoot(workingRoot, ...args),
    canPlaceFangzhouTrace: (workingRoot, ...args) => canPlaceFangzhouTraceForRoot(workingRoot, ...args),
    canPlaceBanrenmaTrace: (workingRoot, ...args) => canPlaceBanrenmaTraceForRoot(workingRoot, ...args),
    canPlaceChongTrace: (workingRoot, ...args) => canPlaceChongTraceForRoot(workingRoot, ...args),
    canPlaceAmibaTrace: (workingRoot, ...args) => canPlaceAmibaTraceForRoot(workingRoot, ...args),
    canPlaceAomomoTrace: (workingRoot, ...args) => canPlaceAomomoTraceForRoot(workingRoot, ...args),
    canPlaceRunezuTrace: (workingRoot, ...args) => canPlaceRunezuTraceForRoot(workingRoot, ...args),
  });
  const {
    handleJiuzheRevealSideEffects: handleJiuzheRevealSideEffectsForRoot,
    handleYichangdianRevealSideEffects: handleYichangdianRevealSideEffectsForRoot,
    handleFangzhouRevealSideEffects: handleFangzhouRevealSideEffectsForRoot,
    handleBanrenmaRevealSideEffects: handleBanrenmaRevealSideEffectsForRoot,
    handleChongRevealSideEffects: handleChongRevealSideEffectsForRoot,
    handleAmibaRevealSideEffects: handleAmibaRevealSideEffectsForRoot,
    handleAomomoRevealSideEffects: handleAomomoRevealSideEffectsForRoot,
    handleRunezuRevealSideEffects: handleRunezuRevealSideEffectsForRoot,
    handleAlienRevealSideEffects: handleAlienRevealSideEffectsForRoot,
    failMissingAlienTraceTargetPlayer: failMissingAlienTraceTargetPlayerForRoot,
    getAlienTraceActionPlayer: getAlienTraceActionPlayerForRoot,
    confirmYichangdianTracePlacement: confirmYichangdianTracePlacementForRoot,
    confirmBanrenmaTracePlacement: confirmBanrenmaTracePlacementForRoot,
    confirmAomomoTracePlacement: confirmAomomoTracePlacementForRoot,
    confirmChongTracePlacement: confirmChongTracePlacementForRoot,
    confirmAmibaTracePlacement: confirmAmibaTracePlacementForRoot,
    confirmRunezuTracePlacement: confirmRunezuTracePlacementForRoot,
    confirmJiuzheTracePlacement: confirmJiuzheTracePlacementForRoot,
    settleTurnEndAlienRevealEntries: settleTurnEndAlienRevealEntriesForRoot,
    activateAomomoBoard: activateAomomoBoardForRoot,
  } = alienRuntimeHelpers;
  const handleJiuzheRevealSideEffects = bindBrowserDomainCommand("alien_runtime", "handleJiuzheRevealSideEffects");
  const handleYichangdianRevealSideEffects = bindBrowserDomainCommand("alien_runtime", "handleYichangdianRevealSideEffects");
  const handleFangzhouRevealSideEffects = bindBrowserDomainCommand("alien_runtime", "handleFangzhouRevealSideEffects");
  const handleBanrenmaRevealSideEffects = bindBrowserDomainCommand("alien_runtime", "handleBanrenmaRevealSideEffects");
  const handleChongRevealSideEffects = bindBrowserDomainCommand("alien_runtime", "handleChongRevealSideEffects");
  const handleAmibaRevealSideEffects = bindBrowserDomainCommand("alien_runtime", "handleAmibaRevealSideEffects");
  const handleAomomoRevealSideEffects = bindBrowserDomainCommand("alien_runtime", "handleAomomoRevealSideEffects");
  const handleRunezuRevealSideEffects = bindBrowserDomainCommand("alien_runtime", "handleRunezuRevealSideEffects");
  const handleAlienRevealSideEffects = bindBrowserDomainCommand("alien_runtime", "handleAlienRevealSideEffects");
  const failMissingAlienTraceTargetPlayer = bindBrowserDomainCommand("alien_runtime", "failMissingAlienTraceTargetPlayer");
  const getAlienTraceActionPlayer = bindBrowserDomainCommand("alien_runtime", "getAlienTraceActionPlayer");
  const confirmYichangdianTracePlacement = bindBrowserDomainCommand("alien_runtime", "confirmYichangdianTracePlacement");
  const confirmBanrenmaTracePlacement = bindBrowserDomainCommand("alien_runtime", "confirmBanrenmaTracePlacement");
  const confirmAomomoTracePlacement = bindBrowserDomainCommand("alien_runtime", "confirmAomomoTracePlacement");
  const confirmChongTracePlacement = bindBrowserDomainCommand("alien_runtime", "confirmChongTracePlacement");
  const confirmAmibaTracePlacement = bindBrowserDomainCommand("alien_runtime", "confirmAmibaTracePlacement");
  const confirmRunezuTracePlacement = bindBrowserDomainCommand("alien_runtime", "confirmRunezuTracePlacement");
  const confirmJiuzheTracePlacement = bindBrowserDomainCommand("alien_runtime", "confirmJiuzheTracePlacement");
  const settleTurnEndAlienRevealEntries = bindBrowserDomainCommand("alien_runtime", "settleTurnEndAlienRevealEntries");
  const activateAomomoBoard = bindBrowserDomainCommand("alien_runtime", "activateAomomoBoard");

  function getPlayerHandPanelTitleHint() {
    if (isDiscardSelectionActive()) {
      const remaining = cards.getDiscardRemaining(createStateSourceReadoutRoot().cardState);
      return `（请选择 ${remaining} 张弃牌）`;
    }
    if (isHandScanSelectionActive()) {
      return "（请选择一张牌进行扫描）";
    }
    if (isMovePaymentSelectionActive() && !isMovePaymentLockedForAiAutomation()) {
      const required = getPendingMovePayment()?.requiredMovePoints || MOVE_ENERGY_COST;
      return required > 1
        ? `（需 ${required} 点移动力：可选移动牌，剩余用能量补齐）`
        : "（可选移动牌弃置，或直接确认消耗 1 能量）";
    }
    if (isPlayCardSelectionActive()) {
      const pending = getPendingPlayCardSelection();
      return pending
        ? `（已选择 ${cards.getCardLabel(pending.card)}）`
        : "（请选择要打出的牌）";
    }
    const cornerAction = getPendingCardCornerQuickAction();
    const handPlayAction = getPendingHandCardPlayAction();
    const selectedHandAction = cornerAction || handPlayAction;
    if (selectedHandAction) {
      return `（已选择 ${cards.getCardLabel(selectedHandAction.card)}）`;
    }
    return "";
  }

  function updatePlayerHandPanelTitle() {
    if (!els.playerHandPanelTitle) return;

    const player = getInterfacePlayer();
    const count = Array.isArray(player?.hand)
      ? player.hand.length
      : Math.max(0, Math.round(Number(player?.resources?.handSize) || 0));

    if (els.playerHandPanelHandCount) {
      els.playerHandPanelHandCount.textContent = String(count);
      els.playerHandPanelHandCount.classList.toggle("is-over-limit", count > 4);
      els.playerHandPanelHandCount.setAttribute("aria-label", `当前手牌 ${count} 张`);
    }
    if (els.playerHandPanelTitleHint) {
      els.playerHandPanelTitleHint.textContent = getPlayerHandPanelTitleHint();
    }
  }

  function getPublicCardHeight() {
    const row = els.publicCardRow;
    if (!row) return null;

    const fromVar = getComputedStyle(row).getPropertyValue("--public-card-height").trim();
    if (fromVar) {
      const parsed = Number.parseFloat(fromVar);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    const reference = row.querySelector(".public-card");
    if (!reference) return null;
    const height = reference.getBoundingClientRect().height;
    return height > 0 ? height : null;
  }

  function initializeCardGame(workingRoot, handCount = DEFAULT_INITIAL_HAND_COUNT) {
    const { cardState: workingCardState, playerState: workingPlayerState, turnState: workingTurnState } = workingRoot;
    if (!Array.isArray(workingPlayerState.players) || !workingPlayerState.players.length) return;

    for (const player of workingPlayerState.players) {
      player.hand = [];
      player.reservedCards = [];
      player.completedTaskCount = 0;
      player.resources.handSize = 0;
    }
    workingCardState.publicCards = Array.from({ length: cards.PUBLIC_CARD_COUNT }, () => null);
    workingCardState.discardPile = [];
    workingCardState.drawPileCardIds = [];
    cards.setSelectionActive(workingCardState, false);
    cards.setPlayCardSelectionActive(workingCardState, false);
    cards.setDiscardSelectionActive(workingCardState, false, 0);
    const activeIds = new Set(workingTurnState.activePlayerIds || []);
    for (const player of workingPlayerState.players.filter((candidate) => activeIds.has(candidate.id))) {
      cards.drawCardsToHand(workingCardState, workingPlayerState, player, handCount);
    }
    ensurePublicCardsFilledRespectingDelayedRefillsForRoot(workingRoot);
    preparePassReservePilesForCurrentGame(workingRoot);
  }

  function preparePassReservePilesForCurrentGame(workingRoot, options = {}) {
    return cards.preparePassReservePiles(workingRoot.cardState, workingRoot.playerState, {
      rounds: PASS_RESERVE_ROUNDS,
      activePlayerCount: workingRoot.turnState.activePlayerCount || DEFAULT_ACTIVE_PLAYER_COUNT,
      random: options.random || Math.random,
    });
  }

  const turnFlowController = turnFlowModule.createTurnFlowController({
    players,
    uiRuntimeState,
    setupSelectionState,
    cards,
    industry,
    finalScoring,
    solar,
    data,
    aliens,
    rocketActions,
    planetStats,
    tech,
    cardTaskStateModule,
    ruleLifecycle: browserRuleLifecycle,
    clearTransientStateForRecovery,
    restoreMutableObject,
    createTurnState,
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
    cancelIndustryAbilityFlow: (...args) => cancelIndustryAbilityFlow?.(...args),
    closeFinalResultDialog,
    preparePassReservePilesForCurrentGame,
    initializeCardGame,
    configureDefaultAiOpponent: (...args) => configureDefaultAiOpponent(...args),
    startInitialSelection,
    renderStateReadout,
    resize,
    clearPersistentGameState,
    schedulePersistentGameStateSave,
    seedDefaultReferenceRockets,
    computePlayerFinalScoreBreakdown: (workingRoot, player) => (
      computePlayerFinalScoreBreakdown(player, workingRoot)
    ),
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    defaultInitialPlayerColor: DEFAULT_INITIAL_PLAYER_COLOR,
    defaultInitialHandCount: DEFAULT_INITIAL_HAND_COUNT,
    finalRoundNumber: FINAL_ROUND_NUMBER,
    finalScoreIds: FINAL_SCORE_IDS,
    aomomoClearNebulaId: aomomo?.NEBULA_ID || null,
    normalizeAiDifficulty(value) {
      return startScreenModule.normalizeAiDifficulty(value, {
        weakStartValue: AI_DIFFICULTY_WEAK_START,
        defaultValue: AI_DIFFICULTY_LAUGHABLE,
      });
    },
    startScreenState,
    historyStepOrder,
    cardTaskState,
    els,
    setPersistentGameSaveSuspended(value) {
      persistentGameSaveSuspended = Boolean(value);
    },
  });
  const startScreenController = startScreenModule.createStartScreenController({
    startScreenState,
    els,
    actionLogState,
    alienTypeIds: aliens.ALIEN_TYPE_IDS || [],
    minAlienRevealPoolSize: aliens.MIN_ALIEN_REVEAL_POOL_SIZE || 2,
    industryCardFiles: INDUSTRY_CARD_FILES,
    minIndustryPoolSize: MIN_START_INDUSTRY_POOL_SIZE,
    continueEnabled: START_SCREEN_CONTINUE_ENABLED,
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    aiDifficultyWeakStart: AI_DIFFICULTY_WEAK_START,
    aiDifficultyDefault: AI_DIFFICULTY_LAUGHABLE,
    hasPersistentGameState,
    restorePersistentGameState,
    refreshAfterGameRecovery,
    schedulePersistentGameStateSave,
    closeActionBriefing,
    setDebugOpen,
    setReportTab,
    resize,
    setLogOpen,
    startNewGame,
  });
  actionRuntimeController = actionRuntimeModule.createActionRuntime({
    decisionSessions,
    setupSelectionState,
    startScreenState,
    actionLogState,
    INITIAL_SELECTION_REQUIRED,
    INITIAL_CARD_COUNT,
    INITIAL_SELECTION_CARD_SIZE,
    MIN_START_INDUSTRY_POOL_SIZE,
    INITIAL_SELECTION_INDUSTRY_OPTION_COUNT,
    INDUSTRY_CARD_FILES,
    HISTORY_SOURCE_SETUP,
    ACTION_LOG_DEFAULT_LABELS,
    stripAssetExtension,
    shuffleList,
    getCurrentPlayer,
    getPlayerById,
    getPlayerLabelById,
    ensurePublicCardsFilledRespectingDelayedRefills: (...args) => ensurePublicCardsFilledRespectingDelayedRefills(...args),
    renderReservedCards,
    renderPublicCards: (...args) => renderPublicCards(...args),
    renderDebugPlayerSwitch,
    renderPlayerStats,
    renderPlayerHand,
    renderTechBoard: (...args) => renderTechBoard?.(...args),
    renderSectorNebulaDataBoard,
    syncPlanetOrbitLandMarkers,
    renderAlienPanels,
    renderRockets,
    syncInteractionFocusChrome,
    updateActionButtons,
    renderStateReadout,
    schedulePersistentGameStateSave,
    resolveInitialSelectionEffects,
    applyIndustryRoundStartBonuses: (workingRoot, ...args) => (
      applyIndustryRoundStartBonusesForRoot?.(workingRoot, ...args)
    ),
    startInitialIncomeEffectFlow,
    applyIndustryStartupPassives,
    appendConfirmedActionLogEntry,
    isInitialIncomeFlowActive,
    renderActionLog,
    refreshLatestActionLogRecoverySnapshot,
    scrollToPlayerCommandPanel,
    normalizeActionLogText,
    industry,
    canStartMainAction,
    getMainActionStartBlockReason,
    getAnalyzeActionOptionsForPlayer,
    createActionLogImpactSnapshot,
    abilities,
    createActionContext: createActionContextForWorkingRoot,
    primaryBoardActionExecutor,
    engineActionExecutor,
    quickTurnActionExecutor,
    conditionalActionExecutor,
    actions,
    removeRocketElement: headlessMode ? () => {} : removeRocketElement,
    syncPlanetOrbitLandMarkersAfterAction: headlessMode ? () => {} : syncPlanetOrbitLandMarkers,
    startPlanetRewardEffectFlow,
    startLaunchSectorFinishEffectFlow: (...args) => startLaunchSectorFinishEffectFlow?.(...args),
    settleCardTasksAfterEffect: (...args) => settleCardTasksAfterEffect(...args),
    maybeAutoExecuteAomomoRewardEffects,
    startResearchTechEffectFlow,
    syncTechSelectionChrome: (...args) => syncTechSelectionChrome?.(...args),
    finalizeTechTakeResult: (...args) => finalizeTechTakeResult?.(...args),
    renderRocketElement,
    recordAtomicActionHistory,
    startAnalyzeDataRewardFlow,
    executeActionEffect,
    getCurrentActionEffect,
    maybeApplyIndustryLaunchScan: (...args) => maybeApplyIndustryLaunchScan?.(...args),
    maybeConsumeAlienLabPanelForMainAction: (...args) => maybeConsumeAlienLabPanelForMainAction?.(...args),
    markActionPending,
    beginScanAction: (...args) => beginScanAction(...args),
    beginPlayCardSelection: (...args) => beginPlayCardSelection(...args),
    researchTechForCurrentPlayer: (...args) => researchTechForCurrentPlayer(...args),
    orbitForCurrentPlayer: (...args) => orbitForCurrentPlayer(...args),
    landForCurrentPlayer: (...args) => landForCurrentPlayer(...args),
    moveRocket: (...args) => moveRocket(...args),
    analyzeDataForCurrentPlayer: (...args) => analyzeDataForCurrentPlayer(...args),
    passForCurrentPlayer: (...args) => passForCurrentPlayer(...args),
    endCurrentTurn: (...args) => endCurrentTurn(...args),
    blockManualAiPendingInputIfNeeded,
    getCurrentActionEffectIndex: () => decisionState.actionEffectFlow?.currentIndex,
    runQuickTrade,
    confirmDataPlacement,
    standardActionAdapter: actions.createStandardAdapter({
      stage2Actions: {
        scan: {
          label: "扫描",
          getOptions(context) {
            const player = players.getCurrentPlayer(context.playerState);
            const check = canStartMainAction()
              ? scanEffects.canExecuteScan(player, { standardAction: true })
              : { ok: false, message: getMainActionStartBlockReason() };
            return check.ok ? { ok: true, choices: [{ target: { kind: "standard-scan" }, label: "扫描" }] } : check;
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "ENGINE_ACTION_EXECUTOR_REQUIRED" }; },
        },
        analyze: {
          label: "分析",
          getOptions(context) {
            const player = players.getCurrentPlayer(context.playerState);
            const check = canStartMainAction() ? canAnalyzeDataForPlayer(player) : { ok: false, message: getMainActionStartBlockReason() };
            return check.ok ? { ok: true, choices: [{ target: { kind: "computer", requiredSlot: data.ANALYZE_REQUIRED_COMPUTER_SLOT }, payload: getAnalyzeActionOptionsForPlayer(player), label: "分析" }] } : check;
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "ENGINE_ACTION_EXECUTOR_REQUIRED" }; },
        },
        playCard: {
          label: "打牌",
          getOptions(context) {
            if (!canStartMainAction()) return { ok: false, message: getMainActionStartBlockReason() };
            const player = players.getCurrentPlayer(context.playerState);
            const choices = (player?.hand || []).map((card, handIndex) => ({ card, handIndex, cost: getCardPlayCost(card) }))
              .filter(({ cost }) => players.canAfford(player, cost))
              .map(({ card, handIndex, cost }) => ({ target: { cardInstanceId: card.id }, payload: { cost, handIndex }, label: cards.getCardLabel(card) }));
            return choices.length ? { ok: true, choices } : { ok: false, message: "没有可支付的手牌" };
          },
          canExecute(context, option) {
            const choices = this.getOptions(context);
            return choices.ok && choices.choices.some((choice) => choice.target.cardInstanceId === option.target?.cardInstanceId)
              ? { ok: true }
              : { ok: false, message: "手牌身份或费用已失效" };
          },
          execute() { return { ok: false, code: "ENGINE_ACTION_EXECUTOR_REQUIRED" }; },
        },
        pass: {
          label: "PASS",
          getOptions() { return canStartMainAction() ? { ok: true, choices: [{ target: { kind: "pass" }, label: "PASS" }] } : { ok: false, message: getMainActionStartBlockReason() }; },
          canExecute() { return this.getOptions(); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
      },
      stage3Actions: {
        move: {
          label: "移动",
          getOptions(context) {
            if (hasActivePendingSubFlow()) return { ok: false, message: "请先完成当前选择" };
            const player = players.getCurrentPlayer(context.playerState);
            const directions = [
              { id: "out", deltaX: 0, deltaY: 1 },
              { id: "cw", deltaX: 1, deltaY: 0 },
              { id: "ccw", deltaX: -1, deltaY: 0 },
              { id: "in", deltaX: 0, deltaY: -1 },
            ];
            const choices = (getMovableTokensForPlayer(player?.id) || []).flatMap((rocket) => directions
              .map((direction) => ({
                rocket,
                direction,
                requiredMovePoints: getRequiredMovePointsForUi(player, rocket.id, direction.deltaX, direction.deltaY),
              }))
              .filter(({ rocket, direction, requiredMovePoints }) => (
                rocketActions.canMoveRocket(context.rocketState, rocket.id, direction.deltaX, direction.deltaY).ok
                && canPayForMove(player, requiredMovePoints).ok
              ))
              .map(({ rocket, direction, requiredMovePoints }) => ({
                target: { rocketId: rocket.id, deltaX: direction.deltaX, deltaY: direction.deltaY },
                payload: { requiredMovePoints },
                label: `移动火箭 ${rocket.id} ${direction.id}`,
              })));
            return choices.length ? { ok: true, choices } : { ok: false, message: "没有合法移动目标" };
          },
          canExecute(context) { return this.getOptions(context); },
          execute(_context, option) {
            return moveRocket(option.target.deltaX, option.target.deltaY, option.target.rocketId, { automated: true });
          },
        },
        quickTrade: {
          label: "快速交易",
          getOptions(context) {
            const choices = quickTrades.TRADE_ACTIONS
              .filter((trade) => quickTrades.canExecuteTrade(trade.id, context).ok)
              .map((trade) => ({
                target: { tradeId: trade.id },
                payload: { cost: trade.cost, gain: trade.gain },
                label: trade.label,
              }));
            return choices.length ? { ok: true, choices } : { ok: false, message: "没有可执行的快速交易" };
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
        industry: {
          label: "公司 1x",
          getOptions(context) {
            const player = players.getCurrentPlayer(context.playerState);
            const companyCard = player?.initialSelection?.industry || null;
            const layout = industry.getIndustryActionMarkerLayout?.(companyCard);
            const markCheck = industry.canMarkIndustryAction?.(player, context.turnState.roundNumber, {
              turnNumber: context.turnState.turnNumber,
              hasMarker: Boolean(layout),
              industryCard: companyCard,
              requireIndustryCard: true,
            });
            const abilityCheck = industry.canStartActiveAbility?.(player, companyCard?.label);
            if (!markCheck?.ok || !abilityCheck?.ok) return markCheck?.ok ? abilityCheck : markCheck;
            return { ok: true, choices: [{ target: { companyLabel: companyCard.label }, label: companyCard.label }] };
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
        cardCorner: {
          label: "弃牌角标",
          getOptions(context) {
            if (!canUseCardCornerQuickAction()) return { ok: false, message: "当前无法使用卡牌快速行动" };
            const player = players.getCurrentPlayer(context.playerState);
            const choices = (player?.hand || []).map((card, handIndex) => ({ card, handIndex, action: getCardCornerQuickActionForCard(card) }))
              .filter(({ action }) => Boolean(action))
              .filter(({ action }) => action.actionKind !== "move"
                || shouldQueueCardCornerMoveQuickAction(action, player)
                || canStartCardCornerFreeMove().ok)
              .map(({ card, handIndex, action }) => ({
                target: { cardInstanceId: card.id },
                payload: { handIndex, actionKind: action.actionKind, symbolId: action.symbolId || null },
                label: action.label,
              }));
            return choices.length ? { ok: true, choices } : { ok: false, message: "没有可用弃牌角标" };
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
        placeData: {
          label: "放置数据",
          getOptions(context) {
            const player = players.getCurrentPlayer(context.playerState);
            const result = abilities.data.listPlacementChoices(player);
            const choices = (result.choices || []).map((choice) => ({
              target: { target: choice.target, blueSlot: choice.blueSlot ?? null },
              label: choice.label || "放置数据",
            }));
            return result.ok && choices.length ? { ok: true, choices } : { ok: false, message: result.message || "没有数据放置目标" };
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
        runezuFaceSymbol: {
          label: "符文族面部符号",
          getOptions(context) {
            const player = players.getCurrentPlayer(context.playerState);
            const choices = (aliens.ALIEN_SLOT_IDS || []).flatMap((alienSlotId) => (
              runezu.isRunezuRevealedSlot(context.alienGameState, alienSlotId)
                ? (runezu.FACE_SYMBOL_POSITIONS || []).flatMap((position) => {
                  const check = runezu.canPlaceFaceSymbol(context.alienGameState, position, player);
                  return (check.ok ? check.choices : []).map((choice) => ({
                    target: { alienSlotId: Number(alienSlotId), position: Number(position), symbolId: choice.symbolId },
                    label: `${runezu.formatSymbolLabel(choice.symbolId)} → ${position}`,
                  }));
                })
                : []
            ));
            return choices.length ? { ok: true, choices } : { ok: false, message: "没有可放置的符文族面部符号" };
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
        endTurn: {
          label: "结束回合",
          getOptions() {
            const legal = isActionPending() && !isActionEffectFlowActive() && !hasActivePendingSubFlow();
            return legal
              ? { ok: true, choices: [{ target: { kind: "end-turn" }, label: "结束回合" }] }
              : { ok: false, message: "主行动未完成或仍有待决选择" };
          },
          canExecute() { return this.getOptions(); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
      },
      stage4Actions: Object.fromEntries(
        actions.standardAction.CONDITIONAL_FAMILIES.map((family) => [
          family,
          createConditionalActionProvider(family),
        ]),
      ),
    }),
  });

  function getActiveOrderedPlayerIds() {
    return turnFlowModule.getActiveOrderedPlayerIds(createStateSourceReadoutRoot().turnState);
  }

  function getRoundOrderPlayerIds() {
    return turnFlowModule.getRoundOrderPlayerIds(createStateSourceReadoutRoot().turnState);
  }

  function syncStartScreenDebugOption() {
    return startScreenController.syncDebugOption();
  }

  function syncStartScreenActionLogOption() {
    return startScreenController.syncActionLogOption();
  }

  function syncStartScreenAlienOptions() {
    return startScreenController.syncAlienOptions();
  }

  function handleStartAlienOptionChange(event) {
    return startScreenController.handleAlienOptionChange(event);
  }

  function syncStartScreenIndustryOptions() {
    return startScreenController.syncIndustryOptions();
  }

  function handleStartIndustryOptionChange(event) {
    return startScreenController.handleIndustryOptionChange(event);
  }

  function updateStartScreenContinueButton() {
    return startScreenController.updateContinueButton();
  }

  function setDebugToolsEnabled(enabled) {
    return startScreenController.setDebugToolsEnabled(enabled);
  }

  function applyStartScreenOptions() {
    return startScreenController.applyOptions();
  }

  function closeStartScreen() {
    return startScreenController.closeStartScreen();
  }

  function startNewGameFromStartScreen() {
    return startScreenController.startNewGameFromStartScreen();
  }

  function continueGameFromStartScreen() {
    return startScreenController.continueGameFromStartScreen();
  }

  function setTurnStatePlayerOrder(playerIds, options = {}) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "turn_set_player_order",
      playerIds,
      options,
    });
  }

  function randomizePlayerTurnOrder() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "turn_randomize_player_order" });
  }

  function beginNextRound() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "turn_begin_next_round" });
  }

  function getDisplayedTurnNumber(rawTurnNumber = null) {
    const root = createStateSourceReadoutRoot();
    return turnFlowController.getDisplayedTurnNumber(root, rawTurnNumber ?? root.turnState.turnNumber);
  }

  function getActionCycleNumber() {
    return turnFlowController.getActionCycleNumber(createStateSourceReadoutRoot());
  }

  function advanceTurnAfterPlayerAction(playerId, options = {}) {
    if (options.workingRoot) {
      const workingRoot = options.workingRoot;
      const operationOptions = { ...options };
      delete operationOptions.workingRoot;
      return turnFlowController.advanceTurnAfterPlayerAction(workingRoot, playerId, operationOptions);
    }
    const operationOptions = { ...options };
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "turn_advance_after_action",
      playerId,
      options: operationOptions,
    });
  }

  function startNewGame(options = {}) {
    const activePlayerCount = Math.min(
      Math.max(1, Math.round(Number(options.activePlayerCount) || DEFAULT_ACTIVE_PLAYER_COUNT)),
      players.PLAYER_COLOR_IDS.length,
    );
    const resetResult = browserRuleLifecycle.newGame({
      activePlayerCount,
      defaultInitialPlayerColor: DEFAULT_INITIAL_PLAYER_COLOR,
      finalScoreIds: FINAL_SCORE_IDS,
    });
    if (!resetResult.ok) return resetResult;
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "turn_start_new_game",
      options: { ...options, activePlayerCount, compositionStatePrepared: true },
    });
  }

  function randomizeAll() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "turn_randomize_all" });
  }

  function normalizeAiDifficulty(value) {
    return startScreenModule.normalizeAiDifficulty(value, {
      weakStartValue: AI_DIFFICULTY_WEAK_START,
      defaultValue: AI_DIFFICULTY_LAUGHABLE,
    });
  }

  function stripAssetExtension(fileName) {
    return String(fileName || "").replace(/\.[^.]+$/, "");
  }

  function shuffleList(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const pickIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[pickIndex]] = [result[pickIndex], result[index]];
    }
    return result;
  }

  function createIndustrySelectionCard(fileName) {
    return {
      id: `industry:${fileName}`,
      kind: "industry",
      label: stripAssetExtension(fileName),
      src: `../assets/industry/${fileName}`,
      width: INITIAL_SELECTION_CARD_SIZE.industry.width,
      height: INITIAL_SELECTION_CARD_SIZE.industry.height,
    };
  }

  function createInitialSelectionCard(index) {
    return {
      id: `initial:${index}`,
      kind: "initial",
      label: `初始牌 ${index}`,
      src: `../assets/initial_card/split/${index}.png`,
      width: INITIAL_SELECTION_CARD_SIZE.initial.width,
      height: INITIAL_SELECTION_CARD_SIZE.initial.height,
    };
  }

  function getInitialSelectionPlayerIds() {
    return actionRuntimeController.getInitialSelectionPlayerIds(createStateSourceReadoutRoot());
  }

  function isInitialSelectionActive() {
    return actionRuntimeController.isInitialSelectionActive();
  }

  function getInitialSelectionOffer(playerId = null) {
    const resolvedPlayerId = playerId ?? createStateSourceReadoutRoot().playerState.currentPlayerId;
    return actionRuntimeController.getInitialSelectionOffer(resolvedPlayerId);
  }

  function isInitialSelectionConfirmed(playerId = null) {
    const resolvedPlayerId = playerId ?? createStateSourceReadoutRoot().playerState.currentPlayerId;
    return actionRuntimeController.isInitialSelectionConfirmed(resolvedPlayerId);
  }

  function canConfirmInitialSelection(offer) {
    return actionRuntimeController.canConfirmInitialSelection(offer);
  }

  function startInitialSelection() {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "setup_start_initial_selection",
    });
  }

  function normalizeStartIndustryLabels(industryLabels) {
    const allLabels = INDUSTRY_CARD_FILES.map(stripAssetExtension);
    if (!Array.isArray(industryLabels)) return allLabels;
    const requested = new Set(industryLabels.map((label) => String(label)));
    const selectedLabels = allLabels.filter((label) => requested.has(label));
    return selectedLabels.length >= MIN_START_INDUSTRY_POOL_SIZE ? selectedLabels : allLabels;
  }

  function getSelectedStartIndustryCardFiles() {
    const selectedLabels = new Set(normalizeStartIndustryLabels(startScreenState.selectedIndustryLabels));
    return INDUSTRY_CARD_FILES.filter((fileName) => selectedLabels.has(stripAssetExtension(fileName)));
  }

  function createIndustrySelectionOffers(playerIds = []) {
    const poolFiles = getSelectedStartIndustryCardFiles();
    const requiredCount = playerIds.length * INITIAL_SELECTION_INDUSTRY_OPTION_COUNT;
    const sharedDeck = poolFiles.length >= requiredCount
      ? shuffleList(poolFiles).slice(0, requiredCount)
      : null;
    const offersByPlayerId = {};

    playerIds.forEach((playerId, index) => {
      const optionFiles = sharedDeck
        ? sharedDeck.slice(
          index * INITIAL_SELECTION_INDUSTRY_OPTION_COUNT,
          index * INITIAL_SELECTION_INDUSTRY_OPTION_COUNT + INITIAL_SELECTION_INDUSTRY_OPTION_COUNT,
        )
        : shuffleList(poolFiles).slice(0, INITIAL_SELECTION_INDUSTRY_OPTION_COUNT);
      offersByPlayerId[playerId] = optionFiles.map(createIndustrySelectionCard);
    });

    return offersByPlayerId;
  }

  function getCardFromInitialOffer(offer, kind, cardId) {
    return actionRuntimeController.getCardFromInitialOffer(offer, kind, cardId);
  }

  function getInitialEffectLogSource(result) {
    if (result?.effect?.label) return result.effect.label;
    if (result?.cardNumber) return `初始牌 ${result.cardNumber}`;
    return result?.card?.label || "初始效果";
  }

  function formatInitialEffectLogDetail(result) {
    const playerLabel = getPlayerLabelById(result?.playerId)
      || result?.playerColorLabel
      || "玩家";
    const source = getInitialEffectLogSource(result);
    const detailMessages = (result?.results || [])
      .map((entry) => normalizeActionLogText(entry?.message))
      .filter(Boolean);
    const detail = detailMessages.length
      ? detailMessages.join("；")
      : normalizeActionLogText(result?.message);
    return `${playerLabel} ${source}${detail ? `：${detail}` : ""}`;
  }

  function buildInitialEffectLogSteps(initialResult) {
    const resultEntries = Array.isArray(initialResult?.results)
      ? initialResult.results
      : [];
    if (!resultEntries.length) {
      return initialResult?.message
        ? [`结算初始效果：${initialResult.message}`]
        : [];
    }
    return resultEntries.map((result) => `结算初始效果：${formatInitialEffectLogDetail(result)}`);
  }

  function handleInitialSelectionCardClick(kind, cardId) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "setup_select_initial_card",
      selectionKind: kind,
      cardId,
    });
  }

  function recordInitialSelectionActionLog(player, selectedIndustry, selectedInitialCards, initialResult = null) {
    const initialLabels = selectedInitialCards.map((card) => card.label).filter(Boolean);
    const steps = [];
    if (selectedIndustry?.label) {
      steps.push({
        source: HISTORY_SOURCE_SETUP,
        text: `选择公司：${selectedIndustry.label}`,
      });
    }
    if (initialLabels.length) {
      steps.push({
        source: HISTORY_SOURCE_SETUP,
        text: `移出初始牌：${initialLabels.join("、")}`,
      });
    }
    for (const text of buildInitialEffectLogSteps(initialResult)) {
      steps.push({
        source: HISTORY_SOURCE_SETUP,
        text,
      });
    }
    appendConfirmedActionLogEntry({
      title: "初始选择",
      player,
      actionType: "initialSelection",
      actionLabel: "初始选择",
      steps,
    });
  }

  function confirmInitialSelectionForCurrentPlayer() {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "setup_confirm_initial_selection",
    });
  }

  function resolveInitialSelectionEffects(workingRoot) {
    if (!initialCards?.resolveInitialSelections) return null;

    const context = {
      ...createActionContextForWorkingRoot(workingRoot),
      alienGameState: workingRoot.alienGameState,
    };
    const result = initialCards.resolveInitialSelections(context, {
      playerIds: getInitialSelectionPlayerIds(),
    });
    const hasSignalMarked = (result.events || []).some((event) => event?.type === "signalMarked");
    const settleResult = hasSignalMarked
      ? resolveCompletedSectorSettlements("initialSelection", {
        markMainActionIrreversible: false,
      })
      : null;

    if (settleResult?.ok) {
      recordInitialSelectionScoreSources(result);
      return {
        ...result,
        settlement: settleResult,
        message: `${result.message}；${settleResult.message}；${settleResult.participantAwardMessage || "参与结算玩家各获得1宣传"}`,
      };
    }
    recordInitialSelectionScoreSources(result);
    return result;
  }

  function buildInitialIncomeEffectNodes(entries = []) {
    const effects = [];
    for (const entry of entries) {
      const total = Math.max(0, Math.round(Number(entry?.count) || 0));
      if (!entry?.playerId || total <= 0) continue;
      const companyLabel = entry.label || "公司牌";
      for (let sequence = 1; sequence <= total; sequence += 1) {
        effects.push({
          id: `initial-income-${entry.playerId}-${sequence}`,
          type: "initial_income",
          icon: "income",
          label: `${companyLabel}：收入增加 ${sequence}/${total}`,
          status: "pending",
          undoable: false,
          options: {
            playerId: entry.playerId,
            companyLabel,
            sequence,
            total,
          },
        });
      }
    }
    return effects;
  }

  function startInitialIncomeEffectFlow(workingRoot, entries = []) {
    const effects = buildInitialIncomeEffectNodes(entries);
    if (!effects.length) return false;

    decisionState.actionEffectFlow = abilities.chain.startAbilityChain(
      "initialIncome",
      "初始收入增加",
      effects,
    );
    decisionState.actionEffectFlow.actionType = "initialIncome";
    decisionState.actionEffectFlow.playerId = effects[0]?.options?.playerId || null;
    assignEffectFlowOwner(decisionState.actionEffectFlow, decisionState.actionEffectFlow.playerId);

    const firstPlayer = (workingRoot.playerState.players || [])
      .find((player) => player.id === decisionState.actionEffectFlow.playerId) || null;
    if (firstPlayer) {
      workingRoot.playerState.currentPlayerId = firstPlayer.id;
    }

    els.appWrap?.classList.toggle("action-effect-flow-active", true);
    workingRoot.rocketState.statusNote = "初始收入增加：请依次点击收入效果";
    renderDebugPlayerSwitch();
    renderPlayerStats();
    renderPlayerHand();
    activateNextActionEffect();
    return true;
  }

  function getCurrentInitialSelectionCards(player = getCurrentPlayer()) {
    const selection = player?.initialSelection;
    if (!selection) return [];
    return selection.industry ? [selection.industry] : [];
  }

  function getPlayerRoundOrderNumber(playerId) {
    const index = getRoundOrderPlayerIds().indexOf(playerId);
    return index >= 0 ? index + 1 : null;
  }

  function isBrowserWorkingRoot(value) {
    return Boolean(value?.playerState && value?.rocketState && value?.turnState);
  }

  function getPlayerById(workingRootOrPlayerId, explicitPlayerId = null) {
    const workingRoot = isBrowserWorkingRoot(workingRootOrPlayerId) ? workingRootOrPlayerId : null;
    const playerId = workingRoot ? explicitPlayerId : workingRootOrPlayerId;
    if (workingRoot) {
      return workingRoot.playerState.players.find((player) => player.id === playerId) || null;
    }
    return createStateSourceReadoutRoot().playerState.players
      .find((candidate) => candidate.id === playerId) || null;
  }

  function resolvePlayerReference(workingRootOrReference = {}, explicitReference = null) {
    const workingRoot = isBrowserWorkingRoot(workingRootOrReference) ? workingRootOrReference : null;
    const reference = workingRoot ? (explicitReference || {}) : workingRootOrReference;
    const playerId = reference.playerId || null;
    if (playerId) {
      const player = workingRoot ? getPlayerById(workingRoot, playerId) : getPlayerById(playerId);
      if (player) return player;
    }
    const playerColor = reference.playerColor || null;
    return playerColor
      ? (workingRoot ? getPlayerByColor(workingRoot, playerColor) : getPlayerByColor(playerColor))
      : null;
  }

  function effectHasExplicitPlayerTarget(effect) {
    const options = effect?.options || {};
    return Boolean(
      effect?.playerId
      || effect?.playerColor
      || options.playerId
      || options.playerColor
      || options.targetPlayerId
      || options.targetPlayerColor
    );
  }

  function assignEffectOwner(effect, playerId) {
    if (!effect || !playerId || effectHasExplicitPlayerTarget(effect)) return effect;
    effect.playerId = playerId;
    return effect;
  }

  function assignEffectFlowOwner(flow, playerId) {
    if (!flow || !playerId) return;
    flow.defaultPlayerId = playerId;
    flow.playerId = playerId;
    for (const effect of flow.effects || []) {
      assignEffectOwner(effect, playerId);
    }
  }

  function getExplicitEffectOwnerPlayer(workingRootOrEffect, explicitEffect = null) {
    const workingRoot = isBrowserWorkingRoot(workingRootOrEffect) ? workingRootOrEffect : null;
    const effect = workingRoot ? explicitEffect : workingRootOrEffect;
    const reference = {
      playerId: effect?.options?.targetPlayerId || effect?.playerId || effect?.options?.playerId,
      playerColor: effect?.options?.targetPlayerColor || effect?.playerColor || effect?.options?.playerColor,
    };
    return workingRoot ? resolvePlayerReference(workingRoot, reference) : resolvePlayerReference(reference);
  }

  function getEffectOwnerPlayer(workingRootOrEffect, explicitEffect = null) {
    const workingRoot = isBrowserWorkingRoot(workingRootOrEffect) ? workingRootOrEffect : null;
    const effect = workingRoot ? explicitEffect : workingRootOrEffect;
    const playerState = workingRoot?.playerState || createStateSourceReadoutRoot().playerState;
    return (workingRoot ? getExplicitEffectOwnerPlayer(workingRoot, effect) : getExplicitEffectOwnerPlayer(effect))
      || (workingRoot
        ? getPlayerById(workingRoot, decisionState.actionEffectFlow?.defaultPlayerId)
        : getPlayerById(decisionState.actionEffectFlow?.defaultPlayerId))
      || (workingRoot
        ? getPlayerById(workingRoot, decisionState.actionEffectFlow?.playerId)
        : getPlayerById(decisionState.actionEffectFlow?.playerId))
      || players.getCurrentPlayer(playerState);
  }

  function getPendingOwnerFields(workingRootOrEffect = null, explicitEffect = null, explicitPlayer = null) {
    const workingRoot = isBrowserWorkingRoot(workingRootOrEffect) ? workingRootOrEffect : null;
    const effect = workingRoot ? explicitEffect : workingRootOrEffect;
    const player = workingRoot ? explicitPlayer : explicitEffect;
    const owner = player
      || (workingRoot ? getExplicitEffectOwnerPlayer(workingRoot, effect) : getExplicitEffectOwnerPlayer(effect))
      || (workingRoot ? getCurrentPlayer(workingRoot) : getCurrentPlayer());
    return {
      playerId: owner?.id || null,
      playerColor: owner?.color || null,
    };
  }

  function getPendingOwnerPlayer(workingRootOrPending = null, explicitPending = null, explicitFallbackEffect = null) {
    const workingRoot = isBrowserWorkingRoot(workingRootOrPending) ? workingRootOrPending : null;
    const pending = workingRoot ? explicitPending : workingRootOrPending;
    const fallbackEffect = workingRoot ? explicitFallbackEffect : explicitPending;
    const effect = fallbackEffect || pending?.effect || null;
    const reference = {
      playerId: pending?.playerId || pending?.targetPlayerId,
      playerColor: pending?.playerColor || pending?.targetPlayerColor,
    };
    return (workingRoot ? resolvePlayerReference(workingRoot, reference) : resolvePlayerReference(reference))
      || (workingRoot ? getExplicitEffectOwnerPlayer(workingRoot, effect) : getExplicitEffectOwnerPlayer(effect))
      || (effect ? (workingRoot ? getEffectOwnerPlayer(workingRoot, effect) : getEffectOwnerPlayer(effect)) : null)
      || (workingRoot ? getCurrentPlayer(workingRoot) : getCurrentPlayer());
  }

  function withPendingOwnerPlayer(workingRootOrPending, explicitPending, explicitCallback = null) {
    const workingRoot = isBrowserWorkingRoot(workingRootOrPending) ? workingRootOrPending : null;
    const pending = workingRoot ? explicitPending : workingRootOrPending;
    const callback = workingRoot ? explicitCallback : explicitPending;
    const owner = workingRoot ? getPendingOwnerPlayer(workingRoot, pending) : getPendingOwnerPlayer(pending);
    const previousPlayerId = uiRuntimeState.effectExecutionPlayerId;
    uiRuntimeState.effectExecutionPlayerId = owner?.id || previousPlayerId;
    try {
      return callback(owner);
    } finally {
      uiRuntimeState.effectExecutionPlayerId = previousPlayerId;
    }
  }

  function setActiveEffectFlowOwner(effect) {
    if (!decisionState.actionEffectFlow || !effect) return null;
    const owner = getEffectOwnerPlayer(effect);
    decisionState.actionEffectFlow.activePlayerId = owner?.id || null;
    return owner;
  }

  function withEffectExecutionPlayer(workingRootOrEffect, explicitEffect, explicitCallback = null) {
    const workingRoot = isBrowserWorkingRoot(workingRootOrEffect) ? workingRootOrEffect : null;
    const effect = workingRoot ? explicitEffect : workingRootOrEffect;
    const callback = workingRoot ? explicitCallback : explicitEffect;
    const owner = workingRoot ? getEffectOwnerPlayer(workingRoot, effect) : getEffectOwnerPlayer(effect);
    const previousPlayerId = uiRuntimeState.effectExecutionPlayerId;
    uiRuntimeState.effectExecutionPlayerId = owner?.id || previousPlayerId;
    try {
      return callback();
    } finally {
      uiRuntimeState.effectExecutionPlayerId = previousPlayerId;
    }
  }

  function getInterfacePlayer() {
    const { playerState, turnState } = createStateSourceReadoutRoot();
    const currentPlayer = players.getCurrentPlayer(playerState);
    if (!currentPlayer || !isAiAutoBattlePlayer(currentPlayer.id) || isAiAutomationPaused()) return currentPlayer;
    const activeIds = new Set(turnState.activePlayerIds || []);
    const humanPlayer = playerState.players.find((player) => activeIds.has(player.id) && !isAiAutoBattlePlayer(player.id))
      || playerState.players.find((player) => !isAiAutoBattlePlayer(player.id))
      || null;
    return humanPlayer || currentPlayer;
  }

  function createScanRunId(prefix = "scan") {
    browserHostState.scanRunSequence += 1;
    return `${prefix}-${browserHostState.scanRunSequence}`;
  }

  function resetScanRunSequence() {
    browserHostState.scanRunSequence = 0;
  }

  function getActivePlayers() {
    const { playerState, turnState } = createStateSourceReadoutRoot();
    const activeIds = new Set(turnState.activePlayerIds || []);
    return playerState.players.filter((player) => activeIds.has(player.id));
  }

  function getPlayerLabelById(playerId) {
    const player = getPlayerById(playerId);
    return player ? player.colorLabel || player.name || player.id : playerId;
  }

  function getPlayerCompanyLabel(player) {
    return industry?.getPlayerIndustryLabel?.(player)
      || player?.initialSelection?.industry?.label
      || null;
  }

  function getPlayerDisplayLabel(player, options = {}) {
    const base = player?.colorLabel || player?.name || player?.id || "玩家";
    const agentSuffix = isAiAutoBattlePlayer(player?.id) ? "(电脑)" : "";
    const companyLabel = options.includeCompany === false ? null : getPlayerCompanyLabel(player);
    return `${base}${agentSuffix}${companyLabel ? `-${companyLabel}` : ""}`;
  }

  function getPlayerActionLabel(player, fallback = {}) {
    if (player) return player.colorLabel || player.name || player.id || "玩家";
    if (fallback.playerId) return getPlayerLabelById(fallback.playerId) || fallback.playerId;
    if (fallback.playerColor) {
      return players.getPlayerColorDefinition(fallback.playerColor)?.label || fallback.playerColor;
    }
    return "玩家";
  }

  function getTargetPlayerOptions(player, options = {}) {
    const targetPlayerId = options.targetPlayerId || options.playerId || player?.id || null;
    const targetPlayerColor = options.targetPlayerColor || options.playerColor || player?.color || null;
    const targetOptions = {};
    if (targetPlayerId) targetOptions.targetPlayerId = targetPlayerId;
    if (targetPlayerColor) targetOptions.targetPlayerColor = targetPlayerColor;
    return targetOptions;
  }

  const aiControllerState = {
    get pendingDiscardAction() { return decisionState.discardAction; },
    get pendingCardSelectionAction() { return decisionState.cardSelectionAction; },
    get pendingPassReserveSelection() { return getPendingPassReserveSelection(); },
    get pendingScanTargetAction() { return decisionState.scanTargetAction; },
    get pendingProbeSectorScanAction() { return getPendingProbeSectorScanDecision(); },
    get pendingProbeLocationRewardAction() { return getPendingProbeLocationRewardDecision(); },
    get pendingPublicScanQueue() { return getPublicScanQueueSession(); },
    get pendingHandScanAction() { return decisionState.handScanAction; },
    get pendingAlienTraceAction() { return decisionState.alienTraceAction; },
    get pendingLandTargetAction() { return getPendingLandTargetDecision(); },
    get pendingDataPlaceAction() { return getPendingDataPlacementDecision(); },
    get pendingJiuzheCardPlay() { return getPendingJiuzheCardPlay(); },
    get pendingYichangdianCardGain() { return getPendingYichangdianCardGain(); },
    get pendingYichangdianCornerAction() { return getPendingYichangdianCornerAction(); },
    get pendingBanrenmaCardGain() { return getPendingBanrenmaCardGain(); },
    get pendingBanrenmaOpportunity() { return getPendingBanrenmaOpportunity(); },
    get pendingChongCardGain() { return getPendingChongCardGain(); },
    get pendingChongFossilChoice() { return getPendingChongFossilChoice(); },
    get pendingAmibaCardGain() { return getPendingAmibaCardGain(); },
    get pendingAmibaSymbolChoice() { return getPendingAmibaSymbolChoice(); },
    get pendingAmibaTraceRemoval() { return getPendingAmibaTraceRemoval(); },
    get pendingAomomoCardGain() { return getPendingAomomoCardGain(); },
    get pendingRunezuCardGain() { return getPendingRunezuCardGain(); },
    get pendingRunezuSymbolBranch() { return getPendingRunezuSymbolBranch(); },
    get pendingRunezuFaceSymbolPlacement() { return getPendingRunezuFaceSymbolPlacement(); },
    get pendingCardTriggerAction() { return getPendingCardTriggerAction(); },
    get pendingCardTriggerFreeMove() { return getPendingCardTriggerFreeMove(); },
    get pendingCardTaskCompletion() { return getPendingCardTaskCompletion(); },
    get pendingActionExecuted() { return isActionPending(); },
    get pendingActionEffectFlow() { return decisionState.actionEffectFlow; },
    get actionHistoryHasSession() { return actionHistory.hasSession(); },
    get actionHistorySessionInfo() { return actionHistory.getSessionInfo?.() || null; },
    get effectStepActive() { return uiRuntimeState.effectStepActive; },
    set effectStepActive(value) { uiRuntimeState.effectStepActive = value; },
    get pendingMovePayment() { return getPendingMovePayment(); },
    get pendingPlayCardSelection() { return getPendingPlayCardSelectionSession(); },
    get pendingCardCornerFreeMove() { return getPendingCardCornerFreeMove(); },
    get pendingIndustryAbility() { return decisionSessions.peek("industry_ability"); },
    get pendingStrategyPassiveSlotChoice() { return getPendingStrategySlotDecision(); },
    get industryFreeMoveState() { return uiRuntimeState.industryFreeMoveState; },
    get alienTracePickerState() { return decisionState.alienTracePickerState; },
    get pendingAlienRevealConfirmation() { return uiRuntimeState.alienRevealConfirmation; },
  };

  function runAiStepThroughComposition(commandKind, args = []) {
    const inspection = browserRuleComposition.inspect();
    const decision = inspection.session?.decision || null;
    if (inspection.phase === "awaiting_input" && decision?.choices?.length) {
      const family = decision.choices[0]?.family
        || decision.choices[0]?.standardAction?.family
        || decision.decisionKind
        || null;
      const actorId = decision.ownerId || null;
      const stateSourceSnapshot = browserRuleComposition.stateSourcePort.read();
      const policyResult = ai?.heuristicPolicy?.decideChoice?.({
        seatId: actorId,
        family,
        stateVersion: Math.max(0, Number(decision.stateVersion) || 0),
        decisionVersion: Math.max(0, Number(decision.decisionVersion) || 0),
        decisionId: decision.decisionId,
        requestId: `browser-session:${actorId}:${decision.decisionId}:${decision.decisionVersion || 0}`,
        observation: {
          publicState: {
            roundNumber: Math.max(0, Number(stateSourceSnapshot?.state?.turn?.roundNumber) || 0),
          },
          selfState: { playerId: actorId },
        },
        choices: decision.choices.map((choice, index) => ({
          choiceId: String(
            choice?.standardAction?.actionId
            || choice?.actionId
            || choice?.target?.choiceId
            || choice?.choiceId
            || index,
          ),
          value: Number(choice?.value ?? choice?.payload?.value ?? choice?.payload?.score ?? 0),
          target: structuredClone(choice?.target || choice?.standardAction?.target || null),
          summary: choice?.label || choice?.summary || choice?.standardAction?.summary || `选择 ${index + 1}`,
          sourceIndex: index,
        })),
      }) || { ok: false, code: "HEURISTIC_POLICY_NOT_CONFIGURED", message: "公共 Heuristic Policy 未装配" };
      if (!policyResult.ok) return policyResult;
      const sourceIndex = Number(policyResult.choice?.sourceIndex);
      const choice = decision.choices[Number.isSafeInteger(sourceIndex) ? sourceIndex : 0] || null;
      if (!choice) {
        return { ok: false, code: "AI_SESSION_CHOICE_MISSING", message: "Policy 选择未映射到 activeSession choice" };
      }
      return browserRuleComposition.inputPort.submitDecision({
        decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion,
        choice,
      });
    }
    return browserRuleComposition.inputPort.submitHostCommand({ kind: commandKind, args });
  }

  const aiController = window.SetiAppAiController.createAiController({
    window,
    state: aiControllerState,
    solar,
    players,
    rocketActions,
    planetStats,
    planetRewards,
    finalScoring,
    endGameScoring,
    industry,
    abilities,
    actions,
    scanEffects,
    quickTrades,
    cards,
    initialCards,
    cardEffects,
    cardTaskStateModule,
    tech,
    data,
    aliens,
    aomomo,
    jiuzhe,
    yichangdian,
    fangzhou,
    banrenma,
    chong,
    amiba,
    runezu,
    aiRaceModel,
    ai,
    aiControlRuntimeModule,
    setPlayerAiDifficulty: (playerId, difficulty, label) => browserRuleComposition.inputPort.submitHostCommand({
      kind: "ai_set_player_difficulty",
      playerId,
      difficulty,
      label,
    }),
    runAiAutomationStepThroughComposition: (...args) => runAiStepThroughComposition("ai_run_automation_step", args),
    recoverAiIdleActionEffectThroughComposition: (...args) => runAiStepThroughComposition("ai_recover_idle_action_effect", args),
    getRuleProjection: () => {
      const state = browserRuleComposition.stateSourcePort.read().state;
      return {
        players: structuredClone(state.players),
        turn: structuredClone(state.turn),
      };
    },
    getRuleReadout: createStateSourceReadoutRoot,
    ruleLifecycle: browserRuleLifecycle,
    historyStepOrder,
    els,
    DEFAULT_ACTIVE_PLAYER_COUNT,
    DEFAULT_INITIAL_HAND_COUNT,
    DEFAULT_INITIAL_PLAYER_COLOR,
    FINAL_ROUND_NUMBER,
    FINAL_SCORE_IDS,
    INITIAL_SELECTION_REQUIRED,
    MOVE_ENERGY_COST,
    activateNextActionEffect,
    allowsBlindDrawInSelection,
    analyzeDataForCurrentPlayer,
    beginPlayCardSelection,
    beginScanAction,
    buildSectorScanChoicesForX,
    buildSectorScanChoicesForXs,
    canBlindDraw: (...args) => canBlindDraw(...args),
    canPayForMove,
    canStartMainAction,
    canUseCardCornerQuickAction: (...args) => canUseCardCornerQuickAction(...args),
    cancelTechSelection: (...args) => cancelTechSelection?.(...args),
    clearTransientStateForRecovery,
    closeScanTargetPicker,
    computePlayerFinalScoreBreakdown: (player) => (
      computePlayerFinalScoreBreakdown(player, createStateSourceReadoutRoot())
    ),
    confirmCardTaskCompletion: (...args) => confirmCardTaskCompletion?.(...args),
    confirmCardCornerQuickAction,
    confirmDataPlacement,
    confirmDiscardAnyForIncome,
    confirmHandCardPlayAction,
    confirmInitialSelectionForCurrentPlayer,
    confirmAlienRevealNotice: () => {
      const result = confirmAlienRevealNotice();
      maybeContinuePendingTurnEndRevealFlow();
      return result;
    },
    confirmLandTargetPicker,
    confirmMovePayment,
    confirmPassReserveSelection: (...args) => confirmPassReserveSelection(...args),
    confirmPlayCardSelection,
    confirmProbeSectorScanSelection,
    confirmPublicScanSelection,
    confirmScanTarget,
    confirmStrategyPassiveSlotChoice: (...args) => confirmStrategyPassiveSlotChoice?.(...args),
    confirmTechBlueSlotChoice: (...args) => confirmTechBlueSlotChoice?.(...args),
    createActionContext: createReadoutActionContext,
    aiRuntimePorts: {
      createActionContext: (workingRoot, descriptor) => createActionContextForWorkingRoot(workingRoot, descriptor),
      dispatchRuntimeAction: (workingRoot, request) => dispatchBrowserRuleInput(
        request,
        undefined,
        createActionContextForWorkingRoot(workingRoot, request?.payload || request),
      ),
      canBlindDraw: (workingRoot, ...args) => canBlindDrawForRoot(workingRoot, ...args),
      cancelCardTriggerChoice: (workingRoot, ...args) => cancelCardTriggerChoiceForRoot(workingRoot, ...args),
      confirmCardTaskCompletion: (workingRoot, ...args) => confirmCardTaskCompletionForRoot(workingRoot, ...args),
      confirmPassReserveSelection: (workingRoot, ...args) => confirmPassReserveSelectionForRoot(workingRoot, ...args),
      confirmTechBlueSlotChoice: (workingRoot, ...args) => confirmTechBlueSlotChoiceForRoot(workingRoot, ...args),
      drawCardForCurrentPlayer: (workingRoot, ...args) => drawCardForCurrentPlayerForRoot(workingRoot, ...args),
      executeCardMoveForEffect: (workingRoot, ...args) => executeCardMoveForEffectForRoot(workingRoot, ...args),
      executeFreeMoveForCardCorner: (workingRoot, ...args) => executeFreeMoveForCardCornerForRoot(workingRoot, ...args),
      executeFreeMoveForCardTrigger: (workingRoot, ...args) => executeFreeMoveForCardTriggerForRoot(workingRoot, ...args),
      executeFreeMoveForScanAction4: (workingRoot, ...args) => executeFreeMoveForScanAction4ForRoot(workingRoot, ...args),
      executeIndustryFreeMove: (workingRoot, ...args) => executeIndustryFreeMoveForRoot(workingRoot, ...args),
      getRequiredMovePointsForUi: (workingRoot, ...args) => getRequiredMovePointsForUiForRoot(workingRoot, ...args),
      getPassReserveSelectionCards: (workingRoot, ...args) => getPassReserveSelectionCardsForRoot(workingRoot, ...args),
      getReadyCardTasks: (workingRoot, ...args) => getReadyCardTasksForRoot(workingRoot, ...args),
      handleCardTriggerChoice: (workingRoot, ...args) => handleCardTriggerChoiceForRoot(workingRoot, ...args),
      handlePublicCardClick: (workingRoot, ...args) => handlePublicCardClickForRoot(workingRoot, ...args),
      openBanrenmaReadyOpportunityForPlayer: (workingRoot, ...args) => alienSpeciesRuntime.openBanrenmaReadyOpportunityForPlayer(workingRoot, ...args),
      openCardTaskCompletionPicker: (workingRoot, ...args) => openCardTaskCompletionPickerForRoot(workingRoot, ...args),
      openRunezuFaceSymbolPlacement: (workingRoot, ...args) => alienSpeciesRuntime.openRunezuFaceSymbolPlacement(workingRoot, ...args),
      pickPublicCardForCurrentPlayer: (workingRoot, ...args) => pickPublicCardForCurrentPlayerForRoot(workingRoot, ...args),
      selectPassReserveCard: (workingRoot, ...args) => selectPassReserveCardForRoot(workingRoot, ...args),
    },
    createTurnState,
    dispatchRuntimeAction: (request) => dispatchBrowserRuleInput(request),
    drawCardForCurrentPlayer: (...args) => drawCardForCurrentPlayer(...args),
    endCurrentTurn,
    recoverPendingActionFromOpenHistoryForAi,
    executeActionEffect,
    executeCardMoveForEffect,
    executeFreeMoveForCardCorner,
    executeFreeMoveForCardTrigger: (...args) => executeFreeMoveForCardTrigger?.(...args),
    executeFreeMoveForScanAction4,
    executeIndustryFreeMove: (...args) => executeIndustryFreeMove?.(...args),
    finalizePendingDiscardSelection,
    finishIndustryAbilityFlow: (...args) => finishIndustryAbilityFlow?.(...args),
    formatRocketLabel,
    getActivePlayers,
    getAlienTraceActionPlayer,
    getCardPlayCost: (...args) => getCardPlayCost(...args),
    getCardPrice: (...args) => getCardPrice(...args),
    getCardTypeCode: (...args) => getCardTypeCode(...args),
    getCurrentActionEffect,
    getCurrentPlayer,
    getEarthSectorCoordinate,
    getEffectOwnerPlayer,
    getInitialSelectionOffer,
    getMovableTokensForPlayer,
    getPassReserveSelectionCards: (...args) => getPassReserveSelectionCards(...args),
    getPendingPlayCardSelection,
    getPlanetSectorCoordinate,
    getPlayerByColor,
    getPlayerById,
    getPlayerLabelById,
    getPublicScanChoicesForCard: (...args) => scanFlowHelpers.getPublicScanChoicesForCard(...args),
    getReadyCardTasks: (...args) => getReadyCardTasks?.(...args),
    getRequiredMovePointsForUi: (workingRoot, ...args) => getRequiredMovePointsForUiForRoot(workingRoot, ...args),
    getResearchTechSelectionOptions: (...args) => getResearchTechSelectionOptions?.(...args),
    getSectorContentForMove,
    getSectorXsMatchingCondition,
    handleAmibaCardGainChoice,
    handleAmibaSymbolChoice,
    handleAmibaTraceRemovalChoice,
    handleAomomoCardGainChoice,
    handleBanrenmaBonusChoice,
    handleBanrenmaCardConditionChoice,
    handleBanrenmaCardGainChoice,
    handleCardTriggerChoice: (...args) => handleCardTriggerChoice?.(...args),
    cancelCardTriggerChoice: (...args) => cancelCardTriggerChoice?.(...args),
    handleChongCardGainChoice,
    handleChongFossilChoice,
    handleCompanyActionMarkerClick: (...args) => handleCompanyActionMarkerClick?.(...args),
    handleConditionalSectorChoice,
    handleDiscardCornerRepeatChoice,
    handleDiscardIncomeCardChoice,
    handleHandCardCornerQuickAction,
    handleHandCornerChoice,
    handleHandScanCardClick,
    handleJiuzheCardChoice,
    handleJiuzheOpportunitySkip,
    handleOptionalHandScanChoice,
    handlePayCreditChoice,
    handleFundamentalismExchangeChoice,
    handlePlayCardSelect,
    handleProbeLocationRewardChoice,
    handleProbeSectorScanChoice,
    handlePublicCornerDiscardCardClick,
    handlePublicCardClick: (...args) => handlePublicCardClick(...args),
    handlePublicScanCardClick,
    handleRemoveOrbitToProbeChoice,
    handleRemovePlanetMarkerChoice,
    handleReturnUnfinishedTaskChoice,
    handleIndustryDeepspaceHandClick: (...args) => handleIndustryDeepspaceHandClick?.(...args),
    handleRunezuCardGainChoice,
    handleRunezuFaceSymbolChoice,
    handleRunezuSymbolBranchChoice,
    handleScanAction4Choice,
    handleSupplyTechTileClick: (...args) => handleSupplyTechTileClick?.(...args),
    handleYichangdianCardGainChoice,
    handleYichangdianCornerChoice,
    hasActivePendingSubFlow,
    initializeCardGame,
    isActionEffectFlowActive,
    isAsteroidContent,
    isCardSelectionActive,
    isDiscardSelectionActive,
    isGameEnded,
    isHandScanSelectionActive,
    isIndustryHandSelectionActive: (...args) => isIndustryHandSelectionActive?.(...args),
    isInitialSelectionActive,
    isMovePaymentCard,
    isMovePaymentSelectionActive,
    isPlayCardSelectionActive,
    isPublicScanMultiSelectActive,
    isUiBlockingAiAutomation: isActionBriefingOpen,
    isTechTileOwnedByOtherPlayer: (...args) => isTechTileOwnedByOtherPlayer?.(...args),
    isTechTilePickingActive: (...args) => isTechTilePickingActive?.(...args),
    landForCurrentPlayer,
    moveRocket,
    orbitForCurrentPlayer,
    openBanrenmaReadyOpportunityForPlayer,
    openCardTaskCompletionPicker: (...args) => openCardTaskCompletionPicker(...args),
    openRunezuFaceSymbolPlacement,
    passForCurrentPlayer,
    pickPublicCardForCurrentPlayer: (...args) => pickPublicCardForCurrentPlayer?.(...args),
    randomizeAll,
    renderStateReadout,
    researchTechForCurrentPlayer: (...args) => researchTechForCurrentPlayer?.(...args),
    resetActionLog,
    resetScanRunSequence,
    restoreMutableObject,
    runAction,
    runPlaceDataToComputer,
    runQuickTrade,
    runAiFinalScoreMarkDecision,
    selectPassReserveCard: (...args) => selectPassReserveCard(...args),
    sectorXHasAvailableScanTarget,
    setTurnStatePlayerOrder,
    skipCurrentActionEffect,
    startInitialSelection,
    startNewGame,
    updateActionButtons,
  });
  const {
    aiNumber,
    applyAiStrategyTuning,
    applyAiStrategyTuningRecommendation,
    applyAiStrategyWeight,
    cardTriggerNeedsFreeMove,
    clearAiStrategyTuningHistory,
    configureAiAutoBattle,
    configureAiStrategyWeights,
    configureDefaultAiOpponent,
    createAiControlSnapshot,
    getAiAutoBattleAnalysis,
    getAiAutoBattleProgress,
    getAiAutoBattleReport,
    buildAiTurnActionCandidates: buildAiTurnActionCandidatesForRoot,
    chooseInitialSelectionForAiPlayer: chooseInitialSelectionForAiPlayerForRoot,
    enumerateHeadlessTurnActions: enumerateHeadlessTurnActionsForRoot,
    executeAiTurnAction: executeAiTurnActionForRoot,
    getAiMapDemand,
    getAiRemainingRoundWeight,
    getAiStrategyDemand,
    getAiStrategyTuningHistory,
    getAiStrategyTuningRecommendation,
    getAiStrategyWeights,
    getCardTriggerFreeMoveEffect,
    getPlayerAgentLabel,
    isAiAutomationPaused,
    isAiAutoBattlePlayer,
    listCardTriggerFreeMoveCandidates: listCardTriggerFreeMoveCandidatesForRoot,
    recordAiAutoBattleLog,
    resolveAiAutomationToTurnBoundary: resolveAiAutomationToTurnBoundaryForRoot,
    resetAiStrategyWeights,
    restoreAiControlSnapshot,
    runAiAutoBattle,
    runAiAutoBattleBatch,
    runAiAutomationStep: runAiAutomationStepForRoot,
    runAiActionEffectStep: runAiActionEffectStepForRoot,
    runAiNonTurnAutomationStep: runAiNonTurnAutomationStepForRoot,
    runAiSelectedTurnAction: runAiSelectedTurnActionForRoot,
    recoverAiIdleActionEffectStep: recoverAiIdleActionEffectStepForRoot,
    runAiStrategyABTest,
    runAiStrategyTuningCycle,
    scheduleAiAutoStepIfNeeded,
    stopAiAutoBattle,
    sumAiDemandMap,
  } = aiController;
  const buildAiTurnActionCandidates = (...args) => browserRuleComposition.inputPort.submitHostCommand({
    kind: "ai_build_turn_candidates",
    args,
  });
  const chooseInitialSelectionForAiPlayer = () => browserRuleComposition.inputPort.submitHostCommand({
    kind: "ai_choose_initial_selection",
  });
  const enumerateHeadlessTurnActions = () => browserRuleComposition.inputPort.submitHostCommand(
    { kind: "headless_enumerate_turn_actions" },
    { commit: false },
  ).value || [];
  const executeAiTurnAction = (action) => browserRuleComposition.inputPort.submitHostCommand({
    kind: "ai_execute_turn_action",
    action,
  });
  const submitHeadlessTurnAction = (action) => {
    const descriptor = action?.standardAction || action;
    if (!descriptor?.actionId) {
      return { ok: false, code: "STANDARD_ACTION_DESCRIPTOR_REQUIRED", message: "headless 行动缺少 Standard Action descriptor" };
    }
    return browserRuleComposition.inputPort.submitAction(descriptor, {
      metadata: { source: "headless-env" },
    });
  };
  const beginHeadlessCompositionDrain = () => browserRuleComposition.inputPort.beginDrain({
    metadata: { source: "headless-env-reset" },
  });
  const inspectHeadlessComposition = () => browserRuleComposition.inspect();
  const listCardTriggerFreeMoveCandidates = (...args) => (
    browserRuleComposition.inputPort.submitHostCommand({
      kind: "card_trigger_list_free_move_candidates",
      args,
    }, { commit: false }).value || []
  );
  const resolveAiAutomationToTurnBoundary = (options = {}) => browserRuleComposition.inputPort.submitHostCommand({
    kind: "ai_resolve_to_turn_boundary",
    options,
  });
  const runAiAutomationStep = () => browserRuleComposition.inputPort.submitHostCommand({ kind: "ai_run_automation_step" });
  const runAiActionEffectStep = () => browserRuleComposition.inputPort.submitHostCommand({ kind: "ai_run_action_effect_step" });
  const runAiNonTurnAutomationStep = () => browserRuleComposition.inputPort.submitHostCommand({ kind: "ai_run_non_turn_step" });
  const runAiSelectedTurnAction = (selector = {}, options = {}) => browserRuleComposition.inputPort.submitHostCommand({
    kind: "ai_run_selected_turn_action",
    selector,
    options,
  });
  const cardRuntime = cardRuntimeModule.createCardRuntime({
    decisionSessions,
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    SCORE_SOURCE_KEYS,
    SCORE_SOURCE_KEY_SET: new Set(Object.values(SCORE_SOURCE_KEYS)),
    abilities,
    activateMoveMode,
    applyCardMoveAfterEventRewards,
    addScoreSourceFromGain,
    allowsBlindDrawInSelection,
    appendActionLogStep,
    attachCardHoverPreview,
    banrenma,
    beginDiscardSelection,
    beginEffectHistoryStep,
    beginQuickActionStep,
    canPayForMove,
    canStartMainAction,
    cardEffects,
    cards,
    clearMoveRocketHighlight,
    clearHistoryStepOrderForSource,
    commitIrreversibleIndustryQuickAction: (...args) => commitIrreversibleIndustryQuickAction?.(...args),
    completeCurrentActionEffect,
    completeQuickActionStep,
    continueAfterCardTriggerResolution: (workingRoot, ...args) => continueAfterCardTriggerResolutionForRoot(workingRoot, ...args),
    continuePendingDataPlacementAfterBonus,
    createActionContext: (workingRoot, descriptor) => createActionContextForWorkingRoot(workingRoot, descriptor),
    createCardTriggerProgressCommands: (workingRoot, ...args) => createCardTriggerProgressCommandsForRoot(workingRoot, ...args),
    data,
    deactivateMoveMode,
    discardReservedCardIfFinished: (workingRoot, ...args) => discardReservedCardIfFinishedForRoot(workingRoot, ...args),
    document,
    els,
    fangzhou,
    finalizeIndustryDeepspaceSwap: (...args) => finalizeIndustryDeepspaceSwap?.(...args),
    finishIndustryAbilityFlow: (...args) => finishIndustryAbilityFlow?.(...args),
    formatPlanetRewardGain,
    endEffectHistoryStep,
    getCurrentActionEffect,
    getDelayedPublicRefillSlots,
    getGameplayLockReason,
    getMainActionStartBlockReason,
    getRequiredMovePointsForUi,
    getPublicScanSelectionInstruction: (...args) => getPublicScanSelectionInstruction?.(...args) || "请选择公共牌",
    handlePublicCornerDiscardCardClick,
    handlePublicScanCardClick,
    hasActivePendingSubFlow,
    hideCardHoverPreview,
    historyCommands,
    industry,
    insertActionEffectsAfterCurrent,
    isCardSelectionActive,
    isDiscardSelectionActive,
    isHandScanSelectionActive,
    isIndustryHandSelectionActive: (...args) => isIndustryHandSelectionActive?.(...args),
    isMovePaymentLockedForAiAutomation,
    isMovePaymentSelectionActive,
    isPlayCardSelectionActive,
    isTechTilePickingActive: (...args) => isTechTilePickingActive?.(...args),
    keepExistingMainActionPendingAfterChongTask,
    markCurrentActionIrreversible,
    maybeApplyCardMoveDistinctEventReward,
    maybeApplyCardMoveSameRingReward,
    maybeContinuePendingTurnEndRevealFlow,
    normalizeResourceCost,
    uiRuntimeState,
    players,
    quickActionHistory,
    quickTrades,
    recordAbilityCommands,
    recordHistoryCommand,
    recordQuickHistoryCommand,
    recordTechBonusScore,
    renderActionEffectBar,
    renderPlayerHand,
    renderPlayerStats,
    renderRocketElement,
    renderRuntime,
    renderStateReadout,
    rocketActions,
    rollbackPendingIndustryQuickAction: (...args) => rollbackPendingIndustryQuickAction?.(...args),
    runezu,
    scrollToPlayerHandPanel,
    settleCardTasksAfterEffect: (workingRoot, ...args) => settleCardTasksAfterEffectForRoot(workingRoot, ...args),
    startCardEffectFlow,
    structuredClone,
    syncCardSelectionChrome,
    syncMovePaymentChrome,
    updateActionButtons,
  });
  ({
    getDiscardCornerRewardMultiplier,
    multiplyRewardGain,
    multiplyDiscardActionReward,
    multiplyDiscardMoveReward,
    getCardCornerQuickActionForCard,
    shouldQueueCardCornerMoveQuickAction,
    canUseCardCornerQuickAction,
    formatCardCornerRewardMessage,
    getCardCornerEventKind,
    normalizeCardCornerRewardMultiplier,
    cardCornerCodesEqual,
    normalizeCardCornerTriggerCode,
    getDiscardActionTriggerResourceRewardForCode,
    getDiscardActionTriggerMoveRewardForCode,
    createCardCornerTriggerEventFields,
    applyCardCornerRewardFromCard,
    canStartCardCornerFreeMove,
    beginCardCornerFreeMove,
    cloneEffectEvent,
    getAfterMoveEventsForEffect,
    buildQueuedCardCornerMoveEffect,
    startCardCornerMoveEffectFlow,
    getCardPrice,
    getCardPlayCost,
    getCardPlayCreditCost,
    createPlayCardEvent,
    createImmediatePlayCardEvent,
    restoreObjectSnapshot,
    getFutureSpanCreditPriceForCard,
    getFutureSpanDeltaForCard,
    isFutureSpanEligibleHandCard,
    hasFutureSpanEligibleHandCard,
    hasPlayableFutureSpanCard,
    getStandardPlayCardActionBlockReason,
    formatCardPlayCost,
    getCardTypeCode,
    getPlayCardSelectionBlockReason,
    getHandCardPlayActionForCard,
    beginCardSelection,
    cancelCardSelection,
    finalizeCardSelectionResult,
    drawBasicCardToPlayer,
    blindDrawCardForPlayer,
    drawCardForCurrentPlayer,
    pickPublicCardForCurrentPlayer,
    discardCardFromCurrentPlayer,
    canBlindDraw,
    updatePublicCardControls,
    getDelayedPublicRefillSlotIndexes,
    ensurePublicCardsFilledRespectingDelayedRefills,
    renderPublicCards,
    handlePublicCardClick,
    handlePublicBlindDrawClick,
    isPassReserveSelectionActive,
    getPassReserveSelectionCards,
    renderPassReserveSelection,
    syncPassReserveSelectionChrome,
    beginPassReserveSelection,
    dismissPassReserveSelectionOverlay,
    selectPassReserveCard,
    confirmPassReserveSelection,
    initCardMoveEffectState,
    isIndustryHuanyuMoveEffect,
    getEffectResultRocketId,
    getCompletedIndustryHuanyuMoveRocketIds,
    validateIndustryHuanyuMoveRocket,
    getMovableTokensForCardMoveEffect,
    getCardMoveEffectCost,
    addResourceCosts,
    selectDefaultRocketFromCandidates,
    executeCardEffectMove,
    finishCurrentCardMoveEffectEarly,
    requestCardEffectMove,
  } = cardRuntime);
  const getDiscardCornerRewardMultiplierForRoot = getDiscardCornerRewardMultiplier;
  getDiscardCornerRewardMultiplier = bindBrowserDomainCommand("card_runtime", "getDiscardCornerRewardMultiplier");
  const getCardCornerQuickActionForCardForRoot = getCardCornerQuickActionForCard;
  getCardCornerQuickActionForCard = bindBrowserDomainCommand("card_runtime", "getCardCornerQuickActionForCard");
  const shouldQueueCardCornerMoveQuickActionForRoot = shouldQueueCardCornerMoveQuickAction;
  shouldQueueCardCornerMoveQuickAction = bindBrowserDomainCommand("card_runtime", "shouldQueueCardCornerMoveQuickAction");
  const canStartCardCornerFreeMoveForRoot = canStartCardCornerFreeMove;
  canStartCardCornerFreeMove = bindBrowserDomainCommand("card_runtime", "canStartCardCornerFreeMove");
  const beginCardCornerFreeMoveForRoot = beginCardCornerFreeMove;
  beginCardCornerFreeMove = bindBrowserDomainCommand("card_runtime", "beginCardCornerFreeMove");
  const startCardCornerMoveEffectFlowForRoot = startCardCornerMoveEffectFlow;
  startCardCornerMoveEffectFlow = bindBrowserDomainCommand("card_runtime", "startCardCornerMoveEffectFlow");
  const hasFutureSpanEligibleHandCardForRoot = hasFutureSpanEligibleHandCard;
  hasFutureSpanEligibleHandCard = bindBrowserDomainCommand("card_runtime", "hasFutureSpanEligibleHandCard");
  const hasPlayableFutureSpanCardForRoot = hasPlayableFutureSpanCard;
  hasPlayableFutureSpanCard = bindBrowserDomainCommand("card_runtime", "hasPlayableFutureSpanCard");
  const getStandardPlayCardActionBlockReasonForRoot = getStandardPlayCardActionBlockReason;
  getStandardPlayCardActionBlockReason = bindBrowserDomainCommand("card_runtime", "getStandardPlayCardActionBlockReason");
  const getPlayCardSelectionBlockReasonForRoot = getPlayCardSelectionBlockReason;
  getPlayCardSelectionBlockReason = bindBrowserDomainCommand("card_runtime", "getPlayCardSelectionBlockReason");
  const getHandCardPlayActionForCardForRoot = getHandCardPlayActionForCard;
  getHandCardPlayActionForCard = bindBrowserDomainCommand("card_runtime", "getHandCardPlayActionForCard");
  const beginCardSelectionForRoot = beginCardSelection;
  beginCardSelection = bindBrowserDomainCommand("card_runtime", "beginCardSelection");
  const cancelCardSelectionForRoot = cancelCardSelection;
  cancelCardSelection = bindBrowserDomainCommand("card_runtime", "cancelCardSelection");
  const finalizeCardSelectionResultForRoot = finalizeCardSelectionResult;
  finalizeCardSelectionResult = bindBrowserDomainCommand("card_runtime", "finalizeCardSelectionResult");
  const drawBasicCardToPlayerForRoot = drawBasicCardToPlayer;
  drawBasicCardToPlayer = bindBrowserDomainCommand("card_runtime", "drawBasicCardToPlayer");
  const blindDrawCardForPlayerForRoot = blindDrawCardForPlayer;
  blindDrawCardForPlayer = bindBrowserDomainCommand("card_runtime", "blindDrawCardForPlayer");
  const drawCardForCurrentPlayerForRoot = drawCardForCurrentPlayer;
  drawCardForCurrentPlayer = bindBrowserDomainCommand("card_runtime", "drawCardForCurrentPlayer");
  const pickPublicCardForCurrentPlayerForRoot = pickPublicCardForCurrentPlayer;
  pickPublicCardForCurrentPlayer = bindBrowserDomainCommand("card_runtime", "pickPublicCardForCurrentPlayer");
  const canBlindDrawForRoot = canBlindDraw;
  canBlindDraw = bindBrowserDomainCommand("card_runtime", "canBlindDraw");
  const updatePublicCardControlsForRoot = updatePublicCardControls;
  updatePublicCardControls = bindBrowserDomainCommand("card_runtime", "updatePublicCardControls");
  const ensurePublicCardsFilledRespectingDelayedRefillsForRoot = ensurePublicCardsFilledRespectingDelayedRefills;
  ensurePublicCardsFilledRespectingDelayedRefills = bindBrowserDomainCommand("card_runtime", "ensurePublicCardsFilledRespectingDelayedRefills");
  const handlePublicCardClickForRoot = handlePublicCardClick;
  handlePublicCardClick = bindBrowserDomainCommand("card_runtime", "handlePublicCardClick");
  const handlePublicBlindDrawClickForRoot = handlePublicBlindDrawClick;
  handlePublicBlindDrawClick = bindBrowserDomainCommand("card_runtime", "handlePublicBlindDrawClick");
  const getPassReserveSelectionCardsForRoot = getPassReserveSelectionCards;
  getPassReserveSelectionCards = bindBrowserDomainCommand("card_runtime", "getPassReserveSelectionCards");
  const renderPassReserveSelectionForRoot = renderPassReserveSelection;
  renderPassReserveSelection = bindBrowserDomainCommand("card_runtime", "renderPassReserveSelection");
  const syncPassReserveSelectionChromeForRoot = syncPassReserveSelectionChrome;
  syncPassReserveSelectionChrome = bindBrowserDomainCommand("card_runtime", "syncPassReserveSelectionChrome");
  const beginPassReserveSelectionForRoot = beginPassReserveSelection;
  beginPassReserveSelection = bindBrowserDomainCommand("card_runtime", "beginPassReserveSelection");
  const dismissPassReserveSelectionOverlayForRoot = dismissPassReserveSelectionOverlay;
  dismissPassReserveSelectionOverlay = bindBrowserDomainCommand("card_runtime", "dismissPassReserveSelectionOverlay");
  const selectPassReserveCardForRoot = selectPassReserveCard;
  selectPassReserveCard = bindBrowserDomainCommand("card_runtime", "selectPassReserveCard");
  const confirmPassReserveSelectionForRoot = confirmPassReserveSelection;
  confirmPassReserveSelection = bindBrowserDomainCommand("card_runtime", "confirmPassReserveSelection");
  const selectDefaultRocketFromCandidatesForRoot = selectDefaultRocketFromCandidates;
  selectDefaultRocketFromCandidates = bindBrowserDomainCommand("card_runtime", "selectDefaultRocketFromCandidates");
  const executeCardEffectMoveForRoot = executeCardEffectMove;
  executeCardEffectMove = bindBrowserDomainCommand("card_runtime", "executeCardEffectMove");
  const finishCurrentCardMoveEffectEarlyForRoot = finishCurrentCardMoveEffectEarly;
  finishCurrentCardMoveEffectEarly = bindBrowserDomainCommand("card_runtime", "finishCurrentCardMoveEffectEarly");
  const requestCardEffectMoveForRoot = requestCardEffectMove;
  requestCardEffectMove = bindBrowserDomainCommand("card_runtime", "requestCardEffectMove");
  const getMovableTokensForCardMoveEffectForRoot = getMovableTokensForCardMoveEffect;
  getMovableTokensForCardMoveEffect = bindBrowserDomainCommand("card_runtime", "getMovableTokensForCardMoveEffect");
  const cardTriggerRuntime = cardTriggerRuntimeModule.createCardTriggerRuntime({
    decisionSessions,
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    SCORE_SOURCE_KEYS,
    abilities,
    actionLogOptionsFromHistoryStep,
    activateMoveMode,
    activateNextActionEffectIfIdle,
    addScoreSourceFromGain,
    aliens,
    amiba,
    appendActionLogStep,
    banrenma,
    beginCardSelection: (workingRoot, ...args) => beginCardSelectionForRoot(workingRoot, ...args),
    beginQuickActionStep,
    beginSupplementalMovePayment,
    blockManualAiPendingInputIfNeeded,
    buildPlutoMarkerContext: (workingRoot, ...args) => actionInteractionRuntime.buildPlutoMarkerContext(workingRoot, ...args),
    cardEffects,
    cardTaskState,
    cardTaskStateModule,
    cardTriggerNeedsFreeMove,
    cards,
    chong,
    clearMoveRocketHighlight,
    completeQuickActionStep,
    composeActionLogDetailWithImpact,
    createActionContext: (workingRoot, descriptor) => createActionContextForWorkingRoot(workingRoot, descriptor),
    createActionLogImpactSnapshot,
    createBanrenmaReservedButton,
    createJiuzheReservedButton,
    createReservedCardButton,
    createReservedCardRow,
    data,
    deactivateMoveMode,
    document,
    els,
    ensureEffectHistorySession,
    fangzhou,
    finishActionEffectFlow,
    formatCardCornerRewardMessage,
    formatChongGain,
    formatChongFossilRewardSummary,
    formatPlanetRewardGain,
    getCardTriggerFreeMoveEffect,
    getCardTypeCode,
    getChongPlanetLabel,
    getEarthSectorCoordinate,
    getPendingOwnerFields,
    getPendingAmibaSymbolChoice,
    getPlanetSectorCoordinate,
    getRequiredMovePointsForUi,
    getSectorContentForMove,
    hasActivePendingSubFlow,
    historyCommands,
    insertActionEffectsAfterCurrent,
    insertActionEffectsBeforeCurrent,
    isActionEffectFlowActive,
    isAsteroidContent,
    isCardSelectionActive,
    isInitialSelectionActive,
    jiuzhe,
    layoutReservedCardRows,
    listCardTriggerFreeMoveCandidates: listCardTriggerFreeMoveCandidatesForRoot,
    listReadyChongTransportCandidates: (workingRoot, ...args) => listReadyChongTransportCandidatesForRoot(workingRoot, ...args),
    markCurrentActionIrreversibleForSource,
    maybeApplyIndustryLaunchScan: (workingRoot, ...args) => maybeApplyIndustryLaunchScanForRoot?.(workingRoot, ...args),
    openAmibaSymbolChoiceDialog: (workingRoot, ...args) => alienSpeciesRuntime.openAmibaSymbolChoiceDialog(workingRoot, ...args),
    playerHasOwnOrbitMarkerAtPlanet,
    players,
    quickActionHistory,
    recordAbilityCommands,
    recordQuickHistoryCommand,
    rememberHistoryStep,
    renderActionEffectBar,
    renderAlienPanels: (workingRoot, ...args) => alienSpeciesRuntime.renderAlienPanels(workingRoot, ...args),
    renderInitialSelectionArea,
    renderPlayerHand,
    renderPlayerStats,
    renderPublicCards,
    renderReservedCards,
    renderRocketElement,
    renderRockets,
    renderStateReadout,
    rocketActions,
    runezu,
    solar,
    startCardEffectFlow,
    structuredClone,
    updateActionButtons,
  });
  ({
    buildCardTaskContext,
    buildPlayerDataTotals,
    addProbeLocation,
    buildProbeLocationIndex,
    startTemporaryCardTaskRewardFlow,
    getReadyCardTasks,
    refreshCardTaskState,
    cloneType1TriggerEvent,
    enqueueType1TriggerEvents,
    isCardTriggerPickSelectionActive,
    hasActiveCardTriggerResolution,
    isCardTriggerRewardFlowBusy,
    getType1TriggerMatchesForEvent,
    applyType1TriggerMatches,
    continueAfterCardTriggerResolution,
    cancelCardTriggerChoice,
    buildAlienTraceEvent,
    getNebulaColorForCardEvent,
    ensureCardFlowEventBonuses,
    getActiveCardEventBonuses,
    eventMatchesCardBonus,
    getCardEventBonusKey,
    applyCardEventBonusReward,
    applyPublicityMoveFollowupBonus,
    processCardEventBonuses,
    processChongTransportArrivalEvents,
    getChongTransportDestinationCoordinate,
    getChongTransportArrivalEventKey,
    buildChongPositionArrivalEvents,
    settleCardTasksAfterEffect,
    getChongRewardPrimaryIcon,
    createChongTaskEffect,
    buildChongRewardQueueEffects,
    buildChongFossilRewardQueueEffects,
    buildChongTransportCleanupEffect,
    buildChongTaskCompletionEffects,
    getReadyTaskForReservedCard,
    getReadyChongTaskForReservedCard,
    getReadyAmibaTaskForReservedCard,
    getReadyRunezuTaskForReservedCard,
    getRunezuTaskProgressIndexes,
    incrementCompletedTaskCount,
    removeReservedCardToDiscard,
    discardReservedCardIfFinished,
    createCardTriggerProgressSnapshot,
    createCardTriggerProgressCommands,
    consumeCardTriggerWithSnapshot,
    confirmCardTriggerProgress,
    prepareCardTriggerRewardEffects,
    queueCardTriggerRewardEffects,
    getCardTaskCompletionBlockReason,
    openCardTaskCompletionPicker,
    closeCardTaskCompletionPicker,
    confirmCardTaskCompletion,
    openCardTriggerPicker,
    closeCardTriggerPicker,
    applyCardTriggerReward,
    beginCardTriggerFreeMove,
    applyCardTriggerMatch,
    handleCardTriggerChoice,
    executeFreeMoveForCardTrigger,
  } = cardTriggerRuntime);
  const buildCardTaskContextForRoot = buildCardTaskContext;
  buildCardTaskContext = bindBrowserDomainCommand("card_trigger", "buildCardTaskContext");
  const buildPlayerDataTotalsForRoot = buildPlayerDataTotals;
  buildPlayerDataTotals = bindBrowserDomainCommand("card_trigger", "buildPlayerDataTotals");
  const buildProbeLocationIndexForRoot = buildProbeLocationIndex;
  buildProbeLocationIndex = bindBrowserDomainCommand("card_trigger", "buildProbeLocationIndex");
  const getReadyCardTasksForRoot = getReadyCardTasks;
  getReadyCardTasks = bindBrowserDomainCommand("card_trigger", "getReadyCardTasks");
  const refreshCardTaskStateForRoot = refreshCardTaskState;
  refreshCardTaskState = bindBrowserDomainCommand("card_trigger", "refreshCardTaskState");
  const applyType1TriggerMatchesForRoot = applyType1TriggerMatches;
  applyType1TriggerMatches = bindBrowserDomainCommand("card_trigger", "applyType1TriggerMatches");
  const continueAfterCardTriggerResolutionForRoot = continueAfterCardTriggerResolution;
  continueAfterCardTriggerResolution = bindBrowserDomainCommand("card_trigger", "continueAfterCardTriggerResolution");
  const cancelCardTriggerChoiceForRoot = cancelCardTriggerChoice;
  cancelCardTriggerChoice = bindBrowserDomainCommand("card_trigger", "cancelCardTriggerChoice");
  const buildAlienTraceEventForRoot = buildAlienTraceEvent;
  buildAlienTraceEvent = bindBrowserDomainCommand("card_trigger", "buildAlienTraceEvent");
  const getActiveCardEventBonusesForRoot = getActiveCardEventBonuses;
  getActiveCardEventBonuses = bindBrowserDomainCommand("card_trigger", "getActiveCardEventBonuses");
  const applyCardEventBonusRewardForRoot = applyCardEventBonusReward;
  applyCardEventBonusReward = bindBrowserDomainCommand("card_trigger", "applyCardEventBonusReward");
  const applyPublicityMoveFollowupBonusForRoot = applyPublicityMoveFollowupBonus;
  applyPublicityMoveFollowupBonus = bindBrowserDomainCommand("card_trigger", "applyPublicityMoveFollowupBonus");
  const processCardEventBonusesForRoot = processCardEventBonuses;
  processCardEventBonuses = bindBrowserDomainCommand("card_trigger", "processCardEventBonuses");
  const processChongTransportArrivalEventsForRoot = processChongTransportArrivalEvents;
  processChongTransportArrivalEvents = bindBrowserDomainCommand("card_trigger", "processChongTransportArrivalEvents");
  const buildChongPositionArrivalEventsForRoot = buildChongPositionArrivalEvents;
  buildChongPositionArrivalEvents = bindBrowserDomainCommand("card_trigger", "buildChongPositionArrivalEvents");
  const settleCardTasksAfterEffectForRoot = settleCardTasksAfterEffect;
  settleCardTasksAfterEffect = bindBrowserDomainCommand("card_trigger", "settleCardTasksAfterEffect");
  const getReadyTaskForReservedCardForRoot = getReadyTaskForReservedCard;
  getReadyTaskForReservedCard = bindBrowserDomainCommand("card_trigger", "getReadyTaskForReservedCard");
  const getReadyChongTaskForReservedCardForRoot = getReadyChongTaskForReservedCard;
  getReadyChongTaskForReservedCard = bindBrowserDomainCommand("card_trigger", "getReadyChongTaskForReservedCard");
  const getReadyAmibaTaskForReservedCardForRoot = getReadyAmibaTaskForReservedCard;
  getReadyAmibaTaskForReservedCard = bindBrowserDomainCommand("card_trigger", "getReadyAmibaTaskForReservedCard");
  const getReadyRunezuTaskForReservedCardForRoot = getReadyRunezuTaskForReservedCard;
  getReadyRunezuTaskForReservedCard = bindBrowserDomainCommand("card_trigger", "getReadyRunezuTaskForReservedCard");
  const removeReservedCardToDiscardForRoot = removeReservedCardToDiscard;
  removeReservedCardToDiscard = bindBrowserDomainCommand("card_trigger", "removeReservedCardToDiscard");
  const discardReservedCardIfFinishedForRoot = discardReservedCardIfFinished;
  discardReservedCardIfFinished = bindBrowserDomainCommand("card_trigger", "discardReservedCardIfFinished");
  const createCardTriggerProgressSnapshotForRoot = createCardTriggerProgressSnapshot;
  createCardTriggerProgressSnapshot = bindBrowserDomainCommand("card_trigger", "createCardTriggerProgressSnapshot");
  const createCardTriggerProgressCommandsForRoot = createCardTriggerProgressCommands;
  createCardTriggerProgressCommands = bindBrowserDomainCommand("card_trigger", "createCardTriggerProgressCommands");
  const consumeCardTriggerWithSnapshotForRoot = consumeCardTriggerWithSnapshot;
  consumeCardTriggerWithSnapshot = bindBrowserDomainCommand("card_trigger", "consumeCardTriggerWithSnapshot");
  const confirmCardTriggerProgressForRoot = confirmCardTriggerProgress;
  confirmCardTriggerProgress = bindBrowserDomainCommand("card_trigger", "confirmCardTriggerProgress");
  const prepareCardTriggerRewardEffectsForRoot = prepareCardTriggerRewardEffects;
  prepareCardTriggerRewardEffects = bindBrowserDomainCommand("card_trigger", "prepareCardTriggerRewardEffects");
  const queueCardTriggerRewardEffectsForRoot = queueCardTriggerRewardEffects;
  queueCardTriggerRewardEffects = bindBrowserDomainCommand("card_trigger", "queueCardTriggerRewardEffects");
  const openCardTaskCompletionPickerForRoot = openCardTaskCompletionPicker;
  openCardTaskCompletionPicker = bindBrowserDomainCommand("card_trigger", "openCardTaskCompletionPicker");
  const confirmCardTaskCompletionForRoot = confirmCardTaskCompletion;
  confirmCardTaskCompletion = bindBrowserDomainCommand("card_trigger", "confirmCardTaskCompletion");
  const openCardTriggerPickerForRoot = openCardTriggerPicker;
  openCardTriggerPicker = bindBrowserDomainCommand("card_trigger", "openCardTriggerPicker");
  const applyCardTriggerRewardForRoot = applyCardTriggerReward;
  applyCardTriggerReward = bindBrowserDomainCommand("card_trigger", "applyCardTriggerReward");
  const beginCardTriggerFreeMoveForRoot = beginCardTriggerFreeMove;
  beginCardTriggerFreeMove = bindBrowserDomainCommand("card_trigger", "beginCardTriggerFreeMove");
  const applyCardTriggerMatchForRoot = applyCardTriggerMatch;
  applyCardTriggerMatch = bindBrowserDomainCommand("card_trigger", "applyCardTriggerMatch");
  const handleCardTriggerChoiceForRoot = handleCardTriggerChoice;
  handleCardTriggerChoice = bindBrowserDomainCommand("card_trigger", "handleCardTriggerChoice");
  const executeFreeMoveForCardTriggerForRoot = executeFreeMoveForCardTrigger;
  executeFreeMoveForCardTrigger = bindBrowserDomainCommand("card_trigger", "executeFreeMoveForCardTrigger");

  function getActionLogActionLabel(actionType, label) {
    return label || ACTION_LOG_DEFAULT_LABELS[actionType] || actionType || "本回合行动";
  }

  function normalizeActionLogText(text) {
    return actionLogRuntimeModule.normalizeText(text);
  }

  function createActionLogPlayedCardSnapshot(card) {
    return actionLogRuntimeModule.createPlayedCardSnapshot(card, {
      getCardLabel: cards.getCardLabel,
    });
  }

  function simplifyActionLogDetailForLabel(label, detail) {
    return actionLogRuntimeModule.simplifyDetailForLabel(label, detail);
  }

  function normalizeActionLogStep(source, label, detail = null, options = {}) {
    return actionLogRuntimeModule.normalizeStep(source, label, detail, {
      ...options,
      getCardLabel: cards.getCardLabel,
      normalizeSectorX: solar.mod8,
      getNebulaLabel: data.getNebulaLabel,
    });
  }

  function actionLogOptionsFromHistoryStep(step = {}) {
    return actionLogRuntimeModule.optionsFromHistoryStep(step);
  }

  function createActionLogImpactSnapshot(player = getCurrentPlayer()) {
    return actionLogRuntimeModule.createImpactSnapshot(player, {
      resourceKeys: ACTION_LOG_RESOURCE_KEYS,
      incomeKeys: ACTION_LOG_INCOME_KEYS,
    });
  }

  function formatActionLogImpact(before, after = createActionLogImpactSnapshot(), options = {}) {
    return actionLogRuntimeModule.formatImpact(before, after, {
      ...options,
      resourceKeys: ACTION_LOG_RESOURCE_KEYS,
      incomeKeys: ACTION_LOG_INCOME_KEYS,
      labels: INCOME_GAIN_LABELS,
      units: ACTION_LOG_DELTA_UNITS,
    });
  }

  function composeActionLogDetailWithImpact(detail, step) {
    const cleanDetail = simplifyActionLogDetailForLabel(step?.label, detail);
    const impactContext = `${normalizeActionLogText(step?.label)}；${cleanDetail}`;
    const impact = formatActionLogImpact(step?.logBefore, undefined, { detailText: impactContext });
    if (!impact) return cleanDetail || null;
    if (cleanDetail && cleanDetail.includes(impact)) return cleanDetail;
    return cleanDetail ? `${cleanDetail}；${impact}` : impact;
  }

  function ensureActionLogDraft(options = {}) {
    const readoutRoot = createStateSourceReadoutRoot();
    return actionLogRuntimeModule.ensureDraft(actionLogState, {
      getCurrentPlayer,
      currentPlayerId: readoutRoot.playerState.currentPlayerId,
      roundNumber: readoutRoot.turnState.roundNumber,
      turnNumber: readoutRoot.turnState.turnNumber,
      getPlayerLabelById,
      getActionCycleNumber,
      getActionLogActionLabel,
      historySourceQuick: HISTORY_SOURCE_QUICK,
      defaultQuickLabel: ACTION_LOG_DEFAULT_LABELS.quick,
    }, options);
  }

  function startActionLogDraft(actionType, label, options = {}) {
    if (options.source === HISTORY_SOURCE_MAIN) {
      cancelHandCardContextActions({ silent: true });
    }
    return ensureActionLogDraft({
      ...options,
      actionType,
      label: getActionLogActionLabel(actionType, label),
    });
  }

  function appendActionLogStep(source, label, detail = null, options = {}) {
    const draft = ensureActionLogDraft({
      source,
      actionType: options.actionType,
      label: options.actionLabel,
      player: options.player,
    });
    const step = normalizeActionLogStep(source, label, detail, options);
    if (!step) return null;
    draft.steps.push(step);
    renderActionLog();
    return step;
  }

  function removeLastActionLogStep(source, stepId = null) {
    const draft = actionLogState.draft;
    if (!draft?.steps?.length) return null;
    for (let index = draft.steps.length - 1; index >= 0; index -= 1) {
      const step = draft.steps[index];
      const sourceMatches = !source || step.source === source;
      const idMatches = !stepId || step.stepId === stepId;
      if (sourceMatches && idMatches) {
        const [removed] = draft.steps.splice(index, 1);
        pruneEmptyActionLogDraft();
        renderActionLog();
        return removed;
      }
    }
    return null;
  }

  function removeActionLogStepsBySource(source) {
    const draft = actionLogState.draft;
    if (!draft?.steps?.length) {
      pruneEmptyActionLogDraft();
      renderActionLog();
      return;
    }
    draft.steps = draft.steps.filter((step) => step.source !== source);
    pruneEmptyActionLogDraft();
    renderActionLog();
  }

  function pruneEmptyActionLogDraft() {
    actionLogRuntimeModule.pruneEmptyDraft(actionLogState, {
      hasMainHistorySession: () => actionHistory.hasSession(),
      hasQuickHistorySession: () => quickActionHistory.hasSession(),
      actionExecuted: isActionPending(),
    });
  }

  function resetActionLog() {
    actionLogState.entries = [];
    actionLogState.draft = null;
    actionLogState.nextEntryId = 1;
    resetActionBriefingState();
    renderActionLog();
  }

  function createGameRecoverySnapshot(meta = {}) {
    const readoutRoot = createStateSourceReadoutRoot();
    return gameRecoveryModule.createGameRecoverySnapshot({
      browserServices: residentBrowserServices,
      ruleLifecycleOptions: {
        seed: meta.seed ?? "browser-host",
        rngState: meta.rngState || { owner: headlessMode ? "headless" : "browser", state: null },
      },
      roundNumber: readoutRoot.turnState.roundNumber,
      turnNumber: readoutRoot.turnState.turnNumber,
      actionCycleNumber: getActionCycleNumber(),
      currentPlayerId: readoutRoot.playerState.currentPlayerId,
      entryId: meta.entryId ?? null,
      label: meta.label || null,
      runtime: {
        aiControl: createAiControlSnapshot(),
      },
    });
  }

  function attachRecoverySnapshotToActionLogEntry(entry, label = null) {
    if (headlessMode) return null;
    if (!entry) return null;
    const recoveryLabel = label || entry.actionLabel || entry.title || null;
    if (browserActionStableRecoverySnapshot) {
      entry.recoverySnapshot = structuredClone(browserActionStableRecoverySnapshot);
      entry.recoverySnapshot.meta.entryId = entry.id;
      entry.recoverySnapshot.meta.label = recoveryLabel;
    } else {
      entry.recoverySnapshot = createGameRecoverySnapshot({
        entryId: entry.id,
        label: recoveryLabel,
      });
    }
    return entry.recoverySnapshot;
  }

  function refreshLatestActionLogRecoverySnapshot(label = null) {
    if (headlessMode) return null;
    const entry = actionLogState.entries[actionLogState.entries.length - 1] || null;
    if (!entry) return null;
    attachRecoverySnapshotToActionLogEntry(entry, label);
    renderActionLog();
    schedulePersistentGameStateSave({ label: label || "行动日志恢复点" });
    return entry.recoverySnapshot;
  }

  function normalizeRecoverableActionLogEntry(entry, options = {}) {
    return gameRecoveryModule.normalizeRecoverableActionLogEntry(entry, options);
  }

  function getRecoverableActionLog(options = {}) {
    return gameRecoveryModule.getRecoverableActionLogEntries(actionLogState.entries, options);
  }

  function createActionLogRecoveryPackage(options = {}) {
    return gameRecoveryModule.createActionLogRecoveryPackage({
      version: GAME_RECOVERY_VERSION,
      entries: actionLogState.entries,
      includeRecovery: options.includeRecovery !== false,
      createSnapshot: createGameRecoverySnapshot,
    });
  }

  function getPersistentGameStorage() {
    if (headlessMode) return null;
    return gameRecoveryModule.getPersistentGameStorage(window);
  }

  function readPersistentGamePackage() {
    return gameRecoveryModule.readPersistentGamePackage(
      getPersistentGameStorage(),
      PERSISTENT_GAME_STORAGE_KEY,
    );
  }

  function hasPersistentGameState() {
    return gameRecoveryModule.hasPersistentGameState(readPersistentGamePackage());
  }

  function clearPersistentGameState() {
    return gameRecoveryModule.clearPersistentGameState(
      getPersistentGameStorage(),
      PERSISTENT_GAME_STORAGE_KEY,
    );
  }

  function isPersistentGameStateStable() {
    if (persistentGameSaveSuspended) return false;
    return !isActionPending()
      && !uiRuntimeState.effectStepActive
      && !decisionState.actionEffectFlow
      && !uiRuntimeState.alienRevealConfirmation
      && !hasTurnEndRevealContinuation()
      && !actionLogState.draft
      && !actionHistory.hasSession()
      && !quickActionHistory.hasSession()
      && !isActionEffectFlowActive()
      && !hasActivePendingSubFlow();
  }

  function createPersistentGamePackage(label = "本地自动保存") {
    return gameRecoveryModule.createPersistentGamePackage({
      version: GAME_RECOVERY_VERSION,
      label,
      entries: actionLogState.entries,
      activeReportTab: actionLogState.activeReportTab,
      createSnapshot: createGameRecoverySnapshot,
    });
  }

  function savePersistentGameStateNow(options = {}) {
    if (!options.force && !isPersistentGameStateStable()) {
      return { ok: false, skipped: true, message: "当前流程未稳定，保留上一个本地存档" };
    }
    const storage = getPersistentGameStorage();
    if (!storage) return { ok: false, message: "当前浏览器不支持本地保存" };
    try {
      storage.setItem(
        PERSISTENT_GAME_STORAGE_KEY,
        JSON.stringify(createPersistentGamePackage(options.label)),
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, message: String(error?.message || error) };
    }
  }

  function schedulePersistentGameStateSave(options = {}) {
    if (headlessMode) return;
    if (persistentGameSaveSuspended) return;
    if (persistentGameSaveTimer) {
      window.clearTimeout(persistentGameSaveTimer);
    }
    persistentGameSaveTimer = window.setTimeout(() => {
      persistentGameSaveTimer = 0;
      savePersistentGameStateNow(options);
    }, PERSISTENT_GAME_SAVE_DELAY_MS);
  }

  function restorePersistentGameState() {
    const saved = readPersistentGamePackage();
    const snapshot = saved?.latestSnapshot || null;
    if (!snapshot) return { ok: false, message: "没有可恢复的本地存档" };

    persistentGameSaveSuspended = true;
    try {
      const result = applyGameRecoverySnapshot(snapshot, {
        message: "已恢复上次保存的局面",
      });
      if (!result.ok) {
        clearPersistentGameState();
        return result;
      }
      if (Array.isArray(saved.entries)) {
        importActionLogEntries(saved.entries);
      }
      const latestEntry = actionLogState.entries[actionLogState.entries.length - 1] || null;
      if (latestEntry && !latestEntry.recoverySnapshot) {
        latestEntry.recoverySnapshot = structuredClone(snapshot);
      }
      if (saved.activeReportTab) {
        setReportTab(saved.activeReportTab);
      }
      return result;
    } catch (error) {
      console.warn("[SETI] 恢复本地存档失败，已清除坏存档", error);
      clearPersistentGameState();
      return { ok: false, message: "恢复本地存档失败" };
    } finally {
      persistentGameSaveSuspended = false;
    }
  }

  function countPlayerOwnedTechForActionLogExport(player) {
    const ownedTiles = player?.techState?.ownedTiles || {};
    return Object.values(ownedTiles).reduce((total, value) => {
      if (Array.isArray(value)) return total + value.length;
      return total + (value ? 1 : 0);
    }, 0);
  }

  function buildActionLogMarkdownContext(options = {}) {
    const generatedAt = options.generatedAt || new Date();
    const readoutRoot = createStateSourceReadoutRoot();
    return {
      generatedAt,
      isGameEnded: isGameEnded(),
      gameEndReason: readoutRoot.turnState.gameEndReason || null,
      roundNumber: readoutRoot.turnState.roundNumber,
      turnNumber: getDisplayedTurnNumber(),
      turnState: {
        ...structuredClone(readoutRoot.turnState),
        displayedTurnNumber: getDisplayedTurnNumber(),
        currentPlayerId: readoutRoot.playerState.currentPlayerId,
      },
      entries: getRecoverableActionLog({ includeRecovery: false }),
      playerResults: buildActionLogExportPlayerResults(),
    };
  }

  function getActionLogMarkdown(options = {}) {
    return actionLogExport.buildActionLogMarkdown(
      buildActionLogMarkdownContext(options),
      options,
    );
  }

  function createActionLogMarkdownDownload(markdown, filename) {
    const urlApi = window.URL || window.webkitURL;
    if (typeof Blob !== "function" || !urlApi?.createObjectURL || !document.body) {
      return { ok: false, message: "当前浏览器不支持下载行动日志" };
    }
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = urlApi.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => urlApi.revokeObjectURL(url), 0);
    return { ok: true };
  }

  function downloadActionLogMarkdown(options = {}) {
    const generatedAt = options.generatedAt || new Date();
    const context = buildActionLogMarkdownContext({ ...options, generatedAt });
    const filename = actionLogExport.createActionLogMarkdownFilename(generatedAt);
    const entryCount = context.entries.length;
    if (!context.isGameEnded && options.allowIncomplete !== true) {
      const result = {
        ok: false,
        filename,
        entryCount,
        message: "游戏尚未结束，终局行动日志需要在游戏结束后下载",
      };
      setBrowserStatusNote(result.message);
      renderStateReadout();
      return result;
    }

    const markdown = actionLogExport.buildActionLogMarkdown(context, { ...options, generatedAt });
    const downloadResult = createActionLogMarkdownDownload(markdown, filename);
    const result = {
      ok: Boolean(downloadResult.ok),
      filename,
      entryCount,
      message: downloadResult.ok
        ? `已生成行动日志：${filename}`
        : downloadResult.message || "行动日志下载失败",
    };
    setBrowserStatusNote(result.message);
    renderStateReadout();
    return result;
  }

  function getRecoveryEntriesFromInput(logOrPackage) {
    return gameRecoveryModule.getRecoveryEntriesFromInput(logOrPackage);
  }

  function getRecoverySnapshotFromLog(logOrPackage, options = {}) {
    return gameRecoveryModule.getRecoverySnapshotFromLog(logOrPackage, options);
  }

  function clearTransientStateForRecovery(workingRoot = null) {
    if (!workingRoot) {
      return browserRuleComposition.inputPort.submitHostCommand({ kind: "recovery_clear_transient" });
    }
    const { cardState: workingCardState, techGameState: workingTechGameState } = workingRoot;
    decisionState.discardAction = null;
    decisionState.cardSelectionAction = null;
    decisionSessions.clear(PASS_RESERVE_SELECTION_SESSION);
    uiRuntimeState.passReserveSelectionDismissed = false;
    decisionState.scanTargetAction = null;
    decisionSessions.clear(PROBE_SECTOR_SCAN_SESSION);
    decisionSessions.clear(PUBLIC_SCAN_QUEUE_SESSION);
    decisionState.handScanAction = null;
    decisionState.alienTraceAction = null;
    decisionSessions.clear(LAND_TARGET_DECISION);
    decisionSessions.clear(PROBE_LOCATION_REWARD_SESSION);
    decisionSessions.clear(CARD_TRIGGER_ACTION_SESSION);
    decisionSessions.clear(CARD_TRIGGER_FREE_MOVE_SESSION);
    if (workingRoot.match && typeof workingRoot.match === "object") {
      delete workingRoot.match.type1TriggerEvents;
    }
    decisionSessions.clear(CARD_TASK_COMPLETION_SESSION);
    alienSpeciesRuntime?.clearJiuzheCardPlayDecisionDraft?.();
    uiRuntimeState.jiuzheOpportunityOpen = false;
    uiRuntimeState.jiuzheCardViewOpen = false;
    alienSpeciesRuntime?.clearYichangdianCardGainDecisionDraft?.();
    effectExecutors?.clearYichangdianCornerAction?.();
    alienSpeciesRuntime?.clearBanrenmaCardGainDecisionDraft?.();
    alienSpeciesRuntime?.clearBanrenmaOpportunityDecisionDraft?.();
    if (workingRoot.match && typeof workingRoot.match === "object") {
      delete workingRoot.match.jiuzheOpportunityQueue;
      delete workingRoot.match.banrenmaOpportunityQueue;
    }
    alienSpeciesRuntime?.clearChongCardGainDecisionDraft?.();
    alienSpeciesRuntime?.clearChongFossilDecisionDraft?.();
    alienSpeciesRuntime?.clearAmibaCardGainDecisionDraft?.();
    alienSpeciesRuntime?.clearAmibaSymbolDecisionDraft?.();
    alienSpeciesRuntime?.clearAmibaTraceRemovalDecisionDraft?.();
    alienSpeciesRuntime?.clearAomomoCardGainDecisionDraft?.();
    alienSpeciesRuntime?.clearRunezuCardGainDecisionDraft?.();
    alienSpeciesRuntime?.clearRunezuSymbolBranchDecisionDraft?.();
    alienSpeciesRuntime?.clearRunezuFaceSymbolDecisionDraft?.();
    decisionState.alienTracePickerState = null;
    closeAlienRevealConfirmationOverlay();
    if (workingRoot.match && typeof workingRoot.match === "object") {
      delete workingRoot.match.turnEndRevealContinuation;
    }
    uiRuntimeState.debugAlienTraceModeActive = false;
    decisionState.actionEffectFlow = null;
    clearCompletedEffectFlowForUndo();
    uiRuntimeState.effectStepActive = false;
    uiRuntimeState.moveHighlightRocketId = null;
    decisionSessions.clear(MOVE_PAYMENT_SESSION);
    decisionSessions.clear(PLAY_CARD_SELECTION_SESSION);
    decisionSessions.clear(HAND_CARD_PLAY_SESSION);
    decisionSessions.clear(CARD_CORNER_QUICK_SESSION);
    decisionSessions.clear(CARD_CORNER_FREE_MOVE_SESSION);
    decisionSessions.clear(DATA_PLACEMENT_DECISION);
    decisionSessions.clear("industry_ability");
    decisionSessions.clear(PIRATES_RAID_DECISION);
    decisionSessions.clear(STRATEGY_SLOT_DECISION);
    uiRuntimeState.industryFreeMoveState = null;
    historyStepOrder.length = 0;
    actionHistory.commitSession();
    quickActionHistory.commitSession();
    cards.setSelectionActive(workingCardState, false);
    cards.setPlayCardSelectionActive(workingCardState, false);
    cards.setDiscardSelectionActive(workingCardState, false, 0);
    if (workingTechGameState?.ui) {
      workingTechGameState.ui.industryBorrowMode = false;
    }
    tech.setTechSelectionActive(workingTechGameState, false);
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
    if (els.alienTraceOverlay) els.alienTraceOverlay.hidden = true;
    if (els.alienTraceTitle) els.alienTraceTitle.textContent = "获取外星人标记";
    if (els.alienTraceSubtitle) els.alienTraceSubtitle.classList.remove("alien-reveal-confirmation-text");
    if (els.alienTraceCancel) els.alienTraceCancel.hidden = false;
    if (els.landTargetOverlay) els.landTargetOverlay.hidden = true;
    if (els.dataPlaceOverlay) els.dataPlaceOverlay.hidden = true;
    if (els.actionEffectBar) els.actionEffectBar.hidden = true;
    closeFinalResultDialog({ silent: true });
    els.appWrap?.classList.remove(
      "action-effect-flow-active",
      "move-mode-active",
      "card-selection-active",
      "play-card-selection-active",
      "card-corner-action-active",
      "discard-selection-active",
      "pass-reserve-selection-active",
      "hand-scan-selection-active",
      "industry-hand-selection-active",
    );
    if (els.passReserveSelectionOverlay) {
      els.passReserveSelectionOverlay.hidden = true;
      els.passReserveSelectionOverlay.setAttribute("aria-hidden", "true");
    }
  }

  function refreshAfterGameRecovery(message = "已从行动日志恢复局面", workingRoot = null) {
    if (!workingRoot) {
      return browserRuleComposition.inputPort.submitHostCommand({
        kind: "recovery_refresh",
        message,
      });
    }
    setTokenAssetSizes();
    renderWheels();
    renderSectors();
    renderRotateStateToken();
    syncPlanetOrbitLandMarkers();
    refreshHelpers.refreshBoardState({
      includeSectorNebula: false,
      includeFinalScore: true,
      includeTech: true,
    });
    renderPublicCards();
    updatePublicCardControls();
    renderReservedCards();
    renderInitialSelectionArea();
    renderPlayerHand();
    refreshHelpers.refreshPlayerPanels();
    renderRoundStatus();
    renderDebugPlayerSwitch();
    syncCardSelectionChrome();
    syncDiscardSelectionChrome();
    syncPassReserveSelectionChrome();
    syncHandScanSelectionChrome();
    syncPlayCardSelectionChrome();
    syncTechSelectionChrome();
    syncIndustryHandSelectionChrome();
    syncInteractionFocusChrome();
    workingRoot.rocketState.statusNote = message;
    refreshHelpers.refreshActionState({ includeStateReadout: true });
    renderActionLog();
  }

  function applyGameRecoverySnapshot(snapshot, options = {}) {
    return gameRecoveryModule.applyGameRecoverySnapshot(snapshot, {
      ...options,
      browserServices: residentBrowserServices,
      onAfterStateRestored: () => {
        getActionCycleNumber();
        clearTransientStateForRecovery();
      },
      restoreAiControlSnapshot,
      refreshAfterGameRecovery: options.skipRefresh ? null : refreshAfterGameRecovery,
      getRecoveryMessage: () => createStateSourceReadoutRoot().rocketState.statusNote,
    });
  }

  function importActionLogEntries(entries, options = {}) {
    actionLogRuntimeModule.importEntries(actionLogState, entries, options);
  }

  function recoverFromActionLog(logOrPackage, options = {}) {
    const entries = getRecoveryEntriesFromInput(logOrPackage);
    const snapshot = getRecoverySnapshotFromLog(logOrPackage, options);
    if (!snapshot) {
      return { ok: false, message: "行动日志中没有可恢复快照" };
    }
    const result = applyGameRecoverySnapshot(snapshot, {
      message: options.message || "已根据行动日志恢复局面",
    });
    if (!result.ok) return result;
    if (entries.length && options.restoreLog !== false) {
      importActionLogEntries(entries, {
        truncateToEntryId: options.entryId,
        truncateToIndex: Number.isInteger(options.index) ? options.index : null,
      });
    }
    return result;
  }

  function commitActionLogDraft(options = {}) {
    const entry = actionLogRuntimeModule.createEntryFromDraft(actionLogState, {
      getDisplayedTurnNumber,
      getActionCycleNumber,
      getActionLogActionLabel,
    }, options);
    if (!entry && !actionLogState.draft) {
      renderActionLog();
      return null;
    }
    attachRecoverySnapshotToActionLogEntry(entry, "行动提交后状态");
    actionLogState.nextEntryId += 1;
    actionLogState.entries.push(entry);
    rememberActionBriefingEntry(entry);
    actionLogState.draft = null;
    renderActionLog();
    schedulePersistentGameStateSave({ label: "行动提交后状态" });
    return entry;
  }

  function appendConfirmedActionLogEntry(entryInput) {
    const readoutRoot = createStateSourceReadoutRoot();
    const entry = actionLogRuntimeModule.createConfirmedEntry(actionLogState, entryInput, {
      getCurrentPlayer,
      roundNumber: readoutRoot.turnState.roundNumber,
      turnNumber: readoutRoot.turnState.turnNumber,
      getDisplayedTurnNumber,
      getActionCycleNumber,
      getPlayerLabelById,
      getActionLogActionLabel,
      historySourceMain: HISTORY_SOURCE_MAIN,
      getCardLabel: cards.getCardLabel,
    });
    attachRecoverySnapshotToActionLogEntry(entry, entry.title || "已确认日志后状态");
    actionLogState.nextEntryId += 1;
    actionLogState.entries.push(entry);
    rememberActionBriefingEntry(entry);
    renderActionLog();
    schedulePersistentGameStateSave({ label: entry.title || "已确认日志后状态" });
    return entry;
  }

  function isWeakStartAiDifficulty(player) {
    return player?.aiDifficulty === AI_DIFFICULTY_WEAK_START;
  }

  function isPlayerPassedThisRound(playerId) {
    return createStateSourceReadoutRoot().turnState.passedPlayerIds.includes(playerId);
  }

  function hasPlayerCompletedThisTurn(playerId) {
    return createStateSourceReadoutRoot().turnState.completedTurnPlayerIds.includes(playerId);
  }

  function getFirstEligiblePlayerId() {
    return getRoundOrderPlayerIds().find((playerId) => !isPlayerPassedThisRound(playerId)) || null;
  }

  function getNextEligiblePlayerId(afterPlayerId) {
    const order = getRoundOrderPlayerIds();
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
    const readoutTurnState = createStateSourceReadoutRoot().turnState;
    return readoutTurnState.activePlayerIds.length > 0
      && readoutTurnState.activePlayerIds.every((playerId) => readoutTurnState.passedPlayerIds.includes(playerId));
  }

  function isFinalRound(candidateTurnState = null) {
    const resolvedTurnState = candidateTurnState || createStateSourceReadoutRoot().turnState;
    return Number(resolvedTurnState.roundNumber) >= FINAL_ROUND_NUMBER;
  }

  function isGameEnded() {
    return Boolean(createStateSourceReadoutRoot().turnState.gameEnded);
  }

  function buildFinalScoreSummaryLinesForRoot(workingRoot) {
    return (workingRoot.playerState.players || [])
      .filter((player) => workingRoot.turnState.activePlayerIds.includes(player.id))
      .map((player) => {
        const breakdown = computePlayerFinalScoreBreakdown(player, workingRoot);
        return `${player.colorLabel || player.name || player.id}：${breakdown.totalScore} 分`;
      });
  }

  function buildFinalScoreSummaryLines() {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "score_build_final_summary",
    }, { commit: false }).value || [];
  }

  function ensureTurnVisitedPlanetsByPlayerId(workingRoot) {
    const { turnState } = workingRoot;
    if (!turnState.visitedPlanetsByPlayerId || typeof turnState.visitedPlanetsByPlayerId !== "object") {
      turnState.visitedPlanetsByPlayerId = {};
    }
    return turnState.visitedPlanetsByPlayerId;
  }

  function hasPlayerVisitedPlanetThisTurn(workingRoot, player, planetId) {
    const playerId = player?.id || player?.playerId || null;
    if (!playerId || !planetId) return false;
    return (ensureTurnVisitedPlanetsByPlayerId(workingRoot)[playerId] || []).includes(planetId);
  }

  function recordTurnVisitPlanetEvents(workingRoot, events = []) {
    const { turnState } = workingRoot;
    const visitEvents = (events || []).filter((event) => event?.type === "visitPlanet" && event.planetId);
    if (!visitEvents.length) return null;
    const beforeVisits = structuredClone(turnState.visitedPlanetsByPlayerId || {});
    const visitsByPlayerId = ensureTurnVisitedPlanetsByPlayerId(workingRoot);
    let changed = false;
    for (const event of visitEvents) {
      const playerId = event.playerId || getCurrentPlayer()?.id || null;
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

  function renderRoundStatus() {
    const input = createResidentRenderInput();
    if (input) residentDesktopRenderer.renderRoundStatus(input);
  }

  function getTurnReadoutLines() {
    const readoutTurnState = createStateSourceReadoutRoot().turnState;
    const orderLabels = readoutTurnState.turnOrderPlayerIds.map(getPlayerLabelById).join(" > ");
    const roundOrderLabels = getRoundOrderPlayerIds().map(getPlayerLabelById).join(" > ");
    const passedLabels = readoutTurnState.passedPlayerIds.map(getPlayerLabelById).join("、") || "无";
    const completedLabels = readoutTurnState.completedTurnPlayerIds.map(getPlayerLabelById).join("、") || "无";
    const agentLabels = (readoutTurnState.activePlayerIds || [])
      .map((playerId) => `${getPlayerLabelById(playerId)}=${getPlayerAgentLabel(playerId)}`)
      .join("、") || "无";

    return [
      "轮次状态",
      isGameEnded()
        ? `游戏结束：第${readoutTurnState.roundNumber}轮全员 PASS，进行终局计分`
        : `第${readoutTurnState.roundNumber}轮 第${getDisplayedTurnNumber()}回合`,
      `基础顺位 ${orderLabels || "无"}`,
      `本轮顺位 ${roundOrderLabels || "无"}`,
      `玩家代理 ${agentLabels}`,
      `本轮已 PASS ${passedLabels}`,
      `当前行动圈已行动 ${completedLabels}`,
    ];
  }

  function isCardSelectionActive() {
    return cards.isSelectionActive(createStateSourceReadoutRoot().cardState);
  }

  function isDiscardSelectionActive() {
    return cards.isDiscardSelectionActive(createStateSourceReadoutRoot().cardState);
  }

  function isPlayCardSelectionActive() {
    return cards.isPlayCardSelectionActive(createStateSourceReadoutRoot().cardState);
  }

  function allowsBlindDrawInSelection() {
    return decisionState.cardSelectionAction?.allowBlindDraw !== false;
  }


  function isPublicScanMultiSelectActive() {
    return isCardSelectionActive()
      && decisionState.cardSelectionAction?.type === "public_scan"
      && (decisionState.cardSelectionAction.maxSelectable ?? 1) > 1;
  }

  function isPublicCornerDiscardSelectionActive() {
    return isCardSelectionActive()
      && decisionState.cardSelectionAction?.type === "card_public_corner_discard";
  }

  function isPublicCardMultiSelectActive() {
    return isPublicScanMultiSelectActive() || isPublicCornerDiscardSelectionActive();
  }

  function getPublicCardMultiSelectMinSelectable(pending = decisionState.cardSelectionAction) {
    if (pending?.type === "public_scan") return getPublicScanMinSelectable(pending);
    const maxSelectable = Math.max(1, Math.round(Number(pending?.maxSelectable) || 1));
    const requested = Math.max(1, Math.round(Number(pending?.minSelectable) || maxSelectable));
    return Math.min(maxSelectable, requested);
  }

  function syncPublicScanConfirmButton() {
    if (!els.publicScanConfirm) return;
    const multi = isPublicCardMultiSelectActive();
    els.publicScanConfirm.hidden = !multi;
    if (!multi) return;
    const count = decisionState.cardSelectionAction?.selectedSlots?.length || 0;
    const minSelectable = getPublicCardMultiSelectMinSelectable();
    els.publicScanConfirm.disabled = count < minSelectable;
    const label = decisionState.cardSelectionAction?.type === "card_public_corner_discard"
      ? "确认弃除"
      : "确认扫描";
    els.publicScanConfirm.textContent = count > 0
      ? `${label}（${count}/${minSelectable}张）`
      : label;
  }

  function syncCardSelectionChrome() {
    const active = isCardSelectionActive();
    if (active) cancelHandCardContextActions({ silent: true });
    els.appWrap?.classList.toggle("card-selection-active", active);
    els.publicCardPanel?.classList.toggle("card-selection-active", active);
    els.publicCardPanel?.classList.toggle("public-card-panel-focused", active);
    if (els.cardSelectionBackdrop) {
      els.cardSelectionBackdrop.hidden = !active;
      els.cardSelectionBackdrop.setAttribute("aria-hidden", String(!active));
    }
    if (els.cardSelectionCancel) {
      els.cardSelectionCancel.hidden = !active;
    }
    syncPublicScanConfirmButton();
    if (active) setQuickPanelOpen(false);
    renderPublicCards();
    updatePublicCardControls();
    syncInteractionFocusChrome();
  }

  const INTERACTION_FOCUS = Object.freeze({
    PUBLIC_CARDS: "public-cards",
    HAND_CARDS: "hand-cards",
    TECH_PANEL: "tech-panel",
    BOARD_ROCKETS: "board-rockets",
    COMPANY_MARKER: "company-marker",
    PLAYER_BOARD: "player-board",
  });

  function isBoardRocketInteractionActive() {
    return uiRuntimeState.moveHighlightRocketId != null
      || isIndustryFreeMoveActive()
      || Boolean(getPendingCardTriggerFreeMove())
      || Boolean(getPendingCardCornerFreeMove())
      || Boolean(decisionState.actionEffectFlow?.freeMoveMode)
      || Boolean(decisionState.actionEffectFlow?.cardMoveEffect);
  }

  function getInteractionFocusMode() {
    if (isIndustryHandSelectionActive()) return INTERACTION_FOCUS.HAND_CARDS;
    if (isDiscardSelectionActive()
      || isPlayCardSelectionActive()
      || isMovePaymentSelectionActive()
      || isHandScanSelectionActive()) {
      return INTERACTION_FOCUS.HAND_CARDS;
    }
    if (isCardSelectionActive()) return INTERACTION_FOCUS.PUBLIC_CARDS;
    if (isTechTilePickingActive() || createStateSourceReadoutRoot().techGameState?.ui?.industryBorrowMode) {
      return INTERACTION_FOCUS.TECH_PANEL;
    }
    if (getPendingPiratesRaidDecision()) return INTERACTION_FOCUS.PLAYER_BOARD;
    if (isBoardRocketInteractionActive()) return INTERACTION_FOCUS.BOARD_ROCKETS;
    if ((canUseCardCornerQuickAction() && getPendingCardCornerQuickAction()) || getPendingHandCardPlayAction()) {
      return INTERACTION_FOCUS.HAND_CARDS;
    }
    return null;
  }

  function syncInteractionFocusChrome() {
    const mode = getInteractionFocusMode();
    if (!els.appWrap) return;
    els.appWrap.dataset.interactionFocus = mode || "";
    els.appWrap.classList.toggle("has-future-span-ready-card", hasPlayableFutureSpanCard(getCurrentPlayer()));
    els.boardShell?.classList.toggle("board-shell-focused", mode === INTERACTION_FOCUS.BOARD_ROCKETS);
  }

  function syncIndustryHandSelectionChrome() {
    const active = isIndustryHandSelectionActive();
    if (active) cancelHandCardContextActions({ silent: true });
    els.appWrap?.classList.toggle("industry-hand-selection-active", active);
    els.playerHandPanel?.classList.toggle("industry-hand-selection-active", active);
    els.playerHandPanel?.classList.toggle("player-hand-panel-focused", active);
    if (active) {
      setQuickPanelOpen(false);
      scrollToPlayerHandPanel();
    }
    updatePlayerHandPanelTitle();
    renderPlayerHand();
    renderInitialSelectionArea();
    syncInteractionFocusChrome();
  }

  function canSelectRocketForMoveInteraction(rocket) {
    const player = getCurrentPlayer();
    if (rocket.playerId !== player?.id) return false;
    if (!(rocketActions.isMovablePlayerToken?.(rocket) || rocketActions.isControllablePlayerRocket(rocket))) return false;
    if (isRocketOnPlanetsReference(rocket)) return false;
    if (uiRuntimeState.industryFreeMoveState?.movedRocketIds?.includes(rocket.id)) return false;
    return true;
  }

  function isRocketMoveCandidate(rocket) {
    if (!isBoardRocketInteractionActive()) return false;
    if (uiRuntimeState.moveHighlightRocketId != null) return rocket.id === uiRuntimeState.moveHighlightRocketId;
    return canSelectRocketForMoveInteraction(rocket);
  }

  function isRocketMoveMuted(rocket) {
    if (!isBoardRocketInteractionActive()) return false;
    if (isRocketMoveCandidate(rocket)) return false;
    if (isRocketOnPlanetsReference(rocket)) return false;
    return true;
  }


  function isAiAutomationInputLocked(player = getCurrentPlayer()) {
    return Boolean(player?.id && isAiAutoBattlePlayer(player.id) && !isAiAutomationPaused());
  }

  function isPendingLockedForAiAutomation(pending = null, fallbackEffect = null) {
    const player = getPendingOwnerPlayer(pending, fallbackEffect);
    return Boolean(player?.id && isAiAutoBattlePlayer(player.id) && !isAiAutomationPaused());
  }

  function blockManualAiAutomationInput(message = null, player = getCurrentPlayer()) {
    const statusNote = message || `${player?.colorLabel || "电脑玩家"}AI 正在自动行动`;
    setBrowserStatusNote(statusNote);
    scheduleAiAutoStepIfNeeded();
    renderStateReadout();
    return { ok: false, blocked: true, message: statusNote };
  }

  function blockManualAiPendingInput(pending = null, label = "待处理操作", fallbackEffect = null) {
    const player = getPendingOwnerPlayer(pending, fallbackEffect);
    return blockManualAiAutomationInput(
      `${player?.colorLabel || "电脑玩家"}AI 正在处理${label}`,
      player,
    );
  }

  function blockManualAiPendingInputIfNeeded(pending = null, options = {}, label = "待处理操作", fallbackEffect = null) {
    if (options.automated === true || !isPendingLockedForAiAutomation(pending, fallbackEffect)) return null;
    return blockManualAiPendingInput(pending, label, fallbackEffect);
  }

  function blockManualAiMovePayment(message = null) {
    const player = getMovePaymentPlayer();
    return blockManualAiAutomationInput(
      message || `${player?.colorLabel || "电脑玩家"}AI 正在确认移动支付`,
      player,
    );
  }

  function isMovePaymentCard(card) {
    return Number(card?.discardActionCode) === MOVE_DISCARD_ACTION_CODE
      || Boolean(cards.getDiscardActionMoveRewardForCard?.(card));
  }

  function playerHasMovePaymentCard(player) {
    return (player?.hand || []).some((card) => isMovePaymentCard(card));
  }

  function getMovePaymentCardCount(player) {
    return (player?.hand || []).filter((card) => isMovePaymentCard(card)).length;
  }

  function getSectorContentForMove(coordinate) {
    if (!coordinate) return null;
    return solar.resolveVisibleContent(
      coordinate.x,
      coordinate.y,
      createStateSourceReadoutRoot().solarState,
    )?.content || null;
  }

  function isAsteroidContent(content) {
    return content?.kind === solar.layout.CONTENT_KIND.ASTEROID;
  }

  function getRequiredMovePointsForUiForRoot(workingRoot, player, rocketId, deltaX, deltaY, options = {}) {
    const rocket = workingRoot.rocketState.rockets.find((item) => item.id === rocketId);
    const from = rocketActions.getRocketSectorCoordinate(rocket);
    if (!from) return 1;
    const fromContent = solar.resolveVisibleContent(from.x, from.y, workingRoot.solarState)?.content || null;
    if (!options.ignoreAsteroidRestriction
      && isAsteroidContent(fromContent)
      && !players.playerOwnsTech(player, "orange2", workingRoot.turnState)) {
      return 2;
    }
    return 1;
  }

  function getRequiredMovePointsForUi(...args) {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "ui_get_required_move_points", args }, { commit: false }).value;
  }

  function canPayForMove(player, requiredMovePoints = MOVE_ENERGY_COST) {
    const energy = Number(player?.resources?.energy) || 0;
    const movementCards = getMovePaymentCardCount(player);
    if (energy + movementCards >= requiredMovePoints) return { ok: true };
    return { ok: false, message: `移动力不足，需要 ${requiredMovePoints} 点移动力` };
  }


  function scrollToPlayerCommandPanel() {
    const panel = els.playerCommand || els.actionEffectBar || els.actionLaunchButton;
    if (!panel) return;

    requestAnimationFrame(() => {
      panel.scrollIntoView({
        behavior: "auto",
        block: "start",
        inline: "nearest",
      });
    });
  }


  function getNormalTokenAssetForPlayer(player) {
    return players.getPlayerColorDefinition(player?.color)?.normalTokenAsset
      || "../assets/tokens/normal_token.png";
  }

  function getNeutralScoreTraceColor() {
    const activeColors = new Set(getActivePlayers().map((player) => player.color).filter(Boolean));
    return players.PLAYER_COLOR_IDS.find((colorId) => !activeColors.has(colorId)) || null;
  }

  function getCrossedNeutralScoreTraceThresholds(workingRoot, beforeScore, afterScore) {
    const before = Number(beforeScore) || 0;
    const after = Number(afterScore) || 0;
    if (after <= before) return [];
    return (aliens.NEUTRAL_SCORE_TRACE_THRESHOLDS || [20, 30]).filter((threshold) => (
      before < Number(threshold)
      && after >= Number(threshold)
      && !aliens.getNeutralScoreTraceMark?.(workingRoot.alienGameState, threshold)
    ));
  }

  function recordNeutralScoreTraceRestore(workingRoot, beforeAlienState, history = null) {
    const command = historyCommands.createRestoreObjectCommand(
      workingRoot.alienGameState,
      beforeAlienState,
      "恢复分数阈值中立首痕迹",
    );
    if (history === quickActionHistory) {
      recordQuickHistoryCommand(command);
    } else {
      recordHistoryCommand(command);
    }
  }

  function placeNeutralScoreTraceForThreshold(workingRoot, player, threshold, options = {}) {
    const activeIds = new Set(workingRoot.turnState.activePlayerIds || []);
    const activePlayerIds = new Set((workingRoot.playerState.players || [])
      .filter((item) => activeIds.has(item.id))
      .map((item) => item.id));
    if (!player?.id || !activePlayerIds.has(player.id)) return null;
    const neutralColor = getNeutralScoreTraceColor();
    if (!neutralColor) return null;

    const beforeAlienState = structuredClone(workingRoot.alienGameState);
    const result = aliens.placeNeutralScoreTraceForThreshold?.(
      workingRoot.alienGameState,
      threshold,
      player,
      neutralColor,
    );
    if (!result?.ok) return result || null;

    recordNeutralScoreTraceRestore(workingRoot, beforeAlienState, options.history || null);
    renderAlienPanels();
    return result;
  }

  function handlePlayerScoreChanged(workingRoot, player, payload = {}, options = {}) {
    const thresholds = getCrossedNeutralScoreTraceThresholds(workingRoot, payload.beforeScore, payload.afterScore);
    const placed = [];
    for (const threshold of thresholds) {
      const result = placeNeutralScoreTraceForThreshold(workingRoot, player, threshold, options);
      if (result?.ok) placed.push(result);
    }
    return placed;
  }

  function recordNeutralScoreTracesFromScanResult(workingRoot, scanResult, history = null) {
    const scoreAwarded = Number(
      scanResult?.scoreAwarded
      ?? scanResult?.replaced?.scoreAwarded
      ?? scanResult?.payload?.replaced?.scoreAwarded
      ?? 0,
    );
    if (scoreAwarded <= 0) return [];
    const player = getScanScorePlayer(scanResult);
    if (!player) return [];
    const afterScore = Number(player.resources?.score) || 0;
    return handlePlayerScoreChanged(workingRoot, player, {
      gain: { score: scoreAwarded },
      beforeScore: afterScore - scoreAwarded,
      afterScore,
      scoreDelta: scoreAwarded,
    }, { history });
  }

  function recordNeutralScoreTracesFromAbilityResult(workingRoot, result, history = null) {
    const scanResults = [
      result,
      result?.payload?.industryLaunchScan,
    ].filter(Boolean);
    return scanResults.flatMap((scanResult) => (
      recordNeutralScoreTracesFromScanResult(workingRoot, scanResult, history)
    ));
  }

  finalScoreAiRuntime = finalScoreAiRuntimeModule.createFinalScoreAiRuntime({
    FINAL_ROUND_NUMBER,
    FINAL_SCORE_IDS,
    aiNumber,
    aiRaceModel,
    aiValuation,
    aliens,
    applyAiStrategyWeight,
    cardEffects,
    createActionContext: createReadoutActionContext,
    endGameScoring,
    finalScoring,
    getAiMapDemand,
    getAiRemainingRoundWeight,
    getAiStrategyDemand,
    getCardTypeCode,
    getCurrentPlayer,
    getPlayerById,
    handleFinalScoreTileClick,
    isAiAutoBattlePlayer,
    recordAiAutoBattleLog,
    sumAiDemandMap,
    syncFinalScorePendingMarks,
    getRuleReadout: createStateSourceReadoutRoot,
  });


  function runDebugQuickSectorScan(playerId, sectorId, count) {
    return callDebugCommand("runDebugQuickSectorScan", [playerId, sectorId, count]);
  }

  function handleDebugQuickSectorScanChoice(button) {
    return callDebugCommand("handleDebugQuickSectorScanChoice", [{ ...(button?.dataset || {}) }]);
  }

  function openDebugQuickSectorScanPicker() {
    return callDebugCommand("openDebugQuickSectorScanPicker");
  }


  function buildCardCornerMoveEffectFromReward(effect, card, moveReward, index) {
    const movementPoints = Math.max(1, Math.round(Number(moveReward.movementPoints || 1)));
    return {
      id: `${effect?.id || "public-corner"}-move-${index + 1}-${card.id}`,
      type: cardEffects.EFFECT_TYPES.CARD_MOVE,
      label: `${cards.getCardLabel(card)}：${moveReward.label}`,
      icon: "movement",
      options: {
        movementPoints,
        historyLabel: moveReward.label,
      },
    };
  }

  function buildRepeatedCardCornerMoveEffect(effect, card, moveReward, repeat) {
    const repeatCount = Math.max(1, Math.round(Number(repeat || 1)));
    const baseMovementPoints = Math.max(1, Math.round(Number(moveReward?.movementPoints || 1)));
    const totalMovementPoints = baseMovementPoints * repeatCount;
    return {
      id: `${effect?.id || "repeat-corner"}-move-${card.id}`,
      type: cardEffects.EFFECT_TYPES.CARD_MOVE,
      label: `${cards.getCardLabel(card)}：${totalMovementPoints}移动（${moveReward.label} x${repeatCount}）`,
      icon: "movement",
      options: {
        movementPoints: totalMovementPoints,
        historyLabel: `${moveReward.label} x${repeatCount}`,
      },
    };
  }

  function formatRepeatedCardCornerMoveReward(moveReward, repeat) {
    const repeatCount = Math.max(1, Math.round(Number(repeat || 1)));
    const baseMovementPoints = Math.max(1, Math.round(Number(moveReward?.movementPoints || 1)));
    const repeatedGain = Object.fromEntries(Object.entries(moveReward?.gain || {})
      .map(([key, value]) => [key, Number(value) * repeatCount])
      .filter(([, value]) => Number.isFinite(value) && value !== 0));
    return [formatPlanetRewardGain(repeatedGain), `${baseMovementPoints * repeatCount}移动`]
      .filter(Boolean)
      .join("、");
  }

  function handlePublicCornerDiscardCardClickForRoot(workingRoot, slotIndex) {
    const { cardState: workingCardState, rocketState: workingRocketState } = workingRoot;
    const index = Number(slotIndex);
    const card = workingCardState.publicCards[index];
    if (!card) {
      workingRocketState.statusNote = "该公共牌位没有卡牌";
      renderStateReadout();
      return { ok: false, message: workingRocketState.statusNote };
    }

    const pending = decisionState.cardSelectionAction;
    const maxSelectable = pending?.maxSelectable ?? 1;
    const selectedSlots = pending.selectedSlots || [];
    const existingIndex = selectedSlots.indexOf(index);
    if (existingIndex >= 0) {
      selectedSlots.splice(existingIndex, 1);
    } else if (selectedSlots.length >= maxSelectable) {
      workingRocketState.statusNote = `最多选择 ${maxSelectable} 张公共牌`;
      renderStateReadout();
      return { ok: false, message: workingRocketState.statusNote };
    } else {
      selectedSlots.push(index);
    }

    pending.selectedSlots = selectedSlots;
    const count = selectedSlots.length;
    const minSelectable = getPublicCardMultiSelectMinSelectable(pending);
    workingRocketState.statusNote = count > 0
      ? `公共牌角标：已选 ${count}/${maxSelectable} 张${count < minSelectable ? `，至少需要 ${minSelectable} 张` : "，点击确认弃除"}`
      : `公共牌角标：请选择 ${minSelectable} 张公共牌弃除`;
    syncPublicScanConfirmButton();
    renderPublicCards();
    renderStateReadout();
    return { ok: true, message: workingRocketState.statusNote };
  }

  function handlePublicCornerDiscardCardClick(slotIndex) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "card_toggle_public_corner_discard",
      slotIndex,
    }).value;
  }

  function confirmPublicCornerDiscardSelectionForRoot(workingRoot) {
    const { cardState: workingCardState, playerState: workingPlayerState } = workingRoot;
    const pending = decisionState.cardSelectionAction;
    if (pending?.type !== "card_public_corner_discard") {
      return { ok: false, message: "当前不是公共牌角标弃除" };
    }
    const selectedSlots = [...new Set(pending.selectedSlots || [])].sort((a, b) => a - b);
    const minSelectable = getPublicCardMultiSelectMinSelectable(pending);
    if (selectedSlots.length < minSelectable) {
      return { ok: false, message: `请至少选择 ${minSelectable} 张公共牌` };
    }
    const selectedCards = selectedSlots.map((slotIndex) => workingCardState.publicCards[slotIndex]);
    if (selectedCards.some((card) => !card)) {
      return { ok: false, message: "所选公共牌已不可用" };
    }

    const effect = pending.effect || getCurrentActionEffect();
    const player = pending.player || getEffectOwnerPlayer(effect) || getCurrentPlayer();
    beginEffectHistoryStep(effect?.label || pending.effectLabel || "公共牌角标弃除");
    const rewards = selectedCards.map((card, cardIndex) => {
      workingCardState.publicCards[selectedSlots[cardIndex]] = null;
      cards.addToDiscardPile(workingCardState, card);
      return applyCardCornerRewardFromCard(player, card, {
        source: "card_public_corner_discard",
        insertMoveIntoCurrentFlow: true,
        effectId: `${effect?.id || "public-corner-discard"}-${cardIndex + 1}`,
      });
    });
    cards.ensurePublicCardsFilled(workingCardState, workingPlayerState);
    markCurrentActionIrreversible("公共牌补牌翻出新牌", "hidden_card_reveal");
    cards.setSelectionActive(workingCardState, false);
    decisionState.cardSelectionAction = null;
    syncCardSelectionChrome();
    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: false,
      irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
      message: `${effect?.label || pending.effectLabel || "公共牌角标弃除"}：${selectedCards.map((card) => cards.getCardLabel(card)).join("、")}`,
      payload: {
        cardIds: selectedCards.map((card) => card.id),
        rewards,
      },
    }, [renderPlayerStats, renderPublicCards]);
  }

  function confirmPublicCornerDiscardSelection() {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "card_confirm_public_corner_discard",
    }).value;
  }


  function isActionEffectFlowActive() {
    return decisionState.actionEffectFlow != null;
  }

  function isInitialIncomeFlowActive() {
    return decisionState.actionEffectFlow?.actionType === "initialIncome";
  }

  function getGameplayLockReason() {
    if (isGameEnded()) return "游戏已结束，正在进行终局计分";
    if (isInitialSelectionActive()) return "请先完成初始选择";
    if (isInitialIncomeFlowActive()) return "请先完成初始收入增加";
    return null;
  }

  function lockAllActionButtons(reason) {
    setTurnActionButtonState(els.actionPassButton, false);
    setTurnActionButtonState(els.actionConfirmButton, false);
    setTurnActionButtonState(els.actionUndoButton, false);
    setActionButtonState(els.actionLaunchButton, false, reason);
    setActionButtonState(els.actionOrbitButton, false, reason);
    setActionButtonState(els.actionLandButton, false, reason);
    setActionButtonState(els.actionScanButton, false, reason);
    setActionButtonState(els.actionAnalyzeButton, false, reason);
    setActionButtonState(els.actionPlayCardButton, false, reason);
    setActionButtonState(els.actionResearchTechButton, false, reason);
    setQuickActionButtonEnabled(false, reason);
    updateQuickPanel();
    renderActionEffectBar();
  }

  function blockIncompatiblePendingQuickActionForRoot(workingRoot, actionType) {
    if (actionType !== "card-corner" && getPendingCardCornerQuickAction()) {
      cancelCardCornerQuickAction({ silent: true });
    }
    if (getPendingHandCardPlayAction()) {
      cancelHandCardPlayAction({ silent: true });
    }
    if (hasActivePendingSubFlow()) {
      workingRoot.rocketState.statusNote = decisionSessions.peek("industry_ability") || uiRuntimeState.industryFreeMoveState || isIndustryHandSelectionActive()
        ? "请先完成或取消公司 1x 行动"
        : "请先完成或取消当前流程";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }
    return null;
  }

  function blockIncompatiblePendingQuickAction(actionType) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "quick_action_check_pending",
      actionType,
    }).value;
  }

  function recordPlayCardStart(
    player,
    card,
    beforePlayer,
    beforeCardState,
    beforeAlienState = null,
    execution = {},
  ) {
    const workingRoot = execution.workingRoot;
    if (!workingRoot?.cardState || !workingRoot?.alienGameState) {
      throw new TypeError("recordPlayCardStart 缺少 workingRoot");
    }
    const actionCardState = workingRoot.cardState;
    const actionAlienGameState = workingRoot.alienGameState;
    startActionLogDraft("playCard", "打牌行动", { source: HISTORY_SOURCE_MAIN, player });
    actionHistory.beginSession("playCard", "打牌行动");
    actionHistory.beginStep({
      source: HISTORY_SOURCE_MAIN,
      type: "action_start",
      label: `打出：${cards.getCardLabel(card)}`,
      effectIndex: -1,
      playedCard: createActionLogPlayedCardSnapshot(card),
      logBefore: createActionLogImpactSnapshot(beforePlayer),
    });
    uiRuntimeState.effectStepActive = true;
    recordHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      "恢复打牌前玩家状态",
    ));
    recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
      actionCardState,
      beforeCardState.publicCards,
      beforeCardState.discardPile,
    ));
    if (beforeAlienState) {
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        actionAlienGameState,
        beforeAlienState,
        "恢复打牌前外星人状态",
      ));
    }
    endEffectHistoryStep();
  }

  function releaseFutureSpanAfterPlayWithHistory(label = "未来跨度研究所：收回专属标记") {
    const player = getCurrentPlayer();
    const futureState = industry?.ensureFutureSpanState?.(player);
    if (!player || !futureState?.playing) return false;

    industry.clearFutureSpanState?.(player);
    if (actionHistory.hasSession()) {
      appendActionLogStep(HISTORY_SOURCE_MAIN, label, "目标牌结算完毕，专属标记回到公司牌", {
        undoable: false,
      });
    }
    renderInitialSelectionArea();
    return true;
  }


  function executeFreeMoveForCardCornerForRoot(workingRoot, deltaX, deltaY, rocketId, payment = {}) {
    const { playerState: workingPlayerState, rocketState: workingRocketState } = workingRoot;
    const pending = getPendingCardCornerFreeMove();
    if (!pending) return { ok: false, message: "没有待结算的弃牌移动" };

    const moveCheck = rocketActions.canMoveRocket(workingRocketState, rocketId, deltaX, deltaY);
    if (!moveCheck.ok) {
      workingRocketState.statusNote = moveCheck.message;
      renderStateReadout();
      return moveCheck;
    }

    const currentPlayer = players.getCurrentPlayer(workingPlayerState);
    const providedMovePoints = Math.max(
      0,
      Math.round(Number(
        payment.providedMovePoints
          ?? pending.action.moveReward?.movementPoints
          ?? pending.action.movementPoints
          ?? 1,
      ) || 0),
    );
    const terrainRequired = Number.isFinite(Number(payment.terrainRequired))
      ? Math.max(1, Math.round(Number(payment.terrainRequired)))
      : getRequiredMovePointsForUi(currentPlayer, rocketId, deltaX, deltaY);
    if (!payment.fromMovePayment && providedMovePoints < terrainRequired) {
      return beginSupplementalMovePayment({
        deltaX,
        deltaY,
        rocketId,
        terrainRequired,
        providedMovePoints,
        context: { type: "card_corner_free_move", terrainRequired },
        message: `${pending.action.label}：已有 ${providedMovePoints} 点移动力，还需 ${terrainRequired - providedMovePoints} 点（可弃移动牌或用能量）`,
      });
    }

    const energyCost = Math.max(0, Math.round(Number(payment.energyCost) || 0));
    const result = abilities.executeAbility("moveProbe", createActionContextForWorkingRoot(workingRoot), {
      cost: energyCost > 0 ? { energy: energyCost } : {},
      movementPoints: Math.max(terrainRequired, providedMovePoints + energyCost),
      rocketId,
      deltaX,
      deltaY,
      source: "card_corner",
      historyLabel: `卡牌快速行动：${pending.action.label}`,
    });
    if (result.rocket) renderRocketElement(result.rocket);
    if (!result.ok) {
      if (payment.discardCommand) payment.discardCommand.undo();
      workingRocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    const recordInCurrentIndustryStep = Boolean(pending.industryQuickStepActive && decisionSessions.peek("industry_ability"));
    if (!recordInCurrentIndustryStep) {
      beginQuickActionStep("card-corner-move", `卡牌快速行动：${pending.action.label}`);
    }
    if (payment.discardCommand) recordQuickHistoryCommand(payment.discardCommand);
    recordAbilityCommands(result, quickActionHistory, workingRoot);
    if (!recordInCurrentIndustryStep) {
      completeQuickActionStep();
    }

    decisionSessions.clear(CARD_CORNER_FREE_MOVE_SESSION);
    workingRocketState.activeRocketId = null;
    clearMoveRocketHighlight();
    deactivateMoveMode();
    workingRocketState.statusNote = `卡牌快速行动：${pending.discardedCardLabel} ${pending.action.label}，${result.message}`;
    const finishIndustryAfterMove = Boolean(pending.finishIndustryFlowAfterMove);
    const industryFinishMessage = pending.afterMoveStatus || workingRocketState.statusNote;
    settleCardTasksAfterEffectForRoot(workingRoot, { events: [...(result.events || []), ...(pending.deferredEvents || [])], render: false });
    if (finishIndustryAfterMove) {
      finishIndustryAbilityFlow(industryFinishMessage);
      if (pending.irreversibleIndustryFlow) {
        commitIrreversibleIndustryQuickAction(pending.industryLogLabel || pending.action.label, industryFinishMessage);
      }
      return result;
    }
    renderPlayerStats();
    renderRockets();
    renderPlayerHand();
    updateActionButtons();
    renderStateReadout();
    return result;
  }

  function executeFreeMoveForCardCorner(...args) {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "card_execute_free_move_corner", args });
  }

  function buildPlanetRewardEffectsWithIndustry(actionType, result, options = {}) {
    const planetEffects = planetRewards?.buildRewardEffectsForAction?.(actionType, result) || [];
    const scoredPlanetEffects = options.scoreSourceKey
      ? attachScoreSourceToEffects(planetEffects, options.scoreSourceKey)
      : planetEffects;
    const player = options.player || getCurrentPlayer();
    return [
      ...scoredPlanetEffects,
      ...(industry?.buildPiratesRaidMarkerEffectNodes?.(player, result?.planetId, actionType, result) || []),
    ];
  }

  function getActionResultOwnerPlayer(workingRoot, result, fallbackPlayer = null) {
    const ownerEvent = (result?.events || []).find((event) => event?.playerId || event?.playerColor) || null;
    const playerId = result?.playerId || result?.payload?.playerId || ownerEvent?.playerId || null;
    const playerColor = result?.playerColor || result?.payload?.playerColor || ownerEvent?.playerColor || null;
    return (workingRoot.playerState.players || []).find((player) => (
      (playerId && player.id === playerId) || (playerColor && player.color === playerColor)
    )) || fallbackPlayer || players.getCurrentPlayer(workingRoot.playerState);
  }

  function claimRunezuPlanetSymbolForTravelResult(workingRoot, actionType, result, fallbackPlayer = null) {
    if (actionType !== "orbit" && actionType !== "land") return null;
    const planetId = result?.planetId || result?.payload?.planetId || null;
    if (!planetId) return null;
    const actionLabel = actionType === "orbit" ? "环绕" : "登陆";
    const claim = claimRunezuSourceSymbolWithHistory(
      "planet",
      planetId,
      getActionResultOwnerPlayer(workingRoot, result, fallbackPlayer),
      `${actionLabel}获得符文族symbol`,
    );
    if (claim?.ok) {
      result.message = `${result.message || actionLabel}；${claim.message}`;
      result.runezuSymbolClaim = claim;
      if (result.payload && typeof result.payload === "object") {
        result.payload.runezuSymbolClaim = {
          sourceType: claim.sourceType,
          sourceId: claim.sourceId,
          symbolId: claim.symbolId,
        };
      }
    }
    return claim;
  }

  function startPlanetRewardEffectFlow(workingRoot, actionType, result) {
    if (!workingRoot?.playerState || !workingRoot?.rocketState) {
      throw new TypeError("startPlanetRewardEffectFlow 缺少 workingRoot");
    }
    const actionOwner = getActionResultOwnerPlayer(workingRoot, result);
    const rewardEffects = buildPlanetRewardEffectsWithIndustry(actionType, result, { player: actionOwner });
    if (!rewardEffects.length) return false;

    const actionLabel = actionType === "orbit" ? "环绕" : "登陆";
    const isAomomoRewardFlow = result?.planetId === (aomomo?.PLANET_ID || "aomomo");
    startActionLogDraft(actionType, `${actionLabel}行动`, { source: HISTORY_SOURCE_MAIN });
    actionHistory.beginSession(actionType, `${actionLabel}行动`);
    actionHistory.beginStep({
      source: HISTORY_SOURCE_MAIN,
      type: "action_start",
      label: result.message || `${actionLabel}标记`,
      effectIndex: -1,
    });
    uiRuntimeState.effectStepActive = true;
    recordAbilityCommands(result, actionHistory, workingRoot);
    const runezuClaim = claimRunezuPlanetSymbolForTravelResult(workingRoot, actionType, result, actionOwner);
    if (runezuClaim?.ok) renderRunezuBoardSymbols();
    endEffectHistoryStep();

    decisionState.actionEffectFlow = abilities.chain.startAbilityChain(
      `${actionType}-rewards`,
      `${actionLabel}奖励`,
      rewardEffects,
    );
    decisionState.actionEffectFlow.actionType = actionType;
    decisionState.actionEffectFlow.playerId = actionOwner?.id || null;
    assignEffectFlowOwner(decisionState.actionEffectFlow, decisionState.actionEffectFlow.playerId);
    decisionState.actionEffectFlow.consumesMainAction = true;
    decisionState.actionEffectFlow.autoExecuteAomomoRewards = isAomomoRewardFlow;

    els.appWrap?.classList.toggle("action-effect-flow-active", true);
    workingRoot.rocketState.statusNote = `${actionLabel}：请依次点击奖励效果`;
    activateNextActionEffect();
    return true;
  }

  function shouldAutoExecuteAomomoRewardEffect(effect) {
    return Boolean(
      decisionState.actionEffectFlow?.autoExecuteAomomoRewards
      && effect?.status === "active"
      && AOMOMO_AUTO_REWARD_EFFECT_TYPES.has(effect.type)
      && !hasActiveEffectSubFlow()
    );
  }

  function maybeAutoExecuteAomomoRewardEffects() {
    if (uiRuntimeState.autoExecutingActionEffects || !decisionState.actionEffectFlow?.autoExecuteAomomoRewards) return false;
    uiRuntimeState.autoExecutingActionEffects = true;
    let executed = false;
    try {
      for (let guard = 0; guard < 20; guard += 1) {
        const effect = getCurrentActionEffect();
        if (!shouldAutoExecuteAomomoRewardEffect(effect)) return executed;
        const result = executeActionEffect(effect);
        executed = true;
        if (result?.awaitingChoice || result?.pendingChoice || result?.ok === false) return executed;
        if (!decisionState.actionEffectFlow || decisionState.actionEffectFlow.completed || hasActiveEffectSubFlow()) return executed;
        const current = getCurrentActionEffect();
        if (current === effect && current?.status === "active") return executed;
      }
      return executed;
    } finally {
      uiRuntimeState.autoExecutingActionEffects = false;
    }
  }

  function beginResearchTechActionSession(result, options = {}) {
    startActionLogDraft("researchTech", "科技行动", { source: HISTORY_SOURCE_MAIN });
    actionHistory.beginSession("researchTech", "科技行动");
    actionHistory.beginStep({
      source: HISTORY_SOURCE_MAIN,
      type: "action_start",
      label: "科技行动",
      effectIndex: -1,
      logBefore: options.logBefore || createActionLogImpactSnapshot(),
    });
    uiRuntimeState.effectStepActive = true;
    endEffectHistoryStep({
      result: {
        ok: true,
        undoable: true,
        message: result?.message || "请选择要研究的科技板块",
      },
    });
  }

  function startResearchTechEffectFlow(workingRoot, result, options = {}) {
    if (!workingRoot?.rocketState) throw new TypeError("startResearchTechEffectFlow 缺少 workingRoot");
    if (!result?.ok || !result.awaitingTileSelection) return false;

    beginResearchTechActionSession(result, options);
    decisionState.actionEffectFlow = abilities.chain.startAbilityChain(
      "researchTech",
      "科技行动",
      [{
        id: "research-tech-select",
        type: "research_tech_select",
        abilityId: "researchTechSelect",
        icon: "research_tech",
        label: "选择科技片",
        options: {
          cost: result.cost || {},
          allowedTechTypes: result.allowedTechTypes || result.payload?.allowedTechTypes || null,
        },
        status: "pending",
        undoable: true,
      }],
    );
    decisionState.actionEffectFlow.actionType = "researchTech";
    decisionState.actionEffectFlow.playerId = getCurrentPlayer()?.id || null;
    decisionState.actionEffectFlow.historySource = HISTORY_SOURCE_MAIN;
    assignEffectFlowOwner(decisionState.actionEffectFlow, decisionState.actionEffectFlow.playerId);
    decisionState.actionEffectFlow.consumesMainAction = true;

    els.appWrap?.classList.toggle("action-effect-flow-active", true);
    workingRoot.rocketState.statusNote = "科技：请选择要研究的科技片";
    activateNextActionEffect();
    return true;
  }

  function isIncomeDiscardActionType(type) {
    return type === "income"
      || type === "planet_reward_income"
      || type === "place_data_income"
      || type === "initial_income"
      || type === "card_income"
      || type === "industry_helios_income"
      || type === "industry_fundamentalism_income";
  }

  function getPlaceDataSlotBonuses(placeResult) {
    if (placeResult?.slotBonuses?.length) return placeResult.slotBonuses;
    return placeResult?.slotBonus ? [placeResult.slotBonus] : [];
  }

  function applyAutomaticPlaceDataBonus(player, bonus) {
    const beforePlayer = structuredClone(player);
    if (bonus.type === "publicity") {
      players.gainResources(player, { publicity: bonus.publicity });
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复放置数据宣传奖励",
      ));
      return { ok: true, message: `获得 ${bonus.publicity} 宣传` };
    }
    if (bonus.type === "score") {
      players.gainResources(player, { score: bonus.score });
      addPlayerScoreSource(player, SCORE_SOURCE_KEYS.BLUE_TECH, bonus.score);
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复放置数据分数奖励",
      ));
      return { ok: true, message: `获得 ${bonus.score} 分` };
    }
    if (bonus.type === "credits") {
      players.gainResources(player, { credits: bonus.credits });
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复放置数据信用点奖励",
      ));
      return { ok: true, message: `获得 ${bonus.credits} 信用点` };
    }
    if (bonus.type === "energy") {
      players.gainResources(player, { energy: bonus.energy });
      recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复放置数据能量奖励",
      ));
      return { ok: true, message: `获得 ${bonus.energy} 能量` };
    }
    return { ok: true, message: null };
  }

  function applyPendingPlaceDataBonus(workingRoot, player, bonus) {
    if (bonus.type === "income") {
      const incomeStart = beginDiscardSelection(1, {
        type: "place_data_income",
        player,
        beforePlayerState: structuredClone(player),
        beforeCardState: structuredClone(workingRoot.cardState),
        effectLabel: "放置数据：收入奖励",
      });
      if (!incomeStart.ok) {
        completeQuickActionStep();
        return { ok: false, pendingIncome: false, message: incomeStart.message };
      }
      return { ok: true, pendingIncome: true };
    }

    if (bonus.type === "choose_card") {
      const selectionStart = beginCardSelection({
        type: "place_data_choose_card",
        player,
        beforePlayerState: structuredClone(player),
        beforeCardState: structuredClone(workingRoot.cardState),
      });
      if (!selectionStart.ok) {
        completeQuickActionStep();
        return { ok: false, pendingIncome: false, message: selectionStart.message };
      }
      return { ok: true, pendingIncome: false, pendingCardSelection: true };
    }

    return { ok: true, pendingIncome: false };
  }

  function applyPlaceDataSlotBonus(workingRoot, player, placeResult) {
    const bonuses = getPlaceDataSlotBonuses(placeResult);
    if (!bonuses.length) {
      completeQuickActionStep();
      return { ok: true, pendingIncome: false };
    }

    const autoMessages = [];
    for (const bonus of bonuses) {
      if (bonus.type === "income" || bonus.type === "choose_card") {
        const pendingResult = applyPendingPlaceDataBonus(workingRoot, player, bonus);
        if (pendingResult.message && !pendingResult.pendingIncome && !pendingResult.pendingCardSelection) {
          return pendingResult;
        }
        if (pendingResult.pendingIncome || pendingResult.pendingCardSelection) {
          return pendingResult;
        }
        continue;
      }

      const autoResult = applyAutomaticPlaceDataBonus(player, bonus);
      if (autoResult.message) autoMessages.push(autoResult.message);
    }

    completeQuickActionStep();
    return {
      ok: true,
      pendingIncome: false,
      message: autoMessages.length ? autoMessages.join("；") : null,
    };
  }

  function recordPlaceDataActionHistory(workingRoot, player, placeResult) {
    beginQuickActionStep("place-data", "放置数据");
    recordAbilityCommands(placeResult, quickActionHistory, workingRoot);
    return applyPlaceDataSlotBonus(workingRoot, player, placeResult);
  }

  function recordMoveActionHistory(workingRoot, moveResult, paymentCommand = null) {
    beginQuickActionStep("move", "移动");
    if (paymentCommand) {
      recordQuickHistoryCommand(paymentCommand);
    }
    recordAbilityCommands(moveResult, quickActionHistory, workingRoot);
    completeQuickActionStep();
  }

  function recordMainActionIrreversibleBarrier(label, reason, code = "irreversible_effect") {
    const history = actionHistory;
    if (!history.hasSession()) {
      markCurrentActionIrreversible(reason, code);
      return null;
    }

    history.beginStep({
      source: HISTORY_SOURCE_MAIN,
      type: "irreversible",
      label: label || "不可撤销",
      effectIndex: null,
      undoable: false,
      irreversibleCode: code,
      irreversibleReason: reason || "该步骤产生不可撤销影响",
    });
    const step = history.endStep();
    if (step) {
      rememberHistoryStep(HISTORY_SOURCE_MAIN, step.id);
      appendActionLogStep(
        HISTORY_SOURCE_MAIN,
        step.label,
        step.irreversibleReason,
        actionLogOptionsFromHistoryStep(step),
      );
    }
    markCurrentActionIrreversible(reason, code);
    return step;
  }

  function refreshAfterHistoryChange(message) {
    renderSectorNebulaDataBoard();
    syncPlanetOrbitLandMarkers();
    renderPublicCards();
    updatePublicCardControls();
    refreshHelpers.refreshPlayerPanels();
    renderPlayerHand();
    renderReservedCards();
    renderInitialSelectionArea();
    clearStaleFullyUndoneMainActionSession();
    syncInteractionFocusChrome();
    if (message) setBrowserStatusNote(message);
    refreshHelpers.refreshActionState({ includeQuickPanel: false, includeStateReadout: true });
  }

  function revertEffectFlowAfterUndo(step) {
    if (!decisionState.actionEffectFlow || !step) return;

    if (isMainActionOpeningStep(step)) {
      if (decisionState.actionEffectFlow.actionType === "researchTech") {
        clearResearchTechSelectionState();
      }
      clearActionEffectFlow();
      return;
    }

    if (!Number.isInteger(step.effectIndex)) return;

    const { effects } = decisionState.actionEffectFlow;
    const effect = effects[step.effectIndex];
    if (!effect) return;

    pruneEndOfFlowSettlementEffectsAfterUndo(decisionState.actionEffectFlow, step.effectIndex);
    abilities.chain.removeInsertedNodesBySource?.(decisionState.actionEffectFlow, {
      chainId: decisionState.actionEffectFlow.chainId || null,
      effectId: step.effectId || effect.id || null,
      effectIndex: step.effectIndex,
      effectType: step.effectType || effect.type || null,
    });
    decisionState.actionEffectFlow.completed = false;
    effect.status = "active";
    effect.result = null;
    effect.preHistoryCommandsApplied = false;
    decisionState.actionEffectFlow.currentIndex = step.effectIndex;
    for (let index = step.effectIndex + 1; index < effects.length; index += 1) {
      if (effects[index].status !== "pending") {
        effects[index].status = "pending";
      }
      effects[index].preHistoryCommandsApplied = false;
    }
    cancelActiveEffectSubFlows();
    if (decisionState.actionEffectFlow.actionType === "researchTech" && effect.type === "research_tech_select") {
      restoreResearchTechSelectionAfterUndo(effect);
    }
    els.appWrap?.classList.toggle("action-effect-flow-active", true);
  }

  function hasActiveEffectSubFlow() {
    return Boolean(
      decisionState.scanTargetAction
      || getPendingProbeSectorScanDecision()
      || getPendingProbeLocationRewardDecision()
      || getPublicScanQueueSession()
      || decisionState.handScanAction
      || getPendingPassReserveSelection()
      || (isCardSelectionActive() && (decisionState.actionEffectFlow || isCardTriggerPickSelectionActive()))
      || getPendingCardTriggerAction()
      || getPendingCardTaskCompletion()
      || getPendingJiuzheCardPlay()
      || getPendingYichangdianCardGain()
      || getPendingYichangdianCornerAction()
      || getPendingBanrenmaCardGain()
      || getPendingBanrenmaOpportunity()
      || getPendingChongCardGain()
      || getPendingChongFossilChoice()
      || getPendingAmibaCardGain()
      || getPendingAmibaSymbolChoice()
      || getPendingAmibaTraceRemoval()
      || getPendingAomomoCardGain()
      || getPendingRunezuCardGain()
      || getPendingRunezuSymbolBranch()
      || getPendingRunezuFaceSymbolPlacement()
      || getPendingStrategySlotDecision()
      || getPendingPiratesRaidDecision()
      || getPendingCardTriggerFreeMove()
      || getPendingCardCornerFreeMove()
      || (els.scanAction4Overlay && !els.scanAction4Overlay.hidden)
      || (els.landTargetOverlay && !els.landTargetOverlay.hidden)
      || (els.alienTraceOverlay && !els.alienTraceOverlay.hidden && decisionState.alienTracePickerState?.mode !== "reveal-confirm")
      || decisionState.actionEffectFlow?.cardMoveEffect
      || decisionState.actionEffectFlow?.freeMoveMode
      || Boolean(getPendingDataPlacementDecision()),
    );
  }

  function hasActivePendingSubFlow() {
    return hasActiveEffectSubFlow()
      || isMovePaymentSelectionActive()
      || (els.dataPlaceOverlay && !els.dataPlaceOverlay.hidden)
      || Boolean(decisionSessions.peek("industry_ability"))
      || Boolean(uiRuntimeState.industryFreeMoveState)
      || isIndustryHandSelectionActive();
  }

  function cancelActivePendingSubFlowsForRoot(workingRoot) {
    if (decisionState.scanTargetAction?.type === "industry_remove_tech") {
      rollbackPendingIndustryQuickAction("已取消公司 1x 行动");
      return true;
    }
    if (getPendingStrategySlotDecision()) {
      cancelStrategyPassiveSlotChoice();
      return true;
    }
    if (getPendingCardCornerFreeMove()?.finishIndustryFlowAfterMove) {
      const pending = getPendingCardCornerFreeMove();
      decisionSessions.clear(CARD_CORNER_FREE_MOVE_SESSION);
      workingRoot.rocketState.activeRocketId = null;
      clearMoveRocketHighlight();
      deactivateMoveMode();
      const message = `${pending.afterMoveStatus || "公司 1x 行动"}；已取消免费移动`;
      if (decisionSessions.peek("industry_ability")) {
        finishIndustryAbilityFlow(message);
      }
      if (pending.irreversibleIndustryFlow) {
        commitIrreversibleIndustryQuickAction(
          pending.industryLogLabel || pending.action?.label || "公司 1x 行动",
          message,
        );
      }
      workingRoot.rocketState.statusNote = message;
      renderPlayerStats();
      renderPublicCards();
      renderPlayerHand();
      updateActionButtons();
      renderStateReadout();
      return true;
    }
    if (hasActiveEffectSubFlow()) {
      cancelActiveEffectSubFlowsForRoot(workingRoot);
      return true;
    }
    if (isMovePaymentSelectionActive()) {
      cancelMovePaymentSelection();
      return true;
    }
    if (els.dataPlaceOverlay && !els.dataPlaceOverlay.hidden) {
      if (getPendingDataPlacementDecision()) {
        cancelDataPlacePicker();
        return true;
      }
      closeDataPlacePicker();
      workingRoot.rocketState.statusNote = "已取消放置数据";
      return true;
    }
    if (decisionSessions.peek("industry_ability") || uiRuntimeState.industryFreeMoveState || isIndustryHandSelectionActive()) {
      rollbackPendingIndustryQuickAction("已取消公司 1x 行动");
      return true;
    }
    return false;
  }

  function cancelActivePendingSubFlows() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "effect_cancel_pending_subflows" }).value;
  }

  function getActionEffectIconSrc(iconId) {
    if (runezu?.SYMBOL_IDS?.includes(iconId)) {
      return runezu.getSymbolSrc(iconId);
    }
    return scanEffects.EFFECT_ICONS[iconId]
      || planetRewards?.EFFECT_ICONS?.[iconId]
      || TECH_EFFECT_ICONS[iconId]
      || CARD_EFFECT_ICONS[iconId]
      || RESOURCE_ICON_SRC[iconId]
      || "";
  }

  function normalizeResourceCost(cost) {
    if (!cost || typeof cost !== "object" || Array.isArray(cost)) return null;
    const normalized = Object.fromEntries(
      Object.entries(cost)
        .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
        .map(([key, value]) => [key, Math.round(Number(value))]),
    );
    return Object.keys(normalized).length ? normalized : null;
  }

  function getActionEffectCost(effect) {
    return normalizeResourceCost(effect?.options?.cost);
  }

  function getActionEffectCostText(effect) {
    const cost = getActionEffectCost(effect);
    return cost ? players.formatResourceCost(cost) : "";
  }

  function getActionEffectTooltip(effect) {
    const parts = [effect?.label || "效果"];
    const costText = getActionEffectCostText(effect);
    if (costText) parts.push(`消耗：${costText}`);
    if (effect?.status === "completed" && effect.undoable !== false) parts.push("可撤销");
    return parts.join("；");
  }

  function getActionEffectDisplayIconSrc(effect) {
    if (effect?.type === JIUZHE_THRESHOLD_CARD_EFFECT_TYPE) {
      return jiuzhe?.CARD_BACK_SRC || "";
    }
    if (effect?.type === BANRENMA_PANEL_BONUS_EFFECT_TYPE) {
      const player = resolvePlayerReference(effect.options || effect) || getEffectOwnerPlayer(effect);
      return banrenma?.getPlayerMarkSrc?.(player?.color || effect.options?.playerColor)
        || RESOURCE_ICON_SRC.banrenmaToken;
    }
    const iconId = getActionEffectCostText(effect) ? "cost" : effect?.icon;
    return getActionEffectIconSrc(iconId);
  }

  function shouldRenderActionEffect(effect) {
    if (decisionState.actionEffectFlow?.actionType !== "initialIncome") return true;
    const owner = getEffectOwnerPlayer(effect);
    return !owner?.id || !isAiAutoBattlePlayer(owner.id);
  }

  function getPlanetSectorCoordinate(planetId) {
    const snapshot = solar.createSolarSnapshot(createStateSourceReadoutRoot().solarState);
    const planet = snapshot.planetLocations.find((item) => item.planetId === planetId);
    if (!planet) {
      throw new Error(`${planetId} position was not found in the current solar snapshot`);
    }
    return { x: planet.x, y: planet.y };
  }

  function getRocketCurrentPlanetIdForRoot(workingRoot, rocketId) {
    const rocket = workingRoot.rocketState.rockets.find((item) => Number(item.id) === Number(rocketId));
    const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
    if (!coordinate) return null;
    const snapshot = solar.createSolarSnapshot(workingRoot.solarState);
    const planet = snapshot.planetLocations.find((item) => (
      Number(item.x) === Number(coordinate.x) && Number(item.y) === Number(coordinate.y)
    ));
    return planet?.planetId || null;
  }

  function getRocketCurrentPlanetId(rocketId) {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "rocket_current_planet", rocketId }, { commit: false }).value;
  }

  function listReadyChongTransportCandidatesForRoot(workingRoot, player, task) {
    if (!chong?.listActiveTransports || task?.kind !== "transport") return [];
    return chong.listActiveTransports(workingRoot.alienGameState, player)
      .map((transport) => {
        const currentPlanetId = getRocketCurrentPlanetIdForRoot(workingRoot, transport.rocketId);
        return {
          ...transport,
          currentPlanetId,
          task: {
            ...(transport.task || {}),
            destinationPlanetId: task.destinationPlanetId,
          },
          completionTask: task,
        };
      })
      .filter((transport) => transport.currentPlanetId === task.destinationPlanetId);
  }

  function listReadyChongTransportCandidates(player, task) {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "chong_ready_transports", player, task }, { commit: false }).value || [];
  }

  function buildSectorScanChoicesForXs(sectorXs) {
    return (sectorXs || []).flatMap((x) => buildSectorScanChoicesForX(x));
  }

  function clearActionEffectFlow() {
    decisionState.actionEffectFlow = null;
    closeLandTargetPicker();
    closeScanAction4Picker();
    renderActionEffectBar();
    els.appWrap?.classList.toggle("action-effect-flow-active", false);
    renderReservedCards();
  }

  function shouldRememberCompletedEffectFlowForUndo(flow) {
    if (!flow?.historySource) return false;
    if (flow.historySource === HISTORY_SOURCE_QUICK) return true;
    if (flow.historySource === HISTORY_SOURCE_MAIN) {
      return Boolean(actionHistory.hasUndoableStep());
    }
    return false;
  }

  function clearCompletedEffectFlowForUndo(source = null) {
    if (!source) {
      uiRuntimeState.completedEffectFlowsForUndo = {};
      return;
    }
    uiRuntimeState.completedEffectFlowsForUndo[source] = null;
  }

  function rememberCompletedEffectFlowForUndo(flow) {
    const source = flow?.historySource || null;
    if (!source) return;
    uiRuntimeState.completedEffectFlowsForUndo[source] = shouldRememberCompletedEffectFlowForUndo(flow)
      ? flow
      : null;
  }

  function takeCompletedEffectFlowForUndo(step, source) {
    const flow = uiRuntimeState.completedEffectFlowsForUndo[source];
    const effectIndex = step?.effectIndex;
    const effect = Number.isInteger(effectIndex) ? flow?.effects?.[effectIndex] : null;
    if (!flow || flow.historySource !== source || !effect) return null;
    if (step.effectType && effect.type !== step.effectType) return null;
    clearCompletedEffectFlowForUndo(source);
    return flow;
  }

  function peekCompletedEffectFlowForUndo(step, source) {
    const flow = uiRuntimeState.completedEffectFlowsForUndo[source];
    const effectIndex = step?.effectIndex;
    const effect = Number.isInteger(effectIndex) ? flow?.effects?.[effectIndex] : null;
    if (!flow || flow.historySource !== source || !effect) return null;
    if (step.effectType && effect.type !== step.effectType) return null;
    return flow;
  }

  function cancelActiveEffectSubFlowsForRoot(workingRoot) {
    if (!getPublicScanQueueSession()) {
      closeScanTargetPicker({ forceYichangdianCornerClose: true });
    }
    if (els.landTargetOverlay && !els.landTargetOverlay.hidden) {
      cancelLandTargetPicker();
    }
    closeScanAction4Picker();
    closeAlienTracePicker();
    decisionSessions.clear(PUBLIC_SCAN_QUEUE_SESSION);

    if (isHandScanSelectionActive()) {
      decisionState.handScanAction = null;
      syncHandScanSelectionChrome();
    }

    if (isCardSelectionActive() && (decisionState.actionEffectFlow || isCardTriggerPickSelectionActive())) {
      if (decisionState.cardSelectionAction?.type === "fundamentalism_exchange_pick") {
        if (decisionState.cardSelectionAction.player && decisionState.cardSelectionAction.beforePlayerState) {
          restoreObjectSnapshot(decisionState.cardSelectionAction.player, decisionState.cardSelectionAction.beforePlayerState);
        }
        if (decisionState.cardSelectionAction.beforeCardState) {
          restoreObjectSnapshot(workingRoot.cardState, decisionState.cardSelectionAction.beforeCardState);
        }
      }
      decisionState.cardSelectionAction = null;
      cards.setSelectionActive(workingRoot.cardState, false);
      syncCardSelectionChrome();
    }

    if (getPendingPassReserveSelection()) {
      decisionSessions.clear(PASS_RESERVE_SELECTION_SESSION);
      uiRuntimeState.passReserveSelectionDismissed = false;
      syncPassReserveSelectionChrome();
    }

    if (decisionState.actionEffectFlow?.freeMoveMode) {
      decisionState.actionEffectFlow.freeMoveMode = false;
      deactivateMoveMode();
    }
    if (decisionState.actionEffectFlow?.cardMoveEffect) {
      decisionState.actionEffectFlow.cardMoveEffect = null;
      deactivateMoveMode();
    }
    if (getPendingDataPlacementDecision()) {
      closeDataPlacePicker();
    }
    decisionSessions.clear(CARD_TRIGGER_ACTION_SESSION);
    decisionSessions.clear(CARD_TASK_COMPLETION_SESSION);
    decisionSessions.clear(CARD_TRIGGER_FREE_MOVE_SESSION);
    if (workingRoot.match && typeof workingRoot.match === "object") {
      delete workingRoot.match.type1TriggerEvents;
    }
    decisionSessions.clear(CARD_CORNER_FREE_MOVE_SESSION);
    effectExecutors?.clearYichangdianCornerAction?.();
    alienSpeciesRuntime?.clearChongCardGainDecisionDraft?.();
    alienSpeciesRuntime?.clearChongFossilDecisionDraft?.();
    alienSpeciesRuntime?.clearAmibaCardGainDecisionDraft?.();
    alienSpeciesRuntime?.clearAmibaSymbolDecisionDraft?.();
    alienSpeciesRuntime?.clearAmibaTraceRemovalDecisionDraft?.();
    alienSpeciesRuntime?.clearAomomoCardGainDecisionDraft?.();
    alienSpeciesRuntime?.clearRunezuCardGainDecisionDraft?.();
    alienSpeciesRuntime?.clearRunezuSymbolBranchDecisionDraft?.();
    alienSpeciesRuntime?.clearRunezuFaceSymbolDecisionDraft?.();
    decisionSessions.clear(STRATEGY_SLOT_DECISION);
    if (getPendingPiratesRaidDecision()) {
      decisionSessions.clear(PIRATES_RAID_DECISION);
      renderTechBoard();
    }
  }

  function cancelActiveEffectSubFlows() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "effect_cancel_subflows" });
  }

  function cleanupSkippedActionEffect(effect) {
    if (effect?.type === "industry_strategy_passive_reward") {
      const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      industry?.clearStrategyPlayInteraction?.(player);
      renderInitialSelectionArea();
    }
  }

  function skipCurrentActionEffectForRoot(workingRoot) {
    if (!decisionState.actionEffectFlow) return;

    const current = getCurrentActionEffect();
    if (!current || current.status !== "active") return;
    if (
      getPendingYichangdianCornerAction()
      && current.type === cardEffects.EFFECT_TYPES.YICHANGDIAN_DRAW_THEN_TWO_CORNERS
    ) {
      openYichangdianCornerPicker();
      return;
    }
    if (finishCurrentCardMoveEffectEarly()) return;
    if (current.options?.skippable === false || current.required) {
      workingRoot.rocketState.statusNote = `${current.label} 必须完成，不能跳过`;
      renderStateReadout();
      return;
    }
    if (decisionState.scanTargetAction?.type === "hand_scan" && decisionState.scanTargetAction.discardDrawnOnSkip) {
      handleDrawnHandScanSkip();
      return;
    }

    cancelActiveEffectSubFlowsForRoot(workingRoot);
    cleanupSkippedActionEffect(current);
    beginEffectHistoryStep(`跳过：${current.label}`);
    endEffectHistoryStep();
    workingRoot.rocketState.statusNote = `已跳过：${current.label}`;
    completeCurrentActionEffect("skipped");
  }

  function skipCurrentActionEffect() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "effect_skip_current" }).value;
  }

  function skipHeadlessCurrentActionEffectImpl(workingRoot) {
    const current = getCurrentActionEffect();
    if (!headlessMode || !current || current.status !== "active") {
      return { ok: false, message: "没有可跳过的活动效果" };
    }
    if (finishCurrentCardMoveEffectEarly()) {
      return { ok: true, progressed: true, skipped: true, message: `已结束：${current.label}` };
    }
    skipCurrentActionEffectForRoot(workingRoot);
    if (current.status === "active") {
      cleanupSkippedActionEffect(current);
      completeCurrentActionEffect("skipped");
    }
    return { ok: true, progressed: true, skipped: true, message: `已跳过：${current.label}` };
  }

  function skipHeadlessCurrentActionEffect() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "headless_skip_current_effect" });
  }

  function skipActionEffectWithMessage(effect, message, payload = {}) {
    const current = effect || getCurrentActionEffect();
    const result = {
      ok: true,
      undoable: true,
      skipped: true,
      message,
      payload: { ...payload, skipped: true },
    };
    if (!current || current.status !== "active") {
      setBrowserStatusNote(message);
      renderStateReadout();
      return result;
    }

    current.result = result;
    cleanupSkippedActionEffect(current);
    beginEffectHistoryStep(`跳过：${current.label}`);
    setBrowserStatusNote(result.message);
    completeCurrentActionEffect("skipped");
    renderStateReadout();
    return result;
  }

  function renderActionEffectBar() {
    if (headlessMode) return;
    if (!els.actionEffectBar || !els.actionEffectList) return;

    if (!decisionState.actionEffectFlow) {
      els.actionEffectBar.hidden = true;
      els.actionEffectList.replaceChildren();
      if (els.actionEffectSkipButton) els.actionEffectSkipButton.hidden = true;
      return;
    }

    const current = getCurrentActionEffect();
    const canSkip = current?.status === "active"
      && current.options?.skippable !== false
      && !current.required;
    if (els.actionEffectSkipButton) {
      const finishingCardMove = Boolean(
        canSkip
        && decisionState.actionEffectFlow?.cardMoveEffect
        && decisionState.actionEffectFlow.cardMoveEffect.effect?.id === current?.id
        && (decisionState.actionEffectFlow.cardMoveEffect.moved || current?.result)
      );
      els.actionEffectSkipButton.textContent = finishingCardMove ? "结束移动" : "跳过";
      els.actionEffectSkipButton.setAttribute(
        "aria-label",
        finishingCardMove ? "结束当前卡牌移动" : "跳过当前效果",
      );
      els.actionEffectSkipButton.title = finishingCardMove
        ? "结束剩余移动力并结算已产生的访问触发"
        : "跳过当前效果";
      els.actionEffectSkipButton.hidden = !canSkip;
      els.actionEffectSkipButton.disabled = !canSkip;
    }

    const visibleEffects = decisionState.actionEffectFlow.effects
      .map((effect, index) => ({ effect, index }))
      .filter(({ effect }) => shouldRenderActionEffect(effect));
    if (!visibleEffects.length) {
      els.actionEffectBar.hidden = true;
      els.actionEffectList.replaceChildren();
      return;
    }

    els.actionEffectBar.hidden = false;
    els.actionEffectList.replaceChildren(...visibleEffects.map(({ effect, index }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-effect-button";
      button.dataset.effectIndex = String(index);
      const tooltip = getActionEffectTooltip(effect);
      button.title = tooltip;
      button.setAttribute("aria-label", tooltip);
      button.disabled = effect.status !== "active";
      button.classList.toggle("is-active", effect.status === "active");
      button.classList.toggle("is-completed", effect.status === "completed");
      button.classList.toggle("is-skipped", effect.status === "skipped");
      button.classList.toggle("is-undoable", effect.status === "completed" && effect.undoable !== false);

      const image = document.createElement("img");
      image.src = getActionEffectDisplayIconSrc(effect);
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      button.append(image);
      if (effect.badge) {
        const badge = document.createElement("span");
        badge.className = "action-effect-badge";
        badge.textContent = effect.badge;
        button.append(badge);
      } else if (
        decisionState.actionEffectFlow?.cardMoveEffect?.effect?.id === effect.id
        && effect.status === "active"
      ) {
        const badge = document.createElement("span");
        badge.className = "action-effect-badge";
        badge.textContent = String(decisionState.actionEffectFlow.cardMoveEffect.poolRemaining);
        button.append(badge);
      }
      return button;
    }));
  }

  function resolveCompletedSectorSettlementsForRoot(workingRoot, actionType, options = {}) {
    if (typeof data.settleCompletedSectors !== "function") return null;

    const {
      nebulaDataState: workingNebulaState,
      playerState: workingPlayerState,
      alienGameState: workingAlienState,
    } = workingRoot;

    const beforeNebulaState = structuredClone(workingNebulaState);
    const beforePlayerState = structuredClone(workingPlayerState);
    const beforeAlienState = structuredClone(workingAlienState);
    const settlementResult = data.settleCompletedSectors(workingNebulaState, {
      players: workingPlayerState.players,
      getPlayerTokenSrc: getNormalTokenAssetForPlayer,
      source: actionType || "mainAction",
    });
    if (!settlementResult.ok) return null;

    const awarded = new Set();
    const participantAwardLabels = new Set();
    for (const settlement of settlementResult.settlements || []) {
      const isAomomoSettlement = settlement.sectorId === aomomo?.NEBULA_ID;
      for (const participant of settlement.participants || []) {
        const player = workingPlayerState.players.find((item) => item.id === participant.playerId)
          || workingPlayerState.players.find((item) => item.color === participant.playerColor);
        if (!player) continue;
        const awardKey = `${settlement.sectorId}:${player.id}`;
        if (awarded.has(awardKey)) continue;
        awarded.add(awardKey);
        if (isAomomoSettlement) {
          players.gainResources(player, { aomomoFossils: 1 });
          participantAwardLabels.add("奥陌陌参与结算玩家各获得1化石");
        } else {
          players.gainResources(player, { publicity: 1 });
          participantAwardLabels.add("参与结算玩家各获得1宣传");
        }
      }
      const winner = workingPlayerState.players.find((item) => item.id === settlement.winner?.playerId)
        || workingPlayerState.players.find((item) => item.color === settlement.winner?.playerColor);
      const claim = winner
        ? runezu?.claimSectorSymbol?.(workingAlienState, settlement.sectorId, winner)
        : null;
      if (claim?.ok) {
        if (!Array.isArray(settlementResult.runezuSymbolClaims)) settlementResult.runezuSymbolClaims = [];
        settlementResult.runezuSymbolClaims.push({
          sectorId: settlement.sectorId,
          playerId: winner.id,
          playerColor: winner.color,
          symbolId: claim.symbolId,
        });
      }
    }
    settlementResult.participantAwardMessage = [...participantAwardLabels].join("；") || "无参与奖励";

    const source = options.historySource || HISTORY_SOURCE_MAIN;
    const history = getHistoryForSource(source);
    if (history.hasSession()) {
      history.beginStep({
        source,
        type: "sector_settlement",
        label: "扇区结算",
      });
      history.record(historyCommands.createRestoreObjectCommand(
        workingNebulaState,
        beforeNebulaState,
        "恢复扇区结算前星云状态",
      ));
      history.record(historyCommands.createRestoreObjectCommand(
        workingPlayerState,
        beforePlayerState,
        "恢复扇区结算前玩家状态",
      ));
      history.record(historyCommands.createRestoreObjectCommand(
        workingAlienState,
        beforeAlienState,
        "恢复扇区结算前外星人状态",
      ));
      const step = history.endStep();
      if (step) {
        rememberHistoryStep(source, step.id);
        appendActionLogStep(
          source,
          step.label,
          `${settlementResult.message}；${settlementResult.participantAwardMessage}`
            + `${settlementResult.runezuSymbolClaims?.length ? `；符文族symbol ${settlementResult.runezuSymbolClaims.length}个` : ""}`,
          actionLogOptionsFromHistoryStep(step),
        );
      }
    }
    renderSectorNebulaDataBoard();
    renderPlayerStats();
    renderAlienPanels();
    return settlementResult;
  }

  function resolveCompletedSectorSettlements(actionType, options = {}) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "scan_settle_completed_sectors",
      actionType,
      options,
    }).value;
  }

  function getMarkedNebulaIdsFromEvents(events = []) {
    const marked = new Set();
    for (const event of events || []) {
      if (event?.type === "signalMarked" && event.nebulaId) {
        marked.add(String(event.nebulaId));
      }
    }
    return marked;
  }

  function resultHasSignalMarkedEvent(result) {
    return getMarkedNebulaIdsFromEvents(result?.events).size > 0;
  }

  function getFlowMarkedNebulaIds(flow) {
    const marked = new Set();
    for (const effect of flow?.effects || []) {
      for (const nebulaId of getMarkedNebulaIdsFromEvents(effect.result?.events)) {
        marked.add(nebulaId);
      }
    }
    return marked;
  }

  function effectFlowMarkedNebula(flow) {
    return getFlowMarkedNebulaIds(flow).size > 0;
  }

  function finishActionEffectFlowForRoot(workingRoot) {
    if (!decisionState.actionEffectFlow) return;

    const finishedFlow = decisionState.actionEffectFlow;
    if (appendEndOfFlowSectorFinishEffects(finishedFlow)) {
      return;
    }
    if (appendDeferredEndOfFlowEffects(finishedFlow)) {
      return;
    }
    const actionType = finishedFlow.actionType;
    const settleResult = finishedFlow.sectorSettlementResult || null;
    const temporaryTaskRewardEffects = cardEffects.collectTemporaryTaskRewards(
      finishedFlow.cardTemporaryTasks,
      settleResult,
    );
    const delayedPublicRefills = cloneDelayedPublicRefills(finishedFlow);
    const transferDelayedPublicRefills = temporaryTaskRewardEffects.length > 0
      && delayedPublicRefills.length > 0;
    const delayedPublicRefillResult = transferDelayedPublicRefills
      ? null
      : settleDelayedPublicRefillsAfterScanFlow(finishedFlow);
    rememberCompletedEffectFlowForUndo(finishedFlow);
    clearActionEffectFlow();
    if (actionType === "researchTech") {
      tech.setTechSelectionActive(workingRoot.techGameState, false);
      tech.cancelPendingTake(workingRoot.techGameState);
      workingRoot.techGameState.ui.statusNote = "";
      syncTechSelectionChrome();
      renderTechBoard();
    }
    if (actionType === "initialIncome") {
      if (actionHistory.hasSession()) {
        actionHistory.commitSession();
      }
      clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
      removeActionLogStepsBySource(HISTORY_SOURCE_MAIN);
      clearActionPending();
      uiRuntimeState.effectStepActive = false;
      workingRoot.playerState.currentPlayerId = workingRoot.turnState.startPlayerId
        || workingRoot.playerState.currentPlayerId;
      workingRoot.rocketState.statusNote = "初始收入增加完成，游戏开始。";
      renderDebugPlayerSwitch();
      renderPlayerStats();
      renderPlayerHand();
      syncInteractionFocusChrome();
      updateActionButtons();
      renderStateReadout();
      refreshLatestActionLogRecoverySnapshot("初始收入完成后状态");
      scrollToPlayerCommandPanel();
      return;
    }
    if (startTemporaryCardTaskRewardFlow(finishedFlow.cardTemporaryTasks, settleResult, {
      effects: temporaryTaskRewardEffects,
      futureSpanPlayedCard: finishedFlow.futureSpanPlayedCard,
      historySource: finishedFlow.historySource || HISTORY_SOURCE_MAIN,
      scanRunId: finishedFlow.scanRunId || null,
      delayedPublicRefills: transferDelayedPublicRefills ? delayedPublicRefills : [],
    })) {
      return;
    }
    if (finishedFlow.futureSpanPlayedCard) {
      releaseFutureSpanAfterPlayWithHistory();
    }
    if (finishedFlow.playCardEvent) {
      settleCardTasksAfterEffect({ events: [finishedFlow.playCardEvent], render: false });
    }
    if (finishedFlow.scanActionEvent) {
      settleCardTasksAfterEffect({ events: [finishedFlow.scanActionEvent], render: false });
    }
    const queuedType1Result = applyType1TriggerMatches([]);
    if (queuedType1Result || hasActiveCardTriggerResolution() || isActionEffectFlowActive()) {
      workingRoot.rocketState.statusNote = queuedType1Result?.message || "卡牌触发：请先完成触发效果";
      if (finishedFlow.consumesMainAction !== false || finishedFlow.resumePendingActionExecuted) {
        markActionPending();
      }
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return;
    }
    if (actionType === "pass") {
      const passPlayer = getPlayerById(finishedFlow.playerId) || getCurrentPlayer();
      const passSettlement = settleCardTasksAfterEffect({
        events: [finishedFlow.passEvent || createPassEvent(passPlayer)],
        render: false,
      });
      if (hasActiveCardTriggerResolution() || isActionEffectFlowActive()) {
        workingRoot.rocketState.statusNote = passSettlement?.type1Result?.message || "PASS 任务触发：请先完成触发效果";
        markActionPending();
        renderPlayerStats();
        updateActionButtons();
        renderStateReadout();
        return;
      }
    }
    const baseMessage = actionType === "scan"
      ? "扫描效果已全部处理，可继续执行次要行动或回合结束"
      : actionType === "pass"
        ? "PASS 效果已全部处理，可继续执行次要行动或回合结束"
      : "效果已全部处理，可继续执行次要行动或回合结束";
    const settleMessage = settleResult?.ok
      ? `${settleResult.message}；${settleResult.participantAwardMessage || "参与结算玩家各获得1宣传"}`
      : null;
    workingRoot.rocketState.statusNote = [baseMessage, settleMessage, delayedPublicRefillResult?.message]
      .filter(Boolean)
      .join("；");
    if (finishedFlow.consumesMainAction !== false || finishedFlow.resumePendingActionExecuted) {
      markActionPending();
    }
    renderPlayerStats();
    renderAlienPanels();
    updateActionButtons();
    renderStateReadout();
    maybeResumeTurnEndAfterReveal();
  }

  function finishActionEffectFlow() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "effect_finish_flow" }).value;
  }

  function maybeCompleteActionEffectFromScan(result) {
    if (!result?.ok || !isActionEffectFlowActive()) return;
    const current = getCurrentActionEffect();
    if (current) current.result = result;
    completeCurrentActionEffect();
  }

  function closeScanAction4Picker() {
    if (!els.scanAction4Overlay) return;
    els.scanAction4Overlay.hidden = true;
    if (els.scanAction4Actions) els.scanAction4Actions.replaceChildren();
  }

  function openScanAction4Picker() {
    if (!els.scanAction4Overlay || !els.scanAction4Actions) {
      if (headlessMode) return handleScanAction4Choice("skip");
      return { ok: false, message: "无法打开发射/移动选择" };
    }

    const currentPlayer = getCurrentPlayer();
    const currentEffect = getCurrentActionEffect();
    const skipCost = Boolean(currentEffect?.options?.skipCost);
    const rocketsForPlayer = getMovableTokensForPlayer(currentPlayer?.id);
    const hasRocket = rocketsForPlayer.length > 0;
    const canLaunch = skipCost || players.canAfford(currentPlayer, { energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY });
    const choices = [];

    if (canLaunch) {
      choices.push({
        id: "launch",
        label: "发射",
        description: skipCost ? "免费在地球扇区发射火箭" : "消耗 1 能量，在地球扇区发射火箭",
      });
    } else {
      choices.push({
        id: "launch",
        label: "发射",
        description: "能量不足，无法发射",
        disabled: true,
      });
    }

    if (hasRocket) {
      choices.push({
        id: "move",
        label: "移动",
        description: "选择飞船并移动，不消耗能量或手牌",
      });
    }

    choices.push({
      id: "skip",
      label: "跳过",
      description: "不执行本次发射/移动效果",
    });

    if (els.scanAction4Subtitle) {
      els.scanAction4Subtitle.textContent = hasRocket
        ? "选择发射、移动，或跳过此效果。"
        : "没有飞船时只能选择发射或跳过。";
    }

    els.scanAction4Actions.replaceChildren(...choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button";
      button.dataset.scanAction4Choice = choice.id;
      button.disabled = Boolean(choice.disabled);
      button.innerHTML = `${choice.label}<small>${choice.description || ""}</small>`;
      return button;
    }));

    els.scanAction4Overlay.hidden = false;
    return { ok: true };
  }

  function launchRocketForScanAction4(workingRoot) {
    if (!workingRoot?.playerState || !workingRoot?.rocketState) {
      throw new TypeError("launchRocketForScanAction4 缺少 workingRoot");
    }
    const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
    const currentEffect = getCurrentActionEffect();
    const skipCost = Boolean(currentEffect?.options?.skipCost);
    if (!skipCost && !players.canAfford(currentPlayer, { energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY })) {
      return { ok: false, message: "能量不足，发射需要 1 能量" };
    }

    beginEffectHistoryStep("发射/移动");

    const result = abilities.executeAbility("scanAction4", createActionContextForWorkingRoot(workingRoot), {
      choice: "launch",
      skipCost,
      cost: skipCost ? {} : { energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY },
    });
    if (!result.ok) {
      endEffectHistoryStep();
      return result;
    }

    maybeApplyIndustryLaunchScan(result);
    recordAbilityCommands(result, actionHistory, workingRoot);

    renderRocketElement(result.rocket);
    const current = getCurrentActionEffect();
    if (current) current.result = result;
    return result;
  }

  function beginScanAction4FreeMoveForRoot(workingRoot) {
    const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
    const rocketsForPlayer = getMovableTokensForPlayer(currentPlayer?.id);
    if (!rocketsForPlayer.length) {
      workingRoot.rocketState.statusNote = "没有可移动的飞船";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }

    decisionState.actionEffectFlow.freeMoveMode = true;
    workingRoot.rocketState.statusNote = rocketsForPlayer.length > 1
      ? "扫描效果：请点击要移动的飞船"
      : "扫描效果：使用方向键移动飞船";
    if (rocketsForPlayer.length === 1) {
      activateMoveMode(rocketsForPlayer[0].id);
    } else {
      selectDefaultRocketForCurrentPlayer();
    }
    renderStateReadout();
    return { ok: true, message: workingRoot.rocketState.statusNote };
  }

  function beginScanAction4FreeMove() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "effect_begin_scan_free_move" }).value;
  }

  function executeFreeMoveForScanAction4ForRoot(workingRoot, deltaX, deltaY, rocketId, payment = {}) {
    const { playerState: workingPlayerState, rocketState: workingRocketState } = workingRoot;
    const moveCheck = rocketActions.canMoveRocket(workingRocketState, rocketId, deltaX, deltaY);
    if (!moveCheck.ok) {
      workingRocketState.statusNote = moveCheck.message;
      renderStateReadout();
      return moveCheck;
    }

    const currentPlayer = players.getCurrentPlayer(workingPlayerState);
    const providedMovePoints = Math.max(0, Math.round(Number(payment.providedMovePoints ?? 1) || 0));
    const terrainRequired = Number.isFinite(Number(payment.terrainRequired))
      ? Math.max(1, Math.round(Number(payment.terrainRequired)))
      : getRequiredMovePointsForUi(currentPlayer, rocketId, deltaX, deltaY);
    if (!payment.fromMovePayment && providedMovePoints < terrainRequired) {
      return beginSupplementalMovePayment({
        deltaX,
        deltaY,
        rocketId,
        terrainRequired,
        providedMovePoints,
        context: { type: "scan_action_4", terrainRequired },
        message: `发射/移动：已有 ${providedMovePoints} 点移动力，还需 ${terrainRequired - providedMovePoints} 点（可弃移动牌或用能量）`,
      });
    }

    const energyCost = Math.max(0, Math.round(Number(payment.energyCost) || 0));
    beginEffectHistoryStep("发射/移动");

    const result = abilities.executeAbility("scanAction4", createActionContextForWorkingRoot(workingRoot), {
      choice: "move",
      cost: energyCost > 0 ? { energy: energyCost } : {},
      movementPoints: Math.max(terrainRequired, providedMovePoints + energyCost),
      rocketId,
      deltaX,
      deltaY,
    });
    if (result.rocket) renderRocketElement(result.rocket);
    if (!result.ok) {
      if (payment.discardCommand) payment.discardCommand.undo();
      endEffectHistoryStep();
      workingRocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    if (payment.discardCommand) recordHistoryCommand(payment.discardCommand);
    recordAbilityCommands(result, actionHistory, workingRoot);

    decisionState.actionEffectFlow.freeMoveMode = false;
    deactivateMoveMode();
    const current = getCurrentActionEffect();
    if (current) current.result = result;
    workingRocketState.statusNote = `扫描效果：${result.message}`;
    renderPlayerStats();
    completeCurrentActionEffect();
    renderStateReadout();
    return result;
  }

  function executeFreeMoveForScanAction4(...args) {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "scan_execute_free_move", args });
  }

  function beginCardMoveEffectForRoot(workingRoot, effect) {
    const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
    const effectCost = getCardMoveEffectCost(effect);
    if (Object.keys(effectCost).length && !players.canAfford(currentPlayer, effectCost)) {
      workingRoot.rocketState.statusNote = `${effect.label}：需要 ${players.formatResourceCost(effectCost)}，可点击跳过`;
      deactivateMoveMode();
      renderActionEffectBar();
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }
    const rocketsForPlayer = getMovableTokensForCardMoveEffect(effect, currentPlayer?.id);
    if (!rocketsForPlayer.length) {
      const message = isIndustryHuanyuMoveEffect(effect)
        ? `${effect.label}：没有可移动的另一枚火箭，可点击跳过`
        : `${effect.label || "移动"}：没有可移动的飞船，已跳过`;
      deactivateMoveMode();
      if (!isIndustryHuanyuMoveEffect(effect) || headlessMode) {
        return skipActionEffectWithMessage(effect, headlessMode
          ? `${effect.label || "移动"}：没有可移动的飞船，已跳过`
          : message, {
          reason: "没有可移动的飞船",
          abilityId: "moveProbe",
        });
      }
      workingRoot.rocketState.statusNote = message;
      renderActionEffectBar();
      renderStateReadout();
      return { ok: false, message };
    }

    if (!decisionState.actionEffectFlow.cardMoveEffect
      || decisionState.actionEffectFlow.cardMoveEffect.effect?.id !== effect.id) {
      initCardMoveEffectState(effect);
    } else {
      effect.badge = String(decisionState.actionEffectFlow.cardMoveEffect.poolRemaining);
    }

    const poolRemaining = decisionState.actionEffectFlow.cardMoveEffect.poolRemaining;
    workingRoot.rocketState.statusNote = poolRemaining > 1
      ? `${effect.label}：剩余 ${poolRemaining} 点移动力，请点击要移动的飞船`
      : rocketsForPlayer.length > 1
        ? `${effect.label}：请点击要移动的飞船`
        : `${effect.label}：使用方向键移动飞船`;
    renderActionEffectBar();
    if (rocketsForPlayer.length === 1) {
      activateMoveMode(rocketsForPlayer[0].id);
    } else {
      selectDefaultRocketFromCandidates(rocketsForPlayer);
    }
    renderStateReadout();
    return { ok: true, message: workingRoot.rocketState.statusNote };
  }

  function beginCardMoveEffect(effect) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "effect_begin_card_move",
      effect,
    }).value;
  }

  function applyCardMoveRewardEffect(rewardEffect, messageParts) {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer || !rewardEffect) return null;

    if (rewardEffect.type === "gain_resources") {
      const gain = rewardEffect.options?.gain || {};
      players.gainResources(currentPlayer, gain);
      recordScoreSourceForGainEffect(currentPlayer, rewardEffect, gain);
      messageParts.push(`${rewardEffect.label}：${formatPlanetRewardGain(gain)}`);
      return { ok: true, effect: rewardEffect, gain };
    }

    if (rewardEffect.type === "gain_data") {
      const count = Math.max(0, Math.round(rewardEffect.options?.count || 0));
      const results = [];
      for (let index = 0; index < count; index += 1) {
        results.push(data.gainData(currentPlayer, { source: "card_move" }));
      }
      const gained = results.filter((item) => item.ok).length;
      const discarded = results.filter((item) => item.discarded).length;
      messageParts.push(`${rewardEffect.label}：获得 ${gained}/${count} 数据${discarded ? `，弃置${discarded}` : ""}`);
      return { ok: true, effect: rewardEffect, results };
    }

    messageParts.push(`暂不支持的移动后奖励：${rewardEffect.type}`);
    return { ok: false, effect: rewardEffect };
  }

  function applyCardMoveAfterEventRewards(effect, moveResult, messageParts) {
    const rewards = effect.options?.afterEventRewards || [];
    if (!rewards.length || !moveResult?.events?.length) return [];

    if (!decisionState.actionEffectFlow.cardEventRewardKeys) {
      decisionState.actionEffectFlow.cardEventRewardKeys = [];
    }
    const usedKeys = new Set(decisionState.actionEffectFlow.cardEventRewardKeys);
    const applied = [];

    for (const reward of rewards) {
      if (!moveResult.events.some((event) => {
        if (event.type !== reward.eventType) return false;
        if (reward.planetIds?.length && !reward.planetIds.includes(event.planetId)) return false;
        if (reward.includePlanetIds?.length && !reward.includePlanetIds.includes(event.planetId)) return false;
        if (reward.excludePlanetIds?.length && reward.excludePlanetIds.includes(event.planetId)) return false;
        return true;
      })) continue;
      if (reward.onceKey && usedKeys.has(reward.onceKey)) continue;
      const appliedReward = applyCardMoveRewardEffect(reward.effect, messageParts);
      if (!appliedReward?.ok) continue;
      applied.push(appliedReward);
      if (reward.onceKey) {
        usedKeys.add(reward.onceKey);
        decisionState.actionEffectFlow.cardEventRewardKeys.push(reward.onceKey);
      }
    }

    return applied;
  }

  function maybeApplyCardMoveSameRingReward(effect, moveResult, messageParts) {
    const rewardEffect = effect.options?.sameRingReward;
    const payload = moveResult?.payload || {};
    const fromY = payload.from?.y ?? payload.geometry?.from?.y;
    const toY = payload.to?.y ?? payload.geometry?.to?.y;
    const deltaX = Math.abs(Number(payload.deltaX) || 0);
    if (!rewardEffect || fromY == null || toY == null || Number(fromY) !== Number(toY) || deltaX <= 0) {
      return null;
    }
    if (!decisionState.actionEffectFlow.cardEventRewardKeys) decisionState.actionEffectFlow.cardEventRewardKeys = [];
    const key = `${effect.id || "card-move"}:same-ring`;
    if (decisionState.actionEffectFlow.cardEventRewardKeys.includes(key)) return null;
    const applied = applyCardMoveRewardEffect(rewardEffect, messageParts);
    if (applied?.ok) decisionState.actionEffectFlow.cardEventRewardKeys.push(key);
    return applied;
  }

  function maybeApplyCardMoveDistinctEventReward(effect, moveResult, messageParts) {
    const reward = effect.options?.distinctEventReward;
    if (!reward || !moveResult?.events?.length) return null;
    if (!decisionState.actionEffectFlow.cardMoveDistinctEvents) decisionState.actionEffectFlow.cardMoveDistinctEvents = {};
    if (!decisionState.actionEffectFlow.cardEventRewardKeys) decisionState.actionEffectFlow.cardEventRewardKeys = [];
    const key = reward.onceKey || `${effect.id || "card-move"}:distinct:${reward.eventType}`;
    if (decisionState.actionEffectFlow.cardEventRewardKeys.includes(key)) return null;
    if (!decisionState.actionEffectFlow.cardMoveDistinctEvents[key]) decisionState.actionEffectFlow.cardMoveDistinctEvents[key] = [];
    const values = decisionState.actionEffectFlow.cardMoveDistinctEvents[key];
    const distinctBy = reward.distinctBy || "planetId";

    for (const event of moveResult.events || []) {
      if (event?.type !== reward.eventType) continue;
      const value = event[distinctBy];
      if (value != null && !values.includes(value)) values.push(value);
    }

    const minCount = Math.max(1, Math.round(Number(reward.minCount) || 1));
    if (values.length < minCount) return null;
    const applied = applyCardMoveRewardEffect(reward.effect, messageParts);
    if (applied?.ok) decisionState.actionEffectFlow.cardEventRewardKeys.push(key);
    return applied;
  }

  function executeCardMoveForEffectForRoot(workingRoot, deltaX, deltaY, rocketId) {
    return requestCardEffectMoveForRoot(workingRoot, deltaX, deltaY, rocketId);
  }

  function executeCardMoveForEffect(...args) {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "card_execute_move_effect", args });
  }

  function executeSectorXScanEffect(...args) {
    return callEffectExecutorCommand("executeSectorXScanEffect", args);
  }

  function maybeReturnPlayedCardToHandAfterSectorScan(...args) {
    return callEffectExecutorCommand("maybeReturnPlayedCardToHandAfterSectorScan", args);
  }

  function handleProbeSectorScanChoice(...args) {
    return callEffectChoiceCommand("handleProbeSectorScanChoice", args);
  }

  function confirmProbeSectorScanSelection(...args) {
    return callEffectChoiceCommand("confirmProbeSectorScanSelection", args);
  }

  function getPlanetName(...args) {
    return callEffectExecutorCommand("getPlanetName", args);
  }

  function markerBelongsToPlayer(...args) {
    return callEffectExecutorCommand("markerBelongsToPlayer", args);
  }

  function playerHasOwnOrbitMarkerAtPlanet(...args) {
    return callEffectExecutorCommand("playerHasOwnOrbitMarkerAtPlanet", args);
  }

  function markerOwnerLabel(...args) {
    return callEffectExecutorCommand("markerOwnerLabel", args);
  }

  function buildPlanetMarkerRemovalChoices(...args) {
    return callEffectExecutorCommand("buildPlanetMarkerRemovalChoices", args);
  }

  function removePlanetMarkerForChoice(...args) {
    return callEffectExecutorCommand("removePlanetMarkerForChoice", args);
  }

  function handleRemovePlanetMarkerChoice(...args) {
    return callEffectExecutorCommand("handleRemovePlanetMarkerChoice", args);
  }

  function handleScanAction4Choice(...args) {
    return callEffectExecutorCommand("handleScanAction4Choice", args);
  }

  function formatPlanetRewardGain(...args) {
    return callEffectExecutorCommand("formatPlanetRewardGain", args);
  }

  function finishAutomaticRewardEffect(...args) {
    return callEffectExecutorCommand("finishAutomaticRewardEffect", args);
  }

  function buildPlutoRewardEffectsForAction(...args) {
    return callEffectExecutorCommand("buildPlutoRewardEffectsForAction", args);
  }

  function buildPlutoChoiceRewardSummary(...args) {
    return callEffectExecutorCommand("buildPlutoChoiceRewardSummary", args);
  }

  function handleHandCornerChoice(...args) {
    return callEffectExecutorCommand("handleHandCornerChoice", args);
  }

  function getSectorXsMatchingCondition(...args) {
    return callEffectExecutorCommand("getSectorXsMatchingCondition", args);
  }

  function sectorXHasAvailableScanTarget(...args) {
    return callEffectExecutorCommand("sectorXHasAvailableScanTarget", args);
  }

  function handleConditionalSectorChoice(...args) {
    return callEffectChoiceCommand("handleConditionalSectorChoice", args);
  }

  function handleDiscardIncomeCardChoice(...args) {
    return callEffectChoiceCommand("handleDiscardIncomeCardChoice", args);
  }

  function confirmDiscardAnyForIncome(...args) {
    return callEffectChoiceCommand("confirmDiscardAnyForIncome", args);
  }

  function handlePayCreditChoice(...args) {
    return callEffectChoiceCommand("handlePayCreditChoice", args);
  }

  function handleFundamentalismExchangeChoice(...args) {
    return callEffectChoiceCommand("handleFundamentalismExchangeChoice", args);
  }

  function isAlienFamilyCard(...args) {
    return callEffectExecutorCommand("isAlienFamilyCard", args);
  }

  function handleDiscardCornerRepeatChoice(...args) {
    return callEffectChoiceCommand("handleDiscardCornerRepeatChoice", args);
  }

  function handleRemoveOrbitToProbeChoice(...args) {
    return callEffectChoiceCommand("handleRemoveOrbitToProbeChoice", args);
  }

  function handleReturnUnfinishedTaskChoice(...args) {
    return callEffectExecutorCommand("handleReturnUnfinishedTaskChoice", args);
  }

  function countOwnedTechByType(...args) {
    return callEffectExecutorCommand("countOwnedTechByType", args);
  }

  function enrichScanResultEvents(...args) {
    return callEffectExecutorCommand("enrichScanResultEvents", args);
  }

  function getPlayerCompanyBaseIncome(...args) {
    return callEffectExecutorCommand("getPlayerCompanyBaseIncome", args);
  }

  function insertActionEffectsAfterCurrent(...args) {
    return callEffectExecutorCommand("insertActionEffectsAfterCurrent", args);
  }

  function insertActionEffectsBeforeCurrent(...args) {
    return callEffectExecutorCommand("insertActionEffectsBeforeCurrent", args);
  }

  function handleOptionalHandScanChoice(...args) {
    return callEffectExecutorCommand("handleOptionalHandScanChoice", args);
  }

  function handleProbeLocationRewardChoice(...args) {
    return callEffectChoiceCommand("handleProbeLocationRewardChoice", args);
  }

  function openYichangdianCornerPicker(...args) {
    return callEffectExecutorCommand("openYichangdianCornerPicker", args);
  }

  function handleYichangdianCornerChoice(...args) {
    return callEffectExecutorCommand("handleYichangdianCornerChoice", args);
  }

  function applyAomomoScanCostAndBonus(...args) {
    return callEffectExecutorCommand("applyAomomoScanCostAndBonus", args);
  }

  function executeActionEffectForOwner(...args) {
    return effectExecutors.executeActionEffectForOwner(...args);
  }

  const effectExecutorContext = {
    insertActionEffectsAfterCurrent: (...args) => effectExecutors.insertActionEffectsAfterCurrent(...args),
    openAlienTraceRewardEffect: (...args) => effectExecutors.openAlienTraceRewardEffect(...args),
    BANRENMA_PANEL_BONUS_EFFECT_TYPE,
    INCOME_GAIN_LABELS,
    JIUZHE_THRESHOLD_CARD_EFFECT_TYPE,
    SCORE_SOURCE_KEYS,
    abilities,
    activateNextActionEffect,
    addPlayerScoreSource,
    addPlutoMarker,
    addScoreSourceFromGain,
    alienTraceRewardFlow,
    aliens,
    amiba,
    aomomo,
    applyIncomeFromCard,
    applyIncomeGainWithImmediateRewards,
    applyYichangdianRewardToPlayer,
    assignEffectOwner,
    attachScoreSourceToEffects,
    banrenma,
    beginAlienTraceBoardPlacement,
    beginCardMoveEffect,
    beginCardSelection,
    beginDiscardSelection,
    beginEffectHistoryStep,
    beginPassReserveSelection,
    beginScanAction4FreeMove,
    blindDrawCardForPlayer,
    buildNebulaScanChoice,
    buildPlanetRewardEffectsWithIndustry,
    buildPlutoMarkerRemovalChoices,
    buildProbeLocationIndex: (...args) => buildProbeLocationIndex(...args),
    buildSectorScanChoicesForX,
    buildSectorScanChoicesForXs,
    cardEffects,
    cards,
    chong,
    claimRunezuPlanetSymbolForTravelResult,
    claimRunezuSourceSymbolWithHistory,
    closeAlienTracePicker,
    closeScanAction4Picker,
    closeScanTargetPicker,
    collectPlutoMarkers,
    completeCurrentActionEffect,
    createActionContext: createActionContextForWorkingRoot,
    createPublicScanPendingAction,
    createScanRunId,
    data,
    decisionSessions,
    document,
    effectChoiceFlowHelpers,
    els,
    endEffectHistoryStep,
    endGameScoring,
    ensureCardFlowEventBonuses,
    ensurePlutoCardEffectState,
    executeBanrenmaPanelBonusEffect,
    executeIndustryHeliosPassiveRewardEffect: (...args) => executeIndustryHeliosPassiveRewardEffect?.(...args),
    executeIndustryPiratesRaidLaunchEffect: (...args) => executeIndustryPiratesRaidLaunchEffect?.(...args),
    executeIndustryPiratesRaidMarkerEffect: (...args) => executeIndustryPiratesRaidMarkerEffect?.(...args),
    executeIndustryPiratesRaidPublicityEffect: (...args) => executeIndustryPiratesRaidPublicityEffect?.(...args),
    executeIndustrySentinelCornerEffect: (...args) => executeIndustrySentinelCornerEffect?.(...args),
    executeIndustryStrategyPassiveRewardEffect: (...args) => executeIndustryStrategyPassiveRewardEffect?.(...args),
    executeIndustryStratusCornerEffect: (...args) => executeIndustryStratusCornerEffect?.(...args),
    executeJiuzheThresholdCardEffect,
    executePassFirstRotateEffect,
    executePassHandLimitEffect,
    executeRunezuSymbolRewardEffect,
    executeScanActionFinalizeEffect,
    executeScanPublicRefillEffect,
    executeSectorFinishScanEffect,
    expandScanChoicesWithAomomoTargets,
    finishChongFossilEffect,
    formatCardCornerRewardMessage,
    formatIncomeGain,
    formatPlutoChoiceLabel,
    getActionResultOwnerPlayer,
    getAomomoCurrentX,
    getAutoDataPlacementCheck,
    getCardTypeCode,
    getChongPlanetLabel,
    getCurrentActionEffect,
    getCurrentPlanetActionPlacement,
    getCurrentPlayer,
    getEarthSectorCoordinate,
    getEffectOwnerPlayer,
    getEligibleAlienSlotIdsForTraceEffect,
    getExplicitEffectOwnerPlayer,
    getFlowMarkedNebulaIds,
    getIrreversibleReason,
    getNebulaCurrentX,
    getPendingOwnerFields,
    getPendingOwnerPlayer,
    getPlanetSectorCoordinate,
    getPlayerById,
    getPlutoActionCost,
    getPlutoActionState,
    getPlutoCandidateRockets,
    getPlutoChoiceActionLabel,
    getPlutoReservedCards,
    getPublicScanChoicesForCard,
    getPublicScanIconForScanCode,
    getPublicScanMaxSelectable,
    getResearchTechSelectionPayload: (...args) => getResearchTechSelectionPayload?.(...args),
    getSectorContentForMove,
    getSectorScanTargetLabel,
    hasAlienTracePanelPlacementTarget,
    hasHandScanTargetCard,
    hasPlayerVisitedPlanetThisTurn,
    historyCommands,
    initialCards,
    isActionEffectFlowActive,
    isAsteroidContent,
    isDataPoolFull,
    jiuzhe,
    launchRocketForScanAction4,
    markCurrentActionIrreversible,
    maybeApplyIndustryLaunchScan: (...args) => maybeApplyIndustryLaunchScan?.(...args),
    maybeCompleteActionEffectFromScan,
    maybeConsumeAlienLabPanelForMainAction: (...args) => maybeConsumeAlienLabPanelForMainAction?.(...args),
    nebulaHasScannableData,
    normalizeResourceCost,
    onTechTileTaken: (...args) => onTechTileTaken?.(...args),
    openAmibaSymbolChoiceDialog,
    openAmibaTraceRemovalDialog,
    openAomomoCardGainDialog,
    openAutoDataPlacementPrompt,
    openChongFossilChoiceDialog,
    openFangzhouTraceDestinationChoice,
    openLandTargetPicker,
    openRunezuSymbolBranchDialog,
    openScanAction4Picker,
    openScanTargetPicker,
    planetReferenceLayout,
    planetRewards,
    planetStats,
    playerHasOwnPlutoLanding,
    players,
    recordAbilityCommands,
    recordHistoryCommand,
    recordScoreSourceForGainEffect,
    recordTechBonusScore,
    removePlutoMarker,
    removeRocketElement,
    renderActionEffectBar,
    renderAlienPanels,
    renderDebugPlayerSwitch,
    renderPlayerHand,
    renderPlayerStats,
    renderPublicCards,
    renderReservedCards: (...args) => renderReservedCards(...args),
    renderRocketElement,
    renderRockets,
    renderRotateStateToken,
    renderRunezuBoardSymbols,
    renderSectorNebulaDataBoard,
    renderStateReadout,
    renderTechBoard: (...args) => renderTechBoard?.(...args),
    renderWheels,
    replaceNebulaDataForCurrentPlayer,
    resolvePlayerReference,
    restoreMutableObject,
    restoreObjectSnapshot,
    rocketActions,
    runezu,
    scanEffects,
    shouldSkipCurrentResearchTechCost: (...args) => shouldSkipCurrentResearchTechCost?.(...args),
    skipActionEffectWithMessage,
    solar,
    syncHandScanSelectionChrome,
    syncPlanetOrbitLandMarkers,
    syncTechSelectionChrome: (...args) => syncTechSelectionChrome?.(...args),
    tech,
    uiRuntimeState,
    updateActionButtons,
    updatePublicCardControls,
    withEffectExecutionPlayer,
    withPendingOwnerPlayer,
    yichangdian,
  };
  const effectMovementScanExecutors = effectMovementScanExecutorsModule.createEffectMovementScanExecutors(
    effectExecutorContext,
  );
  const effectRewardExecutors = effectRewardExecutorsModule.createEffectRewardExecutors({
    ...effectExecutorContext,
    ...effectMovementScanExecutors,
  });
  const effectAlienExecutors = effectAlienExecutorsModule.createEffectAlienExecutors({
    ...effectExecutorContext,
    ...effectMovementScanExecutors,
    ...effectRewardExecutors,
  });
  const effectExecutors = {
    ...effectMovementScanExecutors,
    ...effectRewardExecutors,
    ...effectAlienExecutors,
  };
  Object.assign(
    effectExecutors,
    effectDispatcherModule.createEffectDispatcher({ ...effectExecutorContext, ...effectExecutors }),
  );

  function handleActionEffectButtonClickForRoot(workingRoot, effectIndex) {
    return actionRuntimeController.handleActionEffectButtonClick(workingRoot, effectIndex);
  }

  function handleActionEffectButtonClick(effectIndex) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "effect_bar_click",
      effectIndex,
    }).value;
  }

  function beginScanAction() {
    return actionRuntimeController?.dispatchAction({
      kind: "standard_intent",
      family: "scan",
      selector: { kind: "standard-scan" },
    }) || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE", message: "Standard Action runtime 尚未装配" };
  }

  function resize() {
    if (headlessMode) return;
    const h = window.innerHeight;
    const boardWidth = els.boardShell.clientWidth || window.innerWidth;
    const boardHeight = h - 160;
    const baseBoardSize = Math.max(220, Math.min(boardWidth, boardHeight));
    const compactWidthCap = window.innerWidth <= 760 ? Math.max(220, window.innerWidth - 16) : Infinity;
    const boardSize = Math.floor(Math.min(baseBoardSize * BOARD_VISUAL_SCALE, boardWidth, compactWidthCap));
    els.playerCommand.style.width = `${boardSize}px`;
    els.wheelWrap.style.width = `${boardSize}px`;
    els.wheelWrap.style.height = `${boardSize}px`;
    els.planetsReference.style.width = `${boardSize}px`;
    if (els.buttonWrap) {
      els.buttonWrap.style.width = `${boardSize}px`;
    }
    layoutPlayerHandFan();
    layoutReservedCardRows();
    alignAlienPanelsToPlanets();
    renderAlienPanels();
    renderTechBoard();
    if (uiRuntimeState.moveHighlightRocketId != null) scheduleRenderMoveArrows();
  }

  function syncTechRenderContext() {
    techRenderContext.supplyStage = els.techStage;
    techRenderContext.playerBoardTechLayer = els.playerBoardTechLayer;
    techRenderContext.supplySlots = Object.fromEntries(
      [...document.querySelectorAll(".tech-slot[data-tech-slot]")].map((slot) => [
        slot.dataset.techSlot,
        slot,
      ]),
    );
  }

  let alienSpeciesRuntime = null;
  function getPendingChongFossilChoice() {
    return alienSpeciesRuntime?.getChongFossilDecisionDraft?.() || null;
  }
  function getPendingAmibaSymbolChoice() {
    return alienSpeciesRuntime?.getAmibaSymbolDecisionDraft?.() || null;
  }
  function getPendingYichangdianCornerAction() {
    return effectExecutors?.getYichangdianCornerAction?.() || null;
  }
  function getPendingYichangdianCornerCards(workingRoot, pendingContext = null) {
    return effectExecutors?.getPendingYichangdianCornerCards?.(workingRoot, pendingContext) || [];
  }
  function getPendingRunezuSymbolBranch() {
    return alienSpeciesRuntime?.getRunezuSymbolBranchDecisionDraft?.() || null;
  }
  function getPendingRunezuFaceSymbolPlacement() {
    return alienSpeciesRuntime?.getRunezuFaceSymbolDecisionDraft?.() || null;
  }
  function getPendingRunezuCardGain() { return alienSpeciesRuntime?.getRunezuCardGainDecisionDraft?.() || null; }
  function getPendingAmibaCardGain() { return alienSpeciesRuntime?.getAmibaCardGainDecisionDraft?.() || null; }
  function getPendingAomomoCardGain() { return alienSpeciesRuntime?.getAomomoCardGainDecisionDraft?.() || null; }
  function getPendingYichangdianCardGain() { return alienSpeciesRuntime?.getYichangdianCardGainDecisionDraft?.() || null; }
  function getPendingBanrenmaCardGain() { return alienSpeciesRuntime?.getBanrenmaCardGainDecisionDraft?.() || null; }
  function getPendingChongCardGain() { return alienSpeciesRuntime?.getChongCardGainDecisionDraft?.() || null; }
  function getPendingAmibaTraceRemoval() { return alienSpeciesRuntime?.getAmibaTraceRemovalDecisionDraft?.() || null; }
  function getPendingJiuzheCardPlay() { return alienSpeciesRuntime?.getJiuzheCardPlayDecisionDraft?.() || null; }
  function getPendingBanrenmaOpportunity() { return alienSpeciesRuntime?.getBanrenmaOpportunityDecisionDraft?.() || null; }
  function getAlienTraceLayer(...args) { return alienSpeciesRuntime.getAlienTraceLayer(...args); }
  function getAlienJiuzheTraceLayer(...args) { return alienSpeciesRuntime.getAlienJiuzheTraceLayer(...args); }
  function getAlienYichangdianCardArea(...args) { return alienSpeciesRuntime.getAlienYichangdianCardArea(...args); }
  function getAlienBanrenmaCardArea(...args) { return alienSpeciesRuntime.getAlienBanrenmaCardArea(...args); }
  function getAlienChongCardArea(...args) { return alienSpeciesRuntime.getAlienChongCardArea(...args); }
  function getAlienAmibaCardArea(...args) { return alienSpeciesRuntime.getAlienAmibaCardArea(...args); }
  function getAlienAomomoCardArea(...args) { return alienSpeciesRuntime.getAlienAomomoCardArea(...args); }
  function getAlienRunezuCardArea(...args) { return alienSpeciesRuntime.getAlienRunezuCardArea(...args); }
  function getAlienJiuzheThresholdElement(...args) { return alienSpeciesRuntime.getAlienJiuzheThresholdElement(...args); }
  function getAlienBanrenmaScoremarkElement(...args) { return alienSpeciesRuntime.getAlienBanrenmaScoremarkElement(...args); }
  function getAlienBackImage(...args) { return alienSpeciesRuntime.getAlienBackImage(...args); }
  function createJiuzheThresholdNode(...args) { return alienSpeciesRuntime.createJiuzheThresholdNode(...args); }
  function renderJiuzheThresholds(...args) { return callBrowserDomainCommand("alien_species", "renderJiuzheThresholds", args); }
  function maybeRevealAlienAfterTrace(...args) { return callBrowserDomainCommand("alien_species", "maybeRevealAlienAfterTrace", args); }
  function isDebugAlienTraceMode(...args) { return alienSpeciesRuntime.isDebugAlienTraceMode(...args); }
  function setDebugAlienTraceModeActive(...args) { return alienSpeciesRuntime.setDebugAlienTraceModeActive(...args); }
  function toggleDebugAlienTraceMode(...args) { return alienSpeciesRuntime.toggleDebugAlienTraceMode(...args); }
  function enableDebugAlienTraceModeForReveal(...args) { return alienSpeciesRuntime.enableDebugAlienTraceModeForReveal(...args); }
  function renderYichangdianCardDisplays(...args) { return callBrowserDomainCommand("alien_species", "renderYichangdianCardDisplays", args); }
  function renderBanrenmaScoremarks(...args) { return callBrowserDomainCommand("alien_species", "renderBanrenmaScoremarks", args); }
  function renderBanrenmaCardDisplays(...args) { return callBrowserDomainCommand("alien_species", "renderBanrenmaCardDisplays", args); }
  function renderChongCardDisplays(...args) { return callBrowserDomainCommand("alien_species", "renderChongCardDisplays", args); }
  function renderAmibaCardDisplays(...args) { return callBrowserDomainCommand("alien_species", "renderAmibaCardDisplays", args); }
  function renderAomomoCardDisplays(...args) { return callBrowserDomainCommand("alien_species", "renderAomomoCardDisplays", args); }
  function renderRunezuCardDisplays(...args) { return callBrowserDomainCommand("alien_species", "renderRunezuCardDisplays", args); }
  function renderBanrenmaBonusMarkers(...args) { return callBrowserDomainCommand("alien_species", "renderBanrenmaBonusMarkers", args); }
  function renderAlienPanels(...args) { return callBrowserDomainCommand("alien_species", "renderAlienPanels", args); }
  function randomizeAliens(...args) { return callBrowserDomainCommand("alien_species", "randomizeAliens", args); }
  function applyFangzhouUnlockStateTraceReward(...args) { return alienSpeciesRuntime.applyFangzhouUnlockStateTraceReward(...args); }
  function confirmFangzhouCard2Unlock(...args) { return callBrowserDomainCommand("alien_species", "confirmFangzhouCard2Unlock", args); }
  function getAlienFangzhouCardArea(...args) { return alienSpeciesRuntime.getAlienFangzhouCardArea(...args); }
  function createFangzhouReservedButtons(...args) { return callBrowserDomainCommand("alien_species", "createFangzhouReservedButtons", args); }
  function buildFangzhouCard1EffectQueue(...args) { return alienSpeciesRuntime.buildFangzhouCard1EffectQueue(...args); }
  function getFangzhouCard1RewardTargetOptions(...args) { return alienSpeciesRuntime.getFangzhouCard1RewardTargetOptions(...args); }
  function enqueueFangzhouCard1RewardEffects(...args) { return alienSpeciesRuntime.enqueueFangzhouCard1RewardEffects(...args); }
  function flipFangzhouCard1Rewards(...args) { return callBrowserDomainCommand("alien_species", "flipFangzhouCard1Rewards", args); }
  function applyFangzhouCard1Rewards(...args) { return callBrowserDomainCommand("alien_species", "applyFangzhouCard1Rewards", args); }
  function applyFangzhouCard1Reward(...args) { return callBrowserDomainCommand("alien_species", "applyFangzhouCard1Reward", args); }
  function queueFangzhouBasicRewards(...args) { return callBrowserDomainCommand("alien_species", "queueFangzhouBasicRewards", args); }
  function applyFangzhouTraceRewardToPlayer(...args) { return callBrowserDomainCommand("alien_species", "applyFangzhouTraceRewardToPlayer", args); }
  function renderFangzhouCardDisplays(...args) { return callBrowserDomainCommand("alien_species", "renderFangzhouCardDisplays", args); }
  function openFangzhouCard1Dialog(...args) { return callBrowserDomainCommand("alien_species", "openFangzhouCard1Dialog", args); }
  function findPlayerForJiuzheEntry(...args) { return callBrowserDomainCommand("alien_species", "findPlayerForJiuzheEntry", args); }
  function applyJiuzheRewardToPlayer(...args) { return alienSpeciesRuntime.applyJiuzheRewardToPlayer(...args); }
  function findPlayerForYichangdianEntry(...args) { return callBrowserDomainCommand("alien_species", "findPlayerForYichangdianEntry", args); }
  function applyYichangdianRewardToPlayer(...args) { return alienSpeciesRuntime.applyYichangdianRewardToPlayer(...args); }
  function getAvailableDataTokenCount(...args) { return alienSpeciesRuntime.getAvailableDataTokenCount(...args); }
  function spendAvailableDataTokens(...args) { return alienSpeciesRuntime.spendAvailableDataTokens(...args); }
  function applyBanrenmaRewardToPlayer(...args) { return alienSpeciesRuntime.applyBanrenmaRewardToPlayer(...args); }
  function applyAomomoRewardToPlayer(...args) { return alienSpeciesRuntime.applyAomomoRewardToPlayer(...args); }
  function applyChongRewardToPlayer(...args) { return alienSpeciesRuntime.applyChongRewardToPlayer(...args); }
  function applyAmibaRewardToPlayer(...args) { return callBrowserDomainCommand("alien_species", "applyAmibaRewardToPlayer", args); }
  function applyRunezuRewardToPlayer(...args) { return callBrowserDomainCommand("alien_species", "applyRunezuRewardToPlayer", args); }
  function applyRunezuSymbolReward(...args) { return callBrowserDomainCommand("alien_species", "applyRunezuSymbolReward", args); }
  function claimRunezuSourceSymbolWithHistory(...args) { return callBrowserDomainCommand("alien_species", "claimRunezuSourceSymbolWithHistory", args); }
  function closeRunezuCardGainDialog(...args) { return alienSpeciesRuntime.closeRunezuCardGainDialog(...args); }
  function openRunezuCardGainDialog(...args) { return callBrowserDomainCommand("alien_species", "openRunezuCardGainDialog", args); }
  function finishRunezuCardGain(...args) { return callBrowserDomainCommand("alien_species", "finishRunezuCardGain", args); }
  function handleRunezuCardGainChoice(...args) { return callBrowserDomainCommand("alien_species", "handleRunezuCardGainChoice", args); }
  function closeAmibaCardGainDialog(...args) { return alienSpeciesRuntime.closeAmibaCardGainDialog(...args); }
  function openAmibaCardGainDialog(...args) { return callBrowserDomainCommand("alien_species", "openAmibaCardGainDialog", args); }
  function finishAmibaCardGain(...args) { return callBrowserDomainCommand("alien_species", "finishAmibaCardGain", args); }
  function handleAmibaCardGainChoice(...args) { return callBrowserDomainCommand("alien_species", "handleAmibaCardGainChoice", args); }
  function closeAomomoCardGainDialog(...args) { return alienSpeciesRuntime.closeAomomoCardGainDialog(...args); }
  function openAomomoCardGainDialog(...args) { return callBrowserDomainCommand("alien_species", "openAomomoCardGainDialog", args); }
  function finishAomomoCardGain(...args) { return callBrowserDomainCommand("alien_species", "finishAomomoCardGain", args); }
  function handleAomomoCardGainChoice(...args) { return callBrowserDomainCommand("alien_species", "handleAomomoCardGainChoice", args); }
  function closeAmibaSymbolChoiceDialog(...args) { return alienSpeciesRuntime.closeAmibaSymbolChoiceDialog(...args); }
  function openAmibaSymbolChoiceDialog(...args) { return callBrowserDomainCommand("alien_species", "openAmibaSymbolChoiceDialog", args); }
  function finishAmibaSymbolChoice(...args) { return callBrowserDomainCommand("alien_species", "finishAmibaSymbolChoice", args); }
  function handleAmibaSymbolChoice(...args) { return callBrowserDomainCommand("alien_species", "handleAmibaSymbolChoice", args); }
  function closeAmibaTraceRemovalDialog(...args) { return alienSpeciesRuntime.closeAmibaTraceRemovalDialog(...args); }
  function openAmibaTraceRemovalDialog(...args) { return callBrowserDomainCommand("alien_species", "openAmibaTraceRemovalDialog", args); }
  function handleAmibaTraceRemovalChoice(...args) { return callBrowserDomainCommand("alien_species", "handleAmibaTraceRemovalChoice", args); }
  function applyChongFossilRewardToPlayer(...args) { return alienSpeciesRuntime.applyChongFossilRewardToPlayer(...args); }
  function closeYichangdianCardGainDialog(...args) { return alienSpeciesRuntime.closeYichangdianCardGainDialog(...args); }
  function openYichangdianCardGainDialog(...args) { return callBrowserDomainCommand("alien_species", "openYichangdianCardGainDialog", args); }
  function finishYichangdianCardGain(...args) { return callBrowserDomainCommand("alien_species", "finishYichangdianCardGain", args); }
  function handleYichangdianCardGainChoice(...args) { return callBrowserDomainCommand("alien_species", "handleYichangdianCardGainChoice", args); }
  function closeBanrenmaCardGainDialog(...args) { return alienSpeciesRuntime.closeBanrenmaCardGainDialog(...args); }
  function openBanrenmaCardGainDialog(...args) { return callBrowserDomainCommand("alien_species", "openBanrenmaCardGainDialog", args); }
  function finishBanrenmaCardGain(...args) { return callBrowserDomainCommand("alien_species", "finishBanrenmaCardGain", args); }
  function handleBanrenmaCardGainChoice(...args) { return callBrowserDomainCommand("alien_species", "handleBanrenmaCardGainChoice", args); }
  function closeChongCardGainDialog(...args) { return alienSpeciesRuntime.closeChongCardGainDialog(...args); }
  function openChongCardGainDialog(...args) { return callBrowserDomainCommand("alien_species", "openChongCardGainDialog", args); }
  function finishChongCardGain(...args) { return callBrowserDomainCommand("alien_species", "finishChongCardGain", args); }
  function handleChongCardGainChoice(...args) { return callBrowserDomainCommand("alien_species", "handleChongCardGainChoice", args); }
  function getChongPlanetLabel(...args) { return alienSpeciesRuntime.getChongPlanetLabel(...args); }
  function formatChongGain(...args) { return alienSpeciesRuntime.formatChongGain(...args); }
  function formatChongFossilRewardSummary(...args) { return alienSpeciesRuntime.formatChongFossilRewardSummary(...args); }
  function restoreMutableObject(...args) { return alienSpeciesRuntime.restoreMutableObject(...args); }
  function closeChongFossilChoiceDialog(...args) { return alienSpeciesRuntime.closeChongFossilChoiceDialog(...args); }
  function openChongFossilChoiceDialog(...args) { return callBrowserDomainCommand("alien_species", "openChongFossilChoiceDialog", args); }
  function createChongTransportTokenForFossil(...args) { return callBrowserDomainCommand("alien_species", "createChongTransportTokenForFossil", args); }
  function openChongPickCardFollowUp(...args) { return callBrowserDomainCommand("alien_species", "openChongPickCardFollowUp", args); }
  function keepExistingMainActionPendingAfterChongTask(...args) { return alienSpeciesRuntime.keepExistingMainActionPendingAfterChongTask(...args); }
  function failChongTaskCompletion(...args) { return callBrowserDomainCommand("alien_species", "failChongTaskCompletion", args); }
  function finishChongFossilEffect(...args) { return callBrowserDomainCommand("alien_species", "finishChongFossilEffect", args); }
  function completeChongTraceTaskWithFossil(...args) { return callBrowserDomainCommand("alien_species", "completeChongTraceTaskWithFossil", args); }
  function handleChongFossilChoice(...args) { return callBrowserDomainCommand("alien_species", "handleChongFossilChoice", args); }
  function openChongTraceTaskCompletionPicker(...args) { return alienSpeciesRuntime.openChongTraceTaskCompletionPicker(...args); }
  function enqueueJiuzheOpportunity(...args) { return alienSpeciesRuntime.enqueueJiuzheOpportunity(...args); }
  function isJiuzheThresholdOpportunity(...args) { return alienSpeciesRuntime.isJiuzheThresholdOpportunity(...args); }
  function createJiuzheThresholdCardEffect(...args) { return alienSpeciesRuntime.createJiuzheThresholdCardEffect(...args); }
  function hasJiuzheThresholdEffectQueued(...args) { return alienSpeciesRuntime.hasJiuzheThresholdEffectQueued(...args); }
  function queueJiuzheThresholdEffectForPlayer(...args) { return alienSpeciesRuntime.queueJiuzheThresholdEffectForPlayer(...args); }
  function queueJiuzheOpportunitiesForPlayer(...args) { return callBrowserDomainCommand("alien_species", "queueJiuzheOpportunitiesForPlayer", args); }
  function buildJiuzheCardConditionContext(...args) { return callBrowserDomainCommand("alien_species", "buildJiuzheCardConditionContext", args); }
  function getJiuzheCardConditionLabel(...args) { return callBrowserDomainCommand("alien_species", "getJiuzheCardConditionLabel", args); }
  function closeJiuzheCardDialog(...args) { return alienSpeciesRuntime.closeJiuzheCardDialog(...args); }
  function buildJiuzheOpportunitySubtitle(...args) { return alienSpeciesRuntime.buildJiuzheOpportunitySubtitle(...args); }
  function openJiuzheCardDialog(...args) { return callBrowserDomainCommand("alien_species", "openJiuzheCardDialog", args); }
  function handleJiuzheCardChoice(...args) { return callBrowserDomainCommand("alien_species", "handleJiuzheCardChoice", args); }
  function handleJiuzheOpportunitySkip(...args) { return callBrowserDomainCommand("alien_species", "handleJiuzheOpportunitySkip", args); }
  function maybeOpenQueuedJiuzheOpportunity(...args) { return callBrowserDomainCommand("alien_species", "maybeOpenQueuedJiuzheOpportunity", args); }
  function getActiveAlienSharedOverlayPendingForManualGuard(...args) { return alienSpeciesRuntime.getActiveAlienSharedOverlayPendingForManualGuard(...args); }
  function blockManualAiSharedOverlayInputIfNeeded(...args) { return alienSpeciesRuntime.blockManualAiSharedOverlayInputIfNeeded(...args); }
  function getReadyBanrenmaCards(...args) { return callBrowserDomainCommand("alien_species", "getReadyBanrenmaCards", args); }
  function getReadyBanrenmaCardsForOpportunity(...args) { return callBrowserDomainCommand("alien_species", "getReadyBanrenmaCardsForOpportunity", args); }
  function getReadyBanrenmaCardForOpportunity(...args) { return callBrowserDomainCommand("alien_species", "getReadyBanrenmaCardForOpportunity", args); }
  function createBanrenmaPanelBonusEffect(...args) { return alienSpeciesRuntime.createBanrenmaPanelBonusEffect(...args); }
  function hasBanrenmaPanelBonusEffectQueued(...args) { return alienSpeciesRuntime.hasBanrenmaPanelBonusEffectQueued(...args); }
  function queueBanrenmaPanelBonusEffectForPlayer(...args) { return callBrowserDomainCommand("alien_species", "queueBanrenmaPanelBonusEffectForPlayer", args); }
  function enqueueBanrenmaOpportunity(...args) { return alienSpeciesRuntime.enqueueBanrenmaOpportunity(...args); }
  function queueBanrenmaOpportunitiesForPlayer(...args) { return callBrowserDomainCommand("alien_species", "queueBanrenmaOpportunitiesForPlayer", args); }
  function closeBanrenmaOpportunityDialog(...args) { return alienSpeciesRuntime.closeBanrenmaOpportunityDialog(...args); }
  function getBanrenmaCardConditionLabel(...args) { return alienSpeciesRuntime.getBanrenmaCardConditionLabel(...args); }
  function openBanrenmaCardConditionCompletionPicker(...args) { return callBrowserDomainCommand("alien_species", "openBanrenmaCardConditionCompletionPicker", args); }
  function openBanrenmaOpportunityDialog(...args) { return callBrowserDomainCommand("alien_species", "openBanrenmaOpportunityDialog", args); }
  function maybeOpenQueuedBanrenmaOpportunity(...args) { return callBrowserDomainCommand("alien_species", "maybeOpenQueuedBanrenmaOpportunity", args); }
  function openBanrenmaReadyOpportunityForPlayer(...args) { return callBrowserDomainCommand("alien_species", "openBanrenmaReadyOpportunityForPlayer", args); }
  function executeJiuzheThresholdCardEffect(...args) { return callBrowserDomainCommand("alien_species", "executeJiuzheThresholdCardEffect", args); }
  function executeBanrenmaPanelBonusEffect(...args) { return callBrowserDomainCommand("alien_species", "executeBanrenmaPanelBonusEffect", args); }
  function completeBanrenmaOpportunityStep(...args) { return callBrowserDomainCommand("alien_species", "completeBanrenmaOpportunityStep", args); }
  function handleBanrenmaBonusChoice(...args) { return callBrowserDomainCommand("alien_species", "handleBanrenmaBonusChoice", args); }
  function handleBanrenmaCardConditionChoice(...args) { return callBrowserDomainCommand("alien_species", "handleBanrenmaCardConditionChoice", args); }
  function appendRevealCardGrantMessage(...args) { return alienSpeciesRuntime.appendRevealCardGrantMessage(...args); }
  function getRevealIrreversible(...args) { return alienSpeciesRuntime.getRevealIrreversible(...args); }
  function openChongRewardFollowUps(...args) { return callBrowserDomainCommand("alien_species", "openChongRewardFollowUps", args); }
  function openAmibaRewardFollowUps(...args) { return callBrowserDomainCommand("alien_species", "openAmibaRewardFollowUps", args); }
  function openRunezuRewardFollowUps(...args) { return callBrowserDomainCommand("alien_species", "openRunezuRewardFollowUps", args); }
  function closeRunezuFaceSymbolPlacement(...args) { return alienSpeciesRuntime.closeRunezuFaceSymbolPlacement(...args); }
  function executeStandardRunezuFaceSymbol(...args) { return callBrowserDomainCommand("alien_species", "executeStandardRunezuFaceSymbol", args); }
  function openRunezuFaceSymbolPlacement(...args) { return callBrowserDomainCommand("alien_species", "openRunezuFaceSymbolPlacement", args); }
  function handleRunezuFaceSymbolChoice(...args) { return callBrowserDomainCommand("alien_species", "handleRunezuFaceSymbolChoice", args); }
  function executeRunezuSymbolRewardEffect(...args) { return callBrowserDomainCommand("alien_species", "executeRunezuSymbolRewardEffect", args); }
  function closeRunezuSymbolBranchDialog(...args) { return alienSpeciesRuntime.closeRunezuSymbolBranchDialog(...args); }
  function openRunezuSymbolBranchDialog(...args) { return callBrowserDomainCommand("alien_species", "openRunezuSymbolBranchDialog", args); }
  function handleRunezuSymbolBranchChoice(...args) { return callBrowserDomainCommand("alien_species", "handleRunezuSymbolBranchChoice", args); }
  function alignAlienPanelsToPlanets(...args) { return alienSpeciesRuntime.alignAlienPanelsToPlanets(...args); }
  function triggerYichangdianAnomalyForEarthX(workingRoot, earthX) {
    const alienState = workingRoot.alienGameState;
    const anomaly = yichangdian?.getAnomalyBySectorX?.(alienState, earthX);
    const alienSlotId = alienState.yichangdian?.revealedSlotId;
    if (!anomaly || !alienSlotId) {
      yichangdian?.updateNextAnomaly?.(alienState, earthX);
      return null;
    }
    const traceEntry = yichangdian.getTopTraceEntry(alienState, alienSlotId, anomaly.traceType);
    const player = findPlayerForYichangdianEntry(traceEntry);
    const reward = yichangdian.getAnomalyReward(anomaly.markerId);
    if (!player || !reward) return null;

    anomaly.triggeredCount = Math.max(0, Math.round(Number(anomaly.triggeredCount) || 0)) + 1;
    const rewardResult = applyYichangdianRewardToPlayer(
      player,
      reward,
      `异常点 ${anomaly.markerId}`,
    );
    if (reward.pickCard) {
      beginCardSelection({
        type: "yichangdian_anomaly_pick",
        player,
        allowBlindDraw: true,
        effectLabel: `异常点 ${anomaly.markerId}`,
      });
    }
    yichangdian.updateNextAnomaly(alienState, earthX);
    return {
      ok: rewardResult.ok,
      anomaly,
      playerId: player.id,
      reward,
      events: [{
        type: "yichangdianAnomaly",
        playerId: player.id,
        markerId: anomaly.markerId,
      }],
      message: rewardResult.message,
    };
  }

  function setLogOpen(open) {
    if (open && !isStateLogEnabled()) {
      setReportTab("action");
    }
    els.appWrap.classList.toggle("log-collapsed", !open);
    els.logToggle?.setAttribute("aria-expanded", String(open));
    resize();
  }

  function setDebugOpen(open) {
    return callDebugCommand("setDebugOpen", [open]);
  }

  function focusJiuzheDebugCalibration(alienSlotId = 1) {
    return focusDebugCalibration(alienSlotId);
  }

  function getCurrentPlayer(workingRoot = null) {
    if (uiRuntimeState.effectExecutionPlayerId) {
      const effectPlayer = isBrowserWorkingRoot(workingRoot)
        ? getPlayerById(workingRoot, uiRuntimeState.effectExecutionPlayerId)
        : getPlayerById(uiRuntimeState.effectExecutionPlayerId);
      if (effectPlayer) return effectPlayer;
    }
    const source = isBrowserWorkingRoot(workingRoot)
      ? workingRoot.playerState
      : createStateSourceReadoutRoot().playerState;
    return players.getCurrentPlayer(source);
  }

  function getPlayerByColor(workingRootOrColor, explicitColor = null) {
    const workingRoot = isBrowserWorkingRoot(workingRootOrColor) ? workingRootOrColor : null;
    const color = workingRoot ? explicitColor : workingRootOrColor;
    const normalizedColor = players.normalizePlayerColor(color);
    const source = workingRoot ? workingRoot.playerState : createStateSourceReadoutRoot().playerState;
    return source.players.find((player) => player.color === normalizedColor) || null;
  }

  function setDebugPlayerMenuOpen(open) {
    return callDebugCommand("setDebugPlayerMenuOpen", [open]);
  }

  function renderDebugPlayerSwitch() {
    return callDebugCommand("renderDebugPlayerSwitch");
  }

  function selectDefaultRocketForCurrentPlayer() {
    return callDebugCommand("selectDefaultRocketForCurrentPlayer");
  }

  function switchCurrentPlayerColor(color) {
    return callDebugCommand("switchCurrentPlayerColor", [color]);
  }

  function getFailsafePendingOwnerPlayer() {
    return callDebugCommand("getFailsafePendingOwnerPlayer");
  }

  function handleAiTakeoverFailsafe() {
    return callDebugCommand("handleAiTakeoverFailsafe");
  }

  function handleForceSkipTurnFailsafe() {
    return callDebugCommand("handleForceSkipTurnFailsafe");
  }

  function createStatText(label, value) {
    const item = document.createElement("span");
    item.className = "player-stat";

    const labelEl = document.createElement("span");
    labelEl.className = "player-stat-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "player-stat-value";
    valueEl.textContent = value;

    item.append(labelEl, valueEl);
    return item;
  }

  function createStatIcon(label, value, iconSrc) {
    const item = document.createElement("span");
    const icon = document.createElement("img");
    const valueEl = document.createElement("span");

    item.className = "player-stat player-stat-with-icon";
    item.setAttribute("aria-label", `${label} ${value}`);
    icon.className = "player-stat-icon";
    icon.src = iconSrc;
    icon.alt = "";
    icon.width = 296;
    icon.height = 296;
    icon.decoding = "async";
    icon.setAttribute("aria-hidden", "true");
    valueEl.className = "player-stat-value";
    valueEl.textContent = value;

    item.append(icon, valueEl);
    return item;
  }

  function createStatIconMarker(label, iconSrc) {
    const item = document.createElement("span");
    const icon = document.createElement("img");

    item.className = "player-stat player-stat-icon-marker";
    item.setAttribute("aria-label", label);
    icon.className = "player-stat-icon player-stat-marker-icon";
    icon.src = iconSrc;
    icon.alt = "";
    icon.width = 296;
    icon.height = 296;
    icon.decoding = "async";
    icon.setAttribute("aria-hidden", "true");

    item.append(icon);
    return item;
  }

  function createInlineIconValue(label, value, iconSrc, className) {
    const item = document.createElement("span");
    const icon = document.createElement("img");
    const valueEl = document.createElement("span");

    item.className = className;
    item.setAttribute("aria-label", `${label} ${value}`);
    icon.className = "player-stat-icon";
    icon.src = iconSrc;
    icon.alt = "";
    icon.width = 296;
    icon.height = 296;
    icon.decoding = "async";
    icon.setAttribute("aria-hidden", "true");
    valueEl.className = "player-stat-value";
    valueEl.textContent = value;

    item.append(icon, valueEl);
    return item;
  }

  function getCurrentPlayerStatLabel(player) {
    const name = String(player?.name || "").trim();
    const colorLabel = String(player?.colorLabel || "").trim();
    const colorDefaultName = colorLabel ? `${colorLabel}玩家` : "";
    const strippedName = colorLabel && name.startsWith(colorLabel)
      ? name.slice(colorLabel.length).trim()
      : name;
    const base = name && name !== colorDefaultName
      ? strippedName || name
      : "玩家";
    return `${base}${isAiAutoBattlePlayer(player?.id) ? "(电脑)" : ""}`;
  }

  function createPlayerNameStat(player, score, finalTotalScore) {
    const color = players.getPlayerColorDefinition(player.color);
    const item = document.createElement("span");
    const marker = document.createElement("span");
    const name = document.createElement("span");
    const scoreEl = createInlineIconValue("分数", score, RESOURCE_ICON_SRC.score, "player-stat-score");
    const finalScoreEl = createInlineIconValue(
      "终局总分",
      finalTotalScore,
      RESOURCE_ICON_SRC.finalScore,
      "player-stat-final-score",
    );

    item.className = "player-stat player-stat-current";
    item.style.setProperty("--player-color", color.uiColor);
    marker.className = "player-color-marker";
    marker.setAttribute("aria-hidden", "true");
    name.className = "player-stat-value";
    name.classList.toggle("is-player-passed", isPlayerPassedThisRound(player?.id));
    name.textContent = getCurrentPlayerStatLabel(player);
    item.title = name.textContent;

    item.append(marker, name, scoreEl, finalScoreEl);
    return item;
  }

  function createStatSeparator() {
    const item = document.createElement("span");
    item.className = "player-stat-separator";
    item.setAttribute("aria-hidden", "true");
    item.textContent = "|";
    return item;
  }

  function createPlayerStatsRow(className, nodes) {
    const row = document.createElement("div");
    row.className = `player-stats-row ${className || ""}`.trim();
    row.append(...nodes);
    return row;
  }

  function shouldShowAomomoFossils(player) {
    const readoutRoot = createStateSourceReadoutRoot();
    return Boolean(
      aomomo
      && (readoutRoot.solarState.aomomoActive
        || readoutRoot.alienGameState.aomomo?.revealInitialized
        || Number(player?.resources?.aomomoFossils) > 0),
    );
  }

  function shouldShowFangzhouUnlockStats() {
    return Boolean(fangzhou && createStateSourceReadoutRoot().alienGameState.fangzhou?.revealInitialized);
  }

  function getPlayerFangzhouUnlockCount(player) {
    const count = Number(fangzhou?.getUnlockCount?.(
      createStateSourceReadoutRoot().alienGameState,
      player,
    )) || 0;
    return Math.min(3, Math.max(0, Math.round(count)));
  }

  function buildPlayerFangzhouStatNodes(player) {
    if (!shouldShowFangzhouUnlockStats()) return [];
    const label = document.createElement("span");
    label.className = "player-stat player-stat-fangzhou-label";
    label.textContent = "方舟";
    return [
      label,
      createStatText("🔒", `${getPlayerFangzhouUnlockCount(player)}/3`),
    ];
  }

  function buildPlayerResourceStatNodes(player, options = {}) {
    const resources = player.resources || players.DEFAULT_RESOURCES;
    const limits = players.RESOURCE_LIMITS;
    const dataPlacementProgress = getPlayerDataPlacementProgress(player);
    const nodes = [
      createStatIcon("信用点", resources.credits, RESOURCE_ICON_SRC.credits),
      createStatIcon("能量", resources.energy, RESOURCE_ICON_SRC.energy),
      createStatIcon("宣传", `${resources.publicity}/${limits.publicity}`, RESOURCE_ICON_SRC.publicity),
      createStatIcon("可用数据", resources.availableData, RESOURCE_ICON_SRC.data),
      createStatIcon("额外公共扫描", resources.additionalPublicScan || 0, RESOURCE_ICON_SRC.additionalPublicScan),
    ];
    if (shouldShowAomomoFossils(player)) {
      nodes.push(createStatIcon("奥陌陌化石", resources.aomomoFossils || 0, RESOURCE_ICON_SRC.aomomoFossil));
    }
    nodes.push(createStatIcon(
      "当前数据放置进展",
      `${dataPlacementProgress.placed}/${dataPlacementProgress.total}`,
      RESOURCE_ICON_SRC.analyzeData,
    ));

    if (options.includeHandSize) {
      const handCount = Array.isArray(player.hand) ? player.hand.length : (resources.handSize || 0);
      nodes.push(createStatIcon("手牌", handCount, RESOURCE_ICON_SRC.card));
    }

    return nodes;
  }

  function normalizeIncomeDisplayValue(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Number.isInteger(number) ? number : Math.round(number * 100) / 100);
  }

  function getPlayerDataPlacementProgress(player) {
    const placedCount = typeof data.listComputerPlacedTokens === "function"
      ? data.listComputerPlacedTokens(player).length
      : 0;
    const total = Object.keys(data.COMPUTER_DATA_SLOTS || {}).length || 6;
    return {
      placed: Math.min(total, Math.max(0, Math.round(Number(placedCount) || 0))),
      total,
    };
  }

  function getPlayerIncomeBreakdown(player, incomeKey, normalizedIncome, normalizedCompanyBaseIncome) {
    const income = normalizedIncome || players.normalizeIncome(player?.income || null);
    const companyBaseIncome = normalizedCompanyBaseIncome || getPlayerCompanyBaseIncome(player);
    const total = normalizeIncomeDisplayValue(income?.[incomeKey]);
    const configuredBase = normalizeIncomeDisplayValue(companyBaseIncome?.[incomeKey]);
    const base = Math.min(total, configuredBase);
    const increase = Math.max(0, normalizeIncomeDisplayValue(total - base));
    return { total, base, increase };
  }

  function formatPlayerIncomeBreakdown(player, incomeKey, normalizedIncome, normalizedCompanyBaseIncome) {
    const breakdown = getPlayerIncomeBreakdown(player, incomeKey, normalizedIncome, normalizedCompanyBaseIncome);
    return `${breakdown.total}(${breakdown.base}+${breakdown.increase})`;
  }

  function formatPlayerIncomeStatValue(breakdown, options = {}) {
    return options.showBasePlusIncrease
      ? `${breakdown.base}+${breakdown.increase}`
      : breakdown.total;
  }

  function createIncomeStatIcon(
    label,
    player,
    incomeKey,
    iconSrc,
    normalizedIncome,
    normalizedCompanyBaseIncome,
    options = {},
  ) {
    const breakdown = getPlayerIncomeBreakdown(player, incomeKey, normalizedIncome, normalizedCompanyBaseIncome);
    const value = formatPlayerIncomeStatValue(breakdown, options);
    const item = createStatIcon(label, value, iconSrc);
    const detail = options.showBasePlusIncrease
      ? `${label} ${breakdown.base}+${breakdown.increase}（总计 ${breakdown.total}）`
      : `${label} ${breakdown.total}`;
    item.setAttribute("aria-label", detail);
    item.title = detail;
    return item;
  }

  function buildPlayerIncomeStatNodes(player, options = {}) {
    const income = players.normalizeIncome(player?.income || null);
    const companyBaseIncome = getPlayerCompanyBaseIncome(player);
    return [
      createStatIconMarker("收入", RESOURCE_ICON_SRC.income),
      createIncomeStatIcon("收入信用点", player, "credits", RESOURCE_ICON_SRC.credits, income, companyBaseIncome, options),
      createIncomeStatIcon("收入能量", player, "energy", RESOURCE_ICON_SRC.energy, income, companyBaseIncome, options),
      createIncomeStatIcon("收入手牌", player, "handSize", RESOURCE_ICON_SRC.incomeCard, income, companyBaseIncome, options),
      createStatIcon("收入宣传", income.publicity || 0, RESOURCE_ICON_SRC.publicity),
      createStatIcon("收入数据", income.availableData || 0, RESOURCE_ICON_SRC.data),
      createStatIcon("收入额外公共扫描", income.additionalPublicScan || 0, RESOURCE_ICON_SRC.additionalPublicScan),
    ];
  }

  function buildPlayerRunezuStatNodes(player) {
    if (!runezu || !createStateSourceReadoutRoot().alienGameState.runezu?.revealInitialized) return [];
    const counts = runezu.getPlayerSymbolCounts(player);
    const nodes = [];
    for (const symbolId of runezu.SYMBOL_IDS || []) {
      const count = counts[symbolId] || 0;
      if (count <= 0) continue;
      nodes.push(createStatIcon(runezu.formatSymbolLabel(symbolId), count, runezu.getSymbolSrc(symbolId)));
    }
    return nodes;
  }

  const SCORE_SOURCE_KEY_SET = new Set(Object.values(SCORE_SOURCE_KEYS));
  const FINAL_RESULT_PLAYER_COLOR_ORDER = Object.freeze(["white", "brown", "blue", "green"]);

  function normalizeScoreSourceAmount(value) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? number : Math.round(number * 100) / 100;
  }

  function ensurePlayerScoreSources(player) {
    if (!player) return {};
    if (!player.scoreSources || typeof player.scoreSources !== "object") {
      player.scoreSources = {};
    }
    return player.scoreSources;
  }

  function addPlayerScoreSource(player, key, amount) {
    const value = normalizeScoreSourceAmount(amount);
    if (!player || !SCORE_SOURCE_KEY_SET.has(key) || value === 0) return 0;
    const sources = ensurePlayerScoreSources(player);
    sources[key] = normalizeScoreSourceAmount((Number(sources[key]) || 0) + value);
    return value;
  }

  function addScoreSourceFromGain(player, key, gain) {
    return addPlayerScoreSource(player, key, gain?.score || 0);
  }

  function getScoreAwardedFromScanResult(result) {
    return normalizeScoreSourceAmount(
      result?.scoreAwarded
        ?? result?.replaced?.scoreAwarded
        ?? result?.payload?.replaced?.scoreAwarded
        ?? 0,
    );
  }

  function createRestoreScoreSourcesCommand(player, beforeSources, label) {
    const snapshot = structuredClone(beforeSources || {});
    return {
      label: label || "分数来源账本",
      describe: label || "恢复分数来源账本",
      undo() {
        if (!player) return;
        player.scoreSources = structuredClone(snapshot);
      },
    };
  }

  function recordScoreSourceHistoryCommand(player, beforeSources, label, history = actionHistory) {
    const command = createRestoreScoreSourcesCommand(player, beforeSources, label);
    if (history === quickActionHistory) {
      recordQuickHistoryCommand(command);
    } else {
      recordHistoryCommand(command);
    }
  }

  function recordScanScoreSource(player, result, history = null) {
    const amount = getScoreAwardedFromScanResult(result);
    if (!amount) return 0;
    const beforeSources = structuredClone(player?.scoreSources || {});
    const added = addPlayerScoreSource(player, SCORE_SOURCE_KEYS.SCAN, amount);
    if (added && history) {
      recordScoreSourceHistoryCommand(player, beforeSources, "恢复扫描分数来源", history);
    }
    return added;
  }

  function getScanScorePlayer(workingRoot, result) {
    const event = (result?.events || []).find((item) => item?.type === "signalMarked" && (item.playerId || item.playerColor));
    const playerId = result?.playerId || event?.playerId || null;
    const playerColor = result?.playerColor || event?.playerColor || null;
    return (workingRoot.playerState.players || []).find((player) => (
      (playerId && player.id === playerId) || (playerColor && player.color === playerColor)
    )) || players.getCurrentPlayer(workingRoot.playerState);
  }

  function recordScanScoreSourcesFromAbilityResult(workingRoot, result, history = actionHistory) {
    const scanResults = [
      result,
      result?.payload?.industryLaunchScan,
    ].filter(Boolean);
    for (const scanResult of scanResults) {
      if (!getScoreAwardedFromScanResult(scanResult)) continue;
      recordScanScoreSource(getScanScorePlayer(workingRoot, scanResult), scanResult, history);
    }
  }

  function recordInitialSelectionScoreSources(result) {
    for (const entry of result?.results || []) {
      const player = getPlayerById(entry?.playerId) || getPlayerByColor(entry?.playerColor);
      if (!player) continue;
      for (const item of entry?.results || []) {
        if (item?.type === "resources") {
          addScoreSourceFromGain(player, SCORE_SOURCE_KEYS.INITIAL, item.gain);
        } else if (item?.type === "alienTraceReward") {
          recordAlienTraceScore(player, item.trace?.traceType, item.gain);
        } else if (item?.type === "scan") {
          recordScanScoreSource(player, item);
        }
      }
    }
  }

  function recordTechBonusScore(player, result) {
    if (!result?.ok) return 0;
    const rewards = result.rewards || result.payload?.rewards || {};
    const bonusScore = Number(rewards.bonus?.score) || 0;
    const firstTakeScore = Number(rewards.firstTakeScore) || 0;
    return addPlayerScoreSource(player, SCORE_SOURCE_KEYS.TECH_BONUS, bonusScore + firstTakeScore);
  }

  function getAlienTraceScoreSourceKey(traceType) {
    switch (traceType) {
      case "pink":
        return SCORE_SOURCE_KEYS.ALIEN_TRACE_PINK;
      case "yellow":
        return SCORE_SOURCE_KEYS.ALIEN_TRACE_YELLOW;
      case "blue":
        return SCORE_SOURCE_KEYS.ALIEN_TRACE_BLUE;
      default:
        return null;
    }
  }

  function recordAlienTraceScore(player, traceType, gain) {
    const key = getAlienTraceScoreSourceKey(traceType);
    return key ? addScoreSourceFromGain(player, key, gain) : 0;
  }

  function getScoreSourceKeyForGainEffect(effect) {
    const explicit = effect?.options?.scoreSourceKey;
    if (SCORE_SOURCE_KEY_SET.has(explicit)) return explicit;
    const actionType = decisionState.actionEffectFlow?.actionType;
    switch (actionType) {
      case "orbit":
        return SCORE_SOURCE_KEYS.ORBIT;
      case "land":
        return SCORE_SOURCE_KEYS.LAND;
      case "cardTask":
      case "cardTrigger":
        return SCORE_SOURCE_KEYS.TASK_CARD;
      case "playCard":
        return isAlienFamilyCard(decisionState.actionEffectFlow?.card)
          ? SCORE_SOURCE_KEYS.ALIEN_EFFECT
          : SCORE_SOURCE_KEYS.CARD_EFFECT;
      case "banrenmaCondition":
      case "fangzhouBasic":
      case "fangzhouAdvanced":
        return SCORE_SOURCE_KEYS.ALIEN_EFFECT;
      default:
        if (String(actionType || "").startsWith("industry")) {
          return SCORE_SOURCE_KEYS.INDUSTRY_EFFECT;
        }
        return null;
    }
  }

  function recordScoreSourceForGainEffect(player, effect, gain) {
    const key = getScoreSourceKeyForGainEffect(effect);
    return key ? addScoreSourceFromGain(player, key, gain) : 0;
  }

  function attachScoreSourceToEffects(effects, scoreSourceKey) {
    if (!SCORE_SOURCE_KEY_SET.has(scoreSourceKey)) return effects || [];
    return (effects || []).map((effect) => ({
      ...effect,
      options: {
        ...(effect.options || {}),
        scoreSourceKey: effect.options?.scoreSourceKey || scoreSourceKey,
      },
    }));
  }

  function getPlayerScoreSource(player, key) {
    return normalizeScoreSourceAmount(player?.scoreSources?.[key] || 0);
  }

  function computePlayerFinalScoreBreakdown(player, workingRoot) {
    if (!workingRoot) throw new TypeError("终局计分 readout 需要显式只读 root");
    const probeLocationData = buildProbeLocationIndexForRoot(workingRoot);
    return endGameScoring?.computePlayerFinalScore
      ? endGameScoring.computePlayerFinalScore({
        currentPlayer: player,
        finalScoringState: workingRoot.finalScoringState,
        playerState: workingRoot.playerState,
        nebulaDataState: workingRoot.nebulaDataState,
        alienGameState: workingRoot.alienGameState,
        planetStatsState: workingRoot.planetStatsState,
        ...(actionInteractionRuntime?.buildPlutoMarkerContext(workingRoot) || { plutoMarkers: [] }),
        probeLocations: probeLocationData.index,
        probeLocationDetails: probeLocationData.details,
        cardEffects,
        getCardTypeCode,
        getPlayerCompanyBaseIncome,
      })
      : { totalScore: player.resources?.score || 0 };
  }

  function layoutCardFan(fan, cardCount) {
    if (!fan) return;

    const cardHeight = getPublicCardHeight() || 166;
    const cardWidth = cardHeight * (747 / 1040);
    const fanPadding = 14;
    const minStackStep = Math.round(cardWidth * 0.26);
    const count = Number.isInteger(cardCount)
      ? cardCount
      : fan.querySelectorAll(".player-hand-card-button, .player-hand-card").length;

    fan.style.setProperty("--card-height", `${cardHeight}px`);
    fan.style.setProperty("--card-width", `${cardWidth}px`);
    fan.style.minHeight = `${cardHeight + fanPadding}px`;
    fan.classList.toggle("is-spread", count > 1);

    if (!count) {
      fan.style.setProperty("--card-step", `${cardWidth}px`);
      return;
    }

    const padding = 24;
    const available = Math.max(0, fan.clientWidth - padding);
    const spreadStep = count > 1
      ? (available - cardWidth) / (count - 1)
      : cardWidth;
    const step = count > 1
      ? Math.max(minStackStep, spreadStep)
      : cardWidth;

    fan.style.setProperty("--card-step", `${step}px`);
  }

  function layoutPlayerHandFan(cardCount) {
    layoutCardFan(els.playerHandFan, cardCount);
  }

  function layoutReservedCardRows() {
    if (!els.reservedCardFan) return;
    els.reservedCardFan.querySelectorAll(".reserved-card-row").forEach((row) => {
      layoutCardFan(row);
    });
  }

  function createReservedCardRow(rowType, label) {
    const row = document.createElement("div");
    row.className = `reserved-card-row reserved-card-row-${rowType}`;
    row.dataset.reservedRow = rowType;
    row.setAttribute("aria-label", label);
    return row;
  }

  function createJiuzheReservedButton(player) {
    const readoutAlienState = createStateSourceReadoutRoot().alienGameState;
    const cardsForPlayer = jiuzhe?.getPlayerJiuzheCards?.(readoutAlienState, player) || [];
    if (!cardsForPlayer.length) return null;
    const playedCount = jiuzhe.countPlayedCards(readoutAlienState, player);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reserved-card-button reserved-card-button-jiuzhe";
    button.dataset.jiuzheCards = "true";
    button.dataset.playerId = player?.id || "";
    button.dataset.playerColor = player?.color || "";
    button.style.setProperty("--card-index", "1");
    button.title = "查看九折牌";

    const image = document.createElement("img");
    image.className = "player-hand-card reserved-card";
    image.src = jiuzhe.CARD_BACK_SRC;
    image.alt = "九折牌";
    image.width = 747;
    image.height = 1040;
    image.decoding = "async";
    image.setAttribute("aria-hidden", "true");
    button.append(image);

    const badge = document.createElement("span");
    badge.className = "reserved-card-trigger-badge";
    badge.textContent = String(playedCount);
    button.append(badge);
    return button;
  }

  function createBanrenmaReservedButton(card, originalIndex, rowIndex) {
    const currentPlayer = getCurrentPlayer();
    const mark = banrenma?.getPlayerScoreMarks?.(
      createStateSourceReadoutRoot().alienGameState,
      currentPlayer,
    )
      ?.find((item) => item.id === card.banrenmaScoreMarkId || item.cardInstanceId === card.id);
    const threshold = mark?.threshold ?? card.banrenmaThreshold ?? "-";
    const ready = Number(currentPlayer?.resources?.score || 0) >= Number(threshold);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reserved-card-button reserved-card-button-banrenma";
    button.dataset.banrenmaReservedIndex = String(originalIndex);
    button.disabled = !ready;
    button.style.setProperty("--card-index", String(rowIndex + 1));
    button.classList.toggle("is-banrenma-threshold-ready", ready);
    button.title = ready
      ? `半人马条件已达成：${cards.getCardLabel(card)}`
      : `半人马阈值：达到 ${threshold} 分后可结算条件效果`;

    const image = document.createElement("img");
    image.className = "player-hand-card reserved-card";
    image.src = card.src || banrenma?.getCardSrc?.(card.alienCardId) || RESOURCE_ICON_SRC.banrenmaCard;
    image.alt = cards.getCardLabel(card);
    image.width = 747;
    image.height = 1040;
    image.decoding = "async";
    image.setAttribute("aria-hidden", "true");

    const badge = document.createElement("span");
    badge.className = "reserved-card-banrenma-threshold-badge";
    const icon = document.createElement("img");
    icon.className = "reserved-card-banrenma-threshold-icon";
    icon.src = RESOURCE_ICON_SRC.banrenmaToken;
    icon.alt = "";
    icon.decoding = "async";
    icon.setAttribute("aria-hidden", "true");
    const value = document.createElement("span");
    value.textContent = String(threshold);
    badge.append(icon, value);

    button.append(image, badge);
    if (ready) {
      const readyBadge = document.createElement("span");
      readyBadge.className = "reserved-card-task-badge reserved-card-banrenma-ready-badge";
      readyBadge.textContent = "结算条件";
      button.append(readyBadge);
    }
    return button;
  }

  function createReservedCardButton(card, originalIndex, rowIndex, readyByCardId) {
    const ready = readyByCardId instanceof Map
      ? readyByCardId.get(card.id)
      : readyByCardId?.[card.id];
    const taskBlockReason = ready ? getCardTaskCompletionBlockReason() : null;
    const completedTriggerIndexes = cardEffects.getConsumedTriggerIndexes(card);
    const runezuTaskProgressIndexes = getRunezuTaskProgressIndexes(card);
    const completedProgressIndexes = completedTriggerIndexes.length
      ? completedTriggerIndexes
      : runezuTaskProgressIndexes;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reserved-card-button";
    button.dataset.reservedIndex = String(originalIndex);
    button.disabled = !ready || Boolean(taskBlockReason);
    button.style.setProperty("--card-index", String(rowIndex + 1));
    button.classList.toggle("is-task-ready", Boolean(ready));
    button.title = ready ? (taskBlockReason || "任务已满足，点击确认完成") : "";

    const image = document.createElement("img");
    image.className = "player-hand-card reserved-card";
    image.src = card.src || players.CARD_BACK_SRC;
    image.alt = card.cardName || `保留牌 ${originalIndex + 1}`;
    image.width = 747;
    image.height = 1040;
    image.decoding = "async";
    image.setAttribute("aria-hidden", "true");
    button.append(image);
    attachCardHoverPreview(button, image.src, image.alt);

    if (completedProgressIndexes.length) {
      const badge = document.createElement("span");
      badge.className = "reserved-card-trigger-badge";
      badge.textContent = `已完成 ${completedProgressIndexes.join("/")}`;
      button.append(badge);
    }

    if (cardEffects.getCardModel?.(card)?.pluto) {
      const state = getPlutoActionState(card);
      const badge = document.createElement("span");
      badge.className = "reserved-card-trigger-badge reserved-card-pluto-status-badge";
      const orbitLine = document.createElement("span");
      orbitLine.textContent = state.orbitDone ? "已环绕" : "可环绕";
      const landLine = document.createElement("span");
      landLine.textContent = state.landDone ? "已登陆" : "可登陆";
      badge.append(orbitLine, landLine);
      button.append(badge);
    }

    if (ready) {
      const badge = document.createElement("span");
      badge.className = "reserved-card-task-badge";
      badge.textContent = "完成任务";
      button.append(badge);
    }

    return button;
  }

  function applyIndustryStartupPassives(workingRoot) {
    if (!workingRoot?.playerState || !workingRoot?.finalScoringState) {
      throw new TypeError("applyIndustryStartupPassives 缺少 workingRoot");
    }
    for (const player of workingRoot.playerState.players) {
      if (industry?.shouldInitializeStrategyPassiveMarkers?.(player)) {
        industry.initializeStrategyPassiveMarkers(player);
      }
      if (industry?.shouldInitializeHeliosPassiveMarkers?.(player)) {
        industry.initializeHeliosPassiveMarkers(player);
      }
      if (industry?.shouldInitializeAlienLabPanels?.(player)) {
        industry.initializeAlienLabPanels(player);
      }
      if (industry?.shouldInitializeFutureSpan?.(player)) {
        industry.initializeFutureSpanState(player);
      }
      if (!industry?.shouldPlaceMissionStartupFinalMark?.(player)) continue;
      const markResult = finalScoring.placeDirectMarkAtSlot(workingRoot.finalScoringState, "c", player, 3, {
        tokenSrc: getNormalTokenAssetForPlayer(player),
        source: "mission_relay_startup",
      });
      if (!markResult.ok) {
        workingRoot.rocketState.statusNote = markResult.message;
      }
    }
    renderFinalScoreBoard();
  }

  const industryRuntime = industryRuntimeModule.createIndustryRuntime({
      Array: typeof Array === "undefined" ? undefined : Array,
      Boolean: typeof Boolean === "undefined" ? undefined : Boolean,
      HISTORY_SOURCE_MAIN: typeof HISTORY_SOURCE_MAIN === "undefined" ? undefined : HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK: typeof HISTORY_SOURCE_QUICK === "undefined" ? undefined : HISTORY_SOURCE_QUICK,
      INDUSTRY_TURING_BORROW_TECH_TYPES: typeof INDUSTRY_TURING_BORROW_TECH_TYPES === "undefined" ? undefined : INDUSTRY_TURING_BORROW_TECH_TYPES,
      Math: typeof Math === "undefined" ? undefined : Math,
      Number: typeof Number === "undefined" ? undefined : Number,
      Object: typeof Object === "undefined" ? undefined : Object,
      SCORE_SOURCE_KEYS: typeof SCORE_SOURCE_KEYS === "undefined" ? undefined : SCORE_SOURCE_KEYS,
      Set: typeof Set === "undefined" ? undefined : Set,
      String: typeof String === "undefined" ? undefined : String,
      abilities: typeof abilities === "undefined" ? undefined : abilities,
      activateMoveMode: (...args) => activateMoveMode(...args),
      activateNextActionEffect: typeof activateNextActionEffect === "undefined" ? undefined : activateNextActionEffect,
      addScoreSourceFromGain: (...args) => addScoreSourceFromGain(...args),
      appendActionLogStep: (...args) => appendActionLogStep(...args),
      assignEffectFlowOwner: (...args) => assignEffectFlowOwner(...args),
      attachCardHoverPreview: (...args) => attachCardHoverPreview(...args),
      beginCardSelection: typeof beginCardSelection === "undefined" ? undefined : beginCardSelection,
      beginDiscardSelection: typeof beginDiscardSelection === "undefined" ? undefined : beginDiscardSelection,
      beginEffectHistoryStep: typeof beginEffectHistoryStep === "undefined" ? undefined : beginEffectHistoryStep,
      beginQuickActionStep: typeof beginQuickActionStep === "undefined" ? undefined : beginQuickActionStep,
      beginScanAction: (...args) => beginScanAction(...args),
      beginSupplementalMovePayment: typeof beginSupplementalMovePayment === "undefined" ? undefined : beginSupplementalMovePayment,
      buildReadySectorFinishEffects: typeof buildReadySectorFinishEffects === "undefined" ? undefined : buildReadySectorFinishEffects,
      cardEffects: typeof cardEffects === "undefined" ? undefined : cardEffects,
      cards: typeof cards === "undefined" ? undefined : cards,
      canStartMainAction: (...args) => canStartMainAction(...args),
      clearActionEffectFlow: (...args) => clearActionEffectFlow(...args),
      clearHistoryStepOrderForSource: typeof clearHistoryStepOrderForSource === "undefined" ? undefined : clearHistoryStepOrderForSource,
      completeCurrentActionEffect: typeof completeCurrentActionEffect === "undefined" ? undefined : completeCurrentActionEffect,
      completeQuickActionStep: typeof completeQuickActionStep === "undefined" ? undefined : completeQuickActionStep,
      createActionContext: createActionContextForWorkingRoot,
      dispatchStandardIntent: (family, selector = {}, payload = {}) => (
        dispatchBrowserRuleInput({ kind: "standard_intent", family, selector, payload })
      ),
      decisionSessions,
      createCardCornerTriggerEventFields: typeof createCardCornerTriggerEventFields === "undefined" ? undefined : createCardCornerTriggerEventFields,
      createInitialSelectionImage: (...args) => createInitialSelectionImage(...args),
      data: typeof data === "undefined" ? undefined : data,
      deactivateMoveMode: (...args) => deactivateMoveMode(...args),
      document: typeof document === "undefined" ? undefined : document,
      els: typeof els === "undefined" ? undefined : els,
      endEffectHistoryStep: typeof endEffectHistoryStep === "undefined" ? undefined : endEffectHistoryStep,
      finishAutomaticRewardEffect: (...args) => finishAutomaticRewardEffect(...args),
      forgetLastHistoryStep: typeof forgetLastHistoryStep === "undefined" ? undefined : forgetLastHistoryStep,
      formatCardCornerRewardMessage: typeof formatCardCornerRewardMessage === "undefined" ? undefined : formatCardCornerRewardMessage,
      formatPlanetRewardGain: (...args) => formatPlanetRewardGain(...args),
      getAutoDataPlacementCheck: (...args) => getAutoDataPlacementCheck(...args),
      getCurrentActionEffect: typeof getCurrentActionEffect === "undefined" ? undefined : getCurrentActionEffect,
      getEarthSectorCoordinate: (...args) => getEarthSectorCoordinate(...args),
      getFutureSpanDeltaForCard: typeof getFutureSpanDeltaForCard === "undefined" ? undefined : getFutureSpanDeltaForCard,
      getGameplayLockReason: (...args) => getGameplayLockReason(...args),
      getMarkedNebulaIdsFromEvents: (...args) => getMarkedNebulaIdsFromEvents(...args),
      getMovableTokensForPlayer: (...args) => getMovableTokensForPlayer(...args),
      getNormalTokenAssetForPlayer: (...args) => getNormalTokenAssetForPlayer(...args),
      getPendingPlayCardSelection: (...args) => getPendingPlayCardSelection?.(...args),
      getRequiredMovePointsForUi: (...args) => getRequiredMovePointsForUi(...args),
      hasFutureSpanEligibleHandCard: typeof hasFutureSpanEligibleHandCard === "undefined" ? undefined : hasFutureSpanEligibleHandCard,
      historyCommands: typeof historyCommands === "undefined" ? undefined : historyCommands,
      industry: typeof industry === "undefined" ? undefined : industry,
      insertActionEffectsAfterCurrent: (...args) => insertActionEffectsAfterCurrent(...args),
      isActionEffectFlowActive: (...args) => isActionEffectFlowActive(...args),
      isCardSelectionActive: (...args) => isCardSelectionActive(...args),
      isDataPoolFull: (...args) => isDataPoolFull(...args),
      isDiscardSelectionActive: (...args) => isDiscardSelectionActive(...args),
      isFutureSpanEligibleHandCard: typeof isFutureSpanEligibleHandCard === "undefined" ? undefined : isFutureSpanEligibleHandCard,
      isHandScanSelectionActive: typeof isHandScanSelectionActive === "undefined" ? undefined : isHandScanSelectionActive,
      isInitialIncomeFlowActive: (...args) => isInitialIncomeFlowActive(...args),
      isActionPending: () => isActionPending(),
      isMovePaymentSelectionActive: typeof isMovePaymentSelectionActive === "undefined" ? undefined : isMovePaymentSelectionActive,
      isPlayCardSelectionActive: (...args) => isPlayCardSelectionActive(...args),
      isTechTilePickingActive: (workingRoot, ...args) => isTechTilePickingActiveForRoot(workingRoot, ...args),
      launchRocketForCurrentPlayer: (...args) => launchRocketForCurrentPlayer(...args),
      openAutoDataPlacementPrompt: (...args) => openAutoDataPlacementPrompt(...args),
      openScanTargetPicker: typeof openScanTargetPicker === "undefined" ? undefined : openScanTargetPicker,
      players: typeof players === "undefined" ? undefined : players,
      quickActionHistory: typeof quickActionHistory === "undefined" ? undefined : quickActionHistory,
      recordAbilityCommands: typeof recordAbilityCommands === "undefined" ? undefined : recordAbilityCommands,
      recordHistoryCommand: typeof recordHistoryCommand === "undefined" ? undefined : recordHistoryCommand,
      recordQuickHistoryCommand: typeof recordQuickHistoryCommand === "undefined" ? undefined : recordQuickHistoryCommand,
      removeLastActionLogStep: (...args) => removeLastActionLogStep(...args),
      renderActionEffectBar: (...args) => renderActionEffectBar(...args),
      renderInitialSelectionArea: (...args) => renderInitialSelectionArea(...args),
      renderPlayerHand: (...args) => renderPlayerHand(...args),
      renderPlayerStats: (...args) => renderPlayerStats(...args),
      renderPublicCards: typeof renderPublicCards === "undefined" ? undefined : renderPublicCards,
      renderRocketElement: (...args) => renderRocketElement(...args),
      renderRockets: (...args) => renderRockets(...args),
      renderSectors: (...args) => renderSectors(...args),
      renderStateReadout: (...args) => renderStateReadout(...args),
      renderTechBoard: (workingRoot, ...args) => renderTechBoardForRoot(workingRoot, ...args),
      researchTechForCurrentPlayer: (...args) => researchTechForCurrentPlayer(...args),
      restoreObjectSnapshot: typeof restoreObjectSnapshot === "undefined" ? undefined : restoreObjectSnapshot,
      resultHasSignalMarkedEvent: (...args) => resultHasSignalMarkedEvent(...args),
      rocketActions: typeof rocketActions === "undefined" ? undefined : rocketActions,
      selectDefaultRocketForCurrentPlayer: (...args) => selectDefaultRocketForCurrentPlayer(...args),
      startCardEffectFlow: typeof startCardEffectFlow === "undefined" ? undefined : startCardEffectFlow,
      startIndustryPiratesRaidLaunchFlow: (workingRoot, ...args) => startIndustryPiratesRaidLaunchFlowForRoot(workingRoot, ...args),
      startPendingActionSession: typeof startPendingActionSession === "undefined" ? undefined : startPendingActionSession,
      structuredClone: typeof structuredClone === "undefined" ? undefined : structuredClone,
      syncCardSelectionChrome: (...args) => syncCardSelectionChrome(...args),
      syncDiscardSelectionChrome: typeof syncDiscardSelectionChrome === "undefined" ? undefined : syncDiscardSelectionChrome,
      syncIndustryHandSelectionChrome: (...args) => syncIndustryHandSelectionChrome(...args),
      syncInteractionFocusChrome: (...args) => syncInteractionFocusChrome(...args),
      syncTechSelectionChrome: (workingRoot, ...args) => syncTechSelectionChromeForRoot(workingRoot, ...args),
      tech: typeof tech === "undefined" ? undefined : tech,
      uiRuntimeState: typeof uiRuntimeState === "undefined" ? undefined : uiRuntimeState,
      updateActionButtons: (...args) => updateActionButtons(...args),
  });
  const {
    isIndustryHandSelectionActive,
    isIndustryFutureSpanHandSelectionActive,
    isIndustryFreeMoveActive,
    createIndustryActionRestoreCommand: createIndustryActionRestoreCommandForRoot,
    recordIndustryActionRestoreCommand: recordIndustryActionRestoreCommandForRoot,
    clearIndustryRollbackUi: clearIndustryRollbackUiForRoot,
    rollbackPendingIndustryQuickAction: rollbackPendingIndustryQuickActionForRoot,
    cancelIndustryAbilityFlow: cancelIndustryAbilityFlowForRoot,
    finishIndustryAbilityFlow: finishIndustryAbilityFlowForRoot,
    startIndustryAbilityFlow: startIndustryAbilityFlowForRoot,
    startIndustryStratusEffectFlow: startIndustryStratusEffectFlowForRoot,
    startIndustryFundamentalismExchangeFlow: startIndustryFundamentalismExchangeFlowForRoot,
    startIndustryPublicityPick: startIndustryPublicityPickForRoot,
    beginIndustryTuringBorrow: beginIndustryTuringBorrowForRoot,
    failIndustryTuringBorrow: failIndustryTuringBorrowForRoot,
    checkIndustryTuringBorrowTile: checkIndustryTuringBorrowTileForRoot,
    confirmIndustryTuringBorrow: confirmIndustryTuringBorrowForRoot,
    openIndustryHeliosTechPicker: openIndustryHeliosTechPickerForRoot,
    confirmIndustryHeliosRemoveTech: confirmIndustryHeliosRemoveTechForRoot,
    startIndustryHuanyuMoveEffectFlow: startIndustryHuanyuMoveEffectFlowForRoot,
    beginIndustryHuanyuFreeMoves: beginIndustryHuanyuFreeMovesForRoot,
    executeIndustryFreeMove: executeIndustryFreeMoveForRoot,
    canBeginIndustryFutureSpanHandSelection: canBeginIndustryFutureSpanHandSelectionForRoot,
    beginIndustryFutureSpanHandSelection: beginIndustryFutureSpanHandSelectionForRoot,
    handleIndustryFutureSpanHandClick: handleIndustryFutureSpanHandClickForRoot,
    handleIndustryDeepspaceHandClick: handleIndustryDeepspaceHandClickForRoot,
    finalizeIndustryDeepspaceSwap: finalizeIndustryDeepspaceSwapForRoot,
    handleAlienLabPanelClick: handleAlienLabPanelClickForRoot,
    createAlienLabRestoreCommand,
    maybeConsumeAlienLabPanelForMainAction: maybeConsumeAlienLabPanelForMainActionForRoot,
    maybeRestoreAlienLabPanelForTrace,
    maybeApplyIndustryLaunchScan: maybeApplyIndustryLaunchScanForRoot,
    startLaunchSectorFinishEffectFlow: startLaunchSectorFinishEffectFlowForRoot,
    appendIndustryPlayPassiveStatus: appendIndustryPlayPassiveStatusForRoot,
    getStrategyPassiveRewardIcon,
    snapshotStrategyPlayedCard,
    buildStrategyPlayPassiveEffectNodes,
    buildIndustryPlayCardAppendEffects: buildIndustryPlayCardAppendEffectsForRoot,
    buildPlayCardEffectFlowQueue: buildPlayCardEffectFlowQueueForRoot,
    applyIndustryPlayCardPassives: applyIndustryPlayCardPassivesForRoot,
    isIndustryIrreversibleFlow,
    completeIndustryAbilityQuickStep: completeIndustryAbilityQuickStepForRoot,
    commitIrreversibleIndustryQuickAction: commitIrreversibleIndustryQuickActionForRoot,
    appendSentinelPlayCornerEffectsToFlow,
    tryInjectSentinelPlayCornerEffectAfterArm: tryInjectSentinelPlayCornerEffectAfterArmForRoot,
    createIndustryCardCornerEvent,
    executeIndustryStratusCornerEffect: executeIndustryStratusCornerEffectForRoot,
    executeIndustrySentinelCornerEffect: executeIndustrySentinelCornerEffectForRoot,
    createCompanyCardSummary: createCompanyCardSummaryForRoot,
    executeIndustryHeliosPassiveRewardEffect: executeIndustryHeliosPassiveRewardEffectForRoot,
    setStrategyPassiveRewardSlot,
    getStrategyPassiveSelectableSlotIds: getStrategyPassiveSelectableSlotIdsForRoot,
    closeStrategyPassiveSlotChoicePicker,
    cancelStrategyPassiveSlotChoice: cancelStrategyPassiveSlotChoiceForRoot,
    openStrategyPassiveSlotChoice: openStrategyPassiveSlotChoiceForRoot,
    confirmStrategyPassiveSlotChoice: confirmStrategyPassiveSlotChoiceForRoot,
    finishIndustryStrategyPassiveRewardEffect: finishIndustryStrategyPassiveRewardEffectForRoot,
    executeIndustryStrategyPassiveRewardEffect: executeIndustryStrategyPassiveRewardEffectForRoot,
    handleStrategyPassiveSlotClick: handleStrategyPassiveSlotClickForRoot,
    handleCompanyActionMarkerClick: handleCompanyActionMarkerClickForRoot
  } = industryRuntime;
  const createIndustryActionRestoreCommand = bindBrowserDomainCommand("industry_runtime", "createIndustryActionRestoreCommand");
  const recordIndustryActionRestoreCommand = bindBrowserDomainCommand("industry_runtime", "recordIndustryActionRestoreCommand");
  const clearIndustryRollbackUi = bindBrowserDomainCommand("industry_runtime", "clearIndustryRollbackUi");
  const rollbackPendingIndustryQuickAction = bindBrowserDomainCommand("industry_runtime", "rollbackPendingIndustryQuickAction");
  const cancelIndustryAbilityFlow = bindBrowserDomainCommand("industry_runtime", "cancelIndustryAbilityFlow");
  const finishIndustryAbilityFlow = bindBrowserDomainCommand("industry_runtime", "finishIndustryAbilityFlow");
  const startIndustryAbilityFlow = bindBrowserDomainCommand("industry_runtime", "startIndustryAbilityFlow");
  const startIndustryStratusEffectFlow = bindBrowserDomainCommand("industry_runtime", "startIndustryStratusEffectFlow");
  const startIndustryFundamentalismExchangeFlow = bindBrowserDomainCommand("industry_runtime", "startIndustryFundamentalismExchangeFlow");
  const startIndustryPublicityPick = bindBrowserDomainCommand("industry_runtime", "startIndustryPublicityPick");
  const beginIndustryTuringBorrow = bindBrowserDomainCommand("industry_runtime", "beginIndustryTuringBorrow");
  const failIndustryTuringBorrow = bindBrowserDomainCommand("industry_runtime", "failIndustryTuringBorrow");
  const checkIndustryTuringBorrowTile = bindBrowserDomainCommand("industry_runtime", "checkIndustryTuringBorrowTile");
  const confirmIndustryTuringBorrow = bindBrowserDomainCommand("industry_runtime", "confirmIndustryTuringBorrow");
  const openIndustryHeliosTechPicker = bindBrowserDomainCommand("industry_runtime", "openIndustryHeliosTechPicker");
  const confirmIndustryHeliosRemoveTech = bindBrowserDomainCommand("industry_runtime", "confirmIndustryHeliosRemoveTech");
  const startIndustryHuanyuMoveEffectFlow = bindBrowserDomainCommand("industry_runtime", "startIndustryHuanyuMoveEffectFlow");
  const beginIndustryHuanyuFreeMoves = bindBrowserDomainCommand("industry_runtime", "beginIndustryHuanyuFreeMoves");
  const executeIndustryFreeMove = bindBrowserDomainCommand("industry_runtime", "executeIndustryFreeMove");
  const canBeginIndustryFutureSpanHandSelection = bindBrowserDomainCommand("industry_runtime", "canBeginIndustryFutureSpanHandSelection");
  const beginIndustryFutureSpanHandSelection = bindBrowserDomainCommand("industry_runtime", "beginIndustryFutureSpanHandSelection");
  const handleIndustryFutureSpanHandClick = bindBrowserDomainCommand("industry_runtime", "handleIndustryFutureSpanHandClick");
  const handleIndustryDeepspaceHandClick = bindBrowserDomainCommand("industry_runtime", "handleIndustryDeepspaceHandClick");
  const finalizeIndustryDeepspaceSwap = bindBrowserDomainCommand("industry_runtime", "finalizeIndustryDeepspaceSwap");
  const handleAlienLabPanelClick = bindBrowserDomainCommand("industry_runtime", "handleAlienLabPanelClick");
  const maybeConsumeAlienLabPanelForMainAction = bindBrowserDomainCommand("industry_runtime", "maybeConsumeAlienLabPanelForMainAction");
  const maybeApplyIndustryLaunchScan = bindBrowserDomainCommand("industry_runtime", "maybeApplyIndustryLaunchScan");
  const startLaunchSectorFinishEffectFlow = bindBrowserDomainCommand("industry_runtime", "startLaunchSectorFinishEffectFlow");
  const appendIndustryPlayPassiveStatus = bindBrowserDomainCommand("industry_runtime", "appendIndustryPlayPassiveStatus");
  const buildIndustryPlayCardAppendEffects = bindBrowserDomainCommand("industry_runtime", "buildIndustryPlayCardAppendEffects");
  const buildPlayCardEffectFlowQueue = bindBrowserDomainCommand("industry_runtime", "buildPlayCardEffectFlowQueue");
  const applyIndustryPlayCardPassives = bindBrowserDomainCommand("industry_runtime", "applyIndustryPlayCardPassives");
  const completeIndustryAbilityQuickStep = bindBrowserDomainCommand("industry_runtime", "completeIndustryAbilityQuickStep");
  const commitIrreversibleIndustryQuickAction = bindBrowserDomainCommand("industry_runtime", "commitIrreversibleIndustryQuickAction");
  const tryInjectSentinelPlayCornerEffectAfterArm = bindBrowserDomainCommand("industry_runtime", "tryInjectSentinelPlayCornerEffectAfterArm");
  const executeIndustryStratusCornerEffect = bindBrowserDomainCommand("industry_runtime", "executeIndustryStratusCornerEffect");
  const executeIndustrySentinelCornerEffect = bindBrowserDomainCommand("industry_runtime", "executeIndustrySentinelCornerEffect");
  const createCompanyCardSummary = bindBrowserDomainCommand("industry_runtime", "createCompanyCardSummary");
  const executeIndustryHeliosPassiveRewardEffect = bindBrowserDomainCommand("industry_runtime", "executeIndustryHeliosPassiveRewardEffect");
  const getStrategyPassiveSelectableSlotIds = bindBrowserDomainCommand("industry_runtime", "getStrategyPassiveSelectableSlotIds");
  const cancelStrategyPassiveSlotChoice = bindBrowserDomainCommand("industry_runtime", "cancelStrategyPassiveSlotChoice");
  const openStrategyPassiveSlotChoice = bindBrowserDomainCommand("industry_runtime", "openStrategyPassiveSlotChoice");
  const confirmStrategyPassiveSlotChoice = bindBrowserDomainCommand("industry_runtime", "confirmStrategyPassiveSlotChoice");
  const finishIndustryStrategyPassiveRewardEffect = bindBrowserDomainCommand("industry_runtime", "finishIndustryStrategyPassiveRewardEffect");
  const executeIndustryStrategyPassiveRewardEffect = bindBrowserDomainCommand("industry_runtime", "executeIndustryStrategyPassiveRewardEffect");
  const handleStrategyPassiveSlotClick = bindBrowserDomainCommand("industry_runtime", "handleStrategyPassiveSlotClick");
  const handleCompanyActionMarkerClick = bindBrowserDomainCommand("industry_runtime", "handleCompanyActionMarkerClick");

  const techRuntime = techRuntimeModule.createTechRuntime({
      headless: headlessMode,
      Array: typeof Array === "undefined" ? undefined : Array,
      Boolean: typeof Boolean === "undefined" ? undefined : Boolean,
      HISTORY_SOURCE_MAIN: typeof HISTORY_SOURCE_MAIN === "undefined" ? undefined : HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK: typeof HISTORY_SOURCE_QUICK === "undefined" ? undefined : HISTORY_SOURCE_QUICK,
      Math: typeof Math === "undefined" ? undefined : Math,
      Number: typeof Number === "undefined" ? undefined : Number,
      String: typeof String === "undefined" ? undefined : String,
      actions: typeof actions === "undefined" ? undefined : actions,
      abilities: typeof abilities === "undefined" ? undefined : abilities,
      actionHistory: typeof actionHistory === "undefined" ? undefined : actionHistory,
      beginCardSelection: typeof beginCardSelection === "undefined" ? undefined : beginCardSelection,
      beginEffectHistoryStep: typeof beginEffectHistoryStep === "undefined" ? undefined : beginEffectHistoryStep,
      buildPlutoMarkerRemovalChoices: (workingRoot, ...args) => (
        actionInteractionRuntime?.buildPlutoMarkerRemovalChoices(workingRoot, ...args) || []
      ),
      cancelIndustryAbilityFlow: (...args) => cancelIndustryAbilityFlow(...args),
      cardEffects: typeof cardEffects === "undefined" ? undefined : cardEffects,
      cards: typeof cards === "undefined" ? undefined : cards,
      clearActionEffectFlow: (...args) => clearActionEffectFlow(...args),
      clearActionPending: (...args) => clearActionPending(...args),
      clearHistoryStepOrderForSource: typeof clearHistoryStepOrderForSource === "undefined" ? undefined : clearHistoryStepOrderForSource,
      closeScanTargetPicker: typeof closeScanTargetPicker === "undefined" ? undefined : closeScanTargetPicker,
      completeCurrentActionEffect: typeof completeCurrentActionEffect === "undefined" ? undefined : completeCurrentActionEffect,
      confirmIndustryTuringBorrow: (...args) => confirmIndustryTuringBorrow(...args),
      countOwnedTechByType: (...args) => countOwnedTechByType(...args),
      createActionContext: createActionContextForWorkingRoot,
      decisionSessions,
      dispatchStandardIntent: (family, selector = {}, payload = {}) => (
        dispatchBrowserRuleInput({ kind: "standard_intent", family, selector, payload })
        || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE", message: "Standard Action runtime 尚未装配" }
      ),
      document: typeof document === "undefined" ? undefined : document,
      els: typeof els === "undefined" ? undefined : els,
      endEffectHistoryStep: typeof endEffectHistoryStep === "undefined" ? undefined : endEffectHistoryStep,
      finishAutomaticRewardEffect: (...args) => finishAutomaticRewardEffect(...args),
      formatPlanetRewardGain: (...args) => formatPlanetRewardGain(...args),
      getCurrentActionEffect: typeof getCurrentActionEffect === "undefined" ? undefined : getCurrentActionEffect,
      getPlanetName: (...args) => getPlanetName(...args),
      getPlanetSectorCoordinate: (...args) => getPlanetSectorCoordinate(...args),
      getCurrentActionIrreversibleReason: () => getCurrentActionIrreversibleReason(),
      hasCurrentMainActionIrreversibleBarrier: (...args) => hasCurrentMainActionIrreversibleBarrier(...args),
      historyCommands: typeof historyCommands === "undefined" ? undefined : historyCommands,
      industry: typeof industry === "undefined" ? undefined : industry,
      maybeApplyIndustryLaunchScan: (workingRoot, ...args) => maybeApplyIndustryLaunchScanForRoot(workingRoot, ...args),
      normalizeResourceCost: (...args) => normalizeResourceCost(...args),
      planetReferenceLayout: typeof planetReferenceLayout === "undefined" ? undefined : planetReferenceLayout,
      planetRewards: typeof planetRewards === "undefined" ? undefined : planetRewards,
      planetStats: typeof planetStats === "undefined" ? undefined : planetStats,
      players: typeof players === "undefined" ? undefined : players,
      recordAbilityCommands: typeof recordAbilityCommands === "undefined" ? undefined : recordAbilityCommands,
      recordHistoryCommand: typeof recordHistoryCommand === "undefined" ? undefined : recordHistoryCommand,
      removeActionLogStepsBySource: (...args) => removeActionLogStepsBySource(...args),
      renderActionEffectBar: (...args) => renderActionEffectBar(...args),
      renderPlayerStats: (...args) => renderPlayerStats(...args),
      renderRocketElement: (...args) => renderRocketElement(...args),
      renderRockets: (...args) => renderRockets(...args),
      renderRotateStateToken: (...args) => renderRotateStateToken(...args),
      renderRunezuBoardSymbols: (...args) => renderRunezuBoardSymbols(...args),
      renderSectorNebulaDataBoard: (...args) => renderSectorNebulaDataBoard(...args),
      renderStateReadout: (...args) => renderStateReadout(...args),
      renderWheels: (...args) => renderWheels(...args),
      removePlutoMarker: (workingRoot, ...args) => actionInteractionRuntime.removePlutoMarker(workingRoot, ...args),
      restoreObjectSnapshot: typeof restoreObjectSnapshot === "undefined" ? undefined : restoreObjectSnapshot,
      rocketActions: typeof rocketActions === "undefined" ? undefined : rocketActions,
      runAction: (...args) => runAction(...args),
      setQuickPanelOpen: (...args) => setQuickPanelOpen(...args),
      skipActionEffectWithMessage: (...args) => skipActionEffectWithMessage(...args),
      startCardEffectFlow: typeof startCardEffectFlow === "undefined" ? undefined : startCardEffectFlow,
      structuredClone: typeof structuredClone === "undefined" ? undefined : structuredClone,
      syncCardSelectionChrome: (...args) => syncCardSelectionChrome(...args),
      syncInteractionFocusChrome: (...args) => syncInteractionFocusChrome(...args),
      syncPlanetOrbitLandMarkers: (...args) => syncPlanetOrbitLandMarkers(...args),
      syncTechRenderContext: (...args) => syncTechRenderContext(...args),
      tech: typeof tech === "undefined" ? undefined : tech,
      techRenderContext: typeof techRenderContext === "undefined" ? undefined : techRenderContext,
      uiRuntimeState: typeof uiRuntimeState === "undefined" ? undefined : uiRuntimeState,
      updateActionButtons: (...args) => updateActionButtons(...args),
  });
  const {
    isTechActionSelectionActive: isTechActionSelectionActiveForRoot,
    isTechTilePickingActive: isTechTilePickingActiveForRoot,
    isTechAwaitingConfirm,
    getResearchTechSelectionEffect,
    getResearchTechSelectionPayload,
    getResearchTechSelectionOptions,
    isTechTileOwnedByOtherPlayer: isTechTileOwnedByOtherPlayerForRoot,
    shouldSkipCurrentResearchTechCost,
    isGeneratedResearchTechFollowupEffect,
    countOwnedTechByTypeAfterSelection,
    appendResearchTechFollowupEffects: appendResearchTechFollowupEffectsForRoot,
    onTechTileSelected: onTechTileSelectedForRoot,
    onTechTileTaken: onTechTileTakenForRoot,
    syncTechSelectionChrome: syncTechSelectionChromeForRoot,
    clearResearchTechSelectionState: clearResearchTechSelectionStateForRoot,
    restoreResearchTechSelectionAfterUndo: restoreResearchTechSelectionAfterUndoForRoot,
    cancelPendingResearchTechTileChoice: cancelPendingResearchTechTileChoiceForRoot,
    cancelTechSelection: cancelTechSelectionForRoot,
    renderTechBoard: renderTechBoardForRoot,
    closeTechBlueSlotPicker: closeTechBlueSlotPickerForRoot,
    openTechBlueSlotPicker: openTechBlueSlotPickerForRoot,
    finalizeTechTakeResult: finalizeTechTakeResultForRoot,
    commitResearchTechSelectionResult: commitResearchTechSelectionResultForRoot,
    selectResearchTechTileForCurrentFlow: selectResearchTechTileForCurrentFlowForRoot,
    confirmTechBlueSlotChoice: confirmTechBlueSlotChoiceForRoot,
    handleSupplyTechTileClick: handleSupplyTechTileClickForRoot,
    isPiratesRaidPlacementActiveForPlayer,
    renderPiratesRaidTechMarkers,
    getCurrentPiratesRaidMarkerEffect,
    executeIndustryPiratesRaidMarkerEffect: executeIndustryPiratesRaidMarkerEffectForRoot,
    handlePiratesRaidTechMarkerClick: handlePiratesRaidTechMarkerClickForRoot,
    executeIndustryPiratesRaidPublicityEffect: executeIndustryPiratesRaidPublicityEffectForRoot,
    startIndustryPiratesRaidLaunchFlow: startIndustryPiratesRaidLaunchFlowForRoot,
    buildPiratesRaidLaunchChoices: buildPiratesRaidLaunchChoicesForRoot,
    executeIndustryPiratesRaidLaunchEffect: executeIndustryPiratesRaidLaunchEffectForRoot,
    getPiratesRaidLaunchCoordinate,
    handlePiratesRaidLaunchChoice: handlePiratesRaidLaunchChoiceForRoot,
    setCheatModeOpen: setCheatModeOpenForRoot,
    toggleCheatMode: toggleCheatModeForRoot,
    researchTechForCurrentPlayer,
    commitSelectedResearchTech
  } = techRuntime;
  const isTechActionSelectionActive = bindBrowserDomainCommand("tech_runtime", "isTechActionSelectionActive");
  const isTechTilePickingActive = bindBrowserDomainCommand("tech_runtime", "isTechTilePickingActive");
  const syncTechSelectionChrome = bindBrowserDomainCommand("tech_runtime", "syncTechSelectionChrome");
  const renderTechBoard = bindBrowserDomainCommand("tech_runtime", "renderTechBoard");
  const closeTechBlueSlotPicker = bindBrowserDomainCommand("tech_runtime", "closeTechBlueSlotPicker");
  const isTechTileOwnedByOtherPlayer = bindBrowserDomainCommand("tech_runtime", "isTechTileOwnedByOtherPlayer");
  const appendResearchTechFollowupEffects = bindBrowserDomainCommand("tech_runtime", "appendResearchTechFollowupEffects");
  const onTechTileSelected = bindBrowserDomainCommand("tech_runtime", "onTechTileSelected");
  const onTechTileTaken = bindBrowserDomainCommand("tech_runtime", "onTechTileTaken");
  const clearResearchTechSelectionState = bindBrowserDomainCommand("tech_runtime", "clearResearchTechSelectionState");
  const restoreResearchTechSelectionAfterUndo = bindBrowserDomainCommand("tech_runtime", "restoreResearchTechSelectionAfterUndo");
  const cancelPendingResearchTechTileChoice = bindBrowserDomainCommand("tech_runtime", "cancelPendingResearchTechTileChoice");
  const cancelTechSelection = bindBrowserDomainCommand("tech_runtime", "cancelTechSelection");
  const openTechBlueSlotPicker = bindBrowserDomainCommand("tech_runtime", "openTechBlueSlotPicker");
  const finalizeTechTakeResult = bindBrowserDomainCommand("tech_runtime", "finalizeTechTakeResult");
  const commitResearchTechSelectionResult = bindBrowserDomainCommand("tech_runtime", "commitResearchTechSelectionResult");
  const selectResearchTechTileForCurrentFlow = bindBrowserDomainCommand("tech_runtime", "selectResearchTechTileForCurrentFlow");
  const confirmTechBlueSlotChoice = bindBrowserDomainCommand("tech_runtime", "confirmTechBlueSlotChoice");
  const handleSupplyTechTileClick = bindBrowserDomainCommand("tech_runtime", "handleSupplyTechTileClick");
  const executeIndustryPiratesRaidMarkerEffect = bindBrowserDomainCommand("tech_runtime", "executeIndustryPiratesRaidMarkerEffect");
  const handlePiratesRaidTechMarkerClick = bindBrowserDomainCommand("tech_runtime", "handlePiratesRaidTechMarkerClick");
  const executeIndustryPiratesRaidPublicityEffect = bindBrowserDomainCommand("tech_runtime", "executeIndustryPiratesRaidPublicityEffect");
  const startIndustryPiratesRaidLaunchFlow = bindBrowserDomainCommand("tech_runtime", "startIndustryPiratesRaidLaunchFlow");
  const buildPiratesRaidLaunchChoices = bindBrowserDomainCommand("tech_runtime", "buildPiratesRaidLaunchChoices");
  const executeIndustryPiratesRaidLaunchEffect = bindBrowserDomainCommand("tech_runtime", "executeIndustryPiratesRaidLaunchEffect");
  const handlePiratesRaidLaunchChoice = bindBrowserDomainCommand("tech_runtime", "handlePiratesRaidLaunchChoice");
  const setCheatModeOpen = bindBrowserDomainCommand("tech_runtime", "setCheatModeOpen");
  const toggleCheatMode = bindBrowserDomainCommand("tech_runtime", "toggleCheatMode");

  function createInitialSelectionPicker(offer) {
    const wrap = document.createElement("div");
    wrap.className = "initial-selection-picker";

    if (!offer) {
      const empty = document.createElement("div");
      empty.className = "initial-selection-empty";
      empty.textContent = "没有可用的初始选择。";
      wrap.append(empty);
      return wrap;
    }

    const confirmed = Boolean(offer.confirmed);
    const industrySection = createInitialSelectionSection({
      title: "公司 2 选 1",
      kind: "industry",
      cards: offer.industryOptions,
      selectedIds: offer.selectedIndustryId ? [offer.selectedIndustryId] : [],
      disabled: confirmed,
    });
    const initialSection = createInitialSelectionSection({
      title: "初始牌 3 选 2",
      kind: "initial",
      cards: offer.initialOptions,
      selectedIds: offer.selectedInitialIds,
      disabled: confirmed,
    });

    const footer = document.createElement("div");
    footer.className = "initial-selection-footer";
    const status = document.createElement("span");
    status.className = "initial-selection-status";
    status.textContent = confirmed
      ? "已确认"
      : `已选公司 ${offer.selectedIndustryId ? 1 : 0}/1，初始牌 ${offer.selectedInitialIds.length}/2`;

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "initial-selection-confirm";
    confirm.textContent = confirmed ? "已确认" : "确认选择";
    confirm.disabled = confirmed || !canConfirmInitialSelection(offer);
    confirm.addEventListener("click", confirmInitialSelectionForCurrentPlayer);
    footer.append(status, confirm);

    wrap.append(industrySection, initialSection, footer);
    return wrap;
  }

  function createInitialSelectionSection(options) {
    const section = document.createElement("section");
    section.className = `initial-selection-section initial-selection-section-${options.kind}`;
    const title = document.createElement("div");
    title.className = "initial-selection-section-title";
    title.textContent = options.title;
    const row = document.createElement("div");
    row.className = "initial-selection-card-row";
    row.replaceChildren(...options.cards.map((card) => (
      createInitialSelectionButton(card, {
        kind: options.kind,
        selected: options.selectedIds.includes(card.id),
        disabled: options.disabled
          || (
            options.kind === "initial"
            && options.selectedIds.length >= INITIAL_SELECTION_REQUIRED.initial
            && !options.selectedIds.includes(card.id)
          ),
      })
    )));
    section.append(title, row);
    return section;
  }

  function createInitialSelectionButton(card, options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "initial-selection-card-button";
    button.classList.toggle("is-selected", Boolean(options.selected));
    button.dataset.initialKind = options.kind;
    button.dataset.initialCardId = card.id;
    button.disabled = Boolean(options.disabled);
    button.setAttribute("aria-pressed", String(Boolean(options.selected)));
    button.setAttribute("aria-label", card.label);
    button.addEventListener("click", () => {
      handleInitialSelectionCardClick(options.kind, card.id);
    });
    button.append(createInitialSelectionImage(card));
    attachCardHoverPreview(button, card.src, card.label);
    return button;
  }

  function createInitialSelectionImage(card, mode = "picker") {
    const image = document.createElement("img");
    image.className = `initial-selection-card initial-selection-card-${card.kind || "card"} initial-selection-card-${mode}`;
    image.src = card.src;
    image.alt = card.label || "";
    image.width = card.width || 747;
    image.height = card.height || 1040;
    image.decoding = "async";
    return image;
  }

  function placeDataToBlueSlotForRoot(workingRoot, blueSlot) {
    const blocked = blockIncompatiblePendingQuickActionForRoot(workingRoot, "place-data");
    if (blocked) return blocked;

    const player = players.getCurrentPlayer(workingRoot.playerState);
    if (!data.listPoolTokens(player).length) {
      workingRoot.rocketState.statusNote = "数据池没有可放置的数据";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }

    const check = data.canPlaceDataToBlueBonus(player, blueSlot);
    if (!check.ok) {
      workingRoot.rocketState.statusNote = check.message;
      renderStateReadout();
      return check;
    }

    return confirmDataPlacement(data.PLACEMENT_KIND_BLUE_BONUS, blueSlot, { workingRoot });
  }

  function placeDataToBlueSlot(blueSlot) {
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "data_place_blue_slot",
      blueSlot,
    }).value;
  }

  function getPlayerReadoutLines() {
    const readoutRoot = createStateSourceReadoutRoot();
    const interfacePlayer = getInterfacePlayer();
    const currentPlayer = readoutRoot.playerState.players.find((player) => player.id === interfacePlayer?.id)
      || players.getCurrentPlayer(readoutRoot.playerState);
    const resources = currentPlayer.resources;
    const income = players.normalizeIncome(currentPlayer.income || null);
    const companyBaseIncome = getPlayerCompanyBaseIncome(currentPlayer);
    const limits = players.RESOURCE_LIMITS;
    const reservedCount = Array.isArray(currentPlayer.reservedCards) ? currentPlayer.reservedCards.length : 0;
    const probeLocationData = buildProbeLocationIndex();
    const finalScoreBreakdown = endGameScoring?.computePlayerFinalScore
      ? endGameScoring.computePlayerFinalScore({
        currentPlayer,
        finalScoringState: readoutRoot.finalScoringState,
        playerState: readoutRoot.playerState,
        nebulaDataState: readoutRoot.nebulaDataState,
        alienGameState: readoutRoot.alienGameState,
        planetStatsState: readoutRoot.planetStatsState,
        ...buildPlutoMarkerContext(),
        probeLocations: probeLocationData.index,
        probeLocationDetails: probeLocationData.details,
        cardEffects,
        getCardTypeCode,
        getPlayerCompanyBaseIncome,
      })
      : { totalScore: resources.score, tileScore: 0, cardScore: 0 };

    return [
      "玩家状态",
      `${currentPlayer.name}(${currentPlayer.color}) 信用点=${resources.credits} 能量=${resources.energy} 宣传=${resources.publicity}/${limits.publicity} 可用数据=${resources.availableData}/${limits.availableData} 奥陌陌化石=${resources.aomomoFossils || 0} 额外公共扫描=${resources.additionalPublicScan || 0} 手牌=${resources.handSize} 保留=${reservedCount} 完成任务=${currentPlayer.completedTaskCount || 0} 分数=${resources.score} 环绕=${currentPlayer.orbitCount}`,
      `终局总分=${finalScoreBreakdown.totalScore}（板块=${finalScoreBreakdown.tileScore || 0} 卡牌=${finalScoreBreakdown.cardScore || 0} 九折=${finalScoreBreakdown.jiuzheCardScore || 0} 符文族=${finalScoreBreakdown.runezuSymbolScore || 0} 威胁=${finalScoreBreakdown.jiuzheThreat || 0}${finalScoreBreakdown.jiuzhePenaltyApplied ? " 已0.9修正" : ""}）`,
      `符文族symbol ${runezu?.getPlayerSymbolSummary?.(currentPlayer) || "无"}`,
      `收入 信用点=${formatPlayerIncomeBreakdown(currentPlayer, "credits", income, companyBaseIncome)} 能量=${formatPlayerIncomeBreakdown(currentPlayer, "energy", income, companyBaseIncome)} 手牌=${formatPlayerIncomeBreakdown(currentPlayer, "handSize", income, companyBaseIncome)} 宣传=${income.publicity || 0} 数据=${income.availableData || 0} 额外公共扫描=${income.additionalPublicScan || 0}`,
    ];
  }

  function getInitialSelectionReadoutLines() {
    const playerIds = getInitialSelectionPlayerIds();
    const phaseLabel = setupSelectionState.phase === "selecting" ? "选择中" : "已完成";
    const lines = [
      "初始选择",
      `状态=${phaseLabel} 当前=${setupSelectionState.currentPlayerId ? getPlayerLabelById(setupSelectionState.currentPlayerId) : "无"}`,
    ];

    for (const playerId of playerIds) {
      const player = getPlayerById(playerId);
      const offer = getInitialSelectionOffer(playerId);
      const selectedIndustry = offer?.selectedIndustryId
        ? getCardFromInitialOffer(offer, "industry", offer.selectedIndustryId)?.label
        : player?.initialSelection?.industry?.label;
      const selectedInitial = offer?.selectedInitialIds?.length
        ? offer.selectedInitialIds
          .map((cardId) => getCardFromInitialOffer(offer, "initial", cardId)?.label)
          .filter(Boolean)
        : (player?.initialSelection?.removedInitialCards || []).map((card) => card.label);

      lines.push(
        `${getPlayerLabelById(playerId)} 公司=${selectedIndustry || "未选"} 初始牌=${selectedInitial.join("、") || "未选"} 确认=${isInitialSelectionConfirmed(playerId) ? "是" : "否"}`,
      );
    }

    return lines;
  }

  function getPlanetStatsReadoutLines() {
    const readoutRoot = createStateSourceReadoutRoot();
    const lines = planetStats.formatPlanetStatsLines(readoutRoot.planetStatsState);
    if (aomomo && (readoutRoot.solarState.aomomoActive || readoutRoot.alienGameState.aomomo?.revealInitialized)) {
      const aomomoLineIndex = lines.findIndex((line) => String(line).startsWith("奥陌陌 "));
      if (aomomoLineIndex >= 0) {
        lines[aomomoLineIndex] = `奥陌陌 环绕=${aomomo.countOrbitMarkers(readoutRoot.alienGameState)} 登陆=${aomomo.countLandingMarkers(readoutRoot.alienGameState)}`;
      }
    }
    return [
      "星球统计",
      ...lines,
    ];
  }

  function queueStateReadoutRender() {
    if (uiRuntimeState.stateReadoutRenderFrame) return;
    uiRuntimeState.stateReadoutRenderFrame = window.requestAnimationFrame(() => {
      uiRuntimeState.stateReadoutRenderFrame = 0;
      renderStateReadout();
    });
  }

  function createActionContextForWorkingRoot(workingRoot, descriptor = null) {
    if (!isBrowserWorkingRoot(workingRoot)) throw new TypeError("Action context 缺少 Composition workingRoot");
    const actorId = descriptor?.actorId || workingRoot.playerState.currentPlayerId;
    const actionPlayerState = actorId === workingRoot.playerState.currentPlayerId
      ? workingRoot.playerState
      : { ...workingRoot.playerState, currentPlayerId: actorId, players: workingRoot.playerState.players };
    return {
      solarState: workingRoot.solarState,
      playerState: actionPlayerState,
      cardState: workingRoot.cardState,
      rocketState: workingRoot.rocketState,
      nebulaDataState: workingRoot.nebulaDataState,
      planetStatsState: workingRoot.planetStatsState,
      alienGameState: workingRoot.alienGameState,
      finalScoringState: workingRoot.finalScoringState,
      techBoardState: workingRoot.techGameState.board,
      techUiState: workingRoot.techGameState.ui,
      techGameState: workingRoot.techGameState,
      turnState: workingRoot.turnState,
      metaState: workingRoot.meta,
      matchState: workingRoot.match,
      stateVersion: workingRoot.meta?.stateVersion ?? 0,
      decisionVersion: workingRoot.match?.decisionVersion ?? 0,
      standardActionAuthority: {
        actorId,
        stateVersion: workingRoot.meta?.stateVersion ?? 0,
        decisionVersion: workingRoot.match?.decisionVersion ?? 0,
      },
      ...(actionInteractionRuntime?.buildPlutoMarkerContext(workingRoot) || { plutoMarkers: [] }),
      roundNumber: workingRoot.turnState.roundNumber,
      turnNumber: workingRoot.turnState.turnNumber,
      getPlayerTokenSrc: (player) => getNormalTokenAssetForPlayer(player),
      getEarthSectorCoordinate,
      getPlanetLocations: () => solar.createSolarSnapshot(workingRoot.solarState).planetLocations,
      rotateSolarOrbit: (count) => rotateSolarOrbitForRoot(workingRoot, count),
      drawBasicCardToPlayer: (player) => drawBasicCardToPlayerForRoot(workingRoot, player),
      drawBasicCard: () => drawCardForCurrentPlayerForRoot(workingRoot),
      blindDrawCard: (player) => blindDrawCardForPlayerForRoot(workingRoot, player),
      launchRocketAtEarth: (player) => rocketActions.launchRocketAtSector(
        workingRoot.rocketState,
        getEarthSectorCoordinate(),
        { playerId: player.id, color: player.color },
      ),
      replenishPublicSlot: (slotIndex) => cards.replenishPublicSlot(
        workingRoot.cardState,
        workingRoot.playerState,
        slotIndex,
      ),
      beginCardSelection: (pendingAction) => beginCardSelectionForRoot(workingRoot, pendingAction),
      beginDiscardSelection: (count, pendingAction) => handFlowHelpers.beginDiscardSelection(
        workingRoot,
        count,
        pendingAction,
      ),
      beginIncome: (options) => beginIncomeForCurrentPlayerForRoot(workingRoot, options),
      getPlayerCompanyBaseIncome,
      ensurePlayerTechState: (player) => {
        if (!player.techState) player.techState = players.normalizePlayerTechState(null);
      },
    };
  }

  function createReadoutActionContext() {
    return createActionContextForWorkingRoot(createStateSourceReadoutRoot());
  }

  function removeRocketElement(rocketId) {
    if (headlessMode || !document) return;
    const element = document.getElementById(`rocket-${rocketId}`);
    if (element) element.remove();
    const chongOwnerToken = chongFossilOwnerTokenElements.get(String(rocketId));
    if (chongOwnerToken) {
      chongOwnerToken.remove();
      chongFossilOwnerTokenElements.delete(String(rocketId));
    }
  }

  function setActionButtonState(button, enabled, reason) {
    if (!button) return;
    button.disabled = !enabled;
    button.classList.toggle("action-button-ready", enabled);
    button.title = enabled ? "" : (reason || "当前无法执行此行动");
    button.setAttribute("aria-disabled", String(!enabled));
  }

  function setTurnActionButtonState(button, enabled, highlighted = false) {
    if (!button) return;
    button.disabled = !enabled;
    button.classList.toggle("action-button-pending", Boolean(enabled && highlighted));
    button.setAttribute("aria-disabled", String(!enabled));
  }


  function markActionPending() {
    actionHistory.markActionComplete?.();
  }

  function isActionPending() {
    return Boolean(actionHistory.isActionComplete?.());
  }

  function getIrreversibleReason(result, fallback = "该步骤产生不可撤销影响") {
    if (result?.irreversible?.reason) return String(result.irreversible.reason);
    if (result?.irreversibleReason) return String(result.irreversibleReason);
    if (result?.undoable === false) return result.message || fallback;
    return null;
  }

  function markCurrentActionIrreversible(reason, code = "irreversible") {
    const barrierReason = reason || getCurrentActionIrreversibleReason() || "该步骤产生不可撤销影响";
    actionHistory.markIrreversible?.({
      source: HISTORY_SOURCE_MAIN,
      code,
      irreversibleReason: barrierReason,
    });
    return {
      code,
      reason: barrierReason,
    };
  }

  function getCurrentActionIrreversibleReason() {
    return actionHistory.getIrreversibleBarrier?.()?.irreversibleReason || null;
  }

  function markResultIrreversible(result, reason, code = "irreversible") {
    if (!result) return result;
    result.undoable = false;
    result.irreversible = {
      code,
      reason: reason || result.irreversible?.reason || result.message || "该步骤产生不可撤销影响",
    };
    markCurrentActionIrreversible(result.irreversible.reason, result.irreversible.code);
    return result;
  }

  function getAlienCardGainIrreversible(result) {
    return result?.card
      ? { code: "hidden_alien_card_reveal", reason: "外星人牌获取翻开新牌" }
      : null;
  }

  function clearActionPending() {
    clearCompletedEffectFlowForUndo(HISTORY_SOURCE_MAIN);
  }

  function recoverPendingActionFromOpenHistoryForAiForRoot(workingRoot) {
    if (
      isActionPending()
      || isActionEffectFlowActive()
      || hasActivePendingSubFlow()
      || !actionHistory.hasSession()
    ) {
      return { ok: false, message: "当前不需要恢复行动待结束状态" };
    }
    markActionPending();
    const info = actionHistory.getSessionInfo?.() || null;
    workingRoot.rocketState.statusNote = `${info?.label || "行动"}已恢复为待回合结束状态`;
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message: workingRoot.rocketState.statusNote, sessionInfo: info };
  }

  function recoverPendingActionFromOpenHistoryForAi() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "action_recover_pending" }).value;
  }

  function isMainActionOpeningStep(step) {
    return step?.source === HISTORY_SOURCE_MAIN
      && (
        step.type === "action_start"
        || step.type === "action-cost"
        || step.effectIndex === -1
      );
  }

  function clearFullyUndoneMainActionSession() {
    const info = actionHistory.getSessionInfo?.();
    if (!info || info.stepCount !== 0 || actionHistory.hasUndoableStep()) {
      return false;
    }
    uiRuntimeState.effectStepActive = false;
    actionHistory.commitSession();
    clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
    clearActionPending();
    pruneEmptyActionLogDraft();
    renderActionLog();
    return true;
  }

  function clearStaleFullyUndoneMainActionSession() {
    if (!actionHistory.hasSession()
      || isActionPending()
      || isActionEffectFlowActive()
      || actionHistory.hasUndoableStep()) {
      return false;
    }
    const info = actionHistory.getSessionInfo?.();
    if (!info || info.stepCount !== 0) return false;
    clearFullyUndoneMainActionSession();
    return true;
  }

  function canUndoCurrentMainAction() {
    if (actionHistory.hasUndoableStep()) return true;
    if (hasCurrentMainActionIrreversibleBarrier()) return false;
    return Boolean(isActionPending() || isActionEffectFlowActive());
  }

  function hasCurrentMainActionIrreversibleBarrier() {
    return Boolean(actionHistory.hasIrreversibleBarrier?.());
  }

  function getMainActionStartBlockReason() {
    const gameplayLockReason = getGameplayLockReason();
    if (gameplayLockReason) return gameplayLockReason;
    if (isActionPending()) return "请先回合结束或撤销当前行动";
    if (isActionEffectFlowActive()) return "请先完成当前行动的效果";
    if (actionHistory.hasSession()) return "请先回合结束或撤销当前行动";
    if (hasActivePendingSubFlow()) return "请先完成或取消当前流程";
    return null;
  }

  function canStartMainAction() {
    return !getMainActionStartBlockReason();
  }

  turnEndFlow = turnEndFlowModule.createTurnEndFlow({
    decisionSessions,
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    PASS_HAND_LIMIT,
    PASS_RESERVE_ROUNDS,
    abilities,
    actionHistory,
    activateNextActionEffect,
    advanceTurnAfterPlayerAction,
    aliens,
    appendActionLogStep,
    applyIncomeResourcesForPlayer,
    applyIndustryRoundStartBonuses,
    assignEffectFlowOwner,
    beginDiscardSelection,
    beginEffectHistoryStep,
    buildAlienRevealNoticeEntry,
    canStartMainAction,
    clearActionEffectFlow,
    clearActionPending,
    clearHistoryStepOrderForSource,
    commitActionLogDraft,
    completeCurrentActionEffect,
    completePendingActionStep,
    createActionLogImpactSnapshot,
    els,
    endEffectHistoryStep,
    getCurrentPlayer,
    getDisplayedTurnNumber,
    getMainActionStartBlockReason,
    hasActiveCardTriggerResolution,
    hasActivePendingSubFlow,
    getPendingBanrenmaCardGain,
    getPendingJiuzheCardPlay,
    getPendingBanrenmaOpportunity,
    historyCommands,
    industry,
    isActionEffectFlowActive,
    isCardSelectionActive,
    isFinalRound,
    isWeakStartAiDifficulty,
    maybeAutoOpenFinalResultDialog,
    maybeOpenActionBriefingForCompletedCycle,
    maybeOpenQueuedBanrenmaOpportunity,
    maybeOpenQueuedJiuzheOpportunity,
    maybeStartFundamentalismRoundStartIncomeFlow,
    openAlienRevealConfirmation,
    decisionSessions,
    planetRewards,
    quickActionHistory,
    recordHistoryCommand,
    refreshLatestActionLogRecoverySnapshot,
    renderAlienPanels,
    renderDebugPlayerSwitch,
    renderInitialSelectionArea,
    renderPlayerStats,
    renderPublicCards,
    renderReservedCards,
    renderRockets,
    renderRoundStatus,
    renderStateReadout,
    renderTechBoard,
    rotateSolarOrbit: rotateSolarOrbitForRoot,
    scheduleAiAutoStepIfNeeded,
    selectDefaultRocketForCurrentPlayer,
    settleCardTasksAfterEffect,
    settleTurnEndAlienRevealEntries,
    startActionLogDraft,
    uiRuntimeState,
    updateActionButtons,
    updatePublicCardControls,
  });

  function undoPendingActionForRoot(workingRoot) {
    if (isTechActionSelectionActive()) {
      const isResearchTechFlow = decisionState.actionEffectFlow?.actionType === "researchTech";
      const shouldUseHistoryUndo = isResearchTechFlow
        && (actionHistory.hasUndoableStep() || hasCurrentMainActionIrreversibleBarrier());
      if (shouldUseHistoryUndo) {
        if (workingRoot.techGameState.ui.pendingTileId) {
          cancelPendingResearchTechTileChoice();
          return;
        }
      } else {
        cancelTechSelection();
        return;
      }
    }
    if (
      !isActionPending()
      && !isActionEffectFlowActive()
      && !actionHistory.hasUndoableStep()
      && !quickActionHistory.hasUndoableStep()
    ) return;

    if (hasActivePendingSubFlow()) {
      cancelActivePendingSubFlowsForRoot(workingRoot);
      refreshAfterHistoryChange();
      return;
    }

    const latestUndoSource = getLatestUndoSource();

    if (
      !latestUndoSource
      && decisionState.actionEffectFlow?.historySource === HISTORY_SOURCE_QUICK
      && !decisionState.actionEffectFlow.preHistoryCommandsApplied
      && decisionState.actionEffectFlow.preHistoryCommands?.length
    ) {
      const flowLabel = decisionState.actionEffectFlow.label || "快速行动效果";
      for (let index = decisionState.actionEffectFlow.preHistoryCommands.length - 1; index >= 0; index -= 1) {
        decisionState.actionEffectFlow.preHistoryCommands[index]?.undo?.();
      }
      uiRuntimeState.effectStepActive = false;
      if (quickActionHistory.hasSession() && !quickActionHistory.hasUndoableStep()) {
        quickActionHistory.commitSession();
        clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
      }
      clearActionEffectFlow();
      refreshAfterHistoryChange(`已撤销：${flowLabel}`);
      return;
    }

    if (latestUndoSource === HISTORY_SOURCE_QUICK) {
      const undoingQuickEffectFlow = decisionState.actionEffectFlow?.historySource === HISTORY_SOURCE_QUICK;
      const result = quickActionHistory.undoLastStep();
      if (result.ok) {
        uiRuntimeState.effectStepActive = false;
        forgetLastHistoryStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
        removeLastActionLogStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
        const completedQuickEffectFlow = !decisionState.actionEffectFlow
          ? takeCompletedEffectFlowForUndo(result.step, HISTORY_SOURCE_QUICK)
          : null;
        if (completedQuickEffectFlow) {
          decisionState.actionEffectFlow = completedQuickEffectFlow;
          els.appWrap?.classList.toggle("action-effect-flow-active", true);
        }
        if ((undoingQuickEffectFlow || completedQuickEffectFlow) && decisionState.actionEffectFlow) {
          const effectIndex = result.step?.effectIndex;
          const hasRevertibleEffectStep = Number.isInteger(effectIndex)
            && Boolean(decisionState.actionEffectFlow.effects?.[effectIndex]);
          if (hasRevertibleEffectStep) {
            revertEffectFlowAfterUndo(result.step);
          } else {
            clearActionEffectFlow();
          }
        }
      }
      if (result.ok && !quickActionHistory.hasUndoableStep() && !isActionEffectFlowActive()) {
        quickActionHistory.commitSession();
        clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
      }
      refreshAfterHistoryChange(result.ok ? result.message : "已撤销快速行动");
      return;
    }

    const mainActionHasIrreversibleBarrier = hasCurrentMainActionIrreversibleBarrier();

    if (!latestUndoSource && mainActionHasIrreversibleBarrier) {
      const irreversibleReason = getCurrentActionIrreversibleReason();
      workingRoot.rocketState.statusNote = irreversibleReason
        ? `不可撤销：${irreversibleReason}`
        : "当前行动已有不可撤销影响";
      updateActionButtons();
      renderStateReadout();
      return;
    }

    if (mainActionHasIrreversibleBarrier && !actionHistory.hasUndoableStep()) {
      const irreversibleReason = getCurrentActionIrreversibleReason();
      workingRoot.rocketState.statusNote = irreversibleReason
        ? `不可撤销：${irreversibleReason}`
        : "当前行动已有不可撤销影响";
      updateActionButtons();
      renderStateReadout();
      return;
    }

    if (
      latestUndoSource === HISTORY_SOURCE_MAIN
      && mainActionHasIrreversibleBarrier
      && actionHistory.hasUndoableStep()
    ) {
      const result = actionHistory.undoLastStep();
      if (result.ok) {
        uiRuntimeState.effectStepActive = false;
        forgetLastHistoryStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
        removeLastActionLogStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
        const completedMainEffectFlow = !decisionState.actionEffectFlow
          ? takeCompletedEffectFlowForUndo(result.step, HISTORY_SOURCE_MAIN)
          : null;
        if (completedMainEffectFlow) {
          decisionState.actionEffectFlow = completedMainEffectFlow;
          els.appWrap?.classList.toggle("action-effect-flow-active", true);
        }
        revertEffectFlowAfterUndo(result.step);
      }
      refreshAfterHistoryChange(result.ok ? result.message : result.message || "当前行动不能撤销");
      return;
    }

    if (isActionEffectFlowActive()) {

      if (actionHistory.hasUndoableStep()) {
        const result = actionHistory.undoLastStep();
        if (result.ok) {
          uiRuntimeState.effectStepActive = false;
          forgetLastHistoryStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
          removeLastActionLogStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
          revertEffectFlowAfterUndo(result.step);
          if (!isActionEffectFlowActive()) {
            clearFullyUndoneMainActionSession();
          }
          refreshAfterHistoryChange(result.message);
          return;
        }
      }
    }

    const completedMainFlowUndoStep = actionHistory.peekLastUndoableStep?.() || null;
    if (
      latestUndoSource === HISTORY_SOURCE_MAIN
      && !isActionEffectFlowActive()
      && peekCompletedEffectFlowForUndo(completedMainFlowUndoStep, HISTORY_SOURCE_MAIN)
      && actionHistory.hasUndoableStep()
    ) {
      const result = actionHistory.undoLastStep();
      if (result.ok) {
        uiRuntimeState.effectStepActive = false;
        forgetLastHistoryStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
        removeLastActionLogStep(HISTORY_SOURCE_MAIN, result.step?.id || null);
        const completedMainEffectFlow = takeCompletedEffectFlowForUndo(result.step, HISTORY_SOURCE_MAIN);
        if (completedMainEffectFlow) {
          decisionState.actionEffectFlow = completedMainEffectFlow;
          els.appWrap?.classList.toggle("action-effect-flow-active", true);
          revertEffectFlowAfterUndo(result.step);
        }
        if (!isActionEffectFlowActive()) {
          clearFullyUndoneMainActionSession();
        }
      }
      refreshAfterHistoryChange(result.ok ? result.message : result.message || "已撤销效果");
      return;
    }

    if (isActionPending() || actionHistory.hasSession()) {
      const result = actionHistory.rollbackSession();
      if (result.ok) {
        uiRuntimeState.effectStepActive = false;
        clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
        removeActionLogStepsBySource(HISTORY_SOURCE_MAIN);
        clearActionEffectFlow();
        clearActionPending();
      }
      refreshAfterHistoryChange(result.ok ? result.message : result.message || "当前行动不能撤销");
    }
  }

  function undoPendingAction() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "history_undo_pending" }).value;
  }


  function setQuickActionButtonEnabled(enabled, reason) {
    els.actionQuickButton.disabled = !enabled;
    els.actionQuickButton.title = enabled ? "" : (reason || "当前无法执行此行动");
    els.actionQuickButton.setAttribute("aria-disabled", String(!enabled));
    els.actionQuickButton.classList.add("action-button-ready");
  }

  function updateTurnActionButtons() {
    const pendingBlockedReason = "请先回合结束或撤销当前行动";
    const effectBlockedReason = "请先完成当前行动的效果";

    if (isTechTilePickingActive()) {
      setTurnActionButtonState(els.actionPassButton, false);
      setTurnActionButtonState(els.actionConfirmButton, false);
      setTurnActionButtonState(els.actionUndoButton, true, false);
      return "请先选择科技或点击取消";
    }

    if (isActionEffectFlowActive()) {
      setTurnActionButtonState(els.actionPassButton, false);
      setTurnActionButtonState(els.actionConfirmButton, false);
      setTurnActionButtonState(
        els.actionUndoButton,
        quickActionHistory.hasUndoableStep() || canUndoCurrentMainAction(),
        false,
      );
      return effectBlockedReason;
    }

    if (isActionPending()) {
      const mainActionHasIrreversibleBarrier = hasCurrentMainActionIrreversibleBarrier();
      setTurnActionButtonState(els.actionPassButton, false);
      setTurnActionButtonState(els.actionConfirmButton, true, true);
      setTurnActionButtonState(
        els.actionUndoButton,
        quickActionHistory.hasUndoableStep() || canUndoCurrentMainAction(),
        !mainActionHasIrreversibleBarrier,
      );
      return pendingBlockedReason;
    }

    setTurnActionButtonState(els.actionPassButton, canStartMainAction());
    setTurnActionButtonState(els.actionConfirmButton, false);
    setTurnActionButtonState(els.actionUndoButton, quickActionHistory.hasUndoableStep());
    return null;
  }

  function updateActionButtons() {
    if (headlessMode) return;
    syncFinalResultButton();
    const readoutRoot = createStateSourceReadoutRoot();
    const context = createActionContextForWorkingRoot(readoutRoot);
    const gameplayLockReason = getGameplayLockReason();
    if (gameplayLockReason) {
      lockAllActionButtons(gameplayLockReason);
      return;
    }
    if (isAiAutoBattlePlayer(readoutRoot.playerState.currentPlayerId) && !isAiAutomationPaused()) {
      lockAllActionButtons("电脑玩家自动行动中");
      return;
    }

    const techSelectionLocked = isTechTilePickingActive();
    const cardSelectionLocked = isCardSelectionActive();
    const discardSelectionLocked = isDiscardSelectionActive();
    const playCardSelectionLocked = isPlayCardSelectionActive();
    const movePaymentLocked = isMovePaymentSelectionActive();
    const handScanLocked = isHandScanSelectionActive();
    const effectFlowLocked = isActionEffectFlowActive();
    const actionHistoryLocked = actionHistory.hasSession();
    const pendingSubFlowLocked = hasActivePendingSubFlow();
    const selectionBlockReason = techSelectionLocked
      ? "请先选择科技或点击取消"
      : handScanLocked
        ? "请先完成手牌扫描或点击取消"
        : movePaymentLocked
          ? "请先确认或取消移动"
          : playCardSelectionLocked
            ? "请先打出或点击取消"
            : discardSelectionLocked
              ? "请先完成弃牌或点击取消"
              : "请先完成精选或点击取消";

    const pendingBlockedReason = updateTurnActionButtons();
    const effectBlockedReason = effectFlowLocked ? "请先完成当前行动的效果" : pendingBlockedReason;

    if (techSelectionLocked || discardSelectionLocked || playCardSelectionLocked || movePaymentLocked) {
      setActionButtonState(els.actionLaunchButton, false, selectionBlockReason);
      setActionButtonState(els.actionOrbitButton, false, selectionBlockReason);
      setActionButtonState(els.actionLandButton, false, selectionBlockReason);
      setActionButtonState(els.actionScanButton, false, selectionBlockReason);
      setActionButtonState(els.actionAnalyzeButton, false, selectionBlockReason);
      setActionButtonState(els.actionPlayCardButton, false, selectionBlockReason);
      setActionButtonState(els.actionResearchTechButton, false, selectionBlockReason);
      setQuickActionButtonEnabled(false, selectionBlockReason);
      updateQuickPanel();
      renderActionEffectBar();
      return;
    }

    if (cardSelectionLocked || handScanLocked) {
      setActionButtonState(els.actionLaunchButton, false, effectBlockedReason || selectionBlockReason);
      setActionButtonState(els.actionOrbitButton, false, effectBlockedReason || selectionBlockReason);
      setActionButtonState(els.actionLandButton, false, effectBlockedReason || selectionBlockReason);
      setActionButtonState(els.actionScanButton, false, effectBlockedReason || selectionBlockReason);
      setActionButtonState(els.actionAnalyzeButton, false, effectBlockedReason || selectionBlockReason);
      setActionButtonState(els.actionPlayCardButton, false, effectBlockedReason || selectionBlockReason);
      setActionButtonState(els.actionResearchTechButton, false, effectBlockedReason || selectionBlockReason);
      setQuickActionButtonEnabled(false, effectBlockedReason || selectionBlockReason);
      updateQuickPanel();
      renderActionEffectBar();
      return;
    }

    if (pendingSubFlowLocked) {
      const subFlowReason = "请先完成或取消当前流程";
      setActionButtonState(els.actionLaunchButton, false, subFlowReason);
      setActionButtonState(els.actionOrbitButton, false, subFlowReason);
      setActionButtonState(els.actionLandButton, false, subFlowReason);
      setActionButtonState(els.actionScanButton, false, subFlowReason);
      setActionButtonState(els.actionAnalyzeButton, false, subFlowReason);
      setActionButtonState(els.actionPlayCardButton, false, subFlowReason);
      setActionButtonState(els.actionResearchTechButton, false, subFlowReason);
      setQuickActionButtonEnabled(false, subFlowReason);
      updateQuickPanel();
      renderActionEffectBar();
      return;
    }

    if (effectFlowLocked || isActionPending() || actionHistoryLocked) {
      setActionButtonState(els.actionLaunchButton, false, pendingBlockedReason);
      setActionButtonState(els.actionOrbitButton, false, pendingBlockedReason);
      setActionButtonState(els.actionLandButton, false, pendingBlockedReason);
      setActionButtonState(els.actionScanButton, false, pendingBlockedReason);
      setActionButtonState(els.actionAnalyzeButton, false, pendingBlockedReason);
      setActionButtonState(els.actionPlayCardButton, false, pendingBlockedReason);
      setActionButtonState(els.actionResearchTechButton, false, pendingBlockedReason);
      setQuickActionButtonEnabled(!isInitialIncomeFlowActive(), pendingBlockedReason);
      updateQuickPanel();
      renderActionEffectBar();
      return;
    }

    const launchCheck = actions.canExecute("launch", context);
    const orbitCheck = abilities.planet.getOrbitOptions(context);
    const landCheck = abilities.planet.getLandOptions(context);
    const plutoOrbitCheck = getAvailablePlutoAction("orbit");
    const plutoLandCheck = getAvailablePlutoAction("land");
    const researchTechCheck = actions.canExecute("researchTech", context);
    const analyzeCheck = canAnalyzeDataForPlayer(getCurrentPlayer());
    const scanCheck = scanEffects.canExecuteScan(getCurrentPlayer(), { standardAction: true });
    const currentPlayer = getCurrentPlayer();
    const playCardBlockReason = getStandardPlayCardActionBlockReason(currentPlayer);
    const canPlayCard = !playCardBlockReason
      && (Boolean(currentPlayer?.hand?.length) || hasPlayableFutureSpanCard(currentPlayer));

    setActionButtonState(els.actionLaunchButton, launchCheck.ok, launchCheck.message);
    setActionButtonState(
      els.actionOrbitButton,
      orbitCheck.ok || plutoOrbitCheck.ok,
      orbitCheck.ok ? orbitCheck.message : (orbitCheck.message || plutoOrbitCheck.message),
    );
    setActionButtonState(
      els.actionLandButton,
      landCheck.ok || plutoLandCheck.ok,
      landCheck.ok ? landCheck.message : (landCheck.message || plutoLandCheck.message),
    );
    setActionButtonState(els.actionScanButton, scanCheck.ok, scanCheck.message);
    setActionButtonState(els.actionAnalyzeButton, analyzeCheck.ok, analyzeCheck.message);
    setActionButtonState(
      els.actionPlayCardButton,
      canPlayCard,
      canPlayCard ? "" : (playCardBlockReason || "没有手牌可打出"),
    );
    setActionButtonState(els.actionResearchTechButton, researchTechCheck.ok, researchTechCheck.message);
    setQuickActionButtonEnabled(true);
    updateQuickPanel();
    renderActionEffectBar();
  }

  function isQuickPanelOpen() {
    if (headlessMode) return false;
    return !els.quickActionsPanel.hidden;
  }

  function setQuickPanelOpen(open) {
    if (headlessMode) return;
    if (open && getGameplayLockReason()) return;
    if (open) cancelHandCardContextActions({ silent: true });
    els.quickActionsPanel.hidden = !open;
    els.actionQuickButton.setAttribute("aria-expanded", String(open));
    els.actionQuickButton.classList.add("action-button-ready");
    if (open) updateQuickPanel();
  }

  function toggleQuickPanel() {
    setQuickPanelOpen(!isQuickPanelOpen());
  }

  function updateQuickTradeButtons() {
    const context = createReadoutActionContext();
    els.quickActionsTrades.querySelectorAll("[data-quick-trade]").forEach((button) => {
      const tradeId = button.dataset.quickTrade;
      const check = quickTrades.canExecuteTrade(tradeId, context);
      button.disabled = !check.ok;
      button.title = check.ok ? "" : (check.message || "当前无法兑换");
    });
  }

  actionInteractionRuntime = actionInteractionRuntimeModule.createActionInteractionRuntime({
    headless: headlessMode,
    HISTORY_SOURCE_MAIN,
    SCORE_SOURCE_KEYS,
    abilities,
    actionShared,
    addPlayerScoreSource,
    beginCardSelection,
    beginDiscardSelection,
    beginEffectHistoryStep,
    blockIncompatiblePendingQuickAction,
    buildPlutoChoiceRewardSummary,
    buildPlutoRewardEffectsForAction,
    canStartMainAction,
    cancelMovePaymentSelection,
    cardEffects,
    createActionContext: createActionContextForWorkingRoot,
    data,
    els,
    getBoardPointFromPolarPoint,
    getMainActionStartBlockReason,
    getPendingOwnerFields,
    getPendingOwnerPlayer,
    getPlaceDataSlotBonuses,
    hasActiveCardTriggerResolution,
    historyCommands,
    isActionEffectFlowActive,
    isMovePaymentSelectionActive,
    markerBelongsToPlayer,
    markerOwnerLabel,
    openLandTargetPicker,
    decisionSessions,
    players,
    recordAtomicActionHistory,
    recordHistoryCommand,
    recordPlaceDataActionHistory,
    removeRocketElement,
    renderInitialSelectionArea,
    renderPlayerStats,
    renderReservedCards,
    renderRocketElement,
    renderRockets,
    renderStateReadout,
    restoreMutableObject,
    rocketActions,
    runAction,
    settleCardTasksAfterEffect,
    solar,
    startCardEffectFlow,
    syncInteractionFocusChrome,
    tokenWidths,
    uiRuntimeState,
    updateActionButtons,
    validateIndustryHuanyuMoveRocket,
    withPendingOwnerPlayer,
  });

  function updateQuickPanel() {
    if (headlessMode) return;
    if (!isQuickPanelOpen()) return;
    updateQuickTradeButtons();
  }

  function runPlaceDataToComputerForRoot(workingRoot) {
    const blocked = blockIncompatiblePendingQuickActionForRoot(workingRoot, "place-data");
    if (blocked) return blocked;

    const gameplayLockReason = getGameplayLockReason();
    if (gameplayLockReason) {
      workingRoot.rocketState.statusNote = gameplayLockReason;
      renderStateReadout();
      return { ok: false, message: gameplayLockReason };
    }

    if (isTechTilePickingActive()) {
      workingRoot.rocketState.statusNote = "请先完成科技选择";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }
    if (isCardSelectionActive()) {
      workingRoot.rocketState.statusNote = "请先完成精选";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }
    if (isDiscardSelectionActive()) {
      workingRoot.rocketState.statusNote = "请先完成弃牌";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }
    if (isPlayCardSelectionActive()) {
      workingRoot.rocketState.statusNote = "请先完成打牌";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }
    if (isMovePaymentSelectionActive()) {
      workingRoot.rocketState.statusNote = "请先完成移动";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }

    openDataPlacePicker();
    return { ok: true };
  }

  function runPlaceDataToComputer() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "data_open_computer_picker" }).value;
  }

  function analyzeDataForCurrentPlayer() {
    return runAction("analyze", getAnalyzeActionOptionsForPlayer());
  }

  function canAnalyzeDataForPlayer(player = getCurrentPlayer()) {
    return data.canAnalyzeData(player, {
      skipEnergyCost: Boolean(industry.canAnalyzeWithoutEnergy?.(player)),
    });
  }

  function getAnalyzeActionOptionsForPlayer(player = getCurrentPlayer(), actionOptions = {}) {
    const options = { ...(actionOptions || {}) };
    if (industry.canAnalyzeWithoutEnergy?.(player)) {
      options.skipCost = true;
    }
    return options;
  }

  function startAnalyzeDataRewardFlow(workingRoot) {
    const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
    const rewardEffects = [{
      id: "analyze-blue-alien-trace",
      type: planetRewards.EFFECT_TYPES.ALIEN_TRACE,
      label: "分析：获得 1 个蓝色外星人痕迹",
      icon: "alien_blue",
      needsUserChoice: true,
      options: {
        traceType: "blue",
        targetPlayerId: currentPlayer?.id || null,
        targetPlayerColor: currentPlayer?.color || null,
      },
    }];
    return startCardEffectFlow(
      "analyze-rewards",
      "分析奖励",
      rewardEffects,
      { workingRoot, actionType: "analyze", historySource: HISTORY_SOURCE_MAIN, consumesMainAction: true },
    );
  }

  function runQuickTrade(tradeId, options = {}) {
    if (!options.workingRoot) {
      return dispatchBrowserRuleInput({
        kind: "standard_intent",
        family: "quick_trade",
        selector: { tradeId },
      });
    }
    const workingRoot = options.workingRoot;
    const actionPlayerState = workingRoot.playerState;
    const actionCardState = workingRoot.cardState;
    const actionRocketState = workingRoot.rocketState;
    const blocked = blockIncompatiblePendingQuickAction("quick-trade");
    if (blocked) return blocked;

    const gameplayLockReason = getGameplayLockReason();
    if (gameplayLockReason) {
      actionRocketState.statusNote = gameplayLockReason;
      renderStateReadout();
      return { ok: false, message: gameplayLockReason };
    }

    const player = players.getCurrentPlayer(actionPlayerState);
    const beforeState = historyCommands.captureTradeState(player, actionCardState);
    const result = quickTrades.executeTrade(
      tradeId,
      createActionContextForWorkingRoot(workingRoot, options.standardAction),
    );
    if (!result.ok) {
      actionRocketState.statusNote = result.message;
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return result;
    }

    if (result.awaitingDiscard) {
      if (decisionState.discardAction) {
        decisionState.discardAction.beforeTradeState = beforeState;
        if (
          options.preserveHandIndex !== null
          && options.preserveHandIndex !== undefined
          && options.preserveHandIndex !== ""
        ) {
          decisionState.discardAction.preserveHandIndex = Number(options.preserveHandIndex);
        }
        if (options.aiReason) {
          decisionState.discardAction.aiReason = options.aiReason;
        }
      }
      actionRocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    if (result.awaitingCardSelection) {
      if (decisionState.cardSelectionAction) {
        decisionState.cardSelectionAction.beforeTradeState = beforeState;
        if (options.preferBlindDraw) {
          decisionState.cardSelectionAction.aiPreferBlindDraw = true;
        }
        if (options.aiReason) {
          decisionState.cardSelectionAction.aiReason = options.aiReason;
        }
      }
      actionRocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    recordQuickTradeCompletion(tradeId, player, beforeState, { workingRoot });
    actionRocketState.statusNote = result.message;
    renderPlayerStats();
    renderPublicCards();
    updatePublicCardControls();
    updateActionButtons();
    renderStateReadout();
    return result;
  }

  function runAction(actionId, actionOptions) {
    const options = actionOptions || {};
    const selector = actionId === "land"
      ? {
        ...(options.rocketId == null ? {} : { rocketId: Number(options.rocketId) }),
        ...(options.target?.type ? { type: options.target.type } : {}),
        ...(options.target?.satelliteId ? { satelliteId: options.target.satelliteId } : {}),
      }
      : (options.rocketId == null ? {} : { rocketId: Number(options.rocketId) });
    return dispatchBrowserRuleInput({
      kind: "standard_intent",
      family: actionId,
      selector,
      payload: options,
    });
  }

  function getRocketCoordinateReadoutLines() {
    const readoutRocketState = createStateSourceReadoutRoot().rocketState;
    const activeRocket = readoutRocketState.rockets.find((rocket) => rocket.id === readoutRocketState.activeRocketId);
    const formatRocketLine = (rocket) => {
      const marker = rocket.id === readoutRocketState.activeRocketId ? "*" : " ";
      const snapshot = createRocketSnapshot(rocket);
      const color = players.getPlayerColorDefinition(rocket.color || players.DEFAULT_PLAYER_COLOR);
      if (snapshot.surface === ROCKET_SURFACE.PLANETS_REFERENCE) {
        return `${marker}${formatRocketLabel(rocket)} ${color.label} ${formatPlanetsReferencePoint(snapshot.planetsReference)}`;
      }

      const slot = snapshot.slotSectorCoordinate
        ? ` 扇区[${snapshot.slotSectorCoordinate.x},${snapshot.slotSectorCoordinate.y}]#${snapshot.slotIndex}`
        : snapshot.sectorCoordinate
          ? ` -> ${formatSectorCoordinate(snapshot)}`
        : "";
      return `${marker}${formatRocketLabel(rocket)} ${color.label} ${formatPolarPoint(snapshot.polar)} ${formatBoardPoint(snapshot.board)}${slot}`;
    };
    const occupancy = rocketActions.getSectorOccupancy(readoutRocketState);
    const occupancyLines = occupancy.size
      ? [...occupancy.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, slots]) => {
          const indices = [...slots.keys()].sort((a, b) => a - b).join(",");
          return `扇区[${key}] 占用#${indices}`;
        })
      : ["无"];

    return [
      "火箭坐标",
      `火箭坐标系 polar board-${solar.GLOBAL_COORDINATE_SYSTEM.size}`,
      activeRocket ? `当前 ${formatRocketLine(activeRocket).replace(/^[* ]/, "")}` : "当前 无",
      readoutRocketState.statusNote ? `提示 ${readoutRocketState.statusNote}` : "提示 无",
      "",
      "扇区占用",
      ...occupancyLines,
    ];
  }

  function closeLandTargetPicker() {
    decisionSessions.clear(LAND_TARGET_DECISION);
    if (!els.landTargetOverlay) return;
    els.landTargetOverlay.hidden = true;
    delete els.landTargetOverlay.dataset.planetId;
  }

  function cancelLandTargetPicker() {
    const pending = getPendingLandTargetDecision();
    closeLandTargetPicker();
    if (typeof pending?.onCancel === "function") {
      pending.onCancel();
    }
  }

  function openLandTargetPicker(options) {
    if (!els.landTargetOverlay || !els.landTargetSelect) {
      if (headlessMode && typeof options.onConfirm === "function") {
        decisionSessions.open(LAND_TARGET_DECISION, {
          ...getPendingOwnerFields(options.effect || null, options.player || null),
          effect: options.effect || null,
          getOptions: options.getOptions,
          onConfirm: options.onConfirm,
          onCancel: options.onCancel,
        });
        return { ok: true, pending: true, message: "请选择登陆目标" };
      }
      const choice = options.choices?.[0] || { target: options.defaultTarget };
      if (typeof options.onConfirm === "function") {
        return withPendingOwnerPlayer({
          ...getPendingOwnerFields(options.effect || null, options.player || null),
          effect: options.effect || null,
        }, () => options.onConfirm(choice, options));
      }
      runAction("land", { target: choice.target, rocketId: choice.rocketId });
      return;
    }

    if (typeof options.onConfirm === "function") {
      decisionSessions.open(LAND_TARGET_DECISION, {
        ...getPendingOwnerFields(options.effect || null, options.player || null),
        effect: options.effect || null,
        getOptions: options.getOptions,
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
      });
    } else {
      decisionSessions.clear(LAND_TARGET_DECISION);
    }
    els.landTargetTitle.textContent = options.title || `选择登陆目标：${options.planet.name}`;
    if (els.landTargetLabel) {
      els.landTargetLabel.textContent = options.selectLabel || "登陆到";
    }
    if (els.landTargetConfirm) {
      els.landTargetConfirm.textContent = options.confirmText || "确认登陆";
    }
    els.landTargetSelect.replaceChildren(...options.choices.map((choice, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = choice.label;
      return option;
    }));
    els.landTargetOverlay.dataset.planetId = options.planet?.planetId || "";
    els.landTargetOverlay.hidden = false;
    els.landTargetSelect.focus();
  }

  function confirmLandTargetPicker() {
    return confirmLandTargetChoice(Number(els.landTargetSelect?.value));
  }

  function confirmLandTargetChoice(choiceIndex = 0) {
    const pending = getPendingLandTargetDecision();
    return withPendingOwnerPlayer(pending, () => {
    const options = typeof pending?.getOptions === "function"
      ? pending.getOptions()
      : abilities.planet.getLandOptions(createActionContextForWorkingRoot(createStateSourceReadoutRoot()));
    if (!options.ok || !options.choices?.length) {
      closeLandTargetPicker();
      setBrowserStatusNote(options.message || "登陆目标已失效");
      renderStateReadout();
      return;
    }

    const choice = options.choices[choiceIndex] || options.choices[0];
    closeLandTargetPicker();
    if (typeof pending?.onConfirm === "function") {
      return pending.onConfirm(choice, options);
    }
    runAction("land", { target: choice.target, rocketId: choice.rocketId });
    });
  }

  function getHeadlessConditionalPlayer(pending) {
    return resolvePlayerReference({
      playerId: pending?.playerId || pending?.targetPlayerId || null,
      playerColor: pending?.playerColor || pending?.targetPlayerColor || null,
    }) || getEffectOwnerPlayer(pending?.effect) || getCurrentPlayer();
  }

  function getHeadlessDecisionOwnerState(enumeratedActor = null) {
    const readoutRoot = createStateSourceReadoutRoot();
    const currentPlayer = players.getCurrentPlayer(readoutRoot.playerState);
    const finalScorePlayer = enumeratedActor || currentPlayer;
    const finalScorePending = finalScoring.getNextPendingMarkForPlayer(
      readoutRoot.finalScoringState,
      finalScorePlayer?.id,
    );
    const activePending = [
      finalScorePending ? { ...finalScorePending, player: finalScorePlayer } : null,
      decisionState.scanTargetAction,
      getPendingProbeSectorScanDecision(),
      decisionState.handScanAction,
      getPendingPassReserveSelection(),
      getPendingMovePayment(),
      getPendingDataPlacementDecision(),
      getPendingCardTriggerFreeMove(),
      decisionState.actionEffectFlow?.cardMoveEffect,
      getPendingCardCornerFreeMove(),
      getPendingStrategySlotDecision(),
      getPendingChongFossilChoice(),
      getPendingAmibaSymbolChoice(),
      decisionState.discardAction,
      decisionState.cardSelectionAction,
      getPendingLandTargetDecision(),
      decisionState.alienTraceAction,
      decisionState.alienTracePickerState,
    ].find(Boolean) || null;
    const pendingOwner = activePending?.player || resolvePlayerReference({
      playerId: activePending?.playerId || activePending?.targetPlayerId || null,
      playerColor: activePending?.playerColor || activePending?.targetPlayerColor || null,
    });
    const effect = activePending?.effect || (
      decisionState.actionEffectFlow ? getCurrentActionEffect() : null
    );
    const effectOwner = effect ? getEffectOwnerPlayer(effect) : null;
    const actorPlayer = pendingOwner || effectOwner || enumeratedActor || currentPlayer || null;
    const source = pendingOwner
      ? "pending_owner"
      : effectOwner ? "effect_owner" : "current_player";
    return {
      actorPlayer,
      actorPlayerId: actorPlayer?.id || null,
      pendingOwnerPlayerId: pendingOwner?.id || null,
      effectOwnerPlayerId: effectOwner?.id || null,
      currentPlayerId: currentPlayer?.id || null,
      source,
    };
  }

  function createConditionalActionProvider(family) {
    return {
      label: family,
      getOptions(context) {
        return conditionalActionExecutor.getOptions(context, family);
      },
      canExecute(context, descriptor) {
        return conditionalActionExecutor.validate(context, descriptor);
      },
      execute() {
        return {
          ok: false,
          code: "CONDITIONAL_ACTION_EXECUTOR_REQUIRED",
          message: "Conditional Standard Action 只允许由 working-root executor 执行",
        };
      },
    };
  }

  function enumerateHeadlessConditionalActionsForRoot(workingRoot) {
    syncFinalScorePendingMarks(workingRoot);
    const decision = conditionalActionExecutor.inspect(workingRoot);
    const actorPlayer = decision?.ownerId ? getPlayerById(decision.ownerId) : null;
    if (!actorPlayer?.id || !decision?.choices?.length) {
      return { actorPlayer, candidates: [] };
    }
    const listing = actionRuntimeController.dispatchAction(
      { kind: "standard_enumerate", payload: { actorId: actorPlayer.id } },
      null,
      createActionContextForWorkingRoot(workingRoot),
    );
    const candidates = (listing.candidates || [])
      .filter((standardAction) => standardAction.phase === "conditional")
      .map((standardAction) => ({
        ...structuredClone(standardAction.payload || {}),
        id: "conditionalChoice",
        family: standardAction.family,
        label: standardAction.summary,
        target: structuredClone(standardAction.target || null),
        standardAction,
      }));
    return { actorPlayer, candidates };
  }

  function enumerateHeadlessConditionalActions() {
    const inspection = browserRuleComposition.inspect();
    if (inspection.phase === "awaiting_input" && inspection.session?.decision) {
      const decision = inspection.session.decision;
      return {
        actorPlayer: decision.ownerId ? getPlayerById(decision.ownerId) : null,
        candidates: structuredClone(decision.choices || []),
      };
    }
    return browserRuleComposition.inputPort.submitHostCommand({
      kind: "headless_enumerate_conditional_actions",
    }).value || { actorPlayer: null, candidates: [] };
  }

  function executeHeadlessConditionalAction(action) {
    const standardAction = action?.standardAction || null;
    if (!standardAction || standardAction.family !== action?.family) {
      return {
        ok: false,
        code: "STANDARD_ACTION_SCHEMA_MISMATCH",
        message: "条件动作缺少匹配的 Standard Action descriptor",
      };
    }
    const inspection = browserRuleComposition.inspect();
    const decision = inspection.session?.decision || null;
    if (inspection.phase !== "awaiting_input" || !decision) {
      return { ok: false, code: "RULE_COMPOSITION_SESSION_REQUIRED", message: "当前 Composition 没有等待输入的 Decision" };
    }
    const choice = (decision.choices || []).find((candidate) => (
      (candidate?.standardAction || candidate)?.actionId === standardAction.actionId
    ));
    if (!choice) {
      return { ok: false, code: "EFFECT_DECISION_NOT_LEGAL", message: "条件动作不在 Composition Decision choices 中" };
    }
    return browserRuleComposition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      choice,
    });
  }

  function advanceHeadlessDeterministicStateImpl(workingRoot) {
    const industryPending = decisionSessions.peek("industry_ability");
    if (industryPending && !decisionState.cardSelectionAction) {
      const player = getCurrentPlayer();
      const retryByFlowType = {
        strategy_pick: () => beginCardSelection({
          type: "industry_strategy_pick",
          player,
          allowBlindDraw: false,
        }),
        future_span_pick: () => beginCardSelection({
          type: "industry_future_pick",
          player,
          allowBlindDraw: false,
          advanceAmount: industryPending.advanceAmount,
        }),
        deepspace_swap: () => {
          decisionState.cardSelectionAction = {
            type: "industry_deepspace_hand",
            player,
            allowBlindDraw: false,
          };
          cards.setSelectionActive(workingRoot.cardState, true);
          return { ok: true, message: industryPending.message };
        },
      };
      const retry = retryByFlowType[industryPending.flowType];
      if (retry) {
        const result = retry();
        if (result?.ok !== false) {
          return { ok: true, progressed: true, message: result?.message || industryPending.message };
        }
      }
    }
    const cardPending = decisionState.cardSelectionAction;
    if (
      cardPending?.type?.startsWith?.("industry_")
      && !(workingRoot.cardState.publicCards || []).some(Boolean)
      && !(allowsBlindDrawInSelection() && canBlindDraw())
    ) {
      const label = decisionSessions.peek("industry_ability")?.label || "公司 1x";
      const message = `${label}：公共牌区与牌库均无牌，精选效果落空`;
      finishIndustryAbilityFlow(message);
      return { ok: true, progressed: true, skipped: true, message };
    }
    return null;
  }

  function advanceHeadlessDeterministicState() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "headless_advance_deterministic" });
  }

  function executeHeadlessCurrentActionEffectImpl(workingRoot) {
    const effect = getCurrentActionEffect();
    if (!effect || effect.status !== "active") {
      return { ok: false, message: "没有可直接推进的活动效果" };
    }
    return executeActionEffect(workingRoot, effect);
  }

  function executeHeadlessCurrentActionEffect() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "headless_execute_current_effect" });
  }

  function launchRocketForCurrentPlayer() {
    runAction("launch");
  }

  function orbitForCurrentPlayer() {
    if (!canStartMainAction()) {
      const message = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      setBrowserStatusNote(message);
      renderStateReadout();
      return { ok: false, message };
    }
    const context = createActionContextForWorkingRoot(createStateSourceReadoutRoot());
    const normal = abilities.planet.getOrbitOptions(context);
    const placement = getCurrentPlanetActionPlacement(context);
    const preferredRocketId = normal?.defaultRocketId || (placement?.ok ? placement.rocket?.id : null);
    const pluto = getAvailablePlutoAction("orbit", { preferredRocketId });
    if (normal.ok && pluto.ok) {
      return openPlutoActionChoicePicker("orbit");
    }
    if (!normal.ok && pluto.ok) {
      return executePlutoAction("orbit", { preferredRocketId });
    }
    if (!normal.ok) {
      setBrowserStatusNote(normal.message);
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return { ok: false, message: normal.message };
    }
    if (normal.needsChoice) {
      openLandTargetPicker({
        ...normal,
        title: "选择环绕目标",
        selectLabel: "环绕到",
        confirmText: "确认环绕",
        getOptions: () => abilities.planet.getOrbitOptions(
          createActionContextForWorkingRoot(createStateSourceReadoutRoot()),
        ),
        onConfirm: (choice) => runAction("orbit", { rocketId: choice.rocketId }),
      });
      setBrowserStatusNote("请选择环绕目标");
      renderStateReadout();
      return { ok: true, pendingChoice: true };
    }
    return runAction("orbit", { rocketId: normal.defaultRocketId });
  }

  function landForCurrentPlayer() {
    if (!canStartMainAction()) {
      const message = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      setBrowserStatusNote(message);
      renderStateReadout();
      return { ok: false, message };
    }
    const context = createActionContextForWorkingRoot(createStateSourceReadoutRoot());
    const check = abilities.planet.getLandOptions(context);
    const placement = getCurrentPlanetActionPlacement(context);
    const preferredRocketId = check?.defaultRocketId || (placement?.ok ? placement.rocket?.id : null);
    const pluto = getAvailablePlutoAction("land", { preferredRocketId });
    if (check.ok && pluto.ok) {
      return openPlutoActionChoicePicker("land");
    }
    if (!check.ok) {
      if (pluto.ok) {
        return executePlutoAction("land", { preferredRocketId });
      }
      setBrowserStatusNote(check.message);
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return { ok: false, message: check.message };
    }

    const options = check;
    if (!options.ok) {
      setBrowserStatusNote(options.message);
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return { ok: false, message: options.message };
    }

    if (options.needsChoice) {
      openLandTargetPicker({
        ...options,
        getOptions: () => abilities.planet.getLandOptions(
          createActionContextForWorkingRoot(createStateSourceReadoutRoot()),
        ),
        onConfirm: (choice) => runAction("land", { target: choice.target, rocketId: choice.rocketId }),
      });
      return { ok: true, pendingChoice: true, planetId: options.planet.planetId };
    }

    return runAction("land", { target: options.defaultTarget, rocketId: options.defaultRocketId });
  }

  function addDebugIncome() {
    return callDebugCommand("addDebugIncome");
  }

  function executeIncomeForCurrentPlayerForRoot(workingRoot) {
    const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
    const result = applyIncomeResourcesForPlayer(currentPlayer, {
      label: "执行收入（调试，可能重复发放）",
    });
    workingRoot.rocketState.statusNote = result.message;
    renderPlayerStats();
    renderPublicCards();
    updatePublicCardControls();
    updateActionButtons();
    renderStateReadout();
    return result;
  }

  function executeIncomeForCurrentPlayer() {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "debug_execute_income" }).value;
  }

  function addDebugData() {
    return callDebugCommand("addDebugData");
  }

  function addDebugScore() {
    return callDebugCommand("addDebugScore");
  }

  function addDebugCardByInput(input) {
    return callDebugCommand("addDebugCardByInput", [input]);
  }

  function promptDebugGainCard() {
    return callDebugCommand("promptDebugGainCard");
  }

  function revealJiuzheForDebug() {
    return callDebugCommand("revealJiuzheForDebug");
  }

  function revealYichangdianForDebug() {
    return callDebugCommand("revealYichangdianForDebug");
  }

  function revealFangzhouForDebug() {
    return callDebugCommand("revealFangzhouForDebug");
  }

  function revealBanrenmaForDebug() {
    return callDebugCommand("revealBanrenmaForDebug");
  }

  function revealChongForDebug() {
    return callDebugCommand("revealChongForDebug");
  }

  function revealAmibaForDebug() {
    return callDebugCommand("revealAmibaForDebug");
  }

  function logAomomoDebugCoordinates(alienSlotId = null) {
    const resolvedSlotId = alienSlotId
      ?? createStateSourceReadoutRoot().alienGameState.aomomo?.revealedSlotId
      ?? 1;
    return callDebugCommand("logAomomoDebugCoordinates", [resolvedSlotId]);
  }

  function revealAomomoForDebug() {
    return callDebugCommand("revealAomomoForDebug");
  }

  function revealRunezuForDebug() {
    return callDebugCommand("revealRunezuForDebug");
  }

  function focusFangzhouDebugCalibration(alienSlotId = 1) {
    return focusDebugCalibration(alienSlotId);
  }

  function focusYichangdianDebugCalibration(alienSlotId = 1) {
    return focusDebugCalibration(alienSlotId);
  }

  function focusBanrenmaDebugCalibration(alienSlotId = 1) {
    return focusDebugCalibration(alienSlotId);
  }

  function focusChongDebugCalibration(alienSlotId = 1) {
    return focusDebugCalibration(alienSlotId);
  }

  function focusAmibaDebugCalibration(alienSlotId = 1) {
    return focusDebugCalibration(alienSlotId);
  }

  function focusAomomoDebugCalibration(alienSlotId = 1) {
    return focusDebugCalibration(alienSlotId);
  }


  function fillNebulaDataBoard(options = {}) {
    return callDebugCommand("fillNebulaDataBoard", [options]);
  }

  function fillDebugNebulaData() {
    return callDebugCommand("fillDebugNebulaData");
  }

  function toggleSectorWinDebug() {
    return callDebugCommand("toggleSectorWinDebug");
  }

  function moveRocket(deltaX, deltaY, rocketId, options = {}) {
    if (isAiAutomationInputLocked() && options.automated !== true) {
      return blockManualAiAutomationInput("电脑玩家自动移动中");
    }
    const readoutRoot = createStateSourceReadoutRoot();
    const selectedRocketId = rocketId
      ?? uiRuntimeState.moveHighlightRocketId
      ?? readoutRoot.rocketState.activeRocketId;
    if (!selectedRocketId) {
      setBrowserStatusNote("请先点击要移动的火箭");
      renderStateReadout();
      return { ok: false, rocket: null, message: "请先点击要移动的火箭" };
    }

    const standardAction = options.standardAction || browserRuleComposition.inputPort.enumerateActions({
      family: "move",
    }).find((candidate) => (
      Number(candidate.target?.rocketId) === Number(selectedRocketId)
      && Number(candidate.target?.deltaX) === Number(deltaX)
      && Number(candidate.target?.deltaY) === Number(deltaY)
    )) || null;
    if (!standardAction) {
      setBrowserStatusNote("移动 intent 已失效");
      renderStateReadout();
      return { ok: false, code: "STANDARD_ACTION_NOT_LEGAL", message: "移动 intent 已失效" };
    }

    if (!options.standardAction) {
      return browserRuleComposition.inputPort.submitQuickAction(standardAction);
    }

    return beginMovePaymentSelection(deltaX, deltaY, selectedRocketId, {
      standardAction,
    });
  }

  function moveActiveRocket(deltaX, deltaY) {
    return moveRocket(deltaX, deltaY, createStateSourceReadoutRoot().rocketState.activeRocketId);
  }

  function handleRocketPointerDown(event) {
    if (event.button !== 0) return;
    if (isAiAutomationInputLocked()) {
      event.preventDefault();
      event.stopPropagation();
      blockManualAiAutomationInput();
      return;
    }

    const rocketId = Number(event.currentTarget.dataset.rocketId);
    if (!Number.isInteger(rocketId)) return;

    const rocket = createStateSourceReadoutRoot().rocketState.rockets.find((item) => item.id === rocketId);
    if (!rocket || isPlanetMarkerRocket(rocket)) return;

    event.stopPropagation();
    if (uiRuntimeState.moveHighlightRocketId === rocketId) {
      event.preventDefault();
      return;
    }
    if (!activateMoveMode(rocketId)) return;

    event.preventDefault();
  }

  function handleBoardPointerDown(event) {
    if (event.button !== 0) return;
    if (isAiAutomationInputLocked()) {
      event.preventDefault();
      blockManualAiAutomationInput();
      return;
    }
    if (event.target.closest(".rocket-token") || event.target.closest(".move-arrow-button")) return;
    if (uiRuntimeState.moveHighlightRocketId == null) return;
    if (
      getPendingCardTriggerFreeMove()
      || uiRuntimeState.industryFreeMoveState
      || getPendingCardCornerFreeMove()
      || decisionState.actionEffectFlow?.freeMoveMode
      || decisionState.actionEffectFlow?.cardMoveEffect
    ) return;
    deactivateMoveMode();
    renderStateReadout();
  }

  /** 官网 randomizeWheels 的无动画版：直接累加步数并渲染 */
  function randomizeWheels(workingRoot) {
    const { solarState: workingSolarState } = workingRoot;
    for (let w = 1; w <= 4; w += 1) {
      const delta = Math.floor(Math.random() * 8 + WHEEL_OFFSETS[w]);
      workingSolarState.wheelSteps[w] -= delta;
    }
    workingSolarState.rotation = solar.normalizeRotationState(workingSolarState.wheelSteps, 0);
    renderWheels();
  }

  /** 官网 randomizeSectors 逻辑：将 4 个扇区洗牌分配到 4 个外边槽位 */
  function randomizeSectors(workingRoot) {
    const pool = [1, 2, 3, 4];
    while (pool.length) {
      const slotId = pool.length;
      const pickIndex = Math.floor(Math.random() * pool.length);
      const sectorId = pool.splice(pickIndex, 1)[0];
      workingRoot.solarState.sectorBySlot[slotId] = sectorId;
    }
    renderSectors();
  }

  /** 终局计分：a/b/c/d 各自独立随机 1 或 2 */
  function randomizeFinalScores(workingRoot) {
    finalScoring.randomizeTileVariants(workingRoot.finalScoringState, FINAL_SCORE_IDS);
    els.finalScoreTiles.forEach((img) => {
      const id = img.dataset.finalId;
      if (!id) return;
      const variant = finalScoring.getTileVariant(workingRoot.finalScoringState, id);
      img.src = `../assets/final/final_${id}${variant}.png`;
      img.alt = `终局计分 ${id.toUpperCase()}${variant}`;
    });
  }

  function getSetupState() {
    return solar.createSetupState(createStateSourceReadoutRoot().solarState);
  }

  function rotateSolarOrbitForRoot(workingRoot, count) {
    const { solarState: workingSolarState } = workingRoot;
    const iterations = Math.max(1, Math.round(Number(count || 1)));
    const rotationSettlements = [];
    const anomalyTriggers = [];
    const events = [];

    for (let index = 0; index < iterations; index += 1) {
      const beforeRotation = structuredClone(workingSolarState.rotation);
      workingSolarState.rotation = solar.applySolarOrbitRotation(workingSolarState.rotation, 1);
      workingSolarState.wheelSteps = solar.rotationToWheelSteps(workingSolarState.rotation);
      const settlement = abilities.rocket.settleRocketsAfterSolarRotation(
        workingRoot,
        beforeRotation,
        workingSolarState.rotation,
      );
      if (settlement) {
        rotationSettlements.push(settlement);
        events.push(...(settlement.events || []));
      }
      const earth = getEarthSectorCoordinate();
      const anomalyResult = triggerYichangdianAnomalyForEarthX(workingRoot, earth.x);
      if (anomalyResult) {
        anomalyTriggers.push(anomalyResult);
        events.push(...(anomalyResult.events || []));
      }
    }

    const lastSettlement = rotationSettlements[rotationSettlements.length - 1];
    const lastAnomaly = anomalyTriggers[anomalyTriggers.length - 1];
    renderWheels();
    renderSectorNebulaDataBoard();
    renderRotateStateToken();
    refreshHelpers.refreshBoardState({
      includeTech: false,
      includeFinalScore: false,
      includeRunezuSymbols: true,
    });
    refreshHelpers.refreshPlayerPanels();
    refreshHelpers.refreshAfterPendingChange({
      includeQuickPanel: false,
      includeEffectBar: false,
      includeStateReadout: true,
    });
    return {
      ok: true,
      message: lastAnomaly?.message || lastSettlement?.message || "太阳系旋转",
      payload: { rotationSettlements, anomalyTriggers },
      events,
    };
  }

  function rotateSolarOrbit(count) {
    return browserRuleComposition.inputPort.submitHostCommand({ kind: "solar_rotate", count }).value;
  }

  function handleMainActionButtonClick(event) {
    const button = event.target.closest("button");
    if (!button || !els.actionBarMain?.contains(button)) return;
    if (button === els.actionQuickButton) return;
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return;

    switch (button.id) {
      case "action-launch-button":
        launchRocketForCurrentPlayer();
        break;
      case "action-orbit-button":
        orbitForCurrentPlayer();
        break;
      case "action-land-button":
        landForCurrentPlayer();
        break;
      case "action-scan-button":
        dispatchBrowserRuleInput({ kind: "standard_intent", family: "scan" });
        break;
      case "action-analyze-button":
        dispatchBrowserRuleInput({ kind: "standard_intent", family: "analyze" });
        break;
      case "action-play-card-button":
        beginPlayCardSelection();
        break;
      case "action-research-tech-button":
        researchTechForCurrentPlayer();
        break;
      default:
        break;
    }
  }

  function createFallbackDebugRuntimeController() {
    const noopResult = { ok: false, message: "调试模块未加载" };
    const noop = () => noopResult;
    const noopFocus = () => {};
    return {
      setDebugOpen() {},
      setDebugPlayerMenuOpen() {},
      renderDebugPlayerSwitch() {},
      switchCurrentPlayerColor: noop,
      selectDefaultRocketForCurrentPlayer() {
        return null;
      },
      handleDebugQuickSectorScanChoice: noop,
      openDebugQuickSectorScanPicker: noop,
      runDebugQuickSectorScan: noop,
      setDebugAlienTraceModeActive: noop,
      toggleDebugAlienTraceMode: noop,
      enableDebugAlienTraceModeForReveal: noop,
      addDebugIncome: noop,
      addDebugData: noop,
      addDebugScore: noop,
      addDebugCardByInput: noop,
      promptDebugGainCard: noop,
      revealJiuzheForDebug: noop,
      revealYichangdianForDebug: noop,
      revealFangzhouForDebug: noop,
      revealBanrenmaForDebug: noop,
      revealChongForDebug: noop,
      revealAmibaForDebug: noop,
      revealAomomoForDebug: noop,
      revealRunezuForDebug: noop,
      logAomomoDebugCoordinates() {},
      fillNebulaDataBoard: noop,
      fillDebugNebulaData: noop,
      toggleSectorWinDebug: noop,
      handleAiTakeoverFailsafe: noop,
      handleForceSkipTurnFailsafe: noop,
      renderAfterFailsafeControl() {},
      getFailsafePendingOwnerPlayer() {
        return null;
      },
      createFocusDebugCalibrationHandler() {
        return noopFocus;
      },
      focusDebugCalibration: noop,
    };
  }

  const debugRuntimeController = typeof debugRuntimeModule?.createDebugRuntime === "function"
    ? debugRuntimeModule.createDebugRuntime({
    window,
    document,
    els,
    players,
    cards,
    tech,
    data,
    aliens,
    jiuzhe,
    yichangdian,
    fangzhou,
    banrenma,
    chong,
    amiba,
    aomomo,
    runezu,
    solar,
    decisionSessions,
    uiRuntimeState,
    DEBUG_QUICK_SECTOR_SCAN_EXTRA_LIMIT,
    rocketActions,
    getCurrentPlayer,
    getInterfacePlayer,
    getPlayerAgentLabel,
    getActivePlayers,
    getPlayerById,
    getPlayerByColor,
    getNormalTokenAssetForPlayer,
    getAlienJiuzheTraceLayer,
    getEarthSectorCoordinate,
    getRoundOrderPlayerIds,
    getDisplayedTurnNumber,
    getFirstEligiblePlayerId,
    isPlayerPassedThisRound,
    hasPlayerCompletedThisTurn,
    isAiAutoBattlePlayer,
    createAiControlSnapshot,
    restoreAiControlSnapshot,
    scheduleAiAutoStepIfNeeded,
    isGameEnded,
    resolvePlayerReference,
    getExplicitEffectOwnerPlayer,
    getCurrentActionEffect,
    isCardSelectionActive,
    isDiscardSelectionActive,
    isPlayCardSelectionActive,
    isTechTilePickingActive,
    closeTechBlueSlotPicker,
    closeDataPlacePicker,
    closeScanTargetPicker,
    closeScanAction4Picker,
    closeLandTargetPicker,
    closeAlienTracePicker,
    clearActionEffectFlow,
    clearActionPending,
    syncPassReserveSelectionChrome,
    syncCardSelectionChrome,
    syncDiscardSelectionChrome,
    syncPlayCardSelectionChrome,
    syncTechSelectionChrome,
    setTokenAssetSizes,
    renderRoundStatus,
    renderPlayerStats,
    renderPlayerHand,
    renderPublicCards,
    renderReservedCards,
    renderAlienPanels,
    renderTechBoard,
    renderRockets,
    renderWheels,
    renderSectorNebulaDataBoard,
    renderStateReadout,
    updatePublicCardControls,
    updateActionButtons,
    schedulePersistentGameStateSave,
    clearMoveRocketHighlight,
    getMovableTokensForPlayer,
    resolveCompletedSectorSettlements,
    maybeStartFundamentalismRoundStartIncomeFlow,
    maybeOpenActionBriefingForCompletedCycle,
    maybeAutoOpenFinalResultDialog,
    clearTransientStateForRecovery,
    advanceTurnAfterPlayerAction,
    applyIndustryRoundStartBonuses,
    activateAomomoBoard,
    resize,
  })
    : createFallbackDebugRuntimeController();
  const focusDebugCalibration = (...args) => callDebugCommand("focusDebugCalibration", args);

  const appEventState = {
    get pendingChongFossilChoice() { return getPendingChongFossilChoice(); },
    get pendingChongCardGain() { return getPendingChongCardGain(); },
    get pendingAmibaTraceRemoval() { return getPendingAmibaTraceRemoval(); },
    get pendingAmibaSymbolChoice() { return getPendingAmibaSymbolChoice(); },
    get pendingAmibaCardGain() { return getPendingAmibaCardGain(); },
    get pendingAomomoCardGain() { return getPendingAomomoCardGain(); },
    get pendingRunezuFaceSymbolPlacement() { return getPendingRunezuFaceSymbolPlacement(); },
    get pendingRunezuSymbolBranch() { return getPendingRunezuSymbolBranch(); },
    get pendingRunezuCardGain() { return getPendingRunezuCardGain(); },
    get pendingBanrenmaCardGain() { return getPendingBanrenmaCardGain(); },
    get pendingBanrenmaOpportunity() { return getPendingBanrenmaOpportunity(); },
    get pendingYichangdianCardGain() { return getPendingYichangdianCardGain(); },
    get pendingJiuzheCardPlay() { return getPendingJiuzheCardPlay(); },
    get jiuzheCardViewOpen() { return Boolean(uiRuntimeState.jiuzheCardViewOpen); },
    get pendingStrategyPassiveSlotChoice() { return getPendingStrategySlotDecision(); },
    get alienTracePickerState() { return decisionState.alienTracePickerState; },
    set alienTracePickerState(value) { decisionState.alienTracePickerState = value; },
    get pendingAlienRevealConfirmation() { return uiRuntimeState.alienRevealConfirmation; },
    get moveHighlightRocketId() { return uiRuntimeState.moveHighlightRocketId; },
    get pendingCardTriggerFreeMove() { return getPendingCardTriggerFreeMove(); },
    get industryFreeMoveState() { return uiRuntimeState.industryFreeMoveState; },
    get pendingCardCornerFreeMove() { return getPendingCardCornerFreeMove(); },
    get pendingActionEffectFlow() { return decisionState.actionEffectFlow; },
    get pendingScanTargetAction() { return decisionState.scanTargetAction; },
  };

  alienSpeciesRuntime = alienSpeciesRuntimeModule.createAlienSpeciesRuntime({
    decisionSessions,
    headless: headlessMode,
    actionHistory,
    aliens,
    amiba,
    aomomo,
    Array,
    banrenma,
    BANRENMA_PANEL_BONUS_EFFECT_TYPE,
    banrenmaBonusMarkerElements,
    beginAlienTraceBoardPlacement: (workingRoot, ...args) => beginAlienTraceBoardPlacementForRoot(workingRoot, ...args),
    beginCardSelection,
    beginEffectHistoryStep,
    beginQuickActionStep,
    blindDrawCardForPlayer,
    blockManualAiPendingInput,
    blockManualAiPendingInputIfNeeded,
    Boolean,
    buildAlienTraceEvent,
    buildPlutoMarkerContext,
    buildProbeLocationIndex,
    canPlaceAmibaTrace: (workingRoot, ...args) => canPlaceAmibaTraceForRoot(workingRoot, ...args),
    canPlaceAnyStateExtraTrace: (workingRoot, ...args) => canPlaceAnyStateExtraTraceForRoot(workingRoot, ...args),
    canPlaceAomomoTrace: (workingRoot, ...args) => canPlaceAomomoTraceForRoot(workingRoot, ...args),
    canPlaceBanrenmaTrace: (workingRoot, ...args) => canPlaceBanrenmaTraceForRoot(workingRoot, ...args),
    canPlaceChongTrace: (workingRoot, ...args) => canPlaceChongTraceForRoot(workingRoot, ...args),
    canPlaceFangzhouTrace: (workingRoot, ...args) => canPlaceFangzhouTraceForRoot(workingRoot, ...args),
    canPlaceJiuzheTrace: (workingRoot, ...args) => canPlaceJiuzheTraceForRoot(workingRoot, ...args),
    canPlaceRunezuFaceSymbol: (workingRoot, ...args) => canPlaceRunezuFaceSymbolForRoot(workingRoot, ...args),
    canPlaceRunezuTrace: (workingRoot, ...args) => canPlaceRunezuTraceForRoot(workingRoot, ...args),
    canPlaceStateTrace: (workingRoot, ...args) => canPlaceStateTraceForRoot(workingRoot, ...args),
    canPlaceYichangdianTrace: (workingRoot, ...args) => canPlaceYichangdianTraceForRoot(workingRoot, ...args),
    cardEffects,
    cards,
    chong,
    closeAlienTracePicker,
    completeCurrentActionEffect,
    completeQuickActionStep,
    continueAfterCardTriggerResolution,
    createActionLogImpactSnapshot,
    data,
    debugRuntimeController: {
      setDebugAlienTraceModeActive: (...args) => callDebugCommand("setDebugAlienTraceModeActive", args),
      toggleDebugAlienTraceMode: (...args) => callDebugCommand("toggleDebugAlienTraceMode", args),
      enableDebugAlienTraceModeForReveal: (...args) => callDebugCommand("enableDebugAlienTraceModeForReveal", args),
    },
    discardReservedCardIfFinished,
    document,
    els,
    endEffectHistoryStep,
    failMissingAlienTraceTargetPlayer: (workingRoot, ...args) => failMissingAlienTraceTargetPlayerForRoot(workingRoot, ...args),
    fangzhou,
    finishAutomaticRewardEffect,
    formatPlanetRewardGain,
    getAlienCardGainIrreversible,
    getAlienTraceActionPlayer: (workingRoot, ...args) => getAlienTraceActionPlayerForRoot(workingRoot, ...args),
    getCurrentActionEffect,
    getPendingOwnerFields,
    getPendingOwnerPlayer,
    getPlanetSectorCoordinate,
    getPlayerCompanyBaseIncome,
    getReadyChongTaskForReservedCard,
    getTargetPlayerOptions,
    hasActivePendingSubFlow,
    hasAlienTracePanelPlacementTarget,
    HISTORY_SOURCE_QUICK,
    historyCommands,
    incrementCompletedTaskCount,
    insertActionEffectsAfterCurrent,
    isActionEffectFlowActive,
    isPendingLockedForAiAutomation,
    jiuzhe,
    JIUZHE_THRESHOLD_CARD_EFFECT_TYPE,
    markActionPending,
    markCurrentActionIrreversible,
    Math,
    maybeContinueAlienRevealQueuedOpportunities,
    maybeContinuePendingTurnEndRevealFlow,
    maybeRestoreAlienLabPanelForTrace,
    Number,
    Object,
    openCardTaskCompletionPicker,
    openFangzhouTraceDestinationChoice: (workingRoot, ...args) => openFangzhouTraceDestinationChoiceForRoot(workingRoot, ...args),
    planetRewards,
    players,
    quickActionHistory,
    recordHistoryCommand,
    recordAlienTraceScore,
    recordQuickHistoryCommand,
    removeReservedCardToDiscard,
    removeRocketElement,
    renderActionEffectBar,
    renderPlayerHand,
    renderPlayerStats,
    renderReservedCards,
    renderRockets,
    renderRunezuBoardSymbols,
    renderStateReadout,
    RESOURCE_ICON_SRC,
    rocketActions,
    runezu,
    Set,
    setScanTargetActionLayout,
    settleCardTasksAfterEffect,
    shouldShowStateTraceSlots,
    skipActionEffectWithMessage,
    startCardEffectFlow,
    startScreenState,
    String,
    structuredClone,
    uiRuntimeState,
    updateActionButtons,
    window,
    yichangdian,
    yichangdianAnomalyMarkerElements,
  });

  if (!headlessMode) window.SetiAppEvents.bindAppEvents({
    window,
    document,
    state: appEventState,
    els,
    tech,
    data,
    aliens,
    aomomo,
    jiuzhe,
    yichangdian,
    fangzhou,
    banrenma,
    chong,
    amiba,
    runezu,
    techRenderContext,
    getRuleReadout: createStateSourceReadoutRoot,
    setStatusNote: setBrowserStatusNote,
    randomizeAll,
    startNewGameFromStartScreen,
    continueGameFromStartScreen,
    syncStartScreenDebugOption,
    syncStartScreenActionLogOption,
    handleStartAlienOptionChange,
    handleStartIndustryOptionChange,
    handleMainActionButtonClick,
    cancelTechSelection,
    confirmLandTargetPicker,
    cancelLandTargetPicker,
    toggleQuickPanel,
    passForCurrentPlayer,
    dispatchRuntimeAction: (request) => dispatchBrowserRuleInput(request),
    endCurrentTurn,
    undoPendingAction,
    runQuickTrade,
    runPlaceDataToComputer,
    confirmDataPlacement,
    cancelDataPlacePicker,
    skipPendingDataPlacement,
    handleDebugQuickSectorScanChoice,
    handleJiuzheCardChoice,
    handleJiuzheOpportunitySkip,
    handleYichangdianCardGainChoice,
    handleBanrenmaCardGainChoice,
    handleChongCardGainChoice,
    handleChongFossilChoice,
    handleAmibaCardGainChoice,
    handleAomomoCardGainChoice,
    handleAmibaSymbolChoice,
    handleAmibaTraceRemovalChoice,
    handleRunezuCardGainChoice,
    handleRunezuFaceSymbolChoice,
    handleRunezuSymbolBranchChoice,
    handleBanrenmaBonusChoice,
    handleBanrenmaCardConditionChoice,
    handleYichangdianCornerChoice,
    handleCardTriggerChoice,
    cancelCardTriggerChoice,
    confirmCardTaskCompletion,
    handleProbeSectorScanChoice,
    confirmProbeSectorScanSelection,
    handleProbeLocationRewardChoice,
    handleOptionalHandScanChoice,
    handleDrawnHandScanSkip,
    handleRemovePlanetMarkerChoice,
    handleHandCornerChoice,
    handleConditionalSectorChoice,
    handleDiscardIncomeCardChoice,
    confirmDiscardAnyForIncome,
    handlePayCreditChoice,
    handleFundamentalismExchangeChoice,
    handleDiscardCornerRepeatChoice,
    handleRemoveOrbitToProbeChoice,
    handlePiratesRaidLaunchChoice,
    handleReturnUnfinishedTaskChoice,
    handlePiratesRaidTechMarkerClick,
    confirmStrategyPassiveSlotChoice,
    cancelStrategyPassiveSlotChoice,
    confirmScanTarget,
    closeBanrenmaOpportunityDialog,
    closeJiuzheCardDialog,
    closeScanTargetPicker,
    beginJiuzheTraceGridPlacement,
    beginBanrenmaTraceGridPlacement,
    routeFangzhouAlienTraceGain,
    beginChongTraceGridPlacement,
    beginAmibaTraceGridPlacement,
    beginAomomoTraceGridPlacement,
    beginRunezuTraceGridPlacement,
    beginYichangdianTraceGridPlacement,
    renderAlienTracePickerColorStep,
    openFangzhouTraceUseChoice,
    handleFangzhouTraceDestinationChoice,
    handleFangzhouUnlockTraceChoice,
    confirmFangzhouCard2Unlock,
    beginFangzhouTraceGridPlacement,
    confirmAlienRevealNotice,
    handleStateTraceSlotPlacement,
    handleFangzhouTraceSlotPlacement,
    confirmAlienTracePlacement,
    closeAlienTracePicker,
    confirmBanrenmaTracePlacement,
    confirmYichangdianTracePlacement,
    confirmFangzhouTracePlacement,
    confirmChongTracePlacement,
    confirmAmibaTracePlacement,
    confirmAomomoTracePlacement,
    confirmRunezuTracePlacement,
    openRunezuFaceSymbolPlacement,
    confirmJiuzheTracePlacement,
    handleScanAction4Choice,
    closeScanAction4Picker,
    handleActionEffectButtonClick,
    skipCurrentActionEffect,
    executeFreeMoveForCardTrigger,
    executeIndustryFreeMove,
    executeFreeMoveForCardCorner,
    executeFreeMoveForScanAction4,
    executeCardMoveForEffect,
    moveRocket,
    handleBoardPointerDown,
    handleFinalScoreTileClick,
    openFinalResultDialog,
    downloadActionLogMarkdown,
    minimizeFinalResultDialog,
    closeFinalResultDialog,
    closeActionBriefing,
    openActionBriefingDetailLog,
    blockManualAiSharedOverlayInputIfNeeded,
    handleAiTakeoverFailsafe,
    handleForceSkipTurnFailsafe,
    setDebugOpen,
    setDebugPlayerMenuOpen,
    switchCurrentPlayerColor,
    rotateSolarOrbit,
    settleCardTasksAfterEffect: (...args) => settleCardTasksAfterEffect(...args),
    addDebugIncome,
    promptDebugGainCard,
    addDebugScore,
    toggleSectorWinDebug,
    toggleDebugAlienTraceMode,
    isDebugAlienTraceMode,
    revealJiuzheForDebug,
    focusJiuzheDebugCalibration,
    revealYichangdianForDebug,
    focusYichangdianDebugCalibration,
    revealFangzhouForDebug,
    focusFangzhouDebugCalibration,
    revealBanrenmaForDebug,
    focusBanrenmaDebugCalibration,
    revealChongForDebug,
    focusChongDebugCalibration,
    revealAmibaForDebug,
    focusAmibaDebugCalibration,
    revealAomomoForDebug,
    focusAomomoDebugCalibration,
    revealRunezuForDebug,
    openFangzhouCard1Dialog,
    handlePublicBlindDrawClick,
    handlePublicCardClick,
    selectPassReserveCard,
    confirmPassReserveSelection,
    dismissPassReserveSelectionOverlay,
    cancelCardSelection,
    confirmPublicScanSelection,
    cancelDiscardSelection,
    confirmPlayCardSelection: () => {
      const pending = getPendingPlayCardSelection();
      return pending?.card?.id
        ? dispatchBrowserRuleInput({
          kind: "standard_intent",
          family: "play_card",
          selector: { cardInstanceId: pending.card.id },
        })
        : confirmPlayCardSelection();
    },
    cancelPlayCardSelection,
    confirmHandCardPlayAction,
    confirmCardCornerQuickAction,
    cancelHandScanSelection,
    getCurrentPlayer,
    getInterfacePlayer,
    isAiAutomationInputLocked,
    blockManualAiAutomationInput,
    openJiuzheCardDialog,
    openBanrenmaCardConditionCompletionPicker,
    getReadyChongTaskForReservedCard,
    openChongTraceTaskCompletionPicker,
    openCardTaskCompletionPicker: (...args) => openCardTaskCompletionPicker(...args),
    confirmMovePayment,
    cancelMovePaymentSelection,
    isDiscardSelectionActive,
    handleHandCardDiscard,
    isMovePaymentSelectionActive,
    handleHandCardMovePayment,
    isHandScanSelectionActive,
    handleHandScanCardClick,
    isIndustryFutureSpanHandSelectionActive,
    handleIndustryFutureSpanHandClick,
    isIndustryHandSelectionActive,
    handleIndustryDeepspaceHandClick,
    isPlayCardSelectionActive,
    handlePlayCardSelect,
    handleHandCardCornerQuickAction,
    toggleCheatMode,
    confirmTechBlueSlotChoice,
    closeTechBlueSlotPicker,
    renderStateReadout,
    syncTechRenderContext,
    handleSupplyTechTileClick,
    setLogOpen,
    setReportTab,
    renderAlienPanels,
    renderSectorNebulaDataBoard,
    logAomomoDebugCoordinates,
    resize,
  });
  window.SetiAppBootstrap.initializeAppBootstrap({
    root: window,
    document,
    initializeShell: headlessMode ? null : function initializeShell() {
      setTokenAssetSizes();
      syncStartScreenDebugOption();
      syncStartScreenActionLogOption();
      syncStartScreenAlienOptions();
      syncStartScreenIndustryOptions();
      setDebugToolsEnabled(false);
      setReportTab("action");
      setLogOpen(false);
      updateStartScreenContinueButton();
    },
    startScreenState,
    savePersistentGameStateNow,
    normalizeAiDifficulty,
    uiRuntimeState,
    runAiAutoBattleBatch,
    publicApiContext: {
      structuredClone,
      solar,
      rocketActions,
      planetReferenceLayout,
      planetStats,
      abilities,
      tech,
      data,
      aliens,
      actionHistory,
      setupSelectionState,
      buildFinalResultPlayerSummaries,
      randomizeAll,
      rotateSolarOrbit,
      launchRocketForCurrentPlayer,
      orbitForCurrentPlayer,
      landForCurrentPlayer,
      addDebugIncome,
      addDebugScore,
      executeIncomeForCurrentPlayer,
      addDebugData,
      addDebugCardByInput,
      fillDebugNebulaData,
      toggleSectorWinDebug,
      beginSectorScan,
      openDebugQuickSectorScanPicker,
      runDebugQuickSectorScan,
      beginPublicDeckScan,
      beginHandScan,
      replaceNebulaDataForCurrentPlayer,
      switchCurrentPlayerColor,
      handleAiTakeoverFailsafe,
      handleForceSkipTurnFailsafe,
      runPlaceDataToComputer,
      analyzeDataForCurrentPlayer,
      handleFinalScoreTileClick,
      openAlienTracePicker,
      maybeRevealAlienAfterTrace,
      getCurrentPlayer,
      handleJiuzheRevealSideEffects,
      handleYichangdianRevealSideEffects,
      handleFangzhouRevealSideEffects,
      handleBanrenmaRevealSideEffects,
      handleChongRevealSideEffects,
      handleAmibaRevealSideEffects,
      handleAomomoRevealSideEffects,
      handleRunezuRevealSideEffects,
      renderAlienPanels,
      renderRockets,
      renderPlayerStats,
      renderStateReadout,
      revealJiuzheForDebug,
      revealYichangdianForDebug,
      revealFangzhouForDebug,
      revealBanrenmaForDebug,
      revealChongForDebug,
      revealAmibaForDebug,
      revealAomomoForDebug,
      revealRunezuForDebug,
      randomizeAliens,
      startNewGame,
      startInitialSelection,
      getInitialSelectionOffer,
      handleInitialSelectionCardClick,
      confirmInitialSelectionForCurrentPlayer,
      configureAiAutoBattle,
      configureAiStrategyWeights,
      resetAiStrategyWeights,
      applyAiStrategyTuning,
      getAiStrategyWeights,
      getAiStrategyTuningHistory,
      clearAiStrategyTuningHistory,
      getAiStrategyTuningRecommendation,
      applyAiStrategyTuningRecommendation,
      runAiAutoBattle,
      runAiAutoBattleBatch,
      runAiStrategyABTest,
      runAiStrategyTuningCycle,
      stopAiAutoBattle,
      runAiAutomationStep,
      runAiActionEffectStep,
      runAiNonTurnAutomationStep,
      runAiSelectedTurnAction,
      buildAiTurnActionCandidates,
      chooseInitialSelectionForAiPlayer,
      enumerateHeadlessTurnActions,
      executeAiTurnAction,
      submitHeadlessTurnAction,
      beginHeadlessCompositionDrain,
      inspectHeadlessComposition,
      enumerateHeadlessConditionalActions,
      executeHeadlessConditionalAction,
      getHeadlessDecisionOwnerState,
    advanceHeadlessDeterministicState,
    executeHeadlessCurrentActionEffect,
    skipHeadlessCurrentActionEffect,
      resolveAiAutomationToTurnBoundary,
      getAiAutoBattleProgress,
      getAiAutoBattleReport,
      getAiAutoBattleAnalysis,
      drawCardForCurrentPlayer,
      blindDrawCardForPlayer,
      beginCardSelection,
      beginDiscardSelection,
      beginPlayCardSelection,
      beginIncomeForCurrentPlayer,
      cancelCardSelection,
      cancelDiscardSelection,
      cancelPlayCardSelection,
      pickPublicCardForCurrentPlayer,
      handleHandCardPlay: confirmHandCardPlayAction,
      discardCardFromCurrentPlayer,
      undoPendingAction,
      endCurrentTurn,
      passForCurrentPlayer,
      runAction,
      dispatchRuntimeAction: (request) => dispatchBrowserRuleInput(request),
      runQuickTrade,
      toggleQuickPanel,
      moveRocket,
      moveActiveRocket,
      getBoardPointFromClientPosition,
      getPolarPointFromClientPosition,
      createRocketSnapshot,
      buildPlanetOrbitLandReferenceData,
      syncPlanetOrbitLandMarkers,
      createActionContext: createReadoutActionContext,
      getPlanetsReferencePointFromClientPosition,
      getPlanetsReferenceDimensions,
      renderRocketElement,
      updateActionButtons,
      getRecoverableActionLog,
      createActionLogRecoveryPackage,
      getActionLogMarkdown,
      downloadActionLogMarkdown,
      createGameRecoverySnapshot,
      applyGameRecoverySnapshot,
      recoverFromActionLog,
      toggleCheatMode,
      researchTechForCurrentPlayer,
      getBrowserProjection: () => residentProjectionAdapter.projectSource({
        viewer: getResidentViewer(),
      }),
      browserServices: residentBrowserServices?.createPublicFacade?.() || null,
    },
  });
})();

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
    ruleCompositionModule,
    runtimeModule,
    refreshModule,
    renderRuntimeModule,
    playerStatsUiModule,
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
    scoreSourceRuntimeModule,
    alienUiModule,
    browserHostModule,
  } = dependencies;
  const stateStoreModule = window.SetiStateStore;
  const hostStateSourceModule = window.SetiHostStateSource;
  const highCouplingStateModule = window.SetiHighCouplingState;
  if (!stateStoreModule || !hostStateSourceModule || !highCouplingStateModule || !ruleCompositionModule) {
    throw new Error("Missing SETI StateStore runtime dependencies");
  }
  const document = window.document;
  const Image = window.Image;
  const Blob = window.Blob;
  const requestAnimationFrame = window.requestAnimationFrame.bind(window);
  const getComputedStyle = window.getComputedStyle.bind(window);

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
    return finalScoreAiRuntime?.runAiFinalScoreMarkDecision(...args) || null;
  }
  const { SCORE_SOURCE_KEYS } = scoreSourceRuntimeModule;
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
  const browserDomainTargets = () => ({
    scan_flow: scanFlowHelpers,
    alien_ui: alienUiHelpers,
    turn_end: turnEndFlow,
    action_interaction: actionInteractionRuntime,
    alien_runtime: alienRuntimeHelpers,
    alien_species: alienSpeciesRuntime,
    card_runtime: cardRuntime,
    ai_controller: aiController,
    card_trigger: cardTriggerRuntime,
    industry_runtime: industryRuntime,
    tech_runtime: techRuntime,
    income_runtime: incomeRuntime,
  });
  const browserDomainCommandPort = browserHostModule.browserServices.createLegacyDomainCommandPort({
    getTarget: (domain) => browserDomainTargets()[domain] || null,
    clonePresentation: cloneResidentPresentation,
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
  });
  const {
    executeBrowserDomainCommand,
    callBrowserDomainCommand,
    bindBrowserDomainCommand,
    bindDomainCommands,
    callHandFlowCommand,
    callDebugCommand,
    setBrowserStatusNote,
  } = browserDomainCommandPort;
  const {
    handleConditionalSectorChoice,
    handleDiscardIncomeCardChoice,
    confirmDiscardAnyForIncome,
    handlePayCreditChoice,
    handleFundamentalismExchangeChoice,
    handleDiscardCornerRepeatChoice,
    handleRemoveOrbitToProbeChoice,
  } = browserDomainCommandPort.bindEffectChoiceCommands([
    "handleConditionalSectorChoice",
    "handleDiscardIncomeCardChoice",
    "confirmDiscardAnyForIncome",
    "handlePayCreditChoice",
    "handleFundamentalismExchangeChoice",
    "handleDiscardCornerRepeatChoice",
    "handleRemoveOrbitToProbeChoice",
  ]);
  const {
    executeSectorXScanEffect,
    maybeReturnPlayedCardToHandAfterSectorScan,
    getPlanetName,
    markerBelongsToPlayer,
    playerHasOwnOrbitMarkerAtPlanet,
    markerOwnerLabel,
    buildPlanetMarkerRemovalChoices,
    removePlanetMarkerForChoice,
    handleRemovePlanetMarkerChoice,
    handleScanAction4Choice,
    formatPlanetRewardGain,
    finishAutomaticRewardEffect,
    buildPlutoRewardEffectsForAction,
    buildPlutoChoiceRewardSummary,
    handleHandCornerChoice,
    getSectorXsMatchingCondition,
    sectorXHasAvailableScanTarget,
    isAlienFamilyCard,
    handleReturnUnfinishedTaskChoice,
    countOwnedTechByType,
    enrichScanResultEvents,
    getPlayerCompanyBaseIncome,
    insertActionEffectsAfterCurrent,
    insertActionEffectsBeforeCurrent,
    handleOptionalHandScanChoice,
    openYichangdianCornerPicker,
    handleYichangdianCornerChoice,
    applyAomomoScanCostAndBonus,
  } = browserDomainCommandPort.bindEffectExecutorCommands([
    "executeSectorXScanEffect",
    "maybeReturnPlayedCardToHandAfterSectorScan",
    "getPlanetName",
    "markerBelongsToPlayer",
    "playerHasOwnOrbitMarkerAtPlanet",
    "markerOwnerLabel",
    "buildPlanetMarkerRemovalChoices",
    "removePlanetMarkerForChoice",
    "handleRemovePlanetMarkerChoice",
    "handleScanAction4Choice",
    "formatPlanetRewardGain",
    "finishAutomaticRewardEffect",
    "buildPlutoRewardEffectsForAction",
    "buildPlutoChoiceRewardSummary",
    "handleHandCornerChoice",
    "getSectorXsMatchingCondition",
    "sectorXHasAvailableScanTarget",
    "isAlienFamilyCard",
    "handleReturnUnfinishedTaskChoice",
    "countOwnedTechByType",
    "enrichScanResultEvents",
    "getPlayerCompanyBaseIncome",
    "insertActionEffectsAfterCurrent",
    "insertActionEffectsBeforeCurrent",
    "handleOptionalHandScanChoice",
    "openYichangdianCornerPicker",
    "handleYichangdianCornerChoice",
    "applyAomomoScanCostAndBonus",
  ]);
  const turnEndPort = turnEndFlowModule.createTurnEndPort({
    getRuntime: () => turnEndFlow,
    dispatchCommand: (name, args) => callBrowserDomainCommand("turn_end", name, args),
  });
  const {
    createPassEvent, endCurrentTurn, executePassFirstRotateEffect, executePassHandLimitEffect,
    maybeContinueAlienRevealQueuedOpportunities, maybeContinuePendingTurnEndRevealFlow,
    maybeResumeTurnEndAfterReveal, passForCurrentPlayer,
  } = turnEndPort;
  const debugPort = debugRuntimeModule.createDebugPort({
    dispatchCommand: (name, args) => callDebugCommand(name, args),
    getRuleReadout: () => createStateSourceReadoutRoot(),
  });
  const {
    addDebugCardByInput, addDebugData, addDebugIncome, addDebugScore, fillDebugNebulaData,
    fillNebulaDataBoard, focusAomomoDebugCalibration, focusAmibaDebugCalibration,
    focusBanrenmaDebugCalibration, focusChongDebugCalibration, focusFangzhouDebugCalibration,
    focusJiuzheDebugCalibration, focusYichangdianDebugCalibration, getFailsafePendingOwnerPlayer,
    handleAiTakeoverFailsafe, handleDebugQuickSectorScanChoice, handleForceSkipTurnFailsafe,
    logAomomoDebugCoordinates, openDebugQuickSectorScanPicker, promptDebugGainCard,
    renderDebugPlayerSwitch, revealAmibaForDebug, revealAomomoForDebug, revealBanrenmaForDebug,
    revealChongForDebug, revealFangzhouForDebug, revealJiuzheForDebug, revealRunezuForDebug,
    revealYichangdianForDebug, runDebugQuickSectorScan, selectDefaultRocketForCurrentPlayer,
    setDebugOpen, setDebugPlayerMenuOpen, switchCurrentPlayerColor, toggleSectorWinDebug,
  } = debugPort;
  const actionInteractionPort = actionInteractionRuntimeModule.createActionInteractionPort({
    getRuntime: () => actionInteractionRuntime,
    dispatchCommand: (name, args) => callBrowserDomainCommand("action_interaction", name, args),
    getPendingDataPlacementDecision: (...args) => getPendingDataPlacementDecision(...args),
    submitActiveDecision: (...args) => submitActiveCardDecision(...args),
  });
  const {
    getPlutoReservedCards, ensurePlutoCardEffectState, getPlutoActionState, addPlutoMarker,
    removePlutoMarker, collectPlutoMarkers, buildPlutoMarkerContext, playerHasOwnPlutoLanding,
    buildPlutoMarkerRemovalChoices, getPlutoCandidateRockets, getPlutoActionCost, getAvailablePlutoAction,
    executePlutoAction, getCurrentPlanetActionPlacement, getPlutoChoiceActionLabel, formatPlutoChoiceLabel,
    openPlutoActionChoicePicker, scheduleRenderMoveArrows, clearMoveRocketHighlight, activateMoveMode,
    deactivateMoveMode, closeDataPlacePicker, isDataPoolFull, getAutoDataPlacementCheck,
    openDataPlacePicker, openAutoDataPlacementPrompt, continuePendingDataPlacementAfterBonus,
    skipPendingDataPlacement, cancelDataPlacePicker, confirmDataPlacement,
  } = actionInteractionPort;
  let getBrowserCommittedContext = () => ({
    gameId: "seti-browser-runtime",
    rulesetVersion: "seti-runtime-v1",
    seed: "browser-host",
    rngState: { owner: "browser", state: null },
    sequences: {},
  });
  const browserWorkingStateAdapter = runtimeModule.createBrowserWorkingStateAdapter({
    initialGameState: initialGameStateModule,
    ruleModules: browserRuleModules,
    defaultInitialPlayerColor: players.DEFAULT_PLAYER_COLOR,
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    finalScoreIds: FINAL_SCORE_IDS,
    restoreSequences(sequences) {
      if (Number.isSafeInteger(sequences.card)) cards.restoreNextCardInstanceSequence(sequences.card);
      if (Number.isSafeInteger(sequences.handCard)) players.restoreNextHandCardSequence(sequences.handCard);
      if (Number.isSafeInteger(sequences.finalMark)) finalScoring.restoreNextFinalMarkSequence(sequences.finalMark);
      if (Number.isSafeInteger(sequences.dataToken)) data.restoreNextDataTokenSequence(sequences.dataToken);
      if (Number.isSafeInteger(sequences.nebulaToken)) data.restoreDeterministicSequences(sequences);
      if (Number.isSafeInteger(sequences.historyStep)) actionHistoryModule.restoreNextHistoryStepSequence(sequences.historyStep);
    },
  });
  const {
    createWorkingState: createBrowserWorkingState,
    restoreWorkingState: restoreBrowserWorkingState,
    validateSessionBoundary: validateBrowserSessionBoundary,
  } = browserWorkingStateAdapter;
  const actionContextFactory = actionRuntimeModule.createActionContextFactory({
    buildPlutoMarkerContext: (...args) => buildPlutoMarkerContext(...args),
    getNormalTokenAssetForPlayer: (...args) => getNormalTokenAssetForPlayer(...args),
    getEarthSectorCoordinate: (...args) => getEarthSectorCoordinate(...args),
    solar,
    rotateSolarOrbit: (...args) => rotateSolarOrbitForRoot(...args),
    drawBasicCardToPlayer: (...args) => drawBasicCardToPlayerForRoot(...args),
    drawBasicCard: (...args) => drawCardForCurrentPlayerForRoot(...args),
    blindDrawCard: (...args) => blindDrawCardForPlayerForRoot(...args),
    rocketActions,
    cards,
    beginCardSelection: (...args) => beginCardSelectionForRoot(...args),
    beginDiscardSelection: (...args) => handFlowHelpers.beginDiscardSelection(...args),
    beginIncome: (...args) => beginIncomeForCurrentPlayerForRoot(...args),
    getPlayerCompanyBaseIncome: (...args) => getPlayerCompanyBaseIncome(...args),
    players,
    createReadoutRoot: () => createStateSourceReadoutRoot(),
  });
  const {
    createActionContext: createActionContextForWorkingRoot,
    createReadoutActionContext,
  } = actionContextFactory;
  const primaryActionUiRuntime = actionInteractionRuntimeModule.createPrimaryActionUiRuntime({
    runAction: (...args) => runAction(...args),
    canStartMainAction: (...args) => canStartMainAction(...args),
    getMainActionStartBlockReason: (...args) => getMainActionStartBlockReason(...args),
    setStatusNote: (...args) => setBrowserStatusNote(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
    createActionContext: (...args) => createActionContextForWorkingRoot(...args),
    getRuleReadout: () => createStateSourceReadoutRoot(),
    abilities,
    getCurrentPlanetActionPlacement: (...args) => getCurrentPlanetActionPlacement(...args),
    getAvailablePlutoAction: (...args) => getAvailablePlutoAction(...args),
    openPlutoActionChoicePicker: (...args) => openPlutoActionChoicePicker(...args),
    executePlutoAction: (...args) => executePlutoAction(...args),
    requestLandTargetPicker: (...args) => requestLandTargetPicker(...args),
    renderPlayerStats: (...args) => renderPlayerStats(...args),
    updateActionButtons: (...args) => updateActionButtons(...args),
    isAiInputLocked: (...args) => isAiAutomationInputLocked(...args),
    blockManualAiInput: (...args) => blockManualAiAutomationInput(...args),
    getHighlightedRocketId: () => uiRuntimeState.moveHighlightRocketId,
    enumerateActions: (...args) => ruleComposition.inputPort.enumerateActions(...args),
    submitQuickAction: (...args) => ruleComposition.inputPort.submitQuickAction(...args),
    beginMovePaymentSelection: (...args) => beginMovePaymentSelection(...args),
  });
  const {
    launchRocketForCurrentPlayer,
    orbitForCurrentPlayer,
    landForCurrentPlayer,
    moveRocket,
    moveActiveRocket,
  } = primaryActionUiRuntime;
  const solarRotationRuntime = actionInteractionRuntimeModule.createSolarRotationRuntime({
    solar,
    settleRocketsAfterSolarRotation: (...args) => abilities.rocket.settleRocketsAfterSolarRotation(...args),
    triggerAnomalyForEarthX: (...args) => triggerYichangdianAnomalyForEarthX(...args),
    getEarthSectorCoordinate: (...args) => getEarthSectorCoordinate(...args),
    renderWheels: (...args) => renderWheels(...args),
    renderSectorBoard: (...args) => renderSectorNebulaDataBoard(...args),
    renderRotateStateToken: (...args) => renderRotateStateToken(...args),
    refreshBoardState: (...args) => refreshHelpers.refreshBoardState(...args),
    refreshPlayerPanels: (...args) => refreshHelpers.refreshPlayerPanels(...args),
    refreshAfterPendingChange: (...args) => refreshHelpers.refreshAfterPendingChange(...args),
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
  });
  const { rotateSolarOrbitForRoot, rotateSolarOrbit } = solarRotationRuntime;
  const {
    getMarkedNebulaIdsFromEvents,
    resultHasSignalMarkedEvent,
    getFlowMarkedNebulaIds,
    effectFlowMarkedNebula,
  } = effectFlowModule;

  const ruleComposition = ruleCompositionModule.createRuleComposition({
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
          return cloneResidentPresentation(
            recoverAiIdleActionEffectStepForRoot(workingRoot, ...(command.args || []))
            || { ok: true, idle: true, message: "当前没有待恢复的行动效果" },
          );
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
        case "land_target_open":
          return { ok: true, value: cloneResidentPresentation(openLandTargetPicker(workingRoot, command.options)) };
        case "land_target_cancel":
          return { ok: true, value: cloneResidentPresentation(cancelLandTargetPicker(workingRoot)) };
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
          return { ok: true, value: cloneResidentPresentation(actionInteractionRuntime.placeDataToBlueSlot(workingRoot, command.blueSlot)) };
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
        case "simulation_enumerate_turn_actions":
          return { ok: true, value: enumerateSimulationTurnActionsForRoot(workingRoot) };
        case "simulation_enumerate_conditional_actions":
          return { ok: true, value: enumerateSimulationConditionalActionsForRoot(workingRoot) };
        case "simulation_execute_conditional_action":
          return cloneResidentPresentation(
            conditionalActionExecutor.execute(workingRoot, command.action?.standardAction || command.action),
          );
        case "simulation_advance_deterministic":
          return advanceSimulationDeterministicStateImpl(workingRoot) || { ok: true, progressed: false };
        case "simulation_execute_current_effect":
          return executeSimulationCurrentActionEffectImpl(workingRoot) || { ok: true, progressed: false };
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
            const conditional = enumerateSimulationConditionalActionsForRoot(workingRoot);
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
                delete workingRoot.match.probeSectorScanContinuation;
              }
              if (candidates[0]?.target?.kind === "probe-location-reward") {
                delete workingRoot.match.probeLocationRewardContinuation;
              }
              if (candidates[0]?.target?.kind === "sector-scan-target") {
                closeScanTargetPickerForRoot(workingRoot);
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
            const turnCandidates = enumerateSimulationTurnActionsForRoot(workingRoot);
            if (turnCandidates.length || workingRoot.turnState.gameEnded) {
              return {
                ok: true,
                boundary: workingRoot.turnState.gameEnded ? "terminal" : "turn_action",
                decisionType: "turn_action",
                actorPlayer: players.getCurrentPlayer(workingRoot.playerState),
                candidates: turnCandidates,
              };
            }
            const currentEffect = getCurrentActionEffect(workingRoot);
            return {
              ok: true,
              boundary: "draining",
              decisionType: null,
              candidates: [],
              actionEffectActive: isActionEffectFlowActive(workingRoot),
              currentEffect: structuredClone(currentEffect || null),
            };
          },
          executeDeterministic(workingRoot, boundary) {
            const deterministic = advanceSimulationDeterministicStateImpl(workingRoot);
            if (deterministic?.progressed) {
              return {
                ...deterministic,
                ok: deterministic.ok !== false,
                events: [{ type: "standard_action_deterministic_advance" }],
              };
            }
            if (boundary?.actionEffectActive) {
              const effectResult = executeSimulationCurrentActionEffectImpl(workingRoot);
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
              code: "SIMULATION_UNSUPPORTED_PENDING",
              message: "存在未迁移的 simulation pending，Composition 拒绝 resolver/recover/skip fallback",
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
  const browserRuleLifecycle = ruleComposition.lifecycle;
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
  const legacyRuleInputDispatcher = browserHostModule.inputAdapter.createLegacyRuleInputDispatcher({
    standardActionSchemaVersion: standardActionModule.SCHEMA_VERSION,
    inspect: (...args) => ruleComposition.inspect(...args),
    createRecoverySnapshot: (...args) => createGameRecoverySnapshot(...args),
    enumerateActions: (...args) => ruleComposition.inputPort.enumerateActions(...args),
    dispatchRuntimeAction: (...args) => actionRuntimeController.dispatchAction(...args),
    submitQuickAction: (...args) => ruleComposition.inputPort.submitQuickAction(...args),
    submitAction: (...args) => ruleComposition.inputPort.submitAction(...args),
  });
  const dispatchBrowserRuleInput = legacyRuleInputDispatcher.dispatch;
  const initialSelectionHost = startScreenModule.createInitialSelectionHost({
    getActionRuntime: () => actionRuntimeController,
    getRuleReadout: () => createStateSourceReadoutRoot(),
    submitHostCommand: (command) => ruleComposition.inputPort.submitHostCommand(command),
  });
  const {
    canConfirm: canConfirmInitialSelection,
    confirm: confirmInitialSelectionForCurrentPlayer,
    getCardFromOffer: getCardFromInitialOffer,
    getOffer: getInitialSelectionOffer,
    getPlayerIds: getInitialSelectionPlayerIds,
    isActive: isInitialSelectionActive,
    isConfirmed: isInitialSelectionConfirmed,
    selectCard: handleInitialSelectionCardClick,
    start: startInitialSelection,
  } = initialSelectionHost;
  const resolveInitialSelectionEffects = actionRuntimeModule.createInitialSelectionEffectsResolver({
    initialCards,
    createActionContext: (...args) => createActionContextForWorkingRoot(...args),
    getPlayerIds: (...args) => getInitialSelectionPlayerIds(...args),
    resolveCompletedSectorSettlements: (...args) => resolveCompletedSectorSettlements(...args),
    recordScoreSources: (...args) => recordInitialSelectionScoreSources(...args),
  });
  const runtime = runtimeModule.createRuntime({
    aiDifficulty: AI_DIFFICULTY_LAUGHABLE,
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    alienTypeIds: aliens.ALIEN_TYPE_IDS || [],
    industryCardFiles: INDUSTRY_CARD_FILES,
  });
  let turnFlowController = null;
  const turnHostRuntime = turnFlowModule.createTurnHostRuntime({
    getController: () => turnFlowController,
    getRuleReadout: () => createStateSourceReadoutRoot(),
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
    newGame: (...args) => browserRuleLifecycle.newGame(...args),
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    defaultInitialPlayerColor: DEFAULT_INITIAL_PLAYER_COLOR,
    finalScoreIds: FINAL_SCORE_IDS,
    playerColorIds: players.PLAYER_COLOR_IDS,
    normalizeAiDifficulty: (value) => startScreenModule.normalizeAiDifficulty(value, {
      weakStartValue: AI_DIFFICULTY_WEAK_START,
      defaultValue: AI_DIFFICULTY_LAUGHABLE,
    }),
  });
  const {
    getActiveOrderedPlayerIds, getRoundOrderPlayerIds, setTurnStatePlayerOrder,
    randomizePlayerTurnOrder, beginNextRound, getDisplayedTurnNumber, getActionCycleNumber,
    advanceTurnAfterPlayerAction, startNewGame, randomizeAll, normalizeAiDifficulty,
  } = turnHostRuntime;
  const browserMatchRuntime = runtimeModule.createBrowserMatchRuntime({
    createReadoutRoot: () => createStateSourceReadoutRoot(),
    uiRuntimeState: runtime.ui,
  });
  const {
    getActionEffectFlow, setActionEffectFlow, getPendingDataPlacementDecision,
    getPendingLandTargetDecision, getPendingAlienTraceDecision, getPendingPiratesRaidDecision,
    getPendingStrategySlotDecision, getPendingIndustryAbilityDecision, getPublicScanQueueSession,
    getPendingProbeSectorScanDecision, getPendingProbeLocationRewardDecision,
    getPendingHandScanDecision, getPendingScanTargetDecision, getPendingCardMoveDecision,
    getPendingScanFreeMoveDecision, getPendingIndustryFreeMoveDecision,
    hasTurnEndRevealContinuation, getPendingCardCornerFreeMove, getPendingCardTriggerFreeMove,
    getPendingCardTriggerAction, getPendingCardTaskCompletion, getPendingPassReserveSelection,
    getPendingMovePayment, getPendingDiscardDecision, getPendingCardSelectionDecision,
    setPendingCardSelectionDecision,
  } = browserMatchRuntime;
  const pendingSubFlowRuntime = effectFlowModule.createPendingSubFlowRuntime({
    getPendingScanTargetDecision, getPendingProbeSectorScanDecision,
    getPendingProbeLocationRewardDecision, getPublicScanQueueSession,
    getPendingHandScanDecision, getPendingPassReserveSelection,
    isCardSelectionActive: (...args) => isCardSelectionActive(...args),
    getActionEffectFlow, isCardTriggerPickSelectionActive: (...args) => isCardTriggerPickSelectionActive(...args),
    getPendingCardTriggerAction, getPendingCardTaskCompletion,
    hasAlienDecision: () => Boolean(
      getPendingJiuzheCardPlay() || getPendingYichangdianCardGain() || getPendingYichangdianCornerAction()
      || getPendingBanrenmaCardGain() || getPendingBanrenmaOpportunity() || getPendingChongCardGain()
      || getPendingChongFossilChoice() || getPendingAmibaCardGain() || getPendingAmibaSymbolChoice()
      || getPendingAmibaTraceRemoval() || getPendingAomomoCardGain() || getPendingRunezuCardGain()
      || getPendingRunezuSymbolBranch() || getPendingRunezuFaceSymbolPlacement()
    ),
    getPendingStrategySlotDecision, getPendingPiratesRaidDecision,
    getPendingCardTriggerFreeMove, getPendingCardCornerFreeMove,
    isScanAction4Open: () => Boolean(els.scanAction4Overlay && !els.scanAction4Overlay.hidden),
    isLandTargetOpen: () => Boolean(els.landTargetOverlay && !els.landTargetOverlay.hidden),
    isAlienTraceOpen: () => Boolean(
      els.alienTraceOverlay && !els.alienTraceOverlay.hidden
      && runtime.ui.alienTracePickerState?.mode !== "reveal-confirm"
    ),
    getPendingCardMoveDecision, getPendingScanFreeMoveDecision, getPendingDataPlacementDecision,
    isMovePaymentSelectionActive: (...args) => isMovePaymentSelectionActive(...args),
    isDataPlaceOpen: () => Boolean(els.dataPlaceOverlay && !els.dataPlaceOverlay.hidden),
    getPendingIndustryAbilityDecision, getPendingIndustryFreeMoveDecision,
    isIndustryHandSelectionActive: (...args) => isIndustryHandSelectionActive(...args),
    rollbackPendingIndustryQuickAction: (...args) => rollbackPendingIndustryQuickAction(...args),
    cancelStrategyPassiveSlotChoiceForRoot: (...args) => cancelStrategyPassiveSlotChoiceForRoot(...args),
    clearMoveRocketHighlight: (...args) => clearMoveRocketHighlight(...args),
    deactivateMoveMode: (...args) => deactivateMoveMode(...args),
    finishIndustryAbilityFlowForRoot: (...args) => finishIndustryAbilityFlowForRoot(...args),
    commitIrreversibleIndustryQuickAction: (...args) => commitIrreversibleIndustryQuickAction(...args),
    renderPlayerStats: (...args) => renderPlayerStats(...args),
    renderPublicCards: (...args) => renderPublicCards(...args),
    renderPlayerHand: (...args) => renderPlayerHand(...args),
    updateActionButtons: (...args) => updateActionButtons(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
    cancelActiveEffectSubFlowsForRoot: (...args) => cancelActiveEffectSubFlowsForRoot(...args),
    cancelMovePaymentSelection: (...args) => cancelMovePaymentSelection(...args),
    cancelDataPlacePicker: (...args) => cancelDataPlacePicker(...args),
    closeDataPlacePicker: (...args) => closeDataPlacePicker(...args),
  });
  const {
    hasActiveEffectSubFlow,
    hasActivePendingSubFlow,
    cancelActivePendingSubFlowsForRoot,
  } = pendingSubFlowRuntime;
  const PIRATES_RAID_DECISION = "pirates_raid_placement";
  const STRATEGY_SLOT_DECISION = "strategy_passive_slot";
  const landTargetPicker = actionInteractionRuntimeModule.createLandTargetPicker({
    document,
    els,
    dispatchHostCommand: (command) => ruleComposition.inputPort.submitHostCommand(command),
    submitChoice: (choiceIndex) => confirmLandTargetChoice(choiceIndex),
    getPendingOwnerFields: (...args) => getPendingOwnerFields(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
  });
  const closeLandTargetPicker = landTargetPicker.close;
  const cancelLandTargetPicker = landTargetPicker.cancel;
  const openLandTargetPicker = landTargetPicker.open;
  const requestLandTargetPicker = landTargetPicker.request;
  const confirmLandTargetPicker = landTargetPicker.confirm;
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
    getSimulationConditionalPlayer,
    getPlayerById,
    cards,
    players,
    getPublicScanChoicesForCard,
    getPendingPassReserveSelection,
    getPendingCardTriggerAction,
    getPendingCardTaskCompletion,
    getPassReserveSelectionCards: (workingRoot, ...args) => getPassReserveSelectionCardsForRoot(workingRoot, ...args),
    isMovePaymentCard,
    isTechTilePickingActive,
    tech,
    industry,
    getResearchTechSelectionOptions: (workingRoot) => getResearchTechSelectionOptionsForRoot(workingRoot),
    isTechTileOwnedByOtherPlayer: (workingRoot, ...args) => (
      isTechTileOwnedByOtherPlayerForRoot(workingRoot, ...args)
    ),
    isActionEffectFlowActive,
    skipCurrentActionEffect: (workingRoot) => skipCurrentActionEffectForRoot(workingRoot),
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
    getPendingStrategySlotDecision,
    isFutureSpanEligibleHandCard,
    getPublicCardMultiSelectMinSelectable,
    getPublicScanMinSelectable,
    getPublicCardSelectedSlots: () => uiRuntimeState.publicCardSelectedSlots || [],
    allowsBlindDrawInSelection,
    canBlindDraw,
    getPendingLandTargetDecision,
    getAlienTraceContinuation: (workingRoot) => workingRoot.match?.alienTraceContinuation || null,
    getAlienTracePickerState: () => uiRuntimeState.alienTracePickerState || null,
    abilities,
    createActionContext: createReadoutActionContext,
    getFangzhouUnlockableTraceTypes: (workingRoot, ...args) => getFangzhouUnlockableTraceTypesForRoot(workingRoot, ...args),
    hasAlienTracePanelPlacementTarget: (workingRoot, ...args) => hasAlienTracePanelPlacementTargetForRoot(workingRoot, ...args),
    getAlienTraceChoiceSlotIds: (_workingRoot, ...args) => getAlienTraceChoiceSlotIds(...args),
    canPlaceStateTrace: (workingRoot, ...args) => canPlaceStateTraceForRoot(workingRoot, ...args),
    aliens,
    handleConditionalSectorChoice,
    handleChongFossilChoice,
    confirmProbeSectorScanSelection,
    handleRunezuSymbolBranchChoice,
    handleRunezuFaceSymbolChoice,
    handleAmibaSymbolChoice,
    handleFinalScoreTileClick,
    handleSupplyTechTileClick: (workingRoot, ...args) => handleSupplyTechTileClickForRoot(workingRoot, ...args),
    confirmTechBlueSlotChoice: (workingRoot, ...args) => confirmTechBlueSlotChoiceForRoot(workingRoot, ...args),
    cancelTechSelection: (workingRoot, ...args) => cancelTechSelectionForRoot(workingRoot, ...args),
    handleFangzhouTraceDestinationChoice: (workingRoot, ...args) => handleFangzhouTraceDestinationChoiceForRoot(workingRoot, ...args),
    handleFangzhouUnlockTraceChoice: (workingRoot, ...args) => handleFangzhouUnlockTraceChoiceForRoot(workingRoot, ...args),
    handleDiscardCornerRepeatChoice,
    handleReturnUnfinishedTaskChoice,
    handleRemoveOrbitToProbeChoice,
    handleRemovePlanetMarkerChoice,
    confirmDataPlacement: (workingRoot, ...args) => actionInteractionRuntime.confirmDataPlacement(workingRoot, ...args),
    skipPendingDataPlacement: (workingRoot) => actionInteractionRuntime.skipPendingDataPlacement(workingRoot),
    handleDiscardIncomeCardChoice,
    confirmDiscardAnyForIncome,
    handlePayCreditChoice,
    confirmScanTarget: (workingRoot, ...args) => scanFlowHelpers.confirmScanTarget(workingRoot, ...args),
    handleDrawnHandScanSkip: (workingRoot) => scanFlowHelpers.handleDrawnHandScanSkip(workingRoot),
    confirmPassReserveSelection: (workingRoot, ...args) => confirmPassReserveSelectionForRoot(workingRoot, ...args),
    handleCardTriggerChoice: (workingRoot, ...args) => handleCardTriggerChoiceForRoot(workingRoot, ...args),
    cancelCardTriggerChoice: (workingRoot, ...args) => cancelCardTriggerChoiceForRoot(workingRoot, ...args),
    confirmCardTaskCompletion: (workingRoot, ...args) => confirmCardTaskCompletionForRoot(workingRoot, ...args),
    handleHandScanCardClick: (workingRoot, ...args) => scanFlowHelpers.handleHandScanCardClick(workingRoot, ...args),
    executeCardMoveForEffect: (workingRoot, ...args) => executeCardMoveForEffectForRoot(workingRoot, ...args),
    executeFreeMoveForCardTrigger: (workingRoot, ...args) => executeFreeMoveForCardTriggerForRoot(workingRoot, ...args),
    restoreObjectSnapshot,
    clearMoveRocketHighlight,
    deactivateMoveMode,
    continueAfterCardTriggerResolution: (workingRoot, ...args) => continueAfterCardTriggerResolutionForRoot(workingRoot, ...args),
    finishCurrentCardMoveEffectEarly,
    executeFreeMoveForCardCorner: (workingRoot, ...args) => executeFreeMoveForCardCornerForRoot(workingRoot, ...args),
    executeIndustryFreeMove: (workingRoot, ...args) => executeIndustryFreeMoveForRoot(workingRoot, ...args),
    settleCardTasksAfterEffect,
    finishIndustryAbilityFlow: (workingRoot, ...args) => finishIndustryAbilityFlowForRoot(workingRoot, ...args),
    resolveMovePaymentDecision: (...args) => resolveMovePaymentDecision(...args),
    confirmStrategyPassiveSlotChoice,
    finalizePendingDiscardSelection: (workingRoot, ...args) => handFlowHelpers.finalizePendingDiscardSelection(workingRoot, ...args),
    cancelDiscardSelection: (workingRoot) => handFlowHelpers.cancelDiscardSelection(workingRoot),
    handlePublicCardClick: (workingRoot, ...args) => handlePublicCardClickForRoot(workingRoot, ...args),
    confirmPublicCornerDiscardSelection: (workingRoot) => confirmPublicCornerDiscardSelectionForRoot(workingRoot),
    confirmPublicScanSelection: (workingRoot) => scanFlowHelpers.confirmPublicScanSelection(workingRoot),
    handleIndustryDeepspaceHandClick: (workingRoot, ...args) => industryRuntime.handleIndustryDeepspaceHandClick(workingRoot, ...args),
    handleIndustryFutureSpanHandClick: (workingRoot, ...args) => industryRuntime.handleIndustryFutureSpanHandClick(workingRoot, ...args),
    drawCardForCurrentPlayer: (workingRoot, ...args) => drawCardForCurrentPlayerForRoot(workingRoot, ...args),
    confirmLandTargetChoice: (workingRoot, choiceIndex) => confirmLandTargetChoiceForRoot(workingRoot, choiceIndex),
    handleStateTraceSlotPlacement: (workingRoot, ...args) => handleStateTraceSlotPlacementForRoot(workingRoot, ...args),
  }));
  const conditionalActionExecutor = conditionalActionExecutorModule.createConditionalActionExecutor({
    domain: conditionalDecisionDomain,
  });
  const conditionalCompositionRuntime = conditionalActionExecutorModule.createConditionalCompositionRuntime({
    executor: conditionalActionExecutor,
    syncFinalScorePendingMarks: (...args) => syncFinalScorePendingMarks(...args),
    dispatchAction: (...args) => actionRuntimeController.dispatchAction(...args),
    createActionContext: (...args) => createActionContextForWorkingRoot(...args),
    getPendingIndustryAbilityDecision: (...args) => getPendingIndustryAbilityDecision(...args),
    getPendingCardSelectionDecision: (...args) => getPendingCardSelectionDecision(...args),
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
    beginCardSelection: (...args) => beginCardSelection(...args),
    setPendingCardSelectionDecision: (...args) => setPendingCardSelectionDecision(...args),
    setCardSelectionActive: (...args) => cards.setSelectionActive(...args),
    allowsBlindDrawInSelection: (...args) => allowsBlindDrawInSelection(...args),
    canBlindDraw: (...args) => canBlindDraw(...args),
    finishIndustryAbilityFlow: (...args) => finishIndustryAbilityFlow(...args),
    getCurrentActionEffect: (...args) => getCurrentActionEffect(...args),
    executeActionEffect: (...args) => executeActionEffect(...args),
  });
  const {
    createConditionalActionProvider,
    enumerateConditionalActionsForRoot: enumerateSimulationConditionalActionsForRoot,
    advanceDeterministicStateForRoot: advanceSimulationDeterministicStateImpl,
    executeCurrentActionEffectForRoot: executeSimulationCurrentActionEffectImpl,
  } = conditionalCompositionRuntime;
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
  const actionSessionRuntime = browserHostModule.actionBar.createLegacyActionSessionRuntime({
    actionHistory,
    uiRuntimeState,
    historySourceMain: HISTORY_SOURCE_MAIN,
    clearCompletedEffectFlowForUndo: (...args) => clearCompletedEffectFlowForUndo(...args),
    clearHistoryStepOrderForSource: (...args) => clearHistoryStepOrderForSource(...args),
    pruneEmptyActionLogDraft: (...args) => pruneEmptyActionLogDraft(...args),
    renderActionLog: (...args) => renderActionLog(...args),
    isActionEffectFlowActive: (...args) => isActionEffectFlowActive(...args),
    hasActivePendingSubFlow: (...args) => hasActivePendingSubFlow(...args),
    getGameplayLockReason: (...args) => getGameplayLockReason(...args),
  });
  const {
    markActionPending, isActionPending, getIrreversibleReason, markCurrentActionIrreversible,
    getCurrentActionIrreversibleReason, markResultIrreversible, getAlienCardGainIrreversible,
    clearActionPending, isMainActionOpeningStep, clearFullyUndoneMainActionSession,
    clearStaleFullyUndoneMainActionSession, canUndoCurrentMainAction,
    hasCurrentMainActionIrreversibleBarrier, getMainActionStartBlockReason, canStartMainAction,
  } = actionSessionRuntime;
  const cardSelectionState = browserHostModule.cardDecisionUi.createLegacyCardSelectionState({
    getRuleReadout: () => createStateSourceReadoutRoot(),
    cards,
    getPendingDiscardDecision: (...args) => getPendingDiscardDecision(...args),
    getPendingCardSelectionDecision: (...args) => getPendingCardSelectionDecision(...args),
    getPublicScanMinSelectable: (...args) => getPublicScanMinSelectable(...args),
  });
  const {
    isCardSelectionActive, isDiscardSelectionActive, isPlayCardSelectionActive,
    allowsBlindDrawInSelection, isPublicScanMultiSelectActive,
    isPublicCornerDiscardSelectionActive, isPublicCardMultiSelectActive,
    getPublicCardMultiSelectMinSelectable,
  } = cardSelectionState;
  const manualAiInputGuard = aiControlRuntimeModule.createManualAiInputGuard({
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
    getPendingOwnerPlayer: (...args) => getPendingOwnerPlayer(...args),
    isAiPlayer: (...args) => isAiAutoBattlePlayer(...args),
    isAiAutomationPaused: (...args) => isAiAutomationPaused(...args),
    setStatusNote: (...args) => setBrowserStatusNote(...args),
    scheduleAiAutoStepIfNeeded: (...args) => scheduleAiAutoStepIfNeeded(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
  });
  const {
    isAiAutomationInputLocked, isPendingLockedForAiAutomation,
    blockManualAiAutomationInput, blockManualAiPendingInput,
    blockManualAiPendingInputIfNeeded,
  } = manualAiInputGuard;
  const scoreSourceRuntime = scoreSourceRuntimeModule.createScoreSourceRuntime({
    actionHistory,
    quickActionHistory,
    players,
    getPlayerById: (...args) => getPlayerById(...args),
    getPlayerByColor: (...args) => getPlayerByColor(...args),
    getActionEffectFlow: (...args) => getActionEffectFlow(...args),
    isAlienFamilyCard: (...args) => isAlienFamilyCard(...args),
    recordHistoryCommand: (...args) => recordHistoryCommand(...args),
    recordQuickHistoryCommand: (...args) => recordQuickHistoryCommand(...args),
  });
  const {
    SCORE_SOURCE_KEY_SET,
    addPlayerScoreSource,
    addScoreSourceFromGain,
    attachScoreSourceToEffects,
    getPlayerScoreSource,
    getScanScorePlayer,
    recordAlienTraceScore,
    recordInitialSelectionScoreSources,
    recordScanScoreSourcesFromAbilityResult,
    recordScoreSourceForGainEffect,
    recordTechBonusScore,
  } = scoreSourceRuntime;
  getBrowserCommittedContext = (workingRoot) => ({
    gameId: "seti-browser-runtime",
    rulesetVersion: "seti-runtime-v1",
    seed: workingRoot.meta?.seed ?? "browser-host",
    rngState: structuredClone(workingRoot.meta?.rngState
      || { owner: "browser", state: null }),
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
  let beginSupplementalMovePaymentForRoot;
  let syncMovePaymentChrome;
  let scrollToPlayerHandPanel;
  let cancelMovePaymentSelection;
  let beginMovePaymentSelection;
  let handleHandCardMovePayment;
  let confirmMovePayment;
  let resolveMovePaymentDecision;
  let syncPlayCardSelectionChrome;
  let getPendingPlayCardSelection;
  let handlePlayCardSelect;
  let confirmPlayCardSelection;
  let handleHandCardPlay;
  let executeStandardPlayCard;
  let executeStandardCardCornerAction;
  let executeMainScanAction;
  let launchRocketForScanAction4;
  let beginScanAction4FreeMove;
  let beginScanAction4FreeMoveForRoot;
  let executeFreeMoveForScanAction4;
  let executeFreeMoveForScanAction4ForRoot;
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
  let handlePublicCornerDiscardCardClick;
  let handlePublicCornerDiscardCardClickForRoot;
  let confirmPublicCornerDiscardSelection;
  let confirmPublicCornerDiscardSelectionForRoot;
  let executeFreeMoveForCardCorner;
  let executeFreeMoveForCardCornerForRoot;
  let beginCardMoveEffect;
  let beginCardMoveEffectForRoot;
  let recordPlayCardStart;
  let releaseFutureSpanAfterPlayWithHistory;
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

  const els = window.SetiAppDom.collectElements(document);
  const residentViewStateStore = browserHostModule?.viewStateStore
    ? browserHostModule.viewStateStore.createViewStateStore()
    : null;
  const residentDesktopRenderer = browserHostModule?.residentRenderer
    ? browserHostModule.residentRenderer.createResidentRenderer({ document, els })
    : null;
  const residentStateSource = ruleComposition.stateSourcePort;
  const residentProjectionAdapter = browserHostModule?.projectionAdapter
    ? browserHostModule.projectionAdapter.createBrowserProjectionAdapter({
      stateSource: residentStateSource,
    })
    : null;
  const residentInputAdapter = browserHostModule?.inputAdapter && residentViewStateStore
    ? browserHostModule.inputAdapter.createBrowserInputAdapter({
      dispatchAction(action) {
        return action?.phase === "quick"
          ? ruleComposition.inputPort.submitQuickAction(action)
          : ruleComposition.inputPort.submitAction(action);
      },
      submitDecision: (submission) => ruleComposition.inputPort.submitDecision(submission),
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
      storage: gameRecoveryModule.getPersistentGameStorage(window),
      storageKey: `${PERSISTENT_GAME_STORAGE_KEY}:browser-services`,
      downloadPort: browserHostModule.browserServices.createBrowserDownloadPort({
        window,
        document,
        Blob,
      }),
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

  const cloneResidentPresentation = browserHostModule.residentProjection.clonePresentation;
  const createResidentReadoutRoot = (resident) => (
    browserHostModule.residentProjection.createLegacyReadoutRoot(resident)
  );
  const createStateSourceReadoutRoot = () => browserHostModule.residentProjection.createLegacyReadoutRoot(
    ruleComposition.stateSourcePort.read().state,
    { solarKey: "solarSystem", includeMatch: true },
  );
  const playerEffectOwnerRuntime = runtimeModule.createPlayerEffectOwnerRuntime({
    players,
    uiRuntimeState,
    createReadoutRoot: createStateSourceReadoutRoot,
    getPlayerByColor: (...args) => getPlayerByColor(...args),
    getCurrentPlayer: (workingRoot = null) => getCurrentPlayer(workingRoot || undefined),
    getActionEffectFlow,
  });
  const {
    isBrowserWorkingRoot,
    getPlayerById,
    resolvePlayerReference,
    effectHasExplicitPlayerTarget,
    assignEffectOwner,
    assignEffectFlowOwner,
    getExplicitEffectOwnerPlayer,
    getEffectOwnerPlayer,
    getPendingOwnerFields,
    getPendingOwnerPlayer,
    withPendingOwnerPlayer,
    setActiveEffectFlowOwner,
    withEffectExecutionPlayer,
  } = playerEffectOwnerRuntime;
  const browserContextRuntime = runtimeModule.createBrowserContextRuntime({
    players,
    industry,
    browserHostState,
    createReadoutRoot: createStateSourceReadoutRoot,
    getPlayerById,
    getRoundOrderPlayerIds: (...args) => getRoundOrderPlayerIds(...args),
    isAiPlayer: (...args) => isAiAutoBattlePlayer(...args),
    isAiAutomationPaused: (...args) => isAiAutomationPaused(...args),
  });
  const {
    getInterfacePlayer,
    createScanRunId,
    resetScanRunSequence,
    getActivePlayers,
    getPlayerLabelById,
    getPlayerCompanyLabel,
    getPlayerDisplayLabel,
    getPlayerActionLabel,
    getTargetPlayerOptions,
    getPlayerRoundOrderNumber,
  } = browserContextRuntime;

  const residentPresentationBuilder = browserHostModule.residentProjection.createResidentPresentationBuilder({
    setupSelectionState, cardTaskState, cardEffects, players, banrenma, jiuzhe, cards, fangzhou,
    resourceIconSrc: RESOURCE_ICON_SRC,
    clonePresentation: cloneResidentPresentation,
    isAiPlayer: (playerId) => isAiAutoBattlePlayer?.(playerId),
    getReadyChongTask: (...args) => getReadyChongTaskForReservedCard?.(...args),
    getReadyAmibaTask: (...args) => getReadyAmibaTaskForReservedCard?.(...args),
    getReadyRunezuTask: (...args) => getReadyRunezuTaskForReservedCard?.(...args),
    getTaskBlockReason: () => getCardTaskCompletionBlockReason?.() || null,
    getRunezuTaskProgressIndexes: (...args) => getRunezuTaskProgressIndexes?.(...args),
    getPlutoActionState: (...args) => getPlutoActionState(...args),
    getCardTypeCode: (...args) => getCardTypeCode(...args),
    isDebugAlienTraceMode: () => isDebugAlienTraceMode?.() || false,
  });
  const createInitialSelectionProjection = residentPresentationBuilder.createInitialSelection;
  const createReservedCardProjection = residentPresentationBuilder.createReservedCards;

  const residentRenderInputBuilder = browserHostModule.residentProjection.createResidentRenderInputBuilder({
    presentationBuilder: residentPresentationBuilder,
    viewStateStore: residentViewStateStore,
    projectionAdapter: residentProjectionAdapter,
    uiRuntimeState,
    getViewer: getResidentViewer,
    createReadoutRoot: createResidentReadoutRoot,
    getPendingMovePayment,
    getPendingCardSelectionDecision,
    getPendingAlienTraceDecision,
    getActionEffectFlow,
    getPendingDiscardDecision,
    getPendingHandScanDecision,
    getPendingScanTargetDecision,
    computePlayerFinalScoreBreakdown,
    isCardSelectionActive: () => isCardSelectionActive?.(),
    allowsBlindDrawInSelection: () => allowsBlindDrawInSelection?.(),
    canBlindDraw: () => canBlindDraw?.(),
    isPublicCardMultiSelectActive: () => isPublicCardMultiSelectActive?.(),
    getPlayerHandPanelTitleHint: () => getPlayerHandPanelTitleHint(),
  });
  const createResidentRenderInput = residentRenderInputBuilder.createRenderInput;
  const turnReadoutRuntime = turnFlowModule.createTurnReadoutRuntime({
    weakStartAiDifficulty: AI_DIFFICULTY_WEAK_START,
    finalRoundNumber: FINAL_ROUND_NUMBER,
    getRuleReadout: createStateSourceReadoutRoot,
    computePlayerFinalScoreBreakdown: (...args) => computePlayerFinalScoreBreakdown(...args),
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
    createResidentRenderInput,
    renderResidentRoundStatus: (...args) => residentDesktopRenderer.renderRoundStatus(...args),
    getDisplayedTurnNumber: (...args) => getDisplayedTurnNumber(...args),
    getRoundOrderPlayerIds: (...args) => getRoundOrderPlayerIds(...args),
    getPlayerLabelById: (...args) => getPlayerLabelById(...args),
    getPlayerAgentLabel: (...args) => getPlayerAgentLabel(...args),
  });
  const {
    buildFinalScoreSummaryLines,
    buildFinalScoreSummaryLinesForRoot,
    getFirstEligiblePlayerId,
    getNextEligiblePlayerId,
    getTurnReadoutLines,
    hasPlayerCompletedThisTurn,
    hasPlayerVisitedPlanetThisTurn,
    haveAllActivePlayersPassed,
    isFinalRound,
    isGameEnded,
    isPlayerPassedThisRound,
    isWeakStartAiDifficulty,
    recordTurnVisitPlanetEvents,
    renderRoundStatus,
  } = turnReadoutRuntime;

  function renderResidentDesktop() {
    const input = createResidentRenderInput();
    if (!input) return;
    residentDesktopRenderer.renderAll(input);
    residentDecisionRenderer?.render(input);
  }
  const cardHoverPreviewRuntime = renderRuntimeModule.createCardHoverPreviewRuntime({ window, document });
  const attachCardHoverPreview = cardHoverPreviewRuntime.attach;
  const hideCardHoverPreview = cardHoverPreviewRuntime.hide;
  const initialSelectionUi = startScreenModule.createInitialSelectionUi({
    document,
    requiredInitialCards: INITIAL_SELECTION_REQUIRED.initial,
    canConfirm: canConfirmInitialSelection,
    confirmSelection: confirmInitialSelectionForCurrentPlayer,
    selectCard: handleInitialSelectionCardClick,
    attachCardHoverPreview,
  });
  const createInitialSelectionPicker = initialSelectionUi.createPicker;
  const createInitialSelectionImage = initialSelectionUi.createCardImage;
  const coordinateRuntime = renderRuntimeModule.createCoordinateRuntime({
    els,
    solar,
    rocketActions,
    planetReferenceLayout,
    planetStats,
    players,
    document,
    chongFossilOwnerTokenElements,
    referencePlacementKindLabels: REFERENCE_PLACEMENT_KIND_LABELS,
    planetsReferenceSize: PLANETS_REFERENCE_SIZE,
    rocketSurface: ROCKET_SURFACE,
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
    removeRocketElement,
    getEarthSectorCoordinate: getEarthSectorCoordinateForRoot,
    getRocketCoordinateReadoutLines,
  } = coordinateRuntime;
  const boardPointerHandlers = actionInteractionRuntimeModule.createBoardPointerHandlers({
    getRocketState: () => createStateSourceReadoutRoot().rocketState,
    getHighlightedRocketId: () => uiRuntimeState.moveHighlightRocketId,
    isAiInputLocked: isAiAutomationInputLocked,
    blockManualInput: blockManualAiAutomationInput,
    isPlanetMarkerRocket,
    activateMoveMode,
    hasBlockingMoveDecision: () => Boolean(
      getPendingCardTriggerFreeMove()
      || getPendingIndustryFreeMoveDecision()
      || getPendingCardCornerFreeMove()
      || getPendingScanFreeMoveDecision()
      || getPendingCardMoveDecision()
    ),
    deactivateMoveMode,
    renderStateReadout,
  });
  const { handleRocketPointerDown, handleBoardPointerDown } = boardPointerHandlers;
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
    return ruleComposition.inputPort.submitHostCommand({ kind: "coordinate_sync_planet_markers" });
  }
  function seedDefaultReferenceRockets() {
    return ruleComposition.inputPort.submitHostCommand({ kind: "coordinate_seed_reference_rockets" });
  }
  const actionLogViewRuntime = actionLogRuntimeModule.createActionLogViewRuntime({
    document,
    els,
    players,
    uiRuntimeState,
    actionLogState,
    historySourceMain: HISTORY_SOURCE_MAIN,
    sourceLabels: ACTION_LOG_SOURCE_LABELS,
    attachCardHoverPreview,
    getCardLabel: cards.getCardLabel,
    resize: (...args) => resize(...args),
    });
  const {
    renderActionLog,
    setReportTab,
    setLogOpen,
    isDebugToolsEnabled,
    isStateLogEnabled,
  } = actionLogViewRuntime;
  const actionLogController = actionLogRuntimeModule.createActionLogController({
    actionLogState,
    actionHistory,
    quickActionHistory,
    historySourceMain: HISTORY_SOURCE_MAIN,
    historySourceQuick: HISTORY_SOURCE_QUICK,
    resourceKeys: ACTION_LOG_RESOURCE_KEYS,
    incomeKeys: ACTION_LOG_INCOME_KEYS,
    incomeLabels: INCOME_GAIN_LABELS,
    deltaUnits: ACTION_LOG_DELTA_UNITS,
    defaultLabels: ACTION_LOG_DEFAULT_LABELS,
    getCardLabel: cards.getCardLabel,
    normalizeSectorX: solar.mod8,
    getNebulaLabel: data.getNebulaLabel,
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
    createReadoutRoot: createStateSourceReadoutRoot,
    getPlayerLabelById: (...args) => getPlayerLabelById(...args),
    getActionCycleNumber: (...args) => getActionCycleNumber(...args),
    getDisplayedTurnNumber: (...args) => getDisplayedTurnNumber(...args),
    cancelHandCardContextActions: (...args) => cancelHandCardContextActions(...args),
    isActionPending: (...args) => isActionPending(...args),
    resetActionBriefingState: (...args) => resetActionBriefingState(...args),
    attachRecoverySnapshot: (...args) => attachRecoverySnapshotToActionLogEntry(...args),
    rememberActionBriefingEntry: (...args) => rememberActionBriefingEntry(...args),
    schedulePersistentGameStateSave: (...args) => schedulePersistentGameStateSave(...args),
    renderActionLog,
  });
  const {
    getActionLogActionLabel,
    normalizeActionLogText,
    createActionLogPlayedCardSnapshot,
    simplifyActionLogDetailForLabel,
    normalizeActionLogStep,
    actionLogOptionsFromHistoryStep,
    createActionLogImpactSnapshot,
    formatActionLogImpact,
    composeActionLogDetailWithImpact,
    ensureActionLogDraft,
    startActionLogDraft,
    appendActionLogStep,
    removeLastActionLogStep,
    removeActionLogStepsBySource,
    pruneEmptyActionLogDraft,
    resetActionLog,
    commitActionLogDraft,
    appendConfirmedActionLogEntry,
  } = actionLogController;
  const playerStatsUi = playerStatsUiModule.createPlayerStatsUi({
    document,
    players,
    data,
    aomomo,
    fangzhou,
    runezu,
    resourceIconSrc: RESOURCE_ICON_SRC,
    getReadoutRoot: createStateSourceReadoutRoot,
    getPlayerCompanyBaseIncome: (...args) => getPlayerCompanyBaseIncome(...args),
    getInterfacePlayer: (...args) => getInterfacePlayer(...args),
    computeFinalScoreBreakdown: (...args) => computePlayerFinalScoreBreakdown(...args),
    isAiPlayer: (...args) => isAiAutoBattlePlayer?.(...args),
    isPlayerPassed: isPlayerPassedThisRound,
  });
  const {
    createPlayerNameStat,
    createStatSeparator,
    createStatIcon,
    createInlineIconValue,
    createPlayerStatsRow,
    buildPlayerResourceStatNodes,
    buildPlayerIncomeStatNodes,
    buildPlayerRunezuStatNodes,
    buildPlayerFangzhouStatNodes,
    formatPlayerIncomeBreakdown,
    getPlayerReadoutLines,
  } = playerStatsUi;
  const getInitialSelectionReadoutLines = startScreenModule.createInitialSelectionReadout({
    state: setupSelectionState,
    getPlayerIds: () => getInitialSelectionPlayerIds(),
    getPlayerLabel: (playerId) => getPlayerLabelById(playerId),
    getPlayer: (playerId) => getPlayerById(playerId),
    getOffer: (playerId) => getInitialSelectionOffer(playerId),
    getCardFromOffer: getCardFromInitialOffer,
    isConfirmed: (playerId) => isInitialSelectionConfirmed(playerId),
  });
  const renderRuntime = renderRuntimeModule.createRenderRuntime({
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
    getRocketCoordinateReadoutLines,
    syncInteractionFocusChrome,
    placeDataToBlueSlot,
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
    layoutPlayerHandFan,
    layoutReservedCardRows,
  } = renderRuntime;
  const moveUiRuntime = actionInteractionRuntimeModule.createMoveUiRuntime({
    cards,
    els,
    moveDiscardActionCode: MOVE_DISCARD_ACTION_CODE,
    moveEnergyCost: MOVE_ENERGY_COST,
    players,
    requestAnimationFrame,
    rocketActions,
    solar,
    uiRuntimeState,
    getRuleReadout: createStateSourceReadoutRoot,
    getCurrentPlayer,
    getPendingIndustryFreeMoveDecision,
    getPendingCardTriggerFreeMove,
    getPendingCardCornerFreeMove,
    getPendingScanFreeMoveDecision,
    getPendingCardMoveDecision,
    isIndustryHandSelectionActive,
    isDiscardSelectionActive,
    isPlayCardSelectionActive,
    isMovePaymentSelectionActive,
    isHandScanSelectionActive,
    isCardSelectionActive,
    isTechTilePickingActive,
    getPendingPiratesRaidDecision,
    canUseCardCornerQuickAction,
    getPendingCardCornerQuickAction,
    getPendingHandCardPlayAction,
    isRocketOnPlanetsReference,
  });
  const {
    canPayForMove,
    canSelectRocketForMoveInteraction,
    getInteractionFocusMode,
    getMovePaymentCardCount,
    getRequiredMovePointsForUi: getRequiredMovePointsForUiForRoot,
    getSectorContentForMove,
    isAsteroidContent,
    isBoardRocketInteractionActive,
    isMovePaymentCard,
    isRocketMoveCandidate,
    isRocketMoveMuted,
    playerHasMovePaymentCard,
    scrollToPlayerCommandPanel,
  } = moveUiRuntime;
  const interactionChrome = renderRuntimeModule.createInteractionChrome({
    els,
    isPublicCardMultiSelectActive: (...args) => isPublicCardMultiSelectActive(...args),
    getPublicCardSelectedCount: () => uiRuntimeState.publicCardSelectedSlots?.length || 0,
    getPublicCardMultiSelectMinSelectable: (...args) => getPublicCardMultiSelectMinSelectable(...args),
    getCardSelectionType: () => getPendingCardSelectionDecision()?.type || null,
    isCardSelectionActive: (...args) => isCardSelectionActive(...args),
    cancelHandCardContextActions: (...args) => cancelHandCardContextActions(...args),
    setQuickPanelOpen: (...args) => setQuickPanelOpen(...args),
    renderPublicCards: (...args) => renderPublicCards(...args),
    updatePublicCardControls: (...args) => updatePublicCardControls(...args),
    getInteractionFocusMode: (...args) => getInteractionFocusMode(...args),
    hasPlayableFutureSpanCard: () => hasPlayableFutureSpanCard(getCurrentPlayer()),
    isIndustryHandSelectionActive: (...args) => isIndustryHandSelectionActive(...args),
    scrollToPlayerHandPanel: (...args) => scrollToPlayerHandPanel(...args),
    renderPlayerHand: (...args) => renderPlayerHand(...args),
    renderInitialSelectionArea: (...args) => renderInitialSelectionArea(...args),
  });
  const effectBarPresentation = browserHostModule.actionBar.createLegacyEffectBarPresentation({
    document,
    els,
    players,
    runezu,
    jiuzhe,
    banrenma,
    scanEffectIcons: scanEffects.EFFECT_ICONS,
    planetRewardEffectIcons: planetRewards?.EFFECT_ICONS,
    techEffectIcons: TECH_EFFECT_ICONS,
    cardEffectIcons: CARD_EFFECT_ICONS,
    resourceIconSrc: RESOURCE_ICON_SRC,
    jiuzheThresholdCardEffectType: JIUZHE_THRESHOLD_CARD_EFFECT_TYPE,
    banrenmaPanelBonusEffectType: BANRENMA_PANEL_BONUS_EFFECT_TYPE,
    resolvePlayerReference: (...args) => resolvePlayerReference(...args),
    getEffectOwnerPlayer: (...args) => getEffectOwnerPlayer(...args),
    getActionEffectFlow: (...args) => getActionEffectFlow(...args),
    getCurrentActionEffect: (...args) => getCurrentActionEffect(...args),
    getPendingCardMoveDecision: (...args) => getPendingCardMoveDecision(...args),
    isAiPlayer: (...args) => isAiAutoBattlePlayer(...args),
  });
  const {
    normalizeResourceCost,
    render: renderActionEffectBar,
  } = effectBarPresentation;
  const playerHandTitlePresenter = renderRuntimeModule.createPlayerHandTitlePresenter({
    isDiscardSelectionActive: (...args) => isDiscardSelectionActive(...args),
    getPendingDiscardDecision: (...args) => getPendingDiscardDecision(...args),
    isHandScanSelectionActive: (...args) => isHandScanSelectionActive(...args),
    isMovePaymentSelectionActive: (...args) => isMovePaymentSelectionActive(...args),
    isMovePaymentLockedForAiAutomation: (...args) => isMovePaymentLockedForAiAutomation(...args),
    getPendingMovePayment: (...args) => getPendingMovePayment(...args),
    moveEnergyCost: MOVE_ENERGY_COST,
    isPlayCardSelectionActive: (...args) => isPlayCardSelectionActive(...args),
    getPendingPlayCardSelection: (...args) => getPendingPlayCardSelection(...args),
    getPendingCardCornerQuickAction: (...args) => getPendingCardCornerQuickAction(...args),
    getPendingHandCardPlayAction: (...args) => getPendingHandCardPlayAction(...args),
    getCardLabel: (...args) => cards.getCardLabel(...args),
    renderPlayerHand: (...args) => renderPlayerHand(...args),
  });
  const { getPlayerHandPanelTitleHint, updatePlayerHandPanelTitle } = playerHandTitlePresenter;
  const finalUiRuntime = finalUiRuntimeModule.createFinalUiRuntime({
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
    countPlayerOwnedTech: actionLogExport.countOwnedTech,
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
  const actionLogExportController = actionLogExport.createActionLogExportController({
    createReadoutRoot: createStateSourceReadoutRoot,
    getDisplayedTurnNumber: (...args) => getDisplayedTurnNumber(...args),
    isGameEnded: (...args) => isGameEnded(...args),
    getEntries: (...args) => getRecoverableActionLog(...args),
    getPlayerResults: (...args) => buildActionLogExportPlayerResults(...args),
    download: (...args) => residentBrowserServices.download(...args),
    setStatus: (...args) => setBrowserStatusNote(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
  });
  const {
    buildActionLogMarkdownContext,
    getActionLogMarkdown,
    downloadActionLogMarkdown,
  } = actionLogExportController;
  function syncFinalScorePendingMarks(workingRoot = null) {
    if (workingRoot) return syncFinalScorePendingMarksForRoot(workingRoot);
    return ruleComposition.inputPort.submitHostCommand({
      kind: "score_sync_pending_marks",
    });
  }
  function handleFinalScoreTileClick(tileId, workingRoot = null) {
    if (workingRoot) return handleFinalScoreTileClickForRoot(workingRoot, tileId);
    return ruleComposition.inputPort.submitHostCommand({
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
  let maybeAutoExecuteAomomoRewardEffects = () => false;
  const effectFlowHelpers = effectFlowModule.createEffectFlowHelpers({
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
    clearCompletedEffectFlowForUndo: (...args) => clearCompletedEffectFlowForUndo(...args),
    assignEffectFlowOwner,
    setActiveEffectFlowOwner,
    renderReservedCards: (...args) => renderReservedCards(...args),
    renderActionEffectBar,
    updateActionButtons,
    renderStateReadout,
    hasActiveCardTriggerResolution: (...args) => hasActiveCardTriggerResolution(...args),
    isCardTriggerRewardFlowBusy: (...args) => isCardTriggerRewardFlowBusy(...args),
    settleCardTasksAfterEffect: (workingRoot, ...args) => settleCardTasksAfterEffectForRoot(workingRoot, ...args),
    finishActionEffectFlow: (workingRoot) => finishActionEffectFlowForRoot(workingRoot),
    cancelActiveEffectSubFlows: (workingRoot) => cancelActiveEffectSubFlowsForRoot(workingRoot),
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
    getSolarState: () => ruleComposition.stateSourcePort.read().state.solarSystem,
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
  const getCurrentActionEffectForRoot = getCurrentActionEffect;
  getCurrentActionEffect = (workingRoot = null) => getCurrentActionEffectForRoot(
    workingRoot || createStateSourceReadoutRoot(),
  );
  function recordAbilityCommands(result, history = actionHistory, workingRoot) {
    return recordAbilityCommandsForRoot(workingRoot, result, history);
  }
  function recordAtomicActionHistory(actionType, label, result, options = {}) {
    return recordAtomicActionHistoryForRoot(actionType, label, result, {
      ...options,
      workingRoot: options.workingRoot,
    });
  }
  const actionEffectOrchestrator = effectFlowModule.createActionEffectOrchestrator({
    HISTORY_SOURCE_MAIN,
    abilities,
    actionHistory,
    aomomo,
    industry,
    interactionChrome,
    planetRewards,
    players,
    uiRuntimeState,
    activateNextActionEffect,
    addScoreSourceToEffects: attachScoreSourceToEffects,
    assignEffectFlowOwner,
    claimRunezuSourceSymbolWithHistory,
    createActionLogImpactSnapshot,
    endEffectHistoryStep,
    executeActionEffect,
    getActionEffectFlow,
    getCurrentActionEffect,
    getCurrentPlayer,
    hasActiveEffectSubFlow,
    recordAbilityCommands,
    renderRunezuBoardSymbols,
    setActionEffectFlow,
    startActionLogDraft,
    autoRewardEffectTypes: AOMOMO_AUTO_REWARD_EFFECT_TYPES,
  });
  const {
    buildPlanetRewardEffectsWithIndustry,
    getActionResultOwnerPlayer,
    claimRunezuPlanetSymbolForTravelResult,
    startPlanetRewardEffectFlow,
    startResearchTechEffectFlow,
  } = actionEffectOrchestrator;
  maybeAutoExecuteAomomoRewardEffects = actionEffectOrchestrator.maybeAutoExecuteAomomoRewardEffects;
  const quickTradeFlow = quickTurnActionExecutorModule.createQuickTradeFlow({
    dispatchRuleInput: (...args) => dispatchBrowserRuleInput(...args),
    blockIncompatiblePendingQuickAction: (...args) => blockIncompatiblePendingQuickAction(...args),
    getGameplayLockReason: (...args) => getGameplayLockReason(...args),
    players,
    historyCommands,
    quickTrades,
    createActionContext: createActionContextForWorkingRoot,
    getPendingDiscardDecision,
    getPendingCardSelectionDecision,
    recordQuickTradeCompletion: (...args) => recordQuickTradeCompletion(...args),
    renderPlayerStats,
    renderPublicCards: (...args) => renderPublicCards(...args),
    updatePublicCardControls: (...args) => updatePublicCardControls(...args),
    updateActionButtons: (...args) => updateActionButtons(...args),
    renderStateReadout,
  });
  const { runQuickTrade } = quickTradeFlow;
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
    uiRuntimeState,
    els,
    cards,
    players,
    rocketActions,
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
    buildRepeatedCardCornerMoveEffect: (...args) => cardRuntimeModule.buildRepeatedCardCornerMoveEffect(
      ...args,
      { effectType: cardEffects.EFFECT_TYPES.CARD_MOVE, getCardLabel: cards.getCardLabel },
    ),
    formatRepeatedCardCornerMoveReward: (...args) => cardRuntimeModule.formatRepeatedCardCornerMoveReward(
      ...args,
      formatPlanetRewardGain,
    ),
    buildPlutoMarkerRemovalChoices,
    removePlutoMarker,
    getPlanetSectorCoordinate,
    restoreMutableObject,
    getSectorContentForMove,
    isAsteroidContent,
  });
  const handFlowHelpers = handFlowModule.createHandFlow({
    uiRuntimeState,
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
    releaseFutureSpanAfterPlayWithHistory: (...args) => releaseFutureSpanAfterPlayWithHistory?.(...args),
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
    executeFreeMoveForCardCorner: (workingRoot, ...args) => executeFreeMoveForCardCornerForRoot(workingRoot, ...args),
    executeFreeMoveForCardTrigger: (workingRoot, ...args) => executeFreeMoveForCardTriggerForRoot(workingRoot, ...args),
    executeIndustryFreeMove: (...args) => executeIndustryFreeMove?.(...args),
    executeCardEffectMove: (...args) => executeCardEffectMove?.(...args),
    createActionContext: createActionContextForWorkingRoot,
    recordAbilityCommands,
    recordQuickHistoryCommand,
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
    recordPlayCardStart: (...args) => recordPlayCardStart(...args),
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
    submitDiscardDecision: (handIndexes) => submitActiveCardDecision(
      "discard-hand-cards",
      (target) => {
        const expected = [...handIndexes].map(Number).sort((left, right) => left - right);
        const actual = [...(target.handIndexes || [])].map(Number).sort((left, right) => left - right);
        return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
      },
    ),
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
    resolveMovePaymentDecision,
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
  beginSupplementalMovePaymentForRoot = beginSupplementalMovePayment;
  syncDiscardSelectionChrome = (...args) => callHandFlowCommand("syncDiscardSelectionChrome", args);
  isHandScanSelectionActive = (...args) => callHandFlowCommand("isHandScanSelectionActive", args);
  syncHandScanSelectionChrome = (...args) => callHandFlowCommand("syncHandScanSelectionChrome", args);
  cancelHandScanSelection = (...args) => callHandFlowCommand("cancelHandScanSelection", args);
  isMovePaymentSelectionActive = (workingRoot = createStateSourceReadoutRoot()) => Boolean(
    getPendingMovePayment(workingRoot),
  );
  getMovePaymentPlayer = (workingRoot = createStateSourceReadoutRoot()) => {
    const pending = getPendingMovePayment(workingRoot);
    return pending ? resolvePlayerReference(workingRoot, {
      playerId: pending.playerId,
      playerColor: pending.playerColor,
    }) : null;
  };
  isMovePaymentLockedForAiAutomation = (...args) => callHandFlowCommand("isMovePaymentLockedForAiAutomation", args);
  beginSupplementalMovePayment = (...args) => callHandFlowCommand("beginSupplementalMovePayment", args);
  syncMovePaymentChrome = (...args) => callHandFlowCommand("syncMovePaymentChrome", args);
  scrollToPlayerHandPanel = (...args) => callHandFlowCommand("scrollToPlayerHandPanel", args);
  cancelMovePaymentSelection = (...args) => callHandFlowCommand("cancelMovePaymentSelection", args);
  beginMovePaymentSelection = (...args) => callHandFlowCommand("beginMovePaymentSelection", args);
  handleHandCardMovePayment = (...args) => callHandFlowCommand("handleHandCardMovePayment", args);
  resolveMovePaymentDecision = (...args) => callHandFlowCommand("resolveMovePaymentDecision", args);
  confirmMovePayment = () => {
    const decision = ruleComposition.inspect().session?.decision || null;
    if (!decision || ruleComposition.inspect().phase !== "awaiting_input") {
      return { ok: false, code: "MOVE_PAYMENT_DECISION_REQUIRED", message: "当前没有等待支付的 DecisionEffect" };
    }
    const selected = [...(uiRuntimeState.movePaymentSelectedHandIndices || [])]
      .map(Number)
      .sort((left, right) => left - right);
    const choice = (decision.choices || []).find((candidate) => {
      const raw = candidate?.selectedHandIndices
        || candidate?.payload?.selectedHandIndices
        || candidate?.standardAction?.payload?.selectedHandIndices
        || [];
      return JSON.stringify([...raw].map(Number).sort((left, right) => left - right)) === JSON.stringify(selected);
    });
    if (!choice) {
      return { ok: false, code: "MOVE_PAYMENT_CHOICE_NOT_LEGAL", message: "当前手牌支付组合不在 DecisionEffect 合法选项中" };
    }
    return ruleComposition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      choice,
    });
  };
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
  cancelDiscardSelection = () => submitActiveCardDecision("cancel-discard-selection", () => true);
  completeDiscardSelection = (...args) => callHandFlowCommand("completeDiscardSelection", args);
  finalizePendingDiscardSelection = (selectedHandIndexes = uiRuntimeState.discardSelectedHandIndexes || []) => (
    submitActiveCardDecision(
      "discard-hand-cards",
      (target) => {
        const expected = [...selectedHandIndexes].map(Number).sort((left, right) => left - right);
        const actual = [...(target.handIndexes || [])].map(Number).sort((left, right) => left - right);
        return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
      },
    )
  );
  handleHandCardDiscard = (...args) => callHandFlowCommand("handleHandCardDiscard", args);
  beginPlayCardSelection = (...args) => callHandFlowCommand("beginPlayCardSelection", args);
  cancelPlayCardSelection = (...args) => callHandFlowCommand("cancelPlayCardSelection", args);
  executeStandardPlayCard = (...args) => callHandFlowCommand("executeStandardPlayCard", args);
  handleFutureSpanCardPlay = (...args) => callHandFlowCommand("handleFutureSpanCardPlay", args);
  handleHandCardPlay = (...args) => callHandFlowCommand("handleHandCardPlay", args);
  handleFutureSpanPlayCardSelect = (...args) => callHandFlowCommand("handleFutureSpanPlayCardSelect", args);
  handleHandScanCardClick = (...args) => callHandFlowCommand("handleHandScanCardClick", args);
  const effectSkipRuntime = effectFlowModule.createEffectSkipRuntime({
    industry,
    yichangdianCornerEffectType: cardEffects.EFFECT_TYPES.YICHANGDIAN_DRAW_THEN_TWO_CORNERS,
    getActionEffectFlow: (...args) => getActionEffectFlow(...args),
    getCurrentActionEffect: (...args) => getCurrentActionEffect(...args),
    getPendingYichangdianCornerAction: (...args) => getPendingYichangdianCornerAction(...args),
    openYichangdianCornerPicker: (...args) => openYichangdianCornerPicker(...args),
    finishCurrentCardMoveEffectEarly: (...args) => finishCurrentCardMoveEffectEarly(...args),
    getPendingScanTargetDecision: (...args) => getPendingScanTargetDecision(...args),
    handleDrawnHandScanSkip: (...args) => scanFlowHelpers.handleDrawnHandScanSkip(...args),
    cancelActiveEffectSubFlowsForRoot: (...args) => cancelActiveEffectSubFlowsForRoot(...args),
    getEffectOwnerPlayer: (...args) => getEffectOwnerPlayer(...args),
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
    renderInitialSelectionArea: (...args) => renderInitialSelectionArea(...args),
    beginEffectHistoryStep: (...args) => beginEffectHistoryStep(...args),
    endEffectHistoryStep: (...args) => endEffectHistoryStep(...args),
    completeCurrentActionEffect: (...args) => completeCurrentActionEffect(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
    setStatusNote: (...args) => setBrowserStatusNote(...args),
  });
  const {
    skipCurrentForRoot: skipCurrentActionEffectForRoot,
    skipWithMessage: skipActionEffectWithMessage,
  } = effectSkipRuntime;
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
    uiRuntimeState,
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
    actionHistory,
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
    renderRocketElement,
    maybeApplyIndustryLaunchScan: (...args) => maybeApplyIndustryLaunchScanForRoot?.(...args),
    getMovableTokensForWorkingRoot: (workingRoot, playerId) => (
      rocketActions.getMovableTokensForPlayer(workingRoot.rocketState, playerId)
    ),
    activateMoveMode: (workingRoot, rocketId) => actionInteractionRuntime.activateMoveMode(workingRoot, rocketId),
    deactivateMoveMode: (workingRoot) => actionInteractionRuntime.deactivateMoveMode(workingRoot),
    selectDefaultRocketForCurrentPlayer: () => selectDefaultRocketForCurrentPlayer(),
    beginSupplementalMovePayment: (workingRoot, ...args) => beginSupplementalMovePaymentForRoot(workingRoot, ...args),
    getRequiredMovePointsForWorkingRoot: (workingRoot, ...args) => getRequiredMovePointsForUiForRoot(workingRoot, ...args),
  });
  ({
    executeMainScanAction,
    launchRocketForScanAction4,
    beginScanAction4FreeMove: beginScanAction4FreeMoveForRoot,
    executeFreeMoveForScanAction4: executeFreeMoveForScanAction4ForRoot,
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
  beginScanAction4FreeMove = () => ruleComposition.inputPort.submitHostCommand({
    kind: "effect_begin_scan_free_move",
  }).value;
  executeFreeMoveForScanAction4 = (deltaX, deltaY, rocketId) => {
    const direction = deltaX === 1 ? "cw" : deltaX === -1 ? "ccw" : deltaY === 1 ? "out" : "in";
    return submitActiveCardDecision(
      "scan-free-move",
      (target) => Number(target.rocketId) === Number(rocketId) && target.direction === direction,
    );
  };
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
  const closeScanTargetPickerForRoot = closeScanTargetPicker;
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
  confirmScanTarget = (nebulaId, sectorX) => {
    const choiceTarget = (ruleComposition.inspect().session?.decision?.choices || [])
      .map((choice) => choice?.target || choice?.standardAction?.target || null)
      .find((target) => (
        ["scan-target", "sector-scan-target"].includes(target?.kind)
        && String(target.nebulaId) === String(nebulaId)
        && (sectorX == null || String(target.sectorX) === String(sectorX))
      ));
    if (!choiceTarget) return { ok: false, code: "SCAN_DECISION_REQUIRED", message: "当前扫描目标不在 active Decision 合法项中" };
    return submitActiveCardDecision(
      choiceTarget.kind,
      (target) => String(target.nebulaId) === String(nebulaId)
        && (sectorX == null || String(target.sectorX) === String(sectorX)),
    );
  };
  handleDrawnHandScanSkip = () => submitActiveCardDecision("skip-drawn-hand-scan", () => true);
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
  handleHandScanCardClick = (handIndex) => submitActiveCardDecision(
    "hand-scan-card",
    (target) => Number(target.handIndex) === Number(handIndex),
  );
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
    uiRuntimeState,
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
    closeAlienTracePicker: closeAlienTracePickerForRoot,
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
  const {
    buildAlienRevealNoticeEntry,
    getAlienTracePickerPlayer,
    canPlaceJiuzheTrace,
    canPlaceYichangdianTrace,
    canPlaceFangzhouTrace,
    canPlaceBanrenmaTrace,
    canPlaceChongTrace,
    canPlaceAmibaTrace,
    canPlaceAomomoTrace,
    canPlaceRunezuTrace,
    canPlaceRunezuFaceSymbol,
    canPlaceStateTrace,
    canPlaceAnyStateExtraTrace,
    openAlienTracePicker,
    closeAlienTracePicker,
    beginAlienTraceBoardPlacement,
    beginJiuzheTraceGridPlacement,
    beginYichangdianTraceGridPlacement,
    beginFangzhouTraceGridPlacement,
    beginBanrenmaTraceGridPlacement,
    beginAomomoTraceGridPlacement,
    beginChongTraceGridPlacement,
    beginAmibaTraceGridPlacement,
    beginRunezuTraceGridPlacement,
    renderAlienTracePickerColorStep,
    openFangzhouTraceUseChoice,
    openFangzhouTraceDestinationChoice,
    routeFangzhouAlienTraceGain,
    handleFangzhouTraceSlotPlacement,
    getEligibleAlienSlotIdsForTraceEffect,
    getFangzhouUnlockableTraceTypes,
    hasAlienTracePanelPlacementTarget,
  } = bindDomainCommands("alien_ui", [
    "buildAlienRevealNoticeEntry", "getAlienTracePickerPlayer", "canPlaceJiuzheTrace",
    "canPlaceYichangdianTrace", "canPlaceFangzhouTrace", "canPlaceBanrenmaTrace", "canPlaceChongTrace",
    "canPlaceAmibaTrace", "canPlaceAomomoTrace", "canPlaceRunezuTrace", "canPlaceRunezuFaceSymbol",
    "canPlaceStateTrace", "canPlaceAnyStateExtraTrace", "openAlienTracePicker", "closeAlienTracePicker",
    "beginAlienTraceBoardPlacement", "beginJiuzheTraceGridPlacement", "beginYichangdianTraceGridPlacement",
    "beginFangzhouTraceGridPlacement", "beginBanrenmaTraceGridPlacement", "beginAomomoTraceGridPlacement",
    "beginChongTraceGridPlacement", "beginAmibaTraceGridPlacement", "beginRunezuTraceGridPlacement",
    "renderAlienTracePickerColorStep", "openFangzhouTraceUseChoice", "openFangzhouTraceDestinationChoice",
    "routeFangzhouAlienTraceGain", "handleFangzhouTraceSlotPlacement", "getEligibleAlienSlotIdsForTraceEffect",
    "getFangzhouUnlockableTraceTypes", "hasAlienTracePanelPlacementTarget",
  ]);
  function handleFangzhouTraceDestinationChoice(destination, traceType = null) {
    return submitActiveCardDecision("fangzhou-trace-destination", (target) => (
      target.choiceId === destination || target.choiceId === `${destination}:${traceType}`
    ));
  }
  function handleFangzhouUnlockTraceChoice(traceType) {
    return submitActiveCardDecision("fangzhou-unlock-color", (target) => target.traceType === traceType);
  }
  function handleStateTraceSlotPlacement(alienSlotId, traceType) {
    return submitActiveCardDecision("alien-state-trace", (target) => (
      Number(target.slotId) === Number(alienSlotId) && target.traceType === traceType
    ));
  }
  const alienRuntimeHelpers = alienRuntimeModule.createAlienRuntimeHelpers({
    uiRuntimeState,
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
    closeAlienTracePicker: (workingRoot) => closeAlienTracePickerForRoot(workingRoot),
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
  const {
    handleJiuzheRevealSideEffects,
    handleYichangdianRevealSideEffects,
    handleFangzhouRevealSideEffects,
    handleBanrenmaRevealSideEffects,
    handleChongRevealSideEffects,
    handleAmibaRevealSideEffects,
    handleAomomoRevealSideEffects,
    handleRunezuRevealSideEffects,
    handleAlienRevealSideEffects,
    failMissingAlienTraceTargetPlayer,
    getAlienTraceActionPlayer,
    confirmYichangdianTracePlacement,
    confirmBanrenmaTracePlacement,
    confirmAomomoTracePlacement,
    confirmChongTracePlacement,
    confirmAmibaTracePlacement,
    confirmRunezuTracePlacement,
    confirmJiuzheTracePlacement,
    settleTurnEndAlienRevealEntries,
    activateAomomoBoard,
  } = bindDomainCommands("alien_runtime", [
    "handleJiuzheRevealSideEffects", "handleYichangdianRevealSideEffects", "handleFangzhouRevealSideEffects",
    "handleBanrenmaRevealSideEffects", "handleChongRevealSideEffects", "handleAmibaRevealSideEffects",
    "handleAomomoRevealSideEffects", "handleRunezuRevealSideEffects", "handleAlienRevealSideEffects",
    "failMissingAlienTraceTargetPlayer", "getAlienTraceActionPlayer", "confirmYichangdianTracePlacement",
    "confirmBanrenmaTracePlacement", "confirmAomomoTracePlacement", "confirmChongTracePlacement",
    "confirmAmibaTracePlacement", "confirmRunezuTracePlacement", "confirmJiuzheTracePlacement",
    "settleTurnEndAlienRevealEntries", "activateAomomoBoard",
  ]);

  const cardSetupController = cardRuntimeModule.createCardSetupController({
    cards,
    passReserveRounds: PASS_RESERVE_ROUNDS,
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    defaultInitialHandCount: DEFAULT_INITIAL_HAND_COUNT,
    ensurePublicCardsFilled: (...args) => ensurePublicCardsFilledRespectingDelayedRefillsForRoot(...args),
  });
  const { initializeCardGame, preparePassReservePilesForCurrentGame } = cardSetupController;

  const recoveryHost = gameRecoveryModule.createRecoveryHost({
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
    uiRuntimeState,
    setPendingCardSelectionDecision,
    alienSpeciesRuntime,
    effectExecutors,
    closeAlienRevealConfirmationOverlay,
    setActionEffectFlow,
    clearCompletedEffectFlowForUndo: (...args) => clearCompletedEffectFlowForUndo(...args),
    historyStepOrder,
    actionHistory,
    quickActionHistory,
    cards,
    tech,
    interactionChrome,
    closeFinalResultDialog,
    setTokenAssetSizes,
    renderWheels,
    renderSectors,
    renderRotateStateToken,
    syncPlanetOrbitLandMarkers,
    refreshHelpers,
    renderPublicCards,
    updatePublicCardControls,
    renderReservedCards,
    renderInitialSelectionArea,
    renderPlayerHand,
    renderRoundStatus,
    renderDebugPlayerSwitch,
    syncCardSelectionChrome,
    syncDiscardSelectionChrome,
    syncPassReserveSelectionChrome,
    syncHandScanSelectionChrome,
    syncPlayCardSelectionChrome,
    syncTechSelectionChrome,
    syncIndustryHandSelectionChrome,
    syncInteractionFocusChrome,
    renderActionLog,
  });
  const { clearTransientStateForRecovery, refreshAfterGameRecovery } = recoveryHost;
  const recoveryLogController = gameRecoveryModule.createRecoveryLogController({
    version: GAME_RECOVERY_VERSION,
    browserServices: residentBrowserServices,
    createReadoutRoot: createStateSourceReadoutRoot,
    getActionCycleNumber: (...args) => getActionCycleNumber(...args),
    createAiControlSnapshot: (...args) => createAiControlSnapshot(...args),
    getStableSnapshot: () => browserActionStableRecoverySnapshot,
    getEntries: () => actionLogState.entries,
    renderActionLog,
    schedulePersistentGameStateSave: (...args) => persistenceController.schedulePersistentGameStateSave(...args),
    clearTransientStateForRecovery,
    restoreAiControlSnapshot: (...args) => restoreAiControlSnapshot(...args),
    refreshAfterGameRecovery,
    importActionLogEntries: (...args) => actionLogRuntimeModule.importEntries(actionLogState, ...args),
  });
  const {
    createGameRecoverySnapshot,
    attachRecoverySnapshotToActionLogEntry,
    refreshLatestActionLogRecoverySnapshot,
    normalizeRecoverableActionLogEntry,
    getRecoverableActionLog,
    createActionLogRecoveryPackage,
    getRecoveryEntriesFromInput,
    getRecoverySnapshotFromLog,
    applyGameRecoverySnapshot,
    importActionLogEntries,
    recoverFromActionLog,
  } = recoveryLogController;
  const persistenceController = gameRecoveryModule.createPersistenceController({
    window,
    storageKey: PERSISTENT_GAME_STORAGE_KEY,
    saveDelayMs: PERSISTENT_GAME_SAVE_DELAY_MS,
    version: GAME_RECOVERY_VERSION,
    getEntries: () => actionLogState.entries,
    getActiveReportTab: () => actionLogState.activeReportTab,
    createSnapshot: (...args) => createGameRecoverySnapshot(...args),
    applySnapshot: (...args) => applyGameRecoverySnapshot(...args),
    importEntries: (...args) => importActionLogEntries(...args),
    setReportTab,
    isStable: () => !isActionPending()
      && !uiRuntimeState.effectStepActive
      && !getActionEffectFlow()
      && !uiRuntimeState.alienRevealConfirmation
      && !hasTurnEndRevealContinuation()
      && !actionLogState.draft
      && !actionHistory.hasSession()
      && !quickActionHistory.hasSession()
      && !isActionEffectFlowActive()
      && !hasActivePendingSubFlow(),
    warn: (...args) => console.warn(...args),
  });
  const {
    readPersistentGamePackage,
    hasPersistentGameState,
    clearPersistentGameState,
    setPersistentGameSaveSuspended,
    isPersistentGameStateStable,
    createPersistentGamePackage,
    savePersistentGameStateNow,
    schedulePersistentGameStateSave,
    restorePersistentGameState,
  } = persistenceController;

  turnFlowController = turnFlowModule.createTurnFlowController({
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
    fillNebulaDataBoard,
    renderWheels,
    renderSectorNebulaDataBoard,
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
    wheelOffsets: WHEEL_OFFSETS,
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
    setPersistentGameSaveSuspended,
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
  const {
    applyOptions: applyStartScreenOptions,
    closeStartScreen,
    continueGameFromStartScreen,
    handleAlienOptionChange: handleStartAlienOptionChange,
    handleIndustryOptionChange: handleStartIndustryOptionChange,
    setDebugToolsEnabled,
    startNewGameFromStartScreen,
    syncActionLogOption: syncStartScreenActionLogOption,
    syncAlienOptions: syncStartScreenAlienOptions,
    syncDebugOption: syncStartScreenDebugOption,
    syncIndustryOptions: syncStartScreenIndustryOptions,
    updateContinueButton: updateStartScreenContinueButton,
  } = startScreenController;
  const initialIncomeFlow = actionRuntimeModule.createInitialIncomeFlow({
    abilities,
    setActionEffectFlow,
    getActionEffectFlow,
    assignEffectFlowOwner,
    setActionEffectFlowActive: (active) => interactionChrome.setActionEffectFlowActive(active),
    renderDebugPlayerSwitch,
    renderPlayerStats,
    renderPlayerHand,
    activateNextActionEffect,
  });
  const { startInitialIncomeEffectFlow } = initialIncomeFlow;
  actionRuntimeController = actionRuntimeModule.createActionRuntime({
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
    removeRocketElement,
    syncPlanetOrbitLandMarkersAfterAction: syncPlanetOrbitLandMarkers,
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
    getCurrentActionEffectIndex: () => getActionEffectFlow()?.currentIndex,
    runQuickTrade,
    confirmDataPlacement,
    standardActionAdapter: actions.createStandardAdapter({
      stage2Actions: {
        scan: {
          label: "扫描",
          getOptions(context) {
            const player = players.getCurrentPlayer(context.playerState);
            const check = canStartMainAction(context.workingRoot)
              ? scanEffects.canExecuteScan(player, { standardAction: true })
              : { ok: false, message: getMainActionStartBlockReason(context.workingRoot) };
            return check.ok ? { ok: true, choices: [{ target: { kind: "standard-scan" }, label: "扫描" }] } : check;
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "ENGINE_ACTION_EXECUTOR_REQUIRED" }; },
        },
        analyze: {
          label: "分析",
          getOptions(context) {
            const player = players.getCurrentPlayer(context.playerState);
            const check = canStartMainAction(context.workingRoot)
              ? canAnalyzeDataForPlayer(player)
              : { ok: false, message: getMainActionStartBlockReason(context.workingRoot) };
            return check.ok ? { ok: true, choices: [{ target: { kind: "computer", requiredSlot: data.ANALYZE_REQUIRED_COMPUTER_SLOT }, payload: getAnalyzeActionOptionsForPlayer(player), label: "分析" }] } : check;
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "ENGINE_ACTION_EXECUTOR_REQUIRED" }; },
        },
        playCard: {
          label: "打牌",
          getOptions(context) {
            if (!canStartMainAction(context.workingRoot)) {
              return { ok: false, message: getMainActionStartBlockReason(context.workingRoot) };
            }
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
          getOptions(context) {
            return canStartMainAction(context.workingRoot)
              ? { ok: true, choices: [{ target: { kind: "pass" }, label: "PASS" }] }
              : { ok: false, message: getMainActionStartBlockReason(context.workingRoot) };
          },
          canExecute(context) { return this.getOptions(context); },
          execute() { return { ok: false, code: "QUICK_TURN_EXECUTOR_REQUIRED" }; },
        },
      },
      stage3Actions: {
        move: {
          label: "移动",
          getOptions(context) {
            if (hasActivePendingSubFlow(context.workingRoot)) return { ok: false, message: "请先完成当前选择" };
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
            if (!canUseCardCornerQuickActionForRoot(context.workingRoot)) {
              return { ok: false, message: "当前无法使用卡牌快速行动" };
            }
            const player = players.getCurrentPlayer(context.playerState);
            const choices = (player?.hand || []).map((card, handIndex) => ({
              card,
              handIndex,
              action: getCardCornerQuickActionForCardForRoot(context.workingRoot, card),
            }))
              .filter(({ action }) => Boolean(action))
              .filter(({ action }) => action.actionKind !== "move"
                || shouldQueueCardCornerMoveQuickActionForRoot(context.workingRoot, action, player)
                || canStartCardCornerFreeMoveForRoot(context.workingRoot).ok)
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
          getOptions(context) {
            const legal = isActionPending() && !isActionEffectFlowActive(context.workingRoot)
              && !hasActivePendingSubFlow(context.workingRoot);
            return legal
              ? { ok: true, choices: [{ target: { kind: "end-turn" }, label: "结束回合" }] }
              : { ok: false, message: "主行动未完成或仍有待决选择" };
          },
          canExecute(context) { return this.getOptions(context); },
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

  const aiControllerState = {
    get pendingDiscardAction() { return getPendingDiscardDecision(); },
    get pendingCardSelectionContinuation() { return getPendingCardSelectionDecision(); },
    get publicCardSelectedSlots() { return [...(uiRuntimeState.publicCardSelectedSlots || [])]; },
    get pendingPublicScanQueue() { return getPublicScanQueueSession(); },
    get pendingAlienTraceContinuation() { return getPendingAlienTraceDecision(); },
    get pendingLandTargetAction() { return getPendingLandTargetDecision(); },
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
    get pendingActionExecuted() { return isActionPending(); },
    get pendingActionEffectFlow() { return getActionEffectFlow(); },
    get actionHistoryHasSession() { return actionHistory.hasSession(); },
    get actionHistorySessionInfo() { return actionHistory.getSessionInfo?.() || null; },
    get effectStepActive() { return uiRuntimeState.effectStepActive; },
    set effectStepActive(value) { uiRuntimeState.effectStepActive = value; },
    get pendingIndustryAbility() { return getPendingIndustryAbilityDecision(); },
    get pendingStrategyPassiveSlotChoice() { return getPendingStrategySlotDecision(); },
    get alienTracePickerState() { return uiRuntimeState.alienTracePickerState; },
    get pendingAlienRevealConfirmation() { return uiRuntimeState.alienRevealConfirmation; },
  };

  function runAiStepThroughComposition(commandKind, args = []) {
    let inspection = ruleComposition.inspect();
    if (inspection.phase === "idle") {
      const readoutRoot = createStateSourceReadoutRoot();
      if (isActionEffectFlowActive(readoutRoot)) {
        const drained = ruleComposition.inputPort.beginDrain();
        if (!drained?.ok) return drained;
        inspection = ruleComposition.inspect();
      }
    }
    const decision = inspection.session?.decision || null;
    if (inspection.phase === "awaiting_input" && decision?.choices?.length) {
      const family = decision.choices[0]?.family
        || decision.choices[0]?.standardAction?.family
        || decision.decisionKind
        || null;
      const actorId = decision.ownerId || null;
      const stateSourceSnapshot = ruleComposition.stateSourcePort.read();
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
      return ruleComposition.inputPort.submitDecision({
        decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion,
        choice,
      });
    }
    return ruleComposition.inputPort.submitHostCommand({ kind: commandKind, args });
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
    setPlayerAiDifficulty: (playerId, difficulty, label) => ruleComposition.inputPort.submitHostCommand({
      kind: "ai_set_player_difficulty",
      playerId,
      difficulty,
      label,
    }),
    runAiAutomationStepThroughComposition: (...args) => runAiStepThroughComposition("ai_run_automation_step", args),
    recoverAiIdleActionEffectThroughComposition: (...args) => runAiStepThroughComposition("ai_recover_idle_action_effect", args),
    getRuleProjection: () => {
      const state = ruleComposition.stateSourcePort.read().state;
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
    confirmInitialSelectionForCurrentPlayer: (workingRoot) => (
      actionRuntimeController.confirmInitialSelectionForCurrentPlayer(workingRoot)
    ),
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
    enumerateSimulationTurnActions: enumerateSimulationTurnActionsForRoot,
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
  const buildAiTurnActionCandidates = (...args) => ruleComposition.inputPort.submitHostCommand({
    kind: "ai_build_turn_candidates",
    args,
  });
  const listCardTriggerFreeMoveCandidates = (...args) => (
    ruleComposition.inputPort.submitHostCommand({
      kind: "card_trigger_list_free_move_candidates",
      args,
    }, { commit: false }).value || []
  );
  const resolveAiAutomationToTurnBoundary = (options = {}) => ruleComposition.inputPort.submitHostCommand({
    kind: "ai_resolve_to_turn_boundary",
    options,
  });
  const runAiAutomationStep = () => ruleComposition.inputPort.submitHostCommand({ kind: "ai_run_automation_step" });
  const runAiActionEffectStep = () => ruleComposition.inputPort.submitHostCommand({ kind: "ai_run_action_effect_step" });
  const runAiNonTurnAutomationStep = () => ruleComposition.inputPort.submitHostCommand({ kind: "ai_run_non_turn_step" });
  const runAiSelectedTurnAction = (selector = {}, options = {}) => ruleComposition.inputPort.submitHostCommand({
    kind: "ai_run_selected_turn_action",
    selector,
    options,
  });
  const cardRuntime = cardRuntimeModule.createCardRuntime({
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    SCORE_SOURCE_KEYS,
    SCORE_SOURCE_KEY_SET: new Set(Object.values(SCORE_SOURCE_KEYS)),
    abilities,
    actionHistory,
    activateMoveMode,
    addScoreSourceFromGain,
    allowsBlindDrawInSelection,
    appendActionLogStep,
    attachCardHoverPreview,
    banrenma,
    beginDiscardSelection,
    beginEffectHistoryStep,
    beginQuickActionStep,
    beginSupplementalMovePayment: (workingRoot, ...args) => beginSupplementalMovePaymentForRoot(workingRoot, ...args),
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
    createActionLogImpactSnapshot,
    createActionLogPlayedCardSnapshot,
    createCardTriggerProgressCommands: (workingRoot, ...args) => createCardTriggerProgressCommandsForRoot(workingRoot, ...args),
    data,
    deactivateMoveMode,
    discardReservedCardIfFinished: (workingRoot, ...args) => discardReservedCardIfFinishedForRoot(workingRoot, ...args),
    document,
    els,
    fangzhou,
    finalizeIndustryDeepspaceSwap: (...args) => finalizeIndustryDeepspaceSwap?.(...args),
    finishAutomaticRewardEffect,
    finishIndustryAbilityFlow: (...args) => finishIndustryAbilityFlow?.(...args),
    formatPlanetRewardGain,
    endEffectHistoryStep,
    getCurrentActionEffect,
    getDelayedPublicRefillSlots,
    getGameplayLockReason,
    getMainActionStartBlockReason,
    getPendingIndustryAbilityDecision,
    getRequiredMovePointsForUi,
    getRequiredMovePointsForWorkingRoot: (workingRoot, ...args) => getRequiredMovePointsForUiForRoot(workingRoot, ...args),
    getPublicScanSelectionInstruction: (...args) => getPublicScanSelectionInstruction?.(...args) || "请选择公共牌",
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
    maybeContinuePendingTurnEndRevealFlow,
    normalizeResourceCost,
    uiRuntimeState,
    players,
    quickActionHistory,
    quickTrades,
    recordAbilityCommands,
    recordHistoryCommand,
    recordQuickHistoryCommand,
    recordScoreSourceForGainEffect,
    recordTechBonusScore,
    renderActionEffectBar,
    renderPlayerHand,
    renderPlayerStats,
    renderRocketElement,
    renderRockets,
    renderInitialSelectionArea,
    renderRuntime,
    renderStateReadout,
    rocketActions,
    rollbackPendingIndustryQuickAction: (...args) => rollbackPendingIndustryQuickAction?.(...args),
    runezu,
    scrollToPlayerHandPanel,
    settleCardTasksAfterEffect: (workingRoot, ...args) => settleCardTasksAfterEffectForRoot(workingRoot, ...args),
    skipActionEffectWithMessage: (...args) => skipActionEffectWithMessage(...args),
    startCardEffectFlow,
    startActionLogDraft,
    structuredClone,
    syncCardSelectionChrome,
    syncMovePaymentChrome,
    updateActionButtons,
    activateMoveModeForWorkingRoot: (workingRoot, rocketId) => actionInteractionRuntime.activateMoveMode(workingRoot, rocketId),
    deactivateMoveModeForWorkingRoot: (workingRoot) => actionInteractionRuntime.deactivateMoveMode(workingRoot),
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
    handlePublicCornerDiscardCardClick,
    confirmPublicCornerDiscardSelection,
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
    executeFreeMoveForCardCorner,
    recordPlayCardStart,
    releaseFutureSpanAfterPlayWithHistory,
    beginCardMoveEffect,
  } = cardRuntime);
  beginCardMoveEffectForRoot = beginCardMoveEffect;
  beginCardMoveEffect = (effect) => ruleComposition.inputPort.submitHostCommand({
    kind: "effect_begin_card_move",
    effect,
  }).value;
  executeFreeMoveForCardCornerForRoot = executeFreeMoveForCardCorner;
  executeFreeMoveForCardCorner = (deltaX, deltaY, rocketId) => submitActiveCardDecision(
    "card-corner-free-move",
    (target, choice) => String(target.rocketId) === String(rocketId)
      && Number(choice.deltaX ?? choice.payload?.deltaX) === Number(deltaX)
      && Number(choice.deltaY ?? choice.payload?.deltaY) === Number(deltaY),
  );
  const releaseFutureSpanAfterPlayWithHistoryForRoot = releaseFutureSpanAfterPlayWithHistory;
  releaseFutureSpanAfterPlayWithHistory = bindBrowserDomainCommand(
    "card_runtime",
    "releaseFutureSpanAfterPlayWithHistory",
  );
  const getDiscardCornerRewardMultiplierForRoot = getDiscardCornerRewardMultiplier;
  const getCardCornerQuickActionForCardForRoot = getCardCornerQuickActionForCard;
  const shouldQueueCardCornerMoveQuickActionForRoot = shouldQueueCardCornerMoveQuickAction;
  const canUseCardCornerQuickActionForRoot = canUseCardCornerQuickAction;
  const canStartCardCornerFreeMoveForRoot = canStartCardCornerFreeMove;
  const beginCardCornerFreeMoveForRoot = beginCardCornerFreeMove;
  const startCardCornerMoveEffectFlowForRoot = startCardCornerMoveEffectFlow;
  const hasFutureSpanEligibleHandCardForRoot = hasFutureSpanEligibleHandCard;
  const hasPlayableFutureSpanCardForRoot = hasPlayableFutureSpanCard;
  const getStandardPlayCardActionBlockReasonForRoot = getStandardPlayCardActionBlockReason;
  const getPlayCardSelectionBlockReasonForRoot = getPlayCardSelectionBlockReason;
  const getHandCardPlayActionForCardForRoot = getHandCardPlayActionForCard;
  const beginCardSelectionForRoot = beginCardSelection;
  const cancelCardSelectionForRoot = cancelCardSelection;
  const finalizeCardSelectionResultForRoot = finalizeCardSelectionResult;
  const drawBasicCardToPlayerForRoot = drawBasicCardToPlayer;
  const blindDrawCardForPlayerForRoot = blindDrawCardForPlayer;
  const drawCardForCurrentPlayerForRoot = drawCardForCurrentPlayer;
  const pickPublicCardForCurrentPlayerForRoot = pickPublicCardForCurrentPlayer;
  const canBlindDrawForRoot = canBlindDraw;
  const updatePublicCardControlsForRoot = updatePublicCardControls;
  const ensurePublicCardsFilledRespectingDelayedRefillsForRoot = ensurePublicCardsFilledRespectingDelayedRefills;
  const handlePublicCardClickForRoot = handlePublicCardClick;
  const handlePublicBlindDrawClickForRoot = handlePublicBlindDrawClick;
  const getPassReserveSelectionCardsForRoot = getPassReserveSelectionCards;
  const renderPassReserveSelectionForRoot = renderPassReserveSelection;
  const syncPassReserveSelectionChromeForRoot = syncPassReserveSelectionChrome;
  const beginPassReserveSelectionForRoot = beginPassReserveSelection;
  const dismissPassReserveSelectionOverlayForRoot = dismissPassReserveSelectionOverlay;
  handlePublicCornerDiscardCardClickForRoot = handlePublicCornerDiscardCardClick;
  confirmPublicCornerDiscardSelectionForRoot = confirmPublicCornerDiscardSelection;
  ({
    getDiscardCornerRewardMultiplier,
    getCardCornerQuickActionForCard,
    shouldQueueCardCornerMoveQuickAction,
    canUseCardCornerQuickAction,
    canStartCardCornerFreeMove,
    beginCardCornerFreeMove,
    startCardCornerMoveEffectFlow,
    hasFutureSpanEligibleHandCard,
    hasPlayableFutureSpanCard,
    getStandardPlayCardActionBlockReason,
    getPlayCardSelectionBlockReason,
    getHandCardPlayActionForCard,
    beginCardSelection,
    cancelCardSelection,
    finalizeCardSelectionResult,
    drawBasicCardToPlayer,
    blindDrawCardForPlayer,
    drawCardForCurrentPlayer,
    pickPublicCardForCurrentPlayer,
    canBlindDraw,
    updatePublicCardControls,
    ensurePublicCardsFilledRespectingDelayedRefills,
    handlePublicCardClick,
    handlePublicBlindDrawClick,
    getPassReserveSelectionCards,
    renderPassReserveSelection,
    syncPassReserveSelectionChrome,
    beginPassReserveSelection,
    dismissPassReserveSelectionOverlay,
    handlePublicCornerDiscardCardClick,
    confirmPublicCornerDiscardSelection,
  } = bindDomainCommands("card_runtime", [
    "getDiscardCornerRewardMultiplier", "getCardCornerQuickActionForCard", "shouldQueueCardCornerMoveQuickAction",
    "canUseCardCornerQuickAction", "canStartCardCornerFreeMove", "beginCardCornerFreeMove",
    "startCardCornerMoveEffectFlow", "hasFutureSpanEligibleHandCard", "hasPlayableFutureSpanCard",
    "getStandardPlayCardActionBlockReason", "getPlayCardSelectionBlockReason", "getHandCardPlayActionForCard",
    "beginCardSelection", "cancelCardSelection", "finalizeCardSelectionResult", "drawBasicCardToPlayer",
    "blindDrawCardForPlayer", "drawCardForCurrentPlayer", "pickPublicCardForCurrentPlayer", "canBlindDraw",
    "updatePublicCardControls", "ensurePublicCardsFilledRespectingDelayedRefills", "handlePublicCardClick",
    "handlePublicBlindDrawClick", "getPassReserveSelectionCards", "renderPassReserveSelection",
    "syncPassReserveSelectionChrome", "beginPassReserveSelection", "dismissPassReserveSelectionOverlay",
    "handlePublicCornerDiscardCardClick", "confirmPublicCornerDiscardSelection",
  ]));
  const selectPassReserveCardForRoot = selectPassReserveCard;
  const confirmPassReserveSelectionForRoot = confirmPassReserveSelection;
  selectPassReserveCard = (cardId) => selectPassReserveCardForRoot(createStateSourceReadoutRoot(), cardId);
  confirmPassReserveSelection = () => {
    const selectedCardId = uiRuntimeState.passReserveSelectedCardId || null;
    if (!selectedCardId) return { ok: false, message: "请先选择 PASS 预留牌" };
    const inspection = ruleComposition.inspect();
    const decision = inspection.session?.decision || null;
    const choice = (decision?.choices || []).find((candidate) => {
      const target = candidate?.target || candidate?.standardAction?.target || null;
      return target?.kind === "pass-reserve-card" && String(target.choiceId) === String(selectedCardId);
    });
    if (inspection.phase !== "awaiting_input" || !decision || !choice) {
      return { ok: false, code: "PASS_RESERVE_DECISION_REQUIRED", message: "当前 PASS 选择不在 active Decision 合法项中" };
    }
    return ruleComposition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      choice,
    });
  };
  const selectDefaultRocketFromCandidatesForRoot = selectDefaultRocketFromCandidates;
  const executeCardEffectMoveForRoot = executeCardEffectMove;
  const finishCurrentCardMoveEffectEarlyForRoot = finishCurrentCardMoveEffectEarly;
  const requestCardEffectMoveForRoot = requestCardEffectMove;
  const getMovableTokensForCardMoveEffectForRoot = getMovableTokensForCardMoveEffect;
  ({
    selectDefaultRocketFromCandidates,
    executeCardEffectMove,
    finishCurrentCardMoveEffectEarly,
    requestCardEffectMove,
    getMovableTokensForCardMoveEffect,
  } = bindDomainCommands("card_runtime", [
    "selectDefaultRocketFromCandidates", "executeCardEffectMove", "finishCurrentCardMoveEffectEarly",
    "requestCardEffectMove", "getMovableTokensForCardMoveEffect",
  ]));
  const cardTriggerRuntime = cardTriggerRuntimeModule.createCardTriggerRuntime({
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
    uiRuntimeState,
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
  function submitActiveCardDecision(kind, matches) {
    const inspection = ruleComposition.inspect();
    const decision = inspection.session?.decision || null;
    const choice = (decision?.choices || []).find((candidate) => {
      const target = candidate?.target || candidate?.standardAction?.target || null;
      return target?.kind === kind && matches(target, candidate);
    });
    if (inspection.phase !== "awaiting_input" || !decision || !choice) {
      return { ok: false, code: "CARD_DECISION_REQUIRED", message: "当前输入不在 active Decision 合法项中" };
    }
    return ruleComposition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      choice,
    });
  }
  cancelCardTriggerChoice = () => submitActiveCardDecision(
    "card-trigger-cancel",
    (target) => target.choiceId === "cancel",
  );
  const confirmCardTaskCompletionForRoot = confirmCardTaskCompletion;
  confirmCardTaskCompletion = (choiceId = "confirm") => submitActiveCardDecision(
    "card-task-completion",
    (target) => String(target.choiceId) === String(choiceId),
  );
  const openCardTriggerPickerForRoot = openCardTriggerPicker;
  openCardTriggerPicker = bindBrowserDomainCommand("card_trigger", "openCardTriggerPicker");
  const applyCardTriggerRewardForRoot = applyCardTriggerReward;
  applyCardTriggerReward = bindBrowserDomainCommand("card_trigger", "applyCardTriggerReward");
  const beginCardTriggerFreeMoveForRoot = beginCardTriggerFreeMove;
  beginCardTriggerFreeMove = bindBrowserDomainCommand("card_trigger", "beginCardTriggerFreeMove");
  const applyCardTriggerMatchForRoot = applyCardTriggerMatch;
  applyCardTriggerMatch = bindBrowserDomainCommand("card_trigger", "applyCardTriggerMatch");
  const handleCardTriggerChoiceForRoot = handleCardTriggerChoice;
  handleCardTriggerChoice = (choiceIndex) => submitActiveCardDecision(
    "card-trigger",
    (target) => Number(target.choiceIndex) === Number(choiceIndex),
  );
  const executeFreeMoveForCardTriggerForRoot = executeFreeMoveForCardTrigger;
  executeFreeMoveForCardTrigger = (deltaX, deltaY, rocketId) => submitActiveCardDecision(
    "card-trigger-free-move",
    (target, choice) => String(target.rocketId) === String(rocketId)
      && Number(choice.deltaX ?? choice.payload?.deltaX) === Number(deltaX)
      && Number(choice.deltaY ?? choice.payload?.deltaY) === Number(deltaY),
  );

  function syncPublicScanConfirmButton() {
    return interactionChrome.syncPublicScanConfirmButton();
  }

  function syncCardSelectionChrome() {
    return interactionChrome.syncCardSelectionChrome();
  }

  function syncInteractionFocusChrome() {
    return interactionChrome.syncInteractionFocusChrome();
  }

  function syncIndustryHandSelectionChrome() {
    return interactionChrome.syncIndustryHandSelectionChrome();
  }

  function blockManualAiMovePayment(message = null) {
    const player = getMovePaymentPlayer();
    return blockManualAiAutomationInput(
      message || `${player?.colorLabel || "电脑玩家"}AI 正在确认移动支付`,
      player,
    );
  }

  function getRequiredMovePointsForUi(...args) {
    return ruleComposition.inputPort.submitHostCommand({ kind: "ui_get_required_move_points", args }, { commit: false }).value;
  }

  function getNormalTokenAssetForPlayer(player) {
    return players.getPlayerColorDefinition(player?.color)?.normalTokenAsset
      || "../assets/tokens/normal_token.png";
  }

  const neutralScoreTraceRuntime = alienRuntimeModule.createNeutralScoreTraceRuntime({
    aliens,
    players,
    historyCommands,
    quickActionHistory,
    getActivePlayers,
    recordQuickHistoryCommand,
    recordHistoryCommand,
    renderAlienPanels,
    getScanScorePlayer,
  });
  const {
    getNeutralScoreTraceColor,
    getCrossedNeutralScoreTraceThresholds,
    recordNeutralScoreTraceRestore,
    placeNeutralScoreTraceForThreshold,
    handlePlayerScoreChanged,
    recordNeutralScoreTracesFromScanResult,
    recordNeutralScoreTracesFromAbilityResult,
  } = neutralScoreTraceRuntime;

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


  function isActionEffectFlowActive(workingRoot = null) {
    return getActionEffectFlow(workingRoot) != null;
  }

  function isInitialIncomeFlowActive(workingRoot = null) {
    return getActionEffectFlow(workingRoot)?.actionType === "initialIncome";
  }

  function getGameplayLockReason(workingRoot = null) {
    if (isGameEnded(workingRoot)) return "游戏已结束，正在进行终局计分";
    if (isInitialSelectionActive()) return "请先完成初始选择";
    if (isInitialIncomeFlowActive(workingRoot)) return "请先完成初始收入增加";
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
      workingRoot.rocketState.statusNote = getPendingIndustryAbilityDecision(workingRoot) || getPendingIndustryFreeMoveDecision(workingRoot) || isIndustryHandSelectionActive()
        ? "请先完成或取消公司 1x 行动"
        : "请先完成或取消当前流程";
      renderStateReadout();
      return { ok: false, message: workingRoot.rocketState.statusNote };
    }
    return null;
  }

  function blockIncompatiblePendingQuickAction(actionType) {
    return ruleComposition.inputPort.submitHostCommand({
      kind: "quick_action_check_pending",
      actionType,
    }).value;
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

  const effectFlowUndoRuntime = effectFlowModule.createEffectFlowUndoRuntime({
    abilities,
    getActionEffectFlow,
    isMainActionOpeningStep,
    clearResearchTechSelectionState,
    clearActionEffectFlow: (...args) => clearActionEffectFlow(...args),
    pruneEndOfFlowSettlementEffectsAfterUndo,
    cancelActiveEffectSubFlows,
    restoreResearchTechSelectionAfterUndo,
    setActionEffectFlowActive: (active) => interactionChrome.setActionEffectFlowActive(active),
  });
  const revertEffectFlowAfterUndo = effectFlowUndoRuntime.revertEffectFlowAfterUndo;

  function cancelActivePendingSubFlows() {
    return ruleComposition.inputPort.submitHostCommand({ kind: "effect_cancel_pending_subflows" }).value;
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
    return ruleComposition.inputPort.submitHostCommand({ kind: "rocket_current_planet", rocketId }, { commit: false }).value;
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
    return ruleComposition.inputPort.submitHostCommand({ kind: "chong_ready_transports", player, task }, { commit: false }).value || [];
  }

  function buildSectorScanChoicesForXs(sectorXs) {
    return (sectorXs || []).flatMap((x) => buildSectorScanChoicesForX(x));
  }

  const effectFlowStateRuntime = effectFlowModule.createEffectFlowStateRuntime({
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    uiRuntimeState,
    actionHistory,
    setActionEffectFlow,
    closeLandTargetPicker,
    closeScanAction4Picker,
    renderActionEffectBar,
    setActionEffectFlowActive: (active) => interactionChrome.setActionEffectFlowActive(active),
    renderReservedCards,
  });
  const {
    clearActionEffectFlow,
    shouldRememberCompletedEffectFlowForUndo,
    clearCompletedEffectFlowForUndo,
    rememberCompletedEffectFlowForUndo,
    takeCompletedEffectFlowForUndo,
    peekCompletedEffectFlowForUndo,
  } = effectFlowStateRuntime;

  const effectSubFlowCancellationRuntime = effectFlowModule.createEffectSubFlowCancellationRuntime({
    uiRuntimeState,
    getPublicScanQueueSession,
    closeScanTargetPicker,
    isLandTargetPickerOpen: () => Boolean(els.landTargetOverlay && !els.landTargetOverlay.hidden),
    cancelLandTargetPicker,
    closeScanAction4Picker,
    closeAlienTracePicker,
    isHandScanSelectionActive,
    syncHandScanSelectionChrome,
    isCardSelectionActive,
    getActionEffectFlow,
    isCardTriggerPickSelectionActive,
    getPendingCardSelectionDecision,
    resolvePlayerReference,
    restoreObjectSnapshot,
    setPendingCardSelectionDecision,
    setCardSelectionActive: (cardState, active) => cards.setSelectionActive(cardState, active),
    syncCardSelectionChrome,
    getPendingPassReserveSelection,
    syncPassReserveSelectionChrome,
    getPendingScanFreeMoveDecision,
    getPendingCardMoveDecision,
    deactivateMoveMode,
    getPendingDataPlacementDecision,
    closeDataPlacePicker,
    clearYichangdianCornerAction: () => effectExecutors?.clearYichangdianCornerAction?.(),
    clearAlienDecisionDrafts: () => {
      alienSpeciesRuntime?.clearChongCardGainDecisionDraft?.();
      alienSpeciesRuntime?.clearChongFossilDecisionDraft?.();
      alienSpeciesRuntime?.clearAmibaCardGainDecisionDraft?.();
      alienSpeciesRuntime?.clearAmibaSymbolDecisionDraft?.();
      alienSpeciesRuntime?.clearAmibaTraceRemovalDecisionDraft?.();
      alienSpeciesRuntime?.clearAomomoCardGainDecisionDraft?.();
      alienSpeciesRuntime?.clearRunezuCardGainDecisionDraft?.();
      alienSpeciesRuntime?.clearRunezuSymbolBranchDecisionDraft?.();
      alienSpeciesRuntime?.clearRunezuFaceSymbolDecisionDraft?.();
    },
    getPendingPiratesRaidDecision,
    renderTechBoard,
  });
  const cancelActiveEffectSubFlowsForRoot = effectSubFlowCancellationRuntime.cancelActiveEffectSubFlowsForRoot;

  function cancelActiveEffectSubFlows() {
    return ruleComposition.inputPort.submitHostCommand({ kind: "effect_cancel_subflows" });
  }

  function skipCurrentActionEffect() {
    return ruleComposition.inputPort.submitHostCommand({ kind: "effect_skip_current" }).value;
  }

  const sectorSettlementRuntime = scanFlowModule.createSectorSettlementRuntime({
    HISTORY_SOURCE_MAIN,
    data,
    players,
    aomomo,
    runezu,
    historyCommands,
    getNormalTokenAssetForPlayer,
    getHistoryForSource,
    rememberHistoryStep,
    appendActionLogStep,
    actionLogOptionsFromHistoryStep,
    renderSectorNebulaDataBoard,
    renderPlayerStats,
    renderAlienPanels,
  });
  const resolveCompletedSectorSettlementsForRoot = sectorSettlementRuntime.resolveCompletedSectorSettlementsForRoot;

  function resolveCompletedSectorSettlements(actionType, options = {}) {
    return ruleComposition.inputPort.submitHostCommand({
      kind: "scan_settle_completed_sectors",
      actionType,
      options,
    }).value;
  }

  const effectFlowCompletionRuntime = effectFlowModule.createEffectFlowCompletionRuntime({
    HISTORY_SOURCE_MAIN,
    uiRuntimeState,
    actionHistory,
    getActionEffectFlow,
    appendEndOfFlowSectorFinishEffects,
    appendDeferredEndOfFlowEffects,
    collectTemporaryTaskRewards: (...args) => cardEffects.collectTemporaryTaskRewards(...args),
    cloneDelayedPublicRefills,
    settleDelayedPublicRefillsAfterScanFlow,
    rememberCompletedEffectFlowForUndo,
    clearActionEffectFlow,
    finishResearchTechSelection: (workingRoot) => {
      tech.setTechSelectionActive(workingRoot.techGameState, false);
      tech.cancelPendingTake(workingRoot.techGameState);
      workingRoot.techGameState.ui.statusNote = "";
      syncTechSelectionChrome();
      renderTechBoard();
    },
    clearHistoryStepOrderForSource,
    removeActionLogStepsBySource,
    clearActionPending,
    finishInitialIncomeUi: () => {
      renderDebugPlayerSwitch();
      renderPlayerStats();
      renderPlayerHand();
      syncInteractionFocusChrome();
      updateActionButtons();
      renderStateReadout();
      refreshLatestActionLogRecoverySnapshot("初始收入完成后状态");
      scrollToPlayerCommandPanel();
    },
    startTemporaryCardTaskRewardFlow,
    releaseFutureSpanAfterPlayWithHistoryForRoot,
    settleCardTasksAfterEffectForRoot,
    applyType1TriggerMatchesForRoot,
    hasActiveCardTriggerResolution,
    isActionEffectFlowActive,
    markActionPending,
    renderPlayerStats,
    updateActionButtons,
    renderStateReadout,
    getPlayerById,
    getCurrentPlayerForRoot: (workingRoot) => players.getCurrentPlayer(workingRoot.playerState),
    createPassEvent,
    renderAlienPanels,
    maybeResumeTurnEndAfterReveal,
  });
  const finishActionEffectFlowForRoot = effectFlowCompletionRuntime.finishActionEffectFlowForRoot;

  function finishActionEffectFlow() {
    return ruleComposition.inputPort.submitHostCommand({ kind: "effect_finish_flow" }).value;
  }

  function maybeCompleteActionEffectFromScan(workingRoot, result) {
    if (!result?.ok || !isActionEffectFlowActive()) return;
    const current = getCurrentActionEffect(workingRoot);
    if (current) current.result = result;
    completeCurrentActionEffect(workingRoot);
  }

  const scanAction4Picker = scanFlowModule.createScanAction4Picker({
    document,
    els,
    players,
    scanEffects,
    getCurrentPlayer,
    getCurrentEffect: getCurrentActionEffect,
    getMovableTokensForPlayer,
  });
  const closeScanAction4Picker = scanAction4Picker.close;
  const openScanAction4Picker = scanAction4Picker.open;

  function executeCardMoveForEffectForRoot(workingRoot, deltaX, deltaY, rocketId) {
    return requestCardEffectMoveForRoot(workingRoot, deltaX, deltaY, rocketId);
  }

  function executeCardMoveForEffect(...args) {
    const [deltaX, deltaY, rocketId] = args;
    const direction = deltaX === 1 ? "cw" : deltaX === -1 ? "ccw" : deltaY === 1 ? "out" : "in";
    return submitActiveCardDecision(
      "card-effect-move",
      (target) => Number(target.rocketId) === Number(rocketId) && target.direction === direction,
    );
  }

  function handleProbeSectorScanChoice(rocketId) {
    const pending = getPendingProbeSectorScanDecision();
    const maxTargets = Math.max(1, Math.round(Number(pending?.effect?.options?.maxTargets) || 1));
    if (maxTargets === 1) {
      return submitActiveCardDecision(
        "probe-sector-selection",
        (target) => (target.rocketIds || []).length === 1
          && String(target.rocketIds[0]) === String(rocketId),
      );
    }
    return effectChoiceFlowHelpers.handleProbeSectorScanChoice(createStateSourceReadoutRoot(), rocketId);
  }

  function confirmProbeSectorScanSelection() {
    const selected = [...(uiRuntimeState.probeSectorSelectedRocketIds || [])].map(String).sort();
    return submitActiveCardDecision(
      "probe-sector-selection",
      (target) => [...(target.rocketIds || [])].map(String).sort().join(",") === selected.join(","),
    );
  }

  function handleProbeLocationRewardChoice(rocketId) {
    return submitActiveCardDecision(
      "probe-location-reward",
      (target) => String(target.rocketId ?? target.choiceId) === String(rocketId),
    );
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
    beginAlienTraceBoardPlacement: (workingRoot, ...args) => beginAlienTraceBoardPlacementForRoot(workingRoot, ...args),
    beginCardMoveEffect,
    beginCardSelection: (workingRoot, ...args) => beginCardSelectionForRoot(workingRoot, ...args),
    beginDiscardSelection: (workingRoot, ...args) => handFlowHelpers.beginDiscardSelection(workingRoot, ...args),
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
    closeAlienTracePicker: (workingRoot) => closeAlienTracePickerForRoot(workingRoot),
    closeScanAction4Picker,
    closeScanTargetPicker,
    collectPlutoMarkers,
    completeCurrentActionEffect,
    createActionContext: createActionContextForWorkingRoot,
    createPublicScanPendingAction,
    createScanRunId,
    data,
    document,
    effectChoiceFlowHelpers,
    els,
    uiRuntimeState,
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
    getResearchTechSelectionPayload: (workingRoot) => getResearchTechSelectionPayloadForRoot(workingRoot),
    getSectorContentForMove,
    getSectorScanTargetLabel,
    hasAlienTracePanelPlacementTarget: (workingRoot, ...args) => hasAlienTracePanelPlacementTargetForRoot(workingRoot, ...args),
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
    openFangzhouTraceDestinationChoice: (workingRoot, ...args) => openFangzhouTraceDestinationChoiceForRoot(workingRoot, ...args),
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
    shouldSkipCurrentResearchTechCost: (workingRoot) => shouldSkipCurrentResearchTechCostForRoot(workingRoot),
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
    return ruleComposition.inputPort.submitHostCommand({
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

  const browserLayoutRuntime = renderRuntimeModule.createBrowserLayoutRuntime({
    window,
    document,
    els,
    techRenderContext,
    boardVisualScale: BOARD_VISUAL_SCALE,
    layoutPlayerHandFan: (...args) => layoutPlayerHandFan(...args),
    layoutReservedCardRows: (...args) => layoutReservedCardRows(...args),
    alignAlienPanelsToPlanets: (...args) => alignAlienPanelsToPlanets(...args),
    renderAlienPanels: (...args) => renderAlienPanels(...args),
    renderTechBoard: (...args) => renderTechBoard(...args),
    getMoveHighlightRocketId: () => uiRuntimeState.moveHighlightRocketId,
    scheduleRenderMoveArrows: (...args) => scheduleRenderMoveArrows(...args),
  });
  function resize(...args) { return browserLayoutRuntime.resize(...args); }
  function syncTechRenderContext(...args) { return browserLayoutRuntime.syncTechRenderContext(...args); }

  let alienSpeciesRuntime = null;
  function getPendingYichangdianCornerAction() {
    return effectExecutors?.getYichangdianCornerAction?.() || null;
  }
  function getPendingYichangdianCornerCards(workingRoot, pendingContext = null) {
    return effectExecutors?.getPendingYichangdianCornerCards?.(workingRoot, pendingContext) || [];
  }
  const alienSpeciesPort = alienSpeciesRuntimeModule.createAlienSpeciesPort({
    getRuntime: () => alienSpeciesRuntime,
    dispatchCommand: (name, args) => callBrowserDomainCommand("alien_species", name, args),
  });
  const {
    getPendingChongFossilChoice, getPendingAmibaSymbolChoice, getPendingRunezuSymbolBranch, getPendingRunezuFaceSymbolPlacement,
    getPendingRunezuCardGain, getPendingAmibaCardGain, getPendingAomomoCardGain, getPendingYichangdianCardGain,
    getPendingBanrenmaCardGain, getPendingChongCardGain, getPendingAmibaTraceRemoval, getPendingJiuzheCardPlay,
    getPendingBanrenmaOpportunity, getAlienTraceLayer, getAlienJiuzheTraceLayer, getAlienYichangdianCardArea,
    getAlienBanrenmaCardArea, getAlienChongCardArea, getAlienAmibaCardArea, getAlienAomomoCardArea,
    getAlienRunezuCardArea, getAlienJiuzheThresholdElement, getAlienBanrenmaScoremarkElement, getAlienBackImage,
    createJiuzheThresholdNode, renderJiuzheThresholds, maybeRevealAlienAfterTrace, isDebugAlienTraceMode,
    setDebugAlienTraceModeActive, toggleDebugAlienTraceMode, enableDebugAlienTraceModeForReveal, renderYichangdianCardDisplays,
    renderBanrenmaScoremarks, renderBanrenmaCardDisplays, renderChongCardDisplays, renderAmibaCardDisplays,
    renderAomomoCardDisplays, renderRunezuCardDisplays, renderBanrenmaBonusMarkers, renderAlienPanels,
    randomizeAliens, applyFangzhouUnlockStateTraceReward, confirmFangzhouCard2Unlock, getAlienFangzhouCardArea,
    createFangzhouReservedButtons, buildFangzhouCard1EffectQueue, getFangzhouCard1RewardTargetOptions, enqueueFangzhouCard1RewardEffects,
    flipFangzhouCard1Rewards, applyFangzhouCard1Rewards, applyFangzhouCard1Reward, queueFangzhouBasicRewards,
    applyFangzhouTraceRewardToPlayer, renderFangzhouCardDisplays, openFangzhouCard1Dialog, findPlayerForJiuzheEntry,
    applyJiuzheRewardToPlayer, findPlayerForYichangdianEntry, applyYichangdianRewardToPlayer, getAvailableDataTokenCount,
    spendAvailableDataTokens, applyBanrenmaRewardToPlayer, applyAomomoRewardToPlayer, applyChongRewardToPlayer,
    applyAmibaRewardToPlayer, applyRunezuRewardToPlayer, applyRunezuSymbolReward, claimRunezuSourceSymbolWithHistory,
    closeRunezuCardGainDialog, openRunezuCardGainDialog, finishRunezuCardGain, handleRunezuCardGainChoice,
    closeAmibaCardGainDialog, openAmibaCardGainDialog, finishAmibaCardGain, handleAmibaCardGainChoice,
    closeAomomoCardGainDialog, openAomomoCardGainDialog, finishAomomoCardGain, handleAomomoCardGainChoice,
    closeAmibaSymbolChoiceDialog, openAmibaSymbolChoiceDialog, finishAmibaSymbolChoice, handleAmibaSymbolChoice,
    closeAmibaTraceRemovalDialog, openAmibaTraceRemovalDialog, handleAmibaTraceRemovalChoice, applyChongFossilRewardToPlayer,
    closeYichangdianCardGainDialog, openYichangdianCardGainDialog, finishYichangdianCardGain, handleYichangdianCardGainChoice,
    closeBanrenmaCardGainDialog, openBanrenmaCardGainDialog, finishBanrenmaCardGain, handleBanrenmaCardGainChoice,
    closeChongCardGainDialog, openChongCardGainDialog, finishChongCardGain, handleChongCardGainChoice,
    getChongPlanetLabel, formatChongGain, formatChongFossilRewardSummary, restoreMutableObject,
    closeChongFossilChoiceDialog, openChongFossilChoiceDialog, createChongTransportTokenForFossil, openChongPickCardFollowUp,
    keepExistingMainActionPendingAfterChongTask, failChongTaskCompletion, finishChongFossilEffect, completeChongTraceTaskWithFossil,
    handleChongFossilChoice, openChongTraceTaskCompletionPicker, enqueueJiuzheOpportunity, isJiuzheThresholdOpportunity,
    createJiuzheThresholdCardEffect, hasJiuzheThresholdEffectQueued, queueJiuzheThresholdEffectForPlayer, queueJiuzheOpportunitiesForPlayer,
    buildJiuzheCardConditionContext, getJiuzheCardConditionLabel, closeJiuzheCardDialog, buildJiuzheOpportunitySubtitle,
    openJiuzheCardDialog, handleJiuzheCardChoice, handleJiuzheOpportunitySkip, maybeOpenQueuedJiuzheOpportunity,
    getActiveAlienSharedOverlayPendingForManualGuard, blockManualAiSharedOverlayInputIfNeeded, getReadyBanrenmaCards, getReadyBanrenmaCardsForOpportunity,
    getReadyBanrenmaCardForOpportunity, createBanrenmaPanelBonusEffect, hasBanrenmaPanelBonusEffectQueued, queueBanrenmaPanelBonusEffectForPlayer,
    enqueueBanrenmaOpportunity, queueBanrenmaOpportunitiesForPlayer, closeBanrenmaOpportunityDialog, getBanrenmaCardConditionLabel,
    openBanrenmaCardConditionCompletionPicker, openBanrenmaOpportunityDialog, maybeOpenQueuedBanrenmaOpportunity, openBanrenmaReadyOpportunityForPlayer,
    executeJiuzheThresholdCardEffect, executeBanrenmaPanelBonusEffect, completeBanrenmaOpportunityStep, handleBanrenmaBonusChoice,
    handleBanrenmaCardConditionChoice, appendRevealCardGrantMessage, getRevealIrreversible, openChongRewardFollowUps,
    openAmibaRewardFollowUps, openRunezuRewardFollowUps, closeRunezuFaceSymbolPlacement, executeStandardRunezuFaceSymbol,
    openRunezuFaceSymbolPlacement, handleRunezuFaceSymbolChoice, executeRunezuSymbolRewardEffect, closeRunezuSymbolBranchDialog,
    openRunezuSymbolBranchDialog, handleRunezuSymbolBranchChoice, alignAlienPanelsToPlanets,
  } = alienSpeciesPort;
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

  const FINAL_RESULT_PLAYER_COLOR_ORDER = Object.freeze(["white", "brown", "blue", "green"]);

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
  const industryCommands = bindDomainCommands("industry_runtime", [
    "createIndustryActionRestoreCommand", "recordIndustryActionRestoreCommand", "clearIndustryRollbackUi",
    "rollbackPendingIndustryQuickAction", "cancelIndustryAbilityFlow", "finishIndustryAbilityFlow",
    "startIndustryAbilityFlow", "startIndustryStratusEffectFlow", "startIndustryFundamentalismExchangeFlow",
    "startIndustryPublicityPick", "beginIndustryTuringBorrow", "failIndustryTuringBorrow",
    "checkIndustryTuringBorrowTile", "confirmIndustryTuringBorrow", "openIndustryHeliosTechPicker",
    "confirmIndustryHeliosRemoveTech", "startIndustryHuanyuMoveEffectFlow", "beginIndustryHuanyuFreeMoves",
    "canBeginIndustryFutureSpanHandSelection", "beginIndustryFutureSpanHandSelection",
    "handleIndustryFutureSpanHandClick", "handleIndustryDeepspaceHandClick", "finalizeIndustryDeepspaceSwap",
    "handleAlienLabPanelClick", "maybeConsumeAlienLabPanelForMainAction", "maybeApplyIndustryLaunchScan",
    "startLaunchSectorFinishEffectFlow", "appendIndustryPlayPassiveStatus", "buildIndustryPlayCardAppendEffects",
    "buildPlayCardEffectFlowQueue", "applyIndustryPlayCardPassives", "completeIndustryAbilityQuickStep",
    "commitIrreversibleIndustryQuickAction", "tryInjectSentinelPlayCornerEffectAfterArm",
    "executeIndustryStratusCornerEffect", "executeIndustrySentinelCornerEffect", "createCompanyCardSummary",
    "executeIndustryHeliosPassiveRewardEffect", "getStrategyPassiveSelectableSlotIds",
    "cancelStrategyPassiveSlotChoice", "openStrategyPassiveSlotChoice", "confirmStrategyPassiveSlotChoice",
    "finishIndustryStrategyPassiveRewardEffect", "executeIndustryStrategyPassiveRewardEffect",
    "handleStrategyPassiveSlotClick", "handleCompanyActionMarkerClick",
  ]);
  const {
    createIndustryActionRestoreCommand, recordIndustryActionRestoreCommand, clearIndustryRollbackUi,
    rollbackPendingIndustryQuickAction, cancelIndustryAbilityFlow, finishIndustryAbilityFlow,
    startIndustryAbilityFlow, startIndustryStratusEffectFlow, startIndustryFundamentalismExchangeFlow,
    startIndustryPublicityPick, beginIndustryTuringBorrow, failIndustryTuringBorrow,
    checkIndustryTuringBorrowTile, confirmIndustryTuringBorrow, openIndustryHeliosTechPicker,
    confirmIndustryHeliosRemoveTech, startIndustryHuanyuMoveEffectFlow, beginIndustryHuanyuFreeMoves,
    canBeginIndustryFutureSpanHandSelection, beginIndustryFutureSpanHandSelection,
    handleIndustryFutureSpanHandClick, handleIndustryDeepspaceHandClick, finalizeIndustryDeepspaceSwap,
    handleAlienLabPanelClick, maybeConsumeAlienLabPanelForMainAction, maybeApplyIndustryLaunchScan,
    startLaunchSectorFinishEffectFlow, appendIndustryPlayPassiveStatus, buildIndustryPlayCardAppendEffects,
    buildPlayCardEffectFlowQueue, applyIndustryPlayCardPassives, completeIndustryAbilityQuickStep,
    commitIrreversibleIndustryQuickAction, tryInjectSentinelPlayCornerEffectAfterArm,
    executeIndustryStratusCornerEffect, executeIndustrySentinelCornerEffect, createCompanyCardSummary,
    executeIndustryHeliosPassiveRewardEffect, getStrategyPassiveSelectableSlotIds,
    cancelStrategyPassiveSlotChoice, openStrategyPassiveSlotChoice, confirmStrategyPassiveSlotChoice,
    finishIndustryStrategyPassiveRewardEffect, executeIndustryStrategyPassiveRewardEffect,
    handleStrategyPassiveSlotClick, handleCompanyActionMarkerClick,
  } = industryCommands;
  function executeIndustryFreeMove(deltaX, deltaY, rocketId) {
    const direction = deltaX === 1 ? "cw" : deltaX === -1 ? "ccw" : deltaY === 1 ? "out" : "in";
    return submitActiveCardDecision(
      "industry-free-move",
      (target) => Number(target.rocketId) === Number(rocketId) && target.direction === direction,
    );
  }

  const techRuntime = techRuntimeModule.createTechRuntime({
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
    getResearchTechSelectionEffect: getResearchTechSelectionEffectForRoot,
    getResearchTechSelectionPayload: getResearchTechSelectionPayloadForRoot,
    getResearchTechSelectionOptions: getResearchTechSelectionOptionsForRoot,
    isTechTileOwnedByOtherPlayer: isTechTileOwnedByOtherPlayerForRoot,
    shouldSkipCurrentResearchTechCost: shouldSkipCurrentResearchTechCostForRoot,
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
  const getResearchTechSelectionEffect = () => getResearchTechSelectionEffectForRoot(createStateSourceReadoutRoot());
  const getResearchTechSelectionPayload = () => getResearchTechSelectionPayloadForRoot(createStateSourceReadoutRoot());
  const getResearchTechSelectionOptions = () => getResearchTechSelectionOptionsForRoot(createStateSourceReadoutRoot());
  const shouldSkipCurrentResearchTechCost = () => shouldSkipCurrentResearchTechCostForRoot(createStateSourceReadoutRoot());
  const {
    isTechActionSelectionActive, isTechTilePickingActive, syncTechSelectionChrome, renderTechBoard,
    closeTechBlueSlotPicker, isTechTileOwnedByOtherPlayer, appendResearchTechFollowupEffects,
    onTechTileSelected, onTechTileTaken, clearResearchTechSelectionState, restoreResearchTechSelectionAfterUndo,
    cancelPendingResearchTechTileChoice, cancelTechSelection, openTechBlueSlotPicker, finalizeTechTakeResult,
    commitResearchTechSelectionResult, selectResearchTechTileForCurrentFlow, confirmTechBlueSlotChoice,
    handleSupplyTechTileClick, executeIndustryPiratesRaidMarkerEffect, handlePiratesRaidTechMarkerClick,
    executeIndustryPiratesRaidPublicityEffect, startIndustryPiratesRaidLaunchFlow, buildPiratesRaidLaunchChoices,
    executeIndustryPiratesRaidLaunchEffect, handlePiratesRaidLaunchChoice, setCheatModeOpen, toggleCheatMode,
  } = bindDomainCommands("tech_runtime", [
    "isTechActionSelectionActive", "isTechTilePickingActive", "syncTechSelectionChrome", "renderTechBoard",
    "closeTechBlueSlotPicker", "isTechTileOwnedByOtherPlayer", "appendResearchTechFollowupEffects",
    "onTechTileSelected", "onTechTileTaken", "clearResearchTechSelectionState", "restoreResearchTechSelectionAfterUndo",
    "cancelPendingResearchTechTileChoice", "cancelTechSelection", "openTechBlueSlotPicker", "finalizeTechTakeResult",
    "commitResearchTechSelectionResult", "selectResearchTechTileForCurrentFlow", "confirmTechBlueSlotChoice",
    "handleSupplyTechTileClick", "executeIndustryPiratesRaidMarkerEffect", "handlePiratesRaidTechMarkerClick",
    "executeIndustryPiratesRaidPublicityEffect", "startIndustryPiratesRaidLaunchFlow", "buildPiratesRaidLaunchChoices",
    "executeIndustryPiratesRaidLaunchEffect", "handlePiratesRaidLaunchChoice", "setCheatModeOpen", "toggleCheatMode",
  ]);

  function placeDataToBlueSlot(blueSlot) {
    return ruleComposition.inputPort.submitHostCommand({
      kind: "data_place_blue_slot",
      blueSlot,
    }).value;
  }

  function queueStateReadoutRender() {
    if (uiRuntimeState.stateReadoutRenderFrame) return;
    uiRuntimeState.stateReadoutRenderFrame = window.requestAnimationFrame(() => {
      uiRuntimeState.stateReadoutRenderFrame = 0;
      renderStateReadout();
    });
  }

  let legacyActionBarController = null;
  const legacyActionBarPort = browserHostModule.actionBar.createLegacyActionBarPort({
    getController: () => legacyActionBarController,
  });
  const {
    setActionButtonState, setTurnActionButtonState, setQuickActionButtonEnabled, updateActionButtons,
    isQuickPanelOpen, setQuickPanelOpen, toggleQuickPanel, updateQuickPanel,
  } = legacyActionBarPort;

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
    return ruleComposition.inputPort.submitHostCommand({ kind: "action_recover_pending" }).value;
  }

  turnEndFlow = turnEndFlowModule.createTurnEndFlow({
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

  let legacyUndoController = null;
  function undoPendingActionForRoot(workingRoot) {
    return legacyUndoController.undoPendingActionForRoot(workingRoot);
  }

  function undoPendingAction() {
    return ruleComposition.inputPort.submitHostCommand({ kind: "history_undo_pending" }).value;
  }


  function resumeDataPlacementContinuation(workingRoot, pending, outcome) {
    const effect = pending?.effect;
    if (!effect) return { ok: false, message: "放置数据续体缺少效果上下文" };
    if (pending.resumeKind === "gain-data-reward") {
      const player = effectExecutors.getEffectTargetPlayer(workingRoot, effect);
      return effectExecutors.finishGainDataRewardEffect(
        workingRoot,
        effect,
        player,
        Math.max(0, Math.round(effect.options?.count || 0)),
        effect.options?.source || "planet_reward",
        {
          placementMessages: outcome.messages,
          restoreRecorded: outcome.restoreRecorded,
          skipGain: outcome.skipped,
        },
      );
    }
    if (pending.resumeKind === "industry-strategy-passive") {
      return industryRuntime.finishIndustryStrategyPassiveRewardEffect(workingRoot, effect, {
        placementMessages: outcome.messages,
        restoreRecorded: outcome.restoreRecorded,
        beforePlayerState: outcome.beforePlayerState,
        skipDataGain: outcome.skipped,
      });
    }
    return { ok: false, message: `未知放置数据续体：${pending.resumeKind || "missing"}` };
  }

  actionInteractionRuntime = actionInteractionRuntimeModule.createActionInteractionRuntime({
    HISTORY_SOURCE_MAIN,
    SCORE_SOURCE_KEYS,
    abilities,
    actionShared,
    addPlayerScoreSource,
    beginCardSelection,
    beginDiscardSelection,
    beginEffectHistoryStep,
    beginQuickActionStep,
    blockIncompatiblePendingQuickAction,
    blockIncompatiblePendingQuickActionForRoot,
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
    hasActiveCardTriggerResolution,
    historyCommands,
    isActionEffectFlowActive,
    isMovePaymentSelectionActive,
    markerBelongsToPlayer,
    markerOwnerLabel,
    openLandTargetPicker,
    players,
    quickActionHistory,
    recordAtomicActionHistory,
    recordAbilityCommands,
    recordHistoryCommand,
    recordQuickHistoryCommand,
    removeRocketElement,
    renderInitialSelectionArea,
    renderPlayerStats,
    renderReservedCards,
    renderRocketElement,
    renderRockets,
    renderStateReadout,
    resumeDataPlacementContinuation,
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
    completeQuickActionStep,
  });

  legacyActionBarController = browserHostModule.actionBar.createLegacyActionBarController({
    els,
    actions,
    abilities,
    scanEffects,
    quickTrades,
    actionHistory,
    quickActionHistory,
    syncFinalResultButton,
    createReadoutRoot: createStateSourceReadoutRoot,
    createActionContext: createActionContextForWorkingRoot,
    createReadoutActionContext,
    getGameplayLockReason,
    isAiPlayer: isAiAutoBattlePlayer,
    isAiAutomationPaused,
    lockAllActionButtons,
    isTechTilePickingActive,
    isCardSelectionActive,
    isDiscardSelectionActive,
    isPlayCardSelectionActive,
    isMovePaymentSelectionActive,
    isHandScanSelectionActive,
    isActionEffectFlowActive,
    isActionPending,
    canUndoCurrentMainAction,
    hasCurrentMainActionIrreversibleBarrier,
    canStartMainAction,
    hasActivePendingSubFlow,
    isInitialIncomeFlowActive,
    renderActionEffectBar,
    getAvailablePlutoAction,
    canAnalyzeDataForPlayer,
    getCurrentPlayer,
    getStandardPlayCardActionBlockReason,
    hasPlayableFutureSpanCard,
    cancelHandCardContextActions,
  });
  legacyUndoController = browserHostModule.actionBar.createLegacyUndoController({
    actionHistory,
    quickActionHistory,
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    uiRuntimeState,
    isTechActionSelectionActive,
    getActionEffectFlow,
    hasCurrentMainActionIrreversibleBarrier,
    cancelPendingResearchTechTileChoice,
    cancelTechSelection,
    isActionPending,
    isActionEffectFlowActive,
    hasActivePendingSubFlow,
    cancelActivePendingSubFlowsForRoot,
    refreshAfterHistoryChange,
    getLatestUndoSource,
    clearHistoryStepOrderForSource,
    clearActionEffectFlow,
    forgetLastHistoryStep,
    removeLastActionLogStep,
    takeCompletedEffectFlowForUndo,
    setActionEffectFlow,
    setActionEffectFlowActive: (active) => interactionChrome.setActionEffectFlowActive(active),
    revertEffectFlowAfterUndo,
    getCurrentActionIrreversibleReason,
    updateActionButtons,
    renderStateReadout,
    clearFullyUndoneMainActionSession,
    peekCompletedEffectFlowForUndo,
    removeActionLogStepsBySource,
    clearActionPending,
  });

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
    return ruleComposition.inputPort.submitHostCommand({ kind: "data_open_computer_picker" }).value;
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

  function resumeLandTargetContinuation(workingRoot, pending, choice) {
    const actionType = pending.actionType || choice.actionType || (choice.kind === "orbit" ? "orbit" : "land");
    if (pending.resumeKind === "main-planet-action") {
      if (choice.kind === "pluto") {
        return actionInteractionRuntime.executePlutoAction(workingRoot, actionType, {
          preferredRocketId: choice.preferredRocketId,
        });
      }
      return runAction(actionType, actionType === "land"
        ? { target: choice.target, rocketId: choice.rocketId }
        : { rocketId: choice.rocketId });
    }
    const effect = getCurrentActionEffect(workingRoot);
    if (!effect || (pending.effectId && effect.id !== pending.effectId)) {
      return { ok: false, code: "LAND_TARGET_EFFECT_STALE", message: "登陆目标所属效果已失效" };
    }
    if (pending.resumeKind === "card-pluto-action") {
      if (choice.kind === "pluto") {
        return effectExecutors.executePlutoCardActionEffect(workingRoot, effect, actionType, choice.available, {
          preOwnLandingMarker: choice.preOwnLandingMarker,
        });
      }
      if (actionType === "orbit") return effectExecutors.executeNormalCardOrbitEffect(workingRoot, effect, choice);
      return effectExecutors.executeCardLandTarget(workingRoot, effect, choice.target, {
        preOwnLandingMarker: choice.preOwnLandingMarker,
      });
    }
    if (pending.resumeKind === "chong-travel") {
      return effectExecutors.executeChongTravelForPickupChoice(workingRoot, effect, choice);
    }
    return { ok: false, code: "LAND_TARGET_RESUME_UNMIGRATED", message: `未知登陆目标续体：${pending.resumeKind}` };
  }

  function confirmLandTargetChoiceForRoot(workingRoot, choiceIndex = 0) {
    const pending = getPendingLandTargetDecision(workingRoot);
    return withPendingOwnerPlayer(pending, () => {
    if (!pending?.choices?.length) {
      closeLandTargetPicker(workingRoot);
      setBrowserStatusNote("登陆目标已失效");
      renderStateReadout();
      return { ok: false, message: "登陆目标已失效" };
    }
    const choice = pending.choices[choiceIndex] || pending.choices[0];
    closeLandTargetPicker(workingRoot);
    return resumeLandTargetContinuation(workingRoot, pending, choice);
    });
  }

  function confirmLandTargetChoice(choiceIndex = 0) {
    return submitActiveCardDecision(
      "land-target",
      (target) => Number(target.choiceId) === Number(choiceIndex),
    );
  }

  function getSimulationConditionalPlayer(workingRoot, pending) {
    return resolvePlayerReference(workingRoot, {
      playerId: pending?.playerId || pending?.targetPlayerId || null,
      playerColor: pending?.playerColor || pending?.targetPlayerColor || null,
    }) || getEffectOwnerPlayer(workingRoot, pending?.effect) || getCurrentPlayer(workingRoot);
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
    return ruleComposition.inputPort.submitHostCommand({ kind: "debug_execute_income" }).value;
  }

  const debugRuntimeController = debugRuntimeModule.createDebugRuntime({
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
    closeAlienTracePicker: (workingRoot) => closeAlienTracePickerForRoot(workingRoot),
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
  });
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
    get alienTracePickerState() { return uiRuntimeState.alienTracePickerState; },
    set alienTracePickerState(value) { uiRuntimeState.alienTracePickerState = value; },
    get pendingAlienRevealConfirmation() { return uiRuntimeState.alienRevealConfirmation; },
    get moveHighlightRocketId() { return uiRuntimeState.moveHighlightRocketId; },
    get pendingCardTriggerFreeMove() { return getPendingCardTriggerFreeMove(); },
    get pendingCardCornerFreeMove() { return getPendingCardCornerFreeMove(); },
    get pendingActionEffectFlow() { return getActionEffectFlow(); },
  };

  alienSpeciesRuntime = alienSpeciesRuntimeModule.createAlienSpeciesRuntime({
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
    closeAlienTracePicker: (workingRoot) => closeAlienTracePickerForRoot(workingRoot),
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
    hasAlienTracePanelPlacementTarget: (workingRoot, ...args) => hasAlienTracePanelPlacementTargetForRoot(workingRoot, ...args),
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

  window.SetiAppEvents.bindAppEvents({
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
    getActiveDecisionChoices: () => ruleComposition.inspect().session?.decision?.choices || [],
    setStatusNote: setBrowserStatusNote,
    randomizeAll,
    startNewGameFromStartScreen,
    continueGameFromStartScreen,
    syncStartScreenDebugOption,
    syncStartScreenActionLogOption,
    handleStartAlienOptionChange,
    handleStartIndustryOptionChange,
    launchRocketForCurrentPlayer,
    orbitForCurrentPlayer,
    landForCurrentPlayer,
    dispatchStandardIntent: (family) => dispatchBrowserRuleInput({ kind: "standard_intent", family }),
    beginPlayCardSelection,
    researchTechForCurrentPlayer,
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
    confirmProbeSectorScanSelection: (workingRoot, ...args) => effectChoiceFlowHelpers.confirmProbeSectorScanSelection(workingRoot, ...args),
    handleProbeLocationRewardChoice: (workingRoot, ...args) => effectChoiceFlowHelpers.handleProbeLocationRewardChoice(workingRoot, ...args),
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
    initializeShell() {
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

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
    browserRuleCompositionModule,
    runtimeModule,
    refreshModule,
    renderRuntimeModule,
    playerStatsUiModule,
    debugRuntimeModule,
    finalUiRuntimeModule,
    finalScoreAiRuntimeModule,
    aiControlRuntimeModule,
    aiBrowserBootstrapModule,
    actionBriefingModule,
    effectFlowModule,
    effectChoiceFlowModule,
    effectMovementScanExecutorsModule,
    effectRewardExecutorsModule,
    effectAlienExecutorsModule,
    effectDispatcherModule,
    effectExecutorBootstrapModule,
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
  const runAiFinalScoreMarkDecision = finalScoreAiRuntimeModule.createFinalScoreAiPort({
    getRuntime: () => finalScoreAiRuntime,
  }).runDecision;
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
  const browserDomainCommandPort = browserHostModule.browserServices.createDomainCommandPort({
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
  const browserHostCommandPort = browserHostModule.browserServices.createHostCommandPort({
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
  });
  const effectChoiceCommandPort = browserDomainCommandPort.bindEffectChoiceCommands();
  const {
    handleConditionalSectorChoice,
    handleDiscardIncomeCardChoice,
    confirmDiscardAnyForIncome,
    handlePayCreditChoice,
    handleFundamentalismExchangeChoice,
    handleDiscardCornerRepeatChoice,
    handleRemoveOrbitToProbeChoice,
  } = effectChoiceCommandPort;
  const effectExecutorCommandPort = browserDomainCommandPort.bindEffectExecutorCommands();
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
  } = effectExecutorCommandPort;
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
  const debugIncomeAdapter = debugRuntimeModule.createDebugIncomeAdapter({
    players,
    applyIncomeResourcesForPlayer: (...args) => applyIncomeResourcesForPlayer(...args),
    renderPlayerStats: (...args) => renderPlayerStats(...args),
    renderPublicCards: (...args) => renderPublicCards(...args),
    updatePublicCardControls: (...args) => updatePublicCardControls(...args),
    updateActionButtons: (...args) => updateActionButtons(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
  });
  const executeIncomeForCurrentPlayerForRoot = debugIncomeAdapter.executeForRoot;
  const executeIncomeForCurrentPlayer = debugIncomeAdapter.execute;
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
  const dataAnalyzeInteractionRuntime = actionInteractionRuntimeModule.createDataAnalyzeInteractionRuntime({
    data,
    industry,
    players,
    planetRewards,
    historySourceMain: "main",
    blockIncompatiblePendingQuickActionForRoot: (...args) => blockIncompatiblePendingQuickActionForRoot(...args),
    getGameplayLockReason: (...args) => getGameplayLockReason(...args),
    isTechTilePickingActive: (...args) => isTechTilePickingActive(...args),
    isCardSelectionActive: (...args) => isCardSelectionActive(...args),
    isDiscardSelectionActive: (...args) => isDiscardSelectionActive(...args),
    isPlayCardSelectionActive: (...args) => isPlayCardSelectionActive(...args),
    isMovePaymentSelectionActive: (...args) => isMovePaymentSelectionActive(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
    openDataPlacePicker: (...args) => openDataPlacePicker(...args),
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
    runAction: (...args) => runAction(...args),
    startCardEffectFlow: (...args) => startCardEffectFlow(...args),
  });
  const {
    runPlaceDataToComputerForRoot,
    runPlaceDataToComputer,
    canAnalyzeDataForPlayer,
    getAnalyzeActionOptionsForPlayer,
    analyzeDataForCurrentPlayer,
    startAnalyzeDataRewardFlow,
  } = dataAnalyzeInteractionRuntime;
  const landTargetContinuationRuntime = actionInteractionRuntimeModule.createLandTargetContinuationRuntime({
    executePlutoAction: (...args) => actionInteractionRuntime.executePlutoAction(...args),
    runAction: (...args) => runAction(...args),
    getCurrentActionEffect: (...args) => getCurrentActionEffect(...args),
    effectExecutors: () => effectExecutors,
    getPendingLandTargetDecision: (...args) => getPendingLandTargetDecision(...args),
    withPendingOwnerPlayer: (...args) => withPendingOwnerPlayer(...args),
    closeLandTargetPicker: (...args) => closeLandTargetPicker(...args),
    setBrowserStatusNote: (...args) => setBrowserStatusNote(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
  });
  const resumeLandTargetContinuation = landTargetContinuationRuntime.resume;
  const confirmLandTargetChoiceForRoot = landTargetContinuationRuntime.confirmForRoot;
  const browserWorkingStateAdapter = runtimeModule.createBrowserRuleStateAdapter({
    initialGameState: initialGameStateModule,
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
    defaultInitialPlayerColor: players.DEFAULT_PLAYER_COLOR,
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    finalScoreIds: FINAL_SCORE_IDS,
    sequenceOwners: { cards, players, finalScoring, data, history: actionHistoryModule },
    history: actionHistoryModule,
    getActionLogSequence: () => actionLogState.nextEntryId,
  });
  const {
    createWorkingState: createBrowserWorkingState,
    restoreWorkingState: restoreBrowserWorkingState,
    validateSessionBoundary: validateBrowserSessionBoundary,
    getCommittedContext: getBrowserCommittedContext,
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
  const compositionActionRegistry = actionRuntimeModule.createCompositionActionRegistry({
    getController: () => actionRuntimeController,
    createActionContext: (...args) => createActionContextForWorkingRoot(...args),
  });
  const standardActionContinuation = conditionalActionExecutorModule.createStandardActionContinuation({
    enumerateConditionalActionsForRoot: (...args) => enumerateSimulationConditionalActionsForRoot(...args),
    enumerateTurnActionsForRoot: (...args) => enumerateSimulationTurnActionsForRoot(...args),
    getCurrentPlayer: (playerState) => players.getCurrentPlayer(playerState),
    getCurrentActionEffect: (...args) => getCurrentActionEffect(...args),
    isActionEffectFlowActive: (...args) => isActionEffectFlowActive(...args),
    advanceDeterministicStateForRoot: (...args) => advanceSimulationDeterministicStateImpl(...args),
    executeCurrentActionEffectForRoot: (...args) => executeSimulationCurrentActionEffectImpl(...args),
    executeEffectChoice: (...args) => conditionalActionExecutor.executeEffectChoice(...args),
    getAlienSpeciesRuntime: () => alienSpeciesRuntime,
    getEffectExecutors: () => effectExecutors,
    closeScanTargetPickerForRoot: (...args) => closeScanTargetPickerForRoot(...args),
  });
  const effectChoiceCommandHandler = browserHostModule.browserServices.createOperationCommandHandler({
    getTarget: () => effectChoiceFlowHelpers,
    clonePresentation: cloneResidentPresentation,
    unknownCode: "EFFECT_CHOICE_COMMAND_UNKNOWN",
    label: "Effect choice",
  });
  const handFlowCommandHandler = browserHostModule.browserServices.createOperationCommandHandler({
    getTarget: () => handFlowHelpers,
    clonePresentation: cloneResidentPresentation,
    unknownCode: "HAND_FLOW_COMMAND_UNKNOWN",
    label: "Hand flow",
  });
  const effectExecutorCommandHandler = browserHostModule.browserServices.createOperationCommandHandler({
    getTarget: () => effectExecutors,
    clonePresentation: cloneResidentPresentation,
    unknownCode: "EFFECT_EXECUTOR_COMMAND_UNKNOWN",
    label: "Effect executor",
  });
  const debugCommandHandler = browserHostModule.browserServices.createOperationCommandHandler({
    getTarget: () => debugRuntimeController,
    clonePresentation: cloneResidentPresentation,
    unknownCode: "DEBUG_COMMAND_UNKNOWN",
    label: "Debug",
  });
  const aiDifficultyCommandHandler = aiControlRuntimeModule.createAiDifficultyCommandHandler();
  const statusNoteCommandHandler = browserHostModule.browserServices.createStatusNoteCommandHandler();
  const hostCommandDispatcher = browserHostModule.browserServices.createHostCommandDispatcher({
    getHandlers: () => ({
      turn_set_player_order: (root, command) => (turnFlowController.setTurnStatePlayerOrder(root, command.playerIds, command.options), { ok: true }),
      turn_randomize_player_order: (root) => (turnFlowController.randomizePlayerTurnOrder(root), { ok: true }),
      turn_begin_next_round: (root) => ({ ok: true, ...turnFlowController.beginNextRound(root) }),
      turn_advance_after_action: (root, command) => ({ ok: true, ...turnFlowController.advanceTurnAfterPlayerAction(root, command.playerId, command.options) }),
      turn_start_new_game: (root, command) => turnFlowController.startNewGame(root, command.options),
      turn_randomize_all: (root) => (turnFlowController.randomizeAll(root), { ok: true }),
      setup_start_initial_selection: (root) => (actionRuntimeController.startInitialSelection(root), { ok: true }),
      setup_select_initial_card: (root, command) => (actionRuntimeController.handleInitialSelectionCardClick(root, command.selectionKind, command.cardId), { ok: true }),
      setup_confirm_initial_selection: (root) => (actionRuntimeController.confirmInitialSelectionForCurrentPlayer(root), { ok: true }),
      coordinate_sync_planet_markers: (root) => (coordinateRuntime.syncPlanetOrbitLandMarkers(root), { ok: true }),
      coordinate_seed_reference_rockets: (root) => (coordinateRuntime.seedDefaultReferenceRockets(root), { ok: true }),
      ai_set_player_difficulty: aiDifficultyCommandHandler,
      ui_execute_primary_board_action: (root, command) => cloneResidentPresentation(actionRuntimeController?.executePrimaryBoardAction(createActionContextForWorkingRoot(root, command.descriptor), command.descriptor, command.executionOptions, command.options)),
      score_build_final_summary: (root) => ({ ok: true, value: buildFinalScoreSummaryLinesForRoot(root) }),
      score_sync_pending_marks: (root) => cloneResidentPresentation(syncFinalScorePendingMarksForRoot(root)),
      score_mark_tile: (root, command) => cloneResidentPresentation(handleFinalScoreTileClickForRoot(root, command.tileId)),
      ui_get_required_move_points: (root, command) => ({ ok: true, value: getRequiredMovePointsForUiForRoot(root, ...(command.args || [])) }),
      ui_set_status_note: statusNoteCommandHandler,
      land_target_open: (root, command) => ({ ok: true, value: cloneResidentPresentation(openLandTargetPicker(root, command.options)) }),
      land_target_cancel: (root) => ({ ok: true, value: cloneResidentPresentation(cancelLandTargetPicker(root)) }),
      card_toggle_public_corner_discard: (root, command) => ({ ok: true, value: cloneResidentPresentation(handlePublicCornerDiscardCardClickForRoot(root, command.slotIndex)) }),
      card_confirm_public_corner_discard: (root) => ({ ok: true, value: cloneResidentPresentation(confirmPublicCornerDiscardSelectionForRoot(root)) }),
      quick_action_check_pending: (root, command) => ({ ok: true, value: cloneResidentPresentation(blockIncompatiblePendingQuickActionForRoot(root, command.actionType)) }),
      card_execute_free_move_corner: (root, command) => cloneResidentPresentation(executeFreeMoveForCardCornerForRoot(root, ...(command.args || []))),
      rocket_current_planet: (root, command) => ({ ok: true, value: getRocketCurrentPlanetIdForRoot(root, command.rocketId) }),
      chong_ready_transports: (root, command) => ({ ok: true, value: cloneResidentPresentation(listReadyChongTransportCandidatesForRoot(root, command.player, command.task)) }),
      scan_execute_free_move: (root, command) => cloneResidentPresentation(executeFreeMoveForScanAction4ForRoot(root, ...(command.args || []))),
      effect_choice_command: effectChoiceCommandHandler,
      hand_flow_command: handFlowCommandHandler,
      effect_executor_command: effectExecutorCommandHandler,
      debug_command: debugCommandHandler,
      recovery_clear_transient: (root) => (clearTransientStateForRecovery(root), { ok: true }),
      recovery_refresh: (root, command) => (refreshAfterGameRecovery(command.message, root), { ok: true }),
      effect_bar_click: (root, command) => ({ ok: true, value: cloneResidentPresentation(handleActionEffectButtonClickForRoot(root, command.effectIndex)) }),
      effect_skip_current: (root) => ({ ok: true, value: cloneResidentPresentation(skipCurrentActionEffectForRoot(root)) }),
      effect_cancel_subflows: (root) => (cancelActiveEffectSubFlowsForRoot(root), { ok: true }),
      effect_finish_flow: (root) => ({ ok: true, value: cloneResidentPresentation(finishActionEffectFlowForRoot(root)) }),
      effect_begin_scan_free_move: (root) => ({ ok: true, value: cloneResidentPresentation(beginScanAction4FreeMoveForRoot(root)) }),
      effect_begin_card_move: (root, command) => ({ ok: true, value: cloneResidentPresentation(beginCardMoveEffectForRoot(root, command.effect)) }),
      effect_cancel_pending_subflows: (root) => ({ ok: true, value: cancelActivePendingSubFlowsForRoot(root) }),
      data_place_blue_slot: (root, command) => ({ ok: true, value: cloneResidentPresentation(actionInteractionRuntime.placeDataToBlueSlot(root, command.blueSlot)) }),
      action_recover_pending: (root) => ({ ok: true, value: cloneResidentPresentation(recoverPendingActionFromOpenHistoryForAiForRoot(root)) }),
      history_undo_pending: (root) => ({ ok: true, value: cloneResidentPresentation(undoPendingActionForRoot(root)) }),
      data_open_computer_picker: (root) => ({ ok: true, value: cloneResidentPresentation(runPlaceDataToComputerForRoot(root)) }),
      debug_execute_income: (root) => ({ ok: true, value: cloneResidentPresentation(executeIncomeForCurrentPlayerForRoot(root)) }),
      solar_rotate: (root, command) => ({ ok: true, value: cloneResidentPresentation(rotateSolarOrbitForRoot(root, command.count)) }),
      scan_settle_completed_sectors: (root, command) => ({ ok: true, value: cloneResidentPresentation(resolveCompletedSectorSettlementsForRoot(root, command.actionType, command.options)) }),
      card_execute_move_effect: (root, command) => cloneResidentPresentation(executeCardMoveForEffectForRoot(root, ...(command.args || []))),
      domain_command: (root, command) => executeBrowserDomainCommand(root, command),
    }),
  });

  const ruleComposition = browserRuleCompositionModule.createBrowserRuleComposition({
    ruleCompositionApi: ruleCompositionModule,
    stateStoreApi: stateStoreModule,
    highCouplingState: highCouplingStateModule,
    initialGameState: initialGameStateModule,
    effectRuntimeApi: effectSessionRuntimeModule,
    workingStateAdapter: {
      createWorkingState: createBrowserWorkingState,
      restoreWorkingState: restoreBrowserWorkingState,
      validateSessionBoundary: validateBrowserSessionBoundary,
    },
    getCommittedContext: getBrowserCommittedContext,
    runWithWorkingState: (workingRoot, operation) => players.runWithScoreGainListener(
      (player, payload) => handlePlayerScoreChanged(workingRoot, player, payload),
      operation,
    ),
    executeHostCommand: hostCommandDispatcher.execute,
    createActionRegistry: () => compositionActionRegistry,
    standardActionDomain: {
      create: standardActionSessionModule.createStandardActionDomain,
      families: standardActionModule.ALL_FAMILIES,
      options: {
        actionFamilies: standardActionModule.ALL_FAMILIES,
        continuation: standardActionContinuation,
      },
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
    executeIndustry: (workingRoot) => industryRuntime.handleCompanyActionMarkerClick(
      workingRoot,
      players.getCurrentPlayer(workingRoot.playerState)?.initialSelection?.industry,
    ) || { ok: true, progressed: true },
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
  const ruleInputDispatcher = browserHostModule.inputAdapter.createRuleInputDispatcher({
    standardActionSchemaVersion: standardActionModule.SCHEMA_VERSION,
    inspect: (...args) => ruleComposition.inspect(...args),
    createRecoverySnapshot: (...args) => createGameRecoverySnapshot(...args),
    enumerateActions: (...args) => ruleComposition.inputPort.enumerateActions(...args),
    dispatchRuntimeAction: (...args) => actionRuntimeController.dispatchAction(...args),
    submitQuickAction: (...args) => ruleComposition.inputPort.submitQuickAction(...args),
    submitAction: (...args) => ruleComposition.inputPort.submitAction(...args),
  });
  const dispatchBrowserRuleInput = ruleInputDispatcher.dispatch;
  const standardIntentPort = browserHostModule.inputAdapter.createStandardIntentPort({
    dispatch: dispatchBrowserRuleInput,
  });
  const runAction = standardIntentPort.runAction;
  const activeDecisionPort = browserHostModule.inputAdapter.createActiveDecisionPort({
    inspect: (...args) => ruleComposition.inspect(...args),
    submitDecision: (...args) => ruleComposition.inputPort.submitDecision(...args),
  });
  const submitActiveCardDecision = activeDecisionPort.submit;
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
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
    rollbackPendingIndustryQuickAction: (...args) => rollbackPendingIndustryQuickAction(...args),
    cancelStrategyPassiveSlotChoice: (...args) => industryRuntime.cancelStrategyPassiveSlotChoice(...args),
    clearMoveRocketHighlight: (...args) => clearMoveRocketHighlight(...args),
    deactivateMoveMode: (...args) => deactivateMoveMode(...args),
    finishIndustryAbilityFlow: (...args) => industryRuntime.finishIndustryAbilityFlow(...args),
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
  const getSimulationConditionalPlayer = conditionalDecisionDomainModule.createConditionalPlayerResolver({
    resolvePlayerReference: (...args) => resolvePlayerReference(...args),
    getEffectOwnerPlayer: (...args) => getEffectOwnerPlayer(...args),
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
  });
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
    getResearchTechSelectionOptions: (workingRoot) => techRuntime.getResearchTechSelectionOptions(workingRoot),
    isTechTileOwnedByOtherPlayer: (workingRoot, ...args) => (
      techRuntime.isTechTileOwnedByOtherPlayer(workingRoot, ...args)
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
    handleSupplyTechTileClick: (workingRoot, ...args) => techRuntime.handleSupplyTechTileClick(workingRoot, ...args),
    confirmTechBlueSlotChoice: (workingRoot, ...args) => techRuntime.confirmTechBlueSlotChoice(workingRoot, ...args),
    cancelTechSelection: (workingRoot, ...args) => techRuntime.cancelTechSelection(workingRoot, ...args),
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
    executeIndustryFreeMove: (workingRoot, ...args) => industryRuntime.executeIndustryFreeMove(workingRoot, ...args),
    settleCardTasksAfterEffect,
    finishIndustryAbilityFlow: (workingRoot, ...args) => industryRuntime.finishIndustryAbilityFlow(workingRoot, ...args),
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
  const actionSessionRuntime = browserHostModule.actionBar.createActionSessionRuntime({
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
  const cardSelectionState = browserHostModule.cardDecisionUi.createCardSelectionState({
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
  const techRenderContext = {
    supplyStage: null,
    supplySlots: {},
    playerBoardTechLayer: null,
  };

  const els = window.SetiAppDom.collectElements(document);
  const residentViewStateStore = browserHostModule.viewStateStore.createViewStateStore();
  const residentDesktopRenderer = browserHostModule.residentRenderer.createResidentRenderer({ document, els });
  const residentStateSource = ruleComposition.stateSourcePort;
  const residentProjectionAdapter = browserHostModule.projectionAdapter.createBrowserProjectionAdapter({
    stateSource: residentStateSource,
  });
  const residentInputAdapter = browserHostModule.inputAdapter.createBrowserInputAdapter({
    dispatchAction: (action) => (
      action?.phase === "quick"
        ? ruleComposition.inputPort.submitQuickAction(action)
        : ruleComposition.inputPort.submitAction(action)
    ),
    submitDecision: (submission) => ruleComposition.inputPort.submitDecision(submission),
    viewStateStore: residentViewStateStore,
    refreshProjection: () => residentProjectionAdapter.projectSource({ viewer: getResidentViewer() }),
  });
  const residentDecisionController = browserHostModule.decisionUi.createDecisionUiController({
    dispatchIntent: (intent) => (
      (result) => (queueMicrotask(renderResidentDesktop), result)
    )(residentInputAdapter.dispatchIntent(intent)),
  });
  const residentDecisionRenderer = browserHostModule.decisionUi.createDecisionDomRenderer({
    root: document.getElementById("compositionDecisionRoot"),
    controller: residentDecisionController,
  });
  const residentBrowserServices = browserHostModule.browserServices.createBrowserServices({
    ruleLifecycle: browserRuleLifecycle,
    viewStateStore: residentViewStateStore,
    storage: gameRecoveryModule.getPersistentGameStorage(window),
    storageKey: `${PERSISTENT_GAME_STORAGE_KEY}:browser-services`,
    downloadPort: browserHostModule.browserServices.createBrowserDownloadPort({
      window,
      document,
      Blob,
    }),
  });

  const getResidentViewer = browserHostModule.residentProjection.createViewerResolver({
    getInterfacePlayer: () => getInterfacePlayer(),
  });

  const cloneResidentPresentation = browserHostModule.residentProjection.clonePresentation;
  const createResidentReadoutRoot = (resident) => (
    browserHostModule.residentProjection.createReadoutRoot(resident)
  );
  const createStateSourceReadoutRoot = () => browserHostModule.residentProjection.createReadoutRoot(
    ruleComposition.stateSourcePort.read().state,
    { solarKey: "solarSystem", includeMatch: true },
  );
  const playerLookupRuntime = runtimeModule.createPlayerLookupRuntime({
    players,
    uiRuntimeState,
    createReadoutRoot: createStateSourceReadoutRoot,
  });
  const { isBrowserWorkingRoot, getPlayerById, getCurrentPlayer, getPlayerByColor } = playerLookupRuntime;
  const playerEffectOwnerRuntime = runtimeModule.createPlayerEffectOwnerRuntime({
    players,
    uiRuntimeState,
    createReadoutRoot: createStateSourceReadoutRoot,
    getPlayerByColor: (...args) => getPlayerByColor(...args),
    getCurrentPlayer: (workingRoot = null) => getCurrentPlayer(workingRoot || undefined),
    getActionEffectFlow,
  });
  const {
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

  const renderResidentDesktop = browserHostModule.residentRenderer.createDesktopRenderPort({
    createRenderInput: createResidentRenderInput,
    renderer: residentDesktopRenderer,
    decisionRenderer: residentDecisionRenderer,
  });
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
  const coordinatePort = renderRuntimeModule.createCoordinatePort({
    runtime: coordinateRuntime,
    getRuleReadout: createStateSourceReadoutRoot,
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
  });
  const {
    getMovableTokensForPlayer,
    getEarthSectorCoordinate,
    syncPlanetOrbitLandMarkers,
    seedDefaultReferenceRockets,
  } = coordinatePort;
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
    ...renderRuntimeModule.createBrowserRenderStaticContext(dependencies),
    document,
    Image,
    enforceCapabilityInventory: true,
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
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
    isIndustryFutureSpanHandSelectionActive: (...args) => industryRuntime.isIndustryFutureSpanHandSelectionActive(...args),
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
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
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
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
    scrollToPlayerHandPanel: (...args) => scrollToPlayerHandPanel(...args),
    renderPlayerHand: (...args) => renderPlayerHand(...args),
    renderInitialSelectionArea: (...args) => renderInitialSelectionArea(...args),
  });
  const {
    syncPublicScanConfirmButton,
    syncCardSelectionChrome,
    syncInteractionFocusChrome,
    syncIndustryHandSelectionChrome,
  } = interactionChrome;
  const effectBarPresentation = browserHostModule.actionBar.createEffectBarPresentation({
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
  const finalUiPort = finalUiRuntimeModule.createFinalUiPort({
    runtime: finalUiRuntime,
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
  });
  const { syncFinalScorePendingMarks, handleFinalScoreTileClick } = finalUiPort;
  const refreshHelpers = refreshModule.createRefreshHelpers({
    renderPlayerStats,
    renderAlienPanels,
    renderRockets,
    renderActionEffectBar,
    updateQuickPanel,
    updateActionButtons,
    renderStateReadout,
    renderTechBoard: (...args) => renderTechBoard(...args),
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
  const {
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
    getCurrentActionEffect: getCurrentActionEffectForRoot,
    activateNextActionEffect,
    activateNextActionEffectIfIdle,
    completeCurrentActionEffect,
    executeActionEffect,
  } = effectFlowHelpers;
  const getCurrentActionEffect = (workingRoot = null) => getCurrentActionEffectForRoot(
    workingRoot || createStateSourceReadoutRoot(),
  );
  const effectHistoryPort = effectFlowModule.createEffectHistoryPort({
    actionHistory,
    recordAbilityCommandsForRoot,
    recordAtomicActionHistoryForRoot,
  });
  const { recordAbilityCommands, recordAtomicActionHistory } = effectHistoryPort;
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
  const {
    resetActionBriefingState,
    rememberActionBriefingEntry,
    openActionBriefing,
    closeActionBriefing,
    openActionBriefingDetailLog,
    isActionBriefingEnabled,
    isActionBriefingOpen,
    maybeOpenActionBriefingForCompletedCycle,
  } = actionBriefingHelpers;
  const effectChoiceFlowHelpers = effectChoiceFlowModule.createBrowserEffectChoiceFlow({
    staticContext: effectChoiceFlowModule.createBrowserEffectChoiceStaticContext(dependencies),
    playerLookupRuntime,
    playerEffectOwnerRuntime,
    renderRuntime,
    coordinateRuntime,
    effectFlowRuntime: effectFlowHelpers,
    scoreSourceRuntime,
    cardHelpers: cardRuntimeModule,
    getScanRuntime: () => scanFlowHelpers,
    getIncomeRuntime: () => incomeRuntime,
    getHandRuntime: () => handFlowHelpers,
    getCardRuntime: () => cardRuntime,
    getActionInteractionRuntime: () => actionInteractionRuntime,
    hostPort: {
      document, uiRuntimeState, els, SCORE_SOURCE_KEYS, normalizeResourceCost,
      restoreObjectSnapshot, formatPlanetRewardGain, getPlanetSectorCoordinate,
      restoreMutableObject, getSectorContentForMove, isAsteroidContent,
      renderActionEffectBar, finishAutomaticRewardEffect, insertActionEffectsAfterCurrent,
    },
  });
  const handFlowHelpers = handFlowModule.createBrowserHandFlow({
    staticContext: handFlowModule.createBrowserHandStaticContext(dependencies, appConstants),
    getActionInteractionRuntime: () => actionInteractionRuntime,
    getActionRuntime: () => actionRuntimeController,
    getAlienSpeciesRuntime: () => alienSpeciesRuntime,
    getCardRuntime: () => cardRuntime,
    getCardTriggerRuntime: () => cardTriggerRuntime,
    getIncomeRuntime: () => incomeRuntime,
    getIndustryRuntime: () => industryRuntime,
    getScanRuntime: () => scanFlowHelpers,
    getTechRuntime: () => techRuntime,
    actionSessionRuntime,
    browserContextRuntime,
    cardSelectionState,
    effectExecutorPort: effectExecutorCommandPort,
    effectFlowRuntime: effectFlowHelpers,
    effectHistoryPort,
    interactionChrome,
    pendingSubFlowRuntime,
    playerLookupRuntime,
    renderRuntime,
    scoreSourceRuntime,
    hostPort: {
      uiRuntimeState,
      els,
      quickActionHistory,
      HISTORY_SOURCE_QUICK,
      SCORE_SOURCE_KEYS,
      getGameplayLockReason,
      canPayForMove,
      getRequiredMovePointsForUi,
      isMovePaymentCard,
      playerHasMovePaymentCard,
      restoreObjectSnapshot,
      updatePlayerHandPanelTitle,
      updateActionButtons,
      setQuickPanelOpen,
      executeIndustryFreeMove: (...args) => executeIndustryFreeMove(...args),
      createActionContext: createActionContextForWorkingRoot,
      recordMainActionIrreversibleBarrier: (...args) => recordMainActionIrreversibleBarrier(...args),
      submitDiscardDecision: (handIndexes) => submitActiveCardDecision(
        "discard-hand-cards",
        handFlowModule.createHandIndexDecisionMatcher(handIndexes),
      ),
      scrollToPlayerCommandPanel,
      dispatchStandardIntent: (family, selector = {}, payload = {}) => (
        dispatchBrowserRuleInput({ kind: "standard_intent", family, selector, payload })
        || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE", message: "Standard Action runtime 尚未装配" }
      ),
      blockManualAiMovePayment,
      blockIncompatiblePendingQuickAction,
      requestAnimationFrame,
    },
  });
  const beginSupplementalMovePaymentForRoot = handFlowHelpers.beginSupplementalMovePayment;
  const syncDiscardSelectionChrome = (...args) => callHandFlowCommand("syncDiscardSelectionChrome", args);
  const isHandScanSelectionActive = (...args) => callHandFlowCommand("isHandScanSelectionActive", args);
  const syncHandScanSelectionChrome = (...args) => callHandFlowCommand("syncHandScanSelectionChrome", args);
  const isMovePaymentSelectionActive = (workingRoot = createStateSourceReadoutRoot()) => Boolean(
    getPendingMovePayment(workingRoot),
  );
  const getMovePaymentPlayer = (...args) => callHandFlowCommand("getMovePaymentPlayer", args);
  const isMovePaymentLockedForAiAutomation = (...args) => callHandFlowCommand("isMovePaymentLockedForAiAutomation", args);
  const beginSupplementalMovePayment = (...args) => callHandFlowCommand("beginSupplementalMovePayment", args);
  const syncMovePaymentChrome = (...args) => callHandFlowCommand("syncMovePaymentChrome", args);
  const scrollToPlayerHandPanel = (...args) => callHandFlowCommand("scrollToPlayerHandPanel", args);
  const cancelMovePaymentSelection = (...args) => callHandFlowCommand("cancelMovePaymentSelection", args);
  const beginMovePaymentSelection = (...args) => callHandFlowCommand("beginMovePaymentSelection", args);
  const handleHandCardMovePayment = (...args) => callHandFlowCommand("handleHandCardMovePayment", args);
  const resolveMovePaymentDecision = (...args) => callHandFlowCommand("resolveMovePaymentDecision", args);
  const { confirmMovePayment } = handFlowModule.createMovePaymentDecisionPort({
    inspectComposition: () => ruleComposition.inspect(),
    submitDecision: (submission) => ruleComposition.inputPort.submitDecision(submission),
    getSelectedHandIndices: () => uiRuntimeState.movePaymentSelectedHandIndices || [],
  });
  const syncPlayCardSelectionChrome = (...args) => callHandFlowCommand("syncPlayCardSelectionChrome", args);
  const getPendingPlayCardSelection = (...args) => callHandFlowCommand("getPendingPlayCardSelection", args);
  const handlePlayCardSelect = (...args) => callHandFlowCommand("handlePlayCardSelect", args);
  const confirmPlayCardSelection = (...args) => callHandFlowCommand("confirmPlayCardSelection", args);
  const executeStandardCardCornerAction = (...args) => callHandFlowCommand("executeStandardCardCornerAction", args);
  const getPendingHandCardPlayAction = (...args) => callHandFlowCommand("getPendingHandCardPlayAction", args);
  const cancelHandCardPlayAction = (...args) => callHandFlowCommand("cancelHandCardPlayAction", args);
  const clearHandCardContextActions = (...args) => callHandFlowCommand("clearHandCardContextActions", args);
  const cancelHandCardContextActions = (...args) => callHandFlowCommand("cancelHandCardContextActions", args);
  const confirmHandCardPlayAction = (...args) => callHandFlowCommand("confirmHandCardPlayAction", args);
  const getPendingCardCornerQuickAction = (...args) => callHandFlowCommand("getPendingCardCornerQuickAction", args);
  const syncCardCornerQuickActionChrome = (...args) => callHandFlowCommand("syncCardCornerQuickActionChrome", args);
  const cancelCardCornerQuickAction = (...args) => callHandFlowCommand("cancelCardCornerQuickAction", args);
  const handleHandCardCornerQuickAction = (...args) => callHandFlowCommand("handleHandCardCornerQuickAction", args);
  const confirmCardCornerQuickAction = (...args) => callHandFlowCommand("confirmCardCornerQuickAction", args);
  const beginDiscardSelection = (...args) => callHandFlowCommand("beginDiscardSelection", args);
  const cancelDiscardSelection = () => submitActiveCardDecision("cancel-discard-selection", () => true);
  const completeDiscardSelection = (...args) => callHandFlowCommand("completeDiscardSelection", args);
  const finalizePendingDiscardSelection = (selectedHandIndexes = uiRuntimeState.discardSelectedHandIndexes || []) => (
    submitActiveCardDecision(
      "discard-hand-cards",
      handFlowModule.createHandIndexDecisionMatcher(selectedHandIndexes),
    )
  );
  const handleHandCardDiscard = (...args) => callHandFlowCommand("handleHandCardDiscard", args);
  const beginPlayCardSelection = (...args) => callHandFlowCommand("beginPlayCardSelection", args);
  const cancelPlayCardSelection = (...args) => callHandFlowCommand("cancelPlayCardSelection", args);
  const executeStandardPlayCard = (...args) => callHandFlowCommand("executeStandardPlayCard", args);
  const handleFutureSpanCardPlay = (...args) => callHandFlowCommand("handleFutureSpanCardPlay", args);
  const handleHandCardPlay = (...args) => callHandFlowCommand("handleHandCardPlay", args);
  const handleFutureSpanPlayCardSelect = (...args) => callHandFlowCommand("handleFutureSpanPlayCardSelect", args);
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
  const scanFlowHelpers = scanFlowModule.createBrowserScanFlow({
    staticContext: scanFlowModule.createBrowserScanStaticContext(dependencies, appConstants),
    getActionInteractionRuntime: () => actionInteractionRuntime,
    getAlienSpeciesRuntime: () => alienSpeciesRuntime,
    getCardRuntime: () => cardRuntime,
    getEffectExecutionPort: () => effectExecutionPort,
    getIndustryRuntime: () => industryRuntime,
    getTechRuntime: () => techRuntime,
    actionSessionRuntime,
    browserContextRuntime,
    cardSelectionState,
    effectExecutorPort: effectExecutorCommandPort,
    effectFlowRuntime: effectFlowHelpers,
    effectHistoryPort,
    effectSkipRuntime,
    handFlowRuntime: handFlowHelpers,
    interactionChrome,
    pendingSubFlowRuntime,
    playerEffectOwnerRuntime,
    renderRuntime,
    hostPort: {
      uiRuntimeState,
      getPendingYichangdianCornerAction: (...args) => getPendingYichangdianCornerAction(...args),
      document,
      structuredClone,
      els,
      SCAN_TARGET_ACTION_LAYOUT_CLASSES,
      updateActionButtons,
      syncPublicScanConfirmButton,
      actionHistory,
      getFlowMarkedNebulaIds,
      normalizeResourceCost,
      createActionContext: createActionContextForWorkingRoot,
      HISTORY_SOURCE_MAIN,
      getNormalTokenAssetForPlayer,
      getMovableTokensForWorkingRoot: (workingRoot, playerId) => (
        rocketActions.getMovableTokensForPlayer(workingRoot.rocketState, playerId)
      ),
      selectDefaultRocketForCurrentPlayer: (...args) => selectDefaultRocketForCurrentPlayer(...args),
      getRequiredMovePointsForWorkingRoot: (workingRoot, ...args) => (
        getRequiredMovePointsForUiForRoot(workingRoot, ...args)
      ),
    },
  });
  const {
    executeMainScanAction,
    launchRocketForScanAction4,
    beginScanAction4FreeMove: beginScanAction4FreeMoveForRoot,
    executeFreeMoveForScanAction4: executeFreeMoveForScanAction4ForRoot,
    getPublicScanBonusSelectableCount,
    getPublicScanMinSelectable,
    getPublicScanSelectionInstruction,
    ensureDelayedPublicRefills,
    registerDelayedPublicRefill,
    getDelayedPublicRefillSlots,
    clearDelayedPublicRefillSlots,
    cloneDelayedPublicRefills,
    buildSectorSettlementRewardEffects,
    isExhaustedNebulaScanMessage,
    getSectorFinishIcon,
    appendSectorSettlementResultToFlow,
    getSectorWinnerRewardKey,
    createTargetResourceEffect,
    createTargetPinkTraceEffect,
    isKnownScanEffectType,
    isScanRelatedEffect,
    isScanRelatedEffectFlow,
    normalizeDelayedPublicRefillSlotIndexes,
    createEndOfFlowInsertionSource,
    isEndOfFlowSettlementEffect,
    pruneEndOfFlowSettlementEffectsAfterUndo,
    appendDeferredEndOfFlowEffects,
    setScanTargetActionLayout,
    openScanTargetPicker,
    findPendingHandScanCardIndex,
    getSectorCapacity,
    getSectorNebulaLabelText,
    getPublicScanIconForScanCode,
    openPublicScanNebulaPickerForCurrentQueueItem,
  } = scanFlowHelpers;
  const beginScanAction4FreeMove = () => ruleComposition.inputPort.submitHostCommand({
    kind: "effect_begin_scan_free_move",
  }).value;
  const scanDecisionPort = scanFlowModule.createScanDecisionPort({
    inspectComposition: () => ruleComposition.inspect(),
    submitActiveDecision: (...args) => submitActiveCardDecision(...args),
  });
  const executeFreeMoveForScanAction4 = scanDecisionPort.executeFreeMove;
  const getPublicScanMaxSelectable = (...args) => callBrowserDomainCommand("scan_flow", "getPublicScanMaxSelectable", args);
  const buildReadySectorFinishEffects = (...args) => callBrowserDomainCommand("scan_flow", "buildReadySectorFinishEffects", args);
  const buildScanFinalizeFollowupEffects = (...args) => callBrowserDomainCommand("scan_flow", "buildScanFinalizeFollowupEffects", args);
  const replaceNebulaDataForCurrentPlayer = (...args) => callBrowserDomainCommand("scan_flow", "replaceNebulaDataForCurrentPlayer", args);
  const getSectorFinishWinnerTarget = (...args) => callBrowserDomainCommand("scan_flow", "getSectorFinishWinnerTarget", args);
  const executeScanActionFinalizeEffect = (...args) => callBrowserDomainCommand("scan_flow", "executeScanActionFinalizeEffect", args);
  const executeSectorFinishScanEffect = (...args) => callBrowserDomainCommand("scan_flow", "executeSectorFinishScanEffect", args);
  const replenishDelayedPublicRefillSlots = (...args) => callBrowserDomainCommand("scan_flow", "replenishDelayedPublicRefillSlots", args);
  const executeScanPublicRefillEffect = (...args) => callBrowserDomainCommand("scan_flow", "executeScanPublicRefillEffect", args);
  const settleDelayedPublicRefillsAfterScanFlow = (...args) => callBrowserDomainCommand("scan_flow", "settleDelayedPublicRefillsAfterScanFlow", args);
  const buildEndOfFlowFollowupEffects = (...args) => callBrowserDomainCommand("scan_flow", "buildEndOfFlowFollowupEffects", args);
  const shouldAppendQueuedSectorFinishEffects = (...args) => callBrowserDomainCommand("scan_flow", "shouldAppendQueuedSectorFinishEffects", args);
  const appendEndOfFlowSectorFinishEffects = (...args) => callBrowserDomainCommand("scan_flow", "appendEndOfFlowSectorFinishEffects", args);
  const discardPublicScanCard = (...args) => callBrowserDomainCommand("scan_flow", "discardPublicScanCard", args);
  const discardHandScanCard = (...args) => callBrowserDomainCommand("scan_flow", "discardHandScanCard", args);
  const finalizeScanSourceCard = (...args) => callBrowserDomainCommand("scan_flow", "finalizeScanSourceCard", args);
  const restoreYichangdianCornerPickerIfPending = (...args) => callBrowserDomainCommand("scan_flow", "restoreYichangdianCornerPickerIfPending", args);
  const closeScanTargetPickerForRoot = scanFlowHelpers.closeScanTargetPicker;
  const closeScanTargetPicker = (...args) => callBrowserDomainCommand("scan_flow", "closeScanTargetPicker", args);
  const nebulaHasScannableData = (...args) => callBrowserDomainCommand("scan_flow", "nebulaHasScannableData", args);
  const buildNebulaScanChoice = (...args) => callBrowserDomainCommand("scan_flow", "buildNebulaScanChoice", args);
  const isAomomoActive = (...args) => callBrowserDomainCommand("scan_flow", "isAomomoActive", args);
  const getAomomoPlanetLocation = (...args) => callBrowserDomainCommand("scan_flow", "getAomomoPlanetLocation", args);
  const getAomomoCurrentX = (...args) => callBrowserDomainCommand("scan_flow", "getAomomoCurrentX", args);
  const getNebulaCurrentX = (...args) => callBrowserDomainCommand("scan_flow", "getNebulaCurrentX", args);
  const getSectorScanTargetLabel = (...args) => callBrowserDomainCommand("scan_flow", "getSectorScanTargetLabel", args);
  const buildAomomoScanChoiceForX = (...args) => callBrowserDomainCommand("scan_flow", "buildAomomoScanChoiceForX", args);
  const hasAomomoScanAtX = (...args) => callBrowserDomainCommand("scan_flow", "hasAomomoScanAtX", args);
  const buildSectorScanChoicesForX = (...args) => callBrowserDomainCommand("scan_flow", "buildSectorScanChoicesForX", args);
  const expandScanChoicesWithAomomoTargets = (...args) => callBrowserDomainCommand("scan_flow", "expandScanChoicesWithAomomoTargets", args);
  const confirmScanTarget = scanDecisionPort.confirmScanTarget;
  const handleDrawnHandScanSkip = scanDecisionPort.skipDrawnHandScan;
  const beginSectorScan = (...args) => callBrowserDomainCommand("scan_flow", "beginSectorScan", args);
  const getSectorOpenDataCount = (...args) => callBrowserDomainCommand("scan_flow", "getSectorOpenDataCount", args);
  const getSectorReplacedCount = (...args) => callBrowserDomainCommand("scan_flow", "getSectorReplacedCount", args);
  const getSectorExtraMarkCount = (...args) => callBrowserDomainCommand("scan_flow", "getSectorExtraMarkCount", args);
  const getPublicScanChoicesForCard = (...args) => callBrowserDomainCommand("scan_flow", "getPublicScanChoicesForCard", args);
  const hasHandScanTargetCard = (...args) => callBrowserDomainCommand("scan_flow", "hasHandScanTargetCard", args);
  const createPublicScanPendingAction = (...args) => callBrowserDomainCommand("scan_flow", "createPublicScanPendingAction", args);
  const beginPublicDeckScan = (...args) => callBrowserDomainCommand("scan_flow", "beginPublicDeckScan", args);
  const beginPublicScanForSingleCard = (...args) => callBrowserDomainCommand("scan_flow", "beginPublicScanForSingleCard", args);
  const confirmPublicScanSelection = (...args) => callBrowserDomainCommand("scan_flow", "confirmPublicScanSelection", args);
  const handlePublicScanCardClick = (...args) => callBrowserDomainCommand("scan_flow", "handlePublicScanCardClick", args);
  const beginHandScan = (...args) => callBrowserDomainCommand("scan_flow", "beginHandScan", args);
  const cancelHandScanSelection = (...args) => callBrowserDomainCommand("scan_flow", "cancelHandScanSelection", args);
  const handleHandScanCardClick = (handIndex) => submitActiveCardDecision(
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
  const {
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
    beginIncomeForCurrentPlayer: beginIncomeForCurrentPlayerForRoot,
  } = incomeRuntime;
  const {
    beginIncomeForCurrentPlayer,
    applyIndustryRoundStartBonuses,
    maybeStartFundamentalismRoundStartIncomeFlow,
  } = bindDomainCommands("income_runtime");
  const {
    confirmAlienTracePlacement,
    confirmFangzhouTracePlacement,
  } = bindDomainCommands("alien_runtime");

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
    getAlienTraceActionPlayer: (workingRoot, ...args) => alienRuntimeHelpers.getAlienTraceActionPlayer?.(workingRoot, ...args),
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
  } = bindDomainCommands("alien_ui");
  const {
    handleFangzhouTraceDestinationChoice,
    handleFangzhouUnlockTraceChoice,
    handleStateTraceSlotPlacement,
  } = alienUiModule.createAlienDecisionPort({ submitActiveDecision: submitActiveCardDecision });
  const alienRuntimeHelpers = alienRuntimeModule.createBrowserAlienRuntime({
    staticContext: alienRuntimeModule.createBrowserAlienStaticContext(dependencies),
    getAlienSpeciesRuntime: () => alienSpeciesRuntime,
    getCardRuntime: () => cardRuntime,
    getCardTriggerRuntime: () => cardTriggerRuntime,
    getIndustryRuntime: () => industryRuntime,
    getTurnEndRuntime: () => turnEndPort,
    alienUiRuntime: alienUiHelpers,
    browserContextRuntime,
    effectExecutorPort: effectExecutorCommandPort,
    effectFlowRuntime: effectFlowHelpers,
    playerEffectOwnerRuntime,
    playerLookupRuntime,
    renderRuntime,
    scoreSourceRuntime,
    hostPort: {
      uiRuntimeState,
      structuredClone,
      HISTORY_SOURCE_MAIN,
      getEarthSectorCoordinate,
      updateActionButtons,
      markCurrentActionIrreversible,
    },
  });
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
  } = bindDomainCommands("alien_runtime");

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

  turnFlowController = turnFlowModule.createBrowserTurnFlowController({
    staticContext: turnFlowModule.createBrowserTurnFlowStaticContext(dependencies),
    ruleLifecycle: browserRuleLifecycle,
    cardSetupController,
    persistenceController,
    refreshRuntime: refreshHelpers,
    renderRuntime,
    resetPort: {
      clearTransientStateForRecovery,
      restoreMutableObject,
      createTurnState,
      resetScanRunSequence,
      resetActionLog,
    },
    setupPort: {
      fillNebulaDataBoard,
      randomizeAliens,
      cancelIndustryAbilityFlow,
      closeFinalResultDialog,
      configureDefaultAiOpponent,
      startInitialSelection,
      seedDefaultReferenceRockets,
    },
    scorePort: {
      computePlayerFinalScoreBreakdown: (workingRoot, player) => (
        computePlayerFinalScoreBreakdown(player, workingRoot)
      ),
    },
    hostPort: {
      uiRuntimeState,
      setupSelectionState,
      startScreenState,
      historyStepOrder,
      cardTaskState,
      els,
      renderRoundStatus,
      renderResidentDesktop,
      renderDebugPlayerSwitch,
      resize,
      defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
      defaultInitialPlayerColor: DEFAULT_INITIAL_PLAYER_COLOR,
      defaultInitialHandCount: DEFAULT_INITIAL_HAND_COUNT,
      finalRoundNumber: FINAL_ROUND_NUMBER,
      finalScoreIds: FINAL_SCORE_IDS,
      wheelOffsets: WHEEL_OFFSETS,
      aomomoClearNebulaId: aomomo?.NEBULA_ID || null,
      normalizeAiDifficulty: (value) => startScreenModule.normalizeAiDifficulty(value, {
        weakStartValue: AI_DIFFICULTY_WEAK_START,
        defaultValue: AI_DIFFICULTY_LAUGHABLE,
      }),
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
    renderTechBoard: (...args) => renderTechBoard(...args),
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
    startLaunchSectorFinishEffectFlow: (...args) => startLaunchSectorFinishEffectFlow(...args),
    settleCardTasksAfterEffect: (...args) => settleCardTasksAfterEffect(...args),
    maybeAutoExecuteAomomoRewardEffects,
    startResearchTechEffectFlow,
    syncTechSelectionChrome: (...args) => syncTechSelectionChrome(...args),
    finalizeTechTakeResult: (...args) => finalizeTechTakeResult(...args),
    renderRocketElement,
    recordAtomicActionHistory,
    startAnalyzeDataRewardFlow,
    executeActionEffect,
    getCurrentActionEffect,
    maybeApplyIndustryLaunchScan: (...args) => maybeApplyIndustryLaunchScan(...args),
    maybeConsumeAlienLabPanelForMainAction: (...args) => maybeConsumeAlienLabPanelForMainAction(...args),
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
    standardActionAdapter: actionRuntimeModule.createBrowserStandardActionAdapter({
      actions, players, scanEffects, data, cards, rocketActions, quickTrades, industry,
      abilities, aliens, runezu, canStartMainAction, getMainActionStartBlockReason,
      canAnalyzeDataForPlayer, getAnalyzeActionOptionsForPlayer, getCardPlayCost,
      hasActivePendingSubFlow, getMovableTokensForPlayer, getRequiredMovePointsForUi,
      canPayForMove, moveRocket, canUseCardCornerQuickActionForRoot,
      getCardCornerQuickActionForCardForRoot, shouldQueueCardCornerMoveQuickActionForRoot,
      canStartCardCornerFreeMoveForRoot, isActionPending, isActionEffectFlowActive,
      createConditionalActionProvider,
    }),
  });

  const { controller: aiController } = aiBrowserBootstrapModule.createBrowserAiBootstrap({
    aiControlRuntimeModule,
    aiControllerModule: window.SetiAppAiController,
    ruleComposition,
    policyInputAdapterModule: browserHostModule.policyInputAdapter,
    projectionAdapter: residentProjectionAdapter,
    inputAdapter: residentInputAdapter,
    createPolicy: (seatId) => ai.heuristicPolicy.createHeuristicPolicy({
      difficulty: getPlayerById(seatId)?.aiDifficulty || AI_DIFFICULTY_LAUGHABLE,
    }),
    getRuleReadout: createStateSourceReadoutRoot,
    isActionEffectFlowActive,
    stateOwners: {
      match: browserMatchRuntime,
      action: actionSessionRuntime,
      actionHistory,
      ui: uiRuntimeState,
      getAlien: () => alienSpeciesPort,
    },
    controllerPorts: [
      {
        port: handFlowHelpers,
        methods: aiBrowserBootstrapModule.HAND_CONTROLLER_METHODS,
        label: "Hand AI port",
      },
      {
        port: scanFlowHelpers,
        methods: aiBrowserBootstrapModule.SCAN_CONTROLLER_METHODS,
        label: "Scan AI port",
      },
    ],
    lazyControllerPorts: [{
      getPort: () => alienSpeciesPort,
      methods: aiBrowserBootstrapModule.ALIEN_SPECIES_CONTROLLER_METHODS,
      label: "Alien Species AI port",
    }],
    controllerContext: aiBrowserBootstrapModule.createBrowserAiControllerContext({
      staticContext: aiBrowserBootstrapModule.createBrowserAiStaticContext(dependencies, appConstants),
      getCardRuntime: () => cardRuntime,
      getCardTriggerRuntime: () => cardTriggerRuntime,
      getIndustryRuntime: () => industryRuntime,
      getProbeDecisionPort: () => probeDecisionPort,
      getTechRuntime: () => techRuntime,
      actionSessionRuntime,
      browserContextRuntime,
      cardSelectionState,
      coordinateRuntime: coordinatePort,
      effectChoicePort: effectChoiceCommandPort,
      effectExecutorPort: effectExecutorCommandPort,
      effectFlowRuntime: effectFlowHelpers,
      playerEffectOwnerRuntime,
      playerLookupRuntime,
      scanDecisionPort,
      turnHostRuntime,
      turnReadoutRuntime,
      hostPort: {
      window,
      state: aiControllerState,
      ruleLifecycle: browserRuleLifecycle,
      historyStepOrder,
      els,
    analyzeDataForCurrentPlayer,
    beginScanAction,
    buildSectorScanChoicesForXs,
    canBlindDraw: (...args) => canBlindDraw(...args),
    canPayForMove,
    canUseCardCornerQuickAction: (...args) => canUseCardCornerQuickAction(...args),
    cancelTechSelection: (...args) => cancelTechSelection(...args),
    clearTransientStateForRecovery,
    computePlayerFinalScoreBreakdown: (player) => (
      computePlayerFinalScoreBreakdown(player, createStateSourceReadoutRoot())
    ),
    confirmCardTaskCompletion: (...args) => confirmCardTaskCompletion?.(...args),
    confirmDataPlacement,
    confirmInitialSelectionForCurrentPlayer: (workingRoot) => (
      actionRuntimeController.confirmInitialSelectionForCurrentPlayer(workingRoot)
    ),
    confirmAlienRevealNotice: () => (
      (result) => (maybeContinuePendingTurnEndRevealFlow(), result)
    )(confirmAlienRevealNotice()),
    confirmLandTargetPicker,
    confirmMovePayment,
    confirmPassReserveSelection: (...args) => confirmPassReserveSelection(...args),
    confirmStrategyPassiveSlotChoice: (...args) => confirmStrategyPassiveSlotChoice(...args),
    confirmTechBlueSlotChoice: (...args) => confirmTechBlueSlotChoice(...args),
    createActionContext: createReadoutActionContext,
    aiRuntimePorts: aiBrowserBootstrapModule.createBrowserAiRuntimePorts({
      getAlienSpeciesRuntime: () => alienSpeciesRuntime,
      getCardRuntime: () => cardRuntime,
      getCardTriggerRuntime: () => cardTriggerRuntime,
      getIndustryRuntime: () => industryRuntime,
      getTechRuntime: () => techRuntime,
      scanRuntime: scanFlowHelpers,
      createActionContext: (workingRoot, descriptor) => createActionContextForWorkingRoot(workingRoot, descriptor),
      dispatchRuntimeAction: (workingRoot, request) => dispatchBrowserRuleInput(
        request,
        undefined,
        createActionContextForWorkingRoot(workingRoot, request?.payload || request),
      ),
      getRequiredMovePointsForUi: (workingRoot, ...args) => getRequiredMovePointsForUiForRoot(workingRoot, ...args),
    }),
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
    executeIndustryFreeMove: (...args) => executeIndustryFreeMove(...args),
    finishIndustryAbilityFlow: (...args) => finishIndustryAbilityFlow(...args),
    formatRocketLabel,
    getAlienTraceActionPlayer,
    getCardPlayCost: (...args) => getCardPlayCost(...args),
    getCardPrice: (...args) => getCardPrice(...args),
    getCardTypeCode: (...args) => getCardTypeCode(...args),
    getCurrentActionEffect,
    getCurrentPlayer,
    getInitialSelectionOffer,
    getPassReserveSelectionCards: (...args) => getPassReserveSelectionCards(...args),
    getPlanetSectorCoordinate,
    getReadyCardTasks: (...args) => getReadyCardTasks?.(...args),
    getRequiredMovePointsForUi: (workingRoot, ...args) => getRequiredMovePointsForUiForRoot(workingRoot, ...args),
    getResearchTechSelectionOptions: (...args) => getResearchTechSelectionOptions(...args),
    getSectorContentForMove,
    getSectorXsMatchingCondition,
    handleCardTriggerChoice: (...args) => handleCardTriggerChoice?.(...args),
    cancelCardTriggerChoice: (...args) => cancelCardTriggerChoice?.(...args),
    handleCompanyActionMarkerClick: (...args) => handleCompanyActionMarkerClick(...args),
    handlePublicCornerDiscardCardClick,
    handlePublicCardClick: (...args) => handlePublicCardClick(...args),
    handleIndustryDeepspaceHandClick: (...args) => handleIndustryDeepspaceHandClick(...args),
    handleSupplyTechTileClick: (...args) => handleSupplyTechTileClick(...args),
    hasActivePendingSubFlow,
    initializeCardGame,
    isAsteroidContent,
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
    isInitialSelectionActive,
    isMovePaymentCard,
    isUiBlockingAiAutomation: isActionBriefingOpen,
    isTechTileOwnedByOtherPlayer: (...args) => isTechTileOwnedByOtherPlayer(...args),
    isTechTilePickingActive: (...args) => isTechTilePickingActive(...args),
    landForCurrentPlayer,
    moveRocket,
    orbitForCurrentPlayer,
    openCardTaskCompletionPicker: (...args) => openCardTaskCompletionPicker(...args),
    passForCurrentPlayer,
    pickPublicCardForCurrentPlayer: (...args) => pickPublicCardForCurrentPlayer?.(...args),
    randomizeAll,
    renderStateReadout,
    researchTechForCurrentPlayer: (...args) => researchTechForCurrentPlayer(...args),
    resetActionLog,
    resetScanRunSequence,
    restoreMutableObject,
    runAction,
    runPlaceDataToComputer,
    runQuickTrade,
    runAiFinalScoreMarkDecision,
    selectPassReserveCard: (...args) => selectPassReserveCard(...args),
    sectorXHasAvailableScanTarget,
    skipCurrentActionEffect,
    startInitialSelection,
    startNewGame,
        updateActionButtons,
      },
    }),
  });
  const {
    aiNumber,
    applyAiStrategyWeight,
    cardTriggerNeedsFreeMove,
    configureDefaultAiOpponent,
    createAiControlSnapshot,
    enumerateSimulationTurnActions: enumerateSimulationTurnActionsForRoot,
    getAiMapDemand,
    getAiRemainingRoundWeight,
    getAiStrategyDemand,
    getCardTriggerFreeMoveEffect,
    getPlayerAgentLabel,
    isAiAutomationPaused,
    isAiAutoBattlePlayer,
    listCardTriggerFreeMoveCandidates: listCardTriggerFreeMoveCandidatesForRoot,
    recordAiAutoBattleLog,
    restoreAiControlSnapshot,
    scheduleAiAutoStepIfNeeded,
    sumAiDemandMap,
  } = aiController;
  const cardRuntime = cardRuntimeModule.createBrowserCardRuntime({
    staticContext: cardRuntimeModule.createBrowserCardStaticContext(dependencies),
    getActionInteractionRuntime: () => actionInteractionRuntime,
    getAlienSpeciesRuntime: () => alienSpeciesRuntime,
    getCardTriggerRuntime: () => cardTriggerRuntime,
    getIndustryRuntime: () => industryRuntime,
    getScanRuntime: () => scanFlowHelpers,
    getTechRuntime: () => techRuntime,
    getTurnEndRuntime: () => turnEndPort,
    actionSessionRuntime,
    browserMatchRuntime,
    cardHoverPreviewRuntime,
    cardSelectionState,
    effectExecutorPort: effectExecutorCommandPort,
    effectFlowRuntime: effectFlowHelpers,
    effectHistoryPort,
    effectSkipRuntime,
    handFlowRuntime: handFlowHelpers,
    interactionChrome,
    pendingSubFlowRuntime,
    renderRuntime,
    scoreSourceRuntime,
    hostPort: {
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      SCORE_SOURCE_KEYS,
      actionHistory,
      canPayForMove,
      createActionContext: createActionContextForWorkingRoot,
      document,
      els,
      getGameplayLockReason,
      getRequiredMovePointsForUi,
      getRequiredMovePointsForWorkingRoot: (workingRoot, ...args) => (
        getRequiredMovePointsForUiForRoot(workingRoot, ...args)
      ),
      normalizeResourceCost,
      uiRuntimeState,
      quickActionHistory,
      renderActionEffectBar,
      structuredClone,
      updateActionButtons,
    },
  });
  const {
    getDiscardCornerRewardMultiplier: getDiscardCornerRewardMultiplierForRoot,
    multiplyRewardGain,
    multiplyDiscardActionReward,
    multiplyDiscardMoveReward,
    getCardCornerQuickActionForCard: getCardCornerQuickActionForCardForRoot,
    shouldQueueCardCornerMoveQuickAction: shouldQueueCardCornerMoveQuickActionForRoot,
    canUseCardCornerQuickAction: canUseCardCornerQuickActionForRoot,
    formatCardCornerRewardMessage,
    getCardCornerEventKind,
    normalizeCardCornerRewardMultiplier,
    cardCornerCodesEqual,
    normalizeCardCornerTriggerCode,
    getDiscardActionTriggerResourceRewardForCode,
    getDiscardActionTriggerMoveRewardForCode,
    createCardCornerTriggerEventFields,
    applyCardCornerRewardFromCard,
    canStartCardCornerFreeMove: canStartCardCornerFreeMoveForRoot,
    beginCardCornerFreeMove: beginCardCornerFreeMoveForRoot,
    cloneEffectEvent,
    getAfterMoveEventsForEffect,
    buildQueuedCardCornerMoveEffect,
    startCardCornerMoveEffectFlow: startCardCornerMoveEffectFlowForRoot,
    getCardPrice,
    getCardPlayCost,
    getCardPlayCreditCost,
    createPlayCardEvent,
    createImmediatePlayCardEvent,
    restoreObjectSnapshot,
    getFutureSpanCreditPriceForCard,
    getFutureSpanDeltaForCard,
    isFutureSpanEligibleHandCard,
    hasFutureSpanEligibleHandCard: hasFutureSpanEligibleHandCardForRoot,
    hasPlayableFutureSpanCard: hasPlayableFutureSpanCardForRoot,
    getStandardPlayCardActionBlockReason: getStandardPlayCardActionBlockReasonForRoot,
    formatCardPlayCost,
    getCardTypeCode,
    getPlayCardSelectionBlockReason: getPlayCardSelectionBlockReasonForRoot,
    getHandCardPlayActionForCard: getHandCardPlayActionForCardForRoot,
    beginCardSelection: beginCardSelectionForRoot,
    cancelCardSelection: cancelCardSelectionForRoot,
    finalizeCardSelectionResult: finalizeCardSelectionResultForRoot,
    drawBasicCardToPlayer: drawBasicCardToPlayerForRoot,
    blindDrawCardForPlayer: blindDrawCardForPlayerForRoot,
    drawCardForCurrentPlayer: drawCardForCurrentPlayerForRoot,
    pickPublicCardForCurrentPlayer: pickPublicCardForCurrentPlayerForRoot,
    discardCardFromCurrentPlayer,
    canBlindDraw: canBlindDrawForRoot,
    updatePublicCardControls: updatePublicCardControlsForRoot,
    getDelayedPublicRefillSlotIndexes,
    ensurePublicCardsFilledRespectingDelayedRefills: ensurePublicCardsFilledRespectingDelayedRefillsForRoot,
    renderPublicCards,
    handlePublicCardClick: handlePublicCardClickForRoot,
    handlePublicBlindDrawClick: handlePublicBlindDrawClickForRoot,
    handlePublicCornerDiscardCardClick: handlePublicCornerDiscardCardClickForRoot,
    confirmPublicCornerDiscardSelection: confirmPublicCornerDiscardSelectionForRoot,
    isPassReserveSelectionActive,
    getPassReserveSelectionCards: getPassReserveSelectionCardsForRoot,
    renderPassReserveSelection: renderPassReserveSelectionForRoot,
    syncPassReserveSelectionChrome: syncPassReserveSelectionChromeForRoot,
    beginPassReserveSelection: beginPassReserveSelectionForRoot,
    dismissPassReserveSelectionOverlay: dismissPassReserveSelectionOverlayForRoot,
    selectPassReserveCard: selectPassReserveCardForRoot,
    confirmPassReserveSelection: confirmPassReserveSelectionForRoot,
    initCardMoveEffectState,
    isIndustryHuanyuMoveEffect,
    getEffectResultRocketId,
    getCompletedIndustryHuanyuMoveRocketIds,
    validateIndustryHuanyuMoveRocket,
    getMovableTokensForCardMoveEffect: getMovableTokensForCardMoveEffectForRoot,
    getCardMoveEffectCost,
    addResourceCosts,
    selectDefaultRocketFromCandidates: selectDefaultRocketFromCandidatesForRoot,
    executeCardEffectMove: executeCardEffectMoveForRoot,
    finishCurrentCardMoveEffectEarly: finishCurrentCardMoveEffectEarlyForRoot,
    requestCardEffectMove: requestCardEffectMoveForRoot,
    executeFreeMoveForCardCorner: executeFreeMoveForCardCornerForRoot,
    recordPlayCardStart,
    releaseFutureSpanAfterPlayWithHistory: releaseFutureSpanAfterPlayWithHistoryForRoot,
    beginCardMoveEffect: beginCardMoveEffectForRoot,
  } = cardRuntime;
  const beginCardMoveEffect = (effect) => ruleComposition.inputPort.submitHostCommand({
    kind: "effect_begin_card_move",
    effect,
  }).value;
  const executeFreeMoveForCardCorner = (deltaX, deltaY, rocketId) => submitActiveCardDecision(
    "card-corner-free-move",
    (target, choice) => String(target.rocketId) === String(rocketId)
      && Number(choice.deltaX ?? choice.payload?.deltaX) === Number(deltaX)
      && Number(choice.deltaY ?? choice.payload?.deltaY) === Number(deltaY),
  );
  const releaseFutureSpanAfterPlayWithHistory = bindBrowserDomainCommand(
    "card_runtime",
    "releaseFutureSpanAfterPlayWithHistory",
  );
  const {
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
  } = bindDomainCommands("card_runtime");
  const selectPassReserveCard = (cardId) => selectPassReserveCardForRoot(createStateSourceReadoutRoot(), cardId);
  const { confirmPassReserveSelection } = cardRuntimeModule.createPassReserveDecisionPort({
    inspectComposition: () => ruleComposition.inspect(),
    submitDecision: (submission) => ruleComposition.inputPort.submitDecision(submission),
    getSelectedCardId: () => uiRuntimeState.passReserveSelectedCardId || null,
  });
  const {
    selectDefaultRocketFromCandidates,
    executeCardEffectMove,
    finishCurrentCardMoveEffectEarly,
    requestCardEffectMove,
    getMovableTokensForCardMoveEffect,
  } = bindDomainCommands("card_runtime");
  const cardTriggerRuntime = cardTriggerRuntimeModule.createBrowserCardTriggerRuntime({
    staticContext: cardTriggerRuntimeModule.createBrowserCardTriggerStaticContext(dependencies),
    getActionInteractionRuntime: () => actionInteractionRuntime,
    getAlienSpeciesRuntime: () => alienSpeciesRuntime,
    getIndustryRuntime: () => industryRuntime,
    actionSessionRuntime,
    cardRuntime,
    cardSelectionState,
    effectExecutorPort: effectExecutorCommandPort,
    effectFlowRuntime: effectFlowHelpers,
    effectHistoryPort,
    handFlowRuntime: handFlowHelpers,
    pendingSubFlowRuntime,
    playerEffectOwnerRuntime,
    renderRuntime,
    scoreSourceRuntime,
    hostPort: {
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      SCORE_SOURCE_KEYS,
      blockManualAiPendingInputIfNeeded,
      cardTaskState,
      cardTriggerNeedsFreeMove,
      createActionContext: createActionContextForWorkingRoot,
      document,
      els,
      getCardTriggerFreeMoveEffect,
      getEarthSectorCoordinate,
      getPlanetSectorCoordinate,
      getRequiredMovePointsForUi,
      getSectorContentForMove,
      isAsteroidContent,
      isInitialSelectionActive,
      uiRuntimeState,
      listCardTriggerFreeMoveCandidates: listCardTriggerFreeMoveCandidatesForRoot,
      listReadyChongTransportCandidates: listReadyChongTransportCandidatesForRoot,
      markCurrentActionIrreversibleForSource,
      quickActionHistory,
      renderActionEffectBar,
      structuredClone,
      updateActionButtons,
    },
  });
  const {
    buildCardTaskContext: buildCardTaskContextForRoot,
    buildPlayerDataTotals: buildPlayerDataTotalsForRoot,
    addProbeLocation,
    buildProbeLocationIndex: buildProbeLocationIndexForRoot,
    startTemporaryCardTaskRewardFlow,
    getReadyCardTasks: getReadyCardTasksForRoot,
    refreshCardTaskState: refreshCardTaskStateForRoot,
    cloneType1TriggerEvent,
    enqueueType1TriggerEvents,
    isCardTriggerPickSelectionActive,
    hasActiveCardTriggerResolution,
    isCardTriggerRewardFlowBusy,
    getType1TriggerMatchesForEvent,
    applyType1TriggerMatches: applyType1TriggerMatchesForRoot,
    continueAfterCardTriggerResolution: continueAfterCardTriggerResolutionForRoot,
    cancelCardTriggerChoice: cancelCardTriggerChoiceForRoot,
    buildAlienTraceEvent: buildAlienTraceEventForRoot,
    getNebulaColorForCardEvent,
    ensureCardFlowEventBonuses,
    getActiveCardEventBonuses: getActiveCardEventBonusesForRoot,
    eventMatchesCardBonus,
    getCardEventBonusKey,
    applyCardEventBonusReward: applyCardEventBonusRewardForRoot,
    applyPublicityMoveFollowupBonus: applyPublicityMoveFollowupBonusForRoot,
    processCardEventBonuses: processCardEventBonusesForRoot,
    processChongTransportArrivalEvents: processChongTransportArrivalEventsForRoot,
    getChongTransportDestinationCoordinate,
    getChongTransportArrivalEventKey,
    buildChongPositionArrivalEvents: buildChongPositionArrivalEventsForRoot,
    settleCardTasksAfterEffect: settleCardTasksAfterEffectForRoot,
    getChongRewardPrimaryIcon,
    createChongTaskEffect,
    buildChongRewardQueueEffects,
    buildChongFossilRewardQueueEffects,
    buildChongTransportCleanupEffect,
    buildChongTaskCompletionEffects,
    getReadyTaskForReservedCard: getReadyTaskForReservedCardForRoot,
    getReadyChongTaskForReservedCard: getReadyChongTaskForReservedCardForRoot,
    getReadyAmibaTaskForReservedCard: getReadyAmibaTaskForReservedCardForRoot,
    getReadyRunezuTaskForReservedCard: getReadyRunezuTaskForReservedCardForRoot,
    getRunezuTaskProgressIndexes,
    incrementCompletedTaskCount,
    removeReservedCardToDiscard: removeReservedCardToDiscardForRoot,
    discardReservedCardIfFinished: discardReservedCardIfFinishedForRoot,
    createCardTriggerProgressSnapshot: createCardTriggerProgressSnapshotForRoot,
    createCardTriggerProgressCommands: createCardTriggerProgressCommandsForRoot,
    consumeCardTriggerWithSnapshot: consumeCardTriggerWithSnapshotForRoot,
    confirmCardTriggerProgress: confirmCardTriggerProgressForRoot,
    prepareCardTriggerRewardEffects: prepareCardTriggerRewardEffectsForRoot,
    queueCardTriggerRewardEffects: queueCardTriggerRewardEffectsForRoot,
    getCardTaskCompletionBlockReason,
    openCardTaskCompletionPicker: openCardTaskCompletionPickerForRoot,
    closeCardTaskCompletionPicker,
    confirmCardTaskCompletion: confirmCardTaskCompletionForRoot,
    openCardTriggerPicker: openCardTriggerPickerForRoot,
    closeCardTriggerPicker,
    applyCardTriggerReward: applyCardTriggerRewardForRoot,
    beginCardTriggerFreeMove: beginCardTriggerFreeMoveForRoot,
    applyCardTriggerMatch: applyCardTriggerMatchForRoot,
    handleCardTriggerChoice: handleCardTriggerChoiceForRoot,
    executeFreeMoveForCardTrigger: executeFreeMoveForCardTriggerForRoot,
  } = cardTriggerRuntime;
  const {
    buildCardTaskContext,
    buildPlayerDataTotals,
    buildProbeLocationIndex,
    getReadyCardTasks,
    refreshCardTaskState,
    applyType1TriggerMatches,
    continueAfterCardTriggerResolution,
    buildAlienTraceEvent,
    getActiveCardEventBonuses,
    applyCardEventBonusReward,
    applyPublicityMoveFollowupBonus,
    processCardEventBonuses,
    processChongTransportArrivalEvents,
    buildChongPositionArrivalEvents,
    settleCardTasksAfterEffect,
    getReadyTaskForReservedCard,
    getReadyChongTaskForReservedCard,
    getReadyAmibaTaskForReservedCard,
    getReadyRunezuTaskForReservedCard,
    removeReservedCardToDiscard,
    discardReservedCardIfFinished,
    createCardTriggerProgressSnapshot,
    createCardTriggerProgressCommands,
    consumeCardTriggerWithSnapshot,
    confirmCardTriggerProgress,
    prepareCardTriggerRewardEffects,
    queueCardTriggerRewardEffects,
    openCardTaskCompletionPicker,
    openCardTriggerPicker,
    applyCardTriggerReward,
    beginCardTriggerFreeMove,
    applyCardTriggerMatch,
  } = bindDomainCommands("card_trigger");
  const cancelCardTriggerChoice = () => submitActiveCardDecision(
    "card-trigger-cancel",
    (target) => target.choiceId === "cancel",
  );
  const confirmCardTaskCompletion = (choiceId = "confirm") => submitActiveCardDecision(
    "card-task-completion",
    (target) => String(target.choiceId) === String(choiceId),
  );
  const handleCardTriggerChoice = (choiceIndex) => submitActiveCardDecision(
    "card-trigger",
    (target) => Number(target.choiceIndex) === Number(choiceIndex),
  );
  const executeFreeMoveForCardTrigger = (deltaX, deltaY, rocketId) => submitActiveCardDecision(
    "card-trigger-free-move",
    (target, choice) => String(target.rocketId) === String(rocketId)
      && Number(choice.deltaX ?? choice.payload?.deltaX) === Number(deltaX)
      && Number(choice.deltaY ?? choice.payload?.deltaY) === Number(deltaY),
  );

  const blockManualAiMovePayment = renderRuntimeModule.createMovePaymentAiGuard({
    getMovePaymentPlayer,
    blockManualInput: blockManualAiAutomationInput,
  });

  const getRequiredMovePointsForUi = browserHostCommandPort.bindValue(
    "ui_get_required_move_points",
    (...args) => ({ args }),
    { commit: false },
  );

  const getNormalTokenAssetForPlayer = playerStatsUiModule.createNormalTokenAssetResolver(players);

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


  const actionGuardRuntime = browserHostModule.actionBar.createActionGuardRuntime({
    getActionEffectFlow,
    isGameEnded,
    isInitialSelectionActive,
    els,
    setTurnActionButtonState,
    setActionButtonState,
    setQuickActionButtonEnabled,
    updateQuickPanel,
    renderActionEffectBar,
    getPendingCardCornerQuickAction,
    cancelCardCornerQuickAction,
    getPendingHandCardPlayAction,
    cancelHandCardPlayAction,
    hasActivePendingSubFlow,
    getPendingIndustryAbilityDecision,
    getPendingIndustryFreeMoveDecision,
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
    renderStateReadout,
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
  });
  const {
    isActionEffectFlowActive,
    isInitialIncomeFlowActive,
    getGameplayLockReason,
    lockAllActionButtons,
    blockIncompatiblePendingQuickActionForRoot,
    blockIncompatiblePendingQuickAction,
  } = actionGuardRuntime;
  const isIncomeDiscardActionType = incomeRuntimeModule.isIncomeDiscardActionType;
  const irreversibleBarrierRuntime = effectFlowModule.createIrreversibleBarrierRuntime({
    actionHistory,
    historySourceMain: HISTORY_SOURCE_MAIN,
    markCurrentActionIrreversible,
    rememberHistoryStep,
    appendActionLogStep,
    actionLogOptionsFromHistoryStep,
  });
  const recordMainActionIrreversibleBarrier = irreversibleBarrierRuntime.recordMainActionIrreversibleBarrier;
  const historyRefreshRuntime = browserHostModule.actionBar.createHistoryRefreshRuntime({
    renderSectorNebulaDataBoard,
    syncPlanetOrbitLandMarkers,
    renderPublicCards,
    updatePublicCardControls,
    refreshPlayerPanels: (...args) => refreshHelpers.refreshPlayerPanels(...args),
    renderPlayerHand,
    renderReservedCards,
    renderInitialSelectionArea,
    clearStaleFullyUndoneMainActionSession,
    syncInteractionFocusChrome,
    setBrowserStatusNote,
    refreshActionState: (...args) => refreshHelpers.refreshActionState(...args),
  });
  const refreshAfterHistoryChange = historyRefreshRuntime.refreshAfterHistoryChange;

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

  const cancelActivePendingSubFlows = browserHostCommandPort.bindValue("effect_cancel_pending_subflows");

  const boardQueryRuntime = actionInteractionRuntimeModule.createBoardQueryRuntime({
    solar,
    rocketActions,
    getRuleReadout: createStateSourceReadoutRoot,
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
  });
  const { getPlanetSectorCoordinate, getRocketCurrentPlanetIdForRoot, getRocketCurrentPlanetId } = boardQueryRuntime;
  const chongTransportRuntime = alienRuntimeModule.createChongTransportRuntime({
    chong,
    getRocketCurrentPlanetIdForRoot,
    submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
  });
  const {
    listReadyForRoot: listReadyChongTransportCandidatesForRoot,
    listReady: listReadyChongTransportCandidates,
  } = chongTransportRuntime;
  const buildSectorScanChoicesForXs = (sectorXs) => scanFlowModule.buildSectorScanChoicesForXs(
    sectorXs,
    buildSectorScanChoicesForX,
  );

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
    clearAlienDecisionDrafts: () => alienSpeciesRuntime?.clearAlienDecisionDrafts?.(),
    getPendingPiratesRaidDecision,
    renderTechBoard,
  });
  const cancelActiveEffectSubFlowsForRoot = effectSubFlowCancellationRuntime.cancelActiveEffectSubFlowsForRoot;

  const cancelActiveEffectSubFlows = browserHostCommandPort.bindResult("effect_cancel_subflows");
  const skipCurrentActionEffect = browserHostCommandPort.bindValue("effect_skip_current");

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

  const resolveCompletedSectorSettlements = browserHostCommandPort.bindValue(
    "scan_settle_completed_sectors",
    (actionType, options = {}) => ({ actionType, options }),
  );

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
    finishResearchTechSelection: techRuntimeModule.createTechSelectionCompletionPort({
      tech,
      syncTechSelectionChrome,
      renderTechBoard,
    }),
    clearHistoryStepOrderForSource,
    removeActionLogStepsBySource,
    clearActionPending,
    finishInitialIncomeUi: () => (
      renderDebugPlayerSwitch(),
      renderPlayerStats(),
      renderPlayerHand(),
      syncInteractionFocusChrome(),
      updateActionButtons(),
      renderStateReadout(),
      refreshLatestActionLogRecoverySnapshot("初始收入完成后状态"),
      scrollToPlayerCommandPanel()
    ),
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

  const finishActionEffectFlow = browserHostCommandPort.bindValue("effect_finish_flow");

  const effectExecutionPort = effectFlowModule.createEffectExecutionPort({
    isActionEffectFlowActive,
    getCurrentActionEffect,
    completeCurrentActionEffect,
    getExecutors: () => effectExecutors,
  });
  const {
    maybeCompleteFromScan: maybeCompleteActionEffectFromScan,
    executeForOwner: executeActionEffectForOwner,
  } = effectExecutionPort;

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

  const executeCardMoveForEffectForRoot = requestCardEffectMoveForRoot;

  const executeCardMoveForEffect = (deltaX, deltaY, rocketId) => activeDecisionPort.submitDirectional(
    "card-effect-move",
    deltaX,
    deltaY,
    rocketId,
  );

  const probeDecisionPort = scanFlowModule.createProbeDecisionPort({
    getPendingProbeSectorScanDecision,
    submitActiveDecision: submitActiveCardDecision,
    handleMultiSectorChoice: (...args) => effectChoiceFlowHelpers.handleProbeSectorScanChoice(...args),
    getRuleReadout: createStateSourceReadoutRoot,
    getSelectedRocketIds: () => uiRuntimeState.probeSectorSelectedRocketIds || [],
  });
  const {
    handleSectorChoice: handleProbeSectorScanChoice,
    confirmSectorSelection: confirmProbeSectorScanSelection,
    handleLocationRewardChoice: handleProbeLocationRewardChoice,
  } = probeDecisionPort;

  const effectExecutorContexts = {
    movementScan: {
      INCOME_GAIN_LABELS, SCORE_SOURCE_KEYS, abilities, addPlutoMarker, aomomo,
      attachScoreSourceToEffects, beginEffectHistoryStep, beginScanAction4FreeMove,
      buildPlanetRewardEffectsWithIndustry, buildPlutoMarkerRemovalChoices,
      buildProbeLocationIndex: (...args) => buildProbeLocationIndex(...args),
      buildSectorScanChoicesForX, buildSectorScanChoicesForXs, cardEffects, cards,
      claimRunezuPlanetSymbolForTravelResult, closeScanAction4Picker, closeScanTargetPicker,
      collectPlutoMarkers, completeCurrentActionEffect,
      createActionContext: createActionContextForWorkingRoot,
      data, document, effectChoiceFlowHelpers, els, endEffectHistoryStep, endGameScoring,
      formatPlutoChoiceLabel, getActionResultOwnerPlayer, getAomomoCurrentX,
      getCurrentActionEffect, getCurrentPlanetActionPlacement, getCurrentPlayer,
      getEarthSectorCoordinate, getEffectOwnerPlayer, getFlowMarkedNebulaIds,
      getPendingOwnerFields, getPlanetSectorCoordinate, getPlutoActionCost, getPlutoActionState,
      getPlutoCandidateRockets, getPlutoChoiceActionLabel, getPlutoReservedCards,
      getSectorScanTargetLabel, historyCommands,
      insertActionEffectsAfterCurrent: (...args) => effectExecutors.insertActionEffectsAfterCurrent(...args),
      isActionEffectFlowActive, launchRocketForScanAction4, maybeCompleteActionEffectFromScan,
      normalizeResourceCost, openLandTargetPicker, openScanTargetPicker, planetReferenceLayout,
      planetRewards, planetStats, playerHasOwnPlutoLanding, players, recordAbilityCommands,
      recordHistoryCommand, removePlutoMarker, removeRocketElement, renderActionEffectBar,
      renderAlienPanels, renderPlayerHand, renderPlayerStats, renderPublicCards,
      renderReservedCards: (...args) => renderReservedCards(...args),
      renderRockets, renderStateReadout, replaceNebulaDataForCurrentPlayer, restoreMutableObject,
      rocketActions, skipActionEffectWithMessage, solar, syncPlanetOrbitLandMarkers,
      updateActionButtons, updatePublicCardControls, withEffectExecutionPlayer,
      withPendingOwnerPlayer,
    },
    reward: {
      SCORE_SOURCE_KEYS, abilities, activateNextActionEffect, addPlayerScoreSource,
      addScoreSourceFromGain, applyIncomeGainWithImmediateRewards, assignEffectOwner, banrenma,
      beginCardSelection: (workingRoot, ...args) => beginCardSelectionForRoot(workingRoot, ...args),
      beginDiscardSelection: (workingRoot, ...args) => handFlowHelpers.beginDiscardSelection(workingRoot, ...args),
      beginEffectHistoryStep, buildNebulaScanChoice, buildPlutoMarkerRemovalChoices,
      buildSectorScanChoicesForX, buildSectorScanChoicesForXs, cardEffects, cards, chong,
      closeScanTargetPicker, completeCurrentActionEffect,
      createActionContext: createActionContextForWorkingRoot,
      createPublicScanPendingAction, createScanRunId, data, document, effectChoiceFlowHelpers,
      els, endEffectHistoryStep, ensureCardFlowEventBonuses, ensurePlutoCardEffectState,
      expandScanChoicesWithAomomoTargets, formatCardCornerRewardMessage, formatIncomeGain,
      getAutoDataPlacementCheck, getCardTypeCode, getCurrentActionEffect, getCurrentPlayer,
      getEarthSectorCoordinate, getEffectOwnerPlayer, getExplicitEffectOwnerPlayer,
      getNebulaCurrentX, getPendingOwnerFields, getPendingOwnerPlayer, getPublicScanChoicesForCard,
      getPublicScanIconForScanCode, getSectorContentForMove, historyCommands, initialCards,
      isAsteroidContent, isDataPoolFull, markCurrentActionIrreversible,
      maybeApplyIndustryLaunchScan: (...args) => maybeApplyIndustryLaunchScan(...args),
      nebulaHasScannableData, normalizeResourceCost, openAutoDataPlacementPrompt,
      openScanTargetPicker, planetReferenceLayout, planetStats, players, recordAbilityCommands,
      recordHistoryCommand, recordScoreSourceForGainEffect, renderActionEffectBar,
      renderPlayerHand, renderPlayerStats, renderPublicCards,
      renderReservedCards: (...args) => renderReservedCards(...args),
      renderRocketElement, renderRockets, renderStateReadout,
      renderTechBoard: (...args) => renderTechBoard(...args),
      replaceNebulaDataForCurrentPlayer, resolvePlayerReference, restoreObjectSnapshot,
      rocketActions, runezu, scanEffects, solar, skipActionEffectWithMessage,
      syncHandScanSelectionChrome,
      syncTechSelectionChrome: (...args) => syncTechSelectionChrome(...args),
      uiRuntimeState, updateActionButtons, withPendingOwnerPlayer,
    },
    alien: {
      SCORE_SOURCE_KEYS, abilities, addPlayerScoreSource, addScoreSourceFromGain, aomomo,
      applyIncomeFromCard, applyYichangdianRewardToPlayer,
      beginCardSelection: (workingRoot, ...args) => beginCardSelectionForRoot(workingRoot, ...args),
      beginEffectHistoryStep, blindDrawCardForPlayer, buildPlanetRewardEffectsWithIndustry,
      buildSectorScanChoicesForX, buildSectorScanChoicesForXs, cardEffects, cards, chong,
      claimRunezuPlanetSymbolForTravelResult, completeCurrentActionEffect,
      createActionContext: createActionContextForWorkingRoot,
      data, document, els, endEffectHistoryStep, finishChongFossilEffect, formatIncomeGain,
      getActionResultOwnerPlayer, getAomomoCurrentX, getChongPlanetLabel, getCurrentActionEffect,
      getCurrentPlayer, getEarthSectorCoordinate, getEffectOwnerPlayer, getIrreversibleReason,
      getPlayerById, hasPlayerVisitedPlanetThisTurn, historyCommands,
      insertActionEffectsAfterCurrent: (...args) => effectExecutors.insertActionEffectsAfterCurrent(...args),
      markCurrentActionIrreversible, maybeCompleteActionEffectFromScan, nebulaHasScannableData,
      openAlienTraceRewardEffect: (...args) => effectExecutors.openAlienTraceRewardEffect(...args),
      openChongFossilChoiceDialog, openLandTargetPicker, openScanTargetPicker, players,
      recordAbilityCommands, recordHistoryCommand, removeRocketElement, renderActionEffectBar,
      renderAlienPanels, renderPlayerHand, renderPlayerStats, renderPublicCards,
      renderReservedCards: (...args) => renderReservedCards(...args),
      renderRockets, renderStateReadout, replaceNebulaDataForCurrentPlayer, rocketActions,
      solar, syncPlanetOrbitLandMarkers, updateActionButtons, withEffectExecutionPlayer,
      yichangdian,
    },
    dispatcher: {
      BANRENMA_PANEL_BONUS_EFFECT_TYPE, JIUZHE_THRESHOLD_CARD_EFFECT_TYPE, abilities,
      alienTraceRewardFlow, aliens, amiba, aomomo, applyIncomeGainWithImmediateRewards,
      banrenma,
      beginAlienTraceBoardPlacement: (workingRoot, ...args) => beginAlienTraceBoardPlacementForRoot(workingRoot, ...args),
      beginCardMoveEffect,
      beginCardSelection: (workingRoot, ...args) => beginCardSelectionForRoot(workingRoot, ...args),
      beginDiscardSelection: (workingRoot, ...args) => handFlowHelpers.beginDiscardSelection(workingRoot, ...args),
      beginEffectHistoryStep, beginPassReserveSelection, buildNebulaScanChoice, cardEffects, chong,
      claimRunezuSourceSymbolWithHistory,
      closeAlienTracePicker: (workingRoot) => closeAlienTracePickerForRoot(workingRoot),
      completeCurrentActionEffect, createActionContext: createActionContextForWorkingRoot,
      createPublicScanPendingAction, endEffectHistoryStep, executeBanrenmaPanelBonusEffect,
      executeIndustryHeliosPassiveRewardEffect: (...args) => executeIndustryHeliosPassiveRewardEffect(...args),
      executeIndustryPiratesRaidLaunchEffect: (...args) => executeIndustryPiratesRaidLaunchEffect(...args),
      executeIndustryPiratesRaidMarkerEffect: (...args) => executeIndustryPiratesRaidMarkerEffect(...args),
      executeIndustryPiratesRaidPublicityEffect: (...args) => executeIndustryPiratesRaidPublicityEffect(...args),
      executeIndustrySentinelCornerEffect: (...args) => executeIndustrySentinelCornerEffect(...args),
      executeIndustryStrategyPassiveRewardEffect: (...args) => executeIndustryStrategyPassiveRewardEffect(...args),
      executeIndustryStratusCornerEffect: (...args) => executeIndustryStratusCornerEffect(...args),
      executeJiuzheThresholdCardEffect, executePassFirstRotateEffect, executePassHandLimitEffect,
      executeRunezuSymbolRewardEffect, executeScanActionFinalizeEffect, executeScanPublicRefillEffect,
      executeSectorFinishScanEffect, expandScanChoicesWithAomomoTargets, formatIncomeGain,
      getCurrentPlayer, getEffectOwnerPlayer, getEligibleAlienSlotIdsForTraceEffect, getPlayerById,
      getPublicScanMaxSelectable, getPublicScanChoicesForCard,
      getResearchTechSelectionPayload: (workingRoot) => techRuntime.getResearchTechSelectionPayload(workingRoot),
      hasAlienTracePanelPlacementTarget: (workingRoot, ...args) => hasAlienTracePanelPlacementTargetForRoot(workingRoot, ...args),
      hasHandScanTargetCard, historyCommands, jiuzhe,
      maybeApplyIndustryLaunchScan: (...args) => maybeApplyIndustryLaunchScan(...args),
      maybeConsumeAlienLabPanelForMainAction: (...args) => maybeConsumeAlienLabPanelForMainAction(...args),
      onTechTileTaken: (...args) => onTechTileTaken(...args),
      openAmibaSymbolChoiceDialog, openAmibaTraceRemovalDialog, openAomomoCardGainDialog,
      openFangzhouTraceDestinationChoice: (workingRoot, ...args) => openFangzhouTraceDestinationChoiceForRoot(workingRoot, ...args),
      openRunezuSymbolBranchDialog, openScanAction4Picker, openScanTargetPicker, planetRewards,
      recordAbilityCommands, recordHistoryCommand, recordTechBonusScore, renderDebugPlayerSwitch,
      renderPlayerHand, renderPlayerStats, renderRockets, renderRotateStateToken,
      renderRunezuBoardSymbols, renderSectorNebulaDataBoard, renderStateReadout, renderWheels,
      resolvePlayerReference, runezu, scanEffects,
      shouldSkipCurrentResearchTechCost: (workingRoot) => techRuntime.shouldSkipCurrentResearchTechCost(workingRoot),
      skipActionEffectWithMessage, syncHandScanSelectionChrome, tech, uiRuntimeState,
      updateActionButtons,
    },
  };
  const effectExecutors = effectExecutorBootstrapModule.createEffectExecutorSuite({
    contexts: effectExecutorContexts,
    movementScanModule: effectMovementScanExecutorsModule,
    rewardModule: effectRewardExecutorsModule,
    alienModule: effectAlienExecutorsModule,
    dispatcherModule: effectDispatcherModule,
  });

  const actionRuntimePort = actionRuntimeModule.createActionRuntimePort({
    getController: () => actionRuntimeController,
  });
  const { handleActionEffectButtonClickForRoot, beginScanAction } = actionRuntimePort;

  const handleActionEffectButtonClick = browserHostCommandPort.bindValue(
    "effect_bar_click",
    (effectIndex) => ({ effectIndex }),
  );

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
  const { resize, syncTechRenderContext } = browserLayoutRuntime;

  let alienSpeciesRuntime = null;
  const {
    getPendingYichangdianCornerAction,
    getPendingYichangdianCornerCards,
  } = effectFlowModule.createEffectExecutorQueryPort({ getExecutors: () => effectExecutors });
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
  const triggerYichangdianAnomalyForEarthX = alienRuntimeModule.createYichangdianAnomalyRuntime({
    yichangdian,
    findPlayerForEntry: (...args) => findPlayerForYichangdianEntry(...args),
    applyRewardToPlayer: (...args) => applyYichangdianRewardToPlayer(...args),
    beginCardSelection: (...args) => beginCardSelection(...args),
  }).triggerForEarthX;

  const FINAL_RESULT_PLAYER_COLOR_ORDER = Object.freeze(["white", "brown", "blue", "green"]);

  const computePlayerFinalScoreBreakdown = finalUiRuntimeModule.createFinalScoreBreakdownRuntime({
    endGameScoring,
    buildProbeLocationIndexForRoot,
    buildPlutoMarkerContext: (workingRoot) => actionInteractionRuntime?.buildPlutoMarkerContext(workingRoot) || { plutoMarkers: [] },
    cardEffects,
    getCardTypeCode,
    getPlayerCompanyBaseIncome,
  }).compute;
  const applyIndustryStartupPassives = industryRuntimeModule.createIndustryStartupRuntime({
    industry,
    finalScoring,
    getNormalTokenAssetForPlayer,
    renderFinalScoreBoard,
  }).apply;

  const industryRuntime = industryRuntimeModule.createBrowserIndustryRuntime({
    staticContext: industryRuntimeModule.createBrowserIndustryStaticContext(dependencies),
    getActionInteractionRuntime: () => actionInteractionRuntime,
    getIncomeRuntime: () => incomeRuntime,
    getTechRuntime: () => techRuntime,
    actionSessionRuntime,
    browserMatchRuntime,
    cardHoverPreviewRuntime,
    cardRuntime,
    cardSelectionState,
    effectExecutorPort: effectExecutorCommandPort,
    effectFlowRuntime: effectFlowHelpers,
    effectHistoryPort,
    handFlowRuntime: handFlowHelpers,
    interactionChrome,
    playerEffectOwnerRuntime,
    renderRuntime,
    scanRuntime: scanFlowHelpers,
    scoreSourceRuntime,
    hostPort: {
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      INDUSTRY_TURING_BORROW_TECH_TYPES,
      SCORE_SOURCE_KEYS,
      beginScanAction,
      createActionContext: createActionContextForWorkingRoot,
      dispatchStandardIntent: (family, selector = {}, payload = {}) => (
        dispatchBrowserRuleInput({ kind: "standard_intent", family, selector, payload })
      ),
      createInitialSelectionImage,
      document,
      els,
      getEarthSectorCoordinate,
      getGameplayLockReason,
      getMarkedNebulaIdsFromEvents,
      getMovableTokensForPlayer,
      getNormalTokenAssetForPlayer,
      getRequiredMovePointsForUi,
      launchRocketForCurrentPlayer,
      quickActionHistory,
      renderActionEffectBar,
      resultHasSignalMarkedEvent,
      selectDefaultRocketForCurrentPlayer,
      uiRuntimeState,
      updateActionButtons,
    },
  });
  const industryCommands = bindDomainCommands("industry_runtime");
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
  const executeIndustryFreeMove = (deltaX, deltaY, rocketId) => activeDecisionPort.submitDirectional(
    "industry-free-move",
    deltaX,
    deltaY,
    rocketId,
  );

  const techRuntime = techRuntimeModule.createBrowserTechRuntime({
    staticContext: techRuntimeModule.createBrowserTechStaticContext(dependencies),
    getActionInteractionRuntime: () => actionInteractionRuntime,
    getActionBarPort: () => actionBarPort,
    actionSessionRuntime,
    browserLayoutRuntime,
    cardRuntime,
    coordinatePort,
    effectExecutorPort: effectExecutorCommandPort,
    effectFlowRuntime: effectFlowHelpers,
    effectHistoryPort,
    effectSkipRuntime,
    industryRuntime,
    interactionChrome,
    renderRuntime,
    scanRuntime: scanFlowHelpers,
    hostPort: {
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      actionHistory,
      createActionContext: createActionContextForWorkingRoot,
      dispatchStandardIntent: (family, selector = {}, payload = {}) => (
        dispatchBrowserRuleInput({ kind: "standard_intent", family, selector, payload })
        || { ok: false, code: "ACTION_RUNTIME_UNAVAILABLE", message: "Standard Action runtime 尚未装配" }
      ),
      document,
      els,
      getPlanetSectorCoordinate,
      normalizeResourceCost,
      renderActionEffectBar,
      runAction,
      techRenderContext,
      uiRuntimeState,
    },
  });
  const {
    isTechAwaitingConfirm,
    isGeneratedResearchTechFollowupEffect,
    countOwnedTechByTypeAfterSelection,
    isPiratesRaidPlacementActiveForPlayer,
    renderPiratesRaidTechMarkers,
    getCurrentPiratesRaidMarkerEffect,
    getPiratesRaidLaunchCoordinate,
    researchTechForCurrentPlayer,
    commitSelectedResearchTech
  } = techRuntime;
  const getResearchTechSelectionEffect = () => techRuntime.getResearchTechSelectionEffect(createStateSourceReadoutRoot());
  const getResearchTechSelectionPayload = () => techRuntime.getResearchTechSelectionPayload(createStateSourceReadoutRoot());
  const getResearchTechSelectionOptions = () => techRuntime.getResearchTechSelectionOptions(createStateSourceReadoutRoot());
  const shouldSkipCurrentResearchTechCost = () => techRuntime.shouldSkipCurrentResearchTechCost(createStateSourceReadoutRoot());
  const {
    isTechActionSelectionActive, isTechTilePickingActive, syncTechSelectionChrome, renderTechBoard,
    closeTechBlueSlotPicker, isTechTileOwnedByOtherPlayer, appendResearchTechFollowupEffects,
    onTechTileSelected, onTechTileTaken, clearResearchTechSelectionState, restoreResearchTechSelectionAfterUndo,
    cancelPendingResearchTechTileChoice, cancelTechSelection, openTechBlueSlotPicker, finalizeTechTakeResult,
    commitResearchTechSelectionResult, selectResearchTechTileForCurrentFlow, confirmTechBlueSlotChoice,
    handleSupplyTechTileClick, executeIndustryPiratesRaidMarkerEffect, handlePiratesRaidTechMarkerClick,
    executeIndustryPiratesRaidPublicityEffect, startIndustryPiratesRaidLaunchFlow, buildPiratesRaidLaunchChoices,
    executeIndustryPiratesRaidLaunchEffect, handlePiratesRaidLaunchChoice, setCheatModeOpen, toggleCheatMode,
  } = bindDomainCommands("tech_runtime");

  const placeDataToBlueSlot = browserHostCommandPort.bindValue(
    "data_place_blue_slot",
    (blueSlot) => ({ blueSlot }),
  );

  const queueStateReadoutRender = renderRuntimeModule.createFrameRenderScheduler({
    state: uiRuntimeState,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    render: renderStateReadout,
  }).queue;

  let actionBarController = null;
  const actionBarPort = browserHostModule.actionBar.createActionBarPort({
    getController: () => actionBarController,
  });
  const {
    setActionButtonState, setTurnActionButtonState, setQuickActionButtonEnabled, updateActionButtons,
    isQuickPanelOpen, setQuickPanelOpen, toggleQuickPanel, updateQuickPanel,
  } = actionBarPort;

  const recoverPendingActionFromOpenHistoryForAiForRoot = browserHostModule.actionBar.createPendingActionRecoveryRuntime({
    isActionPending,
    isActionEffectFlowActive,
    hasActivePendingSubFlow,
    actionHistory,
    markActionPending,
    updateActionButtons,
    renderStateReadout,
  }).recoverForRoot;

  const recoverPendingActionFromOpenHistoryForAi = browserHostCommandPort.bindValue("action_recover_pending");

  turnEndFlow = turnEndFlowModule.createBrowserTurnEndFlow({
    staticContext: turnEndFlowModule.createBrowserTurnEndStaticContext(dependencies),
    actionBriefingRuntime: actionBriefingHelpers,
    actionLogRuntime: actionLogController,
    actionSessionRuntime,
    alienRuntime: alienRuntimeHelpers,
    alienUiRuntime: alienUiHelpers,
    cardRuntime,
    cardSelectionState,
    cardTriggerRuntime,
    effectFlowRuntime: effectFlowHelpers,
    finalUiRuntime,
    handFlowRuntime: handFlowHelpers,
    incomeRuntime,
    pendingSubFlowRuntime,
    playerEffectOwnerRuntime,
    playerLookupRuntime,
    renderRuntime,
    turnHostRuntime,
    turnReadoutRuntime,
    getAlienSpeciesRuntime: () => alienSpeciesRuntime,
    getDebugRuntime: () => debugRuntimeController,
    hostPort: {
      HISTORY_SOURCE_MAIN,
      HISTORY_SOURCE_QUICK,
      PASS_HAND_LIMIT,
      PASS_RESERVE_ROUNDS,
      actionHistory,
      quickActionHistory,
      els,
      uiRuntimeState,
      clearActionEffectFlow,
      isActionEffectFlowActive,
      refreshLatestActionLogRecoverySnapshot,
      renderTechBoard,
      rotateSolarOrbit: rotateSolarOrbitForRoot,
      scheduleAiAutoStepIfNeeded,
      updateActionButtons,
    },
  });

  let undoController = null;
  const undoPort = browserHostModule.actionBar.createUndoPort({
    getController: () => undoController,
    submitUndo: browserHostCommandPort.bindValue("history_undo_pending"),
  });
  const { undoForRoot: undoPendingActionForRoot, undo: undoPendingAction } = undoPort;
  const dataPlacementContinuationRuntime = actionInteractionRuntimeModule.createDataPlacementContinuationRuntime({
    getEffectExecutors: () => effectExecutors,
    getIndustryRuntime: () => industryRuntime,
  });

  actionInteractionRuntime = actionInteractionRuntimeModule.createBrowserActionInteractionRuntime({
    staticContext: actionInteractionRuntimeModule.createBrowserActionInteractionStaticContext(
      dependencies,
      { HISTORY_SOURCE_MAIN, SCORE_SOURCE_KEYS },
    ),
    actionGuardRuntime,
    actionSessionRuntime,
    dataPlacementPort: dataPlacementContinuationRuntime,
    effectFlowRuntime: effectFlowHelpers,
    effectHistoryPort,
    handFlowRuntime: handFlowHelpers,
    interactionChrome,
    playerEffectOwnerRuntime,
    renderRuntime,
    scoreSourceRuntime,
    actionPort: {
      beginCardSelection,
      createActionContext: createActionContextForWorkingRoot,
      runAction,
      validateIndustryHuanyuMoveRocket,
    },
    cardTriggerPort: { hasActiveCardTriggerResolution, settleCardTasksAfterEffect },
    plutoRewardPort: {
      buildChoiceRewardSummary: buildPlutoChoiceRewardSummary,
      buildRewardEffects: buildPlutoRewardEffectsForAction,
    },
    hostPort: {
      els,
      getBoardPointFromPolarPoint,
      markerBelongsToPlayer,
      markerOwnerLabel,
      openLandTargetPicker,
      quickActionHistory,
      removeRocketElement,
      restoreMutableObject,
      tokenWidths,
      uiRuntimeState,
      updateActionButtons,
    },
  });

  actionBarController = browserHostModule.actionBar.createBrowserDesktopActionBarController({
    actionGuardRuntime,
    actionInteractionRuntime,
    actionSessionRuntime,
    cardRuntime,
    cardSelectionState,
    dataAnalyzeRuntime: dataAnalyzeInteractionRuntime,
    handFlowRuntime: handFlowHelpers,
    pendingSubFlowRuntime,
    playerLookupRuntime,
    techRuntime,
    rulePort: { actions, abilities, scanEffects, quickTrades, actionHistory, quickActionHistory },
    hostPort: {
      els,
      syncFinalResultButton,
      createReadoutRoot: createStateSourceReadoutRoot,
      createActionContext: createActionContextForWorkingRoot,
      createReadoutActionContext,
      isAiPlayer: isAiAutoBattlePlayer,
      isAiAutomationPaused,
      renderActionEffectBar,
    },
  });
  undoController = browserHostModule.actionBar.createBrowserUndoController({
    actionGuardRuntime,
    actionSessionRuntime,
    effectFlowRuntime: effectFlowHelpers,
    effectFlowUndoRuntime,
    historyRefreshRuntime,
    matchRuntime: browserMatchRuntime,
    pendingSubFlowRuntime,
    techRuntime,
    hostPort: {
    actionHistory,
    quickActionHistory,
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    uiRuntimeState,
    clearActionEffectFlow,
    removeLastActionLogStep,
    takeCompletedEffectFlowForUndo,
    setActionEffectFlowActive: (active) => interactionChrome.setActionEffectFlowActive(active),
    updateActionButtons,
    renderStateReadout,
    peekCompletedEffectFlowForUndo,
    removeActionLogStepsBySource,
    },
  });

  const confirmLandTargetChoice = actionInteractionRuntimeModule.createLandDecisionPort({
    submitActiveDecision: submitActiveCardDecision,
  }).confirm;

  const debugRuntimeController = debugRuntimeModule.createBrowserDebugRuntime({
    aiController,
    alienSpeciesPort,
    browserContextRuntime,
    cardSelectionState,
    coordinatePort,
    effectFlowRuntime: effectFlowHelpers,
    playerEffectOwnerRuntime,
    playerLookupRuntime,
    techRuntime,
    turnHostRuntime,
    turnReadoutRuntime,
    browserPort: { window, document, resize },
    statePort: { uiRuntimeState, getNormalTokenAssetForPlayer },
    decisionPort: {
      closeTechBlueSlotPicker,
      closeDataPlacePicker,
      closeScanTargetPicker,
      closeScanAction4Picker,
      closeLandTargetPicker,
      closeAlienTracePicker: (workingRoot) => closeAlienTracePickerForRoot(workingRoot),
      clearActionEffectFlow,
      clearActionPending,
      clearMoveRocketHighlight,
      resolveCompletedSectorSettlements,
      maybeStartFundamentalismRoundStartIncomeFlow,
      maybeOpenActionBriefingForCompletedCycle,
      maybeAutoOpenFinalResultDialog,
      clearTransientStateForRecovery,
      advanceTurnAfterPlayerAction,
      applyIndustryRoundStartBonuses,
      activateAomomoBoard,
    },
    renderPort: {
      els,
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
    },
    debugRules: dependencies.debugRules,
    constants: { DEBUG_QUICK_SECTOR_SCAN_EXTRA_LIMIT },
  });
  const focusDebugCalibration = (...args) => callDebugCommand("focusDebugCalibration", args);

  const appEventState = window.SetiAppEvents.createAppEventState({
    pending: browserMatchRuntime,
    alien: alienSpeciesPort,
    ui: uiRuntimeState,
  });

  alienSpeciesRuntime = alienSpeciesRuntimeModule.createBrowserAlienSpeciesRuntime({
    actionInteractionRuntime,
    actionSessionRuntime,
    alienRuntime: alienRuntimeHelpers,
    alienUiRuntime: alienUiHelpers,
    boardQueryRuntime,
    browserContextRuntime,
    cardRuntime,
    cardTriggerRuntime,
    coordinateRuntime,
    effectExecutorPort: effectExecutorCommandPort,
    effectFlowRuntime: effectFlowHelpers,
    historyPort: { actionHistory, quickActionHistory },
    industryRuntime,
    manualAiInputGuard,
    pendingSubFlowRuntime,
    playerEffectOwnerRuntime,
    renderRuntime,
    scoreSourceRuntime,
    turnEndRuntime: turnEndPort,
    hostPort: { startScreenState, uiRuntimeState },
    renderPort: {
      banrenmaBonusMarkerElements,
      debugRuntimeController: {
        setDebugAlienTraceModeActive: (...args) => callDebugCommand("setDebugAlienTraceModeActive", args),
        toggleDebugAlienTraceMode: (...args) => callDebugCommand("toggleDebugAlienTraceMode", args),
        enableDebugAlienTraceModeForReveal: (...args) => callDebugCommand("enableDebugAlienTraceModeForReveal", args),
      },
      document,
      els,
      renderActionEffectBar,
      setScanTargetActionLayout,
      updateActionButtons,
      window,
      yichangdianAnomalyMarkerElements,
    },
    rulePort: { buildAlienTraceEvent, formatPlanetRewardGain, getPlayerCompanyBaseIncome },
    speciesRules: dependencies.alienSpeciesRules,
    constants: {
      BANRENMA_PANEL_BONUS_EFFECT_TYPE,
      HISTORY_SOURCE_QUICK,
      JIUZHE_THRESHOLD_CARD_EFFECT_TYPE,
      RESOURCE_ICON_SRC,
    },
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
    confirmPlayCardSelection: () => (
      getPendingPlayCardSelection()?.card?.id
        ? dispatchBrowserRuleInput({
          kind: "standard_intent",
          family: "play_card",
          selector: { cardInstanceId: getPendingPlayCardSelection().card.id },
        })
        : confirmPlayCardSelection()
    ),
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
    isIndustryFutureSpanHandSelectionActive: (...args) => industryRuntime.isIndustryFutureSpanHandSelectionActive(...args),
    handleIndustryFutureSpanHandClick,
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
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
    initializeShell: window.SetiAppBootstrap.createBrowserShellInitializer({
      actionLogViewRuntime,
      renderRuntime: {
        setTokenAssetSizes,
        updateContinueButton: updateStartScreenContinueButton,
      },
      startScreenRuntime: startScreenController,
    }),
    startScreenState,
    savePersistentGameStateNow,
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
      browserServices: residentBrowserServices.createPublicFacade(),
    },
  });

})();

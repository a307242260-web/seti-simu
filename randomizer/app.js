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
    finalReadModelModule,
    browserReadModelModule,
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
    ai,
    alienTraceRewardFlow,
    actionRuntimeModule,
    quickTurnActionExecutorModule,
    conditionalDecisionDomainModule,
    conditionalActionExecutorModule,
    actionInteractionRuntimeModule,
    actionLogRuntimeModule,
    gameRecoveryModule,
    ruleCompositionModule,
    productionCompositionModule,
    productionKernelModule,
    browserRuleCompositionModule,
    runtimeModule,
    refreshModule,
    renderRuntimeModule,
    playerStatsUiModule,
    debugRuntimeModule,
    finalUiRuntimeModule,
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
  const els = window.SetiAppDom.collectElements(document);
  const Image = window.Image;
  const Blob = window.Blob;
  const residentTimerService = browserHostModule.browserServices.createTimerService({
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame?.bind(window),
  });
  const requestAnimationFrame = (callback) => {
    const scheduled = residentTimerService.requestFrame(callback);
    return scheduled.frameId ?? scheduled.timerId ?? 0;
  };
  const residentFocusService = browserHostModule.browserServices.createFocusService({
    timerService: residentTimerService,
  });
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
  const AI_DIFFICULTY_LAUGHABLE = "laughable";
  const AI_DIFFICULTY_WEAK_START = "weak_start";
  const HISTORY_SOURCE_MAIN = "main";
  const HISTORY_SOURCE_QUICK = "quick";
  const HISTORY_SOURCE_SETUP = "setup";
  const runtime = runtimeModule.createRuntime({
    aiDifficulty: AI_DIFFICULTY_LAUGHABLE,
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    alienTypeIds: aliens.ALIEN_TYPE_IDS || [],
    industryCardFiles: INDUSTRY_CARD_FILES,
  });
  const actionLogState = runtime.actionLog;
  const actionBriefingState = runtime.actionBriefing;
  const startScreenState = runtime.startScreen;
  const uiRuntimeState = runtime.ui;
  const browserHostState = runtime.browserHost;
  const isBrowserHostAiPlayer = (playerId) => (
    browserHostState.aiPlayerIds.some((id) => String(id) === String(playerId))
  );
  let turnEndFlow = null;
  let actionInteractionRuntime = null;
  let cardTriggerRuntime = null;
  let finalReadModelOwner = null;
  let browserReadModelOwner = null;
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
  const cardSelectionDecisionModule = window.SetiCardSelectionDecision;
  const browserPendingDecisionModule = window.SetiBrowserPendingDecision;
  const standardActionModule = window.SetiStandardAction;
  let humanActionInputAdapter = null;
  function submitHumanAction(action) {
    return humanActionInputAdapter
      ? humanActionInputAdapter.submit(action)
      : { ok: false, code: "HUMAN_ACTION_INPUT_UNAVAILABLE", message: "人类 Action input adapter 尚未装配" };
  }
  function listHumanLegalActions(family = null) {
    const actions = humanActionInputAdapter
      ? humanActionInputAdapter.listLegalActions()
      : ruleComposition.inputPort.enumerateActions({});
    return family == null ? actions : actions.filter((action) => action.family === family);
  }
  const cloneResidentPresentation = browserHostModule.residentProjection.clonePresentation;
  const setBrowserStatusNote = (message) => {
    const snapshot = residentViewStateStore.dispatch({
      type: "status.set",
      note: String(message || ""),
    });
    return snapshot?.ok === false ? snapshot : snapshot.status.note;
  };
  const handleDiscardIncomeCardChoice = (...args) => (
    effectChoiceFlowHelpers.handleDiscardIncomeCardChoice(...args)
  );
  const handleProbeSectorScanChoiceCommand = (...args) => (
    effectChoiceFlowHelpers.handleProbeSectorScanChoice(...args)
  );
  const executeSectorXScanEffect = (...args) => effectExecutors.executeSectorXScanEffect(...args);
  const maybeReturnPlayedCardToHandAfterSectorScan = (...args) => (
    effectExecutors.maybeReturnPlayedCardToHandAfterSectorScan(...args)
  );
  const removePlanetMarkerForChoice = (...args) => effectExecutors.removePlanetMarkerForChoice(...args);
  const finishAutomaticRewardEffect = (...args) => effectExecutors.finishAutomaticRewardEffect(...args);
  const insertActionEffectsAfterCurrent = (...args) => effectExecutors.insertActionEffectsAfterCurrent(...args);
  const insertActionEffectsBeforeCurrent = (...args) => effectExecutors.insertActionEffectsBeforeCurrent(...args);
  const openYichangdianCornerPicker = (...args) => effectExecutors.openYichangdianCornerPicker(...args);
  const handleYichangdianCornerChoice = (...args) => effectExecutors.handleYichangdianCornerChoice(...args);
  const applyAomomoScanCostAndBonus = (...args) => effectExecutors.applyAomomoScanCostAndBonus(...args);
  const getPlanetName = (...args) => effectExecutors.getPlanetName(...args);
  const markerBelongsToPlayer = (...args) => effectExecutors.markerBelongsToPlayer(...args);
  const playerHasOwnOrbitMarkerAtPlanet = (...args) => (
    effectExecutors.playerHasOwnOrbitMarkerAtPlanet(...args)
  );
  const markerOwnerLabel = (...args) => effectExecutors.markerOwnerLabel(...args);
  const buildPlanetMarkerRemovalChoices = (...args) => (
    effectExecutors.buildPlanetMarkerRemovalChoices(...args)
  );
  const formatPlanetRewardGain = (...args) => effectExecutors.formatPlanetRewardGain(...args);
  const buildPlutoRewardEffectsForAction = (...args) => (
    effectExecutors.buildPlutoRewardEffectsForAction(...args)
  );
  const buildPlutoChoiceRewardSummary = (...args) => (
    effectExecutors.buildPlutoChoiceRewardSummary(...args)
  );
  const getSectorXsMatchingCondition = (...args) => (
    effectExecutors.getSectorXsMatchingCondition(...args)
  );
  const sectorXHasAvailableScanTarget = (...args) => (
    effectExecutors.sectorXHasAvailableScanTarget(...args)
  );
  const isAlienFamilyCard = (...args) => effectExecutors.isAlienFamilyCard(...args);
  const countOwnedTechByType = (...args) => effectExecutors.countOwnedTechByType(...args);
  const enrichScanResultEvents = (...args) => effectExecutors.enrichScanResultEvents(...args);
  const getPlayerCompanyBaseIncome = (...args) => (
    effectExecutors.getPlayerCompanyBaseIncome(...args)
  );
  const effectExecutorRuntimePort = Object.freeze({
    executeSectorXScanEffect,
    maybeReturnPlayedCardToHandAfterSectorScan,
    removePlanetMarkerForChoice,
    finishAutomaticRewardEffect,
    insertActionEffectsAfterCurrent,
    insertActionEffectsBeforeCurrent,
    openYichangdianCornerPicker,
    handleYichangdianCornerChoice,
    applyAomomoScanCostAndBonus,
    getPlanetName,
    markerBelongsToPlayer,
    playerHasOwnOrbitMarkerAtPlanet,
    markerOwnerLabel,
    buildPlanetMarkerRemovalChoices,
    formatPlanetRewardGain,
    buildPlutoRewardEffectsForAction,
    buildPlutoChoiceRewardSummary,
    getSectorXsMatchingCondition,
    sectorXHasAvailableScanTarget,
    isAlienFamilyCard,
    countOwnedTechByType,
    enrichScanResultEvents,
    getPlayerCompanyBaseIncome,
  });
  const turnEndPort = turnEndFlowModule.createTurnEndPort({
    getRuntime: () => turnEndFlow,
  });
  const {
    createPassEvent, executePassFirstRotateEffect, executePassHandLimitEffect,
    maybeContinueAlienRevealQueuedOpportunities, maybeContinuePendingTurnEndRevealFlow,
    maybeResumeTurnEndAfterReveal,
  } = turnEndPort;
  let debugRuntimeController = null;
  const setDebugOpen = (...args) => debugRuntimeController?.setDebugOpen(...args);
  const setDebugPlayerMenuOpen = (...args) => debugRuntimeController?.setDebugPlayerMenuOpen(...args);
  const renderDebugPlayerSwitch = (...args) => debugRuntimeController?.renderDebugPlayerSwitch(...args);
  const toggleSectorWinDebug = (...args) => debugRuntimeController?.toggleSectorWinDebug(...args);
  const logAomomoDebugCoordinates = (...args) => debugRuntimeController?.logAomomoDebugCoordinates(...args);
  const focusDebugCalibration = (...args) => debugRuntimeController?.focusDebugCalibration(...args);
  const focusJiuzheDebugCalibration = (...args) => focusDebugCalibration(...args);
  const focusYichangdianDebugCalibration = (...args) => focusDebugCalibration(...args);
  const focusFangzhouDebugCalibration = (...args) => focusDebugCalibration(...args);
  const focusBanrenmaDebugCalibration = (...args) => focusDebugCalibration(...args);
  const focusChongDebugCalibration = (...args) => focusDebugCalibration(...args);
  const focusAmibaDebugCalibration = (...args) => focusDebugCalibration(...args);
  const focusAomomoDebugCalibration = (...args) => focusDebugCalibration(...args);
  const actionInteractionPort = actionInteractionRuntimeModule.createActionInteractionPort({
    getRuntime: () => actionInteractionRuntime,
  });
  const {
    getPlutoReservedCards, ensurePlutoCardEffectState, getPlutoActionState, addPlutoMarker,
    removePlutoMarker, collectPlutoMarkers, buildPlutoMarkerContext, playerHasOwnPlutoLanding,
    buildPlutoMarkerRemovalChoices, getPlutoCandidateRockets, getPlutoActionCost, getAvailablePlutoAction,
    executePlutoAction, getCurrentPlanetActionPlacement, getPlutoChoiceActionLabel, formatPlutoChoiceLabel,
    scheduleRenderMoveArrows, clearMoveRocketHighlight, activateMoveMode,
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
    openDataPlacePicker,
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
    listHumanActions: (family) => listHumanLegalActions(family),
    submitHumanAction,
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
  const landTargetDecisionRuntime = actionInteractionRuntimeModule.createLandTargetDecisionRuntime({
    executePlutoAction: (...args) => actionInteractionRuntime.executePlutoAction(...args),
    submitAction: (...args) => submitHumanAction(...args),
    getCurrentActionEffect: (...args) => getCurrentActionEffect(...args),
    effectExecutors: () => effectExecutors,
    getPendingLandTargetDecision: (...args) => getPendingLandTargetDecision(...args),
    withPendingOwnerPlayer: (...args) => withPendingOwnerPlayer(...args),
    closeLandTargetPicker: (...args) => closeLandTargetPicker(...args),
    setBrowserStatusNote,
    renderStateReadout: (...args) => renderStateReadout(...args),
  });
  const confirmLandTargetChoiceForRoot = landTargetDecisionRuntime.confirmForRoot;
  const cancelLandTargetChoiceForRoot = landTargetDecisionRuntime.cancelForRoot;
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
    defaultInitialHandCount: DEFAULT_INITIAL_HAND_COUNT,
    passReserveRounds: PASS_RESERVE_ROUNDS,
    finalScoreIds: FINAL_SCORE_IDS,
    wheelOffsets: WHEEL_OFFSETS,
    aomomoClearNebulaId: aomomo?.NEBULA_ID || null,
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
    buildPlutoMarkerContext: (workingRoot) => (
      actionInteractionRuntime?.buildPlutoMarkerContext(workingRoot) || { plutoMarkers: [] }
    ),
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
    getPlayerCompanyBaseIncome,
    players,
  });
  const {
    createActionContext: createActionContextForWorkingRoot,
  } = actionContextFactory;
  const primaryActionUiRuntime = actionInteractionRuntimeModule.createPrimaryActionUiRuntime({
    canStartMainAction: (...args) => canStartMainAction(...args),
    getMainActionStartBlockReason: (...args) => getMainActionStartBlockReason(...args),
    setStatusNote: (...args) => setBrowserStatusNote(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
    getActionInteractionProjection: () => getActionInteractionProjection(),
    getAvailablePlutoAction,
    executePlutoAction,
    renderPlayerStats: (...args) => renderPlayerStats(...args),
    updateActionButtons: (...args) => updateActionButtons(...args),
    isAiInputLocked: (...args) => isAiAutomationInputLocked(...args),
    blockManualAiInput: (...args) => blockManualAiAutomationInput(...args),
    getHighlightedRocketId: () => uiRuntimeState.moveHighlightRocketId,
    enumerateActions: ({ family } = {}) => listHumanLegalActions(family),
    submitAction: (...args) => submitHumanAction(...args),
    submitQuickAction: (...args) => submitHumanAction(...args),
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
  });
  const { rotateSolarOrbitForRoot } = solarRotationRuntime;
  const {
    getMarkedNebulaIdsFromEvents,
    resultHasSignalMarkedEvent,
    getFlowMarkedNebulaIds,
    effectFlowMarkedNebula,
  } = effectFlowModule;
  let productionActionRegistry = null;
  const cardSelectionDecisionOwner = cardSelectionDecisionModule.createCardSelectionDecisionOwner({
    inspectSession: () => ruleComposition.inspect(),
    resolvePlayer: (workingRoot, pending) => (
      (workingRoot.playerState?.players || []).find((player) => (
        player.id === pending?.playerId || player.color === pending?.playerColor
      )) || players.getCurrentPlayer(workingRoot.playerState)
    ),
    getCardLabel: (card) => cards.getCardLabel(card),
    getSelectedPublicSlots: () => uiRuntimeState.publicCardSelectedSlots || [],
    getPublicScanChoicesForCard: (workingRoot, card) => (
      scanFlowHelpers.getPublicScanChoicesForCard(workingRoot, card)
    ),
    getPublicScanMinSelectable: (pending) => getPublicScanMinSelectable(pending),
    getPublicCardMultiSelectMinSelectable: (pending) => getPublicCardMultiSelectMinSelectable(pending),
    canBlindDraw: (workingRoot) => canBlindDrawForRoot(workingRoot),
    isFutureSpanEligibleHandCard: (card) => isFutureSpanEligibleHandCard(card),
  });
  let conditionalDecisionDomain = null;
  const browserPendingDecisionOwner = browserPendingDecisionModule.createBrowserPendingDecisionOwner({
    inspectSession: () => ruleComposition.inspect(),
    enumerate: (workingRoot, kind, pending) => (
      conditionalDecisionDomain.describePendingDecision(workingRoot, kind, pending)
    ),
  });
  const ruleComposition = browserRuleCompositionModule.createBrowserRuleComposition({
    ruleCompositionApi: ruleCompositionModule,
    productionCompositionApi: productionCompositionModule,
    productionKernelApi: productionKernelModule,
    stateStoreApi: stateStoreModule,
    highCouplingState: highCouplingStateModule,
    initialGameState: initialGameStateModule,
    effectRuntimeApi: effectSessionRuntimeModule,
    workingStateAdapter: {
      createWorkingState: createBrowserWorkingState,
      restoreWorkingState: restoreBrowserWorkingState,
      validateSessionBoundary: validateBrowserSessionBoundary,
    },
    createActionContext: createActionContextForWorkingRoot,
    getCommittedContext: getBrowserCommittedContext,
    browserProjection: {
      visibilityPolicy: browserHostModule.projectionAdapter.defaultVisibilityPolicy,
      getFinalReadModelOwner: () => finalReadModelOwner,
      getBrowserReadModelOwner: () => browserReadModelOwner,
      createRenderPresentation: (input) => createBrowserRenderPresentation(input),
    },
  });
  productionActionRegistry = Object.freeze({
    enumerate: (_workingState, request = {}) => ruleComposition.inputPort.enumerateActions(request),
  });
  let scheduleResidentDesktopRefresh = () => {};
  const browserRuleLifecycle = ruleComposition.lifecycle;
  const quickTurnActionExecutor = quickTurnActionExecutorModule.createQuickTurnActionExecutor();
  let actionRuntimeController = null;
  let humanDecisionInputAdapter = null;
  const submitInitialSetupAction = (selector) => {
    const refreshPresentation = () => queueMicrotask(() => {
      scheduleResidentDesktopRefresh();
      renderReservedCards?.();
      renderStateReadout?.();
      updateActionButtons?.();
      scheduleAiAutoStepIfNeeded?.();
    });
    const candidates = ruleComposition.inputPort.enumerateActions({ family: "choose_card" });
    const action = candidates.find((candidate) => Object.entries(selector).every(([key, value]) => (
      JSON.stringify(candidate.target?.[key]) === JSON.stringify(value)
    )));
    const result = action
      ? residentInputAdapter.dispatchAction(action)
      : { ok: false, code: "INITIAL_SETUP_ACTION_NOT_LEGAL", message: "初始选择输入已失效" };
    if (result?.ok !== false) refreshPresentation();
    return result;
  };
  const startInitialSelection = () => submitInitialSetupAction({ kind: "start_initial_setup" });
  const handleInitialSelectionCardClick = (kind, cardId) => submitInitialSetupAction({
    kind: "select_initial_card",
    selectionKind: kind,
    cardId,
  });
  const confirmInitialSelectionForCurrentPlayer = () => (
    submitInitialSetupAction({ kind: "confirm_initial_setup" })
  );
  const getInitialSetupProjection = (playerId = null) => {
    const resolvedPlayerId = playerId || getTurnFlowProjection().currentPlayerId;
    const setup = ruleComposition.projection({
      viewerId: `browser:setup:${resolvedPlayerId || "spectator"}`,
      playerId: resolvedPlayerId,
      role: resolvedPlayerId ? "player" : "spectator",
    }).state?.resident?.initialSetup || {};
    return ruleComposition.inspect().phase === "awaiting_input"
      ? { ...setup, interactive: false }
      : setup;
  };
  const canConfirmInitialSelection = (offer) => Boolean(
    offer?.selectedIndustryId && offer?.selectedInitialIds?.length === INITIAL_SELECTION_REQUIRED.initial
  );
  const getCardFromInitialOffer = (offer, kind, cardId) => (
    (kind === "industry" ? offer?.industryOptions : offer?.initialOptions)
      ?.find((card) => card.id === cardId) || null
  );
  const getInitialSelectionOffer = (playerId = null) => getInitialSetupProjection(playerId).offer || null;
  const getInitialSelectionPlayerIds = () => [...(getTurnFlowProjection().activePlayerIds || [])];
  const isInitialSelectionActive = () => (
    getInitialSetupProjection().active === true
  );
  const isInitialSelectionConfirmed = (playerId) => (
    getInitialSetupProjection(playerId).confirmedPlayerIds?.includes(playerId) === true
  );
  const turnHostRuntime = turnFlowModule.createTurnHostRuntime({
    getTurnFlowProjection: () => getTurnFlowProjection(),
    assertTurnFlowProjection: browserHostModule.residentProjection.assertTurnFlowProjection,
    setupInputPort: { startInitialSelection },
    newGame: (...args) => browserRuleLifecycle.newGame(...args),
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    defaultInitialPlayerColor: DEFAULT_INITIAL_PLAYER_COLOR,
    finalScoreIds: FINAL_SCORE_IDS,
    playerColorIds: players.PLAYER_COLOR_IDS,
    getInitialSetupConfig: (options = {}) => ({
      aiDifficulty: options.aiDifficulty || startScreenState.aiDifficulty,
      industryLabels: [...(startScreenState.selectedIndustryLabels || [])],
      alienPoolIds: [...(startScreenState.selectedAlienIds || [])],
    }),
    prepareBrowserNewGame: (options = {}) => {
      const aiDifficulty = options.aiDifficulty || startScreenState.aiDifficulty;
      const humanPlayerId = readPlayerTurnState().players.players.find(
        (player) => player.color === DEFAULT_INITIAL_PLAYER_COLOR,
      )?.id || null;
      const configured = configureDefaultAiOpponent({ aiDifficulty, humanPlayerId });
      browserHostState.aiPlayerIds = [...(configured?.playerIds || [])];
      setBrowserStatusNote(options.message || "新游戏已开始，请完成初始选择。");
    },
    normalizeAiDifficulty: (value) => startScreenModule.normalizeAiDifficulty(value, {
      weakStartValue: AI_DIFFICULTY_WEAK_START,
      defaultValue: AI_DIFFICULTY_LAUGHABLE,
    }),
  });
  const {
    getActiveOrderedPlayerIds, getRoundOrderPlayerIds,
    getDisplayedTurnNumber, getActionCycleNumber,
    startNewGame, normalizeAiDifficulty,
  } = turnHostRuntime;
  const browserMatchRuntime = runtimeModule.createBrowserMatchRuntime({
    readActionEffectFlow: () => getEffectPresentationProjection(),
    uiRuntimeState: runtime.ui,
  });
  const {
    getActionEffectFlow, setActionEffectFlow,
  } = browserMatchRuntime;
  const getPendingHandScanDecision = () => browserPendingDecisionOwner.read("hand_scan");
  const getPendingPassReserveSelection = () => browserPendingDecisionOwner.read("pass_reserve");
  const getPendingMovePayment = () => browserPendingDecisionOwner.read("move_payment");
  const getPendingDiscardDecision = () => browserPendingDecisionOwner.read("discard");
  const getPendingScanTargetDecision = () => browserPendingDecisionOwner.read("scan_target");
  const getPendingScanFreeMoveDecision = () => browserPendingDecisionOwner.read("scan_free_move");
  const getPendingProbeSectorScanDecision = () => browserPendingDecisionOwner.read("probe_sector_scan");
  const getPendingProbeLocationRewardDecision = () => browserPendingDecisionOwner.read("probe_location_reward");
  const getPendingCardMoveDecision = () => browserPendingDecisionOwner.read("card_move");
  const getPendingCardCornerFreeMove = () => browserPendingDecisionOwner.read("card_corner_free_move");
  const getPendingCardTriggerFreeMove = () => browserPendingDecisionOwner.read("card_trigger_free_move");
  const getPendingCardTriggerAction = () => browserPendingDecisionOwner.read("card_trigger");
  const getPendingCardTaskCompletion = () => browserPendingDecisionOwner.read("card_task_completion");
  const getPendingDataPlacementDecision = () => browserPendingDecisionOwner.read("data_placement");
  const getPendingLandTargetDecision = () => browserPendingDecisionOwner.read("land_target");
  const getPendingAlienTraceDecision = () => browserPendingDecisionOwner.read("alien_trace");
  const hasTurnEndRevealDecision = () => Boolean(browserPendingDecisionOwner.read("turn_end_reveal"));
  const getPublicScanQueueSession = () => (
    browserPendingDecisionOwner.read("public_scan")?.publicScanQueue || null
  );
  const openBrowserPendingDecision = (workingRoot, kind, pending) => (
    browserPendingDecisionOwner.open(workingRoot, kind, pending)
  );
  const deferBrowserPendingDecision = (workingRoot, kind, pending) => (
    browserPendingDecisionOwner.defer(workingRoot, kind, pending)
  );
  const readCardSelectionDecision = () => cardSelectionDecisionOwner.read();
  const openCardSelectionDecision = (workingRoot, pending) => {
    uiRuntimeState.publicCardSelectedSlots = [];
    uiRuntimeState.cardSelectionType = pending?.type || null;
    return cardSelectionDecisionOwner.open(workingRoot, pending);
  };
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
    readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
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
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
    rollbackPendingIndustryQuickAction: (...args) => rollbackPendingIndustryQuickAction(...args),
    cancelStrategyPassiveSlotChoice: (...args) => industryRuntime.cancelStrategyPassiveSlotChoice(...args),
    clearMoveRocketHighlight,
    deactivateMoveMode,
    finishIndustryAbilityFlow: (...args) => industryRuntime.finishIndustryAbilityFlow(...args),
    commitIrreversibleIndustryQuickAction: (...args) => commitIrreversibleIndustryQuickAction(...args),
    renderPlayerStats: (...args) => renderPlayerStats(...args),
    renderPublicCards: (...args) => renderPublicCards(...args),
    renderPlayerHand: (...args) => renderPlayerHand(...args),
    updateActionButtons: (...args) => updateActionButtons(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
    cancelActiveEffectSubFlowsForRoot: (...args) => cancelActiveEffectSubFlowsForRoot(...args),
    cancelMovePaymentSelection: (...args) => cancelMovePaymentSelection(...args),
    cancelDataPlacePicker,
    closeDataPlacePicker,
  });
  const {
    hasActiveEffectSubFlow,
    hasActivePendingSubFlow,
    cancelActivePendingSubFlowsForRoot,
  } = pendingSubFlowRuntime;
  const STRATEGY_SLOT_DECISION = "strategy_passive_slot";
  const landTargetPicker = actionInteractionRuntimeModule.createLandTargetPicker({
    document,
    els,
    openPendingDecision: openBrowserPendingDecision,
    readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
    getPendingOwnerFields: (...args) => getPendingOwnerFields(...args),
    renderStateReadout: (...args) => renderStateReadout(...args),
    focusService: residentFocusService,
  });
  const closeLandTargetPicker = landTargetPicker.close;
  const cancelLandTargetPicker = landTargetPicker.cancel;
  const openLandTargetPicker = landTargetPicker.open;
  const getSimulationConditionalPlayer = conditionalDecisionDomainModule.createConditionalPlayerResolver({
    resolvePlayerReference: (...args) => resolvePlayerReference(...args),
    getEffectOwnerPlayer: (...args) => getEffectOwnerPlayer(...args),
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
  });
  conditionalDecisionDomain = conditionalDecisionDomainModule.createConditionalDecisionDomain(() => ({
    finalScoring,
    FINAL_SCORE_IDS,
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
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
    isFutureSpanEligibleHandCard,
    getPublicCardMultiSelectMinSelectable,
    getPublicScanMinSelectable,
    getPublicCardSelectedSlots: () => uiRuntimeState.publicCardSelectedSlots || [],
    allowsBlindDrawInSelection,
    canBlindDraw,
    getPendingLandTargetDecision,
    getAlienTracePickerState: () => uiRuntimeState.alienTracePickerState || null,
    openPendingDecision: openBrowserPendingDecision,
    abilities,
    getFangzhouUnlockableTraceTypes: (workingRoot, ...args) => getFangzhouUnlockableTraceTypesForRoot(workingRoot, ...args),
    hasAlienTracePanelPlacementTarget: (workingRoot, ...args) => hasAlienTracePanelPlacementTargetForRoot(workingRoot, ...args),
    getAlienTraceChoiceSlotIds: (_workingRoot, ...args) => getAlienTraceChoiceSlotIds(...args),
    canPlaceStateTrace: (workingRoot, ...args) => canPlaceStateTraceForRoot(workingRoot, ...args),
    aliens,
    handleConditionalSectorChoice: (workingRoot, ...args) => (
      effectChoiceFlowHelpers.handleConditionalSectorChoice(workingRoot, ...args)
    ),
    handleChongFossilChoice,
    confirmProbeSectorScanSelection: (workingRoot, ...args) => (
      effectChoiceFlowHelpers.confirmProbeSectorScanSelection(workingRoot, ...args)
    ),
    handleProbeLocationRewardChoice: (workingRoot, ...args) => (
      effectChoiceFlowHelpers.handleProbeLocationRewardChoice(workingRoot, ...args)
    ),
    handleRunezuSymbolBranchChoice,
    handleRunezuFaceSymbolChoice,
    handleAmibaSymbolChoice,
    handleFinalScoreTileClick: (workingRoot, ...args) => (
      handleFinalScoreTileClickForRoot(workingRoot, ...args)
    ),
    handleSupplyTechTileClick: (workingRoot, ...args) => techRuntime.handleSupplyTechTileClick(workingRoot, ...args),
    confirmIndustryTuringBorrow: (workingRoot, ...args) => industryRuntime.confirmIndustryTuringBorrow(workingRoot, ...args),
    cancelIndustryAbilityFlow: (workingRoot, ...args) => industryRuntime.cancelIndustryAbilityFlow(workingRoot, ...args),
    confirmTechBlueSlotChoice: (workingRoot, ...args) => techRuntime.confirmTechBlueSlotChoice(workingRoot, ...args),
    cancelTechSelection: (workingRoot, ...args) => techRuntime.cancelTechSelection(workingRoot, ...args),
    handleFangzhouTraceDestinationChoice: (workingRoot, ...args) => handleFangzhouTraceDestinationChoiceForRoot(workingRoot, ...args),
    handleFangzhouUnlockTraceChoice: (workingRoot, ...args) => handleFangzhouUnlockTraceChoiceForRoot(workingRoot, ...args),
    handleDiscardCornerRepeatChoice: (workingRoot, ...args) => (
      effectChoiceFlowHelpers.handleDiscardCornerRepeatChoice(workingRoot, ...args)
    ),
    handleReturnUnfinishedTaskChoice: (workingRoot, ...args) => (
      effectExecutors.handleReturnUnfinishedTaskChoice(workingRoot, ...args)
    ),
    handleRemoveOrbitToProbeChoice: (workingRoot, ...args) => (
      effectChoiceFlowHelpers.handleRemoveOrbitToProbeChoice(workingRoot, ...args)
    ),
    handleRemovePlanetMarkerChoice: (workingRoot, ...args) => (
      effectExecutors.handleRemovePlanetMarkerChoice(workingRoot, ...args)
    ),
    confirmDataPlacement: (workingRoot, ...args) => actionInteractionRuntime.confirmDataPlacement(workingRoot, ...args),
    skipPendingDataPlacement: (workingRoot) => actionInteractionRuntime.skipPendingDataPlacement(workingRoot),
    handleDiscardIncomeCardChoice,
    confirmDiscardAnyForIncome: (workingRoot, ...args) => (
      effectChoiceFlowHelpers.confirmDiscardAnyForIncome(workingRoot, ...args)
    ),
    handlePayCreditChoice: (workingRoot, ...args) => (
      effectChoiceFlowHelpers.handlePayCreditChoice(workingRoot, ...args)
    ),
    handleOptionalHandScanChoice: (workingRoot, ...args) => (
      effectExecutors.handleOptionalHandScanChoice(workingRoot, ...args)
    ),
    handleHandCornerChoice: (workingRoot, ...args) => (
      effectExecutors.handleHandCornerChoice(workingRoot, ...args)
    ),
    handleScanAction4Choice: (workingRoot, ...args) => (
      effectExecutors.handleScanAction4Choice(workingRoot, ...args)
    ),
    confirmScanTarget: (workingRoot, ...args) => scanFlowHelpers.confirmScanTarget(workingRoot, ...args),
    handleDrawnHandScanSkip: (workingRoot, ...args) => scanFlowHelpers.handleDrawnHandScanSkip(workingRoot, ...args),
    confirmPassReserveSelection: (workingRoot, ...args) => confirmPassReserveSelectionForRoot(workingRoot, ...args),
    handleCardTriggerChoice: (workingRoot, ...args) => handleCardTriggerChoiceForRoot(workingRoot, ...args),
    cancelCardTriggerChoice: (workingRoot, ...args) => cancelCardTriggerChoiceForRoot(workingRoot, ...args),
    confirmCardTaskCompletion: (workingRoot, ...args) => confirmCardTaskCompletionForRoot(workingRoot, ...args),
    handleHandScanCardClick: (workingRoot, ...args) => scanFlowHelpers.handleHandScanCardClick(workingRoot, ...args),
    resolveCardMoveDirectionDecision: (workingRoot, ...args) => (
      resolveCardMoveDirectionDecisionForRoot(workingRoot, ...args)
    ),
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
    cancelStrategyPassiveSlotChoice: (workingRoot) => industryRuntime.cancelStrategyPassiveSlotChoice(workingRoot),
    finalizePendingDiscardSelection: (workingRoot, ...args) => handFlowHelpers.finalizePendingDiscardSelection(workingRoot, ...args),
    cancelDiscardSelection: (workingRoot) => handFlowHelpers.cancelDiscardSelection(workingRoot),
    handlePublicCardClick: (workingRoot, ...args) => handlePublicCardClickForRoot(workingRoot, ...args),
    confirmPublicCornerDiscardSelection: (workingRoot) => confirmPublicCornerDiscardSelectionForRoot(workingRoot),
    confirmPublicScanSelection: (workingRoot) => scanFlowHelpers.confirmPublicScanSelection(workingRoot),
    handleIndustryDeepspaceHandClick: (workingRoot, ...args) => industryRuntime.handleIndustryDeepspaceHandClick(workingRoot, ...args),
    handleIndustryFutureSpanHandClick: (workingRoot, ...args) => industryRuntime.handleIndustryFutureSpanHandClick(workingRoot, ...args),
    drawCardForCurrentPlayer: (workingRoot, ...args) => drawCardForCurrentPlayerForRoot(workingRoot, ...args),
    confirmLandTargetChoice: (workingRoot, choiceIndex, pending) => (
      confirmLandTargetChoiceForRoot(workingRoot, choiceIndex, pending)
    ),
    cancelLandTargetChoice: (workingRoot, pending) => cancelLandTargetChoiceForRoot(workingRoot, pending),
    finishCurrentTurnAfterAlienReveal: (workingRoot, ...args) => (
      turnEndFlow.finishCurrentTurnAfterAlienReveal(workingRoot, ...args)
    ),
    handleStateTraceSlotPlacement: (workingRoot, ...args) => handleStateTraceSlotPlacementForRoot(workingRoot, ...args),
  }));
  const conditionalActionExecutor = conditionalActionExecutorModule.createConditionalActionExecutor({
    domain: conditionalDecisionDomain,
    cardSelectionDecisionOwner,
    shouldRestageCardSelection: (workingRoot) => cards.isSelectionActive(workingRoot.cardState),
  });
  const conditionalCompositionRuntime = conditionalActionExecutorModule.createConditionalCompositionRuntime({
    executor: conditionalActionExecutor,
    syncFinalScorePendingMarks: (...args) => syncFinalScorePendingMarksForRoot(...args),
    dispatchAction: (...args) => actionRuntimeController.dispatchAction(...args),
    createActionContext: (...args) => createActionContextForWorkingRoot(...args),
    getCurrentPlayer: (...args) => getCurrentPlayer(...args),
    beginCardSelection: (...args) => beginCardSelection(...args),
    finishIndustryAbilityFlow: (...args) => finishIndustryAbilityFlow(...args),
    getCurrentActionEffect: (...args) => getCurrentActionEffect(...args),
    executeActionEffect: (...args) => executeActionEffect(...args),
  });
  const {
    enumerateConditionalActionsForRoot: enumerateSimulationConditionalActionsForRoot,
    advanceDeterministicStateForRoot: advanceSimulationDeterministicStateImpl,
    executeCurrentActionEffectForRoot: executeSimulationCurrentActionEffectImpl,
  } = conditionalCompositionRuntime;
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
    hasActivePendingSubFlow,
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
    readCardUiState: () => getCardUiProjection(),
    cards,
    getPendingDiscardDecision,
    readCardSelectionDecision,
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
    getActionEffectFlow,
    isAlienFamilyCard,
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

  const residentViewStateStore = browserHostModule.viewStateStore.createViewStateStore();
  const residentDesktopRenderer = browserHostModule.residentRenderer.createResidentRenderer({ document, els });
  const browserProjectionSource = ruleComposition.projectionSource;
  const residentProjectionAdapter = browserHostModule.projectionAdapter.createBrowserProjectionAdapter({
    stateSource: browserProjectionSource,
    sourceStateIsVisible: true,
    decisionPresenter: browserHostModule.industryAlienDecisionUi.createDomainDecisionPresenter({
      fallback: browserHostModule.cardDecisionUi.createCardDecisionPresenter({
        fallback: browserHostModule.projectionAdapter.defaultDecisionPresenter,
      }),
    }),
    createActionContext: ({ state }) => ({ actorId: state?.match?.currentPlayerId ?? null }),
    actionAdapter: {
      enumerate: (projectionContext) => ruleComposition.inputPort.enumerateActions(
        projectionContext.actorId == null ? {} : { actorId: projectionContext.actorId },
      ),
    },
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
  humanActionInputAdapter = browserHostModule.inputAdapter.createHumanActionInputAdapter({
    readLegalActions: () => ruleComposition.inputPort.enumerateActions({}),
    beforeDispatch: () => {
      if (ruleComposition.inspect().phase === "idle") {
        createGameRecoverySnapshot({ label: "人类 Standard Action 开始前稳定恢复点" });
      }
    },
    dispatchAction: (action) => residentInputAdapter.dispatchAction(action),
    afterDispatch: () => queueMicrotask(() => {
      scheduleResidentDesktopRefresh();
      updateActionButtons?.();
      renderStateReadout?.();
      scheduleAiAutoStepIfNeeded?.();
    }),
  });
  humanDecisionInputAdapter = browserHostModule.inputAdapter.createHumanDecisionInputAdapter({
    readDecisionProjection: () => (
      residentProjectionAdapter.projectSource({ viewer: getResidentViewer() }).decision
    ),
    readActiveDecision: () => ruleComposition.inspect().session?.decision || null,
    submitDecision: (submission) => residentInputAdapter.submitDecision(submission),
    afterSubmit: () => queueMicrotask(() => {
      renderResidentDesktop();
      renderInitialSelectionArea?.();
      updateActionButtons?.();
      scheduleAiAutoStepIfNeeded?.();
    }),
  });
  const residentDecisionRegistry = browserHostModule.industryAlienDecisionUi
    .registerIndustryAlienDecisionRenderers(
      browserHostModule.decisionUi,
      browserHostModule.cardDecisionUi.registerCardDecisionRenderer(
        browserHostModule.decisionUi,
        browserHostModule.decisionUi.createDefaultDecisionRegistry(),
      ),
    );
  const residentDecisionController = browserHostModule.decisionUi.createDecisionUiController({
    registry: residentDecisionRegistry,
    dispatchIntent: (intent) => {
      const result = intent?.kind === "decision"
        ? humanDecisionInputAdapter.submit(intent.submission)
        : residentInputAdapter.dispatchIntent(intent);
      if (intent?.kind === "view") {
        residentDecisionRenderer.render(createResidentRenderInput());
      }
      return result;
    },
  });
  const residentDecisionRenderer = browserHostModule.decisionUi.createDecisionDomRenderer({
    root: document.getElementById("compositionDecisionRoot"),
    controller: residentDecisionController,
  });
  const residentStorageService = browserHostModule.browserServices.createStorageService({
    window,
    storageKey: PERSISTENT_GAME_STORAGE_KEY,
  });
  const residentBrowserServices = browserHostModule.browserServices.createBrowserServices({
    storageService: residentStorageService,
    timerService: residentTimerService,
    focusService: residentFocusService,
    downloadService: browserHostModule.browserServices.createDownloadService({
      window,
      document,
      Blob,
      timerService: residentTimerService,
    }),
  });
  const browserCheckpointPort = gameRecoveryModule.createBrowserCheckpointAdapter({
    ruleLifecycle: browserRuleLifecycle,
    viewStateStore: residentViewStateStore,
    viewSchemaVersion: browserHostModule.viewStateStore.SCHEMA_VERSION,
  });

  const getResidentViewer = () => {
    const playerId = browserHostState.viewerPlayerId;
    return Object.freeze({
      viewerId: `browser:${playerId || "spectator"}`,
      playerId: playerId == null ? null : String(playerId),
      role: playerId == null ? "spectator" : "player",
    });
  };
  const resolveProjectedInterfacePlayerId = (projection) => {
    const playerTurn = projection?.resident?.browserReadModel?.runtime?.playerTurn;
    const sourcePlayers = playerTurn?.players?.players || [];
    const currentPlayer = sourcePlayers.find(
      (player) => String(player?.id) === String(playerTurn?.turn?.currentPlayerId),
    ) || null;
    if (!currentPlayer) return null;
    const isAiPlayer = (player) => isBrowserHostAiPlayer(player?.id);
    if (!isAiPlayer(currentPlayer)) return currentPlayer.id;
    const activeIds = new Set(playerTurn.turn?.activePlayerIds || []);
    return sourcePlayers.find((player) => activeIds.has(player.id) && !isAiPlayer(player))?.id
      || sourcePlayers.find((player) => !isAiPlayer(player))?.id
      || currentPlayer.id;
  };
  let browserProjectionReadActive = false;
  const readBrowserProjection = () => {
    if (browserProjectionReadActive) {
      throw new Error("BrowserProjection owner 禁止在 projection 构造期间递归读取 projection");
    }
    browserProjectionReadActive = true;
    try {
      let projection = residentProjectionAdapter.projectSource({ viewer: getResidentViewer() });
      const interfacePlayerId = resolveProjectedInterfacePlayerId(projection);
      if (String(interfacePlayerId || "") !== String(browserHostState.viewerPlayerId || "")) {
        browserHostState.viewerPlayerId = interfacePlayerId;
        projection = residentProjectionAdapter.projectSource({ viewer: getResidentViewer() });
      }
      return projection;
    } finally {
      browserProjectionReadActive = false;
    }
  };
  const getFinalUiProjection = () => (
    browserHostModule.residentProjection.selectFinalUiProjection(readBrowserProjection())
  );
  const getFinalScoreAiProjection = () => (
    browserHostModule.residentProjection.selectFinalScoreAiProjection(readBrowserProjection())
  );
  const getActionLogProjection = () => (
    browserHostModule.residentProjection.selectActionLogProjection(readBrowserProjection())
  );
  const getRecoveryProjection = () => (
    browserHostModule.residentProjection.selectRecoveryProjection(readBrowserProjection())
  );
  const getEventsProjection = () => (
    browserHostModule.residentProjection.selectEventsProjection(readBrowserProjection())
  );
  const getActionInteractionProjection = () => (
    browserHostModule.residentProjection.selectActionInteractionProjection(readBrowserProjection())
  );
  const getTurnFlowProjection = () => (
    browserHostModule.residentProjection.selectTurnFlowProjection(readBrowserProjection())
  );
  const getBoardCoordinateProjection = () => (
    browserHostModule.residentProjection.selectBoardCoordinateProjection(readBrowserProjection())
  );
  const getPlayerTurnProjection = () => (
    browserHostModule.residentProjection.selectPlayerTurnProjection(readBrowserProjection()).value
  );
  const getEffectPresentationProjection = () => (
    browserHostModule.residentProjection.selectEffectPresentation(readBrowserProjection()).value
  );
  const getCardUiProjection = () => (
    browserHostModule.residentProjection.selectCardUiProjection(readBrowserProjection()).value
  );
  const getSolarBriefingProjection = () => (
    browserHostModule.residentProjection.selectSolarBriefingProjection(readBrowserProjection()).value
  );
  const getAlienBoardProjection = () => (
    browserHostModule.residentProjection.selectAlienBoardProjection(readBrowserProjection()).value
  );
  const getProjectedFinalScoreBreakdown = (playerOrId) => {
    const playerId = typeof playerOrId === "object"
      ? (playerOrId?.id || playerOrId?.color)
      : playerOrId;
    return getFinalUiProjection().players.find((entry) => String(entry.id) === String(playerId))?.breakdown
      || { totalScore: Number(playerOrId?.resources?.score) || 0 };
  };
  const readPlayerTurnState = () => getPlayerTurnProjection();
  const playerLookupRuntime = runtimeModule.createPlayerLookupRuntime({
    players,
    uiRuntimeState,
    readPlayerTurnState,
  });
  const { isBrowserWorkingRoot, getPlayerById, getCurrentPlayer, getPlayerByColor } = playerLookupRuntime;
  const playerEffectOwnerRuntime = runtimeModule.createPlayerEffectOwnerRuntime({
    players,
    uiRuntimeState,
    readPlayerTurnState,
    getPlayerByColor,
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
    readPlayerTurnState,
    getPlayerById,
    getRoundOrderPlayerIds,
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
    cardTaskState, cardEffects, players, banrenma, jiuzhe, cards, fangzhou,
    resourceIconSrc: RESOURCE_ICON_SRC,
    clonePresentation: cloneResidentPresentation,
    isAiPlayer: (_playerId, player) => Boolean(player?.aiEnabled),
    getReadyChongTask: () => null,
    getReadyAmibaTask: () => null,
    getReadyRunezuTask: () => null,
    getTaskBlockReason: () => null,
    getRunezuTaskProgressIndexes: () => [],
    getPlutoActionState,
    getCardTypeCode: (...args) => getCardTypeCode(...args),
    isDebugAlienTraceMode: () => false,
  });
  const createInitialSelectionProjection = residentPresentationBuilder.createInitialSelection;
  const createReservedCardProjection = residentPresentationBuilder.createReservedCards;

  function createBrowserRenderPresentation({
    state,
    players: sourcePlayers,
    turnFlow,
    boardCoordinate,
    viewer,
    finalReadModel,
    initialSetup,
  }) {
    const getProjectedCompanyBaseIncome = (player) => players.normalizeIncome(
      initialCards.getIndustryEffect?.(player?.initialSelection?.industry)?.baseIncome || null,
    );
    const residentForPresentation = {
      players: {
        currentPlayerId: turnFlow.currentPlayerId,
        players: sourcePlayers,
      },
      aliens: state.aliens || {},
      initialSetup: structuredClone(initialSetup || {}),
    };
    const interfacePlayer = sourcePlayers.find(
      (player) => String(player?.id) === String(viewer?.playerId),
    ) || sourcePlayers.find(
      (player) => String(player?.id) === String(turnFlow.currentPlayerId),
    ) || null;
    const handCount = Array.isArray(interfacePlayer?.hand)
      ? interfacePlayer.hand.length
      : Math.max(0, Math.round(Number(interfacePlayer?.resources?.handSize) || 0));
    const selectionActive = Boolean(
      state.cards?.ui?.selectionActive
      || state.cards?.ui?.cardSelectionActive
      || state.cards?.ui?.playCardSelectionActive,
    );
    const allowsBlindDraw = selectionActive && state.cards?.ui?.allowsBlindDraw !== false;
    const blindDrawAvailable = Number(state.cards?.drawPileCount) > 0;
    const actualCurrentPlayer = sourcePlayers.find(
      (player) => String(player?.id) === String(turnFlow.currentPlayerId),
    ) || null;
    const playerById = new Map(sourcePlayers.map((player) => [String(player?.id), player]));
    const selectedPublicSlots = new Set(uiRuntimeState.publicCardSelectedSlots || []);
    const publicMultiSelectActive = Boolean(
      state.cards?.ui?.publicScanMultiSelectActive
      || state.cards?.ui?.publicCornerDiscardSelectionActive,
    );
    const movePayment = null;
    const discardDecision = null;
    const handScanDecision = null;
    const scanTargetDecision = null;
    const playCardSelection = uiRuntimeState.playCardSelection || null;
    const cardCornerAction = uiRuntimeState.cardCornerQuickAction || null;
    const handCardPlayAction = uiRuntimeState.handCardPlayAction || null;
    const publicCards = state.cards?.publicCards || [];
    const hand = Array.isArray(interfacePlayer?.hand) ? interfacePlayer.hand : [];
    const discardActive = Boolean(state.cards?.ui?.discardSelectionActive)
      && discardDecision?.playerId === interfacePlayer?.id;
    const playActive = Boolean(state.cards?.ui?.playCardSelectionActive)
      && actualCurrentPlayer?.id === interfacePlayer?.id;
    const movePaymentActive = Boolean(movePayment)
      && (movePayment.playerId || movePayment.player?.id) === interfacePlayer?.id;
    const handScanActive = Boolean(handScanDecision)
      && handScanDecision.playerId === interfacePlayer?.id;
    const handScanPickIndex = scanTargetDecision?.type === "hand_scan"
      && Number.isInteger(Number(scanTargetDecision.handIndex))
      ? Number(scanTargetDecision.handIndex)
      : null;
    const industryHandActive = Boolean(state.cards?.ui?.industryHandSelectionActive);
    const futureSpanHandActive = Boolean(state.cards?.ui?.industryFutureSpanHandSelectionActive);
    const cardCornerActionEnabled = actualCurrentPlayer?.id === interfacePlayer?.id
      && !selectionActive
      && !discardActive
      && !movePaymentActive
      && !handScanActive
      && !industryHandActive;
    const handPickActive = discardActive
      || playActive
      || movePaymentActive
      || handScanActive
      || industryHandActive
      || handScanPickIndex != null
      || cardCornerActionEnabled;

    function createHandCardView(card, index) {
      const label = card?.cardName || (card?.faceUp ? `手牌 ${index + 1}` : `手牌背面 ${index + 1}`);
      const imageSrc = card?.src || players.CARD_BACK_SRC;
      const view = {
        imageSrc,
        label,
        interactive: handPickActive && !(handScanPickIndex != null && index !== handScanPickIndex),
        disabled: false,
        selected: false,
        classNames: [],
        title: "",
        ariaLabel: label,
      };
      if (!view.interactive) return view;
      const playCost = getCardPlayCost(card);
      const formattedPlayCost = formatCardPlayCost(playCost);
      if (discardActive) {
        view.classNames.push("is-selectable");
        view.selected = (uiRuntimeState.discardSelectedHandIndexes || []).includes(index);
      } else if (handScanActive) {
        const scanChoices = getPublicScanChoicesForCard(card);
        if (scanChoices.ok) {
          view.classNames.push("is-scan-card");
          view.ariaLabel = `${label}（扫描牌，点击弃除并扫描）`;
          view.title = `${scanChoices.scanLabel}：点击后选择星云`;
        } else {
          view.classNames.push("is-scan-card-muted");
          view.disabled = true;
          view.title = scanChoices.message;
        }
      } else if (handScanPickIndex != null) {
        view.classNames.push("is-scan-card");
        view.selected = true;
        view.disabled = true;
        view.ariaLabel = `${label}（扫描中）`;
      } else if (futureSpanHandActive) {
        const eligible = isFutureSpanEligibleHandCard(card);
        view.classNames.push(eligible ? "is-industry-hand-card" : "is-industry-hand-card-muted");
        view.disabled = !eligible;
        view.ariaLabel = eligible ? `${label}（未来跨度：扣下并设置目标分）` : label;
        view.title = eligible
          ? `未来跨度：目标分 +${getFutureSpanDeltaForCard(card)}`
          : "未来跨度只能选择费用为信用点的手牌";
      } else if (industryHandActive) {
        view.classNames.push("is-industry-hand-card");
        view.ariaLabel = `${label}（深空探测：选择交换手牌）`;
        view.title = "深空探测：点击选择要交换的手牌";
      } else if (movePaymentActive) {
        const moveCard = isMovePaymentCard(card);
        view.classNames.push(moveCard ? "is-move-card" : "is-move-card-muted");
        view.disabled = !moveCard;
        view.selected = moveCard && (movePayment.selectedHandIndices || []).includes(index);
        view.ariaLabel = moveCard ? `${label}（移动牌，点击选择弃置）` : label;
        view.title = moveCard ? "弃置此牌以支付移动" : "";
      } else if (cardCornerActionEnabled) {
        const quickAction = null;
        const playAction = players.canAfford(actualCurrentPlayer, playCost)
          ? { actionKind: "play", label: "打出", cost: playCost }
          : null;
        view.selected = cardCornerAction?.cardId === card.id || handCardPlayAction?.cardId === card.id;
        if (quickAction || playAction) {
          if (quickAction) view.classNames.push("is-corner-action-card");
          if (playAction) view.classNames.push("is-hand-play-card");
          const labels = [
            playAction ? `打出，费用 ${formattedPlayCost}` : null,
            quickAction?.label || null,
          ].filter(Boolean).join("；");
          view.ariaLabel = `${label}（${labels}）`;
          view.title = view.selected
            ? `${labels}：点击上方按钮确认，或再次点击取消`
            : `${labels}：点击选择`;
        } else {
          view.classNames.push("is-corner-action-card-muted");
          view.title = "这张牌没有可用的手牌快捷操作";
        }
      } else if (playActive) {
        const affordable = players.canAfford(interfacePlayer, playCost);
        view.classNames.push(affordable ? "is-playable" : "is-unaffordable");
        view.selected = playCardSelection?.handIndex === index;
        view.ariaLabel = `${label}，费用 ${formattedPlayCost}`;
        view.title = affordable
          ? view.selected
            ? `已选择 ${label}，点击上方「打出」确认，或再次点击取消选择`
            : `选择 ${label}，费用 ${formattedPlayCost}`
          : `资源不足，需要 ${formattedPlayCost}`;
      }
      if (view.selected) view.classNames.push("is-selected");
      return view;
    }

    function normalizeIncomeValue(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 0;
      return Math.max(0, Number.isInteger(number) ? number : Math.round(number * 100) / 100);
    }

    function createIncomeView(player, key, label, iconSrc, showBasePlusIncrease = false) {
      const income = players.normalizeIncome(player?.income || null);
      const baseIncome = getProjectedCompanyBaseIncome(player);
      const total = normalizeIncomeValue(income[key]);
      const base = Math.min(total, normalizeIncomeValue(baseIncome?.[key]));
      const increase = Math.max(0, normalizeIncomeValue(total - base));
      return {
        label,
        iconSrc,
        value: showBasePlusIncrease ? `${base}+${increase}` : total,
        title: showBasePlusIncrease
          ? `${label} ${base}+${increase}（总计 ${total}）`
          : `${label} ${total}`,
      };
    }

    function createPlayerPanel(player) {
      const presentationPlayer = structuredClone(player);
      const finalPlayer = finalReadModel.players.find(
        (entry) => String(entry.id) === String(player?.id),
      );
      const color = players.getPlayerColorDefinition(player?.color);
      const resources = player?.resources || players.DEFAULT_RESOURCES;
      const income = players.normalizeIncome(player?.income || null);
      const placedData = data.listComputerPlacedTokens?.(presentationPlayer)?.length || 0;
      const totalData = Object.keys(data.COMPUTER_DATA_SLOTS || {}).length || 6;
      const showAomomo = Boolean(
        state.solarSystem?.aomomoActive
        || state.aliens?.aomomo?.revealInitialized
        || Number(resources.aomomoFossils) > 0,
      );
      const resourceStats = [
        { label: "信用点", value: resources.credits, iconSrc: RESOURCE_ICON_SRC.credits },
        { label: "能量", value: resources.energy, iconSrc: RESOURCE_ICON_SRC.energy },
        {
          label: "宣传",
          value: `${resources.publicity}/${players.RESOURCE_LIMITS.publicity}`,
          iconSrc: RESOURCE_ICON_SRC.publicity,
        },
        { label: "可用数据", value: resources.availableData, iconSrc: RESOURCE_ICON_SRC.data },
        {
          label: "额外公共扫描",
          value: resources.additionalPublicScan || 0,
          iconSrc: RESOURCE_ICON_SRC.additionalPublicScan,
        },
        ...(showAomomo ? [{
          label: "奥陌陌化石",
          value: resources.aomomoFossils || 0,
          iconSrc: RESOURCE_ICON_SRC.aomomoFossil,
        }] : []),
        {
          label: "当前数据放置进展",
          value: `${placedData}/${totalData}`,
          iconSrc: RESOURCE_ICON_SRC.analyzeData,
        },
      ];
      const runezuCounts = state.aliens?.runezu?.revealInitialized
        ? runezu.getPlayerSymbolCounts(player)
        : {};
      const runezuStats = (runezu.SYMBOL_IDS || [])
        .filter((symbolId) => (runezuCounts[symbolId] || 0) > 0)
        .map((symbolId) => ({
          label: runezu.formatSymbolLabel(symbolId),
          value: runezuCounts[symbolId],
          iconSrc: runezu.getSymbolSrc(symbolId),
        }));
      const fangzhouStats = state.aliens?.fangzhou?.revealInitialized ? [{
        label: "🔒",
        value: `${Math.min(3, Math.max(0, Number(fangzhou.getUnlockCount?.(state.aliens, player)) || 0))}/3`,
      }] : [];
      const labelName = String(player?.name || "").trim();
      const colorLabel = String(player?.colorLabel || "").trim();
      const strippedName = colorLabel && labelName.startsWith(colorLabel)
        ? labelName.slice(colorLabel.length).trim()
        : labelName;
      const displayName = `${labelName && labelName !== `${colorLabel}玩家` ? strippedName || labelName : "玩家"}${
        player?.aiEnabled ? "(电脑)" : ""
      }`;
      const opponentStats = {
        orbitLand: endGameScoring.countOrbitOrLandMarkers(player, state.planets || {}, {
          plutoMarkers: actionInteractionRuntime?.collectPlutoMarkersFromPlayerProjection({
            players: sourcePlayers,
          }) || [],
        }),
        sectorWins: OPPONENT_SECTOR_WIN_STATS.map(({ color: sectorColor, label, iconKey }) => ({
          label,
          value: endGameScoring.countSectorWinsByColor(player, state.data || {}, sectorColor),
          iconSrc: RESOURCE_ICON_SRC[iconKey],
        })),
        traces: ["yellow", "pink", "blue"].map((traceType) => ({
          label: `${traceType}外星人痕迹`,
          value: endGameScoring.countTraceMarkers(player, state.aliens || {}, traceType),
          iconSrc: RESOURCE_ICON_SRC[`alien${traceType[0].toUpperCase()}${traceType.slice(1)}`],
        })),
        runezu: runezuStats,
        jiuzhe: {
          visible: Boolean(state.aliens?.jiuzhe?.revealedSlotId
            || jiuzhe.getPlayerJiuzheCards?.(state.aliens || {}, player)?.length
            || jiuzhe.countPlayedCards?.(state.aliens || {}, player)
            || jiuzhe.getPanelThreat?.(state.aliens || {}, player)),
          count: jiuzhe.countPlayedCards?.(state.aliens || {}, player) || 0,
          threat: jiuzhe.getPanelThreat?.(state.aliens || {}, player) || 0,
        },
      };
      return {
        id: player?.id ?? null,
        color: player?.color ?? null,
        colorLabel: player?.colorLabel ?? null,
        displayName,
        uiColor: color.uiColor,
        tokenAssets: {
          rocket: color.rocketAsset,
          orbit: color.satelliteAsset,
          land: color.landdingAsset,
        },
        passed: turnFlow.passedPlayerIds.includes(player?.id),
        roundOrderNumber: turnFlow.roundOrderPlayerIds.indexOf(player?.id) + 1,
        score: Number(resources.score) || 0,
        handCount: Array.isArray(player?.hand)
          ? player.hand.length
          : Math.max(0, Number(resources.handSize) || 0),
        finalTotalScore: Number(finalPlayer?.breakdown?.totalScore) || Number(resources.score) || 0,
        resourceStats,
        incomeStats: [
          createIncomeView(player, "credits", "收入信用点", RESOURCE_ICON_SRC.credits, true),
          createIncomeView(player, "energy", "收入能量", RESOURCE_ICON_SRC.energy, true),
          createIncomeView(player, "handSize", "收入手牌", RESOURCE_ICON_SRC.incomeCard, true),
          { label: "收入宣传", value: income.publicity || 0, iconSrc: RESOURCE_ICON_SRC.publicity, title: "" },
          { label: "收入数据", value: income.availableData || 0, iconSrc: RESOURCE_ICON_SRC.data, title: "" },
          {
            label: "收入额外公共扫描",
            value: income.additionalPublicScan || 0,
            iconSrc: RESOURCE_ICON_SRC.additionalPublicScan,
            title: "",
          },
        ],
        runezuStats,
        fangzhouStats,
        techStats: OPPONENT_TECH_TYPES.map(({ type, label, color: techColor }) => ({
          type,
          label,
          color: techColor,
          slots: [1, 2, 3, 4].map((index) => {
            const tileId = `${type}${index}`;
            const owned = Array.isArray(player?.techState?.ownedTiles)
              ? player.techState.ownedTiles.some((tile) => tile?.id === tileId || tile === tileId)
              : Boolean(player?.techState?.ownedTiles?.[tileId]);
            const disabled = Array.isArray(player?.techState?.disabledTiles)
              ? player.techState.disabledTiles.includes(tileId)
              : Boolean(player?.techState?.disabledTiles?.[tileId]);
            return { label: `${label}${index}`, owned, disabled };
          }),
        })),
        opponentStats,
      };
    }

    function createPlayerDataPresentation(player) {
      if (!player) return { playerTokens: [], blueDropZones: [] };
      const presentationPlayer = structuredClone(player);
      const playerTokens = [];
      for (const token of data.listPoolTokens(presentationPlayer)) {
        const layout = data.getEffectivePoolSlotLayout(token.slotIndex);
        if (!layout) continue;
        playerTokens.push({
          key: `${player.id}:${token.id}`,
          kind: "pool",
          imageSrc: data.DATA_TOKEN_SRC,
          alt: `数据池 ${token.index}`,
          title: `数据池 ${token.index} @(${layout.percentX}%,${layout.percentY}%)`,
          tokenId: token.id,
          tokenIndex: token.index,
          slotIndex: token.slotIndex,
          blueSlot: null,
          placementSlot: null,
          percentX: layout.percentX,
          percentY: layout.percentY,
          scale: (layout.scalePercent / 100) * data.DATA_TOKEN_DISPLAY_SCALE,
        });
      }
      for (const token of data.listPlacedTokens(presentationPlayer)) {
        const blue = token.placementKind === "blueBonus";
        const layout = blue
          ? data.getBlueBonusDataSlotLayout(token.blueSlot)
          : data.getComputerDataSlotLayout(token.placementSlot);
        if (!layout) continue;
        playerTokens.push({
          key: `${player.id}:${token.id}`,
          kind: blue ? "blue-bonus" : "placed",
          imageSrc: data.DATA_TOKEN_SRC,
          alt: blue ? `蓝色科技位数据 ${token.index}` : `已放置数据 ${token.index}`,
          title: blue
            ? `已放置 ${token.index} @位置${token.blueSlot}蓝色科技 (${layout.percentX}%,${layout.percentY}%)`
            : `已放置 ${token.index} @第一排放置位${token.placementSlot} (${layout.percentX}%,${layout.percentY}%)`,
          tokenId: token.id,
          tokenIndex: token.index,
          slotIndex: null,
          blueSlot: blue ? token.blueSlot : null,
          placementSlot: blue ? null : token.placementSlot,
          percentX: layout.percentX,
          percentY: layout.percentY,
          scale: (layout.scalePercent / 100) * data.DATA_TOKEN_DISPLAY_SCALE,
        });
      }
      const hasTechState = Boolean(presentationPlayer.techState);
      const eligible = new Set(
        hasTechState ? data.listEligibleBlueBonusSlots(presentationPlayer) : [],
      );
      const hasPoolData = data.listPoolTokens(presentationPlayer).length > 0;
      const blueDropZones = [];
      for (const blueSlot of [1, 2, 3, 4]) {
        if (!hasTechState) continue;
        if (!data.hasBlueTechInBoardSlot(presentationPlayer, blueSlot)) continue;
        if (data.listBlueBonusPlacedTokens(presentationPlayer)
          .some((token) => token.blueSlot === blueSlot)) continue;
        const layout = data.getBlueBonusDataSlotLayout(blueSlot);
        if (!layout) continue;
        const tileId = data.getBlueTechTileInBoardSlot(presentationPlayer, blueSlot);
        const required = data.getRequiredComputerSlotForBlueBonus(blueSlot);
        const enabled = eligible.has(blueSlot) && hasPoolData;
        blueDropZones.push({
          blueSlot,
          enabled,
          title: enabled
            ? `放置数据到 ${tileId || `位置${blueSlot}蓝色科技`} 下方`
            : hasPoolData ? `需先在第一排第 ${required} 位放置数据` : "数据池没有可放置的数据",
          percentX: layout.percentX,
          percentY: layout.percentY,
          scale: (layout.scalePercent / 100) * data.DATA_TOKEN_DISPLAY_SCALE,
        });
      }
      return { playerTokens, blueDropZones };
    }

    function createSectorDataPresentation() {
      const result = {};
      for (const sectorId of [1, 2, 3, 4]) {
        const panels = [];
        for (const nebulaId of data.listNebulaIdsForSector(sectorId)) {
          const region = data.getNebulaPanelRegion(nebulaId);
          const tokens = data.listNebulaTokens(state.data || {}, nebulaId).map((token) => {
            const layout = data.getEffectiveNebulaSlotLayout(nebulaId, token.slotIndex, token);
            const ownerLabel = token.replacedByPlayerLabel || token.replacedByPlayerColor || "";
            return {
              key: `${nebulaId}:${token.id}`,
              imageSrc: token.playerTokenSrc || data.DATA_TOKEN_SRC,
              alt: ownerLabel
                ? `${data.getNebulaLabel(nebulaId)} ${ownerLabel}扫描标记 ${token.index}`
                : `${data.getNebulaLabel(nebulaId)} 数据 ${token.index}`,
              title: `${data.getNebulaLabel(nebulaId)} 序号${token.index} @槽位${token.slotIndex}${
                ownerLabel ? ` 已替换为${ownerLabel}token` : ""
              } 局部(${layout.percentX}%,${layout.percentY}%)`,
              tokenId: token.id,
              tokenIndex: token.index,
              slotIndex: token.slotIndex,
              replacedByPlayerColor: token.replacedByPlayerColor || null,
              percentX: layout.percentX,
              percentY: layout.percentY,
              widthPercent: (layout.scalePercent || 11.8) * 0.35,
            };
          });
          const winMarkers = (data.listSectorWinRecords(state.data || {}, nebulaId) || []).map((record) => {
            const slot = data.getSettlementWinMarkerSlot(nebulaId, record.settlementNumber);
            const layout = data.getEffectiveSectorWinMarkerLayout(
              nebulaId,
              record.slotKind || slot.slotKind,
              record.markerIndex || slot.markerIndex,
            );
            const ownerLabel = record.playerLabel || record.playerColor || "";
            return {
              key: `${nebulaId}:${record.settlementNumber}`,
              imageSrc: record.playerTokenSrc || "../assets/tokens/normal_token.png",
              alt: `${data.getNebulaLabel(nebulaId)} ${ownerLabel}胜利标记 ${record.settlementNumber || ""}`,
              title: `${data.getNebulaLabel(nebulaId)} 第${record.settlementNumber || "?"}次完成 ${ownerLabel}`,
              percentX: layout.percentX,
              percentY: layout.percentY,
              widthPercent: layout.scalePercent || 9.4,
            };
          });
          panels.push({ nebulaId, region, tokens, winMarkers });
        }
        result[String(sectorId)] = panels;
      }
      return result;
    }

    const solarSnapshot = solar.createSolarSnapshot(state.solarSystem || {});
    const wheelTransforms = [1, 2, 3, 4].map((wheelId) => ({
      wheelId,
      transform: `rotate(${(Number(state.solarSystem?.wheelSteps?.[wheelId]) || 0) * (Math.PI / 4)}rad)`,
    }));
    const sectors = [1, 2, 3, 4].map((slotId) => ({
      slotId,
      sectorId: state.solarSystem?.sectorBySlot?.[slotId] ?? null,
    }));
    const rotateIndex = ((Number(state.solarSystem?.rotation?.rotationCount) || 0) % ROTATE_STATE_SLOTS.length
      + ROTATE_STATE_SLOTS.length) % ROTATE_STATE_SLOTS.length;
    const playerDataPresentation = createPlayerDataPresentation(interfacePlayer);
    function getBoardMarkerPoint(sourceType, sourceId, radialFraction, angularFraction) {
      let coordinate = null;
      if (sourceType === "planet") {
        coordinate = solarSnapshot.planetLocations.find((planet) => planet.planetId === sourceId) || null;
      } else if (sourceType === "sector") {
        for (let x = 0; x < 8; x += 1) {
          if (solar.getNebulaAtCoordinate(x, 5, state.solarSystem?.sectorBySlot)?.id === sourceId) {
            coordinate = { x, y: 5 };
            break;
          }
        }
      }
      if (!coordinate) return null;
      const boundary = solar.getSectorCoordinateBoundary(coordinate.x, coordinate.y);
      const polar = boundary.polarBoundary || {};
      if (
        Number.isFinite(polar.innerRadius)
        && Number.isFinite(polar.outerRadius)
        && Number.isFinite(polar.startAngleDegrees)
        && Number.isFinite(polar.endAngleDegrees)
      ) {
        return solar.polarToGlobalPoint(
          polar.innerRadius + (polar.outerRadius - polar.innerRadius) * radialFraction,
          polar.startAngleDegrees + (polar.endAngleDegrees - polar.startAngleDegrees) * angularFraction,
        );
      }
      return boundary.boardCenter || solar.solarGridToGlobalPoint(coordinate.x, coordinate.y);
    }
    const planetFossils = state.aliens?.chong?.revealInitialized
      ? ["jupiter", "saturn"].flatMap((planetId) => {
        const fossils = chong.getAvailablePlanetFossils(state.aliens || {}, planetId);
        const point = fossils.length ? getBoardMarkerPoint("planet", planetId, 0.78, 0.72) : null;
        if (!point) return [];
        const label = getChongPlanetLabel(planetId);
        return [{
          key: `planet:${planetId}`,
          planetId,
          imageSrc: chong.FOSSIL_BACK_SRC,
          alt: `${label}化石背面`,
          title: `${label}化石背面 x${fossils.length}`,
          count: fossils.length,
          leftPercent: point.x / 10,
          topPercent: point.y / 10,
        }];
      }) : [];
    const runezuSymbols = state.aliens?.runezu?.revealInitialized
      ? runezu.listSourceSymbols(state.aliens || {}).flatMap((symbol) => {
        if (symbol.claimedByPlayerId || symbol.claimedByPlayerColor) return [];
        const surface = symbol.sourceType === "tech" ? "tech" : "board";
        const point = surface === "board"
          ? getBoardMarkerPoint(
            symbol.sourceType,
            symbol.sourceId,
            symbol.sourceType === "planet" ? 0.72 : 0.38,
            symbol.sourceType === "planet" ? 0.72 : 0.52,
          )
          : null;
        if (surface === "board" && !point) return [];
        return [{
          key: `${symbol.sourceType}:${symbol.sourceId}`,
          surface,
          sourceType: symbol.sourceType,
          sourceId: symbol.sourceId,
          imageSrc: runezu.getSymbolSrc(symbol.symbolId),
          alt: `符文族 ${symbol.symbolId}`,
          title: `符文族 ${symbol.sourceType}:${symbol.sourceId} ${runezu.formatSymbolLabel(symbol.symbolId)}`,
          leftPercent: point ? point.x / 10 : null,
          topPercent: point ? point.y / 10 : null,
        }];
      }) : [];
    const readoutLines = [
      "坐标轴 x0=中线上方偏右第一块，顺时针递增",
      `版图位置 ${[1, 2, 3, 4].map((wheelId) => (
        `W${wheelId}=${solar.mod8(state.solarSystem?.wheelSteps?.[wheelId])}`
      )).join("  ")}`,
      `行星 ${solarSnapshot.planetLocations.map((planet) => `${planet.name}[${planet.x},${planet.y}]`).join("  ")}`,
      `星云 ${solarSnapshot.nebulaRelations.map((relation) => relation.displayText).join("  ")}`,
      `可见统计 ${Object.entries(solarSnapshot.statistics.visibleMeaningfulContentCounts)
        .map(([label, count]) => `${label}=${count}`).join("  ")}`,
      "",
      "轮次状态",
      turnFlow.terminal
        ? `游戏结束：第${turnFlow.roundNumber}轮全员 PASS，进行终局计分`
        : `第${turnFlow.roundNumber}轮 第${turnFlow.displayedTurnNumber}回合`,
      `基础顺位 ${turnFlow.turnOrderPlayerIds.map((id) => turnFlow.playerLabelsById[String(id)] || id).join(" > ") || "无"}`,
      `本轮顺位 ${turnFlow.roundOrderPlayerIds.map((id) => turnFlow.playerLabelsById[String(id)] || id).join(" > ") || "无"}`,
      "",
      ...finalScoring.getReadoutLines(structuredClone(state.finalScoring || {})),
      "",
      "星球统计",
      ...planetStats.formatPlanetStatsLines(structuredClone(state.planets || {})),
      "",
      ...getRocketCoordinateReadoutLines({
        rockets: boardCoordinate.tokens,
        activeRocketId: boardCoordinate.activeRocketId,
        statusNote: residentViewStateStore.getSnapshot().status.note || state.pieces?.statusNote || null,
      }),
      "",
      ...tech.getReadoutLines(structuredClone(state.tech || {}), {
        currentPlayerId: turnFlow.currentPlayerId,
        players: structuredClone(sourcePlayers),
      }),
      "",
      ...data.getReadoutLines({
        currentPlayerId: turnFlow.currentPlayerId,
        players: structuredClone(sourcePlayers),
      }),
      "",
      ...data.getNebulaReadoutLines(structuredClone(state.data || {})),
      "",
      ...data.getSectorSettlementReadoutLines(structuredClone(state.data || {})),
      "",
      ...aliens.getReadoutLines(structuredClone(state.aliens || {})),
      "",
      ...(industry.getReadoutLines?.(structuredClone(interfacePlayer), turnFlow.roundNumber) || []),
    ];

    return {
      boardChrome: {
        wheelTransforms,
        sectors,
        aomomoWheelImageSrc: state.solarSystem?.aomomoActive ? aomomo.WHEEL3_AMM_SRC || null : null,
        rotateTokenSlot: structuredClone(ROTATE_STATE_SLOTS[rotateIndex] || null),
      },
      tokenPresentation: {
        activeRocketId: boardCoordinate.activeRocketId,
        draggingRocketId: state.pieces?.draggingRocketId ?? null,
        tokens: boardCoordinate.tokens.map((token) => {
          const color = players.getPlayerColorDefinition(token.color || players.DEFAULT_PLAYER_COLOR);
          const onReference = isRocketOnPlanetsReference(token);
          const kind = token.referencePlacement?.kind;
          const boardPoint = onReference ? null : getBoardPointFromPolarPoint(token);
          const referencePoint = token.planetsReference || { percentX: 50, percentY: 50 };
          const referenceLabel = getReferencePlacementName(token.referencePlacement);
          const tokenTypeLabel = token.kind === rocketActions.ROCKET_KIND?.CHONG_FOSSIL
            ? "化石"
            : kind === "orbit" ? "卫星" : kind === "land" ? "登陆" : "火箭";
          const rocketLabel = rocketActions.formatRocketLabel(token);
          return {
            ...token,
            imageSrc: token.tokenSrc || (
              !onReference
                ? color.rocketAsset
                : kind === "orbit"
                  ? color.satelliteAsset
                  : kind === "land" || kind === "satellite"
                    ? color.landdingAsset
                    : color.rocketAsset
            ),
            alt: referenceLabel
              ? `${referenceLabel} ${color.label}${tokenTypeLabel} ${rocketLabel}`
              : `${color.label}${tokenTypeLabel} ${rocketLabel}`,
            title: onReference
              ? referenceLabel
                ? `${referenceLabel} ${rocketLabel} ${formatPlanetsReferencePoint(referencePoint)}`
                : formatPlanetsReferencePoint(referencePoint)
              : referenceLabel
                ? `${referenceLabel} ${rocketLabel} ${formatPolarPoint(token)} ${formatBoardPoint(boardPoint)}`
                : `${formatPolarPoint(token)} ${formatBoardPoint(boardPoint)}`,
            uiColorId: color.id,
            glowColor: color.glowColor,
            leftPercent: onReference ? referencePoint.percentX : boardPoint.x / 10,
            topPercent: onReference ? referencePoint.percentY : boardPoint.y / 10,
            referenceLabel,
            tokenTypeLabel,
            rocketLabel,
            isReferencePlaced: onReference,
            isPlanetMarker: Boolean(token.referencePlacement?.isPlanetMarker),
            isChongFossil: token.kind === rocketActions.ROCKET_KIND?.CHONG_FOSSIL,
            isMoveTarget: token.id === uiRuntimeState.moveHighlightRocketId,
            isMoveCandidate: uiRuntimeState.moveHighlightRocketId != null
              && token.id === uiRuntimeState.moveHighlightRocketId,
            isMoveMuted: uiRuntimeState.moveHighlightRocketId != null
              && token.id !== uiRuntimeState.moveHighlightRocketId,
            isMoveSelectable: token.playerId === interfacePlayer?.id && token.movable,
            ownerTokenSrc: getNormalTokenAssetForPlayer(playerById.get(String(token.playerId)) || token),
          };
        }),
      },
      playerPanels: {
        currentPlayerId: turnFlow.currentPlayerId,
        interfacePlayerId: interfacePlayer?.id ?? null,
        players: sourcePlayers.map(createPlayerPanel),
      },
      turnPresentation: structuredClone(turnFlow),
      cardPanels: {
        publicCards: publicCards.map((card, index) => ({
          imageSrc: card?.src || null,
          label: card?.cardName || `公共牌 ${index + 1}`,
          empty: !card,
          selectable: selectionActive,
          selected: Boolean(publicMultiSelectActive && selectedPublicSlots.has(index)),
        })),
        handCards: hand.map(createHandCardView),
        publicControls: {
          selectionActive,
          multiSelectActive: publicMultiSelectActive,
          blindDrawEnabled: selectionActive && allowsBlindDraw && blindDrawAvailable,
          blindDrawReason: !selectionActive
            ? "请先进入精选"
            : !allowsBlindDraw
              ? "本次精选不能盲抽"
              : blindDrawAvailable ? "盲抽一张牌加入手牌" : "牌库已空",
        },
        handPanel: {
          count: handCount,
          overLimit: handCount > 4,
          hint: state.cards?.ui?.handPanelHint || "",
          empty: hand.length === 0,
          contextActionReady: Boolean(cardCornerAction || handCardPlayAction),
        },
        initialSelection: {
          ...residentPresentationBuilder.createInitialSelection(viewer, residentForPresentation),
          companyClassNames: (() => {
            const selected = interfacePlayer?.initialSelection?.industry;
            if (!selected) return [];
            const classNames = [];
            const hasTuringBorrowedTech = selected.label === "图灵系统"
              && Boolean(industry.getBorrowedTechTileId?.(
                interfacePlayer,
                turnFlow.roundNumber,
                turnFlow.turnNumber,
              ));
            if (selected.label === "未来跨度研究所") {
              classNames.push("has-company-below-card-markers");
              if (industry.hasFutureSpanCard?.(interfacePlayer)) {
                classNames.push("has-future-span-card-below");
              }
            } else if (industry.shouldShowAlienLabPanels?.(interfacePlayer) || hasTuringBorrowedTech) {
              classNames.push("has-company-below-card-markers");
            }
            return classNames;
          })(),
        },
        reservedCards: residentPresentationBuilder.createReservedCards(viewer, residentForPresentation),
      },
      dataPresentation: {
        ...playerDataPresentation,
        sectorTokensBySectorId: createSectorDataPresentation(),
        aomomoTokens: state.solarSystem?.aomomoActive
          ? data.listNebulaTokens(state.data || {}, "aomomo").map((token) => {
            const layout = data.getEffectiveAomomoBoardSlotLayout(
              token.slotIndex,
              token,
              state.solarSystem || {},
              solar,
            );
            return {
              key: `aomomo:${token.id}`,
              imageSrc: token.playerTokenSrc || data.DATA_TOKEN_SRC,
              alt: `奥陌陌 数据 ${token.index}`,
              title: `奥陌陌 序号${token.index} @槽位${token.slotIndex}`,
              percentX: layout.percentX,
              percentY: layout.percentY,
              widthPercent: (layout.scalePercent || 8.5) * 0.35,
            };
          }) : [],
      },
      markerPresentation: {
        anomalies: (state.aliens?.yichangdian?.anomalies || []).map((anomaly) => {
          const point = aliens.getYichangdianAnomalyMarkerBoardPoint?.(solar, anomaly)
            || solar.solarGridToGlobalPoint(anomaly.sectorX, anomaly.y || 4);
          return {
            key: `${anomaly.markerId}:${anomaly.sectorX}:${anomaly.y || 4}`,
            markerId: anomaly.markerId,
            sectorX: anomaly.sectorX,
            sectorY: anomaly.y || 4,
            imageSrc: anomaly.src || yichangdian.getAnomalyMarkerSrc(anomaly.markerId),
            alt: `异常 ${anomaly.markerId}`,
            title: `${yichangdian.formatAnomalyLabel(anomaly)} @ [${point.x.toFixed(2)},${point.y.toFixed(2)}]`,
            leftPercent: point.x / 10,
            topPercent: point.y / 10,
            boardX: point.x,
            boardY: point.y,
          };
        }),
        planetFossils,
        runezuSymbols,
      },
      techTilePresentation: {
        supplyTiles: (Array.isArray(state.tech?.board?.supplyTiles || state.tech?.board?.tiles)
          ? (state.tech?.board?.supplyTiles || state.tech?.board?.tiles)
          : Object.values(state.tech?.board?.supplyTiles || state.tech?.board?.tiles || {})
        ).map((tile) => ({
          id: tile?.id || tile,
          imageSrc: tile?.src || null,
          label: tile?.label || tile?.id || String(tile),
        })),
        playerTiles: sourcePlayers.flatMap((player) => (
          Object.entries(player?.techState?.ownedTiles || {}).filter(([, owned]) => Boolean(owned))
            .map(([tileId]) => ({ playerId: player.id, tileId }))
        )),
      },
      finalScorePresentation: {
        breakdownsByPlayerId: Object.fromEntries(finalReadModel.players.map((player) => [
          String(player.id),
          structuredClone(player.breakdown),
        ])),
      },
      readoutLines,
    };
  }

  const createResidentRenderInput = () => {
    const projection = readBrowserProjection();
    residentViewStateStore.reconcileProjection(projection);
    return { projection, viewState: residentViewStateStore.getSnapshot() };
  };
  const turnReadoutRuntime = turnFlowModule.createTurnReadoutRuntime({
    weakStartAiDifficulty: AI_DIFFICULTY_WEAK_START,
    finalRoundNumber: FINAL_ROUND_NUMBER,
    getTurnFlowProjection: () => getTurnFlowProjection(),
    assertTurnFlowProjection: browserHostModule.residentProjection.assertTurnFlowProjection,
    computePlayerFinalScoreBreakdown: (player) => getProjectedFinalScoreBreakdown(player),
    getFinalUiProjection: () => getFinalUiProjection(),
    createResidentRenderInput,
    renderResidentRoundStatus: (...args) => residentDesktopRenderer.renderRoundStatus(...args),
    getDisplayedTurnNumber,
    getRoundOrderPlayerIds,
    getPlayerLabelById,
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
  let residentDesktopRefreshScheduled = false;
  scheduleResidentDesktopRefresh = () => {
    if (residentDesktopRefreshScheduled) return;
    residentDesktopRefreshScheduled = true;
    queueMicrotask(() => {
      residentDesktopRefreshScheduled = false;
      renderResidentDesktop();
      updateActionButtons?.();
    });
  };
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
    getRocketState: () => ({ rockets: getBoardCoordinateProjection().tokens }),
    getHighlightedRocketId: () => uiRuntimeState.moveHighlightRocketId,
    isAiInputLocked: (...args) => isAiAutomationInputLocked(...args),
    blockManualInput: (...args) => blockManualAiAutomationInput(...args),
    isPlanetMarkerRocket,
    activateMoveMode,
    hasBlockingMoveDecision: () => Boolean(
      getPendingCardTriggerFreeMove()
      || browserPendingDecisionOwner.read("industry_free_move")
      || getPendingCardCornerFreeMove()
      || getPendingScanFreeMoveDecision()
      || getPendingCardMoveDecision()
    ),
    deactivateMoveMode,
    renderStateReadout: (...args) => renderStateReadout(...args),
  });
  const { handleRocketPointerDown, handleBoardPointerDown } = boardPointerHandlers;
  const coordinatePort = renderRuntimeModule.createCoordinatePort({
    runtime: coordinateRuntime,
    getBoardCoordinateProjection: () => getBoardCoordinateProjection(),
  });
  const {
    getMovableTokensForPlayer,
    getEarthSectorCoordinate,
  } = coordinatePort;
  const refreshPlanetPresentation = () => scheduleResidentDesktopRefresh();
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
    getActionLogProjection,
    isActionPending,
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
    resourceIconSrc: RESOURCE_ICON_SRC,
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
  } = playerStatsUi;
  const getInitialSelectionReadoutLines = startScreenModule.createInitialSelectionReadout({
    getState: () => {
      const setup = getInitialSetupProjection();
      return {
        phase: setup.active ? "selecting" : "complete",
        currentPlayerId: setup.currentPlayerId || null,
      };
    },
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
    getProjection: () => browserHostModule.residentProjection.selectRenderProjection(
      createResidentRenderInput()?.projection,
    ),
    assertProjection: browserHostModule.residentProjection.assertRenderProjection,
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
    attachCardHoverPreview,
    handleRocketPointerDown,
    syncInteractionFocusChrome: (...args) => syncInteractionFocusChrome(...args),
  });
  const {
    setTokenAssetSizes,
    renderRocketElement,
    renderChongFossilOwnerTokenForRocket,
    renderChongFossilOwnerTokens,
    renderRockets,
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
    focusService: residentFocusService,
    rocketActions,
    solar,
    uiRuntimeState,
    getActionInteractionProjection: () => getActionInteractionProjection(),
    getCurrentPlayer,
    readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
    getPendingCardTriggerFreeMove,
    getPendingCardCornerFreeMove,
    getPendingScanFreeMoveDecision,
    getPendingCardMoveDecision,
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
    isDiscardSelectionActive,
    isPlayCardSelectionActive,
    isMovePaymentSelectionActive: (...args) => isMovePaymentSelectionActive(...args),
    isHandScanSelectionActive: (...args) => isHandScanSelectionActive(...args),
    isCardSelectionActive,
    isTechTilePickingActive: (...args) => isTechTilePickingActive(...args),
    canUseCardCornerQuickAction: (...args) => canUseCardCornerQuickAction(...args),
    getPendingCardCornerQuickAction: (...args) => getPendingCardCornerQuickAction(...args),
    getPendingHandCardPlayAction: (...args) => getPendingHandCardPlayAction(...args),
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
    isPublicCardMultiSelectActive,
    getPublicCardSelectedCount: () => uiRuntimeState.publicCardSelectedSlots?.length || 0,
    getPublicCardMultiSelectMinSelectable,
    getCardSelectionType: () => readCardSelectionDecision()?.type || null,
    isCardSelectionActive,
    setQuickPanelOpen: (...args) => setQuickPanelOpen(...args),
    renderPublicCards: (...args) => renderPublicCards(...args),
    updatePublicCardControls: (...args) => updatePublicCardControls(...args),
    getInteractionFocusMode,
    hasPlayableFutureSpanCard: () => hasPlayableFutureSpanCard(getCurrentPlayer()),
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
    scrollToPlayerHandPanel: (...args) => scrollToPlayerHandPanel(...args),
    renderPlayerHand,
    renderInitialSelectionArea,
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
    resolvePlayerReference,
    getEffectOwnerPlayer,
    getActionEffectFlow,
    getCurrentActionEffect: (...args) => getCurrentActionEffect(...args),
    getPendingCardMoveDecision,
    isAiPlayer: (...args) => isAiAutoBattlePlayer(...args),
  });
  const {
    normalizeResourceCost,
    render: renderActionEffectBar,
  } = effectBarPresentation;
  const playerHandTitlePresenter = renderRuntimeModule.createPlayerHandTitlePresenter({
    isDiscardSelectionActive,
    getPendingDiscardDecision,
    isHandScanSelectionActive: (...args) => isHandScanSelectionActive(...args),
    isMovePaymentSelectionActive: (...args) => isMovePaymentSelectionActive(...args),
    isMovePaymentLockedForAiAutomation: (...args) => isMovePaymentLockedForAiAutomation(...args),
    getPendingMovePayment,
    moveEnergyCost: MOVE_ENERGY_COST,
    isPlayCardSelectionActive,
    getPendingPlayCardSelection: (...args) => getPendingPlayCardSelection(...args),
    getPendingCardCornerQuickAction: (...args) => getPendingCardCornerQuickAction(...args),
    getPendingHandCardPlayAction: (...args) => getPendingHandCardPlayAction(...args),
    getCardLabel: (...args) => cards.getCardLabel(...args),
    renderPlayerHand,
  });
  const { getPlayerHandPanelTitleHint, updatePlayerHandPanelTitle } = playerHandTitlePresenter;
  const finalUiRuntime = finalUiRuntimeModule.createFinalUiRuntime({
    document,
    els,
    players,
    finalScoring,
    uiRuntimeState,
    getFinalUiProjection,
    FINAL_SCORE_SLOT_POINTS,
    FINAL_ROUND_NUMBER,
    SCORE_SOURCE_KEYS,
    HISTORY_SOURCE_QUICK,
    getNormalTokenAssetForPlayer: (...args) => getNormalTokenAssetForPlayer(...args),
    getHistoryForSource: (...args) => getHistoryForSource?.(...args),
    createActionLogImpactSnapshot,
    appendActionLogStep: (...args) => appendActionLogStep?.(...args),
    actionLogOptionsFromHistoryStep: (...args) => actionLogOptionsFromHistoryStep?.(...args),
    rememberHistoryStep: (...args) => rememberHistoryStep?.(...args),
    historyCommands,
    queueStateReadoutRender: (...args) => queueStateReadoutRender?.(...args),
    updateActionButtons: (...args) => updateActionButtons(...args),
    renderPlayerStats,
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
    getActionLogProjection,
    getEntries: (...args) => getRecoverableActionLog(...args),
    getPlayerResults: (...args) => buildActionLogExportPlayerResults(...args),
    download: (...args) => residentBrowserServices.download(...args),
    setStatus: (...args) => setBrowserStatusNote(...args),
    renderStateReadout,
  });
  const {
    buildActionLogMarkdownContext,
    getActionLogMarkdown,
    downloadActionLogMarkdown,
  } = actionLogExportController;
  const refreshHelpers = refreshModule.createRefreshHelpers({
    renderPlayerStats,
    renderAlienPanels: (...args) => renderAlienPanels(...args),
    renderRockets,
    renderActionEffectBar,
    updateQuickPanel: (...args) => updateQuickPanel(...args),
    updateActionButtons: (...args) => updateActionButtons(...args),
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
    recordNeutralScoreTracesFromAbilityResult: (...args) => recordNeutralScoreTracesFromAbilityResult(...args),
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
    renderReservedCards,
    renderActionEffectBar,
    updateActionButtons: (...args) => updateActionButtons(...args),
    renderStateReadout,
    hasActiveCardTriggerResolution: (...args) => hasActiveCardTriggerResolution(...args),
    isCardTriggerRewardFlowBusy: (...args) => isCardTriggerRewardFlowBusy(...args),
    settleCardTasksAfterEffect: (workingRoot, ...args) => settleCardTasksAfterEffectForRoot(workingRoot, ...args),
    finishActionEffectFlow: (workingRoot) => finishActionEffectFlowForRoot(workingRoot),
    cancelActiveEffectSubFlows: (workingRoot) => cancelActiveEffectSubFlowsForRoot(workingRoot),
    maybeAutoExecuteAomomoRewardEffects,
    withEffectExecutionPlayer,
    executeActionEffectForOwner: (...args) => executeActionEffectForOwner(...args),
  });
  const actionBriefingHelpers = actionBriefingModule.createActionBriefingHelpers({
    document,
    els,
    actionBriefingState,
    startScreenState,
    getTurnState: () => getTurnFlowProjection(),
    HISTORY_SOURCE_MAIN,
    solar,
    getSolarState: () => getSolarBriefingProjection(),
    data,
    aomomo,
    getAomomoCurrentX: (...args) => getAomomoCurrentX(...args),
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
    focusService: residentFocusService,
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
    workingRoot,
  );
  const effectFlowRuntimePort = Object.freeze({
    ...effectFlowHelpers,
    actionLogOptionsFromHistoryStep,
    activateNextActionEffect,
    activateNextActionEffectIfIdle,
    appendActionLogStep,
    beginEffectHistoryStep,
    beginQuickActionStep,
    clearActionEffectFlow: (...args) => clearActionEffectFlow(...args),
    clearHistoryStepOrderForSource,
    completeCurrentActionEffect,
    completePendingActionStep,
    completeQuickActionStep,
    composeActionLogDetailWithImpact,
    createActionLogImpactSnapshot,
    createActionLogPlayedCardSnapshot,
    endEffectHistoryStep,
    ensureEffectHistorySession,
    executeActionEffect,
    finishActionEffectFlow: (...args) => finishActionEffectFlowForRoot(...args),
    forgetLastHistoryStep,
    getCurrentActionEffect,
    isActionEffectFlowActive: (...args) => isActionEffectFlowActive(...args),
    recordHistoryCommand,
    recordQuickHistoryCommand,
    recordQuickTradeCompletion,
    rememberHistoryStep,
    removeActionLogStepsBySource,
    removeLastActionLogStep,
    startActionLogDraft,
    startCardEffectFlow,
    startPlayCardEffectFlow,
  });
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
    claimRunezuSourceSymbolWithHistory: (...args) => claimRunezuSourceSymbolWithHistory(...args),
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
    effectFlowRuntime: effectFlowRuntimePort,
    scoreSourceRuntime,
    cardHelpers: cardRuntimeModule,
    getScanRuntime: () => scanFlowHelpers,
    getIncomeRuntime: () => incomeRuntime,
    getHandRuntime: () => handFlowHelpers,
    getCardRuntime: () => cardRuntime,
    getActionInteractionRuntime: () => actionInteractionRuntime,
    hostPort: {
      document, uiRuntimeState, els, SCORE_SOURCE_KEYS, normalizeResourceCost,
      openPendingDecision: openBrowserPendingDecision,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      restoreObjectSnapshot: (...args) => restoreObjectSnapshot(...args),
      formatPlanetRewardGain,
      getPlanetSectorCoordinate: (...args) => getPlanetSectorCoordinate(...args),
      restoreMutableObject: (...args) => restoreMutableObject(...args),
      getSectorContentForMove,
      isAsteroidContent,
      renderActionEffectBar,
      finishAutomaticRewardEffect,
      insertActionEffectsAfterCurrent,
    },
  });
  const handFlowHelpers = handFlowModule.createBrowserHandFlow({
    staticContext: handFlowModule.createBrowserHandStaticContext(
      dependencies,
      { ...appConstants, MOVE_ENERGY_COST },
    ),
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
    effectExecutorPort: effectExecutorRuntimePort,
    effectFlowRuntime: effectFlowRuntimePort,
    effectHistoryPort,
    interactionChrome,
    pendingSubFlowRuntime,
    playerLookupRuntime,
    renderRuntime,
    scoreSourceRuntime,
    hostPort: {
      uiRuntimeState,
      openPendingDecision: openBrowserPendingDecision,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      els,
      quickActionHistory,
      HISTORY_SOURCE_QUICK,
      SCORE_SOURCE_KEYS,
      getGameplayLockReason: (...args) => getGameplayLockReason(...args),
      canPayForMove,
      getRequiredMovePointsForUi: (...args) => getRequiredMovePointsForUi(...args),
      isMovePaymentCard,
      playerHasMovePaymentCard,
      restoreObjectSnapshot: (...args) => restoreObjectSnapshot(...args),
      updatePlayerHandPanelTitle,
      updateActionButtons: (...args) => updateActionButtons(...args),
      setQuickPanelOpen: (...args) => setQuickPanelOpen(...args),
      createActionContext: createActionContextForWorkingRoot,
      recordMainActionIrreversibleBarrier: (...args) => recordMainActionIrreversibleBarrier(...args),
      scrollToPlayerCommandPanel,
      listHumanActions: (family) => listHumanLegalActions(family),
      submitHumanAction,
      blockManualAiMovePayment: (...args) => blockManualAiMovePayment(...args),
      requestAnimationFrame,
      focusService: residentFocusService,
    },
  });
  const beginSupplementalMovePaymentForRoot = handFlowHelpers.beginSupplementalMovePayment;
  const syncDiscardSelectionChrome = (...args) => handFlowHelpers.syncDiscardSelectionChrome(...args);
  const isHandScanSelectionActive = () => Boolean(getPendingHandScanDecision());
  const syncHandScanSelectionChrome = (...args) => handFlowHelpers.syncHandScanSelectionChrome(...args);
  const isMovePaymentSelectionActive = () => Boolean(
    getPendingMovePayment(),
  );
  const getMovePaymentPlayer = (workingRoot = null) => {
    if (workingRoot) return handFlowHelpers.getMovePaymentPlayer(workingRoot);
    const pending = getPendingMovePayment();
    return pending?.playerId ? getPlayerById(pending.playerId) : pending?.player || getCurrentPlayer();
  };
  const isMovePaymentLockedForAiAutomation = () => Boolean(
    isPendingLockedForAiAutomation?.(getPendingMovePayment()),
  );
  const beginSupplementalMovePayment = (...args) => handFlowHelpers.beginSupplementalMovePayment(...args);
  const syncMovePaymentChrome = (...args) => handFlowHelpers.syncMovePaymentChrome(...args);
  const scrollToPlayerHandPanel = (...args) => handFlowHelpers.scrollToPlayerHandPanel(...args);
  const cancelMovePaymentSelection = () => abortActiveDecision("已取消移动支付");
  const beginMovePaymentSelection = (...args) => handFlowHelpers.beginMovePaymentSelection(...args);
  const handleHandCardMovePayment = (...args) => handFlowHelpers.handleHandCardMovePayment(...args);
  const resolveMovePaymentDecision = (...args) => handFlowHelpers.resolveMovePaymentDecision(...args);
  const syncPlayCardSelectionChrome = (...args) => handFlowHelpers.syncPlayCardSelectionChrome(...args);
  const getPendingPlayCardSelection = (workingRoot = null) => (
    workingRoot
      ? handFlowHelpers.getPendingPlayCardSelection(workingRoot)
      : structuredClone(uiRuntimeState.playCardSelection || null)
  );
  const handlePlayCardSelect = (...args) => handFlowHelpers.handlePlayCardSelect(...args);
  const confirmPlayCardSelection = (...args) => handFlowHelpers.confirmPlayCardSelection(...args);
  const getPendingHandCardPlayAction = (workingRoot = null) => (
    workingRoot
      ? handFlowHelpers.getPendingHandCardPlayAction(workingRoot)
      : structuredClone(uiRuntimeState.handCardPlayAction || null)
  );
  const cancelHandCardPlayAction = (...args) => handFlowHelpers.cancelHandCardPlayAction(...args);
  const confirmHandCardPlayAction = (...args) => handFlowHelpers.confirmHandCardPlayAction(...args);
  const getPendingCardCornerQuickAction = (workingRoot = null) => (
    workingRoot
      ? handFlowHelpers.getPendingCardCornerQuickAction(workingRoot)
      : structuredClone(uiRuntimeState.cardCornerQuickAction || null)
  );
  const syncCardCornerQuickActionChrome = (...args) => handFlowHelpers.syncCardCornerQuickActionChrome(...args);
  const cancelCardCornerQuickAction = (...args) => handFlowHelpers.cancelCardCornerQuickAction(...args);
  const handleHandCardCornerQuickAction = (...args) => handFlowHelpers.handleHandCardCornerQuickAction(...args);
  const beginDiscardSelection = (...args) => handFlowHelpers.beginDiscardSelection(...args);
  const completeDiscardSelection = (...args) => handFlowHelpers.completeDiscardSelection(...args);
  const handleHandCardDiscard = (...args) => handFlowHelpers.handleHandCardDiscard(...args);
  const beginPlayCardSelection = (...args) => handFlowHelpers.beginPlayCardSelection(...args);
  const cancelPlayCardSelection = (...args) => handFlowHelpers.cancelPlayCardSelection(...args);
  const handleFutureSpanCardPlay = (...args) => handFlowHelpers.handleFutureSpanCardPlay(...args);
  const handleFutureSpanPlayCardSelect = (...args) => handFlowHelpers.handleFutureSpanPlayCardSelect(...args);
  const effectSkipRuntime = effectFlowModule.createEffectSkipRuntime({
    industry,
    yichangdianCornerEffectType: cardEffects.EFFECT_TYPES.YICHANGDIAN_DRAW_THEN_TWO_CORNERS,
    getActionEffectFlow,
    getCurrentActionEffect,
    getPendingYichangdianCornerAction: (...args) => getPendingYichangdianCornerAction(...args),
    openYichangdianCornerPicker,
    finishCurrentCardMoveEffectEarly: (...args) => finishCurrentCardMoveEffectEarly(...args),
    getPendingScanTargetDecision,
    handleDrawnHandScanSkip: (...args) => scanFlowHelpers.handleDrawnHandScanSkip(...args),
    cancelActiveEffectSubFlowsForRoot: (...args) => cancelActiveEffectSubFlowsForRoot(...args),
    getEffectOwnerPlayer,
    getCurrentPlayer,
    renderInitialSelectionArea,
    beginEffectHistoryStep,
    endEffectHistoryStep,
    completeCurrentActionEffect,
    renderStateReadout,
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
    cardSelectionDecisionOwner,
    cardSelectionState,
    effectExecutorPort: effectExecutorRuntimePort,
    effectFlowRuntime: effectFlowRuntimePort,
    effectHistoryPort,
    effectSkipRuntime,
    handFlowRuntime: handFlowHelpers,
    interactionChrome,
    pendingSubFlowRuntime,
    playerEffectOwnerRuntime,
    renderRuntime,
    hostPort: {
      uiRuntimeState,
      openPendingDecision: openBrowserPendingDecision,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      getPendingYichangdianCornerAction: (...args) => getPendingYichangdianCornerAction(...args),
      document,
      structuredClone,
      els,
      SCAN_TARGET_ACTION_LAYOUT_CLASSES,
      updateActionButtons: (...args) => updateActionButtons(...args),
      syncPublicScanConfirmButton,
      actionHistory,
      getFlowMarkedNebulaIds,
      normalizeResourceCost,
      createActionContext: createActionContextForWorkingRoot,
      HISTORY_SOURCE_MAIN,
      getNormalTokenAssetForPlayer: (...args) => getNormalTokenAssetForPlayer(...args),
      getMovableTokensForWorkingRoot: (workingRoot, playerId) => (
        rocketActions.getMovableTokensForPlayer(workingRoot.rocketState, playerId)
      ),
      getRequiredMovePointsForWorkingRoot: (workingRoot, ...args) => (
        getRequiredMovePointsForUiForRoot(workingRoot, ...args)
      ),
    },
  });
  const {
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
  const getPublicScanMaxSelectable = (...args) => scanFlowHelpers.getPublicScanMaxSelectable(...args);
  const buildReadySectorFinishEffects = (...args) => scanFlowHelpers.buildReadySectorFinishEffects(...args);
  const buildScanFinalizeFollowupEffects = (...args) => scanFlowHelpers.buildScanFinalizeFollowupEffects(...args);
  const replaceNebulaDataForCurrentPlayer = (...args) => scanFlowHelpers.replaceNebulaDataForCurrentPlayer(...args);
  const getSectorFinishWinnerTarget = (...args) => scanFlowHelpers.getSectorFinishWinnerTarget(...args);
  const executeScanActionFinalizeEffect = (...args) => scanFlowHelpers.executeScanActionFinalizeEffect(...args);
  const executeSectorFinishScanEffect = (...args) => scanFlowHelpers.executeSectorFinishScanEffect(...args);
  const replenishDelayedPublicRefillSlots = (...args) => scanFlowHelpers.replenishDelayedPublicRefillSlots(...args);
  const executeScanPublicRefillEffect = (...args) => scanFlowHelpers.executeScanPublicRefillEffect(...args);
  const settleDelayedPublicRefillsAfterScanFlow = (...args) => scanFlowHelpers.settleDelayedPublicRefillsAfterScanFlow(...args);
  const buildEndOfFlowFollowupEffects = (...args) => scanFlowHelpers.buildEndOfFlowFollowupEffects(...args);
  const shouldAppendQueuedSectorFinishEffects = (...args) => scanFlowHelpers.shouldAppendQueuedSectorFinishEffects(...args);
  const appendEndOfFlowSectorFinishEffects = (...args) => scanFlowHelpers.appendEndOfFlowSectorFinishEffects(...args);
  const discardPublicScanCard = (...args) => scanFlowHelpers.discardPublicScanCard(...args);
  const discardHandScanCard = (...args) => scanFlowHelpers.discardHandScanCard(...args);
  const finalizeScanSourceCard = (...args) => scanFlowHelpers.finalizeScanSourceCard(...args);
  const restoreYichangdianCornerPickerIfPending = (...args) => scanFlowHelpers.restoreYichangdianCornerPickerIfPending(...args);
  const closeScanTargetPickerForRoot = scanFlowHelpers.closeScanTargetPicker;
  const closeScanTargetPicker = (...args) => scanFlowHelpers.closeScanTargetPicker(...args);
  const nebulaHasScannableData = (...args) => scanFlowHelpers.nebulaHasScannableData(...args);
  const buildNebulaScanChoice = (...args) => scanFlowHelpers.buildNebulaScanChoice(...args);
  const isAomomoActive = (...args) => scanFlowHelpers.isAomomoActive(...args);
  const getAomomoPlanetLocation = (workingRoot = null) => {
    if (workingRoot) return scanFlowHelpers.getAomomoPlanetLocation(workingRoot);
    return getBoardCoordinateProjection().planetLocations.find(
      (planet) => planet.planetId === aomomo?.PLANET_ID,
    ) || null;
  };
  const getAomomoCurrentX = (workingRoot = null) => {
    if (workingRoot) return scanFlowHelpers.getAomomoCurrentX(workingRoot);
    const location = getAomomoPlanetLocation();
    return location ? solar.mod8(location.x) : null;
  };
  const getNebulaCurrentX = (...args) => scanFlowHelpers.getNebulaCurrentX(...args);
  const getSectorScanTargetLabel = (...args) => scanFlowHelpers.getSectorScanTargetLabel(...args);
  const buildAomomoScanChoiceForX = (...args) => scanFlowHelpers.buildAomomoScanChoiceForX(...args);
  const hasAomomoScanAtX = (...args) => scanFlowHelpers.hasAomomoScanAtX(...args);
  const buildSectorScanChoicesForX = (...args) => scanFlowHelpers.buildSectorScanChoicesForX(...args);
  const expandScanChoicesWithAomomoTargets = (...args) => scanFlowHelpers.expandScanChoicesWithAomomoTargets(...args);
  const beginSectorScan = (...args) => scanFlowHelpers.beginSectorScan(...args);
  const getSectorOpenDataCount = (...args) => scanFlowHelpers.getSectorOpenDataCount(...args);
  const getSectorReplacedCount = (...args) => scanFlowHelpers.getSectorReplacedCount(...args);
  const getSectorExtraMarkCount = (...args) => scanFlowHelpers.getSectorExtraMarkCount(...args);
  const getPublicScanChoicesForCard = (rootOrCard, explicitCard = null) => {
    if (rootOrCard?.playerState && explicitCard) {
      return scanFlowHelpers.getPublicScanChoicesForCard(rootOrCard, explicitCard);
    }
    const card = explicitCard || rootOrCard;
    const scanCode = Number(card?.scanActionCode);
    const targets = appConstants.PUBLIC_SCAN_TARGETS_BY_CODE?.[scanCode];
    return targets ? {
      ok: true,
      scanCode,
      scanLabel: appConstants.PUBLIC_SCAN_CODE_LABELS?.[scanCode] || `扫描${scanCode}`,
      choices: [],
    } : {
      ok: false,
      message: `无法识别卡牌右上角扫描效果：${cards.getCardLabel(card) || "未知卡牌"}`,
    };
  };
  const hasHandScanTargetCard = (...args) => scanFlowHelpers.hasHandScanTargetCard(...args);
  const createPublicScanPendingAction = (...args) => scanFlowHelpers.createPublicScanPendingAction(...args);
  const beginPublicDeckScan = (...args) => scanFlowHelpers.beginPublicDeckScan(...args);
  const beginPublicScanForSingleCard = (...args) => scanFlowHelpers.beginPublicScanForSingleCard(...args);
  const confirmPublicScanSelection = (...args) => scanFlowHelpers.confirmPublicScanSelection(...args);
  const handlePublicScanCardClick = (...args) => scanFlowHelpers.handlePublicScanCardClick(...args);
  const beginHandScan = (...args) => scanFlowHelpers.beginHandScan(...args);
  const cancelHandScanSelection = () => abortActiveDecision("已取消手牌扫描");
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
    getCurrentPlayer,
    HISTORY_SOURCE_QUICK,
    startCardEffectFlow,
    renderActionEffectBar,
    updateActionButtons: (...args) => updateActionButtons(...args),
    beginDiscardSelection,
  });
  const {
    formatIncomeGain,
    getBlindDrawIrreversible,
    applyIncomeGainWithImmediateRewards,
    applyIncomeFromCard,
    buildIncomeResourceGain,
    formatIncomeResourceSummary,
    applyIncomeResourcesForPlayer,
    applyIndustryRoundStartBonuses: applyIndustryRoundStartBonusesForRoot,
    beginIncomeForCurrentPlayer: beginIncomeForCurrentPlayerForRoot,
  } = incomeRuntime;
  const {
    beginIncomeForCurrentPlayer,
    applyIndustryRoundStartBonuses,
  } = incomeRuntime;
  const confirmAlienTracePlacement = (...args) => alienRuntimeHelpers.confirmAlienTracePlacement(...args);
  const confirmFangzhouTracePlacement = (...args) => alienRuntimeHelpers.confirmFangzhouTracePlacement(...args);

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
    readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
    submitAlienRevealConfirmation: () => confirmAlienRevealNotice(),
    els,
    renderAlienPanels: (...args) => renderAlienPanels(...args),
    renderStateReadout,
    getAlienTraceActionPlayer: (workingRoot, ...args) => alienRuntimeHelpers.getAlienTraceActionPlayer?.(workingRoot, ...args),
    getAvailableDataTokenCount: (...args) => getAvailableDataTokenCount(...args),
    confirmFangzhouCard2Unlock: (workingRoot, ...args) => alienSpeciesRuntime.confirmFangzhouCard2Unlock(workingRoot, ...args),
    confirmAlienTracePlacement: (workingRoot, ...args) => alienRuntimeHelpers.confirmAlienTracePlacement(workingRoot, ...args),
    confirmFangzhouTracePlacement: (workingRoot, ...args) => alienRuntimeHelpers.confirmFangzhouTracePlacement(workingRoot, ...args),
    isDebugAlienTraceMode: (...args) => isDebugAlienTraceMode(...args),
    isActionEffectFlowActive: (...args) => isActionEffectFlowActive(...args),
    isCardSelectionActive,
    isDiscardSelectionActive,
    getPlayerColorDefinition: (playerColor) => players.getPlayerColorDefinition(playerColor),
  });
  const {
    buildAlienRevealNoticeEntry: buildAlienRevealNoticeEntryForRoot,
    openAlienRevealConfirmation,
    closeAlienRevealConfirmationOverlay,
    confirmAlienRevealNotice: confirmAlienRevealNoticeUi,
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
  const confirmAlienRevealNotice = confirmAlienRevealNoticeUi;
  const {
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
    getEligibleAlienSlotIdsForTraceEffect,
    getFangzhouUnlockableTraceTypes,
    hasAlienTracePanelPlacementTarget,
  } = alienUiHelpers;
  const alienRuntimeHelpers = alienRuntimeModule.createBrowserAlienRuntime({
    staticContext: alienRuntimeModule.createBrowserAlienStaticContext(dependencies),
    getAlienSpeciesRuntime: () => alienSpeciesRuntime,
    getCardRuntime: () => cardRuntime,
    getCardTriggerRuntime: () => cardTriggerRuntime,
    getIndustryRuntime: () => industryRuntime,
    getTurnEndRuntime: () => turnEndPort,
    alienUiRuntime: alienUiHelpers,
    browserContextRuntime,
    effectExecutorPort: effectExecutorRuntimePort,
    effectFlowRuntime: effectFlowRuntimePort,
    playerEffectOwnerRuntime,
    playerLookupRuntime,
    renderRuntime,
    scoreSourceRuntime,
    hostPort: {
      uiRuntimeState,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      structuredClone,
      HISTORY_SOURCE_MAIN,
      getEarthSectorCoordinate,
      updateActionButtons: (...args) => updateActionButtons(...args),
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
    confirmYichangdianTracePlacement,
    confirmBanrenmaTracePlacement,
    confirmAomomoTracePlacement,
    confirmChongTracePlacement,
    confirmAmibaTracePlacement,
    confirmRunezuTracePlacement,
    confirmJiuzheTracePlacement,
    settleTurnEndAlienRevealEntries,
    activateAomomoBoard,
  } = alienRuntimeHelpers;
  const getAlienTraceActionPlayer = (workingRoot = null) => {
    if (workingRoot) return alienRuntimeHelpers.getAlienTraceActionPlayer(workingRoot);
    const ownerId = readBrowserProjection().decision?.ownerId || null;
    return ownerId ? getPlayerById(ownerId) : null;
  };

  const recoveryHost = gameRecoveryModule.createRecoveryHost({
    uiRuntimeState,
    closeAlienRevealConfirmationOverlay,
    interactionChrome,
    closeFinalResultDialog,
    setTokenAssetSizes,
    renderWheels,
    renderSectors,
    renderRotateStateToken,
    refreshHelpers,
    renderPublicCards: (...args) => renderPublicCards(...args),
    updatePublicCardControls: (...args) => updatePublicCardControls(...args),
    renderReservedCards,
    renderInitialSelectionArea,
    renderPlayerHand,
    renderRoundStatus,
    renderDebugPlayerSwitch,
    syncCardSelectionChrome,
    syncDiscardSelectionChrome,
    syncPassReserveSelectionChrome: (...args) => syncPassReserveSelectionChrome(...args),
    syncHandScanSelectionChrome,
    syncPlayCardSelectionChrome,
    syncTechSelectionChrome: (...args) => syncTechSelectionChrome(...args),
    syncIndustryHandSelectionChrome,
    syncInteractionFocusChrome,
    setStatusNote: setBrowserStatusNote,
    renderActionLog,
  });
  const { clearTransientStateForRecovery, refreshAfterGameRecovery } = recoveryHost;
  const recoveryLogController = gameRecoveryModule.createRecoveryLogController({
    version: GAME_RECOVERY_VERSION,
    browserCheckpointPort,
    getRecoveryProjection,
    createAiControlSnapshot: (...args) => createAiControlSnapshot(...args),
    getStableSnapshot: () => browserActionStableRecoverySnapshot,
    getEntries: () => actionLogState.entries,
    renderActionLog,
    schedulePersistentGameStateSave: (...args) => persistenceController.schedulePersistentGameStateSave(...args),
    clearTransientStateForRecovery,
    restoreAiControlSnapshot: (...args) => restoreAiControlSnapshot(...args),
    refreshAfterGameRecovery,
    getRecoveryMessage: () => null,
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
    storageService: residentStorageService,
    timerService: residentTimerService,
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
      && !hasTurnEndRevealDecision()
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
    resize: (...args) => resize(...args),
    setLogOpen,
    startNewGame: (...args) => {
      const result = startNewGame(...args);
      queueMicrotask(() => {
        const pendingStart = ruleComposition.inputPort.enumerateActions({ family: "choose_card" })
          .some((action) => action.target?.kind === "start_initial_setup");
        if (pendingStart) startInitialSelection();
      });
      return result;
    },
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
  actionRuntimeController = actionRuntimeModule.createActionRuntime({
    startScreenState,
    actionLogState,
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
    syncPlanetOrbitLandMarkers: refreshPlanetPresentation,
    renderAlienPanels: (...args) => renderAlienPanels(...args),
    renderRockets,
    syncInteractionFocusChrome,
    updateActionButtons: (...args) => updateActionButtons(...args),
    renderStateReadout,
    schedulePersistentGameStateSave,
    renderActionLog,
    canStartMainAction,
    getMainActionStartBlockReason,
    getAnalyzeActionOptionsForPlayer,
    createActionLogImpactSnapshot,
    abilities,
    createActionContext: createActionContextForWorkingRoot,
    actions,
    removeRocketElement,
    syncPlanetOrbitLandMarkersAfterAction: refreshPlanetPresentation,
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
    beginPlayCardSelection,
    researchTechForCurrentPlayer: (...args) => researchTechForCurrentPlayer(...args),
    orbitForCurrentPlayer,
    landForCurrentPlayer,
    moveRocket,
    analyzeDataForCurrentPlayer,
    blockManualAiPendingInputIfNeeded,
    getCurrentActionEffectIndex: () => getActionEffectFlow()?.currentIndex,
    confirmDataPlacement,
    standardActionAdapter: productionActionRegistry,
  });

  const { controller: aiController } = aiBrowserBootstrapModule.createBrowserAiBootstrap({
    aiControlRuntimeModule,
    ruleComposition,
    outcomeModel: ai.outcomeModel,
    policyInputAdapterModule: browserHostModule.policyInputAdapter,
    projectionAdapter: residentProjectionAdapter,
    inputAdapter: residentInputAdapter,
    createPolicy: (seatId) => ai.heuristicPolicy.createHeuristicPolicy({
      difficulty: aiController?.getSeatDifficulty?.(seatId) || AI_DIFFICULTY_LAUGHABLE,
    }),
    projectionSource: browserProjectionSource,
    readAiControlProjection: readPlayerTurnState,
    stateOwners: {
      match: browserMatchRuntime,
      action: actionSessionRuntime,
      actionHistory,
      ui: uiRuntimeState,
      getAlien: () => alienSpeciesPort,
    },
    controlContext: {
      timerService: residentTimerService,
      DEFAULT_ACTIVE_PLAYER_COUNT,
      DEFAULT_INITIAL_PLAYER_COLOR,
      getCurrentActionEffect,
      getCurrentPlayer,
      getEffectOwnerPlayer,
      getPlayerByColor,
      getPlayerById,
      getPlayerLabelById,
      isGameEnded,
      isUiBlockingAiAutomation: isActionBriefingOpen,
      isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
      refreshCompositionPresentation: () => {
        scheduleResidentDesktopRefresh();
        residentTimerService.schedule(() => scheduleResidentDesktopRefresh(), 0);
      },
      renderStateReadout,
      resetGameForAiAutoBattle(options = {}) {
        const activePlayerCount = Math.min(
          Math.max(1, Math.round(Number(options.activePlayerCount) || DEFAULT_ACTIVE_PLAYER_COUNT)),
          players.PLAYER_COLOR_IDS.length,
        );
        const result = startNewGame({
          activePlayerCount,
          clearStorage: false,
          message: "AI 新局已重置",
        });
        return {
          ...result,
          activePlayerCount,
          playerIds: [...(readPlayerTurnState().turn?.activePlayerIds || [])],
        };
      },
      startInitialSelection,
      updateActionButtons: (...args) => updateActionButtons(...args),
    },
  });
  const {
    configureDefaultAiOpponent,
    createAiControlSnapshot,
    getPlayerAgentLabel,
    isAiAutomationPaused,
    isAiAutoBattlePlayer,
    restoreAiControlSnapshot,
    scheduleAiAutoStepIfNeeded,
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
    cardSelectionDecisionOwner,
    cardHoverPreviewRuntime,
    cardSelectionState,
    effectExecutorPort: effectExecutorRuntimePort,
    effectFlowRuntime: effectFlowRuntimePort,
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
      getGameplayLockReason: (...args) => getGameplayLockReason(...args),
      getRequiredMovePointsForUi: (...args) => getRequiredMovePointsForUi(...args),
      getRequiredMovePointsForWorkingRoot: (workingRoot, ...args) => (
        getRequiredMovePointsForUiForRoot(workingRoot, ...args)
      ),
      normalizeResourceCost,
      uiRuntimeState,
      openPendingDecision: openBrowserPendingDecision,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      quickActionHistory,
      renderActionEffectBar,
      structuredClone,
      updateActionButtons: (...args) => updateActionButtons(...args),
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
    resolveCardMoveDirectionDecision: resolveCardMoveDirectionDecisionForRoot,
    finishCurrentCardMoveEffectEarly: finishCurrentCardMoveEffectEarlyForRoot,
    executeFreeMoveForCardCorner: executeFreeMoveForCardCornerForRoot,
    recordPlayCardStart,
    releaseFutureSpanAfterPlayWithHistory: releaseFutureSpanAfterPlayWithHistoryForRoot,
    beginCardMoveEffect: beginCardMoveEffectForRoot,
  } = cardRuntime;
  const {
    beginCardCornerFreeMove,
    startCardCornerMoveEffectFlow,
    beginCardSelection,
    cancelCardSelection,
    finalizeCardSelectionResult,
    drawBasicCardToPlayer,
    blindDrawCardForPlayer,
    drawCardForCurrentPlayer,
    pickPublicCardForCurrentPlayer,
    updatePublicCardControls,
    ensurePublicCardsFilledRespectingDelayedRefills,
    handlePublicCardClick,
    handlePublicBlindDrawClick,
    renderPassReserveSelection,
    syncPassReserveSelectionChrome,
    beginPassReserveSelection,
    dismissPassReserveSelectionOverlay,
    selectPassReserveCard,
    handlePublicCornerDiscardCardClick,
    confirmPublicCornerDiscardSelection,
  } = cardRuntime;
  const {
    getDiscardCornerRewardMultiplier,
    getCardCornerQuickActionForCard,
    shouldQueueCardCornerMoveQuickAction,
    canUseCardCornerQuickAction: canUseCardCornerQuickActionRule,
    canStartCardCornerFreeMove,
    hasFutureSpanEligibleHandCard,
    hasPlayableFutureSpanCard,
    getStandardPlayCardActionBlockReason,
    getPlayCardSelectionBlockReason,
    getHandCardPlayActionForCard,
    getPassReserveSelectionCards,
  } = cardRuntime;
  const canUseCardCornerQuickAction = (workingRoot = null) => (
    workingRoot
      ? canUseCardCornerQuickActionRule(workingRoot)
      : Boolean(uiRuntimeState.cardCornerQuickAction)
  );
  const canBlindDraw = (workingRoot = null) => (
    workingRoot
      ? canBlindDrawForRoot(workingRoot)
      : readBrowserProjection().cards.deckCount > 0
  );
  const {
    selectDefaultRocketFromCandidates,
    executeCardEffectMove,
    finishCurrentCardMoveEffectEarly,
  } = cardRuntime;
  const { getMovableTokensForCardMoveEffect } = cardRuntime;
  cardTriggerRuntime = cardTriggerRuntimeModule.createBrowserCardTriggerRuntime({
    staticContext: cardTriggerRuntimeModule.createBrowserCardTriggerStaticContext(dependencies),
    getActionInteractionRuntime: () => actionInteractionRuntime,
    getAlienSpeciesRuntime: () => alienSpeciesRuntime,
    getIndustryRuntime: () => industryRuntime,
    actionSessionRuntime,
    cardRuntime,
    cardSelectionState,
    effectExecutorPort: effectExecutorRuntimePort,
    effectFlowRuntime: effectFlowRuntimePort,
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
      createActionContext: createActionContextForWorkingRoot,
      document,
      els,
      getEarthSectorCoordinate,
      getPlanetSectorCoordinate: (...args) => getPlanetSectorCoordinate(...args),
      getRequiredMovePointsForUi: (...args) => getRequiredMovePointsForUi(...args),
      getSectorContentForMove,
      isAsteroidContent,
      isInitialSelectionActive,
      uiRuntimeState,
      listReadyChongTransportCandidates: (...args) => listReadyChongTransportCandidatesForRoot(...args),
      markCurrentActionIrreversibleForSource,
      openPendingDecision: openBrowserPendingDecision,
      quickActionHistory,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      renderActionEffectBar,
      structuredClone,
      updateActionButtons: (...args) => updateActionButtons(...args),
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
  } = cardTriggerRuntime;

  const blockManualAiMovePayment = renderRuntimeModule.createMovePaymentAiGuard({
    getMovePaymentPlayer,
    blockManualInput: blockManualAiAutomationInput,
  });

  const getRequiredMovePointsForUi = (player, rocketId, _deltaX, _deltaY, options = {}) => {
    const board = getBoardCoordinateProjection();
    const rocket = board.tokens.find((item) => String(item?.id) === String(rocketId));
    const from = rocket?.sectorCoordinate || rocket?.slotSectorCoordinate || null;
    if (!from) return 1;
    const fromContent = board.visibleContents.find((item) => (
      Number(item?.x) === Number(from.x) && Number(item?.y) === Number(from.y)
    ))?.content || null;
    const turn = getTurnFlowProjection();
    if (!options.ignoreAsteroidRestriction
      && isAsteroidContent(fromContent)
      && !players.playerOwnsTech(player, "orange2", {
        roundNumber: turn.roundNumber,
        turnNumber: turn.turnNumber,
      })) {
      return 2;
    }
    return 1;
  };

  const getNormalTokenAssetForPlayer = (player) => (
    players.getPlayerColorDefinition(player?.color)?.normalTokenAsset
    || "../assets/tokens/normal_token.png"
  );

  const neutralScoreTraceRuntime = alienRuntimeModule.createNeutralScoreTraceRuntime({
    aliens,
    players,
    historyCommands,
    quickActionHistory,
    getActivePlayers,
    recordQuickHistoryCommand,
    recordHistoryCommand,
    renderAlienPanels: (...args) => renderAlienPanels(...args),
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

  const actionGuardRuntime = browserHostModule.actionBar.createActionGuardRuntime({
    getActionEffectFlow,
    isGameEnded,
    isInitialSelectionActive,
    els,
    setTurnActionButtonState: (...args) => setTurnActionButtonState(...args),
    setActionButtonState: (...args) => setActionButtonState(...args),
    setQuickActionButtonEnabled: (...args) => setQuickActionButtonEnabled(...args),
    updateQuickPanel: (...args) => updateQuickPanel(...args),
    renderActionEffectBar,
    getPendingCardCornerQuickAction,
    cancelCardCornerQuickAction,
    getPendingHandCardPlayAction,
    cancelHandCardPlayAction,
    hasActivePendingSubFlow,
    readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
    isIndustryHandSelectionActive: (...args) => industryRuntime.isIndustryHandSelectionActive(...args),
    renderStateReadout,
  });
  const {
    isActionEffectFlowActive,
    isInitialIncomeFlowActive,
    getGameplayLockReason,
    lockAllActionButtons,
    blockIncompatiblePendingQuickActionForRoot,
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
    syncPlanetOrbitLandMarkers: refreshPlanetPresentation,
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
    clearResearchTechSelectionState: (...args) => clearResearchTechSelectionState(...args),
    clearActionEffectFlow: (...args) => clearActionEffectFlow(...args),
    pruneEndOfFlowSettlementEffectsAfterUndo,
    cancelActiveEffectSubFlows: (...args) => cancelActiveEffectSubFlowsForRoot(...args),
    restoreResearchTechSelectionAfterUndo: (...args) => restoreResearchTechSelectionAfterUndo(...args),
    setActionEffectFlowActive: (active) => interactionChrome.setActionEffectFlowActive(active),
  });
  const revertEffectFlowAfterUndo = effectFlowUndoRuntime.revertEffectFlowAfterUndo;

  const boardQueryRuntime = actionInteractionRuntimeModule.createBoardQueryRuntime({
    rocketActions,
    getBoardCoordinateProjection: () => getBoardCoordinateProjection(),
  });
  const { getPlanetSectorCoordinate, getRocketCurrentPlanetIdForRoot, getRocketCurrentPlanetId } = boardQueryRuntime;
  const chongTransportRuntime = alienRuntimeModule.createChongTransportRuntime({
    chong,
    getRocketCurrentPlanetIdForRoot,
    getDecisionProjection: () => readBrowserProjection().decision,
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
    closeScanAction4Picker: (...args) => closeScanAction4Picker(...args),
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
    closeScanAction4Picker: (...args) => closeScanAction4Picker(...args),
    closeAlienTracePicker,
    isHandScanSelectionActive,
    syncHandScanSelectionChrome,
    isCardSelectionActive,
    getActionEffectFlow,
    isCardTriggerPickSelectionActive,
    readCardSelectionDecision,
    resolvePlayerReference,
    restoreObjectSnapshot,
    openCardSelectionDecision,
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
    renderTechBoard: (...args) => renderTechBoard(...args),
  });
  const cancelActiveEffectSubFlowsForRoot = effectSubFlowCancellationRuntime.cancelActiveEffectSubFlowsForRoot;

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
      syncTechSelectionChrome: (...args) => syncTechSelectionChrome(...args),
      renderTechBoard: (...args) => renderTechBoard(...args),
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
    updateActionButtons: (...args) => updateActionButtons(...args),
    renderStateReadout,
    getPlayerById,
    getCurrentPlayerForRoot: (workingRoot) => players.getCurrentPlayer(workingRoot.playerState),
    createPassEvent,
    renderAlienPanels: (...args) => renderAlienPanels(...args),
    maybeResumeTurnEndAfterReveal,
  });
  const finishActionEffectFlowForRoot = effectFlowCompletionRuntime.finishActionEffectFlowForRoot;

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
    getMovableTokensForPlayer: (workingRoot, playerId) => (
      getMovableTokensForPlayerForRoot(workingRoot, playerId)
    ),
    openPendingDecision: openBrowserPendingDecision,
  });
  const closeScanAction4Picker = scanAction4Picker.close;
  const openScanAction4Picker = scanAction4Picker.open;


  const createEffectExecutorContexts = () => ({
    movementScan: {
      INCOME_GAIN_LABELS, SCORE_SOURCE_KEYS, abilities, addPlutoMarker, aomomo,
      attachScoreSourceToEffects, beginEffectHistoryStep,
      beginScanAction4FreeMove: beginScanAction4FreeMoveForRoot,
      buildPlanetRewardEffectsWithIndustry, buildPlutoMarkerRemovalChoices,
      buildProbeLocationIndex,
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
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      recordHistoryCommand, removePlutoMarker, removeRocketElement, renderActionEffectBar,
      renderAlienPanels, renderPlayerHand, renderPlayerStats, renderPublicCards,
      renderReservedCards,
      renderRockets, renderStateReadout, replaceNebulaDataForCurrentPlayer, restoreMutableObject,
      rocketActions, skipActionEffectWithMessage, solar,
      syncPlanetOrbitLandMarkers: refreshPlanetPresentation,
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
      openPendingDecision: openBrowserPendingDecision,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      openScanTargetPicker, planetReferenceLayout, planetStats, players, recordAbilityCommands,
      recordHistoryCommand, recordScoreSourceForGainEffect, renderActionEffectBar,
      renderPlayerHand, renderPlayerStats, renderPublicCards,
      renderReservedCards,
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
      renderReservedCards,
      renderRockets, renderStateReadout, replaceNebulaDataForCurrentPlayer, rocketActions,
      solar, syncPlanetOrbitLandMarkers: refreshPlanetPresentation,
      updateActionButtons, withEffectExecutionPlayer,
      yichangdian,
    },
    dispatcher: {
      BANRENMA_PANEL_BONUS_EFFECT_TYPE, JIUZHE_THRESHOLD_CARD_EFFECT_TYPE, abilities,
      alienTraceRewardFlow, aliens, amiba, aomomo, applyIncomeGainWithImmediateRewards,
      banrenma,
      beginAlienTraceBoardPlacement: (workingRoot, ...args) => beginAlienTraceBoardPlacementForRoot(workingRoot, ...args),
      beginCardMoveEffect: beginCardMoveEffectForRoot,
      beginCardSelection: (workingRoot, ...args) => beginCardSelectionForRoot(workingRoot, ...args),
      beginDiscardSelection: (workingRoot, ...args) => handFlowHelpers.beginDiscardSelection(workingRoot, ...args),
      beginEffectHistoryStep, beginPassReserveSelection, buildNebulaScanChoice, cardEffects, chong,
    claimRunezuSourceSymbolWithHistory: (...args) => claimRunezuSourceSymbolWithHistory(...args),
      closeAlienTracePicker: (workingRoot) => closeAlienTracePickerForRoot(workingRoot),
      completeCurrentActionEffect, createActionContext: createActionContextForWorkingRoot,
      createPublicScanPendingAction, endEffectHistoryStep, executeBanrenmaPanelBonusEffect,
      executeIndustryHeliosPassiveRewardEffect: (...args) => executeIndustryHeliosPassiveRewardEffect(...args),
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
      openPendingDecision: openBrowserPendingDecision,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      openAmibaSymbolChoiceDialog, openAmibaTraceRemovalDialog, openAomomoCardGainDialog,
      openFangzhouTraceDestinationChoice: (workingRoot, ...args) => openFangzhouTraceDestinationChoiceForRoot(workingRoot, ...args),
      openRunezuSymbolBranchDialog, openScanAction4Picker, openScanTargetPicker, planetRewards,
      recordAbilityCommands, recordHistoryCommand, recordTechBonusScore, renderDebugPlayerSwitch,
      renderPlayerHand, renderPlayerStats, renderRockets, renderRotateStateToken,
      renderRunezuBoardSymbols, renderSectorNebulaDataBoard, renderStateReadout, renderWheels,
      resolvePlayerReference, runezu, scanEffects,
      shouldSkipCurrentResearchTechCost: (workingRoot) => techRuntime.shouldSkipCurrentResearchTechCost(workingRoot),
      skipActionEffectWithMessage, syncHandScanSelectionChrome, tech, uiRuntimeState,
      updateActionButtons: (...args) => updateActionButtons(...args),
    },
  });
  let effectExecutors = null;

  const actionRuntimePort = actionRuntimeModule.createActionRuntimePort({
    getController: () => actionRuntimeController,
    listHumanActions: (family) => listHumanLegalActions(family),
    submitHumanAction,
  });
  const { beginScanAction } = actionRuntimePort;

  const browserLayoutRuntime = renderRuntimeModule.createBrowserLayoutRuntime({
    window,
    document,
    els,
    techRenderContext,
    boardVisualScale: BOARD_VISUAL_SCALE,
    layoutPlayerHandFan,
    layoutReservedCardRows,
    alignAlienPanelsToPlanets: (...args) => alignAlienPanelsToPlanets(...args),
    renderAlienPanels: (...args) => renderAlienPanels(...args),
    renderTechBoard: (...args) => renderTechBoard(...args),
    getMoveHighlightRocketId: () => uiRuntimeState.moveHighlightRocketId,
    scheduleRenderMoveArrows,
  });
  const { resize, syncTechRenderContext } = browserLayoutRuntime;

  let alienSpeciesRuntime = null;
  const {
    getPendingYichangdianCornerAction,
    getPendingYichangdianCornerCards,
  } = effectFlowModule.createEffectExecutorQueryPort({ getExecutors: () => effectExecutors });
  const alienSpeciesPort = alienSpeciesRuntimeModule.createAlienSpeciesPort({
    getRuntime: () => alienSpeciesRuntime,
  });
  const {
    getPendingChongFossilChoice, getPendingAmibaSymbolChoice, getPendingRunezuSymbolBranch, getPendingRunezuFaceSymbolPlacement,
    getPendingRunezuCardGain, getPendingAmibaCardGain, getPendingAomomoCardGain, getPendingYichangdianCardGain,
    getPendingBanrenmaCardGain, getPendingChongCardGain, getPendingAmibaTraceRemoval, getPendingJiuzheCardPlay,
    getPendingBanrenmaOpportunity, getAlienTraceLayer, getAlienJiuzheTraceLayer, getAlienYichangdianCardArea,
    getAlienBanrenmaCardArea, getAlienChongCardArea, getAlienAmibaCardArea, getAlienAomomoCardArea,
    getAlienRunezuCardArea, getAlienJiuzheThresholdElement, getAlienBanrenmaScoremarkElement, getAlienBackImage,
    createJiuzheThresholdNode, renderJiuzheThresholds, maybeRevealAlienAfterTrace, isDebugAlienTraceMode,
    renderYichangdianCardDisplays,
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
    beginCardSelection,
  }).triggerForEarthX;

  const FINAL_RESULT_PLAYER_COLOR_ORDER = Object.freeze(["white", "brown", "blue", "green"]);

  finalReadModelOwner = finalReadModelModule.createFinalReadModelOwner({
    endGameScoring,
    finalScoring,
    buildProbeLocationIndex: (pieces, solarState) => (
      cardTriggerRuntime?.buildProbeLocationIndexFromPieces(pieces, solarState)
    ),
    collectPlutoMarkers: (playerState) => (
      actionInteractionRuntime?.collectPlutoMarkersFromPlayerProjection(playerState) || []
    ),
    cardEffects,
    getCardTypeCode,
    getPlayerCompanyBaseIncome: (player) => players.normalizeIncome(
      initialCards.getIndustryEffect?.(player?.initialSelection?.industry)?.baseIncome || null,
    ),
  });
  browserReadModelOwner = browserReadModelModule.createBrowserReadModelOwner({
    solar,
    aliens,
    tech,
  });
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
    cardSelectionDecisionOwner,
    cardHoverPreviewRuntime,
    cardRuntime,
    cardSelectionState,
    effectExecutorPort: effectExecutorRuntimePort,
    effectFlowRuntime: effectFlowRuntimePort,
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
      listHumanActions: (family) => listHumanLegalActions(family),
      submitHumanAction,
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
      openPendingDecision: openBrowserPendingDecision,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      quickActionHistory,
      renderActionEffectBar,
      resultHasSignalMarkedEvent,
      uiRuntimeState,
      updateActionButtons: (...args) => updateActionButtons(...args),
    },
  });
  const industryCommands = industryRuntime;
  const {
    createIndustryActionRestoreCommand, recordIndustryActionRestoreCommand, clearIndustryRollbackUi,
    rollbackPendingIndustryQuickAction, cancelIndustryAbilityFlow, finishIndustryAbilityFlow,
    startIndustryAbilityFlow, startIndustryStratusEffectFlow,
    startIndustryPublicityPick, beginIndustryTuringBorrow, failIndustryTuringBorrow,
    checkIndustryTuringBorrowTile, confirmIndustryTuringBorrow, openIndustryHeliosTechPicker,
    confirmIndustryHeliosRemoveTech, startIndustryHuanyuMoveEffectFlow, beginIndustryHuanyuFreeMoves,
    beginIndustryFutureSpanHandSelection,
    handleIndustryFutureSpanHandClick, handleIndustryDeepspaceHandClick, finalizeIndustryDeepspaceSwap,
    handleAlienLabPanelClick, maybeConsumeAlienLabPanelForMainAction, maybeApplyIndustryLaunchScan,
    startLaunchSectorFinishEffectFlow, appendIndustryPlayPassiveStatus,
    applyIndustryPlayCardPassives, completeIndustryAbilityQuickStep,
    commitIrreversibleIndustryQuickAction, tryInjectSentinelPlayCornerEffectAfterArm,
    executeIndustryStratusCornerEffect, executeIndustrySentinelCornerEffect,
    executeIndustryHeliosPassiveRewardEffect,
    cancelStrategyPassiveSlotChoice, openStrategyPassiveSlotChoice, confirmStrategyPassiveSlotChoice,
    finishIndustryStrategyPassiveRewardEffect, executeIndustryStrategyPassiveRewardEffect,
    handleStrategyPassiveSlotClick, handleCompanyActionMarkerClick,
  } = industryCommands;
  const {
    canBeginIndustryFutureSpanHandSelection,
    buildIndustryPlayCardAppendEffects,
    buildPlayCardEffectFlowQueue,
    createCompanyCardSummary,
    getStrategyPassiveSelectableSlotIds,
  } = industryRuntime;

  const techRuntime = techRuntimeModule.createBrowserTechRuntime({
    staticContext: techRuntimeModule.createBrowserTechStaticContext(dependencies),
    getActionInteractionRuntime: () => actionInteractionRuntime,
    getActionBarPort: () => actionBarPort,
    actionSessionRuntime,
    browserLayoutRuntime,
    cardRuntime,
    coordinatePort,
    effectExecutorPort: effectExecutorRuntimePort,
    effectFlowRuntime: effectFlowRuntimePort,
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
      listHumanActions: (family) => listHumanLegalActions(family),
      submitHumanAction,
      document,
      els,
      getPlanetSectorCoordinate,
      normalizeResourceCost,
      renderActionEffectBar,
      techRenderContext,
      uiRuntimeState,
    },
  });
  const {
    isTechAwaitingConfirm,
    isGeneratedResearchTechFollowupEffect,
    countOwnedTechByTypeAfterSelection,
    researchTechForCurrentPlayer,
    commitSelectedResearchTech
  } = techRuntime;
  const getResearchTechSelectionEffect = () => techRuntime.getResearchTechSelectionEffect();
  const getResearchTechSelectionPayload = () => techRuntime.getResearchTechSelectionPayload();
  const getResearchTechSelectionOptions = () => techRuntime.getResearchTechSelectionOptions();
  const shouldSkipCurrentResearchTechCost = () => techRuntime.shouldSkipCurrentResearchTechCost();
  const {
    syncTechSelectionChrome: syncTechSelectionChromeForRoot,
    renderTechBoard: renderTechBoardForRoot,
    closeTechBlueSlotPicker, appendResearchTechFollowupEffects,
    onTechTileSelected, onTechTileTaken, clearResearchTechSelectionState, restoreResearchTechSelectionAfterUndo,
    cancelPendingResearchTechTileChoice, cancelTechSelection, openTechBlueSlotPicker, finalizeTechTakeResult,
    commitResearchTechSelectionResult, selectResearchTechTileForCurrentFlow, confirmTechBlueSlotChoice,
    handleSupplyTechTileClick,
  } = techRuntime;
  const syncTechSelectionChrome = () => scheduleResidentDesktopRefresh();
  const renderTechBoard = () => scheduleResidentDesktopRefresh();
  const {
    isTechActionSelectionActive: isTechActionSelectionActiveForRoot,
    isTechTilePickingActive: isTechTilePickingActiveForRoot,
    isTechTileOwnedByOtherPlayer: isTechTileOwnedByOtherPlayerForRoot,
  } = techRuntime;
  const hasProjectedTechDecision = () => {
    const decision = readBrowserProjection().decision;
    return Boolean(decision?.choices?.some((choice) => choice.presentation?.tileId));
  };
  const isTechActionSelectionActive = (workingRoot = null) => (
    workingRoot ? isTechActionSelectionActiveForRoot(workingRoot) : hasProjectedTechDecision()
  );
  const isTechTilePickingActive = (workingRoot = null) => (
    workingRoot ? isTechTilePickingActiveForRoot(workingRoot) : hasProjectedTechDecision()
  );
  const isTechTileOwnedByOtherPlayer = (workingRoot, ...args) => (
    isTechTileOwnedByOtherPlayerForRoot(workingRoot, ...args)
  );

  const queueStateReadoutRender = renderRuntimeModule.createFrameRenderScheduler({
    state: uiRuntimeState,
    requestAnimationFrame,
    render: renderStateReadout,
  }).queue;

  let actionBarController = null;
  const actionBarPort = browserHostModule.actionBar.createActionBarPort({
    getController: () => actionBarController,
  });
  const {
    setActionButtonState, setTurnActionButtonState, setQuickActionButtonEnabled, updateActionButtons,
    isQuickPanelOpen, setQuickPanelOpen, toggleQuickPanel, updateQuickPanel,
    activateAction: activateActionBarAction,
  } = actionBarPort;

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
    effectFlowRuntime: effectFlowRuntimePort,
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
      listHumanActions: (family) => listHumanLegalActions(family),
      submitHumanAction,
      deferPendingDecision: deferBrowserPendingDecision,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      clearActionEffectFlow,
      isActionEffectFlowActive,
      refreshLatestActionLogRecoverySnapshot,
      renderTechBoard,
      rotateSolarOrbit: rotateSolarOrbitForRoot,
      scheduleAiAutoStepIfNeeded,
      updateActionButtons,
    },
  });

  const undoPendingAction = () => {
    const inspection = ruleComposition.inspect();
    return ruleComposition.inputPort.undo({
      sessionId: inspection.session?.sessionId || inspection.sessionId,
      revision: inspection.session?.revision ?? inspection.revision,
    });
  };
  const dataPlacementDecisionRuntime = actionInteractionRuntimeModule.createDataPlacementDecisionRuntime({
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
    dataPlacementPort: dataPlacementDecisionRuntime,
    effectFlowRuntime: effectFlowRuntimePort,
    effectHistoryPort,
    handFlowRuntime: handFlowHelpers,
    interactionChrome,
    playerEffectOwnerRuntime,
    renderRuntime,
    scoreSourceRuntime,
    actionPort: {
      beginCardSelection,
      createActionContext: createActionContextForWorkingRoot,
      validateIndustryHuanyuMoveRocket,
    },
    openPendingDecision: openBrowserPendingDecision,
    readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
    readCardSelectionDecision,
    cardTriggerPort: {
      hasActiveCardTriggerResolution,
      settleCardTasksAfterEffect: (...args) => settleCardTasksAfterEffectForRoot(...args),
    },
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

  const getDesktopActionBarProjection = () => {
    const browserProjection = residentProjectionAdapter.projectSource({
      viewer: getResidentViewer(),
    });
    const currentPlayerId = browserProjection.match.currentPlayerId;
    return browserHostModule.actionBar.selectActionBarProjection(browserProjection, {
      inspection: ruleComposition.inspect(),
      machineControlled: isAiAutoBattlePlayer(currentPlayerId),
      automationPaused: isAiAutomationPaused(),
    });
  };
  actionBarController = browserHostModule.actionBar.createBrowserDesktopActionBarController({
    projectionPort: {
      getProjection: getDesktopActionBarProjection,
    },
    inputPort: {
      dispatchIntent: (intent) => intent?.kind === "action"
        ? submitHumanAction(intent.action)
        : residentInputAdapter.dispatchIntent(intent),
    },
    hostPort: {
      els,
      syncFinalResultButton,
    },
  });
  debugRuntimeController = debugRuntimeModule.createBrowserDebugRuntime({
    viewStateStore: residentViewStateStore,
    projectionPort: {
      getInterfacePlayer,
      getActivePlayers,
      getPlayerAgentLabel: (...args) => aiController.getPlayerAgentLabel(...args),
      getPlayerColorDefinition: (...args) => players.getPlayerColorDefinition(...args),
      getAlienJiuzheTraceLayer: (...args) => alienSpeciesPort.getAlienJiuzheTraceLayer(...args),
      getAomomoCalibrationLines: () => [],
    },
    browserPort: { document, resize, focusService: residentFocusService },
    renderPort: {
      els,
      renderSectorNebulaDataBoard,
    },
  });

  const closeHumanActionPicker = () => {
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
    els.scanTargetActions?.replaceChildren();
  };
  const openRunezuFaceSymbolActionPicker = (alienSlotId, position) => {
    const actions = listHumanLegalActions("runezu_face_symbol").filter((action) => (
      Number(action.target?.alienSlotId) === Number(alienSlotId)
      && Number(action.target?.position) === Number(position)
    ));
    if (actions.length === 1) return submitHumanAction(actions[0]);
    if (!actions.length) {
      return { ok: false, code: "HUMAN_RUNEZU_ACTION_NOT_LEGAL", message: "该符文族位置已失效" };
    }
    if (!els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, code: "HUMAN_ACTION_PICKER_UNAVAILABLE", message: "人类 Action picker 未装配" };
    }
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "选择要放置的符文族面部符号";
    els.scanTargetActions.replaceChildren(...actions.map((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-action";
      button.dataset.humanActionId = action.actionId;
      button.textContent = action.summary || action.target?.symbolId || "放置符号";
      return button;
    }));
    els.scanTargetOverlay.hidden = false;
    return { ok: true, awaitingActionChoice: true };
  };

  const appEventState = window.SetiAppEvents.createAppEventState({
    pending: {
      ...browserMatchRuntime,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      getPendingCardTriggerFreeMove,
      getPendingCardCornerFreeMove,
    },
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
    effectExecutorPort: {
      ...effectExecutorRuntimePort,
      skipActionEffectWithMessage,
    },
    effectFlowRuntime: effectFlowRuntimePort,
    historyPort: { actionHistory, quickActionHistory },
    industryRuntime,
    manualAiInputGuard,
    pendingSubFlowRuntime,
    playerEffectOwnerRuntime,
    renderRuntime,
    scoreSourceRuntime,
    turnEndRuntime: turnEndPort,
    hostPort: {
      readProjection: () => getAlienBoardProjection(),
      openPendingDecision: openBrowserPendingDecision,
      readPendingDecision: (kind) => browserPendingDecisionOwner.read(kind),
      startScreenState,
      uiRuntimeState,
    },
    renderPort: {
      banrenmaBonusMarkerElements,
      document,
      els,
      renderActionEffectBar,
      renderRunezuBoardSymbols,
      setScanTargetActionLayout,
      updateActionButtons,
      window,
      yichangdianAnomalyMarkerElements,
    },
    rulePort: {
      buildAlienTraceEvent: (...args) => buildAlienTraceEventForRoot(...args),
      formatPlanetRewardGain,
      getPlayerCompanyBaseIncome,
    },
    speciesRules: dependencies.alienSpeciesRules,
    constants: {
      BANRENMA_PANEL_BONUS_EFFECT_TYPE,
      HISTORY_SOURCE_QUICK,
      JIUZHE_THRESHOLD_CARD_EFFECT_TYPE,
      RESOURCE_ICON_SRC,
    },
  });

  effectExecutors = effectExecutorBootstrapModule.createEffectExecutorSuite({
    contexts: createEffectExecutorContexts(),
    movementScanModule: effectMovementScanExecutorsModule,
    rewardModule: effectRewardExecutorsModule,
    alienModule: effectAlienExecutorsModule,
    dispatcherModule: effectDispatcherModule,
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
    getEventsProjection: () => getEventsProjection(),
    assertEventsProjection: browserHostModule.residentProjection.assertEventsProjection,
    setStatusNote: setBrowserStatusNote,
    startNewGameFromStartScreen,
    continueGameFromStartScreen,
    syncStartScreenDebugOption,
    syncStartScreenActionLogOption,
    handleStartAlienOptionChange,
    handleStartIndustryOptionChange,
    orbitForCurrentPlayer,
    landForCurrentPlayer,
    beginPlayCardSelection,
    researchTechForCurrentPlayer,
    cancelTechSelection,
    toggleQuickPanel,
    activateActionBarAction,
    undoPendingAction,
    runPlaceDataToComputer,
    closeScanTargetPicker,
    submitHumanActionId: (actionId) => humanActionInputAdapter.submitActionId(actionId),
    closeHumanActionPicker,
    moveRocket,
    handleBoardPointerDown,
    openFinalResultDialog,
    downloadActionLogMarkdown,
    minimizeFinalResultDialog,
    closeFinalResultDialog,
    closeActionBriefing,
    openActionBriefingDetailLog,
    blockManualAiSharedOverlayInputIfNeeded,
    setDebugOpen,
    setDebugPlayerMenuOpen,
    toggleSectorWinDebug,
    openFangzhouCard1Dialog,
    handlePublicBlindDrawClick,
    handlePublicCardClick,
    selectPassReserveCard,
    dismissPassReserveSelectionOverlay,
    cancelCardSelection,
    confirmPublicScanSelection,
    confirmPlayCardSelection: () => {
      const cardId = getPendingPlayCardSelection()?.card?.id;
      const actions = listHumanLegalActions("play_card")
        .filter((action) => String(action.target?.cardInstanceId) === String(cardId));
      return actions.length === 1
        ? submitHumanAction(actions[0])
        : { ok: false, code: "HUMAN_PLAY_CARD_NOT_LEGAL", message: "所选手牌已不在当前 legal set 中" };
    },
    cancelPlayCardSelection,
    confirmHandCardPlayAction: () => {
      const cardId = getPendingHandCardPlayAction()?.card?.id;
      const actions = listHumanLegalActions("play_card")
        .filter((action) => String(action.target?.cardInstanceId) === String(cardId));
      return actions.length === 1
        ? submitHumanAction(actions[0])
        : { ok: false, code: "HUMAN_PLAY_CARD_NOT_LEGAL", message: "所选手牌已不在当前 legal set 中" };
    },
    confirmCardCornerQuickAction: () => {
      const cardId = getPendingCardCornerQuickAction()?.card?.id;
      const actions = listHumanLegalActions("card_corner")
        .filter((action) => String(action.target?.cardInstanceId) === String(cardId));
      return actions.length === 1
        ? submitHumanAction(actions[0])
        : { ok: false, code: "HUMAN_CARD_CORNER_NOT_LEGAL", message: "所选弃牌角标已不在当前 legal set 中" };
    },
    getCurrentPlayer,
    getInterfacePlayer,
    isAiAutomationInputLocked,
    blockManualAiAutomationInput,
    openJiuzheCardDialog,
    openBanrenmaCardConditionCompletionPicker,
    getReadyChongTaskForReservedCard,
    openChongTraceTaskCompletionPicker,
    openCardTaskCompletionPicker,
    isPlayCardSelectionActive,
    handlePlayCardSelect,
    handleHandCardCornerQuickAction,
    renderStateReadout,
    syncTechRenderContext,
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
      startScreenRuntime: {
        syncStartScreenDebugOption,
        syncStartScreenActionLogOption,
        syncStartScreenAlienOptions,
        syncStartScreenIndustryOptions,
        setDebugToolsEnabled,
      },
    }),
    startScreenState,
    savePersistentGameStateNow,
    publicApiContext: {
      structuredClone,
      inspectProjection: () => {
        const projection = readBrowserProjection();
        queueMicrotask(() => scheduleResidentDesktopRefresh());
        return projection;
      },
      inspectInput: () => residentInputAdapter.inspectInputState(),
      capture: () => browserCheckpointPort.capture(),
      restore: (envelope) => browserCheckpointPort.restore(envelope),
      dispatchAction: (action) => submitHumanAction(action),
      submitDecision: (submission) => humanDecisionInputAdapter.submit(submission),
    },
  });

})();

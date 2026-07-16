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
    actionLogRuntimeModule,
    gameRecoveryModule,
    runtimeModule,
    refreshModule,
    renderRuntimeModule,
    debugRuntimeModule,
    finalUiRuntimeModule,
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
    scanFlowModule,
    incomeRuntimeModule,
    cardRuntimeModule,
    cardTriggerRuntimeModule,
    alienRuntimeModule,
    alienUiModule,
  } = dependencies;

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
  if (!actionRuntimeModule) {
    throw new Error("Missing SETI app dependency: SetiAppActionRuntime");
  }
  if (!effectFlowModule) {
    throw new Error("Missing SETI app dependency: SetiAppEffectFlow");
  }
  if (!effectChoiceFlowModule) {
    throw new Error("Missing SETI app dependency: SetiAppEffectChoiceFlow");
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
  const solarState = solar.createBaselineState();
  const nebulaDataState = data.createDefaultNebulaDataState();
  const alienGameState = aliens.createDefaultAlienState();
  const finalScoringState = finalScoring.createFinalScoringState(FINAL_SCORE_IDS);
  const sectorElements = {};
  const playerState = players.createPlayerState({
    players: players.PLAYER_COLOR_IDS.map((color) => ({ color })),
    currentPlayerColor: players.DEFAULT_PLAYER_COLOR,
  });
  const createTurnState = turnFlowModule.createTurnState;
  const turnState = createTurnState(playerState.players, {
    activePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    currentPlayerId: playerState.currentPlayerId,
  });
  const rocketState = rocketActions.createRocketState();
  const planetStatsState = planetStats.createPlanetStatsState();
  const techGameState = tech.createState();
  const cardState = cards.createCardState();
  const runtime = runtimeModule.createRuntime({
    aiDifficulty: AI_DIFFICULTY_LAUGHABLE,
    defaultActivePlayerCount: DEFAULT_ACTIVE_PLAYER_COUNT,
    alienTypeIds: aliens.ALIEN_TYPE_IDS || [],
    industryCardFiles: INDUSTRY_CARD_FILES,
  });
  const pendingState = runtime.pending;
  const actionLogState = runtime.actionLog;
  const actionBriefingState = runtime.actionBriefing;
  const startScreenState = runtime.startScreen;
  const setupSelectionState = runtime.selection;
  const uiRuntimeState = runtime.ui;
  let cardHoverPreview = null;
  let cardHoverPreviewImage = null;
  let cardHoverPreviewAnchor = null;
  let cardHoverPreviewListenersBound = false;
  const yichangdianAnomalyMarkerElements = new Map();
  const chongPlanetFossilMarkerElements = new Map();
  const chongFossilOwnerTokenElements = new Map();
  const banrenmaBonusMarkerElements = new Map();
  const runezuBoardSymbolElements = new Map();
  const cardTaskState = cardTaskStateModule.createTaskState();
  const actionHistory = actionHistoryModule.createActionHistory();
  const quickActionHistory = actionHistoryModule.createActionHistory();
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
  let applyIndustryRoundStartBonuses;
  let getFundamentalismRoundStartIncomeRound;
  let hasFundamentalismRoundStartIncomePending;
  let buildFundamentalismRoundStartIncomeEffect;
  let maybeStartFundamentalismRoundStartIncomeFlow;
  let beginIncomeForCurrentPlayer;
  let buildCardTaskContext;
  let buildPlayerDataTotals;
  let addProbeLocation;
  let buildProbeLocationIndex;
  let startTemporaryCardTaskRewardFlow;
  let getReadyCardTasks;
  let refreshCardTaskState;
  let renderReservedCardsFromTaskState;
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
  let getPlayCardBeforePlayerSnapshot;
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
  const renderRuntime = renderRuntimeModule.createRenderRuntime({
    document,
    Image,
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
    solarState,
    playerState,
    rocketState,
    nebulaDataState,
    planetStatsState,
    alienGameState,
    finalScoringState,
    turnState,
    uiRuntimeState,
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
    pendingState,
    cardState,
    tech,
    techGameState,
    actionHistory,
    quickActionHistory,
    getCurrentPlayer,
    getInterfacePlayer,
    getActivePlayers,
    getPlayerById,
    getPlayerByColor,
    getPlayerRoundOrderNumber,
    getPlayerDisplayLabel,
    isPlayerPassedThisRound,
    isInitialSelectionActive,
    getInitialSelectionOffer,
    getCurrentInitialSelectionCards,
    isInitialSelectionConfirmed,
    getInitialSelectionPlayerIds,
    getCardFromInitialOffer,
    getPlayerLabelById,
    getDisplayedTurnNumber,
    isGameEnded,
    createInitialSelectionPicker,
    createCompanyCardSummary,
    getPlayerCompanyBaseIncome,
    createPlayerNameStat,
    createStatSeparator,
    createStatIcon,
    createInlineIconValue,
    createPlayerStatsRow,
    buildPlayerResourceStatNodes,
    buildPlayerIncomeStatNodes,
    buildPlayerRunezuStatNodes,
    buildPlayerFangzhouStatNodes,
    updatePlayerHandPanelTitle,
    renderReservedCardsFromTaskState: (...args) => renderReservedCardsFromTaskState(...args),
    syncFinalScorePendingMarks,
    renderFinalScoreBoard,
    queueJiuzheOpportunitiesForPlayer,
    maybeOpenQueuedJiuzheOpportunity,
    queueBanrenmaOpportunitiesForPlayer,
    maybeOpenQueuedBanrenmaOpportunity,
    computePlayerFinalScoreBreakdown,
    buildPlutoMarkerContext,
    getCardTypeCode: (...args) => getCardTypeCode(...args),
    buildProbeLocationIndex: (...args) => buildProbeLocationIndex(...args),
    isDiscardSelectionActive: (...args) => isDiscardSelectionActive?.(...args),
    isPlayCardSelectionActive: (...args) => isPlayCardSelectionActive?.(...args),
    isMovePaymentSelectionActive: (...args) => isMovePaymentSelectionActive?.(...args),
    isHandScanSelectionActive: (...args) => isHandScanSelectionActive?.(...args),
    getPendingCardCornerQuickAction: (...args) => getPendingCardCornerQuickAction?.(...args),
    getPendingHandCardPlayAction: (...args) => getPendingHandCardPlayAction?.(...args),
    canUseCardCornerQuickAction: (...args) => canUseCardCornerQuickAction(...args),
    isIndustryHandSelectionActive,
    isIndustryFutureSpanHandSelectionActive,
    isFutureSpanEligibleHandCard: (...args) => isFutureSpanEligibleHandCard(...args),
    getFutureSpanDeltaForCard: (...args) => getFutureSpanDeltaForCard(...args),
    isMovePaymentCard: (...args) => isMovePaymentCard?.(...args),
    getCardCornerQuickActionForCard: (...args) => getCardCornerQuickActionForCard(...args),
    getHandCardPlayActionForCard: (...args) => getHandCardPlayActionForCard(...args),
    getPendingPlayCardSelection: (...args) => getPendingPlayCardSelection?.(...args),
    getCardPlayCost: (...args) => getCardPlayCost(...args),
    formatCardPlayCost: (...args) => formatCardPlayCost(...args),
    getPublicScanChoicesForCard,
    attachCardHoverPreview,
    ensurePublicCardsFilledRespectingDelayedRefills: (...args) => ensurePublicCardsFilledRespectingDelayedRefills(...args),
    updatePublicCardControls: (...args) => updatePublicCardControls(...args),
    canBlindDraw: (...args) => canBlindDraw(...args),
    getPlanetName,
    getBoardPointFromPolarPoint,
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
    scheduleAiAutoStepIfNeeded,
    getRocketCoordinateReadoutLines,
    selectDefaultRocketForCurrentPlayer,
    syncInteractionFocusChrome,
    placeDataToBlueSlot,
    getPublicCardHeight,
    isCardSelectionActive,
    isPublicCardMultiSelectActive,
    isAiAutoBattlePlayer,
  });
  const finalUiRuntime = finalUiRuntimeModule.createFinalUiRuntime({
    document,
    els,
    players,
    finalScoring,
    finalScoringState,
    endGameScoring,
    alienGameState,
    playerState,
    turnState,
    uiRuntimeState,
    rocketState,
    FINAL_SCORE_SLOT_POINTS,
    FINAL_ROUND_NUMBER,
    SCORE_SOURCE_KEYS,
    HISTORY_SOURCE_QUICK,
    getCurrentPlayer,
    getCurrentPlayerLabel: () => getCurrentPlayer()?.colorLabel || "",
    getActivePlayers,
    getDisplayedTurnNumber,
    getNormalTokenAssetForPlayer,
    getHistoryForSource,
    createActionLogImpactSnapshot,
    appendActionLogStep,
    actionLogOptionsFromHistoryStep,
    rememberHistoryStep,
    historyCommands,
    queueStateReadoutRender,
    computePlayerFinalScoreBreakdown,
    getPlayerScoreSource,
    updateActionButtons,
    renderPlayerStats,
    isGameEnded,
    isPlayerPassedThisRound,
    countPlayerOwnedTech: countPlayerOwnedTechForActionLogExport,
  });
  const {
    syncFinalScorePendingMarks,
    renderFinalScoreBoard,
    handleFinalScoreTileClick,
    buildFinalResultPlayerSummaries,
    syncFinalResultButton,
    openFinalResultDialog,
    closeFinalResultDialog,
    minimizeFinalResultDialog,
    maybeAutoOpenFinalResultDialog,
    buildActionLogExportPlayerResults,
  } = finalUiRuntime;
  const refreshHelpers = refreshModule.createRefreshHelpers({
    renderPlayerStats,
    renderAlienPanels,
    renderRockets,
    renderActionEffectBar,
    updateQuickPanel,
    updateActionButtons,
    renderStateReadout,
    renderTechBoard,
    renderSectorNebulaDataBoard,
    renderFinalScoreBoard,
    renderRunezuBoardSymbols,
  });
  const createActionBriefingStepMetadata = actionBriefingModule.createActionBriefingStepMetadata;
  const effectFlowHelpers = effectFlowModule.createEffectFlowHelpers({
    pendingState,
    uiRuntimeState,
    actionHistory,
    quickActionHistory,
    historyStepOrder,
    els,
    rocketState,
    abilities,
    historyCommands,
    cardEffects,
    quickTrades,
    cardState,
    actionLogState,
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    ACTION_LOG_DEFAULT_LABELS,
    getCurrentPlayer,
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
    renderReservedCardsFromTaskState: (...args) => renderReservedCardsFromTaskState(...args),
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
    turnState,
    HISTORY_SOURCE_MAIN,
    solar,
    solarState,
    data,
    aomomo,
    getAomomoCurrentX,
    normalizeActionLogText,
    createActionLogPlayedCardSnapshot,
    appendActionLogTextWithPlayedCard,
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
  let recordAbilityCommands;
  let startPendingActionSession;
  let beginQuickActionStep;
  let completePendingActionStep;
  let completeQuickActionStep;
  let rememberHistoryStep;
  let forgetLastHistoryStep;
  let clearHistoryStepOrderForSource;
  let getLatestUndoSource;
  let recordQuickTradeCompletion;
  let recordAtomicActionHistory;
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
    recordAbilityCommands,
    startPendingActionSession,
    beginQuickActionStep,
    completePendingActionStep,
    completeQuickActionStep,
    rememberHistoryStep,
    forgetLastHistoryStep,
    clearHistoryStepOrderForSource,
    getLatestUndoSource,
    recordQuickTradeCompletion,
    recordAtomicActionHistory,
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
    pendingState,
    els,
    rocketState,
    cardState,
    playerState,
    nebulaDataState,
    planetStatsState,
    alienGameState,
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
    renderReservedCardsFromTaskState: (...args) => renderReservedCardsFromTaskState(...args),
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
    pendingState,
    cardState,
    rocketState,
    alienGameState,
    turnState,
    solarState,
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
    isTechTilePickingActive,
    isCardSelectionActive,
    isDiscardSelectionActive,
    isPlayCardSelectionActive,
    isIndustryHandSelectionActive,
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
    getPlayCardBeforePlayerSnapshot: (...args) => getPlayCardBeforePlayerSnapshot(...args),
    restoreObjectSnapshot: (...args) => restoreObjectSnapshot(...args),
    releaseFutureSpanAfterPlayWithHistory,
    markActionPending,
    renderPlayerHand,
    renderPlayerStats,
    renderReservedCardsFromTaskState: (...args) => renderReservedCardsFromTaskState(...args),
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
    getPublicScanChoicesForCard,
    executeFreeMoveForScanAction4,
    executeFreeMoveForCardCorner,
    executeFreeMoveForCardTrigger,
    executeIndustryFreeMove,
    executeCardEffectMove,
    createActionContext,
    recordMoveActionHistory,
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
    beginCardCornerFreeMove,
    startCardCornerMoveEffectFlow: (...args) => startCardCornerMoveEffectFlow(...args),
    rollbackPendingIndustryQuickAction,
    continuePendingDataPlacementAfterBonus,
    applyIndustryPlayCardPassives,
    buildPlayCardEffectFlowQueue,
    createImmediatePlayCardEvent: (...args) => createImmediatePlayCardEvent(...args),
    createPlayCardEvent: (...args) => createPlayCardEvent(...args),
    recordPlayCardStart,
    startPlayCardEffectFlow,
    appendIndustryPlayPassiveStatus,
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
    handleFutureSpanCardPlay,
    handleFutureSpanPlayCardSelect,
    handleHandScanCardClick,
  } = handFlowHelpers);
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
    document,
    structuredClone,
    pendingState,
    cardState,
    nebulaDataState,
    alienGameState,
    solarState,
    rocketState,
    playerState,
    els,
    PUBLIC_SCAN_MAX_BONUS_CARDS,
    SECTOR_FINISH_ICON_BY_COLOR,
    SECTOR_WIN_REWARDS,
    PUBLIC_SCAN_TARGETS_BY_CODE,
    PUBLIC_SCAN_CODE_LABELS,
    SCAN_TARGET_ACTION_LAYOUT_CLASSES,
    getCurrentPlayer,
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
    isTechTilePickingActive,
    isCardSelectionActive,
    isDiscardSelectionActive,
    isPlayCardSelectionActive,
    isMovePaymentSelectionActive,
    isHandScanSelectionActive,
    resolvePlayerReference,
    getFlowMarkedNebulaIds,
    normalizeResourceCost,
    createActionContext,
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
    confirmIndustryHeliosRemoveTech,
    isActionEffectFlowActive,
    skipActionEffectWithMessage,
    getCurrentActionEffect,
    applyAomomoScanCostAndBonus,
    maybeReturnPlayedCardToHandAfterSectorScan,
    maybeCompleteActionEffectFromScan,
    markCurrentActionIrreversible,
    syncInteractionFocusChrome,
    openYichangdianCornerPicker,
    rollbackPendingIndustryQuickAction,
    beginCardSelection: (...args) => beginCardSelection(...args),
  });
  ({
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
  const incomeRuntime = incomeRuntimeModule.createIncomeRuntime({
    INCOME_GAIN_LABELS,
    players,
    data,
    blindDrawCardForPlayer: (...args) => blindDrawCardForPlayer(...args),
    industry,
    getCardTypeCode: (...args) => getCardTypeCode(...args),
    incrementCompletedTaskCount: (...args) => incrementCompletedTaskCount(...args),
    cards,
    turnState,
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
    rocketState,
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
    applyIndustryRoundStartBonuses,
    getFundamentalismRoundStartIncomeRound,
    hasFundamentalismRoundStartIncomePending,
    buildFundamentalismRoundStartIncomeEffect,
    maybeStartFundamentalismRoundStartIncomeFlow,
    beginIncomeForCurrentPlayer,
  } = incomeRuntime);
  function confirmAlienTracePlacement(...args) {
    return alienRuntimeHelpers.confirmAlienTracePlacement(...args);
  }

  function confirmFangzhouTracePlacement(...args) {
    return alienRuntimeHelpers.confirmFangzhouTracePlacement(...args);
  }

  const alienUiHelpers = alienUiModule.createAlienUiHelpers({
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
    pendingState,
    alienGameState,
    playerState,
    rocketState,
    els,
    renderAlienPanels,
    renderStateReadout,
    getCurrentPlayer,
    getAlienTraceActionPlayer: (...args) => getAlienTraceActionPlayer?.(...args),
    getAvailableDataTokenCount,
    resolvePlayerReference,
    confirmFangzhouCard2Unlock,
    confirmAlienTracePlacement,
    confirmFangzhouTracePlacement,
    isDebugAlienTraceMode,
    isActionEffectFlowActive,
    isCardSelectionActive,
    isDiscardSelectionActive,
    getPlayerColorDefinition: (playerColor) => players.getPlayerColorDefinition(playerColor),
  });
  const {
    buildAlienRevealNoticeEntry,
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
    closeAlienTracePicker,
    openAlienTracePicker,
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
    handleFangzhouTraceDestinationChoice,
    handleFangzhouUnlockTraceChoice,
    routeFangzhouAlienTraceGain,
    handleStateTraceSlotPlacement,
    handleFangzhouTraceSlotPlacement,
    getEligibleAlienSlotIdsForTraceEffect,
    getAlienTraceChoiceSlotIds,
    hasAlienTracePanelPlacementTarget,
    isAlienTracePickerChoiceAllowed,
  } = alienUiHelpers;
  const alienRuntimeHelpers = alienRuntimeModule.createAlienRuntimeHelpers({
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
    pendingState,
    alienGameState,
    playerState,
    rocketState,
    solarState,
    nebulaDataState,
    techGameState,
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
    renderReservedCardsFromTaskState: (...args) => renderReservedCardsFromTaskState(...args),
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
    maybeRestoreAlienLabPanelForTrace,
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
    canPlaceJiuzheTrace,
    canPlaceYichangdianTrace,
    canPlaceFangzhouTrace,
    canPlaceBanrenmaTrace,
    canPlaceChongTrace,
    canPlaceAmibaTrace,
    canPlaceAomomoTrace,
    canPlaceRunezuTrace,
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
  } = alienRuntimeHelpers;

  function getPlayerHandPanelTitleHint() {
    if (isDiscardSelectionActive()) {
      const remaining = cards.getDiscardRemaining(cardState);
      return `（请选择 ${remaining} 张弃牌）`;
    }
    if (isHandScanSelectionActive()) {
      return "（请选择一张牌进行扫描）";
    }
    if (isMovePaymentSelectionActive() && !isMovePaymentLockedForAiAutomation()) {
      const required = pendingState.movePayment?.requiredMovePoints || MOVE_ENERGY_COST;
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

  function initializeCardGame(handCount = DEFAULT_INITIAL_HAND_COUNT) {
    if (!Array.isArray(playerState.players) || !playerState.players.length) return;

    for (const player of playerState.players) {
      player.hand = [];
      player.reservedCards = [];
      player.completedTaskCount = 0;
      player.resources.handSize = 0;
    }
    cardState.publicCards = Array.from({ length: cards.PUBLIC_CARD_COUNT }, () => null);
    cardState.discardPile = [];
    cardState.drawPileCardIds = [];
    cards.setSelectionActive(cardState, false);
    cards.setPlayCardSelectionActive(cardState, false);
    cards.setDiscardSelectionActive(cardState, false, 0);
    for (const player of getActivePlayers()) {
      cards.drawCardsToHand(cardState, playerState, player, handCount);
    }
    ensurePublicCardsFilledRespectingDelayedRefills();
    preparePassReservePilesForCurrentGame();
  }

  function preparePassReservePilesForCurrentGame(options = {}) {
    return cards.preparePassReservePiles(cardState, playerState, {
      rounds: PASS_RESERVE_ROUNDS,
      activePlayerCount: turnState.activePlayerCount || DEFAULT_ACTIVE_PLAYER_COUNT,
      random: options.random || Math.random,
    });
  }

  const turnFlowController = turnFlowModule.createTurnFlowController({
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
    pendingState,
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
    renderRotateStateToken,
    renderDebugPlayerSwitch,
    refreshHelpers,
    cancelIndustryAbilityFlow,
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
    getPlayerById,
    computePlayerFinalScoreBreakdown,
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
  const actionRuntimeController = actionRuntimeModule.createActionRuntime({
    setupSelectionState,
    playerState,
    turnState,
    pendingState,
    rocketState,
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
    renderTechBoard,
    renderSectorNebulaDataBoard,
    syncPlanetOrbitLandMarkers,
    renderAlienPanels,
    renderRockets,
    syncInteractionFocusChrome,
    updateActionButtons,
    renderStateReadout,
    schedulePersistentGameStateSave,
    resolveInitialSelectionEffects,
    applyIndustryRoundStartBonuses,
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
    createActionContext,
    actions,
    removeRocketElement,
    syncPlanetOrbitLandMarkersAfterAction: syncPlanetOrbitLandMarkers,
    startPlanetRewardEffectFlow,
    startLaunchSectorFinishEffectFlow,
    settleCardTasksAfterEffect: (...args) => settleCardTasksAfterEffect(...args),
    maybeAutoExecuteAomomoRewardEffects,
    startResearchTechEffectFlow,
    syncTechSelectionChrome,
    finalizeTechTakeResult,
    renderRocketElement,
    recordAtomicActionHistory,
    startAnalyzeDataRewardFlow,
    executeActionEffect,
    getCurrentActionEffect,
    maybeApplyIndustryLaunchScan,
    maybeConsumeAlienLabPanelForMainAction,
    markActionPending,
    beginScanAction: (...args) => beginScanAction(...args),
    beginPlayCardSelection: (...args) => beginPlayCardSelection(...args),
    researchTechForCurrentPlayer: (...args) => researchTechForCurrentPlayer(...args),
    orbitForCurrentPlayer: (...args) => orbitForCurrentPlayer(...args),
    landForCurrentPlayer: (...args) => landForCurrentPlayer(...args),
    analyzeDataForCurrentPlayer: (...args) => analyzeDataForCurrentPlayer(...args),
    passForCurrentPlayer: (...args) => passForCurrentPlayer(...args),
    endCurrentTurn: (...args) => endCurrentTurn(...args),
    blockManualAiPendingInputIfNeeded,
    getCurrentActionEffectIndex: () => pendingState.actionEffectFlow?.currentIndex,
    runQuickTrade,
    confirmDataPlacement,
  });

  function getActiveOrderedPlayerIds() {
    return turnFlowModule.getActiveOrderedPlayerIds(turnState);
  }

  function getRoundOrderPlayerIds() {
    return turnFlowModule.getRoundOrderPlayerIds(turnState);
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
    return turnFlowController.setTurnStatePlayerOrder(playerIds, options);
  }

  function randomizePlayerTurnOrder() {
    return turnFlowController.randomizePlayerTurnOrder();
  }

  function beginNextRound() {
    return turnFlowController.beginNextRound();
  }

  function getDisplayedTurnNumber(rawTurnNumber = turnState.turnNumber) {
    return turnFlowController.getDisplayedTurnNumber(rawTurnNumber);
  }

  function getActionCycleNumber() {
    return turnFlowController.getActionCycleNumber();
  }

  function advanceTurnAfterPlayerAction(playerId, options = {}) {
    return turnFlowController.advanceTurnAfterPlayerAction(playerId, options);
  }

  function startNewGame(options = {}) {
    return turnFlowController.startNewGame(options);
  }

  function randomizeAll() {
    return turnFlowController.randomizeAll();
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
    return actionRuntimeController.getInitialSelectionPlayerIds();
  }

  function isInitialSelectionActive() {
    return actionRuntimeController.isInitialSelectionActive();
  }

  function getInitialSelectionOffer(playerId = playerState.currentPlayerId) {
    return actionRuntimeController.getInitialSelectionOffer(playerId);
  }

  function isInitialSelectionConfirmed(playerId = playerState.currentPlayerId) {
    return actionRuntimeController.isInitialSelectionConfirmed(playerId);
  }

  function canConfirmInitialSelection(offer) {
    return actionRuntimeController.canConfirmInitialSelection(offer);
  }

  function startInitialSelection() {
    return actionRuntimeController.startInitialSelection();
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
    return actionRuntimeController.handleInitialSelectionCardClick(kind, cardId);
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
    return actionRuntimeController.confirmInitialSelectionForCurrentPlayer();
  }

  function resolveInitialSelectionEffects() {
    if (!initialCards?.resolveInitialSelections) return null;

    const context = {
      ...createActionContext(),
      alienGameState,
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

  function startInitialIncomeEffectFlow(entries = []) {
    const effects = buildInitialIncomeEffectNodes(entries);
    if (!effects.length) return false;

    pendingState.actionEffectFlow = abilities.chain.startAbilityChain(
      "initialIncome",
      "初始收入增加",
      effects,
    );
    pendingState.actionEffectFlow.actionType = "initialIncome";
    pendingState.actionEffectFlow.playerId = effects[0]?.options?.playerId || null;
    assignEffectFlowOwner(pendingState.actionEffectFlow, pendingState.actionEffectFlow.playerId);

    const firstPlayer = getPlayerById(pendingState.actionEffectFlow.playerId);
    if (firstPlayer) {
      playerState.currentPlayerId = firstPlayer.id;
    }

    els.appWrap?.classList.toggle("action-effect-flow-active", true);
    rocketState.statusNote = "初始收入增加：请依次点击收入效果";
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

  function getPlayerById(playerId) {
    return playerState.players.find((player) => player.id === playerId) || null;
  }

  function resolvePlayerReference(reference = {}) {
    const playerId = reference.playerId || null;
    if (playerId) {
      const player = getPlayerById(playerId);
      if (player) return player;
    }
    const playerColor = reference.playerColor || null;
    return playerColor ? getPlayerByColor(playerColor) : null;
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

  function getExplicitEffectOwnerPlayer(effect) {
    return resolvePlayerReference({
      playerId: effect?.options?.targetPlayerId || effect?.playerId || effect?.options?.playerId,
      playerColor: effect?.options?.targetPlayerColor || effect?.playerColor || effect?.options?.playerColor,
    });
  }

  function getEffectOwnerPlayer(effect) {
    return getExplicitEffectOwnerPlayer(effect)
      || getPlayerById(pendingState.actionEffectFlow?.defaultPlayerId)
      || getPlayerById(pendingState.actionEffectFlow?.playerId)
      || players.getCurrentPlayer(playerState);
  }

  function getPendingOwnerFields(effect = null, player = null) {
    const owner = player || getExplicitEffectOwnerPlayer(effect) || getCurrentPlayer();
    return {
      playerId: owner?.id || null,
      playerColor: owner?.color || null,
    };
  }

  function getPendingOwnerPlayer(pending = null, fallbackEffect = null) {
    const effect = fallbackEffect || pending?.effect || null;
    return resolvePlayerReference({
      playerId: pending?.playerId || pending?.targetPlayerId,
      playerColor: pending?.playerColor || pending?.targetPlayerColor,
    })
      || getExplicitEffectOwnerPlayer(effect)
      || (effect ? getEffectOwnerPlayer(effect) : null)
      || getCurrentPlayer();
  }

  function withPendingOwnerPlayer(pending, callback) {
    const owner = getPendingOwnerPlayer(pending);
    const previousPlayerId = uiRuntimeState.effectExecutionPlayerId;
    uiRuntimeState.effectExecutionPlayerId = owner?.id || previousPlayerId;
    try {
      return callback(owner);
    } finally {
      uiRuntimeState.effectExecutionPlayerId = previousPlayerId;
    }
  }

  function setActiveEffectFlowOwner(effect) {
    if (!pendingState.actionEffectFlow || !effect) return null;
    const owner = getEffectOwnerPlayer(effect);
    pendingState.actionEffectFlow.activePlayerId = owner?.id || null;
    return owner;
  }

  function withEffectExecutionPlayer(effect, callback) {
    const owner = getEffectOwnerPlayer(effect);
    const previousPlayerId = uiRuntimeState.effectExecutionPlayerId;
    uiRuntimeState.effectExecutionPlayerId = owner?.id || previousPlayerId;
    try {
      return callback();
    } finally {
      uiRuntimeState.effectExecutionPlayerId = previousPlayerId;
    }
  }

  function getInterfacePlayer() {
    const currentPlayer = players.getCurrentPlayer(playerState);
    if (!currentPlayer || !isAiAutoBattlePlayer(currentPlayer.id) || isAiAutomationPaused()) return currentPlayer;
    const humanPlayer = getActivePlayers().find((player) => !isAiAutoBattlePlayer(player.id))
      || playerState.players.find((player) => !isAiAutoBattlePlayer(player.id))
      || null;
    return humanPlayer || currentPlayer;
  }

  function createScanRunId(prefix = "scan") {
    pendingState.scanRunSequence += 1;
    return `${prefix}-${pendingState.scanRunSequence}`;
  }

  function resetScanRunSequence() {
    pendingState.scanRunSequence = 0;
  }

  function getActivePlayers() {
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
    get pendingDiscardAction() { return pendingState.discardAction; },
    get pendingCardSelectionAction() { return pendingState.cardSelectionAction; },
    get pendingPassReserveSelection() { return pendingState.passReserveSelection; },
    get pendingScanTargetAction() { return pendingState.scanTargetAction; },
    get pendingProbeSectorScanAction() { return pendingState.probeSectorScanAction; },
    get pendingProbeLocationRewardAction() { return pendingState.probeLocationRewardAction; },
    get pendingPublicScanQueue() { return pendingState.publicScanQueue; },
    get pendingHandScanAction() { return pendingState.handScanAction; },
    get pendingAlienTraceAction() { return pendingState.alienTraceAction; },
    get pendingLandTargetAction() { return pendingState.landTargetAction; },
    get pendingDataPlaceAction() { return pendingState.dataPlaceAction; },
    get pendingJiuzheCardPlay() { return pendingState.jiuzheCardPlay; },
    get pendingYichangdianCardGain() { return pendingState.yichangdianCardGain; },
    get pendingYichangdianCornerAction() { return pendingState.yichangdianCornerAction; },
    get pendingBanrenmaCardGain() { return pendingState.banrenmaCardGain; },
    get pendingBanrenmaOpportunity() { return pendingState.banrenmaOpportunity; },
    get pendingChongCardGain() { return pendingState.chongCardGain; },
    get pendingChongFossilChoice() { return pendingState.chongFossilChoice; },
    get pendingAmibaCardGain() { return pendingState.amibaCardGain; },
    get pendingAmibaSymbolChoice() { return pendingState.amibaSymbolChoice; },
    get pendingAmibaTraceRemoval() { return pendingState.amibaTraceRemoval; },
    get pendingAomomoCardGain() { return pendingState.aomomoCardGain; },
    get pendingRunezuCardGain() { return pendingState.runezuCardGain; },
    get pendingRunezuSymbolBranch() { return pendingState.runezuSymbolBranch; },
    get pendingRunezuFaceSymbolPlacement() { return pendingState.runezuFaceSymbolPlacement; },
    get pendingCardTriggerAction() { return pendingState.cardTriggerAction; },
    get pendingCardTriggerFreeMove() { return pendingState.cardTriggerFreeMove; },
    get pendingCardTaskCompletion() { return pendingState.cardTaskCompletion; },
    get pendingChongTaskCompletion() { return pendingState.chongTaskCompletion; },
    get pendingActionExecuted() { return pendingState.actionExecuted; },
    get pendingActionEffectFlow() { return pendingState.actionEffectFlow; },
    get actionHistoryHasSession() { return actionHistory.hasSession(); },
    get actionHistorySessionInfo() { return actionHistory.getSessionInfo?.() || null; },
    get effectStepActive() { return uiRuntimeState.effectStepActive; },
    set effectStepActive(value) { uiRuntimeState.effectStepActive = value; },
    get pendingMovePayment() { return pendingState.movePayment; },
    get pendingPlayCardSelection() { return pendingState.playCardSelection; },
    get pendingCardCornerFreeMove() { return pendingState.cardCornerFreeMove; },
    get pendingIndustryAbility() { return pendingState.industryAbility; },
    get pendingStrategyPassiveSlotChoice() { return pendingState.strategyPassiveSlotChoice; },
    get industryFreeMoveState() { return uiRuntimeState.industryFreeMoveState; },
    get alienTracePickerState() { return pendingState.alienTracePickerState; },
  };

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
    solarState,
    nebulaDataState,
    alienGameState,
    finalScoringState,
    playerState,
    turnState,
    rocketState,
    planetStatsState,
    techGameState,
    cardState,
    cardTaskState,
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
    cancelTechSelection,
    clearTransientStateForRecovery,
    closeScanTargetPicker,
    computePlayerFinalScoreBreakdown,
    confirmCardTaskCompletion,
    confirmCardCornerQuickAction,
    confirmDataPlacement,
    confirmDiscardAnyForIncome,
    confirmHandCardPlayAction,
    confirmInitialSelectionForCurrentPlayer,
    confirmLandTargetPicker,
    confirmMovePayment,
    confirmPassReserveSelection: (...args) => confirmPassReserveSelection(...args),
    confirmPlayCardSelection,
    confirmProbeSectorScanSelection,
    confirmPublicScanSelection,
    confirmScanTarget,
    confirmStrategyPassiveSlotChoice,
    confirmTechBlueSlotChoice,
    createActionContext,
    createTurnState,
    dispatchRuntimeAction: (request) => actionRuntimeController.dispatchAction(request),
    drawCardForCurrentPlayer: (...args) => drawCardForCurrentPlayer(...args),
    endCurrentTurn,
    recoverPendingActionFromOpenHistoryForAi,
    executeActionEffect,
    executeCardMoveForEffect,
    executeFreeMoveForCardCorner,
    executeFreeMoveForCardTrigger,
    executeFreeMoveForScanAction4,
    executeIndustryFreeMove,
    finalizePendingDiscardSelection,
    finishIndustryAbilityFlow,
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
    getPublicScanChoicesForCard,
    getReadyCardTasks,
    getRequiredMovePointsForUi,
    getResearchTechSelectionOptions,
    getSectorContentForMove,
    getSectorXsMatchingCondition,
    handleAmibaCardGainChoice,
    handleAmibaSymbolChoice,
    handleAmibaTraceRemovalChoice,
    handleAomomoCardGainChoice,
    handleBanrenmaBonusChoice,
    handleBanrenmaCardConditionChoice,
    handleBanrenmaCardGainChoice,
    handleCardTriggerChoice,
    handleChongCardGainChoice,
    handleChongFossilChoice,
    handleChongTaskCompletionChoice,
    handleCompanyActionMarkerClick,
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
    handleIndustryDeepspaceHandClick,
    handleRunezuCardGainChoice,
    handleRunezuFaceSymbolChoice,
    handleRunezuSymbolBranchChoice,
    handleScanAction4Choice,
    handleSupplyTechTileClick,
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
    isIndustryHandSelectionActive,
    isInitialSelectionActive,
    isMovePaymentCard,
    isMovePaymentSelectionActive,
    isPlayCardSelectionActive,
    isPublicScanMultiSelectActive,
    isUiBlockingAiAutomation: isActionBriefingOpen,
    isTechTileOwnedByOtherPlayer,
    isTechTilePickingActive,
    landForCurrentPlayer,
    moveRocket,
    orbitForCurrentPlayer,
    openBanrenmaReadyOpportunityForPlayer,
    openCardTaskCompletionPicker: (...args) => openCardTaskCompletionPicker(...args),
    openRunezuFaceSymbolPlacement,
    passForCurrentPlayer,
    pickPublicCardForCurrentPlayer,
    randomizeAll,
    renderStateReadout,
    researchTechForCurrentPlayer,
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
    buildAiTurnActionCandidates,
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
    listCardTriggerFreeMoveCandidates,
    recordAiAutoBattleLog,
    resolveAiAutomationToTurnBoundary,
    resetAiStrategyWeights,
    restoreAiControlSnapshot,
    runAiAutoBattle,
    runAiAutoBattleBatch,
    runAiAutomationStep,
    runAiNonTurnAutomationStep,
    runAiSelectedTurnAction,
    runAiStrategyABTest,
    runAiStrategyTuningCycle,
    scheduleAiAutoStepIfNeeded,
    stopAiAutoBattle,
    sumAiDemandMap,
  } = aiController;
  const cardRuntime = cardRuntimeModule.createCardRuntime({
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
    cardState,
    cards,
    clearMoveRocketHighlight,
    clearHistoryStepOrderForSource,
    commitIrreversibleIndustryQuickAction,
    completeCurrentActionEffect,
    completeQuickActionStep,
    continueAfterCardTriggerResolution: (...args) => continueAfterCardTriggerResolution(...args),
    continuePendingDataPlacementAfterBonus,
    createActionContext,
    createCardTriggerProgressCommands: (...args) => createCardTriggerProgressCommands(...args),
    data,
    deactivateMoveMode,
    discardReservedCardIfFinished: (...args) => discardReservedCardIfFinished(...args),
    document,
    els,
    fangzhou,
    finalizeIndustryDeepspaceSwap,
    finishIndustryAbilityFlow,
    formatPlanetRewardGain,
    endEffectHistoryStep,
    getCurrentPlayer,
    getCurrentActionEffect,
    getDelayedPublicRefillSlots,
    getGameplayLockReason,
    getMainActionStartBlockReason,
    getMovableTokensForPlayer,
    getRequiredMovePointsForUi,
    getPlayerById,
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
    isIndustryHandSelectionActive,
    isMovePaymentLockedForAiAutomation,
    isMovePaymentSelectionActive,
    isPlayCardSelectionActive,
    isTechTilePickingActive,
    keepExistingMainActionPendingAfterChongTask,
    markCurrentActionIrreversible,
    maybeApplyCardMoveDistinctEventReward,
    maybeApplyCardMoveSameRingReward,
    maybeContinuePendingTurnEndRevealFlow,
    normalizeResourceCost,
    pendingState,
    playerState,
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
    rocketState,
    rocketActions,
    rollbackPendingIndustryQuickAction,
    runezu,
    selectDefaultRocketForCurrentPlayer,
    scrollToPlayerHandPanel,
    settleCardTasksAfterEffect: (...args) => settleCardTasksAfterEffect(...args),
    startCardEffectFlow,
    structuredClone,
    syncCardSelectionChrome,
    syncMovePaymentChrome,
    turnState,
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
    getPlayCardBeforePlayerSnapshot,
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
  const cardTriggerRuntime = cardTriggerRuntimeModule.createCardTriggerRuntime({
    HISTORY_SOURCE_MAIN,
    HISTORY_SOURCE_QUICK,
    SCORE_SOURCE_KEYS,
    abilities,
    actionLogOptionsFromHistoryStep,
    activateMoveMode,
    activateNextActionEffectIfIdle,
    addScoreSourceFromGain,
    alienGameState,
    aliens,
    amiba,
    appendActionLogStep,
    banrenma,
    beginCardSelection,
    beginQuickActionStep,
    beginSupplementalMovePayment,
    blockManualAiPendingInputIfNeeded,
    buildPlutoMarkerContext,
    cardEffects,
    cardState,
    cardTaskState,
    cardTaskStateModule,
    cardTriggerNeedsFreeMove,
    cards,
    chong,
    clearMoveRocketHighlight,
    completeQuickActionStep,
    composeActionLogDetailWithImpact,
    createActionContext,
    createActionLogImpactSnapshot,
    createBanrenmaReservedButton,
    createFangzhouReservedButtons,
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
    formatChongFossilRewardSummary,
    formatPlanetRewardGain,
    getCardTriggerFreeMoveEffect,
    getCardTypeCode,
    getCurrentPlayer,
    getCurrentInitialSelectionCards,
    getEarthSectorCoordinate,
    getInterfacePlayer,
    getMovableTokensForPlayer,
    getPendingOwnerPlayer,
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
    listCardTriggerFreeMoveCandidates,
    listReadyChongTransportCandidates,
    markCurrentActionIrreversibleForSource,
    maybeApplyIndustryLaunchScan,
    nebulaDataState,
    openAmibaSymbolChoiceDialog,
    pendingState,
    planetStatsState,
    playerHasOwnOrbitMarkerAtPlanet,
    playerState,
    players,
    quickActionHistory,
    recordAbilityCommands,
    recordQuickHistoryCommand,
    rememberHistoryStep,
    renderActionEffectBar,
    renderAlienPanels,
    renderInitialSelectionArea,
    renderPlayerHand,
    renderPlayerStats,
    renderPublicCards,
    renderRocketElement,
    renderRockets,
    renderStateReadout,
    resolvePlayerReference,
    rocketActions,
    rocketState,
    runezu,
    selectDefaultRocketForCurrentPlayer,
    solar,
    startCardEffectFlow,
    structuredClone,
    turnState,
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
    renderReservedCardsFromTaskState,
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

  function getActionLogActionLabel(actionType, label) {
    return label || ACTION_LOG_DEFAULT_LABELS[actionType] || actionType || "本回合行动";
  }

  function normalizeActionLogText(text) {
    return actionLogRuntimeModule.normalizeText(text);
  }

  function compactActionLogText(text) {
    return actionLogRuntimeModule.compactText(text);
  }

  function createActionLogPlayedCardSnapshot(card) {
    return actionLogRuntimeModule.createPlayedCardSnapshot(card, {
      getCardLabel: cards.getCardLabel,
    });
  }

  function bindCardHoverPreviewRepositioning() {
    if (cardHoverPreviewListenersBound) return;
    cardHoverPreviewListenersBound = true;
    window.addEventListener("resize", () => positionCardHoverPreview(), { passive: true });
    window.addEventListener("scroll", () => positionCardHoverPreview(), { passive: true, capture: true });
    document.addEventListener("pointerdown", () => hideCardHoverPreview(), { capture: true });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") hideCardHoverPreview();
    }, { capture: true });
  }

  function ensureCardHoverPreview() {
    if (cardHoverPreview && cardHoverPreviewImage) {
      return cardHoverPreview;
    }

    cardHoverPreview = document.createElement("div");
    cardHoverPreview.className = "card-hover-preview";
    cardHoverPreview.setAttribute("aria-hidden", "true");

    cardHoverPreviewImage = document.createElement("img");
    cardHoverPreviewImage.alt = "";
    cardHoverPreviewImage.decoding = "async";
    cardHoverPreviewImage.onload = () => positionCardHoverPreview();

    cardHoverPreview.append(cardHoverPreviewImage);
    document.body.append(cardHoverPreview);
    bindCardHoverPreviewRepositioning();
    return cardHoverPreview;
  }

  function positionCardHoverPreview(anchor = cardHoverPreviewAnchor) {
    if (!anchor || !cardHoverPreview || !cardHoverPreview.classList.contains("is-visible")) return;

    const anchorRect = anchor.getBoundingClientRect();
    const previewRect = cardHoverPreview.getBoundingClientRect();
    const margin = 12;
    const previewWidth = previewRect.width || 260;
    const previewHeight = previewRect.height || 360;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const maxLeft = Math.max(margin, viewportWidth - previewWidth - margin);
    let left = anchorRect.left + (anchorRect.width / 2) - (previewWidth / 2);
    let top = anchorRect.top - previewHeight - margin;
    let placement = "above";

    if (top < margin) {
      top = anchorRect.bottom + margin;
      placement = "below";
    }
    if (top + previewHeight > viewportHeight - margin) {
      top = Math.max(margin, viewportHeight - previewHeight - margin);
    }

    left = Math.min(Math.max(margin, left), maxLeft);
    cardHoverPreview.dataset.placement = placement;
    cardHoverPreview.style.left = `${Math.round(left)}px`;
    cardHoverPreview.style.top = `${Math.round(top)}px`;
  }

  function showCardHoverPreview(anchor, src, label) {
    if (!anchor || !src) return;
    const preview = ensureCardHoverPreview();
    cardHoverPreviewAnchor = anchor;
    cardHoverPreviewImage.src = src;
    cardHoverPreviewImage.alt = label || "";
    preview.classList.toggle(
      "card-hover-preview--pass-reserve",
      Boolean(anchor.closest?.(".pass-reserve-selection-overlay")),
    );
    preview.classList.toggle(
      "card-hover-preview--action-briefing",
      Boolean(anchor.closest?.(".action-briefing-overlay")),
    );
    preview.style.visibility = "hidden";
    preview.classList.add("is-visible");
    positionCardHoverPreview(anchor);
    preview.style.visibility = "";
  }

  function hideCardHoverPreview(anchor) {
    if (anchor && cardHoverPreviewAnchor && anchor !== cardHoverPreviewAnchor) return;
    if (cardHoverPreview) {
      cardHoverPreview.classList.remove("is-visible");
      cardHoverPreview.classList.remove("card-hover-preview--pass-reserve");
      cardHoverPreview.classList.remove("card-hover-preview--action-briefing");
      cardHoverPreview.style.visibility = "";
    }
    cardHoverPreviewAnchor = null;
  }

  function attachCardHoverPreview(anchor, src, label) {
    if (!anchor || !src) return anchor;
    const cardLabel = label || "";
    anchor.addEventListener("pointerenter", () => showCardHoverPreview(anchor, src, cardLabel));
    anchor.addEventListener("pointerleave", () => hideCardHoverPreview(anchor));
    anchor.addEventListener("pointermove", () => positionCardHoverPreview(anchor));
    anchor.addEventListener("focus", () => showCardHoverPreview(anchor, src, cardLabel));
    anchor.addEventListener("blur", () => hideCardHoverPreview(anchor));
    return anchor;
  }

  function getActionLogDetailPartRedundantKey(part) {
    const segments = normalizeActionLogText(part)
      .split(/[：:]/)
      .map((segment) => compactActionLogText(segment).replace(/奖励/g, ""))
      .filter(Boolean);
    if (segments.length < 3) return "";
    const key = `${segments[0]}${segments[1]}`;
    return key.length >= 4 ? key : "";
  }

  function simplifyActionLogDetailForLabel(label, detail) {
    return actionLogRuntimeModule.simplifyDetailForLabel(label, detail);
  }

  function composeActionLogStepText(label, detail) {
    return actionLogRuntimeModule.composeStepText(label, detail);
  }

  function normalizeActionLogBriefingSnapshot(briefing) {
    return actionLogRuntimeModule.normalizeBriefingSnapshot(briefing, {
      normalizeSectorX: solar.mod8,
      getNebulaLabel: data.getNebulaLabel,
    });
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
    return {
      stepId: step.id || null,
      undoable: step.undoable !== false,
      irreversibleCode: step.irreversibleCode || null,
      irreversibleReason: step.irreversibleReason || null,
      playedCard: step.playedCard || null,
      briefing: step.briefing || null,
    };
  }

  function pickNumericFields(source = {}, keys = []) {
    const picked = {};
    for (const key of keys) {
      picked[key] = Number(source?.[key]) || 0;
    }
    return picked;
  }

  function createActionLogImpactSnapshot(player = getCurrentPlayer()) {
    if (!player) return null;
    return {
      playerId: player.id || null,
      resources: pickNumericFields(player.resources || {}, ACTION_LOG_RESOURCE_KEYS),
      income: pickNumericFields(player.income || {}, ACTION_LOG_INCOME_KEYS),
      completedTaskCount: Number(player.completedTaskCount) || 0,
    };
  }

  function formatSignedDelta(value) {
    const rounded = Math.round(Number(value) * 100) / 100;
    return `${rounded > 0 ? "+" : ""}${rounded}`;
  }

  function createActionLogDeltaEntries(before = {}, after = {}, keys = [], labels = {}) {
    const entries = [];
    for (const key of keys) {
      const delta = (Number(after?.[key]) || 0) - (Number(before?.[key]) || 0);
      if (!delta) continue;
      const label = labels[key] || key;
      entries.push({
        key,
        label,
        delta,
        text: `${label}${formatSignedDelta(delta)}`,
      });
    }
    return entries;
  }

  function formatActionLogDeltaGroup(before = {}, after = {}, keys = [], labels = {}) {
    return createActionLogDeltaEntries(before, after, keys, labels).map((entry) => entry.text);
  }

  function isActionLogDeltaRepresentedInDetail(detail, entry) {
    const compactDetail = compactActionLogText(detail);
    if (!compactDetail || !entry?.delta) return false;
    const absDelta = Math.abs(entry.delta);
    const sign = entry.delta > 0 ? "+" : "-";
    const label = compactActionLogText(entry.label);
    const unit = compactActionLogText(ACTION_LOG_DELTA_UNITS[entry.key] || entry.label);
    const candidates = [
      `${label}${sign}${absDelta}`,
      `${sign}${absDelta}${label}`,
    ];
    if (entry.delta > 0) {
      candidates.push(`${label}+${absDelta}`);
      if (unit) {
        candidates.push(`${absDelta}${unit}`, `+${absDelta}${unit}`, `获得${absDelta}${unit}`);
      }
    } else if (unit) {
      candidates.push(`-${absDelta}${unit}`, `支付${absDelta}${unit}`, `消耗${absDelta}${unit}`);
    }
    return candidates.some((candidate) => candidate && compactDetail.includes(candidate));
  }

  function formatActionLogImpact(before, after = createActionLogImpactSnapshot(), options = {}) {
    if (!before || !after) return "";
    if (before.playerId && after.playerId && before.playerId !== after.playerId) return "";

    const groups = [];
    const detailText = normalizeActionLogText(options.detailText);
    const resourceEntries = createActionLogDeltaEntries(
      before.resources,
      after.resources,
      ACTION_LOG_RESOURCE_KEYS,
      INCOME_GAIN_LABELS,
    ).filter((entry) => !isActionLogDeltaRepresentedInDetail(detailText, entry));
    const resourceParts = resourceEntries.map((entry) => entry.text);
    if (resourceParts.length) groups.push(`资源：${resourceParts.join("、")}`);

    const incomeEntries = createActionLogDeltaEntries(
      before.income,
      after.income,
      ACTION_LOG_INCOME_KEYS,
      INCOME_GAIN_LABELS,
    ).filter((entry) => !isActionLogDeltaRepresentedInDetail(detailText, entry));
    const incomeParts = incomeEntries.map((entry) => entry.text);
    if (incomeParts.length) groups.push(`收入：${incomeParts.join("、")}`);

    const taskDelta = (Number(after.completedTaskCount) || 0) - (Number(before.completedTaskCount) || 0);
    if (taskDelta && !compactActionLogText(detailText).includes(`完成任务${formatSignedDelta(taskDelta)}`)) {
      groups.push(`完成任务${formatSignedDelta(taskDelta)}`);
    }

    return groups.join("；");
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
    return actionLogRuntimeModule.ensureDraft(actionLogState, {
      getCurrentPlayer,
      currentPlayerId: playerState.currentPlayerId,
      roundNumber: turnState.roundNumber,
      turnNumber: turnState.turnNumber,
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
      actionExecuted: pendingState.actionExecuted,
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
    return gameRecoveryModule.createGameRecoverySnapshot({
      version: GAME_RECOVERY_VERSION,
      roundNumber: turnState.roundNumber,
      turnNumber: turnState.turnNumber,
      actionCycleNumber: getActionCycleNumber(),
      currentPlayerId: playerState.currentPlayerId,
      entryId: meta.entryId ?? null,
      label: meta.label || null,
      state: {
        solarState: structuredClone(solarState),
        nebulaDataState: structuredClone(nebulaDataState),
        alienGameState: structuredClone(alienGameState),
        finalScoringState: structuredClone(finalScoringState),
        playerState: structuredClone(playerState),
        turnState: structuredClone(turnState),
        rocketState: structuredClone(rocketState),
        planetStatsState: structuredClone(planetStatsState),
        techGameState: structuredClone(techGameState),
        cardState: structuredClone(cardState),
        cardTaskState: structuredClone(cardTaskState),
        setupSelectionState: structuredClone(setupSelectionState),
      },
      runtime: {
        aiControl: createAiControlSnapshot(),
      },
    });
  }

  function attachRecoverySnapshotToActionLogEntry(entry, label = null) {
    if (!entry) return null;
    entry.recoverySnapshot = createGameRecoverySnapshot({
      entryId: entry.id,
      label: label || entry.actionLabel || entry.title || null,
    });
    return entry.recoverySnapshot;
  }

  function refreshLatestActionLogRecoverySnapshot(label = null) {
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
    return !pendingState.actionExecuted
      && !uiRuntimeState.effectStepActive
      && !pendingState.actionEffectFlow
      && !pendingState.alienRevealConfirmation
      && !pendingState.turnEndAfterRevealContinuation
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
    const snapshot = saved?.latestSnapshot || saved?.snapshot || null;
    if (!snapshot) return { ok: false, message: "没有可恢复的本地存档" };

    persistentGameSaveSuspended = true;
    try {
      if (Array.isArray(saved.entries)) {
        importActionLogEntries(saved.entries);
      }
      const result = applyGameRecoverySnapshot(snapshot, {
        message: "已恢复上次保存的局面",
      });
      if (!result.ok) {
        clearPersistentGameState();
        return result;
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
    return {
      generatedAt,
      isGameEnded: isGameEnded(),
      gameEndReason: turnState.gameEndReason || null,
      roundNumber: turnState.roundNumber,
      turnNumber: getDisplayedTurnNumber(),
      turnState: {
        ...structuredClone(turnState),
        displayedTurnNumber: getDisplayedTurnNumber(),
        currentPlayerId: playerState.currentPlayerId,
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
      rocketState.statusNote = result.message;
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
    rocketState.statusNote = result.message;
    renderStateReadout();
    return result;
  }

  function getRecoveryEntriesFromInput(logOrPackage) {
    return gameRecoveryModule.getRecoveryEntriesFromInput(logOrPackage);
  }

  function getRecoverySnapshotFromLog(logOrPackage, options = {}) {
    return gameRecoveryModule.getRecoverySnapshotFromLog(logOrPackage, options);
  }

  function clearTransientStateForRecovery() {
    pendingState.discardAction = null;
    pendingState.cardSelectionAction = null;
    pendingState.passReserveSelection = null;
    pendingState.passReserveSelectionDismissed = false;
    pendingState.scanTargetAction = null;
    pendingState.probeSectorScanAction = null;
    pendingState.publicScanQueue = null;
    pendingState.handScanAction = null;
    pendingState.alienTraceAction = null;
    pendingState.landTargetAction = null;
    pendingState.probeLocationRewardAction = null;
    pendingState.cardTriggerAction = null;
    pendingState.cardTriggerFreeMove = null;
    pendingState.type1TriggerEvents = [];
    pendingState.cardTaskCompletion = null;
    pendingState.jiuzheCardPlay = null;
    pendingState.jiuzheOpportunityOpen = false;
    pendingState.jiuzheOpportunityQueue = [];
    pendingState.yichangdianCardGain = null;
    pendingState.yichangdianCornerAction = null;
    pendingState.banrenmaCardGain = null;
    pendingState.banrenmaOpportunity = null;
    pendingState.banrenmaOpportunityQueue = [];
    pendingState.chongCardGain = null;
    pendingState.chongFossilChoice = null;
    pendingState.chongTaskCompletion = null;
    pendingState.amibaCardGain = null;
    pendingState.amibaSymbolChoice = null;
    pendingState.amibaTraceRemoval = null;
    pendingState.aomomoCardGain = null;
    pendingState.runezuCardGain = null;
    pendingState.runezuSymbolBranch = null;
    pendingState.runezuFaceSymbolPlacement = null;
    pendingState.alienTracePickerState = null;
    closeAlienRevealConfirmationOverlay();
    pendingState.turnEndAfterRevealContinuation = null;
    uiRuntimeState.debugAlienTraceModeActive = false;
    pendingState.actionExecuted = false;
    pendingState.passPlayerId = null;
    pendingState.actionEffectFlow = null;
    clearCompletedEffectFlowForUndo();
    pendingState.actionHasIrreversibleBarrier = false;
    pendingState.actionIrreversibleReason = null;
    uiRuntimeState.effectStepActive = false;
    uiRuntimeState.moveHighlightRocketId = null;
    pendingState.movePayment = null;
    pendingState.playCardSelection = null;
    pendingState.futureSpanPlayBeforePlayer = null;
    pendingState.handCardPlayAction = null;
    pendingState.cardCornerQuickAction = null;
    pendingState.cardCornerFreeMove = null;
    pendingState.dataPlaceAction = null;
    pendingState.industryAbility = null;
    pendingState.piratesRaidPlacement = null;
    pendingState.strategyPassiveSlotChoice = null;
    uiRuntimeState.industryFreeMoveState = null;
    historyStepOrder.length = 0;
    actionHistory.commitSession();
    quickActionHistory.commitSession();
    cards.setSelectionActive(cardState, false);
    cards.setPlayCardSelectionActive(cardState, false);
    cards.setDiscardSelectionActive(cardState, false, 0);
    if (techGameState?.ui) {
      techGameState.ui.industryBorrowMode = false;
    }
    tech.setTechSelectionActive(techGameState, false);
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

  function refreshAfterGameRecovery(message = "已从行动日志恢复局面") {
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
    rocketState.statusNote = message;
    refreshHelpers.refreshActionState({ includeStateReadout: true });
    renderActionLog();
  }

  function applyGameRecoverySnapshot(snapshot, options = {}) {
    return gameRecoveryModule.applyGameRecoverySnapshot(snapshot, {
      ...options,
      stateSlices: {
        solarState,
        nebulaDataState,
        alienGameState,
        finalScoringState,
        playerState,
        turnState,
        rocketState,
        planetStatsState,
        techGameState,
        cardState,
        cardTaskState,
        setupSelectionState,
      },
      restoreMutableObject,
      onAfterStateRestored: () => {
        getActionCycleNumber();
        clearTransientStateForRecovery();
      },
      restoreAiControlSnapshot,
      refreshAfterGameRecovery,
      getRecoveryMessage: () => rocketState.statusNote,
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
    if (entries.length && options.restoreLog !== false) {
      importActionLogEntries(entries, {
        truncateToEntryId: options.entryId,
        truncateToIndex: Number.isInteger(options.index) ? options.index : null,
      });
    }
    return applyGameRecoverySnapshot(snapshot, {
      message: options.message || "已根据行动日志恢复局面",
    });
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
    const entry = actionLogRuntimeModule.createConfirmedEntry(actionLogState, entryInput, {
      getCurrentPlayer,
      roundNumber: turnState.roundNumber,
      turnNumber: turnState.turnNumber,
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

  function getActionLogEntryTitle(entry) {
    return entry.title || `第${entry.roundNumber}轮 第${entry.turnNumber}回合`;
  }

  function formatActionLogIrreversibleSuffix(step) {
    const reason = normalizeActionLogText(step?.irreversibleReason);
    if (!reason) return "";
    const compactReason = compactActionLogText(reason);
    const targets = [step?.text, step?.detail, step?.label]
      .map(compactActionLogText)
      .filter(Boolean);
    const isDuplicate = targets.some((target) => (
      target === compactReason
      || target.endsWith(`：${compactReason}`)
      || target.endsWith(`:${compactReason}`)
    ));
    return isDuplicate ? "（不可撤销）" : `（不可撤销：${reason}）`;
  }

  function appendActionLogTextWithPlayedCard(container, text, playedCard) {
    const card = createActionLogPlayedCardSnapshot(playedCard);
    if (!card?.label) {
      container.append(document.createTextNode(text));
      return;
    }
    const matchIndex = text.indexOf(card.label);
    if (matchIndex < 0) {
      container.append(document.createTextNode(text));
      return;
    }
    if (matchIndex > 0) {
      container.append(document.createTextNode(text.slice(0, matchIndex)));
    }

    const cardNode = document.createElement("span");
    cardNode.className = "action-log-played-card";
    cardNode.tabIndex = 0;
    cardNode.setAttribute("role", "img");
    cardNode.setAttribute("aria-label", `打出卡牌：${card.label}`);

    const name = document.createElement("span");
    name.className = "action-log-played-card-name";
    name.textContent = card.label;

    attachCardHoverPreview(cardNode, card.src || players.CARD_BACK_SRC, card.label);
    cardNode.append(name);
    container.append(cardNode);

    const endIndex = matchIndex + card.label.length;
    if (endIndex < text.length) {
      container.append(document.createTextNode(text.slice(endIndex)));
    }
  }

  function getActionLogEntryMetaText(entry) {
    const playerLabel = entry.playerLabel || "未知玩家";
    const actionLabel = entry.actionLabel || "本回合行动";
    if (entry.actionType === "quick") return `${playerLabel} · 快速行动`;
    if (entry.actionType === "initialSelection") return `${playerLabel} · ${actionLabel}`;
    return `${playerLabel} · 主要行动：${actionLabel}`;
  }

  function getActionLogStepPrefix(step, displayIndex = null) {
    if (step?.source === HISTORY_SOURCE_MAIN) {
      return `效果${displayIndex || 1}`;
    }
    return ACTION_LOG_SOURCE_LABELS[step?.source] || "行动";
  }

  function createActionLogEffectTextNode(step, displayIndex = null) {
    const text = document.createElement("span");
    text.className = "action-log-effect-text";
    const sourceLabel = getActionLogStepPrefix(step, displayIndex);
    const line = `${sourceLabel}：${step.text}${formatActionLogIrreversibleSuffix(step)}`;
    appendActionLogTextWithPlayedCard(text, line, step.playedCard);
    return text;
  }

  function createActionLogEntryElement(entry) {
    const article = document.createElement("article");
    article.className = "action-log-entry";
    article.dataset.actionLogId = String(entry.id);

    const header = document.createElement("div");
    header.className = "action-log-entry-header";

    const title = document.createElement("div");
    title.className = "action-log-entry-title";
    title.textContent = getActionLogEntryTitle(entry);

    const sequence = document.createElement("div");
    sequence.className = "action-log-entry-sequence";
    sequence.textContent = `#${entry.id}`;

    const meta = document.createElement("div");
    meta.className = "action-log-entry-meta";
    meta.textContent = getActionLogEntryMetaText(entry);

    header.append(title, sequence, meta);

    const list = document.createElement("ol");
    list.className = "action-log-effects";
    let mainEffectIndex = 0;
    entry.steps.forEach((step, index) => {
      const item = document.createElement("li");
      item.className = `action-log-effect action-log-effect-${step.source || "main"}`;
      const isMainEffect = step.source === HISTORY_SOURCE_MAIN;
      const displayIndex = isMainEffect ? (mainEffectIndex += 1) : index + 1;

      const indexNode = document.createElement("span");
      indexNode.className = "action-log-effect-index";
      indexNode.textContent = String(index + 1);

      const text = createActionLogEffectTextNode(step, displayIndex);

      item.append(indexNode, text);
      list.append(item);
    });

    article.append(header, list);
    return article;
  }

  function renderActionLog() {
    if (uiRuntimeState.codexAiBatchSuppressReadoutRender) return;
    if (!els.actionLogReadout) return;
    const entries = actionLogState.entries;
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "action-log-empty";
      empty.textContent = "暂无已确认的行动。";
      els.actionLogReadout.replaceChildren(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "action-log-list";
    for (const entry of entries.slice().reverse()) {
      list.append(createActionLogEntryElement(entry));
    }
    els.actionLogReadout.replaceChildren(list);
  }

  function isDebugToolsEnabled() {
    return !els.appWrap?.classList.contains("debug-tools-disabled");
  }

  function isStateLogEnabled() {
    return !els.appWrap?.classList.contains("state-log-disabled");
  }

  function isWeakStartAiDifficulty(player) {
    return player?.aiDifficulty === AI_DIFFICULTY_WEAK_START;
  }

  function setReportTab(tab) {
    const stateLogEnabled = isStateLogEnabled();
    const nextTab = stateLogEnabled && tab !== "action" ? "state" : "action";
    actionLogState.activeReportTab = nextTab;
    const stateActive = nextTab === "state";
    if (els.stateLogTab) {
      els.stateLogTab.hidden = !stateLogEnabled;
      els.stateLogTab.setAttribute("aria-hidden", String(!stateLogEnabled));
    }
    els.stateLogTab?.classList.toggle("is-active", stateActive);
    els.actionLogTab?.classList.toggle("is-active", !stateActive);
    els.stateLogTab?.setAttribute("aria-selected", String(stateActive));
    els.actionLogTab?.setAttribute("aria-selected", String(!stateActive));
    if (els.stateReadout) els.stateReadout.hidden = !stateActive;
    if (els.actionLogReadout) els.actionLogReadout.hidden = stateActive;
    if (!stateActive) renderActionLog();
  }

  function isPlayerPassedThisRound(playerId) {
    return turnState.passedPlayerIds.includes(playerId);
  }

  function hasPlayerCompletedThisTurn(playerId) {
    return turnState.completedTurnPlayerIds.includes(playerId);
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
    return turnState.activePlayerIds.length > 0
      && turnState.activePlayerIds.every((playerId) => isPlayerPassedThisRound(playerId));
  }

  function isFinalRound() {
    return Number(turnState.roundNumber) >= FINAL_ROUND_NUMBER;
  }

  function isGameEnded() {
    return Boolean(turnState.gameEnded);
  }

  function buildFinalScoreSummaryLines() {
    return (playerState.players || [])
      .filter((player) => turnState.activePlayerIds.includes(player.id))
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

  function ensureTurnVisitedPlanetsByPlayerId() {
    if (!turnState.visitedPlanetsByPlayerId || typeof turnState.visitedPlanetsByPlayerId !== "object") {
      turnState.visitedPlanetsByPlayerId = {};
    }
    return turnState.visitedPlanetsByPlayerId;
  }

  function hasPlayerVisitedPlanetThisTurn(player, planetId) {
    const playerId = player?.id || player?.playerId || null;
    if (!playerId || !planetId) return false;
    return (ensureTurnVisitedPlanetsByPlayerId()[playerId] || []).includes(planetId);
  }

  function recordTurnVisitPlanetEvents(events = []) {
    const visitEvents = (events || []).filter((event) => event?.type === "visitPlanet" && event.planetId);
    if (!visitEvents.length) return null;
    const beforeVisits = structuredClone(turnState.visitedPlanetsByPlayerId || {});
    const visitsByPlayerId = ensureTurnVisitedPlanetsByPlayerId();
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
    if (els.roundStatusRound) {
      els.roundStatusRound.textContent = isGameEnded() ? "游戏结束" : `第 ${turnState.roundNumber} 轮`;
    }
    if (els.roundStatusTurn) {
      els.roundStatusTurn.textContent = isGameEnded() ? "终局计分" : `第 ${getDisplayedTurnNumber()} 回合`;
    }
  }

  function getTurnReadoutLines() {
    const orderLabels = turnState.turnOrderPlayerIds.map(getPlayerLabelById).join(" > ");
    const roundOrderLabels = getRoundOrderPlayerIds().map(getPlayerLabelById).join(" > ");
    const passedLabels = turnState.passedPlayerIds.map(getPlayerLabelById).join("、") || "无";
    const completedLabels = turnState.completedTurnPlayerIds.map(getPlayerLabelById).join("、") || "无";
    const agentLabels = (turnState.activePlayerIds || [])
      .map((playerId) => `${getPlayerLabelById(playerId)}=${getPlayerAgentLabel(playerId)}`)
      .join("、") || "无";

    return [
      "轮次状态",
      isGameEnded()
        ? `游戏结束：第${turnState.roundNumber}轮全员 PASS，进行终局计分`
        : `第${turnState.roundNumber}轮 第${getDisplayedTurnNumber()}回合`,
      `基础顺位 ${orderLabels || "无"}`,
      `本轮顺位 ${roundOrderLabels || "无"}`,
      `玩家代理 ${agentLabels}`,
      `本轮已 PASS ${passedLabels}`,
      `当前行动圈已行动 ${completedLabels}`,
    ];
  }

  function isCardSelectionActive() {
    return cards.isSelectionActive(cardState);
  }

  function isDiscardSelectionActive() {
    return cards.isDiscardSelectionActive(cardState);
  }

  function isPlayCardSelectionActive() {
    return cards.isPlayCardSelectionActive(cardState);
  }

  function allowsBlindDrawInSelection() {
    return pendingState.cardSelectionAction?.allowBlindDraw !== false;
  }


  function isPublicScanMultiSelectActive() {
    return isCardSelectionActive()
      && pendingState.cardSelectionAction?.type === "public_scan"
      && (pendingState.cardSelectionAction.maxSelectable ?? 1) > 1;
  }

  function isPublicCornerDiscardSelectionActive() {
    return isCardSelectionActive()
      && pendingState.cardSelectionAction?.type === "card_public_corner_discard";
  }

  function isPublicCardMultiSelectActive() {
    return isPublicScanMultiSelectActive() || isPublicCornerDiscardSelectionActive();
  }

  function getPublicCardMultiSelectMinSelectable(pending = pendingState.cardSelectionAction) {
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
    const count = pendingState.cardSelectionAction?.selectedSlots?.length || 0;
    const minSelectable = getPublicCardMultiSelectMinSelectable();
    els.publicScanConfirm.disabled = count < minSelectable;
    const label = pendingState.cardSelectionAction?.type === "card_public_corner_discard"
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
      || Boolean(pendingState.cardTriggerFreeMove)
      || Boolean(pendingState.cardCornerFreeMove)
      || Boolean(pendingState.actionEffectFlow?.freeMoveMode)
      || Boolean(pendingState.actionEffectFlow?.cardMoveEffect);
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
    if (isTechTilePickingActive() || techGameState?.ui?.industryBorrowMode) {
      return INTERACTION_FOCUS.TECH_PANEL;
    }
    if (pendingState.piratesRaidPlacement) return INTERACTION_FOCUS.PLAYER_BOARD;
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
    rocketState.statusNote = message || `${player?.colorLabel || "电脑玩家"}AI 正在自动行动`;
    scheduleAiAutoStepIfNeeded();
    renderStateReadout();
    return { ok: false, blocked: true, message: rocketState.statusNote };
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
    return solar.resolveVisibleContent(coordinate.x, coordinate.y, solarState)?.content || null;
  }

  function isAsteroidContent(content) {
    return content?.kind === solar.layout.CONTENT_KIND.ASTEROID;
  }

  function getRequiredMovePointsForUi(player, rocketId, deltaX, deltaY, options = {}) {
    const rocket = rocketState.rockets.find((item) => item.id === rocketId);
    const from = rocketActions.getRocketSectorCoordinate(rocket);
    if (!from) return 1;
    const fromContent = getSectorContentForMove(from);
    if (!options.ignoreAsteroidRestriction
      && isAsteroidContent(fromContent)
      && !players.playerOwnsTech(player, "orange2", turnState)) {
      return 2;
    }
    return 1;
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

  function getCrossedNeutralScoreTraceThresholds(beforeScore, afterScore) {
    const before = Number(beforeScore) || 0;
    const after = Number(afterScore) || 0;
    if (after <= before) return [];
    return (aliens.NEUTRAL_SCORE_TRACE_THRESHOLDS || [20, 30]).filter((threshold) => (
      before < Number(threshold)
      && after >= Number(threshold)
      && !aliens.getNeutralScoreTraceMark?.(alienGameState, threshold)
    ));
  }

  function recordNeutralScoreTraceRestore(beforeAlienState, history = null) {
    const command = historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复分数阈值中立首痕迹",
    );
    if (history === quickActionHistory) {
      recordQuickHistoryCommand(command);
    } else {
      recordHistoryCommand(command);
    }
  }

  function placeNeutralScoreTraceForThreshold(player, threshold, options = {}) {
    const activePlayerIds = new Set(getActivePlayers().map((item) => item.id));
    if (!player?.id || !activePlayerIds.has(player.id)) return null;
    const neutralColor = getNeutralScoreTraceColor();
    if (!neutralColor) return null;

    const beforeAlienState = structuredClone(alienGameState);
    const result = aliens.placeNeutralScoreTraceForThreshold?.(
      alienGameState,
      threshold,
      player,
      neutralColor,
    );
    if (!result?.ok) return result || null;

    recordNeutralScoreTraceRestore(beforeAlienState, options.history || null);
    renderAlienPanels();
    return result;
  }

  function handlePlayerScoreChanged(player, payload = {}, options = {}) {
    const thresholds = getCrossedNeutralScoreTraceThresholds(payload.beforeScore, payload.afterScore);
    const placed = [];
    for (const threshold of thresholds) {
      const result = placeNeutralScoreTraceForThreshold(player, threshold, options);
      if (result?.ok) placed.push(result);
    }
    return placed;
  }

  function recordNeutralScoreTracesFromScanResult(scanResult, history = null) {
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
    return handlePlayerScoreChanged(player, {
      gain: { score: scoreAwarded },
      beforeScore: afterScore - scoreAwarded,
      afterScore,
      scoreDelta: scoreAwarded,
    }, { history });
  }

  function recordNeutralScoreTracesFromAbilityResult(result, history = null) {
    const scanResults = [
      result,
      result?.payload?.industryLaunchScan,
    ].filter(Boolean);
    return scanResults.flatMap((scanResult) => (
      recordNeutralScoreTracesFromScanResult(scanResult, history)
    ));
  }

  function getAiFinalScoreFormulaPotential(formulaId) {
    switch (formulaId) {
      case "a1":
        return 2.6;
      case "a2":
        return 3.2;
      case "b1":
        return 3.6;
      case "b2":
        return 4;
      case "c1":
        return 3.4;
      case "c2":
        return 3.8;
      case "d1":
        return 5.2;
      case "d2":
        return 5.5;
      default:
        return 2;
    }
  }

  function scoreAiFinalScoreFormulaDemand(formulaId, demand = {}) {
    let value = aiNumber(demand.final) * 0.12;
    if (formulaId === "a1" || formulaId === "a2") {
      value += getAiMapDemand(demand.resources, "credits") * 0.08;
      value += getAiMapDemand(demand.resources, "energy") * 0.08;
      value += getAiMapDemand(demand.resources, "handSize") * 0.06;
      return applyAiStrategyWeight(value, "engine", 0.35);
    }
    if (formulaId === "b1") {
      value += sumAiDemandMap(demand.traceTypes) * 0.14;
      value += getAiMapDemand(demand.actions, "scan") * 0.08;
      return applyAiStrategyWeight(value, "scan", 0.35);
    }
    if (formulaId === "b2") {
      value += getAiMapDemand(demand.actions, "orbit") * 0.16;
      value += getAiMapDemand(demand.actions, "land") * 0.16;
      value += getAiMapDemand(demand.actions, "scan") * 0.12;
      value += sumAiDemandMap(demand.scanColors) * 0.08;
      return applyAiStrategyWeight(value, "orbitLand", 0.45);
    }
    if (formulaId === "c1" || formulaId === "c2") {
      value += aiNumber(demand.task) * 0.22;
      value += getAiMapDemand(demand.actions, "playCard") * 0.12;
      value = applyAiStrategyWeight(value, "task", 0.5);
      return applyAiStrategyWeight(value, "playCard", 0.25);
    }
    if (formulaId === "d1" || formulaId === "d2") {
      value += sumAiDemandMap(demand.techTypes) * 0.18;
      value += getAiMapDemand(demand.actions, "researchTech") * 0.18;
      return applyAiStrategyWeight(value, "tech", 0.55);
    }
    return value;
  }

  function getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand = {}) {
    if (!player || (formulaId !== "c1" && formulaId !== "c2")) return null;
    const countOpenTasks = (card) => {
      const model = cardEffects?.getCardModel?.(card) || null;
      const completed = new Set(card?.cardEffectState?.completedTaskIds || []);
      return (model?.tasks || []).filter((task) => task?.id && !completed.has(task.id)).length;
    };
    const reservedCards = Array.isArray(player.reservedCards) ? player.reservedCards : [];
    const hand = Array.isArray(player.hand) ? player.hand : [];
    const reservedTaskCount = reservedCards.reduce((total, card) => total + countOpenTasks(card), 0);
    const handTaskCount = hand.reduce((total, card) => total + countOpenTasks(card), 0);
    const type3Reserved = endGameScoring?.countType3Cards
      ? Math.max(0, Math.round(aiNumber(endGameScoring.countType3Cards(player, getCardTypeCode))))
      : reservedCards.reduce((total, card) => total + (Math.round(aiNumber(getCardTypeCode(card))) === 3 ? 1 : 0), 0);
    const type3InHand = hand.reduce((total, card) => (
      total + (Math.round(aiNumber(getCardTypeCode(card))) === 3 ? 1 : 0)
    ), 0);
    const currentBase = Math.max(0, Math.round(aiNumber(baseValue)));
    const completedTaskCount = Math.max(0, aiNumber(player.completedTaskCount));
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const taskDemand = aiNumber(demand.task) + getAiMapDemand(demand.actions, "playCard") * 0.8;
    const visibleTaskPipeline = reservedTaskCount + handTaskCount * 0.35;
    const visibleType3Pipeline = type3Reserved + type3InHand * 0.45;
    const cPipeline = formulaId === "c1"
      ? visibleTaskPipeline
      : visibleTaskPipeline + visibleType3Pipeline;
    const demandPipeline = Math.max(0, taskDemand) * (formulaId === "c1" ? 0.018 : 0.026);
    const pipelineScale = Math.min(1, Math.max(0, (cPipeline + demandPipeline) / (formulaId === "c1" ? 2.5 : 2)));
    const rawActionWindow = roundNumber >= FINAL_ROUND_NUMBER
      ? (formulaId === "c1" ? 0.35 : 0.85)
      : roundNumber === 3
        ? (formulaId === "c1" ? 0.75 : 1.45)
        : (formulaId === "c1" ? 1.15 : 2.1);
    const actionWindow = rawActionWindow * pipelineScale;
    const expectedNewTasks = Math.min(
      7,
      reservedTaskCount * (formulaId === "c1" ? 0.48 : 0.78)
        + handTaskCount * (formulaId === "c1" ? 0.18 : 0.34)
        + Math.max(0, taskDemand) * (formulaId === "c1" ? 0.018 : 0.034)
        + actionWindow,
    );
    const expectedNewType3 = formulaId === "c2"
      ? Math.min(
        4,
        type3InHand * (roundNumber >= FINAL_ROUND_NUMBER ? 0.42 : 0.68)
          + Math.max(0, taskDemand) * 0.012,
      )
      : 0;

    let projectedBase = currentBase;
    if (formulaId === "c1") {
      projectedBase = Math.max(
        currentBase,
        Math.floor(completedTaskCount + expectedNewTasks),
      );
    } else {
      projectedBase = Math.max(
        currentBase,
        Math.floor((
          completedTaskCount
          + type3Reserved
          + expectedNewTasks
          + expectedNewType3
        ) / 2),
      );
    }

    return {
      currentBase,
      completedTaskCount,
      reservedTaskCount,
      handTaskCount,
      type3Reserved,
      type3InHand,
      taskDemand,
      visibleTaskPipeline,
      visibleType3Pipeline,
      cPipeline,
      demandPipeline,
      pipelineScale,
      actionWindow,
      expectedNewTasks,
      expectedNewType3,
      projectedBase,
    };
  }

  function scoreAiFinalScoreFormulaGrowth(formulaId, player, slotIndex, baseValue, demand = {}) {
    if (!player || !endGameScoring?.getSlotMultiplier) return 0;
    if (!["c1", "c2", "d1", "d2"].includes(formulaId)) return 0;
    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));

    const remainingRounds = Math.max(1, aiNumber(getAiRemainingRoundWeight()));
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const currentBase = Math.max(0, Math.round(aiNumber(baseValue)));

    if (formulaId === "c1" || formulaId === "c2") {
      const cPipelineState = getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand);
      if (!cPipelineState) return 0;
      const {
        currentBase: pipelineCurrentBase,
        pipelineScale,
        expectedNewTasks,
        expectedNewType3,
        projectedBase,
      } = cPipelineState;
      if (currentBase <= 0 && pipelineScale < 0.12) return 0;
      const baseGain = Math.max(0, projectedBase - pipelineCurrentBase);
      if (baseGain <= 0 && currentBase > 0) return 0;
      const multiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, slot)));
      const growthValue = baseGain * multiplier;
      const firstSlotPremium = slot === 1 && roundNumber <= 3
        ? Math.min(
          formulaId === "c1" ? 5 : 9,
          (formulaId === "c2" ? 3.6 : 1.8) + expectedNewTasks * (formulaId === "c1" ? 0.38 : 0.65) + expectedNewType3 * 0.5,
        )
        : slot === 2 && roundNumber <= 3
          ? Math.min(formulaId === "c1" ? 2 : 3.5, expectedNewTasks * 0.28 + expectedNewType3 * 0.25)
          : 0;
      const zeroBaseFloor = currentBase <= 0 && roundNumber <= 3
        ? Math.min(
          formulaId === "c1" ? 1.4 : 3.2,
          (expectedNewTasks * (formulaId === "c1" ? 0.22 : 0.38) + expectedNewType3 * 0.28) * pipelineScale,
        )
        : 0;
      return Math.min(24, growthValue * (formulaId === "c1" ? 0.48 : 0.68) + firstSlotPremium + zeroBaseFloor);
    }

    if (!endGameScoring?.countOwnedTech) return 0;
    if (slot >= 3) return 0;
    const techCounts = ["orange", "purple", "blue"].map((techType) => (
      Math.max(0, Math.round(aiNumber(endGameScoring.countOwnedTech(player, techType))))
    ));
    const totalTech = techCounts.reduce((total, count) => total + count, 0);
    const hasCheatLab = player?.industryCard?.id === "industry:作弊实验室"
      || player?.industryCard?.label === "作弊实验室";
    const publicity = Math.max(0, aiNumber(player.resources?.publicity));
    const techDemand = sumAiDemandMap(demand.techTypes) + getAiMapDemand(demand.actions, "researchTech");
    const resourceBoost = publicity >= (hasCheatLab ? 4 : 6) ? 0.65 : publicity >= 3 ? 0.35 : 0;
    const demandBoost = Math.min(1.4, Math.max(0, techDemand) * 0.045);
    const expectedNewTech = Math.min(
      5,
      Math.max(0, (remainingRounds - 0.35) * (hasCheatLab ? 1.25 : 0.85) + resourceBoost + demandBoost),
    );
    if (expectedNewTech <= 0) return 0;

    let projectedBase = currentBase;
    if (formulaId === "d2") {
      projectedBase = Math.floor((totalTech + expectedNewTech) / 2);
    } else {
      const projected = [...techCounts].sort((left, right) => left - right);
      let remainingTech = expectedNewTech;
      while (remainingTech >= 1) {
        projected[0] += 1;
        projected.sort((left, right) => left - right);
        remainingTech -= 1;
      }
      projectedBase = projected[0];
    }

    const baseGain = Math.max(0, projectedBase - currentBase);
    if (baseGain <= 0 && currentBase > 0) return 0;

    const multiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, slot)));
    const growthValue = baseGain * multiplier;
    const firstSlotPremium = slot === 1 && roundNumber <= 3
      ? Math.min(8, (formulaId === "d2" ? 3.2 : 2.4) + expectedNewTech * 0.7)
      : 0;
    const zeroBaseFloor = currentBase <= 0 && roundNumber <= 3
      ? Math.min(4.5, expectedNewTech * (formulaId === "d2" ? 0.9 : 0.65))
      : 0;
    return Math.min(22, growthValue * 0.74 + firstSlotPremium + zeroBaseFloor);
  }

  function scoreAiWeakCFinalFormulaPenalty(formulaId, player, slotIndex, thresholdValue, baseValue, growthPotentialScore, demand = {}) {
    if (formulaId !== "c1" && formulaId !== "c2") return 0;
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const threshold = Math.max(0, aiNumber(thresholdValue));

    const cPipelineState = getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand);
    if (!cPipelineState) return 0;
    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    const currentBase = Math.max(0, cPipelineState.currentBase);
    const projectedBase = Math.max(currentBase, aiNumber(cPipelineState.projectedBase));
    const pipelineStrength = Math.max(0, cPipelineState.cPipeline + cPipelineState.demandPipeline);
    const earlySpeculativeWindow = threshold < 50 && roundNumber <= 2;
    if (earlySpeculativeWindow && currentBase > 0) return 0;
    const finalWindow = threshold >= 70 || roundNumber >= FINAL_ROUND_NUMBER;
    const lateWindowScale = finalWindow
      ? 1
      : threshold >= 50 || roundNumber >= 3
        ? 0.72
        : earlySpeculativeWindow
          ? (slot === 1 ? 0.55 : slot === 2 ? 0.32 : 0.22)
          : 0.38;
    if (lateWindowScale <= 0) return 0;

    const targetBase = earlySpeculativeWindow
      ? (formulaId === "c1"
        ? (slot === 1 ? 2.1 : slot === 2 ? 1.55 : 1.2)
        : (slot === 1 ? 1.65 : slot === 2 ? 1.25 : 1))
      : (formulaId === "c1"
        ? (slot === 1
          ? (finalWindow ? 4.5 : 4)
          : slot === 2
            ? (finalWindow ? 3.5 : 3)
            : (finalWindow ? 3 : 2.5))
        : (slot === 1
          ? (finalWindow ? 3.5 : 3)
          : slot === 2
            ? (finalWindow ? 3 : 2.5)
            : (finalWindow ? 2.4 : 2)));
    const realizedTarget = earlySpeculativeWindow
      ? (formulaId === "c1"
        ? (slot === 1 ? 0.9 : 0.7)
        : (slot === 1 ? 0.7 : 0.55))
      : (formulaId === "c1"
        ? (finalWindow ? 3 : 2.5)
        : (finalWindow ? 2.2 : 1.8));
    const shortfall = Math.max(0, targetBase - projectedBase);
    const realizedShortfall = Math.max(0, realizedTarget - currentBase);
    if (shortfall <= 0 && realizedShortfall <= 0) return 0;

    const weakPipelineLimit = earlySpeculativeWindow
      ? (formulaId === "c1" ? 0.9 : 0.75)
      : (formulaId === "c1"
        ? (finalWindow ? 1.8 : 1.35)
        : (finalWindow ? 1.45 : 1.1));
    let penalty = shortfall * (formulaId === "c1" ? 5.4 : 4.2) * lateWindowScale;
    penalty += realizedShortfall * (formulaId === "c1" ? 2.4 : 1.8) * lateWindowScale;

    if (pipelineStrength < weakPipelineLimit && currentBase < realizedTarget) {
      penalty += (formulaId === "c1" ? 5 : 3.5) * lateWindowScale;
    }
    if (finalWindow && currentBase <= (formulaId === "c1" ? 2 : 1) && projectedBase < targetBase) {
      penalty += (formulaId === "c1" ? 4 : 3) * lateWindowScale;
    }

    const growthValue = Math.max(0, aiNumber(growthPotentialScore));
    if (growthValue >= 6) penalty *= 0.48;
    else if (growthValue >= 4) penalty *= 0.65;
    else if (growthValue >= 2.5) penalty *= 0.82;

    if (slot >= 3) penalty *= 0.86;
    return Math.min(finalWindow ? 26 : 20, Math.max(0, penalty));
  }

  function getAiZeroBaseCFinalSpeculationScale(formulaId, player, slotIndex, thresholdValue, baseValue, demand = {}) {
    if (formulaId !== "c1" && formulaId !== "c2") return null;
    if (Math.max(0, aiNumber(baseValue)) > 0) return null;
    const cPipelineState = getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand);
    if (!cPipelineState) return null;

    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const threshold = Math.max(0, aiNumber(thresholdValue));
    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    const projectedBase = Math.max(0, aiNumber(cPipelineState.projectedBase));
    const cPipeline = Math.max(0, aiNumber(cPipelineState.cPipeline));
    const concretePipeline = Math.max(0,
      aiNumber(cPipelineState.completedTaskCount)
        + aiNumber(cPipelineState.reservedTaskCount)
        + aiNumber(cPipelineState.type3Reserved)
        + aiNumber(cPipelineState.handTaskCount) * 0.35
        + aiNumber(cPipelineState.type3InHand) * 0.3,
    );

    if (threshold <= 25 && roundNumber <= 2 && slot === 1) {
      const targetProjectedBase = formulaId === "c1" ? 2 : 2;
      if (projectedBase >= targetProjectedBase || concretePipeline >= targetProjectedBase + 0.35) return null;
      if (cPipeline >= (formulaId === "c1" ? 2 : 2.25)) return 0.34;
      if (cPipeline >= (formulaId === "c1" ? 1.25 : 1.35)) return 0.26;
      return 0.18;
    }

    if (threshold >= 50 || roundNumber >= 3) {
      if (projectedBase <= 0 && cPipeline < 1) return 0.08;
      if (projectedBase < (formulaId === "c1" ? 2 : 1) && cPipeline < 1.6) return 0.14;
    }

    return null;
  }

  function getAiB1FinalFormulaState(player) {
    const traceTypes = aliens?.TRACE_TYPES?.length ? aliens.TRACE_TYPES : ["yellow", "pink", "blue"];
    const counts = {};
    for (const traceType of traceTypes) {
      counts[traceType] = endGameScoring?.countTraceMarkers
        ? Math.max(0, Math.round(aiNumber(endGameScoring.countTraceMarkers(player, alienGameState, traceType))))
        : 0;
    }
    const values = traceTypes.map((traceType) => counts[traceType] || 0);
    const minTrace = values.length ? Math.min(...values) : 0;
    const totalTrace = values.reduce((total, count) => total + count, 0);
    const missingTypes = traceTypes.filter((traceType) => (counts[traceType] || 0) <= 0);
    return {
      counts,
      minTrace,
      totalTrace,
      missingTypes,
    };
  }

  function scoreAiB1FinalFormulaFeasibilityPenalty(
    formulaId,
    player,
    slotIndex,
    thresholdValue,
    baseValue,
    demand = {},
    b1State = null,
  ) {
    if (formulaId !== "b1" || !player) return 0;
    if (Math.max(0, aiNumber(baseValue)) > 0) return 0;

    const state = b1State || getAiB1FinalFormulaState(player);
    const missingTypes = state.missingTypes || [];
    if (!missingTypes.length) return 0;

    const threshold = Math.max(0, aiNumber(thresholdValue));
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    if (threshold < 50 && roundNumber <= 2) return 0;

    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    const totalTrace = Math.max(0, aiNumber(state.totalTrace));
    const allTraceDemand = sumAiDemandMap(demand.traceTypes);
    const missingTraceDemand = missingTypes.reduce((total, traceType) => (
      total + getAiMapDemand(demand.traceTypes, traceType)
    ), 0);
    const actionPipeline = getAiMapDemand(demand.actions, "analyze") * 0.45
      + getAiMapDemand(demand.actions, "land") * 0.32
      + getAiMapDemand(demand.actions, "scan") * 0.22
      + getAiMapDemand(demand.actions, "playCard") * 0.14;
    const tracePipeline = missingTraceDemand * 0.16 + allTraceDemand * 0.06 + actionPipeline;
    const lateScale = threshold >= 70 || roundNumber >= FINAL_ROUND_NUMBER
      ? 1.28
      : threshold >= 50 || roundNumber >= 3
        ? 1
        : 0.55;
    const slotScale = slot === 1 ? 1 : slot === 2 ? 0.82 : 0.62;
    let penalty = (
      5.8
      + missingTypes.length * 3
      + Math.max(0, 3 - totalTrace) * 0.85
    ) * lateScale * slotScale;

    if (threshold >= 70) penalty += 3 * lateScale;
    if (roundNumber >= FINAL_ROUND_NUMBER && missingTypes.length >= 2) penalty += 2.5 * lateScale;

    if (tracePipeline >= 5) penalty *= 0.58;
    else if (tracePipeline >= 3) penalty *= 0.74;
    else if (tracePipeline < 1.5) penalty += (1.5 - tracePipeline) * 1.4 * lateScale;

    return Math.round(Math.min(threshold >= 70 ? 26 : 18, Math.max(0, penalty)) * 100) / 100;
  }

  function getAiB2FinalFormulaState(player, context = {}) {
    if (!player || !endGameScoring) {
      return { orbitLandCount: 0, sectorWins: 0 };
    }
    return {
      orbitLandCount: endGameScoring.countOrbitOrLandMarkers
        ? Math.max(0, Math.round(aiNumber(endGameScoring.countOrbitOrLandMarkers(
          player,
          context.planetStatsState,
          context,
        ))))
        : 0,
      sectorWins: endGameScoring.countSectorWins
        ? Math.max(0, Math.round(aiNumber(endGameScoring.countSectorWins(
          player,
          context.nebulaDataState,
        ))))
        : 0,
    };
  }

  function scoreAiB2FinalFormulaFeasibilityPenalty(
    formulaId,
    player,
    slotIndex,
    thresholdValue,
    baseValue,
    demand = {},
    b2State = null,
  ) {
    if (formulaId !== "b2" || !player) return 0;
    if (Math.max(0, aiNumber(baseValue)) > 0) return 0;

    const state = b2State || getAiB2FinalFormulaState(player, createActionContext());
    const orbitLandCount = Math.max(0, aiNumber(state.orbitLandCount));
    const sectorWins = Math.max(0, aiNumber(state.sectorWins));
    const missingSectorSide = sectorWins <= 0;
    const missingOrbitLandSide = orbitLandCount <= 0;
    if (!missingSectorSide && !missingOrbitLandSide) return 0;

    const slot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    const threshold = Math.max(0, aiNumber(thresholdValue));
    const roundNumber = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1));
    const scanDemand = getAiMapDemand(demand.actions, "scan")
      + sumAiDemandMap(demand.scanColors) * 0.35
      + getAiMapDemand(demand.traceTypes, "pink") * 0.15
      + getAiMapDemand(demand.traceTypes, "blue") * 0.08;
    const routeDemand = getAiMapDemand(demand.actions, "orbit")
      + getAiMapDemand(demand.actions, "land")
      + getAiMapDemand(demand.actions, "move") * 0.35;
    const lateScale = threshold >= 70 || roundNumber >= FINAL_ROUND_NUMBER
      ? 1.35
      : threshold >= 50 || roundNumber >= 3
        ? 1.05
        : 0.82;
    const slotScale = slot === 1 ? 1 : slot === 2 ? 0.75 : 0.55;
    let penalty = 0;

    if (missingSectorSide) {
      const imbalance = Math.max(0, orbitLandCount - sectorWins);
      penalty += (7.5 + Math.min(6, imbalance * 1.35)) * lateScale * slotScale;
      if (scanDemand < 4) penalty += (4 - scanDemand) * 1.15 * lateScale;
      if (threshold <= 25 && roundNumber <= 2 && slot === 1 && routeDemand > scanDemand + 1) {
        penalty += 3.5;
      }
      if (threshold <= 25 && roundNumber <= 2 && scanDemand >= 7) {
        penalty *= 0.65;
      }
    }

    if (missingOrbitLandSide) {
      const movableRocketCount = typeof getMovableTokensForPlayer === "function"
        ? getMovableTokensForPlayer(player.id).length
        : 0;
      const routePipeline = routeDemand + movableRocketCount * 0.5;
      const imbalance = Math.max(0, sectorWins - orbitLandCount);
      penalty += (5.5 + Math.min(4, imbalance * 0.9)) * lateScale * slotScale;
      if (routePipeline < 3) penalty += (3 - routePipeline) * 0.9 * lateScale;
      if (threshold <= 25 && roundNumber <= 2 && routePipeline >= 6) {
        penalty *= 0.75;
      }
    }

    if (missingSectorSide && missingOrbitLandSide) penalty += 3 * lateScale;
    return Math.round(Math.min(threshold >= 50 ? 24 : 17, Math.max(0, penalty)) * 100) / 100;
  }

  function hasAiPlayerClaimedFinalThreshold(playerId, threshold) {
    if (!playerId) return false;
    return (finalScoring.listMarks?.(finalScoringState) || []).some((mark) => (
      mark?.playerId === playerId && Number(mark?.threshold) === Number(threshold)
    ));
  }

  const AI_B2_FINAL_TILE_RACE_SCORE_PER_ACTION = 8;
  const AI_B2_FINAL_TILE_RACE_OPPONENT_SCORE_WINDOW = 15;
  const AI_B2_FINAL_TILE_RACE_MAX_SCORE_ADJUSTMENT = 8;

  function scoreAiB2FinalTileRaceAdjustment(
    formulaId,
    slotIndex,
    opponentExpectedFirst,
    exclusiveValueAtRisk,
    weightedLegacyCompetitionScore,
    maxScoreAdjustment = 8,
  ) {
    const slot = Math.max(1, Math.round(Number(slotIndex) || 1));
    if (formulaId !== "b2" || slot >= 3 || !opponentExpectedFirst) return 0;
    const risk = Number(exclusiveValueAtRisk);
    const legacy = Number(weightedLegacyCompetitionScore);
    const cap = Math.max(0, Number(maxScoreAdjustment) || 0);
    const protectedValue = Math.min(cap, Number.isFinite(risk) ? Math.max(0, risk) : 0);
    return Math.min(
      cap,
      Math.max(0, protectedValue - (Number.isFinite(legacy) ? Math.max(0, legacy) : 0)),
    );
  }

  function getAiFinalTileRaceThresholds() {
    return Array.isArray(finalScoringState.thresholds) && finalScoringState.thresholds.length
      ? [...finalScoringState.thresholds]
      : [...(finalScoring.FINAL_SCORE_THRESHOLDS || [])];
  }

  function getAiFinalTileRaceTarget(player, options = {}) {
    if (!player) return null;
    const minimumThreshold = Math.max(0, aiNumber(options.minimumThreshold));
    const pending = (finalScoring.getPendingMarksForPlayer?.(finalScoringState, player.id) || [])
      .find((entry) => aiNumber(entry?.threshold) > minimumThreshold);
    if (pending) {
      return {
        threshold: aiNumber(pending.threshold),
        deficit: 0,
        pending: true,
      };
    }

    const score = Math.max(0, aiNumber(player.resources?.score));
    const threshold = getAiFinalTileRaceThresholds().find((entry) => (
      aiNumber(entry) > minimumThreshold
      && !hasAiPlayerClaimedFinalThreshold(player.id, entry)
    ));
    if (threshold == null) return null;
    return {
      threshold: aiNumber(threshold),
      deficit: Math.max(0, aiNumber(threshold) - score),
      pending: false,
    };
  }

  function estimateAiFinalTileRaceEta(target, orderAdjustment = 0) {
    if (!target) return Infinity;
    if (target.pending || aiNumber(target.deficit) <= 0) return 0;
    const actionCount = Math.max(
      1,
      Math.ceil(aiNumber(target.deficit) / AI_B2_FINAL_TILE_RACE_SCORE_PER_ACTION),
    );
    return Math.max(0, actionCount + aiNumber(orderAdjustment));
  }

  function getAiFinalTileRaceActionWindow(player) {
    if (!player?.id || !aiRaceModel?.buildActionWindowOrder) return [];
    const completedPlayerIds = [...(turnState.completedTurnPlayerIds || [])];
    if (!completedPlayerIds.some((playerId) => String(playerId) === String(player.id))) {
      completedPlayerIds.push(player.id);
    }
    return aiRaceModel.buildActionWindowOrder({
      ...turnState,
      completedTurnPlayerIds: completedPlayerIds,
    }, player.id);
  }

  function getAiB2FinalTileRaceBase(baseValue, b2State = null) {
    const currentBase = Math.max(0, aiNumber(baseValue));
    const orbitLandCount = Math.max(0, aiNumber(b2State?.orbitLandCount));
    const sectorWins = Math.max(0, aiNumber(b2State?.sectorWins));
    if (orbitLandCount === sectorWins) return Math.max(currentBase, orbitLandCount);
    const oneStepBase = orbitLandCount > sectorWins
      ? Math.min(orbitLandCount, sectorWins + 1)
      : Math.min(orbitLandCount + 1, sectorWins);
    return Math.max(currentBase, oneStepBase);
  }

  function buildAiB2FinalTileDeferRace(
    tileId,
    formulaId,
    slotIndex,
    player,
    pending,
    baseValue,
    b2State = null,
  ) {
    const currentSlot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    if (
      formulaId !== "b2"
      || currentSlot >= 3
      || !player?.id
      || !pending
      || !aiRaceModel?.estimateRaceOutcome
      || !endGameScoring?.getSlotMultiplier
    ) return null;

    const currentMultiplier = Math.max(
      0,
      aiNumber(endGameScoring.getSlotMultiplier(formulaId, currentSlot)),
    );
    const fallbackMultiplier = Math.max(
      0,
      aiNumber(endGameScoring.getSlotMultiplier(formulaId, currentSlot + 1)),
    );
    const multiplierGap = Math.max(0, currentMultiplier - fallbackMultiplier);
    if (multiplierGap <= 0) return null;

    const actionWindowOpponentIds = getAiFinalTileRaceActionWindow(player);
    const actionWindowIndexById = new Map(actionWindowOpponentIds.map((playerId, index) => (
      [String(playerId), index]
    )));
    const actorTarget = getAiFinalTileRaceTarget(player, {
      minimumThreshold: aiNumber(pending.threshold),
    });
    const actorEta = estimateAiFinalTileRaceEta(actorTarget);
    const activeIds = Array.isArray(turnState.activePlayerIds) && turnState.activePlayerIds.length
      ? turnState.activePlayerIds
      : playerState.players.map((entry) => entry.id).filter(Boolean);
    const activeIdSet = new Set(activeIds.map((playerId) => String(playerId)));
    const passedIdSet = new Set((turnState.passedPlayerIds || []).map((playerId) => String(playerId)));
    const opponentEtas = [];

    for (const opponent of playerState.players || []) {
      if (!opponent?.id || String(opponent.id) === String(player.id)) continue;
      if (activeIdSet.size && !activeIdSet.has(String(opponent.id))) continue;
      if (passedIdSet.has(String(opponent.id))) continue;
      if (finalScoring.hasPlayerMarkedTile?.(finalScoringState, tileId, opponent.id)) continue;

      const target = getAiFinalTileRaceTarget(opponent);
      if (!target) continue;
      if (!target.pending && aiNumber(target.deficit) > AI_B2_FINAL_TILE_RACE_OPPONENT_SCORE_WINDOW) continue;
      const actionWindowIndex = actionWindowIndexById.get(String(opponent.id));
      const actsBeforeActorNext = actionWindowIndex != null;
      const orderAdjustment = target.pending ? 0 : (actsBeforeActorNext ? -0.25 : 0.25);
      opponentEtas.push({
        playerId: opponent.id,
        eta: estimateAiFinalTileRaceEta(target, orderAdjustment),
        threshold: target.threshold,
        scoreDeficit: target.deficit,
        pending: target.pending,
        actionWindowIndex: actsBeforeActorNext ? actionWindowIndex : null,
        actsBeforeActorNext,
      });
    }

    const raceBase = getAiB2FinalTileRaceBase(baseValue, b2State);
    const exclusiveValue = raceBase * currentMultiplier;
    const fallbackValue = raceBase * fallbackMultiplier;
    const outcome = aiRaceModel.estimateRaceOutcome({
      actorEta,
      opponentEtas,
      reusableValue: 0,
      exclusiveValue,
      fallbackValue,
    });
    const opponentExpectedFirst = Boolean(outcome?.contested && !outcome?.actorWins);
    const protectedValue = opponentExpectedFirst
      ? Math.min(
        AI_B2_FINAL_TILE_RACE_MAX_SCORE_ADJUSTMENT,
        Math.max(0, aiNumber(outcome?.exclusiveValueAtRisk)),
      )
      : 0;

    return {
      tileId,
      formulaId,
      slotIndex: currentSlot,
      etaBasis: `public-score-deficit-per-${AI_B2_FINAL_TILE_RACE_SCORE_PER_ACTION}-points`,
      opponentScoreWindow: AI_B2_FINAL_TILE_RACE_OPPONENT_SCORE_WINDOW,
      actionWindowOpponentIds,
      actorTarget,
      actorEta: Number.isFinite(actorEta) ? actorEta : null,
      actorUnreachable: !Number.isFinite(actorEta),
      opponentEtas,
      outcome: outcome?.outcome || null,
      fastestOpponentEta: Number.isFinite(outcome?.fastestOpponentEta)
        ? outcome.fastestOpponentEta
        : null,
      fastestOpponentIds: outcome?.fastestOpponentIds || [],
      currentMultiplier,
      fallbackMultiplier,
      multiplierGap,
      raceBase,
      reusableValue: 0,
      exclusiveValue,
      fallbackValue,
      raceAdjustedValue: aiNumber(outcome?.raceAdjustedValue),
      exclusiveValueAtRisk: Math.max(0, aiNumber(outcome?.exclusiveValueAtRisk)),
      opponentExpectedFirst,
      protectedValue,
      maxScoreAdjustment: AI_B2_FINAL_TILE_RACE_MAX_SCORE_ADJUSTMENT,
    };
  }

  function scoreAiFinalScoreTileCompetition(tileId, formulaId, slotIndex, player, context) {
    if (!tileId || !formulaId || !player || !endGameScoring?.getSlotMultiplier) return 0;
    const currentSlot = Math.max(1, Math.round(aiNumber(slotIndex) || 1));
    if (currentSlot >= 3) return 0;
    const currentMultiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, currentSlot)));
    const nextMultiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, currentSlot + 1)));
    const multiplierGap = Math.max(0, currentMultiplier - nextMultiplier);
    if (multiplierGap <= 0) return 0;

    const thresholds = Array.isArray(finalScoringState.thresholds) && finalScoringState.thresholds.length
      ? finalScoringState.thresholds
      : finalScoring.FINAL_SCORE_THRESHOLDS || [];
    let score = 0;
    const activeIds = Array.isArray(turnState.activePlayerIds) && turnState.activePlayerIds.length
      ? turnState.activePlayerIds
      : playerState.players.map((entry) => entry.id).filter(Boolean);

    for (const opponentId of activeIds) {
      if (!opponentId || opponentId === player.id) continue;
      const opponent = getPlayerById(opponentId);
      if (!opponent) continue;
      if (finalScoring.hasPlayerMarkedTile?.(finalScoringState, tileId, opponent.id)) continue;

      const opponentScore = Math.max(0, aiNumber(opponent.resources?.score));
      const nextThreshold = thresholds.find((threshold) => (
        opponentScore < aiNumber(threshold)
        && !hasAiPlayerClaimedFinalThreshold(opponent.id, threshold)
      )) || null;
      const pendingCount = finalScoring.getPendingMarksForPlayer?.(finalScoringState, opponent.id)?.length || 0;
      let readiness = pendingCount > 0 ? 1.15 : 0;
      if (nextThreshold != null) {
        const deficit = Math.max(0, aiNumber(nextThreshold) - opponentScore);
        if (deficit <= 0) readiness = Math.max(readiness, 1.15);
        else if (deficit <= 8) readiness = Math.max(readiness, 0.75);
        else if (deficit <= 15 && Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1)) >= 3) {
          readiness = Math.max(readiness, 0.4);
        }
      }
      if (readiness <= 0) continue;

      const opponentBase = Math.max(0, aiNumber(endGameScoring.getFormulaBaseValue(
        formulaId,
        opponent,
        context,
        { getCardTypeCode },
      )));
      const formulaPotential = getAiFinalScoreFormulaPotential(formulaId);
      const immediateSwing = opponentBase * multiplierGap;
      const slotUrgency = currentSlot === 1 ? 5 : 2.2;
      score += readiness * Math.min(
        18,
        slotUrgency + immediateSwing * 0.45 + formulaPotential * 0.75,
      );
    }

    return score;
  }

  function getAiFinalScoreTileCandidate(tileId, player = getCurrentPlayer()) {
    if (!tileId || !player || !finalScoring?.canMarkTile || !endGameScoring?.getFormulaId) {
      return null;
    }
    const pending = finalScoring.getNextPendingMarkForPlayer(finalScoringState, player.id);
    if (!pending) return null;

    const check = finalScoring.canMarkTile(finalScoringState, tileId, player);
    if (!check.ok) {
      return {
        tileId,
        available: false,
        reason: check.message || "不可标记",
      };
    }

    const variant = finalScoring.getTileVariant(finalScoringState, tileId);
    const formulaId = endGameScoring.getFormulaId(tileId, variant);
    const context = {
      ...createActionContext(),
      finalScoringState,
      cardEffects,
      getCardTypeCode,
    };
    const baseValue = Math.max(0, aiNumber(endGameScoring.getFormulaBaseValue(
      formulaId,
      player,
      context,
      { getCardTypeCode },
    )));
    const multiplier = Math.max(0, aiNumber(endGameScoring.getSlotMultiplier(formulaId, check.slotIndex)));
    const immediateScore = baseValue * multiplier;
    const demand = getAiStrategyDemand(player);
    const demandScore = scoreAiFinalScoreFormulaDemand(formulaId, demand);
    const b1FormulaState = formulaId === "b1" ? getAiB1FinalFormulaState(player) : null;
    const b2FormulaState = formulaId === "b2" ? getAiB2FinalFormulaState(player, context) : null;
    const cFormulaPipeline = (formulaId === "c1" || formulaId === "c2")
      ? getAiFinalScoreCFormulaPipeline(formulaId, player, baseValue, demand)
      : null;
    const thresholds = Array.isArray(finalScoringState.thresholds) && finalScoringState.thresholds.length
      ? finalScoringState.thresholds
      : finalScoring.FINAL_SCORE_THRESHOLDS || [];
    const lastThreshold = Math.max(...thresholds.map((threshold) => aiNumber(threshold)));
    const isLastThreshold = aiNumber(pending.threshold) >= lastThreshold;
    const roundNumber = aiNumber(turnState.roundNumber);
    const thresholdValue = aiNumber(pending.threshold);
    const isLateMarker = isLastThreshold || roundNumber >= 4;
    const speculationScale = isLateMarker ? 0.35 : 1;
    const rawCurrentBaseSpeculationScale = baseValue > 0
      ? 1
      : (isLateMarker || thresholdValue >= 50)
        ? 0.18
        : roundNumber >= 3
          ? 0.1
          : 0.45;
    const zeroBaseCSpeculationScale = getAiZeroBaseCFinalSpeculationScale(
      formulaId,
      player,
      check.slotIndex,
      thresholdValue,
      baseValue,
      demand,
    );
    const currentBaseSpeculationScale = zeroBaseCSpeculationScale == null
      ? rawCurrentBaseSpeculationScale
      : Math.min(rawCurrentBaseSpeculationScale, zeroBaseCSpeculationScale);
    const effectiveSpeculationScale = speculationScale * currentBaseSpeculationScale;
    const secondSlotSpeculationScale = baseValue > 0
      ? Math.max(0.5, effectiveSpeculationScale)
      : Math.max(0.25, effectiveSpeculationScale);
    const immediateScoreWeight = isLateMarker ? 2.25 : 1;
    const remainingRoundWeight = Math.min(1.6, 0.7 + getAiRemainingRoundWeight() * 0.15);
    const formulaPotentialScore = getAiFinalScoreFormulaPotential(formulaId) * remainingRoundWeight * effectiveSpeculationScale;
    const incomePotentialScore = 0;
    const growthSpeculationFloor = (
      (formulaId === "c1" || formulaId === "c2")
      && baseValue <= 0
    )
      ? Math.max(0.08, currentBaseSpeculationScale)
      : 0.45;
    const growthPotentialScore = scoreAiFinalScoreFormulaGrowth(
      formulaId,
      player,
      check.slotIndex,
      baseValue,
      demand,
    ) * Math.max(growthSpeculationFloor, effectiveSpeculationScale);
    const potentialScore = formulaPotentialScore + incomePotentialScore + growthPotentialScore;
    const firstSlotPriorityScore = Number(check.slotIndex) === 1
      ? 14 * effectiveSpeculationScale
      : Number(check.slotIndex) === 2
        ? 3 * secondSlotSpeculationScale
        : 0;
    const familyPriorityScore = tileId === "c" || tileId === "d" ? 3.5 * effectiveSpeculationScale : 0;
    const activeOpponentCount = (turnState.activePlayerIds || [])
      .filter((playerId) => playerId && playerId !== player.id)
      .length;
    const competitiveSlotSwingScore = Number(check.slotIndex) === 1
      ? (8 + activeOpponentCount * 2.5 + Math.min(8, potentialScore * 0.85 + immediateScore * 0.18)) * effectiveSpeculationScale
      : Number(check.slotIndex) === 2
        ? (2 + activeOpponentCount * 0.8 + Math.min(3.5, potentialScore * 0.35)) * secondSlotSpeculationScale
        : 0;
    const opponentCompetitionScore = scoreAiFinalScoreTileCompetition(
      tileId,
      formulaId,
      check.slotIndex,
      player,
      context,
    ) * Math.max(0.35, effectiveSpeculationScale);
    const finalTileRace = buildAiB2FinalTileDeferRace(
      tileId,
      formulaId,
      check.slotIndex,
      player,
      pending,
      baseValue,
      b2FormulaState,
    );
    const slotPriorityScore = firstSlotPriorityScore
      + familyPriorityScore
      + competitiveSlotSwingScore
      + Math.max(0, 3 - Number(check.slotIndex || 3)) * 1.15
      + multiplier * 0.18;
    const thresholdScore = Math.max(0, aiNumber(pending.threshold)) * 0.015;
    const rawZeroBaseLatePenalty = aiValuation?.estimateFinalTileZeroBasePenalty
      ? aiValuation.estimateFinalTileZeroBasePenalty({
        formulaId,
        baseValue,
        threshold: thresholdValue,
        roundNumber,
        finalRoundNumber: FINAL_ROUND_NUMBER,
        slotIndex: check.slotIndex,
      })
      : 0;
    const zeroBaseLatePenalty = (
      (formulaId === "c1" || formulaId === "c2")
      && growthPotentialScore > 0
    )
      ? rawZeroBaseLatePenalty * (formulaId === "c1" ? 0.72 : 0.45)
      : rawZeroBaseLatePenalty;
    const unsupportedCFormulaPenalty = (
      (formulaId === "c1" || formulaId === "c2")
      && baseValue <= 0
      && growthPotentialScore < 1
    )
      ? (isLateMarker ? 18 : thresholdValue >= 50 ? 14 : 8)
      : 0;
    const weakCFormulaPenalty = scoreAiWeakCFinalFormulaPenalty(
      formulaId,
      player,
      check.slotIndex,
      thresholdValue,
      baseValue,
      growthPotentialScore,
      demand,
    );
    const b1FeasibilityPenalty = scoreAiB1FinalFormulaFeasibilityPenalty(
      formulaId,
      player,
      check.slotIndex,
      thresholdValue,
      baseValue,
      demand,
      b1FormulaState,
    );
    const b2FeasibilityPenalty = scoreAiB2FinalFormulaFeasibilityPenalty(
      formulaId,
      player,
      check.slotIndex,
      thresholdValue,
      baseValue,
      demand,
      b2FormulaState,
    );
    const weightedScore = applyAiStrategyWeight(
      immediateScore * immediateScoreWeight
        + demandScore
        + potentialScore
        + slotPriorityScore
        + opponentCompetitionScore
        + thresholdScore
        - zeroBaseLatePenalty
        - unsupportedCFormulaPenalty
        - weakCFormulaPenalty
        - b1FeasibilityPenalty
        - b2FeasibilityPenalty,
      "final",
      0.85,
    );
    const weightedLegacyCompetitionScore = applyAiStrategyWeight(
      opponentCompetitionScore,
      "final",
      0.85,
    );
    const finalTileRaceScoreAdjustment = scoreAiB2FinalTileRaceAdjustment(
      formulaId,
      check.slotIndex,
      finalTileRace?.opponentExpectedFirst,
      finalTileRace?.exclusiveValueAtRisk,
      weightedLegacyCompetitionScore,
      AI_B2_FINAL_TILE_RACE_MAX_SCORE_ADJUSTMENT,
    );
    const score = weightedScore + finalTileRaceScoreAdjustment;

    return {
      tileId,
      variant,
      formulaId,
      available: true,
      slotIndex: check.slotIndex,
      threshold: pending.threshold,
      baseValue,
      multiplier,
      immediateScore: Math.round(immediateScore * 100) / 100,
      score: Math.round(score * 100) / 100,
      scoreBreakdown: {
        immediateScore: Math.round(immediateScore * 100) / 100,
        immediateScoreWeight: Math.round(immediateScoreWeight * 100) / 100,
        demandScore: Math.round(demandScore * 100) / 100,
        potentialScore: Math.round(potentialScore * 100) / 100,
        formulaPotentialScore: Math.round(formulaPotentialScore * 100) / 100,
        incomePotentialScore: Math.round(incomePotentialScore * 100) / 100,
        growthPotentialScore: Math.round(growthPotentialScore * 100) / 100,
        speculationScale: Math.round(speculationScale * 100) / 100,
        rawCurrentBaseSpeculationScale: Math.round(rawCurrentBaseSpeculationScale * 100) / 100,
        zeroBaseCSpeculationScale: zeroBaseCSpeculationScale == null
          ? null
          : Math.round(zeroBaseCSpeculationScale * 100) / 100,
        currentBaseSpeculationScale: Math.round(currentBaseSpeculationScale * 100) / 100,
        effectiveSpeculationScale: Math.round(effectiveSpeculationScale * 100) / 100,
        slotPriorityScore: Math.round(slotPriorityScore * 100) / 100,
        firstSlotPriorityScore: Math.round(firstSlotPriorityScore * 100) / 100,
        familyPriorityScore: Math.round(familyPriorityScore * 100) / 100,
        competitiveSlotSwingScore: Math.round(competitiveSlotSwingScore * 100) / 100,
        opponentCompetitionScore: Math.round(opponentCompetitionScore * 100) / 100,
        weightedLegacyCompetitionScore: Math.round(weightedLegacyCompetitionScore * 100) / 100,
        finalTileRaceScoreAdjustment: Math.round(finalTileRaceScoreAdjustment * 100) / 100,
        finalTileRace,
        thresholdScore: Math.round(thresholdScore * 100) / 100,
        rawZeroBaseLatePenalty: Math.round(rawZeroBaseLatePenalty * 100) / 100,
        zeroBaseLatePenalty: Math.round(zeroBaseLatePenalty * 100) / 100,
        unsupportedCFormulaPenalty: Math.round(unsupportedCFormulaPenalty * 100) / 100,
        weakCFormulaPenalty: Math.round(weakCFormulaPenalty * 100) / 100,
        b1FeasibilityPenalty: Math.round(b1FeasibilityPenalty * 100) / 100,
        b1TraceCounts: b1FormulaState ? b1FormulaState.counts : null,
        b1MissingTraceTypes: b1FormulaState ? b1FormulaState.missingTypes : [],
        b2FeasibilityPenalty: Math.round(b2FeasibilityPenalty * 100) / 100,
        b2OrbitLandCount: b2FormulaState ? b2FormulaState.orbitLandCount : 0,
        b2SectorWins: b2FormulaState ? b2FormulaState.sectorWins : 0,
        cFormulaPipeline,
      },
    };
  }

  function listAiFinalScoreTileCandidates(player = getCurrentPlayer()) {
    return FINAL_SCORE_IDS
      .map((tileId) => getAiFinalScoreTileCandidate(tileId, player))
      .filter(Boolean)
      .sort((left, right) => (
        aiNumber(right.score) - aiNumber(left.score)
        || aiNumber(right.immediateScore) - aiNumber(left.immediateScore)
        || String(left.tileId).localeCompare(String(right.tileId))
      ));
  }

  function runAiFinalScoreMarkDecision() {
    syncFinalScorePendingMarks();
    const currentPlayer = getCurrentPlayer();
    const pending = finalScoring.getNextPendingMarkForPlayer(finalScoringState, currentPlayer?.id);
    if (!pending) return null;
    if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
      return {
        ok: false,
        blocked: true,
        message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工选择终局计分板块`,
      };
    }

    const candidates = listAiFinalScoreTileCandidates(currentPlayer);
    const selected = candidates.find((candidate) => candidate.available);
    if (!selected) {
      return {
        ok: false,
        blocked: true,
        message: `${currentPlayer.colorLabel}AI 没有可标记的终局计分板块`,
      };
    }

    const result = handleFinalScoreTileClick(selected.tileId);
    recordAiAutoBattleLog("final-score-mark", `${currentPlayer.colorLabel}AI 标记终局板块 ${selected.tileId.toUpperCase()}`, {
      pending,
      selected,
      candidates,
      mark: result.mark || null,
    });
    return result;
  }


  function setScanTargetPickerChrome(title, subtitle) {
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = title || "选择扫描目标";
    if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = subtitle || "";
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    els.scanTargetOverlay.hidden = false;
  }

  function makeDebugQuickSectorScanButton(step, label, description, dataset = {}, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scan-target-option-button";
    button.dataset.debugSectorScanStep = step;
    for (const [key, value] of Object.entries(dataset)) {
      button.dataset[key] = String(value);
    }
    button.disabled = Boolean(disabled);
    button.innerHTML = `${label}<small>${description || ""}</small>`;
    return button;
  }

  function renderDebugQuickSectorScanPlayerStep() {
    setScanTargetPickerChrome("快速扫描扇区", "选择要放置标记的玩家颜色。");
    els.scanTargetActions.replaceChildren(...playerState.players.map((player) => {
      const definition = players.getPlayerColorDefinition(player.color);
      return makeDebugQuickSectorScanButton(
        "player",
        `${definition?.label || player.color}玩家`,
        `后续替换的数据会使用${definition?.label || player.color}普通 token`,
        { playerId: player.id },
      );
    }));
  }

  function renderDebugQuickSectorScanSectorStep(playerId) {
    const player = playerState.players.find((item) => item.id === playerId) || null;
    if (!player) {
      renderDebugQuickSectorScanPlayerStep();
      return;
    }

    setScanTargetPickerChrome(
      "快速扫描扇区",
      `当前玩家：${player.colorLabel}。选择要批量扫描的具名扇区。`,
    );
    els.scanTargetActions.replaceChildren(...data.NEBULA_IDS.map((sectorId) => {
      const openCount = getSectorOpenDataCount(sectorId);
      const capacity = getSectorCapacity(sectorId);
      const extraCount = getSectorExtraMarkCount(sectorId);
      return makeDebugQuickSectorScanButton(
        "sector",
        getSectorNebulaLabelText(sectorId),
        `${sectorId}，标记 ${capacity - openCount + extraCount}/${capacity}`
          + (extraCount ? `（额外${extraCount}）` : ""),
        { playerId, sectorId },
      );
    }));
  }

  function renderDebugQuickSectorScanCountStep(playerId, sectorId) {
    const player = playerState.players.find((item) => item.id === playerId) || null;
    const openCount = getSectorOpenDataCount(sectorId);
    if (!player) {
      renderDebugQuickSectorScanSectorStep(playerId);
      return;
    }

    setScanTargetPickerChrome(
      "快速扫描扇区",
      `${player.colorLabel}玩家 -> ${getSectorNebulaLabelText(sectorId)}。未替换数据 ${openCount} 个；超过后追加额外标记且不获得数据。`,
    );
    const maxCount = Math.max(openCount, 0) + DEBUG_QUICK_SECTOR_SCAN_EXTRA_LIMIT;
    const countButtons = Array.from({ length: maxCount }, (_, index) => {
      const count = index + 1;
      const extraCount = Math.max(0, count - openCount);
      const description = extraCount
        ? `替换 ${Math.max(openCount, 0)} 个数据，并追加 ${extraCount} 个额外标记`
        : `替换 ${count} 个未替换数据`;
      return makeDebugQuickSectorScanButton(
        "count",
        count === openCount
          ? `${count}（填满）`
          : extraCount
            ? `${count}（填满+${extraCount}）`
            : String(count),
        description,
        { playerId, sectorId, count },
      );
    });
    els.scanTargetActions.replaceChildren(...countButtons);
  }

  function replaceNextSectorDataForDebugPlayer(sectorId, player) {
    const nextToken = data.getNextReplaceableNebulaToken(nebulaDataState, sectorId);
    if (nextToken) {
      return data.replaceNextNebulaDataToken(nebulaDataState, sectorId, player, {
        playerColor: player.color,
        playerLabel: player.colorLabel,
        playerTokenSrc: getNormalTokenAssetForPlayer(player),
        source: "debugQuickSectorScan",
      });
    }
    if (typeof data.addSectorExtraMark === "function") {
      return data.addSectorExtraMark(nebulaDataState, sectorId, player, {
        playerColor: player.color,
        playerLabel: player.colorLabel,
        playerTokenSrc: getNormalTokenAssetForPlayer(player),
        source: "debugQuickSectorScan",
      });
    }
    return { ok: false, message: `扇区${sectorId}没有可替换的数据` };
  }

  function runDebugQuickSectorScan(playerId, sectorId, count) {
    return debugRuntimeController.runDebugQuickSectorScan(playerId, sectorId, count);
  }

  function handleDebugQuickSectorScanChoice(button) {
    return debugRuntimeController.handleDebugQuickSectorScanChoice(button);
  }

  function openDebugQuickSectorScanPicker() {
    return debugRuntimeController.openDebugQuickSectorScanPicker();
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

  function confirmPublicCornerDiscardSelection() {
    const pending = pendingState.cardSelectionAction;
    if (pending?.type !== "card_public_corner_discard") {
      return { ok: false, message: "当前不是公共牌角标弃除" };
    }

    const selectedSlots = [...(pending.selectedSlots || [])].sort((a, b) => a - b);
    const minSelectable = getPublicCardMultiSelectMinSelectable(pending);
    if (selectedSlots.length < minSelectable) {
      const message = `请至少选择 ${minSelectable} 张公共牌`;
      rocketState.statusNote = message;
      renderStateReadout();
      return { ok: false, message };
    }

    const selectedCards = [];
    for (const slotIndex of selectedSlots) {
      const card = cardState.publicCards[slotIndex];
      if (!card) {
        rocketState.statusNote = "所选公共牌已不可用";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      selectedCards.push({ slotIndex, card });
    }

    const player = pending.player || getCurrentPlayer();
    if (!player) {
      rocketState.statusNote = "没有当前玩家";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const effect = pending.effect || getCurrentActionEffect() || { label: pending.effectLabel || "公共牌角标弃除" };
    const beforePlayer = pending.beforePlayerState || structuredClone(player);
    const beforeCardState = pending.beforeCardState || {
      publicCards: cardState.publicCards.slice(),
      discardPile: (cardState.discardPile || []).slice(),
    };

    pendingState.cardSelectionAction = null;
    cards.setSelectionActive(cardState, false);
    syncCardSelectionChrome();

    beginEffectHistoryStep(effect.label);

    const messages = [];
    const moveEffects = [];
    for (const { slotIndex, card } of selectedCards) {
      cardState.publicCards[slotIndex] = null;
      cards.addToDiscardPile(cardState, card);
      const reward = applyCardCornerRewardFromCard(player, card, {
        source: "public_corner_discard",
        insertMoveIntoCurrentFlow: false,
      });
      messages.push(`${cards.getCardLabel(card)}：${reward.message}`);
      if (reward.moveReward) {
        moveEffects.push(buildCardCornerMoveEffectFromReward(effect, card, reward.moveReward, moveEffects.length));
      }
    }

    if (moveEffects.length) insertActionEffectsAfterCurrent(moveEffects);

    recordHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      "恢复公共牌角标弃除前玩家状态",
    ));
    recordHistoryCommand(historyCommands.createRestorePublicCardsCommand(
      cardState,
      beforeCardState.publicCards,
      beforeCardState.discardPile,
    ));

    ensurePublicCardsFilledRespectingDelayedRefills();
    const replenishedCount = selectedCards
      .filter(({ slotIndex }) => cardState.publicCards[slotIndex])
      .length;
    const irreversible = replenishedCount > 0
      ? { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" }
      : null;
    if (irreversible) markCurrentActionIrreversible(irreversible.reason, irreversible.code);

    const message = `${effect.label}：弃除 ${selectedCards.length} 张公共牌；${messages.join("；")}`;
    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: !irreversible,
      irreversible,
      message,
      payload: {
        cards: selectedCards.map(({ card }) => card),
        replenishedCount,
      },
    }, [renderPlayerHand]);
  }


  function handlePublicCornerDiscardCardClick(slotIndex) {
    const index = Number(slotIndex);
    const card = cardState.publicCards[index];
    if (!card) {
      rocketState.statusNote = "该公共牌位没有卡牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const pending = pendingState.cardSelectionAction;
    const maxSelectable = pending?.maxSelectable ?? 1;
    const selectedSlots = pending.selectedSlots || [];
    const existingIndex = selectedSlots.indexOf(index);
    if (existingIndex >= 0) {
      selectedSlots.splice(existingIndex, 1);
    } else if (selectedSlots.length >= maxSelectable) {
      rocketState.statusNote = `最多选择 ${maxSelectable} 张公共牌`;
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    } else {
      selectedSlots.push(index);
    }

    pending.selectedSlots = selectedSlots;
    const count = selectedSlots.length;
    const minSelectable = getPublicCardMultiSelectMinSelectable(pending);
    rocketState.statusNote = count > 0
      ? `公共牌角标：已选 ${count}/${maxSelectable} 张${count < minSelectable ? `，至少需要 ${minSelectable} 张` : "，点击确认弃除"}`
      : `公共牌角标：请选择 ${minSelectable} 张公共牌弃除`;
    syncPublicScanConfirmButton();
    renderPublicCards();
    renderStateReadout();
    return { ok: true, message: rocketState.statusNote };
  }


  function isActionEffectFlowActive() {
    return pendingState.actionEffectFlow != null;
  }

  function isInitialIncomeFlowActive() {
    return pendingState.actionEffectFlow?.actionType === "initialIncome";
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

  function blockIncompatiblePendingQuickAction(actionType) {
    if (actionType !== "card-corner" && pendingState.cardCornerQuickAction) {
      cancelCardCornerQuickAction({ silent: true });
    }
    if (pendingState.handCardPlayAction) {
      cancelHandCardPlayAction({ silent: true });
    }
    if (hasActivePendingSubFlow()) {
      rocketState.statusNote = pendingState.industryAbility || uiRuntimeState.industryFreeMoveState || isIndustryHandSelectionActive()
        ? "请先完成或取消公司 1x 行动"
        : "请先完成或取消当前流程";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    return null;
  }

  function recordPlayCardStart(player, card, beforePlayer, beforeCardState, beforeAlienState = null) {
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
      cardState,
      beforeCardState.publicCards,
      beforeCardState.discardPile,
    ));
    if (beforeAlienState) {
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
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


  function executeFreeMoveForCardCorner(deltaX, deltaY, rocketId, payment = {}) {
    const pending = pendingState.cardCornerFreeMove;
    if (!pending) return { ok: false, message: "没有待结算的弃牌移动" };

    const moveCheck = rocketActions.canMoveRocket(rocketState, rocketId, deltaX, deltaY);
    if (!moveCheck.ok) {
      rocketState.statusNote = moveCheck.message;
      renderStateReadout();
      return moveCheck;
    }

    const currentPlayer = getCurrentPlayer();
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
    const result = abilities.executeAbility("moveProbe", createActionContext(), {
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
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    const recordInCurrentIndustryStep = Boolean(pending.industryQuickStepActive && pendingState.industryAbility);
    if (!recordInCurrentIndustryStep) {
      beginQuickActionStep("card-corner-move", `卡牌快速行动：${pending.action.label}`);
    }
    if (payment.discardCommand) recordQuickHistoryCommand(payment.discardCommand);
    recordAbilityCommands(result, quickActionHistory);
    if (!recordInCurrentIndustryStep) {
      completeQuickActionStep();
    }

    pendingState.cardCornerFreeMove = null;
    rocketState.activeRocketId = null;
    clearMoveRocketHighlight();
    deactivateMoveMode();
    rocketState.statusNote = `卡牌快速行动：${pending.discardedCardLabel} ${pending.action.label}，${result.message}`;
    const finishIndustryAfterMove = Boolean(pending.finishIndustryFlowAfterMove);
    const industryFinishMessage = pending.afterMoveStatus || rocketState.statusNote;
    settleCardTasksAfterEffect({ events: [...(result.events || []), ...(pending.deferredEvents || [])], render: false });
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

  function getActionResultOwnerPlayer(result, fallbackPlayer = null) {
    const ownerEvent = (result?.events || []).find((event) => event?.playerId || event?.playerColor) || null;
    return resolvePlayerReference({
      playerId: result?.playerId || result?.payload?.playerId || ownerEvent?.playerId || null,
      playerColor: result?.playerColor || result?.payload?.playerColor || ownerEvent?.playerColor || null,
    }) || fallbackPlayer || getCurrentPlayer();
  }

  function claimRunezuPlanetSymbolForTravelResult(actionType, result, fallbackPlayer = null) {
    if (actionType !== "orbit" && actionType !== "land") return null;
    const planetId = result?.planetId || result?.payload?.planetId || null;
    if (!planetId) return null;
    const actionLabel = actionType === "orbit" ? "环绕" : "登陆";
    const claim = claimRunezuSourceSymbolWithHistory(
      "planet",
      planetId,
      getActionResultOwnerPlayer(result, fallbackPlayer),
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

  function startPlanetRewardEffectFlow(actionType, result) {
    const actionOwner = getActionResultOwnerPlayer(result);
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
    recordAbilityCommands(result);
    const runezuClaim = claimRunezuPlanetSymbolForTravelResult(actionType, result, actionOwner);
    if (runezuClaim?.ok) renderRunezuBoardSymbols();
    endEffectHistoryStep();

    pendingState.actionEffectFlow = abilities.chain.startAbilityChain(
      `${actionType}-rewards`,
      `${actionLabel}奖励`,
      rewardEffects,
    );
    pendingState.actionEffectFlow.actionType = actionType;
    pendingState.actionEffectFlow.playerId = actionOwner?.id || null;
    assignEffectFlowOwner(pendingState.actionEffectFlow, pendingState.actionEffectFlow.playerId);
    pendingState.actionEffectFlow.consumesMainAction = true;
    pendingState.actionEffectFlow.autoExecuteAomomoRewards = isAomomoRewardFlow;

    els.appWrap?.classList.toggle("action-effect-flow-active", true);
    rocketState.statusNote = `${actionLabel}：请依次点击奖励效果`;
    activateNextActionEffect();
    return true;
  }

  function shouldAutoExecuteAomomoRewardEffect(effect) {
    return Boolean(
      pendingState.actionEffectFlow?.autoExecuteAomomoRewards
      && effect?.status === "active"
      && AOMOMO_AUTO_REWARD_EFFECT_TYPES.has(effect.type)
      && !hasActiveEffectSubFlow()
    );
  }

  function maybeAutoExecuteAomomoRewardEffects() {
    if (uiRuntimeState.autoExecutingActionEffects || !pendingState.actionEffectFlow?.autoExecuteAomomoRewards) return false;
    uiRuntimeState.autoExecutingActionEffects = true;
    let executed = false;
    try {
      for (let guard = 0; guard < 20; guard += 1) {
        const effect = getCurrentActionEffect();
        if (!shouldAutoExecuteAomomoRewardEffect(effect)) return executed;
        const result = executeActionEffect(effect);
        executed = true;
        if (result?.awaitingChoice || result?.pendingChoice || result?.ok === false) return executed;
        if (!pendingState.actionEffectFlow || pendingState.actionEffectFlow.completed || hasActiveEffectSubFlow()) return executed;
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

  function startResearchTechEffectFlow(result, options = {}) {
    if (!result?.ok || !result.awaitingTileSelection) return false;

    beginResearchTechActionSession(result, options);
    pendingState.actionEffectFlow = abilities.chain.startAbilityChain(
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
    pendingState.actionEffectFlow.actionType = "researchTech";
    pendingState.actionEffectFlow.playerId = getCurrentPlayer()?.id || null;
    pendingState.actionEffectFlow.historySource = HISTORY_SOURCE_MAIN;
    assignEffectFlowOwner(pendingState.actionEffectFlow, pendingState.actionEffectFlow.playerId);
    pendingState.actionEffectFlow.consumesMainAction = true;

    els.appWrap?.classList.toggle("action-effect-flow-active", true);
    rocketState.statusNote = "科技：请选择要研究的科技片";
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

  function applyPendingPlaceDataBonus(player, bonus) {
    if (bonus.type === "income") {
      const incomeStart = beginDiscardSelection(1, {
        type: "place_data_income",
        player,
        beforePlayerState: structuredClone(player),
        beforeCardState: structuredClone(cardState),
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
        beforeCardState: structuredClone(cardState),
      });
      if (!selectionStart.ok) {
        completeQuickActionStep();
        return { ok: false, pendingIncome: false, message: selectionStart.message };
      }
      return { ok: true, pendingIncome: false, pendingCardSelection: true };
    }

    return { ok: true, pendingIncome: false };
  }

  function applyPlaceDataSlotBonus(player, placeResult) {
    const bonuses = getPlaceDataSlotBonuses(placeResult);
    if (!bonuses.length) {
      completeQuickActionStep();
      return { ok: true, pendingIncome: false };
    }

    const autoMessages = [];
    for (const bonus of bonuses) {
      if (bonus.type === "income" || bonus.type === "choose_card") {
        const pendingResult = applyPendingPlaceDataBonus(player, bonus);
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

  function recordPlaceDataActionHistory(player, placeResult) {
    beginQuickActionStep("place-data", "放置数据");
    recordAbilityCommands(placeResult, quickActionHistory);
    return applyPlaceDataSlotBonus(player, placeResult);
  }

  function recordMoveActionHistory(moveResult, paymentCommand = null) {
    beginQuickActionStep("move", "移动");
    if (paymentCommand) {
      recordQuickHistoryCommand(paymentCommand);
    }
    recordAbilityCommands(moveResult, quickActionHistory);
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
    if (message) rocketState.statusNote = message;
    refreshHelpers.refreshActionState({ includeQuickPanel: false, includeStateReadout: true });
  }

  function revertEffectFlowAfterUndo(step) {
    if (!pendingState.actionEffectFlow || !step) return;

    if (isMainActionOpeningStep(step)) {
      if (pendingState.actionEffectFlow.actionType === "researchTech") {
        clearResearchTechSelectionState();
      }
      clearActionEffectFlow();
      return;
    }

    if (!Number.isInteger(step.effectIndex)) return;

    const { effects } = pendingState.actionEffectFlow;
    const effect = effects[step.effectIndex];
    if (!effect) return;

    pruneEndOfFlowSettlementEffectsAfterUndo(pendingState.actionEffectFlow, step.effectIndex);
    abilities.chain.removeInsertedNodesBySource?.(pendingState.actionEffectFlow, {
      chainId: pendingState.actionEffectFlow.chainId || null,
      effectId: step.effectId || effect.id || null,
      effectIndex: step.effectIndex,
      effectType: step.effectType || effect.type || null,
    });
    pendingState.actionEffectFlow.completed = false;
    effect.status = "active";
    effect.result = null;
    effect.preHistoryCommandsApplied = false;
    pendingState.actionEffectFlow.currentIndex = step.effectIndex;
    for (let index = step.effectIndex + 1; index < effects.length; index += 1) {
      if (effects[index].status !== "pending") {
        effects[index].status = "pending";
      }
      effects[index].preHistoryCommandsApplied = false;
    }
    cancelActiveEffectSubFlows();
    if (pendingState.actionEffectFlow.actionType === "researchTech" && effect.type === "research_tech_select") {
      restoreResearchTechSelectionAfterUndo(effect);
    }
    els.appWrap?.classList.toggle("action-effect-flow-active", true);
  }

  function hasActiveEffectSubFlow() {
    return Boolean(
      pendingState.scanTargetAction
      || pendingState.probeSectorScanAction
      || pendingState.probeLocationRewardAction
      || pendingState.publicScanQueue
      || pendingState.handScanAction
      || pendingState.passReserveSelection
      || (isCardSelectionActive() && (pendingState.actionEffectFlow || isCardTriggerPickSelectionActive()))
      || pendingState.cardTriggerAction
      || pendingState.cardTaskCompletion
      || (pendingState.jiuzheCardPlay && pendingState.jiuzheCardPlay.reason !== "view")
      || pendingState.yichangdianCardGain
      || pendingState.yichangdianCornerAction
      || pendingState.banrenmaCardGain
      || pendingState.banrenmaOpportunity
      || pendingState.chongTaskCompletion
      || pendingState.chongCardGain
      || pendingState.chongFossilChoice
      || pendingState.amibaCardGain
      || pendingState.amibaSymbolChoice
      || pendingState.amibaTraceRemoval
      || pendingState.aomomoCardGain
      || pendingState.runezuCardGain
      || pendingState.runezuSymbolBranch
      || pendingState.runezuFaceSymbolPlacement
      || pendingState.strategyPassiveSlotChoice
      || pendingState.piratesRaidPlacement
      || pendingState.cardTriggerFreeMove
      || pendingState.cardCornerFreeMove
      || (els.scanAction4Overlay && !els.scanAction4Overlay.hidden)
      || (els.landTargetOverlay && !els.landTargetOverlay.hidden)
      || (els.alienTraceOverlay && !els.alienTraceOverlay.hidden && pendingState.alienTracePickerState?.mode !== "reveal-confirm")
      || pendingState.actionEffectFlow?.cardMoveEffect
      || pendingState.actionEffectFlow?.freeMoveMode
      || Boolean(pendingState.dataPlaceAction),
    );
  }

  function hasActivePendingSubFlow() {
    return hasActiveEffectSubFlow()
      || isMovePaymentSelectionActive()
      || (els.dataPlaceOverlay && !els.dataPlaceOverlay.hidden)
      || Boolean(pendingState.industryAbility)
      || Boolean(uiRuntimeState.industryFreeMoveState)
      || isIndustryHandSelectionActive();
  }

  function cancelActivePendingSubFlows() {
    if (pendingState.scanTargetAction?.type === "industry_remove_tech") {
      rollbackPendingIndustryQuickAction("已取消公司 1x 行动");
      return true;
    }
    if (pendingState.strategyPassiveSlotChoice) {
      cancelStrategyPassiveSlotChoice();
      return true;
    }
    if (pendingState.cardCornerFreeMove?.finishIndustryFlowAfterMove) {
      const pending = pendingState.cardCornerFreeMove;
      pendingState.cardCornerFreeMove = null;
      rocketState.activeRocketId = null;
      clearMoveRocketHighlight();
      deactivateMoveMode();
      const message = `${pending.afterMoveStatus || "公司 1x 行动"}；已取消免费移动`;
      if (pendingState.industryAbility) {
        finishIndustryAbilityFlow(message);
      }
      if (pending.irreversibleIndustryFlow) {
        commitIrreversibleIndustryQuickAction(
          pending.industryLogLabel || pending.action?.label || "公司 1x 行动",
          message,
        );
      }
      rocketState.statusNote = message;
      renderPlayerStats();
      renderPublicCards();
      renderPlayerHand();
      updateActionButtons();
      renderStateReadout();
      return true;
    }
    if (hasActiveEffectSubFlow()) {
      cancelActiveEffectSubFlows();
      return true;
    }
    if (isMovePaymentSelectionActive()) {
      cancelMovePaymentSelection();
      return true;
    }
    if (els.dataPlaceOverlay && !els.dataPlaceOverlay.hidden) {
      if (pendingState.dataPlaceAction) {
        cancelDataPlacePicker();
        return true;
      }
      closeDataPlacePicker();
      rocketState.statusNote = "已取消放置数据";
      return true;
    }
    if (pendingState.industryAbility || uiRuntimeState.industryFreeMoveState || isIndustryHandSelectionActive()) {
      rollbackPendingIndustryQuickAction("已取消公司 1x 行动");
      return true;
    }
    return false;
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
    if (pendingState.actionEffectFlow?.actionType !== "initialIncome") return true;
    const owner = getEffectOwnerPlayer(effect);
    return !owner?.id || !isAiAutoBattlePlayer(owner.id);
  }

  function getPlanetSectorCoordinate(planetId) {
    const snapshot = solar.createSolarSnapshot(solarState);
    const planet = snapshot.planetLocations.find((item) => item.planetId === planetId);
    if (!planet) {
      throw new Error(`${planetId} position was not found in the current solar snapshot`);
    }
    return { x: planet.x, y: planet.y };
  }

  function getRocketCurrentPlanetId(rocketId) {
    const rocket = rocketState.rockets.find((item) => Number(item.id) === Number(rocketId));
    const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
    if (!coordinate) return null;
    const snapshot = solar.createSolarSnapshot(solarState);
    const planet = snapshot.planetLocations.find((item) => (
      Number(item.x) === Number(coordinate.x) && Number(item.y) === Number(coordinate.y)
    ));
    return planet?.planetId || null;
  }

  function listReadyChongTransportCandidates(player, task) {
    if (!chong?.listActiveTransports || task?.kind !== "transport") return [];
    return chong.listActiveTransports(alienGameState, player)
      .map((transport) => {
        const currentPlanetId = getRocketCurrentPlanetId(transport.rocketId);
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

  function buildSectorScanChoicesForXs(sectorXs) {
    return (sectorXs || []).flatMap((x) => buildSectorScanChoicesForX(x));
  }

  function clearActionEffectFlow() {
    pendingState.actionEffectFlow = null;
    closeLandTargetPicker();
    closeScanAction4Picker();
    renderActionEffectBar();
    els.appWrap?.classList.toggle("action-effect-flow-active", false);
    renderReservedCardsFromTaskState();
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

  function cancelActiveEffectSubFlows() {
    if (!pendingState.publicScanQueue) {
      closeScanTargetPicker({ forceYichangdianCornerClose: true });
    }
    if (els.landTargetOverlay && !els.landTargetOverlay.hidden) {
      cancelLandTargetPicker();
    }
    closeScanAction4Picker();
    closeAlienTracePicker();
    pendingState.publicScanQueue = null;

    if (isHandScanSelectionActive()) {
      pendingState.handScanAction = null;
      syncHandScanSelectionChrome();
    }

    if (isCardSelectionActive() && (pendingState.actionEffectFlow || isCardTriggerPickSelectionActive())) {
      if (pendingState.cardSelectionAction?.type === "fundamentalism_exchange_pick") {
        if (pendingState.cardSelectionAction.player && pendingState.cardSelectionAction.beforePlayerState) {
          restoreObjectSnapshot(pendingState.cardSelectionAction.player, pendingState.cardSelectionAction.beforePlayerState);
        }
        if (pendingState.cardSelectionAction.beforeCardState) {
          restoreObjectSnapshot(cardState, pendingState.cardSelectionAction.beforeCardState);
        }
      }
      pendingState.cardSelectionAction = null;
      cards.setSelectionActive(cardState, false);
      syncCardSelectionChrome();
    }

    if (pendingState.passReserveSelection) {
      pendingState.passReserveSelection = null;
      pendingState.passReserveSelectionDismissed = false;
      syncPassReserveSelectionChrome();
    }

    if (pendingState.actionEffectFlow?.freeMoveMode) {
      pendingState.actionEffectFlow.freeMoveMode = false;
      deactivateMoveMode();
    }
    if (pendingState.actionEffectFlow?.cardMoveEffect) {
      pendingState.actionEffectFlow.cardMoveEffect = null;
      deactivateMoveMode();
    }
    if (pendingState.dataPlaceAction) {
      closeDataPlacePicker();
    }
    pendingState.cardTriggerAction = null;
    pendingState.cardTaskCompletion = null;
    pendingState.cardTriggerFreeMove = null;
    pendingState.type1TriggerEvents = [];
    pendingState.cardCornerFreeMove = null;
    pendingState.yichangdianCornerAction = null;
    pendingState.chongCardGain = null;
    pendingState.chongFossilChoice = null;
    pendingState.chongTaskCompletion = null;
    pendingState.amibaCardGain = null;
    pendingState.amibaSymbolChoice = null;
    pendingState.amibaTraceRemoval = null;
    pendingState.aomomoCardGain = null;
    pendingState.runezuCardGain = null;
    pendingState.runezuSymbolBranch = null;
    pendingState.runezuFaceSymbolPlacement = null;
    pendingState.strategyPassiveSlotChoice = null;
    if (pendingState.piratesRaidPlacement) {
      pendingState.piratesRaidPlacement = null;
      renderTechBoard();
    }
  }

  function cleanupSkippedActionEffect(effect) {
    if (effect?.type === "industry_strategy_passive_reward") {
      const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      industry?.clearStrategyPlayInteraction?.(player);
      renderInitialSelectionArea();
    }
  }

  function skipCurrentActionEffect() {
    if (!pendingState.actionEffectFlow) return;

    const current = getCurrentActionEffect();
    if (!current || current.status !== "active") return;
    if (
      pendingState.yichangdianCornerAction
      && current.type === cardEffects.EFFECT_TYPES.YICHANGDIAN_DRAW_THEN_TWO_CORNERS
    ) {
      openYichangdianCornerPicker();
      return;
    }
    if (finishCurrentCardMoveEffectEarly()) return;
    if (current.options?.skippable === false || current.required) {
      rocketState.statusNote = `${current.label} 必须完成，不能跳过`;
      renderStateReadout();
      return;
    }
    if (pendingState.scanTargetAction?.type === "hand_scan" && pendingState.scanTargetAction.discardDrawnOnSkip) {
      handleDrawnHandScanSkip();
      return;
    }

    cancelActiveEffectSubFlows();
    cleanupSkippedActionEffect(current);
    beginEffectHistoryStep(`跳过：${current.label}`);
    endEffectHistoryStep();
    rocketState.statusNote = `已跳过：${current.label}`;
    completeCurrentActionEffect("skipped");
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
      rocketState.statusNote = message;
      renderStateReadout();
      return result;
    }

    current.result = result;
    cleanupSkippedActionEffect(current);
    beginEffectHistoryStep(`跳过：${current.label}`);
    rocketState.statusNote = result.message;
    completeCurrentActionEffect("skipped");
    renderStateReadout();
    return result;
  }

  function renderActionEffectBar() {
    if (!els.actionEffectBar || !els.actionEffectList) return;

    if (!pendingState.actionEffectFlow) {
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
        && pendingState.actionEffectFlow?.cardMoveEffect
        && pendingState.actionEffectFlow.cardMoveEffect.effect?.id === current?.id
        && (pendingState.actionEffectFlow.cardMoveEffect.moved || current?.result)
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

    const visibleEffects = pendingState.actionEffectFlow.effects
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
        pendingState.actionEffectFlow?.cardMoveEffect?.effect?.id === effect.id
        && effect.status === "active"
      ) {
        const badge = document.createElement("span");
        badge.className = "action-effect-badge";
        badge.textContent = String(pendingState.actionEffectFlow.cardMoveEffect.poolRemaining);
        button.append(badge);
      }
      return button;
    }));
  }

  function resolveCompletedSectorSettlements(actionType, options = {}) {
    if (typeof data.settleCompletedSectors !== "function") return null;

    const beforeNebulaState = structuredClone(nebulaDataState);
    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const settlementResult = data.settleCompletedSectors(nebulaDataState, {
      players: playerState.players,
      getPlayerTokenSrc: getNormalTokenAssetForPlayer,
      source: actionType || "mainAction",
    });
    if (!settlementResult.ok) return null;

    const awarded = new Set();
    const participantAwardLabels = new Set();
    for (const settlement of settlementResult.settlements || []) {
      const isAomomoSettlement = settlement.sectorId === aomomo?.NEBULA_ID;
      for (const participant of settlement.participants || []) {
        const player = playerState.players.find((item) => item.id === participant.playerId)
          || playerState.players.find((item) => item.color === participant.playerColor);
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
      const winner = playerState.players.find((item) => item.id === settlement.winner?.playerId)
        || playerState.players.find((item) => item.color === settlement.winner?.playerColor);
      const claim = winner
        ? runezu?.claimSectorSymbol?.(alienGameState, settlement.sectorId, winner)
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
        nebulaDataState,
        beforeNebulaState,
        "恢复扇区结算前星云状态",
      ));
      history.record(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复扇区结算前玩家状态",
      ));
      history.record(historyCommands.createRestoreObjectCommand(
        alienGameState,
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

  function finishActionEffectFlow() {
    if (!pendingState.actionEffectFlow) return;

    const finishedFlow = pendingState.actionEffectFlow;
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
      tech.setTechSelectionActive(techGameState, false);
      tech.cancelPendingTake(techGameState);
      techGameState.ui.statusNote = "";
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
      playerState.currentPlayerId = turnState.startPlayerId || playerState.currentPlayerId;
      rocketState.statusNote = "初始收入增加完成，游戏开始。";
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
      rocketState.statusNote = queuedType1Result?.message || "卡牌触发：请先完成触发效果";
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
        rocketState.statusNote = passSettlement?.type1Result?.message || "PASS 任务触发：请先完成触发效果";
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
    rocketState.statusNote = [baseMessage, settleMessage, delayedPublicRefillResult?.message]
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

  function launchRocketForScanAction4() {
    const currentPlayer = getCurrentPlayer();
    const currentEffect = getCurrentActionEffect();
    const skipCost = Boolean(currentEffect?.options?.skipCost);
    if (!skipCost && !players.canAfford(currentPlayer, { energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY })) {
      return { ok: false, message: "能量不足，发射需要 1 能量" };
    }

    beginEffectHistoryStep("发射/移动");

    const result = abilities.executeAbility("scanAction4", createActionContext(), {
      choice: "launch",
      skipCost,
      cost: skipCost ? {} : { energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY },
    });
    if (!result.ok) {
      endEffectHistoryStep();
      return result;
    }

    maybeApplyIndustryLaunchScan(result);
    recordAbilityCommands(result);

    renderRocketElement(result.rocket);
    const current = getCurrentActionEffect();
    if (current) current.result = result;
    return result;
  }

  function beginScanAction4FreeMove() {
    const currentPlayer = getCurrentPlayer();
    const rocketsForPlayer = getMovableTokensForPlayer(currentPlayer?.id);
    if (!rocketsForPlayer.length) {
      rocketState.statusNote = "没有可移动的飞船";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    pendingState.actionEffectFlow.freeMoveMode = true;
    rocketState.statusNote = rocketsForPlayer.length > 1
      ? "扫描效果：请点击要移动的飞船"
      : "扫描效果：使用方向键移动飞船";
    if (rocketsForPlayer.length === 1) {
      activateMoveMode(rocketsForPlayer[0].id);
    } else {
      selectDefaultRocketForCurrentPlayer();
    }
    renderStateReadout();
    return { ok: true, message: rocketState.statusNote };
  }

  function executeFreeMoveForScanAction4(deltaX, deltaY, rocketId, payment = {}) {
    const moveCheck = rocketActions.canMoveRocket(rocketState, rocketId, deltaX, deltaY);
    if (!moveCheck.ok) {
      rocketState.statusNote = moveCheck.message;
      renderStateReadout();
      return moveCheck;
    }

    const currentPlayer = getCurrentPlayer();
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

    const result = abilities.executeAbility("scanAction4", createActionContext(), {
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
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    if (payment.discardCommand) recordHistoryCommand(payment.discardCommand);
    recordAbilityCommands(result);

    pendingState.actionEffectFlow.freeMoveMode = false;
    deactivateMoveMode();
    const current = getCurrentActionEffect();
    if (current) current.result = result;
    rocketState.statusNote = `扫描效果：${result.message}`;
    renderPlayerStats();
    completeCurrentActionEffect();
    renderStateReadout();
    return result;
  }

  function beginCardMoveEffect(effect) {
    const currentPlayer = getCurrentPlayer();
    const effectCost = getCardMoveEffectCost(effect);
    if (Object.keys(effectCost).length && !players.canAfford(currentPlayer, effectCost)) {
      rocketState.statusNote = `${effect.label}：需要 ${players.formatResourceCost(effectCost)}，可点击跳过`;
      deactivateMoveMode();
      renderActionEffectBar();
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const rocketsForPlayer = getMovableTokensForCardMoveEffect(effect, currentPlayer?.id);
    if (!rocketsForPlayer.length) {
      rocketState.statusNote = isIndustryHuanyuMoveEffect(effect)
        ? `${effect.label}：没有可移动的另一枚火箭，可点击跳过`
        : "没有可移动的飞船";
      deactivateMoveMode();
      renderActionEffectBar();
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    if (!pendingState.actionEffectFlow.cardMoveEffect
      || pendingState.actionEffectFlow.cardMoveEffect.effect?.id !== effect.id) {
      initCardMoveEffectState(effect);
    } else {
      effect.badge = String(pendingState.actionEffectFlow.cardMoveEffect.poolRemaining);
    }

    const poolRemaining = pendingState.actionEffectFlow.cardMoveEffect.poolRemaining;
    rocketState.statusNote = poolRemaining > 1
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
    return { ok: true, message: rocketState.statusNote };
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

    if (!pendingState.actionEffectFlow.cardEventRewardKeys) {
      pendingState.actionEffectFlow.cardEventRewardKeys = [];
    }
    const usedKeys = new Set(pendingState.actionEffectFlow.cardEventRewardKeys);
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
        pendingState.actionEffectFlow.cardEventRewardKeys.push(reward.onceKey);
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
    if (!pendingState.actionEffectFlow.cardEventRewardKeys) pendingState.actionEffectFlow.cardEventRewardKeys = [];
    const key = `${effect.id || "card-move"}:same-ring`;
    if (pendingState.actionEffectFlow.cardEventRewardKeys.includes(key)) return null;
    const applied = applyCardMoveRewardEffect(rewardEffect, messageParts);
    if (applied?.ok) pendingState.actionEffectFlow.cardEventRewardKeys.push(key);
    return applied;
  }

  function maybeApplyCardMoveDistinctEventReward(effect, moveResult, messageParts) {
    const reward = effect.options?.distinctEventReward;
    if (!reward || !moveResult?.events?.length) return null;
    if (!pendingState.actionEffectFlow.cardMoveDistinctEvents) pendingState.actionEffectFlow.cardMoveDistinctEvents = {};
    if (!pendingState.actionEffectFlow.cardEventRewardKeys) pendingState.actionEffectFlow.cardEventRewardKeys = [];
    const key = reward.onceKey || `${effect.id || "card-move"}:distinct:${reward.eventType}`;
    if (pendingState.actionEffectFlow.cardEventRewardKeys.includes(key)) return null;
    if (!pendingState.actionEffectFlow.cardMoveDistinctEvents[key]) pendingState.actionEffectFlow.cardMoveDistinctEvents[key] = [];
    const values = pendingState.actionEffectFlow.cardMoveDistinctEvents[key];
    const distinctBy = reward.distinctBy || "planetId";

    for (const event of moveResult.events || []) {
      if (event?.type !== reward.eventType) continue;
      const value = event[distinctBy];
      if (value != null && !values.includes(value)) values.push(value);
    }

    const minCount = Math.max(1, Math.round(Number(reward.minCount) || 1));
    if (values.length < minCount) return null;
    const applied = applyCardMoveRewardEffect(reward.effect, messageParts);
    if (applied?.ok) pendingState.actionEffectFlow.cardEventRewardKeys.push(key);
    return applied;
  }

  function executeCardMoveForEffect(deltaX, deltaY, rocketId) {
    return requestCardEffectMove(deltaX, deltaY, rocketId);
  }

  function executeSectorXScanEffect(...args) {
    return effectExecutors.executeSectorXScanEffect(...args);
  }

  function maybeReturnPlayedCardToHandAfterSectorScan(...args) {
    return effectExecutors.maybeReturnPlayedCardToHandAfterSectorScan(...args);
  }

  function handleProbeSectorScanChoice(...args) {
    return effectExecutors.handleProbeSectorScanChoice(...args);
  }

  function confirmProbeSectorScanSelection(...args) {
    return effectExecutors.confirmProbeSectorScanSelection(...args);
  }

  function getPlanetName(...args) {
    return effectExecutors.getPlanetName(...args);
  }

  function markerBelongsToPlayer(...args) {
    return effectExecutors.markerBelongsToPlayer(...args);
  }

  function playerHasOwnOrbitMarkerAtPlanet(...args) {
    return effectExecutors.playerHasOwnOrbitMarkerAtPlanet(...args);
  }

  function markerOwnerLabel(...args) {
    return effectExecutors.markerOwnerLabel(...args);
  }

  function buildPlanetMarkerRemovalChoices(...args) {
    return effectExecutors.buildPlanetMarkerRemovalChoices(...args);
  }

  function removePlanetMarkerForChoice(...args) {
    return effectExecutors.removePlanetMarkerForChoice(...args);
  }

  function handleRemovePlanetMarkerChoice(...args) {
    return effectExecutors.handleRemovePlanetMarkerChoice(...args);
  }

  function handleScanAction4Choice(...args) {
    return effectExecutors.handleScanAction4Choice(...args);
  }

  function formatPlanetRewardGain(...args) {
    return effectExecutors.formatPlanetRewardGain(...args);
  }

  function finishAutomaticRewardEffect(...args) {
    return effectExecutors.finishAutomaticRewardEffect(...args);
  }

  function buildPlutoRewardEffectsForAction(...args) {
    return effectExecutors.buildPlutoRewardEffectsForAction(...args);
  }

  function buildPlutoChoiceRewardSummary(...args) {
    return effectExecutors.buildPlutoChoiceRewardSummary(...args);
  }

  function handleHandCornerChoice(...args) {
    return effectExecutors.handleHandCornerChoice(...args);
  }

  function getSectorXsMatchingCondition(...args) {
    return effectExecutors.getSectorXsMatchingCondition(...args);
  }

  function sectorXHasAvailableScanTarget(...args) {
    return effectExecutors.sectorXHasAvailableScanTarget(...args);
  }

  function handleConditionalSectorChoice(...args) {
    return effectExecutors.handleConditionalSectorChoice(...args);
  }

  function handleDiscardIncomeCardChoice(...args) {
    return effectExecutors.handleDiscardIncomeCardChoice(...args);
  }

  function confirmDiscardAnyForIncome(...args) {
    return effectExecutors.confirmDiscardAnyForIncome(...args);
  }

  function handlePayCreditChoice(...args) {
    return effectExecutors.handlePayCreditChoice(...args);
  }

  function handleFundamentalismExchangeChoice(...args) {
    return effectExecutors.handleFundamentalismExchangeChoice(...args);
  }

  function isAlienFamilyCard(...args) {
    return effectExecutors.isAlienFamilyCard(...args);
  }

  function handleDiscardCornerRepeatChoice(...args) {
    return effectExecutors.handleDiscardCornerRepeatChoice(...args);
  }

  function handleRemoveOrbitToProbeChoice(...args) {
    return effectExecutors.handleRemoveOrbitToProbeChoice(...args);
  }

  function handleReturnUnfinishedTaskChoice(...args) {
    return effectExecutors.handleReturnUnfinishedTaskChoice(...args);
  }

  function countOwnedTechByType(...args) {
    return effectExecutors.countOwnedTechByType(...args);
  }

  function enrichScanResultEvents(...args) {
    return effectExecutors.enrichScanResultEvents(...args);
  }

  function getPlayerCompanyBaseIncome(...args) {
    return effectExecutors.getPlayerCompanyBaseIncome(...args);
  }

  function insertActionEffectsAfterCurrent(...args) {
    return effectExecutors.insertActionEffectsAfterCurrent(...args);
  }

  function insertActionEffectsBeforeCurrent(...args) {
    return effectExecutors.insertActionEffectsBeforeCurrent(...args);
  }

  function handleOptionalHandScanChoice(...args) {
    return effectExecutors.handleOptionalHandScanChoice(...args);
  }

  function handleProbeLocationRewardChoice(...args) {
    return effectExecutors.handleProbeLocationRewardChoice(...args);
  }

  function openYichangdianCornerPicker(...args) {
    return effectExecutors.openYichangdianCornerPicker(...args);
  }

  function handleYichangdianCornerChoice(...args) {
    return effectExecutors.handleYichangdianCornerChoice(...args);
  }

  function applyAomomoScanCostAndBonus(...args) {
    return effectExecutors.applyAomomoScanCostAndBonus(...args);
  }

  function openAlienTraceRewardEffect(...args) {
    return effectExecutors.openAlienTraceRewardEffect(...args);
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
    alienGameState,
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
    cardState,
    cards,
    chong,
    claimRunezuPlanetSymbolForTravelResult,
    claimRunezuSourceSymbolWithHistory,
    closeAlienTracePicker,
    closeScanAction4Picker,
    closeScanTargetPicker,
    collectPlutoMarkers,
    completeCurrentActionEffect,
    createActionContext,
    createPublicScanPendingAction,
    createScanRunId,
    data,
    document,
    effectChoiceFlowHelpers,
    els,
    endEffectHistoryStep,
    endGameScoring,
    ensureCardFlowEventBonuses,
    ensurePlutoCardEffectState,
    executeBanrenmaPanelBonusEffect,
    executeIndustryHeliosPassiveRewardEffect,
    executeIndustryPiratesRaidLaunchEffect,
    executeIndustryPiratesRaidMarkerEffect,
    executeIndustryPiratesRaidPublicityEffect,
    executeIndustrySentinelCornerEffect,
    executeIndustryStrategyPassiveRewardEffect,
    executeIndustryStratusCornerEffect,
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
    getResearchTechSelectionPayload,
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
    maybeApplyIndustryLaunchScan,
    maybeCompleteActionEffectFromScan,
    maybeConsumeAlienLabPanelForMainAction,
    nebulaDataState,
    nebulaHasScannableData,
    normalizeResourceCost,
    onTechTileTaken,
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
    pendingState,
    planetReferenceLayout,
    planetRewards,
    planetStats,
    planetStatsState,
    playerHasOwnPlutoLanding,
    playerState,
    players,
    recordAbilityCommands,
    recordHistoryCommand,
    recordScoreSourceForGainEffect,
    recordTechBonusScore,
    removePlutoMarker,
    removeRocketElement,
    renderActionEffectBar,
    renderAlienPanels,
    renderPlayerHand,
    renderPlayerStats,
    renderPublicCards,
    renderReservedCardsFromTaskState: (...args) => renderReservedCardsFromTaskState(...args),
    renderRocketElement,
    renderRockets,
    renderRotateStateToken,
    renderRunezuBoardSymbols,
    renderSectorNebulaDataBoard,
    renderStateReadout,
    renderTechBoard,
    renderWheels,
    replaceNebulaDataForCurrentPlayer,
    resolvePlayerReference,
    restoreMutableObject,
    restoreObjectSnapshot,
    rocketActions,
    rocketState,
    runezu,
    scanEffects,
    shouldSkipCurrentResearchTechCost,
    skipActionEffectWithMessage,
    solar,
    solarState,
    syncHandScanSelectionChrome,
    syncPlanetOrbitLandMarkers,
    syncTechSelectionChrome,
    tech,
    turnState,
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

  function handleActionEffectButtonClick(effectIndex) {
    return actionRuntimeController.handleActionEffectButtonClick(effectIndex);
  }

  function beginScanAction() {
    if (!canStartMainAction()) {
      rocketState.statusNote = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isActionEffectFlowActive()) {
      return { ok: false, message: "请先完成当前行动的效果" };
    }
    if (isTechTilePickingActive()) {
      rocketState.statusNote = "请先完成科技选择";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isCardSelectionActive()) {
      rocketState.statusNote = "请先完成精选";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isDiscardSelectionActive()) {
      rocketState.statusNote = "请先完成弃牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isPlayCardSelectionActive()) {
      rocketState.statusNote = "请先完成打牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isMovePaymentSelectionActive()) {
      rocketState.statusNote = "请先完成移动";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isHandScanSelectionActive()) {
      rocketState.statusNote = "请先完成手牌扫描";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const currentPlayer = getCurrentPlayer();
    const check = scanEffects.canExecuteScan(currentPlayer, { standardAction: true });
    if (!check.ok) {
      rocketState.statusNote = check.message;
      renderStateReadout();
      return check;
    }

    startActionLogDraft("scan", "扫描行动", { source: HISTORY_SOURCE_MAIN, player: currentPlayer });
    actionHistory.beginSession("scan", "扫描行动");
    actionHistory.beginStep({ source: HISTORY_SOURCE_MAIN, type: "action-cost", label: "扫描费用" });
    let costResult = abilities.executeAbility("payScanCost", createActionContext(), {
      cost: scanEffects.getStandardScanCost(currentPlayer),
    });
    if (!costResult.ok) {
      actionHistory.rollbackSession();
      clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
      removeActionLogStepsBySource(HISTORY_SOURCE_MAIN);
      rocketState.statusNote = costResult.message;
      renderStateReadout();
      return costResult;
    }
    costResult = maybeConsumeAlienLabPanelForMainAction("scan", costResult);
    recordAbilityCommands(costResult);
    const costStep = actionHistory.endStep();
    if (costStep) {
      rememberHistoryStep(HISTORY_SOURCE_MAIN, costStep.id);
      appendActionLogStep(
        HISTORY_SOURCE_MAIN,
        costStep.label,
        costResult.message,
        actionLogOptionsFromHistoryStep(costStep),
      );
    }
    const scanRunId = createScanRunId("main-scan");
    pendingState.actionEffectFlow = abilities.chain.startAbilityChain(
      "scan",
      "扫描行动",
      scanEffects.buildScanEffectQueue(currentPlayer, {
        includeFinalize: true,
        fullScanAction: true,
        scanRunId,
        turnState,
        roundNumber: turnState.roundNumber,
        turnNumber: turnState.turnNumber,
      }),
    );
    pendingState.actionEffectFlow.playerId = currentPlayer.id;
    assignEffectFlowOwner(pendingState.actionEffectFlow, pendingState.actionEffectFlow.playerId);
    pendingState.actionEffectFlow.scanRunId = scanRunId;
    pendingState.actionEffectFlow.scanActionEvent = {
      type: "scanAction",
      source: "main",
      scanRunId,
      playerId: currentPlayer.id,
    };

    els.appWrap?.classList.toggle("action-effect-flow-active", true);
    rocketState.statusNote = "扫描：请依次点击能力效果";
    renderPlayerStats();
    activateNextActionEffect();
    return { ok: true, message: rocketState.statusNote };
  }

  function resize() {
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

  function getAlienTraceLayer(alienSlotId) {
    return [...els.alienTraceLayers].find(
      (layer) => Number(layer.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienJiuzheTraceLayer(alienSlotId) {
    return [...els.alienJiuzheTraceLayers].find(
      (layer) => Number(layer.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienYichangdianCardArea(alienSlotId) {
    return [...els.alienYichangdianCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienBanrenmaCardArea(alienSlotId) {
    return [...els.alienBanrenmaCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienChongCardArea(alienSlotId) {
    return [...els.alienChongCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienAmibaCardArea(alienSlotId) {
    return [...els.alienAmibaCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienAomomoCardArea(alienSlotId) {
    return [...els.alienAomomoCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienRunezuCardArea(alienSlotId) {
    return [...els.alienRunezuCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienJiuzheThresholdElement(alienSlotId) {
    return [...els.alienJiuzheThresholds].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienBanrenmaScoremarkElement(alienSlotId) {
    return [...els.alienBanrenmaScoremarks].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function getAlienBackImage(alienSlotId) {
    return document.querySelector(`.alien-panel[data-alien-slot="${alienSlotId}"] .alien-back`);
  }

  function createJiuzheThresholdNode(kind, iconSrc, score) {
    const item = document.createElement("div");
    const icon = document.createElement("img");
    const scoreEl = document.createElement("span");
    item.className = "alien-jiuzhe-threshold";
    item.dataset.jiuzheThreshold = kind;
    icon.className = "alien-jiuzhe-threshold-icon";
    icon.src = iconSrc;
    icon.alt = "";
    icon.decoding = "async";
    icon.setAttribute("aria-hidden", "true");
    scoreEl.className = "alien-jiuzhe-threshold-score";
    scoreEl.textContent = score == null ? "-" : String(score);
    item.title = kind === "free"
      ? `达到 ${score} 分：免费打出九折牌`
      : `达到 ${score} 分：支付 1 信用点打出九折牌`;
    item.append(icon, scoreEl);
    return item;
  }

  function renderJiuzheThresholds() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const container = getAlienJiuzheThresholdElement(alienSlotId);
      if (!container) continue;
      const visible = Boolean(jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.jiuzhe || {};
      if (!visible) {
        container.hidden = true;
        container.replaceChildren();
        continue;
      }
      container.hidden = false;
      container.replaceChildren(
        createJiuzheThresholdNode("free", RESOURCE_ICON_SRC.jiuzheTimeFree, state.freeScoreThreshold),
        createJiuzheThresholdNode("paid", RESOURCE_ICON_SRC.jiuzheTimePaid, state.paidScoreThreshold),
      );
    }
  }

  function maybeRevealAlienAfterTrace(alienSlotId, traceResult, options = {}) {
    if (!traceResult?.readyToReveal) return null;
    if (options.immediate === false) {
      return {
        ok: true,
        delayed: true,
        readyToReveal: true,
        alienSlotId,
        message: `${aliens.getAlienSlotLabel(alienSlotId)}三种首痕迹已满：将在该玩家回合结束时揭示外星人`,
      };
    }
    return aliens.revealRandomAlien(alienGameState, alienSlotId);
  }

  function isDebugAlienTraceMode() {
    return Boolean(uiRuntimeState.debugAlienTraceModeActive);
  }

  function setDebugAlienTraceModeActive(active, message = null) {
    return debugRuntimeController.setDebugAlienTraceModeActive(active, message);
  }

  function toggleDebugAlienTraceMode() {
    return debugRuntimeController.toggleDebugAlienTraceMode();
  }

  function enableDebugAlienTraceModeForReveal(message) {
    return debugRuntimeController.enableDebugAlienTraceModeForReveal(message);
  }

  function renderYichangdianCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienYichangdianCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(yichangdian?.isYichangdianRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.yichangdian || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible || cardIndex == null) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-yichangdian-card-title";
      title.textContent = "异常点展示牌";

      const image = document.createElement("img");
      image.className = "alien-yichangdian-card-image";
      image.src = yichangdian.getCardSrc(cardIndex);
      image.alt = `异常点牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";
      area.replaceChildren(title, image);
    }
  }

  function renderBanrenmaScoremarks() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const container = getAlienBanrenmaScoremarkElement(alienSlotId);
      if (!container) continue;
      const visible = Boolean(banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId));
      if (!visible) {
        container.hidden = true;
        container.replaceChildren();
        continue;
      }
      const marks = playerState.players.flatMap((player) => (
        banrenma.getPlayerScoreMarks(alienGameState, player)
          .filter((mark) => mark.source === "panel")
          .map((mark) => ({ player, mark }))
      ));
      container.hidden = !marks.length;
      container.replaceChildren(...marks.map(({ player, mark }) => {
        const item = document.createElement("div");
        item.className = "alien-banrenma-scoremark";
        const icon = document.createElement("img");
        icon.className = "alien-banrenma-scoremark-icon";
        icon.src = banrenma.getPlayerMarkSrc(player.color);
        icon.alt = "";
        icon.decoding = "async";
        icon.setAttribute("aria-hidden", "true");
        const score = document.createElement("span");
        score.className = "alien-banrenma-scoremark-score";
        score.textContent = String(mark.threshold);
        item.title = `${player.colorLabel}玩家达到 ${mark.threshold} 分：选择一个半人马顶部奖励`;
        item.append(icon, score);
        return item;
      }));
    }
  }

  function renderBanrenmaCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienBanrenmaCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.banrenma || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-banrenma-card-title";
      title.textContent = "半人马展示牌";
      const image = document.createElement("img");
      image.className = "alien-banrenma-card-image";
      image.src = cardIndex == null ? banrenma.CARD_BACK_SRC : banrenma.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "半人马牌背" : `半人马牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";
      area.replaceChildren(title, image);
    }
  }

  function renderChongCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienChongCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(chong?.isChongRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.chong || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-chong-card-title";
      title.textContent = "虫族展示牌";
      const image = document.createElement("img");
      image.className = "alien-chong-card-image";
      image.src = cardIndex == null ? chong.CARD_BACK_SRC : chong.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "虫族牌背" : `虫族牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";

      area.replaceChildren(title, image);
    }
  }

  function renderAmibaCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienAmibaCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(amiba?.isAmibaRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.amiba || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-amiba-card-title";
      title.textContent = "阿米巴展示牌";
      const image = document.createElement("img");
      image.className = "alien-amiba-card-image";
      image.src = cardIndex == null ? amiba.CARD_BACK_SRC : amiba.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "阿米巴牌背" : `阿米巴牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";

      area.replaceChildren(title, image);
    }
  }

  function renderAomomoCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienAomomoCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(aomomo?.isAomomoRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.aomomo || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-aomomo-card-title";
      title.textContent = "奥陌陌展示牌";
      const image = document.createElement("img");
      image.className = "alien-aomomo-card-image";
      image.src = cardIndex == null ? aomomo.CARD_BACK_SRC : aomomo.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "奥陌陌牌背" : `奥陌陌牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";

      area.replaceChildren(title, image);
    }
  }

  function renderRunezuCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienRunezuCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(runezu?.isRunezuRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.runezu || {};
      const cardIndex = state.displayedCardIndex;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-runezu-card-title";
      title.textContent = "符文族展示牌";
      const image = document.createElement("img");
      image.className = "alien-runezu-card-image";
      image.src = cardIndex == null ? runezu.CARD_BACK_SRC : runezu.getCardSrc(cardIndex);
      image.alt = cardIndex == null ? "符文族牌背" : `符文族牌 ${cardIndex}`;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";

      area.replaceChildren(title, image);
    }
  }

  function renderBanrenmaBonusMarkers() {
    const activeKeys = new Set();
    const state = banrenma?.ensureBanrenmaState?.(alienGameState);
    const alienSlotId = Number(state?.revealedSlotId || 0);
    const layer = alienSlotId ? getAlienJiuzheTraceLayer(alienSlotId) : null;
    if (layer && banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) {
      for (const [position, slot] of Object.entries(state.bonusSlots || {})) {
        const layout = window.SetiAlienPlacement?.getBanrenmaBonusMarkerLayout?.(alienSlotId, Number(position));
        if (!layout || !slot) continue;
        const key = `banrenma-bonus:${alienSlotId}:${position}`;
        activeKeys.add(key);
        let element = banrenmaBonusMarkerElements.get(key);
        if (!element) {
          element = document.createElement("img");
          element.className = "alien-trace-token alien-trace-token-positioned alien-trace-token-banrenma-bonus";
          element.draggable = false;
          banrenmaBonusMarkerElements.set(key, element);
          layer.appendChild(element);
        }
        const scale = ((layout.scalePercent || 52) / 100)
          * (window.SetiAlienPlacement?.BANRENMA_BONUS_TOKEN_DISPLAY_SCALE || 1.18);
        element.style.position = "absolute";
        element.style.left = `${layout.percentX}%`;
        element.style.top = `${layout.percentY}%`;
        element.style.setProperty("--alien-trace-scale", String(scale));
        element.style.transform = "translate(-50%, -50%) scale(var(--alien-trace-scale, 1))";
        element.style.transformOrigin = "center center";
        element.src = banrenma.getPlayerMarkSrc?.(slot.playerColor) || aliens.ALIEN_TRACE_TOKEN_SRC;
        element.alt = `半人马顶部奖励${position}`;
        element.dataset.alienSlot = String(alienSlotId);
        element.dataset.banrenmaBonusPosition = String(position);
        element.title = `半人马顶部奖励${position}：${slot.playerLabel || slot.playerColor || "已使用"} @(${layout.percentX}%,${layout.percentY}%)`;
      }
    }
    for (const [key, element] of banrenmaBonusMarkerElements.entries()) {
      if (activeKeys.has(key)) continue;
      element.remove();
      banrenmaBonusMarkerElements.delete(key);
    }
  }

  function renderAlienPanels() {
    aliens.renderAllAlienBackImages(getAlienBackImage, alienGameState);
    aliens.renderAllAlienTraceMarkers(getAlienTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      showStateTraceSlots: shouldShowStateTraceSlots(),
      allowedTraceTypes: pendingState.alienTracePickerState?.allowedTraceTypes || aliens.TRACE_TYPES,
      canPlaceStateTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllJiuzheTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceJiuzheTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllYichangdianTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceYichangdianTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllFangzhouTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceFangzhouTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllBanrenmaTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceBanrenmaTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllChongTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceChongTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllAmibaTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceAmibaTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllAomomoTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceAomomoTrace,
      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerOrbitAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.satelliteAsset
        || players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLandingAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.landdingAsset
        || players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    aliens.renderAllRunezuTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, {
      tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
      canPlaceRunezuTrace,
      canPlaceRunezuFaceSymbol,

      getPlayerTokenAsset: (playerColor) => (
        players.getPlayerColorDefinition(playerColor)?.normalTokenAsset
        || aliens.ALIEN_TRACE_TOKEN_SRC
      ),
      getPlayerLabel: (playerColor) => players.getPlayerColorDefinition(playerColor)?.label || playerColor,
    });
    renderJiuzheThresholds();
    renderBanrenmaScoremarks();
    renderYichangdianCardDisplays();
    renderFangzhouCardDisplays();
    renderBanrenmaCardDisplays();
    renderChongCardDisplays();
    renderAmibaCardDisplays();
    renderAomomoCardDisplays();
    renderRunezuCardDisplays();
    renderBanrenmaBonusMarkers();
    renderRunezuBoardSymbols();
  }

  function randomizeAliens() {
    const result = aliens.randomizeAlienAssignments(alienGameState, {
      alienPoolIds: startScreenState.selectedAlienIds,
    });
    if (!result.ok) return result;
    aliens.resetAlienTraceTokens();
    for (const element of yichangdianAnomalyMarkerElements.values()) {
      element.remove();
    }
    yichangdianAnomalyMarkerElements.clear();
    for (const element of banrenmaBonusMarkerElements.values()) {
      element.remove();
    }
    banrenmaBonusMarkerElements.clear();
    renderAlienPanels();
    renderRockets();
    return result;
  }


  function applyFangzhouUnlockStateTraceReward(alienSlotId, player, traceType, placementResult) {
    return applyAlienStateExtraTraceReward(alienSlotId, traceType, player, placementResult);
  }

  function confirmFangzhouCard2Unlock(alienSlotId, traceType) {
    const pending = pendingState.alienTraceAction;
    const inDebugMode = isDebugAlienTraceMode();
    const currentPlayer = getAlienTraceActionPlayer(pending || pendingState.alienTracePickerState, { allowFallback: inDebugMode });
    if (!currentPlayer) return failMissingAlienTraceTargetPlayer();
    if (!fangzhou?.canUnlockCard2ForTrace?.(alienGameState, currentPlayer, traceType)) {
      rocketState.statusNote = "无法解锁该方舟卡牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (!canPlaceAnyStateExtraTrace(alienSlotId, traceType)) {
      rocketState.statusNote = "无法将该痕迹追加到方舟 state 额外位";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const beforeAlienState = pending?.beforeAlienState || structuredClone(alienGameState);
    const beforePlayerState = pending?.beforePlayerState || structuredClone(playerState);
    const beforeLogSnapshot = createActionLogImpactSnapshot(currentPlayer);
    if (!inDebugMode) {
      pendingState.alienTraceAction = null;
      if (pendingState.alienTracePickerState?.mode !== "debug-direct") {
        pendingState.alienTracePickerState = null;
      }
      closeAlienTracePicker();
    }

    const unlockResult = fangzhou.unlockCard2(alienGameState, currentPlayer, traceType);
    if (!unlockResult.ok) {
      rocketState.statusNote = unlockResult.message;
      renderStateReadout();
      return unlockResult;
    }
    const stateTraceResult = aliens.addExtraTrace(alienGameState, alienSlotId, traceType, currentPlayer.color);
    if (!stateTraceResult.ok) {
      rocketState.statusNote = stateTraceResult.message;
      renderStateReadout();
      return stateTraceResult;
    }
    addFangzhouUnlockedCardToHand(currentPlayer, unlockResult.handCard);

    const stateTraceReward = applyFangzhouUnlockStateTraceReward(alienSlotId, currentPlayer, traceType, stateTraceResult);
    rocketState.statusNote = [
      unlockResult.message,
      stateTraceResult.message,
      stateTraceReward.message,
    ].filter(Boolean).join("；");
    const traceEvents = !inDebugMode
      ? [buildAlienTraceEvent(alienSlotId, traceType, currentPlayer, fangzhou.ALIEN_ID)]
      : [];
    const alienLabRestore = maybeRestoreAlienLabPanelForTrace(currentPlayer, traceType);
    if (alienLabRestore?.changed) {
      rocketState.statusNote = `${rocketState.statusNote}；${alienLabRestore.message}`;
    }
    const afterReward = applyAlienTraceAfterReward(pending, currentPlayer, traceType);
    appendAlienTraceAfterRewardMessage(afterReward);

    if (pending?.type === "planet_reward_alien_trace") {
      beginEffectHistoryStep(pending.effectLabel || "方舟解锁卡牌", { logBefore: beforeLogSnapshot });
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复方舟解锁卡牌前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复方舟解锁卡牌前玩家状态",
      ));
      if (getCurrentActionEffect()) {
        getCurrentActionEffect().result = {
          ok: true,
          undoable: true,
          message: rocketState.statusNote,
          events: traceEvents,
          payload: {
            alienSlotId,
            traceType,
            unlocked: true,
            stateTrace: stateTraceResult,
            reward: stateTraceReward.reward || null,
            afterReward,
          },
        };
      }
      completeCurrentActionEffect();
    } else {
      beginQuickActionStep("fangzhou-unlock", rocketState.statusNote, { logBefore: beforeLogSnapshot });
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复方舟解锁卡牌前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复方舟解锁卡牌前玩家状态",
      ));
      completeQuickActionStep();
      settleCardTasksAfterEffect({ events: traceEvents, render: false });
    }

    renderAlienPanels();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    return {
      ...unlockResult,
      message: rocketState.statusNote,
      stateTrace: stateTraceResult,
      reward: stateTraceReward.reward || null,
      events: traceEvents,
      afterReward,
    };
  }

  function getAlienFangzhouCardArea(alienSlotId) {
    return [...els.alienFangzhouCardAreas].find(
      (element) => Number(element.dataset.alienSlot) === alienSlotId,
    ) || null;
  }

  function createFangzhouReservedButtons(player) {
    const reserved = fangzhou?.getPlayerCard2Reserved?.(alienGameState, player) || [];
    if (!reserved.length) return [];
    const debugUnlockMode = isDebugAlienTraceMode();
    return reserved.map((card, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reserved-card-button reserved-card-button-fangzhou";
      button.dataset.fangzhouReserved = card.traceType;
      if (debugUnlockMode) {
        button.dataset.fangzhouUnlock = card.traceType;
        button.classList.add("is-fangzhou-unlock-pending");
      }
      button.style.setProperty("--card-index", String(index + 1));
      button.title = debugUnlockMode
        ? `${card.label}（点击追加 state 额外痕迹并解锁）`
        : `${card.label}（未解锁）`;
      button.disabled = !debugUnlockMode;

      const image = document.createElement("img");
      image.className = "player-hand-card reserved-card";
      image.src = card.src;
      image.alt = card.label;
      image.width = 747;
      image.height = 1040;
      image.decoding = "async";
      image.setAttribute("aria-hidden", "true");
      button.append(image);
      return button;
    });
  }

  function buildFangzhouCard1EffectQueue(effect, labelPrefix) {
    if (!effect) return [];
    const queueApi = aliens.fangzhouCard1Queue;
    if (!queueApi) return [];
    return queueApi.buildCard1EffectQueue(effect, labelPrefix, {
      getTraceTypeLabel: aliens.getTraceTypeLabel,
      formatGain: (gain) => players.formatResourceCost(gain),
    });
  }

  function getFangzhouCard1RewardTargetOptions(flip, options = {}) {
    const targetPlayerId = flip?.targetPlayerId || flip?.playerId || options.targetPlayerId || options.playerId || null;
    const targetPlayerColor = flip?.targetPlayerColor || flip?.playerColor || options.targetPlayerColor || options.playerColor || null;
    const targetOptions = {};
    if (targetPlayerId) targetOptions.targetPlayerId = targetPlayerId;
    if (targetPlayerColor) targetOptions.targetPlayerColor = targetPlayerColor;
    return targetOptions;
  }

  function enqueueFangzhouCard1RewardEffects(flips, flowLabel, options = {}) {
    const effects = [];
    for (const flip of flips || []) {
      if (!flip?.ok) continue;
      const targetOptions = getFangzhouCard1RewardTargetOptions(flip, options);
      effects.push(...buildFangzhouCard1EffectQueue(flip.effect, flip.label || flowLabel).map((effect) => ({
        ...effect,
        options: {
          ...(effect.options || {}),
          ...targetOptions,
          ...(options.scoreSourceKey ? { scoreSourceKey: options.scoreSourceKey } : {}),
        },
      })));
    }
    if (!effects.length) {
      return { ok: true, effects: [], message: "无奖励效果" };
    }

    const flowOptions = {
      actionType: options.actionType || "fangzhouBasic",
      ...options,
    };
    if (pendingState.actionEffectFlow && options.insertIntoCurrentFlow) {
      insertActionEffectsAfterCurrent(effects);
      renderActionEffectBar();
      return { ok: true, effects, inserted: true, message: flowLabel };
    }
    if (pendingState.actionEffectFlow && !options.forceNewFlow) {
      insertActionEffectsAfterCurrent(effects);
      renderActionEffectBar();
      return { ok: true, effects, inserted: true, message: flowLabel };
    }

    startCardEffectFlow(
      "fangzhou-card1-reward",
      flowLabel,
      effects,
      flowOptions,
    );
    return { ok: true, effects, message: flowLabel };
  }

  function flipFangzhouCard1Rewards(count, tier = "basic") {
    const total = Math.max(0, Math.round(Number(count) || 0));
    const flips = [];
    for (let index = 0; index < total; index += 1) {
      const flip = fangzhou.flipCard1Reward(alienGameState, tier);
      if (!flip.ok) break;
      flips.push(flip);
    }
    if (flips.length) renderFangzhouCardDisplays();
    return flips;
  }

  function applyFangzhouCard1Rewards(player, count = 1, tier = "basic", label = "方舟基础奖励", options = {}) {
    if (!fangzhou) return { ok: false, message: "方舟模块未加载" };
    const flips = flipFangzhouCard1Rewards(count, tier);
    if (!flips.length) return { ok: false, message: "没有可翻开的方舟奖励" };

    const queueResult = enqueueFangzhouCard1RewardEffects(
      flips,
      label,
      {
        actionType: tier === "advanced" ? "fangzhouAdvanced" : "fangzhouBasic",
        ...options,
        ...getTargetPlayerOptions(player, options),
      },
    );

    const messages = flips.map((flip) => flip.message).filter(Boolean);
    return {
      ok: true,
      flipResult: flips[0],
      flips,
      repeat: flips.length,
      message: messages.length > 1 ? messages.join("；") : (messages[0] || label),
      followUps: queueResult.effects || [],
    };
  }

  function applyFangzhouCard1Reward(player, tier = "basic", label = "方舟基础奖励", options = {}) {
    return applyFangzhouCard1Rewards(player, 1, tier, label, options);
  }

  function queueFangzhouBasicRewards(player, count, label = "方舟痕迹", options = {}) {
    const flips = flipFangzhouCard1Rewards(count, "basic");
    if (!flips.length) return [];
    const queueResult = enqueueFangzhouCard1RewardEffects(
      flips,
      `${label} 基础奖励`,
      { actionType: "fangzhouBasic", ...options, ...getTargetPlayerOptions(player, options) },
    );
    return [queueResult];
  }

  function applyFangzhouTraceRewardToPlayer(player, reward, label = "方舟痕迹", options = {}) {
    if (!player || !reward) return { ok: false, message: "没有可结算的方舟奖励" };
    const messages = [];
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    const basicCount = Math.max(0, Math.round(Number(reward.basicRewardCount) || 0));
    let irreversible = null;
    if (basicCount > 0) {
      const basicResults = queueFangzhouBasicRewards(player, basicCount, label, {
        insertIntoCurrentFlow: isActionEffectFlowActive(),
        scoreSourceKey: options.scoreSourceKey,
      });
      for (const result of basicResults) {
        if (result.message) messages.push(result.message);
      }
      irreversible = {
        code: "fangzhou_card1_flip",
        reason: "方舟奖励牌翻开新牌",
      };
    }
    return {
      ok: true,
      undoable: !irreversible,
      irreversible,
      message: `${label}：${messages.join("；") || "无奖励"}`,
    };
  }

  function renderFangzhouCardDisplays() {
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS) {
      const area = getAlienFangzhouCardArea(alienSlotId);
      if (!area) continue;
      const visible = Boolean(fangzhou?.isFangzhouRevealedSlot?.(alienGameState, alienSlotId));
      const state = alienGameState.fangzhou || {};
      const cardIndex = state.displayedCard1Index;
      if (!visible) {
        area.hidden = true;
        area.replaceChildren();
        continue;
      }
      area.hidden = false;
      const title = document.createElement("div");
      title.className = "alien-fangzhou-card-title";
      title.textContent = "方舟奖励牌";

      const stack = document.createElement("div");
      stack.className = "alien-fangzhou-card-stack";

      if (cardIndex != null) {
        const image = document.createElement("img");
        image.className = "alien-fangzhou-card-image";
        image.src = fangzhou.getCard1Src(cardIndex);
        image.alt = `方舟奖励牌 ${cardIndex}`;
        image.width = 747;
        image.height = 1040;
        image.decoding = "async";
        stack.append(image);
      } else {
        const back = document.createElement("img");
        back.className = "alien-fangzhou-card-image";
        back.src = fangzhou.CARD1_BACK_SRC;
        back.alt = "方舟奖励牌背";
        stack.append(back);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "alien-fangzhou-card-view-button";
      button.dataset.fangzhouCardView = String(alienSlotId);
      button.textContent = "查看已翻开牌";
      area.replaceChildren(title, stack, button);
    }
  }

  function openFangzhouCard1Dialog(alienSlotId = alienGameState.fangzhou?.revealedSlotId) {
    if (!fangzhou || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开方舟奖励牌窗口" };
    }
    const revealed = alienGameState.fangzhou?.card1Revealed || [];
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "方舟已翻开奖励牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = revealed.length
        ? `共 ${revealed.length} 张；若已翻开 5 张，下次获得奖励时会先洗混牌堆再翻出新牌。`
        : "尚未翻开任何方舟奖励牌。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    setScanTargetActionLayout("fangzhou-card-grid");
    els.scanTargetActions.replaceChildren(...revealed.map((index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button fangzhou-card-option";
      button.disabled = true;
      button.innerHTML = `<img class="jiuzhe-card-option-image" src="${fangzhou.getCard1Src(index)}" alt=""><small>方舟奖励 ${index}</small>`;
      return button;
    }));
    if (!revealed.length) {
      const empty = document.createElement("p");
      empty.textContent = "暂无已翻开牌";
      els.scanTargetActions.append(empty);
    }
    els.scanTargetOverlay.hidden = false;
    return { ok: true };
  }

  function findPlayerForJiuzheEntry(entry) {
    if (!entry) return null;
    return getPlayerById(entry.playerId)
      || getPlayerByColor(entry.playerColor)
      || null;
  }

  function applyJiuzheRewardToPlayer(player, reward, label = "九折痕迹") {
    if (!player || !reward) return { ok: false, message: "没有可结算的九折奖励" };
    const messages = [];
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "jiuzhe" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    if (reward.threat) {
      messages.push(`威胁度+${reward.threat}`);
    }
    if (reward.pickCard) {
      messages.push("精选1张牌");
    }
    return {
      ok: true,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

  function findPlayerForYichangdianEntry(entry) {
    if (!entry) return null;
    return getPlayerById(entry.playerId)
      || getPlayerByColor(entry.playerColor)
      || null;
  }

  function applyYichangdianRewardToPlayer(player, reward, label = "异常点奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的异常点奖励" };
    const messages = [];
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "yichangdian" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.pickCard) messages.push("精选1张牌");
    return {
      ok: true,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

  function getAvailableDataTokenCount(player) {
    return data.ensurePlayerDataState(player).poolTokens.length;
  }

  function spendAvailableDataTokens(player, count) {
    const needed = Math.max(0, Math.round(Number(count) || 0));
    if (needed <= 0) return { ok: true, removedTokens: [], message: "无需支付数据" };
    const dataState = data.ensurePlayerDataState(player);
    if (dataState.poolTokens.length < needed) {
      return {
        ok: false,
        message: `数据不足：需要 ${needed} 数据`,
      };
    }
    const removedTokens = [];
    for (let index = 0; index < needed; index += 1) {
      const sorted = [...dataState.poolTokens].sort((a, b) => a.slotIndex - b.slotIndex);
      const token = sorted[0];
      const poolIndex = dataState.poolTokens.findIndex((item) => item.id === token.id);
      if (poolIndex >= 0) {
        removedTokens.push(...dataState.poolTokens.splice(poolIndex, 1));
      }
    }
    player.resources.availableData = dataState.poolTokens.length;
    return {
      ok: true,
      removedTokens,
      message: `支付 ${needed} 数据`,
    };
  }

  function applyBanrenmaRewardToPlayer(player, reward, label = "半人马奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的半人马奖励" };
    const messages = [];
    if (reward.payData) {
      const spendResult = spendAvailableDataTokens(player, reward.payData);
      if (!spendResult.ok) return spendResult;
      messages.push(spendResult.message);
    }
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.alienTrace) messages.push("任意外星人痕迹");
    return {
      ok: true,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

  function applyAomomoRewardToPlayer(player, reward, label = "奥陌陌奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的奥陌陌奖励" };
    const messages = [];
    if (reward.payFossils) {
      const cost = { aomomoFossils: reward.payFossils };
      if (!players.canAfford(player, cost)) {
        return { ok: false, message: `化石不足：需要 ${reward.payFossils} 化石` };
      }
      const spend = players.spendResources(player, cost);
      if (!spend.ok) return spend;
      messages.push(`支付${reward.payFossils}化石`);
    }
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(players.formatResourceCost(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "aomomo" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    return {
      ok: true,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

  function applyChongRewardToPlayer(player, reward, label = "虫族奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的虫族奖励" };
    const messages = [];
    let irreversible = null;
    const gain = reward.gain || {};
    const hasGain = Object.keys(gain).length > 0;
    if (hasGain) {
      players.gainResources(player, reward.gain);
      messages.push(formatChongGain(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "chong" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    const drawCount = Math.max(0, Math.round(Number(reward.drawCards) || 0));
    if (drawCount > 0) {
      let drawn = 0;
      for (let index = 0; index < drawCount; index += 1) {
        const result = blindDrawCardForPlayer(player);
        if (result.ok) drawn += 1;
      }
      messages.push(`${drawn}/${drawCount}盲抽`);
      irreversible = { code: "hidden_card_reveal", reason: "盲抽翻出新牌" };
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.pickCard) messages.push("精选1张牌");
    const hasDirectReward = hasGain
      || dataCount > 0
      || drawCount > 0
      || reward.pickAlienCard
      || reward.pickCard;
    if (reward.fossilId) {
      const fossilReward = reward.fossilPanel ? chong?.getFossilReward?.(reward.fossilId) : null;
      if (fossilReward) {
        const fossilResult = applyChongRewardToPlayer(player, fossilReward, `${label} ${reward.fossilId}`);
        if (fossilResult.message) messages.push(fossilResult.message);
        if (fossilResult.irreversible) irreversible = fossilResult.irreversible;
      } else if (!hasDirectReward) {
        messages.push(`化石 ${reward.fossilId}`);
      }
    }
    return {
      ok: true,
      undoable: !irreversible,
      irreversible,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

  function applyAmibaRewardToPlayer(player, reward, label = "阿米巴奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的阿米巴奖励" };
    const messages = [];
    let irreversible = null;
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(formatChongGain(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "amiba" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    const drawCount = Math.max(0, Math.round(Number(reward.drawCards) || 0));
    if (drawCount > 0) {
      let drawn = 0;
      for (let index = 0; index < drawCount; index += 1) {
        const result = blindDrawCardForPlayer(player);
        if (result.ok) drawn += 1;
      }
      messages.push(`${drawn}/${drawCount}盲抽`);
      irreversible = { code: "hidden_card_reveal", reason: "盲抽翻出新牌" };
    }
    if (reward.region) {
      const regionResult = amiba?.resolveRegionReward?.(alienGameState, reward.region);
      for (const symbolResult of regionResult?.results || []) {
        const symbolRewardResult = applyAmibaRewardToPlayer(
          player,
          symbolResult.reward,
          `${amiba.formatRegionLabel(reward.region)}区域 ${symbolResult.symbolId}`,
        );
        if (symbolRewardResult.message) messages.push(symbolRewardResult.message);
        if (symbolRewardResult.irreversible) irreversible = symbolRewardResult.irreversible;
      }
      if (!regionResult?.results?.length) messages.push(`${amiba?.formatRegionLabel?.(reward.region) || reward.region}区域无 symbol`);
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.pickCard) messages.push("精选1张牌");
    return {
      ok: true,
      undoable: !irreversible,
      irreversible,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

  function applyRunezuRewardToPlayer(player, reward, label = "符文族奖励") {
    if (!player || !reward) return { ok: false, message: "没有可结算的符文族奖励" };
    const messages = [];
    let irreversible = null;
    if (Object.keys(reward.gain || {}).length) {
      players.gainResources(player, reward.gain);
      messages.push(formatChongGain(reward.gain));
    }
    const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
    if (dataCount > 0) {
      let gained = 0;
      for (let index = 0; index < dataCount; index += 1) {
        const result = data.gainData(player, { source: "runezu" });
        if (result.ok) gained += 1;
      }
      messages.push(`${gained}/${dataCount}数据`);
    }
    const drawCount = Math.max(0, Math.round(Number(reward.drawCards) || 0));
    if (drawCount > 0) {
      let drawn = 0;
      for (let index = 0; index < drawCount; index += 1) {
        const result = blindDrawCardForPlayer(player);
        if (result.ok) drawn += 1;
      }
      messages.push(`${drawn}/${drawCount}盲抽`);
      irreversible = { code: "hidden_card_reveal", reason: "盲抽翻出新牌" };
    }
    if (reward.panelSymbol && reward.panelSymbolSlotId) {
      const symbolResult = runezu?.takePanelSymbol?.(alienGameState, reward.panelSymbolSlotId, player, {
        refill: Boolean(reward.refillPanelSymbol),
      });
      if (symbolResult?.ok) {
        messages.push(symbolResult.message);
      } else {
        messages.push(symbolResult?.message || "无白框symbol");
      }
    }
    if (reward.symbolId) {
      runezu?.gainPlayerSymbol?.(player, reward.symbolId);
      messages.push(`获得${runezu?.formatSymbolLabel?.(reward.symbolId) || reward.symbolId}`);
    }
    if (reward.pickAlienCard) messages.push("外星人牌");
    if (reward.pickCard) messages.push("精选1张牌");
    return {
      ok: true,
      undoable: !irreversible,
      irreversible,
      message: `${label}：${messages.join("、") || "无奖励"}`,
    };
  }

  function applyRunezuSymbolReward(player, symbolId, label = "符文族symbol奖励") {
    const resolved = runezu?.getTraceFaceRewardForSymbol?.(alienGameState, symbolId);
    if (!resolved?.ok) {
      return {
        ok: true,
        undoable: true,
        message: resolved?.message || `${runezu?.formatSymbolLabel?.(symbolId) || symbolId}无可结算黑圈奖励`,
      };
    }
    const result = applyRunezuRewardToPlayer(
      player,
      resolved.reward,
      `${label} ${runezu?.formatSymbolLabel?.(symbolId) || symbolId}(${runezu?.formatFaceSymbolSlotLabel?.(resolved.position) || resolved.position})`,
    );
    return {
      ...result,
      symbolId,
      position: resolved.position,
    };
  }

  function claimRunezuSourceSymbolWithHistory(sourceType, sourceId, player, historyLabel = "获得符文族symbol") {
    if (!runezu || !alienGameState.runezu?.revealInitialized || !sourceType || !sourceId || !player) return null;
    const beforeAlienState = structuredClone(alienGameState);
    const beforePlayerState = structuredClone(playerState);
    const result = runezu.claimSourceSymbol(alienGameState, sourceType, sourceId, player);
    if (!result.ok) return result;
    const alienRestore = historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      `恢复${historyLabel}前外星人状态`,
    );
    const playerRestore = historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      `恢复${historyLabel}前玩家状态`,
    );
    if (quickActionHistory.hasSession() && !actionHistory.hasSession()) {
      recordQuickHistoryCommand(alienRestore);
      recordQuickHistoryCommand(playerRestore);
    } else if (actionHistory.hasSession() || uiRuntimeState.effectStepActive) {
      recordHistoryCommand(alienRestore);
      recordHistoryCommand(playerRestore);
    }
    return result;
  }

  function closeRunezuCardGainDialog() {
    pendingState.runezuCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openRunezuCardGainDialog(options = {}) {
    if (!runezu || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开符文族牌获取窗口" };
    }
    const state = runezu.ensureRunezuState(alienGameState);
    if (state.displayedCardIndex == null) runezu.drawDisplayedCardIndex?.(alienGameState);
    pendingState.runezuCardGain = {
      playerId: options.player?.id || getCurrentPlayer()?.id || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "符文族外星人牌",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "获得符文族牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = "选择当前展示牌、盲抽符文族牌，或取消。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const cardIndex = alienGameState.runezu?.displayedCardIndex;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "scan-target-option-button";
    confirm.dataset.runezuCardGain = "displayed";
    confirm.innerHTML = cardIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${runezu.getCardSrc(cardIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌 ${cardIndex}</small>`;
    confirm.disabled = cardIndex == null;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.runezuCardGain = "blind";
    blind.innerHTML = "盲抽<small>从符文族牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.runezuCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得符文族牌</small>";

    els.scanTargetActions.replaceChildren(confirm, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "符文族牌：请选择获取方式";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

  function finishRunezuCardGain(message, result = null) {
    const pending = pendingState.runezuCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeRunezuCardGainDialog();
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      const existingResult = getCurrentActionEffect().result || {};
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复符文族牌获取前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复符文族牌获取前玩家状态",
      ));
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        events: existingResult.events || [],
        payload: result,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerHand();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return getCurrentActionEffect()?.result || { ok: true, message };
    }
    if (irreversible && pending) {
      beginQuickActionStep("runezu-card", pending.effectLabel || "符文族外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复符文族牌获取前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复符文族牌获取前玩家状态",
      ));
      completeQuickActionStep(message, {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      });
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerHand();
    renderPlayerStats();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return { ok: true, message, result };
  }

  function handleRunezuCardGainChoice(choice) {
    if (!pendingState.runezuCardGain) return { ok: false, message: "没有符文族牌获取流程" };
    const pending = pendingState.runezuCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到符文族牌获取玩家" };
    if (choice === "cancel") {
      return finishRunezuCardGain("已取消符文族外星人牌");
    }
    const result = choice === "blind"
      ? runezu.blindDrawCard(alienGameState)
      : runezu.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      return finishRunezuCardGain(result.message || "符文族牌获取失败", result);
    }
    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    return finishRunezuCardGain(result.message, result);
  }

  function closeAmibaCardGainDialog() {
    pendingState.amibaCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openAmibaCardGainDialog(options = {}) {
    if (!amiba || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开阿米巴牌获取窗口" };
    }
    const state = amiba.ensureAmibaState(alienGameState);
    if (state.displayedCardIndex == null) amiba.drawDisplayedCardIndex(alienGameState);
    pendingState.amibaCardGain = {
      playerId: options.player?.id || getCurrentPlayer()?.id || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "阿米巴外星人牌",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "获得阿米巴牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = "选择当前展示牌、盲抽阿米巴牌，或取消。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const cardIndex = alienGameState.amiba?.displayedCardIndex;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "scan-target-option-button";
    confirm.dataset.amibaCardGain = "displayed";
    confirm.innerHTML = cardIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${amiba.getCardSrc(cardIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌 ${cardIndex}</small>`;
    confirm.disabled = cardIndex == null;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.amibaCardGain = "blind";
    blind.innerHTML = "盲抽<small>从阿米巴牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.amibaCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得阿米巴牌</small>";

    els.scanTargetActions.replaceChildren(confirm, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "阿米巴牌：请选择获取方式";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

  function finishAmibaCardGain(message, result = null) {
    const pending = pendingState.amibaCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeAmibaCardGainDialog();
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      const existingResult = getCurrentActionEffect().result || {};
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复阿米巴牌获取前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复阿米巴牌获取前玩家状态",
      ));
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        events: existingResult.events || [],
        payload: result,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerHand();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return getCurrentActionEffect()?.result || { ok: true, message };
    }
    if (irreversible && pending) {
      beginQuickActionStep("amiba-card", pending.effectLabel || "阿米巴外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复阿米巴牌获取前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复阿米巴牌获取前玩家状态",
      ));
      completeQuickActionStep(message, {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      });
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerHand();
    renderPlayerStats();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return { ok: true, message, result };
  }

  function handleAmibaCardGainChoice(choice) {
    if (!pendingState.amibaCardGain) return { ok: false, message: "没有阿米巴牌获取流程" };
    const pending = pendingState.amibaCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到阿米巴牌获取玩家" };
    if (choice === "cancel") {
      return finishAmibaCardGain("已取消阿米巴外星人牌");
    }
    const result = choice === "blind"
      ? amiba.blindDrawCard(alienGameState)
      : amiba.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      return finishAmibaCardGain(result.message || "阿米巴牌获取失败", result);
    }
    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    return finishAmibaCardGain(result.message, result);
  }

  function closeAomomoCardGainDialog() {
    pendingState.aomomoCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openAomomoCardGainDialog(options = {}) {
    if (!aomomo || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开奥陌陌牌获取窗口" };
    }
    const state = aomomo.ensureAomomoState(alienGameState);
    if (state.displayedCardIndex == null) aomomo.drawDisplayedCardIndex(alienGameState);
    pendingState.aomomoCardGain = {
      playerId: options.player?.id || getCurrentPlayer()?.id || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "奥陌陌外星人牌",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
      deferredEvents: Array.isArray(options.deferredEvents) ? options.deferredEvents : [],
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "获得奥陌陌牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = "选择当前展示牌、盲抽奥陌陌牌，或取消。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const cardIndex = alienGameState.aomomo?.displayedCardIndex;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "scan-target-option-button";
    confirm.dataset.aomomoCardGain = "displayed";
    confirm.innerHTML = cardIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${aomomo.getCardSrc(cardIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌 ${cardIndex}</small>`;
    confirm.disabled = cardIndex == null;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.aomomoCardGain = "blind";
    blind.innerHTML = "盲抽<small>从奥陌陌牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.aomomoCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得奥陌陌牌</small>";

    els.scanTargetActions.replaceChildren(confirm, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "奥陌陌牌：请选择获取方式";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

  function finishAomomoCardGain(message, result = null) {
    const pending = pendingState.aomomoCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeAomomoCardGainDialog();
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      const existingResult = getCurrentActionEffect().result || {};
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复奥陌陌牌获取前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复奥陌陌牌获取前玩家状态",
      ));
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        events: existingResult.events || [],
        payload: result,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerHand();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return getCurrentActionEffect()?.result || { ok: true, message };
    }
    if (irreversible && pending) {
      beginQuickActionStep("aomomo-card", pending.effectLabel || "奥陌陌外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复奥陌陌牌获取前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复奥陌陌牌获取前玩家状态",
      ));
      completeQuickActionStep(message, {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      });
    }
    rocketState.statusNote = message;
    if (pending?.deferredEvents?.length) {
      settleCardTasksAfterEffect({ events: pending.deferredEvents, render: false });
    }
    renderAlienPanels();
    renderPlayerHand();
    renderPlayerStats();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return { ok: true, message, result };
  }

  function handleAomomoCardGainChoice(choice) {
    if (!pendingState.aomomoCardGain) return { ok: false, message: "没有奥陌陌牌获取流程" };
    const pending = pendingState.aomomoCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到奥陌陌牌获取玩家" };
    if (choice === "cancel") {
      return finishAomomoCardGain("已取消奥陌陌外星人牌");
    }
    const result = choice === "blind"
      ? aomomo.blindDrawCard(alienGameState)
      : aomomo.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      return finishAomomoCardGain(result.message || "奥陌陌牌获取失败", result);
    }
    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    return finishAomomoCardGain(result.message, result);
  }

  function closeAmibaSymbolChoiceDialog() {
    pendingState.amibaSymbolChoice = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openAmibaSymbolChoiceDialog(options = {}) {
    if (!amiba || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开阿米巴 symbol 选择窗口" };
    }
    const player = options.player || getCurrentPlayer();
    if (!player) return { ok: false, message: "没有当前玩家" };
    const region = options.region || options.effect?.options?.region || null;
    const symbols = amiba.listSymbolsInRegion(alienGameState, region);
    pendingState.amibaSymbolChoice = {
      region,
      playerId: player.id,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      triggerMatch: options.triggerMatch || null,
      effectLabel: options.effectLabel || options.effect?.label || "阿米巴 symbol 奖励",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
      beforeCardState: options.beforeCardState || structuredClone(cardState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "阿米巴 symbol";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = `选择一个${amiba.formatRegionLabel(region)}区域内的 symbol 结算奖励。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const nodes = symbols.map((symbol) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button amiba-symbol-choice-button";
      button.dataset.amibaSymbolChoice = symbol.slotId;
      button.innerHTML = `<img class="amiba-symbol-choice-image" src="${amiba.getSymbolSrc(symbol.symbolId)}" alt="" aria-hidden="true"><small>${symbol.symbolId}：${amiba.formatSymbolReward(symbol.symbolId)}；${amiba.formatSymbolSlotLabel?.(symbol.slotId) || symbol.slotId}</small>`;
      return button;
    });
    if (!nodes.length) {
      const empty = document.createElement("p");
      empty.textContent = "该区域当前没有 symbol。";
      nodes.push(empty);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.amibaSymbolChoice = "cancel";
    cancel.innerHTML = "取消<small>不结算 symbol</small>";
    nodes.push(cancel);

    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "阿米巴 symbol：请选择一个 symbol";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

  function finishAmibaSymbolChoice(message, payload = {}, options = {}) {
    const pending = pendingState.amibaSymbolChoice;
    closeAmibaSymbolChoiceDialog();
    if (pending?.triggerMatch?.card && pending?.triggerMatch?.trigger && options.consumeTrigger !== false) {
      cardEffects.consumeTrigger(pending.triggerMatch.card, pending.triggerMatch.trigger.id);
      discardReservedCardIfFinished(getPlayerById(pending.playerId) || getCurrentPlayer(), pending.triggerMatch.card);
    }
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      getCurrentActionEffect().result = {
        ok: true,
        undoable: options.undoable !== false,
        message,
        payload,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCardsFromTaskState();
      completeCurrentActionEffect();
      renderStateReadout();
      return { ok: true, message, payload };
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    if (pending?.triggerMatch && continueAfterCardTriggerResolution()) {
      return { ok: true, message, payload };
    }
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message, payload };
  }

  function handleAmibaSymbolChoice(choice) {
    if (!pendingState.amibaSymbolChoice) return { ok: false, message: "没有阿米巴 symbol 选择流程" };
    const pending = pendingState.amibaSymbolChoice;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到阿米巴 symbol 玩家" };
    if (choice === "cancel") {
      return finishAmibaSymbolChoice("已取消阿米巴 symbol 奖励", { cancelled: true }, { consumeTrigger: false });
    }
    const beforeAlienState = pending.beforeAlienState;
    const beforePlayerState = pending.beforePlayerState;
    const beforeCardState = pending.beforeCardState;
    const slotId = String(choice || "");
    const result = amiba.resolveSymbolAtSlot(alienGameState, slotId);
    if (!result.ok) {
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }
    const rewardResult = applyAmibaRewardToPlayer(player, result.reward, `${pending.effectLabel} ${result.symbolId}`);
    const message = `${rewardResult.message}；${result.message}`;

    if (pending.fromEffectFlow) {
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复阿米巴 symbol 前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复阿米巴 symbol 前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        cardState,
        beforeCardState,
        "恢复阿米巴 symbol 前牌区状态",
      ));
    } else {
      beginQuickActionStep("amiba-symbol", pending.effectLabel);
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复阿米巴 symbol 前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复阿米巴 symbol 前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        cardState,
        beforeCardState,
        "恢复阿米巴 symbol 前牌区状态",
      ));
      if (pending?.triggerMatch?.card && pending?.triggerMatch?.trigger) {
        cardEffects.consumeTrigger(pending.triggerMatch.card, pending.triggerMatch.trigger.id);
        discardReservedCardIfFinished(player, pending.triggerMatch.card);
      }
      completeQuickActionStep(message, rewardResult.irreversible ? {
        irreversibleCode: rewardResult.irreversible.code,
        irreversibleReason: rewardResult.irreversible.reason,
      } : {});
    }
    return finishAmibaSymbolChoice(message, { symbol: result }, {
      undoable: rewardResult.undoable !== false,
      consumeTrigger: pending.fromEffectFlow,
    });
  }

  function closeAmibaTraceRemovalDialog() {
    pendingState.amibaTraceRemoval = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openAmibaTraceRemovalDialog(effect) {
    if (!amiba || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开阿米巴痕迹移除窗口" };
    }
    const player = getCurrentPlayer();
    const alienSlotId = alienGameState.amiba?.revealedSlotId;
    const options = amiba.listPlayerTraceOptions(alienGameState, alienSlotId, player);
    pendingState.amibaTraceRemoval = {
      playerId: player.id,
      alienSlotId,
      effectLabel: effect.label,
      beforeAlienState: structuredClone(alienGameState),
      beforePlayerState: structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "移除阿米巴痕迹";
    if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择一个自己的阿米巴痕迹，按被移除的颜色结算对应区域奖励。";
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    const nodes = options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button";
      button.dataset.amibaTraceRemove = `${option.traceType}:${option.position}`;
      button.innerHTML = `${option.label}<small>${amiba.formatRegionLabel(option.region)}区域奖励</small>`;
      return button;
    });
    if (!nodes.length) {
      const empty = document.createElement("p");
      empty.textContent = "你没有可移除的阿米巴痕迹。";
      nodes.push(empty);
    }
    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "阿米巴：请选择要移除的痕迹";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

  function handleAmibaTraceRemovalChoice(choice) {
    if (!pendingState.amibaTraceRemoval) return { ok: false, message: "没有阿米巴痕迹移除流程" };
    const pending = pendingState.amibaTraceRemoval;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到阿米巴痕迹玩家" };
    if (choice === "cancel") {
      closeAmibaTraceRemovalDialog();
      rocketState.statusNote = "已取消阿米巴痕迹移除";
      if (getCurrentActionEffect()) {
        getCurrentActionEffect().result = { ok: true, undoable: true, message: rocketState.statusNote };
        completeCurrentActionEffect();
      }
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }
    const [traceType, positionText] = String(choice || "").split(":");
    beginEffectHistoryStep(pending.effectLabel || "阿米巴痕迹移除");
    const removeResult = amiba.removePlayerTrace(alienGameState, pending.alienSlotId, traceType, Number(positionText), player);
    if (!removeResult.ok) {
      endEffectHistoryStep();
      rocketState.statusNote = removeResult.message;
      renderStateReadout();
      return removeResult;
    }
    const rewardResult = applyAmibaRewardToPlayer(player, removeResult.reward, removeResult.message);
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      pending.beforeAlienState,
      "恢复阿米巴移除痕迹前外星人状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      pending.beforePlayerState,
      "恢复阿米巴移除痕迹前玩家状态",
    ));
    closeAmibaTraceRemovalDialog();
    const message = rewardResult.message;
    if (getCurrentActionEffect()) {
      getCurrentActionEffect().result = {
        ok: true,
        undoable: true,
        message,
        payload: { removed: removeResult },
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return { ok: true, message };
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerStats();
    renderStateReadout();
    return { ok: true, message };
  }

  function applyChongFossilRewardToPlayer(player, fossilId, label = "虫族化石", repeat = 1) {
    const total = Math.max(1, Math.round(Number(repeat) || 1));
    const reward = chong?.getFossilReward?.(fossilId);
    if (!reward) return { ok: false, message: `找不到化石奖励 ${fossilId}` };
    const messages = [];
    let irreversible = null;
    for (let index = 0; index < total; index += 1) {
      const result = applyChongRewardToPlayer(player, reward, `${label}${total > 1 ? ` ${index + 1}/${total}` : ""}`);
      if (result.message) messages.push(result.message);
      if (result.irreversible) irreversible = result.irreversible;
    }
    return {
      ok: true,
      reward,
      undoable: !irreversible,
      irreversible,
      message: messages.join("；"),
    };
  }

  function closeYichangdianCardGainDialog() {
    pendingState.yichangdianCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openYichangdianCardGainDialog(options = {}) {
    if (!yichangdian || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开异常点牌窗口" };
    }
    const player = options.player || getCurrentPlayer();
    if (!player) return { ok: false, message: "没有当前玩家" };
    pendingState.yichangdianCardGain = {
      playerId: player.id,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "异常点外星人牌",
      beforePlayerState: options.beforePlayerState || null,
      beforeAlienState: options.beforeAlienState || null,
    };

    const displayedIndex = alienGameState.yichangdian?.displayedCardIndex;
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "异常点外星人牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = `${player.colorLabel}玩家可以拿取当前展示牌、盲抽一张异常点牌，或取消。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = true;

    const nodes = [];
    const displayed = document.createElement("button");
    displayed.type = "button";
    displayed.className = "scan-target-option-button jiuzhe-card-option yichangdian-card-option";
    displayed.dataset.yichangdianCardGain = "displayed";
    displayed.disabled = displayedIndex == null;
    displayed.innerHTML = displayedIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${yichangdian.getCardSrc(displayedIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌</small>`;
    nodes.push(displayed);

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.yichangdianCardGain = "blind";
    blind.innerHTML = "盲抽<small>从异常点牌堆随机获得 1 张</small>";
    nodes.push(blind);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.yichangdianCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得外星人牌</small>";
    nodes.push(cancel);

    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    return { ok: true, message: "异常点牌窗口已打开" };
  }

  function finishYichangdianCardGain(message, result = null) {
    const pending = pendingState.yichangdianCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeYichangdianCardGainDialog();
    rocketState.statusNote = message;
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        payload: { yichangdianCard: result?.card || null },
      };
      completeCurrentActionEffect();
    }
    renderAlienPanels();
    renderRockets();
    renderPlayerStats();
    renderPlayerHand();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return result || { ok: true, message };
  }

  function handleYichangdianCardGainChoice(choice) {
    if (!pendingState.yichangdianCardGain) return { ok: false, message: "没有异常点牌获取流程" };
    const pending = pendingState.yichangdianCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到异常点牌玩家" };

    if (choice === "cancel") {
      return finishYichangdianCardGain("已取消异常点外星人牌");
    }

    const beforePlayerState = pending.beforePlayerState || structuredClone(playerState);
    const beforeAlienState = pending.beforeAlienState || structuredClone(alienGameState);
    const result = choice === "blind"
      ? yichangdian.blindDrawCard(alienGameState)
      : yichangdian.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    const irreversible = getAlienCardGainIrreversible(result);
    if (!pending.fromEffectFlow) {
      beginQuickActionStep("yichangdian-card", pending.effectLabel || "异常点外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复异常点拿牌前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复异常点拿牌前外星人状态",
      ));
      completeQuickActionStep(null, irreversible ? {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      } : {});
    }
    return finishYichangdianCardGain(result.message, result);
  }

  function closeBanrenmaCardGainDialog() {
    pendingState.banrenmaCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openBanrenmaCardGainDialog(options = {}) {
    if (!banrenma || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开半人马牌窗口" };
    }
    const player = options.player || getCurrentPlayer();
    if (!player) return { ok: false, message: "没有当前玩家" };
    pendingState.banrenmaCardGain = {
      playerId: player.id,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "半人马外星人牌",
      beforePlayerState: options.beforePlayerState || null,
      beforeAlienState: options.beforeAlienState || null,
      baseResult: options.baseResult || null,
    };

    const displayedIndex = alienGameState.banrenma?.displayedCardIndex;
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "半人马外星人牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = `${player.colorLabel}玩家可以拿取当前展示牌，或盲抽一张半人马牌。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = true;

    const displayed = document.createElement("button");
    displayed.type = "button";
    displayed.className = "scan-target-option-button jiuzhe-card-option banrenma-card-option";
    displayed.dataset.banrenmaCardGain = "displayed";
    displayed.disabled = displayedIndex == null;
    displayed.innerHTML = displayedIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${banrenma.getCardSrc(displayedIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌</small>`;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.banrenmaCardGain = "blind";
    blind.innerHTML = "盲抽<small>从半人马牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.banrenmaCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得外星人牌</small>";

    els.scanTargetActions.replaceChildren(displayed, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    return { ok: true, message: "半人马牌窗口已打开" };
  }

  function finishBanrenmaCardGain(message, result = null) {
    const pending = pendingState.banrenmaCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    const baseResult = pending?.baseResult || null;
    const combinedMessage = [baseResult?.message, message].filter(Boolean).join("；") || message;
    closeBanrenmaCardGainDialog();
    rocketState.statusNote = combinedMessage;
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible && baseResult?.undoable !== false,
        irreversible,
        message: combinedMessage,
        payload: { ...(baseResult?.payload || {}), banrenmaCard: result?.card || null },
      };
      completeCurrentActionEffect();
    }
    renderAlienPanels();
    renderRockets();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    maybeContinueAlienRevealQueuedOpportunities();
    renderStateReadout();
    return result || { ok: true, message };
  }

  function handleBanrenmaCardGainChoice(choice) {
    if (!pendingState.banrenmaCardGain) return { ok: false, message: "没有半人马牌获取流程" };
    const pending = pendingState.banrenmaCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到半人马牌玩家" };

    if (choice === "cancel") {
      return finishBanrenmaCardGain("已取消半人马外星人牌");
    }

    const beforePlayerState = pending.beforePlayerState || structuredClone(playerState);
    const beforeAlienState = pending.beforeAlienState || structuredClone(alienGameState);
    const result = choice === "blind"
      ? banrenma.blindDrawCard(alienGameState)
      : banrenma.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    const irreversible = getAlienCardGainIrreversible(result);
    if (!pending.fromEffectFlow) {
      beginQuickActionStep("banrenma-card", pending.effectLabel || "半人马外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复半人马拿牌前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复半人马拿牌前外星人状态",
      ));
      completeQuickActionStep(null, irreversible ? {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      } : {});
    }
    return finishBanrenmaCardGain(result.message, result);
  }

  function closeChongCardGainDialog() {
    pendingState.chongCardGain = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openChongCardGainDialog(options = {}) {
    if (!chong || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开虫族牌获取窗口" };
    }
    const state = chong.ensureChongState(alienGameState);
    if (state.displayedCardIndex == null) chong.drawDisplayedCardIndex(alienGameState);
    pendingState.chongCardGain = {
      playerId: options.player?.id || getCurrentPlayer()?.id || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "虫族外星人牌",
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "获得虫族牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = "选择当前展示牌、盲抽虫族牌，或取消。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const cardIndex = alienGameState.chong?.displayedCardIndex;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "scan-target-option-button jiuzhe-card-option chong-card-option";
    confirm.dataset.chongCardGain = "displayed";
    confirm.innerHTML = cardIndex == null
      ? "确认<small>当前没有展示牌</small>"
      : `<img class="jiuzhe-card-option-image" src="${chong.getCardSrc(cardIndex)}" alt="" aria-hidden="true"><small>确认拿取展示牌 ${cardIndex}</small>`;
    confirm.disabled = cardIndex == null;

    const blind = document.createElement("button");
    blind.type = "button";
    blind.className = "scan-target-option-button";
    blind.dataset.chongCardGain = "blind";
    blind.innerHTML = "盲抽<small>从虫族牌堆随机获得 1 张</small>";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.chongCardGain = "cancel";
    cancel.innerHTML = "取消<small>不获得虫族牌</small>";

    els.scanTargetActions.replaceChildren(confirm, blind, cancel);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "虫族牌：请选择获取方式";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

  function finishChongCardGain(message, result = null) {
    const pending = pendingState.chongCardGain;
    const irreversible = getAlienCardGainIrreversible(result);
    closeChongCardGainDialog();
    if (pending?.fromEffectFlow && getCurrentActionEffect()) {
      if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复虫族牌获取前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复虫族牌获取前玩家状态",
      ));
      getCurrentActionEffect().result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message,
        payload: result,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderPlayerHand();
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return getCurrentActionEffect()?.result || { ok: true, message };
    }
    if (irreversible && pending) {
      beginQuickActionStep("chong-card", pending.effectLabel || "虫族外星人牌");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        pending.beforeAlienState,
        "恢复虫族牌获取前外星人状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复虫族牌获取前玩家状态",
      ));
      completeQuickActionStep(message, {
        irreversibleCode: irreversible.code,
        irreversibleReason: irreversible.reason,
      });
    }
    rocketState.statusNote = message;
    renderAlienPanels();
    renderPlayerHand();
    renderPlayerStats();
    updateActionButtons();
    maybeContinuePendingTurnEndRevealFlow();
    renderStateReadout();
    return { ok: true, message, result };
  }

  function handleChongCardGainChoice(choice) {
    if (!pendingState.chongCardGain) return { ok: false, message: "没有虫族牌获取流程" };
    const pending = pendingState.chongCardGain;
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) return { ok: false, message: "找不到虫族牌获取玩家" };
    if (choice === "cancel") {
      return finishChongCardGain("已取消虫族外星人牌");
    }
    const result = choice === "blind"
      ? chong.blindDrawCard(alienGameState)
      : chong.takeDisplayedCard(alienGameState);
    if (!result.ok || !result.card) {
      return finishChongCardGain(result.message || "虫族牌获取失败", result);
    }
    player.hand.push(result.card);
    player.resources.handSize = player.hand.length;
    return finishChongCardGain(result.message, result);
  }

  function getChongPlanetLabel(planetId) {
    const labels = {
      earth: "地球",
      mars: "火星",
      jupiter: "木星",
      saturn: "土星",
    };
    return planetRewards?.PLANET_NAMES?.[planetId] || labels[planetId] || planetId || "星球";
  }

  function formatChongGain(gain = {}) {
    const parts = [];
    if (gain.score != null) parts.push(`${gain.score}分`);
    if (gain.credits != null) parts.push(`${gain.credits}信用点`);
    if (gain.energy != null) parts.push(`${gain.energy}能量`);
    if (gain.publicity != null) parts.push(`${gain.publicity}宣传`);
    if (gain.additionalPublicScan != null) parts.push(`${gain.additionalPublicScan}额外公共扫描`);
    if (gain.handSize != null) parts.push(`${gain.handSize}张牌`);
    if (gain.availableData != null) parts.push(`${gain.availableData}数据`);
    return parts.join(" + ");
  }

  function formatChongFossilRewardSummary(fossilId) {
    const reward = chong?.getFossilReward?.(fossilId);
    if (!reward) return "未知奖励";
    const parts = [];
    if (Object.keys(reward.gain || {}).length) parts.push(formatChongGain(reward.gain));
    if (reward.dataCount) parts.push(`${reward.dataCount}数据`);
    if (reward.drawCards) parts.push(`${reward.drawCards}盲抽`);
    if (reward.pickCard) parts.push("精选1张牌");
    if (reward.pickAlienCard) parts.push("外星人牌");
    return parts.join(" + ") || "无奖励";
  }

  function restoreMutableObject(target, snapshot) {
    if (!target || !snapshot) return;
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, structuredClone(snapshot));
  }

  function closeChongFossilChoiceDialog() {
    pendingState.chongFossilChoice = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function closeChongTaskCompletionDialog() {
    pendingState.chongTaskCompletion = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openChongFossilChoiceDialog(options = {}) {
    if (!chong || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开虫族化石选择窗口" };
    }
    const player = options.player || getCurrentPlayer();
    if (!player) return { ok: false, message: "没有当前玩家" };

    const planetIds = options.planetIds?.length
      ? options.planetIds
      : options.planetId
        ? [options.planetId]
        : ["jupiter", "saturn"];
    for (const planetId of planetIds) {
      chong.revealPlanetFossilsToPlayer(alienGameState, planetId, player);
    }
    const fossils = Array.isArray(options.fossils)
      ? options.fossils.filter(Boolean)
      : planetIds.flatMap((planetId) => chong.getAvailablePlanetFossils(alienGameState, planetId));
    pendingState.chongFossilChoice = {
      mode: options.mode || "reward",
      playerId: player.id,
      planetIds,
      planetId: options.planetId || null,
      task: options.task || null,
      card: options.card || null,
      fromEffectFlow: Boolean(options.fromEffectFlow),
      effectLabel: options.effectLabel || "虫族化石",
      beforePlayerState: options.beforePlayerState || structuredClone(playerState),
      beforeAlienState: options.beforeAlienState || structuredClone(alienGameState),
      beforeCardState: options.beforeCardState || structuredClone(cardState),
    };

    if (els.scanTargetTitle) els.scanTargetTitle.textContent = options.title || "选择虫族化石";
    if (els.scanTargetSubtitle) {
      const planetText = planetIds.map(getChongPlanetLabel).join(" / ");
      els.scanTargetSubtitle.textContent = options.subtitle || `${planetText} 的化石已查看。选择 1 枚继续。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;

    const nodes = fossils.map((fossil) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button chong-fossil-choice-button";
      button.dataset.chongFossilChoice = fossil.fossilId;
      const fossilPlanetId = fossil.currentPlanetId || fossil.planetId || options.planetId || planetIds[0] || null;
      const planetLabel = getChongPlanetLabel(fossilPlanetId);
      const sourceLabel = fossil.rewardChoiceSource === "transport" || fossil.status === "transported"
        ? `${planetLabel} 搬运化石`
        : planetLabel;
      const summary = formatChongFossilRewardSummary(fossil.fossilId);
      button.setAttribute("aria-label", `${sourceLabel} ${fossil.fossilId}：${summary}`);
      button.title = `${sourceLabel} ${fossil.fossilId}：${summary}`;

      const image = document.createElement("img");
      image.className = "chong-fossil-choice-image";
      image.src = chong.getFossilSrc(fossil.fossilId);
      image.alt = `${sourceLabel} ${fossil.fossilId}`;
      image.width = 128;
      image.height = 128;
      image.decoding = "async";

      const meta = document.createElement("small");
      meta.textContent = summary;
      button.append(image, meta);
      return button;
    });
    if (!nodes.length) {
      const empty = document.createElement("p");
      empty.textContent = "没有可用化石。";
      nodes.push(empty);
    }
    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "虫族化石：请选择 1 枚化石";
    renderAlienPanels();
    renderStateReadout();
    return { ok: true, awaitingChoice: true, fossils, message: rocketState.statusNote };
  }

  function createChongTransportTokenForFossil(fossil, player) {
    const sector = getPlanetSectorCoordinate(fossil.planetId);
    const tokenResult = rocketActions.createMovableTokenAtSector(rocketState, sector, {
      kind: rocketActions.ROCKET_KIND.CHONG_FOSSIL,
      playerId: player.id,
      color: player.color,
      tokenSrc: chong.FOSSIL_BACK_SRC,
      fossilId: fossil.fossilId,
      label: fossil.fossilId,
      cargo: {
        alien: "chong",
        fossilId: fossil.fossilId,
      },
    });
    if (!tokenResult.ok) return tokenResult;
    chong.attachTransportRocket(alienGameState, fossil.fossilId, tokenResult.rocket.id);
    return tokenResult;
  }

  function openChongPickCardFollowUp(player, fromEffectFlow, effectLabel) {
    return beginCardSelection({
      type: "chong_pick_card",
      player,
      allowBlindDraw: true,
      fromEffectFlow,
      effectLabel,
      beforePlayerState: structuredClone(playerState),
      beforeCardState: structuredClone(cardState),
      logBefore: createActionLogImpactSnapshot(),
    });
  }

  function keepExistingMainActionPendingAfterChongTask() {
    if (actionHistory.hasSession()) {
      markActionPending();
    }
  }

  function failChongTaskCompletion(message) {
    rocketState.statusNote = message || "虫族任务完成失败";
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    return { ok: false, message: rocketState.statusNote };
  }

  function finishChongFossilEffect(message, payload = {}, options = {}) {
    const currentEffect = getCurrentActionEffect();
    if (currentEffect && options.completeEffect !== false) {
      currentEffect.result = {
        ok: true,
        undoable: options.undoable !== false,
        message,
        payload,
      };
      rocketState.statusNote = message;
      renderAlienPanels();
      renderRockets();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCardsFromTaskState();
      completeCurrentActionEffect();
      renderStateReadout();
    } else {
      rocketState.statusNote = message;
      renderAlienPanels();
      renderRockets();
      renderPlayerStats();
      renderPlayerHand();
      renderReservedCardsFromTaskState();
      updateActionButtons();
      renderStateReadout();
    }
    return { ok: true, message, payload };
  }

  function completeChongTraceTaskWithFossil(pending, fossilId, player) {
    const card = pending.card;
    const task = pending.task || card?.chongTask;
    const rewardResult = applyChongFossilRewardToPlayer(
      player,
      fossilId,
      `完成 ${cards.getCardLabel(card)}：${fossilId}`,
    );
    if (!rewardResult.ok) {
      closeChongFossilChoiceDialog();
      return failChongTaskCompletion(rewardResult.message || "虫族化石奖励结算失败");
    }
    card.chongTaskCompleted = true;
    removeReservedCardToDiscard(player, card);
    incrementCompletedTaskCount(player);

    beginQuickActionStep("chong-trace-task", `完成虫族任务：${cards.getCardLabel(card)}`);
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      pending.beforePlayerState,
      "恢复虫族任务前玩家状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      pending.beforeAlienState,
      "恢复虫族任务前外星人状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      cardState,
      pending.beforeCardState,
      "恢复虫族任务前牌区状态",
    ));

    const message = `${rewardResult.message || "虫族任务完成"}；${task?.traceType ? "按痕迹任务结算化石奖励" : ""}`;
    completeQuickActionStep(message, rewardResult.irreversible ? {
      irreversibleCode: rewardResult.irreversible.code,
      irreversibleReason: rewardResult.irreversible.reason,
    } : {});
    keepExistingMainActionPendingAfterChongTask();
    closeChongFossilChoiceDialog();
    let finalMessage = message;
    if (rewardResult.reward?.pickCard) {
      const pickResult = openChongPickCardFollowUp(player, false, `完成 ${cards.getCardLabel(card)}`);
      finalMessage = pickResult.ok
        ? `${message}；请选择公共牌或盲抽`
        : `${message}；${pickResult.message || "无法打开虫族奖励精选"}`;
    }
    rocketState.statusNote = finalMessage;
    renderAlienPanels();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message: finalMessage };
  }

  function completeChongTransportTask(pending, player) {
    const card = pending.card;
    const ready = getReadyChongTaskForReservedCard(card, player) || pending.ready;
    const delivered = ready?.deliveredTransport;
    const rocketId = delivered?.rocketId;
    if (!ready || !Number.isInteger(rocketId)) {
      closeChongTaskCompletionDialog();
      return failChongTaskCompletion("没有已送达的虫族化石任务");
    }

    const beforePlayerState = pending.beforePlayerState || structuredClone(playerState);
    const beforeAlienState = pending.beforeAlienState || structuredClone(alienGameState);
    const beforeRocketState = pending.beforeRocketState || structuredClone(rocketState);
    const beforeCardState = pending.beforeCardState || structuredClone(cardState);
    const result = chong.completeTransportedFossil(alienGameState, rocketId, {
      cardId: card?.id || null,
      destinationPlanetId: ready?.task?.destinationPlanetId || null,
      task: ready?.task || null,
    });
    if (!result.ok) {
      closeChongTaskCompletionDialog();
      return failChongTaskCompletion(result.message);
    }

    rocketActions.removeRocket(rocketState, rocketId);
    removeRocketElement(rocketId);
    card.chongTaskCompleted = true;
    removeReservedCardToDiscard(player, card);
    incrementCompletedTaskCount(player);

    beginQuickActionStep("chong-transport-task", `完成虫族任务：${cards.getCardLabel(card)}`);
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      "恢复虫族任务前玩家状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复虫族任务前外星人状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreRocketStateCommand(
      rocketState,
      beforeRocketState,
      "恢复虫族任务前棋子状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      cardState,
      beforeCardState,
      "恢复虫族任务前牌区状态",
    ));

    const messages = [result.message, `完成任务：${cards.getCardLabel(card)}`];
    let shouldOpenPickCard = Boolean(result.task?.pickCard);
    let irreversible = null;
    if (result.task?.fossilRewardRepeat) {
      const fossilReward = applyChongFossilRewardToPlayer(
        player,
        result.fossil.fossilId,
        `完成 ${cards.getCardLabel(card)}：${result.fossil.fossilId}`,
        result.task.fossilRewardRepeat,
      );
      if (fossilReward.message) messages.push(fossilReward.message);
      if (fossilReward.reward?.pickCard) shouldOpenPickCard = true;
      if (fossilReward.irreversible) irreversible = fossilReward.irreversible;
    }
    const taskReward = applyChongRewardToPlayer(player, result.task || {}, "虫族搬运任务");
    if (taskReward.message && !/无奖励$/.test(taskReward.message)) messages.push(taskReward.message);
    if (taskReward.irreversible) irreversible = taskReward.irreversible;
    const message = messages.join("；");
    completeQuickActionStep(message, irreversible ? {
      irreversibleCode: irreversible.code,
      irreversibleReason: irreversible.reason,
    } : {});
    keepExistingMainActionPendingAfterChongTask();
    closeChongTaskCompletionDialog();

    let finalMessage = message;
    if (shouldOpenPickCard) {
      const pickResult = openChongPickCardFollowUp(player, false, `完成 ${cards.getCardLabel(card)}`);
      finalMessage = pickResult.ok
        ? `${message}；请选择公共牌或盲抽`
        : `${message}；${pickResult.message || "无法打开虫族奖励精选"}`;
    }
    rocketState.statusNote = finalMessage;
    renderAlienPanels();
    renderRockets();
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message: finalMessage };
  }

  function handleChongTaskCompletionChoice(choice) {
    const pending = pendingState.chongTaskCompletion;
    if (!pending) return failChongTaskCompletion("没有虫族任务完成流程");
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) {
      closeChongTaskCompletionDialog();
      return failChongTaskCompletion("找不到虫族任务玩家");
    }
    if (choice === "cancel") {
      closeChongTaskCompletionDialog();
      rocketState.statusNote = "已取消虫族任务完成";
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }
    return completeChongTransportTask(pending, player);
  }

  function handleChongFossilChoice(choice) {
    const pending = pendingState.chongFossilChoice;
    if (!pending) return failChongTaskCompletion("没有虫族化石选择流程");
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    if (!player) {
      closeChongFossilChoiceDialog();
      return failChongTaskCompletion("找不到虫族化石玩家");
    }

    if (choice === "cancel") {
      closeChongFossilChoiceDialog();
      const message = "已取消虫族化石选择";
      if (pending.fromEffectFlow) {
        return finishChongFossilEffect(message, { cancelled: true });
      }
      rocketState.statusNote = message;
      renderStateReadout();
      return { ok: true, message };
    }

    const fossilId = String(choice || "");
    const beforeAlienState = pending.beforeAlienState;
    const beforePlayerState = pending.beforePlayerState;
    if (pending.fromEffectFlow && !uiRuntimeState.effectStepActive) {
      beginEffectHistoryStep(pending.effectLabel || "虫族化石");
    }
    if (pending.fromEffectFlow || pending.mode === "pickup" || pending.mode === "reward") {
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复虫族化石前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复虫族化石前玩家状态",
      ));
    }

    if (pending.mode === "pickup") {
      const pickup = chong.pickUpFossil(alienGameState, fossilId, player, pending.task || {}, {
        cardId: pending.card?.id || null,
        cardLabel: pending.card ? cards.getCardLabel(pending.card) : null,
      });
      if (!pickup.ok) {
        restoreMutableObject(alienGameState, beforeAlienState);
        rocketState.statusNote = pickup.message;
        renderStateReadout();
        return pickup;
      }
      const tokenResult = createChongTransportTokenForFossil(pickup.fossil, player);
      if (!tokenResult.ok) {
        restoreMutableObject(alienGameState, beforeAlienState);
        rocketState.statusNote = tokenResult.message;
        renderStateReadout();
        return tokenResult;
      }
      closeChongFossilChoiceDialog();
      const message = `${pickup.message}；${tokenResult.message}`;
      return finishChongFossilEffect(message, {
        fossilId,
        rocketId: tokenResult.rocket.id,
        task: pending.task || null,
      });
    }

    if (pending.mode === "trace-task") {
      return completeChongTraceTaskWithFossil(pending, fossilId, player);
    }

    const rewardResult = applyChongFossilRewardToPlayer(player, fossilId, `${pending.effectLabel} ${fossilId}`);
    closeChongFossilChoiceDialog();
    if (rewardResult.reward?.pickCard) {
      const pickResult = openChongPickCardFollowUp(player, pending.fromEffectFlow, pending.effectLabel);
      if (pickResult.ok) {
        rocketState.statusNote = `${rewardResult.message}；请选择公共牌`;
        renderPlayerStats();
        renderStateReadout();
        return { ok: true, message: rocketState.statusNote };
      }
    }
    if (pending.fromEffectFlow) {
      return finishChongFossilEffect(rewardResult.message, { fossilId, reward: rewardResult.reward || null });
    }
    rocketState.statusNote = rewardResult.message;
    renderPlayerStats();
    renderStateReadout();
    return rewardResult;
  }

  function openChongTraceTaskCompletionPicker(card) {
    return openCardTaskCompletionPicker(card);
  }

  function enqueueJiuzheOpportunity(player, opportunity) {
    if (!player || !opportunity) return;
    const exists = pendingState.jiuzheOpportunityQueue.some((item) => (
      item.playerId === player.id
      && item.playerColor === player.color
      && item.reason === opportunity.reason
    ));
    if (exists) return;
    pendingState.jiuzheOpportunityQueue.push({
      playerId: player.id,
      playerColor: player.color,
      reason: opportunity.reason,
      label: opportunity.label,
      cost: opportunity.cost || {},
    });
  }

  function isJiuzheThresholdOpportunity(opportunity) {
    return opportunity?.reason === "freeThreshold" || opportunity?.reason === "paidThreshold";
  }

  function createJiuzheThresholdCardEffect(player, opportunity) {
    const playerLabel = player?.colorLabel || player?.name || player?.color || "玩家";
    const reason = opportunity?.reason || "threshold";
    return {
      id: `jiuzhe-threshold-card-${player?.id || player?.color || "player"}-${reason}`,
      type: JIUZHE_THRESHOLD_CARD_EFFECT_TYPE,
      label: `九折碰线打牌：${playerLabel}`,
      icon: "jiuzhe_card_back",
      playerId: player?.id || null,
      playerColor: player?.color || null,
      options: {
        playerId: player?.id || null,
        playerColor: player?.color || null,
        reason,
        label: opportunity?.label || "九折碰线打牌",
        cost: opportunity?.cost || {},
        skippable: false,
      },
      required: true,
      status: "pending",
    };
  }

  function hasJiuzheThresholdEffectQueued(player, reason) {
    if (!pendingState.actionEffectFlow || !player || !reason) return false;
    return (pendingState.actionEffectFlow.effects || []).some((effect) => (
      effect?.type === JIUZHE_THRESHOLD_CARD_EFFECT_TYPE
      && effect.status !== "completed"
      && effect.status !== "skipped"
      && effect.options?.reason === reason
      && (
        effect.options?.playerId === player.id
        || effect.options?.playerColor === player.color
        || effect.playerId === player.id
        || effect.playerColor === player.color
      )
    ));
  }

  function queueJiuzheThresholdEffectForPlayer(player, opportunity) {
    if (!jiuzhe || !player || !isActionEffectFlowActive() || !isJiuzheThresholdOpportunity(opportunity)) return false;
    if (hasJiuzheThresholdEffectQueued(player, opportunity.reason)) return false;
    insertActionEffectsAfterCurrent([createJiuzheThresholdCardEffect(player, opportunity)]);
    renderActionEffectBar();
    return true;
  }

  function queueJiuzheOpportunitiesForPlayer(player) {
    if (!jiuzhe || !player) return;
    const opportunity = jiuzhe.getPendingOpportunity(alienGameState, player);
    if (isActionEffectFlowActive() && isJiuzheThresholdOpportunity(opportunity)) {
      queueJiuzheThresholdEffectForPlayer(player, opportunity);
      return;
    }
    enqueueJiuzheOpportunity(player, opportunity);
  }

  function buildJiuzheCardConditionContext() {
    const probeLocationData = buildProbeLocationIndex();
    return {
      alienGameState,
      planetStatsState,
      nebulaDataState,
      ...buildPlutoMarkerContext(),
      probeLocations: probeLocationData.index,
      probeLocationDetails: probeLocationData.details,
      getPlayerCompanyBaseIncome,
    };
  }

  function getJiuzheCardConditionLabel(card, player) {
    const achieved = jiuzhe?.isCardConditionMet?.(card, player, buildJiuzheCardConditionContext());
    return {
      achieved,
      label: `${card.label || `九折牌 ${card.index}`} · ${card.score || 0}分 · 威胁${card.threat || 0}`,
    };
  }

  function closeJiuzheCardDialog() {
    pendingState.jiuzheCardPlay = null;
    pendingState.jiuzheOpportunityOpen = false;
    setScanTargetActionLayout();
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function buildJiuzheOpportunitySubtitle(player, opportunity) {
    const remaining = Math.max(0, Math.round(Number(opportunity?.remaining) || 0));
    if (opportunity?.reason === "reveal" && remaining > 1) {
      return `${player.colorLabel}玩家拥有 ${remaining} 次免费打出机会，本次可选择 1 张未打出的九折牌，或放弃本次机会。`;
    }
    return `${player.colorLabel}玩家可以选择 1 张未打出的九折牌，或放弃本次机会。`;
  }

  function openJiuzheCardDialog(player, opportunity = null) {
    if (!jiuzhe || !player || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开九折牌窗口" };
    }
    const cardsForPlayer = jiuzhe.getPlayerJiuzheCards(alienGameState, player);
    if (!cardsForPlayer.length) return { ok: false, message: "该玩家没有九折牌" };

    pendingState.jiuzheCardPlay = opportunity
      ? { playerId: player.id, playerColor: player.color, ...opportunity }
      : { playerId: player.id, playerColor: player.color, reason: "view", cost: {}, label: "查看九折牌" };
    pendingState.jiuzheOpportunityOpen = Boolean(opportunity);

    if (els.scanTargetTitle) els.scanTargetTitle.textContent = opportunity ? opportunity.label : "九折牌";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = opportunity
        ? buildJiuzheOpportunitySubtitle(player, opportunity)
        : `${player.colorLabel}玩家的九折牌。蓝框=已打出，金框=条件已达成。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = Boolean(opportunity);
    setScanTargetActionLayout("jiuzhe-card-grid");

    const isRevealOpportunity = opportunity?.reason === "reveal";
    const nodes = cardsForPlayer.map((card) => {
      const status = getJiuzheCardConditionLabel(card, player);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button jiuzhe-card-option";
      button.dataset.jiuzheCardChoice = String(card.index);
      button.disabled = !opportunity || card.played;
      button.classList.toggle("is-reveal-opportunity", Boolean(isRevealOpportunity));
      button.classList.toggle("is-played", Boolean(card.played));
      button.classList.toggle("is-achieved", Boolean(status.achieved));
      button.innerHTML = `
        <img class="jiuzhe-card-option-image" src="${card.src}" alt="" aria-hidden="true">
        <small>${status.label}${card.played ? " · 已打出" : ""}</small>
      `;
      return button;
    });

    if (opportunity) {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "scan-target-option-button";
      skip.dataset.jiuzheOpportunitySkip = "true";
      skip.innerHTML = "放弃本次机会<small>不会打出九折牌</small>";
      nodes.push(skip);
    }

    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    return { ok: true, message: "九折牌窗口已打开" };
  }

  function handleJiuzheCardChoice(cardIndex, options = {}) {
    const pending = pendingState.jiuzheCardPlay;
    if (!jiuzhe || !pending) return { ok: false, message: "没有九折打出机会" };
    const blocked = blockManualAiPendingInputIfNeeded(pending, options, "九折牌");
    if (blocked) return blocked;
    const player = resolvePlayerReference(pending);
    if (!player) return { ok: false, message: "找不到九折牌玩家" };
    if (pending.reason === "view") return { ok: false, message: "当前只是查看九折牌" };

    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const cost = pending.cost || {};
    if (Object.keys(cost).length && !players.canAfford(player, cost)) {
      rocketState.statusNote = `资源不足，需要 ${players.formatResourceCost(cost)}`;
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    if (Object.keys(cost).length) {
      players.spendResources(player, cost);
    }
    const result = jiuzhe.playJiuzheCard(alienGameState, player, cardIndex, {
      reason: pending.reason,
    });
    if (!result.ok) {
      if (Object.keys(cost).length) players.gainResources(player, cost);
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    const fromEffectFlow = Boolean(pending.fromEffectFlow && getCurrentActionEffect());
    const effectLabel = pending.effectLabel || pending.label || getCurrentActionEffect()?.label || "九折打出";
    const effectResult = {
      ok: true,
      undoable: true,
      message: `${pending.label || effectLabel}：${result.message}`,
      payload: {
        reason: pending.reason,
        cardIndex: result.card?.index ?? Number(cardIndex),
        cost,
      },
    };

    if (fromEffectFlow) {
      beginEffectHistoryStep(effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复九折打出前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复九折打出前外星人状态",
      ));
      if (getCurrentActionEffect()) getCurrentActionEffect().result = effectResult;
    } else {
      beginQuickActionStep("jiuzhe-card", pending.label || "九折打出");
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复九折打出前玩家状态",
      ));
      recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复九折打出前外星人状态",
      ));
      completeQuickActionStep();
    }

    rocketState.statusNote = effectResult.message;
    closeJiuzheCardDialog();
    queueJiuzheOpportunitiesForPlayer(player);
    renderPlayerStats();
    renderAlienPanels();
    updateActionButtons();
    renderStateReadout();
    if (fromEffectFlow) {
      completeCurrentActionEffect();
    } else {
      maybeContinueAlienRevealQueuedOpportunities();
    }
    return { ...result, message: effectResult.message };
  }

  function handleJiuzheOpportunitySkip(options = {}) {
    const pending = pendingState.jiuzheCardPlay;
    if (!jiuzhe || !pending) return { ok: false, message: "没有九折打出机会" };
    const blocked = blockManualAiPendingInputIfNeeded(pending, options, "九折牌");
    if (blocked) return blocked;
    const player = resolvePlayerReference(pending);
    if (!player) return { ok: false, message: "找不到九折牌玩家" };
    const beforeAlienState = structuredClone(alienGameState);
    const result = jiuzhe.declineOpportunity(alienGameState, player, pending.reason);
    if (result.ok) {
      const fromEffectFlow = Boolean(pending.fromEffectFlow && getCurrentActionEffect());
      const effectLabel = pending.effectLabel || pending.label || getCurrentActionEffect()?.label || "九折放弃";
      const effectResult = {
        ok: true,
        undoable: true,
        skipped: true,
        message: `${pending.label || effectLabel}：${result.message}`,
        payload: {
          reason: pending.reason,
          skipped: true,
        },
      };
      if (fromEffectFlow) {
        beginEffectHistoryStep(effectLabel);
        recordHistoryCommand(historyCommands.createRestoreObjectCommand(
          alienGameState,
          beforeAlienState,
          "恢复九折放弃前外星人状态",
        ));
        if (getCurrentActionEffect()) getCurrentActionEffect().result = effectResult;
      } else {
        beginQuickActionStep("jiuzhe-card-skip", pending.label || "九折放弃");
        recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
          alienGameState,
          beforeAlienState,
          "恢复九折放弃前外星人状态",
        ));
        completeQuickActionStep();
      }
      rocketState.statusNote = effectResult.message;
      closeJiuzheCardDialog();
      queueJiuzheOpportunitiesForPlayer(player);
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      if (fromEffectFlow) {
        completeCurrentActionEffect();
      } else {
        maybeContinueAlienRevealQueuedOpportunities();
      }
      return { ...result, message: effectResult.message };
    }
    rocketState.statusNote = result.message;
    renderStateReadout();
    return result;
  }

  function maybeOpenQueuedJiuzheOpportunity() {
    if (pendingState.jiuzheOpportunityOpen || pendingState.jiuzheCardPlay) return null;
    if (isActionEffectFlowActive()) return null;
    if (hasActivePendingSubFlow()) return null;
    if (els.scanTargetOverlay && !els.scanTargetOverlay.hidden) return null;
    while (pendingState.jiuzheOpportunityQueue.length) {
      const next = pendingState.jiuzheOpportunityQueue.shift();
      const player = resolvePlayerReference(next);
      if (!player) continue;
      const latest = jiuzhe.getPendingOpportunity(alienGameState, player);
      if (!latest || latest.reason !== next.reason) continue;
      const openResult = openJiuzheCardDialog(player, latest);
      if (openResult?.ok) return openResult;
    }
    return null;
  }

  function getActiveAlienSharedOverlayPendingForManualGuard() {
    const tracePickerMode = String(pendingState.alienTracePickerState?.mode || "");
    const tracePickerHasOwner = Boolean(
      pendingState.alienTracePickerState?.targetPlayerId
      || pendingState.alienTracePickerState?.targetPlayerColor
    );
    const tracePickerPending = tracePickerMode
      && tracePickerMode !== "debug-direct"
      && tracePickerMode !== "reveal-confirm"
      && tracePickerHasOwner
        ? pendingState.alienTracePickerState
        : null;
    const pendingEntries = [
      pendingState.alienTraceAction ? { pending: pendingState.alienTraceAction, label: "外星人痕迹" } : null,
      tracePickerPending ? { pending: tracePickerPending, label: "外星人痕迹" } : null,
      pendingState.cardTaskCompletion ? { pending: pendingState.cardTaskCompletion, label: "任务完成" } : null,
      pendingState.jiuzheCardPlay?.reason === "view"
        ? null
        : { pending: pendingState.jiuzheCardPlay, label: "九折牌" },
      pendingState.yichangdianCardGain ? { pending: pendingState.yichangdianCardGain, label: "异常点外星人牌" } : null,
      pendingState.yichangdianCornerAction ? { pending: pendingState.yichangdianCornerAction, label: "异常点角标" } : null,
      pendingState.banrenmaCardGain ? { pending: pendingState.banrenmaCardGain, label: "半人马外星人牌" } : null,
      pendingState.banrenmaOpportunity ? { pending: pendingState.banrenmaOpportunity, label: "半人马奖励" } : null,
      pendingState.chongCardGain ? { pending: pendingState.chongCardGain, label: "虫族外星人牌" } : null,
      pendingState.chongFossilChoice ? { pending: pendingState.chongFossilChoice, label: "虫族化石" } : null,
      pendingState.chongTaskCompletion ? { pending: pendingState.chongTaskCompletion, label: "虫族任务" } : null,
      pendingState.amibaCardGain ? { pending: pendingState.amibaCardGain, label: "阿米巴外星人牌" } : null,
      pendingState.amibaSymbolChoice ? { pending: pendingState.amibaSymbolChoice, label: "阿米巴 symbol" } : null,
      pendingState.amibaTraceRemoval ? { pending: pendingState.amibaTraceRemoval, label: "阿米巴痕迹移除" } : null,
      pendingState.aomomoCardGain ? { pending: pendingState.aomomoCardGain, label: "奥陌陌外星人牌" } : null,
      pendingState.runezuCardGain ? { pending: pendingState.runezuCardGain, label: "符文族外星人牌" } : null,
      pendingState.runezuFaceSymbolPlacement ? { pending: pendingState.runezuFaceSymbolPlacement, label: "符文族黑圈" } : null,
      pendingState.runezuSymbolBranch ? { pending: pendingState.runezuSymbolBranch, label: "符文族符文奖励" } : null,
    ];
    return pendingEntries.find((entry) => entry?.pending && isPendingLockedForAiAutomation(entry.pending)) || null;
  }

  function blockManualAiSharedOverlayInputIfNeeded() {
    const entry = getActiveAlienSharedOverlayPendingForManualGuard();
    if (!entry) return null;
    return blockManualAiPendingInput(entry.pending, entry.label);
  }

  function getReadyBanrenmaCards(player) {
    if (!banrenma || !player) return [];
    return getReadyBanrenmaCardsForOpportunity(player);
  }

  function getReadyBanrenmaCardsForOpportunity(player, opportunity = {}) {
    if (!banrenma || !player) return [];
    return (player.reservedCards || [])
      .map((card, index) => {
        if (!banrenma.isBanrenmaCard(card)) return false;
        if (opportunity.cardId && card.id !== opportunity.cardId) return false;
        const mark = banrenma.getReadyScoreMarkForCard?.(
          alienGameState,
          player,
          card,
          opportunity.markId || null,
        );
        return mark ? { card, index, mark } : null;
      })
      .filter(Boolean);
  }

  function getReadyBanrenmaCardForOpportunity(player, opportunity = {}) {
    return getReadyBanrenmaCardsForOpportunity(player, opportunity)[0] || null;
  }

  function createBanrenmaPanelBonusEffect(player, mark) {
    const playerLabel = player?.colorLabel || player?.name || player?.color || "玩家";
    return {
      id: `banrenma-panel-bonus-${player?.id || player?.color || "player"}-${mark?.id || "mark"}`,
      type: BANRENMA_PANEL_BONUS_EFFECT_TYPE,
      label: `半人马顶部奖励：${playerLabel}`,
      icon: "banrenma_mark",
      playerId: player?.id || null,
      playerColor: player?.color || null,
      options: {
        playerId: player?.id || null,
        playerColor: player?.color || null,
        markId: mark?.id || null,
      },
      status: "pending",
    };
  }

  function hasBanrenmaPanelBonusEffectQueued(player, markId) {
    if (!pendingState.actionEffectFlow || !markId) return false;
    return (pendingState.actionEffectFlow.effects || []).some((effect) => (
      effect?.type === BANRENMA_PANEL_BONUS_EFFECT_TYPE
      && effect.status !== "completed"
      && effect.status !== "skipped"
      && effect.options?.markId === markId
      && (
        effect.options?.playerId === player?.id
        || effect.options?.playerColor === player?.color
      )
    ));
  }

  function queueBanrenmaPanelBonusEffectForPlayer(player) {
    if (!banrenma || !player || !isActionEffectFlowActive()) return false;
    const mark = banrenma.getPendingPanelMark(alienGameState, player);
    if (!mark || !banrenma.getAvailableBonusPositions(alienGameState).length) return false;
    if (hasBanrenmaPanelBonusEffectQueued(player, mark.id)) return false;
    insertActionEffectsAfterCurrent([createBanrenmaPanelBonusEffect(player, mark)]);
    renderActionEffectBar();
    return true;
  }

  function enqueueBanrenmaOpportunity(player, opportunity) {
    if (!player || !opportunity) return;
    const key = `${opportunity.type}:${opportunity.markId || "any"}:${opportunity.cardId || "any"}`;
    const exists = pendingState.banrenmaOpportunityQueue.some((item) => (
      item.playerId === player.id
      && item.playerColor === player.color
      && `${item.type}:${item.markId || "any"}:${item.cardId || "any"}` === key
    ));
    if (exists) return;
    pendingState.banrenmaOpportunityQueue.push({
      playerId: player.id,
      playerColor: player.color,
      type: opportunity.type,
      markId: opportunity.markId || null,
      cardId: opportunity.cardId || null,
      label: opportunity.label,
    });
  }

  function queueBanrenmaOpportunitiesForPlayer(player) {
    if (!banrenma || !player || !banrenma.isBanrenmaRevealedSlot?.(alienGameState, alienGameState.banrenma?.revealedSlotId)) return;
    if (isActionEffectFlowActive()) {
      queueBanrenmaPanelBonusEffectForPlayer(player);
      return;
    }
    const panelMark = banrenma.getPendingPanelMark(alienGameState, player);
    if (panelMark && banrenma.getAvailableBonusPositions(alienGameState).length) {
      enqueueBanrenmaOpportunity(player, {
        type: "panel",
        markId: panelMark.id,
        label: "半人马顶部奖励",
      });
    }
  }

  function closeBanrenmaOpportunityDialog() {
    pendingState.banrenmaOpportunity = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function getBanrenmaCardConditionLabel(card) {
    const effects = banrenma?.buildConditionEffects?.(card) || [];
    return effects.map((effect) => effect.label).join("；") || "无条件效果";
  }

  function openBanrenmaCardConditionCompletionPicker(card, options = {}) {
    const player = options.player
      || resolvePlayerReference({
        playerId: options.playerId,
        playerColor: options.playerColor,
      })
      || getCurrentPlayer();
    if (!banrenma || !player || !card || !banrenma.isBanrenmaCard(card)) {
      return { ok: false, message: "没有可结算的半人马牌" };
    }
    if (!els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开半人马条件确认窗口" };
    }
    const ready = getReadyBanrenmaCardForOpportunity(player, { cardId: card.id });
    if (!ready) {
      rocketState.statusNote = "这张半人马牌尚未达到阈值";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const mark = ready.mark;
    pendingState.banrenmaOpportunity = {
      playerId: player.id,
      playerColor: player.color,
      type: "card",
      cardId: card.id || null,
      markId: mark?.id || card.banrenmaScoreMarkId || null,
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "半人马条件效果";
    if (els.scanTargetSubtitle) {
      const threshold = mark?.threshold ?? card.banrenmaThreshold ?? "阈值";
      els.scanTargetSubtitle.textContent = `${cards.getCardLabel(card)} 已达到 ${threshold} 分，确认后弃掉该牌并结算条件效果。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "scan-target-option-button";
    confirmButton.dataset.banrenmaCardChoice = card.id;
    confirmButton.innerHTML = `确认结算条件<small>${getBanrenmaCardConditionLabel(card)}</small>`;
    els.scanTargetActions.replaceChildren(confirmButton);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "半人马条件已达成：点击确认结算";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

  function openBanrenmaOpportunityDialog(player, opportunity) {
    if (!banrenma || !player || !opportunity || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开半人马奖励窗口" };
    }
    pendingState.banrenmaOpportunity = {
      playerId: player.id,
      playerColor: player.color,
      type: opportunity.type,
      markId: opportunity.markId || null,
      cardId: opportunity.cardId || null,
      fromEffectFlow: Boolean(opportunity.fromEffectFlow),
      effectLabel: opportunity.label || null,
    };
    if (opportunity.type === "panel") {
      const mark = banrenma.getPlayerScoreMarks(alienGameState, player)
        .find((item) => item.id === opportunity.markId);
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = "半人马顶部奖励";
      if (els.scanTargetSubtitle) {
        els.scanTargetSubtitle.textContent = `${player.colorLabel}玩家达到 ${mark?.threshold ?? "阈值"} 分，选择一个未使用的顶部奖励位。`;
      }
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = true;
      const nodes = banrenma.BONUS_POSITIONS.map((position) => {
        const reward = banrenma.getBonusReward(position);
        const used = Boolean(alienGameState.banrenma?.bonusSlots?.[position]);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.banrenmaBonusChoice = String(position);
        button.disabled = used;
        button.innerHTML = `${position}号奖励<small>${reward?.label || ""}${used ? " · 已使用" : ""}</small>`;
        return button;
      });
      els.scanTargetActions.replaceChildren(...nodes);
    } else {
      const readyCards = getReadyBanrenmaCardsForOpportunity(player, opportunity);
      if (!readyCards.length) {
        pendingState.banrenmaOpportunity = null;
        return { ok: false, stale: true, message: "没有可结算的半人马牌" };
      }
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = "半人马条件效果";
      if (els.scanTargetSubtitle) {
        els.scanTargetSubtitle.textContent = readyCards.length === 1
          ? `${cards.getCardLabel(readyCards[0].card)} 已达到 ${readyCards[0].mark?.threshold ?? "阈值"} 分，确认后弃掉该牌并结算条件效果。`
          : `${player.colorLabel}玩家可选择 1 张已打出的半人马牌结算条件效果，之后弃掉该牌并清除一个阈值标记。`;
      }
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = true;
      const nodes = readyCards.map(({ card }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button jiuzhe-card-option banrenma-card-option";
        button.dataset.banrenmaCardChoice = card.id;
        button.innerHTML = `
          <img class="jiuzhe-card-option-image" src="${card.src || banrenma.getCardSrc(card.alienCardId)}" alt="" aria-hidden="true">
          <small>${cards.getCardLabel(card)} · ${getBanrenmaCardConditionLabel(card)}</small>
        `;
        return button;
      });
      els.scanTargetActions.replaceChildren(...nodes);
    }
    els.scanTargetOverlay.hidden = false;
    return { ok: true, message: "半人马奖励窗口已打开" };
  }

  function maybeOpenQueuedBanrenmaOpportunity() {
    if (pendingState.banrenmaOpportunity || pendingState.banrenmaCardGain) return null;
    if (isActionEffectFlowActive()) return null;
    if (hasActivePendingSubFlow()) return null;
    if (els.scanTargetOverlay && !els.scanTargetOverlay.hidden) return null;
    while (pendingState.banrenmaOpportunityQueue.length) {
      const next = pendingState.banrenmaOpportunityQueue.shift();
      const player = resolvePlayerReference(next);
      if (!player) continue;
      if (next.type === "panel") {
        const latest = banrenma.getPendingPanelMark(alienGameState, player);
        if (!latest || latest.id !== next.markId || !banrenma.getAvailableBonusPositions(alienGameState).length) continue;
        const openResult = openBanrenmaOpportunityDialog(player, next);
        if (openResult?.ok) return openResult;
      }
    }
    return null;
  }

  function openBanrenmaReadyOpportunityForPlayer(player, options = {}) {
    if (!banrenma || !player) return null;
    if (pendingState.banrenmaOpportunity || pendingState.banrenmaCardGain) return null;
    if (isActionEffectFlowActive() || hasActivePendingSubFlow()) return null;
    const panelMark = banrenma.getPendingPanelMark(alienGameState, player);
    if (panelMark && banrenma.getAvailableBonusPositions(alienGameState).length) {
      return openBanrenmaOpportunityDialog(player, {
        type: "panel",
        markId: panelMark.id,
        label: "半人马顶部奖励",
      });
    }
    if (options.includeCards === false) return null;
    const readyCard = getReadyBanrenmaCardForOpportunity(player);
    if (!readyCard?.card) return null;
    return openBanrenmaCardConditionCompletionPicker(readyCard.card, { player });
  }

  function executeJiuzheThresholdCardEffect(effect) {
    const player = resolvePlayerReference(effect.options || effect) || getEffectOwnerPlayer(effect);
    if (!player) {
      return skipActionEffectWithMessage(effect, "九折碰线打牌：找不到玩家");
    }
    const expectedReason = effect.options?.reason || null;
    const latest = jiuzhe?.getPendingOpportunity?.(alienGameState, player) || null;
    if (!isJiuzheThresholdOpportunity(latest)) {
      return skipActionEffectWithMessage(effect, "九折碰线打牌：没有待处理的达分机会");
    }
    if (expectedReason && latest.reason !== expectedReason) {
      queueJiuzheThresholdEffectForPlayer(player, latest);
      return skipActionEffectWithMessage(effect, "九折碰线打牌：机会已更新，跳过旧提醒");
    }
    return openJiuzheCardDialog(player, {
      ...latest,
      fromEffectFlow: true,
      effectLabel: effect.label || latest.label || "九折碰线打牌",
    });
  }

  function executeBanrenmaPanelBonusEffect(effect) {
    const player = resolvePlayerReference(effect.options || effect) || getEffectOwnerPlayer(effect);
    if (!player) {
      return skipActionEffectWithMessage(effect, "半人马顶部奖励：找不到玩家");
    }
    const mark = banrenma.getPendingPanelMark(alienGameState, player);
    const expectedMarkId = effect.options?.markId || null;
    if (!mark || (expectedMarkId && mark.id !== expectedMarkId)) {
      return skipActionEffectWithMessage(effect, "半人马顶部奖励：没有待结算的分数标记");
    }
    if (!banrenma.getAvailableBonusPositions(alienGameState).length) {
      return skipActionEffectWithMessage(effect, "半人马顶部奖励：没有可用奖励位");
    }
    return openBanrenmaOpportunityDialog(player, {
      type: "panel",
      markId: mark.id,
      label: effect.label || "半人马顶部奖励",
      fromEffectFlow: true,
    });
  }

  function completeBanrenmaOpportunityStep(player, beforePlayerState, beforeAlienState, beforeCardState, label) {
    beginQuickActionStep("banrenma-opportunity", label || "半人马奖励");
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      "恢复半人马奖励前玩家状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复半人马奖励前外星人状态",
    ));
    if (beforeCardState) {
      recordQuickHistoryCommand(historyCommands.createRestorePublicCardsCommand(
        cardState,
        beforeCardState.publicCards,
        beforeCardState.discardPile,
      ));
    }
    completeQuickActionStep();
  }

  function handleBanrenmaBonusChoice(position) {
    const pending = pendingState.banrenmaOpportunity;
    if (!pending || pending.type !== "panel") {
      return { ok: false, message: "没有半人马顶部奖励机会" };
    }
    const player = resolvePlayerReference(pending);
    if (!player) return { ok: false, message: "找不到半人马玩家" };
    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const markResult = banrenma.markBonusSlotUsed(
      alienGameState,
      player,
      Number(position),
      pending.markId,
    );
    if (!markResult.ok) {
      rocketState.statusNote = markResult.message;
      renderStateReadout();
      return markResult;
    }
    banrenma.resolveScoreMark(alienGameState, player, pending.markId);
    const rewardResult = applyBanrenmaRewardToPlayer(player, markResult.reward, markResult.message);
    const fromEffectFlow = Boolean(pending.fromEffectFlow && getCurrentActionEffect());
    const effectLabel = pending.effectLabel || getCurrentActionEffect()?.label || markResult.message;
    const baseResult = {
      ok: true,
      undoable: rewardResult.undoable !== false,
      message: rewardResult.message || markResult.message,
      payload: {
        banrenmaBonusPosition: Number(position),
        reward: markResult.reward || null,
        markId: pending.markId || null,
      },
    };
    if (fromEffectFlow) {
      beginEffectHistoryStep(effectLabel);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复半人马顶部奖励前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复半人马顶部奖励前外星人状态",
      ));
      if (getCurrentActionEffect()) getCurrentActionEffect().result = baseResult;
    } else {
      completeBanrenmaOpportunityStep(player, beforePlayerState, beforeAlienState, null, markResult.message);
    }
    closeBanrenmaOpportunityDialog();
    rocketState.statusNote = baseResult.message;
    renderAlienPanels();
    renderPlayerStats();
    updateActionButtons();
    renderStateReadout();
    if (markResult.reward?.pickAlienCard) {
      const openResult = openBanrenmaCardGainDialog({
        player,
        fromEffectFlow,
        effectLabel: fromEffectFlow ? effectLabel : "半人马顶部奖励外星人牌",
        beforePlayerState,
        beforeAlienState,
        baseResult: fromEffectFlow ? baseResult : null,
      });
      if (!openResult.ok && fromEffectFlow) {
        completeCurrentActionEffect();
      }
    } else if (markResult.reward?.alienTrace) {
      pendingState.alienTraceAction = {
        type: fromEffectFlow ? "planet_reward_alien_trace" : "banrenma_bonus_alien_trace",
        beforeAlienState,
        beforePlayerState,
        effectLabel: fromEffectFlow ? effectLabel : "半人马顶部奖励外星人痕迹",
        targetPlayerId: player?.id || null,
        targetPlayerColor: player?.color || null,
      };
      const fangzhouChoice = openFangzhouTraceDestinationChoice({
        allowedTraceTypes: aliens.TRACE_TYPES,
        targetPlayerId: player?.id || null,
        targetPlayerColor: player?.color || null,
        label: fromEffectFlow ? effectLabel : "半人马顶部奖励外星人痕迹",
      });
      if (!fangzhouChoice) {
        const hasPanelTarget = hasAlienTracePanelPlacementTarget(
          null,
          aliens.TRACE_TYPES,
          player,
        );
        if (!hasPanelTarget) {
          const noTargetMessage = `${markResult.message}：无合法痕迹位置，奖励落空`;
          pendingState.alienTraceAction = null;
          pendingState.alienTracePickerState = null;
          closeAlienTracePicker();
          baseResult.message = noTargetMessage;
          baseResult.payload.alienTraceRewardLost = true;
          if (fromEffectFlow) {
            if (getCurrentActionEffect()) getCurrentActionEffect().result = baseResult;
            completeCurrentActionEffect();
          } else {
            queueBanrenmaOpportunitiesForPlayer(player);
            maybeContinueAlienRevealQueuedOpportunities();
          }
          rocketState.statusNote = noTargetMessage;
          renderAlienPanels();
          renderPlayerStats();
          updateActionButtons();
          renderStateReadout();
          return {
            ...markResult,
            message: noTargetMessage,
            alienTraceRewardLost: true,
          };
        }
        beginAlienTraceBoardPlacement({
          allowedTraceTypes: aliens.TRACE_TYPES,
          targetPlayerId: player?.id || null,
          targetPlayerColor: player?.color || null,
          label: fromEffectFlow ? effectLabel : "半人马顶部奖励外星人痕迹",
        });
      }
    } else if (fromEffectFlow) {
      completeCurrentActionEffect();
    } else {
      queueBanrenmaOpportunitiesForPlayer(player);
      maybeContinueAlienRevealQueuedOpportunities();
    }
    return markResult;
  }

  function handleBanrenmaCardConditionChoice(cardId) {
    if (!pendingState.banrenmaOpportunity || pendingState.banrenmaOpportunity.type !== "card") {
      return { ok: false, message: "没有半人马条件效果机会" };
    }
    const player = resolvePlayerReference(pendingState.banrenmaOpportunity);
    if (!player) return { ok: false, message: "找不到半人马玩家" };
    if (cardId === "cancel" || cardId === "skip") {
      const beforeAlienState = structuredClone(alienGameState);
      if (pendingState.banrenmaOpportunity.markId) {
        banrenma.resolveScoreMark(alienGameState, player, pendingState.banrenmaOpportunity.markId);
      }
      completeBanrenmaOpportunityStep(
        player,
        structuredClone(playerState),
        beforeAlienState,
        null,
        "半人马条件：跳过过期机会",
      );
      closeBanrenmaOpportunityDialog();
      rocketState.statusNote = "半人马条件：没有可结算的半人马牌，已跳过";
      renderAlienPanels();
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      queueBanrenmaOpportunitiesForPlayer(player);
      maybeContinueAlienRevealQueuedOpportunities();
      return { ok: true, skipped: true, message: rocketState.statusNote };
    }
    if (pendingState.banrenmaOpportunity.cardId && pendingState.banrenmaOpportunity.cardId !== cardId) {
      rocketState.statusNote = "这次半人马条件机会不对应所选卡牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const cardIndex = player.reservedCards?.findIndex((card) => card.id === cardId) ?? -1;
    const card = cardIndex >= 0 ? player.reservedCards[cardIndex] : null;
    if (!card || !banrenma.isBanrenmaCard(card)) {
      rocketState.statusNote = "找不到可结算的半人马牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const beforeCardState = {
      publicCards: cardState.publicCards.slice(),
      discardPile: (cardState.discardPile || []).slice(),
    };
    const mark = banrenma.getReadyScoreMarkForCard?.(
      alienGameState,
      player,
      card,
      pendingState.banrenmaOpportunity.markId || null,
    );
    if (!mark || Number(player.resources?.score || 0) < Number(mark.threshold || 0)) {
      rocketState.statusNote = "这张半人马牌尚未达到阈值";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const [removedCard] = player.reservedCards.splice(cardIndex, 1);
    cards.addToDiscardPile(cardState, removedCard);
    banrenma.resolveScoreMark(alienGameState, player, mark.id);
    const effects = banrenma.buildConditionEffects(removedCard).map((effect) => ({
      ...effect,
      playerId: player.id || effect.playerId || null,
      playerColor: player.color || effect.playerColor || null,
      options: { ...(effect.options || {}) },
    }));
    completeBanrenmaOpportunityStep(
      player,
      beforePlayerState,
      beforeAlienState,
      beforeCardState,
      `半人马条件：${cards.getCardLabel(removedCard)}`,
    );
    closeBanrenmaOpportunityDialog();
    rocketState.statusNote = `半人马条件：弃掉 ${cards.getCardLabel(removedCard)}`;
    renderPlayerStats();
    renderPlayerHand();
    renderReservedCardsFromTaskState();
    renderAlienPanels();
    updateActionButtons();
    renderStateReadout();
    if (effects.length) {
      startCardEffectFlow("banrenma-condition-effects", `半人马条件：${cards.getCardLabel(removedCard)}`, effects, {
        actionType: "banrenmaCondition",
        card: removedCard,
        historySource: HISTORY_SOURCE_QUICK,
        consumesMainAction: false,
      });
    } else {
      queueBanrenmaOpportunitiesForPlayer(player);
      maybeContinueAlienRevealQueuedOpportunities();
    }
    return { ok: true, card: removedCard, effects, message: rocketState.statusNote };
  }

  function appendRevealCardGrantMessage(message, grantResult) {
    if (!grantResult || grantResult.totalExpected <= 0) return message;
    return `${message || ""}${message ? "；" : ""}${grantResult.message}`;
  }

  function getRevealIrreversible(revealReason, revealSideEffect) {
    const reasons = [];
    let code = null;
    if (revealReason) {
      reasons.push(revealReason);
      code = "alien_reveal_random_setup";
    }
    const cardGrantIrreversible = revealSideEffect?.cardGrant?.irreversible;
    if (cardGrantIrreversible?.reason && !reasons.includes(cardGrantIrreversible.reason)) {
      reasons.push(cardGrantIrreversible.reason);
    }
    if (!code && cardGrantIrreversible?.code) code = cardGrantIrreversible.code;
    return reasons.length
      ? { code: code || "irreversible_effect", reason: reasons.join("；") }
      : null;
  }

  function openChongRewardFollowUps(result, currentPlayer, pending, beforeAlienState, beforePlayerState) {
    if (!result?.reward) return false;
    if (result.reward.pickAlienCard) {
      const openResult = openChongCardGainDialog({
        player: currentPlayer,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
        effectLabel: pending?.effectLabel || "虫族外星人牌",
        beforeAlienState,
        beforePlayerState,
      });
      return Boolean(openResult.ok);
    }
    if (result.reward.pickCard) {
      beginCardSelection({
        type: "amiba_pick_card",
        player: currentPlayer,
        allowBlindDraw: true,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
      });
      return true;
    }
    return false;
  }

  function openAmibaRewardFollowUps(result, currentPlayer, pending, beforeAlienState, beforePlayerState) {
    if (!result?.reward) return false;
    if (result.reward.pickAlienCard) {
      const openResult = openAmibaCardGainDialog({
        player: currentPlayer,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
        effectLabel: pending?.effectLabel || "阿米巴外星人牌",
        beforeAlienState,
        beforePlayerState,
      });
      return Boolean(openResult.ok);
    }
    if (result.reward.pickCard) {
      beginCardSelection({
        type: "chong_pick_card",
        player: currentPlayer,
        allowBlindDraw: true,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
      });
      return true;
    }
    return false;
  }

  function openRunezuRewardFollowUps(result, currentPlayer, pending, beforeAlienState, beforePlayerState) {
    if (!result?.reward) return false;
    if (result.reward.pickAlienCard) {
      const openResult = openRunezuCardGainDialog({
        player: currentPlayer,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
        effectLabel: pending?.effectLabel || "符文族外星人牌",
        beforeAlienState,
        beforePlayerState,
      });
      return Boolean(openResult.ok);
    }
    if (result.reward.pickCard) {
      beginCardSelection({
        type: "runezu_pick_card",
        player: currentPlayer,
        allowBlindDraw: true,
        fromEffectFlow: pending?.type === "planet_reward_alien_trace",
      });
      return true;
    }
    return false;
  }

  function closeRunezuFaceSymbolPlacement() {
    pendingState.runezuFaceSymbolPlacement = null;
    setScanTargetActionLayout();
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openRunezuFaceSymbolPlacement(alienSlotId, position) {
    if (!runezu || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开符文族 symbol 放置窗口" };
    }
    const currentPlayer = getCurrentPlayer();
    const check = runezu.canPlaceFaceSymbol(alienGameState, position, currentPlayer);
    if (!check.ok) {
      rocketState.statusNote = check.message;
      renderStateReadout();
      return check;
    }
    pendingState.runezuFaceSymbolPlacement = {
      alienSlotId: Number(alienSlotId),
      position: check.position,
      playerId: currentPlayer.id,
      beforeAlienState: structuredClone(alienGameState),
      beforePlayerState: structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "符文族黑圈";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = `选择 1 个 symbol 放入${runezu.formatFaceSymbolSlotLabel(check.position)}并结算奖励。`;
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    setScanTargetActionLayout("runezu-face-symbol-choice-grid");
    const nodes = check.choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button runezu-face-symbol-choice-button";
      button.dataset.runezuFaceSymbolChoice = choice.symbolId;
      button.title = `${choice.label} x${choice.count}`;
      button.setAttribute("aria-label", `${choice.label} x${choice.count}`);
      button.innerHTML = `<img class="runezu-face-symbol-choice-image" src="${runezu.getSymbolSrc(choice.symbolId)}" alt="" aria-hidden="true">`;
      return button;
    });
    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "符文族黑圈：请选择要放置的 symbol";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

  function handleRunezuFaceSymbolChoice(choice) {
    const pending = pendingState.runezuFaceSymbolPlacement;
    if (!pending) return { ok: false, message: "没有符文族黑圈放置流程" };
    if (choice === "cancel") {
      closeRunezuFaceSymbolPlacement();
      rocketState.statusNote = "已取消符文族黑圈放置";
      renderStateReadout();
      return { ok: true, cancelled: true, message: rocketState.statusNote };
    }
    const player = getPlayerById(pending.playerId) || getCurrentPlayer();
    const result = runezu.placePlayerSymbolOnFace(alienGameState, pending.position, player, choice);
    if (!result.ok) {
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }
    const rewardResult = applyRunezuRewardToPlayer(
      player,
      result.reward,
      `符文族${runezu.formatFaceSymbolSlotLabel(pending.position)}`,
    );
    closeRunezuFaceSymbolPlacement();
    beginQuickActionStep("runezu-face-symbol", result.message);
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      pending.beforeAlienState,
      "恢复符文族黑圈放置前外星人状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      pending.beforePlayerState,
      "恢复符文族黑圈放置前玩家状态",
    ));
    completeQuickActionStep(null, rewardResult.irreversible ? {
      irreversibleCode: rewardResult.irreversible.code,
      irreversibleReason: rewardResult.irreversible.reason,
    } : {});
    rocketState.statusNote = `${result.message}；${rewardResult.message}`;
    renderAlienPanels();
    renderPlayerStats();
    renderPlayerHand();
    updateActionButtons();
    renderStateReadout();
    return { ...result, rewardResult, message: rocketState.statusNote };
  }

  function executeRunezuSymbolRewardEffect(effect) {
    const currentPlayer = getCurrentPlayer();
    const symbolId = effect.options?.symbolId;
    const beforeAlienState = structuredClone(alienGameState);
    const beforePlayerState = structuredClone(playerState);
    beginEffectHistoryStep(effect.label);
    const result = applyRunezuSymbolReward(currentPlayer, symbolId, effect.label);
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复符文族symbol奖励前外星人状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      "恢复符文族symbol奖励前玩家状态",
    ));
    if (result.irreversible) {
      markCurrentActionIrreversible(result.irreversible.reason, result.irreversible.code);
    }
    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: result.undoable !== false,
      irreversible: result.irreversible || null,
      message: result.message,
      payload: result,
    }, [renderAlienPanels, renderPlayerHand]);
  }

  function closeRunezuSymbolBranchDialog() {
    pendingState.runezuSymbolBranch = null;
    setScanTargetActionLayout();
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
  }

  function openRunezuSymbolBranchDialog(effect) {
    if (!runezu || !els.scanTargetOverlay || !els.scanTargetActions) {
      return { ok: false, message: "无法打开符文族分支选择" };
    }
    const branches = effect.options?.branches || [];
    pendingState.runezuSymbolBranch = {
      ...getPendingOwnerFields(effect, getEffectOwnerPlayer(effect)),
      effect,
      branches,
      beforeAlienState: structuredClone(alienGameState),
      beforePlayerState: structuredClone(playerState),
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "符文族符文奖励";
    if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择一组 symbol，按黑圈映射依次结算奖励。";
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    setScanTargetActionLayout("runezu-symbol-branch-choice-grid");
    const nodes = branches.map((branch, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button runezu-symbol-branch-button";
      button.dataset.runezuSymbolBranch = String(index);
      button.title = branch.label || (branch.symbolIds || []).map(runezu.formatSymbolLabel).join("+");
      button.setAttribute("aria-label", button.title);
      const icons = (branch.symbolIds || []).map((symbolId) => (
        `<img class="runezu-face-symbol-choice-image runezu-symbol-branch-image" src="${runezu.getSymbolSrc(symbolId)}" alt="" aria-hidden="true">`
      )).join("");
      button.innerHTML = icons;
      return button;
    });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "scan-target-option-button";
    cancel.dataset.runezuSymbolBranch = "cancel";
    cancel.innerHTML = "取消<small>不结算本次符文奖励</small>";
    nodes.push(cancel);
    els.scanTargetActions.replaceChildren(...nodes);
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "符文族：请选择一组 symbol 奖励";
    renderStateReadout();
    return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
  }

  function handleRunezuSymbolBranchChoice(choice) {
    const pending = pendingState.runezuSymbolBranch;
    if (!pending) return { ok: false, message: "没有待选择的符文族分支" };
    const effect = pending.effect;
    if (choice === "cancel") {
      closeRunezuSymbolBranchDialog();
      if (effect) {
        effect.result = { ok: true, undoable: true, message: "已取消符文族分支奖励" };
        rocketState.statusNote = effect.result.message;
        completeCurrentActionEffect();
      }
      renderStateReadout();
      return { ok: true, cancelled: true, message: rocketState.statusNote };
    }
    const branch = pending.branches[Number(choice)];
    if (!branch) return { ok: false, message: "无效的符文族分支" };
    const currentPlayer = getPendingOwnerPlayer(pending, effect);
    const messages = [];
    let irreversible = null;
    beginEffectHistoryStep(effect.label);
    for (const symbolId of branch.symbolIds || []) {
      const result = applyRunezuSymbolReward(currentPlayer, symbolId, effect.label);
      messages.push(result.message);
      if (result.irreversible) irreversible = result.irreversible;
    }
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      pending.beforeAlienState,
      "恢复符文族分支奖励前外星人状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      pending.beforePlayerState,
      "恢复符文族分支奖励前玩家状态",
    ));
    if (irreversible) markCurrentActionIrreversible(irreversible.reason, irreversible.code);
    closeRunezuSymbolBranchDialog();
    if (effect) {
      effect.result = {
        ok: true,
        undoable: !irreversible,
        irreversible,
        message: `${effect.label}：${messages.join("；") || "无奖励"}`,
      };
      rocketState.statusNote = effect.result.message;
      renderAlienPanels();
      renderPlayerStats();
      renderPlayerHand();
      completeCurrentActionEffect();
    }
    renderStateReadout();
    return effect?.result || { ok: true, message: rocketState.statusNote };
  }

  function alignAlienPanelsToPlanets() {
    els.appWrap.style.removeProperty("--alien-panel-min-height");
    if (window.innerWidth <= 1180 || els.alienPanels.length < 2 || !els.planetsReferenceImage) return;

    const panels = [...els.alienPanels];
    const firstPanel = panels[0].getBoundingClientRect();
    const secondPanel = panels[1].getBoundingClientRect();
    const planets = els.planetsReferenceImage.getBoundingClientRect();
    const bottomGap = planets.bottom - secondPanel.bottom;

    if (bottomGap <= 0) return;

    const alignedPanelHeight = firstPanel.height + bottomGap / panels.length;
    const panelHeight = Math.ceil(Math.max(firstPanel.height, alignedPanelHeight * 0.75));
    els.appWrap.style.setProperty("--alien-panel-min-height", `${panelHeight}px`);
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
    return debugRuntimeController.setDebugOpen(open);
  }

  function focusJiuzheDebugCalibration(alienSlotId = 1) {
    return focusDebugCalibration(alienSlotId);
  }

  function isTechActionSelectionActive() {
    return Boolean(techGameState.ui.techSelectionActive);
  }

  function isTechTilePickingActive() {
    const ui = techGameState.ui;
    return Boolean(ui.techSelectionActive && (!ui.selectedTileId || ui.pendingTileId));
  }

  function isTechAwaitingConfirm() {
    return false;
  }

  function getResearchTechSelectionEffect() {
    if (!pendingState.actionEffectFlow) return null;
    return pendingState.actionEffectFlow.effects.find((effect) => (
      effect.type === "research_tech_select"
      || effect.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH
    )) || null;
  }

  function getResearchTechSelectionPayload() {
    const result = getResearchTechSelectionEffect()?.result;
    return result?.payload || result || null;
  }

  function getResearchTechSelectionOptions() {
    return getResearchTechSelectionEffect()?.options || {};
  }

  function isTechTileOwnedByOtherPlayer(tileId) {
    const currentPlayer = getCurrentPlayer();
    return (playerState.players || []).some((player) => (
      player?.id !== currentPlayer?.id
      && player?.techState?.ownedTiles?.[tileId]
      && !player?.techState?.disabledTiles?.[tileId]
    ));
  }

  function shouldSkipCurrentResearchTechCost() {
    return Boolean(getResearchTechSelectionOptions().skipCost);
  }

  function isGeneratedResearchTechFollowupEffect(effect) {
    if (!effect) return false;
    if (effect.options?.generatedByResearchTech) return true;
    if (String(effect.id || "").startsWith("research-tech-")) return true;
    return [
      "research_tech_take",
      "research_tech_rotate",
      "research_tech_bonus",
    ].includes(effect.type);
  }

  function countOwnedTechByTypeAfterSelection(player, techType, selectResult) {
    const currentCount = countOwnedTechByType(player, techType);
    const tileId = selectResult?.tileId || selectResult?.payload?.tileId || null;
    if (!tileId || player?.techState?.ownedTiles?.[tileId]) return currentCount;
    if (techType && !String(tileId).startsWith(techType)) return currentCount;
    return currentCount + 1;
  }

  function appendResearchTechFollowupEffects(selectResult) {
    if (!pendingState.actionEffectFlow) return;
    const selectionOptions = getResearchTechSelectionOptions();
    const owner = getEffectOwnerPlayer(getCurrentActionEffect()) || getCurrentPlayer();
    const ownerFields = {
      playerId: owner?.id || null,
      playerColor: owner?.color || null,
    };

    const selectIndex = pendingState.actionEffectFlow.effects.findIndex((effect) => (
      effect.type === "research_tech_select"
      || effect.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH
    ));
    const trailingEffects = selectIndex >= 0
      ? pendingState.actionEffectFlow.effects
        .slice(selectIndex + 1)
        .filter((effect) => !isGeneratedResearchTechFollowupEffect(effect))
      : [];
    if (selectIndex >= 0) {
      pendingState.actionEffectFlow.effects.splice(selectIndex + 1);
    }

    const bonusId = selectResult.bonusId ?? selectResult.payload?.bonusId;
    const bonusLabel = tech.BONUS_LABELS[bonusId] || bonusId || "奖励";
    const followups = [];
    const tileId = selectResult.tileId || selectResult.payload?.tileId;
    const techType = selectResult.techType || selectResult.payload?.techType;

    followups.push({
      id: "research-tech-take",
      type: "research_tech_take",
      ...ownerFields,
      abilityId: "researchTechTake",
      icon: "research_tech",
      label: `获得科技片：${tileId}`,
      status: "pending",
      undoable: false,
      options: {
        tileId,
        techType,
        bonusId,
        blueSlot: selectResult.blueSlot ?? selectResult.payload?.blueSlot ?? null,
        firstTake: Boolean(selectResult.firstTake ?? selectResult.payload?.firstTake),
      },
    });

    if (!selectionOptions.skipRotate) {
      followups.push({
        id: "research-tech-rotate",
        type: "research_tech_rotate",
        ...ownerFields,
        abilityId: "researchTechRotate",
        icon: "rotate",
        label: "旋转",
        status: "pending",
        undoable: false,
      });
    }

    if (selectResult.tileId === "orange1") {
      followups.push({
        ...planetRewards.launchEffect({ skipCost: true, source: "tech" }),
        id: "research-tech-launch",
        ...ownerFields,
        status: "pending",
        undoable: true,
      });
    }

    if (!selectionOptions.skipBonus) {
      followups.push({
        id: "research-tech-bonus",
        type: "research_tech_bonus",
        ...ownerFields,
        abilityId: "researchTechBonus",
        icon: bonusId,
        label: `获取${bonusLabel}`,
        status: "pending",
        undoable: false,
        options: {
          tileId: selectResult.tileId,
          bonusId,
          firstTake: Boolean(selectResult.firstTake),
        },
      });
    }

    if (!selectionOptions.skipBonus && selectionOptions.afterResearchReward?.kind === "repeatBonus") {
      followups.push({
        id: "research-tech-bonus-repeat",
        type: "research_tech_bonus",
        ...ownerFields,
        abilityId: "researchTechBonus",
        icon: bonusId,
        label: `再次获取${bonusLabel}`,
        status: "pending",
        undoable: false,
        options: {
          tileId: selectResult.tileId,
          bonusId,
          firstTake: Boolean(selectResult.firstTake),
        },
      });
    }

    if (selectResult.tileId === "purple1") {
      followups.push({
        ...planetRewards.dataEffect(2),
        id: "research-tech-data",
        ...ownerFields,
        status: "pending",
        undoable: true,
      });
    }

    if (selectionOptions.afterResearchReward?.kind === "techTypeCountScore") {
      const currentPlayer = getCurrentPlayer();
      const scorePer = Math.max(0, Math.round(Number(selectionOptions.afterResearchReward.scorePer) || 1));
      const count = countOwnedTechByTypeAfterSelection(currentPlayer, techType, selectResult);
      followups.push({
        id: "research-tech-type-score",
        type: planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
        ...ownerFields,
        icon: "score",
        label: `同色科技得分：${count * scorePer}分`,
        status: "pending",
        undoable: true,
        options: { gain: { score: count * scorePer } },
      });
    }

    if (selectionOptions.afterResearchReward?.kind === "resourceValueScore") {
      const currentPlayer = getCurrentPlayer();
      const resource = selectionOptions.afterResearchReward.resource || "publicity";
      const score = Math.max(0, Math.round(Number(currentPlayer?.resources?.[resource]) || 0));
      followups.push({
        id: "research-tech-resource-score",
        type: planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
        ...ownerFields,
        icon: "score",
        label: `资源得分：${score}分`,
        status: "pending",
        undoable: true,
        options: { gain: { score } },
      });
    }

    if (selectionOptions.afterResearchReward?.kind === "publicityIfNotFirstTake" && !selectResult.firstTake) {
      const publicity = Math.max(0, Math.round(Number(selectionOptions.afterResearchReward.publicity) || 0));
      followups.push({
        id: "research-tech-shared-publicity",
        type: planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
        ...ownerFields,
        icon: "publicity",
        label: `非首次拿取科技：${publicity}宣传`,
        status: "pending",
        undoable: true,
        options: { gain: { publicity } },
      });
    }

    const heliosEffect = industry?.buildHeliosPassiveRewardEffect?.(
      getCurrentPlayer(),
      techType,
      selectResult.tileId || selectResult.payload?.tileId,
    );
    if (heliosEffect) {
      heliosEffect.playerId = heliosEffect.playerId || ownerFields.playerId;
      heliosEffect.playerColor = heliosEffect.playerColor || ownerFields.playerColor;
      followups.push(heliosEffect);
    }

    pendingState.actionEffectFlow.effects.push(
      ...followups.map((effect) => ({
        ...effect,
        options: {
          ...(effect.options || {}),
          generatedByResearchTech: true,
        },
      })),
      ...trailingEffects,
    );
  }

  function onTechTileSelected(result) {
    appendResearchTechFollowupEffects(result);
    syncTechSelectionChrome();
    renderTechBoard();
    renderActionEffectBar();
    updateActionButtons();
  }

  function onTechTileTaken(result) {
    const player = getCurrentPlayer();
    if (industry?.shouldApplyTuringBlueTechPublicity?.(player, result.tileId)) {
      players.gainResources(player, { publicity: industry.getTuringBlueTechPublicityGain() });
      result.message = `${result.message}；图灵系统蓝色科技 +${industry.getTuringBlueTechPublicityGain()} 宣传`;
    }
    const techType = result.techType || result.payload?.techType || String(result.tileId || "").match(/^(orange|purple|blue)/)?.[1] || null;
    const techEvent = techType
      ? {
        type: "researchTech",
        techType,
        tileId: result.tileId || result.payload?.tileId,
        firstTake: Boolean(result.firstTake),
        playerId: player?.id || null,
      }
      : null;
    if (techEvent) {
      result.events = [...(result.events || []), techEvent];
    }
    syncTechSelectionChrome();
    renderTechBoard();
    renderActionEffectBar();
    updateActionButtons();
  }

  function syncTechSelectionChrome() {
    const active = isTechTilePickingActive() || Boolean(techGameState?.ui?.industryBorrowMode);
    els.appWrap?.classList.toggle("tech-selection-active", active);
    if (els.techSelectionBackdrop) {
      els.techSelectionBackdrop.hidden = !active;
      els.techSelectionBackdrop.setAttribute("aria-hidden", String(!active));
    }
    if (els.techSelectionCancel) {
      els.techSelectionCancel.hidden = !active;
    }
    if (els.techPanel) {
      els.techPanel.classList.toggle("tech-panel-focused", active);
    }
    if (active) setQuickPanelOpen(false);
    syncInteractionFocusChrome();
  }

  function clearResearchTechSelectionState() {
    tech.setTechSelectionActive(techGameState, false);
    tech.cancelPendingTake(techGameState);
    techGameState.ui.selectedTileId = null;
    techGameState.ui.selectedBlueSlot = null;
    techGameState.ui.allowedTechTypes = null;
    closeTechBlueSlotPicker();
    techGameState.ui.statusNote = "";
    syncTechSelectionChrome();
    renderTechBoard();
  }

  function restoreResearchTechSelectionAfterUndo(effect) {
    const selectIndex = pendingState.actionEffectFlow?.effects?.indexOf(effect) ?? -1;
    if (selectIndex >= 0) {
      const trailingEffects = pendingState.actionEffectFlow.effects
        .slice(selectIndex + 1)
        .filter((item) => !isGeneratedResearchTechFollowupEffect(item));
      pendingState.actionEffectFlow.effects.splice(selectIndex + 1, pendingState.actionEffectFlow.effects.length, ...trailingEffects);
    }
    tech.setTechSelectionActive(techGameState, true);
    techGameState.ui.pendingTileId = null;
    techGameState.ui.selectedTileId = null;
    techGameState.ui.selectedBlueSlot = null;
    if (Array.isArray(effect?.options?.allowedTechTypes)) {
      techGameState.ui.allowedTechTypes = [...effect.options.allowedTechTypes];
    }
    closeTechBlueSlotPicker();
    techGameState.ui.statusNote = "请选择要研究的科技板块";
    rocketState.statusNote = "科技：请选择要研究的科技片";
    syncTechSelectionChrome();
    renderTechBoard();
  }

  function cancelPendingResearchTechTileChoice() {
    techGameState.ui.pendingTileId = null;
    techGameState.ui.selectedTileId = null;
    techGameState.ui.selectedBlueSlot = null;
    closeTechBlueSlotPicker();
    techGameState.ui.statusNote = "请选择要研究的科技板块";
    rocketState.statusNote = "科技：请选择要研究的科技片";
    syncTechSelectionChrome();
    renderTechBoard();
    updateActionButtons();
    renderStateReadout();
  }

  function cancelTechSelection() {
    if (techGameState.ui.industryBorrowMode) {
      techGameState.ui.industryBorrowMode = false;
      tech.setTechSelectionActive(techGameState, false);
      techGameState.ui.statusNote = "";
      cancelIndustryAbilityFlow();
      rocketState.statusNote = "已取消图灵系统科技借用";
      syncTechSelectionChrome();
      renderStateReadout();
      return;
    }
    if (pendingState.actionEffectFlow?.actionType === "researchTech" && hasCurrentMainActionIrreversibleBarrier()) {
      rocketState.statusNote = pendingState.actionIrreversibleReason
        ? `不可撤销：${pendingState.actionIrreversibleReason}`
        : "当前科技行动已有不可撤销影响";
      syncTechSelectionChrome();
      renderTechBoard();
      updateActionButtons();
      renderStateReadout();
      return;
    }
    tech.setTechSelectionActive(techGameState, false);
    tech.cancelPendingTake(techGameState);
    techGameState.ui.selectedTileId = null;
    techGameState.ui.selectedBlueSlot = null;
    techGameState.ui.allowedTechTypes = null;
    closeTechBlueSlotPicker();
    techGameState.ui.statusNote = "";
    rocketState.statusNote = "";
    if (pendingState.actionEffectFlow?.actionType === "researchTech") {
      const rollbackResult = actionHistory.rollbackSession();
      if (!rollbackResult.ok) {
        rocketState.statusNote = rollbackResult.message || "当前科技行动不能取消";
        syncTechSelectionChrome();
        renderTechBoard();
        updateActionButtons();
        renderStateReadout();
        return;
      }
      clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
      removeActionLogStepsBySource(HISTORY_SOURCE_MAIN);
      uiRuntimeState.effectStepActive = false;
      clearActionEffectFlow();
    }
    clearActionPending();
    syncTechSelectionChrome();
    renderTechBoard();
    updateActionButtons();
    renderStateReadout();
  }

  function renderTechBoard() {
    syncTechRenderContext();
    const currentPlayer = getInterfacePlayer();
    tech.renderAll(techGameState, techRenderContext, els.techTiles, {
      currentPlayer,
      canTakeTile: (tileId) => {
        if (!currentPlayer?.techState) return false;
        if (!tech.isSupplySelectionActive(techGameState.ui)) return false;
        if (industry?.isTechBlockedByPirates?.(currentPlayer, tileId)) return false;
        const selectionOptions = getResearchTechSelectionOptions();
        if (selectionOptions.researchedByOthersOnly && !isTechTileOwnedByOtherPlayer(tileId)) return false;
        return tech.resolver.canTakeTile(
          techGameState.board,
          currentPlayer.techState,
          tileId,
          { techTypes: techGameState.ui.allowedTechTypes },
        ).ok;
      },
    });
    syncTechSelectionChrome();
    renderPiratesRaidTechMarkers(currentPlayer);
    renderRunezuBoardSymbols();
  }

  function closeTechBlueSlotPicker() {
    if (!els.techBlueSlotOverlay) return;
    els.techBlueSlotOverlay.hidden = true;
    delete els.techBlueSlotOverlay.dataset.tileId;
    renderTechBoard();
  }

  function openTechBlueSlotPicker(request) {
    if (!els.techBlueSlotOverlay || !els.techBlueSlotActions || !els.techBlueSlotSubtitle) return;

    els.techBlueSlotSubtitle.textContent = `将 ${request.tileId} 放到蓝色科技位置`;
    els.techBlueSlotActions.replaceChildren(...request.availableSlots.map((slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tech-blue-slot-button";
      button.dataset.blueSlot = String(slot);
      button.textContent = String(slot);
      return button;
    }));
    els.techBlueSlotOverlay.dataset.tileId = request.tileId;
    els.techBlueSlotOverlay.hidden = false;
    techGameState.ui.pendingTileId = request.tileId;
    renderTechBoard();
  }

  function finalizeTechTakeResult(result) {
    if (!result?.ok || result.needsBlueSlotChoice) return result;

    tech.setTechSelectionActive(techGameState, false);
    closeTechBlueSlotPicker();
    syncTechSelectionChrome();
    renderWheels();
    renderSectorNebulaDataBoard();
    renderRunezuBoardSymbols();
    renderRotateStateToken();
    if (result.freeLaunch?.rocket) renderRocketElement(result.freeLaunch.rocket);
    renderPlayerStats();
    renderTechBoard();
    updateActionButtons();

    if (result.awaitingCardSelection) {
      const selectionResult = beginCardSelection();
      rocketState.statusNote = selectionResult.ok
        ? `${result.message}；${selectionResult.message}`
        : (selectionResult.message || result.message);
    }

    renderStateReadout();
    return result;
  }

  function commitResearchTechSelectionResult(result) {
    if (!result?.ok || result.needsBlueSlotChoice) return result;
    rocketState.statusNote = result.message;
    beginEffectHistoryStep(result.message || "选择科技片", { effectType: "research_tech_select" });
    recordAbilityCommands(result);
    rocketState.statusNote = result.message;
    const current = getCurrentActionEffect();
    if (current) current.result = result;
    onTechTileSelected(result);
    completeCurrentActionEffect();
    renderStateReadout();
    return result;
  }

  function selectResearchTechTileForCurrentFlow(tileId, blueSlot = null) {
    const options = {
      tileId,
      skipCost: shouldSkipCurrentResearchTechCost(),
    };
    if (blueSlot != null) options.blueSlot = blueSlot;

    const result = abilities.executeAbility("researchTechSelect", createActionContext(), options);
    if (result.needsBlueSlotChoice) {
      techGameState.ui.pendingTileId = tileId;
      openTechBlueSlotPicker(result);
      renderTechBoard();
      renderStateReadout();
      return result;
    }

    if (!result.ok) {
      techGameState.ui.statusNote = result.message;
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    return commitResearchTechSelectionResult(result);
  }

  function confirmTechBlueSlotChoice(blueSlot) {
    const tileId = els.techBlueSlotOverlay?.dataset.tileId;
    if (!tileId) return { ok: false, message: "没有待放置的蓝色科技" };

    closeTechBlueSlotPicker();
    return selectResearchTechTileForCurrentFlow(tileId, blueSlot);
  }

  function handleSupplyTechTileClick(tileId) {
    if (techGameState.ui.industryBorrowMode) {
      return confirmIndustryTuringBorrow(tileId);
    }
    if (!tech.isSupplySelectionActive(techGameState.ui)) return;

    const currentPlayer = getCurrentPlayer();
    if (currentPlayer?.techState) {
      if (industry?.isTechBlockedByPirates?.(currentPlayer, tileId)) {
        const message = "星际海盗掠夺标记封锁了该科技";
        techGameState.ui.statusNote = message;
        rocketState.statusNote = message;
        renderStateReadout();
        return { ok: false, message };
      }
      const selectionOptions = getResearchTechSelectionOptions();
      if (selectionOptions.researchedByOthersOnly && !isTechTileOwnedByOtherPlayer(tileId)) {
        const message = "这张牌只能选择其他玩家已研究过的科技";
        techGameState.ui.statusNote = message;
        rocketState.statusNote = message;
        renderStateReadout();
        return { ok: false, message };
      }
      const canTake = tech.resolver.canTakeTile(
        techGameState.board,
        currentPlayer.techState,
        tileId,
        { techTypes: techGameState.ui.allowedTechTypes },
      );
      if (!canTake.ok) {
        techGameState.ui.statusNote = canTake.message;
        rocketState.statusNote = canTake.message;
        renderStateReadout();
        return canTake;
      }
    }

    return selectResearchTechTileForCurrentFlow(tileId);
  }

  function isPiratesRaidPlacementActiveForPlayer(player) {
    return Boolean(
      pendingState.piratesRaidPlacement
      && player
      && pendingState.piratesRaidPlacement.playerId === player.id,
    );
  }

  function renderPiratesRaidTechMarkers(player) {
    const layer = els.playerBoardTechLayer;
    if (!layer) return;
    layer.querySelectorAll(".pirates-raid-tech-marker-button").forEach((element) => element.remove());
    if (!industry?.shouldShowPiratesRaidMarkers?.(player)) return;

    const active = isPiratesRaidPlacementActiveForPlayer(player);
    const targetPlanetId = pendingState.piratesRaidPlacement?.planetId || null;
    const markerSrc = industry.PIRATES_RAID_MARKER_SRC || "../assets/industry/掠夺标记.png";
    for (const tileId of industry.listPiratesRaidBlockedTechTiles?.(player) || []) {
      const layout = tech.getPlacementLayout?.(tileId);
      if (!layout) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pirates-raid-tech-marker-button";
      button.dataset.piratesRaidTech = tileId;
      button.style.left = `${layout.percentX}%`;
      button.style.top = `${layout.percentY}%`;
      button.style.setProperty("--pirates-raid-tech-scale", String((layout.scalePercent || 36.14) / 100));
      const canPlace = active && industry.canPlacePiratesRaidMarker?.(player, tileId, targetPlanetId)?.ok;
      button.disabled = !canPlace;
      button.title = canPlace
        ? `放置 ${tileId} 掠夺标记到 ${getPlanetName(targetPlanetId)}`
        : `${tileId} 被星际海盗掠夺标记封锁`;
      button.setAttribute("aria-label", button.title);
      button.classList.toggle("is-placeable", canPlace);

      const image = document.createElement("img");
      image.className = "pirates-raid-tech-marker";
      image.src = markerSrc;
      image.alt = "";
      image.decoding = "async";
      image.draggable = false;
      button.append(image);
      layer.append(button);
    }
  }

  function getCurrentPiratesRaidMarkerEffect() {
    const effect = getCurrentActionEffect();
    if (!effect || effect.type !== "industry_pirates_raid_marker" || effect.status !== "active") return null;
    if (pendingState.piratesRaidPlacement && pendingState.piratesRaidPlacement.effectId !== effect.id) return null;
    return effect;
  }

  function executeIndustryPiratesRaidMarkerEffect(effect) {
    const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
    const planetId = effect.options?.planetId || null;
    if (!player || !planetId) {
      rocketState.statusNote = "星际海盗：缺少掠夺目标";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const blocked = industry.listPiratesRaidBlockedTechTiles?.(player) || [];
    if (!blocked.length) {
      return skipActionEffectWithMessage(effect, "星际海盗：没有可放置的掠夺标记，已跳过", {
        reason: "no_pirates_raid_marker",
      });
    }
    pendingState.piratesRaidPlacement = {
      effectId: effect.id,
      playerId: player.id,
      playerColor: player.color,
      planetId,
    };
    rocketState.statusNote = `${effect.label}：请选择玩家面板上的掠夺标记放置到 ${getPlanetName(planetId)}`;
    renderTechBoard();
    syncInteractionFocusChrome();
    renderStateReadout();
    return { ok: true, pendingChoice: true, message: rocketState.statusNote };
  }

  function handlePiratesRaidTechMarkerClick(tileId) {
    const effect = getCurrentPiratesRaidMarkerEffect();
    if (!effect || !pendingState.piratesRaidPlacement) {
      return { ok: false, message: "没有待放置的掠夺标记" };
    }
    const player = getPlayerById(pendingState.piratesRaidPlacement.playerId);
    const planetId = pendingState.piratesRaidPlacement.planetId;
    const check = industry.canPlacePiratesRaidMarker?.(player, tileId, planetId);
    if (!check?.ok) {
      rocketState.statusNote = check?.message || "无法放置该掠夺标记";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    beginEffectHistoryStep(effect.label);
    const beforePlayer = structuredClone(player);
    const result = industry.placePiratesRaidMarker(player, tileId, planetId);
    if (!result.ok) {
      endEffectHistoryStep();
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }
    recordHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      "恢复星际海盗掠夺标记放置前玩家状态",
    ));
    pendingState.piratesRaidPlacement = null;
    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: true,
      message: `${effect.label}：${tileId} -> ${getPlanetName(planetId)}`,
      payload: { tileId, planetId },
    }, [renderTechBoard, renderRockets]);
  }

  function executeIndustryPiratesRaidPublicityEffect(effect) {
    const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
    if (!player) {
      rocketState.statusNote = "星际海盗：没有目标玩家";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const gain = effect.options?.gain || { publicity: industry?.PIRATES_RAID_PUBLICITY_GAIN || 3 };
    beginEffectHistoryStep(effect.label);
    const beforePlayer = structuredClone(player);
    players.gainResources(player, gain);
    recordHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      "恢复星际海盗宣传奖励前玩家状态",
    ));
    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: true,
      message: `${effect.label}：${formatPlanetRewardGain(gain)}`,
      payload: { gain },
    });
  }

  function startIndustryPiratesRaidLaunchFlow(flow, options = {}) {
    const groupId = `industry-pirates-raid-${turnState.roundNumber}-${turnState.turnNumber}`;
    const nodes = industry?.buildPiratesRaidLaunchEffectNodes?.(flow, { groupId }) || [];
    pendingState.industryAbility = null;
    pendingState.cardSelectionAction = null;
    cards.setSelectionActive(cardState, false);
    syncCardSelectionChrome();

    if (!nodes.length) {
      rocketState.statusNote = "星际海盗：没有可结算的掠夺发射效果";
      renderStateReadout();
      return false;
    }

    const preHistoryCommands = [];
    if (options.markerRestoreCommand) preHistoryCommands.push(options.markerRestoreCommand);
    const started = startCardEffectFlow(
      "industry-pirates-raid-launch",
      flow.label || "星际海盗",
      nodes,
      {
        actionType: "industryPiratesRaid",
        historySource: HISTORY_SOURCE_QUICK,
        consumesMainAction: false,
        preHistoryCommands,
      },
    );
    if (started) {
      rocketState.statusNote = flow.message || "星际海盗：请选择已有掠夺标记主星上的己方环绕或登陆标记";
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }
    return started;
  }

  function buildPiratesRaidLaunchChoices(effect) {
    const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
    return buildPlanetMarkerRemovalChoices({
      options: {
        owner: "current",
        markerKinds: ["orbit", "land"],
        ...(effect.options || {}),
      },
    }).filter((choice) => (
      choice.planetId
      && (choice.kind === "orbit" || choice.kind === "land")
      && industry?.canUsePiratesRaidLaunchOnPlanet?.(player, choice.planetId)
    ));
  }

  function executeIndustryPiratesRaidLaunchEffect(effect) {
    const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
    const cost = normalizeResourceCost(effect.options?.cost || industry?.PIRATES_RAID_ACTIVE_COST || { credits: 1 }) || {};
    if (!players.canAfford(player, cost)) {
      rocketState.statusNote = `星际海盗：资源不足，需要 ${players.formatResourceCost(cost)}`;
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const choices = buildPiratesRaidLaunchChoices(effect);
    if (!choices.length) {
      rocketState.statusNote = "星际海盗：没有位于已掠夺主星的己方环绕或登陆标记";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    pendingState.scanTargetAction = { ...getPendingOwnerFields(effect, player), type: "industry_pirates_raid_launch", effect, choices };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = effect.label || "星际海盗";
    if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = "选择一个已有掠夺标记主星上的己方环绕或登陆标记，移除后消耗 1 信用点并在该星球当前扇区免费发射。";
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    els.scanTargetActions.replaceChildren(...choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button";
      button.dataset.piratesRaidLaunchChoice = choice.id;
      button.innerHTML = `${choice.label}<small>${choice.description || "己方标记"}；移除并免费发射</small>`;
      return button;
    }));
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = `${effect.label}：请选择已有掠夺标记主星上要移除的己方标记`;
    renderStateReadout();
    return { ok: true, pendingChoice: true, message: rocketState.statusNote };
  }

  function getPiratesRaidLaunchCoordinate(choice) {
    if (choice.kind === "plutoOrbit" || choice.kind === "plutoLand") {
      if (choice.sectorX == null || choice.sectorY == null) return null;
      return { x: choice.sectorX, y: choice.sectorY };
    }
    return getPlanetSectorCoordinate(choice.planetId);
  }

  function handlePiratesRaidLaunchChoice(choiceId) {
    const pending = pendingState.scanTargetAction;
    if (pending?.type !== "industry_pirates_raid_launch") {
      return { ok: false, message: "没有待处理的星际海盗发射" };
    }
    const choice = pending.choices.find((item) => item.id === choiceId);
    const effect = pending.effect;
    closeScanTargetPicker();
    if (!choice) return { ok: false, message: "无效标记" };

    return withPendingOwnerPlayer(pending, () => {
      const player = getCurrentPlayer();
      const cost = normalizeResourceCost(effect.options?.cost || industry?.PIRATES_RAID_ACTIVE_COST || { credits: 1 }) || {};
      if (!players.canAfford(player, cost)) {
        rocketState.statusNote = `星际海盗：资源不足，需要 ${players.formatResourceCost(cost)}`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const coordinate = getPiratesRaidLaunchCoordinate(choice);
      if (!coordinate) {
        rocketState.statusNote = "星际海盗：找不到该星球当前扇区";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(player);
      const beforePlanetStats = structuredClone(planetStatsState);
      const beforePlayerState = choice.kind === "plutoOrbit" || choice.kind === "plutoLand"
        ? structuredClone(playerState)
        : null;
      const beforeRocketState = structuredClone(rocketState);
      const spend = players.spendResources(player, cost);
      if (!spend.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = spend.message;
        renderStateReadout();
        return spend;
      }
      const remove = removePlanetMarkerForChoice(choice, player, "current");
      if (!remove.ok) {
        restoreObjectSnapshot(player, beforePlayer);
        if (beforePlayerState) restoreObjectSnapshot(playerState, beforePlayerState);
        else restoreObjectSnapshot(planetStatsState, beforePlanetStats);
        endEffectHistoryStep();
        rocketState.statusNote = remove.message;
        renderStateReadout();
        return remove;
      }
      const place = rocketActions.launchRocketAtSector(rocketState, coordinate, {
        playerId: player.id,
        color: player.color,
      });
      if (!place.ok) {
        restoreObjectSnapshot(player, beforePlayer);
        if (beforePlayerState) restoreObjectSnapshot(playerState, beforePlayerState);
        else restoreObjectSnapshot(planetStatsState, beforePlanetStats);
        restoreObjectSnapshot(rocketState, beforeRocketState);
        endEffectHistoryStep();
        rocketState.statusNote = place.message;
        renderStateReadout();
        return place;
      }

      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复星际海盗发射前玩家状态",
      ));
      if (beforePlayerState) {
        recordHistoryCommand(historyCommands.createRestoreObjectCommand(
          playerState,
          beforePlayerState,
          "恢复星际海盗移除冥王星标记前玩家状态",
        ));
      } else {
        recordHistoryCommand(historyCommands.createRestorePlanetStatsCommand(
          planetStatsState,
          beforePlanetStats,
          "恢复星际海盗移除星球标记前状态",
        ));
      }
      recordHistoryCommand(historyCommands.createRestoreRocketStateCommand(
        rocketState,
        beforeRocketState,
        "恢复星际海盗发射前探测器状态",
      ));
      const launchResult = {
        ok: true,
        undoable: true,
        message: place.message,
        commands: [],
        events: [{
          type: "launch",
          playerId: player.id,
          playerColor: player.color,
          source: "industry_pirates_raid",
          rocketId: place.rocket?.id || null,
        }],
        payload: { rocketId: place.rocket?.id || null },
      };
      maybeApplyIndustryLaunchScan(launchResult);
      recordAbilityCommands(launchResult);
      renderRockets();
      syncPlanetOrbitLandMarkers();
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：移除 ${choice.label}，${launchResult.message}`,
        events: launchResult.events || [],
        payload: { choice, rocketId: place.rocket?.id || null, cost },
      }, [renderRockets]);
    });
  }

  function setCheatModeOpen(open) {
    tech.setCheatModeEnabled(techGameState, open);
    els.debugCheatButton?.setAttribute("aria-pressed", String(open));
    rocketState.statusNote = open ? "作弊模式：研究科技不消耗宣传" : "";
    updateActionButtons();
    renderStateReadout();
  }

  function toggleCheatMode() {
    setCheatModeOpen(!techGameState.ui.cheatModeEnabled);
  }

  function researchTechForCurrentPlayer() {
    return runAction("researchTech");
  }

  function commitSelectedResearchTech() {
    return { ok: false, message: "科技行动已改为效果链结算" };
  }

  function getCurrentPlayer() {
    if (uiRuntimeState.effectExecutionPlayerId) {
      const effectPlayer = getPlayerById(uiRuntimeState.effectExecutionPlayerId);
      if (effectPlayer) return effectPlayer;
    }
    return players.getCurrentPlayer(playerState);
  }

  function getPlayerByColor(color) {
    const normalizedColor = players.normalizePlayerColor(color);
    return playerState.players.find((player) => player.color === normalizedColor) || null;
  }

  function setDebugPlayerMenuOpen(open) {
    return debugRuntimeController.setDebugPlayerMenuOpen(open);
  }

  function renderDebugPlayerSwitch() {
    return debugRuntimeController.renderDebugPlayerSwitch();
  }

  function clearPlayerScopedSelectionsForSwitch() {
    pendingState.discardAction = null;
    pendingState.cardSelectionAction = null;
    pendingState.passReserveSelection = null;
    pendingState.passReserveSelectionDismissed = false;
    pendingState.handScanAction = null;
    pendingState.playCardSelection = null;
    cards.setSelectionActive(cardState, false);
    cards.setDiscardSelectionActive(cardState, false, 0);
    cards.setPlayCardSelectionActive(cardState, false);
    syncPassReserveSelectionChrome();
    tech.setTechSelectionActive(techGameState, false);
    tech.cancelPendingTake(techGameState);
    closeTechBlueSlotPicker();
    closeDataPlacePicker();
    closeScanTargetPicker();
    closeScanAction4Picker();
    closeLandTargetPicker();
    clearActionEffectFlow();
    clearActionPending();
  }

  function selectDefaultRocketForCurrentPlayer() {
    return debugRuntimeController.selectDefaultRocketForCurrentPlayer();
  }

  function switchCurrentPlayerColor(color) {
    return debugRuntimeController.switchCurrentPlayerColor(color);
  }

  function getExplicitPendingOwnerPlayerForFailsafe(pending) {
    if (!pending) return null;
    const directOwner = resolvePlayerReference({
      playerId: pending.player?.id || pending.playerId || pending.targetPlayerId,
      playerColor: pending.player?.color || pending.playerColor || pending.targetPlayerColor,
    });
    if (directOwner) return directOwner;
    return getExplicitEffectOwnerPlayer(pending.effect);
  }

  function getActionEffectOwnerPlayerForFailsafe() {
    if (!pendingState.actionEffectFlow) return null;
    const effect = getCurrentActionEffect();
    return getExplicitEffectOwnerPlayer(effect)
      || getPlayerById(pendingState.actionEffectFlow.activePlayerId)
      || getPlayerById(pendingState.actionEffectFlow.playerId)
      || getPlayerById(pendingState.actionEffectFlow.defaultPlayerId)
      || null;
  }

  function getFailsafePendingOwnerPlayer() {
    const effectOwner = getActionEffectOwnerPlayerForFailsafe();
    if (effectOwner) return effectOwner;

    const pendingEntries = [
      pendingState.movePayment,
      pendingState.discardAction,
      pendingState.cardSelectionAction,
      pendingState.passReserveSelection,
      pendingState.scanTargetAction,
      pendingState.probeSectorScanAction,
      pendingState.probeLocationRewardAction,
      pendingState.publicScanQueue,
      pendingState.handScanAction,
      pendingState.alienTraceAction,
      pendingState.landTargetAction,
      pendingState.dataPlaceAction,
      pendingState.cardTriggerAction,
      pendingState.cardTriggerFreeMove,
      pendingState.cardTaskCompletion,
      pendingState.jiuzheCardPlay,
      pendingState.yichangdianCardGain,
      pendingState.yichangdianCornerAction,
      pendingState.banrenmaCardGain,
      pendingState.banrenmaOpportunity,
      pendingState.chongCardGain,
      pendingState.chongFossilChoice,
      pendingState.chongTaskCompletion,
      pendingState.amibaCardGain,
      pendingState.amibaSymbolChoice,
      pendingState.amibaTraceRemoval,
      pendingState.aomomoCardGain,
      pendingState.runezuCardGain,
      pendingState.runezuSymbolBranch,
      pendingState.runezuFaceSymbolPlacement,
      pendingState.strategyPassiveSlotChoice,
      pendingState.piratesRaidPlacement,
      uiRuntimeState.industryFreeMoveState,
    ];
    for (const pending of pendingEntries) {
      const owner = getExplicitPendingOwnerPlayerForFailsafe(pending);
      if (owner) return owner;
    }
    return null;
  }

  function getRecoverableTurnPlayerForFailsafe() {
    const activeIds = new Set(turnState.activePlayerIds || []);
    const currentPlayer = players.getCurrentPlayer(playerState);
    if (
      currentPlayer?.id
      && activeIds.has(currentPlayer.id)
      && !isPlayerPassedThisRound(currentPlayer.id)
      && !hasPlayerCompletedThisTurn(currentPlayer.id)
    ) {
      return currentPlayer;
    }

    const pendingTurnPlayerId = getRoundOrderPlayerIds()
      .find((playerId) => (
        activeIds.has(playerId)
        && !isPlayerPassedThisRound(playerId)
        && !hasPlayerCompletedThisTurn(playerId)
      ));
    if (pendingTurnPlayerId) return getPlayerById(pendingTurnPlayerId);

    const firstEligiblePlayerId = getFirstEligiblePlayerId();
    return firstEligiblePlayerId ? getPlayerById(firstEligiblePlayerId) : currentPlayer;
  }

  function getAiTakeoverTargetPlayer() {
    const pendingOwner = getFailsafePendingOwnerPlayer();
    if (pendingOwner?.id && isAiAutoBattlePlayer(pendingOwner.id)) return pendingOwner;

    const currentPlayer = players.getCurrentPlayer(playerState);
    if (currentPlayer?.id && isAiAutoBattlePlayer(currentPlayer.id)) return currentPlayer;

    const recoverableTurnPlayer = getRecoverableTurnPlayerForFailsafe();
    if (recoverableTurnPlayer?.id && isAiAutoBattlePlayer(recoverableTurnPlayer.id)) {
      return recoverableTurnPlayer;
    }

    return getRoundOrderPlayerIds()
      .map((playerId) => getPlayerById(playerId))
      .find((player) => (
        player?.id
        && isAiAutoBattlePlayer(player.id)
        && !isPlayerPassedThisRound(player.id)
        && !hasPlayerCompletedThisTurn(player.id)
      )) || null;
  }

  function renderAfterFailsafeControl(message, options = {}) {
    if (message) rocketState.statusNote = message;
    selectDefaultRocketForCurrentPlayer();
    renderDebugPlayerSwitch();
    renderRoundStatus();
    syncCardSelectionChrome();
    syncDiscardSelectionChrome();
    syncPlayCardSelectionChrome();
    syncTechSelectionChrome();
    setTokenAssetSizes();
    renderPlayerStats();
    renderAlienPanels();
    renderTechBoard();
    renderRockets();
    renderPublicCards();
    renderReservedCards();
    updatePublicCardControls();
    updateActionButtons();
    renderStateReadout();
    schedulePersistentGameStateSave({ label: options.saveLabel || message || "兜底控制后状态" });
  }

  function resumeAiAutomationForFailsafe(targetPlayer) {
    const snapshot = createAiControlSnapshot();
    if (!snapshot?.enabled || !snapshot.playerIds?.length) {
      return { ok: false, message: "当前没有电脑玩家配置" };
    }
    if (!snapshot.playerIds.includes(targetPlayer?.id)) {
      return { ok: false, message: `${targetPlayer?.colorLabel || "该"}玩家不是电脑玩家` };
    }
    const restoreResult = restoreAiControlSnapshot(snapshot);
    scheduleAiAutoStepIfNeeded();
    return restoreResult;
  }

  function handleAiTakeoverFailsafe() {
    return debugRuntimeController.handleAiTakeoverFailsafe();
  }

  function handleForceSkipTurnFailsafe() {
    return debugRuntimeController.handleForceSkipTurnFailsafe();
  }

  function getReferencePlacementKindLabel(kind) {
    return REFERENCE_PLACEMENT_KIND_LABELS[kind] || kind || "贴图";
  }

  function getReferencePlacementName(placement) {
    if (!placement) return null;
    if (placement.kind === "satellite") {
      return `${placement.parentPlanetName} ${placement.satelliteName}`;
    }
    const index = placement.sequence ? placement.sequence : "";
    return `${placement.planetName} ${getReferencePlacementKindLabel(placement.kind)}${index}`;
  }

  function buildPlanetOrbitLandReferenceData() {
    return planetReferenceLayout.buildReferenceData();
  }

  function isPlanetMarkerRocket(rocket) {
    return Boolean(rocket?.referencePlacement?.isPlanetMarker);
  }

  function getBoardPointFromClientPosition(clientX, clientY) {
    const rect = els.wheelWrap.getBoundingClientRect();
    const size = solar.GLOBAL_COORDINATE_SYSTEM.size;

    return rocketActions.normalizeBoardPoint({
      x: ((clientX - rect.left) / rect.width) * size,
      y: ((clientY - rect.top) / rect.height) * size,
    });
  }

  function getPlanetsReferenceDimensions() {
    const width = els.planetsReferenceImage.naturalWidth
      || Number(els.planetsReferenceImage.getAttribute("width"))
      || PLANETS_REFERENCE_SIZE.width;
    const height = els.planetsReferenceImage.naturalHeight
      || Number(els.planetsReferenceImage.getAttribute("height"))
      || PLANETS_REFERENCE_SIZE.height;

    return { width, height };
  }

  function isPointInsideRect(clientX, clientY, rect) {
    return clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom;
  }

  function isClientPositionInsidePlanetsReference(clientX, clientY) {
    if (!els.planetsReferenceImage) return false;
    const rect = els.planetsReferenceImage.getBoundingClientRect();
    return isPointInsideRect(clientX, clientY, rect);
  }

  function getPlanetsReferencePointFromClientPosition(clientX, clientY) {
    const rect = els.planetsReferenceImage.getBoundingClientRect();
    const dimensions = getPlanetsReferenceDimensions();
    const percentX = ((clientX - rect.left) / rect.width) * 100;
    const percentY = ((clientY - rect.top) / rect.height) * 100;

    return rocketActions.normalizePlanetsReferencePoint({
      percentX,
      percentY,
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  function formatBoardPoint(point) {
    if (!point) return "无";
    return `[${point.x.toFixed(2)},${point.y.toFixed(2)}]`;
  }

  function getPolarPointFromBoardPoint(point) {
    return rocketActions.getPolarPointFromBoardPoint(point);
  }

  function getBoardPointFromPolarPoint(point) {
    return rocketActions.getBoardPointFromPolarPoint(point);
  }

  function getPolarPointFromClientPosition(clientX, clientY) {
    return getPolarPointFromBoardPoint(getBoardPointFromClientPosition(clientX, clientY));
  }

  function formatPolarPoint(point) {
    if (!point) return "无";
    return `[r=${point.radius.toFixed(2)},a=${point.angleDegrees.toFixed(2)}]`;
  }

  function formatSectorCoordinate(resolution) {
    if (!resolution?.sectorCoordinate) return "无";
    return `[${resolution.sectorCoordinate.x},${resolution.sectorCoordinate.y}]`;
  }

  function formatPlanetsReferencePoint(point) {
    if (!point) return "planets贴图 无";
    return `planets贴图[${point.x.toFixed(2)},${point.y.toFixed(2)}] ${point.percentX.toFixed(2)}%,${point.percentY.toFixed(2)}%`;
  }

  function isRocketOnPlanetsReference(rocket) {
    return (rocket?.surface || ROCKET_SURFACE.SOLAR) === ROCKET_SURFACE.PLANETS_REFERENCE;
  }

  function createDefaultReferencePlacementInput(placement) {
    return {
      x: placement.x,
      y: placement.y,
      width: PLANETS_REFERENCE_SIZE.width,
      height: PLANETS_REFERENCE_SIZE.height,
    };
  }

  function createPlanetMarkerPlacement(slot, markerState) {
    if (slot.satelliteId) {
      return {
        parentPlanetId: slot.parentPlanetId,
        parentPlanetName: slot.parentPlanetName,
        satelliteId: slot.satelliteId,
        satelliteName: slot.satelliteName,
        kind: "satellite",
        x: slot.x,
        y: slot.y,
        isPlanetMarker: true,
        playerId: markerState.playerId,
        color: markerState.color,
        referenceOffsetTokenWidths: markerState.referenceOffsetTokenWidths || 0,
      };
    }

    return {
      planetId: slot.planetId,
      planetName: slot.planetName,
      kind: slot.kind,
      sequence: slot.sequence,
      angleOffsetDegrees: slot.angleOffsetDegrees,
      center: slot.center,
      x: slot.x,
      y: slot.y,
      isPlanetMarker: true,
      playerId: markerState.playerId,
      color: markerState.color,
      referenceOffsetTokenWidths: markerState.referenceOffsetTokenWidths || 0,
    };
  }

  function createPlanetMarkerRocket(slot, markerState) {
    const placement = createPlanetMarkerPlacement(slot, markerState);
    const rocket = {
      id: rocketState.nextRocketId,
      playerId: markerState.playerId,
      color: markerState.color,
      referencePlacement: placement,
    };

    rocketState.nextRocketId += 1;
    rocketState.rockets.push(rocket);
    rocketActions.placeRocketAtPlanetsReferencePoint(
      rocketState,
      rocket.id,
      createDefaultReferencePlacementInput(placement),
    );
    return rocket;
  }

  function removePlanetMarkerRockets() {
    const markerRockets = rocketState.rockets.filter(isPlanetMarkerRocket);
    markerRockets.forEach((rocket) => {
      rocketActions.removeRocket(rocketState, rocket.id);
      removeRocketElement(rocket.id);
    });
  }

  function syncPlanetOrbitLandMarkers() {
    removePlanetMarkerRockets();

    for (const planetId of planetReferenceLayout.PLANET_ORDER) {
      for (const markerState of planetStats.getPlanetOrbitMarkers(planetStatsState, planetId)) {
        const slot = planetReferenceLayout.getPlanetSlot(planetId, "orbit", markerState.sequence);
        if (slot) createPlanetMarkerRocket(slot, markerState);
      }
      for (const markerState of planetStats.getPlanetLandingMarkers(planetStatsState, planetId)) {
        const slot = planetReferenceLayout.getPlanetSlot(
          planetId,
          "land",
          markerState.displaySlot || markerState.sequence,
        );
        if (slot) createPlanetMarkerRocket(slot, markerState);
      }
      for (const markerState of planetStats.getSatelliteLandingMarkers(planetStatsState, planetId)) {
        const slot = planetReferenceLayout.getSatellitePlacement(planetId, markerState.satelliteId);
        if (slot) createPlanetMarkerRocket(slot, markerState);
      }
    }

    renderRockets();
  }

  function seedDefaultReferenceRockets() {
    if (rocketState.rockets.length) return;

    rocketState.activeRocketId = null;
    rocketState.statusNote = null;
    syncPlanetOrbitLandMarkers();
  }

  function formatRocketLabel(rocket) {
    return rocketActions.formatRocketLabel(rocket);
  }

  function getMovableTokensForPlayer(playerId) {
    return rocketActions.getMovableTokensForPlayer
      ? rocketActions.getMovableTokensForPlayer(rocketState, playerId)
      : rocketActions.getRocketsForPlayer(rocketState, playerId);
  }

  function createRocketSnapshot(rocket) {
    return rocketActions.createRocketSnapshot(rocket);
  }

  function getEarthSectorCoordinate() {
    const snapshot = solar.createSolarSnapshot(solarState);
    const earth = snapshot.planetLocations.find((planet) => planet.planetId === "earth");

    if (!earth) {
      throw new Error("Earth position was not found in the current solar snapshot");
    }

    return { x: earth.x, y: earth.y };
  }

  function loadTokenWidth(asset, scale, fallbackNaturalWidth, onLoad) {
    const image = new Image();
    const resolveWidth = (naturalWidth) => {
      const canonicalWidth = Number.isFinite(Number(fallbackNaturalWidth))
        ? Number(fallbackNaturalWidth)
        : naturalWidth;
      onLoad(Math.max(1, Math.round(canonicalWidth * scale)));
    };
    image.addEventListener("load", () => {
      resolveWidth(image.naturalWidth || fallbackNaturalWidth);
    });
    image.addEventListener("error", () => {
      resolveWidth(fallbackNaturalWidth);
    });
    image.src = asset;
  }

  function setTokenAssetSizes() {
    return renderRuntime.setTokenAssetSizes();
  }

  function applyTokenWidth(element, rocket) {
    if (!isRocketOnPlanetsReference(rocket)) {
      element.style.removeProperty("width");
      return;
    }

    const kind = rocket.referencePlacement?.kind;
    if (kind === "orbit" && tokenWidths.orbit) {
      element.style.width = `${tokenWidths.orbit}px`;
      return;
    }
    if ((kind === "land" || kind === "satellite") && tokenWidths.landding) {
      element.style.width = `${tokenWidths.landding}px`;
      return;
    }
    if (tokenWidths.rocket) {
      element.style.width = `${tokenWidths.rocket}px`;
      return;
    }
    element.style.removeProperty("width");
  }

  function getRocketColorDefinition(rocket) {
    return players.getPlayerColorDefinition(rocket.color || players.DEFAULT_PLAYER_COLOR);
  }

  function getTokenAssetForRocket(rocket, color) {
    if (rocket.tokenSrc) return rocket.tokenSrc;
    if (!isRocketOnPlanetsReference(rocket)) return color.rocketAsset;

    const kind = rocket.referencePlacement?.kind;
    if (kind === "orbit") return color.satelliteAsset;
    if (kind === "land" || kind === "satellite") return color.landdingAsset;
    return color.rocketAsset;
  }

  function isChongFossilToken(rocket) {
    return (rocket?.kind || rocketActions.ROCKET_KIND?.STANDARD) === rocketActions.ROCKET_KIND?.CHONG_FOSSIL;
  }

  function getTokenTypeLabel(rocket) {
    if (isChongFossilToken(rocket)) {
      return "化石";
    }
    if (!isRocketOnPlanetsReference(rocket)) return "火箭";

    const kind = rocket.referencePlacement?.kind;
    if (kind === "orbit") return "卫星";
    if (kind === "land") return "登陆";
    return "火箭";
  }

  function renderRocketElement(rocket) {
    return renderRuntime.renderRocketElement(rocket);
  }

  function renderChongFossilOwnerTokenForRocket(rocket, activeKeys = null) {
    return renderRuntime.renderChongFossilOwnerTokenForRocket(rocket, activeKeys);
  }

  function renderChongFossilOwnerTokens() {
    return renderRuntime.renderChongFossilOwnerTokens();
  }

  function renderRockets() {
    return renderRuntime.renderRockets();
  }

  function renderPiratesRaidPlanetMarkers() {
    return renderRuntime.renderPiratesRaidPlanetMarkers();
  }

  function getYichangdianAnomalyKey(anomaly) {
    return `${anomaly.markerId}:${anomaly.sectorX}:${anomaly.y || 4}`;
  }

  function getYichangdianAnomalyBoardPoint(anomaly) {
    return aliens.getYichangdianAnomalyMarkerBoardPoint?.(solar, anomaly)
      || solar.solarGridToGlobalPoint(anomaly.sectorX, anomaly.y || 4);
  }

  function renderYichangdianAnomalyMarkers() {
    return renderRuntime.renderYichangdianAnomalyMarkers();
  }

  function getChongPlanetFossilMarkerKey(planetId) {
    return `planet:${planetId}`;
  }

  function getChongPlanetFossilPoint(planetLocation) {
    const boundary = solar.getSectorCoordinateBoundary(planetLocation.x, planetLocation.y);
    const polar = boundary.polarBoundary || {};
    if (
      Number.isFinite(polar.innerRadius)
      && Number.isFinite(polar.outerRadius)
      && Number.isFinite(polar.startAngleDegrees)
      && Number.isFinite(polar.endAngleDegrees)
    ) {
      const radius = polar.innerRadius + (polar.outerRadius - polar.innerRadius) * 0.78;
      const angle = polar.startAngleDegrees + (polar.endAngleDegrees - polar.startAngleDegrees) * 0.72;
      return solar.polarToGlobalPoint(radius, angle);
    }
    return boundary.boardCenter || solar.solarGridToGlobalPoint(planetLocation.x, planetLocation.y);
  }

  function renderChongPlanetFossilMarkers() {
    return renderRuntime.renderChongPlanetFossilMarkers();
  }

  function getRunezuBoardSymbolKey(sourceSymbol) {
    return `${sourceSymbol.sourceType}:${sourceSymbol.sourceId}`;
  }

  function getRunezuSourceSymbolPoint(sourceSymbol) {
    if (sourceSymbol.sourceType === "planet") {
      const planetLocation = solar.createSolarSnapshot(solarState).planetLocations
        .find((planet) => planet.planetId === sourceSymbol.sourceId);
      if (!planetLocation) return null;
      const boundary = solar.getSectorCoordinateBoundary(planetLocation.x, planetLocation.y);
      const polar = boundary.polarBoundary || {};
      if (
        Number.isFinite(polar.innerRadius)
        && Number.isFinite(polar.outerRadius)
        && Number.isFinite(polar.startAngleDegrees)
        && Number.isFinite(polar.endAngleDegrees)
      ) {
        const radius = polar.innerRadius + (polar.outerRadius - polar.innerRadius) * 0.72;
        const angle = polar.startAngleDegrees + (polar.endAngleDegrees - polar.startAngleDegrees) * 0.72;
        return solar.polarToGlobalPoint(radius, angle);
      }
      return boundary.boardCenter || solar.solarGridToGlobalPoint(planetLocation.x, planetLocation.y);
    }
    if (sourceSymbol.sourceType === "sector") {
      for (let x = 0; x < 8; x += 1) {
        const nebula = solar.getNebulaAtCoordinate(x, 5, solarState.sectorBySlot);
        if (nebula?.id !== sourceSymbol.sourceId) continue;
        const boundary = solar.getSectorCoordinateBoundary(x, 5);
        const polar = boundary.polarBoundary || {};
        if (
          Number.isFinite(polar.innerRadius)
          && Number.isFinite(polar.outerRadius)
          && Number.isFinite(polar.startAngleDegrees)
          && Number.isFinite(polar.endAngleDegrees)
        ) {
          const radius = polar.innerRadius + (polar.outerRadius - polar.innerRadius) * 0.38;
          const angle = polar.startAngleDegrees + (polar.endAngleDegrees - polar.startAngleDegrees) * 0.72;
          return solar.polarToGlobalPoint(radius, angle);
        }
        return boundary.boardCenter || solar.solarGridToGlobalPoint(x, 5);
      }
    }
    return null;
  }

  function mountRunezuBoardLayerSymbol(sourceSymbol, activeKeys) {
    if (!els.tokenLayer || !runezu || sourceSymbol.claimedByPlayerId || sourceSymbol.claimedByPlayerColor) return;
    if (sourceSymbol.sourceType !== "planet" && sourceSymbol.sourceType !== "sector") return;
    const point = getRunezuSourceSymbolPoint(sourceSymbol);
    if (!point) return;
    const key = getRunezuBoardSymbolKey(sourceSymbol);
    activeKeys.add(key);
    let element = runezuBoardSymbolElements.get(key);
    if (!element) {
      element = document.createElement("img");
      element.className = "runezu-board-symbol-marker";
      element.draggable = false;
      runezuBoardSymbolElements.set(key, element);
      els.tokenLayer.appendChild(element);
    }
    if (element.parentElement !== els.tokenLayer) els.tokenLayer.appendChild(element);
    element.style.left = `${point.x / 10}%`;
    element.style.top = `${point.y / 10}%`;
    element.src = runezu.getSymbolSrc(sourceSymbol.symbolId);
    element.alt = `符文族 ${sourceSymbol.symbolId}`;
    element.dataset.runezuSourceType = sourceSymbol.sourceType;
    element.dataset.runezuSourceId = sourceSymbol.sourceId;
    element.title = `符文族 ${sourceSymbol.sourceType}:${sourceSymbol.sourceId} ${runezu.formatSymbolLabel(sourceSymbol.symbolId)}`;
  }

  function mountRunezuTechSymbol(sourceSymbol, activeKeys) {
    if (!runezu || sourceSymbol.claimedByPlayerId || sourceSymbol.claimedByPlayerColor) return;
    if (sourceSymbol.sourceType !== "tech") return;
    const slot = techRenderContext.supplySlots?.[sourceSymbol.sourceId]
      || document.querySelector(`.tech-slot[data-tech-slot="${sourceSymbol.sourceId}"]`);
    if (!slot) return;
    const key = getRunezuBoardSymbolKey(sourceSymbol);
    activeKeys.add(key);
    let element = runezuBoardSymbolElements.get(key);
    if (!element) {
      element = document.createElement("img");
      element.className = "runezu-tech-symbol-marker";
      element.draggable = false;
      runezuBoardSymbolElements.set(key, element);
    }
    const mount = slot.querySelector(".tech-slot-stack") || slot;
    if (element.parentElement !== mount) mount.appendChild(element);
    element.src = runezu.getSymbolSrc(sourceSymbol.symbolId);
    element.alt = `符文族 ${sourceSymbol.symbolId}`;
    element.dataset.runezuSourceType = sourceSymbol.sourceType;
    element.dataset.runezuSourceId = sourceSymbol.sourceId;
    element.title = `符文族科技 ${sourceSymbol.sourceId} ${runezu.formatSymbolLabel(sourceSymbol.symbolId)}`;
  }

  function renderRunezuBoardSymbols() {
    return renderRuntime.renderRunezuBoardSymbols();
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
    return Boolean(
      aomomo
      && (solarState.aomomoActive
        || alienGameState.aomomo?.revealInitialized
        || Number(player?.resources?.aomomoFossils) > 0),
    );
  }

  function shouldShowFangzhouUnlockStats() {
    return Boolean(fangzhou && alienGameState.fangzhou?.revealInitialized);
  }

  function getPlayerFangzhouUnlockCount(player) {
    const count = Number(fangzhou?.getUnlockCount?.(alienGameState, player)) || 0;
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
    if (!runezu || !alienGameState.runezu?.revealInitialized) return [];
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

  function getScanScorePlayer(result) {
    const event = (result?.events || []).find((item) => item?.type === "signalMarked" && (item.playerId || item.playerColor));
    return getPlayerById(result?.playerId || event?.playerId)
      || getPlayerByColor(result?.playerColor || event?.playerColor)
      || getCurrentPlayer();
  }

  function recordScanScoreSourcesFromAbilityResult(result, history = actionHistory) {
    const scanResults = [
      result,
      result?.payload?.industryLaunchScan,
    ].filter(Boolean);
    for (const scanResult of scanResults) {
      if (!getScoreAwardedFromScanResult(scanResult)) continue;
      recordScanScoreSource(getScanScorePlayer(scanResult), scanResult, history);
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
    const actionType = pendingState.actionEffectFlow?.actionType;
    switch (actionType) {
      case "orbit":
        return SCORE_SOURCE_KEYS.ORBIT;
      case "land":
        return SCORE_SOURCE_KEYS.LAND;
      case "cardTask":
      case "cardTrigger":
        return SCORE_SOURCE_KEYS.TASK_CARD;
      case "playCard":
        return isAlienFamilyCard(pendingState.actionEffectFlow?.card)
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

  function computePlayerFinalScoreBreakdown(player) {
    const probeLocationData = buildProbeLocationIndex();
    return endGameScoring?.computePlayerFinalScore
      ? endGameScoring.computePlayerFinalScore({
        currentPlayer: player,
        finalScoringState,
        playerState,
        nebulaDataState,
        alienGameState,
        planetStatsState,
        ...buildPlutoMarkerContext(),
        probeLocations: probeLocationData.index,
        probeLocationDetails: probeLocationData.details,
        cardEffects,
        getCardTypeCode,
        getPlayerCompanyBaseIncome,
      })
      : { totalScore: player.resources?.score || 0 };
  }

  function createOpponentStatRow(className) {
    const row = document.createElement("div");
    row.className = `opponent-stat-row ${className}`;
    return row;
  }

  function createOpponentTechRow(player, techType, prefix, techColor) {
    const row = createOpponentStatRow("opponent-stat-row-tech");
    const ownedTiles = player.techState?.ownedTiles || {};

    for (let index = 1; index <= 4; index += 1) {
      const tileId = `${techType}${index}`;
      const item = document.createElement("span");
      item.className = "opponent-tech-item";
      item.textContent = `${prefix}${index}`;
      if (ownedTiles[tileId]) {
        item.classList.add("is-owned");
        item.style.setProperty("--opponent-tech-color", techColor);
        if (player.techState?.disabledTiles?.[tileId]) {
          item.classList.add("is-disabled");
        }
      } else {
        item.classList.add("is-missing");
      }
      row.append(item);
    }

    return row;
  }

  function createOpponentPlayerHeaderRow(player, score, finalTotalScore) {
    const color = players.getPlayerColorDefinition(player.color);
    const row = createOpponentStatRow("opponent-stat-row-header");
    const roundOrderNumber = getPlayerRoundOrderNumber(player?.id);

    const idEl = document.createElement("span");
    idEl.className = "opponent-stat-id player-stat-value";
    idEl.classList.toggle("is-player-passed", isPlayerPassedThisRound(player?.id));
    idEl.textContent = getPlayerDisplayLabel(player);
    idEl.title = idEl.textContent;

    const orderEl = document.createElement("span");
    orderEl.className = "player-turn-order-number";
    orderEl.textContent = roundOrderNumber == null ? "-" : String(roundOrderNumber);
    orderEl.title = roundOrderNumber == null ? "不在本轮顺位中" : `本轮顺位 ${roundOrderNumber}`;
    orderEl.setAttribute("aria-label", orderEl.title);

    const marker = document.createElement("span");
    marker.className = "player-color-marker";
    marker.style.setProperty("--player-color", color.uiColor);
    marker.setAttribute("aria-label", color.label);

    row.append(
      idEl,
      orderEl,
      marker,
      createInlineIconValue("分数", score, RESOURCE_ICON_SRC.score, "player-stat-score"),
      createInlineIconValue("终局总分", finalTotalScore, RESOURCE_ICON_SRC.finalScore, "player-stat-final-score"),
    );
    return row;
  }

  function createOpponentSummaryRow(player) {
    const row = createOpponentStatRow("opponent-stat-row-summary");
    const orbitLandCount = endGameScoring?.countOrbitOrLandMarkers
      ? endGameScoring.countOrbitOrLandMarkers(player, planetStatsState, buildPlutoMarkerContext())
      : 0;

    row.append(createStatIcon("环绕登陆", orbitLandCount, RESOURCE_ICON_SRC.orbitOrLand));

    for (const { color, label, iconKey } of OPPONENT_SECTOR_WIN_STATS) {
      const count = endGameScoring?.countSectorWinsByColor
        ? endGameScoring.countSectorWinsByColor(player, nebulaDataState, color)
        : 0;
      row.append(createStatIcon(label, count, RESOURCE_ICON_SRC[iconKey]));
    }

    return row;
  }

  function createOpponentAlienTraceRow(player) {
    const row = createOpponentStatRow("opponent-stat-row-alien-traces");
    row.append(
      createStatIcon(
        "黄色外星人痕迹",
        endGameScoring?.countTraceMarkers
          ? endGameScoring.countTraceMarkers(player, alienGameState, "yellow")
          : 0,
        RESOURCE_ICON_SRC.alienYellow,
      ),
      createStatIcon(
        "粉色外星人痕迹",
        endGameScoring?.countTraceMarkers
          ? endGameScoring.countTraceMarkers(player, alienGameState, "pink")
          : 0,
        RESOURCE_ICON_SRC.alienPink,
      ),
      createStatIcon(
        "蓝色外星人痕迹",
        endGameScoring?.countTraceMarkers
          ? endGameScoring.countTraceMarkers(player, alienGameState, "blue")
          : 0,
        RESOURCE_ICON_SRC.alienBlue,
      ),
    );
    return row;
  }

  function createOpponentRunezuSymbolRow(player) {
    const row = createOpponentStatRow("opponent-stat-row-runezu-symbols");
    const nodes = buildPlayerRunezuStatNodes(player);
    row.replaceChildren(...nodes);
    row.hidden = !nodes.length;
    return row;
  }

  function createOpponentJiuzheRow(player) {
    const cardsForPlayer = jiuzhe?.getPlayerJiuzheCards?.(alienGameState, player) || [];
    const playedCount = jiuzhe?.countPlayedCards?.(alienGameState, player) || 0;
    const threat = jiuzhe?.getPanelThreat?.(alienGameState, player) || 0;
    const revealed = Boolean(alienGameState.jiuzhe?.revealedSlotId);
    if (!revealed && !cardsForPlayer.length && !playedCount && !threat) return null;

    const row = createOpponentStatRow("opponent-stat-row-jiuzhe");
    row.append(
      createStatIcon("已打出九折牌", playedCount, RESOURCE_ICON_SRC.jiuzheCard),
      createStatIcon("九折威胁度", threat, RESOURCE_ICON_SRC.jiuzheThreat),
    );
    return row;
  }

  function renderOpponentStats() {
    return renderRuntime.renderOpponentStats();
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

  function layoutReservedCardFan(cardCount) {
    layoutCardFan(els.reservedCardFan, cardCount);
  }

  function layoutReservedCardRows() {
    if (!els.reservedCardFan) return;
    els.reservedCardFan.querySelectorAll(".reserved-card-row").forEach((row) => {
      layoutCardFan(row);
    });
  }

  function renderPlayerHand() {
    return renderRuntime.renderPlayerHand();
  }

  function renderReservedCards() {
    return renderRuntime.renderReservedCards();
  }

  function createReservedCardRow(rowType, label) {
    const row = document.createElement("div");
    row.className = `reserved-card-row reserved-card-row-${rowType}`;
    row.dataset.reservedRow = rowType;
    row.setAttribute("aria-label", label);
    return row;
  }

  function createJiuzheReservedButton(player) {
    const cardsForPlayer = jiuzhe?.getPlayerJiuzheCards?.(alienGameState, player) || [];
    if (!cardsForPlayer.length) return null;
    const playedCount = jiuzhe.countPlayedCards(alienGameState, player);
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
    const mark = banrenma?.getPlayerScoreMarks?.(alienGameState, currentPlayer)
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

  function renderInitialSelectionArea() {
    return renderRuntime.renderInitialSelectionArea();
  }

  function applyIndustryStartupPassives() {
    for (const player of playerState.players) {
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
      const markResult = finalScoring.placeDirectMarkAtSlot(finalScoringState, "c", player, 3, {
        tokenSrc: getNormalTokenAssetForPlayer(player),
        source: "mission_relay_startup",
      });
      if (!markResult.ok) {
        rocketState.statusNote = markResult.message;
      }
    }
    renderFinalScoreBoard();
  }

  function isIndustryHandSelectionActive() {
    return pendingState.cardSelectionAction?.type === "industry_deepspace_hand"
      || pendingState.cardSelectionAction?.type === "industry_future_hand";
  }

  function isIndustryFutureSpanHandSelectionActive() {
    return pendingState.cardSelectionAction?.type === "industry_future_hand";
  }

  function isIndustryFreeMoveActive() {
    return Boolean(uiRuntimeState.industryFreeMoveState);
  }

  function createIndustryActionRestoreCommand(player, beforePlayer, companyLabel, options = {}) {
    if (!player || !beforePlayer) return null;
    return {
      label: `撤销公司 1x：${companyLabel || "公司牌"}`,
      describe: `恢复${companyLabel || "公司牌"} 1x 行动前状态`,
      undo() {
        cancelIndustryAbilityFlow({ silent: true });
        if (options.clearEffectFlow) {
          clearActionEffectFlow();
        }
        restoreObjectSnapshot(player, beforePlayer);
        renderInitialSelectionArea();
      },
    };
  }

  function recordIndustryActionRestoreCommand(player, beforePlayer, companyLabel) {
    const command = createIndustryActionRestoreCommand(player, beforePlayer, companyLabel);
    if (command) recordQuickHistoryCommand(command);
  }

  function clearIndustryRollbackUi() {
    if (pendingState.scanTargetAction?.type === "industry_remove_tech") {
      pendingState.scanTargetAction = null;
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    }
    if (pendingState.discardAction?.type === "industry_helios_income") {
      pendingState.discardAction = null;
      cards.setDiscardSelectionActive(cardState, false, 0);
      syncDiscardSelectionChrome();
    }
    if (pendingState.cardSelectionAction?.type?.startsWith?.("industry_")) {
      pendingState.cardSelectionAction = null;
      cards.setSelectionActive(cardState, false);
      syncCardSelectionChrome();
    }
    if (techGameState?.ui?.industryBorrowMode) {
      techGameState.ui.industryBorrowMode = false;
      tech.setTechSelectionActive(techGameState, false);
      syncTechSelectionChrome();
    }
    if (uiRuntimeState.moveHighlightRocketId != null || uiRuntimeState.industryFreeMoveState) {
      deactivateMoveMode();
    }
    pendingState.industryAbility = null;
    uiRuntimeState.industryFreeMoveState = null;
    syncIndustryHandSelectionChrome();
    syncInteractionFocusChrome();
  }

  function rollbackPendingIndustryQuickAction(message = "已取消公司 1x 行动") {
    const result = quickActionHistory.hasSession()
      ? quickActionHistory.undoLastStep()
      : { ok: false, message: "没有可撤销的公司 1x 行动" };
    if (result.ok) {
      uiRuntimeState.effectStepActive = false;
      forgetLastHistoryStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
      removeLastActionLogStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
    }
    clearIndustryRollbackUi();
    if (result.ok && !quickActionHistory.hasUndoableStep()) {
      quickActionHistory.commitSession();
      clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
    }
    rocketState.statusNote = result.ok ? message : (result.message || message);
    renderPlayerStats();
    renderPlayerHand();
    renderPublicCards();
    renderInitialSelectionArea();
    renderRockets();
    updateActionButtons();
    renderStateReadout();
    return result;
  }

  function cancelIndustryAbilityFlow(options = {}) {
    if (techGameState?.ui?.industryBorrowMode) {
      techGameState.ui.industryBorrowMode = false;
      tech.setTechSelectionActive(techGameState, false);
      syncTechSelectionChrome();
    }
    if (pendingState.cardSelectionAction?.type?.startsWith?.("industry_")) {
      if (pendingState.cardSelectionAction.refundCost && pendingState.cardSelectionAction.player) {
        players.gainResources(pendingState.cardSelectionAction.player, pendingState.cardSelectionAction.refundCost);
      }
      pendingState.cardSelectionAction = null;
      cards.setSelectionActive(cardState, false);
      syncCardSelectionChrome();
    }
    pendingState.industryAbility = null;
    uiRuntimeState.industryFreeMoveState = null;
    if (uiRuntimeState.moveHighlightRocketId != null) {
      deactivateMoveMode();
    }
    if (!options.silent) {
      renderPlayerHand();
      renderPublicCards();
      renderInitialSelectionArea();
      updateActionButtons();
    }
    syncIndustryHandSelectionChrome();
    syncInteractionFocusChrome();
  }

  function finishIndustryAbilityFlow(message) {
    const flowType = pendingState.industryAbility?.flowType;
    pendingState.industryAbility = null;
    uiRuntimeState.industryFreeMoveState = null;
    cards.setSelectionActive(cardState, false);
    pendingState.cardSelectionAction = null;
    syncCardSelectionChrome();
    if (message) rocketState.statusNote = message;
    renderPlayerStats();
    renderPublicCards();
    renderPlayerHand();
    renderInitialSelectionArea();
    updateActionButtons();
    renderStateReadout();
    syncIndustryHandSelectionChrome();
    syncInteractionFocusChrome();
    if (flowType && !isIndustryIrreversibleFlow(flowType)) {
      completeIndustryAbilityQuickStep(message || rocketState.statusNote || null);
    }
  }

  function startIndustryAbilityFlow(flow, options = {}) {
    if (!flow?.ok) {
      rocketState.statusNote = flow?.message || "公司 1x 行动无法启动";
      renderStateReadout();
      return false;
    }

    pendingState.industryAbility = { ...flow };
    switch (flow.flowType) {
      case "stratus_public_corners":
        return startIndustryStratusEffectFlow(flow, options);
      case "turing_borrow_tech":
        return beginIndustryTuringBorrow(flow);
      case "sentinel_arm_play_corner": {
        const injected = tryInjectSentinelPlayCornerEffectAfterArm();
        finishIndustryAbilityFlow(injected
          ? `${flow.message}；已加入打牌效果队列`
          : flow.message);
        return true;
      }
      case "huanyu_free_moves":
        return startIndustryHuanyuMoveEffectFlow(flow, options);
      case "fundamentalism_score_exchange":
        return startIndustryFundamentalismExchangeFlow(flow, options);
      case "pirates_raid_launch":
        return startIndustryPiratesRaidLaunchFlow(flow, options);
      case "helios_remove_tech":
        return openIndustryHeliosTechPicker(flow);
      case "mission_publicity_pick":
        return startIndustryPublicityPick(flow, "industry_mission_pick");
      case "fenwick_publicity_pick":
        return startIndustryPublicityPick(flow, "industry_fenwick_pick");
      case "deepspace_swap":
        pendingState.cardSelectionAction = {
          type: "industry_deepspace_hand",
          player: getCurrentPlayer(),
          allowBlindDraw: false,
        };
        rocketState.statusNote = flow.message;
        syncIndustryHandSelectionChrome();
        renderStateReadout();
        return true;
      case "future_span_pick":
        beginCardSelection({
          type: "industry_future_pick",
          player: getCurrentPlayer(),
          allowBlindDraw: false,
          advanceAmount: flow.advanceAmount,
        });
        rocketState.statusNote = flow.message;
        renderStateReadout();
        return true;
      case "strategy_pick":
        beginCardSelection({
          type: "industry_strategy_pick",
          player: getCurrentPlayer(),
          allowBlindDraw: false,
        });
        rocketState.statusNote = flow.message;
        renderStateReadout();
        return true;
      default:
        cancelIndustryAbilityFlow({ silent: true });
        rocketState.statusNote = flow.message || "未实现的公司 1x 行动";
        renderStateReadout();
        return false;
    }
  }

  function startIndustryStratusEffectFlow(flow, options = {}) {
    const nodes = industry?.buildStratusPublicCornerEffectNodes?.(cards, cardState.publicCards) || [];
    pendingState.industryAbility = null;
    pendingState.cardSelectionAction = null;
    cards.setSelectionActive(cardState, false);
    syncCardSelectionChrome();

    if (!nodes.length) {
      rocketState.statusNote = "层云核心：公共牌区没有可结算的卡牌";
      renderStateReadout();
      return false;
    }

    const preHistoryCommands = [];
    if (options.markerRestoreCommand) preHistoryCommands.push(options.markerRestoreCommand);
    const started = startCardEffectFlow(
      "industry-stratus-public-corners",
      flow.label || "层云核心",
      nodes,
      {
        actionType: "industryStratus",
        historySource: HISTORY_SOURCE_QUICK,
        consumesMainAction: false,
        preHistoryCommands,
      },
    );
    if (started) {
      rocketState.statusNote = flow.message || "层云核心：请按效果栏依次结算公共牌区 3 张牌的弃牌角标";
      renderPublicCards();
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }
    return started;
  }

  function startIndustryFundamentalismExchangeFlow(flow, options = {}) {
    const groupId = `industry-fundamentalism-${turnState.roundNumber}-${turnState.turnNumber}`;
    const nodes = industry?.buildFundamentalismScoreExchangeEffectNodes?.({
      label: flow.label || "原教旨主义",
      count: flow.exchangeCount ?? industry?.FUNDAMENTALISM_EXCHANGE_COUNT ?? 3,
      groupId,
    }) || [];
    pendingState.industryAbility = null;
    pendingState.cardSelectionAction = null;
    cards.setSelectionActive(cardState, false);
    syncCardSelectionChrome();

    if (!nodes.length) {
      rocketState.statusNote = "原教旨主义：没有可结算的兑换效果";
      renderStateReadout();
      return false;
    }

    const preHistoryCommands = [];
    if (options.markerRestoreCommand) preHistoryCommands.push(options.markerRestoreCommand);
    const started = startCardEffectFlow(
      "industry-fundamentalism-score-exchange",
      flow.label || "原教旨主义",
      nodes,
      {
        actionType: "industryFundamentalism",
        historySource: HISTORY_SOURCE_QUICK,
        consumesMainAction: false,
        preHistoryCommands,
      },
    );
    if (started) {
      rocketState.statusNote = flow.message || "原教旨主义：请按效果栏结算 3 次分数/资源兑换";
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }
    return started;
  }

  function startIndustryPublicityPick(flow, pendingType) {
    const player = getCurrentPlayer();
    const cost = flow.publicityCost ?? industry.PUBLICITY_PICK_COST;
    if (!players.canAfford(player, { publicity: cost })) {
      rocketState.statusNote = `宣传不足，需要 ${cost} 宣传`;
      renderStateReadout();
      return false;
    }
    players.spendResources(player, { publicity: cost });
    beginCardSelection({
      type: pendingType,
      player,
      allowBlindDraw: false,
      refundCost: { publicity: cost },
      flowLabel: flow.label,
    });
    rocketState.statusNote = flow.message;
    renderStateReadout();
    return true;
  }

  function beginIndustryTuringBorrow(flow) {
    tech.setTechSelectionActive(techGameState, true);
    techGameState.ui.industryBorrowMode = true;
    techGameState.ui.selectedTileId = null;
    techGameState.ui.pendingTileId = null;
    techGameState.ui.allowedTechTypes = [...INDUSTRY_TURING_BORROW_TECH_TYPES];
    techGameState.ui.statusNote = flow.message;
    rocketState.statusNote = flow.message;
    syncTechSelectionChrome();
    renderTechBoard();
    renderStateReadout();
    return true;
  }

  function failIndustryTuringBorrow(message) {
    techGameState.ui.statusNote = message;
    rocketState.statusNote = message;
    renderTechBoard();
    renderStateReadout();
    return { ok: false, message };
  }

  function checkIndustryTuringBorrowTile(tileId) {
    const techType = tech.getTechType?.(tileId) || null;
    if (!INDUSTRY_TURING_BORROW_TECH_TYPES.includes(techType)) {
      return { ok: false, message: "图灵系统只能借用橙色或紫色科技" };
    }

    const player = getCurrentPlayer();
    if (!player) return { ok: false, message: "没有当前玩家" };
    if (!player.techState) player.techState = players.normalizePlayerTechState(null);

    const check = tech.resolver.canTakeTile(
      techGameState.board,
      player.techState,
      tileId,
      { techTypes: INDUSTRY_TURING_BORROW_TECH_TYPES },
    );
    return check.ok ? { ok: true, techType } : check;
  }

  function confirmIndustryTuringBorrow(tileId) {
    const borrowCheck = checkIndustryTuringBorrowTile(tileId);
    if (!borrowCheck.ok) {
      return failIndustryTuringBorrow(borrowCheck.message || "无法借用该科技");
    }

    const player = getCurrentPlayer();
    const beforePlayer = structuredClone(player);
    player.industryBorrowedTechTileId = tileId;
    player.industryBorrowedTechRound = turnState.roundNumber;
    player.industryBorrowedTechTurn = turnState.turnNumber;
    tech.setTechSelectionActive(techGameState, false);
    techGameState.ui.industryBorrowMode = false;
    syncTechSelectionChrome();
    recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      "恢复图灵借用前玩家状态",
    ));
    finishIndustryAbilityFlow(`图灵系统：当前回合借用 ${tileId} 效果`);
    return { ok: true, tileId };
  }

  function openIndustryHeliosTechPicker(flow) {
    const player = getCurrentPlayer();
    const removable = (tech.playerTech?.listActiveOwnedTileIds?.(player.techState) || [])
      .filter((tileId) => !String(tileId).startsWith("blue"));
    if (!removable.length) {
      finishIndustryAbilityFlow("赫利昂联合体：没有可无效的非蓝色科技");
      return false;
    }
    return openScanTargetPicker({
      type: "industry_remove_tech",
      title: flow.label || "赫利昂联合体",
      subtitle: "选择要无效的科技（不可选蓝色），随后增加 1 次收入",
      choices: removable.map((tileId) => ({
        nebulaId: tileId,
        label: tileId,
        description: "无效后不再具备效果，仍计入科技数量",
      })),
    });
  }

  function confirmIndustryHeliosRemoveTech(tileId) {
    const player = getCurrentPlayer();
    const beforePlayer = structuredClone(player);
    const beforeCardState = {
      publicCards: cardState.publicCards.slice(),
      discardPile: (cardState.discardPile || []).slice(),
    };
    const removeResult = tech.playerTech.removePlayerTile(player.techState, tileId);
    if (!removeResult.ok) {
      rocketState.statusNote = removeResult.message;
      renderStateReadout();
      return removeResult;
    }
    industry?.clearHeliosPassiveSlots?.(player);
    renderTechBoard();
    renderInitialSelectionArea();
    pendingState.industryAbility = { flowType: "helios_remove_tech", removedTileId: tileId };
    recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      "恢复赫利昂无效科技前玩家状态",
    ));
    const incomeStart = beginDiscardSelection(1, {
      type: "industry_helios_income",
      player,
      beforePlayer,
      beforeCardState,
      removedTileId: tileId,
    });
    if (!incomeStart.ok) {
      restoreObjectSnapshot(player, beforePlayer);
      renderTechBoard();
      renderInitialSelectionArea();
      pendingState.industryAbility = null;
      rollbackPendingIndustryQuickAction(incomeStart.message || "赫利昂联合体：收入无法结算，已撤回 1x 行动");
      return { ok: false, message: incomeStart.message || "赫利昂联合体：收入无法结算" };
    }
    rocketState.statusNote = incomeStart.ok
      ? `赫利昂联合体：已无效 ${tileId}，请选择 1 张手牌增加收入`
      : incomeStart.message;
    renderPlayerStats();
    renderStateReadout();
    return removeResult;
  }

  function startIndustryHuanyuMoveEffectFlow(flow, options = {}) {
    const groupId = `industry-huanyu-${turnState.roundNumber}-${turnState.turnNumber}`;
    const nodes = industry?.buildHuanyuFreeMoveEffectNodes?.({
      label: flow.label || "寰宇动力",
      count: flow.movesLeft ?? industry?.HUANYU_FREE_MOVE_COUNT ?? 2,
      groupId,
    }) || [];
    pendingState.industryAbility = null;
    pendingState.cardSelectionAction = null;
    uiRuntimeState.industryFreeMoveState = null;
    cards.setSelectionActive(cardState, false);
    syncCardSelectionChrome();

    if (!nodes.length) {
      rocketState.statusNote = "寰宇动力：没有可结算的移动效果";
      renderStateReadout();
      return false;
    }

    const preHistoryCommands = [];
    if (options.markerRestoreCommand) preHistoryCommands.push(options.markerRestoreCommand);
    const started = startCardEffectFlow(
      "industry-huanyu-free-moves",
      flow.label || "寰宇动力",
      nodes,
      {
        actionType: "industryHuanyu",
        historySource: HISTORY_SOURCE_QUICK,
        consumesMainAction: false,
        preHistoryCommands,
      },
    );
    if (started) {
      const movableCount = getMovableTokensForPlayer(getCurrentPlayer()?.id).length;
      rocketState.statusNote = movableCount
        ? (flow.message || "寰宇动力：请按效果栏依次结算 2 次移动")
        : "寰宇动力：当前没有可移动火箭，可跳过移动节点";
      renderRockets();
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
    }
    return started;
  }

  function beginIndustryHuanyuFreeMoves(flow) {
    const player = getCurrentPlayer();
    uiRuntimeState.industryFreeMoveState = {
      movesLeft: flow.movesLeft ?? 2,
      movedRocketIds: [],
      beforePlayer: structuredClone(player),
      label: flow.label || "寰宇动力",
    };
    player.industryHuanyuFreeMovesLeft = uiRuntimeState.industryFreeMoveState.movesLeft;
    player.industryHuanyuFreeMoveTurn = turnState.turnNumber;
    const rocketsForPlayer = getMovableTokensForPlayer(player.id);
    rocketState.statusNote = rocketsForPlayer.length
      ? `${flow.message}（剩余 ${uiRuntimeState.industryFreeMoveState.movesLeft} 次）`
      : `${flow.message}：当前没有可移动火箭`;
    syncInteractionFocusChrome();
    renderRockets();
    if (rocketsForPlayer.length === 1) {
      activateMoveMode(rocketsForPlayer[0].id);
    } else if (rocketsForPlayer.length > 1) {
      selectDefaultRocketForCurrentPlayer();
    } else {
      finishIndustryAbilityFlow(rocketState.statusNote);
      return false;
    }
    renderStateReadout();
    return true;
  }

  function executeIndustryFreeMove(deltaX, deltaY, rocketId, payment = {}) {
    const state = uiRuntimeState.industryFreeMoveState;
    if (!state) return { ok: false, message: "没有待结算的公司免费移动" };
    if (state.movedRocketIds.includes(rocketId)) {
      rocketState.statusNote = "该火箭本轮已免费移动过";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const moveCheck = rocketActions.canMoveRocket(rocketState, rocketId, deltaX, deltaY);
    if (!moveCheck.ok) {
      rocketState.statusNote = moveCheck.message;
      renderStateReadout();
      return moveCheck;
    }

    const currentPlayer = getCurrentPlayer();
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
        context: { type: "industry_free_move", terrainRequired },
        message: `${state.label}：已有 ${providedMovePoints} 点移动力，还需 ${terrainRequired - providedMovePoints} 点（可弃移动牌或用能量）`,
      });
    }

    const playerBeforeMove = structuredClone(getCurrentPlayer());
    const freeMoveStateBefore = {
      movesLeft: state.movesLeft,
      movedRocketIds: [...state.movedRocketIds],
      label: state.label,
    };
    const energyCost = Math.max(0, Math.round(Number(payment.energyCost) || 0));
    const result = abilities.executeAbility("moveProbe", createActionContext(), {
      cost: energyCost > 0 ? { energy: energyCost } : {},
      movementPoints: Math.max(terrainRequired, providedMovePoints + energyCost),
      rocketId,
      deltaX,
      deltaY,
      historyLabel: `${state.label}：免费移动`,
      source: "industry",
    });
    if (result.rocket) renderRocketElement(result.rocket);
    if (!result.ok) {
      if (payment.discardCommand) payment.discardCommand.undo();
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    state.movedRocketIds.push(rocketId);
    state.movesLeft -= 1;
    const player = getCurrentPlayer();
    player.industryHuanyuMovedRocketIds = [...state.movedRocketIds];
    player.industryHuanyuFreeMovesLeft = Math.max(0, state.movesLeft);
    recordQuickHistoryCommand({
      label: "恢复寰宇免费移动次数",
      undo() {
        if (!uiRuntimeState.industryFreeMoveState) {
          uiRuntimeState.industryFreeMoveState = {
            movesLeft: freeMoveStateBefore.movesLeft,
            movedRocketIds: [...freeMoveStateBefore.movedRocketIds],
            label: freeMoveStateBefore.label,
          };
          pendingState.industryAbility = {
            flowType: "huanyu_free_moves",
            label: freeMoveStateBefore.label,
          };
        } else {
          uiRuntimeState.industryFreeMoveState.movesLeft = freeMoveStateBefore.movesLeft;
          uiRuntimeState.industryFreeMoveState.movedRocketIds = [...freeMoveStateBefore.movedRocketIds];
          uiRuntimeState.industryFreeMoveState.label = freeMoveStateBefore.label;
        }
      },
    });
    if (payment.discardCommand) recordQuickHistoryCommand(payment.discardCommand);
    recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      playerBeforeMove,
      "恢复公司免费移动前玩家状态",
    ));
    recordAbilityCommands(result, quickActionHistory);

    if (state.movesLeft <= 0) {
      finishIndustryAbilityFlow(`${state.label}：免费移动已完成`);
      return result;
    }

    rocketState.statusNote = `${state.label}：还可免费移动 ${state.movesLeft} 枚火箭`;
    deactivateMoveMode();
    renderRockets();
    renderStateReadout();
    return result;
  }

  function canBeginIndustryFutureSpanHandSelection(player = getCurrentPlayer()) {
    if (!industry?.shouldShowFutureSpanPanel?.(player)) {
      return { ok: false, message: "当前玩家没有未来跨度研究所" };
    }
    const parkCheck = industry.canParkFutureSpanCard?.(player);
    if (!parkCheck?.ok) return { ok: false, message: parkCheck?.message || "未来跨度专属标记不可用" };
    if (isActionEffectFlowActive()
      || isCardSelectionActive()
      || isDiscardSelectionActive()
      || isPlayCardSelectionActive()
      || isTechTilePickingActive()
      || isHandScanSelectionActive()
      || isMovePaymentSelectionActive()
      || pendingState.industryAbility
      || uiRuntimeState.industryFreeMoveState
      || isIndustryHandSelectionActive()) {
      return { ok: false, message: "请先完成或取消当前流程" };
    }
    if (!hasFutureSpanEligibleHandCard(player)) {
      return { ok: false, message: "没有可用的信用点费用手牌" };
    }
    return { ok: true, message: "可以放置未来跨度专属标记" };
  }

  function beginIndustryFutureSpanHandSelection() {
    const player = getCurrentPlayer();
    const check = canBeginIndustryFutureSpanHandSelection(player);
    if (!check.ok) {
      rocketState.statusNote = check.message;
      renderStateReadout();
      return check;
    }
    pendingState.cardSelectionAction = {
      type: "industry_future_hand",
      player,
      allowBlindDraw: false,
    };
    rocketState.statusNote = "未来跨度研究所：选择一张费用为信用点的手牌，扣下并设置目标分";
    syncIndustryHandSelectionChrome();
    renderInitialSelectionArea();
    renderStateReadout();
    return { ok: true, message: rocketState.statusNote };
  }

  function handleIndustryFutureSpanHandClick(handIndex) {
    if (!isIndustryFutureSpanHandSelectionActive()) return;
    const player = getCurrentPlayer();
    const index = Math.round(handIndex);
    const card = player?.hand?.[index];
    if (!card || !isFutureSpanEligibleHandCard(card)) {
      rocketState.statusNote = "未来跨度只能选择费用为信用点的手牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const targetDelta = getFutureSpanDeltaForCard(card);
    const targetScore = Number(player.resources?.score || 0) + targetDelta;
    const beforePlayer = structuredClone(player);
    const removeResult = cards.discardFromHandAtIndex(player, index);
    if (!removeResult.ok) {
      rocketState.statusNote = removeResult.message;
      renderStateReadout();
      return removeResult;
    }
    const parkResult = industry.parkFutureSpanCard?.(player, removeResult.card, targetScore);
    if (!parkResult?.ok) {
      restoreObjectSnapshot(player, beforePlayer);
      rocketState.statusNote = parkResult?.message || "未来跨度专属标记放置失败";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    beginQuickActionStep("industry-future-span-token", "未来跨度研究所：放置专属标记");
    recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      "恢复未来跨度专属标记前玩家状态",
    ));
    completeQuickActionStep();

    pendingState.cardSelectionAction = null;
    cards.setSelectionActive(cardState, false);
    rocketState.statusNote = `未来跨度研究所：扣下 ${cards.getCardLabel(removeResult.card)}，目标 ${targetScore} 分`;
    syncIndustryHandSelectionChrome();
    renderPlayerStats();
    renderInitialSelectionArea();
    updateActionButtons();
    renderStateReadout();
    return {
      ok: true,
      card: removeResult.card,
      targetScore,
      message: rocketState.statusNote,
    };
  }

  function handleIndustryDeepspaceHandClick(handIndex) {
    if (!isIndustryHandSelectionActive()) return;
    const player = getCurrentPlayer();
    const index = Math.round(handIndex);
    const card = player?.hand?.[index];
    if (!card) {
      rocketState.statusNote = "无效的手牌位置";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    pendingState.cardSelectionAction = {
      type: "industry_deepspace_public",
      player,
      handIndex: index,
      handCard: card,
      allowBlindDraw: false,
    };
    cards.setSelectionActive(cardState, true);
    rocketState.statusNote = `深空探测：已选手牌 ${cards.getCardLabel(card)}，请选择 1 张公共牌交换`;
    syncCardSelectionChrome();
    renderPlayerHand();
    renderPublicCards();
    renderStateReadout();
    return { ok: true, message: rocketState.statusNote };
  }

  function finalizeIndustryDeepspaceSwap(publicSlotIndex) {
    const pending = pendingState.cardSelectionAction;
    const player = pending?.player || getCurrentPlayer();
    const handIndex = Number(pending?.handIndex);
    const slotIndex = Math.round(Number(publicSlotIndex));
    const publicCard = cardState.publicCards?.[slotIndex];
    const handCard = Number.isInteger(handIndex) ? player?.hand?.[handIndex] : pending?.handCard;
    if (!handCard || !publicCard) {
      rocketState.statusNote = "交换失败：卡牌无效";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const beforePlayer = structuredClone(player);
    const beforePublicCards = cardState.publicCards.slice();
    const beforeDiscard = (cardState.discardPile || []).slice();

    player.hand[handIndex] = publicCard;
    player.resources.handSize = player.hand.length;
    cardState.publicCards[slotIndex] = handCard;

    recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      "恢复深空探测交换前玩家状态",
    ));
    recordQuickHistoryCommand(historyCommands.createRestorePublicCardsCommand(
      cardState,
      beforePublicCards,
      beforeDiscard,
    ));

    pendingState.cardSelectionAction = null;
    cards.setSelectionActive(cardState, false);
    syncCardSelectionChrome();
    finishIndustryAbilityFlow(`深空探测：${cards.getCardLabel(handCard)} 与 ${cards.getCardLabel(publicCard)} 已交换`);
    renderPlayerHand();
    renderPublicCards();
    return { ok: true, message: rocketState.statusNote };
  }

  const ALIEN_LAB_MAIN_ACTION_PANEL = Object.freeze({
    launch: "blue",
    scan: "yellow",
    researchTech: "pink",
  });
  const ALIEN_LAB_PANEL_MAIN_ACTION = Object.freeze({
    blue: "launch",
    yellow: "scan",
    pink: "researchTech",
  });

  function handleAlienLabPanelClick(panelId) {
    const player = getCurrentPlayer();
    if (!player || !industry?.shouldShowAlienLabPanels?.(player)) {
      rocketState.statusNote = "当前玩家没有异星实验室";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (
      industry?.hasPermanentAlienLabPanels?.(player) !== true
      && industry?.isAlienLabPanelFaceUp?.(player, panelId) !== true
    ) {
      rocketState.statusNote = "异星实验室板块已翻面，无法触发";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    switch (ALIEN_LAB_PANEL_MAIN_ACTION[panelId]) {
      case "launch":
        return launchRocketForCurrentPlayer();
      case "scan":
        return beginScanAction();
      case "researchTech":
        return researchTechForCurrentPlayer();
      default:
        rocketState.statusNote = `未知异星实验室板块：${panelId || "无"}`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
    }
  }

  function createAlienLabRestoreCommand(player, snapshot, label) {
    return {
      label: label || "恢复异星实验室板块",
      undo() {
        industry?.restoreAlienLabPanelSnapshot?.(player, snapshot);
      },
    };
  }

  function maybeConsumeAlienLabPanelForMainAction(actionId, result, player = getCurrentPlayer()) {
    const panelId = ALIEN_LAB_MAIN_ACTION_PANEL[actionId];
    if (!result?.ok || !player || !panelId) return result;
    if (!industry?.shouldShowAlienLabPanels?.(player)) return result;
    if (industry?.hasPermanentAlienLabPanels?.(player)) return result;
    if (industry?.isAlienLabPanelFaceUp?.(player, panelId) !== true) return result;

    const beforePanels = industry.createAlienLabPanelSnapshot?.(player);
    const consumeResult = industry.consumeAlienLabPanel?.(player, panelId);
    if (!consumeResult?.changed) return result;

    result.commands = [
      createAlienLabRestoreCommand(player, beforePanels, "恢复异星实验室板块状态"),
      ...(result.commands || []),
    ];
    result.message = `${result.message}；${consumeResult.message}`;
    result.payload = {
      ...(result.payload || {}),
      alienLabPanel: panelId,
    };
    renderInitialSelectionArea();
    return result;
  }

  function maybeRestoreAlienLabPanelForTrace(player, traceType) {
    if (!player || !industry?.shouldShowAlienLabPanels?.(player)) return null;
    const restoreResult = industry.restoreAlienLabPanelForTrace?.(player, traceType);
    if (restoreResult?.changed) {
      renderInitialSelectionArea();
    }
    return restoreResult;
  }

  function maybeApplyIndustryLaunchScan(result) {
    const player = getCurrentPlayer();
    if (!result?.ok || !industry?.shouldScanEarthOnLaunch?.(player)) return result;
    const earth = getEarthSectorCoordinate();
    const scanResult = abilities.executeAbility("scanSector", createActionContext(), {
      sectorX: earth.x,
      skipCost: true,
      source: "industry",
      historyLabel: "哨兵探测网络：发射扫描地球扇区",
    });
    if (scanResult.ok) {
      result.commands = [...(result.commands || []), ...(scanResult.commands || [])];
      result.events = [...(result.events || []), ...(scanResult.events || [])];
      result.payload = {
        ...(result.payload || {}),
        industryLaunchScan: scanResult.payload || null,
      };
      result.message = `${result.message}；${scanResult.message}`;
      renderSectors();
    }
    return result;
  }

  function startLaunchSectorFinishEffectFlow(result) {
    if (!result?.ok || !resultHasSignalMarkedEvent(result)) return false;

    const followups = buildReadySectorFinishEffects({
      nebulaIds: getMarkedNebulaIdsFromEvents(result.events),
    });
    if (!followups.length) return false;

    const currentPlayer = getCurrentPlayer();
    startPendingActionSession("launch", "发射行动");
    recordAbilityCommands(result);
    endEffectHistoryStep({
      result: {
        ok: true,
        undoable: result.undoable,
        irreversible: result.irreversible || null,
        message: result.message || "发射行动",
      },
    });

    pendingState.actionEffectFlow = abilities.chain.startAbilityChain(
      "launch-sector-finish",
      "发射后扇区结算",
      followups,
    );
    pendingState.actionEffectFlow.actionType = "launch";
    pendingState.actionEffectFlow.playerId = currentPlayer?.id || null;
    assignEffectFlowOwner(pendingState.actionEffectFlow, pendingState.actionEffectFlow.playerId);
    pendingState.actionEffectFlow.historySource = HISTORY_SOURCE_MAIN;
    pendingState.actionEffectFlow.consumesMainAction = true;

    els.appWrap?.classList.toggle("action-effect-flow-active", true);
    rocketState.statusNote = "发射完成：请处理哨兵扫描触发的扇区结算";
    activateNextActionEffect();
    return true;
  }

  function appendIndustryPlayPassiveStatus(result) {
    const messages = (result?.messages || []).filter(Boolean);
    if (!messages.length) return;
    rocketState.statusNote = [rocketState.statusNote, ...messages].filter(Boolean).join("；");
    renderStateReadout();
  }

  function getStrategyPassiveRewardIcon(slotId) {
    const reward = industry?.getStrategySlotReward?.(slotId);
    if (reward?.data) return "data";
    if (reward?.publicity) return "publicity";
    if (reward?.credits) return "credits";
    return "pick_card";
  }

  function snapshotStrategyPlayedCard(card) {
    if (!card) return null;
    return {
      id: card.id,
      src: card.src,
      cardName: card.cardName,
      label: card.label,
      cardId: card.cardId,
      scanActionCode: card.scanActionCode,
    };
  }

  function buildStrategyPlayPassiveEffectNodes(player, playedCard) {
    if (!industry?.isStrategyPlayInteractionActive?.(player, turnState.roundNumber)) return [];
    const eligibleSlotIds = industry.getStrategyPlayEligibleSlotIds?.(player, turnState.roundNumber) || [];
    if (!eligibleSlotIds.length) return [];
    const scanCode = industry.getStrategyPlayScanCode?.(player);
    const needsSlotChoice = Number(scanCode) === 3 && eligibleSlotIds.length > 1;
    const slotId = needsSlotChoice
      ? null
      : (industry.getAutomaticStrategyPlaySlotId?.(player, turnState.roundNumber) || eligibleSlotIds[0]);
    const slotLabel = slotId
      ? (industry.getStrategyPassiveSlotLabel?.(slotId) || slotId)
      : "选择";
    const rewardLabel = slotId ? (industry.getStrategySlotRewardLabel?.(slotId) || "") : "";
    return [{
      id: `industry-strategy-passive-${playedCard?.id || playedCard?.cardId || "choice"}-${slotId || "choice"}`,
      type: "industry_strategy_passive_reward",
      label: `宇宙战略集团：${slotLabel}奖励槽`,
      icon: slotId ? getStrategyPassiveRewardIcon(slotId) : "black_scan",
      status: "pending",
      undoable: true,
      options: {
        slotId,
        eligibleSlotIds,
        needsSlotChoice,
        rewardLabel,
        playedCard: snapshotStrategyPlayedCard(playedCard),
      },
    }];
  }

  function buildIndustryPlayCardAppendEffects(player, playedCard) {
    const sentinelEffects = industry?.buildSentinelPlayCornerEffectNodes?.(
      cards,
      player,
      turnState.roundNumber,
      turnState.turnNumber,
      playedCard,
    ) || [];
    const strategyEffects = buildStrategyPlayPassiveEffectNodes(player, playedCard);
    return {
      immediateEffects: sentinelEffects,
      deferredEndEffects: strategyEffects,
    };
  }

  function buildPlayCardEffectFlowQueue(player, playedCard, playEffects) {
    const industryAppendEffects = buildIndustryPlayCardAppendEffects(player, playedCard);
    const immediateEffects = [
      ...(playEffects || []),
      ...(industryAppendEffects.immediateEffects || []),
    ];
    const deferredEndEffects = industryAppendEffects.deferredEndEffects || [];
    return {
      effects: immediateEffects.length ? immediateEffects : deferredEndEffects,
      deferredEndEffects: immediateEffects.length ? deferredEndEffects : [],
    };
  }

  function applyIndustryPlayCardPassives(playedCard, typeCode) {
    const player = getCurrentPlayer();
    const result = { publicityGained: 0, messages: [] };
    if (!player || !playedCard) return result;
    player.industryPlayedCardThisRound = true;
    player.industryLastPlayedCardThisRound = {
      id: playedCard.id,
      src: playedCard.src,
      cardId: playedCard.cardId,
      discardActionCode: playedCard.discardActionCode,
      incomeActionCode: playedCard.incomeActionCode,
      scanActionCode: playedCard.scanActionCode,
    };
    player.industryPlayedCardRound = turnState.roundNumber;
    player.industryPlayedCardTurn = turnState.turnNumber;
    if (industry?.shouldGainPublicityOnType12Play?.(player) && [1, 2].includes(typeCode)) {
      const beforePublicity = Number(player.resources?.publicity) || 0;
      const publicityGain = industry.getMissionPlayPublicityGain();
      players.gainResources(player, { publicity: publicityGain });
      result.publicityGained = Math.max(0, (Number(player.resources?.publicity) || 0) - beforePublicity);
      result.messages.push(
        result.publicityGained > 0
          ? `任务中继站：打出${typeCode}型任务牌，宣传+${result.publicityGained}`
          : `任务中继站：打出${typeCode}型任务牌，宣传已达上限`,
      );
    }
    const strategyActivation = industry?.activateStrategyPlayInteraction?.(
      player,
      playedCard,
      turnState.roundNumber,
    );
    if (strategyActivation?.ok) {
      if (strategyActivation.eligibleSlotIds?.length) {
        result.messages.push("宇宙战略集团：被动奖励已加入效果队列");
      } else if (strategyActivation.message) {
        result.messages.push(strategyActivation.message);
      }
    }
    return result;
  }

  function isIndustryIrreversibleFlow(flowType) {
    return flowType === "mission_publicity_pick"
      || flowType === "fenwick_publicity_pick"
      || flowType === "future_span_pick"
      || flowType === "strategy_pick";
  }

  function completeIndustryAbilityQuickStep(detail = null) {
    if (quickActionHistory.hasUndoableStep()) {
      completeQuickActionStep(detail);
    }
  }

  function commitIrreversibleIndustryQuickAction(label, message, options = {}) {
    const completeOptions = {
      undoable: false,
      irreversibleCode: options.irreversibleCode || "hidden_card_reveal",
      irreversibleReason: options.irreversibleReason || "公共牌补牌翻出新牌",
    };
    const step = quickActionHistory.hasSession()
      ? completeQuickActionStep(message || null, completeOptions)
      : null;
    if (!step) {
      appendActionLogStep(HISTORY_SOURCE_QUICK, label || "公司 1x 行动", message || null, completeOptions);
    }
    clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
    if (quickActionHistory.hasSession()) {
      quickActionHistory.commitSession();
    }
  }

  function appendSentinelPlayCornerEffectsToFlow(nodes) {
    if (!pendingState.actionEffectFlow || !nodes?.length) return false;
    if (pendingState.actionEffectFlow.effects.some((effect) => effect.type === "industry_sentinel_corner")) {
      return false;
    }
    pendingState.actionEffectFlow.effects.push(...nodes.map((node) => ({
      ...node,
      status: "pending",
    })));
    pendingState.actionEffectFlow.completed = false;
    const hasActiveEffect = pendingState.actionEffectFlow.effects.some((effect) => effect.status === "active");
    if (!hasActiveEffect) {
      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      activateNextActionEffect();
    }
    return true;
  }

  function tryInjectSentinelPlayCornerEffectAfterArm() {
    const player = getCurrentPlayer();
    const playedCardInCurrentTurn = player?.industryPlayedCardThisRound
      && player?.industryPlayedCardRound === turnState.roundNumber
      && player?.industryPlayedCardTurn === turnState.turnNumber;
    if (!playedCardInCurrentTurn) return false;
    const playedCard = player?.industryLastPlayedCardThisRound;
    if (!playedCard) return false;

    const nodes = industry?.buildSentinelPlayCornerEffectNodes?.(
      cards,
      player,
      turnState.roundNumber,
      turnState.turnNumber,
      playedCard,
    ) || [];
    if (!nodes.length) return false;

    if (isActionEffectFlowActive() && pendingState.actionEffectFlow.actionType === "playCard") {
      return appendSentinelPlayCornerEffectsToFlow(nodes);
    }

    if (!pendingState.actionExecuted) return false;

    return startCardEffectFlow(
      "industry-sentinel-corner",
      "哨兵探测网络",
      nodes,
      { actionType: "playCard", industryPlayedCard: playedCard },
    );
  }

  function createIndustryCardCornerEvent(player, reward, source) {
    return {
      type: "cardCorner",
      ...createCardCornerTriggerEventFields(
        reward?.kind === "resource" ? reward : null,
        reward?.kind === "move" ? reward : null,
        { cornerCode: reward?.code ?? null },
      ),
      playerId: player?.id || null,
      playerColor: player?.color || null,
      source,
    };
  }

  function executeIndustryStratusCornerEffect(effect) {
    const currentPlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
    const card = effect.options?.card;
    const effectCards = Array.isArray(effect.options?.cards) && effect.options.cards.length
      ? effect.options.cards
      : (card ? [card] : []);
    const rewardSnapshot = effect.options?.reward || null;
    if (!currentPlayer || (!card && !rewardSnapshot)) {
      rocketState.statusNote = "层云核心：无效公共牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const reward = rewardSnapshot
      ? { ...rewardSnapshot, gain: { ...(rewardSnapshot.gain || {}) } }
      : industry.getCornerReward(cards, card);
    beginEffectHistoryStep(effect.label);
    if (!reward) {
      effect.result = {
        ok: true,
        undoable: true,
        message: `${effect.label}：没有弃牌角标奖励`,
      };
      rocketState.statusNote = effect.result.message;
      completeCurrentActionEffect("skipped");
      renderStateReadout();
      return effect.result;
    }

    const beforePlayer = structuredClone(currentPlayer);
    const applied = industry.applyCornerReward(players, data, currentPlayer, reward);
    if (!applied.ok) {
      endEffectHistoryStep();
      rocketState.statusNote = applied.message;
      renderStateReadout();
      return applied;
    }
    addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, reward.gain);

    if (reward.kind === "move") {
      insertActionEffectsAfterCurrent([{
        id: `${effect.id || "stratus-corner"}-move`,
        type: cardEffects.EFFECT_TYPES.CARD_MOVE,
        label: `${effect.label}：${reward.label}`,
        icon: "movement",
        options: {
          movementPoints: reward.movementPoints || 1,
          historyLabel: reward.label,
        },
      }]);
    }

    recordHistoryCommand(historyCommands.createRestorePlayerCommand(
      currentPlayer,
      beforePlayer,
      "恢复层云核心角标结算前玩家状态",
    ));

    const rewardText = reward.kind === "resource"
      ? formatCardCornerRewardMessage(reward, applied.results || [])
      : [formatPlanetRewardGain(reward.gain || {}), `${reward.movementPoints || 1}移动`]
        .filter(Boolean)
        .join("、");

    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: true,
      message: `${effect.label}：${rewardText}`,
      events: [createIndustryCardCornerEvent(currentPlayer, reward, "industry_stratus")],
      payload: { card, cards: effectCards, reward, dataResults: applied.results || [] },
    });
  }

  function executeIndustrySentinelCornerEffect(effect) {
    const currentPlayer = getCurrentPlayer();
    const playedCard = effect.options?.playedCard;
    if (!currentPlayer || !playedCard) {
      rocketState.statusNote = "哨兵探测网络：无效卡牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (industry?.isAlienCard?.(playedCard)) {
      effect.result = { ok: false, undoable: true, message: "外星人卡牌不能触发哨兵弃牌角标" };
      completeCurrentActionEffect("skipped");
      renderStateReadout();
      return effect.result;
    }

    const reward = industry.getCornerReward(cards, playedCard);
    if (!reward) {
      effect.result = { ok: false, undoable: true, message: "该牌没有弃牌角标奖励" };
      completeCurrentActionEffect("skipped");
      renderStateReadout();
      return effect.result;
    }

    const beforePlayer = structuredClone(currentPlayer);
    beginEffectHistoryStep(effect.label);
    const dataResults = [];
    if (reward.kind === "resource") {
      if (reward.gain && Object.keys(reward.gain).length) {
        players.gainResources(currentPlayer, reward.gain);
        addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, reward.gain);
      }
      const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
      for (let index = 0; index < dataCount; index += 1) {
        const gainResult = data.gainData(currentPlayer, { source: "industry_sentinel" });
        dataResults.push(gainResult);
        recordHistoryCommand(historyCommands.createGainDataCommand(currentPlayer, gainResult));
      }
    } else if (reward.kind === "move" && reward.gain && Object.keys(reward.gain).length) {
      players.gainResources(currentPlayer, reward.gain);
      addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, reward.gain);
    }

    if (reward.kind === "move") {
      insertActionEffectsAfterCurrent([{
        id: `${effect.id || "sentinel-corner"}-move`,
        type: cardEffects.EFFECT_TYPES.CARD_MOVE,
        label: `${cards.getCardLabel(playedCard)}：${reward.label}`,
        icon: "movement",
        options: {
          movementPoints: reward.movementPoints || 1,
          historyLabel: reward.label,
        },
      }]);
    }

    recordHistoryCommand(historyCommands.createRestorePlayerCommand(
      currentPlayer,
      beforePlayer,
      "恢复哨兵弃牌角标结算前玩家状态",
    ));

    const rewardText = reward.kind === "resource"
      ? formatCardCornerRewardMessage(reward, dataResults)
      : `${formatPlanetRewardGain(reward.gain || {})}${reward.gain?.score ? "，" : ""}${reward.label}`;

    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: true,
      message: `${effect.label}：${rewardText}`,
      payload: { playedCard, reward, dataResults },
    });
  }

  function createCompanyCardSummary(companyCard, player) {
    const wrap = document.createElement("div");
    wrap.className = "company-card-summary";
    wrap.append(createInitialSelectionImage(companyCard, "summary"));
    attachCardHoverPreview(wrap, companyCard?.src, companyCard?.label || "公司牌");

    const layout = industry?.getIndustryActionMarkerLayout?.(companyCard);
    if (layout && player) {
      const companyLabel = companyCard.label || "公司牌";
      const marked = industry?.isIndustryActionMarkedThisRound?.(
        player,
        turnState.roundNumber,
        turnState.turnNumber,
      );
      const markerCheck = !marked && !isInitialIncomeFlowActive()
        ? industry?.canMarkIndustryAction?.(player, turnState.roundNumber, {
          turnNumber: turnState.turnNumber,
          hasMarker: true,
          industryCard: companyCard,
        })
        : {
          ok: false,
          message: marked ? "本轮已使用过公司 1x 行动标记" : "请先完成初始收入增加",
        };
      const canMark = Boolean(markerCheck?.ok);
      const abilityPreview = canMark
        ? industry?.buildActiveAbilityFlow?.(
          player,
          companyLabel,
          turnState.roundNumber,
          turnState.turnNumber,
        )
        : null;
      const canUseAction = canMark && Boolean(abilityPreview?.ok);

      if (!marked && canUseAction) {
        wrap.classList.add("is-action-marker-pending");
      }

      if (marked) {
        const usedHitArea = document.createElement("button");
        usedHitArea.type = "button";
        usedHitArea.className = "company-action-marker-hit company-action-marker-hit--used";
        if (companyLabel === "未来跨度研究所") {
          usedHitArea.classList.add("company-action-marker-hit--future-span");
        }
        usedHitArea.dataset.companyLabel = companyCard.label || "";
        usedHitArea.setAttribute("aria-label", `公司 1x 行动标记已使用：${companyLabel}`);
        usedHitArea.title = "本轮已使用过公司 1x 行动标记";
        usedHitArea.style.left = `${layout.percentX}%`;
        usedHitArea.style.top = `${layout.percentY}%`;
        usedHitArea.style.setProperty("--company-action-radius", `${layout.radiusPercent}%`);
        usedHitArea.addEventListener("click", () => {
          rocketState.statusNote = "本轮已使用过公司 1x 行动标记";
          renderStateReadout();
        });

        const token = document.createElement("img");
        token.className = "company-action-marker-token";
        token.src = getNormalTokenAssetForPlayer(player);
        token.alt = "";
        token.decoding = "async";
        token.setAttribute("aria-hidden", "true");
        token.style.left = `${layout.percentX}%`;
        token.style.top = `${layout.percentY}%`;
        token.style.setProperty("--company-action-radius", `${layout.radiusPercent}%`);
        wrap.append(usedHitArea);
        wrap.append(token);
      } else {
        const hitArea = document.createElement("button");
        hitArea.type = "button";
        hitArea.className = "company-action-marker-hit";
        if (companyLabel === "未来跨度研究所") {
          hitArea.classList.add("company-action-marker-hit--future-span");
        }
        hitArea.dataset.companyLabel = companyCard.label || "";
        hitArea.disabled = isInitialIncomeFlowActive();
        const disabledReason = markerCheck?.message
          || abilityPreview?.message
          || "公司 1x 行动标记不可用";
        hitArea.setAttribute(
          "aria-label",
          canUseAction
            ? `放置公司 1x 行动标记：${companyCard.label || "公司牌"}`
            : `公司 1x 行动标记不可用：${companyCard.label || "公司牌"}，${disabledReason}`,
        );
        hitArea.title = canUseAction
          ? "点击在 1x 区域放置行动标记（每轮一次，可撤销）"
          : disabledReason;
        hitArea.style.left = `${layout.percentX}%`;
        hitArea.style.top = `${layout.percentY}%`;
        hitArea.style.setProperty("--company-action-radius", `${layout.radiusPercent}%`);
        if (!isInitialIncomeFlowActive()) {
          hitArea.addEventListener("click", () => {
            handleCompanyActionMarkerClick(companyCard);
          });
        }
        wrap.append(hitArea);
      }
    }

    if (player && industry?.shouldShowStrategyPassiveMarkers?.(player)) {
      industry.mountStrategyPassiveLayer(wrap, player, {
        getPlayerTokenAsset: getNormalTokenAssetForPlayer,
      });
    }

    if (player && industry?.shouldShowHeliosPassiveMarkers?.(player)) {
      industry.mountHeliosPassiveLayer(wrap, player, {
        getPlayerTokenAsset: getNormalTokenAssetForPlayer,
      });
    }

    if (player && companyCard?.label === "图灵系统") {
      industry.mountTuringBorrowLayer?.(wrap, player, {
        turnState,
        roundNumber: turnState.roundNumber,
        turnNumber: turnState.turnNumber,
      });
    }

    if (player && industry?.shouldShowAlienLabPanels?.(player)) {
      industry.mountAlienLabLayer(wrap, player, {
        onPanelClick: handleAlienLabPanelClick,
      });
    }

    if (player && industry?.shouldShowFutureSpanPanel?.(player)) {
      const futureCheck = canBeginIndustryFutureSpanHandSelection(player);
      industry.mountFutureSpanLayer(wrap, player, {
        tokenEnabled: futureCheck.ok,
        tokenTitle: futureCheck.ok ? "点击扣下一张手牌并设置目标分" : futureCheck.message,
        cardSelectable: isPlayCardSelectionActive() || canStartMainAction(),
        cardSelected: getPendingPlayCardSelection()?.source === "future_span",
        onTokenClick: () => beginIndustryFutureSpanHandSelection(),
        onCardClick: () => handleFutureSpanPlayCardSelect(),
      });
    }

    return wrap;
  }

  function executeIndustryHeliosPassiveRewardEffect(effect) {
    const player = getCurrentPlayer();
    const slotId = effect.options?.slotId;
    if (!player || !slotId) {
      rocketState.statusNote = "赫利昂联合体：无效奖励";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const check = industry?.canPlaceHeliosPassiveSlot?.(player, slotId);
    if (!check?.ok) {
      effect.result = { ok: false, undoable: true, message: check?.message || "无法领取奖励" };
      completeCurrentActionEffect("skipped");
      renderStateReadout();
      return effect.result;
    }

    const slotLabel = industry.getHeliosPassiveSlotLabel?.(slotId) || slotId;
    const reward = industry.getHeliosSlotReward?.(slotId);
    const rewardLabel = industry.getHeliosSlotRewardLabel?.(slotId) || "";
    const beforePlayer = structuredClone(player);

    beginEffectHistoryStep(effect.label);
    const placeResult = industry.placeHeliosPassiveSlot(player, slotId);
    if (!placeResult?.ok) {
      endEffectHistoryStep();
      rocketState.statusNote = placeResult?.message || "无法放置标记";
      renderStateReadout();
      return placeResult;
    }

    const dataResults = [];
    if (reward?.energy || reward?.additionalPublicScan) {
      players.gainResources(player, {
        energy: reward.energy || 0,
        additionalPublicScan: reward.additionalPublicScan || 0,
      });
    }
    if (reward?.data) {
      const gainResult = data.gainData(player, { source: "industry_helios_passive" });
      dataResults.push(gainResult);
      recordHistoryCommand(historyCommands.createGainDataCommand(player, gainResult));
    }

    recordHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      `撤销赫利昂联合体：${slotLabel}奖励`,
    ));

    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: true,
      message: `${effect.label}：+${rewardLabel}`,
      payload: { slotId, reward, dataResults },
    }, [renderInitialSelectionArea]);
  }

  function setStrategyPassiveRewardSlot(effect, slotId) {
    if (!effect || !slotId) return effect;
    const slotLabel = industry.getStrategyPassiveSlotLabel?.(slotId) || slotId;
    effect.options = {
      ...(effect.options || {}),
      slotId,
      needsSlotChoice: false,
      rewardLabel: industry.getStrategySlotRewardLabel?.(slotId) || "",
    };
    effect.label = `宇宙战略集团：${slotLabel}奖励槽`;
    effect.icon = getStrategyPassiveRewardIcon(slotId);
    return effect;
  }

  function getStrategyPassiveSelectableSlotIds(effect, player) {
    const listedSlotIds = Array.isArray(effect?.options?.eligibleSlotIds)
      ? effect.options.eligibleSlotIds
      : [];
    const currentSlotIds = industry?.getStrategyPlayEligibleSlotIds?.(player, turnState.roundNumber) || [];
    const currentSet = new Set(currentSlotIds);
    const candidateSlotIds = listedSlotIds.length ? listedSlotIds : currentSlotIds;
    return candidateSlotIds.filter((slotId, index, list) => (
      slotId
      && list.indexOf(slotId) === index
      && currentSet.has(slotId)
      && industry?.canInteractStrategyPlaySlot?.(player, slotId, turnState.roundNumber)?.ok
    ));
  }

  function closeStrategyPassiveSlotChoicePicker() {
    pendingState.strategyPassiveSlotChoice = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    renderActionEffectBar();
    updateActionButtons();
    renderStateReadout();
  }

  function cancelStrategyPassiveSlotChoice() {
    if (!pendingState.strategyPassiveSlotChoice) return;
    pendingState.strategyPassiveSlotChoice = null;
    if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    rocketState.statusNote = "宇宙战略集团：已取消奖励槽选择，可重新点击效果或跳过";
    renderActionEffectBar();
    updateActionButtons();
    renderStateReadout();
  }

  function openStrategyPassiveSlotChoice(effect, player, slotIds) {
    if (!els.scanTargetOverlay || !els.scanTargetActions) {
      rocketState.statusNote = "宇宙战略集团：无法打开奖励槽选择";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    pendingState.strategyPassiveSlotChoice = {
      effectId: effect.id,
      slotIds: [...slotIds],
    };
    if (els.scanTargetTitle) els.scanTargetTitle.textContent = "宇宙战略集团";
    if (els.scanTargetSubtitle) {
      els.scanTargetSubtitle.textContent = "黑色扫描角标可选择一个空奖励槽触发。";
    }
    if (els.scanTargetCancel) els.scanTargetCancel.hidden = false;
    els.scanTargetActions.replaceChildren(...slotIds.map((slotId) => {
      const slotLabel = industry.getStrategyPassiveSlotLabel?.(slotId) || slotId;
      const rewardLabel = industry.getStrategySlotRewardLabel?.(slotId) || "";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scan-target-option-button";
      button.dataset.strategySlotChoice = slotId;
      button.innerHTML = `${slotLabel}奖励槽<small>${rewardLabel}</small>`;
      return button;
    }));
    els.scanTargetOverlay.hidden = false;
    rocketState.statusNote = "宇宙战略集团：请选择奖励槽";
    renderActionEffectBar();
    updateActionButtons();
    renderStateReadout();
    return { ok: true, pendingChoice: true, undoable: true, message: rocketState.statusNote };
  }

  function confirmStrategyPassiveSlotChoice(slotId) {
    const pending = pendingState.strategyPassiveSlotChoice;
    const effect = getCurrentActionEffect();
    if (!pending || !effect || effect.id !== pending.effectId || effect.type !== "industry_strategy_passive_reward") {
      cancelStrategyPassiveSlotChoice();
      return { ok: false, message: "没有待选择的宇宙战略集团奖励槽" };
    }
    if (!pending.slotIds.includes(slotId)) {
      rocketState.statusNote = "宇宙战略集团：该奖励槽不可选";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    closeStrategyPassiveSlotChoicePicker();
    setStrategyPassiveRewardSlot(effect, slotId);
    return executeIndustryStrategyPassiveRewardEffect(effect);
  }

  function finishIndustryStrategyPassiveRewardEffect(effect, options = {}) {
    const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
    const slotId = effect.options?.slotId;
    if (!player || !slotId) {
      rocketState.statusNote = "宇宙战略集团：无效奖励槽";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const check = industry?.canInteractStrategyPlaySlot?.(player, slotId, turnState.roundNumber);
    if (!check?.ok) {
      industry?.clearStrategyPlayInteraction?.(player);
      effect.result = { ok: false, undoable: true, message: check?.message || "无法领取奖励" };
      completeCurrentActionEffect("skipped");
      renderInitialSelectionArea();
      renderStateReadout();
      return effect.result;
    }

    const slotLabel = industry.getStrategyPassiveSlotLabel?.(slotId) || slotId;
    const reward = industry.getStrategySlotReward?.(slotId);
    const rewardLabel = industry.getStrategySlotRewardLabel?.(slotId) || "";
    const beforePlayer = options.beforePlayerState || structuredClone(player);

    if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(effect.label);
    if (!options.restoreRecorded) {
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        `撤销宇宙战略集团：${slotLabel}奖励槽`,
      ));
    }

    const placeResult = industry.placeStrategyPassiveSlot(player, slotId);
    if (!placeResult?.ok) {
      endEffectHistoryStep();
      rocketState.statusNote = placeResult?.message || "无法放置被动标记";
      renderStateReadout();
      return placeResult;
    }

    industry.completeStrategyPlayInteraction(player);
    const dataResults = [];
    if (reward?.credits || reward?.publicity) {
      players.gainResources(player, {
        credits: reward.credits || 0,
        publicity: reward.publicity || 0,
      });
    }
    if (reward?.data && !options.skipDataGain) {
      const gainResult = data.gainData(player, { source: "industry_strategy_passive" });
      dataResults.push(gainResult);
      if (!options.restoreRecorded) {
        recordHistoryCommand(historyCommands.createGainDataCommand(player, gainResult));
      }
    }

    const skippedText = reward?.data && options.skipDataGain ? "（数据池已满，未获得数据）" : "";
    const placementText = options.placementMessages?.length
      ? `；${options.placementMessages.join("；")}`
      : "";
    return finishAutomaticRewardEffect(effect, {
      ok: true,
      undoable: true,
      message: `${effect.label}：+${rewardLabel}${skippedText}${placementText}`,
      payload: { slotId, reward, dataResults, skippedDataGain: Boolean(options.skipDataGain) },
    }, [renderInitialSelectionArea]);
  }

  function executeIndustryStrategyPassiveRewardEffect(effect) {
    const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
    let slotId = effect.options?.slotId;
    if (!slotId) {
      const slotIds = getStrategyPassiveSelectableSlotIds(effect, player);
      if (slotIds.length > 1) {
        return openStrategyPassiveSlotChoice(effect, player, slotIds);
      }
      if (slotIds.length === 1) {
        slotId = slotIds[0];
        setStrategyPassiveRewardSlot(effect, slotId);
      }
    }
    const reward = industry?.getStrategySlotReward?.(slotId);
    if (reward?.data && isDataPoolFull(player)) {
      const placeCheck = getAutoDataPlacementCheck(player);
      if (placeCheck.ok) {
        return openAutoDataPlacementPrompt(effect, player, {
          statusNote: "宇宙战略集团：数据池已满，请先放置数据或跳过这次数据获得",
          skipDescription: "仍放置宇宙战略集团 token，但不获得这 1 个数据",
          onAfterPlacement: ({ messages, restoreRecorded, beforePlayerState }) => finishIndustryStrategyPassiveRewardEffect(
            effect,
            { placementMessages: messages, restoreRecorded, beforePlayerState },
          ),
          onSkip: ({ beforePlayerState }) => finishIndustryStrategyPassiveRewardEffect(
            effect,
            { skipDataGain: true, beforePlayerState },
          ),
        });
      }
      return finishIndustryStrategyPassiveRewardEffect(effect, { skipDataGain: true });
    }
    return finishIndustryStrategyPassiveRewardEffect(effect);
  }

  function handleStrategyPassiveSlotClick(slotId) {
    if (getGameplayLockReason()) return;

    const player = getCurrentPlayer();
    const check = industry?.canInteractStrategyPlaySlot?.(player, slotId, turnState.roundNumber);
    if (!check?.ok) {
      rocketState.statusNote = check?.message || "无法放置被动标记";
      renderStateReadout();
      return;
    }

    const slotLabel = industry.getStrategyPassiveSlotLabel?.(slotId) || slotId;
    const reward = industry.getStrategySlotReward?.(slotId);
    const rewardLabel = industry.getStrategySlotRewardLabel?.(slotId) || "";
    const beforePlayer = structuredClone(player);

    beginQuickActionStep("strategy-passive-mark", `宇宙战略集团：${slotLabel}奖励槽`);
    const placeResult = industry.placeStrategyPassiveSlot(player, slotId);
    if (!placeResult?.ok) {
      quickActionHistory.undoLastStep();
      if (!quickActionHistory.hasUndoableStep()) {
        quickActionHistory.commitSession();
        clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
      }
      rocketState.statusNote = placeResult?.message || "无法放置被动标记";
      renderStateReadout();
      return;
    }

    industry.completeStrategyPlayInteraction(player);
    const dataResults = [];
    if (reward?.credits || reward?.publicity) {
      players.gainResources(player, {
        credits: reward.credits || 0,
        publicity: reward.publicity || 0,
      });
    }
    if (reward?.data) {
      const gainResult = data.gainData(player, { source: "industry_strategy_passive" });
      dataResults.push(gainResult);
    }

    recordQuickHistoryCommand(historyCommands.createRestorePlayerCommand(
      player,
      beforePlayer,
      `撤销宇宙战略集团：${slotLabel}奖励槽`,
    ));
    for (const gainResult of dataResults) {
      if (gainResult?.ok) {
        recordQuickHistoryCommand(historyCommands.createGainDataCommand(player, gainResult));
      }
    }
    completeQuickActionStep();

    rocketState.statusNote = `宇宙战略集团：${slotLabel}奖励槽 +${rewardLabel}`;
    renderInitialSelectionArea();
    renderPlayerStats();
    renderStateReadout();
  }

  function handleCompanyActionMarkerClick(companyCard) {
    const gameplayLockReason = getGameplayLockReason();
    if (gameplayLockReason) {
      rocketState.statusNote = gameplayLockReason;
      renderStateReadout();
      return { ok: false, message: gameplayLockReason };
    }

    const player = getCurrentPlayer();
    const layout = industry?.getIndustryActionMarkerLayout?.(companyCard);
    const check = industry?.canMarkIndustryAction?.(player, turnState.roundNumber, {
      turnNumber: turnState.turnNumber,
      hasMarker: Boolean(layout),
      industryCard: companyCard,
    });
    if (!check?.ok) {
      rocketState.statusNote = check?.message || "无法放置公司行动标记";
      renderStateReadout();
      return;
    }

    const companyLabel = companyCard.label || "公司牌";
    const beforeIndustryPlayer = structuredClone(player);
    const abilityFlow = industry.buildActiveAbilityFlow(
      player,
      companyLabel,
      turnState.roundNumber,
      turnState.turnNumber,
    );
    if (!abilityFlow?.ok) {
      restoreObjectSnapshot(player, beforeIndustryPlayer);
      if (abilityFlow?.message && industry.hasImplementedActiveAbility?.(companyCard)) {
        rocketState.statusNote = abilityFlow.message;
      } else {
        rocketState.statusNote = "该公司 1x 行动暂未处理";
      }
      renderStateReadout();
      return;
    }

    if (abilityFlow.flowType === "stratus_public_corners"
      || abilityFlow.flowType === "huanyu_free_moves"
      || abilityFlow.flowType === "fundamentalism_score_exchange"
      || abilityFlow.flowType === "pirates_raid_launch") {
      const result = industry.markIndustryAction(player, turnState.roundNumber, {
        turnNumber: turnState.turnNumber,
      });
      if (!result.ok) {
        restoreObjectSnapshot(player, beforeIndustryPlayer);
        rocketState.statusNote = result.message;
        renderStateReadout();
        return;
      }

      const markerRestoreCommand = createIndustryActionRestoreCommand(
        player,
        beforeIndustryPlayer,
        companyLabel,
        { clearEffectFlow: true },
      );
      const started = startIndustryAbilityFlow(abilityFlow, { markerRestoreCommand });
      if (!started) {
        markerRestoreCommand?.undo();
      } else {
        rocketState.statusNote = abilityFlow.message || rocketState.statusNote;
      }
      renderInitialSelectionArea();
      renderStateReadout();
      return;
    }

    beginQuickActionStep("industry-mark", `公司行动标记：${companyLabel}`);
    const result = industry.markIndustryAction(player, turnState.roundNumber, {
      turnNumber: turnState.turnNumber,
    });
    if (!result.ok) {
      restoreObjectSnapshot(player, beforeIndustryPlayer);
      quickActionHistory.undoLastStep();
      if (!quickActionHistory.hasUndoableStep()) {
        quickActionHistory.commitSession();
        clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
      }
      rocketState.statusNote = result.message;
      renderStateReadout();
      return;
    }

    recordIndustryActionRestoreCommand(player, beforeIndustryPlayer, companyLabel);

    const started = startIndustryAbilityFlow(abilityFlow);
    if (!started) {
      const undoResult = quickActionHistory.undoLastStep();
      if (undoResult.ok) {
        forgetLastHistoryStep(HISTORY_SOURCE_QUICK, undoResult.step?.id || null);
        removeLastActionLogStep(HISTORY_SOURCE_QUICK, undoResult.step?.id || null);
      }
      if (undoResult.ok && !quickActionHistory.hasUndoableStep()) {
        quickActionHistory.commitSession();
        clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
      }
    }
    if (started) {
      rocketState.statusNote = abilityFlow.message || rocketState.statusNote;
    }
    renderInitialSelectionArea();
    renderStateReadout();
  }

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

  function placeDataToBlueSlot(blueSlot) {
    const blocked = blockIncompatiblePendingQuickAction("place-data");
    if (blocked) return blocked;

    const player = getCurrentPlayer();
    if (!data.listPoolTokens(player).length) {
      rocketState.statusNote = "数据池没有可放置的数据";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const check = data.canPlaceDataToBlueBonus(player, blueSlot);
    if (!check.ok) {
      rocketState.statusNote = check.message;
      renderStateReadout();
      return check;
    }

    return confirmDataPlacement(data.PLACEMENT_KIND_BLUE_BONUS, blueSlot);
  }

  function renderPlayerDataBoard() {
    return renderRuntime.renderPlayerDataBoard();
  }

  function renderPlayerStats() {
    return renderRuntime.renderPlayerStats();
  }

  function getPlayerReadoutLines() {
    const currentPlayer = getInterfacePlayer();
    const resources = currentPlayer.resources;
    const income = players.normalizeIncome(currentPlayer.income || null);
    const companyBaseIncome = getPlayerCompanyBaseIncome(currentPlayer);
    const limits = players.RESOURCE_LIMITS;
    const reservedCount = Array.isArray(currentPlayer.reservedCards) ? currentPlayer.reservedCards.length : 0;
    const probeLocationData = buildProbeLocationIndex();
    const finalScoreBreakdown = endGameScoring?.computePlayerFinalScore
      ? endGameScoring.computePlayerFinalScore({
        currentPlayer,
        finalScoringState,
        playerState,
        nebulaDataState,
        alienGameState,
        planetStatsState,
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
    const lines = planetStats.formatPlanetStatsLines(planetStatsState);
    if (aomomo && (solarState.aomomoActive || alienGameState.aomomo?.revealInitialized)) {
      const aomomoLineIndex = lines.findIndex((line) => String(line).startsWith("奥陌陌 "));
      if (aomomoLineIndex >= 0) {
        lines[aomomoLineIndex] = `奥陌陌 环绕=${aomomo.countOrbitMarkers(alienGameState)} 登陆=${aomomo.countLandingMarkers(alienGameState)}`;
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

  function getActionContextPlayerState() {
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer?.id || currentPlayer.id === playerState.currentPlayerId) {
      return playerState;
    }
    return {
      ...playerState,
      currentPlayerId: currentPlayer.id,
      players: playerState.players,
    };
  }

  function createActionContext() {
    const contextPlayerState = getActionContextPlayerState();
    return {
      solarState,
      playerState: contextPlayerState,
      cardState,
      rocketState,
      nebulaDataState,
      planetStatsState,
      alienGameState,
      techBoardState: techGameState.board,
      techUiState: techGameState.ui,
      techGameState,
      turnState,
      ...buildPlutoMarkerContext(),
      roundNumber: turnState.roundNumber,
      turnNumber: turnState.turnNumber,
      getPlayerTokenSrc: (player) => getNormalTokenAssetForPlayer(player),
      getEarthSectorCoordinate,
      getPlanetLocations: () => solar.createSolarSnapshot(solarState).planetLocations,
      rotateSolarOrbit: (count) => rotateSolarOrbit(count),
      drawBasicCardToPlayer: (player) => drawBasicCardToPlayer(player),
      drawBasicCard: () => drawCardForCurrentPlayer(),
      blindDrawCard: (player) => blindDrawCardForPlayer(player),
      launchRocketAtEarth: (player) => rocketActions.launchRocketAtSector(rocketState, getEarthSectorCoordinate(), {
        playerId: player.id,
        color: player.color,
      }),
      replenishPublicSlot: (slotIndex) => cards.replenishPublicSlot(cardState, playerState, slotIndex),
      beginCardSelection: (pendingAction) => beginCardSelection(pendingAction),
      beginDiscardSelection: (count, pendingAction) => beginDiscardSelection(count, pendingAction),
      beginIncome: (options) => beginIncomeForCurrentPlayer(options),
      getPlayerCompanyBaseIncome,
      ensurePlayerTechState: (player) => {
        if (!player.techState) {
          player.techState = players.normalizePlayerTechState(null);
        }
      },
    };
  }

  function removeRocketElement(rocketId) {
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

  function getPlutoReservedCards(player = getCurrentPlayer()) {
    return (player?.reservedCards || []).filter((card) => cardEffects.getCardModel?.(card)?.pluto);
  }

  function getAllPlutoReservedCardEntries() {
    return (playerState.players || []).flatMap((player) => (
      getPlutoReservedCards(player).map((card) => ({ player, card }))
    ));
  }

  function ensurePlutoCardEffectState(card) {
    if (!card) return null;
    let state = cardEffects.ensureCardEffectState(card);
    if (!state) {
      const modelCardId = cardEffects.getCardId?.(card) || card.cardId || card.id || "b_139.webp";
      if (!card.cardEffectState || card.cardEffectState.modelCardId !== modelCardId) {
        card.cardEffectState = {
          modelCardId,
          consumedTriggerIds: [],
          completedTaskIds: [],
        };
      }
      state = card.cardEffectState;
    }
    if (!Array.isArray(state.consumedTriggerIds)) state.consumedTriggerIds = [];
    if (!Array.isArray(state.completedTaskIds)) state.completedTaskIds = [];
    if (!state.pluto) state.pluto = {};
    const pluto = state.pluto;
    if (!Array.isArray(pluto.orbitMarkers)) {
      const orbitCount = Math.max(0, Math.round(Number(pluto.orbitCount) || (pluto.orbitDone ? 1 : 0)));
      pluto.orbitMarkers = Array.from({ length: orbitCount }, (_, index) => ({
        kind: "orbit",
        sequence: index + 1,
      }));
    }
    if (!Array.isArray(pluto.landingMarkers)) {
      const landCount = Math.max(0, Math.round(Number(pluto.landCount) || (pluto.landDone ? 1 : 0)));
      pluto.landingMarkers = Array.from({ length: landCount }, (_, index) => ({
        kind: "land",
        sequence: index + 1,
      }));
    }
    pluto.orbitDone = pluto.orbitMarkers.length > 0;
    pluto.landDone = pluto.landingMarkers.length > 0;
    pluto.orbitCount = pluto.orbitMarkers.length;
    pluto.landCount = pluto.landingMarkers.length;
    return state;
  }

  function getPlutoActionState(card) {
    const state = ensurePlutoCardEffectState(card);
    if (!state) return { orbitDone: false, landDone: false };
    return state.pluto;
  }

  function getNextPlutoMarkerSequence(markers) {
    return (markers || []).reduce((max, marker) => Math.max(max, Math.round(Number(marker.sequence) || 0)), 0) + 1;
  }

  function getPlutoMarkerSector(rocket) {
    const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
    return coordinate ? { sectorX: coordinate.x, sectorY: coordinate.y } : {};
  }

  function addPlutoMarker(card, actionType, player, options = {}) {
    const state = getPlutoActionState(card);
    const list = actionType === "orbit" ? state.orbitMarkers : state.landingMarkers;
    if (!options.allowDuplicate && list.length > 0) {
      return { ok: false, message: actionType === "orbit" ? "冥王星已环绕" : "冥王星已登陆" };
    }
    const marker = {
      kind: actionType,
      planetId: "pluto",
      sequence: getNextPlutoMarkerSequence(list),
      playerId: player?.id || null,
      playerColor: player?.color || null,
      color: player?.color || null,
      cardId: card?.id || null,
      ...getPlutoMarkerSector(options.rocket),
    };
    list.push(marker);
    state.orbitDone = state.orbitMarkers.length > 0;
    state.landDone = state.landingMarkers.length > 0;
    state.orbitCount = state.orbitMarkers.length;
    state.landCount = state.landingMarkers.length;
    return { ok: true, marker };
  }

  function removePlutoMarker(choice, player, owner = "current") {
    const entry = getAllPlutoReservedCardEntries().find((item) => item.card.id === choice.cardId);
    if (!entry) return { ok: false, message: "没有可移除的冥王星标记" };
    if (owner !== "any" && entry.player?.id !== player?.id) {
      return { ok: false, message: "只能移除自己的冥王星标记" };
    }
    const state = getPlutoActionState(entry.card);
    const list = choice.kind === "plutoOrbit" ? state.orbitMarkers : state.landingMarkers;
    const markerIndex = list.findIndex((marker) => Number(marker.sequence) === Number(choice.sequence));
    if (markerIndex < 0) return { ok: false, message: "没有可移除的冥王星标记" };
    const [marker] = list.splice(markerIndex, 1);
    state.orbitDone = state.orbitMarkers.length > 0;
    state.landDone = state.landingMarkers.length > 0;
    state.orbitCount = state.orbitMarkers.length;
    state.landCount = state.landingMarkers.length;
    return { ok: true, marker, card: entry.card, ownerPlayer: entry.player, message: "已移除冥王星标记" };
  }

  function collectPlutoMarkers() {
    const markers = [];
    for (const { player, card } of getAllPlutoReservedCardEntries()) {
      const state = getPlutoActionState(card);
      for (const marker of state.orbitMarkers || []) {
        markers.push({
          ...marker,
          kind: "orbit",
          planetId: "pluto",
          cardId: card.id,
          playerId: marker.playerId || player.id,
          playerColor: marker.playerColor || player.color,
          color: marker.color || player.color,
        });
      }
      for (const marker of state.landingMarkers || []) {
        markers.push({
          ...marker,
          kind: "land",
          planetId: "pluto",
          cardId: card.id,
          playerId: marker.playerId || player.id,
          playerColor: marker.playerColor || player.color,
          color: marker.color || player.color,
        });
      }
    }
    return markers;
  }

  function buildPlutoMarkerContext() {
    return { plutoMarkers: collectPlutoMarkers() };
  }

  function playerHasOwnPlutoLanding(player) {
    return collectPlutoMarkers().some((marker) => marker.kind === "land" && markerBelongsToPlayer(marker, player));
  }

  function buildPlutoMarkerRemovalChoices(owner, markerKinds) {
    const currentPlayer = getCurrentPlayer();
    const choices = [];
    for (const { player, card } of getAllPlutoReservedCardEntries()) {
      if (owner !== "any" && player?.id !== currentPlayer?.id) continue;
      const state = getPlutoActionState(card);
      if (markerKinds.has("orbit")) {
        for (const marker of state.orbitMarkers || []) {
          choices.push({
            id: `plutoOrbit:${card.id}:${marker.sequence}`,
            kind: "plutoOrbit",
            planetId: "pluto",
            cardId: card.id,
            sequence: marker.sequence,
            sectorX: marker.sectorX,
            sectorY: marker.sectorY,
            label: `冥王星 环绕 ${marker.sequence}`,
            description: `${markerOwnerLabel(marker.playerId ? marker : player)}标记`,
          });
        }
      }
      if (markerKinds.has("land")) {
        for (const marker of state.landingMarkers || []) {
          choices.push({
            id: `plutoLand:${card.id}:${marker.sequence}`,
            kind: "plutoLand",
            planetId: "pluto",
            cardId: card.id,
            sequence: marker.sequence,
            label: `冥王星 登陆 ${marker.sequence}`,
            description: `${markerOwnerLabel(marker.playerId ? marker : player)}标记`,
          });
        }
      }
    }
    return choices;
  }

  function getPlutoCandidateRockets(player = getCurrentPlayer(), options = {}) {
    const preferredRocketId = options.preferredRocketId ?? rocketState.activeRocketId ?? null;
    const candidates = (rocketState.rockets || []).filter((rocket) => {
      if (rocket.playerId !== player?.id) return false;
      const coordinate = rocketActions.getRocketSectorCoordinate(rocket);
      return Number(coordinate?.y) === 4;
    });
    if (preferredRocketId == null) return candidates;
    return candidates.sort((left, right) => {
      if (left.id === preferredRocketId) return -1;
      if (right.id === preferredRocketId) return 1;
      return 0;
    });
  }

  function getPlutoActionCost(actionType, card) {
    if (actionType === "orbit") return { ...abilities.planet.DEFAULT_ORBIT_COST };
    const currentPlayer = getCurrentPlayer();
    const state = getPlutoActionState(card);
    let energy = abilities.planet.BASE_LAND_ENERGY_COST;
    if (state.orbitDone) energy -= 1;
    if (players.playerOwnsTech(currentPlayer, "orange3", createActionContext())) {
      energy -= abilities.planet.ORANGE3_LAND_DISCOUNT;
    }
    return energy > 0 ? { energy } : {};
  }

  function getAvailablePlutoAction(actionType, options = {}) {
    const currentPlayer = getCurrentPlayer();
    const card = getPlutoReservedCards(currentPlayer).find((item) => {
      const state = getPlutoActionState(item);
      return actionType === "orbit" ? !state.orbitDone : !state.landDone;
    });
    if (!card) return { ok: false, message: "没有可用的冥王星保留牌" };
    const rockets = getPlutoCandidateRockets(currentPlayer, options);
    if (!rockets.length) return { ok: false, message: "没有 y=4 的己方探测器可前往冥王星" };
    const cost = getPlutoActionCost(actionType, card);
    if (!players.canAfford(currentPlayer, cost)) {
      return { ok: false, message: `资源不足，需要 ${players.formatResourceCost(cost)}` };
    }
    return { ok: true, card, rocket: rockets[0], cost };
  }

  function executePlutoAction(actionType, options = {}) {
    if (!canStartMainAction()) {
      rocketState.statusNote = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const available = getAvailablePlutoAction(actionType, options);
    if (!available.ok) {
      rocketState.statusNote = available.message;
      renderStateReadout();
      return available;
    }
    const currentPlayer = getCurrentPlayer();
    const beforePlayer = structuredClone(currentPlayer);
    const beforeRocketState = structuredClone(rocketState);
    const beforeCard = structuredClone(available.card);
    const spendResult = players.spendResources(currentPlayer, available.cost);
    if (!spendResult.ok) {
      rocketState.statusNote = spendResult.message;
      renderStateReadout();
      return spendResult;
    }
    const removeResult = rocketActions.removeRocket(rocketState, available.rocket.id);
    if (!removeResult.ok) {
      players.gainResources(currentPlayer, available.cost);
      rocketState.statusNote = removeResult.message;
      renderStateReadout();
      return removeResult;
    }
    const markerResult = addPlutoMarker(available.card, actionType, currentPlayer, {
      rocket: available.rocket,
    });
    if (!markerResult.ok) {
      restoreMutableObject(currentPlayer, beforePlayer);
      restoreMutableObject(rocketState, beforeRocketState);
      rocketState.statusNote = markerResult.message;
      renderStateReadout();
      return markerResult;
    }
    if (actionType === "orbit") {
      players.incrementPlayerOrbitCount(playerState, currentPlayer.id);
    }
    const actionLabel = actionType === "orbit" ? "环绕冥王星" : "登陆冥王星";
    const result = {
      ok: true,
      undoable: true,
      message: `${actionLabel}，消耗 ${players.formatResourceCost(available.cost) || "0"}，移除 R${available.rocket.id}`,
      commands: [
        historyCommands.createRestorePlayerCommand(currentPlayer, beforePlayer, "恢复冥王星行动前玩家状态"),
        historyCommands.createRestoreRocketStateCommand(rocketState, beforeRocketState, "恢复冥王星行动前探测器状态"),
        historyCommands.createRestoreObjectCommand(available.card, beforeCard, "恢复冥王星卡牌状态"),
      ],
      events: [{
        type: actionType,
        planetId: "pluto",
        playerId: currentPlayer.id,
        playerColor: currentPlayer.color,
        source: "pluto",
      }],
      removedRocketId: available.rocket.id,
      planetId: "pluto",
      markerKind: actionType === "orbit" ? "pluto-orbit" : "pluto-land",
      markerSequence: markerResult.marker.sequence,
    };
    removeRocketElement(available.rocket.id);
    recordAtomicActionHistory(actionType, actionLabel, result);
    const rewardEffects = buildPlutoRewardEffectsForAction(actionType);
    rocketState.statusNote = result.message;
    renderPlayerStats();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    const startedRewardFlow = startCardEffectFlow(
      `pluto-${actionType}-rewards`,
      actionLabel,
      rewardEffects,
      { actionType, historySource: HISTORY_SOURCE_MAIN, consumesMainAction: true },
    );
    const settlement = settleCardTasksAfterEffect({ events: result.events, render: false });
    renderPlayerStats();
    renderReservedCardsFromTaskState();
    updateActionButtons();
    renderStateReadout();
    return startedRewardFlow
      || Boolean(settlement?.type1Result)
      || hasActiveCardTriggerResolution()
      || isActionEffectFlowActive();
  }

  function getCurrentPlanetActionPlacement(context = createActionContext()) {
    return actionShared?.getRocketPlanet?.(context) || { ok: false };
  }

  function getPlutoChoiceActionLabel(actionType) {
    return actionType === "orbit" ? "环绕" : "登陆";
  }

  function formatPlutoChoiceLabel(actionType, available, effect = null) {
    const actionLabel = getPlutoChoiceActionLabel(actionType);
    const costLabel = players.formatResourceCost(available?.cost || {}) || "0";
    const rocketLabel = available?.rocket?.id != null ? `R${available.rocket.id}` : "探测器";
    const rewardSummary = buildPlutoChoiceRewardSummary(actionType, effect);
    return `${actionLabel}冥王星${rewardSummary ? ` - 奖励：${rewardSummary}` : ""}（${rocketLabel}，${costLabel}）`;
  }

  function buildPlutoActionChoiceOptions(actionType) {
    const context = createActionContext();
    const actionLabel = getPlutoChoiceActionLabel(actionType);
    const normalCheck = actionType === "orbit"
      ? abilities.planet.getOrbitOptions(context)
      : abilities.planet.getLandOptions(context);
    const placement = getCurrentPlanetActionPlacement(context);
    const preferredRocketId = normalCheck?.defaultRocketId || (placement?.ok ? placement.rocket?.id : null);
    const plutoCheck = getAvailablePlutoAction(actionType, { preferredRocketId });
    const choices = [];

    if (normalCheck.ok) {
      if (actionType === "orbit") {
        choices.push(...normalCheck.choices.map((choice) => ({
          ...choice,
          kind: "normal",
        })));
      } else {
        const landOptions = abilities.planet.getLandOptions(context);
        if (landOptions.ok) {
          choices.push(...landOptions.choices.map((choice) => ({
            ...choice,
            kind: "normal",
          })));
        }
      }
    }

    if (plutoCheck.ok) {
      choices.push({
        kind: "pluto",
        label: formatPlutoChoiceLabel(actionType, plutoCheck),
        preferredRocketId,
      });
    }

    if (!choices.length) {
      return {
        ok: false,
        message: normalCheck.message || plutoCheck.message || `当前无法${actionLabel}`,
      };
    }

    return {
      ok: true,
      actionType,
      title: `选择${actionLabel}目标`,
      selectLabel: `${actionLabel}到`,
      confirmText: `确认${actionLabel}`,
      planet: { planetId: `pluto-${actionType}-choice`, name: `${actionLabel}目标` },
      choices,
      needsChoice: choices.length > 1,
      defaultTarget: choices[0].target,
    };
  }

  function openPlutoActionChoicePicker(actionType) {
    const options = buildPlutoActionChoiceOptions(actionType);
    if (!options.ok) {
      rocketState.statusNote = options.message;
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return { ok: false, message: options.message };
    }
    if (options.choices.length === 1) {
      const [choice] = options.choices;
      return choice.kind === "pluto"
        ? executePlutoAction(actionType, { preferredRocketId: choice.preferredRocketId })
        : runAction(actionType, actionType === "land"
          ? { target: choice.target, rocketId: choice.rocketId }
          : { rocketId: choice.rocketId });
    }
    openLandTargetPicker({
      ...options,
      getOptions: () => buildPlutoActionChoiceOptions(actionType),
      onConfirm: (choice) => (
        choice.kind === "pluto"
          ? executePlutoAction(actionType, { preferredRocketId: choice.preferredRocketId })
          : runAction(actionType, actionType === "land"
            ? { target: choice.target, rocketId: choice.rocketId }
            : { rocketId: choice.rocketId })
      ),
    });
    rocketState.statusNote = `请选择${getPlutoChoiceActionLabel(actionType)}目标`;
    renderStateReadout();
    return { ok: true, pendingChoice: true };
  }

  function markActionPending() {
    pendingState.actionExecuted = true;
  }

  function getIrreversibleReason(result, fallback = "该步骤产生不可撤销影响") {
    if (result?.irreversible?.reason) return String(result.irreversible.reason);
    if (result?.irreversibleReason) return String(result.irreversibleReason);
    if (result?.undoable === false) return result.message || fallback;
    return null;
  }

  function markCurrentActionIrreversible(reason, code = "irreversible") {
    pendingState.actionHasIrreversibleBarrier = true;
    pendingState.actionIrreversibleReason = reason || pendingState.actionIrreversibleReason || "该步骤产生不可撤销影响";
    return {
      code,
      reason: pendingState.actionIrreversibleReason,
    };
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
    pendingState.actionExecuted = false;
    pendingState.passPlayerId = null;
    clearCompletedEffectFlowForUndo(HISTORY_SOURCE_MAIN);
    pendingState.actionHasIrreversibleBarrier = false;
    pendingState.actionIrreversibleReason = null;
  }

  function recoverPendingActionFromOpenHistoryForAi() {
    if (
      pendingState.actionExecuted
      || isActionEffectFlowActive()
      || hasActivePendingSubFlow()
      || !actionHistory.hasSession()
    ) {
      return { ok: false, message: "当前不需要恢复行动待结束状态" };
    }
    markActionPending();
    const info = actionHistory.getSessionInfo?.() || null;
    rocketState.statusNote = `${info?.label || "行动"}已恢复为待回合结束状态`;
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message: rocketState.statusNote, sessionInfo: info };
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
      || pendingState.actionExecuted
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
    return Boolean(pendingState.actionExecuted || isActionEffectFlowActive());
  }

  function hasCurrentMainActionIrreversibleBarrier() {
    return Boolean(
      pendingState.actionHasIrreversibleBarrier
      || actionHistory.hasIrreversibleBarrier?.(),
    );
  }

  function getMainActionStartBlockReason() {
    const gameplayLockReason = getGameplayLockReason();
    if (gameplayLockReason) return gameplayLockReason;
    if (pendingState.actionExecuted) return "请先回合结束或撤销当前行动";
    if (isActionEffectFlowActive()) return "请先完成当前行动的效果";
    if (actionHistory.hasSession()) return "请先回合结束或撤销当前行动";
    if (hasActivePendingSubFlow()) return "请先完成或取消当前流程";
    return null;
  }

  function canStartMainAction() {
    return !getMainActionStartBlockReason();
  }

  function createPassEvent(player) {
    return {
      type: "pass",
      playerId: player?.id || null,
      playerColor: player?.color || null,
      source: "pass",
    };
  }

  function createRequiredPassEffect(node) {
    return {
      ...node,
      undoable: node.undoable ?? true,
      options: {
        ...(node.options || {}),
        required: true,
        skippable: false,
      },
    };
  }

  function buildPassEffectQueue(player) {
    const effects = [];
    if (industry?.shouldLaunchAfterPassWithHuanyuSuperdrive?.(player)) {
      if (isWeakStartAiDifficulty(player)) {
        effects.push(createRequiredPassEffect({
          id: "pass-huanyu-superdrive-credit",
          type: planetRewards.EFFECT_TYPES.GAIN_RESOURCES,
          icon: "credits",
          label: "寰宇超动力：PASS 后获得 1 信用点",
          options: {
            gain: { credits: 1 },
            targetPlayerId: player?.id || null,
            targetPlayerColor: player?.color || null,
          },
        }));
      } else {
        effects.push(createRequiredPassEffect({
          id: "pass-huanyu-superdrive-launch",
          type: "industry_huanyu_superdrive_launch",
          icon: "launch",
          label: "寰宇超动力：PASS 后额外发射",
          options: {
            skipCost: true,
            ignoreRocketLimit: true,
          },
        }));
      }
    }

    if (isFinalRound()) return effects;

    const handCount = Array.isArray(player?.hand) ? player.hand.length : 0;
    const discardCount = Math.max(0, handCount - PASS_HAND_LIMIT);

    if (discardCount > 0) {
      effects.push(createRequiredPassEffect({
        id: "pass-hand-limit",
        type: "pass_hand_limit",
        icon: "discard",
        label: `PASS：弃至 ${PASS_HAND_LIMIT} 张手牌`,
        options: { discardCount },
      }));
    }

    if ((turnState.passedPlayerIds || []).length === 0) {
      effects.push(createRequiredPassEffect({
        id: "pass-first-rotate",
        type: "pass_first_rotate",
        icon: "rotate",
        label: "首位 PASS：太阳系旋转",
      }));
    }

    if (PASS_RESERVE_ROUNDS.includes(turnState.roundNumber)) {
      effects.push(createRequiredPassEffect({
        id: "pass-reserve-pick",
        type: "pass_reserve_pick",
        icon: "pick_card",
        label: "PASS 预留精选",
        options: { roundNumber: turnState.roundNumber },
      }));
    }

    return effects;
  }

  function beginPassActionSession(currentPlayer) {
    pendingState.passPlayerId = currentPlayer.id;
    startActionLogDraft("pass", "PASS", { source: HISTORY_SOURCE_MAIN, player: currentPlayer });
    actionHistory.beginSession("pass", "PASS");
    actionHistory.beginStep({
      source: HISTORY_SOURCE_MAIN,
      type: "action_start",
      label: `${currentPlayer.colorLabel}玩家 PASS`,
      effectIndex: -1,
      logBefore: createActionLogImpactSnapshot(currentPlayer),
    });
    uiRuntimeState.effectStepActive = true;
    completePendingActionStep();
  }

  function settlePassEventAfterEffects(player) {
    if (isFinalRound()) {
      return {
        ok: true,
        skipped: true,
        message: "最终轮 PASS 不触发额外效果",
      };
    }

    return settleCardTasksAfterEffect({
      events: [createPassEvent(player)],
      render: false,
    });
  }

  function executePassHandLimitEffect(effect) {
    const currentPlayer = getCurrentPlayer();
    const discardCount = Math.max(0, (currentPlayer?.hand?.length || 0) - PASS_HAND_LIMIT);
    if (discardCount <= 0) {
      effect.result = {
        ok: true,
        undoable: true,
        message: `PASS 手牌上限：已不超过 ${PASS_HAND_LIMIT} 张`,
      };
      rocketState.statusNote = effect.result.message;
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    const result = beginDiscardSelection(discardCount, {
      type: "pass_hand_limit",
      player: currentPlayer,
      required: true,
      fromEffectFlow: true,
      effectLabel: effect.label,
      beforePlayerState: structuredClone(currentPlayer),
      beforeCardState: structuredClone(cardState),
    });
    if (!result.ok) {
      rocketState.statusNote = result.message;
      renderStateReadout();
    }
    return result;
  }

  function executePassFirstRotateEffect(effect) {
    const beforeSolarState = structuredClone(solarState);
    const beforeRocketState = structuredClone(rocketState);
    const beforePlayerState = structuredClone(playerState);
    const beforeAlienState = structuredClone(alienGameState);
    const beforeCardState = structuredClone(cardState);

    beginEffectHistoryStep(effect.label);
    const result = rotateSolarOrbit(1);
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      solarState,
      beforeSolarState,
      "恢复 PASS 旋转前太阳系状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      rocketState,
      beforeRocketState,
      "恢复 PASS 旋转前火箭状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      playerState,
      beforePlayerState,
      "恢复 PASS 旋转前玩家状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      alienGameState,
      beforeAlienState,
      "恢复 PASS 旋转前外星人状态",
    ));
    recordHistoryCommand(historyCommands.createRestoreObjectCommand(
      cardState,
      beforeCardState,
      "恢复 PASS 旋转前牌区",
    ));

    const anomalyPickOpen = isCardSelectionActive()
      && pendingState.cardSelectionAction?.type === "yichangdian_anomaly_pick";
    if (anomalyPickOpen) {
      pendingState.cardSelectionAction.fromEffectFlow = true;
      pendingState.cardSelectionAction.effectResult = {
        ok: result.ok,
        undoable: true,
        message: result.message,
        payload: result.payload || null,
        events: result.events || [],
      };
      rocketState.statusNote = result.message;
      updateActionButtons();
      renderStateReadout();
      return result;
    }

    effect.result = {
      ok: result.ok,
      undoable: true,
      message: result.message,
      payload: result.payload || null,
      events: result.events || [],
    };
    rocketState.statusNote = result.message;
    completeCurrentActionEffect();
    renderStateReadout();
    return result;
  }

  function passForCurrentPlayer() {
    if (!canStartMainAction()) {
      rocketState.statusNote = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) {
      return { ok: false, message: "没有当前玩家" };
    }

    beginPassActionSession(currentPlayer);
    const passEffects = buildPassEffectQueue(currentPlayer);
    if (passEffects.length) {
      pendingState.actionEffectFlow = abilities.chain.startAbilityChain(
        "pass",
        "PASS",
        passEffects,
      );
      pendingState.actionEffectFlow.actionType = "pass";
      pendingState.actionEffectFlow.playerId = currentPlayer.id;
      assignEffectFlowOwner(pendingState.actionEffectFlow, pendingState.actionEffectFlow.playerId);
      pendingState.actionEffectFlow.passEvent = createPassEvent(currentPlayer);
      pendingState.actionEffectFlow.historySource = HISTORY_SOURCE_MAIN;
      pendingState.actionEffectFlow.consumesMainAction = true;
      els.appWrap?.classList.toggle("action-effect-flow-active", true);
      rocketState.statusNote = "PASS：请依次点击必做效果";
      activateNextActionEffect();
      return { ok: true, message: rocketState.statusNote };
    }

    const passSettlement = settlePassEventAfterEffects(currentPlayer);
    if (hasActiveCardTriggerResolution() || isActionEffectFlowActive()) {
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: passSettlement?.type1Result?.message || rocketState.statusNote };
    }

    rocketState.statusNote = `${currentPlayer.colorLabel}玩家选择 PASS，请点击回合结束确认`;
    updateActionButtons();
    renderStateReadout();
    return { ok: true, message: rocketState.statusNote };
  }

  function applyPassTurnEndIncome(player) {
    if (!player || isFinalRound()) return null;

    const result = applyIncomeResourcesForPlayer(player, { label: "PASS 收入" });
    appendActionLogStep(HISTORY_SOURCE_MAIN, "PASS 收入", result.message, {
      player,
      undoable: false,
      irreversibleReason: "回合结束确认后结算",
    });
    return result;
  }

  function listReadyAlienRevealSlotIds() {
    return (aliens.ALIEN_SLOT_IDS || [])
      .filter((alienSlotId) => {
        const slot = aliens.getAlienSlot(alienGameState, alienSlotId);
        return aliens.isAlienReadyToReveal?.(slot);
      });
  }

  function maybeContinuePendingTurnEndRevealFlow() {
    if (!pendingState.turnEndAfterRevealContinuation) return null;
    return maybeContinueAlienRevealQueuedOpportunities();
  }

  function maybeContinueAlienRevealQueuedOpportunities() {
    const jiuzheOpenResult = maybeOpenQueuedJiuzheOpportunity();
    if (jiuzheOpenResult?.ok) {
      scheduleAiAutoStepIfNeeded();
      return { ok: true, opened: true, result: jiuzheOpenResult };
    }
    const banrenmaOpenResult = maybeOpenQueuedBanrenmaOpportunity();
    if (banrenmaOpenResult?.ok) {
      scheduleAiAutoStepIfNeeded();
      return { ok: true, opened: true, result: banrenmaOpenResult };
    }
    return maybeResumeTurnEndAfterReveal();
  }

  function finishCurrentTurnAfterAlienReveal({
    endingPlayer,
    endingPlayerId,
    didPass,
    turnEndReveal,
  }) {
    if (turnEndReveal?.count && hasTurnEndRevealBlockingSubFlow()) {
      return queueTurnEndAfterRevealContinuation({
        endingPlayer,
        endingPlayerId,
        didPass,
        turnEndReveal,
      });
    }
    pendingState.turnEndAfterRevealContinuation = null;
    const passIncomeResult = didPass ? applyPassTurnEndIncome(endingPlayer) : null;
    commitActionLogDraft({
      passed: didPass,
      actionType: didPass ? "pass" : actionHistory.getSessionInfo()?.actionType,
      actionLabel: didPass ? "PASS" : actionHistory.getSessionInfo()?.label,
    });
    actionHistory.commitSession();
    clearHistoryStepOrderForSource(HISTORY_SOURCE_MAIN);
    if (quickActionHistory.hasSession()) {
      quickActionHistory.commitSession();
      clearHistoryStepOrderForSource(HISTORY_SOURCE_QUICK);
    }
    clearActionEffectFlow();
    clearActionPending();
    const advanceResult = advanceTurnAfterPlayerAction(endingPlayerId, { passed: didPass });
    const roundStartResult = advanceResult.roundAdvanced
      ? applyIndustryRoundStartBonuses(turnState.roundNumber, { appendLog: true })
      : null;
    const nextPlayer = getCurrentPlayer();
    selectDefaultRocketForCurrentPlayer();
    renderDebugPlayerSwitch();
    renderRoundStatus();
    const displayedTurnNumber = getDisplayedTurnNumber();
    const turnAdvanceMessage = advanceResult.gameEnded
      ? `第 ${turnState.roundNumber} 轮所有玩家已 PASS，游戏结束，进行终局计分${advanceResult.finalScoreLines?.length ? `：${advanceResult.finalScoreLines.join("；")}` : ""}`
      : advanceResult.roundAdvanced
      ? `所有玩家已 PASS，进入第 ${turnState.roundNumber} 轮第 ${displayedTurnNumber} 回合，当前玩家：${nextPlayer?.colorLabel || ""}玩家`
      : advanceResult.turnAdvanced
        ? `进入第 ${turnState.roundNumber} 轮第 ${displayedTurnNumber} 回合，当前玩家：${nextPlayer?.colorLabel || ""}玩家`
        : `回合已结束，当前玩家：${nextPlayer?.colorLabel || ""}玩家`;
    rocketState.statusNote = [
      turnAdvanceMessage,
      passIncomeResult?.message || null,
      roundStartResult?.message || null,
      turnEndReveal?.message || null,
    ].filter(Boolean).join("；");
    renderPlayerStats();
    renderAlienPanels();
    renderTechBoard();
    renderRockets();
    renderPublicCards();
    renderReservedCards();
    renderInitialSelectionArea();
    updatePublicCardControls();
    updateActionButtons();
    renderStateReadout();
    if (!advanceResult.gameEnded) {
      maybeStartFundamentalismRoundStartIncomeFlow(nextPlayer, turnState.roundNumber);
      maybeOpenActionBriefingForCompletedCycle(advanceResult);
    }
    refreshLatestActionLogRecoverySnapshot("回合结束后状态");
    if (advanceResult.gameEnded) {
      maybeAutoOpenFinalResultDialog();
    }
  }

  function endCurrentTurn() {
    if (!pendingState.actionExecuted || isActionEffectFlowActive() || hasActivePendingSubFlow()) return;
    const endingPlayer = getCurrentPlayer();
    const endingPlayerId = endingPlayer?.id || null;
    const didPass = pendingState.passPlayerId === endingPlayerId;

    if (industry?.expireStrategyPlayInteractionOnTurnEnd?.(endingPlayer, turnState.roundNumber)?.cleared) {
      renderInitialSelectionArea();
    }
    industry?.clearTuringBorrowedTech?.(endingPlayer);
    industry?.clearSentinelPlayCornerState?.(endingPlayer);

    endEffectHistoryStep();
    const turnEndContext = { endingPlayer, endingPlayerId, didPass };
    const turnEndReveal = revealReadyAliensAtTurnEnd(endingPlayer, {
      confirmBeforeSideEffects: true,
    });
    finishCurrentTurnAfterAlienReveal({
      ...turnEndContext,
      turnEndReveal,
    });
  }

  function undoPendingAction() {
    if (isTechActionSelectionActive()) {
      const isResearchTechFlow = pendingState.actionEffectFlow?.actionType === "researchTech";
      const shouldUseHistoryUndo = isResearchTechFlow
        && (actionHistory.hasUndoableStep() || hasCurrentMainActionIrreversibleBarrier());
      if (shouldUseHistoryUndo) {
        if (techGameState.ui.pendingTileId) {
          cancelPendingResearchTechTileChoice();
          return;
        }
      } else {
        cancelTechSelection();
        return;
      }
    }
    if (
      !pendingState.actionExecuted
      && !isActionEffectFlowActive()
      && !actionHistory.hasUndoableStep()
      && !quickActionHistory.hasUndoableStep()
    ) return;

    if (hasActivePendingSubFlow()) {
      cancelActivePendingSubFlows();
      refreshAfterHistoryChange();
      return;
    }

    const latestUndoSource = getLatestUndoSource();

    if (
      !latestUndoSource
      && pendingState.actionEffectFlow?.historySource === HISTORY_SOURCE_QUICK
      && !pendingState.actionEffectFlow.preHistoryCommandsApplied
      && pendingState.actionEffectFlow.preHistoryCommands?.length
    ) {
      const flowLabel = pendingState.actionEffectFlow.label || "快速行动效果";
      for (let index = pendingState.actionEffectFlow.preHistoryCommands.length - 1; index >= 0; index -= 1) {
        pendingState.actionEffectFlow.preHistoryCommands[index]?.undo?.();
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
      const undoingQuickEffectFlow = pendingState.actionEffectFlow?.historySource === HISTORY_SOURCE_QUICK;
      const result = quickActionHistory.undoLastStep();
      if (result.ok) {
        uiRuntimeState.effectStepActive = false;
        forgetLastHistoryStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
        removeLastActionLogStep(HISTORY_SOURCE_QUICK, result.step?.id || null);
        const completedQuickEffectFlow = !pendingState.actionEffectFlow
          ? takeCompletedEffectFlowForUndo(result.step, HISTORY_SOURCE_QUICK)
          : null;
        if (completedQuickEffectFlow) {
          pendingState.actionEffectFlow = completedQuickEffectFlow;
          els.appWrap?.classList.toggle("action-effect-flow-active", true);
        }
        if ((undoingQuickEffectFlow || completedQuickEffectFlow) && pendingState.actionEffectFlow) {
          const effectIndex = result.step?.effectIndex;
          const hasRevertibleEffectStep = Number.isInteger(effectIndex)
            && Boolean(pendingState.actionEffectFlow.effects?.[effectIndex]);
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
      rocketState.statusNote = pendingState.actionIrreversibleReason
        ? `不可撤销：${pendingState.actionIrreversibleReason}`
        : "当前行动已有不可撤销影响";
      updateActionButtons();
      renderStateReadout();
      return;
    }

    if (mainActionHasIrreversibleBarrier && !actionHistory.hasUndoableStep()) {
      rocketState.statusNote = pendingState.actionIrreversibleReason
        ? `不可撤销：${pendingState.actionIrreversibleReason}`
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
        const completedMainEffectFlow = !pendingState.actionEffectFlow
          ? takeCompletedEffectFlowForUndo(result.step, HISTORY_SOURCE_MAIN)
          : null;
        if (completedMainEffectFlow) {
          pendingState.actionEffectFlow = completedMainEffectFlow;
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
          pendingState.actionEffectFlow = completedMainEffectFlow;
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

    if (pendingState.actionExecuted || actionHistory.hasSession()) {
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

  let moveArrowRenderFrame = 0;

  function getMoveArrowDirectionRotation(angleDegrees, kind) {
    const rad = angleDegrees * (Math.PI / 180);
    let dx;
    let dy;
    if (kind === "out") {
      dx = Math.cos(rad);
      dy = Math.sin(rad);
    } else if (kind === "in") {
      dx = -Math.cos(rad);
      dy = -Math.sin(rad);
    } else if (kind === "cw") {
      dx = -Math.sin(rad);
      dy = Math.cos(rad);
    } else {
      dx = Math.sin(rad);
      dy = -Math.cos(rad);
    }
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  function getRocketPolarAnchor(rocket) {
    const sector = rocketActions.getRocketSectorCoordinate(rocket);
    if (!sector) return null;

    const radius = Number(rocket.radius);
    const angleDegrees = Number(rocket.angleDegrees);
    if (Number.isFinite(radius) && Number.isFinite(angleDegrees)) {
      return { sector, radius, angleDegrees };
    }

    if (Number.isInteger(rocket.slotIndex)) {
      const slot = solar.getSectorLaunchSlot(sector.x, sector.y, rocket.slotIndex);
      return {
        sector,
        radius: slot.radius,
        angleDegrees: slot.angleDegrees,
      };
    }

    const boardPoint = getBoardPointFromPolarPoint(rocket);
    const polar = solar.globalPointToPolarPoint(boardPoint);
    return {
      sector,
      radius: polar.radius,
      angleDegrees: polar.angleDegrees,
    };
  }

  function getMoveArrowOffsets(anchor) {
    const boundary = solar.getSectorCoordinateBoundary(anchor.sector.x, anchor.sector.y);
    const radialSpan = boundary.polarBoundary.outerRadius - boundary.polarBoundary.innerRadius;
    const angleSpan = Math.abs(
      boundary.polarBoundary.endAngleDegrees - boundary.polarBoundary.startAngleDegrees,
    );

    const boardSize = solar.GLOBAL_COORDINATE_SYSTEM.size;
    const wheelPx = Math.max(1, els.wheelWrap?.clientWidth || boardSize);
    const rocketHalfPx = ((tokenWidths.rocket || 41) * 1.2) / 2;
    const arrowHalfPx = 15;
    const clearanceBoard = (rocketHalfPx + arrowHalfPx + 6) * (boardSize / wheelPx);

    const radialOffset = Math.max(30, radialSpan * 0.42) + clearanceBoard * 0.7;
    const tangentialAngle = Math.max(
      11,
      angleSpan * 0.2,
      (Math.atan(clearanceBoard / Math.max(anchor.radius, 1)) * 180) / Math.PI,
    );

    return {
      radius: radialOffset,
      angle: tangentialAngle,
    };
  }

  function buildMoveArrowSpecs(rocket) {
    const anchor = getRocketPolarAnchor(rocket);
    if (!anchor) return [];

    const { sector, radius, angleDegrees } = anchor;
    const offsets = getMoveArrowOffsets(anchor);
    const size = solar.GLOBAL_COORDINATE_SYSTEM.size;
    const specs = [];

    const push = (kind, deltaX, deltaY, pointRadius, pointAngle) => {
      const board = solar.polarToGlobalPoint(pointRadius, pointAngle);
      const labels = {
        out: "向外移动一个扇区",
        in: "向内移动一个扇区",
        cw: "顺时针移动",
        ccw: "逆时针移动",
      };
      specs.push({
        kind,
        deltaX,
        deltaY,
        left: `${(board.x / size) * 100}%`,
        top: `${(board.y / size) * 100}%`,
        rotation: getMoveArrowDirectionRotation(pointAngle, kind),
        ariaLabel: labels[kind],
      });
    };

    if (sector.y < rocketActions.SECTOR_RING_MAX) {
      push("out", 0, 1, radius + offsets.radius, angleDegrees);
    }
    if (sector.y > rocketActions.SECTOR_RING_MIN) {
      push("in", 0, -1, radius - offsets.radius, angleDegrees);
    }
    push("cw", 1, 0, radius, angleDegrees + offsets.angle);
    push("ccw", -1, 0, radius, angleDegrees - offsets.angle);
    return specs;
  }

  function scheduleRenderMoveArrows() {
    moveArrowRenderFrame += 1;
    const frameId = moveArrowRenderFrame;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (frameId !== moveArrowRenderFrame) return;
        renderMoveArrows();
      });
    });
  }

  function renderMoveArrows() {
    if (!els.moveArrowLayer) return;

    if (uiRuntimeState.moveHighlightRocketId == null) {
      moveArrowRenderFrame += 1;
      els.moveArrowLayer.hidden = true;
      els.moveArrowLayer.replaceChildren();
      return;
    }

    const rocket = rocketState.rockets.find((item) => item.id === uiRuntimeState.moveHighlightRocketId);
    if (!rocket || !(rocketActions.isMovablePlayerToken?.(rocket) || rocketActions.isControllablePlayerRocket(rocket))) {
      deactivateMoveMode();
      return;
    }

    const specs = buildMoveArrowSpecs(rocket);
    els.moveArrowLayer.hidden = false;
    els.moveArrowLayer.replaceChildren(...specs.map((spec) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `move-arrow-button move-arrow-${spec.kind}`;
      button.dataset.moveX = String(spec.deltaX);
      button.dataset.moveY = String(spec.deltaY);
      button.style.left = spec.left;
      button.style.top = spec.top;
      button.style.setProperty("--move-arrow-rotation", `${spec.rotation}deg`);
      button.setAttribute("aria-label", spec.ariaLabel);
      button.title = spec.ariaLabel;
      button.innerHTML = '<span class="move-arrow-glyph" aria-hidden="true"></span>';
      return button;
    }));
  }

  function syncMoveModeChrome() {
    els.appWrap?.classList.toggle("move-mode-active", uiRuntimeState.moveHighlightRocketId != null);
    syncInteractionFocusChrome();
    renderRockets();
  }

  function updateMoveRocketHighlight(rocketId) {
    const previousId = uiRuntimeState.moveHighlightRocketId;
    uiRuntimeState.moveHighlightRocketId = rocketId;

    if (previousId != null && previousId !== rocketId) {
      const previousRocket = rocketState.rockets.find((item) => item.id === previousId);
      if (previousRocket) renderRocketElement(previousRocket);
    }

    if (rocketId != null) {
      const rocket = rocketState.rockets.find((item) => item.id === rocketId);
      if (rocket) renderRocketElement(rocket);
    }

    syncMoveModeChrome();
    scheduleRenderMoveArrows();
  }

  function clearMoveRocketHighlight() {
    updateMoveRocketHighlight(null);
  }

  function activateMoveMode(rocketId) {
    if (!Number.isInteger(rocketId) || rocketId <= 0) return false;

    const currentPlayer = getCurrentPlayer();
    const rocketsForPlayer = getMovableTokensForPlayer(currentPlayer.id);
    if (!rocketsForPlayer.some((rocket) => rocket.id === rocketId)) return false;

    const cardMoveEffect = pendingState.actionEffectFlow?.cardMoveEffect?.effect || null;
    const huanyuRocketCheck = validateIndustryHuanyuMoveRocket(cardMoveEffect, rocketId);
    if (!huanyuRocketCheck.ok) {
      rocketState.statusNote = huanyuRocketCheck.message;
      renderStateReadout();
      return false;
    }

    rocketActions.setActiveRocket(rocketState, rocketId);
    updateMoveRocketHighlight(rocketId);
    renderStateReadout();
    return true;
  }

  function deactivateMoveMode() {
    if (isMovePaymentSelectionActive()) {
      cancelMovePaymentSelection();
    }
    clearMoveRocketHighlight();
    renderRockets();
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

    if (pendingState.actionExecuted) {
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
    syncFinalResultButton();
    const context = createActionContext();
    const gameplayLockReason = getGameplayLockReason();
    if (gameplayLockReason) {
      lockAllActionButtons(gameplayLockReason);
      return;
    }
    if (isAiAutoBattlePlayer(playerState.currentPlayerId) && !isAiAutomationPaused()) {
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

    if (effectFlowLocked || pendingState.actionExecuted || actionHistoryLocked) {
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
    return !els.quickActionsPanel.hidden;
  }

  function setQuickPanelOpen(open) {
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
    const context = createActionContext();
    els.quickActionsTrades.querySelectorAll("[data-quick-trade]").forEach((button) => {
      const tradeId = button.dataset.quickTrade;
      const check = quickTrades.canExecuteTrade(tradeId, context);
      button.disabled = !check.ok;
      button.title = check.ok ? "" : (check.message || "当前无法兑换");
    });
  }

  function closeDataPlacePicker(options = {}) {
    if (!els.dataPlaceOverlay) return;
    els.dataPlaceOverlay.hidden = true;
    if (!options.keepPending) pendingState.dataPlaceAction = null;
  }

  function shouldPromptDataPlaceChoice(choices) {
    return abilities.data.needsPlacementChoice(choices);
  }

  function getDataPoolCount(player) {
    const dataState = data.ensurePlayerDataState?.(player) || player?.dataState || {};
    return Array.isArray(dataState.poolTokens)
      ? dataState.poolTokens.length
      : Math.max(0, Math.round(Number(player?.resources?.availableData) || 0));
  }

  function isDataPoolFull(player) {
    return getDataPoolCount(player) >= players.RESOURCE_LIMITS.availableData;
  }

  function getAutoDataPlacementCheck(player) {
    if (!isDataPoolFull(player)) return { ok: false, reason: "not_full" };
    const placeCheck = data.canPlaceAnyData?.(player);
    if (!placeCheck?.ok) {
      return {
        ok: false,
        reason: "no_place",
        message: placeCheck?.message || "数据池已满，且没有可用的数据放置位置",
      };
    }
    return { ok: true, choices: placeCheck.choices || data.listPlaceDataChoices(player) };
  }

  function openDataPlacePicker(options = {}) {
    if (!els.dataPlaceOverlay || !els.dataPlaceActions) return;

    const player = options.player || getCurrentPlayer();
    const choiceResult = abilities.data.listPlacementChoices(player);
    if (!choiceResult.ok) {
      rocketState.statusNote = choiceResult.message;
      renderStateReadout();
      return;
    }

    const choices = choiceResult.choices;
    const forcePrompt = Boolean(options.forcePrompt);
    pendingState.dataPlaceAction = options.pendingAction
      ? {
        ...getPendingOwnerFields(options.pendingAction.effect || null, player),
        ...options.pendingAction,
      }
      : null;
    if (!forcePrompt && !shouldPromptDataPlaceChoice(choices)) {
      const [choice] = choices;
      confirmDataPlacement(choice.target, choice.blueSlot);
      return;
    }

    if (els.dataPlaceSubtitle) {
      els.dataPlaceSubtitle.textContent = options.subtitle
        || "请选择将数据放入第一排，或放入满足条件的蓝色科技下方。";
    }

    const choiceButtons = choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "data-place-option-button";
      button.dataset.placeTarget = choice.target;
      if (choice.blueSlot != null) {
        button.dataset.blueSlot = String(choice.blueSlot);
      }
      button.innerHTML = `${choice.label}<small>${choice.description}</small>`;
      return button;
    });
    if (options.allowSkip) {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "data-place-option-button";
      skip.dataset.placeSkip = "true";
      skip.innerHTML = `${options.skipLabel || "跳过"}<small>${options.skipDescription || "不获得本次数据"}</small>`;
      choiceButtons.push(skip);
    }

    els.dataPlaceActions.replaceChildren(...choiceButtons);

    els.dataPlaceOverlay.hidden = false;
  }

  function openAutoDataPlacementPrompt(effect, player, options = {}) {
    const check = getAutoDataPlacementCheck(player);
    if (!check.ok) return check;
    const beforePlayerState = structuredClone(player);
    const beforeCardState = structuredClone(cardState);
    const pendingAction = {
      type: "auto_data_place_before_gain",
      effect,
      playerId: player?.id || null,
      playerColor: player?.color || null,
      beforePlayerState,
      beforeCardState,
      messages: [],
      restoreRecorded: false,
      onAfterPlacement: options.onAfterPlacement,
      onSkip: options.onSkip,
    };
    openDataPlacePicker({
      player,
      forcePrompt: true,
      allowSkip: true,
      skipLabel: options.skipLabel || "跳过获得数据",
      skipDescription: options.skipDescription || "不放置数据，也不获得这次数据",
      subtitle: options.subtitle
        || "可先放置 1 个数据空出数据池位置，再获得本次数据；也可以跳过本次数据获得。",
      pendingAction,
    });
    rocketState.statusNote = options.statusNote || "数据池已满：请先放置数据，或跳过本次数据获得";
    renderStateReadout();
    return { ok: true, awaitingDataPlacement: true, message: rocketState.statusNote };
  }

  function getPendingDataPlacementPlayer(pending = pendingState.dataPlaceAction) {
    return getPendingOwnerPlayer(pending, pending?.effect || null);
  }

  function ensurePendingDataPlacementEffectStep(pending, player) {
    if (!pending?.effect) return;
    if (!uiRuntimeState.effectStepActive) beginEffectHistoryStep(pending.effect.label);
    if (!pending.restoreRecorded) {
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        player,
        pending.beforePlayerState,
        "恢复自动放置数据前玩家状态",
      ));
      pending.restoreRecorded = true;
    }
  }

  function applyAutoDataPlacementSlotBonuses(player, placeResult, pending) {
    const bonuses = getPlaceDataSlotBonuses(placeResult);
    const messages = [];
    for (const bonus of bonuses) {
      if (bonus.type === "income") {
        const incomeStart = beginDiscardSelection(1, {
          type: "place_data_income",
          player,
          beforePlayerState: pending.beforePlayerState,
          beforeCardState: pending.beforeCardState,
          effectLabel: pending.effect?.label || "自动放置数据",
          fromEffectFlow: true,
          autoDataPlacement: true,
        });
        if (!incomeStart.ok) {
          messages.push(incomeStart.message);
          continue;
        }
        pending.messages.push(...messages);
        return { ok: true, pendingIncome: true, messages };
      }

      if (bonus.type === "choose_card") {
        const selectionStart = beginCardSelection({
          type: "place_data_choose_card",
          player,
          beforePlayerState: pending.beforePlayerState,
          beforeCardState: pending.beforeCardState,
          fromEffectFlow: true,
          autoDataPlacement: true,
        });
        if (!selectionStart.ok) {
          messages.push(selectionStart.message);
          continue;
        }
        pending.messages.push(...messages);
        return { ok: true, pendingCardSelection: true, messages };
      }

      if (bonus.type === "publicity") {
        players.gainResources(player, { publicity: bonus.publicity });
        messages.push(`获得 ${bonus.publicity} 宣传`);
      } else if (bonus.type === "score") {
        players.gainResources(player, { score: bonus.score });
        addPlayerScoreSource(player, SCORE_SOURCE_KEYS.BLUE_TECH, bonus.score);
        messages.push(`获得 ${bonus.score} 分`);
      } else if (bonus.type === "credits") {
        players.gainResources(player, { credits: bonus.credits });
        messages.push(`获得 ${bonus.credits} 信用点`);
      } else if (bonus.type === "energy") {
        players.gainResources(player, { energy: bonus.energy });
        messages.push(`获得 ${bonus.energy} 能量`);
      }
    }
    return { ok: true, pendingIncome: false, pendingCardSelection: false, messages };
  }

  function continuePendingDataPlacementAfterBonus(message = null) {
    const pending = pendingState.dataPlaceAction;
    if (!pending) return null;
    if (message) pending.messages.push(message);
    pendingState.dataPlaceAction = null;
    if (typeof pending.onAfterPlacement === "function") {
      return pending.onAfterPlacement({
        messages: pending.messages.filter(Boolean),
        restoreRecorded: pending.restoreRecorded,
        beforePlayerState: pending.beforePlayerState,
      });
    }
    return null;
  }

  function confirmPendingDataPlacement(target, blueSlot) {
    const pending = pendingState.dataPlaceAction;
    const player = getPendingDataPlacementPlayer(pending);
    closeDataPlacePicker({ keepPending: true });
    return withPendingOwnerPlayer(pending, () => {
    ensurePendingDataPlacementEffectStep(pending, player);

    const result = abilities.executeAbility("placeData", createActionContext(), {
      target,
      blueSlot,
    });
    if (!result.ok) {
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    pending.messages.push(result.message);
    const bonusResult = applyAutoDataPlacementSlotBonuses(player, result, pending);
    if (bonusResult.pendingIncome || bonusResult.pendingCardSelection) {
      rocketState.statusNote = bonusResult.pendingIncome
        ? `${result.message}，请选择 1 张手牌获得收入`
        : `${result.message}，请选择 1 张公共牌`;
      renderPlayerStats();
      renderStateReadout();
      return result;
    }
    pending.messages.push(...(bonusResult.messages || []));
    renderPlayerStats();
    renderInitialSelectionArea();
    return continuePendingDataPlacementAfterBonus();
    });
  }

  function skipPendingDataPlacement() {
    const pending = pendingState.dataPlaceAction;
    if (!pending) {
      closeDataPlacePicker();
      return null;
    }
    closeDataPlacePicker({ keepPending: true });
    pendingState.dataPlaceAction = null;
    if (typeof pending.onSkip === "function") {
      return pending.onSkip({
        beforePlayerState: pending.beforePlayerState,
      });
    }
    return null;
  }

  function cancelDataPlacePicker() {
    if (pendingState.dataPlaceAction) return skipPendingDataPlacement();
    closeDataPlacePicker();
    rocketState.statusNote = "已取消放置数据";
    renderStateReadout();
    return { ok: true, canceled: true };
  }

  function confirmDataPlacement(target, blueSlot) {
    if (pendingState.dataPlaceAction) {
      return confirmPendingDataPlacement(target, blueSlot);
    }
    closeDataPlacePicker();
    const blocked = blockIncompatiblePendingQuickAction("place-data");
    if (blocked) return blocked;
    const player = getCurrentPlayer();
    const result = abilities.executeAbility("placeData", createActionContext(), {
      target,
      blueSlot,
    });
    rocketState.statusNote = result.message;
    if (result.ok) {
      const bonusResult = recordPlaceDataActionHistory(player, result);
      if (bonusResult?.message && !bonusResult.pendingIncome) {
        rocketState.statusNote = `${result.message}（${bonusResult.message}）`;
      } else if (bonusResult?.pendingIncome) {
        rocketState.statusNote = `${result.message}，请选择 1 张手牌获得收入`;
      } else if (bonusResult?.ok === false && bonusResult.message) {
        rocketState.statusNote = `${result.message}（${bonusResult.message}）`;
      }
    }
    renderPlayerStats();
    updateActionButtons();
    renderStateReadout();
    return result;
  }

  function updateQuickPanel() {
    if (!isQuickPanelOpen()) return;
    updateQuickTradeButtons();
  }

  function runPlaceDataToComputer() {
    const blocked = blockIncompatiblePendingQuickAction("place-data");
    if (blocked) return blocked;

    const gameplayLockReason = getGameplayLockReason();
    if (gameplayLockReason) {
      rocketState.statusNote = gameplayLockReason;
      renderStateReadout();
      return { ok: false, message: gameplayLockReason };
    }

    if (isTechTilePickingActive()) {
      rocketState.statusNote = "请先完成科技选择";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isCardSelectionActive()) {
      rocketState.statusNote = "请先完成精选";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isDiscardSelectionActive()) {
      rocketState.statusNote = "请先完成弃牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isPlayCardSelectionActive()) {
      rocketState.statusNote = "请先完成打牌";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    if (isMovePaymentSelectionActive()) {
      rocketState.statusNote = "请先完成移动";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }

    openDataPlacePicker();
    return { ok: true };
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

  function startAnalyzeDataRewardFlow() {
    const currentPlayer = getCurrentPlayer();
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
      { actionType: "analyze", historySource: HISTORY_SOURCE_MAIN, consumesMainAction: true },
    );
  }

  function runQuickTrade(tradeId, options = {}) {
    const blocked = blockIncompatiblePendingQuickAction("quick-trade");
    if (blocked) return blocked;

    const gameplayLockReason = getGameplayLockReason();
    if (gameplayLockReason) {
      rocketState.statusNote = gameplayLockReason;
      renderStateReadout();
      return { ok: false, message: gameplayLockReason };
    }

    const player = getCurrentPlayer();
    const beforeState = historyCommands.captureTradeState(player, cardState);
    const result = quickTrades.executeTrade(tradeId, createActionContext());
    if (!result.ok) {
      rocketState.statusNote = result.message;
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return result;
    }

    if (result.awaitingDiscard) {
      if (pendingState.discardAction) {
        pendingState.discardAction.beforeTradeState = beforeState;
        if (
          options.preserveHandIndex !== null
          && options.preserveHandIndex !== undefined
          && options.preserveHandIndex !== ""
        ) {
          pendingState.discardAction.preserveHandIndex = Number(options.preserveHandIndex);
        }
        if (options.aiReason) {
          pendingState.discardAction.aiReason = options.aiReason;
        }
      }
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    if (result.awaitingCardSelection) {
      if (pendingState.cardSelectionAction) {
        pendingState.cardSelectionAction.beforeTradeState = beforeState;
        if (options.preferBlindDraw) {
          pendingState.cardSelectionAction.aiPreferBlindDraw = true;
        }
        if (options.aiReason) {
          pendingState.cardSelectionAction.aiReason = options.aiReason;
        }
      }
      rocketState.statusNote = result.message;
      renderStateReadout();
      return result;
    }

    recordQuickTradeCompletion(tradeId, player, beforeState);
    rocketState.statusNote = result.message;
    renderPlayerStats();
    renderPublicCards();
    updatePublicCardControls();
    updateActionButtons();
    renderStateReadout();
    return result;
  }

  function runAction(actionId, actionOptions) {
    return actionRuntimeController.runAction(actionId, actionOptions);
  }

  function getRocketCoordinateReadoutLines() {
    const activeRocket = rocketState.rockets.find((rocket) => rocket.id === rocketState.activeRocketId);
    const formatRocketLine = (rocket) => {
      const marker = rocket.id === rocketState.activeRocketId ? "*" : " ";
      const snapshot = createRocketSnapshot(rocket);
      const color = getRocketColorDefinition(rocket);
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
    const occupancy = rocketActions.getSectorOccupancy(rocketState);
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
      rocketState.statusNote ? `提示 ${rocketState.statusNote}` : "提示 无",
      "",
      "扇区占用",
      ...occupancyLines,
    ];
  }

  function getDefaultPlanetReferencePlacementLines() {
    const slots = planetReferenceLayout.listAllOrbitLandSlots();
    if (!slots.length) {
      return [
        "星球环绕/登陆槽位",
        "无",
      ];
    }

    const visibleMarkers = new Map();
    for (const planetId of planetReferenceLayout.PLANET_ORDER) {
      for (const marker of planetStats.getPlanetOrbitMarkers(planetStatsState, planetId)) {
        visibleMarkers.set(`${planetId}:orbit:${marker.sequence}`, marker);
      }
      for (const marker of planetStats.getPlanetLandingMarkers(planetStatsState, planetId)) {
        visibleMarkers.set(`${planetId}:land:${marker.sequence}`, marker);
      }
    }

    return [
      "星球环绕/登陆槽位",
      ...slots.map((slot) => {
        const reference = rocketActions.normalizePlanetsReferencePoint({
          x: slot.x,
          y: slot.y,
          width: PLANETS_REFERENCE_SIZE.width,
          height: PLANETS_REFERENCE_SIZE.height,
        });
        const angle = slot.angleOffsetDegrees == null ? "" : ` +${slot.angleOffsetDegrees}°`;
        const marker = visibleMarkers.get(`${slot.planetId}:${slot.kind}:${slot.sequence}`);
        const status = marker
          ? `已显示 ${players.getPlayerColorDefinition(marker.color).label}`
          : "未显示";
        return `${planetReferenceLayout.formatSlotLabel(slot)}${angle} ${formatPlanetsReferencePoint(reference)} ${status}`;
      }),
    ];
  }

  function getDefaultSatelliteReferencePlacementLines() {
    const satellites = planetReferenceLayout.SATELLITE_PLACEMENTS;
    if (!satellites.length) {
      return [
        "卫星登陆槽位",
        "无",
      ];
    }

    const landedMarkers = new Map();
    for (const planetId of planetReferenceLayout.PLANETS_WITH_SATELLITES) {
      for (const marker of planetStats.getSatelliteLandingMarkers(planetStatsState, planetId)) {
        landedMarkers.set(`${planetId}:${marker.satelliteId}`, marker);
      }
    }

    return [
      "卫星登陆槽位",
      ...satellites.map((satellite) => {
        const reference = rocketActions.normalizePlanetsReferencePoint({
          x: satellite.x,
          y: satellite.y,
          width: PLANETS_REFERENCE_SIZE.width,
          height: PLANETS_REFERENCE_SIZE.height,
        });
        const marker = landedMarkers.get(`${satellite.parentPlanetId}:${satellite.satelliteId}`);
        const status = marker
          ? `已显示 ${players.getPlayerColorDefinition(marker.color).label}`
          : "未显示";
        return `${planetReferenceLayout.formatSatelliteLabel(satellite)} ${formatPlanetsReferencePoint(reference)} ${status}`;
      }),
    ];
  }

  function closeLandTargetPicker() {
    pendingState.landTargetAction = null;
    if (!els.landTargetOverlay) return;
    els.landTargetOverlay.hidden = true;
    delete els.landTargetOverlay.dataset.planetId;
  }

  function cancelLandTargetPicker() {
    const pending = pendingState.landTargetAction;
    closeLandTargetPicker();
    if (typeof pending?.onCancel === "function") {
      pending.onCancel();
    }
  }

  function openLandTargetPicker(options) {
    if (!els.landTargetOverlay || !els.landTargetSelect) {
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

    pendingState.landTargetAction = typeof options.onConfirm === "function"
      ? {
        ...getPendingOwnerFields(options.effect || null, options.player || null),
        effect: options.effect || null,
        getOptions: options.getOptions,
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
      }
      : null;
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
    const pending = pendingState.landTargetAction;
    return withPendingOwnerPlayer(pending, () => {
    const choiceIndex = Number(els.landTargetSelect?.value);
    const options = typeof pending?.getOptions === "function"
      ? pending.getOptions()
      : abilities.planet.getLandOptions(createActionContext());
    if (!options.ok || !options.choices?.length) {
      closeLandTargetPicker();
      rocketState.statusNote = options.message || "登陆目标已失效";
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

  function launchRocketForCurrentPlayer() {
    runAction("launch");
  }

  function orbitForCurrentPlayer() {
    if (!canStartMainAction()) {
      rocketState.statusNote = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const context = createActionContext();
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
      rocketState.statusNote = normal.message;
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
        getOptions: () => abilities.planet.getOrbitOptions(createActionContext()),
        onConfirm: (choice) => runAction("orbit", { rocketId: choice.rocketId }),
      });
      rocketState.statusNote = "请选择环绕目标";
      renderStateReadout();
      return { ok: true, pendingChoice: true };
    }
    return runAction("orbit", { rocketId: normal.defaultRocketId });
  }

  function landForCurrentPlayer() {
    if (!canStartMainAction()) {
      rocketState.statusNote = getMainActionStartBlockReason() || "本回合已经开始或完成主要行动";
      renderStateReadout();
      return { ok: false, message: rocketState.statusNote };
    }
    const context = createActionContext();
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
      rocketState.statusNote = check.message;
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return { ok: false, message: check.message };
    }

    const options = check;
    if (!options.ok) {
      rocketState.statusNote = options.message;
      renderPlayerStats();
      updateActionButtons();
      renderStateReadout();
      return { ok: false, message: options.message };
    }

    if (options.needsChoice) {
      openLandTargetPicker({
        ...options,
        getOptions: () => abilities.planet.getLandOptions(createActionContext()),
        onConfirm: (choice) => runAction("land", { target: choice.target, rocketId: choice.rocketId }),
      });
      return { ok: true, pendingChoice: true, planetId: options.planet.planetId };
    }

    return runAction("land", { target: options.defaultTarget, rocketId: options.defaultRocketId });
  }

  function addDebugIncome() {
    return debugRuntimeController.addDebugIncome();
  }

  function executeIncomeForCurrentPlayer() {
    const currentPlayer = getCurrentPlayer();
    const result = applyIncomeResourcesForPlayer(currentPlayer, {
      label: "执行收入（调试，可能重复发放）",
    });
    rocketState.statusNote = result.message;
    renderPlayerStats();
    renderPublicCards();
    updatePublicCardControls();
    updateActionButtons();
    renderStateReadout();
    return result;
  }

  function addDebugData() {
    return debugRuntimeController.addDebugData();
  }

  function addDebugScore() {
    return debugRuntimeController.addDebugScore();
  }

  function addDebugCardByInput(input) {
    return debugRuntimeController.addDebugCardByInput(input);
  }

  function promptDebugGainCard() {
    return debugRuntimeController.promptDebugGainCard();
  }

  function ensureDebugPlayerCardZones(player) {
    if (!player) return;
    if (!player.resources || typeof player.resources !== "object") player.resources = {};
    if (!Array.isArray(player.hand)) player.hand = [];
    if (!Array.isArray(player.reservedCards)) player.reservedCards = [];
    player.resources.handSize = player.hand.length;
  }

  function getDebugAlienCardKey(card) {
    if (!card) return null;
    if (card.set && card.cardId) return `${card.set}:${card.cardId}`;
    if (card.cardId) return String(card.cardId);
    if (card.set && card.alienCardId != null) return `${card.set}:${card.alienCardId}`;
    return card.id ? String(card.id) : null;
  }

  function playerHasDebugAlienCard(player, card) {
    const key = getDebugAlienCardKey(card);
    if (!key) return false;
    return [...(player?.hand || []), ...(player?.reservedCards || [])]
      .some((existing) => getDebugAlienCardKey(existing) === key);
  }

  function createDebugAlienCardGrantSummary() {
    return {
      hand: 0,
      reserved: 0,
      specialReserved: 0,
      skipped: 0,
    };
  }

  function recordDebugAlienCardGrant(summary, result) {
    if (!summary || !result) return summary;
    if (result.duplicate) {
      summary.skipped += 1;
    } else if (result.location === "hand") {
      summary.hand += 1;
    } else if (result.location === "reserved") {
      summary.reserved += 1;
    } else if (result.location === "specialReserved") {
      summary.specialReserved += 1;
    }
    return summary;
  }

  function addDebugAlienCardToPlayer(player, card) {
    ensureDebugPlayerCardZones(player);
    if (!player || !card) return { added: false };
    if (playerHasDebugAlienCard(player, card)) {
      return { added: false, duplicate: true };
    }

    cards.addCardToHand(player, card);
    return { added: true, location: "hand" };
  }

  function getNextDebugAlienCardSequence(alienState, fallback) {
    if (!alienState || typeof alienState !== "object") return fallback;
    const sequence = Math.max(0, Math.round(Number(alienState.nextCardSequence) || 0));
    alienState.nextCardSequence = sequence + 1;
    return sequence;
  }

  function grantAllModuleAlienCardsForDebug(player, alienModule, alienState) {
    const summary = createDebugAlienCardGrantSummary();
    if (!alienModule?.CARD_DEFINITIONS?.length || !alienModule.createAlienCard) return summary;

    let fallbackSequence = 0;
    for (const definition of alienModule.CARD_DEFINITIONS) {
      const sequence = alienState
        ? getNextDebugAlienCardSequence(alienState, fallbackSequence)
        : fallbackSequence;
      fallbackSequence = sequence + 1;
      const card = alienModule.createAlienCard(definition.index, sequence);
      recordDebugAlienCardGrant(summary, addDebugAlienCardToPlayer(player, card));
    }
    return summary;
  }

  function createJiuzheDebugCard(definition) {
    return {
      index: definition.index,
      id: `jiuzhe-card-${definition.index}`,
      src: jiuzhe.getCardSrc(definition.index),
      threat: definition.threat || 0,
      score: definition.score || 0,
      condition: definition.condition || null,
      label: definition.label || `九折牌 ${definition.index}`,
      played: false,
    };
  }

  function grantAllJiuzheCardsForDebug(player) {
    const summary = createDebugAlienCardGrantSummary();
    if (!jiuzhe?.CARD_DEFINITIONS?.length || !player) return summary;

    const jiuzheState = jiuzhe.ensureJiuzheState(alienGameState);
    const playerJiuzheState = jiuzhe.getPlayerJiuzheState(alienGameState, player, true);
    if (!playerJiuzheState) return summary;

    if (!Array.isArray(playerJiuzheState.cards)) playerJiuzheState.cards = [];
    const existing = new Set(playerJiuzheState.cards.map((card) => Number(card.index)));
    for (const definition of jiuzhe.CARD_DEFINITIONS) {
      if (existing.has(Number(definition.index))) {
        summary.skipped += 1;
        continue;
      }
      playerJiuzheState.cards.push(createJiuzheDebugCard(definition));
      existing.add(Number(definition.index));
      summary.specialReserved += 1;
    }
    playerJiuzheState.cards.sort((left, right) => Number(left.index) - Number(right.index));
    jiuzheState.cardsDealt = true;
    return summary;
  }

  function grantAllFangzhouCardsForDebug(player) {
    const summary = createDebugAlienCardGrantSummary();
    if (!fangzhou?.createCard2Definition || !player) return summary;

    const playerKey = player.id || player.color || "player";
    const traceTypes = fangzhou.TRACE_TYPES || aliens.TRACE_TYPES || ["pink", "yellow", "blue"];
    for (const traceType of traceTypes) {
      for (let variant = 1; variant <= 4; variant += 1) {
        const card = {
          ...fangzhou.createCard2Definition(traceType, variant),
          id: `fangzhou-card2-debug-${playerKey}-${traceType}-${variant}`,
          faceUp: true,
          fangzhouCard2: true,
          fangzhouTraceType: traceType,
        };
        recordDebugAlienCardGrant(summary, addDebugAlienCardToPlayer(player, card));
      }
    }
    return summary;
  }

  function formatDebugAlienCardGrantSummary(summary) {
    if (!summary) return "";
    const parts = [];
    if (summary.hand) parts.push(`手牌+${summary.hand}`);
    if (summary.reserved) parts.push(`保留牌+${summary.reserved}`);
    if (summary.specialReserved) parts.push(`专属保留+${summary.specialReserved}`);
    if (summary.skipped) parts.push(`已存在${summary.skipped}`);
    return parts.length
      ? `；调试发牌：${parts.join("，")}`
      : "；调试发牌：该外星人牌已齐";
  }

  function revealJiuzheForDebug() {
    return debugRuntimeController.revealJiuzheForDebug();
  }

  function revealYichangdianForDebug() {
    return debugRuntimeController.revealYichangdianForDebug();
  }

  function revealFangzhouForDebug() {
    return debugRuntimeController.revealFangzhouForDebug();
  }

  function revealBanrenmaForDebug() {
    return debugRuntimeController.revealBanrenmaForDebug();
  }

  function revealChongForDebug() {
    return debugRuntimeController.revealChongForDebug();
  }

  function revealAmibaForDebug() {
    return debugRuntimeController.revealAmibaForDebug();
  }

  function logAomomoDebugCoordinates(alienSlotId = alienGameState.aomomo?.revealedSlotId || 1) {
    return debugRuntimeController.logAomomoDebugCoordinates(alienSlotId);
  }

  function revealAomomoForDebug() {
    return debugRuntimeController.revealAomomoForDebug();
  }

  function revealRunezuForDebug() {
    return debugRuntimeController.revealRunezuForDebug();
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
    return debugRuntimeController.fillNebulaDataBoard(options);
  }

  function fillDebugNebulaData() {
    return debugRuntimeController.fillDebugNebulaData();
  }

  function toggleSectorWinDebug() {
    return debugRuntimeController.toggleSectorWinDebug();
  }

  function renderSectorNebulaDataBoard() {
    return renderRuntime.renderSectorNebulaDataBoard();
  }

  function moveRocket(deltaX, deltaY, rocketId, options = {}) {
    if (isAiAutomationInputLocked() && options.automated !== true) {
      return blockManualAiAutomationInput("电脑玩家自动移动中");
    }
    const selectedRocketId = rocketId ?? uiRuntimeState.moveHighlightRocketId ?? rocketState.activeRocketId;
    if (!selectedRocketId) {
      rocketState.statusNote = "请先点击要移动的火箭";
      renderStateReadout();
      return { ok: false, rocket: null, message: rocketState.statusNote };
    }

    return beginMovePaymentSelection(deltaX, deltaY, selectedRocketId);
  }

  function executeMoveRocket(deltaX, deltaY, rocketId) {
    const selectedRocketId = rocketId ?? uiRuntimeState.moveHighlightRocketId ?? rocketState.activeRocketId;
    const result = rocketActions.moveRocket(rocketState, selectedRocketId, deltaX, deltaY);
    if (result.rocket) renderRocketElement(result.rocket);
    if (result.ok) {
      activateMoveMode(selectedRocketId);
    }
    updateActionButtons();
    renderStateReadout();
    return result;
  }

  function moveActiveRocket(deltaX, deltaY) {
    return moveRocket(deltaX, deltaY, rocketState.activeRocketId);
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

    const rocket = rocketState.rockets.find((item) => item.id === rocketId);
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
      pendingState.cardTriggerFreeMove
      || uiRuntimeState.industryFreeMoveState
      || pendingState.cardCornerFreeMove
      || pendingState.actionEffectFlow?.freeMoveMode
      || pendingState.actionEffectFlow?.cardMoveEffect
    ) return;
    deactivateMoveMode();
    renderStateReadout();
  }

  function stepsToTransform(steps) {
    const rotation = steps * (Math.PI / 4);
    return `rotate(${rotation}rad)`;
  }

  function renderWheels() {
    return renderRuntime.renderWheels();
  }

  function renderSectors() {
    return renderRuntime.renderSectors();
  }

  function renderStateReadout() {
    return renderRuntime.renderStateReadout();
  }

  function formatNamedCoordinates(items) {
    if (!items.length) return "无";
    return items.map((item) => {
      const label = item.kind === solar.layout.CONTENT_KIND.PLANET ? `${item.label}` : "";
      return `${label}[${item.x},${item.y}]`;
    }).join("  ");
  }

  function formatVisibleCoordinateGroups(groups) {
    return [
      `可见星球坐标 ${formatNamedCoordinates(groups.planets)}`,
      `小行星坐标 ${formatNamedCoordinates(groups.asteroids)}`,
      `彗星坐标 ${formatNamedCoordinates(groups.comets)}`,
    ].join("\n");
  }

  /** 官网 randomizeWheels 的无动画版：直接累加步数并渲染 */
  function randomizeWheels() {
    for (let w = 1; w <= 4; w += 1) {
      const delta = Math.floor(Math.random() * 8 + WHEEL_OFFSETS[w]);
      solarState.wheelSteps[w] -= delta;
    }
    solarState.rotation = solar.normalizeRotationState(solarState.wheelSteps, 0);
    renderWheels();
  }

  /** 官网 randomizeSectors 逻辑：将 4 个扇区洗牌分配到 4 个外边槽位 */
  function randomizeSectors() {
    const pool = [1, 2, 3, 4];
    while (pool.length) {
      const slotId = pool.length;
      const pickIndex = Math.floor(Math.random() * pool.length);
      const sectorId = pool.splice(pickIndex, 1)[0];
      solarState.sectorBySlot[slotId] = sectorId;
    }
    renderSectors();
  }

  /** 终局计分：a/b/c/d 各自独立随机 1 或 2 */
  function randomizeFinalScores() {
    finalScoring.randomizeTileVariants(finalScoringState, FINAL_SCORE_IDS);
    els.finalScoreTiles.forEach((img) => {
      const id = img.dataset.finalId;
      if (!id) return;
      const variant = finalScoring.getTileVariant(finalScoringState, id);
      img.src = `../assets/final/final_${id}${variant}.png`;
      img.alt = `终局计分 ${id.toUpperCase()}${variant}`;
    });
  }

  function getSetupState() {
    return solar.createSetupState(solarState);
  }

  function getRotateStateSlotIndex(rotationCount) {
    return ((Number(rotationCount) % ROTATE_STATE_SLOTS.length) + ROTATE_STATE_SLOTS.length) % ROTATE_STATE_SLOTS.length;
  }

  function renderRotateStateToken() {
    return renderRuntime.renderRotateStateToken();
  }

  function rotateSolarOrbit(count) {
    const iterations = Math.max(1, Math.round(Number(count || 1)));
    const rotationSettlements = [];
    const anomalyTriggers = [];
    const events = [];

    for (let index = 0; index < iterations; index += 1) {
      const beforeRotation = structuredClone(solarState.rotation);
      solarState.rotation = solar.applySolarOrbitRotation(solarState.rotation, 1);
      solarState.wheelSteps = solar.rotationToWheelSteps(solarState.rotation);
      const settlement = abilities.rocket.settleRocketsAfterSolarRotation(
        { solarState, playerState, rocketState },
        beforeRotation,
        solarState.rotation,
      );
      if (settlement) {
        rotationSettlements.push(settlement);
        events.push(...(settlement.events || []));
      }
      const earth = getEarthSectorCoordinate();
      const anomalyResult = triggerYichangdianAnomalyForEarthX(earth.x);
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
        beginScanAction();
        break;
      case "action-analyze-button":
        analyzeDataForCurrentPlayer();
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
    playerState,
    turnState,
    rocketState,
    techGameState,
    nebulaDataState,
    alienGameState,
    solarState,
    solar,
    cardState,
    pendingState,
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
    renderReservedCardsFromTaskState: (...args) => renderReservedCardsFromTaskState(...args),
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
  const focusDebugCalibration = debugRuntimeController.createFocusDebugCalibrationHandler();

  const appEventState = {
    get pendingChongTaskCompletion() { return pendingState.chongTaskCompletion; },
    get pendingChongFossilChoice() { return pendingState.chongFossilChoice; },
    get pendingChongCardGain() { return pendingState.chongCardGain; },
    get pendingAmibaTraceRemoval() { return pendingState.amibaTraceRemoval; },
    get pendingAmibaSymbolChoice() { return pendingState.amibaSymbolChoice; },
    get pendingAmibaCardGain() { return pendingState.amibaCardGain; },
    get pendingAomomoCardGain() { return pendingState.aomomoCardGain; },
    get pendingRunezuFaceSymbolPlacement() { return pendingState.runezuFaceSymbolPlacement; },
    get pendingRunezuSymbolBranch() { return pendingState.runezuSymbolBranch; },
    get pendingRunezuCardGain() { return pendingState.runezuCardGain; },
    get pendingBanrenmaCardGain() { return pendingState.banrenmaCardGain; },
    get pendingBanrenmaOpportunity() { return pendingState.banrenmaOpportunity; },
    get pendingYichangdianCardGain() { return pendingState.yichangdianCardGain; },
    get pendingJiuzheCardPlay() { return pendingState.jiuzheCardPlay; },
    get pendingStrategyPassiveSlotChoice() { return pendingState.strategyPassiveSlotChoice; },
    get alienTracePickerState() { return pendingState.alienTracePickerState; },
    set alienTracePickerState(value) { pendingState.alienTracePickerState = value; },
    get pendingAlienRevealConfirmation() { return pendingState.alienRevealConfirmation; },
    get moveHighlightRocketId() { return uiRuntimeState.moveHighlightRocketId; },
    get pendingCardTriggerFreeMove() { return pendingState.cardTriggerFreeMove; },
    get industryFreeMoveState() { return uiRuntimeState.industryFreeMoveState; },
    get pendingCardCornerFreeMove() { return pendingState.cardCornerFreeMove; },
    get pendingActionEffectFlow() { return pendingState.actionEffectFlow; },
    get pendingScanTargetAction() { return pendingState.scanTargetAction; },
  };

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
    rocketState,
    techGameState,
    techRenderContext,
    alienGameState,
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
    handleChongTaskCompletionChoice,
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
    confirmPlayCardSelection,
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
  players.setScoreGainListener?.((player, payload) => {
    handlePlayerScoreChanged(player, payload);
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
      solarState,
      alienGameState,
      finalScoringState,
      playerState,
      turnState,
      rocketState,
      planetStatsState,
      techGameState,
      cardState,
      actionHistory,
      setupSelectionState,
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
      startInitialSelection,
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
      runQuickTrade,
      toggleQuickPanel,
      moveRocket,
      moveActiveRocket,
      getBoardPointFromClientPosition,
      getPolarPointFromClientPosition,
      createRocketSnapshot,
      buildPlanetOrbitLandReferenceData,
      syncPlanetOrbitLandMarkers,
      createActionContext,
      getPlanetsReferencePointFromClientPosition,
      getPlanetsReferenceDimensions,
      renderRocketElement,
      updateActionButtons,
      getRoundOrderPlayerIds,
      getRecoverableActionLog,
      createActionLogRecoveryPackage,
      getActionLogMarkdown,
      downloadActionLogMarkdown,
      createGameRecoverySnapshot,
      applyGameRecoverySnapshot,
      recoverFromActionLog,
      getSetupState,
      toggleCheatMode,
      researchTechForCurrentPlayer,
      finalizeTechTakeResult,
    },
  });
})();

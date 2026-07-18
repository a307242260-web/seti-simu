(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAiController = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function createAiController(context) {
    if (!context || !context.state) {
      throw new Error("createAiController requires app context and state accessors");
    }

    const {
      window: windowRef = root,
      state,
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
      aiBattleLogModule,
      aiTuningHistoryModule,
      aiBattleReportModule,
      aiExperimentRunnerModule,
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
      canBlindDraw,
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
      confirmInitialSelectionForCurrentPlayer,
      confirmAlienRevealNotice,
      confirmLandTargetPicker,
      confirmMovePayment,
      confirmPassReserveSelection,
      confirmPlayCardSelection,
      confirmProbeSectorScanSelection,
      confirmPublicScanSelection,
      confirmScanTarget,
      confirmStrategyPassiveSlotChoice,
      confirmTechBlueSlotChoice,
      createActionContext,
      createTurnState,
      drawCardForCurrentPlayer,
      dispatchRuntimeAction,
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
      getCardPlayCost,
      getCardPrice,
      getCardTypeCode,
      getCurrentActionEffect,
      getCurrentPlayer,
      getEarthSectorCoordinate,
      getEffectOwnerPlayer,
      getInitialSelectionOffer,
      getMovableTokensForPlayer,
      getPassReserveSelectionCards,
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
      cancelCardTriggerChoice,
      handleChongCardGainChoice,
      handleChongFossilChoice,
      handleChongTaskCompletionChoice,
      handleConditionalSectorChoice,
      handleCompanyActionMarkerClick,
      handleDiscardCornerRepeatChoice,
      handleDiscardIncomeCardChoice,
      handleHandCardCornerQuickAction,
      handleHandCornerChoice,
      handleHandScanCardClick,
      handleJiuzheCardChoice,
      handleJiuzheOpportunitySkip,
      handleOptionalHandScanChoice,
      handlePayCreditChoice,
      handlePlayCardSelect,
      handleProbeLocationRewardChoice,
      handleProbeSectorScanChoice,
      handlePublicCornerDiscardCardClick,
      handlePublicCardClick,
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
      isUiBlockingAiAutomation = () => false,
      isTechTileOwnedByOtherPlayer,
      isTechTilePickingActive,
      landForCurrentPlayer,
      moveRocket,
      orbitForCurrentPlayer,
      openBanrenmaReadyOpportunityForPlayer,
      openCardTaskCompletionPicker,
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
      selectPassReserveCard,
      sectorXHasAvailableScanTarget,
      setTurnStatePlayerOrder,
      skipCurrentActionEffect,
      startInitialSelection,
      updateActionButtons,
    } = context;

    const AI_STRATEGY_TUNING_HISTORY_STORAGE_KEY = "seti-ai-strategy-tuning-history-v1";
    const AI_MAX_CARD_CORNER_MOVES_PER_TURN = 1;
    const AI_MOVE_DIRECTIONS = Object.freeze([
      Object.freeze({ id: "out", label: "向外", deltaX: 0, deltaY: 1, score: 5 }),
      Object.freeze({ id: "cw", label: "顺时针", deltaX: 1, deltaY: 0, score: 2 }),
      Object.freeze({ id: "ccw", label: "逆时针", deltaX: -1, deltaY: 0, score: 1 }),
      Object.freeze({ id: "in", label: "向内", deltaX: 0, deltaY: -1, score: -1 }),
    ]);
    const AI_RESOURCE_VALUES = Object.freeze({
      score: 1,
      credits: 4.5,
      energy: 4.2,
      handSize: 4.3,
      availableData: 1.5,
      movement: 1.5,
      publicity: 1.5,
      additionalPublicScan: 1.5,
      aomomoFossils: 4,
    });
    const AI_SCAN_COLORS = Object.freeze(["yellow", "red", "blue", "black"]);
    const AI_TECH_TYPES = Object.freeze(["orange", "purple", "blue"]);
    const AI_TRACE_TYPES = Object.freeze(["yellow", "pink", "blue"]);
    const AI_FANGZHOU_CARD2_REWARD_EFFECT_TYPE = "fangzhou_card2_advanced_reward";
    const AI_INCOME_DISCARD_TYPES = new Set([
      "income",
      "initial_income",
      "planet_reward_income",
      "place_data_income",
      "industry_helios_income",
      "discard_any_income",
    ]);
    const AI_PLANET_OPTIMAL_MOVE_RANGES = Object.freeze({
      mercury: Object.freeze([3, 4]),
      venus: Object.freeze([2, 2]),
      mars: Object.freeze([1, 2]),
      jupiter: Object.freeze([2, 3]),
      saturn: Object.freeze([2, 3]),
      uranus: Object.freeze([3, 4]),
      neptune: Object.freeze([3, 4]),
    });
    const AI_CHEAT_LAB_INDUSTRY_LABEL = "作弊实验室";
    const AI_CHEAT_LAB_INDUSTRY_ID = "industry:作弊实验室";
    const AI_CHEAT_LAB_INDUSTRY_SRC = "../assets/industry/异星实验室.png";
    const AI_HUANYU_SUPERDRIVE_INDUSTRY_LABEL = "寰宇超动力";
    const AI_HUANYU_SUPERDRIVE_INDUSTRY_ID = "industry:寰宇超动力";
    const AI_HUANYU_SUPERDRIVE_INDUSTRY_SRC = "../assets/industry/寰宇动力.png";
    const AI_GRAND_STRATEGY_INDUSTRY_LABEL = "宇宙大战略集团";
    const AI_GRAND_STRATEGY_INDUSTRY_ID = "industry:宇宙大战略集团";
    const AI_GRAND_STRATEGY_INDUSTRY_SRC = "../assets/industry/宇宙战略集团.png";
    const AI_STYLE_IDS = Object.freeze(["scanner", "route", "task", "tech", "balanced"]);
    const AI_STYLE_SEAT_ORDER = Object.freeze(["route", "scanner", "task", "tech", "balanced"]);

    const resolvedAiControlRuntimeModule = aiControlRuntimeModule
      || root.SetiAppAiControlRuntime
      || (typeof require === "function" ? require("./ai/control-runtime") : null);
    if (!resolvedAiControlRuntimeModule?.createAiControlRuntime) {
      throw new Error("createAiController requires SetiAppAiControlRuntime");
    }
    const aiControlRuntime = resolvedAiControlRuntimeModule.createAiControlRuntime({
      window: windowRef,
      state,
      playerState,
      turnState,
      rocketState,
      DEFAULT_ACTIVE_PLAYER_COUNT,
      DEFAULT_INITIAL_PLAYER_COLOR,
      getCurrentActionEffect,
      getCurrentPlayer,
      getEffectOwnerPlayer,
      getPlayerByColor,
      getPlayerById,
      getPlayerLabelById,
      isGameEnded,
      isUiBlockingAiAutomation,
      isIndustryHandSelectionActive,
      recordAiAutoBattleLog: (...args) => recordAiAutoBattleLog(...args),
      recordAiAutoBattleBug: (...args) => recordAiAutoBattleBug(...args),
      renderStateReadout,
      runAiAutomationStep: (...args) => runAiAutomationStep(...args),
      resetGameForAiAutoBattle: (...args) => resetGameForAiAutoBattle(...args),
      resetAiStrategyDemandCache: (...args) => resetAiStrategyDemandCache(...args),
      setTurnStatePlayerOrder,
      startInitialSelection,
      updateActionButtons,
    });
    const {
      AI_DIFFICULTY_WEAK_START,
      aiAutoBattleState,
      applyAiDifficultyToPlayer,
      configureAiAutoBattle,
      configureAiStrategyWeights,
      configureDefaultAiOpponent,
      createAiControlSnapshot,
      getAiAutoBattlePlayerIds,
      getAiDifficultyLabel,
      getAiStrategyWeight,
      getAiStrategyWeightDefaultsForDifficulty,
      getAiStrategyWeights,
      getConfiguredAiStrategyWeights,
      getPendingOwnerPlayer,
      isAiAutomationPaused,
      isAiAutoBattlePlayer,
      normalizeAiDifficulty,
      normalizeAiStrategyWeights,
      resetAiStrategyWeights,
      restoreAiControlSnapshot,
      runWithAiRandomSeed,
      getAiBatchSeed,
      scheduleAiAutoStepIfNeeded,
      usesDifficultyDefaultStrategyWeights,
   } = aiControlRuntime;

    const resolvedAiResourceValuationModule = root.SetiAIResourceValuation
      || (typeof require === "function" ? require("../game/ai/resource-valuation") : null);
    const resolvedAiAlienValuationModule = root.SetiAIAlienValuation
      || (typeof require === "function" ? require("../game/ai/alien-valuation") : null);
    const resolvedAiFinalPaceModule = root.SetiAIFinalPace
      || (typeof require === "function" ? require("../game/ai/final-pace") : null);
    const resolvedAiTradeCandidatesModule = root.SetiAITradeCandidates
      || (typeof require === "function" ? require("../game/ai/trade-candidates") : null);
    const resolvedAiActionValueModule = root.SetiAIActionValue
      || (typeof require === "function" ? require("../game/ai/action-value") : null);
    const resolvedAiDemandCardModule = root.SetiAIDemandCard
      || (typeof require === "function" ? require("../game/ai/demand-card") : null);
    const resolvedAiRoutePlanetModule = root.SetiAIRoutePlanet
      || (typeof require === "function" ? require("../game/ai/route-planet") : null);
    const resolvedAiTechActionModule = root.SetiAITechAction
      || (typeof require === "function" ? require("../game/ai/tech-action") : null);
    const resolvedAiScanValueModule = root.SetiAIScanValue
      || (typeof require === "function" ? require("../game/ai/scan-value") : null);
    const resolvedAiCardCandidatesModule = root.SetiAICardCandidates
      || (typeof require === "function" ? require("../game/ai/card-candidates") : null);
    const resolvedAiStateSummaryModule = root.SetiAIStateSummary
      || (typeof require === "function" ? require("../game/ai/state-summary") : null);
    const resolvedAiIncomeCardModule = root.SetiAIIncomeCard
      || (typeof require === "function" ? require("../game/ai/income-card") : null);
    const resolvedAiMovementIndustryDataModule = root.SetiAIMovementIndustryData
      || (typeof require === "function" ? require("../game/ai/movement-industry-data") : null);
    const resolvedAiAlienChoiceValueModule = root.SetiAIAlienChoiceValue
      || (typeof require === "function" ? require("../game/ai/alien-choice-value") : null);
    const resolvedAiTechCandidatesModule = root.SetiAITechCandidates
      || (typeof require === "function" ? require("../game/ai/tech-candidates") : null);
    const resolvedAiSelectionPressureModule = root.SetiAISelectionPressure
      || (typeof require === "function" ? require("../game/ai/selection-pressure") : null);
    if (
      !resolvedAiResourceValuationModule?.createResourceValuation
      || !resolvedAiAlienValuationModule?.createAlienValuation
      || !resolvedAiFinalPaceModule?.createFinalPace
      || !resolvedAiTradeCandidatesModule?.createTradeCandidates
      || !resolvedAiActionValueModule?.createActionValue
      || !resolvedAiDemandCardModule?.createDemandCard
      || !resolvedAiRoutePlanetModule?.createRoutePlanet
      || !resolvedAiTechActionModule?.createTechAction
      || !resolvedAiScanValueModule?.createScanValue
      || !resolvedAiCardCandidatesModule?.createCardCandidates
      || !resolvedAiStateSummaryModule?.createStateSummary
      || !resolvedAiIncomeCardModule?.createIncomeCard
      || !resolvedAiMovementIndustryDataModule?.createMovementIndustryData
      || !resolvedAiAlienChoiceValueModule?.createAlienChoiceValue
      || !resolvedAiTechCandidatesModule?.createTechCandidates
      || !resolvedAiSelectionPressureModule?.createSelectionPressure
    ) {
      throw new Error("createAiController requires game AI domain modules");
    }
    const aiDomainBindings = {
      ...context,
      ...aiControlRuntime,
      root,
      windowRef,
      AI_STRATEGY_TUNING_HISTORY_STORAGE_KEY,
      AI_MAX_CARD_CORNER_MOVES_PER_TURN,
      AI_MOVE_DIRECTIONS,
      AI_RESOURCE_VALUES,
      AI_SCAN_COLORS,
      AI_TECH_TYPES,
      AI_TRACE_TYPES,
      AI_FANGZHOU_CARD2_REWARD_EFFECT_TYPE,
      AI_INCOME_DISCARD_TYPES,
      AI_PLANET_OPTIMAL_MOVE_RANGES,
      AI_CHEAT_LAB_INDUSTRY_LABEL,
      AI_CHEAT_LAB_INDUSTRY_ID,
      AI_CHEAT_LAB_INDUSTRY_SRC,
      AI_HUANYU_SUPERDRIVE_INDUSTRY_LABEL,
      AI_HUANYU_SUPERDRIVE_INDUSTRY_ID,
      AI_HUANYU_SUPERDRIVE_INDUSTRY_SRC,
      AI_GRAND_STRATEGY_INDUSTRY_LABEL,
      AI_GRAND_STRATEGY_INDUSTRY_ID,
      AI_GRAND_STRATEGY_INDUSTRY_SRC,
      AI_STYLE_IDS,
      AI_STYLE_SEAT_ORDER,
    };
    const aiResourceValuation = resolvedAiResourceValuationModule.createResourceValuation(aiDomainBindings);
    const aiAlienValuation = resolvedAiAlienValuationModule.createAlienValuation(aiDomainBindings);
    const aiFinalPace = resolvedAiFinalPaceModule.createFinalPace(aiDomainBindings);
    const aiTradeCandidates = resolvedAiTradeCandidatesModule.createTradeCandidates(aiDomainBindings);
    const aiActionValue = resolvedAiActionValueModule.createActionValue(aiDomainBindings);
    const aiDemandCard = resolvedAiDemandCardModule.createDemandCard(aiDomainBindings);
    const aiRoutePlanet = resolvedAiRoutePlanetModule.createRoutePlanet(aiDomainBindings);
    const aiTechAction = resolvedAiTechActionModule.createTechAction(aiDomainBindings);
    const aiScanValue = resolvedAiScanValueModule.createScanValue(aiDomainBindings);
    const aiCardCandidates = resolvedAiCardCandidatesModule.createCardCandidates(aiDomainBindings);
    const aiStateSummary = resolvedAiStateSummaryModule.createStateSummary(aiDomainBindings);
    const aiIncomeCard = resolvedAiIncomeCardModule.createIncomeCard(aiDomainBindings);
    const aiMovementIndustryData = resolvedAiMovementIndustryDataModule.createMovementIndustryData(aiDomainBindings);
    const aiAlienChoiceValue = resolvedAiAlienChoiceValueModule.createAlienChoiceValue(aiDomainBindings);
    const aiTechCandidates = resolvedAiTechCandidatesModule.createTechCandidates(aiDomainBindings);
    const aiSelectionPressure = resolvedAiSelectionPressureModule.createSelectionPressure(aiDomainBindings);
    const {
      countAiPlayerTech,
      getAiPlayerTechTypeCounts,
      getAiProbePlanetIds,
      getAiTaskConditionCurrentCount,
      summarizeAiTaskCondition,
      summarizeAiResultCardTask,
      summarizeAiResultCard,
      summarizeAiResultCards,
      isAiIncomeDiscardType,
      getPlayerAgentLabel,
      getAiIncomeDiscardPreview,
      getAiIncomeDiscardHandScarcityCost,
      scoreAiIncomeDiscardOptionNet,
      scoreAiIncomeDiscardSelectionOpportunityCost,
      scoreAiIncomePlacementRewardValue,
      chooseAiTradeDiscardIndexes,
      shouldAiUseRouteAwareIncomeDiscard,
      chooseAiIncomeDiscardIndexes,
      scoreAiMultiIncomeSequenceFit,
      scoreAiIncomeDiscardRouteEnergyFit,
      scoreAiIncomeDiscardFinalFormulaFit,
      getAiPassReserveResourcePressure,
      isAiPassReservePreviewIncomeCandidate,
      countAiType3CardsForPlayer,
      hasAiRunezuPassReservePressure,
      scoreAiC2Type3ProgressValue,
      scoreAiCFinalTaskProgressValue,
      getAiC2Type3BaseDelta,
      getAiPlayCardFinalFormulaDeltas,
      scoreAiFinalRoundEndGameCardUrgency,
      scoreAiPassReserveCard,
      scoreAiFinalRoundUnreachablePublicPickPenalty,
      getAiImmediateIncomeRewardGain,
      scoreAiImmediateIncomeRewardValue,
      scoreAiPublicPickCard,
      summarizeAiPublicPickCandidate,
      getAiPublicPickConcreteProfile,
      scoreAiDeepspaceHandSwapCost,
      scoreAiDeepspaceSwapPair,
      listAiDeepspaceSwapPairs,
      getAiBestDeepspaceSwap,
      buildAiMoveCandidate,
      listAiMoveCandidates,
      getAiIndustryCard,
      getAiIndustryPublicPickProfile,
      scoreAiIndustryPublicPick,
      summarizeAiStrategyPassiveSlots,
      scoreAiEarlyEmptyStrategyPickPenalty,
      listAiCardCornerMoveCandidatesForReward,
      scoreAiIndustryCornerReward,
      scoreAiIndustryStratusCorners,
      scoreAiIndustryTuringBorrow,
      listAiIndustryHuanyuMoveCandidates,
      scoreAiIndustryHuanyuMoves,
      scoreAiIndustrySentinelArm,
      scoreAiIndustryDeepspaceSwap,
      buildAiIndustryCandidate,
      scoreAiSecondMarkAnalyzeReloadDataValue,
      getAiFinalHighScoreDataCreditPreserveProfile,
      scoreAiFinalHighScoreDataCreditPreserveValue,
      scoreAiDataPlacementChoice,
      listAiDataPlacementCandidates,
      chooseAiDataPlacementOptionFromButtons,
      getAiJiuzheCardDefinition,
      getAiJiuzheScoringContext,
      getAiOtherJiuzheThreats,
      getAiJiuzheThreatValuationContext,
      getAiFinalAnalyzeDirectScoreProtection,
      evaluateAiCardsForEnergyAnalyzeProtection,
      estimateAiJiuzheCardCompletionFactor,
      estimateAiJiuzheThreatPenalty,
      scoreAiJiuzheCardOption,
      enrichAiJiuzheCardOptions,
      scoreAiChongFossilUseOption,
      getAiEffectiveBanrenmaRewardGain,
      scoreAiBanrenmaDisplayedCardGainValue,
      scoreAiBanrenmaBonusUseOption,
      scoreAiBanrenmaConditionUseOption,
      scoreAiAmibaSymbolUseOption,
      scoreAiAmibaTraceRemovalUseOption,
      scoreAiRunezuFaceSymbolUseOption,
      scoreAiRunezuSymbolBranchUseOption,
      enrichAiAlienUseOptions,
      buildAiResearchTechCandidate,
      scoreAiBorrowedTechImmediateValue,
      buildAiBorrowTechCandidate,
      listAiBorrowTechCandidates,
      listAiResearchTechCandidates,
      getAiResearchTechCandidateExecutionCheck,
      selectExecutableAiResearchTechCandidate,
      isRawNegativeResourceCardCornerAction,
      countAiRepeatedNegativeResourceCardCornersThisTurn,
      shouldCapRepeatedNegativeResourceCardCorner,
      hasAiPassActionThisTurn,
      shouldCapPostPassNoCashoutCardCorner,
      getAiEarlyDirectScorePlayPassFloor,
      applyAiTurnActionSelectionPressure,
      buildAiResourceLockTradePreviews,
      buildAiPublicRefillTradePreview,
      buildAiEarlyNoMainPublicRefillDiagnostic,
      buildAiFinalLowHandPassRecoveryDiagnostic,
      buildAiFinalHighScorePassRecoveryDiagnostic,
    } = Object.assign(
      {},
      aiStateSummary,
      aiIncomeCard,
      aiMovementIndustryData,
      aiAlienChoiceValue,
      aiTechCandidates,
      aiSelectionPressure,
    );
    const aiRuleDomains = Object.freeze({
      ...aiResourceValuation,
      ...aiAlienValuation,
      ...aiFinalPace,
      ...aiTradeCandidates,
      ...aiActionValue,
      ...aiDemandCard,
      ...aiRoutePlanet,
      ...aiTechAction,
      ...aiScanValue,
      ...aiCardCandidates,
      ...aiStateSummary,
      ...aiIncomeCard,
      ...aiMovementIndustryData,
      ...aiAlienChoiceValue,
      ...aiTechCandidates,
      ...aiSelectionPressure,
    });
    Object.assign(aiDomainBindings, aiRuleDomains, {
      countAiPlayerTech,
      getAiPlayerTechTypeCounts,
      getAiProbePlanetIds,
      getAiTaskConditionCurrentCount,
      summarizeAiTaskCondition,
      summarizeAiResultCardTask,
      summarizeAiResultCard,
      summarizeAiResultCards,
      isAiIncomeDiscardType,
      getPlayerAgentLabel,
      resetGameForAiAutoBattle,
      getOrderedAiAutoBattlePlayerIds,
      getForcedAiIndustrySeatIndex,
      getForcedAiIndustryOffer,
      getAiStyleFallbackIndex,
      getAiSeatStyle,
      inferAiStyleFromOpening,
      createAiHuanyuSuperdriveIndustryCard,
      ensureAiHuanyuSuperdriveIndustryOffer,
      createAiGrandStrategyIndustryCard,
      ensureAiGrandStrategyIndustryOffer,
      chooseInitialSelectionForAiPlayer,
      createAiCheatLabIndustryCard,
      ensureAiCheatLabIndustryOffer,
      runAiDiscardDecision,
      getAiIncomeDiscardPreview,
      getAiIncomeDiscardHandScarcityCost,
      scoreAiIncomeDiscardOptionNet,
      scoreAiIncomeDiscardSelectionOpportunityCost,
      scoreAiIncomePlacementRewardValue,
      chooseAiTradeDiscardIndexes,
      shouldAiUseRouteAwareIncomeDiscard,
      chooseAiIncomeDiscardIndexes,
      scoreAiMultiIncomeSequenceFit,
      scoreAiIncomeDiscardRouteEnergyFit,
      scoreAiIncomeDiscardFinalFormulaFit,
      getAiPassReserveResourcePressure,
      isAiPassReservePreviewIncomeCandidate,
      countAiType3CardsForPlayer,
      hasAiRunezuPassReservePressure,
      scoreAiC2Type3ProgressValue,
      scoreAiCFinalTaskProgressValue,
      getAiC2Type3BaseDelta,
      getAiPlayCardFinalFormulaDeltas,
      scoreAiFinalRoundEndGameCardUrgency,
      scoreAiPassReserveCard,
      scoreAiFinalRoundUnreachablePublicPickPenalty,
      getAiImmediateIncomeRewardGain,
      scoreAiImmediateIncomeRewardValue,
      scoreAiPublicPickCard,
      summarizeAiPublicPickCandidate,
      getAiPublicPickConcreteProfile,
      scoreAiDeepspaceHandSwapCost,
      scoreAiDeepspaceSwapPair,
      listAiDeepspaceSwapPairs,
      getAiBestDeepspaceSwap,
      runAiCardSelectionDecision,
      runAiHandScanDecision,
      cardTriggerNeedsFreeMove,
      getCardTriggerFreeMoveEffect,
      listCardTriggerFreeMoveCandidates,
      getAiLaunchTriggerResolution,
      canAiResolveCardTriggerMatch,
      runAiCardTriggerDecision,
      runAiCardTriggerFreeMoveDecision,
      runAiCardTaskCompletionDecision,
      scoreAiReadyCardTask,
      runAiReadyCardTaskOpenDecision,
      getAiBanrenmaOpportunityPlayers,
      scoreAiBanrenmaTraceEffectValue,
      scoreAiExecutableBanrenmaEffects,
      scoreAiReadyBanrenmaCardOpportunity,
      listAiReadyBanrenmaCardOpportunities,
      openAiPreferredBanrenmaCardOpportunity,
      runAiReadyBanrenmaOpportunityOpenDecision,
      listAiRunezuFaceSymbolQuickCandidates,
      runAiRunezuFaceSymbolQuickActionDecision,
      runAiCardCornerQuickActionDecision,
      runAiPlayCardSelectionDecision,
      getAiMoveTurnKey,
      getAiMoveCountThisTurn,
      incrementAiMoveCountThisTurn,
      canAiMoveThisTurn,
      getAiCardCornerMoveCountThisTurn,
      incrementAiCardCornerMoveCountThisTurn,
      canAiUseCardCornerMoveThisTurn,
      buildAiMoveCandidate,
      listAiMoveCandidates,
      getAiIndustryCard,
      getAiIndustryPublicPickProfile,
      scoreAiIndustryPublicPick,
      summarizeAiStrategyPassiveSlots,
      scoreAiEarlyEmptyStrategyPickPenalty,
      listAiCardCornerMoveCandidatesForReward,
      scoreAiIndustryCornerReward,
      scoreAiIndustryStratusCorners,
      scoreAiIndustryTuringBorrow,
      listAiIndustryHuanyuMoveCandidates,
      scoreAiIndustryHuanyuMoves,
      scoreAiIndustrySentinelArm,
      scoreAiIndustryDeepspaceSwap,
      buildAiIndustryCandidate,
      scoreAiSecondMarkAnalyzeReloadDataValue,
      getAiFinalHighScoreDataCreditPreserveProfile,
      scoreAiFinalHighScoreDataCreditPreserveValue,
      scoreAiDataPlacementChoice,
      listAiDataPlacementCandidates,
      chooseAiDataPlacementOptionFromButtons,
      getAiPendingDecisionPlayer,
      queryAiButtons,
      chooseFirstAiButton,
      scoreAiHandCornerChoice,
      chooseAiHandCornerChoice,
      getAiIncomeGainValue,
      chooseAiDiscardAnyIncomeCards,
      scoreAiPayCreditReward,
      chooseAiDiscardCornerRepeatCard,
      chooseAiProbeSectorScanChoices,
      chooseAiProbeLocationRewardButton,
      runAiDataPlacementDecision,
      scoreAiStrategyPassiveSlotChoice,
      runAiStrategyPassiveSlotChoiceDecision,
      runAiMovePaymentDecision,
      runAiLandTargetDecision,
      runAiProbeSectorScanDecision,
      runAiProbeLocationRewardDecision,
      runAiRareScanTargetDecision,
      runAiScanTargetDecision,
      buildAiEffectMoveCandidate,
      isAiIndustryHuanyuMoveEffect,
      isAiIndustryHuanyuMoveContext,
      getAiCompletedIndustryHuanyuMoveRocketIds,
      listAiEffectMoveCandidates,
      runAiActionEffectMoveDecision,
      runAiCardCornerFreeMoveDecision,
      runAiIndustryFreeMoveDecision,
      listAiScanAction4Candidates,
      runAiScanAction4Decision,
      getAiAlienTraceButtons,
      listAiAlienStateTraceTargets,
      listAiAlienGridTraceTargets,
      listAiAlienPickerTargets,
      getAiAlienTraceTargetTraceType,
      getAiAlienTraceTargetPosition,
      getAiAlienTraceTargetMode,
      scoreAiAlienGridPosition,
      scoreAiRevealedAlienGridPosition,
      getAiAlienTraceTargetReward,
      getAiAvailableDataTokenCount,
      getAiAllowedAlienTraceTypes,
      getAiAlienModuleTracePositions,
      hasAiFeasibleGridTraceTarget,
      hasAiFeasibleSimpleGridTraceTarget,
      hasAiFeasibleBanrenmaTraceTarget,
      getAiBestSimpleGridTraceDirectScore,
      getAiBestCheckedGridTraceDirectScore,
      getAiBestBanrenmaTraceDirectScore,
      getAiBestRevealedAlienTraceDirectScoreForSlot,
      hasAiFeasibleRevealedAlienTraceTarget,
      getAiAlienTracePlayerKeys,
      listAiAlienTraceEntriesForSlot,
      aiAlienTraceEntryBelongsToPlayer,
      aiAlienSlotHasPlayerTrace,
      aiAlienSlotHasPlayerTraceSet,
      getAiEligibleAlienSlotIdsForTraceEffect,
      canAiPlaceBasicAlienTrace,
      canAiResolveAlienTraceEffect,
      canAiPlaceAlienGridTraceTarget,
      scoreAiAlienTraceTarget,
      chooseAiAlienTraceTarget,
      runAiAlienTraceDecision,
      getAiAlienPendingPlayer,
      makeAiAlienChoiceFlow,
      getAiAlienUseFlows,
      getAiJiuzheCardDefinition,
      getAiJiuzheScoringContext,
      getAiOtherJiuzheThreats,
      getAiJiuzheThreatValuationContext,
      getAiFinalAnalyzeDirectScoreProtection,
      evaluateAiCardsForEnergyAnalyzeProtection,
      estimateAiJiuzheCardCompletionFactor,
      estimateAiJiuzheThreatPenalty,
      scoreAiJiuzheCardOption,
      enrichAiJiuzheCardOptions,
      scoreAiChongFossilUseOption,
      getAiEffectiveBanrenmaRewardGain,
      scoreAiBanrenmaDisplayedCardGainValue,
      scoreAiBanrenmaBonusUseOption,
      scoreAiBanrenmaConditionUseOption,
      scoreAiAmibaSymbolUseOption,
      scoreAiAmibaTraceRemovalUseOption,
      scoreAiRunezuFaceSymbolUseOption,
      scoreAiRunezuSymbolBranchUseOption,
      enrichAiAlienUseOptions,
      listAiAlienUseOptions,
      runAiAlienUseDecision,
      runAiMoveActionDecision,
      buildAiResearchTechCandidate,
      scoreAiBorrowedTechImmediateValue,
      buildAiBorrowTechCandidate,
      listAiBorrowTechCandidates,
      listAiResearchTechCandidates,
      getAiResearchTechCandidateExecutionCheck,
      selectExecutableAiResearchTechCandidate,
      runAiResearchTechSelectionDecision,
      enumerateAiTurnActions,
      isRawNegativeResourceCardCornerAction,
      countAiRepeatedNegativeResourceCardCornersThisTurn,
      shouldCapRepeatedNegativeResourceCardCorner,
      hasAiPassActionThisTurn,
      shouldCapPostPassNoCashoutCardCorner,
      getAiEarlyDirectScorePlayPassFloor,
      applyAiTurnActionSelectionPressure,
      buildAiResourceLockTradePreviews,
      buildAiPublicRefillTradePreview,
      buildAiEarlyNoMainPublicRefillDiagnostic,
      buildAiFinalLowHandPassRecoveryDiagnostic,
      buildAiFinalHighScorePassRecoveryDiagnostic,
      executeAiTurnAction,
      shouldRetryAiTurnAction,
      rejectAiTurnActionCandidate,
      buildAiPlannerShadowDecision,
      buildAiTurnActionCandidates,
      runAiTurnActionDecision,
      runAiActionEffectStep,
      hasAiPendingDecisionForCurrentEffect,
      recoverAiIdleActionEffectStep,
      runAiNonTurnAutomationStep,
      resolveAiAutomationToTurnBoundary,
      matchesAiTurnActionSelector,
      runAiSelectedTurnAction,
      runAiAutomationStep,
    });
    const {
      resetAiStrategyDemandCache,
      withAiDeferredCardResearchPreview,
      aiNumber,
      roundAiScore,
      applyAiStrategyTuning,
      applyAiStrategyWeight,
      getAiResourceValuesForRound,
      scoreAiResourceBundle,
      createAiPlayerAfterResourceGain,
      scoreAiPublicityResearchTechSetupValue,
      getAiMidgameResourceContinuationWeight,
      scoreAiPlanetCashoutUnlockAfterResourceGain,
      scoreAiMidgameResourceContinuationValue,
      cloneAiValue,
      getAiAomomoFossilCount,
      getAiAomomoFossilUnitValue,
      scoreAiAomomoFossilPlanBonus,
      scoreAiAomomoFossilSpendPlanPenalty,
      scoreAiAlienRewardBundle,
      scoreAiBestChongFossilRewardValue,
      listAiChongFossilRewardValues,
      scoreAiAverageChongFossilRewardValue,
      hasAiPlayerSeenChongFossil,
      scoreAiExpectedChongPlanetFossilRewardValue,
      scoreAiChongPanelUnlockValue,
      scoreAiChongTaskRewardValue,
      getAiPlanetCoordinateById,
      scoreAiChongTransportDeliveryCost,
      scoreAiChongTransportCompletionValue,
      scoreAiChongTransportMoveUrgency,
      scoreAiChongCardPlayAffordability,
      scoreAiChongPickupTaskValue,
      listAiPlayableChongTransportCards,
      scoreAiChongPickupRouteValue,
      getAiChongTaskForEffect,
      isAiChongPickupTravelChoice,
      listAiChongPickupTravelChoices,
      scoreAiChongTravelChoiceBonus,
      scoreAiChongTravelEffectPlanetValue,
      scoreAiChongTravelEffectImmediateValue,
      isAiChongFossilToken,
      getAiChongTransportTaskForRocket,
      getAiChongTransportDeliveryRouteTarget,
      buildAiChongTransportMoveCandidate,
      scoreAiChongTraceTaskProgressValue,
      scoreAiChongCardTaskChainValue,
      scoreAiAmibaSymbolRewardValue,
      scoreAiAmibaSymbolEntryValue,
      scoreAiAmibaSingleSymbolChoiceValue,
      scoreAiAmibaRegionRewardValue,
      scoreAiAmibaTraceRemovalValue,
      scoreAiRunezuPlayerSymbolFinalScore,
      scoreAiRunezuSymbolFinalGain,
      scoreAiRunezuSpendSymbolFinalPenalty,
      scoreAiRunezuFaceRewardValue,
      getAiRunezuFaceSymbolEntry,
      scoreAiRunezuSymbolRewardValue,
      scoreAiRunezuSymbolBranchValue,
      getAiRunezuPrematureSymbolCardReason,
      getAiRunezuTaskPendingSymbolIds,
      getAiRunezuBlockedTaskSymbolIds,
      scoreAiRunezuSymbolCardSynergy,
      scoreAiRunezuFaceUnlockValue,
      scoreAiRunezuFaceDependencyUnlockValue,
      scoreAiRunezuFaceSymbolPlacementChoice,
      listAiBanrenmaHandCards,
      countAiPlayableBanrenmaCards,
      scoreAiBanrenmaEnergyIncomeValue,
      scoreAiBanrenmaCardThresholdSetupValue,
      scoreAiBestRunezuFacePlacementForSymbol,
      scoreAiRunezuSymbolGainValue,
      scoreAiRunezuPanelSymbolRewardValue,
      scoreAiRunezuRewardValue,
      getAiRunezuSourceSymbol,
      scoreAiRunezuSourceSymbolValue,
      getAiAlienTraceRewardForValuation,
      getAiFangzhouUnlockCount,
      getAiFangzhouRequiredUnlockForPosition,
      countAiFangzhouCard2InHand,
      scoreAiFangzhouCreditReadiness,
      scoreAiFangzhouPlacementPotentialAtUnlockCount,
      scoreAiFangzhouUnlockChoiceValue,
      getAiFangzhouCard1RewardIndexes,
      getAiSafePositiveScore,
      scoreAiFangzhouCard1EffectValue,
      scoreAiFangzhouCard2AdvancedRewardValue,
      scoreAiBanrenmaTraceTimingValue,
      scoreAiAomomoTraceTimingValue,
      getAiYichangdianAnomalyForTraceType,
      getAiYichangdianAnomalyTriggerDistance,
      scoreAiYichangdianAnomalyRewardValue,
      scoreAiYichangdianNextAnomalyRewardValue,
      scoreAiYichangdianNextAnomalyScanValue,
      countAiYichangdianAnomalySignals,
      getAiYichangdianTopTraceEntry,
      canAiYichangdianTraceBecomeTop,
      scoreAiYichangdianTraceTimingValue,
      scoreAiYichangdianAlienCardTracePriorityValue,
      getAiMovePaymentCards,
      getAiLaunchPaymentCost,
      scoreAiLaunchPaymentCost,
      estimateAiMovePayment,
      shouldAiPreserveEnergyForSatelliteRoute,
      shouldAiPreserveEnergyForPlanetCashout,
      shouldAiPreserveEnergyForRouteCashout,
      scoreAiMovePaymentCost,
      countAiFinalMarksForPlayer,
      getAiActiveOpponentCount,
      getAiMarkedFinalFormulaEntries,
      getAiFinalFormulaProgressForPlayer,
      getAiNextFinalTileSlotIndex,
      getAiPotentialFinalFormulaEntries,
      getAiPlanningFinalFormulaEntries,
      getAiIncomeFinalFormulaEntries,
      scoreAiThresholdPressureForScoreGain,
      scoreAiPaceValueForDirectScore,
      scoreAiThirdFinalMarkCashoutValue,
      scoreAiSecondFinalMarkNudgeValue,
      scoreAiNoDirectScorePacePenalty,
      getAiNextMissingFinalScoreThreshold,
      scoreAiLateMissingFinalMarkNoDirectPenalty,
      getAiFinalSecondMarkUrgency,
      scoreAiFinalSecondMarkNoDirectSetupPenalty,
      getAiRemainingRoundWeight,
      getAiRoundNumber,
      getAiLiveScorePaceTarget,
      getAiLiveScorePaceDeficit,
      getAiProjectedFinalScore,
      getAiHighScorePushProfile,
      scoreAiHighScorePushValue,
      getAiLowEngineCatchupProfile,
      scoreAiLowEngineCatchupValue,
      scoreAiPassAction,
      scoreAiResourceReservePenaltyForCost,
      scoreAiFinalRoundPlayCardResourceDrainPenalty,
      canAiReachAnalyzeReadyWithDataPool,
      hasAiAnalyzeReadyDataSlot,
      getAiAnalyzeEnergyCost,
      canAiAnalyzeData,
      canAiFangzhouTracePlacementScoreAtLeast,
      getAiBestRevealedAlienTraceDirectScore,
      listAiEmergencyAnalyzeEnergyTradeCandidates,
      listAiFinalAnalyzeEnergyTradeCandidates,
      listAiThirdFinalMarkResourceTradeCandidates,
      summarizeAiTradeDiscardCardEntry,
      buildAiTradeDiscardCostEntries,
      summarizeAiTradeDiscardPlan,
      estimateAiTradeDiscardOpportunityCost,
      summarizeAiRepeatedCardsForCreditDiscardPlan,
      createAiPlayerAfterRepeatedQuickTrade,
      getAiFinalReadyTaskCreditChainProfile,
      listAiFinalReadyTaskCreditChainTradeCandidates,
      countAiQuickTradesThisTurn,
      getAiBestOpenedMainActionScore,
      buildAiMainUnlockTradeCandidate,
      listAiMainUnlockTradeCandidates,
      buildAiResourceLockMainUnlockTradeCandidate,
      listAiResourceLockMainUnlockTradeCandidates,
      listAiLateResourceRecoveryTradeCandidates,
      getAiActionGraphBaseNet,
      getAiBestNestedCandidateScore,
      countAiStandardScansThisRound,
      getAiFinalRoundProgressPenaltyScale,
      getAiPlayerStyle,
      getAiCandidateStyleActionId,
      getAiOpeningStyleMultiplier,
      getAiFinalFormulaStyleMultiplier,
      getAiCandidateDirectScoreForFinalMark,
      getAiMissingFinalMarkUrgencyMultiplier,
      adjustAiActionGraphCandidateForStyle,
      getAiTerminalResearchGoalBonusScale,
      adjustAiActionGraphCandidate,
      getAiEarlyEnginePressure,
      addAiIncomeGain,
      getAiIncomeIncreaseSnapshot,
      getAiIncomeFormulaBase,
      scoreAiMarkedIncomeFinalValue,
      scoreAiHandIncomeEngineBacklogValue,
      scoreAiIncomeOpportunityValue,
      scoreAiPlacementBonusValue,
      getAiDataPlacementBonuses,
      scoreAiDataPlacementBonusValue,
      scoreAiFinalThresholdIncomePlacementPenalty,
      scoreAiLateIncomePlacementDiscardPenalty,
      getAiDataPlacementDirectScoreGainFromBonus,
      getAiDataPlacementDirectScoreGain,
      scoreAiDataEngineProgressValue,
      scoreAiEarlyScanEngineValue,
      countAiTraceMarkersForPlayer,
      getAiB1TraceCounts,
      addAiB1TraceDemand,
      scoreAiB1TraceMarginalValue,
      isAiFirstTraceTakenByOpponent,
      isAiHiddenFirstTraceTakenByOpponent,
      isAiOpenHiddenFirstTraceTarget,
      getAiHiddenFirstTraceColorStatus,
      isAiHiddenFirstTraceColorLost,
      getAiAlienSlot,
      getAiAlienCardConversionMultiplier,
      getAiAlienCardExpectedValue,
      scoreAiLateAlienCardConversionPenalty,
      scoreAiHiddenAlienRevealTimingPremium,
      scoreAiAlienTraceValue,
      scoreAiScanPriorityFloor,
      getAiTechCountForPlayer,
      scoreAiCardCornerOpportunity,
      getAiScanEffectCount,
      getAiPlayerCompanyBaseIncome,
      scoreAiCountedResourceGain,
      getAiConditionalProgress,
      getAiConditionRewardMultiplier,
      isAiIncomeRewardEffect,
      scoreAiIncomeRewardOpportunityValue,
      aiRocketMatchesCountRewardOwner,
      aiRocketMatchesCountRewardLocation,
      countAiRocketsForReward,
      scoreAiEffectValue,
      createAiStrategyDemand,
      addAiMapDemand,
      getAiMapDemand,
      addAiAlienTraceTargetDemand,
      getAiAlienTraceTargetDemand,
      getAiAlienTraceTargetDemandForSlot,
      addAiActionDemand,
      addAiAllScanColorDemand,
      addAiAllTechDemand,
      addAiAllTraceDemand,
      getAiMissingCount,
      aiMarkerBelongsToPlayer,
      countAiLandingMarkers,
      getAiTaskRewardValue,
      getAiTaskDirectScoreReward,
      listAiUncompletedCardTasksForPlayer,
      scoreAiTaskRouteCompletionValue,
      getAiPendingTaskRouteCashout,
      getAiPendingPlanetTaskRouteCashout,
      getAiPendingNearCompletePlanetTaskRouteCashout,
      getAiPendingLocationTaskRouteCashout,
      addAiPlanetDemand,
      addAiProbeLocationDemand,
      addAiProbeDistanceDemand,
      addAiTaskConditionDemand,
      addAiEventDemand,
      addAiEffectDemand,
      addAiEndGameRuleDemand,
      resolveAiCardEndGameRule,
      addAiFinalTileDemand,
      addAiCardModelDemand,
      getAiStrategyDemandCacheKey,
      getAiStrategyDemand,
      scoreAiCardDemandFit,
      isAiCardScanEffectType,
      scoreAiCardEndGameExpectedValue,
      isAiResearchTechEffectType,
      countAiHandEngineCards,
      countAiHandTaskCards,
      scoreAiLateCardEnginePressure,
      scoreAiLatePlayCardEnginePressure,
      scoreAiPlayCardConversionPressure,
      scoreAiCardLaunchRouteValue,
      scoreAiPlayCardRoutePlan,
      scoreAiCardStandardActionPremium,
      scoreAiUnplayedTaskCardPreserveValue,
      getAiReadyHandTaskCashout,
      scoreAiReadyTaskTechReplacementValue,
      listAiStrategyPassiveSlotsForCard,
      scoreAiStrategyPassiveCardPlayValue,
      scoreAiPlayCardValue,
      getAiCircularDistanceX,
      getAiSectorDistance,
      getAiPlanetOptimalMoveRange,
      scoreAiPlanetMoveDistanceFit,
      getAiCoordinateDistanceFromEarth,
      isAiCoordinateAdjacentToEarth,
      getAiAdjacentEarthCoordinates,
      sumAiDemandMap,
      getAiTotalRouteDemand,
      canAiPlanetAcceptOrbit,
      canAiPlanetAcceptLanding,
      scoreAiRewardEffects,
      scoreAiOrbitRewardValue,
      getAiLandRewardEffectsForTarget,
      getAiCardLandChoicePlanetId,
      getAiCardLandChoiceRewardEffects,
      isAiAlienTraceRewardEffect,
      canAiResolveCardLandChoice,
      canAiResolveCardLandEffect,
      scoreAiLandRewardValueForTarget,
      scoreAiLandResolvedRewardValueForTarget,
      getAiRewardTraceTypes,
      scoreAiDeferredAlienTraceRewardPenalty,
      getAiFirstTraceCompetition,
      getAiPrecedingOpponentIds,
      getAiPostActionWindowOpponentIds,
      estimateAiSatelliteClaimEta,
      getAiImmediateEnergyTradeCapacity,
      buildAiSatelliteRaceDiagnostics,
      getAiApproxLandEnergyCostForPlayer,
      canAiPlayerLandForTraceNow,
      canAiOpponentLandForTraceNow,
      getAiTraceCompetitionState,
      scoreAiHighCostPointConversionPenalty,
      isAiOuterHighScoreSatelliteTarget,
      scoreAiOuterSatelliteCashoutPremium,
      scoreAiOuterSatelliteRouteApproachPremium,
      canAiOpponentContestSatelliteNow,
      getAiResearchTechPublicityCostForPlayer,
      getAiTechTileRemaining,
      getAiProspectiveOrange4ContestAccess,
      getAiOuterSatelliteContestPressure,
      getAiNearestRocketDistanceToPlanet,
      getAiSatelliteLandingRaceState,
      scoreAiSatelliteLandingRaceWastePenalty,
      getAiBestPlayableLaunchCardRoute,
      getAiOrange4LaunchRouteRaceRelief,
      scoreAiOuterSatelliteContestRiskPenalty,
      getAiYellowTraceLandCompetitionPenalty,
      getAiEffectDirectScore,
      getAiRewardDirectScore,
      getAiResearchTechEffectDirectScore,
      getAiOrbitDirectScoreGain,
      getAiLandDirectScoreGainForTarget,
      getAiBestLandDirectScoreGain,
      getAiBestSatelliteLandingOpportunity,
      buildAiLandChoicesForPlanet,
      scoreAiBestSatelliteLandRewardValue,
      scoreAiBestLandRewardValueForPlanet,
      getAiReservedEndGameRules,
      countAiMainLandingMarkersOnPlanet,
      scoreAiFinalTileOrbitLandMarginal,
      scoreAiPlanetMarkerEndGameValue,
      scoreAiOrbitChoice,
      scoreAiLandChoice,
      chooseAiLandChoice,
      scoreAiPlanetTarget,
      getAiPlanetAtCoordinate,
      isAiAsteroidCoordinate,
      scoreAiMoveArrivalRewardValue,
      getAiThreeRotationDistanceSwingForPlanet,
      getAiNearestActionablePlanetRoute,
      getAiActionablePlanetDistanceWindow,
      scoreAiNearestActionablePlanetTimingPenalty,
      countAiPlayerRocketsOnAsteroids,
      scoreAiOrange2MobilityNeed,
      scoreAiHuanyuOrange2FutureMoveValue,
      isAiLandingEffect,
      isAiChongPickupPlanetId,
      isAiChongTravelEffect,
      getAiNextActionEffect,
      getAiLandEffectCost,
      scoreAiLandingAfterMove,
      getAiDisplayedTurnNumber,
      getAiRequiredMovePointsFromCoordinate,
      canAiContinueCardMoveAfterStep,
      getAiRouteTargets,
      scoreAiMoveTowardTargets,
      getAiUrgentUncashableRouteScoreCap,
      getAiFinalInsufficientCashoutRouteAdjustment,
      scoreAiFinalUncashableMoveEnergyPenalty,
      scoreAiFinalMoveBlocksScanCashoutPenalty,
      scoreAiEarlyMoveBlocksLandingTracePenalty,
      scoreAiEarlyOrbitOnlyTraceDelayPenalty,
      scoreAiMovementPathPenalty,
      scoreAiRotationTimingMovePenalty,
      scoreAiRotationStagingValue,
      scoreAiAsteroidTrapMovePenalty,
      scoreAiBlueTechDataEngineValue,
      scoreAiTechBonus,
      getAiResearchTechAfterRewardDirectScore,
      getAiResearchTechDirectScoreGain,
      scoreAiResearchTechRoutePlan,
      scoreAiResearchTechFinalPlanningValue,
      scoreAiLateTechEngineCatchupValue,
      scoreAiLowTechBoardCatchupValue,
      getAiOrange4SatellitePotentialProfile,
      scoreAiResearchTechValue,
      aiResearchTechEventMatches,
      getAiResearchTechFinalFormulaDeltas,
      getAiResearchTechTriggeredEffects,
      getAiLaunchEffectCost,
      getAiRocketLimitAfterResearch,
      getAiResearchTechLaunchRisks,
      getAiResearchTechSelectionOptionsForEffect,
      getAiResearchTechCandidateSafety,
      scoreAiLaunchAction,
      scoreAiLaunchTurnCandidateValue,
      scoreAiLateLaunchDeadEndPenalty,
      scoreAiNoRouteLaunchPenalty,
      scoreAiWeakEarlyPostLaunchRoutePenalty,
      scoreAiExtraLaunchPacePenalty,
      scoreAiFinalSecondMarkExtraLaunchPenalty,
      scoreAiPostLaunchMovePlan,
      createAiPlayerAfterQuickTrade,
      scoreAiEnergyTradeLaunchMoveRecovery,
      scoreAiEnergyTradePlanetCashoutRecovery,
      getAiReservedPlanetCashoutEnergy,
      scoreAiOrbitAction,
      scoreAiOrbitThenLandThresholdComboValue,
      scoreAiLandBeforeOrbitOpportunityPenalty,
      scoreAiLandAction,
      buildAiAnalyzeActionValueBreakdown,
      scoreAiAnalyzeAction,
      scoreAiFollowupMainActionAfterMove,
      getAiAvailableDataRoom,
      aiTokenBelongsToPlayer,
      aiTokenHasOwner,
      getAiNebulaSignalCounts,
      getAiB2FormulaEntries,
      getAiB2SectorBottleneck,
      scoreAiB2SectorScanRecoveryValue,
      getAiBestB2WinningScanPreviewChoice,
      isAiFixedNebulaScanPlayCandidate,
      scoreAiWeakFinalB2TargetedScanTieBreak,
      scoreAiWeakEarlyB2SetupScanTieBreak,
      shouldAiProtectB2SectorScanFromPlanetCap,
      isAiB2SectorScanRaceLost,
      getAiSectorScanWinState,
      getAiClosedSectorControlMarginValue,
      getAiB2SectorWinExactDelta,
      scoreAiB2SectorScanFocus,
      scoreAiFullSectorExtraMark,
      scoreAiNebulaScanChoice,
      getAiNebulaScanChoiceDirectScore,
      getBestAiNebulaChoiceEntry,
      getBestAiNebulaChoiceScore,
      getAiSectorScanChoicesForEffect,
      scoreAiScanCard,
      getAiScanCardDirectScoreGain,
      getAiBestPublicScanSlots,
      getAiBestHandScanIndex,
      getAiScanDirectScoreGain,
      scoreAiScanTargetButton,
      buildAiScanTargetChoiceB2Summary,
      summarizeAiScanTargetChoiceEntry,
      rankAiScanTargetChoices,
      buildAiScanActionTargetPreview,
      rankAiScanTargetButtons,
      chooseAiScanTargetButton,
      chooseAiScanTargetChoice,
      scoreAiScanEnergyReservationPenalty,
      scoreAiLateScanResourceDrainPenalty,
      scoreAiScanAction,
      getAiPlayEffectsForCard,
      isAiAlienMainPlayCard,
      doesAiCardReserveAfterPlay,
      isAiSupportedHandPlayCard,
      listAiChongTravelChoicesForOptions,
      getAiChongLandOptions,
      getAiChongOrbitOrLandOptions,
      canAiResolveChongTravelEffect,
      canAiResolvePlayCardEffects,
      buildAiPlayCardCandidate,
      listAiPlayCardCandidates,
      getAiDiscardedCardOpportunityCost,
      scoreAiD2ResearchTechPreserveValue,
      getAiCardCornerRewardValue,
      scoreAiFinalFormulaDeltaValue,
      getAiCardCornerResourceGain,
      scoreAiCardCornerFollowupMainUnlock,
      getAiNextTurnMoveFollowupScale,
      scoreAiCardCornerMoveFollowupMainAction,
      scoreAiCardCornerStagedTechSetup,
      buildAiCardCornerQuickCandidate,
      listAiCardCornerQuickCandidates,
    } = aiRuleDomains;


    const resolvedAiBattleLogModule = aiBattleLogModule
      || root.SetiAppAiBattleLog
      || (typeof require === "function" ? require("./ai/battle-log") : null);
    const resolvedAiTuningHistoryModule = aiTuningHistoryModule
      || root.SetiAppAiTuningHistory
      || (typeof require === "function" ? require("./ai/tuning-history") : null);
    const resolvedAiBattleReportModule = aiBattleReportModule
      || root.SetiAppAiBattleReport
      || (typeof require === "function" ? require("./ai/battle-report") : null);
    const resolvedAiExperimentRunnerModule = aiExperimentRunnerModule
      || root.SetiAppAiExperimentRunner
      || (typeof require === "function" ? require("./ai/experiment-runner") : null);
    if (
      !resolvedAiBattleLogModule?.createAiBattleLog
      || !resolvedAiTuningHistoryModule?.createAiTuningHistory
      || !resolvedAiBattleReportModule?.createAiBattleReport
      || !resolvedAiExperimentRunnerModule?.createAiExperimentRunner
    ) {
      throw new Error("createAiController requires AI log/report/tuning/runner modules");
    }

    let aiExperimentRunner;
    const aiBattleLog = resolvedAiBattleLogModule.createAiBattleLog({
      ...context,
      aiAutoBattleState,
      turnState,
      playerState,
      getActivePlayers,
      aiNumber,
      countAiPlayerTech,
      getPlayerById,
      getPlayerByColor,
      getCurrentPlayer,
      getAiDisplayedTurnNumber,
      roundAiScore,
      getCardPrice,
      getCardTypeCode,
      getAiCandidateRankScore: (...args) => aiExperimentRunner.getAiCandidateRankScore(...args),
      summarizeAiTurnActionCandidate: (...args) => aiExperimentRunner.summarizeAiTurnActionCandidate(...args),
      summarizeAiFinalScoreMarkCandidate: (...args) => aiExperimentRunner.summarizeAiFinalScoreMarkCandidate(...args),
      getAiCardDisplayLabel: (...args) => aiExperimentRunner.getAiCardDisplayLabel(...args),
    });
    const {
      recordAiAutoBattleLog,
      recordAiAutoBattleBug,
    } = aiBattleLog;

    const aiTuningHistory = resolvedAiTuningHistoryModule.createAiTuningHistory({
      ...context,
      ...aiControlRuntime,
      windowRef,
      ai,
      aiAutoBattleState,
      aiNumber,
      AI_STRATEGY_TUNING_HISTORY_STORAGE_KEY,
      applyAiStrategyTuning,
    });
    const {
      recordAiStrategyTuningSummary,
      recordAiStrategyABComparison,
      getAiStrategyTuningHistory,
      clearAiStrategyTuningHistory,
      getAiStrategyTuningRecommendation,
      applyAiStrategyTuningRecommendation,
    } = aiTuningHistory;

    const aiBattleReport = resolvedAiBattleReportModule.createAiBattleReport({
      ...context,
      ...aiControlRuntime,
      ai,
      aiAutoBattleState,
      getActivePlayers,
      getAiMarkedFinalFormulaEntries,
      getAiFinalFormulaProgressForPlayer,
      getAiIndustryCard,
      countAiPlayerTech,
      getAiPlayerTechTypeCounts,
      getAiB1TraceCounts,
      summarizeAiResultCards,
      getCurrentActionEffect,
      isActionEffectFlowActive,
      getAiStrategyTuningHistory,
      getAiStrategyTuningRecommendation,
      buildAiLowMarkPlayerDiagnostics: (...args) => aiExperimentRunner.buildAiLowMarkPlayerDiagnostics(...args),
    });
    const {
      getAiAutoBattlePendingState,
      buildAiAutoBattleReport,
      getAiAutoBattleReport,
      getAiAutoBattleProgress,
      getAiAutoBattleAnalysis,
    } = aiBattleReport;

    aiExperimentRunner = resolvedAiExperimentRunnerModule.createAiExperimentRunner({
      ...context,
      ...aiControlRuntime,
      windowRef,
      ai,
      aiAutoBattleState,
      turnState,
      playerState,
      aiNumber,
      roundAiScore,
      getCardPrice,
      getCardTypeCode,
      getActivePlayers,
      getAiIndustryCard,
      runAiAutomationStep,
      recoverAiIdleActionEffectStep,
      recordAiAutoBattleLog,
      recordAiAutoBattleBug,
      getAiAutoBattleReport,
      recordAiStrategyTuningSummary,
      recordAiStrategyABComparison,
      getAiStrategyTuningRecommendation,
      applyAiStrategyTuning,
    });
    const {
      runAiAutoBattle,
      stopAiAutoBattle,
      getAiCandidateRankScore,
      getAiCardDisplayLabel,
      summarizeAiTurnActionCandidate,
      buildAiLowMarkPlayerDiagnostics,
      summarizeAiFinalScoreMarkCandidate,
      summarizeAiFinalScoreMarkDecision,
      runAiAutoBattleBatch,
      runAiStrategyABTest,
      runAiStrategyTuningCycle,
    } = aiExperimentRunner;

    Object.assign(
      aiDomainBindings,
      aiBattleLog,
      aiTuningHistory,
      aiBattleReport,
      aiExperimentRunner,
    );



    function resetGameForAiAutoBattle(options = {}) {
      resetAiStrategyDemandCache();
      const requestedActivePlayerCount = options.activePlayerCount == null
        ? DEFAULT_ACTIVE_PLAYER_COUNT
        : options.activePlayerCount;
      const activePlayerCount = Math.min(
        Math.max(1, Math.round(Number(requestedActivePlayerCount) || DEFAULT_ACTIVE_PLAYER_COUNT)),
        players.PLAYER_COLOR_IDS.length,
      );
      if (options.clearLogs !== false) {
        aiAutoBattleState.logs = [];
        aiAutoBattleState.bugs = [];
        aiAutoBattleState.bugCounts = {};
        aiAutoBattleState.lastSummary = null;
      }
      aiAutoBattleState.turnMoveCounts = {};
      aiAutoBattleState.turnCardCornerMoveCounts = {};
      clearTransientStateForRecovery();
      restoreMutableObject(solarState, solar.createBaselineState());
      restoreMutableObject(nebulaDataState, data.createDefaultNebulaDataState());
      restoreMutableObject(alienGameState, aliens.createDefaultAlienState());
      restoreMutableObject(finalScoringState, finalScoring.createFinalScoringState(FINAL_SCORE_IDS));
      restoreMutableObject(playerState, players.createPlayerState({
        players: players.PLAYER_COLOR_IDS.map((color) => ({ color })),
        currentPlayerColor: DEFAULT_INITIAL_PLAYER_COLOR,
      }));
      restoreMutableObject(turnState, createTurnState(playerState.players, {
        activePlayerCount,
        currentPlayerId: playerState.currentPlayerId,
      }));
      restoreMutableObject(rocketState, rocketActions.createRocketState());
      restoreMutableObject(planetStatsState, planetStats.createPlanetStatsState());
      restoreMutableObject(techGameState, tech.createState());
      restoreMutableObject(cardState, cards.createCardState());
      restoreMutableObject(cardTaskState, cardTaskStateModule.createTaskState());
      historyStepOrder.length = 0;
      state.effectStepActive = false;
      if (typeof resetScanRunSequence === "function") resetScanRunSequence();
      resetActionLog();
      initializeCardGame(DEFAULT_INITIAL_HAND_COUNT);
      randomizeAll();
      startInitialSelection();
      return {
        ok: true,
        activePlayerCount,
        playerIds: [...turnState.activePlayerIds],
        message: "AI 自动对战新局已重置",
      };
    }

    function getOrderedAiAutoBattlePlayerIds() {
      const aiIds = new Set(getAiAutoBattlePlayerIds());
      const ordered = (turnState.activePlayerIds || []).filter((playerId) => aiIds.has(playerId));
      for (const playerId of aiIds) {
        if (!ordered.includes(playerId)) ordered.push(playerId);
      }
      return ordered;
    }

    function getForcedAiIndustrySeatIndex(playerId) {
      const orderedAiIds = getOrderedAiAutoBattlePlayerIds();
      return orderedAiIds.indexOf(playerId);
    }

    function getForcedAiIndustryOffer(playerId, offer) {
      const seatIndex = getForcedAiIndustrySeatIndex(playerId);
      if (seatIndex < 0) return null;
      if (seatIndex === 0) return ensureAiHuanyuSuperdriveIndustryOffer(offer);
      if (seatIndex === 1) return ensureAiGrandStrategyIndustryOffer(offer);
      return ensureAiCheatLabIndustryOffer(offer);
    }

    function getAiStyleFallbackIndex(playerId) {
      const orderedAiIds = getOrderedAiAutoBattlePlayerIds();
      const index = orderedAiIds.indexOf(playerId);
      return index >= 0 ? index : 0;
    }

    function getAiSeatStyle(playerId) {
      const index = getAiStyleFallbackIndex(playerId);
      return AI_STYLE_SEAT_ORDER[index % AI_STYLE_SEAT_ORDER.length] || "balanced";
    }

    function inferAiStyleFromOpening(openingPlan = null, industryCard = null, player = null) {
      const industryLabel = String(industryCard?.label || "");
      if (industryLabel === AI_HUANYU_SUPERDRIVE_INDUSTRY_LABEL) return "route";
      if (industryLabel === AI_GRAND_STRATEGY_INDUSTRY_LABEL) return "task";

      const summary = openingPlan?.summary || {};
      const goals = openingPlan?.goals || {};
      const scanScore = aiNumber(summary.scan) * 1.2 + aiNumber(summary.data) * 0.5 + aiNumber(goals.GRAB_TRACE_PINK);
      const routeScore = aiNumber(summary.orbits) * 1.5 + aiNumber(summary.traces) + aiNumber(goals.GRAB_TRACE_YELLOW);
      const taskScore = aiNumber(summary.hand) * 0.45 + aiNumber(summary.incomeIncreases) * 0.35 + aiNumber(goals.OPENING_INCOME) * 0.35;
      const techScore = aiNumber(summary.credits) * 0.22 + aiNumber(summary.energy) * 0.18;
      if (
        aiNumber(summary.scan) >= 2
        && aiNumber(summary.orbits) >= 1
        && aiNumber(summary.credits) <= 4
        && scanScore >= routeScore + 2
        && taskScore > scanScore
      ) {
        return "scanner";
      }
      const scoredStyles = [
        { id: "scanner", score: scanScore },
        { id: "route", score: routeScore },
        { id: "task", score: taskScore },
        { id: "tech", score: techScore },
      ].sort((left, right) => right.score - left.score);
      if (scoredStyles[0]?.score >= 2.2 && scoredStyles[0].score >= scoredStyles[1]?.score + 0.45) {
        return scoredStyles[0].id;
      }
      const fallback = getAiSeatStyle(player?.id);
      return fallback || "balanced";
    }

    function createAiHuanyuSuperdriveIndustryCard(offer) {
      const template = Array.isArray(offer?.industryOptions) ? offer.industryOptions[0] : null;
      return {
        id: AI_HUANYU_SUPERDRIVE_INDUSTRY_ID,
        kind: "industry",
        label: AI_HUANYU_SUPERDRIVE_INDUSTRY_LABEL,
        src: AI_HUANYU_SUPERDRIVE_INDUSTRY_SRC,
        width: template?.width || 1382,
        height: template?.height || 1054,
        aiOnly: true,
      };
    }

    function ensureAiHuanyuSuperdriveIndustryOffer(offer) {
      if (!offer) return null;
      if (!Array.isArray(offer.industryOptions)) offer.industryOptions = [];
      const existing = offer.industryOptions.find((card) => (
        card?.label === AI_HUANYU_SUPERDRIVE_INDUSTRY_LABEL
        || card?.id === AI_HUANYU_SUPERDRIVE_INDUSTRY_ID
      ));
      if (existing) return existing;
      const card = createAiHuanyuSuperdriveIndustryCard(offer);
      offer.industryOptions.push(card);
      return card;
    }

    function createAiGrandStrategyIndustryCard(offer) {
      const template = Array.isArray(offer?.industryOptions) ? offer.industryOptions[0] : null;
      return {
        id: AI_GRAND_STRATEGY_INDUSTRY_ID,
        kind: "industry",
        label: AI_GRAND_STRATEGY_INDUSTRY_LABEL,
        src: AI_GRAND_STRATEGY_INDUSTRY_SRC,
        width: template?.width || 1382,
        height: template?.height || 1054,
        aiOnly: true,
      };
    }

    function ensureAiGrandStrategyIndustryOffer(offer) {
      if (!offer) return null;
      if (!Array.isArray(offer.industryOptions)) offer.industryOptions = [];
      const existing = offer.industryOptions.find((card) => (
        card?.label === AI_GRAND_STRATEGY_INDUSTRY_LABEL
        || card?.id === AI_GRAND_STRATEGY_INDUSTRY_ID
      ));
      if (existing) return existing;
      const card = createAiGrandStrategyIndustryCard(offer);
      offer.industryOptions.push(card);
      return card;
    }

    function chooseInitialSelectionForAiPlayer() {
      if (!isInitialSelectionActive()) return null;
      const playerId = playerState.currentPlayerId;
      if (!isAiAutoBattlePlayer(playerId)) {
        return { ok: false, blocked: true, message: `${getPlayerLabelById(playerId)}不是电脑玩家，等待人类初始选择` };
      }
      const offer = getInitialSelectionOffer(playerId);
      if (!offer || offer.confirmed) return { ok: false, message: "没有可用初始选择" };
      const forcedIndustryCard = getForcedAiIndustryOffer(playerId, offer);
      const player = getPlayerById(playerId);
      if (player) applyAiDifficultyToPlayer(player);
      const decision = ai?.policy?.chooseInitialSelection?.(offer, {
        roundNumber: turnState.roundNumber,
        forcedIndustryCard,
        player,
        aiDifficulty: player?.aiDifficulty,
      }) || {};
      const industryCard = forcedIndustryCard || decision.industry || offer.industryOptions?.[0] || null;
      const initialSelection = decision.initialCards?.length
        ? decision.initialCards
        : (offer.initialOptions || []).slice(0, INITIAL_SELECTION_REQUIRED.initial);
      if (!industryCard || initialSelection.length < INITIAL_SELECTION_REQUIRED.initial) {
        return { ok: false, message: "AI 初始选择候选不足" };
      }
      const openingPlan = decision.openingPlan || null;
      const aiStyle = inferAiStyleFromOpening(openingPlan, industryCard, player);
      if (player) {
        player.aiStyle = aiStyle;
      }
      if (player && openingPlan) {
        player.openingPlan = {
          ...structuredClone(openingPlan),
          forcedIndustryLabel: industryCard.label || industryCard.id || null,
          aiStyle,
          aiDifficulty: player.aiDifficulty,
          aiDifficultyLabel: player.aiDifficultyLabel,
        };
      }
      offer.selectedIndustryId = industryCard.id;
      offer.selectedInitialIds = initialSelection
        .slice(0, INITIAL_SELECTION_REQUIRED.initial)
        .map((card) => card.id);
      recordAiAutoBattleLog(
        "initial-selection",
        `${getPlayerLabelById(playerId)}选择 ${industryCard.label || industryCard.id}`,
        {
          industryCard,
          initialCards: initialSelection,
          openingPlan,
          aiStyle,
          aiDifficulty: player?.aiDifficulty || aiAutoBattleState.aiDifficulty,
          aiDifficultyLabel: player?.aiDifficultyLabel || getAiDifficultyLabel(),
        },
      );
      confirmInitialSelectionForCurrentPlayer();
      return { ok: true, progressed: true, message: "AI 初始选择完成" };
    }

    function createAiCheatLabIndustryCard(offer) {
      const template = Array.isArray(offer?.industryOptions) ? offer.industryOptions[0] : null;
      return {
        id: AI_CHEAT_LAB_INDUSTRY_ID,
        kind: "industry",
        label: AI_CHEAT_LAB_INDUSTRY_LABEL,
        src: AI_CHEAT_LAB_INDUSTRY_SRC,
        width: template?.width || 1382,
        height: template?.height || 1054,
        aiOnly: true,
      };
    }

    function ensureAiCheatLabIndustryOffer(offer) {
      if (!offer) return null;
      if (!Array.isArray(offer.industryOptions)) offer.industryOptions = [];
      const existing = offer.industryOptions.find((card) => (
        card?.label === AI_CHEAT_LAB_INDUSTRY_LABEL
        || card?.id === AI_CHEAT_LAB_INDUSTRY_ID
      ));
      if (existing) return existing;
      const card = createAiCheatLabIndustryCard(offer);
      offer.industryOptions.push(card);
      return card;
    }

    function runAiDiscardDecision() {
      if (!isDiscardSelectionActive() || !state.pendingDiscardAction) return null;
      const player = state.pendingDiscardAction.player || getCurrentPlayer();
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工弃牌` };
      }
      const count = cards.getDiscardRemaining(cardState);
      const pendingType = state.pendingDiscardAction.type || null;
      const incomeGainByIndex = isAiIncomeDiscardType(pendingType)
        ? (player.hand || []).map((card) => cards.getIncomeGainForCard?.(card) || null)
        : null;
      const incomePlanningEntries = incomeGainByIndex ? getAiIncomeFinalFormulaEntries(player) : [];
      const dynamicIncomeIndexes = incomeGainByIndex
        ? chooseAiIncomeDiscardIndexes(player, count, incomeGainByIndex, incomePlanningEntries)
        : null;
      const tradeDiscardIndexes = !dynamicIncomeIndexes && pendingType === "trade"
        ? chooseAiTradeDiscardIndexes(player, count, state.pendingDiscardAction)
        : null;
      const selectedIndexes = dynamicIncomeIndexes || tradeDiscardIndexes || ai?.policy?.chooseDiscardIndexes?.(player.hand || [], count, {
        pendingType,
        incomeGainByIndex,
      })
        || Array.from({ length: count }, (_item, index) => index);
      state.pendingDiscardAction.selectedIndexes = selectedIndexes.slice(0, count);
      const incomeDiscardPreview = incomeGainByIndex
        ? getAiIncomeDiscardPreview(player, count, pendingType, incomeGainByIndex, incomePlanningEntries, selectedIndexes)
        : null;
      recordAiAutoBattleLog("discard", `${player.colorLabel}AI 弃牌 ${state.pendingDiscardAction.selectedIndexes.length} 张`, {
        logPlayerId: player.id || null,
        logPlayerColor: player.color || null,
        selectedIndexes: state.pendingDiscardAction.selectedIndexes,
        selectedCards: state.pendingDiscardAction.selectedIndexes
          .map((handIndex) => {
            const card = player.hand?.[handIndex] || null;
            if (!card) return null;
            return {
              handIndex,
              cardId: card.cardId || card.id || null,
              cardInstanceId: card.id || null,
              cardLabel: cards.getCardLabel?.(card) || card.cardName || card.label || null,
            };
          })
          .filter(Boolean),
        pendingType,
        incomeGainByIndex,
        incomeDiscardPreview,
        tradeId: state.pendingDiscardAction.tradeId || null,
      });
      return finalizePendingDiscardSelection();
    }


    function runAiPassReserveDecision() {
      if (!state.pendingPassReserveSelection) return null;
      const player = getPlayerById(state.pendingPassReserveSelection.playerId) || getCurrentPlayer();
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择 PASS 预留牌` };
      }
      const pile = getPassReserveSelectionCards();
      const currentHandSize = Math.max(0, aiNumber(player?.resources?.handSize ?? (player?.hand || []).length));
      const runezuLowEnginePassReserve = currentHandSize <= 1
        && getAiLowEngineCatchupProfile(player).active
        && hasAiRunezuPassReservePressure(player, pile);
      const passReserveResourcePressure = getAiPassReserveResourcePressure(player, pile, currentHandSize);
      const passReserveResourcePressurePreview = getAiPassReserveResourcePressure(player, pile, currentHandSize, {
        ignoreRound: true,
      });
      const shouldRankPassReserve = getAiMarkedFinalFormulaEntries(player)
        .some((entry) => entry.formulaId === "c2")
        || (pile || []).some((card) => getCardTypeCode(card) === 3)
        || currentHandSize <= 0
        || runezuLowEnginePassReserve
        || passReserveResourcePressure.active;
      const ranked = shouldRankPassReserve
        ? (pile || [])
          .map((card) => ({ card, score: scoreAiPassReserveCard(card, player) }))
          .filter((entry) => entry.card && Number.isFinite(entry.score))
          .sort((left, right) => right.score - left.score)
        : [];
      const card = ranked[0]?.card || ai?.policy?.choosePassReserveCard?.(pile) || pile[0] || null;
      if (!card) return { ok: false, message: "PASS 预留牌堆为空" };
      selectPassReserveCard(card.id);
      recordAiAutoBattleLog("pass-reserve", `${player.colorLabel}AI 选择 PASS 预留牌`, {
        card,
        runezuLowEnginePassReserve,
        passReserveResourcePressure,
        passReserveResourcePressurePreview,
        passReserveResourcePressureMiss: Boolean(
          !passReserveResourcePressure.active
          && passReserveResourcePressurePreview.active
          && !isAiPassReservePreviewIncomeCandidate(card, passReserveResourcePressurePreview)
        ),
        selectedScore: ranked.find((entry) => entry.card === card)?.score ?? null,
        candidates: ranked.slice(0, 5).map((entry) => ({
          cardId: entry.card.cardId || entry.card.id || null,
          cardLabel: cards.getCardLabel?.(entry.card) || entry.card.cardName || entry.card.label || null,
          typeCode: getCardTypeCode(entry.card),
          score: Math.round(entry.score * 1000) / 1000,
        })),
      });
      return confirmPassReserveSelection();
    }
    function runAiCardSelectionDecision() {
      if (!isCardSelectionActive() && !isIndustryHandSelectionActive()) return null;
      const pending = state.pendingCardSelectionAction || {};
      const player = pending.player || getCurrentPlayer();
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工精选` };
      }

      if (pending.type === "public_scan") {
        const selectedSlots = getAiBestPublicScanSlots(player, {
          maxSelectable: pending.maxSelectable ?? 1,
        });
        if (!selectedSlots.length) return { ok: false, blocked: true, message: "AI 没有可扫描的公共牌" };
        recordAiAutoBattleLog("public-scan-card", `${player.colorLabel}AI 选择公共牌扫描`, {
          pendingType: pending.type,
          selectedSlots: selectedSlots.map((entry) => ({
            slotIndex: entry.slotIndex,
            score: entry.score,
            card: entry.card,
          })),
          maxSelectable: pending.maxSelectable ?? 1,
        });
        let selectResult = null;
        for (const entry of selectedSlots) {
          selectResult = handlePublicScanCardClick(entry.slotIndex);
          if (!selectResult?.ok) return selectResult;
          if (!isPublicScanMultiSelectActive()) break;
        }
        if (isPublicScanMultiSelectActive()) {
          return confirmPublicScanSelection();
        }
        return selectResult;
      }

      if (pending.type === "industry_deepspace_hand") {
        const selected = getAiBestDeepspaceSwap(player);
        if (!selected || selected.score <= AI_DEEPSPACE_SWAP_MIN_SCORE) {
          return { ok: false, blocked: true, message: "AI 没有正收益的深空探测换牌目标" };
        }
        recordAiAutoBattleLog("industry", `${player.colorLabel}AI 选择深空探测换出手牌`, {
          pendingType: pending.type,
          handIndex: selected.handIndex,
          score: selected.score,
          handCost: selected.handCost,
          publicValue: selected.publicValue,
          handCard: selected.handCard,
          publicSlotIndex: selected.slotIndex,
          publicCard: selected.publicCard,
        });
        return handleIndustryDeepspaceHandClick(selected.handIndex);
      }

      if (pending.type === "industry_deepspace_public") {
        const selected = getAiBestDeepspaceSwap(player, pending.handIndex);
        if (!selected || selected.score <= AI_DEEPSPACE_SWAP_MIN_SCORE) {
          return { ok: false, blocked: true, message: "AI 没有正收益的深空探测公共牌目标" };
        }
        recordAiAutoBattleLog("industry", `${player.colorLabel}AI 选择深空探测换入公共牌`, {
          pendingType: pending.type,
          handIndex: selected.handIndex,
          slotIndex: selected.slotIndex,
          score: selected.score,
          handCost: selected.handCost,
          publicValue: selected.publicValue,
          handCard: selected.handCard,
          publicCard: selected.publicCard,
        });
        return handlePublicCardClick(selected.slotIndex);
      }

      if (pending.type === "card_public_corner_discard") {
        const maxSelectable = Math.max(1, Math.round(aiNumber(pending.maxSelectable ?? pending.count ?? 1)));
        const minSelectable = Math.max(1, Math.round(aiNumber(pending.minSelectable ?? maxSelectable)));
        const selectedSlots = new Set(pending.selectedSlots || []);
        const rankedPublic = (cardState.publicCards || [])
          .map((card, slotIndex) => ({
            card,
            slotIndex,
            score: scoreAiPublicPickCard(card, player, pending.type),
          }))
          .filter((entry) => entry.card && Number.isFinite(Number(entry.score)))
          .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || left.slotIndex - right.slotIndex)
          .slice(0, maxSelectable);
        if (rankedPublic.length < minSelectable) {
          return { ok: false, blocked: true, message: `AI 没有足够的公共牌弃除目标（需要 ${minSelectable} 张）` };
        }
        recordAiAutoBattleLog("pick-card", `${player.colorLabel}AI 选择公共牌角标弃除`, {
          pendingType: pending.type,
          selectedSlots: rankedPublic.map((entry) => ({
            slotIndex: entry.slotIndex,
            score: entry.score,
            card: entry.card,
          })),
          maxSelectable,
          minSelectable,
        });
        for (const entry of rankedPublic) {
          if (selectedSlots.has(entry.slotIndex)) continue;
          const selectResult = handlePublicCornerDiscardCardClick(entry.slotIndex);
          if (!selectResult?.ok) return selectResult;
          selectedSlots.add(entry.slotIndex);
        }
        if ((pending.selectedSlots || []).length < minSelectable) {
          return { ok: false, blocked: true, message: `AI 公共牌角标弃除选择不足（需要 ${minSelectable} 张）` };
        }
        return confirmPublicScanSelection();
      }

      const rankedPublic = (cardState.publicCards || [])
        .map((card, slotIndex) => ({
          card,
          slotIndex,
          score: scoreAiPublicPickCard(card, player, pending.type || null),
        }))
        .filter((entry) => entry.card && Number.isFinite(Number(entry.score)))
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || left.slotIndex - right.slotIndex);
      const selectedPublic = rankedPublic[0] || null;
      if (pending.aiPreferBlindDraw && allowsBlindDrawInSelection() && canBlindDraw()) {
        recordAiAutoBattleLog("pick-card", `${player.colorLabel}AI 盲抽 1 张牌`, {
          pendingType: pending.type || null,
          tradeId: pending.tradeId || null,
          aiPreferBlindDraw: true,
          aiReason: pending.aiReason || null,
          skippedPublicCard: selectedPublic
            ? summarizeAiPublicPickCandidate(selectedPublic, player)
            : null,
          topPublicCandidates: rankedPublic
            .slice(0, 5)
            .map((entry) => summarizeAiPublicPickCandidate(entry, player))
            .filter(Boolean),
        });
        return drawCardForCurrentPlayer({ fromSelection: true });
      }
      if (selectedPublic) {
        recordAiAutoBattleLog("pick-card", `${player.colorLabel}AI 精选公共牌 ${selectedPublic.slotIndex + 1}`, {
          pendingType: pending.type || null,
          slotIndex: selectedPublic.slotIndex,
          score: selectedPublic.score,
          card: selectedPublic.card,
          topPublicCandidates: rankedPublic
            .slice(0, 5)
            .map((entry) => summarizeAiPublicPickCandidate(entry, player))
            .filter(Boolean),
        });
        return pickPublicCardForCurrentPlayer(selectedPublic.slotIndex);
      }
      if (allowsBlindDrawInSelection() && canBlindDraw()) {
        recordAiAutoBattleLog("pick-card", `${player.colorLabel}AI 盲抽 1 张牌`, {
          pendingType: pending.type || null,
        });
        return drawCardForCurrentPlayer({ fromSelection: true });
      }
      return { ok: false, blocked: true, message: "AI 没有可精选的公共牌" };
    }

    function runAiHandScanDecision() {
      if (!isHandScanSelectionActive()) return null;
      const pending = state.pendingHandScanAction || {};
      const player = pending.player || getCurrentPlayer();
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择手牌扫描` };
      }
      const selected = getAiBestHandScanIndex(player);
      if (!selected && pending.optional) {
        recordAiAutoBattleLog("hand-scan", `${player.colorLabel}AI 跳过可选手牌扫描`, {
          pendingType: pending.type || null,
        });
        skipCurrentActionEffect();
        return { ok: true, progressed: true, message: "AI 跳过可选手牌扫描" };
      }
      if (!selected) {
        recordAiAutoBattleLog("hand-scan", `${player.colorLabel}AI 跳过无可用目标的手牌扫描`, {
          pendingType: pending.type || null,
        });
        skipCurrentActionEffect();
        return { ok: true, progressed: true, message: "AI 跳过无可用目标的手牌扫描" };
      }
      recordAiAutoBattleLog("hand-scan", `${player.colorLabel}AI 选择手牌扫描`, {
        handIndex: selected.handIndex,
        score: selected.score,
        card: selected.card,
      });
      const result = handleHandScanCardClick(selected.handIndex);
      if (
        (pending.fromEffectFlow || isActionEffectFlowActive())
        && (
          !result
          || result.ok === false
          || state.pendingHandScanAction
          || !state.pendingScanTargetAction
        )
      ) {
        recordAiAutoBattleLog("hand-scan-recovery", `${player.colorLabel}AI 跳过无法展开目标的手牌扫描`, {
          handIndex: selected.handIndex,
          card: selected.card,
          result: result ? {
            ok: result.ok ?? null,
            message: result.message || null,
          } : null,
          pendingState: getAiAutoBattlePendingState(),
        });
        skipCurrentActionEffect();
        return { ok: true, progressed: true, skipped: true, message: "AI 跳过无法展开目标的手牌扫描" };
      }
      return result;
    }

    function cardTriggerNeedsFreeMove(match) {
      return match?.effect?.type === cardEffects.EFFECT_TYPES.FREE_MOVE
        || (
          match?.effect?.type === cardEffects.EFFECT_TYPES.CARD_CORNER_EVENT_REWARD
          && Boolean(match.event?.moveReward)
        );
    }

    function getCardTriggerFreeMoveEffect(match) {
      if (!match) return null;
      if (match.effect?.type === cardEffects.EFFECT_TYPES.CARD_CORNER_EVENT_REWARD
        && match.event?.moveReward) {
        return {
          ...match.effect,
          type: cardEffects.EFFECT_TYPES.FREE_MOVE,
          options: {
            ...(match.effect.options || {}),
            movementPoints: match.event.moveReward.movementPoints || 1,
          },
        };
      }
      return match.effect || null;
    }

    function listCardTriggerFreeMoveCandidates(match) {
      return listAiEffectMoveCandidates({
        id: "cardTriggerMove",
        free: true,
        effect: getCardTriggerFreeMoveEffect(match),
      });
    }

    function getAiLaunchTriggerResolution(effect, player = getCurrentPlayer()) {
      if (effect?.options?.ignoreRocketLimit !== true) {
        const context = createActionContext();
        const rocketLimit = abilities.rocket.getRocketLimitForPlayer(player, context);
        const activeRocketCount = rocketActions.getRocketsForPlayer(rocketState, player?.id).length;
        if (activeRocketCount >= rocketLimit) {
          return {
            ok: false,
            message: `火箭数量已达上限（${activeRocketCount}/${rocketLimit}）`,
          };
        }
      }
      const cost = getAiLaunchPaymentCost(effect?.options || {});
      if (!players.canAfford(player, cost)) {
        return {
          ok: false,
          message: `发射资源不足，需要 ${players.formatResourceCost(cost)}`,
        };
      }
      return { ok: true };
    }

    function canAiResolveCardTriggerMatch(match) {
      const type = match?.effect?.type || null;
      if (!type) return false;
      if (type === amiba?.EFFECT_TYPES?.CHOOSE_SYMBOL_REWARD) return false;
      if (cardTriggerNeedsFreeMove(match)) {
        return listCardTriggerFreeMoveCandidates(match).length > 0;
      }
      if (type === "pick_card") return true;
      if (
        type === runezu?.EFFECT_TYPES?.SYMBOL_REWARD
        || type === runezu?.EFFECT_TYPES?.SYMBOL_BRANCH
      ) {
        return true;
      }
      if (String(type).startsWith("card_")) {
        return canAiResolvePlayCardEffects([match.effect]).ok;
      }
      if (type === "launch") {
        return getAiLaunchTriggerResolution(match.effect).ok;
      }
      return [
        "gain_resources",
        "gain_data",
        "draw_cards",
        cardEffects.EFFECT_TYPES.CARD_CORNER_EVENT_REWARD,
      ].includes(type);
    }

    function runAiCardTriggerDecision() {
      if (!state.pendingCardTriggerAction) return null;
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工选择卡牌触发` };
      }

      const matches = state.pendingCardTriggerAction.matches || [];
      const selectedIndex = matches.findIndex((match) => canAiResolveCardTriggerMatch(match));
      if (selectedIndex < 0) {
        const reasons = matches.map((match) => ({
          cardLabel: cards.getCardLabel(match?.card),
          effectType: match?.effect?.type || null,
          effectLabel: match?.effect?.label || null,
          reason: match?.effect?.type === "launch"
            ? getAiLaunchTriggerResolution(match.effect, currentPlayer).message || null
            : null,
        }));
        const message = "AI 取消本次不可发动的卡牌触发";
        recordAiAutoBattleLog("card-trigger-skip", `${currentPlayer.colorLabel}${message}`, {
          matches: reasons,
        });
        if (typeof cancelCardTriggerChoice === "function") {
          cancelCardTriggerChoice();
          return { ok: true, progressed: true, skipped: true, message, matches: reasons };
        }
        return {
          ok: false,
          blocked: true,
          message: "AI 没有可处理的卡牌触发",
          matches: reasons,
        };
      }

      const selected = matches[selectedIndex];
      recordAiAutoBattleLog("card-trigger", `${currentPlayer.colorLabel}AI 选择卡牌触发 ${selected.effect?.label || selected.effect?.type}`, {
        selectedIndex,
        cardLabel: cards.getCardLabel(selected.card),
        effectType: selected.effect?.type || null,
        optionCount: matches.length,
      });
      return handleCardTriggerChoice(selectedIndex);
    }

    function runAiCardTriggerFreeMoveDecision() {
      if (!state.pendingCardTriggerFreeMove) return null;
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工选择卡牌触发移动` };
      }

      const candidates = listCardTriggerFreeMoveCandidates(state.pendingCardTriggerFreeMove.match);
      const selected = ai?.policy?.chooseTurnAction?.(candidates, {
        playerState,
        turnState,
        currentPlayer,
      }) || candidates[0] || null;
      if (!selected) return { ok: false, blocked: true, message: "AI 没有可用卡牌触发移动路径" };
      recordAiAutoBattleLog("move-path", `${currentPlayer.colorLabel}AI 选择卡牌触发移动 ${selected.rocketLabel} ${selected.directionLabel}`, {
        selected,
        candidates,
        effectType: state.pendingCardTriggerFreeMove.match?.effect?.type || null,
      });
      return executeFreeMoveForCardTrigger(selected.deltaX, selected.deltaY, selected.rocketId);
    }

    function runAiCardTaskCompletionDecision() {
      if (!state.pendingCardTaskCompletion) return null;
      const currentPlayer = getPendingOwnerPlayer(state.pendingCardTaskCompletion);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工确认任务完成` };
      }
      const ready = state.pendingCardTaskCompletion.ready || null;
      const unsupportedEffect = (ready?.effects || []).find((effect) => !canAiResolveAlienTraceEffect(effect, currentPlayer));
      if (unsupportedEffect) {
        return {
          ok: false,
          blocked: true,
          message: `${currentPlayer.colorLabel}AI 跳过无合法目标的任务奖励 ${cards.getCardLabel(ready?.card)}`,
        };
      }
      recordAiAutoBattleLog("card-task", `${currentPlayer.colorLabel}AI 确认完成任务 ${cards.getCardLabel(ready?.card)}`, {
        cardLabel: cards.getCardLabel(ready?.card),
        effectTypes: (ready?.effects || []).map((effect) => effect?.type || null).filter(Boolean),
      });
      return confirmCardTaskCompletion("confirm", { automated: true });
    }

    function scoreAiReadyCardTask(ready, player = getCurrentPlayer()) {
      if (!ready) return -Infinity;
      if ((ready.effects || []).some((effect) => !canAiResolveAlienTraceEffect(effect, player))) return -Infinity;
      const effectValue = (ready.effects || [])
        .reduce((total, effect) => total + scoreAiEffectValue(effect, { player }), 0);
      const directScore = (ready.effects || [])
        .reduce((total, effect) => total + Math.max(0, aiNumber(effect?.options?.gain?.score)), 0);
      const paceBonus = directScore > 0
        ? Math.min(10, getAiLiveScorePaceDeficit(player) * (getAiRoundNumber() >= 3 ? 0.12 : 0.06))
        : 0;
      if (ready.chongTask) {
        const task = ready.task || ready.card?.chongTask || null;
        const fossilId = ready.deliveredTransport?.fossil?.fossilId
          || ready.deliveredTransport?.task?.fossilId
          || null;
        const chongValue = task?.kind === "transport"
          ? scoreAiChongTransportCompletionValue(task, player, { fossilId })
          : scoreAiChongTraceTaskProgressValue(task, player);
        return 8 + Math.max(effectValue + directScore * 0.35 + paceBonus, chongValue);
      }
      return effectValue + directScore * 0.35 + paceBonus;
    }

    function runAiReadyCardTaskOpenDecision() {
      if (state.pendingCardTaskCompletion || isActionEffectFlowActive() || hasActivePendingSubFlow()) return null;
      if (typeof getReadyCardTasks !== "function" || typeof openCardTaskCompletionPicker !== "function") return null;
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) return null;
      const selected = (getReadyCardTasks() || [])
        .map((ready, index) => ({
          ready,
          index,
          score: scoreAiReadyCardTask(ready, currentPlayer),
        }))
        .filter((entry) => entry.ready?.card && Number.isFinite(Number(entry.score)))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0] || null;
      if (!selected) return null;
      recordAiAutoBattleLog("card-task-ready", `${currentPlayer.colorLabel}AI 打开已满足任务 ${cards.getCardLabel(selected.ready.card)}`, {
        cardLabel: cards.getCardLabel(selected.ready.card),
        taskId: selected.ready.task?.id || null,
        score: selected.score,
        effectTypes: (selected.ready.effects || []).map((effect) => effect?.type || null).filter(Boolean),
      });
      return openCardTaskCompletionPicker(selected.ready.card, { player: currentPlayer });
    }

    function getAiBanrenmaOpportunityPlayers() {
      if (typeof openBanrenmaReadyOpportunityForPlayer !== "function") return [];
      const currentPlayer = getCurrentPlayer();
      const currentPlayerId = currentPlayer?.id || null;
      const activeAiPlayers = (getActivePlayers?.() || [])
        .filter((player) => player?.id && isAiAutoBattlePlayer(player.id));
      return [
        ...(currentPlayerId && isAiAutoBattlePlayer(currentPlayerId) ? [currentPlayer] : []),
        ...activeAiPlayers.filter((player) => player?.id !== currentPlayerId),
      ].filter(Boolean);
    }

    function scoreAiBanrenmaTraceEffectValue(effect, player = getCurrentPlayer()) {
      if (!effect || !player || !canAiResolveAlienTraceEffect(effect, player)) return -Infinity;
      const fixedTraceType = effect.options?.traceType || null;
      const traceTypes = fixedTraceType
        ? [fixedTraceType]
        : (effect.options?.allowedTraceTypes?.length
          ? effect.options.allowedTraceTypes
          : aliens?.TRACE_TYPES || []);
      return traceTypes.reduce((best, traceType) => Math.max(
        best,
        aiNumber(scoreAiAlienTraceValue({ player, traceType }))
          + aiNumber(scoreAiB1TraceMarginalValue(player, traceType)),
      ), -Infinity);
    }

    function scoreAiExecutableBanrenmaEffects(effects = [], player = getCurrentPlayer()) {
      if (!player || !Array.isArray(effects) || !effects.length) return -Infinity;
      let value = 0;
      for (const effect of effects) {
        const effectValue = effect?.type === "alien_trace"
          ? scoreAiBanrenmaTraceEffectValue(effect, player)
          : scoreAiEffectValue(effect, { player });
        if (!Number.isFinite(Number(effectValue))) return -Infinity;
        value += aiNumber(effectValue);
      }
      return roundAiScore(value);
    }

    function scoreAiReadyBanrenmaCardOpportunity(card, player = getCurrentPlayer(), markId = null) {
      if (!player || !banrenma?.isBanrenmaCard?.(card)) return -Infinity;
      const mark = banrenma.getReadyScoreMarkForCard?.(alienGameState, player, card, markId);
      if (!mark) return -Infinity;
      return scoreAiExecutableBanrenmaEffects(banrenma.buildConditionEffects?.(card) || [], player);
    }

    function listAiReadyBanrenmaCardOpportunities(player = getCurrentPlayer()) {
      return (player?.reservedCards || [])
        .map((card, index) => {
          if (!banrenma?.isBanrenmaCard?.(card)) return null;
          const mark = banrenma.getReadyScoreMarkForCard?.(alienGameState, player, card);
          if (!mark) return null;
          return {
            card,
            cardId: card.id || null,
            markId: mark.id || null,
            index,
            score: scoreAiReadyBanrenmaCardOpportunity(card, player, mark.id),
          };
        })
        .filter(Boolean)
        .sort((left, right) => {
          const leftScore = Number.isFinite(Number(left.score)) ? Number(left.score) : -Infinity;
          const rightScore = Number.isFinite(Number(right.score)) ? Number(right.score) : -Infinity;
          return rightScore - leftScore || left.index - right.index;
        });
    }

    function openAiPreferredBanrenmaCardOpportunity(player, includeCards, preferred = null) {
      const reservedCards = player?.reservedCards;
      const preferredCardId = includeCards && preferred?.cardId ? preferred.cardId : null;
      const preferredIndex = preferredCardId && Array.isArray(reservedCards)
        ? reservedCards.findIndex((card) => card?.id === preferredCardId)
        : -1;
      if (preferredIndex <= 0) {
        return openBanrenmaReadyOpportunityForPlayer(player, {
          includeCards,
          playerId: player?.id || null,
          playerColor: player?.color || null,
          ...(preferredCardId ? { preferredCardId } : {}),
        });
      }

      const originalOrder = reservedCards.slice();
      const [preferredCard] = reservedCards.splice(preferredIndex, 1);
      reservedCards.unshift(preferredCard);
      try {
        return openBanrenmaReadyOpportunityForPlayer(player, {
          includeCards,
          playerId: player?.id || null,
          playerColor: player?.color || null,
          preferredCardId,
        });
      } finally {
        reservedCards.splice(0, reservedCards.length, ...originalOrder);
      }
    }

    function runAiReadyBanrenmaOpportunityOpenDecision() {
      if (state.pendingBanrenmaOpportunity || state.pendingBanrenmaCardGain) return null;
      if (isActionEffectFlowActive() || hasActivePendingSubFlow()) return null;
      const currentPlayerId = getCurrentPlayer()?.id || null;
      for (const player of getAiBanrenmaOpportunityPlayers()) {
        const includeCards = player.id === currentPlayerId;
        const hasPanelOpportunity = Boolean(
          banrenma?.getPendingPanelMark?.(alienGameState, player)
          && (banrenma?.getAvailableBonusPositions?.(alienGameState) || []).length,
        );
        const readyCardOpportunities = includeCards && !hasPanelOpportunity
          ? listAiReadyBanrenmaCardOpportunities(player)
          : [];
        const preferredCardOpportunity = readyCardOpportunities
          .find((entry) => Number.isFinite(Number(entry.score))) || null;
        if (readyCardOpportunities.length && !preferredCardOpportunity) continue;
        const result = openAiPreferredBanrenmaCardOpportunity(
          player,
          includeCards,
          preferredCardOpportunity,
        );
        if (!result) continue;
        if (result.ok === false) return result;
        recordAiAutoBattleLog("alien-use", `${player.colorLabel}AI 打开半人马达标机会`, {
          logPlayerId: player.id || null,
          logPlayerColor: player.color || null,
          includeCards,
          preferredCardId: preferredCardOpportunity?.cardId || null,
          preferredCardScore: preferredCardOpportunity?.score ?? null,
          readyCardScores: readyCardOpportunities.map((entry) => ({
            cardId: entry.cardId,
            markId: entry.markId,
            score: Number.isFinite(Number(entry.score)) ? entry.score : null,
          })),
          result,
        });
        return {
          ok: true,
          progressed: true,
          opened: true,
          result,
          message: result.message || "AI 已打开半人马达标机会",
        };
      }
      return null;
    }

    function listAiRunezuFaceSymbolQuickCandidates(player = getCurrentPlayer()) {
      if (
        !player
        || typeof openRunezuFaceSymbolPlacement !== "function"
        || !runezu?.isRunezuRevealedSlot
        || state.pendingRunezuFaceSymbolPlacement
        || isActionEffectFlowActive()
        || hasActivePendingSubFlow()
        || isCardSelectionActive()
        || isDiscardSelectionActive()
      ) {
        return [];
      }
      const candidates = [];
      for (const alienSlotId of aliens?.ALIEN_SLOT_IDS || []) {
        if (!runezu.isRunezuRevealedSlot(alienGameState, alienSlotId)) continue;
        for (const position of runezu.FACE_SYMBOL_POSITIONS || []) {
          const check = runezu.canPlaceFaceSymbol?.(alienGameState, position, player);
          if (!check?.ok) continue;
          const bestChoice = (check.choices || [])
            .map((choice) => ({
              symbolId: choice.symbolId,
              score: scoreAiRunezuFaceSymbolPlacementChoice(check.position, choice.symbolId, player),
            }))
            .filter((choice) => Number.isFinite(Number(choice.score)))
            .sort((left, right) => right.score - left.score)[0] || null;
          if (!bestChoice || bestChoice.score <= 0) continue;
          candidates.push({
            id: "runezuFaceSymbol",
            kind: "quick",
            available: true,
            alienSlotId: Number(alienSlotId),
            position: Number(check.position),
            symbolId: bestChoice.symbolId,
            score: bestChoice.score,
            gain: bestChoice.score,
            cost: 0,
            reason: null,
            valueBreakdown: {
              symbolId: bestChoice.symbolId,
              rewardValue: scoreAiRunezuFaceRewardValue(check.position, player),
              finalPenalty: scoreAiRunezuSpendSymbolFinalPenalty(bestChoice.symbolId, player),
              dependencyUnlockValue: scoreAiRunezuFaceDependencyUnlockValue(check.position, bestChoice.symbolId, player),
            },
          });
        }
      }
      return candidates.sort((left, right) => right.score - left.score);
    }

    function runAiRunezuFaceSymbolQuickActionDecision(action) {
      if (!action || typeof openRunezuFaceSymbolPlacement !== "function") {
        return { ok: false, message: "AI 缺少符文族黑圈快速行动入口" };
      }
      const currentPlayer = getCurrentPlayer();
      recordAiAutoBattleLog("alien-use", `${currentPlayer.colorLabel}AI 打开符文族黑圈`, {
        logPlayerId: currentPlayer.id || null,
        logPlayerColor: currentPlayer.color || null,
        action,
      });
      return openRunezuFaceSymbolPlacement(action.alienSlotId, action.position);
    }











    function runAiCardCornerQuickActionDecision(action) {
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工确认卡牌快速行动` };
      }
      if (!Number.isInteger(Number(action?.handIndex))) {
        return { ok: false, message: "AI 卡牌快速行动缺少手牌索引" };
      }
      recordAiAutoBattleLog("card-corner", `${currentPlayer.colorLabel}AI 使用手牌角标 ${action.cardLabel}`, {
        action,
      });
      const selectResult = handleHandCardCornerQuickAction(action.handIndex);
      if (!selectResult?.ok) return selectResult;
      const result = confirmCardCornerQuickAction();
      return result || { ok: true, progressed: true, action };
    }

    function runAiPlayCardSelectionDecision() {
      if (!isPlayCardSelectionActive()) return null;
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工选择打牌` };
      }
      const pending = getPendingPlayCardSelection();
      if (pending?.source === "future_span") {
        return { ok: false, blocked: true, message: "AI 暂不支持未来跨度目标牌打出" };
      }
      if (pending?.source === "hand") {
        recordAiAutoBattleLog("play-card", `${currentPlayer.colorLabel}AI 确认打出 ${cards.getCardLabel(pending.card)}`, {
          handIndex: pending.handIndex,
          card: pending.card,
        });
        return confirmPlayCardSelection();
      }
      const candidates = listAiPlayCardCandidates(currentPlayer);
      const selected = ai?.policy?.choosePlayCard?.(candidates, {
        playerState,
        turnState,
        currentPlayer,
      }) || candidates[0] || null;
      if (!selected) {
        return { ok: false, blocked: true, message: "AI 没有可打出的普通手牌" };
      }
      const selectedLabel = getAiCardDisplayLabel(selected, currentPlayer) || selected.cardLabel || "未知卡牌";
      recordAiAutoBattleLog("play-card", `${currentPlayer.colorLabel}AI 选择打出 ${selectedLabel}`, {
        selected,
        selectedLabel,
        candidates,
      });
      const selectResult = handlePlayCardSelect(selected.handIndex);
      if (!selectResult?.ok) return selectResult;
      return confirmPlayCardSelection();
    }

    function getAiMoveTurnKey(playerId = playerState.currentPlayerId) {
      return `${turnState.roundNumber}:${turnState.turnNumber}:${playerId || "unknown"}`;
    }

    function getAiMoveCountThisTurn(playerId = playerState.currentPlayerId) {
      const key = getAiMoveTurnKey(playerId);
      return Math.max(0, Math.round(Number(aiAutoBattleState.turnMoveCounts[key]) || 0));
    }

    function incrementAiMoveCountThisTurn(playerId = playerState.currentPlayerId) {
      const key = getAiMoveTurnKey(playerId);
      aiAutoBattleState.turnMoveCounts[key] = getAiMoveCountThisTurn(playerId) + 1;
    }

    function canAiMoveThisTurn(playerId = playerState.currentPlayerId) {
      return getAiMoveCountThisTurn(playerId) < aiAutoBattleState.maxMovesPerTurn;
    }

    function getAiCardCornerMoveCountThisTurn(playerId = playerState.currentPlayerId) {
      const key = getAiMoveTurnKey(playerId);
      return Math.max(0, Math.round(Number(aiAutoBattleState.turnCardCornerMoveCounts[key]) || 0));
    }

    function incrementAiCardCornerMoveCountThisTurn(playerId = playerState.currentPlayerId) {
      const key = getAiMoveTurnKey(playerId);
      aiAutoBattleState.turnCardCornerMoveCounts[key] = getAiCardCornerMoveCountThisTurn(playerId) + 1;
    }

    function canAiUseCardCornerMoveThisTurn(playerId = playerState.currentPlayerId) {
      return getAiCardCornerMoveCountThisTurn(playerId) < AI_MAX_CARD_CORNER_MOVES_PER_TURN;
    }


    function getAiPendingDecisionPlayer(pending = null) {
      return getPendingOwnerPlayer(pending, pending?.effect || getCurrentActionEffect?.() || null);
    }

    function queryAiButtons(selector) {
      return [...(els.scanTargetActions?.querySelectorAll(selector) || [])]
        .filter((button) => button && !button.disabled);
    }

    function chooseFirstAiButton(selector) {
      return queryAiButtons(selector)[0] || null;
    }

    function scoreAiHandCornerChoice(choice, counts = {}) {
      if (choice === "move") return aiNumber(counts.move) * AI_RESOURCE_VALUES.movement;
      if (choice === "data") return aiNumber(counts.data) * AI_RESOURCE_VALUES.availableData;
      if (choice === "publicity") return aiNumber(counts.publicity) * AI_RESOURCE_VALUES.publicity;
      return -Infinity;
    }

    function chooseAiHandCornerChoice(pending) {
      return queryAiButtons("[data-hand-corner-choice]")
        .map((button, index) => ({
          button,
          choice: button.dataset.handCornerChoice,
          index,
          score: scoreAiHandCornerChoice(button.dataset.handCornerChoice, pending?.counts || {}),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0] || null;
    }

    function getAiIncomeGainValue(card) {
      const gain = cards.getIncomeGainForCard?.(card) || null;
      if (!gain) return 0;
      return scoreAiResourceBundle(gain);
    }

    function chooseAiDiscardAnyIncomeCards(pending, player) {
      const pendingChoices = new Set((pending?.choices || []).map((card) => card?.id).filter(Boolean));
      const hand = (player?.hand || []).filter((card) => !pendingChoices.size || pendingChoices.has(card.id));
      return hand
        .map((card, index) => ({
          card,
          index,
          score: getAiIncomeGainValue(card) - Math.max(0, scoreAiCardCornerOpportunity(card)) * 0.15,
        }))
        .filter((entry) => entry.card?.id && entry.score > 0)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .map((entry) => entry.card);
    }

    function scoreAiPayCreditReward(effect, player) {
      const reward = effect?.options?.reward || null;
      if (!reward) return 0;
      if (reward.type === "gain_resources") {
        return scoreAiResourceBundle(reward.options?.gain || {});
      }
      return 0;
    }

    function chooseAiDiscardCornerRepeatCard(pending, player) {
      return (pending?.choices || player?.hand || [])
        .map((card, index) => ({
          card,
          index,
          score: scoreAiCardCornerOpportunity(card) - Math.max(0, getCardPrice(card)) * 0.1,
        }))
        .filter((entry) => entry.card?.id && Number.isFinite(entry.score))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.card || null;
    }

    function chooseAiProbeSectorScanChoices(pending) {
      const maxTargets = Math.max(1, Math.round(aiNumber(pending?.effect?.options?.maxTargets || 1)));
      return (pending?.choices || [])
        .map((choice, index) => {
          const sectorX = choice?.sector?.x;
          const scanScore = sectorX == null
            ? 0
            : getBestAiNebulaChoiceScore(buildSectorScanChoicesForX(sectorX), {
              player: getAiPendingDecisionPlayer(pending),
              pendingType: "probe_sector_scan",
              gainData: pending?.effect?.options?.gainData,
            });
          return {
            choice,
            index,
            score: Number.isFinite(scanScore) ? scanScore : 0,
          };
        })
        .filter((entry) => entry.choice?.rocket?.id != null)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .slice(0, maxTargets)
        .map((entry) => entry.choice);
    }

    function chooseAiProbeLocationRewardButton() {
      return queryAiButtons("[data-probe-location-reward-rocket-id]")
        .map((button, index) => {
          const dataMatch = String(button.textContent || "").match(/(\d+)\s*数据/);
          return {
            button,
            index,
            score: dataMatch ? Number(dataMatch[1]) * AI_RESOURCE_VALUES.availableData : 0,
          };
        })
        .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.button || null;
    }

    function runAiDataPlacementDecision() {
      if (!els.dataPlaceOverlay || els.dataPlaceOverlay.hidden) return null;
      const pending = state.pendingDataPlaceAction || null;
      const player = getAiPendingDecisionPlayer(pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择数据放置` };
      }
      const selected = chooseAiDataPlacementOptionFromButtons(
        els.dataPlaceActions?.querySelectorAll("[data-place-target]") || [],
        player,
      );
      if (!selected) {
        return { ok: false, blocked: true, message: "AI 没有可用数据放置目标" };
      }
      recordAiAutoBattleLog("data-placement", `${player.colorLabel}AI 放置数据`, {
        logPlayerId: player.id,
        selected: {
          target: selected.target,
          blueSlot: selected.blueSlot,
          placementSlot: selected.placementSlot,
          label: selected.label,
          score: selected.score,
        },
      });
      return confirmDataPlacement(selected.target, selected.blueSlot);
    }

    function scoreAiStrategyPassiveSlotChoice(slotId, player = getCurrentPlayer()) {
      const reward = industry?.getStrategySlotReward?.(slotId) || null;
      if (!reward) return -Infinity;
      const bundle = {};
      if (reward.credits) bundle.credits = reward.credits;
      if (reward.publicity) bundle.publicity = reward.publicity;
      if (reward.data) bundle.availableData = reward.data;
      let value = scoreAiResourceBundle(bundle);
      if (reward.data && getAiAvailableDataRoom(player) <= 0) value -= 4;
      return value;
    }

    function runAiStrategyPassiveSlotChoiceDecision() {
      const pending = state.pendingStrategyPassiveSlotChoice;
      if (!pending) return null;
      const effect = getCurrentActionEffect();
      const player = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择宇宙战略集团奖励槽` };
      }
      const rankedChoices = (pending.slotIds || [])
        .map((slotId) => ({
          slotId,
          score: scoreAiStrategyPassiveSlotChoice(slotId, player),
          rewardLabel: industry?.getStrategySlotRewardLabel?.(slotId) || "",
        }))
        .filter((entry) => entry.slotId && Number.isFinite(Number(entry.score)))
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
      const selected = rankedChoices[0] || null;
      if (!selected) {
        return { ok: false, blocked: true, message: "AI 没有可选的宇宙战略集团奖励槽" };
      }
      recordAiAutoBattleLog("industry", `${player.colorLabel}AI 选择宇宙战略集团奖励槽`, {
        logPlayerId: player.id,
        slotId: selected.slotId,
        score: selected.score,
        rewardLabel: selected.rewardLabel,
        choices: rankedChoices,
      });
      return confirmStrategyPassiveSlotChoice(selected.slotId);
    }

    function runAiMovePaymentDecision() {
      if (!isMovePaymentSelectionActive()) return null;
      const currentPlayer = getPendingOwnerPlayer(state.pendingMovePayment);
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工确认移动支付` };
      }

      const requiredMovePoints = state.pendingMovePayment.requiredMovePoints || MOVE_ENERGY_COST;
      const availableEnergy = Math.max(0, Math.round(Number(currentPlayer?.resources?.energy) || 0));
      const moveCardIndexes = (currentPlayer?.hand || [])
        .map((card, index) => (isMovePaymentCard(card) ? index : null))
        .filter((index) => index != null);
      const fallbackMoveCardCost = Math.max(0, aiNumber(getAiResourceValuesForRound().handSize));
      const moveCardEntries = moveCardIndexes.map((handIndex) => {
        const card = currentPlayer.hand?.[handIndex] || null;
        const playCandidate = card ? buildAiPlayCardCandidate(card, handIndex, currentPlayer) : null;
        return {
          card,
          handIndex,
          playCandidate,
          opportunityCost: Math.max(
            fallbackMoveCardCost,
            card ? getAiDiscardedCardOpportunityCost(card, playCandidate) : fallbackMoveCardCost,
          ),
        };
      });
      const moveCardOpportunityCosts = Object.fromEntries(
        moveCardEntries.map((entry) => [entry.handIndex, roundAiScore(entry.opportunityCost)]),
      );
      const rocket = (rocketState.rockets || [])
        .find((item) => Number(item.id) === Number(state.pendingMovePayment.rocketId)) || null;
      const from = rocket ? rocketActions.getRocketSectorCoordinate(rocket) : null;
      const effect = getCurrentActionEffect?.() || state.pendingMovePayment.cardMoveEffectContext?.effect || null;
      const nextEffect = getAiNextActionEffect();
      const to = from
        ? {
          x: solar.mod8(from.x + aiNumber(state.pendingMovePayment.deltaX)),
          y: Math.min(
            rocketActions.SECTOR_RING_MAX,
            Math.max(rocketActions.SECTOR_RING_MIN, aiNumber(from.y) + aiNumber(state.pendingMovePayment.deltaY)),
          ),
        }
        : null;
      const routeScore = scoreAiMoveTowardTargets(from, to, currentPlayer, {
        rocket,
        effect,
        nextEffect,
      });
      const preserveEnergyForRouteCashout = shouldAiPreserveEnergyForRouteCashout(currentPlayer, to, {
        routeTarget: routeScore.target,
        requiredMovePoints,
      });
      const selectedHandIndices = ai?.policy?.chooseMovePaymentIndexes?.(currentPlayer.hand || [], {
        requiredMovePoints,
        availableEnergy,
        moveCardIndexes,
        moveCardOpportunityCosts,
        roundNumber: turnState.roundNumber,
        preserveEnergy: preserveEnergyForRouteCashout,
      }) || [];
      state.pendingMovePayment.selectedHandIndices = selectedHandIndices.slice(0, requiredMovePoints);
      recordAiAutoBattleLog("move-payment", `${currentPlayer.colorLabel}AI 确认移动支付`, {
        rocketId: state.pendingMovePayment.rocketId,
        deltaX: state.pendingMovePayment.deltaX,
        deltaY: state.pendingMovePayment.deltaY,
        requiredMovePoints,
        selectedHandIndices: state.pendingMovePayment.selectedHandIndices,
        selectedCards: state.pendingMovePayment.selectedHandIndices
          .map((handIndex) => {
            const entry = moveCardEntries.find((candidate) => candidate.handIndex === Number(handIndex));
            const card = entry?.card || currentPlayer.hand?.[handIndex] || null;
            if (!card) return null;
            return {
              handIndex,
              cardId: card.cardId || card.id || null,
              cardInstanceId: card.id || null,
              cardLabel: cards.getCardLabel?.(card) || card.cardName || card.label || null,
              opportunityCost: roundAiScore(entry?.opportunityCost),
              playScore: entry?.playCandidate ? roundAiScore(entry.playCandidate.score) : null,
            };
          })
          .filter(Boolean),
        moveCardOpportunityCosts,
        energyCost: Math.max(0, requiredMovePoints - state.pendingMovePayment.selectedHandIndices.length),
        preserveEnergy: preserveEnergyForRouteCashout,
        preserveEnergyForRouteCashout,
      });
      const result = confirmMovePayment({ automated: true });
      if (result?.ok) incrementAiMoveCountThisTurn(currentPlayer.id);
      return result || { ok: false, blocked: true, message: "AI 移动支付未产生结果" };
    }

    function runAiLandTargetDecision() {
      if (!els.landTargetOverlay || els.landTargetOverlay.hidden) return null;
      const pending = state.pendingLandTargetAction || null;
      const player = getAiPendingDecisionPlayer(pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择登陆目标` };
      }
      const optionCount = els.landTargetSelect?.options?.length || 0;
      if (optionCount <= 0) {
        return { ok: false, blocked: true, message: "AI 没有可选登陆目标" };
      }
      const options = typeof pending?.getOptions === "function"
        ? pending.getOptions()
        : abilities.planet.getLandOptions(createActionContext());
      const selected = options?.ok
        ? chooseAiLandChoice(options.choices || [], player)
        : null;
      const selectedIndex = Math.min(
        optionCount - 1,
        Math.max(0, selected?.index ?? 0),
      );
      els.landTargetSelect.value = String(selectedIndex);
      recordAiAutoBattleLog("land-target", `${player.colorLabel}AI 选择登陆目标 ${selectedIndex + 1}`, {
        logPlayerId: player.id,
        optionCount,
        planetId: els.landTargetOverlay.dataset.planetId || null,
        selectedIndex,
        selected: selected
          ? {
            label: selected.choice?.label || null,
            target: selected.choice?.target || null,
            score: selected.score,
          }
          : null,
      });
      const result = confirmLandTargetPicker();
      return result || { ok: true, progressed: true, message: "AI 已选择登陆目标" };
    }

    function runAiProbeSectorScanDecision() {
      const pending = state.pendingProbeSectorScanAction || null;
      if (!pending) return null;
      const player = getAiPendingDecisionPlayer(pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择探测器扇区扫描` };
      }
      const selectedChoices = chooseAiProbeSectorScanChoices(pending);
      if (!selectedChoices.length) {
        return { ok: false, blocked: true, message: "AI 没有可选探测器扇区扫描目标" };
      }
      const maxTargets = Math.max(1, Math.round(aiNumber(pending.effect?.options?.maxTargets || 1)));
      recordAiAutoBattleLog("probe-sector-scan", `${player.colorLabel}AI 选择探测器扇区扫描`, {
        logPlayerId: player.id,
        selectedRocketIds: selectedChoices.map((choice) => choice.rocket?.id),
        maxTargets,
      });
      let result = null;
      for (const choice of selectedChoices) {
        result = handleProbeSectorScanChoice(choice.rocket.id);
        if (maxTargets === 1) return result;
        if (result?.ok === false) return result;
      }
      return confirmProbeSectorScanSelection();
    }

    function runAiProbeLocationRewardDecision() {
      const pending = state.pendingProbeLocationRewardAction || null;
      if (!pending) return null;
      const player = getAiPendingDecisionPlayer(pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择探测器位置奖励` };
      }
      const button = chooseAiProbeLocationRewardButton();
      const rocketId = button?.dataset?.probeLocationRewardRocketId
        || pending.choices?.[0]?.rocket?.id
        || null;
      if (rocketId == null) {
        return { ok: false, blocked: true, message: "AI 没有可选探测器位置奖励目标" };
      }
      recordAiAutoBattleLog("probe-location-reward", `${player.colorLabel}AI 选择探测器位置奖励`, {
        logPlayerId: player.id,
        rocketId,
        label: button?.textContent || "",
      });
      return handleProbeLocationRewardChoice(rocketId);
    }

    function runAiRareScanTargetDecision(pending, player) {
      const pendingType = pending?.type || null;
      if (pendingType === "remove_planet_marker") {
        const button = chooseFirstAiButton("[data-planet-marker-choice]");
        const choiceId = button?.dataset?.planetMarkerChoice || pending.choices?.[0]?.id || null;
        if (!choiceId) return { ok: false, blocked: true, message: "AI 没有可移除的星球标记" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 移除星球标记`, {
          logPlayerId: player.id,
          choiceId,
          label: button?.textContent || "",
        });
        return handleRemovePlanetMarkerChoice(choiceId);
      }

      if (pendingType === "hand_corner_reward") {
        const selected = chooseAiHandCornerChoice(pending);
        const choice = selected?.choice || null;
        if (!choice) return { ok: false, blocked: true, message: "AI 没有可选手牌角标奖励" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 选择手牌角标奖励`, {
          logPlayerId: player.id,
          choice,
          score: selected.score,
        });
        return handleHandCornerChoice(choice);
      }

      if (pendingType === "discard_any_income") {
        const selectedCards = chooseAiDiscardAnyIncomeCards(pending, player);
        for (const card of selectedCards) {
          const result = handleDiscardIncomeCardChoice(card.id);
          if (result?.ok === false) return result;
        }
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 确认收入弃牌`, {
          logPlayerId: player.id,
          selectedCardIds: selectedCards.map((card) => card.id),
        });
        return confirmDiscardAnyForIncome();
      }

      if (pendingType === "pay_credit_reward") {
        const rewardValue = scoreAiPayCreditReward(pending.effect, player);
        const canPay = typeof players.canAfford === "function"
          ? players.canAfford(player, { credits: 1 })
          : aiNumber(player?.resources?.credits) > 0;
        const choice = canPay && rewardValue >= AI_RESOURCE_VALUES.credits * 0.85 ? "pay" : "skip";
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI ${choice === "pay" ? "支付信用" : "跳过信用支付"}`, {
          logPlayerId: player.id,
          rewardValue,
          creditValue: AI_RESOURCE_VALUES.credits,
          choice,
        });
        return handlePayCreditChoice(choice);
      }

      if (pendingType === "discard_corner_repeat") {
        const selectedCard = chooseAiDiscardCornerRepeatCard(pending, player);
        const cardId = selectedCard?.id || chooseFirstAiButton("[data-discard-corner-card-id]")?.dataset?.discardCornerCardId || null;
        if (!cardId) return { ok: false, blocked: true, message: "AI 没有可重复角标的弃牌" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 选择重复角标弃牌`, {
          logPlayerId: player.id,
          cardId,
        });
        return handleDiscardCornerRepeatChoice(cardId);
      }

      if (pendingType === "remove_orbit_to_probe") {
        const button = chooseFirstAiButton("[data-remove-orbit-to-probe]");
        const choiceId = button?.dataset?.removeOrbitToProbe || pending.choices?.[0]?.id || null;
        if (!choiceId) return { ok: false, blocked: true, message: "AI 没有可移除的环绕标记" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 移除环绕放置探测器`, {
          logPlayerId: player.id,
          choiceId,
          label: button?.textContent || "",
        });
        return handleRemoveOrbitToProbeChoice(choiceId);
      }

      if (pendingType === "return_unfinished_task") {
        const selected = (pending.choices || [])
          .map((card, index) => ({ card, index, price: getCardPrice(card) }))
          .sort((left, right) => aiNumber(left.price) - aiNumber(right.price) || left.index - right.index)[0]?.card || null;
        const cardId = selected?.id || chooseFirstAiButton("[data-return-task-card-id]")?.dataset?.returnTaskCardId || null;
        if (!cardId) return { ok: false, blocked: true, message: "AI 没有可返回手牌的任务卡" };
        recordAiAutoBattleLog("rare-scan-target", `${player.colorLabel}AI 返回未完成任务卡`, {
          logPlayerId: player.id,
          cardId,
        });
        return handleReturnUnfinishedTaskChoice(cardId);
      }

      return null;
    }

    function runAiScanTargetDecision() {
      if (!state.pendingScanTargetAction && (!els.scanTargetOverlay || els.scanTargetOverlay.hidden)) return null;
      const probeSectorResult = runAiProbeSectorScanDecision();
      if (probeSectorResult) return probeSectorResult;
      const probeLocationResult = runAiProbeLocationRewardDecision();
      if (probeLocationResult) return probeLocationResult;

      const pending = state.pendingScanTargetAction || null;
      const pendingType = pending?.type || null;
      if (!pendingType) return null;
      const player = getAiPendingDecisionPlayer(pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择扫描目标` };
      }

      if (pendingType === "optional_hand_scan") {
        const hasScannableHandCard = (player?.hand || [])
          .some((card) => card && getPublicScanChoicesForCard(card).ok);
        const choice = hasScannableHandCard ? "start" : "skip";
        recordAiAutoBattleLog("hand-scan", `${player.colorLabel}AI ${choice === "start" ? "开始" : "跳过"}可选手牌扫描`, {
          logPlayerId: player.id,
          choice,
          effectId: pending.effect?.id || null,
        });
        return handleOptionalHandScanChoice(choice);
      }

      if (pendingType === "conditional_sector_scan") {
        const scanTargetOptions = {
          player,
          pendingType,
          gainData: pending.effect?.options?.gainData,
        };
        const rankedButtons = rankAiScanTargetButtons(
          queryAiButtons("[data-conditional-sector-x]"),
          scanTargetOptions,
        );
        const button = rankedButtons[0]?.button || null;
        if (!button) {
          return { ok: false, blocked: true, message: "AI 没有可选条件扇区" };
        }
        recordAiAutoBattleLog("scan-target", `${player.colorLabel}AI 选择条件扇区扫描`, {
          logPlayerId: player.id,
          pendingType,
          sectorX: button.dataset.conditionalSectorX || null,
          label: button.textContent || "",
          selectedScore: roundAiScore(rankedButtons[0]?.score),
          topChoices: rankedButtons
            .slice(0, 6)
            .map((entry) => summarizeAiScanTargetChoiceEntry(entry, player)),
        });
        return handleConditionalSectorChoice(button.dataset.conditionalSectorX);
      }

      const rareResult = runAiRareScanTargetDecision(pending, player);
      if (rareResult) return rareResult;

      if (!["sector_scan", "public_scan", "hand_scan"].includes(pendingType)) {
        return null;
      }
      const scanTargetOptions = {
        player,
        pendingType,
        gainData: pending.gainData,
      };
      const rankedButtons = rankAiScanTargetButtons(
        queryAiButtons(".scan-target-option-button")
          .filter((item) => item.dataset.nebulaId != null),
        scanTargetOptions,
      );
      const button = rankedButtons[0]?.button || null;
      if (!button) {
        let fallbackChoices = pending.choices || [];
        if (!fallbackChoices.length && (pendingType === "public_scan" || pendingType === "hand_scan") && pending.card) {
          const scanChoices = getPublicScanChoicesForCard(pending.card);
          fallbackChoices = scanChoices?.ok ? (scanChoices.choices || []) : [];
        }
        const rankedChoices = rankAiScanTargetChoices(fallbackChoices, {
          player,
          pendingType,
          gainData: pending.gainData,
        });
        const choiceEntry = rankedChoices[0] || null;
        const choice = choiceEntry?.choice || null;
        if (choice) {
          recordAiAutoBattleLog("scan-target", `${player.colorLabel}AI 选择扫描目标`, {
            logPlayerId: player.id,
            pendingType,
            nebulaId: choice.nebulaId || null,
            sectorX: choice.sectorX ?? null,
            label: choice.label || "",
            source: "pending-choice-fallback",
            selectedScore: roundAiScore(choiceEntry?.score),
            topChoices: rankedChoices
              .slice(0, 6)
              .map((entry) => summarizeAiScanTargetChoiceEntry(entry, player)),
          });
          return confirmScanTarget(choice.nebulaId, choice.sectorX);
        }
        if (isActionEffectFlowActive()) {
          const effect = getCurrentActionEffect?.() || null;
          recordAiAutoBattleLog("scan-target", `${player.colorLabel}AI 跳过无目标扫描`, {
            logPlayerId: player.id,
            pendingType,
            effectId: effect?.id || null,
            effectType: effect?.type || null,
          });
          closeScanTargetPicker?.({
            forcePublicScanQueueClose: true,
            forceYichangdianCornerClose: true,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message: "AI 已跳过无可选目标扫描" };
        }
        return { ok: false, blocked: true, message: "AI 没有可选扫描目标" };
      }
      recordAiAutoBattleLog("scan-target", `${player.colorLabel}AI 选择扫描目标`, {
        logPlayerId: player.id,
        pendingType,
        nebulaId: button.dataset.nebulaId || null,
        sectorX: button.dataset.sectorX || null,
        label: button.textContent || "",
        selectedScore: roundAiScore(rankedButtons[0]?.score),
        topChoices: rankedButtons
          .slice(0, 6)
          .map((entry) => summarizeAiScanTargetChoiceEntry(entry, player)),
      });
      return confirmScanTarget(button.dataset.nebulaId, button.dataset.sectorX);
    }

    function buildAiEffectMoveCandidate(rocket, direction, index = 0, options = {}) {
      const currentPlayer = options.player || getCurrentPlayer();
      const moveCheck = rocketActions.canMoveRocket(
        rocketState,
        rocket.id,
        direction.deltaX,
        direction.deltaY,
      );
      if (!moveCheck.ok) return null;

      const effect = options.effect || null;
      const explicitPoolRemaining = options.poolRemaining ?? effect?.options?.movementPoints ?? null;
      const poolRemaining = explicitPoolRemaining == null
        ? 0
        : Math.max(0, Math.round(Number(explicitPoolRemaining) || 0));
      const terrainRequired = getRequiredMovePointsForUi(
        currentPlayer,
        rocket.id,
        direction.deltaX,
        direction.deltaY,
        effect?.options || {},
      );
      if (options.free && poolRemaining > 0 && terrainRequired > poolRemaining) return null;
      const paymentRequired = options.free
        ? 0
        : Math.max(0, terrainRequired - Math.min(poolRemaining, terrainRequired));
      if (paymentRequired > 0 && !canPayForMove(currentPlayer, paymentRequired).ok) return null;

      const from = rocketActions.getRocketSectorCoordinate(rocket);
      const to = from
        ? {
          x: solar.mod8(from.x + direction.deltaX),
          y: Math.min(
            rocketActions.SECTOR_RING_MAX,
            Math.max(rocketActions.SECTOR_RING_MIN, from.y + direction.deltaY),
          ),
        }
        : null;
      const poolUsed = Math.min(poolRemaining, terrainRequired);
      const remainingPoolAfterStep = Math.max(0, poolRemaining - poolUsed);
      const nextEffect = options.nextEffect || null;
      const landingRequiredThisStep = isAiLandingEffect(nextEffect);
      const originPlanet = getAiPlanetAtCoordinate(from);
      const destinationPlanet = getAiPlanetAtCoordinate(to);
      if (isAiChongTravelEffect(nextEffect)) {
        const destinationPlanetId = destinationPlanet?.planetId || null;
        if (
          !isAiChongPickupPlanetId(destinationPlanetId)
          || !(chong?.getAvailablePlanetFossils?.(alienGameState, destinationPlanetId) || []).length
        ) {
          return null;
        }
      }
      const isB49PublicityMoveFollowup = /b49-visit-publicity-move-followup-pay-publicity-move/.test(String(effect?.id || ""));
      if (
        isB49PublicityMoveFollowup
        && !landingRequiredThisStep
        && originPlanet?.planetId
        && originPlanet.planetId !== "earth"
        && (
          canAiPlanetAcceptLanding(originPlanet.planetId, currentPlayer)
          || canAiPlanetAcceptOrbit(originPlanet.planetId)
        )
      ) {
        return null;
      }
      if (
        isB49PublicityMoveFollowup
        && !landingRequiredThisStep
        && destinationPlanet?.planetId
        && destinationPlanet.planetId !== "earth"
      ) {
        return null;
      }
      if (
        effect?.type === cardEffects.EFFECT_TYPES.CARD_MOVE
        && remainingPoolAfterStep > 0
        && !canAiContinueCardMoveAfterStep(rocket, to, remainingPoolAfterStep, effect, currentPlayer)
      ) {
        return null;
      }
      const paymentCost = paymentRequired > 0
        ? scoreAiMovePaymentCost(currentPlayer, paymentRequired)
        : 0;
      if (isAiChongFossilToken(rocket)) {
        return buildAiChongTransportMoveCandidate({
          id: options.id || "effectMove",
          kind: "effect",
          rocket,
          direction,
          index,
          player: currentPlayer,
          from,
          to,
          terrainRequired,
          paymentRequired,
          paymentCost,
          free: options.free,
          effect,
          nextEffect,
        });
      }
      const landingScore = landingRequiredThisStep
        ? scoreAiLandingAfterMove(to, nextEffect, currentPlayer)
        : { ok: true, score: 0, planet: null };
      if (!landingScore.ok) return null;
      const routeScore = scoreAiMoveTowardTargets(from, to, currentPlayer, {
        rocket,
        effect,
        nextEffect,
      });
      const finalSecondMarkNoDirectSetupPenalty = scoreAiFinalSecondMarkNoDirectSetupPenalty(currentPlayer, {
        actionId: options.id || "effectMove",
        directScoreGain: 0,
        followupDirectScore: landingScore.directScoreGain,
        setupScore: routeScore.score,
        consumesHand: false,
        noCashoutRoute: Math.max(0, aiNumber(landingScore.directScoreGain)) <= 0
          && routeScore.target?.kind === "planet",
      });
      const movementGain = applyAiStrategyWeight(applyAiStrategyWeight(routeScore.score, "route", 0.7), "move", 0.8) * 0.75
        + direction.score * 0.08
        + scoreAiMoveArrivalRewardValue(to, currentPlayer, { free: paymentRequired <= 0 }) * 0.85
        + applyAiStrategyWeight(landingScore.score, "orbitLand", 0.6);
      const nearestActionablePlanetPenalty = scoreAiNearestActionablePlanetTimingPenalty({
        player: currentPlayer,
        effect,
        nextEffect,
        from,
        to,
        direction,
        routeScore,
        followupScore: landingScore.score,
        remainingPoolAfterStep,
        industryHuanyuMove: options.industryHuanyuMove,
      });
      const pathPenalty = scoreAiMovementPathPenalty({
        player: currentPlayer,
        effect,
        nextEffect,
        from,
        to,
        direction,
        requiredMovePoints: terrainRequired,
        routeScore,
        followupScore: landingScore.score,
        remainingPoolAfterStep,
        nearestActionablePlanetPenalty,
        industryHuanyuMove: options.industryHuanyuMove,
      });
      const movementCost = paymentCost + pathPenalty + finalSecondMarkNoDirectSetupPenalty;
      return {
        id: options.id || "effectMove",
        kind: "effect",
        available: true,
        rocketId: rocket.id,
        rocketLabel: formatRocketLabel(rocket),
        direction: direction.id,
        directionLabel: direction.label,
        deltaX: direction.deltaX,
        deltaY: direction.deltaY,
        from,
        to,
        terrainRequired,
        paymentRequired,
        routeTarget: routeScore.target,
        followupLanding: landingRequiredThisStep
          ? {
            planetId: landingScore.planet?.planetId || null,
            planetName: landingScore.planet?.name || null,
            score: landingScore.score,
          }
          : null,
        gain: movementGain,
        cost: movementCost + index * 0.1,
        score: movementGain - movementCost - index * 0.1,
        valueBreakdown: {
          movementGain,
          paymentCost,
          pathPenalty,
          nearestActionablePlanetPenalty,
          finalSecondMarkNoDirectSetupPenalty,
          movementCost,
          routeScore: routeScore.score,
          landingScore: landingScore.score,
          landingDirectScoreGain: landingScore.directScoreGain || 0,
          terrainRequired,
          paymentRequired,
          remainingPoolAfterStep,
          industryHuanyuMove: isAiIndustryHuanyuMoveContext({ ...options, effect }),
        },
      };
    }

    function isAiIndustryHuanyuMoveEffect(effect) {
      return Boolean(
        effect?.options?.industryHuanyuMoveGroupId
        && effect.options?.requireDifferentRocketInGroup,
      );
    }

    function isAiIndustryHuanyuMoveContext(options = {}) {
      return Boolean(options.industryHuanyuMove || isAiIndustryHuanyuMoveEffect(options.effect));
    }

    function getAiCompletedIndustryHuanyuMoveRocketIds(effect) {
      const groupId = effect?.options?.industryHuanyuMoveGroupId || null;
      if (!groupId || !state.pendingActionEffectFlow?.effects?.length) return new Set();
      const used = new Set();
      for (const candidate of state.pendingActionEffectFlow.effects) {
        if (!candidate || candidate === effect || candidate.id === effect.id) continue;
        if (candidate.options?.industryHuanyuMoveGroupId !== groupId) continue;
        if (candidate.status !== "completed" || candidate.result?.skipped) continue;
        const rocketId = Math.round(Number(
          candidate.result?.payload?.rocketId
          ?? candidate.result?.rocket?.id
          ?? candidate.result?.rocketId,
        ));
        if (Number.isInteger(rocketId)) used.add(rocketId);
      }
      return used;
    }

    function listAiEffectMoveCandidates(options = {}) {
      const currentPlayer = options.player || getCurrentPlayer();
      if (!currentPlayer) return [];
      const effect = options.effect || getCurrentActionEffect?.() || null;
      const usedHuanyuRocketIds = isAiIndustryHuanyuMoveEffect(effect)
        ? getAiCompletedIndustryHuanyuMoveRocketIds(effect)
        : null;
      return getMovableTokensForPlayer(currentPlayer.id)
        .filter((rocket) => !usedHuanyuRocketIds?.has(Number(rocket.id)))
        .flatMap((rocket, index) => AI_MOVE_DIRECTIONS
          .map((direction) => buildAiEffectMoveCandidate(rocket, direction, index, {
            ...options,
            effect,
          }))
          .filter(Boolean));
    }

    function runAiActionEffectMoveDecision() {
      if (!state.pendingActionEffectFlow?.cardMoveEffect && !state.pendingActionEffectFlow?.freeMoveMode) return null;
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工选择移动路径` };
      }

      if (state.pendingActionEffectFlow.freeMoveMode) {
        const candidates = listAiEffectMoveCandidates({ id: "freeMove", free: true });
        const selected = ai?.policy?.chooseTurnAction?.(candidates, {
          playerState,
          turnState,
          currentPlayer,
        }) || candidates[0] || null;
        if (!selected || aiNumber(selected.score) < 0) {
          const message = "AI 没有可用免费移动路径，跳过移动效果";
          recordAiAutoBattleLog("move-path-skip", `${currentPlayer.colorLabel}${message}`, {
            reason: selected ? "negative-free-move-score" : "no-free-move-candidates",
            selected,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message };
        }
        recordAiAutoBattleLog("move-path", `${currentPlayer.colorLabel}AI 选择免费移动 ${selected.rocketLabel} ${selected.directionLabel}`, {
          selected,
          candidates,
        });
        const result = executeFreeMoveForScanAction4(selected.deltaX, selected.deltaY, selected.rocketId);
        if (result?.ok !== false) return result;
        skipCurrentActionEffect?.();
        return {
          ok: true,
          progressed: true,
          skipped: true,
          message: `免费移动执行失败，已跳过：${result.message || "未知原因"}`,
        };
      }

      const ctx = state.pendingActionEffectFlow.cardMoveEffect;
      const effect = ctx?.effect || getCurrentActionEffect();
      const nextEffect = getAiNextActionEffect();
      const candidates = listAiEffectMoveCandidates({
        id: "cardMove",
        effect,
        poolRemaining: ctx?.poolRemaining ?? effect?.options?.movementPoints ?? 1,
        nextEffect,
      });
      const selected = ai?.policy?.chooseTurnAction?.(candidates, {
        playerState,
        turnState,
        currentPlayer,
      }) || candidates[0] || null;
      if (!selected || aiNumber(selected.score) < 0) {
        const message = "AI 没有可用卡牌移动路径，跳过移动效果";
        recordAiAutoBattleLog("move-path-skip", `${currentPlayer.colorLabel}${message}`, {
          effectId: effect?.id || null,
          reason: selected ? "negative-card-move-score" : "no-card-move-candidates",
          selected,
        });
        skipCurrentActionEffect?.();
        return { ok: true, progressed: true, skipped: true, message };
      }
      recordAiAutoBattleLog("move-path", `${currentPlayer.colorLabel}AI 选择卡牌移动 ${selected.rocketLabel} ${selected.directionLabel}`, {
        effectId: effect?.id || null,
        selected,
        candidates,
      });
      const result = executeCardMoveForEffect(selected.deltaX, selected.deltaY, selected.rocketId);
      if (result?.ok !== false) return result;
      skipCurrentActionEffect?.();
      return {
        ok: true,
        progressed: true,
        skipped: true,
        message: `卡牌移动执行失败，已跳过：${result.message || "未知原因"}`,
      };
    }

    function runAiCardCornerFreeMoveDecision() {
      if (!state.pendingCardCornerFreeMove) return null;
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工处理卡牌角标移动` };
      }
      const pending = state.pendingCardCornerFreeMove;
      const movementPoints = pending.action?.moveReward?.movementPoints || pending.action?.movementPoints || 1;
      const candidates = listAiEffectMoveCandidates({
        id: "cardCornerMove",
        free: true,
        poolRemaining: movementPoints,
      });
      const selected = ai?.policy?.chooseTurnAction?.(candidates, {
        playerState,
        turnState,
        currentPlayer,
      }) || candidates[0] || null;
      if (!selected) {
        return { ok: false, blocked: true, message: "AI 没有可用卡牌角标移动路径" };
      }
      recordAiAutoBattleLog("move-path", `${currentPlayer.colorLabel}AI 选择卡牌角标移动 ${selected.rocketLabel} ${selected.directionLabel}`, {
        selected,
        candidates,
      });
      const result = executeFreeMoveForCardCorner(selected.deltaX, selected.deltaY, selected.rocketId);
      if (result?.ok) incrementAiCardCornerMoveCountThisTurn(currentPlayer.id);
      return result;
    }

    function runAiIndustryFreeMoveDecision() {
      if (!state.industryFreeMoveState) return null;
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工处理公司免费移动` };
      }
      const candidates = listAiIndustryHuanyuMoveCandidates();
      const selected = ai?.policy?.chooseTurnAction?.(candidates, {
        playerState,
        turnState,
        currentPlayer,
      }) || candidates[0] || null;
      if (!selected || aiNumber(selected.score) < 0) {
        const message = `${state.industryFreeMoveState?.label || "公司免费移动"}：无正收益移动，结束剩余免费移动`;
        recordAiAutoBattleLog("industry", `${currentPlayer.colorLabel}AI 跳过公司剩余免费移动`, {
          candidates,
          message,
        });
        if (typeof finishIndustryAbilityFlow === "function") {
          finishIndustryAbilityFlow(message);
          return { ok: true, progressed: true, message };
        }
        return { ok: false, blocked: true, message: "AI 没有可用公司免费移动路径" };
      }
      recordAiAutoBattleLog("move-path", `${currentPlayer.colorLabel}AI 选择公司免费移动 ${selected.rocketLabel} ${selected.directionLabel}`, {
        selected,
        candidates,
      });
      return executeIndustryFreeMove(selected.deltaX, selected.deltaY, selected.rocketId);
    }

    function listAiScanAction4Candidates(currentPlayer = getCurrentPlayer()) {
      if (!currentPlayer) return [];
      const candidates = [];
      const effect = getCurrentActionEffect?.() || null;
      const skipCost = Boolean(effect?.options?.skipCost);
      const rocketLimit = abilities.rocket.getRocketLimitForPlayer(currentPlayer, createActionContext());
      const activeRocketCount = rocketActions.getRocketsForPlayer
        ? rocketActions.getRocketsForPlayer(rocketState, currentPlayer.id).length
        : getMovableTokensForPlayer(currentPlayer.id).length;
      const canLaunch = activeRocketCount < rocketLimit
        && (skipCost || players.canAfford(currentPlayer, { energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY }));
      if (canLaunch) {
        const launchGain = scoreAiLaunchAction(currentPlayer);
        const launchCost = skipCost ? 0 : scoreAiResourceBundle({ energy: scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY });
        candidates.push({
          id: "launch",
          kind: "effect",
          choice: "launch",
          available: true,
          gain: launchGain,
          cost: launchCost,
          score: launchGain - launchCost,
          valueBreakdown: {
            launchGain,
            launchCost,
            scanAction4: true,
            skipCost,
          },
        });
      }

      candidates.push(...listAiEffectMoveCandidates({
        id: "move",
        free: true,
        poolRemaining: 1,
      }).map((candidate) => ({
        ...candidate,
        id: "move",
        kind: "effect",
        choice: "move",
        valueBreakdown: {
          ...(candidate.valueBreakdown || {}),
          scanAction4: true,
        },
      })));
      return candidates;
    }

    function runAiScanAction4Decision() {
      if (!els.scanAction4Overlay || els.scanAction4Overlay.hidden) return null;
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工处理扫描发射/移动` };
      }

      const candidates = listAiScanAction4Candidates(currentPlayer);
      const selected = ai?.policy?.chooseTurnAction?.(candidates, {
        playerState,
        turnState,
        currentPlayer,
      }) || null;
      if (!selected || aiNumber(selected.score) < 0) {
        const message = "AI 没有正收益的扫描发射/移动选择，跳过效果";
        recordAiAutoBattleLog("scan-action-4-skip", `${currentPlayer.colorLabel}${message}`, {
          selected,
          candidates,
        });
        skipCurrentActionEffect?.();
        return { ok: true, progressed: true, skipped: true, message };
      }

      recordAiAutoBattleLog("scan-action-4", `${currentPlayer.colorLabel}AI 选择扫描发射/移动：${selected.choice}`, {
        selected,
        candidates,
      });
      if (selected.choice === "launch") {
        return handleScanAction4Choice("launch");
      }
      return executeFreeMoveForScanAction4(selected.deltaX, selected.deltaY, selected.rocketId);
    }

    function getAiAlienTraceButtons(selector, roots = []) {
      return [...(roots || [])]
        .flatMap((root) => [...(root?.querySelectorAll?.(selector) || [])])
        .filter((button) => button && !button.disabled)
        .map((button) => button);
    }

    function listAiAlienStateTraceTargets(options = {}) {
      const pickerMode = String(state.alienTracePickerState?.mode || "");
      const allowPendingFallback = Boolean(options.allowPendingFallback && state.pendingAlienTraceAction);
      if (
        pickerMode !== "debug-direct"
        && pickerMode !== "trace-board"
        && !pickerMode.endsWith("-grid")
        && !allowPendingFallback
      ) return [];
      return getAiAlienTraceButtons("[data-state-trace-slot].is-placeable", els.alienTraceLayers || [])
        .map((button) => ({ kind: "state-slot", button }));
    }

    function listAiAlienGridTraceTargets() {
      const pickerMode = String(state.alienTracePickerState?.mode || "");
      const selectorsByMode = {
        "banrenma-grid": "[data-banrenma-trace-slot].is-placeable",
        "yichangdian-grid": "[data-yichangdian-trace-slot].is-placeable",
        "fangzhou-grid": "[data-fangzhou-trace-slot].is-placeable",
        "chong-grid": "[data-chong-trace-slot].is-placeable",
        "amiba-grid": "[data-amiba-trace-slot].is-placeable",
        "aomomo-grid": "[data-aomomo-trace-slot].is-placeable",
        "runezu-grid": "[data-runezu-trace-slot].is-placeable",
        "jiuzhe-grid": "[data-jiuzhe-trace-slot].is-placeable",
      };
      const gridSelectors = pickerMode === "trace-board"
        ? Object.values(selectorsByMode).join(",")
        : selectorsByMode[pickerMode];
      if (!gridSelectors) return [];
      return getAiAlienTraceButtons(gridSelectors, els.alienJiuzheTraceLayers || [])
        .map((button) => ({ kind: "grid-slot", button }));
    }

    function listAiAlienPickerTargets() {
      return [...(els.alienTraceActions?.querySelectorAll("[data-alien-picker-step][data-alien-slot]") || [])]
        .filter((button) => !button.disabled)
        .map((button) => ({ kind: "picker", button }));
    }

    function getAiAlienTraceTargetTraceType(target) {
      const button = target?.button;
      return button?.dataset?.traceType
        || button?.dataset?.stateTraceType
        || button?.dataset?.banrenmaTraceType
        || button?.dataset?.yichangdianTraceType
        || button?.dataset?.fangzhouTraceType
        || button?.dataset?.chongTraceType
        || button?.dataset?.amibaTraceType
        || button?.dataset?.aomomoTraceType
        || button?.dataset?.runezuTraceType
        || button?.dataset?.jiuzheTraceType
        || state.alienTracePickerState?.selectedTraceType
        || (state.alienTracePickerState?.allowedTraceTypes?.length === 1
          ? state.alienTracePickerState.allowedTraceTypes[0]
          : null);
    }

    function getAiAlienTraceTargetPosition(target) {
      const dataset = target?.button?.dataset || {};
      const raw = dataset.tracePosition
        || dataset.position
        || dataset.stateTraceSlot
        || dataset.banrenmaPosition
        || dataset.yichangdianPosition
        || dataset.fangzhouPosition
        || dataset.chongPosition
        || dataset.amibaPosition
        || dataset.aomomoPosition
        || dataset.runezuPosition
        || dataset.jiuzhePosition
        || dataset.banrenmaTraceSlot
        || dataset.yichangdianTraceSlot
        || dataset.fangzhouTraceSlot
        || dataset.chongTraceSlot
        || dataset.amibaTraceSlot
        || dataset.aomomoTraceSlot
        || dataset.runezuTraceSlot
        || dataset.jiuzheTraceSlot;
      const match = String(raw || "").match(/\d+/);
      return match ? Number(match[0]) : null;
    }

    function getAiAlienTraceTargetMode(target, fallbackMode = state.alienTracePickerState?.mode || "") {
      const button = target?.button;
      if (target?.kind === "picker" && button?.dataset?.alienPickerStep === "fangzhou-use") {
        return "fangzhou-use";
      }
      if (target?.kind === "grid-slot" && button?.matches) {
        if (button.matches("[data-banrenma-trace-slot]")) return "banrenma-grid";
        if (button.matches("[data-yichangdian-trace-slot]")) return "yichangdian-grid";
        if (button.matches("[data-fangzhou-trace-slot]")) return "fangzhou-grid";
        if (button.matches("[data-chong-trace-slot]")) return "chong-grid";
        if (button.matches("[data-amiba-trace-slot]")) return "amiba-grid";
        if (button.matches("[data-aomomo-trace-slot]")) return "aomomo-grid";
        if (button.matches("[data-runezu-trace-slot]")) return "runezu-grid";
        if (button.matches("[data-jiuzhe-trace-slot]")) return "jiuzhe-grid";
      }
      return String(fallbackMode || "");
    }

    function scoreAiAlienGridPosition(mode, traceType, position, label) {
      const trace = String(traceType || "");
      const pos = Number(position);
      const positionLadder = scoreAiRevealedAlienGridPosition(pos);
      if (mode === "yichangdian-grid") {
        return 1.4 + positionLadder * 0.55 + (pos >= 4 ? 1.2 : 0);
      }
      if (mode === "fangzhou-grid") {
        if (label.includes("解锁")) return 10 + positionLadder * 0.4;
        return 3 + positionLadder;
      }
      if (mode === "banrenma-grid") return 3 + positionLadder;
      if (mode === "aomomo-grid") return 3 + positionLadder;
      if (mode === "chong-grid" || mode === "amiba-grid" || mode === "runezu-grid") return 2.5 + positionLadder;
      if (mode === "jiuzhe-grid") {
        return 0.8 + positionLadder * 0.75;
      }
      return 0;
    }

    function scoreAiRevealedAlienGridPosition(position) {
      const pos = Math.max(0, Math.round(aiNumber(position)));
      if (pos >= 5) return 8.5;
      if (pos === 4) return 6.5;
      if (pos === 3) return 4.5;
      if (pos === 2) return 3;
      if (pos === 1) return 1.5;
      return 0;
    }

    function getAiAlienTraceTargetReward(mode, traceType, position) {
      if (!traceType || position == null) return null;
      const pos = Number(position);
      if (mode === "jiuzhe-grid") return jiuzhe?.getTraceReward?.(traceType, pos) || null;
      if (mode === "yichangdian-grid") return yichangdian?.getTraceReward?.(traceType, pos) || null;
      if (mode === "fangzhou-grid") return fangzhou?.getTraceReward?.(traceType, pos) || null;
      if (mode === "banrenma-grid") return banrenma?.getTraceReward?.(traceType, pos) || null;
      if (mode === "chong-grid") return chong?.getTraceReward?.(alienGameState, traceType, pos) || null;
      if (mode === "amiba-grid") return amiba?.getTraceReward?.(alienGameState, traceType, pos) || null;
      if (mode === "aomomo-grid") return aomomo?.getTraceReward?.(traceType, pos) || null;
      if (mode === "runezu-grid") return runezu?.getTraceReward?.(alienGameState, traceType, pos) || null;
      return null;
    }

    function getAiAvailableDataTokenCount(player) {
      if (!player) return 0;
      const dataState = data?.ensurePlayerDataState?.(player);
      if (Array.isArray(dataState?.poolTokens)) return dataState.poolTokens.length;
      return Math.max(0, Math.round(aiNumber(player.resources?.availableData)));
    }

    function getAiAllowedAlienTraceTypes(alienModule, allowedTraceTypes) {
      const supportedTypes = alienModule?.TRACE_TYPES || aliens.TRACE_TYPES;
      const requestedTypes = allowedTraceTypes?.length ? allowedTraceTypes : supportedTypes;
      return requestedTypes.filter((traceType) => supportedTypes.includes(traceType));
    }

    function getAiAlienModuleTracePositions(alienModule, traceType) {
      if (typeof alienModule?.getPositionsForTraceType === "function") {
        return alienModule.getPositionsForTraceType(traceType) || [];
      }
      return alienModule?.TRACE_POSITIONS || [];
    }

    function hasAiFeasibleGridTraceTarget(alienModule, alienSlotId, allowedTraceTypes, canPlace) {
      const traceTypes = getAiAllowedAlienTraceTypes(alienModule, allowedTraceTypes);
      return traceTypes.some((traceType) => (
        getAiAlienModuleTracePositions(alienModule, traceType)
          .some((position) => canPlace(traceType, Number(position)))
      ));
    }

    function hasAiFeasibleSimpleGridTraceTarget(alienModule, alienSlotId, allowedTraceTypes, options = {}) {
      const grid = alienModule?.getTraceGrid?.(alienGameState, alienSlotId);
      return hasAiFeasibleGridTraceTarget(alienModule, alienSlotId, allowedTraceTypes, (traceType, position) => {
        if (options.stackPosition === Number(position)) return true;
        return !grid?.[traceType]?.[position];
      });
    }

    function hasAiFeasibleBanrenmaTraceTarget(alienSlotId, allowedTraceTypes, player) {
      if (!banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) return false;
      const grid = banrenma.getTraceGrid?.(alienGameState, alienSlotId);
      const availableData = getAiAvailableDataTokenCount(player);
      return hasAiFeasibleGridTraceTarget(banrenma, alienSlotId, allowedTraceTypes, (traceType, position) => {
        const reward = banrenma.getTraceReward?.(traceType, Number(position));
        const requiredData = Math.max(0, Math.round(aiNumber(reward?.payData)));
        if (requiredData > availableData) return false;
        return Number(position) === 1 || !grid?.[traceType]?.[position];
      });
    }

    function getAiBestSimpleGridTraceDirectScore(alienModule, mode, alienSlotId, traceType, options = {}) {
      if (!alienModule || !traceType) return 0;
      const grid = alienModule.getTraceGrid?.(alienGameState, alienSlotId);
      return getAiAlienModuleTracePositions(alienModule, traceType).reduce((best, rawPosition) => {
        const position = Number(rawPosition);
        if (options.stackPosition !== position && grid?.[traceType]?.[position]) return best;
        const reward = getAiAlienTraceTargetReward(mode, traceType, position);
        return Math.max(best, Math.max(0, aiNumber(reward?.gain?.score)));
      }, 0);
    }

    function getAiBestCheckedGridTraceDirectScore(alienModule, mode, alienSlotId, traceType, canPlace) {
      if (!alienModule || !traceType || typeof canPlace !== "function") return 0;
      return getAiAlienModuleTracePositions(alienModule, traceType).reduce((best, rawPosition) => {
        const position = Number(rawPosition);
        if (!canPlace(traceType, position)) return best;
        const reward = getAiAlienTraceTargetReward(mode, traceType, position);
        return Math.max(best, Math.max(0, aiNumber(reward?.gain?.score)));
      }, 0);
    }

    function getAiBestBanrenmaTraceDirectScore(alienSlotId, traceType, player) {
      if (!banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) return 0;
      const grid = banrenma.getTraceGrid?.(alienGameState, alienSlotId);
      const availableData = getAiAvailableDataTokenCount(player);
      return getAiBestCheckedGridTraceDirectScore(banrenma, "banrenma-grid", alienSlotId, traceType, (item, position) => {
        const reward = banrenma.getTraceReward?.(item, Number(position));
        const requiredData = Math.max(0, Math.round(aiNumber(reward?.payData)));
        if (requiredData > availableData) return false;
        return Number(position) === 1 || !grid?.[item]?.[position];
      });
    }

    function getAiBestRevealedAlienTraceDirectScoreForSlot(player, alienSlotId, traceType) {
      if (jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestSimpleGridTraceDirectScore(jiuzhe, "jiuzhe-grid", alienSlotId, traceType);
      }
      if (yichangdian?.isYichangdianRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestSimpleGridTraceDirectScore(yichangdian, "yichangdian-grid", alienSlotId, traceType, { stackPosition: 1 });
      }
      if (fangzhou?.isFangzhouRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(fangzhou, "fangzhou-grid", alienSlotId, traceType, (item, position) => (
          fangzhou.canPlaceFangzhouTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      if (banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestBanrenmaTraceDirectScore(alienSlotId, traceType, player);
      }
      if (chong?.isChongRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(chong, "chong-grid", alienSlotId, traceType, (item, position) => (
          chong.canPlaceChongTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      if (amiba?.isAmibaRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(amiba, "amiba-grid", alienSlotId, traceType, (item, position) => (
          amiba.canPlaceAmibaTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      if (aomomo?.isAomomoRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(aomomo, "aomomo-grid", alienSlotId, traceType, (item, position) => (
          aomomo.canPlaceAomomoTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      if (runezu?.isRunezuRevealedSlot?.(alienGameState, alienSlotId)) {
        return getAiBestCheckedGridTraceDirectScore(runezu, "runezu-grid", alienSlotId, traceType, (item, position) => (
          runezu.canPlaceRunezuTrace?.(alienGameState, alienSlotId, item, position, player)?.ok
        ));
      }
      return 0;
    }

    function hasAiFeasibleRevealedAlienTraceTarget(alienSlotId, allowedTraceTypes, player) {
      if (jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleSimpleGridTraceTarget(jiuzhe, alienSlotId, allowedTraceTypes);
      }
      if (yichangdian?.isYichangdianRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleSimpleGridTraceTarget(yichangdian, alienSlotId, allowedTraceTypes, { stackPosition: 1 });
      }
      if (fangzhou?.isFangzhouRevealedSlot?.(alienGameState, alienSlotId)) {
        const canPlaceOnPanel = hasAiFeasibleGridTraceTarget(fangzhou, alienSlotId, allowedTraceTypes, (traceType, position) => (
          fangzhou.canPlaceFangzhouTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
        const canUnlockCard = (allowedTraceTypes || []).some((traceType) => (
          fangzhou.canUnlockCard2ForTrace?.(alienGameState, player, traceType)
        ));
        return canPlaceOnPanel || canUnlockCard;
      }
      if (banrenma?.isBanrenmaRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleBanrenmaTraceTarget(alienSlotId, allowedTraceTypes, player);
      }
      if (chong?.isChongRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleGridTraceTarget(chong, alienSlotId, allowedTraceTypes, (traceType, position) => (
          chong.canPlaceChongTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
      }
      if (amiba?.isAmibaRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleGridTraceTarget(amiba, alienSlotId, allowedTraceTypes, (traceType, position) => (
          amiba.canPlaceAmibaTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
      }
      if (aomomo?.isAomomoRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleGridTraceTarget(aomomo, alienSlotId, allowedTraceTypes, (traceType, position) => (
          aomomo.canPlaceAomomoTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
      }
      if (runezu?.isRunezuRevealedSlot?.(alienGameState, alienSlotId)) {
        return hasAiFeasibleGridTraceTarget(runezu, alienSlotId, allowedTraceTypes, (traceType, position) => (
          runezu.canPlaceRunezuTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok
        ));
      }
      return true;
    }

    function getAiAlienTracePlayerKeys(player) {
      if (!player) return [];
      return [player.id, player.color, player.colorLabel].filter(Boolean).map(String);
    }

    function listAiAlienTraceEntriesForSlot(alienSlotId, traceType) {
      const slotId = Number(alienSlotId);
      if (jiuzhe?.isJiuzheRevealedSlot?.(alienGameState, slotId)) return jiuzhe.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (yichangdian?.isYichangdianRevealedSlot?.(alienGameState, slotId)) return yichangdian.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (fangzhou?.isFangzhouRevealedSlot?.(alienGameState, slotId)) return fangzhou.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (banrenma?.isBanrenmaRevealedSlot?.(alienGameState, slotId)) return banrenma.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (chong?.isChongRevealedSlot?.(alienGameState, slotId)) return chong.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (amiba?.isAmibaRevealedSlot?.(alienGameState, slotId)) return amiba.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (aomomo?.isAomomoRevealedSlot?.(alienGameState, slotId)) return aomomo.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      if (runezu?.isRunezuRevealedSlot?.(alienGameState, slotId)) return runezu.listTraceEntries?.(alienGameState, slotId, traceType) || [];
      const traceSlot = aliens.getAlienSlot?.(alienGameState, slotId)?.traces?.[traceType];
      return traceSlot?.tokens || [];
    }

    function aiAlienTraceEntryBelongsToPlayer(entry, player) {
      const keys = getAiAlienTracePlayerKeys(player);
      if (!keys.length || !entry) return false;
      return [
        entry.playerId,
        entry.playerColor,
        entry.color,
        entry.ownerPlayerId,
        entry.ownerPlayerColor,
      ].filter(Boolean).map(String).some((key) => keys.includes(key));
    }

    function aiAlienSlotHasPlayerTrace(alienSlotId, traceType, player) {
      return listAiAlienTraceEntriesForSlot(alienSlotId, traceType)
        .some((entry) => aiAlienTraceEntryBelongsToPlayer(entry, player));
    }

    function aiAlienSlotHasPlayerTraceSet(alienSlotId, traceTypes, player) {
      return (traceTypes || []).every((traceType) => aiAlienSlotHasPlayerTrace(alienSlotId, traceType, player));
    }

    function getAiEligibleAlienSlotIdsForTraceEffect(effect, player, traceTypes) {
      const targetRule = effect?.options?.targetRule;
      if (!targetRule) return aliens.ALIEN_SLOT_IDS || [];
      return (aliens.ALIEN_SLOT_IDS || []).filter((alienSlotId) => {
        if (targetRule === "playerHasSameTrace") {
          return (traceTypes || []).some((traceType) => aiAlienSlotHasPlayerTrace(alienSlotId, traceType, player));
        }
        if (targetRule === "singleAlienTraceSet") {
          const requiredTypes = effect.options?.traceTypes || ["yellow", "pink", "blue"];
          return aiAlienSlotHasPlayerTraceSet(alienSlotId, requiredTypes, player);
        }
        return true;
      });
    }

    function canAiPlaceBasicAlienTrace(alienSlotId, traceType) {
      const traceSlot = aliens.getAlienSlot?.(alienGameState, alienSlotId)?.traces?.[traceType];
      return Boolean(traceSlot) && !traceSlot.firstPlaced;
    }

    function canAiResolveAlienTraceEffect(effect, player = getCurrentPlayer()) {
      if (effect?.type !== "alien_trace") return true;
      const traceType = effect.options?.traceType || null;
      const allowedTraceTypes = traceType
        ? [traceType]
        : (effect.options?.allowedTraceTypes?.length ? effect.options.allowedTraceTypes : aliens.TRACE_TYPES || []);
      const eligibleSlots = getAiEligibleAlienSlotIdsForTraceEffect(effect, player, allowedTraceTypes);
      if (!eligibleSlots.length) return false;
      return eligibleSlots.some((alienSlotId) => {
        const slot = aliens.getAlienSlot?.(alienGameState, alienSlotId);
        if (slot?.revealed && slot?.alienId) {
          return hasAiFeasibleRevealedAlienTraceTarget(alienSlotId, allowedTraceTypes, player);
        }
        return allowedTraceTypes.some((item) => canAiPlaceBasicAlienTrace(alienSlotId, item));
      });
    }

    function canAiPlaceAlienGridTraceTarget(target, player = getCurrentPlayer()) {
      if (target?.kind !== "grid-slot") return true;
      const button = target.button;
      const dataset = button?.dataset || {};
      const alienSlotId = Number(dataset.alienSlot || state.alienTracePickerState?.selectedAlienSlotId);
      const traceType = getAiAlienTraceTargetTraceType(target);
      const position = getAiAlienTraceTargetPosition(target);
      if (!Number.isFinite(alienSlotId) || !traceType || position == null) return false;
      if (button.matches?.("[data-banrenma-trace-slot]")) {
        const grid = banrenma?.getTraceGrid?.(alienGameState, alienSlotId);
        const reward = banrenma?.getTraceReward?.(traceType, Number(position));
        const requiredData = Math.max(0, Math.round(aiNumber(reward?.payData)));
        if (requiredData > getAiAvailableDataTokenCount(player)) return false;
        return Number(position) === 1 || !grid?.[traceType]?.[position];
      }
      if (button.matches?.("[data-yichangdian-trace-slot]")) {
        const grid = yichangdian?.getTraceGrid?.(alienGameState, alienSlotId);
        return Number(position) === 1 || !grid?.[traceType]?.[position];
      }
      if (button.matches?.("[data-jiuzhe-trace-slot]")) {
        const grid = jiuzhe?.getTraceGrid?.(alienGameState, alienSlotId);
        return !grid?.[traceType]?.[position];
      }
      if (button.matches?.("[data-fangzhou-trace-slot]")) {
        return Boolean(fangzhou?.canPlaceFangzhouTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      if (button.matches?.("[data-chong-trace-slot]")) {
        return Boolean(chong?.canPlaceChongTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      if (button.matches?.("[data-amiba-trace-slot]")) {
        return Boolean(amiba?.canPlaceAmibaTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      if (button.matches?.("[data-aomomo-trace-slot]")) {
        return Boolean(aomomo?.canPlaceAomomoTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      if (button.matches?.("[data-runezu-trace-slot]")) {
        return Boolean(runezu?.canPlaceRunezuTrace?.(alienGameState, alienSlotId, traceType, position, player)?.ok);
      }
      return true;
    }

    function scoreAiAlienTraceTarget(target, player) {
      if (!target?.button || target.button.disabled) return -Infinity;
      if (!canAiPlaceAlienGridTraceTarget(target, player)) return -Infinity;
      const label = String(target.button.textContent || target.button.title || "");
      const pickerMode = String(state.alienTracePickerState?.mode || "");
      const mode = getAiAlienTraceTargetMode(target, pickerMode);
      const traceType = getAiAlienTraceTargetTraceType(target);
      const position = getAiAlienTraceTargetPosition(target);
      const fangzhouUseChoice = target.button.dataset.fangzhouUse || null;
      const isFangzhouUnlockChoice = mode === "fangzhou-use" && fangzhouUseChoice === "unlock";
      const isStateExtraTraceTarget = target.kind === "state-slot"
        && target.button.dataset.stateTraceKind === "extra";
      const scoringMode = mode === "fangzhou-use" && fangzhouUseChoice === "place" && position != null
        ? "fangzhou-grid"
        : mode;
      const rawReward = isFangzhouUnlockChoice
        ? fangzhou?.getCard2UnlockTraceReward?.()
        : isStateExtraTraceTarget
          ? aliens?.getExtraTraceReward?.()
        : getAiAlienTraceTargetReward(scoringMode, traceType, position);
      const reward = getAiAlienTraceRewardForValuation(scoringMode, rawReward, player);
      const demand = getAiStrategyDemand(player);
      const alienSlot = Number(target.button.dataset.alienSlot || state.alienTracePickerState?.selectedAlienSlotId);
      const traceDemand = traceType
        ? getAiMapDemand(demand.traceTypes, traceType)
          + getAiAlienTraceTargetDemandForSlot(demand, alienSlot, traceType)
        : 0;
      const hiddenFirstTraceColorLost = Number.isFinite(alienSlot)
        && isAiOpenHiddenFirstTraceTarget(alienSlot, traceType)
        && isAiHiddenFirstTraceColorLost(traceType, player);
      const forcedPendingStateExtraTrace = Boolean(
        state.pendingAlienTraceAction
        && target.kind === "state-slot"
        && target.button.dataset.stateTraceKind === "extra"
      );
      if (
        target.kind === "state-slot"
        && mode !== "debug-direct"
        && !forcedPendingStateExtraTrace
        && Number.isFinite(alienSlot)
        && isAiHiddenFirstTraceTakenByOpponent(alienSlot, traceType, player)
      ) {
        return -Infinity;
      }
      if (
        target.kind === "picker"
        && mode === "fangzhou-use"
        && fangzhouUseChoice === "place"
        && target.button.dataset.fangzhouPlaceKind === "state"
        && Number.isFinite(alienSlot)
        && isAiHiddenFirstTraceTakenByOpponent(alienSlot, traceType, player)
      ) {
        return -Infinity;
      }
      if (pickerMode.endsWith("-grid") && target.kind === "picker") return -Infinity;
      if (
        target.kind === "picker"
        && mode !== "fangzhou-use"
        && Number.isFinite(alienSlot)
        && !hasAiFeasibleRevealedAlienTraceTarget(
          alienSlot,
          state.alienTracePickerState?.allowedTraceTypes,
          player,
        )
      ) {
        return -Infinity;
      }
      if (mode === "banrenma-grid" && traceType && position != null) {
        const reward = banrenma?.getTraceReward?.(traceType, position);
        const requiredData = Math.max(0, Math.round(aiNumber(reward?.payData)));
        const availableData = getAiAvailableDataTokenCount(player);
        if (requiredData > availableData) return -Infinity;
      }
      let score = scoreAiAlienTraceValue({
        player,
        traceType,
        alienSlotId: Number.isFinite(alienSlot) ? alienSlot : null,
        mode: scoringMode,
        position,
        label,
        reward,
      });
      if (
        Number.isFinite(alienSlot)
        && isAiHiddenFirstTraceTakenByOpponent(alienSlot, traceType, player)
      ) {
        score -= 12;
      }

      if (target.kind === "grid-slot") score += 12;
      if (target.kind === "picker") score += 8;
      if (target.kind === "state-slot") score += 3;
      if (
        hiddenFirstTraceColorLost
        && (
          target.kind === "state-slot"
          || (
            target.kind === "picker"
            && mode === "fangzhou-use"
            && fangzhouUseChoice === "place"
            && target.button.dataset.fangzhouPlaceKind === "state"
          )
        )
      ) {
        score -= 14;
      }
      score += traceDemand * 0.45;
      score += ({ pink: 4, blue: 3.5, yellow: 3 })[traceType] || 0;
      score += scoreAiAlienGridPosition(scoringMode, traceType, position, label);
      if (label.includes("未揭示")) score += 3;
      if (label.includes("得分") || label.includes("分数")) score += 3;
      if (label.includes("精选")) score += 4.5;
      if (label.includes("牌")) score += 4.5 * getAiAlienCardConversionMultiplier(player);
      if (label.includes("信用")) score += 2;
      if (label.includes("数据") || label.includes("扫描")) score += 1.5;
      if (label.includes("解锁")) score += 8;
      if (reward?.pickAlienCard) {
        score += 4 * getAiAlienCardConversionMultiplier(player);
        score -= scoreAiLateAlienCardConversionPenalty(player);
      }
      if (reward?.drawCards) score += Math.max(0, aiNumber(reward.drawCards)) * 1.8;
      if (reward?.blindDraw) score += Math.max(0, aiNumber(reward.blindDraw)) * 1.4;
      if (isFangzhouUnlockChoice) score += scoreAiFangzhouUnlockChoiceValue(player, traceType);
      score += scoreAiBanrenmaTraceTimingValue(scoringMode, reward, player, position);
      score += scoreAiAomomoTraceTimingValue(scoringMode, reward, player, position);
      score += scoreAiYichangdianAlienCardTracePriorityValue(scoringMode, reward, player, position);
      score += scoreAiYichangdianTraceTimingValue(scoringMode, reward, player, position, traceType, alienSlot);
      if (target.kind === "grid-slot" || target.kind === "state-slot" || (mode === "fangzhou-use" && fangzhouUseChoice === "place") || isFangzhouUnlockChoice) {
        const directScore = Math.max(0, aiNumber(reward?.gain?.score));
        const pointConversionPenalty = scoreAiHighCostPointConversionPenalty(player, {
          actionId: "alienTrace",
          directScore,
          payData: reward?.payData,
          highScoreTarget: directScore >= 15 && aiNumber(reward?.payData) >= 3,
          engineReward: Boolean(reward?.pickAlienCard || reward?.drawCards || reward?.blindDraw),
        });
        if (pointConversionPenalty > 0) score -= pointConversionPenalty;
        if (directScore > 0) {
          const threshold = getAiNextMissingFinalScoreThreshold(player);
          const currentScore = Math.max(0, aiNumber(player?.resources?.score));
          if (threshold && currentScore < threshold && getAiRoundNumber() >= FINAL_ROUND_NUMBER - 1) {
            score += currentScore + directScore >= threshold
              ? (threshold <= 50 ? 16 : 12)
              : Math.min(threshold <= 50 ? 10 : 7, directScore * (threshold <= 50 ? 0.9 : 0.55));
          }
          score += scoreAiPaceValueForDirectScore(directScore, player, {
            baseWeight: getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 0.75 : 0.45,
            pressureWeight: getAiRoundNumber() >= FINAL_ROUND_NUMBER ? 0.4 : 0.22,
          });
          score += scoreAiSecondFinalMarkNudgeValue(directScore, player, { weight: 1.15 });
          score += scoreAiThirdFinalMarkCashoutValue(directScore, player, { weight: 0.85 });
        }
      }
      if (isFangzhouUnlockChoice) {
        const threshold = getAiNextMissingFinalScoreThreshold(player);
        const currentScore = Math.max(0, aiNumber(player?.resources?.score));
        const directScore = Math.max(0, aiNumber(reward?.gain?.score));
        if (threshold && threshold <= 50 && currentScore >= 45 && currentScore < threshold && currentScore + directScore < threshold) {
          score -= 5;
        }
      }

      if (Number.isFinite(alienSlot)) score += (10 - Math.min(10, Math.max(0, alienSlot))) * 0.01;
      return score;
    }

    function chooseAiAlienTraceTarget(player) {
      const pickerMode = String(state.alienTracePickerState?.mode || "");
      let targets = [];
      if (pickerMode.endsWith("-grid")) {
        targets = [
          ...listAiAlienGridTraceTargets(),
          ...listAiAlienStateTraceTargets(),
        ];
      } else if (pickerMode === "debug-direct") {
        targets = listAiAlienStateTraceTargets();
      } else if (pickerMode === "trace-board") {
        targets = [
          ...listAiAlienGridTraceTargets(),
          ...listAiAlienStateTraceTargets(),
        ];
      } else if (pickerMode || state.pendingAlienTraceAction) {
        targets = listAiAlienPickerTargets();
        if (!targets.length && state.pendingAlienTraceAction) {
          targets = listAiAlienStateTraceTargets({ allowPendingFallback: true });
        }
      }
      return targets
        .map((target, index) => ({ ...target, index, score: scoreAiAlienTraceTarget(target, player) }))
        .filter((target) => Number.isFinite(target.score))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0] || null;
    }

    function runAiAlienTraceDecision() {
      if (!state.pendingAlienTraceAction && (!state.alienTracePickerState || !state.alienTracePickerState.mode)) return null;
      const player = getAlienTraceActionPlayer(state.pendingAlienTraceAction || state.alienTracePickerState);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工选择外星人痕迹` };
      }

      const target = chooseAiAlienTraceTarget(player);
      if (!target?.button) {
        const message = "AI 没有可用外星人痕迹目标，已跳过当前效果";
        recordAiAutoBattleLog("alien-trace-skip", message, {
          logPlayerId: player.id || null,
          logPlayerColor: player.color || null,
          mode: state.alienTracePickerState?.mode || null,
        });
        skipCurrentActionEffect?.();
        return { ok: true, progressed: true, skipped: true, message };
      }
      const button = target.button;
      const traceType = getAiAlienTraceTargetTraceType(target);
      recordAiAutoBattleLog("alien-trace", `${player.colorLabel}AI 选择外星人痕迹`, {
        logPlayerId: player.id || null,
        logPlayerColor: player.color || null,
        kind: target.kind,
        mode: state.alienTracePickerState?.mode || null,
        alienSlot: button.dataset.alienSlot || null,
        pickerStep: button.dataset.alienPickerStep || null,
        traceType: traceType || null,
        position: getAiAlienTraceTargetPosition(target),
        score: target.score,
        b1TraceValue: scoreAiB1TraceMarginalValue(player, traceType),
        label: button.textContent || "",
      });
      button.click();
      return { ok: true, progressed: true, message: "AI 已选择外星人痕迹" };
    }

    function getAiAlienPendingPlayer(pending = {}) {
      const explicitPlayerId = pending?.playerId || pending?.targetPlayerId || pending?.player?.id || null;
      const explicitPlayerColor = pending?.playerColor || pending?.targetPlayerColor || pending?.player?.color || null;
      const ownerPlayerId = getEffectOwnerPlayer(pending?.effect)?.id
        || state.pendingActionEffectFlow?.playerId
        || playerState.currentPlayerId;
      const explicitColorPlayer = explicitPlayerColor ? getPlayerByColor(explicitPlayerColor) : null;
      return getPlayerById(explicitPlayerId)
        || explicitColorPlayer
        || getPlayerById(ownerPlayerId)
        || getCurrentPlayer();
    }

    function makeAiAlienChoiceFlow(type, label, pending, selector, datasetKey, handler, options = {}) {
      return {
        type,
        label,
        pending,
        selector,
        allowCancel: options.allowCancel === true,
        getChoice: options.getChoice || ((button) => button?.dataset?.[datasetKey] ?? null),
        handleChoice: handler,
      };
    }

    function getAiAlienUseFlows() {
      return [
        makeAiAlienChoiceFlow(
          "jiuzhe-card",
          "九折牌",
          state.pendingJiuzheCardPlay?.reason === "view" ? null : state.pendingJiuzheCardPlay,
          "[data-jiuzhe-card-choice], [data-jiuzhe-opportunity-skip]",
          null,
          (choice, handlerOptions = {}) => (
            choice === "skip"
              ? handleJiuzheOpportunitySkip?.(handlerOptions)
              : handleJiuzheCardChoice?.(choice, handlerOptions)
          ),
          {
            getChoice: (button) => (button?.dataset?.jiuzheOpportunitySkip ? "skip" : button?.dataset?.jiuzheCardChoice),
          },
        ),
        makeAiAlienChoiceFlow(
          "yichangdian-card",
          "异常点外星人牌",
          state.pendingYichangdianCardGain,
          "[data-yichangdian-card-gain]",
          "yichangdianCardGain",
          handleYichangdianCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "yichangdian-corner",
          "异常点角标",
          state.pendingYichangdianCornerAction,
          "[data-yichangdian-corner-card-id]",
          "yichangdianCornerCardId",
          handleYichangdianCornerChoice,
        ),
        makeAiAlienChoiceFlow(
          "banrenma-card",
          "半人马外星人牌",
          state.pendingBanrenmaCardGain,
          "[data-banrenma-card-gain]",
          "banrenmaCardGain",
          handleBanrenmaCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "banrenma-bonus",
          "半人马顶部奖励",
          state.pendingBanrenmaOpportunity?.type === "panel" ? state.pendingBanrenmaOpportunity : null,
          "[data-banrenma-bonus-choice]",
          "banrenmaBonusChoice",
          handleBanrenmaBonusChoice,
        ),
        makeAiAlienChoiceFlow(
          "banrenma-condition",
          "半人马条件效果",
          state.pendingBanrenmaOpportunity?.type === "card" ? state.pendingBanrenmaOpportunity : null,
          "[data-banrenma-card-choice]",
          "banrenmaCardChoice",
          handleBanrenmaCardConditionChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "chong-card",
          "虫族外星人牌",
          state.pendingChongCardGain,
          "[data-chong-card-gain]",
          "chongCardGain",
          handleChongCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "chong-fossil",
          "虫族化石",
          state.pendingChongFossilChoice,
          "[data-chong-fossil-choice]",
          "chongFossilChoice",
          handleChongFossilChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "chong-task",
          "虫族任务",
          state.pendingChongTaskCompletion,
          "[data-chong-task-complete]",
          "chongTaskComplete",
          handleChongTaskCompletionChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "amiba-card",
          "阿米巴外星人牌",
          state.pendingAmibaCardGain,
          "[data-amiba-card-gain]",
          "amibaCardGain",
          handleAmibaCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "amiba-symbol",
          "阿米巴 symbol",
          state.pendingAmibaSymbolChoice,
          "[data-amiba-symbol-choice]",
          "amibaSymbolChoice",
          handleAmibaSymbolChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "amiba-trace-removal",
          "阿米巴痕迹移除",
          state.pendingAmibaTraceRemoval,
          "[data-amiba-trace-remove]",
          "amibaTraceRemove",
          handleAmibaTraceRemovalChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "aomomo-card",
          "奥陌陌外星人牌",
          state.pendingAomomoCardGain,
          "[data-aomomo-card-gain]",
          "aomomoCardGain",
          handleAomomoCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "runezu-card",
          "符文族外星人牌",
          state.pendingRunezuCardGain,
          "[data-runezu-card-gain]",
          "runezuCardGain",
          handleRunezuCardGainChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "runezu-face-symbol",
          "符文族黑圈",
          state.pendingRunezuFaceSymbolPlacement,
          "[data-runezu-face-symbol-choice]",
          "runezuFaceSymbolChoice",
          handleRunezuFaceSymbolChoice,
          { allowCancel: true },
        ),
        makeAiAlienChoiceFlow(
          "runezu-symbol-branch",
          "符文族符文奖励",
          state.pendingRunezuSymbolBranch,
          "[data-runezu-symbol-branch]",
          "runezuSymbolBranch",
          handleRunezuSymbolBranchChoice,
          { allowCancel: true },
        ),
      ].filter((flow) => flow.pending);
    }


    function listAiAlienUseOptions(flow) {
      const buttons = [...(els.scanTargetActions?.querySelectorAll(flow.selector) || [])];
      let options = buttons.map((button, index) => ({
        button,
        index,
        choice: flow.getChoice(button),
        label: button.textContent || button.title || button.getAttribute?.("aria-label") || "",
        disabled: Boolean(button.disabled),
      }));
      if (flow.type === "banrenma-bonus" && !options.some((option) => !option.disabled)) {
        const synthetic = (banrenma?.getAvailableBonusPositions?.(alienGameState) || [])
          .map((position, index) => ({
            button: null,
            index,
            choice: String(position),
            label: `半人马${position}号奖励`,
            disabled: false,
            synthetic: true,
          }));
        options.push(...synthetic);
      }
      if (flow.type === "jiuzhe-card" && !options.some((option) => !option.disabled) && flow.pending?.reason !== "view") {
        options.push({
          button: null,
          index: 999,
          choice: "skip",
          label: "放弃本次机会",
          disabled: false,
          synthetic: true,
        });
      }
      if (flow.type === "jiuzhe-card" && flow.pending?.reason !== "view") {
        const player = getAiAlienPendingPlayer(flow.pending);
        const cost = flow.pending?.cost || {};
        const needsPayment = Object.keys(cost).length > 0;
        if (needsPayment && player && !players.canAfford(player, cost)) {
          if (!options.some((option) => option.choice === "skip")) {
            options.push({
              button: null,
              index: 999,
              choice: "skip",
              label: "放弃本次机会",
              disabled: false,
              synthetic: true,
            });
          }
          for (const option of options) {
            if (option.choice !== "skip") option.disabled = true;
          }
        }
      }
      if (!options.length && flow.allowCancel) {
        options.push({
          button: null,
          index: 999,
          choice: "cancel",
          label: "取消",
          disabled: false,
        });
      }
      options = enrichAiAlienUseOptions(options, flow);
      return options;
    }

    function runAiAlienUseDecision() {
      const flows = getAiAlienUseFlows();
      if (!flows.length) return null;
      let flow = null;
      let options = [];
      let selected = null;
      for (const candidateFlow of flows) {
        const candidatePlayer = getAiAlienPendingPlayer(candidateFlow.pending);
        if (!isAiAutoBattlePlayer(candidatePlayer?.id)) {
          flow = candidateFlow;
          break;
        }
        const candidateOptions = listAiAlienUseOptions(candidateFlow);
        const candidateSelected = ai?.policy?.chooseAlienUseOption?.(candidateOptions, {
          playerState,
          turnState,
          currentPlayer: candidatePlayer,
          pendingType: candidateFlow.type,
        }) || candidateOptions.find((option) => !option.disabled && option.choice !== "cancel" && option.choice !== "skip") || candidateOptions.find((option) => !option.disabled) || null;
        if (candidateSelected) {
          flow = candidateFlow;
          options = candidateOptions;
          selected = candidateSelected;
          break;
        }
      }
      if (!flow && isActionEffectFlowActive()) return null;
      if (!flow) return { ok: false, blocked: true, message: "AI 没有可处理的外星人选项" };
      const player = getAiAlienPendingPlayer(flow.pending);
      if (!isAiAutoBattlePlayer(player?.id)) {
        return { ok: false, blocked: true, message: `${player?.colorLabel || "当前玩家"}需要人工处理${flow.label}` };
      }
      if (!selected) {
        return { ok: false, blocked: true, message: `AI 没有可用${flow.label}选项` };
      }

      recordAiAutoBattleLog("alien-use", `${player.colorLabel}AI 处理${flow.label}`, {
        logPlayerId: player.id || null,
        logPlayerColor: player.color || null,
        pendingType: flow.type,
        selected: {
          choice: selected.choice,
          label: selected.label,
        },
        options: options.map((option) => ({
          choice: option.choice,
          label: option.label,
          disabled: option.disabled,
          score: option.score,
        })),
      });

      if (typeof flow.handleChoice === "function") {
        return flow.handleChoice(selected.choice, { automated: true });
      }
      selected.button?.click();
      return { ok: true, progressed: true, message: `AI 已处理${flow.label}` };
    }

    function runAiMoveActionDecision(action) {
      const currentPlayer = getCurrentPlayer();
      if (!action?.rocketId) return { ok: false, message: "AI 移动缺少火箭" };
      recordAiAutoBattleLog("move", `${currentPlayer.colorLabel}AI 移动 ${action.rocketLabel || `R${action.rocketId}`} ${action.directionLabel}`, {
        action,
      });
      return moveRocket(action.deltaX, action.deltaY, action.rocketId, { automated: true });
    }


    function runAiResearchTechSelectionDecision(effect) {
      if (!isTechTilePickingActive()) return null;
      const currentPlayer = getCurrentPlayer();
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return { ok: false, blocked: true, message: `${currentPlayer?.colorLabel || "当前玩家"}需要人工选择科技片` };
      }
      const selectionOptions = getAiResearchTechSelectionOptionsForEffect(effect);

      if (techGameState.ui.pendingTileId) {
        const availableSlots = tech.getAvailableBlueSlots(currentPlayer.techState);
        const blueSlot = ai?.policy?.chooseBlueTechSlot?.(availableSlots, {
          currentPlayer,
          techGameState,
          effect,
        }) || availableSlots[0] || null;
        if (blueSlot == null) {
          return { ok: false, blocked: true, message: "AI 没有可用蓝色科技槽位" };
        }
        recordAiAutoBattleLog("tech-placement", `${currentPlayer.colorLabel}AI 选择蓝色科技槽位 ${blueSlot}`, {
          tileId: techGameState.ui.pendingTileId,
          availableSlots,
          blueSlot,
        });
        return confirmTechBlueSlotChoice(blueSlot);
      }

      const candidates = techGameState.ui.industryBorrowMode
        ? listAiBorrowTechCandidates(currentPlayer)
        : listAiResearchTechCandidates(selectionOptions);
      const policySelected = ai?.policy?.chooseResearchTechTile?.(candidates, {
        currentPlayer,
        turnState,
        techGameState,
        effect,
      }) || null;
      const policyCheck = policySelected
        ? getAiResearchTechCandidateExecutionCheck(policySelected, currentPlayer, selectionOptions)
        : null;
      let selected = policySelected || candidates[0] || null;
      const executable = selectExecutableAiResearchTechCandidate(candidates, selected, currentPlayer, selectionOptions);
      if (!executable.candidate && selected?.tileId) {
        recordAiAutoBattleLog("tech-placement-reject", `${currentPlayer.colorLabel}AI 科技候选失效：${selected.tileId}`, {
          selected,
          reason: executable.check?.message || null,
        });
      }
      selected = executable.candidate;
      if (!selected?.tileId) {
        const message = `${effect?.label || "选择科技"}：${executable.check?.message || "没有可研究科技候选"}，已跳过`;
        recordAiAutoBattleLog("tech-placement", `${currentPlayer.colorLabel}AI 跳过科技选择`, {
          effectId: effect?.id || null,
          effectType: effect?.type || null,
          candidates,
          message,
        });
        cancelTechSelection?.();
        skipCurrentActionEffect?.();
        return { ok: true, progressed: true, skipped: true, message };
      }
      if (policySelected?.tileId && policySelected.tileId !== selected.tileId) {
        recordAiAutoBattleLog("tech-placement-retarget", `${currentPlayer.colorLabel}AI 改选科技 ${selected.tileId}`, {
          rejected: policySelected,
          selected,
          reason: policyCheck?.message || null,
        });
      }
      recordAiAutoBattleLog("tech-placement", `${currentPlayer.colorLabel}AI 选择科技 ${selected.tileId}`, {
        selected,
        candidates,
      });
      const result = handleSupplyTechTileClick(selected.tileId);
      if (result?.needsBlueSlotChoice) {
        const availableSlots = result.availableSlots || [];
        const blueSlot = ai?.policy?.chooseBlueTechSlot?.(availableSlots, {
          currentPlayer,
          techGameState,
          effect,
          tileId: selected.tileId,
        }) || availableSlots[0] || null;
        if (blueSlot == null) return result;
        recordAiAutoBattleLog("tech-placement", `${currentPlayer.colorLabel}AI 选择蓝色科技槽位 ${blueSlot}`, {
          tileId: selected.tileId,
          availableSlots,
          blueSlot,
        });
        return confirmTechBlueSlotChoice(blueSlot);
      }
      return result;
    }

    function enumerateAiTurnActions() {
      const context = createActionContext();
      const currentPlayer = getCurrentPlayer();
      const candidates = [];
      if (state.pendingActionExecuted && !isActionEffectFlowActive() && !hasActivePendingSubFlow()) {
        const industryCandidate = buildAiIndustryCandidate(currentPlayer);
        if (industryCandidate) candidates.push(industryCandidate);
        candidates.push(...listAiLateResourceRecoveryTradeCandidates(currentPlayer));
        candidates.push(...listAiMoveCandidates());
        candidates.push(...listAiDataPlacementCandidates(currentPlayer));
        candidates.push(...listAiRunezuFaceSymbolQuickCandidates(currentPlayer));
        candidates.push(...listAiCardCornerQuickCandidates(currentPlayer));
        candidates.push({
          id: "end-turn",
          kind: "end-turn",
          available: true,
          reason: null,
          score: scoreAiPassAction(currentPlayer),
        });
        return candidates;
      }
      if (!canStartMainAction()) return candidates;

      const launchCheck = actions.canExecute("launch", context);
      const postLaunchMovePlan = launchCheck.ok ? scoreAiPostLaunchMovePlan(currentPlayer) : null;
      const launchValue = launchCheck.ok
        ? scoreAiLaunchTurnCandidateValue(currentPlayer, postLaunchMovePlan)
        : {};
      const launchCandidate = {
        id: "launch",
        kind: "main",
        available: launchCheck.ok,
        reason: launchCheck.message || null,
        plan: postLaunchMovePlan?.score > 0 ? postLaunchMovePlan : null,
        gain: launchValue.launchGain || 0,
        cost: aiNumber(launchValue.launchCost) + aiNumber(launchValue.launchReservePenalty),
        score: launchValue.score || 0,
        valueBreakdown: {
          launchGain: launchValue.launchGain || 0,
          launchCost: launchValue.launchCost || 0,
          launchReservePenalty: launchValue.launchReservePenalty || 0,
          postLaunchMovePlanScore: postLaunchMovePlan?.score || 0,
          lateLaunchPenalty: launchValue.lateLaunchPenalty || 0,
          extraLaunchPacePenalty: launchValue.extraLaunchPacePenalty || 0,
          finalSecondMarkExtraLaunchPenalty: launchValue.finalSecondMarkExtraLaunchPenalty || 0,
          noRouteLaunchPenalty: launchValue.noRouteLaunchPenalty || 0,
          weakEarlyPostLaunchRoutePenalty: launchValue.weakEarlyPostLaunchRoutePenalty || 0,
        },
      };
      candidates.push(launchCandidate);
      const orbitCheck = actions.canExecute("orbit", context);
      const orbitCandidate = {
        id: "orbit",
        kind: "main",
        available: orbitCheck.ok,
        reason: orbitCheck.message || null,
        planetId: orbitCheck.planet?.planetId || null,
        planetName: orbitCheck.planet?.name || null,
        finalMarkCashoutIncluded: true,
      };
      orbitCandidate.directScoreGain = orbitCheck.ok
        ? getAiOrbitDirectScoreGain(orbitCandidate.planetId, currentPlayer)
        : 0;
      orbitCandidate.valueBreakdown = {
        directScoreGain: orbitCandidate.directScoreGain,
      };
      orbitCandidate.score = scoreAiOrbitAction(orbitCandidate);
      candidates.push(orbitCandidate);
      const landCheck = actions.canExecute("land", context);
      const landCandidate = {
        id: "land",
        kind: "main",
        available: landCheck.ok,
        reason: landCheck.message || null,
        planetId: landCheck.planet?.planetId || null,
        planetName: landCheck.planet?.name || null,
        energyCost: landCheck.energyCost ?? null,
        choices: landCheck.choices || [],
        finalMarkCashoutIncluded: true,
      };
      landCandidate.directScoreGain = landCheck.ok
        ? getAiBestLandDirectScoreGain(landCandidate.planetId, landCandidate.choices, currentPlayer)
        : 0;
      landCandidate.valueBreakdown = {
        directScoreGain: landCandidate.directScoreGain,
      };
      landCandidate.score = scoreAiLandAction(landCandidate);
      candidates.push(landCandidate);
      const researchTechCheck = actions.canExecute("researchTech", context);
      const takeableTech = researchTechCheck.ok
        ? (researchTechCheck.takeable || [])
          .map((tileId) => buildAiResearchTechCandidate(tileId))
          .filter((candidate) => candidate.available !== false)
        : [];
      const bestTechCandidate = [...takeableTech]
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null;
      const bestTechScore = Number(bestTechCandidate?.score || 0);
      candidates.push({
        id: "researchTech",
        kind: "main",
        available: researchTechCheck.ok && takeableTech.length > 0,
        reason: researchTechCheck.ok && !takeableTech.length
          ? "没有安全的可研究科技"
          : researchTechCheck.message || null,
        takeable: takeableTech,
        plan: bestTechCandidate?.plan || null,
        techType: bestTechCandidate?.techType || null,
        finalFormulaDeltas: bestTechCandidate?.finalFormulaDeltas || null,
        directScoreGain: Math.max(0, aiNumber(bestTechCandidate?.directScoreGain)),
        score: applyAiStrategyWeight(bestTechScore, "engine", 0.5),
        valueBreakdown: {
          directScoreGain: Math.max(0, aiNumber(bestTechCandidate?.directScoreGain)),
          bestTechTileId: bestTechCandidate?.tileId || null,
          bestTechType: bestTechCandidate?.techType || null,
          bestTechBonusId: bestTechCandidate?.bonusId || null,
        },
      });
      const scanCheck = scanEffects.canExecuteScan(getCurrentPlayer(), { standardAction: true });
      const preMoveCandidates = listAiMoveCandidates();
      const bestMoveCandidate = preMoveCandidates.reduce((best, candidate) => (
        aiNumber(candidate?.score) > aiNumber(best?.score) ? candidate : best
      ), null);
      const bestMoveScore = Math.max(0, aiNumber(bestMoveCandidate?.score));
      const analyzeCheck = canAiAnalyzeData(currentPlayer);
      const analyzeBreakdown = analyzeCheck.ok ? buildAiAnalyzeActionValueBreakdown(currentPlayer) : null;
      const analyzeScore = analyzeBreakdown ? analyzeBreakdown.score : 0;
      const analyzeDirectScoreGain = Math.max(0, aiNumber(analyzeBreakdown?.directScoreGain));
      const immediatePlanetActionScore = Math.max(
        orbitCandidate.available ? Number(orbitCandidate.score || 0) : 0,
        landCandidate.available ? Number(landCandidate.score || 0) : 0,
      );
      let scanScore = scanCheck.ok ? scoreAiScanAction(currentPlayer) : 0;
      const scanDirectScoreGain = scanCheck.ok ? getAiScanDirectScoreGain(currentPlayer) : 0;
      const scanPriorityFloor = scanCheck.ok ? scoreAiScanPriorityFloor(currentPlayer) : 0;
      const scanCurrentScore = Math.max(0, aiNumber(currentPlayer?.resources?.score));
      const scanNextThreshold = getAiNextMissingFinalScoreThreshold(currentPlayer);
      const scanScoreToThreshold = scanNextThreshold ? Math.max(1, scanNextThreshold - scanCurrentScore) : Infinity;
      const scanFinalThresholdMiss = scanCheck.ok
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && scanNextThreshold
        && scanCurrentScore < scanNextThreshold
        && scanScoreToThreshold <= 3
        && scanCurrentScore + scanDirectScoreGain < scanNextThreshold;
      const protectB2SectorScanFromPlanetCap = scanCheck.ok
        && shouldAiProtectB2SectorScanFromPlanetCap(currentPlayer);
      if (immediatePlanetActionScore >= 12 && !protectB2SectorScanFromPlanetCap) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, immediatePlanetActionScore - 7)),
        );
      }
      if (getAiRoundNumber() <= 2 && launchCandidate.available && Number(launchCandidate.score || 0) >= 12) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, Number(launchCandidate.score || 0) - 8)),
        );
      }
      if (
        getAiRoundNumber() >= 3
        && Math.max(0, aiNumber(currentPlayer?.resources?.score)) < 25
        && launchCandidate.available
        && Number(launchCandidate.score || 0) >= 10
      ) {
        scanScore = Math.min(scanScore, Math.max(0, Number(launchCandidate.score || 0) - 2));
      }
      const bestEarlyMoveScore = getAiRoundNumber() <= 2 ? bestMoveScore : 0;
      if (bestEarlyMoveScore >= 10) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, bestEarlyMoveScore - 3)),
        );
      }
      const routeCashoutMoveScore = getAiRoundNumber() >= 3
        && Math.max(0, aiNumber(currentPlayer?.resources?.energy)) <= 3
        && bestMoveScore >= 16
        && scanScore <= bestMoveScore + 3
        ? bestMoveScore
        : 0;
      if (routeCashoutMoveScore > 0) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, routeCashoutMoveScore - 3)),
        );
      }
      const analyzeCashoutScore = getAiRoundNumber() >= 2
        && Math.max(0, aiNumber(currentPlayer?.resources?.energy)) <= 2
        && analyzeScore >= 18
        && scanScore <= analyzeScore + 8
        ? analyzeScore
        : 0;
      if (analyzeCashoutScore > 0) {
        scanScore = Math.max(
          scanPriorityFloor,
          Math.min(scanScore, Math.max(0, analyzeCashoutScore - 2)),
        );
      }
      const scanEnergyCost = scanCheck.ok
        ? Math.max(0, aiNumber(scanEffects.getStandardScanCost?.(currentPlayer)?.energy))
        : 0;
      const currentEnergy = Math.max(0, aiNumber(currentPlayer?.resources?.energy));
      const analyzeEnergyCost = Math.max(0, getAiAnalyzeEnergyCost(currentPlayer));
      const weakFinalAnalyzeEnergyCap = scanCheck.ok
        && analyzeCheck.ok
        && currentPlayer?.aiDifficulty === AI_DIFFICULTY_WEAK_START
        && getAiRoundNumber() >= FINAL_ROUND_NUMBER
        && scanEnergyCost > 0
        && analyzeEnergyCost > 0
        && currentEnergy >= scanEnergyCost
        && currentEnergy - scanEnergyCost < analyzeEnergyCost
        && Math.max(0, aiNumber(currentPlayer?.resources?.availableData)) >= 3
        && analyzeScore >= 8
        && analyzeScore < 18
        && scanScore > analyzeScore
        && scanDirectScoreGain <= analyzeDirectScoreGain
        && scanCurrentScore < 170
          ? Math.max(0, analyzeScore - 1)
          : null;
      if (weakFinalAnalyzeEnergyCap !== null) {
        scanScore = Math.min(scanScore, weakFinalAnalyzeEnergyCap);
      }
      const scanEnergyReservationPenalty = scanCheck.ok
        ? scoreAiScanEnergyReservationPenalty(currentPlayer)
        : 0;
      if (scanEnergyReservationPenalty > 0) {
        scanScore = Math.max(0, scanScore - scanEnergyReservationPenalty);
      }
      if (scanFinalThresholdMiss) {
        scanScore = Math.min(scanScore, Math.max(0, scanDirectScoreGain) * 2);
      }
      const scanScoreCapReason = scanFinalThresholdMiss
        ? "终局临门扫描直接分不足"
        : scanCheck.ok && immediatePlanetActionScore >= 12 && !protectB2SectorScanFromPlanetCap
        ? "优先兑现当前位置的环绕/登陆"
          : scanCheck.ok && getAiRoundNumber() <= 2 && launchCandidate.available && Number(launchCandidate.score || 0) >= 12
            ? "优先建立火箭数量"
            : scanCheck.ok
              && getAiRoundNumber() >= 3
              && Math.max(0, aiNumber(currentPlayer?.resources?.score)) < 25
              && launchCandidate.available
              && Number(launchCandidate.score || 0) >= 10
                ? "低于25分时优先发射建立得分路线"
                : scanCheck.ok && bestEarlyMoveScore >= 10
                    ? "优先保持早期移动路线"
                    : scanCheck.ok && routeCashoutMoveScore > 0
                      ? "优先兑现第3轮移动路线"
                      : scanCheck.ok && analyzeCashoutScore > 0
                        ? "优先兑现数据分析"
                        : scanCheck.ok && weakFinalAnalyzeEnergyCap !== null
                          ? "保留终局分析能量"
                          : scanCheck.ok && scanEnergyReservationPenalty > 0
                            ? "保留星球兑现能量"
                            : null;
      candidates.push({
        id: "scan",
        kind: "main",
        available: scanCheck.ok,
        reason: scanCheck.message || null,
        score: scanScore,
        directScoreGain: scanDirectScoreGain,
        scoreCapReason: scanScoreCapReason,
        targetPreview: scanCheck.ok ? buildAiScanActionTargetPreview(currentPlayer) : null,
        valueBreakdown: {
          directScoreGain: scanDirectScoreGain,
          scanEnergyReservationPenalty,
          weakFinalAnalyzeEnergyCap,
        },
      });
      candidates.push({
        id: "analyze",
        kind: "main",
        available: analyzeCheck.ok,
        reason: analyzeCheck.message || null,
        score: analyzeScore,
        directScoreGain: analyzeDirectScoreGain,
        scoreCapReason: analyzeBreakdown?.scoreCapReason || null,
        valueBreakdown: analyzeBreakdown,
      });
      const playCardCandidates = listAiPlayCardCandidates(getCurrentPlayer());
      const bestPlayCardCandidate = [...playCardCandidates]
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null;
      const bestPlayCardScore = Number(bestPlayCardCandidate?.score || 0);
      const bestPlayCardBreakdown = bestPlayCardCandidate?.valueBreakdown || {};
      candidates.push({
        id: "playCard",
        kind: "main",
        available: playCardCandidates.length > 0,
        reason: playCardCandidates.length > 0
          ? null
          : "没有资源可支付的普通手牌",
        playableCards: playCardCandidates,
        cardId: bestPlayCardCandidate?.cardId || null,
        cardInstanceId: bestPlayCardCandidate?.cardInstanceId || null,
        cardLabel: getAiCardDisplayLabel(bestPlayCardCandidate, currentPlayer),
        plan: bestPlayCardCandidate?.plan || null,
        effectTypes: bestPlayCardCandidate?.effectTypes || [],
        finalFormulaDeltas: bestPlayCardCandidate?.finalFormulaDeltas || null,
        directScoreGain: Math.max(0, aiNumber(bestPlayCardCandidate?.directScoreGain)),
        finalMarkCashoutIncluded: true,
        score: applyAiStrategyWeight(bestPlayCardScore, "engine", 0.5),
        valueBreakdown: {
          directScoreGain: Math.max(0, aiNumber(bestPlayCardCandidate?.directScoreGain)),
          c2Type3ProgressValue: Math.max(0, aiNumber(bestPlayCardBreakdown.c2Type3ProgressValue)),
          cFinalTaskProgressValue: Math.max(0, aiNumber(bestPlayCardBreakdown.cFinalTaskProgressValue)),
          endGameExpectedScore: Math.max(0, aiNumber(bestPlayCardBreakdown.endGameExpectedScore)),
          playCardConversionPressure: Math.max(0, aiNumber(bestPlayCardBreakdown.playCardConversionPressure)),
          finalUnreadyTaskSetupSuppressed: Boolean(bestPlayCardBreakdown.finalUnreadyTaskSetupSuppressed),
        },
      });
      const scanCandidate = candidates.find((candidate) => candidate?.id === "scan");
      const researchTechCandidate = candidates.find((candidate) => candidate?.id === "researchTech");
      const playCardCandidate = candidates.find((candidate) => candidate?.id === "playCard");
      const weakEarlyB2SetupScanTieBreak = scoreAiWeakEarlyB2SetupScanTieBreak(
        currentPlayer,
        scanCandidate,
        researchTechCandidate,
      );
      if (weakEarlyB2SetupScanTieBreak > 0 && scanCandidate) {
        scanCandidate.score = roundAiScore(aiNumber(scanCandidate.score) + weakEarlyB2SetupScanTieBreak);
        scanCandidate.valueBreakdown = {
          ...(scanCandidate.valueBreakdown || {}),
          weakEarlyB2SetupScanTieBreak,
        };
      }
      const weakFinalB2TargetedScanTieBreak = scoreAiWeakFinalB2TargetedScanTieBreak(
        currentPlayer,
        scanCandidate,
        playCardCandidate,
      );
      if (weakFinalB2TargetedScanTieBreak > 0 && scanCandidate) {
        scanCandidate.score = roundAiScore(aiNumber(scanCandidate.score) + weakFinalB2TargetedScanTieBreak);
        scanCandidate.valueBreakdown = {
          ...(scanCandidate.valueBreakdown || {}),
          weakFinalB2TargetedScanTieBreak,
        };
      }
      const strongestNonLaunchMain = candidates
        .filter((candidate) => (
          candidate?.kind === "main"
          && candidate.available !== false
          && candidate.id !== "launch"
        ))
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null;
      const strongestPlanetMain = ["orbit", "land"].includes(strongestNonLaunchMain?.id)
        ? strongestNonLaunchMain
        : null;
      const strongestPlanetScore = Math.max(0, aiNumber(strongestPlanetMain?.score));
      const strongestPlanetDirectScore = Math.max(0, aiNumber(strongestPlanetMain?.directScoreGain));
      const needsFirstThresholdCatchup = Math.max(1, Math.round(aiNumber(turnState.roundNumber) || 1)) >= FINAL_ROUND_NUMBER
        && Math.max(0, aiNumber(currentPlayer?.resources?.score)) < 25;
      const finalCatchupMoveScoreCap = needsFirstThresholdCatchup && Number(strongestNonLaunchMain?.score || 0) >= 15
        ? Math.max(0, Number(strongestNonLaunchMain.score || 0) - 1)
        : null;
      const immediatePlanetCashoutMoveScoreCap = strongestPlanetDirectScore > 0
        && strongestPlanetScore >= 20
        && getAiRoundNumber() <= 3
        ? Math.max(0, strongestPlanetScore - 0.5)
        : null;
      const moveCandidates = preMoveCandidates.map((candidate) => {
        let scoreCap = null;
        let scoreCapReason = null;
        const candidateScore = Number(candidate.score || 0);
        if (
          finalCatchupMoveScoreCap != null
          && !candidate.followupMainAction?.actionId
          && candidateScore > finalCatchupMoveScoreCap
        ) {
          scoreCap = finalCatchupMoveScoreCap;
          scoreCapReason = `保留强主行动 ${strongestNonLaunchMain.id}`;
        }
        if (immediatePlanetCashoutMoveScoreCap != null) {
          const followupDirectScore = Math.max(0, aiNumber(candidate.followupMainAction?.directScoreGain));
          if (
            strongestPlanetDirectScore > followupDirectScore
            && candidateScore > immediatePlanetCashoutMoveScoreCap
          ) {
            scoreCap = scoreCap == null
              ? immediatePlanetCashoutMoveScoreCap
              : Math.min(scoreCap, immediatePlanetCashoutMoveScoreCap);
            scoreCapReason = `优先兑现当前${strongestPlanetMain.id === "land" ? "登陆" : "环绕"}得分`;
          }
        }
        if (scoreCap == null) {
          return candidate;
        }
        const cappedGain = scoreCap + Math.max(0, aiNumber(candidate.cost));
        return {
          ...candidate,
          uncappedScore: candidate.score,
          uncappedGain: candidate.gain,
          gain: cappedGain,
          score: scoreCap,
          scoreCapReason,
          valueBreakdown: {
            ...(candidate.valueBreakdown || {}),
            uncappedMovementGain: candidate.valueBreakdown?.movementGain,
            movementGain: cappedGain,
          },
        };
      });
      candidates.push(...moveCandidates);
      const industryCandidate = buildAiIndustryCandidate(currentPlayer);
      if (industryCandidate) candidates.push(industryCandidate);
      candidates.push(...listAiEmergencyAnalyzeEnergyTradeCandidates(currentPlayer));
      candidates.push(...listAiFinalAnalyzeEnergyTradeCandidates(currentPlayer));
      candidates.push(...listAiThirdFinalMarkResourceTradeCandidates(currentPlayer));
      candidates.push(...listAiMainUnlockTradeCandidates(currentPlayer, playCardCandidates, candidates));
      candidates.push(...listAiFinalReadyTaskCreditChainTradeCandidates(currentPlayer));
      candidates.push(...listAiResourceLockMainUnlockTradeCandidates(currentPlayer, candidates));
      candidates.push(...listAiLateResourceRecoveryTradeCandidates(currentPlayer, candidates));
      candidates.push(...listAiDataPlacementCandidates(currentPlayer));
      candidates.push(...listAiRunezuFaceSymbolQuickCandidates(currentPlayer));
      candidates.push(...listAiCardCornerQuickCandidates(currentPlayer, playCardCandidates));
      candidates.push({
        id: "pass",
        kind: "pass",
        available: true,
        reason: null,
        score: scoreAiPassAction(currentPlayer) + (getAiStrategyWeight("pass") - 1) * 10,
      });
      return candidates;
    }


    function executeAiTurnAction(action, currentPlayer = getCurrentPlayer()) {
      if (typeof dispatchRuntimeAction === "function" && [
        "end-turn",
        "launch",
        "researchTech",
        "orbit",
        "land",
        "scan",
        "analyze",
        "playCard",
        "pass",
      ].includes(action?.id)) {
        return dispatchRuntimeAction({ kind: action.id, payload: action });
      }
      if (action.id === "end-turn") {
        endCurrentTurn();
        return { ok: true, progressed: true, action };
      }
      if (action.id === "launch") {
        return runAction("launch");
      }
      if (action.id === "researchTech") {
        return researchTechForCurrentPlayer();
      }
      if (action.id === "orbit") {
        return orbitForCurrentPlayer();
      }
      if (action.id === "land") {
        return landForCurrentPlayer();
      }
      if (action.id === "scan") {
        return beginScanAction();
      }
      if (action.id === "analyze") {
        return analyzeDataForCurrentPlayer();
      }
      if (action.id === "playCard") {
        return beginPlayCardSelection();
      }
      if (action.id === "cardCorner") {
        return runAiCardCornerQuickActionDecision(action);
      }
      if (action.id === "runezuFaceSymbol") {
        return runAiRunezuFaceSymbolQuickActionDecision(action);
      }
      if (action.id === "industry") {
        recordAiAutoBattleLog("industry", `${currentPlayer.colorLabel}AI 使用公司 1x：${action.companyLabel}`, {
          action,
        });
        const result = handleCompanyActionMarkerClick(action.industryCard);
        return result || { ok: true, progressed: true, action };
      }
      if (action.id === "move") {
        return runAiMoveActionDecision(action);
      }
      if (action.id === "placeData") {
        return confirmDataPlacement(action.target, action.blueSlot);
      }
      if (action.id === "quickTrade") {
        return runQuickTrade(action.tradeId, {
          preserveHandIndex: action.preserveHandIndex,
          aiReason: action.reason || null,
          preferBlindDraw: action.preferBlindDraw === true,
        });
      }
      if (action.id === "pass") {
        return passForCurrentPlayer();
      }
      return { ok: false, message: `AI 尚不支持行动 ${action.id}` };
    }

    function shouldRetryAiTurnAction(action, result) {
      if (!action || action.id === "end-turn" || action.id === "pass") return false;
      return result?.ok === false && !result.blocked && !result.progressed;
    }

    function rejectAiTurnActionCandidate(candidates, action, result) {
      return (candidates || []).map((candidate) => (
        candidate === action
          ? {
            ...candidate,
            available: false,
            reason: result?.message || candidate.reason || "AI 执行前二次校验失败",
            rejectedByAiExecution: true,
          }
          : candidate
      ));
    }

    function buildAiPlannerShadowDecision(candidates = [], graphState = {}, player = null, selectedAction = null) {
      const plan = ai?.planner?.chooseTurnPlan?.(candidates, graphState, player?.id || null, {
        quickBeamWidth: 3,
        mainBeamWidth: 6,
      }) || null;
      const firstAction = plan?.firstAction || null;
      if (!firstAction) return null;
      return {
        key: plan.key || null,
        type: plan.type || null,
        score: roundAiScore(aiNumber(plan.score)),
        firstAction: {
          id: firstAction.id || null,
          kind: firstAction.kind || null,
          score: roundAiScore(aiNumber(firstAction.score)),
          actionGraphNet: Number.isFinite(Number(firstAction.actionGraph?.net))
            ? roundAiScore(aiNumber(firstAction.actionGraph.net))
            : null,
          planActionId: firstAction.plan?.quickActionId || firstAction.plan?.actionId || null,
        },
        policyActionId: selectedAction?.id || null,
        diverged: Boolean(selectedAction?.id && selectedAction.id !== firstAction.id),
      };
    }

    function buildAiTurnActionCandidates(currentPlayer = getCurrentPlayer()) {
      if (!isAiAutoBattlePlayer(currentPlayer?.id)) {
        return {
          ok: false,
          blocked: true,
          message: `${currentPlayer?.colorLabel || "当前玩家"}不是电脑玩家`,
          candidates: [],
        };
      }
      const rawCandidates = enumerateAiTurnActions();
      const markedFinalFormulas = getAiMarkedFinalFormulaEntries(currentPlayer);
      const traceCompetition = getAiTraceCompetitionState(currentPlayer);
      const graphState = {
        playerState,
        turnState,
        alienGameState,
        finalScoringState,
        currentPlayer,
        aiMarkedFinalFormulas: markedFinalFormulas,
        aiTraceCompetition: traceCompetition,
      };
      const graphCandidates = ai?.actionGraph?.buildActionGraph
        ? ai.actionGraph.buildActionGraph(rawCandidates, graphState, currentPlayer?.id, {
          markedFormulas: markedFinalFormulas,
          hasMarkedFinalTile: markedFinalFormulas.length > 0,
          traceCompetition,
        })
        : null;
      const graphAdjustedCandidates = Array.isArray(graphCandidates) && graphCandidates.length === rawCandidates.length
        ? graphCandidates.map((candidate, index) => {
          const adjustedCandidate = adjustAiActionGraphCandidateForStyle(
            rawCandidates[index],
            adjustAiActionGraphCandidate(rawCandidates[index], candidate, currentPlayer),
            currentPlayer,
            markedFinalFormulas,
          );
          return {
            ...rawCandidates[index],
            actionGraph: {
              gain: adjustedCandidate.gain,
              cost: adjustedCandidate.cost,
              finalMarginal: adjustedCandidate.finalMarginal,
              goalBonus: adjustedCandidate.goalBonus,
              feasibility: adjustedCandidate.feasibility,
              net: adjustedCandidate.net,
            },
            breakdown: adjustedCandidate.breakdown,
          };
        })
        : rawCandidates;
      return {
        ok: true,
        currentPlayer,
        rawCandidates,
        graphState,
        candidates: applyAiTurnActionSelectionPressure(graphAdjustedCandidates),
      };
    }

    function runAiTurnActionDecision() {
      const currentPlayer = getCurrentPlayer();
      const buildResult = buildAiTurnActionCandidates(currentPlayer);
      if (!buildResult.ok) return buildResult;
      const { rawCandidates, graphState, candidates } = buildResult;
      let selectableCandidates = candidates;
      const rejectedActions = [];
      const maxAttempts = Math.max(1, candidates.length);

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const action = ai?.policy?.chooseTurnAction?.(selectableCandidates, {
          playerState,
          turnState,
          currentPlayer,
        }) || null;
        if (!action) {
          if (!rawCandidates.length && state.actionHistoryHasSession && !state.pendingActionExecuted) {
            const recovery = recoverPendingActionFromOpenHistoryForAi?.();
            if (recovery?.ok) {
              endCurrentTurn();
              recordAiAutoBattleLog("turn-action", `${currentPlayer.colorLabel}AI 恢复并结束当前行动`, {
                recovery,
                sessionInfo: state.actionHistorySessionInfo || null,
              });
              return {
                ok: true,
                progressed: true,
                action: { id: "end-turn-recovered" },
                recovery,
              };
            }
          }
          return {
            ok: false,
            blocked: true,
            message: rejectedActions.length ? "AI 候选均执行失败" : "AI 没有可执行行动",
            candidates: selectableCandidates,
            rejectedActions,
          };
        }
        const resourceLockTradePreviews = action.id === "pass"
          ? buildAiResourceLockTradePreviews(currentPlayer, selectableCandidates)
          : [];
        const earlyNoMainPublicRefillDiagnostic = action.id === "pass"
          ? buildAiEarlyNoMainPublicRefillDiagnostic(currentPlayer, selectableCandidates)
          : null;
        const finalLowHandPassRecoveryDiagnostic = action.id === "pass"
          ? buildAiFinalLowHandPassRecoveryDiagnostic(currentPlayer, selectableCandidates)
          : null;
        const finalHighScorePassRecoveryDiagnostic = action.id === "pass"
          ? buildAiFinalHighScorePassRecoveryDiagnostic(currentPlayer, selectableCandidates)
          : null;
        const plannerShadow = buildAiPlannerShadowDecision(selectableCandidates, graphState, currentPlayer, action);
        recordAiAutoBattleLog("turn-action", `${currentPlayer.colorLabel}AI 执行 ${action.id}`, {
          action,
          candidates: selectableCandidates,
          ...(plannerShadow ? { plannerShadow } : {}),
          ...(resourceLockTradePreviews.length ? { resourceLockTradePreviews } : {}),
          ...(earlyNoMainPublicRefillDiagnostic ? { earlyNoMainPublicRefillDiagnostic } : {}),
          ...(finalLowHandPassRecoveryDiagnostic ? { finalLowHandPassRecoveryDiagnostic } : {}),
          ...(finalHighScorePassRecoveryDiagnostic ? { finalHighScorePassRecoveryDiagnostic } : {}),
        });
        const result = executeAiTurnAction(action, currentPlayer);
        if (shouldRetryAiTurnAction(action, result)) {
          rejectedActions.push({
            id: action.id || null,
            reason: result?.message || null,
            action,
          });
          recordAiAutoBattleLog("turn-action-retry", `${currentPlayer.colorLabel}AI 剔除失效行动 ${action.id}`, {
            action,
            result,
          });
          selectableCandidates = rejectAiTurnActionCandidate(selectableCandidates, action, result);
          continue;
        }
        return result;
      }

      return {
        ok: false,
        blocked: true,
        message: "AI 候选均执行失败",
        candidates: selectableCandidates,
        rejectedActions,
      };
    }

    function runAiActionEffectStep() {
      if (!state.pendingActionEffectFlow) return null;
      const effect = getCurrentActionEffect();
      const playerId = getEffectOwnerPlayer(effect)?.id || state.pendingActionEffectFlow.playerId || playerState.currentPlayerId;
      if (playerId && !isAiAutoBattlePlayer(playerId)) {
        return { ok: false, blocked: true, message: `${getPlayerLabelById(playerId)}需要人工处理效果` };
      }
      if (!effect) return null;
      if (effect.status && effect.status !== "active") {
        recordAiAutoBattleLog("effect", `AI 推进已${effect.status === "completed" ? "完成" : "处理"}效果：${effect.label || effect.type}`, {
          logPlayerId: playerId || null,
          effectId: effect.id || null,
          effectType: effect.type || null,
          effectStatus: effect.status,
        });
        activateNextActionEffect?.();
        return { ok: true, progressed: true, advancedCompletedEffect: true };
      }
      if (
        effect.type === cardEffects.EFFECT_TYPES.CARD_MOVE
        || effect.type === cardEffects.EFFECT_TYPES.FREE_MOVE
      ) {
        const nextEffect = getAiNextActionEffect();
        const effectPlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
        const movableTokens = effectPlayer?.id ? getMovableTokensForPlayer(effectPlayer.id) : [];
        if (!movableTokens.length) {
          if (effect.type === cardEffects.EFFECT_TYPES.CARD_MOVE && isAiLandingEffect(nextEffect)) {
            return { ok: false, blocked: true, message: `${effect.label || "卡牌移动"}：没有可移动的飞船完成后续登陆` };
          }
          const message = `${effect.label || "移动效果"}：没有可移动的飞船，已跳过`;
          recordAiAutoBattleLog("move-path-skip", `${getPlayerLabelById(playerId)}AI 跳过移动效果`, {
            effectId: effect.id || null,
            effectType: effect.type || null,
            playerId: effectPlayer?.id || null,
            message,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message };
        }
      }
      if (effect.type === cardEffects.EFFECT_TYPES.CARD_MOVE) {
        const nextEffect = getAiNextActionEffect();
        const candidates = listAiEffectMoveCandidates({
          id: "cardMove",
          effect,
          poolRemaining: effect?.options?.movementPoints ?? 1,
          nextEffect,
        });
        if (!candidates.length) {
          if (isAiLandingEffect(nextEffect)) {
            return { ok: false, blocked: true, message: `${effect.label || "卡牌移动"}：没有可移动的飞船完成后续登陆` };
          }
          const message = `${effect.label || "卡牌移动"}：没有可用移动路径，已跳过`;
          recordAiAutoBattleLog("move-path-skip", `${getPlayerLabelById(playerId)}AI 跳过卡牌移动效果`, {
            effectId: effect.id || null,
            effectType: effect.type || null,
            message,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message };
        }
      }
      if (isAiResearchTechEffectType(effect.type) && !isTechTilePickingActive()) {
        const effectPlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
        const selectionOptions = getAiResearchTechSelectionOptionsForEffect(effect);
        const candidates = listAiResearchTechCandidates(selectionOptions);
        const executable = selectExecutableAiResearchTechCandidate(
          candidates,
          candidates[0] || null,
          effectPlayer,
          selectionOptions,
        );
        if (!executable.candidate) {
          const message = `${effect.label || "科技行动"}：${executable.check?.message || "没有可研究科技候选"}，已跳过`;
          recordAiAutoBattleLog("tech-placement-skip", `${getPlayerLabelById(playerId)}AI 跳过科技行动效果`, {
            effectId: effect.id || null,
            effectType: effect.type || null,
            candidates,
            message,
          });
          skipCurrentActionEffect?.();
          return { ok: true, progressed: true, skipped: true, message };
        }
      }
      const researchTechResult = runAiResearchTechSelectionDecision(effect);
      if (researchTechResult) return researchTechResult;
      recordAiAutoBattleLog("effect", `AI 处理效果：${effect.label || effect.type}`, {
        logPlayerId: playerId || null,
        effectId: effect.id || null,
        effectType: effect.type || null,
      });
      const result = executeActionEffect(effect);
      if (
        result?.ok === false
        && (
          effect.type === cardEffects.EFFECT_TYPES.CARD_MOVE
          || effect.type === cardEffects.EFFECT_TYPES.FREE_MOVE
        )
      ) {
        skipCurrentActionEffect?.();
        return {
          ok: true,
          progressed: true,
          skipped: true,
          message: `${effect.label || "移动效果"}执行失败，已跳过：${result.message || "未知原因"}`,
        };
      }
      return result;
    }

    function hasAiPendingDecisionForCurrentEffect(pending = getAiAutoBattlePendingState()) {
      if (!pending) return false;
      return [
        "pendingScanTargetType",
        "pendingPublicScanQueue",
        "pendingHandScan",
        "pendingPassReserve",
        "pendingCardSelection",
        "pendingPlayCardSelection",
        "pendingMovePayment",
        "pendingCardTrigger",
        "pendingCardTriggerFreeMove",
        "pendingCardCornerFreeMove",
        "pendingCardTaskCompletion",
        "pendingStrategyPassiveSlotChoice",
        "pendingJiuzheCardPlay",
        "pendingYichangdianCardGain",
        "pendingYichangdianCornerAction",
        "pendingBanrenmaCardGain",
        "pendingBanrenmaOpportunity",
        "pendingChongTaskCompletion",
        "pendingChongCardGain",
        "pendingChongFossilChoice",
        "pendingAmibaCardGain",
        "pendingAmibaSymbolChoice",
        "pendingAmibaTraceRemoval",
        "pendingAomomoCardGain",
        "pendingRunezuCardGain",
        "pendingRunezuSymbolBranch",
        "pendingRunezuFaceSymbolPlacement",
        "pendingAlienTrace",
        "pendingLandTarget",
        "pendingScanAction4",
        "pendingDataPlacement",
        "pendingActionEffectCardMove",
        "pendingActionEffectFreeMove",
        "pendingIndustryAbility",
        "pendingIndustryFreeMove",
        "pendingIndustryHandSelection",
      ].some((key) => Boolean(pending[key]));
    }

    function recoverAiIdleActionEffectStep() {
      if (!isActionEffectFlowActive()) return null;
      const effect = getCurrentActionEffect();
      if (!effect || (effect.status && effect.status !== "active")) return null;
      const pending = getAiAutoBattlePendingState();
      if (hasAiPendingDecisionForCurrentEffect(pending)) return null;
      recordAiAutoBattleLog("effect-recovery", `AI 恢复推进效果：${effect.label || effect.type}`, {
        effectId: effect.id || null,
        effectType: effect.type || null,
        pending,
      });
      return runAiActionEffectStep();
    }

    function runAiNonTurnAutomationStep() {
      if (!ai?.policy) return { ok: false, blocked: true, message: "SetiAI 未加载" };
      if (isGameEnded()) return { ok: true, done: true, message: "游戏已结束" };

      if (state.pendingAlienRevealConfirmation) {
        return confirmAlienRevealNotice?.() || {
          ok: false,
          blocked: true,
          message: "AI 无法确认外星人揭示",
        };
      }

      const alienUseResult = runAiAlienUseDecision();
      if (alienUseResult) return alienUseResult;

      const alienTraceResult = runAiAlienTraceDecision();
      if (alienTraceResult) return alienTraceResult;

      if (!isActionEffectFlowActive()) {
        const earlyReadyBanrenmaResult = runAiReadyBanrenmaOpportunityOpenDecision();
        if (earlyReadyBanrenmaResult) return earlyReadyBanrenmaResult;
      }

      const initialResult = chooseInitialSelectionForAiPlayer();
      if (initialResult) return initialResult;

      const discardResult = runAiDiscardDecision();
      if (discardResult) return discardResult;

      const passReserveResult = runAiPassReserveDecision();
      if (passReserveResult) return passReserveResult;

      const finalScoreMarkResult = runAiFinalScoreMarkDecision();
      if (finalScoreMarkResult) return finalScoreMarkResult;

      const cardSelectionResult = runAiCardSelectionDecision();
      if (cardSelectionResult) return cardSelectionResult;

      if (!isActionEffectFlowActive()) {
        const techSelectionResult = runAiResearchTechSelectionDecision();
        if (techSelectionResult) return techSelectionResult;
      }

      const handScanResult = runAiHandScanDecision();
      if (handScanResult) return handScanResult;

      const playCardResult = runAiPlayCardSelectionDecision();
      if (playCardResult) return playCardResult;

      const movePaymentResult = runAiMovePaymentDecision();
      if (movePaymentResult) return movePaymentResult;

      const landTargetResult = runAiLandTargetDecision();
      if (landTargetResult) return landTargetResult;

      const dataPlacementResult = runAiDataPlacementDecision();
      if (dataPlacementResult) return dataPlacementResult;

      const scanTargetResult = runAiScanTargetDecision();
      if (scanTargetResult) return scanTargetResult;

      const strategyPassiveSlotResult = runAiStrategyPassiveSlotChoiceDecision();
      if (strategyPassiveSlotResult) return strategyPassiveSlotResult;

      const effectMoveResult = runAiActionEffectMoveDecision();
      if (effectMoveResult) return effectMoveResult;

      if (isActionEffectFlowActive() && !hasActivePendingSubFlow()) {
        const activeEffectResult = runAiActionEffectStep();
        if (activeEffectResult) return activeEffectResult;
      }

      const readyBanrenmaResult = runAiReadyBanrenmaOpportunityOpenDecision();
      if (readyBanrenmaResult) return readyBanrenmaResult;

      const cardTriggerResult = runAiCardTriggerDecision();
      if (cardTriggerResult) return cardTriggerResult;

      const cardTriggerMoveResult = runAiCardTriggerFreeMoveDecision();
      if (cardTriggerMoveResult) return cardTriggerMoveResult;

      const cardCornerMoveResult = runAiCardCornerFreeMoveDecision();
      if (cardCornerMoveResult) return cardCornerMoveResult;

      const industryFreeMoveResult = runAiIndustryFreeMoveDecision();
      if (industryFreeMoveResult) return industryFreeMoveResult;

      const scanAction4Result = runAiScanAction4Decision();
      if (scanAction4Result) return scanAction4Result;

      const readyCardTaskResult = runAiReadyCardTaskOpenDecision();
      if (readyCardTaskResult) return readyCardTaskResult;

      const cardTaskResult = runAiCardTaskCompletionDecision();
      if (cardTaskResult) return cardTaskResult;

      const effectResult = runAiActionEffectStep();
      if (effectResult) return effectResult;

      if (hasActivePendingSubFlow()) {
        return { ok: false, blocked: true, message: "AI 遇到尚未收口的 pending 流程" };
      }

      return { ok: true, idle: true, message: "已推进到顶层决策点" };
    }

    function resolveAiAutomationToTurnBoundary(options = {}) {
      const maxSteps = Math.max(1, Math.round(Number(options.maxSteps) || 500));
      const steps = [];
      for (let index = 0; index < maxSteps; index += 1) {
        const result = runAiNonTurnAutomationStep();
        if (result) steps.push(result);
        if (!result || result.idle || result.done || result.blocked || result.bug || result.ok === false) {
          return {
            ok: result ? result.ok !== false : true,
            steps,
            final: result || { ok: true, idle: true, message: "已推进到顶层决策点" },
          };
        }
      }
      return {
        ok: false,
        blocked: true,
        message: `推进到顶层决策点超过 ${maxSteps} 步仍未收敛`,
        steps,
      };
    }

    function matchesAiTurnActionSelector(candidate = {}, selector = {}) {
      if (!selector || typeof selector !== "object") return false;
      if (selector.id && candidate.id !== selector.id) return false;
      if (selector.tradeId && candidate.tradeId !== selector.tradeId) return false;
      if (selector.cardId && candidate.cardId !== selector.cardId) return false;
      if (selector.cardInstanceId && candidate.cardInstanceId !== selector.cardInstanceId) return false;
      if (selector.handIndex != null && Number(candidate.handIndex) !== Number(selector.handIndex)) return false;
      if (selector.blueSlot != null && Number(candidate.blueSlot) !== Number(selector.blueSlot)) return false;
      if (selector.target && JSON.stringify(candidate.target || null) !== JSON.stringify(selector.target)) return false;
      return true;
    }

    function runAiSelectedTurnAction(selector = {}, options = {}) {
      const currentPlayer = getCurrentPlayer();
      const buildResult = buildAiTurnActionCandidates(currentPlayer);
      if (!buildResult.ok) return buildResult;
      const candidates = buildResult.candidates || [];
      const action = Number.isInteger(selector?.candidateIndex)
        ? candidates[selector.candidateIndex] || null
        : candidates.find((candidate) => matchesAiTurnActionSelector(candidate, selector)) || null;
      if (!action) {
        return {
          ok: false,
          blocked: true,
          message: "未找到匹配的顶层行动候选",
          candidates,
        };
      }
      const actionResult = executeAiTurnAction(action, currentPlayer);
      if (actionResult?.ok === false || options.resolveToTurnBoundary === false) {
        return {
          ...actionResult,
          action,
          candidates,
        };
      }
      const resolution = resolveAiAutomationToTurnBoundary(options);
      return {
        ok: resolution.ok !== false,
        progressed: true,
        action,
        actionResult,
        resolution,
      };
    }

    function runAiAutomationStep() {
      try {
        const nonTurnResult = runAiNonTurnAutomationStep();
        if (nonTurnResult && !nonTurnResult.idle) return nonTurnResult;
        return runAiTurnActionDecision();
      } catch (error) {
        const entry = recordAiAutoBattleBug(error?.message || String(error), {
          stack: error?.stack || null,
        });
        return { ok: false, blocked: true, bug: entry, message: entry.message };
      }
    }


    return {
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
      estimateAiJiuzheCardCompletionFactor,
      getAiEarlyDirectScorePlayPassFloor,
      getAiB2SectorWinExactDelta,
      getAiClosedSectorControlMarginValue,
      getAiFinalAnalyzeDirectScoreProtection,
      getAiTerminalResearchGoalBonusScale,
      getAiAutoBattleAnalysis,
      getAiAutoBattleProgress,
      getAiAutoBattleReport,
      getAiAlienTraceTargetDemand,
      getAiAlienTraceTargetDemandForSlot,
      getAiMapDemand,
      getAiRemainingRoundWeight,
      getAiStrategyDemand,
      getAiStrategyTuningHistory,
      getAiStrategyTuningRecommendation,
      getAiStrategyWeights,
      getCardTriggerFreeMoveEffect,
      getPlayerAgentLabel,
      getAiSectorScanWinState,
      isAiB2SectorScanRaceLost,
      isAiAutomationPaused,
      isAiAutoBattlePlayer,
      buildAiTurnActionCandidates,
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
      scoreAiB2SectorScanFocus,
      scoreAiFullSectorExtraMark,
      scoreAiNebulaScanChoice,
      stopAiAutoBattle,
      sumAiDemandMap,
    };
  }

  return { createAiController };
});

(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppEffectExecutorBootstrap = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";
  const BROWSER_INPUT_NAMES = Object.freeze([
    "executeSectorXScanEffect", "maybeReturnPlayedCardToHandAfterSectorScan", "getPlanetName",
    "markerBelongsToPlayer", "playerHasOwnOrbitMarkerAtPlanet", "markerOwnerLabel",
    "buildPlanetMarkerRemovalChoices", "removePlanetMarkerForChoice", "handleRemovePlanetMarkerChoice",
    "handleScanAction4Choice", "formatPlanetRewardGain", "finishAutomaticRewardEffect",
    "buildPlutoRewardEffectsForAction", "buildPlutoChoiceRewardSummary", "handleHandCornerChoice",
    "getSectorXsMatchingCondition", "sectorXHasAvailableScanTarget", "isAlienFamilyCard",
    "handleReturnUnfinishedTaskChoice", "countOwnedTechByType", "enrichScanResultEvents",
    "getPlayerCompanyBaseIncome", "insertActionEffectsAfterCurrent", "insertActionEffectsBeforeCurrent",
    "handleOptionalHandScanChoice", "openYichangdianCornerPicker", "handleYichangdianCornerChoice",
    "applyAomomoScanCostAndBonus",
  ]);

  function createBrowserInputPort(registry, getTarget) {
    if (typeof registry?.registerTarget !== "function") {
      throw new TypeError("effect_executor input port 需要已校验 registry");
    }
    if (typeof getTarget !== "function") throw new TypeError("effect_executor input port 缺少 owner resolver");
    return registry.registerTarget("effect_executor", BROWSER_INPUT_NAMES, getTarget);
  }



  const REQUIRED_CONTEXT_KEYS = Object.freeze({
    movementScan: Object.freeze([
      "INCOME_GAIN_LABELS", "SCORE_SOURCE_KEYS", "abilities", "addPlutoMarker", "aomomo",
      "attachScoreSourceToEffects", "beginEffectHistoryStep", "beginScanAction4FreeMove",
      "buildPlanetRewardEffectsWithIndustry", "buildPlutoMarkerRemovalChoices", "buildProbeLocationIndex",
      "buildSectorScanChoicesForX", "buildSectorScanChoicesForXs", "cardEffects", "cards",
      "claimRunezuPlanetSymbolForTravelResult", "closeScanAction4Picker", "closeScanTargetPicker",
      "collectPlutoMarkers", "completeCurrentActionEffect", "createActionContext", "data", "document",
      "effectChoiceFlowHelpers", "els", "endEffectHistoryStep", "endGameScoring", "formatPlutoChoiceLabel",
      "getActionResultOwnerPlayer", "getAomomoCurrentX", "getCurrentActionEffect",
      "getCurrentPlanetActionPlacement", "getCurrentPlayer", "getEarthSectorCoordinate",
      "getEffectOwnerPlayer", "getFlowMarkedNebulaIds", "getPendingOwnerFields",
      "getPlanetSectorCoordinate", "getPlutoActionCost", "getPlutoActionState", "getPlutoCandidateRockets",
      "getPlutoChoiceActionLabel", "getPlutoReservedCards", "getSectorScanTargetLabel", "historyCommands",
      "insertActionEffectsAfterCurrent", "isActionEffectFlowActive", "launchRocketForScanAction4",
      "maybeCompleteActionEffectFromScan", "normalizeResourceCost", "openLandTargetPicker",
      "openScanTargetPicker", "planetReferenceLayout", "planetRewards", "planetStats",
      "playerHasOwnPlutoLanding", "players", "recordAbilityCommands", "recordHistoryCommand",
      "removePlutoMarker", "removeRocketElement", "renderActionEffectBar", "renderAlienPanels",
      "renderPlayerHand", "renderPlayerStats", "renderPublicCards", "renderReservedCards",
      "renderRockets", "renderStateReadout", "replaceNebulaDataForCurrentPlayer", "restoreMutableObject",
      "rocketActions", "skipActionEffectWithMessage", "solar", "syncPlanetOrbitLandMarkers",
      "updateActionButtons", "updatePublicCardControls", "withEffectExecutionPlayer",
      "withPendingOwnerPlayer",
    ]),
    reward: Object.freeze([
      "SCORE_SOURCE_KEYS", "abilities", "activateNextActionEffect", "addPlayerScoreSource",
      "addScoreSourceFromGain", "applyIncomeGainWithImmediateRewards", "assignEffectOwner", "banrenma",
      "beginCardSelection", "beginDiscardSelection", "beginEffectHistoryStep", "buildNebulaScanChoice",
      "buildPlutoMarkerRemovalChoices", "buildSectorScanChoicesForX", "buildSectorScanChoicesForXs",
      "cardEffects", "cards", "chong", "closeScanTargetPicker", "completeCurrentActionEffect",
      "createActionContext", "createPublicScanPendingAction", "createScanRunId", "data", "document",
      "effectChoiceFlowHelpers", "els", "endEffectHistoryStep", "ensureCardFlowEventBonuses",
      "ensurePlutoCardEffectState", "executeSectorScanAtPlanet", "expandScanChoicesWithAomomoTargets",
      "finishAutomaticRewardEffect", "formatCardCornerRewardMessage", "formatIncomeGain",
      "formatPlanetRewardGain", "getAutoDataPlacementCheck", "getCardTypeCode", "getCurrentActionEffect",
      "getCurrentPlayer", "getEarthSectorCoordinate", "getEffectOwnerPlayer",
      "getExplicitEffectOwnerPlayer", "getNebulaCurrentX", "getPendingOwnerFields",
      "getPendingOwnerPlayer", "getPlanetName", "getPlayerOwnerKeys", "getPublicScanChoicesForCard",
      "getPublicScanIconForScanCode", "getSectorContentForMove", "historyCommands", "initialCards",
      "isAsteroidContent", "isDataPoolFull", "isRuntimeCardConditionMet",
      "markCurrentActionIrreversible", "markerBelongsToPlayer", "maybeApplyIndustryLaunchScan",
      "nebulaHasScannableData", "normalizeResourceCost", "openAutoDataPlacementPrompt",
      "openPendingDecision", "readPendingDecision", "openScanTargetPicker", "planetReferenceLayout", "planetStats", "players",
      "recordAbilityCommands", "recordHistoryCommand", "recordScoreSourceForGainEffect",
      "renderActionEffectBar", "renderPlayerHand", "renderPlayerStats", "renderPublicCards",
      "renderReservedCards", "renderRocketElement", "renderRockets", "renderStateReadout",
      "renderTechBoard", "replaceNebulaDataForCurrentPlayer", "resolvePlayerReference",
      "restoreObjectSnapshot", "rocketActions", "runezu", "scanEffects", "solar",
      "skipActionEffectWithMessage", "syncHandScanSelectionChrome", "syncTechSelectionChrome",
      "uiRuntimeState", "updateActionButtons", "withPendingOwnerPlayer",
    ]),
    alien: Object.freeze([
      "SCORE_SOURCE_KEYS", "abilities", "addPlayerScoreSource", "addScoreSourceFromGain", "aomomo",
      "applyIncomeFromCard", "applyYichangdianRewardToPlayer", "beginCardSelection",
      "beginEffectHistoryStep", "blindDrawCardForPlayer", "buildPlanetRewardEffectsWithIndustry",
      "buildSectorScanChoicesForX", "buildSectorScanChoicesForXs", "cardEffects", "cards", "chong",
      "claimRunezuPlanetSymbolForTravelResult", "completeCurrentActionEffect", "createActionContext",
      "data", "document", "els", "endEffectHistoryStep", "executeCardLandEffect",
      "executeGainResourcesRewardEffect", "finishAutomaticRewardEffect", "finishChongFossilEffect",
      "formatIncomeGain", "getActionResultOwnerPlayer", "getAomomoCurrentX", "getChongPlanetLabel",
      "getCurrentActionEffect", "getCurrentPlayer", "getEarthSectorCoordinate",
      "getEffectOwnerPlayer", "getIrreversibleReason", "getPlayerById",
      "hasPlayerVisitedPlanetThisTurn", "historyCommands", "insertActionEffectsAfterCurrent",
      "markCurrentActionIrreversible", "maybeCompleteActionEffectFromScan",
      "nebulaHasScannableData", "openAlienTraceRewardEffect", "openChongFossilChoiceDialog",
      "openLandTargetPicker", "openScanTargetPicker", "players", "recordAbilityCommands",
      "recordHistoryCommand", "removeRocketElement", "renderActionEffectBar", "renderAlienPanels",
      "renderPlayerHand", "renderPlayerStats", "renderPublicCards", "renderReservedCards",
      "renderRockets", "renderStateReadout", "replaceNebulaDataForCurrentPlayer", "rocketActions",
      "solar", "syncPlanetOrbitLandMarkers", "updateActionButtons", "withEffectExecutionPlayer",
      "yichangdian",
    ]),
    dispatcher: Object.freeze([
      "BANRENMA_PANEL_BONUS_EFFECT_TYPE", "JIUZHE_THRESHOLD_CARD_EFFECT_TYPE", "abilities",
      "alienTraceRewardFlow", "aliens", "amiba", "aomomo", "applyIncomeGainWithImmediateRewards",
      "banrenma", "beginAlienTraceBoardPlacement", "beginCardMoveEffect", "beginCardSelection",
      "beginDiscardSelection", "beginEffectHistoryStep", "beginPassReserveSelection",
      "buildNebulaScanChoice", "cardEffects", "chong", "claimRunezuSourceSymbolWithHistory",
      "closeAlienTracePicker", "completeCurrentActionEffect", "createActionContext",
      "createPublicScanPendingAction", "endEffectHistoryStep", "executeAomomoFossilForDataEffect",
      "executeAomomoFossilMoveAndLandEffect", "executeAomomoGainFossilsEffect",
      "executeAomomoLandEffect", "executeAomomoSpendFossilsScoreEffect",
      "executeAomomoVisitThisTurnFossilEffect", "executeBanrenmaPanelBonusEffect",
      "executeCardDrawThenDiscardActionEffect", "executeCardFixedNebulaScanEffect",
      "executeCardLandEffect", "executeCardOrbitEffect", "executeCardResearchTechEffect",
      "executeChongChoosePlanetFossilRewardEffect", "executeChongPickupFossilEffect",
      "executeChongProbePlanetFossilRewardEffect", "executeChongTaskCleanupEffect",
      "executeChongTravelForPickupEffect", "executeChooseHandCornerRewardEffect",
      "executeConditionalRewardEffect", "executeConditionalSectorScanEffect",
      "executeCountAliensResourceEffect", "executeCountCurrentIncomeResourceEffect",
      "executeCountHandCornerMoveEffect", "executeCountHandIncomeResourceEffect",
      "executeCountOwnedTechRewardEffect", "executeCountRocketsRewardEffect",
      "executeCountTechTypesRewardEffect", "executeDiscardAllHandEffect",
      "executeDiscardAnyForIncomeEffect", "executeDiscardCardCornerRepeatEffect",
      "executeDiscardPublicCornerRewardsEffect", "executeDrawCardsRewardEffect",
      "executeEarthSectorContentMoveEffect", "executeGainDataRewardEffect",
      "executeGainResourcesRewardEffect", "executeHandScanEffect",
      "executeHuanyuSuperdrivePassLaunchEffect", "executeImprovedEarthSectorScanEffect",
      "executeIndustryFundamentalismExchangeEffect", "executeIndustryHeliosPassiveRewardEffect",
      "executeIndustryPiratesRaidLaunchEffect", "executeIndustryPiratesRaidMarkerEffect",
      "executeIndustryPiratesRaidPublicityEffect", "executeIndustrySentinelCornerEffect",
      "executeIndustryStrategyPassiveRewardEffect", "executeIndustryStratusCornerEffect",
      "executeJiuzheThresholdCardEffect", "executeLandingSectorScanEffect",
      "executeLaunchRewardEffect", "executeOptionalDiscardScanEffect", "executePassFirstRotateEffect",
      "executePassHandLimitEffect", "executePayCreditsForRewardEffect",
      "executePickCardCornerRewardEffect", "executePlanetSectorScanEffect", "executePlutoReserveEffect",
      "executeProbeLocationRewardEffect", "executeProbeSectorScanEffect", "executeProbeStackRewardEffect",
      "executeRegisterEventBonusEffect", "executeRemoveOrbitToProbeEffect",
      "executeReturnPlayedCardToHandIfEffect", "executeReturnUnfinishedTaskToHandEffect",
      "executeRunezuSymbolRewardEffect", "executeScanActionFinalizeEffect",
      "executeScanPublicRefillEffect", "executeSectorFinishScanEffect", "executeSectorScanAtPlanet",
      "executeSectorXScanEffect", "executeTuckPlayedCardToIncomeEffect",
      "executeYichangdianAlienTraceEffect", "executeYichangdianAnomalySignalScoreEffect",
      "executeYichangdianDrawThenTwoCornersEffect", "executeYichangdianLaunchAnomalyMoveEffect",
      "executeYichangdianNextAnomalyRewardEffect", "executeYichangdianNextAnomalyScanEffect",
      "executeYichangdianPublicAllEffect", "expandCardScanActionEffect",
      "expandScanChoicesWithAomomoTargets", "finishAutomaticRewardEffect", "formatIncomeGain",
      "getCurrentPlayer", "getEffectOwnerPlayer", "getEffectTargetPlayer",
      "getEligibleAlienSlotIdsForTraceEffect", "getPlayerById", "getPublicScanMaxSelectable",
      "getPublicScanChoicesForCard", "getResearchTechSelectionPayload",
      "hasAlienTracePanelPlacementTarget", "hasHandScanTargetCard", "historyCommands", "jiuzhe",
      "maybeApplyIndustryLaunchScan", "maybeConsumeAlienLabPanelForMainAction", "onTechTileTaken",
      "openAmibaSymbolChoiceDialog", "openAmibaTraceRemovalDialog", "openAomomoCardGainDialog",
      "openAomomoCurrentXScanEffect", "openAomomoFossilAnyScanEffect",
      "openCardAnySectorScanEffect", "openCardColorScanEffect", "openCardDrawThenScanEffect",
      "openCardPublicScanEffect", "openFangzhouTraceDestinationChoice",
      "openRemovePlanetMarkerPicker", "openRunezuSymbolBranchDialog", "openScanAction4Picker",
      "openPendingDecision", "readPendingDecision", "openScanTargetPicker", "planetRewards", "recordAbilityCommands", "recordHistoryCommand",
      "recordTechBonusScore", "renderDebugPlayerSwitch", "renderPlayerHand", "renderPlayerStats",
      "renderRockets", "renderRotateStateToken", "renderRunezuBoardSymbols",
      "renderSectorNebulaDataBoard", "renderStateReadout", "renderWheels",
      "resolvePlayerReference", "runezu", "scanEffects", "shouldSkipCurrentResearchTechCost",
      "skipActionEffectWithMessage", "syncHandScanSelectionChrome", "tech", "uiRuntimeState",
      "updateActionButtons",
    ]),
  });

  function createRequiredContext(owner, supplied, extensions, requiredKeys) {
    const source = { ...(supplied || {}), ...(extensions || {}) };
    const context = Object.create(null);
    for (const key of requiredKeys) {
      if (!(key in source) || source[key] === undefined) {
        throw new TypeError(`Missing ${owner} effect executor capability: ${key}`);
      }
      context[key] = source[key];
    }
    return Object.freeze(context);
  }

  function createEffectExecutorSuite(options = {}) {
    const {
      contexts = {},
      movementScanModule,
      rewardModule,
      alienModule,
      dispatcherModule,
    } = options;

    const movementScan = movementScanModule.createEffectMovementScanExecutors(
      createRequiredContext("movement/scan", contexts.movementScan, null, REQUIRED_CONTEXT_KEYS.movementScan),
    );
    const rewards = rewardModule.createEffectRewardExecutors(
      createRequiredContext("reward", contexts.reward, movementScan, REQUIRED_CONTEXT_KEYS.reward),
    );
    const aliens = alienModule.createEffectAlienExecutors(
      createRequiredContext("alien", contexts.alien, { ...movementScan, ...rewards }, REQUIRED_CONTEXT_KEYS.alien),
    );
    const executors = { ...movementScan, ...rewards, ...aliens };
    const dispatcher = dispatcherModule.createEffectDispatcher(
      createRequiredContext("dispatcher", contexts.dispatcher, executors, REQUIRED_CONTEXT_KEYS.dispatcher),
    );

    return Object.freeze({ ...executors, ...dispatcher });
  }

  return { BROWSER_INPUT_NAMES, createBrowserInputPort, REQUIRED_CONTEXT_KEYS, createEffectExecutorSuite };
});

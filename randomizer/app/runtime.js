(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function stripAssetExtension(value) {
    return String(value || "").replace(/\.[^./\\]+$/, "");
  }

  function createActionLogState() {
    return {
      entries: [],
      draft: null,
      nextEntryId: 1,
      activeReportTab: "action",
    };
  }

  function createActionBriefingState() {
    return {
      aiMainActions: [],
      lastShownTurnKey: null,
      pendingTurnKey: null,
      pendingAiResume: false,
    };
  }

  function createStartScreenState(options = {}) {
    return {
      aiDifficulty: options.aiDifficulty || "laughable",
      activePlayerCount: Math.max(1, Math.round(Number(options.defaultActivePlayerCount) || 4)),
      debugToolsEnabled: false,
      actionBriefingEnabled: true,
      selectedAlienIds: [...(options.alienTypeIds || [])],
      selectedIndustryLabels: (options.industryCardFiles || []).map(stripAssetExtension),
      continueAvailable: false,
      entered: false,
    };
  }

  function createSelectionState() {
    return {
      phase: "selecting",
      currentPlayerId: null,
      offersByPlayerId: {},
      confirmedPlayerIds: [],
    };
  }

  function createPendingState() {
    return {
      discardAction: null,
      cardSelectionAction: null,
      passReserveSelection: null,
      passReserveSelectionDismissed: false,
      scanTargetAction: null,
      probeSectorScanAction: null,
      probeLocationRewardAction: null,
      publicScanQueue: null,
      scanRunSequence: 0,
      handScanAction: null,
      alienTraceAction: null,
      landTargetAction: null,
      cardTriggerAction: null,
      cardTriggerFreeMove: null,
      type1TriggerEvents: [],
      cardTaskCompletion: null,
      jiuzheCardPlay: null,
      jiuzheOpportunityOpen: false,
      jiuzheOpportunityQueue: [],
      yichangdianCardGain: null,
      yichangdianCornerAction: null,
      banrenmaCardGain: null,
      banrenmaOpportunity: null,
      banrenmaOpportunityQueue: [],
      chongCardGain: null,
      chongFossilChoice: null,
      chongTaskCompletion: null,
      amibaCardGain: null,
      amibaSymbolChoice: null,
      amibaTraceRemoval: null,
      aomomoCardGain: null,
      runezuCardGain: null,
      runezuSymbolBranch: null,
      runezuFaceSymbolPlacement: null,
      strategyPassiveSlotChoice: null,
      alienTracePickerState: null,
      alienRevealConfirmation: null,
      turnEndAfterRevealContinuation: null,
      actionExecuted: false,
      passPlayerId: null,
      actionEffectFlow: null,
      actionHasIrreversibleBarrier: false,
      actionIrreversibleReason: null,
      movePayment: null,
      playCardSelection: null,
      futureSpanPlayBeforePlayer: null,
      handCardPlayAction: null,
      cardCornerQuickAction: null,
      cardCornerFreeMove: null,
      dataPlaceAction: null,
      industryAbility: null,
      piratesRaidPlacement: null,
    };
  }

  function createUiState() {
    return {
      debugAlienTraceModeActive: false,
      sectorWinDebugActive: false,
      completedEffectFlowsForUndo: {},
      finalResultAutoOpened: false,
      effectExecutionPlayerId: null,
      autoExecutingActionEffects: false,
      effectStepActive: false,
      moveHighlightRocketId: null,
      industryFreeMoveState: null,
      stateReadoutRenderFrame: 0,
      codexAiBatchSuppressReadoutRender: false,
    };
  }

  function createRuntime(options = {}) {
    return {
      pending: createPendingState(),
      actionLog: createActionLogState(),
      actionBriefing: createActionBriefingState(),
      startScreen: createStartScreenState(options),
      selection: createSelectionState(),
      ui: createUiState(),
    };
  }

  return {
    createRuntime,
    createPendingState,
    createActionLogState,
    createActionBriefingState,
    createStartScreenState,
    createSelectionState,
    createUiState,
  };
});

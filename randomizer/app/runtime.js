(function (root, factory) {
  "use strict";

  const decisionSessionStore = typeof module === "object" && module.exports
    ? require("../game/effects/decision-session-store")
    : root.SetiDecisionSessionStore;
  const api = factory(root, decisionSessionStore);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root, decisionSessionStore) {
  "use strict";

  if (!decisionSessionStore?.createDecisionSessionStore) {
    throw new Error("缺少 SetiDecisionSessionStore，无法创建标准 Decision Session");
  }

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

  function createUiState() {
    return {
      passReserveSelectionDismissed: false,
      debugAlienTraceModeActive: false,
      sectorWinDebugActive: false,
      completedEffectFlowsForUndo: {},
      finalResultAutoOpened: false,
      effectExecutionPlayerId: null,
      autoExecutingActionEffects: false,
      alienRevealConfirmation: null,
      effectStepActive: false,
      jiuzheOpportunityOpen: false,
      moveHighlightRocketId: null,
      industryFreeMoveState: null,
      stateReadoutRenderFrame: 0,
      codexAiBatchSuppressReadoutRender: false,
    };
  }

  function createBrowserHostState() {
    return {
      scanRunSequence: 0,
    };
  }

  function createRuntime(options = {}) {
    return {
      decisions: decisionSessionStore.createDecisionSessionStore(),
      actionLog: createActionLogState(),
      actionBriefing: createActionBriefingState(),
      startScreen: createStartScreenState(options),
      selection: createSelectionState(),
      ui: createUiState(),
      browserHost: createBrowserHostState(),
    };
  }

  return {
    createRuntime,
    createActionLogState,
    createActionBriefingState,
    createStartScreenState,
    createSelectionState,
    createUiState,
    createBrowserHostState,
  };
});

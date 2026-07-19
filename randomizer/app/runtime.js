(function (root, factory) {
  "use strict";

  const legacyFlowInventory = typeof module === "object" && module.exports
    ? require("../game/effects/legacy-flow-inventory")
    : root.SetiLegacyFlowInventory;
  const decisionSessionStore = typeof module === "object" && module.exports
    ? require("../game/effects/decision-session-store")
    : root.SetiDecisionSessionStore;
  const api = factory(root, legacyFlowInventory, decisionSessionStore);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root, legacyFlowInventory, decisionSessionStore) {
  "use strict";

  if (!legacyFlowInventory?.createLegacyPendingState) {
    throw new Error("缺少 SetiLegacyFlowInventory，无法创建受审计的 legacy pending adapter");
  }
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

  function createPendingState() {
    return legacyFlowInventory.createLegacyPendingState();
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
      decisions: decisionSessionStore.createDecisionSessionStore(),
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
    legacyFlowInventory,
  };
});

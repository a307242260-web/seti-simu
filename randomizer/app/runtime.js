(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
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

  function createUiState() {
    return {
      passReserveSelectionDismissed: false,
      passReserveSelectedCardId: null,
      probeSectorSelectedRocketIds: [],
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
      movePaymentSelectedHandIndices: [],
      playCardSelection: null,
      handCardPlayAction: null,
      cardCornerQuickAction: null,
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
      actionLog: createActionLogState(),
      actionBriefing: createActionBriefingState(),
      startScreen: createStartScreenState(options),
      selection: createSelectionState(),
      ui: createUiState(),
      browserHost: createBrowserHostState(),
    };
  }

  function createPlayerEffectOwnerRuntime(context = {}) {
    const isWorkingRoot = (value) => Boolean(value?.playerState && value?.rocketState && value?.turnState);

    function getPlayerById(rootOrId, explicitId = null) {
      const workingRoot = isWorkingRoot(rootOrId) ? rootOrId : null;
      const playerId = workingRoot ? explicitId : rootOrId;
      const playerState = workingRoot?.playerState || context.createReadoutRoot().playerState;
      return playerState.players.find((player) => player.id === playerId) || null;
    }

    function resolvePlayerReference(rootOrReference = {}, explicitReference = null) {
      const workingRoot = isWorkingRoot(rootOrReference) ? rootOrReference : null;
      const reference = workingRoot ? (explicitReference || {}) : rootOrReference;
      if (reference.playerId) {
        const player = workingRoot ? getPlayerById(workingRoot, reference.playerId) : getPlayerById(reference.playerId);
        if (player) return player;
      }
      if (!reference.playerColor) return null;
      return workingRoot
        ? context.getPlayerByColor(workingRoot, reference.playerColor)
        : context.getPlayerByColor(reference.playerColor);
    }

    function effectHasExplicitPlayerTarget(effect) {
      const options = effect?.options || {};
      return Boolean(effect?.playerId || effect?.playerColor || options.playerId || options.playerColor
        || options.targetPlayerId || options.targetPlayerColor);
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
      for (const effect of flow.effects || []) assignEffectOwner(effect, playerId);
    }

    function getExplicitEffectOwnerPlayer(rootOrEffect, explicitEffect = null) {
      const workingRoot = isWorkingRoot(rootOrEffect) ? rootOrEffect : null;
      const effect = workingRoot ? explicitEffect : rootOrEffect;
      const reference = {
        playerId: effect?.options?.targetPlayerId || effect?.playerId || effect?.options?.playerId,
        playerColor: effect?.options?.targetPlayerColor || effect?.playerColor || effect?.options?.playerColor,
      };
      return workingRoot ? resolvePlayerReference(workingRoot, reference) : resolvePlayerReference(reference);
    }

    function getEffectOwnerPlayer(rootOrEffect, explicitEffect = null) {
      const workingRoot = isWorkingRoot(rootOrEffect) ? rootOrEffect : null;
      const effect = workingRoot ? explicitEffect : rootOrEffect;
      const playerState = workingRoot?.playerState || context.createReadoutRoot().playerState;
      const flow = context.getActionEffectFlow(workingRoot);
      return (workingRoot ? getExplicitEffectOwnerPlayer(workingRoot, effect) : getExplicitEffectOwnerPlayer(effect))
        || (workingRoot ? getPlayerById(workingRoot, flow?.defaultPlayerId) : getPlayerById(flow?.defaultPlayerId))
        || (workingRoot ? getPlayerById(workingRoot, flow?.playerId) : getPlayerById(flow?.playerId))
        || context.players.getCurrentPlayer(playerState);
    }

    function getPendingOwnerFields(rootOrEffect = null, explicitEffect = null, explicitPlayer = null) {
      const workingRoot = isWorkingRoot(rootOrEffect) ? rootOrEffect : null;
      const effect = workingRoot ? explicitEffect : rootOrEffect;
      const player = workingRoot ? explicitPlayer : explicitEffect;
      const owner = player
        || (workingRoot ? getExplicitEffectOwnerPlayer(workingRoot, effect) : getExplicitEffectOwnerPlayer(effect))
        || context.getCurrentPlayer(workingRoot);
      return { playerId: owner?.id || null, playerColor: owner?.color || null };
    }

    function getPendingOwnerPlayer(rootOrPending = null, explicitPending = null, explicitFallbackEffect = null) {
      const workingRoot = isWorkingRoot(rootOrPending) ? rootOrPending : null;
      const pending = workingRoot ? explicitPending : rootOrPending;
      const fallbackEffect = workingRoot ? explicitFallbackEffect : explicitPending;
      const effect = fallbackEffect || pending?.effect || null;
      const reference = {
        playerId: pending?.playerId || pending?.targetPlayerId,
        playerColor: pending?.playerColor || pending?.targetPlayerColor,
      };
      return (workingRoot ? resolvePlayerReference(workingRoot, reference) : resolvePlayerReference(reference))
        || (workingRoot ? getExplicitEffectOwnerPlayer(workingRoot, effect) : getExplicitEffectOwnerPlayer(effect))
        || (effect ? (workingRoot ? getEffectOwnerPlayer(workingRoot, effect) : getEffectOwnerPlayer(effect)) : null)
        || context.getCurrentPlayer(workingRoot);
    }

    function withOwner(owner, callback, passOwner = false) {
      const previous = context.uiRuntimeState.effectExecutionPlayerId;
      context.uiRuntimeState.effectExecutionPlayerId = owner?.id || previous;
      try { return passOwner ? callback(owner) : callback(); }
      finally { context.uiRuntimeState.effectExecutionPlayerId = previous; }
    }

    function withPendingOwnerPlayer(rootOrPending, explicitPending, explicitCallback = null) {
      const workingRoot = isWorkingRoot(rootOrPending) ? rootOrPending : null;
      const pending = workingRoot ? explicitPending : rootOrPending;
      const callback = workingRoot ? explicitCallback : explicitPending;
      const owner = workingRoot ? getPendingOwnerPlayer(workingRoot, pending) : getPendingOwnerPlayer(pending);
      return withOwner(owner, callback, true);
    }

    function setActiveEffectFlowOwner(workingRoot, effect) {
      const flow = context.getActionEffectFlow(workingRoot);
      if (!flow || !effect) return null;
      const owner = getEffectOwnerPlayer(effect);
      flow.activePlayerId = owner?.id || null;
      return owner;
    }

    function withEffectExecutionPlayer(rootOrEffect, explicitEffect, explicitCallback = null) {
      const workingRoot = isWorkingRoot(rootOrEffect) ? rootOrEffect : null;
      const effect = workingRoot ? explicitEffect : rootOrEffect;
      const callback = workingRoot ? explicitCallback : explicitEffect;
      const owner = workingRoot ? getEffectOwnerPlayer(workingRoot, effect) : getEffectOwnerPlayer(effect);
      return withOwner(owner, callback);
    }

    return Object.freeze({
      isBrowserWorkingRoot: isWorkingRoot, getPlayerById, resolvePlayerReference,
      effectHasExplicitPlayerTarget, assignEffectOwner, assignEffectFlowOwner,
      getExplicitEffectOwnerPlayer, getEffectOwnerPlayer, getPendingOwnerFields,
      getPendingOwnerPlayer, withPendingOwnerPlayer, setActiveEffectFlowOwner, withEffectExecutionPlayer,
    });
  }

  return {
    createRuntime,
    createActionLogState,
    createActionBriefingState,
    createStartScreenState,
    createSelectionState,
    createUiState,
    createBrowserHostState,
    createPlayerEffectOwnerRuntime,
  };
});

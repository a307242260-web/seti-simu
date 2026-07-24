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
      ui: createUiState(),
      browserHost: createBrowserHostState(),
    };
  }

  function createBrowserMatchRuntime(context = {}) {
    const getActionEffectFlow = (workingRoot = null) => (
      workingRoot?.match?.actionEffectFlow || context.readActionEffectFlow()
    );

    function setActionEffectFlow(workingRoot, flow) {
      if (!workingRoot?.match) throw new TypeError("action effect flow requires explicit workingRoot.match");
      if (!flow) {
        delete workingRoot.match.actionEffectFlow;
        return null;
      }
      workingRoot.match.actionEffectFlow = flow;
      return flow;
    }

    return Object.freeze({
      getActionEffectFlow,
      setActionEffectFlow,
    });
  }

  function createPlayerEffectOwnerRuntime(context = {}) {
    const isWorkingRoot = (value) => Boolean(value?.playerState && value?.rocketState && value?.turnState);

    function getPlayerById(rootOrId, explicitId = null) {
      const workingRoot = isWorkingRoot(rootOrId) ? rootOrId : null;
      const playerId = workingRoot ? explicitId : rootOrId;
      const playerState = workingRoot?.playerState || context.readPlayerTurnState().players;
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
      const playerState = workingRoot?.playerState || context.readPlayerTurnState().players;
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

  function createPlayerLookupRuntime(context = {}) {
    const isWorkingRoot = (value) => Boolean(value?.playerState && value?.rocketState && value?.turnState);
    function getPlayerById(rootOrId, explicitId = null) {
      const workingRoot = isWorkingRoot(rootOrId) ? rootOrId : null;
      const id = workingRoot ? explicitId : rootOrId;
      const source = workingRoot ? workingRoot.playerState : context.readPlayerTurnState().players;
      return source.players.find((player) => player.id === id) || null;
    }
    function getCurrentPlayer(workingRoot = null) {
      if (context.uiRuntimeState.effectExecutionPlayerId) {
        const effectPlayer = isWorkingRoot(workingRoot)
          ? getPlayerById(workingRoot, context.uiRuntimeState.effectExecutionPlayerId)
          : getPlayerById(context.uiRuntimeState.effectExecutionPlayerId);
        if (effectPlayer) return effectPlayer;
      }
      const source = isWorkingRoot(workingRoot)
        ? workingRoot.playerState
        : context.readPlayerTurnState().players;
      return context.players.getCurrentPlayer(source);
    }
    function getPlayerByColor(workingRootOrColor, explicitColor = null) {
      const workingRoot = isWorkingRoot(workingRootOrColor) ? workingRootOrColor : null;
      const color = workingRoot ? explicitColor : workingRootOrColor;
      const normalizedColor = context.players.normalizePlayerColor(color);
      const source = workingRoot ? workingRoot.playerState : context.readPlayerTurnState().players;
      return source.players.find((player) => player.color === normalizedColor) || null;
    }
    return Object.freeze({ isBrowserWorkingRoot: isWorkingRoot, getPlayerById, getCurrentPlayer, getPlayerByColor });
  }

  function createBrowserContextRuntime(context = {}) {
    function getInterfacePlayer() {
      const { players: playerState, turn: turnState } = context.readPlayerTurnState();
      const currentPlayer = context.players.getCurrentPlayer(playerState);
      if (!currentPlayer || !context.isAiPlayer(currentPlayer.id) || context.isAiAutomationPaused()) return currentPlayer;
      const activeIds = new Set(turnState.activePlayerIds || []);
      const humanPlayer = playerState.players.find((player) => activeIds.has(player.id) && !context.isAiPlayer(player.id))
        || playerState.players.find((player) => !context.isAiPlayer(player.id))
        || null;
      return humanPlayer || currentPlayer;
    }

    function createScanRunId(prefix = "scan") {
      context.browserHostState.scanRunSequence += 1;
      return `${prefix}-${context.browserHostState.scanRunSequence}`;
    }

    function resetScanRunSequence() {
      context.browserHostState.scanRunSequence = 0;
    }

    function getActivePlayers() {
      const { players: playerState, turn: turnState } = context.readPlayerTurnState();
      const activeIds = new Set(turnState.activePlayerIds || []);
      return playerState.players.filter((player) => activeIds.has(player.id));
    }

    function getPlayerLabelById(playerId) {
      const player = context.getPlayerById(playerId);
      return player ? player.colorLabel || player.name || player.id : playerId;
    }

    function getPlayerCompanyLabel(player) {
      return context.industry?.getPlayerIndustryLabel?.(player) || player?.initialSelection?.industry?.label || null;
    }

    function getPlayerDisplayLabel(player, options = {}) {
      const base = player?.colorLabel || player?.name || player?.id || "玩家";
      const agentSuffix = context.isAiPlayer(player?.id) ? "(电脑)" : "";
      const companyLabel = options.includeCompany === false ? null : getPlayerCompanyLabel(player);
      return `${base}${agentSuffix}${companyLabel ? `-${companyLabel}` : ""}`;
    }

    function getPlayerActionLabel(player, fallback = {}) {
      if (player) return player.colorLabel || player.name || player.id || "玩家";
      if (fallback.playerId) return getPlayerLabelById(fallback.playerId) || fallback.playerId;
      if (fallback.playerColor) return context.players.getPlayerColorDefinition(fallback.playerColor)?.label || fallback.playerColor;
      return "玩家";
    }

    function getTargetPlayerOptions(player, options = {}) {
      const targetPlayerId = options.targetPlayerId || options.playerId || player?.id || null;
      const targetPlayerColor = options.targetPlayerColor || options.playerColor || player?.color || null;
      return {
        ...(targetPlayerId ? { targetPlayerId } : {}),
        ...(targetPlayerColor ? { targetPlayerColor } : {}),
      };
    }

    function getPlayerRoundOrderNumber(playerId) {
      const index = context.getRoundOrderPlayerIds().indexOf(playerId);
      return index >= 0 ? index + 1 : null;
    }

    return Object.freeze({
      getInterfacePlayer, createScanRunId, resetScanRunSequence, getActivePlayers,
      getPlayerLabelById, getPlayerCompanyLabel, getPlayerDisplayLabel, getPlayerActionLabel,
      getTargetPlayerOptions, getPlayerRoundOrderNumber,
    });
  }

  function createBrowserWorkingStateAdapter(context = {}) {
    function replaceMutableObject(target, source) {
      if (!target || typeof target !== "object") throw new TypeError("Browser working state restore target 必须是对象");
      const replacement = structuredClone(source || {});
      for (const key of Reflect.ownKeys(target)) delete target[key];
      Object.assign(target, replacement);
      return target;
    }

    function createWorkingState(initialOptions = {}) {
      context.resetSequences?.();
      let random;
      if (initialOptions.counterfactualSeed != null) {
        let state = 2166136261;
        for (const character of String(initialOptions.counterfactualSeed)) {
          state ^= character.charCodeAt(0);
          state = Math.imul(state, 16777619);
        }
        random = () => {
          state = Math.imul(state ^ (state >>> 15), 1 | state);
          state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
          return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
        };
      }
      const state = context.initialGameState.createSessionState(context.ruleModules, {
        defaultInitialPlayerColor: initialOptions.defaultInitialPlayerColor ?? context.defaultInitialPlayerColor,
        activePlayerCount: initialOptions.activePlayerCount ?? context.defaultActivePlayerCount,
        finalScoreIds: initialOptions.finalScoreIds ?? context.finalScoreIds,
        alienPoolIds: initialOptions.alienPoolIds,
        random,
      });
      state.meta = {
        seed: initialOptions.seed ?? "browser-host",
        rngState: structuredClone(initialOptions.rngState || { owner: "browser", state: null }),
      };
      state.match.initialSetupConfig = structuredClone(initialOptions.initialSetupConfig || {});
      return state;
    }

    function validateSessionBoundary(state) {
      const forbiddenContinuation = [
        "type1TriggerEvents", "jiuzheOpportunityQueue", "banrenmaOpportunityQueue",
      ].find((field) => Object.hasOwn(state?.match || {}, field));
      return forbiddenContinuation
        ? {
          ok: false,
          path: `$.match.${forbiddenContinuation}`,
          code: "STATE_EFFECT_CONTINUATION_COMMITTED",
          message: `${forbiddenContinuation} 必须在 Composition Session 完成前清空`,
        }
        : { ok: true };
    }

    function restoreWorkingState(target, source, metadata = {}) {
      if (source?.playerState && source?.turnState) {
        for (const key of Object.keys(source)) {
          if (key === "meta") target.meta = structuredClone(metadata.committedState?.meta || source.meta || {});
          else replaceMutableObject(target[key], source[key]);
        }
        return target;
      }
      context.initialGameState.restoreSessionState(target, source, (resident, value) => {
        for (const key of Reflect.ownKeys(resident || {})) delete resident[key];
        Object.assign(resident, structuredClone(value || {}));
        return resident;
      });
      if (metadata.reason === "restore") context.restoreSequences(source.meta?.sequences || {});
      return target;
    }

    return Object.freeze({ createWorkingState, restoreWorkingState, validateSessionBoundary });
  }

  function createBrowserRuleStateAdapter(context = {}) {
    const workingState = createBrowserWorkingStateAdapter({
      initialGameState: context.initialGameState,
      ruleModules: {
        players: context.players,
        solar: context.solar,
        rocketActions: context.rocketActions,
        planetStats: context.planetStats,
        data: context.data,
        cards: context.cards,
        tech: context.tech,
        aliens: context.aliens,
        finalScoring: context.finalScoring,
        createTurnState: context.createTurnState,
      },
      defaultInitialPlayerColor: context.defaultInitialPlayerColor,
      defaultActivePlayerCount: context.defaultActivePlayerCount,
      finalScoreIds: context.finalScoreIds,
      resetSequences() {
        const sequenceOwners = context.sequenceOwners || {};
        sequenceOwners.cards?.restoreNextCardInstanceSequence?.(1);
        sequenceOwners.players?.restoreNextHandCardSequence?.(1);
        sequenceOwners.finalScoring?.restoreNextFinalMarkSequence?.(1);
        sequenceOwners.data?.restoreNextDataTokenSequence?.(1);
        sequenceOwners.data?.restoreDeterministicSequences?.({
          nebulaToken: 1,
          nebulaReplacement: 1,
        });
        sequenceOwners.history?.restoreNextHistoryStepSequence?.(1);
      },
      restoreSequences(sequences) {
        const sequenceOwners = context.sequenceOwners || {};
        if (Number.isSafeInteger(sequences.card)) sequenceOwners.cards?.restoreNextCardInstanceSequence?.(sequences.card);
        if (Number.isSafeInteger(sequences.handCard)) sequenceOwners.players?.restoreNextHandCardSequence?.(sequences.handCard);
        if (Number.isSafeInteger(sequences.finalMark)) sequenceOwners.finalScoring?.restoreNextFinalMarkSequence?.(sequences.finalMark);
        if (Number.isSafeInteger(sequences.dataToken)) sequenceOwners.data?.restoreNextDataTokenSequence?.(sequences.dataToken);
        if (Number.isSafeInteger(sequences.nebulaToken)) sequenceOwners.data?.restoreDeterministicSequences?.(sequences);
        if (Number.isSafeInteger(sequences.historyStep)) sequenceOwners.history?.restoreNextHistoryStepSequence?.(sequences.historyStep);
      },
    });

    function getCommittedContext(rootState) {
      const deterministicSequences = context.data?.getDeterministicSequences?.() || {};
      return {
        gameId: context.gameId || "seti-browser-runtime",
        rulesetVersion: context.rulesetVersion || "seti-runtime-v1",
        seed: rootState?.meta?.seed ?? "browser-host",
        rngState: structuredClone(rootState?.meta?.rngState || { owner: "browser", state: null }),
        sequences: {
          card: rootState?.meta?.sequences?.card
            ?? context.cards?.getNextCardInstanceSequence?.(),
          handCard: context.players?.getNextHandCardSequence?.(),
          finalMark: context.finalScoring?.getNextFinalMarkSequence?.(),
          dataToken: rootState?.meta?.sequences?.dataToken
            ?? context.data?.getNextDataTokenSequence?.(),
          ...deterministicSequences,
          historyStep: context.history?.getNextHistoryStepSequence?.(),
          actionLog: context.getActionLogSequence?.(),
          rocket: rootState?.rocketState?.nextRocketId,
        },
      };
    }

    return Object.freeze({ ...workingState, getCommittedContext });
  }

  return {
    createRuntime,
    createActionLogState,
    createActionBriefingState,
    createStartScreenState,
    createUiState,
    createBrowserHostState,
    createBrowserMatchRuntime,
    createPlayerEffectOwnerRuntime,
    createPlayerLookupRuntime,
    createBrowserContextRuntime,
    createBrowserWorkingStateAdapter,
    createBrowserRuleStateAdapter,
  };
});

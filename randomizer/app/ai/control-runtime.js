(function (root, factory) {
  "use strict";

  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SetiAppAiControlRuntime = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const AI_DIFFICULTY_LAUGHABLE = "laughable";
  const AI_DIFFICULTY_WEAK_START = "weak_start";
  const AI_DIFFICULTY_LABELS = Object.freeze({
    [AI_DIFFICULTY_LAUGHABLE]: "令人发笑的",
    [AI_DIFFICULTY_WEAK_START]: "开始弱小的",
  });
  const AI_STRATEGY_WEIGHT_KEYS = Object.freeze([
    "engine",
    "playCard",
    "tech",
    "scan",
    "route",
    "move",
    "orbitLand",
    "task",
    "final",
    "pass",
  ]);
  const AI_STRATEGY_WEIGHT_DEFAULTS = Object.freeze({
    ...AI_STRATEGY_WEIGHT_KEYS.reduce((weights, key) => ({ ...weights, [key]: 1 }), {}),
    engine: 1.30,
    playCard: 1.44,
    tech: 1.16,
    scan: 1.18,
    route: 0.76,
    move: 0.74,
    orbitLand: 1.00,
    task: 1.24,
    final: 1.34,
    pass: 0.78,
  });
  const AI_WEAK_START_STRATEGY_WEIGHT_DEFAULTS = Object.freeze({
    ...AI_STRATEGY_WEIGHT_KEYS.reduce((weights, key) => ({ ...weights, [key]: 1 }), {}),
    engine: 1.22,
    playCard: 1.40,
    tech: 1.14,
    scan: 1.08,
    route: 0.80,
    move: 0.78,
    orbitLand: 1.02,
    task: 1.22,
    final: 1.28,
    pass: 0.82,
  });

  function normalizeAiDifficulty(value) {
    return String(value || "") === AI_DIFFICULTY_WEAK_START
      ? AI_DIFFICULTY_WEAK_START
      : AI_DIFFICULTY_LAUGHABLE;
  }

  function getAiStrategyWeightDefaultsForDifficulty(difficulty) {
    return normalizeAiDifficulty(difficulty) === AI_DIFFICULTY_WEAK_START
      ? AI_WEAK_START_STRATEGY_WEIGHT_DEFAULTS
      : AI_STRATEGY_WEIGHT_DEFAULTS;
  }

  function hashAiSeed(seed) {
    const text = String(seed ?? "seti-ai");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createAiSeededRandom(seed) {
    let randomState = hashAiSeed(seed);
    return function seededRandom() {
      randomState = (randomState + 0x6D2B79F5) >>> 0;
      let value = randomState;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function runWithAiRandomSeed(seed, callback) {
    if (seed == null || seed === "") return callback();
    const originalRandom = Math.random;
    Math.random = createAiSeededRandom(seed);
    try {
      return await callback();
    } finally {
      Math.random = originalRandom;
    }
  }

  function getAiBatchSeed(options = {}, index = 0) {
    if (Array.isArray(options.seeds) && options.seeds.length) {
      return options.seeds[index % options.seeds.length];
    }
    const baseSeed = options.seed ?? options.randomSeed ?? null;
    if (baseSeed == null || baseSeed === "") return null;
    return `${baseSeed}:${index + 1}`;
  }

  function createManualAiInputGuard(context = {}) {
    function isAiAutomationInputLocked(player = context.getCurrentPlayer()) {
      return Boolean(player?.id && context.isAiPlayer(player.id) && !context.isAiAutomationPaused());
    }
    function isPendingLockedForAiAutomation(pending = null, fallbackEffect = null) {
      const player = context.getPendingOwnerPlayer(pending, fallbackEffect);
      return Boolean(player?.id && context.isAiPlayer(player.id) && !context.isAiAutomationPaused());
    }
    function blockManualAiAutomationInput(message = null, player = context.getCurrentPlayer()) {
      const statusNote = message || `${player?.colorLabel || "电脑玩家"}AI 正在自动行动`;
      context.setStatusNote(statusNote);
      context.scheduleAiAutoStepIfNeeded();
      context.renderStateReadout();
      return { ok: false, blocked: true, message: statusNote };
    }
    function blockManualAiPendingInput(pending = null, label = "待处理操作", fallbackEffect = null) {
      const player = context.getPendingOwnerPlayer(pending, fallbackEffect);
      return blockManualAiAutomationInput(`${player?.colorLabel || "电脑玩家"}AI 正在处理${label}`, player);
    }
    function blockManualAiPendingInputIfNeeded(pending = null, options = {}, label = "待处理操作", fallbackEffect = null) {
      if (options.automated === true || !isPendingLockedForAiAutomation(pending, fallbackEffect)) return null;
      return blockManualAiPendingInput(pending, label, fallbackEffect);
    }
    return Object.freeze({
      isAiAutomationInputLocked,
      isPendingLockedForAiAutomation,
      blockManualAiAutomationInput,
      blockManualAiPendingInput,
      blockManualAiPendingInputIfNeeded,
    });
  }

  function createAiDifficultyCommandHandler() {
    return (workingRoot, command) => {
      const player = workingRoot.playerState.players.find((candidate) => candidate.id === command.playerId);
      if (!player) return { ok: false, code: "AI_PLAYER_NOT_FOUND", message: "找不到 AI 玩家" };
      player.aiDifficulty = command.difficulty;
      player.aiDifficultyLabel = command.label;
      return { ok: true };
    };
  }

  function createAiControllerState(context = {}) {
    const match = context.match || {};
    const action = context.action || {};
    const ui = context.ui || {};
    const getAlien = context.getAlien || (() => ({}));
    const alienPending = (name) => getAlien()?.[name]?.();
    return {
      get pendingDiscardAction() { return match.getPendingDiscardDecision?.(); },
      get pendingCardSelectionDecision() { return match.readCardSelectionDecision?.(); },
      get publicCardSelectedSlots() { return [...(ui.publicCardSelectedSlots || [])]; },
      get pendingPublicScanQueue() { return match.getPublicScanQueueSession?.(); },
      get pendingLandTargetAction() { return match.getPendingLandTargetDecision?.(); },
      get pendingJiuzheCardPlay() { return alienPending("getPendingJiuzheCardPlay"); },
      get pendingYichangdianCardGain() { return alienPending("getPendingYichangdianCardGain"); },
      get pendingYichangdianCornerAction() { return alienPending("getPendingYichangdianCornerAction"); },
      get pendingBanrenmaCardGain() { return alienPending("getPendingBanrenmaCardGain"); },
      get pendingBanrenmaOpportunity() { return alienPending("getPendingBanrenmaOpportunity"); },
      get pendingChongCardGain() { return alienPending("getPendingChongCardGain"); },
      get pendingChongFossilChoice() { return alienPending("getPendingChongFossilChoice"); },
      get pendingAmibaCardGain() { return alienPending("getPendingAmibaCardGain"); },
      get pendingAmibaSymbolChoice() { return alienPending("getPendingAmibaSymbolChoice"); },
      get pendingAmibaTraceRemoval() { return alienPending("getPendingAmibaTraceRemoval"); },
      get pendingAomomoCardGain() { return alienPending("getPendingAomomoCardGain"); },
      get pendingRunezuCardGain() { return alienPending("getPendingRunezuCardGain"); },
      get pendingRunezuSymbolBranch() { return alienPending("getPendingRunezuSymbolBranch"); },
      get pendingRunezuFaceSymbolPlacement() { return alienPending("getPendingRunezuFaceSymbolPlacement"); },
      get pendingActionExecuted() { return action.isActionPending?.(); },
      get pendingActionEffectFlow() { return match.getActionEffectFlow?.(); },
      get actionHistoryHasSession() { return context.actionHistory?.hasSession?.() || false; },
      get actionHistorySessionInfo() { return context.actionHistory?.getSessionInfo?.() || null; },
      get effectStepActive() { return ui.effectStepActive; },
      set effectStepActive(value) { ui.effectStepActive = value; },
      get alienTracePickerState() { return ui.alienTracePickerState; },
      get pendingAlienRevealConfirmation() { return ui.alienRevealConfirmation; },
    };
  }

  function createAiControlRuntime(context) {
    if (!context || !context.state) {
      throw new Error("createAiControlRuntime requires app state accessors");
    }

    const {
      window: windowRef = root,
      state,
      getRuleProjection,
      DEFAULT_ACTIVE_PLAYER_COUNT,
      DEFAULT_INITIAL_PLAYER_COLOR,
      getCurrentActionEffect,
      getCurrentPlayer,
      getEffectOwnerPlayer,
      getPlayerByColor,
      getPlayerById,
      getPlayerLabelById,
      isGameEnded,
      isUiBlockingAiAutomation = () => false,
      isIndustryHandSelectionActive,
      recordAiAutoBattleLog,
      recordAiAutoBattleBug,
      renderStateReadout,
      runMachinePlayerStep,
      resetGameForAiAutoBattle,
      resetAiStrategyDemandCache = () => {},
      setPlayerAiDifficulty,
      setTurnStatePlayerOrder,
      startInitialSelection,
      updateActionButtons,
    } = context;
    if (typeof getRuleProjection !== "function") {
      throw new TypeError("createAiControlRuntime requires getRuleProjection() player/turn DTO reader");
    }
    if (typeof setPlayerAiDifficulty !== "function") {
      throw new TypeError("createAiControlRuntime requires setPlayerAiDifficulty() Composition command");
    }

    const aiAutoBattleState = {
      enabled: false,
      running: false,
      manualDrive: false,
      playerIds: [],
      aiDifficulty: AI_DIFFICULTY_LAUGHABLE,
      logs: [],
      bugs: [],
      bugCounts: {},
      turnMoveCounts: {},
      turnCardCornerMoveCounts: {},
      maxBugRepeats: 3,
      maxMovesPerTurn: 1,
      stepDelayMs: 0,
      compactLogs: false,
      lastSummary: null,
      strategyTuningHistory: [],
      strategyTuningHistoryLoaded: false,
      nextStrategyTuningHistoryId: 1,
    };
    const schedulerState = {
      scheduled: false,
      inProgress: false,
      pausedOnBug: false,
      suspended: false,
    };
    let aiStrategyWeights = { ...AI_STRATEGY_WEIGHT_DEFAULTS };
    let aiStrategyWeightsUseDifficultyDefaults = true;

    function getAiDifficultyLabel(value = aiAutoBattleState.aiDifficulty) {
      const difficulty = normalizeAiDifficulty(value);
      return AI_DIFFICULTY_LABELS[difficulty] || AI_DIFFICULTY_LABELS[AI_DIFFICULTY_LAUGHABLE];
    }

    function applyAiDifficultyToPlayer(player, difficulty = aiAutoBattleState.aiDifficulty) {
      if (!player) return { ok: false, code: "AI_PLAYER_REQUIRED", message: "缺少 AI 玩家" };
      const normalized = normalizeAiDifficulty(difficulty);
      const label = getAiDifficultyLabel(normalized);
      const result = setPlayerAiDifficulty(player.id, normalized, label);
      if (!result || result.ok === false) {
        throw new Error(result?.message || "AI 难度 Composition command 执行失败");
      }
      return result;
    }

    function applyAiDifficultyToPlayerIds(playerIds = [], difficulty = aiAutoBattleState.aiDifficulty) {
      const normalized = normalizeAiDifficulty(difficulty);
      aiAutoBattleState.aiDifficulty = normalized;
      for (const playerId of playerIds) {
        applyAiDifficultyToPlayer(getPlayerById(playerId), normalized);
      }
      return normalized;
    }

    function normalizeAiStrategyWeights(weights = {}, options = {}) {
      const explicitBase = options.baseWeights && typeof options.baseWeights === "object"
        ? options.baseWeights
        : null;
      const base = options.merge === false
        ? (explicitBase || AI_STRATEGY_WEIGHT_DEFAULTS)
        : (explicitBase || aiStrategyWeights);
      const normalized = {};
      for (const key of AI_STRATEGY_WEIGHT_KEYS) {
        const value = Number(weights?.[key] ?? base[key] ?? AI_STRATEGY_WEIGHT_DEFAULTS[key]);
        normalized[key] = Math.round(
          Math.min(1.6, Math.max(0.6, Number.isFinite(value) ? value : 1)) * 1000,
        ) / 1000;
      }
      return normalized;
    }

    function configureAiStrategyWeights(weights = {}, options = {}) {
      aiStrategyWeights = normalizeAiStrategyWeights(weights, options);
      aiStrategyWeightsUseDifficultyDefaults = options.useDifficultyDefaults === true;
      resetAiStrategyDemandCache();
      return { ok: true, weights: { ...aiStrategyWeights } };
    }

    function resetAiStrategyWeights() {
      return configureAiStrategyWeights(AI_STRATEGY_WEIGHT_DEFAULTS, {
        merge: false,
        useDifficultyDefaults: true,
      });
    }

    function getAiActiveStrategyWeights(player = getCurrentPlayer()) {
      const difficulty = player?.aiDifficulty || aiAutoBattleState.aiDifficulty;
      if (aiStrategyWeightsUseDifficultyDefaults) {
        return getAiStrategyWeightDefaultsForDifficulty(difficulty);
      }
      return aiStrategyWeights;
    }

    function getAiStrategyWeights(player = getCurrentPlayer()) {
      return { ...getAiActiveStrategyWeights(player) };
    }

    function getAiStrategyWeight(key, player = getCurrentPlayer()) {
      const value = Number(getAiActiveStrategyWeights(player)?.[key]);
      return Number.isFinite(value) ? value : 1;
    }

    function getConfiguredAiStrategyWeights() {
      return { ...aiStrategyWeights };
    }

    function usesDifficultyDefaultStrategyWeights() {
      return aiStrategyWeightsUseDifficultyDefaults;
    }

    function getAiAutoBattlePlayerIds() {
      return aiAutoBattleState.playerIds.filter((playerId) => getPlayerById(playerId));
    }

    function isAiAutoBattlePlayer(playerId = null) {
      const resolvedPlayerId = playerId ?? getRuleProjection().players.currentPlayerId;
      return aiAutoBattleState.enabled && getAiAutoBattlePlayerIds().includes(resolvedPlayerId);
    }

    function isAiAutomationPaused() {
      return Boolean(schedulerState.pausedOnBug);
    }

    function getDefaultHumanPlayerId() {
      const projection = getRuleProjection();
      return getPlayerByColor(DEFAULT_INITIAL_PLAYER_COLOR)?.id
        || projection.turn.startPlayerId
        || projection.players.currentPlayerId
        || null;
    }

    function getDefaultAiOpponentPlayerIds() {
      const projection = getRuleProjection();
      const humanPlayerId = getDefaultHumanPlayerId();
      const activeIds = (projection.turn.activePlayerIds || []).filter((playerId) => getPlayerById(playerId));
      const opponents = activeIds.filter((playerId) => playerId !== humanPlayerId);
      if (opponents.length) return opponents;
      return projection.players.players
        .filter((player) => player.id !== humanPlayerId)
        .slice(0, Math.max(0, DEFAULT_ACTIVE_PLAYER_COUNT - 1))
        .map((player) => player.id);
    }

    function configureDefaultAiOpponent(options = {}) {
      const aiPlayerIds = getDefaultAiOpponentPlayerIds();
      if (!aiPlayerIds.length) return { ok: false, message: "没有可用的默认电脑玩家" };
      const aiDifficulty = applyAiDifficultyToPlayerIds(aiPlayerIds, options.aiDifficulty);
      aiAutoBattleState.enabled = true;
      aiAutoBattleState.playerIds = aiPlayerIds;
      schedulerState.pausedOnBug = false;
      recordAiAutoBattleLog(
        "config",
        `默认电脑玩家：${aiPlayerIds.map(getPlayerLabelById).join("、")}；难度：${getAiDifficultyLabel(aiDifficulty)}`,
        {
          playerIds: aiPlayerIds,
          humanPlayerId: getDefaultHumanPlayerId(),
          aiDifficulty,
          aiDifficultyLabel: getAiDifficultyLabel(aiDifficulty),
          mode: "default-human-vs-ai",
        },
      );
      return { ok: true, playerIds: [...aiPlayerIds], aiDifficulty, message: "默认人机对局已配置" };
    }

    function resolveAiAutoBattlePlayerIds(options = {}) {
      const projection = getRuleProjection();
      const requested = Array.isArray(options.playerIds)
        ? options.playerIds
        : Array.isArray(options.colors)
          ? options.colors
          : [];
      const resolved = requested
        .map((reference) => getPlayerById(reference) || getPlayerByColor(reference) || null)
        .filter(Boolean)
        .map((player) => player.id);
      if (resolved.length) return [...new Set(resolved)];
      const requestedCount = Math.max(
        1,
        Math.round(Number(options.activePlayerCount) || projection.turn.activePlayerCount || DEFAULT_ACTIVE_PLAYER_COUNT),
      );
      return (projection.turn.activePlayerIds || [])
        .filter((playerId) => getPlayerById(playerId))
        .slice(0, requestedCount);
    }

    function setAiAutoBattlePlayers(options = {}) {
      const playerIds = resolveAiAutoBattlePlayerIds(options);
      if (!playerIds.length) return { ok: false, message: "没有可配置为电脑玩家的玩家" };
      const aiDifficulty = applyAiDifficultyToPlayerIds(playerIds, options.aiDifficulty);
      aiAutoBattleState.enabled = true;
      aiAutoBattleState.playerIds = playerIds;
      schedulerState.pausedOnBug = false;
      recordAiAutoBattleLog(
        "config",
        `电脑玩家：${playerIds.map(getPlayerLabelById).join("、")}；难度：${getAiDifficultyLabel(aiDifficulty)}`,
        { playerIds, aiDifficulty, aiDifficultyLabel: getAiDifficultyLabel(aiDifficulty) },
      );
      return { ok: true, playerIds: [...playerIds], aiDifficulty, message: "电脑玩家已配置" };
    }

    function getPendingPlayerId(pending) {
      const playerId = pending?.playerId || pending?.targetPlayerId || pending?.player?.id || null;
      if (playerId) return playerId;
      const playerColor = pending?.playerColor || pending?.targetPlayerColor || pending?.player?.color || null;
      return playerColor ? getPlayerByColor(playerColor)?.id || null : null;
    }

    function shouldUseAlienTracePickerOwnerForAutomation(picker) {
      const mode = String(picker?.mode || "");
      return Boolean(
        mode
        && mode !== "debug-direct"
        && mode !== "reveal-confirm"
        && getPendingPlayerId(picker),
      );
    }

    function getEffectOwnerPlayerSafe(effect) {
      return effect ? getEffectOwnerPlayer(effect) : null;
    }

    function getPendingOwnerPlayer(pending, fallbackEffect = null) {
      const pendingPlayerId = getPendingPlayerId(pending);
      if (pendingPlayerId) return getPlayerById(pendingPlayerId) || null;
      return getEffectOwnerPlayerSafe(pending?.effect || fallbackEffect) || getCurrentPlayer();
    }

    function getPendingAlienAutomationPlayerId() {
      const pendingEntries = [
        shouldUseAlienTracePickerOwnerForAutomation(state.alienTracePickerState)
          ? state.alienTracePickerState
          : null,
        state.pendingJiuzheCardPlay?.reason === "view" ? null : state.pendingJiuzheCardPlay,
        state.pendingYichangdianCardGain,
        state.pendingYichangdianCornerAction,
        state.pendingBanrenmaCardGain,
        state.pendingBanrenmaOpportunity,
        state.pendingChongCardGain,
        state.pendingChongFossilChoice,
        state.pendingAmibaCardGain,
        state.pendingAmibaSymbolChoice,
        state.pendingAmibaTraceRemoval,
        state.pendingAomomoCardGain,
        state.pendingRunezuCardGain,
        state.pendingRunezuFaceSymbolPlacement,
        state.pendingRunezuSymbolBranch,
      ];
      for (const pending of pendingEntries) {
        const playerId = getPendingPlayerId(pending);
        if (playerId) return playerId;
      }
      return null;
    }

    function getPendingAutomationPlayerId() {
      if (state.pendingDiscardAction?.playerId) return state.pendingDiscardAction.playerId;
      if (state.pendingCardSelectionDecision?.playerId) return state.pendingCardSelectionDecision.playerId;
      const sharedPendingEntries = [
        state.pendingLandTargetAction,
      ];
      for (const pending of sharedPendingEntries) {
        const playerId = getPendingPlayerId(pending);
        if (playerId) return playerId;
        const effectOwner = getEffectOwnerPlayerSafe(pending?.effect);
        if (effectOwner?.id) return effectOwner.id;
      }
      const alienPendingPlayerId = getPendingAlienAutomationPlayerId();
      if (alienPendingPlayerId) return alienPendingPlayerId;
      const currentEffect = getCurrentActionEffect();
      const effectOwner = currentEffect ? getEffectOwnerPlayer(currentEffect) : null;
      return effectOwner?.id || getRuleProjection().players.currentPlayerId;
    }

    function shouldAutoRunCurrentAiPlayer() {
      const automationPlayerId = getPendingAutomationPlayerId();
      return Boolean(
        aiAutoBattleState.enabled
        && !aiAutoBattleState.running
        && !aiAutoBattleState.manualDrive
        && !schedulerState.suspended
        && !schedulerState.pausedOnBug
        && !schedulerState.scheduled
        && !schedulerState.inProgress
        && !isUiBlockingAiAutomation()
        && !isGameEnded()
        && isAiAutoBattlePlayer(automationPlayerId),
      );
    }

    function scheduleAiAutoStepIfNeeded() {
      if (!shouldAutoRunCurrentAiPlayer()) return;
      schedulerState.scheduled = true;
      const delay = Math.max(0, Math.round(Number(aiAutoBattleState.stepDelayMs) || 0));
      windowRef.setTimeout(runScheduledAiAutoStep, delay);
    }

    async function runScheduledAiAutoStep() {
      schedulerState.scheduled = false;
      if (!shouldAutoRunCurrentAiPlayer()) return;
      schedulerState.inProgress = true;
      let result;
      try {
        result = await runMachinePlayerStep();
      } catch (error) {
        result = {
          ok: false,
          code: error?.code || "BROWSER_MACHINE_POLICY_FAILED",
          message: error?.message || String(error),
        };
      } finally {
        schedulerState.inProgress = false;
      }
      if (result?.blocked || result?.ok === false) {
        schedulerState.pausedOnBug = true;
        const bug = recordAiAutoBattleBug(result.message || "默认 AI 自动行动阻塞", {
          result,
          mode: "default-human-vs-ai",
        });
        renderStateReadout();
        return;
      }
      if (!result?.done && !isGameEnded()) scheduleAiAutoStepIfNeeded();
    }

    function resetScheduler(options = {}) {
      schedulerState.scheduled = false;
      schedulerState.inProgress = false;
      schedulerState.suspended = false;
      if (options.keepPaused !== true) schedulerState.pausedOnBug = false;
    }

    function disableAiControlForRecovery(message = "AI 自动控制已禁用") {
      aiAutoBattleState.enabled = false;
      aiAutoBattleState.running = false;
      aiAutoBattleState.playerIds = [];
      resetScheduler();
      return { ok: true, disabled: true, message };
    }

    function restoreDefaultAiControlForRecovery(message = "旧存档未包含电脑配置，已按默认人机对局恢复") {
      const result = configureDefaultAiOpponent();
      if (!result?.ok) {
        return {
          ...disableAiControlForRecovery(result?.message || "默认电脑配置不可用，已按全手动恢复"),
          defaulted: true,
        };
      }
      return {
        ok: true,
        enabled: true,
        defaulted: true,
        playerIds: [...result.playerIds],
        pausedOnBug: false,
        message,
      };
    }

    function createAiControlSnapshot() {
      return {
        version: 1,
        enabled: Boolean(aiAutoBattleState.enabled),
        playerIds: getAiAutoBattlePlayerIds(),
        pausedOnBug: false,
        lastPausedOnBug: Boolean(schedulerState.pausedOnBug),
        stepDelayMs: Math.max(0, Math.round(Number(aiAutoBattleState.stepDelayMs) || 0)),
        maxBugRepeats: Math.max(1, Math.round(Number(aiAutoBattleState.maxBugRepeats) || 1)),
        maxMovesPerTurn: Math.max(0, Math.round(Number(aiAutoBattleState.maxMovesPerTurn) || 0)),
        aiDifficulty: aiAutoBattleState.aiDifficulty,
        strategyWeights: getAiStrategyWeights(),
      };
    }

    function restoreAiControlSnapshot(snapshot, options = {}) {
      aiAutoBattleState.running = false;
      resetScheduler();
      if (!snapshot || typeof snapshot !== "object") {
        return {
          ...restoreDefaultAiControlForRecovery(
            options.missingMessage || "恢复快照未包含电脑配置，已按默认人机对局恢复",
          ),
          missing: true,
        };
      }
      if (snapshot.strategyWeights && typeof snapshot.strategyWeights === "object") {
        configureAiStrategyWeights(snapshot.strategyWeights, { merge: false });
      }
      if (snapshot.stepDelayMs != null) {
        aiAutoBattleState.stepDelayMs = Math.max(0, Math.round(Number(snapshot.stepDelayMs) || 0));
      }
      if (snapshot.maxBugRepeats != null) {
        aiAutoBattleState.maxBugRepeats = Math.max(1, Math.round(Number(snapshot.maxBugRepeats) || 1));
      }
      if (snapshot.maxMovesPerTurn != null) {
        aiAutoBattleState.maxMovesPerTurn = Math.max(0, Math.round(Number(snapshot.maxMovesPerTurn) || 0));
      }
      const aiDifficulty = normalizeAiDifficulty(snapshot.aiDifficulty);
      if (!snapshot.enabled) return disableAiControlForRecovery("电脑配置已恢复为全手动");
      const playerIds = Array.isArray(snapshot.playerIds)
        ? [...new Set(snapshot.playerIds.map((playerId) => getPlayerById(playerId)?.id).filter(Boolean))]
        : [];
      if (!playerIds.length) {
        return {
          ...restoreDefaultAiControlForRecovery("恢复快照中的电脑玩家无效，已按默认人机对局恢复"),
          invalidPlayerIds: true,
        };
      }
      aiAutoBattleState.enabled = true;
      aiAutoBattleState.playerIds = playerIds;
      applyAiDifficultyToPlayerIds(playerIds, aiDifficulty);
      schedulerState.pausedOnBug = options.restorePausedOnBug === true
        ? Boolean(snapshot.pausedOnBug)
        : false;
      const clearedPausedOnBug = Boolean(snapshot.pausedOnBug) && !schedulerState.pausedOnBug;
      return {
        ok: true,
        enabled: true,
        playerIds: [...playerIds],
        pausedOnBug: schedulerState.pausedOnBug,
        clearedPausedOnBug,
        message: clearedPausedOnBug ? "电脑配置已恢复，已清除旧阻塞暂停" : "电脑配置已恢复",
      };
    }

    function configureAiAutoBattle(options = {}) {
      resetAiStrategyDemandCache();
      schedulerState.suspended = true;
      try {
        if (options.resetStrategyWeights) resetAiStrategyWeights();
        if (options.strategyTuning) {
          configureAiStrategyWeights(options.strategyTuning?.weights || options.strategyTuning, { merge: true });
        }
        if (options.strategyWeights) {
          const strategyDifficulty = normalizeAiDifficulty(options.aiDifficulty || aiAutoBattleState.aiDifficulty);
          const mergeStrategyWeights = options.mergeStrategyWeights !== false;
          const strategyMergeBase = mergeStrategyWeights
            && aiStrategyWeightsUseDifficultyDefaults
            && strategyDifficulty === AI_DIFFICULTY_WEAK_START
              ? AI_WEAK_START_STRATEGY_WEIGHT_DEFAULTS
              : null;
          configureAiStrategyWeights(options.strategyWeights, {
            merge: mergeStrategyWeights,
            ...(strategyMergeBase ? { baseWeights: strategyMergeBase } : {}),
          });
        }
        if (options.reset) {
          const resetResult = resetGameForAiAutoBattle(options);
          if (!resetResult.ok) return resetResult;
        }
        if (options.activePlayerCount && !options.reset) {
          const playerIds = getRuleProjection().players.players.map((player) => player.id);
          setTurnStatePlayerOrder(playerIds, { activePlayerCount: options.activePlayerCount });
          startInitialSelection();
        }
        if (options.stepDelayMs != null) {
          aiAutoBattleState.stepDelayMs = Math.max(0, Math.round(Number(options.stepDelayMs) || 0));
        }
        if (options.manualDrive != null) aiAutoBattleState.manualDrive = options.manualDrive === true;
        aiAutoBattleState.compactLogs = options.compactLogs === true;
        if (options.maxBugRepeats != null) {
          aiAutoBattleState.maxBugRepeats = Math.max(1, Math.round(Number(options.maxBugRepeats) || 1));
        }
        if (options.maxMovesPerTurn != null) {
          aiAutoBattleState.maxMovesPerTurn = Math.max(0, Math.round(Number(options.maxMovesPerTurn) || 0));
        }
        const configResult = setAiAutoBattlePlayers(options);
        updateActionButtons();
        renderStateReadout();
        return configResult;
      } finally {
        schedulerState.suspended = false;
        if (!options.suppressAutoSchedule) scheduleAiAutoStepIfNeeded();
      }
    }

    return {
      AI_DIFFICULTY_LAUGHABLE,
      AI_DIFFICULTY_WEAK_START,
      aiAutoBattleState,
      applyAiDifficultyToPlayer,
      applyAiDifficultyToPlayerIds,
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
      getPendingAutomationPlayerId,
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
    };
  }

  return {
    AI_DIFFICULTY_LAUGHABLE,
    AI_DIFFICULTY_WEAK_START,
    AI_STRATEGY_WEIGHT_DEFAULTS,
    AI_WEAK_START_STRATEGY_WEIGHT_DEFAULTS,
    createAiControlRuntime,
    createManualAiInputGuard,
    createAiControllerState,
    createAiDifficultyCommandHandler,
    createAiSeededRandom,
    getAiBatchSeed,
    getAiStrategyWeightDefaultsForDifficulty,
    hashAiSeed,
    normalizeAiDifficulty,
    runWithAiRandomSeed,
  };
});

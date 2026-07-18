"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const {
  OBSERVATION_SCHEMA_VERSION,
  normalizeTurnCandidate,
  sanitizeCard,
  sanitizePublicPlayer,
  sanitizeSelfPlayer,
  sanitizeAlienPublicState,
  sanitizeTechSupply,
  sanitizeFinalScoringState,
} = require("./headless-contract");

function hashSeed(seed) {
  const text = String(seed ?? "seti-headless");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = hashSeed(seed) || 1;
  function seededRandom() {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  }
  seededRandom.getState = () => state >>> 0;
  seededRandom.setState = (nextState) => {
    state = Number(nextState) >>> 0;
  };
  return seededRandom;
}

function getScriptPaths() {
  const htmlPath = path.resolve(__dirname, "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return [...html.matchAll(/<script src="\.\/([^"]+)"/g)]
    .map((match) => path.resolve(path.dirname(htmlPath), match[1].split("?")[0]));
}

function loadBrowserBundle(rootRef) {
  const scriptPaths = getScriptPaths();
  for (const scriptPath of scriptPaths) {
    delete require.cache[scriptPath];
  }
  const appScriptPath = scriptPaths[scriptPaths.length - 1];
  for (const scriptPath of scriptPaths.slice(0, -1)) {
    require(scriptPath);
    for (const key of Object.keys(globalThis)) {
      if (key.startsWith("Seti")) {
        rootRef[key] = globalThis[key];
      }
    }
  }
  require(appScriptPath);
  return rootRef.SetiRandomizer;
}

function buildDecision(api, legalActions) {
  const turnState = api.getTurnState();
  if (turnState.gameEnded) return null;
  const actorPlayerId = legalActions[0]?.actorPlayerId || turnState.currentPlayerId || null;
  if (!actorPlayerId) return null;
  return {
    actorPlayerId,
    effectOwnerPlayerId: null,
    currentPlayerId: turnState.currentPlayerId || null,
    source: "current_player",
    decisionType: "turn_action",
    choiceCount: legalActions.length,
  };
}

function buildObservation(api, seed, viewerPlayerId, legalActions = []) {
  const turnState = api.getTurnState();
  const playerState = api.getPlayerState();
  const currentPlayer = api.getCurrentPlayer();
  const perspectivePlayerId = viewerPlayerId || legalActions[0]?.actorPlayerId
    || turnState.currentPlayerId || currentPlayer?.id || null;
  const finalScoreByPlayerId = new Map(
    turnState.gameEnded
      ? (api.getFinalScoreSummaries?.() || []).map((summary) => [summary.playerId, summary])
      : [],
  );
  return {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    seed: seed ?? null,
    perspectivePlayerId,
    publicState: {
      roundNumber: turnState.roundNumber,
      turnNumber: turnState.turnNumber,
      actionCycleNumber: turnState.actionCycleNumber,
      currentPlayerId: turnState.currentPlayerId || currentPlayer?.id || null,
      passedPlayerIds: [...(turnState.passedPlayerIds || [])],
      completedTurnPlayerIds: [...(turnState.completedTurnPlayerIds || [])],
      activePlayerIds: (playerState.players || []).map((player) => player.id),
      players: (playerState.players || []).map((player) => sanitizePublicPlayer(
        player,
        turnState.gameEnded ? (finalScoreByPlayerId.get(player.id)?.totalScore ?? null) : null,
      )),
      board: {
        rockets: api.getRocketCoordinates?.() || [],
        planets: api.getPlanetStatsState?.() || {},
        solarSystem: api.getSolarSnapshot?.() || {},
        publicCards: (api.cardState?.publicCards || []).map(sanitizeCard),
        discardCount: (api.cardState?.discardPile || []).length,
        techSupply: sanitizeTechSupply(api.getTechSnapshot?.()),
        aliens: sanitizeAlienPublicState(api.getAlienState?.()),
        finalScoring: sanitizeFinalScoringState(api.getFinalScoringState?.()),
      },
      pending: buildDecision(api, legalActions),
    },
    selfState: sanitizeSelfPlayer(
      (playerState.players || []).find((player) => player.id === perspectivePlayerId) || null,
    ),
    decision: buildDecision(api, legalActions),
    actionHistorySummary: {
      count: (api.getActionLog?.() || []).length,
    },
    terminal: Boolean(turnState.gameEnded),
  };
}

function buildReward(beforePlayer, afterPlayer, terminal) {
  const beforeResources = beforePlayer?.resources || {};
  const afterResources = afterPlayer?.resources || {};
  return {
    immediateScoreDelta: (afterResources.score || 0) - (beforeResources.score || 0),
    resourceDelta: {
      credits: (afterResources.credits || 0) - (beforeResources.credits || 0),
      energy: (afterResources.energy || 0) - (beforeResources.energy || 0),
      publicity: (afterResources.publicity || 0) - (beforeResources.publicity || 0),
      availableData: (afterResources.availableData || 0) - (beforeResources.availableData || 0),
      additionalPublicScan: (afterResources.additionalPublicScan || 0) - (beforeResources.additionalPublicScan || 0),
      handCount: ((afterPlayer?.hand || []).length) - ((beforePlayer?.hand || []).length),
    },
    terminalScoreDelta: terminal ? ((afterResources.score || 0) - (beforeResources.score || 0)) : 0,
    shaping: {},
  };
}

function createActionSelector(action) {
  const payload = action?.payload || {};
  return {
    candidateIndex: action.candidateIndex ?? action.maskIndex,
    id: action.id || action.kind || action.actionId,
    tradeId: action.tradeId ?? payload.tradeId,
    cardId: action.cardId ?? payload.cardId,
    cardInstanceId: action.cardInstanceId ?? payload.cardInstanceId,
    handIndex: action.handIndex ?? payload.handIndex,
    blueSlot: action.blueSlot ?? payload.blueSlot,
    target: action.target || null,
  };
}

function getActionPhase(kind) {
  if (kind === "end-turn") return "turn_control";
  if (["move", "quickTrade", "industry", "cardCorner", "placeData"].includes(kind)) return "quick";
  return "main";
}

function completeInitialSelections(api) {
  const initialSelectionState = api.getInitialSelectionState?.();
  const requiredInitialCount = Math.max(
    1,
    Math.round(Number(initialSelectionState?.offersByPlayerId?.[initialSelectionState.currentPlayerId]?.selectedInitialIds?.length) || 0),
  );
  while (true) {
    const selectionState = api.getInitialSelectionState?.();
    if (!selectionState || selectionState.phase !== "selecting" || !selectionState.currentPlayerId) {
      return;
    }
    const offer = api.getInitialSelectionOffer?.(selectionState.currentPlayerId);
    if (!offer) {
      throw new Error(`初始选择缺少玩家 ${selectionState.currentPlayerId} 的 offer`);
    }
    const selectedIndustry = offer.selectedIndustryId || offer.industryOptions?.[0]?.id || null;
    if (!selectedIndustry) {
      throw new Error(`玩家 ${selectionState.currentPlayerId} 初始公司候选为空`);
    }
    api.selectInitialSelectionCard?.("industry", selectedIndustry);
    const initialOptionIds = (offer.initialOptions || [])
      .slice(0, Math.max(2, requiredInitialCount || 2))
      .map((card) => card?.id)
      .filter(Boolean);
    if (initialOptionIds.length < 2) {
      throw new Error(`玩家 ${selectionState.currentPlayerId} 初始牌候选不足`);
    }
    for (const cardId of initialOptionIds) {
      api.selectInitialSelectionCard?.("initial", cardId);
    }
    const confirmResult = api.confirmInitialSelection?.();
    if (confirmResult?.ok === false) {
      throw new Error(confirmResult.message || "确认初始选择失败");
    }
  }
}

function createHeadlessEnv() {
  let api = null;
  let seed = null;
  let config = null;
  let replaySteps = [];
  let environmentEvents = [];
  let legalActionSelectors = new Map();
  let lastLegalActions = null;
  let restoreRandom = null;
  let restoreHost = null;
  let seededRandom = null;
  let diagnostics = null;

  function recordDuration(key, startedAt) {
    diagnostics[key] += performance.now() - startedAt;
  }

  function buildTimedObservation(viewerPlayerId, legalActions) {
    const startedAt = performance.now();
    const observation = buildObservation(api, seed, viewerPlayerId, legalActions);
    recordDuration("observationMilliseconds", startedAt);
    diagnostics.observationCalls += 1;
    return observation;
  }

  function boot(resetConfig = {}) {
    const previousWindow = Object.prototype.hasOwnProperty.call(globalThis, "window")
      ? globalThis.window
      : undefined;
    const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
    const previousConfig = globalThis.SetiHeadlessRuntimeConfig;
    const hadConfig = Object.prototype.hasOwnProperty.call(globalThis, "SetiHeadlessRuntimeConfig");
    globalThis.window = globalThis;
    globalThis.SetiHeadlessRuntimeConfig = { enabled: true };
    restoreHost = () => {
      if (hadWindow) globalThis.window = previousWindow;
      else delete globalThis.window;
      if (hadConfig) globalThis.SetiHeadlessRuntimeConfig = previousConfig;
      else delete globalThis.SetiHeadlessRuntimeConfig;
    };
    const originalRandom = Math.random;
    seededRandom = createSeededRandom(resetConfig.seed);
    Math.random = seededRandom;
    restoreRandom = () => {
      Math.random = originalRandom;
    };
    api = loadBrowserBundle(globalThis);
    const startResult = api.startNewGame({
      activePlayerCount: resetConfig.activePlayerCount || 4,
      aiDifficulty: resetConfig.aiDifficulty || "laughable",
      clearStorage: false,
      message: "headless 新游戏已开始",
    });
    if (startResult?.ok === false) {
      throw new Error(startResult.message || "headless startNewGame 失败");
    }
    const playerIds = (api.getPlayerState().players || []).map((player) => player.id);
    api.configureAiAutoBattle({
      playerIds,
      aiDifficulty: resetConfig.aiDifficulty || "laughable",
      stepDelayMs: 0,
      manualDrive: true,
      suppressAutoSchedule: true,
    });
    const initialResolution = api.resolveAiToTurnBoundary({ maxSteps: 2000 });
    if (initialResolution?.ok === false) {
      const failure = initialResolution.final || initialResolution;
      const pendingState = api.getAiAutoBattleProgress?.().pendingState || null;
      const pendingSummary = pendingState
        ? `；pending=${JSON.stringify(pendingState)}`
        : "";
      throw new Error(
        `${failure.message || "headless reset 未能推进到首个决策点"}${pendingSummary}`,
      );
    }
  }

  return {
    reset(resetConfig = {}) {
      restoreRandom?.();
      restoreHost?.();
      seed = resetConfig.seed ?? "seti-headless";
      config = {
        seed,
        activePlayerCount: resetConfig.activePlayerCount || 4,
        aiDifficulty: resetConfig.aiDifficulty || "laughable",
        episodeId: resetConfig.episodeId || null,
        policyVersion: resetConfig.policyVersion || null,
        opponentIdentity: resetConfig.opponentIdentity || null,
        seat: resetConfig.seat ?? null,
      };
      replaySteps = [];
      environmentEvents = [];
      legalActionSelectors = new Map();
      lastLegalActions = null;
      diagnostics = {
        bootMilliseconds: 0,
        legalActionsMilliseconds: 0,
        observationMilliseconds: 0,
        actionExecutionMilliseconds: 0,
        replayMilliseconds: 0,
        legalActionsCalls: 0,
        observationCalls: 0,
        actionExecutionCalls: 0,
      };
      const bootStartedAt = performance.now();
      boot(config);
      recordDuration("bootMilliseconds", bootStartedAt);
      const legalActions = this.legalActions();
      return buildTimedObservation(undefined, legalActions);
    },
    observe(viewerPlayerId) {
      const legalActions = this.legalActions(viewerPlayerId);
      return buildTimedObservation(viewerPlayerId, legalActions);
    },
    legalActions(viewerPlayerId) {
      const startedAt = performance.now();
      const result = api.listAiTurnActionCandidates();
      if (!result?.ok) {
        lastLegalActions = [];
        recordDuration("legalActionsMilliseconds", startedAt);
        diagnostics.legalActionsCalls += 1;
        return [];
      }
      const actorPlayerId = result.currentPlayer?.id || api.getTurnState().currentPlayerId || null;
      if (viewerPlayerId && viewerPlayerId !== actorPlayerId) {
        recordDuration("legalActionsMilliseconds", startedAt);
        diagnostics.legalActionsCalls += 1;
        return [];
      }
      legalActionSelectors = new Map();
      const actions = (result.candidates || [])
        .filter((candidate) => candidate.available !== false)
        .map((candidate) => ({ candidate, action: normalizeTurnCandidate(candidate, actorPlayerId) }))
        .filter((entry) => entry.action)
        .sort((left, right) => left.action.actionId.localeCompare(right.action.actionId));
      actions.forEach((entry, maskIndex) => {
        entry.action.maskIndex = maskIndex;
        legalActionSelectors.set(entry.action.actionId, createActionSelector(entry.candidate));
      });
      const normalizedActions = actions.map((entry) => entry.action);
      lastLegalActions = normalizedActions;
      recordDuration("legalActionsMilliseconds", startedAt);
      diagnostics.legalActionsCalls += 1;
      return normalizedActions;
    },
    step(action) {
      const currentLegalActions = lastLegalActions || this.legalActions();
      const beforeObservation = buildTimedObservation(action?.actorPlayerId, currentLegalActions);
      const beforePlayerState = api.getPlayerState();
      const actorPlayerId = beforeObservation.decision?.actorPlayerId || null;
      const beforePlayer = (beforePlayerState.players || []).find((player) => player.id === actorPlayerId) || null;
      if (action?.actorPlayerId && action.actorPlayerId !== actorPlayerId) {
        return {
          ok: false,
          actionId: action?.actionId || action?.id || null,
          actorPlayerId,
          reward: buildReward(beforePlayer, beforePlayer, false),
          done: this.isTerminal(),
          observation: beforeObservation,
          legalActions: this.legalActions(),
          replayEvent: null,
          error: `动作执行者不匹配：期望 ${actorPlayerId}，收到 ${action.actorPlayerId}`,
        };
      }
      const selector = legalActionSelectors.get(action?.actionId);
      if (!selector) {
        return {
          ok: false,
          actionId: action?.actionId || null,
          actorPlayerId,
          reward: buildReward(beforePlayer, beforePlayer, false),
          done: this.isTerminal(),
          observation: beforeObservation,
          legalActions: currentLegalActions,
          replayEvent: null,
          error: `动作不在当前 legalActions：${action?.actionId || "<missing>"}`,
        };
      }
      let result;
      const actionStartedAt = performance.now();
      try {
        result = api.runAiSelectedTurnAction(selector, { maxSteps: 2000 });
      } catch (error) {
        result = { ok: false, message: error?.stack || error?.message || String(error) };
      }
      recordDuration("actionExecutionMilliseconds", actionStartedAt);
      diagnostics.actionExecutionCalls += 1;
      if (result?.ok === false) {
        const baseErrorMessage = result.message
          || result.resolution?.final?.message
          || result.resolution?.message
          || result.actionResult?.message
          || "执行失败";
        const pendingState = api.getAiAutoBattleProgress?.().pendingState || null;
        const recentResolution = (result.resolution?.steps || [])
          .slice(-3)
          .map((step) => step?.message)
          .filter(Boolean)
          .join(" | ");
        const errorMessage = [
          baseErrorMessage,
          recentResolution ? `recent=${recentResolution}` : null,
          pendingState ? `pending=${JSON.stringify(pendingState)}` : null,
        ].filter(Boolean).join("；");
        return {
          ok: false,
          actionId: action?.actionId || action?.id || null,
          actorPlayerId,
          reward: buildReward(beforePlayer, beforePlayer, false),
          done: this.isTerminal(),
          observation: this.observe(actorPlayerId),
          legalActions: this.legalActions(),
          replayEvent: null,
          error: errorMessage,
        };
      }
      const afterPlayerState = api.getPlayerState();
      const afterPlayer = (afterPlayerState.players || []).find((player) => player.id === actorPlayerId) || null;
      const postLegalActions = this.legalActions();
      const observation = buildTimedObservation(undefined, postLegalActions);
      const done = Boolean(observation.terminal);
      const reward = buildReward(beforePlayer, afterPlayer, done);
      const replayStartedAt = performance.now();
      const stepEnvironmentEvents = (result.resolution?.steps || []).map((event, eventIndex) => ({
        eventIndex: environmentEvents.length + eventIndex,
        type: event?.done ? "terminal" : event?.skipped ? "auto_skip" : "automatic_resolution",
        ownerPlayerId: event?.playerId || event?.actorPlayerId || null,
        sourceActionType: action.family || null,
        irreversible: event?.irreversible || null,
      }));
      environmentEvents.push(...stepEnvironmentEvents);
      const replayEvent = {
        stepIndex: replaySteps.length,
        actorPlayerId,
        action: structuredClone(action || {}),
        reward,
        preDecision: beforeObservation.decision,
        postDecision: observation.decision,
        publicSummary: observation.publicState,
        environmentEvents: stepEnvironmentEvents,
      };
      replaySteps.push(replayEvent);
      recordDuration("replayMilliseconds", replayStartedAt);
      return {
        ok: true,
        actionId: action?.actionId || action?.id || null,
        actorPlayerId,
        reward,
        done,
        observation,
        legalActions: postLegalActions,
        replayEvent,
      };
    },
    isTerminal() {
      return Boolean(api?.getTurnState?.().gameEnded);
    },
    getDiagnostics() {
      return structuredClone(diagnostics || {});
    },
    getReplay() {
      return {
        schemaVersion: "seti-rl-replay-v1",
        seed,
        episodeMetadata: {
          episodeId: config?.episodeId || null,
          policyVersion: config?.policyVersion || null,
          opponentIdentity: config?.opponentIdentity || null,
          seat: config?.seat ?? null,
        },
        config: structuredClone(config || {}),
        steps: structuredClone(replaySteps),
        environmentEvents: structuredClone(environmentEvents),
        finalStateSummary: this.observe(),
      };
    },
    loadReplay(replay) {
      if (!replay || replay.schemaVersion !== "seti-rl-replay-v1") {
        throw new Error("不支持的 replay schema");
      }
      this.reset(replay.config || { seed: replay.seed });
      for (const [stepIndex, event] of (replay.steps || []).entries()) {
        const result = this.step(event.action);
        if (!result.ok) {
          throw new Error(`replay 第 ${stepIndex} 步失败：${result.error || "未知错误"}`);
        }
      }
      return this.observe();
    },
    loadCheckpoint(checkpoint) {
      if (!checkpoint || checkpoint.schemaVersion !== "seti-rl-checkpoint-v1") {
        throw new Error(`不支持的 checkpoint schema：${checkpoint?.schemaVersion || "missing"}`);
      }
      if (Array.isArray(checkpoint.replaySteps)) {
        this.reset({
          ...(checkpoint.config || {}),
          seed: checkpoint?.replayCursor?.seed ?? checkpoint?.config?.seed ?? "seti-headless",
        });
        for (const [stepIndex, replayStep] of checkpoint.replaySteps.entries()) {
          const replayResult = this.step(replayStep.action);
          if (!replayResult.ok) {
            throw new Error(`checkpoint replay 第 ${stepIndex} 步失败：${replayResult.error || "未知错误"}`);
          }
        }
        if (checkpoint?.runtimeState?.randomState != null) {
          seededRandom?.setState(checkpoint.runtimeState.randomState);
        }
        return this.observe();
      }
      if (!api) {
        const checkpointSeed = checkpoint?.replayCursor?.seed ?? checkpoint?.config?.seed ?? "seti-headless";
        this.reset({ ...(checkpoint?.config || {}), seed: checkpointSeed });
      }
      api.restoreRecoverySnapshot(checkpoint?.coreState || checkpoint?.snapshot || checkpoint, { skipRefresh: true });
      replaySteps = Array.isArray(checkpoint?.replaySteps) ? structuredClone(checkpoint.replaySteps) : replaySteps;
      environmentEvents = Array.isArray(checkpoint?.environmentEvents)
        ? structuredClone(checkpoint.environmentEvents)
        : environmentEvents;
      config = structuredClone(checkpoint?.config || config || {});
      seed = checkpoint?.replayCursor?.seed ?? config.seed ?? seed;
      if (checkpoint?.runtimeState?.randomState != null) {
        seededRandom?.setState(checkpoint.runtimeState.randomState);
      }
      return this.observe();
    },
    createCheckpoint() {
      return {
        schemaVersion: "seti-rl-checkpoint-v1",
        coreState: api.createRecoverySnapshot(),
        runtimeState: {
          randomState: seededRandom?.getState?.() ?? null,
        },
        config: structuredClone(config || {}),
        replayCursor: {
          seed,
          stepIndex: replaySteps.length,
        },
        episodeMetadata: {
          episodeId: config?.episodeId || null,
          policyVersion: config?.policyVersion || null,
          opponentIdentity: config?.opponentIdentity || null,
          seat: config?.seat ?? null,
        },
        replaySteps: structuredClone(replaySteps),
        environmentEvents: structuredClone(environmentEvents),
      };
    },
    dispose() {
      restoreRandom?.();
      restoreRandom = null;
      restoreHost?.();
      restoreHost = null;
    },
  };
}

module.exports = {
  createHeadlessEnv,
};

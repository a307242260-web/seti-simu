"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const {
  OBSERVATION_SCHEMA_VERSION,
  CONDITIONAL_FAMILIES,
  normalizeTurnCandidate,
  normalizeConditionalCandidate,
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
  const owner = api.getHeadlessDecisionOwnerState?.(
    legalActions[0]?.actorPlayerId ? { id: legalActions[0].actorPlayerId } : null,
  ) || null;
  const actorPlayerId = owner?.actorPlayerId
    || legalActions[0]?.actorPlayerId
    || turnState.currentPlayerId
    || null;
  if (!actorPlayerId) return null;
  return {
    actorPlayerId,
    pendingOwnerPlayerId: owner?.pendingOwnerPlayerId || null,
    effectOwnerPlayerId: owner?.effectOwnerPlayerId || null,
    currentPlayerId: owner?.currentPlayerId || turnState.currentPlayerId || null,
    source: owner?.source || "current_player",
    decisionType: legalActions[0]?.decisionType || "turn_action",
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
        turnState.gameEnded ? (finalScoreByPlayerId.get(player.id) || null) : null,
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

function getActionPhase(kind) {
  if (kind === "end-turn") return "turn_control";
  if (["move", "quickTrade", "industry", "cardCorner", "placeData"].includes(kind)) return "quick";
  return "main";
}

const HEADLESS_PENDING_INVENTORY_KEYS = Object.freeze([
  "pendingScanTargetType", "pendingPublicScanQueue", "pendingHandScan", "pendingPassReserve",
  "pendingCardSelection", "pendingPlayCardSelection", "pendingMovePayment", "pendingCardTrigger",
  "pendingCardTriggerFreeMove", "pendingCardCornerFreeMove", "pendingCardTaskCompletion",
  "pendingStrategyPassiveSlotChoice", "pendingJiuzheCardPlay", "pendingYichangdianCardGain",
  "pendingYichangdianCornerAction", "pendingBanrenmaCardGain", "pendingBanrenmaOpportunity",
  "pendingChongTaskCompletion", "pendingChongCardGain", "pendingChongFossilChoice",
  "pendingAmibaCardGain", "pendingAmibaSymbolChoice", "pendingAmibaTraceRemoval",
  "pendingAomomoCardGain", "pendingRunezuCardGain", "pendingRunezuSymbolBranch",
  "pendingRunezuFaceSymbolPlacement", "pendingAlienTrace", "pendingLandTarget",
  "pendingScanAction4", "pendingDataPlacement", "pendingDataPlacementAction",
  "pendingActionEffectCardMove", "pendingActionEffectFreeMove", "pendingIndustryAbility",
  "pendingIndustryFreeMove", "pendingIndustryHandSelection",
]);

const HEADLESS_SCAN_TARGET_TYPES = Object.freeze([
  "conditional_sector_scan", "discard_any_income", "pay_credit_reward",
  "discard_corner_repeat", "remove_orbit_to_probe", "return_unfinished_task",
  "public_scan", "hand_scan", "sector_scan", "industry_pirates_raid_launch",
]);

function buildHeadlessUnsupportedError({ code, state, family = null, type = null, owner = null }) {
  const normalizedOwner = owner?.actorPlayerId || owner?.actorPlayer?.id || owner || null;
  return {
    code,
    state,
    family,
    type,
    owner: normalizedOwner,
    message: [
      code,
      `state=${state || "unknown"}`,
      `family=${family || "unknown"}`,
      `type=${type || "unknown"}`,
      `owner=${normalizedOwner || "unknown"}`,
    ].join(" "),
  };
}

function inspectHeadlessPendingState(api, conditional = null) {
  const pendingState = api.getAiAutoBattleProgress?.().pendingState || {};
  const owner = api.getHeadlessDecisionOwnerState?.(conditional?.actorPlayer || null) || null;
  const unknownPendingKey = Object.keys(pendingState).find((key) => (
    key.startsWith("pending")
    && !HEADLESS_PENDING_INVENTORY_KEYS.includes(key)
    && Boolean(pendingState[key])
  ));
  if (unknownPendingKey) {
    return {
      ok: false,
      error: buildHeadlessUnsupportedError({
        code: "HEADLESS_UNSUPPORTED_PENDING",
        state: unknownPendingKey,
        type: typeof pendingState[unknownPendingKey] === "object"
          ? pendingState[unknownPendingKey]?.type || "unknown"
          : typeof pendingState[unknownPendingKey],
        owner,
      }),
    };
  }
  if (
    pendingState.pendingScanTargetType
    && !HEADLESS_SCAN_TARGET_TYPES.includes(pendingState.pendingScanTargetType)
  ) {
    return {
      ok: false,
      error: buildHeadlessUnsupportedError({
        code: "HEADLESS_UNSUPPORTED_PENDING_TYPE",
        state: "pendingScanTargetType",
        type: pendingState.pendingScanTargetType,
        owner,
      }),
    };
  }
  const unsupportedCandidate = (conditional?.candidates || []).find((candidate) => (
    candidate?.available !== false && !CONDITIONAL_FAMILIES.includes(candidate?.family)
  ));
  if (unsupportedCandidate) {
    return {
      ok: false,
      error: buildHeadlessUnsupportedError({
        code: "HEADLESS_UNSUPPORTED_CONDITIONAL_FAMILY",
        state: "conditional_choice",
        family: unsupportedCandidate.family || "missing",
        type: unsupportedCandidate.target?.kind || unsupportedCandidate.id || "unknown",
        owner,
      }),
    };
  }
  return { ok: true, pendingState, owner };
}

function getHeadlessLegalBoundary(api) {
  const conditional = api.listHeadlessConditionalActionCandidates?.()
    || { ok: true, candidates: [] };
  const inspection = inspectHeadlessPendingState(api, conditional);
  if (!inspection.ok) return { ok: false, error: inspection.error, candidates: [] };
  const candidates = (conditional.candidates || []).filter((candidate) => candidate?.available !== false);
  if (candidates.length) {
    return {
      ok: true,
      decisionType: "conditional_choice",
      currentPlayer: conditional.actorPlayer || null,
      candidates,
    };
  }
  const turn = api.listHeadlessTurnActionCandidates();
  return { ...turn, decisionType: "turn_action" };
}

function drainHeadlessDeterministicEffects(api, maxSteps = 2000) {
  const steps = [];
  for (let index = 0; index < maxSteps; index += 1) {
    const conditional = api.listHeadlessConditionalActionCandidates?.()
      || { ok: true, candidates: [] };
    const inspection = inspectHeadlessPendingState(api, conditional);
    if (!inspection.ok) return { ok: false, final: inspection.error, steps };
    const conditionalCandidates = (conditional.candidates || [])
      .filter((candidate) => candidate?.available !== false);
    if (conditionalCandidates.length > 1) {
      return {
        ok: true,
        boundary: "conditional_choice",
        actorPlayer: structuredClone(conditional.actorPlayer || null),
        candidates: structuredClone(conditionalCandidates),
        steps,
      };
    }
    if (conditionalCandidates.length === 1) {
      const candidate = conditionalCandidates[0];
      const actionResult = api.executeHeadlessConditionalAction?.(structuredClone(candidate));
      const automaticStep = {
        ok: actionResult?.ok !== false,
        progressed: actionResult?.ok !== false,
        automaticConditionalChoice: true,
        family: candidate.family,
        actorPlayerId: conditional.actorPlayer?.id || null,
        target: structuredClone(candidate.target || null),
        actionResult,
      };
      steps.push(automaticStep);
      if (actionResult?.ok === false) {
        return { ok: false, final: actionResult, steps };
      }
      continue;
    }
    const turn = api.listHeadlessTurnActionCandidates();
    if (turn.candidates?.length || api.getTurnState().gameEnded) {
      return { ok: true, boundary: api.getTurnState().gameEnded ? "terminal" : "turn_action", steps };
    }
    const deterministicResult = api.advanceHeadlessDeterministicState?.();
    if (deterministicResult?.progressed) {
      steps.push(deterministicResult);
      continue;
    }
    if (api.getAiAutoBattleProgress?.().pendingState?.actionEffectFlowActive) {
      const effectResult = api.executeHeadlessCurrentActionEffect?.();
      steps.push(effectResult);
      if (!effectResult) {
        return { ok: false, final: { message: "活动效果未产生确定性推进结果" }, steps };
      }
      if (effectResult?.ok === false) {
        const pendingState = api.getAiAutoBattleProgress?.().pendingState || {};
        const currentEffect = pendingState.currentEffect || {};
        const owner = api.getHeadlessDecisionOwnerState?.() || null;
        const failure = {
          ...buildHeadlessUnsupportedError({
            code: "HEADLESS_EFFECT_EXECUTION_FAILED",
            state: "action_effect",
            type: currentEffect.type || effectResult.type || "unknown",
            owner,
          }),
          effectId: currentEffect.id || effectResult.effectId || "unknown",
          cause: effectResult.message || null,
        };
        failure.message = `${failure.message} effect=${failure.effectId}${failure.cause ? ` cause=${failure.cause}` : ""}`;
        return { ok: false, final: failure, steps };
      }
      continue;
    }
    return {
      ok: false,
      final: { message: "存在未迁移的 headless pending 状态，拒绝回退浏览器 AI resolver" },
      steps,
    };
  }
  return { ok: false, final: { message: `确定性效果推进超过 ${maxSteps} 步` }, steps };
}

function buildEnvironmentEvents(resolution, startIndex, sourceActionType = null) {
  return (resolution?.steps || []).map((event, eventIndex) => ({
    eventIndex: startIndex + eventIndex,
    type: event?.automaticConditionalChoice
      ? "automatic_conditional_choice"
      : event?.done ? "terminal" : event?.skipped ? "auto_skip" : "automatic_resolution",
    family: event?.family || null,
    target: event?.target || null,
    ownerPlayerId: event?.actorPlayerId || event?.playerId || null,
    sourceActionType,
    irreversible: event?.irreversible || null,
  }));
}

function createHeadlessEnv() {
  let api = null;
  let seed = null;
  let config = null;
  let replaySteps = [];
  let environmentEvents = [];
  let legalActionSelectors = new Map();
  let lastLegalActions = null;
  let lastObservation = null;
  let stateVersion = 0;
  let decisionVersion = 0;
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
    globalThis.SetiHeadlessRuntimeConfig = { enabled: true, ruleKernel: true };
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
    const setupSelectionStartedAt = performance.now();
    while (api.getInitialSelectionState?.()?.phase === "selecting") {
      const selectionResult = api.chooseHeadlessInitialSelection?.();
      if (selectionResult?.ok === false) {
        throw new Error(selectionResult.message || "headless 初始选择失败");
      }
    }
    recordDuration("setupSelectionMilliseconds", setupSelectionStartedAt);
    const resetDrainStartedAt = performance.now();
    const initialResolution = drainDeterministicEffects();
    recordDuration("resetDrainMilliseconds", resetDrainStartedAt);
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
    environmentEvents.push(...buildEnvironmentEvents(initialResolution, environmentEvents.length));
  }

  function drainDeterministicEffects(maxSteps = 2000) {
    return drainHeadlessDeterministicEffects(api, maxSteps);
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
      lastObservation = null;
      stateVersion = 1;
      decisionVersion = 1;
      diagnostics = {
        bootMilliseconds: 0,
        setupSelectionMilliseconds: 0,
        resetDrainMilliseconds: 0,
        legalActionsMilliseconds: 0,
        observationMilliseconds: 0,
        actionExecutionMilliseconds: 0,
        transitionMilliseconds: 0,
        effectDrainMilliseconds: 0,
        replayMilliseconds: 0,
        legalActionsCalls: 0,
        observationCalls: 0,
        actionExecutionCalls: 0,
      };
      const bootStartedAt = performance.now();
      boot(config);
      recordDuration("bootMilliseconds", bootStartedAt);
      const legalActions = this.legalActions();
      lastObservation = buildTimedObservation(undefined, legalActions);
      return structuredClone(lastObservation);
    },
    observe(viewerPlayerId) {
      const legalActions = this.legalActions(viewerPlayerId);
      return buildTimedObservation(viewerPlayerId, legalActions);
    },
    legalActions(viewerPlayerId) {
      const startedAt = performance.now();
      if (this.isTerminal()) {
        legalActionSelectors = new Map();
        lastLegalActions = [];
        recordDuration("legalActionsMilliseconds", startedAt);
        diagnostics.legalActionsCalls += 1;
        return [];
      }
      const cachedActorPlayerId = lastLegalActions?.[0]?.actorPlayerId || null;
      if (lastLegalActions && (!viewerPlayerId || viewerPlayerId === cachedActorPlayerId)) {
        recordDuration("legalActionsMilliseconds", startedAt);
        diagnostics.legalActionsCalls += 1;
        return structuredClone(lastLegalActions);
      }
      const result = getHeadlessLegalBoundary(api);
      if (!result?.ok) {
        diagnostics.lastError = result?.error || null;
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
        .map((candidate) => ({
          candidate,
          action: candidate.family
            ? normalizeConditionalCandidate(candidate, actorPlayerId)
            : normalizeTurnCandidate(candidate, actorPlayerId),
        }))
        .filter((entry) => entry.action)
        .sort((left, right) => left.action.actionId.localeCompare(right.action.actionId));
      actions.forEach((entry, maskIndex) => {
        entry.action.maskIndex = maskIndex;
        entry.action.stateVersion = stateVersion;
        entry.action.decisionVersion = decisionVersion;
        legalActionSelectors.set(entry.action.actionId, structuredClone(entry.candidate));
      });
      const normalizedActions = actions.map((entry) => entry.action);
      lastLegalActions = normalizedActions;
      recordDuration("legalActionsMilliseconds", startedAt);
      diagnostics.legalActionsCalls += 1;
      return normalizedActions;
    },
    step(action) {
      if (this.isTerminal()) {
        legalActionSelectors = new Map();
        lastLegalActions = [];
        const terminalObservation = lastObservation?.terminal
          ? structuredClone(lastObservation)
          : buildTimedObservation(undefined, []);
        lastObservation = terminalObservation;
        return {
          ok: false,
          code: "HEADLESS_TERMINAL",
          actionId: action?.actionId || action?.id || null,
          actorPlayerId: null,
          reward: buildReward(null, null, true),
          done: true,
          observation: terminalObservation,
          legalActions: [],
          replayEvent: null,
          error: "环境已终局，不能继续执行动作",
        };
      }
      const currentLegalActions = lastLegalActions || this.legalActions();
      const beforeObservation = lastObservation
        && (!action?.actorPlayerId || lastObservation.decision?.actorPlayerId === action.actorPlayerId)
        ? lastObservation
        : buildTimedObservation(action?.actorPlayerId, currentLegalActions);
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
      if (Number(action?.stateVersion) !== stateVersion || Number(action?.decisionVersion) !== decisionVersion) {
        return {
          ok: false,
          actionId: action?.actionId || null,
          actorPlayerId,
          reward: buildReward(beforePlayer, beforePlayer, false),
          done: this.isTerminal(),
          observation: beforeObservation,
          legalActions: currentLegalActions,
          replayEvent: null,
          error: `动作版本已失效：期望 state=${stateVersion}/decision=${decisionVersion}`,
        };
      }
      let result;
      const actionStartedAt = performance.now();
      try {
        const transitionStartedAt = performance.now();
        const actionResult = action?.decisionType === "conditional_choice"
          ? api.executeHeadlessConditionalAction(selector)
          : api.executeHeadlessTurnAction(selector, { resolveToTurnBoundary: false });
        recordDuration("transitionMilliseconds", transitionStartedAt);
        if (actionResult?.ok === false) {
          result = actionResult;
        } else {
          const drainStartedAt = performance.now();
          const resolution = drainDeterministicEffects();
          recordDuration("effectDrainMilliseconds", drainStartedAt);
          result = {
            ok: resolution?.ok !== false,
            progressed: true,
            action: selector,
            actionResult,
            resolution,
          };
        }
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
      stateVersion += 1;
      decisionVersion += 1;
      lastLegalActions = null;
      legalActionSelectors = new Map();
      const afterPlayerState = api.getPlayerState();
      const afterPlayer = (afterPlayerState.players || []).find((player) => player.id === actorPlayerId) || null;
      const postLegalActions = this.legalActions();
      const observation = buildTimedObservation(undefined, postLegalActions);
      lastObservation = observation;
      const done = Boolean(observation.terminal);
      const reward = buildReward(beforePlayer, afterPlayer, done);
      const replayStartedAt = performance.now();
      const stepEnvironmentEvents = buildEnvironmentEvents(
        result.resolution,
        environmentEvents.length,
        action.family || null,
      );
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
        api = null;
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
      legalActionSelectors = new Map();
      lastLegalActions = null;
      lastObservation = null;
      stateVersion += 1;
      decisionVersion += 1;
      const restoredResolution = drainDeterministicEffects();
      if (restoredResolution?.ok === false) {
        const failure = restoredResolution.final || restoredResolution;
        throw new Error(failure.message || "checkpoint 恢复后未能推进到合法决策点");
      }
      environmentEvents.push(...buildEnvironmentEvents(
        restoredResolution,
        environmentEvents.length,
        "load_checkpoint",
      ));
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
  buildEnvironmentEvents,
  buildDecision,
  getHeadlessLegalBoundary,
  createHeadlessEnv,
  drainHeadlessDeterministicEffects,
  inspectHeadlessPendingState,
};

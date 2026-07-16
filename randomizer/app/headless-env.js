"use strict";

const fs = require("node:fs");
const path = require("node:path");

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
  return function seededRandom() {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
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

function buildObservation(api, seed) {
  const turnState = api.getTurnState();
  const playerState = api.getPlayerState();
  const currentPlayer = api.getCurrentPlayer();
  const finalScoreByPlayerId = new Map(
    turnState.gameEnded
      ? (api.getFinalScoreSummaries?.() || []).map((summary) => [summary.playerId, summary])
      : [],
  );
  return {
    schemaVersion: "seti-rl-observation-v1",
    seed: seed ?? null,
    currentPlayerId: turnState.currentPlayerId || currentPlayer?.id || null,
    roundNumber: turnState.roundNumber,
    turnNumber: turnState.turnNumber,
    actionCycleNumber: turnState.actionCycleNumber,
    terminal: Boolean(turnState.gameEnded),
    players: (playerState.players || []).map((player) => ({
      playerId: player.id,
      color: player.color,
      score: player.resources?.score || 0,
      finalScore: turnState.gameEnded
        ? (finalScoreByPlayerId.get(player.id)?.totalScore ?? null)
        : null,
      credits: player.resources?.credits || 0,
      energy: player.resources?.energy || 0,
      publicity: player.resources?.publicity || 0,
      availableData: player.resources?.availableData || 0,
      handCount: (player.hand || []).length,
      reservedCount: (player.reservedCards || []).length,
    })),
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
  let restoreRandom = null;
  let restoreHost = null;

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
    const seededRandom = createSeededRandom(resetConfig.seed);
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
      };
      replaySteps = [];
      boot(config);
      return buildObservation(api, seed);
    },
    observe() {
      return buildObservation(api, seed);
    },
    legalActions() {
      const result = api.listAiTurnActionCandidates();
      if (!result?.ok) return [];
      return (result.candidates || [])
        .filter((candidate) => candidate.available !== false)
        .map((candidate) => ({
        actionId: `${candidate.id || "candidate"}:${candidate.candidateIndex}`,
        actorPlayerId: result.currentPlayer?.id || api.getTurnState().currentPlayerId || null,
        phase: getActionPhase(candidate.id),
        kind: candidate.id || null,
        target: candidate.target || null,
        payload: {
          tradeId: candidate.tradeId || null,
          cardId: candidate.cardId || null,
          cardInstanceId: candidate.cardInstanceId || null,
          handIndex: candidate.handIndex ?? null,
          blueSlot: candidate.blueSlot ?? null,
        },
        maskIndex: candidate.candidateIndex,
        summary: candidate.label || candidate.id || "action",
        score: candidate.score ?? null,
        }));
    },
    step(action) {
      const beforeObservation = buildObservation(api, seed);
      const beforePlayerState = api.getPlayerState();
      const actorPlayerId = beforeObservation.currentPlayerId;
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
      const selector = createActionSelector(action || {});
      let result;
      try {
        result = api.runAiSelectedTurnAction(selector, { maxSteps: 2000 });
      } catch (error) {
        result = { ok: false, message: error?.stack || error?.message || String(error) };
      }
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
          observation: buildObservation(api, seed),
          legalActions: this.legalActions(),
          replayEvent: null,
          error: errorMessage,
        };
      }
      const afterPlayerState = api.getPlayerState();
      const afterPlayer = (afterPlayerState.players || []).find((player) => player.id === actorPlayerId) || null;
      const observation = buildObservation(api, seed);
      const done = Boolean(observation.terminal);
      const reward = buildReward(beforePlayer, afterPlayer, done);
      const replayEvent = {
        stepIndex: replaySteps.length,
        actorPlayerId,
        action: structuredClone(action || {}),
        reward,
        preDecision: { actorPlayerId },
        postDecision: observation.terminal ? null : { actorPlayerId: observation.currentPlayerId },
        publicSummary: observation,
      };
      replaySteps.push(replayEvent);
      return {
        ok: true,
        actionId: action?.actionId || action?.id || null,
        actorPlayerId,
        reward,
        done,
        observation,
        legalActions: this.legalActions(),
        replayEvent,
      };
    },
    isTerminal() {
      return Boolean(api?.getTurnState?.().gameEnded);
    },
    getReplay() {
      return {
        schemaVersion: "seti-rl-replay-v1",
        seed,
        config: structuredClone(config || {}),
        steps: structuredClone(replaySteps),
        finalStateSummary: buildObservation(api, seed),
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
      return buildObservation(api, seed);
    },
    loadCheckpoint(checkpoint) {
      api.restoreRecoverySnapshot(checkpoint?.coreState || checkpoint?.snapshot || checkpoint);
      replaySteps = Array.isArray(checkpoint?.replaySteps) ? structuredClone(checkpoint.replaySteps) : replaySteps;
      return buildObservation(api, seed);
    },
    createCheckpoint() {
      return {
        schemaVersion: "seti-rl-checkpoint-v1",
        coreState: api.createRecoverySnapshot(),
        replayCursor: {
          seed,
          stepIndex: replaySteps.length,
        },
        replaySteps: structuredClone(replaySteps),
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

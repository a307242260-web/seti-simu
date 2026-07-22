"use strict";

const { performance } = require("node:perf_hooks");
const { createHeuristicPolicyAdapter } = require("../training/heuristic-policy-adapter");
const { createSimulationRuleComposition } = require("../training/simulation-rule-composition");
const {
  OBSERVATION_SCHEMA_VERSION,
  normalizeTurnCandidate,
  normalizeConditionalCandidate,
  sanitizeCard,
  sanitizePublicPlayer,
  sanitizeSelfPlayer,
  sanitizeAlienPublicState,
  sanitizeTechSupply,
  sanitizeFinalScoringState,
} = require("./simulation-contract");

const CHECKPOINT_SCHEMA_VERSION = "seti-rl-checkpoint-v1";
const REPLAY_SCHEMA_VERSION = "seti-rl-replay-v1";
const CORE_STATE_VERSION = 2;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function hashSeed(seed) {
  const text = String(seed ?? "seti-simulation");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = hashSeed(seed) || 1;
  const random = () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
  random.getState = () => state >>> 0;
  random.setState = (next) => { state = Number(next) >>> 0; };
  return random;
}

function compactEffectSessionJournal(journal) {
  if (!journal) return null;
  const replay = Array.isArray(journal.replay) ? journal.replay : [];
  const lastConfirmed = replay.at(-1) || null;
  return {
    schemaVersion: "seti-effect-session-journal-compact-v1",
    replayCursor: replay.length,
    replay: lastConfirmed ? [clone(lastConfirmed)] : [],
    counts: Object.fromEntries(Object.entries(journal)
      .filter(([, entries]) => Array.isArray(entries))
      .map(([key, entries]) => [key, entries.length])),
  };
}

function getWorkingProjection(composition) {
  return composition.stateSourcePort.read().state;
}

function getTurnState(state) {
  return { ...clone(state.turn || {}), currentPlayerId: state.players?.currentPlayerId || state.turn?.currentPlayerId || null };
}

function buildDecisionFromState(state, legalActions) {
  const turn = getTurnState(state);
  if (turn.gameEnded) return null;
  const actorPlayerId = legalActions[0]?.actorPlayerId || turn.currentPlayerId || null;
  if (!actorPlayerId) return null;
  const pending = state.match?.discardContinuation || null;
  return {
    actorPlayerId,
    pendingOwnerPlayerId: pending?.playerId || null,
    effectOwnerPlayerId: null,
    currentPlayerId: turn.currentPlayerId,
    source: pending ? "pending_owner" : "current_player",
    decisionType: legalActions[0]?.decisionType || "turn_action",
    choiceCount: legalActions.length,
  };
}

function buildDecision(api, legalActions) {
  const turnState = api.getTurnState();
  if (turnState.gameEnded) return null;
  const owner = api.getSimulationDecisionOwnerState?.(
    legalActions[0]?.actorPlayerId ? { id: legalActions[0].actorPlayerId } : null,
  ) || null;
  const actorPlayerId = owner?.actorPlayerId || legalActions[0]?.actorPlayerId || turnState.currentPlayerId || null;
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

function buildObservation(state, seed, viewerPlayerId, legalActions = []) {
  const turn = getTurnState(state);
  const playerState = state.players || { players: [] };
  const perspectivePlayerId = viewerPlayerId || legalActions[0]?.actorPlayerId || turn.currentPlayerId || null;
  const decision = buildDecisionFromState(state, legalActions);
  return {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    seed: seed ?? null,
    perspectivePlayerId,
    publicState: {
      roundNumber: turn.roundNumber,
      turnNumber: turn.turnNumber,
      actionCycleNumber: turn.actionCycleNumber,
      currentPlayerId: turn.currentPlayerId,
      passedPlayerIds: [...(turn.passedPlayerIds || [])],
      completedTurnPlayerIds: [...(turn.completedTurnPlayerIds || [])],
      activePlayerIds: [...(turn.activePlayerIds || [])],
      players: (playerState.players || []).map((player) => sanitizePublicPlayer(player, null)),
      board: {
        rockets: clone(state.pieces?.rockets || []),
        planets: clone(state.planets || {}),
        solarSystem: clone(state.solarSystem || {}),
        publicCards: (state.cards?.publicCards || []).map(sanitizeCard),
        discardCount: (state.cards?.discardPile || []).length,
        techSupply: sanitizeTechSupply(state.tech),
        aliens: sanitizeAlienPublicState(state.aliens),
        finalScoring: sanitizeFinalScoringState(state.finalScoring),
      },
      pending: decision,
    },
    selfState: sanitizeSelfPlayer(
      (playerState.players || []).find((player) => player.id === perspectivePlayerId) || null,
    ),
    decision,
    actionHistorySummary: { count: (state.match?.actionLog || []).length },
    terminal: Boolean(turn.gameEnded),
  };
}

function buildReward(beforePlayer, afterPlayer, terminal) {
  const before = beforePlayer?.resources || {};
  const after = afterPlayer?.resources || {};
  return {
    immediateScoreDelta: (after.score || 0) - (before.score || 0),
    resourceDelta: {
      credits: (after.credits || 0) - (before.credits || 0),
      energy: (after.energy || 0) - (before.energy || 0),
      publicity: (after.publicity || 0) - (before.publicity || 0),
      availableData: (after.availableData || 0) - (before.availableData || 0),
      additionalPublicScan: (after.additionalPublicScan || 0) - (before.additionalPublicScan || 0),
      handCount: (afterPlayer?.hand || []).length - (beforePlayer?.hand || []).length,
    },
    terminalScoreDelta: terminal ? (after.score || 0) - (before.score || 0) : 0,
    shaping: {},
  };
}

function createSimulationEnv() {
  let kernel = null;
  let composition = null;
  let seededRandom = null;
  let seed = null;
  let config = null;
  let replaySteps = [];
  let environmentEvents = [];
  let selectors = new Map();
  let cachedLegal = null;
  let lastObservation = null;
  let diagnostics = null;
  let policyAdapter = null;

  function recordDuration(key, startedAt) {
    diagnostics[key] += performance.now() - startedAt;
  }

  function rawLegalDescriptors() {
    const inspection = composition.inspect();
    if (inspection.phase === "awaiting_input" && inspection.session?.decision) {
      return clone(inspection.session.decision.choices || []);
    }
    return composition.inputPort.enumerateActions({})
      .filter((action) => action.phase !== "conditional");
  }

  function normalizeDescriptor(descriptor, actorPlayerId) {
    return descriptor.phase === "conditional"
      ? normalizeConditionalCandidate(descriptor, actorPlayerId)
      : normalizeTurnCandidate(descriptor, actorPlayerId);
  }

  function currentActorId(descriptors) {
    return descriptors[0]?.actorId || getTurnState(getWorkingProjection(composition)).currentPlayerId || null;
  }

  function observeWithActions(viewerPlayerId, actions) {
    const startedAt = performance.now();
    const result = buildObservation(getWorkingProjection(composition), seed, viewerPlayerId, actions);
    recordDuration("observationMilliseconds", startedAt);
    diagnostics.observationCalls += 1;
    return result;
  }

  function saveEnvelope() {
    const beforeVersion = composition.stateSourcePort.getSnapshot().meta.stateVersion;
    const result = composition.lifecycle.save({
      rngState: { algorithm: "seti-simulation-mulberry32-v1", state: seededRandom.getState() },
    });
    if (!result.ok) throw new Error(result.message || result.code || "composition save 失败");
    if (composition.stateSourcePort.getSnapshot().meta.stateVersion !== beforeVersion) {
      cachedLegal = null;
      selectors = new Map();
    }
    return result.envelope;
  }

  return {
    reset(resetConfig = {}) {
      seed = resetConfig.seed ?? "seti-simulation";
      config = {
        seed,
        activePlayerCount: resetConfig.activePlayerCount || 4,
        aiDifficulty: resetConfig.aiDifficulty || "laughable",
        episodeId: resetConfig.episodeId || null,
        policyVersion: resetConfig.policyVersion || null,
        opponentIdentity: resetConfig.opponentIdentity || null,
        seat: resetConfig.seat ?? null,
        offlineTeacher: resetConfig.offlineTeacher === true,
        compactReplay: resetConfig.compactReplay === true,
      };
      replaySteps = [];
      environmentEvents = [];
      selectors = new Map();
      cachedLegal = null;
      lastObservation = null;
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
      const startedAt = performance.now();
      seededRandom = createSeededRandom(seed);
      kernel = createSimulationRuleComposition({
        seed,
        activePlayerCount: config.activePlayerCount,
        random: seededRandom,
        rngState: { algorithm: "seti-simulation-mulberry32-v1", state: seededRandom.getState() },
      });
      composition = kernel.composition;
      const newGameResult = kernel.newGame(config);
      if (newGameResult?.ok === false) {
        throw new Error(newGameResult.message || newGameResult.code || "simulation newGame 失败");
      }
      const drainStartedAt = performance.now();
      const drain = composition.inputPort.beginDrain({ metadata: { source: "simulation_reset" } });
      recordDuration("resetDrainMilliseconds", drainStartedAt);
      if (drain?.ok === false) throw new Error(drain.message || drain.code || "simulation reset drain 失败");
      policyAdapter = createHeuristicPolicyAdapter({
        difficulty: config.aiDifficulty,
        strategyWeights: resetConfig.strategyWeights || {},
        seed,
      });
      policyAdapter.initializeSeats(
        (getWorkingProjection(composition).players?.players || []).map((player) => player.id),
        { phase: "new_game" },
      );
      recordDuration("bootMilliseconds", startedAt);
      const actions = this.legalActions();
      lastObservation = observeWithActions(undefined, actions);
      return clone(lastObservation);
    },

    observe(viewerPlayerId) {
      return observeWithActions(viewerPlayerId, this.legalActions(viewerPlayerId));
    },

    legalActions(viewerPlayerId) {
      const startedAt = performance.now();
      if (this.isTerminal()) return [];
      const cachedActorId = cachedLegal?.[0]?.actorPlayerId || null;
      if (cachedLegal && (!viewerPlayerId || viewerPlayerId === cachedActorId)) return clone(cachedLegal);
      const descriptors = rawLegalDescriptors();
      const actorPlayerId = currentActorId(descriptors);
      if (viewerPlayerId && viewerPlayerId !== actorPlayerId) return [];
      selectors = new Map();
      const stateVersion = getWorkingProjection(composition).meta?.stateVersion || 0;
      const decisionVersion = getWorkingProjection(composition).match?.decisionVersion || 0;
      cachedLegal = descriptors.map((descriptor) => ({ descriptor, action: normalizeDescriptor(descriptor, actorPlayerId) }))
        .filter((entry) => entry.action)
        .sort((left, right) => left.action.actionId.localeCompare(right.action.actionId))
        .map((entry, maskIndex) => {
          const action = { ...entry.action, maskIndex, stateVersion, decisionVersion };
          selectors.set(action.actionId, entry.descriptor);
          return action;
        });
      recordDuration("legalActionsMilliseconds", startedAt);
      diagnostics.legalActionsCalls += 1;
      return clone(cachedLegal);
    },

    step(action) {
      const actions = cachedLegal || this.legalActions();
      const selector = selectors.get(action?.actionId);
      const beforeObservation = lastObservation || observeWithActions(action?.actorPlayerId, actions);
      const beforeState = getWorkingProjection(composition);
      const actorPlayerId = beforeObservation.decision?.actorPlayerId || null;
      const beforePlayer = (beforeState.players?.players || []).find((player) => player.id === actorPlayerId) || null;
      if (!selector) {
        return {
          ok: false,
          actionId: action?.actionId || null,
          actorPlayerId,
          reward: buildReward(beforePlayer, beforePlayer, false),
          done: this.isTerminal(),
          observation: beforeObservation,
          legalActions: clone(actions),
          replayEvent: null,
          error: `动作不在当前 legalActions：${action?.actionId || "<missing>"}`,
        };
      }
      const startedAt = performance.now();
      const inspection = composition.inspect();
      const result = inspection.phase === "awaiting_input"
        ? composition.inputPort.submitDecision({
          decisionId: inspection.session.decision.decisionId,
          decisionVersion: inspection.session.decision.decisionVersion,
          choice: selector,
        })
        : composition.inputPort.submitAction(selector);
      recordDuration("actionExecutionMilliseconds", startedAt);
      diagnostics.actionExecutionCalls += 1;
      if (result?.ok === false) {
        return {
          ok: false,
          actionId: action.actionId,
          actorPlayerId,
          reward: buildReward(beforePlayer, beforePlayer, false),
          done: this.isTerminal(),
          observation: beforeObservation,
          legalActions: clone(actions),
          replayEvent: null,
          error: result.message || result.code || "规则执行失败",
          failure: clone(result),
        };
      }
      cachedLegal = null;
      selectors = new Map();
      const postActions = this.legalActions();
      const observation = observeWithActions(undefined, postActions);
      lastObservation = observation;
      const afterState = getWorkingProjection(composition);
      const afterPlayer = (afterState.players?.players || []).find((player) => player.id === actorPlayerId) || null;
      const reward = buildReward(beforePlayer, afterPlayer, observation.terminal);
      const journal = result.journal || composition.inspect().session?.journal || null;
      const replayEvent = {
        stepIndex: replaySteps.length,
        actorPlayerId,
        action: clone(action),
        reward,
        preDecision: beforeObservation.decision,
        postDecision: observation.decision,
        publicSummary: config.compactReplay ? null : observation.publicState,
        environmentEvents: [],
        effectSessionJournal: config.compactReplay ? compactEffectSessionJournal(journal) : clone(journal),
      };
      replaySteps.push(replayEvent);
      return {
        ok: true,
        actionId: action.actionId,
        actorPlayerId,
        reward,
        done: observation.terminal,
        observation,
        legalActions: postActions,
        replayEvent,
      };
    },

    isTerminal() {
      return Boolean(composition && getTurnState(getWorkingProjection(composition)).gameEnded);
    },

    getDiagnostics() { return clone(diagnostics || {}); },

    runOfflineTeacherDecision() {
      if (!config?.offlineTeacher) throw new Error("offline teacher oracle 未启用");
      return this.runHeuristicPolicyDecision(true);
    },

    runHeuristicPolicyDecision(asTeacher = false) {
      const beforeActions = this.legalActions();
      const beforeObservation = lastObservation || observeWithActions(undefined, beforeActions);
      if (!beforeActions.length) throw new Error("Heuristic opponent 没有合法候选");
      const selection = policyAdapter.runDecision(beforeObservation, beforeActions, {
        seed,
        episodeId: config?.episodeId || null,
      }, (chosenAction) => this.step(chosenAction));
      const result = selection.submission?.result;
      if (!result?.ok) throw new Error(result?.error || "Heuristic opponent 执行失败");
      if (!asTeacher) return { ...result, policyDecision: selection.decision, policyProvenance: policyAdapter.getProvenance() };
      return {
        beforeObservation,
        beforeActions,
        teacherResult: { decision: selection.decision, provenance: policyAdapter.getProvenance() },
        teacherLogs: [],
        teacherAdapter: policyAdapter.getProvenance().version,
        chosenAction: selection.action,
        observation: result.observation,
        legalActions: result.legalActions,
        done: result.done,
      };
    },

    getReplay() {
      return {
        schemaVersion: REPLAY_SCHEMA_VERSION,
        seed,
        episodeMetadata: {
          episodeId: config?.episodeId || null,
          policyVersion: config?.policyVersion || null,
          opponentIdentity: config?.opponentIdentity || null,
          seat: config?.seat ?? null,
          policyProvenance: policyAdapter?.getProvenance?.() || null,
        },
        config: clone(config || {}),
        effectSessions: replaySteps.map((step) => step.effectSessionJournal).filter(Boolean),
        steps: clone(replaySteps),
        environmentEvents: clone(environmentEvents),
        finalStateSummary: this.observe(),
      };
    },

    loadReplay(replay) {
      if (!replay || replay.schemaVersion !== REPLAY_SCHEMA_VERSION) throw new Error("不支持的 replay schema");
      this.reset(replay.config || { seed: replay.seed });
      for (const [index, event] of (replay.steps || []).entries()) {
        const result = this.step(event.action);
        if (!result.ok) throw new Error(`replay 第 ${index} 步失败：${result.error || "未知错误"}`);
      }
      return this.observe();
    },

    createCheckpoint() {
      const envelope = saveEnvelope();
      return {
        schemaVersion: CHECKPOINT_SCHEMA_VERSION,
        coreState: {
          version: CORE_STATE_VERSION,
          committedState: envelope.committedState,
          compositionEnvelope: envelope,
        },
        config: clone(config || {}),
        replayCursor: { seed, stepIndex: replaySteps.length },
        effectSessionJournals: replaySteps.map((step) => step.effectSessionJournal).filter(Boolean),
        machinePlayerHostSnapshot: policyAdapter?.createHostSnapshot?.() || null,
        replaySteps: clone(replaySteps),
        environmentEvents: clone(environmentEvents),
      };
    },

    loadCheckpoint(checkpoint) {
      if (!checkpoint || checkpoint.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
        throw new Error(`不支持的 checkpoint schema：${checkpoint?.schemaVersion || "missing"}`);
      }
      if (checkpoint?.coreState?.version !== CORE_STATE_VERSION) {
        throw new Error("checkpoint coreState 反序列化失败：RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED");
      }
      this.reset(checkpoint.config || { seed: checkpoint.replayCursor?.seed });
      let committed;
      try {
        committed = JSON.parse(checkpoint.coreState.committedState);
      } catch (error) {
        throw new Error(`checkpoint coreState 反序列化失败：${error?.message || "STATE_DESERIALIZE_FAILED"}`);
      }
      if (Array.isArray(checkpoint.replaySteps)) {
        for (const [index, replayStep] of checkpoint.replaySteps.entries()) {
          const result = this.step(replayStep.action);
          if (!result.ok) throw new Error(`checkpoint replay 第 ${index} 步失败：${result.error || "未知错误"}`);
        }
        const rebuilt = JSON.parse(this.createCheckpoint().coreState.committedState);
        if (JSON.stringify(rebuilt.meta?.sequences) !== JSON.stringify(committed.meta?.sequences)) {
          throw new Error("checkpoint replay 后唯一序列与 committed meta 不一致");
        }
        const rngState = committed.meta?.rngState;
        if (rngState?.algorithm !== "seti-simulation-mulberry32-v1" || !Number.isSafeInteger(rngState.state)) {
          throw new Error("checkpoint coreState 缺少可恢复的 simulation RNG 状态");
        }
        seededRandom.setState(rngState.state);
        environmentEvents = clone(checkpoint.environmentEvents || []);
        if (checkpoint.machinePlayerHostSnapshot) policyAdapter.restoreHostSnapshot(checkpoint.machinePlayerHostSnapshot);
        cachedLegal = null;
        selectors = new Map();
        return this.observe();
      }
      const envelope = checkpoint.coreState.compositionEnvelope;
      if (!envelope || envelope.committedState !== checkpoint.coreState.committedState) {
        throw new Error("checkpoint coreState 反序列化失败：RULE_COMPOSITION_ENVELOPE_INVALID");
      }
      const restore = composition.lifecycle.restore(envelope);
      if (!restore.ok) throw new Error(`checkpoint coreState 反序列化失败：${restore.code || restore.message}`);
      const rngState = committed.meta?.rngState;
      if (rngState?.algorithm !== "seti-simulation-mulberry32-v1" || !Number.isSafeInteger(rngState.state)) {
        throw new Error("checkpoint coreState 缺少可恢复的 simulation RNG 状态");
      }
      seededRandom.setState(rngState.state);
      replaySteps = clone(checkpoint.replaySteps || []);
      environmentEvents = clone(checkpoint.environmentEvents || []);
      cachedLegal = null;
      selectors = new Map();
      if (checkpoint.machinePlayerHostSnapshot) policyAdapter.restoreHostSnapshot(checkpoint.machinePlayerHostSnapshot);
      const actions = this.legalActions();
      lastObservation = observeWithActions(undefined, actions);
      return clone(lastObservation);
    },

    dispose() {
      kernel = null;
      composition = null;
      selectors = new Map();
      cachedLegal = null;
    },
  };
}

module.exports = { buildDecision, createSimulationEnv };

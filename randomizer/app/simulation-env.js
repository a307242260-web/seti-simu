"use strict";

const { performance } = require("node:perf_hooks");
const { createSimulationRuleComposition } = require("../training/simulation-rule-composition");
const {
  ACTION_SCHEMA_VERSION,
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
const outcomeModel = require("../game/ai/outcome-model");

const CHECKPOINT_SCHEMA_VERSION = "seti-rl-checkpoint-v1";
const REPLAY_SCHEMA_VERSION = "seti-rl-replay-v1";
const CORE_STATE_VERSION = 2;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function stableSerialize(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
}

function sameSubmittedAction(submitted, current) {
  return submitted?.schemaVersion === current?.schemaVersion
    && submitted?.actionId === current?.actionId
    && submitted?.actorPlayerId === current?.actorPlayerId
    && submitted?.decisionType === current?.decisionType
    && submitted?.family === current?.family
    && submitted?.stateVersion === current?.stateVersion
    && submitted?.decisionVersion === current?.decisionVersion
    && stableSerialize(submitted?.target || null) === stableSerialize(current?.target || null)
    && stableSerialize(submitted?.payload || null) === stableSerialize(current?.payload || null);
}

function environmentError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
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

const PROBE_ROUTE_FAMILIES = new Set(["launch", "move", "orbit", "land"]);

function publicRocketList(observation) {
  return observation?.publicState?.board?.rockets || [];
}

function rocketPosition(observation, rocketId) {
  const rocket = publicRocketList(observation)
    .find((candidate) => String(candidate?.id) === String(rocketId));
  return rocket?.surface === "solar-board"
    ? `${Number(rocket.sectorX)},${Number(rocket.sectorY)}`
    : null;
}

function sameProbeMove(action, step, rocketId) {
  return action?.family === "move"
    && String(action.target?.rocketId) === String(rocketId)
    && Number(action.target?.deltaX) === Number(step?.deltaX)
    && Number(action.target?.deltaY) === Number(step?.deltaY);
}

function sameProbeEndpoint(action, goal, rocketId) {
  if (action?.family !== goal?.endpointFamily) return false;
  if (String(action.target?.rocketId) !== String(rocketId)) return false;
  if (String(action.target?.planetId || "") !== String(goal.planetId || "")) return false;
  const expectedTarget = goal.endpointTarget || {};
  return String(action.target?.type || "planet") === String(expectedTarget.type || "planet")
    && String(action.target?.satelliteId || "") === String(expectedTarget.satelliteId || "");
}

function selectProbeRouteContinuations(context) {
  const initial = context.initialAction;
  if (!PROBE_ROUTE_FAMILIES.has(initial?.family)) return [];
  if ((context.actionChain || []).some((actionId) => (
    String(actionId).startsWith("orbit:") || String(actionId).startsWith("land:")
  ))) return [];
  if ((context.checkpoints || []).length >= 6) return [];

  const goal = context.rootObservation?.probeRouteRequirements?.candidates?.[0] || null;
  if (!goal) return [];
  let rocketId = initial.target?.rocketId ?? null;
  if (initial.family === "launch") {
    if (goal.nextStep?.family !== "launch") return [];
    const rootIds = new Set(publicRocketList(context.rootObservation).map((rocket) => String(rocket.id)));
    const launched = publicRocketList(context.checkpoints?.[0]?.observation)
      .find((rocket) => rocket?.surface === "solar-board" && !rootIds.has(String(rocket.id)));
    rocketId = launched?.id ?? null;
  } else if (initial.family === "move") {
    if (!sameProbeMove(initial, goal.nextStep, rocketId)) return [];
  } else if (!sameProbeEndpoint(initial, goal, rocketId)) {
    return [];
  }
  if (rocketId == null) return [];

  const visited = new Set([
    rocketPosition(context.rootObservation, rocketId),
    ...(context.checkpoints || []).map((checkpoint) => rocketPosition(checkpoint.observation, rocketId)),
  ].filter(Boolean));
  const currentPosition = rocketPosition(
    context.checkpoints?.[context.checkpoints.length - 1]?.observation,
    rocketId,
  );
  const completedMoves = (context.checkpoints || [])
    .filter((checkpoint) => checkpoint.family === "move").length;
  const nextMove = goal.path?.[completedMoves] || null;
  return (context.legalSuccessors || []).filter((successor) => {
    if (nextMove) {
      if (!sameProbeMove(successor, nextMove, rocketId) || !currentPosition) return false;
    } else {
      return sameProbeEndpoint(successor, goal, rocketId);
    }
    const [x, y] = currentPosition.split(",").map(Number);
    const nextPosition = `${x + Number(successor.target?.deltaX || 0)},${y + Number(successor.target?.deltaY || 0)}`;
    return !visited.has(nextPosition);
  });
}

function buildDecisionFromState(state, legalActions) {
  const turn = getTurnState(state);
  if (turn.gameEnded) return null;
  const actorPlayerId = legalActions[0]?.actorPlayerId || turn.currentPlayerId || null;
  if (!actorPlayerId) return null;
  const pending = state.match?.pendingDecision?.kind === "discard"
    ? state.match.pendingDecision : null;
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
    probeRouteRequirements: clone(state.probeRouteRequirements || null),
    terminal: Boolean(turn.gameEnded),
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
  let policySeatsInitialized = false;
  let disposed = false;

  function evaluateActionOutcomes(actions = null, options = {}) {
    assertUsable();
    cachedLegal = null;
    selectors = new Map();
    const freshLegal = this.legalActions();
    const legal = clone((actions || freshLegal).map((requested) => (
      freshLegal.find((action) => action.actionId === requested.actionId) || requested
    )));
    const descriptors = legal.map((action) => (
      selectors.get(action.actionId) || action
    ));
    return composition.counterfactualPort.evaluate(descriptors, {
      viewer: { playerId: legal[0]?.actorPlayerId || null, role: "player" },
      maxDepth: options.maxDepth || 12,
      maxLeaves: options.maxLeaves || 16,
      confidence: "low",
      continueAfterSettled: selectProbeRouteContinuations,
    });
  }

  function recordDuration(key, startedAt) {
    diagnostics[key] += performance.now() - startedAt;
  }

  function assertNotDisposed() {
    if (disposed) throw environmentError("SIMULATION_ENV_DISPOSED", "Simulation env 已 dispose");
  }

  function assertUsable() {
    assertNotDisposed();
    if (!composition) throw environmentError("SIMULATION_ENV_NOT_READY", "Simulation env 尚未 reset");
  }

  function ensurePolicyAdapter() {
    if (!policyAdapter) {
      const { createHeuristicPolicyAdapter } = require("../training/heuristic-policy-adapter");
      policyAdapter = createHeuristicPolicyAdapter({
        difficulty: config.aiDifficulty,
        strategyWeights: config.strategyWeights || {},
        seed,
      });
    }
    return policyAdapter;
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
    const projected = composition.projection({
      playerId: viewerPlayerId || actions?.[0]?.actorPlayerId || null,
      role: "player",
    }).state;
    const state = {
      ...getWorkingProjection(composition),
      probeRouteRequirements: clone(projected?.probeRouteRequirements || null),
    };
    const result = buildObservation(state, seed, viewerPlayerId, actions);
    recordDuration("observationMilliseconds", startedAt);
    diagnostics.observationCalls += 1;
    return result;
  }

  function standardObservation(observation, seatId, actions = []) {
    return outcomeModel.createDecisionObservation(observation, {
      seatId,
      stateVersion: actions[0]?.stateVersion ?? null,
      decisionVersion: actions[0]?.decisionVersion ?? null,
    });
  }

  function rewardBetween(beforeObservation, afterObservation, seatId, beforeActions = [], afterActions = []) {
    return outcomeModel.createReward(
      standardObservation(beforeObservation, seatId, beforeActions),
      standardObservation(afterObservation, seatId, afterActions),
    );
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
      if (disposed) throw environmentError("SIMULATION_ENV_DISPOSED", "Simulation env 已 dispose");
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
        projectCounterfactualState: (state, viewer) => buildObservation(
          state,
          seed,
          viewer?.playerId || null,
          [],
        ),
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
      policyAdapter = null;
      policySeatsInitialized = false;
      recordDuration("bootMilliseconds", startedAt);
      const actions = this.legalActions();
      lastObservation = observeWithActions(undefined, actions);
      return clone(lastObservation);
    },

    observe(viewerPlayerId) {
      assertUsable();
      return observeWithActions(viewerPlayerId, this.legalActions(viewerPlayerId));
    },

    legalActions(viewerPlayerId) {
      assertUsable();
      const startedAt = performance.now();
      if (this.isTerminal()) return [];
      const cachedActorId = cachedLegal?.[0]?.actorPlayerId || null;
      if (cachedLegal && (!viewerPlayerId || viewerPlayerId === cachedActorId)) return clone(cachedLegal);
      const descriptors = rawLegalDescriptors();
      const actorPlayerId = currentActorId(descriptors);
      if (viewerPlayerId && viewerPlayerId !== actorPlayerId) return [];
      selectors = new Map();
      const stateVersion = getWorkingProjection(composition).meta?.stateVersion || 0;
      const inspection = composition.inspect();
      const decisionVersion = inspection.phase === "awaiting_input"
        ? inspection.session?.decision?.decisionVersion ?? 0
        : getWorkingProjection(composition).match?.decisionVersion || 0;
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
      assertUsable();
      const actions = cachedLegal || this.legalActions();
      const beforeObservation = lastObservation || observeWithActions(action?.actorPlayerId, actions);
      const actorPlayerId = beforeObservation.decision?.actorPlayerId || null;
      const terminal = this.isTerminal();
      const reject = (code, message) => ({
        ok: false,
        actionId: action?.actionId || null,
        actorPlayerId,
        reward: rewardBetween(beforeObservation, beforeObservation, actorPlayerId, actions, actions),
        done: terminal,
        terminated: terminal,
        truncated: false,
        observation: beforeObservation,
        legalActions: clone(actions),
        replayEvent: null,
        error: message,
        failure: { ok: false, code, message },
      });
      if (terminal) return reject("SIMULATION_TERMINAL", "terminal 环境不接受新的 policy action");
      const currentAction = actions.find((candidate) => candidate.actionId === action?.actionId);
      if (!currentAction) {
        return reject(
          "SIMULATION_ACTION_NOT_LEGAL",
          `动作不在当前 legalActions：${action?.actionId || "<missing>"}`,
        );
      }
      if (action?.schemaVersion !== ACTION_SCHEMA_VERSION) {
        return reject("SIMULATION_ACTION_SCHEMA_MISMATCH", "Simulation Action schema 版本不匹配");
      }
      if (action.actorPlayerId !== currentAction.actorPlayerId) {
        return reject("SIMULATION_ACTION_ACTOR_MISMATCH", "Simulation Action actor 不是当前 decision owner");
      }
      if (action.stateVersion !== currentAction.stateVersion
        || action.decisionVersion !== currentAction.decisionVersion) {
        return reject("SIMULATION_ACTION_STALE", "Simulation Action authority version 已过期");
      }
      if (!sameSubmittedAction(action, currentAction)) {
        return reject("SIMULATION_ACTION_DESCRIPTOR_MISMATCH", "Simulation Action descriptor 与当前 legal set 不一致");
      }
      const selector = selectors.get(currentAction.actionId);
      if (!selector) {
        return reject("SIMULATION_ACTION_SELECTOR_MISSING", "当前 legal action 缺少规则 selector");
      }
      const startedAt = performance.now();
      const inspection = composition.inspect();
      const result = inspection.phase === "awaiting_input"
        ? composition.inputPort.submitDecision({
          decisionId: inspection.session.decision.decisionId,
          decisionVersion: inspection.session.decision.decisionVersion,
          ownerId: inspection.session.decision.ownerId,
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
          reward: rewardBetween(beforeObservation, beforeObservation, actorPlayerId, actions, actions),
          done: this.isTerminal(),
          terminated: this.isTerminal(),
          truncated: false,
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
      const reward = rewardBetween(beforeObservation, observation, actorPlayerId, actions, postActions);
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
        terminated: observation.terminal,
        truncated: false,
        observation,
        legalActions: postActions,
        replayEvent,
      };
    },

    isTerminal() {
      assertUsable();
      return Boolean(getTurnState(getWorkingProjection(composition)).gameEnded);
    },

    getDiagnostics() {
      assertUsable();
      return clone(diagnostics || {});
    },

    getCounterfactualDiagnostics() {
      assertUsable();
      return clone(composition.counterfactualPort.getDiagnostics?.() || null);
    },

    readCounterfactualRngState() {
      assertUsable();
      return seededRandom.getState();
    },

    runOfflineTeacherDecision() {
      assertUsable();
      if (!config?.offlineTeacher) throw new Error("offline teacher oracle 未启用");
      return this.runHeuristicPolicyDecision(true);
    },

    runHeuristicPolicyDecision(asTeacher = false) {
      assertUsable();
      ensurePolicyAdapter();
      if (!policySeatsInitialized) {
        policyAdapter.initializeSeats(
          (getWorkingProjection(composition).players?.players || []).map((player) => player.id),
          { phase: "new_game" },
        );
        policySeatsInitialized = true;
      }
      this.createCheckpoint();
      cachedLegal = null;
      selectors = new Map();
      const beforeActions = this.legalActions();
      const beforeObservation = lastObservation || observeWithActions(undefined, beforeActions);
      if (!beforeActions.length) throw new Error("Heuristic opponent 没有合法候选");
      const policyObservation = standardObservation(beforeObservation, beforeActions[0].actorPlayerId, beforeActions);
      const initialSetupBoundary = beforeActions.every((action) => (
        ["choose_card", "choose_payment"].includes(action.family)
        && ["select_initial_card", "confirm_initial_setup", "discard-hand-cards"]
          .includes(action.target?.kind)
      ));
      const actionOutcomes = initialSetupBoundary
        ? []
        : outcomeModel.projectOutcomeObservations(
          evaluateActionOutcomes.call(this, beforeActions),
          {
            seatId: beforeActions[0].actorPlayerId,
            stateVersion: beforeActions[0].stateVersion,
            decisionVersion: beforeActions[0].decisionVersion,
          },
        );
      const selection = policyAdapter.runDecision(policyObservation, beforeActions, {
        seed,
        episodeId: config?.episodeId || null,
      }, (chosenAction) => this.step(chosenAction), actionOutcomes);
      const result = selection.submission?.result;
      if (!result?.ok) throw new Error(result?.error || "Heuristic opponent 执行失败");
      if (!asTeacher) {
        return {
          ...result,
          policyDecision: selection.decision,
          policyProvenance: policyAdapter.getProvenance(),
          actionOutcomes: selection.context.actionOutcomes,
        };
      }
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
      assertUsable();
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

    evaluateActionOutcomes,

    loadReplay(replay) {
      assertNotDisposed();
      if (!replay || replay.schemaVersion !== REPLAY_SCHEMA_VERSION) throw new Error("不支持的 replay schema");
      this.reset(replay.config || { seed: replay.seed });
      for (const [index, event] of (replay.steps || []).entries()) {
        const result = this.step(event.action);
        if (!result.ok) throw new Error(`replay 第 ${index} 步失败：${result.error || "未知错误"}`);
      }
      return this.observe();
    },

    createCheckpoint() {
      assertUsable();
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
      assertNotDisposed();
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
        if (checkpoint.machinePlayerHostSnapshot) {
          ensurePolicyAdapter().restoreHostSnapshot(checkpoint.machinePlayerHostSnapshot);
          policySeatsInitialized = true;
        }
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
      if (checkpoint.machinePlayerHostSnapshot) {
        ensurePolicyAdapter().restoreHostSnapshot(checkpoint.machinePlayerHostSnapshot);
        policySeatsInitialized = true;
      }
      const actions = this.legalActions();
      lastObservation = observeWithActions(undefined, actions);
      return clone(lastObservation);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      kernel = null;
      composition = null;
      seededRandom = null;
      policyAdapter = null;
      selectors = new Map();
      cachedLegal = null;
      lastObservation = null;
    },
  };
}

module.exports = { buildDecision, createSimulationEnv };

"use strict";

const { performance } = require("node:perf_hooks");
const { createSeededRandom, hashSeed, RNG_ALGORITHM } = require("../game/random");
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
const expectedScoreEvaluator = require("../game/ai/expected-score-evaluator");
const endGameScoring = require("../game/end-game-scoring");
const finalScoring = require("../game/final-scoring");
const cardEffects = require("../game/cards/effects");

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
  return composition.projection({
    viewerId: "simulation:system",
    playerId: null,
    role: "simulation",
  }).state;
}

function getTurnState(state) {
  // 调用方只瞬时读取原始字段并复制进新对象，不持有引用，无需克隆
  return state.turn || {};
}

function policyOutcomeActions(actions, policyObservation) {
  const candidates = (actions || []).filter((action) => (
    expectedScoreEvaluator.requiresRootCounterfactual(action, policyObservation)
  ));
  return expectedScoreEvaluator.selectSecondaryAgentRootActions({
    focalSeatId: candidates[0]?.actorPlayerId || null,
    rootObservation: policyObservation,
    legalActions: candidates,
    maxProxyDepth: 15,
  });
}

function initialSetupOutcomeActions(actions, observation) {
  const setup = observation?.publicState?.resident?.initialSetup;
  const offer = setup?.offer;
  if (!setup?.active || !offer) return actions || [];
  if (!offer.selectedIndustryId) {
    return (actions || []).filter((action) => (
      action.target?.kind === "select_initial_card"
      && action.target?.selectionKind === "industry"
    ));
  }
  const selectedInitialIds = new Set(offer.selectedInitialIds || []);
  if (selectedInitialIds.size < 2) {
    return (actions || []).filter((action) => (
      action.target?.kind === "select_initial_card"
      && action.target?.selectionKind === "initial"
      && !selectedInitialIds.has(action.target?.cardId)
    ));
  }
  return (actions || []).filter((action) => action.target?.kind === "confirm_initial_setup");
}

function completePolicyOutcomeSet(actions, evaluated, rootObservation) {
  const byId = new Map((evaluated || []).map((outcome) => [outcome.actionId, outcome]));
  return (actions || []).map((action) => {
    if (byId.has(action.actionId)) return byId.get(action.actionId);
    return {
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: action.actionId,
      status: "unresolved",
      confidence: "none",
      code: "STRATEGIC_GOAL_NOT_EVALUATED",
      rootObservation,
      leaves: [],
    };
  });
}

// 待放置终局标记的潜在价值：玩家 base 分已跨过 [25,50,70] 阈值但尚未认领的标记，
// 每个标记会放在该玩家可标记的最优板块（公式 baseValue × 下一槽位倍率）。
function pendingFinalMarkValue(state, player) {
  const fs = state.finalScoring;
  if (!fs || !fs.tiles || !Array.isArray(fs.thresholds)) return 0;
  const playerId = player?.id || player?.color || null;
  if (!playerId) return 0;
  const score = Number(player?.resources?.score) || 0;
  const minThreshold = Math.min(...fs.thresholds.map((t) => Number(t) || 0));
  if (score < minThreshold) return 0;
  const marks = Object.values(fs.tiles || {})
    .flatMap((tile) => (Array.isArray(tile?.marks) ? tile.marks : []));
  const claimed = new Set(marks
    .filter((mark) => mark?.playerId === playerId || mark?.playerColor === playerId)
    .map((mark) => Number(mark?.threshold)));
  const pendingThresholds = fs.thresholds.filter((threshold) => (
    score >= Number(threshold) && !claimed.has(Number(threshold))
  ));
  if (!pendingThresholds.length) return 0;
  const formulaContext = {
    aliens: state.aliens,
    planets: state.planets,
    data: state.data,
  };
  const getCardTypeCode = (card) => cardEffects.getRuntimeCardTypeCode(
    card,
    cardEffects.getCardModel(card)?.cardType,
  );
  let total = 0;
  for (const threshold of pendingThresholds) {
    let best = 0;
    for (const [tileId, tile] of Object.entries(fs.tiles || {})) {
      const tileMarks = Array.isArray(tile?.marks) ? tile.marks : [];
      if (tileMarks.some((mark) => (
        mark?.playerId === playerId || mark?.playerColor === playerId
      ))) {
        continue;
      }
      const nextSlot = !tileMarks.some((mark) => Number(mark?.slotIndex) === 1) ? 1
        : !tileMarks.some((mark) => Number(mark?.slotIndex) === 2) ? 2 : 3;
      const formulaId = endGameScoring.getFormulaId(tileId, fs.tileVariants?.[tileId]);
      const baseValue = Number(endGameScoring.getFormulaBaseValue(
        formulaId,
        player,
        formulaContext,
        { getCardTypeCode },
      ) || 0);
      const multiplier = Number(endGameScoring.getSlotMultiplier(formulaId, nextSlot) || 0);
      best = Math.max(best, baseValue * multiplier);
    }
    total += best;
  }
  return total;
}

function buildDecisionFromState(state, legalActions) {
  const turn = getTurnState(state);
  if (turn.gameEnded) return null;
  const actorPlayerId = legalActions[0]?.actorPlayerId || turn.currentPlayerId || null;
  if (!actorPlayerId) return null;
  const decisionType = legalActions[0]?.decisionType || "turn_action";
  const effectOwnerPlayerId = decisionType === "turn_action" ? null : actorPlayerId;
  return {
    actorPlayerId,
    pendingOwnerPlayerId: effectOwnerPlayerId,
    effectOwnerPlayerId,
    currentPlayerId: turn.currentPlayerId,
    source: effectOwnerPlayerId ? "effect_owner" : "current_player",
    decisionType,
    choiceCount: legalActions.length,
  };
}

function buildDecision(api, legalActions) {
  const turnSlice = api.getTurnState();
  if (turnSlice.gameEnded) return null;
  const owner = api.getSimulationDecisionOwnerState?.(
    legalActions[0]?.actorPlayerId ? { id: legalActions[0].actorPlayerId } : null,
  ) || null;
  const actorPlayerId = owner?.actorPlayerId || legalActions[0]?.actorPlayerId || turnSlice.currentPlayerId || null;
  if (!actorPlayerId) return null;
  return {
    actorPlayerId,
    pendingOwnerPlayerId: owner?.pendingOwnerPlayerId || null,
    effectOwnerPlayerId: owner?.effectOwnerPlayerId || null,
    currentPlayerId: owner?.currentPlayerId || turnSlice.currentPlayerId || null,
    source: owner?.source || "current_player",
    decisionType: legalActions[0]?.decisionType || "turn_action",
    choiceCount: legalActions.length,
  };
}

function buildObservation(state, seed, viewerPlayerId, legalActions = [], options = {}) {
  const turn = getTurnState(state);
  const playersState = state.players || { players: [] };
  const perspectivePlayerId = viewerPlayerId || legalActions[0]?.actorPlayerId || turn.currentPlayerId || null;
  const decision = buildDecisionFromState(state, legalActions);
  const setup = state.match?.initialSetup || null;
  const setupCurrentPlayerId = setup?.currentPlayerId || null;
  // cheap：搜索中间节点只需 requirements/资源/rockets/aliens/公共牌/科技（遮蔽所需），
  // 跳过 planets/data/solarSystem/finalScoring 克隆；完整观测只在叶/根/宿主构建。
  const cheap = options.cheap === true;
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
      players: (playersState.players || []).map((player) => {
        const publicPlayer = sanitizePublicPlayer(player, null);
        const breakdown = endGameScoring.computePlayerFinalScore({
          ...state,
          finalScoring: clone(state.finalScoring),
          players: playersState.players || [],
          currentPlayer: player,
          cardEffects,
          getCardTypeCode: (card) => cardEffects.getRuntimeCardTypeCode(
            card,
            cardEffects.getCardModel(card)?.cardType,
          ),
        }, player);
        return {
          ...publicPlayer,
          securedEndGameBonus: breakdown.totalScore - breakdown.baseScore
            + pendingFinalMarkValue(state, player),
        };
      }),
      board: {
        rockets: clone(state.pieces?.rockets || []),
        ...(cheap ? {} : {
          planets: clone(state.planets || {}),
          data: clone(state.data || {}),
          solarSystem: clone(state.solarSystem || {}),
          finalScoring: sanitizeFinalScoringState(state.finalScoring),
        }),
        publicCards: (state.cards?.publicCards || []).map(sanitizeCard),
        discardCount: (state.cards?.discardPile || []).length,
        techSupply: sanitizeTechSupply(state.tech),
        aliens: sanitizeAlienPublicState(state.aliens),
      },
      resident: {
        initialSetup: {
          active: setup?.phase === "selecting",
          interactive: setup?.phase === "selecting"
            && setupCurrentPlayerId === perspectivePlayerId,
          currentPlayerId: setupCurrentPlayerId,
          offer: setup?.phase === "selecting" && setupCurrentPlayerId === perspectivePlayerId
            ? clone(setup.offersByPlayerId?.[setupCurrentPlayerId] || null)
            : null,
          confirmedPlayerIds: clone(setup?.confirmedPlayerIds || []),
        },
      },
      pending: decision,
    },
    selfState: sanitizeSelfPlayer(
      (playersState.players || []).find((player) => player.id === perspectivePlayerId) || null,
    ),
    decision,
    probeRouteRequirements: state.probeRouteRequirements || null,
    dataAnalyzeRequirements: state.dataAnalyzeRequirements || null,
    sectorWinRequirements: state.sectorWinRequirements || null,
    incomeGainRequirements: state.incomeGainRequirements || null,
    techGainRequirements: state.techGainRequirements || null,
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
    const seatId = legal[0]?.actorPlayerId || null;
    let rootStrategicFacts = null;
    return composition.counterfactualPort.evaluate(descriptors, {
      viewer: { playerId: seatId, role: "player" },
      maxDepth: options.maxDepth || 15,
      maxLeaves: options.maxLeaves || 8,
      maxNodes: options.maxNodes || 128,
      ...(options.maxExecutionNodes ? { maxExecutionNodes: options.maxExecutionNodes } : {}),
      stopAtPassDecisionBoundary: options.stopAtPassDecisionBoundary === true,
      maxFrontierPerRoot: options.maxFrontierPerRoot
        || (options.secondaryAgentSearch ? 1 : 8),
      traceGoalClusters: options.traceGoalClusters === true,
      secondaryAgentSearch: options.secondaryAgentSearch ? {
        focalSeatId: seatId,
        maxProxyDepth: options.maxProxyDepth || 15,
        rolloutVersion: expectedScoreEvaluator.SECONDARY_AGENT_ROLLOUT_VERSION,
        completeTargetCatalog: options.completeTargetCatalog === true,
        selectRootTargets: expectedScoreEvaluator.enumerateSecondaryAgentRootTargets,
        selectSuccessors: expectedScoreEvaluator.selectSecondaryAgentSuccessors,
        selectRouteTarget: expectedScoreEvaluator.selectSecondaryAgentRouteTarget,
        countsGoal: expectedScoreEvaluator.countsSecondaryAgentGoal,
        completesRouteTarget: expectedScoreEvaluator.completesSecondaryAgentRouteTarget,
        getCompletionFacts: expectedScoreEvaluator.secondaryAgentCompletionFacts,
      } : null,
      getBranchPriority({
        rootObservation,
        branchObservation,
        currentAction,
        routeTargetIds,
        routePlanIds,
      }) {
        if (options.secondaryAgentSearch) {
          return expectedScoreEvaluator.evaluateSecondaryAgentSearchPriority({
            rootObservation,
            branchObservation,
            focalSeatId: seatId,
            currentAction,
            routeTargetIds,
            routePlanIds,
          });
        }
        rootStrategicFacts = rootStrategicFacts
          || outcomeModel.createStrategicFacts(rootObservation, seatId);
        return expectedScoreEvaluator.evaluateStrategicFactsPriority(
          rootStrategicFacts,
          outcomeModel.createStrategicFacts(branchObservation, seatId),
        );
      },
      confidence: "low",
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
      probeRouteRequirements: projected?.probeRouteRequirements || null,
      dataAnalyzeRequirements: projected?.dataAnalyzeRequirements || null,
      sectorWinRequirements: projected?.sectorWinRequirements || null,
      incomeGainRequirements: projected?.incomeGainRequirements || null,
      techGainRequirements: projected?.techGainRequirements || null,
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
    const beforeVersion = getWorkingProjection(composition).meta.stateVersion;
    const result = composition.lifecycle.save({
      rngState: { algorithm: RNG_ALGORITHM, state: seededRandom.getState() },
    });
    if (!result.ok) throw new Error(result.message || result.code || "composition save 失败");
    if (getWorkingProjection(composition).meta.stateVersion !== beforeVersion) {
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
        traceCounterfactualGoalClusters:
          resetConfig.traceCounterfactualGoalClusters === true,
        completeTargetCatalog: resetConfig.completeTargetCatalog === true,
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
        rngState: { algorithm: RNG_ALGORITHM, state: seededRandom.getState() },
        trustedProjectionReader: true,
        projectCounterfactualState: (state, viewer) => buildObservation(
          state,
          seed,
          viewer?.playerId || null,
          [],
          { cheap: viewer?.cheap === true },
        ),
      });
      composition = kernel.composition;
      // meta.seed 固定为用户档的 "seti-simulation"（science 域/外星人 RNG 由 meta.seed
      // 派生，用户 405 档 = 阿米巴+虫）；盘面 seed 只用于主 RNG（seededRandom），
      // 不再直接写进 meta.seed，保证外星人序列与用户档同源。
      const newGameResult = kernel.newGame({ ...config, seed: "seti-simulation" });
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
      // reward 的 viewer 必须用提交动作 owner 的席位：终局标记序列中
      // beforeObservation.decision.actorPlayerId 可能为 undefined（标记决策的 decision
      // 描述来自 session），且 next decision 属于其他玩家，直接用 action 的 owner。
      const rewardSeatId = action.actorPlayerId || actorPlayerId;
      const reward = rewardBetween(beforeObservation, observation, rewardSeatId, actions, postActions);
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
      const state = getWorkingProjection(composition);
      const turn = getTurnState(state);
      if (!turn.gameEnded) return false;
      // 游戏结束后仍要继续处理终局计分标记（FINAL_MARK 决策）：终局板块是重要分源，
      // 必须等 finalScoringSettled（或没有待标记玩家）才算真正终局，否则标记永远不
      // 被放置、板块计分恒为 0。
      if (state.match?.finalScoringSettled === true) return true;
      const finalScoringSlice = state.finalScoring;
      if (!(finalScoringSlice && typeof finalScoringSlice === "object"
        && finalScoringSlice.tiles && Array.isArray(finalScoringSlice.thresholds))) {
        return true;
      }
      // 只读待标记判定（getPendingMarksForPlayer 内部 ensure 会写冻结 committed 状态）：
      // 分数达到 [25,50,70] 阈值且未在任意板块认领过该阈值的玩家视为有待标记。
      const thresholds = finalScoringSlice.thresholds;
      const marks = Object.values(finalScoringSlice.tiles || {})
        .flatMap((tile) => (Array.isArray(tile?.marks) ? tile.marks : []));
      const players = state.players?.players || [];
      const hasPendingFinalMarks = players.some((player) => {
        const playerId = player?.id || player?.color || null;
        if (!playerId) return false;
        const score = Number(player?.resources?.score) || 0;
        const claimed = new Set(marks
          .filter((mark) => mark?.playerId === playerId || mark?.playerColor === playerId)
          .map((mark) => Number(mark?.threshold)));
        return thresholds.some((threshold) => (
          score >= Number(threshold) && !claimed.has(Number(threshold))
        ));
      });
      return !hasPendingFinalMarks;
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
        && ["start_initial_setup", "select_initial_card", "confirm_initial_setup", "discard-hand-cards"]
          .includes(action.target?.kind)
      ));
      const outcomeOptions = {
        seatId: beforeActions[0].actorPlayerId,
        stateVersion: beforeActions[0].stateVersion,
        decisionVersion: beforeActions[0].decisionVersion,
      };
      const evaluatedActions = initialSetupBoundary
        ? initialSetupOutcomeActions(beforeActions, beforeObservation)
        : policyOutcomeActions(beforeActions, policyObservation);
      const controlActions = initialSetupBoundary
        ? []
        : beforeActions.filter((action) => !expectedScoreEvaluator.requiresCounterfactualOutcome(action));
      // 有界评估桶：play_card 若未进入路由目标评估（不推进探测/科技/收入/扇区需求），
      // 此前完全 unresolved——AI 永远看不到打牌的直接价值（分数/资源/抽牌/触发），
      // 高价值保留牌被系统性忽略（用户高分档：阿米巴牌等稳定分源）。给它们中等深度
      // 反事实评估，让打牌的直接价值进入策略视野。
      const evaluatedIds = new Set(evaluatedActions.map((action) => action.actionId));
      const boundedActions = initialSetupBoundary
        ? []
        : beforeActions.filter((action) => (
          !evaluatedIds.has(action.actionId)
          && expectedScoreEvaluator.requiresCounterfactualOutcome(action)
          && action.family === "play_card"
        ));
      const controlOutcomes = controlActions.length
        ? evaluateActionOutcomes.call(this, controlActions, {
          maxDepth: 1,
          maxLeaves: 1,
          maxNodes: controlActions.length,
          secondaryAgentSearch: false,
          stopAtPassDecisionBoundary: true,
        })
        : [];
      const boundedOutcomes = boundedActions.length
        ? evaluateActionOutcomes.call(this, boundedActions, {
          maxDepth: 6,
          maxLeaves: 3,
          maxNodes: Math.max(boundedActions.length, boundedActions.length * 16),
          secondaryAgentSearch: false,
        })
        : [];
      const strategicOutcomes = evaluatedActions.length
        ? evaluateActionOutcomes.call(this, evaluatedActions, {
          maxDepth: initialSetupBoundary ? 6 : 15,
          maxLeaves: initialSetupBoundary ? 1 : 8,
          maxNodes: initialSetupBoundary ? 12 : 128,
          secondaryAgentSearch: !initialSetupBoundary,
          completeTargetCatalog: !initialSetupBoundary
            && config.completeTargetCatalog === true,
          traceGoalClusters: !initialSetupBoundary
            && config.traceCounterfactualGoalClusters,
          maxProxyDepth: 15,
        })
        : [];
      const evaluatedOutcomes = outcomeModel.projectOutcomeObservations(
        [...strategicOutcomes, ...boundedOutcomes, ...controlOutcomes],
        outcomeOptions,
      );
      const actionOutcomes = completePolicyOutcomeSet(
        beforeActions,
        evaluatedOutcomes,
        evaluatedOutcomes[0]?.rootObservation || policyObservation,
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
        if (rngState?.algorithm !== RNG_ALGORITHM || !Number.isSafeInteger(rngState.state)) {
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
      if (rngState?.algorithm !== RNG_ALGORITHM || !Number.isSafeInteger(rngState.state)) {
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

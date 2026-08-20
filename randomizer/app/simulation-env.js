"use strict";

const { performance } = require("node:perf_hooks");
const { createSeededRandom, hashSeed, RNG_ALGORITHM } = require("../game/random");
const { createSimulationRuleComposition } = require("../training/simulation-rule-composition");
// 规则观察（信息层）构建已提升为 Browser/Simulation 共享实现（rule-observation.js），
// Simulation 侧保持观察输出形状不变，只换实现来源（docs/browser-simulation-unification.md
// §信息层统一）。
const { buildRuleObservation } = require("./rule-observation");
const outcomeModel = require("../game/ai/outcome-model");
const expectedScoreEvaluator = require("../game/ai/expected-score-evaluator");
const machinePlayerCoordinatorModule = require("../game/ai/machine-player-coordinator");
const heuristicDecisionFunctionModule = require("../game/ai/heuristic-decision-function");
const vGuidedDecisionFunctionModule = require("../game/ai/v-guided-decision-function");
const finalScoring = require("../game/final-scoring");

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
  return submitted?.actionId === current?.actionId
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

function buildDecision(api, legalActions) {
  const turnSlice = api.getTurnState();
  if (turnSlice.gameEnded) return null;
  const owner = api.getSimulationDecisionOwnerState?.(
    legalActions[0]?.actorId ? { id: legalActions[0].actorId } : null,
  ) || null;
  const actorPlayerId = owner?.actorId || owner?.actorPlayerId || legalActions[0]?.actorId || turnSlice.currentPlayerId || null;
  if (!actorPlayerId) return null;
  return {
    actorPlayerId,
    pendingOwnerPlayerId: owner?.pendingOwnerPlayerId || null,
    effectOwnerPlayerId: owner?.effectOwnerPlayerId || null,
    currentPlayerId: owner?.currentPlayerId || turnSlice.currentPlayerId || null,
    source: owner?.source || "current_player",
    decisionType: legalActions[0]?.phase === "conditional"
      ? "conditional_choice"
      : "turn_action",
    choiceCount: legalActions.length,
  };
}

// 规则观察构建委托共享实现（rule-observation.js，Browser/Simulation 同源）。
// 保持 buildObservation 名字与签名，调用点（observeWithActions / projectCounterfactualState）
// 不变。
function buildObservation(state, seed, viewerPlayerId, legalActions = [], options = {}) {
  return buildRuleObservation(state, seed, viewerPlayerId, legalActions, options);
}

function createSimulationEnv() {
  let kernel = null;
  let composition = null;
  let seededRandom = null;
  let seed = null;
  let config = null;
  let replaySteps = [];
  // 读档恢复时保留的浏览器格式历史（seti-browser-save-v2 replaySteps 原样），
  // 续玩后再 saveBrowserSave 时拼接到新步骤之前，保证"开局→当前"完整不丢。
  let browserReplayHistory = [];
  let environmentEvents = [];
  let selectors = new Map();
  let cachedLegal = null;
  let lastObservation = null;
  // recordStep 记账产出（协调器提交成功后补记的完整 step 形状，供
  // runHeuristicPolicyDecision 返回；见 recordMachineStep）。
  let machineStepResult = null;
  // V 引导弃牌会话状态（2026-08-18）：quick_trade 弃牌是"单张点选 toggle + confirm"，
  // 决策层维护选中集合，选满 required 再 confirm（防 toggle 死锁）。reset 清空。
  let vGuidedDiscardSession = null;
  let diagnostics = null;
  let machineCoordinator = null;
  let heuristicDecision = null;
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
    const seatId = legal[0]?.actorId || null;
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
      allowUntargetedRootActions: true,
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

  // Heuristic 决策函数（懒创建）：直调启发式 Policy，无旧 Host/policyAdapter 壳。
  // V 引导模式（vStateValueEnabled）：用 v-guided-decision-function（复用启发式
  // 生成 actionOutcomes = 先定倾向，叶排序用 V 增量 = 再执行）。
  function ensureHeuristicDecision() {
    if (!heuristicDecision) {
      const common = {
        composition,
        difficulty: config.aiDifficulty,
        strategyWeights: config.strategyWeights || {},
        seed,
        config: {
          completeTargetCatalog: config.completeTargetCatalog === true,
          traceCounterfactualGoalClusters: config.traceCounterfactualGoalClusters === true,
        },
      };
      heuristicDecision = config.vStateValueEnabled
        ? vGuidedDecisionFunctionModule.createVGuidedDecisionFunction({
          ...common,
          evaluationParameters: { vStateValueEnabled: true },
        })
        : heuristicDecisionFunctionModule.createHeuristicDecisionFunction({
          ...common,
          evaluationParameters: undefined,
        });
    }
    return heuristicDecision;
  }

  // 机器人玩家协调器（懒创建）：读盘面（裸调共享 composition）+ 计划复用 +
  // 决策函数注册表 + 执行编排。失败直接抛错，见 docs/ai-design.md §1。
  function ensureCoordinator() {
    if (!machineCoordinator) {
      machineCoordinator = machinePlayerCoordinatorModule.createMachinePlayerCoordinator({
        composition,
        execute: (action) => executeRawAction.call(envApi, action),
        recordStep: (action, executed) => recordMachineStep.call(envApi, action, executed),
        onDiagnostic: (type, details) => {
          if (type === "plan-reuse-hit") {
            diagnostics.planContinuationHitCount += 1;
          } else if (type === "plan-reuse-miss") {
            diagnostics.planContinuationMissCount += 1;
            diagnostics.planContinuationMissReasons[details.reason] = (
              diagnostics.planContinuationMissReasons[details.reason] || 0
            ) + 1;
          }
        },
      });
    }
    return machineCoordinator;
  }

  // 机器人决策路径的 execute：raw descriptor 直接提交共享 inputPort（零转换），
  // 只做提交；replay/reward/observation 记账由协调器 recordStep 钩子补做
  // （recordMachineStep，训练记账，不做形状转换）。失败直接抛错，不回退、不静默。
  function executeRawAction(rawAction) {
    assertUsable();
    const inspection = composition.inspect();
    if (this.isTerminal()) {
      throw new Error(`SIMULATION_TERMINAL: terminal 环境不接受新的 policy action ${rawAction?.actionId}`);
    }
    const submitResult = inspection.phase === "awaiting_input"
      ? composition.inputPort.submitDecision({
        decisionId: inspection.session.decision.decisionId,
        decisionVersion: inspection.session.decision.decisionVersion,
        ownerId: inspection.session.decision.ownerId,
        choice: rawAction,
      })
      : composition.inputPort.submitAction(rawAction);
    if (submitResult?.ok === false) {
      throw new Error(
        `MACHINE_PLAYER_EXECUTE_FAILED: 执行 ${rawAction?.actionId} 失败: `
        + `${submitResult.message || submitResult.code || "规则执行失败"}`,
      );
    }
    cachedLegal = null;
    selectors = new Map();
    return { ok: true, actionId: rawAction.actionId, submitResult };
  }

  // 协调器 recordStep 记账实现（sim 训练）：提交成功后补记 observation/reward/
  // replay 事件，产出与旧 executeRawAction 一致的完整 step 形状，存回
  // machineStepResult 供 runHeuristicPolicyDecision 返回（self-play 依赖）。
  function recordMachineStep(rawAction, executed) {
    const beforeObservation = lastObservation || observeWithActions(rawAction?.actorId, null);
    const actorPlayerId = rawAction?.actorId
      || beforeObservation.decision?.actorPlayerId
      || null;
    const postActions = this.legalActions();
    const observation = observeWithActions(undefined, postActions);
    lastObservation = observation;
    const rewardSeatId = actorPlayerId;
    const reward = rewardBetween(beforeObservation, observation, rewardSeatId, [], postActions);
    const journal = executed?.submitResult?.journal
      || composition.inspect().session?.journal
      || null;
    const replayEvent = {
      stepIndex: replaySteps.length,
      actorPlayerId,
      action: clone(rawAction),
      reward,
      preDecision: beforeObservation.decision,
      postDecision: observation.decision,
      publicSummary: config.compactReplay ? null : observation.publicState,
      environmentEvents: [],
      effectSessionJournal: config.compactReplay ? compactEffectSessionJournal(journal) : clone(journal),
    };
    replaySteps.push(replayEvent);
    machineStepResult = {
      ok: true,
      actionId: rawAction.actionId,
      actorPlayerId,
      reward,
      done: this.isTerminal(),
      terminated: this.isTerminal(),
      truncated: false,
      observation,
      legalActions: clone(postActions),
      replayEvent,
    };
    return machineStepResult;
  }

  // V 引导决策模块懒加载（v-guided-search / outcome-model / evaluator）
  let vGuidedModules = null;
  function ensureVGuidedModules() {
    if (!vGuidedModules) {
      vGuidedModules = {
        search: require("../game/ai/v-guided-search"),
        outcomeModel: require("../game/ai/outcome-model"),
        evaluator: require("../game/ai/expected-score-evaluator"),
      };
    }
    return vGuidedModules;
  }

  function rawLegalDescriptors() {
    const inspection = composition.inspect();
    if (inspection.phase === "awaiting_input" && inspection.session?.decision) {
      return clone(inspection.session.decision.choices || []);
    }
    return composition.inputPort.enumerateActions({})
      .filter((action) => action.phase !== "conditional");
  }

  function currentActorId(descriptors) {
    return descriptors[0]?.actorId || getTurnState(getWorkingProjection(composition)).currentPlayerId || null;
  }

  function observeWithActions(viewerPlayerId, actions) {
    const startedAt = performance.now();
    const projected = composition.projection({
      playerId: viewerPlayerId || actions?.[0]?.actorId || null,
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

  const envApi = {
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
        vStateValueEnabled: resetConfig.vStateValueEnabled === true,
        planContinuationFastPath: resetConfig.planContinuationFastPath !== false,
        // 新回合复用开关（A/B 用）：planReuseCheck 判定"盘面无新信息则复用上回合
        // 决策链"。关掉后新回合一律重新搜索——用于评估"忽略非依赖变化而复用"的影响。
        planNewTurnReuse: resetConfig.planNewTurnReuse !== false,
      };
      replaySteps = [];
      browserReplayHistory = [];
      environmentEvents = [];
      selectors = new Map();
      cachedLegal = null;
      lastObservation = null;
      machineStepResult = null;
      vGuidedDiscardSession = null;
      machineCoordinator = null;
      heuristicDecision = null;
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
        planContinuationHitCount: 0,
        planContinuationMissCount: 0,
        planContinuationMissReasons: {},
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
      const cachedActorId = cachedLegal?.[0]?.actorId || null;
      if (cachedLegal && (!viewerPlayerId || viewerPlayerId === cachedActorId)) return clone(cachedLegal);
      const descriptors = rawLegalDescriptors();
      const actorPlayerId = currentActorId(descriptors);
      if (viewerPlayerId && viewerPlayerId !== actorPlayerId) return [];
      selectors = new Map();
      cachedLegal = descriptors
        .sort((left, right) => left.actionId.localeCompare(right.actionId))
        .map((descriptor) => {
          selectors.set(descriptor.actionId, descriptor);
          return descriptor;
        });
      recordDuration("legalActionsMilliseconds", startedAt);
      diagnostics.legalActionsCalls += 1;
      return clone(cachedLegal);
    },

    step(action) {
      assertUsable();
      const actions = cachedLegal || this.legalActions();
      const beforeObservation = lastObservation || observeWithActions(action?.actorId || action?.actorPlayerId, actions);
      const actorPlayerId = beforeObservation.decision?.actorPlayerId
        || beforeObservation.decision?.actorId
        || action?.actorId
        || null;
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
      if (action?.schemaVersion !== currentAction?.schemaVersion) {
        return reject("SIMULATION_ACTION_SCHEMA_MISMATCH", "Simulation Action schema 与当前 legal descriptor 不一致");
      }
      if (action.actorId !== currentAction.actorId) {
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
      this.createCheckpoint();
      cachedLegal = null;
      selectors = new Map();
      const decisionFunction = ensureHeuristicDecision();
      const coordinator = ensureCoordinator();
      const probeBoundary = coordinator.readBoundary(null);
      const seatId = probeBoundary.seatId;
      if (!coordinator.hasSeat(seatId)) {
        coordinator.registerSeat(seatId, decisionFunction.run);
      }
      if (asTeacher) {
        // teacher 路径（self-play 录制需要内部数据）：不经协调器复用，直接
        // 读边界 + 决策函数 + env.step 提交，返回原 teacher 形状。
        const beforeActions = this.legalActions();
        const beforeObservation = lastObservation || observeWithActions(undefined, beforeActions);
        if (!beforeActions.length) throw new Error("Heuristic opponent 没有合法候选");
        const policyObservation = standardObservation(beforeObservation, beforeActions[0].actorPlayerId, beforeActions);
        const scheme = decisionFunction.run({
          seatId,
          legalActions: probeBoundary.legalActions,
          observation: policyObservation,
        });
        const trainingAction = beforeActions.find((action) => action.actionId === scheme.actionId);
        if (!trainingAction) throw new Error(`teacher 决策选择非法 actionId ${scheme.actionId}`);
        const executed = this.step(trainingAction);
        if (!executed?.ok) throw new Error(executed?.error || "Heuristic opponent 执行失败");
        const provenance = decisionFunction.getProvenance();
        return {
          beforeObservation,
          beforeActions,
          teacherResult: { decision: scheme.decision, provenance },
          teacherLogs: [],
          teacherAdapter: provenance.version,
          chosenAction: trainingAction,
          observation: executed.observation,
          legalActions: executed.legalActions,
          done: executed.done,
        };
      }
      // 机器人决策路径：协调器编排（读盘面 + 计划复用 + 决策函数 + 提交），
      // 失败直接抛错；复用命中经 execute 直接提交共享 inputPort（零转换）。
      const result = coordinator.runDecision(seatId, {
        reuseEnabled: config.planContinuationFastPath === true,
        newTurnReuseEnabled: config.planNewTurnReuse !== false,
      });
      if (!machineStepResult) {
        throw new Error("MACHINE_PLAYER_RECORD_STEP_MISSING: 协调器执行后未产出 step 记账结果");
      }
      const provenance = decisionFunction.getProvenance();
      if (result.source === "plan-reuse") {
        return {
          ...machineStepResult,
          policyDecision: {
            actionId: result.actionId,
            policyType: provenance.type,
            policyVersion: provenance.version,
            planContinuationFastPath: true,
            diagnostics: { reasonCode: "plan-continuation-fast-path" },
          },
          policyProvenance: provenance,
          actionOutcomes: [],
          plan: result.plan,
          planContinuationFastPath: { hit: true },
        };
      }
      return {
        ...machineStepResult,
        policyDecision: result.decision.decision,
        policyProvenance: provenance,
        actionOutcomes: result.decision.actionOutcomes,
        plan: result.plan,
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
          policyProvenance: heuristicDecision?.getProvenance?.() || null,
        },
        config: clone(config || {}),
        effectSessions: replaySteps.map((step) => step.effectSessionJournal).filter(Boolean),
        steps: clone(replaySteps),
        environmentEvents: clone(environmentEvents),
        finalStateSummary: this.observe(),
      };
    },

    // 与浏览器同格式存盘（seti-browser-save-v2）：复用同一内核 lifecycle.save()
    // 的 envelope（committedState + session），per-step after 摘要从每步 publicSummary
    // 构造（同构浏览器 browserStateSummary）。产出可直接被 tools/load_save_simulation.js
    // 读取继续打，或离线查中间过程。
    saveBrowserSave(options = {}) {
      assertUsable();
      const envelope = saveEnvelope();
      const committedState = envelope.committedState;
      let readableState = null;
      try {
        readableState = typeof committedState === "string"
          ? JSON.parse(committedState)
          : committedState;
      } catch (_error) {
        readableState = null;
      }
      const meta = readableState?.meta || {};
      // 读档恢复时保留的浏览器格式历史（browserReplayHistory）原样拼接在前，
      // 续玩产生的新步骤从历史长度续号——保证存档 replaySteps = "开局→当前"完整。
      const historyBase = browserReplayHistory.length;
      const newReplaySteps = replaySteps.map((step, index) => {
        const action = step.action || {};
        const ps = step.publicSummary;
        const after = ps
          ? {
            r: ps.roundNumber ?? null,
            t: ps.turnNumber ?? null,
            c: ps.currentPlayerId ?? null,
            p: Object.fromEntries((ps.players || []).map((player) => [
              player.playerId || player.id,
              [
                Number(player.score) || 0,
                Number(player.credits) || 0,
                Number(player.energy) || 0,
                Number(player.publicity) || 0,
                Number(player.handCount) || 0,
                Number(player.reservedCount) || 0,
              ],
            ])),
          }
          : null;
        return {
          stepIndex: historyBase + index,
          actorPlayerId: step.actorPlayerId ?? action.actorId ?? action.actorPlayerId ?? null,
          action: clone(action),
          phase: action.phase ?? null,
          decisionId: null,
          decisionVersion: null,
          after,
        };
      });
      const browserReplaySteps = [...clone(browserReplayHistory), ...newReplaySteps];
      return {
        schema: "seti-browser-save-v2",
        savedAt: new Date().toISOString(),
        seed, // 主 RNG seed（与浏览器档 seed=固定盘面 seed 语义一致，供从零重放）
        gameId: meta.gameId ?? null,
        rulesetVersion: meta.rulesetVersion ?? null,
        stateVersion: meta.stateVersion ?? null,
        committedState,
        session: envelope.session ?? null,
        readableState,
        replaySteps: browserReplaySteps,
        name: options.name ?? String(meta.seed ?? seed ?? "simulation"),
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
        replaySteps: clone(replaySteps),
        browserReplaySteps: clone(browserReplayHistory),
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
        browserReplayHistory = clone(checkpoint.browserReplaySteps || []);

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
      browserReplayHistory = clone(checkpoint.browserReplaySteps || []);
      environmentEvents = clone(checkpoint.environmentEvents || []);
      cachedLegal = null;
      selectors = new Map();

      const actions = this.legalActions();
      lastObservation = observeWithActions(undefined, actions);
      return clone(lastObservation);
    },

    // 暴露反事实 fork 原语（可回退执行基础组件）：从当前或指定 envelope 创建
    // 独立 composition 分支，分支上执行动作不影响 root。供自定义搜索策略
    // （如 V 引导浅搜索）复用，不依赖 counterfactualPort.evaluate 的内置目标体系。
    createCounterfactualFork(envelope = null, forkOptions = {}) {
      assertUsable();
      const forkEnvelope = envelope || saveEnvelope();
      const createFork = composition?.counterfactualPort?.createFork;
      if (typeof createFork !== "function") {
        throw new Error("当前 composition 未启用 counterfactual fork 能力");
      }
      return createFork(forkEnvelope, forkOptions);
    },

    // V 引导决策（v-guided-policy / v-guided-search）：全动作 fork 浅搜索 + V 评估。
    // 与 runHeuristicPolicyDecision 完全解耦，不复用分桶/目标门控/线性外推。
    // 返回 { action, seatId, diagnostics, evaluations }。
    runVGuidedDecision(options = {}) {
      assertUsable();
      const modules = ensureVGuidedModules();
      const ev = modules.evaluator;
      const outcomeModel = modules.outcomeModel;
      const vGuidedSearch = modules.search;
      const legal = this.legalActions();
      if (!legal.length) throw new Error("V 引导决策没有合法候选");
      const seatId = legal[0]?.actorId || null;
      // 初始选择/条件决策（choose_*）：不 fork 搜索（效果延迟/结算步骤，浅搜索
      // 看不到价值），返回**第一个合法 action**（与 v-guided-policy 一致）。
      // 2026-08-18 修复契约：不再返回 action:null + conditional 标记让调用方猜
      // （调用方漏检查会拿 undefined action 传给 step → 静默卡死）。
      // 弃牌会话（quick_trade 等）：discard-hand-card 是"单张点选 toggle"+
      // confirm，盲目取第一个会反复弃同一张卡 → toggle 死锁。这里维护会话状态，
      // 选满 required 张不同卡再 confirm（决策层会话感知，所有调用方受益）。
      const allConditional = legal.every((a) => (
        ["choose_card", "choose_payment", "choose_target", "accept_optional_effect"].includes(a.family)
      ));
      if (allConditional) {
        // 初始选牌（start_initial_setup / select_initial_card / confirm_initial_setup）：
        // 有固定流程（公司→初始牌→confirm），"取第一个合法"会卡在选牌死循环
        // （实测 choose_card 600 步 whiteScore=0）。委托启发式初始选择逻辑
        // （selectInitialSetupAction 处理完整流程）。
        const isInitialSetup = legal.some((a) => (
          ["start_initial_setup", "select_initial_card", "confirm_initial_setup"].includes(a.target?.kind)
        ));
        if (isInitialSetup) {
          // 只获取启发式初始选择（不执行，调用方 step）——runHeuristicPolicyDecision
          // 会实际提交一步（双重执行），不能用。
          const heuristicDecision = ensureHeuristicDecision();
          const coordinator = ensureCoordinator();
          const boundary = coordinator.readBoundary(null);
          const scheme = heuristicDecision.run({
            seatId,
            legalActions: boundary.legalActions,
            observation: this.observe(seatId),
          });
          if (!scheme?.actionId || !legal.some((a) => a.actionId === scheme.actionId)) {
            throw new Error(`V 引导初始选牌启发式选择非法 actionId: ${scheme?.actionId}`);
          }
          return {
            action: legal.find((a) => a.actionId === scheme.actionId),
            seatId,
            conditional: true,
            diagnostics: { reasonCode: "initial-setup-delegated", evaluated: 0, searchMs: 0 },
            evaluations: [],
          };
        }
        const discardCards = legal.filter((a) => (
          a.family === "choose_payment" && a.target?.kind === "discard-hand-card"
        ));
        const confirm = legal.find((a) => (
          a.family === "choose_payment" && a.target?.kind === "confirm"
        ));
        const isDiscardSession = discardCards.length > 0 && Boolean(confirm);
        if (isDiscardSession) {
          if (!vGuidedDiscardSession) vGuidedDiscardSession = { selected: new Set() };
          const required = 2; // 会话所需张数（quick_trade 弃 2 张；不足时 confirm 禁用）
          if (vGuidedDiscardSession.selected.size >= required) {
            vGuidedDiscardSession = null;
            return {
              action: confirm,
              seatId,
              conditional: true,
              diagnostics: { reasonCode: "discard-session-confirm", evaluated: 0, searchMs: 0 },
              evaluations: [],
            };
          }
          const next = discardCards.find((c) => (
            !vGuidedDiscardSession.selected.has(c.target?.cardInstanceId)
          )) || discardCards[0];
          vGuidedDiscardSession.selected.add(next.target?.cardInstanceId);
          return {
            action: next,
            seatId,
            conditional: true,
            diagnostics: { reasonCode: "discard-session-pick", evaluated: 0, searchMs: 0 },
            evaluations: [],
          };
        }
        vGuidedDiscardSession = null;
        const first = legal[0];
        if (!first) throw new Error("V 引导条件决策没有合法候选");
        return {
          action: first,
          seatId,
          conditional: true,
          diagnostics: { reasonCode: "conditional-first-legal", evaluated: 0, searchMs: 0 },
          evaluations: [],
        };
      }
      vGuidedDiscardSession = null;
      const params = ev.evaluateStateValue && { vStateValueEnabled: true };
      const authority = {
        stateVersion: legal[0]?.stateVersion,
        decisionVersion: legal[0]?.decisionVersion,
      };
      // root 标准 observation（从当前状态构造）
      const rootObservation = this.observe();
      const rootStd = outcomeModel.createDecisionObservation(rootObservation, {
        seatId,
        stateVersion: authority.stateVersion,
        decisionVersion: authority.decisionVersion,
      });
      const rootV = ev.evaluateStateValue(rootStd, seatId).total;
      // 主行动集合：先做**可行性预筛**（不 fork），再按**目标倾向**收敛值得评估的
      // 动作（2026-08-18 用户指导"先有倾向的确定搜索目标，去掉不执行的，不是先
      // 执行再失败"）：
      //   1) 可行性：move / quick_trade energy-for-move 需要探测器在盘面（solar-board），
      //      无探测器必然失败（"没有可移动的探测器"）→ 直接过滤，不 fork；
      //   2) 目标倾向：复用 selectSecondaryAgentRootActions（目标绑定 + 目的型需求
      //      放行）——继承启发式目标系统，只评估"值得试"的动作，不 fork 全部。
      const rockets = rootObservation?.publicState?.board?.rockets;
      const hasSolarRocket = Array.isArray(rockets) && rockets.some((rocket) => (
        String(rocket?.playerId || rocket?.ownerPlayerId || "") === String(seatId)
        && rocket?.surface === "solar-board"
      ));
      const isFeasible = (action) => {
        const isMoveLike = action.family === "move"
          || (action.family === "quick_trade" && String(action.target?.tradeId || "").includes("move"));
        if (!isMoveLike) return true;
        if (action.family === "quick_trade" && String(action.target?.tradeId || "").includes("move")) {
          return hasSolarRocket;
        }
        return hasSolarRocket;
      };
      const feasibleActions = legal.filter((action) => (
        !["end_turn", "pass"].includes(action.family) && isFeasible(action)
      ));
      // 目标倾向预筛：目标绑定 + 目的型需求放行（继承启发式目标系统）
      const preferredActionIds = new Set(
        ev.selectSecondaryAgentRootActions({
          focalSeatId: seatId,
          rootObservation,
          legalActions: feasibleActions,
          maxProxyDepth: 15,
        }).map((action) => action.actionId),
      );
      const mainActions = feasibleActions.filter((action) => (
        preferredActionIds.has(action.actionId)
      ));
      // 全部被倾向预筛掉时退回可行集合（至少给 end_turn/pass 之外的选项）
      const evaluatedPool = mainActions.length ? mainActions : feasibleActions;
      const rootEnvelope = saveEnvelope();
      const maxDepth = Math.max(1, Number(options.maxDepth) || 4);
      const startedAt = performance.now();
      const evaluations = [];
      for (const action of evaluatedPool) {
        const result = vGuidedSearch.evaluateActionWithFork(
          this,
          action,
          rootEnvelope,
          seatId,
          authority,
          params,
          { maxDepth, rootObservation },
        );
        if (result?.ok) evaluations.push(result);
      }
      // 选 total 最高（ok:false 的不可行动作已过滤）
      evaluations.sort((a, b) => b.total - a.total || String(a.actionId).localeCompare(String(b.actionId)));
      const best = evaluations[0] || null;
      // fallback 优先 end_turn（总是可行），再退可行集合里第一个；
      // 2026-08-18：不再用 legal[0] 兜底（可能是 fork 验证过不可行的动作）。
      const chosenAction = best
        ? evaluatedPool.find((a) => a.actionId === best.actionId)
        : (legal.find((a) => a.family === "end_turn")
          || evaluatedPool[0]
          || legal.find((a) => !["pass"].includes(a.family))
          || legal[0]);
      const searchMs = performance.now() - startedAt;
      return {
        action: chosenAction,
        seatId,
        diagnostics: {
          reasonCode: best ? "v-guided:max-total" : "v-guided:no-eval",
          evaluated: evaluations.length,
          searchMs,
          rootV,
          top: evaluations.slice(0, 5).map((e) => ({
            family: e.family, total: e.total, vDelta: e.vDelta, actual: e.actual,
          })),
        },
        evaluations,
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      kernel = null;
      composition = null;
      seededRandom = null;
      machineCoordinator = null;
      heuristicDecision = null;
      selectors = new Map();
      cachedLegal = null;
      lastObservation = null;
    },
  };
  return envApi;
}

module.exports = { buildDecision, createSimulationEnv };

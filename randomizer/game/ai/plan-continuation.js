(function (root, factory) {
  "use strict";

  let expectedScoreEvaluator = root.SetiExpectedScoreEvaluator;
  if (!expectedScoreEvaluator && typeof require === "function") {
    expectedScoreEvaluator = require("./expected-score-evaluator");
  }
  const api = factory(expectedScoreEvaluator);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiPlanContinuation = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (expectedScoreEvaluator) {
  "use strict";

/**
 * 计划延续复用与诊断（plan-continuation）。
 *
 * 决策方案输出计划结构、simulation 侧复用判定与诊断统计的纯函数集合，不修改
 * 规则状态；复用决策依赖逐步证据。架构见 docs/ai-design.md §3：
 *
 * - 方案输出：`buildPlanFromSnapshot`（winning leaf -> { schemaVersion,
 *   nextActionId, steps[] }）、`advancePlan`（动作/依赖/揭示基线同步推进）；
 * - 复用判定：`planReuseCheck`——下一步仍合法 + 外星揭示基线未增 + 依赖环节
 *   未变（路线终点移动步数/第一奖励格、外星痕迹槽占用）则复用，否则重新决策；
 *   翻开外星人（揭示槽位数增加）无条件重新决策；
 * - 依赖来源：搜索每次正式提交前采集同viewer事实，按origin目标与完成阶段编译，
 *   不使用整叶根目标或最终观察代替当前步骤证据；
 * - 诊断：`pairContinuation` / `aggregateStats` 量化「计划下一步 == 新搜索实际
 *   选择」的命中率与预测器质量（工具 tools/diagnose_plan_continuation.js）。
 *
 * 本模块全部为纯函数；machine-player-coordinator（planReuseCheck 装配）与
 * heuristic-decision-function（方案输出 plan）共用。
 * actionSemanticKey 与 expected-score-evaluator 内部同名单函数保持同一语义
 * （family+target+payload 稳定序列化），此处复制以避免在共享工作树中修改
 * 该 policy 模块；行为由单元测试钉住。
 */


// 与 expected-score-evaluator.actionSemanticKey 语义一致：同一逻辑 action
// （仅 actionId/枚举序号不同）必须产生同一键。
function actionSemanticKey(action) {
  return stableSerialize({
    family: action?.family || null,
    target: action?.target || {},
    payload: action?.payload || {},
  });
}

const RESOURCE_FIELD_PATTERN = /^(credits|energy|publicity|handSize|availableData|ordinaryCards|alienCards|additionalPublicScan)$/;
const GAP_KEY_PATTERN = /^(cost|nextCost|standardScanCost|reduction|before|after)$/;
// gap 系列键保留对象本身（内部仍剥离资源字段），避免丢失 movementSteps 等拓扑字段。
const GAP_OBJECT_KEYS = new Set(["gap", "resourceGap", "nextGap"]);

function stableSerialize(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  )).join(",")}}`;
}

function stableHash(value) {
  const input = stableSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// 深度剥离资源缺口字段（不修改输入，返回新值）。
// 数组元素按 stableHash 排序后再输出：目录候选（probe/data/sector/income/tech
// requirement candidates）的枚举顺序可能因投影深度（cheap vs full）或资源缺口
// 排序而不稳定，顺序无关才能让「同一状态」的指纹一致。
function stripResourceFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripResourceFields).sort((left, right) => {
      const a = stableHash(left);
      const b = stableHash(right);
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }
  if (value == null || typeof value !== "object") return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (GAP_OBJECT_KEYS.has(key)) {
      out[key] = stripResourceFields(child);
      continue;
    }
    if (GAP_KEY_PATTERN.test(key) || RESOURCE_FIELD_PATTERN.test(key)) continue;
    out[key] = stripResourceFields(child);
  }
  return out;
}

// 目标目录的结构快照：只含「搜索读到的外部结构事实」，剥离资源缺口。
// boardFacts 不含 finalScoring（终局标记决策不走反事实搜索，属于廉价决策）。
function directoryFactsSnapshot(observation) {
  const publicState = observation?.publicState || {};
  const board = publicState.board || {};
  const progress = observation?.outcomeProjection?.progress || {};
  const boardFacts = {
    rotation: board.solarSystem?.rotation || null,
    planets: board.planets || null,
    aliens: board.aliens || null,
    data: board.data || null,
    techSupply: board.techSupply || null,
    publicCards: Array.isArray(board.publicCards)
      ? board.publicCards.map((card) => card?.cardId ?? card?.id ?? null)
      : null,
    rocketSignatures: Array.isArray(board.rockets)
      ? board.rockets.map((rocket) => ({
        id: rocket.id,
        playerId: rocket.playerId,
        surface: rocket.surface,
        x: rocket.sectorX ?? rocket.x ?? null,
        y: rocket.sectorY ?? rocket.y ?? null,
      })).sort((left, right) => String(left.id).localeCompare(String(right.id)))
      : null,
  };
  const directory = {
    probe: stripResourceFields(
      observation?.probeRouteRequirements || progress?.probeGoalRequirements || null,
    ),
    dataAnalyze: stripResourceFields(
      observation?.dataAnalyzeRequirements || progress?.dataAnalyzeRequirements || null,
    ),
    sector: stripResourceFields(
      observation?.sectorWinRequirements || progress?.sectorWinRequirements || null,
    ),
    income: stripResourceFields(
      observation?.incomeGainRequirements || progress?.incomeGainRequirements || null,
    ),
    tech: stripResourceFields(
      observation?.techGainRequirements || progress?.techGainRequirements || null,
    ),
    ownedTechIds: [...(progress?.ownedTechIds || [])].sort(),
    traceCount: progress?.traceCount ?? null,
  };
  return { boardFacts, directory };
}

// 目标结构快照辅助：预留导出（fast-path 设计期可能用「计划目标仍存在性」检查
// 替代整目录比较；当前诊断不消费）。

// 目录指纹。options.componentSet = "cheap" 时只比较 cheap 投影也携带的分量
// （aliens/publicCards/techSupply + 目录）。
function directoryFingerprintFromFacts(facts, options = {}) {
  const boardFacts = { ...(facts?.boardFacts || {}) };
  if (options.includeRockets !== true) delete boardFacts.rocketSignatures;
  if (options.componentSet === "cheap") {
    delete boardFacts.rotation;
    delete boardFacts.planets;
    delete boardFacts.data;
    delete boardFacts.rocketSignatures;
  }
  return stableHash({ board: boardFacts, directory: facts?.directory || {} });
}

function directoryFingerprint(observation, options = {}) {
  return directoryFingerprintFromFacts(directoryFactsSnapshot(observation), options);
}

// 从 winning leaf 提取「计划下一步」。chain[0] 是根 action（本次决策选择的 action），
// chain[1] 是搜索计划的下一次行动；descriptor 按 actionId 从
// rootActionLegalSuccessors（根行动刚执行完的后继，含 conditional 决策）与
// rootActionSettledLegalSuccessors（根行动稳定结算后的后继）解析，用于语义级
// 比较（actionId 本身可能随枚举序号漂移）。
function planContinuationFromWinningLeaf(leaf) {
  const chain = Array.isArray(leaf?.actionChain) ? leaf.actionChain : [];
  if (chain.length < 2) {
    return Object.freeze({
      hasContinuation: false,
      nextActionId: null,
      nextStepFamily: null,
      nextStepKey: null,
      planAssumedObservation: null,
    });
  }
  const nextActionId = String(chain[1]);
  const descriptor = [
    ...(leaf?.rootActionLegalSuccessors || []),
    ...(leaf?.rootActionSettledLegalSuccessors || []),
  ].find((candidate) => String(candidate?.actionId) === nextActionId) || null;
  return Object.freeze({
    hasContinuation: true,
    nextActionId,
    nextStepFamily: descriptor?.family || String(nextActionId).split(":")[0],
    nextStepKey: descriptor ? actionSemanticKey(descriptor) : `id:${nextActionId}`,
    nextStepDescriptor: descriptor || null,
    // 完整计划：根行动之后的全部后续步骤（actionIds），供多步复用逐步消费。
    continuation: chain.slice(1),
    // 计划假设状态：根行动执行后的观测。rootActionSettledObservation 优先
    // （完整稳定边界），缺失时退回 rootActionObservation（根行动刚执行完）。
    planAssumedObservation: leaf?.rootActionSettledObservation
      || leaf?.rootActionObservation
      || null,
  });
}

// 相邻同席决策配对：previous 是上一次决策（带 plan），current 是本次决策。
// 返回纯计算对象，不读写任何共享状态。
function pairContinuation(previous, current) {
  const plan = previous?.plan;
  if (!plan?.hasContinuation) {
    return Object.freeze({ applicable: false });
  }
  const curKeys = new Set(current?.legalActionKeys || []);
  const curIds = new Set(current?.legalActionIds || []);
  const stepLegal = curKeys.has(plan.nextStepKey)
    || (String(plan.nextStepKey).startsWith("id:") && curIds.has(plan.nextActionId));
  const directorySame = previous?.directoryFingerprint === current?.directoryFingerprint;
  const directorySameWithRockets = previous?.directoryFingerprintWithRockets
    === current?.directoryFingerprintWithRockets;
  const actualHit = stepLegal && plan.nextStepKey === current?.actionKey;
  const reasons = [];
  if (!stepLegal) reasons.push("step-not-legal");
  if (!directorySame) reasons.push("directory-changed");
  if (stepLegal && directorySame && !actualHit) {
    reasons.push("plan-degraded-or-alternative-improved");
  }
  return Object.freeze({
    applicable: true,
    actualHit,
    stepLegal,
    directorySame,
    directorySameWithRockets,
    reasons,
    changed: changedFactComponents(previous?.facts, current?.facts),
    nextStepFamily: plan.nextStepFamily,
    currentFamily: current?.family || null,
  });
}

function changedFactComponents(previousFacts, currentFacts) {
  const changed = [];
  const prevBoard = previousFacts?.boardFacts || {};
  const curBoard = currentFacts?.boardFacts || {};
  for (const key of new Set([...Object.keys(prevBoard), ...Object.keys(curBoard)])) {
    if (stableHash(prevBoard[key]) !== stableHash(curBoard[key])) changed.push(`board.${key}`);
  }
  const prevDirectory = previousFacts?.directory || {};
  const curDirectory = currentFacts?.directory || {};
  for (const key of new Set([...Object.keys(prevDirectory), ...Object.keys(curDirectory)])) {
    if (stableHash(prevDirectory[key]) !== stableHash(curDirectory[key])) {
      changed.push(`directory.${key}`);
    }
  }
  return changed.sort();
}

// 聚合配对统计：命中率、预测器 precision/recall、失效原因与事实变化分布。
function aggregateStats(pairs) {
  const applicable = pairs.filter((pair) => pair?.applicable === true);
  const hits = applicable.filter((pair) => pair.actualHit === true);
  const predictors = {
    stepLegal: (pair) => pair.stepLegal === true,
    directorySame: (pair) => pair.directorySame === true,
    directorySameWithRockets: (pair) => pair.directorySameWithRockets === true,
    "stepLegal+directory": (pair) => pair.stepLegal === true && pair.directorySame === true,
  };
  const reasonCounts = {};
  const changedCounts = {};
  for (const pair of applicable) {
    if (!pair.actualHit) {
      for (const reason of pair.reasons || []) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }
    for (const component of pair.changed || []) {
      changedCounts[component] = (changedCounts[component] || 0) + 1;
    }
  }
  const predictorStats = {};
  for (const [name, test] of Object.entries(predictors)) {
    const predicted = applicable.filter(test);
    const predictedHits = predicted.filter((pair) => pair.actualHit === true).length;
    predictorStats[name] = {
      predicted: predicted.length,
      wrong: predicted.length - predictedHits,
      precision: predicted.length ? predictedHits / predicted.length : null,
      recall: hits.length ? predictedHits / hits.length : null,
    };
  }
  return Object.freeze({
    applicableCount: applicable.length,
    hitCount: hits.length,
    hitRate: applicable.length ? hits.length / applicable.length : null,
    reasonCounts,
    changedCounts,
    predictorStats,
  });
}

// ---------------------------------------------------------------------------
// 计划快照提取（诊断 record 与 fast-path 共用）
// ---------------------------------------------------------------------------

// 与 heuristic-evaluator.selectLegalAction 相同的降序 sortKey 比较。
function compareSortKey(left, right) {
  const a = Array.isArray(left) ? left.map((value) => Number(value) || 0) : [Number(left) || 0];
  const b = Array.isArray(right) ? right.map((value) => Number(value) || 0) : [Number(right) || 0];
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (b[index] ?? 0) - (a[index] ?? 0);
    if (delta) return delta;
  }
  return 0;
}

// 与 policy 相同的池排序：settled + selectable + score != null，按 sortKey 降序、
// priorityClass 降序、actionId 升序。返回 { pool, failures }——未入池的每个
// action 都带显式原因，不静默吞错。
function rankActions(context, legalActions) {
  const pool = [];
  const failures = [];
  for (const action of legalActions || []) {
    const outcome = (context.actionOutcomes || []).find((candidate) => (
      candidate?.actionId === action?.actionId
    ));
    if (!outcome) {
      failures.push({ actionId: action?.actionId, reason: "outcome-missing" });
      continue;
    }
    if (outcome.status !== "settled") {
      failures.push({ actionId: action?.actionId, reason: `outcome-${outcome.status || "missing"}` });
      continue;
    }
    try {
      const evaluation = expectedScoreEvaluator.evaluateOutcome(context, action, {});
      if (evaluation?.selectable === true
        && evaluation.status === "settled"
        && evaluation.score != null) {
        pool.push({ action, evaluation });
      } else {
        failures.push({
          actionId: action?.actionId,
          reason: `evaluation-${evaluation?.status || "none"}`,
          score: evaluation?.score == null ? "no-score" : "not-selectable",
        });
      }
    } catch (error) {
      failures.push({
        actionId: action?.actionId,
        reason: "evaluation-threw",
        message: error?.message || String(error),
      });
    }
  }
  pool.sort((left, right) => (
    compareSortKey(left.evaluation.sortKey, right.evaluation.sortKey)
    || Number(right.evaluation.priorityClass) - Number(left.evaluation.priorityClass)
    || String(left.action.actionId).localeCompare(String(right.action.actionId))
  ));
  return { pool, failures };
}

// 从一次全量搜索的决策结果提取计划快照：winning leaf 的计划下一步、赢面 margin、
// 目录指纹与事实。rootObservation 取搜索同源的 viewer-safe 根观测
// （policyObservation / outcome.rootObservation）。
// options.light = true 时跳过 rankActions（margin/pool 不计算）：fast-path 的
// store 只消费 plan.executionSteps，不需要全 action 排序或旧单依赖诊断。
// 每个缺失都带显式 status/reason，不静默吞错：
//   planStatus: continuation | chain-too-short | no-winning-leaf | leaf-missing |
//               evaluation-failed | chosen-outcome-missing | no-root-observation
//   marginStatus: computed | skipped | no-runner-up | empty-pool | no-evaluation |
//                 evaluation-failed
function extractPlanSnapshot(input, options = {}) {
  const {
    seatId,
    chosenAction,
    legalActions,
    actionOutcomes,
    rootObservation,
  } = input;
  const light = options.light === true;
  const issues = [];
  const chosenOutcome = (actionOutcomes || []).find((outcome) => (
    outcome?.actionId === chosenAction?.actionId
  )) || null;
  if (!chosenOutcome) {
    issues.push({ code: "chosen-outcome-missing", actionId: chosenAction?.actionId || null });
  }
  if (!rootObservation) {
    issues.push({ code: "root-observation-missing", seatId });
  }
  const context = rootObservation ? {
    seatId,
    observation: rootObservation,
    actionOutcomes: actionOutcomes || [],
  } : null;

  let evaluation = null;
  let evaluationFailure = null;
  let topScore = null;
  if (context && chosenOutcome) {
    try {
      evaluation = expectedScoreEvaluator.evaluateOutcome(context, chosenAction, {});
      if (evaluation?.score != null) topScore = Number(evaluation.score);
    } catch (error) {
      evaluationFailure = { message: error?.message || String(error) };
      issues.push({ code: "evaluation-threw", actionId: chosenAction?.actionId, ...evaluationFailure });
    }
  }

  const ranked = light
    ? { pool: [], failures: [] }
    : context
      ? rankActions(context, legalActions || [])
      : { pool: [], failures: [] };
  for (const failure of ranked.failures) issues.push({ code: "rank-failure", ...failure });

  let secondScore = null;
  let margin = null;
  let marginStatus = light ? "skipped" : "no-evaluation";
  if (!light && context && chosenOutcome) {
    if (evaluationFailure) {
      marginStatus = "evaluation-failed";
    } else if (ranked.pool.length === 0) {
      marginStatus = "empty-pool";
    } else {
      topScore = topScore ?? (Number(ranked.pool[0].evaluation.score) || null);
      secondScore = ranked.pool.length > 1
        ? (Number(ranked.pool[1].evaluation.score) || null)
        : null;
      if (Number.isFinite(topScore) && Number.isFinite(secondScore)) {
        margin = topScore - secondScore;
        marginStatus = "computed";
      } else if (ranked.pool.length < 2) {
        marginStatus = "no-runner-up";
      } else {
        marginStatus = "no-finite-scores";
      }
    }
  }

  let plan = null;
  let planStatus = "no-root-observation";
  let planDependency = null;
  if (chosenOutcome && evaluation?.selectedLeafId) {
    const leaf = (chosenOutcome.leaves || []).find((candidate) => (
      String(candidate?.leafId) === String(evaluation.selectedLeafId)
    )) || null;
    if (leaf) {
      plan = { ...planContinuationFromWinningLeaf(leaf),
        executionSteps: compilePlanSteps(leaf.planSteps || []) };
      if (!plan.executionSteps.length) issues.push({ code: "plan-step-evidence-missing" });
      planStatus = plan.hasContinuation ? "continuation" : "chain-too-short";
      if (!light) planDependency = planDependencyFromPlan(plan, leaf);
    } else {
      planStatus = "leaf-missing";
      issues.push({ code: "leaf-missing", selectedLeafId: evaluation.selectedLeafId });
    }
  } else if (!chosenOutcome) {
    planStatus = "chosen-outcome-missing";
  } else if (evaluationFailure) {
    planStatus = "evaluation-failed";
  } else if (evaluation?.score == null) {
    planStatus = "no-winning-leaf";
  } else {
    planStatus = "no-selected-leaf";
  }

  // light（生产路径只消费 plan.executionSteps）跳过纯诊断
  // 指纹（facts/directoryFingerprint*）——这些只被 tools/diagnose_plan_continuation.js
  // 消费；诊断工具调用时 light 缺省 false，功能不受影响。
  const diagnosticFacts = !light && rootObservation;
  return {
    plan,
    planStatus,
    planDependency,
    planAssumedRevealedCount: plan?.planAssumedObservation
      ? countRevealedAliens(plan.planAssumedObservation)
      : null,
    margin,
    marginStatus,
    topScore,
    secondScore,
    poolSize: ranked.pool.length,
    issues,
    rootObservation,
    facts: diagnosticFacts ? directoryFactsSnapshot(rootObservation) : null,
    directoryFingerprint: diagnosticFacts
      ? directoryFingerprint(rootObservation)
      : null,
    directoryFingerprintWithRockets: diagnosticFacts
      ? directoryFingerprint(rootObservation, { includeRockets: true })
      : null,
  };
}

// ---------------------------------------------------------------------------
// 历史单依赖诊断（非 light 快照保留；生产 planReuseCheck 不消费这些字段）。
// 新信息只有两类：① 揭示外星人（planReuseCheck 单独判）；② 计划依赖环节变化——
// 计划依赖的具体盘面事实变了：目标奖励格被占 / 路线变长 / 计划要拿的科技被拿走 /
// 目标扇区赢不了 / 目标外星槽被占 / 目标公共牌被买走。其余变化（对手移动/资源、
// 无关扇区、无探测器移动的旋转、计划内自己的推进）不算新信息。
//
// 探测路线终点 id 来源（2026-08-18 修补）：primaryAgentSearch 叶带 probeRoute.candidate
// （由 routeCheckpoints 摘要生成）；secondary-agent 搜索叶不携带 routeCheckpoints
// （rule-composition addLeaf 对 secondaryAgentSearch 置空）→ candidate 恒为 null，
// 此前路线依赖永远落 generic。叶上仍保留 rootRouteTargetId（搜索绑定的路线终点，
// 形如 orbit:.../land:...，与 production-kernel buildProbeCandidateStructures 的
// targetId 同构），从这里补出依赖。
function probeRouteEndpointTargetId(leaf) {
  const targetId = String(leaf?.rootRouteTargetId || "");
  return targetId.startsWith("orbit:") || targetId.startsWith("land:")
    ? targetId
    : null;
}

// 科技供应堆：publicState.board.techSupply.stacks[tileId]
function techSupplyStackOf(observation, tileId) {
  const stacks = observation?.publicState?.board?.techSupply?.stacks
    || observation?.techSupply?.stacks
    || {};
  return stacks[tileId] || null;
}

// 扇区赢取候选（计划依赖"计划要赢的扇区还赢得了"）：快照 ownCount/maxOpponentCount/
// openSlotCount，任一变化 = 扇区标记变化（赢不了了）= 依赖变化。
function sectorCandidatesOf(observation) {
  return observation?.sectorWinRequirements?.candidates
    || observation?.outcomeProjection?.progress?.sectorWinRequirements?.candidates
    || [];
}

function publicCardIdsOf(observation) {
  const cards = observation?.publicState?.board?.publicCards
    || observation?.publicCards
    || [];
  return new Set(cards.map((card) => String(card?.id ?? card?.cardId ?? "")).filter(Boolean));
}

// 终点行星对应类型的标记数（环绕=orbitMarkers 数，登陆=landingMarkers 数，
// 卫星=卫星登陆数）。标记数决定计划实际会拿到的奖励槽位——不局限第一格
// （如奥陌陌登陆 3 个奖励格），标记数变化 = 目标奖励格被占/变化 = 依赖变化。
function endpointMarkerCount(observation, endpointTargetId) {
  const parts = String(endpointTargetId || "").split(":");
  const family = parts[0];
  const planetId = parts[1];
  const type = parts[2] || "planet";
  const planets = observation?.publicState?.board?.planets?.planets
    || observation?.planets?.planets
    || {};
  const planet = planets[planetId];
  if (!planet) return null;
  if (type === "satellite") {
    return (planet.satelliteLandings || []).length;
  }
  const markers = family === "land"
    ? (planet.landingMarkers || [])
    : (planet.orbitMarkers || []);
  return markers.length;
}

function planDependencyFromPlan(plan, leaf) {
  if (!plan || !leaf) return { kind: "generic" };
  const assumed = plan.planAssumedObservation;
  const candidate = leaf?.observation?.outcomeProjection?.progress?.probeRoute?.candidate;
  const routeTargetId = candidate?.endpointTargetId || probeRouteEndpointTargetId(leaf);
  if (routeTargetId) {
    const requirements = assumed?.probeRouteRequirements
      || assumed?.outcomeProjection?.progress?.probeGoalRequirements;
    const requirement = (requirements?.candidates || []).find((entry) => (
      String(entry?.targetId) === String(routeTargetId)
    ));
    return {
      kind: "route",
      endpointTargetId: String(routeTargetId),
      present: Boolean(requirement),
      movementSteps: Number(
        requirement?.gap?.movementSteps ?? candidate?.resourceGap?.movementSteps ?? 0,
      ),
      endpointMarkerCount: endpointMarkerCount(assumed, routeTargetId),
    };
  }
  const descriptor = plan.nextStepDescriptor;
  const target = descriptor?.target || {};
  if (target.alienSlotId != null) {
    const slot = findAlienSlot(assumed, target.alienSlotId);
    return {
      kind: "alien-slot",
      alienSlotId: String(target.alienSlotId),
      present: Boolean(slot),
      firstPlaced: slot?.firstPlaced ?? null,
      ownerPlayerColor: slot?.ownerPlayerColor ?? null,
    };
  }
  if (descriptor?.family === "research_tech" && target.tileId) {
    const stack = techSupplyStackOf(assumed, target.tileId);
    return {
      kind: "tech",
      tileId: String(target.tileId),
      present: Boolean(stack && stack.depleted !== true),
      bonusId: stack?.bonusId ?? null,
      remaining: stack?.remaining ?? null,
    };
  }
  if (descriptor?.family === "scan") {
    return {
      kind: "sector",
      candidates: sectorCandidatesOf(assumed)
        .map((entry) => ({
          sectorId: entry?.sectorId ?? null,
          ownCount: Number(entry?.ownCount) || 0,
          maxOpponentCount: Number(entry?.maxOpponentCount) || 0,
          openSlotCount: Number(entry?.openSlotCount) || 0,
        }))
        .sort((left, right) => String(left.sectorId).localeCompare(String(right.sectorId))),
    };
  }
  if (descriptor?.family === "play_card" && target.cardInstanceId
    && publicCardIdsOf(assumed).has(String(target.cardInstanceId))) {
    return {
      kind: "public-card",
      cardInstanceId: String(target.cardInstanceId),
      present: true,
    };
  }
  return { kind: "generic" };
}

// 重算历史诊断依赖；不供生产逐步复用。
function currentDependencyFromStore(store, observation) {
  const dependency = store?.dependency || null;
  if (dependency?.kind === "route") {
    const requirements = observation?.probeRouteRequirements
      || observation?.outcomeProjection?.progress?.probeGoalRequirements;
    const requirement = (requirements?.candidates || []).find((entry) => (
      String(entry?.targetId) === String(dependency.endpointTargetId)
    ));
    return {
      kind: "route",
      endpointTargetId: dependency.endpointTargetId,
      present: Boolean(requirement),
      movementSteps: Number(requirement?.gap?.movementSteps ?? 0),
      endpointMarkerCount: endpointMarkerCount(observation, dependency.endpointTargetId),
    };
  }
  if (dependency?.kind === "alien-slot") {
    const slot = findAlienSlot(observation, dependency.alienSlotId);
    return {
      kind: "alien-slot",
      alienSlotId: dependency.alienSlotId,
      present: Boolean(slot),
      firstPlaced: slot?.firstPlaced ?? null,
      ownerPlayerColor: slot?.ownerPlayerColor ?? null,
    };
  }
  if (dependency?.kind === "tech") {
    const stack = techSupplyStackOf(observation, dependency.tileId);
    return {
      kind: "tech",
      tileId: dependency.tileId,
      present: Boolean(stack && stack.depleted !== true),
      bonusId: stack?.bonusId ?? null,
      remaining: stack?.remaining ?? null,
    };
  }
  if (dependency?.kind === "sector") {
    return {
      kind: "sector",
      candidates: sectorCandidatesOf(observation)
        .map((entry) => ({
          sectorId: entry?.sectorId ?? null,
          ownCount: Number(entry?.ownCount) || 0,
          maxOpponentCount: Number(entry?.maxOpponentCount) || 0,
          openSlotCount: Number(entry?.openSlotCount) || 0,
        }))
        .sort((left, right) => String(left.sectorId).localeCompare(String(right.sectorId))),
    };
  }
  if (dependency?.kind === "public-card") {
    return {
      kind: "public-card",
      cardInstanceId: dependency.cardInstanceId,
      present: publicCardIdsOf(observation).has(dependency.cardInstanceId),
    };
  }
  return { kind: "generic" };
}

function findAlienSlot(observation, alienSlotId) {
  const aliens = observation?.publicState?.board?.aliens
    || observation?.publicState?.aliens
    || null;
  const slots = Array.isArray(aliens?.slots)
    ? aliens.slots
    : Object.values(aliens?.slots || {});
  return slots.find((entry) => (
    [entry?.id, entry?.slotId, entry?.alienId].some((value) => (
      value != null && String(value) === String(alienSlotId)
    ))
  )) || null;
}

// 已揭示外星人槽位数（揭示是单调事件：只增不减）。
function countRevealedAliens(observation) {
  const aliens = observation?.publicState?.board?.aliens
    || observation?.publicState?.aliens
    || null;
  const slots = Array.isArray(aliens?.slots)
    ? aliens.slots
    : Object.values(aliens?.slots || {});
  return slots.filter((slot) => slot?.revealed === true).length;
}

// ---------------------------------------------------------------------------
// 决策方案输出的计划结构 + simulation 侧复用判定
// ---------------------------------------------------------------------------

// 从 winning leaf 的真实提交证据构建版本化逐步计划；不使用宏节点 actionChain
// 猜测折叠步骤，也不把整叶的单一依赖或最终观察当成下一步的执行前状态。
const PLAN_SCHEMA_VERSION = "seti-action-plan-v2";

// 只在正式提交前读取同viewer完整观察；立即复制小型事实，不跨步骤持有观察。
function capturePlanStep({ observation, action }) {
  const board = observation?.publicState?.board;
  const actorId = String(action?.actorId || "");
  const self = observation?.publicState?.players?.find((player) => (
    String(player.playerId || player.id || "") === actorId
  ));
  if (!actorId || !board?.planets || !board.techSupply || !board.aliens || !self) {
    throw new TypeError("PLAN_STEP_OBSERVATION_INCOMPLETE: 逐步证据需要完整同viewer观察");
  }
  const probe = observation.probeRouteRequirements
    || observation.outcomeProjection?.progress?.probeGoalRequirements;
  const sectors = sectorCandidatesOf(observation);
  const sectorRequirements = observation.sectorWinRequirements
    || observation.outcomeProjection?.progress?.sectorWinRequirements;
  const facts = {
    scanEarth: structuredClone(sectorRequirements?.standardScanEarthSource ?? null),
    routes: (probe?.candidates || []).map((candidate) => ({
      targetId: candidate.targetId, requirementId: candidate.requirementId,
      sourceId: candidate.sourceId, rocketId: candidate.rocketId,
      movementSteps: candidate.gap?.movementSteps ?? candidate.required?.movementSteps ?? null,
      markers: endpointMarkerCount(observation, candidate.targetId),
    })),
    tech: structuredClone(board.techSupply.stacks || {}),
    finalTiles: Object.fromEntries(Object.entries(board.finalScoring?.tiles || {}).map(([id, tile]) => [id, {
      tile: structuredClone(tile), variant: board.finalScoring?.tileVariants?.[id],
    }])),
    sectors: sectors.map((candidate) => ({ sectorId: candidate.sectorId,
      targetId: candidate.targetId, ownCount: candidate.ownCount,
      maxOpponentCount: candidate.maxOpponentCount, openSlotCount: candidate.openSlotCount,
      nextSlotScore: candidate.nextSlotScore, ranking: structuredClone(candidate.ranking || []) })),
    cards: (board.publicCards || []).map((card) => card ? { id: card.id, cardId: card.cardId } : null),
    aliens: structuredClone(board.aliens.slots || []),
    data: structuredClone(self.dataProgress || null),
  };
  return { action: structuredClone(action), facts, revealedCount: countRevealedAliens(observation) };
}

function stepScopes(step, segment) {
  const scopes = new Map();
  const add = (kind, id) => scopes.set(`${kind}:${id}`, { kind, id: String(id) });
  function addRoute(targetId) {
    const candidates = step.facts.routes.filter((route) => route.targetId === targetId);
    const actions = [step.action, step.probeAction, ...segment.map((item) => item.action)];
    let route = null;
    for (const action of actions) {
      if (!["move", "orbit", "land"].includes(action?.family) || action.target?.rocketId == null) continue;
      route = candidates.find((candidate) => String(candidate.rocketId) === String(action.target.rocketId));
      if (route) break;
    }
    if (!route && String(step.routePlanId || "").startsWith("probe:")) {
      route = candidates.find((candidate) => candidate.requirementId === step.routePlanId.slice(6));
    }
    if (!route?.sourceId) return false;
    const scope = { kind: "route", id: targetId, sourceId: route.sourceId };
    scopes.set(stableSerialize(scope), scope);
    return true;
  }
  // 正式目标已达成但奖励 Decision 未排空：只依赖后续奖励选择，不继承已完成路线。
  const targetId = step.goalCompletionPending === true ? "" : String(step.routeTargetId || "");
  if (/^(orbit|land):/.test(targetId)) {
    if (!addRoute(targetId)) return { valid: false, reason: "plan-route-source-missing" };
  }
  else if (targetId.startsWith("tech:gain:")) add("tech", targetId.slice("tech:gain:".length));
  else if (targetId.startsWith("sector:win:")) {
    const sector = step.facts.sectors.find((item) => item.targetId === targetId);
    if (!sector) return { valid: false, reason: "plan-sector-target-missing" };
    add("sector", sector.sectorId);
  } else if (targetId === "data:analyze") add("data", "self");
  else if (targetId.startsWith("income:gain:")) {
    const routePlanId = String(step.routePlanId || "");
    if (routePlanId.startsWith("probe:")) {
      const route = step.facts.routes.find((item) => item.requirementId === routePlanId.slice(6));
      if (!route) return { valid: false, reason: "plan-income-route-missing" };
      if (!addRoute(route.targetId)) return { valid: false, reason: "plan-route-source-missing" };
    } else if (routePlanId === "income:data:computer-slot-4") add("data", "self");
    else if (!routePlanId.startsWith("card:") && !routePlanId.startsWith("income:industry:")) {
      return { valid: false, reason: "plan-income-scope-unknown" };
    }
  } else if (targetId && !targetId.startsWith("card:resolve:") && !targetId.startsWith("decision:")) {
    return { valid: false, reason: "plan-target-scope-unknown" };
  }
  // decision:<actionId> 是正式目标目录为 conditional choice 建立的结构目标。
  // 它没有独立战略资源事实，仍从该段具体选择提取全部外部依赖。
  for (const item of segment) {
    if (item.action.family === "scan") add("scan-earth", "standard");
    const target = item.action.target || {};
    if (target.tileId) {
      const choiceId = String(target.choiceId || "");
      if (choiceId === `final:${target.tileId}`) add("final-tile", target.tileId);
      else if (Object.hasOwn(item.facts.tech, target.tileId)
        && (!choiceId || choiceId === `tech:${target.tileId}`
          || choiceId.startsWith(`tech:${target.tileId}:slot:`))) add("tech", target.tileId);
      else return { valid: false, reason: "plan-tile-scope-unknown" };
    }
    if (target.alienSlotId != null) {
      if (!target.traceType) return { valid: false, reason: "plan-trace-type-missing" };
      add("alien", `${target.alienSlotId}:${target.traceType}`);
    }
    if (target.nebulaId || target.sectorId) add("sector", target.nebulaId || target.sectorId);
    if (target.publicSlotIndex != null) add("card-slot", target.publicSlotIndex);
    else if (target.cardInstanceId && item.facts.cards.some((card) => card?.id === target.cardInstanceId)) {
      add("card", target.cardInstanceId);
    }
    if (item.action.family === "place_data" || target.target === "computer" || target.target === "blueBonus") {
      add("data", "self");
    }
  }
  return { valid: true, scopes: [...scopes.values()].sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b))) };
}

function scopedFact(facts, scope) {
  if (scope.kind === "scan-earth") return facts.scanEarth ?? undefined;
  if (scope.kind === "route") {
    const routes = facts.routes.filter((item) => item.targetId === scope.id && item.sourceId === scope.sourceId)
      .sort((a, b) => String(a.requirementId).localeCompare(String(b.requirementId)));
    return routes.length && routes.every((item) => item.markers != null && item.movementSteps != null)
      ? routes : undefined;
  }
  if (scope.kind === "tech") return facts.tech[scope.id];
  if (scope.kind === "final-tile") {
    const fact = facts.finalTiles?.[scope.id];
    return fact?.variant != null && Array.isArray(fact.tile?.marks) ? fact : undefined;
  }
  if (scope.kind === "sector") return facts.sectors.find((item) => String(item.sectorId) === scope.id);
  if (scope.kind === "data") return facts.data ?? undefined;
  if (scope.kind === "card-slot") return facts.cards[Number(scope.id)];
  if (scope.kind === "card") return facts.cards.find((card) => card?.id === scope.id);
  if (scope.kind === "alien") {
    const [slotId, traceType] = scope.id.split(":");
    const slot = facts.aliens.find((item) => String(item.slotId) === slotId);
    return slot?.traces?.[traceType];
  }
  throw new TypeError(`PLAN_DEPENDENCY_SCOPE_UNKNOWN: ${scope.kind}`);
}

function compilePlanSteps(steps) {
  return steps.map((step, index) => {
    const segment = [];
    for (let next = index; next < steps.length; next += 1) {
      const item = steps[next];
      if (item.goalDepth !== step.goalDepth || item.routeTargetId !== step.routeTargetId
        || item.routePlanId !== step.routePlanId
        || Boolean(item.goalCompletionPending) !== Boolean(step.goalCompletionPending)) break;
      segment.push(item);
    }
    const selected = stepScopes(step, segment);
    const dependencies = (selected.scopes || []).map((scope) => ({
      scope, fact: structuredClone(scopedFact(step.facts, scope)),
    }));
    const missing = dependencies.some((dependency) => dependency.fact === undefined);
    return { actionId: step.action.actionId, actionKey: actionSemanticKey(step.action),
      actorId: step.action.actorId, revealedCount: step.revealedCount,
      valid: selected.valid && !missing,
      reason: selected.reason || (missing ? "plan-dependency-fact-missing" : null),
      dependencies };
  });
}

function planFromSteps(steps) {
  return { schemaVersion: PLAN_SCHEMA_VERSION, nextActionId: steps[0]?.actionId ?? null, steps };
}

function buildPlanFromSnapshot(snapshot) {
  const steps = snapshot?.plan?.executionSteps;
  return steps?.length > 1 ? planFromSteps(steps.slice(1)) : null;
}

// 计划前进一步：同时消费动作、依赖和揭示基线。
function advancePlan(plan) {
  if (!plan) return null;
  if (plan.schemaVersion !== PLAN_SCHEMA_VERSION || !Array.isArray(plan.steps)) return null;
  return planFromSteps(plan.steps.slice(1));
}

// simulation 侧复用判定（用户口径，对照基准 = 计划假设状态）：
//   复用 = 没有新信息。新信息只两类：
//   ① 翻开了外星人（揭示槽位数 > 计划假设值）→ 无条件重新决策；
//   ② 计划依赖环节变化（计划依赖的具体盘面事实变了：目标奖励格被占 / 路线变长 /
//      计划要拿的科技被拿走 / 目标扇区赢不了 / 目标外星槽被占 / 目标公共牌被买走）。
//   其余（对手移动/资源变化、无关扇区、无探测器移动的旋转、计划内自己的推进）
//   不算新信息 → 复用。
//   控制动作特例：下一步是 end_turn/pass → 无条件重新决策。主行动选择是每次决策
//   最核心的评估，而 end_turn/pass 评估最便宜（control 路径 maxDepth=1），不能靠
//   计划复用跳过——winning leaf 链穿过回合边界（end_turn）rollout 时，新回合计划
//   下一步为 end_turn 被盲目复用会跳过当前盘面上更有价值的主行动（同状态搜索选
//   place_data，fast-path 直接 end_turn，白方掉分）。48f0af3e 移除该特例后免电
//   分析盘面 219 决策即终局（旧记录 520+）、均分暴跌（AVG 27.3），恢复 1d063418
//   口径。同回合内（协调器回合门控）end_turn 仍按计划正常推进（回合自然结束）。
// 命中返回 { hit: true, action, nextPlan }；miss 返回 { hit: false, reason }。
function planReuseCheck(plan, currentObservation, legalActions, options = {}) {
  if (!plan || !plan.nextActionId) return Object.freeze({ hit: false, reason: "no-plan" });
  if (plan.schemaVersion !== PLAN_SCHEMA_VERSION || !plan.steps?.length) {
    return Object.freeze({ hit: false, reason: "plan-step-evidence-missing" });
  }
  const step = plan.steps[0];
  if (step.actionId !== plan.nextActionId || step.valid !== true) {
    return Object.freeze({ hit: false, reason: step.reason || "plan-step-evidence-invalid" });
  }
  const current = (legalActions || []).find((action) => (
    String(action?.actionId) === String(plan.nextActionId)
  ));
  if (!current) return Object.freeze({ hit: false, reason: "step-not-legal" });
  if (String(current.actorId) !== String(step.actorId) || actionSemanticKey(current) !== step.actionKey) {
    return Object.freeze({ hit: false, reason: "plan-step-identity-changed" });
  }
  // 控制动作不盲从计划（见上：end_turn/pass 必须每次重新决策主行动）
  if (options.sameTurn !== true && ["end_turn", "pass"].includes(current.family)) {
    return Object.freeze({ hit: false, reason: "control-step-redecide", family: current.family });
  }
  if (step.revealedCount == null) {
    return Object.freeze({ hit: false, reason: "no-reveal-count" });
  }
  if (!currentObservation) {
    return Object.freeze({ hit: false, reason: "no-observation" });
  }
  if (countRevealedAliens(currentObservation) > step.revealedCount) {
    return Object.freeze({
      hit: false,
      reason: "alien-revealed",
      assumedRevealedCount: step.revealedCount,
      currentRevealedCount: countRevealedAliens(currentObservation),
    });
  }
  if (!Array.isArray(step.dependencies)) {
    return Object.freeze({ hit: false, reason: "no-dependency" });
  }
  let facts;
  try { facts = capturePlanStep({ observation: currentObservation, action: current }).facts; }
  catch (error) {
    return Object.freeze({ hit: false, reason: "plan-step-observation-incomplete", message: error.message });
  }
  for (const dependency of step.dependencies) {
    const currentFact = scopedFact(facts, dependency.scope);
    if (dependency.fact === undefined || currentFact === undefined) {
      return Object.freeze({ hit: false, reason: "plan-dependency-fact-missing", affected: dependency.scope });
    }
    if (stableSerialize(currentFact) !== stableSerialize(dependency.fact)) {
      return Object.freeze({ hit: false, reason: "next-step-affected", affected: dependency.scope });
    }
  }
  return Object.freeze({ hit: true, action: current, nextPlan: advancePlan(plan) });
}

  return Object.freeze({
    stableSerialize,
    stableHash,
    actionSemanticKey,
    stripResourceFields,
    directoryFactsSnapshot,
    directoryFingerprint,
    directoryFingerprintFromFacts,
    planContinuationFromWinningLeaf,
    pairContinuation,
    changedFactComponents,
    aggregateStats,
    extractPlanSnapshot,
    buildPlanFromSnapshot,
    capturePlanStep,
    compilePlanSteps,
    PLAN_SCHEMA_VERSION,
    advancePlan,
    planReuseCheck,
    planDependencyFromPlan,
    currentDependencyFromStore,
    countRevealedAliens,
    rankActions,
  });
});

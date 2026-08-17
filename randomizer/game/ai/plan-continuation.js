"use strict";

/**
 * 计划延续复用与诊断（plan-continuation）。
 *
 * 决策方案输出计划结构、simulation 侧复用判定与诊断统计的纯函数集合，不修改
 * 规则状态、不改变任何决策语义。架构见 docs/ai-design.md §3：
 *
 * - 方案输出：`buildPlanFromSnapshot`（winning leaf -> { nextActionId,
 *   continuation[], dependency, revealedCount }）、`advancePlan`（多步消费）；
 * - 复用判定：`planReuseCheck`——下一步仍合法 + 外星揭示基线未增 + 依赖环节
 *   未变（路线终点移动步数/第一奖励格、外星痕迹槽占用）则复用，否则重新决策；
 *   翻开外星人（揭示槽位数增加）无条件重新决策；
 * - 诊断：`pairContinuation` / `aggregateStats` 量化「计划下一步 == 新搜索实际
 *   选择」的命中率与预测器质量（工具 tools/diagnose_plan_continuation.js）。
 *
 * 本模块全部为纯函数；machine-player-coordinator（planReuseCheck 装配）与
 * heuristic-decision-function（方案输出 plan）共用。
 * actionSemanticKey 与 expected-score-evaluator 内部同名单函数保持同一语义
 * （family+target+payload 稳定序列化），此处复制以避免在共享工作树中修改
 * 该 policy 模块；行为由单元测试钉住。
 */

const expectedScoreEvaluator = require("./expected-score-evaluator");

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
// store 只需要 plan.nextStepKey 与 planDependency，不需要全 action 排序。
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
      plan = planContinuationFromWinningLeaf(leaf);
      planStatus = plan.hasContinuation ? "continuation" : "chain-too-short";
      planDependency = planDependencyFromPlan(plan, leaf);
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
    facts: rootObservation ? directoryFactsSnapshot(rootObservation) : null,
    directoryFingerprint: rootObservation ? directoryFingerprint(rootObservation) : null,
    directoryFingerprintWithRockets: rootObservation
      ? directoryFingerprint(rootObservation, { includeRockets: true })
      : null,
  };
}

// ---------------------------------------------------------------------------
// 计划依赖事实（三层判定用；对照基准 = 上轮本家行动执行完的计划假设状态）
// ---------------------------------------------------------------------------

// 计划执行所依赖的盘面事实：
// - 探测路线计划（winning leaf 带 probeRoute 终点）：终点 { movementSteps,
//   firstRewardSlotOpen }——「着陆需要的移动更多了 / 第一奖励格被占」即此字段变化；
// - 下一步是外星痕迹放置（target.alienSlotId）：槽位占用——「想标记的槽被占了」；
// - 其他：{ kind: "generic" } → 视为不影响计划执行 → 可复用（对手火箭移动、
//   打牌、资源变化、无关扇区、无探测器移动的旋转均落此分支，先直接复用）。
function planDependencyFromPlan(plan, leaf) {
  if (!plan || !leaf) return { kind: "generic" };
  const candidate = leaf?.observation?.outcomeProjection?.progress?.probeRoute?.candidate;
  if (candidate?.endpointTargetId) {
    const assumed = plan.planAssumedObservation;
    const requirements = assumed?.probeRouteRequirements
      || assumed?.outcomeProjection?.progress?.probeGoalRequirements;
    const requirement = (requirements?.candidates || []).find((entry) => (
      String(entry?.targetId) === String(candidate.endpointTargetId)
    ));
    return {
      kind: "route",
      endpointTargetId: String(candidate.endpointTargetId),
      present: Boolean(requirement),
      movementSteps: Number(
        requirement?.gap?.movementSteps ?? candidate.resourceGap?.movementSteps ?? 0,
      ),
      firstRewardSlotOpen: requirement?.firstRewardSlotOpen ?? null,
    };
  }
  const target = plan.nextStepDescriptor?.target || {};
  if (target.alienSlotId != null) {
    const assumed = plan.planAssumedObservation;
    const slot = findAlienSlot(assumed, target.alienSlotId);
    return {
      kind: "alien-slot",
      alienSlotId: String(target.alienSlotId),
      present: Boolean(slot),
      firstPlaced: slot?.firstPlaced ?? null,
      ownerPlayerColor: slot?.ownerPlayerColor ?? null,
    };
  }
  return { kind: "generic" };
}

// 从当前观测重算同一依赖（与 planDependencyFromPlan 同构，供 fast-path 比较）。
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
      firstRewardSlotOpen: requirement?.firstRewardSlotOpen ?? null,
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

// 从 extractPlanSnapshot 快照构建「决策方案输出」携带的计划：
//   { nextActionId, continuation, dependency, revealedCount }
// 无延续（winning leaf 链条不足 2 步）返回 null → 方案只输出下一步，无计划。
function buildPlanFromSnapshot(snapshot) {
  const plan = snapshot?.plan;
  if (!plan?.hasContinuation || !plan.nextActionId) return null;
  return {
    nextActionId: plan.nextActionId,
    continuation: [...(plan.continuation || [])],
    dependency: snapshot.planDependency ?? null,
    revealedCount: snapshot.planAssumedRevealedCount ?? null,
  };
}

// 计划前进一步：消费当前 nextActionId，续上 continuation 的下一个。
function advancePlan(plan) {
  if (!plan) return null;
  const continuation = (plan.continuation || []).slice(1);
  return {
    nextActionId: continuation[0] ?? null,
    continuation,
    dependency: plan.dependency,
    revealedCount: plan.revealedCount,
  };
}

// simulation 侧复用判定（用户口径，对照基准 = 上轮本家行动执行完的计划假设状态）：
//   下一步仍合法 且 计划执行依赖的环节未变 → 复用（盘面无变化 tier1；变化不影响
//   计划执行 tier2——对手火箭移动/打牌/资源变化、无关扇区、无探测器移动的旋转）；
//   依赖环节变了（着陆移动变多 / 目标外星人槽被占 / 第一奖励格被占 / 跨出当前
//   路线终点）→ 重新决策（tier3）。
//   硬性特例：翻开了外星人（揭示槽位数 > 计划假设值）→ 无条件重新决策。
// 命中返回 { hit: true, action, nextPlan }——nextPlan 为前进后的计划（供 store
// 存回，实现多步复用）；miss 返回 { hit: false, reason }。
function planReuseCheck(plan, currentObservation, legalActions) {
  if (!plan || !plan.nextActionId) return Object.freeze({ hit: false, reason: "no-plan" });
  const current = (legalActions || []).find((action) => (
    String(action?.actionId) === String(plan.nextActionId)
  ));
  if (!current) return Object.freeze({ hit: false, reason: "step-not-legal" });
  if (plan.revealedCount == null) {
    return Object.freeze({ hit: false, reason: "no-reveal-count" });
  }
  if (!currentObservation) {
    return Object.freeze({ hit: false, reason: "no-observation" });
  }
  if (countRevealedAliens(currentObservation) > plan.revealedCount) {
    return Object.freeze({
      hit: false,
      reason: "alien-revealed",
      assumedRevealedCount: plan.revealedCount,
      currentRevealedCount: countRevealedAliens(currentObservation),
    });
  }
  if (plan.dependency == null) {
    return Object.freeze({ hit: false, reason: "no-dependency" });
  }
  // 计划跨出当前路线终点（下一步是新路线的 orbit/land）→ 依赖失效 → 重新决策
  if (plan.dependency.kind === "route" && ["orbit", "land"].includes(current.family)) {
    const targetId = [
      current.family,
      current.target?.planetId,
      current.target?.type || "planet",
      current.target?.satelliteId || "",
    ].join(":");
    if (targetId !== plan.dependency.endpointTargetId) {
      return Object.freeze({ hit: false, reason: "route-target-changed" });
    }
  }
  const currentDependency = currentDependencyFromStore({ dependency: plan.dependency }, currentObservation);
  if (stableHash(currentDependency) !== stableHash(plan.dependency)) {
    return Object.freeze({ hit: false, reason: "next-step-affected", affected: currentDependency });
  }
  return Object.freeze({ hit: true, action: current, nextPlan: advancePlan(plan) });
}

module.exports = Object.freeze({
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
  advancePlan,
  planReuseCheck,
  planDependencyFromPlan,
  currentDependencyFromStore,
  countRevealedAliens,
  rankActions,
});

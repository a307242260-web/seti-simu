"use strict";

/**
 * 计划延续诊断（plan-continuation diagnostics）。
 *
 * 纯只读诊断：不修改规则状态、不改变任何决策语义。目标是为「跨决策复用搜索
 * 结果」（fast-path / warm start）收集硬证据：
 *
 * - actualHit：上一次决策 winning leaf 计划出的「下一步」是否就是本次决策全量
 *   搜索实际选择的 action（语义级比较）；
 * - would-hit 预测器：只用便宜事实（下一步合法性 / 全量目录指纹 / 赢面 margin）
 *   能否准确预测 actualHit（precision / recall）；
 * - 失效原因：相邻同席决策之间哪些事实分量发生了变化（board.* / directory.*，
 *   含本席行动效果）。
 *
 * 关键设计：目录指纹剥离资源缺口（credits/energy/…），本席自己的行动造成的
 * 「计划内变化」不改变指纹；目录候选数组按元素 stableHash 排序，投影深度
 * （cheap vs full）导致的枚举顺序差异不产生误报。
 *
 * 本模块全部为纯函数；数据采样由 tools/diagnose_plan_continuation.js 完成。
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
  // 计划假设状态（搜索内 cheap 投影）与全量投影结构不可比，不设 planAssumedSame
  // 预测器；外部事实发散由 directorySame（全量 vs 全量）覆盖。
  // margin 为 null（无次优候选，只有唯一可行行动）视为安全；<= 0（平局/落后）才危险。
  const marginOk = previous?.margin == null || Number(previous?.margin) > 0;
  const actualHit = stepLegal && plan.nextStepKey === current?.actionKey;
  const reasons = [];
  if (!stepLegal) reasons.push("step-not-legal");
  if (!directorySame) reasons.push("directory-changed");
  if (!marginOk) reasons.push("margin-non-positive");
  if (stepLegal && directorySame && marginOk && !actualHit) {
    reasons.push("plan-degraded-or-alternative-improved");
  }
  return Object.freeze({
    applicable: true,
    actualHit,
    stepLegal,
    directorySame,
    directorySameWithRockets,
    marginOk,
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
    marginOk: (pair) => pair.marginOk === true,
    "stepLegal+directory": (pair) => pair.stepLegal === true && pair.directorySame === true,
    "stepLegal+directory+margin": (pair) => (
      pair.stepLegal === true && pair.directorySame === true && pair.marginOk === true
    ),
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
});

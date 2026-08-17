"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("./simulation-env");
const outcomeModel = require("../game/ai/outcome-model");
const solar = require("../solar-system/core");

function drainOpeningDecisions(environment) {
  const selectionProgress = new Map();
  let guard = 0;
  while (environment.legalActions()[0]?.family?.startsWith("choose_")) {
    const actions = environment.legalActions();
    const actorId = actions[0].actorId;
    const progress = selectionProgress.get(actorId) || { industry: false, initialIds: new Set() };
    let action = actions.find((candidate) => candidate.target?.kind === "start_initial_setup")
      || actions.find((candidate) => candidate.target?.kind === "confirm_initial_setup");
    if (!action && !progress.industry) {
      action = actions.find((candidate) => (
        candidate.target?.kind === "select_initial_card"
        && candidate.target?.selectionKind === "industry"
      ));
      if (action) progress.industry = true;
    }
    if (!action && progress.initialIds.size < 2) {
      action = actions.find((candidate) => (
        candidate.target?.kind === "select_initial_card"
        && candidate.target?.selectionKind === "initial"
        && !progress.initialIds.has(candidate.target.cardId)
      ));
      if (action) progress.initialIds.add(action.target.cardId);
    }
    action = action || actions[0];
    selectionProgress.set(actorId, progress);
    assert.equal(environment.step(action).ok, true);
    guard += 1;
    assert.ok(guard < 50, "opening Decision 必须经标准初始选择与收入链有限结束");
  }
}

function collectValuesByKey(value, key, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Object.hasOwn(value, key) && value[key] != null) result.push(value[key]);
  for (const child of Object.values(value)) collectValuesByKey(child, key, result);
  return result;
}

function createSaturnLandingCheckpoint(environment) {
  drainOpeningDecisions(environment);
  const checkpoint = structuredClone(environment.createCheckpoint());
  const roots = [
    JSON.parse(checkpoint.coreState.committedState),
    JSON.parse(checkpoint.coreState.compositionEnvelope.committedState),
  ];
  const green = roots[0].players.players.find((player) => player.color === "green");
  const saturn = solar.createSolarSnapshot(roots[0].solarSystem)
    .planetLocations.find((planet) => planet.planetId === "saturn");
  assert.ok(green && saturn);
  for (const root of roots) {
    root.turn.currentPlayerId = green.id;
    root.turn.roundNumber = 1;
    root.turn.turnNumber = 4;
    root.turn.passedPlayerIds = [];
    const player = root.players.players.find((candidate) => candidate.id === green.id);
    Object.assign(player.resources, {
      credits: 20,
      energy: 20,
      score: 0,
      availableData: 0,
    });
    player.dataState = { poolTokens: [], placedTokens: [], discardedCount: 0 };
    player.mainActionCompleted = false;
    player.passCompletionPending = false;
    root.pieces.rockets = [{
      id: 1,
      playerId: player.id,
      color: player.color,
      playerSequence: 1,
      surface: "solar-board",
      sectorX: saturn.x,
      sectorY: saturn.y,
      slotIndex: null,
      angleDegrees: null,
      radius: null,
    }];
    root.pieces.activeRocketId = 1;
    root.pieces.playerRocketSequences = { [player.id]: [1] };
    root.meta.sequences.rocket = Math.max(2, Number(root.meta.sequences.rocket) || 1);
    Object.assign(root.aliens.aliens[1].traces.yellow, {
      firstPlaced: true,
      ownerPlayerId: root.players.players.find((candidate) => candidate.color === "blue")?.id || null,
      ownerPlayerColor: "blue",
      extraCount: 0,
      extraMarkers: [],
    });
    // 槽 2 黄色痕迹显式清空：初始选牌（drain）可能给槽 2 预置其他玩家的首痕迹，
    // 测试需要确定的"槽1 已有首痕迹 / 槽2 无痕迹"对比场景来证明首痕迹宣传奖励
    // 与追加痕迹无宣传（否则两个槽位都是追加痕迹，delta 退化为 [0,0]）。
    Object.assign(root.aliens.aliens[2].traces.yellow, {
      firstPlaced: false,
      ownerPlayerId: null,
      ownerPlayerColor: null,
      extraCount: 0,
      extraMarkers: [],
    });
  }
  checkpoint.coreState.committedState = JSON.stringify(roots[0]);
  checkpoint.coreState.compositionEnvelope.committedState = JSON.stringify(roots[1]);
  checkpoint.replaySteps = null;
  return { checkpoint, playerId: green.id };
}

function createSaturnApproachCheckpoint(environment) {
  const result = createSaturnLandingCheckpoint(environment);
  const checkpoint = structuredClone(result.checkpoint);
  const roots = [
    JSON.parse(checkpoint.coreState.committedState),
    JSON.parse(checkpoint.coreState.compositionEnvelope.committedState),
  ];
  for (const root of roots) {
    const saturn = solar.createSolarSnapshot(root.solarSystem)
      .planetLocations.find((planet) => planet.planetId === "saturn");
    const rocket = root.pieces.rockets.find((candidate) => candidate.playerId === result.playerId);
    rocket.sectorX = (Number(saturn.x) + 1) % 8;
    rocket.sectorY = Number(saturn.y);
  }
  checkpoint.coreState.committedState = JSON.stringify(roots[0]);
  checkpoint.coreState.compositionEnvelope.committedState = JSON.stringify(roots[1]);
  return { checkpoint, playerId: result.playerId };
}

function createMarsOrbitCheckpoint(environment) {
  const result = createSaturnLandingCheckpoint(environment);
  const checkpoint = structuredClone(result.checkpoint);
  const roots = [
    JSON.parse(checkpoint.coreState.committedState),
    JSON.parse(checkpoint.coreState.compositionEnvelope.committedState),
  ];
  for (const root of roots) {
    const mars = solar.createSolarSnapshot(root.solarSystem)
      .planetLocations.find((planet) => planet.planetId === "mars");
    const player = root.players.players.find((candidate) => candidate.id === result.playerId);
    const rocket = root.pieces.rockets.find((candidate) => candidate.playerId === result.playerId);
    assert.ok(mars && player && rocket);
    rocket.sectorX = mars.x;
    rocket.sectorY = mars.y;
    player.orbitCount = 0;
    player.mainActionCompleted = false;
    player.passCompletionPending = false;
  }
  checkpoint.coreState.committedState = JSON.stringify(roots[0]);
  checkpoint.coreState.compositionEnvelope.committedState = JSON.stringify(roots[1]);
  return { checkpoint, playerId: result.playerId };
}

const env = createSimulationEnv();
const direct = createSimulationEnv();
try {
  env.reset({ seed: "seti-156-outcome-contract", activePlayerCount: 4 });
  direct.reset({ seed: "seti-156-outcome-contract", activePlayerCount: 4 });
  assert.deepEqual(
    direct.createCheckpoint(),
    env.createCheckpoint(),
    "setup Policy 改为真实 leaf 估值后，同 seed 的规则、RNG 与非策略状态仍必须完全一致",
  );
  const actions = env.legalActions();
  const selectedActions = actions.slice(0, 2);
  const before = env.createCheckpoint();
  const project = (items) => outcomeModel.projectOutcomeObservations(items, {
    seatId: selectedActions[0].actorPlayerId,
    stateVersion: selectedActions[0].stateVersion,
    decisionVersion: selectedActions[0].decisionVersion,
  });
  const outcomes = project(env.evaluateActionOutcomes(selectedActions));
  const reversed = project(env.evaluateActionOutcomes([...selectedActions].reverse()));

  assert.deepEqual(env.createCheckpoint(), before,
    "执行全部候选后 canonical bytes/RNG/session/journal/history/replay 必须不变");
  assert.deepEqual(outcomes, reversed, "候选枚举顺序不得改变 action outcome");
  assert.equal(outcomes.every((outcome) => outcome.schemaVersion === "seti-action-outcome-v1"), true);

  for (const action of selectedActions) {
    direct.loadCheckpoint(before);
    const result = direct.step(direct.legalActions().find((candidate) => candidate.actionId === action.actionId));
    assert.equal(result.ok, true);
    const outcome = outcomes.find((candidate) => candidate.actionId === action.actionId);
    const directObservation = outcomeModel.createDecisionObservation(
      direct.observe(action.actorPlayerId),
      {
      seatId: action.actorPlayerId,
      stateVersion: result.legalActions[0]?.stateVersion ?? action.stateVersion,
      decisionVersion: result.legalActions[0]?.decisionVersion ?? action.decisionVersion,
      },
    );
    assert.deepEqual(
      outcome.leaves[0].observation.outcomeProjection,
      directObservation.outcomeProjection,
      "沙箱与直接标准执行必须得到相同 viewer-safe leaf projection",
    );
    assert.equal(outcome.status, "settled", "当前标准 Decision 提交后必须到达下一稳定决策边界");
    assert.equal(outcome.confidence, "low",
      "独立候选随机协议未聚合期望时必须明确返回 low-confidence");
  }

  const stale = { ...selectedActions[0], actionId: "stale-action" };
  const failed = env.evaluateActionOutcomes([stale])[0];
  assert.equal(failed.status, "failed");
  assert.equal(failed.code, "COUNTERFACTUAL_ACTION_STALE");
  assert.deepEqual(env.createCheckpoint(), before, "stale fork 必须零提交、零污染");
} finally {
  env.dispose();
  direct.dispose();
}

{
  const environment = createSimulationEnv();
  try {
    environment.reset({
      seed: "seti-104-official-v1",
      activePlayerCount: 4,
      traceCounterfactualGoalClusters: true,
    });
    drainOpeningDecisions(environment);
    const actions = environment.legalActions();
    const b11 = actions.find((action) => (
      action.family === "play_card" && action.summary === "b_11.webp"
    ));
    assert.ok(b11, "固定盘面必须持有飞掠小行星");
    const before = environment.createCheckpoint();
    const b11Outcome = environment.evaluateActionOutcomes([b11], {
      maxDepth: 15,
      maxLeaves: 8,
      maxNodes: 128,
    })[0];
    assert.equal(b11Outcome.status, "settled",
      "卡牌移动 Decision 必须以 conditional descriptor 在同一 Session 内完成");
    assert.equal(b11Outcome.code, null);
    assert.equal(b11Outcome.leaves.length > 0, true);
    assert.deepEqual(environment.createCheckpoint(), before,
      "卡牌移动反事实不得污染 canonical root");

    const scan = actions.find((action) => action.family === "scan");
    assert.ok(scan, "固定盘面必须存在扫描行动");
    const scanOutcome = environment.evaluateActionOutcomes([scan], {
      maxDepth: 15,
      maxLeaves: 1,
      maxNodes: 128,
    })[0];
    const scanDiagnostics = environment.getCounterfactualDiagnostics();
    assert.equal(scanOutcome.leaves.length, 1);
    assert.equal(scanOutcome.code, "COUNTERFACTUAL_SEARCH_PRUNED");
    assert.equal(scanDiagnostics.maxFrontierPerRoot, 8);
    assert.equal(
      scanDiagnostics.maxRetainedFrontierSize <= scanDiagnostics.maxFrontierSize,
      true,
      "诊断必须同时保留原始 frontier 压力和实际 beam 保留宽度",
    );
    assert.equal(scanDiagnostics.executedNodeCount < 50, true,
      "root 达到叶上限后不得继续执行剩余兄弟节点");
    assert.equal(scanDiagnostics.prunedNodeCount > 0, true);
    assert.equal(scanDiagnostics.saturatedVirtualRoots.length, 1);
    assert.equal(scanDiagnostics.saturatedVirtualRoots[0].retainedLeafCount, 1);
    assert.equal(scanDiagnostics.saturatedVirtualRoots[0].saturatedOriginCount > 0, true);
    assert.equal(scanDiagnostics.saturatedVirtualRoots[0].rootActionFamily, "scan");
    assert.equal(
      Number(scanDiagnostics.hiddenInformationBarrierCountByCode?.hidden_card_reveal) > 0,
      true,
      "公共牌补牌必须在反事实搜索中建立隐藏信息 mask",
    );
    const knownCardIds = new Set([
      ...(scanOutcome.rootObservation.publicState?.board?.publicCards || []),
      ...(scanOutcome.rootObservation.selfState?.hand || []),
      ...(scanOutcome.rootObservation.selfState?.reservedCards || []),
      ...(scanOutcome.rootObservation.selfState?.privateAlienCards || []),
    ].map((card) => card?.id).filter(Boolean));
    const maskedLeaves = scanOutcome.leaves.filter((leaf) => (
      leaf.observation?.informationBoundary?.code === "hidden_card_reveal"
    ));
    assert.equal(maskedLeaves.length > 0, true,
      "公共牌翻出后必须继续产生可评估的遮蔽叶，而不是停止搜索");
    assert.equal(maskedLeaves.some((leaf) => leaf.actionChain.length >= 4), true,
      "隐藏信息边界后仍必须继续执行不依赖新牌身份的后续行动");
    for (const leaf of maskedLeaves) {
      const exposedCardIds = [
        ...collectValuesByKey(leaf, "cardInstanceId"),
        ...(leaf.observation.publicState?.board?.publicCards || [])
          .map((card) => card?.id).filter(Boolean),
        ...(leaf.observation.selfState?.hand || [])
          .map((card) => card?.id).filter(Boolean),
        ...(leaf.observation.selfState?.reservedCards || [])
          .map((card) => card?.id).filter(Boolean),
        ...(leaf.observation.selfState?.privateAlienCards || [])
          .map((card) => card?.id).filter(Boolean),
      ];
      assert.equal(exposedCardIds.every((id) => knownCardIds.has(String(id))), true,
        "叶 observation 与目标 requirement 不得暴露本次搜索中新翻出的牌身份");
    }
    assert.equal(scanDiagnostics.saturatedVirtualRoots[0].saturatedRouteGroups.length > 0, true);
    assert.equal(
      scanDiagnostics.saturatedVirtualRoots[0].saturatedRouteGroups
        .reduce((total, group) => total + group.originCount, 0),
      scanDiagnostics.saturatedVirtualRoots[0].saturatedOriginCount,
      "截断明细必须按行动类型链完整覆盖全部 origin",
    );
    assert.equal(
      scanDiagnostics.saturatedVirtualRoots[0].saturatedRouteGroups
        .every((group) => group.pendingActionFamily),
      true,
      "截断明细必须保留下一项待执行行动类型",
    );
    assert.deepEqual(environment.createCheckpoint(), before,
      "叶饱和剪枝不得污染 canonical root");

    const policyResult = environment.runHeuristicPolicyDecision();
    const policyDiagnostics = environment.getCounterfactualDiagnostics();
    assert.equal(policyDiagnostics.beamPrunedOriginCount, 0,
      "次级目标搜索不得恢复 beam");
    assert.equal(policyDiagnostics.executionLimitReached, false,
      "固定盘面必须自然耗尽 frontier，不能把执行上限当剪枝");
    assert.equal(Number.isSafeInteger(policyDiagnostics.conditionalEquivalentMergeCount), true);
    assert.equal(Number.isSafeInteger(policyDiagnostics.resourceDominatedOriginCount), true);
    assert.equal(
      Object.values(policyDiagnostics.completionDominatedOriginCountByTarget || {})
        .reduce((total, count) => total + count, 0),
      policyDiagnostics.completionDominatedOriginCount,
      "完成态支配诊断必须逐次级目标完整归因，不能跨目标合并",
    );
    const routeEntryStats = Object.values(policyDiagnostics.routeEntryStatsByTarget || {});
    assert.equal(routeEntryStats.length > 0, true,
      "次级目标搜索必须报告按目标拆分的入口状态统计");
    assert.equal(routeEntryStats.every((stats) => (
      stats.bindingOriginCount >= stats.distinctEntryStateCount
      && stats.maxBindingsPerEntryState <= stats.bindingOriginCount
      && stats.completedTransitionCount >= stats.retainedCompletedTransitionCount
    )), true, "目标入口、完成与保留路线计数必须保持包含关系");
    assert.equal(
      Object.values(policyDiagnostics.completedRouteGroupsByTarget || {})
        .flat()
        .reduce((total, group) => total + group.completedTransitionCount, 0),
      policyDiagnostics.completedGoalTransitionCount,
      "完成路线族必须按目标与行动序列完整覆盖全部完成尝试",
    );
    assert.equal(policyDiagnostics.maxExecutionNodes, 4096);
    assert.equal(policyDiagnostics.executedNodeCount < policyDiagnostics.maxExecutionNodes, true,
      "固定盘面必须在物理失控保护前自然耗尽");
    assert.equal(policyDiagnostics.completedGoalTransitionCount > 0, true,
      "次级深度只能由真实结果目标完成推进");
    assert.equal(policyDiagnostics.maxCompletedGoalDepth > 0, true,
      "诊断必须报告实际完成的最大结果目标深度");
    assert.equal(policyDiagnostics.maxCompletedGoalDepth <= 15, true,
      "15 步只限制已完成的结果目标数");
    assert.equal(policyDiagnostics.goalClusters.length > 0, true,
      "报告 trace 必须按父子路径保留真实次级目标簇");
    assert.equal(policyDiagnostics.goalClusters.every((cluster) => (
      cluster.depth === cluster.path.length
      && cluster.parentPath.length + 1 === cluster.path.length
      && cluster.completedTransitionCount >= cluster.survivingCompletionCount
      && cluster.routeVariants.every((route) => (
        route.completedTransitionCount >= route.survivingCompletionCount
        && route.actions.every((action) => !Object.hasOwn(action, "actionId"))
      ))
    )), true, "目标簇必须保留层级、最终路线与无 identity 的人类摘要");
    assert.equal(policyDiagnostics.opponentExecutedNodeCount, 0,
      "单席位规划不得执行、PASS 或解析任何对手行动");
    assert.equal(policyDiagnostics.focalPlanningTurnAdvanceCount > 0, true,
      "白色 end_turn 后必须由 planner-only 时钟直接进入白色下一行动");
    assert.deepEqual(
      Object.keys(policyDiagnostics.executedNodeCountByActor || {}),
      [actions[0].actorId],
      "固定盘面全部物理执行节点必须只属于当前白色席位",
    );
    assert.equal(
      policyDiagnostics.executedNodeCountByDecisionKind?.["choose_card:pass-reserve-card"] || 0,
      0,
      "PASS 前规划不得选择或读取尚未向白色公开的 PASS 预留牌",
    );
    assert.equal(policyDiagnostics.targetSchedulerPrunedCount > 0, true,
      "后续目标必须由资源下界调度，而不是重新展开全部目标排列");
    assert.equal(Number.isSafeInteger(policyDiagnostics.unreachableRouteOriginCount), true);
    assert.equal(policyDiagnostics.executedNodeCountByFamily.choose_payment > 1, true,
      "非等价支付 Decision 必须继续逐项执行，不能固定选择一个 conditional");
    const quickTradeOutcomes = policyResult.actionOutcomes.filter((outcome) => (
      actions.find((action) => action.actionId === outcome.actionId)?.family === "quick_trade"
    ));
    assert.equal(quickTradeOutcomes.length > 0, true,
      "固定盘面必须覆盖可执行快速交易");
    assert.equal(quickTradeOutcomes.every((outcome) => (
      outcome.code === "STRATEGIC_GOAL_NOT_EVALUATED"
    )), true, "快速转换只能在已选结果目标内部执行，不能成为独立搜索根");
    const unboundPlayCardOutcomes = policyResult.actionOutcomes.filter((outcome) => (
      actions.find((action) => action.actionId === outcome.actionId)?.family === "play_card"
      && outcome.code === "STRATEGIC_GOAL_NOT_EVALUATED"
    ));
    // f04870e：play_card 有界评估（boundedActions，maxDepth 6/maxLeaves 3）覆盖未进
    // 路由目标调度的打牌——无目的打牌不再 NOT_EVALUATED，而是获得有界评估结果，
    // 让打牌直接价值（分数/资源/抽牌/触发）进入策略视野。
    assert.equal(unboundPlayCardOutcomes.length, 0,
      "boundedActions 有界评估覆盖全部打牌，无目的打牌不再 NOT_EVALUATED");
    const strategicFamilies = new Set(["launch", "place_data", "scan"]);
    const strategicOutcomes = policyResult.actionOutcomes.filter((outcome) => (
      strategicFamilies.has(actions.find((action) => action.actionId === outcome.actionId)?.family)
      || (
        actions.find((action) => action.actionId === outcome.actionId)?.family === "play_card"
        && outcome.code !== "STRATEGIC_GOAL_NOT_EVALUATED"
      )
    ));
    assert.equal(strategicOutcomes.length > 0, true);
    // 正式结果目标根必须已结算（settled + 完整叶）或有预算内剪枝结果
    // （unresolved + COUNTERFACTUAL_SEARCH_PRUNED：scan 等展开深的行动在二级代理
    // 搜索下可能预算内到不了叶）；禁止 failed/无尝试的占位。
    assert.equal(strategicOutcomes.every((outcome) => (
      outcome.status === "settled"
      || (outcome.status === "unresolved" && outcome.code === "COUNTERFACTUAL_SEARCH_PRUNED")
    )), true, "正式结果目标根必须已结算或有预算内剪枝结果");
    assert.equal(strategicOutcomes.some((outcome) => (
      outcome.status === "settled" && outcome.code == null && outcome.leaves.length > 0
    )), true, "至少一个正式结果目标根产生完整叶");
    const controlOutcomes = policyResult.actionOutcomes.filter((outcome) => (
      ["pass", "end_turn"].includes(
        actions.find((action) => action.actionId === outcome.actionId)?.family,
      )
    ));
    assert.equal(controlOutcomes.length > 0, true, "固定盘面必须覆盖回合控制行动");
    assert.equal(controlOutcomes.every((outcome) => (
      outcome.code !== "STRATEGIC_GOAL_NOT_EVALUATED"
    )), true, "PASS/end_turn 必须执行真实后继，轮初收入语义不能成为跳过理由");
    const passOutcome = policyResult.actionOutcomes.find((outcome) => (
      actions.find((action) => action.actionId === outcome.actionId)?.family === "pass"
    ));
    assert.equal(passOutcome?.status, "settled",
      "根 PASS 必须在首个正式 Decision 边界形成完整叶");
    assert.equal(
      (passOutcome?.leaves || []).every((leaf) => (
        !(leaf.actionChain || []).some((actionId) => (
          String(actionId).startsWith("choose_card:")
        ))
        && (leaf.legalSuccessors || []).length === 0
      )),
      true,
      "根 PASS 估值不得暴露或提前提交随后才可见的预留牌选择",
    );
  } finally {
    environment.dispose();
  }
}

{
  const sandbox = createSimulationEnv();
  const actual = createSimulationEnv();
  try {
    sandbox.reset({ seed: "seti-104-official-v1", activePlayerCount: 4 });
    const { checkpoint, playerId } = createSaturnLandingCheckpoint(sandbox);
    actual.reset({ seed: "seti-104-official-v1", activePlayerCount: 4 });
    sandbox.loadCheckpoint(checkpoint);
    actual.loadCheckpoint(checkpoint);
    const landing = sandbox.legalActions().find((action) => (
      action.family === "land" && action.target?.planetId === "saturn"
    ));
    assert.ok(landing, "R1 T04 必须能枚举土星登陆");
    const before = sandbox.createCheckpoint();
    const outcome = sandbox.evaluateActionOutcomes([landing])[0];
    assert.equal(outcome.status, "settled");
    assert.equal(outcome.leaves.length, 2, "两个未揭示外星人槽位必须形成两个真实叶子");
    assert.equal(outcome.leaves.every((leaf) => leaf.actionChain.length === 2), true,
      "登陆叶必须包含 land -> 黄色痕迹 Decision 全链");
    const projectedLanding = outcomeModel.projectOutcomeObservations([outcome], {
      seatId: playerId,
      stateVersion: landing.stateVersion,
      decisionVersion: landing.decisionVersion,
    })[0];
    assert.equal(projectedLanding.leaves.every((leaf) => (
      leaf.observation.outcomeProjection.progress.probeRoute.candidate?.endpointKind === "land"
      && leaf.observation.outcomeProjection.progress.probeRoute.candidate?.nextActionId === landing.actionId
      && !Object.hasOwn(leaf, "routeCheckpoints")
    )), true, "探测器 projection 只保留固定摘要和标准 outcome 引用，不携带完整路线 checkpoint");
    const rootAssets = projectedLanding.rootObservation.outcomeProjection.assets;
    const yellowTraceAssetDeltas = projectedLanding.leaves.map((leaf) => {
      const assets = leaf.observation.outcomeProjection.assets;
      assert.equal(assets.ordinaryCards, rootAssets.ordinaryCards,
        "黄色痕迹奖励不得进入普通牌");
      return {
        alienCards: assets.alienCards - rootAssets.alienCards,
        publicity: assets.publicity - rootAssets.publicity,
      };
    });
    assert.equal(yellowTraceAssetDeltas.every(({ alienCards, publicity }) => (
      alienCards === 0 && (publicity === 0 || publicity === 1)
    )), true, "未揭示外星人的黄色痕迹不得获得物种外星人牌，首痕迹额外获得 1 宣传");
    assert.deepEqual(
      [...new Set(yellowTraceAssetDeltas.map(({ publicity }) => publicity))].sort(),
      [0, 1],
      "同根两个槽位必须分别证明首痕迹宣传奖励与追加痕迹无宣传",
    );
    assert.deepEqual(sandbox.createCheckpoint(), before, "土星候选评估不得污染 canonical root");

    const directLanding = actual.legalActions().find((action) => action.actionId === landing.actionId);
    assert.equal(actual.step(directLanding).ok, true);
    const traceChoices = actual.legalActions();
    assert.equal(traceChoices.length, 2);
    assert.equal(traceChoices.every((choice) => (
      choice.family === "choose_target"
      && choice.target?.kind === "planet-reward-alien-trace"
      && choice.target?.traceType === "yellow"
    )), true);
    const beforeTraceCommitted = JSON.parse(actual.createCheckpoint().coreState.committedState);
    const selectedTrace = traceChoices.find((choice) => (
      !beforeTraceCommitted.aliens.aliens[choice.target.alienSlotId]
        .traces.yellow.firstPlaced
    ));
    assert.ok(selectedTrace, "土星黄色痕迹必须存在尚未放置首标的标准目标");
    const beforeTrace = outcomeModel.createDecisionObservation(
      actual.observe(playerId),
      {
        seatId: playerId,
        stateVersion: selectedTrace.stateVersion,
        decisionVersion: selectedTrace.decisionVersion,
      },
    );
    assert.equal(actual.step(selectedTrace).ok, true);
    const matchingLeaf = projectedLanding.leaves.find((leaf) => (
      leaf.actionChain.at(-1) === selectedTrace.actionId
    ));
    assert.ok(matchingLeaf, "直接标准 Decision 必须存在对应反事实叶");
    const directObservation = outcomeModel.createDecisionObservation(
      actual.observe(playerId),
      {
        seatId: playerId,
        stateVersion: selectedTrace.stateVersion,
        decisionVersion: selectedTrace.decisionVersion,
      },
    );
    assert.deepEqual(
      directObservation.outcomeProjection.scoring,
      matchingLeaf.observation.outcomeProjection.scoring,
      "直接标准执行与反事实叶的分数字段必须一致",
    );
    assert.deepEqual(
      directObservation.outcomeProjection.assets,
      matchingLeaf.observation.outcomeProjection.assets,
      "直接标准执行与反事实叶的资源/牌型字段必须一致",
    );
    const expectedTraceScore = Number(selectedTrace.target.alienSlotId) === 1 ? 5 : 3;
    assert.equal(
      directObservation.outcomeProjection.scoring.realizedScore
        - beforeTrace.outcomeProjection.scoring.realizedScore,
      expectedTraceScore,
      "未揭示外星人的首痕迹必须结算槽位基础分",
    );
    assert.equal(
      directObservation.outcomeProjection.assets.publicity
        - beforeTrace.outcomeProjection.assets.publicity,
      1,
      "首痕迹必须结算 1 宣传",
    );
    assert.equal(
      directObservation.outcomeProjection.assets.alienCards
        - beforeTrace.outcomeProjection.assets.alienCards,
      0,
      "未揭示外星人的黄色首痕迹不得提前获得物种外星人牌",
    );
    const committed = JSON.parse(actual.createCheckpoint().coreState.committedState);
    assert.equal(committed.aliens.aliens[selectedTrace.target.alienSlotId].traces.yellow.firstPlaced, true);
  } finally {
    sandbox.dispose();
    actual.dispose();
  }
}

{
  const environment = createSimulationEnv();
  try {
    environment.reset({ seed: "seti-104-official-v1", activePlayerCount: 4 });
    const { checkpoint, playerId } = createSaturnApproachCheckpoint(environment);
    environment.loadCheckpoint(checkpoint);
    const move = environment.legalActions().find((action) => (
      action.family === "move" && action.target?.deltaX === -1 && action.target?.deltaY === 0
    ));
    assert.ok(move, "土星相邻格必须能枚举标准移动");
    const publicityBefore = environment.observe(playerId).publicState.players
      .find((candidate) => candidate.playerId === playerId).publicity;
    assert.equal(environment.step(move).ok, true);
    const payment = environment.legalActions().find((action) => action.family === "choose_payment");
    assert.ok(payment, "标准移动必须继续进入支付 Decision");
    const paymentResult = environment.step(payment);
    assert.equal(paymentResult.ok, true, JSON.stringify(paymentResult.failure || paymentResult));
    const player = environment.observe(playerId).publicState.players
      .find((candidate) => candidate.playerId === playerId);
    assert.equal(player.publicity, publicityBefore + 1,
      "沿途经过非地球行星的宣传必须来自 production moveProbe 到达奖励");
  } finally {
    environment.dispose();
  }
}

{
  const sandbox = createSimulationEnv();
  try {
    sandbox.reset({ seed: "seti-mars-orbit-counterfactual", activePlayerCount: 4 });
    const { checkpoint } = createMarsOrbitCheckpoint(sandbox);
    sandbox.loadCheckpoint(checkpoint);
    const orbit = sandbox.legalActions().find((action) => (
      action.family === "orbit" && action.target?.planetId === "mars"
    ));
    assert.ok(orbit, "火星环绕必须存在合法标准行动");
    const outcome = sandbox.evaluateActionOutcomes([orbit], {
      maxDepth: 15,
      maxLeaves: 64,
    })[0];
    assert.equal(outcome.status, "settled",
      "火星环绕的选牌、扫描与插收入 DecisionEffect 全链必须能在反事实分支正常结算");
    assert.equal(outcome.leaves.length > 0, true);
    const routeOutcome = sandbox.evaluateActionOutcomes([orbit], {
      maxDepth: 15,
      maxLeaves: 8,
      maxNodes: 56,
      secondaryAgentSearch: true,
      maxProxyDepth: 15,
    })[0];
    assert.equal(routeOutcome.status, "settled");
    assert.equal(
      routeOutcome.rootObservation.dataAnalyzeRequirements?.schemaVersion,
      "seti-data-analyze-requirements-v2",
      "Production observation 必须投影本席正式数据分析 requirement",
    );
    assert.equal(routeOutcome.leaves.some((leaf) => (
      leaf.rootRouteTargetId === "orbit:mars:planet:"
    )), true, "首个真实动作执行前必须已经选择火星环绕目标");
    assert.equal(routeOutcome.leaves.some((leaf) => (
      Number(leaf.secondaryAgentDepth || 0) > 1
      || leaf.actionChain.some((actionId) => String(actionId).startsWith("end_turn:"))
    )), true, "取得环绕收益后必须继续搜索后续次级代理，不能把一级目标当作路线终点");
  } finally {
    sandbox.dispose();
  }
}

console.log("simulation counterfactual outcome tests passed");

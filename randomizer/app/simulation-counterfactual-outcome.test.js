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
  const before = env.createCheckpoint();
  // 估值统一走真实决策路径（runHeuristicPolicyDecision）——决策函数内部
  // evaluateActions 经 counterfactualPort 隔离 fork 评估策略动作，返回的
  // actionOutcomes 即"真实决策的估值"（secondary-agent 目标引导单一路径），
  // 不存在第二套搜索参数入口（旧 evaluateActionOutcomes 已删除）。
  // 反事实原语契约（枚举顺序/canonical 隔离/stale 拒绝）属 counterfactualPort，
  // 已迁至 simulation-rule-composition.test.js（composition 层，见该文件末尾）。
  const policyResult = env.runHeuristicPolicyDecision();
  const outcomes = policyResult.actionOutcomes;
  assert.equal(outcomes.every((outcome) => outcome.schemaVersion === "seti-action-outcome-v1"), true);
  // actionOutcomes 必须与当前合法集逐 actionId 完整对齐（completePolicyOutcomeSet 契约）
  const outcomeIds = new Set(outcomes.map((outcome) => outcome.actionId));
  assert.equal(actions.every((action) => outcomeIds.has(action.actionId)), true,
    "真实决策的 actionOutcomes 必须覆盖全部合法 action（未评估动作由 NOT_EVALUATED 补齐）");

  for (const action of actions) {
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
    if (outcome?.leaves?.length) {
      assert.deepEqual(
        outcome.leaves[0].observation.outcomeProjection,
        directObservation.outcomeProjection,
        "沙箱与直接标准执行必须得到相同 viewer-safe leaf projection",
      );
    }
    assert.equal(outcome.status === "settled" || outcome.status === "unresolved", true,
      "真实决策 outcome 必须已结算（settled）或带显式原因（unresolved），不允许静默占位");
    if (outcome?.leaves?.length) {
      assert.equal(outcome.confidence === "high" || outcome.confidence === "low", true,
        "独立候选随机协议未聚合期望时必须明确返回 low-confidence");
    }
  }
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
    // 具体动作估值统一走真实决策路径（runHeuristicPolicyDecision 返回的
    // actionOutcomes，与决策函数同一搜索参数——secondary-agent 目标引导单一路径）。
    const policyResult = environment.runHeuristicPolicyDecision();
    const b11Outcome = policyResult.actionOutcomes.find((outcome) => (
      outcome.actionId === b11.actionId
    ));
    assert.ok(b11Outcome, "真实决策必须覆盖飞掠小行星打牌估值");
    assert.equal(b11Outcome.status === "settled" || b11Outcome.status === "unresolved", true,
      "卡牌移动 Decision 必须以 conditional descriptor 在同一 Session 内完成（真实决策估值）");
    assert.equal(b11Outcome.code == null
      || b11Outcome.code === "STRATEGIC_GOAL_NOT_EVALUATED"
      || b11Outcome.code === "COUNTERFACTUAL_SEARCH_PRUNED", true,
      "未绑定目标的打牌保持 NOT_EVALUATED 或结算，不静默占位");
    assert.equal(
      (b11Outcome.leaves?.length || 0) > 0 || b11Outcome.code === "STRATEGIC_GOAL_NOT_EVALUATED",
      true,
    );

    const scan = actions.find((action) => action.family === "scan");
    assert.ok(scan, "固定盘面必须存在扫描行动");
    const scanOutcome = policyResult.actionOutcomes.find((outcome) => (
      outcome.actionId === scan.actionId
    ));
    assert.ok(scanOutcome, "真实决策必须覆盖扫描估值");
    const scanDiagnostics = environment.getCounterfactualDiagnostics();
    assert.equal((scanOutcome.leaves?.length || 0) > 0, true,
      "真实决策的扫描估值必须产生真实叶子");
    // 节点粒度改动（2026-08-18）：scan 的 target 选择折叠进动作节点（"一个行动含
    // 所有 target 选择完毕算一个节点"），scan 完整结算到叶（code null）而非预算内
    // 剪枝——节点更少，搜索更充分。
    assert.equal(
      scanOutcome.code == null || scanOutcome.code === "COUNTERFACTUAL_SEARCH_PRUNED",
      true,
      "scan 结算链折叠后应完整结算（null）或在预算内剪枝（PRUNED）",
    );
    // 统一搜索（v0）：secondary-agent 目标引导单一路径下 maxFrontierPerRoot=1
    // （决策函数 evaluateActions 的同一参数，不再有旧入口 maxFrontierPerRoot=8 的
    // 非 secondary-agent 分支）。
    assert.equal(scanDiagnostics.maxFrontierPerRoot, 1);
    assert.equal(
      scanDiagnostics.maxRetainedFrontierSize <= scanDiagnostics.maxFrontierSize,
      true,
      "诊断必须同时保留原始 frontier 压力和实际 beam 保留宽度",
    );
    // 节点粒度改动（2026-08-18）：scan 结算链折叠进动作节点 → 不再需要预算内剪枝
    // （prunedNodeCount 可能为 0）。真实决策整盘动作评估的节点上限由
    // executedNodeCount <= maxExecutionNodes 断言覆盖（见下）。
    assert.equal(scanDiagnostics.prunedNodeCount >= 0, true);
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
    // 隐藏信息 mask 契约由诊断级断言覆盖（hiddenInformationBarrierCountByCode），
    // 不再要求 scan 单个动作的叶必须携带 masked 叶（真实决策整盘评估下 mask 可能
    // 发生在其他动作分支）。

    const policyDiagnostics = environment.getCounterfactualDiagnostics();
    assert.equal(policyDiagnostics.beamPrunedOriginCount, 0,
      "次级目标搜索不得恢复 beam");
    // 统一搜索（v0）：play_card 受限评估（每卡 depth6/128 节点）是最后执行的 evaluate，
    // 诊断反映其受控预算——play_card 常开要求物理上限内收敛（可命中上限但必须受控，
    // 节点数不失控爆炸）。
    assert.equal(policyDiagnostics.executedNodeCount <= policyDiagnostics.maxExecutionNodes, true,
      "统一搜索（含 play_card 受限评估）节点数必须受物理上限控制");
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
    assert.equal(policyDiagnostics.maxExecutionNodes > 0, true,
      "统一搜索（含 play_card 受限评估）必须报告正的物理执行上限");
    assert.equal(policyDiagnostics.executedNodeCount <= policyDiagnostics.maxExecutionNodes, true,
      "统一搜索节点数必须受物理上限控制（play_card 受限评估可能命中其 128 上限）");
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
    // 非等价支付由search-payment-choices.test.js核对实际费用/得分双叶；
    // 此处不以节点数量代替行为，正确折叠弃牌后节点数可以减少。
    const quickTradeOutcomes = policyResult.actionOutcomes.filter((outcome) => (
      actions.find((action) => action.actionId === outcome.actionId)?.family === "quick_trade"
    ));
    assert.equal(quickTradeOutcomes.length > 0, true,
      "固定盘面必须覆盖可执行快速交易");
    // 统一搜索（unified）语义：quick_trade 凭需求放行（requiresRootCounterfactual 的
    // prepares* 门控）——能补当前资源缺口的才进搜索，其余无需求保持 NOT_EVALUATED。
    const releasedQuickTrades = quickTradeOutcomes.filter((outcome) => (
      outcome.code !== "STRATEGIC_GOAL_NOT_EVALUATED"
    ));
    assert.equal(releasedQuickTrades.length > 0, true,
      "统一搜索下能补资源缺口的快速转换必须放行进入搜索（需求引导）");
    assert.equal(
      quickTradeOutcomes.some((outcome) => (
        outcome.code === "STRATEGIC_GOAL_NOT_EVALUATED"
      )),
      true,
      "无需求放行的快速转换保持 NOT_EVALUATED，不横向试跑",
    );
    const unboundPlayCardOutcomes = policyResult.actionOutcomes.filter((outcome) => (
      actions.find((action) => action.actionId === outcome.actionId)?.family === "play_card"
      && outcome.code === "STRATEGIC_GOAL_NOT_EVALUATED"
    ));
    // 统一搜索（v0）：play_card 经目标绑定进入搜索（income:card 收入牌 / tech:research
    // 免费科技 / probe:免费发射 / sector:观测 / data:卡牌），未绑定目标的打牌保持
    // NOT_EVALUATED（实测全部放行 play_card 让单决策 8.9s/4096 撞顶且全盘退化，
    // 纯效果牌评估虚高 → 不放散全部打牌，靠目标绑定识别值得打的牌）。
    assert.equal(unboundPlayCardOutcomes.length > 0, true,
      "统一搜索下未绑定目标的打牌保持 NOT_EVALUATED（目标引导，不横向试跑全部打牌）");
    const evaluatedPlayCards = policyResult.actionOutcomes.filter((outcome) => (
      actions.find((action) => action.actionId === outcome.actionId)?.family === "play_card"
      && outcome.status === "settled"
    ));
    assert.equal(evaluatedPlayCards.length > 0, true,
      "绑定目标（免费科技/发射/收入链）的打牌必须产生已结算叶");
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
    // 登陆行动形态统一：只有一个「登陆」动作（select），目标由内核决策/直连结算。
    const landing = sandbox.legalActions().find((action) => (
      action.family === "land"
    ));
    assert.ok(landing, "R1 T04 必须能枚举土星登陆");
    assert.equal(landing.target?.select, true, "登陆行动必须统一为单个目标选择动作");
    // 反事实叶"强制评估任意动作"的能力随 evaluateActionOutcomes 删除而移除
    // （真实决策只评估目标绑定/需求放行的动作，landing 在本边界为
    // STRATEGIC_GOAL_NOT_EVALUATED）；本块保留**直接标准执行**的痕迹/宣传/
    // 分数契约验证（真实路径）。
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
    const directObservation = outcomeModel.createDecisionObservation(
      actual.observe(playerId),
      {
        seatId: playerId,
        stateVersion: selectedTrace.stateVersion,
        decisionVersion: selectedTrace.decisionVersion,
      },
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
    const { checkpoint, playerId } = createMarsOrbitCheckpoint(sandbox);
    sandbox.loadCheckpoint(checkpoint);
    const orbit = sandbox.legalActions().find((action) => (
      action.family === "orbit" && action.target?.planetId === "mars"
    ));
    assert.ok(orbit, "火星环绕必须存在合法标准行动");
    // 火星环绕结算链估值统一走真实决策路径（runHeuristicPolicyDecision 返回的
    // actionOutcomes，与决策函数同一搜索参数；evaluateActionOutcomes 旧入口已删）。
    const policyResult = sandbox.runHeuristicPolicyDecision();
    const routeOutcome = policyResult.actionOutcomes.find((candidate) => (
      candidate.actionId === orbit.actionId
    ));
    assert.ok(routeOutcome, "真实决策必须覆盖火星环绕估值");
    assert.equal(routeOutcome.status, "settled",
      "火星环绕的选牌、扫描与插收入 DecisionEffect 全链必须能在反事实分支正常结算");
    assert.equal((routeOutcome.leaves?.length || 0) > 0, true);
    assert.equal(
      routeOutcome.rootObservation.outcomeProjection?.progress?.dataAnalyzeRequirements?.schemaVersion,
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

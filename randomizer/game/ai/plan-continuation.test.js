"use strict";

const assert = require("node:assert/strict");
const planContinuation = require("./plan-continuation");

// ---------------------------------------------------------------------------
// 最小观测 fixture：只含诊断读取的路径（board 结构事实 + progress 目录）。
// ---------------------------------------------------------------------------

function makeObservation(options = {}) {
  const rotation = options.rotation ?? 0;
  const planets = options.planets ?? {};
  const aliens = options.aliens ?? {};
  const credits = options.credits ?? 5;
  const movementSteps = options.movementSteps ?? 2;
  const sectorSettlements = options.sectorSettlements ?? {};
  const probeGap = { credits: options.gapCredits ?? 1, energy: 0, movementSteps };
  return {
    publicState: {
      board: {
        solarSystem: {
          rotation: {
            wheel1Steps: rotation,
            wheel2Steps: 0,
            wheel3Steps: 0,
            wheel4Steps: 0,
            rotationCount: rotation ? 1 : 0,
          },
        },
        planets,
        aliens,
        data: { sectorSettlements },
        techSupply: { stacks: [] },
        publicCards: options.publicCards ?? [],
        rockets: [
          { id: "r1", playerId: "player-white", surface: "solar-board", sectorX: 1, sectorY: 1 },
          { id: "r2", playerId: "player-blue", surface: "solar-board", sectorX: 3, sectorY: 2 },
        ],
      },
    },
    outcomeProjection: {
      progress: {
        probeGoalRequirements: {
          candidates: [{
            requirementId: "c1",
            targetId: "orbit:mars",
            targetBenefit: { score: 5, grossEquivalentValue: 7 },
            gap: probeGap,
            nextStep: { family: "move", rocketId: "r1" },
          }],
        },
        dataAnalyzeRequirements: { eligible: true, computerPlacedCount: 4, nextGap: { credits: 2, energy: 1 } },
        sectorWinRequirements: { standardScanCost: { credits: 1, energy: 2 }, wins: [] },
        incomeGainRequirements: { plans: [{ planId: "p1", kind: "data", nextCost: { credits: 1, energy: 0 } }] },
        techGainRequirements: { candidates: [{ tileId: "blue1", cost: { credits: 6, energy: 0 } }] },
        ownedTechIds: [],
        dataProgress: { computerPlacedCount: 0, analyzeReady: false, blueBonusCount: 0 },
        traceCount: 0,
      },
    },
    assets: { credits, energy: 3 },
  };
}

function descriptor(family, target = {}, payload = {}, actionId = `${family}:${Math.random()}`) {
  return { actionId, family, target, payload, phase: "main", actorPlayerId: "player-white" };
}

// ---------------------------------------------------------------------------
// actionSemanticKey：确定性 + 语义敏感
// ---------------------------------------------------------------------------

{
  const moveA = descriptor("move", { rocketId: "r1", deltaX: 1, deltaY: 0 });
  const moveB = descriptor("move", { rocketId: "r1", deltaX: 1, deltaY: 0 });
  const moveC = descriptor("move", { rocketId: "r1", deltaX: 0, deltaY: 1 });
  assert.equal(
    planContinuation.actionSemanticKey(moveA),
    planContinuation.actionSemanticKey(moveB),
    "同一语义 action（仅 actionId 不同）必须产生相同语义键",
  );
  assert.notEqual(
    planContinuation.actionSemanticKey(moveA),
    planContinuation.actionSemanticKey(moveC),
    "目标不同（delta 不同）必须产生不同语义键",
  );
  assert.equal(
    planContinuation.actionSemanticKey(null),
    planContinuation.actionSemanticKey(undefined),
    "空 action 必须稳定序列化",
  );
}

// ---------------------------------------------------------------------------
// stripResourceFields：剥离资源缺口，保留目标/收益/拓扑字段，不修改输入
// ---------------------------------------------------------------------------

{
  const input = {
    candidates: [{
      targetId: "orbit:mars",
      targetBenefit: { score: 5, grossEquivalentValue: 7 },
      gap: { credits: 1, energy: 0, movementSteps: 2 },
      nextCost: { credits: 3, energy: 1 },
    }],
    standardScanCost: { credits: 1, energy: 2 },
  };
  const frozen = structuredClone(input);
  const stripped = planContinuation.stripResourceFields(input);
  assert.equal(stripped.candidates[0].targetId, "orbit:mars", "目标 identity 必须保留");
  assert.equal(stripped.candidates[0].targetBenefit.score, 5, "目标收益必须保留");
  assert.equal(stripped.candidates[0].gap.movementSteps, 2, "拓扑字段 movementSteps 必须保留");
  assert.equal(stripped.candidates[0].gap.credits, undefined, "gap 内资源字段必须剥离");
  assert.equal(stripped.candidates[0].gap.energy, undefined, "gap 内资源字段必须剥离");
  assert.equal(stripped.candidates[0].nextCost, undefined, "nextCost 整体必须剥离");
  assert.equal(stripped.standardScanCost, undefined, "standardScanCost 整体必须剥离");
  assert.deepEqual(input, frozen, "strip 不得修改输入");
}

// ---------------------------------------------------------------------------
// directoryFingerprint：只对「搜索读到的外部结构事实」敏感
// ---------------------------------------------------------------------------

{
  const base = makeObservation();
  const same = makeObservation({ credits: 99 });
  const rotated = makeObservation({ rotation: 2 });
  const slotTaken = makeObservation({ planets: { mars: { orbitMarkers: [{ playerId: "p2" }] } } });
  const alienRevealed = makeObservation({ aliens: { slots: [{ revealed: true }] } });
  const gapShifted = makeObservation({ gapCredits: 9 });
  const topologyShifted = makeObservation({ movementSteps: 5 });
  const sectorSettled = makeObservation({ sectorSettlements: { sectors: { "sector-1-a": { settlementCount: 1 } } } });
  const cardsChanged = makeObservation({ publicCards: [{ cardId: "b_117" }] });

  const baseFingerprint = planContinuation.directoryFingerprint(base);
  assert.equal(
    planContinuation.directoryFingerprint(same),
    baseFingerprint,
    "本席资源变化（计划内）不得改变目录指纹",
  );
  assert.equal(
    planContinuation.directoryFingerprint(gapShifted),
    baseFingerprint,
    "资源缺口变化（计划内）不得改变目录指纹",
  );

  // 顺序无关：同一候选集合不同枚举顺序必须同指纹（cheap vs full 投影排序差异）
  const reordered = makeObservation();
  reordered.outcomeProjection.progress.probeGoalRequirements.candidates.reverse();
  assert.equal(
    planContinuation.directoryFingerprint(reordered),
    baseFingerprint,
    "目录候选枚举顺序不得改变指纹",
  );
  assert.notEqual(
    planContinuation.directoryFingerprint(rotated),
    baseFingerprint,
    "太阳系旋转必须改变目录指纹（旋转后必须重规划路线）",
  );
  assert.notEqual(
    planContinuation.directoryFingerprint(slotTaken),
    baseFingerprint,
    "行星第一奖励格被占必须改变目录指纹",
  );
  assert.notEqual(
    planContinuation.directoryFingerprint(alienRevealed),
    baseFingerprint,
    "alien 槽揭示必须改变目录指纹",
  );
  assert.notEqual(
    planContinuation.directoryFingerprint(topologyShifted),
    baseFingerprint,
    "移动步数（拓扑）变化必须改变目录指纹",
  );
  assert.notEqual(
    planContinuation.directoryFingerprint(sectorSettled),
    baseFingerprint,
    "扇区结算状态变化必须改变目录指纹",
  );
  assert.notEqual(
    planContinuation.directoryFingerprint(cardsChanged),
    baseFingerprint,
    "公共牌变化必须改变目录指纹",
  );

  // 火箭占位开关：默认不含，includeRockets 时含
  const rocketsMoved = makeObservation();
  rocketsMoved.publicState.board.rockets[1] = { ...rocketsMoved.publicState.board.rockets[1], sectorX: 5 };
  assert.equal(
    planContinuation.directoryFingerprint(rocketsMoved),
    baseFingerprint,
    "默认指纹不含火箭占位（本席移动是计划内变化）",
  );
  assert.notEqual(
    planContinuation.directoryFingerprint(rocketsMoved, { includeRockets: true }),
    planContinuation.directoryFingerprint(base, { includeRockets: true }),
    "includeRockets 时火箭占位变化必须改变指纹",
  );
}

// ---------------------------------------------------------------------------
// planContinuationFromWinningLeaf：下一步 = chain[1]，descriptor 从
// rootActionSettledLegalSuccessors 解析
// ---------------------------------------------------------------------------

{
  const nextDescriptor = descriptor("move", { rocketId: "r1", deltaX: 1, deltaY: 0 }, {}, "move:a");
  const leafWithContinuation = {
    actionChain: ["launch:p1:1", "move:a", "orbit:p1:mars"],
    rootActionSettledLegalSuccessors: [nextDescriptor, descriptor("pass")],
    rootActionSettledObservation: makeObservation({ rotation: 1 }),
    rootActionObservation: makeObservation(),
  };
  const plan = planContinuation.planContinuationFromWinningLeaf(leafWithContinuation);
  assert.equal(plan.hasContinuation, true, "chain >= 2 必须给出延续计划");
  assert.equal(plan.nextActionId, "move:a", "下一步 actionId 必须是 chain[1]");
  assert.equal(plan.nextStepFamily, "move", "下一步 family 从 descriptor 解析");
  assert.equal(
    plan.nextStepKey,
    planContinuation.actionSemanticKey(nextDescriptor),
    "下一步语义键必须与合法 descriptor 对齐",
  );
  assert.ok(plan.planAssumedObservation, "必须携带根行动后的计划假设观测");

  const noContinuation = planContinuation.planContinuationFromWinningLeaf({
    actionChain: ["pass:p1:3"],
    rootActionSettledLegalSuccessors: [],
  });
  assert.equal(noContinuation.hasContinuation, false, "chain < 2 必须没有延续");

  const missingDescriptor = planContinuation.planContinuationFromWinningLeaf({
    actionChain: ["launch:p1:1", "move:zz"],
    rootActionSettledLegalSuccessors: [],
  });
  assert.equal(missingDescriptor.hasContinuation, true, "descriptor 缺失仍要保留延续");
  assert.equal(missingDescriptor.nextStepKey, "id:move:zz", "descriptor 缺失时退回 actionId 键");

  // conditional 后继：根行动后 composition 在等 conditional 决策，后继在
  // rootActionLegalSuccessors（rootActionSettledLegalSuccessors 为空）
  const conditionalChoice = descriptor("choose_target", { choiceId: "data:computer" }, {}, "choose_target:c1");
  const conditionalLeaf = {
    actionChain: ["play_card:b1", "choose_target:c1", "place_data:d1"],
    rootActionLegalSuccessors: [conditionalChoice],
    rootActionSettledLegalSuccessors: [],
    rootActionObservation: makeObservation(),
  };
  const conditionalPlan = planContinuation.planContinuationFromWinningLeaf(conditionalLeaf);
  assert.equal(
    conditionalPlan.nextStepKey,
    planContinuation.actionSemanticKey(conditionalChoice),
    "conditional 后继必须从 rootActionLegalSuccessors 解析出语义键",
  );
}

// ---------------------------------------------------------------------------
// pairContinuation：actualHit 语义比较 + 便宜预测器
// ---------------------------------------------------------------------------

{
  const nextDescriptor = descriptor("move", { rocketId: "r1", deltaX: 1, deltaY: 0 }, {}, "move:a");
  const previous = {
    plan: {
      hasContinuation: true,
      nextActionId: "move:a",
      nextStepFamily: "move",
      nextStepKey: planContinuation.actionSemanticKey(nextDescriptor),
      planAssumedObservation: makeObservation({ rotation: 1 }),
    },
    margin: 12,
    directoryFingerprint: planContinuation.directoryFingerprint(makeObservation({ rotation: 1 })),
    directoryFingerprintWithRockets: planContinuation.directoryFingerprint(
      makeObservation({ rotation: 1 }),
      { includeRockets: true },
    ),
    facts: planContinuation.directoryFactsSnapshot(makeObservation({ rotation: 1 })),
    planAssumedFacts: planContinuation.directoryFactsSnapshot(makeObservation({ rotation: 1 })),
  };
  const currentSame = {
    actionKey: planContinuation.actionSemanticKey(nextDescriptor),
    family: "move",
    legalActionKeys: [planContinuation.actionSemanticKey(nextDescriptor)],
    legalActionIds: ["move:a"],
    directoryFingerprint: planContinuation.directoryFingerprint(makeObservation({ rotation: 1 })),
    directoryFingerprintWithRockets: planContinuation.directoryFingerprint(
      makeObservation({ rotation: 1 }),
      { includeRockets: true },
    ),
    facts: planContinuation.directoryFactsSnapshot(makeObservation({ rotation: 1 })),
  };
  const hit = planContinuation.pairContinuation(previous, currentSame);
  assert.equal(hit.applicable, true);
  assert.equal(hit.actualHit, true, "计划下一步 == 实际选择必须命中");
  assert.equal(hit.stepLegal, true);
  assert.deepEqual(hit.reasons, [], "命中不得有失效原因");

  const currentDiverged = {
    ...currentSame,
    actionKey: planContinuation.actionSemanticKey(descriptor("move", { rocketId: "r1", deltaX: 2, deltaY: 0 })),
    directoryFingerprint: planContinuation.directoryFingerprint(makeObservation({ rotation: 2 })),
    directoryFingerprintWithRockets: planContinuation.directoryFingerprint(
      makeObservation({ rotation: 2 }),
      { includeRockets: true },
    ),
    facts: planContinuation.directoryFactsSnapshot(makeObservation({ rotation: 2 })),
  };
  const miss = planContinuation.pairContinuation(previous, currentDiverged);
  assert.equal(miss.actualHit, false, "旋转后搜索改选必须未命中");
  assert.equal(miss.directorySame, false, "旋转必须令 directorySame 失效");
  assert.ok(miss.reasons.includes("directory-changed"), "必须报告 directory-changed");
  assert.ok(miss.changed.includes("board.rotation"), "事实变化必须点名 rotation");

  const notApplicable = planContinuation.pairContinuation(
    { plan: { hasContinuation: false } },
    currentSame,
  );
  assert.equal(notApplicable.applicable, false, "无延续计划不得配对");
}

// ---------------------------------------------------------------------------
// planReuseCheck：simulation 侧复用判定（下一步合法 + 揭示基线 + 依赖环节未变）
// ---------------------------------------------------------------------------

{
  const nextActionId = "move:b";
  const nextDescriptor = descriptor("move", { rocketId: "r1", deltaX: 1, deltaY: 0 }, {}, nextActionId);
  // 依赖：探测路线计划，终点 land:mars，移动 2 步（fixture 候选无 firstRewardSlotOpen → null）
  const routeDependency = {
    kind: "route",
    endpointTargetId: "land:mars:planet:",
    present: true,
    movementSteps: 2,
    firstRewardSlotOpen: null,
  };
  const plan = {
    nextActionId,
    continuation: ["move:b", "orbit:c"],
    dependency: routeDependency,
    revealedCount: 0,
  };

  const noPlan = planContinuation.planReuseCheck(null, makeObservation(), [nextDescriptor]);
  assert.equal(noPlan.hit, false);
  assert.equal(noPlan.reason, "no-plan");

  const noStep = planContinuation.planReuseCheck(
    { ...plan, nextActionId: "move:zz" },
    makeObservation(),
    [nextDescriptor],
  );
  assert.equal(noStep.hit, false, "下一步不在当前合法集必须重新决策");
  assert.equal(noStep.reason, "step-not-legal");

  const noBaseline = planContinuation.planReuseCheck(
    { ...plan, revealedCount: null },
    makeObservation(),
    [nextDescriptor],
  );
  assert.equal(noBaseline.hit, false, "无揭示基线必须保守重新决策");
  assert.equal(noBaseline.reason, "no-reveal-count");

  // tier1/2：依赖环节未变 → 直接复用（盘面无变化，或变化不影响计划执行）
  const unchanged = makeObservation();
  unchanged.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "land:mars:planet:";
  unchanged.outcomeProjection.progress.probeGoalRequirements.candidates[0].requirementId = "land:mars:planet:";
  const hit = planContinuation.planReuseCheck(plan, unchanged, [nextDescriptor]);
  assert.equal(hit.hit, true, "路线移动步数与槽位未变必须复用");
  assert.equal(hit.action.actionId, nextActionId, "命中必须返回当前合法集内的 descriptor");
  assert.equal(hit.nextPlan.nextActionId, "orbit:c", "复用后计划必须前进一步（多步消费）");
  assert.deepEqual(hit.nextPlan.continuation, ["orbit:c"], "前进后续接下一动作");

  // tier3：着陆需要的移动更多了 → 重新决策
  const moreMoves = makeObservation();
  moreMoves.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "land:mars:planet:";
  moreMoves.outcomeProjection.progress.probeGoalRequirements.candidates[0].requirementId = "land:mars:planet:";
  moreMoves.outcomeProjection.progress.probeGoalRequirements.candidates[0].gap.movementSteps = 5;
  const affected = planContinuation.planReuseCheck(plan, moreMoves, [nextDescriptor]);
  assert.equal(affected.hit, false, "目标移动步数增加必须重新决策");
  assert.equal(affected.reason, "next-step-affected");

  // tier3：第一奖励格被占 → 重新决策
  const slotTaken = makeObservation();
  slotTaken.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "land:mars:planet:";
  slotTaken.outcomeProjection.progress.probeGoalRequirements.candidates[0].requirementId = "land:mars:planet:";
  slotTaken.outcomeProjection.progress.probeGoalRequirements.candidates[0].firstRewardSlotOpen = false;
  const slotMiss = planContinuation.planReuseCheck(plan, slotTaken, [nextDescriptor]);
  assert.equal(slotMiss.hit, false, "第一奖励格被占必须重新决策");

  // tier3：计划跨出当前路线终点（下一步是另一路线的 land）→ 重新决策
  const otherRoutePlan = {
    nextActionId: "land:venus:x",
    continuation: ["land:venus:x"],
    dependency: routeDependency,
    revealedCount: 0,
  };
  const otherRoute = planContinuation.planReuseCheck(otherRoutePlan, unchanged, [
    descriptor("land", { planetId: "venus" }, {}, "land:venus:x"),
  ]);
  assert.equal(otherRoute.hit, false, "下一步目标 ≠ 计划路线终点必须重新决策");
  assert.equal(otherRoute.reason, "route-target-changed");

  // tier1/2：generic 依赖（对手火箭移动/打牌等不影响计划执行）→ 直接复用
  const genericPlan = { nextActionId, continuation: [], dependency: { kind: "generic" }, revealedCount: 0 };
  const genericHit = planContinuation.planReuseCheck(genericPlan, makeObservation({ rotation: 2 }), [nextDescriptor]);
  assert.equal(genericHit.hit, true, "generic 依赖（未识别为影响计划执行）必须复用");

  // 硬性特例：翻开了外星人 → 无论依赖环节如何都必须重新决策
  const revealed = makeObservation();
  revealed.publicState.board.aliens = { slots: [{ revealed: true }] };
  const revealedMiss = planContinuation.planReuseCheck(genericPlan, revealed, [nextDescriptor]);
  assert.equal(revealedMiss.hit, false, "翻开了外星人必须重新决策");
  assert.equal(revealedMiss.reason, "alien-revealed");
  assert.equal(revealedMiss.currentRevealedCount, 1, "必须报告实际揭示槽位数");

  // 揭示数未增加（还是 1 个）→ 不触发硬性特例
  const stillRevealed = planContinuation.planReuseCheck(
    { ...genericPlan, revealedCount: 1 },
    revealed,
    [nextDescriptor],
  );
  assert.equal(stillRevealed.hit, true, "揭示数未增加不触发特例");

  // 控制动作特例：下一步是 end_turn/pass → 无条件重新决策（主行动不能被
  // 计划复用跳过——实测 fast-path 同状态跳过 place_data 直接 end_turn）
  const endTurnPlan = {
    nextActionId: "end_turn:turn1",
    continuation: [],
    dependency: { kind: "generic" },
    revealedCount: 0,
  };
  const endTurnDescriptor = descriptor("end_turn", {}, {}, "end_turn:turn1");
  const endTurnMiss = planContinuation.planReuseCheck(
    endTurnPlan,
    makeObservation(),
    [endTurnDescriptor],
  );
  assert.equal(endTurnMiss.hit, false, "下一步是 end_turn 必须重新决策");
  assert.equal(endTurnMiss.reason, "control-step-redecide", "必须报告 control-step-redecide");

  const passPlan = {
    nextActionId: "pass:turn1",
    continuation: [],
    dependency: { kind: "generic" },
    revealedCount: 0,
  };
  const passDescriptor = descriptor("pass", {}, {}, "pass:turn1");
  const passMiss = planContinuation.planReuseCheck(passPlan, makeObservation(), [passDescriptor]);
  assert.equal(passMiss.hit, false, "下一步是 pass 必须重新决策");
  assert.equal(passMiss.reason, "control-step-redecide");
}

// ---------------------------------------------------------------------------
// buildPlanFromSnapshot / advancePlan：方案输出计划结构
// ---------------------------------------------------------------------------

{
  const snapshot = {
    plan: {
      hasContinuation: true,
      nextActionId: "move:b",
      continuation: ["move:b", "orbit:c"],
    },
    planDependency: { kind: "generic" },
    planAssumedRevealedCount: 0,
  };
  const built = planContinuation.buildPlanFromSnapshot(snapshot);
  assert.equal(built.nextActionId, "move:b");
  assert.deepEqual(built.continuation, ["move:b", "orbit:c"]);
  assert.equal(built.dependency.kind, "generic");
  assert.equal(built.revealedCount, 0);

  const advanced = planContinuation.advancePlan(built);
  assert.equal(advanced.nextActionId, "orbit:c", "前进后 nextActionId 续上链下一个");
  assert.deepEqual(advanced.continuation, ["orbit:c"]);

  const exhausted = planContinuation.advancePlan(advanced);
  assert.equal(exhausted.nextActionId, null, "链条耗尽后 nextActionId 为 null（store 清空）");

  assert.equal(planContinuation.buildPlanFromSnapshot({ plan: { hasContinuation: false } }), null, "无延续 → 无计划");
}

// ---------------------------------------------------------------------------
// planDependencyFromPlan / currentDependencyFromStore：形状一致才可比较
// ---------------------------------------------------------------------------

{
  const assumedObservation = makeObservation();
  assumedObservation.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "land:mars:planet:";
  assumedObservation.outcomeProjection.progress.probeGoalRequirements.candidates[0].requirementId = "land:mars:planet:";
  const leaf = {
    actionChain: ["place_data:x", "land:mars"],
    rootActionLegalSuccessors: [descriptor("land", { planetId: "mars" }, {}, "land:mars")],
    rootActionObservation: assumedObservation,
    observation: {
      outcomeProjection: {
        progress: {
          probeRoute: { candidate: { endpointTargetId: "land:mars:planet:", resourceGap: { movementSteps: 2 } } },
        },
      },
    },
  };
  const plan = planContinuation.planContinuationFromWinningLeaf(leaf);
  const assumed = planContinuation.planDependencyFromPlan(plan, leaf);
  assert.equal(assumed.kind, "route");
  assert.equal(assumed.movementSteps, 2);

  const store = { dependency: assumed };
  const current = makeObservation();
  current.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "land:mars:planet:";
  current.outcomeProjection.progress.probeGoalRequirements.candidates[0].requirementId = "land:mars:planet:";
  const recomputed = planContinuation.currentDependencyFromStore(store, current);
  assert.equal(
    planContinuation.stableHash(recomputed),
    planContinuation.stableHash(assumed),
    "同一状态的依赖重算必须与计划假设一致（形状对齐才能比较）",
  );
}

// ---------------------------------------------------------------------------
// planDependencyFromPlan：secondary-agent 叶无 probeRoute.candidate 时从
// rootRouteTargetId 补出路线依赖（P1：启发式主路径此前依赖恒 generic）
// ---------------------------------------------------------------------------

{
  // secondary-agent 搜索产物：无 candidate、带探测终点 rootRouteTargetId 的叶
  const assumedObservation = makeObservation();
  assumedObservation.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "land:mars:planet:";
  assumedObservation.outcomeProjection.progress.probeGoalRequirements.candidates[0].requirementId = "land:mars:planet:";
  const leaf = {
    actionChain: ["launch:x", "move:b", "land:mars"],
    rootRouteTargetId: "land:mars:planet:",
    rootRoutePlanId: "probe:c1",
    rootActionLegalSuccessors: [descriptor("move", { rocketId: "r1" }, {}, "move:b")],
    rootActionSettledObservation: assumedObservation,
    observation: {
      outcomeProjection: {
        progress: {
          probeRoute: { candidate: null }, // secondary-agent 叶的固定形状
        },
      },
    },
  };
  const plan = planContinuation.planContinuationFromWinningLeaf(leaf);
  const dependency = planContinuation.planDependencyFromPlan(plan, leaf);
  assert.equal(dependency.kind, "route", "secondary-agent 叶必须从 rootRouteTargetId 补出路线依赖");
  assert.equal(dependency.endpointTargetId, "land:mars:planet:", "依赖终点 = 叶绑定的路线终点");
  assert.equal(dependency.movementSteps, 2, "移动步数从假设观测的 requirement.gap 读取");
  assert.equal(dependency.present, true, "假设观测中终点仍存在");

  // 复用判定：同一状态 → 命中；移动变多 → tier-3 失效（此前永不触发）
  const planForReuse = {
    nextActionId: "move:b",
    continuation: ["move:b", "land:mars"],
    dependency,
    revealedCount: 0,
  };
  const moveDescriptor = descriptor("move", { rocketId: "r1" }, {}, "move:b");
  const same = makeObservation();
  same.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "land:mars:planet:";
  same.outcomeProjection.progress.probeGoalRequirements.candidates[0].requirementId = "land:mars:planet:";
  const hit = planContinuation.planReuseCheck(planForReuse, same, [moveDescriptor]);
  assert.equal(hit.hit, true, "依赖环节未变必须复用");
  assert.equal(hit.action.actionId, "move:b");

  const moved = makeObservation();
  moved.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "land:mars:planet:";
  moved.outcomeProjection.progress.probeGoalRequirements.candidates[0].requirementId = "land:mars:planet:";
  moved.outcomeProjection.progress.probeGoalRequirements.candidates[0].gap.movementSteps = 5;
  const miss = planContinuation.planReuseCheck(planForReuse, moved, [moveDescriptor]);
  assert.equal(miss.hit, false, "目标移动步数增加必须重新决策（tier-3 生效）");
  assert.equal(miss.reason, "next-step-affected", "必须报告 next-step-affected");
}

{
  // 非探测终点目标（data/sector/move）不得误判为路线依赖
  const leaf = {
    actionChain: ["place_data:x", "analyze:y"],
    rootRouteTargetId: "data:analyze",
    rootRoutePlanId: "data:analyze",
    rootActionSettledObservation: makeObservation(),
    observation: {
      outcomeProjection: { progress: { probeRoute: { candidate: null } } },
    },
  };
  const plan = planContinuation.planContinuationFromWinningLeaf(leaf);
  assert.equal(
    planContinuation.planDependencyFromPlan(plan, leaf).kind,
    "generic",
    "data:analyze 目标不是探测路线终点，必须保持 generic",
  );
}

{
  // candidate 存在时优先用 candidate（非 secondary 路径行为不变）
  const assumedObservation = makeObservation();
  assumedObservation.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "orbit:venus:planet:";
  assumedObservation.outcomeProjection.progress.probeGoalRequirements.candidates[0].requirementId = "orbit:venus:planet:";
  const leaf = {
    actionChain: ["launch:x", "orbit:venus"],
    rootRouteTargetId: "land:mars:planet:", // 与 candidate 不同：必须优先 candidate
    rootActionSettledObservation: assumedObservation,
    observation: {
      outcomeProjection: {
        progress: {
          probeRoute: {
            candidate: { endpointTargetId: "orbit:venus:planet:", resourceGap: { movementSteps: 1 } },
          },
        },
      },
    },
  };
  const plan = planContinuation.planContinuationFromWinningLeaf(leaf);
  const dependency = planContinuation.planDependencyFromPlan(plan, leaf);
  assert.equal(
    dependency.endpointTargetId,
    "orbit:venus:planet:",
    "candidate 存在时必须优先 candidate 终点",
  );
}

// ---------------------------------------------------------------------------
// aggregateStats：命中率 + 预测器 precision/recall + 原因分布
// ---------------------------------------------------------------------------

{
  const nextKey = planContinuation.actionSemanticKey(descriptor("move", { rocketId: "r1", deltaX: 1, deltaY: 0 }));
  const base = {
    stepLegal: true,
    directorySame: true,
    directorySameWithRockets: true,
    changed: [],
    reasons: [],
  };
  const hitPair = { ...base, applicable: true, actualHit: true };
  const falsePositive = { ...base, applicable: true, actualHit: false, reasons: ["plan-degraded-or-alternative-improved"] };
  const missPair = {
    ...base,
    applicable: true,
    actualHit: false,
    stepLegal: false,
    reasons: ["step-not-legal"],
    changed: ["board.rotation"],
  };
  const stats = planContinuation.aggregateStats([hitPair, falsePositive, missPair]);
  assert.equal(stats.applicableCount, 3);
  assert.equal(stats.hitCount, 1);
  assert.equal(stats.hitRate, 1 / 3, "命中率必须按实际命中/配对计数");
  assert.equal(stats.reasonCounts["step-not-legal"], 1, "未命中原因必须计数");
  assert.equal(stats.reasonCounts["plan-degraded-or-alternative-improved"], 1);
  assert.equal(stats.changedCounts["board.rotation"], 1, "事实变化分量必须计数");
  const stepLegal = stats.predictorStats.stepLegal;
  assert.equal(stepLegal.predicted, 2, "stepLegal 预测命中 2 个（hit + falsePositive）");
  assert.equal(stepLegal.precision, 0.5, "stepLegal precision = 1/2");
  assert.equal(stepLegal.recall, 1, "stepLegal recall = 全部实际命中都被预测");
  const all = stats.predictorStats["stepLegal+directory"];
  assert.equal(all.predicted, 2, "组合预测器也只预测 2 个");
  assert.equal(all.wrong, 1);
  const empty = planContinuation.aggregateStats([]);
  assert.equal(empty.applicableCount, 0);
  assert.equal(empty.hitRate, null);
}

process.stdout.write("plan-continuation.test.js ok\n");

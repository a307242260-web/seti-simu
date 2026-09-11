"use strict";

const assert = require("node:assert/strict");
const planContinuation = require("./plan-continuation");
const planetRewards = require("../actions/planet-rewards");

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
// 逐步计划：每步前置事实、跨目标切换、具名依赖与未知证据拒绝。
// ---------------------------------------------------------------------------

function planObservation() {
  const observation = makeObservation({
    planets: { planets: { mars: { orbitMarkers: [], landingMarkers: [], satelliteLandings: [] } } },
    aliens: { slots: [{ slotId: 1, revealed: false, traces: {
      blue: { firstPlaced: false, ownerPlayerColor: null },
    } }] },
  });
  observation.publicState.players = [{
    playerId: "player-white", dataProgress: { computerDataSlots: [0], blueBonusSlots: [] },
  }];
  Object.assign(observation.outcomeProjection.progress.probeGoalRequirements.candidates[0], {
    sourceId: "rocket:r1", rocketId: "r1",
    required: { credits: 1, energy: 3 },
    endpointFacts: { rewards: planetRewards.buildOrbitRewardEffects("mars", 1),
      cost: { credits: 1, energy: 1 },
      ownMarkers: { orbitMarkers: [], landingMarkers: [], satelliteLandings: [] } },
  });
  observation.publicState.board.techSupply = { stacks: {
    blue1: { tileId: "blue1", remaining: 4, depleted: false },
    blue2: { tileId: "blue2", remaining: 4, depleted: false },
  } };
  observation.outcomeProjection.progress.sectorWinRequirements.standardScanEarthSource = { sectorX: 5 };
  observation.outcomeProjection.progress.sectorWinRequirements.candidates = [
    { sectorId: "sector-a", targetId: "sector:win:sector-a:1", ownCount: 1,
      maxOpponentCount: 0, openSlotCount: 3, nextSlotScore: 0, ranking: [] },
    { sectorId: "sector-b", targetId: "sector:win:sector-b:1", ownCount: 0,
      maxOpponentCount: 1, openSlotCount: 3, nextSlotScore: 0, ranking: [] },
  ];
  return observation;
}

{
  const { sanitizePublicPlayer } = require("../../app/simulation-contract");
  const player = { id: "player-white", resources: {}, techState: {
    ownedTiles: { blue1: true, blue2: true }, disabledTiles: {},
    blueBoardSlots: { blue2: 1, blue1: 2 },
  }, dataState: { placedTokens: [1, 2, 3, 4].map(placementSlot => (
    { placementKind: "computer", placementSlot }
  )) } };
  const beforePlayer = structuredClone(player);
  const reordered = structuredClone(player);
  reordered.techState.blueBoardSlots = { blue1: 2, blue2: 1 };
  const observe = p => ({ ...planObservation(), publicState: {
    ...planObservation().publicState, players: [sanitizePublicPlayer(p)],
  } });
  const a = observe(player), b = observe(reordered);
  const action = planAction("data-choice", "choose_target",
    { choiceId: "data:blueBonus:1", target: "blueBonus", blueSlot: 1 });
  const plan = storedSteps([stepEvidence(action, a, "data:analyze")]);
  assert.deepEqual(a.publicState.players[0].dataProgress, b.publicState.players[0].dataProgress,
    "同一蓝槽布局不得因科技对象插入顺序而改变公共数据事实");
  assert.equal(planContinuation.planReuseCheck(plan, b, [action]).hit, true);
  assert.deepEqual(player, beforePlayer, "公共观察不得改变正式玩家状态");
  for (const change of [
    p => p.dataState.placedTokens.push({ placementKind: "blueBonus", blueSlot: 1 }),
    p => { p.techState.blueBoardSlots = { blue1: 1, blue2: 2 }; },
    p => { p.dataState.placedTokens = p.dataState.placedTokens.filter(t => t.placementSlot !== 3); },
  ]) {
    const changed = structuredClone(player); change(changed);
    assert.equal(planContinuation.planReuseCheck(plan, observe(changed), [action]).reason,
      "next-step-affected", "占用、科技位置和解锁变化仍必须使计划失效");
  }
}

function stepEvidence(action, observation, routeTargetId = null, goalDepth = 0, routePlanId = null) {
  return { ...planContinuation.capturePlanStep({ action, observation }),
    routeTargetId, goalDepth, routePlanId };
}

function storedSteps(evidence) {
  const steps = planContinuation.compilePlanSteps(evidence);
  return { schemaVersion: planContinuation.PLAN_SCHEMA_VERSION,
    nextActionId: steps[0].actionId, steps };
}

function planAction(id, family = "move", target = {}) {
  return { actionId: id, actorId: "player-white", phase: "main", family, target, payload: {} };
}

{
  const before = planObservation();
  const move = planAction("move:b", "move", { rocketId: "r1" });
  const research = planAction("research:c", "research_tech");
  const plan = storedSteps([
    stepEvidence(move, before, "orbit:mars"),
    stepEvidence(research, before, "tech:gain:blue1", 1),
  ]);
  const frozen = structuredClone(before);
  const hit = planContinuation.planReuseCheck(plan, before, [move]);
  assert.equal(hit.hit, true);
  assert.equal(hit.action, move, "返回当前合法描述符，而非缓存的旧版本");
  assert.equal(hit.nextPlan.nextActionId, research.actionId);
  assert.deepEqual(hit.nextPlan.steps[0].dependencies.map((item) => item.scope.kind), ["tech"]);
  assert.deepEqual(before, frozen, "采集、编译和复用不修改输入");
  const otherRocket = structuredClone(before);
  otherRocket.outcomeProjection.progress.probeGoalRequirements.candidates.push({
    ...structuredClone(otherRocket.outcomeProjection.progress.probeGoalRequirements.candidates[0]),
    requirementId: "other-route", sourceId: "rocket:r2", rocketId: "r2", gap: { movementSteps: 9 },
  });
  assert.equal(planContinuation.planReuseCheck(plan, otherRocket, [move]).hit, true,
    "同终点的无关探测器路线变化不得使具名路线失效");
  const moved = structuredClone(before);
  moved.outcomeProjection.progress.probeGoalRequirements.candidates[0].gap.movementSteps = 5;
  assert.equal(planContinuation.planReuseCheck(plan, moved, [move]).reason, "next-step-affected");
  assert.equal(planContinuation.planReuseCheck(hit.nextPlan, moved, [research]).hit, true,
    "进入研究目标后不再继承已完成路线的依赖");
  moved.publicState.board.techSupply.stacks.blue1.remaining = 3;
  assert.equal(planContinuation.planReuseCheck(hit.nextPlan, moved, [research]).reason, "next-step-affected");

  const occupied = structuredClone(before);
  occupied.publicState.board.planets.planets.mars.orbitMarkers.push({ playerId: "other" });
  occupied.outcomeProjection.progress.probeGoalRequirements.candidates[0].endpointFacts.rewards
    = planetRewards.buildOrbitRewardEffects("mars", 2);
  assert.equal(planContinuation.planReuseCheck(plan, occupied, [move]).reason, "next-step-affected");
  assert.equal(planContinuation.planReuseCheck(plan, before, []).reason, "step-not-legal");
  assert.equal(planContinuation.planReuseCheck(plan, before, [{ ...move, actorId: "other" }]).reason,
    "plan-step-identity-changed");
  assert.equal(planContinuation.planReuseCheck(plan, before, [{ ...move, target: { rocketId: "other" } }]).reason,
    "plan-step-identity-changed");
  assert.equal(planContinuation.planReuseCheck(null, before, [move]).reason, "no-plan");
  assert.equal(planContinuation.planReuseCheck({ nextActionId: move.actionId }, before, [move]).reason,
    "plan-step-evidence-missing");
  const missing = structuredClone(plan);
  missing.steps[0].revealedCount = null;
  assert.equal(planContinuation.planReuseCheck(missing, before, [move]).reason, "no-reveal-count");
  delete before.outcomeProjection.progress.probeGoalRequirements.candidates[0].endpointFacts;
  const absent = storedSteps([stepEvidence(move, before, "orbit:mars")]);
  assert.equal(absent.steps[0].valid, false);
  assert.equal(planContinuation.planReuseCheck(absent, before, [move]).reason, "plan-dependency-fact-missing",
    "两份缺失终点事实不能被认为未变化");
}

{
  const before = planObservation();
  const scan = planAction("scan", "scan");
  const choose = planAction("scan-sector", "choose_target", { nebulaId: "sector-a" });
  const plan = storedSteps([
    stepEvidence(scan, before, "sector:win:sector-a:1"),
    stepEvidence(choose, before, "sector:win:sector-a:1"),
  ]);
  const unrelated = structuredClone(before);
  unrelated.outcomeProjection.progress.sectorWinRequirements.candidates[1].ownCount = 5;
  unrelated.publicState.board.techSupply.stacks.blue2.remaining = 1;
  assert.equal(planContinuation.planReuseCheck(plan, unrelated, [scan]).hit, true,
    "无关扇区和科技不触发重搜");
  unrelated.outcomeProjection.progress.sectorWinRequirements.candidates[0].ownCount = 5;
  assert.equal(planContinuation.planReuseCheck(plan, unrelated, [scan]).reason, "next-step-affected");

  const changed = structuredClone(before);
  changed.outcomeProjection.progress.sectorWinRequirements.standardScanEarthSource = { sectorX: 1 };
  assert.equal(planContinuation.planReuseCheck(plan, changed, [scan]).reason, "next-step-affected",
    "即使潜在扇区并集不变，首步地球来源改变也在扣费前拒绝复用");
  assert.equal(planContinuation.planReuseCheck(planContinuation.advancePlan(plan), changed, [choose]).hit, true,
    "扫描队列创建后不再继承地球位置依赖");
  const prep = planAction("prep", "quick_trade");
  const prepared = storedSteps([
    stepEvidence(prep, before, "sector:win:sector-a:1"),
    stepEvidence(scan, changed, "sector:win:sector-a:1"),
    stepEvidence(choose, changed, "sector:win:sector-a:1"),
  ]);
  assert.equal(planContinuation.planReuseCheck(prepared, changed, [prep]).reason, "next-step-affected",
    "扫描前准备步骤同样约束来源");
  assert.equal(planContinuation.planReuseCheck(prepared, before, [prep]).hit, true);
  assert.equal(planContinuation.planReuseCheck(planContinuation.advancePlan(prepared), changed, [scan]).hit, true,
    "自身推进后比较下一步的实际预测来源，而非整叶首步来源");
  delete changed.outcomeProjection.progress.sectorWinRequirements.standardScanEarthSource;
  const missing = storedSteps([stepEvidence(scan, changed)]);
  assert.equal(planContinuation.planReuseCheck(missing, changed, [scan]).reason, "plan-dependency-fact-missing");
  assert.equal(planContinuation.planReuseCheck(planContinuation.advancePlan(plan), changed, [choose]).hit, true);
}

{
  const before = planObservation();
  before.publicState.board.rockets = [
    { id: 1, playerId: "p1", surface: "solar-board", sectorX: 2, sectorY: 1 },
    { id: 2, playerId: "p2", surface: "solar-board", sectorX: 3, sectorY: 1 },
  ];
  before.publicState.board.solarSystem = { sectorBySlot: ["sector-a", "sector-b"] };
  const choose = planAction("probe-scan", "choose_target", { rocketId: 2, nebulaId: "sector-a", probeScanSource: true });
  const plan = storedSteps([stepEvidence(choose, before, "sector:win:sector-a:1")]);
  assert.equal(planContinuation.planReuseCheck(plan, before, [choose]).hit, true);
  const unrelated = structuredClone(before);
  unrelated.publicState.board.rockets[0].sectorX = 4;
  assert.equal(planContinuation.planReuseCheck(plan, unrelated, [choose]).hit, true);
  const rotated = structuredClone(before);
  rotated.publicState.board.solarSystem.sectorBySlot.reverse();
  assert.equal(planContinuation.planReuseCheck(plan, rotated, [choose]).reason, "next-step-affected", "探测器未移动但对应扇区变化也使准备计划失效");
  const moved = structuredClone(before);
  moved.publicState.board.rockets[1].sectorX = 4;
  assert.equal(planContinuation.planReuseCheck(plan, moved, [choose]).reason, "next-step-affected", "所选对手探测器移动使扫描计划失效");
  moved.publicState.board.rockets.pop();
  assert.equal(planContinuation.planReuseCheck(plan, moved, [choose]).hit, false, "来源消失不能继续复用");
}

{
  const before = planObservation();
  const root = planAction("research", "research_tech");
  const choose = planAction("tile", "choose_target", { tileId: "blue1", publicSlotIndex: 0 });
  before.publicState.board.publicCards = [{ id: "card-a", cardId: "c1" }];
  const plan = storedSteps([
    stepEvidence(root, before, "decision:research"),
    stepEvidence(choose, before, "decision:research"),
  ]);
  assert.deepEqual(plan.steps[0].dependencies.map((item) => item.scope.kind).sort(), ["card-slot", "tech"],
    "当前主行动未具名时，从同目标段后继选择确定复合依赖");
  const changed = structuredClone(before);
  changed.publicState.board.publicCards[0] = { id: "card-b", cardId: "c2" };
  assert.equal(planContinuation.planReuseCheck(plan, changed, [root]).reason, "next-step-affected");
}

{
  const before = planObservation();
  const after = structuredClone(before);
  after.publicState.players[0].dataProgress.computerDataSlots.push(1);
  const first = planAction("place1", "place_data");
  const second = planAction("place2", "place_data");
  const plan = storedSteps([stepEvidence(first, before), stepEvidence(second, after)]);
  assert.equal(planContinuation.planReuseCheck(plan, before, [first]).hit, true);
  const advanced = planContinuation.advancePlan(plan);
  assert.equal(planContinuation.planReuseCheck(advanced, after, [second]).hit, true,
    "自身放置数据按下一步预测布局比较");
  assert.equal(planContinuation.planReuseCheck(advanced, before, [second]).reason, "next-step-affected");
  assert.equal(planContinuation.advancePlan(advanced).nextActionId, null);
  const built = planContinuation.buildPlanFromSnapshot({ plan: { executionSteps: plan.steps } });
  assert.equal(built.nextActionId, second.actionId, "根动作已实际提交，缓存从第二个真实输入开始");
  assert.equal(planContinuation.buildPlanFromSnapshot({ plan: { executionSteps: [plan.steps[0]] } }), null);
}

for (const family of ["end_turn", "pass"]) {
  const before = planObservation();
  before.selfState = {playerId:"player-white",hand:[]};
  const action = planAction(family, family);
  const plan = storedSteps([stepEvidence(action, before)]);
  assert.equal(planContinuation.planReuseCheck(plan, before, [action]).hit, true);
  assert.equal(planContinuation.planReuseCheck(plan, before, [action]).hit, true);
  const revealed = structuredClone(before);
  revealed.publicState.board.aliens.slots[0].revealed = true;
  assert.equal(planContinuation.planReuseCheck(plan, revealed, [action]).reason,
    "alien-revealed", "同回合控制动作也不能绕过新揭示检查");
}

// PASS复用依赖退出时的全部机会；回合号及对手无关资源不是退出条件。
{
  const before = planObservation();
  before.selfState = {playerId:"player-white",hand:[]};
  const action = planAction("pass", "pass");
  const plan = storedSteps([stepEvidence(action, before)]);
  const unchanged = structuredClone(before);
  unchanged.publicState.turnNumber = 99;
  unchanged.publicState.players.push({playerId:"opponent",credits:99});
  assert.equal(planContinuation.planReuseCheck(plan, unchanged, [action]).hit, true);
  for (const mutate of [
    obs => { obs.publicState.players[0].credits = 99; },
    obs => { obs.selfState.hand.push({id:"new-card",cardId:"new-card"}); },
    obs => { obs.publicState.board.techSupply.stacks.blue1.remaining = 0; },
    obs => { obs.publicState.roundNumber = 4; },
  ]) {
    const changed = structuredClone(before);
    mutate(changed);
    assert.equal(planContinuation.planReuseCheck(plan, changed, [action]).reason, "next-step-affected");
  }
  const old = structuredClone(plan);
  old.steps[0].dependencies = [];
  assert.equal(planContinuation.planReuseCheck(old, before, [action]).reason, "pass-decision-evidence-missing");
}

// 环绕已完成后的选牌只检查奖励依赖；同一个选择在目标未完成时不能跳过路线证据。
{
  const before = planObservation();
  before.outcomeProjection.progress.probeGoalRequirements.candidates = [];
  before.publicState.board.publicCards = [{ id: "reward-a", cardId: "c1" }];
  const action = planAction("reward", "choose_card", { publicSlotIndex: 0, cardInstanceId: "reward-a" });
  const evidence = stepEvidence(action, before, "orbit:mars", 0, "probe:c1");
  const pending = storedSteps([{ ...evidence, goalCompletionPending: true }]);
  assert.equal(planContinuation.planReuseCheck(pending, before, [action]).hit, true);
  const unfinished = storedSteps([{ ...evidence, goalCompletionPending: false }]);
  assert.equal(planContinuation.planReuseCheck(unfinished, before, [action]).reason, "plan-route-source-missing");
  before.publicState.board.publicCards[0] = { id: "reward-b", cardId: "c2" };
  assert.equal(planContinuation.planReuseCheck(pending, before, [action]).reason, "next-step-affected",
    "完成路线不能跳过具名奖励选牌检查");
}

// 正式 sanitize 输入是槽编号对象；不能在公共 fixture 手工补 id 或顶层 firstPlaced。
{
  const { sanitizeAlienPublicState } = require("../../app/simulation-contract");
  const canonical = { aliens: {
    1: { assignedAlienId: "hidden-a", revealed: false, traces: { blue: { firstPlaced: false } } },
    2: { assignedAlienId: "hidden-b", revealed: false, traces: { blue: { firstPlaced: false } } },
  } };
  const before = planObservation();
  before.publicState.board.aliens = sanitizeAlienPublicState(canonical);
  assert.deepEqual(before.publicState.board.aliens.slots.map((slot) => slot.slotId), [1, 2]);
  assert.equal(JSON.stringify(before.publicState.board.aliens).includes("hidden-"), false);
  const action = planAction("trace", "choose_target", { alienSlotId: 2, traceType: "blue" });
  const plan = storedSteps([stepEvidence(action, before)]);
  assert.equal(planContinuation.planReuseCheck(plan, before, [action]).hit, true);
  canonical.aliens[2].traces.blue.firstPlaced = true;
  const changed = structuredClone(before);
  changed.publicState.board.aliens = sanitizeAlienPublicState(canonical);
  assert.equal(planContinuation.planReuseCheck(plan, changed, [action]).reason, "next-step-affected");
  canonical.aliens[2].traces = {};
  changed.publicState.board.aliens = sanitizeAlienPublicState(canonical);
  const absent = storedSteps([stepEvidence(action, changed)]);
  assert.equal(absent.steps[0].valid, false);
  assert.equal(planContinuation.planReuseCheck(absent, changed, [action]).reason, "plan-dependency-fact-missing");
}

// 终局板块与科技共享tileId字段，但由正式选择身份区分依赖域。
for (const tileId of ["a", "b", "c", "d"]) {
  for (const variant of [1, 2]) {
    const before = planObservation();
    const final = require("../final-scoring").createFinalScoringState();
    final.tileVariants[tileId] = variant;
    before.publicState.board.finalScoring = final;
    const end = planAction("end", "end_turn");
    const mark = planAction(`final:${tileId}`, "choose_target", {
      kind: "residual-domain", choiceId: `final:${tileId}`, tileId,
    });
    const plan = storedSteps([stepEvidence(end, before), stepEvidence(mark, before)]);
    assert.equal(plan.steps.every((step) => step.valid), true);
    assert.deepEqual(plan.steps[0].dependencies.map((item) => item.scope), [{ kind: "final-tile", id: tileId }]);
    const first = planContinuation.planReuseCheck(plan, before, [end]);
    assert.equal(first.hit, true);
    assert.equal(planContinuation.planReuseCheck(first.nextPlan, before, [mark]).hit, true);
    const unrelated = structuredClone(before);
    unrelated.publicState.board.finalScoring.tiles[tileId === "a" ? "b" : "a"].marks.push({ playerId: "other", slotIndex: 1 });
    unrelated.publicState.board.techSupply.stacks.blue1.remaining = 2;
    assert.equal(planContinuation.planReuseCheck(plan, unrelated, [end]).hit, true);
    for (const change of ["marks", "variant", "missing"]) {
      const changed = structuredClone(before);
      const state = changed.publicState.board.finalScoring;
      if (change === "marks") state.tiles[tileId].marks.push({ playerId: "other", slotIndex: 1 });
      if (change === "variant") state.tileVariants[tileId] = 3 - variant;
      if (change === "missing") delete state.tiles[tileId];
      assert.equal(planContinuation.planReuseCheck(plan, changed, [end]).hit, false);
    }
    const unknown = planAction("unknown", "choose_target", { tileId: "unknown", choiceId: "other:unknown" });
    assert.equal(storedSteps([stepEvidence(unknown, before)]).steps[0].reason, "plan-tile-scope-unknown");
    delete before.publicState.board.finalScoring;
    assert.equal(storedSteps([stepEvidence(mark, before)]).steps[0].valid, false);
  }
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

// 公司第二艘是为独立目的做准备；主来源、第二来源及公司额度均须参与复用检查。
{
  const before = planObservation();
  before.publicState.board.rockets[1].playerId = "player-white";
  const requirements = before.outcomeProjection.progress.probeGoalRequirements;
  requirements.movementContext = { phase: "company", cardRemaining: 0,
    companyAvailable: false, companyRemaining: 1, usedRocketIds: ["r1"] };
  requirements.candidates.push({ ...structuredClone(requirements.candidates[0]),
    requirementId: "c2", sourceId: "rocket:r2", rocketId: "r2" });
  const move = planAction("company-second", "choose_target", { rocketId: "r2", deltaX: 1, deltaY: 0 });
  move.phase = "conditional";
  const evidence = { ...stepEvidence(move, before, "orbit:mars", 0, "probe:c1"),
    movementPreparation: { targetId: "orbit:mars", planId: "probe:c2", sourceId: "rocket:r2", rocketId: "r2" } };
  const plan = storedSteps([evidence]);
  assert.equal(planContinuation.planReuseCheck(plan, before, [move]).hit, true);
  assert.deepEqual(plan.steps[0].dependencies.filter(d => d.scope.kind === "route")
    .map(d => d.scope.sourceId).sort(), ["rocket:r1", "rocket:r2"]);
  for (const mutation of ["position", "allowance", "primary", "secondary"]) {
    const changed = structuredClone(before);
    const probe = changed.outcomeProjection.progress.probeGoalRequirements;
    if (mutation === "position") changed.publicState.board.rockets[1].sectorX += 1;
    if (mutation === "allowance") probe.movementContext.usedRocketIds.push("r2");
    if (mutation === "primary") probe.candidates[0].gap.movementSteps += 1;
    if (mutation === "secondary") probe.candidates[1].gap.movementSteps += 1;
    assert.equal(planContinuation.planReuseCheck(plan, changed, [move]).hit, false, mutation);
  }
  const wrongSource = storedSteps([{ ...evidence,
    movementPreparation: { ...evidence.movementPreparation, rocketId: "r1" } }]);
  assert.equal(wrongSource.steps[0].reason, "plan-movement-preparation-source-missing");
}

// 同一分析目标跨取数据方式，提前检查后续扫描；事实仍来自各步执行前。
{
  const before = planObservation();
  before.publicState.board.publicCards = [{ id: "scan-card", cardId: "c1" }];
  const after = structuredClone(before);
  after.publicState.players[0].dataProgress.computerDataSlots.push(1);
  const corner = planAction("data-corner", "card_corner", { cardInstanceId: "owned-card" });
  const scan = planAction("data-scan", "scan");
  const choose = planAction("scan-card", "choose_card", { publicSlotIndex: 0, nebulaId: "sector-a" });
  const evidence = [
    stepEvidence(corner, before, "data:analyze", 2, "data:corner:owned-card"),
    stepEvidence(scan, after, "data:analyze", 2, "data:scan"),
    stepEvidence(choose, after, "data:analyze", 2, "data:scan"),
  ];
  const frozen = structuredClone(evidence), plan = storedSteps(evidence);
  assert.equal(planContinuation.planReuseCheck(plan, before, [corner]).hit, true);
  for (const change of ["card", "earth", "sector"]) {
    const changed = structuredClone(before);
    if (change === "card") changed.publicState.board.publicCards[0].id = "replacement";
    if (change === "earth") changed.outcomeProjection.progress.sectorWinRequirements.standardScanEarthSource.sectorX += 1;
    if (change === "sector") changed.outcomeProjection.progress.sectorWinRequirements.candidates[0].ownCount += 1;
    assert.equal(planContinuation.planReuseCheck(plan, changed, [corner]).reason, "next-step-affected",
      `同分析目标切换资源取得方式后，必须在弃牌前发现${change}变化`);
  }
  const unrelated = structuredClone(before);
  unrelated.outcomeProjection.progress.sectorWinRequirements.candidates[1].ownCount += 1;
  assert.equal(planContinuation.planReuseCheck(plan, unrelated, [corner]).hit, true);
  assert.equal(planContinuation.planReuseCheck(planContinuation.advancePlan(plan), after, [scan]).hit, true,
    "未来自身放数据不污染早期基线，推进后仍按对应步骤事实复用");
  assert.deepEqual(evidence, frozen);
  for (const change of ["depth", "target"]) {
    const separated = structuredClone(evidence);
    for (const step of separated.slice(1)) {
      if (change === "depth") step.goalDepth += 1;
      if (change === "target") step.routeTargetId = "decision:reward";
    }
    const changed = structuredClone(before);
    changed.publicState.board.publicCards[0].id = "replacement";
    assert.equal(planContinuation.planReuseCheck(storedSteps(separated), changed, [corner]).reason,
      "future-step-affected", `${change}边界不扩大当前目标依赖，但自由步骤仍检查真实后缀`);
  }
}

// 同目标不同来源：后续火箭不能替换当前具名路线的来源。
{
  const before = planObservation();
  const routes = before.outcomeProjection.progress.probeGoalRequirements.candidates;
  routes.push({ ...structuredClone(routes[0]), requirementId: "c2", sourceId: "rocket:r2", rocketId: "r2" });
  const prepare = planAction("prepare-route", "quick_trade");
  const move = planAction("next-source", "move", { rocketId: "r2" });
  const plan = storedSteps([
    stepEvidence(prepare, before, "orbit:mars", 0, "probe:c1"),
    stepEvidence(move, before, "orbit:mars", 0, "probe:c2"),
  ]);
  const changed = structuredClone(before);
  changed.outcomeProjection.progress.probeGoalRequirements.candidates[1].gap.movementSteps += 1;
  assert.equal(planContinuation.planReuseCheck(plan, changed, [prepare]).reason, "future-step-affected",
    "后续来源不能替换当前路线身份，但自由准备仍提前检查后缀路线");
  assert.equal(planContinuation.planReuseCheck(planContinuation.advancePlan(plan), changed, [move]).reason,
    "next-step-affected");
  changed.outcomeProjection.progress.probeGoalRequirements.candidates[0].gap.movementSteps += 1;
  assert.equal(planContinuation.planReuseCheck(plan, changed, [prepare]).reason, "next-step-affected");
}

// 同目标奖励依赖向前覆盖投入；领奖阶段不重新继承已完成目标。
for (const [targetId, family, target, planId] of [
  ["tech:gain:blue1", "research_tech", {}, "tech:blue1"],
  ["data:analyze", "analyze", {}, "data:scan"],
  ["land:mars", "land", { rocketId: "r1" }, "probe:c1"],
]) {
  const before = planObservation();
  before.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId = "land:mars";
  before.publicState.board.publicCards = [{ id: "reward-card", cardId: "c1" }];
  const after = structuredClone(before);
  after.publicState.board.techSupply.stacks.blue1.remaining -= 1;
  after.publicState.players[0].dataProgress.computerDataSlots = [];
  after.outcomeProjection.progress.probeGoalRequirements.candidates = [];
  const commit = planAction("commit", family, target);
  const trace = planAction("reward-trace", "choose_target", { alienSlotId: 1, traceType: "blue" });
  const card = planAction("reward-card", "choose_card",
    { publicSlotIndex: 0, cardInstanceId: "reward-card" });
  const evidence = [stepEvidence(commit, before, targetId, 0, planId),
    ...[trace, card].map(action => ({ ...stepEvidence(action, after, targetId, 0, planId),
      goalCompletionPending: true }))];
  const frozen = structuredClone(evidence), plan = storedSteps(evidence);
  assert.equal(planContinuation.planReuseCheck(plan, before, [commit]).hit, true);
  for (const reward of ["card", "trace"]) {
    const changed = structuredClone(before);
    if (reward === "card") changed.publicState.board.publicCards[0].id = "replacement";
    else changed.publicState.board.aliens.slots[0].traces.blue.firstPlaced = true;
    assert.equal(planContinuation.planReuseCheck(plan, changed, [commit]).reason, "next-step-affected",
      `${targetId}投入前必须检查${reward}奖励变化`);
  }
  const rewardPlan = planContinuation.advancePlan(plan);
  assert.equal(planContinuation.planReuseCheck(rewardPlan, after, [trace]).hit, true,
    "目标完成后不因旧科技/路线/数据准备事实改变而失效");
  const afterTrace = structuredClone(after);
  afterTrace.publicState.board.aliens.slots[0].traces.blue.firstPlaced = true;
  const cardPlan = planContinuation.advancePlan(rewardPlan);
  assert.equal(planContinuation.planReuseCheck(cardPlan, afterTrace, [card]).hit, true,
    "消耗的前一奖励不重新进入后续奖励依赖");
  afterTrace.publicState.board.publicCards[0].id = "replacement";
  assert.equal(planContinuation.planReuseCheck(cardPlan, afterTrace, [card]).reason, "next-step-affected");
  assert.deepEqual(evidence, frozen);
  const nextGoal = stepEvidence(planAction("next-goal", "choose_target", { tileId: "blue2" }),
    after, targetId, 0, planId);
  const separated = storedSteps([...evidence, nextGoal]);
  const unrelated = structuredClone(before);
  unrelated.publicState.board.techSupply.stacks.blue2.remaining -= 1;
  assert.equal(planContinuation.planReuseCheck(separated, unrelated, [commit]).hit, true,
    "即使目标和深度相同，完成后重新开始的投入不能继承到旧目标");
  const absent = structuredClone(evidence);
  absent[0].facts.cards = [];
  assert.equal(storedSteps(absent).steps[0].reason, "plan-dependency-fact-missing",
    "未来奖励牌事实不能倒灌填补当前缺失事实");
  const blind = planAction("blind", "choose_card", { source: "deck" });
  const blindPlan = storedSteps([evidence[0], { ...stepEvidence(blind, after, targetId, 0, planId),
    goalCompletionPending: true }]);
  assert.equal(blindPlan.steps[0].dependencies.some(d => d.scope.kind.startsWith("card")), false,
    "盲抽没有公开牌面，不虚构牌面依赖");
}

// 等额奖励下的他人标记变化不重搜；真实奖励变化仍拒绝复用。
for (const family of ["orbit", "land"]) {
  for (const planetId of Object.keys(family === "orbit"
    ? planetRewards.ORBIT_REWARDS : planetRewards.PLANET_LAND_REWARDS)) {
    const reward = n => family === "orbit" ? planetRewards.buildOrbitRewardEffects(planetId, n)
      : planetRewards.buildPlanetLandRewardEffects(planetId, n);
    for (let prior = 0; prior < 5; prior++) {
      const before = planObservation();
      const route = before.outcomeProjection.progress.probeGoalRequirements.candidates[0];
      const target = `${family}:${planetId}:planet:`;
      route.targetId = target;
      route.endpointFacts.rewards = reward(prior + 1);
      const action = planAction("route", "move", { rocketId: "r1" });
      const plan = storedSteps([stepEvidence(action, before, target)]);
      const changed = structuredClone(before);
      changed.outcomeProjection.progress.probeGoalRequirements.candidates[0].endpointFacts.rewards = reward(prior + 2);
      const equal = JSON.stringify(reward(prior + 1)) === JSON.stringify(reward(prior + 2));
      assert.equal(planContinuation.planReuseCheck(plan, changed, [action]).hit, equal,
        `${target}已有${prior}→${prior + 1}按实际奖励区分`);
    }
  }
}

{
  const before = planObservation();
  const action = planAction("route", "move", { rocketId: "r1" });
  const plan = storedSteps([stepEvidence(action, before, "orbit:mars")]);
  for (const change of ["cost", "required", "own", "source", "missing", "gone"]) {
    const changed = structuredClone(before);
    const requirements = changed.outcomeProjection.progress.probeGoalRequirements;
    const route = requirements.candidates[0];
    if (change === "cost") route.endpointFacts.cost.energy += 1;
    if (change === "required") route.required.credits += 1;
    if (change === "own") route.endpointFacts.ownMarkers.orbitMarkers.push(
      { index: 1, marker: { playerId: "player-white" } });
    if (change === "source") route.sourceId = "rocket:r2";
    if (change === "missing") delete route.endpointFacts;
    if (change === "gone") requirements.candidates = [];
    assert.equal(planContinuation.planReuseCheck(plan, changed, [action]).hit, false, change);
  }
  assert.equal(planContinuation.planReuseCheck({ ...plan, schemaVersion: "seti-action-plan-v2" },
    before, [action]).hit, false);
  const satellite = structuredClone(before);
  satellite.outcomeProjection.progress.probeGoalRequirements.candidates[0].targetId
    = "land:jupiter:satellite:io";
  const satellitePlan = storedSteps([stepEvidence(action, satellite, "land:jupiter:satellite:io")]);
  const changed = structuredClone(satellite);
  changed.publicState.board.planets.planets.jupiter = {
    satelliteLandings: [{ satelliteId: "europa", playerId: "other" }],
  };
  assert.equal(planContinuation.planReuseCheck(satellitePlan, changed, [action]).hit, true);
}

// 后续移除标记必须在投入前检查原位置；不能只确认届时还有同名合法动作。
{
  const before = planObservation();
  before.publicState.board.planets.planets.mars.orbitMarkers = [
    { playerId: "other" }, { playerId: "player-white", color: "white" },
  ];
  const prepare = planAction("prepare", "card_corner");
  const remove = planAction("remove", "choose_target", { planetId: "mars", kind: "orbit", index: 1 });
  const plan = storedSteps([stepEvidence(prepare, before), stepEvidence(remove, before)]);
  assert.equal(planContinuation.planReuseCheck(plan, before, [prepare]).hit, true);
  const unrelated = structuredClone(before);
  unrelated.publicState.board.planets.planets.mars.orbitMarkers.push({ playerId: "other" });
  assert.equal(planContinuation.planReuseCheck(plan, unrelated, [prepare]).hit, true);
  unrelated.publicState.board.planets.planets.mars.orbitMarkers.shift();
  assert.equal(planContinuation.planReuseCheck(plan, unrelated, [prepare]).hit, false);
  const absent = structuredClone(before);
  absent.publicState.board.planets.planets.mars.orbitMarkers[1].playerId = "other";
  assert.equal(planContinuation.planReuseCheck(plan, absent, [prepare]).hit, false);
}

// 后续目标的具名公共事实应提前检查；未来自身状态不能回填当前基线。
{
  const before = planObservation();
  before.publicState.board.publicCards = [{ id: "future-card", cardId: "c1" }];
  const prepare = planAction("prepare", "play_card");
  const pick = planAction("future-pick", "choose_card", { publicSlotIndex: 0 });
  pick.phase = "conditional";
  const evidence = [stepEvidence(prepare, before, "card:resolve:prepare", 0),
    stepEvidence(pick, before, "decision:future-pick", 1)];
  const plan = storedSteps(evidence);
  assert.equal(planContinuation.planReuseCheck(plan, before, [prepare]).hit, true);
  const changed = structuredClone(before);
  changed.publicState.board.publicCards[0] = { id: "other-card", cardId: "c2" };
  const miss = planContinuation.planReuseCheck(plan, changed, [prepare]);
  assert.equal(miss.reason, "future-step-affected");
  assert.deepEqual(miss.affected, { kind: "card-slot", id: "0" });
  const later = structuredClone(before);
  later.publicState.board.publicCards[0] = { id: "own-future-card", cardId: "c3" };
  const ownChange = storedSteps([evidence[0], stepEvidence(pick, later, "decision:future-pick", 1)]);
  assert.equal(planContinuation.planReuseCheck(ownChange, before, [prepare]).hit, true,
    "当前比较当前预期，不把自己将补出的未来卡当成当前缺失");
  assert.equal(planContinuation.planReuseCheck(planContinuation.advancePlan(ownChange), later, [pick]).hit, true);
  const reward = { ...prepare, family: "choose_reward", phase: "conditional" };
  const rewardPlan = storedSteps([stepEvidence(reward, before, "card:resolve:prepare", 0), evidence[1]]);
  assert.equal(planContinuation.planReuseCheck(rewardPlan, changed, [reward]).hit, true,
    "不可因后续目标变化打断已进入的强制奖励");
  const pending = storedSteps([{ ...evidence[0], goalCompletionPending: true }, evidence[1]]);
  assert.equal(planContinuation.planReuseCheck(pending, changed, [prepare]).hit, true);
  assert.equal(planContinuation.planReuseCheck({ ...plan, schemaVersion: "seti-action-plan-v3" },
    before, [prepare]).hit, false);
}

{
  const before = planObservation();
  const first = planAction("before-launch", "play_card");
  const move = planAction("future-rocket", "move", { rocketId: "new" });
  const later = structuredClone(before);
  const route = later.outcomeProjection.progress.probeGoalRequirements.candidates[0];
  route.rocketId = "new"; route.sourceId = "rocket:new"; route.requirementId = "new-route";
  const plan = storedSteps([stepEvidence(first, before, "card:resolve:launch", 0),
    stepEvidence(move, later, "orbit:mars", 1)]);
  assert.equal(plan.steps[0].valid, true);
  assert.deepEqual(plan.steps[0].futureDependencies[0].fact, { present: false });
  assert.equal(planContinuation.planReuseCheck(plan, before, [first]).hit, true);
  assert.equal(planContinuation.planReuseCheck(planContinuation.advancePlan(plan), later, [move]).hit, true);
}

for (const kind of ["sector", "tech", "data", "alien", "final-tile"]) {
  const before = planObservation();
  before.publicState.board.finalScoring = require("../final-scoring").createFinalScoringState();
  const prepare = planAction("prepare", "play_card");
  const target = kind === "sector" ? { nebulaId: "sector-a" }
    : kind === "tech" ? { tileId: "blue1" }
      : kind === "alien" ? { alienSlotId: 1, traceType: "blue" }
        : kind === "final-tile" ? { choiceId: "final:a", tileId: "a" } : { target: "computer" };
  const next = planAction("next", "choose_target", target);
  const plan = storedSteps([stepEvidence(prepare, before, "card:resolve:prepare", 0),
    stepEvidence(next, before, "decision:next", 1)]);
  assert.equal(planContinuation.planReuseCheck(plan, before, [prepare]).hit, true, kind);
  const changed = structuredClone(before);
  if (kind === "sector") changed.outcomeProjection.progress.sectorWinRequirements.candidates[0].ownCount++;
  if (kind === "tech") changed.publicState.board.techSupply.stacks.blue1.remaining--;
  if (kind === "data") changed.publicState.players[0].dataProgress.computerDataSlots.push(1);
  if (kind === "alien") changed.publicState.board.aliens.slots[0].traces.blue.firstPlaced = true;
  if (kind === "final-tile") changed.publicState.board.finalScoring.tiles.a.marks.push({ playerId: "other" });
  assert.equal(planContinuation.planReuseCheck(plan, changed, [prepare]).reason,
    "future-step-affected", kind);
}

process.stdout.write("plan-continuation.test.js ok\n");

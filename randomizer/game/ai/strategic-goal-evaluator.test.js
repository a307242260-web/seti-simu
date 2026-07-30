"use strict";

const assert = require("node:assert/strict");
const outcomeModel = require("./outcome-model");
const evaluator = require("./expected-score-evaluator");

const seatId = "strategic-seat";

function observation({
  score = 0,
  resources = {},
  income = {},
  ownedTechIds = [],
  roundNumber = 1,
  dataProgress = null,
  alienSlots = [],
  securedEndGameBonus = 0,
  handCount = 0,
  hand = null,
  blueBoardSlots = {},
} = {}) {
  return outcomeModel.createDecisionObservation({
    publicState: {
      roundNumber,
      players: [{
        id: seatId,
        resources: {
          score,
          credits: 0,
          energy: 0,
          publicity: 0,
          availableData: 0,
          ...resources,
        },
        income,
        techState: {
          ownedTiles: Object.fromEntries(ownedTechIds.map((tileId) => [tileId, true])),
          disabledTiles: {},
          blueBoardSlots,
        },
        ...(dataProgress ? { dataProgress } : {}),
        securedEndGameBonus,
      }],
      board: { aliens: { slots: alienSlots } },
    },
    selfState: {
      id: seatId,
      hand: hand || Array.from({ length: handCount }, (_, index) => ({
          id: `test-card-${index + 1}`,
          cardId: `test-card-${index + 1}.webp`,
        })),
    },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
}

{
  const result = evaluate(
    action("play-card:secured-final-score", "play_card"),
    observation({ score: 10, securedEndGameBonus: 0 }),
    observation({ score: 10, securedEndGameBonus: 8 }),
  );
  assert.equal(result.actualScoreDelta, 8,
    "正式终局计分器已经锁定的卡牌分必须作为一级分数，不等待整局 terminal");
  assert.equal(result.score, 8);
}

{
  const root = observation({
    dataProgress: { computerSlots: [1, 2, 3, 4], analyzeReady: false },
  });
  const closer = observation({
    dataProgress: { computerSlots: [1, 2, 3, 4, 5], analyzeReady: false },
  });
  const unrelated = observation({
    resources: { credits: 1 },
    dataProgress: { computerSlots: [1, 2, 3, 4], analyzeReady: false },
  });
  const place = action("place-data:slot-5", "place_data");
  const closerPriority = evaluator.evaluateSecondaryAgentSearchPriority({
      rootObservation: root,
      branchObservation: closer,
      focalSeatId: seatId,
      currentAction: place,
    });
  const unrelatedPriority = evaluator.evaluateSecondaryAgentSearchPriority({
      rootObservation: root,
      branchObservation: unrelated,
      focalSeatId: seatId,
      currentAction: action("industry:credit", "industry"),
    });
  const firstDifferentIndex = closerPriority.sortKey.findIndex(
    (value, index) => value !== unrelatedPriority.sortKey[index],
  );
  assert.ok(
    firstDifferentIndex >= 0
      && closerPriority.sortKey[firstDifferentIndex] > unrelatedPriority.sortKey[firstDifferentIndex],
    "填入下一计算机槽必须作为 beam 路线进度，但不能进入一级叶值",
  );
  assert.equal(
    evaluator.evaluateStrategicFactsPriority(
      outcomeModel.createStrategicFacts(root, seatId),
      outcomeModel.createStrategicFacts(closer, seatId),
    ),
    0,
    "数据槽进度不得直接折算为分数、科技或收入",
  );
}

{
  const corner = {
    ...action("corner:publicity", "card_corner"),
    payload: { kind: "resource" },
  };
  const before = observation({ resources: { publicity: 0 } });
  const immediate = observation({ resources: { publicity: 1 } });
  const distant = observation({
    resources: { publicity: 1 },
    score: 6,
  });
  const result = evaluator.evaluateAction({
    seatId,
    legalActions: [corner],
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: corner.actionId,
      status: "settled",
      confidence: "high",
      rootObservation: before,
      leaves: [{
        leafId: "unrelated-publicity-corner",
        actionChain: [corner.actionId, "land:distant"],
        secondaryAgentTrace: [
          { family: "card_corner", target: corner.target, payload: corner.payload },
          { family: "land", target: { planetId: "mars" }, payload: {} },
        ],
        rootActionObservation: immediate,
        rootActionLegalSuccessors: [{ family: "end_turn", target: {}, payload: {} }],
        observation: distant,
      }],
    }],
  }, corner);
  assert.equal(result.score, null,
    "只获得宣传的卡角不得把跨回合后的无关登陆收益归因给自己");
  assert.deepEqual(result.reasonCodes, ["card-corner-did-not-directly-unlock-agent"]);
}

{
  const ready = observation({
    resources: { credits: 4, energy: 0 },
    dataProgress: { computerSlots: [1, 2, 3, 4, 5, 6], analyzeReady: true },
  });
  const locked = evaluator.selectSecondaryAgentRouteTarget({
    focalSeatId: seatId,
    currentAction: { ...action("place-data:slot-6", "place_data"), actorId: seatId },
    rootObservation: observation(),
    branchObservation: ready,
    routeTargetId: null,
  });
  assert.equal(locked, "data:analyze", "第6格完成后必须锁定正式分析路线");
  const energyTrade = {
    ...action("trade:energy", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "credits-for-energy" },
  };
  const endTurn = { ...action("end-turn", "end_turn"), actorId: seatId };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: ready,
      legalSuccessors: [endTurn, energyTrade],
      routeTargetId: locked,
    }).map((candidate) => candidate.actionId),
    [energyTrade.actionId],
    "分析 ready 但缺电时应把换电当作目标手段，而不是提前结束路线",
  );
  const analyze = { ...action("analyze:data", "analyze"), actorId: seatId };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: observation({
        resources: { credits: 2, energy: 1 },
        dataProgress: { computerSlots: [1, 2, 3, 4, 5, 6], analyzeReady: true },
      }),
      legalSuccessors: [endTurn, analyze],
      routeTargetId: locked,
    }).map((candidate) => candidate.actionId),
    [analyze.actionId],
    "跨回合返回本席后必须继续正式分析",
  );
  assert.equal(evaluator.selectSecondaryAgentRouteTarget({
    focalSeatId: seatId,
    currentAction: analyze,
    rootObservation: ready,
    branchObservation: observation(),
    routeTargetId: locked,
  }), null, "分析提交后数据目标应释放，继续搜索后续真实一级收益");
}

{
  const dataRequirements = {
    schemaVersion: "seti-data-analyze-requirements-v1",
    playerId: seatId,
    targetId: "data:analyze",
    computerPlacedCount: 2,
    remainingPlacements: 4,
    availableData: 0,
    dataNeeded: 4,
    nextStep: "scan",
    nextCost: { credits: 1, energy: 2 },
    nextGap: { credits: 0, energy: 2 },
  };
  const rootObservation = {
    ...observation({ resources: { credits: 5, energy: 0, availableData: 0 } }),
    dataAnalyzeRequirements: dataRequirements,
  };
  const creditsForEnergy = {
    ...action("trade:data-energy", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "credits-for-energy" },
    payload: { cost: { credits: 2 }, gain: { energy: 1 } },
  };
  const creditsForCard = {
    ...action("trade:data-card", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "credits-for-card" },
    payload: { cost: { credits: 2 }, gain: { handSize: 1 } },
  };
  const research = { ...action("research:direct-target", "research_tech"), actorId: seatId };
  const rootTargets = evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation,
    legalActions: [creditsForCard, research, creditsForEnergy],
  });
  assert.deepEqual(rootTargets, [{
    targetId: "data:analyze",
    planId: "data:analyze",
    resultTargetIds: ["data:analyze"],
    compatibleActionIds: [creditsForEnergy.actionId],
  }], "根目录只允许结果目标；未绑定具体结果的研究和换牌不能自动包装成目标");
  assert.equal(
    evaluator.requiresRootCounterfactual(creditsForEnergy, rootObservation),
    true,
    "即使扫描暂时不合法，目标 requirement 也必须让必要的第一笔转换进入 root",
  );
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: rootObservation,
      legalSuccessors: [creditsForCard, creditsForEnergy],
      routeTargetId: "data:analyze",
    }).map((candidate) => candidate.actionId),
    [creditsForEnergy.actionId],
    "已选数据目标后应继续同一目标的确定性资源准备",
  );

  const scan = { ...action("scan:data-target", "scan"), actorId: seatId };
  const scanReady = {
    ...observation({ resources: { credits: 1, energy: 2, availableData: 0 } }),
    dataAnalyzeRequirements: {
      ...dataRequirements,
      nextGap: { credits: 0, energy: 0 },
    },
  };
  assert.deepEqual(
    evaluator.enumerateSecondaryAgentRootTargets({
      focalSeatId: seatId,
      rootObservation: scanReady,
      legalActions: [scan, creditsForCard],
    }),
    [{
      targetId: "data:analyze",
      planId: "data:analyze",
      resultTargetIds: ["data:analyze"],
      compatibleActionIds: [scan.actionId],
    }],
    "支付满足后的扫描属于分析目标时不得再复制一个相同动作的直接目标",
  );
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: scanReady,
      legalSuccessors: [creditsForCard, scan],
      routeTargetId: "data:analyze",
    }).map((candidate) => candidate.actionId),
    [scan.actionId],
    "数据目标支付满足后必须执行扫描，不能继续随机换牌",
  );
  const dataChoices = [{
    ...action("choose:data-blue", "choose_target"),
    phase: "conditional",
    actorId: seatId,
    target: { choiceId: "data:blueBonus:1", target: "blueBonus" },
  }, {
    ...action("choose:data-computer", "choose_target"),
    phase: "conditional",
    actorId: seatId,
    target: { choiceId: "data:computer", target: "computer" },
  }, {
    ...action("choose:data-skip", "accept_optional_effect"),
    phase: "conditional",
    actorId: seatId,
    target: { choiceId: "skip:data" },
  }];
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: scanReady,
      legalSuccessors: dataChoices,
      routeTargetId: "data:analyze",
    }).map((candidate) => candidate.actionId),
    ["choose:data-computer"],
    "分析目标的正式放置 Decision 应在建搜索节点前选择计算机位，并排除 skip/蓝附加槽",
  );

  const discardChoices = ["a+b", "a+c", "b+c"].map((choiceId) => ({
    ...action(`choose-payment:${choiceId}`, "choose_payment"),
    phase: "conditional",
    actorId: seatId,
    target: {
      kind: "discard-hand-cards",
      choiceId,
      cardIds: choiceId.split("+"),
      handIndexes: [0, 1],
    },
  }));
  const resourcePayment = evaluator.selectSecondaryAgentSuccessors({
    focalSeatId: seatId,
    branchObservation: scanReady,
    legalSuccessors: discardChoices,
    routeTargetId: "data:analyze",
    routePlanId: "data:analyze",
  });
  assert.deepEqual(
    resourcePayment.map((candidate) => candidate.actionId),
    [discardChoices[0].actionId],
    "资源目标中的等量弃牌支付按终点资源事实等价，只提交一个稳定正式 choice",
  );
  assert.equal(resourcePayment[0].targetEquivalentChoiceCount, 2);
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: scanReady,
      legalSuccessors: discardChoices,
      routeTargetId: "card:resolve:card-a",
      routePlanId: "card:card-a",
    }).map((candidate) => candidate.actionId),
    discardChoices.map((candidate) => candidate.actionId),
    "具体卡牌结果中的非资源支付仍保留全部正式 choice",
  );
  const passReserveChoices = ["reserve-a", "reserve-b"].map((cardId) => ({
    ...action(`choose-pass:${cardId}`, "choose_card"),
    phase: "conditional",
    actorId: seatId,
    target: { kind: "pass-reserve-card", choiceId: cardId, cardId },
  }));
  const terminalChoice = evaluator.selectSecondaryAgentSuccessors({
    focalSeatId: seatId,
    branchObservation: scanReady,
    legalSuccessors: passReserveChoices,
    routeTargetId: null,
    routePlanId: null,
  });
  assert.deepEqual(
    terminalChoice.map((candidate) => candidate.actionId),
    [passReserveChoices[0].actionId],
    "PASS 闭包只按终点资源数量比较，预留牌身份使用显式目标等价代表",
  );
  assert.equal(terminalChoice[0].targetEquivalentChoiceCount, 1);

  const techChoices = ["orange1", "orange2"].map((tileId) => ({
    ...action(`choose:${tileId}`, "choose_target"),
    phase: "conditional",
    actorId: seatId,
    target: { tileId },
  }));
  assert.deepEqual(
    evaluator.enumerateSecondaryAgentRootTargets({
      focalSeatId: seatId,
      rootObservation,
      legalActions: techChoices,
    }),
    techChoices.map((choice) => ({
      targetId: `decision:${choice.actionId}`,
      planId: `decision:${choice.actionId}`,
      resultTargetIds: [`decision:${choice.actionId}`],
      compatibleActionIds: [choice.actionId],
    })),
    "根 conditional 的每个非等价 choice 必须在执行前获得独立目标，且不能被目标目录丢弃",
  );
}

{
  const probeTargetId = "orbit:mars:planet:";
  const probeRequirements = {
    candidates: [{
      requirementId: "probe-1:orbit:mars",
      targetId: probeTargetId,
      required: { credits: 1, energy: 3 },
      gap: { credits: 0, energy: 1 },
      targetBenefit: { score: 6 },
      nextStep: { family: "move", rocketId: "probe-1", deltaX: 1, deltaY: 0 },
    }],
  };
  const branchObservation = {
    ...observation({ resources: { credits: 5, energy: 2 } }),
    probeRouteRequirements: probeRequirements,
  };
  const creditsForEnergy = {
    ...action("trade:credits-for-energy", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "credits-for-energy" },
    payload: { cost: { credits: 2 }, gain: { energy: 1 } },
  };
  const creditsForCard = {
    ...action("trade:credits-for-card", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "credits-for-card" },
    payload: { cost: { credits: 2 }, gain: { handSize: 1 } },
  };
  const endTurn = { ...action("end-turn:probe-gap", "end_turn"), actorId: seatId };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation,
      legalSuccessors: [endTurn, creditsForCard, creditsForEnergy],
      routeTargetId: probeTargetId,
    }).map((candidate) => candidate.actionId),
    [creditsForEnergy.actionId],
    "锁定探测器目标后，下一步缺电应只选择能严格缩小正式资源缺口的转换",
  );
  const corner = {
    ...action("corner:energy", "card_corner"),
    actorId: seatId,
    payload: { kind: "resource" },
  };
  const cornerRoot = {
    ...observation({ resources: { credits: 5, energy: 2 } }),
    probeRouteRequirements: probeRequirements,
  };
  const cornerBranch = {
    ...observation({ resources: { credits: 5, energy: 3 } }),
    probeRouteRequirements: {
      candidates: [{
        ...probeRequirements.candidates[0],
        gap: { credits: 0, energy: 0 },
      }],
    },
  };
  assert.equal(evaluator.selectSecondaryAgentRouteTarget({
    focalSeatId: seatId,
    currentAction: corner,
    rootObservation: cornerRoot,
    branchObservation: cornerBranch,
    routeTargetId: null,
  }), probeTargetId,
  "卡角资源只有严格缩小正式目标缺口时才可锁定该目标，不能作为随机资源根");
  const rawBranchObservation = {
    publicState: {
      players: [{
        id: seatId,
        playerId: seatId,
        resources: { credits: 5, energy: 2 },
      }],
    },
    selfState: { id: seatId, hand: [] },
    probeRouteRequirements: probeRequirements,
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: rawBranchObservation,
      legalSuccessors: [endTurn, creditsForCard, creditsForEnergy],
      routeTargetId: probeTargetId,
    }).map((candidate) => candidate.actionId),
    [creditsForEnergy.actionId],
    "Rule Composition 原始分支投影也必须读取真实资源，不能把5信用误判成0",
  );

  const noCreditSlackObservation = {
    ...observation({ resources: { credits: 1, energy: 2 }, handCount: 2 }),
    probeRouteRequirements: probeRequirements,
  };
  const cardsForEnergy = {
    ...action("trade:cards-for-energy", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "cards-for-energy" },
    payload: { cost: { handSize: 2 }, gain: { energy: 1 } },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: noCreditSlackObservation,
      legalSuccessors: [endTurn, creditsForEnergy, cardsForEnergy],
      routeTargetId: probeTargetId,
    }).map((candidate) => candidate.actionId),
    [cardsForEnergy.actionId],
    "转换不能为了补能量而制造同一探测器目标的信用缺口",
  );

  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation,
      legalSuccessors: [endTurn, creditsForCard],
      routeTargetId: probeTargetId,
    }).map((candidate) => candidate.actionId),
    [creditsForCard.actionId],
    "单步不直接补能量但属于最低损耗完整转换路线时，必须允许继续达成既定目标",
  );
}

{
  const launch = { ...action("launch:route-budget", "launch"), actorId: seatId };
  const unreachableTarget = "land:neptune:planet:";
  const reachableTarget = "orbit:mars:planet:";
  const rootObservation = {
    ...observation({ resources: { credits: 12, energy: 0 } }),
    probeRouteRequirements: {
      candidates: [{
        requirementId: "launch:land:neptune",
        targetId: unreachableTarget,
        required: { credits: 2, energy: 10, movementSteps: 8 },
        gap: { credits: 0, energy: 10 },
        targetBenefit: { score: 12, grossEquivalentValue: 12 },
        nextStep: { family: "launch" },
      }, {
        requirementId: "launch:orbit:mars",
        targetId: reachableTarget,
        required: { credits: 2, energy: 4, movementSteps: 2 },
        gap: { credits: 0, energy: 4 },
        targetBenefit: { score: 8, grossEquivalentValue: 8 },
        nextStep: { family: "launch" },
      }],
    },
  };
  const branchObservation = {
    ...observation({ resources: { credits: 10, energy: 0 } }),
    probeRouteRequirements: {
      candidates: [{
        requirementId: "probe-1:land:neptune",
        targetId: unreachableTarget,
        required: { credits: 0, energy: 10, movementSteps: 8 },
        gap: { credits: 0, energy: 10 },
        targetBenefit: { score: 12, grossEquivalentValue: 12 },
        nextStep: { family: "move" },
      }, {
        requirementId: "probe-1:orbit:mars",
        targetId: reachableTarget,
        required: { credits: 0, energy: 4, movementSteps: 2 },
        gap: { credits: 0, energy: 4 },
        targetBenefit: { score: 8, grossEquivalentValue: 8 },
        nextStep: { family: "move" },
      }],
    },
  };
  assert.deepEqual(
    evaluator.enumerateSecondaryAgentRootTargets({
      focalSeatId: seatId,
      rootObservation,
      legalActions: [launch],
    }),
    [{
      targetId: reachableTarget,
      planId: "probe:launch:orbit:mars",
      resultTargetIds: [reachableTarget],
      compatibleActionIds: [launch.actionId],
    }],
    "乐观转换上界仍不足的正式目标必须在执行发射前删除，但可达目标不得受影响",
  );
  assert.equal(evaluator.selectSecondaryAgentRouteTarget({
    focalSeatId: seatId,
    currentAction: launch,
    rootObservation,
    branchObservation,
    routeTargetId: null,
    focalProxyDepth: 0,
    maxProxyDepth: 15,
  }), reachableTarget,
  "目标选择必须验证正式转换后的资源可达性，不能让资源不足的高分目标挤掉可达目标");
}

{
  const unreachableMove = {
    ...action("move:unreachable", "move"),
    actorId: seatId,
    target: { rocketId: "probe-1", deltaX: 1, deltaY: 0 },
  };
  const reachableMove = {
    ...action("move:reachable", "move"),
    actorId: seatId,
    target: { rocketId: "probe-1", deltaX: 0, deltaY: 1 },
  };
  const branchObservation = {
    ...observation({ resources: { credits: 12, energy: 1 } }),
    probeRouteRequirements: {
      candidates: [{
        requirementId: "probe-1:land:neptune",
        targetId: "land:neptune:planet:",
        required: { credits: 0, energy: 7, movementSteps: 6 },
        gap: { credits: 0, energy: 6 },
        targetBenefit: { score: 12 },
        nextStep: { family: "move", rocketId: "probe-1", deltaX: 1, deltaY: 0 },
      }, {
        requirementId: "probe-1:orbit:mars",
        targetId: "orbit:mars:planet:",
        required: { credits: 0, energy: 3, movementSteps: 2 },
        gap: { credits: 0, energy: 2 },
        targetBenefit: { score: 8 },
        nextStep: { family: "move", rocketId: "probe-1", deltaX: 0, deltaY: 1 },
      }],
    },
  };
  const scheduled = evaluator.selectSecondaryAgentSuccessors({
    focalSeatId: seatId,
    branchObservation,
    legalSuccessors: [unreachableMove, reachableMove],
    routeTargetId: null,
    focalProxyDepth: 1,
    maxProxyDepth: 15,
  });
  assert.deepEqual(
    scheduled.map((candidate) => candidate.actionId),
    [reachableMove.actionId],
    "首个目标完成后应按正式资源缺口选择成本最低的下一个结果目标",
  );
  assert.equal(
    scheduled[0].targetSchedulerPrunedCount,
    1,
    "资源下界目标调度的性能折损必须显式计数",
  );
}

{
  for (const family of [
    "launch",
    "move",
    "quick_trade",
    "place_data",
    "card_corner",
    "scan",
    "orbit",
    "land",
    "analyze",
    "play_card",
    "research_tech",
  ]) {
    assert.equal(
      evaluator.countsSecondaryAgentGoal(action(`route:${family}`, family)),
      false,
      `${family} 仅凭 action family 不能证明结果目标完成，不得消耗15个目标深度`,
    );
  }
}

{
  assert.equal(
    evaluator.completesSecondaryAgentRouteTarget(
      {
        action: action("scan:data-progress", "scan"),
        targetId: "data:analyze",
      },
    ),
    false,
    "分析路线中的扫描只增加代理深度，不能错误释放分析目标",
  );
  assert.equal(
    evaluator.completesSecondaryAgentRouteTarget(
      {
        action: action("analyze:data-complete", "analyze"),
        targetId: "data:analyze",
      },
    ),
    true,
  );
  assert.equal(
    evaluator.completesSecondaryAgentRouteTarget(
      {
        action: {
          ...action("move:mars-progress", "move"),
          target: { rocketId: "probe-1", deltaX: 1, deltaY: 0 },
        },
        targetId: "land:mars:planet:",
      },
    ),
    false,
    "登陆路线中的移动只推进既定目标，不能提前枚举下一目标",
  );
  assert.equal(
    evaluator.completesSecondaryAgentRouteTarget(
      {
        action: {
          ...action("land:mars-complete", "land"),
          target: { rocketId: "probe-1", planetId: "mars", type: "planet" },
        },
        targetId: "land:mars:planet:",
      },
    ),
    true,
  );
}

{
  const base = observation({
    resources: { credits: 2, energy: 2 },
    hand: [{ id: "proxima-card", cardId: "b_102.webp" }],
  });
  const rootObservation = {
    ...base,
    sectorWinRequirements: {
      schemaVersion: "seti-sector-win-requirements-v1",
      playerId: seatId,
      standardScanCost: { credits: 1, energy: 2 },
      wins: [],
      candidates: [{
        targetId: "sector:win:sector-1-a:1",
        sectorId: "sector-1-a",
        minimumOwnMarks: 2,
        openSlotCount: 2,
      }, {
        targetId: "sector:win:sector-3-a:1",
        sectorId: "sector-3-a",
        minimumOwnMarks: 1,
        openSlotCount: 1,
      }, {
        targetId: "sector:win:sector-3-b:1",
        sectorId: "sector-3-b",
        minimumOwnMarks: 4,
        openSlotCount: 4,
      }],
      accessSources: [{
        sourceId: "standard-scan",
        family: "scan",
        sectorIds: ["sector-1-a", "sector-3-a"],
      }, {
        sourceId: "card:proxima-card",
        family: "play_card",
        cardInstanceId: "proxima-card",
        sectorIds: ["sector-3-b"],
      }],
    },
  };
  const scan = { ...action("scan:easiest-sector", "scan"), actorId: seatId };
  const play = {
    ...action("play:proxima-observation", "play_card"),
    actorId: seatId,
    target: { cardInstanceId: "proxima-card" },
  };
  const sectorTargets = evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation,
    legalActions: [scan, play],
  }).filter((target) => target.targetId.startsWith("sector:win:"));
  assert.deepEqual(sectorTargets, [{
    targetId: "sector:win:sector-3-a:1",
    planId: "sector:standard-scan:sector-3-a",
    resultTargetIds: ["sector:win:sector-3-a:1"],
    compatibleActionIds: [scan.actionId],
  }, {
    targetId: "sector:win:sector-3-b:1",
    planId: "sector:card:proxima-card:sector-3-b",
    resultTargetIds: ["sector:win:sector-3-b:1"],
    compatibleActionIds: [play.actionId],
  }], "普通扫描只选择最好赢的可达扇区，同时保留观测比邻星这类专属触达计划");
  const unrelatedTrade = {
    ...action("trade:unrelated-sector", "quick_trade"),
    actorId: seatId,
    payload: { cost: { publicity: 3 }, gain: { handSize: 1 } },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentRootActions({
      focalSeatId: seatId,
      rootObservation,
      legalActions: [unrelatedTrade, scan, play],
    }).map((candidate) => candidate.actionId),
    [scan.actionId, play.actionId],
    "根搜索只执行绑定真实结果目标的 action，不横向试跑无关快速转换",
  );

  assert.equal(evaluator.completesSecondaryAgentRouteTarget({
    action: scan,
    targetId: "sector:win:sector-3-a:1",
    branchObservation: rootObservation,
  }), false, "扫描动作本身不能完成赢得扇区目标");
  assert.equal(evaluator.completesSecondaryAgentRouteTarget({
    action: action("settle:sector-3-a", "choose_reward"),
    targetId: "sector:win:sector-3-a:1",
    branchObservation: {
      ...rootObservation,
      sectorWinRequirements: {
        ...rootObservation.sectorWinRequirements,
        wins: [{ sectorId: "sector-3-a", settlementNumber: 1 }],
      },
    },
  }), true, "只有正式胜场记录新增后才完成扇区目标");
}

{
  const before = {
    ...observation({ income: { credits: 1 } }),
    incomeGainRequirements: {
      schemaVersion: "seti-income-gain-requirements-v1",
      playerId: seatId,
      targetId: "income:gain:1,0,0,0,0,0",
      baseline: {
        credits: 1,
        energy: 0,
        publicity: 0,
        availableData: 0,
        handSize: 0,
        additionalPublicScan: 0,
      },
      plans: [],
    },
  };
  assert.equal(evaluator.completesSecondaryAgentRouteTarget({
    action: action("place-data:income", "place_data"),
    targetId: "income:gain:1,0,0,0,0,0",
    branchObservation: before,
  }), false);
  assert.equal(evaluator.completesSecondaryAgentRouteTarget({
    action: action("place-data:income", "place_data"),
    targetId: "income:gain:1,0,0,0,0,0",
    branchObservation: observation({ income: { credits: 1, energy: 1 } }),
  }), true, "获得收入按正式 income 差量完成，不依赖打牌、放数据或环绕 family");
}

{
  const probeTargetId = "orbit:mars:planet:";
  const incomeTargetId = "income:gain:1,0,0,0,0,0";
  const orbit = {
    ...action("orbit:mars-with-income", "orbit"),
    actorId: seatId,
    target: { planetId: "mars", type: "planet" },
  };
  const rootObservation = {
    ...observation({ income: { credits: 1 } }),
    probeRouteRequirements: {
      candidates: [{
        targetId: probeTargetId,
        requirementId: "orbit:mars:probe-1",
        required: {},
        gap: {},
        nextStep: { family: "orbit", planetId: "mars", targetType: "planet" },
        targetBenefit: { incomeCount: 1 },
      }],
    },
    incomeGainRequirements: {
      targetId: incomeTargetId,
      plans: [{
        planId: "probe:orbit:mars:probe-1",
        kind: "probe",
        probeRequirementId: "orbit:mars:probe-1",
        nextStep: { family: "orbit", planetId: "mars", targetType: "planet" },
      }],
    },
  };
  assert.deepEqual(
    evaluator.enumerateSecondaryAgentRootTargets({
      focalSeatId: seatId,
      rootObservation,
      legalActions: [orbit],
    }),
    [{
      targetId: probeTargetId,
      planId: "probe:orbit:mars:probe-1",
      resultTargetIds: [incomeTargetId, probeTargetId].sort(),
      compatibleActionIds: [orbit.actionId],
    }],
    "同一次环绕同时产生收入时只建立一条物理计划，并声明两个真实结果",
  );
}

{
  const targetId = "land:mars:planet:";
  const branchObservation = {
    ...observation({
      resources: { credits: 4, energy: 2 },
      hand: [{ id: "move-card", cardId: "b_24.webp" }],
    }),
    probeRouteRequirements: {
      candidates: [{
        targetId,
        required: { credits: 0, energy: 2, movementSteps: 2 },
        gap: { credits: 0, energy: 0, movementSteps: 2 },
        nextStep: {
          family: "move",
          rocketId: "probe-1",
          deltaX: 1,
          deltaY: 0,
        },
      }],
    },
  };
  const directMove = {
    ...action("move:direct-to-mars", "move"),
    actorId: seatId,
    target: { rocketId: "probe-1", deltaX: 1, deltaY: 0 },
  };
  const movementCard = {
    ...action("play:b24-to-mars", "play_card"),
    actorId: seatId,
    target: { cardInstanceId: "move-card" },
    payload: { cost: { credits: 1 } },
  };
  const wastefulTrade = {
    ...action("trade:credits-for-energy-before-move", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "credits-for-energy" },
    payload: { cost: { credits: 2 }, gain: { energy: 1 } },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation,
      legalSuccessors: [wastefulTrade, movementCard, directMove],
      routeTargetId: targetId,
    }).map((candidate) => candidate.actionId),
    [directMove.actionId, movementCard.actionId],
    "同一火星登陆目标应保留直接移动和移动牌两种非支配路线，并删除多余换电",
  );
}

{
  const branchObservation = {
    ...observation({
      resources: { credits: 2, energy: 0 },
      ownedTechIds: ["blue1", "blue2"],
      blueBoardSlots: { blue1: 2, blue2: 3 },
    }),
    dataAnalyzeRequirements: {
      targetId: "data:analyze",
      nextGap: { credits: 0, energy: 1 },
      nextCost: { credits: 1, energy: 2 },
    },
  };
  const computer = {
    ...action("choice:data:computer", "choose_target"),
    actorId: seatId,
    phase: "conditional",
    target: { choiceId: "data:computer", target: "computer" },
  };
  const blueCredit = {
    ...action("choice:data:blue1", "choose_target"),
    actorId: seatId,
    phase: "conditional",
    target: { choiceId: "data:blueBonus:2", target: "blueBonus", blueSlot: 2 },
  };
  const blueEnergy = {
    ...action("choice:data:blue2", "choose_target"),
    actorId: seatId,
    phase: "conditional",
    target: { choiceId: "data:blueBonus:3", target: "blueBonus", blueSlot: 3 },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation,
      legalSuccessors: [computer, blueCredit, blueEnergy],
      routeTargetId: "data:analyze",
    }).map((candidate) => candidate.actionId),
    [blueEnergy.actionId],
    "分析路线缺能源时应确定性放到 blue2 奖励位，而不是盲目推进计算机或遍历所有蓝位",
  );
}

function action(actionId, family = "scan") {
  return { actionId, family, phase: "main", target: {} };
}

function evaluate(candidateAction, before, after, status = "settled") {
  return evaluator.evaluateAction({
    seatId,
    legalActions: [candidateAction],
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: candidateAction.actionId,
      status,
      confidence: status === "settled" ? "high" : "none",
      rootObservation: before,
      leaves: status === "settled"
        ? [{
          leafId: `${candidateAction.actionId}:leaf`,
          actionChain: [candidateAction.actionId],
          secondaryAgentTrace: candidateAction.family === "quick_trade"
            ? [
              { family: "quick_trade", target: candidateAction.target, payload: {} },
              { family: "orbit", target: { planetId: "mars" }, payload: {} },
            ]
            : [],
          rootActionSettledLegalSuccessors: candidateAction.family === "quick_trade"
            ? [{ family: "orbit", target: { planetId: "mars" }, payload: {} }]
            : [],
          observation: after,
        }]
        : [],
    }],
  }, candidateAction);
}

{
  const before = observation();
  const result = evaluate(
    action("scan:resources"),
    before,
    observation({ resources: { credits: 2, availableData: 2 } }),
  );
  assert.equal(result.score, null,
    "钱、电、宣传、数据和手牌库存本身不得冒充分数、科技或收入目标");
}

{
  const result = evaluate(
    action("orbit:score", "orbit"),
    observation({ score: 4 }),
    observation({ score: 13 }),
  );
  assert.equal(result.score, 9);
  assert.equal(result.actualScoreDelta, 9);
  assert.deepEqual(result.reasonCodes, ["strategic-goal-score"]);
}

{
  const result = evaluate(
    action("orbit:round-four-score", "orbit"),
    observation({ score: 4, roundNumber: 4 }),
    observation({ score: 13, roundNumber: 4 }),
  );
  assert.equal(result.score, 9, "分数价值不得随轮次下降");
}

{
  const result = evaluate(
    action("trade-then-orbit", "quick_trade"),
    observation({ score: 4, resources: { credits: 2, energy: 0 } }),
    observation({ score: 13, resources: { credits: 0, energy: 1 } }),
  );
  assert.equal(result.primaryValue, 9, "快速转换后的目标分仍按实际一级收益计算");
  assert.equal(result.opportunityCost, 1, "2份资源换1份资源必须体现1份净机会成本");
  assert.equal(result.score, 9, "一级目标收益先于资源效率比较，必要转换不能把正收益路线否决");
  assert.deepEqual(result.sortKey.slice(0, 2), [9, -1]);
}

{
  const ordinaryTrade = {
    ...action("trade:root-random", "quick_trade"),
    payload: { cost: { credits: 2 }, gain: { energy: 1 } },
  };
  assert.equal(
    evaluator.requiresRootCounterfactual(
      ordinaryTrade,
      observation({ resources: { credits: 14, energy: 0 } }),
    ),
    false,
    "未选定代理目标时快速转换不是搜索根，不能随机瓜分全局节点预算",
  );
  assert.equal(
    evaluator.requiresRootCounterfactual(
      ordinaryTrade,
      observation({
        resources: { credits: 14, energy: 0 },
        dataProgress: { computerSlots: [1, 2, 3, 4, 5, 6], analyzeReady: true },
      }),
    ),
    true,
    "分析已经 ready 且缺电时，正式状态本身足以证明换电根的用途",
  );
  const creditsForCard = {
    ...action("trade:card-goal", "quick_trade"),
    payload: { cost: { credits: 2 }, gain: { handSize: 1 } },
  };
  assert.equal(
    evaluator.requiresRootCounterfactual(creditsForCard, observation()),
    false,
    "不知道会抽到哪张牌时，换牌不能被包装成固定打牌目标",
  );
}

{
  const candidateAction = action("trade-route-dominance", "quick_trade");
  const before = observation({ score: 4 });
  const after = observation({ score: 13 });
  const result = evaluator.evaluateAction({
    seatId,
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: candidateAction.actionId,
      status: "settled",
      confidence: "high",
      rootObservation: before,
      leaves: [
        {
          leafId: "wasteful",
          actionChain: ["quick_trade:a", "quick_trade:b", "orbit:c"],
          quickTradeCount: 2,
          secondaryAgentDepth: 3,
          secondaryAgentTrace: [
            { family: "quick_trade", target: { tradeId: "credits-for-energy" }, payload: {} },
            { family: "orbit", target: { planetId: "mars" }, payload: {} },
          ],
          rootActionSettledLegalSuccessors: [
            { family: "orbit", target: { planetId: "mars" }, payload: {} },
          ],
          observation: after,
        },
        {
          leafId: "direct",
          rootRouteTargetId: "data:analyze",
          actionChain: ["quick_trade:a", "orbit:c"],
          quickTradeCount: 1,
          secondaryAgentDepth: 2,
          secondaryAgentTrace: [
            { family: "quick_trade", target: { tradeId: "credits-for-energy" }, payload: {} },
            { family: "orbit", target: { planetId: "mars" }, payload: {} },
          ],
          rootActionSettledLegalSuccessors: [
            { family: "orbit", target: { planetId: "mars" }, payload: {} },
          ],
          observation: after,
        },
      ],
    }],
  }, candidateAction);
  assert.equal(result.selectedLeafId, "direct",
    "同一一级结果必须保留转换更少、代理更短的达成路线");
  assert.equal(result.quickTradeCount, 1);
  assert.equal(result.routeTargetId, "data:analyze",
    "估值结果必须保留搜索开始前选中的次级代理目标，供报告与行为审计");
}

{
  const trade = action("trade-without-purpose", "quick_trade");
  const placeData = {
    ...action("place-data-already-legal", "place_data"),
    target: { slotId: "slot-1" },
  };
  const before = observation({ income: { credits: 0 } });
  const after = observation({ income: { credits: 1 } });
  const result = evaluator.evaluateAction({
    seatId,
    legalActions: [trade, placeData],
    actionOutcomes: [{
      schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
      actionId: trade.actionId,
      status: "settled",
      confidence: "high",
      rootObservation: before,
      leaves: [{
        leafId: "trade-before-already-legal-placement",
        actionChain: [trade.actionId, placeData.actionId],
        quickTradeCount: 1,
        secondaryAgentTrace: [
          { family: "quick_trade", target: { tradeId: "credits-for-energy" }, payload: {} },
          { family: placeData.family, target: placeData.target, payload: placeData.payload },
        ],
        rootActionSettledLegalSuccessors: [placeData],
        observation: after,
      }],
    }],
  }, trade);
  assert.equal(result.score, null,
    "转换后的下一代理在转换前已经合法时，不能把遥远路线收益反复归因给当前转换");
  assert.deepEqual(result.reasonCodes, ["quick-trade-did-not-directly-unlock-agent"]);
}

{
  const result = evaluate(
    action("research:tech", "research_tech"),
    observation({ roundNumber: 2 }),
    observation({ roundNumber: 2, ownedTechIds: ["orange2"] }),
  );
  assert.equal(result.techValue, 10,
    "第2轮科技通用资产只计第3、4轮两个未来窗口，本轮价值必须由真实后续行动兑现");
  assert.equal(result.score, 10);
  assert.deepEqual(result.gainedTechIds, ["orange2"]);
}

{
  const result = evaluate(
    action("research:round-four-tech", "research_tech"),
    observation({ roundNumber: 4 }),
    observation({ roundNumber: 4, ownedTechIds: ["orange2"] }),
  );
  assert.equal(result.score, null,
    "第4轮未使用科技不能凭取得动作获得固定分，本轮能力必须在真实后续行动中兑现");
  assert.deepEqual(result.reasonCodes, ["no-score-tech-or-income-gain"]);
}

{
  const result = evaluate(
    action("research:round-four-realized", "research_tech"),
    observation({ roundNumber: 4, score: 10 }),
    observation({ roundNumber: 4, score: 14, ownedTechIds: ["blue1"] }),
  );
  assert.equal(result.techValue, 0);
  assert.equal(result.actualScoreDelta, 4);
  assert.equal(result.score, 4,
    "第4轮科技带来的首次科技分和数据列分仍按官方实际分累计，不与通用科技价值重复");
}

{
  const result = evaluate(
    action("place-data:income", "place_data"),
    observation({ roundNumber: 2 }),
    observation({ roundNumber: 2, income: { credits: 1 } }),
  );
  assert.equal(result.incomeValue, 10,
    "第2轮增加1信用收入只计第3、4轮两次尚未发生的轮初收入，共10分长期价值");
  assert.equal(result.score, 10);
  assert.deepEqual(result.incomeDelta, {
    credits: 1,
    energy: 0,
    publicity: 0,
    availableData: 0,
    handSize: 0,
    additionalPublicScan: 0,
  });
}

{
  const result = evaluate(
    action("place-data:round-four-income", "place_data"),
    observation({ roundNumber: 4 }),
    observation({ roundNumber: 4, income: { credits: 1 } }),
  );
  assert.equal(result.score, null, "第4轮行动阶段之后已经没有轮初收入窗口，纯收入轨路线不可选");
}

{
  const breakdown = evaluator.evaluateStrategicFactsBreakdown({
    viewerSeatId: seatId,
    terminal: false,
    realizedScore: 10,
    securedEndGameBonus: 0,
    resourceFacts: { credits: 8 },
    ownedTechIds: [],
    income: {},
    roundNumber: 4,
    finalRoundNumber: 4,
  }, {
    viewerSeatId: seatId,
    terminal: true,
    realizedScore: 15,
    securedEndGameBonus: 0,
    resourceFacts: { credits: 0 },
    ownedTechIds: ["blue1"],
    income: { credits: 2 },
    roundNumber: 4,
    finalRoundNumber: 4,
  });
  assert.equal(breakdown.actualScoreDelta, 5);
  assert.equal(breakdown.infrastructure.total, 0);
  assert.equal(breakdown.opportunityCost, 0);
  assert.equal(breakdown.total, 5, "terminal 叶只能比较官方终局分，科技收入和剩余资源均归零");
}

{
  const result = evaluate(
    action("card:combined", "play_card"),
    observation({ roundNumber: 3, score: 2 }),
    observation({
      roundNumber: 3,
      score: 7,
      ownedTechIds: ["blue1"],
      income: { energy: 1 },
    }),
  );
  assert.equal(result.actualScoreDelta, 5);
  assert.equal(result.techValue, 5);
  assert.equal(result.incomeValue, 5);
  assert.equal(result.score, 15,
    "同一真实叶的分数、科技和收入可以合并，但中间资源不得重复计分");
}

{
  const before = observation();
  const result = evaluate(action("scan:unresolved"), before, before, "unresolved");
  assert.equal(result.selectable, false);
  assert.equal(result.score, null);
}

console.log("strategic goal evaluator tests passed");

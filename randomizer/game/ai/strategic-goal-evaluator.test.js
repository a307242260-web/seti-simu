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
  reservedCards = [],
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
      reservedCards,
    },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
}

{
  const cardSettlement = ["confirm", "skip"].map((choice) => ({
    ...action(`${choice}:card-trigger`, "accept_optional_effect"),
    phase: "conditional",
    actorId: seatId,
    target: {
      kind: "residual-domain",
      choiceId: `${choice}:trigger:card-a:rule-a`,
    },
  }));
  const selected = evaluator.selectSecondaryAgentSuccessors({
    focalSeatId: seatId,
    branchObservation: observation(),
    legalSuccessors: cardSettlement,
    routeTargetId: "card:resolve:card-a",
  });
  assert.deepEqual(
    selected.map((candidate) => candidate.actionId),
    [cardSettlement[0].actionId],
    "已正式触发的纯奖励卡牌 settlement 应立即结算，不重复搜索可再次触发的 skip",
  );
  assert.equal(selected[0].targetEquivalentChoiceCount, 1);
}

{
  const phaseLessTechChoices = ["orange1", "orange2"].map((tileId) => ({
    ...action(`choose-tech:${tileId}`, "choose_target"),
    phase: null,
    actorId: seatId,
    target: { choiceId: `tech:${tileId}`, tileId },
  }));
  assert.deepEqual(
    evaluator.selectSecondaryAgentRootActions({
      focalSeatId: seatId,
      rootObservation: observation(),
      legalActions: phaseLessTechChoices,
    }).map((candidate) => candidate.actionId),
    phaseLessTechChoices.map((candidate) => candidate.actionId),
    "Simulation phase=null 的正式 conditional family 仍必须全部进入根 Decision 评估",
  );
}

{
  assert.throws(
    () => evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: observation(),
      legalSuccessors: [{
        ...action("opponent:pass", "pass"),
        actorId: "opponent-seat",
      }],
      routeTargetId: "data:analyze",
    }),
    (error) => error?.code === "SECONDARY_AGENT_OPPONENT_ACTION_FORBIDDEN",
    "单席位规划 selector 不得再以 opponent PASS/end_turn 推进回合",
  );
}

{
  const emptyTraceSlot = () => ({
    revealed: false,
    traces: {
      pink: { firstPlaced: false, extraCount: 0 },
      yellow: { firstPlaced: false, extraCount: 0 },
      blue: { firstPlaced: false, extraCount: 0 },
    },
  });
  const traceChoice = (alienSlotId, traceType = "blue") => ({
    ...action(`choice:trace:${alienSlotId}:${traceType}`, "choose_target"),
    actorId: seatId,
    phase: "conditional",
    target: {
      choiceId: `trace:${alienSlotId}:${traceType}`,
      kind: "planet-reward-alien-trace",
      alienSlotId,
      traceType,
    },
  });
  const choices = [traceChoice(1), traceChoice(2)];

  const firstTrace = evaluator.selectSecondaryAgentSuccessors({
    focalSeatId: seatId,
    branchObservation: observation({ alienSlots: [emptyTraceSlot(), emptyTraceSlot()] }),
    legalSuccessors: choices,
    routeTargetId: "data:analyze",
  });
  assert.deepEqual(
    firstTrace.map((candidate) => candidate.target.alienSlotId),
    [1],
    "未揭示槽的首个痕迹应在执行规则前先剪掉即时奖励被支配的槽位",
  );

  const equalSlot1 = emptyTraceSlot();
  const equalSlot2 = emptyTraceSlot();
  equalSlot1.traces.blue.firstPlaced = true;
  equalSlot2.traces.blue.firstPlaced = true;
  const equalTrace = evaluator.selectSecondaryAgentSuccessors({
    focalSeatId: seatId,
    branchObservation: observation({ alienSlots: [equalSlot1, equalSlot2] }),
    legalSuccessors: choices,
    routeTargetId: "data:analyze",
  });
  assert.deepEqual(
    equalTrace.map((candidate) => candidate.target.alienSlotId),
    [1],
    "两个未揭示槽都只给相同的追加痕迹奖励时应保留一个稳定代表",
  );

  const taskSensitive = evaluator.selectSecondaryAgentSuccessors({
    focalSeatId: seatId,
    branchObservation: observation({
      alienSlots: [emptyTraceSlot(), emptyTraceSlot()],
      reservedCards: [{
        id: "task-b67",
        cardId: "b_67.webp",
        cardEffectState: {
          modelCardId: "b_67.webp",
          completedTaskIds: [],
          consumedTriggerIds: [],
        },
      }],
    }),
    legalSuccessors: choices,
    routeTargetId: "data:analyze",
  });
  assert.deepEqual(
    taskSensitive.map((candidate) => candidate.target.alienSlotId),
    [1, 2],
    "尚未完成的同一外星人痕迹任务会区分槽位，必须保留两个选择",
  );
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
  const ready = {
    ...observation({
      resources: { credits: 4, energy: 0 },
      dataProgress: { computerSlots: [1, 2, 3, 4, 5, 6], analyzeReady: true },
    }),
    dataAnalyzeRequirements: {
      schemaVersion: "seti-data-analyze-requirements-v2",
      targetId: "data:analyze",
      computerPlacedCount: 6,
      remainingPlacements: 0,
      availableData: 0,
      firstRowComplete: true,
      firstRowRemainingPlacements: 0,
      heldDataCanFillFirstRow: true,
      eligible: true,
      nextStep: "analyze",
      nextCost: { credits: 0, energy: 1 },
      nextGap: { credits: 0, energy: 1 },
      acquisitionPlans: [],
    },
  };
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
    payload: { cost: { credits: 2 }, gain: { energy: 1 } },
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
      branchObservation: {
        ...observation({
          resources: { credits: 2, energy: 1 },
          dataProgress: { computerSlots: [1, 2, 3, 4, 5, 6], analyzeReady: true },
        }),
        dataAnalyzeRequirements: {
          ...ready.dataAnalyzeRequirements,
          nextGap: { credits: 0, energy: 0 },
        },
      },
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
  const placeData = { ...action("place-data:first-row", "place_data"), actorId: seatId };
  const trade = {
    ...action("trade:first-row", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "credits-for-energy" },
    payload: { cost: { credits: 2 }, gain: { energy: 1 } },
  };
  const belowThreshold = {
    ...observation({ resources: { credits: 4, availableData: 2 } }),
    dataAnalyzeRequirements: {
      schemaVersion: "seti-data-analyze-requirements-v2",
      targetId: "data:analyze",
      computerPlacedCount: 1,
      remainingPlacements: 5,
      availableData: 2,
      firstRowRemainingPlacements: 3,
      eligible: false,
      nextStep: null,
      nextCost: {},
      nextGap: {},
      acquisitionPlans: [],
    },
  };
  assert.deepEqual(
    evaluator.enumerateSecondaryAgentRootTargets({
      focalSeatId: seatId,
      rootObservation: belowThreshold,
      legalActions: [placeData, trade],
    }).filter((target) => target.targetId === "data:analyze"),
    [],
    "已放1格且手头2数据不足以填满第一行时，不得建立分析目标",
  );
  assert.equal(
    evaluator.requiresRootCounterfactual(trade, belowThreshold),
    true,
    "2026-08-21 迭代：quick_trade 入口门控删除（按目标搜索，门控移到目标目录——"
      + "上面的 enumerateSecondaryAgentRootTargets 断言已确认第一行不可达时无分析目标，"
      + "trade 不在任何目标 compatibleActionIds，不会进根）",
  );
  assert.equal(
    evaluator.selectSecondaryAgentRouteTarget({
      focalSeatId: seatId,
      currentAction: placeData,
      rootObservation: belowThreshold,
      branchObservation: belowThreshold,
      routeTargetId: null,
    }),
    null,
    "第一行不可达时，放置数据不得自动锁定分析路线",
  );

  const canFillFirstRow = {
    ...belowThreshold,
    dataAnalyzeRequirements: {
      ...belowThreshold.dataAnalyzeRequirements,
      availableData: 3,
      heldDataCanFillFirstRow: true,
      eligible: true,
      eligibilityReason: "held-data-can-fill-first-row",
      nextStep: "place_data",
    },
  };
  assert.deepEqual(
    evaluator.enumerateSecondaryAgentRootTargets({
      focalSeatId: seatId,
      rootObservation: canFillFirstRow,
      legalActions: [placeData, trade],
    }).filter((target) => target.targetId === "data:analyze"),
    [{
      targetId: "data:analyze",
      planId: "data:place_data",
      resultTargetIds: ["data:analyze"],
      compatibleActionIds: [placeData.actionId],
    }],
    "手头数据足以填满第一行时，应从正式放置数据开始分析路线",
  );
}

{
  const dataRequirements = {
    schemaVersion: "seti-data-analyze-requirements-v2",
    playerId: seatId,
    targetId: "data:analyze",
    computerPlacedCount: 4,
    remainingPlacements: 2,
    availableData: 0,
    dataNeeded: 2,
    firstRowComplete: true,
    firstRowRemainingPlacements: 0,
    heldDataCanFillFirstRow: true,
    eligible: true,
    nextStep: "acquire_data",
    nextCost: {},
    nextGap: { credits: 0, energy: 2 },
    acquisitionPlans: [{
      planId: "data:scan",
      kind: "scan",
      dataCount: 1,
      nextStep: { family: "scan" },
      nextCost: { credits: 1, energy: 2 },
      resultTargetIds: ["data:analyze"],
    }],
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
    planId: "data:scan",
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
      routePlanId: "data:scan",
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
      planId: "data:scan",
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
      routePlanId: "data:scan",
    }).map((candidate) => candidate.actionId),
    [scan.actionId],
    "数据目标支付满足后必须执行扫描，不能继续随机换牌",
  );
  const probeMove = {
    ...action("move:data-probe", "move"),
    actorId: seatId,
    target: { rocketId: "rocket-data", deltaX: 1, deltaY: 0 },
  };
  const dataCard = {
    ...action("play:data-card", "play_card"),
    actorId: seatId,
    target: { cardInstanceId: "card-data" },
  };
  const dataCorner = {
    ...action("corner:data-card", "card_corner"),
    actorId: seatId,
    target: { cardInstanceId: "corner-data" },
  };
  const multiSourceObservation = {
    ...scanReady,
    probeRouteRequirements: {
      candidates: [{
        requirementId: "rocket-data:land:mars",
        targetId: "land:mars:planet:",
        sourceId: "rocket:rocket-data",
        required: { credits: 0, energy: 1, movementSteps: 1 },
        gap: { credits: 0, energy: 0, movementSteps: 1 },
        nextStep: {
          family: "move",
          rocketId: "rocket-data",
          deltaX: 1,
          deltaY: 0,
        },
        targetBenefit: { score: 6, dataCount: 2 },
      }],
    },
    dataAnalyzeRequirements: {
      ...dataRequirements,
      acquisitionPlans: [
        ...dataRequirements.acquisitionPlans,
        {
          planId: "data:probe:rocket-data:land:mars",
          kind: "probe",
          dataCount: 2,
          probeRequirementId: "rocket-data:land:mars",
          probeTargetId: "land:mars:planet:",
          nextStep: { family: "move" },
          resultTargetIds: ["data:analyze", "land:mars:planet:"],
        },
        {
          planId: "data:card:card-data",
          kind: "card",
          dataCount: 2,
          cardInstanceId: "card-data",
          nextStep: { family: "play_card", cardInstanceId: "card-data" },
          nextCost: {},
          resultTargetIds: ["data:analyze", "card:resolve:card-data"],
        },
        {
          planId: "data:corner:corner-data",
          kind: "card_corner",
          dataCount: 1,
          cardInstanceId: "corner-data",
          nextStep: { family: "card_corner", cardInstanceId: "corner-data" },
          resultTargetIds: ["data:analyze"],
        },
      ],
    },
  };
  const sourceTargets = evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation: multiSourceObservation,
    legalActions: [scan, probeMove, dataCard, dataCorner],
  }).filter((target) => target.targetId === "data:analyze");
  assert.deepEqual(
    Object.fromEntries(sourceTargets.map((target) => [
      target.planId,
      target.compatibleActionIds,
    ])),
    {
      "data:card:card-data": [dataCard.actionId],
      "data:corner:corner-data": [dataCorner.actionId],
      "data:scan": [scan.actionId],
    },
    "数据卡、扫描和数据角标都只能作为完成分析的来源，不能自己成为目标",
  );
  const allSourceTargets = evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation: multiSourceObservation,
    legalActions: [scan, probeMove, dataCard, dataCorner],
  });
  assert.equal(
    allSourceTargets.find((target) => (
      target.planId === "probe:rocket-data:land:mars"
    ))?.resultTargetIds.includes("data:analyze"),
    true,
    "数据登陆路线必须复用原具名登陆目标并标注可继续分析，不能复制第二套路线",
  );
  assert.equal(allSourceTargets.some((target) => (
    target.targetId === "card:resolve:card-data"
  )), false, "获得数据的打牌只能绑定分析结果，不能建立兑现卡牌目标");
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
    "分析目标的正式放置 Decision 需求驱动（2026-08-21 用户裁定：结算不搜索，按"
      + "'我需要什么'选）：无 blue 槽信息/缺口时默认推进 computer（data:analyze "
      + "目标 active 即需求），排除 skip 与 blue 槽",
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
    [reachableMove.actionId, unreachableMove.actionId],
    "首个目标完成后应按正式资源缺口选择成本最低的下一个结果目标；被调度器剪枝的"
      + "高成本目标动作作为未绑定后继仍被返回（被尝试过而非不可见）",
  );
  assert.equal(
    scheduled[0].targetSchedulerPrunedCount,
    1,
    "资源下界目标调度的性能折损必须显式计数",
  );
}

{
  const rotatedNearMove = {
    ...action("move:after-tech-rotation-near", "move"),
    actorId: seatId,
    target: { rocketId: "probe-1", deltaX: 1, deltaY: 0 },
  };
  const staleFarMove = {
    ...action("move:before-tech-rotation-far", "move"),
    actorId: seatId,
    target: { rocketId: "probe-1", deltaX: 0, deltaY: 1 },
  };
  const rotatedObservation = {
    ...observation({ resources: { credits: 3, energy: 3 } }),
    probeRouteRequirements: {
      candidates: [{
        requirementId: "probe-1:land:mars:rotated",
        targetId: "land:mars:planet:",
        required: { credits: 0, energy: 4, movementSteps: 1, movementPoints: 1 },
        gap: { credits: 0, energy: 1 },
        nextStep: { family: "move", rocketId: "probe-1", deltaX: 1, deltaY: 0 },
      }, {
        requirementId: "probe-1:land:jupiter:stale",
        targetId: "land:jupiter:planet:",
        required: { credits: 0, energy: 3, movementSteps: 2, movementPoints: 2 },
        gap: { credits: 0, energy: 0 },
        nextStep: { family: "move", rocketId: "probe-1", deltaX: 0, deltaY: 1 },
      }],
    },
  };
  assert.deepEqual(evaluator.selectSecondaryAgentSuccessors({
    focalSeatId: seatId,
    branchObservation: rotatedObservation,
    legalSuccessors: [staleFarMove, rotatedNearMove],
    routeTargetId: null,
    focalProxyDepth: 1,
    maxProxyDepth: 15,
  }).map((candidate) => candidate.actionId), [rotatedNearMove.actionId, staleFarMove.actionId],
  "科技旋转后的下一目标必须按子状态新距离调度，即使近目标还需一次资源准备；"
    + "被剪枝的远目标动作作为未绑定后继仍被返回");
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
    "统一搜索下根动作只来自目标目录绑定（2026-08-21 用户裁定：无目标的 "
      + "quick_trade/card_corner 非法，不进根评估——手段动作没有目标就是浪费，"
      + "不再 UNIFIED_PURPOSE_FAMILIES 无条件放行）",
  );

  const publicSector1 = {
    ...action("public:sector-1-a", "choose_card"),
    actorId: seatId,
    phase: "conditional",
    target: { cardInstanceId: "public-1", nebulaId: "sector-1-a" },
  };
  const publicSector3 = {
    ...action("public:sector-3-a", "choose_card"),
    actorId: seatId,
    phase: "conditional",
    target: { cardInstanceId: "public-3", nebulaId: "sector-3-a" },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: rootObservation,
      legalSuccessors: [publicSector1, publicSector3],
      routeTargetId: "sector:win:sector-3-b:1",
      routePlanId: "sector:standard-scan:sector-3-b",
    }).map((candidate) => candidate.actionId),
    [publicSector3.actionId],
    "公共牌不能触达当前扇区目标时，只取最好赢的额外扇区，不遍历全部无关扫描",
  );
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: rootObservation,
      legalSuccessors: [publicSector1, publicSector3],
      routeTargetId: "sector:win:sector-1-a:1",
      routePlanId: "sector:standard-scan:sector-1-a",
    }).map((candidate) => candidate.actionId),
    [publicSector1.actionId],
    "公共牌能直接推进当前扇区目标时，必须优先目标扇区而不是更便宜的旁路",
  );

  const endPublicScan = {
    ...action("public:done", "choose_card"),
    actorId: seatId,
    phase: "conditional",
    target: { choiceId: "public:done", done: true },
  };
  const incomeDataReady = {
    ...observation({ resources: { availableData: 2 } }),
    incomeGainRequirements: {
      targetId: "income:gain:3,2,0,0,1,0",
      plans: [{
        planId: "income:data:computer-slot-4",
        kind: "data",
        remainingPlacements: 2,
        nextStep: { family: "place_data" },
      }],
    },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: incomeDataReady,
      legalSuccessors: [publicSector1, publicSector3, endPublicScan],
      routeTargetId: "income:gain:3,2,0,0,1,0",
      routePlanId: "income:data:computer-slot-4",
    }).map((candidate) => candidate.actionId),
    [publicSector1.actionId],
    "已有两数据可填完第3、4格时不再强制结束公共牌扫描（B3a），落入通用扇区收敛只保留代表放置",
  );
  const incomeDataWithScoringScan = {
    ...incomeDataReady,
    sectorWinRequirements: {
      candidates: [{
        sectorId: "sector-1-a",
        openSlotCount: 3,
        minimumOwnMarks: 3,
        nextSlotScore: 2,
      }, {
        sectorId: "sector-3-a",
        openSlotCount: 2,
        minimumOwnMarks: 2,
        nextSlotScore: 0,
      }],
    },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: incomeDataWithScoringScan,
      legalSuccessors: [publicSector1, publicSector3, endPublicScan],
      routeTargetId: "income:gain:3,2,0,0,1,0",
      routePlanId: "income:data:computer-slot-4",
    }).map((candidate) => candidate.actionId),
    [publicSector1.actionId],
    "数据已经足够时，下一落点立即得分仍可消耗额外公共扫描",
  );
  const incomeDataWithCompletingScan = {
    ...incomeDataReady,
    sectorWinRequirements: {
      candidates: [{
        sectorId: "sector-3-a",
        openSlotCount: 1,
        minimumOwnMarks: 1,
        nextSlotScore: 0,
      }],
    },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: incomeDataWithCompletingScan,
      legalSuccessors: [publicSector1, publicSector3, endPublicScan],
      routeTargetId: "income:gain:3,2,0,0,1,0",
      routePlanId: "income:data:computer-slot-4",
    }).map((candidate) => candidate.actionId),
    [publicSector3.actionId],
    "数据已经足够时，能填满并结算扇区仍可消耗额外公共扫描",
  );
  const incomeDataMissing = {
    ...observation({ resources: { availableData: 1 } }),
    incomeGainRequirements: incomeDataReady.incomeGainRequirements,
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: incomeDataMissing,
      legalSuccessors: [publicSector1, publicSector3, endPublicScan],
      routeTargetId: "income:gain:3,2,0,0,1,0",
      routePlanId: "income:data:computer-slot-4",
    }).map((candidate) => candidate.actionId),
    [publicSector1.actionId],
    "数据仍不足时才继续一次启发式公共牌扫描",
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
  const techPlans = [
    ...["blue1", "blue2", "blue3", "blue4"].flatMap((tileId) => (
      [1, 2, 3, 4].map((blueSlot) => ({
        targetId: `tech:gain:${tileId}`,
        planId: `tech:${tileId}:${blueSlot}`,
        tileId,
        blueSlot,
      }))
    )),
    ...["orange1", "orange2", "orange3", "orange4", "purple1", "purple2", "purple3", "purple4"]
      .map((tileId) => ({
        targetId: `tech:gain:${tileId}`,
        planId: `tech:${tileId}:`,
        tileId,
        blueSlot: null,
      })),
  ];
  const branchObservation = {
    ...observation({
      resources: { credits: 4, energy: 4, publicity: 6, availableData: 2 },
    }),
    techGainRequirements: {
      schemaVersion: "seti-tech-gain-requirements-v2",
      playerId: seatId,
      researchCost: 6,
      plans: techPlans,
      publicityPreparationPlans: [],
    },
    dataAnalyzeRequirements: {
      eligible: true,
      computerPlacedCount: 0,
      acquisitionPlans: [{ kind: "scan" }],
    },
  };
  const research = { ...action("research:heuristic-tech", "research_tech"), actorId: seatId };
  const targets = evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation: branchObservation,
    legalActions: [research],
  });
  assert.deepEqual(
    targets.map((target) => [target.targetId, target.planId]),
    [
      ["tech:gain:blue1", "tech:blue1:1"],
      ["tech:gain:blue2", "tech:blue2:1"],
      ["tech:gain:purple4", "tech:purple4:"],
    ],
    "科技按价值打分取 top3（2026-08-18）：有数据且准备扫描时蓝2/蓝1（数据槽）最高，"
      + "purple4（扫描后发射/移动持续收益）第三；一次性解锁（orange1 火箭上限）和"
      + "灵活性（purple1-3）不虚高——废弃硬编码场景规则，搜索覆盖由价值排序决定",
  );
}

{
  const techPlan = {
    targetId: "tech:gain:blue1",
    planId: "tech:blue1:1",
    tileId: "blue1",
    blueSlot: 1,
    required: { publicity: 6 },
    gap: { publicity: 2 },
    nextStep: { family: "research_tech" },
  };
  const techRequirements = {
    schemaVersion: "seti-tech-gain-requirements-v2",
    playerId: seatId,
    researchCost: 6,
    plans: [techPlan],
    publicityPreparationPlans: [{
      planId: "tech:publicity:data-slot-2",
      kind: "place_data",
      targetComputerSlot: 2,
      remainingPlacements: 2,
      publicityGain: 1,
      nextStep: { family: "place_data" },
    }, {
      planId: "tech:publicity:corner:asteroid-flyby",
      kind: "card_corner",
      cardInstanceId: "asteroid-flyby",
      publicityGain: 1,
      nextStep: { family: "card_corner", cardInstanceId: "asteroid-flyby" },
    }],
  };
  const branchObservation = {
    ...observation({
      resources: { credits: 4, energy: 4, publicity: 4, availableData: 2 },
      hand: [{ id: "asteroid-flyby", cardId: "b_11.webp", discardActionCode: 0 }],
    }),
    techGainRequirements: techRequirements,
  };
  const placeData = { ...action("place-data:tech-publicity", "place_data"), actorId: seatId };
  const publicityCorner = {
    ...action("corner:asteroid-publicity", "card_corner"),
    actorId: seatId,
    target: { cardInstanceId: "asteroid-flyby" },
  };
  assert.deepEqual(
    evaluator.enumerateSecondaryAgentRootTargets({
      focalSeatId: seatId,
      rootObservation: branchObservation,
      legalActions: [placeData, publicityCorner],
    }),
    [{
      targetId: techPlan.targetId,
      planId: techPlan.planId,
      resultTargetIds: [techPlan.targetId],
      compatibleActionIds: [placeData.actionId],
    }],
    "宣传不足且数据可推进宣传位时，应先确定性放数据而不并行遍历弃牌顺序",
  );
  const chooseComputer = {
    ...action("choose:computer-for-tech", "choose_target"),
    actorId: seatId,
    target: { target: "computer" },
  };
  const chooseNebula = {
    ...action("choose:nebula-for-tech", "choose_target"),
    actorId: seatId,
    target: { target: "nebula", nebulaId: "sector-2-b" },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation,
      legalSuccessors: [chooseNebula, chooseComputer],
      currentAction: placeData,
      routeTargetId: techPlan.targetId,
      routePlanId: techPlan.planId,
    }).map((candidate) => candidate.actionId),
    [chooseComputer.actionId],
    "为科技补宣传的放数据必须确定性进入计算机，而不是遍历星云",
  );

  const discardObservation = {
    ...observation({
      resources: { credits: 4, energy: 4, publicity: 5, availableData: 0 },
      hand: [
        { id: "asteroid-flyby", cardId: "b_11.webp" },
        { id: "ion-propulsion", cardId: "b_56.webp" },
        { id: "rosetta", cardId: "b_105.webp" },
      ],
    }),
    techGainRequirements: {
      ...techRequirements,
      publicityPreparationPlans: [
        { kind: "card_corner", cardInstanceId: "asteroid-flyby" },
        { kind: "card_corner", cardInstanceId: "ion-propulsion" },
        { kind: "card_corner", cardInstanceId: "rosetta" },
      ],
    },
  };
  const cardCorners = ["asteroid-flyby", "ion-propulsion", "rosetta"].map((cardInstanceId) => ({
    ...action(`corner:${cardInstanceId}`, "card_corner"),
    actorId: seatId,
    target: { cardInstanceId },
  }));
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation: discardObservation,
      legalSuccessors: cardCorners,
      currentAction: action("end-turn:before-tech-corner", "end_turn"),
      routeTargetId: techPlan.targetId,
      routePlanId: techPlan.planId,
    }).map((candidate) => candidate.actionId),
    ["corner:asteroid-flyby"],
    "放数据取得宣传后只弃置下游目标能力最低的飞掠小行星，不遍历科技牌和发射牌",
  );
}

{
  const targetId = "land:venus:planet:";
  const branchObservation = {
    ...observation({
      resources: { credits: 4, energy: 0 },
      hand: [
        { id: "asteroid-flyby", cardId: "b_11.webp", price: 0 },
        { id: "other-card", cardId: "b_56.webp", price: 3 },
      ],
    }),
    probeRouteRequirements: {
      candidates: [{
        targetId,
        requirementId: "probe-1:land:venus",
        required: { credits: 0, energy: 1, movementSteps: 1, movementPoints: 1 },
        gap: { credits: 0, energy: 1, movementSteps: 1 },
        nextStep: {
          family: "move",
          rocketId: "probe-1",
          deltaX: 1,
          deltaY: 0,
        },
      }],
    },
  };
  const endTurn = { ...action("end-turn:play-move-card-next", "end_turn"), actorId: seatId };
  const directMove = {
    ...action("move:spend-energy-now", "move"),
    actorId: seatId,
    target: { rocketId: "probe-1", deltaX: 1, deltaY: 0 },
  };
  const cardsForEnergy = {
    ...action("trade:two-cards-for-move-energy", "quick_trade"),
    actorId: seatId,
    target: { tradeId: "cards-for-energy" },
    payload: { cost: { handSize: 2 }, gain: { energy: 1 } },
  };
  assert.deepEqual(
    evaluator.selectSecondaryAgentSuccessors({
      focalSeatId: seatId,
      branchObservation,
      legalSuccessors: [cardsForEnergy, directMove, endTurn],
      routeTargetId: targetId,
      routePlanId: "probe:probe-1:land:venus",
    }).map((candidate) => candidate.actionId),
    [directMove.actionId, endTurn.actionId],
    "主行动已用完时，应同时保留直接花电与下圈0钱移动牌，并删除弃2牌换1电",
  );
}

{
  const launch = { ...action("launch:distance-pareto", "launch"), actorId: seatId };
  const rootObservation = {
    ...observation({ resources: { credits: 20, energy: 20 } }),
    probeRouteRequirements: {
      candidates: [{
        requirementId: "launch:land:venus",
        targetId: "land:venus:planet:",
        endpointFamily: "land",
        firstRewardSlotOpen: true,
        required: { credits: 2, energy: 4, movementSteps: 2, movementPoints: 2 },
        gap: { credits: 0, energy: 0, movementSteps: 2 },
        targetBenefit: { score: 5, grossEquivalentValue: 5 },
        nextStep: { family: "launch" },
      }, {
        requirementId: "launch:land:saturn",
        targetId: "land:saturn:planet:",
        endpointFamily: "land",
        firstRewardSlotOpen: true,
        required: { credits: 2, energy: 6, movementSteps: 4, movementPoints: 4 },
        gap: { credits: 0, energy: 0, movementSteps: 4 },
        targetBenefit: { score: 4, grossEquivalentValue: 4 },
        nextStep: { family: "launch" },
      }, {
        requirementId: "launch:land:mercury",
        targetId: "land:mercury:planet:",
        endpointFamily: "land",
        firstRewardSlotOpen: true,
        required: { credits: 2, energy: 6, movementSteps: 4, movementPoints: 4 },
        gap: { credits: 0, energy: 0, movementSteps: 4 },
        targetBenefit: { score: 10, grossEquivalentValue: 10 },
        nextStep: { family: "launch" },
      }, {
        requirementId: "launch:orbit:mars",
        targetId: "orbit:mars:planet:",
        endpointFamily: "orbit",
        firstRewardSlotOpen: true,
        required: { credits: 3, energy: 5, movementSteps: 3, movementPoints: 3 },
        gap: { credits: 0, energy: 0, movementSteps: 3 },
        targetBenefit: { score: 3, grossEquivalentValue: 3 },
        nextStep: { family: "launch" },
      }],
    },
  };
  const targetIds = evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation,
    legalActions: [launch],
  }).map((target) => target.targetId);
  assert.deepEqual(targetIds, [
    "land:venus:planet:",
    "orbit:mars:planet:",
  ], "主星登陆和环绕分别只保留第一奖励格为空的最近目标");
}

{
  const launch = { ...action("launch:occupied-first-slot", "launch"), actorId: seatId };
  const makeMainLand = (planetId, movementPoints, firstRewardSlotOpen) => ({
    requirementId: `launch:land:${planetId}`,
    targetId: `land:${planetId}:planet:`,
    planetId,
    endpointFamily: "land",
    endpointTarget: { type: "planet" },
    firstRewardSlotOpen,
    required: {
      credits: 2,
      energy: movementPoints + 2,
      movementSteps: movementPoints,
      movementPoints,
    },
    gap: { credits: 0, energy: 0, movementSteps: movementPoints },
    targetBenefit: { score: 5, grossEquivalentValue: 5 },
    nextStep: { family: "launch" },
  });
  const rootObservation = {
    ...observation({ resources: { credits: 20, energy: 20 } }),
    probeRouteRequirements: {
      candidates: [
        makeMainLand("venus", 1, false),
        makeMainLand("mars", 2, true),
        makeMainLand("saturn", 3, true),
      ],
    },
  };
  assert.deepEqual(evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation,
    legalActions: [launch],
  }).map((target) => target.targetId), [
    "land:venus:planet:",
  ], "2026-08-21 迭代（用户裁定）：不再过滤第一奖励格被占的目标——金星（近、1步）"
    + "即使第一格被占也保留为最近登陆候选，是否值得由估值打分权衡（后续格价值 vs 距离），"
    + "不应一刀切跳到第一格为空但更远的火星");
}

{
  const launch = { ...action("launch:satellite-round-gate", "launch"), actorId: seatId };
  const makeSatellite = (planetId, satelliteId, movementPoints) => ({
    requirementId: `launch:land:${planetId}:${satelliteId}`,
    targetId: `land:${planetId}:satellite:${satelliteId}`,
    planetId,
    endpointFamily: "land",
    endpointTarget: { type: "satellite", satelliteId },
    firstRewardSlotOpen: false,
    required: {
      credits: 2,
      energy: movementPoints + 2,
      movementSteps: movementPoints,
      movementPoints,
    },
    gap: { credits: 0, energy: 0, movementSteps: movementPoints },
    targetBenefit: { score: 5, grossEquivalentValue: 5 },
    nextStep: { family: "launch" },
  });
  const candidates = [
    makeSatellite("jupiter", "io", 2),
    makeSatellite("saturn", "titan", 3),
    makeSatellite("uranus", "titania", 2),
    makeSatellite("neptune", "triton", 4),
  ];
  const targetsForRound = (roundNumber) => evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation: {
      ...observation({
        roundNumber,
        ownedTechIds: ["orange4"],
        resources: { credits: 20, energy: 20 },
      }),
      probeRouteRequirements: { candidates },
    },
    legalActions: [launch],
  }).map((target) => target.targetId);
  assert.deepEqual(targetsForRound(3), [
    "land:jupiter:satellite:io",
    "land:saturn:satellite:titan",
  ], "前三轮卫星登陆只搜索木星和土星");
  assert.deepEqual(targetsForRound(4), [
    "land:jupiter:satellite:io",
    "land:uranus:satellite:titania",
    "land:saturn:satellite:titan",
    "land:neptune:satellite:triton",
  ], "最后一轮才把天王星和海王星卫星加入搜索");
}

{
  const launch = { ...action("launch:orange4-precondition", "launch"), actorId: seatId };
  const research = { ...action("research:orange4-precondition", "research_tech"), actorId: seatId };
  const rootObservation = {
    ...observation({ resources: { credits: 20, energy: 20, publicity: 6 } }),
    probeRouteRequirements: {
      candidates: [{
        requirementId: "launch:land:jupiter",
        targetId: "land:jupiter:planet:",
        planetId: "jupiter",
        endpointFamily: "land",
        endpointTarget: { type: "planet" },
        firstRewardSlotOpen: true,
        required: { credits: 2, energy: 4, movementSteps: 2, movementPoints: 2 },
        gap: { credits: 0, energy: 0, movementSteps: 2 },
        targetBenefit: { score: 5, grossEquivalentValue: 5 },
        nextStep: { family: "launch" },
      }],
    },
    techGainRequirements: {
      playerId: seatId,
      researchCost: 6,
      publicityPreparationPlans: [],
      plans: [{
        targetId: "tech:gain:orange4",
        planId: "tech:orange4:",
        tileId: "orange4",
        required: { publicity: 6 },
        gap: { publicity: 0 },
        nextStep: { family: "research_tech" },
      }],
    },
  };
  assert.equal(evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation,
    legalActions: [launch, research],
  }).some((target) => target.targetId === "tech:gain:orange4"), true,
  "尚无橙4但当前可研究时，应先保留橙4作为木土卫星路线的前置目标");
}

{
  const play = {
    ...action("play:movement-without-purpose", "play_card"),
    actorId: seatId,
    target: { cardInstanceId: "movement-card" },
  };
  const rootObservation = observation({
    hand: [{ id: "movement-card", cardId: "b_11.webp", price: 0 }],
  });
  assert.deepEqual(evaluator.enumerateSecondaryAgentRootTargets({
    focalSeatId: seatId,
    rootObservation,
    legalActions: [play],
  }), [], "没有登陆、环绕、数据、收入或科技目的时，打出移动牌不能成为独立次级目标");
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
  assert.equal(result.score, 9, "一级目标收益先于资源效率比较，必要转换不能把正收益路线否决");
  assert.deepEqual(result.sortKey.slice(0, 2), [9, 0]);
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
    true,
    "2026-08-21 迭代：quick_trade 入口门控删除，无目标转换由目标目录挡住"
      + "（不在任何 compatibleActionIds 就不进根）",
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
    true,
    "2026-08-21 迭代：quick_trade 入口门控删除，换牌是否进根由目标目录判定",
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
  assert.equal(result.techValue, 14,
    "橙2每个剩余轮次计7分，第2轮取得只计第3、4轮共14分");
  assert.equal(result.score, 14);
  assert.deepEqual(result.gainedTechIds, ["orange2"]);
}

{
  const techRates = {
    orange1: 0,
    orange2: 7,
    orange3: 5,
    orange4: 0,
    purple1: 0,
    purple2: 10,
    purple3: 0,
    purple4: 10,
    blue1: 10,
    blue2: 10,
    blue3: 5,
    blue4: 5,
  };
  for (const [tileId, perRound] of Object.entries(techRates)) {
    const breakdown = evaluator.evaluateStrategicFactsBreakdown({
      viewerSeatId: seatId,
      terminal: false,
      realizedScore: 0,
      resourceFacts: {},
      ownedTechIds: [],
      income: {},
      roundNumber: 1,
      finalRoundNumber: 4,
    }, {
      viewerSeatId: seatId,
      terminal: false,
      realizedScore: 0,
      resourceFacts: {},
      ownedTechIds: [tileId],
      income: {},
      roundNumber: 1,
      finalRoundNumber: 4,
    });
    // 蓝槽未来每轮4/3次×0.5，钱电按实际未来轮次折价；当前槽机会独立计算。
    const blueSlotBonus = ["blue1", "blue2", "blue3", "blue4"].includes(tileId)
      ? ({ blue1: 40 / 3, blue2: 32 / 3, blue3: 12, blue4: 16 })[tileId]
      : 0;
    assert.ok(Math.abs(breakdown.infrastructure.techValue - (perRound * 3 + blueSlotBonus)) < 1e-9,
      `${tileId} 必须按独立科技轮次价值 + 蓝槽收益计算`);
  }
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
    action("place-data:round-one-credit-energy-income", "place_data"),
    observation({ roundNumber: 1 }),
    observation({ roundNumber: 1, income: { credits: 1, energy: 1 } }),
  );
  assert.equal(result.incomeValue, 36,
    "第1轮各增加1信用与1能源收入，按第2/3/4轮逐轮折价共计36");
  assert.equal(result.score, 36);
}

{
  const result = evaluate(
    action("place-data:non-credit-energy-income", "place_data"),
    observation({ roundNumber: 1 }),
    observation({ roundNumber: 1, income: { publicity: 1, handSize: 1 } }),
  );
  assert.equal(result.score, 30, "宣传4和手牌6，三个未来收入窗口共计30");
}

{
  const result = evaluate(
    action("place-data:income", "place_data"),
    observation({ roundNumber: 2 }),
    observation({ roundNumber: 2, income: { credits: 1 } }),
  );
  assert.ok(Math.abs(result.incomeValue - 35 / 3) < 1e-9,
    "第2轮增加1信用收入只计第3、4轮两次收入，单价分别20/3和5");
  assert.ok(Math.abs(result.score - 35 / 3) < 1e-9);
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
  assert.ok(Math.abs(result.techValue - (10 + 10 / 3)) < 1e-9,
    "blue1 第3轮取得：基础未来10 + 第4轮单价5×4/3次×0.5");
  assert.equal(result.incomeValue, 4);
  assert.ok(Math.abs(result.score - (5 + 10 + 10 / 3 + 4)) < 1e-9,
    "同一真实叶的分数、科技和收入可以合并，但中间资源不得重复计分");
}

{
  const before = observation();
  const result = evaluate(action("scan:unresolved"), before, before, "unresolved");
  assert.equal(result.selectable, false);
  assert.equal(result.score, null);
}

console.log("strategic goal evaluator tests passed");

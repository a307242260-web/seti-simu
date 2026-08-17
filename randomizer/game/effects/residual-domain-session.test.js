"use strict";

const assert = require("node:assert/strict");
const residual = require("./residual-domain-session");
const probeTurn = require("./probe-turn-session");
const finalScoring = require("../final-scoring");
const cardEffects = require("../cards/effects");
const aliens = require("../aliens");

function createRoot() {
  const taskCard = { id: "task-b1", cardId: "b_1.webp" };
  cardEffects.ensureCardEffectState(taskCard);
  return {
    meta: {
      stateVersion: 3,
      seed: "seti-163-residual-proof",
      rngState: {},
      sequences: { alienEntity: 1, card: 1, finalMark: 1 },
      logicalTime: "2026-07-24T00:00:00.000Z",
    },
    match: { decisionVersion: 7 },
    players: {
      currentPlayerId: "p1",
      players: [
        {
          id: "p1",
          color: "white",
          colorLabel: "白色",
          initialSelection: { industry: { label: "哨兵探测网络" } },
          hand: [],
          reservedCards: [taskCard],
          resources: { credits: 5, energy: 5, publicity: 0, score: 30 },
          income: { credits: 1, energy: 1, publicity: 0, availableData: 0, handSize: 0 },
          scoreSources: { scanScore: 30 },
          techState: { ownedTiles: {}, disabledTiles: {}, blueBoardSlots: {} },
          mainActionCompleted: false,
          passCompletionPending: false,
        },
        {
          id: "p2",
          color: "brown",
          colorLabel: "棕色",
          hand: [],
          reservedCards: [],
          resources: { credits: 4, energy: 4, publicity: 0, score: 10 },
          income: { credits: 1, energy: 1, publicity: 0, availableData: 0, handSize: 0 },
          scoreSources: { orbitScore: 10 },
          techState: { ownedTiles: {}, disabledTiles: {}, blueBoardSlots: {} },
          mainActionCompleted: false,
          passCompletionPending: false,
        },
      ],
    },
    turn: {
      roundNumber: 4,
      turnNumber: 3,
      actionCycleNumber: 2,
      currentPlayerId: "p1",
      startPlayerId: "p1",
      activePlayerIds: ["p1", "p2"],
      turnOrderPlayerIds: ["p1", "p2"],
      passedPlayerIds: ["p1"],
      completedTurnPlayerIds: [],
      cardTurnEventBonuses: [],
      visitedPlanetsByPlayerId: {},
    },
    cards: { publicCards: [], drawPile: [], discardPile: [] },
    aliens: {},
    finalScoring: finalScoring.createFinalScoringState(),
    pieces: { rockets: [] },
    solarSystem: {},
    planets: {},
    data: {
      sectorSettlements: {
        winsByPlayerId: {
          p1: [{ sectorId: "sector-4-a" }, { sectorId: "sector-3-a" }],
        },
      },
    },
    techGameState: { board: { stacks: {} }, ui: {} },
  };
}

function createHarness(module, createDomain) {
  const executors = new Map();
  const domain = module[createDomain]({
    runtime: {
      registerExecutor(type, executor) {
        executors.set(type, typeof executor === "function" ? { execute: executor } : executor);
      },
    },
    commitWorkingState(_state, context) {
      return { committedBy: context.source };
    },
  });
  return { domain, executors };
}

function execute(executor, root, effect) {
  return executor.execute(root, effect, { state: root });
}

function settleFinalMarkEffects(owner, root, spawnedEffects) {
  const queue = [...(spawnedEffects || [])];
  while (queue.length) {
    const effect = queue.shift().effect;
    if (effect.type !== residual.EFFECT_TYPES.FINAL_MARK) continue;
    const executor = owner.executors.get(residual.EFFECT_TYPES.FINAL_MARK);
    const choices = executor.getLegalChoices(root, effect, { state: root });
    assert.ok(choices.length > 0, "终局标记必须有正式合法选择");
    assert.equal(choices[0].presentation?.cardKind, "pick", "终局标记选择必须携带板块图片");
    assert.match(
      String(choices[0].presentation?.imageSrc || ""),
      /^\.\.\/assets\/final\/final_[a-d][12]\.png$/,
      "终局标记选择必须指向终局板块图片",
    );
    const selected = choices[0];
    const settled = executor.resolveDecision(root, effect, selected, { state: root });
    assert.equal(settled.ok, true);
    queue.push(...(settled.spawnedEffects || []));
  }
}

(function proofConsumesRealSeti160HandoffsByEffectType() {
  const root = createRoot();
  root.turn.roundNumber = 3;
  root.players.players[0].mainActionCompleted = true;
  const probe = createHarness(probeTurn, "createProbeTurnDomain");
  const owner = createHarness(residual, "createResidualDomain");
  const endTurn = execute(probe.executors.get(probeTurn.EFFECT_TYPES.EXECUTE), root, {
    ownerId: "p1",
    payload: {
      action: {
        schemaVersion: "seti-standard-action-v1",
        actionId: "end-turn:p1",
        family: "end_turn",
        actorId: "p1",
        target: { kind: "end-turn" },
        payload: {},
      },
    },
  });
  const handoffs = endTurn.spawnedEffects
    .map((entry) => entry.effect)
    .filter((effect) => effect.type === probeTurn.DOMAIN_HANDOFF_EFFECT_TYPE);
  assert.deepEqual(handoffs.map((effect) => (
    `${effect.payload.domain}:${effect.payload.effectType}`
  )), [
      "final_scoring:milestone",
      "alien:turn_end_neutral_milestone", "alien:turn_end_reveal", "company:turn_end", "card_trigger:turn_end",
  ]);
  for (const handoff of handoffs) {
    assert.equal(execute(owner.executors.get(residual.HANDOFF_TYPE), root, handoff).ok, true);
  }
  assert.equal(root.players.players[0].resources.credits, 5,
    "上一轮 end_turn 不得提前结算下一轮收入");
})();

(function proofPlanetIncomeWithoutHandSettlesAsNoop() {
  const root = createRoot();
  const owner = createHarness(residual, "createResidualDomain");
  const settled = execute(owner.executors.get(residual.HANDOFF_TYPE), root, {
    type: residual.HANDOFF_TYPE,
    kind: "effect",
    ownerId: "p1",
    payload: {
      schemaVersion: residual.HANDOFF_SCHEMA,
      domain: "income",
      effectType: "planet_reward_income",
      data: {},
    },
  });
  assert.equal(settled.ok, true);
  assert.deepEqual(settled.spawnedEffects || [], [],
    "无手牌时的星球收入奖励必须直接结算，不能留下零选项 Decision");
})();

(function proofConsumesRealRoundTransitionAndGameEndSequence() {
  for (const [roundNumber, expected] of [
    [3, [
      "income:round_start_income", "income:round_start_income",
      "card_trigger:round_transition", "company:round_start",
    ]],
    [4, ["final_scoring:game_end"]],
  ]) {
    const root = createRoot();
    root.turn.roundNumber = roundNumber;
    root.turn.passedPlayerIds = ["p2"];
    root.players.players[0].passCompletionPending = true;
    const probe = createHarness(probeTurn, "createProbeTurnDomain");
    const owner = createHarness(residual, "createResidualDomain");
    const advanced = execute(
      probe.executors.get(probeTurn.EFFECT_TYPES.TURN_ADVANCE),
      root,
      { ownerId: "p1", payload: { didPass: true } },
    );
    const handoffs = advanced.spawnedEffects.map((entry) => entry.effect);
    assert.deepEqual(handoffs.map((effect) => (
      `${effect.payload.domain}:${effect.payload.effectType}`
    )), expected);
    for (const handoff of handoffs) {
      const settled = execute(owner.executors.get(residual.HANDOFF_TYPE), root, handoff);
      assert.equal(settled.ok, true);
      settleFinalMarkEffects(owner, root, settled.spawnedEffects);
    }
    if (roundNumber === 3) {
      assert.deepEqual(
        root.players.players.map((player) => player.resources.credits),
        [6, 5],
        "跨入新一轮时必须为所有启用玩家统一结算轮初收入",
      );
    }
    if (roundNumber === 4) {
      assert.equal(root.players.players.every((player) => Number.isFinite(player.finalScore)), true);
    }
  }
})();

(function proofIndustryIsQuickAndZeroDecisionFlowCompletes() {
  const root = createRoot();
  root.turn.passedPlayerIds = [];
  const owner = createHarness(residual, "createResidualDomain");
  const result = execute(owner.executors.get(residual.EFFECT_TYPES.EXECUTE), root, {
    ownerId: "p1",
    payload: {
      action: {
        schemaVersion: "seti-standard-action-v1",
        actionId: "industry:sentinel",
        family: "industry",
        actorId: "p1",
        target: {
          companyId: "哨兵探测网络",
          abilityId: "sentinel_arm_play_corner",
        },
        payload: {},
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.spawnedEffects.length, 0);
  assert.equal(root.players.players[0].mainActionCompleted, false);
  assert.equal(root.players.players[0].industrySentinelArmedRound, 4);
})();

// 哨兵补开：本轮先打牌、本次 1x 才武装哨兵 → 补开该打出牌的弃牌角标节点。
(function proofSentinelCornerInjectedAfterArmWithPlayedCard() {
  const root = createRoot();
  root.turn.passedPlayerIds = [];
  const player = root.players.players[0];
  player.industryPlayedCardThisRound = true;
  player.industryPlayedCardRound = 4;
  player.industryPlayedCardTurn = 3;
  player.industryLastPlayedCardThisRound = {
    id: "played-b1",
    cardId: "b_1.webp",
    set: "",
    discardActionCode: 0, // 弃牌角标：1 宣传
  };
  const owner = createHarness(residual, "createResidualDomain");
  const result = execute(owner.executors.get(residual.EFFECT_TYPES.EXECUTE), root, {
    ownerId: "p1",
    payload: {
      action: {
        schemaVersion: "seti-standard-action-v1",
        actionId: "industry:sentinel",
        family: "industry",
        actorId: "p1",
        target: {
          companyId: "哨兵探测网络",
          abilityId: "sentinel_arm_play_corner",
        },
        payload: {},
      },
    },
  });
  assert.equal(result.ok, true);
  const injected = result.spawnedEffects.filter((entry) => (
    entry?.effect?.type === "industry_sentinel_corner"
  ));
  assert.equal(
    injected.length,
    1,
    "打牌后才武装哨兵必须补开 industry_sentinel_corner 节点",
  );
  assert.equal(
    injected[0].effect.payload?.node?.options?.playedCard?.cardId,
    "b_1.webp",
    "补开的哨兵角标节点必须指向本轮打出的牌",
  );
})();

(function proofTurnEndCardTaskRunsInProductionOwner() {
  const root = createRoot();
  const owner = createHarness(residual, "createResidualDomain");
  const handoff = {
    type: residual.HANDOFF_TYPE,
    kind: "effect",
    ownerId: "p1",
    payload: {
      schemaVersion: residual.HANDOFF_SCHEMA,
      domain: "card_trigger",
      effectType: "turn_end",
      data: { roundNumber: 4, turnNumber: 3 },
    },
  };
  const started = execute(owner.executors.get(residual.HANDOFF_TYPE), root, handoff);
  assert.equal(started.ok, true);
  assert.equal(started.spawnedEffects.length, 1);
  const taskEffect = started.spawnedEffects[0].effect;
  const taskExecutor = owner.executors.get(residual.EFFECT_TYPES.CARD_DECISION);
  const choices = taskExecutor.getLegalChoices(root, taskEffect, { state: root });
  const confirm = choices.find((choice) => choice.target.choiceId.startsWith("confirm:"));
  assert.ok(confirm);
  assert.equal(confirm.presentation?.cardKind, "pick", "任务结算选择必须携带卡面");
  assert.match(
    String(confirm.presentation?.imageSrc || ""),
    /b_1\.webp/,
    "任务结算选择必须显示任务卡图",
  );
  assert.ok(
    String(confirm.presentation?.detail || "").length > 0,
    "任务结算选择必须展示任务奖励说明",
  );
  const completed = taskExecutor.resolveDecision(
    root, taskEffect, confirm, { state: root },
  );
  assert.equal(completed.ok, true);
  assert.deepEqual(
    root.cards.discardPile.map((card) => card.id),
    [],
  );
  assert.ok(
    (root.cards.removedFromGameCardIds || []).includes("b_1.webp"),
    "完成任务牌必须移出游戏（removedFromGameCardIds 记录 cardId，不进弃牌堆）",
  );
  assert.equal(root.players.players[0].resources.score, 34);
  assert.equal(root.players.players[0].scoreSources.taskCardScore, 4);
})();

(function proofGameEndWritesEveryPlayerFinalContract() {
  const root = createRoot();
  root.turn.gameEnded = true;
  const owner = createHarness(residual, "createResidualDomain");
  const result = execute(owner.executors.get(residual.HANDOFF_TYPE), root, {
    type: residual.HANDOFF_TYPE,
    kind: "effect",
    ownerId: "p1",
    payload: {
      schemaVersion: residual.HANDOFF_SCHEMA,
      domain: "final_scoring",
      effectType: "game_end",
      data: { roundNumber: 5, gameEnded: true },
    },
  });
  assert.equal(result.ok, true);
  settleFinalMarkEffects(owner, root, result.spawnedEffects);
  for (const player of root.players.players) {
    assert.equal(Number.isFinite(player.finalScore), true);
    assert.equal(player.finalScore, player.finalScoreBreakdown.totalScore);
    assert.deepEqual(Object.keys(player.scoreSources).sort(), [
      "alienCardQuickScore", "alienEffectScore", "alienTraceBlueScore",
      "alienTracePinkScore", "alienTraceYellowScore", "blueTechScore",
      "cardEffectScore", "cardQuickScore", "industryEffectScore",
      "initialScore", "landScore", "orbitScore", "scanScore",
      "taskCardScore", "techBonusScore",
    ].sort());
  }
})();

(function proofAllEightSpeciesRevealThroughProductionOwner() {
  for (const speciesId of residual.SPECIES_IDS) {
    const root = createRoot();
    root.aliens = aliens.createDefaultAlienState();
    for (const traceType of aliens.TRACE_TYPES) {
      assert.equal(aliens.placeFirstTrace(
        root.aliens,
        1,
        traceType,
        traceType === "pink" ? "white" : "brown",
      ).ok, true);
    }
    const owner = createHarness(residual, "createResidualDomain");
    const result = execute(owner.executors.get(residual.HANDOFF_TYPE), root, {
      type: residual.HANDOFF_TYPE,
      kind: "effect",
      ownerId: "p1",
      payload: {
        schemaVersion: residual.HANDOFF_SCHEMA,
        domain: "alien",
        effectType: "reveal_species",
        data: { slotId: 1, speciesId },
      },
    });
    assert.equal(result.ok, true, `${speciesId} 必须由 residual owner 揭示: ${JSON.stringify(result)}`);
    assert.equal(aliens.getAlienSlot(root.aliens, 1).revealed, true);
  }
})();

(function proofType1EventSpawnsAndSettlesProductionDecision() {
  const root = createRoot();
  const triggerCard = { id: "trigger-b140", cardId: "b_140.webp" };
  cardEffects.ensureCardEffectState(triggerCard);
  root.players.players[0].reservedCards = [triggerCard];
  const augmented = residual.augmentEffectResult(root, {
    ok: true,
    nextState: {},
    spawnedEffects: [],
    events: [{ type: "orbit", planetId: "mars", playerId: "p1" }],
  }, { ownerId: "p1" });
  const decisions = augmented.spawnedEffects.filter((entry) => (
    entry.effect.type === residual.EFFECT_TYPES.CARD_DECISION
  ));
  // 规则：一个行动/效果只能触发并覆盖一个任务——同一 orbit 事件的所有匹配
  // 合并为一个多选一 Decision（b140 的两个触发槽只能选择其一结算）。
  assert.equal(decisions.length, 1, "真实 orbit event 只能产生一个 type1 Decision（多选一）");
  const owner = createHarness(residual, "createResidualDomain");
  const executor = owner.executors.get(residual.EFFECT_TYPES.CARD_DECISION);
  const first = decisions[0].effect;
  const choices = executor.getLegalChoices(root, first, { state: root });
  const confirms = choices.filter((entry) => entry.target.choiceId.startsWith("confirm:"));
  assert.equal(confirms.length, 2, "b140 的两个触发槽必须都作为候选列出，由玩家选一");
  assert.equal(choices.some((entry) => entry.target.choiceId.startsWith("skip:")), true);
  const settled = executor.resolveDecision(root, first, confirms[0], { state: root });
  assert.equal(settled.ok, true);
})();

(function testHandAndPublicCardPickChoicesCarryCardFace() {
  const root = createRoot();
  root.players.players[0].hand = [
    { id: "h-1", cardId: "b_137.webp", cardName: "测试手牌", faceUp: true },
  ];
  root.cards.publicCards = [
    { id: "pub-1", cardId: "b_83.webp", cardName: "测试公共牌", faceUp: true },
  ];
  const owner = createHarness(residual, "createResidualDomain");
  const getLegalChoices = owner.executors.get(residual.EFFECT_TYPES.COMPANY_DECISION).getLegalChoices;
  const handChoices = getLegalChoices(root, {
    ownerId: "p1",
    payload: { companyId: "哨兵探测网络", step: "income_card" },
  }, { state: root });
  assert.equal(handChoices.length, 1, "手牌选牌必须有 1 个选择");
  assert.equal(handChoices[0].presentation?.cardKind, "pick", "手牌选牌必须携带卡面 cardKind");
  assert.match(String(handChoices[0].presentation?.imageSrc || ""), /b_137/);
  const publicChoices = getLegalChoices(root, {
    ownerId: "p1",
    payload: { companyId: "哨兵探测网络", step: "public_card" },
  }, { state: root });
  assert.equal(publicChoices.length, 1, "公共牌选牌必须有 1 个选择");
  assert.equal(publicChoices[0].presentation?.cardKind, "pick", "公共牌选牌必须携带卡面 cardKind");
  assert.match(String(publicChoices[0].presentation?.imageSrc || ""), /b_83/);
})();

(function proofAmiba1ResearchTechTaskSpawnsSymbolChoice() {
  // amiba_1 牌：研究橙色科技 → 橙色区域 symbol 奖励必须弹细胞器选择决策（不自动结算）
  const root = createRoot();
  const amiba1 = aliens.amiba.createAlienCard(1, 5);
  root.players.players[0].reservedCards = [amiba1];
  root.turn.type1TriggerEvents = [{ type: "researchTech", techType: "orange" }];
  const owner = createHarness(residual, "createResidualDomain");
  const handoff = {
    type: residual.HANDOFF_TYPE,
    kind: "effect",
    ownerId: "p1",
    payload: {
      schemaVersion: residual.HANDOFF_SCHEMA,
      domain: "card_trigger",
      effectType: "turn_end",
      data: { roundNumber: 3, turnNumber: 2 },
    },
  };
  const started = execute(owner.executors.get(residual.HANDOFF_TYPE), root, handoff);
  assert.equal(started.ok, true, JSON.stringify(started));
  const taskEffect = started.spawnedEffects.find((entry) => (
    entry.effect.type === residual.EFFECT_TYPES.CARD_DECISION
  ))?.effect;
  assert.ok(taskEffect, "研究橙色科技必须触发 amiba_1 任务 Decision");
  const executor = owner.executors.get(residual.EFFECT_TYPES.CARD_DECISION);
  const choices = executor.getLegalChoices(root, taskEffect, { state: root });
  const confirm = choices.find((choice) => choice.target.choiceId.startsWith("confirm:"));
  assert.ok(confirm, "amiba_1 任务必须有确认选项");
  const completed = executor.resolveDecision(root, taskEffect, confirm, { state: root });
  assert.equal(completed.ok, true, JSON.stringify(completed));
  const symbolDecision = (completed.spawnedEffects || []).find((entry) => (
    String(entry.effect?.type || "").includes("amiba_choose_symbol_reward")
  ));
  assert.ok(
    symbolDecision,
    "amiba_1 任务结算必须生成细胞器选择决策，而不是自动结算",
  );
})();

console.log("residual-domain-session production proofs passed");

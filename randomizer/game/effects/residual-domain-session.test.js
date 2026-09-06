"use strict";

const assert = require("node:assert/strict");
const residual = require("./residual-domain-session");
const probeTurn = require("./probe-turn-session");
const finalScoring = require("../final-scoring");
const cardEffects = require("../cards/effects");
const aliens = require("../aliens");
const data = require("../data");

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

(function roundIncomeCreatesUsableDataForEachOwner() {
  for (const existing of [0, 5, 6]) {
    for (const amount of [0, 2]) {
      const root = createRoot();
      root.meta.sequences.dataToken = 1;
      for (const player of root.players.players) {
        player.resources.availableData = 0;
        player.income.availableData = amount;
        for (let i = 0; i < existing; i += 1) assert.equal(data.gainData(player, { root }).ok, true);
      }
      const beforeSequence = root.meta.sequences.dataToken;
      const beforeRng = structuredClone(root.meta.rngState);
      const owner = createHarness(residual, "createResidualDomain");
      for (const player of root.players.players) {
        const beforeTokens = data.listPoolTokens(player);
        const settled = execute(owner.executors.get(residual.HANDOFF_TYPE), root, {
          ownerId: player.id,
          payload: { schemaVersion: residual.HANDOFF_SCHEMA, domain: "income", effectType: "round_start_income", data: {} },
        });
        assert.equal(settled.ok, true);
        const expected = Math.min(6, existing + amount);
        assert.equal(data.listPoolTokens(player).length, expected, "轮初数据收入必须生成可放置token");
        assert.equal(player.resources.availableData, expected);
        assert.deepEqual(data.listPoolTokens(player).slice(0, existing), beforeTokens);
        assert.equal(player.dataState?.discardedCount || 0, Math.max(0, existing + amount - 6));
        assert.equal(data.canPlaceAnyData(player).ok, expected > 0);
      }
      const tokens = root.players.players.flatMap(player => data.listPoolTokens(player));
      assert.equal(new Set(tokens.map(token => token.id)).size, tokens.length);
      assert.equal(root.meta.sequences.dataToken, beforeSequence + 2 * Math.min(amount, 6 - existing));
      assert.deepEqual(root.meta.rngState, beforeRng, "纯数据收入不消耗抽牌RNG");
    }
  }
})();

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

// 赫利昂 1x「1 次收入」= 插入一张牌到收入列：收入栏提升 + 立即奖励（gainIncome 语义）。
(function proofHeliosIncomeCardInsertsIntoIncomeColumn() {
  const root = createRoot();
  root.turn.passedPlayerIds = [];
  const player = root.players.players[0];
  player.hand = [{ id: "h-inc", cardId: "b_2.webp", incomeCode: 0 }]; // 收入 0 = +1 信用点
  const beforeCredits = player.income.credits;
  const owner = createHarness(residual, "createResidualDomain");
  const executor = owner.executors.get(residual.EFFECT_TYPES.COMPANY_DECISION);
  const effect = {
    ownerId: "p1",
    payload: { companyId: "哨兵探测网络", step: "income_card" },
  };
  const legal = executor.getLegalChoices(root, effect, { state: root });
  assert.equal(legal.length, 1, "赫利昂收入牌必须有 1 个手牌选择");
  const settled = executor.resolveDecision(root, effect, legal[0], { state: root });
  assert.equal(settled.ok, true);
  assert.equal(
    player.income.credits,
    beforeCredits + 1,
    "赫利昂收入牌必须插入收入列（收入栏 +1）",
  );
  assert.equal(player.hand.length, 0, "收入牌必须移出游戏");
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

// ---------------------------------------------------------------------------
// 寰宇动力 1x 合法性：枚举为合法的动作执行后必能继续（否则 free_move 会话
// 0 选项 → 机器席位 MACHINE_PLAYER_BOUNDARY_EMPTY 死局）。合法性（industry
// 动作枚举）与 free_move 会话枚举共用 listHuanyuMoveChoices 同一判定。
// ---------------------------------------------------------------------------

function huanyuRoot() {
  const root = createRoot();
  root.turn.passedPlayerIds = [];
  root.players.players[0].initialSelection = { industry: { label: "寰宇动力" } };
  return root;
}

function industryDefinition() {
  return residual.createActionDefinitions()[0];
}

{
  // 崩溃回归：无任何探测器时，industry 动作不得枚举（此前被枚举为合法，
  // 执行后 free_move 会话 0 选项，下一决策 BOUNDARY_EMPTY）
  const root = huanyuRoot();
  root.pieces.rockets = [];
  const choices = industryDefinition().enumerate({
    state: root,
    standardActionAuthority: { actorId: "p1" },
    turn: root.turn,
  });
  assert.equal(choices.length, 0, "寰宇动力无可移动探测器时不得枚举 industry 动作");
}

{
  // 同 class 守卫：图灵系统无可用橙/紫科技槽时不得枚举（turing_tech 会话 0 选项）
  const root = createRoot();
  root.turn.passedPlayerIds = [];
  root.players.players[0].initialSelection = { industry: { label: "图灵系统" } };
  root.tech = { board: { stacks: {} } }; // 无任何科技供应
  const choices = industryDefinition().enumerate({
    state: root,
    standardActionAuthority: { actorId: "p1" },
    turn: root.turn,
  });
  assert.equal(choices.length, 0, "图灵系统无可借用橙/紫科技时不得枚举 industry 动作");
}

{
  // 同 class 守卫：宣传选牌类公司无公共牌时不得枚举（public_card 会话 0 选项）
  const root = createRoot();
  root.turn.passedPlayerIds = [];
  root.players.players[0].initialSelection = { industry: { label: "任务中继站" } };
  root.players.players[0].resources.publicity = 5;
  root.cards.publicCards = []; // 无公共牌
  const choices = industryDefinition().enumerate({
    state: root,
    standardActionAuthority: { actorId: "p1" },
    turn: root.turn,
  });
  assert.equal(choices.length, 0, "任务中继站无公共牌时不得枚举 industry 动作");
}

{
  // 正例：有太阳系探测器时 industry 可枚举，且执行后 free_move 会话必有选择
  const root = huanyuRoot();
  root.pieces.rockets = [{
    id: 1,
    playerId: "p1",
    color: "white",
    surface: "solar-board",
    sectorX: 0,
    sectorY: 2,
    slotIndex: 0,
  }];
  const choices = industryDefinition().enumerate({
    state: root,
    standardActionAuthority: { actorId: "p1" },
    turn: root.turn,
  });
  assert.equal(choices.length, 1, "有可移动探测器时 industry 必须可枚举");
  assert.equal(choices[0].target.abilityId, "huanyu_free_moves", "能力必须是 huanyu_free_moves");

  const owner = createHarness(residual, "createResidualDomain");
  const result = execute(owner.executors.get(residual.EFFECT_TYPES.EXECUTE), root, {
    ownerId: "p1",
    payload: {
      action: {
        schemaVersion: "seti-standard-action-v1",
        actionId: "industry:huanyu",
        family: "industry",
        actorId: "p1",
        target: { companyId: "寰宇动力", abilityId: "huanyu_free_moves" },
        payload: {},
      },
    },
  });
  assert.equal(result.ok, true);
  const freeMove = (result.spawnedEffects || []).find((entry) => (
    entry?.effect?.type === residual.EFFECT_TYPES.COMPANY_DECISION
    && entry?.effect?.payload?.step === "free_move"
  ));
  assert.ok(freeMove, "执行寰宇动力必须生成 free_move 决策");
  const moveChoices = owner.executors
    .get(residual.EFFECT_TYPES.COMPANY_DECISION)
    .getLegalChoices(root, freeMove.effect, { state: root });
  assert.ok(moveChoices.length > 0, "free_move 会话必须有合法移动选择（合法性与枚举一致）");
  const executor = owner.executors.get(residual.EFFECT_TYPES.COMPANY_DECISION);
  for (const selected of moveChoices) {
    const working = structuredClone(root);
    const beforeResources = structuredClone(working.players.players[0].resources);
    const moved = executor.resolveDecision(working, freeMove.effect, selected, { state: working });
    assert.equal(moved.ok, true, JSON.stringify(moved));
    assert.equal(moved.spawnedEffects.length, 0, "只有一艘火箭，不能生成空的第二次移动");
    assert.equal(working.players.players[0].resources.energy, beforeResources.energy);
    assert.equal(working.players.players[0].resources.credits, beforeResources.credits);
    if (selected.target.skip) {
      assert.deepEqual(working, root, "结束移动不改变资源或位置");
      assert.equal(moved.events[0].type, "company_move_skipped");
    } else {
      const event = moved.events.find((item) => item.type === "move");
      assert.ok(event, "公司路径不得丢弃正式移动事件");
      assert.equal(event.source, "industry");
      assert.equal(event.rocketId, 1);
      assert.notDeepEqual(working.pieces.rockets, root.pieces.rockets);
    }
  }
  const twoRockets = structuredClone(root);
  twoRockets.pieces.rockets.push({ ...root.pieces.rockets[0], id: 2, sectorX: 1 });
  const first = executor.getLegalChoices(twoRockets, freeMove.effect, { state: twoRockets })
    .find((item) => item.target.rocketId === 1);
  const movedFirst = executor.resolveDecision(twoRockets, freeMove.effect, first, { state: twoRockets });
  assert.equal(movedFirst.ok, true);
  assert.equal(movedFirst.spawnedEffects.length, 1);
  const second = movedFirst.spawnedEffects[0].effect;
  assert.deepEqual(second.payload.usedRocketIds, [1]);
  const secondChoices = executor.getLegalChoices(twoRockets, second, { state: twoRockets });
  assert.ok(secondChoices.some((item) => item.target.skip), "最多两个允许第二次结束");
  assert.ok(secondChoices.some((item) => item.target.rocketId === 2));
  assert.ok(secondChoices.every((item) => item.target.skip || item.target.rocketId === 2));
  for (const selected of secondChoices) {
    const working = structuredClone(twoRockets);
    const moved = executor.resolveDecision(working, second, selected, { state: working });
    assert.equal(moved.ok, true);
    assert.equal(moved.spawnedEffects.length, 0);
  }
  const beforeStale = structuredClone(twoRockets);
  assert.equal(executor.resolveDecision(twoRockets, second, first, { state: twoRockets }).ok, false);
  assert.deepEqual(twoRockets, beforeStale, "重复移动首艘的失效选择不得改变状态");
  const arrival = structuredClone(root);
  arrival.pieces.rockets[0].sectorY = 0;
  const towardMercury = executor.getLegalChoices(arrival, freeMove.effect, { state: arrival })
    .find((item) => item.target.deltaX === 1);
  const arrived = executor.resolveDecision(arrival, freeMove.effect, towardMercury, { state: arrival });
  assert.equal(arrived.ok, true);
  const visits = arrived.events.filter((event) => event.type === "visitPlanet");
  assert.equal(visits.length, 1, "到达水星只产生一次访问事件");
  assert.equal(visits[0].planetId, "mercury");
  assert.equal(visits[0].publicityGained, 1);
  assert.equal(visits[0].source, "industry");
  assert.equal(arrival.players.players[0].resources.publicity, root.players.players[0].resources.publicity + 1);
}

for (const companyId of ["层云核心", "芬威克研究中心", "哨兵探测网络"]) {
  for (const hasRocket of [false, true]) {
    const root = huanyuRoot();
    root.players.players[0].initialSelection.industry.label = companyId;
    root.players.players[0].resources.publicity = 2;
    if (hasRocket) root.pieces.rockets = [{
      id: 1, playerId: "p1", color: "white", surface: "solar-board",
      sectorX: 0, sectorY: 2, slotIndex: 0,
    }];
    const card = { id: "move-corner", cardId: "b_1.webp" };
    root.cards.publicCards = [card];
    const owner = createHarness(residual, "createResidualDomain");
    const executor = owner.executors.get(residual.EFFECT_TYPES.COMPANY_DECISION);
    let applied;
    if (companyId === "哨兵探测网络") {
      applied = execute(owner.executors.get("industry_sentinel_corner"), root, {
        ownerId: "p1", payload: { playedCard: card },
      });
    } else {
      const effect = { ownerId: "p1", payload: {
        companyId,
        abilityId: companyId === "层云核心" ? "stratus_public_corners" : "fenwick_publicity_pick_corner",
        step: companyId === "层云核心" ? "stratus_corner" : "public_card",
        index: 0, node: { options: { reward: { kind: "move", movementPoints: 1 } } },
      } };
      const [selected] = executor.getLegalChoices(root, effect, { state: root });
      assert.ok(selected);
      applied = executor.resolveDecision(root, effect, selected, { state: root });
    }
    assert.equal(applied.ok, true, JSON.stringify(applied));
    const moves = applied.spawnedEffects.filter((entry) => entry.effect.payload?.step === "free_move");
    assert.equal(moves.length, hasRocket ? 1 : 0, `${companyId}无目标时不创建空移动`);
    if (hasRocket) {
      const effect = moves[0].effect;
      const selected = executor.getLegalChoices(root, effect, { state: root }).find((item) => !item.target.skip);
      const moved = executor.resolveDecision(root, effect, selected, { state: root });
      assert.equal(moved.ok, true);
      assert.ok(moved.events.some((item) => item.type === "move" && item.source === "industry"));
    }
  }
}

for (const speciesId of ["yichangdian", "banrenma", "chong", "amiba", "aomomo", "runezu"]) {
  for (const hasCards of [false, true]) {
    const root = createRoot();
    const owner = createHarness(residual, "createResidualDomain");
    const executor = owner.executors.get(residual.EFFECT_TYPES.ALIEN_CARD_DECISION);
    const effect = { ownerId: "p1", payload: { speciesId } };
    executor.getLegalChoices(root, effect, { state: root });
    root.aliens[speciesId].cardDeck = hasCards ? [0, 1] : [];
    root.aliens[speciesId].displayedCardIndex = hasCards ? 2 : null;
    const choices = executor.getLegalChoices(root, effect, { state: root });
    const cancel = choices.find(action => action.target.source === "cancel");
    assert.ok(cancel, `${speciesId}保留取消选择`);
    const before = structuredClone(root);
    const settled = executor.resolveDecision(root, effect, cancel, { state: root });
    assert.equal(settled.ok, true);
    assert.ok(Object.hasOwn(settled, "nextState"), `${speciesId}取消必须返回正式nextState`);
    assert.deepEqual(root, before, `${speciesId}取消不得改牌堆、玩家、RNG或序列`);
    assert.deepEqual(settled.spawnedEffects, []);
    assert.equal(settled.irreversible, null);
    assert.equal((settled.events || []).length, 0);
  }
}

console.log("residual-domain-session production proofs passed");

"use strict";

const assert = require("node:assert/strict");
const aomomo = require("../game/aliens/aomomo");
const amiba = require("../game/aliens/amiba");
const banrenma = require("../game/aliens/banrenma");
const chong = require("../game/aliens/chong");
const endGameScoring = require("../game/end-game-scoring");
const fangzhou = require("../game/aliens/fangzhou");
const jiuzhe = require("../game/aliens/jiuzhe");
const runezu = require("../game/aliens/runezu");
const yichangdian = require("../game/aliens/yichangdian");
const alienCore = require("../game/aliens");
const setiAi = require("../game/ai");
const { createAiControllerHarness, makeActionList, makeButton } = require("./ai-controller-test-harness");
const {
  makeAomomoAlienState,
  makeBanrenmaAlienState,
  makeChongAvailableFossilAlienState,
  makeChongTransportAlienState,
  makeHiddenAlienSlot,
  makeYichangdianAlienState,
} = require("./ai-controller-integration-fixtures");

{
  const passCards = [
    {
      id: "reserve-low",
      cardName: "Reserve low",
      typeCode: 1,
      price: 1,
    },
    {
      id: "reserve-type3",
      cardName: "Reserve type 3",
      typeCode: 3,
      price: 2,
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    blueResources: { score: 39, credits: 1, energy: 0, publicity: 1, availableData: 0, handSize: 4 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 2,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
    finalScoringState: {
      tiles: {
        final_c2: {
          id: "final_c2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
      },
    },
    finalFormulaIds: {
      final_c2: "c2",
    },
    finalSlotMultipliers: {
      c2: { 1: 6 },
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve PASS reserve selection without entering full action scoring");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-type3" });
}

{
  const passCards = [
    {
      id: "reserve-low",
      cardName: "Reserve low",
      typeCode: 1,
      price: 1,
    },
    {
      id: "reserve-type3",
      cardName: "Reserve type 3",
      typeCode: 3,
      price: 2,
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    blueResources: { score: 18, credits: 0, energy: 1, publicity: 1, availableData: 0, handSize: 1 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 1,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should rank PASS reserve cards even without a C2 final mark");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-type3" });
}

{
  const passCards = [
    {
      id: "reserve-low-first",
      cardName: "Reserve low first",
      typeCode: 1,
      price: 4,
    },
    {
      id: "reserve-direct-score",
      cardName: "Reserve direct score",
      typeCode: 1,
      price: 1,
      playEffects: [{ type: "gain_resources", options: { gain: { score: 6 } } }],
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    blueResources: { score: 18, credits: 1, energy: 1, publicity: 1, availableData: 0, handSize: 0 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 1,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should rank ordinary PASS reserve cards when the hand is empty");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-direct-score" });
}

{
  const passCards = [
    {
      id: "reserve-low-first",
      cardName: "Reserve low first",
      typeCode: 1,
      price: 1,
    },
    {
      id: "reserve-energy-income",
      cardName: "Reserve energy income",
      typeCode: 1,
      price: 2,
      incomeGain: { energy: 1 },
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    blueResources: { score: 42, credits: 2, energy: 0, publicity: 1, availableData: 1, handSize: 2 },
    blueIncome: { credits: 3, energy: 1, handSize: 2 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 2,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should rank PASS reserve cards under resource pressure");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-energy-income" });
}

{
  const passCards = [
    {
      id: "reserve-low-first",
      cardName: "Reserve low first",
      typeCode: 1,
      price: 1,
    },
    {
      id: "reserve-energy-income",
      cardName: "Reserve energy income",
      typeCode: 1,
      price: 2,
      incomeGain: { energy: 1 },
    },
  ];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    blueResources: { score: 22, credits: 2, energy: 0, publicity: 1, availableData: 0, handSize: 2 },
    blueIncome: { credits: 3, energy: 1, handSize: 2 },
    pendingPassReserveSelection: {
      playerId: "player-blue",
      roundNumber: 1,
      effectId: "pass-reserve-pick",
      selectedCardId: null,
    },
    passReserveCards: passCards,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "round 1 resource pressure should remain diagnostic-only");
  assert.deepEqual(harness.getHandled(), { type: "pass-reserve", cardId: "reserve-low-first" });
  const passReserveLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "pass-reserve");
  assert.equal(passReserveLog?.details?.passReserveResourcePressure?.active, false);
  assert.equal(passReserveLog?.details?.passReserveResourcePressurePreview?.active, true);
  assert.equal(passReserveLog?.details?.passReserveResourcePressureMiss, true);
  assert.deepEqual(
    passReserveLog?.details?.passReserveResourcePressurePreview?.incomeCandidates?.map((entry) => entry.cardId),
    ["reserve-energy-income"],
  );
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    actionEffectFlowActive: true,
    recordExecuteActionEffect: true,
    currentActionEffect: {
      id: "research-tech-bonus",
      type: "research_tech_bonus",
      label: "获取3 分",
      status: "active",
      playerId: "player-blue",
    },
    pendingActionEffectFlow: {
      playerId: "player-blue",
      currentIndex: 0,
      effects: [],
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute active research tech bonus before optional opportunity scans");
  assert.deepEqual(harness.getHandled(), {
    type: "effect",
    effectId: "research-tech-bonus",
    effectType: "research_tech_bonus",
  });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    readyBanrenmaPlayerColor: "blue",
    actionEffectFlowActive: true,
    recordExecuteActionEffect: true,
    currentActionEffect: {
      id: "research-tech-bonus",
      type: "research_tech_bonus",
      label: "获取1 能量",
      status: "active",
      playerId: "player-blue",
    },
    pendingActionEffectFlow: {
      playerId: "player-blue",
      currentIndex: 0,
      effects: [],
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute active effects before opening ready Banrenma opportunities");
  assert.deepEqual(harness.getHandled(), {
    type: "effect",
    effectId: "research-tech-bonus",
    effectType: "research_tech_bonus",
  });
}

{
  const purpleTechEffect = {
    id: "b31-purple-tech",
    type: "card_research_tech",
    label: "科技（只能选择紫色）",
    status: "active",
    playerId: "player-blue",
    options: { techTypes: ["purple"], skipCost: true },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    actionEffectFlowActive: true,
    recordExecuteActionEffect: true,
    recordSupplyTechSelection: true,
    currentActionEffect: purpleTechEffect,
    pendingActionEffectFlow: {
      playerId: "player-blue",
      currentIndex: 0,
      effects: [purpleTechEffect],
    },
    takeableTechIds: ["orange2", "purple2", "blue3"],
    techStacks: {
      orange2: { techType: "orange", stackIndex: 2 },
      purple2: { techType: "purple", stackIndex: 2 },
      blue3: { techType: "blue", stackIndex: 3 },
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute card research-tech effects before choosing a tile");
  assert.deepEqual(harness.getHandled(), {
    type: "effect",
    effectId: "b31-purple-tech",
    effectType: "card_research_tech",
  });
}

{
  const purpleTechEffect = {
    id: "b31-purple-tech",
    type: "card_research_tech",
    label: "科技（只能选择紫色）",
    status: "active",
    playerId: "player-blue",
    options: { techTypes: ["purple"], skipCost: true },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    actionEffectFlowActive: true,
    techTilePickingActive: true,
    recordSupplyTechSelection: true,
    currentActionEffect: purpleTechEffect,
    pendingActionEffectFlow: {
      playerId: "player-blue",
      currentIndex: 0,
      effects: [purpleTechEffect],
    },
    takeableTechIds: ["orange2", "purple2", "blue3"],
    techStacks: {
      orange2: { techType: "orange", stackIndex: 2 },
      purple2: { techType: "purple", stackIndex: 2 },
      blue3: { techType: "blue", stackIndex: 3 },
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should choose a tile for active card research-tech effects");
  assert.deepEqual(harness.getHandled(), { type: "supply-tech", tileId: "purple2" });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    blueResources: { score: 50, credits: 1, energy: 0, publicity: 2, availableData: 1, handSize: 1 },
    data: {
      PLACEMENT_KIND_COMPUTER: "computer",
      PLACEMENT_KIND_BLUE_BONUS: "blueBonus",
      canPlaceAnyData: () => ({
        ok: true,
        choices: [{
          target: "computer",
          placementSlot: 4,
          label: "第一排放置位 4",
          description: "按从左到右放入第一排第 4 位",
        }],
      }),
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should directly confirm data placement quick candidates");
  assert.deepEqual(harness.getHandled(), {
    type: "data-placement",
    target: "computer",
    blueSlot: null,
  });
}

{
  let selectedTurnAction = null;
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    roundNumber: 2,
    blueResources: { score: 12, credits: 5, energy: 0, availableData: 1, handSize: 3 },
    blueIncome: { credits: 2, energy: 1, handSize: 1 },
    blueHand: [
      banrenma.createAlienCard(3, 1),
      banrenma.createAlienCard(5, 2),
      banrenma.createAlienCard(7, 3),
    ],
    onChooseTurnAction: (_candidates, selected) => {
      selectedTurnAction = selected;
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
    data: {
      PLACEMENT_KIND_COMPUTER: "computer",
      PLACEMENT_KIND_BLUE_BONUS: "blueBonus",
      getComputerSlotBonus: (slot) => {
        if (Number(slot) === 4) return { type: "income", gain: { energy: 1 } };
        if (Number(slot) === 5) return { type: "score", score: 10 };
        return null;
      },
      canPlaceAnyData: () => ({
        ok: true,
        choices: [
          {
            target: "computer",
            placementSlot: 5,
            label: "第一排放置位 5",
            description: "得分位",
          },
          {
            target: "computer",
            placementSlot: 4,
            label: "第一排放置位 4",
            description: "能量收入位",
          },
        ],
      }),
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should place data for energy income when Banrenma cards need fuel");
  assert.equal(
    Number(selectedTurnAction?.placementSlot),
    4,
    "Banrenma energy plan should outrank an early direct-score data slot",
  );
  assert.deepEqual(harness.getHandled(), {
    type: "data-placement",
    target: "computer",
    blueSlot: null,
  });
}

{
  const chongTransportTask = {
    kind: "transport",
    destinationPlanetId: "earth",
    fossilRewardRepeat: 1,
    gain: { score: 3 },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    recordOpenCardTask: true,
    readyCardTasks: [
      {
        card: { id: "normal-ready", cardName: "Normal ready" },
        task: { id: "normal-task" },
        effects: [{ type: "gain_resources", options: { gain: { score: 1 } } }],
      },
      {
        chongTask: true,
        card: {
          id: "chong-ready",
          cardName: "Chong ready",
          chongCard: true,
          chongTask: chongTransportTask,
        },
        task: chongTransportTask,
        deliveredTransport: {
          rocketId: 77,
          fossil: { fossilId: "fossil_02" },
          task: { fossilId: "fossil_02" },
        },
        effects: [],
      },
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should open delivered Chong transport tasks aggressively");
  assert.deepEqual(harness.getHandled(), { type: "open-card-task", cardId: "chong-ready" });
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    recordBeginPlayCard: true,
    blueResources: { score: 75, credits: 2, energy: 0, publicity: 1, availableData: 0, handSize: 1 },
    blueHand: [{
      id: "loose-final-task",
      cardName: "Loose final task",
      price: 0,
      model: {
        tasks: [{
          id: "loose-task",
          condition: { type: "unreachableInHarness" },
          rewards: [{ type: "gain_resources", options: { gain: { score: 5 } } }],
        }],
      },
    }],
    finalScoringState: {
      tiles: {
        final_a2: {
          id: "final_a2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a2: "a2",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute the loose task play-card harness action");
  assert.deepEqual(harness.getHandled(), { type: "begin-play-card" });
  const playCardCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  const looseTaskCandidate = playCardCandidate?.playableCards?.[0] || null;
  assert.ok(looseTaskCandidate, "loose task play-card candidate should be enumerated");
  assert.equal(
    Number(looseTaskCandidate.valueBreakdown?.playCardConversionPressure || 0),
    0,
    "final loose task with no route/C-final value should not receive conversion pressure",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    recordBeginPlayCard: true,
    blueResources: { score: 86, credits: 3, energy: 2, publicity: 1, availableData: 0, handSize: 5 },
    blueHand: [{
      id: "weak-final-card",
      cardName: "Weak final card",
      price: 1,
      typeCode: 3,
      playEffects: [{ type: "card_public_scan", options: {} }],
      model: {
        endGameScoring: { kind: "sectorWins", scorePer: 1 },
      },
    }],
    finalScoringState: {
      tiles: {
        final_a2: {
          id: "final_a2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a2: "a2",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should enumerate the weak final play-card harness action");
  const playCardCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  const weakFinalCandidate = playCardCandidate?.playableCards?.[0] || null;
  assert.ok(weakFinalCandidate, "weak final play-card candidate should be enumerated");
  assert.ok(
    Number(weakFinalCandidate.valueBreakdown?.playCardConversionPressure || 0) <= 6,
    "low-yield final card without C2 planning should not receive full conversion pressure",
  );
  assert.ok(
    Number(weakFinalCandidate.valueBreakdown?.lateCardEnginePressure || 0) <= 4,
    "low-yield final card without C2 planning should not receive full late engine pressure",
  );
}

{
  const traceOwner = { id: "player-blue", color: "blue", colorLabel: "Blue" };
  const chongAlienState = {
    aliens: {
      1: { revealed: true, alienId: chong.ALIEN_ID, assignedAlienId: chong.ALIEN_ID },
      2: { revealed: true, alienId: amiba.ALIEN_ID, assignedAlienId: amiba.ALIEN_ID },
      3: { revealed: true, alienId: aomomo.ALIEN_ID, assignedAlienId: aomomo.ALIEN_ID },
      4: { revealed: false, alienId: null, assignedAlienId: chong.ALIEN_ID },
    },
    chong: chong.createChongState(),
  };
  chong.initializeChongReveal(chongAlienState, 1, traceOwner, () => 0);
  for (const position of [1, 2, 3, 4]) {
    assert.equal(chong.placeChongTrace(chongAlienState, 1, "pink", position, traceOwner).ok, true);
  }
  const card = chong.createAlienCard(2, 1);
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    canStartMainAction: true,
    recordBeginPlayCard: true,
    blueResources: { credits: 3, energy: 2, handSize: 1 },
    blueHand: [card],
    alienGameState: chongAlienState,
    endGameScoring: {
      resolveCardEndGameRule: endGameScoring.resolveCardEndGameRule,
      scoreCardEndGameRule: endGameScoring.scoreCardEndGameRule,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });

  const handDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const handGlobalPinkDemand = harness.controller.getAiMapDemand(handDemand.traceTypes, "pink");
  const handChongPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    chong.ALIEN_ID,
    "pink",
  );
  const handAmibaPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    amiba.ALIEN_ID,
    "pink",
  );
  harness.blue.hand = [];
  harness.blue.resources.handSize = 0;
  const baselineDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const baselineGlobalPinkDemand = harness.controller.getAiMapDemand(baselineDemand.traceTypes, "pink");
  const baselineChongPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    baselineDemand,
    chong.ALIEN_ID,
    "pink",
  );
  const baselineAmibaPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    baselineDemand,
    amiba.ALIEN_ID,
    "pink",
  );
  harness.blue.reservedCards = [card];
  const reservedDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const reservedChongPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    reservedDemand,
    chong.ALIEN_ID,
    "pink",
  );
  assert.equal(
    handGlobalPinkDemand,
    baselineGlobalPinkDemand,
    "Chong 2 must not leak its species-scoped final demand into global pink trace demand",
  );
  assert.ok(
    handChongPinkDemand > baselineChongPinkDemand,
    "Chong 2 in hand should increase Chong trace-target demand",
  );
  assert.equal(
    harness.controller.getAiAlienTraceTargetDemandForSlot(handDemand, 1, "pink"),
    handChongPinkDemand,
    "Chong 2 demand should reach the revealed Chong slot",
  );
  assert.equal(
    harness.controller.getAiAlienTraceTargetDemandForSlot(handDemand, 2, "pink"),
    baselineAmibaPinkDemand,
    "Chong 2 demand must not reach a revealed Amiba slot",
  );
  assert.equal(
    harness.controller.getAiAlienTraceTargetDemandForSlot(handDemand, 4, "pink"),
    0,
    "Chong 2 demand must not use a hidden slot's assigned alien identity",
  );
  assert.equal(
    handAmibaPinkDemand,
    baselineAmibaPinkDemand,
    "Chong 2 must not increase same-color Amiba trace-target demand",
  );
  assert.ok(
    reservedChongPinkDemand > handChongPinkDemand,
    "played/reserved Chong 2 should retain stronger Chong trace-target demand",
  );

  harness.blue.reservedCards = [];
  harness.blue.hand = [card];
  harness.blue.resources.handSize = 1;
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should enumerate Chong 2 as a playable final card");
  const playCardCandidate = turnChoices.flat().find((candidate) => candidate.id === "playCard");
  const chongFinalCandidate = playCardCandidate?.playableCards?.find((candidate) => candidate.cardId === card.cardId);
  assert.equal(
    Number(chongFinalCandidate?.valueBreakdown?.endGameExpectedScore || 0),
    4,
    "four owned Chong traces should make Chong 2 worth four end-game points",
  );
}

{
  const traceOwner = { id: "player-blue", color: "blue", colorLabel: "Blue" };
  const amibaAlienState = {
    aliens: {
      1: { revealed: true, alienId: amiba.ALIEN_ID, assignedAlienId: amiba.ALIEN_ID },
      2: { revealed: true, alienId: chong.ALIEN_ID, assignedAlienId: chong.ALIEN_ID },
      3: { revealed: true, alienId: aomomo.ALIEN_ID, assignedAlienId: aomomo.ALIEN_ID },
    },
    amiba: amiba.createAmibaState(),
  };
  amiba.initializeAmibaReveal(amibaAlienState, 1, traceOwner, () => 0);
  for (const traceType of ["pink", "yellow", "blue"]) {
    for (const position of [1, 2, 3]) {
      assert.equal(amiba.placeAmibaTrace(amibaAlienState, 1, traceType, position, traceOwner).ok, true);
    }
  }

  const cards = [5, 6, 7].map((cardIndex, sequence) => amiba.createAlienCard(cardIndex, sequence + 1));
  const card = cards[0];
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    canStartMainAction: true,
    recordBeginPlayCard: true,
    blueResources: { credits: 3, energy: 2, handSize: 1 },
    blueHand: [card],
    alienGameState: amibaAlienState,
    endGameScoring: {
      resolveCardEndGameRule: endGameScoring.resolveCardEndGameRule,
      scoreCardEndGameRule: endGameScoring.scoreCardEndGameRule,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });

  const handDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const handGlobalPinkDemand = harness.controller.getAiMapDemand(handDemand.traceTypes, "pink");
  const handAmibaPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    amiba.ALIEN_ID,
    "pink",
  );
  const handAmibaYellowDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    amiba.ALIEN_ID,
    "yellow",
  );
  const handChongPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    chong.ALIEN_ID,
    "pink",
  );
  harness.blue.hand = [];
  harness.blue.resources.handSize = 0;
  const baselineDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const baselineGlobalPinkDemand = harness.controller.getAiMapDemand(baselineDemand.traceTypes, "pink");
  const baselineAmibaPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    baselineDemand,
    amiba.ALIEN_ID,
    "pink",
  );
  const baselineAmibaYellowDemand = harness.controller.getAiAlienTraceTargetDemand(
    baselineDemand,
    amiba.ALIEN_ID,
    "yellow",
  );
  const baselineChongPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    baselineDemand,
    chong.ALIEN_ID,
    "pink",
  );
  harness.blue.reservedCards = [card];
  const reservedDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const reservedAmibaPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    reservedDemand,
    amiba.ALIEN_ID,
    "pink",
  );
  assert.equal(
    handGlobalPinkDemand,
    baselineGlobalPinkDemand,
    "Amiba 5 must not leak its species-scoped final demand into global pink trace demand",
  );
  assert.ok(
    handAmibaPinkDemand > baselineAmibaPinkDemand,
    "Amiba 5 in hand should increase pink Amiba trace-target demand",
  );
  assert.equal(
    harness.controller.getAiAlienTraceTargetDemandForSlot(handDemand, 1, "pink"),
    handAmibaPinkDemand,
    "Amiba 5 demand should reach the revealed Amiba slot",
  );
  assert.equal(
    harness.controller.getAiAlienTraceTargetDemandForSlot(handDemand, 2, "pink"),
    baselineChongPinkDemand,
    "Amiba 5 demand must not reach a revealed Chong slot",
  );
  assert.equal(
    handAmibaYellowDemand,
    baselineAmibaYellowDemand,
    "Amiba 5 should not increase yellow Amiba trace-target demand",
  );
  assert.equal(
    handChongPinkDemand,
    baselineChongPinkDemand,
    "Amiba 5 must not increase same-color Chong trace-target demand",
  );
  assert.ok(
    reservedAmibaPinkDemand > handAmibaPinkDemand,
    "played/reserved Amiba 5 should retain stronger pink Amiba trace-target demand",
  );

  harness.blue.reservedCards = [];
  harness.blue.hand = cards;
  harness.blue.resources.handSize = cards.length;
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should enumerate Amiba 5/6/7 as playable final cards");
  const playCardCandidate = turnChoices.flat().find((candidate) => candidate.id === "playCard");
  for (const [index, expectedTraceType] of ["pink", "yellow", "blue"].entries()) {
    const finalCard = cards[index];
    const amibaFinalCandidate = playCardCandidate?.playableCards?.find(
      (candidate) => candidate.cardId === finalCard.cardId,
    );
    assert.equal(
      Number(amibaFinalCandidate?.valueBreakdown?.endGameExpectedScore || 0),
      6,
      `three owned ${expectedTraceType} Amiba traces should make Amiba ${index + 5} worth six end-game points`,
    );
  }
}

{
  const card = {
    ...aomomo.createAlienCard(8, 1),
    model: {
      endGameScoring: { kind: "aomomoTraceCount", scorePer: 1 },
    },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    blueResources: { credits: 3, energy: 2, handSize: 1 },
    blueHand: [card],
    alienGameState: {
      aliens: {
        1: { revealed: true, alienId: aomomo.ALIEN_ID, assignedAlienId: aomomo.ALIEN_ID },
        2: { revealed: true, alienId: chong.ALIEN_ID, assignedAlienId: chong.ALIEN_ID },
        3: { revealed: true, alienId: amiba.ALIEN_ID, assignedAlienId: amiba.ALIEN_ID },
      },
    },
  });

  const handDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const handGlobalPinkDemand = harness.controller.getAiMapDemand(handDemand.traceTypes, "pink");
  const handAomomoPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    aomomo.ALIEN_ID,
    "pink",
  );
  const handAomomoBlueDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    aomomo.ALIEN_ID,
    "blue",
  );
  const handChongPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    chong.ALIEN_ID,
    "pink",
  );
  const handAmibaPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    amiba.ALIEN_ID,
    "pink",
  );
  harness.blue.hand = [];
  harness.blue.resources.handSize = 0;
  const baselineDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const baselineGlobalPinkDemand = harness.controller.getAiMapDemand(baselineDemand.traceTypes, "pink");
  const baselineAomomoPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    baselineDemand,
    aomomo.ALIEN_ID,
    "pink",
  );
  const baselineAomomoBlueDemand = harness.controller.getAiAlienTraceTargetDemand(
    baselineDemand,
    aomomo.ALIEN_ID,
    "blue",
  );
  const baselineChongPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    baselineDemand,
    chong.ALIEN_ID,
    "pink",
  );
  const baselineAmibaPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    baselineDemand,
    amiba.ALIEN_ID,
    "pink",
  );
  harness.blue.reservedCards = [card];
  const reservedDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const reservedAomomoPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    reservedDemand,
    aomomo.ALIEN_ID,
    "pink",
  );

  assert.equal(
    handGlobalPinkDemand,
    baselineGlobalPinkDemand,
    "Aomomo 8 must not leak its species-scoped final demand into global pink trace demand",
  );
  assert.ok(
    handAomomoPinkDemand > baselineAomomoPinkDemand,
    "Aomomo 8 in hand should increase Aomomo trace-target demand",
  );
  assert.equal(
    harness.controller.getAiAlienTraceTargetDemandForSlot(handDemand, 1, "pink"),
    handAomomoPinkDemand,
    "Aomomo 8 demand should reach the revealed Aomomo slot",
  );
  assert.equal(
    harness.controller.getAiAlienTraceTargetDemandForSlot(handDemand, 2, "pink"),
    baselineChongPinkDemand,
    "Aomomo 8 demand must not reach a revealed Chong slot",
  );
  assert.ok(
    handAomomoBlueDemand > baselineAomomoBlueDemand,
    "Aomomo 8 should increase every Aomomo trace color through its wildcard demand",
  );
  assert.equal(
    handChongPinkDemand,
    baselineChongPinkDemand,
    "Aomomo 8 must not increase same-color Chong trace-target demand",
  );
  assert.equal(
    handAmibaPinkDemand,
    baselineAmibaPinkDemand,
    "Aomomo 8 must not increase same-color Amiba trace-target demand",
  );
  assert.ok(
    reservedAomomoPinkDemand > handAomomoPinkDemand,
    "played/reserved Aomomo 8 should retain stronger Aomomo trace-target demand",
  );
}

{
  const card = {
    id: "generic-pink-trace-final",
    cardId: "generic-pink-trace-final",
    cardTypeCode: 3,
    model: {
      endGameScoring: { kind: "traceCount", traceType: "pink", scorePer: 2 },
    },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    blueResources: { handSize: 1 },
    blueHand: [card],
  });
  const handDemand = harness.controller.getAiStrategyDemand(harness.blue);
  const handGlobalPinkDemand = harness.controller.getAiMapDemand(handDemand.traceTypes, "pink");
  const handChongPinkDemand = harness.controller.getAiAlienTraceTargetDemand(
    handDemand,
    chong.ALIEN_ID,
    "pink",
  );
  harness.blue.hand = [];
  harness.blue.resources.handSize = 0;
  const baselineDemand = harness.controller.getAiStrategyDemand(harness.blue);
  assert.ok(
    handGlobalPinkDemand > harness.controller.getAiMapDemand(baselineDemand.traceTypes, "pink"),
    "ordinary traceCount finals should keep their global color demand",
  );
  assert.equal(
    handChongPinkDemand,
    harness.controller.getAiAlienTraceTargetDemand(baselineDemand, chong.ALIEN_ID, "pink"),
    "ordinary traceCount finals should not invent a species-scoped demand",
  );
}

{
  const harness = createAiControllerHarness(null, { roundNumber: 2 });
  const makeCandidates = ({ directScoreGain = 8, outerScore = -3.487, nestedScore = -3.142 } = {}) => ([
    {
      id: "playCard",
      available: true,
      score: outerScore,
      actionGraph: { net: -6.142 },
      playableCards: [{
        id: "playCard",
        available: true,
        cardId: "direct-cashout",
        score: nestedScore,
        directScoreGain,
      }],
    },
    { id: "pass", available: true, score: -3.8, actionGraph: { net: -3.8 } },
  ]);

  const floor = harness.controller.getAiEarlyDirectScorePlayPassFloor(makeCandidates(), { roundNumber: 2 });
  assert.equal(floor?.floor, -3.79, "an early payable eight-point card should retain its original ordering just above pass");
  assert.equal(floor?.originalNet, -6.142);
  assert.equal(floor?.passNet, -3.8);
  assert.equal(floor?.directScoreGain, 8);
  assert.equal(
    harness.controller.getAiEarlyDirectScorePlayPassFloor(makeCandidates({ directScoreGain: 7 }), { roundNumber: 2 }),
    null,
    "the pass floor must not lift lower direct-score cards",
  );
  assert.equal(
    harness.controller.getAiEarlyDirectScorePlayPassFloor(makeCandidates({ outerScore: -4 }), { roundNumber: 2 }),
    null,
    "the pass floor must not reverse a card that was already below pass before graph pressure",
  );
  assert.equal(
    harness.controller.getAiEarlyDirectScorePlayPassFloor(makeCandidates(), { roundNumber: 4 }),
    null,
    "the early cashout exception must not alter final-round ordering",
  );
}

{
  const scale = createAiControllerHarness(null, { roundNumber: 4 })
    .controller.getAiTerminalResearchGoalBonusScale;
  assert.equal(scale({
    actionId: "researchTech",
    roundNumber: 4,
    finalMarkCount: 3,
    nextThreshold: null,
    directScoreGain: 0,
  }), 0.35, "terminal non-scoring research should not retain an engine-building goal bonus");
  assert.equal(scale({
    actionId: "researchTech",
    roundNumber: 3,
    finalMarkCount: 3,
    nextThreshold: null,
    directScoreGain: 0,
  }), 1, "pre-final research still has future engine value");
  assert.equal(scale({
    actionId: "researchTech",
    roundNumber: 4,
    finalMarkCount: 3,
    nextThreshold: null,
    directScoreGain: 2,
  }), 1, "direct-score research should retain its goal bonus");
  assert.equal(scale({
    actionId: "researchTech",
    roundNumber: 4,
    finalMarkCount: 2,
    nextThreshold: 70,
    directScoreGain: 0,
  }), 1, "research that can still help reach a missing final mark should not be damped");
}

{
  const raceLost = createAiControllerHarness(null, { roundNumber: 4 }).controller.isAiB2SectorScanRaceLost;
  assert.equal(raceLost(
    { ownCount: 0, openCount: 2, maxOtherCount: 2 },
    { roundNumber: 4, active: true, marked: true },
  ), false, "filling the remaining slots can win a tied count via the latest-placement tie-break");
  assert.equal(raceLost(
    { ownCount: 0, openCount: 2, maxOtherCount: 3 },
    { roundNumber: 4, active: true, marked: true },
  ), true, "a final B2 sector remains lost when even every open slot leaves the AI behind");
  assert.equal(raceLost(
    { ownCount: 1, openCount: 2, maxOtherCount: 2 },
    { roundNumber: 4, active: true, marked: true },
  ), false, "two remaining scans can still turn a 1-2 sector into a win");
  assert.equal(raceLost(
    { ownCount: 0, openCount: 2, maxOtherCount: 2 },
    { roundNumber: 3, active: true, marked: true },
  ), false, "pre-final planning should retain future ways to change sector counts");
  assert.equal(raceLost(
    { ownCount: 0, openCount: 2, maxOtherCount: 2 },
    { roundNumber: 4, active: true, marked: false },
  ), false, "unmarked B2 should not impose a terminal race-loss penalty");
}

{
  const controller = createAiControllerHarness(null, { roundNumber: 4 }).controller;
  assert.deepEqual(
    controller.getAiSectorScanWinState({ ownCount: 1, openCount: 1, maxOtherCount: 2 }),
    {
      openCount: 1,
      ownCount: 1,
      maxOtherCount: 2,
      ownAfterScan: 2,
      strictLeadAfterScan: false,
      tieBreakWinAfterScan: true,
      winsAfterScan: true,
    },
    "closing on equal counts should be a real latest-placement settlement win",
  );
  assert.equal(
    controller.getAiClosedSectorControlMarginValue({ ownCount: 2, openCount: 1, maxOtherCount: 2 }),
    10,
    "a strict close lead should retain the full generic control premium",
  );
  assert.equal(
    controller.getAiClosedSectorControlMarginValue({ ownCount: 1, openCount: 1, maxOtherCount: 2 }),
    -2,
    "an exact latest-placement win should keep the measured disruption-risk discount",
  );
  assert.equal(
    controller.getAiClosedSectorControlMarginValue({ ownCount: 0, openCount: 1, maxOtherCount: 2 }),
    -8,
    "a close that remains behind should retain the loss penalty",
  );
  assert.equal(
    controller.getAiB2SectorWinExactDelta({ sectorWins: 3, orbitLandCount: 4, multiplier: 8 }),
    8,
    "one sector win should add exactly one B2 base point while orbit/land remains ahead",
  );
  assert.equal(
    controller.getAiB2SectorWinExactDelta({ sectorWins: 4, orbitLandCount: 4, multiplier: 8 }),
    0,
    "an extra sector win beyond the B2 orbit/land bottleneck has no score delta",
  );
}

{
  const buildB2FocusHarness = (sectorWins, orbitLandCount) => createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    finalScoringState: {
      tiles: {
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: { final_b2: "b2" },
    finalSlotMultipliers: { b2: { 1: 8 } },
    endGameScoring: {
      countSectorWins: () => sectorWins,
      countOrbitOrLandMarkers: () => orbitLandCount,
    },
  });
  const cashout = buildB2FocusHarness(3, 4);
  assert.equal(
    cashout.controller.scoreAiB2SectorScanFocus(
      "tie-close-sector",
      { ownCount: 1, openCount: 1, maxOtherCount: 2 },
      cashout.blue,
    ),
    8,
    "a B2 tie-break close should use the exact eight-point delta without historical urgency",
  );
  const capped = buildB2FocusHarness(4, 4);
  assert.equal(
    capped.controller.scoreAiB2SectorScanFocus(
      "tie-close-sector",
      { ownCount: 1, openCount: 1, maxOtherCount: 2 },
      capped.blue,
    ),
    0,
    "a B2 tie-break close should not invent value once sector wins reach orbit/land",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    enableQuickTrades: true,
    recordQuickTrade: true,
    blueResources: { score: 145, credits: 1, energy: 0, publicity: 1, availableData: 0, handSize: 4 },
    blueHand: [
      {
        id: "tail-score-card",
        cardName: "Tail score card",
        price: 2,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 16 } } }],
      },
      { id: "filler-a", cardName: "Filler A", price: 2 },
      { id: "filler-b", cardName: "Filler B", price: 2 },
      { id: "filler-c", cardName: "Filler C", price: 2 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b1: {
          id: "final_b1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b1: "b1",
      final_d1: "d1",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should trade cards for a credit to unlock a concrete tail scoring card");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-credit" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-credit");
  assert.ok(tradeCandidate, "cards-for-credit unlock candidate should be enumerated");
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.concreteFinalValue || 0) > 0,
    "tail unlock trade should still require concrete score/final value",
  );
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.measurableFinalValue || 0) >= 4,
    "tail unlock trade should retain cards with measurable terminal scoring",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    enableQuickTrades: true,
    recordQuickTrade: true,
    blueResources: { score: 296, credits: 1, energy: 0, publicity: 0, availableData: 0, handSize: 3 },
    blueHand: [
      {
        id: "final-push-score-card",
        cardName: "Final push score card",
        price: 2,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 12 } } }],
      },
      { id: "high-filler-a", cardName: "High filler A", price: 4 },
      { id: "high-filler-b", cardName: "High filler B", price: 4 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b2: {
          id: "final_b2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should trade cards for credit to unlock a 300-point push card");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-credit" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-credit");
  assert.equal(
    tradeCandidate?.valueBreakdown?.finalHighScoreOneCreditUnlock,
    true,
    "high-score one-credit unlock should be explicitly marked",
  );
}

{
  const turnChoices = [];
  const selectedActions = [];
  let step = 0;
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    turnNumber: 15,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    aiDifficulty: "weak_start",
    quickTrades: {
      "energy-for-credit": {
        id: "energy-for-credit",
        label: "2 energy -> 1 credit",
        cost: { energy: 2 },
        gain: { credits: 1 },
      },
      "cards-for-credit": {
        id: "cards-for-credit",
        label: "2 cards -> 1 credit",
        cost: { handSize: 2 },
        gain: { credits: 1 },
      },
    },
    blueResources: { score: 78, credits: 0, energy: 5, publicity: 1, availableData: 0, handSize: 5 },
    blueHand: [
      {
        id: "low-tail-task-setup",
        cardName: "Low tail task setup",
        price: 2,
        typeCode: 2,
        model: { tasks: [{ id: "unfinished-task" }] },
        playEffects: [{ type: "gain_resources", options: { gain: { publicity: 1 } } }],
      },
      { id: "tail-filler-a", cardName: "Tail filler A", price: 2 },
      { id: "tail-filler-b", cardName: "Tail filler B", price: 2 },
      { id: "tail-filler-c", cardName: "Tail filler C", price: 2 },
      { id: "tail-filler-d", cardName: "Tail filler D", price: 2 },
    ],
    finalScoringState: {
      tiles: {
        final_a2: {
          id: "final_a2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_c2: {
          id: "final_c2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a2: "a2",
      final_c2: "c2",
      final_d2: "d2",
    },
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 1, energy: 2 },
      getStandardScanCost: () => ({ credits: 1, energy: 2 }),
      buildScanEffectQueue: () => [{ type: "earth_sector_scan" }],
      canExecuteScan: (player) => (
        Number(player?.resources?.credits || 0) >= 1 && Number(player?.resources?.energy || 0) >= 2
          ? { ok: true }
          : { ok: false, message: "scan resources missing" }
      ),
    },
    buildSectorScanChoicesForX: (sectorX) => [{
      nebulaId: "tail-scan-nebula",
      sectorX,
      label: "Tail scan nebula",
    }],
    data: {
      getNextReplaceableNebulaToken: () => ({ slotIndex: 18 }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
    },
    onChooseTurnAction: (candidates, selected) => {
      turnChoices.push(candidates);
      selectedActions.push(selected);
    },
    chooseTurnAction: (candidates) => {
      step += 1;
      if (step === 1) {
        return candidates.find((candidate) => (
          candidate.id === "quickTrade" && candidate.tradeId === "energy-for-credit"
        )) || null;
      }
      return candidates
        .slice()
        .filter((candidate) => candidate.available !== false)
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null;
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const firstResult = harness.controller.runAiAutomationStep();
  assert.equal(firstResult.ok, true, "AI should first use energy for credit to open the scan action");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "energy-for-credit" });

  harness.blue.resources.credits = 1;
  harness.blue.resources.energy = 3;
  const secondResult = harness.controller.runAiAutomationStep();
  assert.notEqual(secondResult?.blocked, true, "second low-tail decision should not block");
  assert.equal(selectedActions[1]?.id, "scan", "AI should keep the already-opened scan instead of chaining another discard trade");
  const secondCandidates = turnChoices[1] || [];
  const repeatedCardsForCredit = secondCandidates.find((candidate) => (
    candidate.id === "quickTrade"
    && candidate.tradeId === "cards-for-credit"
    && candidate.valueBreakdown?.mainUnlockTrade
  ));
  assert.equal(
    repeatedCardsForCredit,
    undefined,
    "weak_start low-tail should suppress repeated cards-for-credit setup when a scan is already open",
  );
}

{
  const turnChoices = [];
  const selectedActions = [];
  const publicScoreCard = {
    id: "ready-scan-refill-card",
    cardName: "Ready scan refill card",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 3 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    turnNumber: 9,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    aiDifficulty: "weak_start",
    quickTrades: {
      "energy-for-card": {
        id: "energy-for-card",
        label: "2 energy -> 1 card",
        cost: { energy: 2 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 110, credits: 1, energy: 2, publicity: 0, availableData: 0, handSize: 0 },
    blueHand: [],
    finalScoringState: {
      tiles: {
        final_a1: { id: "final_a1", marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }] },
        final_b1: { id: "final_b1", marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }] },
        final_d2: { id: "final_d2", marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }] },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b1: "b1",
      final_d2: "d2",
    },
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 1, energy: 2 },
      getStandardScanCost: () => ({ credits: 1, energy: 2 }),
      buildScanEffectQueue: () => [{ type: "earth_sector_scan" }],
      canExecuteScan: (player) => (
        Number(player?.resources?.credits || 0) >= 1 && Number(player?.resources?.energy || 0) >= 2
          ? { ok: true }
          : { ok: false, message: "scan resources missing" }
      ),
    },
    buildSectorScanChoicesForX: (sectorX) => [{
      nebulaId: "ready-scan-nebula",
      sectorX,
      label: "Ready scan nebula",
    }],
    data: {
      getNextReplaceableNebulaToken: () => ({ slotIndex: 18 }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
    },
    onChooseTurnAction: (candidates, selected) => {
      turnChoices.push(candidates);
      selectedActions.push(selected);
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.notEqual(result?.blocked, true, "ready scan resource protection should not block the turn");
  assert.equal(
    selectedActions[0]?.id,
    "scan",
    "AI should cash out the ready scan before refilling a card",
  );
  const energyRefill = turnChoices[0]?.find((candidate) => (
    candidate.id === "quickTrade" && candidate.tradeId === "energy-for-card"
  ));
  assert.equal(
    energyRefill,
    undefined,
    "energy-for-card should not consume the payment for a stronger already-ready scan",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    canStartMainAction: true,
    blueInitialSelection: {
      industry: { id: "industry:寰宇超动力", label: "寰宇超动力" },
    },
    blueResources: { score: 31, credits: 3, energy: 1, publicity: 6, handSize: 2 },
    blueOwnedTechTiles: { orange4: true },
    blueTechCounts: { orange: 1, purple: 0, blue: 0 },
    movableTokens: [{ id: 1, playerId: "player-blue", sector: { x: 1, y: 1 } }],
    takeableTechIds: ["orange2", "purple3"],
    techStacks: {
      orange2: { techType: "orange", stackIndex: 2, bonusId: "bonus_1p" },
      purple3: { techType: "purple", stackIndex: 3, bonusId: "bonus_1p" },
    },
    finalScoringState: {
      tiles: {
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
      },
    },
    finalFormulaIds: { final_d1: "d1" },
    finalSlotMultipliers: { d1: { 1: 11 } },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.notEqual(result?.blocked, true, "Huanyu orange2 comparison should remain executable");
  const researchCandidate = turnChoices.flat().find((candidate) => candidate.id === "researchTech");
  const orange2 = researchCandidate?.takeable?.find((candidate) => candidate.tileId === "orange2");
  const purple3 = researchCandidate?.takeable?.find((candidate) => candidate.tileId === "purple3");
  assert.equal(
    orange2?.valueBreakdown?.huanyuOrange2FutureMoveValue,
    5.2,
    "round-two Huanyu orange2 should value the remaining one-point company moves",
  );
  assert.equal(
    purple3?.valueBreakdown?.huanyuOrange2FutureMoveValue,
    0,
    "Huanyu company synergy should remain local to orange2",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    turnNumber: 1,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-energy": {
        id: "credits-for-energy",
        label: "2 credits -> 1 energy",
        cost: { credits: 2 },
        gain: { energy: 1 },
      },
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
      "energy-for-credit": {
        id: "energy-for-credit",
        label: "2 energy -> 1 credit",
        cost: { energy: 2 },
        gain: { credits: 1 },
      },
    },
    blueResources: { score: 47, credits: 5, energy: 5, publicity: 2, availableData: 0, handSize: 6 },
    blueHand: Array.from({ length: 6 }, (_item, index) => ({
      id: `terminal-trade-filler-${index}`,
      cardName: `Terminal trade filler ${index}`,
      price: 3,
      typeCode: 1,
      playEffects: [],
    })),
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b1: { id: "final_b1", marks: [] },
        final_d1: { id: "final_d1", marks: [] },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b1: "b1",
      final_d1: "d1",
    },
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 1, energy: 2 },
      getStandardScanCost: () => ({ credits: 1, energy: 2 }),
      buildScanEffectQueue: () => [],
      canExecuteScan: () => ({ ok: false, message: "no useful scan target" }),
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.notEqual(result?.blocked, true, "terminal no-cashout trade guard should not block the turn");
  const genericRecoveryTrades = turnChoices
    .flat()
    .filter((candidate) => (
      candidate.id === "quickTrade"
      && candidate.valueBreakdown?.lateResourceRecoveryTrade
      && ["credits-for-energy", "cards-for-energy", "energy-for-credit"].includes(candidate.tradeId)
      && String(candidate.reason || "").startsWith("后期落后：")
    ));
  assert.deepEqual(
    genericRecoveryTrades,
    [],
    "final round should not exchange resources without a concrete immediate recovery signal",
  );
}

{
  const protection = createAiControllerHarness(null, { roundNumber: 4 })
    .controller.getAiFinalAnalyzeDirectScoreProtection;
  assert.equal(
    protection({ ok: true, selectedCards: [{ playScore: 8.1, directScoreGain: 8 }] }, 8)
      .spendsPlayableDirectScoreCard,
    true,
  );
  assert.equal(
    protection({ ok: true, selectedCards: [{ playScore: 7.9, directScoreGain: 7 }] }, 8)
      .spendsPlayableDirectScoreCard,
    false,
  );
  assert.equal(
    protection({ ok: true, selectedCards: [{ playScore: null, directScoreGain: 8 }] }, 8)
      .spendsPlayableDirectScoreCard,
    false,
    "an unaffordable or otherwise unplayable direct-score card should not block the trade",
  );
  assert.equal(
    protection({ ok: true, selectedCards: [{ playScore: 1, directScoreGain: 0 }] }, 8)
      .spendsPlayableDirectScoreCard,
    false,
    "a larger hand may still trade when the actual discard plan avoids the direct-score card",
  );
  assert.equal(
    protection({ ok: true, selectedCards: [{ playScore: 11, directScoreGain: 8 }] }, 13).shouldProtect,
    true,
    "a marginal analyze upgrade should preserve the playable direct-score card",
  );
  assert.equal(
    protection({ ok: true, selectedCards: [{ playScore: 11, directScoreGain: 8 }] }, 18).shouldProtect,
    false,
    "a clearly stronger analyze cashout should be allowed to spend the direct-score card",
  );
}

{
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({
    id: `data-${index}`,
    placementSlot: index + 1,
  }));
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
      "cards-for-credit": {
        id: "cards-for-credit",
        label: "2 cards -> 1 credit",
        cost: { handSize: 2 },
        gain: { credits: 1 },
      },
    },
    blueResources: { score: 182, credits: 0, energy: 0, publicity: 5, availableData: 3, handSize: 5 },
    blueHand: [
      { id: "analysis-filler-a", cardName: "Analysis filler A", price: 0 },
      { id: "analysis-filler-b", cardName: "Analysis filler B", price: 0 },
      { id: "analysis-filler-c", cardName: "Analysis filler C", price: 0 },
      {
        id: "analysis-credit-target",
        cardName: "Analysis credit target",
        price: 1,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 12 } } }],
      },
      { id: "analysis-filler-d", cardName: "Analysis filler D", price: 0 },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_c2: {
          id: "final_c2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_c2: "c2",
      final_d1: "d1",
    },
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy")
      || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should still allow the final analyze energy trade");
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.equal(tradeCandidate?.valueBreakdown?.finalAnalyzeEnergyTrade, true);
  assert.equal(tradeCandidate.preserveHandIndex, 3);
  assert.equal(tradeCandidate.valueBreakdown?.competingCreditUnlock?.bestPlayCard?.handIndex, 3);
  assert.deepEqual(
    tradeCandidate.valueBreakdown?.discardPlan?.executionSelectedIndexes?.includes(3),
    false,
    "final analyze energy trade should not discard the high-value credit-unlock play card",
  );
}

{
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({
    id: `protected-data-${index}`,
    placementSlot: index + 1,
  }));
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-energy": {
        id: "credits-for-energy",
        label: "2 credits -> 1 energy",
        cost: { credits: 2 },
        gain: { energy: 1 },
      },
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
    },
    blueResources: { score: 125, credits: 7, energy: 0, publicity: 3, availableData: 5, handSize: 2 },
    blueHand: [
      {
        id: "protected-direct-eight",
        cardName: "Protected direct eight",
        price: 3,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 8 } } }],
      },
      { id: "protected-filler", cardName: "Protected filler", price: 0 },
    ],
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => (
      candidate.id === "quickTrade"
      && candidate.tradeId === "credits-for-energy"
      && candidate.valueBreakdown?.finalAnalyzeEnergyTrade
    )) || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "final analyze should use spare credits instead of discarding a payable direct-eight card");
  const finalAnalyzeCandidates = turnChoices
    .flat()
    .filter((candidate) => candidate.valueBreakdown?.finalAnalyzeEnergyTrade);
  assert.ok(
    finalAnalyzeCandidates.some((candidate) => candidate.tradeId === "credits-for-energy"),
    "credits-for-energy should remain available for the final analyze",
  );
  assert.equal(
    finalAnalyzeCandidates.some((candidate) => candidate.tradeId === "cards-for-energy"),
    false,
    "cards-for-energy should be filtered when its actual discard plan spends a payable direct-eight card",
  );
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "credits-for-energy" });
  assert.ok(
    harness.blue.hand.some((card) => card.id === "protected-direct-eight"),
    "the direct-eight card should remain in hand after the credit trade",
  );
}

{
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({
    id: `late-protected-data-${index}`,
    placementSlot: index + 1,
  }));
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    turnNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordBeginPlayCard: true,
    quickTrades: {
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
    },
    blueResources: { score: 49, credits: 0, energy: 0, publicity: 0, availableData: 0, handSize: 2 },
    blueHand: [
      {
        id: "late-protected-direct-eight",
        cardName: "Late protected direct eight",
        price: 0,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 8 } } }],
      },
      { id: "late-protected-filler", cardName: "Late protected filler", price: 0 },
    ],
    finalScoringState: {
      tiles: {
        final_a2: {
          id: "final_a2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
      },
    },
    finalFormulaIds: { final_a2: "a2" },
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
    },
    aiValuation: setiAi.valuation,
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard")
      || candidates.find((candidate) => candidate.id === "pass")
      || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "round-five direct-score protection should leave a legal main action");
  assert.equal(
    turnChoices.flat().some((candidate) => (
      candidate.id === "quickTrade"
      && candidate.tradeId === "cards-for-energy"
      && (
        candidate.valueBreakdown?.emergencyAnalyzeEnergyTrade
        || candidate.valueBreakdown?.finalAnalyzeEnergyTrade
        || candidate.valueBreakdown?.secondMarkAnalyzeEnergyRecovery
      )
    )),
    false,
    "round-five emergency and recovery candidates must not bypass the direct-eight discard protection",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    turnNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
    },
    movableTokens: [
      { id: 1, playerId: "player-blue", sector: { x: 2, y: 2 } },
    ],
    planetLocations: [
      { planetId: "mars", name: "Mars", x: 2, y: 2 },
    ],
    planetStats: {
      canAddLandingMarker: () => true,
      canAddOrbitMarker: () => false,
      getAvailableSatellitesForLanding: () => [],
      getPlanetLandingCount: () => 0,
      getPlanetOrbitCount: () => 0,
    },
    abilities: {
      planet: {
        DEFAULT_ORBIT_COST: { credits: 1, energy: 1 },
        BASE_LAND_ENERGY_COST: 2,
        getLandEnergyCost: () => 2,
        getLandOptions: () => ({ ok: false, message: "land disabled in harness" }),
        getOrbitOptions: () => ({ ok: false, message: "orbit disabled in harness" }),
      },
      rocket: {
        ORANGE1_ROCKET_LIMIT: 4,
        getRocketLimitForPlayer: () => 3,
      },
    },
    planetRewards: {
      EFFECT_TYPES: {
        GAIN_RESOURCES: "gain_resources",
        GAIN_DATA: "gain_data",
        ALIEN_TRACE: "alien_trace",
        DRAW_CARDS: "draw_cards",
        PICK_CARD: "pick_card",
        INCOME: "income",
      },
      buildPlanetLandRewardEffects: () => [
        { type: "gain_resources", options: { gain: { score: 6 } } },
      ],
      buildOrbitRewardEffects: () => [],
      buildSatelliteLandRewardEffects: () => [],
    },
    blueResources: { score: 120, credits: 0, energy: 1, publicity: 0, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "engine-a", cardName: "Engine A", price: 0, playEffects: [{ type: "gain_resources", options: { gain: { score: 10 } } }] },
      { id: "engine-b", cardName: "Engine B", price: 0, playEffects: [{ type: "gain_resources", options: { gain: { score: 9 } } }] },
      { id: "engine-c", cardName: "Engine C", price: 0, playEffects: [{ type: "gain_resources", options: { gain: { score: 8 } } }] },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b1: {
          id: "final_b1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b1: "b1",
      final_d1: "d1",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy")
      || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should evaluate the route cashout trade without blocking");
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.ok(tradeCandidate, "cards-for-energy planet cashout candidate should still be enumerated");
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.cardsForEnergyHandDrainPenalty || 0) >= 8,
    "low-score three-mark players should price the hand drain before trading two cards for energy",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    pendingActionExecuted: true,
    canPayForMove: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
    },
    movableTokens: [
      { id: 1, playerId: "player-blue", sector: { x: 2, y: 2 } },
    ],
    planetLocations: [
      { planetId: "mars", name: "Mars", x: 2, y: 2 },
    ],
    planetStats: {
      canAddLandingMarker: () => true,
      canAddOrbitMarker: () => false,
      getAvailableSatellitesForLanding: () => [],
      getPlanetLandingCount: () => 0,
      getPlanetOrbitCount: () => 0,
    },
    abilities: {
      planet: {
        DEFAULT_ORBIT_COST: { credits: 1, energy: 1 },
        BASE_LAND_ENERGY_COST: 2,
        getLandEnergyCost: () => 2,
        getLandOptions: () => ({ ok: false, message: "land disabled in harness" }),
        getOrbitOptions: () => ({ ok: false, message: "orbit disabled in harness" }),
      },
      rocket: {
        ORANGE1_ROCKET_LIMIT: 4,
        getRocketLimitForPlayer: () => 3,
      },
    },
    planetRewards: {
      EFFECT_TYPES: {
        GAIN_RESOURCES: "gain_resources",
        GAIN_DATA: "gain_data",
        ALIEN_TRACE: "alien_trace",
        DRAW_CARDS: "draw_cards",
        PICK_CARD: "pick_card",
        INCOME: "income",
      },
      buildPlanetLandRewardEffects: () => [
        { type: "gain_resources", options: { gain: { score: 6 } } },
      ],
      buildOrbitRewardEffects: () => [],
      buildSatelliteLandRewardEffects: () => [],
    },
    blueResources: { score: 120, credits: 0, energy: 1, publicity: 0, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "post-main-engine-a", cardName: "Post-main engine A", price: 0, playEffects: [{ type: "gain_resources", options: { gain: { score: 10 } } }] },
      { id: "post-main-engine-b", cardName: "Post-main engine B", price: 0, playEffects: [{ type: "gain_resources", options: { gain: { score: 9 } } }] },
      { id: "post-main-engine-c", cardName: "Post-main engine C", price: 0, playEffects: [{ type: "gain_resources", options: { gain: { score: 8 } } }] },
    ],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_b1: {
          id: "final_b1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b1: "b1",
      final_d1: "d1",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "end-turn") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.equal(
    tradeCandidate,
    undefined,
    "post-main energy trade must not claim an unavailable same-turn land cashout",
  );
}

console.log("app/ai-controller.action.integration.test.js ok");

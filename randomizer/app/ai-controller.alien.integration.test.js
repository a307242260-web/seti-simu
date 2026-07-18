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
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    earthCoordinate: { x: 1, y: 1 },
    alienGameState: makeYichangdianAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "yichangdian-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["yellow", "blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", yichangdianTraceType: "blue", yichangdianTraceSlot: "1", yichangdianPosition: "1" },
        "异常点蓝色 1号位：1能量，即将触发异常奖励",
        false,
        () => selected.push("soon-anomaly"),
      ),
      makeButton(
        { alienSlot: "1", yichangdianTraceType: "yellow", yichangdianTraceSlot: "4", yichangdianPosition: "4" },
        "异常点黄色 4号位：2分，外星人牌",
        false,
        () => selected.push("alien-card"),
      ),
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
  assert.equal(result.ok, true, "AI should resolve Yichangdian trace picker");
  assert.deepEqual(
    selected,
    ["alien-card"],
    "AI should take an early Yichangdian alien-card trace before chasing a low-value immediate anomaly",
  );
}

{
  const yState = yichangdian.createYichangdianState();
  yState.revealedSlotId = 1;
  yState.revealInitialized = true;
  yState.anomalies = [
    { markerId: "b_1", traceType: "yellow", sectorX: 7, y: 4, triggeredCount: 0 },
    { markerId: "c_2", traceType: "blue", sectorX: 0, y: 4, triggeredCount: 0 },
  ];
  const alienGameState = {
    aliens: {
      1: { revealed: true, alienId: yichangdian.ALIEN_ID, assignedAlienId: yichangdian.ALIEN_ID },
    },
    yichangdian: yState,
  };
  yichangdian.ensureTraceGrid(alienGameState, 1);
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    alienGameState,
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "yichangdian-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["yellow", "blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", yichangdianTraceType: "yellow", yichangdianTraceSlot: "2", yichangdianPosition: "2" },
        "异常点黄色 2号位",
        false,
        () => selected.push("yellow-2"),
      ),
      makeButton(
        { alienSlot: "1", yichangdianTraceType: "blue", yichangdianTraceSlot: "1", yichangdianPosition: "1" },
        "异常点蓝色 1号位",
        false,
        () => selected.push("blue-1"),
      ),
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
  assert.equal(result.ok, true, "AI should resolve Yichangdian trace picker");
  assert.deepEqual(selected, ["blue-1"], "AI should claim the soon energy anomaly color over the old fixed yellow-2 preference");
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "white",
    alienTracePickerState: {
      mode: "fangzhou-use",
      targetPlayerId: "player-blue",
      selectedAlienSlotId: 1,
      selectedTraceType: "blue",
      allowedTraceTypes: ["blue"],
    },
    alienPickerButtons: [
      makeButton(
        { alienPickerStep: "fangzhou-use", alienSlot: "1", traceType: "blue", fangzhouUse: "unlock" },
        "解锁蓝色方舟牌",
      ),
    ],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.scheduleAiAutoStepIfNeeded();
  assert.equal(
    harness.getScheduledTimers().length,
    1,
    "AI-owned Fangzhou trace-use picker should schedule even when the current interface player is human",
  );
}

{
  const selected = [];
  const alienGameState = {
    aliens: {
      1: makeHiddenAlienSlot({ pink: "white" }),
      2: makeHiddenAlienSlot({ pink: "white" }),
    },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    alienSlotIds: [1, 2],
    alienGameState,
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: { mode: "basic", allowedTraceTypes: ["blue"] },
    alienPickerButtons: [
      makeButton(
        { alienPickerStep: "basic", alienSlot: "1", traceType: "blue" },
        "外星人 1 放置蓝色痕迹，首标记 1/3",
        false,
        () => selected.push("slot-1-blue"),
      ),
      makeButton(
        { alienPickerStep: "basic", alienSlot: "2", traceType: "blue" },
        "外星人 2 放置蓝色痕迹，首标记 1/3",
        false,
        () => selected.push("slot-2-blue"),
      ),
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
  assert.equal(result.ok, true, "AI should resolve equal-progress hidden alien trace picker");
  assert.deepEqual(selected, ["slot-1-blue"], "AI should prefer alien 1's higher real first-trace reward");
}

{
  const selected = [];
  const alienGameState = {
    aliens: {
      1: makeHiddenAlienSlot(),
      2: makeHiddenAlienSlot({ yellow: "white" }),
    },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    alienSlotIds: [1, 2],
    alienGameState,
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: { mode: "basic", allowedTraceTypes: ["blue"] },
    alienPickerButtons: [
      makeButton(
        { alienPickerStep: "basic", alienSlot: "1", traceType: "blue" },
        "外星人 1 放置蓝色痕迹，首标记 0/3",
        false,
        () => selected.push("slot-1-blue"),
      ),
      makeButton(
        { alienPickerStep: "basic", alienSlot: "2", traceType: "blue" },
        "外星人 2 放置蓝色痕迹，首标记 1/3",
        false,
        () => selected.push("slot-2-blue"),
      ),
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
  assert.equal(result.ok, true, "AI should resolve progressed hidden alien trace picker");
  assert.deepEqual(selected, ["slot-2-blue"], "AI should continue a real reveal chain instead of restarting an empty slot");
}

{
  const selected = [];
  const alienGameState = {
    aliens: {
      1: makeHiddenAlienSlot({ blue: "blue" }),
      2: makeHiddenAlienSlot({ yellow: "green", pink: "white" }),
    },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    alienSlotIds: [1, 2],
    alienGameState,
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: { mode: "basic", allowedTraceTypes: ["blue"] },
    alienPickerButtons: [
      makeButton(
        { alienPickerStep: "basic", alienSlot: "1", traceType: "blue" },
        "外星人 1 蓝色痕迹 额外 +1",
        false,
        () => selected.push("slot-1-blue"),
      ),
      makeButton(
        { alienPickerStep: "basic", alienSlot: "2", traceType: "blue" },
        "外星人 2 放置蓝色痕迹，首标记 2/3",
        false,
        () => selected.push("slot-2-blue"),
      ),
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
  assert.equal(result.ok, true, "AI should resolve hidden alien trace picker");
  assert.deepEqual(selected, ["slot-2-blue"], "AI should complete alien 2 reveal setup before farming old hidden extra traces");
}

{
  const selected = [];
  const alienGameState = makeBanrenmaAlienState();
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    alienGameState,
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "banrenma-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "4", banrenmaPosition: "4" },
        "半人马蓝色痕迹 4号位：3分，外星人牌",
        false,
        () => selected.push("alien-card"),
      ),
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "3", banrenmaPosition: "3" },
        "半人马蓝色痕迹 3号位：5分",
        false,
        () => selected.push("score-5"),
      ),
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
  assert.equal(result.ok, true, "AI should resolve late Banrenma trace picker");
  assert.deepEqual(selected, ["score-5"], "AI should discount late alien-card rewards when direct score is available");
}

{
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { availableData: 3, score: 30 },
    blueTechCounts: { blue: 3 },
    alienGameState: makeBanrenmaAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "banrenma-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "2", banrenmaPosition: "2" },
        "半人马蓝色痕迹 2号位：支付 3 数据，15分",
        false,
        () => selected.push("pay-data-score"),
      ),
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "5", banrenmaPosition: "5" },
        "半人马蓝色痕迹 5号位：5分，外星人牌",
        false,
        () => selected.push("card-5"),
      ),
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
  assert.equal(result.ok, true, "AI should resolve Banrenma blue-tech trace picker");
  assert.deepEqual(
    selected,
    ["card-5"],
    "AI should delay Banrenma 3-data score conversion when blue tech already covers the data route",
  );
}

{
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { availableData: 4, score: 44 },
    blueTechCounts: { blue: 0 },
    alienGameState: makeBanrenmaAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "banrenma-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "2", banrenmaPosition: "2" },
        "半人马蓝色痕迹 2号位：支付 3 数据，15分",
        false,
        () => selected.push("pay-data-score"),
      ),
      makeButton(
        { alienSlot: "1", banrenmaTraceType: "blue", banrenmaTraceSlot: "5", banrenmaPosition: "5" },
        "半人马蓝色痕迹 5号位：5分，外星人牌",
        false,
        () => selected.push("card-5"),
      ),
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
  assert.equal(result.ok, true, "AI should resolve Banrenma threshold trace picker");
  assert.deepEqual(
    selected,
    ["pay-data-score"],
    "AI should still take Banrenma 3-data score conversion when it crosses a final-score threshold",
  );
}

{
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { aomomoFossils: 4, score: 42 },
    alienGameState: makeAomomoAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "aomomo-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", aomomoTraceType: "blue", aomomoTraceSlot: "4", aomomoPosition: "4" },
        "奥陌陌蓝色痕迹 4号位：3分，外星人牌，1化石",
        false,
        () => selected.push("fossil-card"),
      ),
      makeButton(
        { alienSlot: "1", aomomoTraceType: "blue", aomomoTraceSlot: "5", aomomoPosition: "5" },
        "奥陌陌蓝色痕迹 5号位：支付 4 化石，25分",
        false,
        () => selected.push("spend-four-fossils"),
      ),
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
  assert.equal(result.ok, true, "AI should cash out Aomomo 4-fossil trace when ready");
  assert.deepEqual(
    selected,
    ["spend-four-fossils"],
    "AI should prioritize the 25-score Aomomo trace once it has four fossils available",
  );
}

{
  const selected = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { aomomoFossils: 0, score: 35 },
    alienGameState: makeAomomoAlienState(),
    pendingAlienTraceAction: { targetPlayerId: "player-blue" },
    alienTracePickerState: {
      mode: "aomomo-grid",
      selectedAlienSlotId: 1,
      allowedTraceTypes: ["blue"],
    },
    alienTraceButtons: [
      makeButton(
        { alienSlot: "1", aomomoTraceType: "blue", aomomoTraceSlot: "2", aomomoPosition: "2" },
        "奥陌陌蓝色痕迹 2号位：2分，1化石",
        false,
        () => selected.push("distant-fossil"),
      ),
      makeButton(
        { alienSlot: "1", aomomoTraceType: "blue", aomomoTraceSlot: "3", aomomoPosition: "3" },
        "奥陌陌蓝色痕迹 3号位：3分，外星人牌",
        false,
        () => selected.push("alien-card"),
      ),
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
  assert.equal(result.ok, true, "AI should not overbuild a distant Aomomo fossil plan");
  assert.deepEqual(
    selected,
    ["alien-card"],
    "AI should take the card slot instead of overvaluing the first fossil toward a distant 4-fossil trace",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    blueInitialSelection: {
      industry: { id: "industry:寰宇超动力", label: "寰宇超动力" },
    },
    blueResources: { score: 97, credits: 4, energy: 1, publicity: 6, availableData: 0, handSize: 5 },
    blueHand: [
      {
        id: "final-unready-task-card",
        cardId: "final-unready-task-card",
        cardName: "Final unready task card",
        price: 3,
        typeCode: 2,
        playEffects: [{
          type: "card_research_tech",
          options: { techTypes: ["orange"], skipCost: true },
        }],
        model: {
          tasks: [{
            id: "unready-yellow-task",
            condition: { type: "allAliensHavePlayerTrace", traceType: "yellow" },
            rewards: [{ type: "gain_resources", options: { gain: { score: 2 } } }],
          }],
        },
      },
      { id: "task-filler-a", cardName: "Task filler A", price: 4 },
      { id: "task-filler-b", cardName: "Task filler B", price: 4 },
      { id: "task-filler-c", cardName: "Task filler C", price: 4 },
      { id: "task-filler-d", cardName: "Task filler D", price: 4 },
    ],
    takeableTechIds: ["orange1"],
    techStacks: {
      orange1: { techType: "orange", stackIndex: 1, remaining: 2 },
    },
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_c2: {
          id: "final_c2",
          marks: [{ playerId: "player-blue", slotIndex: 2, threshold: 50 }],
        },
        final_d2: {
          id: "final_d2",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_c2: "c2",
      final_d2: "d2",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const taskCardCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "playCard" && candidate.cardId === "final-unready-task-card");
  assert.ok(taskCardCandidate, "terminal task card should remain playable for its real technology effect");
  assert.equal(taskCardCandidate.valueBreakdown?.finalUnreadyTaskSetupSuppressed, true);
  assert.equal(
    taskCardCandidate.valueBreakdown?.cFinalTaskProgressValue,
    0,
    "an unready terminal task must not count as completed-task final progress",
  );
  assert.ok(
    Number(taskCardCandidate.valueBreakdown?.playCardConversionPressure || 0) < 25,
    "an unready terminal task must not create circular task conversion pressure",
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
    blueInitialSelection: {
      industry: { id: "industry:寰宇超动力", label: "寰宇超动力" },
    },
    blueResources: { score: 97, credits: 1, energy: 1, publicity: 3, availableData: 0, handSize: 4 },
    blueHand: [
      {
        id: "tail-route-card",
        cardName: "Tail route card",
        price: 2,
        playEffects: [{ type: "free_move", options: { movementPoints: 2 } }],
      },
      { id: "route-filler-a", cardName: "Route filler A", price: 2 },
      { id: "route-filler-b", cardName: "Route filler B", price: 2 },
      { id: "route-filler-c", cardName: "Route filler C", price: 2 },
    ],
    rocketTokensByPlayer: {
      "player-blue": [{ id: 201, playerId: "player-blue", sector: { x: 1, y: 2 } }],
    },
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
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  assert.ok(turnChoices.length > 0, "AI should enumerate terminal choices before rejecting the route-card unlock trade");
  assert.equal(
    turnChoices.flat().some((candidate) => (
      candidate.id === "quickTrade"
      && candidate.tradeId === "cards-for-credit"
      && candidate.valueBreakdown?.mainUnlockTrade
    )),
    false,
    "low-tail terminal trade should reject route-only cards without measurable final scoring",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    turnNumber: 7,
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
    },
    movableTokens: [
      { id: 1, playerId: "player-blue", sector: { x: 2, y: 2 } },
    ],
    planetLocations: [
      { planetId: "mercury", name: "Mercury", x: 2, y: 2 },
    ],
    actionChecks: {
      orbit: { ok: true, planet: { planetId: "mercury", name: "Mercury" } },
    },
    planetStats: {
      canAddLandingMarker: () => true,
      canAddOrbitMarker: () => true,
      getAvailableSatellitesForLanding: () => [],
      getPlanetLandingCount: () => 0,
      getPlanetOrbitCount: () => 0,
    },
    abilities: {
      planet: {
        DEFAULT_ORBIT_COST: { credits: 1, energy: 1 },
        BASE_LAND_ENERGY_COST: 3,
        getLandEnergyCost: () => 3,
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
      buildOrbitRewardEffects: () => [
        { type: "gain_resources", options: { gain: { score: 3 } } },
      ],
      buildSatelliteLandRewardEffects: () => [],
    },
    blueResources: { score: 81, credits: 2, energy: 1, publicity: 0, availableData: 0, handSize: 0 },
    finalScoringState: {
      tiles: {
        final_a1: { id: "final_a1", marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }] },
        final_b2: { id: "final_b2", marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }] },
        final_d2: { id: "final_d2", marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }] },
      },
    },
    finalFormulaIds: { final_a1: "a1", final_b2: "b2", final_d2: "d2" },
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

  harness.controller.runAiAutomationStep();
  const candidates = turnChoices.flat();
  assert.ok(candidates.some((candidate) => candidate.id === "orbit"), "ready Mercury orbit should be available");
  assert.equal(
    candidates.some((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy"),
    false,
    "AI should not spend the last orbit credit on a trade that still leaves landing energy short",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    recordMove: true,
    canPayForMove: true,
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
    earthCoordinate: { x: 1, y: 1 },
    alienGameState: makeChongTransportAlienState({ rocketId: 77 }),
    movableTokens: [
      {
        id: 77,
        kind: "chong-fossil",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 1, y: 3 },
        sectorX: 1,
        sectorY: 3,
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
  assert.equal(result.ok, true, "AI should choose a Chong fossil transport move");
  assert.ok(
    turnChoices.some((candidates) => candidates.some((candidate) => candidate.id === "move")),
    "AI should enumerate a legal Chong fossil move candidate",
  );
  assert.deepEqual(
    harness.getHandled(),
    { type: "move", deltaX: 0, deltaY: -1, rocketId: 77 },
    "AI should move transported Chong fossils only closer to Earth",
  );
}

{
  let selectedTurnAction = null;
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    roundNumber: 3,
    blueResources: { score: 42, availableData: 1, handSize: 3, credits: 5, energy: 5 },
    recordMove: true,
    canPayForMove: true,
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
      getComputerSlotBonus: (slot) => (Number(slot) === 4
        ? { type: "income", gain: { energy: 1 } }
        : null),
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
    earthCoordinate: { x: 1, y: 1 },
    alienGameState: makeChongTransportAlienState({ rocketId: 77 }),
    movableTokens: [
      {
        id: 77,
        kind: "chong-fossil",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 1, y: 3 },
        sectorX: 1,
        sectorY: 3,
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
  assert.equal(result.ok, true, "AI should keep Chong transport moving when an income slot is also available");
  assert.equal(selectedTurnAction?.id, "move", "Chong transport should outrank generic income placement once carried");
  assert.deepEqual(
    harness.getHandled(),
    { type: "move", deltaX: 0, deltaY: -1, rocketId: 77 },
    "AI should cash out carried Chong fossils before extending the generic engine",
  );
}

{
  const moveEffect = { id: "test-chong-card-move", type: "card_move", options: { movementPoints: 1 } };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    recordEffectMove: true,
    canPayForMove: true,
    allowedMoveDeltas: [{ deltaX: 0, deltaY: -1 }],
    earthCoordinate: { x: 1, y: 1 },
    pendingActionEffectFlow: {
      currentIndex: 0,
      effects: [moveEffect],
      cardMoveEffect: { effect: moveEffect, poolRemaining: 1 },
    },
    alienGameState: makeChongTransportAlienState({ rocketId: 77 }),
    movableTokens: [
      {
        id: 77,
        kind: "chong-fossil",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 1, y: 3 },
        sectorX: 1,
        sectorY: 3,
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
  assert.equal(result.ok, true, "AI should move Chong fossil during card movement when the step gets closer");
  assert.deepEqual(
    harness.getHandled(),
    { type: "effect-move", deltaX: 0, deltaY: -1, rocketId: 77 },
    "AI card movement should move transported Chong fossils only inward toward Earth",
  );
}

{
  const moveEffect = { id: "test-chong-card-move-away", type: "card_move", options: { movementPoints: 1 } };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    recordEffectMove: true,
    recordSkipCurrentActionEffect: true,
    canPayForMove: true,
    allowedMoveDeltas: [{ deltaX: 0, deltaY: 1 }],
    earthCoordinate: { x: 1, y: 1 },
    pendingActionEffectFlow: {
      currentIndex: 0,
      effects: [moveEffect],
      cardMoveEffect: { effect: moveEffect, poolRemaining: 1 },
    },
    alienGameState: makeChongTransportAlienState({ rocketId: 77 }),
    movableTokens: [
      {
        id: 77,
        kind: "chong-fossil",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 1, y: 3 },
        sectorX: 1,
        sectorY: 3,
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
  assert.equal(result.ok, true, "AI should skip Chong fossil card movement when every legal step moves away from Earth");
  assert.equal(result.skipped, true, "away-from-Earth Chong fossil effect movement should be skipped");
  assert.deepEqual(
    harness.getHandled(),
    { type: "skip-effect" },
    "AI should not spend card movement pushing transported Chong fossils outward",
  );
}

{
  const moveEffect = { id: "test-chong-card-move-to-fossil", type: "card_move", options: { movementPoints: 1 } };
  const chongLandEffect = chong.buildImmediateEffects(3).find((effect) => (
    effect.type === chong.EFFECT_TYPES.CHONG_LAND_FOR_PICKUP
  ));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    recordEffectMove: true,
    canPayForMove: true,
    allowedMoveDeltas: [
      { deltaX: 1, deltaY: 0 },
      { deltaX: 0, deltaY: 1 },
    ],
    planetLocations: [
      { planetId: "jupiter", label: "木星", name: "木星", x: 1, y: 2 },
      { planetId: "uranus", label: "天王星", name: "天王星", x: 0, y: 3 },
    ],
    planetStats: {
      canAddLandingMarker: () => true,
      canAddOrbitMarker: () => true,
      getAvailableSatellitesForLanding: () => [],
      getPlanetLandingCount: () => 0,
      getPlanetOrbitCount: () => 0,
    },
    pendingActionEffectFlow: {
      currentIndex: 0,
      effects: [moveEffect, chongLandEffect],
      cardMoveEffect: { effect: moveEffect, poolRemaining: 1 },
    },
    alienGameState: makeChongAvailableFossilAlienState({ planetId: "jupiter" }),
    movableTokens: [
      {
        id: 77,
        kind: "standard",
        playerId: "player-blue",
        color: "blue",
        sector: { x: 0, y: 2 },
        sectorX: 0,
        sectorY: 2,
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
  assert.equal(result.ok, true, "AI should move toward a Chong fossil pickup planet before the pickup landing");
  assert.deepEqual(
    harness.getHandled(),
    { type: "effect-move", deltaX: 1, deltaY: 0, rocketId: 77 },
    "AI should prefer Jupiter over a non-fossil high-score landing when a Chong pickup follows",
  );
}
{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    blueResources: { credits: 5, energy: 5, handSize: 1 },
    blueHand: [chong.createAlienCard(8, 1)],
    abilities: {
      planet: {
        DEFAULT_ORBIT_COST: { credits: 1, energy: 1 },
        BASE_LAND_ENERGY_COST: 3,
        getLandEnergyCost: () => 0,
        getLandOptions: () => ({
          ok: true,
          choices: [{
            planetId: "mars",
            planet: { planetId: "mars", label: "火星", name: "火星" },
            target: { type: "planet" },
            energyCost: 0,
            label: "登陆火星",
          }],
        }),
        getOrbitOptions: () => ({ ok: false, message: "orbit disabled in harness" }),
      },
      rocket: {
        ORANGE1_ROCKET_LIMIT: 4,
        getRocketLimitForPlayer: () => 3,
      },
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
  assert.equal(result.blocked, true, "AI should not play a Chong transport card when only non-fossil planets are landable");
  assert.equal(harness.getHandled(), null);
}
{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    blueHand: [chong.createAlienCard(2, 1)],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should select a playable Chong alien card from hand");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 0, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    runezuQuick: true,
    blueHand: [runezu.createAlienCard(4, 1)],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.blocked, true, "AI should wait on Runezu task cards until the next task symbol has a face reward");
  assert.equal(harness.getHandled(), null);
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    runezuQuick: true,
    runezuFaceSymbolSlots: { 4: "symbol_4" },
    blueHand: [runezu.createAlienCard(4, 1)],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should play Runezu task cards once the next task symbol has a face reward");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 0, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    blueHand: [{
      ...fangzhou.createCard2Definition("pink", 1),
      id: "fangzhou-card2-ai-test",
      faceUp: true,
      fangzhouCard2: true,
      fangzhouTraceType: "pink",
    }],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should select a playable Fangzhou card2 from hand");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 0, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    playCardSelectionActive: true,
    blueHand: [
      { id: "low-value-blank", cardName: "低价值空牌", price: 0 },
      {
        ...fangzhou.createCard2Definition("blue", 4),
        id: "fangzhou-card2-priority-test",
        faceUp: true,
        fangzhouCard2: true,
        fangzhouTraceType: "blue",
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
  assert.equal(result.ok, true, "AI should prefer Fangzhou card2 advanced reward over a low-value blank card");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 1, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    playCardSelectionActive: true,
    realisticCanAfford: true,
    blueResources: { score: 189, credits: 1, energy: 0, publicity: 7, handSize: 1 },
    blueHand: [{
      id: "pay-credit-score",
      cardName: "Pay credit score",
      price: 0,
      playEffects: [{
        type: "card_pay_credits_for_reward",
        label: "每支付1信用获得2分2宣传",
        options: {
          reward: {
            type: "gain_resources",
            label: "支付1信用：2分+2宣传",
            options: { gain: { score: 2, publicity: 2 } },
          },
        },
      }],
    }],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should play supported pay-credit reward cards");
  assert.deepEqual(harness.getHandled(), { type: "play-card", handIndex: 0, confirmed: true });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    playCardSelectionActive: true,
    realisticCanAfford: true,
    blueResources: { score: 189, credits: 1, energy: 2, publicity: 7, handSize: 1 },
    blueHand: [{
      id: "pay-credit-score-with-energy",
      cardName: "Pay credit score with energy",
      price: 0,
      playEffects: [{
        type: "card_pay_credits_for_reward",
        label: "每支付1信用获得2分2宣传",
        options: {
          reward: {
            type: "gain_resources",
            label: "支付1信用：2分+2宣传",
            options: { gain: { score: 2, publicity: 2 } },
          },
        },
      }],
    }],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, false, "AI should keep pay-credit cards out of active play while energy remains");
  assert.equal(harness.getHandled(), null);
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    recordResearchTech: true,
    blueResources: { score: 98, credits: 6, energy: 4, handSize: 0 },
    blueOwnedTechTiles: {
      orange1: true,
      purple1: true,
      blue1: true,
      blue2: true,
    },
    blueTechCounts: { orange: 1, purple: 1, blue: 2 },
    finalScoringState: {
      tiles: {
        final_b1: {
          id: "final_b1",
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
      final_b1: "b1",
      final_c2: "c2",
      final_d1: "d1",
    },
    finalSlotMultipliers: {
      b1: { 1: 6 },
      c2: { 1: 6 },
      d1: { 1: 8 },
    },
    takeableTechIds: ["orange2", "purple2", "blue3"],
    techStacks: {
      orange2: { techType: "orange", stackIndex: 2 },
      purple2: { techType: "purple", stackIndex: 2 },
      blue3: { techType: "blue", stackIndex: 3 },
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
  assert.equal(result.ok, true, "AI should execute the low-tech catch-up research action");
  assert.deepEqual(harness.getHandled(), { type: "research-tech" });
  const researchCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "researchTech");
  assert.ok(researchCandidate, "researchTech candidate should be enumerated");
  assert.ok(
    researchCandidate.takeable.some((candidate) => (
      Number(candidate.valueBreakdown?.lowTechCatchupValue || 0) > 0
    )),
    "low-tech D1 tail should receive an explicit lowTechCatchupValue",
  );
  assert.ok(
    researchCandidate.takeable.some((candidate) => (
      Number(candidate.finalFormulaDeltas?.d1 || 0) > 0
      || Number(candidate.finalFormulaDeltas?.d2 || 0) > 0
    )),
    "low-tech D1 tail should retain setup deltas for future research planning",
  );
  const passCandidate = turnChoices.flat().find((candidate) => candidate.id === "pass");
  assert.ok(
    Number(researchCandidate.score || 0) > Number(passCandidate?.score || -Infinity),
    "low-tech catch-up research should outrank PASS",
  );
}

{
  const buildOrange4Harness = (withProspectiveOpponent, scenario = {}) => {
    const turnChoices = [];
    const extraPlayers = scenario.extraPlayers || (withProspectiveOpponent
      ? [{
        id: "player-green",
        color: "green",
        colorLabel: "Green",
        resources: { credits: 4, energy: 3, publicity: 6, handSize: 2 },
        income: { publicity: 0 },
      }]
      : []);
    const harness = createAiControllerHarness(null, {
      currentPlayerColor: "blue",
      roundNumber: scenario.roundNumber || 1,
      canStartMainAction: true,
      recordResearchTech: true,
      realisticCanAfford: true,
      blueResources: scenario.blueResources
        || { score: 12, credits: 4, energy: 3, publicity: 6, handSize: 2 },
      extraPlayers,
      quickTrades: scenario.quickTrades,
      abilities: scenario.abilities,
      aiRaceModel: scenario.aiRaceModel,
      takeableTechIds: ["orange4", "blue1"],
      techStacks: {
        orange4: { techType: "orange", stackIndex: 1, remaining: 3 },
        blue1: { techType: "blue", stackIndex: 1, remaining: 3 },
      },
      planetLocations: [{ planetId: "neptune", name: "Neptune", x: 4, y: 4 }],
      rocketTokensByPlayer: scenario.rocketTokensByPlayer || {
        "player-blue": [{ id: 8, sector: { x: 2, y: 4 } }],
        ...(withProspectiveOpponent ? { "player-green": [{ id: 9, sector: { x: 4, y: 4 } }] } : {}),
      },
      planetStats: {
        canAddLandingMarker: () => false,
        canAddOrbitMarker: () => false,
        getAvailableSatellitesForLanding: (stateToRead, planetId) => (
          planetId === "neptune"
            ? [{ satelliteId: "triton", satelliteName: "Triton" }]
            : []
        ),
        getPlanetLandingCount: () => 0,
        getPlanetOrbitCount: () => 0,
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
        buildSatelliteLandRewardEffects: () => [{
          type: "gain_resources",
          options: { gain: { score: 26 } },
        }],
        buildPlanetLandRewardEffects: () => [],
        buildOrbitRewardEffects: () => [],
      },
      onChooseTurnAction: (candidates) => turnChoices.push(candidates),
      chooseTurnAction: (candidates) => (
        candidates.find((candidate) => candidate.id === "researchTech")
        || candidates.find((candidate) => candidate.available !== false)
        || null
      ),
    });
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    });
    const result = harness.controller.runAiAutomationStep();
    assert.equal(result.ok, true, "AI should evaluate the orange4 tech candidate");
    const researchCandidate = turnChoices.flat().find((candidate) => candidate.id === "researchTech");
    assert.ok(researchCandidate, "researchTech candidate should be available");
    const orange4 = researchCandidate.takeable.find((candidate) => candidate.tileId === "orange4");
    assert.ok(orange4, "orange4 candidate should be listed");
    return orange4;
  };

  const uncontestedOrange4 = buildOrange4Harness(false);
  const contestedOrange4 = buildOrange4Harness(true);
  const profile = contestedOrange4.valueBreakdown?.orange4SatelliteProfile || {};
  assert.equal(profile.prospectiveOrange4Count, 1, "nearby opponent that can research orange4 should count as prospective satellite pressure");
  assert.ok(Number(profile.rawRacePenalty || 0) > 0, "prospective satellite pressure should create race penalty");
  assert.ok(
    Number(profile.potential || 0) < Number(profile.rawPotential || 0),
    "orange4 satellite potential should be discounted by race risk",
  );
  assert.ok(
    Number(contestedOrange4.score || 0) < Number(uncontestedOrange4.score || 0),
    "orange4 tech score should drop when a closer opponent can reach the same satellite route",
  );
  const noRouteOrange4 = buildOrange4Harness(false, { rocketTokensByPlayer: {} });
  const noRouteProfile = noRouteOrange4.valueBreakdown?.orange4SatelliteProfile || {};
  assert.equal(noRouteProfile.routeDistance, 99);
  assert.ok(Number(noRouteProfile.rawPotential || 0) > 0, "unreachable satellite reward should remain visible for diagnostics");
  assert.ok(Number(noRouteProfile.potential || 0) > 0, "pre-final orange4 should retain route-building value");

  const energyTrade = {
    id: "cards-for-energy",
    label: "2 cards -> 1 energy",
    cost: { handSize: 2 },
    gain: { energy: 1 },
  };
  const timedRaceScenario = (opponentEnergy) => buildOrange4Harness(true, {
    roundNumber: 2,
    blueResources: { score: 51, credits: 4, energy: 2, publicity: 6, handSize: 2 },
    extraPlayers: [{
      id: "player-green",
      color: "green",
      colorLabel: "Green",
      resources: { credits: 0, energy: opponentEnergy, publicity: 6, handSize: 3 },
      income: { energy: 3, publicity: 0 },
    }],
    quickTrades: { "cards-for-energy": energyTrade },
    aiRaceModel: setiAi.raceModel,
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
    rocketTokensByPlayer: {
      "player-blue": [{ id: 8, sector: { x: 2, y: 4 } }],
      "player-green": [{ id: 9, sector: { x: 4, y: 4 } }],
    },
  }).valueBreakdown?.orange4SatelliteProfile || {};

  const resourceLockedRace = timedRaceScenario(0);
  const immediatelyReadyRace = timedRaceScenario(2);
  const lockedOpponent = resourceLockedRace.opponentEtas
    ?.find((entry) => entry.playerId === "player-green") || null;
  const readyOpponent = immediatelyReadyRace.opponentEtas
    ?.find((entry) => entry.playerId === "player-green") || null;
  assert.ok(lockedOpponent && readyOpponent, "orange4 profile should expose opponent ETA diagnostics");
  assert.equal(lockedOpponent.landingEnergyShortfall, 2, "same-round race must use current E0, not next-round energy income");
  assert.equal(lockedOpponent.immediateEnergyTradeGain, 1, "H3 should expose only one immediately affordable cards-for-energy trade");
  assert.equal(lockedOpponent.resourceSetupActions, 2, "E0 to E2 should require at least two resource preparation steps");
  assert.equal(lockedOpponent.requiresFutureIncome, true, "one immediate trade must not make an E2 landing available this round");
  assert.equal(lockedOpponent.actsBeforeActorNext, true, "resource timing regression must cover an opponent in the current action window");
  assert.equal(lockedOpponent.eta, 4, "distance-zero opponent should add one tech and two resource setup steps");
  assert.equal(readyOpponent.eta, 2, "energy-ready opponent should need only landing plus prospective orange4 setup");
  assert.equal(resourceLockedRace.estimatedFastestOpponentEta, 4, "race diagnostics should retain the delayed opponent ETA");
  assert.ok(
    Number(lockedOpponent.eta) >= Number(readyOpponent.eta) + 2,
    "resource-locked opponent ETA should include the two missing-energy preparation steps",
  );
  assert.ok(
    Number(resourceLockedRace.rawRacePenalty || 0) < Number(immediatelyReadyRace.rawRacePenalty || 0),
    "future income must not create the same race penalty as an opponent that can land immediately",
  );
}

{
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    recordAnalyze: true,
    blueResources: { score: 75, credits: 1, energy: 1, publicity: 1, availableData: 0, handSize: 3 },
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
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: () => ({ ok: true }),
      listComputerPlacedTokens: () => placedTokens,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "analyze") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should execute the capped analyze action in the harness");
  assert.deepEqual(harness.getHandled(), { type: "analyze" });
  const analyzeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "analyze");
  assert.ok(analyzeCandidate, "analyze candidate should be enumerated");
  assert.ok(
    Number(analyzeCandidate.score || 0) <= 8,
    "final low-value analyze should be capped instead of scoring like a high-value cashout",
  );
}

{
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    aiDifficulty: "weak_start",
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
    blueResources: { score: 100, credits: 1, energy: 0, publicity: 2, availableData: 3, handSize: 3 },
    blueHand: [
      { id: "stranded-analyze-a", cardName: "Stranded Analyze A", price: 2 },
      { id: "stranded-analyze-b", cardName: "Stranded Analyze B", price: 2 },
      { id: "stranded-analyze-c", cardName: "Stranded Analyze C", price: 2 },
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
  assert.equal(result.ok, true, "weak_start final stranded hand should trade for a concrete analyze");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-energy" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.ok(tradeCandidate, "weak_start final stranded analyze trade should be enumerated");
  assert.equal(tradeCandidate.valueBreakdown?.resourceLockMainUnlockTrade, true);
  assert.equal(tradeCandidate.valueBreakdown?.weakStartFinalStrandedAnalyzeUnlock, true);
  assert.equal(tradeCandidate.valueBreakdown?.unlockedMainAction?.actionId, "analyze");
  assert.equal(tradeCandidate.valueBreakdown?.handAfterTrade, 1);
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.unlockedMainAction?.score || 0) >= 7,
    "the stranded-hand exception should still require a concrete analyze score",
  );
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.discardCost || 0) <= 6.5,
    "the stranded-hand exception should stay limited to low-opportunity-cost discards",
  );
}

{
  const turnChoices = [];
  let selectedAction = null;
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    aiDifficulty: "weak_start",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordAnalyze: true,
    blueResources: { score: 106, credits: 1, energy: 2, publicity: 6, availableData: 3, handSize: 3 },
    publicCards: [{
      id: "public-late-scan",
      cardId: "public-late-scan",
      cardName: "Late scan setup",
      scanActionCode: 2,
    }],
    finalScoringState: {
      tiles: {
        final_a1: {
          id: "final_a1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
        final_c1: {
          id: "final_c1",
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
      final_c1: "c1",
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
      buildScanEffectQueue: () => [{ type: "public_card_scan" }],
      canExecuteScan: (player) => (
        Number(player?.resources?.credits || 0) >= 1 && Number(player?.resources?.energy || 0) >= 2
          ? { ok: true }
          : { ok: false, message: "scan resources missing" }
      ),
    },
    getPublicScanChoicesForCard: () => ({
      ok: true,
      choices: [{ nebulaId: "late-nebula", sectorX: 4, label: "Late nebula" }],
    }),
    data: {
      ANALYZE_REQUIRED_COMPUTER_SLOT: 6,
      ANALYZE_ENERGY_COST: 1,
      canAnalyzeData: (player) => (
        Number(player?.resources?.energy || 0) >= 1
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
      listComputerPlacedTokens: () => placedTokens,
      getNextReplaceableNebulaToken: () => ({ slotIndex: 30 }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
    },
    actionGraph: setiAi.actionGraph,
    onChooseTurnAction: (candidates, selected) => {
      turnChoices.push(candidates);
      selectedAction = selected;
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => (
        Number(right.actionGraph?.net ?? right.score ?? 0) - Number(left.actionGraph?.net ?? left.score ?? 0)
      ))[0] || null,
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
  const candidates = turnChoices.flat();
  const scanCandidate = candidates.find((candidate) => candidate.id === "scan");
  const analyzeCandidate = candidates.find((candidate) => candidate.id === "analyze");
  assert.ok(scanCandidate, "scan candidate should be enumerated");
  assert.ok(analyzeCandidate, "analyze candidate should be enumerated");
  assert.equal(scanCandidate.scoreCapReason, "保留终局分析能量");
  assert.ok(
    Number(scanCandidate.score || 0) < Number(analyzeCandidate.score || 0),
    "weak_start final scan should yield to available analyze when scan spends the last analyze energy",
  );
  assert.ok(
    Number(scanCandidate.actionGraph?.net || 0) < Number(analyzeCandidate.actionGraph?.net || 0),
    "weak_start final scan cap should also suppress action-graph goal bonus below analyze",
  );
  assert.equal(analyzeCandidate.scoreCapReason, "终局分析蓝痕迹与阈值不足");
  assert.equal(result.ok, true, "weak_start final low-resource AI should keep energy for analyze");
  assert.deepEqual(harness.getHandled(), { type: "analyze" });
  assert.equal(selectedAction?.id, "analyze");
}

{
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
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
    },
    blueResources: { score: 116, credits: 4, energy: 0, publicity: 0, availableData: 6, handSize: 2 },
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
        final_d1: {
          id: "final_d1",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 70 }],
        },
      },
    },
    finalFormulaIds: {
      final_a1: "a1",
      final_b2: "b2",
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
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy")
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
  assert.equal(result.ok, true, "D1 full-data midgame player should trade credits for energy before analyze");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "credits-for-energy" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy");
  assert.ok(tradeCandidate, "D1 midgame analyze unlock trade should be enumerated");
  assert.equal(tradeCandidate.reason, "中期引擎：信用点换能量解锁分析");
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.midgameAnalyzeUnlockByTrade?.["credits-for-energy"] || 0) > 0,
    "D1 analyze unlock should expose a positive diagnostic score",
  );
}

{
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
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
    },
    blueResources: { score: 130, credits: 6, energy: 0, publicity: 0, availableData: 6, handSize: 1 },
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
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy")
      || null,
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
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy");
  assert.equal(
    tradeCandidate,
    undefined,
    "D2-only midgame full-data player should not take the D1 analyze unlock trade",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordBeginPlayCard: true,
    takeableTechIds: ["purple1"],
    blueResources: { score: 118, credits: 3, energy: 1, publicity: 8, availableData: 0, handSize: 1 },
    blueHand: [{
      id: "ready-tech-task",
      cardName: "Ready tech task",
      price: 3,
      typeCode: 2,
      playEffects: [{
        type: "card_research_tech",
        options: { skipCost: true, techTypes: ["purple"] },
      }],
      model: {
        tasks: [{
          id: "ready-publicity-score",
          condition: { type: "resourceThreshold", resource: "publicity", count: 8 },
          rewards: [{ type: "gain_resources", options: { gain: { score: 9 } } }],
        }],
      },
    }],
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
  assert.equal(result.ok, true, "AI should enumerate the ready task research card");
  const playCardCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  const readyTaskCandidate = playCardCandidate?.playableCards?.[0] || null;
  assert.ok(readyTaskCandidate, "ready task research card should be a playable candidate");
  assert.ok(
    Number(readyTaskCandidate.valueBreakdown?.readyTaskCashoutValue || 0) >= 15,
    "met hand task should contribute immediate cashout value",
  );
  assert.equal(
    Number(readyTaskCandidate.valueBreakdown?.readyTaskCashoutDirectScore || 0),
    9,
    "ready task cashout should record the direct score reward",
  );
  assert.ok(
    Number(readyTaskCandidate.valueBreakdown?.readyTaskTechReplacementValue || 0) > 0,
    "ready task research card should reuse a bounded research-tech replacement value",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    recordCardCorner: true,
    blueResources: { score: 108, credits: 0, energy: 0, publicity: 4, availableData: 0, handSize: 1 },
    blueHand: [{
      id: "publicity-setup-corner",
      cardName: "Publicity setup corner",
      price: 0,
      resourceReward: { gain: { publicity: 1 } },
    }],
    blueOwnedTechTiles: {
      orange1: true,
      orange2: true,
      purple1: true,
      purple2: true,
      blue1: true,
      blue2: true,
    },
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
    finalSlotMultipliers: {
      d2: { 1: 8 },
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
  assert.equal(result.ok, true, "AI should use the first publicity corner toward a low-tech D2 recovery chain");
  assert.deepEqual(harness.getHandled(), { type: "card-corner", handIndex: 0, confirmed: true });
  const cornerCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "cardCorner");
  assert.ok(cornerCandidate, "staged publicity card-corner candidate should be enumerated");
  assert.ok(
    Number(cornerCandidate.valueBreakdown?.stagedTechSetupScore || 0) > 0,
    "publicity corner should get stagedTechSetupScore before it fully unlocks research",
  );
  assert.equal(
    Number(cornerCandidate.valueBreakdown?.followupMainActionScore || 0),
    0,
    "staged setup should be separate from the immediate research unlock score",
  );
}

{
  const turnChoices = [];
  const moveCornerCard = {
    id: "move-corner-deferred-followup",
    cardName: "Move corner deferred followup",
    typeCode: 1,
    price: 5,
    moveReward: { movementPoints: 1, gain: {} },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    pendingActionExecuted: true,
    recordCardCorner: true,
    blueResources: { score: 45, credits: 4, energy: 4, publicity: 0, availableData: 0, handSize: 7 },
    blueHand: [
      moveCornerCard,
      ...Array.from({ length: 6 }, (_value, index) => ({
        id: `move-corner-padding-${index}`,
        cardName: `Move corner padding ${index}`,
        typeCode: 1,
        price: 5,
      })),
    ],
    allowedMoveDeltas: [
      { deltaX: 1, deltaY: 0 },
      { deltaX: 0, deltaY: 1 },
    ],
    movableTokens: [{
      id: 901,
      kind: "standard",
      playerId: "player-blue",
      color: "blue",
      sector: { x: 0, y: 2 },
      sectorX: 0,
      sectorY: 2,
    }],
    planetLocations: [{ planetId: "jupiter", label: "木星", name: "木星", x: 1, y: 2 }],
    planetStats: {
      canAddLandingMarker: (_state, planetId) => planetId === "jupiter",
      canAddOrbitMarker: (_state, planetId) => planetId === "jupiter",
      getAvailableSatellitesForLanding: () => [],
      getPlanetLandingCount: () => 0,
      getPlanetOrbitCount: () => 0,
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .find((candidate) => candidate.id === "cardCorner")
      || candidates.find((candidate) => candidate.available !== false)
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
  assert.equal(result.ok, true, "AI should still be able to use a card-corner move after its main action");
  const cornerCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "cardCorner" && candidate.cardInstanceId === moveCornerCard.id);
  assert.ok(cornerCandidate, "deferred move card-corner candidate should be visible");
  assert.equal(
    cornerCandidate.moveFollowupMainAction?.timing,
    "next_turn",
    "card-corner move followup should be deferred after the main action has already been used",
  );
  assert.ok(
    Number(cornerCandidate.moveFollowupMainAction?.rawScore || 0)
      > Number(cornerCandidate.moveFollowupMainAction?.score || 0),
    "deferred card-corner move followup should keep rawScore but apply a smaller decision score",
  );
  assert.equal(
    Number(cornerCandidate.valueBreakdown?.moveFollowupScore),
    Number(cornerCandidate.moveFollowupMainAction?.score),
    "value breakdown should expose the applied followup score, not the raw immediate score",
  );
  assert.ok(
    Number(cornerCandidate.valueBreakdown?.moveFollowupScoreScale || 0) > 0
      && Number(cornerCandidate.valueBreakdown?.moveFollowupScoreScale || 0) < 1,
    "deferred card-corner move followup should record a next-turn discount scale",
  );
}

{
  const turnChoices = [];
  const selectedActions = [];
  const scoreForChoice = (candidate) => {
    const graphNet = Number(candidate?.actionGraph?.net);
    if (Number.isFinite(graphNet)) return graphNet;
    return Number(candidate?.score || 0);
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    pendingActionExecuted: true,
    recordCardCorner: true,
    blueResources: { score: 30, credits: 1, energy: 0, publicity: 0, availableData: 0, handSize: 6 },
    blueHand: Array.from({ length: 6 }, (_value, index) => ({
      id: `repeat-corner-${index}`,
      cardName: `Repeat corner ${index}`,
      price: 4,
      resourceReward: { gain: {} },
      incomeGain: { credits: 4, energy: 4, handSize: 2 },
    })),
    actionGraph: {
      buildActionGraph: (candidates) => candidates.map((candidate) => {
        if (candidate.id === "cardCorner") {
          return {
            ...candidate,
            gain: 6,
            cost: 0,
            finalMarginal: 2,
            goalBonus: 8,
            feasibility: 1,
            net: 6,
          };
        }
        if (candidate.id === "end-turn") {
          return {
            ...candidate,
            gain: 0,
            cost: 0,
            finalMarginal: 0,
            goalBonus: 0,
            feasibility: 1,
            net: 0,
          };
        }
        return {
          ...candidate,
          gain: Number(candidate.gain || candidate.score || 0),
          cost: Number(candidate.cost || 0),
          finalMarginal: 0,
          goalBonus: 0,
          feasibility: 1,
          net: Number(candidate.score || 0),
        };
      }),
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => scoreForChoice(right) - scoreForChoice(left))[0] || null,
    onChooseTurnAction: (candidates, selected) => {
      turnChoices.push(candidates);
      selectedActions.push(selected);
    },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const firstResult = harness.controller.runAiAutomationStep();
  assert.equal(firstResult.ok, true, "AI should allow the first raw-negative resource corner as setup");
  assert.equal(selectedActions[0]?.id, "cardCorner");
  assert.ok(Number(selectedActions[0]?.score) < 0, "fixture should exercise a raw-negative card corner");
  assert.equal(
    selectedActions[0]?.selectionAdjustment?.repeatedNegativeResourceCardCornerCap,
    undefined,
    "the first raw-negative resource corner in a turn should not be capped",
  );

  const secondResult = harness.controller.runAiAutomationStep();
  assert.equal(secondResult.ok, true, "AI should end the turn after the repeated no-cashout corner is capped");
  assert.equal(selectedActions[1]?.id, "end-turn");
  const repeatedCorner = turnChoices[1].find((candidate) => candidate.id === "cardCorner");
  assert.ok(repeatedCorner, "repeated raw-negative resource corner should still be visible for diagnostics");
  assert.equal(
    repeatedCorner.selectionAdjustment?.repeatedNegativeResourceCardCornerCap,
    1,
    "second same-turn raw-negative resource corner should be capped",
  );
  assert.equal(
    repeatedCorner.actionGraph?.net,
    -0.5,
    "cap should lower graph net below the normal end-turn candidate",
  );
}

{
  const turnChoices = [];
  const selectedActions = [];
  const scoreForChoice = (candidate) => {
    const graphNet = Number(candidate?.actionGraph?.net);
    if (Number.isFinite(graphNet)) return graphNet;
    return Number(candidate?.score || 0);
  };
  const resourceCornerCard = {
    id: "post-pass-resource-corner",
    cardName: "Post-pass resource corner",
    price: 4,
    resourceReward: { gain: { credits: 1 } },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    aiDifficulty: "weak_start",
    roundNumber: 2,
    pendingActionExecuted: true,
    passedPlayerIds: ["player-blue"],
    recordCardCorner: true,
    blueResources: { score: 32, credits: 0, energy: 1, publicity: 1, availableData: 0, handSize: 6 },
    blueHand: [
      resourceCornerCard,
      ...Array.from({ length: 5 }, (_value, index) => ({
        id: `post-pass-padding-${index}`,
        cardName: `Post-pass padding ${index}`,
        price: 4,
      })),
    ],
    actionGraph: {
      buildActionGraph: (candidates) => candidates.map((candidate) => {
        if (candidate.id === "cardCorner") {
          return {
            ...candidate,
            gain: 9,
            cost: 0,
            finalMarginal: 2,
            goalBonus: 7,
            feasibility: 1,
            net: 9,
          };
        }
        if (candidate.id === "end-turn") {
          return {
            ...candidate,
            gain: 0,
            cost: 0,
            finalMarginal: 0,
            goalBonus: 0,
            feasibility: 1,
            net: -0.5,
          };
        }
        return {
          ...candidate,
          gain: Number(candidate.gain || candidate.score || 0),
          cost: Number(candidate.cost || 0),
          finalMarginal: 0,
          goalBonus: 0,
          feasibility: 1,
          net: Number(candidate.score || 0),
        };
      }),
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => scoreForChoice(right) - scoreForChoice(left))[0] || null,
    onChooseTurnAction: (candidates, selected) => {
      turnChoices.push(candidates);
      selectedActions.push(selected);
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

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should end turn after a post-pass no-cashout resource corner is capped");
  assert.equal(selectedActions[0]?.id, "end-turn");
  const cappedCorner = turnChoices[0].find((candidate) => candidate.id === "cardCorner");
  assert.ok(cappedCorner, "post-pass resource corner should remain visible for diagnostics");
  assert.equal(
    cappedCorner.selectionAdjustment?.postPassNoCashoutCardCornerCap,
    true,
    "post-pass no-cashout resource corner should record its cap",
  );
  assert.equal(
    cappedCorner.actionGraph?.net,
    -0.75,
    "cap should stay below end-turn after quick score floor runs",
  );
}

console.log("app/ai-controller.alien.integration.test.js ok");

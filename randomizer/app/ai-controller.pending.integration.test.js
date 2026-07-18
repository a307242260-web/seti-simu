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
  const red = { id: "player-red", color: "red", colorLabel: "Red" };
  const yellow = { id: "player-yellow", color: "yellow", colorLabel: "Yellow" };
  const offers = Object.fromEntries(
    ["player-blue", "player-red", "player-yellow"].map((playerId) => [playerId, {
      industryOptions: [{ id: `industry:baseline-${playerId}`, label: "层云核心" }],
      initialOptions: [],
    }]),
  );
  const harness = createAiControllerHarness(null, {
    extraPlayers: [red, yellow],
    initialSelectionActive: true,
    initialSelectionOffers: offers,
    recordInitialSelection: true,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id, red.id, yellow.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const expectedIndustries = [
    [harness.blue.id, "industry:寰宇超动力", "寰宇超动力"],
    [red.id, "industry:宇宙大战略集团", "宇宙大战略集团"],
    [yellow.id, "industry:作弊实验室", "作弊实验室"],
  ];
  for (const [playerId, expectedId, expectedLabel] of expectedIndustries) {
    harness.playerState.currentPlayerId = playerId;
    const result = harness.controller.runAiAutomationStep();
    assert.equal(result.ok, true, `${expectedLabel} AI initial selection should complete`);
    assert.equal(offers[playerId].selectedIndustryId, expectedId);
    const selected = offers[playerId].industryOptions
      .find((card) => card.id === offers[playerId].selectedIndustryId);
    assert.equal(selected?.label, expectedLabel);
    assert.equal(selected?.aiOnly, true);
  }
}

{
  const turnChoices = [];
  const strategyIndustry = { id: "industry:宇宙大战略集团", label: "宇宙大战略集团" };
  const strategyRewards = {
    yellow: { credits: 1 },
    red: { publicity: 1 },
    blue: { data: 1 },
  };
  const publicScoreCard = {
    id: "strategy-public-score",
    cardId: "strategy-public-score",
    cardName: "Strategy public score",
    price: 0,
    scanActionCode: 2,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 8 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    canStartMainAction: true,
    realisticCanAfford: true,
    blueInitialSelection: { industry: strategyIndustry },
    blueIndustryStrategyPassiveSlots: { yellow: true, red: true, blue: false },
    blueResources: { score: 86, credits: 2, energy: 1, publicity: 2, handSize: 2 },
    publicCards: [publicScoreCard],
    industry: {
      STRATEGY_PASSIVE_SLOT_IDS: ["yellow", "red", "blue"],
      getIndustryActionMarkerLayout: () => ({ percentX: 9, percentY: 77, radiusPercent: 4.9 }),
      canMarkIndustryAction: () => ({ ok: true }),
      getIndustryDefinition: () => ({
        label: "宇宙大战略集团",
        activeAbilityId: "strategy_pick_card",
        passiveIds: ["strategy_passive_reward_slots", "grand_strategy_round_start"],
      }),
      playerHasStrategyPassive: () => true,
      hasGrandStrategyRoundStart: () => true,
      getStrategySlotReward: (slotId) => strategyRewards[slotId] || null,
      getStrategySlotRewardLabel: (slotId) => {
        if (slotId === "yellow") return "1 信用点";
        if (slotId === "red") return "1 宣传";
        if (slotId === "blue") return "1 数据";
        return "";
      },
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates
      .find((candidate) => candidate.id === "industry" && candidate.abilityId === "strategy_pick_card")
      || null,
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
  assert.equal(result.ok, true, "AI should enumerate the grand strategy 1x diagnostic candidate");
  const industryCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "industry" && candidate.abilityId === "strategy_pick_card");
  assert.ok(industryCandidate, "grand strategy 1x candidate should be available");
  assert.equal(
    industryCandidate.valueBreakdown?.industryPublicPick?.bestCard?.cardId,
    "strategy-public-score",
    "industry public-pick diagnostics should expose the best public card",
  );
  assert.deepEqual(
    industryCandidate.valueBreakdown?.strategyPassiveSlots?.occupiedSlotIds,
    ["yellow", "red"],
    "grand strategy diagnostics should expose occupied passive reward slots",
  );
  assert.deepEqual(
    industryCandidate.valueBreakdown?.strategyPassiveSlots?.emptySlotIds,
    ["blue"],
    "grand strategy diagnostics should expose empty passive reward slots",
  );
  assert.equal(
    industryCandidate.valueBreakdown?.strategyPassiveSlots?.roundStartClearsSlots,
    true,
    "grand strategy diagnostics should record the round-start auto-clear rule",
  );
}

{
  const turnChoices = [];
  const strategyIndustry = { id: "industry:宇宙大战略集团", label: "宇宙大战略集团" };
  const lowSignalPublicCard = {
    id: "low-signal-public-card",
    cardId: "low-signal-public-card",
    cardName: "Low signal public card",
    price: 0,
    scanActionCode: 1,
    playEffects: [{ type: "draw_cards", options: { count: 1 } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    canStartMainAction: true,
    realisticCanAfford: true,
    blueInitialSelection: { industry: strategyIndustry },
    blueIndustryStrategyPassiveSlots: { yellow: false, red: false, blue: false },
    blueAiDifficulty: "weak_start",
    blueResources: { score: 20, credits: 2, energy: 1, publicity: 2, handSize: 2 },
    publicCards: [lowSignalPublicCard],
    industry: {
      STRATEGY_PASSIVE_SLOT_IDS: ["yellow", "red", "blue"],
      getIndustryActionMarkerLayout: () => ({ percentX: 9, percentY: 77, radiusPercent: 4.9 }),
      canMarkIndustryAction: () => ({ ok: true }),
      getIndustryDefinition: () => ({
        label: "宇宙大战略集团",
        activeAbilityId: "strategy_pick_card",
        passiveIds: ["strategy_passive_reward_slots", "grand_strategy_round_start"],
      }),
      playerHasStrategyPassive: () => true,
      hasGrandStrategyRoundStart: () => true,
      getStrategySlotReward: (slotId) => ({
        yellow: { credits: 1 },
        red: { publicity: 1 },
        blue: { data: 1 },
      }[slotId] || null),
      getStrategySlotRewardLabel: (slotId) => ({
        yellow: "1 信用点",
        red: "1 宣传",
        blue: "1 数据",
      }[slotId] || ""),
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

  harness.controller.runAiAutomationStep();
  const industryCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "industry" && candidate.abilityId === "strategy_pick_card");
  assert.equal(
    industryCandidate,
    undefined,
    "early empty grand strategy 1x should wait when the best public card has no concrete play chain",
  );
}

{
  const turnChoices = [];
  const strategyIndustry = { id: "industry:宇宙大战略集团", label: "宇宙大战略集团" };
  const unreachableScoreCard = {
    id: "strategy-unreachable-score",
    cardId: "strategy-unreachable-score",
    cardName: "Unreachable score card",
    price: 3,
    typeCode: 2,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 15 } } }],
  };
  const thresholdRecoveryCard = {
    id: "strategy-threshold-recovery",
    cardId: "strategy-threshold-recovery",
    cardName: "Threshold recovery card",
    price: 0,
    typeCode: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 3 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    blueInitialSelection: { industry: strategyIndustry },
    blueIndustryStrategyPassiveSlots: { yellow: false, red: false, blue: false },
    blueResources: { score: 47, credits: 0, energy: 1, publicity: 2, handSize: 1 },
    publicCards: [unreachableScoreCard, thresholdRecoveryCard],
    finalScoringState: {
      tiles: {
        a: {
          id: "a",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 25 }],
        },
      },
    },
    industry: {
      STRATEGY_PASSIVE_SLOT_IDS: ["yellow", "red", "blue"],
      getIndustryActionMarkerLayout: () => ({ percentX: 9, percentY: 77, radiusPercent: 4.9 }),
      canMarkIndustryAction: () => ({ ok: true }),
      getIndustryDefinition: () => ({
        label: "宇宙大战略集团",
        activeAbilityId: "strategy_pick_card",
        passiveIds: ["strategy_passive_reward_slots", "grand_strategy_round_start"],
      }),
      playerHasStrategyPassive: () => true,
      hasGrandStrategyRoundStart: () => true,
      getStrategySlotReward: () => null,
      getStrategySlotRewardLabel: () => "",
    },
    onChooseTurnAction: (candidates) => turnChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "industry") || null,
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
  assert.equal(result.ok, true, "grand strategy recovery pick should remain executable");
  const industryCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "industry" && candidate.abilityId === "strategy_pick_card");
  assert.equal(
    industryCandidate.valueBreakdown?.industryPublicPick?.bestCard?.cardId,
    "strategy-threshold-recovery",
    "final-round grand strategy should prefer a playable threshold card over a higher unreachable score card",
  );
}

{
  const makeSolarPanelCard = () => ({
    id: "dlc_27.png",
    cardId: "dlc_27.png",
    cardName: "更优太阳能板",
    price: 0,
    typeCode: 0,
    scanActionCode: 1,
    playEffects: [{
      type: "card_conditional_reward",
      label: "若当前能量为0，按己方太阳系探测器数获得能量",
      options: {
        condition: { type: "resourceEquals", resource: "energy", count: 0 },
        rewards: [{
          type: "card_count_rockets_reward",
          label: "每个己方太阳系探测器或虫族搬运化石：1能量",
          options: { resource: "energy", owner: "current", location: "solar", per: 1, includeTransportedChongFossils: true },
        }],
      },
    }],
  });
  const noRocketChoices = [];
  const noRocketHarness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    blueResources: { score: 80, credits: 3, energy: 0, publicity: 0 },
    blueHand: [makeSolarPanelCard()],
    onChooseTurnAction: (candidates) => noRocketChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard")
      || candidates.find((candidate) => candidate.id === "end-turn")
      || candidates[0]
      || null,
  });
  assert.equal(
    noRocketHarness.controller.configureAiAutoBattle({
      playerIds: [noRocketHarness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  noRocketHarness.controller.runAiAutomationStep();
  const noRocketPlay = noRocketChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  assert.equal(noRocketPlay?.available, false, "zero-rocket solar panel should not be a playable positive candidate");
  assert.equal(noRocketPlay?.playableCards?.length || 0, 0);

  const twoRocketChoices = [];
  const twoRocketHarness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordBeginPlayCard: true,
    blueResources: { score: 80, credits: 3, energy: 0, publicity: 0 },
    blueHand: [makeSolarPanelCard()],
    movableTokens: [
      { id: 1, playerId: "player-blue", color: "blue", kind: "standard", surface: "solar", sector: { x: 1, y: 1 } },
      { id: 2, playerId: "player-blue", color: "blue", kind: "standard", surface: "solar", sector: { x: 2, y: 1 } },
    ],
    onChooseTurnAction: (candidates) => twoRocketChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });
  assert.equal(
    twoRocketHarness.controller.configureAiAutoBattle({
      playerIds: [twoRocketHarness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  const twoRocketResult = twoRocketHarness.controller.runAiAutomationStep();
  assert.equal(twoRocketResult.ok, true, "two-rocket solar panel play should remain available");
  const twoRocketPlay = twoRocketChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  assert.equal(twoRocketPlay?.cardId, "dlc_27.png");
  const twoRocketCard = twoRocketPlay?.playableCards?.[0] || twoRocketPlay;
  assert.ok(
    Number(twoRocketCard?.valueBreakdown?.effectValue || 0) > 0,
    "two-rocket solar panel should value the actual energy gain",
  );

  const fossilTokenChoices = [];
  const fossilTokenHarness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordBeginPlayCard: true,
    blueResources: { score: 80, credits: 3, energy: 0, publicity: 0 },
    blueHand: [makeSolarPanelCard()],
    movableTokens: [
      { id: 1, playerId: "player-blue", color: "blue", kind: "chong-fossil", surface: "solar", sector: { x: 1, y: 1 } },
      { id: 2, playerId: "player-blue", color: "blue", kind: "chong-fossil", surface: "solar", movementLocked: true, sector: { x: 2, y: 1 } },
    ],
    onChooseTurnAction: (candidates) => fossilTokenChoices.push(candidates),
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
  });
  assert.equal(
    fossilTokenHarness.controller.configureAiAutoBattle({
      playerIds: [fossilTokenHarness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  const fossilTokenResult = fossilTokenHarness.controller.runAiAutomationStep();
  assert.equal(fossilTokenResult.ok, true, "transported fossil should make solar panel playable");
  const fossilTokenPlay = fossilTokenChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  assert.equal(fossilTokenPlay?.cardId, "dlc_27.png");
  const fossilTokenCard = fossilTokenPlay?.playableCards?.[0] || fossilTokenPlay;
  assert.ok(
    Number(fossilTokenCard?.valueBreakdown?.effectValue || 0) > 0,
    "solar panel should value an unlocked transported Chong fossil as one rocket",
  );
}

{
  const turnChoices = [];
  const selectedActions = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 1,
    canStartMainAction: true,
    canPayForMove: true,
    realisticCanAfford: true,
    blueResources: { score: 12, credits: 4, energy: 2, publicity: 3, handSize: 0 },
    planetLocations: [{ planetId: "earth", x: 3, y: 1 }],
    findAvailableSlotIndex: () => 0,
    actionChecks: {
      launch: { ok: true },
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
  harness.controller.runAiAutomationStep();
  const candidates = turnChoices.flat();
  const launchCandidate = candidates.find((candidate) => candidate.id === "launch");
  const passCandidate = candidates.find((candidate) => candidate.id === "pass");
  assert.ok(launchCandidate, "weak launch route scenario should expose launch candidate");
  assert.ok(passCandidate, "weak launch route scenario should expose pass candidate");
  assert.ok(
    Number(launchCandidate.valueBreakdown?.weakEarlyPostLaunchRoutePenalty || 0) > 0,
    "weak post-launch route should be penalized before selecting launch",
  );
  assert.ok(
    Number(launchCandidate.score || 0) < Number(passCandidate.score || 0),
    "weak post-launch route should not beat pass on early launch base value alone",
  );
  assert.notEqual(selectedActions[0]?.id, "launch");
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingCardTriggerAction: {
      matches: [
        {
          card: { id: "unsupported-test", cardName: "unsupported" },
          trigger: { id: "unsupported-trigger" },
          effect: { type: "unsupported_trigger_effect", label: "无法自动处理的触发" },
        },
        {
          card: { id: "runezu-2", cardName: "符文族2" },
          trigger: { id: "runezu2-orbit-land-s4" },
          effect: {
            type: runezu.EFFECT_TYPES.SYMBOL_REWARD,
            label: "符文族任务：符文4奖励",
            options: { symbolId: "symbol_4" },
          },
        },
      ],
    },
    recordCardTriggerChoice: true,
    recordCancelCardTriggerChoice: true,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "Runezu symbol card trigger should be selectable by AI");
  assert.deepEqual(harness.getHandled(), { type: "card-trigger", choiceIndex: 1 });
}

{
  const harness = createAiControllerHarness("blue", { currentPlayerDiscardPending: true });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "color-owned Jiuzhe pending should be handled before current-player subflows");
  assert.deepEqual(harness.getHandled(), { type: "skip", automated: true });
}

{
  const harness = createAiControllerHarness("white");
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.blocked, true, "human-owned Jiuzhe pending should not be handled by AI");
  assert.equal(harness.getHandled(), null);
}

{
  const getCompletionFactor = (roundNumber, definition, progress, options = {}) => {
    const harness = createAiControllerHarness(null, { roundNumber });
    return harness.controller.estimateAiJiuzheCardCompletionFactor(
      definition,
      harness.blue,
      {},
      { progress, ...options },
    );
  };
  const techDefinition = jiuzhe.CARD_BY_INDEX[3];
  const missingThreeTech = {
    condition: techDefinition.condition,
    current: 0,
    target: 3,
    remaining: 3,
    met: false,
  };
  const blackSectorDefinition = jiuzhe.CARD_BY_INDEX[6];
  const missingTwoBlackSectors = {
    condition: blackSectorDefinition.condition,
    current: 0,
    target: 2,
    remaining: 2,
    met: false,
  };

  assert.equal(
    getCompletionFactor(1, techDefinition, missingThreeTech),
    0.32,
    "round-one missing-three tech should use the measured progress table",
  );
  assert.equal(
    getCompletionFactor(2, techDefinition, missingThreeTech),
    0.22,
    "round-two missing-three tech should not assume three future research actions",
  );
  assert.equal(
    getCompletionFactor(3, techDefinition, missingThreeTech),
    0.09,
    "round-three missing-three tech should retain the shared completion table",
  );
  assert.ok(
    Math.abs(getCompletionFactor(2, techDefinition, missingThreeTech, { paid: true }) - 0.154) < 1e-9,
    "the paid multiplier should apply after the measured round-two factor",
  );
  assert.equal(
    getCompletionFactor(2, blackSectorDefinition, missingTwoBlackSectors),
    0.42,
    "non-tech missing-two conditions should retain their existing round-two factor",
  );
}

{
  const jiuzheState = jiuzhe.createJiuzheState();
  jiuzheState.revealedSlotId = 1;
  jiuzheState.revealInitialized = true;
  jiuzheState.playerThreatById["player-white"] = 20;
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    blueResources: { score: 95, credits: 5 },
    alienGameState: {
      aliens: {
        1: { revealed: true, alienId: jiuzhe.ALIEN_ID, assignedAlienId: jiuzhe.ALIEN_ID },
      },
      jiuzhe: jiuzheState,
    },
    pendingJiuzheCardPlay: {
      playerId: "player-blue",
      reason: "freeThreshold",
      cost: {},
      label: "Jiuzhe controllable-tech ordering",
    },
    scanTargetButtons: [
      makeButton({ jiuzheCardChoice: "3" }, "拥有3个紫色科技"),
      makeButton({ jiuzheCardChoice: "6" }, "完成2个黑色扇区"),
    ],
    useDefaultAlienUsePolicy: true,
    aiValuation: setiAi.valuation,
  });
  assert.equal(harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  assert.equal(harness.controller.runAiAutomationStep().ok, true);
  const useLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "alien-use" && entry.details?.pendingType === "jiuzhe-card");
  const techScore = Number(useLog?.details?.options?.find((option) => option.choice === "3")?.score);
  const blackSectorScore = Number(useLog?.details?.options?.find((option) => option.choice === "6")?.score);
  assert.equal(techScore, 12.26, "round-two missing-three tech should retain its measured completion factor");
  assert.equal(blackSectorScore, 17.936, "black-sector missing-two valuation should remain unchanged");
  assert.ok(techScore < blackSectorScore, "three missing techs should not outrank a condition only two steps away");
  assert.deepEqual(
    harness.getHandled(),
    { type: "card", choice: "6", automated: true },
    "round-two Jiuzhe planning should prefer the closer black-sector condition",
  );
}

{
  const getJiuzheCardOptionScore = (cost) => {
    const jiuzheState = jiuzhe.createJiuzheState();
    jiuzheState.revealedSlotId = 1;
    jiuzheState.revealInitialized = true;
    jiuzheState.playerThreatById["player-blue"] = 6;
    const harness = createAiControllerHarness(null, {
      currentPlayerColor: "blue",
      roundNumber: 3,
      blueResources: { score: 95, credits: 5 },
      alienGameState: {
        aliens: {
          1: { revealed: true, alienId: jiuzhe.ALIEN_ID, assignedAlienId: jiuzhe.ALIEN_ID },
        },
        jiuzhe: jiuzheState,
      },
      pendingJiuzheCardPlay: {
        playerId: "player-blue",
        reason: Object.keys(cost).length ? "paidThreshold" : "freeThreshold",
        cost,
        label: "Jiuzhe opportunity cost test",
      },
      scanTargetButtons: [
        makeButton({ jiuzheCardChoice: "1" }, "九折牌 1"),
      ],
      aiValuation: setiAi.valuation,
    });
    assert.equal(
      harness.controller.configureAiAutoBattle({
        playerIds: [harness.blue.id],
        suppressAutoSchedule: true,
      }).ok,
      true,
    );
    assert.equal(harness.controller.runAiAutomationStep().ok, true);
    const useLog = harness.controller.getAiAutoBattleReport().logs
      .find((entry) => entry.type === "alien-use" && entry.details?.pendingType === "jiuzhe-card");
    return Number(useLog?.details?.options?.find((option) => option.choice === "1")?.score);
  };

  const freeScore = getJiuzheCardOptionScore({});
  const paidScore = getJiuzheCardOptionScore({ credits: 1 });
  const paidTwoCreditsScore = getJiuzheCardOptionScore({ credits: 2 });
  assert.ok(
    freeScore - paidScore > 4.5,
    "a late paid speculative Jiuzhe card must include both the credit and lower conversion probability",
  );
  assert.ok(
    paidScore - paidTwoCreditsScore > 3,
    "otherwise identical paid Jiuzhe options must preserve the marginal cost of the second credit",
  );
}

{
  const makeJiuzheProgressState = (traceCount) => {
    const state = jiuzhe.createJiuzheState();
    state.revealedSlotId = 1;
    state.revealInitialized = true;
    state.playerThreatById["player-blue"] = 6;
    const alienGameState = {
      aliens: {
        1: { revealed: true, alienId: jiuzhe.ALIEN_ID, assignedAlienId: jiuzhe.ALIEN_ID },
      },
      jiuzhe: state,
    };
    const player = { id: "player-blue", color: "blue", colorLabel: "Blue" };
    for (let position = 1; position <= traceCount; position += 1) {
      assert.equal(jiuzhe.placeJiuzheTrace(alienGameState, 1, "pink", position, player).ok, true);
    }
    return alienGameState;
  };

  const freeHarness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { score: 95, credits: 5 },
    blueCompletedTaskCount: 3,
    alienGameState: makeJiuzheProgressState(5),
    pendingJiuzheCardPlay: {
      playerId: "player-blue",
      reason: "freeThreshold",
      cost: {},
      label: "Jiuzhe progress choice",
    },
    scanTargetButtons: [
      makeButton({ jiuzheCardChoice: "0" }, "九折有6个痕迹"),
      makeButton({ jiuzheCardChoice: "13" }, "完成5张任务牌"),
    ],
    useDefaultAlienUsePolicy: true,
    aiValuation: setiAi.valuation,
  });
  freeHarness.blue.completedTaskCount = 3;
  assert.equal(freeHarness.controller.configureAiAutoBattle({
    playerIds: [freeHarness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  assert.equal(freeHarness.controller.runAiAutomationStep().ok, true);
  assert.deepEqual(
    freeHarness.getHandled(),
    { type: "card", choice: "0", automated: true },
    "round-three Jiuzhe planning should prefer a one-step condition over a two-task headline score",
  );

  const plutoHarness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { score: 95, credits: 5 },
    alienGameState: makeJiuzheProgressState(0),
    actionContext: {
      plutoMarkers: [
        { kind: "orbit", planetId: "pluto", playerId: "player-blue" },
        { kind: "land", planetId: "pluto", playerId: "player-blue", sequence: 1 },
        { kind: "land", planetId: "pluto", playerId: "player-blue", sequence: 2 },
      ],
    },
    pendingJiuzheCardPlay: {
      playerId: "player-blue",
      reason: "freeThreshold",
      cost: {},
      label: "Jiuzhe Pluto progress choice",
    },
    scanTargetButtons: [
      makeButton({ jiuzheCardChoice: "1" }, "同一星球3个环绕或登陆"),
      makeButton({ jiuzheCardChoice: "13" }, "完成5张任务牌"),
    ],
    useDefaultAlienUsePolicy: true,
    aiValuation: setiAi.valuation,
  });
  plutoHarness.blue.completedTaskCount = 4;
  assert.equal(plutoHarness.controller.configureAiAutoBattle({
    playerIds: [plutoHarness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  assert.equal(plutoHarness.controller.runAiAutomationStep().ok, true);
  assert.deepEqual(
    plutoHarness.getHandled(),
    { type: "card", choice: "1", automated: true },
    "AI Jiuzhe planning should consume shared Pluto-aware same-planet progress",
  );

  const paidHarness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    blueResources: { score: 95, credits: 5 },
    alienGameState: makeJiuzheProgressState(4),
    pendingJiuzheCardPlay: {
      playerId: "player-blue",
      reason: "paidThreshold",
      cost: { credits: 1 },
      label: "Jiuzhe paid progress choice",
    },
    scanTargetButtons: [
      makeButton({ jiuzheCardChoice: "8" }, "拥有5个相同颜色外星人痕迹"),
      makeButton({ jiuzheOpportunitySkip: "true" }, "放弃本次机会"),
    ],
    useDefaultAlienUsePolicy: true,
    aiValuation: setiAi.valuation,
  });
  assert.equal(paidHarness.controller.configureAiAutoBattle({
    playerIds: [paidHarness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  assert.equal(paidHarness.controller.runAiAutomationStep().ok, true);
  const paidUseLog = paidHarness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "alien-use" && entry.details?.pendingType === "jiuzhe-card");
  assert.ok(
    paidUseLog?.details?.options?.some((option) => option.choice === "skip"),
    `paid Jiuzhe options should include skip: ${JSON.stringify(paidUseLog?.details?.options)}`,
  );
  const paidCardScore = Number(paidUseLog?.details?.options?.find((option) => option.choice === "8")?.score);
  assert.ok(paidCardScore < 0, `late speculative Jiuzhe card should be net negative, got ${paidCardScore}`);
  assert.deepEqual(
    paidHarness.getHandled(),
    { type: "skip", automated: true },
    "round-three paid Jiuzhe planning should skip an incomplete one-trace condition when its expected value is below cost",
  );
}

{
  const differentPlanetTaskCard = {
    id: "card-dlc7",
    cardId: "dlc_7.png",
    model: {
      tasks: [{
        id: "dlc7-two-planet-probes",
        condition: { type: "probesOnDifferentPlanets", count: 2, excludePlanetIds: ["earth"] },
        rewards: [{ type: "gain_resources", options: { gain: { credits: 2 } } }],
      }],
    },
    cardEffectState: { completedTaskIds: [] },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    blueReservedCards: [differentPlanetTaskCard],
    movableTokens: [
      { id: 1, playerId: "player-blue", color: "blue", kind: "standard", surface: "solar", sector: { x: 2, y: 1 } },
    ],
    planetLocations: [
      { planetId: "earth", x: 1, y: 1 },
      { planetId: "mars", x: 2, y: 1 },
    ],
  });
  harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });

  const blueResult = harness.controller.getAiAutoBattleReport().playerResults
    .find((player) => player.playerId === harness.blue.id);
  const taskProgress = blueResult.reservedCards[0].tasks[0].condition;
  assert.equal(taskProgress.currentCount, 1);
  assert.equal(taskProgress.missingCount, 1);
  assert.equal(taskProgress.met, false);
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetPending: {
      type: "pay_credit_reward",
      playerColor: "blue",
      effect: {
        id: "pay-credit-test",
        options: { reward: { type: "gain_resources", options: { gain: { score: 2, publicity: 2 } } } },
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
  assert.equal(result.ok, true, "AI-owned pay-credit pending should resolve even when current player is human");
  assert.deepEqual(harness.getHandled(), { type: "pay-credit", choice: "pay" });
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetPending: {
      type: "pay_credit_reward",
      playerColor: "white",
      effect: {
        id: "human-pay-credit-test",
        options: { reward: { type: "gain_resources", options: { gain: { score: 2, publicity: 2 } } } },
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
  assert.equal(result.blocked, true, "human-owned rare pending should wait for the human player");
  assert.equal(harness.getHandled(), null);
}

{
  const harness = createAiControllerHarness(null, {
    blueHand: [
      { id: "income-card", incomeGain: { credits: 1 } },
      { id: "blank-card" },
    ],
    scanTargetPending: {
      type: "discard_any_income",
      playerColor: "blue",
      effect: { id: "discard-income-test" },
      selectedCardIds: [],
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
  assert.equal(result.ok, true, "AI-owned discard-income pending should confirm safely");
  assert.equal(harness.getHandled().type, "discard-income-confirm");
}

{
  const pendingCardSelectionAction = { type: "industry_mission_pick", player: null };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    cardSelectionActive: true,
    recordPublicPick: true,
    pendingCardSelectionAction,
    blueResources: { credits: 0, energy: 0, publicity: 0, availableData: 0, handSize: 1, score: 96 },
    publicCards: [
      { id: "mission-hand-income", incomeGain: { handSize: 1 } },
      { id: "mission-credit-income", incomeGain: { credits: 1 } },
    ],
  });
  pendingCardSelectionAction.player = harness.blue;
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve the mission income public-card pick");
  assert.deepEqual(
    harness.getHandled(),
    { type: "public-pick", slotIndex: 1 },
    "mission pick should value the immediate credit reward, not a permanent income projection",
  );
}

{
  const pendingDiscardAction = { type: "initial_income", selectedIndexes: [] };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingDiscardAction,
    discardCount: 4,
    blueResources: { credits: 2, energy: 1, handSize: 6, score: 0 },
    blueIncome: { credits: 2, energy: 1, handSize: 1 },
    blueHand: [
      { id: "credit-income-1", incomeGain: { credits: 1 } },
      { id: "credit-income-2", incomeGain: { credits: 1 } },
      { id: "credit-income-3", incomeGain: { credits: 1 } },
      { id: "credit-income-4", incomeGain: { credits: 1 } },
      { id: "energy-income", incomeGain: { energy: 1 } },
      { id: "hand-income", incomeGain: { handSize: 1 } },
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
  assert.equal(result.ok, true, "AI should resolve multi-income discard selection");
  const selectedGains = pendingDiscardAction.selectedIndexes
    .map((index) => harness.blue.hand[index]?.incomeGain || {});
  assert.equal(
    selectedGains.some((gain) => Number(gain.energy || 0) > 0),
    true,
    "multi-income selection should include energy after simulating earlier credit gains",
  );
  assert.equal(
    selectedGains.some((gain) => Number(gain.handSize || 0) > 0),
    true,
    "multi-income selection should include hand income after simulating earlier gains",
  );
  assert.ok(
    selectedGains.filter((gain) => Number(gain.credits || 0) > 0).length <= 2,
    "multi-income selection should not spend all four choices on credit income",
  );
}

{
  const pendingDiscardAction = { type: "initial_income", selectedIndexes: [] };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    pendingDiscardAction,
    discardCount: 1,
    blueResources: { credits: 0, energy: 5, handSize: 6, score: 52 },
    blueIncome: { credits: 2, energy: 1, handSize: 1 },
    blueCompanyBaseIncome: { credits: 2, energy: 1, handSize: 1 },
    blueHand: [
      { id: "credit-after-base", incomeGain: { credits: 1 } },
      { id: "hand-after-base", incomeGain: { handSize: 1 } },
    ],
    finalScoringState: {
      tiles: {
        a: {
          id: "a",
          marks: [{ playerId: "player-blue", slotIndex: 1, threshold: 50 }],
        },
      },
    },
    finalTileVariants: { a: 2 },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should resolve income discard with company base income excluded from final scoring");
  const [selectedIndex] = pendingDiscardAction.selectedIndexes;
  assert.equal(
    harness.blue.hand[selectedIndex]?.id,
    "credit-after-base",
    "a2 income-final fit should use income increases, not company base income",
  );
}

{
  const pendingDiscardAction = { type: "initial_income", selectedIndexes: [] };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    pendingDiscardAction,
    discardCount: 2,
    blueResources: { credits: 1, energy: 2, handSize: 1, score: 18 },
    blueIncome: { credits: 5, energy: 3, handSize: 2 },
    blueHand: [
      { id: "credit-income-surplus-1", incomeGain: { credits: 1 } },
      { id: "credit-income-surplus-2", incomeGain: { credits: 1 } },
      { id: "hand-income-engine", incomeGain: { handSize: 1 } },
      { id: "task-engine-card", model: { tasks: [{ id: "task-a", rewards: [{ type: "gain_resources", options: { gain: { score: 6 } } }] }] } },
      { id: "tech-engine-card", playEffects: [{ type: "card_research_tech", options: { techTypes: ["orange"] } }] },
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
  assert.equal(result.ok, true, "AI should resolve engine-aware income discard selection");
  const selectedGains = pendingDiscardAction.selectedIndexes
    .map((index) => harness.blue.hand[index]?.incomeGain || {});
  assert.equal(
    selectedGains.some((gain) => Number(gain.handSize || 0) > 0),
    true,
    "hand income should stay valuable at income 2 when a task/card engine needs fuel",
  );
  assert.ok(
    selectedGains.filter((gain) => Number(gain.credits || 0) > 0).length <= 1,
    "engine backlog should not spend both choices on surplus credit income",
  );
}

{
  const pendingDiscardAction = { type: "place_data_income", selectedIndexes: [] };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    pendingDiscardAction,
    discardCount: 1,
    blueResources: { credits: 0, energy: 2, handSize: 2, score: 52 },
    blueHand: [
      { id: "income-low-future-value", incomeGain: { handSize: 1 }, price: 1 },
      {
        id: "income-high-future-value",
        incomeGain: { handSize: 1 },
        price: 1,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 16 } } }],
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
  assert.equal(result.ok, true, "AI should resolve place-data income discard selection");
  assert.equal(
    harness.blue.hand[pendingDiscardAction.selectedIndexes[0]]?.id,
    "income-low-future-value",
    "income discard should preserve the higher future-value card",
  );
  const discardLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "discard" && entry.details?.pendingType === "place_data_income");
  const preview = discardLog?.details?.incomeDiscardPreview?.options || [];
  const low = preview.find((entry) => entry.cardId === "income-low-future-value");
  const high = preview.find((entry) => entry.cardId === "income-high-future-value");
  assert.ok(low && high, "income discard preview should include both cards");
  assert.ok(
    Number(low.netAfterDiscard || 0) > Number(high.netAfterDiscard || 0),
    "income preview should use the same future-card opportunity cost as the selected discard",
  );
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetPending: {
      type: "remove_orbit_to_probe",
      playerColor: "blue",
      effect: { id: "remove-orbit-test" },
      choices: [{ id: "mars:1" }],
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
  assert.equal(result.ok, true, "AI-owned remove-orbit pending should pick a legal choice");
  assert.deepEqual(harness.getHandled(), { type: "remove-orbit-to-probe", choiceId: "mars:1" });
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetPending: {
      type: "return_unfinished_task",
      playerColor: "blue",
      effect: { id: "return-task-test" },
      choices: [{ id: "task-expensive", price: 4 }, { id: "task-cheap", price: 1 }],
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
  assert.equal(result.ok, true, "AI-owned return-task pending should pick a legal task");
  assert.deepEqual(harness.getHandled(), { type: "return-task", cardId: "task-cheap" });
}

{
  const harness = createAiControllerHarness(null, {
    probeSectorPending: {
      playerColor: "blue",
      effect: { id: "probe-sector-test", options: { maxTargets: 2 } },
      choices: [
        { rocket: { id: 1 }, sector: { x: 2, y: 3 } },
        { rocket: { id: 2 }, sector: { x: 4, y: 3 } },
      ],
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
  assert.equal(result.ok, true, "AI-owned probe-sector pending should select legal rockets and confirm");
  assert.deepEqual(harness.getHandledEvents().map((event) => event.type), [
    "probe-sector-choice",
    "probe-sector-choice",
    "probe-sector-confirm",
  ]);
}

{
  const harness = createAiControllerHarness(null, {
    probeLocationPending: {
      playerColor: "blue",
      effect: { id: "probe-location-test" },
      choices: [{ rocket: { id: 1 } }, { rocket: { id: 2 } }],
    },
    scanTargetButtons: [
      makeButton({ probeLocationRewardRocketId: "1" }, "R1 0 数据"),
      makeButton({ probeLocationRewardRocketId: "2" }, "R2 3 数据"),
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
  assert.equal(result.ok, true, "AI-owned probe-location pending should select the best legal rocket");
  assert.deepEqual(harness.getHandled(), { type: "probe-location", rocketId: 2 });
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetHidden: true,
    scanTargetPending: {
      type: "public_scan",
      playerColor: "blue",
      choices: [
        { nebulaId: "low-nebula", sectorX: 2, label: "Low nebula" },
        { nebulaId: "high-nebula", sectorX: 4, label: "High nebula" },
      ],
    },
    data: {
      getNextReplaceableNebulaToken: (_state, nebulaId) => ({
        slotIndex: nebulaId === "high-nebula" ? 3 : 1,
      }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [{}, {}],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
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
  assert.equal(result.ok, true, "AI should resolve hidden-overlay scan pending from choices");
  assert.deepEqual(harness.getHandled(), {
    type: "scan-target",
    nebulaId: "high-nebula",
    sectorX: 4,
  });
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetHidden: true,
    scanTargetPending: {
      type: "sector_scan",
      playerColor: "blue",
      choices: [{ nebulaId: "full-nebula", sectorX: 6, label: "Full nebula" }],
    },
    data: {
      getNextReplaceableNebulaToken: () => null,
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: () => 0,
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [
        { replacedByPlayerId: "player-white", replacedByPlayerColor: "white" },
        { replacedByPlayerId: "player-white", replacedByPlayerColor: "white" },
        { replacedByPlayerId: "player-blue", replacedByPlayerColor: "blue" },
      ],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({
        white: { playerId: "player-white", playerColor: "white", count: 2 },
        blue: { playerId: "player-blue", playerColor: "blue", count: 1 },
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
  assert.equal(result.ok, true, "a full sector should remain a legal AI scan target for an extra mark");
  assert.deepEqual(harness.getHandled(), {
    type: "scan-target",
    nebulaId: "full-nebula",
    sectorX: 6,
  });
}

{
  const makeOwnedToken = (color) => ({
    replacedByPlayerId: `player-${color}`,
    replacedByPlayerColor: color,
  });
  const buildFullSectorHarness = ({ tokens, ranking, stats, nebulaId = "full-score-sector", b2 = false }) => (
    createAiControllerHarness(null, {
      currentPlayerColor: "blue",
      roundNumber: 4,
      ...(b2 ? {
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
          countSectorWins: () => 3,
          countOrbitOrLandMarkers: () => 4,
        },
      } : {}),
      data: {
        getNextReplaceableNebulaToken: () => null,
        getNebulaCapacity: () => tokens.length,
        getNebulaSlotScoreReward: () => 0,
        getNebulaColor: () => "blue",
        listNebulaTokens: () => tokens,
        listSectorExtraMarks: () => [],
        getSectorTokenStats: () => stats,
        getSectorRanking: () => ranking,
      },
    })
  );

  const alreadyWinning = buildFullSectorHarness({
    tokens: [makeOwnedToken("blue"), makeOwnedToken("blue"), makeOwnedToken("white")],
    stats: {
      blue: { playerId: "player-blue", playerColor: "blue", count: 2 },
      white: { playerId: "player-white", playerColor: "white", count: 1 },
    },
    ranking: [
      { playerId: "player-blue", playerColor: "blue", count: 2 },
      { playerId: "player-white", playerColor: "white", count: 1 },
    ],
    b2: true,
  });
  const alreadyWinningScore = alreadyWinning.controller.scoreAiNebulaScanChoice(
    { nebulaId: "full-score-sector" },
    { player: alreadyWinning.blue, pendingType: "sector_scan" },
  );
  assert.equal(alreadyWinningScore, -3, "a redundant full-sector mark should carry a measured no-op penalty");

  const stillLosing = buildFullSectorHarness({
    tokens: [makeOwnedToken("white"), makeOwnedToken("white"), makeOwnedToken("white")],
    stats: {
      white: { playerId: "player-white", playerColor: "white", count: 3 },
    },
    ranking: [{ playerId: "player-white", playerColor: "white", count: 3 }],
    b2: true,
  });
  const stillLosingScore = stillLosing.controller.scoreAiNebulaScanChoice(
    { nebulaId: "full-score-sector" },
    { player: stillLosing.blue, pendingType: "sector_scan" },
  );
  assert.equal(stillLosingScore, -2, "a full-sector mark that remains behind should have a finite low score");

  const tieFlip = buildFullSectorHarness({
    tokens: [makeOwnedToken("white"), makeOwnedToken("white"), makeOwnedToken("blue")],
    stats: {
      white: { playerId: "player-white", playerColor: "white", count: 2 },
      blue: { playerId: "player-blue", playerColor: "blue", count: 1 },
    },
    ranking: [
      { playerId: "player-white", playerColor: "white", count: 2 },
      { playerId: "player-blue", playerColor: "blue", count: 1 },
    ],
    b2: true,
  });
  const tieFlipScore = tieFlip.controller.scoreAiNebulaScanChoice(
    { nebulaId: "full-score-sector" },
    { player: tieFlip.blue, pendingType: "sector_scan" },
  );
  assert.equal(tieFlipScore, 8, "a marked-B2 full-sector tie flip should be bounded by the eight-point cap");
  assert.ok(tieFlipScore > stillLosingScore && stillLosingScore > alreadyWinningScore);

  const aomomoAlready = buildFullSectorHarness({
    nebulaId: aomomo.NEBULA_ID,
    tokens: [makeOwnedToken("blue"), makeOwnedToken("white"), makeOwnedToken("white")],
    stats: {
      blue: { playerId: "player-blue", playerColor: "blue", count: 1 },
      white: { playerId: "player-white", playerColor: "white", count: 2 },
    },
    ranking: [],
  });
  const aomomoAlreadyScore = aomomoAlready.controller.scoreAiNebulaScanChoice(
    { nebulaId: aomomo.NEBULA_ID },
    { player: aomomoAlready.blue, pendingType: "sector_scan" },
  );
  const aomomoNew = buildFullSectorHarness({
    nebulaId: aomomo.NEBULA_ID,
    tokens: [makeOwnedToken("white"), makeOwnedToken("white"), makeOwnedToken("white")],
    stats: {
      white: { playerId: "player-white", playerColor: "white", count: 3 },
    },
    ranking: [],
  });
  const aomomoNewScore = aomomoNew.controller.scoreAiNebulaScanChoice(
    { nebulaId: aomomo.NEBULA_ID },
    { player: aomomoNew.blue, pendingType: "sector_scan" },
  );
  assert.equal(aomomoAlreadyScore, -3, "an existing Aomomo participant should penalize a no-op repeat scan");
  assert.ok(
    aomomoNewScore > aomomoAlreadyScore && aomomoNewScore <= 6,
    "a new Aomomo participant should receive only the bounded actual fossil value",
  );
}

{
  const tokensByNebula = {
    "full-owned": [
      { replacedByPlayerId: "player-blue", replacedByPlayerColor: "blue" },
      { replacedByPlayerId: "player-blue", replacedByPlayerColor: "blue" },
      { replacedByPlayerId: "player-white", replacedByPlayerColor: "white" },
    ],
    "productive-open": [
      { replacedByPlayerId: "player-white", replacedByPlayerColor: "white" },
      {},
      {},
    ],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    scanTargetHidden: true,
    scanTargetPending: {
      type: "sector_scan",
      playerColor: "blue",
      choices: [
        { nebulaId: "full-owned", sectorX: 1, label: "Redundant full sector" },
        { nebulaId: "productive-open", sectorX: 2, label: "Productive open sector" },
      ],
    },
    data: {
      getNextReplaceableNebulaToken: (_state, nebulaId) => (
        nebulaId === "full-owned" ? null : { slotIndex: 2 }
      ),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: () => 1,
      getNebulaColor: () => "blue",
      listNebulaTokens: (_state, nebulaId) => tokensByNebula[nebulaId] || [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: (_state, nebulaId) => (
        nebulaId === "full-owned"
          ? {
            blue: { playerId: "player-blue", playerColor: "blue", count: 2 },
            white: { playerId: "player-white", playerColor: "white", count: 1 },
          }
          : { white: { playerId: "player-white", playerColor: "white", count: 1 } }
      ),
      getSectorRanking: () => [
        { playerId: "player-blue", playerColor: "blue", count: 2 },
        { playerId: "player-white", playerColor: "white", count: 1 },
      ],
    },
  });
  assert.equal(harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "the AI should resolve a mixed full/open sector choice");
  assert.deepEqual(harness.getHandled(), {
    type: "scan-target",
    nebulaId: "productive-open",
    sectorX: 2,
  }, "a productive open scan should outrank a redundant full-sector mark");
}

{
  const tokensByNebula = {
    "strictly-lost": [
      { replacedByPlayerId: "player-white", replacedByPlayerColor: "white" },
      { replacedByPlayerId: "player-white", replacedByPlayerColor: "white" },
      { replacedByPlayerId: "player-white", replacedByPlayerColor: "white" },
      {},
      {},
    ],
    "tie-recoverable": [
      { replacedByPlayerId: "player-white", replacedByPlayerColor: "white" },
      { replacedByPlayerId: "player-white", replacedByPlayerColor: "white" },
      {},
      {},
    ],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    scanTargetHidden: true,
    scanTargetPending: {
      type: "sector_scan",
      playerColor: "blue",
      choices: [
        { nebulaId: "strictly-lost", sectorX: 4, label: "Strictly lost" },
        { nebulaId: "tie-recoverable", sectorX: 5, label: "Tie recoverable" },
      ],
    },
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
      countSectorWins: () => 0,
      countOrbitOrLandMarkers: () => 4,
    },
    data: {
      getNextReplaceableNebulaToken: () => ({ slotIndex: 1 }),
      getNebulaCapacity: (nebulaId) => tokensByNebula[nebulaId]?.length || 0,
      getNebulaSlotScoreReward: () => 0,
      getNebulaColor: () => "blue",
      listNebulaTokens: (_state, nebulaId) => tokensByNebula[nebulaId] || [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: (_state, nebulaId) => ({
        white: {
          playerId: "player-white",
          playerColor: "white",
          count: nebulaId === "strictly-lost" ? 3 : 2,
        },
      }),
    },
  });
  assert.equal(harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "the AI should resolve a final B2 race choice");
  assert.deepEqual(harness.getHandled(), {
    type: "scan-target",
    nebulaId: "tie-recoverable",
    sectorX: 5,
  }, "a recoverable tie route should outrank a strictly lost B2 race");
  const log = harness.controller.getAiAutoBattleReport().logs
    .findLast((entry) => entry.type === "scan-target");
  const lostSummary = log?.details?.topChoices?.find((entry) => entry.nebulaId === "strictly-lost");
  const recoverableSummary = log?.details?.topChoices?.find((entry) => entry.nebulaId === "tie-recoverable");
  assert.equal(lostSummary?.b2?.raceLost, true, "strictly lost B2 alternatives should remain diagnosed as lost");
  assert.equal(recoverableSummary?.b2?.raceLost, false, "latest-placement tie routes must remain recoverable");
}

{
  const harness = createAiControllerHarness(null, {
    scanTargetHidden: true,
    scanTargetPending: {
      type: "public_scan",
      playerColor: "blue",
      card: { id: "scan-card", cardName: "Scan card" },
    },
    getPublicScanChoicesForCard: () => ({
      ok: true,
      choices: [
        { nebulaId: "low-nebula", sectorX: 2, label: "Low nebula" },
        { nebulaId: "high-nebula", sectorX: 4, label: "High nebula" },
      ],
    }),
    data: {
      getNextReplaceableNebulaToken: (_state, nebulaId) => ({
        slotIndex: nebulaId === "high-nebula" ? 3 : 1,
      }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [{}, {}],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
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
  assert.equal(result.ok, true, "AI should recover public-scan target choices from the pending card");
  assert.deepEqual(harness.getHandled(), {
    type: "scan-target",
    nebulaId: "high-nebula",
    sectorX: 4,
  });
}

{
  const harness = createAiControllerHarness(null, {
    landTargetPending: {
      playerColor: "blue",
      getOptions: () => ({ ok: false, message: "skip scoring in harness" }),
    },
    landTargetSelectOptions: [{}, {}],
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned land-target pending should resolve while current player is human");
  assert.deepEqual(harness.getHandled(), { type: "land-target", selectedIndex: 0 });
}

{
  const harness = createAiControllerHarness(null, {
    dataPlacePending: {
      playerColor: "blue",
      effect: { id: "data-place-test" },
    },
    dataPlaceButtons: [
      makeButton({ placeTarget: "computer" }, "放置位 2"),
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
  assert.equal(result.ok, true, "AI-owned data placement should resolve while current player is human");
  assert.deepEqual(harness.getHandled(), { type: "data-placement", target: "computer", blueSlot: null });
}

{
  const pendingMovePayment = {
    player: null,
    rocketId: 7,
    deltaX: 1,
    deltaY: 0,
    requiredMovePoints: 1,
    selectedHandIndices: [],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "white",
    pendingMovePayment,
    rocketState: {
      rockets: [{ id: 7, playerId: "player-blue", sector: { x: 2, y: 2 } }],
    },
  });
  pendingMovePayment.player = harness.blue;
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI-owned move payment should resolve while current interface player is human");
  assert.deepEqual(harness.getHandled(), {
    type: "move-payment",
    automated: true,
    playerId: harness.blue.id,
    selectedHandIndices: [],
  });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerDiscardPending: true,
    readyBanrenmaPlayerColor: "blue",
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should open ready Banrenma panel marks before current-player subflows");
  assert.deepEqual(harness.getHandled(), {
    type: "banrenma-ready",
    playerColor: "blue",
    includeCards: false,
  });
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    readyBanrenmaPlayerColor: "blue",
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should open current player's ready Banrenma card conditions");
  assert.deepEqual(harness.getHandled(), {
    type: "banrenma-ready",
    playerColor: "blue",
    includeCards: true,
  });
}

{
  const alienGameState = makeBanrenmaAlienState();
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    blueResources: { score: 49, credits: 2, energy: 1, publicity: 0, availableData: 1, handSize: 1 },
    alienGameState,
    pendingBanrenmaOpportunity: {
      type: "panel",
      playerId: "player-blue",
      playerColor: "blue",
      markId: "banrenma-threshold-50",
    },
    scanTargetButtons: [1, 2, 3, 4].map((position) => makeButton(
      { banrenmaBonusChoice: String(position) },
      `${position}号奖励 ${banrenma.getBonusReward(position)?.label || ""}`,
    )),
    finalScoringState: {
      tiles: {
        first: { id: "first", marks: [{ playerId: "player-blue", threshold: 25, slotIndex: 1 }] },
      },
    },
    useDefaultAlienUsePolicy: true,
    recordBanrenmaChoices: true,
    aiValuation: setiAi.valuation,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "Banrenma top reward should be resolved by explicit option value");
  assert.deepEqual(harness.getHandled(), { type: "banrenma-bonus", choice: "1" });
  const useLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "alien-use" && entry.details?.pendingType === "banrenma-bonus");
  const scoredOptions = useLog?.details?.options || [];
  assert.deepEqual(scoredOptions.map((option) => option.choice), ["1", "2", "3", "4"]);
  assert.ok(
    scoredOptions.every((option) => Number.isFinite(Number(option.score))),
    "all four executable Banrenma rewards should receive explicit scores",
  );
  assert.ok(
    Number(scoredOptions.find((option) => option.choice === "1")?.score || 0)
      > Number(scoredOptions.find((option) => option.choice === "4")?.score || 0),
    "a trace with its own reward chain should beat raw score instead of assigning the whole final-mark cashout to option four",
  );
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    blueResources: { score: 42, credits: 2, energy: 1, publicity: 0, availableData: 1, handSize: 1 },
    alienGameState: makeBanrenmaAlienState(),
    pendingBanrenmaOpportunity: {
      type: "panel",
      playerId: "player-blue",
      playerColor: "blue",
      markId: "banrenma-threshold-50-eight-away",
    },
    scanTargetButtons: [1, 4].map((position) => makeButton(
      { banrenmaBonusChoice: String(position) },
      `${position}号奖励 ${banrenma.getBonusReward(position)?.label || ""}`,
    )),
    finalScoringState: {
      tiles: {
        first: { id: "first", marks: [{ playerId: "player-blue", threshold: 25, slotIndex: 1 }] },
      },
    },
    useDefaultAlienUsePolicy: true,
    recordBanrenmaChoices: true,
    aiValuation: setiAi.valuation,
  });
  assert.equal(harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true);
  assert.deepEqual(
    harness.getHandled(),
    { type: "banrenma-bonus", choice: "1" },
    "an eight-point reward must not receive the full final-mark value when all eight points are still needed",
  );
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    blueResources: { score: 63, credits: 2, energy: 1, publicity: 0, availableData: 1, handSize: 1 },
    alienGameState: makeBanrenmaAlienState(),
    pendingBanrenmaOpportunity: {
      type: "panel",
      playerId: "player-blue",
      playerColor: "blue",
      markId: "banrenma-threshold-70-crossing",
    },
    scanTargetButtons: [1, 4].map((position) => makeButton(
      { banrenmaBonusChoice: String(position) },
      `${position}号奖励 ${banrenma.getBonusReward(position)?.label || ""}`,
    )),
    finalScoringState: {
      tiles: {
        first: { id: "first", marks: [{ playerId: "player-blue", threshold: 25, slotIndex: 1 }] },
        second: { id: "second", marks: [{ playerId: "player-blue", threshold: 50, slotIndex: 1 }] },
      },
    },
    useDefaultAlienUsePolicy: true,
    recordBanrenmaChoices: true,
    aiValuation: setiAi.valuation,
  });
  assert.equal(harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  assert.equal(harness.controller.runAiAutomationStep().ok, true);
  assert.deepEqual(
    harness.getHandled(),
    { type: "banrenma-bonus", choice: "1" },
    "Banrenma option ranking should not count the shared final-mark reward as if the eight-point option owned it",
  );
}

{
  const getDisplayedBanrenmaRewardScore = (displayedCardIndex) => {
    const alienGameState = makeBanrenmaAlienState();
    alienGameState.banrenma.displayedCardIndex = displayedCardIndex;
    const harness = createAiControllerHarness(null, {
      currentPlayerColor: "blue",
      roundNumber: 2,
      blueResources: { score: 45, credits: 2, energy: 0, publicity: 2, availableData: 0, handSize: 2 },
      alienGameState,
      pendingBanrenmaOpportunity: {
        type: "panel",
        playerId: "player-blue",
        playerColor: "blue",
        markId: "banrenma-displayed-value",
      },
      scanTargetButtons: [makeButton(
        { banrenmaBonusChoice: "2" },
        `2号奖励 ${banrenma.getBonusReward(2)?.label || ""}`,
      )],
      useDefaultAlienUsePolicy: true,
      recordBanrenmaChoices: true,
      aiValuation: setiAi.valuation,
    });
    assert.equal(harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok, true);
    assert.equal(harness.controller.runAiAutomationStep().ok, true);
    const useLog = harness.controller.getAiAutoBattleReport().logs
      .find((entry) => entry.type === "alien-use" && entry.details?.pendingType === "banrenma-bonus");
    return Number(useLog?.details?.options?.find((option) => option.choice === "2")?.score);
  };

  const drawCardRewardScore = getDisplayedBanrenmaRewardScore(0);
  const freeTechRewardScore = getDisplayedBanrenmaRewardScore(3);
  const unknownDisplayedRewardScore = getDisplayedBanrenmaRewardScore(null);
  const invalidDisplayedRewardScore = getDisplayedBanrenmaRewardScore(99);
  assert.ok(Number.isFinite(drawCardRewardScore) && Number.isFinite(freeTechRewardScore));
  assert.ok(
    drawCardRewardScore > freeTechRewardScore,
    "the affordable one-energy displayed card should beat a two-energy card when only the reward energy is available",
  );
  assert.equal(
    unknownDisplayedRewardScore,
    invalidDisplayedRewardScore,
    "missing and invalid displayed-card indexes must use the same generic fallback",
  );
  assert.notEqual(unknownDisplayedRewardScore, drawCardRewardScore);
}

{
  const getOrdinaryPublicityCardEffectValue = (takeableTechIds = []) => {
    const turnChoices = [];
    const card = {
      id: "seed-3-publicity-33-regression",
      cardName: "Seed 3 publicity regression",
      typeCode: 2,
      price: 2,
      playEffects: [{ type: "gain_resources", options: { gain: { publicity: 2 } } }],
    };
    const harness = createAiControllerHarness(null, {
      currentPlayerColor: "blue",
      roundNumber: 1,
      canStartMainAction: true,
      realisticCanAfford: true,
      recordBeginPlayCard: true,
      blueResources: { score: 6, credits: 3, energy: 3, publicity: 5, availableData: 3, handSize: 1 },
      blueHand: [card],
      takeableTechIds,
      techStacks: {
        purple3: {
          techType: "purple",
          stackIndex: 3,
          bonusId: "bonus_3f",
          firstTakeClaimedBy: null,
          remaining: 4,
        },
      },
      onChooseTurnAction: (candidates) => turnChoices.push(candidates),
      chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "playCard") || null,
    });
    assert.equal(harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok, true);
    const result = harness.controller.runAiAutomationStep();
    assert.equal(result.ok, true, JSON.stringify(result));
    const playAction = turnChoices.flat().find((candidate) => candidate.id === "playCard");
    const cardCandidate = playAction?.playableCards?.find((candidate) => candidate.cardId === card.id)
      || playAction?.playableCards?.[0]
      || null;
    assert.ok(cardCandidate, "ordinary publicity card should remain a playable candidate");
    return Number(cardCandidate.valueBreakdown?.effectValue);
  };

  const withoutTakeableTech = getOrdinaryPublicityCardEffectValue([]);
  const withTakeableTech = getOrdinaryPublicityCardEffectValue(["purple3"]);
  assert.ok(Number.isFinite(withoutTakeableTech) && withoutTakeableTech > 0);
  assert.equal(
    withTakeableTech,
    withoutTakeableTech,
    "ordinary gain_resources publicity should keep its scalar value and must not preview the real tech supply twice",
  );
}

{
  const alienGameState = makeBanrenmaAlienState();
  alienGameState.banrenma.displayedCardIndex = 4;
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    blueResources: { score: 56, credits: 1, energy: 0, publicity: 5, availableData: 0, handSize: 4 },
    blueTechCounts: { orange: 3, purple: 2, blue: 3 },
    takeableTechIds: ["purple3"],
    techStacks: {
      purple3: {
        techType: "purple",
        stackIndex: 3,
        bonusId: "bonus_1m",
        firstTakeClaimedBy: null,
        remaining: 4,
      },
    },
    finalScoringState: {
      tiles: {
        a: { id: "a", marks: [{ playerId: "player-blue", threshold: 25, slotIndex: 1 }] },
        b: { id: "b", marks: [{ playerId: "player-blue", threshold: 50, slotIndex: 1 }] },
        d: { id: "d", marks: [] },
      },
    },
    finalFormulaIds: { a: "a1", b: "d1", d: "b1" },
    finalSlotMultipliers: { a1: 5, b1: 8, d1: 11 },
    endGameScoring: {
      getFormulaBaseValue: (formulaId, player) => (
        formulaId === "d1"
          ? Math.min(
            Number(player?.techCounts?.orange || 0),
            Number(player?.techCounts?.purple || 0),
            Number(player?.techCounts?.blue || 0),
          )
          : 0
      ),
    },
    alienGameState,
    pendingBanrenmaOpportunity: {
      type: "panel",
      playerId: "player-blue",
      playerColor: "blue",
      markId: "banrenma-publicity-tech-tempo",
    },
    scanTargetButtons: [2, 3].map((position) => makeButton(
      { banrenmaBonusChoice: String(position) },
      `${position}号奖励 ${banrenma.getBonusReward(position)?.label || ""}`,
    )),
    useDefaultAlienUsePolicy: true,
    recordBanrenmaChoices: true,
    aiValuation: setiAi.valuation,
  });
  assert.equal(harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, JSON.stringify(result));
  const useLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "alien-use" && entry.details?.pendingType === "banrenma-bonus");
  assert.deepEqual(
    harness.getHandled(),
    { type: "banrenma-bonus", choice: "3" },
    `a publicity reward that immediately unlocks a real high-value tech should beat a displayed card that needs another main action: ${JSON.stringify(useLog?.details?.options)}`,
  );
}

{
  const makeNoTraceTargetHarness = (choices) => createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    alienSlotIds: [],
    alienGameState: makeBanrenmaAlienState(),
    pendingBanrenmaOpportunity: {
      type: "panel",
      playerId: "player-blue",
      playerColor: "blue",
      markId: "banrenma-no-trace-target",
    },
    scanTargetButtons: choices.map((position) => makeButton(
      { banrenmaBonusChoice: String(position) },
      `${position}号奖励 ${banrenma.getBonusReward(position)?.label || ""}`,
    )),
    useDefaultAlienUsePolicy: true,
    recordBanrenmaChoices: true,
    aiValuation: setiAi.valuation,
  });

  const alternativeHarness = makeNoTraceTargetHarness([1, 3]);
  assert.equal(alternativeHarness.controller.configureAiAutoBattle({
    playerIds: [alternativeHarness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  assert.equal(alternativeHarness.controller.runAiAutomationStep().ok, true);
  assert.deepEqual(
    alternativeHarness.getHandled(),
    { type: "banrenma-bonus", choice: "3" },
    "an unavailable trace reward should not beat an executable alternative",
  );

  const onlyTraceHarness = makeNoTraceTargetHarness([1]);
  assert.equal(onlyTraceHarness.controller.configureAiAutoBattle({
    playerIds: [onlyTraceHarness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);
  assert.equal(onlyTraceHarness.controller.runAiAutomationStep().ok, true);
  assert.deepEqual(
    onlyTraceHarness.getHandled(),
    { type: "banrenma-bonus", choice: "1" },
    "the only remaining trace reward must still be consumed so the mandatory effect can advance",
  );
  const fallbackLog = onlyTraceHarness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "alien-use" && entry.details?.pendingType === "banrenma-bonus");
  assert.equal(fallbackLog?.details?.options?.[0]?.disabled, false);
  assert.equal(fallbackLog?.details?.options?.[0]?.score, 0);
}

{
  const alienGameState = makeBanrenmaAlienState();
  const traceCard = banrenma.createAlienCard(0, 1);
  const incomeCard = banrenma.createAlienCard(2, 2);
  const playerRef = { id: "player-blue", color: "blue", colorLabel: "Blue" };
  const traceMark = banrenma.addScoreMark(alienGameState, playerRef, 40, "card", {
    cardInstanceId: traceCard.id,
    cardIndex: 0,
  });
  const incomeMark = banrenma.addScoreMark(alienGameState, playerRef, 40, "card", {
    cardInstanceId: incomeCard.id,
    cardIndex: 2,
  });
  traceCard.banrenmaScoreMarkId = traceMark.id;
  incomeCard.banrenmaScoreMarkId = incomeMark.id;
  const originalOrder = [traceCard.id, incomeCard.id];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    alienSlotIds: [],
    alienGameState,
    blueReservedCards: [traceCard, incomeCard],
    blueResources: { score: 50, credits: 2, energy: 1, publicity: 1, availableData: 0, handSize: 1 },
    readyBanrenmaPlayerColor: "blue",
  });
  assert.equal(harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  }).ok, true);

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should open the best executable ready Banrenma card");
  assert.deepEqual(harness.getHandled(), {
    type: "banrenma-ready",
    playerColor: "blue",
    includeCards: true,
    preferredCardId: incomeCard.id,
    firstReservedCardId: incomeCard.id,
  });
  assert.deepEqual(
    harness.blue.reservedCards.map((card) => card.id),
    originalOrder,
    "temporary preferred-card ordering must not mutate the player's reserved-card order",
  );
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    runezuQuick: true,
    blueRunezuSymbols: { symbol_4: 1 },
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should open Runezu face symbol quick action after reveal");
  assert.equal(harness.getHandled().type, "runezu-face-symbol-open");
  assert.equal(harness.getHandled().alienSlotId, 1);
  assert.ok([4, 5, 6, 7].includes(harness.getHandled().position));
}

{
  let selectedTurnAction = null;
  let seenTurnCandidates = [];
  const runezuCard2 = runezu.createAlienCard(2, 1);
  runezuCard2.runezuTaskProgress = [{ event: "orbitOrLand", symbolId: "symbol_4" }];
  const runezuCard4 = runezu.createAlienCard(4, 2);
  runezuCard4.runezuTaskProgress = [{ event: "scan", symbolId: "symbol_4" }];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    pendingActionExecuted: true,
    roundNumber: 3,
    runezuQuick: true,
    runezuFaceSymbolSlots: {
      3: "symbol_3",
      4: "symbol_4",
      6: "symbol_6",
      7: "symbol_7",
    },
    blueRunezuSymbols: {
      symbol_1: 1,
      symbol_2: 1,
      symbol_5: 1,
    },
    blueResources: { availableData: 1 },
    blueHand: [
      runezuCard2,
      runezuCard4,
      runezu.createAlienCard(6, 3),
    ],
    onChooseTurnAction: (_candidates, selected) => {
      selectedTurnAction = selected;
      seenTurnCandidates = _candidates.slice();
    },
    chooseTurnAction: (candidates) => candidates
      .slice()
      .filter((candidate) => candidate.available !== false)
      .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
    data: {
      PLACEMENT_KIND_COMPUTER: "computer",
      PLACEMENT_KIND_BLUE_BONUS: "blueBonus",
      getComputerSlotBonus: () => null,
      canPlaceAnyData: () => ({
        ok: true,
        choices: [{
          target: "computer",
          placementSlot: 1,
          label: "第一排放置位 1",
          description: "按从左到右放入第一排第 1 位",
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
  assert.equal(result.ok, true, "AI should evaluate Runezu face symbols by real score");
  assert.equal(harness.getHandled().type, "runezu-face-symbol-open");
  assert.equal(
    harness.getHandled().position,
    5,
    "AI should fill Runezu position 5 when it unlocks follow-up position 1/2 symbol rewards",
  );
  assert.ok(
    seenTurnCandidates.some((candidate) => candidate.id === "placeData"),
    "Runezu dependency test should compare against a normal low-value data placement",
  );
  assert.ok(
    Number(selectedTurnAction?.valueBreakdown?.dependencyUnlockValue || 0) > 0,
    "Runezu position 5 candidate should carry dependency unlock value",
  );
}

console.log("app/ai-controller.pending.integration.test.js ok");

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
  const turnChoices = [];
  const placedTokens = Array.from({ length: 6 }, (_item, index) => ({ placementSlot: index + 1 }));
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
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
    blueResources: { score: 82, credits: 0, energy: 0, publicity: 2, availableData: 6, handSize: 3 },
    blueHand: [
      { id: "locked-a", cardName: "Locked A", price: 2 },
      { id: "locked-b", cardName: "Locked B", price: 2 },
      { id: "locked-c", cardName: "Locked C", price: 2 },
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
  assert.equal(result.ok, true, "resource-locked AI should trade cards for energy before a high-value analyze");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-energy" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.ok(tradeCandidate, "resource-lock analyze unlock trade should be enumerated");
  assert.equal(tradeCandidate.reason, "资源锁：弃牌换能量解锁分析");
  assert.equal(
    tradeCandidate.valueBreakdown?.resourceLockMainUnlockTrade,
    true,
    "resource-lock trade should expose its specific diagnostic marker",
  );
  assert.equal(
    tradeCandidate.valueBreakdown?.unlockedMainAction?.actionId,
    "analyze",
    "resource-lock trade should identify analyze as the unlocked main action",
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
    blueResources: { score: 136, credits: 1, energy: 0, publicity: 0, availableData: 3, handSize: 2 },
    blueHand: [
      { id: "dead-analyze-a", cardName: "Dead Analyze A", price: 2 },
      { id: "dead-analyze-b", cardName: "Dead Analyze B", price: 2 },
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
  assert.equal(result.ok, true, "weak_start final low-tail should trade dead hand for analyze energy");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-energy" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.ok(tradeCandidate, "weak_start final dead-hand analyze unlock trade should be enumerated");
  assert.equal(tradeCandidate.valueBreakdown?.resourceLockMainUnlockTrade, true);
  assert.equal(tradeCandidate.valueBreakdown?.weakStartFinalDeadHandAnalyzeUnlock, true);
  assert.equal(tradeCandidate.valueBreakdown?.unlockedMainAction?.actionId, "analyze");
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.unlockedMainAction?.score || 0) >= 8,
    "the dead-hand exception should still require a concrete analyze score",
  );
  assert.equal(tradeCandidate.valueBreakdown?.handAfterTrade, 0);
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.discardCost || 0) <= 6.5,
    "the dead-hand exception should stay limited to low-opportunity-cost discards",
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
      "cards-for-energy": {
        id: "cards-for-energy",
        label: "2 cards -> 1 energy",
        cost: { handSize: 2 },
        gain: { energy: 1 },
      },
    },
    blueResources: { score: 82, credits: 0, energy: 0, publicity: 2, availableData: 6, handSize: 2 },
    blueHand: [
      { id: "locked-a", cardName: "Locked A", price: 2 },
      { id: "locked-b", cardName: "Locked B", price: 2 },
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
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const passLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "turn-action" && entry.details?.action?.id === "pass");
  const preview = passLog?.details?.resourceLockTradePreviews
    ?.find((entry) => entry.tradeId === "cards-for-energy");
  assert.ok(preview, "resource-lock preview should be recorded when AI passes with a locked hand");
  assert.equal(preview.discardPlan?.ok, true, "exact hand-cost trade previews should not preserve a phantom hand index 0");
  assert.equal(preview.discardPlan?.handCost, 2);
  assert.deepEqual(
    preview.discardPlan?.selectedCards?.map((card) => card.handIndex),
    [0, 1],
  );
  assert.ok(
    turnChoices.flat().some((candidate) => candidate.id === "pass"),
    "the test setup should force a PASS decision so diagnostics are logged",
  );
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    quickTrades: {
      "cards-for-credit": {
        id: "cards-for-credit",
        label: "2 cards -> 1 credit",
        cost: { handSize: 2 },
        gain: { credits: 1 },
      },
    },
    blueResources: { score: 141, credits: 0, energy: 0, publicity: 1, availableData: 0, handSize: 3 },
    blueHand: [
      {
        id: "locked-premium",
        cardName: "Locked premium",
        price: 1,
        playEffects: [{ type: "gain_resources", options: { gain: { score: 12 } } }],
      },
      { id: "locked-filler-a", cardName: "Locked filler A", price: 1 },
      { id: "locked-filler-b", cardName: "Locked filler B", price: 1 },
    ],
    onChooseTurnAction: (candidates) => {
      assert.ok(candidates.some((candidate) => candidate.id === "pass"));
    },
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const passLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "turn-action" && entry.details?.action?.id === "pass");
  const preview = passLog?.details?.resourceLockTradePreviews
    ?.find((entry) => entry.tradeId === "cards-for-credit");
  assert.ok(preview, "resource-lock preview should include cards-for-credit");
  assert.equal(preview.bestAction?.actionId, "playCard");
  assert.equal(preview.bestAction?.handIndex, 0);
  assert.equal(
    preview.discardPlan?.preservedHandIndex,
    0,
    "resource-lock preview discard plan should preserve the unlocked best play card",
  );
  assert.deepEqual(
    preview.discardPlan?.selectedCards?.map((card) => card.handIndex),
    [1, 2],
  );
  assert.deepEqual(
    preview.discardPlan?.executionSelectedIndexes,
    [1, 2],
  );
  assert.equal(preview.bestActionDiscardRisk?.costPlanDiscards, false);
  assert.equal(preview.bestActionDiscardRisk?.executionPlanDiscards, false);
  assert.equal(preview.bestActionDiscardRisk?.executionMatchesCostPlan, true);
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    aiDifficulty: "weak_start",
    roundNumber: 4,
    turnNumber: 7,
    canStartMainAction: true,
    realisticCanAfford: true,
    quickTrades: {
      "cards-for-credit": {
        id: "cards-for-credit",
        label: "2 cards -> 1 credit",
        cost: { handSize: 2 },
        gain: { credits: 1 },
      },
    },
    actionChecks: {
      launch: { ok: true },
    },
    blueResources: { score: 122, credits: 1, energy: 0, publicity: 2, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "dead-launch-a", cardName: "Dead launch A", price: 3 },
      { id: "dead-launch-b", cardName: "Dead launch B", price: 3 },
      { id: "dead-launch-c", cardName: "Dead launch C", price: 3 },
    ],
    findAvailableSlotIndex: () => null,
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
  const passLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "turn-action" && entry.details?.action?.id === "pass");
  const preview = passLog?.details?.resourceLockTradePreviews
    ?.find((entry) => entry.tradeId === "cards-for-credit");
  assert.ok(preview, "resource-lock preview should include the possible launch trade");
  assert.equal(preview.bestAction?.actionId, "launch");
  assert.ok(
    Number(preview.bestAction?.score || 0) < 26,
    "final low-resource launch preview should include no-route penalties before applying the unlock threshold",
  );
  assert.equal(
    turnChoices.flat().some((candidate) => (
      candidate.id === "quickTrade"
      && candidate.tradeId === "cards-for-credit"
      && candidate.valueBreakdown?.unlockedMainAction?.actionId === "launch"
    )),
    false,
    "weak_start should not trade dead final hand into a no-route launch",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 2,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-credit": {
        id: "cards-for-credit",
        label: "2 cards -> 1 credit",
        cost: { handSize: 2 },
        gain: { credits: 1 },
      },
    },
    blueResources: { score: 55, credits: 0, energy: 2, publicity: 2, availableData: 0, handSize: 4 },
    blueHand: [
      { id: "scan-lock-a", cardName: "Scan Lock A", price: 2 },
      { id: "scan-lock-b", cardName: "Scan Lock B", price: 2 },
      { id: "scan-lock-c", cardName: "Scan Lock C", price: 2 },
      { id: "scan-lock-d", cardName: "Scan Lock D", price: 2 },
    ],
    publicCards: [{
      id: "public-high-scan",
      cardId: "public-high-scan",
      cardName: "High public scan",
      scanActionCode: 2,
    }],
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
      choices: [{ nebulaId: "high-nebula", sectorX: 4, label: "High nebula" }],
    }),
    data: {
      getNextReplaceableNebulaToken: () => ({ slotIndex: 30 }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: (_nebulaId, slotIndex) => Number(slotIndex || 0),
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
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
  assert.equal(result.ok, true, "resource-locked AI should trade cards for credit before a high-value scan");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-credit" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-credit");
  assert.ok(tradeCandidate, "resource-lock scan unlock trade should be enumerated");
  assert.equal(tradeCandidate.reason, "资源锁：交易解锁扫描");
  assert.equal(tradeCandidate.valueBreakdown?.unlockedMainAction?.actionId, "scan");
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
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
    blueResources: { score: 82, credits: 0, energy: 1, publicity: 2, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "locked-low-a", cardName: "Locked Low A", price: 2 },
      { id: "locked-low-b", cardName: "Locked Low B", price: 2 },
      { id: "locked-low-c", cardName: "Locked Low C", price: 2 },
    ],
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 0, energy: 2 },
      getStandardScanCost: () => ({ credits: 0, energy: 2 }),
      buildScanEffectQueue: () => [],
      canExecuteScan: (player) => (
        Number(player?.resources?.energy || 0) >= 2
          ? { ok: true }
          : { ok: false, message: "energy missing" }
      ),
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

  harness.controller.runAiAutomationStep();
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-energy");
  assert.equal(
    tradeCandidate,
    undefined,
    "resource-lock trade should not spend two cards for a low-value scan",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    aiDifficulty: "weak_start",
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
    },
    blueResources: { score: 112, credits: 7, energy: 1, publicity: 2, availableData: 0, handSize: 1 },
    scanEffects: {
      EFFECT_TYPES: {
        EARTH_SECTOR_SCAN: "earth_sector_scan",
        IMPROVED_SECTOR_SCAN: "improved_sector_scan",
        MERCURY_SECTOR_SCAN: "mercury_sector_scan",
        PUBLIC_CARD_SCAN: "public_card_scan",
        HAND_SCAN: "hand_scan",
        SCAN_ACTION_4: "scan_action_4",
      },
      SCAN_COST: { credits: 0, energy: 2 },
      getStandardScanCost: () => ({ credits: 0, energy: 2 }),
      buildScanEffectQueue: () => [{ type: "earth_sector_scan" }],
      canExecuteScan: (player) => (
        Number(player?.resources?.energy || 0) >= 2
          ? { ok: true }
          : { ok: false, message: "scan resources missing" }
      ),
    },
    buildSectorScanChoicesForX: (sectorX) => [{
      nebulaId: "direct-score-sector",
      sectorX,
      label: "Direct score sector",
    }],
    data: {
      getNextReplaceableNebulaToken: () => ({ slotIndex: 30 }),
      getNebulaCapacity: () => 3,
      getNebulaSlotScoreReward: () => 18,
      getNebulaColor: () => "blue",
      listNebulaTokens: () => [],
      listSectorExtraMarks: () => [],
      getSectorTokenStats: () => ({}),
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
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-energy");
  assert.ok(tradeCandidate, "weak no-discard scan unlock trade should be enumerated");
  assert.equal(tradeCandidate.reason, "资源锁：交易解锁扫描");
  assert.equal(tradeCandidate.valueBreakdown?.unlockedMainAction?.actionId, "scan");
  assert.ok(
    Number(tradeCandidate.valueBreakdown?.unlockedMainAction?.directScoreGain || 0) > 0,
    "weak no-discard scan unlock should require direct scan score",
  );
  assert.equal(result.ok, true, "weak_start AI should spend spare credits to unlock direct-score scan without discarding");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "credits-for-energy" });
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    blueResources: { score: 141, credits: 2, energy: 0, publicity: 1, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "dead-final-card-a", cardName: "Dead final card A", price: 1, typeCode: 1, playEffects: [] },
      { id: "dead-final-card-b", cardName: "Dead final card B", price: 1, typeCode: 1, playEffects: [] },
      { id: "dead-final-card-c", cardName: "Dead final card C", price: 1, typeCode: 1, playEffects: [] },
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

  harness.controller.runAiAutomationStep();
  const playCardCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "playCard");
  assert.equal(
    playCardCandidate?.available,
    false,
    "final three-mark AI should not spend resources on a negative no-cashout card just to beat pass",
  );
}

{
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    blueResources: { score: 120, credits: 5, energy: 5, publicity: 0, availableData: 0, handSize: 2 },
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
      countSectorWins: () => 1,
      countOrbitOrLandMarkers: () => 6,
    },
    actionChecks: {
      land: { ok: true, planet: { planetId: "mars", name: "火星" }, energyCost: 0, choices: [] },
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
      SCAN_COST: { credits: 0, energy: 0 },
      getStandardScanCost: () => ({ credits: 0, energy: 0 }),
      buildScanEffectQueue: () => [],
      canExecuteScan: () => ({ ok: true }),
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

  harness.controller.runAiAutomationStep();
  const candidates = turnChoices.flat();
  const scanCandidate = candidates.find((candidate) => candidate.id === "scan");
  const landCandidate = candidates.find((candidate) => candidate.id === "land");
  assert.ok(scanCandidate, "B2 bottleneck scenario should expose scan candidate");
  assert.ok(landCandidate, "B2 bottleneck scenario should expose land candidate");
  assert.equal(
    scanCandidate.scoreCapReason,
    null,
    "marked B2 sector bottleneck should not label scan as capped by planet cashout",
  );
  assert.ok(
    Number(scanCandidate.score) > Math.max(0, Number(landCandidate.score || 0) - 7),
    "marked B2 sector bottleneck should preserve scan above the planet cashout cap",
  );
}

{
  const buildHarness = (aiDifficulty) => {
    const turnChoices = [];
    const harness = createAiControllerHarness(null, {
      currentPlayerColor: "blue",
      aiDifficulty,
      roundNumber: 2,
      canStartMainAction: true,
      realisticCanAfford: true,
      takeableTechIds: ["orange1"],
      techStacks: {
        orange1: { techType: "orange", bonusId: null, firstTakeClaimedBy: "other-player", stackIndex: 1 },
      },
      blueResources: { score: 37, credits: 1, energy: 4, publicity: 7, availableData: 0, handSize: 5 },
      finalScoringState: {
        tiles: {
          final_b2: {
            id: "final_b2",
            marks: [],
          },
        },
      },
      finalFormulaIds: { final_b2: "b2" },
      finalSlotMultipliers: { b2: { 1: 8 } },
      endGameScoring: {
        countSectorWins: () => 0,
        countOrbitOrLandMarkers: () => 1,
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
        canExecuteScan: () => ({ ok: true }),
      },
      buildSectorScanChoicesForX: (sectorX) => [{
        nebulaId: "b2-setup-sector",
        sectorX,
        label: "B2 setup sector",
      }],
      data: {
        getNextReplaceableNebulaToken: () => ({ slotIndex: 2 }),
        getNebulaCapacity: () => 3,
        getNebulaSlotScoreReward: () => 2,
        getNebulaColor: () => "blue",
        listNebulaTokens: () => [{}, {}, { playerId: "other-player" }],
        listSectorExtraMarks: () => [],
        getSectorTokenStats: () => ({
          other: { playerId: "other-player", count: 0 },
        }),
      },
      onChooseTurnAction: (candidates) => turnChoices.push(candidates),
      chooseTurnAction: (candidates) => candidates
        .slice()
        .filter((candidate) => candidate.available !== false)
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))[0] || null,
    });
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      ...(aiDifficulty ? { aiDifficulty } : {}),
      suppressAutoSchedule: true,
    });
    return { harness, turnChoices };
  };

  const weak = buildHarness("weak_start");
  weak.harness.controller.runAiAutomationStep();
  const weakCandidates = weak.turnChoices.flat();
  const weakScan = weakCandidates.find((candidate) => candidate.id === "scan");
  const weakTech = weakCandidates.find((candidate) => candidate.id === "researchTech");
  assert.ok(
    weakScan?.valueBreakdown?.weakEarlyB2SetupScanTieBreak > 0,
    "weak_start should add a B2 setup scan tie-break before B2 is marked",
  );
  assert.ok(
    Number(weakScan.score) > Number(weakTech.score),
    "weak_start B2 setup scan should beat a zero-direct research-tech candidate in the narrow low-resource window",
  );

  const defaultDifficulty = buildHarness(undefined);
  defaultDifficulty.harness.controller.runAiAutomationStep();
  const defaultScan = defaultDifficulty.turnChoices
    .flat()
    .find((candidate) => candidate.id === "scan");
  assert.equal(
    defaultScan?.valueBreakdown?.weakEarlyB2SetupScanTieBreak,
    undefined,
    "default difficulty should not receive the weak_start B2 setup scan tie-break",
  );
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-tail-score-card",
    cardName: "Public tail score card",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 14 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 158, credits: 1, energy: 0, publicity: 3, availableData: 0, handSize: 0 },
    blueHand: [],
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
  assert.equal(result.ok, true, "AI should use publicity to refill a playable tail scoring card");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "publicity-for-card tail refill candidate should be enumerated");
  assert.equal(
    tradeCandidate.valueBreakdown?.finalLowHandPublicRefill,
    true,
    "158-score final low-hand player should still be inside the public refill window",
  );
}

{
  const turnChoices = [];
  const publicFillerCard = {
    id: "public-low-tail-filler",
    cardName: "Public low tail filler",
    price: 2,
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicFillerCard],
    blueResources: { score: 119, credits: 0, energy: 1, publicity: 4, availableData: 0, handSize: 1 },
    blueHand: [{ id: "unpayable-low-tail", cardName: "Unpayable low tail", price: 2 }],
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
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card")
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
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.equal(
    tradeCandidate,
    undefined,
    "low-score public refill should require a concrete playable public-card score",
  );
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-three-mark-tail-score",
    cardName: "Public three mark tail score",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 14 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-card": {
        id: "credits-for-card",
        label: "2 credits -> public card",
        cost: { credits: 2 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 132, credits: 2, energy: 1, publicity: 1, availableData: 0, handSize: 1 },
    blueHand: [{ id: "unpayable-tail", cardName: "Unpayable tail", price: 3 }],
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

  harness.controller.runAiAutomationStep();
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-card");
  assert.equal(
    tradeCandidate,
    undefined,
    "three-mark low-tail credit refill should not spend the last credits on public cards that become unpayable after trade",
  );
}

{
  const turnChoices = [];
  const publicNextTurnScoreCard = {
    id: "public-post-main-score-card",
    cardName: "Public post-main score card",
    price: 2,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 50 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    aiDifficulty: "weak_start",
    roundNumber: 3,
    pendingActionExecuted: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-card": {
        id: "credits-for-card",
        label: "2 credits -> public card",
        cost: { credits: 2 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicNextTurnScoreCard],
    blueResources: { score: 70, credits: 8, energy: 0, publicity: 3, availableData: 0, handSize: 0 },
    blueHand: [],
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
      .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-card")
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
  assert.equal(result.ok, true, "weak_start should preserve a concrete public scoring card after the main action");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "credits-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-card");
  assert.ok(tradeCandidate, "post-main credit refill candidate should be enumerated");
  assert.equal(tradeCandidate.valueBreakdown?.weakStartPostMainCreditRefill, true);
}

{
  const turnChoices = [];
  const publicNextTurnScoreCard = {
    id: "public-post-main-default-score-card",
    cardName: "Public post-main default score card",
    price: 2,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 50 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 3,
    pendingActionExecuted: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-card": {
        id: "credits-for-card",
        label: "2 credits -> public card",
        cost: { credits: 2 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicNextTurnScoreCard],
    blueResources: { score: 70, credits: 8, energy: 0, publicity: 3, availableData: 0, handSize: 0 },
    blueHand: [],
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
    chooseTurnAction: () => null,
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
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-card");
  assert.equal(
    tradeCandidate,
    undefined,
    "post-main weak_start public refill should not affect default difficulty",
  );
}

{
  const turnChoices = [];
  const publicFillerCard = {
    id: "public-payable-filler",
    cardName: "Public payable filler",
    price: 2,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 8 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "credits-for-card": {
        id: "credits-for-card",
        label: "2 credits -> public card",
        cost: { credits: 2 },
        gain: { handSize: 1 },
      },
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicFillerCard],
    blueResources: { score: 292, credits: 2, energy: 0, publicity: 5, availableData: 0, handSize: 0 },
    blueHand: [],
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
  assert.equal(result.ok, true, "AI should preserve the last credits when publicity can refill a high-score hand");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const creditTradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "credits-for-card");
  assert.equal(creditTradeCandidate, undefined, "high-score refill should not spend the last 2 credits while publicity is available");
  const publicTradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.equal(publicTradeCandidate?.valueBreakdown?.finalHighScorePreserveLastCredits, true);
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-over-305-score",
    cardName: "Public over 305 score",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 14 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 316, credits: 4, energy: 0, publicity: 4, availableData: 0, handSize: 0 },
    blueHand: [],
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
  assert.equal(result.ok, true, "AI should keep refilling a high-score hand above 305 when the public card is valuable");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "over-305 high-score refill candidate should be enumerated");
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreNeedsCardRefill, true);
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-tail-score-two-hand",
    cardName: "Public tail score two hand",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 12 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 293, credits: 4, energy: 0, publicity: 4, availableData: 0, handSize: 2 },
    blueHand: [
      { id: "unpayable-a", cardName: "Unpayable A", price: 5 },
      { id: "unpayable-b", cardName: "Unpayable B", price: 5 },
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
  assert.equal(result.ok, true, "AI should refill during a high-score push when two hand cards are unplayable");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "two-card stale high-score refill candidate should be enumerated");
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreNeedsCardRefill, true);
  assert.ok(Number(tradeCandidate.valueBreakdown?.highScorePlayableHandScore || 0) < 8);
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 6, availableData: 0, handSize: 2 },
    blueHand: [
      { id: "highscore-unpayable-a", cardName: "Highscore unpayable A", price: 5 },
      { id: "highscore-unpayable-b", cardName: "Highscore unpayable B", price: 5 },
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
    chooseTurnAction: (candidates) => candidates.find((candidate) => candidate.id === "pass") || null,
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  harness.controller.runAiAutomationStep();
  const passLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "turn-action" && entry.details?.action?.id === "pass");
  assert.equal(passLog?.details?.finalHighScorePassRecoveryDiagnostic?.scoreTo300, 12);
  assert.equal(
    passLog?.details?.finalHighScorePassRecoveryDiagnostic?.highScoreGate?.finalHighScoreNeedsCardRefill,
    true,
  );
  assert.equal(
    passLog?.details?.finalHighScorePassRecoveryDiagnostic?.highScoreGate?.publicRefillScoreThreshold,
    5,
  );
}

{
  const badPublicCard = {
    id: "negative-highscore-public-card",
    cardName: "Negative highscore public card",
    price: 4,
  };
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [badPublicCard],
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 6, availableData: 0, handSize: 0 },
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
  assert.equal(result.ok, true, "AI should use publicity to blind draw when high-score public cards are negative");
  assert.deepEqual(harness.getHandled(), {
    type: "quick-trade",
    tradeId: "publicity-for-card",
    preferBlindDraw: true,
  });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "blind high-score refill candidate should be enumerated");
  assert.equal(tradeCandidate.preferBlindDraw, true);
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreBlindRefill, true);
  assert.ok(Number(tradeCandidate.valueBreakdown?.bestPublicTradeCardScore || 0) < 5);
}

{
  const badPublicCard = {
    id: "negative-weak-highscore-public-card",
    cardName: "Negative weak highscore public card",
    price: 4,
  };
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    blueAiDifficulty: "weak_start",
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [badPublicCard],
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 3, availableData: 0, handSize: 0 },
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
      aiDifficulty: "weak_start",
      suppressAutoSchedule: true,
    }).ok,
    true,
  );

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "weak_start should use a 3-publicity blind refill near 300");
  assert.deepEqual(harness.getHandled(), {
    type: "quick-trade",
    tradeId: "publicity-for-card",
    preferBlindDraw: true,
  });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.equal(tradeCandidate?.preferBlindDraw, true);
  assert.equal(tradeCandidate?.valueBreakdown?.finalHighScoreBlindRefill, true);
  assert.equal(tradeCandidate?.valueBreakdown?.finalHighScoreBlindRefillPublicityThreshold, 3);
}

{
  const badPublicCard = {
    id: "negative-default-highscore-public-card",
    cardName: "Negative default highscore public card",
    price: 4,
  };
  const turnChoices = [];
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [badPublicCard],
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 3, availableData: 0, handSize: 0 },
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

  harness.controller.runAiAutomationStep();
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.equal(
    tradeCandidate,
    undefined,
    "default difficulty should keep the 6-publicity terminal blind-refill threshold",
  );
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-highscore-dead-hand-score-card",
    cardName: "Public highscore dead-hand score card",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 26 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "cards-for-pick-card": {
        id: "cards-for-pick-card",
        label: "2 cards -> public card",
        cost: { handSize: 2 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 288, credits: 9, energy: 1, publicity: 0, availableData: 0, handSize: 4 },
    blueHand: [
      { id: "dead-highscore-a", cardName: "Dead highscore A", price: 20 },
      { id: "dead-highscore-b", cardName: "Dead highscore B", price: 20 },
      { id: "dead-highscore-c", cardName: "Dead highscore C", price: 20 },
      { id: "dead-highscore-d", cardName: "Dead highscore D", price: 20 },
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
  assert.equal(result.ok, true, "AI should trade dead high-score hands for a concrete public score card");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "cards-for-pick-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "cards-for-pick-card");
  assert.ok(tradeCandidate, "dead-hand public-card trade should be enumerated for high-score push");
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreDeadHandRefillBaseWindow, true);
  assert.equal(tradeCandidate.valueBreakdown?.finalHighScoreDeadHandPickRefill, true);
  assert.ok(Number(tradeCandidate.valueBreakdown?.cardsForPickCardDiscardCost || 0) <= 8);
}

{
  const turnChoices = [];
  const publicScoreCard = {
    id: "public-low-stale-score-card",
    cardName: "Public low stale score card",
    price: 1,
    playEffects: [{ type: "gain_resources", options: { gain: { score: 14 } } }],
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 5,
    canStartMainAction: true,
    realisticCanAfford: true,
    recordQuickTrade: true,
    quickTrades: {
      "publicity-for-card": {
        id: "publicity-for-card",
        label: "3 publicity -> public card",
        cost: { publicity: 3 },
        gain: { handSize: 1 },
      },
    },
    publicCards: [publicScoreCard],
    blueResources: { score: 143, credits: 1, energy: 0, publicity: 5, availableData: 0, handSize: 3 },
    blueHand: [
      { id: "stale-low-a", cardName: "Stale Low A", price: 5 },
      { id: "stale-low-b", cardName: "Stale Low B", price: 5 },
      { id: "stale-low-c", cardName: "Stale Low C", price: 5 },
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
  assert.equal(result.ok, true, "AI should use publicity when low-score final hands are stale but not empty");
  assert.deepEqual(harness.getHandled(), { type: "quick-trade", tradeId: "publicity-for-card" });
  const tradeCandidate = turnChoices
    .flat()
    .find((candidate) => candidate.id === "quickTrade" && candidate.tradeId === "publicity-for-card");
  assert.ok(tradeCandidate, "low stale hand publicity refill candidate should be enumerated");
  assert.equal(tradeCandidate.valueBreakdown?.finalLowStaleHandPublicRefill, true);
  assert.ok(Number(tradeCandidate.valueBreakdown?.finalLowStaleHandPlayableScore || 0) < 7);
}

{
  const badPublicCard = {
    id: "negative-selection-public-card",
    cardName: "Negative selection public card",
    price: 4,
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    cardSelectionActive: true,
    recordBlindDraw: true,
    recordPublicPick: true,
    canBlindDraw: true,
    publicCards: [badPublicCard],
    pendingCardSelectionAction: {
      type: "trade",
      tradeId: "publicity-for-card",
      aiPreferBlindDraw: true,
      aiReason: "高分冲刺：公共牌无收益时盲抽找最后得分牌",
      player: null,
    },
    blueResources: { score: 288, credits: 0, energy: 0, publicity: 3, handSize: 0 },
  });
  harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should blind draw when the trade pending explicitly prefers blind draw");
  assert.deepEqual(harness.getHandled(), { type: "blind-draw", fromSelection: true });
}

{
  const fillerCard = {
    id: "plain-low-card",
    cardName: "Plain low card",
    price: 4,
  };
  const publicityCornerCard = {
    id: "publicity-corner-card",
    cardName: "Publicity corner card",
    price: 4,
    resourceReward: { gain: { publicity: 2 } },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    cardSelectionActive: true,
    recordPublicPick: true,
    publicCards: [fillerCard, publicityCornerCard],
    pendingCardSelectionAction: {
      type: "trade",
      player: null,
    },
    blueResources: { score: 118, credits: 0, energy: 0, publicity: 4, handSize: 0 },
    blueOwnedTechTiles: {
      orange1: true,
      purple1: true,
      blue1: true,
      blue2: true,
      blue3: true,
      purple2: true,
    },
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
    finalSlotMultipliers: {
      d2: { 1: 8 },
    },
  });
  harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should pick the non-runezu publicity corner setup card");
  assert.deepEqual(harness.getHandled(), { type: "public-pick", slotIndex: 1 });
}

{
  const fillerCard = {
    id: "plain-low-card",
    cardName: "Plain low card",
    price: 4,
  };
  const publicityCornerCard = {
    id: "publicity-corner-card",
    cardName: "Publicity corner card",
    price: 4,
    resourceReward: { gain: { publicity: 2 } },
  };
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    roundNumber: 4,
    cardSelectionActive: true,
    recordPublicPick: true,
    runezuQuick: true,
    publicCards: [fillerCard, publicityCornerCard],
    pendingCardSelectionAction: {
      type: "trade",
      player: null,
    },
    blueResources: { score: 118, credits: 0, energy: 0, publicity: 4, handSize: 0 },
    blueOwnedTechTiles: {
      orange1: true,
      purple1: true,
      blue1: true,
      blue2: true,
      blue3: true,
      purple2: true,
    },
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
    finalSlotMultipliers: {
      d2: { 1: 8 },
    },
  });
  harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });

  const result = harness.controller.runAiAutomationStep();
  assert.equal(result.ok, true, "AI should not over-prioritize generic resource corners after runezu is revealed");
  assert.deepEqual(harness.getHandled(), { type: "public-pick", slotIndex: 0 });
}

{
  const pendingBlue = {
    id: "player-blue",
    color: "blue",
    colorLabel: "Blue",
    hand: [],
    reservedCards: [],
    resources: { score: 18, credits: 4, energy: 3, publicity: 2, availableData: 0, handSize: 0 },
    income: {},
    techState: { ownedTiles: {} },
  };
  const launchCard = {
    id: "blue-launch-public-card",
    cardName: "Blue launch public card",
    price: 0,
    typeCode: 0,
    playEffects: [{ type: "launch", options: { cost: {} } }],
  };
  const readLaunchPickProfile = (whiteRocketCount) => {
    const whiteRockets = Array.from({ length: whiteRocketCount }, (_item, index) => ({
      id: 100 + index,
      playerId: "player-white",
      sector: { x: index, y: 2 },
    }));
    const harness = createAiControllerHarness(null, {
      currentPlayerColor: "white",
      cardSelectionActive: true,
      recordPublicPick: true,
      roundNumber: 2,
      whiteResources: { score: 20, credits: 4, energy: 3, publicity: 2, handSize: 0 },
      blueResources: pendingBlue.resources,
      pendingCardSelectionAction: {
        type: "trade",
        player: pendingBlue,
      },
      publicCards: [launchCard],
      rocketTokensByPlayer: {
        "player-white": whiteRockets,
        "player-blue": [],
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
    assert.equal(result.ok, true, "AI should resolve the pending blue public pick");
    const pickLog = harness.controller.getAiAutoBattleReport().logs
      .find((entry) => entry.type === "pick-card");
    assert.ok(pickLog, "public pick log should expose the evaluated public candidate");
    return pickLog.details?.topPublicCandidates?.[0] || null;
  };

  const noWhiteRocketProfile = readLaunchPickProfile(0);
  const manyWhiteRocketsProfile = readLaunchPickProfile(3);
  assert.equal(noWhiteRocketProfile?.cardId, "blue-launch-public-card");
  assert.equal(manyWhiteRocketsProfile?.cardId, "blue-launch-public-card");
  assert.equal(
    manyWhiteRocketsProfile.valueSignals?.standardActionPremium,
    noWhiteRocketProfile.valueSignals?.standardActionPremium,
    "pending blue public-pick play value should use blue's launch context, not current white rockets",
  );
  assert.equal(
    manyWhiteRocketsProfile.playScore,
    noWhiteRocketProfile.playScore,
    "non-current player public-pick play score should be stable when only current player's rockets change",
  );
}

{
  const pendingBlue = {
    id: "player-blue",
    color: "blue",
    colorLabel: "Blue",
    hand: [],
    reservedCards: [],
    resources: { score: 18, credits: 4, energy: 3, publicity: 2, availableData: 0, handSize: 0 },
    income: {},
    techState: { ownedTiles: {} },
  };
  const publicLaunchCard = {
    id: "blue-demand-public-launch",
    cardName: "Blue demand public launch",
    price: 0,
    typeCode: 0,
    playEffects: [{ type: "launch", options: { cost: {} } }],
    model: { tasks: [] },
  };
  const whiteTaskCard = {
    id: "white-planet-task",
    cardName: "White planet task",
    model: {
      tasks: [{
        id: "white-jupiter-task",
        condition: { type: "planetOrbitOrLand", planetId: "jupiter" },
        rewards: [{ type: "gain_resources", options: { gain: { score: 40 } } }],
      }],
    },
  };
  const readDemandPickProfile = (whiteReservedCards) => {
    const harness = createAiControllerHarness(null, {
      currentPlayerColor: "white",
      cardSelectionActive: true,
      recordPublicPick: true,
      roundNumber: 3,
      whiteResources: { score: 20, credits: 4, energy: 3, publicity: 2, handSize: 0 },
      whiteReservedCards,
      blueResources: pendingBlue.resources,
      pendingCardSelectionAction: {
        type: "trade",
        player: pendingBlue,
      },
      publicCards: [publicLaunchCard],
      rocketTokensByPlayer: {
        "player-white": [],
        "player-blue": [],
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
    assert.equal(result.ok, true, "AI should resolve the pending blue public pick");
    const pickLog = harness.controller.getAiAutoBattleReport().logs
      .find((entry) => entry.type === "pick-card");
    assert.ok(pickLog, "public pick log should expose the evaluated public candidate");
    return pickLog.details?.topPublicCandidates?.[0] || null;
  };

  const plainWhiteProfile = readDemandPickProfile([]);
  const taskDrivenWhiteProfile = readDemandPickProfile([whiteTaskCard]);
  assert.equal(plainWhiteProfile?.cardId, "blue-demand-public-launch");
  assert.equal(taskDrivenWhiteProfile?.cardId, "blue-demand-public-launch");
  assert.equal(
    taskDrivenWhiteProfile.playScore,
    plainWhiteProfile.playScore,
    "pending blue public-pick play score should ignore current white player's reserved-task demand",
  );
}

{
  const pendingBlue = {
    id: "player-blue",
    color: "blue",
    colorLabel: "Blue",
    hand: [],
    reservedCards: [],
    resources: { score: 18, credits: 4, energy: 3, publicity: 2, availableData: 0, handSize: 0 },
    income: {},
    techState: { ownedTiles: {} },
  };
  const publicMoveCard = {
    id: "blue-move-public-card",
    cardName: "Blue move public card",
    price: 0,
    typeCode: 0,
    playEffects: [{ type: "free_move", options: { movementPoints: 1 } }],
  };
  const readMovePickProfile = (whiteRocketCount) => {
    const whiteRockets = Array.from({ length: whiteRocketCount }, (_item, index) => ({
      id: 300 + index,
      playerId: "player-white",
      sector: { x: index, y: 2 },
    }));
    const harness = createAiControllerHarness(null, {
      currentPlayerColor: "white",
      cardSelectionActive: true,
      recordPublicPick: true,
      roundNumber: 3,
      whiteResources: { score: 20, credits: 4, energy: 3, publicity: 2, handSize: 0 },
      blueResources: pendingBlue.resources,
      pendingCardSelectionAction: {
        type: "trade",
        player: pendingBlue,
      },
      publicCards: [publicMoveCard],
      rocketTokensByPlayer: {
        "player-white": whiteRockets,
        "player-blue": [{ id: 201, playerId: "player-blue", sector: { x: 1, y: 2 } }],
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
    assert.equal(result.ok, true, "AI should resolve the pending blue public pick");
    const pickLog = harness.controller.getAiAutoBattleReport().logs
      .find((entry) => entry.type === "pick-card");
    assert.ok(pickLog, "public pick log should expose the evaluated public candidate");
    return pickLog.details?.topPublicCandidates?.[0] || null;
  };

  const noWhiteRocketProfile = readMovePickProfile(0);
  const manyWhiteRocketsProfile = readMovePickProfile(3);
  assert.equal(noWhiteRocketProfile?.cardId, "blue-move-public-card");
  assert.equal(manyWhiteRocketsProfile?.cardId, "blue-move-public-card");
  assert.equal(
    manyWhiteRocketsProfile.playScore,
    noWhiteRocketProfile.playScore,
    "pending blue public-pick move preview should use blue rockets, not current white rockets",
  );
  assert.notEqual(noWhiteRocketProfile.playScore, null, "blue-owned move card should remain playable from blue's rocket");
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    blueOwnedTechTiles: {
      orange1: true,
      orange3: true,
      blue2: true,
      purple4: true,
    },
    blueTechCounts: {
      orange: 2,
      blue: 1,
      purple: 1,
    },
  });
  harness.controller.configureAiAutoBattle({
    playerIds: [harness.blue.id],
    suppressAutoSchedule: true,
  });

  const blueResult = harness.controller.getAiAutoBattleReport().playerResults
    .find((player) => player.playerId === harness.blue.id);
  assert.equal(blueResult.techCount, 4, "autobattle player results should keep total tech count");
  assert.deepEqual(
    blueResult.techTypeCounts,
    { orange: 2, blue: 1, purple: 1 },
    "autobattle player results should expose tech type counts for D1 diagnostics",
  );
  assert.deepEqual(
    blueResult.traceTypeCounts,
    { yellow: 0, pink: 0, blue: 0 },
    "autobattle player results should expose per-type alien traces for B1 diagnostics",
  );
}

{
  const harness = createAiControllerHarness(null, {
    currentPlayerColor: "blue",
    canStartMainAction: true,
    recordResearchTech: true,
    takeableTechIds: ["blue1"],
    techStacks: {
      blue1: { techType: "blue", stackIndex: 1, remaining: 3 },
    },
    aiPlanner: {
      chooseTurnPlan: (candidates) => ({
        key: "pass",
        type: "pass",
        score: -2,
        firstAction: candidates.find((candidate) => candidate.id === "pass") || null,
      }),
    },
    chooseTurnAction: (candidates) => (
      candidates.find((candidate) => candidate.id === "researchTech") || null
    ),
  });
  assert.equal(
    harness.controller.configureAiAutoBattle({
      playerIds: [harness.blue.id],
      suppressAutoSchedule: true,
    }).ok,
    true,
  );
  assert.equal(harness.controller.runAiAutomationStep().ok, true);
  const turnLog = harness.controller.getAiAutoBattleReport().logs
    .find((entry) => entry.type === "turn-action");
  assert.equal(turnLog?.details?.action?.id, "researchTech");
  const plannerShadow = turnLog?.details?.plannerShadow;
  assert.equal(plannerShadow?.key, "pass");
  assert.equal(plannerShadow?.type, "pass");
  assert.equal(plannerShadow?.score, -2);
  assert.equal(plannerShadow?.firstAction?.id, "pass");
  assert.equal(plannerShadow?.firstAction?.kind, "pass");
  assert.equal(plannerShadow?.firstAction?.actionGraphNet, null);
  assert.equal(plannerShadow?.policyActionId, "researchTech");
  assert.equal(plannerShadow?.diverged, true);
}

console.log("app/ai-controller.strategy.integration.test.js ok");

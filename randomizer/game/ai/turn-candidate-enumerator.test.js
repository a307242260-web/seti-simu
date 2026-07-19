"use strict";

const assert = require("node:assert/strict");
const actionExecutor = require("../../app/ai/action-executor");
const enumeratorModule = require("./turn-candidate-enumerator");

for (const forbiddenKey of [
  "document", "window", "dispatchRuntimeAction", "executeAiTurnAction", "runQuickTrade",
  "beginPlayCardSelection", "pendingState", "recoverPendingActionFromOpenHistoryForAi",
]) {
  assert.equal(enumeratorModule.REQUIRED_CONTEXT_KEYS.includes(forbiddenKey), false);
}
assert.equal(new Set(enumeratorModule.REQUIRED_CONTEXT_KEYS).size, enumeratorModule.REQUIRED_CONTEXT_KEYS.length);

function createContext(overrides = {}) {
  const currentPlayer = {
    id: "player-blue",
    aiDifficulty: "laughable",
    resources: { score: 20, credits: 4, energy: 5, publicity: 2, availableData: 3 },
  };
  const context = Object.fromEntries(
    actionExecutor.REQUIRED_CONTEXT_KEYS.map((key) => [key, () => null]),
  );
  return {
    ...context,
    AI_DIFFICULTY_WEAK_START: "weak_start",
    FINAL_ROUND_NUMBER: 4,
    actions: {
      canExecute(actionId) {
        if (actionId === "launch") return { ok: true };
        if (actionId === "orbit") return { ok: true, planet: { planetId: "earth", name: "地球" } };
        if (actionId === "land") {
          return { ok: true, planet: { planetId: "mars", name: "火星" }, energyCost: 2, choices: ["slot-a"] };
        }
        if (actionId === "researchTech") return { ok: true, takeable: ["blue-1"] };
        return { ok: false, message: "disabled" };
      },
    },
    aiNumber: (value) => Number(value || 0),
    applyAiStrategyWeight: (value) => Number(value || 0),
    buildAiAnalyzeActionValueBreakdown: () => ({ score: 13, directScoreGain: 2, source: "legacy-analyze" }),
    buildAiIndustryCandidate: () => ({ id: "industry", kind: "quick", available: true, score: 8 }),
    buildAiResearchTechCandidate: (tileId) => ({
      id: "researchTech", tileId, available: true, score: 12, directScoreGain: 1, techType: "blue",
    }),
    buildAiScanActionTargetPreview: () => ({ sectorId: "sector-a" }),
    canAiAnalyzeData: () => ({ ok: true }),
    canStartMainAction: () => true,
    createActionContext: () => ({ actorId: currentPlayer.id }),
    getAiAnalyzeEnergyCost: () => 2,
    getAiBestLandDirectScoreGain: () => 4,
    getAiCardDisplayLabel: () => "测试牌",
    getAiNextMissingFinalScoreThreshold: () => 50,
    getAiOrbitDirectScoreGain: () => 3,
    getAiRoundNumber: () => 2,
    getAiScanDirectScoreGain: () => 2,
    getAiStrategyWeight: () => 1,
    getCurrentPlayer: () => currentPlayer,
    listAiCardCornerQuickCandidates: () => [{ id: "cardCorner", kind: "quick", available: true, score: 5 }],
    listAiDataPlacementCandidates: () => [{ id: "placeData", kind: "quick", available: true, score: 4 }],
    listAiEmergencyAnalyzeEnergyTradeCandidates: () => [{ id: "quickTrade", kind: "quick", tradeId: "energy", available: true, score: 7 }],
    listAiFinalAnalyzeEnergyTradeCandidates: () => [],
    listAiFinalReadyTaskCreditChainTradeCandidates: () => [],
    listAiLateResourceRecoveryTradeCandidates: () => [],
    listAiMainUnlockTradeCandidates: () => [],
    listAiMoveCandidates: () => [{
      id: "move", kind: "quick", rocketId: 3, deltaX: 1, deltaY: 0, available: true, gain: 11, cost: 2, score: 9,
    }],
    listAiPlayCardCandidates: () => [{
      id: "playCard", cardId: "card-a", cardInstanceId: "instance-a", available: true,
      score: 14, directScoreGain: 2, valueBreakdown: { endGameExpectedScore: 3 },
    }],
    listAiResourceLockMainUnlockTradeCandidates: () => [],
    listAiRunezuFaceSymbolQuickCandidates: () => [{ id: "runezuFaceSymbol", kind: "quick", available: true, score: 6 }],
    listAiThirdFinalMarkResourceTradeCandidates: () => [],
    roundAiScore: (value) => Number(value || 0),
    scanEffects: {
      canExecuteScan: () => ({ ok: true }),
      getStandardScanCost: () => ({ energy: 1 }),
    },
    scoreAiLandAction: () => 16,
    scoreAiLaunchTurnCandidateValue: () => ({ launchGain: 12, launchCost: 3, score: 9 }),
    scoreAiOrbitAction: () => 15,
    scoreAiPassAction: () => -2,
    scoreAiPostLaunchMovePlan: () => ({ score: 4, actionId: "move" }),
    scoreAiScanAction: () => 10,
    scoreAiScanEnergyReservationPenalty: () => 0,
    scoreAiScanPriorityFloor: () => 0,
    scoreAiWeakEarlyB2SetupScanTieBreak: () => 0,
    scoreAiWeakFinalB2TargetedScanTieBreak: () => 0,
    shouldAiProtectB2SectorScanFromPlanetCap: () => false,
    state: { pendingActionExecuted: false },
    turnState: { roundNumber: 2 },
    ...overrides,
  };
}

{
  const context = createContext();
  const direct = enumeratorModule.createTurnCandidateEnumerator(context).enumerateAiTurnActions();
  const throughExecutor = actionExecutor.createActionExecutor(context).enumerateAiTurnActions();
  assert.deepEqual(throughExecutor, direct, "Host 适配不得改变纯枚举结果");
  assert.deepEqual(direct.map((candidate) => candidate.id), [
    "launch", "orbit", "land", "researchTech", "scan", "analyze", "playCard", "move",
    "industry", "quickTrade", "placeData", "runezuFaceSymbol", "cardCorner", "pass",
  ]);
  assert.deepEqual(direct.find((candidate) => candidate.id === "launch").valueBreakdown, {
    launchGain: 12,
    launchCost: 3,
    launchReservePenalty: 0,
    postLaunchMovePlanScore: 4,
    lateLaunchPenalty: 0,
    extraLaunchPacePenalty: 0,
    finalSecondMarkExtraLaunchPenalty: 0,
    noRouteLaunchPenalty: 0,
    weakEarlyPostLaunchRoutePenalty: 0,
  });
  assert.equal(direct.find((candidate) => candidate.id === "move").score, 9);
  assert.equal(direct.find((candidate) => candidate.id === "playCard").score, 14);
  assert.equal(direct.find((candidate) => candidate.id === "quickTrade").score, 7);
}

{
  const context = createContext({
    state: { pendingActionExecuted: true },
    listAiLateResourceRecoveryTradeCandidates: () => [{ id: "quickTrade", score: 3 }],
  });
  const candidates = enumeratorModule.createTurnCandidateEnumerator(context).enumerateAiTurnActions();
  assert.deepEqual(candidates.map((candidate) => candidate.id), [
    "industry", "quickTrade", "move", "placeData", "runezuFaceSymbol", "cardCorner", "end-turn",
  ]);
}

console.log("turn-candidate-enumerator candidate parity tests passed");

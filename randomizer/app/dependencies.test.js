"use strict";

const assert = require("node:assert/strict");
const { collectDependencies } = require("./dependencies");

(() => {
  const source = {
    SetiAppAlienTraceRewardFlow: {},
    SetiAppActionRuntime: {},
    SetiPrimaryBoardActionExecutor: {},
    SetiAppActionInteractionRuntime: {},
    SetiAppActionLogRuntime: {},
    SetiAppGameRecovery: {},
    SetiAppRuntime: {},
    SetiAppRefresh: {},
    SetiAppRenderRuntime: {},
    SetiAppFinalUiRuntime: {},
    SetiAppFinalScoreAiRuntime: {},
    SetiAppStartScreen: {},
    SetiAppTurnFlow: {},
    SetiAppTurnEndFlow: {},
    SetiAppActionBriefing: {},
    SetiAppEffectFlow: {},
    SetiAppEffectChoiceFlow: {},
    SetiAppEffectMovementScanExecutors: {},
    SetiAppEffectRewardExecutors: {},
    SetiAppEffectAlienExecutors: {},
    SetiAppEffectDispatcher: {},
    SetiAppHandFlow: {},
    SetiAppScanFlow: {},
    SetiAppIncomeRuntime: {},
    SetiAppCardRuntime: {},
    SetiAppCardTriggerRuntime: {},
    SetiAppAlienRuntime: {},
    SetiAppAlienUi: {},
    SetiSolarSystem: {},
    SetiPlayers: {},
    SetiRocketActions: {},
    SetiPlanetStats: {},
    SetiPlanetReferenceLayout: {},
    SetiActionShared: {},
    SetiActions: {},
    SetiScanEffects: {},
    SetiPlanetRewards: {},
    SetiFinalScoring: {},
    SetiEndGameScoring: {},
    SetiActionHistory: {},
    SetiHistoryCommands: {},
    SetiHistoryTransactions: {},
    SetiAbilities: {},
    SetiQuickTrades: {},
    SetiBasicCards: {},
    SetiCards: {},
    SetiCardEffects: {},
    SetiCardTaskState: {},
    SetiTech: {},
    SetiData: {},
    SetiInitialCards: {},
    SetiIndustry: {},
    SetiAIValuation: {},
    SetiAIRaceModel: {},
    SetiAI: {},
    SetiAliens: {
      jiuzhe: {},
      yichangdian: {},
      fangzhou: {},
      banrenma: {},
      chong: {},
      amiba: {},
      aomomo: {},
      runezu: {},
    },
  };

  const dependencies = collectDependencies(source);
  assert.equal(dependencies.debugRuntimeModule, null);
  assert.deepEqual(dependencies.jiuzhe, {});

  console.log("dependencies tests passed");
})();

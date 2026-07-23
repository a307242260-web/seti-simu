(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppDependencies = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const REQUIRED_GLOBALS = Object.freeze([
    Object.freeze({ key: "alienTraceRewardFlow", globalName: "SetiAppAlienTraceRewardFlow" }),
    Object.freeze({ key: "actionRuntimeModule", globalName: "SetiAppActionRuntime" }),
    Object.freeze({ key: "primaryBoardActionExecutorModule", globalName: "SetiPrimaryBoardActionExecutor" }),
    Object.freeze({ key: "engineActionExecutorModule", globalName: "SetiEngineActionExecutor" }),
    Object.freeze({ key: "quickTurnActionExecutorModule", globalName: "SetiQuickTurnActionExecutor" }),
    Object.freeze({ key: "conditionalDecisionDomainModule", globalName: "SetiConditionalDecisionDomain" }),
    Object.freeze({ key: "conditionalActionExecutorModule", globalName: "SetiConditionalActionExecutor" }),
    Object.freeze({ key: "actionInteractionRuntimeModule", globalName: "SetiAppActionInteractionRuntime" }),
    Object.freeze({ key: "actionLogRuntimeModule", globalName: "SetiAppActionLogRuntime" }),
    Object.freeze({ key: "gameRecoveryModule", globalName: "SetiAppGameRecovery" }),
    Object.freeze({ key: "ruleCompositionModule", globalName: "SetiRuleComposition" }),
    Object.freeze({ key: "runtimeModule", globalName: "SetiAppRuntime" }),
    Object.freeze({ key: "refreshModule", globalName: "SetiAppRefresh" }),
    Object.freeze({ key: "renderRuntimeModule", globalName: "SetiAppRenderRuntime" }),
    Object.freeze({ key: "playerStatsUiModule", globalName: "SetiBrowserPlayerStatsUi" }),
    Object.freeze({ key: "debugRuntimeModule", globalName: "SetiAppDebugRuntime" }),
    Object.freeze({ key: "finalUiRuntimeModule", globalName: "SetiAppFinalUiRuntime" }),
    Object.freeze({ key: "finalScoreAiRuntimeModule", globalName: "SetiAppFinalScoreAiRuntime" }),
    Object.freeze({ key: "startScreenModule", globalName: "SetiAppStartScreen" }),
    Object.freeze({ key: "turnFlowModule", globalName: "SetiAppTurnFlow" }),
    Object.freeze({ key: "turnEndFlowModule", globalName: "SetiAppTurnEndFlow" }),
    Object.freeze({ key: "actionBriefingModule", globalName: "SetiAppActionBriefing" }),
    Object.freeze({ key: "effectFlowModule", globalName: "SetiAppEffectFlow" }),
    Object.freeze({ key: "effectChoiceFlowModule", globalName: "SetiAppEffectChoiceFlow" }),
    Object.freeze({ key: "effectMovementScanExecutorsModule", globalName: "SetiAppEffectMovementScanExecutors" }),
    Object.freeze({ key: "effectRewardExecutorsModule", globalName: "SetiAppEffectRewardExecutors" }),
    Object.freeze({ key: "effectAlienExecutorsModule", globalName: "SetiAppEffectAlienExecutors" }),
    Object.freeze({ key: "effectDispatcherModule", globalName: "SetiAppEffectDispatcher" }),
    Object.freeze({ key: "handFlowModule", globalName: "SetiAppHandFlow" }),
    Object.freeze({ key: "scanFlowModule", globalName: "SetiAppScanFlow" }),
    Object.freeze({ key: "incomeRuntimeModule", globalName: "SetiAppIncomeRuntime" }),
    Object.freeze({ key: "cardRuntimeModule", globalName: "SetiAppCardRuntime" }),
    Object.freeze({ key: "cardTriggerRuntimeModule", globalName: "SetiAppCardTriggerRuntime" }),
    Object.freeze({ key: "alienRuntimeModule", globalName: "SetiAppAlienRuntime" }),
    Object.freeze({ key: "scoreSourceRuntimeModule", globalName: "SetiAppScoreSourceRuntime" }),
    Object.freeze({ key: "alienUiModule", globalName: "SetiAppAlienUi" }),
    Object.freeze({ key: "browserHostModule", globalName: "SetiBrowserHost" }),
    Object.freeze({ key: "aiControlRuntimeModule", globalName: "SetiAppAiControlRuntime" }),
    Object.freeze({ key: "solar", globalName: "SetiSolarSystem" }),
    Object.freeze({ key: "players", globalName: "SetiPlayers" }),
    Object.freeze({ key: "rocketActions", globalName: "SetiRocketActions" }),
    Object.freeze({ key: "planetStats", globalName: "SetiPlanetStats" }),
    Object.freeze({ key: "planetReferenceLayout", globalName: "SetiPlanetReferenceLayout" }),
    Object.freeze({ key: "actionShared", globalName: "SetiActionShared" }),
    Object.freeze({ key: "actions", globalName: "SetiActions" }),
    Object.freeze({ key: "scanEffects", globalName: "SetiScanEffects" }),
    Object.freeze({ key: "planetRewards", globalName: "SetiPlanetRewards" }),
    Object.freeze({ key: "finalScoring", globalName: "SetiFinalScoring" }),
    Object.freeze({ key: "endGameScoring", globalName: "SetiEndGameScoring" }),
    Object.freeze({ key: "actionHistoryModule", globalName: "SetiActionHistory" }),
    Object.freeze({ key: "historyCommands", globalName: "SetiHistoryCommands" }),
    Object.freeze({ key: "historyTransactions", globalName: "SetiHistoryTransactions" }),
    Object.freeze({ key: "abilities", globalName: "SetiAbilities" }),
    Object.freeze({ key: "quickTrades", globalName: "SetiQuickTrades" }),
    Object.freeze({ key: "basicCards", globalName: "SetiBasicCards" }),
    Object.freeze({ key: "cards", globalName: "SetiCards" }),
    Object.freeze({ key: "cardEffects", globalName: "SetiCardEffects" }),
    Object.freeze({ key: "cardTaskStateModule", globalName: "SetiCardTaskState" }),
    Object.freeze({ key: "tech", globalName: "SetiTech" }),
    Object.freeze({ key: "data", globalName: "SetiData" }),
    Object.freeze({ key: "aliens", globalName: "SetiAliens" }),
    Object.freeze({ key: "initialCards", globalName: "SetiInitialCards" }),
    Object.freeze({ key: "industry", globalName: "SetiIndustry" }),
    Object.freeze({ key: "aiValuation", globalName: "SetiAIValuation" }),
    Object.freeze({ key: "aiRaceModel", globalName: "SetiAIRaceModel" }),
    Object.freeze({ key: "ai", globalName: "SetiAI" }),
  ]);
  function collectDependencies(source = root) {
    const dependencies = {};
    const missing = [];

    for (const entry of REQUIRED_GLOBALS) {
      const value = source[entry.globalName];
      if (!value) {
        missing.push(entry.globalName);
      }
      dependencies[entry.key] = value;
    }

    if (missing.length) {
      throw new Error(`Missing SETI app dependencies: ${missing.join(", ")}`);
    }

    const aliens = dependencies.aliens;
    return {
      ...dependencies,
      jiuzhe: aliens.jiuzhe,
      yichangdian: aliens.yichangdian,
      fangzhou: aliens.fangzhou,
      banrenma: aliens.banrenma,
      chong: aliens.chong,
      amiba: aliens.amiba,
      aomomo: aliens.aomomo,
      runezu: aliens.runezu,
    };
  }

  return {
    collectDependencies,
  };
});

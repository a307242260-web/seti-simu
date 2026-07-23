"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { collectDependencies } = require("./dependencies");

(() => {
  const source = {
    SetiAppAlienTraceRewardFlow: {},
    SetiAppActionRuntime: {},
    SetiPrimaryBoardActionExecutor: {},
    SetiEngineActionExecutor: {},
    SetiQuickTurnActionExecutor: {},
    SetiConditionalDecisionDomain: {},
    SetiConditionalActionExecutor: {},
    SetiAppActionInteractionRuntime: {},
    SetiAppActionLogRuntime: {},
    SetiAppGameRecovery: {},
    SetiRuleComposition: {},
    SetiAppRuntime: {},
    SetiAppRefresh: {},
    SetiAppRenderRuntime: {},
    SetiBrowserPlayerStatsUi: {},
    SetiAppDebugRuntime: {},
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
    SetiAppScoreSourceRuntime: {},
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
  assert.deepEqual(dependencies.debugRuntimeModule, {});
  assert.deepEqual(dependencies.jiuzhe, {});

  console.log("dependencies tests passed");
})();

(() => {
  const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const forbiddenDomImplementation = [
    /document\.(?:createElement|querySelector|addEventListener)/,
    /\.addEventListener\(/,
    /\.(?:innerHTML|textContent)\s*=/,
    /\.replaceChildren\(/,
    /\.classList\./,
    /\.hidden\s*=/,
  ];
  for (const pattern of forbiddenDomImplementation) {
    assert.doesNotMatch(appSource, pattern, `app.js 只能连接 DOM，不得保留生产 DOM 实现：${pattern}`);
  }
  assert.doesNotMatch(appSource, /context\.simulation|simulationMode/, "Browser app 不得用 simulation/no-op 分支伪装共享 runtime");
  assert.match(appSource, /createBrowserInputAdapter\(/, "Browser 输入必须由 Browser Host adapter 装配");
  assert.match(appSource, /createBrowserWorkingStateAdapter\(/, "working state 只能由窄 adapter 装配");
  assert.match(appSource, /createPendingSubFlowRuntime\(/, "待决子流程必须由 effect runtime 聚合");
  const topLevelFunctions = appSource.match(/^  (?:async )?function [A-Za-z0-9_]+/gm) || [];
  assert.ok(topLevelFunctions.length <= 100, `app.js 顶层实现函数反弹：${topLevelFunctions.length}`);
})();

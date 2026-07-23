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
    SetiBrowserHost: {},
    SetiAppAiControlRuntime: {},
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
  const randomizerRoot = path.join(__dirname, "..");
  const indexSource = fs.readFileSync(path.join(randomizerRoot, "index.html"), "utf8");
  const scriptPaths = [...indexSource.matchAll(/<script\s+src="\.\/([^"?]+)(?:\?[^"\s]*)?"/g)]
    .map((match) => match[1]);
  assert.equal(new Set(scriptPaths).size, scriptPaths.length, "index.html 不得重复加载脚本");
  for (const relative of scriptPaths) {
    assert.equal(fs.existsSync(path.join(randomizerRoot, relative)), true, `index.html 脚本不存在: ${relative}`);
  }

  const browserSources = new Map(scriptPaths
    .filter((relative) => relative.endsWith(".js"))
    .map((relative) => [relative, fs.readFileSync(path.join(randomizerRoot, relative), "utf8")]));
  for (const [relative, source] of browserSources) {
    for (const match of source.matchAll(/root\.(Seti[A-Za-z0-9_$]+)\s*=\s*api/g)) {
      const globalName = match[1];
      const callers = [...browserSources]
        .filter(([candidate, candidateSource]) => candidate !== relative && candidateSource.includes(globalName));
      assert.ok(callers.length > 0, `生产全局 export 无 caller: ${globalName} (${relative})`);
    }
  }

  for (const removed of ["app/view-adapter.js", "app/effect-session-host.js"]) {
    assert.equal(fs.existsSync(path.join(randomizerRoot, removed)), false, `旧实现必须物理删除: ${removed}`);
    assert.equal(scriptPaths.includes(removed), false, `index.html 不得加载旧实现: ${removed}`);
  }
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
  assert.doesNotMatch(appSource, /^  function\s+/m, "app.js 不得保留顶层领域/UI/流程函数体");
  assert.doesNotMatch(appSource, /executeHostCommand\([^)]*\)\s*\{[\s\S]*?switch\s*\(/, "Host command 分发必须归 Browser Host dispatcher");
  assert.match(appSource, /createHostCommandDispatcher\(/, "app.js 必须只装配 Browser Host command dispatcher");
  assert.match(appSource, /continuation:\s*standardActionContinuation/, "Standard Action continuation 必须由独立 runtime 提供");
  for (const migratedResponsibility of [
    "submitActiveCardDecision",
    "runPlaceDataToComputerForRoot",
    "analyzeDataForCurrentPlayer",
    "canAnalyzeDataForPlayer",
    "getAnalyzeActionOptionsForPlayer",
    "startAnalyzeDataRewardFlow",
    "resumeLandTargetContinuation",
    "confirmLandTargetChoiceForRoot",
    "getSimulationConditionalPlayer",
    "executeIncomeForCurrentPlayerForRoot",
  ]) {
    assert.doesNotMatch(
      appSource,
      new RegExp(`function ${migratedResponsibility}\\b`),
      `app.js 不得按函数数豁免已归属领域 owner 的实现：${migratedResponsibility}`,
    );
  }
})();

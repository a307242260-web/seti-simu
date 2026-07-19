(function () {
  "use strict";

  const output = document.querySelector("#result");
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  try {
    assert(SetiBrowserHost.SCHEMA_VERSION === "seti-browser-host-v1", "facade schema 错误");
    const dependencySource = new Proxy({}, {
      get(_target, globalName) {
        if (globalName === "SetiBrowserHost") return SetiBrowserHost;
        if (globalName === "SetiAliens") {
          return { jiuzhe: {}, yichangdian: {}, fangzhou: {}, banrenma: {}, chong: {}, amiba: {}, aomomo: {}, runezu: {} };
        }
        return {};
      },
    });
    const dependencies = SetiAppDependencies.collectDependencies(dependencySource);
    assert(dependencies.browserHostModule === SetiBrowserHost, "dependencies 未收集 Browser Host facade");
    const state = SetiStateStore.createCommittedGameState({
      gameId: "seti-73-smoke",
      rulesetVersion: "prototype-2026-07",
      seed: 73,
      rngState: { hiddenCanary: "browser-hidden" },
      sequences: {},
      match: { status: "playing" },
      turn: { round: 1, turn: 1, currentPlayerId: "p1" },
      players: { p1: { id: "p1", resources: { credits: 4 } } },
      solarSystem: { rotation: 0 }, pieces: {}, planets: {}, data: {},
      cards: { hands: { p1: ["own-card"] }, deck: ["hidden-deck-card"] },
      tech: {}, aliens: {}, finalScoring: {},
    });
    const store = SetiStateStore.createStateStore(state);
    const projection = SetiBrowserHost.projectionAdapter.createBrowserProjectionAdapter({ stateStore: store })
      .projectCommitted({ viewer: { viewerId: "chrome-p1", playerId: "p1", role: "player" } });
    const viewStore = SetiBrowserHost.viewStateStore.createViewStateStore();
    const calls = [];
    const input = SetiBrowserHost.inputAdapter.createBrowserInputAdapter({
      dispatchAction(action) { calls.push(["action", action]); return { ok: true }; },
      submitDecision(decision) { calls.push(["decision", decision]); return { ok: true }; },
      viewStateStore: viewStore,
    });
    input.dispatchIntent({ kind: "view", type: "overlay.set", activeId: "reference" });
    assert(projection.cards.hand[0] === "own-card", "玩家手牌投影失败");
    assert(!JSON.stringify(projection).includes("hidden-deck-card"), "投影泄漏 deck order");
    assert(Object.isFrozen(projection.cards), "投影未深冻结");
    assert(input.inspectInputState().viewState.overlay.activeId === "reference", "view intent 路由失败");
    assert(calls.length === 0, "view intent 进入规则端口");
    const residentRoot = document.createElement("section");
    const round = document.createElement("span");
    const turn = document.createElement("span");
    const stats = document.createElement("div");
    const opponents = document.createElement("div");
    const market = document.createElement("div");
    const tokens = document.createElement("div");
    residentRoot.append(round, turn, stats, opponents, market, tokens);
    document.body.append(residentRoot);
    const residentProjection = SetiBrowserHost.residentProjection.createResidentProjection({
      projectionId: "chrome-resident",
      viewerPlayer: { id: "p1", name: "一号", resources: { credits: 4 }, hand: [] },
      playerState: { currentPlayerId: "p1", players: [{ id: "p1", name: "一号", resources: { credits: 4 }, hand: [] }] },
      turnState: { roundNumber: 2 }, displayedTurn: 3,
      cardState: { publicCards: [{ id: "public", cardName: "公开牌", src: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" }] },
      rocketState: { rockets: [{ id: "r1", playerId: "p1", x: 1, y: 2 }] },
    });
    SetiBrowserHost.residentRenderer.createResidentRenderer({
      document,
      els: { roundStatusRound: round, roundStatusTurn: turn, playerStats: stats, opponentStatGrid: opponents, publicCardRow: market, tokenLayer: tokens },
    }).renderAll({ projection: residentProjection, viewState: viewStore.getSnapshot() });
    assert(round.textContent === "第 2 轮" && turn.textContent === "第 3 回合", "常驻 round/turn renderer 失败");
    assert(market.querySelector("[data-card-id='public']"), "常驻公共牌 renderer 失败");
    assert(tokens.querySelector("[data-piece-id='r1']"), "常驻太阳系 renderer 失败");
    const actionBarRoot = document.createElement("nav");
    document.body.append(actionBarRoot);
    const actionCalls = [];
    const actionBarController = SetiBrowserHost.actionBar.createActionBarController({
      dispatchIntent(intent) { actionCalls.push(intent); return { ok: true }; },
      dispatchUndo(command) { actionCalls.push({ kind: "undo", command }); return { ok: true }; },
    });
    const actionBarRenderer = SetiBrowserHost.actionBar.createActionBarRenderer({
      document, root: actionBarRoot, controller: actionBarController,
    });
    actionBarRenderer.render({
      projectionId: "chrome-action-bar",
      source: { kind: "session", sessionId: "chrome-s1", sessionRevision: 9 },
      controls: {
        actions: [
          { schemaVersion: "seti-standard-action-v1", actionId: "launch:chrome", family: "launch", phase: "main", summary: "发射" },
          { schemaVersion: "seti-standard-action-v1", actionId: "pass:chrome", family: "pass", phase: "main", summary: "PASS" },
          { schemaVersion: "seti-standard-action-v1", actionId: "end_turn:chrome", family: "end_turn", phase: "control", summary: "结束回合", disabledReason: "效果未完成" },
        ],
        quickActions: [{ schemaVersion: "seti-standard-action-v1", actionId: "quick_trade:chrome", family: "quick_trade", phase: "quick", summary: "快速交易" }],
        canUndo: true,
      },
      feedback: { progress: { completedEffects: 1, remainingEffects: 1, totalEffects: 2, currentEffectType: "choose-tech" } },
    });
    actionBarRoot.querySelector("[data-action-id='launch:chrome']").click();
    actionBarRoot.querySelector("[data-action-bar-intent='undo']").click();
    assert(actionCalls[0].action.actionId === "launch:chrome", "主行动未提交原 Standard Action");
    assert(actionCalls[1].command.sessionRevision === 9, "撤销未携带 session identity");
    assert(actionBarRoot.querySelector("[data-action-id='end_turn:chrome']").disabled, "结束回合 disabled reason 丢失");
    assert(actionBarRoot.querySelector("[data-action-bar-progress]").textContent.includes("1/2"), "Effect 进度映射失败");
    document.body.dataset.result = "passed";
    output.textContent = JSON.stringify({ ok: true, projectionId: projection.projectionId });
  } catch (error) {
    document.body.dataset.result = "failed";
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
  }
})();

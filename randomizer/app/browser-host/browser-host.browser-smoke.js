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
    document.body.dataset.result = "passed";
    output.textContent = JSON.stringify({ ok: true, projectionId: projection.projectionId });
  } catch (error) {
    document.body.dataset.result = "failed";
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
  }
})();

(function () {
  "use strict";

  const output = document.querySelector("#result");

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function createState() {
    return SetiStateStore.createCommittedGameState({
      gameId: "stage6-browser-smoke",
      rulesetVersion: "prototype-2026-07",
      seed: 86,
      rngState: { algorithm: "fixture", cursor: 0, state: 86 },
      sequences: {},
      match: { status: "playing" },
      turn: { round: 1, turn: 1, currentPlayerId: "p1" },
      players: { p1: { resources: { credits: 4 }, techTileIds: [] } },
      solarSystem: {},
      pieces: {},
      planets: {},
      data: {},
      cards: { discardPile: [] },
      tech: { supply: { orange: ["orange-1"] } },
      aliens: {},
      finalScoring: {},
    });
  }

  try {
    const store = SetiStateStore.createStateStore(createState());
    const commitEvents = [];
    store.subscribe((event) => commitEvents.push(event));
    const runtime = SetiEffectSession.createRuntime({ stateStore: store });
    runtime.registerExecutor("research", (state) => {
      state.players.p1.resources.credits -= 2;
      state.players.p1.techTileIds.push("orange-1");
      state.tech.supply.orange = [];
      state.cards.discardPile.push("research-reward");
      return { ok: true, nextState: state, events: [{ type: "research-completed" }] };
    });
    const dispatched = runtime.dispatchStoredAction(
      { family: "research_tech", actorId: "p1" },
      () => ({ effects: [{ type: "research" }] }),
      { sessionId: "browser-stage6" },
    );
    assert(store.getSnapshot().players.p1.resources.credits === 4, "drain 前污染 committed state");
    assert(runtime.drain(dispatched.session).ok, "session drain 失败");
    const committed = store.getSnapshot();
    assert(dispatched.session.phase === "completed", "session 未完成");
    assert(committed.meta.stateVersion === 1, "StateStore version 未递增");
    assert(committed.players.p1.resources.credits === 2, "玩家切片未提交");
    assert(committed.players.p1.techTileIds[0] === "orange-1", "科技归属未提交");
    assert(committed.tech.supply.orange.length === 0, "科技供应未提交");
    assert(committed.cards.discardPile[0] === "research-reward", "奖励牌未提交");
    assert(commitEvents.length === 1, "commit event 数量错误");
    assert(JSON.stringify(commitEvents[0].metadata.journal) === JSON.stringify(dispatched.session.journal),
      "commit event 与 session journal 不一致");
    document.body.dataset.result = "passed";
    output.textContent = JSON.stringify({ ok: true, version: committed.meta.stateVersion });
  } catch (error) {
    document.body.dataset.result = "failed";
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
  }
})();

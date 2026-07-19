(function () {
  "use strict";
  const output = document.getElementById("result");
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    const initial = SetiStateStore.createCommittedGameState({
      gameId: "browser-services-smoke", rulesetVersion: "v1", seed: 81,
      rngState: {}, sequences: {}, match: {}, turn: {}, players: {}, solarSystem: {},
      pieces: {}, planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
    });
    const store = SetiStateStore.createStateStore(initial);
    const view = SetiBrowserViewStateStore.createViewStateStore();
    view.dispatch({ type: "overlay.set", activeId: "recovery" });
    let restored = null;
    const services = SetiBrowserServices.createBrowserServices({
      stateStore: store,
      stateRestorePort: { restore(state) { restored = structuredClone(state); return { ok: true }; } },
      viewStateStore: view,
      storage: localStorage,
      downloadPort: { save() { return { ok: true }; } },
      debugCommandPort: { dispatch(command) { return { ok: command.type === "failsafe.pause" }; } },
    });
    const saved = services.save();
    view.clear();
    const loaded = services.load();
    assert(saved.ok && loaded.ok, "local persistence round-trip 失败");
    assert(restored?.meta?.gameId === "browser-services-smoke", "StateStore restore port 未收到 committed state");
    assert(view.getSnapshot().overlay.activeId === "recovery", "ViewState 独立恢复失败");
    const facade = services.createPublicFacade();
    assert(Object.isFrozen(facade) && !facade.stateStore, "public facade 泄漏 mutable authority");
    assert(facade.dispatchDeveloperCommand({ type: "failsafe.pause" }).ok, "debug command port 失败");
    document.body.dataset.result = "passed";
    output.textContent = JSON.stringify({ ok: true, stateVersion: loaded.stateVersion, view: "recovery", facadeFrozen: true });
  } catch (error) {
    document.body.dataset.result = "failed";
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
  }
})();

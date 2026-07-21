(function () {
  "use strict";
  const output = document.getElementById("result");
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    const reloadMarkerKey = "seti-browser-services-smoke-reload";
    const reloaded = localStorage.getItem(reloadMarkerKey) === "pending";
    const initial = SetiStateStore.createCommittedGameState({
      gameId: reloaded ? "browser-services-reloaded" : "browser-services-smoke",
      rulesetVersion: "v1", seed: 81,
      rngState: {}, sequences: {}, match: {}, turn: {}, players: {}, solarSystem: {},
      pieces: {}, planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
    });
    const store = SetiStateStore.createStateStore(initial);
    const view = SetiBrowserViewStateStore.createViewStateStore();
    const services = SetiBrowserServices.createBrowserServices({
      stateStore: store,
      viewStateStore: view,
      storage: localStorage,
      downloadPort: { save() { return { ok: true }; } },
      debugCommandPort: { dispatch(command) { return { ok: command.type === "failsafe.pause" }; } },
    });
    if (!reloaded) {
      view.dispatch({ type: "overlay.set", activeId: "recovery" });
      const saved = services.save();
      assert(saved.ok, "local persistence save 失败");
      localStorage.setItem(reloadMarkerKey, "pending");
      location.reload();
      return;
    }
    const loaded = services.load();
    localStorage.removeItem(reloadMarkerKey);
    assert(loaded.ok, "刷新后的 local persistence load 失败");
    assert(store.getSnapshot().meta.gameId === "browser-services-smoke", "刷新后 resident StateStore 未原位恢复 committed state");
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

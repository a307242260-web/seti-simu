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
    const timer = SetiBrowserServices.createTimerService({
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      requestAnimationFrame: window.requestAnimationFrame.bind(window),
      cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    });
    const storage = SetiBrowserServices.createStorageService({
      storage: localStorage,
      storageKey: "seti-browser-services-smoke",
    });
    const services = SetiBrowserServices.createBrowserServices({
      storageService: storage,
      timerService: timer,
      focusService: SetiBrowserServices.createFocusService({ timerService: timer }),
    });
    const checkpoint = SetiAppGameRecovery.createBrowserCheckpointAdapter({
      viewStateStore: view,
      viewSchemaVersion: SetiBrowserViewStateStore.SCHEMA_VERSION,
      ruleLifecycle: {
        save() {
          const serialized = store.serialize();
          return serialized.ok ? {
            ok: true,
            envelope: {
              schemaVersion: "seti-rule-composition-save-v1",
              committedState: serialized.serialized,
              session: null,
            },
          } : serialized;
        },
        validateRestore(envelope) {
          if (envelope?.schemaVersion !== "seti-rule-composition-save-v1") {
            return { ok: false, code: "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED" };
          }
          return store.deserialize(envelope.committedState);
        },
        restore(envelope) {
          const loaded = this.validateRestore(envelope);
          if (!loaded.ok) return loaded;
          const restored = store.restore(loaded.state);
          return restored.ok
            ? { ok: true, projection: { stateVersion: restored.stateVersion } }
            : restored;
        },
      },
    });
    if (!reloaded) {
      view.dispatch({ type: "overlay.set", activeId: "recovery" });
      const captured = checkpoint.capture();
      assert(captured.ok && services.storage.write(captured.envelope).ok, "local persistence save 失败");
      localStorage.setItem(reloadMarkerKey, "pending");
      location.reload();
      return;
    }
    const loaded = services.storage.read();
    assert(loaded.ok, "刷新后的 local persistence read 失败");
    const restored = checkpoint.restore(loaded.value);
    localStorage.removeItem(reloadMarkerKey);
    assert(restored.ok, "刷新后的 lifecycle restore 失败");
    assert(store.getSnapshot().meta.gameId === "browser-services-smoke", "正式 lifecycle 未恢复 committed state");
    assert(view.getSnapshot().overlay.activeId === "recovery", "ViewState 独立恢复失败");
    assert(!services.capture && !services.restore && !services.dispatchDeveloperCommand, "service 泄漏规则/command authority");
    document.body.dataset.result = "passed";
    output.textContent = JSON.stringify({
      ok: true,
      stateVersion: restored.stateVersion,
      view: "recovery",
      servicesIsolated: true,
    });
  } catch (error) {
    document.body.dataset.result = "failed";
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
  }
})();

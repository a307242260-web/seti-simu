(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppBrowserStateAuthority = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function clone(value) {
    return structuredClone(value);
  }

  function replaceMutableObject(target, source) {
    for (const key of Reflect.ownKeys(target || {})) delete target[key];
    Object.assign(target, clone(source || {}));
    return target;
  }

  function requireFunction(value, label) {
    if (typeof value !== "function") throw new TypeError(`BrowserStateAuthority 缺少 ${label}`);
    return value;
  }

  function createBrowserStateAuthority(options = {}) {
    const modules = options.modules || {};
    const stateStoreApi = modules.stateStore;
    const highCouplingState = modules.highCouplingState;
    const initialGameState = modules.initialGameState;
    const runtimeAuthority = modules.runtimeAuthority;
    requireFunction(initialGameState?.createSessionState, "InitialGameState.createSessionState");
    requireFunction(initialGameState?.createCommittedCandidate, "InitialGameState.createCommittedCandidate");
    requireFunction(initialGameState?.restoreSessionState, "InitialGameState.restoreSessionState");
    requireFunction(runtimeAuthority?.create, "RuntimeAuthority.create");
    requireFunction(highCouplingState?.createHighCouplingStateStore, "createHighCouplingStateStore");
    requireFunction(highCouplingState?.purifyHighCouplingSlices, "purifyHighCouplingSlices");

    let contextProvider = () => ({});
    const listeners = new Set();
    let unsubscribeStore = null;
    let store = null;
    const sessionState = initialGameState.createSessionState(modules, options);
    const activeSession = {
      schemaVersion: "seti-browser-rule-session-v1",
      phase: "open",
      baseVersion: 0,
      workingState: sessionState,
    };

    function candidate(overrides = {}) {
      const context = { ...contextProvider(), ...overrides };
      const currentVersion = store?.getSnapshot?.().meta.stateVersion ?? activeSession.baseVersion;
      return highCouplingState.purifyHighCouplingSlices(initialGameState.createCommittedCandidate(
        sessionState,
        context,
        stateStoreApi.SCHEMA_VERSION,
        currentVersion,
      ));
    }

    function forwardStoreEvents() {
      unsubscribeStore?.();
      unsubscribeStore = store.subscribe((event) => {
        for (const listener of [...listeners]) listener(event);
      });
    }

    function installStore(value) {
      store = runtimeAuthority.create(highCouplingState, value);
      activeSession.baseVersion = store.getSnapshot().meta.stateVersion;
      forwardStoreEvents();
      sessionState.meta = clone(store.getSnapshot().meta);
      return store;
    }

    installStore(candidate());

    function settle(metadata = null, overrides = {}) {
      const before = store.getSnapshot();
      const next = candidate(overrides);
      next.meta.stateVersion = before.meta.stateVersion;
      const beforeSerialized = store.serialize(before);
      const nextSerialized = store.serialize(next);
      if (beforeSerialized.ok && nextSerialized.ok
        && beforeSerialized.serialized === nextSerialized.serialized) {
        return { ok: true, noop: true, previousVersion: before.meta.stateVersion, stateVersion: before.meta.stateVersion, snapshot: before };
      }
      const result = store.compareAndCommit(before.meta.stateVersion, next, metadata);
      if (result.ok) {
        activeSession.baseVersion = result.stateVersion;
        sessionState.meta = clone(result.snapshot.meta);
      }
      return result;
    }

    function serialize(overrides = {}) {
      const settled = settle({ source: "browser-stable-boundary" }, overrides);
      return settled.ok ? store.serialize() : settled;
    }

    function resetSession(resetOptions = {}) {
      const next = initialGameState.createSessionState(modules, {
        defaultInitialPlayerColor: resetOptions.defaultInitialPlayerColor ?? options.defaultInitialPlayerColor,
        activePlayerCount: resetOptions.activePlayerCount ?? options.activePlayerCount,
        finalScoreIds: resetOptions.finalScoreIds ?? options.finalScoreIds,
      });
      for (const key of Object.keys(next)) {
        if (key === "meta") continue;
        replaceMutableObject(sessionState[key], next[key]);
      }
      return settle({ source: "browser-new-game" }, resetOptions);
    }

    function restore(candidateState, metadata = null) {
      const restored = store.restore(candidateState, metadata);
      if (!restored.ok) return restored;
      initialGameState.restoreSessionState(sessionState, restored.snapshot, replaceMutableObject);
      activeSession.baseVersion = restored.stateVersion;
      return restored;
    }

    function runTransaction(mutator, transactionOptions = {}) {
      requireFunction(mutator, "transaction mutator");
      const beforeBytes = store.serialize();
      const transaction = store.beginWorkingCopy(activeSession.baseVersion);
      if (!transaction.ok) return transaction;
      const baseVersion = transaction.baseVersion;
      const beforeSession = clone(sessionState);
      const journal = transactionOptions.journal || null;
      const journalBefore = journal && typeof journal.snapshot === "function" ? journal.snapshot() : null;
      try {
        mutator(sessionState);
      } catch (error) {
        for (const key of Object.keys(beforeSession)) {
          if (key === "meta") sessionState.meta = beforeSession.meta;
          else replaceMutableObject(sessionState[key], beforeSession[key]);
        }
        if (journalBefore != null && typeof journal.restore === "function") journal.restore(journalBefore);
        return { ok: false, code: "BROWSER_STATE_MUTATOR_FAILED", message: error?.message || "Browser state mutator 失败" };
      }
      const result = settle(transactionOptions.metadata || { source: "browser-transaction" });
      if (!result.ok) {
        for (const key of Object.keys(beforeSession)) {
          if (key === "meta") sessionState.meta = beforeSession.meta;
          else replaceMutableObject(sessionState[key], beforeSession[key]);
        }
        if (journalBefore != null && typeof journal.restore === "function") journal.restore(journalBefore);
        const afterBytes = store.serialize();
        if (beforeBytes.ok && afterBytes.ok && beforeBytes.serialized !== afterBytes.serialized) {
          throw new Error("BrowserStateAuthority 原子失败污染 committed bytes");
        }
      }
      if (result.ok && result.previousVersion != null && result.previousVersion !== baseVersion) {
        throw new Error("BrowserStateAuthority transaction baseVersion 漂移");
      }
      return result;
    }

    return Object.freeze({
      SCHEMA_VERSION: stateStoreApi.SCHEMA_VERSION,
      getActiveSession: () => activeSession,
      getSnapshot: store.getSnapshot.bind(store),
      beginWorkingCopy: store.beginWorkingCopy.bind(store),
      compareAndCommit: store.compareAndCommit.bind(store),
      validate: store.validate.bind(store),
      deserialize: store.deserialize.bind(store),
      restore,
      serialize,
      subscribe(listener) {
        requireFunction(listener, "subscriber");
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      setContextProvider(provider) {
        contextProvider = requireFunction(provider, "context provider");
      },
      settle,
      resetSession,
      runTransaction,
    });
  }

  return Object.freeze({ createBrowserStateAuthority, replaceMutableObject });
});

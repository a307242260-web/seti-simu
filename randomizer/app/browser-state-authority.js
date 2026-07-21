(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppBrowserStateAuthority = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const RULE_SAVE_SCHEMA_VERSION = "seti-browser-rule-composition-save-v1";

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
      const hydratedSession = clone(sessionState);
      initialGameState.restoreSessionState(hydratedSession, candidateState, replaceMutableObject);
      const restored = store.restore(candidateState, metadata);
      if (!restored.ok) return restored;
      for (const key of Object.keys(hydratedSession)) {
        if (key === "meta") sessionState.meta = clone(hydratedSession.meta);
        else replaceMutableObject(sessionState[key], hydratedSession[key]);
      }
      activeSession.baseVersion = restored.stateVersion;
      return restored;
    }

    function saveLifecycle(overrides = {}) {
      const serialized = serialize(overrides);
      if (!serialized.ok) return serialized;
      return {
        ok: true,
        envelope: {
          schemaVersion: RULE_SAVE_SCHEMA_VERSION,
          committedState: serialized.serialized,
          session: null,
        },
      };
    }

    function validateLifecycleRestore(envelope) {
      if (!envelope || envelope.schemaVersion !== RULE_SAVE_SCHEMA_VERSION) {
        return { ok: false, code: "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED", message: "旧版或未知 Browser 存档 schema 被拒绝" };
      }
      const allowedKeys = ["schemaVersion", "committedState", "session"];
      const unknownKeys = Object.keys(envelope).filter((key) => !allowedKeys.includes(key));
      if (unknownKeys.length) {
        return { ok: false, code: "RULE_COMPOSITION_SAVE_FIELDS_UNSUPPORTED", message: "Browser 规则存档包含未知字段", unknownKeys };
      }
      if (envelope.session != null) {
        return { ok: false, code: "RULE_COMPOSITION_SESSION_SCHEMA_UNSUPPORTED", message: "当前规则 lifecycle 不接受外置 Session checkpoint" };
      }
      if (typeof envelope.committedState !== "string") {
        return { ok: false, code: "RULE_COMPOSITION_COMMITTED_STATE_MISSING", message: "Browser 规则存档缺少 committedState" };
      }
      const loaded = store.deserialize(envelope.committedState);
      return loaded.ok ? { ok: true, state: loaded.state, session: null } : loaded;
    }

    function restoreLifecycle(envelope) {
      const validated = validateLifecycleRestore(envelope);
      if (!validated.ok) return validated;
      const restored = restore(validated.state, { source: "browser-rule-lifecycle" });
      return restored.ok
        ? { ok: true, projection: { phase: "idle", stateVersion: restored.stateVersion } }
        : restored;
    }

    const lifecycle = Object.freeze({
      newGame: resetSession,
      save: saveLifecycle,
      validateRestore: validateLifecycleRestore,
      restore: restoreLifecycle,
    });

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
      RULE_SAVE_SCHEMA_VERSION,
      lifecycle,
      getActiveSession: () => activeSession,
      getSnapshot: store.getSnapshot.bind(store),
      subscribe(listener) {
        requireFunction(listener, "subscriber");
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      setContextProvider(provider) {
        contextProvider = requireFunction(provider, "context provider");
      },
      settle,
      runTransaction,
    });
  }

  return Object.freeze({ createBrowserStateAuthority, replaceMutableObject });
});

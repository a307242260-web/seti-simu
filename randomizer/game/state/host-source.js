(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiHostStateSource = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const ACTIVE_SESSION_PHASES = new Set([
    "created", "running", "awaiting_input", "committing", "irreversible_locked",
  ]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value, seen = new WeakSet()) {
    if (value == null || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
    return Object.freeze(value);
  }

  function requireFunction(source, key, owner) {
    if (typeof source?.[key] !== "function") throw new TypeError(`${owner} 缺少 ${key}()`);
    return source[key].bind(source);
  }

  function createHostStateSource(options = {}) {
    const stateStore = options.stateStore;
    const getSnapshot = requireFunction(stateStore, "getSnapshot", "Host StateSource StateStore");
    const subscribeStore = requireFunction(stateStore, "subscribe", "Host StateSource StateStore");
    const getSession = typeof options.getSession === "function" ? options.getSession : () => null;
    const inspectSession = typeof options.inspectSession === "function" ? options.inspectSession : null;
    const observeSession = typeof options.observeSession === "function" ? options.observeSession : null;

    function read(viewer = null) {
      const session = getSession();
      const inspected = session && inspectSession ? inspectSession(session) : null;
      if (session && inspected && ACTIVE_SESSION_PHASES.has(inspected.phase)) {
        if (!observeSession) throw new TypeError("Host StateSource 活跃 session 缺少 observeSession()");
        const observed = observeSession(session, viewer);
        if (!observed || !Object.hasOwn(observed, "state")) {
          throw new TypeError("Host StateSource session observation 缺少 state");
        }
        return deepFreeze(clone({
          source: {
            kind: "working",
            stateVersion: observed.state?.meta?.stateVersion ?? inspected.baseVersion ?? null,
            sessionId: inspected.sessionId ?? null,
            sessionRevision: inspected.revision ?? null,
            phase: inspected.phase,
          },
          state: observed.state,
          decision: observed.decision ?? inspected.decision ?? null,
        }));
      }
      const state = getSnapshot();
      return deepFreeze(clone({
        source: {
          kind: "committed",
          stateVersion: state?.meta?.stateVersion ?? null,
          sessionId: null,
          sessionRevision: null,
          phase: "idle",
        },
        state,
        decision: null,
      }));
    }

    function project(projector, viewer = null) {
      if (typeof projector !== "function") throw new TypeError("Host StateSource projector 必须是函数");
      const envelope = read(viewer);
      return deepFreeze(clone(projector(envelope.state, viewer, envelope)));
    }

    function subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Host StateSource listener 必须是函数");
      return subscribeStore((event) => listener(deepFreeze(clone(event))));
    }

    return Object.freeze({ read, project, subscribe });
  }

  function subscribeCommitRefresh(source, refresh) {
    if (!source?.subscribe || typeof refresh !== "function") {
      throw new TypeError("commit refresh 需要 StateSource.subscribe 与 refresh()");
    }
    let lastFailure = null;
    const unsubscribe = source.subscribe((event) => {
      try {
        refresh(event);
        lastFailure = null;
      } catch (error) {
        lastFailure = deepFreeze({
          code: "HOST_COMMIT_REFRESH_FAILED",
          message: error?.message || "宿主 commit refresh 失败",
          stateVersion: event?.stateVersion ?? null,
        });
      }
    });
    return Object.freeze({
      unsubscribe,
      getLastFailure: () => clone(lastFailure),
    });
  }

  return Object.freeze({ createHostStateSource, subscribeCommitRefresh });
});

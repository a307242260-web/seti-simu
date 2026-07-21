(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserServices = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-services-v1";
  const VIEW_SCHEMA_VERSION = "seti-browser-host-v1";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function fail(code, message, extra = {}) {
    return deepFreeze({ ok: false, code, message, ...clone(extra) });
  }

  function requireFunction(source, key, label) {
    if (typeof source?.[key] !== "function") throw new TypeError(`${label} 缺少 ${key}()`);
    return source[key].bind(source);
  }

  function createBrowserServices(options = {}) {
    const stateStore = options.stateStore;
    const serializeState = requireFunction(stateStore, "serialize", "Browser persistence StateStore");
    const deserializeState = requireFunction(stateStore, "deserialize", "Browser persistence StateStore");
    const restoreState = requireFunction(stateStore, "restore", "Browser persistence StateStore");
    const getStateSnapshot = requireFunction(stateStore, "getSnapshot", "Browser persistence StateStore");
    const sessionPort = options.sessionPort || null;
    const viewStateStore = options.viewStateStore || null;
    const storage = options.storage || null;
    const storageKey = options.storageKey || "seti-browser-state-v1";
    const downloadPort = options.downloadPort || null;
    const debugCommandPort = options.debugCommandPort || null;

    function capture() {
      const state = serializeState();
      if (!state?.ok || typeof state.serialized !== "string") {
        return fail(state?.code || "BROWSER_STATE_SERIALIZE_FAILED", "StateStore serialize 失败", { cause: state || null });
      }
      let session = null;
      if (sessionPort?.capture) {
        const captured = sessionPort.capture();
        if (captured?.ok === false) return fail(captured.code || "BROWSER_SESSION_CAPTURE_FAILED", captured.message || "Effect Session capture 失败");
        session = clone(captured?.checkpoint ?? captured ?? null);
      }
      const view = viewStateStore?.getSnapshot ? clone(viewStateStore.getSnapshot()) : null;
      if (view && view.schemaVersion !== VIEW_SCHEMA_VERSION) {
        return fail("BROWSER_VIEW_SCHEMA_UNSUPPORTED", "ViewState schema 不受支持");
      }
      return deepFreeze({
        ok: true,
        envelope: {
          schemaVersion: SCHEMA_VERSION,
          savedAt: (options.now?.() || new Date()).toISOString(),
          state: { schemaVersion: stateStore.SCHEMA_VERSION || null, serialized: state.serialized },
          session: session == null ? null : { schemaVersion: session.schemaVersion || null, checkpoint: session },
          view: view == null ? null : { schemaVersion: view.schemaVersion, state: view },
        },
      });
    }

    function validateEnvelope(envelope) {
      if (!envelope || envelope.schemaVersion !== SCHEMA_VERSION) {
        return fail("BROWSER_RECOVERY_SCHEMA_UNSUPPORTED", "Browser recovery envelope schema 不受支持");
      }
      const unknownKeys = Object.keys(envelope).filter((key) => ![
        "schemaVersion", "savedAt", "state", "session", "view",
      ].includes(key));
      if (unknownKeys.length) {
        return fail("BROWSER_RECOVERY_FIELDS_UNSUPPORTED", "Browser recovery envelope 包含未知字段", { unknownKeys });
      }
      if (typeof envelope.state?.serialized !== "string") {
        return fail("BROWSER_RECOVERY_STATE_MISSING", "Browser recovery envelope 缺少 StateStore serialized state");
      }
      const state = deserializeState(envelope.state.serialized);
      if (!state?.ok) return fail(state?.code || "BROWSER_RECOVERY_STATE_INVALID", state?.message || "恢复状态无效", { cause: state });
      let session = null;
      if (envelope.session != null) {
        if (!sessionPort?.validate || !sessionPort?.restore) {
          return fail("BROWSER_RECOVERY_SESSION_PORT_MISSING", "存档包含 Effect Session，但宿主没有恢复协议");
        }
        session = sessionPort.validate(clone(envelope.session.checkpoint));
        if (!session?.ok) return fail(session?.code || "BROWSER_RECOVERY_SESSION_INVALID", session?.message || "Effect Session checkpoint 无效");
      }
      if (envelope.view != null) {
        if (envelope.view.schemaVersion !== VIEW_SCHEMA_VERSION || envelope.view.state?.schemaVersion !== VIEW_SCHEMA_VERSION) {
          return fail("BROWSER_RECOVERY_VIEW_INVALID", "ViewState schema 不受支持");
        }
        if (typeof viewStateStore?.validate !== "function" || typeof viewStateStore?.restore !== "function") {
          return fail("BROWSER_RECOVERY_VIEW_PORT_MISSING", "存档包含 ViewState，但宿主没有恢复协议");
        }
        const viewValidation = viewStateStore.validate(clone(envelope.view.state));
        if (!viewValidation?.ok) return fail(viewValidation?.code || "BROWSER_RECOVERY_VIEW_INVALID", viewValidation?.message || "ViewState snapshot 无效");
      }
      return { ok: true, state: clone(state.state), session: clone(session?.checkpoint ?? envelope.session?.checkpoint ?? null), view: clone(envelope.view?.state ?? null) };
    }

    function restore(envelope) {
      const validated = validateEnvelope(envelope);
      if (!validated.ok) return validated;
      const capturedSession = sessionPort?.capture ? sessionPort.capture() : null;
      const before = {
        state: getStateSnapshot(),
        session: clone(capturedSession?.checkpoint ?? capturedSession ?? null),
        view: viewStateStore?.getSnapshot ? clone(viewStateStore.getSnapshot()) : null,
      };
      const rollback = () => {
        restoreState(before.state, { source: "browser-services-rollback" });
        if (before.session != null) sessionPort?.restore?.(clone(before.session));
        if (before.view != null) viewStateStore?.restore?.(clone(before.view));
        else viewStateStore?.clear?.();
      };
      const stateResult = restoreState(validated.state, { source: "browser-services" });
      if (stateResult?.ok === false) return fail(stateResult.code || "BROWSER_RECOVERY_STATE_RESTORE_FAILED", stateResult.message || "StateStore restore port 拒绝恢复");
      if (validated.session != null) {
        const sessionResult = sessionPort.restore(validated.session);
        if (sessionResult?.ok === false) {
          rollback();
          return fail(sessionResult.code || "BROWSER_RECOVERY_SESSION_RESTORE_FAILED", sessionResult.message || "Effect Session restore port 拒绝恢复");
        }
      }
      if (validated.view != null) {
        const viewResult = viewStateStore.restore(validated.view);
        if (viewResult?.ok === false) {
          rollback();
          return fail(viewResult.code || "BROWSER_RECOVERY_VIEW_RESTORE_FAILED", viewResult.message || "ViewState restore port 拒绝恢复");
        }
      } else {
        viewStateStore?.clear?.();
      }
      return deepFreeze({ ok: true, stateVersion: validated.state?.meta?.stateVersion ?? null, sessionRestored: validated.session != null, viewRestored: validated.view != null });
    }

    function save() {
      if (!storage?.setItem) return fail("BROWSER_STORAGE_UNAVAILABLE", "local persistence 不可用");
      const captured = capture();
      if (!captured.ok) return captured;
      try {
        storage.setItem(storageKey, JSON.stringify(captured.envelope));
        return deepFreeze({ ok: true, storageKey, savedAt: captured.envelope.savedAt });
      } catch (error) {
        return fail("BROWSER_STORAGE_WRITE_FAILED", error?.message || "local persistence 写入失败");
      }
    }

    function load() {
      if (!storage?.getItem) return fail("BROWSER_STORAGE_UNAVAILABLE", "local persistence 不可用");
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return fail("BROWSER_STORAGE_EMPTY", "没有本地存档");
        return restore(JSON.parse(raw));
      } catch (error) {
        return fail("BROWSER_STORAGE_READ_FAILED", error?.message || "local persistence 读取失败");
      }
    }

    function clear() {
      if (!storage?.removeItem) return fail("BROWSER_STORAGE_UNAVAILABLE", "local persistence 不可用");
      try {
        storage.removeItem(storageKey);
        return deepFreeze({ ok: true, storageKey });
      } catch (error) {
        return fail("BROWSER_STORAGE_CLEAR_FAILED", error?.message || "local persistence 清理失败");
      }
    }

    function download(request = {}) {
      if (!downloadPort?.save) return fail("BROWSER_DOWNLOAD_UNAVAILABLE", "download port 不可用");
      if (typeof request.content !== "string" || !request.filename) {
        return fail("BROWSER_DOWNLOAD_REQUEST_INVALID", "下载只接受显式 filename/content");
      }
      const result = downloadPort.save({ filename: String(request.filename), content: request.content, mimeType: request.mimeType || "text/plain;charset=utf-8" });
      return result?.ok === false ? result : deepFreeze({ ok: true, filename: String(request.filename) });
    }

    function dispatchDeveloperCommand(command) {
      if (!debugCommandPort?.dispatch) return fail("BROWSER_DEBUG_PORT_UNAVAILABLE", "debug/failsafe command port 不可用");
      if (!command || typeof command.type !== "string") return fail("BROWSER_DEBUG_COMMAND_INVALID", "debug command 必须有 type");
      return debugCommandPort.dispatch(deepFreeze(clone(command)));
    }

    function createPublicFacade() {
      return Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        capture: () => capture(),
        restore: (envelope) => restore(clone(envelope)),
        save,
        load,
        clear,
        download: (request) => download(clone(request)),
        dispatchDeveloperCommand: (command) => dispatchDeveloperCommand(clone(command)),
      });
    }

    return Object.freeze({ capture, validateEnvelope, restore, save, load, clear, download, dispatchDeveloperCommand, createPublicFacade });
  }

  function subscribeRefresh(options = {}) {
    const refresh = requireFunction(options, "refresh", "Browser refresh subscription");
    const unsubscribers = [];
    const listener = (event) => {
      try { refresh(deepFreeze(clone(event))); } catch (error) { /* 宿主刷新失败不得回滚权威提交。 */ }
    };
    if (typeof options.stateStore?.subscribe === "function") unsubscribers.push(options.stateStore.subscribe((event) => listener({ source: "state", event })));
    if (typeof options.sessionPort?.subscribe === "function") unsubscribers.push(options.sessionPort.subscribe((event) => listener({ source: "session", event })));
    return Object.freeze({ dispose() { for (const unsubscribe of unsubscribers.splice(0)) unsubscribe(); } });
  }

  return Object.freeze({ SCHEMA_VERSION, VIEW_SCHEMA_VERSION, createBrowserServices, subscribeRefresh });
});

(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppGameRecovery = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const RECOVERY_SNAPSHOT_VERSION = 2;

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function failure(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function parseRecoverySnapshot(input) {
    if (typeof input !== "string") return { ok: true, snapshot: input };
    try {
      return { ok: true, snapshot: JSON.parse(input) };
    } catch (error) {
      return failure("RECOVERY_SNAPSHOT_JSON_INVALID", error?.message || "恢复快照 JSON 损坏");
    }
  }

  function requireStateStore(options, method) {
    if (typeof options.stateStore?.[method] !== "function") {
      throw new TypeError(`GameRecovery 需要 StateStore.${method}()`);
    }
    return options.stateStore;
  }

  function createGameRecoverySnapshot(options = {}) {
    const meta = {
      roundNumber: options.roundNumber ?? null,
      turnNumber: options.turnNumber ?? null,
      actionCycleNumber: options.actionCycleNumber ?? null,
      currentPlayerId: options.currentPlayerId ?? null,
      entryId: options.entryId ?? null,
      label: options.label || null,
    };
    if (options.browserServices?.capture) {
      const captured = options.browserServices.capture();
      if (!captured?.ok) {
        const error = new TypeError(`无法创建 browser recovery checkpoint: ${captured?.code || "BROWSER_CAPTURE_FAILED"}`);
        error.validation = captured;
        throw error;
      }
      return {
        version: RECOVERY_SNAPSHOT_VERSION,
        meta,
        browserCheckpoint: clone(captured.envelope),
        runtime: structuredClone(options.runtime || {}),
      };
    }
    const stateStore = requireStateStore(options, "serialize");
    const serialized = options.serializeOptions
      ? stateStore.serialize(options.serializeOptions)
      : stateStore.serialize();
    if (!serialized.ok) {
      const firstError = serialized.errors?.[0] || null;
      const diagnostic = firstError
        ? ` path=${firstError.path || "$"} cause=${firstError.code || "unknown"}: ${firstError.message || "状态校验失败"}`
        : serialized.message ? `: ${serialized.message}` : "";
      const error = new TypeError(`无法创建 recovery committed snapshot: ${serialized.code}${diagnostic}`);
      error.validation = serialized;
      throw error;
    }
    return {
      version: RECOVERY_SNAPSHOT_VERSION,
      meta,
      committedState: serialized.serialized,
      runtime: structuredClone(options.runtime || {}),
    };
  }

  function normalizeRecoverableActionLogEntry(entry, options = {}) {
    const includeRecovery = options.includeRecovery !== false;
    const clone = structuredClone(entry);
    if (!includeRecovery) {
      delete clone.recoverySnapshot;
    }
    return clone;
  }

  function getRecoverableActionLogEntries(entries, options = {}) {
    return (entries || []).map((entry) => normalizeRecoverableActionLogEntry(entry, options));
  }

  function createActionLogRecoveryPackage(options = {}) {
    return {
      version: options.version || null,
      latestSnapshot: options.createSnapshot?.({ label: "当前局面" }) || null,
      entries: getRecoverableActionLogEntries(options.entries, {
        includeRecovery: options.includeRecovery !== false,
      }),
    };
  }

  function createPersistentGamePackage(options = {}) {
    return {
      version: options.version || null,
      savedAt: (options.now || new Date()).toISOString(),
      latestSnapshot: options.createSnapshot?.({ label: options.label || "本地自动保存" }) || null,
      entries: getRecoverableActionLogEntries(options.entries, { includeRecovery: false }),
      activeReportTab: options.activeReportTab || "action",
    };
  }

  function getPersistentGameStorage(windowRef) {
    try {
      return windowRef?.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function readPersistentGamePackage(storage, storageKey) {
    if (!storage) return null;
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || parsed.version !== RECOVERY_SNAPSHOT_VERSION) {
        storage.removeItem(storageKey);
        return null;
      }
      return parsed;
    } catch (error) {
      storage.removeItem(storageKey);
      return null;
    }
  }

  function hasPersistentGameState(saved) {
    return Boolean(saved?.version === RECOVERY_SNAPSHOT_VERSION && saved?.latestSnapshot);
  }

  function clearPersistentGameState(storage, storageKey) {
    if (!storage) return false;
    try {
      storage.removeItem(storageKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  function getRecoveryEntriesFromInput(logOrPackage) {
    if (Array.isArray(logOrPackage)) return logOrPackage;
    if (Array.isArray(logOrPackage?.entries)) return logOrPackage.entries;
    return [];
  }

  function getRecoverySnapshotFromLog(logOrPackage, options = {}) {
    const entries = getRecoveryEntriesFromInput(logOrPackage);
    if (!entries.length) {
      return logOrPackage?.latestSnapshot || null;
    }
    if (options.entryId != null) {
      const match = entries.find((entry) => entry.id === options.entryId || String(entry.id) === String(options.entryId));
      return match?.recoverySnapshot || null;
    }
    const index = Number.isInteger(options.index)
      ? options.index
      : entries.length - 1;
    const entry = entries[Math.max(0, Math.min(entries.length - 1, index))];
    return entry?.recoverySnapshot || null;
  }

  function applyGameRecoverySnapshot(snapshot, options = {}) {
    const parsed = parseRecoverySnapshot(snapshot);
    if (!parsed.ok) return parsed;
    const envelope = parsed.snapshot;
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      return failure("RECOVERY_SNAPSHOT_INVALID", "恢复快照必须是普通对象");
    }
    if (envelope.version !== RECOVERY_SNAPSHOT_VERSION) {
      return failure(
        "RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED",
        `不支持的恢复快照版本：${envelope.version ?? "missing"}`,
        { version: envelope.version ?? null },
      );
    }
    if (envelope.browserCheckpoint != null) {
      const services = options.browserServices;
      if (!services?.validateEnvelope || !services?.restore || !services?.capture) {
        return failure("RECOVERY_BROWSER_SERVICES_MISSING", "Browser checkpoint 需要 Browser Services restore 协议");
      }
      const validated = services.validateEnvelope(envelope.browserCheckpoint);
      if (!validated.ok) return validated;
      const before = services.capture();
      if (!before?.ok) return before;
      const restored = services.restore(envelope.browserCheckpoint);
      if (!restored.ok) return restored;
      // Browser 的 committed state、活跃 Session、RNG 与确定性序列都属于
      // Rule Composition lifecycle。宿主不得从 validation 结果取出 root 后
      // 再执行一次 restore-to-slices；否则恢复不再是一个原子边界。
      // 旧 StateStore-only Browser envelope 仅保留迁移兼容，完成生产硬切后删除。
      if (validated.state) {
        try {
          options.restoreDeterministicState?.(structuredClone(validated.state.meta.sequences));
        } catch (error) {
          services.restore(before.envelope);
          return failure(
            "RECOVERY_COMMITTED_STATE_RESTORE_FAILED",
            error?.message || "恢复 committed state 失败",
          );
        }
      }
      options.onAfterStateRestored?.();
      const aiControlResult = options.restoreAiControlSnapshot?.(envelope.runtime?.aiControl || null, {
        missingMessage: "存档未包含电脑配置，已按默认人机对局恢复",
      });
      const baseMessage = options.message || "已从行动日志恢复局面";
      const recoveryMessage = aiControlResult?.missing
        || aiControlResult?.invalidPlayerIds
        || aiControlResult?.clearedPausedOnBug
        ? `${baseMessage}；${aiControlResult.message}`
        : baseMessage;
      options.refreshAfterGameRecovery?.(recoveryMessage);
      return {
        ok: true,
        snapshotVersion: envelope.version,
        ruleSchemaVersion: validated.rules?.schemaVersion || validated.state?.meta?.schemaVersion || null,
        stateVersion: restored.stateVersion ?? null,
        sessionRestored: Boolean(restored.sessionRestored),
        aiControl: aiControlResult,
        message: options.getRecoveryMessage?.() || recoveryMessage,
      };
    }
    if (typeof envelope.committedState !== "string") {
      return failure("RECOVERY_COMMITTED_STATE_MISSING", "恢复快照缺少 committedState JSON");
    }
    let stateStore;
    try {
      stateStore = requireStateStore(options, "deserialize");
      requireStateStore(options, "getSnapshot");
      requireStateStore(options, "restore");
    } catch (error) {
      return failure("RECOVERY_STATE_STORE_MISSING", error.message);
    }
    const deserialized = stateStore.deserialize(envelope.committedState);
    if (!deserialized.ok) {
      return {
        ok: false,
        code: deserialized.code,
        message: deserialized.message || "行动日志恢复快照无效",
      };
    }
    const beforeState = stateStore.getSnapshot();
    const beforeRuntime = options.captureRuntimeState?.() ?? null;
    const restored = stateStore.restore(structuredClone(deserialized.state), { source: "game-recovery" });
    if (restored?.ok === false) return restored;
    try {
      options.restoreDeterministicState?.(structuredClone(deserialized.state.meta.sequences));
    } catch (error) {
      stateStore.restore(beforeState, { source: "game-recovery-rollback" });
      try { options.restoreRuntimeState?.(beforeRuntime); } catch (_rollbackError) { /* 返回原始恢复错误。 */ }
      return {
        ok: false,
        code: "RECOVERY_COMMITTED_STATE_RESTORE_FAILED",
        message: error?.message || "恢复 committed state 失败",
      };
    }
    options.onAfterStateRestored?.();
    const aiControlResult = options.restoreAiControlSnapshot?.(envelope.runtime?.aiControl || null, {
      missingMessage: "存档未包含电脑配置，已按默认人机对局恢复",
    });
    const baseMessage = options.message || "已从行动日志恢复局面";
    const recoveryMessage = aiControlResult?.missing
      || aiControlResult?.invalidPlayerIds
      || aiControlResult?.clearedPausedOnBug
      ? `${baseMessage}；${aiControlResult.message}`
      : baseMessage;
    options.refreshAfterGameRecovery?.(recoveryMessage);
    return {
      ok: true,
      snapshotVersion: envelope.version,
      committedSchemaVersion: deserialized.state.meta.schemaVersion,
      rngState: structuredClone(deserialized.state.meta.rngState),
      sequences: structuredClone(deserialized.state.meta.sequences),
      aiControl: aiControlResult,
      message: options.getRecoveryMessage?.() || recoveryMessage,
    };
  }

  return {
    RECOVERY_SNAPSHOT_VERSION,
    createGameRecoverySnapshot,
    normalizeRecoverableActionLogEntry,
    getRecoverableActionLogEntries,
    createActionLogRecoveryPackage,
    createPersistentGamePackage,
    getPersistentGameStorage,
    readPersistentGamePackage,
    hasPersistentGameState,
    clearPersistentGameState,
    getRecoveryEntriesFromInput,
    getRecoverySnapshotFromLog,
    applyGameRecoverySnapshot,
  };
});

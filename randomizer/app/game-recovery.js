(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppGameRecovery = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createGameRecoverySnapshot(options = {}) {
    return {
      version: options.version || null,
      meta: {
        roundNumber: options.roundNumber ?? null,
        turnNumber: options.turnNumber ?? null,
        actionCycleNumber: options.actionCycleNumber ?? null,
        currentPlayerId: options.currentPlayerId ?? null,
        entryId: options.entryId ?? null,
        label: options.label || null,
      },
      state: structuredClone(options.state || {}),
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
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      storage.removeItem(storageKey);
      return null;
    }
  }

  function hasPersistentGameState(saved) {
    return Boolean(saved?.latestSnapshot || saved?.snapshot);
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
      return logOrPackage?.latestSnapshot || logOrPackage?.baseSnapshot || null;
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
    const state = snapshot?.state || snapshot;
    if (!state) {
      return { ok: false, message: "行动日志中没有可恢复快照" };
    }
    const slices = options.stateSlices || {};
    for (const [key, target] of Object.entries(slices)) {
      if (state[key] != null) {
        options.restoreMutableObject?.(target, state[key]);
      }
    }
    options.onAfterStateRestored?.();
    const aiControlResult = options.restoreAiControlSnapshot?.(snapshot?.runtime?.aiControl || null, {
      missingMessage: "旧存档未包含电脑配置，已按默认人机对局恢复",
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
      snapshotVersion: snapshot.version || null,
      aiControl: aiControlResult,
      message: options.getRecoveryMessage?.() || recoveryMessage,
    };
  }

  return {
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

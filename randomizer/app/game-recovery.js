(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppGameRecovery = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  let legacyStateAdapter = root.SetiLegacyStateAdapter;
  if (!legacyStateAdapter && typeof require === "function") {
    legacyStateAdapter = require("../game/state/legacy-state-adapter");
  }
  if (!legacyStateAdapter) {
    throw new Error("SetiLegacyStateAdapter is required before SetiAppGameRecovery");
  }

  function createGameRecoverySnapshot(options = {}) {
    const legacySnapshot = {
      version: legacyStateAdapter.LEGACY_RECOVERY_VERSION,
      meta: {
        roundNumber: options.roundNumber ?? null,
        turnNumber: options.turnNumber ?? null,
        actionCycleNumber: options.actionCycleNumber ?? null,
        currentPlayerId: options.currentPlayerId ?? null,
        entryId: options.entryId ?? null,
        label: options.label || null,
      },
      state: options.state,
    };
    const serialized = legacyStateAdapter.serializeLegacySnapshot(legacySnapshot, {
      gameId: options.gameId,
      rulesetVersion: options.rulesetVersion,
      seed: options.seed,
      rngState: options.rngState,
    });
    if (!serialized.ok) {
      const error = new TypeError(`无法创建 recovery committed snapshot: ${serialized.code}`);
      error.validation = serialized;
      throw error;
    }
    return {
      version: legacyStateAdapter.COMMITTED_RECOVERY_VERSION,
      meta: legacySnapshot.meta,
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
    const deserialized = legacyStateAdapter.deserializeRecoverySnapshot(snapshot, {
      gameId: options.gameId,
      rulesetVersion: options.rulesetVersion,
      seed: options.seed,
      rngState: options.rngState,
    });
    if (!deserialized.ok) {
      return {
        ok: false,
        code: deserialized.code,
        message: deserialized.message || "行动日志恢复快照无效",
      };
    }
    const projected = legacyStateAdapter.projectCommittedStateToLegacySlices(deserialized.state, {
      hostState: options.stateSlices,
    });
    if (!projected.ok) {
      return { ok: false, code: projected.code, message: projected.message };
    }
    const state = projected.state;
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
      snapshotVersion: typeof snapshot === "string" ? null : snapshot.version || null,
      committedSchemaVersion: deserialized.state.meta.schemaVersion,
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

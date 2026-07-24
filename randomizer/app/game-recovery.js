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
  const BROWSER_CHECKPOINT_SCHEMA_VERSION = "seti-browser-checkpoint-v1";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function failure(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function requireFunction(source, key, label) {
    if (typeof source?.[key] !== "function") throw new TypeError(`${label} 缺少 ${key}()`);
    return source[key].bind(source);
  }

  function createBrowserCheckpointAdapter(options = {}) {
    const lifecycle = options.ruleLifecycle;
    const saveRules = requireFunction(lifecycle, "save", "Rule Composition lifecycle");
    const validateRules = requireFunction(lifecycle, "validateRestore", "Rule Composition lifecycle");
    const restoreRules = requireFunction(lifecycle, "restore", "Rule Composition lifecycle");
    const viewStateStore = options.viewStateStore || null;
    const viewSchemaVersion = options.viewSchemaVersion;
    if (!viewSchemaVersion) throw new TypeError("Browser checkpoint adapter 缺少 ViewState schema");

    function capture(captureOptions = {}) {
      const rules = saveRules(clone(captureOptions.ruleLifecycle || {}));
      if (!rules?.ok || !rules.envelope?.schemaVersion) {
        return failure(rules?.code || "BROWSER_RULES_SAVE_FAILED", rules?.message || "Rule Composition save 失败");
      }
      const view = viewStateStore?.getSnapshot ? clone(viewStateStore.getSnapshot()) : null;
      if (view && view.schemaVersion !== viewSchemaVersion) {
        return failure("BROWSER_VIEW_SCHEMA_UNSUPPORTED", "ViewState schema 不受支持");
      }
      return {
        ok: true,
        envelope: {
          schemaVersion: BROWSER_CHECKPOINT_SCHEMA_VERSION,
          savedAt: (options.now?.() || new Date()).toISOString(),
          rules: { schemaVersion: rules.envelope.schemaVersion, envelope: clone(rules.envelope) },
          view: view == null ? null : { schemaVersion: view.schemaVersion, state: view },
        },
      };
    }

    function validateEnvelope(envelope) {
      if (!envelope || envelope.schemaVersion !== BROWSER_CHECKPOINT_SCHEMA_VERSION) {
        return failure("BROWSER_RECOVERY_SCHEMA_UNSUPPORTED", "Browser recovery envelope schema 不受支持");
      }
      const allowedKeys = ["schemaVersion", "savedAt", "rules", "view"];
      const unknownKeys = Object.keys(envelope).filter((key) => !allowedKeys.includes(key));
      if (unknownKeys.length) {
        return failure("BROWSER_RECOVERY_FIELDS_UNSUPPORTED", "Browser recovery envelope 包含未知字段", { unknownKeys });
      }
      if (!envelope.rules?.envelope || envelope.rules.schemaVersion !== envelope.rules.envelope.schemaVersion) {
        return failure("BROWSER_RECOVERY_RULES_MISSING", "Browser recovery envelope 缺少 Rule Composition 存档");
      }
      const rules = validateRules(clone(envelope.rules.envelope));
      if (!rules?.ok) return failure(rules?.code || "BROWSER_RECOVERY_RULES_INVALID", rules?.message || "Rule Composition 存档无效");
      if (envelope.view != null) {
        if (envelope.view.schemaVersion !== viewSchemaVersion || envelope.view.state?.schemaVersion !== viewSchemaVersion) {
          return failure("BROWSER_RECOVERY_VIEW_INVALID", "ViewState schema 不受支持");
        }
        if (typeof viewStateStore?.validate !== "function" || typeof viewStateStore?.restore !== "function") {
          return failure("BROWSER_RECOVERY_VIEW_PORT_MISSING", "存档包含 ViewState，但宿主没有恢复协议");
        }
        const viewValidation = viewStateStore.validate(clone(envelope.view.state));
        if (!viewValidation?.ok) return failure(viewValidation?.code || "BROWSER_RECOVERY_VIEW_INVALID", viewValidation?.message || "ViewState snapshot 无效");
      }
      return { ok: true, rules: clone(envelope.rules.envelope), view: clone(envelope.view?.state ?? null) };
    }

    function restore(envelope) {
      const validated = validateEnvelope(envelope);
      if (!validated.ok) return validated;
      const beforeRules = saveRules();
      if (!beforeRules?.ok) return failure(beforeRules?.code || "BROWSER_RULES_SAVE_FAILED", beforeRules?.message || "恢复前 Rule Composition capture 失败");
      const beforeView = viewStateStore?.getSnapshot ? clone(viewStateStore.getSnapshot()) : null;
      const rulesResult = restoreRules(clone(validated.rules));
      if (!rulesResult?.ok) return failure(rulesResult?.code || "BROWSER_RECOVERY_RULES_RESTORE_FAILED", rulesResult?.message || "Rule Composition restore 拒绝恢复");
      const viewResult = validated.view != null ? viewStateStore.restore(validated.view) : viewStateStore?.clear?.();
      if (viewResult?.ok === false) {
        const rollback = restoreRules(clone(beforeRules.envelope));
        if (rollback?.ok === false) throw new Error("Rule Composition 恢复回滚失败");
        if (beforeView != null) viewStateStore?.restore?.(beforeView);
        return failure(viewResult.code || "BROWSER_RECOVERY_VIEW_RESTORE_FAILED", viewResult.message || "ViewState restore port 拒绝恢复");
      }
      return {
        ok: true,
        stateVersion: rulesResult.projection?.stateVersion ?? null,
        sessionRestored: Boolean(validated.rules.session),
        viewRestored: validated.view != null,
      };
    }

    return Object.freeze({ capture, validateEnvelope, restore });
  }

  function parseRecoverySnapshot(input) {
    if (typeof input !== "string") return { ok: true, snapshot: input };
    try {
      return { ok: true, snapshot: JSON.parse(input) };
    } catch (error) {
      return failure("RECOVERY_SNAPSHOT_JSON_INVALID", error?.message || "恢复快照 JSON 损坏");
    }
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
    if (typeof options.browserCheckpointPort?.capture !== "function") {
      throw new TypeError("GameRecovery 需要 Browser checkpoint capture()");
    }
    const captured = options.browserCheckpointPort.capture({
      ruleLifecycle: clone(options.ruleLifecycleOptions || {}),
    });
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

  function readPersistentGamePackage(storageService) {
    const result = storageService?.read?.();
    if (!result?.ok) {
      if (result?.code === "BROWSER_STORAGE_READ_FAILED") storageService?.remove?.();
      return null;
    }
    const parsed = result.value;
    if (!parsed || typeof parsed !== "object" || parsed.version !== RECOVERY_SNAPSHOT_VERSION) {
      storageService.remove?.();
      return null;
    }
    return parsed;
  }

  function hasPersistentGameState(saved) {
    return Boolean(saved?.version === RECOVERY_SNAPSHOT_VERSION && saved?.latestSnapshot);
  }

  function clearPersistentGameState(storageService) {
    return storageService?.remove?.().ok === true;
  }

  function createPersistenceController(options = {}) {
    const storageService = options.storageService || null;
    const timerService = options.timerService || null;
    let saveTimer = 0;
    let saveSuspended = false;

    function read() {
      return readPersistentGamePackage(storageService);
    }

    function has() {
      return hasPersistentGameState(read());
    }

    function clear() {
      return clearPersistentGameState(storageService);
    }

    function setSuspended(value) {
      saveSuspended = Boolean(value);
    }

    function isStable() {
      return !saveSuspended && options.isStable();
    }

    function createPackage(label = "本地自动保存") {
      return createPersistentGamePackage({
        version: options.version,
        label,
        entries: options.getEntries(),
        activeReportTab: options.getActiveReportTab(),
        createSnapshot: options.createSnapshot,
      });
    }

    function saveNow(saveOptions = {}) {
      if (!saveOptions.force && !isStable()) {
        return { ok: false, skipped: true, message: "当前流程未稳定，保留上一个本地存档" };
      }
      const result = storageService?.write?.(createPackage(saveOptions.label));
      return result?.ok ? { ok: true } : {
        ok: false,
        message: result?.message || "当前浏览器不支持本地保存",
      };
    }

    function schedule(saveOptions = {}) {
      if (saveSuspended) return;
      if (saveTimer) timerService?.cancel?.(saveTimer);
      const scheduled = timerService?.schedule?.(() => {
        saveTimer = 0;
        saveNow(saveOptions);
      }, options.saveDelayMs);
      saveTimer = scheduled?.timerId || 0;
    }

    function restore() {
      const saved = read();
      const snapshot = saved?.latestSnapshot || null;
      if (!snapshot) return { ok: false, message: "没有可恢复的本地存档" };
      saveSuspended = true;
      try {
        const result = options.applySnapshot(snapshot, { message: "已恢复上次保存的局面" });
        if (!result.ok) {
          clear();
          return result;
        }
        if (Array.isArray(saved.entries)) options.importEntries(saved.entries);
        const latestEntry = options.getEntries().at(-1) || null;
        if (latestEntry && !latestEntry.recoverySnapshot) latestEntry.recoverySnapshot = clone(snapshot);
        if (saved.activeReportTab) options.setReportTab(saved.activeReportTab);
        return result;
      } catch (error) {
        options.warn?.("[SETI] 恢复本地存档失败，已清除坏存档", error);
        clear();
        return { ok: false, message: "恢复本地存档失败" };
      } finally {
        saveSuspended = false;
      }
    }

    return Object.freeze({
      readPersistentGamePackage: read,
      hasPersistentGameState: has,
      clearPersistentGameState: clear,
      setPersistentGameSaveSuspended: setSuspended,
      isPersistentGameStateStable: isStable,
      createPersistentGamePackage: createPackage,
      savePersistentGameStateNow: saveNow,
      schedulePersistentGameStateSave: schedule,
      restorePersistentGameState: restore,
    });
  }

  function createRecoveryHost(context = {}) {
    function clearTransientState() {
      context.uiRuntimeState.discardSelectedHandIndexes = [];
      context.uiRuntimeState.passReserveSelectionDismissed = false;
      context.uiRuntimeState.passReserveSelectedCardId = null;
      context.uiRuntimeState.probeSectorSelectedRocketIds = [];
      context.uiRuntimeState.jiuzheOpportunityOpen = false;
      context.uiRuntimeState.jiuzheCardViewOpen = false;
      context.uiRuntimeState.alienTracePickerState = null;
      context.closeAlienRevealConfirmationOverlay();
      context.uiRuntimeState.effectStepActive = false;
      context.uiRuntimeState.moveHighlightRocketId = null;
      context.uiRuntimeState.movePaymentSelectedHandIndices = [];
      context.uiRuntimeState.playCardSelection = null;
      context.uiRuntimeState.handCardPlayAction = null;
      context.uiRuntimeState.cardCornerQuickAction = null;
      context.interactionChrome.resetAfterRecovery();
      context.closeFinalResultDialog({ silent: true });
      return { ok: true };
    }

    function refreshAfterRecovery(message = "已从行动日志恢复局面") {
      context.setTokenAssetSizes();
      context.renderWheels();
      context.renderSectors();
      context.renderRotateStateToken();
      context.refreshHelpers.refreshBoardState({ includeSectorNebula: false, includeFinalScore: true, includeTech: true });
      context.renderPublicCards();
      context.updatePublicCardControls();
      context.renderReservedCards();
      context.renderInitialSelectionArea();
      context.renderPlayerHand();
      context.refreshHelpers.refreshPlayerPanels();
      context.renderRoundStatus();
      context.renderDebugPlayerSwitch();
      context.syncCardSelectionChrome();
      context.syncDiscardSelectionChrome();
      context.syncPassReserveSelectionChrome();
      context.syncHandScanSelectionChrome();
      context.syncPlayCardSelectionChrome();
      context.syncTechSelectionChrome();
      context.syncIndustryHandSelectionChrome();
      context.syncInteractionFocusChrome();
      context.setStatusNote?.(message);
      context.refreshHelpers.refreshActionState({ includeStateReadout: true });
      context.renderActionLog();
      return { ok: true };
    }

    return Object.freeze({
      clearTransientStateForRecovery: clearTransientState,
      refreshAfterGameRecovery: refreshAfterRecovery,
    });
  }

  function createRecoveryLogController(options = {}) {
    function createSnapshot(meta = {}) {
      const projection = options.getRecoveryProjection();
      return createGameRecoverySnapshot({
        browserCheckpointPort: options.browserCheckpointPort,
        ruleLifecycleOptions: {
          seed: meta.seed ?? "browser-host",
          rngState: meta.rngState || { owner: "browser", state: null },
        },
        roundNumber: projection.roundNumber,
        turnNumber: projection.turnNumber,
        actionCycleNumber: projection.actionCycleNumber,
        currentPlayerId: projection.currentPlayerId,
        entryId: meta.entryId ?? null,
        label: meta.label || null,
        runtime: { aiControl: options.createAiControlSnapshot() },
      });
    }

    function attachSnapshot(entry, label = null) {
      if (!entry) return null;
      const recoveryLabel = label || entry.actionLabel || entry.title || null;
      const stableSnapshot = options.getStableSnapshot();
      if (stableSnapshot) {
        entry.recoverySnapshot = clone(stableSnapshot);
        entry.recoverySnapshot.meta.entryId = entry.id;
        entry.recoverySnapshot.meta.label = recoveryLabel;
      } else {
        entry.recoverySnapshot = createSnapshot({ entryId: entry.id, label: recoveryLabel });
      }
      return entry.recoverySnapshot;
    }

    function refreshLatest(label = null) {
      const entry = options.getEntries().at(-1) || null;
      if (!entry) return null;
      attachSnapshot(entry, label);
      options.renderActionLog();
      options.schedulePersistentGameStateSave({ label: label || "行动日志恢复点" });
      return entry.recoverySnapshot;
    }

    function getRecoverable(optionsArg = {}) {
      return getRecoverableActionLogEntries(options.getEntries(), optionsArg);
    }

    function createPackage(optionsArg = {}) {
      return createActionLogRecoveryPackage({
        version: options.version,
        entries: options.getEntries(),
        includeRecovery: optionsArg.includeRecovery !== false,
        createSnapshot,
      });
    }

    function applySnapshot(snapshot, applyOptions = {}) {
      return applyGameRecoverySnapshot(snapshot, {
        ...applyOptions,
        browserCheckpointPort: options.browserCheckpointPort,
        onAfterStateRestored: () => {
          options.clearTransientStateForRecovery();
        },
        restoreAiControlSnapshot: options.restoreAiControlSnapshot,
        refreshAfterGameRecovery: applyOptions.skipRefresh ? null : options.refreshAfterGameRecovery,
        getRecoveryMessage: () => options.getRecoveryMessage?.() || null,
      });
    }

    function importEntries(entries, importOptions = {}) {
      options.importActionLogEntries(entries, importOptions);
    }

    function recoverFromLog(logOrPackage, recoverOptions = {}) {
      const entries = getRecoveryEntriesFromInput(logOrPackage);
      const snapshot = getRecoverySnapshotFromLog(logOrPackage, recoverOptions);
      if (!snapshot) return { ok: false, message: "行动日志中没有可恢复快照" };
      const result = applySnapshot(snapshot, { message: recoverOptions.message || "已根据行动日志恢复局面" });
      if (!result.ok) return result;
      if (entries.length && recoverOptions.restoreLog !== false) {
        importEntries(entries, {
          truncateToEntryId: recoverOptions.entryId,
          truncateToIndex: Number.isInteger(recoverOptions.index) ? recoverOptions.index : null,
        });
      }
      return result;
    }

    return Object.freeze({
      createGameRecoverySnapshot: createSnapshot,
      attachRecoverySnapshotToActionLogEntry: attachSnapshot,
      refreshLatestActionLogRecoverySnapshot: refreshLatest,
      normalizeRecoverableActionLogEntry,
      getRecoverableActionLog: getRecoverable,
      createActionLogRecoveryPackage: createPackage,
      getRecoveryEntriesFromInput,
      getRecoverySnapshotFromLog,
      applyGameRecoverySnapshot: applySnapshot,
      importActionLogEntries: importEntries,
      recoverFromActionLog: recoverFromLog,
    });
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
      const checkpointPort = options.browserCheckpointPort;
      if (!checkpointPort?.validateEnvelope || !checkpointPort?.restore || !checkpointPort?.capture) {
        return failure("RECOVERY_BROWSER_CHECKPOINT_PORT_MISSING", "Browser checkpoint 需要 lifecycle adapter");
      }
      const validated = checkpointPort.validateEnvelope(envelope.browserCheckpoint);
      if (!validated.ok) return validated;
      const before = checkpointPort.capture();
      if (!before?.ok) return before;
      const restored = checkpointPort.restore(envelope.browserCheckpoint);
      if (!restored.ok) return restored;
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
        ruleSchemaVersion: validated.rules?.schemaVersion || null,
        stateVersion: restored.stateVersion ?? null,
        sessionRestored: Boolean(restored.sessionRestored),
        aiControl: aiControlResult,
        message: options.getRecoveryMessage?.() || recoveryMessage,
      };
    }
    return failure(
      "RECOVERY_BROWSER_CHECKPOINT_MISSING",
      "旧 StateStore-only 恢复快照已不受支持；必须提供 Browser Composition checkpoint",
    );
  }

  return {
    RECOVERY_SNAPSHOT_VERSION,
    BROWSER_CHECKPOINT_SCHEMA_VERSION,
    createBrowserCheckpointAdapter,
    createGameRecoverySnapshot,
    normalizeRecoverableActionLogEntry,
    getRecoverableActionLogEntries,
    createActionLogRecoveryPackage,
    createPersistentGamePackage,
    readPersistentGamePackage,
    hasPersistentGameState,
    clearPersistentGameState,
    createPersistenceController,
    createRecoveryHost,
    createRecoveryLogController,
    getRecoveryEntriesFromInput,
    getRecoverySnapshotFromLog,
    applyGameRecoverySnapshot,
  };
});

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

  function createGameRecoverySnapshot(options = {}) {
    const meta = {
      roundNumber: options.roundNumber ?? null,
      turnNumber: options.turnNumber ?? null,
      actionCycleNumber: options.actionCycleNumber ?? null,
      currentPlayerId: options.currentPlayerId ?? null,
      entryId: options.entryId ?? null,
      label: options.label || null,
    };
    if (typeof options.browserServices?.capture !== "function") {
      throw new TypeError("GameRecovery 需要 Browser Services composition lifecycle capture()");
    }
    const captured = options.browserServices.capture({
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

  function createPersistenceController(options = {}) {
    const storage = getPersistentGameStorage(options.window);
    const storageKey = options.storageKey;
    let saveTimer = 0;
    let saveSuspended = false;

    function read() {
      return readPersistentGamePackage(storage, storageKey);
    }

    function has() {
      return hasPersistentGameState(read());
    }

    function clear() {
      return clearPersistentGameState(storage, storageKey);
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
      if (!storage) return { ok: false, message: "当前浏览器不支持本地保存" };
      try {
        storage.setItem(storageKey, JSON.stringify(createPackage(saveOptions.label)));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: String(error?.message || error) };
      }
    }

    function schedule(saveOptions = {}) {
      if (saveSuspended) return;
      if (saveTimer) options.window.clearTimeout(saveTimer);
      saveTimer = options.window.setTimeout(() => {
        saveTimer = 0;
        saveNow(saveOptions);
      }, options.saveDelayMs);
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
    const transientMatchFields = Object.freeze([
      "scanTargetContinuation", "probeSectorScanContinuation", "publicScanContinuation",
      "alienTraceContinuation", "landTargetContinuation", "probeLocationRewardContinuation",
      "cardTriggerContinuation", "cardTriggerFreeMoveContinuation", "type1TriggerEvents",
      "cardTaskCompletionContinuation", "jiuzheOpportunityQueue", "banrenmaOpportunityQueue",
      "turnEndRevealContinuation", "cardCornerFreeMoveContinuation",
      "dataPlacementContinuation", "industryAbilityContinuation", "piratesRaidContinuation",
      "strategySlotContinuation", "industryFreeMoveContinuation",
    ]);

    function clearTransientState(workingRoot = null) {
      if (!workingRoot) return context.submitHostCommand({ kind: "recovery_clear_transient" });
      const { cardState, techGameState } = workingRoot;
      for (const field of transientMatchFields) delete workingRoot.match[field];
      context.uiRuntimeState.discardSelectedHandIndexes = [];
      context.uiRuntimeState.passReserveSelectionDismissed = false;
      context.uiRuntimeState.passReserveSelectedCardId = null;
      context.uiRuntimeState.probeSectorSelectedRocketIds = [];
      context.alienSpeciesRuntime?.clearJiuzheCardPlayDecisionDraft?.();
      context.uiRuntimeState.jiuzheOpportunityOpen = false;
      context.uiRuntimeState.jiuzheCardViewOpen = false;
      context.alienSpeciesRuntime?.clearYichangdianCardGainDecisionDraft?.();
      context.effectExecutors?.clearYichangdianCornerAction?.();
      context.alienSpeciesRuntime?.clearBanrenmaCardGainDecisionDraft?.();
      context.alienSpeciesRuntime?.clearBanrenmaOpportunityDecisionDraft?.();
      context.alienSpeciesRuntime?.clearChongCardGainDecisionDraft?.();
      context.alienSpeciesRuntime?.clearChongFossilDecisionDraft?.();
      context.alienSpeciesRuntime?.clearAmibaCardGainDecisionDraft?.();
      context.alienSpeciesRuntime?.clearAmibaSymbolDecisionDraft?.();
      context.alienSpeciesRuntime?.clearAmibaTraceRemovalDecisionDraft?.();
      context.alienSpeciesRuntime?.clearAomomoCardGainDecisionDraft?.();
      context.alienSpeciesRuntime?.clearRunezuCardGainDecisionDraft?.();
      context.alienSpeciesRuntime?.clearRunezuSymbolBranchDecisionDraft?.();
      context.alienSpeciesRuntime?.clearRunezuFaceSymbolDecisionDraft?.();
      context.uiRuntimeState.alienTracePickerState = null;
      context.closeAlienRevealConfirmationOverlay();
      context.uiRuntimeState.debugAlienTraceModeActive = false;
      context.setActionEffectFlow(workingRoot, null);
      context.clearCompletedEffectFlowForUndo();
      context.uiRuntimeState.effectStepActive = false;
      context.uiRuntimeState.moveHighlightRocketId = null;
      context.uiRuntimeState.movePaymentSelectedHandIndices = [];
      context.uiRuntimeState.playCardSelection = null;
      context.uiRuntimeState.handCardPlayAction = null;
      context.uiRuntimeState.cardCornerQuickAction = null;
      context.historyStepOrder.length = 0;
      context.actionHistory.commitSession();
      context.quickActionHistory.commitSession();
      context.cards.setSelectionActive(cardState, false);
      context.cards.setPlayCardSelectionActive(cardState, false);
      context.cards.setDiscardSelectionActive(cardState, false, 0);
      if (techGameState?.ui) techGameState.ui.industryBorrowMode = false;
      context.tech.setTechSelectionActive(techGameState, false);
      context.interactionChrome.resetAfterRecovery();
      context.closeFinalResultDialog({ silent: true });
    }

    function refreshAfterRecovery(message = "已从行动日志恢复局面", workingRoot = null) {
      if (!workingRoot) return context.submitHostCommand({ kind: "recovery_refresh", message });
      context.setTokenAssetSizes();
      context.renderWheels();
      context.renderSectors();
      context.renderRotateStateToken();
      context.syncPlanetOrbitLandMarkers();
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
      workingRoot.rocketState.statusNote = message;
      context.refreshHelpers.refreshActionState({ includeStateReadout: true });
      context.renderActionLog();
    }

    return Object.freeze({
      clearTransientStateForRecovery: clearTransientState,
      refreshAfterGameRecovery: refreshAfterRecovery,
    });
  }

  function createRecoveryLogController(options = {}) {
    function createSnapshot(meta = {}) {
      const readoutRoot = options.createReadoutRoot();
      return createGameRecoverySnapshot({
        browserServices: options.browserServices,
        ruleLifecycleOptions: {
          seed: meta.seed ?? "browser-host",
          rngState: meta.rngState || { owner: "browser", state: null },
        },
        roundNumber: readoutRoot.turnState.roundNumber,
        turnNumber: readoutRoot.turnState.turnNumber,
        actionCycleNumber: options.getActionCycleNumber(),
        currentPlayerId: readoutRoot.playerState.currentPlayerId,
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
        browserServices: options.browserServices,
        onAfterStateRestored: () => {
          options.getActionCycleNumber();
          options.clearTransientStateForRecovery();
        },
        restoreAiControlSnapshot: options.restoreAiControlSnapshot,
        refreshAfterGameRecovery: applyOptions.skipRefresh ? null : options.refreshAfterGameRecovery,
        getRecoveryMessage: () => options.createReadoutRoot().rocketState.statusNote,
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
    createGameRecoverySnapshot,
    normalizeRecoverableActionLogEntry,
    getRecoverableActionLogEntries,
    createActionLogRecoveryPackage,
    createPersistentGamePackage,
    getPersistentGameStorage,
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

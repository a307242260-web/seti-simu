"use strict";

const assert = require("node:assert/strict");
const recovery = require("./game-recovery");
const servicesApi = require("./browser-host/browser-services");
const viewApi = require("./browser-host/view-state-store");

const RULE_SCHEMA = "seti-rule-composition-save-v1";

function createRecoveryHarness() {
  const view = viewApi.createViewStateStore();
  let ruleEnvelope = { schemaVersion: RULE_SCHEMA, committedState: "round-4", session: null };
  let restoreCalls = 0;
  const services = servicesApi.createBrowserServices({
    ruleLifecycle: {
      save: () => ({ ok: true, envelope: structuredClone(ruleEnvelope) }),
      validateRestore(envelope) {
        if (envelope?.schemaVersion !== RULE_SCHEMA) return { ok: false, code: "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED" };
        if (typeof envelope.committedState !== "string") return { ok: false, code: "RULE_COMPOSITION_COMMITTED_STATE_MISSING" };
        return { ok: true };
      },
      restore(envelope) {
        restoreCalls += 1;
        ruleEnvelope = structuredClone(envelope);
        return { ok: true, projection: { stateVersion: 11 } };
      },
    },
    viewStateStore: view,
  });
  return {
    view,
    services,
    get ruleEnvelope() { return ruleEnvelope; },
    set ruleEnvelope(value) { ruleEnvelope = structuredClone(value); },
    get restoreCalls() { return restoreCalls; },
  };
}

const harness = createRecoveryHarness();
harness.view.dispatch({ type: "overlay.set", activeId: "report" });
const snapshot = recovery.createGameRecoverySnapshot({
  browserServices: harness.services,
  roundNumber: 4,
  turnNumber: 7,
  actionCycleNumber: 3,
  currentPlayerId: "player-blue",
  entryId: 9,
  label: "恢复点",
  runtime: { aiControl: { enabled: true } },
});

assert.equal(snapshot.version, recovery.RECOVERY_SNAPSHOT_VERSION);
assert.equal(snapshot.meta.label, "恢复点");
assert.equal(snapshot.browserCheckpoint.schemaVersion, servicesApi.SCHEMA_VERSION);
assert.equal(Object.hasOwn(snapshot, "committedState"), false);
assert.equal(Object.hasOwn(snapshot, "state"), false);
assert.throws(() => recovery.createGameRecoverySnapshot({}), /Browser Services composition lifecycle capture/);

const pack = recovery.createActionLogRecoveryPackage({
  version: "v1",
  entries: [{ id: 1, recoverySnapshot: { a: 1 } }],
  includeRecovery: false,
  createSnapshot: ({ label }) => ({ label, live: true }),
});
assert.deepEqual(pack.latestSnapshot, { label: "当前局面", live: true });
assert.equal(pack.entries[0].recoverySnapshot, undefined);

const storage = {
  value: `{"version":${recovery.RECOVERY_SNAPSHOT_VERSION},"latestSnapshot":{"ok":true}}`,
  removed: false,
  getItem() { return this.value; },
  removeItem() { this.removed = true; },
};
assert.deepEqual(recovery.readPersistentGamePackage(storage, "seti"), {
  version: recovery.RECOVERY_SNAPSHOT_VERSION,
  latestSnapshot: { ok: true },
});
storage.value = "{bad json";
assert.equal(recovery.readPersistentGamePackage(storage, "seti"), null);
assert.equal(storage.removed, true);

(function testPersistenceControllerOwnsTimerSuspensionAndRestoreAdapter() {
  const memory = new Map();
  const calls = [];
  const entries = [{ id: 4, actionLabel: "扫描" }];
  let timer = null;
  let stable = true;
  const controller = recovery.createPersistenceController({
    window: {
      localStorage: {
        getItem: (key) => memory.get(key) || null,
        setItem: (key, value) => memory.set(key, value),
        removeItem: (key) => memory.delete(key),
      },
      setTimeout(callback) { timer = callback; return 7; },
      clearTimeout() { timer = null; },
    },
    storageKey: "seti-test",
    saveDelayMs: 10,
    version: recovery.RECOVERY_SNAPSHOT_VERSION,
    getEntries: () => entries,
    getActiveReportTab: () => "action",
    createSnapshot: ({ label }) => ({ version: recovery.RECOVERY_SNAPSHOT_VERSION, label }),
    isStable: () => stable,
    applySnapshot(snapshot, options) {
      calls.push(["restore", snapshot.label, options.message]);
      return { ok: true, message: options.message };
    },
    importEntries(savedEntries) {
      calls.push(["import", savedEntries.length]);
    },
    setReportTab(tab) { calls.push(["tab", tab]); },
  });
  controller.schedulePersistentGameStateSave({ label: "延迟保存" });
  assert.equal(typeof timer, "function");
  timer();
  assert.equal(controller.hasPersistentGameState(), true);
  controller.setPersistentGameSaveSuspended(true);
  stable = true;
  assert.equal(controller.savePersistentGameStateNow().skipped, true);
  controller.setPersistentGameSaveSuspended(false);
  assert.equal(controller.restorePersistentGameState().ok, true);
  assert.deepEqual(calls, [
    ["restore", "延迟保存", "已恢复上次保存的局面"],
    ["import", 1],
    ["tab", "action"],
  ]);
})();

(function testRecoveryHostClearsTransientStateAndRoutesUiRefresh() {
  const calls = [];
  const uiRuntimeState = {
    discardSelectedHandIndexes: [1], passReserveSelectionDismissed: true,
    passReserveSelectedCardId: "c1", probeSectorSelectedRocketIds: ["r1"],
    jiuzheOpportunityOpen: true, jiuzheCardViewOpen: true, alienTracePickerState: {},
    debugAlienTraceModeActive: true, effectStepActive: true, moveHighlightRocketId: "r1",
    movePaymentSelectedHandIndices: [0], playCardSelection: {}, handCardPlayAction: {}, cardCornerQuickAction: {},
  };
  const refreshNames = [
    "setTokenAssetSizes", "renderWheels", "renderSectors", "renderRotateStateToken",
    "syncPlanetOrbitLandMarkers", "renderPublicCards", "updatePublicCardControls",
    "renderReservedCards", "renderInitialSelectionArea", "renderPlayerHand", "renderRoundStatus",
    "renderDebugPlayerSwitch", "syncCardSelectionChrome", "syncDiscardSelectionChrome",
    "syncPassReserveSelectionChrome", "syncHandScanSelectionChrome", "syncPlayCardSelectionChrome",
    "syncTechSelectionChrome", "syncIndustryHandSelectionChrome", "syncInteractionFocusChrome", "renderActionLog",
  ];
  const context = Object.fromEntries(refreshNames.map((name) => [name, () => calls.push(name)]));
  Object.assign(context, {
    uiRuntimeState,
    submitHostCommand: (command) => calls.push(command),
    getAlienSpeciesRuntime: () => ({
      clearJiuzheCardPlayDecisionDraft: () => calls.push("clear-jiuzhe-draft"),
    }),
    getEffectExecutors: () => ({
      clearYichangdianCornerAction: () => calls.push("clear-yichangdian-corner"),
    }),
    closeAlienRevealConfirmationOverlay: () => calls.push("close-alien"),
    setActionEffectFlow: (_root, flow) => calls.push(["effect-flow", flow]),
    clearCompletedEffectFlowForUndo: () => calls.push("clear-completed-flow"),
    historyStepOrder: [1, 2],
    actionHistory: { commitSession: () => calls.push("commit-main") },
    quickActionHistory: { commitSession: () => calls.push("commit-quick") },
    cards: {
      setSelectionActive: () => calls.push("card-select"),
      setPlayCardSelectionActive: () => calls.push("card-play"),
      setDiscardSelectionActive: () => calls.push("card-discard"),
    },
    tech: { setTechSelectionActive: () => calls.push("tech-select") },
    interactionChrome: { resetAfterRecovery: () => calls.push("reset-chrome") },
    closeFinalResultDialog: () => calls.push("close-final"),
    refreshHelpers: {
      refreshBoardState: () => calls.push("refresh-board"),
      refreshPlayerPanels: () => calls.push("refresh-players"),
      refreshActionState: () => calls.push("refresh-actions"),
    },
  });
  const host = recovery.createRecoveryHost(context);
  host.clearTransientStateForRecovery();
  assert.deepEqual(calls.shift(), { kind: "recovery_clear_transient" });
  const root = {
    match: { turnEndRevealContinuation: {} },
    cardState: {}, techGameState: { ui: { industryBorrowMode: true } }, rocketState: {},
  };
  host.clearTransientStateForRecovery(root);
  assert.deepEqual(root.match, {});
  assert.ok(calls.includes("clear-jiuzhe-draft"));
  assert.ok(calls.includes("clear-yichangdian-corner"));
  assert.deepEqual(context.historyStepOrder, []);
  assert.equal(root.techGameState.ui.industryBorrowMode, false);
  assert.equal(uiRuntimeState.effectStepActive, false);
  host.refreshAfterGameRecovery("恢复成功", root);
  assert.equal(root.rocketState.statusNote, "恢复成功");
  assert.ok(calls.includes("refresh-board"));
  assert.ok(calls.includes("refresh-actions"));
  assert.ok(calls.includes("renderActionLog"));
})();

(function testRecoveryLogControllerOwnsSnapshotsAndLogRestore() {
  const calls = [];
  const entries = [{ id: 9, actionLabel: "扫描" }];
  const controller = recovery.createRecoveryLogController({
    version: recovery.RECOVERY_SNAPSHOT_VERSION,
    browserServices: harness.services,
    createReadoutRoot: () => ({
      turnState: { roundNumber: 4, turnNumber: 7 },
      playerState: { currentPlayerId: "player-blue" },
      rocketState: { statusNote: "恢复完成" },
    }),
    getActionCycleNumber: () => 3,
    createAiControlSnapshot: () => ({ enabled: true }),
    getStableSnapshot: () => snapshot,
    getEntries: () => entries,
    renderActionLog: () => calls.push("render"),
    schedulePersistentGameStateSave: (options) => calls.push(["save", options.label]),
    clearTransientStateForRecovery: () => calls.push("clear"),
    restoreAiControlSnapshot: () => ({ message: "AI restored" }),
    refreshAfterGameRecovery: (message) => calls.push(["refresh", message]),
    importActionLogEntries: (saved, options) => calls.push(["import", saved.length, options.truncateToEntryId]),
  });
  const attached = controller.attachRecoverySnapshotToActionLogEntry(entries[0], "恢复点");
  assert.notEqual(attached, snapshot);
  assert.equal(attached.meta.entryId, 9);
  assert.equal(attached.meta.label, "恢复点");
  controller.refreshLatestActionLogRecoverySnapshot("最新状态");
  assert.deepEqual(calls.slice(0, 2), ["render", ["save", "最新状态"]]);
  assert.equal(controller.getRecoverableActionLog({ includeRecovery: false })[0].recoverySnapshot, undefined);
  const restored = controller.recoverFromActionLog([{ id: 9, recoverySnapshot: snapshot }], { entryId: 9 });
  assert.equal(restored.ok, true);
  assert.ok(calls.includes("clear"));
  assert.ok(calls.some((call) => Array.isArray(call) && call[0] === "import" && call[2] === 9));
})();

(function testBrowserActionLogCheckpointRestoresOnlyThroughCompositionLifecycle() {
  const restored = [];
  harness.ruleEnvelope = { schemaVersion: RULE_SCHEMA, committedState: "round-1", session: null };
  harness.view.clear();
  const result = recovery.applyGameRecoverySnapshot(snapshot, {
    browserServices: harness.services,
    restoreDeterministicState() { throw new Error("外部确定性回灌不应被调用"); },
    onAfterStateRestored() { restored.push("after-state"); },
    restoreAiControlSnapshot(aiControl) { return { message: `AI:${String(aiControl.enabled)}` }; },
    refreshAfterGameRecovery(message) { restored.push(message); },
  });
  assert.equal(result.ok, true);
  assert.equal(result.snapshotVersion, recovery.RECOVERY_SNAPSHOT_VERSION);
  assert.equal(result.ruleSchemaVersion, RULE_SCHEMA);
  assert.equal(result.stateVersion, 11);
  assert.equal(harness.ruleEnvelope.committedState, "round-4");
  assert.deepEqual(restored, ["after-state", "已从行动日志恢复局面"]);
  assert.equal(harness.view.getSnapshot().overlay.activeId, "report");
})();

(function testOldAndUnknownSchemasFailClosedBeforeLifecycleRestore() {
  for (const rejectedSnapshot of [
    { version: 1, state: {} },
    { state: {} },
    { version: 999, committedState: "{}" },
  ]) {
    const beforeCalls = harness.restoreCalls;
    const rejected = recovery.applyGameRecoverySnapshot(rejectedSnapshot, { browserServices: harness.services });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, "RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED");
    assert.equal(harness.restoreCalls, beforeCalls);
  }

  const beforeCalls = harness.restoreCalls;
  for (const legacy of [
    { version: recovery.RECOVERY_SNAPSHOT_VERSION, committedState: "{}" },
    { version: recovery.RECOVERY_SNAPSHOT_VERSION, state: {} },
  ]) {
    const rejected = recovery.applyGameRecoverySnapshot(legacy, { browserServices: harness.services });
    assert.equal(rejected.code, "RECOVERY_BROWSER_CHECKPOINT_MISSING");
  }
  assert.equal(harness.restoreCalls, beforeCalls, "旧 StateStore schema 不得触发 lifecycle restore");
})();

(function testInvalidBrowserCheckpointFailsBeforeLifecycleRestore() {
  const invalid = structuredClone(snapshot);
  invalid.browserCheckpoint.rules.schemaVersion = "legacy-v0";
  invalid.browserCheckpoint.rules.envelope.schemaVersion = "legacy-v0";
  const beforeCalls = harness.restoreCalls;
  const result = recovery.applyGameRecoverySnapshot(invalid, { browserServices: harness.services });
  assert.equal(result.code, "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED");
  assert.equal(harness.restoreCalls, beforeCalls);
})();

(function testBrowserServicesAreRequiredForRestore() {
  const result = recovery.applyGameRecoverySnapshot(snapshot, {});
  assert.equal(result.code, "RECOVERY_BROWSER_SERVICES_MISSING");
})();

console.log("game recovery composition lifecycle tests passed");

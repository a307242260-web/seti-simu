"use strict";

const assert = require("node:assert/strict");
const recovery = require("./game-recovery");
const servicesApi = require("./browser-host/browser-services");
const viewApi = require("./browser-host/view-state-store");

const RULE_SCHEMA = "seti-browser-rule-composition-save-v1";

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

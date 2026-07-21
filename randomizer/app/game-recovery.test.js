"use strict";

const assert = require("node:assert/strict");
const recovery = require("./game-recovery");
const stateApi = require("../game/state/state-store");
const servicesApi = require("./browser-host/browser-services");
const viewApi = require("./browser-host/view-state-store");

function createCommittedState(overrides = {}) {
  return stateApi.createCommittedGameState({
    gameId: "game-recovery-test",
    rulesetVersion: "test-v1",
    seed: "recovery-seed",
    rngState: { algorithm: "test", state: 7 },
    sequences: { card: 3, rocket: 2 },
    turn: { roundNumber: 4, currentPlayerId: "player-blue" },
    players: { players: [] },
    ...overrides,
  });
}

const store = stateApi.createStateStore(createCommittedState());
const snapshot = recovery.createGameRecoverySnapshot({
  stateStore: store,
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
assert.equal(typeof snapshot.committedState, "string");
assert.equal(Object.hasOwn(snapshot, "state"), false);
assert.equal(snapshot.committedState.includes("aiControl"), false);

assert.throws(() => recovery.createGameRecoverySnapshot({}), /StateStore\.serialize/);

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

const restored = [];
const result = recovery.applyGameRecoverySnapshot(snapshot, {
  stateStore: store,
  restoreDeterministicState(sequences) {
    restored.push(sequences);
  },
  onAfterStateRestored() { restored.push("after-state"); },
  restoreAiControlSnapshot(aiControl) {
    return { message: `AI:${String(aiControl.enabled)}` };
  },
  refreshAfterGameRecovery(message) { restored.push(message); },
});

assert.equal(result.ok, true);
assert.equal(result.snapshotVersion, recovery.RECOVERY_SNAPSHOT_VERSION);
assert.equal(result.committedSchemaVersion, stateApi.SCHEMA_VERSION);
assert.deepEqual(restored[0], { card: 3, rocket: 2 });
assert.deepEqual(restored.slice(1), ["after-state", "已从行动日志恢复局面"]);

for (const rejectedSnapshot of [
  { version: 1, state: {} },
  { state: {} },
  { version: 999, committedState: "{}" },
]) {
  let restoreCalls = 0;
  const rejectingStore = {
    ...store,
    restore(...args) { restoreCalls += 1; return store.restore(...args); },
  };
  const rejected = recovery.applyGameRecoverySnapshot(rejectedSnapshot, {
    stateStore: rejectingStore,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED");
  assert.equal(restoreCalls, 0, "旧/未知 schema 必须在 restore port 前 fail-closed");
}

(function testRuntimeRestoreFailureRollsBackResidentStateBytes() {
  const rollbackStore = stateApi.createStateStore(createCommittedState({ turn: { roundNumber: 1 } }));
  const before = rollbackStore.serialize().serialized;
  const failed = recovery.applyGameRecoverySnapshot(snapshot, {
    stateStore: rollbackStore,
    restoreDeterministicState() { throw new Error("sequence poison"); },
  });
  assert.equal(failed.code, "RECOVERY_COMMITTED_STATE_RESTORE_FAILED");
  assert.equal(rollbackStore.serialize().serialized, before);
})();

(function testBrowserActionLogCheckpointUsesBrowserServicesEnvelope() {
  const browserStore = stateApi.createStateStore(createCommittedState());
  const view = viewApi.createViewStateStore();
  view.dispatch({ type: "overlay.set", activeId: "report" });
  const services = servicesApi.createBrowserServices({ stateStore: browserStore, viewStateStore: view });
  const browserSnapshot = recovery.createGameRecoverySnapshot({
    browserServices: services,
    runtime: { aiControl: { enabled: false } },
  });
  assert.equal(Object.hasOwn(browserSnapshot, "committedState"), false);
  assert.equal(browserSnapshot.browserCheckpoint.schemaVersion, servicesApi.SCHEMA_VERSION);

  const changed = createCommittedState({ stateVersion: 9, turn: { roundNumber: 1 } });
  assert.equal(browserStore.restore(changed).ok, true);
  view.clear();
  const browserResult = recovery.applyGameRecoverySnapshot(browserSnapshot, {
    browserServices: services,
  });
  assert.equal(browserResult.ok, true);
  assert.equal(browserStore.getSnapshot().turn.roundNumber, 4);
  assert.equal(view.getSnapshot().overlay.activeId, "report");
})();

const malformed = recovery.applyGameRecoverySnapshot({
  version: recovery.RECOVERY_SNAPSHOT_VERSION,
  committedState: "{bad",
}, { stateStore: store });
assert.equal(malformed.ok, false);
assert.equal(malformed.code, "STATE_DESERIALIZE_FAILED");

console.log("game recovery StateStore-only tests passed");

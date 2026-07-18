"use strict";

const assert = require("node:assert/strict");
const recovery = require("./game-recovery");

function createLegacyState(overrides = {}) {
  return {
    solarState: {},
    nebulaDataState: {},
    alienGameState: {},
    finalScoringState: { pendingMarks: [] },
    playerState: { players: [], currentPlayerId: "player-blue" },
    turnState: {},
    rocketState: { nextRocketId: 1, playerRocketSequences: {}, statusNote: null },
    planetStatsState: {},
    techGameState: { board: {}, ui: {} },
    cardState: { ui: {} },
    cardTaskState: {},
    setupSelectionState: {},
    ...overrides,
  };
}

const snapshot = recovery.createGameRecoverySnapshot({
  version: 2,
  roundNumber: 4,
  turnNumber: 7,
  actionCycleNumber: 3,
  currentPlayerId: "player-blue",
  entryId: 9,
  label: "恢复点",
  state: createLegacyState({
    playerState: { currentPlayerId: "player-blue" },
  }),
  runtime: {
    aiControl: { enabled: true },
  },
});

assert.equal(snapshot.version, 2);
assert.equal(snapshot.meta.label, "恢复点");
assert.equal(typeof snapshot.committedState, "string");
assert.equal(Object.hasOwn(snapshot, "state"), false);
assert.equal(snapshot.committedState.includes("aiControl"), false);

const pack = recovery.createActionLogRecoveryPackage({
  version: "v1",
  entries: [
    { id: 1, recoverySnapshot: { a: 1 } },
  ],
  includeRecovery: false,
  createSnapshot: ({ label }) => ({ label, live: true }),
});
assert.deepEqual(pack.latestSnapshot, { label: "当前局面", live: true });
assert.equal(pack.entries[0].recoverySnapshot, undefined);

const storage = {
  value: "{\"latestSnapshot\":{\"ok\":true}}",
  removed: false,
  getItem() {
    return this.value;
  },
  removeItem() {
    this.removed = true;
  },
};
assert.deepEqual(recovery.readPersistentGamePackage(storage, "seti"), {
  latestSnapshot: { ok: true },
});

storage.value = "{bad json";
assert.equal(recovery.readPersistentGamePackage(storage, "seti"), null);
assert.equal(storage.removed, true);

const slices = {
  playerState: { currentPlayerId: "before" },
  turnState: { roundNumber: 1 },
};
const restored = [];
const result = recovery.applyGameRecoverySnapshot({
  version: 1,
  state: createLegacyState({
    playerState: { currentPlayerId: "after" },
    turnState: { roundNumber: 4 },
  }),
  runtime: {
    aiControl: { enabled: false },
  },
}, {
  stateSlices: slices,
  restoreMutableObject(target, nextValue) {
    Object.keys(target).forEach((key) => delete target[key]);
    Object.assign(target, structuredClone(nextValue));
    restored.push(structuredClone(nextValue));
  },
  onAfterStateRestored() {
    restored.push("after-state");
  },
  restoreAiControlSnapshot(aiControl) {
    return { message: `AI:${String(aiControl.enabled)}` };
  },
  refreshAfterGameRecovery(message) {
    restored.push(message);
  },
});

assert.equal(result.ok, true);
assert.equal(result.snapshotVersion, 1);
assert.equal(result.committedSchemaVersion, "seti-committed-game-state-v1");
assert.equal(slices.playerState.currentPlayerId, "after");
assert.equal(slices.turnState.roundNumber, 4);
assert.deepEqual(restored, [
  { currentPlayerId: "after" },
  { roundNumber: 4 },
  "after-state",
  "已从行动日志恢复局面",
]);

const untouched = structuredClone(slices);
const rejected = recovery.applyGameRecoverySnapshot({
  version: 999,
  committedState: "{}",
}, {
  stateSlices: slices,
  restoreMutableObject() {
    throw new Error("fail-closed 不得修改切片");
  },
});
assert.equal(rejected.ok, false);
assert.equal(rejected.code, "RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED");
assert.deepEqual(slices, untouched);

console.log("game-recovery tests passed");

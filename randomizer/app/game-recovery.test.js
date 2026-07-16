"use strict";

const assert = require("node:assert/strict");
const recovery = require("./game-recovery");

const snapshot = recovery.createGameRecoverySnapshot({
  version: "v1",
  roundNumber: 4,
  turnNumber: 7,
  actionCycleNumber: 3,
  currentPlayerId: "player-blue",
  entryId: 9,
  label: "恢复点",
  state: {
    playerState: { currentPlayerId: "player-blue" },
  },
  runtime: {
    aiControl: { enabled: true },
  },
});

assert.equal(snapshot.version, "v1");
assert.equal(snapshot.meta.label, "恢复点");
assert.deepEqual(snapshot.state.playerState, { currentPlayerId: "player-blue" });

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
  version: "v1",
  state: {
    playerState: { currentPlayerId: "after" },
    turnState: { roundNumber: 4 },
  },
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
assert.equal(result.snapshotVersion, "v1");
assert.equal(slices.playerState.currentPlayerId, "after");
assert.equal(slices.turnState.roundNumber, 4);
assert.deepEqual(restored, [
  { currentPlayerId: "after" },
  { roundNumber: 4 },
  "after-state",
  "已从行动日志恢复局面",
]);

console.log("game-recovery tests passed");

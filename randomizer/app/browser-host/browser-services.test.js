"use strict";

const assert = require("node:assert/strict");
const stateApi = require("../../game/state/state-store");
const viewApi = require("./view-state-store");
const servicesApi = require("./browser-services");

function createState(version = 0) {
  return stateApi.createCommittedGameState({
    stateVersion: version, gameId: "services", rulesetVersion: "v1", seed: 81,
    rngState: {}, sequences: {}, match: {}, turn: {}, players: {}, solarSystem: {},
    pieces: {}, planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
  });
}

function createHarness() {
  const store = stateApi.createStateStore(createState());
  const view = viewApi.createViewStateStore();
  const memory = new Map();
  const calls = { state: 0, session: 0, debug: 0, downloads: [] };
  let restoredState = null;
  let sessionCheckpoint = { schemaVersion: "seti-effect-session-checkpoint-v1", session: { id: "s1" } };
  const services = servicesApi.createBrowserServices({
    stateStore: store,
    stateRestorePort: { restore(state) { calls.state += 1; restoredState = structuredClone(state); return { ok: true }; } },
    sessionPort: {
      capture: () => ({ ok: true, checkpoint: sessionCheckpoint }),
      validate(checkpoint) { return checkpoint?.schemaVersion === sessionCheckpoint.schemaVersion ? { ok: true, checkpoint } : { ok: false, code: "SESSION_INVALID" }; },
      restore(checkpoint) { calls.session += 1; sessionCheckpoint = structuredClone(checkpoint); return { ok: true }; },
    },
    viewStateStore: view,
    storage: { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) },
    downloadPort: { save(request) { calls.downloads.push(structuredClone(request)); return { ok: true }; } },
    debugCommandPort: { dispatch(command) { calls.debug += 1; return { ok: true, command }; } },
    now: () => new Date("2026-07-19T00:00:00.000Z"),
  });
  return { store, view, services, calls, memory, get restoredState() { return restoredState; } };
}

(function testSeparatedSchemasRoundTripAndViewRebuild() {
  const harness = createHarness();
  harness.view.dispatch({ type: "overlay.set", activeId: "report" });
  const captured = harness.services.capture();
  assert.equal(captured.ok, true);
  assert.equal(captured.envelope.schemaVersion, "seti-browser-services-v1");
  assert.equal(typeof captured.envelope.state.serialized, "string");
  assert.equal(captured.envelope.session.schemaVersion, "seti-effect-session-checkpoint-v1");
  assert.equal(captured.envelope.view.schemaVersion, "seti-browser-host-v1");
  harness.view.clear();
  const restored = harness.services.restore(captured.envelope);
  assert.deepEqual(restored, { ok: true, stateVersion: 0, sessionRestored: true, viewRestored: true });
  assert.equal(harness.calls.state, 1);
  assert.equal(harness.calls.session, 1);
  assert.equal(harness.restoredState.meta.gameId, "services");
  assert.equal(harness.view.getSnapshot().overlay.activeId, "report");
})();

(function testInvalidSessionFailsBeforeAnyStateMutation() {
  const harness = createHarness();
  const envelope = structuredClone(harness.services.capture().envelope);
  envelope.session.checkpoint.schemaVersion = "unknown";
  const result = harness.services.restore(envelope);
  assert.equal(result.code, "SESSION_INVALID");
  assert.equal(harness.calls.state, 0);
  assert.equal(harness.calls.session, 0);
})();

(function testInvalidViewFailsBeforeAnyStateMutation() {
  const harness = createHarness();
  const envelope = structuredClone(harness.services.capture().envelope);
  envelope.view.state.ruleState = { credits: 99 };
  const result = harness.services.restore(envelope);
  assert.equal(result.code, "VIEW_STATE_ROOT_FIELDS_INVALID");
  assert.equal(harness.calls.state, 0);
  assert.equal(harness.calls.session, 0);
})();

(function testStorageDownloadDebugAndFacadeArePortsOnly() {
  const harness = createHarness();
  assert.equal(harness.services.save().ok, true);
  harness.view.clear();
  assert.equal(harness.services.load().ok, true);
  assert.equal(harness.services.download({ filename: "log.md", content: "visible log" }).ok, true);
  assert.deepEqual(harness.calls.downloads[0], { filename: "log.md", content: "visible log", mimeType: "text/plain;charset=utf-8" });
  assert.equal(harness.services.download({ filename: "bad.md", state: harness.store.getSnapshot() }).code, "BROWSER_DOWNLOAD_REQUEST_INVALID");
  const facade = harness.services.createPublicFacade();
  assert.equal(Object.isFrozen(facade), true);
  assert.equal(facade.dispatchDeveloperCommand({ type: "failsafe.pause" }).ok, true);
  assert.equal(harness.calls.debug, 1);
  assert.equal(Object.hasOwn(facade, "stateStore"), false);
  assert.equal(Object.hasOwn(facade, "sessionPort"), false);
})();

(function testRefreshOnlyObservesAndCannotBreakCommit() {
  const store = stateApi.createStateStore(createState());
  let refreshes = 0;
  const subscription = servicesApi.subscribeRefresh({ stateStore: store, refresh() { refreshes += 1; throw new Error("view crashed"); } });
  const working = store.beginWorkingCopy();
  assert.equal(store.compareAndCommit(working.baseVersion, working.state).ok, true);
  assert.equal(store.getSnapshot().meta.stateVersion, 1);
  assert.equal(refreshes, 1);
  subscription.dispose();
})();

console.log("Browser services stage 8 tests passed");

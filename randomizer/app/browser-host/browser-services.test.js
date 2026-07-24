"use strict";

const assert = require("node:assert/strict");
const stateApi = require("../../game/state/state-store");
const viewApi = require("./view-state-store");
const servicesApi = require("./browser-services");

function createState() {
  return stateApi.createCommittedGameState({
    gameId: "browser-services", rulesetVersion: "v1", seed: 81,
    rngState: {}, sequences: {}, match: {}, turn: {}, players: {}, solarSystem: {},
    pieces: {}, planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
  });
}

function committedFingerprint(store) {
  return {
    version: store.getSnapshot().meta.stateVersion,
    bytes: store.serialize().serialized,
  };
}

(function testStorageDownloadTimerFocusAndViewStateCannotMutateRules() {
  const store = stateApi.createStateStore(createState());
  const before = committedFingerprint(store);
  const memory = new Map();
  const calls = [];
  const timers = [];
  const timer = servicesApi.createTimerService({
    setTimeout(callback) { timers.push(callback); return timers.length; },
    clearTimeout(id) { calls.push(["cancel", id]); },
    requestAnimationFrame(callback) { timers.push(callback); return timers.length + 10; },
    cancelAnimationFrame(id) { calls.push(["cancel-frame", id]); },
  });
  const storage = servicesApi.createStorageService({
    storageKey: "seti-test",
    storage: {
      getItem: (key) => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value),
      removeItem: (key) => memory.delete(key),
    },
  });
  const link = { click: () => calls.push("click"), remove: () => calls.push("remove") };
  const download = servicesApi.createDownloadService({
    window: {
      URL: {
        createObjectURL: () => "blob:test",
        revokeObjectURL: (url) => calls.push(["revoke", url]),
      },
    },
    document: {
      body: { append: () => calls.push("append") },
      createElement: () => link,
    },
    Blob: class TestBlob {},
    timerService: timer,
  });
  const focus = servicesApi.createFocusService({ timerService: timer });
  const services = servicesApi.createBrowserServices({
    storageService: storage,
    timerService: timer,
    focusService: focus,
    downloadService: download,
  });
  const view = viewApi.createViewStateStore();

  assert.equal(services.storage.write({ envelope: { schemaVersion: "opaque-v1" } }).ok, true);
  assert.deepEqual(services.storage.read().value, { envelope: { schemaVersion: "opaque-v1" } });
  assert.equal(services.download({ filename: "log.md", content: "visible" }).ok, true);
  assert.equal(services.timer.schedule(() => calls.push("timer"), 0).ok, true);
  assert.equal(services.focus.focus({ focus: () => calls.push("focus") }).ok, true);
  assert.equal(services.focus.scrollIntoView({
    scrollIntoView: (options) => calls.push(["scroll", options]),
  }, { block: "center" }).ok, true);
  view.dispatch({ type: "status.set", note: "下载完成" });
  view.dispatch({ type: "debug.panel", open: true });
  view.dispatch({ type: "debug.sectorCalibration", active: true });

  while (timers.length) timers.shift()();
  assert.deepEqual(committedFingerprint(store), before);
  assert.equal(view.getSnapshot().status.note, "下载完成");
  assert.equal(view.getSnapshot().debug.panelOpen, true);
  assert.equal(view.getSnapshot().debug.sectorCalibration, true);
  assert.equal(Object.hasOwn(services, "capture"), false);
  assert.equal(Object.hasOwn(services, "restore"), false);
  assert.equal(Object.hasOwn(services, "dispatchDeveloperCommand"), false);
})();

(function testHostFailuresAreStructuredAndRuleNeutral() {
  const store = stateApi.createStateStore(createState());
  const before = committedFingerprint(store);
  const throwingStorage = servicesApi.createStorageService({
    storage: {
      getItem() { throw new Error("read poison"); },
      setItem() { throw new Error("write poison"); },
      removeItem() { throw new Error("remove poison"); },
    },
  });
  const throwingTimer = servicesApi.createTimerService({
    setTimeout() { throw new Error("timer poison"); },
    clearTimeout() { throw new Error("cancel poison"); },
  });
  const focus = servicesApi.createFocusService({ timerService: throwingTimer });

  assert.equal(throwingStorage.read().code, "BROWSER_STORAGE_READ_FAILED");
  assert.equal(throwingStorage.write({ safe: true }).code, "BROWSER_STORAGE_WRITE_FAILED");
  assert.equal(throwingStorage.remove().code, "BROWSER_STORAGE_CLEAR_FAILED");
  assert.equal(throwingTimer.schedule(() => {}).code, "BROWSER_TIMER_SCHEDULE_FAILED");
  assert.equal(focus.focus({ focus() { throw new Error("focus poison"); } }).code, "BROWSER_FOCUS_FAILED");
  assert.equal(focus.scrollIntoView({
    scrollIntoView() { throw new Error("scroll poison"); },
  }).code, "BROWSER_SCROLL_FAILED");
  assert.deepEqual(committedFingerprint(store), before);
})();

console.log("Browser services isolation tests passed");

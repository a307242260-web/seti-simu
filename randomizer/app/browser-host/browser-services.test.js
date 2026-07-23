"use strict";

const assert = require("node:assert/strict");
const stateApi = require("../../game/state/state-store");
const viewApi = require("./view-state-store");
const servicesApi = require("./browser-services");

const RULE_SCHEMA = "seti-rule-composition-save-v1";

function createState(version = 0, gameId = "services") {
  return stateApi.createCommittedGameState({
    stateVersion: version, gameId, rulesetVersion: "v1", seed: 81,
    rngState: {}, sequences: {}, match: {}, turn: {}, players: {}, solarSystem: {},
    pieces: {}, planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
  });
}

function createHarness(options = {}) {
  const store = stateApi.createStateStore(createState());
  const view = options.viewStateStore || viewApi.createViewStateStore();
  const memory = new Map();
  const calls = { validate: 0, restore: 0, debug: 0, downloads: [] };
  let session = { id: "session-a" };
  const lifecycle = {
    save() {
      const serialized = store.serialize();
      return serialized.ok ? {
        ok: true,
        envelope: { schemaVersion: RULE_SCHEMA, committedState: serialized.serialized, session: structuredClone(session) },
      } : serialized;
    },
    validateRestore(envelope) {
      calls.validate += 1;
      if (envelope?.schemaVersion !== RULE_SCHEMA) return { ok: false, code: "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED" };
      const loaded = store.deserialize(envelope.committedState);
      return loaded.ok ? { ok: true } : loaded;
    },
    restore(envelope) {
      calls.restore += 1;
      if (options.failRuleRestore) return { ok: false, code: "RULE_RESTORE_POISON" };
      const loaded = store.deserialize(envelope.committedState);
      if (!loaded.ok) return loaded;
      const restored = store.restore(loaded.state);
      if (!restored.ok) return restored;
      session = structuredClone(envelope.session);
      return { ok: true, projection: { stateVersion: restored.stateVersion } };
    },
  };
  const services = servicesApi.createBrowserServices({
    ruleLifecycle: lifecycle,
    viewStateStore: view,
    storage: { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) },
    downloadPort: { save(request) { calls.downloads.push(structuredClone(request)); return { ok: true }; } },
    debugCommandPort: { dispatch(command) { calls.debug += 1; return { ok: true, command }; } },
    now: () => new Date("2026-07-19T00:00:00.000Z"),
  });
  return { store, view, services, calls, memory };
}

(function testCompositionEnvelopeRoundTripAndViewRebuild() {
  const harness = createHarness();
  harness.view.dispatch({ type: "overlay.set", activeId: "report" });
  const captured = harness.services.capture();
  assert.equal(captured.ok, true);
  assert.equal(captured.envelope.schemaVersion, servicesApi.SCHEMA_VERSION);
  assert.equal(captured.envelope.rules.schemaVersion, RULE_SCHEMA);
  assert.equal(typeof captured.envelope.rules.envelope.committedState, "string");
  assert.equal(Object.hasOwn(captured.envelope, "state"), false);
  assert.equal(Object.hasOwn(captured.envelope, "session"), false);
  assert.equal(captured.envelope.view.schemaVersion, servicesApi.VIEW_SCHEMA_VERSION);
  harness.view.clear();
  const restored = harness.services.restore(captured.envelope);
  assert.deepEqual(restored, { ok: true, stateVersion: 0, sessionRestored: true, viewRestored: true });
  assert.equal(harness.calls.restore, 1);
  assert.equal(harness.view.getSnapshot().overlay.activeId, "report");
})();

(function testMissingLifecycleAndLegacyStateStoreFallbackAreRejected() {
  assert.throws(() => servicesApi.createBrowserServices({}), /Rule Composition lifecycle 缺少 save/);
  assert.throws(() => servicesApi.createBrowserServices({
    stateStore: stateApi.createStateStore(createState()),
  }), /Rule Composition lifecycle 缺少 save/);
})();

(function testOldEnvelopeFieldsAndRuleSchemaFailClosedBeforeRestore() {
  const harness = createHarness();
  const legacy = structuredClone(harness.services.capture().envelope);
  legacy.state = { serialized: "legacy" };
  legacy.session = { checkpoint: {} };
  const oldFields = harness.services.restore(legacy);
  assert.equal(oldFields.code, "BROWSER_RECOVERY_FIELDS_UNSUPPORTED");
  assert.deepEqual([...oldFields.unknownKeys].sort(), ["session", "state"]);

  const invalidRule = structuredClone(harness.services.capture().envelope);
  invalidRule.rules.schemaVersion = "legacy-v0";
  invalidRule.rules.envelope.schemaVersion = "legacy-v0";
  assert.equal(harness.services.restore(invalidRule).code, "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED");
  assert.equal(harness.calls.restore, 0, "预验证失败不得调用 composition restore");
})();

(function testInvalidViewFailsBeforeRuleMutation() {
  const harness = createHarness();
  const envelope = structuredClone(harness.services.capture().envelope);
  envelope.view.state.ruleState = { credits: 99 };
  const result = harness.services.restore(envelope);
  assert.equal(result.code, "VIEW_STATE_ROOT_FIELDS_INVALID");
  assert.equal(harness.calls.restore, 0);
})();

(function testViewRestoreFailureRollsBackCompositionBytes() {
  const residentView = viewApi.createViewStateStore();
  const rejectingView = {
    getSnapshot: residentView.getSnapshot,
    validate: residentView.validate,
    clear: residentView.clear,
    restore(snapshot) {
      if (snapshot.overlay?.activeId === "poison") return { ok: false, code: "VIEW_RESTORE_POISON" };
      return residentView.restore(snapshot);
    },
  };
  const harness = createHarness({ viewStateStore: rejectingView });
  const beforeBytes = harness.store.serialize().serialized;
  const envelope = structuredClone(harness.services.capture().envelope);
  const changedStore = stateApi.createStateStore(createState(9, "changed"));
  envelope.rules.envelope.committedState = changedStore.serialize().serialized;
  envelope.view.state.overlay.activeId = "poison";
  const result = harness.services.restore(envelope);
  assert.equal(result.code, "VIEW_RESTORE_POISON");
  assert.equal(harness.store.serialize().serialized, beforeBytes);
  assert.equal(harness.calls.restore, 2, "失败后必须只经 lifecycle 回滚规则状态");
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

(function testBrowserDownloadPortOwnsDomLifecycle() {
  const calls = [];
  const link = {
    click: () => calls.push("click"),
    remove: () => calls.push("remove"),
  };
  const port = servicesApi.createBrowserDownloadPort({
    window: {
      URL: {
        createObjectURL: () => "blob:test",
        revokeObjectURL: (url) => calls.push(`revoke:${url}`),
      },
      setTimeout: (callback) => callback(),
    },
    document: { body: { append: () => calls.push("append") }, createElement: () => link },
    Blob: class TestBlob {},
  });
  assert.equal(port.save({ filename: "log.md", content: "log", mimeType: "text/markdown" }).ok, true);
  assert.deepEqual(calls, ["append", "click", "remove", "revoke:blob:test"]);
})();

(function testLegacyDomainCommandPortOwnsWhitelistAndInputRouting() {
  const submitted = [];
  const target = {
    beginSectorScan(root, count) {
      root.count += count;
      return { ok: true, nested: { count: root.count } };
    },
  };
  const port = servicesApi.createDomainCommandPort({
    getTarget: (domain) => (domain === "scan_flow" ? target : null),
    clonePresentation: (value) => structuredClone(value),
    submitHostCommand(command) { submitted.push(command); return { value: { command } }; },
  });
  const root = { count: 1 };
  const executed = port.executeBrowserDomainCommand(root, {
    domain: "scan_flow", operation: "beginSectorScan", args: [2],
  });
  assert.equal(executed.ok, true);
  assert.equal(executed.value.nested.count, 3);
  assert.notEqual(executed.value.nested, target.nested);
  assert.equal(port.executeBrowserDomainCommand(root, {
    domain: "scan_flow", operation: "forged", args: [],
  }).code, "BROWSER_DOMAIN_COMMAND_UNKNOWN");
  port.bindBrowserDomainCommand("scan_flow", "beginSectorScan")(4);
  const scanCommands = port.bindDomainCommands("scan_flow", ["beginSectorScan"]);
  scanCommands.beginSectorScan(5);
  assert.equal(typeof port.bindDomainCommands("income_runtime").beginIncomeForCurrentPlayer, "function");
  assert.equal(typeof port.bindDomainCommands("card_trigger").buildProbeLocationIndex, "function");
  const effectChoiceCommands = port.bindEffectChoiceCommands(["confirm"]);
  effectChoiceCommands.confirm(1);
  const effectExecutorCommands = port.bindEffectExecutorCommands(["format"]);
  effectExecutorCommands.format("earth");
  assert.equal(typeof port.bindEffectChoiceCommands().handleConditionalSectorChoice, "function");
  assert.equal(typeof port.bindEffectExecutorCommands().executeSectorXScanEffect, "function");
  port.setBrowserStatusNote("ready");
  assert.deepEqual(submitted, [
    { kind: "domain_command", domain: "scan_flow", operation: "beginSectorScan", args: [4] },
    { kind: "domain_command", domain: "scan_flow", operation: "beginSectorScan", args: [5] },
    { kind: "effect_choice_command", operation: "confirm", args: [1] },
    { kind: "effect_executor_command", operation: "format", args: ["earth"] },
    { kind: "ui_set_status_note", message: "ready" },
  ]);
})();

(function testHostCommandPortBuildsNarrowCommands() {
  const submitted = [];
  const port = servicesApi.createHostCommandPort({
    submitHostCommand(command, options) {
      submitted.push({ command, options });
      return { ok: true, value: command.effectIndex ?? command.kind };
    },
  });
  assert.equal(port.bindValue("effect_bar_click", (effectIndex) => ({ effectIndex }))(3), 3);
  assert.equal(port.bindResult("effect_cancel_subflows")().ok, true);
  assert.deepEqual(submitted, [
    { command: { kind: "effect_bar_click", effectIndex: 3 }, options: undefined },
    { command: { kind: "effect_cancel_subflows" }, options: undefined },
  ]);
})();

(function testHostDispatcherAndOperationHandlerFailClosed() {
  const operationHandler = servicesApi.createOperationCommandHandler({
    getTarget: () => ({ ping: (_root, value) => ({ value }) }),
    clonePresentation: structuredClone,
    unknownCode: "OP_UNKNOWN",
    label: "Test",
  });
  const dispatcher = servicesApi.createHostCommandDispatcher({
    getHandlers: () => ({ operation: operationHandler }),
  });
  assert.deepEqual(dispatcher.execute({}, { kind: "operation", operation: "ping", args: [3] }).value, { value: 3 });
  assert.equal(dispatcher.execute({}, { kind: "operation", operation: "missing" }).code, "OP_UNKNOWN");
  assert.equal(dispatcher.execute({}, { kind: "forged" }).code, "BROWSER_HOST_COMMAND_UNKNOWN");
})();

console.log("Browser services composition lifecycle tests passed");

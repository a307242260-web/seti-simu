"use strict";

const assert = require("node:assert/strict");
const recovery = require("./game-recovery");
const viewApi = require("./browser-host/view-state-store");

const RULE_SCHEMA = "seti-rule-composition-save-v1";
const view = viewApi.createViewStateStore();
let ruleEnvelope = { schemaVersion: RULE_SCHEMA, committedState: "round-4", session: null };
let restoreCalls = 0;
const checkpoint = recovery.createBrowserCheckpointAdapter({
  ruleLifecycle: {
    save: () => ({ ok: true, envelope: structuredClone(ruleEnvelope) }),
    validateRestore(envelope) {
      return envelope?.schemaVersion === RULE_SCHEMA
        ? { ok: true }
        : { ok: false, code: "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED" };
    },
    restore(envelope) {
      restoreCalls += 1;
      ruleEnvelope = structuredClone(envelope);
      return { ok: true, projection: { stateVersion: 11 } };
    },
  },
  viewStateStore: view,
  viewSchemaVersion: viewApi.SCHEMA_VERSION,
  now: () => new Date("2026-07-25T00:00:00.000Z"),
});

view.dispatch({
  type: "focus.set",
  entityRef: { kind: "tech-tile", id: "blue-1" },
  controlId: null,
});
const captured = checkpoint.capture();
assert.equal(captured.ok, true);
assert.equal(captured.envelope.schemaVersion, recovery.BROWSER_CHECKPOINT_SCHEMA_VERSION);
assert.equal(captured.envelope.savedAt, "2026-07-25T00:00:00.000Z");
assert.equal(captured.envelope.rules.envelope.committedState, "round-4");
assert.equal(captured.envelope.view.state.focus.entityRef.id, "blue-1");

ruleEnvelope = { schemaVersion: RULE_SCHEMA, committedState: "round-1", session: null };
view.clear();
const restored = checkpoint.restore(captured.envelope);
assert.equal(restored.ok, true);
assert.equal(restored.stateVersion, 11);
assert.equal(restored.viewRestored, true);
assert.equal(ruleEnvelope.committedState, "round-4");
assert.equal(view.getSnapshot().focus.entityRef.id, "blue-1");

for (const invalid of [
  null,
  { ...captured.envelope, schemaVersion: "legacy-v0" },
  { ...captured.envelope, unknown: true },
  {
    ...captured.envelope,
    rules: { ...captured.envelope.rules, schemaVersion: "legacy-v0" },
  },
]) {
  const beforeCalls = restoreCalls;
  assert.equal(checkpoint.restore(invalid).ok, false);
  assert.equal(restoreCalls, beforeCalls, "非法 envelope 不得触发 Rule Composition restore");
}

assert.throws(
  () => recovery.createBrowserCheckpointAdapter({}),
  /Rule Composition lifecycle 缺少 save/,
);

console.log("game recovery composition lifecycle tests passed");

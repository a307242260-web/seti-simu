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

const kernels = require("../game/production-kernel");
const { createSeededRandom, RNG_ALGORITHM } = require("../game/random");
const { buildRuleObservation } = require("./rule-observation");
for (const factory of [kernels.createBrowserProductionKernel, kernels.createSimulationRuleComposition]) {
  for (const seed of ["recovery-world-gate", "seti-free-analyze-v1"]) {
    const random = createSeededRandom(seed);
    const kernel = factory({ seed, random, activePlayerCount: 4,
      projectBrowserState: state => buildRuleObservation(state, seed, "player-white", []),
      rngState: { algorithm: RNG_ALGORITHM, state: random.getState() } });
    const liveView = viewApi.createViewStateStore();
    const adapter = recovery.createBrowserCheckpointAdapter({
      ruleLifecycle: kernel.composition.lifecycle,
      viewStateStore: liveView,
      viewSchemaVersion: viewApi.SCHEMA_VERSION,
    });
    try {
      const saved = adapter.capture();
      assert.equal(saved.ok, true);
      const before = kernel.composition.lifecycle.save().envelope;
      for (const worldVersion of [undefined, "unknown-world-v1",
        seed === "seti-free-analyze-v1" ? "seeded-world-v1" : "human-405-world-v1"]) {
        const broken = structuredClone(saved.envelope);
        const state = JSON.parse(broken.rules.envelope.committedState);
        state.meta.worldVersion = worldVersion;
        broken.rules.envelope.committedState = JSON.stringify(state);
        const result = adapter.restore(broken);
        assert.equal(result.ok, false);
        assert.equal(result.code, "WORLD_VERSION_UNSUPPORTED");
        assert.deepEqual(kernel.composition.lifecycle.save().envelope, before,
          "世界版本错误必须在改变当前游戏之前拒绝");
        assert.deepEqual(liveView.getSnapshot(), saved.envelope.view.state);
      }
      assert.equal(adapter.restore(saved.envelope).ok, true);
      assert.deepEqual(kernel.composition.lifecycle.save().envelope, before);
      assert.equal(kernel.newGame({ seed, initialize: true, activePlayerCount: 4 }).ok, true);
      const start = kernel.composition.inputPort.enumerateActions({})
        .find(action => action.target?.kind === "start_initial_setup");
      assert.ok(start);
      assert.equal(kernel.composition.inputPort.submitAction(start).ok, true);
      const active = adapter.capture().envelope;
      const session = active.rules.envelope.session.session;
      assert.equal(session.phase, "awaiting_input");
      assert.ok(session.undoFrames.length > 0);
      for (const field of ["baseState", "workingState", "committedState",
        ...session.undoFrames.map((_, index) => `undo:${index}`)]) {
        for (const change of ["version", "seed"]) {
          const broken = structuredClone(active);
          const changed = broken.rules.envelope.session.session;
          if (field === "committedState") changed.committedState = structuredClone(changed.workingState);
          const state = field.startsWith("undo:")
            ? changed.undoFrames[Number(field.slice(5))].stateBefore : changed[field];
          if (change === "version") state.meta.worldVersion = "unknown-world-v1";
          else state.meta.seed = "another-normal-world";
          const rejected = adapter.restore(broken);
          assert.equal(rejected.ok, false, `${field}/${change}不能跨世界恢复`);
          assert.deepEqual(kernel.composition.lifecycle.save().envelope, active.rules.envelope);
          assert.deepEqual(liveView.getSnapshot(), active.view.state);
        }
      }
      assert.equal(adapter.restore(active).ok, true);
      assert.deepEqual(kernel.composition.lifecycle.save().envelope, active.rules.envelope);
    } finally { kernel.composition.dispose(); }
  }
}

console.log("game recovery composition lifecycle tests passed");

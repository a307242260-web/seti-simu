"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHeadlessEffectSessionHost } = require("./headless-effect-session-host");

function createHarness(options = {}) {
  let state = {
    stateVersion: 1,
    phase: "turn",
    ownerId: "p1",
    value: 0,
    trace: [],
  };
  const calls = { resolver: 0, recover: 0, skip: 0 };

  function choice(id) {
    return {
      schemaVersion: "seti-standard-action-v1",
      actionId: `choose_reward:p1:${id}`,
      family: "choose_reward",
      phase: "conditional",
      actorId: "p1",
      actorPlayerId: "p1",
      target: { choiceId: id },
    };
  }

  const host = createHeadlessEffectSessionHost({
    captureState: () => structuredClone(state),
    restoreState(snapshot) {
      state = structuredClone(snapshot);
      return { ok: true };
    },
    inspectBoundary() {
      if (options.unknownPending && state.phase === "drain") {
        return {
          ok: false,
          error: {
            code: "HEADLESS_UNSUPPORTED_PENDING",
            message: "state=pendingMystery family=unknown owner=p1",
          },
        };
      }
      if (state.phase === "decision") {
        return {
          ok: true,
          boundary: "conditional_choice",
          decisionType: "conditional_choice",
          actorPlayer: { id: "p1" },
          candidates: [choice("left"), choice("right")],
        };
      }
      if (state.phase === "effect") {
        return {
          ok: true,
          boundary: "draining",
          candidates: [],
          actionEffectActive: true,
          currentEffect: { id: "reward-1", type: "gain_reward" },
        };
      }
      return {
        ok: true,
        boundary: "turn_action",
        decisionType: "turn_action",
        actorPlayer: { id: "p1" },
        candidates: [{ actionId: "pass:p1", family: "pass", actorPlayerId: "p1" }],
      };
    },
    executeAction(action) {
      state.trace.push(`action:${action.family}`);
      state.phase = options.unknownPending ? "drain" : "decision";
      return { ok: true };
    },
    executeDecision(action) {
      state.trace.push(`decision:${action.target.choiceId}`);
      state.value += action.target.choiceId === "right" ? 2 : 1;
      state.phase = "effect";
      return { ok: true };
    },
    advanceDeterministic: () => ({ ok: true, progressed: false }),
    executeCurrentEffect() {
      state.trace.push("effect:gain_reward");
      state.value += 3;
      state.phase = "turn";
      return { ok: true, effectId: "reward-1", type: "gain_reward" };
    },
    projectObservation(workingState, viewer) {
      assert.deepEqual(workingState.snapshot, state, "projection 必须消费当前 session workingState");
      return {
        viewer,
        value: state.value,
        trace: [...state.trace],
        phase: state.phase,
      };
    },
  });

  return { host, calls, state: () => structuredClone(state), choice };
}

function runTrace() {
  const harness = createHarness();
  const main = {
    schemaVersion: "seti-standard-action-v1",
    actionId: "scan:p1:main",
    family: "scan",
    actorId: "p1",
    actorPlayerId: "p1",
  };
  const dispatched = harness.host.submit(main);
  assert.equal(dispatched.ok, true);
  assert.equal(dispatched.phase, "awaiting_input");
  assert.deepEqual(
    harness.host.getBoundary().candidates.map((action) => action.actionId),
    ["choose_reward:p1:left", "choose_reward:p1:right"],
  );
  assert.deepEqual(harness.host.observe("p1").trace, ["action:scan"]);
  const checkpoint = harness.host.createCheckpoint();
  assert.equal(checkpoint.replayCursor, 1, "未确认 Decision 不得写 confirmed replay");
  const resolved = harness.host.submit(harness.choice("right"));
  assert.equal(resolved.ok, true);
  assert.equal(resolved.phase, "completed");
  assert.deepEqual(harness.state().trace, ["action:scan", "decision:right", "effect:gain_reward"]);
  const journal = harness.host.getJournal();
  assert.deepEqual(journal.replay.map((entry) => entry.kind), ["action", "decision"]);
  assert.deepEqual(journal.effects.map((entry) => entry.type), [
    "headless_submit_standard_action",
    "headless_deterministic_drain",
    "headless_standard_decision",
    "headless_deterministic_drain",
    "headless_deterministic_drain",
  ]);
  return { checkpoint, finalState: harness.state(), journal };
}

const browserTrace = runTrace();
const headlessTrace = runTrace();
assert.deepEqual(headlessTrace.finalState, browserTrace.finalState, "同 Action/Decision trace 的 working/final state 必须一致");
assert.deepEqual(headlessTrace.journal, browserTrace.journal, "同 Action/Decision trace 的 Effect/journal 顺序必须一致");

const restoredHarness = createHarness();
assert.equal(restoredHarness.host.restoreCheckpoint(browserTrace.checkpoint).ok, true);
assert.deepEqual(restoredHarness.host.observe("p1").trace, ["action:scan"]);
assert.equal(restoredHarness.host.submit(restoredHarness.choice("right")).ok, true);
assert.deepEqual(restoredHarness.state(), browserTrace.finalState, "非零 checkpoint fork 必须恢复 workingState 与结果");

const unknownHarness = createHarness({ unknownPending: true });
const rejected = unknownHarness.host.submit({
  actionId: "scan:p1:unknown",
  family: "scan",
  actorPlayerId: "p1",
});
assert.equal(rejected.ok, false);
assert.equal(rejected.session.phase, "aborted");
assert.equal(rejected.session.failure.code, "HEADLESS_UNSUPPORTED_PENDING");
assert.deepEqual(unknownHarness.calls, { resolver: 0, recover: 0, skip: 0 });

const source = fs.readFileSync(path.join(__dirname, "headless-effect-session-host.js"), "utf8");
for (const forbidden of ["runAiPendingStep", "recoverPendingAction", "skipHeadlessActionEffect", "document."]) {
  assert.equal(source.includes(forbidden), false, `训练宿主不得引用 ${forbidden}`);
}

console.log("headless Effect Session host tests passed");

"use strict";

const assert = require("node:assert/strict");
const policyPort = require("../../game/ai/policy-port");
const effectSession = require("../../game/effects/session-runtime");
const inputApi = require("./input-adapter");
const viewStateApi = require("./view-state-store");

let forbiddenReads = 0;
const poisonedOptions = new Proxy({}, {
  get(_target, key) {
    if (["document", "window", "overlay", "renderer", "pickerResolver", "pendingResolver"].includes(String(key))) {
      forbiddenReads += 1;
      throw new Error(`forbidden ${String(key)}`);
    }
    return undefined;
  },
});
const policyInputApi = require("./policy-input-adapter");

const ACTION = Object.freeze({
  schemaVersion: "seti-standard-action-v1",
  family: "launch",
  phase: "main",
  actionId: "launch:p1:r1",
  actorId: "p1",
  stateVersion: 1,
  decisionVersion: 1,
  target: { rocketId: "r1" },
  payload: {},
  summary: "发射",
});
const CHOICES = ["credit", "score"].map((reward) => Object.freeze({
  schemaVersion: "seti-standard-action-v1",
  family: "choose_reward",
  phase: "conditional",
  actionId: `choose_reward:p1:${reward}`,
  actorId: "p1",
  stateVersion: 1,
  decisionVersion: 1,
  target: { reward },
  payload: {},
  summary: reward,
}));

function createHarness() {
  const runtime = effectSession.createRuntime({ getStateVersion: (state) => state.version });
  runtime.registerExecutor("mark", (state) => ({
    ok: true,
    nextState: { ...state, order: [...state.order, "mark"] },
    events: [{ type: "marked" }],
    logs: [{ type: "mark-log" }],
  }));
  runtime.registerExecutor("reward", {
    getLegalChoices: () => structuredClone(CHOICES),
    resolveDecision(state, _effect, choice) {
      return {
        ok: true,
        nextState: { ...state, order: [...state.order, `reward:${choice.target.reward}`] },
        events: [{ type: "rewarded", reward: choice.target.reward }],
        logs: [{ type: "reward-log", reward: choice.target.reward }],
      };
    },
  });
  let session = null;
  let committed = { version: 1, order: [] };
  const submissions = [];
  const viewStore = viewStateApi.createViewStateStore();
  const input = inputApi.createBrowserInputAdapter({
    dispatchAction(action) {
      submissions.push(["action", action.actionId]);
      const dispatched = runtime.dispatchAction(committed, action, () => ({ effects: [
        { type: "mark" },
        { type: "reward", kind: "decision", ownerId: "p1", decisionKind: "choose_reward" },
      ] }));
      if (!dispatched.ok) return dispatched;
      session = dispatched.session;
      return runtime.drain(session);
    },
    submitDecision(submission) {
      submissions.push(["decision", submission.choice.actionId]);
      const resolved = runtime.resolveDecision(session, submission);
      if (!resolved.ok) return resolved;
      const drained = runtime.drain(session);
      if (session.phase === "completed") committed = structuredClone(session.committedState);
      return drained;
    },
    viewStateStore: viewStore,
  });
  function readBoundary() {
    if (!session) return { kind: "action", actorId: "p1", stateVersion: 1, decisionVersion: 1, legalActions: [ACTION] };
    const inspected = runtime.inspect(session);
    if (inspected.phase === "awaiting_input") return {
      kind: "decision",
      actorId: inspected.decision.ownerId,
      stateVersion: 1,
      decisionVersion: inspected.decision.decisionVersion,
      decisionId: inspected.decision.decisionId,
      legalActions: inspected.decision.choices,
    };
    return { kind: "terminal", terminal: { phase: inspected.phase } };
  }
  return {
    input,
    readBoundary,
    readObservation: () => ({ publicState: { order: [...(session?.workingState.order || committed.order)] } }),
    snapshot: () => ({ state: structuredClone(committed), journal: structuredClone(session.journal), submissions: structuredClone(submissions) }),
  };
}

function createTracePolicy(actionIds) {
  let index = 0;
  return {
    decide(context) {
      const actionId = actionIds[index++];
      assert(context.legalActions.some((action) => action.actionId === actionId));
      return policyPort.createPolicyDecision(context, {
        actionId,
        policyType: "heuristic",
        policyVersion: "fixture-v1",
        diagnostics: { reasonCode: "fixed-trace" },
      });
    },
  };
}

(async function run() {
  const player = createHarness();
  assert.equal(player.input.dispatchAction(ACTION).ok, true);
  const playerDecision = player.readBoundary();
  const playerDecisionResult = player.input.submitDecision({
    decisionId: playerDecision.decisionId,
    decisionVersion: playerDecision.decisionVersion,
    choice: playerDecision.legalActions[1],
  });
  assert.equal(playerDecisionResult.ok, true, JSON.stringify(playerDecisionResult));

  const ai = createHarness();
  const driver = policyInputApi.createPolicyInputAdapter({
    ...poisonedOptions,
    policy: createTracePolicy([ACTION.actionId, CHOICES[1].actionId]),
    readBoundary: ai.readBoundary,
    readObservation: ai.readObservation,
    inputAdapter: ai.input,
  });
  assert.equal((await driver.runOnce()).ok, true);
  assert.equal((await driver.runOnce()).ok, true);
  assert.deepEqual(ai.snapshot(), player.snapshot(), "玩家与 Policy 固定 Action/Decision trace 必须完全等价");
  assert.deepEqual(ai.snapshot().submissions, [
    ["action", ACTION.actionId],
    ["decision", CHOICES[1].actionId],
  ]);
  assert.equal(forbiddenReads, 0, "Policy 热路径不得读取 DOM/renderer/picker/pending resolver");

  let submissions = 0;
  const unknownDriver = policyInputApi.createPolicyInputAdapter({
    policy: createTracePolicy(["unknown"]),
    readBoundary: () => ({
      kind: "decision",
      actorId: "p1",
      stateVersion: 1,
      decisionVersion: 3,
      decisionId: "unknown-decision",
      legalActions: [{ ...CHOICES[0], family: "unknown_family", decisionVersion: 3 }],
    }),
    readObservation: () => ({}),
    inputAdapter: { dispatchAction() { submissions += 1; }, submitDecision() { submissions += 1; } },
  });
  assert.equal((await unknownDriver.runOnce()).code, "POLICY_INPUT_FAMILY_UNSUPPORTED");
  assert.equal(submissions, 0, "未知 Decision 必须 fail-closed");

  let staleBoundary = { kind: "action", actorId: "p1", stateVersion: 1, decisionVersion: 1, legalActions: [ACTION] };
  let release;
  const staleDriver = policyInputApi.createPolicyInputAdapter({
    policy: {
      decide(context) {
        return new Promise((resolve) => { release = () => resolve(policyPort.createPolicyDecision(context, {
          actionId: ACTION.actionId,
          policyType: "heuristic",
          policyVersion: "fixture-v1",
        })); });
      },
    },
    readBoundary: () => staleBoundary,
    readObservation: () => ({}),
    inputAdapter: { dispatchAction() { submissions += 1; }, submitDecision() { submissions += 1; } },
  });
  const pending = staleDriver.runOnce();
  staleBoundary = { ...staleBoundary, decisionVersion: 2, legalActions: [{ ...ACTION, decisionVersion: 2 }] };
  release();
  assert.equal((await pending).code, "POLICY_INPUT_STALE");
  assert.equal(submissions, 0, "stale Policy 响应不得提交");

  assert.equal(policyInputApi.normalizeBoundary({ kind: "overlay_picker" }).code, "POLICY_INPUT_BOUNDARY_UNSUPPORTED");
  console.log("browser policy input adapter contract passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

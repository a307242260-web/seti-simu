"use strict";

const assert = require("node:assert/strict");
const policyPort = require("./policy-port");

function action(actionId = "pass:p1") {
  return {
    schemaVersion: policyPort.STANDARD_ACTION_SCHEMA_VERSION,
    family: "pass",
    phase: "main",
    actionId,
    actorId: "p1",
    stateVersion: 4,
    decisionVersion: 9,
    target: {},
    payload: {},
    summary: "PASS",
  };
}

function context() {
  return policyPort.createDecisionContext({
    requestId: "request-1",
    seatId: "p1",
    stateVersion: 4,
    decisionVersion: 9,
    observation: { publicState: { round: 2 }, selfState: { credits: 3 } },
    legalActions: [action()],
    deterministicContext: { seed: "fixed" },
  });
}

function decision(current, overrides = {}) {
  return {
    ...policyPort.createPolicyDecision(current, {
      actionId: current.legalActions[0].actionId,
      policyType: "heuristic",
      policyVersion: "fixture-v1",
      diagnostics: { confidence: 0.75 },
    }),
    ...overrides,
  };
}

const current = context();
assert.equal(Object.isFrozen(current), true);
assert.equal(Object.isFrozen(current.legalActions[0]), true);
assert.throws(
  () => policyPort.createDecisionContext({
    requestId: "forbidden",
    seatId: "p1",
    stateVersion: 4,
    decisionVersion: 9,
    observation: { deckOrder: ["secret"] },
    legalActions: [action()],
  }),
  (error) => error.code === "POLICY_FORBIDDEN_FIELD",
);
assert.throws(
  () => policyPort.createDecisionContext({
    requestId: "wrong-owner",
    seatId: "p2",
    stateVersion: 4,
    decisionVersion: 9,
    legalActions: [action()],
  }),
  (error) => error.code === "POLICY_ACTION_ACTOR_MISMATCH",
);

let validationCalls = 0;
const validator = {
  registry: {
    validate(_runtime, selected) {
      validationCalls += 1;
      return selected.actionId === "pass:p1"
        ? { ok: true }
        : { ok: false, code: "STANDARD_ACTION_NOT_LEGAL" };
    },
  },
  runtimeContext: {},
};
assert.equal(policyPort.validatePolicyDecision(current, decision(current), validator).ok, true);
assert.equal(validationCalls, 1);
for (const [submitted, code] of [
  [decision(current, { requestId: "other" }), "POLICY_REQUEST_MISMATCH"],
  [decision(current, { seatId: "p2" }), "POLICY_SEAT_MISMATCH"],
  [decision(current, { stateVersion: 5 }), "POLICY_STALE"],
  [decision(current, { actionId: "unknown" }), "POLICY_ACTION_NOT_LEGAL"],
  [{ ...decision(current), statePatch: { credits: 99 } }, "POLICY_DECISION_FIELD_FORBIDDEN"],
]) {
  assert.equal(policyPort.validatePolicyDecision(current, submitted, validator).code, code);
}

function createTrackedRequest() {
  const calls = { validator: 0, registry: 0, submit: 0 };
  const request = policyPort.createPolicyRequestSession({
    context: current,
    validateDecision() {
      calls.validator += 1;
      calls.registry += 1;
      calls.submit += 1;
      return { ok: true };
    },
  });
  return { request, calls };
}

const firstResponse = createTrackedRequest();
assert.equal(firstResponse.request.accept(decision(current), {}).ok, true);
assert.deepEqual(firstResponse.calls, { validator: 1, registry: 1, submit: 1 });
assert.equal(firstResponse.request.accept(decision(current), {}).code, "POLICY_DUPLICATE_RESPONSE");
assert.deepEqual(
  firstResponse.calls,
  { validator: 1, registry: 1, submit: 1 },
  "重复响应不得再次进入 validator 或其下游链路",
);

for (const [settleRequest, expectedSettleCode] of [
  [(request) => request.cancel(), "POLICY_CANCELLED"],
  [(request) => request.expire(), "POLICY_TIMEOUT"],
  [(request) => request.invalidate(), "POLICY_REQUEST_INVALIDATED"],
  [(request) => request.reject(new Error("policy failed")), "POLICY_FAILURE"],
]) {
  const lateResponse = createTrackedRequest();
  assert.equal(settleRequest(lateResponse.request).code, expectedSettleCode);
  assert.equal(lateResponse.request.accept(decision(current), {}).code, "POLICY_LATE_RESPONSE");
  assert.deepEqual(
    lateResponse.calls,
    { validator: 0, registry: 0, submit: 0 },
    `${expectedSettleCode} 后的迟到响应不得进入 validator 或其下游链路`,
  );
}

(async () => {
  let release;
  let capturedSession;
  const result = policyPort.runPolicy(
    () => new Promise((resolve) => { release = resolve; }),
    current,
    {
      ...validator,
      getRuntimeContext: () => validator.runtimeContext,
      now: () => 100,
      deadlineAt: 101,
      setTimer(callback) { callback(); return 1; },
      clearTimer() {},
      onSession(session) { capturedSession = session; },
    },
  );
  assert.equal((await result).code, "POLICY_TIMEOUT");
  release(decision(current));
  await Promise.resolve();
  assert.equal(capturedSession.snapshot().status, "timed_out");
  assert.equal(validationCalls, 1, "迟到响应不得重新进入 validator");
  console.log("policy port protocol tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

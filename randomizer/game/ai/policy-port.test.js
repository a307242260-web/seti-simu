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
{
  const shared = { slots: [1, 2], nested: { value: 3 } };
  const input = { left: shared, right: shared, repeated: [shared, shared] };
  const copied = policyPort.createDecisionContext({ ...current, observation: input });
  shared.slots.push(4);
  assert.deepEqual(copied.observation.left.slots, [1, 2]);
  assert.deepEqual(copied.observation.right.slots, [1, 2]);
  assert.equal(Object.isFrozen(shared), false);
  assert.equal(Object.isFrozen(copied.observation.repeated[0].nested), true);
  const cyclic = {};
  cyclic.self = cyclic;
  const symbol = { [Symbol("not-json")]: 1 };
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, "value", { enumerable: true, get() { getterCalls += 1; return 1; } });
  for (const bad of [cyclic, symbol, accessor, new Date(), { value: NaN }, { value: Infinity },
    { deckOrder: ["hidden"] }]) {
    assert.throws(() => policyPort.createDecisionContext({ ...current, observation: { a: bad, b: bad } }),
      (error) => ["POLICY_NOT_SERIALIZABLE", "POLICY_FORBIDDEN_FIELD"].includes(error.code));
  }
  assert.equal(getterCalls, 0, "校验不能调用accessor或通过重复引用绕过拒绝");
}
{
  const shared = { value: 1 };
  const input = { first: shared, branches: [{ shared }, { shared }] };
  input.branches[1].back = input.branches;
  assert.throws(() => policyPort.createDecisionContext({ ...current, observation: input }),
    (error) => error.code === "POLICY_NOT_SERIALIZABLE"
      && error.message === "$.observation.branches[1].back 含循环引用");
  delete input.branches[1].back;
  const copied = policyPort.createDecisionContext({ ...current, observation: input });
  assert.equal(copied.observation.first, copied.observation.branches[1].shared);
  assert.notEqual(copied.observation.first, shared);
  shared.deckOrder = ["hidden"];
  assert.throws(() => policyPort.createDecisionContext({ ...current, observation: input }),
    (error) => error.code === "POLICY_FORBIDDEN_FIELD" && error.path === "$.observation.first.deckOrder",
    "下一请求必须重新校验，不能复用前次完成副本");
}
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

console.log("policy port protocol tests passed");

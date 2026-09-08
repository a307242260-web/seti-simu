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
// HDF的Policy输入不携带续用证据；相同证据仍保留给计划提取与外部诊断。
{
  const model = require("./outcome-model");
  const plans = require("./plan-continuation");
  const { createHeuristicDecisionFunction } = require("./heuristic-decision-function");
  const root = { ...action("choose_target:root"), family: "choose_target", phase: "conditional" };
  const next = { ...root, actionId: "choose_target:next" };
  const observation = model.createDecisionObservation({
    publicState: { roundNumber: 1, players: [{ playerId: "p1", resources: { score: 0 } }],
      board: { planets: {}, aliens: {}, techSupply: { stacks: {} } } },
    selfState: { playerId: "p1", hand: [] },
  }, { seatId: "p1" });
  const steps = [root, next].map(action => plans.capturePlanStep({ action, observation }));
  let checked = false;
  let invalidObservation = false;
  const policyObservations = [];
  const decisionFunction = createHeuristicDecisionFunction({
    composition: { counterfactualPort: {
      selectCardRevealChoices(actions) {
        assert.ok(actions.every(entry => entry.target?.kind !== "counted-move-reveal"),
          "本测试替身仅覆盖非展示的Policy证据传递");
        return actions;
      },
      evaluate: () => [{
      schemaVersion: model.OUTCOME_SCHEMA_VERSION, actionId: root.actionId,
      status: "settled", confidence: "high", rootObservation: observation,
      leaves: [0, 1].map(index => ({ leafId: `leaf:${index}`, status: "settled",
        observation: invalidObservation && index === 1
          ? { ...observation, publicState: { ...observation.publicState, invalidNumber: NaN } }
          : observation,
        actionChain: [root.actionId, next.actionId], executionStepCount: 2, planSteps: steps,
        legalSuccessors: [next], terminalReason: "settled" })),
    }] } },
    policy: {
      getProvenance: () => ({ type: "heuristic", version: "test" }),
      decide(context) {
        const leaf = context.actionOutcomes[0].leaves[0];
        assert.equal(Object.hasOwn(leaf, "planSteps"), false);
        assert.deepEqual(leaf.actionChain, [root.actionId, next.actionId]);
        assert.equal(Object.isFrozen(leaf.observation), true);
        assert.equal(leaf.observation, context.actionOutcomes[0].leaves[1].observation,
          "同批相等的不可变叶观察共享，叶和链仍独立保留");
        policyObservations.push(leaf.observation);
        checked = true;
        return policyPort.createPolicyDecision(context, { actionId: root.actionId,
          policyType: "heuristic", policyVersion: "test" });
      },
    },
  });
  const result = decisionFunction.run({ seatId: "p1", legalActions: [root], observation });
  assert.equal(checked, true);
  assert.deepEqual(result.actionOutcomes[0].leaves[0].planSteps, steps);
  assert.notEqual(result.actionOutcomes[0].leaves[0].planSteps, steps);
  assert.equal(result.plan.nextActionId, next.actionId);
  assert.notEqual(result.actionOutcomes[0].leaves[0].observation,
    result.actionOutcomes[0].leaves[1].observation, "原始对外结果不进行驻留合并");
  decisionFunction.run({ seatId: "p1", legalActions: [root], observation });
  assert.notEqual(policyObservations[0], policyObservations[1], "不跨请求持有共享观察");
  invalidObservation = true;
  assert.throws(() => decisionFunction.run({ seatId: "p1", legalActions: [root], observation }),
    error => error.code === "POLICY_NOT_SERIALIZABLE", "无效观察不能被已有有效代表覆盖");
}
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

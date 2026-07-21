const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const standardAction = require("../actions/standard-action");
const policyPort = require("./policy-port");

function createFixture() {
  const state = {
    actorId: "blue",
    stateVersion: 7,
    decisionVersion: 11,
    executed: [],
    journal: [],
  };
  const registry = standardAction.createRegistry({
    getAuthority(context) {
      return {
        actorId: context.actorId,
        stateVersion: context.stateVersion,
        decisionVersion: context.decisionVersion,
      };
    },
  });
  registry.register(standardAction.createOptionDefinition("scan", {
    getOptions() {
      return {
        ok: true,
        choices: [
          { target: { sectorId: "sector-a" }, payload: { cost: 1 }, label: "扫描 A" },
          { target: { sectorId: "sector-b" }, payload: { cost: 2 }, label: "扫描 B" },
        ],
      };
    },
    canExecute() { return { ok: true }; },
    execute(context, selection) {
      context.executed.push(selection.target.sectorId);
      context.journal.push(selection.target.sectorId);
      return { ok: true };
    },
  }));
  const legalActions = registry.enumerate(state, { family: "scan" });
  const context = policyPort.createDecisionContext({
    requestId: "episode-1:decision-11",
    seatId: "blue",
    stateVersion: state.stateVersion,
    decisionVersion: state.decisionVersion,
    observation: {
      perspectivePlayerId: "blue",
      publicState: { players: [{ id: "red", handCount: 4 }] },
      selfState: { hand: [{ cardId: "self-card" }] },
    },
    legalActions,
    deterministicContext: { seed: "fixed-policy-port", requestOrdinal: 11, rngCursor: 3 },
  });
  return { state, registry, legalActions, context };
}

function decision(context, actionId, policyType = "heuristic") {
  return policyPort.createPolicyDecision(context, {
    actionId,
    policyType,
    policyVersion: policyType === "learned" ? "model-v4" : "heuristic-v2",
    modelChecksum: policyType === "learned" ? "sha256:learned-fixture" : null,
    diagnostics: { confidence: 0.75, reasonCode: "fixture-choice" },
  });
}

{
  const left = createFixture();
  const right = createFixture();
  assert.deepEqual(left.context, right.context, "固定 seed/version 必须生成相同 DecisionContext/legal set");
  const leftDecision = decision(left.context, left.context.legalActions[0].actionId);
  const rightDecision = decision(right.context, right.context.legalActions[0].actionId);
  const leftValidated = policyPort.validatePolicyDecision(left.context, leftDecision, {
    registry: left.registry,
    runtimeContext: left.state,
  });
  const rightValidated = policyPort.validatePolicyDecision(right.context, rightDecision, {
    registry: right.registry,
    runtimeContext: right.state,
  });
  assert.equal(left.registry.execute(left.state, leftValidated.action).ok, true);
  assert.equal(right.registry.execute(right.state, rightValidated.action).ok, true);
  assert.deepEqual(left.state.journal, right.state.journal, "同 checkpoint 选择必须保持 replay journal parity");
}

{
  const { state, registry, context } = createFixture();
  assert.ok(Object.isFrozen(context));
  assert.ok(Object.isFrozen(context.observation.selfState.hand));
  assert.notStrictEqual(context.observation.selfState.hand, context);
  assert.throws(() => { context.legalActions.push({}); }, TypeError);

  const heuristic = () => decision(context, context.legalActions[0].actionId, "heuristic");
  const learned = () => decision(context, context.legalActions[1].actionId, "learned");
  for (const policy of [heuristic, learned]) {
    const selected = policy(context);
    const validated = policyPort.validatePolicyDecision(context, selected, { registry, runtimeContext: state });
    assert.equal(validated.ok, true);
    assert.equal(validated.action.actionId, selected.actionId);
  }
  assert.deepEqual(state.executed, [], "公共 validator 只能复核，不得执行或写 journal");
  const validated = policyPort.validatePolicyDecision(context, heuristic(context), { registry, runtimeContext: state });
  assert.equal(registry.execute(state, validated.action).ok, true, "Host 显式提交后才进入共享 registry");
  assert.deepEqual(state.executed, ["sector-a"]);
}

{
  const { state, registry, context } = createFixture();
  const unknown = decision(context, "scan:not-legal");
  assert.equal(
    policyPort.validatePolicyDecision(context, unknown, { registry, runtimeContext: state }).code,
    "POLICY_ACTION_NOT_LEGAL",
  );
  const wrongSchema = { ...decision(context, context.legalActions[0].actionId), schemaVersion: "future" };
  assert.equal(
    policyPort.validatePolicyDecision(context, wrongSchema, { registry, runtimeContext: state }).code,
    "POLICY_DECISION_SCHEMA_MISMATCH",
  );
  const statePatch = { ...decision(context, context.legalActions[0].actionId), statePatch: { credits: 99 } };
  assert.equal(
    policyPort.validatePolicyDecision(context, statePatch, { registry, runtimeContext: state }).code,
    "POLICY_DECISION_FIELD_FORBIDDEN",
  );
  const missingModel = {
    ...decision(context, context.legalActions[0].actionId),
    policy: { type: "learned", version: "model-v5", modelChecksum: null },
  };
  assert.equal(
    policyPort.validatePolicyDecision(context, missingModel, { registry, runtimeContext: state }).code,
    "POLICY_METADATA_INVALID",
  );
  state.actorId = "red";
  assert.equal(
    policyPort.validatePolicyDecision(context, decision(context, context.legalActions[0].actionId), {
      registry,
      runtimeContext: state,
    }).code,
    "STANDARD_ACTION_ACTOR_MISMATCH",
  );
  state.actorId = "blue";
  state.stateVersion += 1;
  assert.equal(
    policyPort.validatePolicyDecision(context, decision(context, context.legalActions[0].actionId), {
      registry,
      runtimeContext: state,
    }).code,
    "STANDARD_ACTION_STALE",
  );
  assert.deepEqual(state.executed, []);
  assert.deepEqual(state.journal, []);
}

{
  const { legalActions } = createFixture();
  const base = {
    requestId: "viewer-negative",
    seatId: "blue",
    stateVersion: 7,
    decisionVersion: 11,
    legalActions,
  };
  assert.throws(
    () => policyPort.createDecisionContext({
      ...base,
      legalActions: [{ ...legalActions[0], schemaVersion: "future" }],
    }),
    (error) => error.code === "POLICY_ACTION_SCHEMA_MISMATCH",
  );
  assert.throws(
    () => policyPort.createDecisionContext({
      ...base,
      legalActions: [{ ...legalActions[0], actorId: "red" }],
    }),
    (error) => error.code === "POLICY_ACTION_ACTOR_MISMATCH",
  );
  assert.throws(
    () => policyPort.createDecisionContext({ ...base, observation: { opponentHands: [{ cardId: "hidden" }] } }),
    (error) => error.code === "POLICY_FORBIDDEN_FIELD" && /opponentHands/.test(error.path),
  );
  assert.throws(
    () => policyPort.createDecisionContext({ ...base, observation: { publicState: { deckOrder: [1, 2] } } }),
    (error) => error.code === "POLICY_FORBIDDEN_FIELD",
  );
  assert.throws(
    () => policyPort.createDecisionContext({ ...base, observation: { actionGraph: { net: 99 } } }),
    (error) => error.code === "POLICY_FORBIDDEN_FIELD",
  );
  assert.throws(
    () => policyPort.createDecisionContext({ ...base, observation: { value: 1, get executor() { return () => {}; } } }),
    (error) => error.code === "POLICY_NOT_SERIALIZABLE",
  );
}

{
  const poisonNames = ["document", "window", "renderer", "pickerResolver", "effectDrain", "stateStore"];
  const originals = new Map();
  let poisonReads = 0;
  for (const name of poisonNames) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        poisonReads += 1;
        throw new Error(`forbidden global read: ${name}`);
      },
    });
  }
  try {
    const { state, registry, context } = createFixture();
    const selected = decision(context, context.legalActions[0].actionId);
    assert.equal(policyPort.validatePolicyDecision(context, selected, { registry, runtimeContext: state }).ok, true);
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
  assert.equal(poisonReads, 0, "Policy 端口不得读取 DOM/renderer/resolver/effect/state store 全局");
}

{
  const { state, registry, context } = createFixture();
  const session = policyPort.createPolicyRequestSession({
    context,
    validateDecision(selected, runtimeContext) {
      return policyPort.validatePolicyDecision(context, selected, { registry, runtimeContext });
    },
  });
  assert.equal(session.accept(decision(context, context.legalActions[0].actionId), state).ok, true);
  assert.equal(session.accept(decision(context, context.legalActions[1].actionId), state).code, "POLICY_DUPLICATE_RESPONSE");

  const recovered = policyPort.createPolicyRequestSession({
    context,
    validateDecision(selected, runtimeContext) {
      return policyPort.validatePolicyDecision(context, selected, { registry, runtimeContext });
    },
  });
  assert.equal(recovered.invalidate("checkpoint 已恢复").code, "POLICY_REQUEST_INVALIDATED");
  assert.equal(recovered.accept(decision(context, context.legalActions[0].actionId), state).code, "POLICY_LATE_RESPONSE");
  assert.deepEqual(state.executed, []);
  assert.deepEqual(state.journal, []);
}

(async () => {
  const { state, registry, context } = createFixture();
  let resolveLate;
  let capturedSession;
  const latePolicy = () => new Promise((resolve) => { resolveLate = resolve; });
  const timedOut = policyPort.runPolicy(latePolicy, context, {
    registry,
    getRuntimeContext: () => state,
    now: () => 100,
    deadlineAt: 101,
    setTimer(callback) { callback(); return 1; },
    clearTimer() {},
    onSession(session) { capturedSession = session; },
  });
  assert.equal((await timedOut).code, "POLICY_TIMEOUT");
  resolveLate(decision(context, context.legalActions[0].actionId));
  await Promise.resolve();
  assert.equal(capturedSession.snapshot().status, "timed_out", "迟到响应不得复活请求");

  const controller = new AbortController();
  controller.abort();
  assert.equal((await policyPort.runPolicy(() => decision(context, context.legalActions[0].actionId), context, {
    registry,
    getRuntimeContext: () => state,
    signal: controller.signal,
  })).code, "POLICY_CANCELLED");
  assert.deepEqual(state.executed, []);
  assert.deepEqual(state.journal, []);
  console.log("policy-port tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

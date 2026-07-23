"use strict";

const assert = require("node:assert/strict");
const policyPort = require("../../game/ai/policy-port");
const policyInputAdapter = require("../browser-host/policy-input-adapter");
const {
  createCompositionPolicyBoundaryReader,
  createBrowserMachinePlayerPort,
} = require("./browser-bootstrap");

function action(overrides = {}) {
  return {
    schemaVersion: "seti-standard-action-v1",
    family: "pass",
    phase: "main",
    actionId: "pass:p1",
    actorId: "p1",
    stateVersion: 4,
    decisionVersion: 2,
    target: null,
    payload: {},
    summary: "PASS",
    ...overrides,
  };
}

(async () => {
  let inspection = { phase: "idle", session: null };
  let source = {
    source: { kind: "committed", stateVersion: 4, phase: "idle" },
    state: {
      turn: { currentPlayerId: "p1" },
      players: { currentPlayerId: "p1" },
      match: { decisionVersion: 2 },
    },
    decision: null,
  };
  const legal = action();
  const ruleComposition = {
    inspect: () => structuredClone(inspection),
    stateSourcePort: { read: () => structuredClone(source) },
    inputPort: { enumerateActions: () => [legal] },
  };
  const readBoundary = createCompositionPolicyBoundaryReader({ ruleComposition });
  assert.deepEqual(readBoundary("p1"), {
    kind: "action",
    actorId: "p1",
    stateVersion: 4,
    decisionVersion: 2,
    legalActions: [legal],
  });

  const choice = action({
    family: "choose_reward",
    phase: "conditional",
    actionId: "choose_reward:p1:score",
    decisionVersion: 3,
  });
  inspection = {
    phase: "awaiting_input",
    session: {
      decision: {
        decisionId: "reward:1",
        decisionVersion: 3,
        ownerId: "p1",
        choices: [choice],
      },
    },
  };
  source = {
    ...source,
    source: { ...source.source, kind: "working", phase: "awaiting_input" },
    decision: structuredClone(inspection.session.decision),
  };
  assert.deepEqual(readBoundary("p1"), {
    kind: "decision",
    actorId: "p1",
    stateVersion: 4,
    decisionVersion: 3,
    decisionId: "reward:1",
    legalActions: [choice],
  });

  inspection = { phase: "idle", session: null };
  source = {
    ...source,
    source: { kind: "committed", stateVersion: 4, phase: "idle" },
    decision: null,
  };
  const traces = [];
  const port = createBrowserMachinePlayerPort({
    ruleComposition,
    policyInputAdapterModule: {
      createPolicyInputAdapter(options) {
        return {
          async runOnce() {
            const boundary = options.readBoundary();
            traces.push(["request", boundary.actorId, boundary.legalActions[0].actionId]);
            return { ok: true, actionId: boundary.legalActions[0].actionId };
          },
          invalidate: (reason) => traces.push(["invalidate", reason]),
          inspect: () => ({ running: false }),
        };
      },
    },
    projectionAdapter: {
      projectSource: ({ viewer }) => ({ schemaVersion: "projection", viewer }),
    },
    inputAdapter: {
      dispatchAction: () => ({ ok: true }),
      submitDecision: () => ({ ok: true }),
    },
    createPolicy: (seatId) => ({ seatId, decide: () => null }),
    isMachineSeat: (seatId) => seatId === "p1",
  });
  assert.deepEqual(await port.runOnce(), { ok: true, actionId: "pass:p1" });
  assert.deepEqual(traces, [["request", "p1", "pass:p1"]]);

  source.state.turn.currentPlayerId = "human";
  source.state.players.currentPlayerId = "human";
  const human = await port.runOnce();
  assert.equal(human.code, "BROWSER_MACHINE_SEAT_NOT_CONTROLLED");
  assert.equal(traces.length, 1, "人类席位不得创建 Policy 请求");

  const policyAction = action();
  function policyHarness(policy, options = {}) {
    let boundary = {
      kind: "action", actorId: "p1", stateVersion: 4, decisionVersion: 2,
      legalActions: [policyAction],
    };
    const submissions = [];
    const driver = policyInputAdapter.createPolicyInputAdapter({
      policy,
      policyType: options.policyType,
      policyVersion: options.policyVersion,
      defaultDeadlineMs: options.defaultDeadlineMs || 30,
      readBoundary: () => structuredClone(boundary),
      readObservation: () => ({ publicState: {} }),
      inputAdapter: {
        dispatchAction: (submitted) => (submissions.push(submitted), { ok: true }),
        submitDecision: (submitted) => (submissions.push(submitted), { ok: true }),
      },
    });
    return { driver, submissions, setBoundary: (next) => { boundary = next; } };
  }

  {
    const initialization = policyHarness({ decide: () => null }, {
      policyType: "learned",
      policyVersion: "broken-v1",
    });
    const result = await initialization.driver.runOnce();
    assert.equal(result.code, "MACHINE_POLICY_CHECKSUM_INCOMPATIBLE");
    assert.equal(initialization.submissions.length, 0, "初始化失败必须零提交");
  }

  {
    const deadline = policyHarness({
      decide: () => new Promise(() => {}),
      getProvenance: () => ({ type: "stub", version: "stub-v1", config: {} }),
    }, { defaultDeadlineMs: 5 });
    const result = await deadline.driver.runOnce();
    assert.equal(result.code, "POLICY_TIMEOUT");
    assert.equal(deadline.submissions.length, 0, "deadline 必须零提交");
  }

  {
    const illegal = policyHarness({
      decide(context) {
        return policyPort.createPolicyDecision(context, {
          actionId: "pass:illegal",
          policyType: "stub",
          policyVersion: "stub-v1",
        });
      },
      getProvenance: () => ({ type: "stub", version: "stub-v1", config: {} }),
    });
    const result = await illegal.driver.runOnce();
    assert.equal(result.code, "POLICY_ACTION_NOT_LEGAL");
    assert.equal(illegal.submissions.length, 0, "非法 actionId 必须零提交");
  }

  {
    const fixed = {
      decide(context) {
        return policyPort.createPolicyDecision(context, {
          actionId: context.legalActions[0].actionId,
          policyType: "stub",
          policyVersion: "stub-v1",
        });
      },
      getProvenance: () => ({ type: "stub", version: "stub-v1", config: {} }),
    };
    const drift = policyHarness(fixed);
    assert.equal((await drift.driver.runOnce()).ok, true);
    drift.setBoundary({
      kind: "action", actorId: "p2", stateVersion: 5, decisionVersion: 0,
      legalActions: [action({
        actionId: "pass:p2", actorId: "p2", stateVersion: 5, decisionVersion: 0,
      })],
    });
    const result = await drift.driver.runOnce();
    assert.equal(result.code, "POLICY_INPUT_SEAT_DRIFT");
    assert.equal(drift.submissions.length, 1, "seat drift 必须零新增提交");
  }

  {
    const context = policyPort.createDecisionContext({
      requestId: "late-response",
      seatId: "p1",
      stateVersion: 4,
      decisionVersion: 2,
      observation: {},
      legalActions: [policyAction],
    });
    let validationCalls = 0;
    const session = policyPort.createPolicyRequestSession({
      context,
      validateDecision: () => (validationCalls += 1, { ok: true }),
    });
    assert.equal(session.expire().code, "POLICY_TIMEOUT");
    assert.equal(session.accept({}, {}).code, "POLICY_LATE_RESPONSE");
    assert.equal(validationCalls, 0, "迟到或重复响应不得重新进入 validator");
  }

  console.log("Browser Machine Player composition tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

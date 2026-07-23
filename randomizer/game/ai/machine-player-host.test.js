"use strict";

const assert = require("node:assert/strict");
const policyPort = require("./policy-port");
const machinePlayerHost = require("./machine-player-host");

function action(version) {
  return {
    schemaVersion: policyPort.STANDARD_ACTION_SCHEMA_VERSION,
    family: "pass",
    phase: "main",
    actionId: `pass:${version}`,
    actorId: "p1",
    stateVersion: version,
    decisionVersion: version,
    target: {},
    payload: {},
    summary: "PASS",
  };
}

function policy(version = "fixture-v1", decide = null) {
  return {
    getProvenance: () => ({ type: "heuristic", version }),
    decide(context) {
      return decide ? decide(context) : policyPort.createPolicyDecision(context, {
        actionId: context.legalActions[0].actionId,
        policyType: "heuristic",
        policyVersion: version,
      });
    },
  };
}

function harness(activePolicy, options = {}) {
  let version = 1;
  const submissions = [];
  const host = machinePlayerHost.createMachinePlayerHost({
    defaultDeadlineMs: options.defaultDeadlineMs || 100,
    now: options.now,
    adapter: {
      readDecisionInput: (seatId) => ({
        ok: true,
        seatId,
        stateVersion: version,
        decisionVersion: version,
        authorityKey: "turn",
        observation: { publicState: { version } },
        legalActions: [action(version)],
      }),
      validateFresh(input, selected) {
        if (input.decisionVersion !== version) {
          return { ok: false, code: "MACHINE_POLICY_STALE", message: "boundary changed" };
        }
        return selected.actionId === action(version).actionId
          ? { ok: true, action: action(version) }
          : { ok: false, code: "MACHINE_POLICY_ACTION_NOT_LEGAL" };
      },
      submit(selected) {
        submissions.push(selected.actionId);
        return { ok: true };
      },
    },
  });
  host.initializeSeats([{ seatId: "p1", policy: activePolicy }], { phase: "new_game" });
  return { host, submissions, advance: () => { version += 1; } };
}

(async () => {
  {
    const current = harness(policy());
    assert.equal((await current.host.requestDecision("p1")).ok, true);
    assert.equal((await current.host.requestDecision("p1")).code, "MACHINE_POLICY_DUPLICATE_SUBMISSION");
    assert.deepEqual(current.submissions, ["pass:1"]);
    current.advance();
    assert.equal((await current.host.requestDecision("p1")).ok, true);
    assert.deepEqual(current.submissions, ["pass:1", "pass:2"]);
  }

  {
    const drift = harness(policy("fixture-v1", (context) => policyPort.createPolicyDecision(context, {
      actionId: context.legalActions[0].actionId,
      policyType: "heuristic",
      policyVersion: "drift-v2",
    })));
    assert.equal((await drift.host.requestDecision("p1")).code, "MACHINE_POLICY_IDENTITY_DRIFT");
    assert.deepEqual(drift.submissions, []);
  }

  {
    let release;
    const late = harness(policy("late-v1", (context) => new Promise((resolve) => {
      release = () => resolve(policyPort.createPolicyDecision(context, {
        actionId: context.legalActions[0].actionId,
        policyType: "heuristic",
        policyVersion: "late-v1",
      }));
    })), { defaultDeadlineMs: 1000 });
    const pending = late.host.requestDecision("p1");
    late.host.invalidate("restore");
    release();
    assert.equal((await pending).code, "MACHINE_POLICY_REQUEST_INVALIDATED");
    assert.deepEqual(late.submissions, [], "旧 generation 的迟到响应不得提交");
  }

  {
    let release;
    const cancelled = harness(policy("cancel-v1", (context) => new Promise((resolve) => {
      release = () => resolve(policyPort.createPolicyDecision(context, {
        actionId: context.legalActions[0].actionId,
        policyType: "heuristic",
        policyVersion: "cancel-v1",
      }));
    })));
    const pending = cancelled.host.requestDecision("p1");
    assert.equal(cancelled.host.cancelSeat("p1").code, "POLICY_CANCELLED");
    release();
    assert.equal((await pending).code, "POLICY_CANCELLED");
    assert.deepEqual(cancelled.submissions, []);
  }

  console.log("machine player host protocol tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

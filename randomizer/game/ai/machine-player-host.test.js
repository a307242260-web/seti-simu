"use strict";

const assert = require("node:assert/strict");
const policyPort = require("./policy-port");
const machineHost = require("./machine-player-host");

function action(decisionVersion, actionId = `pass:${decisionVersion}`) {
  return Object.freeze({
    schemaVersion: policyPort.STANDARD_ACTION_SCHEMA_VERSION,
    family: "pass",
    phase: "main",
    actionId,
    actorId: "p1",
    stateVersion: decisionVersion,
    decisionVersion,
    target: {},
    payload: {},
    summary: "PASS",
  });
}

function fixedPolicy(version = "fixture-v1", hooks = {}) {
  return {
    getProvenance: () => ({ type: "heuristic", version, config: { level: 1 }, configChecksum: "cfg-1" }),
    decide(context) {
      hooks.calls?.push(context.requestId);
      if (hooks.decide) return hooks.decide(context);
      return policyPort.createPolicyDecision(context, {
        actionId: context.legalActions[0].actionId,
        policyType: "heuristic",
        policyVersion: version,
      });
    },
  };
}

function createHarness(policy, options = {}) {
  let decisionVersion = 1;
  const submissions = [];
  const state = { value: 0, effects: 0, journal: [] };
  const host = machineHost.createMachinePlayerHost({
    defaultDeadlineMs: options.defaultDeadlineMs || 100,
    adapter: {
      readDecisionInput(seatId) {
        const legalActions = [action(decisionVersion)];
        return {
          ok: true,
          seatId,
          stateVersion: decisionVersion,
          decisionVersion,
          observation: { publicState: { value: state.value } },
          legalActions,
          deterministicContext: { source: options.source || "test" },
        };
      },
      validateFresh(input, selected) {
        if (input.decisionVersion !== decisionVersion) {
          return { ok: false, code: "MACHINE_POLICY_STALE", message: "boundary 已变化" };
        }
        const fresh = action(decisionVersion);
        return selected.actionId === fresh.actionId
          ? { ok: true, action: fresh }
          : { ok: false, code: "MACHINE_POLICY_ACTION_NOT_LEGAL", message: "非法动作" };
      },
      submit(selected) {
        submissions.push(selected.actionId);
        state.value += 1;
        state.effects += 1;
        state.journal.push(selected.actionId);
        return { ok: true };
      },
    },
  });
  host.initializeSeats([{ seatId: "p1", policy }], { phase: "new_game" });
  return {
    host,
    state,
    submissions,
    advanceBoundary() { decisionVersion += 1; },
    getDecisionVersion: () => decisionVersion,
  };
}

(async function run() {
  {
    const harness = createHarness(fixedPolicy());
    const first = await harness.host.requestDecision("p1");
    assert.equal(first.ok, true);
    assert.deepEqual(first.policyIdentity, {
      policyType: "heuristic",
      policyVersion: "fixture-v1",
      modelChecksum: null,
      config: { level: 1 },
      configChecksum: "cfg-1",
      seed: null,
    });
    assert.equal((await harness.host.requestDecision("p1")).code, "MACHINE_POLICY_DUPLICATE_SUBMISSION");
    assert.deepEqual(harness.submissions, ["pass:1"]);
    harness.advanceBoundary();
    assert.equal((await harness.host.requestDecision("p1")).ok, true);
    assert.equal(harness.host.inspect().seats[0].identity.policyVersion, "fixture-v1");
  }

  {
    const drift = fixedPolicy("fixture-v1", {
      decide(context) {
        return policyPort.createPolicyDecision(context, {
          actionId: context.legalActions[0].actionId,
          policyType: "heuristic",
          policyVersion: "drift-v2",
        });
      },
    });
    const harness = createHarness(drift);
    const before = structuredClone(harness.state);
    assert.equal((await harness.host.requestDecision("p1")).code, "MACHINE_POLICY_IDENTITY_DRIFT");
    assert.deepEqual(harness.state, before, "identity drift 时 state/effect/journal 均不得前进");
    assert.equal(harness.host.inspect().paused.code, "MACHINE_POLICY_IDENTITY_DRIFT");
  }

  {
    let lateResolve;
    let fallbackCalls = 0;
    const fallback = fixedPolicy("fallback-v1", { calls: [] });
    const hostHarness = createHarness(fallback, { defaultDeadlineMs: 5 });
    const host = hostHarness.host;
    host.initializeSeats([{
      seatId: "p1",
      primary: {
        policy: fixedPolicy("learned-v1"),
        identity: { policyType: "learned", policyVersion: "learned-v1", modelChecksum: null },
      },
      fallbacks: [{
        policy: {
          ...fallback,
          decide(context) {
            fallbackCalls += 1;
            return new Promise((resolve) => { lateResolve = () => resolve(policyPort.createPolicyDecision(context, {
              actionId: context.legalActions[0].actionId,
              policyType: "heuristic",
              policyVersion: "fallback-v1",
            })); });
          },
        },
      }],
    }], { phase: "load" });
    assert.equal(host.inspect().seats[0].activePolicyIndex, 1);
    const timedOut = await host.requestDecision("p1");
    assert.equal(timedOut.code, "POLICY_TIMEOUT");
    assert.equal(fallbackCalls, 1, "初始化切换后的整席 Policy 只调用当前实现");
    lateResolve();
    await Promise.resolve();
    assert.deepEqual(hostHarness.submissions, [], "late response 不得提交");
    assert.equal(host.inspect().diagnostics.filter((entry) => entry.type === "seat_policy_switched").length, 1);
  }

  {
    let release;
    const policy = fixedPolicy("restore-v1", {
      decide(context) {
        return new Promise((resolve) => { release = () => resolve(policyPort.createPolicyDecision(context, {
          actionId: context.legalActions[0].actionId,
          policyType: "heuristic",
          policyVersion: "restore-v1",
        })); });
      },
    });
    const harness = createHarness(policy, { defaultDeadlineMs: 1000 });
    const pending = harness.host.requestDecision("p1");
    const snapshot = harness.host.createSnapshot();
    assert.equal(Object.hasOwn(snapshot, "activeRequests"), false, "snapshot 不得持久化在途请求");
    harness.host.restore(snapshot, {
      resolvePolicy(identity) {
        assert.equal(identity.policyVersion, "restore-v1");
        return fixedPolicy("restore-v1");
      },
    });
    release();
    assert.equal((await pending).code, "MACHINE_POLICY_REQUEST_INVALIDATED");
    assert.deepEqual(harness.submissions, [], "恢复前请求不得进入恢复后的提交路径");
    assert.equal(harness.host.inspect().paused, null, "旧代际 late response 不得暂停 fresh restore");
    assert.equal((await harness.host.requestDecision("p1")).ok, true);
  }

  console.log("machine-player-host lifecycle contract passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

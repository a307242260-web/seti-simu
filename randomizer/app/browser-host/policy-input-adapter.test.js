"use strict";

const assert = require("node:assert/strict");
const policyPort = require("../../game/ai/policy-port");
const inputApi = require("./input-adapter");
const policyInputApi = require("./policy-input-adapter");
const viewStateApi = require("./view-state-store");

function action(family, actionId, versions = {}) {
  const conditional = family.startsWith("choose_") || family === "accept_optional_effect";
  return {
    schemaVersion: policyPort.STANDARD_ACTION_SCHEMA_VERSION,
    family,
    phase: conditional ? "conditional" : "main",
    actionId,
    actorId: "p1",
    stateVersion: versions.stateVersion ?? 1,
    decisionVersion: versions.decisionVersion ?? 1,
    target: { id: actionId },
    payload: {},
    summary: actionId,
  };
}

function fixedPolicy() {
  return {
    getProvenance: () => ({ type: "heuristic", version: "fixture-v1" }),
    decide(context) {
      return policyPort.createPolicyDecision(context, {
        actionId: context.legalActions[0].actionId,
        policyType: "heuristic",
        policyVersion: "fixture-v1",
      });
    },
  };
}

(async () => {
  const actionChoice = action("pass", "pass:1");
  const decisionChoice = action("choose_reward", "choose_reward:credits", { decisionVersion: 2 });
  let boundary = {
    kind: "action",
    actorId: "p1",
    stateVersion: 1,
    decisionVersion: 1,
    legalActions: [actionChoice],
  };
  const calls = [];
  const sharedInput = inputApi.createBrowserInputAdapter({
    dispatchAction(selected) {
      calls.push(["action", selected.actionId]);
      boundary = {
        kind: "decision",
        actorId: "p1",
        stateVersion: 1,
        decisionVersion: 2,
        decisionId: "reward-1",
        legalActions: [decisionChoice],
      };
      return { ok: true };
    },
    submitDecision(submission) {
      calls.push(["decision", submission.decisionId, submission.choice.actionId]);
      boundary = { kind: "terminal", terminal: { gameEnded: true } };
      return { ok: true };
    },
    viewStateStore: viewStateApi.createViewStateStore(),
  });
  const adapter = policyInputApi.createPolicyInputAdapter({
    policy: fixedPolicy(),
    readBoundary: () => boundary,
    readObservation: () => ({ publicState: { visible: true } }),
    inputAdapter: sharedInput,
  });
  assert.equal((await adapter.runOnce()).ok, true);
  assert.equal((await adapter.runOnce()).ok, true);
  assert.deepEqual(calls, [
    ["action", "pass:1"],
    ["decision", "reward-1", "choose_reward:credits"],
  ], "机器席位必须与人类输入共用 Action/Decision port");
  assert.equal((await adapter.runOnce()).done, true);

  let submits = 0;
  let staleBoundary = {
    kind: "action",
    actorId: "p1",
    stateVersion: 1,
    decisionVersion: 1,
    legalActions: [actionChoice],
  };
  let release;
  const stale = policyInputApi.createPolicyInputAdapter({
    policy: {
      getProvenance: () => ({ type: "heuristic", version: "fixture-v1" }),
      decide(context) {
        return new Promise((resolve) => {
          release = () => resolve(policyPort.createPolicyDecision(context, {
            actionId: actionChoice.actionId,
            policyType: "heuristic",
            policyVersion: "fixture-v1",
          }));
        });
      },
    },
    readBoundary: () => staleBoundary,
    readObservation: () => ({}),
    inputAdapter: {
      dispatchAction() { submits += 1; return { ok: true }; },
      submitDecision() { submits += 1; return { ok: true }; },
    },
  });
  const pending = stale.runOnce();
  staleBoundary = {
    ...staleBoundary,
    decisionVersion: 2,
    legalActions: [action("pass", "pass:2", { decisionVersion: 2 })],
  };
  release();
  assert.equal((await pending).code, "POLICY_INPUT_STALE");
  assert.equal(submits, 0);

  assert.equal(policyInputApi.normalizeBoundary({ kind: "overlay" }).code, "POLICY_INPUT_BOUNDARY_UNSUPPORTED");
  assert.equal(policyInputApi.normalizeBoundary({
    kind: "action",
    actorId: "p1",
    stateVersion: 1,
    decisionVersion: 1,
    legalActions: [{ ...actionChoice, family: "unknown_family" }],
  }).code, "POLICY_INPUT_FAMILY_UNSUPPORTED");

  console.log("browser policy input adapter protocol tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

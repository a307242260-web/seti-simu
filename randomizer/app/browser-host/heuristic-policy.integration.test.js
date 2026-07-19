"use strict";

const assert = require("node:assert/strict");
const heuristic = require("../../game/ai/heuristic-policy");
const policyInput = require("./policy-input-adapter");

function descriptor(family, phase, actionId, decisionVersion, value = null) {
  return Object.freeze({
    schemaVersion: "seti-standard-action-v1",
    family,
    phase,
    actionId,
    actorId: "p1",
    stateVersion: 1,
    decisionVersion,
    target: {},
    payload: value == null ? {} : { value },
    summary: actionId,
  });
}

const launch = descriptor("launch", "main", "launch:p1", 1);
const rewards = [
  descriptor("choose_reward", "conditional", "reward:p1:credit", 2, 1),
  descriptor("choose_reward", "conditional", "reward:p1:score", 2, 5),
];
let stage = "action";
const submissions = [];
const driver = policyInput.createPolicyInputAdapter({
  policy: heuristic.createHeuristicPolicy({ difficulty: "weak_start" }),
  readBoundary() {
    if (stage === "action") {
      return { kind: "action", actorId: "p1", stateVersion: 1, decisionVersion: 1, legalActions: [launch] };
    }
    if (stage === "decision") {
      return {
        kind: "decision",
        actorId: "p1",
        stateVersion: 1,
        decisionVersion: 2,
        decisionId: "reward-decision",
        legalActions: rewards,
      };
    }
    return { kind: "terminal", terminal: { done: true } };
  },
  readObservation: () => ({
    publicState: { roundNumber: 1, players: [{ playerId: "p1", credits: 3, energy: 3 }] },
    selfState: { hand: [] },
  }),
  inputAdapter: {
    dispatchAction(action) {
      submissions.push(action.actionId);
      stage = "decision";
      return { ok: true };
    },
    submitDecision(submission) {
      submissions.push(submission.choice.actionId);
      stage = "terminal";
      return { ok: true };
    },
  },
});

(async function run() {
  assert.equal((await driver.runOnce()).ok, true);
  assert.equal((await driver.runOnce()).ok, true);
  assert.deepEqual(submissions, ["launch:p1", "reward:p1:score"]);
  assert.equal((await driver.runOnce()).done, true);
  assert.equal(driver.inspect().requestOrdinal, 2);
  console.log("browser Heuristic Policy integration passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

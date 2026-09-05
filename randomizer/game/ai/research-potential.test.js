"use strict";

const assert = require("node:assert/strict");
const outcome = require("./outcome-model");
const evaluator = require("./expected-score-evaluator");
const seatId = "research-seat";
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function observation({ publicity = 0, plans = ["orange2"], cost = 6, owned = [], round = 1,
  owner = seatId, terminal = false } = {}) {
  return outcome.createDecisionObservation({
    publicState: { roundNumber: round, terminal, board: {}, players: [{
      id: seatId, resources: { score: 0, publicity },
      techState: { ownedTiles: Object.fromEntries(owned.map((tile) => [tile, true])) },
    }] },
    selfState: { id: seatId, hand: [] },
    techGainRequirements: { playerId: owner, researchCost: cost,
      plans: plans.map((tileId) => ({ tileId, required: { publicity: cost } })) },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
}
const potential = (obs) => evaluator.evaluateStateValue(obs, seatId).components.researchOptionValue;
const breakdown = (root, leaf) => evaluator.evaluateStrategicFactsBreakdown(
  outcome.createStrategicFacts(root, seatId), outcome.createStrategicFacts(leaf, seatId),
);
close(potential(observation({ publicity: 5 })), 21 * 0.5 * 5 / 6);
close(potential(observation({ publicity: 6 })), 21 * 0.5);
close(potential(observation({ publicity: 10 })), 21 * 0.5);
close(potential(observation({ publicity: 3, cost: 3 })), 21 * 0.5);
close(potential(observation({ publicity: 6, cost: 0 })), 0);
close(potential(observation({ publicity: 6, plans: [] })), 0);
close(potential(observation({ publicity: 6, owned: ["orange2"] })), 0);
close(potential(observation({ publicity: 6, owner: "other-seat" })), 0);
close(potential(observation({ publicity: 6, round: 4 })), 0);
close(potential(observation({ publicity: 6, terminal: true })), 0);
close(potential(observation({ publicity: 6, plans: ["orange2", "orange2", "orange3"] })), 21 * 0.5);
assert.throws(() => observation({ cost: -1 }), /非负宣传成本/);

const a = observation({ publicity: 4 });
const b = observation({ publicity: 6 });
const c = observation({ publicity: 0, owned: ["orange2"], plans: [] });
close(breakdown(a, b).publicityResearchValue, 3.5);
close(breakdown(b, c).publicityResearchValue, -10.5);
close(breakdown(a, b).total + breakdown(b, c).total, breakdown(a, c).total);
close(breakdown(a, c).total, 14); // 科技未来21，扣除根状态已经持有的研究机会7。
close(breakdown(b, observation({ publicity: 6, plans: [] })).publicityResearchValue, -10.5);

for (const leaf of [b, c]) {
  assert.deepEqual(outcome.createStrategicFacts(leaf, seatId).researchOptions,
    leaf.outcomeProjection.progress.researchOptions);
  const action = { actionId: "research-route", family: "choose_reward", phase: "conditional", target: {}, payload: {} };
  const result = evaluator.evaluateOutcome({ seatId, actionOutcomes: [{
    schemaVersion: outcome.OUTCOME_SCHEMA_VERSION, actionId: action.actionId,
    status: "settled", confidence: "high", rootObservation: a,
    leaves: [{ leafId: "leaf", observation: leaf, actionChain: [action.actionId] }],
  }] }, action);
  close(result.score, breakdown(a, leaf).total);
  close(result.publicityResearchValue, breakdown(a, leaf).publicityResearchValue);
}
console.log("research potential tests passed");

"use strict";

const assert = require("node:assert/strict");
const outcome = require("./outcome-model");
const evaluator = require("./expected-score-evaluator");
const tech = require("../tech/player-tech");

const seatId = "disabled-tech-seat";
const raw = { publicState: { roundNumber: 2, board: {}, players: [{ playerId: seatId,
  score: 17, finalScore: 31, publicity: 6, income: {}, techState: {
    ownedTiles: { purple2: true, orange2: true }, disabledTiles: { orange2: true },
  } }] }, selfState: { playerId: seatId, hand: [] },
techGainRequirements: { playerId: seatId, researchCost: 6,
  plans: [{ tileId: "purple2", required: { publicity: 6 } }] } };
const before = outcome.createDecisionObservation(raw, { seatId });
assert.equal(tech.removePlayerTile(raw.publicState.players[0].techState, "purple2").ok, true);
const after = outcome.createDecisionObservation(raw, { seatId });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

assert.deepEqual(before.outcomeProjection.progress.disabledTechIds, ["orange2"]);
assert.deepEqual(after.outcomeProjection.progress.disabledTechIds, ["orange2", "purple2"]);
assert.deepEqual(before.outcomeProjection.progress.ownedTechIds, after.outcomeProjection.progress.ownedTechIds);
assert.equal(after.outcomeProjection.progress.techCount, 2);
assert.equal(after.outcomeProjection.progress.orangeTechCount, 1);
assert.deepEqual(before.outcomeProjection.scoring, after.outcomeProjection.scoring);
const v = obs => evaluator.evaluateStateValue(obs, seatId);
close(v(before).components.techEfficiencyValue, 20);
close(v(after).components.techEfficiencyValue, 0);
close(v(before).components.researchOptionValue, 0);
close(v(after).components.researchOptionValue, 0);
const facts = obs => outcome.createStrategicFacts(obs, seatId);
assert.deepEqual(facts(after).disabledTechIds, after.outcomeProjection.progress.disabledTechIds);
close(evaluator.evaluateStrategicFactsBreakdown(facts(before), facts(after)).infrastructure.techValue, -20);
close(evaluator.evaluateStrategicFactsBreakdown(facts(after), facts(after)).infrastructure.techValue, 0);
const action = { actionId: "company-disable", family: "choose_reward", phase: "conditional" };
const scored = evaluator.evaluateOutcome({ seatId, actionOutcomes: [{ schemaVersion: outcome.OUTCOME_SCHEMA_VERSION,
  actionId: action.actionId, status: "settled", rootObservation: before,
  leaves: [{ leafId: "disabled", observation: after, actionChain: [action.actionId] }],
}] }, action);
close(scored.techValue, -20);
close(scored.actualScoreDelta, 0);
close(scored.score, evaluator.evaluateStrategicFactsBreakdown(facts(before), facts(after)).total);
raw.publicState.terminal = true;
const terminal = outcome.createDecisionObservation(raw, { seatId });
close(v(terminal).components.techEfficiencyValue, 0);
close(v(terminal).total, 31);
assert.deepEqual(before.outcomeProjection.progress.disabledTechIds, ["orange2"], "投影不得随源对象改写");

console.log("失效科技：所有权/计数不变，V、叶排序与搜索优先级共同扣除能力未来价值");

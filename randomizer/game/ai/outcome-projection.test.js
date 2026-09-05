"use strict";
const assert = require("node:assert/strict");
const model = require("./outcome-model");

const observation = (score) => ({
  publicState: { roundNumber: 1, players: [{ playerId: "p1", resources: { score } }], board: {} },
  selfState: { playerId: "p1", hand: [] },
});
const shared = { action: { actionId: "payment", actorId: "p1" }, facts: { data: { slots: [1] } } };
const input = [{ actionId: "root", rootObservation: observation(1), note: { label: "kept" }, leaves: [
  { leafId: "a", observation: observation(5), actionChain: ["root"], routeCheckpoints: [], planSteps: [shared] },
  { leafId: "b", observation: observation(7), actionChain: ["root", "payment"], routeCheckpoints: [], planSteps: [shared] },
] }];
const before = structuredClone(input);
input[0].searchCompleteness = { status: "incomplete", reasons: ["beam-budget"] };
before[0].searchCompleteness = structuredClone(input[0].searchCompleteness);
const result = model.projectOutcomeObservations(input, { seatId: "p1" });
assert.deepEqual(input, before);
assert.equal(Object.isFrozen(input[0]), false);
assert.equal(Object.isFrozen(shared), false);
assert.equal(result[0].leaves[0].observation.outcomeProjection.scoring.realizedScore, 5);
assert.equal(result[0].leaves[1].observation.outcomeProjection.scoring.realizedScore, 7);
assert.deepEqual(result[0].note, { label: "kept" });
assert.deepEqual(result[0].searchCompleteness, { status: "incomplete", reasons: ["beam-budget"] });
assert.deepEqual(result[0].leaves.map((leaf) => leaf.actionChain), [["root"], ["root", "payment"]]);
assert.equal(Object.hasOwn(result[0].leaves[0], "routeCheckpoints"), false);
assert.equal(Object.isFrozen(result[0].leaves[0].planSteps[0].facts.data.slots), true);
shared.facts.data.slots.push(2);
input[0].note.label = "changed";
assert.deepEqual(result[0].leaves.map((leaf) => leaf.planSteps[0].facts.data.slots), [[1], [1]]);
assert.equal(result[0].note.label, "kept");
assert.throws(() => result[0].leaves[0].planSteps[0].facts.data.slots.push(3), TypeError);
const valid = { ...result[0], schemaVersion: model.OUTCOME_SCHEMA_VERSION,
  status: "settled", confidence: "low" };
assert.doesNotThrow(() => model.assertOutcomeSet([valid], [{ actionId: "root" }]));
for (const searchCompleteness of [
  { status: "complete", reasons: ["beam-budget"] },
  { status: "incomplete", reasons: [] },
  { status: "incomplete", reasons: ["unknown"] },
  { status: "not-evaluated", reasons: ["not-evaluated"] },
]) assert.throws(() => model.assertOutcomeSet([{ ...valid, searchCompleteness }], [{ actionId: "root" }]), /searchCompleteness/);
console.log("outcome projection tests passed");

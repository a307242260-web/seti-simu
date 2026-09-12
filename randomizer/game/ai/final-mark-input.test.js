"use strict";
const assert = require("node:assert/strict");
const { buildRuleObservation } = require("../../app/rule-observation");
const scoring = require("../end-game-scoring"), model = require("./outcome-model"), port = require("./policy-port");
const policy = require("./heuristic-policy").createHeuristicPolicy();
const player = { id: "p1", color: "green", initialSelection: { industry: { id: "industry:寰宇动力.png" } },
  resources: { score: 0 }, income: { credits: 6, energy: 2, handSize: 2 }, hand: [], reservedCards: [],
  techState: { ownedTiles: { orange1: true, blue1: true, purple1: true, purple2: true } } };
const state = { players: { players: [player] }, turn: { roundNumber: 2, currentPlayerId: "p1" },
  finalScoring: { thresholds: [25, 50, 70], tiles: { a: { id: "a", marks: [] }, d: { id: "d", marks: [] } }, tileVariants: { a: 2, d: 2 } },
  aliens: { ...require("../aliens/state").createDefaultAlienState(), jiuzhe: require("../aliens/jiuzhe").createJiuzheState() },
  planets: {}, data: {}, cards: {}, tech: {} };
const before = structuredClone(state);
const observation = buildRuleObservation(state, "fixture", "p1");
const projected = observation.publicState.players[0];
assert.equal(scoring.getFormulaBaseValue("a2", projected, {}), 1, "公司初始收入必须扣除");
for (const f of ["a1", "a2"]) assert.equal(scoring.getFormulaBaseValue(f, projected, {}), scoring.getFormulaBaseValue(f, player, {}));
assert.deepEqual(state, before);
assert.deepEqual(projected.companyBaseIncome, scoring.getPlayerCompanyBaseIncome(player));
assert.notEqual(projected.companyBaseIncome, scoring.getPlayerCompanyBaseIncome(player));
const legal = ["a", "d"].map(tileId => ({ schemaVersion: port.STANDARD_ACTION_SCHEMA_VERSION,
  actionId: `mark:${tileId}`, actorId: "p1", family: "choose_target", phase: "conditional", stateVersion: 1,
  decisionVersion: 1, target: { tileId }, payload: {}, summary: `mark ${tileId}` }));
function decide(source) {
  return policy.decide(port.createDecisionContext({ requestId: "final-input", seatId: "p1", stateVersion: 1, decisionVersion: 1,
    legalActions: legal, actionOutcomes: [], observation: model.createDecisionObservation(source, { seatId: "p1" }) }));
}
assert.equal(decide(observation).actionId, "mark:d", "A2扣除后11分，D2为14分");
for (const key of ["finalScoring", "planets", "data"]) {
  const missing = structuredClone(observation); delete missing.publicState.board[key];
  assert.throws(() => decide(missing), e => e.code === "FINAL_MARK_INPUT_INVALID");
}
const missing = structuredClone(observation); delete missing.publicState.players[0].companyBaseIncome;
assert.throws(() => decide(missing), e => e.code === "FINAL_MARK_INPUT_INVALID");
const missingVariant = structuredClone(observation); delete missingVariant.publicState.board.finalScoring.tileVariants.a;
assert.throws(() => decide(missingVariant), e => e.code === "FINAL_MARK_INPUT_INVALID");
state.players.players.push({ ...structuredClone(player), id: "p2", color: "blue", hand: [{ id: "opponent-private-secret" }] });
const visible = buildRuleObservation(state, "fixture", "p1");
assert(!JSON.stringify(visible).includes("opponent-private-secret"), "公开公司收入不泄露对手手牌");
assert.deepEqual(visible.publicState.players[1].companyBaseIncome, scoring.getPlayerCompanyBaseIncome(player));
player.income = { ...scoring.getPlayerCompanyBaseIncome(player) };
const zero = buildRuleObservation(state, "fixture", "p1").publicState.players[0];
assert.equal(scoring.getFormulaBaseValue("a1", zero, {}), 0);
assert.equal(scoring.getFormulaBaseValue("a2", zero, {}), 0);
console.log("final mark company income and required inputs passed");

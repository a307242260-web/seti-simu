"use strict";

const assert = require("node:assert/strict");
const evaluator = require("./expected-score-evaluator");

const seat = "player-blue";
const observation = { publicState: { players: [{ playerId: seat, industryAbilityId: "turing_borrow_tech",
  techState: { ownedTiles: {}, disabledTiles: {} } }], board: {} }, selfState: { hand: [] } };
const end = { actorId: seat, actionId: "end", family: "end_turn", phase: "turn_control", target: {} };
const pass = { ...end, actionId: "pass", family: "pass" };

function check(currentAction, obs, expected) {
  const input = { focalSeatId: seat, currentAction, branchObservation: obs,
    legalSuccessors: [end, pass], routeTargetId: null, routePlanId: null,
    actionChain: ["place_data:root"] };
  const original = JSON.stringify(input);
  assert.deepEqual(evaluator.selectSecondaryAgentSuccessors(input).map(a => a.actionId).sort(), expected.sort());
  assert.equal(JSON.stringify(input), original);
}

for (const tileId of ["orange1", "orange2", "orange3", "orange4", "purple1", "purple2", "purple3", "purple4"]) {
  const borrowed = { actorId: seat, actionId: `borrow:${tileId}`, family: "choose_target",
    phase: "conditional", target: { kind: "residual-domain", tileId, choiceId: `tech:${tileId}` } };
  check(borrowed, observation, ["pass"]);
  check({ ...borrowed, actorId: "player-white" }, observation, ["end", "pass"]);
  check({ ...borrowed, target: { ...borrowed.target, kind: "research-tech" } }, observation, ["end", "pass"]);
  const otherCompany = structuredClone(observation);
  otherCompany.publicState.players[0].industryAbilityId = "helios_remove_tech_income";
  check(borrowed, otherCompany, ["end", "pass"]);
}
check(null, observation, ["end", "pass"]);
check({ actorId: seat, family: "place_data" }, observation, ["end", "pass"]);

console.log("turing immediate expiry tests passed");

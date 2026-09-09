"use strict";

const assert = require("node:assert/strict");
const evaluator = require("./expected-score-evaluator");
const { sanitizePublicPlayer } = require("../../app/simulation-contract");

const seat = "player-blue";
const tiles = ["orange1", "orange2", "orange3", "orange4", "purple1", "purple2", "purple3", "purple4"];
const choices = tiles.map(tile => ({ actionId: `choice:${tile}`, actorId: seat, family: "choose_target",
  phase: "conditional", target: { kind: "residual-domain", choiceId: `tech:${tile}`, tileId: tile },
  payload: {}, summary: "不读显示文本" }));

function observation(owned = ["orange2", "purple4"], disabled = [], ability = "turing_borrow_tech") {
  return { publicState: { players: [{ playerId: seat, industryAbilityId: ability,
    techState: { ownedTiles: Object.fromEntries(owned.map(t => [t, true])),
      disabledTiles: Object.fromEntries(disabled.map(t => [t, true])) } }],
  board: { techSupply: { stacks: Object.fromEntries(tiles.map(t => [t, { remaining: 1, depleted: false }])) } } },
  selfState: { hand: [] } };
}

function check(obs, actions, expected) {
  const before = JSON.stringify({ obs, actions });
  const focalSeatId = actions[0]?.actorId || seat;
  const ids = xs => xs.map(x => x.actionId).sort();
  assert.deepEqual(ids(evaluator.selectSecondaryAgentRootActions({ focalSeatId,
    rootObservation: obs, legalActions: actions })), ids(expected));
  for (const routeTargetId of [null, "decision:test"]) {
    assert.deepEqual(ids(evaluator.selectSecondaryAgentSuccessors({ focalSeatId,
      branchObservation: obs, legalSuccessors: actions, routeTargetId,
      routePlanId: routeTargetId })), ids(expected));
  }
  assert.equal(JSON.stringify({ obs, actions }), before);
}

check(observation(), choices, choices.filter(c => !["orange2", "purple4"].includes(c.target.tileId)));
check(observation(["orange2", "purple4"], ["orange2"]), choices,
  choices.filter(c => c.target.tileId !== "purple4"));
check(observation([], [], "helios_remove_tech_income"), choices, choices);
check(observation(tiles, [], "helios_remove_tech_income"), choices, choices);
check(observation(tiles), choices, [choices[0]]);
const other = observation(tiles);
other.publicState.players.push({ ...observation([]).publicState.players[0], playerId: "player-white" });
check(other, choices.map(c => ({ ...c, actorId: "player-white" })), choices);
assert.throws(() => evaluator.selectSecondaryAgentRootActions({ focalSeatId: seat,
  rootObservation: { publicState: { players: [{ playerId: seat,
    industryAbilityId: "turing_borrow_tech" }] } }, legalActions: choices }), /TURING_TECH_STATE_MISSING/);
const start = { actionId: "industry:start", actorId: seat, family: "industry", phase: "quick",
  target: { abilityId: "turing_borrow_tech" }, payload: {} };
const noGain = observation(tiles);
assert.deepEqual(evaluator.selectSecondaryAgentSuccessors({ focalSeatId: seat,
  branchObservation: noGain, legalSuccessors: [start] }), []);
const useful = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: seat,
  branchObservation: observation(tiles, ["orange2"]), legalSuccessors: [start] });
assert.deepEqual(useful.map(a => a.actionId), [start.actionId], "失效科技可借用，不能禁止启用");
const depleted = observation(["orange2"]);
for (const t of tiles.filter(t => t !== "orange2")) depleted.publicState.board.techSupply.stacks[t].depleted = true;
assert.deepEqual(evaluator.selectSecondaryAgentSuccessors({ focalSeatId: seat,
  branchObservation: depleted, legalSuccessors: [start] }), []);
assert.equal(sanitizePublicPlayer({ initialSelection: { industry: { label: "图灵系统" } } }).industryAbilityId,
  "turing_borrow_tech");
assert.equal(sanitizePublicPlayer({ initialSelection: { industry: { label: "赫利昂联合体" } } }).industryAbilityId,
  "helios_remove_tech_income");

console.log("turing active tech pruning tests passed");

"use strict";

const assert = require("node:assert/strict");
const pipeline = require("./candidate-pipeline");
const actionGraph = require("./action-graph");
const policy = require("./policy");

const families = [
  ["launch", "launch"], ["orbit", "orbit"], ["land", "land"],
  ["researchTech", "research_tech"], ["scan", "scan"], ["analyze", "analyze"],
  ["playCard", "play_card"], ["pass", "pass"], ["move", "move"],
  ["quickTrade", "quick_trade"], ["industry", "industry"],
  ["cardCorner", "card_corner"], ["placeData", "place_data"],
  ["runezuFaceSymbol", "runezu_face_symbol"], ["end-turn", "end_turn"],
];
const rawCandidates = families.map(([id], index) => ({
  id,
  kind: ["pass", "end-turn"].includes(id) ? "pass" : index % 2 ? "quick" : "main",
  available: true,
  score: 20 - index,
  ...(id === "move" ? { rocketId: 7, deltaX: 1, deltaY: 0 } : {}),
  ...(id === "researchTech" ? { tileId: "orange2", blueSlot: 1 } : {}),
  ...(id === "playCard" ? { cardInstanceId: "card-7" } : {}),
  ...(id === "placeData" ? { target: "computer" } : {}),
}));
const standardActions = families.map(([id, family], index) => ({
  schemaVersion: "seti-standard-action-v1",
  family,
  phase: rawCandidates[index].kind,
  actionId: `${family}:fixture-${index}`,
  actorId: "player-blue",
  stateVersion: 4,
  decisionVersion: 9,
  target: id === "move" ? { rocketId: 7, deltaX: 1, deltaY: 0 }
    : id === "researchTech" ? { tileId: "orange2", blueSlot: 1 }
      : id === "playCard" ? { cardInstanceId: "card-7" }
        : id === "placeData" ? { target: "computer" } : null,
  payload: {},
  summary: family,
}));
const graphState = {
  playerState: { players: [{ id: "player-blue" }] },
  turnState: { roundNumber: 2 },
  currentPlayer: { id: "player-blue" },
};
const dependencies = {
  actionGraph,
  adjust: (_raw, candidate) => candidate,
  adjustForStyle: (_raw, candidate) => candidate,
  applySelectionPressure: (candidates) => candidates,
  policy,
};

function legacyReference() {
  const graph = dependencies.actionGraph.buildActionGraph(rawCandidates, graphState, "player-blue", {
    markedFormulas: [], hasMarkedFinalTile: false, traceCompetition: null,
  });
  const adjusted = graph.map((candidate, index) => {
    const value = dependencies.adjustForStyle(
      rawCandidates[index], dependencies.adjust(rawCandidates[index], candidate, graphState.currentPlayer),
      graphState.currentPlayer, [],
    );
    return {
      ...rawCandidates[index],
      actionGraph: {
        gain: value.gain, cost: value.cost, finalMarginal: value.finalMarginal,
        goalBonus: value.goalBonus, feasibility: value.feasibility, net: value.net,
      },
      breakdown: value.breakdown,
    };
  });
  const attached = adjusted.map((candidate, index) => ({
    ...candidate,
    standardAction: structuredClone(standardActions[index]),
  }));
  const candidates = dependencies.applySelectionPressure(attached);
  return {
    candidates,
    selectedAction: policy.chooseTurnAction(candidates, {
      playerState: graphState.playerState,
      turnState: graphState.turnState,
      currentPlayer: graphState.currentPlayer,
    }),
  };
}

const expected = legacyReference();
const actual = pipeline.buildCandidatePipeline({
  rawCandidates,
  graphState,
  currentPlayer: graphState.currentPlayer,
  markedFinalFormulas: [],
  traceCompetition: null,
  standardActions,
}, dependencies);

assert.deepEqual(actual.candidates, expected.candidates, "候选 identity/原始 actionGraph/顺序必须与旧链一致");
assert.equal(actual.selectedAction.standardAction.actionId, expected.selectedAction.standardAction.actionId);
assert.deepEqual(actual.candidates.map((candidate) => candidate.id), rawCandidates.map((candidate) => candidate.id));
assert.deepEqual(
  actual.candidates.map((candidate) => candidate.actionGraph.net),
  expected.candidates.map((candidate) => candidate.actionGraph.net),
);
assert.equal(pipeline.standardActionMatchesAiCandidate(
  standardActions.find((action) => action.family === "move"),
  rawCandidates.find((candidate) => candidate.id === "move"),
), true);

console.log("candidate-pipeline parity tests passed (15 top-level families)");

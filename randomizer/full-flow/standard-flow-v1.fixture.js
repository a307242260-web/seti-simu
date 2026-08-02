"use strict";

module.exports = Object.freeze({
  schemaVersion: "seti-standard-full-flow-v12",
  config: Object.freeze({
    seed: "seti-standard-full-flow-v12",
    activePlayerCount: 4,
    aiDifficulty: "weak_start",
    offlineTeacher: true,
    compactReplay: true,
  }),
  policyProvenance: Object.freeze({
    type: "heuristic",
    version: "seti-heuristic-policy-v21",
    config: Object.freeze({
      difficulty: "weak_start",
      evaluationParameters: Object.freeze({
        parameterVersion: "seti-strategic-goal-search-v2",
        searchDepth: 15,
        techValuePerRemainingRound: 5,
      }),
    }),
    configChecksum: "4a48530a",
  }),
  expected: Object.freeze({
    playerCount: 4,
    initialCardCount: 2,
    maximumOpeningInputs: 50,
    forbiddenCommittedFields: Object.freeze([
      "initialSetupConfig",
      "aiDifficulty",
      "planetsReference",
      "referencePlacement",
      "debugOnly",
      "percentX",
      "percentY",
    ]),
  }),
});

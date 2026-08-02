"use strict";

module.exports = Object.freeze({
  schemaVersion: "seti-standard-full-flow-v17",
  config: Object.freeze({
    seed: "seti-standard-full-flow-v17",
    activePlayerCount: 4,
    aiDifficulty: "weak_start",
    offlineTeacher: true,
    compactReplay: true,
  }),
  policyProvenance: Object.freeze({
    type: "heuristic",
    version: "seti-heuristic-policy-v26",
    config: Object.freeze({
      difficulty: "weak_start",
      evaluationParameters: Object.freeze({
        parameterVersion: "seti-strategic-goal-search-v3",
        searchDepth: 15,
      }),
    }),
    configChecksum: "6716b32a",
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

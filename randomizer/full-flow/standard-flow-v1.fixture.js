"use strict";

module.exports = Object.freeze({
  schemaVersion: "seti-standard-full-flow-v10",
  config: Object.freeze({
    seed: "seti-standard-full-flow-v10",
    activePlayerCount: 4,
    aiDifficulty: "weak_start",
    offlineTeacher: true,
    compactReplay: true,
  }),
  policyProvenance: Object.freeze({
    type: "heuristic",
    version: "seti-heuristic-policy-v8",
    config: Object.freeze({
      difficulty: "weak_start",
      evaluationParameters: Object.freeze({ parameterVersion: "seti-probe-route-value-v4" }),
    }),
    configChecksum: "793c7fc5",
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

"use strict";

const assert = require("node:assert/strict");
const { createAiExperimentRunner } = require("./experiment-runner");

const state = { running: false, logs: [], bugs: [], stepDelayMs: 0 };
const runtime = createAiExperimentRunner({
  aiAutoBattleState: state,
  windowRef: { setTimeout },
  recordAiAutoBattleLog: () => null,
  getAiAutoBattleReport: () => ({ running: state.running }),
});

assert.equal(runtime.getAiCandidateRankScore({ actionGraph: { net: 4 }, score: 2 }), 4);
assert.equal(runtime.getAiCandidateRankScore({ score: 2 }), 2);
assert.equal(runtime.normalizeAiKnownCardId("7"), "b_7.webp");
assert.equal(runtime.normalizeAiReadableCardLabel("7"), null);
assert.deepEqual(runtime.stopAiAutoBattle(), { running: false });

console.log("app/ai/experiment-runner.test.js ok");

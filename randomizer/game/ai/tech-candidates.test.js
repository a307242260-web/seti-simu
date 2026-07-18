"use strict";
const assert = require("node:assert/strict");
const { createTechCandidates } = require("./tech-candidates");
const domain = createTechCandidates({ getCurrentPlayer: () => null });
assert.deepEqual(domain.selectExecutableAiResearchTechCandidate([], null, null, []), {
  candidate: null,
  check: { ok: false, message: "没有可研究科技候选" },
});
console.log("game/ai/tech-candidates.test.js ok");

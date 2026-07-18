"use strict";
const assert = require("node:assert/strict");
const { createStateSummary } = require("./state-summary");
const domain = createStateSummary({});
assert.equal(domain.countAiPlayerTech({ techState: { ownedTiles: { orange: [1, 2], blue: 3 } } }), 3);
console.log("game/ai/state-summary.test.js ok");

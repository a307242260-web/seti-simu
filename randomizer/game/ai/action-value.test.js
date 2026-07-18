"use strict";
const assert = require("node:assert/strict");
const { createActionValue } = require("./action-value");
const domain = createActionValue({ aiNumber: (value) => Number(value) || 0 });
assert.equal(domain.getAiActionGraphBaseNet({ gain: 9, cost: 4 }), 5);
assert.equal(domain.getAiActionGraphBaseNet({ breakdown: { existingScore: 7 } }), 7);
console.log("game/ai/action-value.test.js ok");

"use strict";
const assert = require("node:assert/strict");
const { createResourceValuation } = require("./resource-valuation");
const domain = createResourceValuation({});
assert.equal(domain.aiNumber("3.5"), 3.5);
assert.equal(domain.aiNumber("bad"), 0);
assert.equal(domain.roundAiScore(1.23456), 1.235);
console.log("game/ai/resource-valuation.test.js ok");

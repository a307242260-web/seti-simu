"use strict";
const assert = require("node:assert/strict");
const { createFinalPace } = require("./final-pace");
const domain = createFinalPace({ ai: null });
assert.deepEqual(domain.getAiLaunchPaymentCost({}), { credits: 2 });
assert.deepEqual(domain.getAiLaunchPaymentCost({ skipCost: true }), {});
assert.deepEqual(domain.getAiLaunchPaymentCost({ cost: { energy: 1 } }), { energy: 1 });
console.log("game/ai/final-pace.test.js ok");

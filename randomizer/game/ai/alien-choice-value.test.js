"use strict";
const assert = require("node:assert/strict");
const { createAlienChoiceValue } = require("./alien-choice-value");
const domain = createAlienChoiceValue({ players: { RESOURCE_LIMITS: { energy: 5 } }, aiNumber: (value) => Number(value) || 0 });
assert.deepEqual(domain.getAiEffectiveBanrenmaRewardGain({ energy: 3, score: 2 }, { resources: { energy: 4 } }), { energy: 1, score: 2 });
console.log("game/ai/alien-choice-value.test.js ok");

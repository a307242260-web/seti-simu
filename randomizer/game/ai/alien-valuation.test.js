"use strict";
const assert = require("node:assert/strict");
const { createAlienValuation } = require("./alien-valuation");
const domain = createAlienValuation({});
const source = { nested: { value: 2 } };
const cloned = domain.cloneAiValue(source);
assert.deepEqual(cloned, source);
assert.notEqual(cloned.nested, source.nested);
console.log("game/ai/alien-valuation.test.js ok");

"use strict";
const assert = require("node:assert/strict");
const { createDemandCard } = require("./demand-card");
const domain = createDemandCard({});
const demand = domain.createAiStrategyDemand();
assert.deepEqual(demand.actions, {});
assert.equal(demand.distanceFromEarth.minDistance, 0);
assert.equal(domain.resetAiStrategyDemandCache(), undefined);
console.log("game/ai/demand-card.test.js ok");

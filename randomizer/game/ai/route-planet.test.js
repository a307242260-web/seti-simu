"use strict";
const assert = require("node:assert/strict");
const { createRoutePlanet } = require("./route-planet");
const domain = createRoutePlanet({ solar: { mod8: (value) => ((value % 8) + 8) % 8 } });
assert.equal(domain.getAiCircularDistanceX(7, 1), 2);
assert.equal(domain.getAiCircularDistanceX(2, 5), 3);
console.log("game/ai/route-planet.test.js ok");

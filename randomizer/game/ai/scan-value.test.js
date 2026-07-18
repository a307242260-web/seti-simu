"use strict";
const assert = require("node:assert/strict");
const { createScanValue } = require("./scan-value");
const player = { id: "p1", color: "blue" };
const domain = createScanValue({ getCurrentPlayer: () => player });
assert.equal(domain.aiTokenBelongsToPlayer({ playerId: "p1" }, player), true);
assert.equal(domain.aiTokenBelongsToPlayer({ playerColor: "red" }, player), false);
console.log("game/ai/scan-value.test.js ok");

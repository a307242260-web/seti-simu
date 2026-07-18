"use strict";
const assert = require("node:assert/strict");
const { createSelectionPressure } = require("./selection-pressure");
const domain = createSelectionPressure({ aiNumber: (value) => Number(value) || 0 });
assert.equal(domain.isRawNegativeResourceCardCornerAction({ id: "cardCorner", actionKind: "resource", score: -1 }), true);
assert.equal(domain.isRawNegativeResourceCardCornerAction({ id: "cardCorner", actionKind: "move", score: -1 }), false);
console.log("game/ai/selection-pressure.test.js ok");

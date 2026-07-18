"use strict";
const assert = require("node:assert/strict");
const { createCardCandidates } = require("./card-candidates");
const domain = createCardCandidates({
  banrenma: { isBanrenmaCard: (card) => card?.species === "banrenma" },
  chong: { isChongCard: () => false },
});
assert.equal(domain.doesAiCardReserveAfterPlay({ species: "banrenma" }, 0, null), true);
assert.equal(domain.doesAiCardReserveAfterPlay({}, 2, null), true);
assert.equal(domain.doesAiCardReserveAfterPlay({}, 0, {}), false);
console.log("game/ai/card-candidates.test.js ok");

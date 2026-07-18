"use strict";
const assert = require("node:assert/strict");
const { createIncomeCard } = require("./income-card");
const domain = createIncomeCard({});
assert.equal(domain.isAiPassReservePreviewIncomeCandidate({ cardId: "c1" }, { active: true, incomeCandidates: [{ cardId: "c1" }] }), true);
assert.equal(domain.isAiPassReservePreviewIncomeCandidate({ cardId: "c2" }, { active: true, incomeCandidates: [{ cardId: "c1" }] }), false);
console.log("game/ai/income-card.test.js ok");

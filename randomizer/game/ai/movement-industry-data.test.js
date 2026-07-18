"use strict";
const assert = require("node:assert/strict");
const { createMovementIndustryData } = require("./movement-industry-data");
const domain = createMovementIndustryData({});
const industry = { id: "industry:test" };
assert.equal(domain.getAiIndustryCard({ initialSelection: { industry } }), industry);
assert.equal(domain.getAiIndustryCard({}), null);
console.log("game/ai/movement-industry-data.test.js ok");

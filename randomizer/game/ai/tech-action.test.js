"use strict";
const assert = require("node:assert/strict");
const { createTechAction } = require("./tech-action");
const domain = createTechAction({});
assert.equal(domain.aiResearchTechEventMatches({ type: "researchTech" }, "blue"), true);
assert.equal(domain.aiResearchTechEventMatches({ type: "researchTech", techType: "orange" }, "blue"), false);
assert.equal(domain.aiResearchTechEventMatches({ type: "scan" }, "blue"), false);
console.log("game/ai/tech-action.test.js ok");

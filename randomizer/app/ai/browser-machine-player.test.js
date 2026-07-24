"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createCompositionPolicyBoundaryReader,
} = require("./browser-bootstrap");

const action = {
  schemaVersion: "seti-standard-action-v1",
  family: "pass",
  phase: "main",
  actionId: "pass:p1",
  actorId: "p1",
  stateVersion: 4,
  decisionVersion: 2,
  target: { kind: "pass" },
  payload: {},
  summary: "PASS",
};
const composition = {
  inspect: () => ({ phase: "idle", session: null }),
  lifecycle: { save: () => ({ ok: true, envelope: {} }) },
  inputPort: { enumerateActions: ({ actorId }) => (actorId === "p1" ? [action] : []) },
};
const projectionSource = {
  read: () => ({
    source: { kind: "committed", stateVersion: 4, phase: "idle" },
    state: { match: { currentPlayerId: "p1", decisionVersion: 2 } },
    decision: null,
  }),
};
const readBoundary = createCompositionPolicyBoundaryReader({ ruleComposition: composition, projectionSource });
assert.deepEqual(readBoundary("p1"), {
  kind: "action",
  actorId: "p1",
  stateVersion: 4,
  decisionVersion: 2,
  legalActions: [action],
});

const source = fs.readFileSync(path.join(__dirname, "browser-bootstrap.js"), "utf8");
assert.equal(source.includes("stateSourcePort"), false);
assert.equal(source.includes("workingRoot"), false);
assert.equal(source.includes("executeLegacy"), false);
console.log("browser machine player tests passed");

"use strict";

const assert = require("node:assert/strict");
const { auditSourceText, runAudit } = require("../../tools/audit_host_architecture");

const result = runAudit();
assert.equal(result.ok, true);
assert.equal(result.familyCount, 22);
assert.deepEqual(result.domainIds, [
  "standard_action",
  "card_play",
  "science",
  "probe_turn",
  "residual_domains",
]);

for (const source of [
  "const RuleBridge = { dispatch() {} };",
  "projection.playerState.players[0].credits = 10;",
  "function createLaunchExecutor() {}",
  "if (reason === 'unsupported') return { ok: true };",
]) {
  assert.throws(() => auditSourceText(source));
}

console.log("host architecture audit tests passed");

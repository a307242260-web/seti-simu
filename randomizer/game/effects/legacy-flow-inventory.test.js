"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const inventory = require("./legacy-flow-inventory");
const appRuntime = require("../../app/runtime");

assert.equal(inventory.INVENTORY.length, 2, "权威 inventory 必须只保留 2 个 host-only 字段");
assert.equal(new Set(inventory.INVENTORY.map((entry) => entry.field)).size, 2);
assert.equal(inventory.INVENTORY.every((entry) => ["host-only", "dated-adapter"].includes(entry.status)), true);
assert.equal(inventory.INVENTORY
  .filter((entry) => entry.status === "dated-adapter")
  .every((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn) && entry.owner), true);

const pending = appRuntime.createPendingState();
const cleanAudit = inventory.auditLegacyPendingState(pending, { asOf: "2026-07-19" });
assert.equal(cleanAudit.ok, true);
assert.equal(cleanAudit.fieldCount, 2);
assert.deepEqual(cleanAudit.activeAdapters, []);

pending.passReserveSelectionDismissed = true;
assert.deepEqual(
  inventory.auditLegacyPendingState(pending, { asOf: "2026-07-19" }).activeAdapters.sort(),
  [],
);

const unknown = { ...appRuntime.createPendingState(), surpriseResolver: true };
assert.deepEqual(inventory.auditLegacyPendingState(unknown).unknownFields, ["surpriseResolver"]);
const missing = appRuntime.createPendingState();
delete missing.scanRunSequence;
assert.deepEqual(inventory.auditLegacyPendingState(missing).missingFields, ["scanRunSequence"]);
assert.equal(inventory.auditLegacyPendingState(appRuntime.createPendingState(), { asOf: "2026-09-01" }).ok, true,
  "host-only 字段无 adapter 到期日");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../../app/runtime.js"), "utf8");
assert.match(runtimeSource, /legacyFlowInventory\.createLegacyPendingState\(\)/);
for (const entry of inventory.INVENTORY) {
  assert.equal(runtimeSource.includes(`${entry.field}:`), false, `${entry.field} 不得在 runtime.js 维护第二份默认值`);
}

for (const hostFile of ["effect-session-host.js", "headless-effect-session-host.js"]) {
  const source = fs.readFileSync(path.join(__dirname, `../../app/${hostFile}`), "utf8");
  for (const forbidden of ["pendingState", "abilities.chain", "runAiPendingStep", "recoverPendingAction"]) {
    assert.equal(source.includes(forbidden), false, `${hostFile} 已迁移热路径不得回流 ${forbidden}`);
  }
}

console.log("legacy Effect Session inventory tests passed");

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const inventory = require("./authority-inventory");

const audit = inventory.auditInventory({ asOf: "2026-07-19" });
assert.equal(audit.ok, true);
assert.equal(audit.missingOwner.length, 0);
assert.equal(audit.undatedAdapters.length, 0);
assert.equal(audit.expiredAdapters.length, 0);
assert.deepEqual(
  inventory.INVENTORY.filter((entry) => entry.status === "dated-adapter").map((entry) => entry.id),
  [],
);

const repositoryRoot = path.resolve(__dirname, "../../..");
const result = spawnSync(process.execPath, [path.join(repositoryRoot, "tools", "audit_state_authority.js")], {
  cwd: repositoryRoot,
  encoding: "utf8",
  env: { ...process.env, SETI_AUDIT_DATE: "2026-07-19" },
});
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(result.stdout);
assert.equal(report.ok, true);
assert.deepEqual(report.violations, []);
assert.deepEqual(report.residualAdapters, []);

console.log("state authority inventory tests passed");

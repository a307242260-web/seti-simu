"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const inventory = require("./authority-inventory");

const audit = inventory.auditInventory();
assert.equal(audit.ok, true);
assert.equal(audit.missingOwner.length, 0);
assert.deepEqual(audit.nonFormal, []);
assert.ok(inventory.INVENTORY.every((entry) => entry.status === "formal"));
assert.ok(inventory.INVENTORY.every((entry) => !Object.hasOwn(entry, "expiresOn")));

const repositoryRoot = path.resolve(__dirname, "../../..");
const result = spawnSync(process.execPath, [path.join(repositoryRoot, "tools", "audit_state_authority.js")], {
  cwd: repositoryRoot,
  encoding: "utf8",
  env: process.env,
});
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(result.stdout);
assert.equal(report.ok, true);
assert.deepEqual(report.violations, []);
assert.deepEqual(report.forbiddenReferences, []);
assert.deepEqual(report.forbiddenFiles, []);
assert.deepEqual(report.residualInventory, inventory.INVENTORY);

console.log("state authority inventory tests passed");

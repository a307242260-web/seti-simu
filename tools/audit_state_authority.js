#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const inventory = require("../randomizer/game/state/authority-inventory");

const repositoryRoot = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(repositoryRoot, "randomizer", "app.js"), "utf8");
const recoverySource = fs.readFileSync(path.join(repositoryRoot, "randomizer", "app", "game-recovery.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(repositoryRoot, "randomizer", "index.html"), "utf8");
const headlessSource = fs.readFileSync(path.join(repositoryRoot, "randomizer", "app", "headless-env.js"), "utf8");

const inventoryAudit = inventory.auditInventory({
  asOf: process.env.SETI_AUDIT_DATE || new Date().toISOString().slice(0, 10),
});
const violations = {
  legacyStateAdapterReference: [htmlSource, recoverySource, headlessSource]
    .some((source) => source.includes("legacy-state-adapter") || source.includes("SetiLegacyStateAdapter")),
  derivedCardTaskPersistence: /cardTaskState\s*:\s*structuredClone/.test(appSource),
  setupSessionPersistence: /setupSelectionState\s*:\s*structuredClone/.test(appSource),
  legacySliceRecoveryInput: recoverySource.includes("stateSlices"),
  missingStateStoreSerializer: !recoverySource.includes("stateStore.serialize()"),
  missingStateStoreDeserializer: !recoverySource.includes("stateStore.deserialize(envelope.committedState)"),
};
const structuralViolations = Object.entries(violations).filter(([, failed]) => failed).map(([key]) => key);
const report = {
  schemaVersion: inventory.SCHEMA_VERSION,
  ok: inventoryAudit.ok && structuralViolations.length === 0,
  inventory: inventoryAudit,
  violations: structuralViolations,
  residualAdapters: inventory.INVENTORY.filter((entry) => entry.status === "dated-adapter"),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;

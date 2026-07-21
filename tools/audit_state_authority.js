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

const inventoryAudit = inventory.auditInventory();

function listProductionFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listProductionFiles(filePath);
    if (!/\.(?:js|html)$/.test(entry.name)) return [];
    if (/\.(?:test|browser-smoke)\.(?:js|html)$/.test(entry.name)) return [];
    if (entry.name.includes("test-harness")) return [];
    return [filePath];
  });
}

const forbiddenSymbols = [
  "legacy-state-adapter",
  "SetiLegacyStateAdapter",
  "projectCommittedStateToLegacySlices",
  "projectLegacySlicesToCommittedState",
  "toLegacyCandidate",
  "chooseTurnAction",
  "choosePlayCard",
  "LEGACY_FAMILY_BY_ID",
  "candidate-pipeline",
  "options.migrations",
];
const productionFiles = listProductionFiles(path.join(repositoryRoot, "randomizer"));
const forbiddenReferences = productionFiles.flatMap((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  return forbiddenSymbols
    .filter((symbol) => source.includes(symbol))
    .map((symbol) => ({ file: path.relative(repositoryRoot, filePath), symbol }));
});
const forbiddenFiles = [
  "randomizer/game/state/legacy-state-adapter.js",
  "randomizer/game/ai/candidate-pipeline.js",
].filter((relativePath) => fs.existsSync(path.join(repositoryRoot, relativePath)));
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
  ok: inventoryAudit.ok
    && structuralViolations.length === 0
    && forbiddenReferences.length === 0
    && forbiddenFiles.length === 0,
  inventory: inventoryAudit,
  violations: structuralViolations,
  forbiddenReferences,
  forbiddenFiles,
  residualInventory: inventory.INVENTORY,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;

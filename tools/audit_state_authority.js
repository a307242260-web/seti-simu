#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const inventory = require("../randomizer/game/state/authority-inventory");
const stateStoreApi = require("../randomizer/game/state/state-store");
const residentProjection = require("../randomizer/app/browser-host/resident-projection");
const architectureAudit = require("./lib/state-authority-audit");
const browserHardCutAudit = require("./lib/browser-authority-hard-cut-audit");

const repositoryRoot = path.resolve(__dirname, "..");

function runCommitTrace() {
  const initial = stateStoreApi.createCommittedGameState({
    gameId: "architecture-audit",
    rulesetVersion: "audit-v1",
    seed: "audit-seed",
    rngState: { owner: "audit", state: 1 },
    sequences: { action: 0 },
  });
  const store = stateStoreApi.createStateStore(initial);
  const events = [];
  store.subscribe((event) => events.push(event));
  const beforeBytes = store.serialize().serialized;
  const working = store.beginWorkingCopy();
  working.state.match.auditMarker = "committed-once";
  const isolatedBytes = store.serialize().serialized;
  const committed = store.compareAndCommit(working.baseVersion, working.state, { source: "architecture-audit" });
  const afterBytes = store.serialize().serialized;
  const staleCandidate = structuredClone(working.state);
  staleCandidate.match.auditMarker = "stale-must-not-write";
  const stale = store.compareAndCommit(working.baseVersion, staleCandidate, { source: "architecture-audit-stale" });
  const afterStaleBytes = store.serialize().serialized;
  const ok = beforeBytes === isolatedBytes
    && committed.ok === true
    && committed.previousVersion === 0
    && committed.stateVersion === 1
    && events.length === 1
    && events[0].type === "committed"
    && stale.ok === false
    && stale.code === "STATE_VERSION_CONFLICT"
    && afterBytes === afterStaleBytes;
  return {
    ok,
    beforeWorkingCopyBytesUnchanged: beforeBytes === isolatedBytes,
    committedVersionDelta: committed.ok ? committed.stateVersion - committed.previousVersion : null,
    commitEvents: events.length,
    staleCode: stale.code || null,
    staleBytesUnchanged: afterBytes === afterStaleBytes,
  };
}

function runInterfacePoison() {
  let getterReads = 0;
  const poisoned = {};
  for (const key of architectureAudit.LEGACY_SLICE_KEYS) {
    Object.defineProperty(poisoned, key, {
      enumerable: true,
      get() { getterReads += 1; throw new Error(`legacy getter touched: ${key}`); },
    });
  }
  const result = residentProjection.createResidentProjection(poisoned);
  return {
    ok: result.ok === false
      && result.code === "RESIDENT_PROJECTION_LEGACY_SLICE_REJECTED"
      && getterReads === 0,
    resultCode: result.code || null,
    forbiddenGetterReads: getterReads,
  };
}

function auditBrowserScriptEntries(entryInventory) {
  const htmlEntries = entryInventory.filter((entry) => entry.entryKind === "html");
  const missingScripts = [];
  for (const entry of htmlEntries) {
    for (const dependency of entry.dependencies) {
      if (!dependency.startsWith(".")) continue;
      const target = path.resolve(repositoryRoot, path.dirname(entry.file), dependency);
      if (!fs.existsSync(target)) missingScripts.push({ html: entry.file, script: dependency });
    }
  }
  return { ok: missingScripts.length === 0, htmlEntries: htmlEntries.length, missingScripts };
}

const forbiddenFiles = [
  "randomizer/game/state/legacy-state-adapter.js",
  "randomizer/game/ai/policy.js",
  "randomizer/game/ai/candidate-pipeline.js",
].filter((relativePath) => fs.existsSync(path.join(repositoryRoot, relativePath)));
const sourceAudit = architectureAudit.auditSources(repositoryRoot);
const browserHardCut = browserHardCutAudit.auditRepository(repositoryRoot);
const inventoryAudit = inventory.auditInventory();
const commitTrace = runCommitTrace();
const interfacePoison = runInterfacePoison();
const entryAudit = auditBrowserScriptEntries(sourceAudit.inventory);
const violations = [
  ...sourceAudit.violations,
  ...browserHardCut.violations,
  ...forbiddenFiles.map((file) => ({ file, code: "FORBIDDEN_PRODUCTION_FILE", message: "旧 owner/policy 文件仍存在" })),
];

const report = {
  schemaVersion: inventory.SCHEMA_VERSION,
  ok: inventoryAudit.ok && entryAudit.ok && commitTrace.ok && interfacePoison.ok && violations.length === 0,
  ownerInventory: inventory.INVENTORY,
  residualInventory: inventory.RESIDUAL_INVENTORY,
  inventory: inventoryAudit,
  productionEntryAudit: {
    ok: entryAudit.ok,
    total: sourceAudit.inventory.length,
    javascript: sourceAudit.inventory.filter((entry) => entry.entryKind === "javascript").length,
    html: sourceAudit.inventory.filter((entry) => entry.entryKind === "html").length,
    missingScripts: entryAudit.missingScripts,
    entries: sourceAudit.inventory,
  },
  runtimeCommitTrace: commitTrace,
  interfacePoison,
  browserAuthorityHardCut: browserHardCut,
  violations,
  forbiddenFiles,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;

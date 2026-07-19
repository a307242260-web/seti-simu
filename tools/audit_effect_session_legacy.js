#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const inventory = require("../randomizer/game/effects/legacy-flow-inventory");
const appRuntime = require("../randomizer/app/runtime");

const repositoryRoot = path.resolve(__dirname, "..");
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(resolved);
    else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) files.push(resolved);
  }
}
walk(path.join(repositoryRoot, "randomizer", "app"));
files.push(path.join(repositoryRoot, "randomizer", "app.js"));

const callsites = Object.fromEntries(inventory.INVENTORY.map((entry) => [entry.field, []]));
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(repositoryRoot, file);
  for (const field of Object.keys(callsites)) {
    if (source.includes(`pendingState.${field}`)) callsites[field].push(relative);
  }
}

const audit = inventory.auditLegacyPendingState(appRuntime.createPendingState(), {
  asOf: process.env.SETI_AUDIT_DATE || new Date().toISOString().slice(0, 10),
});
const report = {
  schemaVersion: inventory.SCHEMA_VERSION,
  ok: audit.ok,
  inventory: {
    total: inventory.INVENTORY.length,
    hostOnly: inventory.INVENTORY.filter((entry) => entry.status === "host-only").length,
    datedAdapters: inventory.INVENTORY.filter((entry) => entry.status === "dated-adapter").length,
    expiresOn: inventory.ADAPTER_EXPIRES_ON,
    owner: inventory.ADAPTER_OWNER,
  },
  violations: {
    unknownFields: audit.unknownFields,
    missingFields: audit.missingFields,
    expiredAdapters: audit.expiredAdapters,
  },
  remainingAdapterCallsites: Object.fromEntries(Object.entries(callsites).filter(([, matches]) => matches.length)),
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;

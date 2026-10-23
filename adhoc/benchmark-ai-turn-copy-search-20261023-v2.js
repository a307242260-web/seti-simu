"use strict";
// Reuse the same diagnostic driver and variant reconstruction; no duplicate simulation entry.
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), assert = require("node:assert/strict");
const driverPath = path.resolve("adhoc/benchmark-ai-identity-search-20261023-v2.js");
let driver = fs.readFileSync(driverPath, "utf8");
assert(driver.includes('["original", "imperative", "parity"]'));
driver = driver.replace('["original", "imperative", "parity"]', '["original", "imperative", "combined", "parity"]')
  .replaceAll('identity-search-${', 'turn-copy-search-${');
const marker = 'if (variant === "parity") {';
const restoreFullCopies = `
if (variant === "original" || variant === "imperative") {
  loadedSource = loadedSource.replace('return turnFlow.advanceTurnAfterPlayerAction({ ...state, turn: structuredClone(state.turn) }, seatId, options);',
    'return turnFlow.advanceTurnAfterPlayerAction(structuredClone(state), seatId, options);');
}
`;
driver = driver.replace(marker, restoreFullCopies + marker)
  .replace('Only forwardIdentity object construction differs.', 'Original vs identity loop vs combined turn-only copying; preview uses the same Production turn transition and frozen other slices.');
const mod = new Module(driverPath, module); mod.filename = driverPath; mod.paths = Module._nodeModulePaths(path.dirname(driverPath)); mod._compile(driver, driverPath);

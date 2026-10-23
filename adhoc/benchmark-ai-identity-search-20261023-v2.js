"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict"), Module = require("node:module");
const [variant, caseId, run] = process.argv.slice(2);
assert(["original", "imperative", "parity"].includes(variant)); assert(["008", "062"].includes(caseId)); assert(/^\d+$/.test(run));
const output = `reports/ai-foundation-20261023/identity-search-${variant}-${caseId}-${run}-v2.json`;
assert(!fs.existsSync(output), "Reuse existing checkpoint");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const modulePath = path.resolve("randomizer/game/ai/analysis-port.js"), onDisk = fs.readFileSync(modulePath, "utf8");
const prototype = JSON.parse(fs.readFileSync("reports/ai-foundation-20261023/identity-micro-v2.json"));
assert(onDisk.includes(prototype.functionSources.imperative));
let parityCalls = 0, loadedSource = variant === "original" ? onDisk.replace(prototype.functionSources.imperative, prototype.functionSources.original) : onDisk;
if (variant === "parity") {
  global.__setiIdentityParity = () => { parityCalls += 1; };
  const original = prototype.functionSources.original.replace("function forwardIdentity(", "function originalForwardIdentity(");
  const candidate = prototype.functionSources.imperative.replace("function forwardIdentity(", "function candidateForwardIdentity(");
  const wrapper = `${original}\n${candidate}\nfunction forwardIdentity(...args) { const expected = originalForwardIdentity(...args); const actual = candidateForwardIdentity(...args); if (actual !== expected) throw new Error("IDENTITY_BYTE_PARITY_FAILED"); global.__setiIdentityParity(); return actual; }\n`;
  loadedSource = onDisk.replace(prototype.functionSources.imperative, wrapper);
}
const mod = new Module(modulePath, module); mod.filename = modulePath; mod.paths = Module._nodeModulePaths(path.dirname(modulePath));
require.cache[modulePath] = mod; mod._compile(loadedSource, modulePath);
const { createAnalysisPort } = mod.exports;
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { searchDecision } = require("../randomizer/game/ai/decision-search");
const { createStateValueEvaluator } = require("../randomizer/game/ai/state-value");
const fixturePath = `adhoc/ai-decision-corpus-20261023-v1/case-${caseId}-20261023-v1.json`, fixture = JSON.parse(fs.readFileSync(fixturePath));
const seed = fixture.source.seed, kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed }); const comp = kernel.composition; assert(comp.lifecycle.restore(fixture.compositionEnvelope).ok);
const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId: fixture.seatId, maxCacheEntries: 0 });
try {
  const at = performance.now(), root = port.openRoot(), evaluate = createStateValueEvaluator(fixture.seatId);
  const result = searchDecision({ port, root, evaluate, modelKey: evaluate.modelKey, planReuse: true,
    resourceDominance: true, moneyCapacityDominance: true, cardTradePruning: true, postMainPruning: true, openingPruning: true, cardChoiceEquivalence: true,
    budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: variant === "parity" ? 30000 : 15000 } });
  const milliseconds = performance.now() - at;
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  const rawPath = `adhoc/ai-decision-corpus-20261023-v1/identity-search-${variant}-${caseId}-${run}-v2.raw.json`;
  fs.writeFileSync(rawPath, JSON.stringify(result) + "\n");
  // Exclude wall-time metadata and the explicit parity watchdog from deterministic graph comparison.
  const behavior = structuredClone(result); delete behavior.elapsedMilliseconds; delete behavior.budget; delete behavior.diagnostics.milliseconds;
  const report = { scope: "Fresh Node process; root creation plus identical bounded search, no full game or terminal score. Only forwardIdentity object construction differs.",
    variant, caseId, run, node: process.version, fixturePath, fixtureSha256: sha(fs.readFileSync(fixturePath)), milliseconds,
    complete: result.complete, actionId: result.actionId, value: result.value, distance: result.lines?.[0]?.distance ?? null,
    unresolved: result.unresolved.length, stopReason: result.stopReason, diagnostics: result.diagnostics, port: port.getDiagnostics(),
    rootUnchanged: true, parityCalls, rawPath, rawSha256: sha(fs.readFileSync(rawPath)), behaviorSha256: sha(JSON.stringify(behavior)),
    loadedAnalysisPortSha256: sha(loadedSource), onDiskAnalysisPortSha256: sha(onDisk), sourceHashes: Object.fromEntries(Object.keys(require.cache)
      .filter(p => p.includes("/randomizer/")).map(p => [p.slice(process.cwd().length + 1), sha(fs.readFileSync(p))])) };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, milliseconds, complete: result.complete, transitions: result.diagnostics.transitions, nodes: result.diagnostics.nodes,
    actionId: result.actionId, value: result.value, parityCalls, behaviorSha256: report.behaviorSha256 }));
} finally { port.close(); comp.dispose(); delete global.__setiIdentityParity; }

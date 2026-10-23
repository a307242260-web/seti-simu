"use strict";
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const crypto = require("node:crypto"), assert = require("node:assert/strict");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const archivePath = "adhoc/ai-surplus-data-prototype-20261023-v1.json", archive = JSON.parse(fs.readFileSync(archivePath));
const filename = path.resolve("randomizer/game/ai/analysis-port.js"), ports = {};
for (const key of ["original", "postMain", "combined"]) {
  assert.equal(sha(archive[key + "Source"]), archive.hashes[key]);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(archive[key + "Source"], filename); ports[key] = mod.exports.createAnalysisPort;
}
assert.equal(sha(fs.readFileSync(filename)), archive.hashes.combined);
const { searchDecision } = require("../randomizer/game/ai/decision-search");
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createStateValueEvaluator } = require("../randomizer/game/ai/state-value");
const output = "reports/ai-foundation-20261023/surplus-data-complete-window-v1.json";
assert(!fs.existsSync(output), "Reuse existing checkpoint");
const fixturePath = "adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json", f = JSON.parse(fs.readFileSync(fixturePath));
const report = { scope: "Original case008, separately add post-main surplus-data proof then before-main proof; same sequential process with warmup, no isolated speed ratio or game claim",
  fixturePath, fixtureSha256: sha(fs.readFileSync(fixturePath)), archivePath, archiveSha256: sha(fs.readFileSync(archivePath)),
  budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 }, rows: [] };
for (const [label, createAnalysisPort] of Object.entries(ports)) {
  const seed = f.source.seed, kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
  kernel.newGame({ seed }); const comp = kernel.composition; assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
  const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId: f.seatId, maxCacheEntries: 0 });
  try {
    const root = port.openRoot(), evaluate = createStateValueEvaluator(f.seatId), at = performance.now();
    const result = searchDecision({ port, root, evaluate, modelKey: evaluate.modelKey, planReuse: true, budget: report.budget,
      resourceDominance: true, moneyCapacityDominance: true, cardTradePruning: true, postMainPruning: true,
      openingPruning: true, cardChoiceEquivalence: true });
    const milliseconds = performance.now() - at; assert.deepEqual(comp.lifecycle.save().envelope, before);
    const rawPath = `adhoc/ai-decision-corpus-20261023-v1/surplus-data-${label}-v1.raw.json`;
    fs.writeFileSync(rawPath, JSON.stringify(result) + "\n");
    report.rows.push({ label, complete: result.complete, stopReason: result.stopReason, actionId: result.actionId,
      value: result.value, distance: result.lines[0].distance, diagnostics: result.diagnostics, port: port.getDiagnostics(),
      milliseconds, rawPath, rawSha256: sha(fs.readFileSync(rawPath)), rootUnchanged: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report.rows.at(-1)));
  } finally { port.close(); comp.dispose(); }
}
report.allComplete = report.rows.every(row => row.complete);
report.resultsMatch = report.allComplete && report.rows.every(row => ["actionId", "value", "distance"].every(key => row[key] === report.rows[0][key]));
report.sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(p => p.includes("/randomizer/"))
  .map(p => [path.relative(process.cwd(), p), sha(fs.readFileSync(p))]));
report.sourceHashes["randomizer/game/ai/analysis-port.js"] = archive.hashes.combined;
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
assert(!report.allComplete || report.resultsMatch, "Changed complete optimum, first action or shortest path");

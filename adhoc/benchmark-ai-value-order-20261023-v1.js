"use strict";
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const crypto = require("node:crypto"), assert = require("node:assert/strict");
const archivePath = "adhoc/ai-value-order-prototype-20261023-v1.json";
const archive = JSON.parse(fs.readFileSync(archivePath)), sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
assert.equal(sha(archive.originalSource), archive.originalSha256);
assert.equal(sha(archive.prototypeSource), archive.prototypeSha256);
const filename = path.resolve("randomizer/game/ai/decision-search.js"), original = new Module(filename, module);
original.filename = filename; original.paths = Module._nodeModulePaths(path.dirname(filename)); original._compile(archive.originalSource, filename);
const prototype = require(filename); assert.equal(sha(fs.readFileSync(filename)), archive.prototypeSha256);
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createAnalysisPort } = require("../randomizer/game/ai/analysis-port");
const { createStateValueEvaluator } = require("../randomizer/game/ai/state-value");
const output = "reports/ai-foundation-20261023/value-order-complete-window-v1.json";
assert(!fs.existsSync(output), "Reuse existing checkpoint");
const fixturePath = "adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json";
const fixture = JSON.parse(fs.readFileSync(fixturePath));
const report = { scope: "Original case008 visible window, scheduling only; same sequential process with warmup, no isolated speed ratio or game claim",
  fixturePath, fixtureSha256: sha(fs.readFileSync(fixturePath)), archivePath, archiveSha256: sha(fs.readFileSync(archivePath)),
  budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 }, rows: [] };
for (const [label, searchDecision] of [["baseline", original.exports.searchDecision], ["value-priority", prototype.searchDecision]]) {
  const seed = fixture.source.seed, kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
  kernel.newGame({ seed }); const comp = kernel.composition; assert(comp.lifecycle.restore(fixture.compositionEnvelope).ok);
  const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId: fixture.seatId, maxCacheEntries: 0 });
  try {
    const root = port.openRoot(), evaluate = createStateValueEvaluator(fixture.seatId), started = performance.now();
    const result = searchDecision({ port, root, evaluate, budget: report.budget, modelKey: evaluate.modelKey, planReuse: true,
      resourceDominance: true, moneyCapacityDominance: true, cardTradePruning: true, postMainPruning: true,
      openingPruning: true, cardChoiceEquivalence: true });
    const milliseconds = performance.now() - started; assert.deepEqual(comp.lifecycle.save().envelope, before);
    const rawPath = `adhoc/ai-decision-corpus-20261023-v1/value-order-${label}-v1.raw.json`;
    fs.writeFileSync(rawPath, JSON.stringify(result) + "\n");
    const row = { label, complete: result.complete, stopReason: result.stopReason, actionId: result.actionId, value: result.value,
      distance: result.lines[0].distance, diagnostics: result.diagnostics, port: port.getDiagnostics(), milliseconds,
      rawPath, rawSha256: sha(fs.readFileSync(rawPath)), rootUnchanged: true };
    report.rows.push(row); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(row));
  } finally { port.close(); comp.dispose(); }
}
report.bothComplete = report.rows.every(row => row.complete);
report.resultsMatch = report.bothComplete && ["actionId", "value", "distance"].every(key => report.rows[0][key] === report.rows[1][key]);
report.sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(p => p.includes("/randomizer/"))
  .map(p => [path.relative(process.cwd(), p), sha(fs.readFileSync(p))]));
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
assert(!report.bothComplete || report.resultsMatch, "Scheduling changed complete optimum, first action or shortest path");

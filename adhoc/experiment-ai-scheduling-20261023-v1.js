"use strict";
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createAnalysisPort } = require("../randomizer/game/ai/analysis-port");
const { createStateValueEvaluator } = require("../randomizer/game/ai/state-value");
const output = "reports/ai-foundation-20261023/scheduling-experiment-v1.json";
assert(!fs.existsSync(output), "Existing experiment; reuse checkpoint");
const fixturePath = "adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json";
const fixture = JSON.parse(fs.readFileSync(fixturePath));
const searchPath = path.resolve("randomizer/game/ai/decision-search.js"), original = fs.readFileSync(searchPath, "utf8");
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const baseline = JSON.parse(fs.readFileSync("reports/ai-foundation-20261023/company-trade-pass-offer-comparison-v1.json")).rows.find(r => r.name === "optimized");
const report = { scope: "offline scheduling and provisional post-main upper-bound experiments only; no production changes, no gate or whole-game acceptance",
  fixturePath, fixtureSha256: hash(fs.readFileSync(fixturePath)), originalSearchSha256: hash(original),
  budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 },
  baseline: { inputs: baseline.diagnostics.transitions, actionId: baseline.actionId, value: baseline.value, distance: baseline.distance },
  counterCaveat: "Experimental post-main bound increments the existing cardTradePrunes counter solely to preserve v19 global-proof reporting; this is not the published algorithm or counter definition", rows: [] };
const archives = {};
for (const [name, dfs, postBound] of [["dfs", true, false], ["post-bound-bfs", false, true], ["post-bound-dfs", true, true]]) {
  let source = original;
  if (postBound) {
    const anchor = '      if (cardChoiceEquivalence && !entry.selection';
    assert.equal(source.split(anchor).length, 2);
    source = source.replace(anchor, `      if (incumbent && !nodes[0].selection && entry.localPlan?.kind === "post-main") {
        const upperBound = evaluate(entry.node.observation) + entry.localPlan.maximumValueIncrease;
        if (incumbent.value > upperBound) {
          entry.prunedByBound = { ...incumbent, upperBound, proof: "experimental-post-main-bound-v1", modelKey: evaluate.modelKey };
          cardTradePrunes += 1;
          if (entry.queued) { entry.queued = false; pendingFrontier -= 1; }
          cursor += 1;
          continue;
        }
      }
` + anchor);
  }
  if (dfs) {
    assert(source.includes('outer: while (cursor < queue.length)'));
    source = source.replace('    let cursor = 0;\n', '').replace('outer: while (cursor < queue.length)', 'outer: while (queue.length)')
      .replace('const entry = nodes[queue[cursor]];', 'const entry = nodes[queue.pop()];').replaceAll('cursor += 1;', '');
  }
  source = source.replace('seti-complete-decision-search-v19', `seti-offline-scheduling-experiment-v1/${name}`);
  archives[name] = { sha256: hash(source), source };
  const module = new Module(searchPath, require.main); module.filename = searchPath;
  module.paths = Module._nodeModulePaths(path.dirname(searchPath)); module._compile(source, searchPath);
  const seed = fixture.source.seed;
  const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (s, v) => buildRuleObservation(s, seed, v?.playerId) });
  kernel.newGame({ seed }); const comp = kernel.composition;
  assert(comp.lifecycle.restore(fixture.compositionEnvelope).ok);
  const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId: fixture.seatId, maxCacheEntries: 0 });
  const at = performance.now(), root = port.openRoot();
  const result = module.exports.searchDecision({ port, root, evaluate: createStateValueEvaluator(fixture.seatId), budget: report.budget,
    resourceDominance: true, moneyCapacityDominance: true, cardTradePruning: true, postMainPruning: true,
    openingPruning: true, cardChoiceEquivalence: true });
  const milliseconds = performance.now() - at;
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  const rawPath = `adhoc/ai-decision-corpus-20261023-v1/scheduling-experiment-${name}-v1.raw.json`;
  fs.writeFileSync(rawPath, JSON.stringify(result) + "\n");
  const row = { name, complete: result.complete, stopReason: result.stopReason, actionId: result.actionId, value: result.value,
    distance: result.lines[0].distance, inputs: result.diagnostics.transitions, milliseconds, diagnostics: result.diagnostics,
    experimentalPostBoundNodes: result.lines.filter(l => l.prunedByBound?.proof === "experimental-post-main-bound-v1").length,
    port: port.getDiagnostics(), rawPath, rawSha256: hash(fs.readFileSync(rawPath)), variantSha256: hash(source), rootUnchanged: true };
  if (result.complete) for (const key of ["actionId", "value", "distance"]) assert.equal(row[key], baseline[key], `${name}/${key}`);
  report.rows.push(row);fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");console.log(JSON.stringify(row));
  port.close();comp.dispose();
}
const archivePath = "adhoc/ai-scheduling-experiment-source-20261023-v1.json";
fs.writeFileSync(archivePath, JSON.stringify({ originalSearchSha256: hash(original), variants: archives }, null, 2) + "\n");
report.archivePath = archivePath;report.archiveSha256 = hash(fs.readFileSync(archivePath));
report.sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(p => p.includes("/randomizer/")).map(p => [path.relative(process.cwd(), p), hash(fs.readFileSync(p))]));
report.status = "complete";fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");

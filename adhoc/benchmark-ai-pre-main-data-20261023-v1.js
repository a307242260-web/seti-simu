"use strict";
const fs = require("node:fs"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createAnalysisPort } = require("../randomizer/game/ai/analysis-port");
const { searchDecision } = require("../randomizer/game/ai/decision-search");
const { createStateValueEvaluator } = require("../randomizer/game/ai/state-value");
const sha = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const output = "reports/ai-foundation-20261023/pre-main-data-complete-window-v1.json";
assert(!fs.existsSync(output), "Reuse existing checkpoint");
const fixturePath = "adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json", f = JSON.parse(fs.readFileSync(fixturePath));
const report = { scope: "Original case008, final runtime with only preMainDataPlanSpec off/on; same sequential process with warmup, no isolated time ratio or full-game claim",
  fixturePath, fixtureSha256: sha(fixturePath), budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 }, rows: [] };
for (const enabled of [false, true]) {
  const seed = f.source.seed, k = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (s, v) => buildRuleObservation(s, seed, v?.playerId) });
  k.newGame({ seed }); const comp = k.composition; assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
  const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId: f.seatId, maxCacheEntries: 0 });
  try {
    const root = port.openRoot(), evaluate = createStateValueEvaluator(f.seatId), at = performance.now();
    const result = searchDecision({ port: enabled ? port : { ...port, preMainDataPlanSpec: () => null }, root, evaluate,
      budget: report.budget, modelKey: evaluate.modelKey, planReuse: true, resourceDominance: true, moneyCapacityDominance: true,
      cardTradePruning: true, postMainPruning: true, openingPruning: true, cardChoiceEquivalence: true });
    const milliseconds = performance.now() - at; assert.deepEqual(comp.lifecycle.save().envelope, before);
    const rawPath = `adhoc/ai-decision-corpus-20261023-v1/pre-main-data-${enabled ? "enabled" : "disabled"}-v1.raw.json`;
    fs.writeFileSync(rawPath, JSON.stringify(result) + "\n");
    report.rows.push({ enabled, complete: result.complete, actionId: result.actionId, value: result.value,
      distance: result.lines[0].distance, diagnostics: result.diagnostics, port: port.getDiagnostics(), milliseconds,
      rawPath, rawSha256: sha(rawPath), rootUnchanged: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report.rows.at(-1)));
  } finally { port.close(); comp.dispose(); }
}
report.allComplete = report.rows.every(row => row.complete);
report.resultsMatch = report.allComplete && ["actionId", "value", "distance"].every(key => report.rows[0][key] === report.rows[1][key]);
report.sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(p => p.includes("/randomizer/"))
  .map(p => [p.slice(process.cwd().length + 1), sha(p)]));
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); assert(report.allComplete && report.resultsMatch);

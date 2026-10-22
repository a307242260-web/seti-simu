"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createAnalysisPort } = require("../randomizer/game/ai/analysis-port");
const { searchDecision } = require("../randomizer/game/ai/decision-search");
const { createStateValueEvaluator } = require("../randomizer/game/ai/state-value");
const output = "reports/ai-foundation-20261023/company-trade-pass-offer-comparison-v1.json";
assert(!fs.existsSync(output), "Existing comparison; reuse checkpoint");
const fixturePath = "adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json";
const f = JSON.parse(fs.readFileSync(fixturePath)), seed = f.source.seed;
const sha = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const report = { scope: "three complete decision windows in one sequential Node process, corrected hidden PASS offer; no whole games or fixed-budget acceptance",
  timingScope: "rootAndSearchMilliseconds includes openRoot, search, root equality assertion and raw evidence serialization/write; diagnostics.milliseconds is search only; same-process warmup prevents isolated speed-ratio claims",
  budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 }, fixturePath, fixtureSha256: sha(fixturePath), rows: [] };
for (const [name, enabled, swapped] of [["reference", false, false], ["optimized", true, false], ["hidden-swap", true, true]]) {
  const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
  kernel.newGame({ seed }); const comp = kernel.composition;
  const runtimeRulesetVersion = JSON.parse(comp.lifecycle.save().envelope.committedState).meta.rulesetVersion;
  const state = JSON.parse(f.compositionEnvelope.committedState);
  if (swapped) [state.cards.passReservePiles[1], state.cards.passReservePiles[2]] = [state.cards.passReservePiles[2], state.cards.passReservePiles[1]];
  assert(comp.lifecycle.restore({ ...f.compositionEnvelope, committedState: JSON.stringify(state) }).ok);
  const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId: f.seatId, maxCacheEntries: 0 });
  const at = performance.now(), root = port.openRoot();
  const result = searchDecision({ port, root, evaluate: createStateValueEvaluator(f.seatId), budget: report.budget,
    resourceDominance: true, moneyCapacityDominance: true, postMainPruning: true, openingPruning: true,
    cardTradePruning: enabled, cardChoiceEquivalence: enabled });
  assert(result.complete, result.stopReason); assert.deepEqual(comp.lifecycle.save().envelope, before);
  const rawPath = `adhoc/ai-decision-corpus-20261023-v1/company-trade-pass-offer-${name}-v1.raw.json`;
  fs.writeFileSync(rawPath, JSON.stringify(result) + "\n");
  const row = { name, enabled, swapped, runtimeRulesetVersion, fixtureRulesetVersion: state.meta.rulesetVersion,
    complete: result.complete, actionId: result.actionId, value: result.value, valueMeaning: "nonterminal state value, not game score",
    distance: result.lines[0].distance, rootAndSearchMilliseconds: performance.now() - at, diagnostics: result.diagnostics,
    port: port.getDiagnostics(), hiddenPassOffers: result.lines.filter(line => line.boundary === "hidden_pass_reserve_offer").length,
    rawPath, rawSha256: sha(rawPath), rootUnchanged: true };
  report.rows.push(row); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ name, inputs: row.diagnostics.transitions, actionId: row.actionId, value: row.value,
    distance: row.distance, hiddenPassOffers: row.hiddenPassOffers, milliseconds: row.rootAndSearchMilliseconds }));
  port.close(); comp.dispose();
}
const [reference, optimized, swapped] = report.rows;
for (const row of [optimized, swapped]) for (const key of ["actionId", "value", "distance"]) assert.equal(row[key], reference[key]);
assert.equal(optimized.diagnostics.transitions, swapped.diagnostics.transitions);
assert(optimized.diagnostics.transitions < reference.diagnostics.transitions);
report.sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(p => p.includes("/randomizer/"))
  .map(p => [p.slice(process.cwd().length + 1), sha(p)]));
report.status = "passed"; fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");

"use strict";
const fs = require("node:fs"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createAnalysisPort } = require("../randomizer/game/ai/analysis-port");
const { searchDecision } = require("../randomizer/game/ai/decision-search");
const { createStateValueEvaluator } = require("../randomizer/game/ai/state-value");
const output = "reports/ai-foundation-20261023/late-semantic-case062-v8.json";
if (fs.existsSync(output)) throw new Error("Existing profile; reuse checkpoint");
const fixturePath = "adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json";
const fixture = JSON.parse(fs.readFileSync(fixturePath)), seed = fixture.source.seed;
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition; assert(comp.lifecycle.restore(fixture.compositionEnvelope).ok);
const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId: fixture.seatId, maxCacheEntries: 0 });
const calls = {}, details = {}, root = port.openRoot(), costs = [];
const instrumented = { ...port, expand(node, actionId) {
  const action = node.legalActions.find(a => a.actionId === actionId);
  const key = `${node.status}/${action.family}/${action.target?.kind || ""}`;
  const at = performance.now(), child = port.expand(node, actionId), ms = performance.now() - at;
  calls[key] = (calls[key] || 0) + 1;
  const detailKey = `${key}/${action.target?.rewardKind || action.target?.kind || ""}/${action.payload?.kind || ""}`;
  const detail = details[detailKey] ||= { count: 0, milliseconds: 0, target: action.target, payload: action.payload, childStatuses: {} };
  detail.count += 1; detail.milliseconds += ms; detail.childStatuses[child.status] = (detail.childStatuses[child.status] || 0) + 1;
  costs.push({ key, milliseconds: ms }); return child;
} };
const at = performance.now();
const result = searchDecision({ port: instrumented, root, evaluate: createStateValueEvaluator(fixture.seatId),
  resourceDominance: true, moneyCapacityDominance: true, cardTradePruning: true, postMainPruning: true,
  openingPruning: true, cardChoiceEquivalence: true,
  budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 } });
const milliseconds = performance.now() - at;
assert.deepEqual(comp.lifecycle.save().envelope, before);
const rawPath = "adhoc/ai-decision-corpus-20261023-v1/late-semantic-case062-v8.raw.json";
fs.writeFileSync(rawPath, JSON.stringify(result) + "\n");
const sha = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const report = { scope: "case062 with early formal witness with deferred FIFO scheduling at existing 4096/15s diagnostic budget; not fixed256 or game acceptance", fixturePath,
  fixtureSha256: sha(fixturePath), complete: result.complete, stopReason: result.stopReason, unresolvedCount: result.unresolved.length, rootUnchanged: true, milliseconds, diagnostics: result.diagnostics,
  port: port.getDiagnostics(), calls, details, costs: costs.sort((a, b) => b.milliseconds - a.milliseconds).slice(0, 10),
  roots: result.roots.map(row => ({ ...row, family: root.legalActions.find(a => a.actionId === row.actionId).family })),
  rawPath, rawSha256: sha(rawPath), sourceHashes: Object.fromEntries(Object.keys(require.cache)
    .filter(p => p.includes("/randomizer/")).map(p => [p.slice(process.cwd().length + 1), sha(p)])) };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ complete: result.complete, milliseconds, transitions: result.diagnostics.transitions, calls }));
port.close(); comp.dispose();

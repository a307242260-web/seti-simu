"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createAnalysisPort } = require("../randomizer/game/ai/analysis-port");
const output = "reports/ai-foundation-20261023/lazy-kernel-projection-parity-v1.json";
if (fs.existsSync(output)) throw new Error("Existing parity checkpoint; reuse it");
const fixtures = JSON.parse(fs.readFileSync("reports/ai-foundation-20261023/decision-corpus-summary-v1.json")).cases;
const report = { scope: "current runtime eager vs lazy returned projection, every root action and first two next inputs at eight archived checkpoints; no score or speed experiment", rows: [] };
for (const item of fixtures) {
  const fixture = JSON.parse(fs.readFileSync(item.path)), seed = fixture.source.seed;
  const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
  kernel.newGame({ seed });
  const comp = kernel.composition;
  assert(comp.lifecycle.restore(fixture.compositionEnvelope).ok);
  const before = comp.lifecycle.save().envelope;
  function createPort(eager) {
    let saved;
    const counterfactualPort = { ...comp.counterfactualPort, createFork(...args) {
      const fork = comp.counterfactualPort.createFork(...args), source = fork.composition || fork;
      const inputPort = { ...source.inputPort };
      for (const name of ["submitAction", "submitQuickAction", "submitDecision"]) {
        inputPort[name] = (input, options) => source.inputPort[name](input, { ...options, skipProjection: !eager });
      }
      const lifecycle = { ...source.lifecycle, save(...saveArgs) {
        const result = source.lifecycle.save(...saveArgs); saved = result.envelope; return result;
      } };
      return { ...fork, composition: { ...source, inputPort, lifecycle } };
    } };
    return { port: createAnalysisPort({ composition: { ...comp, counterfactualPort }, seatId: fixture.seatId, maxCacheEntries: 0 }),
      saved: () => saved };
  }
  const lazy = createPort(false), eager = createPort(true);
  let inputs = 0, informationLeaves = 0;
  try {
    const roots = [lazy.port.openRoot(), eager.port.openRoot()];
    function compare(a, b) {
      assert.deepEqual(lazy.saved(), eager.saved(), "正式工作状态、RNG、queue与journal必须相同");
      assert.deepEqual(a, b, "可见观察、屏障及合法集必须相同");
      if (a.status === "information-barrier") informationLeaves += 1;
    }
    compare(...roots);
    for (const action of roots[0].legalActions) {
      const children = [lazy.port.expand(roots[0], action.actionId), eager.port.expand(roots[1], action.actionId)];
      inputs += 1; compare(...children);
      for (const next of children[0].legalActions.slice(0, 2)) {
        const leaves = [lazy.port.expand(children[0], next.actionId), eager.port.expand(children[1], next.actionId)];
        inputs += 1; compare(...leaves);
      }
    }
    assert.deepEqual(comp.lifecycle.save().envelope, before);
    report.rows.push({ caseId: item.id, fixture: item.path, fixtureSha256: item.sha256, inputsPerMode: inputs,
      informationLeaves, rootActions: roots[0].legalActions.length, completeEnvelopeAndVisibleParity: true, rootUnchanged: true });
  } finally { lazy.port.close(); eager.port.close(); comp.dispose(); }
}
report.sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(p => p.includes("/randomizer/")).sort().map(p =>
  [p.slice(process.cwd().length + 1), crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]));
report.status = "passed";
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output, cases: report.rows.length, inputsPerMode: report.rows.reduce((n, r) => n + r.inputsPerMode, 0), status: report.status }));

"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const effects = require("../cards/effects");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json")));
const seed = fixture.source.seed, seatId = fixture.seatId;
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition, evaluate = createStateValueEvaluator(seatId), rows = [];
for (const cardId of ["b_114.webp", "dlc_9.png"]) {
  assert(comp.lifecycle.restore(fixture.compositionEnvelope).ok);
  const state = JSON.parse(fixture.compositionEnvelope.committedState), player = state.players.players.find(p => p.id === seatId);
  const id = player.hand.find(card => card.cardId === cardId).id;
  assert(comp.inputPort.submitAction(comp.inputPort.enumerateActions({}).find(a => a.family === "play_card"
    && a.target?.cardInstanceId === id)).ok);
  for (let guard = 0; guard < 24 && comp.inspect().phase === "awaiting_input"; guard += 1) {
    const d = comp.inspect().session.decision;
    assert(comp.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
      ownerId: d.ownerId, choice: d.choices[0] }).ok);
  }
  assert.notEqual(comp.inspect().phase, "awaiting_input");
  const before = comp.lifecycle.save().envelope, actual = JSON.parse(before.committedState);
  const owner = actual.players.players.find(p => p.id === seatId), reserved = owner.reservedCards.find(card => card.id === id);
  assert(reserved && effects.getCardModel(reserved).tasks.every(task => !effects.taskConditionMet(task, owner, { data: actual.data })));
  function run(enabled) {
    const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 });
    try {
      const root = port.openRoot(), proof = port.postMainPlanSpec(root);
      assert(proof, "不再产生扇区胜利的主行动后窗口不能因未达成扇区任务展开全部负收益准备");
      const result = searchDecision({ port, root, evaluate, postMainPruning: enabled,
        budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 } });
      assert(result.complete, result.stopReason);
      assert.deepEqual(comp.lifecycle.save().envelope, before);
      return result;
    } finally { port.close(); }
  }
  const raw = run(false), reduced = run(true);
  assert.equal(reduced.actionId, raw.actionId); assert.equal(reduced.value, raw.value);
  assert.equal(reduced.lines[0].distance, raw.lines[0].distance);
  assert(reduced.diagnostics.transitions < raw.diagnostics.transitions);
  const ready = structuredClone(actual);
  ready.data.sectorSettlements.winsByPlayerId[seatId] = [
    { nebulaId: "sector-2-a", sectorId: "sector-2-a" },
    { nebulaId: "sector-1-a", sectorId: "sector-1-a" },
    { nebulaId: "sector-3-a", sectorId: "sector-3-a" },
  ];
  assert(effects.getCardModel(reserved).tasks.some(task => effects.taskConditionMet(task,
    ready.players.players.find(p => p.id === seatId), { data: ready.data })), "反例确实已经满足任务条件");
  const restored = comp.lifecycle.restore({ ...before, committedState: JSON.stringify(ready) });
  assert(restored.ok, JSON.stringify(restored));
  const port = createAnalysisPort({ composition: comp, seatId });
  const root = port.openRoot();
  assert.equal(port.postMainPlanSpec(root), null, "已经可完成的任务必须保留实际选择，不能以不活动任务省略");
  port.close();
  rows.push({ cardId, rawInputs: raw.diagnostics.transitions, prunedInputs: reduced.diagnostics.transitions, value: reduced.value });
}
comp.dispose();
console.log(JSON.stringify({ inertSectorTasks: "passed", rows }));

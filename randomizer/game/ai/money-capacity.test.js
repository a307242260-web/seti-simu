"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createAnalysisPort } = require("./analysis-port");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");
const data = require("../data");

const initial = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json"))).coreState.compositionEnvelope;
const seed = "opening-capacity-proof-v1", state = JSON.parse(initial.committedState);
const seatId = state.turn.currentPlayerId, evaluate = createStateValueEvaluator(seatId);
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
function open(source = state, cache = 0) {
  const envelope = { ...structuredClone(initial), committedState: JSON.stringify(source) };
  const restored = comp.lifecycle.restore(envelope);
  assert.equal(restored.ok, true, JSON.stringify(restored));
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
  return { port, root: port.openRoot(), envelope };
}
const own = source => source.players.players.find(player => player.id === seatId);
const first = open();
const facet = first.port.openingMoneyCapacity(first.root);
assert(facet);
assert.deepEqual(facet.moneyCapacity, { credits: 2, energy: 2 }, "正式扫描是1钱2电，不能采用旧草案的1电界");
const convert = first.root.legalActions.find(action => action.target?.tradeId === "credits-for-energy");
const poorer = first.port.expand(first.root, convert.actionId);
const lower = first.port.openingMoneyCapacity(poorer);
assert.equal(facet.group, lower.group);
assert.deepEqual([facet.credits, facet.energy, lower.credits, lower.energy], [4, 2, 2, 3]);
assert(facet.energy < lower.energy, "实际跨钱包关系不能只是旧逐坐标支配的重测");
assert.equal(facet.credits + facet.energy - lower.credits - lower.energy, 1);
assert.throws(() => searchDecision({ ...first, evaluate: createStateValueEvaluator(seatId, { weights: { energy: 3 } }),
  moneyCapacityDominance: true }), /MONEY_CAPACITY_MODEL_INVALID/);
assert.throws(() => searchDecision({ ...first, evaluate: () => 1, moneyCapacityDominance: true }), /MONEY_CAPACITY_MODEL_INVALID/);
assert.throws(() => searchDecision({ ...first, evaluate: createStateValueEvaluator("player-blue"),
  moneyCapacityDominance: true }), /MONEY_CAPACITY_MODEL_INVALID/);
assert.deepEqual(comp.lifecycle.save().envelope, first.envelope);
first.port.close();
assert.throws(() => first.port.openingMoneyCapacity(first.root), /ANALYSIS_NODE_INVALID/);

function rejected(change, label) {
  const source = structuredClone(state);
  change(source, own(source));
  const { port, root } = open(source);
  assert.equal(port.openingMoneyCapacity(root), null, label);
  port.close();
}
rejected((s, p) => { p.industryBorrowedTechTileId = "purple4"; }, "临时科技可追加扫描内的付费发射");
rejected((s, p) => { p.hand[0].price = 3; }, "卡牌实际费用超过生产性钱包界");
rejected(s => { s.cards.drawPileCardIds = []; }, "空牌堆不再保证公共补牌是信息边界");
rejected(s => { s.cards.discardPile.push(s.cards.publicCards.pop()); }, "公共牌区不完整时不能假定扫描一定补牌");
rejected((s, p) => { p.resources.score = 25; }, "待放金标的结束链不在本证明范围");
rejected((s, p) => { p.blueBonusResources.credits = 1; }, "蓝色钱电归因另有精确状态契约");
rejected((s, p) => { assert(data.gainData(p, { root: s }).ok); }, "数据容量增加可解锁分析或强制收入链");
rejected((s, p) => {
  for (const token of s.data.nebulae["sector-1-a"].tokens.slice(0, 3)) {
    token.replacedByPlayerId = p.id; token.replacedByPlayerColor = p.color;
    token.replacementOrder = s.meta.sequences.nebulaReplacement++;
  }
}, "DLC22可扫描时不套用零效果牌的后续费用证明");
rejected((s, p) => {
  for (let i = 0; i < 3; i += 1) assert(data.addSectorExtraMark(s.data, "sector-1-a", p, { root: s }).ok);
}, "额外信号也计入DLC22条件，不能只数普通格子");

const results = [];
for (const cardId of [null, "dlc_27.png", "b_44.webp", "b_23.webp", "dlc_22.png", "b_48.webp"]) {
  const source = structuredClone(state), player = own(source);
  source.cards.discardPile.push(...player.hand.filter(card => card.cardId !== cardId));
  player.hand = player.hand.filter(card => card.cardId === cardId);
  player.resources.publicity = 0;
  player.resources.handSize = player.hand.length;
  function run(mode, cache = 0) {
    const { port, root, envelope } = open(source, cache);
    assert(port.openingMoneyCapacity(root));
    const combined = mode === "combined";
    const result = searchDecision({ port, root, evaluate, moneyCapacityDominance: mode !== "raw",
      resourceDominance: combined, cardTradePruning: combined, postMainPruning: combined, cardChoiceEquivalence: combined,
      budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 } });
    assert.equal(result.complete, true, `${cardId}: ${result.stopReason}`);
    assert.equal(result.unresolved.length, 0);
    assert.deepEqual(comp.lifecycle.save().envelope, envelope);
    port.close();
    return result;
  }
  const raw = run("raw"), capacityOnly = run("capacity"), pruned = run("combined"), cached = run("combined", 256);
  for (const actual of [capacityOnly, pruned, cached]) {
    assert.equal(actual.value, raw.value, cardId);
    assert.equal(actual.actionId, raw.actionId, cardId);
    assert.equal(actual.lines[0].distance, raw.lines[0].distance, cardId);
    assert(actual.diagnostics.moneyCapacityPrunes > 0, cardId);
    assert(actual.diagnostics.transitions < raw.diagnostics.transitions, cardId);
    for (const line of actual.lines.filter(line => line.prunedBy?.proof === facet.capacityProof)) {
      assert.equal(line.value, null, "不把代表节点的值复制成被省略节点的实际结果");
      assert(line.prunedBy.gap.credits + line.prunedBy.gap.energy > 0);
    }
  }
  results.push({ cardId, value: raw.value, raw: raw.diagnostics.transitions, capacityOnly: capacityOnly.diagnostics.transitions, pruned: pruned.diagnostics.transitions,
    capacityPrunes: pruned.diagnostics.moneyCapacityPrunes });
}
comp.dispose();
console.log(JSON.stringify({ openingMoneyCapacity: "passed", results }));

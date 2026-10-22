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

const checkpoint = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json")));
const seed = "analysis-port-isolation-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId) });
kernel.newGame({ seed });
const comp = kernel.composition;
const initial = checkpoint.coreState.compositionEnvelope;
assert.equal(comp.lifecycle.restore(initial).ok, true);
let state = JSON.parse(initial.committedState);
const seatId = state.turn.currentPlayerId;
const player = state.players.players.find(player => player.id === seatId);
const evaluate = createStateValueEvaluator(seatId);

function decideFirst() {
  const d = comp.inspect().session.decision;
  assert.equal(comp.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
    ownerId: d.ownerId, choice: d.choices[0] }).ok, true);
}
function legal() { return comp.inputPort.enumerateActions({}); }
// 真实前缀：打出零资源条件牌（本例无探测器，效果不授予资源），再两次弃两张换信用。
const play = legal().find(action => action.family === "play_card" && action.target?.cardInstanceId === player.hand[0].id);
assert(play);
assert.equal(comp.inputPort.submitAction(play).ok, true);
for (let turn = 0; turn < 2; turn += 1) {
  const trade = legal().find(action => action.target?.tradeId === "cards-for-credit");
  assert(trade);
  assert.equal(comp.inputPort.submitQuickAction(trade).ok, true);
  for (let count = 0; count < 2; count += 1) {
    const d = comp.inspect().session.decision;
    const choice = d.choices.find(action => !action.presentation?.selected && !action.target?.confirm);
    assert(choice);
    assert.equal(comp.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
      ownerId: d.ownerId, choice }).ok, true);
  }
  const d = comp.inspect().session.decision;
  const confirm = d.choices.find(action => action.target?.confirm);
  assert.equal(comp.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
    ownerId: d.ownerId, choice: confirm }).ok, true);
}
assert.notEqual(comp.inspect().phase, "awaiting_input");
const post = comp.lifecycle.save().envelope;
state = JSON.parse(post.committedState);
assert.equal(state.players.players.find(player => player.id === seatId).hand.length, 0);

function run(enabled) {
  const port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: 0 });
  const root = port.openRoot();
  const resources = port.postMainResourceOrder(root);
  assert(resources);
  assert.deepEqual(Object.keys(resources).sort(), ["credits", "energy", "group", "proof"],
    "比较接口只提供钱电与不透明组，蓝槽留存仍在完整组身份中要求相同");
  const result = searchDecision({ port, root, evaluate, resourceDominance: enabled,
    budget: { transitions: 2048, nodes: 2049, frontier: 2048, milliseconds: 6000 } });
  port.close();
  assert.equal(result.complete, true);
  assert.deepEqual(comp.lifecycle.save().envelope, post);
  return result;
}
const raw = run(false), pruned = run(true);
assert.equal(pruned.value, raw.value);
assert.equal(pruned.actionId, raw.actionId);
assert(pruned.diagnostics.dominancePrunes > 0);
assert(pruned.diagnostics.transitions < raw.diagnostics.transitions);
assert.equal(pruned.unresolved.length, 0);

for (const retainedCredits of [0, 3]) {
  const attributed = structuredClone(post);
  const source = JSON.parse(attributed.committedState);
  source.players.players.find(player => player.id === seatId).blueBonusResources.credits = retainedCredits;
  attributed.committedState = JSON.stringify(source);
  assert.equal(comp.lifecycle.restore(attributed).ok, true);
  const port = createAnalysisPort({ composition: comp, seatId });
  const root = port.openRoot();
  const trade = root.legalActions.find(action => action.target?.tradeId === "credits-for-energy");
  const child = port.expand(root, trade.actionId);
  const secondTrade = child.legalActions.find(action => action.target?.tradeId === "credits-for-energy");
  const after = port.expand(child, secondTrade.actionId);
  const beforeOrder = port.postMainResourceOrder(child), afterOrder = port.postMainResourceOrder(after);
  assert(beforeOrder && afterOrder);
  assert.equal(beforeOrder.group === afterOrder.group, retainedCredits === 0,
    "正式花费改变蓝槽留存时必须分组；归因不变的纯钱电变化才允许比较");
  port.close();
  assert.deepEqual(comp.lifecycle.save().envelope, attributed);
}

function facet(envelope) {
  assert.equal(comp.lifecycle.restore(envelope).ok, true);
  const port = createAnalysisPort({ composition: comp, seatId });
  const descriptor = port.postMainResourceOrder(port.openRoot());
  port.close();
  return descriptor;
}
assert.equal(facet(initial), null, "主行动前的零资源条件牌仍须保留，不使用本证明");
const sameOwner = structuredClone(post);
let changed = JSON.parse(sameOwner.committedState);
changed.turn.passedPlayerIds = changed.turn.activePlayerIds.filter(id => id !== seatId);
sameOwner.committedState = JSON.stringify(changed);
assert.equal(facet(sameOwner), null, "下一回合仍由本席行动时可能重新打牌，不能支配删除");
const bonus = structuredClone(post);
changed = JSON.parse(bonus.committedState);
changed.turn.cardTurnEventBonuses = [{ id: "resource-sensitive-test", playerId: seatId, eventType: "visitPlanet", rewards: [] }];
bonus.committedState = JSON.stringify(changed);
assert.equal(facet(bonus), null, "有活动事件奖励时不使用受限证明");
assert.equal(comp.lifecycle.restore(initial).ok, true);
const reserved = legal().find(action => action.family === "play_card" && action.target?.cardInstanceId === player.hand[1].id);
assert.equal(comp.inputPort.submitAction(reserved).ok, true);
for (let step = 0; step < 8 && comp.inspect().phase === "awaiting_input"; step += 1) decideFirst();
assert.notEqual(comp.inspect().phase, "awaiting_input");
assert.equal(facet(comp.lifecycle.save().envelope), null, "保留区可能存在零钱电任务或触发器，不能套用该证明");
comp.dispose();
console.log(JSON.stringify({ resourceDominance: "passed", rawInputs: raw.diagnostics.transitions,
  prunedInputs: pruned.diagnostics.transitions, proofPrunes: pruned.diagnostics.dominancePrunes }));

"use strict";

const assert = require("node:assert/strict");
const players = require("../players");
const observationContract = require("../../app/simulation-contract");
const outcome = require("./outcome-model");
const evaluator = require("./expected-score-evaluator");
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function player(tileId = "blue2") {
  const actor = players.createPlayer({ id: "blue-value-seat", color: "white",
    resources: { credits: 0, energy: 0, score: 0, availableData: 1 },
    techState: { ownedTiles: { [tileId]: true }, blueBoardSlots: { [tileId]: 1 } },
  });
  actor.dataState = { placedTokens: [{ placementKind: "computer", placementSlot: 1 }] };
  return actor;
}
function observe(actor) {
  return outcome.createDecisionObservation({
    publicState: { roundNumber: 1, board: {}, players: [observationContract.sanitizePublicPlayer(actor)] },
    selfState: observationContract.sanitizeSelfPlayer(actor),
  }, { seatId: actor.id, stateVersion: 1, decisionVersion: 1 });
}
const facts = (obs) => outcome.createStrategicFacts(obs, obs.viewer.seatId);
const delta = (root, leaf) => evaluator.evaluateStrategicFactsBreakdown(facts(root), facts(leaf));
function assertSourceNeutral(actor) {
  const ordinary = structuredClone(actor);
  ordinary.blueBonusResources = { credits: 0, energy: 0 };
  for (const card of ordinary.hand) delete card.blueBonusOwnerId;
  const tagged = observe(actor);
  const untagged = observe(ordinary);
  assert.deepEqual(evaluator.evaluateStateValue(tagged, actor.id),
    evaluator.evaluateStateValue(untagged, actor.id));
  assert.deepEqual(evaluator.secondaryAgentCompletionFacts(tagged, actor.id),
    evaluator.secondaryAgentCompletionFacts(untagged, actor.id));
  close(delta(tagged, untagged).total, 0);
}

for (const [tileId, resource] of [["blue1", "credits"], ["blue2", "energy"]]) {
  const actor = player(tileId);
  const root = observe(actor);
  players.gainResources(actor, { [resource]: 1 }, "blueTechScore");
  actor.resources.availableData = 0;
  actor.dataState.placedTokens.push({ placementKind: "blueBonus", blueSlot: 1 });
  const rewarded = observe(actor);
  assert.equal(actor.blueBonusResources[resource], 1);
  close(delta(root, rewarded).total, 0, "来源资源本身不冒充已兑现收益");
  assertSourceNeutral(actor);
  players.gainResources(actor, { [resource]: 2 }, "cardEffectScore");
  close(delta(root, observe(actor)).total, delta(root, rewarded).total);
  const beforeFailure = structuredClone(actor);
  assert.equal(players.spendResources(actor, { [resource]: 99 }).ok, false);
  assert.deepEqual(actor, beforeFailure);
  actor.dataState.placedTokens = [];
  assert.equal(actor.blueBonusResources[resource], 1, "分析清空占用不清除奖励留存");
  assertSourceNeutral(actor);
  assert.equal(players.spendResources(actor, { [resource]: 1 }).ok, true);
  assert.equal(actor.blueBonusResources[resource], 0);
  players.gainResources(actor, { [resource]: 2 });
  assert.equal(actor.blueBonusResources[resource], 0, "其他来源收入不能复活已消费的来源留存");
  assertSourceNeutral(actor);
  const restored = players.createPlayer(actor);
  assert.deepEqual(restored.blueBonusResources, actor.blueBonusResources);
}

const actor = player();
const oneData = evaluator.evaluateStateValue(observe(actor), actor.id).components.liquidValue;
actor.resources.availableData = 6;
close(evaluator.evaluateStateValue(observe(actor), actor.id).components.liquidValue, oneData);
actor.dataState.placedTokens.push({ placementKind: "blueBonus", blueSlot: 1 });
close(evaluator.evaluateStateValue(observe(actor), actor.id).components.liquidValue, 0);
const blue4 = player("blue4");
close(evaluator.evaluateStateValue(observe(blue4), blue4.id).components.liquidValue, 0);

const blue3 = player("blue3");
blue3.resources.availableData = 0;
const beforeCard = observe(blue3);
blue3.hand.push({ id: "blue-awarded-card", cardId: "b_117.webp", blueBonusOwnerId: blue3.id });
blue3.resources.handSize = blue3.hand.length;
const holding = observe(blue3);
close(delta(beforeCard, holding).total, 0);
assertSourceNeutral(blue3);
const heldCard = blue3.hand.pop();
blue3.resources.handSize = blue3.hand.length;
close(delta(holding, observe(blue3)).total, 0);
blue3.hand.push(heldCard);
blue3.resources.handSize = blue3.hand.length;
close(delta(beforeCard, observe(blue3)).total, 0);
assertSourceNeutral(blue3);
assert.deepEqual(players.createPlayer(blue3).hand[0], heldCard);
assert.throws(() => players.createPlayer({ resources: { energy: 0 }, blueBonusResources: { energy: 1 } }), /不超过/);

// 完成态抽象不能抹去估值依赖；比较器的路线保留另由反事实行为测试验证。
const completionActor = player();
players.gainResources(completionActor, { energy: 2 });
const completionOf = () => evaluator.secondaryAgentCompletionFacts(observe(completionActor), completionActor.id);
const originalCompletion = completionOf();
completionActor.blueBonusResources.energy = 1;
const sourceCompletion = completionOf();
assert.deepEqual(sourceCompletion.resources, originalCompletion.resources);
assert.deepEqual(sourceCompletion.valuationContext, originalCompletion.valuationContext);
completionActor.blueBonusResources.energy = 0;
completionActor.dataState.placedTokens.push({ placementKind: "blueBonus", blueSlot: 1 });
assert.notDeepEqual(completionOf().valuationContext, originalCompletion.valuationContext);
const orderingObservation = structuredClone(observe(completionActor));
orderingObservation.publicState.players[0].dataProgress.blueSlots.push({
  tileId: "blue1", slot: 2, occupied: false, unlocked: true,
});
const orderedCompletion = evaluator.secondaryAgentCompletionFacts(orderingObservation, completionActor.id);
orderingObservation.publicState.players[0].dataProgress.blueSlots.reverse();
assert.deepEqual(evaluator.secondaryAgentCompletionFacts(orderingObservation, completionActor.id), orderedCompletion);
const heldCompletion = evaluator.secondaryAgentCompletionFacts(observe(blue3), blue3.id);
blue3.hand[0].id = "another-blue-card-instance";
assert.notDeepEqual(evaluator.secondaryAgentCompletionFacts(observe(blue3), blue3.id).valuationContext,
  heldCompletion.valuationContext);
console.log("blue bonus value tests passed");

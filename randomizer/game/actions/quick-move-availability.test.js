"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom } = require("../random");
const rocketAbility = require("../abilities/rocket");

const seed = "quick-move-blocked-route-v1";
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4 });
kernel.newGame({ seed });
const comp = kernel.composition;
const envelope = JSON.parse(fs.readFileSync(path.resolve(__dirname,
  "../../../reports/ai-foundation-20261022/analysis-root-input-v2.json"))).coreState.compositionEnvelope;
const state = JSON.parse(envelope.committedState), seatId = state.turn.currentPlayerId;
const owner = state.players.players.find(player => player.id === seatId);
state.cards.discardPile.push(...owner.hand);
owner.hand = [];
owner.resources = { ...owner.resources, credits: 4, energy: 2, publicity: 0, availableData: 0, handSize: 0 };
owner.dataState = { poolTokens: [], placedTokens: [], discardedCount: 0 };
assert.equal(comp.lifecycle.restore({ ...envelope, committedState: JSON.stringify(state) }).ok, true);
function submit(predicate) {
  const inspection = comp.inspect();
  const decision = inspection.session?.decision;
  const legal = inspection.phase === "awaiting_input" ? decision.choices : comp.inputPort.enumerateActions({});
  const action = legal.find(predicate);
  assert(action);
  const result = decision ? comp.inputPort.submitDecision({ decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: action })
    : action.phase === "quick" ? comp.inputPort.submitQuickAction(action) : comp.inputPort.submitAction(action);
  assert.equal(result.ok, true, JSON.stringify(result.failure || result.code));
  return action;
}
submit(action => action.family === "launch");
const available = comp.inputPort.enumerateActions({}).find(action => action.target?.tradeId === "energy-for-move");
assert(available, "正常位置有一步可走时仍应提供快速移动");
for (let i = 0; i < 2; i += 1) {
  submit(action => action.family === "move" && action.target?.deltaX === 0 && action.target?.deltaY === 1);
  submit(action => action.family === "choose_payment" && action.target?.choiceId === "energy");
}
submit(action => action.target?.tradeId === "credits-for-energy");
const before = comp.lifecycle.save().envelope;
const blocked = JSON.parse(before.committedState);
const player = blocked.players.players.find(player => player.id === seatId);
assert.equal(player.resources.energy, 1);
assert.equal(blocked.pieces.rockets.filter(rocket => rocket.playerId === seatId).length, 1);
assert.equal(rocketAbility.listPlayerMoveChoices(blocked, player, { maxPoints: 1 }).length, 0,
  "真实探测器位于全部方向均需超过1移动点的位置");
assert(!comp.inputPort.enumerateActions({}).some(action => action.target?.tradeId === "energy-for-move"),
  "有探测器但无一步可达方向时不能提供必然产生空Decision的快速移动");
const refused = comp.inputPort.submitQuickAction({ ...available,
  stateVersion: blocked.meta.stateVersion, decisionVersion: blocked.match.decisionVersion });
assert.equal(refused.ok, false);
assert.deepEqual(comp.lifecycle.save().envelope, before, "拒绝不扣能量、不创建Session，也不改变RNG");
comp.dispose();
console.log("quick move requires an affordable one-point direction; blocked routes leave root unchanged");

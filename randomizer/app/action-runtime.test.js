"use strict";

const assert = require("node:assert/strict");
const actionRuntime = require("./action-runtime");

assert.equal(actionRuntime.stripAssetExtension("星际矿业.png"), "星际矿业");
const source = [1, 2, 3];
const shuffled = actionRuntime.shuffleList(source, () => 0);
assert.deepEqual(source, [1, 2, 3]);
assert.deepEqual([...shuffled].sort(), source);

{
  const calls = [];
  let flow = null;
  const initialIncome = actionRuntime.createInitialIncomeFlow({
    abilities: {
      chain: {
        startAbilityChain(type, label, effects) {
          calls.push(["chain", type, label]);
          return { effects };
        },
      },
    },
    setActionEffectFlow(_root, next) { flow = next; },
    getActionEffectFlow: () => flow,
    assignEffectFlowOwner: (_flow, playerId) => calls.push(["owner", playerId]),
    setActionEffectFlowActive: (active) => calls.push(["active", active]),
    renderDebugPlayerSwitch: () => calls.push("debug"),
    renderPlayerStats: () => calls.push("stats"),
    renderPlayerHand: () => calls.push("hand"),
    activateNextActionEffect: () => calls.push("activate"),
  });
  const root = {
    playerState: { currentPlayerId: "p1", players: [{ id: "p1" }, { id: "p2" }] },
    rocketState: {},
  };
  assert.equal(initialIncome.startInitialIncomeEffectFlow(root, [{ playerId: "p2", label: "公司", count: 2 }]), true);
  assert.equal(flow.actionType, "initialIncome");
  assert.equal(flow.effects.length, 2);
  assert.equal(flow.effects[0].undoable, false);
  assert.equal(root.playerState.currentPlayerId, "p2");
  assert.equal(root.rocketState.statusNote, "初始收入增加：请依次点击收入效果");
  assert.deepEqual(calls.slice(-4), ["debug", "stats", "hand", "activate"]);
  assert.equal(initialIncome.startInitialIncomeEffectFlow(root, [{ playerId: null, count: 1 }]), false);
}

console.log("action runtime setup flow tests passed");

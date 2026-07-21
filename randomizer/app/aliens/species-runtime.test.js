"use strict";

const assert = require("assert");
const { createAlienSpeciesRuntime } = require("./species-runtime.js");

function createRuntime() {
  const draws = [];
  const dataSources = [];
  const amibaStates = [];
  const player = {
    id: "p1",
    color: "blue",
    resources: {
      credits: 0,
      energy: 0,
      score: 0,
      publicity: 0,
      aomomoFossils: 2,
      availableData: 2,
    },
    dataState: {
      poolTokens: [
        { id: "d1", slotIndex: 0 },
        { id: "d2", slotIndex: 1 },
      ],
    },
  };
  const players = {
    gainResources(target, gain = {}) {
      for (const [key, value] of Object.entries(gain)) {
        target.resources[key] = (target.resources[key] || 0) + value;
      }
      return { ok: true };
    },
    formatResourceCost(gain = {}) {
      return Object.entries(gain).map(([key, value]) => `${key}:${value}`).join(",");
    },
    canAfford(target, cost = {}) {
      return Object.entries(cost).every(([key, value]) => (target.resources[key] || 0) >= value);
    },
    spendResources(target, cost = {}) {
      if (!this.canAfford(target, cost)) return { ok: false, message: "资源不足" };
      for (const [key, value] of Object.entries(cost)) target.resources[key] -= value;
      return { ok: true };
    },
  };
  const data = {
    ensurePlayerDataState(target) {
      return target.dataState;
    },
    gainData(target, options = {}) {
      dataSources.push(options.source);
      target.resources.availableData += 1;
      return { ok: true };
    },
  };
  const symbolClaims = [];
  const runtime = createAlienSpeciesRuntime({
    Array,
    Boolean,
    Math,
    Number,
    Object,
    Set,
    String,
    structuredClone,
    players,
    data,
    blindDrawCardForPlayer(target) {
      draws.push(target.id);
      return { ok: true };
    },
    amiba: {
      resolveRegionReward(alienState) {
        amibaStates.push(alienState);
        return { results: [] };
      },
      formatRegionLabel(region) {
        return region;
      },
    },
    runezu: {
      gainPlayerSymbol(target, symbolId) {
        symbolClaims.push([target.id, symbolId]);
      },
      formatSymbolLabel(symbolId) {
        return `symbol:${symbolId}`;
      },
    },
  });
  const workingRoot = {
    alienGameState: {},
    cardState: {},
    nebulaDataState: {},
    playerState: { currentPlayerId: player.id, players: [player] },
    rocketState: { statusNote: "", rockets: [] },
  };
  return { runtime, workingRoot, player, draws, dataSources, symbolClaims, amibaStates };
}

(function testAllSpeciesRewardPathsUseInjectedContext() {
  const { runtime, workingRoot, player, draws, dataSources, symbolClaims, amibaStates } = createRuntime();

  const fangzhou = runtime.applyFangzhouTraceRewardToPlayer(workingRoot, player, { gain: { score: 2 } });
  const jiuzhe = runtime.applyJiuzheRewardToPlayer(player, { gain: { publicity: 1 }, dataCount: 1 });
  const yichangdian = runtime.applyYichangdianRewardToPlayer(player, { gain: { energy: 1 }, pickCard: true });
  const banrenma = runtime.applyBanrenmaRewardToPlayer(player, { payData: 1, gain: { credits: 2 } });
  const aomomo = runtime.applyAomomoRewardToPlayer(player, { payFossils: 1, gain: { score: 3 } });
  const chong = runtime.applyChongRewardToPlayer(player, { drawCards: 1 });
  const amiba = runtime.applyAmibaRewardToPlayer(workingRoot, player, { region: "red", gain: { publicity: 1 } });
  const runezu = runtime.applyRunezuRewardToPlayer(workingRoot, player, { symbolId: "s1", dataCount: 1 });

  for (const result of [fangzhou, jiuzhe, yichangdian, banrenma, aomomo, chong, amiba, runezu]) {
    assert.strictEqual(result.ok, true);
    assert.ok(result.message);
  }
  assert.strictEqual(player.resources.score, 5);
  assert.strictEqual(player.resources.credits, 2);
  assert.strictEqual(player.resources.energy, 1);
  assert.strictEqual(player.resources.publicity, 2);
  assert.strictEqual(player.resources.aomomoFossils, 1);
  assert.strictEqual(player.dataState.poolTokens.length, 1);
  assert.deepStrictEqual(draws, ["p1"]);
  assert.deepStrictEqual(dataSources, ["jiuzhe", "runezu"]);
  assert.deepStrictEqual(symbolClaims, [["p1", "s1"]]);
  assert.deepStrictEqual(amibaStates, [workingRoot.alienGameState]);
  assert.deepStrictEqual(chong.irreversible, {
    code: "hidden_card_reveal",
    reason: "盲抽翻出新牌",
  });
})();

(function testSpeciesOperationsRequireAndIsolateWorkingRoot() {
  const { runtime, workingRoot } = createRuntime();
  const isolatedPlayer = { id: "isolated", color: "red" };
  const isolatedRoot = {
    ...workingRoot,
    playerState: { currentPlayerId: isolatedPlayer.id, players: [isolatedPlayer] },
  };

  assert.strictEqual(
    runtime.findPlayerForJiuzheEntry(isolatedRoot, { playerId: isolatedPlayer.id }),
    isolatedPlayer,
  );
  assert.strictEqual(
    runtime.findPlayerForJiuzheEntry(isolatedRoot, { playerId: workingRoot.playerState.currentPlayerId }),
    null,
  );
  assert.throws(
    () => runtime.findPlayerForJiuzheEntry(null, { playerId: isolatedPlayer.id }),
    /explicit workingRoot/,
  );
})();

console.log("alien species runtime tests passed");

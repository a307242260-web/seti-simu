"use strict";

const assert = require("node:assert/strict");
const runezu = require("./runezu");
const yichangdian = require("./yichangdian");

const yichangdianCard = yichangdian.createAlienCard(5, 1);
assert.equal(runezu.isRunezuCard(yichangdianCard), false);
assert.equal(runezu.getCardDefinition(yichangdianCard), null);

const alienState = { aliens: { 1: { revealed: true, alienId: runezu.ALIEN_ID } } };
const player = { id: "p1", color: "blue", runezuSymbols: {} };
runezu.ensureRunezuState(alienState);

assert.equal(runezu.canPlaceFaceSymbol(alienState, 4, player).ok, false);
runezu.gainPlayerSymbol(player, "symbol_4");
assert.equal(runezu.canPlaceFaceSymbol(alienState, 4, player).ok, true);
assert.equal(runezu.canPlaceFaceSymbol(alienState, 1, player).ok, false);

let faceResult = runezu.placePlayerSymbolOnFace(alienState, 4, player, "symbol_4");
assert.equal(faceResult.ok, true);
assert.deepEqual(faceResult.reward, {
  gain: {},
  dataCount: 0,
  drawCards: 1,
  pickCard: false,
  pickAlienCard: false,
  panelSymbol: false,
  refillPanelSymbol: false,
  panelSymbolSlotId: null,
  symbolId: null,
});

runezu.gainPlayerSymbol(player, "symbol_4");
assert.equal(
  runezu.listPlaceablePlayerSymbolsForFace(alienState, player).some((choice) => choice.symbolId === "symbol_4"),
  false,
);

runezu.gainPlayerSymbol(player, "symbol_5");
faceResult = runezu.placePlayerSymbolOnFace(alienState, 5, player, "symbol_5");
assert.equal(faceResult.ok, true);
assert.deepEqual(faceResult.reward.gain, { publicity: 1 });

runezu.gainPlayerSymbol(player, "symbol_1");
assert.equal(runezu.canPlaceFaceSymbol(alienState, 1, player).ok, true);
faceResult = runezu.placePlayerSymbolOnFace(alienState, 1, player, "symbol_1");
assert.equal(faceResult.ok, true);
assert.deepEqual(faceResult.reward.gain, { energy: 1 });

const rewardLookupState = { aliens: { 1: { revealed: true, alienId: runezu.ALIEN_ID } } };
const rewardRunezuState = runezu.ensureRunezuState(rewardLookupState);
rewardRunezuState.faceSymbolSlots = {
  1: { position: 1, symbolId: "symbol_4" },
  2: { position: 2, symbolId: "symbol_5" },
  3: { position: 3, symbolId: "symbol_3" },
  4: { position: 4, symbolId: "symbol_1" },
  5: { position: 5, symbolId: "symbol_6" },
  6: { position: 6, symbolId: "symbol_2" },
  7: { position: 7, symbolId: "symbol_7" },
};
const rewardBySymbol = Object.fromEntries(runezu.SYMBOL_IDS.map((symbolId) => {
  const lookup = runezu.getTraceFaceRewardForSymbol(rewardLookupState, symbolId);
  assert.equal(lookup.ok, true);
  return [symbolId, { position: lookup.position, reward: lookup.reward }];
}));
assert.equal(rewardBySymbol.symbol_4.position, 1);
assert.deepEqual(rewardBySymbol.symbol_4.reward.gain, { energy: 1 });
assert.equal(rewardBySymbol.symbol_5.position, 2);
assert.deepEqual(rewardBySymbol.symbol_5.reward.gain, { additionalPublicScan: 1 });
assert.equal(rewardBySymbol.symbol_3.position, 3);
assert.deepEqual(rewardBySymbol.symbol_3.reward.gain, { credits: 1 });
assert.equal(rewardBySymbol.symbol_1.position, 4);
assert.equal(rewardBySymbol.symbol_1.reward.drawCards, 1);
assert.equal(rewardBySymbol.symbol_6.position, 5);
assert.deepEqual(rewardBySymbol.symbol_6.reward.gain, { publicity: 1 });
assert.equal(rewardBySymbol.symbol_2.position, 6);
assert.equal(rewardBySymbol.symbol_2.reward.dataCount, 1);
assert.equal(rewardBySymbol.symbol_7.position, 7);
assert.deepEqual(rewardBySymbol.symbol_7.reward.gain, { score: 3 });

const sourceSymbolAlienState = {
  aliens: {
    1: {
      revealed: true,
      alienId: runezu.ALIEN_ID,
      assignedAlienId: runezu.ALIEN_ID,
    },
  },
};
const sourceSymbolPlayer = { id: "p-source-symbol", color: "green", runezuSymbols: {} };
runezu.ensureRunezuState(sourceSymbolAlienState).initialConfiguration = runezu.createInitialConfiguration(() => 0);
const revealResult = runezu.initializeRunezuReveal(sourceSymbolAlienState, 1, sourceSymbolPlayer, {
  random: () => 0,
  techTileIds: [],
});
assert.equal(revealResult.ok, true);
const mercurySourceSymbol = runezu.listSourceSymbols(sourceSymbolAlienState, "planet")
  .find((slot) => slot.sourceId === "mercury");
assert.ok(mercurySourceSymbol, "runezu reveal should place a source symbol on Mercury");
const mercuryClaim = runezu.claimPlanetSymbol(sourceSymbolAlienState, "mercury", sourceSymbolPlayer);
assert.equal(mercuryClaim.ok, true);
assert.equal(mercuryClaim.sourceType, "planet");
assert.equal(mercuryClaim.sourceId, "mercury");
assert.equal(
  runezu.getPlayerSymbolCounts(sourceSymbolPlayer)[mercuryClaim.symbolId],
  1,
);
const claimedMercurySourceSymbol = runezu.listSourceSymbols(sourceSymbolAlienState, "planet")
  .find((slot) => slot.sourceId === "mercury");
assert.equal(claimedMercurySourceSymbol.claimedByPlayerId, sourceSymbolPlayer.id);
assert.equal(claimedMercurySourceSymbol.claimedByPlayerColor, sourceSymbolPlayer.color);
const duplicateMercuryClaim = runezu.claimPlanetSymbol(sourceSymbolAlienState, "mercury", sourceSymbolPlayer);
assert.equal(duplicateMercuryClaim.ok, false);
assert.equal(duplicateMercuryClaim.alreadyClaimed, true);

{
  const state = { runezu: runezu.createRunezuState() };
  const recipient = { id: "exhaustion", color: "white", runezuSymbols: {} };
  state.runezu.availableSymbols = [];
  state.runezu.panelSymbolSlots.pink_top = { symbolId: "symbol_1", sequence: 1 };
  const options = { refill: true, random() { throw new Error("耗尽不能制造随机符号"); } };
  const last = runezu.takePanelSymbol(state, "pink_top", recipient, options);
  assert.equal(last.ok, true);
  assert.equal(last.refilledSymbolId, null);
  assert.equal(recipient.runezuSymbols.symbol_1, 1);
  const before = structuredClone({ state, recipient });
  const empty = runezu.takePanelSymbol(state, "pink_top", recipient, options);
  assert.equal(empty.ok, true);
  assert.equal(empty.skipped, true);
  assert.deepEqual({ state, recipient }, before, "已耗尽位置无效果，不补造符号");
  assert.equal(runezu.takePanelSymbol(state, "missing", recipient, options).ok, false,
    "缺失位置仍是错误，不能混同合法耗尽");
}

{
  const { createSeededRandom } = require("../random");
  const config = runezu.createInitialConfiguration(createSeededRandom("runezu-fixed-positions"));
  const reveal = techTileIds => {
    const state = { runezu: runezu.createRunezuState() };
    state.runezu.initialConfiguration = structuredClone(config);
    runezu.initializeRunezuReveal(state, 1, { id: "p1", color: "white" }, {
      techTileIds, random() { throw new Error("揭示不能重抽位置符号"); },
    });
    assert.deepEqual(state.runezu.initialConfiguration, config);
    return state.runezu;
  };
  const all = reveal([...runezu.TECH_SOURCE_IDS]);
  for (const techIds of [[], [...runezu.TECH_SOURCE_IDS].reverse(),
    ...runezu.TECH_SOURCE_IDS.map(id => runezu.TECH_SOURCE_IDS.filter(other => other !== id))]) {
    const actual = reveal(techIds);
    assert.deepEqual(actual.panelSymbolSlots, all.panelSymbolSlots, "科技已被拿走不能改变面板符号");
    for (const [key, slot] of Object.entries(actual.sourceSymbolSlots)) {
      assert.deepEqual(slot, all.sourceSymbolSlots[key], "其他具名位置保留开局指定符号");
    }
    assert.deepEqual(Object.values(actual.sourceSymbolSlots).filter(slot => slot.sourceType === "tech")
      .map(slot => slot.sourceId).sort(), [...techIds].sort());
    const symbols = [...actual.availableSymbols,
      ...Object.values(actual.sourceSymbolSlots).map(slot => slot.symbolId),
      ...Object.values(actual.panelSymbolSlots).map(slot => slot.symbolId)];
    assert.equal(symbols.length, 35, "未布置科技的符号留在供应池，不能丢失");
    for (let i = 1; i <= 7; i++) assert.equal(symbols.filter(id => id === `symbol_${i}`).length, 5);
  }
}
console.log("runezu.test.js: all tests passed");

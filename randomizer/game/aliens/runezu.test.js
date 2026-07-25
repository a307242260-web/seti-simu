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

console.log("runezu.test.js: all tests passed");

const assert = require("node:assert/strict");

require("./placement");
require("../tech/catalog");
require("../tech/player-tech");
require("./state");
require("./render");
require("../players");
require("./index");

const data = require("./index");
const players = require("../players");
const playerTech = require("../tech/player-tech");

const playerState = players.createPlayerState({
  currentPlayer: {
    color: "white",
    resources: { availableData: 0, energy: 10 },
  },
});

const player = players.getCurrentPlayer(playerState);

const first = data.gainData(player, { source: "debug" });
assert.equal(first.ok, true);
assert.equal(first.token.index, 1);
assert.equal(first.token.slotIndex, 1);
assert.equal(player.resources.availableData, 1);
assert.equal(data.listPoolTokens(player).length, 1);

const layout = data.getDataPoolSlotLayout(1);
assert.ok(layout);
assert.equal(first.layout.percentX, layout.percentX);
assert.equal(first.layout.percentY, layout.percentY);

for (let index = 2; index <= players.RESOURCE_LIMITS.availableData; index += 1) {
  const result = data.gainData(player, { source: "debug" });
  assert.equal(result.ok, true);
  assert.equal(result.token.index, index);
}

assert.equal(player.resources.availableData, players.RESOURCE_LIMITS.availableData);
assert.equal(data.listPoolTokens(player).length, players.RESOURCE_LIMITS.availableData);

const overflow = data.gainData(player, { source: "debug" });
assert.equal(overflow.ok, false);
assert.equal(overflow.discarded, true);
assert.equal(player.dataState.discardedCount, 1);
assert.equal(data.listPoolTokens(player).length, players.RESOURCE_LIMITS.availableData);

const place1 = data.placeDataToComputer(player);
assert.equal(place1.ok, true);
assert.equal(place1.placementSlot, 1);
assert.equal(place1.slotBonus, null);
assert.equal(place1.poolToken.slotIndex, 1);
assert.equal(player.resources.availableData, 5);
assert.equal(data.listComputerPlacedTokens(player).length, 1);

const computerLayout = data.getComputerDataSlotLayout(1);
assert.equal(place1.layout.percentX, computerLayout.percentX);

for (let index = 2; index <= 5; index += 1) {
  const result = data.placeDataToComputer(player);
  assert.equal(result.ok, true);
  assert.equal(result.placementSlot, index);
  if (index === 2) {
    assert.deepEqual(result.slotBonus, { type: "publicity", publicity: 1 });
    assert.match(result.message, /额外获得 1 宣传/);
  } else if (index === 4) {
    assert.deepEqual(result.slotBonus, { type: "income" });
    assert.match(result.message, /额外获得 1 次收入/);
  } else {
    assert.equal(result.slotBonus, null);
  }
}

assert.deepEqual(data.getComputerSlotBonus(2), { type: "publicity", publicity: 1 });
assert.deepEqual(data.getComputerSlotBonus(4), { type: "income" });
assert.equal(data.getComputerSlotBonus(1), null);

assert.equal(data.listComputerPlacedTokens(player).length, 5);
assert.equal(data.canAnalyzeData(player).ok, false);

const place6 = data.placeDataToComputer(player);
assert.equal(place6.ok, true);
assert.equal(place6.placementSlot, 6);
assert.equal(data.canAnalyzeData(player).ok, true);
assert.equal(data.canPlaceDataToComputer(player).ok, false);

player.resources.energy = 1;
const analyze = data.analyzeData(player);
assert.equal(analyze.ok, true);
assert.equal(analyze.clearedCount, 6);
assert.equal(data.listPlacedTokens(player).length, 0);
assert.equal(player.resources.energy, 0);
assert.equal(data.canAnalyzeData(player).ok, false);

assert.equal(data.getRequiredComputerSlotForBlueBonus(1), 1);
assert.equal(data.getRequiredComputerSlotForBlueBonus(2), 3);
assert.equal(data.getRequiredComputerSlotForBlueBonus(3), 5);
assert.equal(data.getRequiredComputerSlotForBlueBonus(4), 6);

const blueSlotOneState = players.createPlayerState({
  currentPlayer: { color: "white", resources: { availableData: 0, energy: 10 } },
});
const blueSlotOnePlayer = players.getCurrentPlayer(blueSlotOneState);
blueSlotOnePlayer.techState = playerTech.createPlayerTechState();
playerTech.recordPlayerTake(blueSlotOnePlayer.techState, "blue1", 1);
data.gainData(blueSlotOnePlayer);
data.placeDataToComputer(blueSlotOnePlayer);
assert.equal(data.hasBlueBonusPlaceOptions(blueSlotOnePlayer), true);
data.gainData(blueSlotOnePlayer);
const blueSlotOnePlace = data.placeDataToComputer(blueSlotOnePlayer, {
  target: data.PLACEMENT_KIND_BLUE_BONUS,
  blueSlot: 1,
});
assert.equal(blueSlotOnePlace.ok, true);
assert.equal(blueSlotOnePlace.blueSlot, 1);

const bluePlayerState = players.createPlayerState({
  currentPlayer: {
    color: "white",
    resources: { availableData: 0, energy: 10 },
  },
});
const bluePlayer = players.getCurrentPlayer(bluePlayerState);
bluePlayer.id = "player-white-blue-test";
bluePlayer.techState = playerTech.createPlayerTechState();

for (let index = 0; index < 4; index += 1) {
  assert.equal(data.gainData(bluePlayer).ok, true);
}
assert.equal(data.hasBlueBonusPlaceOptions(bluePlayer), false);

playerTech.recordPlayerTake(bluePlayer.techState, "blue1", 2);
assert.equal(data.hasBlueBonusPlaceOptions(bluePlayer), false);

assert.equal(data.placeDataToComputer(bluePlayer).placementSlot, 1);
assert.equal(data.placeDataToComputer(bluePlayer).placementSlot, 2);
assert.equal(data.hasBlueBonusPlaceOptions(bluePlayer), false);

const thirdRow = data.placeDataToComputer(bluePlayer);
assert.equal(thirdRow.ok, true);
assert.equal(thirdRow.placementSlot, 3);
assert.ok(thirdRow.slotBonuses.some((bonus) => bonus.type === "score" && bonus.score === 2));
assert.equal(data.hasBlueBonusPlaceOptions(bluePlayer), true);

const choices = data.listPlaceDataChoices(bluePlayer);
assert.ok(choices.some((choice) => choice.target === data.PLACEMENT_KIND_COMPUTER));
assert.ok(choices.some((choice) => choice.blueSlot === 2));

const bluePlace = data.placeDataToComputer(bluePlayer, {
  target: data.PLACEMENT_KIND_BLUE_BONUS,
  blueSlot: 2,
});
assert.equal(bluePlace.ok, true);
assert.equal(bluePlace.blueSlot, 2);
assert.equal(bluePlace.blueTileId, "blue1");
assert.deepEqual(bluePlace.slotBonus, { type: "credits", credits: 1 });
assert.equal(data.listBlueBonusPlacedTokens(bluePlayer).length, 1);

const dataBeforeTechPlayer = players.getCurrentPlayer(players.createPlayerState({
  currentPlayer: { color: "white", resources: { availableData: 0, energy: 10 } },
}));
dataBeforeTechPlayer.techState = playerTech.createPlayerTechState();
data.gainData(dataBeforeTechPlayer);
data.placeDataToComputer(dataBeforeTechPlayer);
data.gainData(dataBeforeTechPlayer);
data.placeDataToComputer(dataBeforeTechPlayer);
data.gainData(dataBeforeTechPlayer);
const earlyData = data.placeDataToComputer(dataBeforeTechPlayer);
assert.equal(earlyData.placementSlot, 3);
assert.equal(earlyData.slotBonuses.some((bonus) => bonus.type === "score"), false);
playerTech.recordPlayerTake(dataBeforeTechPlayer.techState, "blue1", 2);
assert.equal(data.hasBlueBonusPlaceOptions(dataBeforeTechPlayer), true);
data.gainData(dataBeforeTechPlayer);
const belowTech = data.placeDataToComputer(dataBeforeTechPlayer, {
  target: data.PLACEMENT_KIND_BLUE_BONUS,
  blueSlot: 2,
});
assert.equal(belowTech.ok, true);
assert.deepEqual(belowTech.slotBonus, { type: "credits", credits: 1 });

function fillComputerThrough(player, placementSlot) {
  while (data.listComputerPlacedTokens(player).length < placementSlot) {
    data.gainData(player);
    const result = data.placeDataToComputer(player);
    assert.equal(result.placementSlot, data.listComputerPlacedTokens(player).length);
  }
}

for (const [tileId, boardSlot, expectedBonus] of [
  ["blue2", 2, { type: "energy", energy: 1 }],
  ["blue3", 3, { type: "choose_card" }],
  ["blue4", 4, { type: "publicity", publicity: 2 }],
]) {
  const rewardPlayerState = players.createPlayerState({
    currentPlayer: { color: "white", resources: { availableData: 0, energy: 10 } },
  });
  const rewardPlayer = players.getCurrentPlayer(rewardPlayerState);
  rewardPlayer.techState = playerTech.createPlayerTechState();
  playerTech.recordPlayerTake(rewardPlayer.techState, tileId, boardSlot);
  fillComputerThrough(rewardPlayer, data.getRequiredComputerSlotForBlueBonus(boardSlot));
  data.gainData(rewardPlayer);
  const rewardPlace = data.placeDataToComputer(rewardPlayer, {
    target: data.PLACEMENT_KIND_BLUE_BONUS,
    blueSlot: boardSlot,
  });
  assert.equal(rewardPlace.ok, true);
  assert.deepEqual(rewardPlace.slotBonus, expectedBonus);
}

playerTech.recordPlayerTake(bluePlayer.techState, "blue2", 3);
data.gainData(bluePlayer);
data.placeDataToComputer(bluePlayer);
data.gainData(bluePlayer);
data.placeDataToComputer(bluePlayer);
assert.equal(data.hasBlueBonusPlaceOptions(bluePlayer), true);

const multiChoices = data.listPlaceDataChoices(bluePlayer);
const blueChoiceSlots = multiChoices
  .filter((choice) => choice.target === data.PLACEMENT_KIND_BLUE_BONUS)
  .map((choice) => choice.blueSlot);
assert.ok(blueChoiceSlots.includes(3));

for (let slot = 4; slot <= 6; slot += 1) {
  data.gainData(bluePlayer);
  data.placeDataToComputer(bluePlayer);
}
assert.equal(data.canAnalyzeData(bluePlayer).ok, true);

bluePlayer.resources.energy = 1;
const blueAnalyze = data.analyzeData(bluePlayer);
assert.equal(blueAnalyze.ok, true);
assert.equal(blueAnalyze.clearedCount >= 2, true);
assert.equal(data.listPlacedTokens(bluePlayer).length, 0);

const readout = data.getReadoutLines(playerState);
assert.ok(readout.some((line) => line.includes("已弃置数据 1")));

console.log("data.test.js: all tests passed");

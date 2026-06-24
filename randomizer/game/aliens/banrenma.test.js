"use strict";

const assert = require("node:assert/strict");
const banrenma = require("./banrenma");
const state = require("./state");

const alienState = state.createDefaultAlienState();
alienState.aliens[2].assignedAlienId = banrenma.ALIEN_ID;
alienState.aliens[2].alienId = banrenma.ALIEN_ID;
alienState.aliens[2].revealed = true;

const white = {
  id: "player-white",
  color: "white",
  colorLabel: "白色",
  resources: { score: 10, credits: 2, energy: 2, publicity: 0, availableData: 3 },
};
const blue = {
  id: "player-blue",
  color: "blue",
  colorLabel: "蓝色",
  resources: { score: 5, credits: 0, energy: 0, publicity: 0, availableData: 0 },
};
const revealResult = banrenma.initializeBanrenmaReveal(alienState, 2, white, [white, blue], () => 0);
assert.equal(revealResult.ok, true);
assert.equal(alienState.banrenma.revealedSlotId, 2);
assert.equal(banrenma.getPlayerScoreMarks(alienState, white)[0].threshold, 25);
assert.equal(banrenma.getPlayerScoreMarks(alienState, blue)[0].threshold, 20);
assert.equal(Number.isInteger(alienState.banrenma.displayedCardIndex), true);
assert.ok(banrenma.CARD_BY_INDEX[alienState.banrenma.displayedCardIndex]);
white.resources.score = 25;
const pendingPanelMark = banrenma.getPendingPanelMark(alienState, white);
assert.equal(pendingPanelMark.threshold, 25);
assert.equal(banrenma.resolveScoreMark(alienState, white, pendingPanelMark.id).ok, true);
assert.equal(banrenma.getPendingPanelMark(alienState, white), null, "resolved panel marks should not queue again");
white.resources.score = 10;

let result = banrenma.placeBanrenmaTrace(alienState, 2, "pink", 1, white);
assert.equal(result.ok, true);
assert.equal(result.reward.payData, 1);
assert.equal(result.reward.gain.score, 6);
result = banrenma.placeBanrenmaTrace(alienState, 2, "pink", 1, blue);
assert.equal(result.ok, true, "position 1 can stack");
assert.equal(banrenma.getTraceGrid(alienState, 2).pink[1].length, 2);

result = banrenma.placeBanrenmaTrace(alienState, 2, "yellow", 4, white);
assert.equal(result.ok, true);
assert.equal(result.reward.pickAlienCard, true);
result = banrenma.placeBanrenmaTrace(alienState, 2, "yellow", 4, blue);
assert.equal(result.ok, false, "positions 2-5 cannot be occupied twice");

const debugState = state.createDefaultAlienState();
debugState.aliens[1].assignedAlienId = banrenma.ALIEN_ID;
debugState.aliens[1].alienId = banrenma.ALIEN_ID;
debugState.aliens[1].revealed = true;
banrenma.seedDebugTraceGrid(debugState, 1, white);
assert.equal(banrenma.listTraceEntries(debugState, 1).length, 15, "debug grid should place 3x5 tokens");
assert.equal(banrenma.getTraceGrid(debugState, 1).pink[1].length, 1, "debug only places one position-1 token");

const displayed = banrenma.takeDisplayedCard(alienState, () => 0);
assert.equal(displayed.ok, true);
assert.equal(displayed.card.set, "alien:半人马");
assert.equal(displayed.card.banrenmaCard, true);
assert.match(displayed.card.src, /assets\/aliens\/半人马\/cards\/\d\.webp/);
const blind = banrenma.blindDrawCard(alienState, () => 0);
assert.equal(blind.ok, true);
assert.equal(blind.card.cardId.startsWith("banrenma_"), true);

assert.equal(banrenma.buildImmediateEffects(3)[0].type, "card_research_tech");
assert.equal(banrenma.buildConditionEffects(2)[0].type, banrenma.EFFECT_GAIN_INCOME);

console.log("aliens/banrenma.test.js ok");

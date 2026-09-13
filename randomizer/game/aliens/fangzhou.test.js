/* eslint-disable no-console */
"use strict";

const assert = require("node:assert/strict");
const placement = require("./placement");
const alienState = require("./state");
const fangzhou = require("./fangzhou");

let alienSequence = 1;
const nextAlienIdentity = () => ({ sequence: alienSequence++ });

function createDebugState() {
  return {
    aliens: {
      2: {
        revealed: true,
        assignedAlienId: fangzhou.ALIEN_ID,
        alienId: fangzhou.ALIEN_ID,
        traces: {
          pink: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
          yellow: { firstPlaced: false, ownerPlayerColor: null, extraCount: 0 },
          blue: { firstPlaced: false, ownerPlayerColor: null, extraCount: 0 },
        },
      },
    },
    fangzhou: fangzhou.createFangzhouState(),
  };
}

const white = { id: "white", color: "white", colorLabel: "白色" };

assert.equal(fangzhou.TRACE_POSITION_COUNT, 4);
assert(placement.FANGZHOU_TRACE_MARKER_SLOTS[2].pink[1]);
assert.equal(placement.getFangzhouTraceMarkerLayout(2, "pink", 1).percentY, 39.8);
assert.equal(placement.getFangzhouTraceMarkerLayout(2, "pink", 1).percentX, 20.69);
assert.equal(placement.getFangzhouTraceMarkerLayout(2, "yellow", 4).percentX, 50.44);
assert.equal(placement.getFangzhouTraceMarkerLayout(2, "blue", 3).percentX, 79.51);

const card2CornerExpectations = {
  pink: {
    1: { scanActionCode: 1, incomeCode: 2 },
    2: { scanActionCode: 2, incomeCode: 1 },
    3: { scanActionCode: 0, incomeCode: 0 },
    4: { scanActionCode: 3, incomeCode: 1 },
  },
  yellow: {
    1: { scanActionCode: 0, incomeCode: 2 },
    2: { scanActionCode: 1, incomeCode: 1 },
    3: { scanActionCode: 2, incomeCode: 0 },
    4: { scanActionCode: 3, incomeCode: 0 },
  },
  blue: {
    1: { scanActionCode: 2, incomeCode: 2 },
    2: { scanActionCode: 0, incomeCode: 1 },
    3: { scanActionCode: 3, incomeCode: 2 },
    4: { scanActionCode: 1, incomeCode: 0 },
  },
};
for (const [traceType, variants] of Object.entries(card2CornerExpectations)) {
  for (const [variant, expected] of Object.entries(variants)) {
    const definition = fangzhou.createCard2Definition(traceType, Number(variant));
    assert.equal(definition.price, 2);
    assert.equal(definition.cardTypeCode, 0);
    assert.equal(definition.discardActionCode, fangzhou.CARD2_DISCARD_ACTION_CODE);
    assert.equal(definition.scanActionCode, expected.scanActionCode);
    assert.equal(definition.incomeCode, expected.incomeCode);
  }
}

const lockedState = createDebugState();
lockedState.fangzhou.revealedSlotId = 2;
lockedState.fangzhou.revealInitialized = true;
lockedState.fangzhou.initialConfiguration = fangzhou.createInitialConfiguration(() => 0, [white]);
fangzhou.dealPlayerCard2(lockedState, white);
fangzhou.ensureTraceGrid(lockedState, 2);
assert.equal(fangzhou.getUnlockCount(lockedState, white), 0);
const locked = fangzhou.canPlaceFangzhouTrace(lockedState, 2, "pink", 2, white);
assert.equal(locked.ok, false);

fangzhou.unlockCard2(lockedState, white, "pink");
assert.equal(fangzhou.getUnlockCount(lockedState, white), 1);
delete lockedState.fangzhou.unlockCountByPlayerId.white;
assert.equal(fangzhou.getUnlockCount(lockedState, white), 1);
const reserved = fangzhou.getPlayerCard2Reserved(lockedState, white);
assert.equal(reserved.find((card) => card.traceType === "pink"), undefined);
assert.equal(fangzhou.canUnlockCard2ForTrace(lockedState, white, "pink"), false);
assert.equal(fangzhou.canPlaceAnyFangzhouTrace(lockedState, 2, "pink", white), true);
const unlocked = fangzhou.canPlaceFangzhouTrace(lockedState, 2, "pink", 2, white);
assert.equal(unlocked.ok, true);

const unlockTraceReward = fangzhou.getCard2UnlockTraceReward();
assert.deepEqual(unlockTraceReward.gain, { score: 3 });
const unlockTraceState = createDebugState();
unlockTraceState.fangzhou.revealedSlotId = 2;
unlockTraceState.fangzhou.revealInitialized = true;
unlockTraceState.fangzhou.initialConfiguration = fangzhou.createInitialConfiguration(() => 0, [white]);
fangzhou.dealPlayerCard2(unlockTraceState, white);
assert.equal(alienState.countTraceMarkersForPlayerOnSlot(unlockTraceState, 2, white, "pink"), 1);
const stateExtraTrace = alienState.addExtraTrace(unlockTraceState, 2, "pink", white.color);
assert.equal(stateExtraTrace.ok, true);
const unlockWithStateTrace = fangzhou.unlockCard2(unlockTraceState, white, "pink");
assert.equal(unlockWithStateTrace.ok, true);
assert.equal(unlockTraceState.aliens[2].traces.pink.extraCount, 1);
assert.equal(unlockTraceState.aliens[2].traces.pink.extraMarkers[0].ownerPlayerColor, "white");
assert.equal(alienState.countTraceMarkersForPlayerOnSlot(unlockTraceState, 2, white, "pink"), 2);
assert.equal(fangzhou.countStateTraceMarkers(unlockTraceState, white, "pink", 2), 2);
assert.equal(fangzhou.countTraceMarkers(unlockTraceState, white, 2), 2);

const singleState = createDebugState();
singleState.fangzhou.revealedSlotId = 2;
singleState.fangzhou.revealInitialized = true;
fangzhou.placeFangzhouTrace(singleState, 2, "pink", 1, white, nextAlienIdentity());
const duplicate = fangzhou.placeFangzhouTrace(singleState, 2, "pink", 1, white, nextAlienIdentity());
assert.equal(duplicate.ok, false);
assert.equal(fangzhou.getTraceGrid(singleState, 2).pink[1].playerColor, "white");

const initState = {
  aliens: {
    2: {
      revealed: true,
      alienId: fangzhou.ALIEN_ID,
      traces: {
        pink: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
        yellow: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
        blue: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
      },
    },
  },
  fangzhou: fangzhou.createFangzhouState(),
};
fangzhou.ensureFangzhouState(initState).initialConfiguration = fangzhou.createInitialConfiguration(() => 0, [white]);
const init = fangzhou.initializeFangzhouReveal(initState, 2, white, [white], () => 0);
assert.equal(init.ok, true);
assert.equal(initState.fangzhou.playerCard2ById.white.cards.pink.variant, 1);

const flipWrapper = { fangzhou: fangzhou.createFangzhouState() };
flipWrapper.fangzhou.initialConfiguration = fangzhou.createInitialConfiguration(() => 0);
for (let index = 0; index < 5; index += 1) {
  const flip = fangzhou.flipCard1Reward(flipWrapper, "basic", () => 0);
  assert.equal(flip.ok, true);
  assert.equal(flip.reshuffled, false);
}
assert.equal(flipWrapper.fangzhou.card1RevealedSinceShuffle, 5);
assert.equal(flipWrapper.fangzhou.card1Revealed.length, 5);
assert.equal(flipWrapper.fangzhou.card1Deck.length, 4);

const sixth = fangzhou.flipCard1Reward(flipWrapper, "basic", () => 0);
assert.equal(sixth.ok, true);
assert.equal(sixth.reshuffled, true);
assert.equal(flipWrapper.fangzhou.card1RevealedSinceShuffle, 1);
assert.equal(flipWrapper.fangzhou.card1Revealed.length, 1);
assert.equal(flipWrapper.fangzhou.card1Deck.length, 8);

// 搜索样本只由公开种子、公开已翻奖励决定；隐藏牌序/后续混洗种子不参与。
for (const initialized of [false, true]) {
  const variants = [false, true].map(reverse => {
    const hypothetical = createDebugState();
    hypothetical.fangzhou.initialConfiguration = fangzhou.createInitialConfiguration(() => 0, [white]);
    hypothetical.fangzhou.revealInitialized = initialized;
    if (initialized) {
      hypothetical.fangzhou.card1Revealed = [2, 4, 7, 8];
      hypothetical.fangzhou.card1RevealedSinceShuffle = 4;
      hypothetical.fangzhou.card1Deck = [0, 1, 3, 5, 6];
    }
    if (reverse) {
      hypothetical.fangzhou.card1Deck.reverse();
      hypothetical.fangzhou.initialConfiguration.card1Deck.reverse();
      hypothetical.fangzhou.initialConfiguration.rewardShuffleSeed = 12345;
    }
    fangzhou.sampleHiddenRewards(hypothetical, "public-reward-test");
    if (!initialized) fangzhou.initializeFangzhouReveal(hypothetical, 2, white, [white]);
    const seen = [];
    for (let i = 0; i < 12; i += 1) {
      const flipped = fangzhou.flipCard1Reward(hypothetical);
      if (initialized && i === 0) assert.ok(![2, 4, 7, 8].includes(flipped.index));
      seen.push(flipped);
    }
    return { hypothetical, seen };
  });
  assert.deepEqual(variants[0], variants[1], "包括重复混洗后的奖励序列也不能受真实隐藏配置影响");
}
assert.throws(() => fangzhou.sampleHiddenRewards(initState, ""), /公开种子/);

console.log("fangzhou.test.js: all tests passed");

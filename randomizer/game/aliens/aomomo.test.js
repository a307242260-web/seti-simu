const assert = require("node:assert/strict");

globalThis.SetiAlienPlacement = require("./placement");
globalThis.SetiAlienState = require("./state");
const aomomo = require("./aomomo");

let alienSequence = 1;
const nextAlienIdentity = () => ({ sequence: alienSequence++ });

function createTraceSlot(ownerPlayerColor = null, extraCount = 0) {
  return {
    firstPlaced: Boolean(ownerPlayerColor),
    ownerPlayerColor,
    extraCount,
  };
}

function createTraceSlots(overrides = {}) {
  return {
    pink: createTraceSlot(),
    yellow: createTraceSlot(),
    blue: createTraceSlot(),
    ...overrides,
  };
}

function createState(traces = createTraceSlots()) {
  return {
    aliens: {
      1: {
        revealed: true,
        alienId: aomomo.ALIEN_ID,
        assignedAlienId: aomomo.ALIEN_ID,
        traces,
      },
    },
    aomomo: aomomo.createAomomoState(),
  };
}

const white = {
  id: "player-white",
  color: "white",
  colorLabel: "白色",
  resources: { score: 0, aomomoFossils: 2, availableData: 0 },
};

const state = createState();
const reveal = aomomo.initializeAomomoReveal(state, 1, white, () => 0);
assert.equal(reveal.ok, true);
assert.equal(state.aomomo.revealedSlotId, 1);
assert.equal(aomomo.CARD_DEFINITIONS.some((card) => card.index === state.aomomo.displayedCardIndex), true);
assert.equal(state.aomomo.cardDeck.includes(state.aomomo.displayedCardIndex), false);

const paidTrace = aomomo.placeAomomoTrace(state, 1, "pink", 1, white, nextAlienIdentity());
assert.equal(paidTrace.ok, true);
assert.equal(paidTrace.reward.payFossils, 1);
assert.equal(aomomo.getTraceEntries(aomomo.getTraceGrid(state, 1), "pink", 1).length, 1);

const panelState = createState();
aomomo.initializeAomomoReveal(panelState, 1, white, () => 0);
// 奥陌陌环绕/登陆槽位无限：任意次数的环绕/登陆都可以继续放置标记。
for (let index = 0; index < 3; index += 1) {
  const orbit = aomomo.addOrbitMarker(panelState, white, nextAlienIdentity());
  assert.equal(orbit.ok, true, orbit.message);
}
assert.equal(aomomo.countOrbitMarkers(panelState), 3);
assert.equal(aomomo.canAddOrbitMarker(panelState), true, "环绕槽位无限，永不满");
for (let index = 0; index < 5; index += 1) {
  const landing = aomomo.addLandingMarker(panelState, white, nextAlienIdentity());
  assert.equal(landing.ok, true, landing.message);
}
assert.equal(aomomo.countLandingMarkers(panelState), 5);
assert.equal(aomomo.canAddLandingMarker(panelState), true, "登陆槽位无限，永不满");

assert.equal(aomomo.createAlienCard(8, 1).cardTypeCode, 3);
const aomomo0Effects = aomomo.buildImmediateEffects(0);
assert.equal(aomomo0Effects.length, 2);
assert.equal(aomomo0Effects[0].type, "card_scan_action");
assert.equal(aomomo0Effects[1].type, "card_conditional_reward");
assert.equal(aomomo0Effects[1].options.condition.type, "flowMarkedNebula");
assert.deepEqual(aomomo0Effects[1].options.condition.nebulaIds, [aomomo.NEBULA_ID]);
assert.equal(aomomo.buildImmediateEffects(1)[0].type, aomomo.EFFECT_GAIN_FOSSILS);
const aomomo5Effects = aomomo.buildImmediateEffects(5);
assert.equal(aomomo5Effects.length, 2);
assert.equal(aomomo5Effects[0].type, "card_move");
assert.equal(aomomo5Effects[0].options.movementPoints, 4);
assert.equal(aomomo5Effects[1].type, aomomo.EFFECT_VISIT_AOMOMO_THIS_TURN_FOSSIL);
assert.equal(aomomo.buildImmediateEffects(8).at(-1).type, aomomo.EFFECT_FOSSIL_FOR_ANY_SCAN);
const aomomo9Effects = aomomo.buildImmediateEffects(9);
assert.equal(aomomo9Effects.length, 2);
assert.equal(aomomo9Effects[0].type, "card_register_event_bonus");
assert.equal(aomomo9Effects[0].options.bonus.eventType, "signalMarked");
assert.deepEqual(aomomo9Effects[0].options.bonus.nebulaIds, [aomomo.NEBULA_ID]);
assert.equal(aomomo9Effects[1].type, "card_scan_action");

const stateTraceState = createState(createTraceSlots({
  pink: createTraceSlot("white"),
  yellow: createTraceSlot("white", 1),
  blue: createTraceSlot("white"),
}));
aomomo.initializeAomomoReveal(stateTraceState, 1, white, () => 0);
assert.equal(aomomo.playerHasAllTraceTypes(stateTraceState, white), true);
assert.equal(aomomo.countTraceMarkersByType(stateTraceState, white, "yellow"), 2);

const mixedTraceState = createState(createTraceSlots({
  pink: createTraceSlot("white"),
  yellow: createTraceSlot("white"),
}));
aomomo.initializeAomomoReveal(mixedTraceState, 1, white, () => 0);
assert.equal(aomomo.placeAomomoTrace(mixedTraceState, 1, "blue", 2, white, nextAlienIdentity()).ok, true);
assert.equal(aomomo.playerHasAllTraceTypes(mixedTraceState, white), true);
assert.equal(aomomo.countTraceMarkers(mixedTraceState, white, null), 3);

console.log("aomomo.test.js: all tests passed");

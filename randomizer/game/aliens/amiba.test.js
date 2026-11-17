const assert = require("node:assert/strict");

globalThis.SetiAlienPlacement = require("./placement");
const amiba = require("./amiba");
const cardEffects = require("../cards/effects");

let alienSequence = 1;
const nextAlienIdentity = () => ({ sequence: alienSequence++ });

function createState() {
  return {
    aliens: {
      1: {
        revealed: true,
        alienId: amiba.ALIEN_ID,
        assignedAlienId: amiba.ALIEN_ID,
        traces: {},
      },
    },
    amiba: { ...amiba.createAmibaState(), initialConfiguration: amiba.createInitialConfiguration(() => 0) },
  };
}

const white = { id: "player-white", color: "white", colorLabel: "白色" };
const state = createState();
amiba.initializeAmibaReveal(state, 1, white, () => 0);

assert.equal(Object.keys(state.amiba.symbolSlots).length, 5);
assert.deepEqual(new Set(Object.values(state.amiba.symbolSlots)), new Set(amiba.SYMBOL_IDS));
assert.equal(amiba.formatSymbolSlotLabel("blue_3"), "蓝3");

const orangeReward = amiba.resolveRegionReward(state, "orange");
assert.equal(orangeReward.results.length, 2);
assert.equal(Object.hasOwn(state.amiba.symbolSlots, "orange_1"), false);
assert.equal(Object.hasOwn(state.amiba.symbolSlots, "blue_1"), true);

const traceState = createState();
amiba.initializeAmibaReveal(traceState, 1, white, () => 0);
const placedPink = amiba.placeAmibaTrace(traceState, 1, "pink", 1, white, nextAlienIdentity());
const placedYellow = amiba.placeAmibaTrace(traceState, 1, "yellow", 1, white, nextAlienIdentity());
const placedBlue = amiba.placeAmibaTrace(traceState, 1, "blue", 1, white, nextAlienIdentity());
assert.equal(placedPink.reward.region, "red");
assert.equal(placedYellow.reward.region, "orange");
assert.equal(placedBlue.reward.region, "blue");
assert.equal(amiba.countTraceMarkers(traceState, white, null), 3);
assert.equal(amiba.isTheoryTaskReady(traceState, white), true);
assert.equal(amiba.getTheoryTaskReward(traceState).emptyCount, 9);

const removed = amiba.removePlayerTrace(traceState, 1, "pink", 1, white);
assert.equal(removed.ok, true);
assert.equal(removed.reward.region, "red");
assert.equal(amiba.countTraceMarkers(traceState, white, "pink"), 0);

const stateTraceTheoryState = createState();
stateTraceTheoryState.aliens[1].traces = {
  pink: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
  yellow: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 0 },
  blue: { firstPlaced: true, ownerPlayerColor: "white", extraCount: 1 },
};
amiba.initializeAmibaReveal(stateTraceTheoryState, 1, white, () => 0);
assert.equal(amiba.isTheoryTaskReady(stateTraceTheoryState, white), false);
assert.equal(amiba.countTraceMarkers(stateTraceTheoryState, white, "blue"), 2);
assert.equal(amiba.getTheoryTaskReward(stateTraceTheoryState).emptyCount, 12);

assert.equal(amiba.createAlienCard(5, 1).cardTypeCode, 3);
assert.equal(amiba.getFinalTraceTypeForCard(amiba.createAlienCard(6, 2)), "yellow");
// 打出效果统一来自卡表模型 playEffects（species buildImmediateEffects 已迁入 MODELS）。
const amiba9Play = cardEffects.getCardModel("amiba_9.webp").playEffects;
assert.equal(amiba9Play[0].type, "launch");
assert.equal(amiba9Play[1].type, amiba.EFFECT_TYPES.CHOOSE_SYMBOL_REWARD);


// Restoring canonical JSON may reorder object keys. Legacy trace IDs must
// depend on trace type, not on whether the host has saved/restored the root.
const migrationOrders = [
  ["blue", "pink", "yellow"], ["blue", "yellow", "pink"],
  ["pink", "blue", "yellow"], ["pink", "yellow", "blue"],
  ["yellow", "blue", "pink"], ["yellow", "pink", "blue"],
];
let canonicalMigration = null;
for (const order of migrationOrders) {
  const legacy = createState();
  legacy.aliens[1].traces = Object.fromEntries(order.map(type => [type, {
    firstPlaced: true, ownerPlayerColor: "white", extraCount: 0,
  }]));
  amiba.initializeAmibaReveal(legacy, 1, white, () => 0);
  let sequence = 6;
  assert.equal(amiba.migrateLegacyTraces(legacy, 1, { takeSequence: () => sequence++ }), 3);
  const migrated = Object.fromEntries(["blue", "pink", "yellow"].map(type => [type,
    amiba.listTraceEntries(legacy, 1, type).find(entry => entry.position === 1),
  ]));
  assert.deepEqual(Object.fromEntries(Object.entries(migrated).map(([type, entry]) => [type, entry.sequence])),
    { blue: 6, pink: 7, yellow: 8 }, `migration key order ${order}`);
  if (canonicalMigration) assert.deepEqual(migrated, canonicalMigration);
  else canonicalMigration = migrated;
  assert.equal(amiba.migrateLegacyTraces(legacy, 1, { takeSequence: () => { throw Error("idempotent migration allocated an ID"); } }), 0);
  assert.equal(sequence, 9);
}

console.log("amiba.test.js: all tests passed");

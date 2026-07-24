"use strict";

const assert = require("node:assert/strict");
const stateStore = require("../../game/state/state-store");
const projectionApi = require("./projection-adapter");
const inputApi = require("./input-adapter");
const viewStateApi = require("./view-state-store");

const committed = {
  meta: {
    schemaVersion: stateStore.SCHEMA_VERSION,
    stateVersion: 0,
    gameId: "browser-host-test",
    rulesetVersion: "test",
    seed: "fixed",
    rngState: {},
    sequences: {},
  },
  match: {},
  turn: { roundNumber: 1, turnNumber: 1, currentPlayerId: "p1" },
  players: {
    currentPlayerId: "p1",
    players: [
      { id: "p1", resources: {}, hand: [{ id: "own" }], reservedCards: [] },
      { id: "p2", resources: {}, hand: [{ id: "hidden" }], reservedCards: [] },
    ],
  },
  solarSystem: {},
  pieces: {},
  planets: {},
  data: {},
  cards: { publicCards: [], drawPileCardIds: ["secret"] },
  tech: {},
  aliens: {},
  finalScoring: {},
};

const projection = projectionApi.createBrowserProjectionAdapter({
  stateStore: stateStore.createStateStore(committed),
}).projectCommitted({
  viewer: { viewerId: "viewer:p1", playerId: "p1", role: "player" },
});

assert.equal(Object.isFrozen(projection), true);
assert.equal(projection.players.p1.hand[0].id, "own");
assert.equal(Object.hasOwn(projection.players.p2, "hand"), false);
assert.equal(JSON.stringify(projection).includes("secret"), false);
assert.throws(() => { projection.match.round = 99; }, TypeError);

const viewState = viewStateApi.createViewStateStore();
let submitted = null;
const adapter = inputApi.createBrowserInputAdapter({
  dispatchAction(action) {
    submitted = structuredClone(action);
    return { ok: true };
  },
  submitDecision() {
    return { ok: true };
  },
  viewStateStore: viewState,
});
const action = {
  schemaVersion: "seti-standard-action-v1",
  actionId: "pass:p1",
  family: "pass",
  phase: "main",
  actorId: "p1",
  stateVersion: 0,
  decisionVersion: 0,
  target: { kind: "pass" },
  payload: {},
  summary: "PASS",
};
assert.equal(adapter.dispatchAction(action).ok, true);
assert.deepEqual(submitted, action);
assert.equal(Object.hasOwn(adapter, "stateSourcePort"), false);

console.log("browser host tests passed");

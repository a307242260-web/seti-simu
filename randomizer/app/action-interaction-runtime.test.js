"use strict";

const assert = require("node:assert/strict");
const { createActionInteractionRuntime } = require("./action-interaction-runtime");

const runtime = createActionInteractionRuntime({
  cardEffects: {
    getCardModel: (card) => ({ pluto: card?.kind === "pluto" }),
    getCardId: (card) => card?.id,
    ensureCardEffectState(card) {
      card.cardEffectState ||= {
        modelCardId: card.id,
        consumedTriggerIds: [],
        completedTaskIds: [],
      };
      return card.cardEffectState;
    },
  },
  markerBelongsToPlayer: (marker, player) => marker.playerId === player.id,
  markerOwnerLabel: () => "玩家",
  players: {
    getCurrentPlayer: (playerState) => playerState.players
      .find((player) => player.id === playerState.currentPlayerId),
  },
  rocketActions: {
    getRocketSectorCoordinate: (rocket) => rocket.coordinate,
  },
});

const createRoot = (suffix) => ({
  playerState: {
    currentPlayerId: `p-${suffix}`,
    players: [{
      id: `p-${suffix}`,
      color: suffix,
      reservedCards: [{
        id: `pluto-${suffix}`,
        kind: "pluto",
        cardEffectState: {
          modelCardId: `pluto-${suffix}`,
          consumedTriggerIds: [],
          completedTaskIds: [],
          pluto: {
            orbitMarkers: [{ kind: "orbit", sequence: 1, playerId: `p-${suffix}` }],
            landingMarkers: [],
          },
        },
      }],
    }],
  },
  rocketState: {
    activeRocketId: 1,
    rockets: [{ id: 1, playerId: `p-${suffix}`, coordinate: { x: 0, y: 4 } }],
  },
  cardState: {},
});

assert.throws(() => runtime.collectPlutoMarkers(), /explicit workingRoot/);
assert.throws(() => runtime.getPlutoCandidateRockets(), /explicit workingRoot/);

const rootA = createRoot("a");
const rootB = createRoot("b");
assert.deepEqual(runtime.collectPlutoMarkers(rootA).map((marker) => marker.cardId), ["pluto-a"]);
assert.deepEqual(runtime.collectPlutoMarkers(rootB).map((marker) => marker.cardId), ["pluto-b"]);
assert.deepEqual(runtime.getPlutoCandidateRockets(rootB).map((rocket) => rocket.playerId), ["p-b"]);

const rootABefore = structuredClone(rootA);
const removal = runtime.removePlutoMarker(rootB, {
  cardId: "pluto-b",
  kind: "plutoOrbit",
  sequence: 1,
}, rootB.playerState.players[0]);
assert.equal(removal.ok, true);
assert.equal(runtime.collectPlutoMarkers(rootB).length, 0);
assert.deepEqual(rootA, rootABefore, "隔离 workingRoot 操作不得污染另一份 root");

console.log("action-interaction-runtime tests passed");

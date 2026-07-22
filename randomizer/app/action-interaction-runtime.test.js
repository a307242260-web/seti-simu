"use strict";

const assert = require("node:assert/strict");
const { createActionInteractionRuntime, createBoardPointerHandlers } = require("./action-interaction-runtime");

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

{
  const calls = [];
  let highlightedRocketId = null;
  const handlers = createBoardPointerHandlers({
    getRocketState: () => ({ rockets: [{ id: 7 }] }),
    getHighlightedRocketId: () => highlightedRocketId,
    isAiInputLocked: () => false,
    blockManualInput: () => calls.push("blocked"),
    isPlanetMarkerRocket: () => false,
    activateMoveMode: (rocketId) => {
      calls.push(`activate:${rocketId}`);
      highlightedRocketId = rocketId;
      return true;
    },
    hasBlockingMoveDecision: () => false,
    deactivateMoveMode: () => {
      calls.push("deactivate");
      highlightedRocketId = null;
    },
    renderStateReadout: () => calls.push("render"),
  });
  const rocketEvent = {
    button: 0,
    currentTarget: { dataset: { rocketId: "7" } },
    preventDefault: () => calls.push("prevent"),
    stopPropagation: () => calls.push("stop"),
  };
  handlers.handleRocketPointerDown(rocketEvent);
  handlers.handleBoardPointerDown({
    button: 0,
    target: { closest: () => null },
    preventDefault() {},
  });
  assert.deepEqual(calls, ["stop", "activate:7", "prevent", "deactivate", "render"]);
}

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

{
  const resumed = [];
  const dataRuntime = createActionInteractionRuntime({
    abilities: {
      data: {
        listPlacementChoices: () => ({ ok: true, choices: [{ target: "computer", label: "电脑", description: "放置" }] }),
        needsPlacementChoice: () => true,
      },
    },
    data: {
      ensurePlayerDataState: (player) => player.dataState,
      canPlaceAnyData: () => ({ ok: true, choices: [{ target: "computer" }] }),
      listPlaceDataChoices: () => [{ target: "computer" }],
    },
    players: {
      RESOURCE_LIMITS: { availableData: 1 },
      getCurrentPlayer: (playerState) => playerState.players[0],
    },
    getPendingOwnerFields: (_effect, player) => ({ playerId: player.id }),
    els: {},
    renderStateReadout() {},
    resumeDataPlacementContinuation: (...args) => {
      resumed.push(args);
      return { ok: true, resumed: true };
    },
  });
  const workingRoot = {
    match: {},
    playerState: { players: [{ id: "p1", dataState: { poolTokens: [{}] } }], currentPlayerId: "p1" },
    rocketState: { statusNote: "" },
    cardState: {},
  };
  const effect = { id: "gain-data", label: "获得数据", options: { count: 1 } };
  const opened = dataRuntime.openAutoDataPlacementPrompt(workingRoot, effect, workingRoot.playerState.players[0], {
    resumeKind: "gain-data-reward",
  });
  assert.equal(opened.awaitingDataPlacement, true);
  assert.equal(workingRoot.match.dataPlacementContinuation.resumeKind, "gain-data-reward");
  assert.doesNotMatch(JSON.stringify(workingRoot.match.dataPlacementContinuation), /onAfterPlacement|onSkip/);
  const skipped = dataRuntime.skipPendingDataPlacement(workingRoot);
  assert.equal(skipped.resumed, true);
  assert.equal(workingRoot.match.dataPlacementContinuation, undefined);
  assert.equal(resumed[0][2].skipped, true);
}

console.log("action-interaction-runtime tests passed");

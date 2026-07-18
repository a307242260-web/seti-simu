"use strict";

const aomomo = require("../game/aliens/aomomo");
const banrenma = require("../game/aliens/banrenma");
const chong = require("../game/aliens/chong");
const yichangdian = require("../game/aliens/yichangdian");

function makeHiddenAlienSlot(traceOwners = {}) {
  const traces = {};
  for (const traceType of ["yellow", "pink", "blue"]) {
    const owner = traceOwners[traceType] || null;
    traces[traceType] = {
      firstPlaced: Boolean(owner),
      ownerPlayerId: owner?.id || null,
      ownerPlayerColor: owner?.color || owner || null,
      extraCount: 0,
    };
  }
  return { revealed: false, traces };
}

function makeChongTransportAlienState(options = {}) {
  const rocketId = String(options.rocketId || 77);
  const fossilId = options.fossilId || "fossil_02";
  const destinationPlanetId = options.destinationPlanetId || "earth";
  const chongState = chong.createChongState();
  chongState.fossilsById[fossilId] = {
    fossilId,
    status: "transported",
    location: "transported",
    destinationPlanetId,
    fossilRewardRepeat: options.fossilRewardRepeat ?? 1,
    taskGain: { ...(options.taskGain || {}) },
    taskDataCount: options.taskDataCount || 0,
    taskPickCard: Boolean(options.taskPickCard),
  };
  chongState.transportTasksByRocketId[rocketId] = {
    fossilId,
    destinationPlanetId,
    cardId: options.cardId || "chong-test",
  };
  return {
    aliens: {
      1: { revealed: true, alienId: chong.ALIEN_ID, assignedAlienId: chong.ALIEN_ID },
    },
    chong: chongState,
  };
}

function makeChongAvailableFossilAlienState(options = {}) {
  const fossilId = options.fossilId || "fossil_02";
  const planetId = options.planetId || "jupiter";
  const chongState = chong.createChongState();
  chongState.revealedSlotId = 1;
  chongState.planetFossilIds = { jupiter: [], saturn: [] };
  chongState.planetFossilIds[planetId] = [fossilId];
  chongState.fossilsById[fossilId] = {
    fossilId,
    status: "available",
    location: "planet",
    planetId,
    visibleToPlayerIds: [],
  };
  return {
    aliens: {
      1: { revealed: true, alienId: chong.ALIEN_ID, assignedAlienId: chong.ALIEN_ID },
    },
    chong: chongState,
  };
}
function makeBanrenmaAlienState() {
  const alienGameState = {
    aliens: {
      1: { revealed: true, alienId: banrenma.ALIEN_ID, assignedAlienId: banrenma.ALIEN_ID },
    },
    banrenma: banrenma.createBanrenmaState(),
  };
  banrenma.ensureTraceGrid(alienGameState, 1);
  return alienGameState;
}

function makeAomomoAlienState() {
  const alienGameState = {
    aliens: {
      1: { revealed: true, alienId: aomomo.ALIEN_ID, assignedAlienId: aomomo.ALIEN_ID },
    },
    aomomo: aomomo.createAomomoState(),
  };
  aomomo.ensureTraceGrid(alienGameState, 1);
  return alienGameState;
}

function makeYichangdianAlienState(options = {}) {
  const yState = yichangdian.createYichangdianState();
  yState.revealedSlotId = 1;
  yState.revealInitialized = true;
  yState.anomalies = options.anomalies || [
    { markerId: "a_2", traceType: "pink", sectorX: 6, y: 4, triggeredCount: 0 },
    { markerId: "b_1", traceType: "yellow", sectorX: 4, y: 4, triggeredCount: 0 },
    { markerId: "c_2", traceType: "blue", sectorX: 0, y: 4, triggeredCount: 0 },
  ];
  const alienGameState = {
    aliens: {
      1: { revealed: true, alienId: yichangdian.ALIEN_ID, assignedAlienId: yichangdian.ALIEN_ID },
    },
    yichangdian: yState,
  };
  yichangdian.ensureTraceGrid(alienGameState, 1);
  return alienGameState;
}

module.exports = {
  makeAomomoAlienState,
  makeBanrenmaAlienState,
  makeChongAvailableFossilAlienState,
  makeChongTransportAlienState,
  makeHiddenAlienSlot,
  makeYichangdianAlienState,
};

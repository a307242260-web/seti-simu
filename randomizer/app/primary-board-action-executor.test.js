"use strict";

const assert = require("node:assert/strict");
require("../solar-system/layout");
require("../solar-system/core");
require("../game/players");
require("../game/rockets");
require("../game/planet-reference-layout");
require("../game/planet-stats");
require("../game/aliens/aomomo");
require("../game/actions/shared");
require("../game/actions/launch");
require("../game/actions/orbit");
require("../game/actions/land");
require("../game/tech/catalog");
require("../game/tech/board-state");
require("../game/tech/player-tech");
require("../game/tech/placement");
require("../game/tech/bonuses");
require("../game/tech/resolver");
require("../game/basic-cards");
require("../game/tech/index");
require("../game/actions/research-tech");
require("../game/history/commands");
require("../game/abilities/rocket");
require("../game/abilities/index");

const solar = require("../solar-system/core");
const players = require("../game/players");
const rockets = require("../game/rockets");
const planetStats = require("../game/planet-stats");
const tech = require("../game/tech/index");
const actions = require("../game/actions/index");
const abilities = require("../game/abilities/index");
const { createPrimaryBoardActionExecutor, ACTION_FAMILIES } = require("./primary-board-action-executor");

function createRoot() {
  const playerState = players.createPlayerState({
    currentPlayer: {
      color: "white",
      resources: { credits: 20, energy: 20, publicity: 0 },
    },
  });
  return {
    meta: { stateVersion: 0 },
    match: {},
    turnState: { roundNumber: 1, turnNumber: 1 },
    playerState,
    solarState: solar.createBaselineState(),
    rocketState: rockets.createRocketState(),
    planetStatsState: planetStats.createPlanetStatsState(),
    nebulaDataState: {},
    cardState: {},
    techGameState: tech.createState(),
    alienGameState: {},
    finalScoringState: {},
  };
}

function descriptor(root, family, target = null) {
  return {
    schemaVersion: "seti-standard-action-v1",
    family,
    phase: family === "move" ? "quick" : "main",
    actionId: `${family}:test`,
    actorId: root.playerState.currentPlayerId,
    stateVersion: 0,
    decisionVersion: 0,
    target,
    payload: {},
    summary: family,
  };
}

function placeRocketAt(root, planetId) {
  const player = players.getCurrentPlayer(root.playerState);
  const planet = solar.createSolarSnapshot(root.solarState).planetLocations
    .find((item) => item.planetId === planetId);
  const result = rockets.launchRocketAtSector(root.rocketState, planet, {
    playerId: player.id,
    color: player.color,
  });
  assert.equal(result.ok, true);
  return result.rocket;
}

const executor = createPrimaryBoardActionExecutor({ actions, abilities, solar });
assert.deepEqual(executor.actionFamilies, ACTION_FAMILIES);

{
  const root = createRoot();
  const result = executor.execute(root, descriptor(root, "launch"));
  assert.equal(result.ok, true);
  assert.equal(root.rocketState.rockets.length, 1);
  assert.equal(players.getCurrentPlayer(root.playerState).resources.credits, 18);
}

{
  const root = createRoot();
  const rocket = placeRocketAt(root, "earth");
  const beforeX = rocket.sectorX;
  const beforeEnergy = players.getCurrentPlayer(root.playerState).resources.energy;
  const result = executor.execute(
    root,
    descriptor(root, "move", { rocketId: rocket.id, deltaX: 1, deltaY: 0 }),
    { executionOptions: { cost: { energy: 1 }, movementPoints: 1 } },
  );
  assert.equal(result.ok, true);
  assert.equal(players.getCurrentPlayer(root.playerState).resources.energy, beforeEnergy - 1);
  assert.equal(root.rocketState.rockets[0].sectorX, (beforeX + 1) % 8);
}

for (const family of ["orbit", "land"]) {
  const root = createRoot();
  const rocket = placeRocketAt(root, "mars");
  const target = family === "orbit"
    ? { rocketId: rocket.id, planetId: "mars" }
    : { rocketId: rocket.id, planetId: "mars", type: "planet" };
  const result = executor.execute(root, descriptor(root, family, target));
  assert.equal(result.ok, true, result.message);
  assert.equal(root.rocketState.rockets.length, 0);
  const count = family === "orbit"
    ? planetStats.getPlanetOrbitCount(root.planetStatsState, "mars")
    : planetStats.getPlanetLandingCount(root.planetStatsState, "mars");
  assert.equal(count, 1);
}

{
  const root = createRoot();
  const before = structuredClone(root);
  const stale = executor.execute(root, descriptor(root, "launch"), {
    validate() { return { ok: false, code: "STANDARD_ACTION_STALE", message: "stale" }; },
  });
  assert.equal(stale.code, "STANDARD_ACTION_STALE");
  assert.deepEqual(root, before, "stale 前后完整 working root 必须不变");
}

{
  const root = createRoot();
  placeRocketAt(root, "earth");
  const before = structuredClone(root);
  const failed = executor.execute(root, descriptor(root, "launch"));
  assert.equal(failed.ok, false);
  assert.deepEqual(root, before, "规则失败前后完整 working root 必须不变");
}

{
  const browserRoot = createRoot();
  const aiRoot = structuredClone(browserRoot);
  const browserAction = descriptor(browserRoot, "launch");
  const aiAction = structuredClone(browserAction);
  const browserResult = executor.execute(browserRoot, browserAction);
  const aiResult = executor.execute(aiRoot, aiAction);
  assert.equal(browserResult.ok, true);
  assert.equal(aiResult.ok, true);
  assert.deepEqual(aiRoot, browserRoot, "Browser/AI 同 descriptor 必须落到同一生产行为");
}

console.log("primary board action executor tests passed");

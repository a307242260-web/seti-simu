"use strict";

const assert = require("node:assert/strict");
require("../../solar-system/layout");
require("../../solar-system/core");
require("../players");
require("../rockets");
require("../planet-reference-layout");
require("../planet-stats");
require("../aliens/aomomo");
require("./shared");
require("../tech/catalog");
require("../tech/board-state");
require("../tech/player-tech");
require("../tech/placement");
require("../tech/bonuses");
require("../tech/resolver");
require("../basic-cards");
require("../tech/index");

const solar = require("../../solar-system/core");
const players = require("../players");
const rockets = require("../rockets");
const planetStats = require("../planet-stats");
const tech = require("../tech/index");
const basicCards = require("../basic-cards");
const launch = require("./launch");
const orbit = require("./orbit");
const land = require("./land");
const researchTech = require("./research-tech");
const standardAction = require("./standard-action");

const REFERENCE_ACTIONS = { launch, orbit, land, researchTech };

function createContext({ planetIds = [], satelliteTech = false } = {}) {
  const solarState = solar.createBaselineState();
  const techGameState = tech.createState();
  const playerState = players.createPlayerState({
    currentPlayer: {
      color: "white",
      resources: { credits: 20, energy: 20, publicity: 20 },
    },
  });
  const rocketState = rockets.createRocketState();
  const planetStatsState = planetStats.createPlanetStatsState();
  const context = {
    solarState,
    playerState,
    rocketState,
    planetStatsState,
    techGameState,
    techBoardState: techGameState.board,
    techUiState: techGameState.ui,
    stateVersion: 11,
    decisionVersion: 5,
    rngCursor: 19,
    history: [{ type: "checkpoint" }],
    replay: [{ step: 0 }],
    getEarthSectorCoordinate() {
      const earth = solar.createSolarSnapshot(solarState).planetLocations.find((item) => item.planetId === "earth");
      return { x: earth.x, y: earth.y };
    },
    getPlanetLocations() {
      return solar.createSolarSnapshot(solarState).planetLocations;
    },
    rotateSolarOrbit(count) {
      solarState.rotation = solar.applySolarOrbitRotation(solarState.rotation, count || 1);
      solarState.wheelSteps = solar.rotationToWheelSteps(solarState.rotation);
      return { ok: true, message: "太阳系旋转" };
    },
    drawBasicCardToPlayer(player) {
      return basicCards.drawRandomBasicCardToHand(player.hand);
    },
    ensurePlayerTechState(player) {
      if (!player.techState) player.techState = players.normalizePlayerTechState(null);
    },
  };
  const currentPlayer = players.getCurrentPlayer(playerState);
  if (satelliteTech) currentPlayer.techState.ownedTiles.orange4 = true;
  for (const planetId of planetIds) {
    const planet = context.getPlanetLocations().find((item) => item.planetId === planetId);
    assert.ok(planet, `missing planet ${planetId}`);
    const result = rockets.launchRocketAtSector(rocketState, planet, {
      playerId: currentPlayer.id,
      color: currentPlayer.color,
    });
    assert.equal(result.ok, true, result.message);
  }
  return context;
}

function authority(context) {
  return {
    actorId: players.getCurrentPlayer(context.playerState)?.id || null,
    stateVersion: context.stateVersion,
    decisionVersion: context.decisionVersion,
  };
}

function createRegistry() {
  return standardAction.createReferenceRegistry(REFERENCE_ACTIONS, { getAuthority: authority });
}

function snapshot(context) {
  return structuredClone({
    solarState: context.solarState,
    playerState: context.playerState,
    rocketState: context.rocketState,
    planetStatsState: context.planetStatsState,
    techBoardState: context.techBoardState,
    techUiState: context.techUiState,
    rngCursor: context.rngCursor,
    history: context.history,
    replay: context.replay,
  });
}

const registry = createRegistry();
const coverage = registry.coverage();
assert.deepEqual(
  coverage.filter((entry) => entry.registered).map((entry) => entry.family),
  ["launch", "orbit", "land", "research_tech"],
);

const orbitContext = createContext({ planetIds: ["mars", "jupiter"] });
const orbitActions = registry.enumerate(orbitContext, { family: "orbit" });
assert.equal(orbitActions.length, 2);
assert.deepEqual(new Set(orbitActions.map((action) => action.target.planetId)), new Set(["mars", "jupiter"]));

const landContext = createContext({ planetIds: ["jupiter"], satelliteTech: true });
const landActions = registry.enumerate(landContext, { family: "land" });
assert.ok(landActions.length >= 2, "主星与卫星应分别成为语义 action");
assert.ok(landActions.some((action) => action.target.type === "planet"));
assert.ok(landActions.some((action) => action.target.type === "satellite"));

const researchContext = createContext();
const researchActions = registry.enumerate(researchContext, { family: "research_tech" });
assert.ok(researchActions.length > 3);
const blueOneActions = researchActions.filter((action) => action.target.tileId === "blue1");
assert.ok(blueOneActions.length > 1, "每个可用蓝槽应成为独立、稳定的目标");
assert.equal(new Set(blueOneActions.map((action) => action.target.blueSlot)).size, blueOneActions.length);

{
  const selectionContext = createContext();
  const selectionRegistry = createRegistry();
  const selectionActions = selectionRegistry.enumerate(selectionContext, {
    family: "research_tech",
    payload: { selectionOnly: true, skipCost: true, techTypes: ["orange"] },
  });
  assert.ok(selectionActions.length, "科技效果内的 selection-only 请求应产生候选");
  assert.ok(selectionActions.every((action) => action.payload.selectionOnly === true));
  const selectionResult = selectionRegistry.execute(selectionContext, selectionActions[0]);
  assert.equal(selectionResult.ok, true, selectionResult.message);
  assert.equal(selectionResult.payload.techType, "orange");
}

for (const scenario of [
  { family: "launch", create: () => createContext() },
  { family: "orbit", create: () => createContext({ planetIds: ["mars", "jupiter"] }) },
  { family: "land", create: () => createContext({ planetIds: ["jupiter"], satelliteTech: true }) },
  { family: "research_tech", create: () => createContext() },
]) {
  const checkpoint = scenario.create();
  const candidates = createRegistry().enumerate(checkpoint, { family: scenario.family });
  assert.ok(candidates.length, `${scenario.family} should enumerate candidates`);
  for (const candidate of candidates) {
    const fork = scenario.create();
    const result = createRegistry().execute(fork, candidate);
    assert.equal(result.ok, true, `${scenario.family}/${candidate.actionId}: ${result.message}`);
  }
}

{
  const context = createContext({ planetIds: ["mars", "jupiter"] });
  const action = createRegistry().enumerate(context, { family: "orbit" })[0];
  const before = snapshot(context);
  assert.equal(createRegistry().execute(context, { ...action, stateVersion: action.stateVersion - 1 }).code, "STANDARD_ACTION_STALE");
  assert.deepEqual(snapshot(context), before, "stale rejection must not change state/RNG/history/replay");
  assert.equal(createRegistry().execute(context, { ...action, actorId: "other-player" }).code, "STANDARD_ACTION_ACTOR_MISMATCH");
  assert.deepEqual(snapshot(context), before, "actor rejection must not change state/RNG/history/replay");
  const tampered = { ...action, target: { ...action.target, rocketId: 999999 } };
  assert.equal(createRegistry().execute(context, tampered).code, "STANDARD_ACTION_NOT_LEGAL");
  assert.deepEqual(snapshot(context), before, "target tampering must not change state/RNG/history/replay");
}

{
  const browserContext = createContext({ planetIds: ["mars", "jupiter"] });
  const headlessContext = createContext({ planetIds: ["mars", "jupiter"] });
  headlessContext.techBoardState = structuredClone(browserContext.techBoardState);
  headlessContext.techGameState.board = headlessContext.techBoardState;
  const browser = standardAction.createRegistryAdapter(createRegistry());
  const headless = standardAction.createRegistryAdapter(createRegistry());
  const action = browser.enumerate(browserContext, { family: "orbit" })
    .find((candidate) => candidate.target.planetId === "jupiter");
  assert.ok(action);
  assert.deepEqual(action, headless.enumerate(headlessContext, { family: "orbit" })
    .find((candidate) => candidate.actionId === action.actionId));
  const browserResult = browser.execute(browserContext, action);
  const headlessResult = headless.execute(headlessContext, action);
  assert.equal(browserResult.ok, true, browserResult.message);
  assert.deepEqual(
    { ...headlessResult, commands: headlessResult.commands?.map(({ undo: _undo, ...command }) => command) },
    { ...browserResult, commands: browserResult.commands?.map(({ undo: _undo, ...command }) => command) },
  );
  assert.deepEqual(snapshot(headlessContext), snapshot(browserContext));
}

assert.equal(
  standardAction.createRegistryAdapter(createRegistry()).resolveIntent(
    createContext({ planetIds: ["mars", "jupiter"] }), "orbit", {},
  ).code,
  "STANDARD_ACTION_AMBIGUOUS",
  "intent resolver 不得在多目标时默认取第一项",
);

console.log("standard-action four-reference tests passed");

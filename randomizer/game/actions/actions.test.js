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
require("../cards/deck");
require("../tech/index");
require("./research-tech");
require("../abilities");
require("../state/sequences");

const solar = require("../../solar-system/core");
const tech = require("../tech/index");
const players = require("../players");
const cards = require("../cards/deck");
const rockets = require("../rockets");
const planetStats = require("../planet-stats");
const aomomo = require("../aliens/aomomo");
const abilities = require("../abilities");
const researchTech = require("./research-tech");

function drawBasicCardToHand(hand) {
  const existing = new Set(hand.map((card) => card.cardId));
  const entry = cards.CARD_CATALOG.find((card) => card.set === "basic" && !existing.has(card.card_id));
  const card = cards.createCardInstance(entry, hand.length + 1);
  hand.push(card);
  return { ok: true, card };
}

function createContext(overrides) {
  const solarSystemState = solar.createBaselineState();
  const techGameState = tech.createState();
  const playersState = players.createPlayerState({
    currentPlayer: {
      color: "white",
      resources: { credits: 10, energy: 10, publicity: 10 },
    },
  });
  const piecesState = rockets.createRocketState();
  const planetsState = planetStats.createPlanetStatsState();

  const base = {
    meta: { sequences: { alienEntity: 1, rocket: 1 } },
    solarSystem: solarSystemState,
    players: playersState,
    pieces: piecesState,
    planets: planetsState,
    tech: techGameState,
    turn: { currentPlayerId: playersState.players[0].id },
    getEarthSectorCoordinate() {
      const snapshot = solar.createSolarSnapshot(solarSystemState);
      const earth = snapshot.planetLocations.find((planet) => planet.planetId === "earth");
      return { x: earth.x, y: earth.y };
    },
    getPlanetLocations() {
      return solar.createSolarSnapshot(solarSystemState).planetLocations;
    },
    rotateSolarOrbit(count) {
      solarSystemState.rotation = solar.applySolarOrbitRotation(solarSystemState.rotation, count || 1);
      solarSystemState.wheelSteps = solar.rotationToWheelSteps(solarSystemState.rotation);
    },
    drawBasicCardToPlayer(player) {
      return drawBasicCardToHand(player.hand);
    },
    beginCardSelection() {
      return { ok: true, message: "精选：从公共牌区选一张牌，或点击盲抽" };
    },
    ensurePlayerTechState(player) {
      if (!player.techState) player.techState = players.normalizePlayerTechState(null);
    },
  };

  const context = { ...base, ...overrides };
  // 能力层（launchProbe/orbitProbe/landProbe）的实体序列从 context.state 读取；
  // 测试夹具以自身作为 root，与 production kernel 的 actionContext({ state: root }) 对齐。
  context.state = context.state || context;
  return context;
}

function launchToPlanet(context, planetId) {
  const launch = abilities.executeAbility("launchProbe", context, { source: "test" });
  assert.equal(launch.ok, true);

  const planet = context.getPlanetLocations().find((item) => item.planetId === planetId);
  assert.ok(planet, `planet ${planetId} not found`);

  const moveResult = rockets.moveActiveRocket(context.pieces, planet.x - launch.rocket.sectorX, planet.y - launch.rocket.sectorY);
  assert.equal(moveResult.ok, true, moveResult.message);
  return { launch, planet, rocket: moveResult.rocket };
}

function createAomomoVisibleContextWithStalePlanetList() {
  const context = createContext({
    aliens: {
      aliens: {
        1: { revealed: true, alienId: aomomo.ALIEN_ID, assignedAlienId: aomomo.ALIEN_ID },
      },
      aomomo: aomomo.createAomomoState(),
    },
  });
  context.solarSystem.aomomoActive = true;
  const currentPlayer = players.getCurrentPlayer(context.players);
  aomomo.initializeAomomoReveal(context.aliens, 1, currentPlayer);
  const planet = solar.createSolarSnapshot(context.solarSystem)
    .planetLocations
    .find((item) => item.planetId === aomomo.PLANET_ID);
  assert.ok(planet, "aomomo planet should be visible in the solar snapshot");
  const launch = rockets.launchRocketAtSector(context.pieces, planet, {
    playerId: currentPlayer.id,
    color: currentPlayer.color,
    root: context,
  });
  assert.equal(launch.ok, true, launch.message);
  context.getPlanetLocations = () => solar.createSolarSnapshot(context.solarSystem)
    .planetLocations
    .filter((item) => item.planetId !== aomomo.PLANET_ID);
  return context;
}

// 统一发射引擎：abilities.rocket.launchProbe（与行星奖励/卡牌来源同一实现）
const context = createContext();
const launchResult = abilities.executeAbility("launchProbe", context, { source: "test" });
assert.equal(launchResult.ok, true);
assert.equal(launchResult.rocket.playerSequence, 1);
assert.equal(players.getCurrentPlayer(context.players).resources.credits, 8);
const blockedSecondLaunch = abilities.executeAbility("launchProbe", context, { source: "test" });
assert.equal(blockedSecondLaunch.ok, false);
assert.match(blockedSecondLaunch.message, /火箭数量已达上限/);

const orange1LaunchContext = createContext();
players.getCurrentPlayer(orange1LaunchContext.players).techState.ownedTiles.orange1 = true;
assert.equal(abilities.executeAbility("launchProbe", orange1LaunchContext, { source: "test" }).ok, true);
assert.equal(abilities.executeAbility("launchProbe", orange1LaunchContext, { source: "test" }).ok, true);
assert.equal(orange1LaunchContext.pieces.rockets.length, 2);

const noRocketContext = createContext();
const blockedOrbit = abilities.executeAbility("orbitProbe", noRocketContext, { source: "test" });
assert.equal(blockedOrbit.ok, false);
assert.match(blockedOrbit.message, /当前火箭/);

// 统一环绕引擎：abilities.planet.orbitProbe
const marsContext = createContext();
launchToPlanet(marsContext, "mars");
const orbitResult = abilities.executeAbility("orbitProbe", marsContext, { source: "test" });
assert.equal(orbitResult.ok, true);
assert.equal(marsContext.pieces.rockets.length, 0);
assert.equal(planetStats.getPlanetOrbitCount(marsContext.planets, "mars"), 1);
assert.equal(players.getCurrentPlayer(marsContext.players).orbitCount, 1);
assert.equal(players.getCurrentPlayer(marsContext.players).resources.credits, 7);
assert.equal(players.getCurrentPlayer(marsContext.players).resources.energy, 9);

const fullOrbitContext = createContext();
for (let index = 0; index < 5; index += 1) {
  assert.equal(planetStats.addPlanetOrbitMarker(fullOrbitContext.planets, "mars", players.getCurrentPlayer(fullOrbitContext.players)).ok, true);
}
launchToPlanet(fullOrbitContext, "mars");
assert.equal(abilities.planet.getOrbitOptions(fullOrbitContext).ok, true);
const overflowOrbit = abilities.executeAbility("orbitProbe", fullOrbitContext, { source: "test" });
assert.equal(overflowOrbit.ok, true, overflowOrbit.message);
assert.equal(overflowOrbit.markerSequence, 6);
assert.equal(planetStats.getPlanetOrbitMarkers(fullOrbitContext.planets, "mars")[5].displayed, false);

const inactiveOrbitContext = createContext();
launchToPlanet(inactiveOrbitContext, "mars");
inactiveOrbitContext.pieces.activeRocketId = null;
const inactiveOrbitCheck = abilities.planet.getOrbitOptions(inactiveOrbitContext);
assert.equal(inactiveOrbitCheck.ok, true);
const inactiveOrbitResult = abilities.executeAbility("orbitProbe", inactiveOrbitContext, { source: "test" });
assert.equal(inactiveOrbitResult.ok, true);
assert.equal(planetStats.getPlanetOrbitCount(inactiveOrbitContext.planets, "mars"), 1);

const multiOrbitContext = createContext();
players.getCurrentPlayer(multiOrbitContext.players).techState.ownedTiles.orange1 = true;
const multiOrbitMars = launchToPlanet(multiOrbitContext, "mars").rocket;
const multiOrbitVenus = launchToPlanet(multiOrbitContext, "venus").rocket;
const multiOrbitOptions = abilities.planet.getOrbitOptions(multiOrbitContext);
assert.equal(multiOrbitOptions.ok, true);
assert.equal(multiOrbitOptions.needsChoice, true);
const selectedOrbit = abilities.executeAbility("orbitProbe", multiOrbitContext, { rocketId: multiOrbitMars.id, source: "test" });
assert.equal(selectedOrbit.ok, true);
assert.equal(selectedOrbit.removedRocketId, multiOrbitMars.id);
assert.equal(planetStats.getPlanetOrbitCount(multiOrbitContext.planets, "mars"), 1);
assert.equal(planetStats.getPlanetOrbitCount(multiOrbitContext.planets, "venus"), 0);
assert.equal(multiOrbitContext.pieces.rockets.some((rocket) => rocket.id === multiOrbitVenus.id), true);

const aomomoOrbitContext = createAomomoVisibleContextWithStalePlanetList();
const aomomoOrbitOptions = abilities.planet.getOrbitOptions(aomomoOrbitContext);
assert.equal(aomomoOrbitOptions.ok, true, aomomoOrbitOptions.message);
assert.equal(aomomoOrbitOptions.defaultRocketId, aomomoOrbitContext.pieces.rockets[0].id);
assert.equal(aomomoOrbitOptions.choices[0].planetId, aomomo.PLANET_ID);
const aomomoOrbitResult = abilities.executeAbility("orbitProbe", aomomoOrbitContext, { source: "test" });
assert.equal(aomomoOrbitResult.ok, true, aomomoOrbitResult.message);
assert.equal(aomomoOrbitResult.markerKind, "aomomo-orbit");
assert.equal(aomomo.countOrbitMarkers(aomomoOrbitContext.aliens), 1);

// 统一登陆引擎：abilities.planet.landProbe（与打牌登陆同一实现）
const landContext = createContext();
launchToPlanet(landContext, "venus");
const landWithoutOrbit = abilities.executeAbility("landProbe", landContext, { source: "test" });
assert.equal(landWithoutOrbit.ok, true);
assert.equal(planetStats.getPlanetLandingCount(landContext.planets, "venus"), 1);
assert.equal(players.getCurrentPlayer(landContext.players).resources.energy, 7);

const fullLandContext = createContext();
for (let index = 0; index < 5; index += 1) {
  assert.equal(planetStats.addPlanetLandingMarker(fullLandContext.planets, "venus", players.getCurrentPlayer(fullLandContext.players)).ok, true);
}
launchToPlanet(fullLandContext, "venus");
assert.equal(abilities.planet.getLandOptions(fullLandContext).ok, true);
const overflowLand = abilities.executeAbility("landProbe", fullLandContext, { source: "test" });
assert.equal(overflowLand.ok, true, overflowLand.message);
assert.equal(overflowLand.markerSequence, 6);
assert.equal(planetStats.getPlanetLandingMarkers(fullLandContext.planets, "venus")[5].displayed, false);

const inactiveLandContext = createContext();
launchToPlanet(inactiveLandContext, "venus");
inactiveLandContext.pieces.activeRocketId = null;
const inactiveLandCheck = abilities.planet.getLandOptions(inactiveLandContext);
assert.equal(inactiveLandCheck.ok, true);
const inactiveLandResult = abilities.executeAbility("landProbe", inactiveLandContext, { source: "test" });
assert.equal(inactiveLandResult.ok, true);
assert.equal(planetStats.getPlanetLandingCount(inactiveLandContext.planets, "venus"), 1);

const multiLandContext = createContext();
players.getCurrentPlayer(multiLandContext.players).techState.ownedTiles.orange1 = true;
const multiLandMars = launchToPlanet(multiLandContext, "mars").rocket;
const multiLandVenus = launchToPlanet(multiLandContext, "venus").rocket;
const multiLandOptions = abilities.planet.getLandOptions(multiLandContext);
assert.equal(multiLandOptions.ok, true);
assert.equal(multiLandOptions.needsChoice, true);
const multiLandMarsChoice = multiLandOptions.choices.find((choice) => choice.planetId === "mars" && choice.target.type === "planet");
assert.ok(multiLandMarsChoice);
const selectedLand = abilities.executeAbility("landProbe", multiLandContext, { target: multiLandMarsChoice.target, source: "test" });
assert.equal(selectedLand.ok, true);
assert.equal(selectedLand.removedRocketId, multiLandMars.id);
assert.equal(planetStats.getPlanetLandingCount(multiLandContext.planets, "mars"), 1);
assert.equal(planetStats.getPlanetLandingCount(multiLandContext.planets, "venus"), 0);
assert.equal(multiLandContext.pieces.rockets.some((rocket) => rocket.id === multiLandVenus.id), true);

const aomomoLandContext = createAomomoVisibleContextWithStalePlanetList();
const aomomoLandOptions = abilities.planet.getLandOptions(aomomoLandContext);
assert.equal(aomomoLandOptions.ok, true, aomomoLandOptions.message);
assert.equal(aomomoLandOptions.defaultTarget.rocketId, aomomoLandContext.pieces.rockets[0].id);
assert.equal(aomomoLandOptions.choices[0].planetId, aomomo.PLANET_ID);
const aomomoLandResult = abilities.executeAbility("landProbe", aomomoLandContext, { source: "test" });
assert.equal(aomomoLandResult.ok, true, aomomoLandResult.message);
assert.equal(aomomoLandResult.markerKind, "aomomo-land");
assert.equal(aomomo.countLandingMarkers(aomomoLandContext.aliens), 1);

const discountedLandContext = createContext();
launchToPlanet(discountedLandContext, "jupiter");
abilities.executeAbility("orbitProbe", discountedLandContext, { source: "test" });
launchToPlanet(discountedLandContext, "jupiter");
const discountedLand = abilities.executeAbility("landProbe", discountedLandContext, { target: { type: "planet" }, source: "test" });
assert.equal(discountedLand.ok, true);
assert.equal(discountedLand.cost.energy, 2);
assert.equal(planetStats.getPlanetLandingCount(discountedLandContext.planets, "jupiter"), 1);

const marsSatelliteContext = createContext();
players.getCurrentPlayer(marsSatelliteContext.players).techState.ownedTiles.orange4 = true;
launchToPlanet(marsSatelliteContext, "mars");
const marsSatelliteLand = abilities.executeAbility("landProbe", marsSatelliteContext, {
  target: { type: "satellite", satelliteId: "phobos-deimos" },
  source: "test",
});
assert.equal(marsSatelliteLand.ok, true);
assert.equal(marsSatelliteLand.markerKind, "satellite");
assert.equal(planetStats.getSatelliteLandingMarkers(marsSatelliteContext.planets, "mars").length, 1);
assert.equal(marsSatelliteContext.pieces.rockets.length, 0);

const orbitReuseContext = createContext();
abilities.executeAbility("launchProbe", orbitReuseContext, { source: "test" });
const firstRocketSequence = orbitReuseContext.pieces.rockets[0].playerSequence;
rockets.moveActiveRocket(
  orbitReuseContext.pieces,
  orbitReuseContext.getPlanetLocations().find((item) => item.planetId === "venus").x - orbitReuseContext.pieces.rockets[0].sectorX,
  orbitReuseContext.getPlanetLocations().find((item) => item.planetId === "venus").y - orbitReuseContext.pieces.rockets[0].sectorY,
);
abilities.executeAbility("orbitProbe", orbitReuseContext, { source: "test" });
abilities.executeAbility("launchProbe", orbitReuseContext, { source: "test" });
assert.equal(orbitReuseContext.pieces.rockets[0].playerSequence, firstRocketSequence);

const poorContext = createContext({
  players: players.createPlayerState({
    currentPlayer: {
      color: "white",
      resources: { credits: 0, energy: 0 },
    },
  }),
});
const poorLaunch = abilities.executeAbility("launchProbe", poorContext, { source: "test" });
assert.equal(poorLaunch.ok, false);
assert.match(poorLaunch.message, /资源不足/);

const researchContext = createContext();
const researchStart = researchTech.execute(researchContext);
assert.equal(researchStart.ok, true);
assert.equal(researchStart.awaitingTileSelection, true);

const blueSelectionContext = createContext();
const blueSelectionPlayer = players.getCurrentPlayer(blueSelectionContext.players);
const blueSelectionPublicity = blueSelectionPlayer.resources.publicity;
const blueSelection = researchTech.execute(blueSelectionContext, {
  tileId: "blue1",
  selectionOnly: true,
});
assert.equal(blueSelection.ok, true);
assert.equal(blueSelection.needsBlueSlotChoice, true);
assert.deepEqual(blueSelection.availableSlots, [1, 2, 3, 4]);
assert.equal(
  blueSelectionPlayer.resources.publicity,
  blueSelectionPublicity,
  "蓝槽尚未选择时 selection-only 不得提前扣费",
);
const blueSelectionConfirmed = researchTech.execute(blueSelectionContext, {
  tileId: "blue1",
  blueSlot: 2,
  selectionOnly: true,
});
assert.equal(blueSelectionConfirmed.ok, true, blueSelectionConfirmed.message);
assert.equal(blueSelectionConfirmed.blueSlot, 2);

const researchTake = researchTech.execute(researchContext, { tileId: "purple1" });
assert.equal(researchTake.ok, true);
assert.equal(researchTake.techType, "purple");
const researchPlayer = researchContext.players.players[0];
const bonusPublicity = researchTake.bonusId === "bonus_1m" ? 1 : 0;
assert.equal(researchPlayer.resources.publicity, 10 - 6 + bonusPublicity);
if (researchTake.bonusId === "bonus_3f") {
  assert.equal(researchPlayer.resources.score, 2 + 3);
}
if (researchTake.bonusId === "bonus_1p") {
  assert.equal(researchPlayer.resources.energy, 10 + 1);
}
if (researchTake.bonusId === "bonus_1c") {
  assert.equal(researchTake.awaitingCardSelection, true);
  assert.equal(researchPlayer.hand.length, 0);
}

console.log("action ability tests passed");

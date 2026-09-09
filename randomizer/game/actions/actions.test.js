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
const planetRewards = require("./planet-rewards");

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
    meta: { sequences: { alienEntity: 1, rocket: 1, nebulaToken: 1, nebulaReplacement: 1, dataToken: 1 } },
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

// 实体编号与奖励次数独立：不同玩家、两类标记交错，恢复后继续累计。
{
  const context = createAomomoVisibleContextWithStalePlanetList();
  context.meta.sequences.alienEntity = 17;
  const player = players.getCurrentPlayer(context.players);
  player.resources.credits = 30;
  player.resources.energy = 30;
  const location = solar.createSolarSnapshot(context.solarSystem).planetLocations
    .find((entry) => entry.planetId === aomomo.PLANET_ID);
  const counts = { orbit: 0, land: 0 };
  for (const [index, family] of ["orbit", "land", "orbit", "land", "land", "land", "land"].entries()) {
    if (index > 0) {
      assert.equal(rockets.launchRocketAtSector(context.pieces, location, {
        playerId: player.id, color: player.color, root: context,
      }).ok, true);
    }
    const options = { source: "test", forceFirstLandingReward: index === 6 };
    const available = family === "orbit"
      ? abilities.planet.getOrbitOptions(context, options)
      : abilities.planet.getLandOptions(context, options);
    assert.equal(available.ok, true, available.message);
    const ordinal = ++counts[family];
    assert.equal(available.choices[0].markerSequence, ordinal);
    const result = abilities.executeAbility(`${family}Probe`, context, options);
    assert.equal(result.ok, true, result.message);
    assert.equal(result.markerSequence, ordinal);
    assert.equal(result.payload.markerSequence, ordinal);
    const markers = family === "orbit"
      ? context.aliens.aomomo.orbitMarkers : context.aliens.aomomo.landingMarkers;
    const marker = markers.at(-1);
    assert.equal(marker.sequence, 17 + index);
    assert.equal(marker.id, `aomomo-${family === "orbit" ? "orbit" : "landing"}-${17 + index}`);
    assert.equal(marker.playerId, player.id);
    assert.equal(context.meta.sequences.alienEntity, 18 + index);
    const rewardOrdinal = options.forceFirstLandingReward ? 1 : ordinal;
    if (family === "land") {
      assert.equal(result.rewardMarkerSequence, rewardOrdinal);
      assert.equal(result.payload.rewardMarkerSequence, rewardOrdinal);
    }
    const expected = family === "orbit"
      ? planetRewards.buildOrbitRewardEffects("aomomo", ordinal)
      : planetRewards.buildPlanetLandRewardEffects("aomomo", rewardOrdinal);
    assert.deepEqual(planetRewards.buildRewardEffectsForAction(family, result), expected.map((effect) => ({
      ...effect, options: { ...effect.options, targetPlayerId: player.id, targetPlayerColor: player.color },
    })));
    // 奖励按全体玩家标记计数；旧标记换成另一玩家，不得恢复首次奖励。
    marker.playerId = "player-brown";
    marker.playerColor = "brown";
    context.aliens = JSON.parse(JSON.stringify(context.aliens));
    context.meta = JSON.parse(JSON.stringify(context.meta));
  }
}

for (const family of ["orbit", "land"]) {
  const context = createAomomoVisibleContextWithStalePlanetList();
  context.meta.sequences.alienEntity = 17;
  const player = players.getCurrentPlayer(context.players);
  player.resources.credits = 0;
  player.resources.energy = 0;
  const before = JSON.stringify([context.meta, context.aliens, context.pieces, player]);
  const result = abilities.executeAbility(`${family}Probe`, context, { source: "test" });
  assert.equal(result.ok, false);
  assert.match(result.message, /资源不足/);
  assert.equal(JSON.stringify([context.meta, context.aliens, context.pieces, player]), before);
}

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

// 统一发射内核：launchProbe 支持 playerId 覆盖（初始结算等非回合场景，
// turn.currentPlayerId 不一定是被结算的玩家）。
{
  const multiPlayerContext = createContext({
    players: players.createPlayerState({
      players: [
        { color: "white", resources: { credits: 10, energy: 10, publicity: 10 } },
        { color: "brown", resources: { credits: 10, energy: 10, publicity: 10 } },
      ],
    }),
  });
  const second = multiPlayerContext.players.players[1];
  const targetedLaunch = abilities.executeAbility("launchProbe", multiPlayerContext, {
    skipCost: true,
    playerId: second.id,
    source: "initial_company",
  });
  assert.equal(targetedLaunch.ok, true, targetedLaunch.message);
  assert.equal(targetedLaunch.rocket.playerId, second.id, "playerId 覆盖必须发射给指定玩家");
  assert.equal(targetedLaunch.events[0].source, "initial_company");
  assert.equal(multiPlayerContext.players.players[0].resources.credits, 10, "非目标玩家不得扣费");
  assert.equal(second.resources.credits, 10, "免费发射不得扣费");
}

// 寰宇动力开局 2 次初始发射：统一走 launchProbe（免成本、豁免探测器上限）。
{
  const initialCards = require("../initial-cards");
  const huanyuContext = createContext({
    players: players.createPlayerState({
      currentPlayer: {
        color: "white",
        resources: { credits: 10, energy: 10, publicity: 10 },
      },
    }),
  });
  const player = huanyuContext.players.players[0];
  player.initialSelection = { industry: "寰宇动力", removedInitialCards: [] };
  const settled = initialCards.resolveInitialSelections(huanyuContext, {
    playerIds: [player.id],
  });
  assert.equal(settled.ok, true, settled.message);
  const huanyuRockets = huanyuContext.pieces.rockets.filter((rocket) => rocket.playerId === player.id);
  assert.equal(huanyuRockets.length, 2, "寰宇动力开局必须放置 2 枚探测器");
  assert.equal(player.resources.credits, 2, "开局发射不得扣信用点（免成本）");
  assert.equal(player.resources.energy, 2, "开局发射不得扣能量（免成本）");
}

// 初始牌扫描统一走 scanNebula 内核（免扫描费、不展开完整扫描队列），
// 事件与数据替换与主行动扫描一致。
{
  const data = require("../data");
  const initialCards = require("../initial-cards");
  const scanContext = createContext({
    players: players.createPlayerState({
      currentPlayer: {
        color: "white",
        resources: { credits: 10, energy: 10, publicity: 10 },
      },
    }),
  });
  scanContext.data = data.createDefaultNebulaDataState();
  data.fillAllNebulaData(scanContext.data, { source: "setup", root: scanContext });
  const player = scanContext.players.players[0];
  player.dataState = data.createDefaultDataState();
  // 初始牌 1：天狼星A扫描两次（id 需为 initial:N 以便识别牌号）
  const initialCard = cards.createCardInstance(
    { set: "initial", card_id: "initial:1", card_name: "天狼星A扫描两次" },
    "initial-test-1",
  );
  initialCard.id = "initial:1";
  player.initialSelection = { industry: "寰宇动力", removedInitialCards: [initialCard] };
  const settled = initialCards.resolveInitialSelections(scanContext, {
    playerIds: [player.id],
  });
  assert.equal(settled.ok, true, settled.message);
  const cardResult = settled.results.find((result) => result.cardNumber === 1);
  assert.ok(cardResult, "初始牌 1 必须产生结算结果");
  const scanResults = (cardResult?.results || []).filter((result) => result.type === "scan" && result.ok);
  assert.equal(scanResults.length, 2, "天狼星A初始牌必须完成 2 次扫描");
  assert.equal(
    settled.events.filter((event) => event.type === "signalMarked").length,
    2,
    "初始牌扫描必须发出 signalMarked 事件（与主行动扫描一致）",
  );
  assert.equal(player.resources.credits, 2, "初始牌扫描不得扣扫描费（免成本）");
  assert.equal(player.resources.energy, 2, "初始牌扫描不得扣能量（免成本）");
}

// 通用原语 placeNebulaToken：独立于扫描编排，可指定 playerId 与 scoreSourceKey。
{
  const data = require("../data");
  const nebulaContext = createContext({
    players: players.createPlayerState({
      currentPlayer: { color: "white", resources: { credits: 5, energy: 5, publicity: 5 } },
    }),
  });
  nebulaContext.data = data.createDefaultNebulaDataState();
  data.fillAllNebulaData(nebulaContext.data, { source: "setup", root: nebulaContext });
  const target = nebulaContext.players.players[0];
  target.dataState = data.createDefaultDataState();
  const placed = abilities.executeAbility("placeNebulaToken", nebulaContext, {
    nebulaId: "sector-2-a",
    playerId: target.id,
    source: "test_source",
    scoreSourceKey: "testScore",
  });
  assert.equal(placed.ok, true, placed.message);
  assert.equal(placed.replaced?.ok, true, "必须完成一次槽位替换");
  assert.equal(placed.events[0].type, "signalMarked", "原语必须发出 signalMarked 事件");
  assert.equal(target.resources.credits, 5, "原语本身不扣任何费用");
}

// 共享登陆行为纯净：getLandOptions 的选项摘要不得包含卡牌追加的
// afterLandRewards（卡牌域摘要由 play-domain 负责拼接）。
{
  const pureLandContext = createContext();
  launchToPlanet(pureLandContext, "mars");
  const pureOptions = abilities.planet.getLandOptions(pureLandContext, {
    afterLandRewards: [{
      planetIds: ["mars"],
      effect: { id: "card-extra", type: "gain_resources", label: "卡牌追加登陆奖励" },
    }],
  });
  assert.equal(pureOptions.ok, true, pureOptions.message);
  const pureLabel = pureOptions.choices[0].label;
  assert.equal(
    pureLabel.includes("卡牌追加登陆奖励"),
    false,
    "共享 getLandOptions 摘要不得读取卡牌 afterLandRewards",
  );
  assert.match(pureLabel, /奖励：/, "标准登陆奖励摘要仍保留");
}

{
  const context = createContext();
  const player = context.players.players[0];
  const asteroid = Array.from({ length: 32 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8) + 1 }))
    .find(at => solar.resolveVisibleContent(at.x, at.y, context.solarSystem).content.kind === "asteroid");
  const points = options => abilities.rocket.getRequiredMovePointsFromCoordinate(context, player, asteroid, options);
  assert.equal(points(), 2);
  context.turn.cardTurnEventBonuses = [{ ownerId: "other", movementModifiers: { ignoreAsteroidRestriction: true } }];
  assert.equal(points(), 2, "他人回合修正不影响本玩家");
  context.turn.cardTurnEventBonuses[0].ownerId = player.id;
  assert.equal(points({ ignoreAsteroidRestriction: false }), 1, "调用点默认false不能覆盖有效的本回合规则");
  const launched = rockets.launchRocketAtSector(context.pieces, asteroid, { playerId: player.id, color: player.color, root: context });
  assert.equal(launched.ok, true);
  const [move] = abilities.rocket.listPlayerMoveChoices(context, player, { maxPoints: 1 });
  assert.ok(move, "公司等1点移动来源必须能枚举离开小行星");
  assert.equal(abilities.rocket.moveProbe(context, { rocketId: move.rocketId, deltaX: move.deltaX,
    deltaY: move.deltaY, movementPoints: 1, skipCost: true }).ok, true);
  context.turn.cardTurnEventBonuses = [];
  assert.equal(points(), 2, "正式到期清除后不残留费用修正");
  assert.equal(points({ ignoreAsteroidRestriction: true }), 1, "保留原显式忽略选项");
  player.techState = players.normalizePlayerTechState({ ownedTiles: { orange2: true } });
  assert.equal(points(), 1, "保留橙色科技的正式减费");
}
console.log("action ability tests passed");

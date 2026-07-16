"use strict";

const assert = require("node:assert/strict");
const { createRenderRuntime, createCoordinateRuntime } = require("./render-runtime");

function createClassList(element) {
  const values = new Set();
  function sync() {
    element._className = Array.from(values).join(" ");
  }
  return {
    add(...tokens) {
      tokens.forEach((token) => values.add(token));
      sync();
    },
    remove(...tokens) {
      tokens.forEach((token) => values.delete(token));
      sync();
    },
    toggle(token, force) {
      if (force === true || (force !== false && !values.has(token))) values.add(token);
      else if (force === false || values.has(token)) values.delete(token);
      sync();
    },
    contains(token) {
      return values.has(token);
    },
    setFromString(value) {
      values.clear();
      String(value || "")
        .split(/\s+/)
        .filter(Boolean)
        .forEach((token) => values.add(token));
      sync();
    },
  };
}

function matchesSelector(element, selector) {
  if (!selector.startsWith(".")) return false;
  const className = selector.slice(1);
  return String(element.className || "")
    .split(/\s+/)
    .filter(Boolean)
    .includes(className);
}

function createStyle() {
  const props = new Map();
  return {
    props,
    setProperty(name, value) {
      props.set(name, value);
    },
    removeProperty(name) {
      props.delete(name);
    },
    getPropertyValue(name) {
      return props.get(name) || "";
    },
  };
}

function createElement(tagName, ownerDocument) {
  const element = {
    tagName: String(tagName).toUpperCase(),
    ownerDocument,
    children: [],
    parentElement: null,
    dataset: {},
    attributes: {},
    style: createStyle(),
    _className: "",
    hidden: false,
    disabled: false,
    textContent: "",
    innerHTML: "",
    clientWidth: 600,
    classList: null,
    append(...nodes) {
      nodes.forEach((node) => this.appendChild(node));
    },
    appendChild(node) {
      if (!node) return node;
      node.parentElement = this;
      this.children.push(node);
      if (node.id) ownerDocument.elementsById.set(node.id, node);
      return node;
    },
    prepend(node) {
      node.parentElement = this;
      this.children.unshift(node);
      if (node.id) ownerDocument.elementsById.set(node.id, node);
      return node;
    },
    replaceChildren(...nodes) {
      this.children.slice().forEach((child) => child.remove?.());
      this.children = [];
      nodes.forEach((node) => this.appendChild(node));
    },
    remove() {
      if (!this.parentElement) return;
      const siblings = this.parentElement.children;
      const index = siblings.indexOf(this);
      if (index >= 0) siblings.splice(index, 1);
      if (this.id) ownerDocument.elementsById.delete(this.id);
      this.parentElement = null;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    querySelectorAll(selector) {
      const result = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (matchesSelector(child, selector)) result.push(child);
          walk(child);
        }
      };
      walk(this);
      return result;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    addEventListener() {},
    scrollIntoView() {},
  };
  element.classList = createClassList(element);
  Object.defineProperty(element, "className", {
    get() {
      return element._className;
    },
    set(value) {
      element.classList.setFromString(value);
    },
  });
  return element;
}

function createDocument() {
  const ownerDocument = {
    elementsById: new Map(),
    createElement(tagName) {
      return createElement(tagName, ownerDocument);
    },
    getElementById(id) {
      return ownerDocument.elementsById.get(id) || null;
    },
    querySelector() {
      return null;
    },
  };
  return ownerDocument;
}

function createImageCtor() {
  return class FakeImage {
    constructor() {
      this.listeners = {};
      this.naturalWidth = 0;
    }

    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }

    set src(value) {
      this._src = value;
      this.naturalWidth = 100;
      this.listeners.load?.();
    }
  };
}

function createContext(overrides = {}) {
  const document = overrides.document || createDocument();
  const els = overrides.els || {
    tokenLayer: createElement("div", document),
    planetsTokenLayer: createElement("div", document),
    publicCardRow: createElement("div", document),
    playerHandPanel: createElement("div", document),
    playerHandFan: createElement("div", document),
    reservedCardFan: createElement("div", document),
    initialSelectionArea: createElement("div", document),
    playerBoardDataLayer: createElement("div", document),
    playerStats: createElement("div", document),
    opponentStatGrid: createElement("div", document),
    stateReadout: createElement("output", document),
    roundStatusToken: createElement("div", document),
    wheels: {
      1: createElement("div", document),
      2: createElement("div", document),
      3: createElement("div", document),
      4: createElement("div", document),
    },
    sectorWraps: {
      1: createElement("div", document),
      2: createElement("div", document),
      3: createElement("div", document),
      4: createElement("div", document),
    },
  };
  const playerA = {
    id: "p1",
    color: "white",
    name: "白色玩家",
    colorLabel: "白色",
    resources: { score: 10, credits: 5, energy: 3, publicity: 1, handSize: 0, availableData: 0 },
    income: {},
    hand: [],
    techState: { ownedTiles: {} },
  };
  const playerB = {
    id: "p2",
    color: "brown",
    name: "棕色玩家",
    colorLabel: "棕色",
    resources: { score: 8, credits: 4, energy: 2, publicity: 0, handSize: 0, availableData: 0 },
    income: {},
    hand: [],
    techState: { ownedTiles: {} },
  };
  const context = {
    document,
    Image: createImageCtor(),
    els,
    players: {
      DEFAULT_PLAYER_COLOR: "white",
      CARD_BACK_SRC: "back.png",
      getPlayerColorDefinition(color) {
        return {
          id: color,
          label: color,
          uiColor: color === "white" ? "#fff" : "#964B00",
          glowColor: "#ccc",
          rocketAsset: `${color}-rocket.png`,
          satelliteAsset: `${color}-satellite.png`,
          landdingAsset: `${color}-landing.png`,
          normalTokenAsset: `${color}-token.png`,
        };
      },
      canAfford() {
        return true;
      },
    },
    solar: {
      layout: { CONTENT_KIND: { PLANET: "planet" } },
      mod8(value) {
        return ((value % 8) + 8) % 8;
      },
      createSolarSnapshot() {
        return {
          planetLocations: [{ name: "Earth", planetId: "earth", x: 1, y: 2 }],
          nebulaRelations: [{ displayText: "N1" }],
          statistics: { visibleMeaningfulContentCounts: { planet: 1 } },
          visibleCoordinateGroups: { planets: [], asteroids: [], comets: [] },
        };
      },
      solarGridToGlobalPoint(x, y) {
        return { x: x * 10, y: y * 10 };
      },
      getSectorCoordinateBoundary() {
        return { boardCenter: { x: 50, y: 60 }, polarBoundary: {} };
      },
      getNebulaAtCoordinate() {
        return null;
      },
      polarToGlobalPoint(radius, angle) {
        return { x: radius, y: angle };
      },
    },
    rocketActions: {
      ROCKET_KIND: { STANDARD: "standard", CHONG_FOSSIL: "fossil" },
      formatRocketLabel(rocket) {
        return `#${rocket.id}`;
      },
      isControllablePlayerRocket() {
        return true;
      },
    },
    planetStats: {
      getPlanetOrbitMarkers() { return []; },
      getPlanetLandingMarkers() { return []; },
      getSatelliteLandingMarkers() { return []; },
    },
    planetReferenceLayout: {
      PLANETS_REFERENCE_SIZE: { width: 1000, height: 1000 },
      PLANET_REFERENCE_CENTERS: {},
    },
    endGameScoring: {
      countOrbitOrLandMarkers() { return 0; },
      countSectorWinsByColor() { return 0; },
      countTraceMarkers() { return 0; },
    },
    finalScoring: {
      getReadoutLines() { return ["终局"]; },
    },
    data: {
      renderSectorNebulaDataCalls: [],
      renderSectorNebulaData(sectorId) {
        this.renderSectorNebulaDataCalls.push(sectorId);
      },
      renderAomomoNebulaData() {},
      renderPlayerDataTokens(_player, _layer, options) {
        context.dataPlayerBoardCalls += 1;
        context.lastPlayerBoardOptions = options;
      },
      getReadoutLines() { return []; },
      getNebulaReadoutLines() { return []; },
      getSectorSettlementReadoutLines() { return []; },
    },
    aliens: {
      getReadoutLines() { return []; },
    },
    jiuzhe: null,
    yichangdian: null,
    chong: null,
    aomomo: null,
    runezu: null,
    industry: {
      getReadoutLines() { return []; },
    },
    solarState: {
      wheelSteps: { 1: 1, 2: 2, 3: 3, 4: 4 },
      sectorBySlot: { 1: 1, 2: 2, 3: null, 4: 4 },
      rotation: { rotationCount: 1 },
      aomomoActive: false,
    },
    playerState: { currentPlayerId: "p1", players: [playerA, playerB] },
    rocketState: { rockets: [], draggingRocketId: null },
    nebulaDataState: {},
    planetStatsState: {},
    alienGameState: {},
    finalScoringState: {},
    turnState: { roundNumber: 1, turnNumber: 1 },
    uiRuntimeState: { moveHighlightRocketId: null, codexAiBatchSuppressReadoutRender: false },
    tokenWidths: { rocket: null, orbit: null, landding: null },
    techRenderContext: { supplySlots: {} },
    sectorElements: {},
    yichangdianAnomalyMarkerElements: new Map(),
    chongPlanetFossilMarkerElements: new Map(),
    chongFossilOwnerTokenElements: new Map(),
    runezuBoardSymbolElements: new Map(),
    ROCKET_IMAGE_SCALE: 1,
    REFERENCE_ORBIT_IMAGE_SCALE: 1,
    REFERENCE_LANDDING_IMAGE_SCALE: 1,
    RESOURCE_ICON_SRC: {
      score: "score.png",
      finalScore: "final.png",
      orbitOrLand: "orbit.png",
      alienYellow: "yellow.png",
      alienPink: "pink.png",
      alienBlue: "blue.png",
      jiuzheCard: "jiuzhe-card.png",
      jiuzheThreat: "jiuzhe-threat.png",
    },
    OPPONENT_SECTOR_WIN_STATS: [],
    OPPONENT_TECH_TYPES: [],
    ROTATE_STATE_SLOTS: [{ id: "a", percentX: 10, percentY: 20 }, { id: "b", percentX: 30, percentY: 40 }],
    pendingState: { cardSelectionAction: null },
    cardState: { publicCards: [] },
    tech: { getReadoutLines() { return []; } },
    techGameState: {},
    actionHistory: { hasSession() { return false; }, getTrace() { return []; } },
    quickActionHistory: { hasSession() { return false; }, getTrace() { return []; } },
    getCurrentPlayer() { return playerA; },
    getInterfacePlayer() { return playerA; },
    getActivePlayers() { return [playerA, playerB]; },
    getPlayerById(id) { return [playerA, playerB].find((player) => player.id === id) || null; },
    getPlayerByColor(color) { return [playerA, playerB].find((player) => player.color === color) || null; },
    getPlayerRoundOrderNumber() { return 1; },
    getPlayerDisplayLabel(player) { return player.name; },
    isPlayerPassedThisRound() { return false; },
    isInitialSelectionActive() { return false; },
    getInitialSelectionOffer() { return null; },
    getCurrentInitialSelectionCards() { return []; },
    isInitialSelectionConfirmed() { return false; },
    getInitialSelectionPlayerIds() { return []; },
    getCardFromInitialOffer() { return null; },
    getPlayerLabelById() { return "白色"; },
    getDisplayedTurnNumber() { return 1; },
    isGameEnded() { return false; },
    createInitialSelectionPicker() { return createElement("div", document); },
    createCompanyCardSummary() { return createElement("div", document); },
    getPlayerCompanyBaseIncome() { return {}; },
    createPlayerNameStat() { return createElement("span", document); },
    createStatSeparator() { return createElement("span", document); },
    createStatIcon() { return createElement("span", document); },
    createInlineIconValue() { return createElement("span", document); },
    createPlayerStatsRow() { return createElement("div", document); },
    buildPlayerResourceStatNodes() { return [createElement("span", document)]; },
    buildPlayerIncomeStatNodes() { return [createElement("span", document)]; },
    buildPlayerRunezuStatNodes() { return []; },
    buildPlayerFangzhouStatNodes() { return []; },
    updatePlayerHandPanelTitle() { context.updatePlayerHandPanelTitleCalls += 1; },
    renderReservedCardsFromTaskState() { context.renderReservedCardsCalls += 1; },
    syncFinalScorePendingMarks() { context.syncFinalScorePendingMarksCalls += 1; },
    renderFinalScoreBoard() { context.renderFinalScoreBoardCalls += 1; },
    queueJiuzheOpportunitiesForPlayer() { context.queueJiuzheCalls += 1; },
    maybeOpenQueuedJiuzheOpportunity() { context.openJiuzheCalls += 1; },
    queueBanrenmaOpportunitiesForPlayer() { context.queueBanrenmaCalls += 1; },
    maybeOpenQueuedBanrenmaOpportunity() { context.openBanrenmaCalls += 1; },
    computePlayerFinalScoreBreakdown(player) {
      return { totalScore: player.resources.score + 3 };
    },
    buildPlutoMarkerContext() { return {}; },
    getCardTypeCode() { return ""; },
    buildProbeLocationIndex() { return { index: {}, details: [] }; },
    isDiscardSelectionActive() { return false; },
    isPlayCardSelectionActive() { return false; },
    isMovePaymentSelectionActive() { return false; },
    isHandScanSelectionActive() { return false; },
    getPendingCardCornerQuickAction() { return null; },
    getPendingHandCardPlayAction() { return null; },
    canUseCardCornerQuickAction() { return false; },
    isIndustryHandSelectionActive() { return false; },
    isIndustryFutureSpanHandSelectionActive() { return false; },
    isFutureSpanEligibleHandCard() { return false; },
    getFutureSpanDeltaForCard() { return 0; },
    isMovePaymentCard() { return false; },
    getCardCornerQuickActionForCard() { return null; },
    getHandCardPlayActionForCard() { return null; },
    getPendingPlayCardSelection() { return null; },
    getCardPlayCost() { return {}; },
    formatCardPlayCost() { return "0"; },
    getPublicScanChoicesForCard() { return { ok: true, scanLabel: "扫描" }; },
    attachCardHoverPreview() { context.attachCardHoverPreviewCalls += 1; },
    ensurePublicCardsFilledRespectingDelayedRefills() { context.ensurePublicCardsFilledCalls += 1; },
    updatePublicCardControls() { context.updatePublicCardControlsCalls += 1; },
    canBlindDraw() { return true; },
    getPlanetName(id) { return id; },
    getBoardPointFromPolarPoint() { return { x: 25, y: 35 }; },
    getReferencePlacementName() { return ""; },
    formatPlanetsReferencePoint() { return "P"; },
    formatPolarPoint() { return "R"; },
    formatBoardPoint() { return "B"; },
    getNormalTokenAssetForPlayer() { return "token.png"; },
    isRocketOnPlanetsReference() { return false; },
    isPlanetMarkerRocket() { return false; },
    isRocketMoveCandidate() { return false; },
    isRocketMoveMuted() { return false; },
    handleRocketPointerDown() {},
    getChongPlanetLabel(id) { return id; },
    getTurnReadoutLines() { return ["回合"]; },
    getInitialSelectionReadoutLines() { return ["开局"]; },
    getPlayerReadoutLines() { return ["玩家"]; },
    getPlanetStatsReadoutLines() { return ["星球"]; },
    scheduleAiAutoStepIfNeeded() { context.scheduleAiCalls += 1; },
    getRocketCoordinateReadoutLines() { return ["火箭"]; },
    selectDefaultRocketForCurrentPlayer() {},
    syncInteractionFocusChrome() { context.syncInteractionCalls += 1; },
    placeDataToBlueSlot() { context.placeDataCalls += 1; },
    getPublicCardHeight() { return 160; },
    isCardSelectionActive() { return false; },
    isPublicCardMultiSelectActive() { return false; },
    isAiAutoBattlePlayer() { return false; },
    updatePlayerHandPanelTitleCalls: 0,
    renderReservedCardsCalls: 0,
    syncFinalScorePendingMarksCalls: 0,
    renderFinalScoreBoardCalls: 0,
    queueJiuzheCalls: 0,
    openJiuzheCalls: 0,
    queueBanrenmaCalls: 0,
    openBanrenmaCalls: 0,
    ensurePublicCardsFilledCalls: 0,
    updatePublicCardControlsCalls: 0,
    attachCardHoverPreviewCalls: 0,
    dataPlayerBoardCalls: 0,
    scheduleAiCalls: 0,
    syncInteractionCalls: 0,
    placeDataCalls: 0,
  };
  Object.assign(context, overrides);
  context.els = els;
  context.document = document;
  return context;
}

{
  const context = createContext();
  context.cardState.publicCards = [
    { cardName: "A", src: "a.png" },
    { cardName: "B", src: "b.png" },
  ];
  context.pendingState.cardSelectionAction = { selectedSlots: [1] };
  context.isCardSelectionActive = () => true;
  context.isPublicCardMultiSelectActive = () => true;
  const runtime = createRenderRuntime(context);

  runtime.renderPublicCards();

  assert.equal(context.ensurePublicCardsFilledCalls, 1);
  assert.equal(context.els.publicCardRow.children.length, 2);
  assert.equal(context.els.publicCardRow.children[1].children[0].classList.contains("is-selected"), true);
  assert.equal(context.updatePublicCardControlsCalls, 1);
}

{
  const context = createContext();
  const stale = createElement("img", context.document);
  stale.classList.add("rocket-token");
  stale.dataset.rocketId = "99";
  context.els.tokenLayer.appendChild(stale);
  context.rocketState.rockets = [{ id: 1, playerId: "p1", color: "white" }];
  const runtime = createRenderRuntime(context);

  runtime.renderRockets();

  const rockets = context.els.tokenLayer.querySelectorAll(".rocket-token");
  assert.equal(rockets.length, 1);
  assert.equal(rockets[0].id, "rocket-1");
  assert.equal(rockets[0].style.left, "2.5%");
}

{
  const context = createContext();
  const runtime = createRenderRuntime(context);

  runtime.renderWheels();
  runtime.renderSectors();

  assert.equal(context.els.wheels[1].style.transform, "rotate(0.7853981633974483rad)");
  assert.equal(context.els.sectorWraps[1].children[0].dataset.sectorId, "1");
  assert.deepEqual(context.data.renderSectorNebulaDataCalls, [1, 2, 4]);
}

{
  const context = createContext();
  const runtime = createRenderRuntime(context);

  runtime.renderPlayerStats();

  assert.equal(context.els.playerStats.children.length, 1);
  assert.equal(context.els.opponentStatGrid.children.length, 2);
  assert.equal(context.updatePlayerHandPanelTitleCalls, 1);
  assert.equal(context.renderReservedCardsCalls, 1);
  assert.equal(context.dataPlayerBoardCalls, 1);
  assert.equal(context.queueJiuzheCalls, 1);
  assert.equal(context.queueBanrenmaCalls, 1);
}

{
  const rocketState = { rockets: [], nextRocketId: 1, activeRocketId: null, statusNote: "old" };
  let renderCalls = 0;
  const runtime = createCoordinateRuntime({
    els: {
      wheelWrap: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      planetsReferenceImage: {
        naturalWidth: 1000,
        naturalHeight: 1000,
        getAttribute() { return null; },
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
      },
    },
    solar: {
      GLOBAL_COORDINATE_SYSTEM: { size: 1000 },
      createSolarSnapshot: () => ({ planetLocations: [{ planetId: "earth", x: 3, y: 4 }] }),
    },
    solarState: {},
    rocketActions: {
      normalizeBoardPoint: (point) => point,
      normalizePlanetsReferencePoint: (point) => ({ ...point, x: point.percentX * 10, y: point.percentY * 10 }),
      getPolarPointFromBoardPoint: (point) => point,
      getBoardPointFromPolarPoint: (point) => point,
      placeRocketAtPlanetsReferencePoint() {},
      removeRocket() {},
      formatRocketLabel: (rocket) => `#${rocket.id}`,
      getRocketsForPlayer: (state, playerId) => state.rockets.filter((rocket) => rocket.playerId === playerId),
      createRocketSnapshot: (rocket) => ({ id: rocket.id }),
    },
    rocketState,
    planetReferenceLayout: {
      PLANET_ORDER: [],
      buildReferenceData: () => ({ ok: true }),
    },
    planetStats: {},
    planetStatsState: {},
    referencePlacementKindLabels: { orbit: "环绕" },
    planetsReferenceSize: { width: 1000, height: 1000 },
    rocketSurface: { SOLAR: "solar", PLANETS_REFERENCE: "planets" },
    removeRocketElement() {},
    renderRockets() { renderCalls += 1; },
  });

  assert.equal(runtime.getReferencePlacementName({ planetName: "地球", kind: "orbit", sequence: 2 }), "地球 环绕2");
  assert.deepEqual(runtime.getEarthSectorCoordinate(), { x: 3, y: 4 });
  assert.equal(runtime.isClientPositionInsidePlanetsReference(50, 50), true);
  runtime.seedDefaultReferenceRockets();
  assert.equal(renderCalls, 1);
  assert.equal(rocketState.statusNote, null);
}

console.log("render-runtime tests passed");

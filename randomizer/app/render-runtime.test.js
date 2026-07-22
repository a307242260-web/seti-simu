"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  RENDER_CONTEXT_CAPABILITY_INVENTORY,
  cloneSelectorResult,
  createRenderRuntime,
  createCoordinateRuntime,
} = require("./render-runtime");

{
  const source = { nested: { value: 1 } };
  const result = cloneSelectorResult(source);
  assert.notStrictEqual(result, source);
  assert.notStrictEqual(result.nested, source.nested);
  assert.deepEqual(result, source);
  assert.equal(cloneSelectorResult("scalar"), "scalar");
}

{
  const categorized = Object.entries(RENDER_CONTEXT_CAPABILITY_INVENTORY)
    .filter(([category]) => category !== "forbidden")
    .flatMap(([, keys]) => keys);
  assert.equal(new Set(categorized).size, categorized.length, "每项 production capability 必须且只能归入一个类别");
  for (const key of RENDER_CONTEXT_CAPABILITY_INVENTORY.forbidden) {
    assert.equal(categorized.includes(key), false, `forbidden capability 不得进入 allowlist: ${key}`);
  }
}

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
  const pendingState = {};
  const document = overrides.document || createDocument();
  const els = overrides.els || {
    tokenLayer: createElement("div", document),
    planetsTokenLayer: createElement("div", document),
    publicCardRow: createElement("div", document),
    publicBlindDrawButton: createElement("button", document),
    playerHandPanel: createElement("div", document),
    playerHandPanelHandCount: createElement("span", document),
    playerHandPanelTitleHint: createElement("span", document),
    playerHandFan: createElement("div", document),
    reservedCardFan: createElement("div", document),
    reservedCardPanel: createElement("section", document),
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
  const reservedTitle = createElement("div", document);
  reservedTitle.className = "panel-title";
  els.reservedCardPanel.append(reservedTitle);
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
      normalizePlayerTechState(value) {
        return value || { ownedTiles: {} };
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
      formatPlanetStatsLines() { return ["地球 环绕=0 登陆=0"]; },
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
    testResident: {
      solar: {
        wheelSteps: { 1: 1, 2: 2, 3: 3, 4: 4 },
        sectorBySlot: { 1: 1, 2: 2, 3: null, 4: 4 },
        rotation: { rotationCount: 1 },
        aomomoActive: false,
      },
      players: { currentPlayerId: "p1", players: [playerA, playerB] },
      pieces: { rockets: [], draggingRocketId: null },
      data: {},
      planets: {},
      aliens: {},
      finalScoring: {
        breakdownsByPlayerId: {
          p1: { totalScore: 13 },
          p2: { totalScore: 8 },
        },
      },
      turn: { roundNumber: 1, turnNumber: 1 },
      cards: {
        publicCards: [],
        ui: { selectionActive: false, discardSelectionActive: false, playCardSelectionActive: false },
        publicControls: {
          selectionActive: false,
          multiSelectActive: false,
          blindDrawEnabled: false,
          blindDrawReason: "请先进入精选",
        },
      },
      handPanel: { count: 1, overLimit: false, hint: "" },
      initialSelection: { active: false, interactive: false, offer: null, selectedCards: [] },
      reservedCards: {
        title: "保留牌区 · 完成任务 0",
        initialSelectionActive: false,
        empty: true,
        rows: [
          { type: "task", label: "1、2型任务牌", items: [] },
          { type: "final", label: "3型终局计分牌", items: [] },
        ],
      },
      tech: {},
      decisions: pendingState,
    },
    viewState: { moveHighlightRocketId: null, codexAiBatchSuppressReadoutRender: false },
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
    pendingState,
    tech: { getReadoutLines() { return []; } },
    actionHistory: { hasSession() { return false; }, getTrace() { return []; } },
    quickActionHistory: { hasSession() { return false; }, getTrace() { return []; } },
    getPlayerRoundOrderNumber() { return 1; },
    getPlayerDisplayLabel(player) { return player.name; },
    isPlayerPassedThisRound() { return false; },
    createInitialSelectionPicker() { return createElement("div", document); },
    createCompanyCardSummary() { return createElement("div", document); },
    createPlayerNameStat() { return createElement("span", document); },
    createStatSeparator() { return createElement("span", document); },
    createStatIcon() { return createElement("span", document); },
    createInlineIconValue() { return createElement("span", document); },
    createPlayerStatsRow() { return createElement("div", document); },
    buildPlayerResourceStatNodes() { return [createElement("span", document)]; },
    buildPlayerIncomeStatNodes() { return [createElement("span", document)]; },
    buildPlayerRunezuStatNodes() { return []; },
    buildPlayerFangzhouStatNodes() { return []; },
    renderFinalScoreBoard(input) {
      context.renderFinalScoreBoardCalls += 1;
      context.lastFinalScoreRenderInput = input;
      input.finalScoringState.legacyNormalizationProbe = true;
    },
    queueJiuzheOpportunitiesForPlayer() { context.queueJiuzheCalls += 1; },
    maybeOpenQueuedJiuzheOpportunity() { context.openJiuzheCalls += 1; },
    queueBanrenmaOpportunitiesForPlayer() { context.queueBanrenmaCalls += 1; },
    maybeOpenQueuedBanrenmaOpportunity() { context.openBanrenmaCalls += 1; },
    buildPlutoMarkerContext() { return {}; },
    canUseCardCornerQuickAction() { return false; },
    isIndustryHandSelectionActive() { return false; },
    isIndustryFutureSpanHandSelectionActive() { return false; },
    isFutureSpanEligibleHandCard() { return false; },
    getFutureSpanDeltaForCard() { return 0; },
    isMovePaymentCard() { return false; },
    getCardCornerQuickActionForCard() { return null; },
    getHandCardPlayActionForCard() { return null; },
    getCardPlayCost() { return {}; },
    formatCardPlayCost() { return "0"; },
    getPublicScanChoicesForCard() { return { ok: true, scanLabel: "扫描" }; },
    attachCardHoverPreview() { context.attachCardHoverPreviewCalls += 1; },
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
    getRocketCoordinateReadoutLines() { return ["火箭"]; },
    syncInteractionFocusChrome() { context.syncInteractionCalls += 1; },
    placeDataToBlueSlot() { context.placeDataCalls += 1; },
    getPublicCardHeight() { return 160; },
    layoutReservedCardRowsCalls: 0,
    renderFinalScoreBoardCalls: 0,
    lastFinalScoreRenderInput: null,
    queueJiuzheCalls: 0,
    openJiuzheCalls: 0,
    queueBanrenmaCalls: 0,
    openBanrenmaCalls: 0,
    attachCardHoverPreviewCalls: 0,
    dataPlayerBoardCalls: 0,
    syncInteractionCalls: 0,
    placeDataCalls: 0,
  };
  Object.assign(context, overrides);
  context.els = els;
  context.document = document;
  context.getProjection = () => {
    const freeze = (value) => {
      if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
      for (const child of Object.values(value)) freeze(child);
      return Object.freeze(value);
    };
    return freeze({
      schemaVersion: "seti-browser-host-v1",
      projectionId: "render-runtime-test",
      source: { kind: "committed", stateVersion: 1 },
      viewer: { viewerId: "browser:p1", playerId: "p1", role: "player" },
      resident: structuredClone(context.testResident),
    });
  };
  return context;
}

{
  const context = createContext();
  const poison = {};
  for (const key of RENDER_CONTEXT_CAPABILITY_INVENTORY.forbidden) {
    Object.defineProperty(poison, key, {
      configurable: true,
      enumerable: false,
      get() { throw new Error(`${key} poison getter touched`); },
    });
  }
  Object.setPrototypeOf(context, poison);
  const runtime = createRenderRuntime(context);
  runtime.renderPlayerHand();
  runtime.renderOpponentStats();
  runtime.renderPlayerStats();
  runtime.renderReservedCards();
  runtime.renderInitialSelectionArea();
  runtime.setTokenAssetSizes();
}

{
  const context = createContext();
  delete context.getPlanetStatsReadoutLines;
  const runtime = createRenderRuntime(context);
  runtime.renderStateReadout();
  assert.match(context.els.stateReadout.textContent, /星球统计\n地球 环绕=0 登陆=0/);
}

{
  const context = createContext();
  context.testResident.cards.publicCards = [
    { cardName: "A", src: "a.png" },
    { cardName: "B", src: "b.png" },
  ];
  context.testResident.cards.publicControls = {
    selectionActive: true,
    multiSelectActive: true,
    blindDrawEnabled: true,
    blindDrawReason: "盲抽一张牌加入手牌",
  };
  context.pendingState.publicCardSelectedSlots = [1];
  const runtime = createRenderRuntime(context);

  runtime.renderPublicCards();

  assert.equal(context.els.publicCardRow.children.length, 2);
  assert.equal(context.els.publicCardRow.children[1].children[0].classList.contains("is-selected"), true);
  assert.equal(context.els.publicBlindDrawButton.disabled, false);
  assert.equal(context.els.publicBlindDrawButton.title, "盲抽一张牌加入手牌");
}

{
  const context = createContext();
  const stale = createElement("img", context.document);
  stale.classList.add("rocket-token");
  stale.dataset.rocketId = "99";
  context.els.tokenLayer.appendChild(stale);
  context.testResident.pieces.rockets = [{ id: 1, playerId: "p1", color: "white" }];
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
  assert.equal(context.els.playerHandPanelHandCount.textContent, "1");
  assert.equal(context.els.reservedCardFan.children.length, 2);
  runtime.layoutReservedCardRows();
  assert.equal(context.dataPlayerBoardCalls, 1);
  assert.equal(context.lastFinalScoreRenderInput.finalScoringState.legacyNormalizationProbe, true);
  assert.equal(context.testResident.finalScoring.legacyNormalizationProbe, undefined);
  assert.equal(context.queueJiuzheCalls, 0);
  assert.equal(context.queueBanrenmaCalls, 0);
}

{
  const context = createContext();
  for (const key of ["browserRuleState", "workingState", "playerState", "turnState", "cardState", "solarState"]) {
    Object.defineProperty(context, key, {
      configurable: true,
      enumerable: true,
      get() { throw new Error(`${key} poison getter touched`); },
    });
  }
  assert.throws(() => createRenderRuntime(context), /拒绝规则 root reader\/writer/);
}

{
  const context = createContext();
  context.enforceCapabilityInventory = true;
  context.unknownRootReader = () => ({});
  assert.throws(() => createRenderRuntime(context), /未分类 capability: .*unknownRootReader/);
}

{
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const start = appSource.indexOf("renderRuntimeModule.createRenderRuntime({");
  const end = appSource.indexOf("\n  });", start);
  assert.ok(start >= 0 && end > start, "必须存在生产 render-runtime 装配块");
  const wiring = appSource.slice(start, end);
  assert.match(wiring, /getProjection:/);
  for (const key of [
    "solarState", "playerState", "rocketState", "nebulaDataState",
    "planetStatsState", "alienGameState", "finalScoringState", "turnState", "cardState", "techGameState",
    "getCurrentPlayer", "getInterfacePlayer", "getActivePlayers", "getPlayerById", "getPlayerByColor",
    "syncFinalScorePendingMarks", "computePlayerFinalScoreBreakdown",
    "getPendingMovePayment", "getPendingCardCornerQuickAction", "getPendingHandCardPlayAction",
    "getPendingPlayCardSelection", "isDiscardSelectionActive", "isPlayCardSelectionActive",
    "isMovePaymentSelectionActive", "isHandScanSelectionActive", "getInitialSelectionOffer",
    "renderReservedCardsFromTaskState", "updatePublicCardControls", "updatePlayerHandPanelTitle",
    "canBlindDraw", "selectDefaultRocketForCurrentPlayer", "isCardSelectionActive",
    "isPublicCardMultiSelectActive", "isAiAutoBattlePlayer",
  ]) {
    assert.doesNotMatch(wiring, new RegExp(`\\n\\s*${key}(?:,|:)`), `生产 renderer 不得注入 ${key}`);
  }
}

{
  const rocketState = { rockets: [], nextRocketId: 1, activeRocketId: null, statusNote: "old" };
  const workingRoot = { solarState: {}, rocketState, planetStatsState: {} };
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
      getSectorOccupancy: () => new Map(),
    },
    players: {
      DEFAULT_PLAYER_COLOR: "red",
      getPlayerColorDefinition: () => ({ label: "红色" }),
    },
    planetReferenceLayout: {
      PLANET_ORDER: [],
      buildReferenceData: () => ({ ok: true }),
    },
    planetStats: {},
    referencePlacementKindLabels: { orbit: "环绕" },
    planetsReferenceSize: { width: 1000, height: 1000 },
    rocketSurface: { SOLAR: "solar", PLANETS_REFERENCE: "planets" },
    removeRocketElement() {},
    renderRockets() { renderCalls += 1; },
  });

  assert.equal(runtime.getReferencePlacementName({ planetName: "地球", kind: "orbit", sequence: 2 }), "地球 环绕2");
  assert.deepEqual(runtime.getEarthSectorCoordinate(workingRoot), { x: 3, y: 4 });
  assert.equal(runtime.isClientPositionInsidePlanetsReference(50, 50), true);
  rocketState.rockets.push({ id: 1, color: "red" });
  rocketState.activeRocketId = 1;
  assert.match(runtime.getRocketCoordinateReadoutLines(rocketState).join("\n"), /当前 #1 红色/);
  rocketState.rockets.length = 0;
  runtime.seedDefaultReferenceRockets(workingRoot);
  assert.equal(renderCalls, 1);
  assert.equal(rocketState.statusNote, null);
}

console.log("render-runtime tests passed");

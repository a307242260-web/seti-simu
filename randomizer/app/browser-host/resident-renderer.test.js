"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const projectionApi = require("./resident-projection");
const rendererApi = require("./resident-renderer");
const viewStateApi = require("./view-state-store");
const coreProjectionApi = require("./projection-adapter");
const stateApi = require("../../game/state/state-store");
const sourceApi = require("../../game/state/host-source");

function createClassList(element) {
  const values = new Set();
  return {
    add(...tokens) { tokens.forEach((token) => values.add(token)); element.className = [...values].join(" "); },
    remove(...tokens) { tokens.forEach((token) => values.delete(token)); element.className = [...values].join(" "); },
    toggle(token, force) {
      if (force === true || (force !== false && !values.has(token))) values.add(token);
      else values.delete(token);
      element.className = [...values].join(" ");
    },
  };
}

function createElement(tagName) {
  const element = {
    tagName: String(tagName).toUpperCase(), className: "", dataset: {}, attributes: {}, children: [],
    textContent: "", hidden: false, src: "", alt: "", style: { values: {}, setProperty(key, value) { this.values[key] = value; } },
    append(...children) { children.forEach((child) => { child.parentElement = this; this.children.push(child); }); },
    replaceChildren(...children) { this.children = []; this.append(...children); },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    querySelector(selector) {
      if (selector === ".final-score-token-layer") return this.children.find((child) => child.className === "final-score-token-layer") || null;
      return null;
    },
  };
  element.classList = createClassList(element);
  return element;
}

function snapshot(element) {
  if (!element) return null;
  return {
    tagName: element.tagName,
    className: element.className,
    dataset: { ...element.dataset },
    attributes: { ...element.attributes },
    textContent: element.textContent,
    hidden: element.hidden,
    src: element.src,
    alt: element.alt,
    style: { ...element.style.values },
    children: element.children.map(snapshot),
  };
}

function createFixture() {
  const document = { createElement };
  const finalWrap = createElement("button");
  finalWrap.dataset.finalId = "a";
  const finalLayer = createElement("span");
  finalLayer.className = "final-score-token-layer";
  finalWrap.append(finalLayer);
  const techTile = createElement("img");
  techTile.dataset.techId = "blue1";
  const els = {
    roundStatusRound: createElement("span"),
    roundStatusTurn: createElement("span"),
    playerStats: createElement("div"),
    opponentStatGrid: createElement("div"),
    publicCardRow: createElement("div"),
    tokenLayer: createElement("div"),
    wheels: { 1: createElement("div"), 2: createElement("div") },
    finalScoreTileWraps: [finalWrap],
    techTiles: [techTile],
  };
  return { document, els };
}

function createProjection() {
  const state = stateApi.createCommittedGameState({
    stateVersion: 7, gameId: "seti-109", rulesetVersion: "test", seed: 109, rngState: {}, sequences: {},
    turn: { roundNumber: 2, turnNumber: 3, currentPlayerId: "p2" },
    players: { currentPlayerId: "p2", players: [
      { id: "p1", name: "一号", color: "white", colorLabel: "白色", resources: { score: 12, credits: 4 }, hand: [{ id: "own", cardId: "b_1.webp", src: "own.webp" }], reservedCards: [] },
      { id: "p2", name: "二号", color: "brown", colorLabel: "棕色", resources: { score: 9, credits: 2 }, hand: [{ id: "HIDDEN_OPPONENT_CANARY" }] },
    ] },
    cards: { publicCards: [{ id: "public-1", cardName: "公开牌", src: "public.webp" }], drawPile: ["HIDDEN_DECK_CANARY"] },
    solarSystem: { rotation: { rotationCount: 2 } },
    pieces: { rockets: [{ id: "r1", playerId: "p1", tokenSrc: "rocket.webp", x: 10, y: 20 }] },
    finalScoring: { tiles: { a: { marks: [{ id: "m1", slotIndex: 1, playerColor: "white", tokenSrc: "token.webp" }] } } },
    tech: { board: { stacks: { blue1: { available: false } } } },
  });
  const store = stateApi.createStateStore(state);
  const source = sourceApi.createHostStateSource({ stateStore: store });
  const canonical = coreProjectionApi.createBrowserProjectionAdapter({ stateSource: source })
    .projectSource({ viewer: { viewerId: "browser:p1", playerId: "p1", role: "player" } });
  return projectionApi.createResidentProjection({ projection: canonical });
}

(function testResidentProjectionAndRendererRebuildAreIsolated() {
  const projection = createProjection();
  const serialized = JSON.stringify(projection);
  assert.equal(serialized.includes("HIDDEN_OPPONENT_CANARY"), false);
  assert.equal(serialized.includes("HIDDEN_DECK_CANARY"), false);
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(projection.source.stateVersion, 7);
  assert.match(projection.projectionId, /^committed:/);

  const fixture = createFixture();
  const renderer = rendererApi.createResidentRenderer(fixture);
  const viewState = viewStateApi.createViewStateStore().getSnapshot();
  renderer.renderAll({ projection, viewState });
  const first = snapshot({ tagName: "ROOT", className: "", dataset: {}, attributes: {}, textContent: "", hidden: false, src: "", alt: "", style: { values: {} }, children: Object.values(fixture.els).flat().filter((entry) => entry?.tagName) });
  for (const key of ["playerStats", "opponentStatGrid", "publicCardRow", "tokenLayer"]) {
    fixture.els[key].replaceChildren();
  }
  fixture.els.finalScoreTileWraps[0].querySelector(".final-score-token-layer").replaceChildren();
  renderer.renderAll({ projection, viewState });
  const second = snapshot({ tagName: "ROOT", className: "", dataset: {}, attributes: {}, textContent: "", hidden: false, src: "", alt: "", style: { values: {} }, children: Object.values(fixture.els).flat().filter((entry) => entry?.tagName) });
  assert.deepEqual(second, first, "同 projection + ViewState 必须可重建等价 DOM");
  assert.equal(fixture.els.roundStatusRound.textContent, "第 2 轮");
  assert.equal(fixture.els.publicCardRow.children[0].children[0].dataset.cardId, "public-1");
  assert.equal(fixture.els.techTiles[0].hidden, true);
})();

(function testLegacySliceInputRejectedWithoutReadingPoisonGetters() {
  const legacy = {};
  Object.defineProperty(legacy, "playerState", {
    enumerable: true,
    get() { throw new Error("legacy getter touched"); },
  });
  const rejected = projectionApi.createResidentProjection(legacy);
  assert.equal(rejected.code, "RESIDENT_PROJECTION_LEGACY_SLICE_REJECTED");
  assert.deepEqual(rejected.legacyKeys, ["playerState"]);
})();

(function testDefaultProjectionSupportsCommittedArraySlicesWithoutLeaks() {
  const state = stateApi.createCommittedGameState({
    gameId: "seti-74", rulesetVersion: "test", seed: 74, rngState: { canary: "RNG_CANARY" }, sequences: {},
    turn: { round: 2, turn: 4, currentPlayerId: "p1" },
    players: { players: [
      { id: "p1", resources: { credits: 5, handSize: 1 }, hand: [{ id: "own" }], reservedCards: [] },
      { id: "p2", resources: { credits: 3, handSize: 1 }, hand: [{ id: "OPPONENT_CANARY" }], reservedCards: [] },
    ] },
    cards: { publicCards: [{ id: "public" }], drawPileCardIds: ["DECK_CANARY"] },
    pieces: { rockets: [{ id: "r1", playerId: "p1" }] }, tech: { board: { stacks: {} } },
  });
  const projection = coreProjectionApi.createBrowserProjectionAdapter({
    stateStore: stateApi.createStateStore(state),
  }).projectCommitted({ viewer: { viewerId: "v1", playerId: "p1", role: "player" } });
  assert.deepEqual(projection.cards.market, [{ id: "public" }]);
  assert.equal(projection.board.pieces.public[0].id, "r1");
  assert.equal(projection.cards.opponentCounts.p2.hand, 1);
  const serialized = JSON.stringify(projection);
  assert.equal(serialized.includes("OPPONENT_CANARY"), false);
  assert.equal(serialized.includes("DECK_CANARY"), false);
  assert.equal(serialized.includes("RNG_CANARY"), false);
})();

(function testRendererRejectsAnythingButProjectionAndViewState() {
  const renderer = rendererApi.createResidentRenderer(createFixture());
  assert.throws(() => renderer.renderAll({ projection: {}, viewState: {} }), /BrowserProjection/);
  assert.throws(() => renderer.renderAll({ projection: createProjection() }), /ViewState/);
})();

(function testResidentPresentationBuilderKeepsDomainProjectionOutOfBootstrap() {
  const builder = projectionApi.createResidentPresentationBuilder({
    setupSelectionState: {
      phase: "selecting", currentPlayerId: "p1",
      offersByPlayerId: { p1: { industryCards: [{ id: "industry-1" }] } },
    },
    cardTaskState: { readyType2ByCardId: { task1: true } },
    cardEffects: {
      getConsumedTriggerIndexes: () => [0],
      getCardModel: () => ({}),
    },
    players: { CARD_BACK_SRC: "back.webp" },
    cards: { getCardLabel: (card) => card.cardName },
    getCardTypeCode: () => 2,
    isAiPlayer: () => false,
  });
  const resident = { players: { players: [{
    id: "p1", colorLabel: "白色", completedTaskCount: 1,
    initialSelection: { industry: { id: "industry-1" } },
    reservedCards: [{ id: "task1", cardName: "任务一", src: "task.webp" }],
  }] }, aliens: {} };
  const viewer = { playerId: "p1" };
  assert.deepEqual(builder.createInitialSelection(viewer, resident), {
    active: true, interactive: true, currentPlayerId: "p1",
    offer: { industryCards: [{ id: "industry-1" }] },
    selectedCards: [{ id: "industry-1" }],
  });
  const reserved = builder.createReservedCards(viewer, resident);
  assert.equal(reserved.title, "初始选择 · 白色玩家");
  assert.equal(reserved.rows[0].items[0].ready, true);
  assert.deepEqual(reserved.rows[0].items[0].progressIndexes, [0]);
})();

(function testResidentRenderInputBuilderOwnsProjectionAssembly() {
  const canonical = createProjection();
  const viewStateStore = viewStateApi.createViewStateStore();
  const presentationBuilder = projectionApi.createResidentPresentationBuilder({
    setupSelectionState: {}, cardTaskState: {},
    cardEffects: { getConsumedTriggerIndexes: () => [], getCardModel: () => ({}) },
    players: { CARD_BACK_SRC: "back.webp" }, cards: { getCardLabel: () => "" },
  });
  const builder = projectionApi.createResidentRenderInputBuilder({
    presentationBuilder, viewStateStore,
    projectionAdapter: { projectSource: () => canonical },
    uiRuntimeState: { publicCardSelectedSlots: [1], alienRevealConfirmation: { active: true } },
    getViewer: () => canonical.viewer,
    createReadoutRoot: projectionApi.createReadoutRoot,
    getPendingMovePayment: () => ({ required: 2 }),
    computePlayerFinalScoreBreakdown: () => ({ total: 12 }),
    isCardSelectionActive: () => true,
    allowsBlindDrawInSelection: () => true,
    canBlindDraw: () => true,
    isPublicCardMultiSelectActive: () => false,
    getPlayerHandPanelTitleHint: () => "手牌提示",
  });
  const input = builder.createRenderInput();
  assert.equal(Object.isFrozen(input.projection), true);
  assert.deepEqual(input.projection.resident.decisions.movePayment, { required: 2 });
  assert.deepEqual(input.projection.resident.decisions.publicCardSelectedSlots, [1]);
  assert.equal(input.projection.resident.cards.publicControls.blindDrawEnabled, true);
  assert.equal(input.projection.resident.handPanel.hint, "手牌提示");
  assert.equal(input.projection.resident.finalScoring.breakdownsByPlayerId.p1.total, 12);
  assert.equal(input.viewState.schemaVersion, "seti-browser-host-v1");
})();

console.log("resident-renderer tests passed");

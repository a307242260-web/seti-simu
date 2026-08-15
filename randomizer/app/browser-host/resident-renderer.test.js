"use strict";

const assert = require("node:assert/strict");
const rendererApi = require("./resident-renderer");
const viewStateApi = require("./view-state-store");
const coreProjectionApi = require("./projection-adapter");
const stateApi = require("../../game/state/state-store");

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

function deepFreeze(value) {
  if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
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
  const techBonus = createElement("img");
  techBonus.dataset.techBonusFor = "blue1";
  const techOverlay = createElement("img");
  techOverlay.dataset.techOverlayFor = "blue1";
  const finalTile = createElement("img");
  finalTile.dataset.finalId = "a";
  const alienSlot = createElement("section");
  alienSlot.dataset.alienSlotRoot = "1";
  const els = {
    roundStatusRound: createElement("span"),
    roundStatusTurn: createElement("span"),
    roundStatusToken: createElement("img"),
    playerStats: createElement("div"),
    opponentStatGrid: createElement("div"),
    publicCardRow: createElement("div"),
    playerHandPanel: createElement("section"),
    playerHandFan: createElement("div"),
    reservedCardPanel: createElement("section"),
    reservedCardFan: createElement("div"),
    playerHandPanelHandCount: createElement("span"),
    playerHandPanelTitleHint: createElement("span"),
    tokenLayer: createElement("div"),
    planetsTokenLayer: createElement("div"),
    wheels: { 1: createElement("div"), 2: createElement("div") },
    sectorWraps: { 1: createElement("div"), 2: createElement("div") },
    finalScoreTileWraps: [finalWrap],
    finalScoreTiles: [finalTile],
    techTiles: [techTile],
    techBonuses: [techBonus],
    techOverlays: [techOverlay],
    playerBoardTechLayer: createElement("div"),
    playerBoardDataLayer: createElement("div"),
    alienSlots: [alienSlot],
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
  const projection = coreProjectionApi.createBrowserProjectionAdapter({ stateStore: store })
    .projectCommitted({ viewer: { viewerId: "browser:p1", playerId: "p1", role: "player" } });
  const renderProjection = structuredClone(projection);
  renderProjection.resident.browserReadModel = {
    render: {
      boardChrome: {
        wheelTransforms: [],
        sectors: [],
        aomomoWheelImageSrc: null,
        rotateTokenSlot: { id: "top-left", percentX: 34.81, percentY: 27.3 },
      },
      tokenPresentation: { activeRocketId: null, draggingRocketId: null, tokens: [] },
      playerPanels: {
        currentPlayerId: "p2",
        interfacePlayerId: "p1",
        players: [
          { id: "p1", displayName: "一号", score: 12, resourceStats: [] },
          { id: "p2", displayName: "二号", score: 9, resourceStats: [] },
        ],
      },
      turnPresentation: {
        roundNumber: 2,
        displayedTurnNumber: 3,
        currentPlayerId: "p2",
        terminal: false,
      },
      cardPanels: {
        publicCards: [{ id: "public-1", imageSrc: "public.webp", label: "公开牌" }],
        handCards: [],
        publicControls: {},
        handPanel: { count: 0, empty: true },
        initialSelection: {},
        reservedCards: { items: [] },
      },
      dataPresentation: {
        playerTokens: [],
        blueDropZones: [],
        sectorTokensBySectorId: {},
        aomomoTokens: [],
      },
      markerPresentation: { anomalies: [], planetFossils: [], runezuSymbols: [] },
      alienPresentation: { slots: [] },
      techTilePresentation: {
        supplyTiles: [{ tileId: "blue1", remaining: 0 }],
        playerTiles: [],
      },
      finalScorePresentation: {
        tiles: {
          a: { marks: [{ id: "m1", slotIndex: 1, playerColor: "white" }] },
        },
        tileVariants: { a: 1 },
        breakdownsByPlayerId: {},
      },
    },
  };
  return deepFreeze(renderProjection);
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
  assert.equal(fixture.els.roundStatusRound.textContent, "第 3 轮", "内部第 2 轮展示为规则书第 3 轮");
  assert.equal(fixture.els.publicCardRow.children[0].children[0].dataset.cardId, "public-1");
  assert.equal(fixture.els.techTiles[0].hidden, true);
  assert.equal(
    fixture.els.finalScoreTileWraps[0]
      .querySelector(".final-score-token-layer").children[0].style.values["--final-token-x"],
    "18.5%",
  );
})();

(function testDefaultProjectionSupportsCommittedArraySlicesWithoutLeaks() {
  const state = stateApi.createCommittedGameState({
    gameId: "seti-74", rulesetVersion: "test", seed: 74, rngState: { canary: "RNG_CANARY" }, sequences: {},
    turn: { roundNumber: 2, turnNumber: 4, currentPlayerId: "p1" },
    players: { players: [
      { id: "p1", resources: { credits: 5, handSize: 1 }, hand: [{ id: "own" }], reservedCards: [] },
      { id: "p2", resources: { credits: 3, handSize: 1 }, hand: [{ id: "OPPONENT_CANARY" }], reservedCards: [] },
    ] },
    cards: { publicCards: [{ id: "public" }], drawPileCardIds: ["DECK_CANARY"] },
    pieces: { rockets: [{ id: "r1", playerId: "p1" }] }, tech: { stacks: {} },
  });
  const projection = coreProjectionApi.createBrowserProjectionAdapter({
    stateStore: stateApi.createStateStore(state),
  }).projectCommitted({ viewer: { viewerId: "v1", playerId: "p1", role: "player" } });
  assert.deepEqual(projection.resident.cards.publicCards, [{ id: "public" }]);
  assert.equal(projection.resident.pieces.rockets[0].id, "r1");
  assert.equal(projection.resident.players.players[1].handCount, 1);
  assert.equal(Object.hasOwn(projection, "board"), false);
  assert.equal(Object.hasOwn(projection, "players"), false);
  assert.equal(Object.hasOwn(projection, "cards"), false);
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

(function testDesktopRendererFailureIsIsolatedFromRuleState() {
  const committed = { stateVersion: 11, score: 7 };
  const failures = [];
  const port = rendererApi.createDesktopRenderPort({
    createRenderInput: () => ({ projection: createProjection(), viewState: {} }),
    renderer: { renderAll() { throw new Error("renderer canary"); } },
    decisionRenderer: { render() { committed.score = 99; } },
    onRenderError: (failure) => failures.push(failure),
  });
  const result = port();
  assert.deepEqual(committed, { stateVersion: 11, score: 7 }, "renderer 抛错不得触碰规则状态");
  assert.equal(result.code, "BROWSER_RENDER_FAILED");
  assert.equal(failures[0].message, "renderer canary");
})();

(function testCurrentPlayerResourcesUseIconsAndHideZeroSpecialTokens() {
  const fixture = createFixture();
  const renderer = rendererApi.createResidentRenderer(fixture);
  const player = {
    id: "p1",
    displayName: "玩家",
    uiColor: "#fff",
    score: 6,
    resourceStats: [
      { label: "信用点", value: 10, iconSrc: "credits.webp" },
      { label: "能量", value: 9, iconSrc: "energy.webp" },
      { label: "宣传", value: "2/10", iconSrc: "publicity.webp" },
      { label: "可用数据", value: 3, iconSrc: "data.webp" },
      { label: "额外公共扫描", value: 0, iconSrc: "scan.webp" },
      { label: "奥陌陌化石", value: 0, iconSrc: "fossil.webp" },
      { label: "当前数据放置进展", value: "3/6", iconSrc: "analyze.webp" },
    ],
  };
  const projection = {
    schemaVersion: rendererApi.SCHEMA_VERSION,
    viewer: { playerId: "p1" },
    match: {},
    players: {},
    resident: {
      browserReadModel: {
        render: {
          playerPanels: { interfacePlayerId: "p1", players: [player] },
        },
      },
    },
  };
  const input = { projection, viewState: {} };

  renderer.renderPlayers(input);
  const row = fixture.els.playerStats.children[0];
  assert.equal(row.textContent, "");
  assert.deepEqual(
    row.children.slice(1).map((node) => node.attributes["aria-label"]),
    ["信用点 10", "能量 9", "宣传 2/10", "可用数据 3"],
  );
  assert.equal(row.children[0].children[2].attributes["aria-label"], "分数 6");

  player.resourceStats[4].value = 1;
  player.resourceStats[5].value = 2;
  renderer.renderPlayers(input);
  assert.deepEqual(
    fixture.els.playerStats.children[0].children.slice(1).map((node) => node.attributes["aria-label"]),
    ["信用点 10", "能量 9", "宣传 2/10", "可用数据 3", "额外公共扫描 1", "奥陌陌化石 2"],
  );
})();

(function testPrivateCardsAreRebuiltFromViewerSafeRenderProjection() {
  const fixture = createFixture();
  const renderer = rendererApi.createResidentRenderer(fixture);
  const projection = {
    schemaVersion: rendererApi.SCHEMA_VERSION,
    match: {},
    resident: {
      browserReadModel: {
        render: {
          cardPanels: {
            handCards: [{ id: "hand-1", imageSrc: "hand.webp", label: "手牌" }],
            reservedCards: {
              items: [{ id: "reserved-1", imageSrc: "reserved.webp", label: "保留牌" }],
            },
          },
        },
      },
    },
  };
  renderer.renderPrivateCards({
    projection,
    viewState: { focus: { entityRef: { kind: "hand-card", id: "hand-1" } } },
  });
  assert.equal(fixture.els.playerHandFan.children[0].dataset.handCardId, "hand-1");
  assert.equal(fixture.els.playerHandFan.children[0].className.includes("is-selected"), true);
  assert.equal(fixture.els.playerHandFan.children[0].attributes["aria-pressed"], "true");
  assert.equal(fixture.els.playerHandFan.children[0].children[0].dataset.cardId, "hand-1");
  assert.equal(fixture.els.reservedCardFan.children[0].dataset.cardId, "reserved-1");
  assert.equal(fixture.els.playerHandPanelHandCount.textContent, "(1)");
  assert.equal(fixture.els.playerHandPanel.className.includes("is-empty"), false);
  assert.equal(fixture.els.reservedCardPanel.className.includes("is-empty"), false);
})();

(function testTechAndDataAreRebuiltFromRenderProjection() {
  const fixture = createFixture();
  const renderer = rendererApi.createResidentRenderer(fixture);
  const projection = {
    schemaVersion: rendererApi.SCHEMA_VERSION,
    resident: {
      browserReadModel: {
        render: {
          techTilePresentation: {
            supplyTiles: [{
              tileId: "blue1",
              remaining: 3,
              bonusImageSrc: "bonus.webp",
              firstTakeAvailable: false,
            }],
            playerTiles: [{
              tileId: "blue2",
              imageSrc: "blue2.webp",
              disabled: false,
              layout: { percentX: 49, percentY: 74 },
            }],
          },
          dataPresentation: {
            playerTokens: [{
              id: "pool-data-without-position",
              imageSrc: "data.webp",
              placementKind: "pool",
            }, {
              id: "data-1",
              imageSrc: "data.webp",
              placementKind: "computer",
              percentX: 35,
              percentY: 68,
            }],
          },
        },
      },
    },
  };
  const input = { projection, viewState: {} };
  renderer.renderTechSupply(input);
  renderer.renderPlayerData(input);
  assert.equal(fixture.els.techTiles[0].hidden, false);
  assert.equal(fixture.els.techTiles[0].dataset.remaining, "3");
  assert.equal(fixture.els.techBonuses[0].src, "bonus.webp");
  assert.equal(fixture.els.techOverlays[0].hidden, true);
  assert.equal(fixture.els.playerBoardTechLayer.children[0].dataset.techId, "blue2");
  assert.equal(fixture.els.playerBoardTechLayer.children[0].style.values["--x"], "49%");
  assert.equal(fixture.els.playerBoardDataLayer.children[0].dataset.tokenId, "data-1");
  assert.equal(fixture.els.playerBoardDataLayer.children.length, 1);
  assert.equal(fixture.els.playerBoardDataLayer.children[0].style.values["--y"], "68%");
})();

(function testBoardChromeAndTokensAreRebuiltFromRenderProjection() {
  const fixture = createFixture();
  const renderer = rendererApi.createResidentRenderer(fixture);
  const projection = {
    schemaVersion: rendererApi.SCHEMA_VERSION,
    match: {},
    resident: {
      browserReadModel: {
        render: {
          boardChrome: {
            wheelTransforms: [{ wheelId: 1, degrees: -45 }],
            sectors: [{ slotId: 1, sectorId: 3 }],
            rotateTokenSlot: { id: "bottom-left", percentX: 34.15, percentY: 71.18 },
          },
          dataPresentation: {
            sectorTokensBySectorId: {
              3: {
                tokens: [{
                  id: "nebula-1",
                  nebulaId: "sector-3-a",
                  imageSrc: "data.png",
                  layout: { percentX: 47, percentY: 58, scalePercent: 11.8 },
                  displayScale: 3.5,
                }],
                wins: [{
                  id: "win-1",
                  imageSrc: "blue-token.png",
                  layout: { percentX: 72, percentY: 35, scalePercent: 8 },
                }],
              },
            },
            aomomoTokens: [],
          },
          tokenPresentation: {
            tokens: [{
              id: "rocket-1",
              playerId: "p1",
              color: "blue",
              target: "solar-board",
              percentX: 42,
              percentY: 31,
              imageSrc: "rocket.webp",
            }, {
              id: "planet:venus:orbit:1",
              playerId: "p1",
              color: "blue",
              kind: "planet-marker",
              referenceKind: "orbit",
              target: "planets-reference",
              percentX: 9,
              percentY: 22,
              imageSrc: "token.webp",
            }],
          },
          turnPresentation: {
            roundNumber: 1,
            displayedTurnNumber: 1,
            currentPlayerId: "p1",
            terminal: false,
          },
        },
      },
    },
  };
  renderer.renderSolarSystem({ projection, viewState: {} });
  renderer.renderRoundStatus({ projection, viewState: {} });
  assert.equal(fixture.els.wheels[1].style.values.transform, "rotate(-45deg)");
  assert.equal(fixture.els.sectorWraps[1].children[0].className, "sector sector-3");
  assert.equal(
    fixture.els.sectorWraps[1].children[0].children[0].children[0].dataset.tokenId,
    "nebula-1",
  );
  assert.equal(
    fixture.els.sectorWraps[1].children[0].children[0].children[0]
      .style.values["--data-scale"],
    String((11.8 / 100) * 3.5),
  );
  assert.equal(fixture.els.sectorWraps[1].children[0].children[1].dataset.winId, "win-1");
  assert.equal(fixture.els.tokenLayer.children[0].style.values.left, "42%");
  assert.equal(fixture.els.planetsTokenLayer.children[0].dataset.pieceId, "planet:venus:orbit:1");
  assert.match(fixture.els.planetsTokenLayer.children[0].className, /is-reference-orbit/);
  assert.equal(fixture.els.roundStatusToken.dataset.slotId, "bottom-left");
})();

(function testOpponentStatsReuseCurrentPlayerIconsAndAddHandCount() {
  const fixture = createFixture();
  const renderer = rendererApi.createResidentRenderer(fixture);
  const projection = {
    schemaVersion: rendererApi.SCHEMA_VERSION,
    resident: {
      browserReadModel: {
        render: {
          playerPanels: {
            interfacePlayerId: "p1",
            currentPlayerId: "p2",
            players: [{
              id: "p1",
              displayName: "白色玩家",
              score: 8,
              resourceStats: [],
            }, {
              id: "p2",
              displayName: "棕色玩家",
              score: 12,
              uiColor: "#b2845a",
              handCount: 4,
              resourceStats: [
                { label: "信用点", value: 5, iconSrc: "credits.webp" },
                { label: "能量", value: 2, iconSrc: "energy.webp" },
                { label: "宣传", value: "6/10", iconSrc: "publicity.webp" },
                { label: "可用数据", value: 1, iconSrc: "data.webp" },
              ],
            }],
          },
        },
      },
    },
  };
  renderer.renderPlayers({ projection, viewState: {} });
  const opponent = fixture.els.opponentStatGrid.children[0];
  assert.equal(fixture.els.opponentStatGrid.children.length, 1);
  assert.equal(opponent.className.includes("is-current"), true);
  const row = opponent.children[0];
  assert.equal(row.className.includes("player-stats-row"), true);
  assert.equal(row.children.length, 6, "玩家标题/分数、四项资源、手牌数量");
  assert.equal(row.children[5].attributes["aria-label"], "手牌 4");
})();

(function testAlienPanelsAreRebuiltFromRenderProjection() {
  const fixture = createFixture();
  const renderer = rendererApi.createResidentRenderer(fixture);
  const projection = {
    schemaVersion: rendererApi.SCHEMA_VERSION,
    resident: {
      browserReadModel: {
        render: {
          alienPresentation: {
            slots: [{
              slotId: 1,
              revealed: true,
              alienId: "九折",
              label: "九折",
              faceImageSrc: "face.png",
              stateImageSrc: "state.png",
              traces: [{
                id: "trace-1",
                traceType: "yellow",
                color: "blue",
                imageSrc: "token.png",
                surface: "face",
                layout: { percentX: 50, percentY: 40, scalePercent: 62 },
              }],
            }],
          },
        },
      },
    },
  };
  renderer.renderAliens({ projection, viewState: {} });
  const root = fixture.els.alienSlots[0];
  assert.equal(root.dataset.alienId, "九折");
  assert.equal(root.children[1].children[0].src, "face.png");
  assert.equal(root.children[1].children[1].style.values.left, "50%");
  assert.equal(root.children[2].children[0].src, "state.png");
})();

console.log("resident-renderer tests passed");

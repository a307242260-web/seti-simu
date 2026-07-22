"use strict";

const assert = require("node:assert/strict");
const { createFinalUiRuntime } = require("./final-ui-runtime");

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
    setProperty(name, value) {
      props.set(name, value);
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
    title: "",
    append(...nodes) {
      nodes.forEach((node) => this.appendChild(node));
    },
    appendChild(node) {
      if (!node) return node;
      node.parentElement = this;
      this.children.push(node);
      return node;
    },
    replaceChildren(...nodes) {
      this.children = [];
      nodes.forEach((node) => this.appendChild(node));
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
    focus() {
      ownerDocument.activeElement = this;
    },
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
  return {
    activeElement: null,
    createElement(tagName) {
      return createElement(tagName, this);
    },
  };
}

function createTileWrap(document, tileId) {
  const wrap = createElement("button", document);
  const layer = createElement("span", document);
  wrap.dataset.finalId = tileId;
  wrap.className = "final-score-tile-wrap";
  layer.className = "final-score-token-layer";
  wrap.append(layer);
  return wrap;
}

const document = createDocument();
const finalScoreTileWraps = ["a", "b", "c", "d"].map((tileId) => createTileWrap(document, tileId));
const finalResultOverlay = createElement("div", document);
const finalResultButton = createElement("button", document);
const finalResultHead = createElement("thead", document);
const finalResultBody = createElement("tbody", document);
const finalResultSubtitle = createElement("div", document);
const rocketState = { statusNote: "" };
const uiRuntimeState = { finalResultAutoOpened: false };
const playerA = {
  id: "p1",
  color: "white",
  colorLabel: "白色",
  name: "白色玩家",
  resources: { score: 21 },
  completedTaskCount: 2,
  techState: { ownedTiles: { blue: ["b1", "b2"] } },
  scoreSources: { initialScore: 6, scanScore: 3 },
};
const playerB = {
  id: "p2",
  color: "brown",
  colorLabel: "棕色",
  name: "棕色玩家",
  resources: { score: 18 },
  completedTaskCount: 1,
  techState: { ownedTiles: { orange: ["o1"] } },
  scoreSources: { initialScore: 4, scanScore: 1 },
};
const finalScoringState = {
  tiles: { a: { marks: [] }, b: { marks: [] }, c: { marks: [] }, d: { marks: [] } },
  pendingByPlayerId: { p1: { threshold: 70 } },
};
const alienGameState = { jiuzhe: { revealInitialized: false }, runezu: { revealInitialized: false } };
const playerState = { currentPlayerId: "p1", players: [playerA, playerB] };
const turnState = { activePlayerIds: ["p1", "p2"], roundNumber: 4 };
const workingRoot = { finalScoringState, alienGameState, playerState, turnState, rocketState };
const context = {
  document,
  structuredClone: global.structuredClone,
  els: {
    finalScoreTileWraps,
    finalResultOverlay,
    finalResultButton,
    finalResultHead,
    finalResultBody,
    finalResultSubtitle,
  },
  players: {
    getCurrentPlayer(state) {
      return state.players.find((player) => player.id === state.currentPlayerId) || null;
    },
    getPlayerColorDefinition(color) {
      return color === "white"
        ? { uiColor: "#fff", label: "白色" }
        : { uiColor: "#754c24", label: "棕色" };
    },
  },
  finalScoring: {
    syncPendingMarks() {
      return { added: [{ playerId: "p1", threshold: 70 }] };
    },
    getNextPendingMarkForPlayer(state, playerId) {
      return state.pendingByPlayerId[playerId] || null;
    },
    canMarkTile(state, tileId, player) {
      return { ok: tileId === "a" && player.id === "p1" };
    },
    markTile(state, tileId, player, options) {
      state.tiles[tileId].marks.push({ slotIndex: 1, playerColor: player.color, tokenSrc: options.tokenSrc });
      delete state.pendingByPlayerId[player.id];
      return { ok: true, message: `已标记 ${tileId}` };
    },
  },
  endGameScoring: {},
  uiRuntimeState,
  getRuleReadout() {
    return structuredClone(workingRoot);
  },
  FINAL_SCORE_SLOT_POINTS: {
    1: { x: 10, y: 20 },
    2: { x: 30, y: 40 },
    3: { x: 50, y: 60, columns: 2, stepX: 5, stepY: 6 },
  },
  FINAL_ROUND_NUMBER: 4,
  SCORE_SOURCE_KEYS: {
    INITIAL: "initialScore",
    SCAN: "scanScore",
    TECH_BONUS: "techBonusScore",
    BLUE_TECH: "blueTechScore",
    CARD_QUICK: "cardQuickScore",
    CARD_EFFECT: "cardEffectScore",
    TASK_CARD: "taskCardScore",
    ORBIT: "orbitScore",
    LAND: "landScore",
    ALIEN_TRACE_PINK: "alienTracePinkScore",
    ALIEN_TRACE_YELLOW: "alienTraceYellowScore",
    ALIEN_TRACE_BLUE: "alienTraceBlueScore",
    ALIEN_CARD_QUICK: "alienCardQuickScore",
    ALIEN_EFFECT: "alienEffectScore",
    INDUSTRY_EFFECT: "industryEffectScore",
  },
  HISTORY_SOURCE_QUICK: "quick",
  getCurrentPlayer() {
    return playerA;
  },
  getCurrentPlayerLabel() {
    return "白色";
  },
  getActivePlayers() {
    return [playerA, playerB];
  },
  getDisplayedTurnNumber() {
    return 2;
  },
  getNormalTokenAssetForPlayer() {
    return "white.png";
  },
  getHistoryForSource() {
    return {
      hasSession() { return false; },
      beginSession() {},
      beginStep() {},
      record() {},
      endStep() { return { id: "step-1", label: "标记终局" }; },
    };
  },
  createActionLogImpactSnapshot() {
    return {};
  },
  appendActionLogStep() {},
  actionLogOptionsFromHistoryStep() {
    return {};
  },
  rememberHistoryStep() {},
  historyCommands: {
    createRestoreObjectCommand() {
      return { ok: true };
    },
  },
  queueStateReadoutRenderCalled: 0,
  queueStateReadoutRender: () => {
    context.queueStateReadoutRenderCalled += 1;
  },
  computePlayerFinalScoreBreakdown(player) {
    if (player.id === "p1") {
      return {
        totalScore: 28,
        baseScore: 21,
        tileScore: 4,
        cardScore: 3,
        jiuzheCardScore: 0,
        jiuzhePenaltyScore: 0,
        runezuSymbolScore: 0,
        tileScoresById: { a: 4, b: 0, c: 0, d: 0 },
      };
    }
    return {
      totalScore: 20,
      baseScore: 18,
      tileScore: 1,
      cardScore: 1,
      jiuzheCardScore: 0,
      jiuzhePenaltyScore: 0,
      runezuSymbolScore: 0,
      tileScoresById: { a: 0, b: 1, c: 0, d: 0 },
    };
  },
  getPlayerScoreSource(player, key) {
    return Number(player.scoreSources?.[key] || 0);
  },
  updateActionButtonsCalled: 0,
  updateActionButtons: () => {
    context.updateActionButtonsCalled += 1;
  },
  renderPlayerStatsCalled: 0,
  renderPlayerStats: () => {
    context.renderPlayerStatsCalled += 1;
  },
  isGameEnded() {
    return true;
  },
  isPlayerPassedThisRound(playerId) {
    return playerId === "p2";
  },
  countPlayerOwnedTech(player) {
    return Object.values(player.techState?.ownedTiles || {}).reduce((sum, list) => sum + list.length, 0);
  },
};

const runtime = createFinalUiRuntime(context);

runtime.renderFinalScoreBoard();
assert.equal(finalScoreTileWraps[0].disabled, false);
assert.equal(finalScoreTileWraps[0].title, "白色玩家标记 70 分门槛");
assert.equal(finalScoreTileWraps[1].disabled, true);

const markResult = runtime.handleFinalScoreTileClick(workingRoot, "a");
assert.equal(markResult.ok, true);
assert.equal(rocketState.statusNote, "已标记 a");
assert.equal(context.renderPlayerStatsCalled, 1);
assert.equal(context.updateActionButtonsCalled, 1);

runtime.renderFinalResultDialog();
assert.equal(finalResultHead.children[0].children.length, 3);
assert.equal(finalResultBody.children[0].children[1].textContent, "28");
assert.match(finalResultSubtitle.textContent, /最高分 28/);

const openResult = runtime.openFinalResultDialog({ auto: true });
assert.equal(openResult.ok, true);
assert.equal(finalResultOverlay.hidden, false);
assert.equal(uiRuntimeState.finalResultAutoOpened, true);

runtime.closeFinalResultDialog();
assert.equal(finalResultOverlay.hidden, true);
assert.equal(document.activeElement, finalResultButton);

const exportRows = runtime.buildActionLogExportPlayerResults();
assert.deepEqual(exportRows.map((row) => row.finalScore), [28, 20]);
assert.deepEqual(exportRows.map((row) => row.techCount), [2, 1]);

console.log("final-ui-runtime tests passed");

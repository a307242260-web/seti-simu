(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserReadModel = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-read-model-v1";
  const READ_MODEL_KEYS = Object.freeze(["schemaVersion", "render"]);
  const RENDER_KEYS = Object.freeze([
    "boardChrome", "tokenPresentation", "playerPanels", "turnPresentation", "cardPanels",
    "dataPresentation", "markerPresentation", "alienPresentation", "techTilePresentation",
    "finalScorePresentation",
  ]);
  const BOARD_CHROME_KEYS = Object.freeze([
    "wheelTransforms", "sectors", "aomomoWheelImageSrc", "rotateTokenSlot",
  ]);
  const TOKEN_PRESENTATION_KEYS = Object.freeze(["activeRocketId", "draggingRocketId", "tokens"]);
  const PLAYER_PANELS_KEYS = Object.freeze(["currentPlayerId", "interfacePlayerId", "players"]);
  const CARD_PANELS_KEYS = Object.freeze([
    "publicCards", "handCards", "publicControls", "handPanel", "initialSelection", "reservedCards",
  ]);
  const DATA_PRESENTATION_KEYS = Object.freeze([
    "playerTokens", "blueDropZones", "sectorTokensBySectorId", "aomomoTokens",
  ]);
  const MARKER_PRESENTATION_KEYS = Object.freeze([
    "anomalies", "planetFossils", "runezuSymbols",
  ]);
  const ALIEN_PRESENTATION_KEYS = Object.freeze(["slots"]);
  const TECH_TILE_PRESENTATION_KEYS = Object.freeze(["supplyTiles", "playerTiles"]);
  const FINAL_SCORE_PRESENTATION_KEYS = Object.freeze([
    "tiles", "tileVariants", "breakdownsByPlayerId",
  ]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function assertExactKeys(value, keys, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${label} 必须是对象`);
    }
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    const unknown = actual.filter((key) => !expected.includes(key));
    const missing = expected.filter((key) => !actual.includes(key));
    if (unknown.length || missing.length) {
      throw new TypeError(
        `${label} 字段不匹配：unknown=${unknown.join(",") || "-"} missing=${missing.join(",") || "-"}`,
      );
    }
  }

  function assertArray(value, label) {
    if (!Array.isArray(value)) throw new TypeError(`${label} 必须是数组`);
  }

  function listPlayers(state) {
    const source = state?.players?.players;
    if (!Array.isArray(source)) throw new TypeError("BrowserReadModel 需要 canonical players.players");
    return source;
  }

  function createTurnFlow(state, players) {
    const turn = state?.turn || {};
    const turnOrderPlayerIds = clone(turn.turnOrderPlayerIds || []);
    const activePlayerIds = clone(turn.activePlayerIds || []);
    const activeSet = new Set(activePlayerIds.map(String));
    const activeOrder = turnOrderPlayerIds.filter((id) => activeSet.has(String(id)));
    const startIndex = activeOrder.findIndex((id) => String(id) === String(turn.startPlayerId));
    const roundOrderPlayerIds = startIndex > 0
      ? [...activeOrder.slice(startIndex), ...activeOrder.slice(0, startIndex)]
      : activeOrder;
    const activeCount = Math.max(
      1,
      activeOrder.length || Number(turn.activePlayerCount) || players.length || 1,
    );
    const roundNumber = Math.max(1, Number(turn.roundNumber) || 1);
    const turnNumber = Math.max(1, Number(turn.turnNumber) || 1);
    const playerLabelsById = {};
    const playerAgentLabelsById = {};
    for (const player of players) {
      const id = String(player?.id);
      playerLabelsById[id] = player?.name || player?.id || id;
      playerAgentLabelsById[id] = "玩家";
    }
    return {
      roundNumber,
      turnNumber,
      displayedTurnNumber: Math.floor((turnNumber - 1) / activeCount) + 1,
      actionCycleNumber: Math.max(1, Number(turn.actionCycleNumber) || 1),
      currentPlayerId: turn.currentPlayerId ?? null,
      turnOrderPlayerIds,
      activePlayerIds,
      roundOrderPlayerIds,
      passedPlayerIds: clone(turn.passedPlayerIds || []),
      completedTurnPlayerIds: clone(turn.completedTurnPlayerIds || []),
      terminal: Boolean(turn.gameEnded),
      gameEndReason: turn.gameEndReason || null,
      playerLabelsById,
      playerAgentLabelsById,
    };
  }

  function createTokenView(token, context) {
    const surface = token?.surface ?? null;
    return {
      id: token?.id ?? null,
      playerId: token?.playerId ?? null,
      color: token?.color ?? null,
      kind: token?.kind ?? null,
      surface,
      radius: token?.radius ?? null,
      angleDegrees: token?.angleDegrees ?? null,
      x: token?.x ?? null,
      y: token?.y ?? null,
      sectorCoordinate: clone(token?.sectorCoordinate ?? null),
      slotSectorCoordinate: clone(token?.slotSectorCoordinate ?? null),
      slotIndex: token?.slotIndex ?? null,
      cargo: clone(token?.cargo ?? null),
      chongDelivered: Boolean(token?.chongDelivered),
      movable: Boolean(context.rockets?.isMovablePlayerToken?.(token)
        || context.rockets?.isControllablePlayerRocket?.(token)),
      controllable: Boolean(context.rockets?.isControllablePlayerRocket?.(token)),
    };
  }

  function createBoardCoordinate(context, state) {
    const snapshot = context.solar.createSolarSnapshot(state?.solarSystem || {});
    if (!Array.isArray(snapshot?.planetLocations) || !Array.isArray(snapshot?.visibleContents)) {
      throw new TypeError("BrowserReadModel solar snapshot 缺少公开坐标");
    }
    return {
      tokens: (state?.pieces?.rockets || []).map((token) => createTokenView(token, context)),
      activeRocketId: state?.pieces?.activeRocketId ?? null,
      planetLocations: clone(snapshot.planetLocations),
      visibleContents: clone(snapshot.visibleContents),
    };
  }

  function createRender(state, options, players, turnFlow, boardCoordinate) {
    if (typeof options.createRenderPresentation !== "function") {
      throw new TypeError("BrowserReadModel 需要唯一 createRenderPresentation owner");
    }
    const presentationState = deepFreeze(clone(options.presentationState || state));
    const presentationPlayers = deepFreeze(clone(options.presentationPlayers || players));
    const render = options.createRenderPresentation({
      state: presentationState,
      players: presentationPlayers,
      turnFlow,
      boardCoordinate,
      viewer: options.viewer || null,
      finalReadModel: deepFreeze(clone(options.finalReadModel || null)),
    });
    return clone(render);
  }

  function assertRender(render) {
    assertExactKeys(render, RENDER_KEYS, "BrowserReadModel.render");
    assertExactKeys(render.boardChrome, BOARD_CHROME_KEYS, "BrowserReadModel.render.boardChrome");
    assertExactKeys(
      render.tokenPresentation,
      TOKEN_PRESENTATION_KEYS,
      "BrowserReadModel.render.tokenPresentation",
    );
    assertExactKeys(render.playerPanels, PLAYER_PANELS_KEYS, "BrowserReadModel.render.playerPanels");
    assertExactKeys(render.cardPanels, CARD_PANELS_KEYS, "BrowserReadModel.render.cardPanels");
    assertExactKeys(
      render.dataPresentation,
      DATA_PRESENTATION_KEYS,
      "BrowserReadModel.render.dataPresentation",
    );
    assertExactKeys(
      render.markerPresentation,
      MARKER_PRESENTATION_KEYS,
      "BrowserReadModel.render.markerPresentation",
    );
    assertExactKeys(
      render.alienPresentation,
      ALIEN_PRESENTATION_KEYS,
      "BrowserReadModel.render.alienPresentation",
    );
    assertExactKeys(
      render.techTilePresentation,
      TECH_TILE_PRESENTATION_KEYS,
      "BrowserReadModel.render.techTilePresentation",
    );
    assertExactKeys(
      render.finalScorePresentation,
      FINAL_SCORE_PRESENTATION_KEYS,
      "BrowserReadModel.render.finalScorePresentation",
    );
    assertArray(render.tokenPresentation.tokens, "BrowserReadModel.render.tokenPresentation.tokens");
    assertArray(render.playerPanels.players, "BrowserReadModel.render.playerPanels.players");
    assertArray(render.cardPanels.publicCards, "BrowserReadModel.render.cardPanels.publicCards");
    assertArray(render.cardPanels.handCards, "BrowserReadModel.render.cardPanels.handCards");
  }

  function assertReadModel(readModel) {
    assertExactKeys(readModel, READ_MODEL_KEYS, "BrowserReadModel");
    if (readModel.schemaVersion !== SCHEMA_VERSION) {
      throw new TypeError(`BrowserReadModel schemaVersion 不支持：${readModel.schemaVersion || "<missing>"}`);
    }
    assertRender(readModel.render);
    if (!Object.isFrozen(readModel)) throw new TypeError("BrowserReadModel 必须深冻结");
    return readModel;
  }

  function createBrowserReadModelOwner(context = {}) {
    if (!context.solar?.createSolarSnapshot || !context.aliens?.getAlienSlot || !context.tech) {
      throw new TypeError("BrowserReadModel owner 缺少 solar/aliens/tech 规则依赖");
    }
    function project(state, options = {}) {
      if (!state || typeof state !== "object" || Array.isArray(state)) {
        throw new TypeError("BrowserReadModel owner 需要 StateSource state");
      }
      const players = listPlayers(state);
      const turnFlow = createTurnFlow(state, players);
      const boardCoordinate = createBoardCoordinate(context, state);
      const readModel = deepFreeze({
        schemaVersion: SCHEMA_VERSION,
        render: createRender(state, options, players, turnFlow, boardCoordinate),
      });
      return assertReadModel(readModel);
    }

    return Object.freeze({ project });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    READ_MODEL_KEYS,
    RENDER_KEYS,
    assertReadModel,
    createBrowserReadModelOwner,
  });
});

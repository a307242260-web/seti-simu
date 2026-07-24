(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserReadModel = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-read-model-v1";
  const READ_MODEL_KEYS = Object.freeze([
    "schemaVersion", "events", "actionInteraction", "turnFlow", "boardCoordinate", "runtime", "render",
  ]);
  const RUNTIME_KEYS = Object.freeze([
    "playerTurn", "effectPresentation", "cardUi", "solarBriefing", "alienBoard",
  ]);
  const EVENT_KEYS = Object.freeze([
    "alienRoutesBySlotId", "fangzhouRevealedSlotId", "aomomoRevealedSlotId", "clickableTechTileIds",
  ]);
  const ALIEN_ROUTE_KEYS = Object.freeze(["slotId", "revealed", "alienId", "route"]);
  const ACTION_INTERACTION_KEYS = Object.freeze(["activeRocketId", "industryBorrowMode"]);
  const TURN_FLOW_KEYS = Object.freeze([
    "roundNumber", "turnNumber", "displayedTurnNumber", "actionCycleNumber",
    "currentPlayerId", "turnOrderPlayerIds", "activePlayerIds", "roundOrderPlayerIds",
    "passedPlayerIds", "completedTurnPlayerIds", "terminal", "gameEndReason",
    "playerLabelsById", "playerAgentLabelsById",
  ]);
  const BOARD_COORDINATE_KEYS = Object.freeze([
    "tokens", "activeRocketId", "planetLocations", "visibleContents",
  ]);
  const TOKEN_KEYS = Object.freeze([
    "id", "playerId", "color", "kind", "surface", "radius", "angleDegrees", "x", "y",
    "sectorCoordinate", "slotSectorCoordinate", "slotIndex", "planetsReference",
    "referencePlacement", "tokenSrc", "cargo", "chongDelivered", "movable", "controllable",
  ]);
  const RENDER_KEYS = Object.freeze([
    "boardChrome", "tokenPresentation", "playerPanels", "turnPresentation", "cardPanels",
    "dataPresentation", "markerPresentation", "techTilePresentation",
    "finalScorePresentation", "readoutLines",
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
  const TECH_TILE_PRESENTATION_KEYS = Object.freeze(["supplyTiles", "playerTiles"]);
  const FINAL_SCORE_PRESENTATION_KEYS = Object.freeze(["breakdownsByPlayerId"]);

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
    const source = state?.players?.players ?? state?.players ?? [];
    return Array.isArray(source) ? source : Object.values(source);
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
    const roundNumber = Math.max(1, Number(turn.roundNumber ?? turn.round) || 1);
    const turnNumber = Math.max(1, Number(turn.turnNumber ?? turn.turn) || 1);
    const playerLabelsById = {};
    const playerAgentLabelsById = {};
    for (const player of players) {
      const id = String(player?.id);
      playerLabelsById[id] = player?.colorLabel || player?.name || player?.id || id;
      playerAgentLabelsById[id] = player?.aiEnabled
        ? `AI${player.aiDifficulty ? `(${player.aiDifficulty})` : ""}`
        : "玩家";
    }
    return {
      roundNumber,
      turnNumber,
      displayedTurnNumber: Math.floor((turnNumber - 1) / activeCount) + 1,
      actionCycleNumber: Math.max(1, Number(turn.actionCycleNumber ?? turn.actionCycle) || 1),
      currentPlayerId: turn.currentPlayerId ?? state?.players?.currentPlayerId ?? null,
      turnOrderPlayerIds,
      activePlayerIds,
      roundOrderPlayerIds,
      passedPlayerIds: clone(turn.passedPlayerIds || []),
      completedTurnPlayerIds: clone(turn.completedTurnPlayerIds || []),
      terminal: Boolean(turn.gameEnded || state?.match?.terminal),
      gameEndReason: turn.gameEndReason || null,
      playerLabelsById,
      playerAgentLabelsById,
    };
  }

  function createAlienRoute(context, alienState, slotId) {
    const slot = context.aliens.getAlienSlot(alienState, slotId);
    const alienId = slot?.revealed ? slot.alienId || null : null;
    return {
      slotId,
      revealed: Boolean(slot?.revealed),
      alienId,
      route: alienId && context.alienRouteIds.has(alienId) ? alienId : "standard",
    };
  }

  function createEvents(context, state, players, turnFlow) {
    const alienState = state?.aliens || {};
    const alienRoutesBySlotId = Object.fromEntries((context.aliens.ALIEN_SLOT_IDS || []).map((slotId) => [
      String(slotId),
      createAlienRoute(context, alienState, slotId),
    ]));
    const currentPlayer = players.find(
      (player) => String(player?.id) === String(turnFlow.currentPlayerId),
    ) || null;
    const techState = state?.tech || {};
    const selectionActive = context.tech.isSupplySelectionActive?.(techState.ui || {}) === true;
    const clickableTechTileIds = selectionActive
      ? context.tech.listTakeableTiles?.(techState.board || {}, currentPlayer?.techState || {}, {}) || []
      : [];
    return {
      alienRoutesBySlotId,
      fangzhouRevealedSlotId: alienState.fangzhou?.revealedSlotId ?? null,
      aomomoRevealedSlotId: alienState.aomomo?.revealedSlotId ?? null,
      clickableTechTileIds: [...new Set(clickableTechTileIds.map(String))],
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
      planetsReference: clone(token?.planetsReference ?? null),
      referencePlacement: clone(token?.referencePlacement ?? null),
      tokenSrc: token?.tokenSrc ?? null,
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

  function createFallbackRender(turnFlow, boardCoordinate) {
    return {
      boardChrome: {
        wheelTransforms: [],
        sectors: [],
        aomomoWheelImageSrc: null,
        rotateTokenSlot: null,
      },
      tokenPresentation: {
        activeRocketId: boardCoordinate.activeRocketId,
        draggingRocketId: null,
        tokens: [],
      },
      playerPanels: {
        currentPlayerId: turnFlow.currentPlayerId,
        interfacePlayerId: null,
        players: [],
      },
      turnPresentation: clone(turnFlow),
      cardPanels: {
        publicCards: [],
        handCards: [],
        publicControls: {},
        handPanel: {},
        initialSelection: {},
        reservedCards: {},
      },
      dataPresentation: {
        playerTokens: [],
        blueDropZones: [],
        sectorTokensBySectorId: {},
        aomomoTokens: [],
      },
      markerPresentation: {
        anomalies: [],
        planetFossils: [],
        runezuSymbols: [],
      },
      techTilePresentation: { supplyTiles: [], playerTiles: [] },
      finalScorePresentation: { breakdownsByPlayerId: {} },
      readoutLines: [],
    };
  }

  function createRuntime(presentationState, turnFlow) {
    const players = listPlayers(presentationState);
    const playerState = {
      currentPlayerId: turnFlow.currentPlayerId,
      players: clone(players),
    };
    return {
      playerTurn: {
        players: playerState,
        turn: clone(turnFlow),
      },
      effectPresentation: clone(presentationState?.effectPresentation || null),
      cardUi: clone(presentationState?.cards?.ui || {}),
      solarBriefing: {
        sectorBySlot: clone(presentationState?.solarSystem?.sectorBySlot || {}),
      },
      alienBoard: {
        alienGameState: clone(presentationState?.aliens || {}),
        playerState,
      },
    };
  }

  function createRender(state, options, players, turnFlow, boardCoordinate) {
    const presentationState = deepFreeze(clone(options.presentationState || state));
    const presentationPlayers = deepFreeze(clone(options.presentationPlayers || players));
    const render = options.createRenderPresentation?.({
      state: presentationState,
      players: presentationPlayers,
      turnFlow,
      boardCoordinate,
      viewer: options.viewer || null,
      finalReadModel: deepFreeze(clone(options.finalReadModel || null)),
    }) || createFallbackRender(turnFlow, boardCoordinate);
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
    assertArray(render.readoutLines, "BrowserReadModel.render.readoutLines");
  }

  function assertReadModel(readModel) {
    assertExactKeys(readModel, READ_MODEL_KEYS, "BrowserReadModel");
    if (readModel.schemaVersion !== SCHEMA_VERSION) {
      throw new TypeError(`BrowserReadModel schemaVersion 不支持：${readModel.schemaVersion || "<missing>"}`);
    }
    assertExactKeys(readModel.events, EVENT_KEYS, "BrowserReadModel.events");
    for (const route of Object.values(readModel.events.alienRoutesBySlotId)) {
      assertExactKeys(route, ALIEN_ROUTE_KEYS, "BrowserReadModel.events.alienRoute");
    }
    assertExactKeys(
      readModel.actionInteraction,
      ACTION_INTERACTION_KEYS,
      "BrowserReadModel.actionInteraction",
    );
    assertExactKeys(readModel.turnFlow, TURN_FLOW_KEYS, "BrowserReadModel.turnFlow");
    assertExactKeys(readModel.boardCoordinate, BOARD_COORDINATE_KEYS, "BrowserReadModel.boardCoordinate");
    assertExactKeys(readModel.runtime, RUNTIME_KEYS, "BrowserReadModel.runtime");
    for (const token of readModel.boardCoordinate.tokens) {
      assertExactKeys(token, TOKEN_KEYS, "BrowserReadModel.boardCoordinate.token");
    }
    assertRender(readModel.render);
    if (!Object.isFrozen(readModel)) throw new TypeError("BrowserReadModel 必须深冻结");
    return readModel;
  }

  function createBrowserReadModelOwner(context = {}) {
    if (!context.solar?.createSolarSnapshot || !context.aliens?.getAlienSlot || !context.tech) {
      throw new TypeError("BrowserReadModel owner 缺少 solar/aliens/tech 规则依赖");
    }
    const alienRouteIds = new Set([
      context.aliens.JIUZHE_ALIEN_ID,
      context.aliens.YICHANGDIAN_ALIEN_ID,
      context.aliens.FANGZHOU_ALIEN_ID,
      context.aliens.BANRENMA_ALIEN_ID,
      context.aliens.CHONG_ALIEN_ID,
      context.aliens.AMIBA_ALIEN_ID,
      context.aliens.AOMOMO_ALIEN_ID,
      context.aliens.RUNEZU_ALIEN_ID,
    ].filter(Boolean));
    const ownerContext = { ...context, alienRouteIds };

    function project(state, options = {}) {
      if (!state || typeof state !== "object" || Array.isArray(state)) {
        throw new TypeError("BrowserReadModel owner 需要 StateSource state");
      }
      const players = listPlayers(state);
      const turnFlow = createTurnFlow(state, players);
      const boardCoordinate = createBoardCoordinate(ownerContext, state);
      const presentationState = options.presentationState || state;
      const readModel = deepFreeze({
        schemaVersion: SCHEMA_VERSION,
        events: createEvents(ownerContext, state, players, turnFlow),
        actionInteraction: {
          activeRocketId: boardCoordinate.activeRocketId,
          industryBorrowMode: Boolean(state?.tech?.ui?.industryBorrowMode),
        },
        turnFlow,
        boardCoordinate,
        runtime: createRuntime(presentationState, turnFlow),
        render: createRender(state, options, players, turnFlow, boardCoordinate),
      });
      return assertReadModel(readModel);
    }

    return Object.freeze({ project });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    READ_MODEL_KEYS,
    EVENT_KEYS,
    ACTION_INTERACTION_KEYS,
    TURN_FLOW_KEYS,
    BOARD_COORDINATE_KEYS,
    RUNTIME_KEYS,
    TOKEN_KEYS,
    RENDER_KEYS,
    assertReadModel,
    createBrowserReadModelOwner,
  });
});

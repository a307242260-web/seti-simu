(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserResidentProjection = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-host-v1";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function listPlayers(playerState) {
    if (Array.isArray(playerState?.players)) return playerState.players;
    if (playerState?.players && typeof playerState.players === "object") {
      return Object.values(playerState.players);
    }
    return [];
  }

  function publicPlayer(player, own) {
    const result = {
      id: player?.id == null ? null : String(player.id),
      name: player?.name || player?.colorLabel || player?.id || "玩家",
      color: player?.color || null,
      colorLabel: player?.colorLabel || null,
      resources: clone(player?.resources || {}),
      income: clone(player?.income || {}),
      passed: Boolean(player?.passed),
      tech: clone(player?.techState?.ownedTiles || player?.tech || {}),
    };
    result.handCount = Array.isArray(player?.hand)
      ? player.hand.length
      : Number(player?.resources?.handSize) || 0;
    result.reservedCount = Array.isArray(player?.reservedCards) ? player.reservedCards.length : 0;
    if (own) {
      result.hand = clone(player?.hand || []);
      result.reserved = clone(player?.reservedCards || []);
    }
    return result;
  }

  function normalizeCards(cards) {
    return (cards || []).map((card) => (card ? {
      id: card.id ?? null,
      cardId: card.cardId ?? null,
      cardName: card.cardName || card.label || null,
      src: card.src || (card.cardId ? `../assets/basic_cards/${card.cardId}` : null),
      type: card.type ?? card.cardType ?? null,
    } : null));
  }

  function createResidentProjection(input = {}) {
    const viewerPlayer = input.viewerPlayer || input.getViewerPlayer?.() || null;
    const viewerId = input.viewer?.viewerId || `browser:${viewerPlayer?.id || "spectator"}`;
    const role = input.viewer?.role || (viewerPlayer ? "player" : "spectator");
    const players = {};
    for (const player of listPlayers(input.playerState)) {
      if (!player?.id) continue;
      players[player.id] = publicPlayer(player, role === "player" && player.id === viewerPlayer?.id);
    }
    const publicCards = normalizeCards(input.cardState?.publicCards || input.cardState?.market || []);
    const turnState = input.turnState || {};
    const rotation = input.solarState?.rotation?.rotationCount
      ?? input.solarState?.rotation
      ?? input.solarState?.rotationCount
      ?? 0;
    const projection = {
      schemaVersion: SCHEMA_VERSION,
      projectionId: input.projectionId || `legacy-resident:${input.stateVersion ?? "working"}`,
      source: {
        kind: input.sourceKind || "session",
        stateVersion: input.stateVersion ?? null,
        sessionId: input.sessionId ?? null,
        sessionRevision: input.sessionRevision ?? null,
        phase: input.phase || "legacy-adapter",
      },
      viewer: {
        viewerId: String(viewerId),
        playerId: viewerPlayer?.id == null ? null : String(viewerPlayer.id),
        role,
      },
      match: {
        round: Number(turnState.roundNumber ?? turnState.round ?? 1),
        turn: Number(input.displayedTurn ?? turnState.turnNumber ?? turnState.turn ?? 1),
        currentPlayerId: input.playerState?.currentPlayerId ?? turnState.currentPlayerId ?? null,
        activePlayerId: input.playerState?.currentPlayerId ?? turnState.currentPlayerId ?? null,
        terminal: Boolean(turnState.gameEnded),
      },
      board: {
        solarSystem: { rotation: Number(rotation) || 0 },
        pieces: { public: clone(input.rocketState?.rockets || input.rocketState?.pieces || []) },
        planets: clone(input.planetStatsState || {}),
        data: clone(input.nebulaDataState || {}),
        finalScoring: clone(input.finalScoringState || {}),
      },
      players,
      cards: {
        hand: normalizeCards(viewerPlayer?.hand || []),
        reserved: normalizeCards(viewerPlayer?.reservedCards || []),
        market: publicCards,
        discard: [],
        deckCount: Number(input.cardState?.drawPile?.length ?? input.cardState?.drawPileCardIds?.length) || 0,
        opponentCounts: Object.fromEntries(Object.entries(players)
          .filter(([playerId]) => playerId !== viewerPlayer?.id)
          .map(([playerId, player]) => [playerId, { hand: player.handCount, reserved: player.reservedCount }])),
      },
      tech: {
        supply: clone(input.techGameState?.board || input.techGameState?.supply || {}),
        publicBoards: {},
        tracks: {},
      },
      aliens: {},
      controls: { actions: [], quickActions: [], canUndo: false, canEndTurn: false },
      decision: null,
      feedback: { events: [], logs: [], progress: null, notices: [] },
    };
    return deepFreeze(projection);
  }

  return Object.freeze({ SCHEMA_VERSION, createResidentProjection });
});

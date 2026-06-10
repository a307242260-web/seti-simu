(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiPlayers = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const PLAYER_COLORS = Object.freeze({
    blue: Object.freeze({
      id: "blue",
      label: "蓝色",
      rocketAsset: "../assets/tokens/rocket-blue.png",
      uiColor: "#4da3ff",
      glowColor: "rgba(77, 163, 255, 0.72)",
    }),
    green: Object.freeze({
      id: "green",
      label: "绿色",
      rocketAsset: "../assets/tokens/rocket-green.png",
      uiColor: "#56d37a",
      glowColor: "rgba(86, 211, 122, 0.72)",
    }),
    brown: Object.freeze({
      id: "brown",
      label: "棕色",
      rocketAsset: "../assets/tokens/rocket-brown.png",
      uiColor: "#b2845a",
      glowColor: "rgba(178, 132, 90, 0.7)",
    }),
    white: Object.freeze({
      id: "white",
      label: "白色",
      rocketAsset: "../assets/tokens/rocket-white.png",
      uiColor: "#f3f5ef",
      glowColor: "rgba(243, 245, 239, 0.74)",
    }),
  });
  const PLAYER_COLOR_IDS = Object.freeze(Object.keys(PLAYER_COLORS));
  const DEFAULT_PLAYER_COLOR = "white";
  const RESOURCE_LIMITS = Object.freeze({
    publicity: 10,
    availableData: 6,
  });
  const DEFAULT_RESOURCES = Object.freeze({
    credits: 0,
    energy: 0,
    publicity: 0,
    availableData: 0,
    handSize: 0,
    score: 0,
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizePlayerColor(color) {
    const key = String(color || DEFAULT_PLAYER_COLOR).toLowerCase();
    return PLAYER_COLORS[key] ? key : DEFAULT_PLAYER_COLOR;
  }

  function normalizeResources(resources) {
    const source = resources || {};
    const result = {};

    for (const [key, fallback] of Object.entries(DEFAULT_RESOURCES)) {
      const value = normalizeNumber(source[key], fallback);
      result[key] = Number.isInteger(value) ? value : Math.round(value * 100) / 100;
    }

    result.publicity = clamp(result.publicity, 0, RESOURCE_LIMITS.publicity);
    result.availableData = clamp(result.availableData, 0, RESOURCE_LIMITS.availableData);

    return result;
  }

  function createPlayer(input) {
    const source = input || {};
    const color = normalizePlayerColor(source.color);
    const definition = PLAYER_COLORS[color];

    return {
      id: source.id || `player-${color}`,
      color,
      colorLabel: definition.label,
      name: source.name || `${definition.label}玩家`,
      resources: normalizeResources(source.resources),
    };
  }

  function createPlayerState(input) {
    const source = input || {};
    const player = createPlayer(source.currentPlayer || source.player || { color: DEFAULT_PLAYER_COLOR });

    return {
      players: [player],
      currentPlayerId: player.id,
    };
  }

  function getCurrentPlayer(playerState) {
    if (!playerState || !Array.isArray(playerState.players)) return null;
    return playerState.players.find((player) => player.id === playerState.currentPlayerId)
      || playerState.players[0]
      || null;
  }

  function getPlayerColorDefinition(color) {
    return PLAYER_COLORS[normalizePlayerColor(color)];
  }

  return Object.freeze({
    PLAYER_COLORS,
    PLAYER_COLOR_IDS,
    DEFAULT_PLAYER_COLOR,
    RESOURCE_LIMITS,
    DEFAULT_RESOURCES,
    normalizePlayerColor,
    normalizeResources,
    createPlayer,
    createPlayerState,
    getCurrentPlayer,
    getPlayerColorDefinition,
  });
});

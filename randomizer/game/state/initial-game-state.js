(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiInitialGameState = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function clone(value) {
    return structuredClone(value);
  }

  function createInitialState(modules, options = {}) {
    const playersState = modules.players.createPlayerState({
      players: modules.players.PLAYER_COLOR_IDS.map((color) => ({ color })),
      currentPlayerColor: options.defaultInitialPlayerColor,
    });
    const currentPlayerId = playersState.currentPlayerId;
    delete playersState.currentPlayerId;
    const aliensState = modules.aliens.createDefaultAlienState();
    const randomizedAliens = modules.aliens.randomizeAlienAssignments(aliensState, {
      alienPoolIds: options.alienPoolIds,
      random: options.random,
    });
    if (!randomizedAliens?.ok) {
      throw new Error(randomizedAliens?.message || "外星人初始分配失败");
    }
    const techState = modules.tech.createState(options.random);
    return {
      meta: {
        schemaVersion: options.schemaVersion,
        stateVersion: Number(options.stateVersion) || 0,
        gameId: options.gameId || "seti-browser-runtime",
        rulesetVersion: options.rulesetVersion || "seti-runtime-v1",
        seed: options.seed ?? "browser-host",
        rngState: clone(options.rngState || {}),
        sequences: clone(options.sequences || {}),
      },
      match: {},
      turn: {
        ...modules.createTurnState(playersState.players, {
          activePlayerCount: options.activePlayerCount,
          currentPlayerId,
        }),
        currentPlayerId,
      },
      players: playersState,
      solarSystem: modules.solar.createBaselineState(),
      pieces: modules.rocketActions.createRocketState(),
      planets: modules.planetStats.createPlanetStatsState(),
      data: modules.data.createDefaultNebulaDataState(),
      cards: modules.cards.createCardState(),
      tech: techState,
      aliens: aliensState,
      finalScoring: modules.finalScoring.createFinalScoringState(options.finalScoreIds || []),
    };
  }

  return Object.freeze({ createInitialState });
});

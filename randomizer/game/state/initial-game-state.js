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

  function createSessionState(modules, options = {}) {
    const playerState = modules.players.createPlayerState({
      players: modules.players.PLAYER_COLOR_IDS.map((color) => ({ color })),
      currentPlayerColor: options.defaultInitialPlayerColor,
    });
    return {
      meta: {},
      match: {},
      turnState: modules.createTurnState(playerState.players, {
        activePlayerCount: options.activePlayerCount,
        currentPlayerId: playerState.currentPlayerId,
      }),
      playerState,
      solarState: modules.solar.createBaselineState(),
      rocketState: modules.rocketActions.createRocketState(),
      planetStatsState: modules.planetStats.createPlanetStatsState(),
      nebulaDataState: modules.data.createDefaultNebulaDataState(),
      cardState: modules.cards.createCardState(),
      techGameState: modules.tech.createState(options.random),
      alienGameState: modules.aliens.createDefaultAlienState(),
      finalScoringState: modules.finalScoring.createFinalScoringState(options.finalScoreIds || []),
    };
  }

  function createCommittedCandidate(sessionState, context, schemaVersion, stateVersion) {
    return {
      meta: {
        schemaVersion,
        stateVersion,
        gameId: context.gameId || "seti-browser-runtime",
        rulesetVersion: context.rulesetVersion || "seti-runtime-v1",
        seed: context.seed ?? "browser-host",
        rngState: clone(context.rngState || { owner: context.simulationMode ? "simulation" : "browser", state: null }),
        sequences: clone(context.sequences || {}),
      },
      match: clone(sessionState.match),
      turn: { ...clone(sessionState.turnState), currentPlayerId: sessionState.playerState.currentPlayerId },
      players: clone(sessionState.playerState),
      solarSystem: clone(sessionState.solarState),
      pieces: clone(sessionState.rocketState),
      planets: clone(sessionState.planetStatsState),
      data: clone(sessionState.nebulaDataState),
      cards: clone(sessionState.cardState),
      tech: clone(sessionState.techGameState),
      aliens: clone(sessionState.alienGameState),
      finalScoring: clone(sessionState.finalScoringState),
    };
  }

  function restoreSessionState(sessionState, state, replaceMutableObject) {
    const read = (key) => state[key];
    const mappings = [
      ["solarState", "solarSystem"],
      ["nebulaDataState", "data"],
      ["alienGameState", "aliens"],
      ["finalScoringState", "finalScoring"],
      ["planetStatsState", "planets"],
    ];
    for (const [target, source] of mappings) replaceMutableObject(sessionState[target], read(source));
    replaceMutableObject(sessionState.match, read("match"));
    replaceMutableObject(sessionState.playerState, {
      ...read("players"),
      currentPlayerId: read("turn").currentPlayerId ?? null,
    });
    const restoredTurn = clone(read("turn"));
    delete restoredTurn.currentPlayerId;
    replaceMutableObject(sessionState.turnState, restoredTurn);
    replaceMutableObject(sessionState.rocketState, {
      ...read("pieces"),
      nextRocketId: read("meta").sequences.rocket,
      playerRocketSequences: Object.fromEntries(Object.entries(
        read("pieces").playerRocketSequences || {},
      ).map(([playerId, values]) => [playerId, new Set(values)])),
      statusNote: sessionState.rocketState.statusNote,
    });
    replaceMutableObject(sessionState.techGameState, {
      board: read("tech"),
      ui: clone(sessionState.techGameState.ui || {}),
    });
    replaceMutableObject(sessionState.cardState, {
      ...read("cards"),
      ui: clone(sessionState.cardState.ui || {}),
    });
    sessionState.meta = clone(read("meta"));
    return sessionState;
  }

  return Object.freeze({ createSessionState, createCommittedCandidate, restoreSessionState });
});

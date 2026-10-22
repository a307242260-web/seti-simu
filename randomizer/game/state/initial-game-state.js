(function (root, factory) {
  "use strict";

  const randomApi = typeof require === "function" ? require("../random") : root.SetiRandom;
  const fixedWorld = typeof require === "function" ? require("./fixed-world-config") : root.SetiFixedWorldConfig;
  const api = factory(randomApi, fixedWorld);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiInitialGameState = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (randomApi, fixedWorld) {
  "use strict";

  function clone(value) {
    return structuredClone(value);
  }

  function createInitialState(modules, options = {}) {
    const fixedConfig = fixedWorld.getFixedWorldConfig(options.seed);
    const playersState = modules.players.createPlayerState({
      players: modules.players.PLAYER_COLOR_IDS.map((color) => ({ color })),
    });
    const currentPlayerId = playersState.players.find(
      (player) => player.color === options.defaultInitialPlayerColor,
    )?.id || playersState.players[0]?.id || null;
    const turnState = modules.createTurnState(playersState.players, {
      activePlayerCount: options.activePlayerCount,
      currentPlayerId,
    });
    const aliensState = modules.aliens.createDefaultAlienState();
    const randomizedAliens = modules.aliens.randomizeAlienAssignments(aliensState, {
      alienPoolIds: options.alienPoolIds,
      seed: options.seed,
      // 独立开局流：新增物种分配不移动盘面、科技和普通牌的随机游标。
      random: randomApi.createSeededRandom(`${options.seed ?? "browser-host"}:alien-assignments-v1`),
    });
    if (!randomizedAliens?.ok) {
      throw new Error(randomizedAliens?.message || "外星人初始分配失败");
    }
    const speciesKeys = ["amiba", "chong", "aomomo", "banrenma", "runezu", "yichangdian", "jiuzhe", "fangzhou"];
    for (const [slotId, alienId] of Object.entries(randomizedAliens.assignments)) {
      const key = speciesKeys.find(speciesKey => modules.aliens[speciesKey].ALIEN_ID === alienId);
      if (!key) throw new Error(`外星人配置缺少物种实现：${alienId}`);
      const configurationRandom = randomApi.createSeededRandom(
        `${options.seed ?? "browser-host"}:alien-configuration-v1:${slotId}:${key}`,
      );
      aliensState[key].initialConfiguration = fixedConfig
        ? clone(fixedConfig.alienConfigurations[key])
        : modules.aliens[key].createInitialConfiguration(configurationRandom, playersState.players);
      if (!aliensState[key].initialConfiguration) throw new Error(`固定盘面缺少${key}配置`);
    }
    const techState = modules.tech.createState(options.random);
    return {
      meta: {
        schemaVersion: options.schemaVersion,
        stateVersion: Number(options.stateVersion) || 0,
        gameId: options.gameId || "seti-browser-runtime",
        rulesetVersion: options.rulesetVersion || "seti-runtime-v1.3",
        seed: options.seed ?? "browser-host",
        worldVersion: fixedWorld.getWorldVersion(options.seed),
        rngState: clone(options.rngState || {}),
        sequences: clone(options.sequences || {}),
      },
      match: {},
      turn: {
        ...turnState,
        currentPlayerId: turnState.activePlayerIds.includes(currentPlayerId)
          ? currentPlayerId : turnState.startPlayerId,
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

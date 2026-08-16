(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiPlayers = api;})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const PLAYER_COLORS = Object.freeze({
    blue: Object.freeze({
      id: "blue",
      label: "蓝色",
      rocketAsset: "../assets/tokens/rocket-blue.png",
      satelliteAsset: "../assets/tokens/satellite-blue.png",
      landdingAsset: "../assets/tokens/landding-blue.png",
      normalTokenAsset: "../assets/tokens/normal_token-blue.png",
      uiColor: "#4da3ff",
      glowColor: "rgba(77, 163, 255, 0.72)",
    }),
    green: Object.freeze({
      id: "green",
      label: "绿色",
      rocketAsset: "../assets/tokens/rocket-green.png",
      satelliteAsset: "../assets/tokens/satellite-green.png",
      landdingAsset: "../assets/tokens/landding-green.png",
      normalTokenAsset: "../assets/tokens/normal_token-green.png",
      uiColor: "#56d37a",
      glowColor: "rgba(86, 211, 122, 0.72)",
    }),
    brown: Object.freeze({
      id: "brown",
      label: "棕色",
      rocketAsset: "../assets/tokens/rocket-brown.png",
      satelliteAsset: "../assets/tokens/satellite-brown.png",
      landdingAsset: "../assets/tokens/landding-brown.png",
      normalTokenAsset: "../assets/tokens/normal_token-brown.png",
      uiColor: "#b2845a",
      glowColor: "rgba(178, 132, 90, 0.7)",
    }),
    white: Object.freeze({
      id: "white",
      label: "白色",
      rocketAsset: "../assets/tokens/rocket-white.png",
      satelliteAsset: "../assets/tokens/satellite-white.png",
      landdingAsset: "../assets/tokens/landding-white.png",
      normalTokenAsset: "../assets/tokens/normal_token-white.png",
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
    credits: 10,
    energy: 10,
    publicity: 0,
    availableData: 0,
    aomomoFossils: 0,
    additionalPublicScan: 0,
    handSize: 0,
    score: 0,
  });
  const DEFAULT_INCOME = Object.freeze({
    credits: 0,
    energy: 0,
    handSize: 0,
    publicity: 0,
    availableData: 0,
    additionalPublicScan: 0,
  });
  let scoreGainListener = null;

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

  function normalizeHandCard(card, index) {
    if (!card || typeof card !== "object" || Array.isArray(card) || !card.id) {
      throw new TypeError(`手牌 ${index} 必须是带全局唯一 id 的 canonical card instance`);
    }
    return structuredClone(card);
  }

  function normalizeHand(sourceHand) {
    return Array.isArray(sourceHand) ? sourceHand.map(normalizeHandCard) : [];
  }

  function syncHandSize(player) {
    player.resources.handSize = player.hand.length;
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

  function normalizeIncome(income) {
    const source = income || {};
    const result = {};

    for (const [key, fallback] of Object.entries(DEFAULT_INCOME)) {
      const value = normalizeNumber(source[key], fallback);
      result[key] = Math.max(0, Number.isInteger(value) ? value : Math.round(value * 100) / 100);
    }

    return result;
  }

  function normalizeScoreSources(scoreSources) {
    const source = scoreSources && typeof scoreSources === "object" ? scoreSources : {};
    const result = {};
    for (const [key, value] of Object.entries(source)) {
      const number = normalizeNumber(value, 0);
      if (number !== 0) result[key] = Number.isInteger(number) ? number : Math.round(number * 100) / 100;
    }
    return result;
  }

  function createDefaultPlayerTechState() {
    return { ownedTiles: {}, disabledTiles: {}, blueBoardSlots: {} };
  }

  function rejectLegacyPlayerTechState(source) {
    for (const field of ["ownedTileByType", "blueBoardSlot"]) {
      if (source && Object.hasOwn(source, field)) {
        const error = new TypeError(`techState.${field} 已废弃；只接受 ownedTiles/disabledTiles/blueBoardSlots`);
        error.code = "PLAYER_TECH_LEGACY_FIELD_FORBIDDEN";
        error.path = `$.techState.${field}`;
        throw error;
      }
    }
  }

  function normalizePlayerTechState(source) {
    rejectLegacyPlayerTechState(source);
    const ownedTiles = {};
    const disabledTiles = {};
    const blueBoardSlots = {};

    if (source?.ownedTiles && typeof source.ownedTiles === "object") {
      for (const [tileId, owned] of Object.entries(source.ownedTiles)) {
        if (owned) ownedTiles[tileId] = true;
      }
    }

    if (source?.disabledTiles && typeof source.disabledTiles === "object") {
      for (const [tileId, disabled] of Object.entries(source.disabledTiles)) {
        if (disabled && ownedTiles[tileId]) disabledTiles[tileId] = true;
      }
    }

    if (source?.blueBoardSlots && typeof source.blueBoardSlots === "object") {
      for (const [tileId, slot] of Object.entries(source.blueBoardSlots)) {
        const normalizedSlot = Number(slot);
        if (ownedTiles[tileId] && [1, 2, 3, 4].includes(normalizedSlot)) {
          blueBoardSlots[tileId] = normalizedSlot;
        }
      }
    }

    return { ownedTiles, disabledTiles, blueBoardSlots };
  }

  function createPlayer(input) {
    const source = input || {};
    const color = normalizePlayerColor(source.color);
    const definition = PLAYER_COLORS[color];
    const playerId = source.id || `player-${color}`;
    const orbitCount = normalizeNumber(source.orbitCount, 0);
    const resources = normalizeResources(source.resources);
    const income = normalizeIncome(source.income);
    const hand = normalizeHand(source.hand);
    const reservedCards = Array.isArray(source.reservedCards)
      ? source.reservedCards.map(normalizeHandCard)
      : [];

    resources.handSize = hand.length;

    return {
      id: playerId,
      color,
      name: source.name || `${definition.label}玩家`,
      resources,
      income,
      hand,
      reservedCards,
      techState: normalizePlayerTechState(source.techState),
      scoreSources: normalizeScoreSources(source.scoreSources),
      orbitCount: Number.isInteger(orbitCount) ? orbitCount : Math.round(orbitCount),
    };
  }

  function formatResourceCost(cost) {
    const parts = [];
    if (cost.credits != null) parts.push(`${cost.credits}信用点`);
    if (cost.energy != null) parts.push(`${cost.energy}能量`);
    if (cost.publicity != null) parts.push(`${cost.publicity}宣传`);
    if (cost.aomomoFossils != null) parts.push(`${cost.aomomoFossils}化石`);
    if (cost.additionalPublicScan != null) parts.push(`${cost.additionalPublicScan}额外公共扫描`);
    if (cost.handSize != null) parts.push(`${cost.handSize}张牌`);
    return parts.join(" + ");
  }

  function canAfford(player, cost) {
    if (!player) return false;
    const resources = player.resources || {};
    const required = cost || {};

    if (required.credits != null && resources.credits < required.credits) return false;
    if (required.energy != null && resources.energy < required.energy) return false;
    if (required.publicity != null && resources.publicity < required.publicity) return false;
    if (required.aomomoFossils != null && (resources.aomomoFossils || 0) < required.aomomoFossils) return false;
    if (required.additionalPublicScan != null && resources.additionalPublicScan < required.additionalPublicScan) {
      return false;
    }
    if (required.handSize != null && resources.handSize < required.handSize) return false;

    return true;
  }

  function spendResources(player, cost) {
    const required = cost || {};
    if (!canAfford(player, required)) {
      return {
        ok: false,
        message: `资源不足，需要 ${formatResourceCost(required)}`,
      };
    }

    if (required.credits != null) player.resources.credits -= required.credits;
    if (required.energy != null) player.resources.energy -= required.energy;
    if (required.publicity != null) {
      player.resources.publicity = clamp(
        player.resources.publicity - required.publicity,
        0,
        RESOURCE_LIMITS.publicity,
      );
    }
    if (required.aomomoFossils != null) {
      player.resources.aomomoFossils = Math.max(
        0,
        (player.resources.aomomoFossils || 0) - required.aomomoFossils,
      );
    }
    if (required.additionalPublicScan != null) {
      player.resources.additionalPublicScan = Math.max(
        0,
        (player.resources.additionalPublicScan || 0) - required.additionalPublicScan,
      );
    }
    if (required.handSize != null) {
      const removeCount = Math.max(0, Math.round(required.handSize));
      player.hand.splice(-removeCount, removeCount);
      syncHandSize(player);
    }

    return { ok: true, message: null };
  }

  function gainResources(player, gain, scoreSourceKey = null) {
    const reward = gain || {};
    const beforeScore = Number(player?.resources?.score) || 0;
    if (reward.credits != null) player.resources.credits += reward.credits;
    if (reward.energy != null) player.resources.energy += reward.energy;
    if (reward.score != null) {
      player.resources.score += reward.score;
      // 终局计分的得分来源拆分（卡牌/踪迹/登陆/环绕/扫描/科技/任务等）
      if (scoreSourceKey) {
        player.scoreSources = player.scoreSources || {};
        player.scoreSources[scoreSourceKey] = (
          Number(player.scoreSources[scoreSourceKey]) || 0
        ) + reward.score;
      }
    }
    if (reward.aomomoFossils != null) {
      player.resources.aomomoFossils = Math.max(
        0,
        (player.resources.aomomoFossils || 0) + reward.aomomoFossils,
      );
    }
    if (reward.publicity != null) {
      player.resources.publicity = clamp(
        player.resources.publicity + reward.publicity,
        0,
        RESOURCE_LIMITS.publicity,
      );
    }
    if (reward.availableData != null) {
      player.resources.availableData = clamp(
        player.resources.availableData + reward.availableData,
        0,
        RESOURCE_LIMITS.availableData,
      );
    }
    if (reward.additionalPublicScan != null) {
      player.resources.additionalPublicScan = Math.max(
        0,
        (player.resources.additionalPublicScan || 0) + reward.additionalPublicScan,
      );
    }
    if (reward.handSize != null) {
      throw new TypeError("手牌不能作为普通资源增加；必须由 Card Domain 创建 canonical card instance");
    }
    if (typeof scoreGainListener === "function" && reward.score != null) {
      const afterScore = Number(player?.resources?.score) || 0;
      if (afterScore !== beforeScore) {
        scoreGainListener(player, {
          gain: { ...reward },
          beforeScore,
          afterScore,
          scoreDelta: afterScore - beforeScore,
        });
      }
    }
    return player;
  }

  function runWithScoreGainListener(listener, operation) {
    if (typeof operation !== "function") throw new TypeError("score gain operation 必须是函数");
    const previousListener = scoreGainListener;
    scoreGainListener = typeof listener === "function" ? listener : null;
    try {
      return operation();
    } finally {
      scoreGainListener = previousListener;
    }
  }

  const IMMEDIATE_INCOME_RESOURCE_KEYS = Object.freeze([
    "credits",
    "energy",
    "publicity",
    "additionalPublicScan",
  ]);

  function applyImmediateIncomeReward(player, gain, options = {}) {
    const reward = gain || {};
    const directResourceGain = {};

    for (const key of IMMEDIATE_INCOME_RESOURCE_KEYS) {
      if (reward[key] != null) {
        directResourceGain[key] = normalizeNumber(reward[key], 0);
      }
    }

    if (Object.keys(directResourceGain).length) {
      gainResources(player, directResourceGain);
    }

    const dataCount = Math.max(0, Math.round(normalizeNumber(reward.availableData, 0)));
    if (dataCount > 0) {
      if (typeof options.gainData === "function") {
        for (let index = 0; index < dataCount; index += 1) {
          options.gainData(player);
        }
      } else {
        gainResources(player, { availableData: dataCount });
      }
    }

    const handCount = Math.max(0, Math.round(normalizeNumber(reward.handSize, 0)));
    if (handCount > 0) {
      if (typeof options.blindDraw === "function") {
        for (let index = 0; index < handCount; index += 1) {
          options.blindDraw(player);
        }
      } else {
        throw new TypeError("盲抽收入需要 Card Domain blindDraw");
      }
    }
  }

  function gainIncome(player, gain, options = {}) {
    if (!player) return null;
    if (!player.income) player.income = normalizeIncome(null);
    const reward = gain || {};
    const normalizedGain = {};

    for (const key of Object.keys(DEFAULT_INCOME)) {
      if (reward[key] != null) {
        const value = normalizeNumber(reward[key], 0);
        if (value <= 0) continue;
        normalizedGain[key] = value;
        player.income[key] = Math.max(0, (player.income[key] || 0) + value);
      }
    }

    applyImmediateIncomeReward(player, normalizedGain, options);

    return player.income;
  }

  function incrementPlayerOrbitCount(playersState, playerId) {
    const player = playersState.players.find((item) => item.id === playerId);
    if (!player) return false;
    player.orbitCount += 1;
    return true;
  }

  function normalizeTurnContext(options = {}) {
    const source = options?.turn && typeof options.turn === "object"
      ? options.turn
      : options;
    const hasRoundNumber = source?.roundNumber != null;
    const hasTurnNumber = source?.turnNumber != null;
    const roundNumber = Math.max(0, Math.round(Number(source?.roundNumber) || 0));
    const turnNumber = Math.max(0, Math.round(Number(source?.turnNumber) || 0));
    return {
      roundNumber,
      turnNumber,
      hasTurnContext: hasRoundNumber || hasTurnNumber,
    };
  }

  function isBorrowedTechActive(player, tileId, options = {}) {
    if (!tileId || player?.industryBorrowedTechTileId !== tileId) return false;
    const { roundNumber, turnNumber, hasTurnContext } = normalizeTurnContext(options);
    if (!hasTurnContext) {
      return (Number(player?.industryBorrowedTechRound) || 0) > 0
        && (Number(player?.industryBorrowedTechTurn) || 0) > 0;
    }
    return roundNumber > 0
      && turnNumber > 0
      && player?.industryBorrowedTechRound === roundNumber
      && player?.industryBorrowedTechTurn === turnNumber;
  }

  function playerOwnsTech(player, tileId, options = {}) {
    if (Boolean(player?.techState?.ownedTiles?.[tileId]) && !player?.techState?.disabledTiles?.[tileId]) return true;
    return isBorrowedTechActive(player, tileId, options);
  }

  function createPlayerState(input) {
    const source = input || {};
    const sourcePlayers = Array.isArray(source.players) && source.players.length
      ? source.players
      : [source.currentPlayer || source.player || { color: DEFAULT_PLAYER_COLOR }];
    const normalizedPlayers = sourcePlayers.map(createPlayer);
    return {
      players: normalizedPlayers,
    };
  }

  function getCurrentPlayer(playersState, currentPlayerId = null) {
    if (!playersState || !Array.isArray(playersState.players)) return null;
    const resolvedPlayerId = currentPlayerId ?? null;
    return playersState.players.find((player) => player.id === resolvedPlayerId)
      || playersState.players[0]
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
    DEFAULT_INCOME,
    normalizePlayerColor,
    normalizeResources,
    normalizeIncome,
    normalizeScoreSources,
    createPlayer,
    createPlayerState,
    getCurrentPlayer,
    getPlayerColorDefinition,
    formatResourceCost,
    createDefaultPlayerTechState,
    normalizePlayerTechState,
    canAfford,
    spendResources,
    gainResources,
    runWithScoreGainListener,
    gainIncome,
    incrementPlayerOrbitCount,
    isBorrowedTechActive,
    playerOwnsTech,
  });
});

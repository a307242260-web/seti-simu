(function (root, factory) {
  "use strict";

  let stateStore = root.SetiStateStore;
  let lowCouplingState = root.SetiLowCouplingState;
  let cardTaskState = root.SetiCardTaskState;
  let techCatalog = root.SetiTechCatalog;
  if (typeof require === "function") {
    stateStore = stateStore || require("./state-store");
    lowCouplingState = lowCouplingState || require("./low-coupling-slices");
    cardTaskState = cardTaskState || require("../cards/task-state");
    techCatalog = techCatalog || require("../tech/catalog");
  }

  const api = factory(stateStore, lowCouplingState, cardTaskState, techCatalog);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiHighCouplingState = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  stateStore,
  lowCouplingState,
  cardTaskState,
  techCatalog,
) {
  "use strict";

  if (!stateStore) throw new Error("SetiStateStore is required before SetiHighCouplingState");
  if (!lowCouplingState) throw new Error("SetiLowCouplingState is required before SetiHighCouplingState");
  if (!cardTaskState) throw new Error("SetiCardTaskState is required before SetiHighCouplingState");
  if (!techCatalog) throw new Error("SetiTechCatalog is required before SetiHighCouplingState");

  const HIGH_COUPLING_SLICES = Object.freeze(["players", "pieces", "cards", "tech"]);
  const COORDINATED_SLICES = Object.freeze([...HIGH_COUPLING_SLICES, "planets"]);
  const FIELD_OWNERSHIP = Object.freeze({
    "players.players.*.resources/income/scoreSources": "committed",
    "players.players.*.hand/reservedCards/techState": "committed",
    "players.currentPlayerId/player labels/assets": "turn-owned/host-only:excluded",
    "pieces.rockets/activeRocketId/playerRocketSequences": "committed",
    "pieces presentation fields": "host-only:excluded",
    "cards.publicCards/discardPile/drawPileCardIds/passReservePiles": "committed",
    "cardTaskState": "derived:rebuildCardTaskIndex",
    "tech.stacks": "committed",
    "match.initialSetup": "Effect Session working state only; removed before commit",
    "meta.sequences.card/dataToken/rocket": "committed deterministic domain id allocation",
  });
  const HOST_KEYS = new Set([
    "ui", "tokenSrc", "src", "cardName", "colorLabel", "playerLabel",
    "label", "asset", "renderCache", "overlay", "dragState", "currentPlayerId",
    "debugOnly",
  ]);
  const DERIVED_TASK_KEYS = new Set([
    "cardTaskState", "readyType2Tasks", "readyType2ByCardId", "type1ReservedCards",
    "type2ReservedTasks",
  ]);

  function isPlainObject(value) {
    if (value == null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function visitCardInstances(state, visitor) {
    const players = Array.isArray(state?.players?.players) ? state.players.players : [];
    players.forEach((player, playerIndex) => {
      for (const key of ["hand", "reservedCards"]) {
        (player?.[key] || []).forEach((card, index) => visitor(card, `$.players.players[${playerIndex}].${key}[${index}]`));
      }
      if (player?.industryFutureSpan?.card) {
        visitor(player.industryFutureSpan.card, `$.players.players[${playerIndex}].industryFutureSpan.card`);
      }
    });
    (state?.cards?.publicCards || []).forEach((card, index) => {
      if (card) visitor(card, `$.cards.publicCards[${index}]`);
    });
    (state?.cards?.discardPile || []).forEach((card, index) => visitor(card, `$.cards.discardPile[${index}]`));
    for (const [round, pile] of Object.entries(state?.cards?.passReservePiles || {})) {
      (pile || []).forEach((card, index) => visitor(card, `$.cards.passReservePiles.${round}[${index}]`));
    }
  }

  function visitDataTokens(state, visitor) {
    const players = Array.isArray(state?.players?.players) ? state.players.players : [];
    players.forEach((player, playerIndex) => {
      for (const key of ["poolTokens", "placedTokens"]) {
        (player?.dataState?.[key] || []).forEach((token, index) => (
          visitor(token, `$.players.players[${playerIndex}].dataState.${key}[${index}]`)
        ));
      }
    });
  }

  function inferDataTokenSequence(value) {
    const match = String(value ?? "").match(/^data-token-(?:recovered-)?(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  function inferCardSequence(value) {
    const match = String(value ?? "").match(/^card-(\d+)(?:-|$)/);
    return match ? Number(match[1]) : 0;
  }

  function validateNextSequence(state, key, maximum, path, code, message, errors) {
    if (maximum < 1) return;
    const nextSequence = Number(state?.meta?.sequences?.[key]);
    if (!Number.isSafeInteger(nextSequence) || nextSequence <= maximum) {
      errors.push(error(path, code, message));
    }
  }

  function error(path, code, message) {
    return { path, code, message };
  }

  function scanForbidden(value, path, forbidden, errors) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (forbidden.has(key)) {
        errors.push(error(childPath, "STATE_HOST_FIELD_FORBIDDEN", `${childPath} 不属于 committed state`));
      } else {
        scanForbidden(child, childPath, forbidden, errors);
      }
    }
  }

  function getPlayers(state) {
    return Array.isArray(state?.players?.players) ? state.players.players : [];
  }

  function validatePlayers(state, errors) {
    const ids = new Set();
    const colors = new Set();
    getPlayers(state).forEach((player, playerIndex) => {
      const path = `$.players.players[${playerIndex}]`;
      const id = String(player?.id || "");
      const color = String(player?.color || "");
      if (!id || ids.has(id)) errors.push(error(`${path}.id`, "STATE_PLAYER_ID_INVALID", "玩家 id 必须存在且唯一"));
      ids.add(id);
      if (color && colors.has(color)) errors.push(error(`${path}.color`, "STATE_PLAYER_COLOR_DUPLICATE", "玩家颜色必须唯一"));
      if (color) colors.add(color);
      for (const [key, value] of Object.entries(player?.resources || {})) {
        if (!Number.isFinite(value) || (key !== "score" && value < 0)) {
          errors.push(error(`${path}.resources.${key}`, "STATE_PLAYER_RESOURCE_INVALID", "玩家资源必须是有限非负数"));
        }
      }
      if ((Array.isArray(player?.hand) || Object.hasOwn(player?.resources || {}, "handSize"))
        && Number(player?.resources?.handSize) !== (player?.hand || []).length) {
        errors.push(error(`${path}.resources.handSize`, "STATE_HAND_SIZE_MISMATCH", "handSize 必须等于手牌数量"));
      }
    });
    return ids;
  }

  function validatePieces(state, playerIds, errors) {
    const pieceIds = new Set();
    let maximumRocketSequence = 0;
    for (const [index, piece] of (state?.pieces?.rockets || []).entries()) {
      const path = `$.pieces.rockets[${index}]`;
      const id = String(piece?.id ?? "");
      const rocketSequence = Number(piece?.id);
      if (!Number.isSafeInteger(rocketSequence) || rocketSequence < 1 || pieceIds.has(id)) {
        errors.push(error(`${path}.id`, "STATE_PIECE_ID_INVALID", "棋子 id 必须是全局唯一的正整数 sequence"));
      }
      pieceIds.add(id);
      if (Number.isSafeInteger(rocketSequence)) {
        maximumRocketSequence = Math.max(maximumRocketSequence, rocketSequence);
      }
      if (piece?.playerId != null && !playerIds.has(String(piece.playerId))) {
        errors.push(error(`${path}.playerId`, "STATE_PLAYER_REFERENCE_INVALID", "棋子 owner 必须存在"));
      }
      const sequences = state?.pieces?.playerRocketSequences?.[piece?.playerId] || [];
      if (Number.isInteger(piece?.playerSequence) && !sequences.includes(piece.playerSequence)) {
        errors.push(error(`${path}.playerSequence`, "STATE_PIECE_SEQUENCE_MISMATCH", "玩家棋子序号必须登记在 playerRocketSequences"));
      }
    }
    if (state?.pieces?.activeRocketId != null && !pieceIds.has(String(state.pieces.activeRocketId))) {
      errors.push(error("$.pieces.activeRocketId", "STATE_PIECE_REFERENCE_INVALID", "activeRocketId 必须引用现有棋子"));
    }
    for (const [playerId, sequences] of Object.entries(state?.pieces?.playerRocketSequences || {})) {
      if (!playerIds.has(String(playerId))) {
        errors.push(error(`$.pieces.playerRocketSequences.${playerId}`, "STATE_PLAYER_REFERENCE_INVALID", "棋子序号 owner 必须存在"));
      }
      const seen = new Set();
      (sequences || []).forEach((sequence, index) => {
        if (!Number.isSafeInteger(sequence) || sequence <= 0 || seen.has(sequence)) {
          errors.push(error(`$.pieces.playerRocketSequences.${playerId}[${index}]`, "STATE_PIECE_SEQUENCE_INVALID", "玩家棋子序号必须是唯一正整数"));
        }
        seen.add(sequence);
      });
    }
    for (const [planetId, record] of Object.entries(state?.planets?.planets || {})) {
      for (const [kind, markers] of Object.entries({
        orbitMarkers: record?.orbitMarkers,
        landingMarkers: record?.landingMarkers,
        satelliteLandings: record?.satelliteLandings,
      })) {
        (markers || []).forEach((marker, index) => {
          if (marker?.pieceId != null && !pieceIds.has(String(marker.pieceId))) {
            errors.push(error(`$.planets.planets.${planetId}.${kind}[${index}].pieceId`, "STATE_PIECE_PLANET_MISMATCH", "星球标记引用的棋子不存在"));
          }
        });
      }
    }
    validateNextSequence(
      state,
      "rocket",
      maximumRocketSequence,
      "$.meta.sequences.rocket",
      "STATE_ROCKET_SEQUENCE_INVALID",
      "rocket sequence 必须覆盖全部 committed 棋子",
      errors,
    );
  }

  function validateCards(state, errors) {
    const instanceLocations = new Map();
    const cardLocations = new Map();
    let maximumCardSequence = 0;
    visitCardInstances(state, (card, path) => {
      const instanceId = String(card?.id || "");
      const cardId = String(card?.cardId || "");
      const cardSequence = inferCardSequence(instanceId);
      const sharedDefinitionAllowed = Boolean(
        card?.fangzhouCard2 || card?.set === "alien:方舟:card2",
      );
      if (!instanceId || instanceLocations.has(instanceId)) {
        const firstPath = instanceLocations.get(instanceId) || null;
        errors.push(error(
          `${path}.id`,
          "STATE_CARD_INSTANCE_ID_INVALID",
          firstPath
            ? `卡实例 ${instanceId} 同时出现在 ${firstPath} 与 ${path}`
            : "卡实例 id 必须存在且全局唯一",
        ));
      }
      if (instanceId && !instanceLocations.has(instanceId)) instanceLocations.set(instanceId, path);
      maximumCardSequence = Math.max(maximumCardSequence, cardSequence);
      if (cardId && !sharedDefinitionAllowed && cardLocations.has(cardId)) {
        errors.push(error(
          `${path}.cardId`,
          "STATE_CARD_LOCATION_CONFLICT",
          `卡牌 ${cardId} 同时出现在 ${cardLocations.get(cardId)} 与 ${path}`,
        ));
      }
      if (cardId && !sharedDefinitionAllowed && !cardLocations.has(cardId)) {
        cardLocations.set(cardId, path);
      }
    });
    const drawIds = new Set();
    (state?.cards?.drawPileCardIds || []).forEach((rawId, index) => {
      const cardId = String(rawId || "");
      if (!cardId || drawIds.has(cardId) || cardLocations.has(cardId)) {
        const firstPath = cardLocations.get(cardId) || "$.cards.drawPileCardIds[earlier]";
        errors.push(error(
          `$.cards.drawPileCardIds[${index}]`,
          "STATE_CARD_LOCATION_CONFLICT",
          cardId ? `卡牌 ${cardId} 同时出现在 ${firstPath} 与牌库位置 ${index}` : "牌库 cardId 必须存在",
        ));
      }
      drawIds.add(cardId);
    });
    validateNextSequence(
      state,
      "card",
      maximumCardSequence,
      "$.meta.sequences.card",
      "STATE_CARD_SEQUENCE_INVALID",
      "card sequence 必须覆盖全部 committed 标准卡实例",
      errors,
    );
  }

  function validateDataTokens(state, errors) {
    const ids = new Set();
    let maximum = 0;
    visitDataTokens(state, (token, path) => {
      const id = String(token?.id || "");
      const sequence = inferDataTokenSequence(id);
      if (!id || !sequence || ids.has(id)) {
        errors.push(error(`${path}.id`, "STATE_DATA_TOKEN_ID_INVALID", "数据实体 id 必须符合 data-token-N 且全局唯一"));
      }
      ids.add(id);
      maximum = Math.max(maximum, sequence);
    });
    validateNextSequence(
      state,
      "dataToken",
      maximum,
      "$.meta.sequences.dataToken",
      "STATE_DATA_TOKEN_SEQUENCE_INVALID",
      "dataToken sequence 必须覆盖全部 committed 数据实体",
      errors,
    );
  }

  function validateTech(state, playerIds, errors) {
    const stacks = state?.tech?.stacks || {};
    for (const [tileId, stack] of Object.entries(stacks)) {
      const path = `$.tech.stacks.${tileId}`;
      if (stack?.tileId != null && String(stack.tileId) !== tileId) {
        errors.push(error(`${path}.tileId`, "STATE_TECH_TILE_ID_MISMATCH", "科技 stack key 与 tileId 必须一致"));
      }
      if (!Number.isSafeInteger(stack?.remaining) || stack.remaining < 0) {
        errors.push(error(`${path}.remaining`, "STATE_TECH_SUPPLY_INVALID", "科技剩余数量必须是非负安全整数"));
      }
      if (stack?.firstTakeClaimedBy != null && !playerIds.has(String(stack.firstTakeClaimedBy))) {
        errors.push(error(`${path}.firstTakeClaimedBy`, "STATE_PLAYER_REFERENCE_INVALID", "科技首拿玩家必须存在"));
      }
      if (Boolean(stack?.depleted) !== (stack?.remaining === 0)) {
        errors.push(error(`${path}.depleted`, "STATE_TECH_DEPLETION_MISMATCH", "depleted 必须与 remaining=0 一致"));
      }
      const ownedCount = getPlayers(state).filter((player) => player?.techState?.ownedTiles?.[tileId]).length;
      if (Number.isSafeInteger(stack?.remaining)
        && stack.remaining + ownedCount !== techCatalog.PIECES_PER_SLOT) {
        errors.push(error(path, "STATE_TECH_SUPPLY_OWNERSHIP_MISMATCH", "科技供应与玩家归属数量必须守恒"));
      }
    }
    getPlayers(state).forEach((player, playerIndex) => {
      const techState = player?.techState || {};
      for (const legacyField of ["ownedTileByType", "blueBoardSlot"]) {
        if (Object.hasOwn(techState, legacyField)) {
          errors.push(error(
            `$.players.players[${playerIndex}].techState.${legacyField}`,
            "STATE_TECH_LEGACY_FIELD_FORBIDDEN",
            `${legacyField} 已废弃；committed schema 只接受 ownedTiles/disabledTiles/blueBoardSlots`,
          ));
        }
      }
      const occupiedSlots = new Set();
      for (const tileId of Object.keys(techState.ownedTiles || {}).filter((id) => techState.ownedTiles[id])) {
        if (!Object.hasOwn(stacks, tileId)) {
          errors.push(error(`$.players.players[${playerIndex}].techState.ownedTiles.${tileId}`, "STATE_TECH_OWNERSHIP_INVALID", "玩家科技必须对应供应 stack"));
        }
      }
      for (const [tileId, rawSlot] of Object.entries(techState.blueBoardSlots || {})) {
        const slot = Number(rawSlot);
        if (!techState.ownedTiles?.[tileId] || ![1, 2, 3, 4].includes(slot) || occupiedSlots.has(slot)) {
          errors.push(error(`$.players.players[${playerIndex}].techState.blueBoardSlots.${tileId}`, "STATE_TECH_BLUE_SLOT_INVALID", "蓝色科技槽必须有效、已拥有且不重复"));
        }
        occupiedSlots.add(slot);
      }
    });
  }

  function validateHighCouplingInvariants(state) {
    const errors = [];
    scanForbidden(state?.players, "$.players", new Set([...HOST_KEYS, ...DERIVED_TASK_KEYS]), errors);
    scanForbidden(state?.pieces, "$.pieces", new Set([...HOST_KEYS, ...DERIVED_TASK_KEYS]), errors);
    scanForbidden(state?.cards, "$.cards", new Set([...HOST_KEYS, ...DERIVED_TASK_KEYS]), errors);
    scanForbidden(state?.tech, "$.tech", new Set([...HOST_KEYS, ...DERIVED_TASK_KEYS]), errors);
    const playerIds = validatePlayers(state, errors);
    validatePieces(state, playerIds, errors);
    validateCards(state, errors);
    validateDataTokens(state, errors);
    validateTech(state, playerIds, errors);
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  function createHighCouplingStateStore(initialState, options = {}) {
    return stateStore.createStateStore(initialState, {
      ...options,
      invariantValidators: [
        lowCouplingState.validateLowCouplingInvariants,
        validateHighCouplingInvariants,
        ...(options.invariantValidators || []),
      ],
    });
  }

  function rebuildCardTaskIndex(candidateState, playerId, context, cardEffects) {
    const players = getPlayers(candidateState);
    const player = players.find((entry) => entry.id === playerId) || null;
    return cardTaskState.refreshTaskState(cardTaskState.createTaskState(), player, context, cardEffects);
  }

  return Object.freeze({
    HIGH_COUPLING_SLICES,
    COORDINATED_SLICES,
    FIELD_OWNERSHIP,
    validateHighCouplingInvariants,
    createHighCouplingStateStore,
    rebuildCardTaskIndex,
  });
});

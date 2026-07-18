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
    "pieces.nextRocketId": "meta.sequences.rocket",
    "pieces.statusNote/tokenSrc/label": "host-only:excluded",
    "cards.publicCards/discardPile/drawPileCardIds/passReservePiles": "committed",
    "cards.ui/selection*": "session-owned:excluded",
    "cardTaskState": "derived:rebuildCardTaskIndex",
    "tech.board": "committed",
    "tech.ui/pendingTileId/selected*/allowedTechTypes": "session-owned/host-only:excluded",
    "setupSelectionState": "setup-session-owned:excluded",
    "meta.sequences.card/rocket": "committed deterministic domain id allocation",
  });
  const HOST_KEYS = new Set([
    "ui", "statusNote", "tokenSrc", "src", "cardName", "colorLabel", "playerLabel",
    "label", "asset", "renderCache", "overlay", "dragState",
  ]);
  const CARD_SELECTION_KEYS = new Set([
    "selectionActive", "discardSelectionActive", "discardRemaining",
    "playCardSelectionActive", "selectedCardId", "selectedCardIds",
  ]);
  const TECH_SELECTION_KEYS = new Set([
    "pendingTileId", "selectedTileId", "selectedBlueSlot", "allowedTechTypes",
    "techSelectionActive", "cheatModeEnabled", "takeTechDebugEnabled", "industryBorrowMode",
  ]);
  const DERIVED_TASK_KEYS = new Set([
    "cardTaskState", "readyType2Tasks", "readyType2ByCardId", "type1ReservedCards",
    "type2ReservedTasks",
  ]);

  function clone(value) {
    return structuredClone(value);
  }

  function isPlainObject(value) {
    if (value == null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function stripKeys(value, forbidden) {
    if (Array.isArray(value)) return value.map((item) => stripKeys(item, forbidden));
    if (!isPlainObject(value)) return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !forbidden.has(key))
      .map(([key, item]) => [key, stripKeys(item, forbidden)]));
  }

  function normalizeSequenceList(value, path) {
    const source = value instanceof Set ? [...value] : value;
    if (!Array.isArray(source)) throw new TypeError(`${path} 必须是 Set 或数组`);
    return [...new Set(source.map(Number))].sort((left, right) => left - right);
  }

  function inferSequence(value, prefix) {
    const match = String(value ?? "").match(new RegExp(`^(?:${prefix}[-:]?)?(\\d+)`));
    return match ? Number(match[1]) : 0;
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

  function purifyPlayers(players) {
    const result = stripKeys(players || {}, new Set([...HOST_KEYS, ...DERIVED_TASK_KEYS]));
    delete result.currentPlayerId;
    return result;
  }

  function purifyPieces(pieces) {
    const result = stripKeys(pieces || {}, new Set([...HOST_KEYS, ...DERIVED_TASK_KEYS]));
    delete result.nextRocketId;
    const normalized = {};
    for (const [playerId, sequences] of Object.entries(result.playerRocketSequences || {})) {
      normalized[playerId] = normalizeSequenceList(sequences, `pieces.playerRocketSequences.${playerId}`);
    }
    result.playerRocketSequences = normalized;
    return result;
  }

  function purifyCards(cards) {
    return stripKeys(cards || {}, new Set([
      ...HOST_KEYS, ...CARD_SELECTION_KEYS, ...DERIVED_TASK_KEYS,
    ]));
  }

  function purifyTech(tech) {
    const source = isPlainObject(tech?.board) ? tech.board : tech;
    return stripKeys(source || {}, new Set([
      ...HOST_KEYS, ...TECH_SELECTION_KEYS, ...DERIVED_TASK_KEYS,
    ]));
  }

  function purifyHighCouplingSlices(candidate) {
    const result = lowCouplingState.purifyLowCouplingSlices(candidate);
    result.players = purifyPlayers(result.players);
    result.pieces = purifyPieces(result.pieces);
    result.cards = purifyCards(result.cards);
    result.tech = purifyTech(result.tech);
    if (!isPlainObject(result.meta.sequences)) result.meta.sequences = {};
    let maxCardSequence = 0;
    let hasCardInstance = false;
    visitCardInstances(result, (card) => {
      hasCardInstance = true;
      maxCardSequence = Math.max(maxCardSequence, inferSequence(card?.id, "card"));
    });
    const maxRocketSequence = (result.pieces.rockets || []).reduce(
      (maximum, piece) => Math.max(maximum, inferSequence(piece?.id, "rocket")),
      0,
    );
    if (hasCardInstance || Object.hasOwn(result.meta.sequences, "card")) {
      result.meta.sequences.card = Math.max(Number(result.meta.sequences.card) || 0, maxCardSequence + 1);
    }
    result.meta.sequences.rocket = Math.max(Number(result.meta.sequences.rocket) || 0, maxRocketSequence + 1);
    return result;
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
    for (const [index, piece] of (state?.pieces?.rockets || []).entries()) {
      const path = `$.pieces.rockets[${index}]`;
      const id = String(piece?.id ?? "");
      if (!id || pieceIds.has(id)) errors.push(error(`${path}.id`, "STATE_PIECE_ID_INVALID", "棋子 id 必须存在且唯一"));
      pieceIds.add(id);
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
          if (marker?.sourcePieceId != null && pieceIds.has(String(marker.sourcePieceId))) {
            errors.push(error(`$.planets.planets.${planetId}.${kind}[${index}].sourcePieceId`, "STATE_PIECE_PLANET_MISMATCH", "已转为星球标记的棋子不得仍留在 pieces"));
          }
        });
      }
    }
  }

  function validateCards(state, errors) {
    const instanceIds = new Set();
    const cardIds = new Set();
    visitCardInstances(state, (card, path) => {
      const instanceId = String(card?.id || "");
      const cardId = String(card?.cardId || "");
      if (!instanceId || instanceIds.has(instanceId)) {
        errors.push(error(`${path}.id`, "STATE_CARD_INSTANCE_ID_INVALID", "卡实例 id 必须存在且全局唯一"));
      }
      instanceIds.add(instanceId);
      if (cardId && cardIds.has(cardId)) {
        errors.push(error(`${path}.cardId`, "STATE_CARD_LOCATION_CONFLICT", "同一卡牌不得同时位于多个容器"));
      }
      if (cardId) cardIds.add(cardId);
    });
    const drawIds = new Set();
    (state?.cards?.drawPileCardIds || []).forEach((rawId, index) => {
      const cardId = String(rawId || "");
      if (!cardId || drawIds.has(cardId) || cardIds.has(cardId)) {
        errors.push(error(`$.cards.drawPileCardIds[${index}]`, "STATE_CARD_LOCATION_CONFLICT", "牌库 cardId 必须唯一且不得出现在其他容器"));
      }
      drawIds.add(cardId);
    });
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
    scanForbidden(state?.pieces, "$.pieces", new Set([...HOST_KEYS, ...DERIVED_TASK_KEYS, "nextRocketId"]), errors);
    scanForbidden(state?.cards, "$.cards", new Set([...HOST_KEYS, ...CARD_SELECTION_KEYS, ...DERIVED_TASK_KEYS]), errors);
    scanForbidden(state?.tech, "$.tech", new Set([...HOST_KEYS, ...TECH_SELECTION_KEYS, ...DERIVED_TASK_KEYS]), errors);
    const playerIds = validatePlayers(state, errors);
    validatePieces(state, playerIds, errors);
    validateCards(state, errors);
    validateTech(state, playerIds, errors);
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  function createHighCouplingStateStore(initialState, options = {}) {
    return stateStore.createStateStore(purifyHighCouplingSlices(initialState), {
      ...options,
      invariantValidators: [
        lowCouplingState.validateLowCouplingInvariants,
        validateHighCouplingInvariants,
        ...(options.invariantValidators || []),
      ],
    });
  }

  function mutateHighCouplingSlices(store, mutator) {
    if (!store || typeof store.beginWorkingCopy !== "function") throw new TypeError("必须传入 StateStore");
    if (typeof mutator !== "function") throw new TypeError("mutator 必须是函数");
    const snapshot = store.getSnapshot();
    const working = store.beginWorkingCopy(snapshot.meta.stateVersion);
    if (!working.ok) return working;
    let result;
    try {
      const slices = Object.fromEntries(COORDINATED_SLICES.map((key) => [key, working.state[key]]));
      slices.pieces = clone(working.state.pieces);
      slices.pieces.playerRocketSequences = Object.fromEntries(Object.entries(
        slices.pieces.playerRocketSequences || {},
      ).map(([playerId, sequences]) => [playerId, new Set(sequences)]));
      result = mutator(slices, working.state);
      working.state.players = slices.players;
      working.state.pieces = slices.pieces;
      working.state.planets = slices.planets;
      working.state.cards = slices.cards;
      working.state.tech = slices.tech;
    } catch (cause) {
      return { ok: false, code: "STATE_MUTATOR_FAILED", message: cause?.message || "高耦合状态变更失败" };
    }
    const protectedSlices = stateStore.REQUIRED_ROOT_SLICES.filter((key) => (
      key !== "meta" && !COORDINATED_SLICES.includes(key)
    ));
    for (const key of protectedSlices) {
      if (JSON.stringify(working.state[key]) !== JSON.stringify(snapshot[key])) {
        return { ok: false, code: "STATE_SLICE_OWNERSHIP_VIOLATION", slice: key };
      }
    }
    const purified = purifyHighCouplingSlices(working.state);
    const committed = store.compareAndCommit(working.baseVersion, purified);
    return committed.ok ? { ...committed, result } : committed;
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
    purifyHighCouplingSlices,
    validateHighCouplingInvariants,
    createHighCouplingStateStore,
    mutateHighCouplingSlices,
    rebuildCardTaskIndex,
  });
});

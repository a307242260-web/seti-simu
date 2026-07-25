(function (root, factory) {
  "use strict";

  let stateStore = root.SetiStateStore;
  if (!stateStore && typeof require === "function") stateStore = require("./state-store");

  const api = factory(stateStore);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiLowCouplingState = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (stateStore) {
  "use strict";

  if (!stateStore) throw new Error("SetiStateStore is required before SetiLowCouplingState");

  const LOW_COUPLING_SLICES = Object.freeze([
    "match", "turn", "solarSystem", "planets", "data", "aliens", "finalScoring",
  ]);
  const FIELD_OWNERSHIP = Object.freeze({
    "solarSystem.rotation/sectorBySlot/aomomoActive": "committed",
    "solarSystem.rotation": "committed; wheelSteps is not accepted",
    "match.*": "committed after setup confirmation; setup UI/session excluded",
    "turn.*": "committed; automation/view flags excluded",
    "planets.*.orbitMarkers/landingMarkers/satelliteLandings": "committed",
    "planets.*.orbits/landings": "derived:marker arrays",
    "planets.*.marker display fields": "derived/host-only",
    "data.nebulae.*.tokens": "committed",
    "data.nebulae.*.playerTokenCounts/lastReplaced*": "derived:tokens",
    "data token presentation fields": "derived/host-only",
    "data.sectorExtraMarks/sectorSettlements": "committed",
    "aliens.revealPoolAlienIds/neutralScoreTraceMarks/aliens": "committed",
    "aliens marker label/asset/display fields": "derived/host-only",
    "finalScoring.thresholds/tiles/tileVariants": "committed",
    "finalScoring.tiles.*.marks rule fields": "committed",
    "finalScoring mark presentation fields": "derived/host-only",
  });
  const PRESENTATION_KEYS = new Set([
    "displayed", "displaySlot", "forceDisplaySlot", "referenceOffsetTokenWidths",
    "playerLabel", "replacedByPlayerLabel", "playerTokenSrc", "tokenSrc", "percentX", "percentY",
    "placedAt", "replacedAt", "ui", "overlay", "renderCache", "pendingMarks", "debugOnly",
  ]);

  function isPlainObject(value) {
    if (value == null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function error(path, code, message) {
    return { path, code, message };
  }

  function getPlayers(state) {
    return Array.isArray(state?.players?.players) ? state.players.players : [];
  }

  function validateUniqueReferences(values, validIds, path, errors, options = {}) {
    if (!Array.isArray(values)) return;
    const seen = new Set();
    values.forEach((value, index) => {
      const id = String(value);
      if (seen.has(id)) errors.push(error(`${path}[${index}]`, "STATE_REFERENCE_DUPLICATE", `${path} 不得重复引用 ${id}`));
      seen.add(id);
      if (validIds.size && !validIds.has(id)) {
        errors.push(error(`${path}[${index}]`, options.code || "STATE_PLAYER_REFERENCE_INVALID", `${path} 引用了不存在的 ${id}`));
      }
    });
  }

  function validateOwner(ref, playerIds, playerColors, path, errors) {
    if (!isPlainObject(ref)) return;
    const id = ref.playerId || ref.ownerPlayerId || ref.replacedByPlayerId;
    const color = ref.playerColor || ref.ownerPlayerColor || ref.replacedByPlayerColor || ref.color;
    if (id != null && playerIds.size && !playerIds.has(String(id))) {
      errors.push(error(path, "STATE_PLAYER_REFERENCE_INVALID", `${path} 引用了不存在的玩家 ${id}`));
    }
    if (color != null && playerColors.size && !playerColors.has(String(color))) {
      errors.push(error(path, "STATE_PLAYER_COLOR_INVALID", `${path} 引用了不存在的玩家颜色 ${color}`));
    }
  }

  function validateNextSequence(state, key, maximum, code, message, errors) {
    if (maximum < 1) return;
    const nextSequence = Number(state?.meta?.sequences?.[key]);
    if (!Number.isSafeInteger(nextSequence) || nextSequence <= maximum) {
      errors.push(error(`$.meta.sequences.${key}`, code, message));
    }
  }

  function inferSequence(value, pattern) {
    const match = String(value ?? "").match(pattern);
    return match ? Number(match[1]) : 0;
  }

  function validateAlienEntitySequences(state, errors) {
    const sequences = new Map();
    let maximum = 0;

    function record(sequence, path) {
      if (!Number.isSafeInteger(sequence) || sequence < 1) {
        errors.push(error(path, "STATE_ALIEN_ENTITY_SEQUENCE_INVALID", "外星人规则实体必须携带正整数 canonical sequence"));
        return;
      }
      if (sequences.has(sequence)) {
        errors.push(error(path, "STATE_ALIEN_ENTITY_SEQUENCE_DUPLICATE", `alienEntity sequence ${sequence} 已用于 ${sequences.get(sequence)}`));
        return;
      }
      sequences.set(sequence, path);
      maximum = Math.max(maximum, sequence);
    }

    function visit(value, path) {
      if (!value || typeof value !== "object") return;
      if (!Array.isArray(value) && value.traceType != null && value.position != null) {
        record(Number(value.sequence), `${path}.sequence`);
      } else if (!Array.isArray(value) && value.id != null) {
        const id = String(value.id);
        const sequence = inferSequence(id, /^alien-[^-]+-\d+-(\d+)$/)
          || inferSequence(id, /^aomomo-(?:orbit|landing)-(\d+)$/)
          || inferSequence(id, /^banrenma-mark-(\d+)$/);
        if (sequence) record(sequence, `${path}.id`);
      }
      for (const [key, child] of Object.entries(value)) {
        visit(child, `${path}.${key}`);
      }
    }

    visit(state, "$");
    validateNextSequence(
      state,
      "alienEntity",
      maximum,
      "STATE_ALIEN_ENTITY_SEQUENCE_INVALID",
      "alienEntity sequence 必须覆盖全部 committed 外星人规则实体",
      errors,
    );
  }

  function validateForbiddenFields(state, errors) {
    const stack = LOW_COUPLING_SLICES.map((slice) => ({ value: state[slice], path: `$.${slice}` }));
    while (stack.length) {
      const { value, path } = stack.pop();
      if (!value || typeof value !== "object") continue;
      for (const [key, child] of Object.entries(value)) {
        const childPath = `${path}.${key}`;
        if (PRESENTATION_KEYS.has(key) || (path === "$.solarSystem" && key === "wheelSteps")) {
          errors.push(error(childPath, "STATE_HOST_FIELD_FORBIDDEN", `${childPath} 不属于 committed state`));
        } else {
          stack.push({ value: child, path: childPath });
        }
      }
    }
    for (const [planetId, record] of Object.entries(state?.planets?.planets || {})) {
      if (Object.hasOwn(record || {}, "orbits") || Object.hasOwn(record || {}, "landings")) {
        errors.push(error(`$.planets.planets.${planetId}`, "STATE_DERIVED_FIELD_FORBIDDEN", "星球计数必须由标记数组派生"));
      }
      for (const [kind, markers] of Object.entries({
        orbitMarkers: record?.orbitMarkers,
        landingMarkers: record?.landingMarkers,
      })) {
        (markers || []).forEach((marker, index) => {
          if (Object.hasOwn(marker || {}, "sequence")) {
            errors.push(error(`$.planets.planets.${planetId}.${kind}[${index}].sequence`, "STATE_DERIVED_FIELD_FORBIDDEN", "标记顺序必须由数组位置派生"));
          }
        });
      }
    }
    for (const [nebulaId, bucket] of Object.entries(state?.data?.nebulae || {})) {
      for (const key of ["playerTokenCounts", "lastReplacedPlayerId", "lastReplacedPlayerColor", "lastReplacedPlayerLabel"]) {
        if (Object.hasOwn(bucket || {}, key)) {
          errors.push(error(`$.data.nebulae.${nebulaId}.${key}`, "STATE_DERIVED_FIELD_FORBIDDEN", "星云展示统计必须由 token 派生"));
        }
      }
    }
  }

  function validateLowCouplingInvariants(state) {
    const errors = [];
    validateForbiddenFields(state, errors);
    const players = getPlayers(state);
    const playerIds = new Set(players.map((player) => player?.id).filter(Boolean).map(String));
    const playerColors = new Set(players.map((player) => player?.color).filter(Boolean).map(String));
    const turn = state.turn || {};
    validateUniqueReferences(turn.turnOrderPlayerIds, playerIds, "$.turn.turnOrderPlayerIds", errors);
    validateUniqueReferences(turn.activePlayerIds, playerIds, "$.turn.activePlayerIds", errors);
    validateUniqueReferences(turn.passedPlayerIds, playerIds, "$.turn.passedPlayerIds", errors);
    validateUniqueReferences(turn.completedTurnPlayerIds, playerIds, "$.turn.completedTurnPlayerIds", errors);
    if (Array.isArray(turn.activePlayerIds) && Number.isInteger(turn.activePlayerCount)
      && turn.activePlayerCount !== turn.activePlayerIds.length) {
      errors.push(error("$.turn.activePlayerCount", "STATE_ACTIVE_PLAYER_COUNT_MISMATCH", "activePlayerCount 必须等于 activePlayerIds 长度"));
    }
    const activeIds = new Set((turn.activePlayerIds || []).map(String));
    for (const [key, id] of [["currentPlayerId", turn.currentPlayerId], ["startPlayerId", turn.startPlayerId]]) {
      if (id != null && playerIds.size && !playerIds.has(String(id))) {
        errors.push(error(`$.turn.${key}`, "STATE_PLAYER_REFERENCE_INVALID", `${key} 引用了不存在的玩家 ${id}`));
      } else if (id != null && activeIds.size && !activeIds.has(String(id))) {
        errors.push(error(`$.turn.${key}`, "STATE_INACTIVE_PLAYER_REFERENCE", `${key} 必须属于 activePlayerIds`));
      }
    }

    const planetIds = new Set(Object.keys(state?.planets?.planets || {}));
    for (const [planetId, record] of Object.entries(state?.planets?.planets || {})) {
      for (const [kind, markers] of Object.entries({
        orbitMarkers: record?.orbitMarkers,
        landingMarkers: record?.landingMarkers,
        satelliteLandings: record?.satelliteLandings,
      })) {
        if (markers != null && !Array.isArray(markers)) {
          errors.push(error(`$.planets.planets.${planetId}.${kind}`, "STATE_MARKER_LIST_INVALID", `${kind} 必须是数组`));
          continue;
        }
        (markers || []).forEach((marker, index) => validateOwner(marker, playerIds, playerColors,
          `$.planets.planets.${planetId}.${kind}[${index}]`, errors));
      }
    }

    const rockets = state?.pieces?.rockets;
    if (Array.isArray(rockets)) {
      const rocketIds = new Set();
      rockets.forEach((rocket, index) => {
        if (!rocket?.id || rocketIds.has(String(rocket.id))) {
          errors.push(error(`$.pieces.rockets[${index}].id`, "STATE_PIECE_ID_INVALID", "棋子 id 必须存在且唯一"));
        } else rocketIds.add(String(rocket.id));
        validateOwner(rocket, playerIds, playerColors, `$.pieces.rockets[${index}]`, errors);
        const planetId = rocket?.planetId;
        if (planetId != null && planetIds.size && !planetIds.has(String(planetId))) {
          errors.push(error(`$.pieces.rockets[${index}]`, "STATE_PLANET_REFERENCE_INVALID", `棋子引用了不存在的星球 ${planetId}`));
        }
      });
      if (state.pieces.activeRocketId != null && !rocketIds.has(String(state.pieces.activeRocketId))) {
        errors.push(error("$.pieces.activeRocketId", "STATE_PIECE_REFERENCE_INVALID", "activeRocketId 必须引用现有棋子"));
      }
    }

    const tokenIds = new Set();
    let maximumNebulaTokenSequence = 0;
    let maximumNebulaReplacementSequence = 0;
    for (const [nebulaId, bucket] of Object.entries(state?.data?.nebulae || {})) {
      const slots = new Set();
      (bucket?.tokens || []).forEach((token, index) => {
        const tokenSequence = inferSequence(token?.id, /^nebula-data-(\d+)$/);
        if (!tokenSequence || tokenIds.has(String(token?.id))) {
          errors.push(error(`$.data.nebulae.${nebulaId}.tokens[${index}].id`, "STATE_DATA_TOKEN_ID_INVALID", "数据 token id 必须存在且唯一"));
        } else tokenIds.add(String(token.id));
        maximumNebulaTokenSequence = Math.max(maximumNebulaTokenSequence, tokenSequence);
        if (token?.replacementOrder != null) {
          const replacementSequence = Number(token.replacementOrder);
          if (!Number.isSafeInteger(replacementSequence) || replacementSequence < 1) {
            errors.push(error(`$.data.nebulae.${nebulaId}.tokens[${index}].replacementOrder`, "STATE_NEBULA_REPLACEMENT_SEQUENCE_INVALID", "replacementOrder 必须是正整数 sequence"));
          } else {
            maximumNebulaReplacementSequence = Math.max(maximumNebulaReplacementSequence, replacementSequence);
          }
        }
        if (token?.slotIndex != null) {
          if (slots.has(Number(token.slotIndex))) errors.push(error(`$.data.nebulae.${nebulaId}.tokens[${index}].slotIndex`, "STATE_DATA_SLOT_DUPLICATE", "同一星云槽位只能放一个数据 token"));
          slots.add(Number(token.slotIndex));
        }
        validateOwner(token, playerIds, playerColors, `$.data.nebulae.${nebulaId}.tokens[${index}]`, errors);
      });
    }
    validateNextSequence(
      state,
      "nebulaToken",
      maximumNebulaTokenSequence,
      "STATE_NEBULA_TOKEN_SEQUENCE_INVALID",
      "nebulaToken sequence 必须覆盖全部 committed 星云数据实体",
      errors,
    );
    validateNextSequence(
      state,
      "nebulaReplacement",
      maximumNebulaReplacementSequence,
      "STATE_NEBULA_REPLACEMENT_SEQUENCE_INVALID",
      "nebulaReplacement sequence 必须覆盖全部 committed 替换次序",
      errors,
    );

    for (const [slotId, slot] of Object.entries(state?.aliens?.aliens || {})) {
      for (const [traceType, trace] of Object.entries(slot?.traces || {})) {
        const markers = Array.isArray(trace?.extraMarkers) ? trace.extraMarkers : [];
        if (Number(trace?.extraCount || 0) !== markers.length) {
          errors.push(error(`$.aliens.aliens.${slotId}.traces.${traceType}`, "STATE_ALIEN_TRACE_COUNT_MISMATCH", "extraCount 必须等于 extraMarkers 长度"));
        }
        validateOwner(trace, playerIds, playerColors, `$.aliens.aliens.${slotId}.traces.${traceType}`, errors);
        markers.forEach((marker, index) => validateOwner(marker, playerIds, playerColors,
          `$.aliens.aliens.${slotId}.traces.${traceType}.extraMarkers[${index}]`, errors));
      }
    }

    const markIds = new Set();
    const playerTileClaims = new Set();
    let maximumFinalMarkSequence = 0;
    for (const [tileId, tile] of Object.entries(state?.finalScoring?.tiles || {})) {
      const reservedSlots = new Set();
      (tile?.marks || []).forEach((mark, index) => {
        const markSequence = inferSequence(mark?.id, /^final-mark-(\d+)$/);
        if (!markSequence || markIds.has(String(mark?.id))) errors.push(error(`$.finalScoring.tiles.${tileId}.marks[${index}].id`, "STATE_FINAL_MARK_ID_INVALID", "终局 mark id 必须符合 final-mark-N 且全局唯一"));
        else markIds.add(String(mark.id));
        maximumFinalMarkSequence = Math.max(maximumFinalMarkSequence, markSequence);
        validateOwner(mark, playerIds, playerColors, `$.finalScoring.tiles.${tileId}.marks[${index}]`, errors);
        const claim = `${tileId}:${mark?.playerId}`;
        if (mark?.playerId && playerTileClaims.has(claim)) errors.push(error(`$.finalScoring.tiles.${tileId}.marks[${index}]`, "STATE_FINAL_MARK_DUPLICATE_PLAYER", "同一玩家不能重复标记同一终局板块"));
        playerTileClaims.add(claim);
        const slotIndex = Number(mark?.slotIndex);
        if ((slotIndex === 1 || slotIndex === 2) && reservedSlots.has(slotIndex)) errors.push(error(`$.finalScoring.tiles.${tileId}.marks[${index}].slotIndex`, "STATE_FINAL_SLOT_OCCUPIED", `终局板块固定槽位 ${slotIndex} 只能有一个 mark`));
        if (slotIndex === 1 || slotIndex === 2) reservedSlots.add(slotIndex);
      });
    }
    validateNextSequence(
      state,
      "finalMark",
      maximumFinalMarkSequence,
      "STATE_FINAL_MARK_SEQUENCE_INVALID",
      "finalMark sequence 必须覆盖全部 committed 终局标记",
      errors,
    );
    validateAlienEntitySequences(state, errors);
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  return Object.freeze({
    LOW_COUPLING_SLICES,
    FIELD_OWNERSHIP,
    PRESENTATION_KEYS,
    validateLowCouplingInvariants,
  });
});

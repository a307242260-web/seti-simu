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
    "solarSystem.wheelSteps": "derived:rotation",
    "match.*": "committed after setup confirmation; setup UI/session excluded",
    "turn.*": "committed; automation/view flags excluded",
    "planets.*.orbitMarkers/landingMarkers/satelliteLandings": "committed",
    "planets.*.orbits/landings": "derived:marker arrays",
    "planets.*.marker display fields": "derived/host-only",
    "data.nebulae.*.tokens": "committed",
    "data.nebulae.*.playerTokenCounts/lastReplaced*": "derived:tokens",
    "data token label/asset/percent/replacedAt": "derived/host-only",
    "data.sectorExtraMarks/sectorSettlements": "committed",
    "aliens.revealPoolAlienIds/neutralScoreTraceMarks/aliens": "committed",
    "aliens marker label/asset/display fields": "derived/host-only",
    "finalScoring.thresholds/tiles/tileVariants": "committed",
    "finalScoring.tiles.*.marks rule fields": "committed",
    "finalScoring mark label/asset/placedAt": "derived/host-only",
    "finalScoring.pendingMarks": "session-owned:excluded",
  });
  const PRESENTATION_KEYS = new Set([
    "displayed", "displaySlot", "forceDisplaySlot", "referenceOffsetTokenWidths",
    "playerLabel", "replacedByPlayerLabel", "playerTokenSrc", "tokenSrc", "percentX", "percentY",
    "placedAt", "replacedAt", "statusNote", "ui", "overlay", "renderCache",
  ]);

  function clone(value) {
    return structuredClone(value);
  }

  function isPlainObject(value) {
    if (value == null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function stripPresentationFields(value) {
    if (Array.isArray(value)) return value.map(stripPresentationFields);
    if (!isPlainObject(value)) return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !PRESENTATION_KEYS.has(key))
      .map(([key, item]) => [key, stripPresentationFields(item)]));
  }

  function purifyPlanetState(planets) {
    const result = stripPresentationFields(planets || {});
    for (const record of Object.values(result.planets || {})) {
      if (!isPlainObject(record)) continue;
      delete record.orbits;
      delete record.landings;
      for (const key of ["orbitMarkers", "landingMarkers"]) {
        if (!Array.isArray(record[key])) continue;
        record[key] = record[key].map((marker) => {
          const normalized = stripPresentationFields(marker);
          delete normalized.sequence;
          return normalized;
        });
      }
      if (Array.isArray(record.satelliteLandings)) {
        record.satelliteLandings = record.satelliteLandings.map(stripPresentationFields);
      }
    }
    return result;
  }

  function purifyDataState(data) {
    const result = stripPresentationFields(data || {});
    for (const bucket of Object.values(result.nebulae || {})) {
      if (!isPlainObject(bucket)) continue;
      delete bucket.playerTokenCounts;
      delete bucket.lastReplacedPlayerId;
      delete bucket.lastReplacedPlayerColor;
      delete bucket.lastReplacedPlayerLabel;
    }
    return result;
  }

  function purifyLowCouplingSlices(candidate) {
    const result = clone(candidate);
    result.solarSystem = stripPresentationFields(result.solarSystem || {});
    delete result.solarSystem.wheelSteps;
    result.match = stripPresentationFields(result.match || {});
    result.turn = stripPresentationFields(result.turn || {});
    result.planets = purifyPlanetState(result.planets);
    result.data = purifyDataState(result.data);
    result.aliens = stripPresentationFields(result.aliens || {});
    result.finalScoring = stripPresentationFields(result.finalScoring || {});
    delete result.finalScoring.pendingMarks;
    return result;
  }

  function error(path, code, message) {
    return { path, code, message };
  }

  function getPlayers(state) {
    const source = state?.players?.players;
    if (Array.isArray(source)) return source;
    if (!isPlainObject(state?.players)) return [];
    return Object.entries(state.players).map(([key, player]) => (
      isPlainObject(player) ? { id: player.id || key, ...player } : { id: key }
    ));
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

  function validateForbiddenFields(state, errors) {
    const stack = LOW_COUPLING_SLICES.map((slice) => ({ value: state[slice], path: `$.${slice}` }));
    while (stack.length) {
      const { value, path } = stack.pop();
      if (!value || typeof value !== "object") continue;
      for (const [key, child] of Object.entries(value)) {
        const childPath = `${path}.${key}`;
        if (PRESENTATION_KEYS.has(key) || (path === "$.solarSystem" && key === "wheelSteps")
          || (path === "$.finalScoring" && key === "pendingMarks")) {
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
        const planetId = rocket?.planetId || rocket?.planetsReference?.planetId;
        if (planetId != null && planetIds.size && !planetIds.has(String(planetId))) {
          errors.push(error(`$.pieces.rockets[${index}]`, "STATE_PLANET_REFERENCE_INVALID", `棋子引用了不存在的星球 ${planetId}`));
        }
      });
      if (state.pieces.activeRocketId != null && !rocketIds.has(String(state.pieces.activeRocketId))) {
        errors.push(error("$.pieces.activeRocketId", "STATE_PIECE_REFERENCE_INVALID", "activeRocketId 必须引用现有棋子"));
      }
    }

    const tokenIds = new Set();
    for (const [nebulaId, bucket] of Object.entries(state?.data?.nebulae || {})) {
      const slots = new Set();
      (bucket?.tokens || []).forEach((token, index) => {
        if (!token?.id || tokenIds.has(String(token.id))) {
          errors.push(error(`$.data.nebulae.${nebulaId}.tokens[${index}].id`, "STATE_DATA_TOKEN_ID_INVALID", "数据 token id 必须存在且唯一"));
        } else tokenIds.add(String(token.id));
        if (token?.slotIndex != null) {
          if (slots.has(Number(token.slotIndex))) errors.push(error(`$.data.nebulae.${nebulaId}.tokens[${index}].slotIndex`, "STATE_DATA_SLOT_DUPLICATE", "同一星云槽位只能放一个数据 token"));
          slots.add(Number(token.slotIndex));
        }
        validateOwner(token, playerIds, playerColors, `$.data.nebulae.${nebulaId}.tokens[${index}]`, errors);
      });
    }

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
    for (const [tileId, tile] of Object.entries(state?.finalScoring?.tiles || {})) {
      const reservedSlots = new Set();
      (tile?.marks || []).forEach((mark, index) => {
        if (!mark?.id || markIds.has(String(mark.id))) errors.push(error(`$.finalScoring.tiles.${tileId}.marks[${index}].id`, "STATE_FINAL_MARK_ID_INVALID", "终局 mark id 必须存在且唯一"));
        else markIds.add(String(mark.id));
        validateOwner(mark, playerIds, playerColors, `$.finalScoring.tiles.${tileId}.marks[${index}]`, errors);
        const claim = `${tileId}:${mark?.playerId}`;
        if (mark?.playerId && playerTileClaims.has(claim)) errors.push(error(`$.finalScoring.tiles.${tileId}.marks[${index}]`, "STATE_FINAL_MARK_DUPLICATE_PLAYER", "同一玩家不能重复标记同一终局板块"));
        playerTileClaims.add(claim);
        const slotIndex = Number(mark?.slotIndex);
        if ((slotIndex === 1 || slotIndex === 2) && reservedSlots.has(slotIndex)) errors.push(error(`$.finalScoring.tiles.${tileId}.marks[${index}].slotIndex`, "STATE_FINAL_SLOT_OCCUPIED", `终局板块固定槽位 ${slotIndex} 只能有一个 mark`));
        if (slotIndex === 1 || slotIndex === 2) reservedSlots.add(slotIndex);
      });
    }
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  function createLowCouplingStateStore(initialState, options = {}) {
    const validators = [validateLowCouplingInvariants, ...(options.invariantValidators || [])];
    return stateStore.createStateStore(purifyLowCouplingSlices(initialState), {
      ...options,
      invariantValidators: validators,
    });
  }

  function mutateLowCouplingSlices(store, mutator) {
    if (!store || typeof store.beginWorkingCopy !== "function") throw new TypeError("必须传入 StateStore");
    if (typeof mutator !== "function") throw new TypeError("mutator 必须是函数");
    const snapshot = store.getSnapshot();
    const working = store.beginWorkingCopy(snapshot.meta.stateVersion);
    if (!working.ok) return working;
    const protectedSlices = stateStore.REQUIRED_ROOT_SLICES.filter((key) => (
      key !== "meta" && !LOW_COUPLING_SLICES.includes(key)
    ));
    let result;
    try {
      result = mutator(Object.fromEntries(LOW_COUPLING_SLICES.map((key) => [key, working.state[key]])), working.state);
    } catch (cause) {
      return { ok: false, code: "STATE_MUTATOR_FAILED", message: cause?.message || "低耦合状态变更失败" };
    }
    for (const key of protectedSlices) {
      if (JSON.stringify(working.state[key]) !== JSON.stringify(snapshot[key])) {
        return { ok: false, code: "STATE_SLICE_OWNERSHIP_VIOLATION", slice: key };
      }
    }
    const committed = store.compareAndCommit(working.baseVersion, working.state);
    return committed.ok ? { ...committed, result } : committed;
  }

  function mutateOwnedLowCouplingSlices(store, mutator) {
    return mutateLowCouplingSlices(store, (slices, workingState) => {
      const result = mutator(slices, workingState);
      const purified = purifyLowCouplingSlices(workingState);
      for (const key of LOW_COUPLING_SLICES) {
        workingState[key] = purified[key];
        slices[key] = purified[key];
      }
      return result;
    });
  }

  return Object.freeze({
    LOW_COUPLING_SLICES,
    FIELD_OWNERSHIP,
    PRESENTATION_KEYS,
    purifyLowCouplingSlices,
    validateLowCouplingInvariants,
    createLowCouplingStateStore,
    mutateLowCouplingSlices,
    mutateOwnedLowCouplingSlices,
  });
});

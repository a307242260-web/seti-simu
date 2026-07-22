(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserResidentProjection = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-host-v1";
  const LEGACY_SLICE_KEYS = Object.freeze([
    "playerState", "turnState", "cardState", "solarState", "rocketState",
    "planetStatsState", "nebulaDataState", "finalScoringState", "techGameState",
    "alienGameState", "viewerPlayer", "displayedTurn",
  ]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function fail(code, message, details = {}) {
    return deepFreeze({ ok: false, code, message, ...clone(details) });
  }

  function validateProjection(projection) {
    if (!projection || projection.schemaVersion !== SCHEMA_VERSION) {
      return fail("RESIDENT_PROJECTION_SCHEMA_UNSUPPORTED", `常驻投影需要 ${SCHEMA_VERSION} BrowserProjection`);
    }
    if (!projection.projectionId || !projection.source?.kind || !projection.viewer?.viewerId) {
      return fail("RESIDENT_PROJECTION_IDENTITY_INVALID", "BrowserProjection 缺少 projection/source/viewer identity");
    }
    if (!Number.isSafeInteger(projection.source.stateVersion) || projection.source.stateVersion < 0) {
      return fail("RESIDENT_PROJECTION_VERSION_INVALID", "BrowserProjection source.stateVersion 必须是非负安全整数");
    }
    return { ok: true };
  }

  function createResidentProjection(input = {}) {
    const legacyKeys = LEGACY_SLICE_KEYS.filter((key) => Object.hasOwn(input, key));
    if (legacyKeys.length) {
      return fail("RESIDENT_PROJECTION_LEGACY_SLICE_REJECTED", "常驻投影拒绝传统规则 slice 输入", { legacyKeys });
    }
    let projection = input.projection || null;
    if (!projection && input.stateSource?.project && typeof input.projector === "function") {
      projection = input.stateSource.project(input.projector, input.viewer || null);
    }
    const validation = validateProjection(projection);
    return validation.ok ? deepFreeze(clone(projection)) : validation;
  }

  function clonePresentation(value, seen = new WeakMap()) {
    if (value == null || typeof value !== "object") {
      return typeof value === "function" || typeof value === "symbol" ? undefined : value;
    }
    if (seen.has(value)) return undefined;
    if (value instanceof Set) return [...value].map((item) => clonePresentation(item));
    if (value instanceof Map) {
      return Object.fromEntries([...value.entries()].map(([key, item]) => [
        String(key), clonePresentation(item),
      ]));
    }
    const output = Array.isArray(value) ? [] : {};
    seen.set(value, output);
    for (const [key, item] of Object.entries(value)) {
      const cloned = clonePresentation(item, seen);
      if (cloned !== undefined) output[key] = cloned;
    }
    return output;
  }

  function createLegacyReadoutRoot(resident, options = {}) {
    const solarKey = options.solarKey || "solar";
    return {
      turnState: structuredClone(resident.turn || {}),
      playerState: structuredClone(resident.players || { currentPlayerId: null, players: [] }),
      solarState: structuredClone(resident[solarKey] || {}),
      rocketState: structuredClone(resident.pieces || {}),
      planetStatsState: structuredClone(resident.planets || {}),
      nebulaDataState: structuredClone(resident.data || {}),
      cardState: structuredClone(resident.cards || {}),
      techGameState: structuredClone(resident.tech || {}),
      alienGameState: structuredClone(resident.aliens || {}),
      finalScoringState: structuredClone(resident.finalScoring || {}),
      ...(options.includeMatch ? { match: structuredClone(resident.match || {}) } : {}),
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    LEGACY_SLICE_KEYS,
    validateProjection,
    createResidentProjection,
    clonePresentation,
    createLegacyReadoutRoot,
  });
});

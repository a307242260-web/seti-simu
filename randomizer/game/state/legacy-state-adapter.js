(function (root, factory) {
  "use strict";

  let stateStore = root.SetiStateStore;
  let lowCouplingState = root.SetiLowCouplingState;
  let highCouplingState = root.SetiHighCouplingState;
  if (!stateStore && typeof require === "function") {
    stateStore = require("./state-store");
  }
  if (!lowCouplingState && typeof require === "function") {
    lowCouplingState = require("./low-coupling-slices");
  }
  if (!highCouplingState && typeof require === "function") {
    highCouplingState = require("./high-coupling-slices");
  }

  const api = factory(stateStore, lowCouplingState, highCouplingState);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiLegacyStateAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (stateStore, lowCouplingState, highCouplingState) {
  "use strict";

  if (!stateStore) throw new Error("SetiStateStore is required before SetiLegacyStateAdapter");
  if (!lowCouplingState) throw new Error("SetiLowCouplingState is required before SetiLegacyStateAdapter");
  if (!highCouplingState) throw new Error("SetiHighCouplingState is required before SetiLegacyStateAdapter");

  const LEGACY_RECOVERY_VERSION = 1;
  const COMMITTED_RECOVERY_VERSION = 2;
  const LEGACY_STATE_SLICES = Object.freeze([
    "solarState",
    "nebulaDataState",
    "alienGameState",
    "finalScoringState",
    "playerState",
    "turnState",
    "rocketState",
    "planetStatsState",
    "techGameState",
    "cardState",
    "cardTaskState",
    "setupSelectionState",
  ]);
  const FIELD_OWNERSHIP = Object.freeze({
    solarState: "committed:solarSystem; derived:wheelSteps",
    nebulaDataState: "committed:data; derived:playerTokenCounts/lastReplaced*; host-only:labels/assets/layout",
    alienGameState: "committed:aliens; host-only:labels/assets/display",
    finalScoringState: "committed:finalScoring; session-owned:pendingMarks",
    playerState: "committed:players; legacy-adapter:currentPlayerId->turn.currentPlayerId",
    turnState: "committed:turn",
    rocketState: "committed:pieces; legacy-adapter:nextRocketId/playerRocketSequences; host-only:statusNote",
    planetStatsState: "committed:planets markers; derived:orbits/landings/marker display",
    techGameState: "committed:tech.board; host-only:ui",
    cardState: "committed:cards; host-only:ui",
    cardTaskState: "derived:excluded",
    setupSelectionState: "session-owned:excluded",
    "runtime.aiControl": "host-only:excluded",
  });
  const ADAPTER_CONTRACT = Object.freeze({
    source: "SETI recovery/headless snapshot version 1 with exactly 12 legacy state slices",
    target: stateStore.SCHEMA_VERSION,
    direction: "deserialize legacy once, then use committed snapshot as authority",
    deleteWhen: "all persisted recovery/checkpoint artifacts are committed schema and no supported v1 artifact remains",
  });

  function isPlainObject(value) {
    if (value == null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function failure(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function parseSnapshot(input) {
    if (typeof input !== "string") return { ok: true, snapshot: input };
    try {
      return { ok: true, snapshot: JSON.parse(input) };
    } catch (error) {
      return failure("LEGACY_SNAPSHOT_JSON_INVALID", error?.message || "恢复快照 JSON 损坏");
    }
  }

  function clonePlain(value) {
    return structuredClone(value);
  }

  function omit(source, keys) {
    const result = clonePlain(source || {});
    for (const key of keys) delete result[key];
    return result;
  }

  function normalizeSequenceSets(playerRocketSequences) {
    const normalized = {};
    for (const [playerId, sequences] of Object.entries(playerRocketSequences || {})) {
      if (sequences instanceof Set) {
        normalized[playerId] = [...sequences].sort((left, right) => Number(left) - Number(right));
      } else if (Array.isArray(sequences)) {
        normalized[playerId] = [...sequences].sort((left, right) => Number(left) - Number(right));
      } else {
        throw new TypeError(`rocketState.playerRocketSequences.${playerId} 必须是 Set 或数组`);
      }
    }
    return normalized;
  }

  function restoreSequenceSets(playerRocketSequences) {
    return Object.fromEntries(Object.entries(playerRocketSequences || {}).map(([playerId, sequences]) => {
      if (!Array.isArray(sequences)) {
        throw new TypeError(`pieces.playerRocketSequences.${playerId} 必须是数组`);
      }
      return [playerId, new Set(sequences)];
    }));
  }

  function createBootstrapStore() {
    return highCouplingState.createHighCouplingStateStore(stateStore.createCommittedGameState({
      gameId: "legacy-adapter-bootstrap",
      rulesetVersion: "legacy-recovery-v1",
      seed: "legacy-adapter-bootstrap",
      rngState: { owner: "legacy-host", state: null },
      sequences: {},
    }));
  }

  function adaptLegacySnapshot(input, options = {}) {
    const parsed = parseSnapshot(input);
    if (!parsed.ok) return parsed;
    const snapshot = parsed.snapshot;
    if (!isPlainObject(snapshot)) {
      return failure("LEGACY_SNAPSHOT_INVALID", "恢复快照必须是普通对象");
    }
    if (snapshot.version !== LEGACY_RECOVERY_VERSION) {
      return failure(
        "LEGACY_SNAPSHOT_VERSION_UNSUPPORTED",
        `不支持的旧恢复快照版本：${snapshot.version ?? "missing"}`,
        { version: snapshot.version ?? null },
      );
    }
    if (!isPlainObject(snapshot.state)) {
      return failure("LEGACY_STATE_INVALID", "旧恢复快照缺少 state 对象");
    }
    const missingSlices = LEGACY_STATE_SLICES.filter((key) => !Object.hasOwn(snapshot.state, key));
    if (missingSlices.length) {
      return failure("LEGACY_STATE_SLICE_MISSING", `旧恢复快照缺少切片：${missingSlices.join(", ")}`, {
        missingSlices,
      });
    }

    try {
      const legacy = snapshot.state;
      const players = omit(legacy.playerState, ["currentPlayerId"]);
      const turn = {
        ...clonePlain(legacy.turnState),
        currentPlayerId: legacy.playerState.currentPlayerId ?? snapshot.meta?.currentPlayerId ?? null,
      };
      const pieces = omit(legacy.rocketState, ["nextRocketId", "statusNote"]);
      pieces.playerRocketSequences = normalizeSequenceSets(legacy.rocketState.playerRocketSequences);
      const nextRocketId = legacy.rocketState.nextRocketId;
      if (!Number.isSafeInteger(nextRocketId) || nextRocketId < 0) {
        return failure("LEGACY_SEQUENCE_INVALID", "rocketState.nextRocketId 必须是非负安全整数");
      }

      const committed = highCouplingState.purifyHighCouplingSlices(stateStore.createCommittedGameState({
        stateVersion: 0,
        gameId: options.gameId || `legacy-recovery-${snapshot.meta?.entryId ?? "current"}`,
        rulesetVersion: options.rulesetVersion || "legacy-recovery-v1",
        seed: options.seed ?? snapshot.meta?.seed ?? "legacy-host-owned",
        rngState: options.rngState || snapshot.meta?.rngState || { owner: "legacy-host", state: null },
        sequences: { rocket: nextRocketId },
        match: {},
        turn,
        players,
        solarSystem: clonePlain(legacy.solarState),
        pieces,
        planets: clonePlain(legacy.planetStatsState),
        data: clonePlain(legacy.nebulaDataState),
        cards: omit(legacy.cardState, ["ui"]),
        tech: omit(legacy.techGameState, ["ui"]),
        aliens: clonePlain(legacy.alienGameState),
        finalScoring: omit(legacy.finalScoringState, ["pendingMarks"]),
      }));
      const deserialized = createBootstrapStore().deserialize(committed);
      return deserialized.ok
        ? { ...deserialized, sourceVersion: LEGACY_RECOVERY_VERSION }
        : deserialized;
    } catch (error) {
      return failure("LEGACY_STATE_ADAPT_FAILED", error?.message || "旧状态适配失败");
    }
  }

  function serializeLegacySnapshot(input, options = {}) {
    const adapted = adaptLegacySnapshot(input, options);
    if (!adapted.ok) return adapted;
    const store = highCouplingState.createHighCouplingStateStore(adapted.state);
    return store.serialize();
  }

  function deserializeRecoverySnapshot(input, options = {}) {
    const parsed = parseSnapshot(input);
    if (!parsed.ok) return parsed;
    const snapshot = parsed.snapshot;
    if (!isPlainObject(snapshot)) {
      return failure("RECOVERY_SNAPSHOT_INVALID", "恢复快照必须是普通对象");
    }
    if (snapshot.version === LEGACY_RECOVERY_VERSION) {
      return adaptLegacySnapshot(snapshot, options);
    }
    if (snapshot.version !== COMMITTED_RECOVERY_VERSION) {
      return failure(
        "RECOVERY_SNAPSHOT_VERSION_UNSUPPORTED",
        `不支持的恢复快照版本：${snapshot.version ?? "missing"}`,
      );
    }
    if (typeof snapshot.committedState !== "string") {
      return failure("RECOVERY_COMMITTED_STATE_MISSING", "恢复快照缺少 committedState JSON");
    }
    let parsedCommitted;
    try {
      parsedCommitted = JSON.parse(snapshot.committedState);
    } catch (error) {
      return failure("STATE_DESERIALIZE_FAILED", error?.message || "状态 JSON 损坏");
    }
    try {
      return createBootstrapStore().deserialize(highCouplingState.purifyHighCouplingSlices(parsedCommitted));
    } catch (error) {
      return failure("STATE_LOW_COUPLING_MIGRATION_FAILED", error?.message || "低耦合切片净化失败");
    }
  }

  function projectCommittedStateToLegacySlices(committedState, options = {}) {
    const deserialized = createBootstrapStore().deserialize(committedState);
    if (!deserialized.ok) return deserialized;
    const state = deserialized.state;
    const hostState = options.hostState || {};
    try {
      return {
        ok: true,
        state: {
          solarState: projectSolarState(state.solarSystem),
          nebulaDataState: projectDataState(state.data),
          alienGameState: clonePlain(state.aliens),
          finalScoringState: {
            ...clonePlain(state.finalScoring),
            pendingMarks: [],
          },
          playerState: {
            ...clonePlain(state.players),
            currentPlayerId: state.turn.currentPlayerId ?? null,
          },
          turnState: omit(state.turn, ["currentPlayerId"]),
          rocketState: {
            ...clonePlain(state.pieces),
            nextRocketId: state.meta.sequences.rocket,
            playerRocketSequences: restoreSequenceSets(state.pieces.playerRocketSequences),
            statusNote: hostState.rocketState?.statusNote ?? null,
          },
          planetStatsState: projectPlanetState(state.planets),
          techGameState: {
            board: clonePlain(state.tech),
            ui: clonePlain(hostState.techGameState?.ui || {}),
          },
          cardState: {
            ...clonePlain(state.cards),
            ui: clonePlain(hostState.cardState?.ui || {}),
          },
        },
      };
    } catch (error) {
      return failure("COMMITTED_STATE_PROJECTION_FAILED", error?.message || "CommittedGameState 投影失败");
    }
  }

  function mutateLegacyLowCouplingSlices(store, mutator, options = {}) {
    if (!store || typeof store.getSnapshot !== "function") throw new TypeError("必须传入 StateStore");
    if (typeof mutator !== "function") throw new TypeError("mutator 必须是函数");
    const snapshot = store.getSnapshot();
    const projected = projectCommittedStateToLegacySlices(snapshot, options);
    if (!projected.ok) return projected;
    const legacy = {
      solarState: projected.state.solarState,
      turnState: { ...projected.state.turnState, currentPlayerId: snapshot.turn.currentPlayerId ?? null },
      planetStatsState: projected.state.planetStatsState,
      nebulaDataState: projected.state.nebulaDataState,
      alienGameState: projected.state.alienGameState,
      finalScoringState: projected.state.finalScoringState,
    };
    let mutationResult;
    try {
      mutationResult = mutator(legacy);
    } catch (error) {
      return failure("STATE_MUTATOR_FAILED", error?.message || "旧领域行为适配失败");
    }
    return lowCouplingState.mutateLowCouplingSlices(store, (_slices, workingState) => {
      workingState.solarSystem = lowCouplingState.purifyLowCouplingSlices({
        ...snapshot,
        solarSystem: legacy.solarState,
      }).solarSystem;
      workingState.turn = lowCouplingState.purifyLowCouplingSlices({
        ...snapshot,
        turn: legacy.turnState,
      }).turn;
      workingState.planets = lowCouplingState.purifyLowCouplingSlices({
        ...snapshot,
        planets: legacy.planetStatsState,
      }).planets;
      workingState.data = lowCouplingState.purifyLowCouplingSlices({
        ...snapshot,
        data: legacy.nebulaDataState,
      }).data;
      workingState.aliens = lowCouplingState.purifyLowCouplingSlices({
        ...snapshot,
        aliens: legacy.alienGameState,
      }).aliens;
      workingState.finalScoring = lowCouplingState.purifyLowCouplingSlices({
        ...snapshot,
        finalScoring: legacy.finalScoringState,
      }).finalScoring;
      return mutationResult;
    });
  }

  function projectSolarState(source) {
    const solar = clonePlain(source || {});
    if (isPlainObject(solar.rotation)) {
      solar.wheelSteps = [0, 1, 2, 3, 4].map((wheelId) => (
        wheelId === 0 ? 0 : Number(solar.rotation[`wheel${wheelId}Steps`] || 0)
      ));
    }
    return solar;
  }

  function projectPlanetState(source) {
    const planets = clonePlain(source || {});
    for (const record of Object.values(planets.planets || {})) {
      if (!isPlainObject(record)) continue;
      for (const key of ["orbitMarkers", "landingMarkers"]) {
        if (!Array.isArray(record[key])) record[key] = [];
        record[key].forEach((marker, index) => {
          marker.sequence = index + 1;
          marker.displayed = true;
          marker.displaySlot = index + 1;
        });
      }
      if (!Array.isArray(record.satelliteLandings)) record.satelliteLandings = [];
      record.orbits = record.orbitMarkers.length;
      record.landings = record.landingMarkers.length;
    }
    return planets;
  }

  function projectDataState(source) {
    const data = clonePlain(source || {});
    for (const bucket of Object.values(data.nebulae || {})) {
      if (!isPlainObject(bucket)) continue;
      const counts = {};
      let last = null;
      for (const token of bucket.tokens || []) {
        const color = token.replacedByPlayerColor || token.playerColor || null;
        if (color) counts[color] = (counts[color] || 0) + 1;
        if (color) last = token;
      }
      bucket.playerTokenCounts = counts;
      bucket.lastReplacedPlayerId = last?.replacedByPlayerId || last?.playerId || null;
      bucket.lastReplacedPlayerColor = last?.replacedByPlayerColor || last?.playerColor || null;
      bucket.lastReplacedPlayerLabel = null;
    }
    return data;
  }

  return Object.freeze({
    LEGACY_RECOVERY_VERSION,
    COMMITTED_RECOVERY_VERSION,
    LEGACY_STATE_SLICES,
    FIELD_OWNERSHIP,
    LOW_COUPLING_FIELD_OWNERSHIP: lowCouplingState.FIELD_OWNERSHIP,
    ADAPTER_CONTRACT,
    adaptLegacySnapshot,
    serializeLegacySnapshot,
    deserializeRecoverySnapshot,
    projectCommittedStateToLegacySlices,
    mutateLegacyLowCouplingSlices,
  });
});

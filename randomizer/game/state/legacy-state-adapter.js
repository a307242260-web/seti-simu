(function (root, factory) {
  "use strict";

  let stateStore = root.SetiStateStore;
  if (!stateStore && typeof require === "function") {
    stateStore = require("./state-store");
  }

  const api = factory(stateStore);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiLegacyStateAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (stateStore) {
  "use strict";

  if (!stateStore) throw new Error("SetiStateStore is required before SetiLegacyStateAdapter");

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
    solarState: "committed:solarSystem",
    nebulaDataState: "committed:data",
    alienGameState: "committed:aliens",
    finalScoringState: "committed:finalScoring; session-owned:pendingMarks",
    playerState: "committed:players; legacy-adapter:currentPlayerId->turn.currentPlayerId",
    turnState: "committed:turn",
    rocketState: "committed:pieces; legacy-adapter:nextRocketId/playerRocketSequences; host-only:statusNote",
    planetStatsState: "committed:planets",
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
    return stateStore.createStateStore(stateStore.createCommittedGameState({
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

      const committed = stateStore.createCommittedGameState({
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
      });
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
    const store = stateStore.createStateStore(adapted.state);
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
    return createBootstrapStore().deserialize(snapshot.committedState);
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
          solarState: clonePlain(state.solarSystem),
          nebulaDataState: clonePlain(state.data),
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
          planetStatsState: clonePlain(state.planets),
          techGameState: {
            ...clonePlain(state.tech),
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

  return Object.freeze({
    LEGACY_RECOVERY_VERSION,
    COMMITTED_RECOVERY_VERSION,
    LEGACY_STATE_SLICES,
    FIELD_OWNERSHIP,
    ADAPTER_CONTRACT,
    adaptLegacySnapshot,
    serializeLegacySnapshot,
    deserializeRecoverySnapshot,
    projectCommittedStateToLegacySlices,
  });
});

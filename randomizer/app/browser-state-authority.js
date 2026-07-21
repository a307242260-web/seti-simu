(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppBrowserStateAuthority = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function clone(value) {
    return structuredClone(value);
  }

  function replaceMutableObject(target, source) {
    for (const key of Reflect.ownKeys(target || {})) delete target[key];
    Object.assign(target, clone(source || {}));
    return target;
  }

  function requireFunction(value, label) {
    if (typeof value !== "function") throw new TypeError(`BrowserStateAuthority 缺少 ${label}`);
    return value;
  }

  function createBrowserStateAuthority(options = {}) {
    const modules = options.modules || {};
    const stateStoreApi = modules.stateStore;
    const highCouplingState = modules.highCouplingState;
    requireFunction(stateStoreApi?.createCommittedGameState, "StateStore.createCommittedGameState");
    requireFunction(highCouplingState?.createHighCouplingStateStore, "createHighCouplingStateStore");
    requireFunction(highCouplingState?.purifyHighCouplingSlices, "purifyHighCouplingSlices");

    let contextProvider = () => ({});
    const listeners = new Set();
    let unsubscribeStore = null;
    let store = null;

    function createWorkingSlices(input = {}) {
      const playerState = modules.players.createPlayerState({
        players: modules.players.PLAYER_COLOR_IDS.map((color) => ({ color })),
        currentPlayerColor: input.defaultInitialPlayerColor,
      });
      return {
        meta: {},
        match: {},
        turnState: modules.createTurnState(playerState.players, {
          activePlayerCount: input.activePlayerCount,
          currentPlayerId: playerState.currentPlayerId,
        }),
        playerState,
        solarState: modules.solar.createBaselineState(),
        rocketState: modules.rocketActions.createRocketState(),
        planetStatsState: modules.planetStats.createPlanetStatsState(),
        nebulaDataState: modules.data.createDefaultNebulaDataState(),
        cardState: modules.cards.createCardState(),
        techGameState: modules.tech.createState(),
        alienGameState: modules.aliens.createDefaultAlienState(),
        finalScoringState: modules.finalScoring.createFinalScoringState(input.finalScoreIds || []),
      };
    }

    const working = createWorkingSlices(options);

    function buildCandidate(overrides = {}) {
      const context = { ...contextProvider(), ...overrides };
      const currentVersion = store?.getSnapshot?.().meta.stateVersion ?? 0;
      return highCouplingState.purifyHighCouplingSlices({
        meta: {
          schemaVersion: stateStoreApi.SCHEMA_VERSION,
          stateVersion: currentVersion,
          gameId: context.gameId || "seti-browser-runtime",
          rulesetVersion: context.rulesetVersion || "seti-runtime-v1",
          seed: context.seed ?? "browser-host",
          rngState: clone(context.rngState || { owner: context.headlessMode ? "headless" : "browser", state: null }),
          sequences: clone(context.sequences || {}),
        },
        match: clone(working.match),
        turn: { ...clone(working.turnState), currentPlayerId: working.playerState.currentPlayerId },
        players: clone(working.playerState),
        solarSystem: clone(working.solarState),
        pieces: clone(working.rocketState),
        planets: clone(working.planetStatsState),
        data: clone(working.nebulaDataState),
        cards: clone(working.cardState),
        tech: clone(working.techGameState),
        aliens: clone(working.alienGameState),
        finalScoring: clone(working.finalScoringState),
      });
    }

    function forwardStoreEvents() {
      unsubscribeStore?.();
      unsubscribeStore = store.subscribe((event) => {
        for (const listener of [...listeners]) listener(event);
      });
    }

    function installStore(candidate) {
      store = highCouplingState.createHighCouplingStateStore(candidate);
      forwardStoreEvents();
      working.meta = clone(store.getSnapshot().meta);
      return store;
    }

    installStore(buildCandidate());

    function commit(metadata = null, overrides = {}) {
      const before = store.getSnapshot();
      const candidate = buildCandidate(overrides);
      candidate.meta.stateVersion = before.meta.stateVersion;
      const beforeSerialized = store.serialize(before);
      const candidateSerialized = store.serialize(candidate);
      if (beforeSerialized.ok && candidateSerialized.ok
        && beforeSerialized.serialized === candidateSerialized.serialized) {
        return {
          ok: true,
          noop: true,
          previousVersion: before.meta.stateVersion,
          stateVersion: before.meta.stateVersion,
          snapshot: before,
        };
      }
      const result = store.compareAndCommit(before.meta.stateVersion, candidate, metadata);
      if (result.ok) working.meta = clone(result.snapshot.meta);
      return result;
    }

    function serialize(overrides = {}) {
      const committed = commit({ source: "browser-serialize" }, overrides);
      return committed.ok ? store.serialize() : committed;
    }

    function resetWorking(resetOptions = {}) {
      const next = createWorkingSlices({
        defaultInitialPlayerColor: resetOptions.defaultInitialPlayerColor ?? options.defaultInitialPlayerColor,
        activePlayerCount: resetOptions.activePlayerCount ?? options.activePlayerCount,
        finalScoreIds: resetOptions.finalScoreIds ?? options.finalScoreIds,
      });
      for (const key of Object.keys(next)) {
        if (key === "meta") continue;
        replaceMutableObject(working[key], next[key]);
      }
      return commit({ source: "browser-new-game" }, resetOptions);
    }

    function hydrateWorkingFromCommitted(state) {
      const statusNote = working.rocketState.statusNote;
      const techUi = clone(working.techGameState.ui || {});
      const cardUi = clone(working.cardState.ui || {});
      replaceMutableObject(working.solarState, state.solarSystem);
      if (working.solarState.rotation) {
        working.solarState.wheelSteps = [0, 1, 2, 3, 4].map((wheelId) => (
          wheelId === 0 ? 0 : Number(working.solarState.rotation[`wheel${wheelId}Steps`] || 0)
        ));
      }
      replaceMutableObject(working.nebulaDataState, state.data);
      for (const bucket of Object.values(working.nebulaDataState.nebulae || {})) {
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
      replaceMutableObject(working.alienGameState, state.aliens);
      replaceMutableObject(working.finalScoringState, { ...state.finalScoring, pendingMarks: [] });
      replaceMutableObject(working.playerState, {
        ...state.players,
        currentPlayerId: state.turn.currentPlayerId ?? null,
      });
      const restoredTurn = clone(state.turn);
      delete restoredTurn.currentPlayerId;
      replaceMutableObject(working.turnState, restoredTurn);
      replaceMutableObject(working.rocketState, {
        ...state.pieces,
        nextRocketId: state.meta.sequences.rocket,
        playerRocketSequences: Object.fromEntries(Object.entries(
          state.pieces.playerRocketSequences || {},
        ).map(([playerId, values]) => [playerId, new Set(values)])),
        statusNote,
      });
      replaceMutableObject(working.planetStatsState, state.planets);
      for (const record of Object.values(working.planetStatsState.planets || {})) {
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
      replaceMutableObject(working.techGameState, { board: state.tech, ui: techUi });
      replaceMutableObject(working.cardState, { ...state.cards, ui: cardUi });
      working.meta = clone(state.meta);
    }

    function replaceCommitted(candidate) {
      const purified = highCouplingState.purifyHighCouplingSlices(candidate);
      const nextStore = highCouplingState.createHighCouplingStateStore(purified);
      const snapshot = nextStore.getSnapshot();
      hydrateWorkingFromCommitted(snapshot);
      unsubscribeStore?.();
      store = nextStore;
      forwardStoreEvents();
      return { ok: true, snapshot: store.getSnapshot() };
    }

    function runTransaction(mutator, options = {}) {
      requireFunction(mutator, "transaction mutator");
      const beforeBytes = store.serialize();
      const beforeWorking = clone(working);
      const journal = options.journal || null;
      const journalBefore = journal && typeof journal.snapshot === "function" ? journal.snapshot() : null;
      try {
        mutator(working);
      } catch (error) {
        for (const key of Object.keys(beforeWorking)) {
          if (key === "meta") working.meta = beforeWorking.meta;
          else replaceMutableObject(working[key], beforeWorking[key]);
        }
        if (journalBefore != null && typeof journal.restore === "function") journal.restore(journalBefore);
        return { ok: false, code: "BROWSER_STATE_MUTATOR_FAILED", message: error?.message || "Browser state mutator 失败" };
      }
      const result = commit(options.metadata || { source: "browser-transaction" });
      if (!result.ok) {
        for (const key of Object.keys(beforeWorking)) {
          if (key === "meta") working.meta = beforeWorking.meta;
          else replaceMutableObject(working[key], beforeWorking[key]);
        }
        if (journalBefore != null && typeof journal.restore === "function") journal.restore(journalBefore);
        const afterBytes = store.serialize();
        if (beforeBytes.ok && afterBytes.ok && beforeBytes.serialized !== afterBytes.serialized) {
          throw new Error("BrowserStateAuthority 原子失败污染 committed bytes");
        }
      }
      return result;
    }

    return Object.freeze({
      working,
      getSnapshot: () => store.getSnapshot(),
      beginWorkingCopy: (...args) => store.beginWorkingCopy(...args),
      compareAndCommit: (...args) => store.compareAndCommit(...args),
      validate: (...args) => store.validate(...args),
      deserialize: (...args) => store.deserialize(...args),
      serialize,
      subscribe(listener) {
        requireFunction(listener, "subscriber");
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      setContextProvider(provider) {
        contextProvider = requireFunction(provider, "context provider");
      },
      commit,
      resetWorking,
      replaceCommitted,
      hydrateWorkingFromCommitted,
      runTransaction,
    });
  }

  return Object.freeze({ createBrowserStateAuthority, replaceMutableObject });
});

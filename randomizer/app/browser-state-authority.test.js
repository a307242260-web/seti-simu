"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const stateStore = require("../game/state/state-store");
const highCouplingState = require("../game/state/high-coupling-slices");
const authorityApi = require("./browser-state-authority");
const players = require("../game/players");
const solar = require("../solar-system/core");
const rocketActions = require("../game/rockets");
const planetStats = require("../game/planet-stats");
const data = require("../game/data");
const cards = require("../game/cards/deck");
const tech = require("../game/tech");
const aliens = require("../game/aliens");
const finalScoring = require("../game/final-scoring");
const turnFlow = require("./turn-flow");
const initialGameState = require("../game/state/initial-game-state");
const runtimeAuthority = require("../game/state/runtime-authority");

function createAuthority() {
  let storeCreations = 0;
  let legacyCommittedFactoryCalls = 0;
  const poisonedStateStore = {
    ...stateStore,
    createCommittedGameState() {
      legacyCommittedFactoryCalls += 1;
      throw new Error("legacy committed factory poison");
    },
  };
  const instrumentedHighCoupling = {
    ...highCouplingState,
    createHighCouplingStateStore(candidate, options) {
      storeCreations += 1;
      return highCouplingState.createHighCouplingStateStore(candidate, options);
    },
  };
  const authority = authorityApi.createBrowserStateAuthority({
    modules: {
      stateStore: poisonedStateStore,
      highCouplingState: instrumentedHighCoupling,
      initialGameState,
      runtimeAuthority,
      players,
      solar,
      rocketActions,
      planetStats,
      data,
      cards,
      tech,
      aliens,
      finalScoring,
      createTurnState: turnFlow.createTurnState,
    },
    defaultInitialPlayerColor: players.DEFAULT_PLAYER_COLOR,
    activePlayerCount: 4,
    finalScoreIds: ["a", "b", "c"],
  });
  authority.setContextProvider(() => ({
    sequences: {
      card: 1,
      handCard: 1,
      finalMark: 1,
      dataToken: 1,
      nebulaToken: 1,
      nebulaReplacement: 1,
      historyStep: 1,
      actionLog: 1,
      rocket: authority.getActiveSession().workingState.rocketState.nextRocketId,
    },
  }));
  return { authority, counters: () => ({ storeCreations, legacyCommittedFactoryCalls }) };
}

(function testBootstrapAndSaveUseOneResidentAuthority() {
  const { authority, counters } = createAuthority();
  const saved = authority.lifecycle.save();
  assert.equal(saved.ok, true);
  assert.deepEqual(counters(), { storeCreations: 1, legacyCommittedFactoryCalls: 0 });
  assert.equal(saved.envelope.schemaVersion, authority.RULE_SAVE_SCHEMA_VERSION);
  assert.doesNotMatch(saved.envelope.committedState, /statusNote|selectionActive|industryBorrowMode/);
  for (const legacyPort of ["serialize", "deserialize", "restore", "resetSession", "beginWorkingCopy", "compareAndCommit"]) {
    assert.equal(Object.hasOwn(authority, legacyPort), false, `authority 不得向 Browser 暴露 ${legacyPort}`);
  }
})();

(function testSnapshotIsolationAndOneVersionCommit() {
  const { authority } = createAuthority();
  authority.lifecycle.save();
  const before = authority.lifecycle.save();
  const version = authority.getSnapshot().meta.stateVersion;
  const snapshot = authority.getSnapshot();
  assert.throws(() => { snapshot.turn.roundNumber = 99; }, TypeError);
  assert.equal(authority.lifecycle.save().envelope.committedState, before.envelope.committedState);

  const player = authority.getActiveSession().workingState.playerState.players[0];
  const result = authority.runTransaction(() => { player.resources.credits += 1; });
  assert.equal(result.ok, true);
  assert.equal(result.stateVersion, version + 1);
  assert.equal(authority.getSnapshot().players.players[0].resources.credits, player.resources.credits);
})();

(function testFailedMutationAndInvariantKeepBytesAndJournal() {
  const { authority } = createAuthority();
  authority.lifecycle.save();
  const before = authority.lifecycle.save().envelope.committedState;
  const journal = {
    entries: ["base"],
    snapshot() { return [...this.entries]; },
    restore(value) { this.entries = [...value]; },
  };
  const thrown = authority.runTransaction(() => {
    journal.entries.push("poison");
    throw new Error("step poison");
  }, { journal });
  assert.equal(thrown.code, "BROWSER_STATE_MUTATOR_FAILED");
  assert.equal(authority.lifecycle.save().envelope.committedState, before);
  assert.deepEqual(journal.entries, ["base"]);

  journal.entries = ["base"];
  const rejected = authority.runTransaction((working) => {
    journal.entries.push("invalid");
    working.playerState.currentPlayerId = "missing-player";
  }, { journal });
  assert.equal(rejected.ok, false);
  assert.equal(authority.lifecycle.save().envelope.committedState, before);
  assert.deepEqual(journal.entries, ["base"]);
})();

(function testRecoveryRestoresResidentStoreAndKeepsNarrowReferenceIdentity() {
  const { authority, counters } = createAuthority();
  authority.lifecycle.save();
  const playerReference = authority.getActiveSession().workingState.playerState;
  const saved = authority.lifecycle.save().envelope;
  const recovered = JSON.parse(saved.committedState);
  recovered.meta.stateVersion = 17;
  const result = authority.lifecycle.restore({ ...saved, committedState: JSON.stringify(recovered) });
  assert.equal(result.ok, true);
  assert.equal(authority.getActiveSession().workingState.playerState, playerReference);
  assert.equal(authority.getSnapshot().meta.stateVersion, 17);
  assert.deepEqual(counters(), { storeCreations: 1, legacyCommittedFactoryCalls: 0 });
})();

(function testLifecycleRejectsOldAndExtendedSchemaWithoutMutation() {
  const { authority } = createAuthority();
  const before = authority.lifecycle.save().envelope.committedState;
  assert.equal(authority.lifecycle.restore({ schemaVersion: "legacy-v0", committedState: before, session: null }).code, "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED");
  assert.equal(authority.lifecycle.restore({ schemaVersion: authority.RULE_SAVE_SCHEMA_VERSION, committedState: before, session: null, state: {} }).code, "RULE_COMPOSITION_SAVE_FIELDS_UNSUPPORTED");
  assert.equal(authority.lifecycle.restore({ schemaVersion: authority.RULE_SAVE_SCHEMA_VERSION, committedState: before, session: { id: "external" } }).code, "RULE_COMPOSITION_SESSION_SCHEMA_UNSUPPORTED");
  assert.equal(authority.lifecycle.save().envelope.committedState, before);
})();

console.log("browser state authority tests passed");

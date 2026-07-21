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
      rocket: authority.working.rocketState.nextRocketId,
    },
  }));
  return { authority, counters: () => ({ storeCreations, legacyCommittedFactoryCalls }) };
}

(function testBootstrapAndSaveUseOneResidentAuthority() {
  const { authority, counters } = createAuthority();
  const saved = authority.serialize();
  assert.equal(saved.ok, true);
  assert.deepEqual(counters(), { storeCreations: 1, legacyCommittedFactoryCalls: 0 });
  assert.doesNotMatch(saved.serialized, /statusNote|selectionActive|industryBorrowMode/);
})();

(function testSnapshotIsolationAndOneVersionCommit() {
  const { authority } = createAuthority();
  authority.serialize();
  const before = authority.serialize();
  const version = authority.getSnapshot().meta.stateVersion;
  const snapshot = authority.getSnapshot();
  assert.throws(() => { snapshot.turn.roundNumber = 99; }, TypeError);
  assert.equal(authority.serialize().serialized, before.serialized);

  const player = authority.working.playerState.players[0];
  const result = authority.runTransaction(() => { player.resources.credits += 1; });
  assert.equal(result.ok, true);
  assert.equal(result.stateVersion, version + 1);
  assert.equal(authority.getSnapshot().players.players[0].resources.credits, player.resources.credits);
})();

(function testFailedMutationAndInvariantKeepBytesAndJournal() {
  const { authority } = createAuthority();
  authority.serialize();
  const before = authority.serialize().serialized;
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
  assert.equal(authority.serialize().serialized, before);
  assert.deepEqual(journal.entries, ["base"]);

  journal.entries = ["base"];
  const rejected = authority.runTransaction((working) => {
    journal.entries.push("invalid");
    working.playerState.currentPlayerId = "missing-player";
  }, { journal });
  assert.equal(rejected.ok, false);
  assert.equal(authority.serialize().serialized, before);
  assert.deepEqual(journal.entries, ["base"]);
})();

(function testRecoveryRestoresResidentStoreAndKeepsNarrowReferenceIdentity() {
  const { authority, counters } = createAuthority();
  authority.serialize();
  const playerReference = authority.working.playerState;
  const recovered = structuredClone(authority.getSnapshot());
  recovered.meta.stateVersion = 17;
  const result = authority.replaceCommitted(recovered);
  assert.equal(result.ok, true);
  assert.equal(authority.working.playerState, playerReference);
  assert.equal(authority.getSnapshot().meta.stateVersion, 17);
  assert.deepEqual(counters(), { storeCreations: 1, legacyCommittedFactoryCalls: 0 });
})();

(function testCompositionHasNoLegacyStateOwnerConstruction() {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const turnFlowSource = fs.readFileSync(path.join(__dirname, "turn-flow.js"), "utf8");
  const aiSource = fs.readFileSync(path.join(__dirname, "ai-controller.js"), "utf8");
  const forbidden = /(?:solar|data|aliens|finalScoring|players|rocketActions|planetStats|cards|tech)\.create(?:Baseline|DefaultNebulaData|DefaultAlien|FinalScoring|Player|Rocket|PlanetStats|Card)?State\s*\(/;
  assert.doesNotMatch(appSource, forbidden);
  assert.doesNotMatch(turnFlowSource, forbidden);
  assert.doesNotMatch(aiSource, forbidden);
  assert.doesNotMatch(appSource, /createCommittedGameState\s*\(|createHighCouplingStateStore\s*\(/);
})();

console.log("browser state authority tests passed");

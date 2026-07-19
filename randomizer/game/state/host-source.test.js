"use strict";

const assert = require("node:assert/strict");
const { createCommittedGameState, createStateStore } = require("./state-store");
const { createHostStateSource, subscribeCommitRefresh } = require("./host-source");

const store = createStateStore(createCommittedGameState({
  gameId: "host-source",
  rulesetVersion: "stage-7-test",
  seed: "host-source-seed",
  players: { players: [{ id: "p1", hand: [{ id: "secret" }] }, { id: "p2", hand: [] }] },
  turn: { currentPlayerId: "p1" },
}));
let session = null;
const source = createHostStateSource({
  stateStore: store,
  getSession: () => session,
  inspectSession: (current) => ({
    sessionId: current.id,
    revision: current.revision,
    baseVersion: current.state.meta.stateVersion,
    phase: current.phase,
  }),
  observeSession: (current) => ({ state: current.state, decision: current.decision }),
});

const committed = source.read("p1");
assert.equal(committed.source.kind, "committed");
assert.equal(committed.state.turn.currentPlayerId, "p1");
assert.throws(() => { committed.state.turn.currentPlayerId = "p2"; }, TypeError);

session = {
  id: "session-1",
  revision: 3,
  phase: "awaiting_input",
  state: structuredClone(store.getSnapshot()),
  decision: { decisionId: "d1" },
};
session.state.turn.currentPlayerId = "p2";
const working = source.read("p2");
assert.equal(working.source.kind, "working");
assert.equal(working.source.sessionRevision, 3);
assert.equal(working.state.turn.currentPlayerId, "p2");
assert.equal(store.getSnapshot().turn.currentPlayerId, "p1", "working projection 不得污染 committed state");

const browser = source.project((state, viewer, envelope) => ({
  viewer,
  actor: state.turn.currentPlayerId,
  source: envelope.source.kind,
}), "p2");
const observation = source.project((state, viewer, envelope) => ({
  perspectivePlayerId: viewer,
  publicState: { currentPlayerId: state.turn.currentPlayerId },
  source: envelope.source.kind,
}), "p2");
assert.equal(browser.actor, observation.publicState.currentPlayerId);
assert.equal(browser.source, observation.source);

session = null;
let refreshCalls = 0;
const refresh = subscribeCommitRefresh(source, () => {
  refreshCalls += 1;
  throw new Error("renderer poison");
});
const workingCopy = store.beginWorkingCopy();
workingCopy.state.turn.currentPlayerId = "p2";
const committedResult = store.compareAndCommit(workingCopy.baseVersion, workingCopy.state);
assert.equal(committedResult.ok, true, "宿主 refresh 异常不得反向影响提交");
assert.equal(refreshCalls, 1);
assert.equal(refresh.getLastFailure().code, "HOST_COMMIT_REFRESH_FAILED");
assert.equal(store.getSnapshot().turn.currentPlayerId, "p2");
refresh.unsubscribe();

console.log("host StateSource stage 7 tests passed");

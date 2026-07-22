"use strict";

const assert = require("node:assert/strict");
const { createDecisionSessionStore } = require("./decision-session-store");

const store = createDecisionSessionStore();
const continuation = () => "resolved";
const opened = store.open("data_placement", {
  playerId: "p1",
  onConfirm: continuation,
});

assert.equal(opened.kind, "data_placement");
assert.equal(opened.ownerId, "p1");
assert.equal(typeof opened.decisionId, "string");
assert.equal("onConfirm" in opened, false, "inspect 不得向 BrowserProjection 泄漏 continuation");
assert.equal(store.peek("data_placement").onConfirm, continuation);
assert.equal(store.has("data_placement"), true);
assert.equal(store.clear("data_placement").onConfirm, continuation);
assert.equal(store.has("data_placement"), false);

const state = store.createFacade({ discardAction: "discard_action" });
state.discardAction = { playerId: "p3", cards: ["card-1"] };
assert.deepEqual(state.discardAction.cards, ["card-1"]);
state.discardAction = null;
assert.equal(store.peek("discard_action"), null);

store.open("land_target", { playerId: "p2" });
store.clearAll();
assert.equal(store.inspect("land_target"), null);

console.log("decision session store tests passed");

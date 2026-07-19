"use strict";

const assert = require("node:assert/strict");
const cards = require("../cards/deck");
const players = require("../players");
const finalScoring = require("../final-scoring");
const dataState = require("../data/state");
const nebulaState = require("../data/nebula-state");
const history = require("../history/action-history");

const scalarProviders = [
  [cards.getNextCardInstanceSequence, cards.restoreNextCardInstanceSequence],
  [players.getNextHandCardSequence, players.restoreNextHandCardSequence],
  [finalScoring.getNextFinalMarkSequence, finalScoring.restoreNextFinalMarkSequence],
  [dataState.getNextDataTokenSequence, dataState.restoreNextDataTokenSequence],
  [history.getNextHistoryStepSequence, history.restoreNextHistoryStepSequence],
];

for (const [read, restore] of scalarProviders) {
  assert.equal(restore(37), 37);
  assert.equal(read(), 37);
  assert.throws(() => restore(0), /正安全整数/);
  assert.equal(read(), 37, "非法恢复不得改变模块闭包序列");
}

assert.deepEqual(nebulaState.restoreDeterministicSequences({
  nebulaToken: 41,
  nebulaReplacement: 17,
}), {
  nebulaToken: 41,
  nebulaReplacement: 17,
});
assert.throws(
  () => nebulaState.restoreDeterministicSequences({ nebulaToken: 42, nebulaReplacement: null }),
  /nebulaReplacement 序列必须是正安全整数/,
);
assert.deepEqual(nebulaState.getDeterministicSequences(), {
  nebulaToken: 41,
  nebulaReplacement: 17,
}, "非法恢复必须原子拒绝，不得部分改写闭包序列");

console.log("deterministic module sequence tests passed");

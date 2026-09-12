"use strict";
const assert = require("node:assert/strict");
const old = require("./plan186-1e3cc2e6-20260913.json");
const rule = require("./plan186-3418fea7-20260913.json");
const optimized = require("./plan186-00e7201b-20260913.json");
for (const x of [old, rule, optimized]) assert(!x.error);
for (const key of ["stateHash", "legal", "observation"]) assert.deepEqual(old[key], rule[key], key);
for (const key of ["stateHash", "legal", "observation", "selection", "evaluations", "outcomeSummary"])
  assert.deepEqual(rule[key], optimized[key], key);
const withoutTime = searches => searches.map(s => {
  const copy = structuredClone(s); delete copy.diagnostics.totalMilliseconds; return copy;
});
assert.deepEqual(withoutTime(rule.searches), withoutTime(optimized.searches));
const winner = x => x.evaluations.find(e => e.actionId === x.selection.actionId);
assert.equal(winner(old).chain[7], "choose_card:bbcb0101");
assert.equal(winner(rule).chain[7], "choose_card:c4f4b1eb");
assert.equal(winner(rule).leafId, "leaf:6e4fd5e9");
console.log("186隔离通过：同一输入；仅规则修复已改变收入后继；叠加优化后全部根最佳评分/链和非耗时诊断一致。");

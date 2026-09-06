"use strict";
const assert = require("node:assert/strict");
const { createCollector, collectBudgetHits, seedCollectorFrom } = require("./run_research_validation");
const c = createCollector();
const result = { policyDecision: { seatId: "p1", actionId: "move:a" }, searches: [
  { kind: "control", diagnostics: { executedNodeCount: 1, maxExecutionNodes: 1, executionLimitReached: false } },
  { kind: "strategic", diagnostics: { executedNodeCount: 4096, maxExecutionNodes: 4096,
    executionLimitReached: true, frontierOriginCountByFamily: { move: 1 } } },
] };
collectBudgetHits(c, 24, result);
collectBudgetHits(c, 25, { ...result, searches: [] });
assert.equal(c.searches.length, 2, "复用不得重复记录上一次搜索");
assert.equal(c.budgetHits.length, 1);
assert.deepEqual(c.searches.map(s => [s.step, s.searchIndex, s.kind]), [[24, 0, "control"], [24, 1, "strategic"]]);
result.searches[1].diagnostics.executedNodeCount = 0;
assert.equal(c.searches[1].diagnostics.executedNodeCount, 4096);
const resumed = createCollector();
seedCollectorFrom(resumed, c);
collectBudgetHits(resumed, 201, { searches: [{ kind: "strategic",
  diagnostics: { executedNodeCount: 4096, maxExecutionNodes: 4096, executionLimitReached: false } }] });
assert.equal(resumed.searches.length, 3);
assert.equal(resumed.budgetHits.length, 1, "自然恰好满额不等于有剩余队列的截断");
assert.equal(resumed.searches.filter(s => s.kind === "strategic"
  && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes).length, 2);
resumed.searches[0].diagnostics.executedNodeCount = 9;
assert.equal(c.searches[0].diagnostics.executedNodeCount, 1);
assert.throws(() => collectBudgetHits(c, 26, {}), /STATISTICS_MISSING/);
assert.throws(() => collectBudgetHits(c, 26, { searches: [{ kind: "strategic", diagnostics: null }] }), /STATISTICS_MISSING/);
assert.throws(() => seedCollectorFrom(createCollector(), {}), /STATISTICS_MISSING/);
console.log("research search statistics tests passed");

"use strict";
const assert = require("node:assert/strict");
const { createCollector, collectBudgetHits, seedCollectorFrom } = require("./run_research_validation");
const { renderSearchBudgetReport } = require("./robot-iteration-lib");
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
const limitSearch = { kind: "strategic", diagnostics: { budgetLimits: {
  leaves: { enabled: false, limit: 8, reached: false, truncated: false },
  frontier: { enabled: true, limit: 256, reached: true, truncated: true, trimCount: 3 },
  execution: { enabled: true, limit: 4096, reached: true, truncated: false },
} } };
const logged = createCollector();
collectBudgetHits(logged, 42, { policyDecision: { seatId: "p1", actionId: "scan:<a>" }, searches: [limitSearch] });
assert.deepEqual(logged.searches[0].diagnostics.budgetLimits, limitSearch.diagnostics.budgetLimits);
const limitHtml = renderSearchBudgetReport(logged.searches);
assert.match(limitHtml, /未启用/);
assert.match(limitHtml, /发生截断/);
assert.match(limitHtml, /触顶但未截断/);
assert.match(limitHtml, /scan:&lt;a&gt;/);
assert.match(renderSearchBudgetReport(c.searches), /2 次缺少触限字段/);
assert.match(renderSearchBudgetReport(null), /不能推断为零次/);

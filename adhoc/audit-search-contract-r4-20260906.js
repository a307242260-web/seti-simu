"use strict";
const fs = require("node:fs");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/search-contract-r4-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const sourcePath = "reports/iteration/probe-source-opening-20260906.json.gz";
  const bytes = fs.readFileSync(sourcePath);
  const source = JSON.parse(zlib.gunzipSync(bytes));
  const counts = {};
  for (const outcome of source.outcomes) {
    const key = `${outcome.status}/${outcome.confidence}/${outcome.code || "none"}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  const comparisons = source.comparison.map(({ action }) => {
    const context = { seatId: "player-white", observation: source.observation,
      actionOutcomes: source.outcomes };
    const original = evaluator.evaluateOutcome(context, action);
    const changed = evaluator.evaluateOutcome({ ...context,
      actionOutcomes: source.outcomes.map((outcome) => outcome.actionId === action.actionId
        ? { ...outcome, status: "incomplete" } : outcome) }, action);
    assert.equal(original.selectable, true);
    assert.equal(changed.selectable, false);
    return { actionId: action.actionId, summary: action.summary,
      original: { selectable: original.selectable, score: original.score },
      statusOnlyChange: { selectable: changed.selectable, reason: changed.reason } };
  });
  const report = { createdAt: new Date().toISOString(), sourcePath,
    sourceSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    scope: "只读既有outcomes并调用纯评估器；incomplete仅为接口反例，不是新生产状态或搜索实验。",
    outcomeCounts: counts, comparisons,
    diagnostics: { executedNodeCount: source.diagnostics.executedNodeCount,
      executionLimitReached: source.diagnostics.executionLimitReached,
      prunedNodeCount: source.diagnostics.prunedNodeCount,
      targetSchedulerPrunedCount: source.diagnostics.targetSchedulerPrunedCount },
    passed: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

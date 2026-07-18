"use strict";

const assert = require("node:assert/strict");
const { createAiTuningHistory } = require("./tuning-history");

const storage = new Map();
const state = { strategyTuningHistoryLoaded: false, strategyTuningHistory: [], nextStrategyTuningHistoryId: 1 };
let applied = null;
const normalize = (weights = {}) => ({ engine: 1, ...weights });
const runtime = createAiTuningHistory({
  aiAutoBattleState: state,
  windowRef: { localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } },
  AI_STRATEGY_TUNING_HISTORY_STORAGE_KEY: "test-history",
  normalizeAiStrategyWeights: normalize,
  getAiStrategyWeights: () => ({ engine: 1 }),
  aiNumber: (value) => Number(value) || 0,
  ai: { analytics: { summarizeStrategyTuningHistory: (history) => ({ weights: history.at(-1).appliedWeights }) } },
  applyAiStrategyTuning: (value) => { applied = value; return value.weights; },
});

const entry = runtime.recordAiStrategyTuningSummary({ gameCount: 2, strategyTuning: { weights: { scan: 1.2 } } }, { appliedWeights: { scan: 1.2 } });
assert.equal(entry.id, 1);
assert.equal(runtime.getAiStrategyTuningHistory().length, 1);
assert.equal(JSON.parse(storage.get("test-history")).length, 1);
assert.equal(runtime.applyAiStrategyTuningRecommendation().ok, true);
assert.ok(applied);
assert.deepEqual(runtime.clearAiStrategyTuningHistory(), { ok: true, history: [] });

console.log("app/ai/tuning-history.test.js ok");

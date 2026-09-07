"use strict";
const fs = require("node:fs"), zlib = require("node:zlib"), readline = require("node:readline"), assert = require("node:assert/strict");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/brown-ranking-comparison-20260907.json";
async function main() {
  if (fs.existsSync(output)) return console.log("已有对照，不重复分析");
  const summaries = [0, 1].map(i => JSON.parse(fs.readFileSync(`reports/iteration/brown-ranking-${i}-20260907.json`)));
  assert.deepEqual(summaries[0].evaluations.map(r => r.evaluation), summaries[1].evaluations.map(r => r.evaluation));
  assert.deepEqual(summaries[0].plan, summaries[1].plan);
  const rows = [];
  for (const index of [0, 1]) {
    let header, outcome, action; const candidates = [];
    for await (const line of readline.createInterface({ input: fs.createReadStream(`reports/iteration/brown-ranking-${index}-20260907.capture.jsonl.gz`).pipe(zlib.createGunzip()), crlfDelay: Infinity })) {
      const row = JSON.parse(line);
      if (row.type === "header") { header = row; action = header.legalActions.find(a => a.actionId === "quick_trade:5ad269c5"); }
      if (row.type === "outcome" && row.outcome.actionId === action.actionId) outcome = row.outcome;
      if (row.type !== "leaf" || row.actionId !== action.actionId) continue;
      const income = (row.leaf.planSteps || []).filter(s => s.action.target?.choiceId?.startsWith("income:")).map(s => s.action.target.cardInstanceId);
      const e = evaluator.evaluateAction({ seatId: "player-brown", legalActions: [action], observation: outcome.rootObservation,
        actionOutcomes: [{ ...outcome, leaves: [row.leaf] }] }, action);
      candidates.push({ leafId: row.leaf.leafId, income, score: e.score, value: e.value, actualScoreDelta: e.actualScoreDelta,
        quickTradeCount: e.quickTradeCount, secondaryAgentDepth: e.secondaryAgentDepth });
    }
    const selectedLeafId = summaries[index].evaluations.find(r => r.action.actionId === action.actionId).evaluation.selectedLeafId;
    rows.push({ index, selected: candidates.find(r => r.leafId === selectedLeafId), candidates });
  }
  const result = { scope: "同一当前代码两根单次搜索的离线评分对照；未复现历史5539次提交，不据此宣称历史候选一致",
    evaluationValuesEqual: true, plansEqual: true, rows };
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(rows.map(r => ({ index: r.index, selected: r.selected, top: r.candidates.sort((a,b) => b.score-a.score).slice(0,6) }))));
}
main().catch(error => { console.error(error); process.exitCode = 1; });

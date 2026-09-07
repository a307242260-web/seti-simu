"use strict";
const fs = require("node:fs"), zlib = require("node:zlib"), readline = require("node:readline"), assert = require("node:assert/strict");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const base = "reports/iteration/white-ranking-184-20260907";
async function main() {
  const output = `${base}.analysis.json`; if (fs.existsSync(output)) return console.log("已有分析证据");
  let header, outcome; const leaves = [];
  for await (const line of readline.createInterface({ input: fs.createReadStream(`${base}.capture.jsonl.gz`).pipe(zlib.createGunzip()), crlfDelay: Infinity })) {
    const row = JSON.parse(line);
    if (row.type === "header") header = row;
    if (row.type === "outcome" && row.outcome.actionId === "launch:c94cda79") outcome = row.outcome;
    if (row.type === "leaf" && row.actionId === "launch:c94cda79") leaves.push(row.leaf);
  }
  const action = header.legalActions.find(a => a.actionId === outcome.actionId);
  function evaluate(leaf) { return evaluator.evaluateAction({ seatId: "player-white", legalActions: [action],
    actionOutcomes: [{ ...outcome, leaves: [leaf] }], observation: outcome.rootObservation }, action); }
  const winner = leaves.find(l => l.leafId === "leaf:88570c3a"); assert.ok(winner);
  const ids = winner.planSteps.map(s => s.action.actionId);
  const alternative = [...ids.slice(0, 3), "choose_target:bbf8c218", "choose_target:7af26739", ...ids.slice(6)];
  const free = leaves.filter(l => l.planSteps[3]?.action.actionId === "choose_target:bbf8c218");
  const matches = free.map(leaf => {
    let prefix = 0; const actions = leaf.planSteps.map(s => s.action.actionId);
    while (prefix < Math.min(actions.length, alternative.length) && actions[prefix] === alternative[prefix]) prefix++;
    return { leafId: leaf.leafId, prefix, inputs: actions.length, terminalReason: leaf.terminalReason,
      score: evaluate(leaf).score, actions };
  });
  const exact = matches.filter(r => r.prefix === alternative.length && r.inputs === alternative.length);
  assert.equal(exact.length, 0);
  matches.sort((a, b) => b.prefix - a.prefix || b.score - a.score);
  const report = { scope: "只分析完整184既有候选，不运行搜索；完整优胜链40输入，actionChain省略自动输入不能代替planSteps",
    launchLeaves: leaves.length, freeFirstLeaves: free.length, winner: { leafId: winner.leafId,
      actions: ids, score: evaluate(winner).score }, alternative, exactMatches: exact.length,
    closest: matches.slice(0, 5), bestFree: [...matches].sort((a, b) => b.score - a.score).slice(0, 3),
    diagnostics: { nodes: header.diagnostics.executedNodeCount, executionLimitReached: header.diagnostics.executionLimitReached,
      frontier: header.diagnostics.frontierOriginCountByFamily }, passed: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, leaves: report.launchLeaves, free: report.freeFirstLeaves,
    winner: report.winner.score, bestFree: report.bestFree.map(r => r.score), closest: report.closest[0] }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });

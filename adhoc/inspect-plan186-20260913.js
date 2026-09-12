"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
let source = fs.readFileSync(`${__dirname}/inspect-income231-20260913.js`, "utf8");
source = source.replaceAll("income231", "plan186").replaceAll("231", "186").replaceAll("230", "185");
const marker = "  report.outcomeSummary =";
assert(source.includes(marker));
source = source.replace(marker, `
  const evaluator = req("../randomizer/game/ai/expected-score-evaluator");
  report.evaluations = (result.actionOutcomes || []).map(o => {
    const action = report.legal.find(a => a.actionId === o.actionId);
    const value = evaluator.evaluateOutcome({ seatId: report.legal[0].actorId,
      observation: o.rootObservation, actionOutcomes: result.actionOutcomes }, action, {});
    return { actionId: o.actionId, score: value.score, leafId: value.selectedLeafId, chain: value.actionChain };
  });
  console.log(JSON.stringify({ evaluations: report.evaluations, nodes: report.searches.map(s => ({kind:s.kind,nodes:s.diagnostics.executedNodeCount})) }));
` + marker);
// 复用已验收的正式重放与冷决策采集，仅移动到第一次计划差异的186步。
new Function("require", "console", "process", "__dirname", source)(require, console, process, __dirname);

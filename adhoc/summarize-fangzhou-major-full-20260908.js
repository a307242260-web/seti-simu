"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/expiry-summary.js");
req("../randomizer/game/initial-cards");
const scoring = req("../randomizer/game/end-game-scoring");
const cardEffects = req("../randomizer/game/cards/effects");
const quickMove = process.argv.includes("--quick-move");
const rulesBaseline = process.argv.includes("--rules-baseline");
assert.ok(!(quickMove && rulesBaseline), "一次只核对一个版本");
const output = rulesBaseline ? "reports/iteration/rules-baseline-full-review-20260908.json"
  : quickMove ? "reports/iteration/quick-move-full-review-20260908.json"
  : "reports/iteration/fangzhou-major-full-review-20260908.json";
if (fs.existsSync(output)) {
  console.log(`已有 checkpoint：${output}`);
  process.exit(0);
}
const baselineFile = rulesBaseline ? "reports/research/1969fccc.addcef7f.full.json"
  : quickMove ? "reports/research/b58e392b.4d3711c5.full.json"
  : "reports/research/cb456d23.04648dd1.full.json";
const files = fs.readdirSync("reports/research").filter(f => f.endsWith(rulesBaseline ? ".ee3ea52f.full.json" : quickMove ? ".c50e4f01.full.json" : ".4d3711c5.full.json"));
assert.equal(files.length, 1, "等待唯一完整局落盘，不重复运行 AI");
const candidateFile = `reports/research/${files[0]}`;
const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const baseline = read(baselineFile), candidate = read(candidateFile);
assert.equal(candidate.name, rulesBaseline ? "rules-baseline-20260908" : quickMove ? "quick-move-events-20260908" : "fangzhou-major-reward-20260908");
assert.equal(candidate.terminal, true);
const merge = (into, values) => {
  for (const [key, value] of Object.entries(values)) into[key] = (into[key] || 0) + value;
};
const distribution = () => ({ nodes: 0, inputs: 0, decisions: {}, actions: {}, targets: {}, targetDecisions: {} });
const add = (out, d) => {
  out.nodes += d.executedNodeCount;
  out.inputs += d.successfulInputSubmissionCount;
  merge(out.decisions, d.executedNodeCountByDecisionKind);
  merge(out.actions, d.executedNodeCountByActionSummary);
  merge(out.targets, d.executedOriginCountByTarget);
  merge(out.targetDecisions, d.executedOriginCountByTargetAndDecisionKind);
};
function summarize(record, file) {
  const save = read(record.savePath), state = JSON.parse(save.committedState);
  const before = JSON.stringify(state);
  for (const player of state.players.players) {
    const calculated = scoring.computePlayerFinalScore({ ...state, players: state.players.players,
      cardEffects, getCardTypeCode: card => cardEffects.getRuntimeCardTypeCode(card, cardEffects.getCardModel(card)?.cardType),
    }, player);
    assert.deepEqual(calculated, player.finalScoreBreakdown, "正式重算与逐席完整计分明细一致");
    assert.deepEqual(calculated, state.match.finalScores.find(s => s.playerId === player.id));
  }
  assert.equal(JSON.stringify(state), before, "重算不得修改存档");
  const scores = Object.fromEntries(state.match.finalScores.map(s => [s.playerId, s.totalScore]));
  assert.deepEqual(scores, record.summary.scores, "正式终局与记录逐席核对");
  const out = { file, commit: record.gitCommit, steps: record.steps, scores,
    average: Object.values(scores).reduce((a,b) => a+b, 0) / 4,
    finalDetails: state.match.finalScores, wallMs: record.wallMs,
    all: distribution(), capped: distribution(), failures: {}, truncations: [], cappedSearches: [],
    beamPrunedSearches: record.metrics.searches.every(s => Number.isFinite(s.diagnostics.beamPrunedOriginCount)) ? [] : null };
  for (const s of record.metrics.searches) {
    const d = s.diagnostics;
    add(out.all, d);
    merge(out.failures, d.failedNodeCountByCode);
    const step = save.replaySteps[s.step - 1];
    assert.ok(step, `缺少第${s.step}步存档`);
    const detail = { step: s.step, seat: s.seat, kind: s.kind, round: step.after.r,
      turn: step.after.t, action: s.action, nodes: d.executedNodeCount,
      inputs: d.successfulInputSubmissionCount, ms: d.totalMilliseconds,
      executionLimitReached: d.executionLimitReached,
      remainingFrontierNodeCount: d.remainingFrontierNodeCount,
      beamPrunedOriginCount: d.beamPrunedOriginCount,
      decisions: d.executedNodeCountByDecisionKind, actions: d.executedNodeCountByActionSummary,
      targets: d.executedOriginCountByTarget };
    if (d.executionLimitReached) out.truncations.push(detail);
    if (out.beamPrunedSearches && d.beamPrunedOriginCount > 0) out.beamPrunedSearches.push({ step: s.step, kind: s.kind,
      count: d.beamPrunedOriginCount, executionLimitReached: d.executionLimitReached });
    if (s.kind === "strategic" && d.executedNodeCount === d.maxExecutionNodes) {
      add(out.capped, d);
      out.cappedSearches.push(detail);
    }
  }
  assert.equal(Object.values(out.all.decisions).reduce((a,b) => a+b,0), out.all.nodes);
  assert.equal(Object.values(out.capped.decisions).reduce((a,b) => a+b,0), out.capped.nodes);
  return { summary: out, save };
}
const a = summarize(baseline, baselineFile), b = summarize(candidate, candidateFile);
const mismatches = [];
for (let i = 0; i < Math.max(a.save.replaySteps.length, b.save.replaySteps.length); i++) {
  const before = a.save.replaySteps[i], after = b.save.replaySteps[i];
  if (JSON.stringify(before?.action) !== JSON.stringify(after?.action)
      || JSON.stringify(before?.after) !== JSON.stringify(after?.after)) {
    if (mismatches.length < 5) mismatches.push({ step: i + 1, before, after });
  }
}
const report = { baseline: a.summary, candidate: b.summary, firstMismatches: mismatches,
  finalStateEqual: a.save.committedState === b.save.committedState,
  scope: "只读唯一固定全盘与正式存档；节点分类为物理节点，目标分类为来源执行，不能混作物理节点占比。满额与截断分别统计；分歧不是降分原因证明。" };
const firstDifference = mismatches[0]?.step ?? a.save.replaySteps.length + 1;
report.sameHistorySearchPairs = baseline.metrics.searches.filter(s => s.step <= firstDifference).map(old => {
  const next = candidate.metrics.searches.find(s => s.step === old.step && s.searchIndex === old.searchIndex && s.kind === old.kind);
  const facts = s => s ? { nodes:s.diagnostics.executedNodeCount,
    inputs:s.diagnostics.successfulInputSubmissionCount, ms:s.diagnostics.totalMilliseconds,
    action:s.action, decisions:s.diagnostics.executedNodeCountByDecisionKind } : null;
  return { step:old.step, kind:old.kind, before:facts(old), after:facts(next) };
});
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output, scores: b.summary.scores, average: b.summary.average,
  nodes: b.summary.all.nodes, inputs: b.summary.all.inputs, wallMs: b.summary.wallMs,
  failures: b.summary.failures, capped: b.summary.cappedSearches.length,
  truncations: b.summary.truncations.map(s => ({ step:s.step, kind:s.kind })),
  firstDifference: mismatches[0]?.step ?? null, finalStateEqual: report.finalStateEqual }, null, 2));

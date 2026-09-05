"use strict";
// 已有完整实验的离线差异 + 首个分歧盘面单次搜索；不重跑整局，不覆盖checkpoint。
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const outcome = require("../randomizer/game/ai/outcome-model");
const output = "reports/iteration/resource-r2-divergence-20260905.json";
if (fs.existsSync(output)) {
  console.log(`使用已有诊断：${output}`);
} else {
  const runs = ["16bce41e.d9283ce5.full.json", "241f6fc0.4f994f86.full.json"].map((file) => {
    const record = JSON.parse(fs.readFileSync(`reports/research/${file}`));
    const save = JSON.parse(fs.readFileSync(record.savePath));
    return { file, record, save, state: JSON.parse(save.committedState) };
  });
  const [baseline, candidate] = runs;
  const first = baseline.save.replaySteps.findIndex((step, index) => (
    step.action.actionId !== candidate.save.replaySteps[index]?.action.actionId
  ));
  assert.ok(first > 0);
  for (let index = 0; index < first; index += 1) {
    assert.deepEqual(baseline.save.replaySteps[index].after, candidate.save.replaySteps[index].after);
  }
  const deltas = candidate.state.players.players.map((player) => {
    const prior = baseline.state.players.players.find((p) => p.id === player.id);
    const keys = new Set([...Object.keys(prior.scoreSources), ...Object.keys(player.scoreSources)]);
    return { seatId: player.id, scoreSourceDeltas: Object.fromEntries([...keys].map((key) => [key,
      Number(player.scoreSources[key] || 0) - Number(prior.scoreSources[key] || 0)])),
    actions: runs.map((run) => run.record.metrics.famsBySeat[player.id]),
    tech: [prior.techState.ownedTiles, player.techState.ownedTiles] };
  });
  const env = createSimulationEnv();
  try {
    env.reset({ seed: candidate.save.seed, activePlayerCount: 4, aiDifficulty: "weak_start" });
    for (let index = 0; index < first; index += 1) {
      assert.equal(env.step(candidate.save.replaySteps[index].action).ok, true, `重放步骤${index + 1}`);
    }
    const legal = env.legalActions();
    const seatId = legal[0].actorId || legal[0].actorPlayerId;
    const started = Date.now();
    const result = env.runHeuristicPolicyDecision();
    const wallMs = Date.now() - started;
    assert.equal(result.ok, true);
    const context = { seatId, actionOutcomes: result.actionOutcomes };
    const evaluations = legal.map((action) => ({ action,
      evaluation: evaluator.evaluateOutcome(context, action),
    }));
    const compactOutcomes = result.actionOutcomes.map((item) => ({
      actionId: item.actionId, status: item.status, code: item.code,
      rootFacts: item.rootObservation ? outcome.createStrategicFacts(item.rootObservation, seatId) : null,
      leaves: (item.leaves || []).map((leaf) => ({
        leafId: leaf.leafId, actionChain: leaf.actionChain,
        facts: outcome.createStrategicFacts(leaf.observation, seatId),
        breakdown: evaluator.evaluateStrategicFactsBreakdown(
          outcome.createStrategicFacts(item.rootObservation, seatId),
          outcome.createStrategicFacts(leaf.observation, seatId)),
      })),
    }));
    const report = { createdAt: new Date().toISOString(), gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      scope: "完整实验离线对比与单次冷计划搜索；手工重放不恢复原协调器计划，不能假定与原决策来源相同",
      records: runs.map((run) => run.file), firstDifferentStep: first + 1,
      baselineAction: baseline.save.replaySteps[first].action,
      candidateAction: candidate.save.replaySteps[first].action,
      freshActionId: result.policyDecision.actionId, wallMs, deltas,
      revealEvents: runs.map((run) => run.record.metrics.revealEvents),
      evaluations, outcomes: compactOutcomes, diagnostics: env.getCounterfactualDiagnostics(),
    };
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ output, step: first + 1, chosen: report.freshActionId, wallMs,
      evaluations: evaluations.map((x) => ({ actionId: x.action.actionId, score: x.evaluation.score, reason: x.evaluation.reason })) }));
  } finally { env.dispose(); }
}

"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/r3-brown-route-selection-20260906.json";
const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重复分析：${output}`);
} else {
  const savePath = "seti-saves/seti-save-research-plan-steps-r3-20260906-d7a78140-full-v299.json";
  const raw = fs.readFileSync(savePath);
  const save = JSON.parse(raw);
  const source = JSON.parse(fs.readFileSync("reports/iteration/r3-actual-opening-plan-20260906.json"));
  const samples = [41, 171];
  const report = { createdAt: new Date().toISOString(), savePath, sourceSha256: hash(raw),
    scope: "复用实际第24步前checkpoint，正式重放到棕方R1/R2起手；各做一次冷计划生产决策，不跑全盘",
    replayVerifiedThrough: 22, samples: [] };
  const replayEnv = createSimulationEnv();
  try {
    replayEnv.loadCheckpoint(source.beforeRoot);
    for (let index = 23; index <= 171; index += 1) {
      if (samples.includes(index)) {
        const checkpointPath = `reports/iteration/r3-brown-before-${index}-20260906.json`;
        const checkpoint = JSON.stringify(replayEnv.createCheckpoint());
        fs.writeFileSync(checkpointPath, checkpoint);
        report.samples.push({ index, checkpointPath, checkpointSha256: hash(checkpoint),
          recordedAction: save.replaySteps[index].action });
      }
      if (index === 171) break;
      const expected = save.replaySteps[index];
      const action = replayEnv.legalActions().find((item) => item.actionId === expected.action.actionId);
      assert.ok(action, `第${index + 1}步缺合法动作`);
      assert.equal(JSON.stringify(action), JSON.stringify(expected.action));
      assert.equal(replayEnv.step(action).ok, true);
      assert.deepEqual(replayEnv.saveBrowserSave().replaySteps.at(-1).after, expected.after);
      report.replayVerifiedThrough = index;
    }
  } finally { replayEnv.dispose(); }
  try {
    for (const sample of report.samples) {
      const env = createSimulationEnv();
      try {
        env.loadCheckpoint(JSON.parse(fs.readFileSync(sample.checkpointPath)));
        const legalActions = env.legalActions();
        const observation = env.observe();
        const start = performance.now();
        const decision = env.runHeuristicPolicyDecision();
        sample.wallMs = performance.now() - start;
        assert.equal(decision.ok, true);
        sample.chosenAction = decision.policyDecision.actionId;
        sample.matchesRecorded = sample.chosenAction === sample.recordedAction.actionId;
        sample.plan = decision.plan;
        sample.diagnostics = env.getCounterfactualDiagnostics();
        const context = { seatId: sample.recordedAction.actorId, observation, actionOutcomes: decision.actionOutcomes };
        sample.outcomes = decision.actionOutcomes.map((outcome) => {
          const action = legalActions.find((candidate) => candidate.actionId === outcome.actionId);
          const value = evaluator.evaluateOutcome(context, action);
          const winner = outcome.leaves.find((leaf) => leaf.leafId === value.selectedLeafId);
          return { action, status: outcome.status, code: outcome.code, leafCount: outcome.leaves.length,
            evaluation: value, selectedLeaf: winner || null };
        });
        assert.ok(sample.wallMs <= 10000, "单决策超过10秒，停止后续批量分析");
      } finally { env.dispose(); }
    }
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report));
    console.log(JSON.stringify({ output, passed: report.passed, samples: report.samples.map((sample) => ({
      index: sample.index, chosen: sample.chosenAction, matches: sample.matchesRecorded, ms: sample.wallMs,
      nodes: sample.diagnostics?.executedNodeCount,
      outcomes: sample.outcomes?.map((outcome) => ({ family: outcome.action?.family,
        summary: outcome.action?.summary, leaves: outcome.leafCount, score: outcome.evaluation?.score,
        code: outcome.code })),
    })), error: report.error }, null, 2));
  }
}

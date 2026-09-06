"use strict";
const fs = require("node:fs"), v8 = require("node:v8"), zlib = require("node:zlib");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const output = "reports/iteration/policy-input-42-20260906.v8.gz";
if (fs.existsSync(output)) console.log(`已有输入图，跳过：${output}`);
else {
  const env = createSimulationEnv();
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const fork = env.createCounterfactualFork().composition;
    let observation;
    try { observation = outcomeModel.createDecisionObservation(fork.projection({ playerId: "player-green", role: "player" }).state); }
    finally { fork.dispose(); }
    const legalActions = env.legalActions(), first = legalActions[0];
    const started = performance.now(), result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now() - started;
    assert.equal(result.ok, true);
    const input = { requestId: `heuristic-decision:player-green:${first.stateVersion}:${first.decisionVersion}`,
      seatId: "player-green", stateVersion: first.stateVersion, decisionVersion: first.decisionVersion,
      observation, legalActions, actionOutcomes: result.actionOutcomes,
      deterministicContext: { heuristicDecisionFunctionSchemaVersion: "seti-heuristic-decision-function-v1" } };
    const bytes = v8.serialize(input);
    fs.writeFileSync(output, zlib.gzipSync(bytes));
    const report = { scope: "保存真实42 Policy输入独立图，V8序列化保留共享引用；一次专门输入采集，不作为性能比较", output,
      wallMs, graphBytes: bytes.length, actionId: result.policyDecision.actionId,
      nodes: env.getCounterfactualDiagnostics().executedNodeCount,
      submissions: env.getCounterfactualDiagnostics().successfulInputSubmissionCount };
    fs.writeFileSync("reports/iteration/policy-input-capture-42-20260906.json", JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally { env.dispose(); }
}

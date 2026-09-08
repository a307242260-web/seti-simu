"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/hidden-payment-score-replay-20260907.json";
if (fs.existsSync(output)) console.log("已有逐输入重放证据，不重复执行");
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/alien-trace-318-2072dc67-20260907.json"));
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/alien-trace-root-318-20260907.json")).checkpoint;
  const env = createSimulationEnv(); let fork;
  try {
    env.loadCheckpoint(checkpoint); fork = env.createCounterfactualFork().composition;
    const rows = []; let pending = false;
    for (const [index, step] of source.leaf.planSteps.entries()) {
      const state = fork.inspect(), d = state.session?.decision;
      const legal = state.phase === "awaiting_input" ? d.choices : fork.inputPort.enumerateActions();
      const action = legal.find(a => a.actionId === step.action.actionId);
      assert.ok(action, `正式输入${index + 1}合法`);
      const result = action.phase === "conditional"
        ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action })
        : fork.inputPort.submitAction(action);
      assert.equal(result.ok, true);
      if (action.family === "end_turn") pending = true;
      if (pending) {
        const advance = fork.counterfactualPort.advanceFocalPlanningTurn("player-blue");
        if (advance.ok) pending = false;
        else assert.equal(advance.code, "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");
      }
      const envelope = fork.lifecycle.save().envelope;
      const player = JSON.parse(envelope.committedState).players.players.find(p => p.id === "player-blue");
      const inspection = fork.inspect();
      rows.push({ step: index + 1, action: action.summary, committedScore: player.resources.score,
        phase: inspection.phase, effect: inspection.session?.currentEffect, decision: inspection.session?.decision,
        projection: fork.projection({ playerId: "player-blue", role: "player" }).state });
    }
    fs.writeFileSync(output, JSON.stringify({ source: "alien-trace-318-2072dc67-20260907.json",
      scope: "仅重放已录制计划，无AI", expectedScoring: source.leaf.observation.outcomeProjection.scoring,
      rows }, null, 2) + "\n");
    console.log(JSON.stringify(rows.map(r => ({ step: r.step, action: r.action, score: r.committedScore,
      phase: r.phase, effect: r.effect?.type, projectedScore: r.projection.outcomeProjection?.scoring }))));
  } finally { fork?.dispose(); env.dispose(); }
}

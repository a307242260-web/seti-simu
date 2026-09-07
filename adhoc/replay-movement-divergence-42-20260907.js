"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/movement-divergence-42-formal-20260907.json";
if (fs.existsSync(output)) console.log(`已有证据：${output}`);
else {
  const report = { scope: "同一真实42前态，重放三个既有优胜计划；仅证明正式可执行性，不证明当前搜索保留或评分优劣", rows: [], passed: false };
  try {
    for (const version of ["asteroid-modifier", "main-goal-movement-final", "ordinary-movement-demand"]) {
      const source = `reports/iteration/${version}-decision-42-20260907.json`;
      const evidence = JSON.parse(fs.readFileSync(source));
      const env = createSimulationEnv(); let fork;
      const row = { source, inputs: [], expectedInputs: evidence.steps.length };
      report.rows.push(row);
      try {
        const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
        delete cp.replaySteps; env.loadCheckpoint(cp);
        fork = env.createCounterfactualFork().composition;
        const seat = JSON.parse(cp.coreState.committedState).turn.currentPlayerId;
        let pending = false;
        for (const step of evidence.steps) {
          const state = fork.inspect();
          const legal = state.phase === "awaiting_input" ? state.session.decision.choices : fork.inputPort.enumerateActions();
          const action = legal.find(a => a.actionId === step.action.actionId);
          assert.ok(action, `旧计划正式输入缺失:${version}:${row.inputs.length + 1}:${step.action.actionId}`);
          const d = state.session?.decision;
          const result = action.phase === "conditional"
            ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
              ownerId: d.ownerId, choice: action }, { skipProjection: true })
            : fork.inputPort.submitAction(action, { skipProjection: true });
          assert.equal(result.ok, true, JSON.stringify(result.failure));
          row.inputs.push({ actionId: action.actionId, family: action.family, summary: action.summary });
          if (action.family === "end_turn") pending = true;
          if (pending) {
            const advance = fork.counterfactualPort.advanceFocalPlanningTurn(seat);
            if (advance.ok) pending = false;
            else assert.equal(advance.code, "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");
          }
        }
        row.finalEnvelope = fork.lifecycle.save().envelope;
        row.passed = true;
      } finally { fork?.dispose(); env.dispose(); }
    }
    report.passed = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed,
    rows: report.rows.map(r => ({ source: r.source, inputs: r.inputs.length, passed: r.passed })), error: report.error }, null, 2));
}

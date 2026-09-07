"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/reorganization-decision-285-20260907.json";
if (fs.existsSync(output)) console.log("已有重组285单决策，不重跑");
else {
  const checkpoint = JSON.parse(fs.readFileSync("reports/iteration/reorganization-fixed-real-20260907.json")).beforeCheckpoint;
  const env = createSimulationEnv();
  let fork;
  try {
    env.loadCheckpoint(checkpoint);
    const legalActions = env.legalActions();
    const start = performance.now();
    const result = env.runHeuristicPolicyDecision();
    const wallMs = performance.now() - start;
    const diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(result.ok, true);
    const context = { seatId: "player-white", legalActions,
      observation: result.actionOutcomes.find(o => o.rootObservation).rootObservation,
      actionOutcomes: result.actionOutcomes };
    const action = legalActions.find(a => a.actionId === result.policyDecision.actionId);
    const evaluation = evaluator.evaluateAction(context, action);
    const outcome = result.actionOutcomes.find(o => o.actionId === action.actionId);
    const leaf = outcome.leaves.find(l => l.leafId === evaluation.selectedLeafId);
    assert.ok(leaf);
    const evidence = { scope: "重组修复后真实285冷搜索；不宣称复现历史搜索缓存上下文", wallMs,
      diagnostics, action, evaluation, leaf, plan: result.plan, passed: false };
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
    assert.deepEqual(diagnostics.failedNodeCountByCode, {});
    assert.ok(wallMs < 30000, "单决策须低于既有30秒门槛");
    env.loadCheckpoint(checkpoint);
    fork = env.createCounterfactualFork().composition;
    let pending = false;
    const actions = leaf.planSteps ? leaf.planSteps.map(s => s.action) : leaf.actionChain;
    assert.ok(Array.isArray(actions));
    for (const expected of actions) {
      const state = fork.inspect();
      const legal = state.phase === "awaiting_input" ? state.session.decision.choices : fork.inputPort.enumerateActions();
      const actual = legal.find(a => a.actionId === expected.actionId);
      assert.ok(actual, `优胜计划正式动作缺失:${expected.actionId}`);
      const d = state.session?.decision;
      const submitted = actual.phase === "conditional"
        ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: actual })
        : fork.inputPort.submitAction(actual);
      assert.equal(submitted.ok, true);
      if (actual.family === "end_turn") pending = true;
      if (pending) {
        const advanced = fork.counterfactualPort.advanceFocalPlanningTurn("player-white");
        if (advanced.ok) pending = false;
        else assert.equal(advanced.code, "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");
      }
    }
    const envelope = fork.lifecycle.save().envelope;
    const player = JSON.parse(envelope.committedState).players.players.find(p => p.id === "player-white");
    assert.deepEqual(player.income, evaluation.leafValue.infrastructure.income);
    assert.equal(player.resources.score, evaluation.leafValue.realizedScore);
    Object.assign(evidence, { passed: true, verifiedPlanInputs: actions.length, envelope });
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
    console.log(JSON.stringify({ passed: true, wallMs, nodes: diagnostics.executedNodeCount,
      inputs: diagnostics.successfulInputSubmissionCount, verifiedPlanInputs: actions.length, action: action.summary }));
  } finally { fork?.dispose(); env.dispose(); }
}

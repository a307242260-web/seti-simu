"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const tree = path.resolve(process.argv[2] || ".");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tree, encoding: "utf8" }).trim();
const { createSimulationEnv } = require(path.join(tree, "randomizer/app/simulation-env"));
const evaluator = require(path.join(tree, "randomizer/game/ai/expected-score-evaluator"));
const checkpointFile = "reports/iteration/alien-trace-root-318-20260907.json";
const output = `reports/iteration/alien-trace-318-${commit.slice(0, 8)}-20260907.json`;
if (fs.existsSync(output)) { console.log(`已有记录，不重跑：${output}`); }
else {
  const env = createSimulationEnv();
  let fork;
  try {
    if (!fs.existsSync(checkpointFile)) {
      const record = JSON.parse(fs.readFileSync("reports/research/13a491f3.e6923ed1.full.json"));
      const save = JSON.parse(fs.readFileSync(record.savePath));
      const config = JSON.parse(fs.readFileSync("reports/iteration/reorganization-fixed-real-20260907.json")).beforeCheckpoint.config;
      env.reset(config);
      for (let i = 0; i < 317; i++) {
        const expected = save.replaySteps[i];
        const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
        assert.deepEqual(action, expected.action, `第${i + 1}步正式动作一致`);
        assert.equal(env.step(action).ok, true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
      }
      fs.writeFileSync(checkpointFile, JSON.stringify({ source: record.gitCommit, step: 318, checkpoint: env.createCheckpoint() }) + "\n");
    }
    const { checkpoint } = JSON.parse(fs.readFileSync(checkpointFile));
    env.loadCheckpoint(checkpoint);
    const legalActions = env.legalActions(), before = env.createCheckpoint().coreState;
    const start = performance.now(), result = env.runHeuristicPolicyDecision(), wallMs = performance.now() - start;
    const diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(result.ok, true);
    const action = legalActions.find(a => a.actionId === result.policyDecision.actionId);
    const context = { seatId: "player-blue", legalActions, actionOutcomes: result.actionOutcomes,
      observation: result.actionOutcomes.find(o => o.rootObservation).rootObservation };
    const evaluation = evaluator.evaluateAction(context, action);
    const leaf = result.actionOutcomes.find(o => o.actionId === action.actionId).leaves.find(l => l.leafId === evaluation.selectedLeafId);
    const evidence = { commit, step: 318, scope: "同一真实根冷搜索，不是完整局缓存复现", wallMs, diagnostics, action, evaluation, leaf, passed: false };
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
    assert.deepEqual(diagnostics.failedNodeCountByCode, {});
    assert.ok(wallMs < 30000);
    env.loadCheckpoint(checkpoint);
    assert.deepEqual(env.createCheckpoint().coreState, before);
    fork = env.createCounterfactualFork().composition;
    let pending = false;
    const actions = leaf.planSteps ? leaf.planSteps.map(s => s.action) : leaf.actionChain;
    for (const expected of actions) {
      const state = fork.inspect(), d = state.session?.decision;
      const legal = state.phase === "awaiting_input" ? d.choices : fork.inputPort.enumerateActions();
      const actual = legal.find(a => a.actionId === expected.actionId);
      assert.ok(actual, `计划动作缺失：${expected.actionId}`);
      const submitted = actual.phase === "conditional"
        ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: actual })
        : fork.inputPort.submitAction(actual);
      assert.equal(submitted.ok, true);
      if (actual.family === "end_turn") pending = true;
      if (pending) {
        const advanced = fork.counterfactualPort.advanceFocalPlanningTurn("player-blue");
        if (advanced.ok) pending = false;
        else assert.equal(advanced.code, "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");
      }
    }
    const player = JSON.parse(fork.lifecycle.save().envelope.committedState).players.players.find(p => p.id === "player-blue");
    assert.ok(["idle", "completed"].includes(fork.inspect().phase), "318主行动优胜计划必须完成正式条件链");
    assert.equal(player.resources.score, evaluation.leafValue.realizedScore);
    assert.deepEqual(player.income, evaluation.leafValue.infrastructure.income);
    evidence.passed = true;
    evidence.verifiedPlanInputs = actions.length;
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
    console.log(JSON.stringify({ commit, wallMs, nodes: diagnostics.executedNodeCount, inputs: diagnostics.successfulInputSubmissionCount,
      trace: Object.entries(diagnostics.executedNodeCountByDecisionKind).filter(([k]) => k.includes("science_domain_alien_trace")), verifiedPlanInputs: actions.length }));
  } finally { fork?.dispose(); env.dispose(); }
}

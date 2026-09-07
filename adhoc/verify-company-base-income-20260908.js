"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const scoring = require("../randomizer/game/end-game-scoring");
const cardEffects = require("../randomizer/game/cards/effects");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const mode = process.argv[2];
assert.ok(["finals", "root193"].includes(mode));
const output = `reports/iteration/company-base-income-${mode}-20260908.json`;
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { mode, passed: false };
let env, fork;
try {
  if (mode === "finals") {
    const proof = JSON.parse(fs.readFileSync("/Users/bilibili/code/seti-simu/reports/iteration/green-income-company-base-proof-20260908.json"));
    assert.equal(proof.passed, true);
    report.records = [];
    for (const expected of proof.records) {
      const record = JSON.parse(fs.readFileSync(expected.file));
      const save = JSON.parse(fs.readFileSync(record.savePath));
      const state = JSON.parse(save.committedState);
      const snapshot = JSON.stringify(state.players.players);
      const scores = state.players.players.map(player => {
        const actual = scoring.computePlayerFinalScore({
          ...state, players: state.players.players, cardEffects,
          getCardTypeCode: card => cardEffects.getRuntimeCardTypeCode(card, cardEffects.getCardModel(card)?.cardType),
        }, player);
        assert.deepEqual(actual, expected.final.find(p => p.playerId === player.id).corrected);
        return actual;
      });
      assert.equal(JSON.stringify(state.players.players), snapshot);
      report.records.push({ file: expected.file, scores });
    }
  } else {
    const record = JSON.parse(fs.readFileSync("reports/research/d5ef5962.2b44f883.full.json"));
    const save = JSON.parse(fs.readFileSync(record.savePath));
    const config = JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
    const seatId = "player-blue";
    env = createSimulationEnv();
    env.reset(config);
    for (const expected of save.replaySteps.slice(0,192)) {
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.deepEqual(action, expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    console.log("[单点验证] 已恢复第193步；开始4096节点上限冷搜索");
    report.observation = env.observe(seatId);
    report.legal = env.legalActions();
    fork = env.createCounterfactualFork().composition;
    const started = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    report.diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(result.ok, true);
    assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
    assert.ok(report.wallMs < 30000, "单根30秒门禁");
    report.decision = result.policyDecision;
    report.plan = result.plan;
    const outcome = result.actionOutcomes.find(o => o.actionId === result.policyDecision.actionId);
    assert.ok(outcome);
    const action = report.legal.find(a => a.actionId === outcome.actionId);
    report.evaluation = evaluator.evaluateOutcome({ seatId, observation:outcome.rootObservation, actionOutcomes:[outcome] }, action, {});
    report.leaf = outcome.leaves.find(l => l.leafId === report.evaluation.selectedLeafId);
    assert.ok(report.leaf);
    let pendingAdvance = false;
    for (const expected of report.leaf.planSteps.map(s => s.action)) {
      const inspected = fork.inspect(), decision = inspected.session?.decision;
      const available = inspected.phase === "awaiting_input" ? decision.choices : fork.inputPort.enumerateActions();
      const action = available.find(a => a.actionId === expected.actionId);
      assert.ok(action, `优胜链缺正式输入${expected.actionId}`);
      const submitted = action.phase === "conditional"
        ? fork.inputPort.submitDecision({ decisionId:decision.decisionId, decisionVersion:decision.decisionVersion, ownerId:decision.ownerId, choice:action })
        : fork.inputPort.submitAction(action);
      assert.equal(submitted.ok,true);
      if (action.family === "end_turn") pendingAdvance = true;
      if (pendingAdvance) {
        const advanced = fork.counterfactualPort.advanceFocalPlanningTurn(seatId);
        if (advanced.ok) pendingAdvance = false;
        else assert.equal(advanced.code, "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");
      }
    }
    report.verifiedEnvelope = fork.lifecycle.save().envelope;
    const player = JSON.parse(report.verifiedEnvelope.committedState).players.players.find(p => p.id === seatId);
    assert.equal(player.resources.score, report.evaluation.leafValue.realizedScore);
    assert.deepEqual(player.income, report.evaluation.leafValue.infrastructure.income);
    report.verifiedPlanInputs = report.leaf.planSteps.length;
  }
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fork?.dispose(); env?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed:report.passed, error:report.error, wallMs:report.wallMs,
    nodes:report.diagnostics?.executedNodeCount, inputs:report.diagnostics?.successfulInputSubmissionCount,
    action:report.decision?.actionId, verifiedPlanInputs:report.verifiedPlanInputs }));
}

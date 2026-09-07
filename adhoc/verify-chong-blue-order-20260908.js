"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const chong = require("../randomizer/game/aliens/chong");
const mode = process.argv[2];
assert.ok(["choices", "choices-after", "baseline", "candidate"].includes(mode));
const output = `reports/iteration/chong-blue-order-${mode}-20260908.json`;
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const record = JSON.parse(fs.readFileSync("reports/research/d5ef5962.2b44f883.full.json"));
const save = JSON.parse(fs.readFileSync(record.savePath));
const config = JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
const env = createSimulationEnv();
const report = { mode, source:record.savePath, rootStep:mode.startsWith("choices") ? 274 : 193, passed:false };
let fork;
try {
  env.reset(config);
  for (const expected of save.replaySteps.slice(0, report.rootStep - 1)) {
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert.deepEqual(action, expected.action);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
  }
  const seatId = mode.startsWith("choices") ? "player-brown" : "player-blue";
  const observation = env.observe(seatId), legal = env.legalActions();
  report.observation = observation;
  report.legal = legal;
  if (mode.startsWith("choices")) {
    const blue = legal.filter(a => a.target?.speciesId === "chong" && a.target?.traceType === "blue");
    assert.ok([8,9].every(p => blue.some(a => a.target.position === p)));
    report.selected = evaluator.selectSecondaryAgentRootActions({ focalSeatId:seatId, rootObservation:observation, legalActions:legal });
    const selectedBlue = report.selected.filter(a => a.target.speciesId === "chong" && a.target.traceType === "blue").map(a=>a.target.position);
    assert.deepEqual(selectedBlue.sort((a,b)=>a-b),mode === "choices" ? [7,8,9] : [7,9]);
    report.rewards = [8,9].map(p => ({ position:p, reward:chong.getTraceReward({}, "blue", p) }));
    assert.equal(report.rewards[0].reward.gain.score,3);
    assert.equal(report.rewards[1].reward.gain.score,5);
    const normalized = report.rewards.map(({reward}) => ({ ...reward, gain:{} }));
    assert.deepEqual(normalized[0],normalized[1]);
    report.results = [];
    for (const position of [8,9]) {
      fork = env.createCounterfactualFork().composition;
      const decision = fork.inspect().session.decision;
      const choice = decision.choices.find(a => a.target.speciesId === "chong" && a.target.traceType === "blue" && a.target.position === position);
      assert.ok(choice);
      const result = fork.inputPort.submitDecision({ decisionId:decision.decisionId, decisionVersion:decision.decisionVersion, ownerId:decision.ownerId, choice });
      assert.equal(result.ok,true);
      report.results.push({position, envelope:fork.lifecycle.save().envelope, decision:fork.inspect().session.decision});
      fork.dispose(); fork = null;
    }
    assert.deepEqual(report.results[0].decision.choices.map(a => a.target.source).sort(),report.results[1].decision.choices.map(a => a.target.source).sort());
  } else {
    const started = performance.now(), result = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    report.decision = result.policyDecision;
    report.plan = result.plan;
    report.diagnostics = env.getCounterfactualDiagnostics();
    assert.equal(result.ok,true);
    assert.deepEqual(report.diagnostics.failedNodeCountByCode,{});
    assert.ok(report.wallMs < 30000, "单根30秒门禁");
    const outcome = result.actionOutcomes.find(o => o.actionId === result.policyDecision.actionId);
    const action = legal.find(a => a.actionId === outcome.actionId);
    const evaluation = evaluator.evaluateOutcome({seatId, observation:outcome.rootObservation, actionOutcomes:[outcome]},action,{});
    const leaf = outcome.leaves.find(l => l.leafId === evaluation.selectedLeafId);
    assert.ok(leaf);
    report.evaluation = evaluation;
    report.leaf = leaf;
    // 使用同根的正式fork重放优胜链；单席位未来时钟沿共享counterfactual端口推进。
    env.reset(config);
    for (const expected of save.replaySteps.slice(0,report.rootStep - 1)) {
      const action = env.legalActions().find(a=>a.actionId===expected.action.actionId);
      assert.ok(action); assert.equal(env.step(action).ok,true);
    }
    fork = env.createCounterfactualFork().composition;
    let pendingAdvance = false;
    const actions = leaf.planSteps.map(s=>s.action);
    for (const expected of actions) {
      const inspected = fork.inspect(), decision = inspected.session?.decision;
      const available = inspected.phase === "awaiting_input" ? decision.choices : fork.inputPort.enumerateActions();
      const action = available.find(a=>a.actionId===expected.actionId);
      assert.ok(action,`优胜链缺正式输入${expected.actionId}`);
      const submitted = action.phase === "conditional"
        ? fork.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:action})
        : fork.inputPort.submitAction(action);
      assert.equal(submitted.ok,true);
      if (action.family === "end_turn") pendingAdvance = true;
      if (pendingAdvance) {
        const advanced = fork.counterfactualPort.advanceFocalPlanningTurn(seatId);
        if (advanced.ok) pendingAdvance = false;
        else assert.equal(advanced.code,"COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");
      }
    }
    const envelope = fork.lifecycle.save().envelope;
    const player = JSON.parse(envelope.committedState).players.players.find(p=>p.id===seatId);
    assert.equal(player.resources.score,evaluation.leafValue.realizedScore);
    assert.deepEqual(player.income,evaluation.leafValue.infrastructure.income);
    report.verifiedPlanInputs = actions.length;
    report.verifiedEnvelope = envelope;
  }
  report.passed = true;
} catch(error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fork?.dispose(); env.dispose();
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,passed:report.passed,error:report.error,wallMs:report.wallMs,
    action:report.decision?.actionId,nodes:report.diagnostics?.executedNodeCount,inputs:report.diagnostics?.successfulInputSubmissionCount}));
}

"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/trade-confirm-516-verification-20260907.json";
const read = path => JSON.parse(fs.readFileSync(path));
if (fs.existsSync(output)) console.log(`已有验证：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "重放实际42至516，在新内核重新生成交易Decision；四个首选/取消/恢复/单次AI及计划重放", cases: [] };
  let fork;
  try {
    const save = read(read("reports/research/64334dc7.7613a096.full.json").savePath);
    const cp = read("reports/iteration/company-movement-input-42-20260906.json").checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    for (let index = 41; index < 515; index++) {
      const expected = save.replaySteps[index];
      const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
      assert.ok(action, `第${index + 1}步动作必须存在`);
      assert.deepEqual(JSON.parse(JSON.stringify(action)), expected.action);
      assert.equal(env.step(action).ok, true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
    }
    fork = env.createCounterfactualFork().composition;
    const initial = fork.lifecycle.save().envelope;
    const inspect = () => fork.inspect().session;
    const submit = choice => {
      const d = inspect().decision;
      const result = fork.inputPort.submitDecision({ decisionId: d.decisionId,
        decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice }, { skipProjection: true });
      assert.equal(result.ok, true, JSON.stringify(result.failure));
      return result;
    };
    const firstChoices = inspect().decision.choices;
    assert.equal(firstChoices.length, 4);
    assert.ok(firstChoices.every(c => c.target.kind === "discard-hand-card"));
    const owner = inspect().decision.ownerId;
    const player = () => fork.projection({ role: "simulation" }).state.players.players.find(p => p.id === owner);
    const before = { energy: player().resources.energy, hand: player().hand.length };
    for (const first of firstChoices) {
      assert.equal(fork.lifecycle.restore(initial).ok, true);
      submit(first);
      assert.ok(inspect().decision.choices.every(c => c.target.kind !== "confirm"));
      const partial = fork.lifecycle.save().envelope;
      submit(inspect().decision.choices.find(c => c.actionId === first.actionId));
      assert.deepEqual(inspect().currentEffect.payload.decisionContext.selected, [], "可取消已选牌");
      assert.equal(fork.lifecycle.restore(partial).ok, true);
      submit(inspect().decision.choices.find(c => c.target.cardInstanceId !== first.target.cardInstanceId));
      const confirm = inspect().decision.choices.find(c => c.target.kind === "confirm");
      assert.ok(confirm && !confirm.disabledReason);
      const full = fork.lifecycle.save().envelope;
      const settled = submit(confirm), after = fork.lifecycle.save().envelope;
      assert.equal(player().resources.energy, before.energy + 1);
      assert.equal(player().hand.length, before.hand - 2);
      assert.equal(settled.journal.events.filter(e => e.type === "quick_trade_payment").length, 1);
      assert.equal(fork.lifecycle.restore(full).ok, true);
      submit(inspect().decision.choices.find(c => c.target.kind === "confirm"));
      assert.deepEqual(fork.lifecycle.save().envelope, after, "确认前恢复不重复发奖且完整状态一致");
      report.cases.push({ first: first.actionId, cancelled: true, recovered: true, handCost: 2, energyGain: 1 });
    }
    assert.equal(fork.lifecycle.restore(initial).ok, true);
    const started = performance.now(), decision = env.runHeuristicPolicyDecision();
    report.wallMs = performance.now() - started;
    assert.equal(decision.ok, true, JSON.stringify(decision.error));
    report.searches = decision.searches;
    report.diagnostics = env.getCounterfactualDiagnostics();
    assert.deepEqual(report.diagnostics.failedNodeCountByCode, {});
    assert.equal(report.diagnostics.maxExecutionNodes, 4096);
    assert.equal(report.diagnostics.executionLimitReached, false);
    assert.ok(report.wallMs < 30000);
    report.plan = decision.plan;
    assert.ok(report.plan && Array.isArray(report.plan.steps));
    report.actionId = decision.policyDecision.actionId;
    report.replayed = [];
    for (const id of [report.actionId, ...report.plan.steps.map(s => s.actionId)]) {
      const action = inspect().decision.choices.find(c => c.actionId === id);
      assert.ok(action, id); submit(action); report.replayed.push(id);
    }
    assert.equal(report.replayed.length, 3, "两次选牌与一次确认均正式重放");
    assert.equal(player().resources.energy, before.energy + 1);
    assert.equal(player().hand.length, before.hand - 2);
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, wallMs: report.wallMs,
      nodes: report.diagnostics?.executedNodeCount, submissions: report.diagnostics?.successfulInputSubmissionCount,
      cases: report.cases, replayed: report.replayed, error: report.error }, null, 2));
  }
}

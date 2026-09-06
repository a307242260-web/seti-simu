"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/company-move-orders-42-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42根状态正式执行公司两艘不同探测器移动的正反顺序；非整棵搜索状态等价证明", pairs: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp);
    fork = env.createCounterfactualFork().composition;
    const legal = () => { const inspection = fork.inspect(); return inspection.phase === "awaiting_input"
      ? inspection.session.decision.choices : fork.inputPort.enumerateActions(); };
    function submit(action) {
      assert.ok(action);
      const i = fork.inspect(), d = i.session?.decision;
      const result = i.phase === "awaiting_input" ? fork.inputPort.submitDecision({
        decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action,
      }, { skipProjection: true }) : fork.inputPort.submitAction(action, { skipProjection: true });
      assert.equal(result.ok, true);
    }
    submit(legal().find(a => a.family === "industry"));
    const initial = fork.lifecycle.save().envelope;
    const choices = legal().filter(a => a.target?.rocketId);
    const byRocket = new Map();
    for (const a of choices) {
      if (!byRocket.has(a.target.rocketId)) byRocket.set(a.target.rocketId, []);
      byRocket.get(a.target.rocketId).push(a);
    }
    assert.equal(byRocket.size, 2);
    const [left, right] = [...byRocket.values()];
    for (const a of left) for (const b of right) {
      const results = [];
      for (const order of [[a, b], [b, a]]) {
        assert.equal(fork.lifecycle.restore(initial).ok, true);
        for (const wanted of order) submit(legal().find(c => c.target.choiceId === wanted.target.choiceId));
        assert.notEqual(fork.inspect().phase, "awaiting_input");
        results.push({ state: JSON.parse(fork.lifecycle.save().envelope.committedState),
          legal: legal().map(c => ({ actionId: c.actionId, family: c.family, target: c.target })) });
      }
      const differences = [];
      function diff(a, b, path) {
        if (JSON.stringify(a) === JSON.stringify(b)) return;
        if (a && b && typeof a === "object" && typeof b === "object") {
          for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key], b[key], `${path}.${key}`);
        } else differences.push({ path, first: a, second: b });
      }
      diff(results[0].state, results[1].state, "state");
      report.pairs.push({ moves: [a.target, b.target], differences,
        sameLegalActions: JSON.stringify(results[0].legal) === JSON.stringify(results[1].legal) });
    }
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, pairs: report.pairs.length,
      differencePaths: [...new Set(report.pairs.flatMap(p => p.differences.map(d => d.path)))],
      sameLegal: report.pairs.every(p => p.sameLegalActions), error: report.error }));
  }
}

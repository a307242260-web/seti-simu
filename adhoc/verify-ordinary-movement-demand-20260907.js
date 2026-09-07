"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = process.argv[2], mode = process.argv[3];
assert.ok(output && ["before", "fixed"].includes(mode), "指定输出及before/fixed");
if (fs.existsSync(output)) console.log(`已有记录：${output}`);
else {
  const report = { scope: "真实42/148/497当前合法集与目标入口只读核验，不运行AI", mode, rows: [], passed: false };
  const source42 = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json"));
  const other = JSON.parse(fs.readFileSync("reports/iteration/current-movement-hotspots-20260907.json"));
  try {
    for (const [step, checkpoint] of [[42, source42.checkpoint],
      ...[148, 497].map(step => [step, other.entries.find(e => e.step === step).checkpoint])]) {
      const env = createSimulationEnv(); let fork;
      try {
        const cp = structuredClone(checkpoint); delete cp.replaySteps;
        env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
        const seatId = JSON.parse(cp.coreState.committedState).turn.currentPlayerId;
        const observation = fork.projection({ playerId: seatId, role: "player" }).state;
        const legal = fork.inputPort.enumerateActions();
        const before = JSON.stringify(fork.inspect());
        const catalog = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: seatId,
          rootObservation: observation, legalActions: legal });
        const selected = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: seatId,
          branchObservation: observation, legalSuccessors: legal, routeTargetId: null });
        const roots = evaluator.selectSecondaryAgentRootActions({ focalSeatId: seatId,
          rootObservation: observation, legalActions: legal });
        const leaks = selected.filter(a => a.family === "move" && !a.routeTargetId);
        for (const a of selected.filter(a => a.family === "move" && a.routeTargetId)) {
          assert.ok(a.routePlanId);
          assert.ok(catalog.some(t => t.targetId === a.routeTargetId && t.planId === a.routePlanId
            && t.compatibleActionIds.includes(a.actionId)), "每个移动有目录中的正式目标与来源计划");
        }
        const expected = catalog.flatMap(t => t.compatibleActionIds.filter(id => legal.some(a => a.actionId === id
          && a.family === "move")).map(id => `${id}|${t.targetId}|${t.planId}`)).sort();
        assert.deepEqual(selected.filter(a => a.family === "move" && a.routeTargetId)
          .map(a => `${a.actionId}|${a.routeTargetId}|${a.routePlanId}`).sort(), expected,
        "保留目标目录所有移动，包括不同目标及同成本方向，不只选一个");
        assert.equal(JSON.stringify(fork.inspect()), before, "筛选不写正式状态或RNG");
        const row = { step, legal, catalog, roots, selected, leaks };
        report.rows.push(row);
        if (mode === "fixed") assert.equal(leaks.length, 0, `第${step}步不能回补无目标move`);
      } finally { fork?.dispose(); env.dispose(); }
    }
    if (mode === "before") assert.ok(report.rows.some(row => row.leaks.length > 0), "必须直接复现泄漏");
    else {
      const baseline = JSON.parse(fs.readFileSync("reports/iteration/ordinary-movement-demand-before-20260907.json"));
      for (const row of report.rows) {
        const old = baseline.rows.find(r => r.step === row.step);
        assert.deepEqual(row.legal, old.legal, "正式合法集不改");
        assert.deepEqual(row.catalog, old.catalog, "不改目录/资源下界/目标偏好");
        assert.deepEqual(row.roots, old.roots, "根动作本已目标绑定，不改根排序");
        assert.deepEqual(row.selected, old.selected.filter(a => a.family !== "move" || a.routeTargetId),
          "唯一行为变化为不回补无目标移动，其他动作和顺序不变");
      }
    }
    report.passed = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: report.passed, rows: report.rows.map(r => ({ step: r.step,
    legalMoves: r.legal.filter(a => a.family === "move").length, unboundMoves: r.leaks.length,
    boundMoves: r.selected.filter(a => a.family === "move" && a.routeTargetId).length })), error: report.error }, null, 2));
}

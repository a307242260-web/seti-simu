"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const output = "reports/iteration/movement-root-admission-42-20260907.json";
if (fs.existsSync(output)) console.log("已有根准入证据，不重跑");
else {
  const rows = [];
  for (const [code, tree] of [["96e60c14", process.argv[2]], ["0b586daa", process.cwd()]]) {
    assert.ok(tree && path.isAbsolute(tree));
    const { createSimulationEnv } = require(path.join(tree, "randomizer/app/simulation-env"));
    const evaluator = require(path.join(tree, "randomizer/game/ai/expected-score-evaluator"));
    const env = createSimulationEnv(); let fork;
    try {
      const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
      delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
      const seatId = "player-green", legalActions = fork.inputPort.enumerateActions();
      const observation = fork.projection({ playerId: seatId, role: "player" }).state;
      const input = { focalSeatId: seatId, rootObservation: observation, legalActions };
      const catalog = evaluator.enumerateSecondaryAgentRootTargets(input);
      const roots = evaluator.selectSecondaryAgentRootActions(input);
      rows.push({ code, legalActions, roots, companyBindings: catalog.filter(t =>
        t.compatibleActionIds.includes("industry:5bda1856")) });
    } finally { fork?.dispose(); env.dispose(); }
  }
  assert.deepEqual(rows[0].legalActions, rows[1].legalActions);
  assert.equal(rows[0].roots.some(a => a.family === "industry"), false);
  assert.equal(rows[1].roots.some(a => a.family === "industry"), true);
  fs.writeFileSync(output, JSON.stringify({ scope: "同一正式42前态根准入对照，不运行搜索",
    rows, passed: true }, null, 2) + "\n");
  console.log(JSON.stringify(rows.map(r => ({ code: r.code, roots: r.roots.map(a => a.actionId),
    companyBindings: r.companyBindings.map(t => ({ targetId: t.targetId, planId: t.planId })) }))));
}

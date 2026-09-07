"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const mode = process.argv[2]; assert.ok(["before", "fixed"].includes(mode));
const output = `reports/iteration/card-finish-contract-${mode}-20260907.json`;
if (fs.existsSync(output)) console.log("已有合同验证记录");
else {
  const source = JSON.parse(fs.readFileSync("reports/iteration/white-movement-205-20260907.json"));
  const save = JSON.parse(fs.readFileSync(source.source));
  const rows = [];
  for (const stage of ["free-available", "free-insufficient", "target-arrived"]) {
    const env = createSimulationEnv(); let fork;
    try {
      env.loadCheckpoint(source.entries.find(e => e.step === 205).checkpoint);
      const execute = a => { assert.ok(a); const r = env.step(a); assert.equal(r.ok, true, JSON.stringify(r.error)); };
      if (stage === "free-insufficient") execute(env.legalActions().find(a => a.target?.deltaY === 1));
      if (stage === "target-arrived") for (let i = 204; i < 209; i++)
        execute(env.legalActions().find(a => a.actionId === save.replaySteps[i].action.actionId));
      fork = env.createCounterfactualFork().composition;
      const observation = fork.projection({ playerId: "player-white", role: "player" }).state;
      const legal = fork.inspect().session.decision.choices;
      const requirements = observation.probeRouteRequirements;
      const goal = requirements.candidates.find(g => g.requirementId === "rocket:6:land:saturn:planet:"); assert.ok(goal);
      const selected = evaluator.selectSecondaryAgentSuccessors({ focalSeatId: "player-white", branchObservation: observation,
        legalSuccessors: legal, routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId}` });
      const graphAllowsFinish = goal.movementNextSteps.some(s => s.skip === true);
      assert.equal(graphAllowsFinish, stage !== "free-available");
      if (stage === "target-arrived") assert.equal(goal.required.movementSteps, 0);
      assert.equal(selected.some(a => a.target?.skip === true), mode === "before" || graphAllowsFinish);
      rows.push({ stage, movementContext: requirements.movementContext, goal, legal, selected, graphAllowsFinish });
    } finally { fork?.dispose(); env.dispose(); }
  }
  fs.writeFileSync(output, JSON.stringify({ mode, scope: "三个真实卡牌阶段的图首步与绑定候选合同，不运行AI", rows, passed: true }, null, 2) + "\n");
  console.log(JSON.stringify({ output, passed: true, rows: rows.map(r => ({ stage: r.stage, graphAllowsFinish: r.graphAllowsFinish,
    selected: r.selected.map(a => a.summary) })) }));
}

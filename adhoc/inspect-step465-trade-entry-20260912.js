"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const model = require("../randomizer/game/ai/outcome-model");
const source = "reports/iteration/budget-before-step465-20260912.json";
const output = "reports/iteration/step465-trade-entry-v3-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync(source));
const results = [];
for (const targetId of ["land:jupiter:planet:", "orbit:venus:planet:"]) {
  const env = createSimulationEnv(); let fork;
  const route = { targetId, stages: [] }; results.push(route);
  try {
    env.loadCheckpoint(input.checkpoint);
    const root = env.createCheckpoint();
    fork = env.createCounterfactualFork(); const comp = fork.composition;
    const submit = action => {
      const view = comp.inspect(); const decision = view.session?.decision;
      const result = view.phase === "awaiting_input"
        ? comp.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: action })
        : comp.inputPort.submitAction(action);
      assert.equal(result.ok, true, JSON.stringify(result));
    };
    const launch = comp.inputPort.enumerateActions({}).find(a => a.family === "launch");
    assert(launch); submit(launch);
    const end = comp.inputPort.enumerateActions({}).find(a => a.family === "end_turn");
    assert(end); submit(end);
    assert.equal(comp.counterfactualPort.advanceFocalPlanningTurn("player-green").advanced, true);
    let currentAction = launch, planId;
    for (let step = 0; step < 24; step += 1) {
      const observation = model.createDecisionObservation(comp.projection({ seatId: "player-green" }).state);
      const inspection = comp.inspect();
      const legal = inspection.phase === "awaiting_input"
        ? inspection.session.decision.choices : comp.inputPort.enumerateActions({});
      const goals = observation.outcomeProjection.progress.probeGoalRequirements.candidates;
      const goal = goals.find(g => g.targetId === targetId && g.sourceId !== "launch");
      if (!planId && goal) planId = `probe:${goal.requirementId}`;
      const selected = evaluator.selectSecondaryAgentSuccessors({ branchObservation: observation,
        focalSeatId: "player-green", currentAction, legalSuccessors: legal,
        routeTargetId: targetId, routePlanId: planId });
      route.stages.push({ observation, goal, legal, selected });
      if (selected.filter(a => a.family === "quick_trade").length > 1) { route.stop = "multiple-trade-entry"; break; }
      if (!selected.length) { route.stop = "no-successor"; break; }
      const chosen = selected[0];
      const original = legal.find(a => a.actionId === chosen.actionId); assert(original);
      submit(original); currentAction = original;
      if (original.family === "end_turn") {
        const advance = comp.counterfactualPort.advanceFocalPlanningTurn("player-green");
        if (!advance.advanced) { route.stop = "turn-boundary"; break; }
      }
    }
    route.stop ||= "diagnostic-depth-24";
    assert.deepEqual(env.createCheckpoint(), root);
  } catch (error) { route.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.composition.dispose(); env.dispose(); }
}
fs.writeFileSync(output, JSON.stringify({ source, scope: "两条隔离正式路线各最多24输入；多选暂取首项仅用于定位，不是AI搜索或生产策略", results }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(results.map(r => ({ target: r.targetId, stop: r.stop, error: r.error,
  stages: r.stages.map(s => ({ required: s.goal?.required, selected: s.selected.map(a => a.summary) })) })), null, 2));

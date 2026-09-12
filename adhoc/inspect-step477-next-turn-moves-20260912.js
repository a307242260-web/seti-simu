"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const model = require("../randomizer/game/ai/outcome-model");
const source = "reports/iteration/budget-before-step477-20260912.json";
const output = "reports/iteration/step477-next-turn-move-routes-20260912.json";
if (fs.existsSync(output)) { console.log(`已有证据，不重复执行：${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync(source));
const save = JSON.parse(fs.readFileSync(input.source));
const env = createSimulationEnv();
let fork;
try {
  env.loadCheckpoint(input.checkpoint);
  for (let i = 476; i < 481; i += 1) {
    const expected = save.replaySteps[i];
    const action = env.legalActions().find(a => a.actionId === expected.action.actionId);
    assert.deepEqual(action, expected.action);
    assert.equal(env.step(action).ok, true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after, expected.after);
  }
  const root = env.createCheckpoint();
  fork = env.createCounterfactualFork();
  const comp = fork.composition;
  const advanced = comp.counterfactualPort.advanceFocalPlanningTurn("player-white");
  assert.equal(advanced.ok, true);
  assert.equal(advanced.advanced, true);
  const launch = comp.inputPort.enumerateActions({}).find(a => a.family === "launch");
  assert(launch, "缺少正式发射候选");
  assert.equal(comp.inputPort.submitAction(launch).ok, true);
  const endTurn = comp.inputPort.enumerateActions({}).find(a => a.family === "end_turn");
  assert(endTurn, "缺少结束行动圈候选");
  assert.equal(comp.inputPort.submitAction(endTurn).ok, true);
  const nextTurn = comp.counterfactualPort.advanceFocalPlanningTurn("player-white");
  assert.equal(nextTurn.ok, true);
  assert.equal(nextTurn.advanced, true);
  const observation = model.createDecisionObservation(comp.projection({ seatId: "player-white" }).state);
  const legalActions = comp.inputPort.enumerateActions({});
  assert(legalActions.every(a => a.actorId === "player-white"));
  const targets = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: observation,
    focalSeatId: "player-white", legalActions });
  const requirements = observation.outcomeProjection?.progress?.probeGoalRequirements;
  assert(requirements?.candidates, "缺少正式路线目录");
  const routes = targets.filter(t => t.planId.startsWith("probe:")).map(target => {
    const goal = requirements.candidates.find(g => target.planId === `probe:${g.requirementId || g.targetId}`);
    assert(goal);
    return { target, goal, actions: legalActions.filter(a => target.compatibleActionIds.includes(a.actionId)) };
  });
  const bound = requirements.candidates.filter(g => g.sourceId !== "launch").map(goal => ({
    goal,
    selected: evaluator.selectSecondaryAgentSuccessors({ branchObservation: observation,
      focalSeatId: "player-white", currentAction: launch, legalSuccessors: legalActions,
      routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId || goal.targetId}` }),
  }));
  assert.deepEqual(env.createCheckpoint(), root, "fork不得修改根状态");
  fs.writeFileSync(output, JSON.stringify({ source,
    sourceHash: createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
    scope: "真实477–481取牌链后，正式隔离fork推进本席下一turn并正式发射、结束行动圈、再推进本席，检查主行动前绑定移动后继；不执行对手、不跑AI。",
    observation, legalActions, targets, routes, bound }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output, routes: bound.map(r => ({ plan: r.goal.requirementId,
    required: r.goal.required, next: r.goal.movementNextSteps,
    actions: r.selected.map(a => ({ family: a.family, target: a.target })) })) }, null, 2));
} finally { fork?.composition.dispose(); env.dispose(); }

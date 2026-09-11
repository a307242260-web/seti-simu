"use strict";

// 正式规则局部证据；不运行 AI、不计作完整局，不修改 checkpoint。
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const fixture = require("../randomizer/full-flow/standard-flow-v1.fixture");
const plans = require("../randomizer/game/ai/plan-continuation");
const env = createSimulationEnv();
const inputs = [];
function submit(action) {
  assert(action);
  const result = env.step(action);
  assert.equal(result.ok, true, JSON.stringify(result.error));
  inputs.push({ actor: action.actorId, family: action.family });
}
function boundary() {
  const observation = env.observe();
  return { round: observation.publicState.roundNumber, turn: observation.publicState.turnNumber,
    actor: env.legalActions()[0]?.actorId, families: [...new Set(env.legalActions().map(a => a.family))] };
}
try {
  env.reset(fixture.config);
  const progress = new Map();
  for (let guard = 0; env.legalActions()[0]?.family.startsWith("choose_"); guard++) {
    assert(guard < 50);
    const actions = env.legalActions(), id = actions[0].actorId;
    const selected = progress.get(id) || { industry: false, cards: new Set() };
    let action = actions.find(a => ["start_initial_setup", "confirm_initial_setup"].includes(a.target?.kind));
    if (!action && !selected.industry) {
      action = actions.find(a => a.target?.selectionKind === "industry");
      if (action) selected.industry = true;
    }
    if (!action && selected.cards.size < 2) {
      action = actions.find(a => a.target?.selectionKind === "initial" && !selected.cards.has(a.target.cardId));
      if (action) selected.cards.add(action.target.cardId);
    }
    progress.set(id, selected);
    submit(action || actions[0]);
  }
  const before = boundary(), focal = before.actor;
  assert(before.families.includes("pass"));
  assert(!before.families.includes("end_turn"));
  submit(env.legalActions().find(a => a.family === "launch"));
  const afterMain = boundary();
  assert(afterMain.families.includes("end_turn"));
  assert(!afterMain.families.includes("pass"));
  const end = env.legalActions().find(a => a.family === "end_turn");
  const endSteps = plans.compilePlanSteps([{ ...plans.capturePlanStep({action:end, observation:env.observe()}), goalDepth:0 }]);
  const endPlan = {schemaVersion:plans.PLAN_SCHEMA_VERSION, nextActionId:end.actionId, steps:endSteps};
  submit(end);
  for (let guard = 0; env.legalActions()[0]?.actorId !== focal; guard++) {
    assert(guard < 40);
    const actions = env.legalActions();
    submit(actions.find(a => a.family === "end_turn") || actions.find(a => a.family === "launch") || actions[0]);
  }
  const nextOwnTurn = boundary();
  assert(nextOwnTurn.turn > before.turn);
  assert(!nextOwnTurn.families.includes("end_turn"));
  assert(nextOwnTurn.families.includes("pass"));
  const endReuse = plans.planReuseCheck(endPlan, env.observe(), env.legalActions());
  assert.equal(endReuse.reason, "step-not-legal");
  const pass = env.legalActions().find(a => a.family === "pass");
  const passSteps = plans.compilePlanSteps([{...plans.capturePlanStep({action:pass,observation:env.observe()}),goalDepth:0}]);
  const passPlan = {schemaVersion:plans.PLAN_SCHEMA_VERSION,nextActionId:pass.actionId,steps:passSteps};
  console.log(JSON.stringify({before,afterMain,nextOwnTurn,endReuse,
    passDependencies:passSteps[0].dependencies,
    passFutureDependencies:passSteps[0].futureDependencies,
    unchangedPassSameTurn:plans.planReuseCheck(passPlan,env.observe(),env.legalActions(),{sameTurn:true}).hit,
    unchangedPassNewTurn:plans.planReuseCheck(passPlan,env.observe(),env.legalActions(),{sameTurn:false}),
    inputs}, null, 2));
} finally { env.dispose(); }

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
function resourcesFor(playerId) {
  const player = env.observe().publicState.players.find(p => p.playerId === playerId);
  return {credits:player.credits,energy:player.energy,publicity:player.publicity};
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
  const fork = env.createCounterfactualFork(null, {branchKey:"turn-boundary-proof"});
  const comp = fork.composition || fork;
  let forkBoundary;
  try {
    const forkEnd = comp.inputPort.enumerateActions({}).find(a => a.family === "end_turn");
    assert.equal(comp.inputPort.submitAction(forkEnd).ok, true);
    assert.equal(comp.counterfactualPort.advanceFocalPlanningTurn(focal).ok, true);
    const actions = comp.inputPort.enumerateActions({});
    assert.equal(actions[0].actorId, focal);
    assert(!actions.some(a => a.family === "end_turn"));
    assert(actions.some(a => a.family === "pass"));
    forkBoundary = {actor:actions[0].actorId, families:[...new Set(actions.map(a => a.family))]};
  } finally { comp.dispose(); }
  assert.deepEqual(boundary(), afterMain, "隔离fork不得修改正式根状态");
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
  const unchangedPassSameTurn = plans.planReuseCheck(passPlan,env.observe(),env.legalActions(),{sameTurn:true}).hit;
  const unchangedPassNewTurn = plans.planReuseCheck(passPlan,env.observe(),env.legalActions(),{sameTurn:false});
  const resourcesBefore = resourcesFor(focal);
  const legalBefore = env.legalActions().map(plans.actionSemanticKey);
  submit(env.legalActions().find(a => a.family === "quick_trade" && a.target.tradeId === "energy-for-credit"));
  const resourcesAfter = resourcesFor(focal);
  assert.notDeepEqual(resourcesAfter, resourcesBefore, "真实交易必须改变本席资源");
  const legalAfter = env.legalActions().map(plans.actionSemanticKey);
  const changedPassReuse = plans.planReuseCheck(passPlan,env.observe(),env.legalActions(),{sameTurn:true});
  assert.equal(changedPassReuse.hit, true, "复现：空依赖PASS没有发现真实交易带来的变化");
  const lowEnergyPass = env.legalActions().find(a => a.family === "pass");
  const lowEnergySteps = plans.compilePlanSteps([{...plans.capturePlanStep({action:lowEnergyPass,observation:env.observe()}),goalDepth:0}]);
  const lowEnergyPlan = {schemaVersion:plans.PLAN_SCHEMA_VERSION,nextActionId:lowEnergyPass.actionId,steps:lowEnergySteps};
  submit(env.legalActions().find(a => a.family === "quick_trade" && a.target.tradeId === "credits-for-energy"));
  const gainedActions = env.legalActions().map(plans.actionSemanticKey).filter(k => !legalAfter.includes(k));
  assert(gainedActions.length > 0, "增加能量须恢复真实行动机会");
  const regainedPassReuse = plans.planReuseCheck(lowEnergyPlan,env.observe(),env.legalActions(),{sameTurn:true});
  assert.equal(regainedPassReuse.hit, true, "复现：出现新机会，旧PASS仍命中");
  console.log(JSON.stringify({before,afterMain,forkBoundary,nextOwnTurn,endReuse,
    passAfterNewOpportunity:{hit:regainedPassReuse.hit,resources:resourcesFor(focal),addedActions:gainedActions},
    passAfterUnplannedTrade:{hit:changedPassReuse.hit, selfBefore:resourcesBefore,selfAfter:resourcesAfter,
      removedActions:legalBefore.filter(k => !legalAfter.includes(k)),addedActions:legalAfter.filter(k => !legalBefore.includes(k))},
    passDependencies:passSteps[0].dependencies,
    passFutureDependencies:passSteps[0].futureDependencies,
    unchangedPassSameTurn, unchangedPassNewTurn,
    inputs}, null, 2));
} finally { env.dispose(); }

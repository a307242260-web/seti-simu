"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../../app/simulation-env");
const turnFlow = require("../turn-flow");
const test = require("node:test");
const evaluator = require("./expected-score-evaluator");
const continuation = require("./plan-continuation");

// 窄接口义务：策略观察必须携带正式主行动阶段；不验证得分或完整局轨迹。
const env = createSimulationEnv();
let fork;
let timingFixture;
try {
  env.reset({ seed: "quick-timing-stage-contract", activePlayerCount: 4, offlineTeacher: true });
  const opening = new Map();
  for (let count = 0; env.legalActions()[0]?.phase === "conditional"; count += 1) {
    assert(count < 50);
    const actions = env.legalActions();
    const actor = actions[0].actorId;
    const progress = opening.get(actor) || { industry: false, cards: new Set() };
    let selected = actions.find(a => ["start_initial_setup", "confirm_initial_setup"].includes(a.target?.kind));
    if (!selected && !progress.industry) {
      selected = actions.find(a => a.target?.selectionKind === "industry");
      if (selected) progress.industry = true;
    }
    if (!selected && progress.cards.size < 2) {
      selected = actions.find(a => a.target?.selectionKind === "initial" && !progress.cards.has(a.target.cardId));
      if (selected) progress.cards.add(selected.target.cardId);
    }
    opening.set(actor, progress);
    assert.equal(env.step(selected || actions[0]).ok, true);
  }
  fork = env.createCounterfactualFork().composition;
  const launch = fork.inputPort.enumerateActions({}).find(a => a.family === "launch");
  assert(launch);
  const actorId = launch.actorId;
  const viewer = { role: "player", playerId: actorId };
  const observed = [];
  function capture(label) {
    const saved = fork.lifecycle.save().envelope;
    const state = JSON.parse(saved.committedState);
    const projection = fork.projection(viewer).state;
    const own = projection.publicState.players.find(p => p.playerId === actorId);
    observed.push({ label, actual: own.mainActionCompleted,
      expected: Boolean(state.players.players.find(p => p.id === actorId).mainActionCompleted) });
    assert.deepEqual(fork.lifecycle.save().envelope, saved, "读取阶段不得修改规则状态或RNG");
  }
  capture("before-main");
  assert.equal(fork.inputPort.submitAction(launch).ok, true);
  assert.equal(fork.inspect().session, null);
  capture("after-main");
  const checkpoint = fork.lifecycle.save().envelope;
  const move = fork.inputPort.enumerateActions({}).find(a => a.family === "move");
  assert(move);
  assert.equal(fork.inputPort.submitAction(move).ok, true);
  assert.equal(fork.inspect().phase, "awaiting_input");
  capture("during-payment");
  assert.equal(fork.lifecycle.restore(checkpoint).ok, true);
  const end = fork.inputPort.enumerateActions({}).find(a => a.family === "end_turn");
  assert(end);
  assert.equal(fork.inputPort.submitAction(end).ok, true);
  assert.equal(fork.counterfactualPort.advanceFocalPlanningTurn(actorId).ok, true);
  capture("next-own-turn");
  assert.equal(fork.lifecycle.restore(checkpoint).ok, true);
  capture("restored-after-main");
  const goals = fork.projection(viewer).state.probeRouteRequirements.candidates;
  const legalMoves = fork.inputPort.enumerateActions({}).filter(a => a.family === "move");
  const goal = goals.find(g => g.moveTiming?.some(t => t.comparable && legalMoves.some(a => (
    a.target.rocketId === t.rocketId && a.target.deltaX === t.deltaX && a.target.deltaY === t.deltaY
  ))));
  assert(goal, "发射后必须提供至少一个可比较的正式路线首步");
  const timing = goal.moveTiming.find(t => t.comparable && legalMoves.some(a => (
    a.target.rocketId === t.rocketId && a.target.deltaX === t.deltaX && a.target.deltaY === t.deltaY
  )));
  const timedMove = legalMoves.find(a => a.target.rocketId === timing.rocketId
    && a.target.deltaX === timing.deltaX && a.target.deltaY === timing.deltaY);
  function rotatedCost(saved) {
    const state = JSON.parse(saved.committedState);
    assert.equal(turnFlow.rotateSolarSystem(state, 1, actorId).ok, true);
    assert.equal(fork.lifecycle.restore({ ...saved, committedState: JSON.stringify(state) }).ok, true);
    return fork.projection(viewer).state.probeRouteRequirements.candidates
      .find(g => g.requirementId === goal.requirementId).required.movementPoints;
  }
  assert.equal(timing.delayedMovementPoints, rotatedCost(checkpoint));
  assert.equal(fork.lifecycle.restore(checkpoint).ok, true);
  assert.equal(fork.inputPort.submitAction(timedMove).ok, true);
  const payment = fork.inspect().session.decision;
  const energyPayment = payment.choices.find(c => c.target?.choiceId === "energy");
  assert(energyPayment);
  assert.equal(fork.inputPort.submitDecision({ decisionId: payment.decisionId,
    decisionVersion: payment.decisionVersion, ownerId: payment.ownerId, choice: energyPayment }).ok, true);
  assert.equal(fork.inspect().session, null);
  assert.equal(timing.earlyMovementPoints,
    timedMove.payload.requiredMovePoints + rotatedCost(fork.lifecycle.save().envelope),
    "投影成本必须等于正式移动付款完成后再转动的剩余路线加已走点数");
  assert.equal(fork.lifecycle.restore(checkpoint).ok, true);
  assert.deepEqual(fork.projection(viewer).state.probeRouteRequirements.candidates, goals,
    "恢复相同盘面必须得到相同时机事实，不能沿用转动场景的缓存");
  assert.deepEqual(observed.map(s => s.expected), [false, true, true, false, true]);
  assert.deepEqual(observed.map(s => ({ label: s.label, completed: s.actual })),
    observed.map(s => ({ label: s.label, completed: s.expected })),
    "主行动前后与恢复后的公开阶段必须跟随正式状态，不依赖已过滤的合法动作集");
  const observation = fork.projection(viewer).state;
  const legalActions = fork.inputPort.enumerateActions({});
  const rootTargets = evaluator.enumerateSecondaryAgentRootTargets({
    rootObservation: observation, focalSeatId: actorId,
    legalActions: legalActions.filter(a => !["end_turn", "pass"].includes(a.family)),
  });
  const place = legalActions.find(a => a.family === "place_data");
  assert(place, "该正式开局须保留合法放数据动作，以验证策略而非规则合法性过滤");
  const incomeTarget = "income:gain:2,3,0,0,1,0";
  const incomePlan = "income:data:computer-slot-4";
  const steps = continuation.compilePlanSteps([{
    ...continuation.capturePlanStep({ observation, action: place }),
    routeTargetId: incomeTarget, routePlanId: incomePlan,
  }]);
  assert.equal(steps[0].valid, true, "反例计划须先具备完整身份与依赖证据");
  timingFixture = { observation, legalActions, rootTargets, actorId, place,
    incomeTarget, incomePlan, goals,
    plan: { schemaVersion: continuation.PLAN_SCHEMA_VERSION, nextActionId: place.actionId, steps } };
  console.log("quick timing phase observation contract passed");
} finally {
  fork?.dispose();
  env.dispose();
}

test("主行动后根目录保留真实转动窗口与指定公共牌，不放行普通准备", () => {
  const f = timingFixture;
  const windowTargets = f.rootTargets.filter(t => f.goals.some(g => (
    t.planId === `probe:${g.requirementId}` && g.moveTiming?.some(m => (
      m.comparable && m.earlyMovementPoints < m.delayedMovementPoints
    ))
  )));
  assert(windowTargets.length > 0, "先走能减少下一次转动成本的目标不能被全部删除");
  assert(f.rootTargets.some(t => t.targetId.startsWith("card:acquire:")),
    "可见公共牌的明确获取目标须保留");
  assert.equal(f.rootTargets.some(t => t.compatibleActionIds.includes(f.place.actionId)), false,
    "当前放数据只是后续研究/收入准备，不属于主行动后的机会窗口");
});

test("主行动后已绑定的普通准备延至下一turn，保留原目标", () => {
  const f = timingFixture;
  const selected = evaluator.selectSecondaryAgentSuccessors({
    branchObservation: f.observation, focalSeatId: f.actorId,
    legalSuccessors: f.legalActions, routeTargetId: f.incomeTarget, routePlanId: f.incomePlan,
  });
  assert.deepEqual(selected.map(a => a.family), ["end_turn"],
    "绑定收入目标不能让可延后的放数据立即执行，也不能直接变成无后继");
  assert.equal(selected[0].routeTargetId, f.incomeTarget);
  assert.equal(selected[0].routePlanId, f.incomePlan);
});

test("目标完成后的未绑定后继不能重新引入主行动后普通准备", () => {
  const f = timingFixture;
  const selected = evaluator.selectSecondaryAgentSuccessors({
    branchObservation: f.observation, focalSeatId: f.actorId, legalSuccessors: f.legalActions,
  });
  assert.equal(selected.some(a => a.actionId === f.place.actionId), false);
  assert(selected.some(a => a.family === "end_turn"));
});

test("计划身份和盘面依赖未变化也不能绕过主行动后时机判断", () => {
  const f = timingFixture;
  const reused = continuation.planReuseCheck(f.plan, f.observation, f.legalActions);
  assert.equal(reused.hit, false, "可延后的旧计划步骤应重新决策，而非继续立即放数据");
  assert.equal(reused.reason, "quick-timing-no-current-window");
});

"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../../app/simulation-env");
const turnFlow = require("../turn-flow");

// 窄接口义务：策略观察必须携带正式主行动阶段；不验证得分或完整局轨迹。
const env = createSimulationEnv();
let fork;
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
  console.log("quick timing phase observation contract passed");
} finally {
  fork?.dispose();
  env.dispose();
}

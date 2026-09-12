"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../../app/simulation-env");

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
  const end = fork.inputPort.enumerateActions({}).find(a => a.family === "end_turn");
  assert(end);
  assert.equal(fork.inputPort.submitAction(end).ok, true);
  assert.equal(fork.counterfactualPort.advanceFocalPlanningTurn(actorId).ok, true);
  capture("next-own-turn");
  assert.equal(fork.lifecycle.restore(checkpoint).ok, true);
  capture("restored-after-main");
  assert.deepEqual(observed.map(s => s.expected), [false, true, false, true]);
  assert.deepEqual(observed.map(s => ({ label: s.label, completed: s.actual })),
    observed.map(s => ({ label: s.label, completed: s.expected })),
    "主行动前后与恢复后的公开阶段必须跟随正式状态，不依赖已过滤的合法动作集");
  console.log("quick timing phase observation contract passed");
} finally {
  fork?.dispose();
  env.dispose();
}

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const turnFlow = require("../randomizer/game/turn-flow");
const rockets = require("../randomizer/game/rockets");
const source = "seti-saves/seti-save-research-turn-boundary-20260911-31a2e43b-full-v276.json";
const save = JSON.parse(fs.readFileSync(source, "utf8"));
const env = createSimulationEnv();
const cases = [];

function inspectMove(action, step) {
  const comp = env.createCounterfactualFork(null, { branchKey: `move-window-${step}` }).composition;
  const viewer = { playerId: action.actorId, role: "player" };
  const envelope = comp.lifecycle.save().envelope;
  const base = JSON.parse(envelope.committedState);
  const actor = base.players.players.find(p => p.id === action.actorId);
  if (!actor.mainActionCompleted) {
    comp.dispose();
    return;
  }
  function routes() {
    return comp.projection(viewer).state.probeRouteRequirements.candidates;
  }
  function restore(snapshot) {
    assert.equal(comp.lifecycle.restore(snapshot).ok, true);
  }
  function rotate(snapshot) {
    const state = JSON.parse(snapshot.committedState);
    const result = turnFlow.rotateSolarSystem(state, 1, action.actorId);
    assert.equal(result.ok, true);
    restore({ ...snapshot, committedState: JSON.stringify(state) });
    return { routes: routes(), moved: result.moved || [], events: result.events || [] };
  }
  try {
    const current = routes();
    const delayed = rotate(envelope);
    restore(envelope);
    const legal = comp.inputPort.enumerateActions({}).find(a => a.actionId === action.actionId);
    assert(legal, `恢复后缺移动动作 ${step}`);
    assert.equal(comp.inputPort.submitAction(legal).ok, true);
    const payments = [];
    for (let index = step; ; index += 1) {
      const inspection = comp.inspect();
      if (!inspection.session) break;
      assert.equal(inspection.phase, "awaiting_input");
      const decision = inspection.session.decision;
      const actions = decision.choices;
      const recorded = save.replaySteps[index]?.action;
      assert(recorded?.phase === "conditional", `缺少条件结算记录 ${index + 1}`);
      const selected = actions.find(a => a.actionId === recorded.actionId);
      assert(selected, `缺少合法条件动作 ${index + 1}`);
      if (selected.family === "choose_payment") payments.push({ target: selected.target, payload: selected.payload });
      assert.equal(comp.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: selected }).ok, true);
    }
    const movedEnvelope = comp.lifecycle.save().envelope;
    const movedRoot = JSON.parse(movedEnvelope.committedState);
    const beforeCoordinate = rockets.getRocketSectorCoordinate(base.pieces.rockets
      .find(r => r.id === action.target.rocketId));
    const afterCoordinate = rockets.getRocketSectorCoordinate(movedRoot.pieces.rockets
      .find(r => r.id === action.target.rocketId));
    assert.equal(afterCoordinate.x, (beforeCoordinate.x + action.target.deltaX + 8) % 8);
    assert.equal(afterCoordinate.y, beforeCoordinate.y + action.target.deltaY);
    const movedActor = movedRoot.players.players.find(p => p.id === action.actorId);
    const paidEnergy = actor.resources.energy - movedActor.resources.energy;
    const movePoints = action.payload.requiredMovePoints;
    assert(Number.isFinite(movePoints) && movePoints > 0);
    const afterMove = routes();
    const early = rotate(movedEnvelope);
    const comparisons = current.filter(c => c.rocketId === action.target.rocketId).map(c => {
      const wait = delayed.routes.find(x => x.requirementId === c.requirementId);
      const now = afterMove.find(x => x.requirementId === c.requirementId);
      const beforeRotation = early.routes.find(x => x.requirementId === c.requirementId);
      if (!wait || !now || !beforeRotation) return {
        requirementId: c.requirementId, comparable: false,
        missing: { wait: !wait, now: !now, early: !beforeRotation },
      };
      const currentEnergy = c.required.energy;
      const delayedEnergy = wait.required.energy;
      const earlyEnergy = paidEnergy + beforeRotation.required.energy;
      const projectedTiming = c.moveTiming?.find(fact => fact.rocketId === action.target.rocketId
        && fact.deltaX === action.target.deltaX && fact.deltaY === action.target.deltaY);
      if (c.movementNextSteps.some(s => s.family === "move" && s.rocketId === action.target.rocketId
        && s.deltaX === action.target.deltaX && s.deltaY === action.target.deltaY)) {
        assert(projectedTiming, `正式路线首步缺少时机事实 ${step}/${c.requirementId}`);
      }
      if (projectedTiming) {
        assert.equal(projectedTiming.comparable, true);
        assert.equal(projectedTiming.delayedMovementPoints, wait.required.movementPoints);
        assert.equal(projectedTiming.earlyMovementPoints, movePoints + beforeRotation.required.movementPoints);
      }
      return {
        requirementId: c.requirementId, comparable: true,
        currentEnergy, delayedEnergy, earlyEnergy, paidEnergy,
        currentSteps: c.required.movementSteps,
        delayedSteps: wait.required.movementSteps,
        earlySteps: 1 + beforeRotation.required.movementSteps,
        rotationEnergyPenalty: delayedEnergy - currentEnergy,
        energySavedByMovingFirst: delayedEnergy - earlyEnergy,
        currentMovePoints: c.required.movementPoints,
        delayedMovePoints: wait.required.movementPoints,
        earlyMovePoints: movePoints + beforeRotation.required.movementPoints,
        movePointsSavedByMovingFirst: wait.required.movementPoints
          - movePoints - beforeRotation.required.movementPoints,
        matchedCurrentRoute: c.movementNextSteps.some(s => s.family === "move"
          && s.rocketId === action.target.rocketId
          && s.deltaX === action.target.deltaX && s.deltaY === action.target.deltaY),
      };
    });
    assert(comparisons.length, `移动必须能关联同探测器目标 ${step}`);
    cases.push({ step, actor: action.actorId, action: action.target, payments,
      rotationBefore: base.solarSystem.rotation,
      delayedRocketMoves: delayed.moved.map(m => ({ rocketId: m.rocketId, from: m.from, to: m.to, reason: m.reason })),
      earlyRocketMoves: early.moved.map(m => ({ rocketId: m.rocketId, from: m.from, to: m.to, reason: m.reason })),
      rotationEventCounts: { delayed: delayed.events.length, early: early.events.length },
      comparisons });
  } finally { comp.dispose(); }
}

try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (const step of save.replaySteps) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert(action, `正式回放缺动作 ${step.stepIndex + 1}`);
    if (action.family === "move") inspectMove(action, step.stepIndex + 1);
    assert.equal(env.step(action).ok, true);
  }
  assert(env.isTerminal());
  assert(cases.some(c => c.comparisons.some(x => x.matchedCurrentRoute && x.movePointsSavedByMovingFirst > 0)));
  assert(cases.some(c => c.comparisons.every(x => !x.matchedCurrentRoute || x.movePointsSavedByMovingFirst <= 0)));
  console.log(JSON.stringify({ source, terminal: true,
    scope: "已有回放的主行动后普通移动及其条件结算；一次正式转动领域结算、正式路线目录。移动点数用于几何成本比较；能量差未折算弃牌价值，不能单独当作总收益。未评估转动触发奖励，不模拟对手，不证明生产策略已实现。",
    cases }, null, 2));
} finally { env.dispose(); }

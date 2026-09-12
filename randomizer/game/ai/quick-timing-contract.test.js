"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../../app/simulation-env");
const turnFlow = require("../turn-flow");
const test = require("node:test");
const evaluator = require("./expected-score-evaluator");
const continuation = require("./plan-continuation");
const outcomeModel = require("./outcome-model");

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

test("移动窗口绑定方向，消失后计划失效；正式付款与结束不受裁剪", () => {
  const f = timingFixture;
  const target = f.rootTargets.find(t => t.planId.startsWith("probe:"));
  const move = f.legalActions.find(a => a.actionId === target.compatibleActionIds[0]);
  assert.equal(move.family, "move");
  const timingInput = { observation: f.observation, legalActions: f.legalActions,
    routeTargetId: target.targetId, routePlanId: target.planId };
  assert.equal(evaluator.allowsQuickActionTiming({ ...timingInput, action: move }), true);
  const wrongDirection = f.legalActions.find(a => a.family === "move" && a.actionId !== move.actionId);
  assert(wrongDirection);
  assert.equal(evaluator.allowsQuickActionTiming({ ...timingInput, action: wrongDirection }), false);
  const steps = continuation.compilePlanSteps([{
    ...continuation.capturePlanStep({ observation: f.observation, action: move }),
    routeTargetId: target.targetId, routePlanId: target.planId,
  }]);
  const plan = { schemaVersion: continuation.PLAN_SCHEMA_VERSION, nextActionId: move.actionId, steps };
  assert.equal(continuation.planReuseCheck(plan, f.observation, f.legalActions).hit, true);
  // 纯消费者反例：仅改变公开机会事实，验证不是动作合法性或身份变化导致重搜。
  const changed = structuredClone(f.observation);
  const goal = changed.probeRouteRequirements.candidates.find(g => `probe:${g.requirementId}` === target.planId);
  goal.moveTiming.forEach(t => { t.delayedMovementPoints = t.earlyMovementPoints; });
  assert.equal(continuation.planReuseCheck(plan, changed, f.legalActions).reason,
    "quick-timing-no-current-window");
  assert.equal(evaluator.allowsQuickActionTiming({ observation: changed,
    action: { family: "choose_payment", phase: "conditional", actorId: f.actorId } }), true);
  assert.equal(evaluator.allowsQuickActionTiming({ observation: changed,
    action: f.legalActions.find(a => a.family === "end_turn") }), true);
});

test("机会资源准备只补第一步缺口，已满足时不为未来终点囤资源", () => {
  const f = timingFixture;
  const target = f.rootTargets.find(t => t.planId.startsWith("probe:"));
  const observation = structuredClone(f.observation);
  const own = observation.publicState.players.find(p => p.playerId === f.actorId);
  own.energy = 0;
  own.credits = 2;
  const goal = observation.probeRouteRequirements.candidates.find(g => `probe:${g.requirementId}` === target.planId);
  assert.equal(goal.moveTiming[0].firstMovementPoints, 1);
  const trade = f.legalActions.find(a => a.family === "quick_trade" && a.target.tradeId === "credits-for-energy");
  assert(trade);
  const input = { observation, action: trade, legalActions: [trade],
    routeTargetId: target.targetId, routePlanId: target.planId };
  assert.equal(evaluator.allowsQuickActionTiming(input), true);
  own.energy = 1;
  goal.required.energy = 10;
  assert.equal(evaluator.allowsQuickActionTiming(input), false,
    "未来终点还缺能量不能成为当前窗口准备的理由");
  own.energy = 0;
  goal.moveTiming.forEach(t => { t.comparable = false; });
  assert.equal(evaluator.allowsQuickActionTiming(input), false,
    "没有窗口不能仅因资源不足放行交易");
});

test("扫描准备保留仍有效的扇区目标，不因填数据改做分析", () => {
  const f = timingFixture;
  const observation = structuredClone(f.observation);
  const candidate = observation.sectorWinRequirements.candidates[0];
  assert(candidate);
  observation.dataAnalyzeRequirements = { computerPlacedCount: 5, availableData: 4, nextStep: "place_data" };
  const own = observation.publicState.players.find(p => p.playerId === f.actorId);
  own.availableData = 4;
  own.dataProgress.computerSlots = [1, 2, 3, 4, 5];
  const input = { rootObservation: observation, branchObservation: observation,
    focalSeatId: f.actorId, currentAction: f.place,
    routeTargetId: candidate.targetId, routePlanId: `sector:standard-scan:${candidate.sectorId}` };
  assert.deepEqual(evaluator.selectSecondaryAgentRouteTarget(input),
    { targetId: input.routeTargetId, planId: input.routePlanId });
  assert.equal(evaluator.selectSecondaryAgentRouteTarget({ ...input, routeTargetId: null, routePlanId: null }),
    "data:analyze", "不在本步骤改变无绑定的数据启发式");
  observation.sectorWinRequirements.candidates = [];
  assert.equal(evaluator.selectSecondaryAgentRouteTarget(input), null,
    "已消失的结算目标不能被准备动作重新激活");
});

test("扫描根和绑定后继保留准备方案，池数据变化使准备计划失效", () => {
  const f = timingFixture;
  const observation = structuredClone(f.observation);
  const own = observation.publicState.players.find(p => p.playerId === f.actorId);
  own.mainActionCompleted = false;
  const scan = { family: "scan", phase: "main", actorId: f.actorId, actionId: "scan:capacity", target: {}, payload: {} };
  const legal = [scan, f.place];
  const target = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: observation,
    focalSeatId: f.actorId, legalActions: legal }).find(t => t.planId.startsWith("sector:standard-scan:"));
  assert(target);
  assert.deepEqual([...target.compatibleActionIds].sort(), legal.map(a => a.actionId).sort());
  const selected = evaluator.selectSecondaryAgentSuccessors({ branchObservation: observation,
    focalSeatId: f.actorId, legalSuccessors: legal, routeTargetId: target.targetId, routePlanId: target.planId });
  assert.deepEqual(selected.map(a => a.family).sort(), ["place_data", "scan"]);
  const steps = continuation.compilePlanSteps([{
    ...continuation.capturePlanStep({ observation, action: f.place }),
    routeTargetId: target.targetId, routePlanId: target.planId,
  }]);
  const plan = { schemaVersion: continuation.PLAN_SCHEMA_VERSION, nextActionId: f.place.actionId, steps };
  assert.equal(continuation.planReuseCheck(plan, observation, legal).hit, true);
  own.availableData += 1;
  assert.equal(continuation.planReuseCheck(plan, observation, legal).hit, false);
  assert.deepEqual(evaluator.selectSecondaryAgentSuccessors({ branchObservation: observation,
    focalSeatId: f.actorId, legalSuccessors: [scan], routeTargetId: target.targetId, routePlanId: target.planId })
    .map(a => a.family), ["scan"], "无合法放置时不得制造准备动作");
});

test("真实叶同收益优先少丢数据，再少步骤；不以防溢出压过较高收益", () => {
  const f = timingFixture;
  function observation(scoreDelta, discardedCount) {
    const source = structuredClone(f.observation);
    const own = source.publicState.players.find(p => p.playerId === f.actorId);
    own.score += scoreDelta;
    own.dataProgress.discardedCount = discardedCount;
    return outcomeModel.createDecisionObservation(source, { seatId: f.actorId });
  }
  const root = observation(0, 10);
  const leaf = (id, scoreDelta, wasted, steps) => ({ leafId: id, status: "settled",
    observation: observation(scoreDelta, 10 + wasted), executionStepCount: steps, terminalReason: "pass" });
  const leaves = [leaf("excess-preparation", 1, 0, 6), leaf("wasted-data", 1, 1, 3), leaf("needed-preparation", 1, 0, 4)];
  const context = { seatId: f.actorId, observation: root, legalActions: [f.place], actionOutcomes: [{
    schemaVersion: evaluator.OUTCOME_SCHEMA_VERSION, actionId: f.place.actionId,
    status: "settled", rootObservation: root, leaves,
  }] };
  const best = evaluator.evaluateOutcome(context, f.place);
  assert.equal(best.selectable, true);
  assert.equal(best.dataDiscardDelta, 0);
  assert.equal(best.executionStepCount, 4);
  assert.equal(best.primaryValue, 1, "避免丢数据不新增primary分");
  leaves.push(leaf("higher-score", 2, 2, 3));
  const higher = evaluator.evaluateOutcome(context, f.place);
  assert.equal(higher.primaryValue, 2);
  assert.equal(higher.dataDiscardDelta, 2, "只比较根叶增量，历史10个丢弃不重复计入");
  assert.equal(higher.sortKey[1], -2, "最终动作排序与叶排序使用相同损失顺序");
});

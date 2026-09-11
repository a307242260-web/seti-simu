"use strict";

const assert = require("node:assert/strict");
const { createMachinePlayerCoordinator } = require("./machine-player-coordinator");
const plans = require("./plan-continuation");

function makeDescriptor(actionId, family = "move", target = {}) {
  return { schemaVersion: "seti-standard-action-v1", actionId, family, phase: "main", actorId: "p1", stateVersion: 1, decisionVersion: 1, target, payload: {} };
}

function makeState(round = 1, turn = 1) {
  return {
    publicState: {
      roundNumber: round, turnNumber: turn,
      players: [{ playerId: "p1", dataProgress: { computerDataSlots: [] } }],
      board: { planets: { planets: {} }, aliens: { slots: [{ slotId: 1, revealed: false }] },
        publicCards: [], techSupply: { stacks: {
          blue1: { tileId: "blue1", remaining: 4, depleted: false },
        } } },
    },
    selfState: { playerId: "p1", hand: [] },
    perspectivePlayerId: "p1",
  };
}

// 窄协调器契约：通过正式计划采集/编译接口提供逐步证据，不伪造旧 generic 依赖。
function makePlan(actions, observation = makeState(), routeTargetId = null) {
  const steps = plans.compilePlanSteps(actions.map((action) => ({
    ...plans.capturePlanStep({ action, observation }),
    goalDepth: 0, routeTargetId, routePlanId: null,
  })));
  return { schemaVersion: plans.PLAN_SCHEMA_VERSION, nextActionId: steps[0].actionId, steps };
}

function makeComposition(legalActions) {
  return {
    inspect: () => ({ phase: "idle", session: null }),
    inputPort: { enumerateActions: () => legalActions },
    projection: () => ({ state: makeState() }),
  };
}

function makeCoordinator(legalActions, execute = () => ({ ok: true })) {
  return createMachinePlayerCoordinator({
    composition: makeComposition(legalActions),
    execute,
    onDiagnostic: () => {},
  });
}

// 方案路径：注册决策函数 -> runDecision -> 执行 + 输出 { actionId, plan, source: "scheme" }
{
  const legal = [makeDescriptor("a"), makeDescriptor("b")];
  const coordinator = makeCoordinator(legal);
  const executed = [];
  coordinator.registerSeat("p1", (boundary) => {
    assert.equal(boundary.legalActions, legal, "决策函数必须收到协调器读出的合法集");
    return { actionId: "a", plan: makePlan([makeDescriptor("b")]) };
  });
  const result = coordinator.runDecision("p1", { reuseEnabled: false });
  assert.equal(result.source, "scheme");
  assert.equal(result.actionId, "a");
  assert.equal(result.plan.nextActionId, "b", "方案输出的完整计划必须随决策返回");
}

// 复用路径：上次方案输出 plan -> 下次 runDecision 命中复用（多步消费）
{
  const coordinator = makeCoordinator([makeDescriptor("a"), makeDescriptor("b")]);
  let calls = 0;
  coordinator.registerSeat("p1", () => {
    calls += 1;
    return { actionId: "a", plan: makePlan([makeDescriptor("b"), makeDescriptor("c")]) };
  });
  const first = coordinator.runDecision("p1", { reuseEnabled: true });
  assert.equal(first.source, "scheme", "首次无计划必须走方案");
  assert.equal(calls, 1);
  // 第二次决策：合法集含 b，逐步证据未变 -> 复用命中，计划前进到 c
  const second = coordinator.runDecision("p1", { reuseEnabled: true });
  assert.equal(second.source, "plan-reuse", "盘面未变必须复用上次计划");
  assert.equal(second.actionId, "b");
  assert.equal(second.plan.nextActionId, "c", "复用后计划必须前进一步");
  assert.equal(calls, 1, "复用命中不得调用决策函数");
}

// recordStep 记账钩子：execute 成功后调用（方案路径与复用路径都走），
// 传入 (action, executed, ctx)；未注入时为空操作。
{
  const recorded = [];
  const coordinator = createMachinePlayerCoordinator({
    composition: makeComposition([makeDescriptor("a"), makeDescriptor("b")]),
    execute: () => ({ ok: true }),
    onDiagnostic: () => {},
    recordStep: (action, executed, ctx) => {
      recorded.push({ actionId: action.actionId, ok: executed.ok, seatId: ctx.seatId });
    },
  });
  coordinator.registerSeat("p1", () => ({
    actionId: "a",
    plan: makePlan([makeDescriptor("b")]),
  }));
  const first = coordinator.runDecision("p1", { reuseEnabled: true });
  assert.equal(first.source, "scheme");
  const second = coordinator.runDecision("p1", { reuseEnabled: true });
  assert.equal(second.source, "plan-reuse");
  assert.deepEqual(recorded.map((entry) => entry.actionId), ["a", "b"], "execute 成功后每次决策都补记一步");
  assert.equal(recorded.every((entry) => entry.ok === true && entry.seatId === "p1"), true);
}

// 同回合/跨回合都检查逐步证据；回合门控只控制跨回合复用实验开关。
{
  const makeTurnCoordinator = (projection, execute = () => ({ ok: true })) => (
    createMachinePlayerCoordinator({
      composition: {
        inspect: () => ({ phase: "idle", session: null }),
        inputPort: { enumerateActions: () => [makeDescriptor("a"), makeDescriptor("b"), makeDescriptor("end_turn:e", "end_turn")] },
        projection,
      },
      execute,
      onDiagnostic: () => {},
    })
  );
  // 本回合内：scheme 一次后，后续决策全部复用计划（含 end_turn），不搜索
  {
    const coordinator = makeTurnCoordinator(() => ({ state: makeState(1, 1) }));
    let calls = 0;
    coordinator.registerSeat("p1", () => {
      calls += 1;
      return { actionId: "a", plan: makePlan([makeDescriptor("b"), makeDescriptor("end_turn:e", "end_turn")]) };
    });
    const first = coordinator.runDecision("p1", { reuseEnabled: true });
    assert.equal(first.source, "scheme");
    assert.equal(first.actionId, "a");
    const second = coordinator.runDecision("p1", { reuseEnabled: true });
    assert.equal(second.source, "plan-reuse", "本回合内第二步必须复用计划");
    assert.equal(second.actionId, "b");
    const third = coordinator.runDecision("p1", { reuseEnabled: true });
    assert.equal(third.source, "plan-reuse", "本回合内 end_turn 也是计划内步骤，必须复用（回合自然结束，非新信息）");
    assert.equal(third.actionId, "end_turn:e");
    assert.equal(calls, 1, "本回合内复用不得调用决策函数（搜索只在一动开始执行）");
    // 计划耗尽 → 新决策
    const fourth = coordinator.runDecision("p1", { reuseEnabled: true });
    assert.equal(fourth.source, "scheme", "计划耗尽必须重新决策");
    assert.equal(calls, 2);
  }
  // 新回合：盘面无新信息 → 复用上回合决策链（planReuseCheck 判定）
  {
    const states = [makeState(1, 1), makeState(1, 2), makeState(1, 2)];
    let index = 0;
    const coordinator = makeTurnCoordinator(() => ({ state: states[Math.min(index, states.length - 1)] }));
    let calls = 0;
    coordinator.registerSeat("p1", () => {
      calls += 1;
      return { actionId: "a", plan: makePlan([makeDescriptor("b")]) };
    });
    const first = coordinator.runDecision("p1", { reuseEnabled: true }); // T1: scheme
    assert.equal(first.source, "scheme");
    index = 1;
    const second = coordinator.runDecision("p1", { reuseEnabled: true }); // T2: 新回合，无新信息 → 复用
    assert.equal(second.source, "plan-reuse", "新回合盘面无新信息必须复用上回合决策链");
    assert.equal(second.actionId, "b");
    assert.equal(calls, 1, "新回合无新信息不得重新搜索");
  }
  // 新回合：依赖环节变化（新信息）→ 重新决策
  {
    const states = [makeState(1, 1), makeState(1, 2)];
    states[1].publicState.board.techSupply.stacks.blue1.remaining = 3;
    let index = 0;
    const coordinator = makeTurnCoordinator(() => ({ state: states[Math.min(index, states.length - 1)] }));
    let calls = 0;
    coordinator.registerSeat("p1", () => {
      calls += 1;
      return { actionId: "a", plan: makePlan([makeDescriptor("b")], states[index], "tech:gain:blue1") };
    });
    const first = coordinator.runDecision("p1", { reuseEnabled: true }); // T1: scheme
    assert.equal(first.source, "scheme");
    index = 1;
    const second = coordinator.runDecision("p1", { reuseEnabled: true }); // T2: 科技被拿走 → 新信息 → 重新决策
    assert.equal(second.source, "scheme", "新回合依赖环节变化（科技被拿走）必须重新决策");
    assert.equal(calls, 2);
  }
  // 开关：newTurnReuseEnabled=false → 新回合一律重新搜索（用于评估忽略非依赖变化的影响）
  {
    const states = [makeState(1, 1), makeState(1, 2)];
    let index = 0;
    const coordinator = makeTurnCoordinator(() => ({ state: states[Math.min(index, states.length - 1)] }));
    let calls = 0;
    coordinator.registerSeat("p1", () => {
      calls += 1;
      return { actionId: "a", plan: makePlan([makeDescriptor("b")]) };
    });
    const first = coordinator.runDecision("p1", { reuseEnabled: true, newTurnReuseEnabled: false }); // T1: scheme
    assert.equal(first.source, "scheme");
    index = 1;
    const second = coordinator.runDecision("p1", { reuseEnabled: true, newTurnReuseEnabled: false }); // T2: 开关关 → 新回合重搜
    assert.equal(second.source, "scheme", "newTurnReuseEnabled=false 时新回合必须重新搜索");
    assert.equal(calls, 2, "开关关时新回合不得复用计划");
  }
}

// 同回合揭示/具名依赖改变也要重新决策；旧证据不能靠合法性旁路继续执行。
for (const change of ["reveal", "dependency", "old-plan"]) {
  const state = makeState();
  const legal = [makeDescriptor("a"), makeDescriptor("b")];
  const diagnostics = [];
  let calls = 0;
  const coordinator = createMachinePlayerCoordinator({
    composition: { ...makeComposition(legal), projection: () => ({ state }) },
    execute: () => ({ ok: true }),
    onDiagnostic: (type, details) => diagnostics.push({ type, ...details }),
  });
  coordinator.registerSeat("p1", () => {
    calls += 1;
    return { actionId: "a", plan: change === "old-plan"
      ? { nextActionId: "b", continuation: ["b"], dependency: { kind: "generic" }, revealedCount: 0 }
      : makePlan([legal[1]], state, "tech:gain:blue1") };
  });
  coordinator.runDecision("p1");
  if (change === "reveal") state.publicState.board.aliens.slots[0].revealed = true;
  if (change === "dependency") state.publicState.board.techSupply.stacks.blue1.remaining = 3;
  assert.equal(coordinator.runDecision("p1").source, "scheme", change);
  assert.equal(calls, 2);
  assert.equal(diagnostics.at(-2).reason, {
    reveal: "alien-revealed", dependency: "next-step-affected", "old-plan": "plan-step-evidence-missing",
  }[change]);
}

// 省略 seatId 时仍归属解析出的 owner；失败提交不消费计划，reset 清空瞬态计划。
{
  let reject = false;
  let calls = 0;
  const coordinator = makeCoordinator([makeDescriptor("a"), makeDescriptor("b")], () => (
    reject ? { ok: false, error: "rejected" } : { ok: true }
  ));
  coordinator.registerSeat("p1", () => {
    calls += 1;
    return { actionId: "a", plan: makePlan([makeDescriptor("b")]) };
  });
  coordinator.runDecision();
  reject = true;
  assert.throws(() => coordinator.runDecision("p1"), /EXECUTE_FAILED/);
  reject = false;
  assert.equal(coordinator.runDecision("p1").actionId, "b");
  assert.equal(calls, 1);
  coordinator.resetPlans();
  assert.equal(coordinator.runDecision("p1").source, "scheme");
}

// 失败即抛错（铁律）：
{
  // 未注册决策函数
  const coordinator = makeCoordinator([makeDescriptor("a")]);
  assert.throws(() => coordinator.runDecision("p1", { reuseEnabled: false }), /DECISION_FUNCTION_MISSING/);

  // 决策函数返回非法 actionId
  const bad = makeCoordinator([makeDescriptor("a")]);
  bad.registerSeat("p1", () => ({ actionId: "not-in-legal" }));
  assert.throws(() => bad.runDecision("p1", { reuseEnabled: false }), /DECISION_ILLEGAL/);

  // 决策函数未返回 actionId
  const empty = makeCoordinator([makeDescriptor("a")]);
  empty.registerSeat("p1", () => ({}));
  assert.throws(() => empty.runDecision("p1", { reuseEnabled: false }), /DECISION_INVALID/);

  // 决策函数抛错
  const throwing = makeCoordinator([makeDescriptor("a")]);
  throwing.registerSeat("p1", () => { throw new Error("boom"); });
  assert.throws(() => throwing.runDecision("p1", { reuseEnabled: false }), /DECISION_FAILED:.*boom/);

  // 执行失败
  const failing = makeCoordinator([makeDescriptor("a")], () => ({ ok: false, error: "submit rejected" }));
  failing.registerSeat("p1", () => ({ actionId: "a" }));
  assert.throws(() => failing.runDecision("p1", { reuseEnabled: false }), /EXECUTE_FAILED:.*submit rejected/);

  // 空合法集
  const emptyLegal = makeCoordinator([]);
  emptyLegal.registerSeat("p1", () => ({ actionId: "a" }));
  assert.throws(() => emptyLegal.runDecision("p1", { reuseEnabled: false }), /BOUNDARY_EMPTY/);
}

process.stdout.write("machine-player-coordinator.test.js ok\n");

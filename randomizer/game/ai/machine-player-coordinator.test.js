"use strict";

const assert = require("node:assert/strict");
const { createMachinePlayerCoordinator } = require("./machine-player-coordinator");

function makeDescriptor(actionId, family = "move", target = {}) {
  return { schemaVersion: "seti-standard-action-v1", actionId, family, phase: "main", actorId: "p1", stateVersion: 1, decisionVersion: 1, target, payload: {} };
}

function makeComposition(legalActions) {
  return {
    inspect: () => ({ phase: "idle", session: null }),
    inputPort: { enumerateActions: () => legalActions },
    projection: () => ({ state: {} }),
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
    return { actionId: "a", plan: { nextActionId: "b", continuation: ["b"], dependency: { kind: "generic" }, revealedCount: 0 } };
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
    return { actionId: "a", plan: { nextActionId: "b", continuation: ["b", "c"], dependency: { kind: "generic" }, revealedCount: 0 } };
  });
  const first = coordinator.runDecision("p1", { reuseEnabled: true });
  assert.equal(first.source, "scheme", "首次无计划必须走方案");
  assert.equal(calls, 1);
  // 第二次决策：合法集含 b，generic 依赖不变 -> 复用命中，计划前进到 c
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
    plan: { nextActionId: "b", continuation: ["b"], dependency: { kind: "generic" }, revealedCount: 0 },
  }));
  const first = coordinator.runDecision("p1", { reuseEnabled: true });
  assert.equal(first.source, "scheme");
  const second = coordinator.runDecision("p1", { reuseEnabled: true });
  assert.equal(second.source, "plan-reuse");
  assert.deepEqual(recorded.map((entry) => entry.actionId), ["a", "b"], "execute 成功后每次决策都补记一步");
  assert.equal(recorded.every((entry) => entry.ok === true && entry.seatId === "p1"), true);
}

// 回合门控（机制）：本回合内按计划走（不搜索，end_turn 也复用）；
// 新回合走 planReuseCheck（无新信息复用，有新信息重新决策）。
{
  const makeState = (round, turn) => ({
    publicState: { roundNumber: round, turnNumber: turn, board: {} },
    selfState: null,
    perspectivePlayerId: "p1",
  });
  const makeTurnCoordinator = (projection, execute = () => ({ ok: true })) => (
    createMachinePlayerCoordinator({
      composition: {
        inspect: () => ({ phase: "idle", session: null }),
        inputPort: { enumerateActions: () => [makeDescriptor("a"), makeDescriptor("b"), makeDescriptor("end_turn:e")] },
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
      return { actionId: "a", plan: { nextActionId: "b", continuation: ["b", "end_turn:e"], dependency: { kind: "generic" }, revealedCount: 0 } };
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
      return { actionId: "a", plan: { nextActionId: "b", continuation: ["b"], dependency: { kind: "generic" }, revealedCount: 0 } };
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
    let index = 0;
    const coordinator = makeTurnCoordinator(() => ({ state: states[Math.min(index, states.length - 1)] }));
    let calls = 0;
    coordinator.registerSeat("p1", () => {
      calls += 1;
      // 首次生成计划（依赖科技 blue1 remaining 4）；T2 重算时 remaining 变 3 → 依赖变化
      const state = states[Math.min(index, 1)];
      const stack = state === states[1]
        ? { blue1: { tileId: "blue1", bonusId: "bonus_1c", remaining: 3, depleted: false } }
        : { blue1: { tileId: "blue1", bonusId: "bonus_1c", remaining: 4, depleted: false } };
      state.publicState.board.techSupply = { stacks: stack };
      return { actionId: "a", plan: { nextActionId: "b", continuation: ["b"], dependency: { kind: "tech", tileId: "blue1", present: true, bonusId: "bonus_1c", remaining: 4 }, revealedCount: 0 } };
    });
    const first = coordinator.runDecision("p1", { reuseEnabled: true }); // T1: scheme
    assert.equal(first.source, "scheme");
    index = 1;
    const second = coordinator.runDecision("p1", { reuseEnabled: true }); // T2: 科技被拿走 → 新信息 → 重新决策
    assert.equal(second.source, "scheme", "新回合依赖环节变化（科技被拿走）必须重新决策");
    assert.equal(calls, 2);
  }
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

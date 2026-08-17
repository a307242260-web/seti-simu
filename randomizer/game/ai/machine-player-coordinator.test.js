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

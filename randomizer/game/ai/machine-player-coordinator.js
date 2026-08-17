"use strict";

/**
 * 机器人玩家协调器（Machine Player Coordinator）。
 *
 * Browser 与 Simulation 共用的机器人决策编排（架构见 docs/ai-design.md §1）：
 *
 *   ① AI 类型：席位注册表——seatId -> 决策函数（heuristic/learned 实现同一
 *      `(ctx) => ({ actionId, plan? })` 接口，可插拔）；
 *   ② 行动时读公共信息：裸调共享 composition 的 inspect / inputPort.enumerateActions /
 *      projection（唯一一份实现，不包壳），observation 直接
 *      createDecisionObservation(projection.state)（一份实现，零训练包装）；
 *   ③ 复用判断：planReuseCheck 上次方案输出的 plan，命中直接复用（多步消费）；
 *   ④ 未命中调用决策函数；
 *   ⑤ 输出决策：{ actionId, plan? }，plan 存回供下一次复用判断；
 *   ⑥ 执行：注入的 execute(action) 提交（合法集/authority 重验在 execute 内）。
 *
 * 错误语义（铁律）：失败就失败，直接抛错，绝不静默降级——决策函数未注册 /
 * 抛错 / 返回无 actionId / actionId 不在合法集 / execute 返回 !ok，一律 throw。
 * 复用判定返回 miss（no-plan / step-not-legal / 揭示基线不足 / 依赖失效）是正常
 * 控制流，落到决策函数重新决策，不算错误。
 */

const planContinuation = require("./plan-continuation");
const outcomeModel = require("./outcome-model");

function createMachinePlayerCoordinator(options = {}) {
  const composition = options.composition;
  const execute = options.execute;
  const onDiagnostic = options.onDiagnostic;
  if (!composition?.inspect || !composition?.inputPort?.enumerateActions
    || typeof composition?.projection !== "function") {
    throw new TypeError("Machine Player Coordinator 需要共享 Rule Composition（inspect/inputPort.enumerateActions/projection）");
  }
  if (typeof execute !== "function") {
    throw new TypeError("Machine Player Coordinator 需要 execute(action)");
  }

  // 决策观测：一份实现——composition.projection(viewer).state 已是 viewer-safe
  // 观察（含 publicState/selfState/requirements），直接喂 createDecisionObservation，
  // 不经过任何训练观察包装（Browser/Simulation 同一份）。
  function createObservation(projection, seatId, legalActions) {
    return outcomeModel.createDecisionObservation(projection?.state || projection, {
      seatId,
      stateVersion: legalActions[0]?.stateVersion ?? null,
      decisionVersion: legalActions[0]?.decisionVersion ?? null,
    });
  }

  const decisionFunctions = new Map(); // seatId -> (ctx) => ({ actionId, plan? })  ← ① AI 类型注册表
  const planStores = new Map();        // seatId -> plan（上次方案输出的完整计划，供复用判断）

  function record(type, details = {}) {
    if (typeof onDiagnostic === "function") onDiagnostic(type, details);
  }

  function registerSeat(seatId, decisionFunction) {
    if (typeof decisionFunction !== "function") {
      throw new TypeError(`座位 ${seatId} 的决策函数不可调用`);
    }
    decisionFunctions.set(seatId, decisionFunction);
  }

  function hasSeat(seatId) {
    return decisionFunctions.has(seatId);
  }

  // ② 读公共信息：唯一一份实现，裸调共享 composition，不包壳。
  // awaiting_input（条件决策）时合法集来自 session.decision.choices，与
  // simulation/browser 既有读取一致；否则 enumerateActions 原生形状。
  // seatId 为空时从当前合法集解析决策 owner（与旧 legalActions[0].actorId 同源）。
  function readBoundary(seatId) {
    const inspection = composition.inspect();
    const legalActions = (inspection.phase === "awaiting_input" && inspection.session?.decision)
      ? (inspection.session.decision.choices || [])
      : composition.inputPort.enumerateActions({});
    if (!Array.isArray(legalActions) || !legalActions.length) {
      throw new Error(`MACHINE_PLAYER_BOUNDARY_EMPTY: 座位 ${seatId || "?"} 没有合法候选`);
    }
    const resolvedSeatId = seatId
      || legalActions[0]?.actorId
      || inspection.session?.decision?.ownerId
      || null;
    if (!resolvedSeatId) {
      throw new Error("MACHINE_PLAYER_BOUNDARY_NO_OWNER: 合法候选缺少决策 owner");
    }
    const viewer = { viewerId: `machine:${resolvedSeatId}`, playerId: resolvedSeatId, role: "player" };
    const projection = composition.projection(viewer);
    const observation = createObservation(projection, resolvedSeatId, legalActions);
    return Object.freeze({
      seatId: resolvedSeatId,
      legalActions,
      observation,
      phase: inspection.phase || "idle",
      sessionDecision: inspection.session?.decision || null,
    });
  }

  // ③⑤⑥ 一次机器人决策：读边界 -> 复用判断 -> （未命中调决策函数）-> 输出 -> 执行。
  // runOptions.reuseEnabled = false 时跳过复用判断，直接调用决策函数。
  function runDecision(seatId, runOptions = {}) {
    const reuseEnabled = runOptions.reuseEnabled !== false;
    const boundary = readBoundary(seatId);
    const resolvedSeatId = boundary.seatId;
    const decisionFunction = decisionFunctions.get(resolvedSeatId);
    if (!decisionFunction) {
      throw new Error(`MACHINE_PLAYER_DECISION_FUNCTION_MISSING: 座位 ${resolvedSeatId} 未注册决策函数`);
    }

    let action;
    let plan;
    let decision = null;
    if (reuseEnabled) {
      const storedPlan = planStores.get(seatId) || null;
      const reuse = planContinuation.planReuseCheck(
        storedPlan,
        boundary.observation,
        boundary.legalActions,
      );
      if (reuse.hit) {
        action = reuse.action;
        plan = reuse.nextPlan;
        record("plan-reuse-hit", { seatId, actionId: action.actionId });
      } else {
        record("plan-reuse-miss", { seatId, reason: reuse.reason });
      }
    }
    if (!action) {
      try {
        decision = decisionFunction(boundary);
      } catch (error) {
        throw new Error(
          `MACHINE_PLAYER_DECISION_FAILED: 座位 ${seatId} 决策函数抛错: ${error?.message || String(error)}`,
        );
      }
      if (!decision || typeof decision.actionId !== "string" || !decision.actionId) {
        throw new Error(
          `MACHINE_PLAYER_DECISION_INVALID: 座位 ${seatId} 决策函数未返回 actionId`,
        );
      }
      action = boundary.legalActions.find((candidate) => (
        String(candidate?.actionId) === String(decision.actionId)
      ));
      if (!action) {
        throw new Error(
          `MACHINE_PLAYER_DECISION_ILLEGAL: 座位 ${seatId} 决策函数返回非法 actionId ${decision.actionId}`,
        );
      }
      plan = decision.plan ?? null;
      record("scheme-decision", { seatId, actionId: action.actionId });
    }

    // ⑤ 输出决策（含 plan，供下一次复用判断）；⑥ 执行。
    const executed = execute(action);
    if (!executed || executed.ok !== true) {
      throw new Error(
        `MACHINE_PLAYER_EXECUTE_FAILED: 座位 ${seatId} 执行决策 ${action.actionId} 失败: `
        + `${executed?.error || executed?.message || "unknown"}`,
      );
    }
    if (plan?.nextActionId) {
      planStores.set(seatId, plan);
    } else {
      planStores.delete(seatId);
    }
    return Object.freeze({
      seatId: resolvedSeatId,
      actionId: action.actionId,
      action,
      plan,
      decision,
      executed,
      source: decision ? "scheme" : "plan-reuse",
    });
  }

  // 清空计划 store（reset/loadCheckpoint 时调用；决策函数注册表保留）。
  function resetPlans() {
    planStores.clear();
  }

  return Object.freeze({
    registerSeat,
    hasSeat,
    runDecision,
    resetPlans,
    readBoundary,
  });
}

module.exports = Object.freeze({
  createMachinePlayerCoordinator,
});

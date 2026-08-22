(function (root, factory) {
  "use strict";

  let planContinuation = root.SetiPlanContinuation;
  let outcomeModel = root.SetiOutcomeModel;
  if ((!planContinuation || !outcomeModel) && typeof require === "function") {
    planContinuation = planContinuation || require("./plan-continuation");
    outcomeModel = outcomeModel || require("./outcome-model");
  }
  const api = factory(planContinuation, outcomeModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiMachinePlayerCoordinator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (planContinuation, outcomeModel) {
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
 *   ⑥ 执行：注入的 execute(action) 提交（合法集/authority 重验在 execute 内）；
 *   ⑦ 记账：注入的 recordStep(action, executed, ctx) 钩子——提交成功后调用，
 *      sim 训练补记 replay/reward（原生 action，不做形状转换），browser 空操作。
 *
 * 错误语义（铁律）：失败就失败，直接抛错，绝不静默降级——决策函数未注册 /
 * 抛错 / 返回无 actionId / actionId 不在合法集 / execute 返回 !ok，一律 throw。
 * 复用判定返回 miss（no-plan / step-not-legal / 揭示基线不足 / 依赖失效）是正常
 * 控制流，落到决策函数重新决策，不算错误。
 */


function createMachinePlayerCoordinator(options = {}) {
  const composition = options.composition;
  const execute = options.execute;
  const onDiagnostic = options.onDiagnostic;
  const recordStep = options.recordStep;
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
  //
  // 复用机制（用户口径，docs/mechanics-reference.md 名词定义）：
  //   - 本回合（turn，玩家每一次主要行动圈）内无新信息 → 按计划逐步骤执行，不重新搜索；
  //   - 新回合：盘面无新信息变化 → 复用上回合决策链（planReuseCheck 的依赖/揭示基线判定），
  //     有新信息 → 重新搜索；
  //   - 回合内出现新信息需重新决策 → TODO（暂不实现，本回合内始终按计划走）。
  // 搜索只发生在：无计划 / 计划耗尽 / 下一步不在合法集 / 新回合 planReuseCheck 未命中。
  function turnOf(observation) {
    const publicState = observation?.publicState || {};
    const round = publicState.roundNumber;
    const turn = publicState.turnNumber;
    if (!Number.isInteger(round) || !Number.isInteger(turn)) return null;
    return { round, turn };
  }

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
    const currentTurn = turnOf(boundary.observation);
    if (reuseEnabled) {
      const stored = planStores.get(seatId) || null;
      const sameTurn = Boolean(stored?.turn && currentTurn
        && stored.turn.round === currentTurn.round
        && stored.turn.turn === currentTurn.turn);
      if (stored?.plan?.nextActionId) {
        if (sameTurn) {
          // 本回合内：无新信息，直接按计划下一步走（不重新搜索；回合内新信息
          // 重新决策 TODO，暂不实现）。
          const current = boundary.legalActions.find((candidate) => (
            String(candidate?.actionId) === String(stored.plan.nextActionId)
          ));
          if (current) {
            action = current;
            plan = planContinuation.advancePlan(stored.plan);
            record("plan-reuse-hit", { seatId, actionId: action.actionId });
          } else {
            record("plan-reuse-miss", { seatId, reason: "step-not-legal-within-turn" });
          }
        } else {
          // 新回合：盘面无新信息则复用上回合决策链（planReuseCheck 依赖/揭示基线判定），
          // 有新信息 → 重新搜索。newTurnReuseEnabled=false 时新回合一律重新搜索——
          // 用于 A/B 评估"忽略非依赖变化（对手移动/资源/旋转等）而复用"的影响。
          if (runOptions.newTurnReuseEnabled !== false) {
            const reuse = planContinuation.planReuseCheck(
              stored.plan,
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
          } else {
            record("plan-reuse-miss", { seatId, reason: "new-turn-reuse-disabled" });
          }
        }
      } else {
        record("plan-reuse-miss", { seatId, reason: stored ? "no-plan-step" : "no-plan" });
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

    // ⑤ 输出决策（含 plan，供下一次复用判断）；⑥ 执行；⑦ recordStep 记账钩子
    // （提交成功后调用；sim 训练补记 replay/reward，browser 空操作）。
    const executed = execute(action);
    if (!executed || executed.ok !== true) {
      throw new Error(
        `MACHINE_PLAYER_EXECUTE_FAILED: 座位 ${seatId} 执行决策 ${action.actionId} 失败: `
        + `${executed?.error || executed?.message || "unknown"}`,
      );
    }
    if (typeof recordStep === "function") {
      recordStep(action, executed, { seatId, boundary });
    }
    if (plan?.nextActionId) {
      // 计划连同其所属回合（turn）一起存储：本回合内按计划走，新回合重新判定。
      planStores.set(seatId, { plan, turn: currentTurn });
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

  return Object.freeze({
    createMachinePlayerCoordinator,
  });
});

"use strict";
// 新 V 引导搜索（基于可回退 fork 原语，与旧目标体系完全解耦）：
// 对每个合法动作：fork 一个分支 → 真实规则执行 2-4 步到"状态稳定点" →
// 丢弃分支（root 不变）→ 用 V(state) 评估叶价值。
// 搜索策略：
//   1. 每个动作 fork 执行到主行动完成 + 关键决策落定（depth 2-4）
//   2. 叶价值 = 实际分Δ + V(leaf) - V(root)（V 编码长线：收入/科技/外星/手牌）
//   3. 选总价值最高动作
// 预算：每个动作固定 fork 数（1），深度可控，无搜索树/支配/目标路由。
const outcomeModel = require("/Users/bilibili/code/seti-simu/randomizer/game/ai/outcome-model");
const ev = require("/Users/bilibili/code/seti-simu/randomizer/game/ai/expected-score-evaluator");

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// 在 fork 中执行一个动作（返回 ok/错误）
// fork 枚举的 action 自带正确 stateVersion/decisionVersion（fork 内 enumerateActions
// 产出标准 descriptor），直接使用；fork 的 projection 返回 observation（无 stateVersion
// 字段），不从 projection 推断。
function forkSubmit(comp, action) {
  const ins = comp.inspect();
  if (ins.phase !== "awaiting_input") {
    return action.phase === "quick"
      ? comp.inputPort.submitQuickAction(action)
      : comp.inputPort.submitAction(action);
  }
  return comp.inputPort.submitDecision({
    decisionId: ins.session.decision.decisionId,
    decisionVersion: ins.session.decision.decisionVersion,
    ownerId: ins.session.decision.ownerId,
    choice: action,
  });
}

// 在 fork 中推进 N 步：执行动作后若进入条件决策，取第一个可选项继续
// 直到：a) 达到 maxDepth  b) 进入新一轮主行动选择 c) 失败
// 注意：fork 的动作必须用 fork 自己枚举的（标准 schema），不能用 env 的
// （决策路径统一用共享 inputPort 的原生 schema）。
function forkAdvance(comp, startAction, maxDepth, seatId) {
  const trace = [];
  let action = startAction;
  for (let step = 0; step < maxDepth; step += 1) {
    // 枚举 fork 当前合法动作（标准 schema）
    let forkActions = [];
    try {
      forkActions = comp.inputPort.enumerateActions({})
        .filter((a) => a.phase !== "conditional");
    } catch (_e) {
      forkActions = [];
    }
    if (!forkActions.length) break;
    // 找匹配要执行的动作（优先同 actionId，其次同 family，否则第一个非 control）
    const target = (action && forkActions.find((a) => a.actionId === action?.actionId))
      || (action && forkActions.find((a) => a.family === action?.family))
      || forkActions.find((a) => !["end_turn", "pass"].includes(a.family))
      || forkActions[0];
    if (!target) break;
    const r = forkSubmit(comp, target);
    trace.push({ family: target.family, ok: Boolean(r?.ok), code: r?.failure?.code || r?.code });
    if (!r?.ok) break;
    // 若进入 awaiting_input（条件决策），取第一个 choice 继续
    const ins = comp.inspect();
    if (ins.phase === "awaiting_input") {
      const d = ins.session.decision;
      const choice = d.choices.find((c) => !c.disabledReason) || d.choices[0];
      if (!choice) break;
      const cr = comp.inputPort.submitDecision({
        decisionId: d.decisionId,
        decisionVersion: d.decisionVersion,
        ownerId: d.ownerId,
        choice,
      });
      trace.push({ family: "decision", ok: Boolean(cr?.ok), code: cr?.failure?.code || cr?.code });
      if (!cr?.ok) break;
    }
    // 到达新主行动选择 = 状态稳定点（本玩家主行动完成）
    const proj = comp.projection();
    const currentActor = proj.state.turn?.currentPlayerId;
    if (currentActor !== seatId) break;
    action = null; // 下一轮选任意（同一主行动内的连续动作）
  }
  return trace;
}

// 评估单个动作：fork 执行到状态稳定，返回 V 增量 + 实际分Δ
function evaluateActionWithFork(env, action, rootEnvelope, seatId, authority, params, options = {}) {
  const maxDepth = Math.max(1, Number(options.maxDepth) || 4);
  const rootObservation = options.rootObservation; // env 当前标准 observation
  const fork = env.createCounterfactualFork(rootEnvelope, {
    branchKey: `vsearch-${action.actionId}`,
  });
  const comp = fork.composition || fork;
  try {
    const trace = forkAdvance(comp, action, maxDepth, seatId);
    // fork 的 projection 返回 observation（publicState/selfState/decision 结构，
    // production-kernel 的 projectCounterfactualState 配置），不是 committed state。
    const obs = comp.projection().state;
    const publicState = obs?.publicState || obs;
    const leafStd = outcomeModel.createDecisionObservation(publicState, {
      seatId,
      stateVersion: authority?.stateVersion ?? null,
      decisionVersion: authority?.decisionVersion ?? null,
    });
    const leafV = ev.evaluateStateValue(leafStd, seatId, params).total;
    const leafState = ev.evaluateState(leafStd, seatId);
    let actual = 0;
    let rootV = 0;
    if (rootObservation) {
      const rootStd = outcomeModel.createDecisionObservation(rootObservation, {
        seatId,
        stateVersion: authority?.stateVersion ?? null,
        decisionVersion: authority?.decisionVersion ?? null,
      });
      rootV = ev.evaluateStateValue(rootStd, seatId, params).total;
      const rootState = ev.evaluateState(rootStd, seatId);
      actual = leafState.realizedScore - rootState.realizedScore;
    }
    const vDelta = leafV - rootV;
    return {
      actionId: action.actionId,
      family: action.family,
      total: actual + vDelta,
      vDelta,
      actual,
      trace,
      ok: true,
    };
  } finally {
    try { comp.dispose?.(); } catch (_e) { /* fork 清理失败不影响 */ }
  }
}

module.exports = { forkSubmit, forkAdvance, evaluateActionWithFork };

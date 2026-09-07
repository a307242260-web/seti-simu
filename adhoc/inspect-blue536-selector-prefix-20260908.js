"use strict";
// 在已保存旧优胜路径上核对筛选器，不运行搜索；遇隐藏信息屏障立即停止，
// 避免用未遮蔽的正式重放状态冒充搜索观察。cwd 必须为图灵候选 worktree。
const fs = require("node:fs"), assert = require("node:assert/strict");
const req = require("node:module").createRequire(process.cwd() + "/adhoc/selector536.js");
const { createSimulationEnv } = req("../randomizer/app/simulation-env");
const evaluator = req("../randomizer/game/ai/expected-score-evaluator");
const parent = require("/private/tmp/seti-borrowed-probe-cache-20260908/randomizer/game/ai/expected-score-evaluator");
const continuation = req("../randomizer/game/ai/plan-continuation");
const base = "/Users/bilibili/code/seti-simu/reports/iteration/";
const output = base + "blue536-selector-prefix-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const report = { passed: false, checks: [], scope: "旧路径的隐藏屏障前逐步准入；不证明beam与调度保留" };
let env, fork;
try {
  const old = JSON.parse(fs.readFileSync(base + "blue536-turing-baseline-20260908.json"));
  const steps = old.leaf.planSteps, chain = old.leaf.actionChain;
  const viewer = { playerId: "player-blue", role: "player" };
  env = createSimulationEnv();
  env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
  fork = env.createCounterfactualFork(old.rootEnvelope).composition;
  const rootObservation = fork.projection(viewer).state;
  const rootCatalog = evaluator.enumerateSecondaryAgentRootTargets({ focalSeatId: viewer.playerId,
    rootObservation, legalActions: fork.inputPort.enumerateActions(), maxProxyDepth: 15 });
  const root = rootCatalog.find(t => t.targetId === steps[0].routeTargetId
    && t.planId === steps[0].routePlanId && t.compatibleActionIds.includes(steps[0].action.actionId));
  assert.ok(root, "原放数据目标仍在根目录");
  let resultTargets = root.resultTargetIds, physicalIndex = -1, currentNodeStep, pendingAdvance = false;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.action.actionId === chain[physicalIndex + 1]) {
      physicalIndex++;
      currentNodeStep = step;
    }
    const inspection = fork.inspect(), decision = inspection.session?.decision;
    const legal = inspection.phase === "awaiting_input" ? decision.choices : fork.inputPort.enumerateActions();
    const action = legal.find(a => a.actionId === step.action.actionId);
    assert.deepEqual(action, step.action);
    assert.deepEqual(continuation.capturePlanStep({ action, observation: fork.projection(viewer).state }).facts,
      step.facts, `第${i + 1}个正式输入的计划事实与历史一致`);
    const submitted = action.phase === "conditional"
      ? fork.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
        ownerId: decision.ownerId, choice: action }) : fork.inputPort.submitAction(action);
    assert.equal(submitted.ok, true);
    if (action.family === "end_turn") pendingAdvance = true;
    if (pendingAdvance) {
      const advanced = fork.counterfactualPort.advanceFocalPlanningTurn(viewer.playerId);
      if (advanced.ok) pendingAdvance = false;
      else assert.equal(advanced.code, "COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");
    }
    const after = fork.inspect();
    const barriers = [submitted.irreversibleBarrier, after.session?.irreversibleBarrier].filter(Boolean);
    const hidden = barriers.find(b => String(b.code).startsWith("hidden_")
      || ["alien_revealed", "tech_bonus_reveal"].includes(b.code));
    if (hidden) { report.stop = { planStep: i + 1, action: action.summary, barrier: hidden }; break; }
    const next = steps[i + 1];
    if (!next) break;
    const successors = after.phase === "awaiting_input" ? after.session.decision.choices : fork.inputPort.enumerateActions();
    const completed = next.goalDepth > step.goalDepth;
    assert.ok(next.goalDepth === step.goalDepth || next.goalDepth === step.goalDepth + 1);
    const input = { focalSeatId: viewer.playerId, currentAction: currentNodeStep.action,
      branchObservation: fork.projection({ ...viewer, cheap: true }).state,
      legalSuccessors: successors, focalProxyDepth: next.goalDepth,
      actionChain: chain.slice(0, physicalIndex + 1), maxProxyDepth: 15,
      routeTargetId: completed ? null : step.routeTargetId,
      routePlanId: completed ? null : step.routePlanId,
      routeResultTargetIds: completed ? [] : resultTargets };
    // 目标完成/宏步边界取自历史逐步证据；验证两版在相同证据上的准入差异，
    // 不将此诊断当作重新实现完整搜索，也不推断全局排队顺序。
    const before = parent.selectSecondaryAgentSuccessors(input);
    const selected = evaluator.selectSecondaryAgentSuccessors(input);
    const match = a => a.actionId === next.action.actionId && a.routeTargetId === next.routeTargetId
      && a.routePlanId === next.routePlanId;
    const oldMatch = before.find(match), newMatch = selected.find(match);
    report.checks.push({ afterPlanStep: i + 1, nextAction: next.action.summary,
      nextActionId: next.action.actionId, target: next.routeTargetId, plan: next.routePlanId,
      parentAdmitted: Boolean(oldMatch), candidateAdmitted: Boolean(newMatch),
      parentCount: before.length, candidateCount: selected.length,
      removed: before.filter(a => !selected.some(b => b.actionId === a.actionId
        && b.routeTargetId === a.routeTargetId && b.routePlanId === a.routePlanId)).map(a => a.summary) });
    assert.ok(oldMatch, `父版准入不匹配，第${i + 2}步；须检查诊断边界，不能外推生产缺陷`);
    if (!newMatch) { report.firstExcluded = i + 2; break; }
    resultTargets = newMatch.routeResultTargetIds;
  }
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  fork?.dispose(); env?.dispose();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, ...report }, null, 2));
}

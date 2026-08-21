#!/usr/bin/env node
"use strict";
// V(state) 输入完整性审计（2026-08-18 用户要求"系统性解决 V 看不到东西"）：
// 对 V 评估的全部调用路径逐一验证喂给 evaluateStateValue 的 observation
// 是否都是标准结构（createDecisionObservation 装配，含 outcomeProjection）。
// 任何路径 THROW = 该调用点漏装配 → V=null → "看不到东西"。
// 用法: node tools/audit_v_state_inputs.js [seed]
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const ev = require("../randomizer/game/ai/expected-score-evaluator");

const seed = process.argv[2] || "seti-104-official-v1";

function auditObservation(label, obs, seatId, required = true) {
  const proj = obs?.outcomeProjection;
  const schemaOK = proj?.schemaVersion === outcomeModel.PROJECTION_SCHEMA_VERSION;
  const hasScoring = !!proj?.scoring;
  const hasProgress = !!proj?.progress;
  const hasAssets = !!proj?.assets;
  const hasSelf = !!obs?.selfState;
  const hasHand = Array.isArray(obs?.selfState?.hand);
  let vResult = "OK";
  try {
    const v = ev.evaluateStateValue(obs, seatId);
    vResult = `total=${v.total.toFixed(1)}`;
  } catch (e) {
    vResult = `THROW: ${e.message.slice(0, 50)}`;
  }
  const ok = vResult.startsWith("total=");
  const status = ok ? "PASS" : (required ? "FAIL" : "INFO(需装配)");
  console.log(`[${status}] ${label}: schema=${schemaOK} scoring=${hasScoring} progress=${hasProgress} assets=${hasAssets} hand=${hasHand} V=${vResult}`);
  return ok || !required;
}

function drain(env) {
  const selectionProgress = new Map();
  let guard = 0;
  while (env.legalActions()[0]?.family?.startsWith("choose_")) {
    const actions = env.legalActions();
    const actorId = actions[0].actorId;
    const progress = selectionProgress.get(actorId) || { industry: false, initialIds: new Set() };
    let action = actions.find((c) => c.target?.kind === "start_initial_setup")
      || actions.find((c) => c.target?.kind === "confirm_initial_setup");
    if (!action && !progress.industry) {
      action = actions.find((c) => (
        c.target?.kind === "select_initial_card" && c.target?.selectionKind === "industry"
      ));
      if (action) progress.industry = true;
    }
    if (!action && progress.initialIds.size < 2) {
      action = actions.find((c) => (
        c.target?.kind === "select_initial_card"
        && c.target?.selectionKind === "initial"
        && !progress.initialIds.has(c.target.cardId)
      ));
      if (action) progress.initialIds.add(action.target.cardId);
    }
    action = action || actions[0];
    selectionProgress.set(actorId, progress);
    env.step(action);
    guard++;
    if (guard > 50) break;
  }
}

const env = createSimulationEnv();
env.reset({ seed, activePlayerCount: 4, traceCounterfactualGoalClusters: true });
drain(env);
let guard = 0;
while (!env.isTerminal() && guard < 3) {
  const legal = env.legalActions();
  const hasMain = legal.some((a) => (
    ["play_card", "research_tech", "scan", "place_data", "launch"].includes(a.family)
  ));
  if (hasMain) break;
  env.step(legal[0]);
  guard++;
}
const seatId = "player-white";
let allPass = true;

// 路径 1：env.observe 原始观察 —— 预期需要装配（V 契约：标准结构）
// 注：env.observe 原始结构缺 outcomeProjection，直接喂 V 会 THROW——这是契约
// 红线（调用方必须 createDecisionObservation 装配），审计标记为"需装配"。
const rawObs = env.observe(seatId);
allPass = auditObservation("env.observe(原始, 需装配)", rawObs, seatId, false) && allPass;

// 路径 2：createDecisionObservation 装配后（启发式/V 引导 root 用）—— 必须 PASS
const stdObs = outcomeModel.createDecisionObservation(rawObs, { seatId, stateVersion: 0, decisionVersion: 0 });
allPass = auditObservation("decisionObs(装配后)", stdObs, seatId) && allPass;

// 路径 3：启发式 actionOutcomes 的 leaf.observation —— 必须 PASS
// （evaluateActionOutcomes 旧入口已删除；统一用真实决策 runHeuristicPolicyDecision
// 返回的 actionOutcomes，与决策函数同一搜索参数）
const legal = env.legalActions();
const policyResult = env.runHeuristicPolicyDecision();
const proj = policyResult.actionOutcomes;
const leafWithObs = proj.find((o) => o?.leaves?.some((l) => l?.observation));
if (leafWithObs) {
  const leafObs = leafWithObs.leaves.find((l) => l?.observation)?.observation;
  allPass = auditObservation("heuristic-leaf(反事实叶)", leafObs, seatId) && allPass;
} else {
  console.log("[WARN] 无带 observation 的叶");
  allPass = false;
}

// 路径 4：V 引导 fork 的 projection().state —— 需经 v-guided-search 内部装配
const fork = env.createCounterfactualFork(null, { branchKey: "audit" });
const comp = fork.composition || fork;
const forkState = comp.projection().state;
allPass = auditObservation("vguided-fork(原始, 需装配)", forkState, seatId, false) && allPass;
try { comp.dispose?.(); } catch (_e) { /* noop */ }

// 路径 5：Browser projectBrowserState 信息层（host-unify 修复）—— 必须 PASS。
// 修复前 Browser 机器席位 projection.state 是 UI 展示视图（resident 被读模型替换），
// createDecisionObservation 取不到 players/hand → observation 失明（V=0 或 THROW）。
// 现在信息层与 Simulation buildRuleObservation 同源（app/rule-observation.js），
// 此路径必须与路径 2 一样完整。
{
  const productionKernel = require("../randomizer/game/production-kernel");
  const projectionAdapter = require("../randomizer/app/browser-host/projection-adapter");
  const browserRuleCompositionModule = require("../randomizer/app/browser-rule-composition");
  let randomState = 1;
  const browserRandom = () => {
    randomState = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
    randomState ^= randomState + Math.imul(randomState ^ (randomState >>> 7), 61 | randomState);
    return ((randomState ^ (randomState >>> 14)) >>> 0) / 4294967296;
  };
  browserRandom.getState = () => randomState >>> 0;
  browserRandom.setState = (next) => { randomState = Number(next) >>> 0 || 1; };
  const browserComp = browserRuleCompositionModule.createBrowserRuleComposition({
    productionKernelApi: productionKernel,
    random: browserRandom,
    seed: `${seed}:browser-audit`,
    activePlayerCount: 4,
    hostServices: {},
    browserProjection: {
      visibilityPolicy: projectionAdapter.defaultVisibilityPolicy,
      getFinalReadModelOwner: () => ({ project: () => ({ players: [] }) }),
      getBrowserReadModelOwner: () => ({ project: () => ({ render: {} }) }),
      createRenderPresentation: () => ({}),
    },
  });
  browserComp.newGame({ seed: `${seed}:browser-audit`, activePlayerCount: 4 });
  browserComp.inputPort.beginDrain({ metadata: { source: "audit" } });
  const browserInspection = browserComp.inspect();
  const browserOwner = browserInspection.session?.decision?.ownerId
    || browserComp.projectionSource.read().state?.match?.currentPlayerId
    || null;
  if (!browserOwner) {
    console.log("[FAIL] Browser 路径无法解析决策 owner");
    allPass = false;
  } else {
    const browserProjected = browserComp.projection({
      viewerId: `machine:${browserOwner}`,
      playerId: browserOwner,
      role: "player",
    });
    const browserObs = outcomeModel.createDecisionObservation(browserProjected.state, {
      seatId: browserOwner,
      stateVersion: null,
      decisionVersion: null,
    });
    allPass = auditObservation("browser-info-layer(机器席位观察)", browserObs, browserOwner) && allPass;
    const rawPlayers = browserObs.publicState?.players;
    const playerCount = Array.isArray(rawPlayers)
      ? rawPlayers.length
      : (Array.isArray(rawPlayers?.players) ? rawPlayers.players.length : 0);
    if (playerCount < 1) {
      console.log("[FAIL] Browser 机器席位观察 publicState.players 为空（信息层缺失，修复前失明症状）");
      allPass = false;
    }
  }
  browserComp.dispose?.();
}

env.dispose();
console.log(allPass ? "\nV 输入审计全部通过" : "\nV 输入审计有 FAIL（见上，检查对应调用点装配）");
process.exit(allPass ? 0 : 1);

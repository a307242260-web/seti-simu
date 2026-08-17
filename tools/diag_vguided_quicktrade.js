"use strict";
// V 引导决策诊断：为什么"有资源时最高 V 动作是 quick_trade"？
// 在白色第一个"有资源（credits>=2）且是主行动选择"的决策点，对每个合法动作
// 逐个 fork 浅搜索，并分解 V 成分增量（分/流动性/收入/科技/外星/手牌），
// 定位是哪一成分把 quick_trade 顶到最高。同时输出每个动作 leaf 的资源与
// fork trace（实际执行的动作序列），判断是否存在"快速动作白嫖额外主行动"的不对称。
// 用法: node tools/diag_vguided_quicktrade.js [maxDepth] [--decisions N]
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const search = require("../randomizer/game/ai/v-guided-search");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const ev = require("../randomizer/game/ai/expected-score-evaluator");

const SEAT = "player-white";
const COMPONENT_KEYS = ["scoreValue", "liquidValue", "incomeValue", "techEfficiencyValue", "alienValue", "cardValue"];

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function pad(value, width = 9) {
  const text = String(value);
  return text.length >= width ? text : text.padStart(width);
}

function stdOf(obs, seatId, authority) {
  return outcomeModel.createDecisionObservation(obs, {
    seatId,
    stateVersion: authority?.stateVersion ?? null,
    decisionVersion: authority?.decisionVersion ?? null,
  });
}

// 从 env 当前状态构造一个可被 lifecycle.restore 接受的 envelope
// （saveBrowserSave 返回浏览器档，字段名/schema 不同，需重包为规则内核格式）
function envelopeOf(env) {
  const save = env.saveBrowserSave();
  return {
    schemaVersion: "seti-rule-composition-save-v1",
    committedState: save.committedState,
    session: save.session ?? null,
  };
}

function evaluateWithComponents(env, action, rootEnvelope, seatId, authority, rootStd, depth) {
  const fork = env.createCounterfactualFork(rootEnvelope, { branchKey: `diag-${action.actionId}` });
  const comp = fork.composition || fork;
  try {
    const trace = search.forkAdvance(comp, action, depth, seatId);
    const obs = comp.projection().state;
    const publicState = obs?.publicState || obs;
    const leafStd = stdOf(publicState, seatId, authority);
    const leafV = ev.evaluateStateValue(leafStd, seatId);
    const rootV = ev.evaluateStateValue(rootStd, seatId);
    const leafState = ev.evaluateState(leafStd, seatId);
    const rootState = ev.evaluateState(rootStd, seatId);
    const actual = leafState.realizedScore - rootState.realizedScore;
    const comps = {};
    for (const key of COMPONENT_KEYS) {
      comps[key] = finite(leafV.components[key]) - finite(rootV.components[key]);
    }
    const leafAssets = leafStd.outcomeProjection?.assets || {};
    return {
      actionId: action.actionId,
      family: action.family,
      phase: action.phase || null,
      target: action.target?.tradeId || action.target?.kind || action.target?.planetId || null,
      total: actual + (leafV.total - rootV.total),
      vDelta: leafV.total - rootV.total,
      actual,
      trace: trace.map((item) => item.family).join(">"),
      okCount: trace.filter((item) => item.ok).length,
      comps,
      leafAssets: {
        credits: leafAssets.credits,
        energy: leafAssets.energy,
        data: leafAssets.availableData,
        hand: leafStd.publicState?.players?.find((p) => String(p.playerId || p.color || "") === seatId)?.handCount,
      },
      leafRound: leafStd.outcomeProjection?.progress?.roundNumber ?? null,
    };
  } finally {
    try { comp.dispose?.(); } catch (_e) { /* fork 清理失败不影响 */ }
  }
}

function dumpDecision(env, stepIndex, maxDepth) {
  const legal = env.legalActions();
  const seatId = legal[0]?.actorPlayerId || null;
  const authority = {
    stateVersion: legal[0]?.stateVersion,
    decisionVersion: legal[0]?.decisionVersion,
  };
  const rootObservation = env.observe();
  const rootStd = stdOf(rootObservation, seatId, authority);
  const rootV = ev.evaluateStateValue(rootStd, seatId);
  const white = rootObservation.publicState?.players?.find(
    (p) => String(p.playerId || p.color || "") === seatId,
  );
  const assets = rootStd.outcomeProjection?.assets || {};
  const progress = rootStd.outcomeProjection?.progress || {};
  const alienSlots = (progress.alienSlots || [])
    .map((slot) => `${slot?.slotId}:${slot?.revealed ? "revealed" : `traces=${slot?.ownFirstTraces}`}`)
    .join(" ");
  console.log(`\n=== 白色决策点 @ step ${stepIndex} (round ${rootObservation.publicState?.roundNumber}) ===`);
  console.log(`root 资源: c=${assets.credits} e=${assets.energy} d=${assets.availableData} pub=${assets.publicity} hand=${white?.handCount}`);
  console.log(`root 收入率: c${progress.income?.credits ?? 0}/e${progress.income?.energy ?? 0} | 科技[${(progress.ownedTechIds || []).join(",")}] | 外星: ${alienSlots}`);
  console.log(`root V: total=${rootV.total.toFixed(1)} (score=${rootV.components.scoreValue.toFixed(1)} liquid=${rootV.components.liquidValue.toFixed(1)} income=${rootV.components.incomeValue.toFixed(1)} tech=${rootV.components.techEfficiencyValue.toFixed(1)} alien=${rootV.components.alienValue.toFixed(1)} card=${rootV.components.cardValue.toFixed(1)})`);
  console.log(`root 合法动作: ${legal.map((a) => `${a.family}${a.target?.tradeId ? `(${a.target.tradeId})` : ""}`).join(", ")}`);

  const rootEnvelope = envelopeOf(env);
  const results = legal
    .filter((a) => !["end_turn", "pass"].includes(a.family))
    .map((action) => evaluateWithComponents(env, action, rootEnvelope, seatId, authority, rootStd, maxDepth));
  results.sort((a, b) => b.total - a.total || String(a.actionId).localeCompare(String(b.actionId)));
  const header = `  ${pad("family", 16)}${pad("target", 22)}${pad("total", 9)}${pad("vDelta", 9)}${pad("actual", 8)}  ${pad("trace", 18)} ${pad("score", 7)}${pad("liquid", 8)}${pad("income", 8)}${pad("tech", 6)}${pad("alien", 7)}${pad("card", 6)}  leaf(c,e,d,hand)`;
  console.log(`  V 成分增量 = leafV - rootV`);
  console.log(header);
  for (const r of results) {
    const marker = r.family === "quick_trade" ? " <<< quick_trade" : "";
    console.log(
      `  ${pad(r.family, 16)}${pad(String(r.target), 22)}${pad(r.total.toFixed(1), 9)}${pad(r.vDelta.toFixed(1), 9)}${pad(r.actual.toFixed(1), 8)}  ${pad(r.trace, 18)} `
      + `${pad(r.comps.scoreValue.toFixed(1), 7)}${pad(r.comps.liquidValue.toFixed(1), 8)}${pad(r.comps.incomeValue.toFixed(1), 8)}${pad(r.comps.techEfficiencyValue.toFixed(1), 6)}${pad(r.comps.alienValue.toFixed(1), 7)}${pad(r.comps.cardValue.toFixed(1), 6)}`
      + `  (${r.leafAssets.credits},${r.leafAssets.energy},${r.leafAssets.data},${r.leafAssets.hand})${marker}`,
    );
  }
  return results;
}

function main() {
  const maxDepth = Number(process.argv[2] || 4);
  const decisionsArg = (() => {
    const indexOf = process.argv.indexOf("--decisions");
    const eq = process.argv.find((a) => a.startsWith("--decisions="));
    const raw = indexOf >= 0 ? process.argv[indexOf + 1] : (eq ? eq.split("=")[1] : "1");
    return Math.max(1, Number(raw) || 1);
  })();
  const maxSteps = (() => {
    const indexOf = process.argv.indexOf("--maxsteps");
    const eq = process.argv.find((a) => a.startsWith("--maxsteps="));
    const raw = indexOf >= 0 ? process.argv[indexOf + 1] : (eq ? eq.split("=")[1] : "300");
    return Math.max(1, Number(raw) || 300);
  })();
  const env = createSimulationEnv();
  env.reset({ seed: "seti-free-analyze-v1", activePlayerCount: 4, episodeId: "diag-vguided" });
  // 用启发式推进到白色"有资源"的主行动决策点
  let stepIndex = 0;
  let captured = 0;
  const finalMaxSteps = maxSteps;
  while (stepIndex < finalMaxSteps && !env.isTerminal()) {
    const obs = env.observe();
    const decision = obs.decision || {};
    const isWhiteTurn = String(decision.actorPlayerId || "") === SEAT;
    const white = obs.publicState?.players?.find((p) => String(p.playerId || p.color || "") === SEAT);
    if (isWhiteTurn && decision.decisionType === "turn_action" && Number(white?.credits) >= 2) {
      const results = dumpDecision(env, stepIndex, maxDepth);
      captured += 1;
      if (captured >= decisionsArg) break;
    }
    const res = env.runHeuristicPolicyDecision();
    stepIndex += 1;
    if (stepIndex % 100 === 0) console.log(`[drive] step ${stepIndex}...`);
  }
  if (captured === 0) console.log(`未找到白色 credits>=2 的主行动决策点（在 ${stepIndex} 步内）`);
  env.dispose();
}

main();

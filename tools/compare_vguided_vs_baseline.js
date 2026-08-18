"use strict";
// V 引导决策器 vs 启发式基线 全盘对比（免电分析盘面 seti-free-analyze-v1，4 家）
// 对比维度：白方（seat=player-white）策略差异——其余三家固定启发式，保证对比只反映
// 白方行为。输出：终局分数、白方行动族分布、quick_trade 次数、回合末状态轨迹、耗时。
// 用法:
//   node tools/compare_vguided_vs_baseline.js --mode vguided [--maxdepth 4] [--seed seti-free-analyze-v1] [--progress 25]
//   node tools/compare_vguided_vs_baseline.js --mode heuristic [--progress 25]
const { createSimulationEnv } = require("../randomizer/app/simulation-env");

function familyOf(actionId) {
  return String(actionId || "").split(":")[0] || "<none>";
}

// 纯弃牌决策（choose_payment discard-hand-card + confirm）完成器：
// 会话内轮流选"未选过"的卡，选满 required(=2，当前所有弃牌交易 handSize 成本恒 2)
// 后提交 confirm。注意：confirm 提交失败会 abort 整个 quick_trade 会话（phase=aborted），
// 所以绝不能"试 confirm 失败再补卡"，必须一次选满。背景：规则会话原语只有
// "单张点选（toggle）+ confirm"；启发式每次决策独立选"最优"、无会话记忆 → 恒选
// 同一张卡 → toggle 振荡死锁。本完成器仅用于分析 harness，不改游戏规则；
// 无法处理时返回 null。
let discardSess = null;
const DISCARD_REQUIRED = 2;
function completeDiscardSession(env, legal) {
  const discardCards = legal.filter((a) => (
    a.family === "choose_payment" && a.target?.kind === "discard-hand-card"
  ));
  const confirm = legal.find((a) => (
    a.family === "choose_payment" && a.target?.kind === "confirm"
  ));
  if (!discardCards.length || !confirm) {
    discardSess = null;
    return null;
  }
  if (!discardSess) discardSess = { selected: new Set() };
  if (discardSess.selected.size >= DISCARD_REQUIRED) {
    return confirm;
  }
  const next = discardCards.find((c) => (
    !discardSess.selected.has(c.target?.cardInstanceId)
  )) || discardCards[0];
  discardSess.selected.add(next.target?.cardInstanceId);
  return next;
}

// 白方条件/一般决策统一入口：纯弃牌决策走完成器，其余委托启发式（含主行动选择）。
// 返回执行的动作 family 或 "discard-session"。
// 2026-08-18：条件检测改用 family（与 runVGuidedDecision 的 allConditional 一致）——
// 此前用 decisionType==="conditional_choice" 与真实 legal 结构（family=choose_target,
// decisionType=undefined）不匹配，打牌后的 choose_target 条件决策漏处理。
function runWhiteConditional(env) {
  const legal = env.legalActions();
  const allConditional = legal.length > 0 && legal.every((a) => (
    ["choose_card", "choose_payment", "choose_target", "accept_optional_effect"].includes(a.family)
  ));
  if (allConditional) {
    const discardAction = completeDiscardSession(env, legal);
    if (discardAction) {
      const st = env.step(discardAction);
      if (!st.ok) throw new Error(`弃牌会话 step 失败: ${st.error || st.failure?.code || "未知"}`);
      if (discardAction.target?.confirm) discardSess = null; // confirm 成功 = 会话结束
      return "discard-session";
    }
  }
  const hr = env.runHeuristicPolicyDecision();
  return hr.policyDecision?.actionId || "<none>";
}

function runGame(options) {
  const { mode, maxDepth, seed, progressEvery } = options;
  const env = createSimulationEnv();
  env.reset({ seed, activePlayerCount: 4, episodeId: `cmp-${mode}-${Date.now()}` });
  const whiteFams = {};
  const allFams = {};
  const roundMarks = [];
  let steps = 0;
  let quickTradeCount = 0;
  let vguidedCount = 0;
  let delegateCount = 0;
  let fallbackCount = 0;
  let discardSessionCount = 0;
  let lastRound = 0;
  const t0 = Date.now();

  while (!env.isTerminal()) {
    const obs = env.observe();
    const seat = obs.decision?.actorPlayerId || null;
    const isWhite = seat === "player-white";
    let fam = null;
    if (isWhite) {
      if (mode === "vguided") {
        // 2026-08-18（错误必须暴露）：runVGuidedDecision 异常不再静默回退——
        // 显式抛出；条件决策现在直接返回第一个合法 action（契约修复），调用方
        // 一律走 env.step(res.action)，不再有 undefined action 路径。
        const res = env.runVGuidedDecision({ maxDepth });
        if (!res?.action) {
          throw new Error(`V 引导 step ${steps} 未返回 action（契约破坏）: ${JSON.stringify(res?.diagnostics || {})}`);
        }
        const st = env.step(res.action);
        if (!st.ok) throw new Error(`V 引导 step ${steps} 失败: ${st.error || st.failure?.code || "未知"}`);
        fam = familyOf(res.action?.actionId);
        if (res.conditional) {
          delegateCount += 1;
        } else {
          vguidedCount += 1;
        }
      } else {
        const handled = runWhiteConditional(env);
        fam = familyOf(handled);
        if (handled === "discard-session") discardSessionCount += 1;
      }
    } else {
      const hr = env.runHeuristicPolicyDecision();
      fam = familyOf(hr.policyDecision?.actionId);
    }
    steps += 1;
    if (isWhite) {
      whiteFams[fam] = (whiteFams[fam] || 0) + 1;
      if (fam === "quick_trade") quickTradeCount += 1;
    }
    allFams[fam] = (allFams[fam] || 0) + 1;
    const round = Number(obs.publicState?.roundNumber) || 0;
    if (round !== lastRound) {
      lastRound = round;
      const white = obs.publicState?.players?.find((p) => String(p.playerId || p.color || "") === "player-white");
      roundMarks.push({
        round,
        step: steps,
        score: white?.score ?? null,
        credits: white?.credits ?? null,
        energy: white?.energy ?? null,
        hand: white?.handCount ?? null,
        income: white?.income ? { c: white.income.credits, e: white.income.energy } : null,
        tech: white?.techState ? Object.keys(white.techState.ownedTiles || {}).length : null,
      });
    }
    if (progressEvery > 0 && steps % progressEvery === 0) {
      const white = obs.publicState?.players?.find((p) => String(p.playerId || p.color || "") === "player-white");
      console.log(`[progress] mode=${mode} step=${steps} round=${round} whiteScore=${white?.score ?? "?"} whiteQt=${quickTradeCount} fams=${JSON.stringify(whiteFams)}`);
    }
  }
  const elapsed = Date.now() - t0;
  const final = env.observe();
  const players = final.publicState?.players || [];
  const white = players.find((p) => String(p.playerId || p.color || "") === "player-white");
  const scores = players.map((p) => Number(p.score) || 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  console.log(`\n===== 结果 mode=${mode} (seed=${seed}, ${elapsed}ms, ${steps} 步) =====`);
  console.log(`白方终局: score=${white?.score ?? "?"} 均分=${avg.toFixed(1)} 各席=${players.map((p) => `${p.playerId || p.color}=${p.score}`).join(" ")}`);
  console.log(`白方行动族分布: ${JSON.stringify(whiteFams)}`);
  console.log(`白方 quick_trade 次数: ${quickTradeCount} | V 引导决策数: ${vguidedCount} | 条件委托数: ${delegateCount} | 回退数: ${fallbackCount} | 弃牌会话数: ${discardSessionCount}`);
  console.log(`回合末轨迹: ${JSON.stringify(roundMarks)}`);
  env.dispose();
  return { mode, steps, elapsed, whiteScore: white?.score ?? null, avg, whiteFams, quickTradeCount, roundMarks };
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "vguided";
  const maxDepth = Number(args.includes("--maxdepth") ? args[args.indexOf("--maxdepth") + 1] : 4) || 4;
  const seed = args.includes("--seed") ? args[args.indexOf("--seed") + 1] : "seti-free-analyze-v1";
  const progressEvery = Number(args.includes("--progress") ? args[args.indexOf("--progress") + 1] : 25) || 0;
  if (!["vguided", "heuristic"].includes(mode)) throw new Error(`未知 mode: ${mode}`);
  return runGame({ mode, maxDepth, seed, progressEvery });
}

if (require.main === module) main();
module.exports = { runGame };

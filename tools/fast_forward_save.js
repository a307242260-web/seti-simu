"use strict";
// 存档快进复现工具：从零用同一内核纯重放存档 replaySteps 到目标点，打印完整状态。
// 不做任何 AI 搜索——纯规则提交，速度接近实时（537 步约 6 秒）。
// 用法:
//   node tools/fast_forward_save.js <save-file> [--round N] [--step N] [--aliens] [--white]
//   node tools/fast_forward_save.js <save-file> --round 3     # 快进到第 3 回合开始
//   node tools/fast_forward_save.js <save-file> --step 220    # 快进到第 220 步后
//   node tools/fast_forward_save.js <save-file> --aliens      # 只跟踪外星人状态变化
const fs = require("node:fs");
const path = require("node:path");

// 稳定序列化 action（排序键）用于重复录制判定
function stableSerializeAction(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerializeAction).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerializeAction(value[key])}`
  )).join(",")}}`;
}
const { createSeededRandom, hashSeed } = require("../randomizer/game/random");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");

const args = process.argv.slice(2);
const saveFiles = [];
let idx = 0;
while (idx < args.length && !args[idx].startsWith("--")) {
  saveFiles.push(args[idx]);
  idx += 1;
}
const flagArgs = args.slice(idx);
if (!saveFiles.length) {
  console.log("用法: node tools/fast_forward_save.js <save-file> [更多存档(自动拼接)] [--round N|--step N|--aliens|--white]");
  process.exit(1);
}
// 加载并拼接多档。拼接规则与 tools/backfill_full_chain.js 一致：
// 后档 step0 若与前档最后一步同 actionId（同一动作被多档重复记录）则去掉后档 step0，
// 档内保留全部步骤（quick_trade 弃牌等真实重复选择不能去重）。
let replaySteps = [];
let seedFromSave = null;
let metaSeed = null;
let activePlayerCount = 4;
let targetState = null;
for (const saveFile of saveFiles) {
  const save = JSON.parse(fs.readFileSync(path.resolve(saveFile), "utf8"));
  if (save.schema !== "seti-browser-save-v2") {
    console.error(`不支持的存档 schema: ${save.schema}`);
    process.exit(1);
  }
  const st = save.readableState || (() => { try { return JSON.parse(save.committedState); } catch { return null; } })();
  if (!seedFromSave) seedFromSave = save.seed;
  if (!metaSeed && st?.meta?.seed) metaSeed = st.meta.seed;
  if (st?.turn?.activePlayerCount) activePlayerCount = Number(st.turn.activePlayerCount);
  targetState = targetState || st;
  const steps = save.replaySteps || [];
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    // 重复录制判据：完整 action 稳定序列化相等（同一步被录多次）。
    // 不能用 actionId+stateVersion：toggle 选择（选中/取消）同 actionId 同 stateVersion
    // 但 presentation.selected 不同，是真实操作，必须保留（v223 #403/#404）。
    const thisKey = stableSerializeAction(step.action || {});
    if (replaySteps.length) {
      const lastKey = stableSerializeAction(replaySteps[replaySteps.length - 1].action || {});
      if (lastKey === thisKey) continue;
    }
    replaySteps.push(step);
  }
}
const state = targetState;

const modeRound = flagArgs.indexOf("--round");
const modeStep = flagArgs.indexOf("--step");
const onlyAliens = flagArgs.includes("--aliens");
const onlyWhite = flagArgs.includes("--white");
const targetRound = modeRound >= 0 ? Number(flagArgs[modeRound + 1] || 1) : null;
const targetStep = modeStep >= 0 ? Number(flagArgs[modeStep + 1] || 0) : null;

// seed 双层语义：主 RNG = hashSeed(固定盘面 seed)（浏览器 startNewGame 用
// hashSeed("seti-free-analyze-v1")，模拟 reset 同源），science 域 RNG =
// hashSeed(root.meta.seed)（存档 committedState 的 meta.seed）。
// 注意：浏览器档的 seed 字段 = meta.seed（science seed），不是主 RNG seed；
// 主 RNG seed 固定为盘面 seed（当前唯一盘面 seti-free-analyze-v1）。
const SEED = "seti-free-analyze-v1";
const META_SEED = metaSeed || SEED;
const random = createSeededRandom(SEED);
random.setState(hashSeed(SEED));
const kernel = createSimulationRuleComposition({
  seed: META_SEED, random, activePlayerCount,
  trustedProjectionReader: true,
});
kernel.composition.lifecycle.newGame({
  seed: META_SEED,
  activePlayerCount,
  initialize: true,
  rngState: { algorithm: "seti-simulation-mulberry32-v1", state: hashSeed(SEED) },
});
kernel.composition.inputPort.beginDrain({ metadata: { source: "fast-forward" } });

function alienSummary() {
  const st = kernel.composition.projection().state;
  const aliens = st.aliens?.aliens || {};
  return Object.entries(aliens).map(([sid, slot]) => {
    const id = slot.revealed ? (slot.alienId || slot.assignedAlienId || "?") : "?";
    const tr = Object.entries(slot.traces || {})
      .filter(([tt, t]) => t?.firstPlaced)
      .map(([tt, t]) => `${tt}:${t.ownerPlayerColor || "?"}`)
      .join(",");
    return `s${sid}[${id}${slot.revealed ? "✓" : ""}{${tr || "-"}}]`;
  }).join(" ");
}

function whiteState() {
  const st = kernel.composition.projection().state;
  const p = st.players.players.find((x) => x.id === "player-white");
  if (!p) return "";
  return `R${st.turn?.roundNumber ?? "?"} 分${p.resources.score} 钱${p.resources.credits} 能${p.resources.energy} 收${p.income.credits}/${p.income.energy} 手${(p.hand || []).length} 留${(p.reservedCards || []).length} 科技[${Object.keys(p.techState?.ownedTiles || {}).join("+") || "-"}]`;
}

function matchChoice(d, action) {
  const choiceId = String(action.choiceId || action.target?.choiceId || "");
  const byChoiceId = d.choices.find((c) => String(c.target?.choiceId) === choiceId);
  if (byChoiceId) return byChoiceId;
  const byActionId = d.choices.find((c) => String(c.actionId) === String(action.actionId));
  if (byActionId) return byActionId;
  // cardId（含初始牌 initial:N）
  const cardId = String(action.target?.cardId || action.payload?.cardId || "");
  if (cardId) {
    const byCard = d.choices.find((c) => {
      const cId = String(c.target?.cardId || c.cardId || "");
      return cId === cardId || cId === action.summary;
    });
    if (byCard) return byCard;
  }
  // 弃牌角标/手牌上限：cardIds 数组匹配
  const cardIds = action.target?.cardIds || action.payload?.cardIds || [];
  if (Array.isArray(cardIds) && cardIds.length) {
    const sorted = [...cardIds].map(String).sort().join("|");
    const byCardIds = d.choices.find((c) => {
      const cIds = c.target?.cardIds || c.cardIds || [];
      return Array.isArray(cIds)
        && cIds.length === cardIds.length
        && [...cIds].map(String).sort().join("|") === sorted;
    });
    if (byCardIds) return byCardIds;
  }
  const bySummary = d.choices.find((c) => String(c.summary || "") === String(action.summary || ""));
  if (bySummary) return bySummary;
  const wt = JSON.stringify(action.target || {});
  const byTarget = d.choices.find((c) => JSON.stringify(c.target || {}) === wt);
  if (byTarget) return byTarget;
  return null;
}

let alienPrev = alienSummary();
let okCount = 0;
let reached = false;
const t0 = Date.now();
for (let index = 0; index < replaySteps.length && !reached; index += 1) {
  const step = replaySteps[index];
  const action = step.action;
  const insp = kernel.composition.inspect();
  const projBefore = kernel.composition.projection();
  const roundBefore = projBefore.state.turn?.roundNumber ?? 0;
  // 回合边界输出
  if (targetRound != null && roundBefore === targetRound && index === 0) {
    // 已是目标回合（从第 0 步起）
  }
  let r;
  if (insp.phase !== "awaiting_input") {
    const proj = kernel.composition.projection();
    const fixed = {
      ...action,
      stateVersion: proj.stateVersion,
      decisionVersion: proj.state?.match?.decisionVersion ?? 0,
    };
    r = step.phase === "quick"
      ? kernel.composition.inputPort.submitQuickAction(fixed)
      : kernel.composition.inputPort.submitAction(fixed);
  } else {
    const d = insp.session.decision;
    const isWhite = action.actorId === "player-white" || action.actorPlayerId === "player-white";
    const strict = matchChoice(d, action);
    let pick = strict;
    // 非白色宽松匹配（与 backfill_full_chain 一致）：PASS/弃牌/选牌取第一个可选项
    if (!pick && !isWhite) {
      pick = d.choices.find((c) => !c.disabledReason) || d.choices[0];
    }
    if (!pick) {
      console.error(`#${index} 决策无匹配: ${action.family} ${JSON.stringify(action.summary)}`);
      kernel.dispose?.();
      process.exit(1);
    }
    r = kernel.composition.inputPort.submitDecision({
      decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: pick,
    });
  }
  if (!r?.ok) {
    // 已修复的可选效果决策（f9c9827 后不再弹出）：跳过无效果，直接 continue
    if (action.family === "accept_optional_effect"
      && String(action.summary || "").startsWith("跳过")
      && insp.phase !== "awaiting_input") {
      okCount += 1;
      continue;
    }
    console.error(`#${index} 提交失败: ${r.failure?.code || r.code} ${r.failure?.message || r.message} action=${action.family}`);
    kernel.dispose?.();
    process.exit(1);
  }
  okCount += 1;
  const alienNow = alienSummary();
  if (alienNow !== alienPrev) {
    if (onlyAliens || targetRound == null) {
      console.log(`#${index} [外星人] ${alienPrev} → ${alienNow}`);
    }
    alienPrev = alienNow;
  }
  // 目标判定
  if (targetStep != null && index === targetStep) reached = true;
  if (targetRound != null) {
    const st = kernel.composition.projection().state;
    if (st.turn?.roundNumber > targetRound) reached = true;
  }
}
const wallMs = Date.now() - t0;
const st = kernel.composition.projection().state;

console.log(`\n=== 快进结果（${okCount}/${replaySteps.length} 步，${wallMs}ms）===\n`);
console.log(`当前: R${st.turn?.roundNumber ?? "?"} T${st.turn?.turnNumber ?? "?"} 行动${st.turn?.actionCycleNumber ?? "?"} 当前玩家 ${st.turn?.currentPlayerId ?? "?"}`);
console.log(`外星人: ${alienSummary()}`);
if (!onlyAliens) {
  for (const p of st.players.players) {
    const ss = p.scoreSources || {};
    const alienParts = Object.entries(ss).filter(([k]) => /alien|trace/i.test(k)).map(([k, v]) => `${k}:${v}`).join(" ");
    console.log(`${p.id}: 分${p.resources.score} 钱${p.resources.credits} 能${p.resources.energy} 收${p.income.credits}/${p.income.energy} 手${(p.hand || []).length} 留${(p.reservedCards || []).length} 科技[${Object.keys(p.techState?.ownedTiles || {}).join("+") || "-"}] 外星[${alienParts || "-"}]`);
  }
  if (onlyWhite) console.log(`\n白色: ${whiteState()}`);
}
kernel.dispose?.();

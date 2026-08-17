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
// 加载并拼接多档（去重：相邻步骤 actionId+choiceId 相同视为重复，如 v54/v223 衔接处）
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
  for (const step of (save.replaySteps || [])) {
    const action = step.action || {};
    const key = `${action.actionId || ""}|${action.target?.choiceId || ""}|${action.summary || ""}`;
    const last = replaySteps[replaySteps.length - 1];
    const lastKey = last
      ? `${last.action?.actionId || ""}|${last.action?.target?.choiceId || ""}|${last.action?.summary || ""}`
      : null;
    if (lastKey === key) continue; // 拼接衔接处重复
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

// seed 双层语义：主 RNG = hashSeed(save.seed)（固定盘面 seed），
// science 域 RNG = hashSeed(root.meta.seed)（存档 committedState 的 meta.seed）。
const SEED = seedFromSave || "seti-free-analyze-v1";
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
    const pick = matchChoice(d, action);
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

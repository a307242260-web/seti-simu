"use strict";

/**
 * 专用存档迁移：把「终局未结算-v223」这一局的三个旧档（v47 + v54 + v223）
 * 用**当前内核**从零重放，适配规则演变，生成与当前内核完全兼容的新存档
 * seti-saves/seti-save-537-merged.json，之后可被 fast_forward_save.js 从头
 * 完美复现，也可被 load_save_simulation.js 读档续玩。
 *
 * 背景：老存档是旧版规则录制的，直接 fast_forward 会因规则演变分叉
 * （PASS 冗余 end_turn、可选效果弹窗）。本脚本把老存档的**决策序列**重放成
 * 新存档。初始选择老档缺失/不可靠，这里补齐：白色固定选 深空探测（公司）+
 * 初始牌 1（天狼星A扫描两次）+ 初始牌 21（木星环绕器），其余三家宽松取
 * 第一个可用选项；初始选择之后严格按老档动作走。
 *
 * 用法: node tools/migrate_537_full_chain.js
 */

const fs = require("node:fs");
const path = require("node:path");
const { createSeededRandom, hashSeed } = require("../randomizer/game/random");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");

const SEED = "seti-free-analyze-v1";
const RNG_ALGORITHM = "seti-simulation-mulberry32-v1";
const SAVES_DIR = path.join(__dirname, "..", "seti-saves");
const OUT = path.join(SAVES_DIR, "seti-save-537-merged.json");

// 白色初始选择（用户指定）：深空探测 + 天狼星扫描(initial:1) + 木星环绕(initial:21)
const WHITE_INDUSTRY = "深空探测";
const WHITE_INITIAL = [1, 21];

// ---------------------------------------------------------------------------
// 三档拼接（v54 step12/13 与 v223 step0 是同一动作，去重）
// ---------------------------------------------------------------------------

function stableSerializeAction(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerializeAction).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerializeAction(value[key])}`
  )).join(",")}}`;
}

const load = (f) => JSON.parse(fs.readFileSync(path.join(SAVES_DIR, f), "utf8"));
const v47 = load("seti-save-重打R2末-v47.json");
const v54 = load("seti-save-无法登陆-v54.json");
const v223 = load("seti-save-终局未结算-v223.json");

const replaySteps = [];
for (const s of v47.replaySteps) replaySteps.push(s);
for (let i = 0; i <= 12; i += 1) replaySteps.push(v54.replaySteps[i]);
for (let i = 1; i < v223.replaySteps.length; i += 1) replaySteps.push(v223.replaySteps[i]);

const META_SEED = JSON.parse(v223.committedState).meta?.seed || SEED;

// 老档初始选择段结束位置：最后一个 confirm_initial_setup 之后（补齐逻辑已
// 自己走完初始选择，这段老档步骤直接跳过，不重复提交）。
let initialSetupEndIndex = 0;
for (let i = 0; i < replaySteps.length; i += 1) {
  if (replaySteps[i].action?.target?.kind === "confirm_initial_setup") {
    initialSetupEndIndex = i + 1;
  }
}
console.log(`老档初始选择段到 #${initialSetupEndIndex - 1} 结束（补齐替代），从 #${initialSetupEndIndex} 起消费老档动作`);

// ---------------------------------------------------------------------------
// 匹配与提交
// ---------------------------------------------------------------------------

function strictMatch(d, action) {
  const choiceId = String(action.choiceId || action.target?.choiceId || "");
  const byChoiceId = d.choices.find((c) => String(c.target?.choiceId) === choiceId);
  if (byChoiceId) return byChoiceId;
  const byActionId = d.choices.find((c) => String(c.actionId) === String(action.actionId));
  if (byActionId) return byActionId;
  const cardId = String(action.target?.cardId || action.payload?.cardId || "");
  if (cardId) {
    const byCard = d.choices.find((c) => (
      String(c.target?.cardId || c.cardId || "") === cardId
      || String(c.summary) === String(action.summary || "")
    ));
    if (byCard) return byCard;
  }
  const cardIds = action.target?.cardIds || action.payload?.cardIds || [];
  if (Array.isArray(cardIds) && cardIds.length) {
    const sorted = [...cardIds].map(String).sort().join("|");
    const byCardIds = d.choices.find((c) => {
      const cIds = c.target?.cardIds || c.cardIds || [];
      return Array.isArray(cIds) && cIds.length === cardIds.length
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

function decisionOf(kernel) {
  return kernel.composition.inspect().session?.decision || null;
}

function isSetupDecision(d) {
  return !!d && d.choices.some((c) => (
    ["select_initial_card", "confirm_initial_setup", "start_initial_setup"].includes(c.target?.kind)
  ));
}

// 初始选择补齐状态机（每玩家）：industry 选项选后仍会留在 choices 里
// （selectionChoices 恒返回 industryChoices），必须显式跳过已选公司；
// 初始牌选项用 summary"选择："/"取消："区分未选/已选（toggle）。
const setupStates = new Map(); // ownerId -> { industryDone, selected:Set }

function setupStateOf(ownerId) {
  if (!setupStates.has(ownerId)) {
    setupStates.set(ownerId, { industryDone: false, selected: new Set() });
  }
  return setupStates.get(ownerId);
}

function pickSetupChoice(d) {
  const owner = d.ownerId;
  const isWhite = owner === "player-white";
  const st = setupStateOf(owner);
  // 1) 选公司：白色固定深空探测；其他玩家宽松取第一个 industry 选项。
  if (!st.industryDone) {
    const industryChoice = d.choices.find((c) => (
      c.target?.kind === "select_initial_card"
      && c.target?.selectionKind === "industry"
      && (!isWhite || String(c.summary || "").includes(WHITE_INDUSTRY))
    ));
    if (industryChoice) {
      st.industryDone = true;
      return industryChoice;
    }
  }
  // 2) 选初始牌：白色按指定顺序；其他玩家宽松取未选过的"选择"选项。
  if (isWhite) {
    for (const id of WHITE_INITIAL) {
      if (st.selected.has(id)) continue;
      const cardChoice = d.choices.find((c) => (
        c.target?.kind === "select_initial_card"
        && c.target?.selectionKind === "initial"
        && String(c.target?.cardId || "") === `initial:${id}`
        && String(c.summary || "").startsWith("选择")
      ));
      if (cardChoice) {
        st.selected.add(id);
        return cardChoice;
      }
    }
  } else {
    const anyCard = d.choices.find((c) => (
      c.target?.kind === "select_initial_card"
      && c.target?.selectionKind === "initial"
      && String(c.summary || "").startsWith("选择")
      && !st.selected.has(String(c.target?.cardId || ""))
    ));
    if (anyCard) {
      st.selected.add(String(anyCard.target?.cardId || ""));
      return anyCard;
    }
  }
  // 3) 公司+初始牌都选完 → confirm（confirm 出现即代表可以确认）
  const confirm = d.choices.find((c) => c.target?.kind === "confirm_initial_setup");
  if (confirm && st.industryDone) return confirm;
  // 兜底：取任一未禁用的"选择"选项，避免 toggle 死循环
  return d.choices.find((c) => !c.disabledReason && String(c.summary || "").startsWith("选择"))
    || d.choices.find((c) => !c.disabledReason)
    || d.choices[0];
}

function submitDecision(kernel, pick) {
  const d = kernel.composition.inspect().session.decision;
  return kernel.composition.inputPort.submitDecision({
    decisionId: d.decisionId,
    decisionVersion: d.decisionVersion,
    ownerId: d.ownerId,
    choice: pick,
  });
}

// 轻量状态摘要（投影直读，不序列化）
function afterSummary(state) {
  const players = state?.players?.players || [];
  const turn = state?.turn || {};
  const summary = { p: {} };
  summary.r = turn.roundNumber ?? null;
  summary.t = turn.turnNumber ?? null;
  summary.c = turn.currentPlayerId ?? null;
  for (const p of players) {
    const r = p.resources || p;
    summary.p[p.id || p.playerId || p.color] = [
      r.score ?? p.score ?? 0,
      r.credits ?? p.credits ?? 0,
      r.energy ?? p.energy ?? 0,
      r.publicity ?? p.publicity ?? 0,
      (p.hand || []).length,
      (p.reservedCards || []).length,
    ];
  }
  return summary;
}

// ---------------------------------------------------------------------------
// 重放
// ---------------------------------------------------------------------------

const random = createSeededRandom(SEED);
random.setState(hashSeed(SEED));
const kernel = createSimulationRuleComposition({
  seed: META_SEED, random, activePlayerCount: 4, trustedProjectionReader: true,
});
kernel.composition.lifecycle.newGame({
  seed: META_SEED, activePlayerCount: 4, initialize: true,
  rngState: { algorithm: RNG_ALGORITHM, state: hashSeed(SEED) },
});
kernel.composition.inputPort.beginDrain({ metadata: { source: "migrate-537" } });

const committed = [];   // 每步成功提交的 action + after
let skipped = 0;        // 规则演变跳过的老档步骤
let setupSteps = 0;     // 初始选择补齐步数
let handDiffCount = 0;  // 手牌分叉跳过的动作数
// 老档动作池：remaining 保存未匹配的老档索引（按老档顺序）。每次当前内核
// 弹出一个决策，就按老档顺序从 remaining 里找第一个能匹配的动作消费它。
// 这天然支持节点重排（老档逐节点结算 vs 当前内核 SCAN_FINALIZE 统一结算）：
// 当前决策匹配到 remaining 中靠后的动作时，前面的动作留在池里等待后续决策，
// 不会被误跳过；RNG 严格按当前内核的决策顺序消费，手牌保持与当前内核一致。
const remaining = new Set();
// setup 段（初始选择 #0-16 + 初始收入弃牌 #17-22）与当前内核无规则演变，
// 严格顺序消费，不走乱序池（避免初始收入弃牌被池错位）。
const SETUP_END = 23;
for (let i = SETUP_END; i < replaySteps.length; i += 1) remaining.add(i);
let index = initialSetupEndIndex; // 仅用于日志/进度（remaining 的最小未匹配索引）
const t0 = Date.now();

// 严格匹配当前决策里的一个 choice（含可选效果"跳过"的处理）。
function matchDecision(d, action) {
  const choiceId = String(action.choiceId || action.target?.choiceId || "");
  const byChoiceId = d.choices.find((c) => String(c.target?.choiceId) === choiceId);
  if (byChoiceId) return byChoiceId;
  const byActionId = d.choices.find((c) => String(c.actionId) === String(action.actionId));
  if (byActionId) return byActionId;
  const cardId = String(action.target?.cardId || action.payload?.cardId || "");
  if (cardId) {
    const byCard = d.choices.find((c) => (
      String(c.target?.cardId || c.cardId || "") === cardId
      || String(c.summary) === String(action.summary || "")
    ));
    if (byCard) return byCard;
  }
  const bySummary = d.choices.find((c) => String(c.summary || "") === String(action.summary || ""));
  if (bySummary) return bySummary;
  // 可选效果"跳过 X"：找 skip 选项（f9c9827 后不再逐物种弹窗）
  if (action.family === "accept_optional_effect" && String(action.summary || "").startsWith("跳过")) {
    const skipChoice = d.choices.find((c) => String(c.target?.choiceId || "").startsWith("skip:"));
    if (skipChoice) return skipChoice;
  }
  return null;
}

// —— setup 段（#0..#SETUP_END-1）严格顺序消费：初始选择 + 初始收入弃牌 ——
// 与当前内核无规则演变，逐动作严格匹配（不匹配时宽松取当前决策第一项，
// 因为初始收入弃牌选哪张由老档决定、当前内核候选应一致）。
function consumeSetupStrictly() {
  let progress = true;
  while (progress) {
    const sd = decisionOf(kernel);
    if (isSetupDecision(sd)) {
      const pick = pickSetupChoice(sd);
      const r = submitDecision(kernel, pick);
      if (!r?.ok) {
        console.log(`初始选择提交失败: ${r.failure?.code || r.code} ${r.message || ""} pick=${pick.summary}`);
        kernel.dispose?.();
        process.exit(1);
      }
      committed.push({ action: { ...pick, actorId: sd.ownerId }, after: afterSummary(kernel.composition.projection().state) });
      setupSteps += 1;
      continue;
    }
    progress = false;
  }
  // 初始收入弃牌（#17-#22 等 choose_payment discard-hand-cards）严格顺序消费。
  // 注意：#0-#16 是初始选择（公司+初始牌），已由上面 pickSetupChoice 补齐逻辑
  // 处理，不消费老档动作；setupConsumedIndex 从 17 起。
  for (let i = setupConsumedIndex; i < SETUP_END && i < replaySteps.length; i += 1) {
    const want = replaySteps[i].action;
    const insp = kernel.composition.inspect();
    const d = insp.session?.decision || null;
    if (insp.phase !== "awaiting_input" || !d) {
      // 非决策：直接提交
      const p = kernel.composition.projection();
      const fixed = { ...want, stateVersion: p.stateVersion, decisionVersion: p.state?.match?.decisionVersion ?? 0 };
      const r = kernel.composition.inputPort.submitAction(fixed);
      if (!r?.ok) {
        console.log(`setup 非决策提交失败 #${i}: ${r.failure?.code || r.code} ${r.failure?.message || r.message || ""} want=${want.family}`);
        kernel.dispose?.();
        process.exit(1);
      }
      committed.push({ action: want, after: afterSummary(kernel.composition.projection().state) });
      setupConsumedIndex = i + 1;
      continue;
    }
    const pick = matchDecision(d, want) || d.choices.find((c) => !c.disabledReason) || d.choices[0];
    const r = submitDecision(kernel, pick);
    if (!r?.ok) {
      console.log(`setup 决策提交失败 #${i}: ${r.failure?.code || r.code} ${r.failure?.message || r.message || ""} want=${want.family} ${JSON.stringify(want.summary || "")}`);
      kernel.dispose?.();
      process.exit(1);
    }
    committed.push({ action: { ...pick, actorId: d.ownerId }, after: afterSummary(kernel.composition.projection().state) });
    setupConsumedIndex = i + 1;
  }
}
let setupConsumedIndex = 17; // 初始选择(#0-16)由补齐逻辑处理，初始收入弃牌(#17+)严格顺序
consumeSetupStrictly();

while (remaining.size > 0) {
  const setupDecision = decisionOf(kernel);
  if (isSetupDecision(setupDecision)) {
    const pick = pickSetupChoice(setupDecision);
    const r = submitDecision(kernel, pick);
    if (!r?.ok) {
      console.log(`初始选择提交失败: ${r.failure?.code || r.code} ${r.message || ""} pick=${pick.summary}`);
      kernel.dispose?.();
      process.exit(1);
    }
    committed.push({ action: { ...pick, actorId: setupDecision.ownerId }, after: afterSummary(kernel.composition.projection().state) });
    setupSteps += 1;
    continue;
  }
  // 若当前仍处于 setup 段（初始收入未完成），严格顺序消费剩余 setup 动作
  if (setupConsumedIndex < SETUP_END) {
    const i = setupConsumedIndex;
    const want = replaySteps[i].action;
    const inspNow = kernel.composition.inspect();
    const dNow = inspNow.session?.decision || null;
    if (inspNow.phase !== "awaiting_input" || !dNow) {
      const p = kernel.composition.projection();
      const fixed = { ...want, stateVersion: p.stateVersion, decisionVersion: p.state?.match?.decisionVersion ?? 0 };
      const r = kernel.composition.inputPort.submitAction(fixed);
      if (!r?.ok) {
        console.log(`setup 非决策提交失败 #${i}: ${r.failure?.code || r.code} ${r.failure?.message || r.message || ""} want=${want.family}`);
        kernel.dispose?.();
        process.exit(1);
      }
      committed.push({ action: want, after: afterSummary(kernel.composition.projection().state) });
      setupConsumedIndex = i + 1;
      continue;
    }
    const pick = matchDecision(dNow, want) || dNow.choices.find((c) => !c.disabledReason) || dNow.choices[0];
    const r = submitDecision(kernel, pick);
    if (!r?.ok) {
      console.log(`setup 决策提交失败 #${i}: ${r.failure?.code || r.code} ${r.failure?.message || r.message || ""} want=${want.family} ${JSON.stringify(want.summary || "")}`);
      kernel.dispose?.();
      process.exit(1);
    }
    committed.push({ action: { ...pick, actorId: dNow.ownerId }, after: afterSummary(kernel.composition.projection().state) });
    setupConsumedIndex = i + 1;
    continue;
  }

  const insp = kernel.composition.inspect();
  const d = insp.session?.decision || null;

  // 找 remaining 里最小的索引（用于日志与越界保护）
  index = Math.min(...remaining);

  if (insp.phase === "awaiting_input" && d) {
    // —— 决策匹配：按老档顺序从 remaining 找第一个能匹配的动作 ——
    const isWhiteOwner = d.ownerId === "player-white";
    let pickedOld = null;
    const sortedRemaining = [...remaining].sort((a, b) => a - b);
    for (const oldIndex of sortedRemaining) {
      const cand = replaySteps[oldIndex].action;
      const pick = matchDecision(d, cand);
      if (pick) { pickedOld = { action: cand, oldIndex, pick, skipSkipped: sortedRemaining.indexOf(oldIndex) }; break; }
      // 非白色：同 owner 的可宽松取第一项
      if (!isWhiteOwner && String(cand.actorId || "").startsWith("player-")) {
        const relaxed = d.choices.find((c) => !c.disabledReason) || d.choices[0];
        if (relaxed) { pickedOld = { action: cand, oldIndex, pick: relaxed, skipSkipped: sortedRemaining.indexOf(oldIndex) }; break; }
      }
    }
    if (!pickedOld) {
      // 兜底：打牌/弃牌引用的卡不在当前内核手牌（规则演变残留差异），记录并跳过。
      const want = replaySteps[index]?.action;
      const cardRef = want?.target?.cardInstanceId || want?.target?.cardId || want?.payload?.cardId || "";
      const stNow = kernel.composition.projection().state;
      const whiteNow = stNow.players?.players?.find((p) => p.id === "player-white");
      const handIds = (whiteNow?.hand || []).map((c) => String(c.id || c.cardId || ""));
      const reservedIds = (whiteNow?.reservedCards || []).map((c) => String(c.id || c.cardId || ""));
      if (want && cardRef && !handIds.includes(String(cardRef)) && !reservedIds.includes(String(cardRef))) {
        console.log(`[hand-diff] #${index} ${want.family}「${want.summary || ""}」引用卡 ${cardRef} 不在当前内核手牌 → 跳过（规则演变手牌分叉）`);
        handDiffCount += 1;
        remaining.delete(index);
        continue;
      }
      console.log(`决策无匹配（owner=${d.ownerId}，remaining 剩 ${remaining.size}）`);
      console.log("  当前决策 choices:");
      for (const c of d.choices) {
        console.log(`    ${c.actionId} | ${c.summary} | ${JSON.stringify(c.target || {})}`);
      }
      console.log(`  老档 index=${index} 动作: ${replaySteps[index]?.action?.family} ${JSON.stringify(replaySteps[index]?.action?.summary || "")}`);
      kernel.dispose?.();
      process.exit(1);
    }
    if (pickedOld.skipSkipped > 0) {
      console.log(`[reorder] #${pickedOld.oldIndex} 匹配 ${pickedOld.action.family}（前面 ${pickedOld.skipSkipped} 个老档动作留池等待后续决策）`);
    }
    const r = submitDecision(kernel, pickedOld.pick);
    if (!r?.ok) {
      console.log(`失败（oldIndex=${pickedOld.oldIndex}）: ${r.failure?.code || r.code} ${r.failure?.message || r.message || ""} want=${pickedOld.action.family} [${pickedOld.action.actorId}] ${JSON.stringify(pickedOld.action.summary)}`);
      kernel.dispose?.();
      process.exit(1);
    }
    committed.push({ action: { ...pickedOld.pick, actorId: d.ownerId }, after: afterSummary(kernel.composition.projection().state) });
    remaining.delete(pickedOld.oldIndex);
  } else {
    // —— 非决策：提交 remaining 里最小的老档动作（quick action / 主行动）——
    if (index >= replaySteps.length) {
      console.log(`index ${index} 越界但 remaining 仍剩 ${remaining.size} 个（phase=${insp.phase}）`);
      kernel.dispose?.();
      process.exit(1);
    }
    const want = replaySteps[index].action;
    const p = kernel.composition.projection();
    const fixed = { ...want, stateVersion: p.stateVersion, decisionVersion: p.state?.match?.decisionVersion ?? 0 };
    const r = want.phase === "quick"
      ? kernel.composition.inputPort.submitQuickAction(fixed)
      : kernel.composition.inputPort.submitAction(fixed);
    if (!r?.ok) {
      // 适配1：PASS 后冗余 end_turn（当前内核已自动轮换下家）
      if (want.family === "end_turn") {
        const st = kernel.composition.projection().state;
        console.log(`[adapt] #${index} 跳过冗余 end_turn（当前 owner=${st.turn?.currentPlayerId}, 存档=${want.actorId}）`);
        skipped += 1;
        remaining.delete(index);
        continue;
      }
      // 适配2：可选效果"跳过 X"不再弹窗（f9c9827 后修复）
      if (want.family === "accept_optional_effect" && String(want.summary || "").startsWith("跳过")) {
        skipped += 1;
        remaining.delete(index);
        continue;
      }
      console.log(`失败 #${index}: ${r.failure?.code || r.code} ${r.failure?.message || r.message || ""} want=${want.family} [${want.actorId}] ${JSON.stringify(want.summary)}`);
      console.log("  老档上下文（前3后3）:");
      for (let i = Math.max(0, index - 3); i < Math.min(replaySteps.length, index + 4); i += 1) {
        console.log(`    #${i} ${replaySteps[i].actorPlayerId} ${replaySteps[i].action?.family} ${JSON.stringify(replaySteps[i].action?.summary || "")}`);
      }
      const stNow = kernel.composition.projection().state;
      const whiteNow = stNow.players?.players?.find((p) => p.id === "player-white");
      console.log("  当前内核白色手牌:", (whiteNow?.hand || []).map((c) => c.id || c.cardId).join(", "));
      console.log("  当前内核: phase=", kernel.composition.inspect().phase);
      kernel.dispose?.();
      process.exit(1);
    }
    committed.push({ action: want, after: afterSummary(kernel.composition.projection().state) });
    remaining.delete(index);
  }
  const consumed = replaySteps.length - remaining.size;
  if (consumed % 100 === 0) process.stderr.write(`[progress] ${consumed}/${replaySteps.length} 步（跳过 ${skipped}）\n`);
}
const wallMs = Date.now() - t0;
console.log(`\n重放完成：${replaySteps.length} 步（跳过 ${skipped} 处规则演变，初始选择补齐 ${setupSteps} 步），耗时 ${(wallMs / 1000).toFixed(1)}s`);

// ---------------------------------------------------------------------------
// 输出新存档
// ---------------------------------------------------------------------------

const envelope = kernel.composition.lifecycle.save();
const committedState = envelope.envelope?.committedState || envelope.committedState;
const meta = (() => { try { return JSON.parse(committedState).meta || {}; } catch { return {}; } })();
const browserReplaySteps = committed.map((entry, i) => ({
  stepIndex: i,
  actorPlayerId: entry.action.actorId || entry.action.actorPlayerId || null,
  action: entry.action,
  phase: entry.action.phase ?? null,
  decisionId: null,
  decisionVersion: null,
  after: entry.after,
}));
const payload = {
  schema: "seti-browser-save-v2",
  savedAt: new Date().toISOString(),
  seed: SEED,
  gameId: meta.gameId ?? null,
  rulesetVersion: meta.rulesetVersion ?? null,
  stateVersion: meta.stateVersion ?? null,
  committedState,
  session: envelope.envelope?.session ?? envelope.session ?? null,
  replaySteps: browserReplaySteps,
  name: "537-merged",
};
fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`新存档: ${OUT}`);
console.log(`  replaySteps=${browserReplaySteps.length} stateVersion=${payload.stateVersion}`);
console.log("\n=== 校验：新存档从头 fast_forward 复现 ===");
kernel.dispose?.();

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

function checkSave() {
  const save = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const rnd = createSeededRandom(SEED);
  rnd.setState(hashSeed(SEED));
  const kernel2 = createSimulationRuleComposition({
    seed: META_SEED, random: rnd, activePlayerCount: 4, trustedProjectionReader: true,
  });
  kernel2.composition.lifecycle.newGame({
    seed: META_SEED, activePlayerCount: 4, initialize: true,
    rngState: { algorithm: RNG_ALGORITHM, state: hashSeed(SEED) },
  });
  kernel2.composition.inputPort.beginDrain({ metadata: { source: "migrate-check" } });

  const steps = save.replaySteps || [];
  const start = Date.now();
  let okCount = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const insp = kernel2.composition.inspect();
    let r;
    if (insp.phase !== "awaiting_input") {
      const proj = kernel2.composition.projection();
      const fixed = { ...step.action, stateVersion: proj.stateVersion, decisionVersion: proj.state?.match?.decisionVersion ?? 0 };
      r = step.phase === "quick"
        ? kernel2.composition.inputPort.submitQuickAction(fixed)
        : kernel2.composition.inputPort.submitAction(fixed);
    } else {
      const d = insp.session.decision;
      const isWhite = step.actorPlayerId === "player-white" || step.action?.actorId === "player-white";
      const pick = strictMatch(d, step.action)
        || (!isWhite ? (d.choices.find((c) => !c.disabledReason) || d.choices[0]) : null);
      if (!pick) {
        console.log(`复现失败 #${i}: 决策无匹配 ${step.action?.family} ${JSON.stringify(step.action?.summary || "")}`);
        kernel2.dispose?.();
        process.exit(1);
      }
      r = kernel2.composition.inputPort.submitDecision({
        decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: pick,
      });
    }
    if (!r?.ok) {
      console.log(`复现失败 #${i}: ${r.failure?.code || r.code} ${r.failure?.message || r.message || ""} ${step.action?.family} [${step.actorPlayerId}]`);
      kernel2.dispose?.();
      process.exit(1);
    }
    okCount += 1;
  }
  const wall = Date.now() - start;
  const finalState = kernel2.composition.projection().state;
  const players = finalState.players?.players || [];
  console.log(`复现成功：${okCount}/${steps.length} 步全部通过，耗时 ${(wall / 1000).toFixed(1)}s`);
  console.log(`终局: R${finalState.turn?.roundNumber} ${players.map((p) => `${p.id}=${p.resources.score}`).join(" ")}`);
  // 与旧档 v223 终局对比
  const orig = JSON.parse(v223.committedState).players?.players || [];
  let allMatch = true;
  for (const p of players) {
    const o = orig.find((x) => x.id === p.id);
    const match = o && p.resources.score === o.resources.score
      && p.resources.credits === o.resources.credits
      && p.resources.energy === o.resources.energy;
    if (!match) allMatch = false;
    console.log(`  ${p.id}: 分${p.resources.score} 钱${p.resources.credits} 能${p.resources.energy} ${match ? "✓" : "✗（与 v223 旧档不同）"}`);
  }
  console.log(`\n终局状态与 v223 旧档一致: ${allMatch ? "✓" : "✗"}`);
  kernel2.dispose?.();
}

checkSave();

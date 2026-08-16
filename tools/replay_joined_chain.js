"use strict";
// 拼接重放完整链条：v47(重打R2末, sv1→46, 110步) + v54(无法登陆, sv47→54, 14步)
// + v223(终局未结算, sv54→222, 415步) = 同一局 sv1→222 全覆盖。
// 从零开局（seed=seti-free-analyze-v1）按拼接后的动作序列重放，验证终局状态与 v223 存档一致，
// 并输出完整的 scoreSources（补全旧版缺失的来源拆分）。
// 注意：读状态必须用 projection（lifecycle.save() 在 session 未 commit 时返回基础旧状态）。
const fs = require("node:fs");
const path = require("node:path");
const { createSeededRandom, hashSeed } = require("../randomizer/game/random");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");

const SAVES_DIR = path.join(__dirname, "..", "seti-saves");
const load = (f) => JSON.parse(fs.readFileSync(path.join(SAVES_DIR, f), "utf8"));

const v47 = load("seti-save-重打R2末-v47.json");
const v54 = load("seti-save-无法登陆-v54.json");
const v223 = load("seti-save-终局未结算-v223.json");

// 拼接（去重）：v54 step12/13 与 v223 step0 是同一动作 play_card:ec548c50
function buildJoinedSteps() {
  const joined = [];
  for (const s of v47.replaySteps) joined.push(s);
  // v54: step0..step12（step13 与 step12 同 actionId，跳过）
  for (let i = 0; i <= 12; i += 1) joined.push(v54.replaySteps[i]);
  // v223: step1 起（step0 与 v54 step12 重复）
  for (let i = 1; i < v223.replaySteps.length; i += 1) joined.push(v223.replaySteps[i]);
  return joined;
}

const steps = buildJoinedSteps();
console.log(`拼接后总步数: ${steps.length}（v47:${v47.replaySteps.length} + v54:${v54.replaySteps.length} + v223:${v223.replaySteps.length}，去重 2 处重复）`);

// seed 双层语义（2026-08-16 已定位）：
//  - 主 RNG 起点 = hashSeed(浏览器输入的实际固定盘面 seed) = hashSeed("seti-free-analyze-v1")
//  - science 域 RNG（研究/补牌/收入盲抽）起点 = hashSeed(root.meta.seed)，
//    而浏览器旧版 newGame 没传 seed，meta.seed 落到内核默认 "seti-simulation"；
//    重放必须用档内 meta.seed 重建 science RNG，否则补牌分叉。
const SEED = "seti-free-analyze-v1";
const META_SEED = JSON.parse(v223.committedState).meta?.seed || SEED;
console.log(`主 RNG seed: ${SEED}；meta.seed（science RNG 起点）: ${META_SEED}（来自存档 ${v223.seed}）`);

const random = createSeededRandom(SEED);
random.setState(hashSeed(SEED));
const kernel = createSimulationRuleComposition({
  seed: META_SEED, random, activePlayerCount: 4, trustedProjectionReader: true,
});
kernel.composition.lifecycle.newGame({
  seed: META_SEED, activePlayerCount: 4, initialize: true,
  rngState: { algorithm: "seti-simulation-mulberry32-v1", state: hashSeed(SEED) },
});
kernel.composition.inputPort.beginDrain({ metadata: { source: "joined-replay" } });

function decision() { return kernel.composition.inspect().session?.decision || null; }
function submitChoice(choice, d) {
  return kernel.composition.inputPort.submitDecision({
    decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId,
    choice: JSON.parse(JSON.stringify(choice)),
  });
}
function stateVersion() { return kernel.composition.projection()?.stateVersion ?? 0; }

function matchChoice(d, action) {
  const choiceId = String(action.choiceId || action.target?.choiceId || "");
  const cardId = String(action.target?.cardId || action.payload?.cardId || "");
  // 1) 精确 choiceId
  const byChoiceId = d.choices.find((c) => String(c.target?.choiceId) === choiceId);
  if (byChoiceId) return byChoiceId;
  // 2) 精确 actionId
  const byActionId = d.choices.find((c) => String(c.actionId) === String(action.actionId));
  if (byActionId) return byActionId;
  // 3) cardId（含初始牌 initial:N）
  const byCard = d.choices.find((c) => {
    const cId = String(c.target?.cardId || c.cardId || "");
    return cId === cardId || cId === action.summary;
  });
  if (byCard) return byCard;
  // 4) summary 匹配（含“弃置”“选择”等中文摘要）
  const bySummary = d.choices.find((c) => String(c.summary || "") === String(action.summary || ""));
  if (bySummary) return bySummary;
  // 5) target 完全一致（JSON 稳定序列化）
  const wt = JSON.stringify(action.target || {});
  const byTarget = d.choices.find((c) => JSON.stringify(c.target || {}) === wt);
  if (byTarget) return byTarget;
  return null;
}

function submitJoinedChoice(d, pick) {
  // 决策版本以当前 inspect 的 decision.decisionVersion 为准（choice 里的旧版本号不可信）。
  // 注意：不能 JSON round-trip（JSON.stringify 会丢弃值为 undefined 的字段，
  // 而 runtime stableSerialize 保留 undefined，round-trip 后序列化不再相等）。
  return kernel.composition.inputPort.submitDecision({
    decisionId: d.decisionId,
    decisionVersion: d.decisionVersion,
    ownerId: d.ownerId,
    choice: pick,
  });
}

let okCount = 0;
let failInfo = null;
let lastSv = -1;
for (let index = 0; index < steps.length; index += 1) {
  const step = steps[index];
  const action = step.action;
  const insp = kernel.composition.inspect();
  if (insp.phase !== "awaiting_input") {
    const proj = kernel.composition.projection();
    const fixed = {
      ...action,
      stateVersion: proj.stateVersion,
      decisionVersion: proj.state?.match?.decisionVersion ?? 0,
    };
    const r = step.phase === "quick"
      ? kernel.composition.inputPort.submitQuickAction(fixed)
      : kernel.composition.inputPort.submitAction(fixed);
    if (!r?.ok) { failInfo = { index, family: action.family, code: r.failure?.code || r.code, msg: r.failure?.message || r.message }; break; }
    if (proj.stateVersion > lastSv) lastSv = proj.stateVersion;
  } else {
    const dd = insp.session.decision;
    const pick = matchChoice(dd, action);
    if (!pick) {
      failInfo = { index, kind: dd.decisionKind, code: "CHOICE_NOT_FOUND", msg: `family=${action.family} actionId=${action.actionId} choiceId=${action.target?.choiceId} summary=${action.summary}` };
      break;
    }
    const r = submitJoinedChoice(dd, pick);
    if (!r?.ok) { failInfo = { index, kind: dd.decisionKind, code: r.failure?.code || r.code, msg: r.failure?.message || r.message }; break; }
    const proj = kernel.composition.projection();
    if (proj.stateVersion > lastSv) lastSv = proj.stateVersion;
  }
  okCount += 1;
  if (index % 100 === 0 && index > 0) console.log(`  已重放 ${index}/${steps.length} 步...`);
}

console.log(`\n重放结果: ${okCount}/${steps.length} 步成功${failInfo ? `, 失败于 #${failInfo.index}: ${failInfo.code} ${failInfo.msg || ""}` : ""}`);
if (failInfo) {
  kernel.dispose?.();
  process.exit(1);
}

const final = JSON.parse(kernel.composition.lifecycle.save().envelope.committedState);
const target = JSON.parse(v223.committedState);
console.log("\n=== 终局对比（重放 vs v223 存档）===");
let allMatch = true;
for (const p of final.players.players) {
  const orig = target.players.players.find((x) => x.id === p.id);
  const match = orig && p.resources.score === orig.resources.score;
  if (!match) allMatch = false;
  console.log(`${p.id}: score=${p.resources.score} (存档 ${orig?.resources?.score}) ${match ? "✓" : "✗"}`);
  if (match) {
    const sources = p.scoreSources || {};
    const sourceKeys = Object.keys(sources).sort();
    const total = sourceKeys.reduce((a, k) => a + Number(sources[k] || 0), 0);
    console.log(`  scoreSources(${sourceKeys.length} 键, 合计 ${total}):`);
    for (const k of sourceKeys) {
      if (Number(sources[k])) console.log(`    ${k}: ${sources[k]}`);
    }
  }
}
console.log(`\n整体一致: ${allMatch ? "✓ 完全一致" : "✗ 有差异"}`);
kernel.dispose?.();

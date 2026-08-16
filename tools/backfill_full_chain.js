"use strict";
// 完整重放 v47+v54+v223 拼接链（537 步），非白色宽松匹配、白色严格匹配、
// 已修复的"跳过可选效果"决策自动跳过（f9c9827 后不再弹出，跳过无效果）。
// 输出终局对比 + 白色完整 scoreSources。
const fs = require("node:fs");
const path = require("node:path");
const { createSeededRandom, hashSeed } = require("../randomizer/game/random");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");

const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "seti-saves", f), "utf8"));
const v47 = load("seti-save-重打R2末-v47.json");
const v54 = load("seti-save-无法登陆-v54.json");
const v223 = load("seti-save-终局未结算-v223.json");
const joined = [];
for (const s of v47.replaySteps) joined.push(s);
for (let i = 0; i <= 12; i += 1) joined.push(v54.replaySteps[i]);
for (let i = 1; i < v223.replaySteps.length; i += 1) joined.push(v223.replaySteps[i]);

const SEED = "seti-free-analyze-v1";
const META_SEED = JSON.parse(v223.committedState).meta?.seed || SEED;
const random = createSeededRandom(SEED);
random.setState(hashSeed(SEED));
const kernel = createSimulationRuleComposition({ seed: META_SEED, random, activePlayerCount: 4, trustedProjectionReader: true });
kernel.composition.lifecycle.newGame({
  seed: META_SEED, activePlayerCount: 4, initialize: true,
  rngState: { algorithm: "seti-simulation-mulberry32-v1", state: hashSeed(SEED) },
});
kernel.composition.inputPort.beginDrain({ metadata: { source: "full-backfill" } });

function decision() { return kernel.composition.inspect().session?.decision || null; }
function strictMatch(d, action) {
  const choiceId = String(action.choiceId || action.target?.choiceId || "");
  const byChoiceId = d.choices.find((c) => String(c.target?.choiceId) === choiceId);
  if (byChoiceId) return byChoiceId;
  const byActionId = d.choices.find((c) => String(c.actionId) === String(action.actionId));
  if (byActionId) return byActionId;
  const bySummary = d.choices.find((c) => String(c.summary || "") === String(action.summary || ""));
  if (bySummary) return bySummary;
  const wt = JSON.stringify(action.target || {});
  const byTarget = d.choices.find((c) => JSON.stringify(c.target || {}) === wt);
  if (byTarget) return byTarget;
  return null;
}

let skipped = 0;
let fail = null;
for (let index = 0; index < joined.length; index += 1) {
  const want = joined[index].action;
  const insp = kernel.composition.inspect();
  let r;
  if (insp.phase !== "awaiting_input") {
    const p = kernel.composition.projection();
    const fixed = { ...want, stateVersion: p.stateVersion, decisionVersion: p.state?.match?.decisionVersion ?? 0 };
    r = want.phase === "quick"
      ? kernel.composition.inputPort.submitQuickAction(fixed)
      : kernel.composition.inputPort.submitAction(fixed);
    if (!r?.ok) {
      if (want.family === "accept_optional_effect" && String(want.summary || "").startsWith("跳过") && insp.phase === "idle") {
        skipped += 1;
        continue;
      }
      fail = { index, code: r.failure?.code || r.code, msg: r.failure?.message || "", want: `${want.family} [${want.actorId}] ${JSON.stringify(want.summary)}` };
      break;
    }
  } else {
    const d = insp.session.decision;
    const isWhite = want.actorId === "player-white";
    const strict = strictMatch(d, want);
    let pick;
    if (strict) pick = strict;
    else if (!isWhite) {
      pick = d.choices.find((c) => !c.disabledReason) || d.choices[0];
    } else if (want.family === "accept_optional_effect" && String(want.summary || "").startsWith("跳过")) {
      const skipChoice = d.choices.find((c) => String(c.target?.choiceId || "").startsWith("skip:")) || d.choices[0];
      if (skipChoice) { pick = skipChoice; skipped += 1; }
      else { fail = { index, code: "WHITE_SKIP_NOT_FOUND", want: `${want.family} ${JSON.stringify(want.summary)}` }; break; }
    } else {
      fail = { index, code: "WHITE_CHOICE_NOT_FOUND", want: `${want.family} ${JSON.stringify(want.summary)}` };
      break;
    }
    r = kernel.composition.inputPort.submitDecision({
      decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: pick,
    });
    if (!r?.ok) { fail = { index, code: r.failure?.code || r.code, msg: r.failure?.message || "", want: `${want.family} [${want.actorId}] ${JSON.stringify(want.summary)}` }; break; }
  }
}

console.log(fail ? `失败于 #${fail.index}: ${fail.code} ${fail.msg} want=${fail.want}` : `537 步全部完成（跳过 ${skipped} 处不存在的可选效果）`);
if (fail) { kernel.dispose?.(); process.exit(1); }

const final = JSON.parse(kernel.composition.lifecycle.save().envelope.committedState);
const target = JSON.parse(v223.committedState);
console.log("\n=== 终局对比（重放 vs v223 存档）===");
let allMatch = true;
for (const p of final.players.players) {
  const orig = target.players.players.find((x) => x.id === p.id);
  const match = orig && p.resources.score === orig.resources.score
    && p.resources.credits === orig.resources.credits
    && p.resources.energy === orig.resources.energy
    && JSON.stringify((p.hand || []).map((c) => c.cardId)) === JSON.stringify((orig.hand || []).map((c) => c.cardId));
  if (!match) allMatch = false;
  console.log(`${p.id}: 分${p.resources.score} 钱${p.resources.credits} 能${p.resources.energy} 手[${(p.hand || []).map((c) => c.cardId).join(",")}] ${match ? "✓" : "✗"}`);
}
console.log(`\n整体一致: ${allMatch ? "✓ 完全一致（4 玩家全对齐）" : "✗ 有差异"}`);

console.log("\n=== 白色 scoreSources（完整拆分）===");
const w = final.players.players.find((x) => x.id === "player-white");
const wOrig = target.players.players.find((x) => x.id === "player-white");
const sources = w.scoreSources || {};
const sourceKeys = Object.keys(sources).sort();
const total = sourceKeys.reduce((a, k) => a + Number(sources[k] || 0), 0);
console.log(`键数: ${sourceKeys.length}，各来源合计: ${total}，白色总分: ${w.resources.score}`);
for (const k of sourceKeys) {
  const v = Number(sources[k] || 0);
  const old = Number((wOrig.scoreSources || {})[k] || 0);
  console.log(`  ${k}: ${v}${old !== v ? `（旧档记录 ${old}）` : ""}`);
}
console.log(`\n旧档白色 scoreSources: ${JSON.stringify(wOrig.scoreSources || {})}`);
kernel.dispose?.();

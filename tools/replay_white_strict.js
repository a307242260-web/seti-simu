"use strict";
// 验证：非白色玩家（蓝/绿/棕）宽松匹配（PASS + 随便选牌），白色严格匹配存档，
// 看白色玩家状态能否一路对齐到终局。若白色一直一致 → 非白色选择不影响白色复刻。
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
kernel.composition.inputPort.beginDrain({ metadata: { source: "white-trace" } });

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
function whiteState() {
  const st = kernel.composition.projection().state;
  const p = st.players.players.find((x) => x.id === "player-white");
  const pub = (st.cards?.publicCards || []).map((c) => (c ? `${c.cardId}:${c.id}` : "null")).join(",");
  return `sv=${st.meta.stateVersion} 分${p.resources.score} 钱${p.resources.credits} 能${p.resources.energy} 手[${(p.hand || []).map((c) => `${c.cardId}:${c.id}`).join(",")}] 公[${pub}]`;
}

let fail = null;
let looseUsed = 0;
let lastPrint = -1;
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
    if (!r?.ok) { fail = { index, code: r.failure?.code || r.code, msg: r.failure?.message || "", want: `${want.family} [${want.actorId}] ${JSON.stringify(want.summary)}` }; break; }
  } else {
    const d = insp.session.decision;
    const isWhite = want.actorId === "player-white";
    const strict = strictMatch(d, want);
    let pick;
    if (strict) pick = strict;
    else if (!isWhite) {
      // 非白色：PASS + 随便选——取第一个可选项（不严格对齐存档）
      pick = d.choices.find((c) => !c.disabledReason) || d.choices[0];
      looseUsed += 1;
    } else {
      fail = { index, code: "WHITE_CHOICE_NOT_FOUND", msg: `白色决策无匹配`, want: `${want.family} ${JSON.stringify(want.summary)}`, choices: d.choices.map((c) => String(c.target?.choiceId || c.summary || "")).slice(0, 8) };
      break;
    }
    r = kernel.composition.inputPort.submitDecision({
      decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: pick,
    });
    if (!r?.ok) { fail = { index, code: r.failure?.code || r.code, msg: r.failure?.message || "", want: `${want.family} [${want.actorId}] ${JSON.stringify(want.summary)}` }; break; }
  }
  if (want.actorId === "player-white" && index - lastPrint >= 60) {
    lastPrint = index;
    console.log(`#${index} [white] ${want.family} ${JSON.stringify(want.summary).slice(0, 22)} | ${whiteState()}`);
  }
}
console.log(fail ? `\n失败于 #${fail.index}: ${fail.code} ${fail.msg} want=${fail.want}` : "\n全部 537 步成功");
console.log(`非白色宽松匹配次数: ${looseUsed}`);
if (fail) console.log("失败时白色状态:", whiteState());
const st = kernel.composition.projection().state;
const target = JSON.parse(v223.committedState);
console.log("\n=== 白色终局对比 ===");
const w = st.players.players.find((x) => x.id === "player-white");
const wt = target.players.players.find((x) => x.id === "player-white");
console.log(`重放: 分${w.resources.score} 钱${w.resources.credits} 能${w.resources.energy} | 存档: 分${wt.resources.score} 钱${wt.resources.credits} 能${wt.resources.energy}`);
console.log(`手牌: 重放[${(w.hand || []).map((c) => c.cardId).join(",")}] vs 存档[${(wt.hand || []).map((c) => c.cardId).join(",")}]`);
console.log(`公共牌: 重放[${(st.cards?.publicCards || []).map((c) => c?.cardId).join(",")}] vs 存档[${(target.cards?.publicCards || []).map((c) => c?.cardId).join(",")}]`);
kernel.dispose?.();

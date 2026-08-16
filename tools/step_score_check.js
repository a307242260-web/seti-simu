"use strict";
// 逐步核验：每步后检查 白色 score === scoreSources 合计，第一个不等处即缺口。
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
kernel.composition.inputPort.beginDrain({ metadata: { source: "step-check" } });

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
function whiteSnap() {
  const st = kernel.composition.projection().state;
  const w = st.players.players.find((x) => x.id === "player-white");
  const sum = Object.values(w.scoreSources || {}).reduce((a, v) => a + Number(v || 0), 0);
  return { score: w.resources.score, sum, sources: { ...(w.scoreSources || {}) } };
}

let skipped = 0;
let firstMismatch = null;
let prev = null;
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
      if (want.family === "accept_optional_effect" && String(want.summary || "").startsWith("跳过") && insp.phase === "idle") { skipped += 1; continue; }
      console.log(`#${index} action失败 ${want.family} [${want.actorId}]: ${r.failure?.code} ${r.failure?.message || ""}`); process.exit(1);
    }
  } else {
    const d = insp.session.decision;
    const isWhite = want.actorId === "player-white";
    const strict = strictMatch(d, want);
    let pick;
    if (strict) pick = strict;
    else if (!isWhite) pick = d.choices.find((c) => !c.disabledReason) || d.choices[0];
    else if (want.family === "accept_optional_effect" && String(want.summary || "").startsWith("跳过")) {
      pick = d.choices.find((c) => String(c.target?.choiceId || "").startsWith("skip:")) || d.choices[0];
      if (pick) skipped += 1;
      else { console.log(`#${index} skip 无匹配`); process.exit(1); }
    } else { console.log(`#${index} 白色无匹配 ${want.family} ${JSON.stringify(want.summary)}`); process.exit(1); }
    r = kernel.composition.inputPort.submitDecision({
      decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: pick,
    });
    if (!r?.ok) { console.log(`#${index} 决策失败 ${want.family} [${want.actorId}]: ${r.failure?.code} ${r.failure?.message || ""}`); process.exit(1); }
  }
  // 白色每步后校验
  if (want.actorId === "player-white") {
    const snap = whiteSnap();
    if (prev && snap.score !== prev.score) {
      if (snap.score !== snap.sum) {
        firstMismatch = {
          index, step: `${want.family} ${JSON.stringify(want.summary || "").slice(0, 40)}`,
          score: snap.score, sum: snap.sum, delta: snap.score - prev.score, sources: snap.sources,
        };
        break;
      }
    }
    prev = snap;
  }
}
console.log(firstMismatch
  ? `首个缺口于 #${firstMismatch.index}:\n  步骤: ${firstMismatch.step}\n  score=${firstMismatch.score} sources合计=${firstMismatch.sum}（本步 +${firstMismatch.delta}）\n  sources: ${JSON.stringify(firstMismatch.sources)}`
  : "全程一致（每步 score === sources 合计）");
kernel.dispose?.();

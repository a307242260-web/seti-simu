"use strict";
// 追踪白色 techBonusScore 的每一次加分：步数、来源、分值、累计。
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
kernel.composition.inputPort.beginDrain({ metadata: { source: "tech-trace" } });

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
  return {
    score: w.resources.score,
    tech: Number(w.scoreSources?.techBonusScore || 0),
    sources: { ...(w.scoreSources || {}) },
    ownedTiles: Object.keys(w.techState?.ownedTiles || {}).filter((t) => w.techState.ownedTiles[t]),
  };
}

let skipped = 0;
let prev = null;
const events = [];
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
  if (want.actorId === "player-white") {
    const snap = whiteSnap();
    if (prev && snap.tech !== prev.tech) {
      const techIds = Object.keys(snap.ownedTiles || {}).filter((t) => !(prev.ownedTiles || []).includes(t));
      const newTiles = techIds.map((t) => {
        const techType = t.replace(/[0-9]/g, "");
        return t;
      });
      events.push({
        index,
        step: `${want.family} ${JSON.stringify(want.summary || "").slice(0, 30)}`,
        techGain: snap.tech - prev.tech,
        newTiles,
        techTotal: snap.tech,
        tiles: snap.ownedTiles.join(","),
      });
    }
    prev = snap;
  }
}

console.log("=== techBonusScore 每次加分 ===");
for (const e of events) {
  console.log(`#${String(e.index).padStart(3)} +${e.techGain} → 累计${e.techTotal}  [${e.step}] 新增科技:${e.newTiles.join(",") || "无"}`);
}
const final = kernel.composition.projection().state;
const w = final.players.players.find((x) => x.id === "player-white");
console.log(`\n终局 techBonusScore: ${w.scoreSources?.techBonusScore}`);
console.log(`终局已拥有科技: ${Object.keys(w.techState?.ownedTiles || {}).filter((t) => w.techState.ownedTiles[t]).join(",")}`);
kernel.dispose?.();

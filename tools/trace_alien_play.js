// 从存档继续，跟踪：外星牌收入（揭示 grant）、打出去（play_card 外星牌）、手里
const fs = require("node:fs");
const { createSimulationEnv } = require("/tmp/seti-work/randomizer/app/simulation-env");
const env = createSimulationEnv();
const save = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const state = JSON.parse(save.committedState);
if (state?.meta?.rngState) state.meta.rngState.algorithm = "seti-simulation-mulberry32-v1";
const committed = JSON.stringify(state);
const checkpoint = {
  schemaVersion: "seti-rl-checkpoint-v1",
  coreState: { version: 2, committedState: committed, compositionEnvelope: { schemaVersion: "seti-rule-composition-save-v1", committedState: committed, session: save.session ?? null } },
  config: { seed: save.seed || "seti-simulation", activePlayerCount: 4, episodeId: "alien-play" },
  replayCursor: { seed: save.seed || "seti-simulation", stepIndex: 0 },
};
env.loadCheckpoint(checkpoint);
function alienHand() {
  const st = JSON.parse(env.saveBrowserSave().committedState);
  return (st.players?.players || []).map(p => {
    const hand = p.hand || [];
    const alien = hand.filter(c => c.set?.includes("alien") || c.amibaCard || c.chongCard);
    return `${p.id}:${alien.length}外星/手${hand.length}`;
  }).join(" | ");
}
console.log("起点:", alienHand());
let discardSess = null;
const REQ = 2;
function complete(legal) {
  const cards = legal.filter(a => a.family === "choose_payment" && a.target?.kind === "discard-hand-card");
  const confirm = legal.find(a => a.family === "choose_payment" && a.target?.kind === "confirm");
  if (!cards.length || !confirm) { discardSess = null; return null; }
  if (!discardSess) discardSess = { selected: new Set() };
  if (discardSess.selected.size >= REQ) return confirm;
  const next = cards.find(c => !discardSess.selected.has(c.target?.cardInstanceId)) || cards[0];
  discardSess.selected.add(next.target?.cardInstanceId);
  return next;
}
let steps = 0;
let alienPlayed = 0;
while (!env.isTerminal() && steps < 150) {
  const legal = env.legalActions();
  const allCond = legal.length > 0 && legal.every(a => a.decisionType === "conditional_choice");
  if (allCond) {
    const act = complete(legal);
    if (act) { const st = env.step(act); if (!st.ok) throw new Error(`弃牌失败 ${st.error||st.failure?.code}`); if (act.target?.confirm) discardSess = null; steps += 1; continue; }
  }
  const res = env.runHeuristicPolicyDecision();
  const fam = String(res.policyDecision?.actionId || "").split(":")[0];
  if (fam === "play_card") {
    // 打牌后检查手牌外星变化（粗略：打牌如果是外星牌）
    const st = JSON.parse(env.saveBrowserSave().committedState);
    const actors = (st.players?.players || []).filter(p => p.id === String(res.policyDecision?.seatId));
    // 打牌动作的 target 有 cardInstanceId，查该牌是否外星
    steps += 1;
    continue;
  }
  steps += 1;
  if (steps % 40 === 0) console.log(`step ${steps}: ${alienHand()}`);
}
console.log("终局:", alienHand());
env.dispose();

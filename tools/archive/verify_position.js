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
  config: { seed: save.seed || "seti-simulation", activePlayerCount: 4, episodeId: "vf-pos" },
  replayCursor: { seed: save.seed || "seti-simulation", stepIndex: 0 },
};
env.loadCheckpoint(checkpoint);
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
const t0 = Date.now();
while (!env.isTerminal() && steps < 500) {
  const legal = env.legalActions();
  const allCond = legal.length > 0 && legal.every(a => a.decisionType === "conditional_choice");
  if (allCond) {
    const act = complete(legal);
    if (act) { const st = env.step(act); if (!st.ok) throw new Error(`弃牌失败 ${st.error||st.failure?.code}`); if (act.target?.confirm) discardSess = null; steps += 1; continue; }
  }
  env.runHeuristicPolicyDecision();
  steps += 1;
}
const st = JSON.parse(env.saveBrowserSave().committedState);
const players = st.players?.players || [];
const scores = players.map(p => Number(p.resources?.score) || 0);
console.log(`\n===== 从 ${process.argv[2]} 继续 ${steps} 步 (${Math.round((Date.now()-t0)/1000)}s) =====`);
console.log(`各席分: ${players.map(p => `${p.id}=${p.resources?.score}`).join(" ")} | 均分=${(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)}`);
const amiba = st.aliens?.amiba || null;
if (amiba) console.log("阿米巴 symbolSlots:", JSON.stringify(amiba.symbolSlots || {}));
const slots = st.aliens?.aliens || {};
for (const [sid, slot] of Object.entries(slots)) {
  if (slot?.traces) console.log(`slot ${sid}:`, JSON.stringify(Object.fromEntries(Object.entries(slot.traces).map(([k,v]) => [k, {first: !!v.firstPlaced, extra: v.extraCount||0}]))));
}
for (const p of players) {
  const alien = (p.hand || []).filter(c => c.set?.includes("alien") || c.amibaCard || c.chongCard).length;
  console.log(`${p.id}: 手牌外星=${alien}`);
}
env.dispose();

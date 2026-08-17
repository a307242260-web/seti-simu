// 从存档继续到终局，打印均分/外星状态（验证复用，秒级起步）
const fs = require("node:fs");
const { createSimulationEnv } = require("/tmp/seti-work/randomizer/app/simulation-env");
const outcomeModel = require("/tmp/seti-work/randomizer/game/ai/outcome-model");
const savePath = process.argv[2];
const unifiedSearch = process.argv[3] === "on";
const env = createSimulationEnv();
const save = JSON.parse(fs.readFileSync(savePath, "utf8"));
const state = JSON.parse(save.committedState);
if (state?.meta?.rngState) state.meta.rngState.algorithm = "seti-simulation-mulberry32-v1";
const committed = JSON.stringify(state);
const checkpoint = {
  schemaVersion: "seti-rl-checkpoint-v1",
  coreState: { version: 2, committedState: committed, compositionEnvelope: { schemaVersion: "seti-rule-composition-save-v1", committedState: committed, session: save.session ?? null } },
  config: { seed: save.seed || "seti-simulation", activePlayerCount: 4, episodeId: `vf-${Date.now()}`, unifiedSearch },
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
while (!env.isTerminal() && steps < 600) {
  const legal = env.legalActions();
  const allCond = legal.length > 0 && legal.every(a => a.decisionType === "conditional_choice");
  if (allCond) {
    const act = complete(legal);
    if (act) { const st = env.step(act); if (!st.ok) throw new Error(`弃牌失败 ${st.error||st.failure?.code}`); if (act.target?.confirm) discardSess = null; steps += 1; continue; }
  }
  env.runHeuristicPolicyDecision();
  steps += 1;
}
const obs = env.observe();
const players = obs.publicState?.players || [];
const scores = players.map(p => Number(p.score) || 0);
const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
console.log(`\n===== 从 ${savePath} 继续 ${steps} 步到终局 (${Math.round((Date.now()-t0)/1000)}s) =====`);
console.log(`各席: ${players.map(p => `${p.playerId||p.color}=${p.score}`).join(" ")} | 均分=${avg.toFixed(1)}`);
for (const p of players) {
  const std = outcomeModel.createDecisionObservation(obs, { seatId: String(p.playerId || p.color || "") });
  const slots = std.outcomeProjection?.progress?.alienSlots || [];
  const alienCards = std.outcomeProjection?.assets?.alienCards ?? 0;
  console.log(`${p.playerId||p.color}: 外星牌=${alienCards} 槽位=${JSON.stringify(slots.map(s => `${s.slotId}${s.revealed?"开":""}:${s.ownFirstTraces}首${s.ownExtraMarks}额外`))}`);
}
env.dispose();

// 全盘跑 + 每 N 步存档（验证复用，避免每次从头跑 10 分钟）
const fs = require("node:fs");
const { createSimulationEnv } = require("/tmp/seti-work/randomizer/app/simulation-env");
const { createStepProgressReporter } = require("./progress");
const unifiedSearch = process.argv[2] === "on";
const every = Number(process.argv[3] || 100);
const outDir = `/tmp/checkpoints/${unifiedSearch ? "on" : "off"}`;
fs.mkdirSync(outDir, { recursive: true });
const env = createSimulationEnv();
env.reset({ seed: "seti-free-analyze-v1", activePlayerCount: 4, episodeId: `ck-${unifiedSearch}`, unifiedSearch });
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
// 持续进度输出（stderr）：单次决策可能耗时数秒，逐决策行让终端实时可见而非"卡住"。
const progress = createStepProgressReporter({ label: `ck-${unifiedSearch ? "on" : "off"}` });
while (!env.isTerminal() && steps < 1000) {
  const legal = env.legalActions();
  const allCond = legal.length > 0 && legal.every(a => a.decisionType === "conditional_choice");
  if (allCond) {
    const act = complete(legal);
    if (act) { const st = env.step(act); if (!st.ok) throw new Error(`弃牌失败 ${st.error||st.failure?.code}`); if (act.target?.confirm) discardSess = null; steps += 1; continue; }
  }
  env.runHeuristicPolicyDecision();
  steps += 1;
  const obs = env.observe();
  const ps = obs.publicState || {};
  progress.report({
    steps,
    maxSteps: 1000,
    round: ps.roundNumber,
    turn: ps.turnNumber,
    scores: (ps.players || []).map((p) => ({
      label: p.playerLabel || p.playerId || p.color,
      score: p.score ?? p.finalScore ?? "?",
    })),
    startedAt: t0,
  });
  if (steps % every === 0) {
    const save = env.saveBrowserSave();
    fs.writeFileSync(`${outDir}/step-${steps}.json`, JSON.stringify(save));
    const white = ps.players?.find(p => String(p.playerId||p.color||"") === "player-white");
    console.log(`[ck] step=${steps} round=${ps.roundNumber} white=${white?.score} ${Math.round((Date.now()-t0)/1000)}s`);
  }
}
console.log(`完成 ${steps} 步, 存档在 ${outDir}`);
env.dispose();

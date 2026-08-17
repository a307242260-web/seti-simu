"use strict";
// 模拟跑完整局并同浏览器格式存盘（seti-browser-save-v2）。
// 用法: node tools/run_simulate_save.js [tag] [--name 存档名] [--no-save]
//   - 默认 tag=baseline，存档写 seti-saves/seti-save-<name>-v<sv>.json
//   - 输出: 各玩家终局分/科技/行动统计 + 外星人时间线 + 均分
//   - 存档可被 tools/load_save_simulation.js 直接读取继续打或查中间过程
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");

const args = process.argv.slice(2);
const tag = args[0] || "baseline";
const nameArg = args.indexOf("--name");
const saveName = nameArg >= 0 ? args[nameArg + 1] : null;
const noSave = args.includes("--no-save");

const env = createSimulationEnv();
env.reset({ seed: "seti-free-analyze-v1", activePlayerCount: 4, episodeId: `sim-save-${tag}` });

const famsBySeat = {};
const researchSeq = [];
const traceEvents = []; // {step, seat, slotId, tt, owner}
const revealEvents = []; // {step, seat, slotId, alienId}
const lastTraceOwner = new Map();

function slotsOf(obs) {
  return obs?.publicState?.board?.aliens?.slots || obs?.publicState?.aliens?.slots || [];
}

let decisions = 0;
const t0 = Date.now();
while (!env.isTerminal() && decisions < 4000) {
  const res = env.runHeuristicPolicyDecision();
  const pd = res.policyDecision;
  const seat = String(pd?.seatId || "");
  const fam = String(pd?.actionId || "").split(":")[0];
  famsBySeat[seat] = famsBySeat[seat] || {};
  famsBySeat[seat][fam] = (famsBySeat[seat][fam] || 0) + 1;
  if (seat === "player-white" && fam === "research_tech") researchSeq.push(decisions);
  // 外星人状态追踪（用 res.observation，提交后）
  const slots = slotsOf(res.observation);
  for (const [idx, slot] of slots.entries()) {
    if (!slot) continue;
    for (const [tt, t] of Object.entries(slot.traces || {})) {
      if (!t || !t.firstPlaced) continue;
      const key = `${idx + 1}:${tt}`;
      const owner = t.ownerPlayerColor || "?";
      if (lastTraceOwner.get(key) !== owner) {
        lastTraceOwner.set(key, owner);
        traceEvents.push({ step: decisions, seat, slotId: idx + 1, tt, owner });
      }
    }
    if (slot.revealed && slot.alienId) {
      const rk = `slot${idx + 1}:${slot.alienId}`;
      if (!revealEvents.some((e) => e.k === rk)) {
        revealEvents.push({ k: rk, step: decisions, seat, slotId: idx + 1, alienId: slot.alienId });
      }
    }
  }
  decisions += 1;
}

const terminal = env.observe();
const rows = terminal.publicState.players.map((p) => {
  const fams = famsBySeat[p.playerId] || {};
  const total = Object.values(fams).reduce((a, b) => a + b, 0);
  return {
    label: p.playerLabel, score: p.finalScore ?? p.score,
    tech: Object.keys(p.techState?.ownedTiles || {}), bb: p.dataProgress?.blueBonusCount,
    scan: fams.scan || 0, placeData: fams.place_data || 0, playCard: fams.play_card || 0,
    research: fams.research_tech || 0, total,
    alienSources: Object.entries(p.scoreSources || {})
      .filter(([k]) => /alien|trace/i.test(k))
      .map(([k, v]) => `${k}:${v}`).join(" ") || "-",
  };
});
const avg = (rows.reduce((a, r) => a + r.score, 0) / rows.length).toFixed(1);

console.log(`[${tag}] 均分=${avg} 决策=${decisions} ${Math.round((Date.now() - t0) / 1000)}s`);
for (const r of rows) {
  console.log(`  ${r.label}: ${r.score} tech=${r.tech.join("+") || "-"} scan=${r.scan} pd=${r.placeData} pc=${r.playCard} res=${r.research} bb=${r.bb} act=${r.total}`);
  console.log(`    外星来源: ${r.alienSources}`);
}
console.log("  白色研究步:", researchSeq.join(","));
console.log(`\n=== 外星人时间线 ===`);
if (!traceEvents.length) console.log("  （无首痕迹放置）");
for (const e of traceEvents) console.log(`  step ${e.step} seat=${e.seat} slot${e.slotId} ${e.tt} → ${e.owner}`);
if (!revealEvents.length) console.log("  （从未揭示外星人）");
for (const e of revealEvents) console.log(`  step ${e.step} seat=${e.seat} slot${e.slotId} = ${e.alienId}`);

// 存盘（与浏览器同格式）
let savePath = null;
if (!noSave) {
  const payload = env.saveBrowserSave({ name: saveName || `sim-${tag}` });
  const sv = payload.stateVersion ?? 0;
  const safe = (payload.name || "game")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "game";
  savePath = path.join(__dirname, "..", "seti-saves", `seti-save-${safe}-v${sv}.json`);
  fs.writeFileSync(savePath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\n存档: ${path.relative(path.join(__dirname, ".."), savePath)}`);
}

env.dispose();

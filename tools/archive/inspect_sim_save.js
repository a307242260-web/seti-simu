"use strict";
// 读模拟存档（seti-browser-save-v2，tools/run_simulate_save.js 产出）离线分析：
// 用法:
//   node tools/inspect_sim_save.js <save-file>                 # 汇总 + 外星人时间线
//   node tools/inspect_sim_save.js <save-file> --steps N       # 打印前 N 步白色动作
//   node tools/inspect_sim_save.js <save-file> --round R       # 第 R 回合白色动作
//   node tools/inspect_sim_save.js <save-file> --aliens        # 只打印外星人时间线
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const saveFile = args[0];
if (!saveFile) {
  console.log("用法: node tools/inspect_sim_save.js <save-file> [--steps N|--round R|--aliens]");
  process.exit(1);
}
const save = JSON.parse(fs.readFileSync(path.resolve(saveFile), "utf8"));
if (save.schema !== "seti-browser-save-v2") {
  console.error(`不支持的存档 schema: ${save.schema}`);
  process.exit(1);
}
const steps = save.replaySteps || [];
const state = save.readableState || (() => { try { return JSON.parse(save.committedState); } catch { return null; } })();

const modeSteps = args.indexOf("--steps");
const modeRound = args.indexOf("--round");
const onlyAliens = args.includes("--aliens");

// 外星人状态从每步 after.aliens 摘要重建时间线（模拟存档带 aliens 字段）。
function alienTimeline() {
  const events = []; // {step, seat, kind, detail}
  let prev = null;
  for (const s of steps) {
    const aft = s.after || {};
    const aliens = aft.aliens || null;
    if (!aliens) continue;
    const key = JSON.stringify(aliens);
    if (key === prev) continue;
    prev = key;
    // 找与上一步不同的槽位/痕迹
    const detail = aliens.map((slot, idx) => {
      const parts = [];
      for (const [tt, t] of Object.entries(slot?.traces || {})) {
        if (t?.firstPlaced) parts.push(`${tt}:${t.ownerPlayerColor || "?"}`);
      }
      return `slot${idx + 1}[${slot.revealed ? (slot.alienId || "✓") : "?"}{${parts.join(",") || "-"}}]`;
    }).join(" ");
    events.push({ step: s.stepIndex ?? steps.indexOf(s), seat: s.actorPlayerId, detail });
  }
  return events;
}

function alienFinal() {
  const aliens = state?.aliens?.aliens || {};
  const parts = [];
  for (const [slotId, slot] of Object.entries(aliens)) {
    if (!slot) continue;
    const id = slot.revealed ? (slot.alienId || slot.assignedAlienId || "?") : "?";
    const traces = Object.entries(slot.traces || {})
      .filter(([tt, t]) => t && t.firstPlaced)
      .map(([tt, t]) => `${tt}:${t.ownerPlayerColor || "?"}`)
      .join(",");
    parts.push(`slot${slotId}[${id}${slot.revealed ? "✓" : ""} traces{${traces || "-"}}]`);
  }
  return parts.join(" ");
}

function stepLabel(s) {
  const a = s.action || {};
  const fam = a.family || String(a.actionId || "").split(":")[0] || "?";
  const summary = a.summary || s.summary || "";
  const target = a.target ? JSON.stringify(a.target).slice(0, 60) : "";
  const aft = s.after || {};
  const white = aft.p?.["player-white"] || [];
  const stateStr = white.length
    ? `R${aft.r ?? "?"} 分${white[0]} 钱${white[1]} 能${white[2]} 宣${white[3]} 手${white[4]} 留${white[5]}`
    : "";
  return `#${s.stepIndex ?? "?"} [${s.actorPlayerId || "?"}] ${fam} ${String(summary).slice(0, 50)} ${target} | ${stateStr}`;
}

console.log(`存档: ${path.basename(saveFile)} seed=${save.seed} sv=${save.stateVersion} 步=${steps.length}`);
console.log(`终局外星人: ${alienFinal()}`);

const whiteSteps = steps.filter((s) => s.actorPlayerId === "player-white");

if (onlyAliens) {
  const timeline = alienTimeline();
  console.log(`\n=== 外星人状态变化时间线（${timeline.length} 处变化）===\n`);
  for (const e of timeline) console.log(`step ${e.step} [${e.seat}] ${e.detail}`);
  // 外星人相关动作（从 action summary/target 里找）
  const alienSteps = whiteSteps.filter((s) => {
    const txt = JSON.stringify(s.action || {}) + JSON.stringify(s.summary || "");
    return /trace|痕迹|alien|阿米巴|虫|盲抽|外星/i.test(txt);
  });
  console.log(`\n=== 白色外星人相关动作（${alienSteps.length} 个）===\n`);
  for (const s of alienSteps) console.log(stepLabel(s));
  process.exit(0);
}

// 按回合分组打印白色动作
if (modeSteps >= 0) {
  const n = Number(args[modeSteps + 1] || 20);
  console.log(`\n=== 白色前 ${n} 步 ===\n`);
  for (const s of whiteSteps.slice(0, n)) console.log(stepLabel(s));
} else if (modeRound >= 0) {
  const round = Number(args[modeRound + 1] || 1);
  console.log(`\n=== 第 ${round} 回合白色动作 ===\n`);
  let shown = 0;
  for (const s of whiteSteps) {
    const aft = s.after || {};
    if (aft.r !== round) continue;
    shown += 1;
    console.log(stepLabel(s));
  }
  if (!shown) console.log("  （无）");
} else {
  // 汇总
  console.log("\n=== 玩家终局 ===");
  const players = state?.players?.players || [];
  for (const p of players) {
    const ss = p.scoreSources || {};
    const alienParts = Object.entries(ss).filter(([k]) => /alien|trace/i.test(k)).map(([k, v]) => `${k}:${v}`).join(" ");
    console.log(`${p.id}: 分${p.resources.score} 收${p.income.credits}/${p.income.energy} 科技[${Object.keys(p.techState?.ownedTiles || {}).join("+") || "-"}] 外星[${alienParts || "-"}]`);
  }
  console.log("\n=== 白色每回合首个动作 + 回合末状态 ===");
  let lastRound = null;
  for (const s of whiteSteps) {
    const aft = s.after || {};
    if (aft.r !== lastRound) {
      lastRound = aft.r;
      console.log(`\n── 第 ${aft.r} 回合 ──`);
    }
    console.log(stepLabel(s));
  }
}

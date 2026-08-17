"use strict";
// 读取浏览器存档（seti-saves/*.json, seti-browser-save-v2）并加载进 Simulation env。
// 用法:
//   node tools/load_save_simulation.js <save-file>            # 加载并打印状态
//   node tools/load_save_simulation.js <save-file> --run-ai   # 加载并让 AI 打完整局
//   node tools/load_save_simulation.js <save-file> --decide <N>  # 加载并让 AI 决策 N 步
//   node tools/load_save_simulation.js <save-file> --history <round>  # 打印指定轮(默认1-3)的逐行动历史
const fs = require("node:fs");
const path = require("node:path");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");

function loadSave(env, savePath) {
  const raw = fs.readFileSync(savePath, "utf8");
  const save = JSON.parse(raw);
  if (save.schema !== "seti-browser-save-v2") {
    throw new Error(`不支持的存档 schema: ${save.schema}`);
  }
  const state = JSON.parse(save.committedState);
  // 浏览器与 simulation 的 mulberry32 同源，仅算法标签不同；统一标签以便恢复 RNG。
  if (state?.meta?.rngState) {
    state.meta.rngState.algorithm = "seti-simulation-mulberry32-v1";
  }
  const committed = JSON.stringify(state);
  const checkpoint = {
    schemaVersion: "seti-rl-checkpoint-v1",
    coreState: {
      version: 2,
      committedState: committed,
      compositionEnvelope: {
        schemaVersion: "seti-rule-composition-save-v1",
        committedState: committed,
        session: save.session ?? null,
      },
    },
    config: {
      seed: save.seed || state?.meta?.seed || "seti-simulation",
      activePlayerCount: Number(state?.turn?.activePlayerCount) || 4,
      episodeId: `save:${path.basename(savePath, ".json")}`,
    },
    replayCursor: { seed: save.seed || "seti-simulation", stepIndex: 0 },
    replaySteps: null,
    // 浏览器格式历史原样带进恢复后的 env：续玩后再 saveBrowserSave，存档
    // replaySteps = 历史（开局→读档点）+ 新步骤，完整不丢。
    browserReplaySteps: Array.isArray(save.replaySteps) ? save.replaySteps : [],
  };
  const obs = env.loadCheckpoint(checkpoint);
  return { save, state, obs };
}

function printReplayHistory(save, roundFilter) {
  const steps = save.replaySteps || [];
  if (!steps.length) {
    console.log("存档无 replaySteps（旧格式，无逐行动历史）");
    return;
  }
  console.log(`replaySteps: ${steps.length} 步`);
  const famCount = {};
  for (const s of steps) {
    const fam = s.action?.family || s.action?.choiceId || "?";
    famCount[fam] = (famCount[fam] || 0) + 1;
  }
  console.log(`按 family 统计: ${JSON.stringify(famCount)}`);
  // 按 round 分组：需要每步的 round——重放才能拿到，这里用 step 顺序打印
  const start = Number(roundFilter) || 0;
  const filter = roundFilter
    ? (s, i) => { const perRound = Math.ceil(steps.length / 3); return Math.floor(i / perRound) + 1 === Number(roundFilter); }
    : () => true;
  let shown = 0;
  for (let i = 0; i < steps.length && shown < 80; i++) {
    const s = steps[i];
    if (!filter(s, i)) continue;
    const a = s.action || {};
    shown += 1;
    const aft = s.after || {};
    const white = aft.p && aft.p["player-white"];
    const stateStr = white
      ? ` 白色[分${white[0]} 钱${white[1]} 能${white[2]} 宣${white[3]} 手${white[4]} 留${white[5]}]`
      : "";
    console.log(`  #${i} R${aft.r ?? "?"}T${aft.t ?? "?"} [${s.actorPlayerId || "?"}] ${a.family || "?"} ${stateStr} ${a.target ? JSON.stringify(a.target).slice(0, 60) : ""}`);
  }
}

function printState(obs) {
  const st = obs.publicState;
  console.log(`round=${st.roundNumber} turn=${st.turnNumber} current=${st.currentPlayerId} ended=${Boolean(st.terminal)}`);
  for (const p of st.players) {
    console.log(
      `  ${p.playerId}: score=${p.score} secured=${p.securedEndGameBonus}`
      + ` credits=${p.credits} energy=${p.energy} publicity=${p.publicity}`
      + ` data=${p.availableData} hand=${p.handCount} reserved=${p.reservedCount}`,
    );
  }
  const legal = (() => { try { return env.legalActions(); } catch { return []; } })();
  if (legal.length) {
    const byFamily = {};
    for (const a of legal) byFamily[a.family] = (byFamily[a.family] || 0) + 1;
    console.log(`legal: ${legal.length} | ${JSON.stringify(byFamily)}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const saveFile = args[0];
  const mode = args[1] || "";
  if (!saveFile) {
    console.log("用法: node tools/load_save_simulation.js <save-file> [--run-ai|--decide N]");
    process.exit(1);
  }
  const env = createSimulationEnv();
  const { obs, save } = loadSave(env, saveFile);
  printState(obs);

  if (mode === "--history") {
    printReplayHistory(save, args[2]);
    env.dispose();
    return;
  }
  if (mode === "--run-ai") {
    let count = 0;
    while (!env.isTerminal() && count < 400) {
      env.runHeuristicPolicyDecision();
      count += 1;
    }
    const terminal = env.observe();
    console.log(`\nAI 终局 (decisions=${count}):`);
    for (const p of terminal.publicState.players) {
      console.log(`  ${p.playerId}: score=${p.score} secured=${p.securedEndGameBonus} total=${(p.score || 0) + (p.securedEndGameBonus || 0)}`);
    }
  } else if (mode === "--decide") {
    const n = Number(args[2] || 1);
    for (let i = 0; i < n && !env.isTerminal(); i++) {
      const res = env.runHeuristicPolicyDecision();
      console.log(`d${i} [${res.policyDecision.seatId}] ${res.policyDecision.actionId}`);
    }
  }
  env.dispose();
}

main();

#!/usr/bin/env node
"use strict";

/**
 * 机器人调研验证工具（对齐调研流程，2026-08-17 用户确认）：
 *
 *   1) 每次调研默认跑 200 步快速验证（--steps N 可调）验证效果方向；
 *   2) 行为方向合理（有机会）时用 --full 跑全盘验证——若已有同实验快速记录，
 *      自动从快速记录存档续跑，不重跑前 200 步；
 *   3) 每次验证都落盘记录（默认 reports/research/），供 --list/--show 复盘；
 *   4) 同一实验绝不重跑：指纹 = seed + activePlayerCount + aiDifficulty +
 *      policyVersion + config 开关；同指纹同模式已存在记录时拒绝执行
 *      （--force 才允许覆盖）。全盘记录已存在时快速验证视为被覆盖，同样拒绝。
 *
 * 用法：
 *   node tools/run_research_validation.js --name baseline                     # 默认 200 步快速验证
 *   node tools/run_research_validation.js --name baseline --full              # 全盘验证
 *   node tools/run_research_validation.js --list                              # 列出全部记录
 *   node tools/run_research_validation.js --show <name|指纹前缀>               # 查看某记录
 *   node tools/run_research_validation.js --name x --config k=v,k2=v2 --steps 300 --force
 *
 * 可选参数：
 *   --seed <seed>      盘面 seed，默认 seti-free-analyze-v1
 *   --config k=v,...   行为配置开关：planContinuationFastPath /
 *                      planNewTurnReuse / vStateValueEnabled /
 *                      traceCounterfactualGoalClusters / compactReplay /
 *                      aiDifficulty / activePlayerCount（搜索机制统一，
 *                      无 unifiedSearch 分桶开关）
 *   --steps <N>        快速验证步数，默认 200（--full 时忽略）
 *   --full             全盘验证（跑到终局，安全上限 4000 决策）
 *   --force            允许覆盖已有同指纹记录（会写明覆盖原因）
 *   --no-save          不写 seti-saves 存档（默认写，快速验证存档供全盘续跑）
 *   --records-dir <p>  记录目录，默认 reports/research/
 *
 * 记录 schema：seti-research-validation-record-v1（见 RECORD_SCHEMA_VERSION）。
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const heuristicPolicy = require("../randomizer/game/ai/heuristic-policy");
const { createStepProgressReporter } = require("./progress");

const RECORD_SCHEMA_VERSION = "seti-research-validation-record-v1";
const DEFAULT_SEED = "seti-free-analyze-v1";
const DEFAULT_STEPS = 200;
const MAX_DECISIONS = 4000;
let RECORDS_DIR = path.join(__dirname, "..", "reports", "research");
const SAVES_DIR = path.join(__dirname, "..", "seti-saves");
const POLICY_VERSION = heuristicPolicy.POLICY_VERSION;

const FLAG_KEYS = [
  "planContinuationFastPath",
  "planNewTurnReuse",
  "vStateValueEnabled",
  "traceCounterfactualGoalClusters",
  "compactReplay",
];
const IDENTITY_KEYS = ["seed", "activePlayerCount", "aiDifficulty", "policyVersion"];

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function stableSerialize(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  )).join(",")}}`;
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
    }).trim();
  } catch (_error) {
    return null;
  }
}

function parseConfig(raw) {
  const config = {};
  for (const pair of String(raw || "").split(",")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) throw new Error(`--config 需要 k=v 格式：${pair}`);
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!FLAG_KEYS.includes(key) && !["aiDifficulty", "activePlayerCount"].includes(key)) {
      throw new Error(`未知配置键：${key}（允许：${[...FLAG_KEYS, "aiDifficulty", "activePlayerCount"].join(", ")}）`);
    }
    config[key] = value === "true" ? true
      : value === "false" ? false
        : /^-?\d+$/.test(value) ? Number(value)
          : value;
  }
  return config;
}

function buildIdentity(options) {
  const config = { ...options.config };
  const identity = {
    seed: options.seed || DEFAULT_SEED,
    activePlayerCount: Number(config.activePlayerCount || 4),
    aiDifficulty: config.aiDifficulty || "laughable",
    policyVersion: POLICY_VERSION,
    flags: {},
    gitCommit: gitCommit() || "dirty",
  };
  for (const key of FLAG_KEYS) {
    if (config[key] !== undefined) identity.flags[key] = config[key];
  }
  return identity;
}

function fingerprintOf(identity) {
  const payload = {};
  for (const key of IDENTITY_KEYS) payload[key] = identity[key];
  payload.flags = identity.flags;
  // 指纹含 gitCommit：同一实验（seed+policy+flags）不同代码版本产生不同指纹，
  // 记录天然隔离（2026-08-20 缺陷修复——此前指纹不含 commit，行为变化会静默
  // 覆盖旧记录或拒绝重跑，无法追溯每条记录对应的精确代码版本）。
  payload.gitCommit = identity.gitCommit || "dirty";
  return sha256(stableSerialize(payload));
}

function recordFileOf(fingerprint, mode, commit) {
  const suffix = commit ? `.${String(commit).slice(0, 8)}` : "";
  return path.join(RECORDS_DIR, `${fingerprint.slice(0, 8)}${suffix}.${mode}.json`);
}

function modeOf(options) {
  return options.full ? "full" : `quick-${options.steps}`;
}

function listRecords() {
  if (!fs.existsSync(RECORDS_DIR)) return [];
  return fs.readdirSync(RECORDS_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(RECORDS_DIR, file), "utf8"));
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function findRecord(fingerprint, mode, commit) {
  const file = recordFileOf(fingerprint, mode, commit);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function findRecordByFingerprint(fingerprint) {
  return listRecords().find((record) => record.fingerprint === fingerprint) || null;
}

// ---------------------------------------------------------------------------
// 指标收集
// ---------------------------------------------------------------------------

function createCollector() {
  return {
    famsBySeat: {},
    whiteQuickTrade: 0,
    whiteResearchSteps: [],
    traceEvents: [],       // {step, seat, slotId, tt, owner}
    revealEvents: [],      // {step, seat, slotId, alienId}
    lastTraceOwner: new Map(),
    revealedKeys: new Set(),
    budgetHits: [],        // 反事实搜索触顶 maxExecutionNodes 的决策（用户裁定：触碰 4096 截断要记录并在终局输出）
    searches: [],          // 仅本次真实evaluate；计划复用不重复记数。
  };
}

function slotsOf(obs) {
  return obs?.publicState?.board?.aliens?.slots || obs?.publicState?.aliens?.slots || [];
}

function familyOf(actionId) {
  return String(actionId || "").split(":")[0] || "<none>";
}

// 记录一步决策的指标（stepIndex 从 1 开始）。
function collectStep(collector, stepIndex, result) {
  const pd = result?.policyDecision || {};
  const seat = String(pd.seatId || "");
  const fam = familyOf(pd.actionId);
  collector.famsBySeat[seat] = collector.famsBySeat[seat] || {};
  collector.famsBySeat[seat][fam] = (collector.famsBySeat[seat][fam] || 0) + 1;
  if (seat === "player-white" && fam === "quick_trade") collector.whiteQuickTrade += 1;
  if (seat === "player-white" && fam === "research_tech") collector.whiteResearchSteps.push(stepIndex);
}

// 按本次evaluate列表记录控制/策略搜索；计划复用为[]，不能读取上次缓存诊断。
// budgetHits沿用“执行触顶且仍有frontier”；满额分布从searches按实际节点上限筛选。
function collectBudgetHits(collector, stepIndex, result) {
  if (!Array.isArray(result?.searches)) throw new Error("RESEARCH_SEARCH_STATISTICS_MISSING: 缺少本次搜索列表");
  const pd = result?.policyDecision || {};
  for (const [index, search] of result.searches.entries()) {
    const diag = search.diagnostics;
    if (!diag) throw new Error("RESEARCH_SEARCH_STATISTICS_MISSING: 本次evaluate没有诊断");
    const identity = { step: stepIndex, searchIndex: index,
      seat: String(pd.seatId || "?"), action: String(pd.actionId || "") };
    collector.searches.push({ ...identity, ...structuredClone(search) });
    if (diag.executionLimitReached === true) collector.budgetHits.push({
      ...identity, kind: search.kind,
      executedNodeCount: diag.executedNodeCount,
      maxExecutionNodes: diag.maxExecutionNodes,
      frontierOriginCountByFamily: structuredClone(diag.frontierOriginCountByFamily || null),
    });
  }
}

// 从观测更新外星人时间线（trace 首放事件 / 揭示事件）。
function collectAliens(collector, stepIndex, obs, seat) {
  const slots = slotsOf(obs);
  for (const [idx, slot] of slots.entries()) {
    if (!slot) continue;
    for (const [tt, trace] of Object.entries(slot.traces || {})) {
      if (!trace || !trace.firstPlaced) continue;
      const key = `${idx + 1}:${tt}`;
      const owner = trace.ownerPlayerColor || "?";
      if (collector.lastTraceOwner.get(key) !== owner) {
        collector.lastTraceOwner.set(key, owner);
        collector.traceEvents.push({ step: stepIndex, seat, slotId: idx + 1, tt, owner });
      }
    }
    if (slot.revealed && slot.alienId) {
      const rk = `slot${idx + 1}:${slot.alienId}`;
      if (!collector.revealedKeys.has(rk)) {
        collector.revealedKeys.add(rk);
        collector.revealEvents.push({ step: stepIndex, seat, slotId: idx + 1, alienId: slot.alienId });
      }
    }
  }
}

// 把已有 collector 的状态（fams / 时间线）播种到新 collector（用于全盘续跑时合并）。
function seedCollectorFrom(collector, source) {
  if (!Array.isArray(source.searches)) throw new Error("RESEARCH_SEARCH_STATISTICS_MISSING: 旧快速记录无法补齐逐次统计，不允许冒充完整覆盖");
  collector.searches.push(...structuredClone(source.searches));
  for (const [seat, fams] of Object.entries(source.famsBySeat || {})) {
    collector.famsBySeat[seat] = collector.famsBySeat[seat] || {};
    for (const [fam, count] of Object.entries(fams)) {
      collector.famsBySeat[seat][fam] = (collector.famsBySeat[seat][fam] || 0) + count;
    }
  }
  collector.whiteQuickTrade += Number(source.whiteQuickTrade) || 0;
  for (const step of source.whiteResearchSteps || []) collector.whiteResearchSteps.push(step);
  for (const event of source.traceEvents || []) {
    collector.lastTraceOwner.set(`${event.slotId}:${event.tt}`, event.owner);
    collector.traceEvents.push(event);
  }
  for (const event of source.revealEvents || []) {
    collector.revealedKeys.add(`slot${event.slotId}:${event.alienId}`);
    collector.revealEvents.push(event);
  }
  for (const hit of source.budgetHits || []) collector.budgetHits.push(hit);
}

function seatScores(obs) {
  const players = obs?.publicState?.players || [];
  const scores = {};
  for (const p of players) {
    const id = p.playerId || p.id || p.color;
    if (!id) continue;
    scores[id] = Number(p.finalScore ?? p.score) || 0;
  }
  return scores;
}

function summaryOf(obs) {
  const players = obs?.publicState?.players || [];
  const scores = seatScores(obs);
  const avg = players.length
    ? Object.values(scores).reduce((sum, score) => sum + score, 0) / players.length
    : 0;
  return {
    round: obs?.publicState?.roundNumber ?? null,
    terminal: Boolean(obs?.publicState?.terminal || obs?.terminal),
    scores,
    avgScore: Number(avg.toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// 运行
// ---------------------------------------------------------------------------

function buildSavePath(options, name, mode, stateVersion) {
  const safe = String(name || "game")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "game";
  // 存档名带 gitCommit 前缀（2026-08-21 用户要求"不同版本分文件/分目录存档"）：
  // <name>-<commit8>-<mode>-v<stateVersion>，杜绝"这个档是哪个版本跑的"混乱。
  const commit = String(gitCommit() || "dirty").slice(0, 8);
  return path.join(SAVES_DIR, `seti-save-research-${safe}-${commit}-${mode}-v${stateVersion}.json`);
}

// 从浏览器存档构建 checkpoint（与 tools/load_save_simulation.js 同构）。
function checkpointFromSave(save, resetConfig) {
  const state = JSON.parse(save.committedState);
  if (state?.meta?.rngState) {
    state.meta.rngState.algorithm = "seti-simulation-mulberry32-v1";
  }
  const committed = JSON.stringify(state);
  return {
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
    config: resetConfig,
    replayCursor: { seed: save.seed || resetConfig.seed, stepIndex: 0 },
    replaySteps: null,
    // 浏览器格式历史原样带进恢复后的 env：续跑后再存盘，replaySteps 完整不丢。
    browserReplaySteps: Array.isArray(save.replaySteps) ? save.replaySteps : [],
  };
}

function runValidation(options) {
  const identity = buildIdentity(options);
  const fingerprint = fingerprintOf(identity);
  const mode = modeOf(options);
  const commit = identity.gitCommit;
  const recordPath = recordFileOf(fingerprint, mode, commit);

  // ---- 去重（绝不跑同一个实验同一代码版本多遍）----
  // 指纹含 gitCommit：同 seed+policy+flags 不同代码版本 → 不同指纹 → 各自留档，
  // 互不覆盖（2026-08-20 缺陷修复，此前指纹不含 commit，行为变化会被误判为
  // 同一实验而拒绝重跑或 --force 覆盖旧记录）。
  const existing = findRecord(fingerprint, mode, commit);
  if (existing && !options.force) {
    console.log(`[skip] 同一实验同一代码版本同模式已存在记录（指纹 ${fingerprint.slice(0, 12)}，${mode}），不重跑。`);
    console.log(`  记录: ${path.relative(path.join(__dirname, ".."), recordPath)}  createdAt=${existing.createdAt} gitCommit=${existing.gitCommit}`);
    console.log(`  如需强制重跑请加 --force（并在提交说明里写明覆盖原因）。`);
    process.exit(2);
  }
  const fullExisting = options.full ? null : findRecord(fingerprint, "full", commit);
  if (fullExisting && !options.force) {
    console.log(`[skip] 该实验该代码版本已有全盘记录（${fullExisting.createdAt}），快速验证被全盘覆盖，不重跑。`);
    console.log(`  记录: ${path.relative(path.join(__dirname, ".."), recordFileOf(fingerprint, "full", commit))}`);
    console.log(`  如需强制快速验证请加 --force。`);
    process.exit(2);
  }
  if (existing && options.force) {
    // --force 覆盖前自动备份旧记录，保留对比基准（2026-08-20 缺陷修复）。
    const backupPath = `${recordPath}.bak-${Date.now()}`;
    try {
      fs.copyFileSync(recordPath, backupPath);
      console.log(`[backup] 覆盖前备份旧记录 → ${path.relative(path.join(__dirname, ".."), backupPath)}`);
    } catch (_error) {
      // 旧记录刚被并发删除/不存在时跳过备份（不阻断本次运行）。
    }
  }

  // ---- 全盘续跑：优先复用同实验任意快速记录的存档 ----
  let resumedFrom = null;
  let resumeStep = 0;
  const quickRecord = options.full && !options.noSave
    ? listRecords().find((r) => (
      r.fingerprint === fingerprint
      && String(r.mode).startsWith("quick-")
      && r.savePath
      && fs.existsSync(path.join(__dirname, "..", r.savePath))
    ))
    : null;
  if (quickRecord) {
    resumedFrom = quickRecord.savePath;
    resumeStep = Number(quickRecord.steps) || 0;
    console.log(`[resume] 从快速验证存档续跑（前 ${resumeStep} 步不重跑）：${quickRecord.savePath}`);
  }

  // ---- 运行 ----
  const env = createSimulationEnv();
  const resetConfig = {
    seed: identity.seed,
    activePlayerCount: identity.activePlayerCount,
    aiDifficulty: identity.aiDifficulty,
    policyVersion: identity.policyVersion,
    episodeId: `research-${options.name || fingerprint.slice(0, 8)}-${Date.now()}`,
    ...identity.flags,
  };

  const startedAt = Date.now();
  const collector = createCollector();
  let steps = 0;
  let terminal = false;
  let savePath = null;

  try {
    if (resumedFrom) {
      const save = JSON.parse(fs.readFileSync(path.join(__dirname, "..", resumedFrom), "utf8"));
      env.loadCheckpoint(checkpointFromSave(save, resetConfig));
      steps = resumeStep;
      seedCollectorFrom(collector, quickRecord.metrics);
      console.log(`[resume] 存档加载完成，当前：R${env.observe()?.publicState?.roundNumber ?? "?"} 步 ${steps}`);
    } else {
      env.reset(resetConfig);
    }

    const limit = options.full ? MAX_DECISIONS : options.steps;
    // 持续进度输出（stderr）：单次决策可能耗时数秒，逐决策行让终端实时可见而非"卡住"；
    // 与 --progress 的固定步数节流并存（--progress 保持原语义）。
    const progress = createStepProgressReporter({ label: mode, minIntervalMs: 1000 });
    while (!env.isTerminal() && steps < limit) {
      const obsBefore = env.observe();
      const seat = obsBefore?.decision?.actorPlayerId || null;
      const result = env.runHeuristicPolicyDecision();
      steps += 1;
      collectStep(collector, steps, result);
      collectBudgetHits(collector, steps, result);
      const obsAfter = result?.observation || env.observe();
      collectAliens(collector, steps, obsAfter, seat);
      const ps = obsAfter?.publicState || {};
      progress.report({
        steps,
        maxSteps: limit,
        round: ps.roundNumber,
        turn: ps.turnNumber,
        seat,
        action: String(result?.policyDecision?.actionId || ""),
        scores: (ps.players || []).map((p) => ({
          label: p.playerLabel || p.playerId || p.color,
          score: p.score ?? p.finalScore ?? "?",
        })),
        startedAt,
      });
      if (options.progressEvery > 0 && steps % options.progressEvery === 0) {
        const sum = summaryOf(env.observe());
        process.stderr.write(
          `[progress] mode=${mode} step=${steps} round=${sum.round} avg=${sum.avgScore}\n`,
        );
      }
    }
    terminal = env.isTerminal();
    const finalObs = env.observe();
    const summary = summaryOf(finalObs);
    const wallMs = Date.now() - startedAt;

    // ---- 存档（快速验证存档供全盘续跑；全盘存档供复盘/快进）----
    if (!options.noSave) {
      const payload = env.saveBrowserSave({ name: `${options.name || "research"}-${mode}` });
      const sv = payload.stateVersion ?? 0;
      savePath = path.relative(path.join(__dirname, ".."), buildSavePath(options, options.name, mode, sv));
      fs.mkdirSync(path.dirname(path.join(__dirname, "..", savePath)), { recursive: true });
      fs.writeFileSync(path.join(__dirname, "..", savePath), JSON.stringify(payload, null, 2), "utf8");
    }

    const record = {
      schemaVersion: RECORD_SCHEMA_VERSION,
      name: options.name || null,
      fingerprint,
      mode,
      seed: identity.seed,
      activePlayerCount: identity.activePlayerCount,
      aiDifficulty: identity.aiDifficulty,
      policyVersion: identity.policyVersion,
      flags: identity.flags,
      createdAt: new Date().toISOString(),
      gitCommit: gitCommit(),
      steps,
      stepsLimit: options.full ? null : options.steps,
      terminal,
      wallMs,
      resumedFrom,
      resumeStep,
      savePath,
      summary,
      metrics: {
        famsBySeat: collector.famsBySeat,
        whiteQuickTrade: collector.whiteQuickTrade,
        whiteResearchSteps: collector.whiteResearchSteps,
        traceEvents: collector.traceEvents,
        revealEvents: collector.revealEvents,
        budgetHits: collector.budgetHits,
        searches: collector.searches,
      },
    };
    fs.mkdirSync(RECORDS_DIR, { recursive: true });
    fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

    printSummary(record);
    console.log(`\n记录: ${path.relative(path.join(__dirname, ".."), recordPath)}`);
    if (savePath) console.log(`存档: ${savePath}`);
    return record;
  } finally {
    env.dispose();
  }
}

function printSummary(record) {
  const { summary, metrics } = record;
  const seats = Object.keys(summary.scores);
  console.log(`\n===== ${record.mode}（${record.seed}）=====`);
  console.log(`步骤=${record.steps}${record.stepsLimit ? `（上限 ${record.stepsLimit}）` : ""}`
    + ` 终局=${record.terminal} 耗时=${(record.wallMs / 1000).toFixed(1)}s`
    + (record.resumedFrom ? ` 续跑自 ${record.resumeStep} 步` : ""));
  console.log(`均分=${summary.avgScore} 各席=${seats.map((s) => `${s}=${summary.scores[s]}`).join(" ")}`);
  for (const seat of seats) {
    const fams = metrics.famsBySeat[seat] || {};
    console.log(`  ${seat} 行动族=${JSON.stringify(fams)}`);
  }
  console.log(`白色 quick_trade=${metrics.whiteQuickTrade} 研究步=[${metrics.whiteResearchSteps.join(",")}]`);
  console.log(`外星人: 首放 ${metrics.traceEvents.length} 次、揭示 ${metrics.revealEvents.length} 次`);
  if (record.terminal) console.log(`终局轮=${summary.round}`);
  // 触顶 4096 截断的决策（用户裁定必须可见）：按席位汇总 + Top 明细。
  const hits = metrics.budgetHits || [];
  if (hits.length) {
    const bySeat = {};
    for (const h of hits) bySeat[h.seat] = (bySeat[h.seat] || 0) + 1;
    console.log(`反事实搜索触顶 ${hits.length}/${record.steps} 次决策（maxExecutionNodes 预算耗尽）按席位: ${JSON.stringify(bySeat)}`);
    const top = [...hits].sort((a, b) => (b.executedNodeCount || 0) - (a.executedNodeCount || 0)).slice(0, 20);
    for (const h of top) {
      const origin = h.frontierOriginCountByFamily
        ? Object.entries(h.frontierOriginCountByFamily)
          .sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([f, n]) => `${f}×${n}`).join(" ")
        : "";
      console.log(`  步${h.step} ${h.seat} ${familyOf(h.action).padEnd(14)} 节点=${h.executedNodeCount}/${h.maxExecutionNodes}${origin ? ` 前沿来源: ${origin}` : ""}`);
    }
  } else {
    console.log(`反事实搜索触顶: 0 次（无决策触碰 maxExecutionNodes 预算耗尽）`);
  }
}

// ---------------------------------------------------------------------------
// 复盘辅助
// ---------------------------------------------------------------------------

function printList() {
  const records = listRecords();
  if (!records.length) {
    console.log("（无记录，先用 --name 跑一次验证）");
    return;
  }
  console.log(`${"模式".padEnd(10)} ${"名称".padEnd(20)} ${"seed".padEnd(22)} ${"步骤".padEnd(6)} ${"终局".padEnd(5)} ${"均分".padEnd(6)} ${"commit".padEnd(10)} ${"创建时间".padEnd(20)} 指纹`);
  for (const r of records) {
    console.log(
      `${String(r.mode).padEnd(10)} ${String(r.name || "-").padEnd(20)} ${String(r.seed).padEnd(22)}`
      + ` ${String(r.steps).padEnd(6)} ${r.terminal ? "是" : "否"}  ${String(r.summary?.avgScore ?? "-").padEnd(6)}`
      + ` ${String(r.gitCommit || "-").slice(0, 8).padEnd(10)}`
      + ` ${String(r.createdAt).padEnd(20)} ${r.fingerprint.slice(0, 12)}`,
    );
  }
  console.log(`\n共 ${records.length} 条记录，目录：${RECORDS_DIR}`);
}

function printShow(query) {
  const records = listRecords().filter((r) => (
    r.name === query || r.fingerprint.startsWith(query)
  ));
  if (!records.length) {
    console.log(`未找到匹配记录：${query}`);
    process.exit(1);
  }
  for (const r of records) {
    console.log(JSON.stringify(r, null, 2));
    console.log("");
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = {
    config: {},
    steps: DEFAULT_STEPS,
    progressEvery: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[i + 1];
    switch (arg) {
      case "--name": options.name = next(); i += 1; break;
      case "--seed": options.seed = next(); i += 1; break;
      case "--config": Object.assign(options.config, parseConfig(next())); i += 1; break;
      case "--steps": options.steps = Math.max(1, Number(next()) || DEFAULT_STEPS); i += 1; break;
      case "--full": options.full = true; break;
      case "--force": options.force = true; break;
      case "--no-save": options.noSave = true; break;
      case "--progress": options.progressEvery = Math.max(0, Number(next()) || 0); i += 1; break;
      case "--list": options.list = true; break;
      case "--show": options.show = next(); i += 1; break;
      case "--records-dir": {
        const dir = next(); i += 1;
        if (dir) RECORDS_DIR = path.resolve(dir);
        break;
      }
      case "--help": case "-h": options.help = true; break;
      default:
        throw new Error(`未知参数：${arg}（--help 查看用法）`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 44).join("\n"));
    return;
  }
  if (options.list) { printList(); return; }
  if (options.show) { printShow(options.show); return; }
  if (!options.name) throw new Error("需要 --name <实验名>（用于记录命名与复盘检索）");
  if (options.full && options.config.steps) {
    console.log("[warn] --full 时忽略 --steps");
  }
  runValidation(options);
}

if (require.main === module) main();
module.exports = { createCollector, collectBudgetHits, seedCollectorFrom };

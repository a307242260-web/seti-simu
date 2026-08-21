"use strict";
// 机器人迭代记录体系核心库（2026-08-21 建立）
// ---------------------------------------------------------------
// 职责：
//   1) 版本登记（reports/iteration/versions.json，人工维护的真相源）
//   2) 调研记录扫描（reports/research/*.json）与版本归属解析
//   3) 终局完整分富化：有存档的终局运行从存档 committedState.match.finalScores
//      读取"完整终局总分"（用户口径 2026-08-20：所有分数以最终总分为准），
//      避免历史记录只显示 base 分的口径漂移
//   4) best-of 汇总（最佳白分 / 最佳均分 / 搜索耗时）
//   5) 完整性审计（孤儿记录 / provenance 不匹配 / 缺存档 / 缺复盘报告）
//   6) 逐步复盘报告生成（从存档 replaySteps 纯重放，绝不重跑 AI 搜索）
//   7) 总览页渲染（reports/robot-iteration.html，数据内嵌、可离线打开）
//
// 配套 CLI：tools/robot_iterate.js（run / register / build / review / check）。
// 机制说明见 docs/robot-iteration-registry.md。
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const { createSeededRandom, hashSeed } = require("../randomizer/game/random");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");

const REPO_ROOT = path.resolve(__dirname, "..");
const RESEARCH_DIR = path.join(REPO_ROOT, "reports", "research");
const ITER_DIR = path.join(REPO_ROOT, "reports", "iteration");
const VERSIONS_PATH = path.join(ITER_DIR, "versions.json");
const REGISTRY_PATH = path.join(ITER_DIR, "registry.json");
const TEMPLATE_PATH = path.join(ITER_DIR, "page-template.html");
const PAGE_PATH = path.join(REPO_ROOT, "reports", "robot-iteration.html");

const REGISTRY_SCHEMA = "seti-robot-iteration-registry-build-v1";
const REPORT_SCHEMA = "seti-robot-action-log-report-v1";

const PLAYER_ORDER = ["player-blue", "player-green", "player-brown", "player-white"];
const PLAYER_LABELS = {
  "player-blue": "蓝",
  "player-green": "绿",
  "player-brown": "棕",
  "player-white": "白",
};
const FAMILY_LABELS = {
  choose_card: "选牌",
  choose_payment: "支付选择",
  choose_target: "选择目标",
  choose_reward: "选择奖励",
  accept_optional_effect: "接受可选效果",
  launch: "发射",
  place_data: "放置数据",
  move: "移动",
  card_corner: "弃牌角标",
  end_turn: "结束回合",
  orbit: "环绕",
  quick_trade: "快速转换",
  research_tech: "研究科技",
  analyze: "分析",
  play_card: "打牌",
  scan: "扫描",
  pass: "PASS",
  industry: "公司能力",
};

// ---------------- git 辅助 ----------------

function git(args, opts = {}) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", ...opts }).trim();
  } catch (err) {
    if (opts.silent) return null;
    throw new Error(`git ${args.join(" ")} 失败: ${err.stderr || err.message}`);
  }
}

function gitHeadShort() {
  return git(["rev-parse", "--short", "HEAD"], { silent: true }) || "dirty";
}

function gitCommitInfo(rev) {
  const out = git(["show", "-s", "--format=%h|%ad|%s", "--date=format:%Y-%m-%d", rev], { silent: true });
  if (out == null) return null;
  const sep = out.indexOf("|");
  const sep2 = out.indexOf("|", sep + 1);
  return {
    hash: out.slice(0, sep),
    date: out.slice(sep + 1, sep2),
    subject: out.slice(sep2 + 1),
  };
}

function gitIsDirty() {
  const out = git(["status", "--porcelain"], { silent: true });
  if (out == null) return null;
  return out.split("\n").filter((l) => l.trim().length > 0).length > 0;
}

function gitIsAncestor(ancestor, head) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, head], { cwd: REPO_ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// 返回 [from..to] 之间的提交（旧→新）。from 为 null 时返回 to 自身。
function gitRangeCommits(from, to) {
  const spec = from ? `${from}..${to}` : to;
  const out = git(["log", "--reverse", "--format=%h", spec], { silent: true });
  if (out == null) return [];
  return out.split("\n").filter((l) => l.length > 0);
}

// 提交区间改动摘要文本（--shortstat），如 "36 files changed, 1347 insertions(+), 325 deletions(-)"
function gitRangeShortStat(from, to) {
  // from 为 null（版本链根）时用提交自身范围（to^..to），不能裸 git diff <to>（那是工作树比较）
  const spec = from ? `${from}..${to}` : `${to}^..${to}`;
  const out = git(["diff", "--shortstat", spec], { silent: true });
  return out == null ? "" : out.replace(/\s+/g, " ").trim();
}

// 提交区间文件级改动 [{file, insertions, deletions}]（--numstat，binary 计 null）
function gitRangeNumstat(from, to, limit = 60) {
  const spec = from ? `${from}..${to}` : `${to}^..${to}`;
  const out = git(["diff", "--numstat", spec], { silent: true });
  if (out == null) return [];
  const files = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const ins = parts[0] === "-" ? null : Number(parts[0]);
    const del = parts[1] === "-" ? null : Number(parts[1]);
    files.push({ file: parts.slice(2).join("\t"), insertions: ins, deletions: del });
  }
  return files.slice(0, limit);
}

// ---------------- 数据读写 ----------------

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadVersions() {
  const data = readJson(VERSIONS_PATH);
  if (!data || !Array.isArray(data.versions)) {
    throw new Error(`版本登记缺失或结构错误: ${VERSIONS_PATH}`);
  }
  return data;
}

// 写回前先备份（保留对比基准），再原子写回。
function saveVersions(data) {
  if (fs.existsSync(VERSIONS_PATH)) {
    fs.copyFileSync(VERSIONS_PATH, `${VERSIONS_PATH}.bak-${Date.now()}`);
  }
  writeJson(VERSIONS_PATH, data);
}

// 扫描 reports/research/ 全部记录，返回 { file: record }。
function scanResearchRecords() {
  const byFile = {};
  if (!fs.existsSync(RESEARCH_DIR)) return byFile;
  for (const file of fs.readdirSync(RESEARCH_DIR)) {
    if (!file.endsWith(".json")) continue;
    const rec = readJson(path.join(RESEARCH_DIR, file));
    if (rec && typeof rec === "object" && rec.steps != null) byFile[file] = rec;
  }
  return byFile;
}

function relRecordPath(file) {
  return path.posix.join("reports", "research", file);
}

// ---------------- 存档终局完整分富化 ----------------

// 从存档 committedState.match.finalScores 读完整终局分（totalScore + base/tile/card 拆分）。
// 终局未结算或结构缺失返回 null（调用方回退到记录 summary）。
function readSaveFinalScores(saveRelPath) {
  const abs = path.join(REPO_ROOT, saveRelPath);
  if (!fs.existsSync(abs)) return null;
  let save;
  try {
    save = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
  let st = save.committedState;
  if (typeof st === "string") {
    try {
      st = JSON.parse(st);
    } catch {
      return null;
    }
  }
  const match = st?.match;
  const settled = match?.finalScoringSettled === true || match?.finalScores?.length > 0;
  if (!settled || !Array.isArray(match?.finalScores)) return null;
  const scores = {};
  const breakdown = {};
  const formulaByTile = {};
  for (const fsItem of match.finalScores) {
    const pid = fsItem.playerId;
    scores[pid] = fsItem.totalScore ?? null;
    breakdown[pid] = {
      total: fsItem.totalScore ?? null,
      base: fsItem.baseScore ?? null,
      tile: fsItem.tileScore ?? null,
      card: fsItem.cardScore ?? null,
      // 终局结算明细（2026-08-21 用户口径：显示"具体什么获得了几分"）
      tileScoresById: fsItem.tileScoresById || null,
      tiles: Array.isArray(fsItem.tiles) ? fsItem.tiles : [],
      cards: Array.isArray(fsItem.cards) ? fsItem.cards : [],
      scoreSources: st.players?.players?.find((p) => p.id === pid)?.scoreSources || null,
    };
    // 本局各板块实际使用的公式（a1/a2/...，用于板块称呼显示）
    for (const t of fsItem.tiles || []) {
      if (t.tileId && t.formulaId) formulaByTile[t.tileId] = t.formulaId;
    }
  }
  const values = PLAYER_ORDER.map((p) => scores[p]).filter((v) => v != null);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return { scores, avgScore: avg, breakdown, formulaByTile };
}

// ---------------- 版本结果解析 ----------------

// 解析版本声明的记录 → 结果列表（含存档富化 / 缺失标记）。
function resolveVersionResults(version, recordsByFile) {
  const results = [];
  const declared = version.records || {};
  for (const [file, meta] of Object.entries(declared)) {
    const rec = recordsByFile[file];
    if (!rec) {
      results.push({
        recordFile: file,
        missingRecord: true,
        note: meta?.note || null,
      });
      continue;
    }
    const r = {
      recordFile: file,
      recordPath: relRecordPath(file),
      mode: rec.mode,
      steps: rec.steps,
      stepsLimit: rec.stepsLimit,
      terminal: rec.terminal,
      wallMs: rec.wallMs,
      flags: rec.flags || {},
      policyVersion: rec.policyVersion,
      gitCommit: rec.gitCommit,
      createdAt: rec.createdAt,
      resumeStep: rec.resumeStep,
      seed: rec.seed,
      note: meta?.note || null,
    };
    // 分数来源优先级：save-final（完整终局）> record-summary；键统一为 player-<color>
    const summary = rec.summary || {};
    r.scores = {};
    for (const pid of PLAYER_ORDER) {
      r.scores[pid] = summary.scores?.[pid] ?? null;
    }
    r.avgScore = summary.avgScore ?? null;
    r.scoreSource = "record-summary";
    const savePath = meta?.saveOverride || rec.savePath;
    if (savePath && fs.existsSync(path.join(REPO_ROOT, savePath))) {
      const enriched = readSaveFinalScores(savePath);
      if (enriched && enriched.avgScore != null) {
        r.scores = enriched.scores;
        r.avgScore = enriched.avgScore;
        r.finalBreakdown = enriched.breakdown;
        r.scoreSource = "save-final";
      }
      r.savePath = savePath;
      const runKey = file.replace(/\.json$/, "");
      r.reportPath = path.posix.join("reports", "iteration", version.id, `${runKey}.action-log.html`);
      r.reportExists = fs.existsSync(path.join(REPO_ROOT, r.reportPath));
    } else {
      r.savePath = savePath || null;
      r.reportPath = null;
      r.reportExists = false;
    }
    results.push(r);
  }
  return results;
}

// ---------------- best-of 汇总 ----------------

// 汇总各版本结果 + roadmap 条目，计算固定盘面最佳指标（仅全盘/完整终局口径）。
function computeBestOf(versions, resolvedMap) {
  const fullRuns = [];
  const roadmapEntries = [];
  for (const v of versions) {
    for (const r of resolvedMap[v.id] || []) {
      if (r.missingRecord) continue;
      if (r.mode !== "full") continue;
      fullRuns.push({ version: v, result: r });
    }
    if (v.roadmap) roadmapEntries.push({ version: v, roadmap: v.roadmap });
  }

  const whiteOf = (x) => {
    if (x.result) return x.result.scores?.["player-white"] ?? null;
    return x.roadmap?.scores?.["player-white"] ?? null;
  };
  const avgOf = (x) => {
    if (x.result) return x.result.avgScore ?? null;
    return x.roadmap?.avgScore ?? null;
  };
  const stepsOf = (x) => (x.result ? x.result.steps : x.roadmap?.steps);
  const wallMsOf = (x) => (x.result ? x.result.wallMs : null);

  const candidates = [...fullRuns, ...roadmapEntries];
  const withWhite = candidates.filter((x) => whiteOf(x) != null);
  const withAvg = candidates.filter((x) => avgOf(x) != null);
  const withTime = fullRuns.filter((x) => wallMsOf(x) != null);

  const byWhite = [...withWhite].sort((a, b) => whiteOf(b) - whiteOf(a));
  const byAvg = [...withAvg].sort((a, b) => avgOf(b) - avgOf(a));
  const byMsPerStep = [...withTime].sort(
    (a, b) => wallMsOf(a) / stepsOf(a) - wallMsOf(b) / stepsOf(b),
  );
  const byWallMs = [...withTime].sort((a, b) => wallMsOf(a) - wallMsOf(b));

  const describe = (x) => {
    const provenance = x.result
      ? (x.result.scoreSource === "save-final" ? "save-final" : "record")
      : "roadmap";
    return {
      versionId: x.version.id,
      name: x.version.name,
      runKey: x.result ? x.result.recordFile.replace(/\.json$/, "") : null,
      provenance,
      steps: stepsOf(x),
      wallMs: wallMsOf(x),
      msPerStep: stepsOf(x) && wallMsOf(x) != null ? Math.round(wallMsOf(x) / stepsOf(x)) : null,
      scoreSourceNote: x.result?.note || x.roadmap?.note || null,
    };
  };

  return {
    bestWhite: byWhite.length ? { value: whiteOf(byWhite[0]), ...describe(byWhite[0]) } : null,
    bestAvg: byAvg.length ? { value: avgOf(byAvg[0]), ...describe(byAvg[0]) } : null,
    fastestWall: byWallMs.length ? describe(byWallMs[0]) : null,
    fastestPerStep: byMsPerStep.length ? describe(byMsPerStep[0]) : null,
    topByAvg: byAvg.slice(0, 3).map((x) => {
      // 该局最高分玩家（roadmap 条目只有白色有值）
      let bestPlayer = null;
      if (x.result && x.result.scores) {
        let best = null;
        let bestScore = -Infinity;
        for (const pid of PLAYER_ORDER) {
          const s = x.result.scores[pid];
          if (s != null && s > bestScore) {
            best = pid;
            bestScore = s;
          }
        }
        if (best != null) bestPlayer = { color: PLAYER_LABELS[best], score: bestScore };
      } else if (x.roadmap) {
        const w = x.roadmap.scores?.["player-white"];
        if (w != null) bestPlayer = { color: PLAYER_LABELS["player-white"], score: w };
      }
      return { value: avgOf(x), white: whiteOf(x), bestPlayer, ...describe(x) };
    }),
  };
}

// ---------------- 完整性审计 ----------------

function auditRegistry(versions, recordsByFile, resolvedMap, bestOf) {
  const warnings = [];
  const boardSeed = (loadVersions().defaultBoard || {}).seed;
  // 孤儿记录：固定盘面上的记录未被任何版本登记（full 高优先级，quick 提示）
  const claimed = new Set();
  for (const v of versions) {
    for (const file of Object.keys(v.records || {})) claimed.add(file);
  }
  const orphans = [];
  for (const [file, rec] of Object.entries(recordsByFile)) {
    if (claimed.has(file)) continue;
    if (rec.seed !== boardSeed) continue;
    orphans.push({
      file,
      mode: rec.mode,
      name: rec.name || null,
      gitCommit: rec.gitCommit,
      createdAt: rec.createdAt,
      steps: rec.steps,
      terminal: rec.terminal,
    });
  }
  for (const o of orphans) {
    const level = o.mode === "full" ? "warn" : "info";
    warnings.push({
      kind: "orphan-record",
      level,
      text: `未登记到任何版本${level === "warn" ? "（全盘记录必须归属）" : ""}：${o.file}（name=${o.name || "—"} commit=${o.gitCommit} createdAt=${o.createdAt}）`,
    });
  }
  // provenance：记录 gitCommit 应属于版本 commits（允许前缀匹配；脏树运行已知例外）
  for (const v of versions) {
    const commitSet = new Set((v.commits || []).map((c) => String(c)));
    for (const r of resolvedMap[v.id] || []) {
      if (r.missingRecord) continue;
      const recCommit = String(r.gitCommit || "");
      const matched = [...commitSet].some(
        (c) => recCommit.startsWith(c) || c.startsWith(recCommit),
      );
      if (!matched && recCommit && recCommit !== "dirty") {
        // 记录注记（versions.json records[file].note）已写明脏树运行等例外时降为 info；
        // 未解释的 provenance 不匹配保持 warn（防版本混淆，用户核心诉求）
        const explained = Boolean(r.note);
        warnings.push({
          kind: "commit-mismatch",
          level: explained ? "info" : "warn",
          text: `${v.id} 的记录 ${r.recordFile} gitCommit=${recCommit} 不在版本 commits（${v.commits?.join(",") || "无"}）内——运行于脏工作树或归属错误${explained ? "（记录注记已说明，视为已知例外）" : "，请核对 versions.json"}`,
        });
      }
    }
  }
  // 声明但缺失的记录文件
  for (const v of versions) {
    for (const file of Object.keys(v.records || {})) {
      if (!recordsByFile[file]) {
        warnings.push({
          kind: "missing-record",
          level: "warn",
          text: `${v.id} 声明的记录缺失：${file}`,
        });
      }
    }
  }
  // roadmap-only：无 research 记录，分数来自文档
  for (const v of versions) {
    if (v.roadmap && !Object.keys(v.records || {}).length) {
      warnings.push({
        kind: "roadmap-only",
        level: "info",
        text: `${v.id}（${v.name}）无 research 记录/存档，分数来自 roadmap 文档（${v.roadmap.note || ""}）`,
      });
    }
  }
  // 无存档或有存档但缺复盘报告（2026-08-21 用户口径：每个实验必须有完整复盘报告；
  // 评估档 = full 或 ≥100 步；5/10 步冒烟测试豁免。
  // 历史无存档实验接受记录级指标（info 提示，2026-08-21 用户拍板不补跑）；
  // 有存档却缺报告必须 warn（build --reports 立即可修复）。）
  for (const v of versions) {
    for (const r of resolvedMap[v.id] || []) {
      if (r.missingRecord) continue;
      const isEval = r.mode === "full" || (r.steps ?? 0) >= 100;
      if (!isEval) continue;
      const saveAbs = r.savePath ? path.join(REPO_ROOT, r.savePath) : null;
      if (!saveAbs || !fs.existsSync(saveAbs)) {
        warnings.push({
          kind: "missing-save",
          level: "info",
          text: `${v.id} 的记录 ${r.recordFile} 无存档——该实验没有行动级复盘报告（历史欠账，接受记录级指标；标准迭代入口 run 默认存档+生成报告，新实验不会缺）`,
        });
        continue;
      }
      if (!r.reportExists) {
        warnings.push({
          kind: "missing-report",
          level: "warn",
          text: `${v.id} 的记录 ${r.recordFile} 有存档但缺复盘报告（node tools/robot_iterate.js build --reports 可补齐）`,
        });
      }
    }
  }
  // 工作树脏：HEAD 不等于实验树的风险提示
  if (gitIsDirty()) {
    warnings.push({
      kind: "dirty",
      level: "info",
      text: "工作树有未提交改动——记录 gitCommit 取 HEAD，若实验运行于脏树，代码版本与记录可能不完全对应（参见 newfast-recovery 的 25bdb5e9 注记）",
    });
  }
  return { warnings, orphans };
}

// ---------------- 报告生成 ----------------

// 科技背面 bonus 含义（randomizer/game/tech/catalog.js BONUS_LABELS 同源）
const TECH_BONUS_LABELS = {
  bonus_3f: "3 分",
  bonus_1p: "1 能量",
  bonus_1m: "1 宣传",
  bonus_1c: "精选 1 张牌",
};

// base 分构成来源的中文标签（player.scoreSources 键）
const SCORE_SOURCE_LABELS = {
  initialScore: "初始",
  scanScore: "扫描",
  orbitScore: "环绕",
  landScore: "登陆",
  blueTechScore: "蓝科技",
  techBonusScore: "科技bonus",
  alienTraceBlueScore: "外星痕迹·蓝",
  alienTracePinkScore: "外星痕迹·粉",
  alienTraceYellowScore: "外星痕迹·黄",
  alienCardQuickScore: "外星卡·快速",
  alienEffectScore: "外星卡·效果",
  cardQuickScore: "卡牌·快速",
  cardEffectScore: "卡牌·效果",
  taskCardScore: "任务卡",
  industryEffectScore: "行业效果",
};

// 初始牌编号 → 效果描述（randomizer/game/initial-cards.js INITIAL_CARD_EFFECTS label 同源，
// 2026-08-21 用户口径：选择的初始牌显示在选公司那一行）
const INITIAL_CARD_LABELS = {
  1: "天狼星A扫描两次",
  2: "3分、1信用点、1盲抽",
  3: "3分、1盲抽、1宣传、火星环绕器",
  4: "3分、1能量、1宣传、金星环绕器",
  5: "4分、2宣传、土星环绕器",
  6: "织女一扫描一次、1额外公共扫描",
  7: "1数据收入、海王星环绕器",
  8: "2分、2信用点、1宣传、水星环绕器",
  9: "1盲抽收入、天王星环绕器",
  10: "外星人2黄色痕迹",
  11: "外星人2粉色痕迹",
  12: "巴纳德扇区扫描两次",
  13: "绘架座β扫描两次",
  14: "3分、1能量、1盲抽",
  15: "4分、1额外公共扫描、1宣传",
  16: "3分、3宣传",
  17: "室女座61扫描两次",
  18: "南河三扫描两次",
  19: "比邻星扫描两次",
  20: "开普勒22扫描两次",
  21: "3分、1数据、1宣传、木星环绕器",
};

// 收入轨资源增量标签（player.income 键）
const INCOME_GAIN_LABELS = {
  credits: "信用点",
  energy: "能量",
  handSize: "手牌上限",
  publicity: "宣传",
  availableData: "数据",
  additionalPublicScan: "额外公共扫描",
};

// 终局计分板块公式短描述（2026-08-21 用户裁定称呼）
const FINAL_FORMULA_LABELS = {
  a1: "最多收入",
  a2: "每套收入",
  b1: "每套痕迹",
  b2: "每套环登扇区",
  c1: "完成任务",
  c2: "每2个任务 + 终局",
  d1: "每套科技",
  d2: "每两个科技",
};

// 内核重放存档 replaySteps，提取 after 快照里没有的逐步信息（2026-08-21 用户口径）：
//   1) 研究科技：研究了哪张科技（ownedTiles 新增）+ 获得的背面 bonus（研究前该堆堆顶 bonusId）
//   2) 收入插牌：choose_card summary 为「收入 <cardId>」的步骤
// 返回 Map: stepIndex -> { research?: {tileId, bonusId}, income?: {cardId} }
// 重放失败（某步不匹配）时返回已收集的部分增强，报告仍可生成（主行动显示退化，不静默吞错——注释如上）。
function replaySaveEnriched(savePath) {
  const enrich = new Map();
  const save = readJson(path.join(REPO_ROOT, savePath));
  if (!save || !Array.isArray(save.replaySteps)) return enrich;
  const steps = save.replaySteps;
  let st0 = save.committedState;
  if (typeof st0 === "string") {
    try {
      st0 = JSON.parse(st0);
    } catch {
      st0 = null;
    }
  }
  const SEED = "seti-free-analyze-v1";
  const random = createSeededRandom(SEED);
  random.setState(hashSeed(SEED));
  const kernel = createSimulationRuleComposition({
    seed: st0?.meta?.seed || SEED,
    random,
    activePlayerCount: 4,
    trustedProjectionReader: true,
  });
  kernel.composition.lifecycle.newGame({
    seed: st0?.meta?.seed || SEED,
    activePlayerCount: 4,
    initialize: true,
    rngState: { algorithm: "seti-simulation-mulberry32-v1", state: hashSeed(SEED) },
  });
  kernel.composition.inputPort.beginDrain({ metadata: { source: "report-enrich" } });

  // 本局各终局板块实际使用的公式（finalScores.tiles 的 formulaId，如 d2）
  const formulaByTile = {};
  for (const fsItem of st0?.match?.finalScores || []) {
    for (const t of fsItem.tiles || []) {
      if (t.tileId && t.formulaId) formulaByTile[t.tileId] = t.formulaId;
    }
  }
  const formulaForTile = (tileId) => formulaByTile[tileId] || null;

  function snapshot() {
    const st = kernel.composition.projection().state;
    const owned = new Map();
    const hands = new Map();
    const incomes = new Map();
    for (const p of st.players?.players || []) {
      owned.set(p.id, new Set(Object.keys(p.techState?.ownedTiles || {})));
      hands.set(p.id, (p.hand || []).map((c) => c.cardId));
      incomes.set(p.id, p.income ? { ...p.income } : null);
    }
    const bonus = new Map();
    for (const [tid, stack] of Object.entries(st.tech?.stacks || {})) {
      if (stack && stack.bonusId) bonus.set(tid, stack.bonusId);
    }
    // 终局板块标记：tileId -> Set("playerColor:slotIndex:threshold")
    const finalMarks = new Map();
    for (const [tileId, tile] of Object.entries(st.finalScoring?.tiles || {})) {
      finalMarks.set(tileId, new Set((tile?.marks || []).map((mk) => `${mk.playerColor}:${mk.slotIndex}:${mk.threshold}`)));
    }
    return { owned, hands, incomes, bonus, finalMarks };
  }

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const action = step.action || {};
    const before = snapshot();
    const insp = kernel.composition.inspect();
    let r;
    if (insp.phase !== "awaiting_input") {
      const proj = kernel.composition.projection();
      const fixed = {
        ...action,
        stateVersion: proj.stateVersion,
        decisionVersion: proj.state?.match?.decisionVersion ?? 0,
      };
      r = step.phase === "quick"
        ? kernel.composition.inputPort.submitQuickAction(fixed)
        : kernel.composition.inputPort.submitAction(fixed);
    } else {
      const d = insp.session.decision;
      const isWhite = action.actorId === "player-white" || action.actorPlayerId === "player-white";
      const cid = String(action.choiceId || action.target?.choiceId || "");
      let pick = d.choices.find((c) => String(c.target?.choiceId) === cid)
        || d.choices.find((c) => String(c.actionId) === String(action.actionId))
        || d.choices.find((c) => String(c.summary || "") === String(action.summary || ""));
      if (!pick && !isWhite) pick = d.choices.find((c) => !c.disabledReason) || d.choices[0];
      if (!pick) break;
      r = kernel.composition.inputPort.submitDecision({
        decisionId: d.decisionId,
        decisionVersion: d.decisionVersion,
        ownerId: d.ownerId,
        choice: pick,
      });
    }
    if (!r?.ok) {
      if (action.family === "accept_optional_effect" && String(action.summary || "").startsWith("跳过") && insp.phase !== "awaiting_input") {
        continue;
      }
      break;
    }
    const after = snapshot();
    const e = {};
    // 研究科技：该步后 ownedTiles 新增（actor 在 step.actorPlayerId / action.actorId）
    const actorId = step.actorPlayerId || action.actorId;
    if (actorId) {
      const beforeSet = before.owned.get(actorId) || new Set();
      const afterSet = after.owned.get(actorId) || new Set();
      for (const tid of afterSet) {
        if (!beforeSet.has(tid)) {
          e.research = { tileId: tid, bonusId: before.bonus.get(tid) || null };
          break;
        }
      }
    }
    // 收入插牌：summary 以「收入 」开头；资源 = 该步前后 income 增量
    const sum = String(action.summary || "");
    if (sum.startsWith("收入 ")) {
      const beforeInc = before.incomes.get(actorId) || {};
      const afterInc = after.incomes.get(actorId) || {};
      const gains = [];
      for (const key of ["credits", "energy", "handSize", "publicity", "availableData", "additionalPublicScan"]) {
        const diff = (afterInc[key] || 0) - (beforeInc[key] || 0);
        if (diff) gains.push(`${INCOME_GAIN_LABELS[key] || key}${diff > 0 ? "+" : ""}${diff}`);
      }
      e.income = { cardId: sum.slice(3).trim(), gain: gains.join(" · ") || null };
    } else if (actorId && sum !== "开始初始选择" && sum !== "确认初始选择" && !/^选择公司：/.test(sum) && !/^选择：初始牌/.test(sum)) {
      // 抽牌（盲抽/精选奖励）：该步后 hand 新增的卡（排除初始选择与收入插牌步骤）
      const beforeHand = before.hands.get(actorId) || [];
      const afterHand = after.hands.get(actorId) || [];
      const newCards = afterHand.filter((c) => !beforeHand.includes(c));
      if (newCards.length) {
        e.draw = { cardId: newCards[newCards.length - 1] };
      }
    }
    // 终局板块标记（choose_target「标记 X」）：该步后某板块 marks 新增 → 槽位/阈值
    const markMatch = /^标记 ([A-D])$/.exec(sum);
    if (markMatch) {
      const tileId = markMatch[1].toLowerCase();
      const beforeMarks = before.finalMarks.get(tileId) || new Set();
      const afterMarks = after.finalMarks.get(tileId) || new Set();
      for (const mk of afterMarks) {
        if (!beforeMarks.has(mk)) {
          const [, slotIdx, threshold] = mk.split(":");
          e.finalMark = {
            tileId,
            slotIndex: Number(slotIdx),
            threshold: Number(threshold),
            formula: formulaForTile(tileId),
          };
          break;
        }
      }
    }
    if (Object.keys(e).length) enrich.set(step.stepIndex ?? index, e);
  }
  try {
    kernel.dispose?.();
  } catch {
    // 内核释放失败不影响已收集的增强数据
  }
  return enrich;
}

// 修正 orbit 等摘要里误导性的收入描述「获得 1 次收入（R1，1信用点 + 1能量）」：
// 实际收入是插一张牌按该卡 income 码给单一资源（2026-08-21 用户纠正：不会同时获得 1钱+1电），
// 具体插了什么牌由 income 增强信息展示。
function normalizeIncomeClause(text) {
  return String(text || "").replace(/；获得 1 次收入（[^）]*）/g, "；获得 1 次收入");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function flagsText(flags) {
  const keys = Object.keys(flags || {});
  return keys.length ? keys.map((k) => `${k}=${JSON.stringify(flags[k])}`).join(", ") : "默认装配";
}

function fmtMs(ms) {
  if (ms == null) return "—";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m${(s - m * 60).toFixed(0)}s`;
}

function playerResourceRow(afterP, playerId) {
  const p = afterP?.[playerId];
  if (!Array.isArray(p) || p.length < 6) return null;
  return { score: p[0], credits: p[1], energy: p[2], publicity: p[3], hand: p[4], reserved: p[5] };
}

function fmtDelta(delta) {
  if (delta == null || delta === 0) return '<span class="d0">0</span>';
  return delta > 0 ? `<span class="dp">+${delta}</span>` : `<span class="dm">${delta}</span>`;
}

// 逐步复盘报告：纯重放存档 replaySteps（无 AI 搜索，绝不重跑）。
// opts: { savePath, versionId, versionName, runKey, recordFile, recordRelPath,
//         gitCommit, policyVersion, flags, wallMs, mode }
function buildActionLogReport(opts) {
  const save = readJson(path.join(REPO_ROOT, opts.savePath));
  if (!save) throw new Error(`存档读取失败: ${opts.savePath}`);
  const steps = Array.isArray(save.replaySteps) ? save.replaySteps : [];
  const final = readSaveFinalScores(opts.savePath);
  const lastAfter = steps.length ? steps[steps.length - 1].after : null;
  // 内核重放增强：研究科技（哪张科技+背面 bonus）与收入插牌（2026-08-21 用户口径）
  const enrichMap = replaySaveEnriched(opts.savePath);

  // 逐玩家前序资源，计算每步分数/资源变化
  const prev = {};
  const rows = [];
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const actor = step.actorPlayerId;
    const after = step.after || {};
    const cur = playerResourceRow(after.p, actor);
    const before = prev[actor] || null;
    rows.push({
      i: step.stepIndex ?? i,
      r: after.r ?? null,
      t: after.t ?? null,
      actor,
      phase: step.phase ?? (step.action?.phase ?? null),
      family: step.action?.family ?? null,
      summary: step.action?.summary ?? null,
      cur,
      delta: before && cur ? cur.score - before.score : null,
      enrich: enrichMap.get(step.stepIndex ?? i) || null,
      // 终局板块标记放置（重放对比 marks 增量：板块/槽位/阈值/公式）
      finalMark: enrichMap.get(step.stepIndex ?? i)?.finalMark || null,
      // 外星人踪迹放置（分析/奖励后的 choose_target「外星人 N 蓝/粉/黄色痕迹」，2026-08-21 用户口径：
      // 踪迹放哪了要写出来，拿到的奖励也带上——括号奖励单独提取）
      trace: (() => {
        const summary = String(step.action?.summary || "");
        const tm = /外星人 (\d+) (蓝|粉|黄)/.exec(summary);
        if (!tm) return null;
        let reward = null;
        const paren = /（([^）]*)）/.exec(summary.slice(tm.index));
        if (paren) reward = paren[1];
        return { alienSlot: Number(tm[1]), color: tm[2], reward };
      })(),
      // 初始牌选择（choose_card「选择：初始牌 N」，显示在选公司那一行）
      initialCard: (() => {
        const mm = /^选择：初始牌 (\d+)$/.exec(String(step.action?.summary || ""));
        return mm ? { number: Number(mm[1]), label: INITIAL_CARD_LABELS[Number(mm[1])] || null } : null;
      })(),
    });
    if (cur) prev[actor] = cur;
  }

  // 每玩家行动清单（过滤 actor）
  const perPlayer = {};
  for (const p of PLAYER_ORDER) perPlayer[p] = rows.filter((row) => row.actor === p);

  // 行动族统计
  const famCounts = {};
  for (const row of rows) {
    const key = row.family || "(null)";
    famCounts[key] = (famCounts[key] || 0) + 1;
  }

  const playerColor = (pid) => PLAYER_LABELS[pid] || pid;

  // 卡牌 id → 名称映射（2026-08-21 用户口径：复盘报告不显示卡牌编号，显示卡牌名称）。
  // 数据源：assets/cards/card_model.json（basic+space-agency）+ assets/aliens/*/card_model.csv
  // （外星卡，GBK 编码，card_id 无物种前缀需拼接，如 amiba_0.webp）；查不到的保留原编号。
  const ALIEN_DIR_PREFIX = {
    阿米巴: "amiba", 奥陌陌: "aomomo", 半人马: "banrenma", 虫: "chong",
    方舟: "fangzhou", 九折: "jiuzhe", 异常点: "yichangdian", 符文族: "runezu",
  };
  let cardNameMap = null;
  function cardNameFor(token) {
    if (cardNameMap === null) {
      cardNameMap = {};
      const cat = readJson(path.join(REPO_ROOT, "assets", "cards", "card_model.json"));
      if (Array.isArray(cat)) {
        for (const c of cat) {
          if (c && c.card_id != null) cardNameMap[String(c.card_id)] = String(c.card_name || "");
        }
      }
      try {
        for (const dir of fs.readdirSync(path.join(REPO_ROOT, "assets", "aliens"))) {
          const prefix = ALIEN_DIR_PREFIX[dir];
          if (!prefix) continue;
          const csvPath = path.join(REPO_ROOT, "assets", "aliens", dir, "card_model.csv");
          if (!fs.existsSync(csvPath)) continue;
          // 外星卡 csv 为 GBK 编码（fs.readFileSync 不支持 gbk，用 TextDecoder）
          const text = new TextDecoder("gbk").decode(fs.readFileSync(csvPath));
          const lines = text.split(/\r?\n/);
          for (let i = 1; i < lines.length; i += 1) {
            const cols = lines[i].split(",");
            if (cols.length < 2 || !cols[0]) continue;
            cardNameMap[`${prefix}_${cols[0]}`] = cols[1];
          }
        }
      } catch {
        // 外星卡目录缺失时仅用主目录（basic/space-agency 已覆盖普通卡）
      }
    }
    return cardNameMap[token] || null;
  }
  function replaceCardIds(text) {
    if (!text) return text;
    return String(text).replace(/([A-Za-z0-9_-]+\.(?:webp|png|jpg))/gi, (token) => cardNameFor(token) || token);
  }

  // 按 (轮次, 回合, 玩家) 聚合为"每玩家每回合一行"（2026-08-21 用户口径：
  // 一个玩家的回合 = 主行动 + 附属快速/条件步骤，合并成一行，不再逐子步骤拆行）。
  // 主行动 = 该回合第一个 phase=main 的动作（PASS 也算主行动）；无主行动时取第一步。
  // 纯 end_turn 回合（组内除 end_turn 外无任何实质动作）不构成玩家一动，整组不展示
  // （2026-08-21 用户口径：结束回合不是一动，复盘报告只显示玩家的每一回合）。
  function groupByTurn(stepRows) {
    const groups = [];
    const map = new Map();
    for (const row of stepRows) {
      const key = `${row.r ?? "?"}|${row.t ?? "?"}|${row.actor}`;
      let g = map.get(key);
      if (!g) {
        g = { r: row.r, t: row.t, actor: row.actor, rows: [] };
        map.set(key, g);
        groups.push(g);
      }
      g.rows.push(row);
    }
    return groups
      .filter((g) => g.rows.some((row) => row.family !== "end_turn"))
      .map((g) => {
        const main = g.rows.find((row) => row.phase === "main") || g.rows[0];
        const cur = g.rows[g.rows.length - 1].cur;
        const delta = g.rows.reduce((acc, row) => acc + (row.delta || 0), 0);
        return { r: g.r, t: g.t, actor: g.actor, count: g.rows.length, rows: g.rows, main, cur, delta };
      });
  }

  // 主行动单元格：主行动（family + 摘要）+ 该回合的附属动作，按发生顺序合并一行列表
  // （2026-08-21 用户口径：快速/抽牌/收入/终局标记/初始牌按顺序显示，内容完整——抽的牌、
  // 收入资源都展示；条件/目标选择等子步骤仍并入回合不单列）。
  // 增强信息（内核重放）：研究科技显示研究了哪张科技+背面 bonus；收入插牌显示卡名与资源；
  // 盲抽/精选显示抽到的牌。
  function turnMainCell(g) {
    const m = g.main;
    const fam = m && m.family ? FAMILY_LABELS[m.family] || m.family : "—";
    const research = g.rows.map((row) => row.enrich?.research).find(Boolean);
    let mainTxt;
    if (research && fam === "研究科技") {
      const bonus = research.bonusId
        ? `，背面 bonus：${TECH_BONUS_LABELS[research.bonusId] || research.bonusId}`
        : "";
      mainTxt = `${escapeHtml("研究")} ${escapeHtml(research.tileId)}${bonus}`;
    } else {
      const sum = m && m.summary ? normalizeIncomeClause(replaceCardIds(String(m.summary))) : "";
      mainTxt = `${escapeHtml(fam)} ${escapeHtml(sum)}`.trim();
    }
    // 附属动作按 row 顺序合并（快速/抽牌/收入/终局标记/初始牌/放痕迹），带顺序编号 ①②③
    // （2026-08-21 用户口径：要能看懂先后顺序）
    const SEQ_NUM = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
    const extras = [];
    let seq = 0;
    for (const row of g.rows) {
      let text = null;
      if (row.phase === "quick") {
        const qfam = row.family ? FAMILY_LABELS[row.family] || row.family : "";
        const qsum = row.summary ? replaceCardIds(String(row.summary)).trim() : "";
        text = qsum || qfam;
      } else if (row.enrich?.income) {
        const name = cardNameFor(row.enrich.income.cardId) || row.enrich.income.cardId;
        text = `收入 ${name}${row.enrich.income.gain ? `（获得 ${row.enrich.income.gain}）` : ""}`;
      } else if (row.enrich?.draw) {
        const name = cardNameFor(row.enrich.draw.cardId) || row.enrich.draw.cardId;
        text = `抽牌 ${name}`;
      } else if (row.finalMark) {
        const fm = row.finalMark;
        const formula = fm.formula
          ? `${fm.formula}：${FINAL_FORMULA_LABELS[fm.formula] || fm.formula}`
          : "";
        text = `终局标记 ${fm.tileId}（第${fm.slotIndex}槽${fm.threshold ? `/${fm.threshold}分` : ""}${formula ? ` · ${formula}` : ""}）`;
      } else if (row.trace) {
        text = `放痕迹 外星人${row.trace.alienSlot}·${row.trace.color}${row.trace.reward ? `（${row.trace.reward}）` : ""}`;
      } else if (row.initialCard) {
        text = `初始牌 ${row.initialCard.number}${row.initialCard.label ? `（${row.initialCard.label}）` : ""}`;
      }
      if (text == null) continue;
      seq += 1;
      extras.push(`${SEQ_NUM[seq - 1] || `${seq}.`} ${text}`);
    }
    const extraTxt = extras.length
      ? `<div class="quick-list">${escapeHtml(extras.join(" · "))}</div>`
      : "";
    return `<div class="main-act">${mainTxt}</div>${extraTxt}`;
  }

  function turnCells(g, withPlayer) {
    const res = g.cur
      ? `${g.cur.credits} 钱 · ${g.cur.energy} 电 · ${g.cur.publicity} 宣 · ${g.cur.hand} 手`
      : "—";
    const score = g.cur ? `${g.cur.score}` : "—";
    const playerCell = withPlayer
      ? `<td class="actor c-${g.actor}">${playerColor(g.actor)}</td>`
      : "";
    return `<tr>
      <td class="num">R${g.r ?? "?"}·T${g.t ?? "?"}</td>
      ${playerCell}
      <td class="sum">${turnMainCell(g)}</td>
      <td class="num">${g.count} 步</td>
      <td class="num">${fmtDelta(g.delta)}</td>
      <td class="num">${score}</td>
      <td class="res muted">${res}</td>
    </tr>`;
  }

  // 终局结算明细文本（base 构成 + 板块 + 卡牌；玩家清单 / finalSection / 全程复盘末尾共用）
  const finalDetailLines = (() => {
    if (!final) return [];
    return PLAYER_ORDER.map((p) => {
      const b = final.breakdown[p];
      if (!b) return null;
      const ss = b.scoreSources || {};
      const ssParts = Object.entries(ss)
        .filter(([, v]) => v)
        .map(([k, v]) => `${SCORE_SOURCE_LABELS[k] || k} ${v}`);
      const tileParts = b.tileScoresById
        ? Object.entries(b.tileScoresById).filter(([, v]) => v).map(([tid, v]) => {
          // 板块用本局公式的新称呼（2026-08-21 用户裁定：a2=每套收入、d2=每两个科技…），
          // 得分拆成 基础分(multiplier)×套数(baseValue)（2026-08-21 用户口径）
          const formula = final?.formulaByTile?.[tid];
          const label = formula ? FINAL_FORMULA_LABELS[formula] || formula : tid;
          const tile = (b.tiles || []).find((t) => t.tileId === tid);
          if (tile && tile.multiplier != null && tile.baseValue != null) {
            return `${label} ${tile.multiplier}×${tile.baseValue}=${v}`;
          }
          return `${label} ${v}`;
        })
        : [];
      const cardParts = (b.cards || [])
        .filter((c) => c && c.score)
        .map((c) => `${cardNameFor(c.cardId) || c.cardId} ${c.score}`);
      const parts = [];
      if (ssParts.length) parts.push(`base ${b.base}（${ssParts.join(" + ")}）`);
      if (tileParts.length) parts.push(`板块 ${b.tile}（${tileParts.join(" + ")}）`);
      if (cardParts.length) parts.push(`卡牌 ${b.card}（${cardParts.join(" + ")}）`);
      if (!parts.length) return null;
      return { player: p, text: parts.join(" + ") };
    }).filter(Boolean);
  })();

  // 每名玩家行动清单：按玩家分组，组内每回合一行（初始选择并入该玩家第一回合）；
  // 玩家 PASS（终局）之后追加该玩家的终局结算说明（2026-08-21 用户口径）
  const playerSections = PLAYER_ORDER.map((p) => {
    const list = groupByTurn(perPlayer[p] || []);
    let body = list.length
      ? list.map((g) => turnCells(g, false)).join("\n")
      : '<tr><td colspan="6" class="muted">无行动</td></tr>';
    const finalLine = finalDetailLines.find((line) => line.player === p);
    if (finalLine) {
      body += `\n<tr class="round-head"><td colspan="6">终局结算（完整终局口径）</td></tr>
<tr><td colspan="6" class="final-detail"><b>${playerColor(p)}</b>：${escapeHtml(finalLine.text)}</td></tr>`;
    }
    return `<section class="panel">
      <h2><span class="dot c-${p}"></span>${playerColor(p)}色玩家 · ${list.length} 个回合</h2>
      <table>
        <thead><tr><th>轮/回合</th><th>主行动</th><th>步数</th><th>分Δ</th><th>分数</th><th>钱/电/宣/手</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
  }).join("\n");

  // 全程依次复盘：按轮分组，每玩家每回合一行；末尾追加终局结算说明（2026-08-21 用户口径：
  // PASS 终局之后显示该玩家/各玩家的结算说明）
  const turnGroups = groupByTurn(rows);
  let lastRound = null;
  let chronoBody = "";
  for (const g of turnGroups) {
    if (g.r !== lastRound) {
      chronoBody += `<tr class="round-head"><td colspan="7">第 ${g.r ?? "?"} 轮</td></tr>`;
      lastRound = g.r;
    }
    chronoBody += turnCells(g, true);
  }
  if (finalDetailLines.length) {
    chronoBody += `<tr class="round-head"><td colspan="7">终局结算（完整终局口径）</td></tr>`;
    for (const line of finalDetailLines) {
      const highlight = line.player === "player-white" ? ' style="font-weight:700"' : "";
      chronoBody += `<tr><td colspan="7" class="final-detail"${highlight}>${playerColor(line.player)}：${escapeHtml(line.text)}</td></tr>`;
    }
  }

  const finalSection = (() => {
    if (final) {
      const head = "<thead><tr><th>玩家</th><th>完整终局分</th><th>base</th><th>板块</th><th>卡牌</th></tr></thead>";
      const body = PLAYER_ORDER.map((p) => {
        const b = final.breakdown[p];
        const total = final.scores[p];
        const highlight = p === "player-white" ? ' class="hero"' : "";
        return `<tr${highlight}><td>${playerColor(p)}</td><td class="num"><b>${total ?? "—"}</b></td><td class="num">${b?.base ?? "—"}</td><td class="num">${b?.tile ?? "—"}</td><td class="num">${b?.card ?? "—"}</td></tr>`;
      }).join("");
      // 终局结算明细：base 构成 + 板块 + 卡牌（2026-08-21 用户口径：具体什么获得了几分）
      const details = finalDetailLines
        .map((line) => `<div class="final-detail"><b>${playerColor(line.player)}</b>：${escapeHtml(line.text)}</div>`)
        .join("");
      return `<section class="panel final">
        <h2>终局分数（完整终局口径，存档 finalScores）</h2>
        <table>${head}<tbody>${body}
        <tr class="avg-row"><td>均分</td><td class="num"><b>${final.avgScore.toFixed(2)}</b></td><td colspan="3" class="muted">白色为人类席位（本轮评估侧重）</td></tr>
        </tbody></table>
        ${details ? `<div class="final-details">${details}</div>` : ""}
      </section>`;
    }
    const last = lastAfter ? playerResourceRow(lastAfter.p, "player-white") : null;
    const scores = PLAYER_ORDER.map((p) => {
      const s = lastAfter?.p?.[p]?.[0];
      return s == null ? "—" : String(s);
    }).join(" / ");
    return `<section class="panel final">
      <h2>当前分数（非终局 · 最后一步快照）</h2>
      <p class="muted">${PLAYER_ORDER.map((p) => `${playerColor(p)} ${lastAfter?.p?.[p]?.[0] ?? "—"}`).join(" · ")}</p>
    </section>`;
  })();

  const famBody = Object.entries(famCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([fam, count]) => `<tr><td>${escapeHtml(FAMILY_LABELS[fam] || fam)}</td><td class="num">${count}</td></tr>`)
    .join("");

  const relRecord = opts.recordRelPath || (opts.recordFile ? relRecordPath(opts.recordFile) : null);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SETI 行动复盘 · ${escapeHtml(opts.versionName || opts.versionId)} · ${escapeHtml(opts.runKey || opts.savePath)}</title>
<style>
:root{--bg:#f7f8fa;--panel:#fff;--line:#dde3ea;--text:#1c2333;--muted:#7a8494;--blue:#3d83d7;--green:#54a96b;--brown:#9a623f;--white:#333;--accent:#2f6fed;--good:#27ae60;--bad:#c0392b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.page{width:min(1280px,calc(100% - 32px));margin:auto;padding:30px 0 60px}
.eyebrow{color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.08em}
h1{margin:4px 0 10px;font-size:26px}
.meta{color:var(--muted);font-size:12.5px;margin:6px 0 2px}
.links{font-size:12.5px;margin:4px 0 18px}
.links a{color:var(--accent);text-decoration:none}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:18px 0}
.panel h2{margin:0 0 10px;font-size:15px;display:flex;align-items:center;gap:8px}
table{border-collapse:collapse;width:100%;font-size:12.5px}
th,td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
th{background:#f0f2f6;font-weight:600;white-space:nowrap}
td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td.actor{white-space:nowrap;font-weight:600}
td.sum{min-width:220px;word-break:break-word}
.main-act{font-weight:600}
.quick-list{margin-top:3px;font-size:11px;color:var(--muted);font-weight:400}
.final-details{margin-top:10px;display:grid;gap:4px}
.final-detail{font-size:12px;line-height:1.5}
tr.round-head td{background:#eef2f9;font-weight:700;color:#4a5568}
.avg-row td{background:#eaf7ea}
.hero td:first-child{font-weight:700}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%}
.c-player-blue{background:var(--blue)}.c-player-green{background:var(--green)}.c-player-brown{background:var(--brown)}.c-player-white{background:var(--white)}
.dp{color:var(--good);font-weight:700}.dm{color:var(--bad);font-weight:700}.d0{color:#c3c9d2}
.ph{display:inline-block;padding:1px 6px;border-radius:4px;background:#eef1f6;color:#556;font-size:11px;margin-right:4px}
.fam{font-weight:600}
.muted{color:var(--muted)}
code{background:#f0f2f6;padding:1px 4px;border-radius:3px;font-size:12px}
.version-badge{display:inline-block;padding:2px 10px;border-radius:8px;background:#e8eefa;color:var(--accent);font-weight:700;font-size:14px}
@media(max-width:760px){.page{width:100%;padding:16px 10px}table{font-size:11.5px}td.sum{min-width:0}}
</style>
</head>
<body><main class="page">
  <span class="eyebrow">SETI · 机器人行动复盘（纯重放存档 replaySteps，无 AI 重跑）</span>
  <h1><span class="version-badge">${escapeHtml(opts.versionId)}</span> ${escapeHtml(opts.runKey || "")}</h1>
  <div class="meta">seed=${escapeHtml(save.seed || "?")} · gitCommit=${escapeHtml(opts.gitCommit || "?")} · policy=${escapeHtml(opts.policyVersion || "?")} · flags=${escapeHtml(flagsText(opts.flags))} · 模式=${escapeHtml(opts.mode || "?")} · 步数 ${steps.length} · 耗时 ${fmtMs(opts.wallMs)}</div>
  <div class="links">${relRecord ? `记录: <a href="../${escapeHtml(path.posix.relative(path.posix.join("reports","iteration",opts.versionId), relRecord))}">${escapeHtml(opts.recordFile)}</a>` : ""} · 存档: <code>${escapeHtml(opts.savePath)}</code></div>
  ${finalSection}
  ${playerSections}
  <section class="panel">
    <h2>全程依次复盘（${turnGroups.length} 个玩家回合 · ${steps.length} 步）</h2>
    <table>
      <thead><tr><th>轮/回合</th><th>玩家</th><th>主行动</th><th>步数</th><th>分Δ</th><th>分数</th><th>钱/电/宣/手</th></tr></thead>
      <tbody>${chronoBody}</tbody>
    </table>
  </section>
  <section class="panel">
    <h2>行动族统计</h2>
    <table><thead><tr><th>行动族</th><th>次数</th></tr></thead><tbody>${famBody}</tbody></table>
  </section>
</main></body></html>`;
}

// ---------------- 总览页渲染 ----------------

function renderPage(registry) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`页面模板缺失: ${TEMPLATE_PATH}`);
  }
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  // 内嵌 JSON 到 <script>：转义 < 防止字符串内 "</script" 之类的序列截断脚本
  const json = JSON.stringify(registry, null, 2).replace(/</g, "\\u003c");
  if (!template.includes("/*__REGISTRY_JSON__*/")) {
    throw new Error("模板缺少 /*__REGISTRY_JSON__*/ 占位符");
  }
  const html = template.replace("/*__REGISTRY_JSON__*/", json);
  fs.mkdirSync(path.dirname(PAGE_PATH), { recursive: true });
  fs.writeFileSync(PAGE_PATH, html, "utf8");
  return PAGE_PATH;
}

// ---------------- 主构建 ----------------

// 纯计算 registry（不落盘）：解析版本 → 结果 → best-of → 审计 → 版本详情。
// generateReports=true 时为所有有存档但缺报告的记录生成复盘报告（纯重放）并落盘；
// forceReports=true 时已存在的报告也重新生成（报告模板/逻辑改动后刷新用）。
function computeRegistry({ generateReports = false, forceReports = false } = {}) {
  const versionsData = loadVersions();
  const versions = versionsData.versions;
  const recordsByFile = scanResearchRecords();
  const resolvedMap = {};
  for (const v of versions) resolvedMap[v.id] = resolveVersionResults(v, recordsByFile);

  const generated = [];
  if (generateReports) {
    for (const v of versions) {
      for (const r of resolvedMap[v.id]) {
        if (r.missingRecord || !r.savePath || !r.reportPath) continue;
        if (!forceReports && r.reportExists) continue;
        const reportPath = path.join(REPO_ROOT, r.reportPath);
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        const html = buildActionLogReport({
          savePath: r.savePath,
          versionId: v.id,
          versionName: v.name,
          runKey: r.recordFile.replace(/\.json$/, ""),
          recordFile: r.recordFile,
          gitCommit: r.gitCommit,
          policyVersion: r.policyVersion,
          flags: r.flags,
          wallMs: r.wallMs,
          mode: r.mode,
        });
        fs.writeFileSync(reportPath, html, "utf8");
        r.reportExists = true;
        generated.push(r.reportPath);
      }
    }
  }

  const bestOf = computeBestOf(versions, resolvedMap);
  const { warnings, orphans } = auditRegistry(versions, recordsByFile, resolvedMap, bestOf);

  // 当前 baseline 版本：优先 head 精确匹配 git HEAD；否则取 head 为 HEAD 最近祖先的
  // 版本（策略提交后又有工具/文档提交时，HEAD 前进到非版本提交，策略基线不变）。
  const nowHead = gitHeadShort();
  let currentBaseline = null;
  for (const v of versions) {
    if (v.head === nowHead || (nowHead && v.head && (nowHead.startsWith(v.head) || v.head.startsWith(nowHead)))) {
      currentBaseline = v;
      break;
    }
  }
  if (!currentBaseline) {
    let best = null;
    let bestDist = -1;
    for (const v of versions) {
      if (!v.head || !gitIsAncestor(v.head, nowHead)) continue;
      const distText = git(["rev-list", "--count", `${v.head}..${nowHead}`], { silent: true });
      const dist = distText != null ? Number(distText) : -1;
      if (dist >= 0 && (best == null || dist < bestDist)) {
        best = v;
        bestDist = dist;
      }
    }
    currentBaseline = best;
  }

  // 组装版本列表（含提交信息、diff 摘要、完整性）
  const versionOut = versions.map((v) => {
    const commits = (v.commits || []).map((c) => gitCommitInfo(c)).filter(Boolean);
    const baseVersion = v.baseline ? versions.find((x) => x.id === v.baseline) : null;
    const diffStat = gitRangeShortStat(baseVersion?.head || null, v.head);
    const diffFiles = gitRangeNumstat(baseVersion?.head || null, v.head);
    const results = resolvedMap[v.id] || [];
    const hasRecord = results.some((r) => !r.missingRecord);
    const hasSave = results.some((r) => r.savePath);
    const hasReport = results.some((r) => r.reportExists);
    const reportLinks = results
      .filter((r) => r.reportExists)
      .map((r) => ({ runKey: r.recordFile.replace(/\.json$/, ""), path: r.reportPath, mode: r.mode }));
    return {
      id: v.id,
      name: v.name,
      date: v.date,
      baseline: v.baseline,
      head: v.head,
      commits,
      summary: v.summary || "",
      diffStat,
      diffFiles,
      results,
      roadmap: v.roadmap || null,
      isHead: currentBaseline ? v.id === currentBaseline.id : false,
      completeness: { record: hasRecord, save: hasSave, report: hasReport, reportLinks },
    };
  });

  return {
    registry: {
      schemaVersion: REGISTRY_SCHEMA,
      builtAt: new Date().toISOString(),
      board: versionsData.defaultBoard || { seed: "seti-free-analyze-v1", name: "免电分析盘面" },
      headCommit: nowHead,
      currentBaseline: currentBaseline ? currentBaseline.id : null,
      worktreeDirty: gitIsDirty(),
      bestOf,
      versions: versionOut,
      warnings,
      orphans,
    },
    generated,
  };
}

// 构建 registry + 落盘（registry.json + 页面）。
function buildRegistry(options = {}) {
  const { registry, generated } = computeRegistry(options);
  writeJson(REGISTRY_PATH, registry);
  const pagePath = renderPage(registry);
  return { registry, pagePath, generated };
}

// ---------------- 委托 run_research_validation ----------------

// 标准迭代入口的核心委托：跑验证（防重跑由底层指纹去重保证）。
// 用异步 spawn（非 spawnSync）并**实时透传**子进程 stdout/stderr 到父进程——
// 全盘可能运行数分钟，run_research_validation 默认逐决策把进度写到 stderr
// （progress.js，minIntervalMs=1000），透传后终端/agent 能实时看到
// 轮次/回合/步数/分数，而不是等子进程结束才一次性吐出。
// 返回 Promise<{ ok, status, recordFile, savePath, output }>；拒绝时 ok=false。
function runResearchValidation(args) {
  return new Promise((resolve) => {
    const child = spawn("node", [path.join(__dirname, "run_research_validation.js"), ...args], {
      cwd: REPO_ROOT,
    });
    let stdoutText = "";
    let stderrText = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdoutText += text;
      process.stdout.write(text); // 实时透传（结果行/记录行）
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderrText += text;
      process.stderr.write(text); // 实时透传（逐决策进度行）
    });
    child.on("error", (err) => {
      process.stderr.write(`run_research_validation 启动失败: ${err.message}\n`);
      resolve({ ok: false, status: 1, recordFile: null, savePath: null, output: err.message });
    });
    child.on("close", (code) => {
      const ok = code === 0;
      let recordFile = null;
      let savePath = null;
      if (ok) {
        const m = stdoutText.match(/记录:\s*(reports[\\/]research[\\/][^\s]+)/);
        if (m) recordFile = path.basename(m[1]);
        const m2 = stdoutText.match(/存档:\s*(seti-saves[\\/][^\s]+)/);
        if (m2) savePath = m2[1].replace(/\\/g, "/");
      }
      resolve({ ok, status: code, recordFile, savePath, output: stdoutText + stderrText });
    });
  });
}

module.exports = {
  REPO_ROOT,
  RESEARCH_DIR,
  ITER_DIR,
  VERSIONS_PATH,
  REGISTRY_PATH,
  TEMPLATE_PATH,
  PAGE_PATH,
  PLAYER_ORDER,
  PLAYER_LABELS,
  FAMILY_LABELS,
  git,
  gitHeadShort,
  gitCommitInfo,
  gitIsDirty,
  gitIsAncestor,
  gitRangeCommits,
  gitRangeShortStat,
  gitRangeNumstat,
  readJson,
  writeJson,
  loadVersions,
  saveVersions,
  scanResearchRecords,
  readSaveFinalScores,
  resolveVersionResults,
  computeBestOf,
  auditRegistry,
  buildActionLogReport,
  replaySaveEnriched,
  TECH_BONUS_LABELS,
  renderPage,
  computeRegistry,
  buildRegistry,
  runResearchValidation,
  escapeHtml,
  flagsText,
  fmtMs,
};

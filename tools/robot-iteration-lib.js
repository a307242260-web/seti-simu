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
const { execFileSync, spawnSync } = require("node:child_process");

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
  const spec = from ? `${from}..${to}` : to;
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
  for (const fsItem of match.finalScores) {
    const pid = fsItem.playerId;
    scores[pid] = fsItem.totalScore ?? null;
    breakdown[pid] = {
      total: fsItem.totalScore ?? null,
      base: fsItem.baseScore ?? null,
      tile: fsItem.tileScore ?? null,
      card: fsItem.cardScore ?? null,
    };
  }
  const values = PLAYER_ORDER.map((p) => scores[p]).filter((v) => v != null);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return { scores, avgScore: avg, breakdown };
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
    topByAvg: byAvg.slice(0, 3).map((x) => ({
      value: avgOf(x),
      white: whiteOf(x),
      ...describe(x),
    })),
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
        warnings.push({
          kind: "commit-mismatch",
          level: "warn",
          text: `${v.id} 的记录 ${r.recordFile} gitCommit=${recCommit} 不在版本 commits（${v.commits?.join(",") || "无"}）内——运行于脏工作树或归属错误，请核对 versions.json`,
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
  // 有存档但缺复盘报告（可在 build --reports 补齐）
  for (const v of versions) {
    for (const r of resolvedMap[v.id] || []) {
      if (r.missingRecord) continue;
      if (!r.savePath) continue;
      const saveAbs = path.join(REPO_ROOT, r.savePath);
      if (!fs.existsSync(saveAbs)) {
        warnings.push({
          kind: "missing-save",
          level: "info",
          text: `${v.id} 的记录 ${r.recordFile} 声明存档 ${r.savePath} 已不存在（无法生成复盘报告，仅记录级指标）`,
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

  function stepCells(row, withPlayer) {
    const cur = row.cur;
    const res = cur
      ? `${cur.credits} 钱 · ${cur.energy} 电 · ${cur.publicity} 宣 · ${cur.hand} 手`
      : "—";
    const score = cur ? `${cur.score}` : "—";
    const phaseBadge = row.phase ? `<span class="ph ph-${row.phase}">${row.phase}</span>` : "";
    const fam = row.family ? FAMILY_LABELS[row.family] || row.family : "—";
    const playerCell = withPlayer
      ? `<td class="actor c-${row.actor}">${playerColor(row.actor)}</td>`
      : "";
    return `<tr>
      <td class="num">#${row.i}</td>
      ${playerCell}
      <td class="num">R${row.r ?? "?"}·T${row.t ?? "?"}</td>
      <td>${phaseBadge} <span class="fam">${escapeHtml(fam)}</span></td>
      <td class="sum">${escapeHtml(row.summary || "")}</td>
      <td class="num">${fmtDelta(row.delta)}</td>
      <td class="num">${score}</td>
      <td class="res muted">${res}</td>
    </tr>`;
  }

  const playerSections = PLAYER_ORDER.map((p) => {
    const list = perPlayer[p] || [];
    const body = list.length
      ? list.map((row) => stepCells(row, false)).join("\n")
      : '<tr><td colspan="7" class="muted">无行动</td></tr>';
    return `<section class="panel">
      <h2><span class="dot c-${p}"></span>${playerColor(p)}色玩家 · ${list.length} 步</h2>
      <table>
        <thead><tr><th>步</th><th>轮/回合</th><th>阶段</th><th>行动</th><th>动作摘要</th><th>分Δ</th><th>分数</th><th>钱/电/宣/手</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
  }).join("\n");

  // 全程依次复盘（按轮分组）
  let lastRound = null;
  let chronoBody = "";
  for (const row of rows) {
    if (row.r !== lastRound) {
      chronoBody += `<tr class="round-head"><td colspan="8">第 ${row.r ?? "?"} 轮</td></tr>`;
      lastRound = row.r;
    }
    chronoBody += stepCells(row, true);
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
      return `<section class="panel final">
        <h2>终局分数（完整终局口径，存档 finalScores）</h2>
        <table>${head}<tbody>${body}
        <tr class="avg-row"><td>均分</td><td class="num"><b>${final.avgScore.toFixed(2)}</b></td><td colspan="3" class="muted">白色为人类席位（本轮评估侧重）</td></tr>
        </tbody></table>
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
td.sum{min-width:220px}
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
    <h2>全程依次复盘（${steps.length} 步）</h2>
    <table>
      <thead><tr><th>步</th><th>玩家</th><th>轮/回合</th><th>阶段</th><th>行动</th><th>动作摘要</th><th>分Δ</th><th>分数</th><th>钱/电/宣/手</th></tr></thead>
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
// generateReports=true 时为所有有存档但缺报告的记录生成复盘报告（纯重放）并落盘。
function computeRegistry({ generateReports = false } = {}) {
  const versionsData = loadVersions();
  const versions = versionsData.versions;
  const recordsByFile = scanResearchRecords();
  const resolvedMap = {};
  for (const v of versions) resolvedMap[v.id] = resolveVersionResults(v, recordsByFile);

  const generated = [];
  if (generateReports) {
    for (const v of versions) {
      for (const r of resolvedMap[v.id]) {
        if (r.missingRecord || !r.savePath || !r.reportPath || r.reportExists) continue;
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

  // 组装版本列表（含提交信息、diff 摘要、完整性）
  const nowHead = gitHeadShort();
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
      isHead: v.head === nowHead || (nowHead && v.head && (nowHead.startsWith(v.head) || v.head.startsWith(nowHead))),
      completeness: { record: hasRecord, save: hasSave, report: hasReport, reportLinks },
    };
  });

  return {
    registry: {
      schemaVersion: REGISTRY_SCHEMA,
      builtAt: new Date().toISOString(),
      board: versionsData.defaultBoard || { seed: "seti-free-analyze-v1", name: "免电分析盘面" },
      headCommit: nowHead,
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

// 标准迭代入口的核心委托：跑验证（防重跑由底层指纹去重保证），
// 返回 { ok, recordFile, savePath, output }；拒绝时 ok=false。
function runResearchValidation(args) {
  const result = spawnSync("node", [path.join(__dirname, "run_research_validation.js"), ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== 0) {
    return { ok: false, status: result.status, output };
  }
  let recordFile = null;
  let savePath = null;
  const m = result.stdout.match(/记录:\s*(reports[\\/]research[\\/][^\s]+)/);
  if (m) recordFile = path.basename(m[1]);
  const m2 = result.stdout.match(/存档:\s*(seti-saves[\\/][^\s]+)/);
  if (m2) savePath = m2[1].replace(/\\/g, "/");
  return { ok: true, recordFile, savePath, output };
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
  renderPage,
  computeRegistry,
  buildRegistry,
  runResearchValidation,
  escapeHtml,
  flagsText,
  fmtMs,
};

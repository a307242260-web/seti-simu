"use strict";
// 机器人迭代标准入口（2026-08-21 建立）
// ---------------------------------------------------------------
// 每次迭代只做两件事：改核心策略 + 分析历史版本。本工具把"跑验证 → 登记版本 →
// 生成复盘报告 → 重建总览页"收拢为一条命令，绝不重跑同一版本（底层
// run_research_validation 指纹去重 + 本工具登记守卫双重保障）。
//
// 用法:
//   node tools/robot_iterate.js run --name <id> [--full] [--steps N] [--config k=v] [--summary "..."]
//       标准迭代入口：跑验证（默认 200 步）→ 自动登记版本 → 生成复盘报告 → 重建总览页。
//       --version-id <vid>  版本登记 id（默认 = --name）
//       --version-name <n>  显示名（默认 = --name）
//       --baseline <vid>    基线版本（默认取最近登记且为 HEAD 祖先的版本）
//       --force             强制重跑（务必在提交说明写明覆盖原因）
//       --no-reports        跳过复盘报告生成
//   node tools/robot_iterate.js register --version-id <id> [--name n] [--summary "..."] [--commits h1,h2] [--records f1,f2] [--baseline vid] [--date YYYY-MM-DD] [--reports]
//       手动登记已有记录为一个版本（不改代码不重跑）。
//   node tools/robot_iterate.js build [--reports] [--force-reports]
//       重建 registry.json + robot-iteration.html；--reports 为所有有存档但缺报告的记录补齐复盘报告（纯重放），
//       --force-reports 连已存在的报告也重新生成（报告模板/逻辑改动后刷新用）。
//   node tools/robot_iterate.js review [--best] [--show <id>] [--compare <base>..<head>]
//       历史分析（只读，不重跑）。
//   node tools/robot_iterate.js check
//       完整性审计：孤儿记录 / provenance 不匹配 / 缺存档 / 缺复盘报告。
//
// 机制与数据格式见 docs/robot-iteration-registry.md。
const path = require("node:path");
const lib = require("./robot-iteration-lib.js");

const {
  loadVersions,
  saveVersions,
  gitHeadShort,
  gitIsAncestor,
  gitRangeCommits,
  gitCommitInfo,
  computeRegistry,
  buildRegistry,
  runResearchValidation,
  PLAYER_LABELS,
  fmtMs,
} = lib;

const REPO_ROOT = lib.REPO_ROOT;

// ---------------- 参数解析 ----------------

function parseArgs(argv) {
  const opts = { config: [], flags: [] };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    const eq = a.indexOf("=");
    const key = eq >= 0 ? a.slice(0, eq) : a;
    const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
    const take = (name) => {
      if (inlineVal != null) return inlineVal;
      i += 1;
      if (i >= argv.length) throw new Error(`选项 ${name} 缺少值`);
      return argv[i];
    };
    switch (key) {
      case "--full": opts.full = true; break;
      case "--force": opts.force = true; break;
      case "--no-reports": opts.noReports = true; break;
      case "--reports": opts.reports = true; break;
      case "--force-reports": opts.forceReports = true; break;
      case "--verbose": opts.verbose = true; break;
      case "--steps": opts.steps = Number(take(key)); break;
      case "--name": opts.name = take(key); break;
      case "--version-id": opts.versionId = take(key); break;
      case "--version-name": opts.versionName = take(key); break;
      case "--summary": opts.summary = take(key); break;
      case "--baseline": opts.baseline = take(key); break;
      case "--commits": opts.commits = take(key).split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--records": opts.records = take(key).split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--date": opts.date = take(key); break;
      case "--head": opts.head = take(key); break;
      case "--seed": opts.seed = take(key); break;
      case "--config": opts.config.push(take(key)); break;
      case "--show": opts.show = take(key); break;
      case "--compare": opts.compare = take(key); break;
      case "--best": opts.best = true; break;
      default:
        if (key.startsWith("--")) throw new Error(`未知选项: ${key}`);
        positionals.push(a);
    }
  }
  opts.cmd = positionals[0] || "build";
  return opts;
}

function die(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function usage() {
  return `SETI 机器人迭代标准入口

用法:
  node tools/robot_iterate.js run --name <id> [--full] [--steps N] [--config k=v] [--summary "..."]
  node tools/robot_iterate.js register --version-id <id> [--name n] [--summary "..."] [--commits h1,h2] [--records f1,f2] [--baseline vid] [--date YYYY-MM-DD] [--reports]
  node tools/robot_iterate.js build [--reports] [--force-reports]
  node tools/robot_iterate.js review [--best] [--show <id>] [--compare <base>..<head>]
  node tools/robot_iterate.js check
`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------- 子命令 ----------------

function autoBaseline(versions, head) {
  // 最近登记（数组靠前=最新）且 head 为当前 HEAD 祖先的版本作为基线
  for (const v of versions) {
    if (!v.head) continue;
    if (gitIsAncestor(v.head, head)) return v.id;
  }
  return null;
}

async function cmdRun(opts) {
  if (!opts.name) die("run 需要 --name <id>（实验名 = 版本登记 id 的默认值）");
  const versionsData = loadVersions();
  const versions = versionsData.versions;
  const head = gitHeadShort();
  const vid = opts.versionId || opts.name;

  // 登记守卫：同一 id 已登记且 head 一致 → 绝不重跑
  const existing = versions.find((v) => v.id === vid);
  if (existing && !opts.force) {
    const sameHead = existing.head && (existing.head === head || existing.head.startsWith(head) || head.startsWith(existing.head));
    if (sameHead) {
      die(`[拒绝] 版本 ${vid} 已登记于当前代码版本（head=${existing.head}）。同一代码版本绝不重跑。\n  如确实要强制重跑，加 --force 并在提交说明写明覆盖原因（旧记录会被自动备份）。`, 2);
    }
  }

  // 委托 run_research_validation（指纹去重 + 快速→全盘续跑一体）
  const runArgs = ["--name", opts.name];
  if (opts.full) runArgs.push("--full");
  else runArgs.push("--steps", String(opts.steps || 200));
  if (opts.seed) runArgs.push("--seed", opts.seed);
  for (const c of opts.config) runArgs.push("--config", c);
  if (opts.force) runArgs.push("--force");
  if (opts.verbose) console.log(`> node tools/run_research_validation.js ${runArgs.join(" ")}`);

  const result = await runResearchValidation(runArgs);
  // 注意：stdout/stderr 已在 runResearchValidation 内实时透传（含逐决策进度），
  // 这里不再二次打印 result.output，避免输出重复。
  if (!result.ok) {
    if (result.status === 2) {
      die(`\n[拒绝] 同一实验同一代码版本已有记录，未重跑（符合'绝不重跑'铁律）。`, 2);
    }
    die(`\n[失败] run_research_validation 退出码 ${result.status}`, result.status || 1);
  }
  if (!result.recordFile) die("[失败] 未从输出解析到记录文件");

  // 自动登记版本
  const baselineId = opts.baseline || autoBaseline(versions, head);
  const baselineVersion = versions.find((v) => v.id === baselineId) || null;
  const commits = gitRangeCommits(baselineVersion?.head || null, head);
  const newestCommit = gitCommitInfo(head);
  const summary = opts.summary || (newestCommit ? `（自动登记 ${newestCommit.date}）${newestCommit.subject}` : "");
  const entry = {
    id: vid,
    name: opts.versionName || opts.name,
    date: opts.date || today(),
    baseline: baselineVersion ? baselineVersion.id : null,
    head,
    commits: commits.length ? commits : [head],
    summary,
    records: { [result.recordFile]: {} },
    roadmap: null,
  };
  const idx = versions.findIndex((v) => v.id === vid);
  if (idx >= 0) {
    // 保留人工摘要与旧记录，合并新记录
    if (opts.summary) entry.summary = opts.summary;
    else entry.summary = versions[idx].summary || summary;
    entry.records = { ...(versions[idx].records || {}), [result.recordFile]: {} };
    versions[idx] = entry;
  } else {
    versions.unshift(entry);
  }
  saveVersions(versionsData);
  console.log(`\n[登记] 版本 ${vid}（head=${head}，baseline=${baselineId || "无"}，commits=${commits.length || 1} 个）`);
  console.log(`  记录: reports/research/${result.recordFile}`);
  if (result.savePath) console.log(`  存档: ${result.savePath}`);

  // 生成复盘报告 + 重建总览页
  const { registry, pagePath, generated } = buildRegistry({ generateReports: !opts.noReports });
  console.log(`[页面] ${pagePath}`);
  if (generated.length) console.log(`[报告] 生成 ${generated.length} 份复盘报告`);
  printBestOf(registry);
  printWarnings(registry);
  console.log(`\n下一步：人工核对 versions.json 的 summary/records 注记后，提交记录体系产物（改动即文档，同一次提交）。`);
}

function cmdRegister(opts) {
  if (!opts.versionId) die("register 需要 --version-id <id>");
  const versionsData = loadVersions();
  const versions = versionsData.versions;
  const head = opts.head || gitHeadShort();
  const idx = versions.findIndex((v) => v.id === opts.versionId);
  const base = opts.baseline
    ? (versions.find((v) => v.id === opts.baseline) || null)
    : (idx >= 0 ? versions.find((v) => v.id === versions[idx].baseline) || null : null);
  const entry = {
    id: opts.versionId,
    name: opts.name || (idx >= 0 ? versions[idx].name : opts.versionId),
    date: opts.date || (idx >= 0 ? versions[idx].date : today()),
    baseline: base ? base.id : (idx >= 0 ? versions[idx].baseline : null),
    // 未显式给 commits/head 时保留已有版本定义（幂等重登记）；新版本默认取当前 HEAD
    head: opts.commits?.length ? opts.commits[opts.commits.length - 1] : (idx >= 0 ? versions[idx].head : head),
    commits: opts.commits?.length ? opts.commits : (idx >= 0 ? versions[idx].commits : [head]),
    summary: opts.summary ?? (idx >= 0 ? versions[idx].summary : ""),
    records: opts.records?.length
      ? Object.fromEntries(opts.records.map((f) => [f, {}]))
      : (idx >= 0 ? versions[idx].records : {}),
    roadmap: idx >= 0 ? versions[idx].roadmap : null,
  };
  if (idx >= 0) versions[idx] = entry;
  else versions.unshift(entry);
  saveVersions(versionsData);
  console.log(`[登记] 版本 ${entry.id}（head=${entry.head}，baseline=${entry.baseline || "无"}）`);
  const { pagePath, generated } = buildRegistry({ generateReports: Boolean(opts.reports) });
  console.log(`[页面] ${pagePath}`);
  if (generated.length) console.log(`[报告] 生成 ${generated.length} 份复盘报告`);
}

function cmdBuild(opts) {
  const { registry, pagePath, generated } = buildRegistry({
    generateReports: Boolean(opts.reports),
    forceReports: Boolean(opts.forceReports),
  });
  console.log(`[registry] ${lib.REGISTRY_PATH}`);
  console.log(`[页面] ${pagePath}`);
  if (generated.length) console.log(`[报告] 生成 ${generated.length} 份复盘报告`);
  printWarnings(registry);
}

function fmtScore(r) {
  if (!r) return "—";
  const s = r.scores;
  const cells = ["player-blue", "player-green", "player-brown", "player-white"]
    .map((c) => (s?.[c] ?? "—"))
    .join(" / ");
  return `${cells}（均 ${r.avgScore?.toFixed(1) ?? "—"} · ${r.steps} 步 · ${fmtMs(r.wallMs)}${r.terminal ? " · 终局" : ""} · ${r.scoreSource === "save-final" ? "完整终局" : "记录口径"})`;
}

function printBestOf(registry) {
  const b = registry.bestOf;
  const line = (label, x) => {
    if (!x) return `${label}: —`;
    const value = x.value != null ? x.value : (x.msPerStep != null ? `${x.msPerStep}ms/步` : fmtMs(x.wallMs));
    return `${label}: ${value}（${x.name} / ${x.versionId}${x.runKey ? " / " + x.runKey : ""} · ${x.steps ?? "?"} 步 · ${fmtMs(x.wallMs)} · 来源 ${x.provenance}${x.msPerStep ? ` · 每步 ${x.msPerStep}ms` : ""}）`;
  };
  console.log("\n===== 固定盘面最佳（全盘运行）=====");
  console.log(line("最佳白分", b.bestWhite));
  console.log(line("最佳均分", b.bestAvg));
  console.log(line("最快全盘（总耗时）", b.fastestWall));
  console.log(line("最快全盘（每步均耗时）", b.fastestPerStep));
}

function printWarnings(registry) {
  const warns = registry.warnings.filter((w) => w.level === "warn");
  const infos = registry.warnings.filter((w) => w.level === "info");
  if (warns.length) {
    console.log(`\n[警告 ${warns.length}]`);
    for (const w of warns) console.log(`  ! ${w.text}`);
  }
  if (infos.length) {
    console.log(`\n[提示 ${infos.length}]`);
    for (const w of infos) console.log(`  · ${w.text}`);
  }
  if (!warns.length && !infos.length) console.log("\n[审计] 无警告");
}

function cmdReview(opts) {
  const { registry } = computeRegistry({});
  if (opts.best) {
    printBestOf(registry);
    return;
  }
  if (opts.show) {
    const v = registry.versions.find((x) => x.id === opts.show);
    if (!v) die(`版本不存在: ${opts.show}`);
    console.log(`\n===== 版本 ${v.id}（${v.name}）${v.isHead ? "· HEAD" : ""} =====`);
    console.log(`日期: ${v.date} · head: ${v.head} · baseline: ${v.baseline || "无"}`);
    console.log(`改动摘要: ${v.summary}`);
    console.log("提交:");
    for (const c of v.commits) console.log(`  ${c.hash} ${c.date} ${c.subject}`);
    if (v.diffStat) console.log(`改动统计: ${v.diffStat}`);
    console.log("结果:");
    if (v.results.length) {
      for (const r of v.results) {
        if (r.missingRecord) {
          console.log(`  ✗ 声明记录缺失: ${r.recordFile}`);
          continue;
        }
        console.log(`  ${r.recordFile} → ${fmtScore(r)}${r.note ? `\n    注: ${r.note}` : ""}`);
      }
    } else {
      console.log("  （无 research 记录）");
    }
    if (v.roadmap) console.log(`roadmap 记录: 白 ${v.roadmap.scores?.["player-white"] ?? "—"} / 均分 ${v.roadmap.avgScore ?? "—"} / ${v.roadmap.steps ?? "—"} 步\n  来源: ${v.roadmap.note || ""}`);
    const base = v.baseline ? registry.versions.find((x) => x.id === v.baseline) : null;
    console.log("\n定位改动:");
    console.log(`  git log --oneline ${base ? base.head + ".." : ""}${v.head}`);
    console.log(`  git diff --stat ${base ? base.head + ".." : ""}${v.head}`);
    console.log("快速回退:");
    console.log(`  git checkout ${v.head}   # 回到该版本代码`);
    if (base) console.log(`  git revert --no-commit ${base.head}..${v.head}   # 工作区撤销该版本全部改动`);
    return;
  }
  if (opts.compare) {
    const parts = opts.compare.split("..");
    if (parts.length !== 2) die("--compare 需要 <base>..<head>");
    const a = registry.versions.find((x) => x.id === parts[0]);
    const b = registry.versions.find((x) => x.id === parts[1]);
    if (!a || !b) die(`版本不存在: ${!a ? parts[0] : parts[1]}`);
    console.log(`\n===== 对比 ${a.id}（${a.head}） vs ${b.id}（${b.head}） =====`);
    for (const v of [a, b]) {
      console.log(`${v.id} ${v.date} ${v.head}`);
      for (const r of v.results) {
        if (r.missingRecord) continue;
        console.log(`  ${r.mode} ${r.recordFile}: ${fmtScore(r)}`);
      }
      if (v.roadmap) console.log(`  roadmap: 白 ${v.roadmap.scores?.["player-white"] ?? "—"} 均 ${v.roadmap.avgScore ?? "—"}`);
    }
    console.log(`提交区间 ${a.head}..${b.head}:`);
    console.log(`  git log --oneline ${a.head}..${b.head}`);
    return;
  }
  // 默认：全版本一览
  console.log("\n===== 版本一览（倒序）=====");
  for (const v of registry.versions) {
    const comp = v.completeness;
    const marks = `${comp.record ? "记录✓" : "记录✗"}${comp.save ? " 存档✓" : ""}${comp.report ? " 复盘✓" : ""}`;
    console.log(`${v.id} ${v.date} head=${v.head}${v.isHead ? " (HEAD)" : ""} ${marks}`);
  }
  printBestOf(registry);
  printWarnings(registry);
}

function cmdCheck() {
  const { registry } = computeRegistry({});
  printWarnings(registry);
  const warnCount = registry.warnings.filter((w) => w.level === "warn").length;
  process.exit(warnCount ? 1 : 0);
}

// ---------------- main ----------------

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    die(`${err.message}\n${usage()}`);
  }
  switch (opts.cmd) {
    case "run": await cmdRun(opts); break;
    case "register": cmdRegister(opts); break;
    case "build": cmdBuild(opts); break;
    case "review": cmdReview(opts); break;
    case "check": cmdCheck(); break;
    case "help":
    case "--help":
    case "-h":
      console.log(usage());
      break;
    default:
      die(`未知子命令: ${opts.cmd}\n${usage()}`);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err.message}\n`);
  process.exit(1);
});

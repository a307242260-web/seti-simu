"use strict";

const fs = require("node:fs");
const path = require("node:path");
const standardAction = require("../randomizer/game/actions/standard-action");
const productionComposition = require("../randomizer/game/production-composition");

const ROOT = path.resolve(__dirname, "..");
const HOST_ROOTS = ["randomizer/app", "randomizer/training"];
const EXPECTED_DOMAINS = Object.freeze([
  "opening_session",
  "standard_action",
  "card_play",
  "science",
  "probe_turn",
  "residual_domains",
]);
const DELETED_RUNTIME_FILES = Object.freeze([
  "randomizer/app/action-briefing.js",
  "randomizer/app/action-log-export.js",
  "randomizer/app/action-runtime.js",
  "randomizer/app/aliens/species-runtime.js",
  "randomizer/app/bootstrap.js",
  "randomizer/app/browser-host/browser-services.js",
  "randomizer/app/browser-host/card-decision-ui.js",
  "randomizer/app/browser-host/index.js",
  "randomizer/app/browser-host/industry-alien-decision-ui.js",
  "randomizer/app/browser-host/player-stats-ui.js",
  "randomizer/app/browser-host/resident-projection.js",
  "randomizer/app/conditional-action-executor.js",
  "randomizer/app/conditional-decision-domain.js",
  "randomizer/app/constants.js",
  "randomizer/app/effect-flow.js",
  "randomizer/app/effect-choice-flow.js",
  "randomizer/app/quick-turn-action-executor.js",
  "randomizer/app/refresh.js",
  "randomizer/app/runtime.js",
  "randomizer/app/start-screen.js",
  "randomizer/game/aliens/render.js",
  "randomizer/game/basic-cards.js",
  "randomizer/game/data/nebula-render.js",
  "randomizer/game/data/render.js",
  "randomizer/game/effects/browser-pending-decision.js",
  "randomizer/game/effects/card-selection-decision.js",
  "randomizer/game/effects/industry-alien-session.js",
  "randomizer/game/effects/quick-action-session.js",
  "randomizer/game/effects/research-tech-session.js",
  "randomizer/game/effects/scan-card-session.js",
  "randomizer/game/history/transactions.js",
  "randomizer/game/industry/render.js",
  "randomizer/game/state/host-source.js",
  "randomizer/game/tech/render.js",
]);
const FORBIDDEN_HOST_PATTERNS = Object.freeze([
  ["private root", /\b(?:workingRoot|committedRoot|stateSourcePort|runWithWorkingState)\b/],
  ["rule owner factory", /\bcreate[A-Za-z0-9]*(?:Executor|Provider)\b/],
  ["pending Decision owner", /\b(?:openPendingDecision|readPendingDecision)\b/],
  ["Host history owner", /\b(?:quickActionHistory|historyCommands)\b/],
  ["renamed rule bridge", /\b(?:RuleBridge|RulesBridge|RuleDispatcher|RulesDispatcher)\b/],
]);
const FORBIDDEN_SUCCESS_FALLBACK = /\b(?:unsupported|unavailable|no_legal_choice|unknown)[\s\S]{0,180}\bok\s*:\s*true\b/i;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "fixtures" ? [] : walk(absolute);
    return absolute;
  });
}

function auditSourceText(source, label = "fixture") {
  for (const [name, pattern] of FORBIDDEN_HOST_PATTERNS) {
    if (pattern.test(source)) throw new Error(`${label}: 检出 ${name}`);
  }
  if (FORBIDDEN_SUCCESS_FALLBACK.test(source)) {
    throw new Error(`${label}: 未知/不可用分支不得成功 fallback`);
  }
  if (/\bprojection(?:\.state)?\.(?:playerState|players|cardState|cards|rocketState|rockets|turnState|turn|match)\b[^\n;]{0,100}(?:=|\+\+|--)/.test(source)) {
    throw new Error(`${label}: projection 附近检出规则 slice 写入`);
  }
  return true;
}

function productionHostFiles() {
  return HOST_ROOTS.flatMap((relative) => walk(path.join(ROOT, relative)))
    .filter((file) => file.endsWith(".js"))
    .filter((file) => !file.endsWith(".test.js"))
    .filter((file) => !file.endsWith(".browser-smoke.js"))
    .sort();
}

function assertBrowserEntryScripts() {
  const source = fs.readFileSync(path.join(ROOT, "randomizer/index.html"), "utf8");
  const scripts = [...source.matchAll(/<script\s+src="([^"]+)"/g)]
    .map((match) => match[1].split("?")[0])
    .filter((entry) => entry.startsWith("./"));
  if (new Set(scripts).size !== scripts.length) {
    throw new Error("Browser 入口存在重复 script");
  }
  for (const script of scripts) {
    const absolute = path.join(ROOT, "randomizer", script.slice(2));
    if (!fs.existsSync(absolute)) throw new Error(`Browser 入口引用不存在脚本: ${script}`);
  }
  return scripts;
}

function assertBrowserMachinePlayerWiring() {
  const app = fs.readFileSync(path.join(ROOT, "randomizer/app.js"), "utf8");
  const bootstrap = fs.readFileSync(path.join(ROOT, "randomizer/app/ai/browser-bootstrap.js"), "utf8");
  const required = [
    ["Browser bootstrap", app, "createBrowserAiBootstrap"],
    ["Machine Player run", app, "machinePlayerPort.runOnce"],
    ["Policy input adapter", bootstrap, "createPolicyInputAdapter"],
    ["Machine Player Host boundary", bootstrap, "createBrowserMachinePlayerPort"],
  ];
  for (const [label, source, token] of required) {
    if (!source.includes(token)) throw new Error(`${label} 未接入生产 Browser composition`);
  }
  for (const token of ["openingAutomation", "aiControlRuntimeModule", "choices[0].standardAction"]) {
    if (app.includes(token) || bootstrap.includes(token)) {
      throw new Error(`Browser Machine Player 恢复旧旁路: ${token}`);
    }
  }
}

function assertGameHasNoBrowserRuntime() {
  const files = walk(path.join(ROOT, "randomizer/game"))
    .filter((file) => file.endsWith(".js"))
    .filter((file) => !file.endsWith(".test.js"))
    .filter((file) => !file.endsWith(".browser-smoke.js"));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (/\b(?:document|window)\./.test(source) || /\bsource\?\.Seti[A-Za-z0-9]+/.test(source)) {
      throw new Error(`规则模块残留 Browser runtime: ${path.relative(ROOT, file)}`);
    }
    if (/\bfunction getSlice\(root,\s*browserKey,\s*committedKey\)/.test(source)) {
      throw new Error(`规则模块恢复双 root 兼容: ${path.relative(ROOT, file)}`);
    }
  }
}

function assertProductionPack() {
  const pack = productionComposition.createProductionDomainPack();
  const families = [...standardAction.ALL_FAMILIES].sort();
  const owned = Object.keys(pack.familyOwners).sort();
  if (families.length !== 22) throw new Error(`Standard Action family 数量不是 22: ${families.length}`);
  if (JSON.stringify(owned) !== JSON.stringify(families)) {
    throw new Error(`Production family coverage 不完整: ${JSON.stringify(owned)}`);
  }
  const domains = pack.effectDomains.map((domain) => domain.id);
  if (JSON.stringify(domains) !== JSON.stringify(EXPECTED_DOMAINS)) {
    throw new Error(`Production domain 必须恰为六个: ${JSON.stringify(domains)}`);
  }
  if (new Set(Object.values(pack.familyOwners)).size !== EXPECTED_DOMAINS.length - 1) {
    throw new Error("Production family owner 数量不是五个");
  }
  return pack;
}

function assertNegativeFixtures() {
  const fixtures = [
    ["second-owner", "const RuleBridge = { createLaunchExecutor() {} };"],
    ["direct-root-write", "projection.playerState.players[0].credits = 99;"],
    ["renamed-bridge", "const RulesDispatcher = { dispatch(intent) { return intent; } };"],
    ["success-fallback", "if (code === 'no_legal_choice') return { ok: true };"],
  ];
  for (const [label, source] of fixtures) {
    let rejected = false;
    try {
      auditSourceText(source, label);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`负向 fixture 未失败: ${label}`);
  }
  for (const options of [
    { additionalDomains: [{ id: "second_launch", families: ["launch"] }] },
    { effectDomains: [] },
    { standardActionDomainOptions: {} },
  ]) {
    let rejected = false;
    try {
      productionComposition.createProductionDomainPack(options);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`Host 自定义 Production owner 未在构造期失败: ${JSON.stringify(options)}`);
  }
}

function runAudit() {
  const pack = assertProductionPack();
  const files = productionHostFiles();
  for (const file of files) {
    auditSourceText(fs.readFileSync(file, "utf8"), path.relative(ROOT, file));
  }
  for (const relative of DELETED_RUNTIME_FILES) {
    if (fs.existsSync(path.join(ROOT, relative))) throw new Error(`旧规则入口仍存在: ${relative}`);
  }
  const browserScripts = assertBrowserEntryScripts();
  assertBrowserMachinePlayerWiring();
  assertGameHasNoBrowserRuntime();
  assertNegativeFixtures();
  return Object.freeze({
    ok: true,
    familyCount: standardAction.ALL_FAMILIES.length,
    domainIds: pack.effectDomains.map((domain) => domain.id),
    auditedHostFiles: files.length,
    deletedRuntimeFiles: DELETED_RUNTIME_FILES.length,
    browserScriptCount: browserScripts.length,
  });
}

if (require.main === module) {
  console.log(JSON.stringify(runAudit()));
}

module.exports = Object.freeze({ auditSourceText, runAudit });

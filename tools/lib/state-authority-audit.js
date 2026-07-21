"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PRODUCTION_EXTENSION = /\.(?:js|html)$/;
const NON_PRODUCTION_FILE = /(?:\.test|\.browser-smoke)\.(?:js|html)$|test-harness/;
const LEGACY_SLICE_KEYS = Object.freeze([
  "playerState", "turnState", "cardState", "solarState", "rocketState",
  "planetStatsState", "nebulaDataState", "techGameState", "alienGameState",
  "finalScoringState",
]);
const COMMITTED_ROOT_KEYS = Object.freeze([
  "match", "turn", "players", "solarSystem", "pieces", "planets",
  "data", "cards", "tech", "aliens", "finalScoring",
]);

const CAPABILITY_PATTERNS = Object.freeze({
  authority: /\b(?:createStateStore|createHighCouplingStateStore|createBrowserStateAuthority)\s*\(/,
  write: /\b(?:compareAndCommit|runTransaction|dispatchStoredAction|dispatchAction|resolveDecision)\s*\(/,
  read: /\b(?:getSnapshot|beginWorkingCopy|readCommittedState|projectCommitted|projectSource)\s*\(/,
  projection: /\b(?:createBrowserProjectionAdapter|createResidentProjection|projectCommitted|projectSource|projectSession)\s*\(/,
  recovery: /\b(?:deserialize|restore|loadCheckpoint|createCheckpoint|createRecoverySnapshot|restoreRecoverySnapshot)\s*\(/,
  policy: /\b(?:createDecisionContext|createPolicyDecision|runPolicy|createMachinePlayerHost|validatePolicyDecision)\s*\(/,
});

const CAPABILITY_FLOW = Object.freeze({
  authority: Object.freeze({ source: "bootstrap/current schema", target: "StateStore", mutationGate: "StateStore constructor/restore" }),
  write: Object.freeze({ source: "Standard Action or Decision", target: "Effect Session working state", mutationGate: "Effect Session -> StateStore.compareAndCommit" }),
  read: Object.freeze({ source: "StateStore/StateSource", target: "read-only consumer", mutationGate: "none (snapshot isolation)" }),
  projection: Object.freeze({ source: "StateSource or Effect Session inspect", target: "BrowserProjection", mutationGate: "none (projection only)" }),
  recovery: Object.freeze({ source: "current versioned envelope", target: "resident StateStore/session/host", mutationGate: "validated restore transaction" }),
  policy: Object.freeze({ source: "DecisionContext + legal descriptors", target: "PolicyDecision.actionId", mutationGate: "Host freshness validator -> Standard input port" }),
});

const STATE_STORE_CREATORS = new Set([
  "randomizer/game/state/state-store.js",
  "randomizer/game/state/low-coupling-slices.js",
  "randomizer/game/state/high-coupling-slices.js",
  "randomizer/app/browser-state-authority.js",
  "randomizer/app/headless-env.js",
]);
const COMMITTED_MUTATION_GATES = new Set([
  "randomizer/game/state/state-store.js",
  "randomizer/app/browser-state-authority.js",
]);
const LEGACY_SCHEMA_REJECTION_FILES = new Set([
  "randomizer/game/players.js",
  "randomizer/game/tech/player-tech.js",
  "randomizer/game/state/high-coupling-slices.js",
]);

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function listProductionFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listProductionFiles(filePath);
    if (!PRODUCTION_EXTENSION.test(entry.name) || NON_PRODUCTION_FILE.test(entry.name)) return [];
    return [filePath];
  });
}

function maskCommentsAndStrings(source) {
  let output = "";
  let index = 0;
  let mode = "code";
  let quote = null;
  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];
    if (mode === "line") {
      if (current === "\n") { mode = "code"; output += "\n"; } else output += " ";
      index += 1;
      continue;
    }
    if (mode === "block") {
      if (current === "*" && next === "/") { output += "  "; index += 2; mode = "code"; }
      else { output += current === "\n" ? "\n" : " "; index += 1; }
      continue;
    }
    if (mode === "string") {
      if (current === "\\") { output += "  "; index += 2; continue; }
      if (current === quote) { output += " "; index += 1; mode = "code"; quote = null; continue; }
      output += current === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }
    if (current === "/" && next === "/") { output += "  "; index += 2; mode = "line"; continue; }
    if (current === "/" && next === "*") { output += "  "; index += 2; mode = "block"; continue; }
    if (current === "\"" || current === "'" || current === "`") {
      output += " "; index += 1; mode = "string"; quote = current; continue;
    }
    output += current;
    index += 1;
  }
  return output;
}

function countShapeKeys(source, keys) {
  return keys.filter((key) => new RegExp(`\\b${key}\\s*:`).test(source)).length;
}

function inspectSemanticSource(relativePath, source) {
  const code = maskCommentsAndStrings(source);
  const violations = [];
  const add = (codeValue, message) => violations.push({ file: relativePath, code: codeValue, message });

  if (/\b(?:createStateStore|createHighCouplingStateStore)\s*\(/.test(code)
    && !STATE_STORE_CREATORS.has(relativePath)) {
    add("SEMANTIC_SECOND_MUTABLE_ROOT", "StateStore factory 只允许出现在正式 authority lifecycle");
  }
  if (/\b(?:getSnapshot\s*\(\)|committed(?:State|Root|Snapshot))\s*(?:\.|\[)[^;\n]*(?:=|\+\+|--|\+=|-=|\.push\s*\(|\.splice\s*\()/.test(code)
    && !COMMITTED_MUTATION_GATES.has(relativePath)) {
    add("SEMANTIC_DIRECT_COMMITTED_WRITE", "读取 committed snapshot 后不得直接修改其字段");
  }

  const legacyShapeCount = countShapeKeys(code, LEGACY_SLICE_KEYS);
  if (legacyShapeCount >= 4 && relativePath.includes("/browser-host/")) {
    add("SEMANTIC_RENAMED_PROJECTION_BRIDGE", `投影输入重组了 ${legacyShapeCount} 个传统 slice`);
  }

  const persistenceWindows = [...code.matchAll(/\b(?:JSON\.stringify|save|persist|writeCheckpoint)\s*\(/g)]
    .map((match) => code.slice(Math.max(0, match.index - 200), match.index + 1200));
  const committedShapeCount = Math.max(0, ...persistenceWindows.map((window) => countShapeKeys(window, COMMITTED_ROOT_KEYS)));
  if (committedShapeCount >= 8
    && !["randomizer/app/browser-state-authority.js", "randomizer/game/state/state-store.js"].includes(relativePath)) {
    add("SEMANTIC_SAVE_ROOT_STITCH", `保存路径手工拼装了 ${committedShapeCount} 个 committed root 字段`);
  }

  const legacyTargets = LEGACY_SLICE_KEYS.filter((key) => new RegExp(`\\b${key}\\b[^;\\n]{0,120}(?:Object\\.assign|=)[^;\\n]{0,120}\\b(?:turn|players|solarSystem|pieces|planets|data|cards|tech|aliens|finalScoring)\\b`).test(code));
  if (legacyTargets.length >= 3 && /\b(?:restore|recover|load|hydrate)\b/i.test(code)
    && relativePath !== "randomizer/app/browser-state-authority.js") {
    add("SEMANTIC_RECOVERY_ROOT_SPLIT", `恢复路径拆分 committed root 到 ${legacyTargets.length} 个传统 slice`);
  }

  if (/\bfunction\s+[A-Za-z0-9_$]*(?:choose|select|decide|resolve|fallback)[A-Za-z0-9_$]*\s*\([^)]*\)\s*\{[^}]{0,500}\breturn\s+(?:candidates|choices|legalActions)\s*\[\s*0\s*\]/i.test(code)
    && /(?:^|\/)ai\//.test(relativePath)) {
    add("SEMANTIC_POLICY_FIRST_OPTION_FALLBACK", "Policy/AI 不得以首项作为未知或失败 fallback");
  }
  if (/\bdefault\s*:\s*(?:return\s+)?(?:candidates|choices|legalActions)\s*\[\s*0\s*\]/.test(code)) {
    add("SEMANTIC_UNKNOWN_FALLBACK", "未知 family 必须 fail-closed，不得取首项");
  }

  if (!LEGACY_SCHEMA_REJECTION_FILES.has(relativePath)
    && /\btechState\s*(?:\.\s*(?:ownedTileByType|blueBoardSlot)\b|\[\s*(?:ownedTileByType|blueBoardSlot)\s*\])/.test(code)) {
    add("SEMANTIC_LEGACY_SCHEMA_READ", "生产路径读取了已删除的旧 Policy/schema 字段");
  }

  if (/\bcompareAndCommit\s*\(/.test(code)
    && /\b(?:shadow|mirror|cache|copy|secondary)[A-Za-z0-9_$]*(?:\.|\[)[^;\n]*(?:=|\.push\s*\(|\.splice\s*\()/.test(code)) {
    add("SEMANTIC_DUAL_WRITE", "同一路径同时提交 StateStore 并写第二份可变状态");
  }
  return violations;
}

function extractDependencies(relativePath, source) {
  const dependencies = new Set();
  if (relativePath.endsWith(".html")) {
    for (const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      dependencies.add(match[1].split("?")[0]);
    }
  } else {
    for (const match of source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)) dependencies.add(match[1]);
    for (const match of source.matchAll(/\b(?:window|root|globalThis)\.(Seti[A-Za-z0-9_$]+)/g)) dependencies.add(match[1]);
  }
  return [...dependencies].sort();
}

function buildEntryInventory(repositoryRoot, overlays = {}) {
  const randomizerRoot = path.join(repositoryRoot, "randomizer");
  return listProductionFiles(randomizerRoot).map((absolutePath) => {
    const relativePath = normalize(path.relative(repositoryRoot, absolutePath));
    const source = Object.hasOwn(overlays, relativePath)
      ? overlays[relativePath]
      : fs.readFileSync(absolutePath, "utf8");
    const capabilities = Object.entries(CAPABILITY_PATTERNS)
      .filter(([, pattern]) => pattern.test(source))
      .map(([name]) => ({ capability: name, ...CAPABILITY_FLOW[name] }));
    return Object.freeze({
      file: relativePath,
      entryKind: relativePath.endsWith(".html") ? "html" : "javascript",
      dependencies: Object.freeze(extractDependencies(relativePath, source)),
      capabilities: Object.freeze(capabilities),
    });
  });
}

function auditSources(repositoryRoot, overlays = {}) {
  const inventory = buildEntryInventory(repositoryRoot, overlays);
  const violations = inventory.flatMap((entry) => {
    const absolutePath = path.join(repositoryRoot, entry.file);
    const source = Object.hasOwn(overlays, entry.file)
      ? overlays[entry.file]
      : fs.readFileSync(absolutePath, "utf8");
    return inspectSemanticSource(entry.file, source);
  });
  return { inventory, violations };
}

module.exports = Object.freeze({
  LEGACY_SLICE_KEYS,
  COMMITTED_ROOT_KEYS,
  CAPABILITY_FLOW,
  listProductionFiles,
  inspectSemanticSource,
  buildEntryInventory,
  auditSources,
});

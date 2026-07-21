"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PRODUCTION_EXTENSION = /\.(?:js|html)$/;
const NON_PRODUCTION_FILE = /(?:\.test|\.browser-smoke)\.(?:js|html)$|test-harness/;
const COMMITTED_ROOT_KEYS = Object.freeze([
  "match", "turn", "players", "solarSystem", "pieces", "planets",
  "data", "cards", "tech", "aliens", "finalScoring",
]);

function normalize(filePath) {
  return filePath.split(path.sep).join("/");
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
      output += current === "\n" ? "\n" : " ";
      if (current === "\n") mode = "code";
      index += 1;
      continue;
    }
    if (mode === "block") {
      if (current === "*" && next === "/") {
        output += "  ";
        index += 2;
        mode = "code";
      } else {
        output += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }
    if (mode === "string") {
      if (current === "\\") {
        output += "  ";
        index += 2;
      } else if (current === quote) {
        output += " ";
        index += 1;
        mode = "code";
        quote = null;
      } else {
        output += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "/") {
      output += "  ";
      index += 2;
      mode = "line";
    } else if (current === "/" && next === "*") {
      output += "  ";
      index += 2;
      mode = "block";
    } else if (current === "\"" || current === "'" || current === "`") {
      output += " ";
      index += 1;
      mode = "string";
      quote = current;
    } else {
      output += current;
      index += 1;
    }
  }
  return output;
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function lineAt(source, index) {
  return source.slice(0, Math.max(0, index)).split("\n").length;
}

function isStateStoreKernel(code) {
  return /\bfunction\s+createStateStore\s*\(/.test(code)
    && /\bfunction\s+beginWorkingCopy\s*\(/.test(code)
    && /\bfunction\s+compareAndCommit\s*\(/.test(code)
    && /\bfunction\s+getSnapshot\s*\(/.test(code)
    && /\bdeepFreeze\s*\(/.test(code);
}

function isEffectSessionKernel(code) {
  const runtimeKernel = /\bfunction\s+createSession\s*\(/.test(code)
    && /\bworkingState\s*:/.test(code)
    && /\bbaseVersion\s*:/.test(code)
    && /\b(?:phase|status)\s*:/.test(code)
    && /\bcompareAndCommit\s*\(/.test(code);
  const terminalHost = /\bactive\s*\.\s*session\b/.test(code)
    && /\bTERMINAL_PHASES\b/.test(code)
    && /\bfunction\s+settleTerminal\s*\(/.test(code)
    && /\bcompareAndCommit\s*\(/.test(code);
  return runtimeKernel || terminalHost;
}

function isStateTransactionKernel(code) {
  return /\b[A-Za-z_$][\w$]*\s*\.\s*beginWorkingCopy\s*\(/.test(code)
    && /\b[A-Za-z_$][\w$]*\s*\.\s*compareAndCommit\s*\(/.test(code)
    && /\bbaseVersion\b/.test(code);
}

function collectStateFactoryCalls(code) {
  return [...code.matchAll(/\b(?:create|make|new)[A-Za-z_$][\w$]*(?:State|Store|Slice|Model)\s*\(/g)]
    .filter((match) => !/\bfunction\s+$/.test(code.slice(Math.max(0, match.index - 16), match.index)));
}

function countCommittedShapeKeys(code) {
  return COMMITTED_ROOT_KEYS.filter((key) => new RegExp(`\\b${key}\\s*:`).test(code)).length;
}

function collectExposedMutableBindings(code) {
  const bindings = new Set();
  for (const match of code.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*[^;\n]*(?:\.\s*(?:working|mutable\w*|slices?)\b|(?:get|read|open)\w*(?:Working|Mutable|Slices?)\s*\()/gi)) {
    for (const entry of match[1].split(",")) {
      const binding = entry.trim().split(/\s*:\s*/).pop()?.replace(/\s*=.*$/, "").trim();
      if (/^[A-Za-z_$][\w$]*$/.test(binding || "")) bindings.add(binding);
    }
  }
  return [...bindings];
}

function findBindingMutation(code, binding) {
  const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mutation = new RegExp(
    `\\b${escaped}(?:\\s*(?:\\.[A-Za-z_$][\\w$]*|\\[[^\\]\\n]+\\]))+\\s*`
      + `(?:\\+\\+|--|\\+=|-=|\\*=|\\/=|(?<![=!<>])=(?!=|>))`
      + `|\\b${escaped}(?:\\s*(?:\\.[A-Za-z_$][\\w$]*|\\[[^\\]\\n]+\\]))*`
      + `\\s*\\.\\s*(?:push|pop|splice|shift|unshift|sort|reverse|add|delete|clear)\\s*\\(`,
  );
  return mutation.exec(code);
}

function inspectSource(relativePath, source) {
  const code = maskCommentsAndStrings(source);
  const violations = [];
  const add = (violationCode, message, match = null, details = {}) => {
    violations.push({
      file: relativePath,
      line: lineAt(code, match?.index || 0),
      code: violationCode,
      message,
      ...details,
    });
  };
  const storeKernel = isStateStoreKernel(code);
  const sessionKernel = isEffectSessionKernel(code);
  const transactionKernel = isStateTransactionKernel(code);

  const stateFactoryMatches = collectStateFactoryCalls(code);
  const stateFactoryCalls = Math.max(0, ...stateFactoryMatches.map((anchor) => (
    stateFactoryMatches.filter((candidate) => (
      candidate.index >= anchor.index && candidate.index <= anchor.index + 2500
    )).length
  )));
  const exposesResidentGraph = /\bnew\s+Proxy\s*\(/.test(code)
    || /\bget\s+[A-Za-z_$][\w$]*\s*\(\)\s*\{\s*return\b/.test(code)
    || /\breturn\s+(?:Object\.freeze\s*\()?\s*\{[^}]{0,1200}\b(?:working|mutable\w*|slices?|snapshot|current)\b\s*[:,}]/s.test(code);
  if (!storeKernel && !sessionKernel && stateFactoryCalls >= 4 && exposesResidentGraph) {
    const match = stateFactoryMatches[0];
    add(
      "BROWSER_LONG_LIVED_MUTABLE_OWNER",
      `生产模块聚合并暴露了 ${stateFactoryCalls} 个可变规则 state factory 结果`,
      match,
      { stateFactoryCalls },
    );
  }

  const committedShapeKeys = countCommittedShapeKeys(code);
  const feedsAuthorityBoundary = /\b(?:compareAndCommit|restore|createStateStore|purify[A-Za-z_$]*|installStore)\s*\(/.test(code);
  if (!storeKernel && committedShapeKeys >= 8 && feedsAuthorityBoundary) {
    const match = new RegExp(`\\b(?:${COMMITTED_ROOT_KEYS.join("|")})\\s*:`).exec(code);
    add(
      "BROWSER_SLICE_TO_ROOT_BRIDGE",
      `生产模块把分散切片重新拼成 committed root（命中 ${committedShapeKeys} 个 root 字段）`,
      match,
      { committedShapeKeys },
    );
  }

  const hydrateTargets = new Set();
  const rootAlternation = COMMITTED_ROOT_KEYS.join("|");
  const hydratePatterns = [
    new RegExp(`\\b(?:Object\\.assign|replace[A-Za-z_$][\\w$]*)\\s*\\(\\s*([^,\\n]+),\\s*[A-Za-z_$][\\w$]*\\s*\\.\\s*(${rootAlternation})\\b`, "g"),
    new RegExp(`\\b([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)+)\\s*=\\s*[A-Za-z_$][\\w$]*\\s*\\.\\s*(${rootAlternation})\\b`, "g"),
  ];
  let firstHydrateMatch = null;
  for (const pattern of hydratePatterns) {
    for (const match of code.matchAll(pattern)) {
      firstHydrateMatch ||= match;
      const target = match[1].replace(/\s+/g, "");
      if (!/^working\.state(?:\.|$)/.test(target)) hydrateTargets.add(target);
    }
  }
  if (!storeKernel && !sessionKernel && hydrateTargets.size >= 3) {
    add(
      "BROWSER_ROOT_TO_SLICE_HYDRATE",
      `生产模块把 committed root 回填到 ${hydrateTargets.size} 个常驻目标`,
      firstHydrateMatch,
      { hydrateTargets: [...hydrateTargets].sort() },
    );
  }

  if (!storeKernel && !sessionKernel && !transactionKernel && /\bcompareAndCommit\s*\(/.test(code)) {
    const match = /\bcompareAndCommit\s*\(/.exec(code);
    add("BROWSER_COMMIT_OUTSIDE_EFFECT_SESSION", "生产模块在 StateStore/Effect Session kernel 外直接调用 CAS", match);
  }

  const compareAndCommitCalls = countMatches(code, /\b(?:[A-Za-z_$][\w$]*\s*\.\s*)?compareAndCommit\s*\(/g)
    - countMatches(code, /\bfunction\s+compareAndCommit\s*\(/g);
  if (!storeKernel && compareAndCommitCalls >= 2) {
    const match = /\b(?:[A-Za-z_$][\w$]*\s*\.\s*)?compareAndCommit\s*\(/.exec(code);
    add(
      "BROWSER_DOUBLE_COMMIT_PATH",
      `同一生产模块存在 ${compareAndCommitCalls} 个 CAS 调用点`,
      match,
      { compareAndCommitCalls },
    );
  }

  for (const binding of collectExposedMutableBindings(code)) {
    const mutation = findBindingMutation(code, binding);
    if (mutation) {
      add(
        "BROWSER_DIRECT_WRITE_OUTSIDE_SESSION",
        `从长期 working/slice 接口取得的 ${binding} 在 Effect Session 外被直接修改`,
        mutation,
        { binding },
      );
    }
  }

  return violations;
}

function collectCapabilityEntries(relativePath, source) {
  const patterns = {
    authority: /\b(?:createStateStore|createBrowserStateAuthority|createHighCouplingStateStore)\s*\(/g,
    write: /\b(?:runTransaction|dispatchStoredAction|resolveDecision)\s*\(/g,
    read: /\b(?:getSnapshot|beginWorkingCopy|readCommittedState|observe)\s*\(/g,
    commit: /\bcompareAndCommit\s*\(/g,
    restore: /\b(?:deserialize|restore|hydrate[A-Za-z_$]*)\s*\(/g,
  };
  return Object.entries(patterns).flatMap(([capability, pattern]) => (
    [...maskCommentsAndStrings(source).matchAll(pattern)].map((match) => ({
      capability,
      file: relativePath,
      line: lineAt(source, match.index),
      symbol: match[0].replace(/\s*\($/, ""),
    }))
  ));
}

function collectProductExtentAuthority(relativePath, source) {
  if (isStateStoreKernel(source)) return [];
  const evidence = [];
  const residentStore = /\b([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*\.\s*create(?:HighCoupling)?StateStore\s*\(/g;
  for (const match of source.matchAll(residentStore)) {
    evidence.push({
      file: relativePath,
      line: lineAt(source, match.index),
      binding: match[1],
      kind: "resident-store",
    });
  }
  const topLevelMutable = new Set([...source.matchAll(/^\s*let\s+([A-Za-z_$][\w$]*)\b/gm)].map((match) => match[1]));
  for (const binding of topLevelMutable) {
    const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mirror = new RegExp(`\\b${escaped}\\s*=\\s*(?:structuredClone|clone)\\s*\\([^;\\n]*\\bgetSnapshot\\s*\\(`).exec(source);
    if (mirror) {
      evidence.push({
        file: relativePath,
        line: lineAt(source, mirror.index),
        binding,
        kind: "snapshot-mirror",
      });
    }
  }
  return evidence;
}

function inspectSourceSet(entries) {
  const violations = entries.flatMap(({ relativePath, source }) => inspectSource(relativePath, source));
  const extentOwners = entries.flatMap(({ relativePath, source }) => (
    collectProductExtentAuthority(relativePath, source)
  ));
  for (const owner of extentOwners) {
    violations.push({
      file: owner.file,
      line: owner.line,
      code: "PRODUCT_EXTENT_RULE_AUTHORITY",
      message: `产品外延通过 ${owner.kind} 持有或同步规则状态`,
      binding: owner.binding,
      ownerKind: owner.kind,
    });
  }
  const ownerFiles = [...new Set(extentOwners.map((entry) => entry.file))].sort();
  if (ownerFiles.length >= 2) {
    violations.push({
      file: "<production-authority-graph>",
      line: 1,
      code: "PRODUCT_EXTENT_DUPLICATE_RULE_AUTHORITY",
      message: `${ownerFiles.length} 个产品外延分别持有或同步规则状态`,
      ownerFiles,
    });
  }
  return { violations, extentOwners };
}

function auditRepository(repositoryRoot, overlays = {}) {
  const files = listProductionFiles(path.join(repositoryRoot, "randomizer"));
  const sources = files.map((absolutePath) => {
    const relativePath = normalize(path.relative(repositoryRoot, absolutePath));
    return {
      relativePath,
      source: Object.hasOwn(overlays, relativePath)
        ? overlays[relativePath]
        : fs.readFileSync(absolutePath, "utf8"),
    };
  });
  const sourceSetAudit = inspectSourceSet(sources);
  return {
    ok: sourceSetAudit.violations.length === 0,
    scannedFiles: sources.length,
    violations: sourceSetAudit.violations,
    productExtentOwners: sourceSetAudit.extentOwners,
    capabilityChain: sources.flatMap(({ relativePath, source }) => collectCapabilityEntries(relativePath, source)),
  };
}

module.exports = Object.freeze({
  COMMITTED_ROOT_KEYS,
  listProductionFiles,
  maskCommentsAndStrings,
  isStateStoreKernel,
  isEffectSessionKernel,
  isStateTransactionKernel,
  inspectSource,
  collectProductExtentAuthority,
  inspectSourceSet,
  collectCapabilityEntries,
  auditRepository,
});

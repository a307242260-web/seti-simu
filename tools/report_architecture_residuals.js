"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PRODUCTION_ROOTS = ["randomizer/app", "randomizer/game", "randomizer/training"];
const CURRENT_DOCS = [
  "AGENTS.md",
  "README.md",
  "docs/project-architecture.md",
  "docs/committed-game-state.md",
  "docs/effect-session-runtime.md",
  "docs/standard-action-contract.md",
  "docs/browser-host-ui.md",
  "docs/rl-simulation-env.md",
];

const RESIDUALS = Object.freeze({
  legacyWorkingRoot: /\b(?:stateAdapter|projectWorkingState|createWorkingState|restoreWorkingState)\b/g,
  legacyRootSlices: /\b(?:playerState|turnState|solarState|rocketState|planetStatsState|nebulaDataState|cardState|techGameState|alienGameState|finalScoringState)\b/g,
  parallelDecisionState: /\b(?:pendingDecision|initialIncomeQueue)\b/g,
  legacyExecutionFacilities: /\b(?:SetiActionHistory|SetiHistoryCommands|SetiAbilityChain|createActionHistory|historyStep|actionEffectFlow)\b/g,
  moduleLocalIdentityOwners: /\b(?:cardInstanceSequence|handCardSequence|dataTokenSequence|nebulaTokenSequence|nebulaReplacementSequence|getNextCardInstanceSequence|restoreNextCardInstanceSequence|getNextHandCardSequence|restoreNextHandCardSequence|getNextFinalMarkSequence|restoreNextFinalMarkSequence|getNextDataTokenSequence|restoreNextDataTokenSequence|getDeterministicSequences|restoreDeterministicSequences|nextRocketId)\b/g,
  localIdentityFallbacks: /\b(?:createLocalCardInstance|takeLocalDataTokenSequence|createRecoveredPoolToken|takeFinalMarkSequence)\b/g,
  ruleOwnedPresentationState: /\b(?:statusNote|techSelectionActive|pendingTileId|selectedTileId|selectedBlueSlot|selectionActive|discardSelectionActive|playCardSelectionActive)\b/g,
});

function walk(relativeRoot) {
  const absoluteRoot = path.join(ROOT, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  return fs.readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeRoot, entry.name);
    return entry.isDirectory() ? walk(relative) : [relative];
  });
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function productionFiles() {
  return ["randomizer/app.js", ...PRODUCTION_ROOTS
    .flatMap(walk)
    .filter((file) => file.endsWith(".js") && !file.endsWith(".test.js"))];
}

function countPattern(files, pattern) {
  const matches = [];
  for (const file of files) {
    const source = read(file);
    const count = [...source.matchAll(pattern)].length;
    if (count) matches.push({ file, count });
  }
  return {
    occurrences: matches.reduce((sum, item) => sum + item.count, 0),
    files: matches.length,
    matches,
  };
}

function collectDomResiduals(files) {
  const domFile = "randomizer/app/dom.js";
  const domSource = read(domFile);
  const keys = [...domSource.matchAll(/^\s{6}([A-Za-z][A-Za-z0-9]*):/gm)]
    .map((match) => match[1]);
  const consumerSource = files
    .filter((file) => file !== domFile)
    .map(read)
    .join("\n");
  const unreferenced = keys.filter((key) => (
    !new RegExp(`(?:\\.|\\b)${key}\\b`).test(consumerSource)
  ));
  return {
    registered: keys.length,
    staticallyUnreferenced: unreferenced.length,
    keys: unreferenced,
  };
}

function collectMissingCurrentDocPaths() {
  const missing = [];
  for (const file of CURRENT_DOCS.filter((candidate) => fs.existsSync(path.join(ROOT, candidate)))) {
    const source = read(file);
    for (const match of source.matchAll(/`((?:randomizer|tools|docs|assets)\/[A-Za-z0-9_./?-]+)`/g)) {
      const target = match[1];
      if (!target.includes("?") && !fs.existsSync(path.join(ROOT, target))) {
        missing.push({
          file,
          line: source.slice(0, match.index).split("\n").length,
          target,
        });
      }
    }
  }
  return missing;
}

const files = productionFiles();
const report = {
  schemaVersion: "seti-architecture-residual-report-v1",
  productionFileCount: files.length,
  residuals: Object.fromEntries(
    Object.entries(RESIDUALS).map(([name, pattern]) => [name, countPattern(files, pattern)]),
  ),
  dom: collectDomResiduals(files),
  missingCurrentDocPaths: collectMissingCurrentDocPaths(),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

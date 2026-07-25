"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PRODUCTION_ROOTS = ["randomizer/app", "randomizer/game", "randomizer/training"];
const RESIDUALS = Object.freeze({
  legacyWorkingRoot: /\b(?:stateAdapter|projectWorkingState|createWorkingState|restoreWorkingState)\b/g,
  legacyRootSlices: /\b(?:playerState|turnState|solarState|rocketState|planetStatsState|nebulaDataState|cardState|techGameState|alienGameState|finalScoringState)\b/g,
  parallelDecisionState: /\b(?:pendingDecision|initialIncomeQueue)\b/g,
  legacyExecutionFacilities: /\b(?:SetiActionHistory|SetiHistoryCommands|SetiAbilityChain|createActionHistory|historyStep|actionEffectFlow)\b/g,
  moduleLocalIdentityOwners: /\b(?:cardInstanceSequence|handCardSequence|dataTokenSequence|nebulaTokenSequence|nebulaReplacementSequence|getNextCardInstanceSequence|restoreNextCardInstanceSequence|getNextHandCardSequence|restoreNextHandCardSequence|getNextFinalMarkSequence|restoreNextFinalMarkSequence|getNextDataTokenSequence|restoreNextDataTokenSequence|getDeterministicSequences|restoreDeterministicSequences|nextRocketId)\b/g,
  localIdentityFallbacks: /\b(?:createLocalCardInstance|takeLocalDataTokenSequence|createRecoveredPoolToken|takeFinalMarkSequence)\b/g,
  redundantInitializationCompatibility: /\bdiscarded-rng\b|正式初始化卡牌会重建牌区/g,
  ruleOwnedPresentationState: /\b(?:statusNote|techSelectionActive|pendingTileId|selectedTileId|selectedBlueSlot|selectionActive|discardSelectionActive|playCardSelectionActive)\b/g,
  orphanActionLogState: /\b(?:actionLog|actionHistorySummary)\b/g,
  unusedViewStateSurface: /\b(?:panelOpen|playerMenuOpen|sectorCalibration|acknowledgedEventIds|minimizedIds|collapsedRegions)\b/g,
  alienLocalIdentitySequences: /\bnext(?:Trace|Card|Orbit|Landing)Sequence\b/g,
  wallClockCanonicalFields: /\b(?:placedAt|createdAt|completedAt|claimedAt|consumedAt|resolvedAt|usedAt|settledAt)\s*:\s*(?:options\.[A-Za-z]+(?:\s*\?\?|\s*\|\|)\s*)?(?:Date\.now\(\)|new Date\(\)\.toISOString\(\))/g,
});
const FROZEN_MATRIX_STATIC = Object.freeze({
  F1: Object.freeze({
    debugBypass: { pattern: /\b(?:options\.)?debugOnly\s*(?::|=)/g },
    setupConfigInRules: { roots: ["randomizer/game"], pattern: /\binitialSetupConfig\b/g },
    policyConfigInRules: { roots: ["randomizer/game"], pattern: /\baiDifficulty\b/g },
    duplicatePlanetPieces: {
      roots: ["randomizer/game"],
      pattern: /\b(?:planetsReference|referencePlacement|syncPlanetRockets)\b/g,
    },
    dataTokenPresentationState: {
      files: ["randomizer/game/data/state.js", "randomizer/game/data/nebula-state.js"],
      pattern: /\b(?:percentX|percentY)\b/g,
    },
  }),
  F2: Object.freeze({
    rulePlayerAliases: {
      roots: ["randomizer/game"],
      pattern: /\bplayer\.(?:playerId|playerColor)\b/g,
    },
    mapShapedPlayerFallback: {
      roots: ["randomizer/game"],
      pattern: /state\?*\.players\?*\.players\s*\?\?\s*state\?*\.players/g,
    },
    transientCurrentPlayerOwner: {
      roots: ["randomizer/game"],
      pattern: /\bplayersState\?*\.currentPlayerId\b/g,
    },
  }),
  F3: Object.freeze({
    moduleLocalIdentityOwners: RESIDUALS.moduleLocalIdentityOwners,
    localIdentityFallbacks: RESIDUALS.localIdentityFallbacks,
    alienLocalIdentitySequences: RESIDUALS.alienLocalIdentitySequences,
  }),
  F4: Object.freeze({
    obsoleteApis: {
      pattern: /\b(?:restoreAlienLabPanelForTrace|createAlienLabPanelSnapshot|restoreAlienLabPanelSnapshot|createFutureSpanSnapshot|restoreFutureSpanSnapshot|createIndustryMarkUndoCommand|removeOrbitMarker|removeLandingMarker|removeSatelliteLanding|formatPlanetStatsLines|formatAlienSlotLine|formatScoreMark|getPlayerSymbolSummary|getCatalogEntryByInput|listSectorWinDebugSlots|seedDebugTraceGrid|seedDebugSymbols|migrateFirstTracesToJiuzhe)\b/g,
    },
    obsoleteSolarReadout: {
      roots: ["randomizer/solar-system"],
      pattern: /\b(?:createSetupState|formatSolarSnapshot|collectNebulaRelations|collectStaticWheelCoordinateContents|collectWheelCoordinateContents|countContentKinds|getContentKindLabel|countVisibleMeaningfulContentKinds|countWheelContents|summarizeCell|collectWheelCoordinateReport|collectVisibleCoordinateReport|collectVisibleCoordinateGroups)\b/g,
    },
  }),
  F5: Object.freeze({
    obsoleteSolarReadout: {
      roots: ["randomizer/solar-system"],
      pattern: /\b(?:createSetupState|formatSolarSnapshot|collectNebulaRelations|collectStaticWheelCoordinateContents|collectWheelCoordinateContents|countContentKinds|getContentKindLabel|countVisibleMeaningfulContentKinds|countWheelContents|summarizeCell|collectWheelCoordinateReport|collectVisibleCoordinateReport|collectVisibleCoordinateGroups)\b/g,
    },
  }),
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
    .filter((file) => file.endsWith(".js")
      && !file.endsWith(".test.js")
      && !file.endsWith(".browser-smoke.js")
      && !file.includes(`${path.sep}fixtures${path.sep}`))];
}

function filesForCheck(check, allFiles) {
  if (check.files) return check.files;
  if (!check.roots) return allFiles;
  return allFiles.filter((file) => check.roots.some((root) => (
    file === root || file.startsWith(`${root}${path.sep}`)
  )));
}

function collectFrozenMatrixStatic(allFiles) {
  return Object.fromEntries(Object.entries(FROZEN_MATRIX_STATIC).map(([id, checks]) => {
    const results = Object.fromEntries(Object.entries(checks).map(([name, rawCheck]) => {
      const check = rawCheck instanceof RegExp ? { pattern: rawCheck } : rawCheck;
      return [name, countPattern(filesForCheck(check, allFiles), check.pattern)];
    }));
    return [id, {
      occurrences: Object.values(results).reduce((sum, item) => sum + item.occurrences, 0),
      checks: results,
    }];
  }));
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
  const currentDocs = [
    "AGENTS.md",
    "README.md",
    ...walk("docs").filter((file) => (
      file.endsWith(".md")
      && !file.startsWith(`docs${path.sep}migrations${path.sep}`)
      && !file.startsWith(`docs${path.sep}mocha_experience${path.sep}`)
    )),
    ...walk("assets").filter((file) => file.endsWith(`${path.sep}implementation.md`)),
  ];
  for (const file of [...new Set(currentDocs)]
    .filter((candidate) => fs.existsSync(path.join(ROOT, candidate)))) {
    const source = read(file);
    for (const match of source.matchAll(/`((?:randomizer|tools|docs|assets)\/[A-Za-z0-9_./?-]+)`/g)) {
      const target = match[1];
      const lineStart = source.lastIndexOf("\n", match.index) + 1;
      const lineEnd = source.indexOf("\n", match.index);
      const line = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
      const historicalDeletion = /(?:旧|已删除|不再创建|物理删除)/.test(line);
      if (!historicalDeletion
        && !target.includes("?")
        && !fs.existsSync(path.join(ROOT, target))) {
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

function collectCssResiduals(files) {
  const cssFile = "randomizer/style.css";
  const source = read(cssFile);
  const consumers = [
    ...files,
    "randomizer/index.html",
  ].filter((file) => file !== cssFile && fs.existsSync(path.join(ROOT, file)))
    .map(read)
    .join("\n");
  const dynamicProjectionClasses = new Set([
    "is-reference-orbit",
    "is-reference-land",
    "is-reference-satellite",
  ]);
  const classes = [...new Set([...source.matchAll(/\.([A-Za-z_][\w-]*)/g)]
    .map((match) => match[1]))];
  const unreferenced = classes.filter((name) => (
    !dynamicProjectionClasses.has(name) && !consumers.includes(name)
  )).sort();
  return {
    registered: classes.length,
    staticallyUnreferenced: unreferenced.length,
    dynamicProjectionClasses: [...dynamicProjectionClasses],
    classes: unreferenced,
  };
}

const files = productionFiles();
const report = {
  schemaVersion: "seti-architecture-residual-report-v1",
  productionFileCount: files.length,
  residuals: Object.fromEntries(
    Object.entries(RESIDUALS).map(([name, pattern]) => [name, countPattern(files, pattern)]),
  ),
  frozenMatrixStatic: collectFrozenMatrixStatic(files),
  dom: collectDomResiduals(files),
  css: collectCssResiduals(files),
  missingCurrentDocPaths: collectMissingCurrentDocPaths(),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

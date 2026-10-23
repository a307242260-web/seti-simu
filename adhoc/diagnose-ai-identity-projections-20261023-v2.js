"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), Module = require("node:module"), assert = require("node:assert/strict"), zlib = require("node:zlib");
const output = "reports/ai-foundation-20261023/identity-projections-case062-v2.json";
assert(!fs.existsSync(output), "Reuse existing diagnostic checkpoint");
const fixturePath = "adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json", f = JSON.parse(fs.readFileSync(fixturePath));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const modes = ["exact", "slot-display", "active-rocket", "slot-and-active", "visit-order", "score-sources", "wallet", "wallet-slot-active"];
const groups = Object.fromEntries(modes.map(mode => [mode, new Map()]));
const exact = new Set(); const states = [], calls = {};
global.__setiInspectIdentity = (key, status) => {
  if (!["stable", "decision", "information-barrier", "other-owner", "terminal"].includes(status) || exact.has(key)) return;
  exact.add(key); const input = JSON.parse(key), { state } = input;
  const own = state.players.players.find(p => p.id === f.seatId);
  states.push({ status, credits: own.resources.credits, energy: own.resources.energy, main: own.mainActionCompleted,
    computer: own.dataState.placedTokens.length, hand: own.hand.length, family: input.pending?.family || null,
    queue: input.pending?.queue?.[0]?.type || null, queueLength: input.pending?.queue?.length || 0, interrupt: Boolean(input.pending?.interruptContext) });
  const slots = { ...state.pieces, rockets: state.pieces.rockets.map(rocket => {
    if (rocket.surface !== "solar-board" || !Number.isInteger(rocket.sectorX) || !Number.isInteger(rocket.sectorY)) return rocket;
    const copy = { ...rocket }; delete copy.slotIndex; delete copy.radius; delete copy.angleDegrees; return copy;
  }) };
  const visits = Object.fromEntries(Object.entries(state.turn.visitedPlanetsByPlayerId || {}).map(([id, list]) => [id, Array.isArray(list) ? list.slice().sort() : list]));
  for (const mode of modes) {
    let candidate = state;
    if (mode.includes("slot")) candidate = { ...candidate, pieces: slots };
    if (mode.includes("active")) candidate = { ...candidate, pieces: { ...candidate.pieces, activeRocketId: null } };
    if (mode === "visit-order") candidate = { ...candidate, turn: { ...candidate.turn, visitedPlanetsByPlayerId: visits } };
    if (mode === "score-sources" || mode.includes("wallet")) candidate = { ...candidate, players: { ...candidate.players,
      players: candidate.players.players.map(player => player.id !== f.seatId ? player : { ...player,
        ...(mode === "score-sources" ? { scoreSources: {} } : { resources: { ...player.resources, credits: 0, energy: 0 } }) }) } };
    const digest = sha(JSON.stringify({ ...input, state: candidate }));
    const item = groups[mode].get(digest) || { count: 0, statuses: new Set(), wallets: [] }; item.count += 1; item.statuses.add(status);
    item.wallets.push({ credits: own.resources.credits, energy: own.resources.energy, status, queue: input.pending?.queue?.[0]?.type || null, queueLength: input.pending?.queue?.length || 0, interrupt: Boolean(input.pending?.interruptContext) }); groups[mode].set(digest, item);
  }
};
const file = path.resolve("randomizer/game/ai/analysis-port.js"), original = fs.readFileSync(file, "utf8");
const marker = '    return JSON.stringify(normalize({ state, pending, status, boundary }));';
assert(original.includes(marker)); const source = original.replace(marker, '    const key = JSON.stringify(normalize({ state, pending, status, boundary })); global.__setiInspectIdentity(key, status); return key;');
const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); require.cache[file] = mod; mod._compile(source, file);
const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition"), { createSeededRandom } = require("../randomizer/game/random"), { buildRuleObservation } = require("../randomizer/app/rule-observation"),
  { searchDecision } = require("../randomizer/game/ai/decision-search"), { createStateValueEvaluator } = require("../randomizer/game/ai/state-value");
const seed = f.source.seed, kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (s,v) => buildRuleObservation(s,seed,v?.playerId) }); kernel.newGame({ seed }); const comp = kernel.composition;
assert(comp.lifecycle.restore(f.compositionEnvelope).ok); const before = comp.lifecycle.save().envelope, port = mod.exports.createAnalysisPort({ composition: comp, seatId: f.seatId, maxCacheEntries: 0 });
try {
  const root = port.openRoot(), evaluate = createStateValueEvaluator(f.seatId), result = searchDecision({ port, root, evaluate, modelKey: evaluate.modelKey, planReuse: true,
    resourceDominance: true, moneyCapacityDominance: true, cardTradePruning: true, postMainPruning: true, openingPruning: true, cardChoiceEquivalence: true,
    budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 30000 } });
  assert.deepEqual(comp.lifecycle.save().envelope, before);
  const reference = JSON.parse(zlib.gunzipSync(fs.readFileSync("adhoc/ai-decision-corpus-20261023-v1/turn-copy-search-combined-062-0-v2.raw.json.gz")));
  function behavioral(r) { const copy = structuredClone(r); delete copy.diagnostics.milliseconds; delete copy.diagnostics.limits.milliseconds; return copy; }
  assert.deepEqual(behavioral(result), behavioral(reference));
  for (const row of states) { const key = `${row.status}/${row.family}/${row.queue}`; calls[key] = (calls[key] || 0) + 1; }
  const projection = Object.fromEntries(modes.map(mode => [mode, { groups: groups[mode].size, duplicateIdentities: exact.size-groups[mode].size,
    maxGroup: Math.max(...[...groups[mode].values()].map(v=>v.count)) }]));
  const potential = {};
  for (const group of groups.wallet.values()) for (const row of group.wallets) {
    const key = `${row.status}/${row.queue}/length${row.queueLength}/interrupt${row.interrupt}`;
    const item = potential[key] ||= { states: 0, theoreticallyDominated: 0 };
    item.states += 1;
    if (group.wallets.some(other => other.credits >= row.credits && other.energy >= row.energy && (other.credits > row.credits || other.energy > row.energy))) item.theoreticallyDominated += 1;
  }
  const report = { scope: "Diagnostic-only coarse projections of 2908 existing exact states. None used for search identity/pruning; hash grouping does not establish semantic equivalence. Instrumented timing is not a benchmark.",
    fixturePath, fixtureSha256: sha(fs.readFileSync(fixturePath)), exactStates: exact.size, projection, calls, states, potential,
    searchGraphMatchesReference: true, complete: result.complete, diagnostics: result.diagnostics, rootUnchanged: true,
    originalAnalysisSha256: sha(original), instrumentedAnalysisSha256: sha(source), driverSha256: sha(fs.readFileSync(__filename)),
    sourceHashes: Object.fromEntries(Object.keys(require.cache).filter(p=>p.includes('/randomizer/')).map(p=>[p.slice(process.cwd().length+1),sha(fs.readFileSync(p))])) };
  fs.writeFileSync(output, JSON.stringify(report,null,2)+"\n"); console.log(JSON.stringify({ projection, potential, searchGraphMatchesReference: true }));
} finally { port.close(); comp.dispose(); delete global.__setiInspectIdentity; }

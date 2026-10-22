"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const industry = require("../randomizer/game/industry/catalog");
const devsetPath = "reports/ai-foundation-20261022/devset-v1.json";
const output = "reports/ai-foundation-20261023/decision-corpus-v1.json";
const directory = "adhoc/ai-decision-corpus-20261023-v1";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const devsetBytes = fs.readFileSync(devsetPath), devset = JSON.parse(devsetBytes);
fs.mkdirSync(directory, { recursive: true });
let report = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output)) : {
  schemaVersion: "seti-ai-decision-corpus-v1", status: "collecting", sourceDevset: devsetPath,
  sourceDevsetSha256: sha(devsetBytes), scope: "replay original confirmed actions, first checkpoint per public decision class; no new policy or score experiment",
  sourceCommit: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  runs: [], cases: [], classes: {}, totalReplayedInputs: 0,
};
assert.equal(report.sourceDevsetSha256, sha(devsetBytes));
if (report.status === "complete") { console.log(`Completed corpus; reuse ${output}`); process.exit(0); }
function saveReport() { fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); }
function classify(envelope, legal) {
  const state = envelope.session?.session?.workingState || JSON.parse(envelope.committedState);
  const seatId = legal[0].actorId, player = state.players.players.find(p => p.id === seatId);
  const session = envelope.session?.session;
  const hand = player.hand.length;
  const phase = state.match.initialSetup ? "setup" : session ? "conditional" : player.mainActionCompleted ? "after-main" : "before-main";
  const company = industry.getPlayerIndustryDefinition(player)?.id || player.initialSelection?.industry?.id || null;
  const families = [...new Set(legal.map(a => a.family))].sort();
  const targetKinds = [...new Set(legal.map(a => a.target?.kind || ""))].sort();
  return { seatId, phase, round: state.turn.roundNumber, company, families, targetKinds,
    effectType: session?.queue?.[0]?.type || null,
    handBand: hand === 0 ? "0" : hand === 1 ? "1" : hand <= 4 ? "2-4" : hand === 5 ? "5" : "6+",
    ownProbe: state.pieces.rockets.some(r => [r.playerId, r.color, r.playerColor].some(id => id === seatId || id === player.color)),
    ownTech: Object.values(player.techState.ownedTiles).some(Boolean),
    ownReserved: player.reservedCards.length > 0,
    revealedAlien: Object.values(state.aliens.aliens).some(slot => slot.revealed),
  };
}
const start = performance.now();
for (const [runIndex, run] of devset.runs.entries()) {
  let row = report.runs.find(row => row.name === run.name);
  if (row?.status === "passed") { console.log(`[reuse] ${run.name}`); continue; }
  if (row?.status === "failed") throw new Error(`Recorded replay failure ${run.name}; inspect it, do not choose a different action`);
  const saveBytes = fs.readFileSync(run.savePath), recorded = JSON.parse(saveBytes), steps = recorded.replaySteps;
  assert.equal(steps.length, run.steps);
  const resumePath = `${directory}/resume-run-${String(runIndex).padStart(2,"0")}-20261023-v1.json`;
  const env = createSimulationEnv();
  if (!row) {
    row = { name: run.name, seed: run.seed, savePath: run.savePath, saveSha256: sha(saveBytes), status: "collecting", nextInput: 0, resumePath };
    report.runs.push(row); saveReport();
  }
  assert.equal(row.saveSha256, sha(saveBytes));
  try {
    if (row.nextInput > 0) { assert(fs.existsSync(resumePath)); env.loadCheckpoint(JSON.parse(fs.readFileSync(resumePath))); }
    else env.reset({ seed: run.seed, agentType: "completion", compactReplay: true });
    for (let index = row.nextInput; index < steps.length; index += 1) {
      const checkpoint = env.createCheckpoint(), envelope = checkpoint.coreState.compositionEnvelope;
      const legal = env.legalActions(), expected = steps[index].action;
      assert(legal.length && legal.every(a => a.actorId === legal[0].actorId));
      assert(legal.some(a => a.actionId === expected.actionId), `${run.name} input ${index}: original action absent ${expected.actionId}`);
      const classification = classify(envelope, legal), { seatId, ...classFacts } = classification;
      const classKey = JSON.stringify(classFacts);
      if (!report.classes[classKey]) {
        const id = `case-${String(report.cases.length).padStart(3,"0")}`, fixturePath = `${directory}/${id}-20261023-v1.json`;
        const fixture = { schemaVersion: "seti-ai-decision-fixture-v1", source: { run: run.name, seed: run.seed,
          savePath: run.savePath, saveSha256: row.saveSha256, confirmedInputIndex: index, originalActionId: expected.actionId },
          seatId, classification, compositionEnvelope: envelope, legalActionsSha256: sha(JSON.stringify(legal)),
        };
        const bytes = JSON.stringify(fixture); fs.writeFileSync(fixturePath, bytes + "\n");
        const item = { id, path: fixturePath, sha256: sha(bytes + "\n"), sourceRun: run.name, confirmedInputIndex: index,
          originalFamily: expected.family, classification, observedInputs: 0 };
        report.cases.push(item); report.classes[classKey] = { caseId: id, count: 0 };
      }
      report.classes[classKey].count += 1;
      report.cases.find(item => item.id === report.classes[classKey].caseId).observedInputs += 1;
      const result = env.step(expected);
      if (!result.ok) throw new Error(`${run.name} input ${index}: ${JSON.stringify(result.error || result)}`);
      row.nextInput = index + 1; report.totalReplayedInputs += 1;
      // Full resumable checkpoint only at a durable boundary, not one file per click.
      if (row.nextInput % 32 === 0 || row.nextInput === steps.length) {
        fs.writeFileSync(resumePath, JSON.stringify(env.createCheckpoint()) + "\n"); saveReport();
      }
    }
    assert(env.isTerminal(), `${run.name}: original confirmed sequence no longer terminal`);
    row.status = "passed"; row.terminal = true; saveReport();
    console.log(`[corpus] ${run.name} replayed=${row.nextInput} classes=${report.cases.length}`);
  } catch (error) {
    row.status = "failed"; row.failure = error.stack; saveReport(); throw error;
  } finally { env.dispose(); }
}
report.status = "complete"; report.milliseconds = performance.now() - start;
report.sourceHashes = Object.fromEntries(Object.keys(require.cache).filter(p => p.includes("/randomizer/")).sort().map(p =>
  [p.slice(process.cwd().length + 1), sha(fs.readFileSync(p))]));
report.summary = {};
for (const key of ["phase", "round", "company", "ownProbe", "ownTech", "ownReserved", "revealedAlien"]) {
  report.summary[key] = {};
  for (const item of report.cases) { const value = String(item.classification[key]); report.summary[key][value] = (report.summary[key][value] || 0) + item.observedInputs; }
}
saveReport(); console.log(JSON.stringify({ output, status: report.status, inputs: report.totalReplayedInputs, classes: report.cases.length, summary: report.summary }, null, 2));

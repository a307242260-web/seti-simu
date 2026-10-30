'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createSimulationRuleComposition } = require('../randomizer/training/simulation-rule-composition');
const { createSeededRandom } = require('../randomizer/game/random');
const { buildRuleObservation } = require('../randomizer/app/rule-observation');
const value = require('../randomizer/game/ai/state-value');
const scenario = require('../tools/research-human405-round1');
const output = 'reports/ai-foundation-20261023/human405-b117-prefix-r1-comparison-20261031-v1.json';
assert(!fs.existsSync(output), 'Reuse the saved verification; do not overwrite it');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const opening = scenario.opening(), teacherSave = read('seti-saves/seti-save-537-merged.json');
const seed = 'seti-free-analyze-v1';
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (s, v) => buildRuleObservation(s, seed, v?.playerId) });
kernel.newGame({ seed });
const c = kernel.composition;
function submit(id) {
  const d = c.inspect().session?.decision;
  const a = (d?.choices || c.inputPort.enumerateActions({})).find(a => a.actionId === id);
  assert(a, id);
  const r = d ? c.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: a })
    : a.phase === 'quick' ? c.inputPort.submitQuickAction(a) : c.inputPort.submitAction(a);
  assert(r.ok, JSON.stringify(r));
  return a;
}
function endpoint() {
  const envelope = c.lifecycle.save().envelope, state = JSON.parse(envelope.committedState);
  assert.equal(state.turn.roundNumber, 2); assert(!state.turn.gameEnded);
  const p = state.players.players.find(p => p.id === 'player-white');
  return { round: 2, formalTerminal: false, resources: p.resources, income: p.income,
    technologies: Object.keys(p.techState.ownedTiles).sort(), hand: p.hand.map(card => card.cardId),
    reserved: p.reservedCards.map(card => card.cardId), computer: p.dataState,
    probes: state.pieces.rockets.filter(p => p.playerId === 'player-white'),
    value: value.evaluateStateValue(c.projection({ role: 'player', playerId: 'player-white' }).state, 'player-white') };
}
function verify(recordPath, forced) {
  const r = read(recordPath), save = read(r.savePath), start = forced ? 27 : 23;
  assert.equal(r.scenario.openingInputs, start); assert.equal(r.scenario.openingCheckpointSha256, opening.sha256);
  assert.equal(r.scenario.id, forced ? scenario.B117_PREFIX_ID : scenario.ID);
  assert.equal(r.scenarioResult.firstRoundSettled, true); assert.equal(r.terminal, false);
  if (forced) {
    assert.equal(r.scenario.originalOpeningInputs, 23);
    assert.equal(r.scenario.controlledPrefix.forcedInputs, 4);
    assert.equal(sha(r.scenario.controlledPrefix.sourcePath), r.scenario.controlledPrefix.sourceSha256);
    assert.deepEqual(save.replaySteps.slice(23, 27).map(e => e.action), teacherSave.replaySteps.slice(23, 27).map(e => e.action));
  }
  assert.deepEqual(save.replaySteps.slice(0, 23).map(e => [e.stepIndex, e.actorPlayerId, e.action]),
    opening.checkpoint.replaySteps.map(e => [e.stepIndex, e.actorPlayerId, e.action]));
  assert(c.lifecycle.restore(opening.checkpoint.coreState.compositionEnvelope).ok);
  const nonwhite = [];
  for (const e of save.replaySteps.slice(23)) {
    const a = submit(e.action.actionId); assert.equal(a.actorId, e.actorPlayerId);
    if (e.actorPlayerId !== 'player-white') {
      assert(a.family === 'pass' || a.family === 'choose_card' && ['pass-hand-limit', 'pass-reserve-card'].includes(a.target.kind));
      nonwhite.push({ seat: a.actorId, family: a.family, target: a.target });
    }
  }
  const final = c.lifecycle.save().envelope;
  assert.equal(final.committedState, save.committedState); assert.deepEqual(final.session, save.session);
  const traces = fs.readFileSync(r.agentTracePath, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(traces.length, save.replaySteps.length - start);
  traces.forEach((t, i) => {
    assert.equal(t.context.seatId, save.replaySteps[start + i].actorPlayerId);
    assert.equal(t.actionId, save.replaySteps[start + i].action.actionId);
  });
  const searches = r.metrics.searches;
  assert(searches.every(s => s.complete && s.diagnostics.nativeExecutions <= 256 && s.rootAndSearchMilliseconds <= 600));
  assert.equal(searches.length, traces.filter(t => t.context.seatId === 'player-white').length);
  return { recordPath, recordSha256: sha(recordPath), sourceCommit: r.gitCommit, savePath: r.savePath,
    saveSha256: sha(r.savePath), tracePath: r.agentTracePath, traceSha256: sha(r.agentTracePath),
    originalOpeningInputs: 23, forcedTeacherInputs: forced ? 4 : 0, aiTraceBeginsAtInput: start + 1,
    strictNativeReplay: true, exactFinalCommittedStateSessionRng: true, passiveOpponentsOnly: true, nonwhite,
    final: endpoint(), steps: r.steps, wallMs: r.wallMs, whiteDecisions: searches.length,
    maxNativeInputs: Math.max(...searches.map(s => s.diagnostics.nativeExecutions)),
    maxMilliseconds: Math.max(...searches.map(s => s.rootAndSearchMilliseconds)),
    planReuseHits: searches.filter(s => s.diagnostics.planContinuation === 'hit').length,
    whiteActions: save.replaySteps.slice(23).filter(e => e.actorPlayerId === 'player-white')
      .map(e => ({ input: e.stepIndex + 1, forced: e.stepIndex < start, summary: e.action.summary, family: e.action.family })) };
}
try {
  const control = verify('reports/research/83388120.a11ea9dc.quick-200.json', false);
  const intervention = verify('reports/research/d58f15db.225966dd.quick-200.json', true);
  assert.deepEqual(intervention.nonwhite, control.nonwhite, 'Passive opponent actions must match, allowing only shifted input indices');
  const fixture = read('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-062-20261030-v1.json');
  assert(c.lifecycle.restore(fixture.compositionEnvelope).ok); submit(fixture.source.teacherActionId);
  const teacher = endpoint();
  const sourceHashes = {}, runtimeCommit = 'a11ea9dc3dd5f88fc5cee6edd857caed6b05ccf7';
  const runtimePaths = execFileSync('git', ['ls-tree', '-r', '--name-only', runtimeCommit, '--', 'randomizer'],
    { cwd: '/Users/bilibili/code/seti-simu', encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).trim().split('\n');
  for (const p of runtimePaths) {
    const original = execFileSync('git', ['show', `${runtimeCommit}:${p}`], { cwd: '/Users/bilibili/code/seti-simu' });
    assert.deepEqual(fs.readFileSync(p), original); sourceHashes[p] = sha(p);
  }
  const report = { schemaVersion: 'seti-human405-controlled-prefix-round-comparison-v1',
    runtimeCommit, runtimeFiles: runtimePaths.length, allRuntimeFilesUnchanged: true, sourceHashes,
    openingSha256: opening.sha256, control, intervention, teacher,
    interventionMinusControl: { score: intervention.final.resources.score - control.final.resources.score,
      stateValue: intervention.final.value.total - control.final.value.total },
    scope: 'One native teacher24..27 opening intervention followed by unchanged v94 through common R1 settlement. Existing autonomous control reused, not rerun. Stage scores, not terminal outcomes or baseline promotion. Final differences include downstream decisions, draws and rewards; they do not isolate a fixed additive value for the initial probe.',
    findings: ['The B117-first intervention improves this common-R1 endpoint; the earlier lower turn-end V ranking does not predict this recorded outcome.',
      'Both paths use blue1+purple4, whereas the teacher uses blue2+purple4. Probe opening improvement and teacher technology alignment remain separate.',
      'All AI searches pass256native/600ms. Four forced teacher inputs have no AI trace and are never credited as autonomous choices.'],
    baselineEligible: false, acceptedFourAIBaseline: 'ai-search-v41-baseline-20261029', goalStatus: 'active' };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, control: control.final.resources.score, intervention: intervention.final.resources.score,
    teacher: teacher.resources.score, controlV: control.final.value.total, interventionV: intervention.final.value.total,
    teacherV: teacher.value.total, strictNativeReplay: true, runtimeUnchanged: true, allDecisionGatesPass: true }));
} finally { c.dispose(); }

'use strict';
// Native replay only; this does not execute an AI or create another experiment.
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createSimulationRuleComposition } = require('../randomizer/training/simulation-rule-composition');
const { createSeededRandom } = require('../randomizer/game/random');
const { buildRuleObservation } = require('../randomizer/app/rule-observation');
const scenario = require('../tools/research-human405-round1');
const recordPath = 'reports/research/203cd183.cad56459.quick-200.json';
const record = JSON.parse(fs.readFileSync(recordPath)), save = JSON.parse(fs.readFileSync(record.savePath));
const target = save.replaySteps.findIndex((e, i) => i >= 23 && e.action.family === 'pass'
  && save.replaySteps[i + 1]?.action.target?.kind === 'pass-hand-limit');
assert(target >= 23);
const output = 'adhoc/ai-decision-corpus-20261031-v98-pass-boundary-v1/green-before-pass-discard-20261031-v1.json';
assert(!fs.existsSync(output), 'Reuse native checkpoint');
const seed = 'seti-free-analyze-v1', k = createSimulationRuleComposition({ seed, random: createSeededRandom(seed),
  activePlayerCount: 4, trustedProjectionReader: true,
  projectCounterfactualState: (s, viewer) => buildRuleObservation(s, seed, viewer?.playerId) });
k.newGame({ seed }); const c = k.composition;
try {
  const opening = scenario.opening();
  assert(c.lifecycle.restore(opening.checkpoint.coreState.compositionEnvelope).ok);
  for (const step of save.replaySteps.slice(23, target)) {
    const d = c.inspect().session?.decision;
    const a = (d?.choices || c.inputPort.enumerateActions({})).find(a => a.actionId === step.action.actionId);
    assert(a); assert.equal(a.actorId, step.actorPlayerId);
    const r = d ? c.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion,
      ownerId: d.ownerId, choice: a }) : a.phase === 'quick' ? c.inputPort.submitQuickAction(a) : c.inputPort.submitAction(a);
    assert(r.ok);
  }
  const seatId = save.replaySteps[target].actorPlayerId;
  assert.equal(seatId, 'player-green');
  const fixture = { compositionEnvelope: c.lifecycle.save().envelope, seatId,
    source: { seed, recordPath, recordSha256: crypto.createHash('sha256').update(fs.readFileSync(recordPath)).digest('hex'),
      replayPrefixInputs: target, originalActionId: save.replaySteps[target].action.actionId },
    scope: 'Exact recorded native prefix; first PASS then mandatory hand-limit discard. No patched game state or AI rerun.' };
  fs.writeFileSync(output, JSON.stringify(fixture, null, 2) + '\n');
  console.log(JSON.stringify({ output, seatId, prefix: target }));
} finally { c.dispose(); }

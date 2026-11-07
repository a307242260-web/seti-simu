'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const plans = require('../randomizer/game/ai/local-decision-plans');
const {createSimulationRuleComposition} = require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom} = require('../randomizer/game/random');
const {buildRuleObservation} = require('../randomizer/app/rule-observation');
const {createAnalysisPort} = require('../randomizer/game/ai/analysis-port');
const {searchDecision} = require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator} = require('../randomizer/game/ai/state-value');
const agent = require('../randomizer/game/ai/search-agent');

const [fixture, output] = process.argv.slice(2);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const f = JSON.parse(fs.readFileSync(fixture));
const seat = f.seatId, seed = f.source.seed;
const k = createSimulationRuleComposition({
  seed, random: createSeededRandom(seed), activePlayerCount: 4, trustedProjectionReader: true,
  projectCounterfactualState: (s, v) => buildRuleObservation(s, seed, v?.playerId),
});
k.newGame({seed});
const c = k.composition;
assert(c.lifecycle.restore(f.compositionEnvelope).ok);
const before = c.lifecycle.save().envelope;
const snapshot = () => c.lifecycle.save().envelope;
const restore = () => {assert(c.lifecycle.restore(before).ok);assert.deepEqual(snapshot(), before);};
const p = createAnalysisPort({composition: c, seatId: seat, maxCacheEntries: 0});
const taskId = 'dlc9-three-sector-wins';
function pick(family, accepts = () => true) {
  const d = c.inspect().session?.decision;
  const legal = (d?.choices || c.inputPort.enumerateActions({})).filter(a => a.actorId === seat && a.family === family && accepts(a));
  assert.equal(legal.length, 1);
  const a = legal[0];
  const result = d ? c.inputPort.submitDecision({decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: seat, choice: a})
    : a.phase === 'quick' ? c.inputPort.submitQuickAction(a) : c.inputPort.submitAction(a);
  assert(result.ok, JSON.stringify(result));
  return a.actionId;
}
const state = () => {
  const e = snapshot();
  return e.session?.session?.workingState || JSON.parse(e.committedState);
};
const own = s => s.players.players.find(x => x.id === seat);
const research = () => [pick('research_tech'), pick('choose_target', a => a.target.tileId === 'purple1')];
try {
  const t = performance.now(), root = p.openRoot(), value = createStateValueEvaluator(seat);
  const searched = searchDecision({port: p, root, evaluate: value, ...agent.OPTIONS, modelKey: value.modelKey, budget: agent.BUDGET});
  const milliseconds = performance.now() - t;
  const choice = root.legalActions.find(a => a.actionId === searched.actionId);
  assert(searched.complete && !searched.unresolved.length && searched.diagnostics.nativeExecutions <= 256 && milliseconds <= 600);
  assert(choice.target.choiceId.startsWith('skip:'));
  assert.deepEqual(snapshot(), before);
  const session = f.compositionEnvelope.session.session;
  const input = {state: session.workingState, seatId: seat, actions: root.legalActions, session};
  const spec = plans.pureOptional(input);
  assert.equal(spec.overflow, 2);
  const negative = {
    fits: s => {own(s).resources.publicity = 7;},
    cannotAffordResearch: s => {own(s).resources.publicity = 5;},
    opponentStillActive: s => {s.turn.passedPlayerIds.pop();},
    alreadyPassing: s => {own(s).passCompletionPending = true;},
  };
  for (const change of Object.values(negative)) {
    const s = structuredClone(input.state);
    change(s);
    assert.equal(plans.pureOptional({...input, state: s}), null);
  }
  const confirm = [pick('accept_optional_effect', a => a.target.choiceId.startsWith('confirm:')), ...research()];
  const immediate = {path: confirm, publicity: own(state()).resources.publicity, envelope: snapshot()};
  restore();
  const skip = [pick('accept_optional_effect', a => a.actionId === choice.actionId), ...research(),
    pick('complete_task', a => a.target.ruleId === taskId)];
  const deferred = {path: skip, publicity: own(state()).resources.publicity, envelope: snapshot()};
  assert.equal(deferred.publicity - immediate.publicity, 2);
  restore();
  const result = {
    fixture, fixtureSha256: sha(fixture), sourceSha256: sha('randomizer/game/ai/local-decision-plans.js'),
    actionId: choice.actionId, value: searched.value, nativeInputs: searched.diagnostics.nativeExecutions, milliseconds,
    complete: true, rootAndRngExact: true, negative: Object.keys(negative), immediate, deferred, spec,
  };
  if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({...result, immediate: immediate.publicity, deferred: deferred.publicity}));
} finally {p.close(); c.dispose();}

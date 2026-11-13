'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { createSimulationRuleComposition } = require('../randomizer/training/simulation-rule-composition');
const { buildRuleObservation } = require('../randomizer/app/rule-observation');
const { createSeededRandom } = require('../randomizer/game/random');
const { createAnalysisPort } = require('../randomizer/game/ai/analysis-port');
const { createSearchAgent } = require('../randomizer/game/ai/search-agent');
const teaching = require('../tools/research-human405-round1');
const fixed = require('../tools/research-free-analyze-random20');
const { getRocketSectorCoordinate } = require('../randomizer/game/rockets');
const dataSlots = require('../randomizer/game/data');

const white = 'player-white';
const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const [out, mode = 'screen', source, ...selected] = process.argv.slice(2);
const read = p => JSON.parse(fs.readFileSync(p));
const packed = p => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)));
const ok = q => q.action && q.complete && q.n <= 256 && q.ms <= 600;
const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

function open(root) {
  const seed = JSON.parse(root.committedState).meta.seed;
  const kernel = createSimulationRuleComposition({seed, random:createSeededRandom(seed), activePlayerCount:4,
    trustedProjectionReader:true, projectCounterfactualState:(state, v) => buildRuleObservation(state, seed, v?.playerId || null, [],
      {cheap:v?.cheap === true, valueOnly:v?.valueOnly === true})});
  kernel.newGame({seed});
  const c = kernel.composition, save = () => c.lifecycle.save().envelope;
  assert(c.lifecycle.restore(root).ok); assert.deepEqual(save(), root);
  const state = () => { const e = save(); return e.session?.session?.workingState || JSON.parse(e.committedState); };
  const menu = () => c.inspect().session?.decision?.choices || c.inputPort.enumerateActions({});
  function put(a) {
    const d = c.inspect().session?.decision;
    const result = d ? c.inputPort.submitDecision({decisionId:d.decisionId, decisionVersion:d.decisionVersion, ownerId:d.ownerId, choice:a})
      : a.phase === 'quick' ? c.inputPort.submitQuickAction(a) : c.inputPort.submitAction(a);
    assert(result.ok, JSON.stringify(result.failure || result));
    return a;
  }
  function pick(checkpoint) {
    const before = save(), choices = menu(), port = createAnalysisPort({composition:c, seatId:white, maxCacheEntries:0});
    try {
      const agent = createSearchAgent({seatId:white, analysisPort:port});
      if (checkpoint) agent.loadCheckpoint(checkpoint);
      let r;
      try { r = agent.decide({seatId:white, legalActions:choices}).search; }
      catch (e) { if (!e.search) throw e; r = e.search; }
      return {action:choices.find(a => a.actionId === r.actionId), checkpoint:agent.createCheckpoint(),
        n:r.diagnostics.nativeExecutions, ms:r.rootAndSearchMilliseconds, v:r.value, complete:r.complete && !r.unresolved.length,
        quotes:r.roots.filter(x => Number.isFinite(x.value)).map(x => [x.actionId, x.value])};
    } finally { port.close(); assert.deepEqual(save(), before); }
  }
  const opposition = () => {
    const legalActions = menu(), id = legalActions[0].actorId;
    const observation = c.projection({role:'player', playerId:id}).state;
    const {actionId} = teaching.passiveAgent(id).decide({legalActions, observation});
    return legalActions.find(a => a.actionId === actionId);
  };
  return {c, save, state, menu, put, pick, opposition};
}

function facts(state, slots = false) {
  const p = state.players.players.find(x => x.id === white);
  return {round:state.turn.roundNumber, turn:state.turn.turnNumber, wallet:p.resources, income:p.income,
    hand:p.hand.map(x => x.cardId), tech:Object.keys(p.techState.ownedTiles),
    probes:state.pieces.rockets.filter(x => x.playerId === white).map(x => [getRocketSectorCoordinate(x), x.fossilId]),
    market:state.cards.publicCards.map(x => x?.cardId),
    ...(slots ? {computer:dataSlots.listComputerPlacedTokens(p).map(x => x.placementSlot),
      blue:dataSlots.listBlueBonusPlacedTokens(p).map(x => x.blueSlot)} : {})};
}

function screen() {
  const rows = read('reports/iteration/free-analyze-random20-funded-planet-20261111/summary-463fc442-20261111.json').rows;
  const records = [...rows.map(r => ({label:String(r.board), record:r.f, score:r.score})),
    {label:'standard', record:'0b3710e9.898b2c72.full.json', score:272}];
  const result = [];
  for (const row of records) {
    const record = read('reports/research/'+row.record), saved = read(record.savePath);
    const catalog = row.label === 'standard' ? teaching : fixed;
    const config = {seed:record.seed, activePlayerCount:4, compactReplay:true};
    const metadata = catalog.describe({...config, agentType:'search',
      flags:{scenario:catalog === teaching ? teaching.FIRST_THREE_ROUNDS_ID : fixed.IDS[1]}}, {full:catalog === fixed});
    const env = catalog.createEnvironment({}, metadata), hits = [], seen = new Set();
    let stable = 0, eligible = 0;
    try {
      const opening = catalog.initialize(env, config, metadata);
      same(opening.map(x => x.action), saved.replaySteps.slice(0, opening.length).map(x => x.action));
      for (let i = opening.length; i < saved.replaySteps.length; i++) {
        const old = saved.replaySteps[i].action, legal = env.legalActions();
        const a = legal.find(x => x.actionId === old.actionId);
        assert(a, row.label+'/'+i); same(a, old);
        const launch = legal.find(x => x.family === 'launch' && x.phase === 'main');
        const observation = env.observe(white);
        if (a.actorId === white && observation.publicState.roundNumber >= 3 && legal.some(x => x.phase === 'main')) {
          const root = env.createCheckpoint().coreState.compositionEnvelope, state = JSON.parse(root.committedState);
          if (!root.session && !seen.has(state.turn.turnNumber)) {
            seen.add(state.turn.turnNumber); stable++;
            // A single direct launch, no existing white probe, no preparations.
            if (launch && !state.pieces.rockets.some(x => x.playerId === white)) {
              eligible++;
              const m = open(root);
              try {
                const q = m.pick(), quote = q.quotes.find(([id]) => id === launch.actionId)?.[1];
                hits.push({key:row.label+'/'+i, historic:a.summary, quote, choice:q.action?.summary,
                  choiceFamily:q.action?.family, n:q.n, ms:q.ms, v:q.v, passes:!!ok(q), facts:facts(state), root, launch});
              } finally { m.c.dispose(); }
            }
          }
        }
        assert(env.step(a).ok, row.label+'/'+i);
      }
      const end = env.createCheckpoint().coreState.compositionEnvelope;
      assert.equal(end.committedState, saved.committedState); same(end.session, saved.session);
    } finally { env.dispose(); }
    result.push({...row, stable, eligible, hits});
    console.log(JSON.stringify({label:row.label, stable, eligible,
      hits:hits.map(({key, quote, choice, v, passes, facts:f}) => [key, f.round, quote ?? null, choice, v, passes])}));
  }
  return {head, records:result};
}

function finish(hit, forced) {
  const m = open(hit.root), inputs = [], decisions = [], checkpoints = [], main = [];
  const start = performance.now();
  let checkpoint, stop;
  const put = a => { if (a.actorId === white && a.phase === 'main') main.push([m.state().turn.roundNumber, a.summary]); inputs.push(m.put(a)); };
  try {
    if (forced) put(m.menu().find(a => a.actionId === hit.launch.actionId));
    for (let i = 0; i < 360; i++) {
      if (m.state().turn.gameEnded && !m.c.inspect().session) { stop = 'terminal'; break; }
      if (performance.now() - start >= 180000) { stop = 'elapsed-gate'; break; }
      if (m.menu()[0]?.actorId !== white) { put(m.opposition()); continue; }
      const q = m.pick(checkpoint);
      decisions.push({action:q.action?.summary, n:q.n, ms:q.ms, v:q.v, passes:!!ok(q)});
      if (!ok(q)) { stop = 'decision-gate'; break; }
      if (q.action.family === 'pass') checkpoints.push([inputs.length, m.save()]);
      put(q.action); checkpoint = q.checkpoint;
    }
    assert(stop);
    return {name:forced ? 'fixed direct launch' : 'autonomous', inputs, checkpoints, decisions, main, stop, end:m.save(),
      score:stop === 'terminal' ? m.state().match.finalScores.find(x => x.playerId === white).totalScore : null,
      peak:[Math.max(...decisions.map(d => d.n)), Math.max(...decisions.map(d => d.ms))]};
  } finally { m.c.dispose(); }
}

function v189() {
  const startRecord = read('reports/research/e01243ba.93989585.quick-400.json');
  const fullRecord = read('reports/research/db594a2e.1609bf50.full.json');
  const start = read(startRecord.savePath), historical = read(fullRecord.savePath);
  same(historical.replaySteps.slice(0, 125), start.replaySteps);
  const origin = {schemaVersion:'seti-rule-composition-save-v1', committedState:JSON.stringify(JSON.parse(start.committedState)), session:start.session};
  const initial = open(origin);
  let root, offset = start.replaySteps.length;
  const prefix = [];
  try {
    while (initial.menu()[0]?.actorId !== white) {
      const old = historical.replaySteps[offset++].action, a = initial.menu().find(x => x.actionId === old.actionId);
      same(a, old);
      same(initial.opposition(), a);
      prefix.push(initial.put(a));
    }
    assert.equal(offset, 131);
    root = initial.save();
  } finally { initial.c.dispose(); }
  const recordedEnd = read(fullRecord.roundEnds.find(r => r.round === 3).checkpointPath);
  const historicalEnd = recordedEnd.coreState?.compositionEnvelope || recordedEnd.envelope;
  assert(historicalEnd);
  function one(old) {
    const m = open(root), inputs = [], checkpoints = [], decisions = [], main = [];
    let checkpoint, stop;
    try {
      for (let i = 0; i < 250; i++) {
        assert.equal(m.state().turn.roundNumber, 3);
        const menu = m.menu();
        let a;
        if (old) {
          const expected = historical.replaySteps[offset+i].action;
          a = menu.find(x => x.actionId === expected.actionId);
          same(a, expected);
        } else if (menu[0]?.actorId === white) {
          const q = m.pick(checkpoint);
          decisions.push({action:q.action?.summary, n:q.n, ms:q.ms, v:q.v, passes:!!ok(q)});
          if (!ok(q)) { stop = 'decision-gate'; break; }
          a = q.action; checkpoint = q.checkpoint;
        } else a = m.opposition();
        if (a.actorId === white && a.family === 'pass') { stop = 'before-pass'; break; }
        if (a.actorId === white && a.phase === 'main') main.push(a.summary);
        inputs.push(m.put(a));
      }
      assert(stop);
      const end = m.save();
      if (old) assert.deepEqual(end, historicalEnd);
      return {name:old ? 'historical V189' : 'current autonomous', inputs, checkpoints, decisions, main, stop, end,
        assets:facts(m.state(), true), peak:decisions.length ? [Math.max(...decisions.map(d => d.n)), Math.max(...decisions.map(d => d.ms))] : null};
    } finally { m.c.dispose(); }
  }
  const rows = [one(true), one(false)];
  const opening = facts(JSON.parse(root.committedState), true);
  console.log(JSON.stringify({offset, opening, rows:rows.map(({name, stop, main, assets, peak}) => ({name, stop, main, assets, peak}))}));
  return {head, origin, prefix, opening, offset, groups:[{name:'V189 exact round-3 white opening', root, rows}]};
}

let data;
if (mode === 'screen') data = screen();
else if (mode === 'v189') data = v189();
else {
  assert.equal(mode, 'pair');
  const s = packed(source);
  assert.equal(s.head, head);
  assert(selected.length);
  const groups = selected.map(key => {
    const hit = s.records.flatMap(r => r.hits).find(h => h.key === key);
    assert(hit?.passes && hit.choiceFamily !== 'launch', key);
    const rows = [finish(hit, false), finish(hit, true)];
    console.log(JSON.stringify({key, rows:rows.map(r => ({name:r.name, score:r.score, stop:r.stop, main:r.main, peak:r.peak}))}));
    return {name:key, root:hit.root, rows};
  });
  data = {head, groups};
}
fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(data)), {flag:'wx'});

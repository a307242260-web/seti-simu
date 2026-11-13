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

function crossover(late = false) {
  const directory = 'reports/ai-foundation-20261113/funded-launch-cohort/';
  const load = (file, name) => {
    const witness = packed(directory+file);
    execFileSync('git', ['diff','--exit-code', witness.head, head, '--', 'randomizer','tools']);
    return witness.groups.find(g => g.name === name);
  };
  const b11 = load('seti-funded-launch-cohort-pairs-20261113-v1.json.gz', '11/130');
  const b18 = load('seti-funded-launch-cohort-r4-pairs-20261113-v1.json.gz', '18/179');
  const old = load('seti-v189-current-r3-20261113-v1.json.gz', 'V189 exact round-3 white opening');
  const results = [];
  function branch(group, label, row, count, choice, targetRound, overrides = []) {
    const m = open(group.root), inputs = [], decisions = [], checkpoints = [], main = [];
    let checkpoint, stop;
    const start = performance.now();
    const put = a => {
      if (a.actorId === white && a.phase === 'main') main.push(a.summary);
      inputs.push(m.put(a));
    };
    try {
      for (const expected of group.rows[row].inputs.slice(0,count)) {
        const a = m.menu().find(x => x.actionId === expected.actionId);
        same(a, expected);
        put(a);
      }
      const before = m.save(), legal = m.menu(), q = m.pick();
      assert(ok(q), label+' control gate');
      const options = legal.map(a => [a.actionId, a.family, a.summary, q.quotes.find(([id]) => id === a.actionId)?.[1]]);
      const a = choice(legal);
      const rootFacts = facts(m.state(), true);
      if (a) {
        assert(a.actorId === white);
        put(a);
      }
      const pivot = a ? [a.actionId, a.summary] : null;
      for (let i = 0; i < 320; i++) {
        if (m.state().turn.gameEnded && !m.c.inspect().session) { stop = 'terminal'; break; }
        if (performance.now() - start >= 180000) { stop = 'elapsed-gate'; break; }
        if (m.menu()[0]?.actorId !== white) { put(m.opposition()); continue; }
        const q = m.pick(checkpoint);
        decisions.push({action:q.action?.summary, n:q.n, ms:q.ms, v:q.v, passes:!!ok(q)});
        if (!ok(q)) { stop = 'decision-gate'; break; }
        const override = overrides[0]?.(m.menu());
        const selected = override || q.action;
        if (override) overrides.shift();
        if (selected.family === 'pass') {
          checkpoints.push([inputs.length, m.save()]);
          if (targetRound === m.state().turn.roundNumber) { stop = 'before-pass'; break; }
        }
        put(selected); checkpoint = override ? null : q.checkpoint;
      }
      assert(stop); assert.equal(overrides.length, 0);
      const state = m.state();
      return {name:label, inputs, checkpoints, decisions, main, stop, end:m.save(), assets:facts(state, true), before,
        rootFacts, options, pivot, originalChoice:q.action.summary,
        score:stop === 'terminal' ? state.match.finalScores.find(x => x.playerId === white).totalScore : null,
        peak:[Math.max(0,...decisions.map(d => d.n)), Math.max(0,...decisions.map(d => d.ms))]};
    } finally { m.c.dispose(); }
  }
  const family = family => legal => legal.find(a => a.family === family);
  const none = () => null;
  const choose = fn => legal => { const a = fn(legal); assert(a, JSON.stringify(legal.map(x => [x.family,x.summary]))); return a; };
  const board18Move = legal => legal.find(a => a.family === 'choose_target' && a.summary === '移动 2 向外');
  const b52 = legal => legal.find(a => a.family === 'play_card' && a.summary === 'b_52.webp');
  const scanLaunch = legal => legal.find(a => a.target?.mode === 'launch');
  const buyEnergy = legal => legal.find(a => a.family === 'quick_trade' && a.summary === '2信用点 → 1能量');
  const variantsByGroup = late ? [
    [b18, [['buy energy, scan, then use purple launch',0,0,choose(buyEnergy),undefined,[family('scan'),scanLaunch]]]],
    [old, [['historic route through Tianwei III landing',0,19,none,3]]],
  ] : [
    [b11, [['B9 then inspect next main menu',0,12,none],['launch but skip immediate positioning',1,1,choose(family('end_turn'))]]],
    [b18, [['scan then launch instead of income',0,9,family('launch')],
      ['launch plus original scan: take its free move',1,10,choose(board18Move)],
      ['launch plus original scan: no outward move',1,10,choose(legal => legal.find(a => a.summary === '跳过' || a.target?.kind === 'skip'))],
      ['asteroid: take the known B52 use one main action sooner',1,12,choose(b52)]]],
    [old, [['after launch no fixed move',1,1,none,3],['after launch fixed first outward move',0,3,none,3],
      ['historical first move and B101 research',0,10,none,3]]],
  ];
  for (const [group, variants] of variantsByGroup) {
    const rows = variants.map(args => {
      const row = branch(group, ...args);
      console.log(JSON.stringify({group:group.name, name:row.name, score:row.score, stop:row.stop,
        r3:row.assets.round===3 ? row.assets : undefined, main:row.main, peak:row.peak}));
      return row;
    });
    results.push({name:group.name, root:group.root, rows});
  }
  return {head, groups:results};
}

function hiddenPairs() {
  const directory = 'reports/ai-foundation-20261113/funded-launch-cohort/';
  const groups = [];
  const scope = [
    ['seti-funded-launch-cohort-pairs-20261113-v1.json.gz', '11/130'],
    ['seti-funded-launch-cohort-r4-pairs-20261113-v1.json.gz', '18/179'],
  ];
  const view = root => {
    const m = open(root);
    try {
      const q = m.pick();
      assert(ok(q));
      return {observation:m.c.projection({role:'player',playerId:white}).state, menu:m.menu(), selected:q.action.actionId, quotes:q.quotes, inputs:q.n};
    } finally { m.c.dispose(); }
  };
  for (const [file, name] of scope) {
    const source = packed(directory+file);
    execFileSync('git',['diff','--exit-code',source.head,head,'--','randomizer','tools']);
    const g = source.groups.find(x => x.name === name);
    const original = view(g.root);
    const launch = original.menu.find(a => a.family === 'launch');
    for (const [i,j] of [[0,3],[0,6],[1,4]]) {
      const state = JSON.parse(g.root.committedState), deck = state.cards.drawPileCardIds;
      assert(deck[i] && deck[j]); assert.notEqual(deck[i],deck[j]);
      [deck[i],deck[j]] = [deck[j],deck[i]];
      const root = {...g.root,committedState:JSON.stringify(state)};
      assert.deepEqual(view(root),original);
      const rows = [finish({root,launch},false),finish({root,launch},true)];
      const n = name+' hidden ordinary '+i+'/'+j;
      groups.push({name:n,root,rows});
      console.log(JSON.stringify({name:n, results:rows.map(r => [r.score,r.stop,r.peak,r.main])}));
    }
  }
  return {head, groups};
}

let data;
if (mode === 'screen') data = screen();
else if (mode === 'v189') data = v189();
else if (mode === 'cross' || mode === 'cross-late') data = crossover(mode === 'cross-late');
else if (mode === 'hidden') data = hiddenPairs();
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

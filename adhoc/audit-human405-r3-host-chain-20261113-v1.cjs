'use strict';
const fs = require('node:fs');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const scenario = require('../tools/research-human405-round1');
const data = require('../randomizer/game/data');
const cards = require('../randomizer/game/cards/deck');
const white = 'player-white', seed = 'seti-free-analyze-v1';
const config = { agentType: 'search', seed, activePlayerCount: 4, compactReplay: true };
const metadata = scenario.describe({ ...config, flags: { scenario: scenario.THIRD_ROUND_ID } });
const record = 'reports/ai-foundation-20261113/prepass-funded-landing/r3-opening-mars-payment-replay-20261113-v1.json.gz';
const { root, rows: [teacher] } = JSON.parse(zlib.gunzipSync(fs.readFileSync(record))).groups.find(g => g.name === 'teacher-round3-replay');
const output = process.argv[2], mode = process.argv[3] || 'trace';
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
function assets(envelope, observation) {
  const s = JSON.parse(envelope.committedState), p = s.players.players.find(x => x.id === white);
  return { score:p.resources.score, resources:p.resources, income:p.income, tech:p.techState,
    hand:p.hand.map(c => c.cardId), reserved:p.reservedCards.map(c => c.cardId),
    computer:data.listComputerPlacedTokens(p).map(x=>x.placementSlot), blue:data.listBlueBonusPlacedTokens(p).map(x=>x.blueSlot),
    probes:s.pieces.rockets.filter(r=>r.playerId===white).map(r=>[r.sectorX,r.sectorY,r.fossilId??null]),
    boardData:s.data, traces:observation.selfState.traceCounts, sectorWins:observation.selfState.sectorWins, finalScoring:s.finalScoring };
}
function initialized() {
  const env = scenario.createEnvironment({}, metadata);
  scenario.initialize(env, config, metadata);
  assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope, root);
  return env;
}
const write = obj => fs.writeFileSync(output,zlib.gzipSync(JSON.stringify(obj)),{flag:'wx'});
function take(env) {
  const result = env.runAgentDecision(), after = env.createCheckpoint(), a = after.replaySteps.at(-1).action;
  if (a.actorId !== white) assert(['pass','choose_card','choose_payment'].includes(a.family));
  for(const q of result.searches || []) { scenario.assertDecisionGate(q); assert(q.complete && q.unresolved.length===0); }
  return { a, after, searches:result.searches || [] };
}
function run(env,{compare=false, prior=[], forced=null}={}) {
  const checkpoints=[], inputs=[...prior], decisions=[], turns=[], differences=[];
  let stop;
  const start = performance.now();
  while(inputs.length<240){
    if(performance.now()-start>180000){stop='elapsed';break;}
    const before=env.createCheckpoint(), envelope=before.coreState.compositionEnvelope, menu=env.legalActions();
    assert.equal(env.observe().publicState.roundNumber,3);
    if(before.replaySteps.at(-1).action.actorId!==white||before.replaySteps.at(-1).action.family==='end_turn'){
      if(menu[0]?.actorId===white&&!envelope.session)turns.push({offset:inputs.length,assets:assets(envelope,env.observe(white))});
    }
    let v;
    try{v=take(env);}catch(e){if(!e.search && !String(e).includes('DECISION_GATE'))throw e;stop='decision gate';break;}
    const {a,searches}=v, q=searches[0], i=inputs.length;
    if(q){
      const selected=q.roots?.find(x=>x.actionId===a.actionId&&x.value!=null);
      decisions.push({i, a:a.summary, family:a.family,n:q.diagnostics.nativeExecutions,ms:q.rootAndSearchMilliseconds,v:q.value,goal:selected?.goal?.id});
    }
    if(a.actorId===white&&a.family==='pass'){
      stop='prepass';checkpoints.push([i,envelope]);env.loadCheckpoint(before);break;
    }
    inputs.push(a);
    if(compare&&teacher.inputs[i]?.actionId!==a.actionId){
      differences.push({i,chosen:a.summary,teacher:teacher.inputs[i]?.summary});compare=false;
    }
  }
  assert(stop);
  const end=env.createCheckpoint().coreState.compositionEnvelope;
  return {name:forced||'host autonomous',inputs,checkpoints,decisions,turns,differences,stop,end,score:null,assets:assets(end,env.observe(white)),
    peak:[Math.max(0,...decisions.map(d=>d.n)),Math.max(0,...decisions.map(d=>d.ms))]};
}
if(mode==='trace') {
  const env=initialized();
  try{
    for(const a of teacher.inputs){
      const same=env.legalActions().find(b=>b.actionId===a.actionId);assert.deepEqual(JSON.parse(JSON.stringify(same)),a);assert(env.step(same).ok);
    }
    const end=env.createCheckpoint().coreState.compositionEnvelope;assert.deepEqual(end,teacher.end);
    const teacherAssets=assets(end,env.observe(white));
    const second=initialized();
    try{
      const row=run(second,{compare:true});
      console.log(JSON.stringify({stop:row.stop,score:row.assets.score,peak:row.peak,turns:row.turns.map(x=>[x.offset,x.assets.score]),main:row.decisions.filter(d=>d.family==='play_card'||d.family==='land'||d.family==='scan'||d.family==='analyze'||d.family==='research_tech'),diff:row.differences}));
      write({source,teacherAssets,groups:[{name:'teacher exact third-round origin',root,rows:[row]}]});
    }finally{second.dispose();}
  }finally{env.dispose();}
}
if(mode==='fork') {
  const trace=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))).groups[0].rows[0];
  const env=initialized(), groups=[];
  function force(a){assert(a);assert(a.actorId===white);const r=env.step(a);assert(r.ok,r.error);return a;}
  try{
    let before, dataRoot;
    for(const [i,expected] of trace.inputs.entries()){
      if(i===39)before=env.createCheckpoint();
      if(i===45)dataRoot=env.createCheckpoint();
      assert.deepEqual(take(env).a,expected);
    }
    for(const [label,host] of [['analysis reward',dataRoot],['before analysis',before]]){
      env.loadCheckpoint(host);
      const origin=host.coreState.compositionEnvelope,menu=env.legalActions();
      const rows=[run(env,{forced:'complete host checkpoint'})];
      assert.deepEqual(rows[0].end,trace.end);
      const planned=trace.inputs[host.replaySteps.length-112];
      const alternates=label==='analysis reward'?menu.filter(a=>a.actionId!==planned.actionId):[];
      console.log(JSON.stringify({label,menu:menu.map(a=>a.summary),planned:planned.summary,alternates:alternates.map(a=>a.summary),agent:Boolean(host.machineAI[white])}));
      for(const a of alternates){
        env.loadCheckpoint(host);
        const r=run(env,{prior:[force(a)],forced:a.summary});
        rows.push(r);
        console.log(JSON.stringify({label,alt:a.summary,stop:r.stop,assets:{score:r.assets.score,income:r.assets.income,tech:r.assets.tech,hand:r.assets.hand,pool:r.assets.resources.availableData,probe:r.assets.probes},peak:r.peak}));
      }
      groups.push({name:label,root:origin,agentCheckpoint:host.machineAI[white],rows});
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='terminal'||mode==='terminal-keep') {
  const forks=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))).groups.flatMap(g=>g.rows.slice(0,3))
    .filter(row=>mode!=='terminal-keep'||row.name!=='continue autonomously');
  const env=initialized(),groups=[];
  const template=env.createCheckpoint();
  try{
    for(const row of forks){
      const origin=row.end,rows=[];
      for(const reserve of ['b_111.webp','b_32.webp']){
        env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:origin,committedState:origin.committedState},machineAI:{}});
        const inputs=[],checkpoints=[],decisions=[];
        if(mode==='terminal-keep'){
          const pass=env.legalActions().find(a=>a.family==='pass'&&a.actorId===white);
          assert(pass);assert(env.step(pass).ok);inputs.push(pass);
        }
        let picked=false,stop;
        const start=performance.now();
        while(inputs.length<240){
          if(env.isTerminal()){stop='terminal';break;}
          if(performance.now()-start>180000){stop='elapsed';break;}
          const menu=env.legalActions();
          if(!picked&&menu[0]?.actorId===white&&menu[0].target?.kind==='pass-reserve-card'){
            const action=menu.find(a=>a.target.cardId===reserve);
            if(!action){stop='same reserve unavailable';break;}
            assert(env.step(action).ok);inputs.push(action);picked=true;continue;
          }
          let v;
          try{v=take(env);}catch(e){if(!e.search&&!String(e).includes('DECISION_GATE'))throw e;stop='decision gate';break;}
          inputs.push(v.a);
          if(v.searches[0])decisions.push({a:v.a.summary,n:v.searches[0].diagnostics.nativeExecutions,ms:v.searches[0].rootAndSearchMilliseconds});
        }
        assert(stop);
        const end=env.createCheckpoint().coreState.compositionEnvelope;
        const score=stop==='terminal'?JSON.parse(end.committedState).match.finalScores.find(x=>x.playerId===white).totalScore:null;
        const peak=[Math.max(0,...decisions.map(d=>d.n)),Math.max(0,...decisions.map(d=>d.ms))];
        rows.push({name:reserve,inputs,checkpoints,end,score,peak,stop,decisions});
        console.log(JSON.stringify({reward:row.name,reserve,score,peak,stop}));
      }
      groups.push({name:row.name,root:origin,rows});
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='hidden') {
  const witness=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))), origin=witness.groups[1].root;
  assert.equal(origin.session,null);
  const env=initialized(), template=env.createCheckpoint(), groups=[];
  const restore=(envelope,machineAI={})=>env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:envelope,committedState:envelope.committedState},machineAI});
  restore(origin);
  const visible=env.observe(white), legal=env.legalActions();
  try{
    for(const order of [[0,1],[0,2],[0,4]]){
      const s=JSON.parse(origin.committedState), deck=s.aliens.amiba.cardDeck, [i,j]=order;
      const before=[deck[i],deck[j]];assert.notEqual(...before);
      [deck[i],deck[j]]=[deck[j],deck[i]];
      const newRoot={...origin,committedState:JSON.stringify(s)};
      restore(newRoot);assert.deepEqual(env.observe(white),visible);assert.deepEqual(env.legalActions(),legal);
      const prefix=[];let reward;
      for(let n=0;n<9;n++){
        reward=env.legalActions().find(a=>a.summary==='盲抽阿米巴牌');
        if(reward)break;
        const v=take(env);prefix.push(v.a);
      }
      assert(reward);assert.deepEqual(prefix,witness.groups[1].rows[0].inputs.slice(0,prefix.length));
      const host=env.createCheckpoint(), group={name:`amiba/${before.join('/')}`,root:newRoot,rows:[]};
      for(const policy of ['public reward','blind reward']){
        env.loadCheckpoint(host);
        const prior=[...prefix];
        if(policy==='blind reward'){assert(env.step(reward).ok);prior.push(reward);}
        const r=run(env,{prior,forced:policy});
        group.rows.push(r);
        console.log(JSON.stringify({order,before,policy,score:r.assets.score,tech:Object.keys(r.assets.tech.ownedTiles),income:r.assets.income,hand:r.assets.hand,peak:r.peak,stop:r.stop}));
      }
      groups.push(group);
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='income'||mode==='income-tail') {
  const baseline=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))).groups[0].rows[0];
  const env=initialized(),groups=[];
  try{
    for(const a of baseline.inputs.slice(0,39))assert.deepEqual(take(env).a,a);
    const host=env.createCheckpoint(), origin=host.coreState.compositionEnvelope;
    const p=JSON.parse(origin.committedState).players.players.find(p=>p.id===white);
    console.log(JSON.stringify({wallet:p.resources,income:p.income,computer:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),hand:p.hand.map(x=>x.cardId)}));
    const variants=[['place fifth then available blue slot',a=>a.target?.target==='blueBonus'],['play Amiba 0',a=>a.family==='play_card'&&a.summary==='amiba_0.webp'],['play Amiba 9',a=>a.family==='play_card'&&a.summary==='amiba_9.webp'],['play Amiba 9 then insert B14',a=>a.family==='play_card'&&a.summary==='amiba_9.webp'],['play B14',a=>a.family==='play_card'&&a.summary==='b_14.webp']];
    const rows=[];
    for(const [label,select] of (mode==='income-tail'?variants.filter(([n])=>n.startsWith('place')||n.includes('insert')):variants)){
      env.loadCheckpoint(host);const prior=[];
      const force=fn=>{const a=env.legalActions().find(fn);if(!a)return false;assert(env.step(a).ok);prior.push(a);return true;};
      if(label.startsWith('place')){
        assert(force(a=>a.family==='place_data'));assert(force(a=>a.summary==='第一排放置位 5'));
        assert(force(a=>a.family==='place_data'));
      }
      if(!force(select)){
        console.log(JSON.stringify({label,unavailable:env.legalActions().map(a=>[a.summary,a.target])}));continue;
      }
      const menus=[];
      if(label.includes('insert')){
        for(let i=0;i<36;i++){
          const offer=env.legalActions().filter(a=>a.actorId===white&&a.target?.choiceId?.startsWith('income:'));
          if(offer.length){
            const c=env.createCheckpoint(),w=c.coreState.compositionEnvelope.session?.session?.workingState;
            const p=w.players.players.find(x=>x.id===white);
            menus.push({i,offers:offer.map(a=>[a.summary,cards.getIncomeGainForCard(p.hand.find(x=>x.id===a.target.cardInstanceId))]),income:p.income,resources:p.resources});
            assert(force(a=>a.summary==='收入 b_14.webp'));break;
          }
          prior.push(take(env).a);
        }
        assert.equal(menus.length,1);
      }
      const r=run(env,{prior,forced:label});r.menus=menus;rows.push(r);
      console.log(JSON.stringify({label,stop:r.stop,score:r.assets.score,tech:Object.keys(r.assets.tech.ownedTiles),income:r.assets.income,computer:r.assets.computer,blue:r.assets.blue,pool:r.assets.resources.availableData,hand:r.assets.hand,probe:r.assets.probes,menus:r.menus,peak:r.peak}));
    }
    groups.push({name:'allocation before first analysis',root:origin,agentCheckpoint:host.machineAI[white],rows});
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='income-scan'){
  const witness=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))).groups[0];
  const row=witness.rows.find(r=>r.name.includes('insert B14'));
  const env=initialized(),groups=[];
  const original=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[5]))).groups[0].rows[0];
  try{
    for(const a of original.inputs.slice(0,39))assert.deepEqual(take(env).a,a);
    const host=env.createCheckpoint();
    const native=a=>{const found=env.legalActions().find(x=>x.actionId===a.actionId);assert.deepEqual(found,a);assert(env.step(found).ok);return found;};
    function forceTest(label,marks){
      env.loadCheckpoint(host);
      const prior=[], roots=[];
      for(const [i,a] of row.inputs.slice(0,30).entries()){
        const auto=i>0&&i<21||i>21;
        if(auto)assert.deepEqual(take(env).a,a);else native(a);
        prior.push(a);
      }
      const menu=env.legalActions();
      assert(menu[0]?.target?.choiceId?.startsWith('final:'));
      const a=menu.find(a=>a.summary===('标记 '+marks));assert(a);
      prior.push(native(a));
      const pool=assets(env.createCheckpoint().coreState.compositionEnvelope,env.observe(white));
      const options=env.legalActions();
      roots.push({pool,menu:options.map(a=>a.summary)});
      if(label.includes('scan')){
        const a=options.find(a=>a.family==='scan');
        if(!a){console.log(JSON.stringify({label,unavailable:roots.map(x=>[x.pool.resources,x.menu])}));return null;}
        prior.push(native(a));
      }
      const r=run(env,{prior,forced:label});r.fork=roots;
      console.log(JSON.stringify({label,score:r.assets.score,tech:r.assets.tech,income:r.assets.income,hand:r.assets.hand,pool:r.assets.resources.availableData,probe:r.assets.probes,peak:r.peak,stop:r.stop}));
      return r;
    }
    const rows=[forceTest('mark C', 'C'),forceTest('mark A then scan','A'),forceTest('mark C then scan','C')].filter(Boolean);
    groups.push({name:'Amiba 9 then B14, next actual public objective',root:witness.root,rows});
    write({source,groups});
  }finally{env.dispose();}
}

if(mode==='blue-hidden'){
  const forks=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))), origin=forks.groups[0].root;
  const env=initialized(), template=env.createCheckpoint(),groups=[];
  function restore(e){env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});}
  try{
    restore(origin);
    const visible=env.observe(white),menu=env.legalActions();
    for(const [i,j] of [[0,3],[1,4]]){
      const state=JSON.parse(origin.committedState),pile=state.cards.drawPileCardIds;
      const swap=[pile[i],pile[j]];assert.notEqual(...swap);
      [pile[i],pile[j]]=[pile[j],pile[i]];
      const root={...origin,committedState:JSON.stringify(state)}, rows=[];
      for(const blue of [false,true]){
        restore(root);assert.deepEqual(env.observe(white),visible);assert.deepEqual(env.legalActions(),menu);
        const prior=[];
        if(blue){
          for(const before of forks.groups[0].rows[0].inputs.slice(0,4)){
            const a=env.legalActions().find(a=>a.actionId===before.actionId);assert.deepEqual(a,before);assert(env.step(a).ok);prior.push(a);
          }
        }
        const r=run(env,{prior,forced:`${i}/${j}: ${blue?'blue first':'autonomous'}`});rows.push(r);
        console.log(JSON.stringify({label:r.name,swap,score:r.assets.score,income:r.assets.income,blue:r.assets.blue,peak:r.peak}));
      }
      groups.push({name:`ordinary deck ${i}/${j}`,root,swap,rows});
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='cash-crossover'){
  const path='reports/ai-foundation-20261113/r3-cash-analysis/r3-cash-analysis-quote-candidate-20261113-v2.json.gz';
  const witness=JSON.parse(zlib.gunzipSync(fs.readFileSync(path))).groups[0];
  const env=initialized(),template=env.createCheckpoint(),groups=[];
  try{
    for(const start of witness.rows){
      const origin=start.end, rows=[];
      const p=JSON.parse(origin.committedState).players.players.find(p=>p.id===white);
      const corner=cardId=>a=>a.family==='card_corner'&&a.target.cardInstanceId===p.hand.find(c=>c.cardId===cardId)?.id;
      const cases=[['autonomous',[]],['force Amiba 0 corner', [corner('amiba_0.webp')]],
        ['force Amiba 0 main',[a=>a.family==='play_card'&&a.summary==='amiba_0.webp']]];
      if(p.hand.some(c=>c.cardId==='amiba_7.webp')){
        cases.push(['force Amiba 7 main',[a=>a.family==='play_card'&&a.summary==='amiba_7.webp']]);
        cases.push(['Amiba 7 corner then computer instead of blue',[corner('amiba_7.webp'),a=>a.family==='place_data',a=>a.target?.target==='computer']]);
      }
      for(const [name,plan] of cases){
        env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:origin,committedState:origin.committedState},machineAI:{}});
        const prior=[];
        for(const select of plan){const a=env.legalActions().find(select);assert(a,name);assert(env.step(a).ok);prior.push(a);}
        const r=run(env,{prior,forced:name});rows.push(r);
        console.log(JSON.stringify({start:start.name,name,score:r.assets.score,income:r.assets.income,hand:r.assets.hand,pool:r.assets.resources.availableData,
          tech:Object.keys(r.assets.tech.ownedTiles),probe:r.assets.probes,blue:r.assets.blue,stop:r.stop,peak:r.peak,first:r.inputs.slice(0,7).map(a=>a.summary)}));
      }
      groups.push({name:start.name,root:origin,rows});
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='income-menu'){
  const record='reports/ai-foundation-20261113/r3-host-chain/human405-r3-host-chain-20261113-v1.json.gz';
  const trace=JSON.parse(zlib.gunzipSync(fs.readFileSync(record))).groups[0].rows[0];
  const env=initialized();
  try{
    for(const a of trace.inputs.slice(0,54))assert.deepEqual(take(env).a,a);
    const host=env.createCheckpoint(), origin=host.coreState.compositionEnvelope;
    const legal=env.legalActions(),rows=[];
    assert(legal.every(a=>a.actorId===white&&a.target?.choiceId?.startsWith('income:')));
    rows.push(run(env,{forced:'formal host plan'}));assert.deepEqual(rows[0].end,trace.end);
    for(const a of legal.filter(a=>a.actionId!==rows[0].inputs[0].actionId)){
      env.loadCheckpoint(host);assert(env.step(a).ok);
      const r=run(env,{prior:[a],forced:a.summary});rows.push(r);
    }
    for(const r of rows) console.log(JSON.stringify({name:r.name,choice:r.inputs[0].summary,score:r.assets.score,income:r.assets.income,
      hand:r.assets.hand,pool:r.assets.resources.availableData,tech:r.assets.tech,probe:r.assets.probes,peak:r.peak,stop:r.stop}));
    write({source,groups:[{name:'actual fourth computer slot after first analysis',root:origin,agentCheckpoint:host.machineAI[white],rows}]});
  }finally{env.dispose();}
}
if(mode==='cash-r4-cross'){
  const read=f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  const base='reports/ai-foundation-20261113/';
  const histories=[read(base+'r3-host-chain/human405-r3-host-terminal-20261113-v1.json.gz').groups[0],
    read(base+'r3-host-income/human405-r3-host-income-terminal-20261113-v1.json.gz').groups[0]];
  const env=initialized(),template=env.createCheckpoint(),groups=[];
  try{
    for(const [path,history] of histories.entries()){
      for(const [reserve,trace] of history.rows.entries()){
        if(process.argv[4]==='reverse'&&(!path||!reserve))continue;
        const action=reserve?(path?'发射':'b_9.webp'):path?'发射':'扫描';
        const pivot=trace.inputs.findIndex(a=>a.actorId===white&&a.phase==='main'&&a.family!=='pass'&&(!reserve||a.summary!=='b_32.webp'));
        assert(pivot>=0);
        env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:history.root,committedState:history.root.committedState},machineAI:{}});
        const prior=[];
        for(const a of trace.inputs.slice(0,pivot)){
          if(a.actorId===white&&a.target?.kind==='pass-reserve-card'){
            const expected=env.legalActions().find(x=>x.actionId===a.actionId);assert.deepEqual(expected,a);assert(env.step(expected).ok);
          }else assert.deepEqual(take(env).a,a);
          prior.push(a);
        }
        const cp=env.createCheckpoint(), rows=[], menu=env.legalActions().filter(a=>a.phase==='main');
        const forced=menu.find(a=>a.summary===action);
        if(!forced){console.log(JSON.stringify({path,reserve,action,unavailable:menu.map(x=>x.summary)}));continue;}
        assert(env.step(forced).ok);const inputs=[...prior,forced], decisions=[];
        let stop;
        const start=performance.now();
        while(inputs.length<220){
          if(env.isTerminal()){stop='terminal';break;}
          if(performance.now()-start>180000){stop='elapsed';break;}
          let v;
          try{v=take(env);}catch(e){if(!e.search&&!String(e).includes('DECISION_GATE'))throw e;stop='decision gate';break;}
          inputs.push(v.a);
          if(v.searches[0])decisions.push({a:v.a.summary,n:v.searches[0].diagnostics.nativeExecutions,ms:v.searches[0].rootAndSearchMilliseconds});
        }
        assert(stop);
        const end=env.createCheckpoint().coreState.compositionEnvelope;
        const score=stop==='terminal'?JSON.parse(end.committedState).match.finalScores.find(x=>x.playerId===white).totalScore:null;
        const peak=[Math.max(0,...decisions.map(d=>d.n)),Math.max(0,...decisions.map(d=>d.ms))];
        rows.push({name:'force '+action,inputs,checkpoints:[[pivot,cp.coreState.compositionEnvelope]],end,score,peak,stop,decisions});
        groups.push({name:`path ${path}/${trace.name}`,root:history.root,rows});
        console.log(JSON.stringify({path,reserve,pivot,action,original:trace.score,score,stop,peak}));
      }
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='cargo-scan-stock'){
  const file='reports/ai-foundation-20261113/prepass-funded-landing/r3-cargo-early-release-and-blue-slot-20261113-v1.json.gz';
  const sourceGroup=JSON.parse(zlib.gunzipSync(fs.readFileSync(file))).groups[0];
  const witness=sourceGroup.rows.find(r=>JSON.stringify(r.name)==='[101,102]');
  const env=initialized(),template=env.createCheckpoint(),groups=[];
  function restore(e){env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});}
  function apply(a){const actual=env.legalActions().find(x=>x.actionId===a.actionId);assert.deepEqual(JSON.parse(JSON.stringify(actual)),a);assert(env.step(actual).ok);return actual;}
  try{
    restore(sourceGroup.root);witness.inputs.slice(0,93).forEach(apply);
    const host=env.createCheckpoint(),origin=host.coreState.compositionEnvelope;
    const seen=new Set(JSON.parse(origin.committedState).cards.publicCards.map(c=>c.cardId));
    const rows=[],infeasible=[];
    for(const target of ['室女座61','绘架座β','南河三'])for(const desired of ['dlc_16.png → 天狼星A','dlc_16.png → 南河三','dlc_15.png → 天狼星A','dlc_15.png → 南河三','b_16.webp → 室女座61','b_16.webp → 开普勒22']){
      env.loadCheckpoint(host);const inputs=[],decisions=[];
      const force=pred=>{const a=env.legalActions().find(pred);if(!a)return false;assert(env.step(a).ok);inputs.push(a);return true;};
      assert(force(a=>a.family==='scan'));assert(force(a=>a.summary==='扫描 '+target));
      if(!force(a=>a.summary===desired)){
        infeasible.push([target,desired]);continue;
      }
      let boundary,notable=[];
      for(let i=0;i<40;i++){
        const cp=env.createCheckpoint(),m=env.legalActions();
        if(!cp.coreState.compositionEnvelope.session){
          if(!inputs.some(a=>a.family==='end_turn'))assert(force(a=>a.family==='end_turn'));
          else {boundary=cp.coreState.compositionEnvelope;break;}
        }else if(force(a=>a.summary==='结束公共牌扫描'||a.summary==='跳过'))continue;
        else{
          if(m.some(a=>a.summary.includes('盲抽')||a.summary.startsWith('获得展示的'))){
            const display=m.find(a=>a.summary.startsWith('获得展示的'));
            if(display){assert(force(a=>a.actionId===display.actionId));notable.push(display.summary);continue;}
            if(force(a=>a.summary==='取消'))continue;
            break;
          }
          const v=take(env);inputs.push(v.a);const q=v.searches[0];
          if(q)decisions.push([q.diagnostics.nativeExecutions,q.rootAndSearchMilliseconds]);
        }
      }
      assert(boundary,JSON.stringify([target,desired,env.legalActions().map(a=>a.summary)]));
      const end=boundary, result=assets(end,env.observe(white));
      rows.push({name:`${target}/${desired}`,inputs,end,score:null,checkpoints:[],assets:result,decisions,notable});
      console.log(JSON.stringify({target,desired,seen:[...seen],wallet:result.resources,hand:result.hand,computer:result.computer,blue:result.blue,probe:result.probes,notable,actions:inputs.map(a=>a.summary)}));
    }
    groups.push({name:'public signal combination at funded fossil round end',root:origin,rows,infeasible});
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='cargo-hidden'){
  const file='reports/ai-foundation-20261113/prepass-funded-landing/r3-cargo-early-release-and-blue-slot-20261113-v1.json.gz';
  const sourceGroup=JSON.parse(zlib.gunzipSync(fs.readFileSync(file))).groups[0];
  const witness=sourceGroup.rows.find(r=>JSON.stringify(r.name)==='[101,102]');
  const env=initialized(),template=env.createCheckpoint(),groups=[];
  function restore(e){env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});}
  function put(a){assert(a);assert(env.step(a).ok);return a;}
  try{
    restore(sourceGroup.root);
    witness.inputs.slice(0,65).forEach(old=>put(env.legalActions().find(a=>a.actionId===old.actionId)));
    const root=env.createCheckpoint().coreState.compositionEnvelope, visible=env.observe(white), legal=env.legalActions();
    for(const pair of [null,[0,3],[0,4],[1,5]]){
      const state=JSON.parse(root.committedState),pile=state.cards.drawPileCardIds;
      let swap=null;
      if(pair){const [i,j]=pair;swap=[pile[i],pile[j]];assert.notEqual(...swap);[pile[i],pile[j]]=[pile[j],pile[i]];}
      const origin={...root,committedState:JSON.stringify(state)};
      restore(origin);assert.deepEqual(env.observe(white),visible);assert.deepEqual(env.legalActions(),legal);
      const inputs=[],checkpoints=[],decisions=[];
      let diverged=null;
      const fixed=witness.inputs.slice(65,98);
      for(const [i,old] of fixed.entries()){
        const current=env.legalActions().find(a=>a.actionId===old.actionId);
        if(!current||JSON.stringify(current.target)!==JSON.stringify(old.target)||current.summary!==old.summary){
          diverged={index:i+65,old:old.summary,menu:env.legalActions().map(a=>a.summary)};break;
        }
        inputs.push(put(current));
      }
      let r;
      if(diverged)r=run(env,{prior:inputs,forced:'match then autonomous'});
      else{
        const end=env.createCheckpoint().coreState.compositionEnvelope;
        assert(env.legalActions().some(a=>a.family==='pass'&&a.actorId===white));
        r={name:'matched then leave inventory',inputs,checkpoints,decisions,end,score:null,assets:assets(end,env.observe(white)),stop:'prepass',peak:[0,0]};
      }
      r.diverged=diverged;
      groups.push({name:pair?.join('/')||'original',root:origin,swap,rows:[r]});
      console.log(JSON.stringify({swap,diverged,stop:r.stop,score:r.assets.score,tech:Object.keys(r.assets.tech.ownedTiles),income:r.assets.income,
        hand:r.assets.hand,pool:r.assets.resources.availableData,computer:r.assets.computer,blue:r.assets.blue,probe:r.assets.probes,peak:r.peak}));
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='cargo-supplier'){
  const read=f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  const hidden=read(process.argv[4]);
  const original=hidden.groups[0].rows[0];
  const env=initialized(),template=env.createCheckpoint(),groups=[];
  const restore=e=>env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});
  const put=a=>{assert(a);assert(env.step(a).ok);return a;};
  try{
    for(const g of hidden.groups.slice(1,3)){
      restore(g.root);
      const inputs=[];
      for(const old of original.inputs.slice(0,24)){
        const a=env.legalActions().find(x=>x.actionId===old.actionId);assert.deepEqual(a,old);inputs.push(put(a));
      }
      const cp=env.createCheckpoint();
      const force=fn=>inputs.push(put(env.legalActions().find(fn)));
      force(a=>a.family==='card_corner'&&a.summary.startsWith('b_9.webp'));
      force(a=>a.family==='quick_trade'&&a.target?.tradeId==='publicity-for-card');
      force(a=>a.summary==='dlc_15.png');
      force(a=>a.family==='card_corner'&&a.summary.startsWith('dlc_15.png'));
      for(const old of original.inputs.slice(25)){
        const a=env.legalActions().find(x=>x.actionId===old.actionId&&x.summary===old.summary);
        assert(a,JSON.stringify([old.summary,env.legalActions().map(x=>x.summary)]));inputs.push(put(a));
      }
      const end=env.createCheckpoint().coreState.compositionEnvelope;
      assert(env.legalActions().some(a=>a.family==='pass'&&a.actorId===white));
      const result=assets(end,env.observe(white));
      const row={name:'public DLC15 substituted after reveal',inputs,end,score:null,checkpoints:[[24,cp.coreState.compositionEnvelope]],assets:result,stop:'prepass',peak:[0,0]};
      groups.push({name:g.name,root:g.root,rows:[row]});
      console.log(JSON.stringify({name:g.name,wallet:result.resources,hand:result.hand,computer:result.computer,blue:result.blue,probe:result.probes}));
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='cargo-entry'){
  const file='reports/ai-foundation-20261113/prepass-funded-landing/r3-cargo-early-release-and-blue-slot-20261113-v1.json.gz';
  const g=JSON.parse(zlib.gunzipSync(fs.readFileSync(file))).groups[0];
  const ref=g.rows.find(r=>JSON.stringify(r.name)==='[101,102]');
  const env=initialized(),template=env.createCheckpoint(),groups=[];
  const restore=e=>env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});
  function fixed(old){const a=env.legalActions().find(x=>x.actionId===old.actionId);assert.deepEqual(JSON.parse(JSON.stringify(a)),old);assert(env.step(a).ok);return a;}
  function summary(r){return{stop:r.stop,score:r.assets.score,income:r.assets.income,tech:Object.keys(r.assets.tech.ownedTiles),hand:r.assets.hand,pool:r.assets.resources.availableData,probe:r.assets.probes,peak:r.peak};}
  try{
    for(const index of [7,10,12,53,54]){
      restore(g.root);ref.inputs.slice(0,index).forEach(fixed);
      const cp=env.createCheckpoint(),e=cp.coreState.compositionEnvelope;
      const rows=[run(env,{forced:'autonomous from boundary'})];
      if([7,10,53].includes(index)){
        env.loadCheckpoint(cp);
        const end=index===7?11:index+1, prior=ref.inputs.slice(index,end).map(fixed);
        rows.push(run(env,{prior,forced:index===7?'match scan through second-species pink':`fixed ${ref.inputs[index].summary}`}));
      }
      for(const r of rows){
        const diffs=r.inputs.map((a,i)=>[i+index,a.summary,ref.inputs[i+index]?.summary]).filter(([i,a,b])=>a!==b).slice(0,3);
        const acquired=r.inputs.filter(a=>a.summary.includes('展示的')||a.summary==='chong_3.webp'||a.summary.startsWith('fossil_'));
        console.log(JSON.stringify({index,name:r.name,firstDiffs:diffs,acquired:acquired.map(a=>a.summary),...summary(r)}));
      }
      groups.push({name:`input ${index}`,root:e,rows});
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='cargo-reveal-types'){
  const read=f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  const origin=read(process.argv[4]).groups.find(g=>g.name==='input 10').root;
  const aliens=require('../randomizer/game/aliens'),{createSeededRandom}=require('../randomizer/game/random');
  const keys=['chong','aomomo','banrenma','runezu','yichangdian','jiuzhe','fangzhou'];
  const stable=o=>Array.isArray(o)?o.map(stable):o&&typeof o==='object'?Object.fromEntries(Object.keys(o).sort().map(k=>[k,stable(o[k])])):o;
  const env=initialized(),template=env.createCheckpoint(),groups=[];
  const restore=e=>env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});
  restore(origin);const visible=env.observe(white),menu=env.legalActions();let signature;
  try{
    for(const key of keys){
      const root=structuredClone(origin),s=JSON.parse(root.committedState),session=root.session.session;
      if(key!=='chong'){
        const config=aliens[key].createInitialConfiguration(createSeededRandom('seti-cargo-reveal-study:'+key),s.players.players);
        for(const state of new Set([s,session.baseState,session.workingState,session.committedState,...session.undoFrames.map(x=>x.stateBefore)].filter(Boolean))){
          const slot=state.aliens.aliens[2];assert(!slot.revealed);slot.assignedAlienId=aliens[key].ALIEN_ID;
          for(const k of keys)state.aliens[k].initialConfiguration=k===key?structuredClone(config):null;
        }
        root.committedState=JSON.stringify(stable(s));
      }
      restore(root);assert.deepEqual(env.observe(white),visible);assert.deepEqual(env.legalActions(),menu);
      const cp=env.createCheckpoint(), quoted=take(env).searches[0];
      const sig=[quoted.actionId,quoted.value,quoted.diagnostics.nativeExecutions,quoted.roots.map(r=>[r.actionId,r.value,r.completion])];
      if(signature)assert.deepEqual(sig,signature);else signature=sig;
      const rows=[];
      for(const reveal of [false,true]){
        env.loadCheckpoint(cp);const prior=[];
        if(reveal){const a=env.legalActions().find(a=>a.target?.alienSlotId===2&&a.target?.traceType==='pink');assert(a);assert(env.step(a).ok);prior.push(a);}
        const r=run(env,{prior,forced:reveal?'reveal unknown species':'use known Amiba'});rows.push(r);
        console.log(JSON.stringify({key,reveal,score:r.assets.score,income:r.assets.income,tech:Object.keys(r.assets.tech.ownedTiles).length,
          hand:r.assets.hand.length,pool:r.assets.resources.availableData,probe:r.assets.probes,peak:r.peak,stop:r.stop}));
      }
      groups.push({name:key,root,rows});
    }
    write({source,signature,groups});
  }finally{env.dispose();}
}
if(mode==='cargo-retain-or-deliver'){
  const g=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))).groups.find(g=>g.name==='input 10');
  const ref=g.rows[1],env=initialized(),template=env.createCheckpoint();
  const restore=e=>env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});
  const put=a=>{assert(a);assert(env.step(a).ok);return a;};
  try{
    restore(g.root);
    const reveal=env.legalActions().find(a=>a.actionId===ref.inputs[0].actionId);put(reveal);
    for(const a of ref.inputs.slice(1,69))assert.deepEqual(take(env).a,a);
    const cp=env.createCheckpoint(),origin=cp.coreState.compositionEnvelope,rows=[];
    for(const stopMoving of [false,true]){
      env.loadCheckpoint(cp);
      if(!stopMoving){const r=run(env,{forced:'complete host plan'});assert.deepEqual(r.end,ref.end);rows.push(r);}
      else{
        const endTurn=put(env.legalActions().find(a=>a.actorId===white&&a.family==='end_turn'));
        const r=run(env,{prior:[endTurn],forced:'end turn before paying fossil return'});rows.push(r);
      }
    }
    for(const r of rows)console.log(JSON.stringify({name:r.name,score:r.assets.score,income:r.assets.income,tech:Object.keys(r.assets.tech.ownedTiles).length,hand:r.assets.hand,pool:r.assets.resources.availableData,blue:r.assets.blue,probe:r.assets.probes,stop:r.stop,peak:r.peak}));
    write({source,groups:[{name:'third-round fossil return payment',root:origin,agentCheckpoint:cp.machineAI[white],rows}]});
  }finally{env.dispose();}
}
if(mode==='cargo-electricity'){
  const base='reports/ai-foundation-20261113/r3-cargo-entry/';
  const read=f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(base+f)));
  const g=read('human405-r3-cargo-entry-20261113-v1.json.gz').groups.find(g=>g.name==='input 10');
  const ref=g.rows[1], env=initialized(),template=env.createCheckpoint();
  const restore=e=>env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});
  function put(pred,inputs){const a=env.legalActions().find(pred);assert(a,JSON.stringify(env.legalActions().map(x=>x.summary)));assert(env.step(a).ok);inputs.push(a);}
  try{
    restore(g.root);put(a=>a.actionId===ref.inputs[0].actionId,[]);
    for(const a of ref.inputs.slice(1,65))assert.deepEqual(take(env).a,a);
    const host=env.createCheckpoint(),origin=host.coreState.compositionEnvelope;
    const rows=[];
    for(const policy of ['complete host plan','public DLC17 via publicity','public DLC17 via card payment']){
      env.loadCheckpoint(host);
      const prefix=[];
      if(policy.endsWith('publicity')){
        put(a=>a.family==='card_corner'&&a.summary.startsWith('chong_8.webp'),prefix);
        put(a=>a.target?.tradeId==='publicity-for-card',prefix);
      }
      if(policy.endsWith('payment')){
        put(a=>a.target?.tradeId==='cards-for-pick-card',prefix);
        for(const c of ['chong_7.webp','chong_9.webp'])put(a=>a.family==='choose_payment'&&a.summary===c,prefix);
        put(a=>a.target?.confirm,prefix);
      }
      let ready;
      if(prefix.length){
        put(a=>a.family==='choose_card'&&a.summary==='dlc_17.png',prefix);
        put(a=>a.family==='card_corner'&&a.summary.startsWith('dlc_17.png'),prefix);
        for(const i of [1,2,3,4]){
          put(a=>a.family==='place_data',prefix);
          put(a=>a.summary===`第一排放置位 ${i}`,prefix);
        }
        put(a=>a.summary==='收入 amiba_9.webp',prefix);
        const cp=env.createCheckpoint();ready=assets(cp.coreState.compositionEnvelope,env.observe(white));
        put(a=>a.actorId===white&&a.family==='end_turn',prefix);
      }
      const row=run(env,{prior:prefix,forced:policy});rows.push({...row,ready});
      if(!ready)assert.deepEqual(row.end,ref.end);
      console.log(JSON.stringify({policy,ready:ready&&[ready.score,ready.resources,ready.hand,ready.probes,ready.income],end:[row.stop,row.assets.score,row.assets.income,row.assets.hand,row.assets.resources.availableData,row.assets.probes,row.assets.blue],peak:row.peak}));
    }
    write({source,groups:[{name:'public alternative before post-analysis placement',root:origin,agentCheckpoint:host.machineAI[white],rows}]});
  }finally{env.dispose();}
}
if(mode==='cargo-electricity-hidden'){
  const read=f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  const g=read(process.argv[4]).groups[0],env=initialized(),template=env.createCheckpoint(),groups=[];
  const restore=e=>env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});
  restore(g.root);const visible=env.observe(white),legal=env.legalActions();
  try{
    for(const [i,j] of [[0,3],[0,6]]){
      const state=JSON.parse(g.root.committedState),deck=state.cards.drawPileCardIds;
      assert.notEqual(deck[i],deck[j]);const swap=[deck[i],deck[j]];[deck[i],deck[j]]=[deck[j],deck[i]];
      const root={...g.root,committedState:JSON.stringify(state)},rows=[];
      for(const reference of g.rows.slice(0,2)){
        restore(root);assert.deepEqual(env.observe(white),visible);assert.deepEqual(env.legalActions(),legal);
        const prior=[];
        if(reference.ready){
          const stop=reference.inputs.findIndex(a=>a.family==='end_turn');assert(stop>0);
          for(const old of reference.inputs.slice(0,stop+1)){
            const action=env.legalActions().find(a=>a.actionId===old.actionId);
            assert.deepEqual(action,old);assert(env.step(action).ok);prior.push(action);
          }
        }
        const r=run(env,{prior,forced:`${i}/${j} ${reference.name}`});rows.push(r);
        console.log(JSON.stringify({swap,name:r.name,stop:r.stop,score:r.assets.score,income:r.assets.income,hand:r.assets.hand,pool:r.assets.resources.availableData,probe:r.assets.probes,peak:r.peak}));
      }
      groups.push({name:`ordinary pile ${i}/${j}`,root,swap,rows});
    }
    write({source,groups});
  }finally{env.dispose();}
}
if(mode==='cargo-inventory-stop'){
  const file='reports/ai-foundation-20261113/r3-cargo-electricity/human405-r3-cargo-electricity-20261113-v1.json.gz';
  const g=JSON.parse(zlib.gunzipSync(fs.readFileSync(file))).groups[0],ref=g.rows[1];
  const env=initialized(),template=env.createCheckpoint();
  const restore=e=>env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:e,committedState:e.committedState},machineAI:{}});
  function put(action){assert(action);assert(env.step(action).ok);return action;}
  try{
    restore(g.root);
    const cut=ref.inputs.findIndex(a=>a.family==='end_turn')+1;
    for(const old of ref.inputs.slice(0,cut)){
      const a=env.legalActions().find(x=>x.actionId===old.actionId);assert.deepEqual(a,old);put(a);
    }
    const host=env.createCheckpoint(),origin=host.coreState.compositionEnvelope,rows=[];
    function record(name,inputs,decisions=[]){
      assert(env.legalActions().some(a=>a.family==='pass'&&a.actorId===white));
      const end=env.createCheckpoint().coreState.compositionEnvelope;
      const row={name,inputs,end,checkpoints:[],score:null,stop:'prepass',assets:assets(end,env.observe(white)),decisions,
        peak:[Math.max(0,...decisions.map(d=>d[0])),Math.max(0,...decisions.map(d=>d[1]))]};
      rows.push(row);return row;
    }
    record('leave two known movement cards',[]);
    const automatic=run(env,{forced:'continue autonomously'});assert.deepEqual(automatic.end,ref.end);rows.push(automatic);
    env.loadCheckpoint(host);
    const scanPrefix=ref.inputs.slice(cut,ref.inputs.findIndex((a,i)=>i>=cut&&a.family==='scan'));
    for(const old of scanPrefix)assert.deepEqual(take(env).a,old);
    const ready=env.createCheckpoint();
    env.loadCheckpoint(ready);
    const inputs=[...scanPrefix],decisions=[];
    for(const a of ref.inputs.slice(cut+scanPrefix.length)){
      const v=take(env);assert.deepEqual(v.a,a);inputs.push(v.a);
      for(const q of v.searches)decisions.push([q.diagnostics.nativeExecutions,q.rootAndSearchMilliseconds]);
      if(v.a.family==='end_turn')break;
    }
    record('exact scan, no further analysis',inputs,decisions);
    for(const r of rows){const a=r.assets;console.log(JSON.stringify({name:r.name,score:a.score,tech:Object.keys(a.tech.ownedTiles).length,income:a.income,hand:a.hand,pool:a.resources.availableData,blue:a.blue,computer:a.computer,probe:a.probes,peak:r.peak}));}
    write({source,groups:[{name:'same salary and transported fossil, third-round uses',root:origin,rows}]});
  }finally{env.dispose();}
}

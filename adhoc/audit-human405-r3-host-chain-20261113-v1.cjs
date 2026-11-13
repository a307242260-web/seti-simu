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
if(mode==='terminal') {
  const forks=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))).groups.flatMap(g=>g.rows.slice(0,3));
  const env=initialized(),groups=[];
  const template=env.createCheckpoint();
  try{
    for(const row of forks){
      const origin=row.end,rows=[];
      for(const reserve of ['b_111.webp','b_32.webp']){
        env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:origin,committedState:origin.committedState},machineAI:{}});
        const inputs=[],checkpoints=[],decisions=[];
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

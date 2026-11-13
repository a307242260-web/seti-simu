'use strict';
const fs = require('node:fs');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const scenario = require('../tools/research-human405-round1');
const data = require('../randomizer/game/data');
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
  const forks=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4]))).groups[0];
  const env=initialized(),groups=[];
  const template=env.createCheckpoint();
  try{
    for(const row of forks.rows.slice(0,3)){
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

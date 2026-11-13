'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const zlib = require('node:zlib'), { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const at = f => path.resolve(repo, f);
const out=path.resolve(process.argv[2]),mode=process.argv[3];
const openSeats=process.argv.includes('--open-seats');
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const white='player-white';
const {createAnalysisPort} = require(at('randomizer/game/ai/analysis-port'));
const {createSearchAgent} = require(at('randomizer/game/ai/search-agent'));
const {createSimulationRuleComposition} = require(at('randomizer/training/simulation-rule-composition'));
const {buildRuleObservation} = require(at('randomizer/app/rule-observation'));
const {createSeededRandom} = require(at('randomizer/game/random'));
const teacher = require(at('tools/research-human405-round1'));
const {passiveAgent}=teacher;
function open(root,opponents) {
  const seed=JSON.parse(root.committedState).meta.seed;
  const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,
    trustedProjectionReader:true,projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,
      viewer?.playerId||null,[],{cheap:viewer?.cheap===true,valueOnly:viewer?.valueOnly===true})});
  kernel.newGame({seed});
  const c=kernel.composition,save=()=>c.lifecycle.save().envelope;
  const state=()=>{const e=save();return e.session?.session?.workingState||JSON.parse(e.committedState);};
  const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
  assert(c.lifecycle.restore(root).ok);assert.deepEqual(save(),root);
  function apply(a) {
    const d=c.inspect().session?.decision;
    const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
      :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
    assert(result.ok,JSON.stringify(result.failure||result));return a;
  }
  function advanceOpponents(inputs) {
    for(let j=0;j<30;j++){
      const legalActions=menu(),id=legalActions[0]?.actorId;assert(id);
      if(id===white)return;
      const observation=c.projection({role:'player',playerId:id}).state;
      const {actionId}=passiveAgent(id,opponents).decide({legalActions,observation});
      inputs.push(apply(legalActions.find(a=>a.actionId===actionId)));
    }
    throw Error('unclosed opponent sequence');
  }
  function automatic(checkpoint) {
    const before=save(),actions=menu(),port=createAnalysisPort({composition:c,seatId:white,maxCacheEntries:0});
    try {
      const agent=createSearchAgent({seatId:white,analysisPort:port});
      if(checkpoint)agent.loadCheckpoint(checkpoint);
      const r=agent.decide({seatId:white,legalActions:actions}).search;
      return {a:actions.find(a=>a.actionId===r.actionId),checkpoint:structuredClone(agent.createCheckpoint()),
        n:r.diagnostics.nativeExecutions,ms:r.rootAndSearchMilliseconds,value:r.value,
        complete:r.complete&&!r.unresolved.length,roots:r.roots};
    } finally {port.close();assert.deepEqual(save(),before);}
  }
  return {c,save,state,menu,apply,advanceOpponents,automatic,dispose:()=>c.dispose()};
}
function q(m, plan) {
  try {
    const r=m.automatic(plan);
    return {action:r.a,checkpoint:r.checkpoint,n:r.n,ms:r.ms,v:r.value,complete:r.complete,
      roots:r.roots.filter(x=>Number.isFinite(x.value)).map(x=>[x.actionId,x.value,x.plan?.objective?.id,x.goal?.id])};
  } catch(e) {
    if(!e.search)throw e;
    return {complete:false,n:e.search.diagnostics.nativeExecutions,ms:e.search.rootAndSearchMilliseconds,error:e.code};
  }
}
const admissible = u => u.action && u.complete && u.n <= 256 && u.ms <= 600;
const catalog=require(at('tools/research-free-analyze-random20'));
const {getProbeRouteRequirements}=require(at('randomizer/game/production-kernel'));
const read=f=>JSON.parse(fs.readFileSync(at(f)));
const unzip=f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(at(f))));
const write=x=>fs.writeFileSync(out,zlib.gzipSync(JSON.stringify(x)),{flag:'wx'});
function same(a,c){
 if(a?.family!==c.nextStep.family)return false;
 const t=a.target||{},s=c.nextStep;
 if(a.family==='move')return t.rocketId===c.rocketId&&t.deltaX===s.deltaX&&t.deltaY===s.deltaY;
 if(a.family==='orbit')return t.rocketId===c.rocketId&&t.planetId===c.planetId;
 return t.planetId==null||t.planetId===c.planetId;
}
function targets(m){
 const s=m.state(),p=s.players.players.find(v=>v.id===white);
 const activeOpponents=s.turn.activePlayerIds.some(id=>id!==white&&!s.turn.passedPlayerIds.includes(id));
 if(s.turn.roundNumber!==3||p.mainActionCompleted||!s.pieces.rockets.some(v=>v.playerId===white)||activeOpponents!==openSeats)return [];
 const wallet=p.resources;
 return getProbeRouteRequirements(s,white).candidates.filter(c=>c.rocketId!=null
   &&['orbit','land'].includes(c.endpointFamily)&&c.targetBenefit.dataCount>=2&&c.required.movementSteps<=2
   &&c.required.credits<=wallet.credits&&c.required.energy<=wallet.energy&&m.menu().some(a=>same(a,c)))
   .sort((a,b)=>b.targetBenefit.dataCount-a.targetBenefit.dataCount||b.targetBenefit.score-a.targetBenefit.score
      ||a.required.energy-b.required.energy||a.required.credits-b.required.credits||a.requirementId.localeCompare(b.requirementId));
}
function select(m,tag,index,screen){
 if(m.c.inspect().session||!m.menu().some(a=>a.actorId===white&&a.phase==='main'))return;
 const options=targets(m);if(!options.length)return;
 const r=q(m),candidate=options[0];
 screen.push({tag,index,candidate,options:options.length,choice:r.action?.summary,n:r.n,ms:r.ms,v:r.v,
    offered:r.roots?.some(([id])=>m.menu().some(a=>a.actionId===id&&same(a,candidate))),
    match:same(r.action,candidate),admitted:admissible(r),root:m.save()});
}
if(mode==='screen'){
 const manifest=read('reports/iteration/free-analyze-random20-funded-planet-20261111/summary-463fc442-20261111.json');
 const ranked=manifest.rows.toSorted((a,b)=>a.score-b.score||a.board-b.board);
 const sample=process.argv.includes('--remaining')?ranked.slice(8):ranked.slice(0,8),screen=[],scans=[];
 for(const row of sample){
  const rec=read('reports/research/'+row.f), saved=read(rec.savePath);
  const meta=catalog.describe({agentType:'search',seed:rec.seed,activePlayerCount:4,flags:{scenario:catalog.IDS[1]}},{full:true});
  const env=catalog.createEnvironment({},meta);let count=0;
  try{
   const start=catalog.initialize(env,{seed:rec.seed,activePlayerCount:4,compactReplay:true},meta);
   assert.deepEqual(start.map(x=>x.action.actionId),saved.replaySteps.slice(0,start.length).map(x=>x.action.actionId));
   for(let i=start.length;i<saved.replaySteps.length;i++){
    const round=env.observe(white).publicState.roundNumber;if(round>3)break;
    const old=saved.replaySteps[i].action,legal=env.legalActions(),a=legal.find(x=>x.actionId===old.actionId);
    assert(a,`${row.board}/${i}`);assert.deepEqual(a.target,old.target);
    if(round===3&&a.actorId===white&&legal.some(b=>b.phase==='main')){
     const root=env.createCheckpoint().coreState.compositionEnvelope;
     if(!root.session){
      const m=open(root);try{select(m,'board '+row.board,i,screen);count++;}finally{m.dispose();}
     }
    }
    assert(env.step(a).ok,`${row.board}/${i}`);
   }
  }finally{env.dispose();}
  scans.push(['board '+row.board,count]);
 }
 const base='reports/research/688e6730.fef545ca.quick-400.json',rec=read(base),before=read(base+'.round-end-2.checkpoint.json'),after=read(base+'.round-end-3.checkpoint.json');
 const actions=read(rec.savePath).replaySteps.map(x=>x.action);
 const witness=unzip('reports/ai-foundation-20261113/prepass-funded-landing/r3-teacher-scan-handoff-20261113-v1.json.gz').groups[0];
 for(const [tag,root,trace,offset,end] of [
  ['standard AI',before.coreState.compositionEnvelope,actions.slice(before.replaySteps.length,after.replaySteps.length),before.replaySteps.length,after.coreState.compositionEnvelope],
  ['teacher-origin AI',witness.root,witness.rows[0].inputs,0,witness.rows[0].end],
 ]){
  let count=0;
  const m=open(root);
  try{
   trace.forEach((a,i)=>{
    if(m.state().turn.roundNumber===3&&a.actorId===white&&!m.c.inspect().session){select(m,tag,offset+i,screen);count++;}
    const action=m.menu().find(x=>x.actionId===a.actionId);assert(action);assert.deepEqual(action.target,a.target);m.apply(action);
   });
   assert.deepEqual(m.save(),end);
  }finally{m.dispose();}
  scans.push([tag,count]);
 }
 write({source,openSeats,scans,screen});
 console.log(JSON.stringify({scans,hits:screen.map(({tag,index,candidate,choice,n,ms,offered,match,admitted,options})=>[tag,index,candidate.requirementId,options,choice,n,Math.round(ms),offered,match,admitted])}));
}
if(mode==='compare'||mode==='hidden'||mode==='hidden19'){
 const scan=unzip(process.argv[4]),groups=[];
 const eligible=scan.screen.filter(r=>r.admitted&&!r.match).flatMap(hit=>{
  if(mode==='compare')return [hit];
  if(mode==='hidden'?hit.tag!=='board 16':hit.tag!=='board 19'||hit.index!==93)return [];
  const original=open(hit.root);
  try{
   const view=original.c.projection({role:'player',playerId:white}).state,menu=original.menu();
   return [[0,3],[0,6],[1,4]].map(([a,b])=>{
    const s=JSON.parse(hit.root.committedState),deck=s.cards.drawPileCardIds;
    assert.notEqual(deck[a],deck[b]);
    [deck[a],deck[b]]=[deck[b],deck[a]];
    const root={...hit.root,committedState:JSON.stringify(s)},m=open(root);
    try{
     assert.deepEqual(m.c.projection({role:'player',playerId:white}).state,view);
     assert.deepEqual(m.menu(),menu);
     assert.deepEqual(targets(m)[0],hit.candidate);
    }finally{m.dispose();}
    return {...hit,root,tag:`${hit.tag}/hidden/${a}/${b}`};
   });
  }finally{original.dispose();}
 });
 const inputsFor=m=>m.state().players.players.find(p=>p.id===white).resources;
 for(const hit of eligible){
  const {root,candidate,tag,index}=hit;
  const opponents=tag==='teacher-origin AI'?{preferredReserve:teacher.describe({agentType:'search',activePlayerCount:4,seed:'seti-free-analyze-v1',flags:{scenario:teacher.THIRD_ROUND_ID}}).passiveReservePreferences}:undefined;
  const m=open(root,opponents),rows=[];
  try{
   const initial=q(m);assert(admissible(initial));
   const firstActions=initial.roots.map(([id,value])=>[m.menu().find(a=>a.actionId===id)?.summary,value]);
   console.log(JSON.stringify({tag,firstActions}));
   for(const forced of [false,true]){
    const inputs=[],checkpoints=[],decisions=[],settlements=[],began=performance.now();
    let plan,stop;
    const put=a=>inputs.push(m.apply(a));
    if(forced){
     for(const step of candidate.path){
      const move=m.menu().find(a=>a.family==='move'&&a.target.rocketId===candidate.rocketId&&a.target.deltaX===step.deltaX&&a.target.deltaY===step.deltaY);
      assert(move);put(move);
      put(m.menu().find(a=>a.family==='choose_payment'&&a.payload.energyCost===move.payload.requiredMovePoints&&!a.target.cardIds?.length));
      while(m.c.inspect().session){
       const r=q(m,plan);
       decisions.push({action:r.action?.summary,n:r.n,ms:r.ms,v:r.v,complete:r.complete});
       assert(admissible(r),'movement-trigger decision exceeds gate');
       put(r.action);plan=r.checkpoint;
      }
     }
     const before={...inputsFor(m)}, s=m.state();
     const count=state=>{const p=state.planets.planets[candidate.planetId];return candidate.endpointFamily==='land'?(p.landMarkers?.length??p.landingMarkers?.length??0):(p.orbitMarkers?.length??0);};
     const selected=m.menu().find(a=>a.family===candidate.endpointFamily&&(a.family==='land'&&a.target?.select===true||a.target?.planetId===candidate.planetId&&a.target?.rocketId===candidate.rocketId));
     if(!selected){
      stop='native endpoint unavailable';
      settlements.push({before,unavailable:m.menu().map(a=>[a.family,a.summary,a.target]),rocket:s.pieces.rockets.find(r=>r.id===candidate.rocketId)});
     }else{
      put(selected);
      const target=m.menu().find(a=>a.family==='choose_target'&&a.target.rocketId===candidate.rocketId&&a.target.planetId===candidate.planetId&&a.target.landTarget?.type===candidate.endpointTarget.type&&(a.target.landTarget?.satelliteId||null)===(candidate.endpointTarget.satelliteId||null));
      if(target)put(target);
      assert(inputsFor(m).availableData>=before.availableData+2,'missing original data reward');
      checkpoints.push([inputs.length,m.save()]);
      settlements.push({before,after:inputsFor(m),markerDelta:count(m.state())-count(s)});
     }
    }
    plan=null;
    while(!stop&&inputs.length<320){
     const s=m.state();
     if(s.turn.gameEnded&&!m.c.inspect().session){stop='terminal';break;}
     if(performance.now()-began>=180000){stop='elapsed-gate';break;}
     if(m.menu()[0]?.actorId!==white){m.advanceOpponents(inputs);continue;}
     const r=q(m,plan);
     decisions.push({action:r.action?.summary,n:r.n,ms:r.ms,v:r.v,complete:r.complete});
     if(!admissible(r)){stop='decision-gate';break;}
     if(r.action.family==='pass') checkpoints.push([inputs.length,m.save()]);
     put(r.action);plan=r.checkpoint;
    }
    assert(stop);
    const end=m.save(),score=stop==='terminal'?m.state().match.finalScores.find(x=>x.playerId===white).totalScore:null;
    const peak=[Math.max(initial.n,...decisions.map(x=>x.n)),Math.max(initial.ms,...decisions.map(x=>x.ms))];
    rows.push({name:forced?'funded landing':'current AI',inputs,checkpoints,decisions,end,score,stop,peak,settlements});
    console.log(JSON.stringify({tag,index,forced,score,stop,peak,settlements,gate:stop==='decision-gate'?decisions.at(-1):undefined}));
    assert(m.c.lifecycle.restore(root).ok);
   }
   groups.push({name:tag+'/'+index,root,candidate,rows,firstActions});
  }finally{m.dispose();}
 }
 write({source,groups});
}
if(mode==='continuity'){
 const scan=unzip(process.argv[4]);
 const hit=i=>scan.screen.find(r=>r.tag==='board 19'&&r.index===i);
 const root=hit(87).root, middle=hit(93).root, rows=[];
 const m=open(root);
 try{
  for(const preserve of [true,false]){
   const inputs=[],checkpoints=[],decisions=[];
   let plan,stop,checkpointAtMiddle;
   const put=a=>inputs.push(m.apply(a));
   while(inputs.length<320){
    if(m.state().turn.gameEnded&&!m.c.inspect().session){stop='terminal';break;}
    if(m.menu()[0]?.actorId!==white){m.advanceOpponents(inputs);continue;}
    if(inputs.length===6){
     assert.deepEqual(m.save(),middle);
     assert(plan);
     checkpointAtMiddle=structuredClone(plan);
     checkpoints.push([inputs.length,m.save()]);
     if(!preserve)plan=null;
    }
    const r=q(m,plan);
    decisions.push({action:r.action?.summary,n:r.n,ms:r.ms,v:r.v,complete:r.complete});
    if(!admissible(r)){stop='decision-gate';break;}
    if(r.action.family==='pass')checkpoints.push([inputs.length,m.save()]);
    put(r.action);plan=r.checkpoint;
   }
   assert(stop);
   const score=stop==='terminal'?m.state().match.finalScores.find(x=>x.playerId===white).totalScore:null;
   const peak=[Math.max(...decisions.map(x=>x.n)),Math.max(...decisions.map(x=>x.ms))];
   rows.push({name:preserve?'keep agent checkpoint':'omit agent checkpoint',inputs,checkpoints,decisions,end:m.save(),score,stop,peak});
   assert(checkpointAtMiddle);
   console.log(JSON.stringify({preserve,score,stop,peak,atMiddle:decisions[6]}));
   assert(m.c.lifecycle.restore(root).ok);
  }
 }finally{m.dispose();}
 write({source,groups:[{name:'board 19/87 through identical intermediate envelope',root,rows}]});
}
if(mode==='host'){
const a=unzip(process.argv[4]).groups[0],row=a.rows[0],middle=row.checkpoints[0][1];
const seed=JSON.parse(middle.committedState).meta.seed;
const meta=catalog.describe({agentType:'search',seed,activePlayerCount:4,flags:{scenario:catalog.IDS[1]}},{full:true});
const env=catalog.createEnvironment({},meta);
try{
 catalog.initialize(env,{seed,activePlayerCount:4,compactReplay:true},meta);const template=env.createCheckpoint(), results=[];
 const take=label=>{const r=env.runAgentDecision();const newState=env.createCheckpoint(),action=newState.replaySteps.at(-1).action,search=r.searches?.[0]; const x={label,action:action.summary,id:action.actionId,nativeExecutions:search?.diagnostics.nativeExecutions,milliseconds:search?.rootAndSearchMilliseconds,reuse:search?.continuationReuse,reason:search?.reuseReason};console.log(x);return x;};
 env.loadCheckpoint({...template,coreState:{...template.coreState,compositionEnvelope:a.root,committedState:a.root.committedState},machineAI:{}});
 for(let i=0;i<6;i++) {const r=take('host-prefix-'+i);assert.equal(r.id,row.inputs[i].actionId);}
 const host=env.createCheckpoint();assert.deepEqual(host.coreState.compositionEnvelope,middle);assert(host.machineAI['player-white']);
 results.push(take('host-continuous'));
 for(const [label,machineAI] of [['host checkpoint',host.machineAI],['isolated checkpoint',{'player-white':row.checkpointAtMiddle}],['no checkpoint',{}]]){
  env.loadCheckpoint({...host,machineAI});const before=env.createCheckpoint();assert.deepEqual(before.coreState.compositionEnvelope,middle);assert.deepEqual(before.machineAI,machineAI);results.push(take(label));
 }
 assert.equal(results[0].id,results[1].id);
 fs.writeFileSync(out,JSON.stringify({source,results},null,2)+'\n',{flag:'wx'});
}finally{env.dispose();}
}

'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const zlib = require('node:zlib'), { execFileSync } = require('node:child_process'), Module = require('node:module');
const repo = path.resolve(__dirname, '..');
const at = f => path.resolve(repo, f);
const read = f => JSON.parse(fs.readFileSync(at(f)));
const previous = '7851082fb7b0f39c5cdddf25666a46fc644155c0';
const head = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8',cwd:repo}).trim();
const manifest = 'reports/iteration/free-analyze-random20-funded-planet-20261111/summary-463fc442-20261111.json';
const out = path.resolve(process.argv[2]);
const mode = process.argv[3] || 'screen';
const sample = [2,5,8,11,14,17];
const white = 'player-white';
if (mode === 'before') {
  const rel = 'randomizer/game/ai/decision-search.js', file = at(rel);
  const old = new Module(file, module);
  old.filename = file;
  old.paths = Module._nodeModulePaths(path.dirname(file));
  old._compile(execFileSync('git', ['show', previous+':'+rel], {encoding:'utf8',cwd:repo}), file);
  old.loaded = true;
  require.cache[file] = old;
}
const {createAnalysisPort} = require(at('randomizer/game/ai/analysis-port'));
const {OPTIONS,createSearchAgent} = require(at('randomizer/game/ai/search-agent'));
const {createSimulationRuleComposition} = require(at('randomizer/training/simulation-rule-composition'));
const {buildRuleObservation} = require(at('randomizer/app/rule-observation'));
const {createSeededRandom} = require(at('randomizer/game/random'));
const {passiveAgent} = require(at('tools/research-human405-round1'));
function open(root) {
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
      const {actionId}=passiveAgent(id).decide({legalActions,observation});
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
const catalog = require(at('tools/research-free-analyze-random20'));
const gzip = v => zlib.gzipSync(JSON.stringify(v));
const gunzip = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
function install(p) {
  p.setMovementPlanning(OPTIONS.movementPlanning);
  p.setResourcePlanning(OPTIONS.resourcePlanning);
  p.setCardPickPlanning(OPTIONS.cardPickPlanning);
  p.setDecisionPlanning({finalMarkPlanning:OPTIONS.finalMarkPlanning,scanPlanning:OPTIONS.scanPlanning,rankKnownFossilTraces:false});
}
function condition(m) {
  const p = createAnalysisPort({composition:m.c,seatId:white,maxCacheEntries:0}), before=m.save();
  try {
    install(p);
    const n = p.openRoot(), rp = p.resourceSpec(n);
    if (!rp || rp.bound || rp.cargoCommittedMovement || !rp.plans.length) return null;
    const g = p.goalMovementSpec(n);
    if (!g?.plan || !g.intent?.path.length || g.chosenGoal?.timing !== 'current-turn'
       || !['orbit','land'].includes(g.chosenGoal.kind)
       || rp.plans.some(x=>x.goal.id===g.chosenGoal.id)
       || rp.retainedActionIds.includes(g.selectedActionId)) return null;
    return {goal:g.chosenGoal.id, move:g.selectedActionId, resourceGoals:rp.plans.map(x=>x.goal.id)};
  } finally {p.close();assert.deepEqual(m.save(),before);}
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
if (mode==='screen') {
  const data = {head,previous,manifest,sample,rule:'first two rounds, stable white main decision, legal movement, competing resource plan with a distinct target removes selected funded move',boards:[]};
  function inspect(root){
    const m=open(root);
    try{return condition(m);} finally{m.dispose();}
  }
  const known=gunzip(at('reports/ai-foundation-20261113/prepass-funded-landing/board19-funded-venus-20261113-v1.json.gz')).groups[0].root;
  data.positive={root:known,condition:inspect(known)}; assert(data.positive.condition,'positive control must be detected');
  for (const board of sample) {
    const b=read(manifest).rows.find(x=>x.board===board), record=read('reports/research/'+b.f), saved=read(record.savePath);
    const metadata=catalog.describe({agentType:'search',seed:record.seed,activePlayerCount:4,flags:{scenario:catalog.IDS[1]}},{full:true});
    const env=catalog.createEnvironment({},metadata), hits=[];
    let scanned=0, eligible=0, first, rounds={1:0,2:0};
    try {
      const start=catalog.initialize(env,{seed:record.seed,activePlayerCount:4,compactReplay:true},metadata);
      assert.deepEqual(start.map(x=>x.action.actionId),saved.replaySteps.slice(0,start.length).map(x=>x.action.actionId));
      for(let i=start.length;i<saved.replaySteps.length;i++){
        const round=env.observe(white).publicState.roundNumber;
        if(round>2)break;
        const legal=env.legalActions(), old=saved.replaySteps[i].action, a=legal.find(x=>x.actionId===old.actionId);
        assert(a,board+'/'+i+' '+old.summary);assert.deepEqual(a.target,old.target);
        if(a.actorId===white){scanned++;rounds[round]++;}
        if(a.actorId===white && legal.some(x=>x.phase==='main') && legal.some(x=>x.family==='move'&&Number.isInteger(x.target?.deltaX))){
          const root=env.createCheckpoint().coreState.compositionEnvelope;
          if(!root.session){
            eligible++;
            const hit=inspect(root);
            if(hit){hits.push({i,round,...hit});first??={i,round,root};}
          }
        }
        assert(env.step(a).ok,board+'/'+i);
      }
    }finally{env.dispose();}
    const result={board,record:b.f,baselineScore:b.score,scanned,rounds,eligible,hits,first};
    data.boards.push(result);
    console.log(JSON.stringify({...result,first:first?.i}));
  }
  fs.writeFileSync(out,gzip(data),{flag:'wx'});
} else {
  assert(['before','after'].includes(mode));
  const data=gunzip(path.resolve(process.argv[4])), groups=[];
  if(data.head!==head) {
    execFileSync('git',['diff','--exit-code',data.head,head,'--','randomizer','tools/research-free-analyze-random20.js',
      'tools/research-human405-round1.js'],{cwd:repo});
  }
  for(const b of [...data.boards.filter(b=>b.first),{board:19,first:{root:data.positive.root}}]){
    const root=b.first.root,m=open(root),inputs=[],checkpoints=[],decisions=[],started=performance.now();
    let agentPlan,stop;
    try{
      for(let i=0;i<360;i++){
        if(m.state().turn.gameEnded&&!m.c.inspect().session){stop='terminal';break;}
        if(performance.now()-started>=180000){stop='elapsed-gate';break;}
        if(m.menu()[0]?.actorId!==white){m.advanceOpponents(inputs);continue;}
        const r=q(m,agentPlan);
        decisions.push({action:r.action?.summary,n:r.n,ms:r.ms,v:r.v,complete:r.complete,
          ...(i===0?{roots:r.roots}:{}),error:r.error});
        if(!admissible(r)){stop='decision-gate';break;}
        if(r.action.family==='pass')checkpoints.push([inputs.length,m.save()]);
        inputs.push(m.apply(r.action));agentPlan=r.checkpoint;
      }
      assert(stop);
      const score=stop==='terminal'?m.state().match.finalScores.find(p=>p.playerId===white).totalScore:null;
      const row={name:mode,inputs,checkpoints,decisions,score,end:m.save(),stop,
        peak:[Math.max(...decisions.map(d=>d.n)),Math.max(...decisions.map(d=>d.ms))]};
      groups.push({name:'board '+b.board,root,rows:[row]});
      console.log(JSON.stringify({board:b.board,mode,score,stop,peak:row.peak,first:decisions[0],gate:stop==='decision-gate'?decisions.at(-1):undefined}));
    }finally{m.dispose();}
  }
  fs.writeFileSync(out,gzip({head,previous,mode,groups}),{flag:'wx'});
}

'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const zlib = require('node:zlib'), { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const at = f => path.resolve(repo, f);
const out = path.resolve(process.argv[2]);
const white = 'player-white';
const {createAnalysisPort} = require(at('randomizer/game/ai/analysis-port'));
const {createSearchAgent} = require(at('randomizer/game/ai/search-agent'));
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
const base = JSON.parse(zlib.gunzipSync(fs.readFileSync(at(
  'reports/ai-foundation-20261113/prepass-funded-landing/board19-fixed-landing-20261113-v1.json.gz'
)))).groups[0];
assert.equal(base.root.session,null);
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',cwd:repo}).trim();
const groups=[];
const rootView=root=>{
  const m=open(root);
  try{return {view:m.c.projection({role:'player',playerId:white}).state,menu:m.menu()};}
  finally{m.dispose();}
};
const publicRoot=rootView(base.root);
for(const [first,second] of [[0,3],[0,6],[1,4]]){
  const state=JSON.parse(base.root.committedState), deck=state.cards.drawPileCardIds;
  assert.notEqual(deck[first],deck[second]);
  const swap=[deck[first],deck[second]];
  [deck[first],deck[second]]=[deck[second],deck[first]];
  const root={...base.root,committedState:JSON.stringify(state)},rows=[];
  assert.deepEqual(rootView(root),publicRoot);
  const m=open(root);
  try{
    for(const policy of ['pass','autonomous']){
      assert.equal(m.save().committedState,root.committedState);
      const inputs=[],checkpoints=[],decisions=[],start=performance.now();
      const initial=q(m); assert(admissible(initial));
      if(policy==='pass') inputs.push(m.apply(m.menu().find(a=>a.family==='pass')));
      let plan,stop;
      for(let i=0;i<300;i++){
        if(m.state().turn.gameEnded&&!m.c.inspect().session){stop='terminal';break;}
        if(performance.now()-start>=180000){stop='elapsed-gate';break;}
        if(m.menu()[0]?.actorId!==white){m.advanceOpponents(inputs);continue;}
        const r=q(m,plan);
        decisions.push({action:r.action?.summary,n:r.n,ms:r.ms,v:r.v,complete:r.complete});
        if(!admissible(r)){stop='decision-gate';break;}
        if(r.action.family==='pass') checkpoints.push([inputs.length,m.save()]);
        inputs.push(m.apply(r.action));plan=r.checkpoint;
      }
      assert(stop);
      const score=stop==='terminal'?m.state().match.finalScores.find(x=>x.playerId===white).totalScore:null;
      const peak=[Math.max(initial.n,...decisions.map(x=>x.n)),Math.max(initial.ms,...decisions.map(x=>x.ms))];
      rows.push({name:policy,inputs,checkpoints,end:m.save(),score,stop,peak,
        first:{action:initial.action.summary,n:initial.n,v:initial.v,roots:initial.roots}});
      assert(m.c.lifecycle.restore(root).ok);
      console.log(JSON.stringify({swap,policy,score,stop,peak,first:initial.action.summary,value:initial.v}));
    }
  }finally{m.dispose();}
  groups.push({name:`board19/hidden-deck/${first}/${second}`,root,swap,rows});
  fs.writeFileSync(out+'.checkpoint',zlib.gzipSync(JSON.stringify({source,groups})));
}
fs.renameSync(out+'.checkpoint',out);

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createSearchAgent}=require('../randomizer/game/ai/search-agent');
const [fixture,baseline,out]=process.argv.slice(2);
const read=p=>JSON.parse(fs.readFileSync(p)), sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const f=read(fixture), b=read(baseline), seat=f.seatId, seed=f.source.seed;
assert.deepEqual(b.sourceSha256,sha(fixture));
const make=()=>{
  const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
    projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});
  k.newGame({seed});return k.composition;
};
const save=c=>c.lifecycle.save().envelope;
const state=c=>{const e=save(c);return e.session?.session?.workingState||JSON.parse(e.committedState);};
const options=c=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function submit(c,a){
  assert(a);
  const d=c.inspect().session?.decision;
  const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
    :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(r.ok,JSON.stringify(r));
}
function restore(c,root){assert(c.lifecycle.restore(root).ok);assert.deepEqual(save(c),root);}
function summarize(c){
  const s=state(c),p=s.players.players.find(x=>x.id===seat);
  return {score:p.resources.score,wallet:p.resources,income:p.income,tech:Object.keys(p.techState.ownedTiles),
    data:p.dataState.placedTokens, hand:p.hand.map(x=>[x.id,x.cardId]),
    publicCards:s.cards.publicCards.map(x=>[x.id,x.cardId]),wins:s.data.sectorSettlements.winsByPlayerId[seat],
    probes:s.pieces.rockets.filter(x=>x.playerId===seat),cycle:s.turn.actionCycleNumber,
    projected:c.projection({role:'player',playerId:seat}).state.publicState.players.find(x=>x.playerId===seat).finalScore};
}
const prefix=b.path.slice(0,10);
const graphs={};
function run(name,parentRoot,forceFirst=null,forceSecond=null){
  const c=make(),p=createAnalysisPort({composition:c,seatId:seat});
  let agent=createSearchAgent({seatId:seat,analysisPort:p});
  const path=[], observations={};
  try {
    restore(c,parentRoot);
    let researches=0, done=false;
    for(let i=0;i<48;i++){
      const actions=options(c);
      const d=c.inspect().session?.decision;
      assert.equal(d?.ownerId||state(c).turn.currentPlayerId,seat);
      assert.equal(state(c).turn.roundNumber,3);
      const choice=agent.decide({seatId:seat,legalActions:actions});
      const r=choice.search;
      assert(r.complete&&!r.unresolved.length&&r.diagnostics.nativeExecutions<=256&&r.rootAndSearchMilliseconds<=600,JSON.stringify({i,ms:r.rootAndSearchMilliseconds,n:r.diagnostics.nativeExecutions}));
      let a=actions.find(x=>x.actionId===choice.actionId), forced=false;
      if(i===0){assert.equal(a.family,'research_tech'); graphs[name]=r; observations.beforeResearch=summarize(c);}
      if(a.family==='choose_target'&&a.target.tileId){
        researches++;
        const tile=researches===1?forceFirst:researches===2?forceSecond:null;
        if(tile&&a.target.tileId!==tile){
          const choices=actions.filter(x=>x.target?.tileId===tile);
          a=choices.find(x=>x.target.blueSlot===3)||choices[0];forced=true;
        }
      }
      if(a.family==='choose_card'&&a.target.source==='public'&&path.at(-1)?.target.cardInstanceId==='alien-amiba-7-11'){
        observations.amiba7BeforePublic=summarize(c);
      }
      assert(a);
      if(a.family==='pass'){observations.beforePass=summarize(c);done=true;break;}
      path.push({id:a.actionId,family:a.family,target:a.target,forced,wouldChoose:choice.actionId,native:r.diagnostics.nativeExecutions,ms:r.rootAndSearchMilliseconds,value:r.value});
      submit(c,a);
      if(forced)agent=createSearchAgent({seatId:seat,analysisPort:p});
      if(a.family==='choose_target'&&a.target.tileId)observations['afterResearch'+researches]=summarize(c);
      if(a.family==='complete_task')observations.afterClaim=summarize(c);
      if(a.family==='choose_target'&&a.target.choiceId==='symbol:blue_2')observations.afterAmiba7=summarize(c);
    }
    assert(done,name);
    const tech=path.flatMap(x=>x.family==='choose_target'&&x.target?.tileId?[x.target.tileId]:[]);
    if(forceFirst)assert.equal(tech[0],forceFirst);
    if(forceSecond)assert.equal(tech[1],forceSecond);
    const end=summarize(c),endpoint=save(c), independent=make();
    try {restore(independent,parentRoot);for(const x of path)submit(independent,options(independent).find(a=>a.actionId===x.id));assert.deepEqual(save(independent),endpoint);}
    finally {independent.dispose();}
    restore(c,parentRoot);
    return {name,path,observations,end,endpoint,independentReplay:true};
  }finally{p.close();c.dispose();}
}
const prefixComp=make();
let root;
try {restore(prefixComp,f.compositionEnvelope);for(const x of prefix)submit(prefixComp,options(prefixComp).find(a=>a.actionId===x.action));root=save(prefixComp);restore(prefixComp,f.compositionEnvelope);}
finally{prefixComp.dispose();}
const rows=process.env.SETI_RESEARCH_PAIR==='blue4'
  ?[run('blue4-then-purple1',root,'blue4','purple1'),run('purple1-then-blue4',root,'purple1','blue4')]
  :[run('blue1-then-purple1',root,null,'purple1'),run('purple1-then-blue1',root,'purple1','blue1')];
if(out)fs.writeFileSync(out,JSON.stringify({fixture,fixtureSha256:sha(fixture),baseline,baselineSha256:sha(baseline),root,prefix,rows,graphs,fullAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(x=>({name:x.name,score:x.end.score,projected:x.end.projected,tech:x.end.tech,data:x.end.data,hand:x.end.hand,probes:x.end.probes.length,observations:x.observations,peakNative:Math.max(...x.path.map(y=>y.native)),peakMs:Math.max(...x.path.map(y=>y.ms))}))));

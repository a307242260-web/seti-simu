'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createSearchAgent}=require('../randomizer/game/ai/search-agent');
const [fixture,out]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),seed=f.source.seed,seat=f.seatId;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function make(){const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k.composition;}
const save=c=>c.lifecycle.save().envelope,restore=(c,e)=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(c),e);};
const state=c=>{const e=save(c);return e.session?.session?.workingState||JSON.parse(e.committedState);};
const own=c=>state(c).players.players.find(x=>x.id===seat);
const menu=c=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function apply(c,a){const d=c.inspect().session?.decision;assert(a&&a.actorId===seat);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:seat,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
function run(mode){const c=make(),port=createAnalysisPort({composition:c,seatId:seat});let ai=createSearchAgent({analysisPort:port,seatId:seat});
 const path=[];try{restore(c,f.compositionEnvelope);
  const start=state(c).turn.turnNumber;let pass=false;
  for(let i=0;i<75;i++){
   const actions=menu(c),turn=state(c).turn,actor=c.inspect().session?.decision?.ownerId||turn.currentPlayerId;
   assert.equal(actor,seat);assert.equal(turn.roundNumber,3);
   const {actionId,search}=ai.decide({seatId:seat,legalActions:actions});
   assert(search.complete&&!search.unresolved.length&&search.diagnostics.nativeExecutions<=256&&search.rootAndSearchMilliseconds<=600);
   let a=actions.find(a=>a.actionId===actionId);
   const alternatives=search.roots.map(x=>[x.actionId,x.value,x.goal?.id]);
   if(i===0)a=actions.find(x=>x.family==='play_card'&&x.target?.cardInstanceId==='alien-amiba-0-1');
   if(mode!=='first-only'&&turn.turnNumber===start+1){
    if(!own(c).mainActionCompleted&&actions.some(x=>x.family==='play_card'&&x.target?.cardInstanceId==='alien-amiba-3-3'))
      a=actions.find(x=>x.family==='play_card'&&x.target?.cardInstanceId==='alien-amiba-3-3');
    if(actions.some(x=>x.target?.choiceId==='trace:yellow:1'))a=actions.find(x=>x.target?.choiceId==='trace:yellow:1');
   }
   if(mode==='also-analyze'&&turn.turnNumber===start+2){
    const fixed=actions.find(x=>['trace:1:blue:amiba:4','amiba:display:7'].includes(x.target?.choiceId))
      ||actions.find(x=>x.family==='choose_target'&&x.target?.target==='computer');
    if(fixed)a=fixed;
    else if(!own(c).mainActionCompleted){
     const count=own(c).dataState.placedTokens.filter(x=>x.placementKind==='computer').length;
     const next=actions.find(x=>x.family===(count<6?'place_data':'analyze'));
     assert(next);a=next;
    }
   }
   assert(a);if(a.family==='pass'){pass=true;break;}
   const forced=a.actionId!==actionId;
   path.push({id:a.actionId,summary:a.summary,target:a.target,family:a.family,cycle:turn.actionCycleNumber,forced,
    selected:actionId,selectedSummary:actions.find(x=>x.actionId===actionId).summary,alternatives,native:search.diagnostics.nativeExecutions,ms:search.rootAndSearchMilliseconds});
   apply(c,a);if(forced)ai=createSearchAgent({analysisPort:port,seatId:seat});
  }
  assert(pass);const endpoint=save(c),s=state(c),p=own(c),v=c.projection({role:'player',playerId:seat}).state, independent=make();
  try{restore(independent,f.compositionEnvelope);for(const x of path){const a=menu(independent).find(y=>y.actionId===x.id);assert.deepEqual(a?.target,x.target);apply(independent,a);}assert.deepEqual(save(independent),endpoint);}finally{independent.dispose();}
  restore(c,f.compositionEnvelope);
  return {mode,path,endpoint,end:{wallet:p.resources,income:p.income,tech:p.techState,data:p.dataState,hand:p.hand.map(x=>x.cardId),
    probes:s.pieces.rockets.filter(x=>x.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],
    projected:v.publicState.players.find(x=>x.playerId===seat).finalScore},independentReplay:true};
 }finally{port.close();c.dispose();}}
const modes=process.env.SETI_MODES?.split(',')||['first-only','also-yellow','also-analyze'];
const rows=modes.map(run);assert(rows.every(r=>r.path[0].forced));
if(out)fs.writeFileSync(out,JSON.stringify({fixture,fixtureSha256:sha(fixture),rows,newAutonomousFirst3Runs:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(r=>({mode:r.mode,score:r.end.wallet.score,tech:Object.keys(r.end.tech.ownedTiles).length,income:r.end.income,
  probes:r.end.probes.length,projected:r.end.projected,first:r.path.slice(0,9).map(x=>[x.cycle,x.summary,x.selectedSummary,x.forced]),maxNative:Math.max(...r.path.map(x=>x.native)),maxMs:Math.max(...r.path.map(x=>x.ms))}))));

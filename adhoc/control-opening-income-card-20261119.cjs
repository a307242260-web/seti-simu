'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const load=n=>JSON.parse(fs.readFileSync(path.join(dir,n)));
const pre=load('v486-random20-runtime-preflight-20261119-v1.json'),rt=pre.runtime;
const resume=process.argv[2]==='--resume-endpoint-observation';
const out=path.join(dir,`opening-policy-board20-native-20261119-v${resume?2:1}.json`);assert(!fs.existsSync(out));
const archive=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,'reports/iteration/v486-original20-20261119/board-20-replay-20261119-v1.json.gz'))));
const trace=JSON.parse(fs.readFileSync(path.join(rt,'reports/research/3a4edb37.94299f38.full.json.decisions.jsonl'),'utf8').split('\n')[0]);
const ordered=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordered):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(ordered(x))).digest('hex');
for(const [f,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,f))),h,f);
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {createSearchAgent}=require(path.join(rt,'randomizer/game/ai/search-agent'));
const {createStateValueEvaluator}=require(path.join(rt,'randomizer/game/ai/state-value'));
const demand=require(path.join(rt,'randomizer/game/ai/resource-demand')),cards=require(path.join(rt,'randomizer/game/cards/deck'));
const seed=archive.seed,random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const report=resume?load('opening-policy-board20-native-20261119-v1.json'):{schemaVersion:'seti-native-opening-income-control-v1',sourceCommit:pre.sourceCommit,sourcePreflight:'reports/ai-foundation-20261119/v486-random20-runtime-preflight-20261119-v1.json',
 seed,status:'running',scope:'Hold company, initial cards, both starting income types and all other seats fixed. Replace only which energy card white tucks, then compare the first own turn.',
 limits:{maximumCommittedInputs:160,nativeInputsPerDecision:256,millisecondsPerDecision:600,maximumOwnTurnInputs:24},newFullGames:0,prefix:[],branches:[]};
const resumedBaseline=resume?JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'opening-policy-board20-baseline-checkpoint-20261119-v1.json.gz')))):null;
if(resume){report.priorFailure=report.failure;delete report.failure;report.status='running';report.repeatedSetupInputsForRootRngVerification=6;}
const persist=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');persist();
function envelope(){return c.lifecycle.save().envelope;}
function state(){const e=envelope();return e.session?.session?.workingState||JSON.parse(e.committedState);}
function player(){return state().players.players.find(p=>p.id==='player-white');}
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(want){
 const a=legal().find(a=>a.actionId===want.actionId&&a.actorId===want.actorId&&a.family===want.family&&hash(a.target||{})===hash(want.target||{}));assert(a,'Native action unavailable '+JSON.stringify(want));
 const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(result.ok,JSON.stringify(result));return a;
}
function observe(){
 if(legal().some(a=>a.actorId!=='player-white')){
  const observation=buildRuleObservation(state(),seed,'player-white');
  return {observation,legalActions:legal(),value:createStateValueEvaluator('player-white').details(observation)};
 }
 const port=createAnalysisPort({composition:c,seatId:'player-white',maxCacheEntries:0});
 try{const root=port.openRoot();return {observation:root.observation,legalActions:root.legalActions,value:createStateValueEvaluator('player-white').details(root.observation)};}finally{port.close();}
}
function keep(name,branch){fs.writeFileSync(path.join(dir,`opening-policy-board20-${name}-checkpoint-20261119-v1.json.gz`),zlib.gzipSync(JSON.stringify({envelope:envelope(),branch})));}
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});c.inputPort.beginDrain({metadata:{source:'research-archive'}});
 if(resume){assert(c.lifecycle.restore(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'opening-policy-board20-prefix-checkpoint-20261119-v1.json.gz')))).envelope).ok);}
 else for(let i=0;i<17;i++){report.prefix.push(submit(archive.actions[i].action));keep('prefix',report.prefix);persist();}
 const before=envelope(),initial=player();report.menu=legal();report.hand=initial.hand;
 report.incomeRanks=initial.hand.map(card=>({cardId:card.cardId,price:card.price,income:cards.getIncomeGainForCard(card),value:demand.incomeCardValue(state(),'player-white',card)}));persist();
 let baselinePublic,baselineRng;
 if(resume)report.branches=[];
 for(const name of ['baseline','retain-purple-card']){
  assert(c.lifecycle.restore(before).ok);assert.deepEqual(envelope(),before);
  const branch={name,setupInputs:[],turnInputs:[],searches:[]};report.branches.push(branch);persist();
  if(name==='baseline'){
   for(let i=17;i<23;i++){branch.setupInputs.push(submit(archive.actions[i].action));if(!resume)keep(name,branch);persist();}
  }else{
   const income=id=>{const a=legal().find(a=>a.family==='choose_payment'&&a.target?.kind==='discard-hand-cards'&&a.target.cardIds?.[0]===id);assert(a,'income card unavailable '+id);return a;};
   branch.setupInputs.push(submit(income('dlc_29.png')));keep(name,branch);persist();
   branch.setupInputs.push(submit(income('b_136.webp')));keep(name,branch);persist();
   for(let i=19;i<23;i++){branch.setupInputs.push(submit(archive.actions[i].action));keep(name,branch);persist();}
  }
  branch.start=observe();const e=envelope();
  if(name==='baseline'){
   assert.deepEqual(branch.start.observation.publicState,trace.context.observation.publicState);
   assert.deepEqual(branch.start.observation.selfState,trace.context.observation.selfState);
   baselinePublic=branch.start.observation.publicState;baselineRng=JSON.parse(e.committedState).meta.rngState;branch.recordedRootExact=true;
   if(resume){assert(c.lifecycle.restore(resumedBaseline.envelope).ok);branch.turnInputs=resumedBaseline.branch.turnInputs;}
   else{
    const end=archive.actions.findIndex((x,i)=>i>=23&&x.action.actorId==='player-white'&&x.action.family==='end_turn');assert(end>=23);
    for(let i=23;i<=end;i++){assert.equal(archive.actions[i].action.actorId,'player-white');branch.turnInputs.push(submit(archive.actions[i].action));keep(name,branch);persist();}
   }
  }else{
   assert.deepEqual(branch.start.observation.publicState,baselinePublic,'income allocation or public root changed');
   assert.deepEqual(JSON.parse(e.committedState).meta.rngState,baselineRng,'same-income replacement changed RNG');
   branch.sameInitialPublicFactsAndRng=true;
   const port=createAnalysisPort({composition:c,seatId:'player-white'}),agent=createSearchAgent({seatId:'player-white',analysisPort:port});
   try{
    for(let i=0;i<24;i++){
     const actions=legal(),root=envelope();assert(actions.length&&actions.every(a=>a.actorId==='player-white'));
     const selected=agent.decide({seatId:'player-white',legalActions:actions});assert.deepEqual(envelope(),root,'search changed canonical root/RNG');
     const s=selected.search,a=actions.find(a=>a.actionId===selected.actionId);assert(a);
     branch.searches.push({action:a,value:s.value,complete:s.complete,nativeInputs:s.diagnostics.nativeExecutions,milliseconds:s.rootAndSearchMilliseconds,roots:s.roots});persist();
     assert(s.complete&&s.diagnostics.nativeExecutions<=256&&s.rootAndSearchMilliseconds<=600,'single-point gate failed before selected input');
     branch.turnInputs.push(submit(a));keep(name,branch);persist();
     if(a.family==='end_turn'){branch.closedOwnTurn=true;break;}
    }
    assert(branch.closedOwnTurn,'own-turn witness limit reached');
   }finally{port.close();}
  }
  branch.end=observe();branch.finalEnvelopeSha256=hash(envelope());keep(name,branch);persist();
 }
 report.status='complete';report.acceptedInputs=report.prefix.length+report.branches.reduce((n,b)=>n+b.setupInputs.length+b.turnInputs.length,0);
 assert(report.acceptedInputs<=160);persist();
 console.log(JSON.stringify({status:report.status,acceptedInputs:report.acceptedInputs,incomeRanks:report.incomeRanks,
  branches:report.branches.map(b=>({name:b.name,firstAction:b.turnInputs[0]?.summary,turnInputs:b.turnInputs.length,searches:b.searches.map(s=>({v:s.value,n:s.nativeInputs,ms:s.milliseconds})),self:b.end?.observation.selfState,player:b.end?.observation.publicState.players.find(p=>p.playerId==='player-white')}))}));
}catch(e){report.status='failed';report.failure={message:e.message,stack:e.stack};persist();console.error(e.stack);process.exitCode=1;}
finally{c.dispose();}

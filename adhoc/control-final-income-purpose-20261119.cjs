'use strict';
// Keep the known landing card for one funded landing, then resume v486.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const pre=JSON.parse(fs.readFileSync(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json'))),rt=pre.runtime;
const out=path.join(dir,'terminal-choice-board08-preserve-card-20261119-v1.json');assert(!fs.existsSync(out));
const root=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'terminal-choice-board08-before-task-20261119-v1.json.gz')))).envelope;
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {createSearchAgent}=require(path.join(rt,'randomizer/game/ai/search-agent'));
const {passiveAgent}=require(path.join(rt,'tools/research-human405-round1'));
const seed=JSON.parse(root.committedState).meta.seed,random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const report={schemaVersion:'seti-native-terminal-income-purpose-control-v1',sourceCommit:pre.sourceCommit,seed,status:'running',baselineFinalScore:132,
 plan:'Skip the income task until the sole held land card is played; fund its known three-movement route with two credit-energy conversions; land on Venus; resume unchanged v486.',
 actions:[],decisions:[],maxNative:0,maxMilliseconds:0,newFullGames:0,limits:{maximumAcceptedInputs:100,nativePerDecision:256,millisecondsPerDecision:600,wallMilliseconds:15000}};
const persist=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');persist();
function env(){return c.lifecycle.save().envelope;}
function state(){const e=env();return e.session?.session?.workingState||JSON.parse(e.committedState);}
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(a,label){assert(a,'planned action unavailable '+label);const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));report.actions.push({label,action:a});
 fs.writeFileSync(path.join(dir,'terminal-choice-board08-preserve-checkpoint-20261119-v1.json.gz'),zlib.gzipSync(JSON.stringify({envelope:env(),inputs:report.actions.length})));persist();}
function select(label,predicate){const xs=legal().filter(predicate);assert.equal(xs.length,1,label+' '+JSON.stringify(legal().map(a=>({f:a.family,t:a.target}))));submit(xs[0],label);}
function passive(){const actions=legal(),actor=actions[0].actorId,port=createAnalysisPort({composition:c,seatId:actor,maxCacheEntries:0});
 try{const chosen=passiveAgent(actor).decide({seatId:actor,legalActions:actions,observation:port.openRoot().observation});submit(actions.find(a=>a.actionId===chosen.actionId),'passive seat');}finally{port.close();}}
const port=createAnalysisPort({composition:c,seatId:'player-white'}),agent=createSearchAgent({seatId:'player-white',analysisPort:port});
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(root).ok);assert.deepEqual(env(),root);
 select('end without direct income task',a=>a.family==='end_turn');
 for(let i=0;i<20;i++){
  const actions=legal(),actor=actions[0].actorId;
  if(actor!=='player-white'){passive();continue;}
  if(actions.some(a=>a.target?.choiceId==='final:d')){select('same final mark D',a=>a.target?.choiceId==='final:d');continue;}
  if(actions.some(a=>a.target?.choiceId?.startsWith('skip:task:'))){select('skip the automatic income task',a=>a.target?.choiceId==='skip:task:card-27-pass-2-3:b103-score-task');continue;}
  assert(!state().players.players.find(p=>p.id==='player-white').mainActionCompleted);break;
 }
 for(let i=0;i<2;i++)select('fund three movement and preserve the2-credit card payment',a=>a.family==='quick_trade'&&a.target?.tradeId==='credits-for-energy');
 for(let i=0;i<2;i++){
  select('known Venus route',a=>a.family==='move'&&a.target?.rocketId===4&&a.target.deltaX===-1&&a.target.deltaY===0);
  select('energy movement payment',a=>a.family==='choose_payment'&&a.target?.kind==='move-payment'&&a.target.choiceId==='energy');
 }
 select('play the protected landing card',a=>a.family==='play_card'&&a.target?.cardInstanceId==='card-56-0');
 if(legal().some(a=>a.target?.planetId==='venus'))select('same Venus endpoint',a=>a.family==='choose_target'&&a.target?.planetId==='venus'&&!a.target?.satelliteId);
 if(legal().some(a=>a.target?.choiceId==='trace:1:yellow'))select('same yellow trace',a=>a.target?.choiceId==='trace:1:yellow');
 report.protectedLandingCompleted=true;persist();
 const started=performance.now();
 while(!state().turn.gameEnded){
  assert(report.actions.length<100&&performance.now()-started<15000,'control limit reached');const actions=legal(),actor=actions[0]?.actorId;
  if(actor!=='player-white'){passive();continue;}
  const before=env(),selected=agent.decide({seatId:'player-white',legalActions:actions});assert.deepEqual(env(),before);const s=selected.search,a=actions.find(a=>a.actionId===selected.actionId);assert(a);
  const row={action:a,value:s.value,complete:s.complete,nativeInputs:s.diagnostics.nativeExecutions,milliseconds:s.rootAndSearchMilliseconds};report.decisions.push(row);report.maxNative=Math.max(report.maxNative,row.nativeInputs);report.maxMilliseconds=Math.max(report.maxMilliseconds,row.milliseconds);persist();
  assert(row.complete&&row.nativeInputs<=256&&row.milliseconds<=600,'single-point gate failed before input');submit(a,'unchanged v486');
 }
 const p=state().players.players.find(p=>p.id==='player-white');report.finalScore=p.finalScore;report.finalScoreBreakdown=p.finalScoreBreakdown;report.status='complete';persist();console.log(JSON.stringify({status:report.status,score:report.finalScore,baseline:132,inputs:report.actions.length,maxNative:report.maxNative,maxMilliseconds:report.maxMilliseconds,actions:report.actions.map(x=>x.action.summary)}));
}catch(e){report.status='failed';report.failure={message:e.message,stack:e.stack};persist();console.error(e.stack);process.exitCode=1;}
finally{port.close();c.dispose();}

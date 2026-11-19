'use strict';
// One final-round control: delay a task claim instead of consuming the held land card.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const load=n=>JSON.parse(fs.readFileSync(n));
const pre=load(path.join(dir,'terminal-choice-candidate-preflight-20261119-v1.json')),rt=pre.runtime;
const resume=false;
const out=path.join(dir,'terminal-choice-candidate-auto-20261119-v1.json');assert(!fs.existsSync(out),'reuse this control');
for(const [f,h]of Object.entries(pre.sourceFiles))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(rt,f))).digest('hex'),pre.changedFiles[f]||h,f);
const savedRoot=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'terminal-choice-board08-before-task-20261119-v1.json.gz'))));
const trace={context:savedRoot.context},target={step:152},archive={seed:JSON.parse(savedRoot.envelope.committedState).meta.seed};
const record={rounds:[null,null,{checkpointPath:'native-control-before-input152'}]};
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {createSearchAgent}=require(path.join(rt,'randomizer/game/ai/search-agent'));
const {passiveAgent}=require(path.join(rt,'tools/research-human405-round1'));
const seed=archive.seed,random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const report=resume?load(path.join(dir,'terminal-choice-board08-task-control-20261119-v1.json')):{schemaVersion:'seti-native-terminal-task-control-v1',sourceCommit:pre.sourceCommit,seed,status:'running',beforeInput:target.step,
 baselineFinalScore:132,checkpointPath:record.rounds[2].checkpointPath,prefixInputs:[],forcedInputs:[],acceptedInputs:[],decisions:[],
 limits:{maximumCommittedInputs:100,maximumDecisionNative:256,maximumDecisionMilliseconds:600,wallMilliseconds:15000},maxNative:0,maxMilliseconds:0,newFullGames:0};
if(resume){report.priorFailure=report.failure;delete report.failure;report.status='running';report.resumedAcceptedPrefixWithoutRepetition=true;report.resumeWithoutAgentCache=true;}
const persist=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');persist();
function env(){return c.lifecycle.save().envelope;}
function state(){const e=env();return e.session?.session?.workingState||JSON.parse(e.committedState);}
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(a,bucket){
 const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));bucket.push(a);
 fs.writeFileSync(path.join(dir,'terminal-choice-candidate-auto-checkpoint-20261119-v1.json.gz'),zlib.gzipSync(JSON.stringify({envelope:env(),prefixInputs:report.prefixInputs.length,forcedInputs:report.forcedInputs.length,acceptedInputs:report.acceptedInputs.length})));persist();
}
const port=createAnalysisPort({composition:c,seatId:'player-white'}),agent=createSearchAgent({seatId:'player-white',analysisPort:port});
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});
 if(resume){const cp=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'terminal-choice-candidate-auto-checkpoint-20261119-v1.json.gz'))));assert.equal(cp.acceptedInputs,report.acceptedInputs.length);assert(c.lifecycle.restore(cp.envelope).ok);}
 else{assert(c.lifecycle.restore(savedRoot.envelope).ok);assert.deepEqual(env(),savedRoot.envelope);report.rootVerified=true;persist();}
 const started=performance.now();
 while(!state().turn.gameEnded){
  assert(report.acceptedInputs.length+report.prefixInputs.length+report.forcedInputs.length<100&&performance.now()-started<15000,'control limit reached');
  const actions=legal(),actor=actions[0]?.actorId;assert(actions.length&&actions.every(a=>a.actorId===actor));
  const before=env();let selected;
  if(actor==='player-white')selected=agent.decide({seatId:'player-white',legalActions:actions});
  else{const other=createAnalysisPort({composition:c,seatId:actor,maxCacheEntries:0});try{selected=passiveAgent(actor).decide({seatId:actor,legalActions:actions,observation:other.openRoot().observation});}finally{other.close();}}
  assert.deepEqual(env(),before,'search changed root/RNG');
  const a=actions.find(a=>a.actionId===selected.actionId);assert(a);const s=selected.search;
  const row={action:a,value:s?.value,complete:s?.complete??true,nativeInputs:s?.diagnostics.nativeExecutions||0,milliseconds:s?.rootAndSearchMilliseconds||0,roots:s?.roots};
  report.decisions.push(row);report.maxNative=Math.max(report.maxNative,row.nativeInputs);report.maxMilliseconds=Math.max(report.maxMilliseconds,row.milliseconds);persist();
  assert(row.complete&&row.nativeInputs<=256&&row.milliseconds<=600,'single-point gate failed before input');
  submit(a,report.acceptedInputs);
 }
 const p=state().players.players.find(p=>p.id==='player-white');report.finalScore=p.finalScore;report.finalScoreBreakdown=p.finalScoreBreakdown;
 report.status='complete';report.wallMilliseconds=performance.now()-started;persist();console.log(JSON.stringify({status:report.status,score:report.finalScore,baseline:132,
  maxNative:report.maxNative,maxMilliseconds:report.maxMilliseconds,acceptedInputs:report.acceptedInputs.length,actions:report.acceptedInputs.map(a=>a.summary)}));
}catch(e){report.status='failed';report.failure={message:e.message,stack:e.stack};persist();console.error(e.stack);process.exitCode=1;}
finally{port.close();c.dispose();}

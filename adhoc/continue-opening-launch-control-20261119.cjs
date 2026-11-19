'use strict';
// A bounded Native counterfactual continuation; the existing baseline is reused.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const read=p=>JSON.parse(fs.readFileSync(p));
const preflight=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json')),rt=preflight.runtime;
const targetRound=1;
const rootFile=path.join(dir,'opening-policy-board20-forced-launch-root-20261119-v1.json.gz');
const saved=JSON.parse(zlib.gunzipSync(fs.readFileSync(rootFile))),start=saved.envelope;
const out=path.join(dir,'opening-policy-board20-forced-launch-round1-20261119-v1.json');
assert(!fs.existsSync(out),'do not repeat the same Native control');
const ordered=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordered):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const digest=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(ordered(x))).digest('hex');
for(const [f,h]of Object.entries(preflight.sourceFiles))assert.equal(digest(fs.readFileSync(path.join(rt,f))),h,f);
const report={schemaVersion:'seti-native-opening-continuation-v1',sourceCommit:preflight.sourceCommit,
 inputFingerprint:digest({sourceFiles:preflight.sourceFiles,rootSha256:digest(fs.readFileSync(rootFile)),boundary:`round${targetRound}-before-pass`}),
 sourceRoot:rootFile,sourceRootSha256:digest(fs.readFileSync(rootFile)),status:'running',
 scope:`Only the retained-purple-card opening with the first launch forced, unchanged v486 policy to round${targetRound} before PASS. Baseline is the existing board20 record.`,
 limits:{nativeInputsPerSearch:256,millisecondsPerSearch:600,maximumCommittedInputs:80,wallMilliseconds:15000},
 decisions:[],inputs:0,maxNative:0,maxMilliseconds:0,newFullGames:0};
const persist=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');persist();
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {createSearchAgent}=require(path.join(rt,'randomizer/game/ai/search-agent'));
const {passiveAgent}=require(path.join(rt,'tools/research-human405-round1'));
const seed=JSON.parse(start.committedState).meta.seed,random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const port=createAnalysisPort({composition:c,seatId:'player-white'}),agent=createSearchAgent({seatId:'player-white',analysisPort:port});
function state(){const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);}
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(start).ok);assert.deepEqual(c.lifecycle.save().envelope,start);
 if(saved.machineAI)agent.loadCheckpoint(saved.machineAI);
 const started=performance.now();
 while(true){
  assert(report.inputs<80&&performance.now()-started<15000,'Native control safety limit');
  const s=state();assert(s.turn.roundNumber<=targetRound,'common boundary missed');
  const actions=legal(),actor=actions[0]?.actorId;assert(actions.length&&actions.every(a=>a.actorId===actor));
  const before=c.lifecycle.save().envelope;
  let selected;
  if(actor==='player-white')selected=agent.decide({seatId:actor,legalActions:actions});
  else{
   const otherPort=createAnalysisPort({composition:c,seatId:actor,maxCacheEntries:0});
   try{selected=passiveAgent(actor).decide({seatId:actor,legalActions:actions,observation:otherPort.openRoot().observation});}finally{otherPort.close();}
  }
  assert.deepEqual(c.lifecycle.save().envelope,before,'search changed Native root/RNG');
  const search=selected.search,action=actions.find(a=>a.actionId===selected.actionId);assert(action);
  report.maxNative=Math.max(report.maxNative,search?.diagnostics.nativeExecutions||0);report.maxMilliseconds=Math.max(report.maxMilliseconds,search?.rootAndSearchMilliseconds||0);
  const row={input:report.inputs+1,action,reasonCode:selected.reasonCode,value:search?.value,complete:search?.complete,
   nativeInputs:search?.diagnostics.nativeExecutions||0,milliseconds:search?.rootAndSearchMilliseconds||0,
   assets:{resources:s.players.players.find(p=>p.id==='player-white').resources,income:s.players.players.find(p=>p.id==='player-white').income}};
  report.decisions.push(row);persist();
  assert((!search||search.complete)&&row.nativeInputs<=256&&row.milliseconds<=600,'single-point gate failed; do not commit selected action');
  if(actor==='player-white'&&action.family==='pass'&&s.turn.roundNumber===targetRound){
   const p=s.players.players.find(p=>p.id==='player-white');
   report.boundary={round:targetRound,phase:'before-pass-card-and-income',resources:p.resources,income:p.income,techState:p.techState,
    hand:p.hand,dataState:p.dataState,rockets:s.pieces.rockets.filter(r=>r.playerId==='player-white'||r.playerColor==='white'),aliens:s.aliens};
   report.status='complete';report.wallMilliseconds=performance.now()-started;persist();break;
  }
  const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action})
   :action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
  assert(result.ok,JSON.stringify(result));report.inputs++;
  fs.writeFileSync(path.join(dir,'opening-policy-board20-forced-launch-round1-checkpoint-20261119-v1.json.gz'),zlib.gzipSync(JSON.stringify({input:report.inputs,envelope:c.lifecycle.save().envelope,machineAI:agent.createCheckpoint()})));
  persist();
 }
 console.log(JSON.stringify({status:report.status,inputs:report.inputs,maxNative:report.maxNative,maxMilliseconds:report.maxMilliseconds,boundary:report.boundary,actions:report.decisions.map(d=>d.action.summary)}));
}catch(e){report.status='failed';report.failure={message:e.message,stack:e.stack};persist();console.error(e.stack);process.exitCode=1;}
finally{port.close();c.dispose();}

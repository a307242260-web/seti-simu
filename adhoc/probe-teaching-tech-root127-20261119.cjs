'use strict';
// Reuse the verified teacher R3 root and only reconstruct the known prefix.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p));
const pre=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const base=path.join(repo,'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1');
const source=path.join(base,'teacher-r3-decision-audit-87f4c-20261118-v1.json.gz');
const audit=JSON.parse(zlib.gunzipSync(fs.readFileSync(source)));
assert(audit.teacherReplayExact);
const proof=read(path.join(base,'teacher-current-legal-reference-proof-20261118-v1.json'));
const save=read(path.join(repo,'seti-saves/seti-save-teacher-current-legal-reference-384-20261118-v1.json'));
const output=path.join(dir,'teaching-tech-root127-probe-20261119-v1.json');assert(!fs.existsSync(output));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {searchDecision}=require(path.join(rt,'randomizer/game/ai/decision-search'));
const value=require(path.join(rt,'randomizer/game/ai/state-value')),agent=require(path.join(rt,'randomizer/game/ai/search-agent'));
const random=createSeededRandom(proof.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:proof.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,proof.seed,v?.playerId)});
const report={schemaVersion:'seti-teaching-tech-root-probe-v1',sourceCommit:pre.sourceCommit,seed:proof.seed,status:'running',
 sourceRootArchive:path.relative(repo,source),sourceRootArchiveSha256:hash(fs.readFileSync(source)),sourceFilesVerified:Object.keys(pre.sourceFiles).length,
 nativeInputs:0,newAISearches:0,newFullGames:0,prefix:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const envelope=()=>c.lifecycle.save().envelope;
const same=(a,b)=>JSON.stringify(a||{})===JSON.stringify(b||{});
try{
 c.lifecycle.newGame({seed:proof.seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(audit.root).ok);assert.deepEqual(envelope(),audit.root);
 for(let step=113;step<=126;step++){
  const desired=save.replaySteps[step-1].action;if(desired.actorId!==seat)assert(desired.family==='pass'||desired.phase==='conditional');
  const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
  const actions=d?d.choices:c.inputPort.enumerateActions({});
  const action=actions.find(a=>a.actorId===desired.actorId&&a.family===desired.family&&same(a.target,desired.target));assert(action,'Teacher input unavailable: '+step);
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
  assert(result.ok,JSON.stringify(result));report.nativeInputs++;report.prefix.push(action);persist();
 }
 const before=envelope();
 report.rootPath='reports/ai-foundation-20261119/teaching-tech-root127-20261119-v1.json.gz';
 fs.writeFileSync(path.join(repo,report.rootPath),zlib.gzipSync(JSON.stringify({envelope:before})));
 const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  const started=performance.now(),root=port.openRoot();report.rootObservation=root.observation;
  const expected=audit.rows.find(r=>r.step===127).facts,p=root.observation.publicState.players.find(p=>p.playerId===seat);
  for(const k of ['credits','energy','publicity','availableData','score'])assert.equal(p[k],expected.wallet[k],k);
  assert.deepEqual(p.techState,expected.tech);
  report.teacherRootFactsMatch=true;
  const evaluate=value.createStateValueEvaluator(seat);report.newAISearches++;persist();
  const result=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}});
  report.search=result;report.cold={complete:result.complete,actionId:result.actionId,value:result.value,nativeInputs:result.diagnostics.nativeExecutions,milliseconds:performance.now()-started};
  assert.deepEqual(envelope(),before);report.cold.rootAndRngUnchanged=true;
  report.cold.gatePassed=result.complete&&report.cold.nativeInputs<=256&&report.cold.milliseconds<=600;
  report.status=report.cold.gatePassed?'complete':'single-point-gate-failed';persist();
 }finally{port.close();}
 console.log(JSON.stringify({status:report.status,nativeInputs:report.nativeInputs,cold:report.cold,roots:report.search.roots}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{c.dispose();}

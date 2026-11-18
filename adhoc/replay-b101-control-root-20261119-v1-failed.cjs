'use strict';
// Restore a signed Native checkpoint and replay only the30 recorded inputs to160.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const repo=path.resolve(__dirname,'..'),outdir=path.join(repo,'reports/ai-foundation-20261119');
const manifest=JSON.parse(fs.readFileSync(path.join(outdir,'r3-b101-native-control-preflight-20261119-v1.json'))),runtime=manifest.runtime;
const output=path.join(outdir,'r3-b101-native-root-20261119-v1.json'),events=path.join(outdir,'r3-b101-native-prefix-20261119-v1.jsonl'),rootFile=path.join(outdir,'r3-b101-before-input160-native-20261119-v1.json.gz');
assert(!fs.existsSync(output)&&!fs.existsSync(events)&&!fs.existsSync(rootFile),'reuse existing prefix evidence');
const load=p=>JSON.parse(fs.readFileSync(path.join(runtime,p))),cp=load(manifest.checkpointPath),save=load(manifest.savePath),case160=JSON.parse(fs.readFileSync(manifest.casePath));
const ordered=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordered):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const digest=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(ordered(x))).digest('hex');
const {createSeededRandom}=require(path.join(runtime,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(runtime,'randomizer/training/simulation-rule-composition'));
const {createAnalysisPort}=require(path.join(runtime,'randomizer/game/ai/analysis-port'));
const seed='seti-free-analyze-v1',random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const kernel=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true});const comp=kernel.composition;
const report={sourceCommit:manifest.sourceCommit,checkpointPath:manifest.checkpointPath,checkpointSha256:manifest.dependencies[manifest.checkpointPath].sha256,checkpointCursor:129,targetBeforeInput:160,prefixInputs:0,aiSearches:0,phase:'restoring'};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
function legal(){const inspect=comp.inspect();return inspect.phase==='awaiting_input'?inspect.session.decision.choices:comp.inputPort.enumerateActions({});}
function submit(want,index){const choices=legal(),chosen=choices.find(a=>a.actionId===want.actionId&&a.family===want.family&&a.actorId===want.actorId&&digest(a.target||{})===digest(want.target||{}));assert(chosen,'recorded input unavailable '+index+' '+want.actionId);const inspect=comp.inspect(),d=inspect.phase==='awaiting_input'?inspect.session.decision:null;const result=d?comp.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:chosen}):chosen.phase==='quick'?comp.inputPort.submitQuickAction(chosen):comp.inputPort.submitAction(chosen);assert(result.ok,'Native input rejected '+index+' '+JSON.stringify(result));const envelope=comp.lifecycle.save().envelope,state=JSON.parse(envelope.committedState);fs.appendFileSync(events,JSON.stringify({input:index,action:{actionId:chosen.actionId,family:chosen.family,actorId:chosen.actorId,target:chosen.target},nativeStateSha256:digest(state),sessionSha256:digest(envelope.session),rng:state.meta.rngState})+'\n');report.prefixInputs++;persist();}
try{
 comp.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});const restored=comp.lifecycle.restore(cp.coreState.compositionEnvelope);assert(restored.ok,JSON.stringify(restored));assert.deepEqual(comp.lifecycle.save().envelope,cp.coreState.compositionEnvelope,'checkpoint must restore byte-exact Native root/session/RNG');report.phase='replaying';persist();
 for(let i=129;i<159;i++)submit(save.replaySteps[i].action,i+1);
 const native=comp.lifecycle.save().envelope,canonical=JSON.parse(native.committedState),expected=case160.trace.context;
 const port=createAnalysisPort({composition:comp,seatId:'player-white',maxCacheEntries:0});
 try{
  const root=port.openRoot();report.observationExact=digest(root.observation)===digest(expected.observation);report.nativeObservationSha256=digest(root.observation);report.recordedObservationSha256=digest(expected.observation);
  report.publicStateExact=digest(root.observation.publicState)===digest(expected.observation.publicState);report.selfStateExact=digest(root.observation.selfState)===digest(expected.observation.selfState);
  const actionKey=a=>({actionId:a.actionId,family:a.family,phase:a.phase,actorId:a.actorId,target:a.target||{},payload:a.payload||{}}),sort=a=>a.map(actionKey).sort((a,b)=>a.actionId.localeCompare(b.actionId));
  report.legalActionsExact=digest(sort(root.legalActions))===digest(sort(expected.legalActions));report.analysisNativeSubmissions=port.getDiagnostics().submissionCount;
  if(!report.observationExact){const keys=new Set([...Object.keys(root.observation),...Object.keys(expected.observation)]);report.observationDifferentTopFields=[...keys].filter(k=>digest(root.observation[k]??null)!==digest(expected.observation[k]??null));}
  assert(report.publicStateExact&&report.selfStateExact&&report.legalActionsExact,'recorded root observation/legal facts differ; no branch execution');
  assert.deepEqual(comp.lifecycle.save().envelope,native,'inspection cannot change canonical root/RNG');
  report.nativeStateSha256=digest(canonical);report.sessionSha256=digest(native.session);report.rng=canonical.meta.rngState;report.prefixActionsSha256=digest(save.replaySteps.slice(129,159).map(x=>x.action));report.rootAndRngUnchangedByInspection=true;
 }finally{port.close();}
 fs.writeFileSync(rootFile,zlib.gzipSync(JSON.stringify({sourceCommit:manifest.sourceCommit,originCheckpointSha256:report.checkpointSha256,prefixInputs:30,envelope:native,expectedTrace:case160.trace.context})));
 report.rootFile=path.relative(repo,rootFile);report.rootFileSha256=crypto.createHash('sha256').update(fs.readFileSync(rootFile)).digest('hex');report.phase='root-verified';persist();console.log(JSON.stringify(report));
}catch(error){report.phase='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}finally{comp.dispose();}

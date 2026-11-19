'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const R=path.resolve(__dirname,'..'),D=path.join(R,'reports/ai-foundation-20261119'),read=p=>JSON.parse(fs.readFileSync(p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),seat='player-white';
const pre=read(path.join(D,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;for(const[p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const source=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(D,'teacher-r4-order-landing-first-20261119-v1.json.gz'))));
const record=read(path.join(R,'reports/research/adcb348b.42c7f5fd.full.terminal-recovery.json')),save=read(path.join(R,record.savePath));
const runner=require(path.join(rt,'tools/run_research_validation')),first=require(path.join(rt,'tools/research-human405-round1')),env=first.createEnvironment();
const output=path.join(D,'teacher-r4-free-pick-preparation-20261119-v1.json');const previous=fs.existsSync(output)?read(output):null,resume=previous?.failure?.checkpoint;
const report=previous||{schemaVersion:'seti-r4-free-pick-intervention-preparation-v1',status:'running',sourcePolicyCommit:pre.sourceCommit,nativeInputs:4,priorMetadataCheckInputs:4,newAISearches:0,newGames:0,originalOpeningInputs:23,teacherInputs:245,fixedAIPrefixInputs:41,interventionInput:287};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(previous){assert.equal(previous.status,'failed');assert(resume);report.status='running';delete report.failure;}persist();
const plain=a=>{const{presentation,decision,...fields}=a;return fields;};
try{
 const fixture={...save,committedState:source.envelope.committedState,session:source.envelope.session,replaySteps:save.replaySteps.slice(0,282),machineAI:{}};delete fixture.readableState;
 if(resume)env.loadCheckpoint(resume);else env.loadCheckpoint(runner.checkpointFromSave(fixture,{seed:record.seed,activePlayerCount:4,agentType:'custom',seat,compactReplay:true}));if(!resume)assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,source.envelope);
 if(!resume)for(const e of save.replaySteps.slice(282,286)){const action=env.legalActions().find(a=>a.actionId===e.action.actionId);assert(action);const result=env.step(action);assert(result.ok);report.nativeInputs++;persist();}
 const before=env.createCheckpoint(),observation=env.observe(seat);
 const raw=fs.readFileSync('/private/tmp/seti-teacher-r4-controlled-20261119-wwhi1itp/reports/research/adcb348b.94299f38.full.json.decisions.jsonl','utf8').trim().split('\n').map(JSON.parse)[287-246];
 const {pending:hostPending,...publicAssets}=observation.publicState,{pending:tracePending,...traceAssets}=raw.context.observation.publicState;assert.deepEqual(publicAssets,traceAssets);assert.equal(hostPending.actorPlayerId,tracePending.actorPlayerId);assert.deepEqual(env.legalActions().map(plain),raw.context.legalActions.map(plain));report.hostPendingMetadataDifference={host:hostPending,trace:tracePending};assert.deepEqual(observation.selfState,raw.context.observation.selfState);report.exactActualInput287Observation=true;
 const action=env.legalActions().find(a=>a.target?.source==='blind');assert(action);report.offeredIntervention=action;
 const result=env.step(action);assert(result.ok);report.nativeInputs++;assert.equal(report.nativeInputs,9);
 const current=env.saveBrowserSave({name:'第四轮第287步免费盲抽对照'}),after=env.createCheckpoint().coreState.compositionEnvelope;
 assert.equal(current.replaySteps.length,287);assert.deepEqual(current.replaySteps.slice(0,286).map(e=>plain(e.action)),save.replaySteps.slice(0,286).map(e=>plain(e.action)));assert.deepEqual(current.machineAI,{});
 const native=JSON.parse(after.committedState),p=native.players.players.find(p=>p.id===seat);assert.equal(native.turn.roundNumber,4);assert.equal(native.turn.currentPlayerId,seat);assert.deepEqual([...native.turn.passedPlayerIds].sort(),['player-blue','player-brown','player-green']);
 report.gainedCards=p.hand.filter(c=>!observation.selfState.hand.some(old=>old.id===c.id)).map(c=>({id:c.id,cardId:c.cardId}));
 report.beforePath='reports/ai-foundation-20261119/teacher-r4-before-input287-20261119-v1.json.gz';report.afterPath='reports/ai-foundation-20261119/teacher-r4-blind-after287-20261119-v1.json.gz';
 fs.writeFileSync(path.join(R,report.beforePath),zlib.gzipSync(JSON.stringify({envelope:before.coreState.compositionEnvelope})));
 fs.writeFileSync(path.join(R,report.afterPath),zlib.gzipSync(JSON.stringify({envelope:after})));
 report.savePath='seti-saves/seti-save-teacher-r4-blind-after287-20261119-v1.json';assert(!fs.existsSync(path.join(R,report.savePath)));fs.writeFileSync(path.join(R,report.savePath),JSON.stringify(current,null,2)+'\n');report.saveSha256=hash(fs.readFileSync(path.join(R,report.savePath)));report.afterNativeSha256=hash(JSON.stringify(after));report.status='verified';persist();console.log(JSON.stringify({status:report.status,nativeInputs:report.nativeInputs,exactActualRoot:true,gainedCards:report.gainedCards,savePath:report.savePath}));
}catch(e){report.status='failed';report.failure={message:e.message,stack:e.stack,checkpoint:env.createCheckpoint()};persist();console.error(e.stack);process.exitCode=1}finally{env.dispose()}

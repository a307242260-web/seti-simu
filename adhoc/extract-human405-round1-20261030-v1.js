'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const out='reports/ai-foundation-20261023/human405-round1-teacher-corpus-20261030-v1.json',dir='adhoc/ai-decision-corpus-20261030-round1-v1',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(fs.existsSync(out)){const r=JSON.parse(fs.readFileSync(out));for(const c of r.cases)assert.equal(sha(fs.readFileSync(c.fixturePath)),c.fixtureSha256);console.log('Reuse '+out);process.exit(0);}
const sourcePath='seti-saves/seti-save-537-merged.json',source=JSON.parse(fs.readFileSync(sourcePath)),openingPath='reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1.checkpoint.json',opening=JSON.parse(fs.readFileSync(openingPath));
const summary=o=>({r:o.publicState.roundNumber,t:o.publicState.turnNumber,c:o.publicState.currentPlayerId,p:Object.fromEntries(o.publicState.players.map(p=>[p.playerId,[p.score,p.credits,p.energy,p.publicity,p.handCount,p.reservedCount]]))});
const ordered=v=>!v||typeof v!=='object'?v:Array.isArray(v)?v.map(ordered):Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])]));
const report={schemaVersion:'seti-human405-round1-corpus-v1',sourcePath,sourceSha256:sha(fs.readFileSync(sourcePath)),openingPath,openingSha256:sha(fs.readFileSync(openingPath)),scope:'Teacher-forced current-native first-round white roots; includes the mandatory PASS reward that advances into round2. Not an autonomous AI episode.',cases:[],opponentInputs:[],confirmedInputs:23};fs.mkdirSync(dir,{recursive:true});const env=createSimulationEnv();
try{
 env.loadCheckpoint(opening);
 for(let i=23;i<source.replaySteps.length;i++){
  const old=source.replaySteps[i],legal=env.legalActions(),matches=legal.filter(a=>a.actionId===old.action.actionId&&a.family===old.action.family&&a.actorId===old.actorPlayerId);assert.equal(matches.length,1,`native action at ${i+1}`);const action=matches[0],before=summary(env.observe('player-white'));
  if(action.actorId==='player-white'){
   const checkpoint=env.createCheckpoint(),fixturePath=`${dir}/teacher-step-${String(i+1).padStart(3,'0')}-20261030-v1.json`,fixture={compositionEnvelope:checkpoint.coreState.compositionEnvelope,seatId:'player-white',source:{seed:source.seed,historicalInputIndex:i,teacherActionId:action.actionId,teacherAction:action},classification:{round:before.r,turn:before.t,family:action.family,kind:action.target?.kind||null}};fs.writeFileSync(fixturePath,JSON.stringify(fixture,null,2)+'\n');report.cases.push({step:i+1,round:before.r,turn:before.t,teacherSummary:action.summary,teacherActionId:action.actionId,fixturePath,fixtureSha256:sha(fs.readFileSync(fixturePath))});
  }else report.opponentInputs.push({step:i+1,actorId:action.actorId,family:action.family,summary:action.summary,actionId:action.actionId});
  assert(env.step(action).ok);const after=summary(env.observe('player-white'));if(old.after)assert.deepEqual(ordered(after),ordered(old.after));report.confirmedInputs=i+1;if(after.r>1){report.endSummary=after;report.roundTransitionInput=i+1;report.endCheckpointPath=dir+'/teacher-round1-settled-20261030-v1.checkpoint.json';fs.writeFileSync(report.endCheckpointPath,JSON.stringify(env.createCheckpoint())+'\n');break;}
 }
 assert.equal(report.confirmedInputs,62);assert.equal(report.cases.length,32);assert.equal(report.endSummary.r,2);report.allNativeAndSummariesMatched=true;
}finally{env.dispose();}
report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(fs.readFileSync(p))]));fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({roots:report.cases.length,confirmedInputs:report.confirmedInputs,end:report.endSummary}));

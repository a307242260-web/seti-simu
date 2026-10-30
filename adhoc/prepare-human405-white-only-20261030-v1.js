'use strict';
// Prepare a controlled current-native opening, not a full-game experiment.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const prefix='reports/ai-foundation-20261023/human405-white-only-opening-20261030-v1',output=prefix+'.json';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(fs.existsSync(output)){const r=JSON.parse(fs.readFileSync(output));assert.equal(sha(fs.readFileSync(r.checkpointPath)),r.checkpointSha256);console.log('Reuse '+output);process.exit(0);}
const sourcePath='seti-saves/seti-save-537-merged.json',source=JSON.parse(fs.readFileSync(sourcePath)),env=createSimulationEnv();
const ordered=v=>!v||typeof v!=='object'?v:Array.isArray(v)?v.map(ordered):Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])]));
const summary=o=>({r:o.publicState.roundNumber,t:o.publicState.turnNumber,c:o.publicState.currentPlayerId,p:Object.fromEntries(o.publicState.players.map(p=>[p.playerId,[p.score,p.credits,p.energy,p.publicity,p.handCount,p.reservedCount]]))});
const nativeInputs=[];
try{
 env.reset({seed:source.seed,activePlayerCount:4,agentType:'search',compactReplay:true});
 for(let i=0;i<23;i++){
  const old=source.replaySteps[i],matches=env.legalActions().filter(a=>a.actionId===old.action.actionId&&a.family===old.action.family&&a.actorId===old.actorPlayerId);assert.equal(matches.length,1,`opening input ${i+1}`);const action=matches[0];assert(['start_initial_setup','select_initial_card','confirm_initial_setup','discard-hand-cards'].includes(action.target?.kind));assert(env.step(action).ok);if(old.after)assert.deepEqual(ordered(summary(env.observe('player-white'))),ordered(old.after));nativeInputs.push({step:i+1,actorId:action.actorId,actionId:action.actionId,summary:action.summary});
 }
 const checkpoint=env.createCheckpoint(),state=JSON.parse(checkpoint.coreState.committedState),obs=env.observe('player-white');assert.equal(obs.publicState.currentPlayerId,'player-white');assert(!env.isTerminal());assert(env.legalActions().every(a=>a.actorId==='player-white'));
 const fixture=JSON.parse(fs.readFileSync('adhoc/ai-decision-corpus-20261029-teacher-v1/teacher-step-024-20261029-v1.json'));assert.deepEqual(state,JSON.parse(fixture.compositionEnvelope.committedState));
 const checkpointPath=prefix+'.checkpoint.json';fs.writeFileSync(checkpointPath,JSON.stringify(checkpoint)+'\n');
 const report={schemaVersion:'seti-human405-white-only-opening-v1',sourcePath,sourceSha256:sha(fs.readFileSync(sourcePath)),sourceCommit:'8c715275919b89cb32354fdf8d09fbc79d6213a8',matchedHistoricalOpeningInputs:23,nativeInputs,currentNativeTeacherRootEqual:true,checkpointPath,checkpointSha256:sha(fs.readFileSync(checkpointPath)),whiteInitialIndustry:state.players.players.find(p=>p.id==='player-white').initialSelection.industry,publicOpeningSummary:summary(obs),trialContract:{activePlayerCount:4,learningSeat:'player-white',opening:'all four seats use historical23-input setup; white company and income cards fixed identically',opponents:'blue,green,brown PASS each round; settle only required native pass/hand-limit Decisions; unexpected choices fail explicitly',requiredOpponentChoice:'known deterministic greedy hand-limit discard, never strategic main/quick actions',comparison:'paired white-only baseline and candidate from exactly this checkpoint; report separate from four-AI self-play',registration:'opponent mode, learning seat and opening fingerprint must be part of standard experiment identity before running; no custom-script full game',scoreTarget:'historical405 is a learning example; current rules are different',gate:'single-decision completion and speed checks before a full game'},completeGameRun:false,aiDecisionsRun:0,sourceHashes:Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(fs.readFileSync(p))]))};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({matchedInputs:23,whiteCompany:report.whiteInitialIndustry,teacherRootEqual:true,fullGameRun:false}));
}finally{env.dispose();}

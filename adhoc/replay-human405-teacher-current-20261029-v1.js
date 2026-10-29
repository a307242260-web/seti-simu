'use strict';
// Strict current-kernel recreation from a fresh game. No old state restoration,
// version relabeling, skipped actions, reward patching, or guessed alternatives.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const output='reports/ai-foundation-20261023/human405-teacher-current-replay-20261029-v1.json';
if(fs.existsSync(output)){console.log(fs.readFileSync(output,'utf8'));process.exit(0);}
const sourcePath='seti-saves/seti-save-537-merged.json',bytes=fs.readFileSync(sourcePath),source=JSON.parse(bytes),env=createSimulationEnv(),fixtureDir='adhoc/ai-decision-corpus-20261029-teacher-v1';fs.mkdirSync(fixtureDir,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),report={schemaVersion:'seti-teacher-current-replay-v1',sourcePath,sourceSha256:sha(bytes),scope:'Strict native replay from current initial state, checked against every saved resource/round summary. Stop at first difference; no adaptation across rule differences.',matchedInputs:0,sampled:[],divergence:null};
const ordered=v=>!v||typeof v!=='object'?v:Array.isArray(v)?v.map(ordered):Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])]));
const semantic=a=>JSON.stringify(ordered({family:a.family,actorId:a.actorId,target:a.target||{},payload:a.payload||{}}));
const summary=()=>{const o=env.observe('player-white'),s=o.publicState;return{r:s.roundNumber,t:s.turnNumber,c:s.currentPlayerId,p:Object.fromEntries(s.players.map(p=>[p.playerId,[p.score,p.credits,p.energy,p.publicity,p.handCount,p.reservedCount]]))};};
const seen=new Set();
try{
 env.reset({seed:source.seed,activePlayerCount:4,agentType:'search',compactReplay:true});
 for(let i=0;i<source.replaySteps.length;i++){
  const step=source.replaySteps[i],actions=env.legalActions(),exact=actions.filter(a=>a.actionId===step.action.actionId&&a.family===step.action.family&&a.actorId===step.actorPlayerId),matches=exact.length?exact:actions.filter(a=>semantic(a)===semantic(step.action));
  if(matches.length!==1){report.divergence={step:i,reason:'native-action-not-uniquely-matched',sourceAction:step.action,legal:actions};break;}
  const action=matches[0],before=summary(),company=action.target?.kind==='select_initial_card'&&action.target.selectionKind==='industry';
  if(step.actorPlayerId==='player-white'&&(company||['research_tech','scan','analyze','play_card','launch','orbit','land'].includes(action.family))){
   const key=company?'company':before.r+':'+action.family;
   if(!seen.has(key)){seen.add(key);const fixturePath=fixtureDir+`/teacher-step-${String(i+1).padStart(3,'0')}-20261029-v1.json`,checkpoint=env.createCheckpoint(),f={compositionEnvelope:checkpoint.coreState.compositionEnvelope,seatId:step.actorPlayerId,source:{seed:source.seed,historicalInputIndex:i,teacherActionId:action.actionId,teacherAction:action},classification:{round:before.r,turn:before.t,family:action.family,kind:company?'company':action.family}};fs.writeFileSync(fixturePath,JSON.stringify(f,null,2)+'\n');report.sampled.push({step:i+1,key,fixturePath,fixtureSha256:sha(fs.readFileSync(fixturePath)),actionId:action.actionId,summary:action.summary,round:before.r,turn:before.t});}
  }
  const result=env.step(action);assert(result.ok,JSON.stringify(result));const after=summary();
  if(step.after&&JSON.stringify(ordered(after))!==JSON.stringify(ordered(step.after))){report.divergence={step:i,reason:'saved-summary-mismatch',action,expected:step.after,actual:after};break;}
  report.matchedInputs=i+1;
 }
 report.terminal=env.isTerminal();report.totalHistoricalInputs=source.replaySteps.length;report.lastTrustedIndex=report.matchedInputs-1;report.currentWorldVersion=JSON.parse(env.createCheckpoint().coreState.committedState).meta.worldVersion;
}finally{env.dispose();}
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({matchedInputs:report.matchedInputs,samples:report.sampled.length,divergence:report.divergence&&{step:report.divergence.step,reason:report.divergence.reason},terminal:report.terminal}));

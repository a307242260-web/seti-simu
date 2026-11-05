'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const opening=require('../tools/research-human405-round1'),{checkpointFromSave,summaryOf}=require('../tools/run_research_validation');
const dir='reports/ai-foundation-20261105/third-round-teacher-v1';fs.mkdirSync(dir,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const output=dir+'/initial-native-audit-20261105-v1.json';assert(!fs.existsSync(output));
function getState(env){const e=env.createCheckpoint().coreState.compositionEnvelope;return e.session?.session?.workingState||JSON.parse(e.committedState);}
function assets(env){const s=getState(env),p=s.players.players.find(p=>p.id==='player-white');return structuredClone({round:s.turn.roundNumber,player:p,probes:s.pieces.rockets.filter(p=>p.playerId==='player-white'),planets:s.planets,sectorWins:s.data.sectorSettlements.winsByPlayerId['player-white']||[],aliens:s.aliens});}
function saveCheckpoint(env,label){const p=dir+'/'+label+'-20261105-v1.checkpoint.json',cp=env.createCheckpoint();if(fs.existsSync(p)){const previous=read(p);assert.deepEqual(cp.coreState.compositionEnvelope,previous.coreState.compositionEnvelope);assert.deepEqual(cp.browserReplaySteps,previous.browserReplaySteps);}else fs.writeFileSync(p,JSON.stringify(cp)+'\n');return{path:p,sha256:sha(p)};}
function findAction(env,old){const a=env.legalActions().find(a=>a.actionId===old.action.actionId&&a.actorId===old.actorPlayerId);if(a){const serialized=JSON.parse(JSON.stringify(a));for(const k of ['target','payload','family','phase'])assert.deepEqual(serialized[k],old.action[k]);}return a;}
const result={runtime:'V189/V22',policyQueries:0,newAutonomousRuns:0,phase:'before-pass-card-and-next-income',teacher:{source:'seti-saves/seti-save-537-merged.json',rows:[],roundEnds:[]},ai:{source:'reports/research/db594a2e.1609bf50.full.json',rows:[],roundEnds:[]}};
const teacher=read(result.teacher.source),r=read(result.ai.source),save=read(r.savePath),prefix=read('reports/research/e01243ba.93989585.quick-400.json'),prefixSave=read(prefix.savePath);
assert.deepEqual(save.replaySteps.slice(0,125),prefixSave.replaySteps);result.ai.first125ExactlyPreserved=true;
for(const who of ['ai','teacher']){
 const env=who==='ai'?require('../tools/research-human405-full').createEnvironment():createSimulationEnv();try{
  if(who==='ai')env.loadCheckpoint(checkpointFromSave(prefixSave,{seed:prefixSave.seed,activePlayerCount:4,agentType:'custom',seat:'player-white',compactReplay:true}));else env.loadCheckpoint(opening.opening().checkpoint);
  const steps=who==='ai'?save.replaySteps:teacher.replaySteps,start=who==='ai'?125:23,stop=who==='ai'?steps.length:245;
  for(let i=start;i<stop;i++){
   const old=steps[i],a=findAction(env,old),before=assets(env),n=i+1;
   if(who==='teacher'&&[107,113,120,127,133,136,141,160,163].includes(n))result.teacher['before'+n]=saveCheckpoint(env,'teacher-before-input-'+n);
   if(!a){result[who].mismatch={input:n,expected:old.action,assets:before,legalActions:env.legalActions(),checkpoint:saveCheckpoint(env,who+'-first-legacy-mismatch-'+n)};break;}
   if(who==='ai'){const end=r.roundEnds.find(x=>x.beforeInput===n);if(end){assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,read(end.checkpointPath).coreState.compositionEnvelope);result.ai.roundEnds.push({round:end.round,beforeInput:n,assets:before,checkpointPath:end.checkpointPath,checkpointSha256:sha(end.checkpointPath)});}}
   else if(a.actorId==='player-white'&&a.family==='pass'){const cp=saveCheckpoint(env,'teacher-round-'+before.round+'-before-pass');result.teacher.roundEnds.push({round:before.round,beforeInput:n,assets:before,checkpoint:cp});}
   const step=env.step(a);assert(step.ok);if(who==='ai'||n>=107)result[who].rows.push({input:n,action:a,before,after:assets(env)});
  }
  result[who].lastInput=env.saveBrowserSave().replaySteps.length;
  if(who==='ai'){const actual=env.saveBrowserSave();assert.equal(actual.committedState,save.committedState);assert.deepEqual(actual.session,save.session);assert(env.isTerminal());assert.deepEqual(summaryOf(env.observe('player-white')),r.summary);result.ai.finalNativeStateSessionRngAndTerminalScoresExact=true;result.ai.summary=r.summary;result.ai.wallMsIncludingSourcePrefix=r.wallMsIncludingSourcePrefix;}
 }finally{env.dispose();}
}
result.sourceHashes=Object.fromEntries([result.teacher.source,result.ai.source,r.savePath,prefix.savePath].map(p=>[p,sha(p)]));
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,aiNativeInputs:result.ai.rows.length,aiFinalVerified:result.ai.finalNativeStateSessionRngAndTerminalScoresExact,aiScores:result.ai.roundEnds.map(x=>[x.round,x.assets.player.resources.score]),teacherLastInput:result.teacher.lastInput,teacherMismatch:result.teacher.mismatch&&{input:result.teacher.mismatch.input,expected:result.teacher.mismatch.expected,actual:result.teacher.mismatch.legalActions},teacherThirdStart:result.teacher.rows.find(x=>x.input===113)?.before.player}));

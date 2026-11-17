'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.argv[2]||path.resolve(__dirname,'../../..'),dir='reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1';
const {createSimulationEnv}=require(path.join(root,'randomizer/app/simulation-env')),lib=require(path.join(root,'tools/robot-iteration-lib'));
const archive=JSON.parse(fs.readFileSync(path.join(root,dir,'teacher-current-legal-reference-384-20261118-v1.replay.json'))),roundEnds=[];
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(ordered(x))).digest('hex');
const env=createSimulationEnv({agentFactory(){throw Error('FIXED_REFERENCE_MUST_NOT_CALL_AGENT')}});
try{
 env.reset({seed:archive.seed,activePlayerCount:4,agentType:'custom',compactReplay:true});
 for(const [i,{action}] of archive.actions.entries()){
  const legal=env.legalActions(),a=legal.find(a=>a.actionId===action.actionId&&a.actorId===action.actorId&&digest(a.target)===digest(action.target));assert(a,`Native reference action ${i+1}`);
  if(a.actorId==='player-white'&&a.family==='pass'){
   const cp=env.createCheckpoint(),e=cp.coreState.compositionEnvelope,s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(p=>p.id==='player-white');
   roundEnds.push({round:s.turn.roundNumber,phase:'before-pass-card-and-income',beforeInput:i+1,score:p.resources.score,resources:p.resources,income:p.income,technology:p.techState,hand:p.hand.map(c=>c.cardId),reserved:p.reservedCards.map(c=>c.cardId),data:p.dataState,probes:s.pieces.rockets.filter(r=>r.playerId===p.id),sectorWins:s.data.sectorSettlements.winsByPlayerId[p.id]||[],finalScoring:s.finalScoring});
  }
  const result=env.step(a);assert(result.ok,result.error);
 }
 const save=env.saveBrowserSave({name:'教师当前规则修订参考384分（非AI成绩）'}),s=JSON.parse(save.committedState);
 assert.equal(digest(s),archive.expected.nativeStateSha256);assert.equal(digest(save.session),archive.expected.sessionSha256);assert.deepEqual(s.meta.rngState,archive.expected.rng);
 assert.equal(s.match.finalScores.find(p=>p.playerId==='player-white').totalScore,384);assert.equal(roundEnds.length,4);assert.equal(save.replaySteps.length,474);
 const savePath='seti-saves/seti-save-teacher-current-legal-reference-384-20261118-v1.json';fs.writeFileSync(path.join(root,savePath),JSON.stringify(save,null,2)+'\n');
 const proof={schemaVersion:'seti-teacher-current-legal-reference-proof-v1',source:archive.ruleCommit,seed:archive.seed,same23InputOpeningAsAI272:true,terminal:384,base:239,tile:107,card:38,inputs:474,notOriginalTeacher405:true,notAutonomousAI:true,noResourcesInjected:true,completeNativeStateEqual:true,sessionEqual:true,rngEqual:true,roundEnds,save:savePath,archive:dir+'/teacher-current-legal-reference-384-20261118-v1.replay.json',report:'reports/iteration/teacher-current-legal-reference-384-20261118/teacher-current-legal-reference-384-20261118-v1.action-log.html'};
 fs.writeFileSync(path.join(root,dir,'teacher-current-legal-reference-proof-20261118-v1.json'),JSON.stringify(proof,null,2)+'\n');
 const html=lib.buildActionLogReport({savePath,versionId:'teacher-current-legal-reference-384-20261118',versionName:'教师当前规则修订参考384分（非AI成绩）',runKey:'teacher-current-legal-reference-384-20261118-v1',recordFile:'teacher-current-legal-reference-384-20261118-v1.replay.json',gitCommit:archive.ruleCommit,policyVersion:'fixed-teacher-reference-no-ai',flags:{modifiedTeacherReference:true,noAutonomousAI:true},wallMs:null,mode:'fixed-reference-replay'});
 fs.mkdirSync(path.dirname(path.join(root,proof.report)),{recursive:true});
 fs.writeFileSync(path.join(root,proof.report),html.replace('../../research/teacher-current-legal-reference-384-20261118-v1.replay.json','../../ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1/teacher-current-legal-reference-384-20261118-v1.replay.json').split('\n').map(l=>l.trimEnd()).join('\n'));console.log(JSON.stringify({save:savePath,report:proof.report,roundEnds:roundEnds.map(r=>({round:r.round,score:r.score,tech:Object.keys(r.technology.ownedTiles).length,income:r.income})),terminal:384,completeNativeStateEqual:true}));
}finally{env.dispose()}

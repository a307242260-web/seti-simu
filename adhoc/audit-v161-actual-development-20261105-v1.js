'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createSimulationEnv}=require('../randomizer/app/simulation-env'),opening=require('../tools/research-human405-round1');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),record='reports/research/bc76a417.b961ce29.quick-400.json',r=read(record),save=read(r.savePath),env=createSimulationEnv(),folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/',rows=[];
try{
 env.loadCheckpoint(opening.opening().checkpoint);
 for(let i=23;i<save.replaySteps.length;i++){
  const e=save.replaySteps[i],a=env.legalActions().find(x=>x.actionId===e.action.actionId&&x.actorId===e.actorPlayerId);assert(a);
  if([35,36,38,48,55,66,75,77,99].includes(i+1)){
   const cp=env.createCheckpoint(),envelope=cp.coreState.compositionEnvelope,s=envelope.session?.session?.workingState||JSON.parse(envelope.committedState),p=s.players.players.find(p=>p.id==='player-white'),fixture=folder+'ai-v161-step'+String(i+1).padStart(3,'0')+'-20261105-v1.json';assert(!fs.existsSync(fixture));
   fs.writeFileSync(fixture,JSON.stringify({source:{seed:r.seed,record,recordSha256:sha(record),beforeInput:i+1},seatId:'player-white',compositionEnvelope:envelope},null,2)+'\n');
   const search=r.metrics.searches.find(x=>x.step===i+1);
   rows.push({input:i+1,round:s.turn.roundNumber,action:a,fixture,fixtureSha256:sha(fixture),resources:p.resources,income:p.income,technology:p.techState,hand:p.hand.map(c=>({id:c.id,cardId:c.cardId})),probes:s.pieces.rockets.filter(x=>x.playerId===p.id),roots:search?.roots,lines:search?.lines});
  }
  assert(env.step(a).ok);
 }
 const out=folder+'v161-actual-development-audit-20261105-v1.json';assert(!fs.existsSync(out));
 const at75=rows.find(x=>x.input===75),play=at75.roots.find(x=>x.goal?.cardId==='card-15-0'),launch=at75.roots.find(x=>x.actionId.startsWith('launch:'));
 assert.equal(play.value,76);assert.equal(launch.value,76.5);assert(at75.hand.some(c=>c.id==='card-15-0'));assert.equal(at75.action.family,'launch');
 fs.writeFileSync(out,JSON.stringify({record,recordSha256:sha(record),actualNativeInputsReplayed:save.replaySteps.length,rows,conclusions:{freeResearchCardPreservedAt55:true,freeResearchCandidateAvailableAt75:true,freeResearchValueAt75:play.value,launchValueAt75:launch.value,missingCandidateDoesNotExplainStep75:true,plannedNext:'Native endpoint decomposition at75 and known income/blue funding chain at36/38; distinguish shared-capital valuation from missing preparation. Do not increase a weight without a native counterexample.'},goalStatus:'active',goalAchieved:false},null,2)+'\n');
 console.log(JSON.stringify({actualInputs:save.replaySteps.length,fixtures:rows.length,at75:{freeResearch:play.value,launch:launch.value},goalStatus:'active'}));
}finally{env.dispose();}

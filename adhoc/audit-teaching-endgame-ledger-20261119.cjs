'use strict';
// Existing terminal states and recorded decisions only; no AI or game inputs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),readline=require('node:readline');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p)),pre=read(path.join(dir,'teaching-score-ledger-preflight-20261119-v1.json'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [p,h]of Object.entries(pre.oldSourceFiles))assert.equal(hash(fs.readFileSync(path.join(pre.oldNativeRuntime,p))),h,p);
const currentPre=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json'));
for(const [p,h]of Object.entries(currentPre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(pre.currentNativeRuntime,p))),h,p);
const runtimes={old:pre.oldNativeRuntime,current:pre.currentNativeRuntime};
const modules=Object.fromEntries(Object.entries(runtimes).map(([name,rt])=>[name,{
 score:require(path.join(rt,'randomizer/game/end-game-scoring')),effects:require(path.join(rt,'randomizer/game/cards/effects'))}]));
const sources={AI:'seti-saves/seti-save-research-ai-search-current-full-baseline-20261118-5fabd621-full-v163.json',
 teacher:'seti-saves/seti-save-teacher-current-legal-reference-384-20261118-v1.json'};
const saves=Object.fromEntries(Object.entries(sources).map(([name,p])=>[name,read(path.join(repo,p))]));
const states=Object.fromEntries(Object.entries(saves).map(([name,s])=>[name,JSON.parse(s.committedState)]));
const player=s=>s.players.players.find(p=>p.id===seat);
function score(state,version='current'){
 const s=structuredClone(state),m=modules[version];
 return m.score.computePlayerFinalScore({...s,cardEffects:m.effects,getCardTypeCode:c=>m.effects.getRuntimeCardTypeCode(c,m.effects.getCardModel(c)?.cardType)},player(s));
}
const results=Object.fromEntries(Object.entries(states).map(([name,s])=>[name,{old:score(s,'old'),current:score(s)}]));
assert.deepEqual(results.AI.old,results.AI.current);assert.deepEqual(results.teacher.old,results.teacher.current);
assert.equal(results.AI.current.totalScore,272);assert.equal(results.teacher.current.totalScore,384);
assert.equal(results.teacher.current.tileScore,107);assert.equal(results.teacher.current.cardScore,38);
function whiteMarks(s){return Object.values(s.finalScoring.tiles).flatMap(t=>t.marks.filter(m=>m.playerId===seat).map(m=>({...m})));}
function withMarks(assets,allocation){
 const s=structuredClone(assets);
 assert.deepEqual(s.finalScoring.tileVariants,allocation.finalScoring.tileVariants);
 for(const t of Object.values(s.finalScoring.tiles))t.marks=t.marks.filter(m=>m.playerId!==seat);
 for(const m of whiteMarks(allocation))s.finalScoring.tiles[m.tileId].marks.push(m);
 return score(s);
}
const sensitivity=Object.fromEntries(Object.entries(states).map(([assetName,s])=>[assetName,
 Object.fromEntries(Object.entries(states).map(([markName,m])=>[markName,withMarks(s,m).tileScore]))]));
assert.deepEqual(sensitivity,{AI:{AI:74,teacher:68},teacher:{AI:83,teacher:107}});
const m=modules.current;
function facts(s){const p=player(s);return{resources:p.resources,income:p.income,technology:p.techState,
 totalOwnedTechnology:m.score.countTotalOwnedTech(p),completedTasks:p.completedTaskCount,
 traceCounts:m.score.getPlayerTraceCounts(p,s.aliens),reservedCards:p.reservedCards.map(c=>c.cardId),marks:whiteMarks(s)};}
const cardSensitivity=player(states.teacher).reservedCards.filter(c=>m.effects.getRuntimeCardTypeCode(c,m.effects.getCardModel(c)?.cardType)===3).map(card=>{
 const s=structuredClone(states.AI),p=player(s);p.reservedCards=[structuredClone(card)];
 const result=m.score.computePlayerCardScore(p,{...s,cardEffects:m.effects,getCardTypeCode:c=>m.effects.getRuntimeCardTypeCode(c,m.effects.getCardModel(c)?.cardType)});
 return{card:card.cardId,scoreIfThisCardWerePlayedOnAIAssets:result.total,
 teacherActualScore:results.teacher.current.cards.find(c=>c.cardId===card.cardId)?.score??0,
 AIActuallyPlayed:player(states.AI).reservedCards.some(c=>c.cardId===card.cardId)};
});
const output=path.join(dir,'teaching-endgame-ledger-20261119-v1.json');assert(!fs.existsSync(output));
const report={schemaVersion:'seti-teaching-endgame-ledger-v1',status:'scored',sourceCommits:pre,
 sources:Object.fromEntries(Object.entries(sources).map(([name,p])=>[name,{path:p,sha256:hash(fs.readFileSync(path.join(repo,p))),nativeStateSha256:hash(saves[name].committedState)}])),
 sourceStatesUnmodified:true,scoringOnBothRuleSourcesEqual:true,fullTrajectoryRuleIdentityClaimed:false,
 sourceRuleDifference:'Only amiba reveal allocation key ordering differs between formal5fab and teacher838. Stored terminal scores agree exactly on both Native sources; complete action-history equivalence is not inferred.',
 results,facts:Object.fromEntries(Object.entries(states).map(([name,s])=>[name,facts(s)])),
 differences:{total:112,base:47,tile:33,card:32,other:0},
 markSensitivity:{scope:'Terminal score sensitivity only; exchanged marks are not a played legal history or a new game score.',tileScores:sensitivity,
 AIAssetsTeacherAllocationDelta:-6,teacherAssetsTeacherAllocationDelta:24},
 cardSensitivity:{scope:'Conditional card scoring on existing assets, without claiming acquisition/payment is legal or free.',rows:cardSensitivity},
 newAISearches:0,newNativeInputs:0,newGames:0};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
async function traceAudit(){
 const record=read(path.join(repo,'reports/research/2170d824.5fabd621.full.json'));
 const file=path.join(repo,record.agentTracePath),targets=['amiba_7.webp','amiba_6.webp','chong_2.webp','amiba_5.webp','dlc_31.png'];
 const fate=Object.fromEntries(targets.map(card=>[card,{knownHandSnapshots:0,firstKnown:null,lastKnown:null,uses:[],fundedPlayRoots:[]} ]));
 const rl=readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity});let count=0;
 function refers(x,id){if(Array.isArray(x))return x.some(v=>refers(v,id));if(x&&typeof x==='object')return Object.values(x).some(v=>refers(v,id));return typeof x==='string'&&(x===id||x.split('|').includes(id));}
 for await(const line of rl){if(!line.trim())continue;const trace=JSON.parse(line),index=count++;if(trace.context.seatId!==seat)continue;
  const ctx=trace.context,o=ctx.observation,hand=o.selfState.hand,p=o.publicState.players.find(p=>p.playerId===seat),selected=ctx.legalActions.find(a=>a.actionId===trace.actionId);assert(selected);
  for(const card of hand){if(!fate[card.cardId]||card.hidden)continue;const f=fate[card.cardId];f.knownHandSnapshots++;
   const brief={traceIndex:index,round:o.publicState.roundNumber,instance:card.id,wallet:{credits:p.credits,energy:p.energy,publicity:p.publicity},selectedFamily:selected.family,selectedSummary:selected.summary};
   f.firstKnown??=brief;f.lastKnown=brief;
   if(refers(selected.target,card.id))f.uses.push({...brief,action:selected});
   const play=ctx.legalActions.find(a=>a.family==='play_card'&&a.target?.cardInstanceId===card.id);
   if(play&&!trace.search?.reusedCoverage){const roots=(trace.search?.roots||[]).filter(r=>r.actionId===play.actionId);f.fundedPlayRoots.push({...brief,selectedValue:trace.search?.value,cardRoots:roots});}
  }
 }
 const offset=record.steps-count;assert(offset>0);
 for(const f of Object.values(fate)){for(const x of [f.firstKnown,f.lastKnown,...f.uses,...f.fundedPlayRoots])if(x)x.step=offset+x.traceIndex+1;}
 report.cardFates={tracePath:record.agentTracePath,traceSha256:hash(fs.readFileSync(file)),traceRows:count,stepOffset:offset,
  limits:'Only actually known own-hand instances are classified; absence does not prove an unoffered alien card was available.',cards:fate};
 report.status='complete';persist();
 console.log(JSON.stringify({status:report.status,scoreDifferences:report.differences,marks:sensitivity,cardSensitivity:cardSensitivity,
  fates:Object.fromEntries(Object.entries(fate).map(([id,f])=>[id,{first:f.firstKnown?.step,last:f.lastKnown?.step,uses:f.uses.map(x=>({step:x.step,family:x.action.family,summary:x.action.summary})),fundedPlayRoots:f.fundedPlayRoots.length}]))}));
}
traceAudit().catch(error=>{report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;});

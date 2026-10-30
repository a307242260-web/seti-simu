'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const values=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search');
const scenario=require('../tools/research-human405-round1');
assert.equal(search.VERSION,'seti-complete-decision-search-v119');
const output='reports/ai-foundation-20261023/human405-v119-standard-r1-verification-20261031-v1.json';
assert(!fs.existsSync(output),'Reuse the recorded verification');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const opening=scenario.opening(),seed='seti-free-analyze-v1',white='player-white';
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,
  trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
kernel.newGame({seed});const c=kernel.composition;
const write=(p,x)=>{fs.mkdirSync(require('node:path').dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');};
function submit(id,actor){const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===id);assert(a,id);if(actor)assert.equal(a.actorId,actor);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));return a;}
function endpoint(){const state=JSON.parse(c.lifecycle.save().envelope.committedState),p=state.players.players.find(p=>p.id===white);assert.equal(state.turn.roundNumber,2);assert(!state.turn.gameEnded);return{score:p.resources.score,scoreSources:p.scoreSources,resources:p.resources,income:p.income,technology:p.techState,probes:state.pieces.rockets.filter(r=>r.playerId===white||r.playerColor==='white'),hand:p.hand.map(x=>x.cardId),reserved:p.reservedCards.map(x=>x.cardId),value:values.evaluateStateValue(c.projection({role:'player',playerId:white}).state,white)};}
function replay(recordPath){const record=read(recordPath),save=read(record.savePath);assert.equal(record.scenario.id,scenario.ID);assert.equal(record.scenario.openingInputs,23);assert.equal(record.scenario.openingCheckpointSha256,opening.sha256);assert(record.scenarioResult.firstRoundSettled);assert(!record.terminal);assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.stepIndex,e.actorPlayerId,e.action]),opening.checkpoint.replaySteps.map(e=>[e.stepIndex,e.actorPlayerId,e.action]));assert(c.lifecycle.restore(opening.checkpoint.coreState.compositionEnvelope).ok);const nonwhite=[],ledger=[];let beforePass,before43;
 for(const e of save.replaySteps.slice(23)){if(e.stepIndex===42)before43=c.lifecycle.save().envelope;if(e.actorPlayerId===white&&e.action.family==='pass')beforePass=c.lifecycle.save().envelope;const beforeValue=e.actorPlayerId===white?values.evaluateStateValue(c.projection({role:'player',playerId:white}).state,white):null;const a=submit(e.action.actionId,e.actorPlayerId);if(beforeValue){const afterValue=values.evaluateStateValue(c.projection({role:'player',playerId:white}).state,white);ledger.push({input:e.stepIndex+1,family:a.family,target:a.target,summary:a.summary,before:beforeValue,after:afterValue,delta:afterValue.total-beforeValue.total});}if(a.actorId!==white){assert(a.family==='pass'||a.family==='choose_card'&&['pass-hand-limit','pass-reserve-card'].includes(a.target.kind));nonwhite.push({seat:a.actorId,family:a.family,target:a.target});}}
 const final=c.lifecycle.save().envelope;assert.equal(final.committedState,save.committedState);assert.deepEqual(final.session,save.session);
 const traces=fs.readFileSync(record.agentTracePath,'utf8').trim().split('\n').map(JSON.parse);assert.equal(traces.length,save.replaySteps.length-23);traces.forEach((t,i)=>{assert.equal(t.actionId,save.replaySteps[i+23].action.actionId);assert.equal(t.context.seatId,save.replaySteps[i+23].actorPlayerId);});const searches=record.metrics.searches;assert(searches.every(s=>s.complete&&s.diagnostics.nativeExecutions<=256&&s.rootAndSearchMilliseconds<=600));assert.equal(searches.length,traces.filter(t=>t.context.seatId===white).length);
 return{recordPath,recordSha256:sha(recordPath),savePath:record.savePath,saveSha256:sha(record.savePath),tracePath:record.agentTracePath,traceSha256:sha(record.agentTracePath),sourceCommit:record.gitCommit,openingSha256:opening.sha256,strictNativeReplay:true,exactFinalCommittedStateSessionRng:true,passiveOpponentsOnly:true,nonwhite,formalTerminal:false,steps:record.steps,wallMs:record.wallMs,searches:searches.length,maxNativeInputs:Math.max(...searches.map(s=>s.diagnostics.nativeExecutions)),maxMilliseconds:Math.max(...searches.map(s=>s.rootAndSearchMilliseconds)),planReuseHits:searches.filter(s=>s.diagnostics.planContinuation==='hit').length,final:endpoint(),beforePass,before43,ledger,whiteActions:save.replaySteps.slice(23).filter(e=>e.actorPlayerId===white).map(e=>({input:e.stepIndex+1,family:e.action.family,summary:e.action.summary}))};
}

try {
 const actual=replay('reports/research/12231ee9.2fb2b091.quick-200.json');
 const previous=replay('reports/research/f8d9ee42.0dc7785d.quick-200.json');
 const teacherFixture=read('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-062-20261030-v1.json');
 assert(c.lifecycle.restore(teacherFixture.compositionEnvelope).ok);submit(teacherFixture.source.teacherActionId,white);const teacher=endpoint();
 assert.equal(actual.final.score,11);assert.equal(previous.final.score,13);assert.equal(teacher.score,15);
 const a=read(actual.savePath).replaySteps,b=read(previous.savePath).replaySteps;
 let shared=0;while(shared<Math.min(a.length,b.length)&&JSON.stringify(a[shared].action)===JSON.stringify(b[shared].action))shared++;
 for(const row of [actual,previous]){delete row.beforePass;delete row.before43;}
 const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
 const report={schemaVersion:'seti-human405-autonomous-r1-native-causal-comparison-v2',sourceCommit:'2fb2b0912620ff4c655db65c27ba000dd5b5ca8d',sourceHashes,valueModel:values.MODEL_VERSION,
 actual,previous,teacher,sharedNativeActionPrefixInputs:shared,firstChangedInput:shared+1,
 baselineEligible:false,strategicAlignmentComplete:false,goalStatus:'active',
 findings:['Exactly one standard autonomous white R1 on admitted v119; same23-input opening and passive opponents. The complete real input stream and final state/session/RNG replay exactly.',
 'White11 versus previous13 and teacher15 is not a score improvement. Recompute all three endpoints with the same current V5 native observation; retain component ledgers before interpreting a tradeoff.',
 'Cold45-root and7Chrome admission cover this source. The independent standard R1 additionally checks each real white decision256inputs/600ms and refuses invalid submission.',
 'No full-game/180second conclusion and no baseline promotion. Next analyze first changed input and the value lost across actual reward/turn boundaries.']};
 write(output,report);console.log(JSON.stringify({output,actual:actual.final.score,previous:previous.final.score,teacher:teacher.score,actualValue:actual.final.value.total,previousValue:previous.final.value.total,teacherValue:teacher.value.total,wallMs:actual.wallMs,maxInputs:actual.maxNativeInputs,maxMs:actual.maxMilliseconds,shared,firstChangedInput:shared+1}));
}finally{c.dispose();}

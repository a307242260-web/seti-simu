'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const values=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search');
const scenario=require('../tools/research-human405-round1');
assert.equal(search.VERSION,'seti-complete-decision-search-v99');
const output='reports/ai-foundation-20261023/human405-v99-standard-r1-verification-20261031-v1.json';
assert(!fs.existsSync(output),'Reuse the recorded verification');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const opening=scenario.opening(),seed='seti-free-analyze-v1',white='player-white';
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,
  trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
kernel.newGame({seed});const c=kernel.composition;
const write=(p,x)=>{fs.mkdirSync(require('node:path').dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');};
function submit(id,actor){const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===id);assert(a,id);if(actor)assert.equal(a.actorId,actor);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));return a;}
function endpoint(){const state=JSON.parse(c.lifecycle.save().envelope.committedState),p=state.players.players.find(p=>p.id===white);assert.equal(state.turn.roundNumber,2);assert(!state.turn.gameEnded);return{score:p.resources.score,scoreSources:p.scoreSources,resources:p.resources,income:p.income,technology:p.techState,hand:p.hand.map(x=>x.cardId),reserved:p.reservedCards.map(x=>x.cardId),value:values.evaluateStateValue(c.projection({role:'player',playerId:white}).state,white)};}
function replay(recordPath){const record=read(recordPath),save=read(record.savePath);assert.equal(record.scenario.id,scenario.ID);assert.equal(record.scenario.openingInputs,23);assert.equal(record.scenario.openingCheckpointSha256,opening.sha256);assert(record.scenarioResult.firstRoundSettled);assert(!record.terminal);assert.deepEqual(save.replaySteps.slice(0,23).map(e=>[e.stepIndex,e.actorPlayerId,e.action]),opening.checkpoint.replaySteps.map(e=>[e.stepIndex,e.actorPlayerId,e.action]));assert(c.lifecycle.restore(opening.checkpoint.coreState.compositionEnvelope).ok);const nonwhite=[];let beforePass,before43;
 for(const e of save.replaySteps.slice(23)){if(e.stepIndex===42)before43=c.lifecycle.save().envelope;if(e.actorPlayerId===white&&e.action.family==='pass')beforePass=c.lifecycle.save().envelope;const a=submit(e.action.actionId,e.actorPlayerId);if(a.actorId!==white){assert(a.family==='pass'||a.family==='choose_card'&&['pass-hand-limit','pass-reserve-card'].includes(a.target.kind));nonwhite.push({seat:a.actorId,family:a.family,target:a.target});}}
 const final=c.lifecycle.save().envelope;assert.equal(final.committedState,save.committedState);assert.deepEqual(final.session,save.session);
 const traces=fs.readFileSync(record.agentTracePath,'utf8').trim().split('\n').map(JSON.parse);assert.equal(traces.length,save.replaySteps.length-23);traces.forEach((t,i)=>{assert.equal(t.actionId,save.replaySteps[i+23].action.actionId);assert.equal(t.context.seatId,save.replaySteps[i+23].actorPlayerId);});const searches=record.metrics.searches;assert(searches.every(s=>s.complete&&s.diagnostics.nativeExecutions<=256&&s.rootAndSearchMilliseconds<=600));assert.equal(searches.length,traces.filter(t=>t.context.seatId===white).length);
 return{recordPath,recordSha256:sha(recordPath),savePath:record.savePath,saveSha256:sha(record.savePath),tracePath:record.agentTracePath,traceSha256:sha(record.agentTracePath),sourceCommit:record.gitCommit,openingSha256:opening.sha256,strictNativeReplay:true,exactFinalCommittedStateSessionRng:true,passiveOpponentsOnly:true,nonwhite,formalTerminal:false,steps:record.steps,wallMs:record.wallMs,searches:searches.length,maxNativeInputs:Math.max(...searches.map(s=>s.diagnostics.nativeExecutions)),maxMilliseconds:Math.max(...searches.map(s=>s.rootAndSearchMilliseconds)),planReuseHits:searches.filter(s=>s.diagnostics.planContinuation==='hit').length,final:endpoint(),beforePass,before43,whiteActions:save.replaySteps.slice(23).filter(e=>e.actorPlayerId===white).map(e=>({input:e.stepIndex+1,family:e.action.family,summary:e.action.summary}))};
}

try {
 const actual=replay('reports/research/f8d9ee42.0dc7785d.quick-200.json');
 const control=replay('reports/research/203cd183.cad56459.quick-200.json');
 const prior=replay('reports/research/83388120.a11ea9dc.quick-200.json');
 assert.deepEqual(actual.nonwhite,control.nonwhite);assert.deepEqual(actual.nonwhite,prior.nonwhite);
 assert.deepEqual(actual.before43,control.before43,'Exact native state/session/RNG before the changed choice');
 const getSave=r=>read(read(r.recordPath).savePath);
 const a=getSave(actual),b=getSave(control);
 assert.deepEqual(a.replaySteps.slice(0,42).map(e=>e.action),b.replaySteps.slice(0,42).map(e=>e.action));
 assert.equal(a.replaySteps[42].action.family,'research_tech');assert.equal(b.replaySteps[42].action.family,'pass');
 assert.equal(actual.final.score,13);assert.equal(control.final.score,8);
 assert.equal(actual.final.income.handSize,2);assert.equal(control.final.income.handSize,2);assert.equal(prior.final.income.handSize,1);
 assert.deepEqual(Object.keys(actual.final.technology.ownedTiles).sort(),['blue1','purple4']);
 const teacherFixture=read('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-062-20261030-v1.json');
 assert(c.lifecycle.restore(teacherFixture.compositionEnvelope).ok);submit(teacherFixture.source.teacherActionId,white);const teacher=endpoint();assert.equal(teacher.score,15);
 for(const r of [actual,control,prior]){delete r.beforePass;delete r.before43;}
 const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
 const report={schemaVersion:'seti-human405-autonomous-r1-native-causal-comparison-v1',sourceCommit:'0dc7785da8a4dce7bc81eabbb7dc92dcf6faf58f',sourceHashes,valueModel:values.MODEL_VERSION,
 actual,control,prior,teacher,sameNativePrefixThrough42:true,exactBeforeChangedChoiceStateSessionRng:true,
 nativeChangedInput43:{before:'pass',after:'research_tech'},
 findings:['Exactly one standard original23-opening autonomous R1 for v99; no forced human prefix or opponent actions beyond PASS and necessary choices.',
 'All native inputs, final committed state/session/RNG and trace choices replay exactly. Native prefix through input42 equals v98 exactly; input43 changes from PASS to research.',
 'White13points/blue1+purple4 versus v98 8points/purple4; both retain hand income2. Native acquisition replaces premature PASS after the investment-window correction.',
 'Prior v94 also13points but hand income1. Teacher15points/blue2+purple4 remains. Endpoint V is recomputed through current native V4 projections for every record, not older trace schemas.',
 'This is R1 stage evidence, not a full-game strength or180second acceptance claim. Baselinev41 unchanged.'],baselineEligible:false,strategicAlignmentComplete:false,goalStatus:'active'};
 write(output,report);
 console.log(JSON.stringify({output,score:actual.final.score,old:control.final.score,prior:prior.final.score,teacher:teacher.score,
  value:actual.final.value.total,oldValue:control.final.value.total,priorValue:prior.final.value.total,teacherValue:teacher.value.total,
  wallMs:actual.wallMs,maxNative:actual.maxNativeInputs,maxMs:actual.maxMilliseconds,samePrefix42:true}));
} finally { c.dispose(); }

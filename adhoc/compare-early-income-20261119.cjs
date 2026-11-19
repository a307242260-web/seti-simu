'use strict';
// One recorded Native income menu; two explicit choices, same own-turn boundary.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const read=p=>JSON.parse(fs.readFileSync(p));
const preflight=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json'));
const rt=preflight.runtime,output=path.join(dir,'early-investment-native-control-20261119-v1.json');
assert(!fs.existsSync(output),'reuse existing evidence');
const ordered=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordered):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const digest=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(ordered(x))).digest('hex');
for(const [f,h]of Object.entries(preflight.sourceFiles))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(rt,f))).digest('hex'),h,f);
const archive=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,'reports/iteration/v486-original20-20261119/board-20-replay-20261119-v1.json.gz'))));
const traces=fs.readFileSync(path.join(rt,'reports/research/3a4edb37.94299f38.full.json.decisions.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const trace=traces[23],context=trace.context;
assert.equal(trace.actionId,'choose_card:b04e9500');assert.equal(context.seatId,'player-white');
const selected=archive.decisions.filter(d=>d.actionId===trace.actionId&&d.stateVersion===context.stateVersion&&d.round===1);
assert.equal(selected.length,1);const input=selected[0].step;
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {createStateValueEvaluator}=require(path.join(rt,'randomizer/game/ai/state-value'));
const demand=require(path.join(rt,'randomizer/game/ai/resource-demand'));
const cards=require(path.join(rt,'randomizer/game/cards/deck'));
const seed=archive.seed,seat='player-white',random=createSeededRandom(seed);
const rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const report={schemaVersion:'seti-native-income-control-v1',sourceCommit:preflight.sourceCommit,seed,beforeInput:input,
 question:'At the first computer income, does the greedy energy selection hide a strictly better card-income endpoint?',
 scope:'Two literal Native branches, end of the same own turn; not an autonomous game or a final-score comparison.',
 sourceFiles:preflight.sourceFiles,prefixInputs:0,branchInputs:0,newAutonomousGames:0,newAISearches:0,branches:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(action){const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const chosen=legal().find(a=>a.actionId===action.actionId&&a.family===action.family&&a.actorId===action.actorId&&digest(a.target||{})===digest(action.target||{}));
 assert(chosen,'Native action unavailable '+action.actionId);
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:chosen})
  :chosen.phase==='quick'?c.inputPort.submitQuickAction(chosen):c.inputPort.submitAction(chosen);
 assert(result.ok,JSON.stringify(result));return chosen;
}
function snapshot(){const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{const n=port.openRoot(),o=n.observation;return {observation:o,legalActions:n.legalActions,value:createStateValueEvaluator(seat).details(o)};}
 finally{port.close();}
}
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});c.inputPort.beginDrain({metadata:{source:'research-archive'}});
 report.phase='reconstructing';persist();
 for(let i=0;i<input-1;i++){
  submit(archive.actions[i].action);report.prefixInputs++;
  fs.writeFileSync(path.join(dir,'early-investment-prefix-checkpoint-20261119-v1.json.gz'),zlib.gzipSync(JSON.stringify({input:i+1,envelope:c.lifecycle.save().envelope})));
 }
 const root=c.lifecycle.save().envelope,observed=snapshot();
 assert.deepEqual(observed.observation.publicState,context.observation.publicState,'public root drift');
 assert.deepEqual(observed.observation.selfState,context.observation.selfState,'private root drift');
 const key=a=>({actionId:a.actionId,family:a.family,actorId:a.actorId,target:a.target||{},payload:a.payload||{}});
 assert.deepEqual(observed.legalActions.map(key),context.legalActions.map(key),'legal root drift');
 assert.deepEqual(c.lifecycle.save().envelope,root,'inspection changed root or RNG');
 report.rootVerified=true;report.rootEnvelopeSha256=digest(root);report.originalGreedyActionId=trace.actionId;
 fs.writeFileSync(path.join(dir,'early-investment-income-root-20261119-v1.json.gz'),zlib.gzipSync(JSON.stringify({envelope:root,context})));
 const state=root.session?.session?.workingState||JSON.parse(root.committedState);
 const player=state.players.players.find(p=>p.id===seat);
 report.rankings=player.hand.map(card=>({cardId:card.cardId,id:card.id,gain:cards.getIncomeGainForCard(card),
  greedyIncomeValue:demand.incomeCardValue(state,seat,card),computerIncomeValue:demand.computerIncomeValue(state,seat,card)}));
 report.phase='branching';persist();
 for(const choice of context.legalActions){
  assert(c.lifecycle.restore(root).ok);assert.deepEqual(c.lifecycle.save().envelope,root);
  const branch={choice:key(choice),steps:[]};report.branches.push(branch);persist();
  branch.steps.push(key(submit(choice)));report.branchInputs++;branch.afterIncome=snapshot();persist();
  // All other own choices are deliberately held fixed: close this same turn.
  const end=legal().find(a=>a.family==='end_turn'&&a.actorId===seat);assert(end,'income did not reach the expected post-main state');
  branch.steps.push(key(submit(end)));report.branchInputs++;branch.atBoundary=snapshot();
  const envelope=c.lifecycle.save().envelope;branch.finalEnvelopeSha256=digest(envelope);
  fs.writeFileSync(path.join(dir,`early-investment-${choice.actionId.split(':')[1]}-endpoint-20261119-v1.json.gz`),zlib.gzipSync(JSON.stringify({envelope,branch})));
  persist();
 }
 report.phase='complete';report.passed=true;persist();
 console.log(JSON.stringify({passed:true,beforeInput:input,prefixInputs:report.prefixInputs,branchInputs:report.branchInputs,rankings:report.rankings,
  branches:report.branches.map(b=>({choice:b.choice.actionId,value:b.atBoundary.value,public:b.atBoundary.observation.publicState.players.find(p=>p.playerId===seat),hand:b.atBoundary.observation.selfState.hand}))}));
}catch(e){report.phase='failed';report.failure={message:e.message,stack:e.stack};persist();console.error(e.stack);process.exitCode=1;}
finally{c.dispose();}

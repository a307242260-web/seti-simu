'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const load=p=>JSON.parse(fs.readFileSync(p)),manifest=load(path.join(dir,process.argv[2]||'board06-input302-profile-preflight-20261119-v1.json'));
const output=path.join(dir,process.argv[3]||'board06-input302-native-profile-20261119-v1.json');
assert(!fs.existsSync(output),'reuse existing profile');
const rt=manifest.runtime,sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const [name,expected]of Object.entries(manifest.sourceFiles)){
 const expectedHash=name===manifest.profileFile?manifest.profileSha256:expected;
 assert.equal(sha(fs.readFileSync(path.join(rt,name))),expectedHash,name);
}
const raw=fs.readFileSync(path.join(repo,manifest.rootCheckpoint));assert.equal(sha(raw),manifest.rootCheckpointSha256);
const checkpoint=JSON.parse(raw),envelope=checkpoint.coreState.compositionEnvelope;
const original=JSON.parse(fs.readFileSync(path.join(repo,manifest.attemptTrace),'utf8').trim().split('\n').at(-1));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {searchDecision}=require(path.join(rt,'randomizer/game/ai/decision-search'));
const values=require(path.join(rt,'randomizer/game/ai/state-value'));
const outcome=require(path.join(rt,'randomizer/game/ai/outcome-model'));
const seed=checkpoint.config.seed,seat='player-white',random=createSeededRandom(seed);
const rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId)});
let port;
const report={sourceCommit:manifest.sourceCommit,rootCheckpointSha256:manifest.rootCheckpointSha256,
 newAutonomousGames:0,newCommittedGameInputs:0,phase:'restoring',diagnosticOnly:true,
 limits:manifest.limits,profileTimingsAreNotProductionGateEvidence:true};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');save();
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(envelope).ok);
 assert.deepEqual(c.lifecycle.save().envelope,envelope);
 globalThis.__setiNativeProfile={started:performance.now(),rows:[]};
 port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:256});
 const root=port.openRoot(),first=root.legalActions[0];
 const observation=outcome.createDecisionObservation(root.observation,{seatId:seat,stateVersion:first?.stateVersion??null,decisionVersion:first?.decisionVersion??null});
 assert.deepEqual(observation,original.context.observation,'restored official observation differs');
 const evaluate=values.createStateValueEvaluator(seat),started=performance.now();
 const result=searchDecision({port,root,evaluate,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null},
  modelKey:JSON.stringify({version:values.MODEL_VERSION,seatId:seat,weights:values.DEFAULT_WEIGHTS}),
  movementPlanning:true,cardPickPlanning:true,resourcePlanning:true,finalMarkPlanning:true,scanPlanning:true,
  resourceDominance:true,moneyCapacityDominance:true,cardTradePruning:true,postMainPruning:true,
  openingPruning:true,cardChoiceEquivalence:true,planReuse:true});
 const rows=globalThis.__setiNativeProfile.rows;
 report.rows=rows;report.diagnosticMilliseconds=performance.now()-started;
 report.search={complete:result.complete,actionId:result.actionId,value:result.value,diagnostics:result.diagnostics};
 report.original={complete:original.search.complete,actionId:original.search.actionId,value:original.search.value,nativeInputs:original.search.diagnostics.nativeExecutions};
 report.sameActionValueAndNativeCount=result.complete===original.search.complete&&result.actionId===original.search.actionId
  &&result.value===original.search.value&&result.diagnostics.nativeExecutions===original.search.diagnostics.nativeExecutions;
 assert.equal(rows.length,result.diagnostics.nativeExecutions);
 assert(rows.length<=320&&result.diagnostics.nodes<=1024&&result.diagnostics.peakFrontier<=128);
 const groups=new Map(),families={};
 for(const row of rows){families[row.family]=(families[row.family]||0)+1;if(!groups.has(row.key))groups.set(row.key,[]);groups.get(row.key).push(row);}
 report.nativeFamilies=families;report.exactDuplicateGroups=[...groups].filter(([,r])=>r.length>1).map(([key,r])=>({key,rows:r}));
 report.maximumExactDuplicateSaving=rows.length-groups.size;report.uniquePhysicalInputs=groups.size;
 assert.deepEqual(c.lifecycle.save().envelope,envelope,'main root or RNG was changed by diagnostic search');
 report.rootAndRngUnchanged=true;report.portDiagnostics=port.getDiagnostics();
 assert(report.sameActionValueAndNativeCount,'diagnostic does not match the original failed search');
 report.phase='complete';save();
 console.log(JSON.stringify({phase:report.phase,nativeInputs:rows.length,nativeFamilies:families,
  exactDuplicateSaving:report.maximumExactDuplicateSaving,uniquePhysicalInputs:groups.size,
  sameActionValueAndNativeCount:true,diagnosticMilliseconds:report.diagnosticMilliseconds}));
}catch(error){
 report.rows=globalThis.__setiNativeProfile?.rows||[];report.phase='failed';report.failure={message:error.message,stack:error.stack};save();console.error(error.stack);process.exitCode=1;
}finally{delete globalThis.__setiNativeProfile;port?.close();c.dispose();}

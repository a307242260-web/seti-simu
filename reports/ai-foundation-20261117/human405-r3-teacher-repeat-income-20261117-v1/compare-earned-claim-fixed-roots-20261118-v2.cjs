'use strict';
// Usage: node this.cjs <after-root> <before-root-at-32e> [after-port] [new-output.gz]
// Replays recorded inputs, never the newly selected actions. Fresh ports on
// every White root compare complete searches without generating another game.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.argv[2]||path.resolve(__dirname,'../../..'),beforeRoot=process.argv[3]||root,afterPort=process.argv[4]||'randomizer/game/ai/analysis-port.js';
const load=(r,n)=>require(path.join(r,n));
const codeSha=(r,n)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(r,n))).digest('hex');
assert.equal(codeSha(beforeRoot,'randomizer/game/ai/goal-movement.js'),codeSha(root,'randomizer/game/ai/goal-movement.js'));
assert.equal(codeSha(root,'randomizer/game/ai/goal-movement.js'),'ddf1d7eec4f2ca1eb98595d7f829945943f557eaa06d43025acf2343a2343e55');
const before=load(beforeRoot,'randomizer/game/ai/analysis-port.js'),after=load(root,afterPort),agents={before:load(beforeRoot,'randomizer/game/ai/search-agent'),after:load(root,'randomizer/game/ai/search-agent')};
const {createSeededRandom}=load(root,'randomizer/game/random'),{createSimulationRuleComposition}=load(root,'randomizer/training/simulation-rule-composition'),{buildRuleObservation}=load(root,'randomizer/app/rule-observation');
const dir=path.join(root,'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1'),out=process.argv[5]||path.join(dir,'earned-claim-fixed-roots-20261118-v2.json.gz');assert(!fs.existsSync(out),'do not repeat the same corpus');
const archive=JSON.parse(fs.readFileSync(path.join(root,'reports/research/2170d824.5fabd621.replay.json'))),seat='player-white',random=createSeededRandom(archive.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const k=createSimulationRuleComposition({seed:archive.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v,c)=>buildRuleObservation(s,archive.seed,v?.playerId||null,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true,trustedCommitted:c?.trustedCommitted===true,trustedFrozenWorking:c?.trustedFrozenWorking===true})}),c=k.composition;
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(ordered(x))).digest('hex');
const graphDigest=x=>digest(JSON.parse(JSON.stringify(x,(_k,v)=>['seti-goal-movement-policy-v7','seti-goal-movement-policy-v8'].includes(v)?'movement-policy-version':v)));
function decisionLines(lines){
 return lines.map(line=>{
  const selection=line.cardPickPolicy?.selection;
  if(!selection||!Object.hasOwn(selection,'cache'))return line;
  if(!['hit','miss'].includes(selection.cache))return line;
  const {cache,...decision}=selection;
  return {...line,cardPickPolicy:{...line.cardPickPolicy,selection:decision}};
 });
}
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),save=()=>c.lifecycle.save().envelope;
const sources={before:beforeRoot,after:root,hashes:{}};for(const name of ['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/effects/residual-domain-session.js'])sources.hashes[name]={before:codeSha(beforeRoot,name),after:codeSha(root,name)};
const result={sources,kind:'paired fixed historical Native roots, no autonomous game',beforeSource:'See source file hashes and archived candidate-source manifests; historical result parent label was inherited metadata, not paired baseline',change:'v488 to v489 quote known earned B117 task after identity-only pickup; unknown fossil rewards not priced',allowedDiagnosticDifference:'ranking cache hit/miss and movement policy version markers only; actual selected actions/value/native/full graphs strict in rounds1-3; round4 expected policy changes retained',gate:{native:256,milliseconds:600},rows:[],failure:null,fullReplayVerified:false};
function checkpoint(){fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)))}
function compare(label){
 const original=save(),legal=menu(),state=original.session?.session?.workingState||JSON.parse(original.committedState),round=state.turn.roundNumber,cases=[],graphs=[];
 for(const [kind,portModule] of [['before',before],['after',after]]){
  const p=portModule.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{
   const q=agents[kind].createSearchAgent({seatId:seat,analysisPort:p}).decide({seatId:seat,legalActions:legal}).search;assert(q);assert.deepEqual(save(),original,'root and RNG changed');
   graphs.push({roots:q.roots,lines:q.lines});cases.push({kind,actionId:q.actionId,value:q.value,complete:q.complete,unresolved:q.unresolved,native:q.diagnostics.nativeExecutions,ms:q.rootAndSearchMilliseconds,rootsSha256:graphDigest(q.roots),linesSha256:graphDigest(decisionLines(q.lines)),rawLinesSha256:digest(q.lines),logicalNodes:q.diagnostics.nodeCount,physical:q.analysis,knownPickupTaskQuotes:q.lines.filter(l=>l.knownPickupTask).map(l=>({node:l.node,...l.knownPickupTask}))});
  }finally{p.close()}
 }
 const [a,b]=cases,keys=['actionId','value','complete','unresolved','native','rootsSha256','linesSha256'];
 const exact=keys.every(key=>JSON.stringify(b[key])===JSON.stringify(a[key]));for(const key of keys.filter(k=>round<=3||["complete","unresolved","native"].includes(k)))assert.deepEqual(b[key],a[key],`${label} round${round} ${key}`);const semanticProof=require("./verify-earned-task-search-graphs-20261118-v1.cjs").verify(graphs[0],graphs[1]);
 const row={label,round,rootSha256:digest(original),cases,exactSearchEquality:exact,semanticProof,rootAndRngIsolated:true};result.rows.push(row);
 if(!b.complete||b.unresolved.length||b.native>256||b.ms>600){result.failure={label,native:b.native,ms:b.ms,complete:b.complete};(result.budgetFailures??=[]).push(result.failure);}
 if(result.failure||result.rows.length%25===0)console.log(JSON.stringify({roots:result.rows.length,...row,rootSha256:undefined,cases:cases.map(({kind,native,ms})=>({kind,native,ms}))}));
 checkpoint();return true;
}
try{
 c.lifecycle.newGame({seed:archive.seed,activePlayerCount:archive.activePlayerCount,initialize:true,rngState});c.inputPort.beginDrain({metadata:{source:'fixed-roots-prefix-cost-parity'}});
 for(const [i,{action}] of archive.actions.entries()){
  if(i>=23&&action.actorId===seat&&!compare('AI272-input-'+(i+1)))break;
  const a=menu().find(a=>a.actionId===action.actionId&&a.family===action.family&&a.actorId===action.actorId&&digest(a.target||{})===digest(action.target||{}));assert(a,`fixed input missing ${i+1}`);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
 }
 {
  const e=save(),s=JSON.parse(e.committedState);assert.deepEqual({nativeStateSha256:digest(s),sessionSha256:digest(e.session),rng:s.meta.rngState},archive.expected);assert(s.turn.gameEnded);result.fullReplayVerified=true;
  const points=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(dir,'teacher-r4-prefix-cold-points-20261118-v1.json.gz')))).points;
  for(const point of points){assert(c.lifecycle.restore(point.root).ok);assert.deepEqual(save(),point.root);if(!compare('teacher-input-'+point.teacherInput))break;}
 }
 assert(c.lifecycle.restore(JSON.parse(z.gunzipSync(fs.readFileSync(path.join(dir,'teacher-r4-point289-search-20261118-v1.json.gz')))).root).ok);compare('teacher-input-289');
 result.changedR4=result.rows.filter(r=>r.round===4&&!r.exactSearchEquality).map(r=>({label:r.label,before:{action:r.cases[0].actionId,value:r.cases[0].value,native:r.cases[0].native},after:{action:r.cases[1].actionId,value:r.cases[1].value,native:r.cases[1].native}}));result.completed=!result.failure;result.fullCorpusCompared=result.rows.length===317;result.rootCount=result.rows.length;checkpoint();console.log(JSON.stringify({roots:result.rows.length,completed:result.completed,fullReplayVerified:result.fullReplayVerified,failure:result.failure,peakAfterNative:Math.max(...result.rows.map(r=>r.cases[1].native)),peakAfterMs:Math.max(...result.rows.map(r=>r.cases[1].ms)),budgetFailures:result.budgetFailures,fullCorpusCompared:result.fullCorpusCompared}));if(result.failure)process.exitCode=1;
}finally{c.dispose()}

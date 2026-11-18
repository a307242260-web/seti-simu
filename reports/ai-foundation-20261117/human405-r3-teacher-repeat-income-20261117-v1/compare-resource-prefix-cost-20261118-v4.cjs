'use strict';
// Usage: node this.cjs <after-root> <before-root-at-32e> [after-port] [new-output.gz]
// Replays recorded inputs, never the newly selected actions. Fresh ports on
// every White root compare complete searches without generating another game.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.argv[2]||path.resolve(__dirname,'../../..'),beforeRoot=process.argv[3]||root,afterPort=process.argv[4]||'randomizer/game/ai/analysis-port.js';
const load=(r,n)=>require(path.join(r,n));
const codeSha=(r,n)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(r,n))).digest('hex');
assert.equal(codeSha(beforeRoot,'randomizer/game/ai/analysis-port.js'),'0a93fbdddde18f74b3c70beac3f0bc55cce53c1479408a98866914c00bd7e4ae','before-root must contain the published32e analysis adapter');
assert.equal(codeSha(root,afterPort),'54204f98794081e7c189859f99d6b88f879a74780ed0d860ca30ced0691ba0d8','after-root must contain the admitted v485 adapter');
const before=load(beforeRoot,'randomizer/game/ai/analysis-port.js'),after=load(root,afterPort),{createSearchAgent}=load(root,'randomizer/game/ai/search-agent');
const {createSeededRandom}=load(root,'randomizer/game/random'),{createSimulationRuleComposition}=load(root,'randomizer/training/simulation-rule-composition'),{buildRuleObservation}=load(root,'randomizer/app/rule-observation');
const dir=path.join(root,'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1'),out=process.argv[5]||path.join(dir,'resource-prefix-cost-fixed-roots-20261118-v4.json.gz');assert(!fs.existsSync(out),'do not repeat the same corpus');
const archive=JSON.parse(fs.readFileSync(path.join(root,'reports/research/2170d824.5fabd621.replay.json'))),seat='player-white',random=createSeededRandom(archive.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const k=createSimulationRuleComposition({seed:archive.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v,c)=>buildRuleObservation(s,archive.seed,v?.playerId||null,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true,trustedCommitted:c?.trustedCommitted===true,trustedFrozenWorking:c?.trustedFrozenWorking===true})}),c=k.composition;
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(ordered(x))).digest('hex');
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
const result={kind:'paired fixed historical Native roots, no autonomous game',beforeSource:'32e6e33c61c25ea74c806c23127b60f2ee6433bb',change:'share exact immutable physical identity for resource views; fixed-card query only on decision nodes',allowedDiagnosticDifference:'lines[].cardPickPolicy.selection.cache hit/miss only; actual selection and all other graph data strict',gate:{native:256,milliseconds:600},rows:[],failure:null,fullReplayVerified:false};
function checkpoint(){fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)))}
function compare(label){
 const original=save(),legal=menu(),cases=[];
 for(const [kind,portModule] of [['before',before],['after',after]]){
  const p=portModule.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{
   const q=createSearchAgent({seatId:seat,analysisPort:p}).decide({seatId:seat,legalActions:legal}).search;assert(q);assert.deepEqual(save(),original,'root and RNG changed');
   cases.push({kind,actionId:q.actionId,value:q.value,complete:q.complete,unresolved:q.unresolved,native:q.diagnostics.nativeExecutions,ms:q.rootAndSearchMilliseconds,rootsSha256:digest(q.roots),linesSha256:digest(decisionLines(q.lines)),rawLinesSha256:digest(q.lines),logicalNodes:q.diagnostics.nodeCount,physical:q.diagnostics.analysisPort});
  }finally{p.close()}
 }
 const [a,b]=cases;for(const key of ['actionId','value','complete','unresolved','native','rootsSha256','linesSha256'])assert.deepEqual(b[key],a[key],`${label} ${key}`);
 const row={label,rootSha256:digest(original),cases,exactSearchEquality:true,rootAndRngIsolated:true};result.rows.push(row);
 if(!b.complete||b.unresolved.length||b.native>256||b.ms>600)result.failure={label,native:b.native,ms:b.ms,complete:b.complete};
 if(result.failure||result.rows.length%25===0)console.log(JSON.stringify({roots:result.rows.length,...row,rootSha256:undefined,cases:cases.map(({kind,native,ms})=>({kind,native,ms}))}));
 checkpoint();return !result.failure;
}
try{
 c.lifecycle.newGame({seed:archive.seed,activePlayerCount:archive.activePlayerCount,initialize:true,rngState});c.inputPort.beginDrain({metadata:{source:'fixed-roots-prefix-cost-parity'}});
 for(const [i,{action}] of archive.actions.entries()){
  if(i>=23&&action.actorId===seat&&!compare('AI272-input-'+(i+1)))break;
  const a=menu().find(a=>a.actionId===action.actionId&&a.family===action.family&&a.actorId===action.actorId&&digest(a.target||{})===digest(action.target||{}));assert(a,`fixed input missing ${i+1}`);const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
 }
 if(!result.failure){
  const e=save(),s=JSON.parse(e.committedState);assert.deepEqual({nativeStateSha256:digest(s),sessionSha256:digest(e.session),rng:s.meta.rngState},archive.expected);assert(s.turn.gameEnded);result.fullReplayVerified=true;
  const points=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(dir,'teacher-r4-prefix-cold-points-20261118-v1.json.gz')))).points;
  for(const point of points){assert(c.lifecycle.restore(point.root).ok);assert.deepEqual(save(),point.root);if(!compare('teacher-input-'+point.teacherInput))break;}
 }
 result.completed=!result.failure;checkpoint();console.log(JSON.stringify({roots:result.rows.length,completed:result.completed,fullReplayVerified:result.fullReplayVerified,failure:result.failure,peakAfterNative:Math.max(...result.rows.map(r=>r.cases[1].native)),peakAfterMs:Math.max(...result.rows.map(r=>r.cases[1].ms))}));if(result.failure)process.exitCode=1;
}finally{c.dispose()}

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),Module=require('node:module');
const implementation=process.argv[2]||require.resolve('./research-human405-full');
const code=fs.readFileSync(implementation,'utf8'),hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const paths={v123Proof:'reports/ai-foundation-20261023/human405-v123-completion-runtime-source-check-20261031-v1.json',
 v189Proof:'reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json',
 v189Verify:'reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-native-verification-20261105-v1.json',
 prefixAdmission:'reports/ai-foundation-20261109/v661-early-transport-boundary-v1/v661-source-admission-proof-20261109-v1.json',
 r4Admission:'reports/ai-foundation-20261110/v661-r4-amiba1-v1/r4-resume-admission-20261110-v1.json'};
let checked=0;
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seti-frozen-identity-')),reads=[];
 const write=(name,value)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));return file;};
 const digest=name=>hash(fs.readFileSync(path.join(root,name)));
 const sentinel='randomizer/game/ai/identity-fixture.js',analysis='randomizer/game/ai/analysis-port.js';
 write(sentinel,'current runtime');write(analysis,'current analysis port');
 const hashes={[sentinel]:digest(sentinel),[analysis]:digest(analysis)};
 const prefix=Array.from({length:23},(_,i)=>({actorPlayerId:'player-white',action:{actionId:'opening:'+i,family:'pass'}}));
 const first={ID:'human405-white-round1-v1',TWO_ROUND_ID:'human405-white-first2-v1',FIRST_THREE_ROUNDS_ID:'human405-white-first3-v1',opening:()=>({checkpoint:{replaySteps:prefix}})};
 const filename=path.join(root,'tools/research-human405-full.js'),loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=module.paths;
 const native=loaded.require.bind(loaded);
 loaded.require=id=>{
  if(id==='fs'||id==='node:fs')return{...fs,readFileSync(file,...args){reads.push(path.relative(root,file));return fs.readFileSync(file,...args);}};
  if(id==='./research-human405-round1')return first;
  if(id==='../randomizer/game/ai/search-agent')return{};
  if(id==='../randomizer/app/simulation-env')return{createSimulationEnv(){throw Error('NATIVE_ENV_MUST_NOT_START');}};
  return native(id);
 };
 loaded._compile(code,filename);
 function metadata(kind,drift){
  const expected={...hashes,...(drift?{[sentinel]:hash('old runtime')}: {})};
  write(paths.v123Proof,{runtimeSourceHashes:expected,sourceCommit:'fixture'});
  write(paths.v189Proof,{runtimeSourceHashes:expected,sourceCommit:'fixture',firstTwoRoundLearningRequirementsProven:true});
  write('fixture/runtime-manifest.json',{runtimeHashes:expected});
  write(paths.prefixAdmission,{manifest:'fixture/runtime-manifest.json',manifestSha256:digest('fixture/runtime-manifest.json')});
  write(paths.r4Admission,{schemaVersion:'seti-r4-continuation-admission-v1',scenario:loaded.exports.R4_ID,runtimeHashes:expected});
  for(const version of ['v1','v2','v3'])write(`reports/ai-foundation-20261113/prepass-funded-landing/r4-staged-landing-admission-20261113-${version}.json`,
   {schemaVersion:'seti-staged-landing-continuation-v1',scenario:loaded.exports.STAGED_LANDING_ID,runtimeHashes:expected});
 }
 return{root,reads,write,digest,hashes,prefix,first,metadata,scenario:loaded.exports,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
const variants=[['ID','FULL_CONTINUATION_STRATEGY_DRIFT','reports/research/19bd7474.94530144.quick-200.json'],
 ['V189_ID','FULL_CONTINUATION_STRATEGY_DRIFT','reports/research/e01243ba.93989585.quick-400.json'],
 ['V661_ID','V661_CONTINUATION_SOURCE_DRIFT','reports/research/815da7fc.de3eb34e.quick-400.json'],
 ['R4_ID','R4_CANDIDATE_SOURCE_DRIFT','reports/research/815da7fc.de3eb34e.quick-400.json'],
 ['STAGED_LANDING_ID','STAGED_LANDING_RUNTIME_DRIFT','reports/research/11ef28bc.5135a5a0.quick-400.json']];
for(const [kind,error,archive]of variants)for(const corruptArchive of [false,true]){
 const f=fixture();try{
  f.metadata(kind,true);if(corruptArchive)f.write(archive,'not JSON');
  assert.throws(()=>f.scenario.continuation(f.scenario[kind]),new RegExp(error));
  assert(!f.reads.some(file=>file.startsWith('reports/research/')||file.startsWith('seti-saves/')),'wrong runtime must not read historical payloads');checked++;
 }finally{f.close();}
}
for(const [kind,_error,archive]of variants){const f=fixture();try{
 f.metadata(kind,false);
 assert.throws(()=>f.scenario.continuation(f.scenario[kind]),error=>error.code==='ENOENT'&&error.path===path.join(f.root,archive));
 assert(f.reads.includes(archive),'matching code must still validate its archived data');checked++;
}finally{f.close();}}
{
 const f=fixture();try{assert.throws(()=>f.scenario.continuation('unknown'),/RESEARCH_SCENARIO_UNKNOWN/);assert.deepEqual(f.reads,[]);checked++;}finally{f.close();}
}
{
 const f=fixture();try{
  f.metadata('V189_ID',false);
  const recordPath=variants[1][2],savePath='seti-saves/v189-fixture.json',tracePath='fixture/v189-trace.jsonl';
  const save={committedState:JSON.stringify({turn:{roundNumber:3}}),session:null,
   replaySteps:[...f.prefix,...Array.from({length:102},()=>({actorPlayerId:'player-white',action:{actionId:'tail',family:'pass'}}))]};
  const record={gitCommit:'93989585',steps:125,scenario:{id:f.first.TWO_ROUND_ID},terminal:false,
   roundEnds:[{round:1,score:15},{round:2,score:50}],savePath,agentTracePath:tracePath,wallMs:12};
  f.write(savePath,save);f.write(tracePath,'trace fixture');f.write(recordPath,record);
  const verification={recordSha256:f.digest(recordPath),saveSha256:f.digest(savePath),traceSha256:f.digest(tracePath)};
  f.write(paths.v189Verify,verification);
  const result=f.scenario.continuation(f.scenario.V189_ID);assert.equal(result.provenance.steps,125);assert.equal(result.provenance.saveSha256,verification.saveSha256);checked++;
  for(const file of [recordPath,savePath,tracePath]){
   const original=fs.readFileSync(path.join(f.root,file));f.write(file,original.toString()+'\n');
   assert.throws(()=>f.scenario.continuation(f.scenario.V189_ID),/V189_CONTINUATION_SOURCE_DRIFT/);fs.writeFileSync(path.join(f.root,file),original);checked++;
  }
  save.replaySteps[0]={...save.replaySteps[0],action:{actionId:'wrong-prefix'}};
  f.write(savePath,save);f.write(paths.v189Verify,{...verification,saveSha256:f.digest(savePath)});
  assert.throws(()=>f.scenario.continuation(f.scenario.V189_ID),error=>error.code==='ERR_ASSERTION');checked++;
 }finally{f.close();}
}
console.log(JSON.stringify({frozenContinuationIdentity:'passed',checks:checked,sourceBeforePayload:true,matchingRuntimeStillChecksRecordSaveTraceAndPrefix:true,newNativeInputs:0}));

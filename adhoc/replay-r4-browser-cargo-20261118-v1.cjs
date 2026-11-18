'use strict';
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const R=path.resolve(__dirname,'..'),M=path.join(R,'reports/ai-foundation-20261118'),out=path.join(M,'r4-browser-cargo-replay-20261118-v1.json.gz');
if(fs.existsSync(out)){console.log('REUSE',out);process.exit(0);}
const read=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p))),input=path.join(M,'r4-browser-cargo-diagnosis-20261118-v1.json.gz'),d=read(input),manifest=JSON.parse(fs.readFileSync(path.join(M,'r4-main-owned-v513-source-20261118-v1.json')));process.chdir(manifest.sealedRoot);
const {open}=require(path.join(R,'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1/native-root-harness-20261118-v1.cjs')),m=open(d.root),trace=[],result={kind:'Replay already declared Native actions; no AI or new route planning',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),root:d.root,initialJobs:d.initialJobs,trace};
const persist=()=>fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));
try{
 for(const intended of d.expansion.actions){
  const before=m.save(),prior=structuredClone(m.state().aliens.chong.transportTasksByRocketId),actual=m.apply(intended),after=m.save(),jobs=structuredClone(m.state().aliens.chong.transportTasksByRocketId);trace.push({action:actual,before,after,beforeJobs:prior,afterJobs:jobs});persist();
 }
 const jobs=m.state().aliens.chong.transportTasksByRocketId,other=Object.values(d.initialJobs).find(j=>j.fossilId!==d.plan.goal.fossilId);
 assert.deepEqual(Object.values(jobs).find(j=>j.fossilId===other.fossilId),other,'Actual first delivery preserves the other fossil task');
 assert(!Object.values(jobs).some(j=>j.fossilId===d.plan.goal.fossilId),'Delivered F07 task is removed');
 assert.equal(jobs['5'],undefined);assert.deepEqual(jobs['7'],d.initialJobs['7']);
 assert.deepEqual(m.state().meta.rngState,JSON.parse(d.root.committedState).meta.rngState);
 const suffix=read(path.join(manifest.sealedRoot,'randomizer/game/ai/fixtures/cargo-unbound-suffix-20261118-v1.json.gz'));
 result.oldBrowserInvariant=false;result.correctOtherJobInvariant=true;result.deliveredFossil=d.plan.goal.fossilId;result.claimCard=d.plan.goal.cardId;result.nativeInputs=trace.length;result.final=m.save();result.exactExistingSuffixRoot=JSON.stringify(result.final)===JSON.stringify(suffix.root);result.suffixCommittedStateEqual=result.final.committedState===suffix.root.committedState;result.rngUnchanged=true;persist();
 console.log(JSON.stringify({nativeInputs:trace.length,claimCard:result.claimCard,deliveredFossil:result.deliveredFossil,correctOtherJobInvariant:true,oldBrowserInvariant:false,exactExistingSuffixRoot:result.exactExistingSuffixRoot,suffixCommittedStateEqual:result.suffixCommittedStateEqual}));
}catch(e){result.failure={message:e.message,stack:e.stack};persist();throw e;}
finally{m.dispose();}

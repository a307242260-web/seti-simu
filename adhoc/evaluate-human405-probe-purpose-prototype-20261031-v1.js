'use strict';
const fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const stateValue=require('../randomizer/game/ai/state-value'),{knownProbePurpose}=require('./prototype-human405-probe-purpose-20261031-v1');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const folder='reports/ai-foundation-20261023/',output=folder+'human405-probe-purpose-prototype-20261031-v1.json';assert(!fs.existsSync(output));const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),rows=[];
for(const step of [24,36,37,38,39,43,56,62]){
 const path=folder+`human405-v93-native-witness-comparison-step${step}${step===56?'-fixed-prefix':''}-20261031-v1.json`,r=JSON.parse(fs.readFileSync(path));assert.equal(sha(r.rawPath),r.rawSha256);const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(r.rawPath)));
 for(let i=0;i<raw.length;i++){
  const obs=raw[i].observation,before=stateValue.evaluateStateValue(obs,'player-white'),futureOption=knownProbePurpose(obs,'player-white',stateValue.DEFAULT_WEIGHTS),fundedOption=knownProbePurpose(obs,'player-white',stateValue.DEFAULT_WEIGHTS,{fundedOnly:true});
  assert.equal(before.total,r.rows[i].value.total);assert(futureOption.value<=futureOption.grossCeiling);assert(fundedOption.value<=futureOption.value);
  rows.push({step,name:raw[i].name,sourceReport:path,sourceReportSha256:sha(path),nativeBoundary:r.rows[i].boundary,baseValue:before.total,components:before.components,
   futureOption,fundedOption,valueWithFutureOption:before.total+futureOption.value,valueWithFundedOption:before.total+fundedOption.value});
 }
}
const recordPath='reports/research/5f529430.f2cde3d2.quick-200.json',record=JSON.parse(fs.readFileSync(recordPath)),save=JSON.parse(fs.readFileSync(record.savePath)),fixture=JSON.parse(fs.readFileSync('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-024-20261030-v1.json')),seed=record.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});let autonomous;
try{assert(k.composition.lifecycle.restore({...fixture.compositionEnvelope,committedState:save.committedState,session:save.session}).ok);const obs=k.composition.projection({role:'player',playerId:'player-white'}).state;autonomous=stateValue.evaluateStateValue(obs,'player-white');assert.equal(knownProbePurpose(obs,'player-white',stateValue.DEFAULT_WEIGHTS).value,0);}finally{k.composition.dispose();}
const teacherR2=rows.find(r=>r.step===62&&r.name==='teacher-first');
const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
const report={schemaVersion:'seti-probe-purpose-value-prototype-v1',sourceCommit:'f2cde3d2f7005df3944e66b15ee73bcda6ec22dc',prototypeSource:'adhoc/prototype-human405-probe-purpose-20261031-v1.js',prototypeSha256:sha('adhoc/prototype-human405-probe-purpose-20261031-v1.js'),rows,sourceHashes,
 commonRoundEnd:{recordPath,recordSha256:sha(recordPath),autonomous,teacher:{total:teacherR2.baseValue,components:teacherR2.components},teacherMinusAutonomous:teacherR2.baseValue-autonomous.total},
 scope:'Read-only sensitivity on previously independently natively replayed current-policy witnesses. One next ordinary probe mission only; max rather than sum prevents claiming shared first rewards multiple times. Known endpoint gain/card count minus native remaining cost; income, scan, traces, data and route publicity omitted. Future-option and already-funded variants are explicit hypotheses, not promised attainable rewards. No production model/search/bound change or autonomous run.',
 productionAdmitted:false,baselineEligible:false,goalStatus:'active'};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,opening:rows.filter(r=>r.step===24).map(r=>({name:r.name,base:r.baseValue,future:r.futureOption.value,funded:r.fundedOption.value,chosen:r.futureOption.selected?.requirementId})),commonRoundEnd:report.commonRoundEnd}));

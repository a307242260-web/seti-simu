'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const [proofPath,suffixPath,archivePath]=process.argv.slice(2);
const lib=require(path.resolve('tools/robot-iteration-lib')),runner=require(path.resolve('tools/run_research_validation')),
 scenario=require(path.resolve('tools/research-human405-round1'));
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n',{flag:'wx'});
const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const base='0b26c36498ba78740547a12335eb6da8dae893ea',D='reports/ai-foundation-20261108/v634-transport-data-preparation-v1/';
const id='ai-search-v634-white-first3-20261108';
const old=read(lib.REGISTRY_PATH),versions=lib.loadVersions();
assert(!old.versions.some(v=>v.id===id)&&!versions.versions.some(v=>v.id===id));
const identity=runner.buildIdentity({config:{agentType:'search',scenario:scenario.FIRST_THREE_ROUNDS_ID,compactReplay:true},steps:400});
const fingerprint=runner.fingerprintOf(identity),key=fingerprint.slice(0,8)+'.'+head.slice(0,8)+'.quick-400';
assert.equal(key,'cd68bc86.0412a8b9.quick-400');
const recPath='reports/research/'+key+'.json',raw=recPath+'.decisions.jsonl',proof=read(proofPath),suffix=read(suffixPath);
assert.equal(proof.traceSha256,sha(raw));
assert.equal(proof.confirmedInputs,147);assert.equal(suffix.resumeStep,147);assert.equal(suffix.steps,259);assert(suffix.identicalActionsToV630);
const env=scenario.createEnvironment({},identity.scenario);let save;
try{env.loadCheckpoint(proof.recovery);save=env.saveBrowserSave({name:id+'-recovered-at-input147'});}
finally{env.dispose();}
assert.equal(save.replaySteps.length,147);
const savePath='seti-saves/seti-save-research-v634-interrupted-recovered-147-20261108.json';
write(savePath,save);
const searches=fs.readFileSync(raw,'utf8').trim().split('\n').map((s,i)=>({i:24+i,row:JSON.parse(s)})).flatMap(({i,row})=>
 typeof row.search?.rootAndSearchMilliseconds==='number'?[{step:i,seat:row.context.seatId,action:row.actionId,complete:row.search.complete,
   rootAndSearchMilliseconds:row.search.rootAndSearchMilliseconds,diagnostics:row.search.diagnostics}]:[]);
assert.equal(searches.length,proof.inputCount);
const note='磁盘写入中断；原生复放确认到第 147 输入及前两轮 15／48，第三轮无正式成绩。独立冷恢复对照另见证据。';
const record={schemaVersion:'seti-research-validation-record-v1',name:id,fingerprint,mode:'quick-400',...identity,steps:147,stepsLimit:400,
  createdAt:fs.statSync(raw).birthtime.toISOString(),terminal:false,status:'failed',stopReason:'artifact-write-enospc',wallMs:null,
  elapsedObservedLowerBoundMs:6581,scoreSemantics:identity.scenario.scoreSemantics,
  searchCoverage:'verified-prefix-only',scenarioResult:{firstThreeRoundsSettled:false,openingInputs:23,newInputsAfterOpening:124,completedRoundEnds:[1,2]},
  roundEnds:proof.previousRounds.map(x=>x.assets),roundEndsPath:recPath+'.round-ends.jsonl',savePath,
  summary:{round:3,terminal:false,scores:{},avgScore:null},metrics:{searches,budgetHits:[]},
  failure:{code:'ENOSPC',message:note,failedDecisionCommitted:null,firstUnconfirmedInput:148,rawTraceSha256:proof.traceSha256,evidenceArchive:archivePath,
   recoveryProof:D+path.basename(proofPath),coldSuffix:D+path.basename(suffixPath)}};
write(recPath,record);
const entry={id,aiGeneration:'v2',agentType:'search',name:'搜索 V634 · 正式验证中断',date:'2026-11-08',
 baseline:'ai-search-v41-baseline-20261029',head,commits:[head],summary:note,records:{[key+'.json']:{note}},baselineEligible:false,roadmap:null};
const result=lib.resolveVersionResults(entry,{[key+'.json']:record})[0];
assert(result.savePath&&result.reportPath&&!result.terminal&&!result.scores['player-white']);
fs.mkdirSync(path.dirname(result.reportPath),{recursive:true});
const report=lib.buildActionLogReport({savePath,versionId:id,versionName:entry.name,runKey:key,recordFile:key+'.json',
 gitCommit:head,policyVersion:record.policyVersion,flags:record.flags,wallMs:null,mode:record.mode});
fs.writeFileSync(result.reportPath,report.split('\n').map(s=>s.replace(/[ \t]+$/,'')).join('\n'),{flag:'wx'});
result.reportExists=true;
const diffBase=versions.versions.find(v=>v.id===entry.baseline)?.head;
const listed={...entry,commits:[lib.gitCommitInfo(head)],diffStat:lib.gitRangeShortStat(diffBase,head),diffFiles:lib.gitRangeNumstat(diffBase,head),
 results:[result],isHead:false,completeness:{record:true,save:true,report:true,reportLinks:[{runKey:key,path:result.reportPath,mode:record.mode}]}};
delete listed.records;delete listed.agentType;
lib.saveVersions({...versions,versions:[entry,...versions.versions]});
const previous=old.generations.v2,merged={...old,builtAt:new Date().toISOString(),headCommit:head,versions:[listed,...old.versions],
 generations:{...old.generations,v2:{...previous,recordCount:previous.recordCount+1,versionCount:previous.versionCount+1}}};
assert.equal(merged.generations.v2.currentBaseline,'ai-search-v41-baseline-20261029');
lib.writeJson(lib.REGISTRY_PATH,merged);lib.renderPage(merged);
write(D+'interrupted-registry-reconciliation-20261108-v1.json',{priorCommit:base,sourceCommit:head,id,record:recPath,save:savePath,report:result.reportPath,
 rowsPreserved:old.versions.length,v1Preserved:true,v2BaselinePreserved:true,v2BestOfPreserved:true,fullThirdRoundRecorded:false,coldSuffixRecorded:true});
console.log(JSON.stringify({record:recPath,save:savePath,report:result.reportPath,rowsPreserved:old.versions.length}));

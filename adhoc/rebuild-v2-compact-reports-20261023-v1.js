"use strict";
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{buildActionLogReport}=require('../tools/robot-iteration-lib');
const output='reports/ai-foundation-20261023/compact-report-rebuild-v1.json';assert(!fs.existsSync(output),'Reuse existing report rebuild checkpoint');
const registry=JSON.parse(fs.readFileSync('reports/iteration/registry.json')),rows=[],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const v of registry.versions.filter(v=>v.aiGeneration==='v2'))for(const r of v.results){
 assert(r.savePath && r.reportPath);const saveBytes=fs.readFileSync(r.savePath),save=JSON.parse(saveBytes),old=fs.readFileSync(r.reportPath,'utf8');
 const html=buildActionLogReport({savePath:r.savePath,versionId:v.id,versionName:v.name,runKey:r.recordFile.replace(/\.json$/,''),recordFile:r.recordFile,gitCommit:r.gitCommit,policyVersion:r.policyVersion,flags:r.flags,wallMs:r.wallMs,mode:r.mode});
 assert(!html.includes('R?·T?'));assert.equal(html.match(/<section class="panel final">[\s\S]*?<\/section>/)[0],old.match(/<section class="panel final">[\s\S]*?<\/section>/)[0],'正式终局分及明细保持原样');assert.deepEqual(fs.readFileSync(r.savePath),saveBytes);
 const playerTurns=Object.fromEntries([...html.matchAll(/([蓝绿棕白])色玩家 · (\d+) 个回合/g)].map(m=>[m[1],Number(m[2])]));assert.equal(Object.keys(playerTurns).length,4);assert(Object.values(playerTurns).every(n=>n>1));
 const row={version:v.id,reportPath:r.reportPath,savePath:r.savePath,sourceSaveSha256:sha(saveBytes),originalReportSha256:sha(old),reportSha256:sha(html),rawInputSteps:save.replaySteps.length,playerTurns,finalRound:JSON.parse(save.committedState).turn.roundNumber,finalScoreSectionUnchanged:true};
 fs.writeFileSync(r.reportPath,html);rows.push(row);fs.writeFileSync(output,JSON.stringify({scope:'Rebuild existing V2 report presentation from native replay, no AI run or original save/record changes.',complete:false,rows},null,2)+'\n');console.log(JSON.stringify({version:v.id,steps:row.rawInputSteps,playerTurns}));
}
assert.equal(rows.length,9);fs.writeFileSync(output,JSON.stringify({scope:'Rebuild existing V2 report presentation from native replay, no AI run or original save/record changes.',complete:true,rows,sourceHash:sha(fs.readFileSync('tools/robot-iteration-lib.js'))},null,2)+'\n');

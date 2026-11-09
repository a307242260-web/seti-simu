"use strict";
const fs=require("node:fs"), path=require("node:path"), assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const api=require(path.resolve("tools/robot-iteration-lib"));
const [ref,vid,saveRecord]=process.argv.slice(2);
const fromGit=file=>JSON.parse(execFileSync("git",["show",ref+":"+file],{encoding:"utf8",maxBuffer:32*1024*1024}));
const base=fromGit("reports/iteration/registry.json"), prior=fromGit("reports/iteration/versions.json"),
 now=api.loadVersions(), entry=now.versions.find(v=>v.id===vid);
assert(entry&&entry.baselineEligible===false&&entry.aiGeneration==="v2");
assert.deepEqual(now.versions.filter(v=>v.id!==vid),prior.versions);
const file=path.basename(saveRecord), record=api.readJson(saveRecord);
assert(record.terminal&&record.gitCommit===entry.head.slice(0,record.gitCommit.length));
assert.deepEqual(Object.keys(entry.records),[file]);
const result=api.resolveVersionResults(entry,{[file]:record})[0];
assert(result.reportExists&&result.scoreSource==="save-final"&&result.scores["player-white"]===216);
assert.equal(result.world.fingerprint,base.generations.v2.bestOf.world.fingerprint);
assert.equal(result.comparisonScope,"white-only-full-game");
const older=prior.versions.find(v=>v.id===entry.baseline);
const commits=entry.commits.map(c=>api.gitCommitInfo(c)).filter(Boolean);
const member={id:entry.id,aiGeneration:entry.aiGeneration,name:entry.name,date:entry.date,baseline:entry.baseline,
  head:entry.head,commits,summary:entry.summary,diffStat:api.gitRangeShortStat(older?.head||null,entry.head),
  diffFiles:api.gitRangeNumstat(older?.head||null,entry.head),results:[result],roadmap:null,baselineEligible:false,isHead:false,
  completeness:{record:true,save:true,report:true,reportLinks:[{runKey:file.replace(/\.json$/,""),path:result.reportPath,mode:result.mode}]}};
assert(!base.versions.some(v=>v.id===vid));
const versions=[member,...base.versions],generations={...base.generations,v2:{...base.generations.v2,
 versionCount:base.generations.v2.versionCount+1,recordCount:base.generations.v2.recordCount+1}};
const members=versions.filter(v=>v.aiGeneration==="v2"),resolved=Object.fromEntries(members.map(v=>[v.id,v.results]));
assert.deepEqual(api.computeBestOf(members,resolved),base.generations.v2.bestOf,
 "a controlled run must not alter the four-AI ranking");
const merged={...base,builtAt:new Date().toISOString(),headCommit:entry.head,worktreeDirty:false,versions,generations};
assert.deepEqual(merged.versions.slice(1),base.versions);
assert.equal(merged.currentBaseline,"ai-search-v41-baseline-20261029");
api.writeJson(api.REGISTRY_PATH,merged);
const p=api.renderPage(merged),html=fs.readFileSync(p,"utf8");
assert(html.includes(vid)&&html.includes(result.reportPath));
console.log(JSON.stringify({versions:versions.length,new:vid,baseline:merged.currentBaseline,report:result.reportPath,head:entry.head}));

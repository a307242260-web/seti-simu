'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path');
const lib=require(path.resolve('tools/robot-iteration-lib.js'));
const [output,priorCommit]=process.argv.slice(2);
const id='ai-search-v661-white-full-20261109';
const old=filename=>JSON.parse(cp.execFileSync('git',['show',priorCommit+':'+filename],{maxBuffer:80*1024*1024}));
const previous=old('reports/iteration/registry.json'),versionsBefore=old('reports/iteration/versions.json'),versions=lib.loadVersions();
const v=versions.versions.find(x=>x.id===id),base=versions.versions.find(x=>x.id===v.baseline);
assert.deepEqual(versions.versions.filter(x=>x.id!==id),versionsBefore.versions);
assert(!previous.versions.some(x=>x.id===id));
assert.equal(v.baselineEligible,false);
const [recordFile]=Object.keys(v.records);
const record=lib.readJson(path.join(lib.RESEARCH_DIR,recordFile)),results=lib.resolveVersionResults(v,{[recordFile]:record}),[result]=results;
assert.equal(result.comparisonScope,'white-only-full-game');assert.equal(result.scoreSource,'save-final');
assert(result.terminal&&result.reportExists);assert.equal(result.scores['player-white'],216);
const row={id,aiGeneration:v.aiGeneration,name:v.name,date:v.date,baseline:v.baseline,head:v.head,
 commits:v.commits.map(c=>lib.gitCommitInfo(c)).filter(Boolean),summary:v.summary,diffStat:lib.gitRangeShortStat(base.head,v.head),
 diffFiles:lib.gitRangeNumstat(base.head,v.head),results,roadmap:null,baselineEligible:false,isHead:false,
 completeness:{record:true,save:true,report:true,reportLinks:[{runKey:recordFile.replace(/\.json$/,''),path:result.reportPath,mode:'full'}]}};
const v2=previous.generations.v2;
const merged={...previous,builtAt:new Date().toISOString(),headCommit:v.head,versions:[row,...previous.versions],
 generations:{...previous.generations,v2:{...v2,versionCount:v2.versionCount+1,recordCount:v2.recordCount+1}}};
assert.equal(merged.currentBaseline,'ai-search-v41-baseline-20261029');
assert(!lib.computeBestOf([v],{[id]:results}).bestPlayer);
const target=name=>path.join(output,name);
lib.writeJson(target('reports/iteration/registry.json'),merged);
const template=fs.readFileSync(lib.TEMPLATE_PATH,'utf8');
const placeholder='/*__REGISTRY_JSON__*/';
assert(template.includes(placeholder));
fs.writeFileSync(target('reports/robot-iteration.html'),template.replace(placeholder,JSON.stringify(merged,null,2).replace(/</g,'\\u003c')));
assert(fs.readFileSync(target('reports/robot-iteration.html'),'utf8').includes(id));
console.log(JSON.stringify({id,terminalWhite:216,priorRows:previous.versions.length,priorBaselinesAndRankingsPreserved:true}));

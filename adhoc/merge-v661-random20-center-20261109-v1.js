'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const lib=require(path.resolve('tools/robot-iteration-lib'));
const id='ai-search-v661-free-analyze-random20-20261109',prior='d2c2aba0cdf8fd7f25f3445e95d3f9de842f9eec';
const old=p=>JSON.parse(cp.execFileSync('git',['show',prior+':'+p],{maxBuffer:30*1024*1024}));
const versions=old('reports/iteration/versions.json'),registry=old('reports/iteration/registry.json'),built=lib.readJson(lib.REGISTRY_PATH);
const definition=lib.loadVersions().versions.find(x=>x.id===id),row=built.versions.find(x=>x.id===id);
assert(row&&definition&&definition.baselineEligible===false&&row.aiGeneration==='v2'&&row.results.length===20&&row.results.every(x=>x.reportExists));
assert.equal(row.results.filter(x=>x.terminal&&x.scoreSource==='save-final').length,17);
const proof=lib.readJson('reports/ai-foundation-20261109/v661-random20-v1/v661-random20-verified-20261109-v1.json');
assert.deepEqual(row.results.map(r=>[r.recordPath,r.terminal,r.scores['player-white']]),proof.rows.map(r=>[r.record,r.terminal,r.score]));
assert.equal(registry.currentBaseline,'ai-search-v41-baseline-20261029');
const merged={...registry,builtAt:built.builtAt,headCommit:built.headCommit,versions:[row,...registry.versions],
 generations:{...registry.generations,v2:{...registry.generations.v2,versionCount:registry.generations.v2.versionCount+1,recordCount:registry.generations.v2.recordCount+20}}};
lib.saveVersions({...versions,versions:[definition,...versions.versions]});
lib.writeJson(lib.REGISTRY_PATH,merged);lib.renderPage(merged);
console.log(JSON.stringify({restoredRows:registry.versions.length,addedVersion:id,addedResults:20,terminal:17,preservedBaselines:true,preservedBestOf:true}));

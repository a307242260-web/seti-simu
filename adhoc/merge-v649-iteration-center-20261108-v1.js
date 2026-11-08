'use strict';
const cp=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const lib=require(path.resolve('tools/robot-iteration-lib.js')),base=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const previous=JSON.parse(cp.execFileSync('git',['--git-dir=/Users/bilibili/code/seti-simu/.git','show',base+':reports/iteration/registry.json'],{maxBuffer:20*1024*1024})),built=lib.readJson(lib.REGISTRY_PATH);
const id='ai-search-v649-white-first3-20261108',entry=built.versions.find(v=>v.id===id);assert(entry?.baselineEligible===false);
const result=entry.results[0];assert.equal(entry.aiGeneration,'v2');assert.equal(entry.results.length,1);
assert(result.reportExists&&!result.terminal&&result.comparisonScope==='white-only-first-three-rounds');
assert(!previous.versions.some(v=>v.id===id));
const merged={...previous,builtAt:built.builtAt,headCommit:built.headCommit,versions:[entry,...previous.versions],
  generations:{...previous.generations,v2:{...previous.generations.v2,versionCount:previous.generations.v2.versionCount+1,recordCount:previous.generations.v2.recordCount+1}}};
lib.writeJson(lib.REGISTRY_PATH,merged);lib.renderPage(merged);
const D='reports/ai-foundation-20261108/v649-public-display-transport-v1/';
const out={scope:'Use the standard registered result and render function, preserving every old version row exactly instead of regenerating historical metadata.',priorCommit:base,id,oldRowsRetained:previous.versions.length,
 v1Preserved:true,v2BaselinePreserved:true,v2BestOfPreserved:true,newResults:entry.results.length,newAutonomousRuns:0};
fs.writeFileSync(D+'autonomous-first3-registry-reconciliation-20261108-v1.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(out));

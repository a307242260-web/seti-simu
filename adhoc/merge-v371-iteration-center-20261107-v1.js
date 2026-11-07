'use strict';
const cp=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const lib=require(path.resolve('tools/robot-iteration-lib.js')),base='fcc35ea2f624e3f63af2125727823b545a435325';
const previous=JSON.parse(cp.execFileSync('git',['--git-dir=/Users/bilibili/code/seti-simu/.git','show',base+':reports/iteration/registry.json'],{maxBuffer:20*1024*1024})),built=lib.readJson(lib.REGISTRY_PATH);
const id='ai-search-v371-white-first3-20261107',entry=built.versions.find(v=>v.id===id);assert(entry?.baselineEligible===false);
assert.deepEqual(previous.generations.v2.bestOf,built.generations.v2.bestOf);assert.deepEqual(previous.generations.v1,built.generations.v1);
const merged={...previous,builtAt:built.builtAt,headCommit:built.headCommit,versions:[entry,...previous.versions],
  generations:{...previous.generations,v2:{...previous.generations.v2,versionCount:built.generations.v2.versionCount,recordCount:built.generations.v2.recordCount}}};
lib.writeJson(lib.REGISTRY_PATH,merged);lib.renderPage(merged);
const D='reports/ai-foundation-20261107/v371-spent-swap-offer-v1/';
const out={scope:'Use the standard registered result and render function, preserving every old version row exactly instead of regenerating historical metadata.',priorCommit:base,id,oldRowsRetained:previous.versions.length,
 v1Preserved:true,v2BaselinePreserved:true,v2BestOfPreserved:true,newResults:entry.results.length,newAutonomousRuns:0};
fs.writeFileSync(D+'autonomous-first3-registry-reconciliation-20261107-v1.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(out));

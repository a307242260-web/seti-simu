'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),z=require('node:zlib'),hash=require('node:crypto'),assert=require('node:assert/strict');
const [reportInput,out]=process.argv.slice(2);
const commit='d5c55188d23d1f9f13782b3155ddbe177182e3ef';
const root='reports/ai-foundation-20261105/third-round-teacher-v1/';
const teacherPath=root+'teacher-third-current-replay-20261105-v2.json';
const aiProofPath='reports/ai-foundation-20261109/v655-blue-column-timing-v1/v655-first3-native-development-20261109-v1.json';
const delta=(before,after)=>after-before,sha=b=>hash.createHash('sha256').update(b).digest('hex');
const teacherBytes=cp.execFileSync('git',['show',commit+':'+teacherPath],{maxBuffer:32*1024*1024}),teacher=JSON.parse(teacherBytes);
const aiBytes=fs.readFileSync(reportInput),ai=JSON.parse(aiBytes);
const ledger=JSON.parse(fs.readFileSync(ai.checkpoint)).ledger;
assert(teacher.status==='complete'&&ai.completed&&ai.nativeRoundAndFinalStateSessionRngExact);
const teachStart=teacher.rows.findLastIndex(row=>row.action.family==='analyze'),aiStart=ledger.findLastIndex(row=>row.round===3&&row.action.family==='analyze');
assert(teachStart>=0&&aiStart>=0);
const teacherGain=teacher.rows.slice(teachStart+1).map((row,i)=>({
 sourceRow:teachStart+2+i,action:row.action.summary,family:row.action.family,
 availableData:delta(row.before.player.resources.availableData,row.after.player.resources.availableData)
})).filter(x=>x.availableData>0);
const aiGain=ledger.slice(aiStart+1).filter(row=>row.round===3).map(row=>({
 input:row.input,action:row.action.summary,family:row.action.family,availableData:delta(row.before.availableData,row.after.availableData)
})).filter(x=>x.availableData>0);
const counts=p=>({pool:p.resources.availableData,computer:p.data.placedTokens.filter(x=>x.placementKind==='computer').length,
 blue:p.data.placedTokens.filter(x=>x.placementKind==='blueBonus').length,hand:p.hand.length});
const full=ai.compare.at(-1);
const teacherInitial=teacher.rows[teachStart].after.player.resources.availableData,aiInitial=ledger[aiStart].after.availableData;
const gained=events=>events.reduce((n,x)=>n+x.availableData,0);
const teacherScan=teacherGain.filter(x=>x.family!=='accept_optional_effect'),teacherTriggers=teacherGain.filter(x=>x.family==='accept_optional_effect');
assert.deepEqual([teacherInitial,gained(teacherScan),gained(teacherTriggers),aiInitial,gained(aiGain),gained(aiGain.filter(x=>x.family==='card_corner'))],[1,6,2,0,4,3]);
assert.deepEqual(counts(full.teacher.assets),{pool:3,computer:4,blue:2,hand:3});
assert.deepEqual(counts(full.ai.assets),{pool:0,computer:4,blue:0,hand:0});
const report={scope:'Positive pool data deltas after the last R3 analysis; both source traces are current Native replays, stopping before PASS card and subsequent income.',
 teacher:{path:teacherPath,sha256:sha(teacherBytes),lastAnalysisSourceRow:teachStart+1,initialPool:teacherInitial,scanGains:gained(teacherScan),
  triggerGains:gained(teacherTriggers),end:counts(full.teacher.assets),positiveEvents:teacherGain},
 ai:{path:aiProofPath,sha256:sha(aiBytes),lastAnalysisInput:ledger[aiStart].input,initialPool:aiInitial,discardGains:3,
  totalGains:gained(aiGain),end:counts(full.ai.assets),positiveEvents:aiGain},newAutonomousRuns:0};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));

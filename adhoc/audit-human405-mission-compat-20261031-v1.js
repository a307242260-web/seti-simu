'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),search=require('../randomizer/game/ai/decision-search');
const previous=JSON.parse(fs.readFileSync('reports/ai-foundation-20261023/round1-v99-compat-corpus-20261029-v1.json'));
const jobs=previous.rows.map(r=>({label:r.caseId,fixture:r.fixture}));
jobs.push({label:'step317',fixture:'adhoc/ai-decision-corpus-20261029-reorg-v1/step317-20261029-v1.json'},
 {label:'terminal',fixture:'adhoc/ai-decision-corpus-20261029-learning-v1/v41-step322-terminal-blue-20261029-v1.json'},
 {label:'autonomous-pass',fixture:'adhoc/ai-decision-corpus-20261031-v98-pass-boundary-v1/autonomous-before-pass-20261031-v1.json'});
assert.equal(jobs.length,13);
const version=search.VERSION.split('-').at(-1),output=`reports/ai-foundation-20261023/human405-${version}-compat-cold-20261031-v1.json`,report={searchVersion:search.VERSION,candidateAdmitted:false,status:'running',rows:[]};
for(const j of jobs){
 const p=spawnSync(process.execPath,['adhoc/audit-human405-mission-cold-case-20261031-v1.js',j.label,j.fixture],{encoding:'utf8',timeout:60000});if(p.stdout)process.stdout.write(p.stdout);assert.equal(p.status,0,p.stderr||p.error?.message);
 const evidencePath=`reports/ai-foundation-20261023/human405-${version}-cold-${j.label}-20261031-v1.json`,r=JSON.parse(fs.readFileSync(evidencePath));report.rows.push({label:j.label,complete:r.complete,nativeInputs:r.nativeInputs,milliseconds:r.milliseconds,value:r.value,rootAndRngUnchanged:r.rootAndRngUnchanged,evidencePath});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}
report.status='complete';report.overruns=report.rows.filter(r=>r.nativeInputs>256||r.milliseconds>600);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({roots:report.rows.length,overruns:report.overruns}));

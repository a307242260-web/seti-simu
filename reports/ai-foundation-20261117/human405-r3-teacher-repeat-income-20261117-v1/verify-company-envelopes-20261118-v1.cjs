// Usage: node this.cjs <candidate-root> [before-root]
process.chdir(require('node:path').resolve(process.argv[2]||process.cwd()));
'use strict';
const fs=require('node:fs'),z=require('node:zlib'),assert=require('node:assert/strict'),{open}=require('./native-root-harness-20261118-v1.cjs'),{createAnalysisPort}=require(require('node:path').resolve('randomizer/game/ai/analysis-port'));
const D='reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1',cases=JSON.parse(z.gunzipSync(fs.readFileSync(D+'/deepspace-native-transactions-20261118-v1.json.gz'))).cases;
function normalize(e){const id=e.session?.session?.sessionId,refs=new Set(['sessionId','effectId','groupId','parentEffectId','decisionId']);return JSON.parse(JSON.stringify(e,(k,v)=>k==='committedState'?JSON.parse(v):id&&refs.has(k)&&typeof v==='string'&&(v===id||v.startsWith(id+':'))?'$session'+v.slice(id.length):v));}
let checked=0;for(const [i,c]of cases.entries()){
 const m=open(c.before);let fork;const facade={...m.c,counterfactualPort:{...m.c.counterfactualPort,prepareRoot:e=>e,createFork(...a){const f=m.c.counterfactualPort.createFork(...a);fork=f.composition||f;return f;}}},p=createAnalysisPort({composition:facade,seatId:'player-white',maxCacheEntries:0});
 try{const root=p.openRoot();p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
 p.expand(root,c.steps[0].action.actionId);assert(p.getDiagnostics().companyTemplateReady);p.setResourcePlanning(true);
 let node=root;for(const [k,step]of c.steps.entries()){node=p.expand(node,step.action.actionId);void node.observation;assert.deepEqual(normalize(fork.lifecycle.save().envelope),normalize(step.after),`full envelope ${i}/${k}`);assert.deepEqual(m.save(),c.before,'root/RNG changed');checked++;}
 const d=p.getDiagnostics();assert.equal(d.submissionCount,1);assert.equal(d.provedCompanyStarts,1);assert.equal(d.provedCompanyHandMenus,1);assert.equal(d.provedCompanySwaps,1);
 }finally{p.close();m.dispose()}
}
console.log(JSON.stringify({cases:cases.length,fullEnvelopeChecks:checked,onlySessionReferencesRenamed:true,committedBaseWorkingQueueJournalsAndRngExact:true,eachCaseNativeCalibration:1,eachCaseTypedInputs:3,rootAndRngPreserved:true}));

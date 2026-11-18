// Usage: node this.cjs <candidate-root> [before-root]
process.chdir(require('node:path').resolve(process.argv[2]||process.cwd()));
'use strict';
const fs=require('node:fs'),z=require('node:zlib'),path=require('node:path'),assert=require('node:assert/strict'),{open}=require('./native-root-harness-20261118-v1.cjs');
const dir='reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1',out=dir+'/deepspace-native-transactions-20261118-v1.json.gz';assert(!fs.existsSync(out));
const source=JSON.parse(z.gunzipSync(fs.readFileSync(dir+'/teacher-r4-point289-search-20261118-v1.json.gz'))),m=open(source.root),cases=[],beforeRoot=process.argv[3];let current=null,nativeInputs=0;
const facade={...m.c,counterfactualPort:{...m.c.counterfactualPort,createFork(...args){
 const fork=m.c.counterfactualPort.createFork(...args),comp=fork.composition||fork,port={...comp.inputPort};
 for(const name of ['submitAction','submitQuickAction','submitDecision'])if(typeof port[name]==='function'){
  const native=port[name];port[name]=function(...args){
   const a=name==='submitDecision'?args[0].choice:args[0];nativeInputs++;
   if(a.family==='industry'&&a.target.abilityId==='deepspace_swap_cards'){assert(!current);current={before:comp.lifecycle.save().envelope,steps:[]};}
   if(current&&current.steps.length)assert(a.family==='choose_card'&&a.target.choiceId.startsWith(current.steps.length===1?'hand:':'public:'));
   const result=native(...args);assert(result.ok);
   if(current){current.steps.push({action:a,after:comp.lifecycle.save().envelope});if(current.steps.length===3){cases.push(current);current=null;}}
   return result;
  };
 }
 return {...fork,composition:{...comp,inputPort:port}};
}}};
const p=require(path.join(beforeRoot,'randomizer/game/ai/analysis-port')).createAnalysisPort({composition:facade,seatId:'player-white',maxCacheEntries:0});
try{
 const q=require(path.join(beforeRoot,'randomizer/game/ai/search-agent')).createSearchAgent({seatId:'player-white',analysisPort:p}).decide({seatId:'player-white',legalActions:m.menu()}).search;assert.deepEqual(m.save(),source.root);assert.equal(cases.length,121);assert.equal(nativeInputs,825);assert.equal(q.value,230);
 fs.writeFileSync(out,z.gzipSync(JSON.stringify({schemaVersion:'seti-native-deepspace-transactions-v1',source:'f6d6eab979cfc08a5c09ffd91762d839941d8123',kind:'instrumented Native transaction corpus, no timing admission and no autonomous game',root:source.root,cases,search:{native:nativeInputs,value:q.value,complete:q.complete,selected:q.actionId},rootAndRngPreserved:true})));
 console.log(JSON.stringify({cases:cases.length,nativeInputs,complete:q.complete,value:q.value,rootAndRngPreserved:true,bytes:fs.statSync(out).size}));
}finally{p.close();m.dispose()}

'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),Module=require('node:module');
const stage='/private/tmp/seti-v317-case152-static-occupancy-20261107-v1/',R='reports/ai-foundation-20261107/',D=R+'teacher125-research-quotes-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report=read(R+'teacher125-v317-hotspots-v1/v317-teacher125-swap-quotes-20261107-v1.json');assert.equal(sha(report.checkpoint),report.checkpointSha256);assert.equal(sha(report.manifest),report.manifestSha256);
const m=read(report.manifest);for(const[n,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(stage+n),h,n);
const raw=JSON.parse(z.gunzipSync(fs.readFileSync(report.checkpoint))),states=new Map(Object.entries(raw.states).map(([k,s])=>[k,JSON.parse(s)]));
const valuePath=require.resolve(stage+'randomizer/game/ai/state-value'),old=fs.readFileSync(valuePath,'utf8'),mod=new Module(valuePath,module);mod.filename=valuePath;mod.paths=module.paths;
const stats={factoryCalls:0,marks:0,newMarks:0,trigger:0,fastNoMarks:0,comparisons:0,unique:0,duplicate:0,observedValues:new Map(),signatureMs:0};
mod.require=name=>name==='@@seti/research-audit'?stats:Module.prototype.require.call(mod,name);
let code=old.replace('  function researchPurposeGains(techState, funding, weights, paidPublicity=0,triggerGain=null,paymentAfterFirst=false) {',`  function researchPurposeGains(techState, funding, weights, paidPublicity=0,triggerGain=null,paymentAfterFirst=false) {
    const original=researchPurposeGainsInner(techState,funding,weights,paidPublicity,triggerGain,paymentAfterFirst);
    const marks=funding?.researchMarks||[],opportunity=funding?.newFinalMark,context=funding?.researchTriggers;
    __stats.factoryCalls++;if(marks.length)__stats.marks++;if(opportunity)__stats.newMarks++;if(context?.available)__stats.trigger++;
    if(!marks.length&&!opportunity){__stats.fastNoMarks++;return original;}
    const at=performance.now(),key=JSON.stringify([techState,marks,opportunity??null,context??null,paidPublicity,paymentAfterFirst,weights]);
    __stats.signatureMs+=performance.now()-at;
    let seen=__stats.observedValues.get(key);
    if(!seen){seen=new Map();__stats.observedValues.set(key,seen);}
    return (id,prior=null,currentFunded=true)=>{
      __stats.comparisons++;
      const value=original(id,prior,currentFunded),subkey=JSON.stringify([id,prior,currentFunded]);
      if(seen.has(subkey)){__stats.duplicate++;if(!Object.is(value,seen.get(subkey)))throw Error("observed research value mismatch");}
      else{seen.set(subkey,value);__stats.unique++;}
      return value;
    };
  }
  function researchPurposeGainsInner(techState, funding, weights, paidPublicity=0,triggerGain=null,paymentAfterFirst=false) {`);
assert.notEqual(code,old);mod._compile("const __stats=require('@@seti/research-audit');\n"+code,valuePath);mod.loaded=true;require.cache[valuePath]=mod;
const demand=require(stage+'randomizer/game/ai/resource-demand');
let comparisons=0;
for(const row of raw.prices){const state=states.get(row.stateKey),p=state.players.players.find(p=>p.id===row.playerId);assert.equal(demand.planningCapital(state,p),row.value);comparisons++;}
const {observedValues,...counts}=stats;
const reportOut={scope:'Exact static quote corpus; counts of repeated funding/mark/trigger inputs and ordered research comparisons. No search or cold timing.',source:report.checkpoint,sourceSha256:report.checkpointSha256,manifest:report.manifest,manifestSha256:report.manifestSha256,comparisons,contexts:observedValues.size,...counts};
reportOut.portfolioQuotes=comparisons;fs.writeFileSync(D+'research-quote-reuse-census-20261107-v1.json',JSON.stringify(reportOut,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(reportOut));

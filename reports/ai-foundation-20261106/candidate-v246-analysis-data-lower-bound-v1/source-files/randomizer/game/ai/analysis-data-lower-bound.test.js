'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const values=require('./state-value'),probe=require('./probe-capital'),analysis=require('./amiba-analysis-capital'),filename=require.resolve('./ready-analysis-capital'),loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=module.paths;
let delegated=0;const nativeRequire=loaded.require.bind(loaded);loaded.require=name=>name==='./amiba-analysis-capital'?{quote(...args){delegated++;return analysis.quote(...args);}}:nativeRequire(name);loaded._compile(fs.readFileSync(filename,'utf8'),filename);const ready=loaded.exports;
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../reports/ai-foundation-20261105/third-round-teacher-v1/v239-actual-before-132-root-20261106-v1.json'))),state=JSON.parse(f.compositionEnvelope.committedState),p=state.players.players.find(p=>p.id===f.seatId),facts={...probe.factsFromState(state,p),supply:state.tech,researchCost:6,analyzeEnergyCost:0},before=JSON.stringify(facts),weights=values.DEFAULT_WEIGHTS;
for(const data of [0,1,2]){
 const insufficient={...facts,player:{...facts.player,availableData:data}},portfolio=()=>{throw Error('unfunded analysis cannot request a future portfolio');};
 const old=analysis.quote(insufficient,weights,portfolio,0),current=ready.quote(insufficient,weights,portfolio,0);assert.equal(old.value,0);assert.equal(current.value,old.value);assert.equal(current.selected,null);
}
assert.equal(delegated,0,'the necessary current-data lower bound precedes detailed Amiba scoring');
const funded={...facts,player:{...facts.player,availableData:3}},portfolio=()=>0;
assert.deepEqual(ready.quote(funded,weights,portfolio,0),analysis.quote(funded,weights,portfolio,0));assert.equal(delegated,1);assert.equal(JSON.stringify(facts),before);
console.log(JSON.stringify({analysisCurrentDataLowerBound:'passed',unfundedDetailedQuotesAvoided:3,fundedQuoteUnchanged:true,futureIncomeNotUsedForPreparation:true,newNativeInputs:0}));

'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const stage='/private/tmp/seti-v317-case152-static-occupancy-20261107-v1/',R='reports/ai-foundation-20261107/',D=R+'teacher125-research-quotes-v1/',manifest=R+'case152-static-occupancy-v317-v1/source-manifest-20261107-v1.json';
const path='randomizer/game/ai/state-value.js',m=JSON.parse(fs.readFileSync(manifest)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(stage+path),m.sourceHashes[path]||m.baseRuntimeHashes[path]);
let s=fs.readFileSync(stage+path,'utf8');
function edit(a,b,count=1){assert.equal(s.split(a).length,count+1,a);s=s.replaceAll(a,b);}
edit('  function researchFunding(facts, funding, publicity = funding?.resources?.publicity) {',`  const derivedResearchFunding = new WeakSet(), orderedResearchQuotes = new Map();
  const researchTileIndices = new Map(techCatalog.TECH_TILE_IDS.map((id, index) => [id, index + 1]));
  const researchTileStride = researchTileIndices.size + 1;
  const __researchQuoteWork = {hits:0, misses:0, contexts:0, factories:0};
  function researchFunding(facts, funding, publicity = funding?.resources?.publicity) {`);
edit('    return trigger.available?{...result,researchTriggers:trigger}:result?.researchTriggers?{...result,researchTriggers:null}:result;',`    const derived=trigger.available?{...result,researchTriggers:trigger}:result?.researchTriggers?{...result,researchTriggers:null}:result;
    const o=derived.newFinalMark, marks=derived.researchMarks||[];
    if(marks.every(m=>["d1","d2"].includes(m.formulaId)&&Number.isFinite(m.multiplier))
      &&(!o||[o.currentScore,o.threshold,o.currentValue,o.availableData,o.neededData,...Object.values(o.scoreGains)]
        .every(Number.isFinite)&&typeof o.incomeUsed==="boolean"
        &&o.completionMarks.every(m=>Number.isFinite(m.currentValue)&&Number.isFinite(m.multiplier)))) derivedResearchFunding.add(derived);
    return derived;`);
edit(`  function researchPurposeGains(techState, funding, weights, paidPublicity=0,triggerGain=null,paymentAfterFirst=false) {
    const marks=funding?.researchMarks||[],opportunity=funding?.newFinalMark;
    const triggered=triggerGain||researchTriggers.gains(funding?.researchTriggers,weights,paidPublicity,paymentAfterFirst);
    if(!marks.length&&!opportunity)return triggered;`,`  function researchPurposeGains(techState, funding, weights, paidPublicity=0,makePreparedGain=null,paymentAfterFirst=false) {
    const marks=funding?.researchMarks||[],opportunity=funding?.newFinalMark;
    const makeTrigger = () => makePreparedGain?.() || researchTriggers.gains(funding?.researchTriggers,weights,paidPublicity,paymentAfterFirst);
    if(!marks.length&&!opportunity)return makeTrigger();
    const owned=techState?.ownedTiles;
    if(weights!==DEFAULT_WEIGHTS || !derivedResearchFunding.has(funding) || !owned
      || !Object.values(owned).every(v=>typeof v==="boolean")
      || !Number.isSafeInteger(paidPublicity) || paidPublicity<0) {
      return calculateResearchPurposeGains(techState,funding,weights,makeTrigger());
    }
    // These two native mark formulas read only ownedTiles; the rest of
    // the key is the exact existing trigger and first-mark input. Store
    // scalars only. Payment order and native tile order are independent.
    const key=JSON.stringify([owned,marks,opportunity??null,funding.researchTriggers??null,paidPublicity,paymentAfterFirst]);
    let quotes=orderedResearchQuotes.get(key);
    if(!quotes){
      if(orderedResearchQuotes.size>=256)orderedResearchQuotes.delete(orderedResearchQuotes.keys().next().value);
      quotes=new Map();orderedResearchQuotes.set(key,quotes);__researchQuoteWork.contexts++;
    }
    let evaluate;
    return (id,prior=null,currentFunded=true)=>{
      const first=prior===null?0:researchTileIndices.get(prior),next=researchTileIndices.get(id);
      if(first===undefined||next===undefined||typeof currentFunded!=="boolean"){
        evaluate??=calculateResearchPurposeGains(techState,funding,weights,makeTrigger());
        return evaluate(id,prior,currentFunded);
      }
      const pair=2*(first*researchTileStride+next)+Number(currentFunded);
      const hit=quotes.get(pair);
      if(hit!==undefined){__researchQuoteWork.hits++;return hit;}
      __researchQuoteWork.misses++;
      evaluate??=calculateResearchPurposeGains(techState,funding,weights,makeTrigger());
      const value=evaluate(id,prior,currentFunded);quotes.set(pair,value);return value;
    };
  }
  function calculateResearchPurposeGains(techState, funding, weights, triggered) {
    __researchQuoteWork.factories++;
    const marks=funding?.researchMarks||[],opportunity=funding?.newFinalMark;`);
edit('preparedTriggers?.(0)','preparedTriggers?()=>preparedTriggers(0):null',2);
edit('preparedTriggers?.(researchCost,true)','preparedTriggers?()=>preparedTriggers(researchCost,true):null');
edit('preparedTriggers?.(researchCost)','preparedTriggers?()=>preparedTriggers(researchCost):null');
edit('const preparedTriggers=hasHeld&&hasTrigger?researchTriggers.prepareGains(funding.researchTriggers,weights):null;',`let prepared;
    const preparedTriggers=hasHeld&&hasTrigger?(...args)=>(prepared??=researchTriggers.prepareGains(funding.researchTriggers,weights))(...args):null;`);
edit('const preparedTriggers=eligible.length&&publicity>=researchCost&&hasTrigger?researchTriggers.prepareGains(funding.researchTriggers,weights):null;',`let prepared;
    const preparedTriggers=eligible.length&&publicity>=researchCost&&hasTrigger
      ?(...args)=>(prepared??=researchTriggers.prepareGains(funding.researchTriggers,weights))(...args):null;`);
edit('return Object.freeze({ MODEL_VERSION,','return Object.freeze({ diagnosticOrderedResearchQuotes:()=>({...__researchQuoteWork,entries:orderedResearchQuotes.size}), MODEL_VERSION,');
fs.writeFileSync(D+'state-value-research-quote-memo-prototype-20261107-v1.js',s,{flag:'wx'});

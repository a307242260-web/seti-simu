'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/teacher125-research-quotes-v1/',old=D+'state-value-research-quote-memo-prototype-20261107-v1.js';
const r=JSON.parse(fs.readFileSync(D+'research-quote-memo-validation-20261107-v1.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(old)).digest('hex'),r.prototypeSha256);
let s=fs.readFileSync(old,'utf8');
function edit(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
edit('const derivedResearchFunding = new WeakSet(), orderedResearchQuotes = new Map();','const derivedResearchFunding = new WeakMap(), orderedResearchQuotes = new Map();');
edit(`    const derived=trigger.available?{...result,researchTriggers:trigger}:result?.researchTriggers?{...result,researchTriggers:null}:result;
    const o=derived.newFinalMark, marks=derived.researchMarks||[];`,`    return trigger.available?{...result,researchTriggers:trigger}:result?.researchTriggers?{...result,researchTriggers:null}:result;
  }
  function internalResearchFunding(facts, funding, publicity = funding?.resources?.publicity) {
    const derived=researchFunding(facts,funding,publicity);
    const o=derived.newFinalMark, marks=derived.researchMarks||[], owned=facts.player.techState?.ownedTiles;`);
edit(`        &&o.completionMarks.every(m=>Number.isFinite(m.currentValue)&&Number.isFinite(m.multiplier)))) derivedResearchFunding.add(derived);
    return derived;`,`        &&o.completionMarks.every(m=>Number.isFinite(m.currentValue)&&Number.isFinite(m.multiplier)))) {
      // Capture only actual boolean ownership of the named native tile set.
      // Missing and false are identical for the native d1/d2 count formula.
      let mask=0;
      if(owned&&(Object.getPrototypeOf(owned)===Object.prototype||Object.getPrototypeOf(owned)===null)){
        for(const id of Object.keys(owned)){
          const index=researchTileIndices.get(id),desc=Object.getOwnPropertyDescriptor(owned,id);
          if(index===undefined||typeof desc.value!=="boolean"){mask=-1;break;}
          if(desc.value)mask|=1<<(index-1);
        }
        if(mask>=0)derivedResearchFunding.set(derived,{owned,mask});
      }
    }
    return derived;`);
edit(`    const owned=techState?.ownedTiles;
    if(weights!==DEFAULT_WEIGHTS || !derivedResearchFunding.has(funding) || !owned
      || !Object.values(owned).every(v=>typeof v==="boolean")
      || !Number.isSafeInteger(paidPublicity) || paidPublicity<0) {`,`    const authority=derivedResearchFunding.get(funding);
    if(weights!==DEFAULT_WEIGHTS || !authority || authority.owned!==techState?.ownedTiles
      || !Number.isSafeInteger(paidPublicity) || paidPublicity<0) {`);
edit('const key=JSON.stringify([owned,marks,','const key=JSON.stringify([authority.mask,marks,');
edit('funding=researchFunding(facts,funding,publicity);','funding=internalResearchFunding(facts,funding,publicity);');
edit('const funding=unfunded?null:researchFunding(facts,','const funding=unfunded?null:internalResearchFunding(facts,');
fs.writeFileSync(D+'state-value-research-quote-memo-prototype-20261107-v2.js',s,{flag:'wx'});

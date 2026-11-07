'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/income-before-amiba-probe-ref-v1/',prior=D+'state-value-probe-scalar-prototype-20261107-v2.js',v=JSON.parse(fs.readFileSync(D+'probe-capital-funded-list-income-before-amiba-diagnostic-20261107-v6.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(prior)).digest('hex'),v.valuePrototypeSha256);
let p=fs.readFileSync(prior,'utf8');
function edit(a,b){assert.equal(p.split(a).length,2,a);p=p.replace(a,b);}
edit('misses:0, contexts:0, factories:0','misses:0, contexts:0, factories:0, symbolPartBuilds:0, symbolPartHits:0, symbolKeyFallbacks:0');
edit('  function researchPurposeGains(techState,',`  const researchSymbolBytes=new WeakMap();
  function immutableSymbolPart(value,active){
    if(value==null||["string","number","boolean"].includes(typeof value))return true;
    if(typeof value!=="object"||!Object.isFrozen(value)||active.has(value)
      ||Object.hasOwn(value,"toJSON")||Object.getPrototypeOf(value)!==Object.prototype)return false;
    if(researchSymbolBytes.has(value))return true;
    active.add(value);
    for(const key of Object.keys(value)){
      const d=Object.getOwnPropertyDescriptor(value,key);
      if(!Object.hasOwn(d,"value")||!immutableSymbolPart(d.value,active)){active.delete(value);return false;}
    }
    active.delete(value);return true;
  }
  function symbolPartKey(value){
    if(!value||typeof value!=="object")return null;
    let json=researchSymbolBytes.get(value);
    if(json!==undefined){__researchQuoteWork.symbolPartHits++;return json;}
    if(!immutableSymbolPart(value,new Set()))return null;
    json=JSON.stringify(value);researchSymbolBytes.set(value,json);__researchQuoteWork.symbolPartBuilds++;
    return json;
  }
  function orderedResearchSignature(mask,marks,opportunity,trigger,paidPublicity,paymentAfterFirst){
    const symbols=trigger?.symbols;
    if(symbols && symbols.revealInitialized===true && Number.isSafeInteger(symbols.revealedSlotId)
      && Object.keys(symbols).length===4 && Object.keys(trigger).length===8){
      const slots=symbolPartKey(symbols.symbolSlots),entries=symbolPartKey(symbols.symbolsById);
      if(slots!==null&&entries!==null){
        // Complete native DTO: separate exact immutable layout bytes from
        // the wallet, rule list, score limits and consumed groups.
        const head=JSON.stringify([mask,marks,opportunity??null,paidPublicity,paymentAfterFirst,trigger.available,
          trigger.rules,trigger.completionGroups,trigger.maximumScoreGain,trigger.maximumSingleScoreGain,trigger.wallet,
          trigger.reason,symbols.revealInitialized,symbols.revealedSlotId]).slice(0,-1);
        return "layout:"+head+","+slots+","+entries+"]";
      }
    }
    __researchQuoteWork.symbolKeyFallbacks++;
    return JSON.stringify([mask,marks,opportunity??null,trigger??null,paidPublicity,paymentAfterFirst]);
  }
  function researchPurposeGains(techState,`);
edit('    const key=JSON.stringify([authority.mask,marks,opportunity??null,funding.researchTriggers??null,paidPublicity,paymentAfterFirst]);','    const key=orderedResearchSignature(authority.mask,marks,opportunity,funding.researchTriggers,paidPublicity,paymentAfterFirst);');
fs.writeFileSync(D+'state-value-probe-symbol-key-prototype-20261107-v9.js',p,{flag:'wx'});

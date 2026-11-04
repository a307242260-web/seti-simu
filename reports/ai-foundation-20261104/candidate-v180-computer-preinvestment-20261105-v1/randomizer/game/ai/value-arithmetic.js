(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../cards/deck'):root.SetiCards,common?require('../data/placement'):root.SetiDataPlacement);
 if(common)module.exports=api;else root.SetiValueArithmetic=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(cards,placement){
 'use strict';
 const DEFAULT_WEIGHTS=Object.freeze({credits:1,energy:1,publicity:.5,availableData:.5,additionalPublicScan:.5,handSize:1});
 const incomePopulation=cards.CARD_CATALOG.filter(c=>!c.set.startsWith('alien:')&&[0,1,2].includes(c.income_code)).length;
 // Default terms are native half-units, one computer fraction (/6), and at
 // most one public income-category expectation (/ordinary income population).
 // Integer ledger units remove evaluation-order drift; custom weights retain
 // their specified floating arithmetic and receive no default-model proof.
 const scale=2*placement.COMPUTER_DATA_SLOT_IDS.length*incomePopulation;
 function isDefault(weights){return !weights||Object.keys(weights).length===Object.keys(DEFAULT_WEIGHTS).length&&Object.keys(DEFAULT_WEIGHTS).every(k=>weights[k]===DEFAULT_WEIGHTS[k]);}
 function units(value){if(!Number.isFinite(value))throw TypeError('VALUE_ARITHMETIC_NONFINITE');const result=Math.round(value*scale);if(!Number.isSafeInteger(result))throw RangeError('VALUE_ARITHMETIC_RANGE');return result;}
 function normalize(value,weights){return isDefault(weights)?units(value)/scale:value;}
 function sum(parts,weights){return isDefault(weights)?parts.reduce((n,v)=>n+units(v),0)/scale:parts.reduce((n,v)=>n+v,0);}
 return Object.freeze({DEFAULT_WEIGHTS,scale,incomePopulation,isDefault,normalize,sum});
});

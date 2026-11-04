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
 // The exact ledger is optional outside its safe integer range. Keep the
 // original finite-value arithmetic there; search proof guards already decline
 // unsafe additive shortcuts instead of refusing the decision graph.
 function units(value){if(!Number.isFinite(value))throw TypeError('VALUE_ARITHMETIC_NONFINITE');const result=Math.round(value*scale);return Number.isSafeInteger(result)?result:null;}
 function normalize(value,weights){if(!isDefault(weights))return value;const n=units(value);return n===null?value:n/scale;}
 function sum(parts,weights){if(!isDefault(weights))return parts.reduce((n,v)=>n+v,0);let total=0;for(const value of parts){const n=units(value);if(n===null||!Number.isSafeInteger(total+n))return parts.reduce((n,v)=>n+v,0);total+=n;}return total/scale;}
 return Object.freeze({DEFAULT_WEIGHTS,scale,incomePopulation,isDefault,normalize,sum});
});

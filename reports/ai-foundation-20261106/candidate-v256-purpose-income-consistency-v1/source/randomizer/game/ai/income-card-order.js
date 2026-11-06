(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../cards/effects'):root.SetiCardEffects);
 if(common)module.exports=api;else root.SetiIncomeCardOrder=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(effects){
 'use strict';
 // Only break an exact utility tie between two consumed known income cards.
 // A price is a preservation preference, never an added V score/equivalence.
 function compare(a,b){
  if(!a||!b)return 0;
  return effects.getCardPrice(a)-effects.getCardPrice(b)||(a.id<b.id?-1:a.id>b.id?1:0);
 }
 return Object.freeze({compare});
});

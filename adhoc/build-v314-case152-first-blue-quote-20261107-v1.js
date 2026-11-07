'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const R='reports/ai-foundation-20261107/',D=R+'case152-first-blue-quote-v1/';
function edit(s,old,replacement){assert.equal(s.split(old).length,2,old);return s.replace(old,replacement);}
let local=fs.readFileSync(R+'case152-score-readonly-data-v1/local-decision-plans-readonly-data-prototype-20261107-v1.js','utf8'),
  port=fs.readFileSync(R+'case152-rotation-reuse-v1/analysis-port-rotation-reuse-prototype-20261107-v1.js','utf8');
local=edit(local,' function blueCompletion(input){const {player,capital,...result}=previewBlueCompletion(input);return result;}',
` const blueCompletionDetails = new WeakMap();
 let reusedFirstBlueQuotes = 0;
 function blueCompletion(input){
  const {player,capital,...result}=previewBlueCompletion(input);
  if(result.available && Object.isFrozen(input.state) && Object.isFrozen(input.goal)){
   // Native analysis inputs are deep-frozen and read-only. The player copy
   // belongs only to the private quote; public policy stays scalar.
   const record = { state:input.state, seatId:input.seatId, goal:input.goal, preview:{player,capital,...result} };
   blueCompletionDetails.set(result,record);
  }
  return result;
 }`);
local=edit(local,'initialIncomeGoal=null,initialIncomeTail=null,fixedDataOrdering=false','initialIncomeGoal=null,initialIncomeTail=null,firstBlueSummary=null,fixedDataOrdering=false');
local=edit(local,'   const preview=previewBlueCompletion({state:current,seatId,goal:firstBlueGoal});if(!preview.available)return preview;',
`   const quote=blueCompletionDetails.get(firstBlueSummary);
   const reuse=quote?.state===state && quote.seatId===seatId && quote.goal===firstBlueGoal;
   if(reuse)reusedFirstBlueQuotes++;
   const preview=reuse?quote.preview:previewBlueCompletion({state:current,seatId,goal:firstBlueGoal});
   if(!preview.available)return preview;`);
const api='return Object.freeze({';
const tail=local.lastIndexOf(api);assert(tail>0&&local.slice(tail).includes('blueCompletion'));
local=local.slice(0,tail)+local.slice(tail).replace(api,api+'diagnosticFirstBlueQuoteReuse:()=>reusedFirstBlueQuotes,');
port=edit(port,'                initialIncomeGoal:plan.goal.kind==="income"?plan.goal:null,initialIncomeTail:policy.incomeTail,','                initialIncomeGoal:plan.goal.kind==="income"?plan.goal:null,initialIncomeTail:policy.incomeTail,firstBlueSummary:tail,');
fs.writeFileSync(D+'local-decision-plans-first-blue-quote-prototype-20261107-v1.js',local,{flag:'wx'});
fs.writeFileSync(D+'analysis-port-first-blue-quote-prototype-20261107-v1.js',port,{flag:'wx'});

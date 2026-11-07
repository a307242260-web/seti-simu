'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const R='reports/ai-foundation-20261107/',D=R+'case152-score-readonly-data-v1/';
const paths=[
 [R+'case152-primary-bound-v1/local-decision-plans-primary-bound-prototype-20261107-v1.js','local-decision-plans-readonly-data-prototype-20261107-v1.js',5],
 [R+'case152-completed-prefix-v1/funded-movement-r4-payments-prototype-20261107-v4.js','funded-movement-readonly-data-prototype-20261107-v1.js',1],
];
for(const [p,name,n]of paths){
 const s=fs.readFileSync(p,'utf8'),find=',data:structuredClone(state.data)';
 assert.equal(s.split(find).length,n+1);
 // All six contexts feed the same Native end score/threshold query. Its
 // sector wins, signal and Jiuzhe conditions only read the data board.
 // Aliens and final scoring may normalize in place and stay private copies.
 fs.writeFileSync(D+name,s.replaceAll(find,''),{flag:'wx'});
}

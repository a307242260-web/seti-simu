'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/income-before-amiba-probe-ref-v1/',prior=D+'state-value-probe-scalar-prototype-20261107-v2.js',v=JSON.parse(fs.readFileSync(D+'probe-capital-funded-list-income-before-amiba-diagnostic-20261107-v6.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(prior)).digest('hex'),v.valuePrototypeSha256);
let p=fs.readFileSync(prior,'utf8');
function edit(a,b){assert.equal(p.split(a).length,2,a);p=p.replace(a,b);}
edit('misses:0, contexts:0, factories:0','misses:0, contexts:0, factories:0, signatureBuilds:0, signatureReuses:0');
edit('    const key=JSON.stringify([authority.mask,marks,opportunity??null,funding.researchTriggers??null,paidPublicity,paymentAfterFirst]);',`    if(authority.signature===undefined){
      authority.signature=JSON.stringify([authority.mask,marks,opportunity??null,funding.researchTriggers??null]).slice(0,-1);
      __researchQuoteWork.signatureBuilds++;
    }else __researchQuoteWork.signatureReuses++;
    // All of these held/paid queries use the same private funding DTO.
    // Only payment amount and order are appended to the exact JSON key.
    const key=authority.signature+","+paidPublicity+","+JSON.stringify(paymentAfterFirst)+"]";`);
fs.writeFileSync(D+'state-value-probe-trigger-key-prototype-20261107-v8.js',p,{flag:'wx'});

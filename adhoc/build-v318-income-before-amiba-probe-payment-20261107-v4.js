'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/income-before-amiba-probe-ref-v1/',prior=D+'probe-capital-scalar-prototype-20261107-v2.js',v=JSON.parse(fs.readFileSync(D+'probe-capital-scalar-income-before-amiba-diagnostic-20261107-v2.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(prior)).digest('hex'),v.prototypeSha256);
let p=fs.readFileSync(prior,'utf8');
function edit(a,b){assert.equal(p.split(a).length,2,a);p=p.replace(a,b);}
edit('geometryMisses:0};','geometryMisses:0,payments:0,paymentHits:0};');
edit('  function quoteValue(facts, weights)',`  const scalarFundingCache=new Map(), paymentRadix=64;
  function scalarFunding(wallet,cost,energy,weights){
    const credits=cost.credits||0, wc=wallet.credits,we=wallet.energy;
    const supported=weights===arithmetic.DEFAULT_WEIGHTS
      &&Number.isInteger(wc)&&wc>=0&&wc<paymentRadix&&Number.isInteger(we)&&we>=0&&we<paymentRadix
      &&Number.isInteger(credits)&&credits>=0&&credits<paymentRadix&&Number.isInteger(energy)&&energy>=0&&energy<paymentRadix;
    if(!supported)return funding(wallet,{...cost,energy},weights);
    __requirementRefs.payments++;
    const key=(((wc*paymentRadix+we)*paymentRadix+credits)*paymentRadix+energy);
    const hit=scalarFundingCache.get(key);
    if(hit!==undefined){__requirementRefs.paymentHits++;return hit;}
    const value=funding(wallet,{credits,energy},weights);
    if(scalarFundingCache.size>=512)scalarFundingCache.delete(scalarFundingCache.keys().next().value);
    scalarFundingCache.set(key,value);
    return value;
  }

  function quoteValue(facts, weights)`);
edit(`      const totalCost = { ...goal.endpointFacts.cost, energy: (goal.endpointFacts.cost.energy || 0) + goal.route.cost };
      const payment = funding(player, totalCost, weights);`,`      const cost=goal.endpointFacts.cost,energy=(cost.energy||0)+goal.route.cost;
      const payment=scalarOnly?scalarFunding(player,cost,energy,weights):funding(player,{...cost,energy},weights);`);
fs.writeFileSync(D+'probe-capital-payment-prototype-20261107-v4.js',p,{flag:'wx'});

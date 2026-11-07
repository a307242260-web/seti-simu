'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/income-before-amiba-probe-ref-v1/',prior=D+'probe-capital-scalar-prototype-20261107-v2.js',v=JSON.parse(fs.readFileSync(D+'probe-capital-scalar-income-before-amiba-diagnostic-20261107-v2.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(prior)).digest('hex'),v.prototypeSha256);
let p=fs.readFileSync(prior,'utf8');
function edit(a,b){assert.equal(p.split(a).length,2,a);p=p.replace(a,b);}
edit('  const immutableRequirementGeometry=new WeakSet(), requirementKeysByGeometry=new WeakMap();','  const immutableRequirementGeometry=new WeakSet(), requirementKeysByGeometry=new WeakMap();\n  const scalarRequirementCache=new Map(), scalarRequirementKeysByGeometry=new WeakMap(), fundedGoalsByDirectory=new WeakMap();');
edit('geometryMisses:0};','geometryMisses:0,fundedDirectories:0,fundedDirectoryHits:0,fundedDirectoryPayments:0};');
edit('  function exactGeometryKeys(parts){\n    let table=requirementKeysByGeometry;', '  function exactGeometryKeys(parts,scalarPrivate){\n    let table=scalarPrivate?scalarRequirementKeysByGeometry:requirementKeysByGeometry;');
edit('  function requirements(facts) {','  function requirements(facts,scalarPrivate=false) {\n    const directoryCache=scalarPrivate?scalarRequirementCache:requirementCache;');
const a=p.indexOf('  function requirements(facts,'),b=p.indexOf('  function quoteValue(',a);assert(a>0&&b>a);
let mid=p.slice(a,b).replaceAll('requirementCache.', 'directoryCache.').replace('exactGeometryKeys(geometry)','exactGeometryKeys(geometry,scalarPrivate)');
p=p.slice(0,a)+mid+p.slice(b);
edit('  function quoteValue(facts, weights)',`  function preparedFundedGoals(directory, wallet, weights) {
    const c=wallet.credits,e=wallet.energy;
    if(weights!==arithmetic.DEFAULT_WEIGHTS || !Number.isInteger(c) || c<0 || c>=64
      || !Number.isInteger(e) || e<0 || e>=64) return null;
    let cache=fundedGoalsByDirectory.get(directory);
    if(!cache){cache=new Map();fundedGoalsByDirectory.set(directory,cache);}
    const key=c*64+e;
    if(cache.has(key)){__requirementRefs.fundedDirectoryHits++;return cache.get(key);}
    const result=[];
    for(const goal of directory){
      const cost=goal.endpointFacts.cost;
      const payment=funding(wallet,{...cost,energy:(cost.energy||0)+goal.route.cost},weights);
      __requirementRefs.fundedDirectoryPayments++;
      if(payment)result.push({goal,payment});
    }
    if(cache.size>=64)cache.delete(cache.keys().next().value);
    cache.set(key,result);__requirementRefs.fundedDirectories++;return result;
  }

  function quoteValue(facts, weights)`);
edit('    const goals = requirements(facts);','    const goals = requirements(facts,scalarOnly);');
edit(`    const candidates = scalarOnly ? null : [];let bestValue=0;
    for (const goal of goals) {
      const totalCost = { ...goal.endpointFacts.cost, energy: (goal.endpointFacts.cost.energy || 0) + goal.route.cost };
      const payment = funding(player, totalCost, weights);`,`    const candidates = scalarOnly ? null : [];let bestValue=0;
    // A private scalar directory cannot escape through the full menu or
    // through its numeric result. Reuse only pure payments, never an offer
    // choice, mission portfolio, or projected Native transition.
    const prepared=scalarOnly&&facts.initialInvestmentCapital!==undefined?preparedFundedGoals(goals,player,weights):null;
    for (const entry of prepared||goals) {
      const goal=prepared?entry.goal:entry,cost=goal.endpointFacts.cost;
      const payment=prepared?entry.payment:funding(player,{...cost,energy:(cost.energy||0)+goal.route.cost},weights);`);
fs.writeFileSync(D+'probe-capital-funded-list-prototype-20261107-v5.js',p,{flag:'wx'});

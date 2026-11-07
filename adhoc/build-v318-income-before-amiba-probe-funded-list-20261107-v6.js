'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/income-before-amiba-probe-ref-v1/',prior=D+'probe-capital-funded-list-prototype-20261107-v5.js',v=JSON.parse(fs.readFileSync(D+'probe-capital-funded-list-income-before-amiba-diagnostic-20261107-v5.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(prior)).digest('hex'),v.prototypeSha256);
let p=fs.readFileSync(prior,'utf8');
function edit(a,b){assert.equal(p.split(a).length,2,a);p=p.replace(a,b);}
edit('fundedDirectoryPayments:0};','fundedDirectoryPayments:0,emptyFundedScalar:0};');
edit('  function requirements(facts,scalarPrivate=false) {','  function requirements(facts) { return loadRequirements(facts, false); }\n\n  function loadRequirements(facts,scalarPrivate) {');
edit('  function quoteValue(facts, weights) {return quote(facts, weights, true);}\n\n  function quote(facts, weights, scalarOnly = false) {',`  function quoteValue(facts, weights) {return evaluateMission(facts, weights, true);}
  function quote(facts, weights) {return evaluateMission(facts, weights, false);}

  function evaluateMission(facts, weights, scalarOnly) {`);
edit(`    const goals = requirements(facts,scalarOnly);
    if (!goals.length) return scalarOnly ? 0 : zero();`,`    const goals = loadRequirements(facts,scalarOnly);
    if (!goals.length) return scalarOnly ? 0 : zero();
    // A finite supplied baseline requires no investment callback. With no
    // affordable endpoint there is also no later mission portfolio to price.
    const prepared=scalarOnly&&Number.isFinite(facts.initialInvestmentCapital)?preparedFundedGoals(goals,player,weights):null;
    if(prepared?.length===0&&Array.isArray(facts.hand)&&player.income!=null){
      __requirementRefs.emptyFundedScalar++;
      return 0;
    }`);
edit('    const prepared=scalarOnly&&facts.initialInvestmentCapital!==undefined?preparedFundedGoals(goals,player,weights):null;\n','');
fs.writeFileSync(D+'probe-capital-funded-list-prototype-20261107-v6.js',p,{flag:'wx'});

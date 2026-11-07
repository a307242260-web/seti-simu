'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const stage='/private/tmp/seti-v318-teacher125-research-quotes-20261107-v1/',D='reports/ai-foundation-20261107/income-before-amiba-probe-ref-v1/',prior=D+'probe-capital-exact-refs-prototype-20261107-v1.js',v=JSON.parse(fs.readFileSync(D+'probe-capital-exact-refs-income-before-amiba-diagnostic-20261107-v1.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(prior)).digest('hex'),v.prototypeSha256);
let p=fs.readFileSync(prior,'utf8'),values=fs.readFileSync(stage+'randomizer/game/ai/state-value.js','utf8');
function edit(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
p=edit(p,'  function quote(facts, weights) {','  function quoteValue(facts, weights) {return quote(facts, weights, true);}\n\n  function quote(facts, weights, scalarOnly = false) {');
const a=p.indexOf('  function quote(facts,'),b=p.indexOf('  // One income-funded replacement',a);assert(a>0&&b>a);
let s=p.slice(a,b);
s=s.replaceAll('return zero();','return scalarOnly ? 0 : zero();');
s=edit(s,'    const candidates = [];','    const candidates = scalarOnly ? null : [];let bestValue=0;');
s=edit(s,'if (!payment) { candidates.push(','if (!payment) { if(candidates)candidates.push(');
s=edit(s,'const usedTokens = new Set(), effects = goal.endpointFacts.rewards, ledger = [];','const usedTokens = new Set(), effects = goal.endpointFacts.rewards, ledger = scalarOnly ? null : [];');
s=edit(s,`          delta += linear; ledger.push({ type: effect.type, cardId: chosen.card.cardId, gain: chosen.gain, value: linear,
            handPurposeCost: arithmetic.sum([before,-capital(hand, wallet, income,traceSlots)],weights) });`,`          const handPurposeCost=arithmetic.sum([before,-capital(hand, wallet, income,traceSlots)],weights);
          delta += linear; ledger.push({ type: effect.type, cardId: chosen.card.cardId, gain: chosen.gain, value: linear,
            handPurposeCost });`);
assert.equal(s.split('ledger.push(').length,11);
s=s.replaceAll('ledger.push(','ledger?.push(');
s=edit(s,`      candidates.push({ id: goal.requirementId, family: goal.endpointFamily, planet: goal.planetId, funded: true,
        supported, payment, route: goal.route, ledger, capitalDelta, dataContinuation,
        value: supported ? Math.max(0, arithmetic.sum([delta,capitalDelta,dataContinuation?.value||0],weights)) : 0 });
    }
    const ranked = candidates.filter`,`      const value=supported ? Math.max(0, arithmetic.sum([delta,capitalDelta,dataContinuation?.value||0],weights)) : 0;
      if(candidates)candidates.push({ id: goal.requirementId, family: goal.endpointFamily, planet: goal.planetId, funded: true,
        supported, payment, route: goal.route, ledger, capitalDelta, dataContinuation,value });
      else bestValue=Math.max(bestValue,value);
    }
    if(scalarOnly)return bestValue;
    const ranked = candidates.filter`);
p=p.slice(0,a)+s+p.slice(b);
p=edit(p,'nextIncomeLaunchReplacement, knownScanData, quote,','nextIncomeLaunchReplacement, knownScanData, quote, quoteValue,');
values=edit(values,'const mission=probeCapital.quote({...facts,investment,initialInvestmentCapital:','const mission=probeCapital.quoteValue({...facts,investment,initialInvestmentCapital:');
values=edit(values,'},weights)},weights).value;','},weights)},weights);');
fs.writeFileSync(D+'probe-capital-scalar-prototype-20261107-v2.js',p,{flag:'wx'});
fs.writeFileSync(D+'state-value-probe-scalar-prototype-20261107-v2.js',values,{flag:'wx'});

'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/income-before-amiba-probe-ref-v1/',prior=D+'probe-capital-scalar-prototype-20261107-v2.js',v=JSON.parse(fs.readFileSync(D+'probe-capital-scalar-income-before-amiba-diagnostic-20261107-v2.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(prior)).digest('hex'),v.prototypeSha256);
let p=fs.readFileSync(prior,'utf8');
function edit(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
p=edit(p,'geometryMisses:0};','geometryMisses:0,scalarQuotes:0,scalarFunded:0,scalarEmpty:0};');
const a=p.indexOf('  function quote(facts,'),b=p.indexOf('  // One income-funded replacement',a);assert(a>0&&b>a);
let s=p.slice(a,b);
s=edit(s,`    const knownHand = facts.hand.filter(c => !c.hidden && c.cardId);
    const capitalValues = new Map();`,`    let knownHand, capitalValues, initialCapital;
    const mayDeferPortfolio = scalarOnly && facts.initialInvestmentCapital!==undefined;
    if(mayDeferPortfolio)__requirementRefs.scalarQuotes++;`);
s=edit(s,`    const initialCapital = capital(knownHand, player, player.income, null, facts.initialInvestmentCapital);
    const root = { data: facts.board.data, solarSystem: facts.board.solarSystem };
    const actor = { id: seatId, color: player.color };`,`    function preparePortfolio(){
      knownHand=facts.hand.filter(c=>!c.hidden&&c.cardId);
      capitalValues=new Map();
      initialCapital=capital(knownHand,player,player.income,null,facts.initialInvestmentCapital);
    }
    if(!mayDeferPortfolio)preparePortfolio();
    const root = { data: facts.board.data, solarSystem: facts.board.solarSystem };
    const actor = { id: seatId, color: player.color };
    const weighted = gain => Object.entries(gain).reduce((n, [k, amount]) => n + amount * (k === 'score' ? 1 : weights[k] || 0), 0);
    let knownPublic;`);
s=edit(s,`      const hand = knownHand.slice(), publicCards = (facts.board.publicCards || []).filter(c => c && !c.hidden && c.cardId);`,`      if(!capitalValues)preparePortfolio();
      if(mayDeferPortfolio)__requirementRefs.scalarFunded++;
      const hand = knownHand.slice();
      let publicCards = !mayDeferPortfolio || !Array.isArray(facts.board.publicCards)
        ? (facts.board.publicCards || []).filter(c => c && !c.hidden && c.cardId) : null;`);
s=edit(s,`      const weighted = gain => Object.entries(gain).reduce((n, [k, amount]) => n + amount * (k === 'score' ? 1 : weights[k] || 0), 0);
`,'');
s=edit(s,"          const following=effects.slice(index+1),incomeAt=",`          if(!publicCards){
            knownPublic??=facts.board.publicCards.filter(c=>c&&!c.hidden&&c.cardId);
            publicCards=knownPublic.slice();
          }
          const following=effects.slice(index+1),incomeAt=`);
s=edit(s,'    if(scalarOnly)return bestValue;','    if(scalarOnly){if(mayDeferPortfolio&&!capitalValues)__requirementRefs.scalarEmpty++;return bestValue;}');
p=p.slice(0,a)+s+p.slice(b);
fs.writeFileSync(D+'probe-capital-funded-scalar-prototype-20261107-v3.js',p,{flag:'wx'});

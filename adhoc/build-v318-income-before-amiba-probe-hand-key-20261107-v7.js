'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/income-before-amiba-probe-ref-v1/',prior=D+'probe-capital-funded-list-prototype-20261107-v6.js',v=JSON.parse(fs.readFileSync(D+'probe-capital-funded-list-income-before-amiba-diagnostic-20261107-v6.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(prior)).digest('hex'),v.prototypeSha256);
let p=fs.readFileSync(prior,'utf8');
function edit(a,b){assert.equal(p.split(a).length,2,a);p=p.replace(a,b);}
edit('emptyFundedScalar:0};','emptyFundedScalar:0,handKeyHits:0,handKeyBuilds:0};');
edit(`    const capitalValues = new Map();
    const capital = (hand, wallet, income, traceSlots = null, knownCurrentValue) => {
      const key = JSON.stringify([wallet.credits, wallet.energy, wallet.publicity, wallet.availableData, income.credits, income.energy, hand.map(card => card.id), traceSlots?.map(s=>[s.slotId,s.revealed,...["blue","pink","yellow"].map(t=>s.traces[t].firstPlaced)])]);`,`    const capitalValues = new Map(), handKeys=prepared?new WeakMap():null;
    // These are private copied hand arrays in the scalar mission path.
    // The two native forecast hand edits below invalidate their own key.
    function handKey(hand) {
      if(handKeys.has(hand)){__requirementRefs.handKeyHits++;return handKeys.get(hand);}
      const key=JSON.stringify(hand.map(card=>card.id));handKeys.set(hand,key);__requirementRefs.handKeyBuilds++;return key;
    }
    const capital = (hand, wallet, income, traceSlots = null, knownCurrentValue) => {
      const ledger=[wallet.credits, wallet.energy, wallet.publicity, wallet.availableData, income.credits, income.energy];
      const traceKey=traceSlots?.map(s=>[s.slotId,s.revealed,...["blue","pink","yellow"].map(t=>s.traces[t].firstPlaced)]);
      const key=handKeys?JSON.stringify(ledger).slice(0,-1)+","+handKey(hand)+","+JSON.stringify(traceKey??null)+"]"
        :JSON.stringify([...ledger,hand.map(card=>card.id),traceKey]);`);
edit('      const hand = knownHand.slice(), publicCards = (facts.board.publicCards || []).filter(c => c && !c.hidden && c.cardId);','      const hand = knownHand.slice(), publicCards = (facts.board.publicCards || []).filter(c => c && !c.hidden && c.cardId);\n      if(handKeys)handKeys.set(hand,handKey(knownHand));');
edit('if (picked) { hand.push(picked); publicCards.splice','if (picked) { hand.push(picked); handKeys?.delete(hand); publicCards.splice');
edit('const chosen = ranked[0]; hand.splice(hand.indexOf(chosen.card), 1);','const chosen = ranked[0]; hand.splice(hand.indexOf(chosen.card), 1);handKeys?.delete(hand);');
fs.writeFileSync(D+'probe-capital-hand-key-prototype-20261107-v7.js',p,{flag:'wx'});

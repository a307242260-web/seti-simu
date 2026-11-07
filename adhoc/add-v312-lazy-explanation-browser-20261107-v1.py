from pathlib import Path
p=Path('tools/browser-smoke-inventory.js');s=p.read_text();needle="  id:'production-analysis-region-prefix',file:'randomizer/index.html',";assert s.count(needle)==1
entry="""  id:'production-analysis-lazy-explanations',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAmibaAnalysisCapital && window.SetiStateValue && window.SetiProbeCapital)',
  actionExpression:`(async()=>{
    const cp=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-160-20261105-v1.checkpoint.json').then(r=>r.json()),e=cp.coreState.compositionEnvelope,seed=JSON.parse(e.committedState).meta.seed,seat='player-white',v=window.SetiStateValue,old=Object.create(window),source=await fetch('/reports/ai-foundation-20261107/analysis-lazy-explanations-v1/amiba-analysis-v311-reference-20261107-v1.js').then(r=>r.text());new Function('module','globalThis','window',source)(undefined,old,old);
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
    try{if(!c.lifecycle.restore(e).ok)throw Error('lazy restore');const original=JSON.stringify(c.lifecycle.save().envelope),o=c.projection({role:'player',playerId:seat}).state,f={...window.SetiProbeCapital.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,researchCost:6,analyzeEnergyCost:0},a=structuredClone(f),b=structuredClone(f),ar=old.SetiAmibaAnalysisCapital.quote(a,v.DEFAULT_WEIGHTS,()=>0,0),br=window.SetiAmibaAnalysisCapital.quote(b,v.DEFAULT_WEIGHTS,()=>0,0),descriptor=Object.getOwnPropertyDescriptor(br,'candidates');if(!br.selected?.endpoint||typeof descriptor.get!=='function'||typeof descriptor.set!=='function')throw Error('selected endpoint not eager or explanations not delayed');
      for(const x of [a,b]){x.blueSlots.forEach(s=>s.slot=999);x.researchSymbols.addedAfterQuote=999;x.board.aliens.slots.forEach(s=>s.revealed=!s.revealed);}
      if(JSON.stringify(br)!==JSON.stringify(ar)||JSON.stringify(structuredClone(br))!==JSON.stringify(structuredClone(ar)))throw Error('lazy snapshot/JSON/clone differs from V311');if(br.candidates!==br.candidates||br.selected!==br.candidates[0])throw Error('candidate/selected identity changed');br.candidates=undefined;if(br.candidates!==undefined)throw Error('candidate assignment changed');if(!delete br.candidates||Object.hasOwn(br,'candidates'))throw Error('candidate deletion changed');
      if(v.evaluateStateValue(o,seat).total!==124.08333333333333||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('lazy value or source/RNG changed');window.__lazyExplanationSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__lazyExplanationSmoke?.ok === true',
  obligation:'All local scoring retained, selected endpoint eager, unselected explanation deferred with V311 field snapshots, JSON/clone/repeat identity and assignment/deletion preserved in actual browser',
  counterexample:'Drop candidates, read later mutated fields, alter selected relation or hide explanation at JSON/clone/report boundary, source/RNG mutation',
}), Object.freeze({
"""
s=s.replace(needle,entry+needle);p.write_text(s)

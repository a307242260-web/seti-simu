from pathlib import Path
p=Path('tools/browser-smoke-inventory.js');s=p.read_text();needle="  id:'production-research-score-ceiling',file:'randomizer/index.html',";assert s.count(needle)==1
entry="""  id:'production-analysis-region-prefix',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAmibaAnalysisCapital && window.SetiStateValue && window.SetiAlienAmiba && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const cp=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-160-20261105-v1.checkpoint.json').then(r=>r.json()),e=cp.coreState.compositionEnvelope,s=JSON.parse(e.committedState),seed=s.meta.seed,seat='player-white',v=window.SetiStateValue,a=window.SetiAlienAmiba;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
    try{if(!c.lifecycle.restore(e).ok)throw Error('regional prefix restore');const original=JSON.stringify(c.lifecycle.save().envelope),o=c.projection({role:'player',playerId:seat}).state,f={...window.SetiProbeCapital.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,researchCost:6,analyzeEnergyCost:0},q=v.purposeCapital(f).analysisPlan,rs=q.candidates.filter(x=>x.region);
      if(rs.length<2||v.evaluateStateValue(o,seat).total!==124.08333333333333||q.selected.position!==4)throw Error('regional candidates/value changed');
      for(const x of rs){const symbols=x.endpoint.researchSymbols;if(!Object.isFrozen(symbols.symbolSlots)||!Object.isFrozen(symbols.symbolsById)||!Object.values(symbols.symbolsById).every(Object.isFrozen))throw Error('private regional symbols must be readonly');for(const y of rs.filter(y=>y!==x)){if(symbols.symbolSlots!==y.endpoint.researchSymbols.symbolSlots||symbols.symbolsById!==y.endpoint.researchSymbols.symbolsById||x.endpoint.resources===y.endpoint.resources||x.region===y.region||x.region.results===y.region.results)throw Error('regional prefix/wallet ownership wrong');}}
      const quoted=JSON.stringify(q),copy={amiba:a.copyPublicSymbolState(rs[0].endpoint.researchSymbols)},slot=Object.keys(copy.amiba.symbolSlots).find(id=>copy.amiba.symbolSlots[id]);if(!a.resolveSymbolAtSlot(copy,slot).ok||JSON.stringify(q)!==quoted)throw Error('later Native symbol move mutated quote');
      const again=v.purposeCapital(f).analysisPlan;if(again.candidates.find(x=>x.region).endpoint.researchSymbols.symbolSlots===rs[0].endpoint.researchSymbols.symbolSlots)throw Error('regional result survived a different quote');const port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=port.openRoot();if(JSON.stringify(v.evaluateStateValue(port.valueObservation(root),seat))!==JSON.stringify(v.evaluateStateValue(root.observation,seat)))throw Error('regional compact/full value differs');}finally{port.close();}
      if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('regional source/RNG changed');window.__regionalPrefixSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__regionalPrefixSmoke?.ok === true',
  obligation:'Same Native regional prefix shared only within one quote, private symbols readonly, wallet/trace/explanations distinct, Native copied movement/full-compact/source RNG preserved',
  counterexample:'Wrong symbol sequence, shared wallet or mutated source, cross-quote reference cache, stale browser assembly or missing symbol-copy ownership',
}), Object.freeze({
"""
s=s.replace(needle,entry+needle);p.write_text(s)

from pathlib import Path
p=Path('randomizer/game/ai/analysis-port.js');s=p.read_text()
s=s.replace('let decodedSerialized = null, decodedState = null;','const decodedStates = new Map();\n    const maxDecodedStateCacheEntries = 16, maxDecodedStateCacheBytes = 8 * 1024 * 1024;\n    let decodedStateCacheBytes = 0;\n    let envelopeObservations = new WeakMap(), stateRequirements = new WeakMap(), goalCatalogs = new WeakMap();\n    let observationCacheHits = 0, resourceQueryHits = 0, resourceQueryMisses = 0, goalCatalogHits = 0, goalCatalogMisses = 0;')
s=s.replace('restoreEnvelope(envelope);\n      const observationAt', 'let variants = envelopeObservations.get(envelope);\n      if (variants?.has(barrier)) { observationCacheHits++; return variants.get(barrier); }\n      restoreEnvelope(envelope);\n      const observationAt')
s=s.replace('milliseconds.observation += now() - observationAt;\n      return result;', 'milliseconds.observation += now() - observationAt;\n      if (!variants) { variants = new Map(); envelopeObservations.set(envelope, variants); }\n      variants.set(barrier, result);\n      return result;')
a=s.index('      // 不同pending信封可有相同committed bytes。');b=s.index('\n    function openRoot()',a)
s=s[:a]+'''      // Exact serialized bytes only; pending working copies remain separate and writable.
      const key = envelope.committedState;
      if (decodedStates.has(key)) {
        const result = decodedStates.get(key);
        decodedStates.delete(key); decodedStates.set(key, result);
        committedDecodeHits++;
        return result;
      }
      committedDecodeCount++;
      const result = freeze(JSON.parse(key)), bytes = key.length * 2;
      if (bytes <= maxDecodedStateCacheBytes) {
        while (decodedStates.size && (decodedStates.size >= maxDecodedStateCacheEntries || decodedStateCacheBytes + bytes > maxDecodedStateCacheBytes)) {
          const oldest = decodedStates.keys().next().value;
          decodedStates.delete(oldest); decodedStateCacheBytes -= oldest.length * 2;
        }
        decodedStates.set(key, result); decodedStateCacheBytes += bytes;
      }
      return result;
    }
''' +s[b:]
s=s.replace('committedDecodeCount = 0; committedDecodeHits = 0;','committedDecodeCount = 0; committedDecodeHits = 0;\n      observationCacheHits = 0; resourceQueryHits = 0; resourceQueryMisses = 0; goalCatalogHits = 0; goalCatalogMisses = 0;')
s=s.replace('return (productionKernel||globalThis.SetiProductionKernel).getResourceGoalRequirements(state,seatId);','''if (stateRequirements.has(state)) { resourceQueryHits++; return stateRequirements.get(state); }
      resourceQueryMisses++;
      const result = freeze((productionKernel||globalThis.SetiProductionKernel).getResourceGoalRequirements(state,seatId));
      stateRequirements.set(state,result); return result;''')
s=s.replace('    function resourceStep(node,goal,operation={}) {','''    function resourceCatalog(state, actions) {
      let variants = goalCatalogs.get(state);
      const key = actionSetKey(actions);
      if (variants?.has(key)) { goalCatalogHits++; return variants.get(key); }
      goalCatalogMisses++;
      const result = freeze(resourceDemand.catalog({state,seatId,requirements:resourceQuery(state),actions}));
      if (!variants) { variants = new Map(); goalCatalogs.set(state,variants); }
      variants.set(key,result); return result;
    }

    function resourceStep(node,goal,operation={}) {''')
s=s.replace('if(!resourceRequirements.has(node))resourceRequirements.set(node,resourceQuery(state));\n        goals=resourceDemand.catalog({state,seatId,requirements:resourceRequirements.get(node),actions:node.legalActions});','goals=resourceCatalog(state,node.legalActions);')
s=s.replace('resourceDemand.catalog({state:session.baseState,seatId,requirements:resourceQuery(session.baseState),actions:[source]})','resourceCatalog(session.baseState,[source])')
s=s.replace('decodedSerialized = null; decodedState = null;','decodedStates.clear(); decodedStateCacheBytes = 0;\n      envelopeObservations = new WeakMap(); stateRequirements = new WeakMap(); goalCatalogs = new WeakMap();')
s=s.replace('decodedStateCacheEntries: decodedSerialized ? 1 : 0, maxDecodedStateCacheEntries: 1,','decodedStateCacheEntries: decodedStates.size, maxDecodedStateCacheEntries, decodedStateCacheBytes, maxDecodedStateCacheBytes,\n        observationCacheHits, resourceQueryHits, resourceQueryMisses, goalCatalogHits, goalCatalogMisses,')
p.write_text(s)
p=Path('randomizer/game/ai/decision-search.js');s=p.read_text().replace('seti-complete-decision-search-v37','seti-complete-decision-search-v38');s=s.replace('    const startedAt = now();','''    const valueCache = new WeakMap();
    function valueOf(observation) {
      if (valueCache.has(observation)) return valueCache.get(observation);
      const value = evaluate(observation); valueCache.set(observation,value); return value;
    }
    const startedAt = now();''',1)
# Preserve evaluator branding for policy/proof checks, memoize only scalar calls in this search.
s=s.replace('evaluate(node.observation)','valueOf(node.observation)').replace('evaluate(observation)','valueOf(observation)').replace('evaluate(entry.node.observation)','valueOf(entry.node.observation)').replace('evaluate(macro.node.observation)','valueOf(macro.node.observation)')
s=s.replace('const value = valueOf(observation); valueCache.set','const value = evaluate(observation); valueCache.set')
p.write_text(s)

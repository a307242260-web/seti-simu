from pathlib import Path
import json,gzip,hashlib
p=Path('randomizer/game/ai/analysis-port.js');s=p.read_text();dest=Path('adhoc/search-buffer-variants-20261029-v2/analysis-port.js.gz');dest.parent.mkdir(exist_ok=True);dest.write_bytes(gzip.compress(s.encode()));Path('adhoc/search-buffer-variants-20261029-v2.json').write_text(json.dumps({str(p):{'path':str(dest),'sourceSha256':hashlib.sha256(s.encode()).hexdigest(),'archiveSha256':hashlib.sha256(dest.read_bytes()).hexdigest()}},indent=2)+'\n')
s=s.replace('function forwardIdentity(envelope, status, boundary, stateOverride = null) {','function forwardIdentity(envelope, status, boundary, stateOverride = null, stateCache = null) {',1)
a=s.index('    const state = { ...source,');b=s.index('    const references = new Map();',a)
block=s[a:b];s=s[:a]+'    function buildState() {\n'+block+'      return state;\n    }\n'+s[b:]
s=s.replace('    return JSON.stringify(normalize({ state, pending, status, boundary }));','''    // Preserve the original sorted traversal: boundary, pending, state, status.
    // Pending references are numbered first; their exact mapping is part of the cache key.
    const normalizedPending=normalize(pending);
    const key=JSON.stringify([prefix,Array.from(references)]);
    let variants=stateCache&&Object.isFrozen(source)?stateCache.get(source):null;
    let normalizedState;
    if(variants?.has(key))normalizedState=variants.get(key);
    else{
      normalizedState=normalize(buildState());
      if(stateCache&&Object.isFrozen(source)){
        if(!variants){variants=new Map();stateCache.set(source,variants);}
        variants.set(key,normalizedState);
      }
    }
    return JSON.stringify({boundary,pending:normalizedPending,state:normalizedState,status});''',1)
s=s.replace('    let nodes = new WeakMap();','    let nodes = new WeakMap();\n    let normalizedIdentityStates = new WeakMap();',1)
s=s.replace('const maxDecodedStateCacheEntries = 16,', 'const maxDecodedStateCacheEntries = 64,')
s=s.replace('forwardIdentity(envelope, status, boundary, readIdentityState(envelope));','forwardIdentity(envelope, status, boundary, readIdentityState(envelope), normalizedIdentityStates);',1)
s=s.replace('      nodes = new WeakMap();','      nodes = new WeakMap();\n      normalizedIdentityStates = new WeakMap();',1)
p.write_text(s)

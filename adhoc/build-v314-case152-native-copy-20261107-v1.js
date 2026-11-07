'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/case152-native-copy-v1/',mp='reports/ai-foundation-20261107/analysis-lazy-trace-contexts-v1/source-manifest-20261107-v1.json';
const m=JSON.parse(fs.readFileSync(mp)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [p,h]of Object.entries(m.sourceHashes))assert.equal(sha(p),h,p);
for(const [p,h]of Object.entries(m.baseRuntimeHashes))assert.equal(sha(p),m.sourceHashes[p]||h,p);
function edit(s,old,replacement){assert.equal(s.split(old).length,2,old);return s.replace(old,replacement);}
const sf='randomizer/game/state/state-store.js',ef='randomizer/game/effects/session-runtime.js',rf='randomizer/game/rule-composition.js';
let state=fs.readFileSync(sf,'utf8'),effect=fs.readFileSync(ef,'utf8'),rule=fs.readFileSync(rf,'utf8');
state=edit(state,'  function deepFreeze(value) {',`  // Internal Native fork graphs consist of data objects and arrays. Preserve
  // aliasing, holes, signed zero, insertion order and undefined exactly.
  // Unsupported values still use the original platform clone end to end.
  function copyForkData(value) {
    const seen = new Map();
    const unsupported = {};
    function copy(source) {
      if (source === null || typeof source !== "object") {
        if (typeof source === "function" || typeof source === "symbol") throw unsupported;
        return source;
      }
      const hit = seen.get(source);
      if (hit !== undefined) return hit;
      const array = Array.isArray(source);
      const proto = Object.getPrototypeOf(source);
      if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw unsupported;
      const result = array ? new Array(source.length) : {};
      seen.set(source, result);
      for (const key of Object.keys(source)) {
        if (key === "__proto__") throw unsupported;
        result[key] = copy(source[key]);
      }
      return result;
    }
    try {
      return copy(value);
    } catch (error) {
      if (error !== unsupported) throw error;
      return clone(value);
    }
  }

  function deepFreeze(value) {`);
state=edit(state,'        state: clone(committedState),','        state: trustedIsolatedOwnership ? copyForkData(committedState) : clone(committedState),');
state=edit(state,'    createCommittedGameState,\n    createStateStore,','    createCommittedGameState,\n    createStateStore,\n    copyForkData,');
effect=edit(effect,'    const cloneState = options.cloneState || clone;','    const cloneState = options.cloneState || clone;\n    const cloneTrustedCheckpoint = options.cloneTrustedCheckpoint || clone;');
effect=edit(effect,'const restored=shareBase?{...clone({...source,','const restored=shareBase?{...cloneTrustedCheckpoint({...source,');
rule=edit(rule,'        stateStore: store,\n        trustedIsolatedOwnership:', '        stateStore: store,\n        cloneTrustedCheckpoint: options.allowTrustedForkLifecycle === true ? stateStoreApi.copyForkData : null,\n        trustedIsolatedOwnership:');
for(const [p,s]of [[sf,state],[ef,effect],[rf,rule]])fs.writeFileSync(D+p.split('/').pop().replace('.js','-prototype-20261107-v1.js'),s,{flag:'wx'});

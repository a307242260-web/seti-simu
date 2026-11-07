'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const stage='/private/tmp/seti-v318-teacher125-research-quotes-20261107-v1/',R='reports/ai-foundation-20261107/',D=R+'income-before-amiba-probe-ref-v1/',manifest=R+'teacher125-research-quotes-v318-v1/source-manifest-20261107-v1.json';
const m=JSON.parse(fs.readFileSync(manifest)),path='randomizer/game/ai/probe-capital.js',sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(stage+path),m.sourceHashes[path]||m.baseRuntimeHashes[path]);let s=fs.readFileSync(stage+path,'utf8');
function edit(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
edit('  const routeCache = new Map(), requirementCache = new Map();',`  const routeCache = new Map(), requirementCache = new Map();
  const immutableRequirementGeometry=new WeakSet(), requirementKeysByGeometry=new WeakMap();
  const __requirementRefs={queries:0,refs:0,serialized:0,fallbacks:0,geometryMisses:0};
  function isImmutableRequirementGeometry(value,active) {
    if(value==null||typeof value==="boolean"||typeof value==="string"||typeof value==="number")return true;
    if(typeof value!=="object"||!Object.isFrozen(value))return false;
    if(immutableRequirementGeometry.has(value))return true;
    const proto=Object.getPrototypeOf(value);
    if((Array.isArray(value)?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)
      || Object.hasOwn(value,"toJSON") || active.has(value))return false;
    active.add(value);
    for(const key of Object.keys(value)){
      const d=Object.getOwnPropertyDescriptor(value,key);
      if(!Object.hasOwn(d,"value")||!isImmutableRequirementGeometry(d.value,active)){active.delete(value);return false;}
    }
    active.delete(value);immutableRequirementGeometry.add(value);return true;
  }
  function exactGeometryKeys(parts){
    let table=requirementKeysByGeometry;
    // Fast path walks weak references only. A shallow freeze, accessor,
    // custom JSON hook or non-data object always uses the original key.
    for(const part of parts){
      if(part==null||typeof part!=="object")return null;
      if(!immutableRequirementGeometry.has(part)&&!isImmutableRequirementGeometry(part,new Set()))return null;
      let next=table.get(part);
      if(!next){next=table===requirementKeysByGeometry||part!==parts[2]?new WeakMap():new Map();table.set(part,next);}
      table=next;
    }
    return table;
  }`);
s=s.replace('for(const part of parts){','for(const [index,part] of parts.entries()){').replace('table===requirementKeysByGeometry||part!==parts[2]?new WeakMap():new Map()','index<2?new WeakMap():new Map()');
edit(`    const key = JSON.stringify([facts.board.solarSystem, facts.board.rockets, facts.board.planets,
      p.id, p.color, ['orange2', 'orange3', 'orange4'].map(id =>
        Boolean(p.techState?.ownedTiles?.[id] && !p.techState?.disabledTiles?.[id]))]);
    if (requirementCache.has(key)) return requirementCache.get(key);`,
`    __requirementRefs.queries++;
    const geometry=[facts.board.solarSystem,facts.board.rockets,facts.board.planets];
    const abilities=['orange2','orange3','orange4'].map(id=>Boolean(p.techState?.ownedTiles?.[id]&&!p.techState?.disabledTiles?.[id]));
    const suffix=[p.id,p.color,abilities],refs=exactGeometryKeys(geometry);
    const small=refs&&JSON.stringify(suffix),remembered=refs?.get(small);
    if(remembered!==undefined&&requirementCache.has(remembered)){
      __requirementRefs.refs++;
      return requirementCache.get(remembered);
    }
    if(!refs)__requirementRefs.fallbacks++;
    const key=JSON.stringify([...geometry,...suffix]);__requirementRefs.serialized++;
    if(refs){
      if(refs.size>=16&&!refs.has(small))refs.delete(refs.keys().next().value);
      refs.set(small,key);
    }
    if (requirementCache.has(key)) return requirementCache.get(key);
    __requirementRefs.geometryMisses++;`);
edit('return Object.freeze({ pendingFinalMarkOption,','return Object.freeze({ diagnosticRequirementRefs:()=>({...__requirementRefs}), pendingFinalMarkOption,');
fs.writeFileSync(D+'probe-capital-exact-refs-prototype-20261107-v1.js',s,{flag:'wx'});

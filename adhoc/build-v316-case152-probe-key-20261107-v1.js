'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='/private/tmp/seti-v316-case152-pending-copy-20261107-v1/',D='reports/ai-foundation-20261107/case152-probe-key-v1/',M='reports/ai-foundation-20261107/case152-pending-copy-v316-v1/source-manifest-20261107-v1.json',file='randomizer/game/ai/probe-capital.js';
const m=JSON.parse(fs.readFileSync(M)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(root+file),m.sourceHashes[file]||m.baseRuntimeHashes[file]);
let s=fs.readFileSync(root+file,'utf8');
function edit(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
edit('  const routeCache = new Map(), requirementCache = new Map();',`  const routeCache = new Map(), requirementCache = new Map();
  const geometryBytes = new WeakMap(), immutableGeometry = new WeakSet();
  const __keyWork = { builds: 0, hits: 0, fallbacks: 0 };
  function isImmutableGeometry(value) {
    if (value == null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value !== "object" || !Object.isFrozen(value)) return false;
    if (immutableGeometry.has(value)) return true;
    const proto = Object.getPrototypeOf(value);
    if (Array.isArray(value) ? proto !== Array.prototype : proto !== null && proto !== Object.prototype) return false;
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (key === "toJSON" || !Object.hasOwn(descriptor, "value") || !isImmutableGeometry(descriptor.value)) return false;
    }
    immutableGeometry.add(value);
    return true;
  }
  function geometryKey(parts, suffix) {
    const keys = [];
    for (const value of parts) {
      if (value == null || typeof value !== "object" || !isImmutableGeometry(value)) {
        __keyWork.fallbacks++;
        return JSON.stringify([...parts, ...suffix]);
      }
      let json = geometryBytes.get(value);
      if (json === undefined) {
        json = JSON.stringify(value);
        geometryBytes.set(value, json);
        __keyWork.builds++;
      } else __keyWork.hits++;
      keys.push(json);
    }
    // All parts are complete, plain, recursively immutable JSON objects.
    // Concatenation yields exactly the old serialized array.
    return "[" + keys.join(",") + "," + JSON.stringify(suffix).slice(1);
  }`);
edit(`    const key = JSON.stringify([solarSystem, pieces.rockets, ship.id,
      Boolean(actor.techState?.ownedTiles?.orange2 && !actor.techState?.disabledTiles?.orange2)]);`,
`    const key = geometryKey([solarSystem, pieces.rockets], [ship.id,
      Boolean(actor.techState?.ownedTiles?.orange2 && !actor.techState?.disabledTiles?.orange2)]);`);
edit(`    const key = JSON.stringify([facts.board.solarSystem, facts.board.rockets, facts.board.planets,
      p.id, p.color, ['orange2', 'orange3', 'orange4'].map(id =>`,
`    const key = geometryKey([facts.board.solarSystem, facts.board.rockets, facts.board.planets],
      [p.id, p.color, ['orange2', 'orange3', 'orange4'].map(id =>`);
edit('return Object.freeze({ pendingFinalMarkOption,','return Object.freeze({ diagnosticProbeKeyWork:()=>({...__keyWork}), pendingFinalMarkOption,');
fs.writeFileSync(D+'probe-capital-probe-key-prototype-20261107-v1.js',s,{flag:'wx'});

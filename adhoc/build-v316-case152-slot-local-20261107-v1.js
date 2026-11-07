'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='/private/tmp/seti-v316-case152-pending-copy-20261107-v1/',D='reports/ai-foundation-20261107/case152-slot-local-v1/',M='reports/ai-foundation-20261107/case152-pending-copy-v316-v1/source-manifest-20261107-v1.json',path='randomizer/game/rockets.js';
const m=JSON.parse(fs.readFileSync(M)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(root+path),m.sourceHashes[path]||m.baseRuntimeHashes[path]);
const s=fs.readFileSync(root+path,'utf8'),old=`  function getOccupiedSlotIndices(piecesState, sectorX, sectorY, excludeRocketId) {
    const slots = getSectorOccupancy(piecesState, excludeRocketId).get(sectorKey(sectorX, sectorY));
    return slots ? new Set(slots.keys()) : new Set();
  }`,next=`  function getOccupiedSlotIndices(piecesState, sectorX, sectorY, excludeRocketId) {
    if (!Number.isInteger(sectorX) || !Number.isInteger(sectorY)) {
      // Preserve the existing key coercion for callers passing non-numeric
      // coordinates; native board queries use integer coordinates.
      const slots = getSectorOccupancy(piecesState, excludeRocketId).get(sectorKey(sectorX, sectorY));
      return slots ? new Set(slots.keys()) : new Set();
    }
    // This query needs only the requested sector's slots, not a nested
    // occupancy table for every other sector. Scan in the original order.
    const occupied = new Set();
    for (const rocket of piecesState.rockets) {
      if (rocket.id !== excludeRocketId && rocket.sectorX === sectorX && rocket.sectorY === sectorY
        && Number.isInteger(rocket.slotIndex)) occupied.add(rocket.slotIndex);
    }
    return occupied;
  }`;
assert.equal(s.split(old).length,2);
fs.writeFileSync(D+'rockets-slot-local-prototype-20261107-v1.js',s.replace(old,next),{flag:'wx'});

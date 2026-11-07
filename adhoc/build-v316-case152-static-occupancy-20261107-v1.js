'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='/private/tmp/seti-v316-case152-pending-copy-20261107-v1/',D='reports/ai-foundation-20261107/case152-static-occupancy-v1/',M='reports/ai-foundation-20261107/case152-pending-copy-v316-v1/source-manifest-20261107-v1.json';
const m=JSON.parse(fs.readFileSync(M)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const base='randomizer/game/';
function load(path){const f=base+path;assert.equal(sha(root+f),m.sourceHashes[f]||m.baseRuntimeHashes[f]);return fs.readFileSync(root+f,'utf8');}
function edit(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
const out=(name,s)=>{const f=D+name+'-static-occupancy-prototype-20261107-v1.js';if(fs.existsSync(f))assert.equal(fs.readFileSync(f,'utf8'),s);else fs.writeFileSync(f,s,{flag:'wx'});};
let r=load('rockets.js');
r=edit(r,'  function canMoveFromCoordinate(piecesState, current, deltaX, deltaY, movingRocketId = null) {',`  const __occupancy = { maps: 0, checks: 0 };
  function createStaticCoordinateMoveQuery(piecesState, movingRocketId = null) {
    // Caller owns one synchronous static geometry traversal. This map has
    // no mutable board references, and is never retained past that traversal.
    const occupancy = getSectorOccupancy(piecesState, movingRocketId);
    __occupancy.maps++;
    return (coordinate, dx, dy) => canMoveFromCoordinate(piecesState, coordinate, dx, dy, movingRocketId, occupancy);
  }

  function canMoveFromCoordinate(piecesState, current, deltaX, deltaY, movingRocketId = null, staticOccupancy = null) {`);
r=edit(r,'    if (findAvailableSlotIndex(piecesState, sectorX, sectorY, movingRocketId) === null) {',`    let hasRoom;
    if (staticOccupancy) {
      const occupied = staticOccupancy.get(sectorKey(sectorX, sectorY));
      hasRoom = !occupied || solar.LAUNCH_SLOT_PRIORITY.some(slot => !occupied.has(slot));
      __occupancy.checks++;
    } else hasRoom = findAvailableSlotIndex(piecesState, sectorX, sectorY, movingRocketId) !== null;
    if (!hasRoom) {`);
r=edit(r,'    canMoveFromCoordinate,','    canMoveFromCoordinate,\n    createStaticCoordinateMoveQuery,\n    diagnosticStaticOccupancy:()=>({...__occupancy}),');out('rockets',r);
let k=load('production-kernel.js');
k=edit(k,'    const queue = [initialRoute];','    const canMove = rockets.createStaticCoordinateMoveQuery(workingState.pieces, source.rocketId);\n    const queue = [initialRoute];');
k=edit(k,`        const move = rockets.canMoveFromCoordinate(
          workingState.pieces,
          route.coordinate,
          direction.deltaX,
          direction.deltaY,
          source.rocketId,
        );`,`        const move = canMove(route.coordinate, direction.deltaX, direction.deltaY);`);out('production-kernel',k);
let g=load('ai/goal-movement.js');
g=edit(g,'    const start=rockets.getRocketSectorCoordinate(ship),best=new Map(),','    const canMove=rockets.createStaticCoordinateMoveQuery(state.pieces,ship.id);\n    const start=rockets.getRocketSectorCoordinate(ship),best=new Map(),');
g=edit(g,'rockets.canMoveFromCoordinate(state.pieces,next.coordinate,d.deltaX,d.deltaY,ship.id)','canMove(next.coordinate,d.deltaX,d.deltaY)');out('goal-movement',g);
let p=load('ai/probe-capital.js');
p=edit(p,'    const best = new Map(), queue =','    const canMove = rockets.createStaticCoordinateMoveQuery(pieces, ship.id);\n    const best = new Map(), queue =');
p=edit(p,'rockets.canMoveFromCoordinate(pieces, next.coordinate, direction.deltaX, direction.deltaY, ship.id)','canMove(next.coordinate, direction.deltaX, direction.deltaY)');out('probe-capital',p);

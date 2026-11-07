'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/',S=D+'case152-scalar-topology-v1/',P=D+'case152-primary-bound-v1/',N=D+'case152-timing-prefix-key-v1/',sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const proof=JSON.parse(fs.readFileSync(S+'scalar-topology-native-parity-20261107-v1.json'));
const source=S+'production-kernel-scalar-topology-prototype-20261107-v1.js';assert.equal(sha(source),proof.prototypeSha256);
function edit(s,old,replacement){assert.equal(s.split(old).length,2,old);return s.replace(old,replacement);}
let k=fs.readFileSync(source,'utf8'),p=fs.readFileSync(P+'analysis-port-primary-bound-prototype-20261107-v1.js','utf8');
k=edit(k,'function plannedMovementTimingKey(state, seatId, requirementId, path, freePoints = 0) {','function plannedMovementTimingKeyPrefix(state, seatId) {');
k=edit(k,`  return JSON.stringify([state.meta?.gameId, seatId, state.solarSystem, state.pieces, state.planets,
    state.aliens, geometryPlayers, state.turn, requirementId, path, freePoints]);
}`,`  return JSON.stringify([state.meta?.gameId, seatId, state.solarSystem, state.pieces, state.planets,
    state.aliens, geometryPlayers, state.turn]).slice(0, -1);
}

function plannedMovementTimingKey(state, seatId, requirementId, path, freePoints = 0) {
  return appendMovementTimingKey(plannedMovementTimingKeyPrefix(state, seatId), requirementId, path, freePoints);
}

function appendMovementTimingKey(prefix, requirementId, path, freePoints = 0) {
  // Same Native plain-data JSON array bytes; only serialize the target and
  // path separately within one synchronous, read-only goal query.
  return prefix + "," + JSON.stringify([requirementId, path, freePoints]).slice(1);
}`);
k=edit(k,'  plannedMovementTimingKey,','  plannedMovementTimingKey,\n  plannedMovementTimingKeyPrefix,\n  appendMovementTimingKey,');
p=edit(p,`    function movementTiming(state, id, path, freePoints) {
      const native = productionKernel || globalThis.SetiProductionKernel;
      const key = native.plannedMovementTimingKey(state,seatId,id,path,freePoints);`,`    let timingPrefixBuilds = 0, timingPrefixReuses = 0;
    function timingForOneGoalQuery(state) {
      let prefix;
      const native = productionKernel || globalThis.SetiProductionKernel;
      return (id, path, freePoints) => {
        if (prefix === undefined) {
          timingPrefixBuilds++;
          prefix = native.plannedMovementTimingKeyPrefix(state, seatId);
        } else timingPrefixReuses++;
        return movementTiming(state, id, path, freePoints, native.appendMovementTimingKey(prefix, id, path, freePoints));
      };
    }

    function movementTiming(state, id, path, freePoints, key) {
      const native = productionKernel || globalThis.SetiProductionKernel;`);
p=edit(p,'compareTiming:(id,path,free)=>movementTiming(state,id,path,free)','compareTiming:timingForOneGoalQuery(state)');
p=edit(p,'compareTiming: (id,path,free) => movementTiming(frame.stateBefore,id,path,free)','compareTiming: timingForOneGoalQuery(frame.stateBefore)');
p=edit(p,`      const result = goalMovement.plan({ state: readPlanningState(stored), seatId,
        actions: node.legalActions, status: node.status, session: stored.envelope.session?.session,
        intent: stored.intent, routeCache: movementRouteCache,
        compareTiming: (id,path,free) => movementTiming(readPlanningState(stored),id,path,free), endpoints: () => (productionKernel || globalThis.SetiProductionKernel).getProbeRouteRequirements(readPlanningState(stored), seatId, stored.envelope.session?.session?.queue?.[0])?.candidates || [] });`,`      const state = readPlanningState(stored);
      const result = goalMovement.plan({ state, seatId,
        actions: node.legalActions, status: node.status, session: stored.envelope.session?.session,
        intent: stored.intent, routeCache: movementRouteCache,
        compareTiming: timingForOneGoalQuery(state), endpoints: () => (productionKernel || globalThis.SetiProductionKernel).getProbeRouteRequirements(state, seatId, stored.envelope.session?.session?.queue?.[0])?.candidates || [] });`);
p=edit(p,'compareTiming:(id,path,free)=>movementTiming(preview,id,path,free)','compareTiming:timingForOneGoalQuery(preview)');
p=edit(p,'stableRestoreSkips, movementTimingCacheHits, movementTimingCacheMisses,','stableRestoreSkips, timingPrefixBuilds, timingPrefixReuses, movementTimingCacheHits, movementTimingCacheMisses,');
fs.writeFileSync(N+'production-kernel-timing-prefix-key-prototype-20261107-v1.js',k,{flag:'wx'});
fs.writeFileSync(N+'analysis-port-timing-prefix-key-prototype-20261107-v1.js',p,{flag:'wx'});

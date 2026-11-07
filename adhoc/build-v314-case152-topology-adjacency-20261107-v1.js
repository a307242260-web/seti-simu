'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/',file=D+'case152-primary-bound-v1/production-kernel-card-history-key-prototype-20261107-v4.js',out=D+'case152-topology-adjacency-v1/production-kernel-topology-adjacency-prototype-20261107-v1.js';
const report=JSON.parse(fs.readFileSync(D+'case152-primary-bound-v1/card-history-key-native-parity-20261107-v4.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),report.prototypeSha256);
function edit(s,old,replacement){assert.equal(s.split(old).length,2,old);return s.replace(old,replacement);}
let s=fs.readFileSync(file,'utf8');
s=edit(s,'    const queue = [initialRoute];',`    // Reachability of a single step depends on the coordinate and the same
    // stationary occupancy with this source excluded, never on first step,
    // free points, pending company moves, or the route taken to get here.
    const neighborsByCoordinate = new Map();
    function neighbors(coordinate) {
      const key = \`\${coordinate.x},\${coordinate.y}\`;
      let result = neighborsByCoordinate.get(key);
      if (result) {
        __topologyAdjacency.hits++;
        __topologyAdjacency.savedChecks += rocketAbility.MOVE_DIRECTIONS.length;
        return result;
      }
      result = [];
      for (const direction of rocketAbility.MOVE_DIRECTIONS) {
        __topologyAdjacency.nativeChecks++;
        const move = rockets.canMoveFromCoordinate(
          workingState.pieces, coordinate, direction.deltaX, direction.deltaY, source.rocketId,
        );
        if (move.ok) result.push({ direction, to: move.to });
      }
      neighborsByCoordinate.set(key, result);
      return result;
    }
    const queue = [initialRoute];`);
s=edit(s,`      for (const direction of rocketAbility.MOVE_DIRECTIONS) {
        const move = rockets.canMoveFromCoordinate(
          workingState.pieces,
          route.coordinate,
          direction.deltaX,
          direction.deltaY,
          source.rocketId,
        );
        if (!move.ok) continue;
        const destination = contentAt(move.to);`,`      for (const { direction, to } of neighbors(route.coordinate)) {
        const destination = contentAt(to);`);
s=edit(s,'          coordinate: move.to,','          coordinate: to,');
s=edit(s,'const productionKernelApi = Object.freeze({',`const __topologyAdjacency = { hits: 0, savedChecks: 0, nativeChecks: 0 };
const productionKernelApi = Object.freeze({
  diagnosticTopologyAdjacency: () => ({ ...__topologyAdjacency }),`);
fs.writeFileSync(out,s,{flag:'wx'});

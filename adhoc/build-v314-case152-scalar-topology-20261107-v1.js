'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/',file=D+'case152-primary-bound-v1/production-kernel-card-history-key-prototype-20261107-v4.js',out=D+'case152-scalar-topology-v1/production-kernel-scalar-topology-prototype-20261107-v1.js';
const report=JSON.parse(fs.readFileSync(D+'case152-primary-bound-v1/card-history-key-native-parity-20261107-v4.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),report.prototypeSha256);
function edit(s,old,replacement){assert.equal(s.split(old).length,2,old);return s.replace(old,replacement);}
let s=fs.readFileSync(file,'utf8');
s=edit(s,'function buildTopologyBody(workingState, player, context, sources) {','function buildTopologyBody(workingState, player, context, sources, scalarOrdinary = false) {');
s=edit(s,'  const routeKey = (route) => JSON.stringify([',`  // The scalar ordinary query returns only paid points. For a fixed source,
  // the Native neighbor, future cost and endpoint menu depend on the current
  // coordinate, not on how we reached it. Keep the same lexicographic
  // paid-points/length/publicity order and keep all full-menu identities intact.
  const coordinateKey = coordinate => \`\${coordinate.x},\${coordinate.y}\`;
  const routeKey = scalarOrdinary ? route => coordinateKey(route.coordinate) : (route) => JSON.stringify([`);
s=edit(s,'      if (bestRouteByState.get(routeKey(route)) !== route) continue;',`      if (bestRouteByState.get(routeKey(route)) !== route) continue;
      __scalarTopology.expanded[scalarOrdinary ? "scalar" : "full"]++;`);
s=edit(s,'      const key = JSON.stringify([route.coordinate.x, route.coordinate.y, route.firstStep]);','      const key = scalarOrdinary ? coordinateKey(route.coordinate) : JSON.stringify([route.coordinate.x, route.coordinate.y, route.firstStep]);');
s=edit(s,`function probeRouteTopology(workingState, player, context, sources) {
  const key = probeRouteTopologyKey(workingState, player, sources, context);`,`function probeRouteTopology(workingState, player, context, sources, scalarOrdinary = false) {
  // A scalar topology cannot supply first-action identities to full queries.
  const key = (scalarOrdinary ? "scalar-ordinary:" : "full:") + probeRouteTopologyKey(workingState, player, sources, context);`);
s=edit(s,'  const topology = Object.freeze(buildTopologyBody(workingState, player, context, sources));',`  __scalarTopology.misses[scalarOrdinary ? "scalar" : "full"]++;
  const topology = Object.freeze(buildTopologyBody(workingState, player, context, sources, scalarOrdinary));`);
s=edit(s,`    const topology=probeRouteTopology(workingState,player,context,sources);
    return buildProbeCandidateStructures(workingState,player,context,topology,sources,requestedRequirementId,true);`,`    const m=context.probeMovement;
    const scalarOrdinary=m.phase==="ordinary"&&m.cardRemaining===0&&m.scanRemaining===0&&m.companyRemaining===0;
    const topology=probeRouteTopology(workingState,player,context,sources,scalarOrdinary);
    return buildProbeCandidateStructures(workingState,player,context,topology,sources,requestedRequirementId,true);`);
s=edit(s,'const productionKernelApi = Object.freeze({',`const __scalarTopology = { misses: { scalar: 0, full: 0 }, expanded: { scalar: 0, full: 0 } };
const productionKernelApi = Object.freeze({
  diagnosticScalarTopology: () => structuredClone(__scalarTopology),`);
fs.writeFileSync(out,s,{flag:'wx'});

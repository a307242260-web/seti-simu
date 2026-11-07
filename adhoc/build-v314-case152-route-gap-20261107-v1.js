'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const R='reports/ai-foundation-20261107/',D=R+'case152-route-gap-v1/',src=R+'case152-rotation-reuse-v1/production-kernel-rotation-reuse-prototype-20261107-v2.js';
let k=fs.readFileSync(src,'utf8');
const start=k.indexOf('  const candidates = structureCandidates.map((candidate) => ({',k.indexOf('function finalizeProbeRequirements('));
const end=k.indexOf('  const shortestByRequirement = new Map();',start),rank='  const ranked = [...shortestByRequirement.values()].sort((left, right) => (';
assert(start>0&&end>start);assert.equal(k.split(rank).length,2);
const gap=k.slice(start,end).trim().replace('const candidates = structureCandidates.map(', '[...shortestByRequirement.values()].map(').replace(/;$/, '');
k=k.slice(0,start)+`  // Choosing and merging the shortest routes uses no wallet field. Fill
  // identical resource gaps only on the final representative of each ID.
  __routeGap.skippedGapObjects += structureCandidates.length;
`+k.slice(end);
const loop='  for (const candidate of candidates) {\n    const current = shortestByRequirement.get(candidate.requirementId);';
assert.equal(k.split(loop).length,2);
k=k.replace(loop,loop.replace('of candidates','of structureCandidates')).replace(rank,
  '  __routeGap.winnerGapObjects += shortestByRequirement.size;\n  __routeGap.skippedGapObjects -= shortestByRequirement.size;\n  const ranked = '+gap+'.sort((left, right) => (');
const api='const productionKernelApi = Object.freeze({';
assert.equal(k.split(api).length,2);
k=k.replace(api,'const __routeGap={skippedGapObjects:0,winnerGapObjects:0};\n'+api+'\n  diagnosticRouteGap:()=>({...__routeGap}),');
fs.writeFileSync(D+'production-kernel-route-gap-prototype-20261107-v1.js',k,{flag:'wx'});

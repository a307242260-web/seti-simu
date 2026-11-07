'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/case152-rotation-reuse-v1/',source=D+'production-kernel-rotation-reuse-prototype-20261107-v1.js',out=D+'production-kernel-rotation-reuse-prototype-20261107-v2.js';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const prior=JSON.parse(fs.readFileSync(D+'rotation-reuse-proofs-20261107-v1.json'));assert.equal(sha(prior.checkpoint),prior.checkpointSha256);
function edit(s,old,replacement){assert.equal(s.split(old).length,2,old);return s.replace(old,replacement);}
let k=fs.readFileSync(source,'utf8');
k=edit(k,'function buildProbeRouteRequirements(workingState, requestedPlayerId = null, session = null, includeMoveTiming = true, requestedRequirementId = null, paidDistanceOnly = false) {','function prepareProbeRoutes(workingState, requestedPlayerId, session) {');
k=edit(k,`  if(paidDistanceOnly){
    if(typeof requestedRequirementId!=="string")throw new TypeError("PROBE_DISTANCE_REQUIREMENT_INVALID");
    const m=context.probeMovement;
    const scalarOrdinary=m.phase==="ordinary"&&m.cardRemaining===0&&m.scanRemaining===0&&m.companyRemaining===0;
    const topology=probeRouteTopology(workingState,player,context,sources,scalarOrdinary);
    return buildProbeCandidateStructures(workingState,player,context,topology,sources,requestedRequirementId,true);
  }`,`  return { player, context, sources };
}

function preparePaidProbeDistance(workingState, requestedPlayerId) {
  const input = prepareProbeRoutes(workingState, requestedPlayerId, null);
  if (!input) return null;
  const { player, context, sources } = input, m = context.probeMovement;
  const scalarOrdinary = m.phase==="ordinary" && m.cardRemaining===0 && m.scanRemaining===0 && m.companyRemaining===0;
  const topology = probeRouteTopology(workingState, player, context, sources, scalarOrdinary);
  __rotationReuse.preparedDistanceContexts++;
  return requirementId => buildProbeCandidateStructures(workingState, player, context, topology, sources, requirementId, true);
}

function buildProbeRouteRequirements(workingState, requestedPlayerId = null, session = null, includeMoveTiming = true, requestedRequirementId = null) {
  const input = prepareProbeRoutes(workingState, requestedPlayerId, session);
  if (!input) return null;
  const { player, context, sources } = input;`);
k=edit(k,`    let snapshot = rotatedByPrefix?.get(prefix);
    if (!snapshot) {
      snapshot = cloneMovementPreview(before);`,`    let entry = prefix === null ? null : rotatedByPrefix?.get(prefix);
    if (!entry) {
      const snapshot = cloneMovementPreview(before);`);
k=edit(k,`      if (rotatedByPrefix && rotatedByPrefix.size < 64) rotatedByPrefix.set(prefix, snapshot);
    } else __rotationReuse.rotationReuses++;`,`      entry = { snapshot, distance: null };
      if (prefix !== null && rotatedByPrefix && rotatedByPrefix.size < 64) rotatedByPrefix.set(prefix, entry);
    } else __rotationReuse.rotationReuses++;
    const { snapshot } = entry;`);
k=edit(k,'    return buildProbeRouteRequirements(snapshot, seatId, null, false, requirementId, true);',`    // The common Native source/context/topology are read-only within this
    // rotated preview. Build the requested endpoint and reward independently.
    entry.distance ||= preparePaidProbeDistance(snapshot, seatId);
    return entry.distance(requirementId);`);
k=edit(k,'    if (rotatedByPrefix) prefix += JSON.stringify([step.rocketId, step.deltaX, step.deltaY]);',`    if (rotatedByPrefix && prefix !== null) {
      prefix = [step.rocketId, step.deltaX, step.deltaY].every(Number.isSafeInteger)
        ? prefix + JSON.stringify([step.rocketId, step.deltaX, step.deltaY]) : null;
    }`);
k=edit(k,'const __rotationReuse = { nativeRotations: 0, rotationReuses: 0 };','const __rotationReuse = { nativeRotations: 0, rotationReuses: 0, preparedDistanceContexts: 0 };');
fs.writeFileSync(out,k,{flag:'wx'});

'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const R='reports/ai-foundation-20261107/',P=R+'case152-timing-prefix-key-v1/',D=R+'case152-rotation-reuse-v1/';
const src=P+'production-kernel-timing-prefix-key-prototype-20261107-v2.js',port=P+'analysis-port-timing-prefix-key-prototype-20261107-v1.js';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(src),JSON.parse(fs.readFileSync(P+'timing-prefix-key-native-parity-20261107-v2.json')).prototypeSha256);
function edit(s,old,replacement){assert.equal(s.split(old).length,2,old);return s.replace(old,replacement);}
let k=fs.readFileSync(src,'utf8'),p=fs.readFileSync(port,'utf8');
k=edit(k,'function comparePlannedMovementTiming(state, seatId, requirementId, path, freePoints = 0) {',`function createPlannedMovementTimingQuery(state, seatId) {
  // This query is used only during one synchronous goal plan. It owns the
  // rotated preview copies and never caches a Native transition or legal menu.
  const rotatedByPrefix = new Map();
  return (id, path, freePoints) => comparePlannedMovementTiming(state, seatId, id, path, freePoints, rotatedByPrefix);
}

function comparePlannedMovementTiming(state, seatId, requirementId, path, freePoints = 0, rotatedByPrefix = null) {`);
k=edit(k,`  const afterRotation = snapshot => {
    const rotation = turnFlowApi.rotateSolarSystem(snapshot, 1, seatId, {captureSnapshots:false});
    if (!rotation.ok) throw new Error(\`PROBE_PLAN_ROTATION_FAILED: \${rotation.message}\`);`,`  const afterRotation = (before, prefix) => {
    let snapshot = rotatedByPrefix?.get(prefix);
    if (!snapshot) {
      snapshot = cloneMovementPreview(before);
      const rotation = turnFlowApi.rotateSolarSystem(snapshot, 1, seatId, {captureSnapshots:false});
      if (!rotation.ok) throw new Error(\`PROBE_PLAN_ROTATION_FAILED: \${rotation.message}\`);
      __rotationReuse.nativeRotations++;
      if (rotatedByPrefix && rotatedByPrefix.size < 64) rotatedByPrefix.set(prefix, snapshot);
    } else __rotationReuse.rotationReuses++;`);
k=edit(k,'  const delayed = afterRotation(cloneMovementPreview(state));','  let prefix = "";\n  const delayed = afterRotation(state, prefix);');
k=edit(k,'    const future = afterRotation(cloneMovementPreview(current));',`    if (rotatedByPrefix) prefix += JSON.stringify([step.rocketId, step.deltaX, step.deltaY]);
    const future = afterRotation(current, prefix);`);
k=edit(k,'const productionKernelApi = Object.freeze({',`const __rotationReuse = { nativeRotations: 0, rotationReuses: 0 };
const productionKernelApi = Object.freeze({
  createPlannedMovementTimingQuery,
  diagnosticRotationReuse: () => ({...__rotationReuse}),`);
p=edit(p,'      let prefix;\n      const native = productionKernel || globalThis.SetiProductionKernel;','      let prefix, query;\n      const native = productionKernel || globalThis.SetiProductionKernel;');
p=edit(p,'          prefix = native.plannedMovementTimingKeyPrefix(state, seatId);','          prefix = native.plannedMovementTimingKeyPrefix(state, seatId);\n          query = native.createPlannedMovementTimingQuery(state, seatId);');
p=edit(p,'return movementTiming(state, id, path, freePoints, native.appendMovementTimingKey(prefix, id, path, freePoints));','return movementTiming(id, path, freePoints, native.appendMovementTimingKey(prefix, id, path, freePoints), query);');
p=edit(p,'    function movementTiming(state, id, path, freePoints, key) {\n      const native = productionKernel || globalThis.SetiProductionKernel;','    function movementTiming(id, path, freePoints, key, query) {');
p=edit(p,'const result = native.comparePlannedMovementTiming(state,seatId,id,path,freePoints);','const result = query(id,path,freePoints);');
fs.writeFileSync(D+'production-kernel-rotation-reuse-prototype-20261107-v1.js',k,{flag:'wx'});
fs.writeFileSync(D+'analysis-port-rotation-reuse-prototype-20261107-v1.js',p,{flag:'wx'});

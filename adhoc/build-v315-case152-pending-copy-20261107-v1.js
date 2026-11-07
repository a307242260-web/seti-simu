'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const R='reports/ai-foundation-20261107/',D=R+'case152-pending-copy-v1/';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const v=R+'case152-lean-proof-path-v315-v1/source-manifest-20261107-v1.json';
assert.equal(sha(v),'00a258058d116c19a53483ad103ca1c39ed1e2fd1e5a2d550bafd47ec91922f7');
function edit(s,old,replacement){assert.equal(s.split(old).length,2,old);return s.replace(old,replacement);}
const k=fs.readFileSync(R+'case152-route-gap-v1/production-kernel-route-gap-prototype-20261107-v1.js','utf8');
const e=fs.readFileSync(R+'case152-native-copy-v1/session-runtime-prototype-20261107-v1.js','utf8');
const a=edit(k,'    stateStoreApi: {\n      createStateStore(initialState, storeOptions) {','    stateStoreApi: {\n      copyForkData: stateStoreApi.copyForkData,\n      createStateStore(initialState, storeOptions) {');
let b=edit(e,'  function createRuntime(options = {}) {','  let checkpointCopies = 0;\n  function createRuntime(options = {}) {');
b=edit(b,'      const restored=shareBase?','      if (shareBase && cloneTrustedCheckpoint !== clone) checkpointCopies++;\n      const restored=shareBase?');
b=edit(b,'    CHECKPOINT_SCHEMA_VERSION,','    CHECKPOINT_SCHEMA_VERSION,\n    diagnosticTrustedCheckpointCopies: () => checkpointCopies,');
fs.writeFileSync(D+'production-kernel-pending-copy-prototype-20261107-v1.js',a,{flag:'wx'});
fs.writeFileSync(D+'session-runtime-pending-copy-prototype-20261107-v1.js',b,{flag:'wx'});

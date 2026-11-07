'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='/private/tmp/seti-v316-case152-pending-copy-20261107-v1/',D='reports/ai-foundation-20261107/case152-identity-walk-v1/',M='reports/ai-foundation-20261107/case152-pending-copy-v316-v1/source-manifest-20261107-v1.json';
const m=JSON.parse(fs.readFileSync(M)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),file='randomizer/game/ai/analysis-port.js';
assert.equal(sha(root+file),m.sourceHashes[file]);let s=fs.readFileSync(root+file,'utf8');
function edit(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
edit('  function forwardIdentity(envelope,',`  const EFFECT_REFERENCE_KEYS = new Set(["effectId", "parentEffectId", "groupId", "quickGroupId", "decisionId", "choiceId"]);
  const VOLATILE_ACTION_KEYS = new Set(["actionId", "stateVersion", "decisionVersion"]);
  function forwardIdentity(envelope,`);
edit('    const referenceKeys = new Set(["effectId", "parentEffectId", "groupId", "quickGroupId", "decisionId", "choiceId"]);','    const referenceKeys = EFFECT_REFERENCE_KEYS;');
edit('          const item=normalize(value[i]);',`          const original = value[i];
          const item=original && typeof original==="object" ? normalize(original) : original;`);
edit(`        if(descriptor&&["actionId","stateVersion","decisionVersion"].includes(name))continue;
        const item=normalize(value[name],name);
        if(!result&&item!==value[name]){`,`        if(descriptor&&VOLATILE_ACTION_KEYS.has(name))continue;
        const original=value[name];
        // Plain primitives cannot contain an object or action descriptor.
        // Only a native session reference field can rewrite a string.
        const item=original && typeof original==="object"
          || (subtreeCache||prefix)&&typeof original==="string"&&referenceKeys.has(name)
          ? normalize(original,name) : original;
        if(!result&&item!==original){`);
fs.writeFileSync(D+'analysis-port-identity-walk-prototype-20261107-v1.js',s,{flag:'wx'});

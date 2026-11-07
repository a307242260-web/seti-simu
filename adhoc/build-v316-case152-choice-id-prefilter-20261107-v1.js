'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='/private/tmp/seti-v316-case152-pending-copy-20261107-v1/',D='reports/ai-foundation-20261107/case152-choice-id-prefilter-v1/',M='reports/ai-foundation-20261107/case152-pending-copy-v316-v1/source-manifest-20261107-v1.json',file='randomizer/game/effects/session-runtime.js';
const m=JSON.parse(fs.readFileSync(M)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(root+file),m.sourceHashes[file]);let s=fs.readFileSync(root+file,'utf8');
function edit(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
edit('  let checkpointCopies = 0;','  let checkpointCopies = 0, choiceIdRejects = 0, serializedCandidates = 0;');
edit('      const legalChoice = snapshot.choices.find((choice) => stableSerialize(choice) === serializedChoice);',`      const actionId = submission.choice?.actionId;
      const plainActionId = typeof actionId === "string" && !Array.isArray(submission.choice)
        && Object.prototype.propertyIsEnumerable.call(submission.choice, "actionId");
      const legalChoice = snapshot.choices.find(choice => {
        // Different own serialized action IDs cannot match. An ID match is
        // never sufficient: still compare the complete authoritative choice.
        if (plainActionId && typeof choice?.actionId === "string" && choice.actionId !== actionId
          && !Array.isArray(choice) && Object.prototype.propertyIsEnumerable.call(choice, "actionId")) {
          choiceIdRejects++;
          return false;
        }
        serializedCandidates++;
        return stableSerialize(choice) === serializedChoice;
      });`);
edit('    diagnosticTrustedCheckpointCopies: () => checkpointCopies,','    diagnosticTrustedCheckpointCopies: () => checkpointCopies,\n    diagnosticDecisionChoicePrefilter: () => ({choiceIdRejects,serializedCandidates}),');
fs.writeFileSync(D+'session-runtime-choice-id-prefilter-prototype-20261107-v1.js',s,{flag:'wx'});

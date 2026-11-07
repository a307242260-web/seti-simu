'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='/private/tmp/seti-v316-case152-pending-copy-20261107-v1/',R='reports/ai-foundation-20261107/',D=R+'case152-income-first-v1/',M=R+'case152-pending-copy-v316-v1/source-manifest-20261107-v1.json',file='randomizer/game/ai/decision-search.js';
const m=JSON.parse(fs.readFileSync(M)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(root+file),m.sourceHashes[file]);let s=fs.readFileSync(root+file,'utf8');
function edit(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
edit('    let incumbent = null;',`    let incumbent = null, followCompletedRootIncome = false;
    const mayFollowCompletedRootIncome = resourcePlanning && movementPlanning && finalMarkPlanning
      && stateValue?.isDefaultStateValueEvaluator?.(evaluate)
      && root.observation.publicState.roundNumber===4
      && [limits.transitions, limits.nodes, limits.frontier, limits.milliseconds].every(n=>n===Infinity);`);
edit('    function add(node, queuePriority = 0, initializeDeferred = false) {',`    function add(node, queuePriority = 0, initializeDeferred = false) {
      if(followCompletedRootIncome && !initializeDeferred) queuePriority=2;`);
edit('      const currentIndex=queue.pop();let entry = nodes[currentIndex];',`      const currentIndex=queue.pop();let entry = nodes[currentIndex];
      followCompletedRootIncome=mayFollowCompletedRootIncome&&entry.queuePriority===2;`);
edit('          if(!fresh)certificateNodes-=1;const added=add(fixed.node,["income","analyze","blue-data"].includes(alternative.resourcePlan.goal.kind)?1:0);if(added.equivalent)equivalents+=1;',`          if(!fresh)certificateNodes-=1;
          // Schedule the continuation of an actually completed root income
          // plan first in an uncapped R4 decision. It must still produce an
          // attained leaf before any already-proven strict bound can prune.
          const goalKind=alternative.resourcePlan.goal.kind;
          const prefer=mayFollowCompletedRootIncome&&currentIndex===0&&goalKind==="income"&&fixed.node.status==="stable";
          const added=add(fixed.node,prefer?2:["income","analyze","blue-data"].includes(goalKind)?1:0);if(added.equivalent)equivalents+=1;`);
fs.writeFileSync(D+'decision-search-income-first-prototype-20261107-v1.js',s,{flag:'wx'});

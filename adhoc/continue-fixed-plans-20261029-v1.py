from pathlib import Path
p=Path('randomizer/game/ai/analysis-port.js');s=p.read_text().replace('key, physicalKey, intent, cardControl, resourceControl','key, policyKey: cardKey, physicalKey, intent, cardControl, resourceControl')
s=s.replace('return { key: stored.key, actions:', 'return { key: stored.policyKey, actions:')
s=s.replace('entry.key === stored.key && entry.actions', 'entry.key === stored.policyKey && entry.actions')
s=s.replace('    function cardTradeBound(node) {','''    // Optional AI sidecar, never rule state or public decision evidence. Revalidate exact
    // physical/queue/RNG identity, legal envelopes and complete model/options on every hit.
    function exportPlan(token) {
      if (!token || planCertificate?.token !== token) return null;
      const { token: ignored, ...saved } = planCertificate;
      return structuredClone({schemaVersion:"seti-search-plan-checkpoint-v1",...saved});
    }
    function importPlan(saved) {
      if (saved == null) return null;
      if (saved.schemaVersion !== "seti-search-plan-checkpoint-v1" || typeof saved.modelKey !== "string"
        || !Array.isArray(saved.rows) || !saved.rows.length || saved.rows.length > 32
        || !Number.isSafeInteger(saved.source?.nodeCount) || saved.source.nodeCount < 1
        || saved.rows.some(row=>typeof row.key!=="string" || typeof row.actions!=="string" || typeof row.actionId!=="string"
          || !Number.isFinite(row.value) || !Number.isSafeInteger(row.distance) || row.distance < 1 || !Array.isArray(row.roots))) {
        throw new Error("ANALYSIS_PLAN_CHECKPOINT_INVALID");
      }
      const token=Object.freeze({});
      planCertificate={...freeze(structuredClone(saved)),token}; return token;
    }

    function cardTradeBound(node) {''')
s=s.replace('rememberSelection, reuseSelection, rememberPlan, reusePlan,','rememberSelection, reuseSelection, rememberPlan, reusePlan, exportPlan, importPlan,')
# Planning enable mutates the root key after openRoot, keep its unbound matching key current.
s=s.replace('stored.key = JSON.stringify([stored.physicalKey, stored.intent]);','stored.key = JSON.stringify([stored.physicalKey, stored.intent]); stored.policyKey = stored.key;')
s=s.replace('stored.key=JSON.stringify([stored.key,stored.cardControl]);','stored.key=JSON.stringify([stored.key,stored.cardControl]);stored.policyKey=stored.key;')
p.write_text(s)
p=Path('randomizer/game/ai/decision-search.js');s=p.read_text();s=s.replace('    const resourceGroups = new Map();','    const resourceGroups = new Map();\n    const resourceExecutions = new Map();',1)
s=s.replace('            preparations:fixed.preparations,steps:fixed.prefixes.map(p=>p.action.actionId)});','            preparations:fixed.preparations,steps:fixed.prefixes.map(p=>p.action.actionId)});\n          resourceExecutions.set(entry.edges.at(-1),fixed);')
a=s.index('        // Resource preparation is replanned');b=s.index('        if(entry.fixedCardExecutions',a)
s=s[:a]+'''        if(best.resourcePlan){
          const macro=resourceExecutions.get(best);
          for(let i=1;i<macro.prefixes.length&&entries.length<32;i++){
            const prefix=macro.prefixes[i];
            entries.push({node:prefix.node,actionId:prefix.action.actionId,value:entry.value,distance:entry.distance-i,
              sourceNode:`resource:${current}:${i}`,roots:prefix.node.legalActions.map(action=>({actionId:action.actionId,
                value:action.actionId===prefix.action.actionId?entry.value:null,valueType:action.actionId===prefix.action.actionId?"attained-lower-bound":"not-executed",
                completion:"committed-goal-plan-execution",policy:"seti-goal-resource-preparation-v1",goalId:best.resourcePlan.goal.id,isEquivalence:false}))});
          }
          current=best.target;continue;
        }
''' +s[b:];p.write_text(s)
p=Path('randomizer/game/ai/search-agent.js');s=p.read_text().replace('return Object.freeze({ decide,','''return Object.freeze({ decide,
      createCheckpoint() {
        const plan=analysisPort.exportPlan?.(planContinuation);
        return plan ? {schemaVersion:"seti-search-agent-checkpoint-v1",seatId,modelChecksum:MODEL_CHECKSUM,plan} : null;
      },
      loadCheckpoint(saved) {
        continuation=null; planContinuation=null;
        if(saved==null)return;
        if(saved.schemaVersion!=="seti-search-agent-checkpoint-v1"||saved.seatId!==seatId)throw new Error("SEARCH_AGENT_CHECKPOINT_INVALID");
        // A save from another policy is valid game state, but provides no current proof.
        if(saved.modelChecksum===MODEL_CHECKSUM)planContinuation=analysisPort.importPlan(saved.plan);
      },''');p.write_text(s)
p=Path('randomizer/game/ai/agent-runtime.js');s=p.read_text().replace('return Object.freeze({ run, getProvenance: () => provenance,','''return Object.freeze({ run, getProvenance: () => provenance,
      createCheckpoint: () => agent.createCheckpoint?.() || null,
      loadCheckpoint: saved => agent.loadCheckpoint?.(saved),''');p.write_text(s)
p=Path('randomizer/app/simulation-env.js');s=p.read_text().replace('const agents = new Map();','const agents = new Map();\n  let agentCheckpoints = {};',1)
s=s.replace('      agents.clear();','      agents.clear();\n      agentCheckpoints = {};',1)
s=s.replace('        agents.set(seatId, agent);','        agent.loadCheckpoint(agentCheckpoints[seatId]);\n        delete agentCheckpoints[seatId];\n        agents.set(seatId, agent);',1)
s=s.replace('    saveBrowserSave(options = {}) {','''    saveMachineAI() {
      const saved = {...agentCheckpoints};
      for (const [seat,agent] of agents) {
        const checkpoint=agent.createCheckpoint();
        if(checkpoint)saved[seat]=checkpoint;else delete saved[seat];
      }
      return clone(saved);
    },

    saveBrowserSave(options = {}) {''')
s=s.replace('        replaySteps: browserReplaySteps,','        replaySteps: browserReplaySteps,\n        machineAI: this.saveMachineAI(),',1)
s=s.replace('        config: clone(config || {}),','        config: clone(config || {}),\n        machineAI: this.saveMachineAI(),',1)
s=s.replace('      seededRandom.setState(rngState.state);','      seededRandom.setState(rngState.state);\n      agentCheckpoints = clone(checkpoint.machineAI || {});',1)
p.write_text(s)
p=Path('randomizer/app/ai/browser-bootstrap.js');s=p.read_text().replace('    const agents = new Map();','    const agents = new Map();\n    let agentCheckpoints = {};',1)
s=s.replace('          }));\n        }\n        return agents.get(seatId);','          }));\n          agents.get(seatId).loadCheckpoint(agentCheckpoints[seatId]);\n          delete agentCheckpoints[seatId];\n        }\n        return agents.get(seatId);',1)
s=s.replace('      agents.clear();','      agents.clear();\n      agentCheckpoints = {};',1)
s=s.replace('    return Object.freeze({ runOnce, invalidate, inspect });','''    function createCheckpoint() {
      const saved={...agentCheckpoints};
      for(const [seat,agent] of agents){const checkpoint=agent.createCheckpoint();if(checkpoint)saved[seat]=checkpoint;else delete saved[seat];}
      return structuredClone(saved);
    }
    function loadCheckpoint(saved) { invalidate("AI checkpoint restored"); agentCheckpoints=structuredClone(saved||{}); }
    return Object.freeze({ runOnce, invalidate, inspect, createCheckpoint, loadCheckpoint });''')
p.write_text(s)
p=Path('randomizer/app.js');s=p.read_text().replace('      replaySteps: structuredClone(browserReplaySteps),','      replaySteps: structuredClone(browserReplaySteps),\n      machineAI: browserAi.machinePlayerPort.createCheckpoint(),',1)
s=s.replace('    // 读档后把人类座位绑定','    browserAi.machinePlayerPort.loadCheckpoint(payload.machineAI);\n    // 读档后把人类座位绑定',1);p.write_text(s)
for name in ['tools/run_research_validation.js','tools/load_save_simulation.js']:
 p=Path(name);s=p.read_text().replace('    browserReplaySteps: Array.isArray(save.replaySteps)', '    machineAI: save.machineAI || {},\n    browserReplaySteps: Array.isArray(save.replaySteps)',1);p.write_text(s)

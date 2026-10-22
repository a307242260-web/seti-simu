"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),crypto=require("node:crypto"),path=require("node:path");
const {createSimulationRuleComposition}=require("../randomizer/training/simulation-rule-composition");
const {createSeededRandom}=require("../randomizer/game/random");
const {buildRuleObservation}=require("../randomizer/app/rule-observation");
const output="reports/ai-foundation-20261023/plan-prefix-receipt-v1.json";assert(!fs.existsSync(output),"Existing receipt; reuse checkpoint");
const benchmarkPath="reports/ai-foundation-20261023/plan-prefix-benchmark-v2.json",b=JSON.parse(fs.readFileSync(benchmarkPath));
const f=JSON.parse(fs.readFileSync(b.fixturePath)),seed=f.source.seed,sha=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
assert.equal(sha(b.fixturePath),b.fixtureSha256);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition;
assert(comp.lifecycle.restore(f.compositionEnvelope).ok);let out,before;const receipts=[];
for(const row of b.modes.find(m=>m.reuse).rows){
 before=comp.inspect();const actions=before.phase==="awaiting_input"?before.session.decision.choices:comp.inputPort.enumerateActions({});
 const action=actions.find(a=>a.actionId===row.actionId);assert(action);
 out=before.phase==="awaiting_input"?comp.inputPort.submitDecision({decisionId:before.session.decision.decisionId,
  decisionVersion:before.session.decision.decisionVersion,ownerId:before.session.decision.ownerId,choice:action})
  :action.phase==="quick"?comp.inputPort.submitQuickAction(action):comp.inputPort.submitAction(action);assert(out.ok,out.message);
 const envelope=comp.lifecycle.save().envelope,hash=crypto.createHash("sha256").update(envelope.committedState).digest("hex");
 assert.equal(hash,row.committedStateSha256);receipts.push({step:row.step,actionId:action.actionId,committedStateSha256:hash});
}
const inspection=comp.inspect(),barrier=out.irreversibleBarrier||inspection.session?.irreversibleBarrier;
assert(barrier?.code?.startsWith("hidden_")&&JSON.stringify(barrier)!==JSON.stringify(before.session?.irreversibleBarrier),"最后一输入必须到达新的隐藏信息边界");
const checkpointPath="adhoc/ai-decision-corpus-20261023-v1/plan-prefix-window-receipt-v1.checkpoint.json";
fs.writeFileSync(checkpointPath,JSON.stringify(comp.lifecycle.save().envelope)+"\n");
const report={scope:"replay the ten already recorded formal inputs without any AI/search; verify actual information boundary and checkpoint, no new speed or score experiment",
 benchmarkPath,benchmarkSha256:sha(benchmarkPath),fixturePath:b.fixturePath,fixtureSha256:b.fixtureSha256,receipts,
 finalBoundary:barrier.code,finalPhase:inspection.phase,checkpointPath,checkpointSha256:sha(checkpointPath),
 sourceHashes:Object.fromEntries(Object.keys(require.cache).filter(p=>p.includes("/randomizer/")).map(p=>[path.relative(process.cwd(),p),sha(p)])),status:"passed"};
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({inputs:receipts.length,boundary:barrier.code,checkpointPath}));comp.dispose();

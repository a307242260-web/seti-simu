"use strict";
const fs=require("node:fs"),crypto=require("node:crypto"),assert=require("node:assert/strict"),zlib=require("node:zlib");
const {createSimulationRuleComposition}=require("../randomizer/training/simulation-rule-composition"),{createSeededRandom}=require("../randomizer/game/random"),{buildRuleObservation}=require("../randomizer/app/rule-observation"),{createAnalysisPort}=require("../randomizer/game/ai/analysis-port"),{searchDecision}=require("../randomizer/game/ai/decision-search"),{createStateValueEvaluator}=require("../randomizer/game/ai/state-value"),agent=require("../randomizer/game/ai/search-agent");
const output="reports/ai-foundation-20261023/post-main-attainment-actual-window-v4.json";assert(!fs.existsSync(output),"Reuse terminal checkpoint");
const fixturePath="adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json",checkpointPath="adhoc/ai-decision-corpus-20261023-v1/post-main-value-actual-window-v1.json",f=JSON.parse(fs.readFileSync(fixturePath)),checkpoint=JSON.parse(fs.readFileSync(checkpointPath)),seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition;assert(comp.lifecycle.restore(checkpoint.compositionEnvelope).ok);
const sha=b=>crypto.createHash("sha256").update(b).digest("hex"),report={scope:"Actual case062 after formal DLC23, default shared search factory budget. Full game speed/score untested.",fixturePath,checkpointPath,checkpointSha256:sha(fs.readFileSync(checkpointPath)),budget:agent.BUDGET,rows:[]};
function submit(id){const current=comp.inspect(),decision=current.phase==="awaiting_input"?current.session.decision:null;
 const action=(decision?decision.choices:comp.inputPort.enumerateActions({})).find(a=>a.actionId===id);assert(action);
 const result=decision?comp.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:action}):action.phase==="quick"?comp.inputPort.submitQuickAction(action):comp.inputPort.submitAction(action);assert(result.ok,JSON.stringify(result));}
const p=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(f.seatId);let token=null;
try {
 for(let step=0;step<16;step+=1){
  const before=comp.lifecycle.save().envelope,root=p.openRoot();if(["other-owner","information-barrier","terminal"].includes(root.status))break;
  const at=performance.now(),result=searchDecision({port:p,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,planContinuation:token,budget:agent.BUDGET}),milliseconds=performance.now()-at;
  assert.deepEqual(comp.lifecycle.save().envelope,before);
  const rawPath=`adhoc/ai-decision-corpus-20261023-v1/post-main-attainment-actual-step${String(step).padStart(2,"0")}-v4.raw.json.gz`,raw=JSON.stringify(result)+"\n",bytes=zlib.gzipSync(raw);fs.writeFileSync(rawPath,bytes);
  const row={step,complete:result.complete,actionId:result.actionId,value:result.value,distance:result.lines[0]?.distance??result.reusedCoverage?.distance,milliseconds,diagnostics:result.diagnostics,unresolved:result.unresolved.length,rawPath,rawSha256:sha(bytes),rootUnchanged:true};report.rows.push(row);fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({step,complete:row.complete,milliseconds:row.milliseconds,transitions:row.diagnostics.transitions,distance:row.distance}));
  if(!result.complete)break;
  const predictedBoundary=["other-owner","information-barrier","terminal"].includes(p.expand(root,result.actionId).status);token=result.planContinuation;p.close();
  const coldPort=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0});try{
   const cold=searchDecision({port:coldPort,root:coldPort.openRoot(),evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:agent.BUDGET});
   row.cold={complete:cold.complete,actionId:cold.actionId,value:cold.value,distance:cold.lines[0]?.distance,diagnostics:cold.diagnostics};
   assert(cold.complete,JSON.stringify(row.cold));assert.equal(cold.actionId,result.actionId);assert.equal(cold.value,result.value);assert.equal(cold.lines[0].distance,row.distance);
  }finally{coldPort.close();}fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");submit(result.actionId);if(predictedBoundary){report.boundaryReached=true;report.finalEnvelopeSha256=sha(JSON.stringify(comp.lifecycle.save().envelope));break;}
 }
 report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.includes("/randomizer/")).map(p=>[p.slice(process.cwd().length+1),sha(fs.readFileSync(p))]));report.terminal=true;fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
}finally{p.close();comp.dispose();}

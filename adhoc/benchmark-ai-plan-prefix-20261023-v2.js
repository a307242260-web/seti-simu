"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),crypto=require("node:crypto"),path=require("node:path");
const {createSimulationRuleComposition}=require("../randomizer/training/simulation-rule-composition");
const {createSeededRandom}=require("../randomizer/game/random");
const {buildRuleObservation}=require("../randomizer/app/rule-observation");
const {createAnalysisPort}=require("../randomizer/game/ai/analysis-port");
const {searchDecision}=require("../randomizer/game/ai/decision-search");
const {createStateValueEvaluator}=require("../randomizer/game/ai/state-value");
const output="reports/ai-foundation-20261023/plan-prefix-benchmark-v2.json";assert(!fs.existsSync(output),"Existing benchmark; reuse checkpoint");
const fixturePath="adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json",f=JSON.parse(fs.readFileSync(fixturePath));
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function canonical(envelope){
 if(!envelope.session)return envelope;
 const names=new Map(),session=JSON.stringify(envelope.session).replace(/effect-session-[0-9]+(?=[:"\\])/g,name=>{
  if(!names.has(name))names.set(name,`effect-session-ref-${names.size}`);return names.get(name);
 });return {...envelope,session:JSON.parse(session)};
}
const report={scope:"one complete ten-input visible window, cold recomputation vs completed-prefix reuse; not a whole game or fixed-budget acceptance",
 fixturePath,fixtureSha256:sha(fs.readFileSync(fixturePath)),budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000},
 timingScope:"each mode from kernel construction through ten real inputs and final save, including root/search/close/actual execution; excludes raw report writes; same-process sequential warmup prevents isolated speed-ratio claims",
 sessionComparison:"full committed state exact; all session fields retained with bijective temporary-handle renaming",modes:[]};
let control;
for(const reuse of [false,true]){
 const at=performance.now(),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,
  trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
 k.newGame({seed});const comp=k.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
 const port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(f.seatId),rows=[],searches=[];
 let token=null,length=null;
 for(let step=0;step<(length??1);step++){
  const before=comp.lifecycle.save().envelope,start=performance.now(),root=port.openRoot();
  const result=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,planReuse:reuse,planContinuation:token,
   resourceDominance:true,moneyCapacityDominance:true,cardTradePruning:true,postMainPruning:true,openingPruning:true,cardChoiceEquivalence:true,budget:report.budget});
  const rootAndSearchMilliseconds=performance.now()-start;assert(result.complete,result.stopReason);
  if(length===null)length=result.lines[0].distance;
  assert.deepEqual(comp.lifecycle.save().envelope,before);token=result.planContinuation;
  const {planContinuation,selectionContinuation,...publicResult}=result;searches.push(publicResult);port.close();
  const current=comp.inspect(),actions=current.phase==="awaiting_input"?current.session.decision.choices:comp.inputPort.enumerateActions({});
  const action=actions.find(a=>a.actionId===result.actionId);assert(action);
  const out=current.phase==="awaiting_input"?comp.inputPort.submitDecision({decisionId:current.session.decision.decisionId,
   decisionVersion:current.session.decision.decisionVersion,ownerId:current.session.decision.ownerId,choice:action})
   :action.phase==="quick"?comp.inputPort.submitQuickAction(action):comp.inputPort.submitAction(action);assert(out.ok,out.message);
  const after=comp.lifecycle.save().envelope;
  rows.push({step,actionId:result.actionId,value:result.value,distance:result.reusedCoverage?.distance??result.lines[0].distance,
   transitions:result.diagnostics.transitions,continuation:result.diagnostics.planContinuation,rootAndSearchMilliseconds,
   committedStateSha256:sha(after.committedState),canonicalEnvelopeSha256:sha(JSON.stringify(canonical(after)))});
 }
 const milliseconds=performance.now()-at;
 if(!reuse)control=rows;else for(let i=0;i<rows.length;i++)for(const key of ["actionId","value","distance","committedStateSha256","canonicalEnvelopeSha256"])assert.equal(rows[i][key],control[i][key],`${i}/${key}`);
 const rawPath=`adhoc/ai-decision-corpus-20261023-v1/plan-prefix-${reuse?"reuse":"cold"}-v2.raw.json`;fs.writeFileSync(rawPath,JSON.stringify(searches)+"\n");
 const mode={reuse,inputs:rows.reduce((n,r)=>n+r.transitions,0),milliseconds,physicalInputs:rows.length,hits:rows.filter(r=>r.continuation==="hit").length,rows,rawPath,rawSha256:sha(fs.readFileSync(rawPath))};
 report.modes.push(mode);fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({reuse,inputs:mode.inputs,milliseconds,physicalInputs:rows.length,hits:mode.hits,perStep:rows.map(r=>r.transitions)}));
 comp.dispose();
}
assert(report.modes[1].inputs<report.modes[0].inputs);assert.equal(report.modes[1].hits,9);
report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.includes("/randomizer/")).map(p=>[path.relative(process.cwd(),p),sha(fs.readFileSync(p))]));
report.status="passed";fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");

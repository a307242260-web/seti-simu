"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),crypto=require("node:crypto"),path=require("node:path");
const {createSimulationRuleComposition}=require("../randomizer/training/simulation-rule-composition");
const {createSeededRandom}=require("../randomizer/game/random");
const {buildRuleObservation}=require("../randomizer/app/rule-observation");
const {createAnalysisPort}=require("../randomizer/game/ai/analysis-port");
const {searchDecision}=require("../randomizer/game/ai/decision-search");
const {createStateValueEvaluator}=require("../randomizer/game/ai/state-value");
const catalog=require("../randomizer/game/industry/catalog");
const output="reports/ai-foundation-20261023/late-cold-profile-v5.json";assert(!fs.existsSync(output),"Existing profile; reuse checkpoint");
const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const report={scope:"three previously incomplete late checkpoints, existing 256-input cold budget, public descriptor shape and proof applicability profile only; no full games or score grade",
 budget:{transitions:256,nodes:257,frontier:256,milliseconds:600},rows:[]};
for(const id of ["062","105","152"]){
 const fixturePath=`adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`,f=JSON.parse(fs.readFileSync(fixturePath)),seed=f.source.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
 const before=comp.lifecycle.save().envelope,port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}),root=port.openRoot(),calls={},proofs={};
 const instrumented={...port,expand(node,actionId){
  const a=node.legalActions.find(a=>a.actionId===actionId),t=a.target||{},p=a.payload||{};
  const key=JSON.stringify([node.status,a.family,t.kind||null,typeof t.choiceId==="string"?t.choiceId.split(":")[0]:null,Object.keys(t).sort(),Object.keys(p).sort(),p.kind||null]);
  const at=performance.now(),child=port.expand(node,actionId),ms=performance.now()-at;
  const row=calls[key]||={count:0,milliseconds:0,target:t,payload:p,childStatuses:{}};
  row.count+=1;row.milliseconds+=ms;row.childStatuses[child.status]=(row.childStatuses[child.status]||0)+1;return child;
 },expandSelection(node,selectedIds){const at=performance.now(),out=port.expandSelection(node,selectedIds);const row=calls["selection-macro"]||={count:0,submissions:0,milliseconds:0};row.count+=1;row.submissions+=out.submissions;row.milliseconds+=performance.now()-at;return out;}};
 for(const key of ["openingPlanSpec","postMainPlanSpec","openingMoneyCapacity","openingResourceOrder","postMainResourceOrder","cardTradeBound","passReserveChoiceSpec","knownCardMoneyOrder"]){
  instrumented[key]=node=>{const p=port[key](node),row=proofs[key]||={checked:0,supported:0};row.checked+=1;if(p)row.supported+=1;return p;};
 }
 const evaluate=createStateValueEvaluator(f.seatId),at=performance.now();
 const result=searchDecision({port:instrumented,root,evaluate,modelKey:evaluate.modelKey,planReuse:true,resourceDominance:true,moneyCapacityDominance:true,
  cardTradePruning:true,postMainPruning:true,openingPruning:true,cardChoiceEquivalence:true,budget:report.budget});
 const milliseconds=performance.now()-at;assert.deepEqual(comp.lifecycle.save().envelope,before);
 const state=JSON.parse(before.committedState),own=state.players.players.find(p=>p.id===f.seatId);
 const rawPath=`adhoc/ai-decision-corpus-20261023-v1/late-profile-case-${id}-v5.raw.json`;fs.writeFileSync(rawPath,JSON.stringify(result)+"\n");
 const row={id,fixturePath,fixtureSha256:sha(fixturePath),complete:result.complete,stopReason:result.stopReason,milliseconds,diagnostics:result.diagnostics,
  port:port.getDiagnostics(),company:catalog.getPlayerIndustryDefinition(own)?.label||null,publicRoot:{resources:own.resources,income:own.income,
   hand:own.hand.map(c=>({id:c.id,cardId:c.cardId})),reserved:own.reservedCards.map(c=>({id:c.id,cardId:c.cardId})),tech:own.techState},
  calls,proofs,rootUnchanged:true,rawPath,rawSha256:sha(rawPath)};
 report.rows.push(row);fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({id,company:row.company,complete:row.complete,inputs:row.diagnostics.transitions,milliseconds,proofs,calls:Object.entries(calls).map(([k,v])=>({key:k,count:v.count,submissions:v.submissions}))}));
 port.close();comp.dispose();
}
report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.includes("/randomizer/")).map(p=>[path.relative(process.cwd(),p),sha(p)]));report.status="complete";
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");

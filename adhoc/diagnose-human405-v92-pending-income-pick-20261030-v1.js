'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),value=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent');
const fixture='adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-040-20261030-v1.json',output='reports/ai-foundation-20261023/human405-v92-pending-income-pick-gap-20261030-v1.json',f=JSON.parse(fs.readFileSync(fixture));assert(!fs.existsSync(output));assert.equal(search.VERSION,'seti-complete-decision-search-v92');
const rows=[];
for(const cardId of ['card-17-0','card-40-0','card-19-0']){
 const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
 try{
  let n=p.openRoot();p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const selectedPolicy=p.cardPickSpec(n),nativeSteps=[];
  const submit=id=>{const a=n.legalActions.find(x=>x.actionId===id);assert(a);nativeSteps.push({family:a.family,summary:a.summary,target:a.target});n=p.expand(n,id);};
  const a=n.legalActions.find(a=>a.target?.cardInstanceId===cardId);assert(a);submit(a.actionId);
  const r=search.searchDecision({port:{...p,postMainValueBound:()=>null,incomePlanSummary:()=>null,turnTailSummary:()=>null},root:n,evaluate:value.createStateValueEvaluator(f.seatId),...agent.OPTIONS,planReuse:false,budget:{transitions:4096,nodes:8192,frontier:4096,milliseconds:15000}});assert(r.complete,r.stopReason);
  let i=0;for(let depth=0;depth<=r.lines.length;depth++){const line=r.lines[i];if(['information-barrier','terminal','other-owner','turn-boundary'].includes(line.status))break;
   const e=line.edges.filter(e=>r.lines[e.target].value!==null).sort((a,b)=>r.lines[b.target].value-r.lines[a.target].value||(r.lines[a.target].distance+a.cost)-(r.lines[b.target].distance+b.cost)||(a.actionId<b.actionId?-1:1))[0];assert(e);assert(!e.knownIncomePlan&&!e.turnTailPlanValue);for(const id of e.steps||[e.actionId])submit(id);i=e.target;}
  const o=n.observation,player=o.publicState.players.find(x=>x.playerId===f.seatId),v=value.evaluateStateValue(o,f.seatId);assert.equal(v.total,r.value);assert.deepEqual(c.lifecycle.save().envelope,before);
  rows.push({offeredCardId:cardId,offeredCard:a.summary,currentPolicy:selectedPolicy,completePolicyValue:r.value,leafStatus:n.status,nativeSteps,player,value:v,sourceRootAndRngUnchanged:true});
 }finally{p.close();c.dispose();}
}
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
const queue=f.compositionEnvelope.session.session.queue.map(e=>({type:e.type,ownerId:e.ownerId,reward:e.payload?.reward||null}));
fs.writeFileSync(output,JSON.stringify({schemaVersion:'seti-pending-income-pick-gap-v1',sourceCommit:'9d707d66483d8ec6c5f754be52ac485638442fea',fixture,fixtureSha256:sha(fixture),queue,rows,sourceHashes,scope:'Diagnostic forced known offered choices then native same-policy continuation; production must retain one greedy selection, not enumerate cards. Scalar superiority alone does not prove longer-term strategic equivalence.'},null,2)+'\n');console.log(JSON.stringify({output,rows:rows.map(r=>({card:r.offeredCard,value:r.completePolicyValue,steps:r.nativeSteps.map(x=>x.summary)}))}));

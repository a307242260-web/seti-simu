'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const w=process.cwd(),load=p=>require(path.join(w,p)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',nativePath=D+'v323-known-free-landing-native-20261107-v1.json',n=read(nativePath),f=read(n.fixture),timingFile='/private/tmp/seti-v323-held-landing-timing-native-20261107-v1.json';
const id=process.argv[2], envelope={root:f.compositionEnvelope,launch:n.launched.envelope,after:()=>read(timingFile).paths[0].after.envelope}[id];assert(envelope);
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port'),search=load('randomizer/game/ai/decision-search'),values=load('randomizer/game/ai/state-value'),agent=load('randomizer/game/ai/search-agent');
const seat=f.seatId,seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
assert(c.lifecycle.restore(typeof envelope==='function'?envelope():envelope).ok);const before=c.lifecycle.save().envelope,port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
try{
 const start=performance.now(),root=port.openRoot(),evaluate=values.createStateValueEvaluator(seat);
 const result=search.searchDecision({port,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET}),ms=performance.now()-start;
 assert.deepEqual(c.lifecycle.save().envelope,before);
 const out='/private/tmp/seti-v324-held-landing-'+id+'-20261107-v2.json',plan=result.planContinuation&&port.exportPlan(result.planContinuation);
 const {planContinuation,selectionContinuation,...publicResult}=result;
 const selectedMoves=[],restored=[];let endWallet=null;
 if(id==='after'){
  assert(plan&&plan.rows.length>3);port.close();
  for(let i=0;i<plan.rows.length;i++){
   const live=c.lifecycle.save().envelope,fresh=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
   try{
    const token=fresh.importPlan(plan),next=fresh.openRoot(),hit=search.searchDecision({port:fresh,root:next,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET,planContinuation:token});
    assert.equal(hit.diagnostics.planContinuation,"hit",JSON.stringify({i,wanted:plan.rows[i].actionId,source:plan.rows[i].sourceNode,actual:hit.actionId,reason:hit.diagnostics.planContinuation}));assert.equal(hit.actionId,plan.rows[i].actionId);
    assert.deepEqual(c.lifecycle.save().envelope,live);
    const a=next.legalActions.find(a=>a.actionId===hit.actionId);assert(a);
    const d=c.inspect().session?.decision,applied=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
    assert(applied.ok);restored.push([a.family,a.target]);
    if(a.family==='move')selectedMoves.push(a.target);
    if(a.target?.landTarget?.type==='planet')assert.equal(a.target.rocketId,selectedMoves[0].rocketId);
   }finally{fresh.close();}
  }
  const owner=JSON.parse(c.lifecycle.save().envelope.committedState).players.players.find(p=>p.id===seat);
  assert(owner.reservedCards.some(c=>c.cardId==='dlc_31.png'));assert(owner.hand.some(c=>c.cardId==='b_101.webp'));
  endWallet=owner.resources;assert(c.lifecycle.restore(before).ok);assert.deepEqual(c.lifecycle.save().envelope,before);
 }
 const digest=Object.fromEntries(['probe-capital','analysis-port','resource-demand','decision-search'].map(n=>[n,sha(path.join(w,'randomizer/game/ai',n+'.js'))]));
 fs.writeFileSync(out,JSON.stringify({id,nativePath,nativeSha256:sha(nativePath),timingFile,timingSha256:sha(timingFile),digest,ms,result:publicResult,plan,restored,endWallet},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,complete:result.complete,stop:result.stopReason,selected:result.actionId,value:result.value,inputs:result.diagnostics.nativeExecutions,ms,launch:result.roots.find(r=>r.actionId.startsWith('launch:'))?.value,resource:result.candidates.filter(x=>x.plan?.goal?.kind==='held-landing-route').map(x=>[x.plan.goal.planetId,x.plan.goal.path.length,x.firstActionId]),restored:restored.length,endWallet}));
}finally{port.close();c.dispose();}

"use strict";
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const output='reports/ai-foundation-20261023/six-greedy-plans-corpus-20261028-v1.json';if(fs.existsSync(output))throw Error('Existing bounded corpus audit; reuse checkpoint');
const corpus=JSON.parse(fs.readFileSync('reports/ai-foundation-20261023/decision-corpus-summary-v1.json'));
const selected=[],seen=new Set();function take(label,predicate){const item=corpus.cases.find(c=>!seen.has(c.id)&&predicate(c));assert(item,label);selected.push({label,item});seen.add(item.id);}
take('initial-selection',c=>c.classification.phase==='setup'&&c.classification.targetKinds.includes('select_initial_card'));
take('initial-income',c=>c.classification.targetKinds.includes('discard-hand-cards'));
take('first-other-company-main',c=>c.classification.phase==='before-main'&&c.classification.company!=='industry:赫利昂联合体.png');
take('first-other-company-post-main',c=>c.classification.phase==='after-main'&&c.classification.company!=='industry:赫利昂联合体.png');
take('regular-conditional',c=>c.classification.phase==='conditional'&&!c.classification.targetKinds.includes('start_initial_setup'));
take('round2-main-with-tech',c=>c.classification.phase==='before-main'&&c.classification.round===2&&c.classification.ownTech);
take('round3-main-with-reserved',c=>c.classification.phase==='before-main'&&c.classification.round===3&&c.classification.ownReserved);
take('round4-main',c=>c.classification.phase==='before-main'&&c.classification.round===4);
const agent=require('../randomizer/game/ai/search-agent'),demand=require('../randomizer/game/ai/resource-demand');
const report={schemaVersion:'seti-ai-decision-corpus-audit-v1',scope:'eight fresh cold checkpoints under goal movement, fixed card acquisition and goal-bound scan purposes; borrowing disabled; six ordered greedy contractions for paid repeats, movement timing, income tails, PASS discard, blue slots and pure resource triggers; policy exclusions are not native equivalence; no prior completion token at any root; seven sequential cases plus reused source-identical standalone case-062, no full games or score grade',budget:{transitions:256,nodes:257,frontier:256,milliseconds:600},rows:[]};
for(const {label,item} of selected){
 if(item.id==='case-062'){const previous=JSON.parse(fs.readFileSync('reports/ai-foundation-20261023/six-greedy-plans-case062-20261028-v1.json'));for(const [p,h] of Object.entries(previous.sourceHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),h);const row=previous.rows[0];report.rows.push({...row,reusedCheckpoint:'reports/ai-foundation-20261023/six-greedy-plans-case062-20261028-v1.json'});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id:item.id,reused:true,inputs:row.diagnostics.transitions,pending:row.unresolved,ms:row.rootAndSearchMilliseconds}));continue;}

 const fixture=JSON.parse(fs.readFileSync(item.path)),seed=fixture.source.seed;
 const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const comp=kernel.composition;
 const runtimeRulesetVersion=JSON.parse(comp.lifecycle.save().envelope.committedState).meta.rulesetVersion;
 let port,row={runtimeRulesetVersion,fixtureRulesetVersion:JSON.parse(fixture.compositionEnvelope.committedState).meta.rulesetVersion,label,caseId:item.id,fixture:item.path,fixtureSha256:item.sha256,classification:item.classification};
 try{assert(comp.lifecycle.restore(fixture.compositionEnvelope).ok);const before=comp.lifecycle.save().envelope,at=performance.now();port=createAnalysisPort({composition:comp,seatId:fixture.seatId,maxCacheEntries:0});const root=port.openRoot(),actions=new Map(),capture=n=>{for(const a of n.legalActions)actions.set(a.actionId,a);},observed={...port,identity(n){capture(n);return port.identity(n);}};
  for(const name of ['expandResourcePlan','expandWithCardPick','expandGoalMovementPlan','expandPostMainOptimalPlan'])observed[name]=(...args)=>{const r=port[name](...args);for(const p of r.prefixes||[])capture(p.node);capture(r.node);return r;};
  row.legalActionCount=root.legalActions.length;row.statusAtRoot=root.status;row.originalActionPresent=root.legalActions.some(a=>a.actionId===fixture.source.originalActionId);assert(row.originalActionPresent);
  const evaluate=createStateValueEvaluator(fixture.seatId);const result=searchDecision({port:observed,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:report.budget});
  row.rootAndSearchMilliseconds=performance.now()-at;
  const loose=result.lines.flatMap(l=>l.edges.filter(e=>!e.resourcePlan&&!e.optimalPlan&&!e.goalPlan&&demand.isPreparation(actions.get(e.actionId)||{})).map(e=>({node:l.node,actionId:e.actionId})));assert.deepEqual(loose,[]);row.independentPreparationEdges=loose.length;
  row.pendingActionEntriesByFamily={};for(const u of result.unresolved)for(const id of u.actionIds){const family=actions.get(id)?.family||'unresolved-internal';row.pendingActionEntriesByFamily[family]=(row.pendingActionEntriesByFamily[family]||0)+1;}
  result.diagnosticActions=Object.fromEntries(actions);row.complete=result.complete;row.stopReason=result.stopReason;row.actionId=result.actionId;row.value=result.value;row.unresolved=result.unresolved.length;row.diagnostics=result.diagnostics;
  row.diagnostic600msPassed=result.complete&&row.rootAndSearchMilliseconds<=600;row.port=port.getDiagnostics();
  const rawPath=`adhoc/ai-decision-corpus-20261023-v1/audit-${item.id}-six-greedy-plans-corpus-20261028-v1.raw.json.gz`;const bytes=zlib.gzipSync(JSON.stringify(result)+'\n');fs.writeFileSync(rawPath,bytes);row.rawPath=rawPath;row.rawSha256=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.deepEqual(comp.lifecycle.save().envelope,before);row.rootUnchanged=true;
 }catch(error){row.status='error';row.error=error.stack;}finally{port?.close();comp.dispose();}
 report.rows.push(row);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({label,id:item.id,choices:row.legalActionCount,complete:row.complete,stopReason:row.stopReason,inputs:row.diagnostics?.transitions,native:row.diagnostics?.nativeExecutions,logicalResourceInputs:row.diagnostics?.logicalResourceInputs,reusedResourceInputs:row.diagnostics?.sharedResourceInputHits,states:row.diagnostics?.nodes,pending:row.unresolved,ms:row.rootAndSearchMilliseconds,error:row.error}));
}
report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.includes('/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));report.status='complete';report.passed=report.rows.filter(r=>r.diagnostic600msPassed).length;report.failed=report.rows.length-report.passed;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(output);

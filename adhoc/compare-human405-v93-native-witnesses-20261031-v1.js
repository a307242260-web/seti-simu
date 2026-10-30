'use strict';
// Counterfactual node attribution, not a new autonomous experiment. Every
// selected witness is separately replayed through native inputPort submission.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib'),{isDeepStrictEqual}=require('node:util');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),rule=require('../randomizer/game/rule-composition'),value=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent');
assert.equal(search.VERSION,'seti-complete-decision-search-v93');
const step=Number(process.argv[2]);assert([24,36,37,38,39,43,56,62].includes(step));
const completePreparation=process.argv[3]==='--complete-preparation';if(completePreparation)assert.equal(step,56);
const fixture=`adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-${String(step).padStart(3,'0')}-20261030-v1.json`,prefix=`reports/ai-foundation-20261023/human405-v93-native-witness-comparison-step${step}${completePreparation?'-fixed-prefix':''}-20261031-v1`,output=prefix+'.json',f=JSON.parse(fs.readFileSync(fixture));
assert(!fs.existsSync(output),'Reuse the existing source-bound checkpoint');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function kernel(){const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});assert(k.composition.lifecycle.restore(f.compositionEnvelope).ok);return k;}
const rows=[],raw=[],boundary=new Set(['information-barrier','other-owner','turn-boundary','terminal']);
for(const name of ['student-best','teacher-first']){
 const k=kernel(),c=k.composition,before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
 try{
  let n=p.openRoot();const rootObservation=n.observation;p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);p.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});
  const steps=[];
  function submit(id){const a=n.legalActions.find(a=>a.actionId===id);assert(a,JSON.stringify({step,name,id,status:n.status}));steps.push({actionId:id,family:a.family,summary:a.summary,target:a.target});n=p.expand(n,id);}
  if(name==='teacher-first'){
   submit(f.source.teacherActionId);
   if(completePreparation){const next=JSON.parse(fs.readFileSync('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-057-20261030-v1.json'));submit(next.source.teacherActionId);}
  }
  let r=null;
  if(!boundary.has(n.status)){
   r=search.searchDecision({port:{...p,postMainValueBound:()=>null,incomePlanSummary:()=>null,turnTailSummary:()=>null},root:n,evaluate:value.createStateValueEvaluator(f.seatId),...agent.OPTIONS,planReuse:false,budget:{transitions:16384,nodes:32768,frontier:16384,milliseconds:30000}});assert(r.complete,r.stopReason);
   let i=0;
   for(let count=0;count<=r.lines.length;count++){
    const line=r.lines[i];if(boundary.has(line.status))break;
    const e=line.edges.filter(e=>r.lines[e.target].value!==null).sort((a,b)=>r.lines[b.target].value-r.lines[a.target].value||(r.lines[a.target].distance+a.cost)-(r.lines[b.target].distance+b.cost)||(a.actionId<b.actionId?-1:1))[0];
    assert(e);assert(!e.knownIncomePlan&&!e.turnTailPlanValue);for(const id of e.steps||[e.actionId])submit(id);i=e.target;
   }
  }
  assert(boundary.has(n.status),n.status);const obs=n.observation,v=value.evaluateStateValue(p.valueObservation(n),f.seatId);if(r)assert.equal(v.total,r.value);
  assert.deepEqual(c.lifecycle.save().envelope,before);
  const replay=kernel(),rc=replay.composition;let envelope,physical;
  try{
   for(const expected of steps){const d=rc.inspect().session?.decision,a=(d?.choices||rc.inputPort.enumerateActions({})).find(a=>a.actionId===expected.actionId);assert(a,expected.actionId);
    const result=d?rc.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?rc.inputPort.submitQuickAction(a):rc.inputPort.submitAction(a);assert(result.ok,JSON.stringify(result));}
   envelope=rc.lifecycle.save().envelope;physical=rc.projection({role:'player',playerId:f.seatId}).state;
   const projected=obs.informationBoundary?rule.sanitizeHiddenInformationObservation(rootObservation,physical,obs.informationBoundary):physical;
   assert.deepEqual(projected.publicState,obs.publicState);assert.deepEqual(projected.selfState,obs.selfState);
   assert.equal(value.evaluateStateValue(projected,f.seatId).total,v.total);
  }finally{rc.dispose();}
  const state=JSON.parse(envelope.committedState),player=state.players.players.find(x=>x.id===f.seatId);
  rows.push({name,forcedFirst:name==='teacher-first'?f.source.teacherActionId:null,status:n.status,boundary:n.boundary||null,value:v,nativeSearchInputs:r?.diagnostics.nativeExecutions||0,witnessInputs:steps.length,steps,
   white:{resources:player.resources,income:player.income,hand:player.hand.map(c=>c.cardId),reserved:player.reservedCards.map(c=>c.cardId),technology:player.techState,computer:player.dataState,probes:state.pieces.rockets.filter(x=>x.playerId===f.seatId)},
   turn:state.turn,formalStateSha256:crypto.createHash('sha256').update(envelope.committedState).digest('hex'),sourceRootAndRngUnchanged:true,independentNativeReplayMatchesPolicyObservationAndValue:true});
  raw.push({name,envelope,observation:obs,physicalObservation:physical});
 }finally{p.close();c.dispose();}
}
const states=raw.map(x=>JSON.parse(x.envelope.committedState)),differences=[];
function diff(a,b,path=''){if(isDeepStrictEqual(a,b))return;if(a&&b&&typeof a==='object'&&typeof b==='object')for(const key of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[key],b[key],path?path+'.'+key:key);else differences.push({path,student:a,teacher:b});}
diff(...states);const rawPath=prefix+'.raw.json.gz';fs.writeFileSync(rawPath,zlib.gzipSync(JSON.stringify(raw)+'\n'));
const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
const report={schemaVersion:'seti-human405-native-witness-comparison-v1',sourceCommit:'f2cde3d2f7005df3944e66b15ee73bcda6ec22dc',step,completePreparation,fixture,fixtureSha256:sha(fixture),rows,
 sameBoundaryStatus:rows[0].status===rows[1].status&&rows[0].boundary===rows[1].boundary,sameFormalState:isDeepStrictEqual(...states),sameSession:isDeepStrictEqual(raw[0].envelope.session,raw[1].envelope.session),stateDifferenceCount:differences.length,stateDifferences:differences,
 rawPath,rawSha256:sha(rawPath),sourceHashes,scope:'Full current production-policy continuations after the best first input or a forced teacher first input, with numeric bounds and typed scalar shortcuts disabled. Both exact witnesses independently replay through inputPort. Different information/turn boundaries are explicit; scalar equality does not establish equivalence.'};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({step,output,rows:rows.map(x=>({name:x.name,value:x.value.total,status:x.status,boundary:x.boundary,inputs:x.nativeSearchInputs,witness:x.witnessInputs,steps:x.steps.map(s=>s.summary)})),sameFormalState:report.sameFormalState,sameSession:report.sameSession,differencePaths:differences.slice(0,24).map(x=>x.path)}));

'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),D=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const pre=read(path.join(D,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
for(const[p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const initial=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(D,'teacher-r4-before-input246-20261119-v1.json.gz')))).envelope;
const record=read(path.join(repo,'reports/research/adcb348b.42c7f5fd.full.terminal-recovery.json')),save=read(path.join(repo,record.savePath));
const trace=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(D,'teacher-r4-input263-search-evidence-20261119-v1.json.gz'))));
const q=trace.search,ns=new Map(q.lines.map(n=>[n.node,n]));assert(q.complete&&q.value===230);
function plan(first){
 let edge=ns.get(0).edges.find(e=>e.actionId===first);assert(edge);let steps=[...edge.steps],node=ns.get(edge.target),seen=new Set([0,node.node]),nodes=[0,node.node];
 while(node.edges.length){
  const choices=node.edges.filter(e=>ns.has(e.target)&&ns.get(e.target).value===node.value&&!seen.has(e.target));assert(choices.length,'Missing exact graph continuation at '+node.node);
  edge=choices.sort((a,b)=>(ns.get(a.target).distance??999)-(ns.get(b.target).distance??999)||a.actionId.localeCompare(b.actionId))[0];steps.push(...edge.steps);node=ns.get(edge.target);nodes.push(node.node);seen.add(node.node);
 }
 assert(['information-barrier','turn-boundary'].includes(node.status));return{steps,nodes,quotedValue:node.value,boundary:node.boundary,status:node.status};
}
const analysisPlan=plan('place_data:8fd12fd3'),scanPlan=plan('scan:2d21a323');
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random')),{createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation')),{createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port')),value=require(path.join(rt,'randomizer/game/ai/state-value'));
const random=createSeededRandom(record.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:record.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,record.seed,v?.playerId)});
const output=path.join(D,'teacher-r4-order-preparation-20261119-v1.json');assert(!fs.existsSync(output));
const report={schemaVersion:'seti-teacher-r4-native-order-preparation-v1',sourceCommit:pre.sourceCommit,status:'running',nativeInputs:5,priorPreparationAttemptInputs:5,newAISearches:0,newGames:0,analysisPlan,scanPlan,branches:{}};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const envelope=()=>c.lifecycle.save().envelope;const state=()=>{const e=envelope();return e.session?.session?.workingState||JSON.parse(e.committedState)};
function submit(id,allowPassive=false){assert(report.nativeInputs<500);const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null,actions=d?d.choices:c.inputPort.enumerateActions({}),a=actions.find(a=>a.actionId===id);assert(a,'Native action unavailable: '+id);if(a.actorId!==seat)assert(allowPassive&&(a.family==='pass'||a.phase==='conditional'),'Non-passive other-player input');
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));report.nativeInputs++;persist();return a;}
function facts(){const s=state(),p=s.players.players.find(p=>p.id===seat);return{turn:s.turn,resources:p.resources,income:p.income,technology:p.techState,hand:p.hand.map(c=>({id:c.id,cardId:c.cardId})),reserved:p.reservedCards.map(c=>({id:c.id,cardId:c.cardId})),data:p.dataState,probes:s.pieces.rockets.filter(p=>p.playerId===seat),rng:s.meta.rngState};}
function quote(){const port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=port.openRoot();return{observation:root.observation,evaluation:value.evaluateStateValue(root.observation,seat)}}finally{port.close()}}
try{
 c.lifecycle.newGame({seed:record.seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(initial).ok);
 for(const e of save.replaySteps.slice(245,262))submit(e.action.actionId,true);
 const root=envelope(),rootFacts=facts(),rootQuote=quote();assert.deepEqual(rootQuote.observation.publicState,trace.context.observation.publicState);assert.deepEqual(rootQuote.observation.selfState,trace.context.observation.selfState);
 const rootPath='reports/ai-foundation-20261119/teacher-r4-before-input263-20261119-v1.json.gz';fs.writeFileSync(path.join(repo,rootPath),zlib.gzipSync(JSON.stringify({envelope:root})));
 report.rootPath=rootPath;report.rootFacts=rootFacts;report.rootEvaluation=rootQuote.evaluation;report.rootMatchesRecordedObservation=true;persist();
 for(const[name,steps]of [['landing-first',save.replaySteps.slice(262,282).map(e=>e.action.actionId)],['analysis-first',analysisPlan.steps],['scan-first',scanPlan.steps]]){
  assert(c.lifecycle.restore(root).ok);assert.deepEqual(envelope(),root);const actions=steps.map(id=>submit(id)),end=envelope(),q=quote();
  const p='reports/ai-foundation-20261119/teacher-r4-order-'+name+'-20261119-v1.json.gz';fs.writeFileSync(path.join(repo,p),zlib.gzipSync(JSON.stringify({root,envelope:end,actions,observation:q.observation})));
  report.branches[name]={checkpoint:p,nativeInputs:actions.length,facts:facts(),evaluation:q.evaluation,recordedQuote:name==='landing-first'?230:name==='analysis-first'?analysisPlan.quotedValue:scanPlan.quotedValue,recordedBoundary:name==='landing-first'?'own-turn-complete':name==='analysis-first'?analysisPlan.boundary:scanPlan.boundary};persist();
 }
 report.status='complete';persist();console.log(JSON.stringify({status:report.status,nativeInputs:report.nativeInputs,branches:Object.fromEntries(Object.entries(report.branches).map(([k,v])=>[k,{inputs:v.nativeInputs,resources:v.facts.resources,value:v.evaluation.total,components:v.evaluation.components,hand:v.facts.hand,probes:v.facts.probes,turn:v.facts.turn.turnNumber}]))}));
}catch(e){report.status='failed';report.failure={message:e.message,stack:e.stack,envelope:envelope()};persist();console.error(e.stack);process.exitCode=1;}finally{c.dispose()}

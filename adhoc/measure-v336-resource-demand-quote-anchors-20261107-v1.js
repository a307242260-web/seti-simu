'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const demandFile=require.resolve('../randomizer/game/ai/resource-demand'),relative=path.relative(root,demandFile);
assert.equal(sha(demandFile),manifest.sourceHashes[relative]||manifest.baseRuntimeHashes[relative]);
const counts={calls:0,hits:0,repeatedMs:0,anchoredHits:0,anchoredRepeatedMs:0,frozenStateCalls:0,frozenStateHits:0,referencesOnAllMutableBoardSections:0,sharedBoardAnchorHits:0,sharedBoardAnchorRepeatedMs:0,byteSumAnchoredKey:0,uniqueMs:0},seen=new Map(),anchors=new Map(),ids=new WeakMap(),recent=new Map();let next=0;
const referenceId=v=>{if(v===null||typeof v!=='object')return v;if(!ids.has(v))ids.set(v,++next);return ids.get(v);};
globalThis.__V336_DEMAND_TEST__={counts,seen,anchors,ref:referenceId,recent};
let src=fs.readFileSync(demandFile,'utf8');
const marker='  function planningCapital(state,p){',end='  function movementToolPlan(state,p)';
assert.equal(src.split(marker).length,2);assert.equal(src.split(end).length,2);
src=src.replace(marker,`  function planningCapital(state,p){
    const {counts,seen,anchors,ref,recent}=globalThis.__V336_DEMAND_TEST__;
    if(Object.isFrozen(state)&&Object.isFrozen(p))return planningCapitalDetails(state,p).total;
    const facts=valueFacts(state,p),full=JSON.stringify(facts),old=seen.get(full),sameState=old?.states.has(state),
      board=facts.board,boardKey=[board.planets,board.rockets,board.data,board.solarSystem,board.finalScoring,board.publicCards,state.tech].map(ref).join('|'),
      sameBoard=old?.boardKeys.has(boardKey);
    counts.calls++;if(Object.isFrozen(state)&&immutableCapitalInput(state))counts.frozenStateCalls++;
    const at=performance.now(),value=stateValue.purposeCapital(facts).total,ms=performance.now()-at;
    if(old){
      if(old.value!==value)throw Error('full facts conflict');
      counts.hits++;counts.repeatedMs+=ms;
      if(sameState){counts.anchoredHits++;counts.anchoredRepeatedMs+=ms;if(Object.isFrozen(state)&&immutableCapitalInput(state))counts.frozenStateHits++;}
      if(sameBoard){counts.sharedBoardAnchorHits++;counts.sharedBoardAnchorRepeatedMs+=ms;}
    }else counts.uniqueMs+=ms;
    const {board:omit,supply,...rest}=facts,anchor=JSON.stringify(rest);counts.byteSumAnchoredKey+=anchor.length;
    const record=old||{value,states:new Set(),boardKeys:new Set()};record.states.add(state);record.boardKeys.add(boardKey);seen.set(full,record);return value;
  }
  function replacedPlanningCapital(state,p){`);
const m=new Module(demandFile,module);m.filename=demandFile;m.paths=module.paths;require.cache[demandFile]=m;m._compile(src,demandFile);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Mutable planning scalar callers, with state and board reference anchoring; no change to Native result',fixture,acceptance,counts}));}finally{p.close();c.dispose();}

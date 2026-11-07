'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const data=require('../randomizer/game/data');
const cards=require('../randomizer/game/cards/effects');
const scoring=require('../randomizer/game/end-game-scoring');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const {BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const [captureFile,routeFile,output,lateFile]=process.argv.slice(2),read=f=>JSON.parse(fs.readFileSync(f)),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const capture=read(captureFile),route=read(routeFile),late=lateFile&&read(lateFile),before=capture.rows.find(r=>r.label==='after-analysis').envelope;
assert.equal(capture.routeSha256,sha(routeFile));const path=route.rows[0].path,seed='seti-free-analyze-v1',seatId='player-white';
const native=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
native.newGame({seed});const c=native.composition;
const save=()=>c.lifecycle.save().envelope,restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
const committed=()=>JSON.parse(save().committedState);
const player=s=>s.players.players.find(p=>p.id===seatId);
const pair=(a,b)=>path.slice(a,b).map(x=>x.id);
const end=pair(13,14),research=pair(14,16),one=pair(16,18),blue=pair(18,20),twoThree=pair(20,24),fourIncome=pair(24,27),close=pair(27,28);
const afterAnalysisCorner=capture.rows.find(r=>r.label==='after-analysis').actions.find(a=>a.family==='card_corner'&&a.target.cardInstanceId==='alien-amiba-7-10');
assert(afterAnalysisCorner);
const controls={
  'reference':pair(13,28),
  'blue-after-three':[...end,...research,...one,...twoThree,...blue,...fourIncome,...close],
  'computer-before-research':[...one,...twoThree,...end,...research,...blue,...fourIncome,...close],
  'computer-before-and-early-corner':[...one,...twoThree,...end,afterAnalysisCorner.actionId,...fourIncome,...research,...blue,...close],
  'corner-and-income-before-research':[...end,afterAnalysisCorner.actionId,...one,...twoThree,...fourIncome,...research,...blue,...close],
  'corner-and-income-no-research':[...end,afterAnalysisCorner.actionId,...one,...twoThree,...fourIncome],
};
function step(id){
 const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===id&&a.actorId===seatId);
 assert(a,`missing ${id} from ${JSON.stringify(d?.choices?.map(x=>x.actionId))}`);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok);return{actionId:id,family:a.family,target:a.target,summary:a.summary};
}
function inspect(){
 const envelope=save(),s=committed(),p=player(s);
 const scoreBreakdown=scoring.computePlayerFinalScore({...s,players:s.players.players,currentPlayer:p,cardEffects:cards,
   getCardTypeCode:card=>cards.getRuntimeCardTypeCode(card,cards.getCardModel(card)?.cardType)},p);
 const scan=c.inputPort.enumerateActions({}).find(a=>a.family==='scan');
 const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seatId);
 let value,publicScanPurposes;try{port.setResourcePlanning(true);port.setDecisionPlanning({scanPlanning:true});const root=port.openRoot();
  value=evaluate(port.valueObservation(root));publicScanPurposes=port.resourceSpec(root)?.plans.filter(plan=>plan.goal.kind==='scan-flow').map(plan=>plan.goal.id);
 }finally{port.close();}
 assert.deepEqual(save(),envelope);
 return {scoreBreakdown,resources:p.resources,income:p.income,hand:p.hand.map(x=>[x.id,x.cardId]),computer:data.listComputerPlacedTokens(p).map(x=>[x.placementSlot,x.id]),
   blue:data.listBlueBonusPlacedTokens(p).map(x=>[x.blueSlot,x.id]),tech:Object.keys(p.techState.ownedTiles).filter(id=>p.techState.ownedTiles[id]),value,scanFunded:!!scan,publicScanPurposes};
}
function differences(a,b,path='',out=[]){
 if(Object.is(a,b))return out;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b)){out.push({path,a,b});return out;}
 for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],path+'/'+k,out);
 return out;
}
const rows={},decisionRoots={};try{
 for(const [name,ids] of Object.entries(controls)){
  restore(before);
  const coldPoints={
   'computer-before-and-early-corner':{7:'before-research-computer3',11:'before-research-income-paid'},
   'computer-before-research':{9:'after-research-computer3'},
  }[name]||{};
  const accepted=ids.map((id,i)=>{
   const label=coldPoints[i];if(label){
    const envelope=save(),port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0}),evaluate=createStateValueEvaluator(seatId);
    try{const t=performance.now(),root=port.openRoot(),search=searchDecision({port,root,evaluate,budget:BUDGET,modelKey:evaluate.modelKey,...OPTIONS});
      decisionRoots[label]={envelope,ms:performance.now()-t,actions:root.legalActions,search};
      assert.deepEqual(save(),envelope);
    }finally{port.close();}
   }
   return step(id);
  });
  const funded=inspect(),fundedEnvelope=save();
  if(name==='reference')assert.deepEqual(fundedEnvelope,capture.rows.find(r=>r.label==='funded-red').envelope);
  const finalSteps=name==='corner-and-income-no-research'?[]:pair(28,36).map(step);
  const afterScan=inspect(),endEnvelope=save();
  restore(before);for(const x of [...accepted,...finalSteps])step(x.actionId);assert.deepEqual(save(),endEnvelope);
  rows[name]={accepted,funded,fundedEnvelope,finalSteps,afterScan,endEnvelope,independentReplayExact:true};
 }
 const r=rows.reference;
 for(const [name,x] of Object.entries(rows)){
  if(name==='reference')continue;
  x.fundedDiff=differences(JSON.parse(r.fundedEnvelope.committedState),JSON.parse(x.fundedEnvelope.committedState));
  x.afterScanDiff=differences(JSON.parse(r.endEnvelope.committedState),JSON.parse(x.endEnvelope.committedState));
  x.sameFundedRng=JSON.stringify(JSON.parse(r.fundedEnvelope.committedState).meta.rngState)===JSON.stringify(JSON.parse(x.fundedEnvelope.committedState).meta.rngState);
 }
 assert(r.funded.scanFunded&&!rows['corner-and-income-no-research'].funded.scanFunded);
 assert(rows['corner-and-income-before-research'].funded.scanFunded);
 assert(r.funded.hand.some(([id])=>id===afterAnalysisCorner.target.cardInstanceId));
 assert(!rows['corner-and-income-before-research'].funded.hand.some(([id])=>id===afterAnalysisCorner.target.cardInstanceId));
 const onward={};
 if(late){
  const routeTail=late.rows[0].path;
  const candidateActions=()=>c.inputPort.enumerateActions({}).filter(a=>a.actorId===seatId&&!['move','quick_trade'].includes(a.family)).map(a=>({id:a.actionId,family:a.family,summary:a.summary,target:a.target}));
  for(const name of ['reference','computer-before-research','corner-and-income-before-research','computer-before-and-early-corner']){
   restore(rows[name].endEnvelope);const prefix=pair(36,49).map(step),next=inspect(),actions=candidateActions(),envelope=save();
   if(!name.endsWith('early-corner')&&name!=='corner-and-income-before-research'){
    const tail=routeTail.map(x=>step(x.id));onward[name]={prefix,next,actions,envelope,tail,roundEnd:inspect(),roundEndEnvelope:save()};
   }else{
    // The early corner supplies the otherwise missing slot6 data. Try
    // that legal placement followed by analysis as this turn's main action.
    const ids=[...routeTail.slice(4,6),...routeTail.slice(7)].map(x=>x.id);
    const tail=ids.map(step);
    onward[name]={prefix,next,actions,envelope,tail,roundEnd:inspect(),roundEndEnvelope:save()};
   }
  }
  assert.deepEqual(onward.reference.roundEnd.resources,onward['computer-before-research'].roundEnd.resources);
  assert.deepEqual(onward.reference.roundEnd.income,onward['computer-before-research'].roundEnd.income);
  for(const [name,x] of Object.entries(onward)){
   restore(before);
   for(const a of [...rows[name].accepted,...rows[name].finalSteps,...x.prefix,...x.tail])step(a.actionId);
   assert.deepEqual(save(),x.roundEndEnvelope);x.independentReplayExact=true;
  }
 }
 restore(before);const report={captureFile,captureSha256:sha(captureFile),routeFile,routeSha256:sha(routeFile),...(lateFile?{lateFile,lateSha256:sha(lateFile)}:{}),rows,onward,decisionRoots,rootAndRngRestored:true,autonomousRuns:0};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 for(const [name,x] of Object.entries(rows)){console.log(name,JSON.stringify({funded:x.funded,afterScan:x.afterScan,ds:x.fundedDiff?.map(d=>d.path),es:x.afterScanDiff?.map(d=>d.path)}));}
}finally{c.dispose();}
